import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { V2LabData, V2Page } from "../InvestorCabinetV2Lab";
import { computePortfolioHealth, type HealthComponent, type PortfolioHealth } from "../../lib/portfolioHealth";
import { V2HealthDetailModal } from "./V2HealthDetailModal";
import { V2ReportsPage } from "./V2ReportsPage";
import { V2SignalsPage } from "./V2SignalsPage";
import { V2GatePage } from "./V2GatePage";
import { V2RiskEnginePage } from "./V2RiskEnginePage";
import { V2ScenariosPage } from "./V2ScenariosPage";
import { V2DeployableCapital } from "./V2DeployableCapital";
import { V2CapitalLadder } from "./V2CapitalLadder";
import { V2DCAStrategy } from "./V2DCAStrategy";
import { V2PortfolioAllocationCard } from "./V2PortfolioAllocationCard";
import { V2HealthCore } from "./V2HealthCore";
import { V2SettingsPage } from "./V2SettingsPage";
import { V2BtcDailyChart } from "./V2BtcDailyChart";
import { V2TabBar } from "./V2TabBar";

import { V2PortfolioPage } from "./V2PortfolioPage";
import type { TonStaking } from "../../hooks/useTonStaking";
import type { CosmosStaking } from "../../hooks/useCosmosStaking";
import { V2HealthPage } from "./V2HealthPage";
import { V2InvestorDNAPage } from "./V2InvestorDNAPage";
import { V2EducationPage } from "./V2EducationPage";
import { V2NotificationsPanel } from "./V2NotificationsPanel";
import { buildPortfolioAlerts, sortAlerts, type Alert } from "../lib/portfolioAlerts";
import { V2Sidebar } from "./V2Sidebar";
import { V2TopMetrics } from "./V2TopMetrics";
import { V2StarField } from "./V2StarField";
import { useAuth } from "../../hooks/useAuth";
import {
  appendDecisionJournalEntry,
  readDecisionJournal,
  removeDecisionJournalEntry,
  type DecisionJournalDraft,
  type DecisionJournalEntry,
} from "../lib/decisionJournal";
import { evaluateBehavior } from "../lib/behaviorEngine";
import { getMarketPsychology } from "../lib/marketPsychology";
import { buildTradeCandidateFromSignal, type TradeCandidate } from "../lib/tradeCandidate";

type Props = {
  data: V2LabData;
  page: V2Page;
  onNavigate: (page: V2Page) => void;
  locked?: boolean;
  onOpenAuth: (tab: "signin" | "signup") => void;
  staking?: TonStaking | null;
  cosmosStaking?: CosmosStaking | null;
  dataStatus?: {
    source: "cache" | "fallback" | "live";
    status: string;
    lastLoadedAt: string | null;
    error: string | null;
  };
};

const DESKTOP_DESIGN_WIDTH = 1920;
const DESKTOP_DESIGN_HEIGHT = 1080;
const MOBILE_BREAKPOINT = 768;
// Геометрия сцены — те же значения, что в .v2-lab (padding / колонка / gap).
const SCENE_PADDING = 18;
const SCENE_GAP = 18;
const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 64;

function getDesktopViewport() {
  if (window.innerWidth <= MOBILE_BREAKPOINT) {
    return { scale: 1, logicalHeight: window.innerHeight, offsetX: 0 };
  }

  // Museum canvas: one fixed 1920x1080 composition. Every desktop viewport sees
  // the same scene, scaled as a whole and centered with controlled side fields.
  const scale = Math.min(
    window.innerWidth / DESKTOP_DESIGN_WIDTH,
    window.innerHeight / DESKTOP_DESIGN_HEIGHT,
  );
  const offsetX = Math.max(0, (window.innerWidth - DESKTOP_DESIGN_WIDTH * scale) / 2);

  return {
    scale,
    logicalHeight: Math.max(DESKTOP_DESIGN_HEIGHT, window.innerHeight / scale),
    offsetX,
  };
}

function DataStatusBadge({ dataStatus }: { dataStatus: NonNullable<Props["dataStatus"]> }) {
  const { source, status, lastLoadedAt, error } = dataStatus;
  let tone = "is-live";
  let label = "ЖИВЫЕ";
  if (error && source === "fallback") { tone = "is-error"; label = "ОШИБКА"; }
  else if (status === "stale" || (error && source !== "fallback")) { tone = "is-stale"; label = "УСТАРЕЛО"; }
  else if (source === "cache") { tone = "is-cache"; label = "КЭШ"; }
  else if (source === "fallback") { tone = "is-cache"; label = "ДЕМО"; }

  const time = lastLoadedAt
    ? new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastLoadedAt))
    : null;

  return (
    <div className={`v2-datastatus ${tone}`} title={error ?? `Источник: ${source} · ${status}`}>
      <span className="v2-datastatus-dot" />
      <span className="v2-datastatus-label">{label}</span>
      {time && <span className="v2-datastatus-time">{time}</span>}
    </div>
  );
}

export function V2Shell({ data, page, onNavigate, locked = false, onOpenAuth, staking, cosmosStaking, dataStatus }: Props) {
  const { user, displayName } = useAuth();
  // Профиль (имя/аватар) храним отдельно на каждый аккаунт — чтобы аватар и имя
  // одного пользователя не показывались другому на том же устройстве.
  const profileKeySuffix = user ? `:${user.id}` : "";
  const nameKey   = `mushii-profile-name${profileKeySuffix}`;
  const avatarKey = `mushii-profile-avatar${profileKeySuffix}`;
  const [profileName,   setProfileName]   = useState(() => localStorage.getItem(nameKey)   ?? "");
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem(avatarKey) ?? "");
  const [decisionJournal, setDecisionJournal] = useState<DecisionJournalEntry[]>(() =>
    readDecisionJournal(profileKeySuffix),
  );

  // При смене аккаунта подгружаем его профиль (или пустой у нового пользователя).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синк профиля из localStorage при смене аккаунта
    setProfileName(localStorage.getItem(nameKey)   ?? "");
    setProfileAvatar(localStorage.getItem(avatarKey) ?? "");
    setDecisionJournal(readDecisionJournal(profileKeySuffix));
  }, [nameKey, avatarKey, profileKeySuffix]);
  const [selectedChip, setSelectedChip] = useState<HealthComponent | null>(null);
  const [capitalOpen, setCapitalOpen] = useState(false);
  const [desktopViewport, setDesktopViewport] = useState(getDesktopViewport);
  const labRef = useRef<HTMLDivElement | null>(null);
  const [canvasContentHeight, setCanvasContentHeight] = useState(DESKTOP_DESIGN_HEIGHT);
  const [tradeCandidate, setTradeCandidate] = useState<TradeCandidate | null>(null);

  useEffect(() => {
    const updateViewport = () => {
      setDesktopViewport(prev => {
        const next = getDesktopViewport();
        // iOS Safari шлёт resize на каждом кадре скролла (сворачивание
        // адресной строки меняет innerHeight). Обновление стейта здесь
        // перерисовывало весь shell и заставляло нижний таб-бар «плыть».
        // Дёргаем стейт только когда изменение реально значимо.
        if (next.scale === prev.scale && window.innerWidth <= MOBILE_BREAKPOINT) return prev;
        if (next.scale === prev.scale && Math.abs(next.logicalHeight - prev.logicalHeight) < 0.5) return prev;
        return next;
      });
    };
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  function handleSaveProfile(name: string, avatar: string) {
    setProfileName(name);
    setProfileAvatar(avatar);
    localStorage.setItem(nameKey,   name);
    localStorage.setItem(avatarKey, avatar);
  }

  function handleSaveDecision(draft: DecisionJournalDraft) {
    setDecisionJournal((current) => appendDecisionJournalEntry(current, draft, profileKeySuffix));
  }

  function handleOpenTradeCandidate(candidate: TradeCandidate) {
    setTradeCandidate(candidate);
    onNavigate("gate");
  }

  function handleDeleteDecision(id: string) {
    setDecisionJournal((current) => removeDecisionJournalEntry(current, id, profileKeySuffix));
  }

  const marketPsychology = useMemo(
    () => getMarketPsychology(data.fearGreedStrategy.currentIndex, data.fearGreedStrategy.history),
    [data.fearGreedStrategy.currentIndex, data.fearGreedStrategy.history],
  );
  const behavior = useMemo(
    () => evaluateBehavior(decisionJournal, new Date(), marketPsychology),
    [decisionJournal, marketPsychology],
  );
  const behaviorHealthInput = useMemo(
    () => ({
      ...data.healthInput,
      ...behavior.healthInputs,
    }),
    [data.healthInput, behavior.healthInputs],
  );
  const behaviorHealth = useMemo<PortfolioHealth>(() => {
    const computed = computePortfolioHealth(behaviorHealthInput);
    return {
      ...computed,
      healthFactor: Math.round(computed.healthFactor),
    };
  }, [behaviorHealthInput]);
  const behaviorPortfolio = useMemo(
    () => ({
      ...data.portfolio,
      healthFactor: Math.round(behaviorHealth.healthFactor),
      healthStatus: behaviorHealth.status,
      riskLevel: behaviorHealth.riskLevel,
    }),
    [data.portfolio, behaviorHealth],
  );

  // Мобильное меню-шторка: на ≤768px сайдбар (все 8 страниц + Выход) скрыт,
  // а гамбургер его выдвигает. Навигация закрывает шторку.
  const [menuOpen, setMenuOpen] = useState(false);
  const handleNavigate = (p: V2Page) => {
    onNavigate(p);
    setMenuOpen(false);
  };

  const [notifOpen, setNotifOpen] = useState(false);

  // Свёрнутый сайдбар запоминаем: это осознанный выбор рабочего режима,
  // а не разовое действие.
  const collapseKey = "mushii-sidebar-collapsed";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(collapseKey) === "1"
  );

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      localStorage.setItem(collapseKey, prev ? "0" : "1");
      return !prev;
    });
  };

  useLayoutEffect(() => {
    const node = labRef.current;
    if (!node || window.innerWidth <= MOBILE_BREAKPOINT) return undefined;

    const measure = () => {
      const nextHeight = Math.max(DESKTOP_DESIGN_HEIGHT, Math.ceil(node.scrollHeight));
      setCanvasContentHeight((current) => current === nextHeight ? current : nextHeight);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, sidebarCollapsed, capitalOpen, selectedChip]);

  // Health Factor с прошлого захода — чтобы поймать его просадку.
  // Читаем один раз при монтировании, перезаписываем уже после сравнения.
  const healthKey = `mushii-last-health${profileKeySuffix}`;
  const [previousHealthFactor] = useState<number | null>(() => {
    const raw = localStorage.getItem(healthKey);
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  });

  useEffect(() => {
    const hf = behaviorHealth.healthFactor;
    if (typeof hf === "number" && Number.isFinite(hf)) {
      localStorage.setItem(healthKey, String(hf));
    }
  }, [healthKey, behaviorHealth.healthFactor]);

  // Тревоги считаются тем же движком, что и на странице «Сигналы»,
  // иначе счётчик на колокольчике расходился бы со списком.
  const alerts = useMemo(
    () =>
      sortAlerts(
        buildPortfolioAlerts({
          portfolio: behaviorPortfolio,
          positions: data.positions,
          allocation: data.allocation,
          currentFG: data.fearGreedStrategy.currentIndex,
          health: behaviorHealth,
          interestSignals: data.signals?.interestList ?? [],
          marketPsychology,
          signalNotification: {
            disciplineCooldownActive: behavior.healthInputs.disciplineCooldownActive,
          },
          previousHealthFactor,
          strategy: data.strategy,
        })
      ),
    [behaviorPortfolio, data.positions, data.allocation, data.fearGreedStrategy.currentIndex, marketPsychology, behaviorHealth, data.signals, behavior.healthInputs.disciplineCooldownActive, previousHealthFactor, data.strategy]
  );

  const criticalCount = alerts.filter((alert) => alert.level === "critical").length;

  function signalFromAlert(alert: Alert) {
    const signals = data.signals?.interestList ?? [];
    const prefixes = ["signal-triggered-", "signal-near-"];
    const prefix = prefixes.find((item) => alert.id.startsWith(item));
    if (!prefix) return null;
    const id = alert.id.slice(prefix.length);
    return signals.find((signal) => signal.id === id) ?? null;
  }

  function handleAlertAction(alert: Alert) {
    setNotifOpen(false);

    if (alert.action === "Открыть проверку риска") {
      const signal = signalFromAlert(alert);
      const candidate = signal ? buildTradeCandidateFromSignal(signal, data.positions) : null;
      if (candidate) {
        handleOpenTradeCandidate(candidate);
      } else {
        handleNavigate("gate");
      }
      return;
    }

    if (alert.action === "Открыть разбор здоровья") {
      handleNavigate("health");
      return;
    }

    if (alert.action === "Открыть стратегию") {
      handleNavigate("signals");
      return;
    }

    if (alert.action === "Пополнить резерв" || alert.action === "Срочно пополнить") {
      setCapitalOpen(true);
      handleNavigate("overview");
      return;
    }

    if (alert.action === "Новый альт — только вместо старого") {
      handleNavigate("gate");
    }
  }

  const canHandleAlertAction = (alert: Alert) =>
    alert.action === "Открыть проверку риска" ||
    alert.action === "Открыть разбор здоровья" ||
    alert.action === "Открыть стратегию" ||
    alert.action === "Пополнить резерв" ||
    alert.action === "Срочно пополнить" ||
    alert.action === "Новый альт — только вместо старого";

  // Центр зазора между сайдбаром и контентом в координатах ЭКРАНА.
  // Сцена шириной 1920 масштабируется и центрируется, поэтому к отступу
  // сцены добавляем масштабированную ширину колонки и половину зазора.
  const isMobile = desktopViewport.scale === 1 && window.innerWidth <= MOBILE_BREAKPOINT;
  const railLeft = desktopViewport.offsetX +
    (SCENE_PADDING + (sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH) + SCENE_GAP / 2) * desktopViewport.scale;

  return (
    <div
      className="v2-canvas"
      style={{
        "--v2-desktop-scale": desktopViewport.scale,
        "--v2-logical-height": `${desktopViewport.logicalHeight}px`,
        "--v2-canvas-offset-x": `${desktopViewport.offsetX}px`,
        "--v2-canvas-width": `${DESKTOP_DESIGN_WIDTH * desktopViewport.scale}px`,
        "--v2-canvas-height": `${canvasContentHeight * desktopViewport.scale}px`,
      } as CSSProperties}
    >
    <div
      ref={labRef}
      className={sidebarCollapsed ? "v2-lab is-sidebar-collapsed" : "v2-lab"}
    >
      {/* Мобильная шапка (только ≤768px) */}
      <header className="v2-mob-header">
        <button className="v2-mob-hamburger" type="button" aria-label="Меню" onClick={() => setMenuOpen(true)}>
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 5h14M2 9h14M2 13h14" strokeLinecap="round" />
          </svg>
        </button>
        <div className="v2-mob-brand">
          <span className="v2-mob-brand-title">MUSHII INVEST</span>
          <span className="v2-mob-brand-sub">RISK FIRST / PNL SECOND</span>
        </div>
        <button className="v2-mob-bell" type="button" aria-label="Уведомления" onClick={() => setNotifOpen(true)}>
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M9 2a4 4 0 00-4 4c0 4-1.6 5-1.6 5h11.2S13 10 13 6a4 4 0 00-4-4z" />
            <path d="M7.4 14a1.6 1.6 0 003.2 0" strokeLinecap="round" />
          </svg>
          {criticalCount > 0 && <span className="v2-mob-bell-badge">{criticalCount}</span>}
        </button>
      </header>

      {/* Живые звёзды и вспышки поверх фото */}
      <V2StarField />
      {/* Бэкдроп мобильной шторки */}
      {menuOpen && <div className="v2-mob-drawer-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <V2Sidebar
        mobileOpen={menuOpen}
        onCloseMobile={() => setMenuOpen(false)}
        activePage={page}
        onNavigate={handleNavigate}
        healthFactor={behaviorPortfolio.healthFactor}
        healthStatus={behaviorPortfolio.healthStatus}
        portfolio={behaviorPortfolio}
        health={behaviorHealth}
        positions={data.positions}
        transactions={data.transactions}
        /* Имя из настроек профиля, а если его не задавали — имя аккаунта
           (метаданные регистрации, иначе часть email). «ИНВЕСТОР» остаётся
           только для гостя. */
        collapsed={sidebarCollapsed}
        profileName={profileName || displayName}
        profileAvatar={profileAvatar}
        onOpenAuth={onOpenAuth}
      />


      <main className={locked ? "v2-main is-locked" : "v2-main"}>
        {dataStatus && !locked && <DataStatusBadge dataStatus={dataStatus} />}
        {locked && (
          <div className="v2-lock-hint" aria-hidden="true">
            <span className="v2-lock-hint-icon">🔒</span>
            <span>Войдите, чтобы открыть кабинет</span>
          </div>
        )}
        {page === "settings" ? (
          <V2SettingsPage
            initialName={profileName}
            initialAvatar={profileAvatar}
            onSave={handleSaveProfile}
          />
        ) : page === "signals" ? (
          <V2SignalsPage
            portfolio={behaviorPortfolio}
            positions={data.positions}
            risk={data.risk}
            health={behaviorHealth}
            fearGreedStrategy={data.fearGreedStrategy}
            allocation={data.allocation}
            interestSignals={data.signals?.interestList?.length
              ? data.signals.interestList
              : data.signals?.interest
                ? [data.signals.interest]
                : []}
            strategy={data.strategy}
            disciplineCooldownActive={behavior.healthInputs.disciplineCooldownActive}
            onOpenTradeCandidate={handleOpenTradeCandidate}
            onNavigate={handleNavigate}
          />
        ) : page === "gate" ? (
          <V2GatePage
            key={tradeCandidate?.id ?? "manual-gate"}
            portfolio={behaviorPortfolio}
            positions={data.positions}
            allocation={data.allocation}
            fearGreedStrategy={data.fearGreedStrategy}
            assetQuality={data.assetQuality}
            healthInput={behaviorHealthInput}
            strategy={data.strategy}
            profile={data.profile}
            futuresShare={data.risk.futuresShare}
            onSaveDecision={handleSaveDecision}
            candidate={tradeCandidate}
            onClearCandidate={() => setTradeCandidate(null)}
            disciplineBlockers={behavior.blockers}
            disciplineWarnings={behavior.warnings}
          />
        ) : page === "reports" ? (
          <V2ReportsPage
            history={data.history}
            transactions={data.transactions}
            positions={data.positions}
            realizedPnlUsd={data.portfolio.realizedPnlUsd}
            decisionJournal={decisionJournal}
            behavior={behavior}
            strategy={data.strategy}
            onDeleteDecision={handleDeleteDecision}
          />
        ) : page === "portfolio" ? (
          <V2PortfolioPage
            positions={data.positions}
            playbook={data.playbook}
            staking={staking}
            cosmosStaking={cosmosStaking}
            realizedPnlUsd={data.portfolio.realizedPnlUsd}
            realizedPnlPct={data.portfolio.realizedPnlPct}
            strategy={data.strategy}
          />
        ) : page === "scenarios" ? (
          <V2ScenariosPage playbook={data.playbook} positions={data.positions} />
        ) : page === "health" ? (
          <V2HealthPage
            portfolio={behaviorPortfolio}
            health={behaviorHealth}
            healthInput={behaviorHealthInput}
            strategy={data.strategy}
            dna={data.dna}
            onOpenDNA={() => handleNavigate("dna")}
          />
        ) : page === "dna" ? (
          <V2InvestorDNAPage
            dna={data.dna}
            onNavigate={handleNavigate}
          />
        ) : page === "education" ? (
          <V2EducationPage />
        ) : page === "risk" ? (
          <V2RiskEnginePage
            portfolio={behaviorPortfolio}
            health={behaviorHealth}
            risk={data.risk}
            allocation={data.allocation}
            strategy={data.strategy}
          />
        ) : (
        <section className="v2-command-grid" aria-label="Investor Cabinet V2 overview">
          <V2TopMetrics
            portfolio={behaviorPortfolio}
            history={data.history}
            capitalOpen={capitalOpen}
            onToggleCapital={() => setCapitalOpen((v) => !v)}
          />
          <div className={`v2-capital-dropdown ${capitalOpen ? "is-open" : ""}`}>
            <div className="v2-capital-dropdown-inner">
              <V2DeployableCapital
                portfolio={behaviorPortfolio}
                allocation={data.allocation}
                strategy={data.fearGreedStrategy}
                investorStrategy={data.strategy}
                futuresShare={data.risk.futuresShare}
              />
            </div>
          </div>

          {/* Блок здоровья — на всю ширину */}
          <div className="v2-hero-reactor">
            <V2HealthCore
              portfolio={behaviorPortfolio}
              health={behaviorHealth}
              healthInput={behaviorHealthInput}
              strategy={data.strategy}
              onChipSelect={setSelectedChip}
              onNavigate={onNavigate}
            />
          </div>

          <div className="v2-cap-ladder-slot">
            <V2CapitalLadder portfolio={behaviorPortfolio} strategy={data.strategy} />
          </div>

          {/* Под радаром: распределение + DCA рядом */}
          <div className="v2-alloc-center-row">
            <div className="v2-alloc-center-inner">
              <span aria-hidden="true" className="v2-hud-corners" />
              <V2PortfolioAllocationCard allocation={data.allocation} total={data.portfolio.totalPortfolioValue} positions={data.positions} strategy={data.strategy} futuresShare={data.risk.futuresShare} />
            </div>
            <div className="v2-alloc-dca-slot">
              <V2DCAStrategy
                portfolio={behaviorPortfolio}
                strategy={data.fearGreedStrategy}
                investorStrategy={data.strategy}
                onNavigate={onNavigate}
              />
            </div>
          </div>

          <V2BtcDailyChart currentFearGreed={data.fearGreedStrategy.currentIndex} />
        </section>
        )}
      </main>
      <V2TabBar activePage={page} onNavigate={onNavigate} criticalCount={criticalCount} />

      {/* Рычаг живёт ВНЕ .v2-lab: у сцены zoom, и fixed-потомок внутри него
          терял горизонтальное смещение центрирования — рычаг заезжал на
          сайдбар. Снаружи координата считается явно и не зависит от масштаба. */}
      {!isMobile && createPortal(
        <button
          className="v2-rail-toggle"
          type="button"
          style={{ left: `${railLeft}px` }}
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
          title={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          <span className="v2-rail-toggle-grip" aria-hidden="true" />
          <svg viewBox="0 0 12 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d={sidebarCollapsed ? "M4 4l5 5-5 5" : "M8 4L3 9l5 5"} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>,
        document.body
      )}

      {notifOpen && (
        <V2NotificationsPanel
          alerts={alerts}
          onClose={() => setNotifOpen(false)}
          onAction={handleAlertAction}
          canRunAction={canHandleAlertAction}
        />
      )}

      {selectedChip && (
        <V2HealthDetailModal
          component={selectedChip}
          portfolio={behaviorPortfolio}
          strategy={data.strategy}
          onClose={() => setSelectedChip(null)}
        />
      )}
    </div>
    </div>
  );
}
