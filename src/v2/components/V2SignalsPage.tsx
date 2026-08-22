import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { V2LabData, V2Page } from "../InvestorCabinetV2Lab";
import type { PortfolioHealth } from "../../lib/portfolioHealth";
import { createSignalLimitLevel, deleteSignalLimitLevel } from "../../api/signalLimitLevels";
import { isEmptyAccount } from "../lib/accountState";
import { getMarketPsychology } from "../lib/marketPsychology";
import type { InterestSignal } from "../../types/portfolio";
import {
  getSignalDistance,
  groupByAsset,
  assessSignal,
  plannedLimitOrdersSummary,
  sortByProximity,
  sortBySignalPriority,
  type SignalDistance,
} from "../lib/interestSignals";
import { CryptoLogo } from "../../components/crypto/CryptoLogo";
import {
  buildPortfolioAlerts,
  topAlerts,
  type Alert,
  type AlertLevel,
} from "../lib/portfolioAlerts";
import { buildTradeCandidateFromSignal, type TradeCandidate } from "../lib/tradeCandidate";
import type { InvestorStrategy } from "../lib/investorStrategy";

type Props = {
  portfolio: V2LabData["portfolio"];
  positions: V2LabData["positions"];
  risk: V2LabData["risk"];
  health: PortfolioHealth;
  fearGreedStrategy: V2LabData["fearGreedStrategy"];
  allocation: V2LabData["allocation"];
  interestSignals: InterestSignal[];
  strategy?: InvestorStrategy;
  disciplineCooldownActive?: boolean;
  onOpenTradeCandidate?: (candidate: TradeCandidate) => void;
  onNavigate?: (page: V2Page) => void;
  onRefreshData?: () => void;
};

const LEVEL_LABEL: Record<AlertLevel, string> = {
  critical: "ТРЕВОГА",
  warning: "ВНИМАНИЕ",
  info: "СИГНАЛ",
};

// Точность триггера — часть решения: 0.3068 нельзя показывать как 0,31.
// Разряды подбираем по величине цены, а не фиксируем на двух знаках.
const formatSignalMoney = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const digits = value >= 1000 ? 0 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString("ru-RU", { maximumFractionDigits: digits })}`;
};

const formatSignalTotalMoney = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  return `$${Math.round(value).toLocaleString("ru-RU")}`;
};

const SIGNAL_STATUS_LABEL: Record<string, string> = {
  ARMED: "Ждёт",
  TRIGGERED: "Сработал",
  ERROR: "Сбой",
  CHECK: "Проверить",
};

const formatSignalStatus = (status: string) =>
  SIGNAL_STATUS_LABEL[status.trim().toUpperCase()] ?? (status.trim() || "Активно");

// Расстояние до срабатывания: стрелка вместо знака минус — направление хода
// читается быстрее, чем математический знак.
const formatSignalDistance = (distance: SignalDistance) => {
  const arrow = distance.pct < 0 ? "↓" : "↑";
  const pct = Math.abs(distance.pct).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  return `${arrow} ${pct}%`;
};

// Сигнал в двух шагах от срабатывания требует другого внимания, чем в двадцати.
const NEAR_TRIGGER_PCT = 3;

// В сигналах актив зовётся GOLD, а логотип заведён под позицию GOLD LONG.
const LOGO_ASSET_ALIAS: Record<string, string> = { GOLD: "GOLD LONG" };
const logoAssetFor = (asset: string) => LOGO_ASSET_ALIAS[asset] ?? asset;
const DEFAULT_LIMIT_ASSETS = ["BTC", "ETH", "SOL", "APEX", "ATOM", "BNB", "MNT", "GRAM", "GOLD", "SPCXB", "BTC SHORT"];
const ACKNOWLEDGED_SIGNAL_STORAGE_KEY = "v2-signals-acknowledged";

type LimitLevelDraft = {
  asset: string;
  action: "Купить" | "Продать";
  triggerPrice: string;
  amountUsd: string;
  comment: string;
};

type CreateSignalResponse = {
  success?: boolean;
  id?: string;
  error?: string;
};

const toPositiveNumber = (value: string) => {
  const parsed = Number(value.replace(/\s/g, "").replace(",", ".").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeLimitAsset = (value: string) => value.trim().toUpperCase().replace(/\s+/g, " ");

const readAcknowledgedSignalIds = () => {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(ACKNOWLEDGED_SIGNAL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
};

const writeAcknowledgedSignalIds = (ids: Set<string>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACKNOWLEDGED_SIGNAL_STORAGE_KEY, JSON.stringify([...ids]));
};

const signalIdFromAlert = (alert: Alert) => {
  const prefixes = ["signal-triggered-", "signal-near-", "signal-сломано-", "signal-устарел-"];
  const prefix = prefixes.find((item) => alert.id.startsWith(item));
  return prefix ? alert.id.slice(prefix.length) : null;
};

function LimitLevelModal({
  draft,
  assetOptions,
  saving,
  message,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: LimitLevelDraft;
  assetOptions: string[];
  saving: boolean;
  message: string | null;
  onChange: (patch: Partial<LimitLevelDraft>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const triggerPrice = toPositiveNumber(draft.triggerPrice);
  const amountUsd = toPositiveNumber(draft.amountUsd);
  const canSubmit = Boolean(draft.asset.trim()) && triggerPrice > 0 && amountUsd > 0 && !saving;

  return createPortal(
    <div className="v2-sig-limit-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Выставить лимитный уровень">
      <div className="v2-sig-limit-modal" onClick={(event) => event.stopPropagation()}>
        <button className="v2-sig-limit-close" type="button" onClick={onClose} aria-label="Закрыть">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
          </svg>
        </button>

        <div className="v2-sig-limit-head">
          <span>Лимитный уровень</span>
          <h2>Выставить напоминание</h2>
          <p>Строка попадёт в «Сигналы», Telegram подтвердит постановку и отдельно сообщит при касании цены.</p>
        </div>

        <div className="v2-sig-limit-form">
          <label>
            <span>Монета</span>
            <select value={draft.asset} onChange={(event) => onChange({ asset: event.target.value })}>
              {assetOptions.map((asset) => (
                <option key={asset} value={asset}>{asset}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Действие</span>
            <select value={draft.action} onChange={(event) => onChange({ action: event.target.value === "Продать" ? "Продать" : "Купить" })}>
              <option value="Купить">Купить</option>
              <option value="Продать">Продать</option>
            </select>
          </label>

          <label>
            <span>Цена</span>
            <input
              inputMode="decimal"
              value={draft.triggerPrice}
              onChange={(event) => onChange({ triggerPrice: event.target.value })}
              placeholder="0.147"
            />
          </label>

          <label>
            <span>Сумма, $</span>
            <input
              inputMode="decimal"
              value={draft.amountUsd}
              onChange={(event) => onChange({ amountUsd: event.target.value })}
              placeholder="25"
            />
          </label>

          <label className="v2-sig-limit-comment">
            <span>Комментарий</span>
            <textarea
              rows={3}
              value={draft.comment}
              onChange={(event) => onChange({ comment: event.target.value })}
              placeholder="Что проверить перед действием"
            />
          </label>
        </div>

        <div className="v2-sig-limit-summary">
          <span>Будет создано</span>
          <strong>
            {draft.asset || "Актив"} · {draft.action} {amountUsd ? formatSignalMoney(amountUsd) : "$0"} при{" "}
            {triggerPrice ? formatSignalMoney(triggerPrice) : "$0"}
          </strong>
          <p>Это не сделка и не приказ бирже. Это Telegram-напоминание для ручной проверки риска.</p>
        </div>

        {message && <div className="v2-sig-limit-message">{message}</div>}

        <div className="v2-sig-limit-actions">
          <button type="button" onClick={onClose}>Отмена</button>
          <button type="button" disabled={!canSubmit} onClick={onSubmit}>
            {saving ? "Сохраняю" : "Выставить уровень"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function V2SignalsPage({
  portfolio,
  positions,
  risk,
  health,
  fearGreedStrategy,
  allocation,
  interestSignals,
  strategy,
  disciplineCooldownActive = false,
  onOpenTradeCandidate,
  onNavigate,
  onRefreshData,
}: Props) {
  const [openAsset, setOpenAsset] = useState<string | null>(null);
  const assetOptions = useMemo(() => {
    const assets = new Set<string>(DEFAULT_LIMIT_ASSETS);
    positions.forEach((position) => {
      const asset = normalizeLimitAsset(position.asset);
      if (asset && asset !== "USDT" && asset !== "USDC") assets.add(asset);
    });
    interestSignals.forEach((signal) => {
      const asset = normalizeLimitAsset(signal.asset);
      if (asset) assets.add(asset);
    });
    return [...assets].sort((a, b) => a.localeCompare(b));
  }, [positions, interestSignals]);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitDraft, setLimitDraft] = useState<LimitLevelDraft>(() => ({
    asset: assetOptions[0] ?? "APEX",
    action: "Купить",
    triggerPrice: "",
    amountUsd: "",
    comment: "",
  }));
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [deletingSignalId, setDeletingSignalId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [acknowledgedSignalIds, setAcknowledgedSignalIds] = useState<Set<string>>(() => readAcknowledgedSignalIds());
  const assetGroups = useMemo(() => groupByAsset(interestSignals), [interestSignals]);
  const openGroup = assetGroups.find((group) => group.asset === openAsset) ?? null;
  const nearestSignals = useMemo(() => sortByProximity(interestSignals).slice(0, 3), [interestSignals]);
  const alertSignals = useMemo(
    () => interestSignals.filter((signal) => !acknowledgedSignalIds.has(signal.id)),
    [interestSignals, acknowledgedSignalIds],
  );
  const triggeredSignals = useMemo(
    () =>
      sortBySignalPriority(alertSignals)
        .filter((signal) => assessSignal(signal).priority === "сработал")
        .slice(0, 3),
    [alertSignals],
  );
  const primaryTriggered = triggeredSignals[0] ?? null;
  const limitOrders = useMemo(() => plannedLimitOrdersSummary(interestSignals), [interestSignals]);
  const currentFG = fearGreedStrategy.currentIndex;
  // Поведенческий гид: живой F&G + тренд по истории → эмоция рынка и дисциплина.
  const psychology = getMarketPsychology(currentFG, fearGreedStrategy.history);
  const acknowledgeSignal = (signalId: string) => {
    setAcknowledgedSignalIds((current) => {
      if (current.has(signalId)) return current;
      const next = new Set(current);
      next.add(signalId);
      writeAcknowledgedSignalIds(next);
      return next;
    });
  };
  const openCandidate = (signal: InterestSignal, acknowledge = false) => {
    if (acknowledge) acknowledgeSignal(signal.id);
    const candidate = buildTradeCandidateFromSignal(signal, positions);
    if (candidate) onOpenTradeCandidate?.(candidate);
  };
  const candidateButtonLabel = (signal: InterestSignal) => {
    const candidate = buildTradeCandidateFromSignal(signal, positions);
    if (!candidate) return "Проверить";
    return candidate.action === "sell" ? "Проверить продажу" : "Проверить покупку";
  };
  const signalFromAlert = (alert: Alert) => {
    const id = signalIdFromAlert(alert);
    if (!id) return null;
    return interestSignals.find((signal) => signal.id === id) ?? null;
  };
  const handleAlertAction = (alert: Alert) => {
    if (alert.action === "Открыть проверку риска") {
      const signal = signalFromAlert(alert) ?? primaryTriggered;
      if (signal) {
        openCandidate(signal, true);
      } else {
        onNavigate?.("gate");
      }
      return;
    }

    if (alert.action === "Открыть разбор здоровья") {
      onNavigate?.("health");
      return;
    }

    if (alert.action === "Открыть стратегию") {
      onNavigate?.("signals");
      return;
    }

    if (alert.action === "Пополнить резерв" || alert.action === "Срочно пополнить") {
      onNavigate?.("overview");
      return;
    }

    if (alert.action === "Новый альт — только вместо старого") {
      onNavigate?.("gate");
    }
  };
  const canRunAlertAction = (alert: Alert) =>
    alert.action === "Открыть проверку риска" ||
    alert.action === "Открыть разбор здоровья" ||
    alert.action === "Открыть стратегию" ||
    alert.action === "Пополнить резерв" ||
    alert.action === "Срочно пополнить" ||
    alert.action === "Новый альт — только вместо старого";

  const openLimitModal = () => {
    const fallbackAsset = openAsset ?? primaryTriggered?.asset ?? nearestSignals[0]?.asset ?? assetOptions[0] ?? "APEX";
    setLimitDraft((current) => ({
      ...current,
      asset: normalizeLimitAsset(current.asset || fallbackAsset),
    }));
    setLimitMessage(null);
    setDeleteMessage(null);
    setLimitModalOpen(true);
  };

  const updateLimitDraft = (patch: Partial<LimitLevelDraft>) => {
    setLimitDraft((current) => ({
      ...current,
      ...patch,
      asset: patch.asset ? normalizeLimitAsset(patch.asset) : current.asset,
    }));
    setLimitMessage(null);
  };

  const submitLimitLevel = async () => {
    const asset = normalizeLimitAsset(limitDraft.asset);
    const triggerPrice = toPositiveNumber(limitDraft.triggerPrice);
    const amountUsd = toPositiveNumber(limitDraft.amountUsd);

    if (!asset || !triggerPrice || !amountUsd) {
      setLimitMessage("Заполни монету, цену и сумму больше нуля.");
      return;
    }

    setSavingLimit(true);
    setLimitMessage(null);

    try {
      const response = await createSignalLimitLevel({
        asset,
        action: limitDraft.action,
        triggerPrice,
        amountUsd,
        comment: limitDraft.comment.trim(),
      }) as CreateSignalResponse;

      if (response.success === false) {
        throw new Error(response.error || "уровень не создан");
      }

      setLimitMessage(`Уровень создан: ${response.id ?? asset}. Ждём Telegram-подтверждение после ближайшей проверки.`);
      onRefreshData?.();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "неизвестная ошибка";
      setLimitMessage(`Не удалось создать уровень: ${reason}`);
    } finally {
      setSavingLimit(false);
    }
  };

  const deleteLimitLevel = async (signal: InterestSignal) => {
    if (!signal.id || deletingSignalId) return;
    const confirmed = window.confirm(`Удалить лимитный уровень ${signal.asset} при ${formatSignalMoney(signal.triggerPrice)}?`);
    if (!confirmed) return;

    setDeletingSignalId(signal.id);
    setDeleteMessage(null);
    try {
      const response = await deleteSignalLimitLevel({ signalId: signal.id }) as CreateSignalResponse;
      if (response.success === false) {
        throw new Error(response.error || "уровень не удалён");
      }
      setDeleteMessage(`Уровень удалён: ${signal.asset} при ${formatSignalMoney(signal.triggerPrice)}.`);
      onRefreshData?.();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "неизвестная ошибка";
      setDeleteMessage(`Не удалось удалить уровень: ${reason}`);
    } finally {
      setDeletingSignalId(null);
    }
  };

  const alerts = topAlerts(
    buildPortfolioAlerts({
      portfolio,
      positions,
      allocation,
      currentFG,
      health,
      interestSignals: alertSignals,
      marketPsychology: psychology,
      signalNotification: { disciplineCooldownActive },
      strategy,
    }),
  );
  const criticalCount = alerts.filter((a) => a.level === "critical").length;
  const marketRows = [
    { label: "Здоровье портфеля", value: `${portfolio.healthFactor}/100`, tone: portfolio.healthFactor >= 60 ? "green" : portfolio.healthFactor >= 40 ? "amber" : "red" },
    { label: "Статус", value: portfolio.healthStatus === "CONTROL" ? "Контроль" : portfolio.healthStatus === "BALANCED" ? "Баланс" : "Риск", tone: portfolio.healthStatus === "CONTROL" ? "green" : portfolio.healthStatus === "BALANCED" ? "amber" : "red" },
    { label: "Концентрация крипто", value: risk.concentration === "HIGH" ? "Высокая" : risk.concentration === "MEDIUM" ? "Средняя" : "Низкая", tone: risk.concentration === "HIGH" ? "red" : risk.concentration === "MEDIUM" ? "amber" : "green" },
    ...(strategy?.futuresAllowed === false
      ? []
      : [{ label: "Давление фьючерсов", value: risk.futuresPressure === "HIGH" ? "Высокое" : risk.futuresPressure === "MEDIUM" ? "Среднее" : "Низкое", tone: risk.futuresPressure === "HIGH" ? "red" : risk.futuresPressure === "MEDIUM" ? "amber" : "green" }]),
  ];

  return (
    <div className="v2-signals-page">

      {/* ── Шапка ─────────────────────────────────────────── */}
      <div className="v2-sig-header">
        <div className="v2-sig-header-title">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M9 2a4 4 0 00-4 4c0 4-1.6 5-1.6 5h11.2S13 10 13 6a4 4 0 00-4-4z" />
            <path d="M7.4 14a1.6 1.6 0 003.2 0" strokeLinecap="round" />
          </svg>
          Сигналы портфеля
          {criticalCount > 0 && (
            <span className="v2-sig-badge badge-critical">{criticalCount} ТРЕВОГ</span>
          )}
        </div>
      </div>

      {/* ── Тревоги ───────────────────────────────────────── */}
      <div className="v2-alerts-row">
        {isEmptyAccount(portfolio) ? (
          <div className="v2-alert-card level-info">
            <div className="v2-alert-level">НЕТ ДАННЫХ</div>
            <div className="v2-alert-title">Кошельки не подключены</div>
            <div className="v2-alert-detail">Подключите источники данных — сигналы появятся автоматически</div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="v2-alert-card level-ok">
            <div className="v2-alert-level">ВСЁ В НОРМЕ</div>
            <div className="v2-alert-title">Нет активных тревог</div>
            <div className="v2-alert-detail">Портфель в допустимых параметрах</div>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`v2-alert-card level-${alert.level}`}>
              <div className="v2-alert-level">{LEVEL_LABEL[alert.level]}</div>
              <div className="v2-alert-title">{alert.title}</div>
              <div className="v2-alert-detail">{alert.detail}</div>
              {alert.action && (
                canRunAlertAction(alert) ? (
                  <button
                    type="button"
                    className="v2-alert-action"
                    onClick={() => handleAlertAction(alert)}
                  >
                    → {alert.action}
                  </button>
                ) : (
                  <span className="v2-alert-action is-static">{alert.action}</span>
                )
              )}
            </div>
          ))
        )}
      </div>

      {primaryTriggered ? (
        <div className="v2-sig-trigger-focus">
          <div className="v2-sig-trigger-mark">Сработала точка</div>
          <div className="v2-sig-trigger-main">
            <strong>{primaryTriggered.asset}</strong>
            <span>
              {primaryTriggered.action} {formatSignalMoney(primaryTriggered.amountUsd)} при{" "}
              {formatSignalMoney(primaryTriggered.triggerPrice)}
            </span>
          </div>
          <div className="v2-sig-trigger-detail">
            Цена коснулась уровня. Сначала изучить график, затем открыть проверку риска.
          </div>
          <div className="v2-sig-trigger-actions">
            <button
              type="button"
              className="v2-sig-trigger-ack"
              onClick={() => acknowledgeSignal(primaryTriggered.id)}
            >
              ✓ Принято
            </button>
            <button
              type="button"
              disabled={!buildTradeCandidateFromSignal(primaryTriggered, positions)}
              onClick={() => openCandidate(primaryTriggered, true)}
            >
              Открыть проверку риска
            </button>
          </div>
        </div>
      ) : (
        <div className="v2-sig-trigger-placeholder" aria-hidden="true" />
      )}

      {/* ── Основная сетка ────────────────────────────────── */}
      <div className="v2-sig-main-grid">

        {/* Лимитные ордера */}
        <div className="v2-panel v2-sig-interest">
          <div className="v2-sig-panel-label">
            <span className="v2-sig-dot dot-info" />
            Лимитные ордера
            {interestSignals.length ? (
              <span className="v2-sig-int-bot-badge">
                {formatSignalTotalMoney(limitOrders.totalUsd)} · {limitOrders.count} покупок
              </span>
            ) : (
              <span className="v2-sig-int-bot-badge">НЕТ ДАННЫХ</span>
            )}
            <button className="v2-sig-add-level" type="button" onClick={openLimitModal}>
              + Выставить уровень
            </button>
          </div>
          <div className="v2-sig-limit-help">
            Эта сумма — резерв под активные покупки. Сайт/TG только напоминают: лимитку нужно выставить на бирже вручную. Продажи, сработавшие и отключённые уровни покупательскую способность не занимают.
          </div>
          {assetGroups.length ? (
            <>
              <div className="v2-sig-coin-grid">
                {assetGroups.map((group) => {
                  const isOpen = group.asset === openAsset;
                  const isNear =
                    !!group.nearest && Math.abs(group.nearest.pct) <= NEAR_TRIGGER_PCT;

                  return (
                    <button
                      key={group.asset}
                      type="button"
                      className={[
                        "v2-sig-coin",
                        isOpen ? "is-open" : "",
                        group.hasTriggered ? "is-triggered" : "",
                        group.needsAttention ? "is-alert" : "",
                        isNear ? "is-near" : "",
                      ].filter(Boolean).join(" ")}
                      aria-expanded={isOpen}
                      onClick={() => setOpenAsset((prev) => (prev === group.asset ? null : group.asset))}
                    >
                      <CryptoLogo asset={logoAssetFor(group.asset)} className="v2-sig-coin-logo" />
                      <span className="v2-sig-coin-ticker">{group.asset}</span>
                      <span className="v2-sig-coin-meta">
                        {group.hasTriggered
                          ? "сработал"
                          : group.needsAttention
                          ? "проверить"
                          : group.nearest
                            ? formatSignalDistance(group.nearest)
                            : `${group.waitingCount} орд.`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="v2-sig-int-list">
                {openGroup ? (
                  openGroup.signals.map((signal) => {
                    const distance = getSignalDistance(signal);
                    const assessment = assessSignal(signal);
                    const isDone = signal.status.trim().toUpperCase() === "TRIGGERED";
                    const isNear = !isDone && !!distance && Math.abs(distance.pct) <= NEAR_TRIGGER_PCT;

                    return (
                      <div className={`v2-sig-int-row${isDone ? " is-triggered" : ""}`} key={signal.id}>
                        <span className="v2-sig-int-range">
                          {signal.action} {formatSignalMoney(signal.amountUsd)} при {formatSignalMoney(signal.triggerPrice)}
                        </span>
                        <span className="v2-sig-int-label">
                          {distance && !isDone ? (
                            <span className={`v2-sig-int-dist${isNear ? " is-near" : ""}`}>
                              {formatSignalDistance(distance)}
                              <span className="v2-sig-int-dist-abs">
                                {formatSignalMoney(Math.abs(distance.abs))}
                              </span>
                            </span>
                          ) : null}
                          <span className="v2-sig-int-sub">
                            {formatSignalStatus(signal.status)} · {formatSignalMoney(signal.currentPrice)}
                          </span>
                          <span className="v2-sig-int-sub">
                            {assessment.text}
                          </span>
                        </span>
                        <span className="v2-sig-int-actions">
                          <button
                            type="button"
                            className={`v2-sig-int-action${isDone ? " is-triggered" : ""}`}
                            disabled={!buildTradeCandidateFromSignal(signal, positions)}
                            onClick={() => openCandidate(signal)}
                          >
                            {candidateButtonLabel(signal)}
                          </button>
                          <button
                            type="button"
                            className="v2-sig-int-action v2-sig-int-delete"
                            disabled={deletingSignalId === signal.id}
                            onClick={() => deleteLimitLevel(signal)}
                          >
                            {deletingSignalId === signal.id ? "Удаляю" : "Удалить"}
                          </button>
                        </span>
                      </div>
                    );
                  })
                ) : (
                  // Пока монета не выбрана, панель всё равно отвечает на главный
                  // вопрос: за чем следить сегодня.
                  <div className="v2-sig-int-hint">
                    {nearestSignals.length ? (
                      <>
                        <span className="v2-sig-int-hint-label">Ближайшие ордера</span>
                        <div className="v2-sig-nearest-list">
                          {nearestSignals.map((signal) => {
                            const distance = getSignalDistance(signal);
                            return (
                              <div className="v2-sig-nearest-row" key={signal.id}>
                                <span className="v2-sig-int-hint-main">
                                  {signal.asset} · {signal.action}{" "}
                                  {formatSignalMoney(signal.amountUsd)} при{" "}
                                  {formatSignalMoney(signal.triggerPrice)}
                                </span>
                                {distance ? (
                                  <span className="v2-sig-int-dist is-near">
                                    {formatSignalDistance(distance)}
                                    <span className="v2-sig-int-dist-abs">
                                      {formatSignalMoney(Math.abs(distance.abs))}
                                    </span>
                                  </span>
                                ) : null}
                                <span className="v2-sig-int-actions">
                                  <button
                                    type="button"
                                    className="v2-sig-int-action"
                                    disabled={!buildTradeCandidateFromSignal(signal, positions)}
                                    onClick={() => openCandidate(signal)}
                                  >
                                    {candidateButtonLabel(signal)}
                                  </button>
                                  <button
                                    type="button"
                                    className="v2-sig-int-action v2-sig-int-delete"
                                    disabled={deletingSignalId === signal.id}
                                    onClick={() => deleteLimitLevel(signal)}
                                  >
                                    {deletingSignalId === signal.id ? "Удаляю" : "Удалить"}
                                  </button>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <span className="v2-sig-int-hint-label">Нет активных ордеров</span>
                    )}
                    <span className="v2-sig-int-hint-note">Нажми актив — покажу его лимитные ордера</span>
                  </div>
                )}
              </div>
              {deleteMessage ? (
                <div className="v2-sig-delete-message">{deleteMessage}</div>
              ) : null}
            </>
          ) : (
            <div className="v2-sig-int-list">
              <div className="v2-sig-int-row">
                <span className="v2-sig-int-range">Лимитные ордера отключены</span>
                <span className="v2-sig-int-label">Нет данных</span>
              </div>
            </div>
          )}
        </div>

        {/* Рынок */}
        <div className="v2-panel v2-sig-market">
          <div className="v2-sig-panel-label">
            <span className="v2-sig-dot dot-info" />
            Рынок
          </div>

          <div className="v2-fg-signal-row">
            <div className="v2-fg-signal-value" style={{ color: psychology.color }}>
              {currentFG}<span className="v2-fg-signal-total">/100</span>
            </div>
            <div className="v2-fg-signal-info">
              <span className="v2-fg-signal-zone" style={{ color: psychology.color }}>{psychology.emotion}</span>
              <span className="v2-fg-signal-label">Индекс страха / жадности</span>
            </div>
          </div>

          <div className="v2-fg-bar-track">
            <div className="v2-fg-bar-fill" style={{ width: `${currentFG}%`, background: `linear-gradient(90deg, ${psychology.color}, ${psychology.color}88)` }} />
            <div className="v2-fg-bar-needle" style={{ left: `${currentFG}%` }} />
          </div>
          <div className="v2-fg-bar-labels">
            <span>Страх</span><span>Нейтрально</span><span>Жадность</span>
          </div>

          {/* ── Психология рынка: не прогноз, а поведенческий гид ── */}
          <div className="v2-psy-block">
            <div className="v2-psy-head">
              <span className="v2-psy-emotion" style={{ color: psychology.color }}>
                {psychology.emotion}
                {psychology.trend !== "flat" && (
                  <span className="v2-psy-trend" aria-label={psychology.trend === "rising" ? "индекс растёт" : "индекс падает"}>
                    {psychology.trend === "rising" ? "↗" : "↘"}
                  </span>
                )}
              </span>
              <span className="v2-psy-stance" style={{ borderColor: `${psychology.color}55`, color: psychology.color }}>
                {psychology.stanceLabel}
              </span>
            </div>
            <div className="v2-psy-rows">
              <div className="v2-psy-row">
                <span className="v2-psy-row-k">Рынок чувствует</span>
                <span className="v2-psy-row-v">{psychology.feels}</span>
              </div>
              <div className="v2-psy-row">
                <span className="v2-psy-row-k">Правило дисциплины</span>
                <span className="v2-psy-row-v">{psychology.disciplined}</span>
              </div>
              <div className="v2-psy-row is-danger">
                <span className="v2-psy-row-k">Опасно сейчас</span>
                <span className="v2-psy-row-v">{psychology.dangerous}</span>
              </div>
              <div className={psychology.gate.severity === "block" ? "v2-psy-row is-danger" : "v2-psy-row"}>
                <span className="v2-psy-row-k">Проверка сделки</span>
                <span className="v2-psy-row-v">{psychology.gate.text}</span>
              </div>
            </div>
          </div>

          <div className="v2-sig-divider" />

          <div className="v2-sig-market-rows">
            {marketRows.map((row) => (
              <div key={row.label} className="v2-sig-market-row">
                <span className="v2-sig-row-label">{row.label}</span>
                <span className={`v2-sig-row-val val-${row.tone}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Факторы здоровья ──────────────────────────────── */}
      <div className="v2-sig-health-strip">
        {health.components.map((comp) => {
          const tone = comp.score >= 60 ? "green" : comp.score >= 35 ? "amber" : "red";
          return (
            <div key={comp.key} className={`v2-sig-hbar tone-${tone}`}>
              <div className="v2-sig-hbar-top">
                <span className="v2-sig-hbar-label">{comp.label}</span>
                <span className="v2-sig-hbar-score">{comp.score}</span>
              </div>
              <div className="v2-sig-hbar-track">
                <div className="v2-sig-hbar-fill" style={{ width: `${comp.score}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {limitModalOpen && (
        <LimitLevelModal
          draft={limitDraft}
          assetOptions={assetOptions}
          saving={savingLimit}
          message={limitMessage}
          onChange={updateLimitDraft}
          onClose={() => setLimitModalOpen(false)}
          onSubmit={() => void submitLimitLevel()}
        />
      )}

    </div>
  );
}
