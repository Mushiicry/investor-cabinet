import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { V2LabData, V2Page } from "../InvestorCabinetV2Lab";
import type { HealthComponent } from "../../lib/portfolioHealth";
import { V2HealthDetailModal } from "./V2HealthDetailModal";
import { V2ReportsPage } from "./V2ReportsPage";
import { V2SignalsPage } from "./V2SignalsPage";
import { V2GatePage } from "./V2GatePage";
import { V2RiskEnginePage } from "./V2RiskEnginePage";
import { V2ScenariosPage } from "./V2ScenariosPage";
import { V2DeployableCapital } from "./V2DeployableCapital";
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
import { V2NotificationsPanel } from "./V2NotificationsPanel";
import { buildPortfolioAlerts, sortAlerts } from "../lib/portfolioAlerts";
import { V2Sidebar } from "./V2Sidebar";
import { V2TopMetrics } from "./V2TopMetrics";
import { V2StarField } from "./V2StarField";
import { useAuth } from "../../hooks/useAuth";

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
    return { scale: 1, logicalHeight: window.innerHeight };
  }

  const scale = Math.min(
    window.innerWidth / DESKTOP_DESIGN_WIDTH,
    window.innerHeight / DESKTOP_DESIGN_HEIGHT,
  );

  return {
    scale,
    logicalHeight: window.innerHeight / scale,
  };
}

function DataStatusBadge({ dataStatus }: { dataStatus: NonNullable<Props["dataStatus"]> }) {
  const { source, status, lastLoadedAt, error } = dataStatus;
  let tone = "is-live";
  let label = "LIVE";
  if (error && source === "fallback") { tone = "is-error"; label = "ERROR"; }
  else if (status === "stale" || (error && source !== "fallback")) { tone = "is-stale"; label = "STALE"; }
  else if (source === "cache") { tone = "is-cache"; label = "CACHE"; }
  else if (source === "fallback") { tone = "is-cache"; label = "DEMO"; }

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

  // При смене аккаунта подгружаем его профиль (или пустой у нового пользователя).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синк профиля из localStorage при смене аккаунта
    setProfileName(localStorage.getItem(nameKey)   ?? "");
    setProfileAvatar(localStorage.getItem(avatarKey) ?? "");
  }, [nameKey, avatarKey]);
  const [selectedChip, setSelectedChip] = useState<HealthComponent | null>(null);
  const [capitalOpen, setCapitalOpen] = useState(false);
  const [desktopViewport, setDesktopViewport] = useState(getDesktopViewport);

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

  // Health Factor с прошлого захода — чтобы поймать его просадку.
  // Читаем один раз при монтировании, перезаписываем уже после сравнения.
  const healthKey = `mushii-last-health${profileKeySuffix}`;
  const [previousHealthFactor] = useState<number | null>(() => {
    const raw = localStorage.getItem(healthKey);
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  });

  useEffect(() => {
    const hf = data.health?.healthFactor;
    if (typeof hf === "number" && Number.isFinite(hf)) {
      localStorage.setItem(healthKey, String(hf));
    }
  }, [healthKey, data.health?.healthFactor]);

  // Тревоги считаются тем же движком, что и на странице «Сигналы»,
  // иначе счётчик на колокольчике расходился бы со списком.
  const alerts = useMemo(
    () =>
      sortAlerts(
        buildPortfolioAlerts({
          portfolio: data.portfolio,
          positions: data.positions,
          allocation: data.allocation,
          currentFG: data.fearGreedStrategy.currentIndex,
          health: data.health,
          interestSignals: data.signals?.interestList ?? [],
          previousHealthFactor,
        })
      ),
    [data.portfolio, data.positions, data.allocation, data.fearGreedStrategy.currentIndex, data.health, data.signals, previousHealthFactor]
  );

  const criticalCount = alerts.filter((alert) => alert.level === "critical").length;

  // Центр зазора между сайдбаром и контентом в координатах ЭКРАНА.
  // Сцена шириной 1920 масштабируется и центрируется, поэтому к отступу
  // сцены добавляем масштабированную ширину колонки и половину зазора.
  const isMobile = desktopViewport.scale === 1 && window.innerWidth <= MOBILE_BREAKPOINT;
  const sceneOffset = Math.max(0, (window.innerWidth - DESKTOP_DESIGN_WIDTH * desktopViewport.scale) / 2);
  const railLeft = sceneOffset +
    (SCENE_PADDING + (sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH) + SCENE_GAP / 2) * desktopViewport.scale;

  return (
    <div
      className={sidebarCollapsed ? "v2-lab is-sidebar-collapsed" : "v2-lab"}
      style={{
        "--v2-desktop-scale": desktopViewport.scale,
        "--v2-logical-height": `${desktopViewport.logicalHeight}px`,
      } as CSSProperties}
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

      {/* Фото-фон космоса (nebula — в body CSS) */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: -2,
        backgroundImage: 'url("/bg-space.png")',
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#00030a",
      }} aria-hidden="true" />
      {/* Живые звёзды и вспышки поверх фото */}
      <V2StarField />
      {/* Бэкдроп мобильной шторки */}
      {menuOpen && <div className="v2-mob-drawer-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <V2Sidebar
        mobileOpen={menuOpen}
        onCloseMobile={() => setMenuOpen(false)}
        activePage={page}
        onNavigate={handleNavigate}
        healthFactor={data.portfolio.healthFactor}
        healthStatus={data.portfolio.healthStatus}
        portfolio={data.portfolio}
        health={data.health}
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
            portfolio={data.portfolio}
            positions={data.positions}
            risk={data.risk}
            health={data.health}
            fearGreedStrategy={data.fearGreedStrategy}
            allocation={data.allocation}
            interestSignals={data.signals?.interestList?.length
              ? data.signals.interestList
              : data.signals?.interest
                ? [data.signals.interest]
                : []}
          />
        ) : page === "gate" ? (
          <V2GatePage
            portfolio={data.portfolio}
            positions={data.positions}
            allocation={data.allocation}
            fearGreedStrategy={data.fearGreedStrategy}
            futuresShare={data.risk.futuresShare}
          />
        ) : page === "reports" ? (
          <V2ReportsPage history={data.history} transactions={data.transactions} positions={data.positions} realizedPnlUsd={data.portfolio.realizedPnlUsd} />
        ) : page === "portfolio" ? (
          <V2PortfolioPage
            positions={data.positions}
            playbook={data.playbook}
            staking={staking}
            cosmosStaking={cosmosStaking}
            realizedPnlUsd={data.portfolio.realizedPnlUsd}
            realizedPnlPct={data.portfolio.realizedPnlPct}
          />
        ) : page === "scenarios" ? (
          <V2ScenariosPage playbook={data.playbook} positions={data.positions} />
        ) : page === "health" ? (
          <V2HealthPage
            portfolio={data.portfolio}
            health={data.health}
            healthInput={data.healthInput}
          />
        ) : page === "risk" ? (
          <V2RiskEnginePage
            portfolio={data.portfolio}
            health={data.health}
            risk={data.risk}
            allocation={data.allocation}
          />
        ) : (
        <section className="v2-command-grid" aria-label="Investor Cabinet V2 overview">
          <V2TopMetrics
            portfolio={data.portfolio}
            history={data.history}
            capitalOpen={capitalOpen}
            onToggleCapital={() => setCapitalOpen((v) => !v)}
          />
          <div className={`v2-capital-dropdown ${capitalOpen ? "is-open" : ""}`}>
            <div className="v2-capital-dropdown-inner">
              <V2DeployableCapital
                portfolio={data.portfolio}
                allocation={data.allocation}
                strategy={data.fearGreedStrategy}
                futuresShare={data.risk.futuresShare}
              />
            </div>
          </div>

          {/* Блок здоровья — на всю ширину */}
          <div className="v2-hero-reactor">
            <V2HealthCore portfolio={data.portfolio} health={data.health} onChipSelect={setSelectedChip} onNavigate={onNavigate} />
          </div>

          {/* Под радаром: распределение + DCA рядом */}
          <div className="v2-alloc-center-row">
            <div className="v2-alloc-center-inner">
              <span aria-hidden="true" className="v2-hud-corners" />
              <V2PortfolioAllocationCard allocation={data.allocation} total={data.portfolio.totalPortfolioValue} positions={data.positions} futuresShare={data.risk.futuresShare} />
            </div>
            <div className="v2-alloc-dca-slot">
              <V2DCAStrategy
                portfolio={data.portfolio}
                strategy={data.fearGreedStrategy}
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
        <V2NotificationsPanel alerts={alerts} onClose={() => setNotifOpen(false)} />
      )}

      {selectedChip && (
        <V2HealthDetailModal
          component={selectedChip}
          portfolio={data.portfolio}
          onClose={() => setSelectedChip(null)}
        />
      )}
    </div>
  );
}
