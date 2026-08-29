import { useMemo, useState } from "react";
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import { getMarketPhase } from "../../config/marketPhases";
import type { V2LabData } from "../InvestorCabinetV2Lab";
import { isEmptyAccount } from "../lib/accountState";
import {
  CASH_CATEGORY,
  CRYPTO_CATEGORY,
  METALS_CATEGORY,
  STOCKS_CATEGORY,
  FUTURES_CATEGORY,
  SPOT_RESERVE_FLOOR_SHARE,
  type GateCheck,
} from "../lib/preTradeGate";
import { evaluateDecision, type DecisionContext } from "../lib/decisionEngine";
import { buildCapitalBuckets, buildFuturesLimitSnapshot, type CapitalBuckets } from "../lib/capitalBuckets";
import { BINANCE_MONITORING_ASSET_QUALITY } from "../lib/assetQualitySource";
import type { DecisionJournalDraft } from "../lib/decisionJournal";
import { getMarketPsychology } from "../lib/marketPsychology";
import type { TradeCandidate } from "../lib/tradeCandidate";
import type { InvestorStrategy } from "../lib/investorStrategy";
import type { InvestorProfile } from "../lib/investorProfile";

type Props = {
  portfolio: V2LabData["portfolio"];
  positions: V2LabData["positions"];
  allocation: V2LabData["allocation"];
  fearGreedStrategy: V2LabData["fearGreedStrategy"];
  assetQuality: V2LabData["assetQuality"];
  healthInput: V2LabData["healthInput"];
  strategy?: InvestorStrategy;
  profile?: InvestorProfile;
  futuresShare?: number;
  onSaveDecision?: (draft: DecisionJournalDraft) => void;
  candidate?: TradeCandidate | null;
  onClearCandidate?: () => void;
  disciplineBlockers?: string[];
  disciplineWarnings?: string[];
};

const NEW_ASSET = "__new__";
const CATEGORIES = [CRYPTO_CATEGORY, METALS_CATEGORY, STOCKS_CATEGORY, FUTURES_CATEGORY];
const SIGNAL_LIMIT_SETUP = "Сигнал / ручной лимит";
const SETUPS = ["Плановый добор", SIGNAL_LIMIT_SETUP, "Лимитный ордер", "ДСА добор", "Ребаланс", "Защитное действие", "Учебная сделка"];
const EMOTIONS = ["Спокойно", "Сомнение", "Страх упустить рост", "Спешка", "После убытка"];

const pct = (share: number) => `${(share * 100).toFixed(1)}%`;
const usd = (v: number) => `${Math.round(v).toLocaleString("ru-RU")}$`;
const signedScore = (v: number) => (v > 0 ? `+${v}` : String(v));
const price = (v: number | null | undefined) =>
  v && Number.isFinite(v)
    ? `$${v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 2 : 6 })}`
    : "—";

function candidateStatusLabel(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "ARMED") return "ожидает цены";
  if (normalized === "CHECK") return "требует проверки";
  if (normalized === "TRIGGERED") return "сработал";
  if (normalized === "DISABLED") return "выключен";
  return "по плану";
}

/** Строка проверки в человекочитаемом виде «до → после · лимит». */
function checkValues(c: GateCheck) {
  if (c.isShare) {
    return { before: pct(c.before), after: pct(c.after), limit: pct(c.limit) };
  }
  return { before: usd(c.before), after: usd(c.after), limit: usd(c.limit) };
}

function bucketRows(buckets: CapitalBuckets, strategy?: InvestorStrategy) {
  return [
    { label: "Резерв", value: buckets.lockedReserveUsd },
    { label: "Фьючерсы", value: buckets.futuresBudgetUsd },
    { label: "ДСА добор", value: buckets.averagingBudgetUsd },
    { label: "Спот", value: buckets.spotBudgetUsd },
    { label: "Металлы до", value: buckets.metalsBudgetUsd },
    { label: "Акции до", value: buckets.stocksBudgetUsd },
  ].filter((row) => strategy?.futuresAllowed !== false || row.label !== "Фьючерсы" || row.value > 0);
}

export function V2GatePage({
  portfolio,
  positions,
  allocation,
  fearGreedStrategy,
  assetQuality,
  healthInput,
  strategy,
  profile,
  futuresShare = 0,
  onSaveDecision,
  candidate,
  onClearCandidate,
  disciplineBlockers = [],
  disciplineWarnings = [],
}: Props) {
  const empty = isEmptyAccount(portfolio);
  const candidatePosition = candidate
    ? positions.find((p) => p.asset.trim().toUpperCase() === candidate.asset)
    : null;

  const [asset, setAsset] = useState<string>(() =>
    candidate ? (candidatePosition?.asset ?? NEW_ASSET) : positions[0]?.asset ?? NEW_ASSET,
  );
  const [newAsset, setNewAsset] = useState(() => (candidate && !candidatePosition ? candidate.asset : ""));
  const [category, setCategory] = useState<string>(() => candidate?.category ?? CRYPTO_CATEGORY);
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">(() => candidate?.action === "sell" ? "sell" : "buy");
  const [amount, setAmount] = useState<string>(() => candidate ? String(candidate.amountUsd) : "");
  const [buyPrice, setBuyPrice] = useState<string>(() =>
    candidate?.price && candidate.price > 0
      ? String(candidate.price)
      : positions[0]?.currentPrice && positions[0].currentPrice > 0
        ? String(positions[0].currentPrice)
        : "",
  );
  const [setup, setSetup] = useState(candidate ? SIGNAL_LIMIT_SETUP : SETUPS[0]);
  const [emotion, setEmotion] = useState(EMOTIONS[0]);
  const [journalNote, setJournalNote] = useState(candidate ? `${candidate.label}. Источник: лимитный уровень в кабинете, не биржевой ордер.` : "");
  const [invalidation, setInvalidation] = useState("");
  const [exitPlan, setExitPlan] = useState("");
  const [orderPlan, setOrderPlan] = useState(() => candidate
    ? `${candidate.asset}: вручную выставить на Hyperliquid лимит ${price(candidate.price)}, сумма ${usd(candidate.amountUsd)}`
    : "");
  const [priceAndAmountChecked, setPriceAndAmountChecked] = useState(false);
  const [alertIsNotOrderConfirmed, setAlertIsNotOrderConfirmed] = useState(false);
  const [planNotFomoConfirmed, setPlanNotFomoConfirmed] = useState(false);
  const [savedMarker, setSavedMarker] = useState<{ signature: string; savedAt: string } | null>(null);
  const [executionMarker, setExecutionMarker] = useState<{ signature: string; openedAt: string } | null>(null);

  const isNew = asset === NEW_ASSET;
  const resolvedAsset = isNew ? newAsset.trim().toUpperCase() : asset;
  const selectedPosition = positions.find((p) => p.asset === resolvedAsset);
  const clearToManualInput = () => {
    setAsset(NEW_ASSET);
    setNewAsset("");
    setCategory(CRYPTO_CATEGORY);
    setTradeAction("buy");
    setAmount("");
    setBuyPrice("");
    setSetup(SETUPS[0]);
    setEmotion(EMOTIONS[0]);
    setJournalNote("");
    setInvalidation("");
    setExitPlan("");
    setOrderPlan("");
    setPriceAndAmountChecked(false);
    setAlertIsNotOrderConfirmed(false);
    setPlanNotFomoConfirmed(false);
    setSavedMarker(null);
    setExecutionMarker(null);
    onClearCandidate?.();
  };
  const handleAssetChange = (nextAsset: string) => {
    setAsset(nextAsset);
    if (nextAsset === NEW_ASSET) {
      setBuyPrice("");
      return;
    }
    const nextPosition = positions.find((p) => p.asset === nextAsset);
    setBuyPrice(nextPosition?.currentPrice && nextPosition.currentPrice > 0 ? String(nextPosition.currentPrice) : "");
  };

  const phase = useMemo(() => getMarketPhase(new Date()), []);
  const usesAccountStrategyLimits = strategy?.id === "wife";
  const effectiveReserveFloorShare = usesAccountStrategyLimits
    ? strategy.reserveFloorShare
    : phase.reserveFloorShare;
  const effectiveCryptoMaxShare = usesAccountStrategyLimits
    ? strategy.cryptoMaxShare
    : phase.cryptoMaxShare;
  const effectiveSpotReserveFloorShare = usesAccountStrategyLimits
    ? strategy.spotReserveFloorShare
    : SPOT_RESERVE_FLOOR_SHARE;

  const capitalBuckets = useMemo(
    () => {
      const futuresLimit = buildFuturesLimitSnapshot({
        positions,
        futuresDeployableUsd: portfolio.futuresDeployable,
        investedCapital: portfolio.totalInvested,
        investorStrategy: strategy,
      });

      return buildCapitalBuckets({
        totalPortfolioValue: portfolio.totalPortfolioValue,
        investedCapital: portfolio.totalInvested,
        stableReserve: portfolio.stableReserve,
        allocation: allocation.map((a) => ({ name: a.name, value: a.value })),
        strategyRules: fearGreedStrategy.rules,
        futuresDeployableUsd: portfolio.futuresDeployable,
        futuresUsedUsd: futuresLimit.usedUsd,
        investorStrategy: strategy,
      });
    },
    [portfolio.totalPortfolioValue, portfolio.totalInvested, portfolio.stableReserve, portfolio.futuresDeployable, positions, allocation, fearGreedStrategy.rules, strategy],
  );

  const activeAssetQuality = assetQuality?.connected ? assetQuality : BINANCE_MONITORING_ASSET_QUALITY;
  const gateSpotDeployable = usesAccountStrategyLimits
    ? capitalBuckets.workCashUsd
    : portfolio.spotDeployable || 0;

  const ctx: DecisionContext = useMemo(() => {
    const fearGreedPlan = buildFearGreedStrategy(
      fearGreedStrategy.currentIndex,
      portfolio.totalPortfolioValue || 0,
      fearGreedStrategy.rules ?? [],
    );
    const marketPsychology = getMarketPsychology(
      fearGreedStrategy.currentIndex,
      fearGreedStrategy.history,
    );
    return {
      totalPortfolioValue: portfolio.totalPortfolioValue,
      investedCapital: portfolio.totalInvested,
      stableReserve: portfolio.stableReserve,
      spotDeployable: gateSpotDeployable,
      reserveFloorShare: effectiveReserveFloorShare,
      cryptoMaxShare: effectiveCryptoMaxShare,
      investorStrategy: strategy,
      investorProfile: profile,
      futuresShare,
      futuresFreeMarginUsd: portfolio.futuresDeployable,
      capitalBuckets,
      marketPsychology,
      assetQuality: activeAssetQuality,
      healthInput,
      disciplineBlockers,
      disciplineWarnings,
      positions: positions.map((p) => ({
        asset: p.asset,
        category: p.category,
        value: p.value,
        avgEntry: p.avgEntry,
        currentPrice: p.currentPrice,
        invested: p.invested,
      })),
      allocation: allocation.map((a) => ({ name: a.name, value: a.value })),
      fearGreedRules: fearGreedPlan.rules.map((r) => ({
        mode: r.mode,
        label: r.label,
        buyAmount: r.buyAmount,
        isCurrent: r.isCurrent,
        isAvailable: r.isAvailable,
        cooldownRemainingHours: r.cooldownRemainingHours,
      })),
    };
  }, [
    portfolio,
    positions,
    allocation,
    fearGreedStrategy,
    strategy,
    profile,
    gateSpotDeployable,
    effectiveReserveFloorShare,
    effectiveCryptoMaxShare,
    futuresShare,
    capitalBuckets,
    activeAssetQuality,
    healthInput,
    disciplineBlockers,
    disciplineWarnings,
  ]);

  const amountNum = Number(amount);
  const buyPriceNum = Number(buyPrice);
  const isShortIncrease =
    tradeAction === "sell" &&
    selectedPosition?.category === FUTURES_CATEGORY &&
    /\bSHORT\b/i.test(selectedPosition.asset);

  const decision = useMemo(
    () =>
      evaluateDecision(
        { asset: resolvedAsset || "—", amountUsd: amountNum, category, buyPrice: buyPriceNum, action: tradeAction },
        ctx,
      ),
    [resolvedAsset, amountNum, category, buyPriceNum, tradeAction, ctx],
  );
  const verdict = decision.gate;
  const decisionSignature = [
    resolvedAsset,
    category,
    tradeAction,
    amount,
    buyPrice,
    setup,
    emotion,
    journalNote,
    invalidation,
    exitPlan,
    orderPlan,
    priceAndAmountChecked,
    alertIsNotOrderConfirmed,
    planNotFomoConfirmed,
    decision.status,
    candidate?.id ?? "",
  ].join("|");
  const journalSaved = savedMarker?.signature === decisionSignature;
  const executionOpened = executionMarker?.signature === decisionSignature;
  const isBlocked = decision.status === "БЛОКИРОВКА" || decision.status === "ЖДАТЬ";
  const finalActionText = isShortIncrease
    ? "Зафиксировать допуск к ручному добору шорта"
    : tradeAction === "sell"
      ? "Зафиксировать допуск к ручной продаже"
      : "Зафиксировать допуск к ручной покупке";

  // Капитал под спот: зелёный лимит и потолок до пола стратегии/фазы.
  const greenMax = Math.max(gateSpotDeployable, 0);
  const hardMax = Math.max(
    greenMax,
    Math.max(portfolio.stableReserve - effectiveReserveFloorShare * (portfolio.totalInvested || portfolio.totalPortfolioValue), 0),
  );
  const cushionRoom = Math.max(hardMax - greenMax, 0);

  if (empty) {
    return (
      <div className="v2-gate-page">
        <div className="v2-gate-header">
          <span className="v2-gate-title">Проверка сделки</span>
        </div>
        <div className="v2-gate-empty">
          Подключите кошельки — шлюз проверяет добор на реальных данных портфеля.
        </div>
      </div>
    );
  }

  const statusClass =
    decision.status === "РАЗРЕШЕНО"
      ? "is-ok"
      : decision.status === "ОСТОРОЖНО" || decision.status === "РАЗРЕШЕНО_С_ЛИМИТОМ"
        ? "is-caution"
        : decision.status === "БЛОКИРОВКА" || decision.status === "СНИЗИТЬ_РИСК"
          ? "is-block"
          : "is-idle";

  const badgeText = decision.status;
  const hasAssetQualityBlock = decision.reasons.some((reason) => reason.kind === "качество_актива");
  const hasDisciplineBlock = decision.reasons.some((reason) => reason.kind === "дисциплина");
  const hasMarketPsychologyBlock = decision.reasons.some((reason) => reason.kind === "рыночная_психология");
  const blockReasons = decision.status === "БЛОКИРОВКА" ? decision.reasons : [];
  const preparationChecks = [
    { label: "Указана сумма больше нуля", ok: amountNum > 0 },
    { label: "Указана цена сделки", ok: buyPriceNum > 0 },
    { label: "Записан тезис решения", ok: Boolean(journalNote.trim()) },
    { label: "Записан сценарий отмены", ok: Boolean(invalidation.trim()) },
    { label: "Записан план выхода", ok: Boolean(exitPlan.trim()) },
    { label: "Записан план ордера", ok: Boolean(orderPlan.trim()) },
    { label: "Цена и сумма перепроверены", ok: priceAndAmountChecked },
    { label: "Алерт не считается ордером", ok: alertIsNotOrderConfirmed },
    { label: "Решение не продиктовано FOMO", ok: planNotFomoConfirmed },
  ];
  const missingPreparation = preparationChecks.filter((item) => !item.ok);
  const preparationComplete = missingPreparation.length === 0;
  const canSaveDecision = Boolean(onSaveDecision) && decision.status !== "ЖДАТЬ" && Boolean(resolvedAsset) && preparationComplete;
  const saveDecision = () => {
    if (!onSaveDecision || !canSaveDecision) return;
    onSaveDecision({
      asset: resolvedAsset,
      category,
      action: tradeAction,
      amountUsd: amountNum,
      buyPrice: buyPriceNum,
      decision,
      setup,
      emotion,
      note: journalNote.trim(),
      invalidation: invalidation.trim(),
      exitPlan: exitPlan.trim(),
      orderPlan: orderPlan.trim(),
      priceAndAmountChecked,
      alertIsNotOrderConfirmed,
      planNotFomoConfirmed,
    });
    setSavedMarker({ signature: decisionSignature, savedAt: new Date().toISOString() });
  };

  return (
    <div className="v2-gate-page">
      <div className="v2-gate-header">
        <span className="v2-gate-title">
          {isShortIncrease ? "Проверка добора шорта" : tradeAction === "sell" ? "Проверка продажи" : "Проверка покупки"}
        </span>
        <span className="v2-gate-sub">
          Фаза: {phase.label} · резерв ≥ {pct(effectiveReserveFloorShare)} · крипта ≤{" "}
          {pct(effectiveCryptoMaxShare)}
        </span>
      </div>

      {candidate && (
          <div className="v2-gate-route v2-panel">
            <div className="v2-gate-route-head">
              <span>Маршрут сделки</span>
              <button type="button" onClick={clearToManualInput}>Ручной ввод</button>
            </div>
          <div className="v2-gate-route-steps">
            <span className="is-done">Сайт/TG уровень</span>
            <span className="is-active">Проверка риска</span>
            <span className={journalSaved ? "is-done" : ""}>Журнал решения</span>
            <span className={journalSaved && !isBlocked ? "is-active" : ""}>
              Hyperliquid вручную
            </span>
          </div>
          <div className="v2-gate-route-source">
            {candidate.label} · цена {price(candidate.price)} · статус {candidateStatusLabel(candidate.status)}
          </div>
          <div className="v2-gate-route-warning">
            Кабинет проверяет риск и пишет допуск в журнал, но не выставляет ордер на Hyperliquid. Биржевую лимитку нужно поставить вручную.
          </div>
        </div>
      )}

      {/* ── Капитал под спот ──────────────────────────────── */}
      <div className="v2-gate-capital v2-panel">
        <div className="v2-gate-cap-main">
          <span className="v2-gate-cap-value">{usd(greenMax)}</span>
          <span className="v2-gate-cap-label">
            спот-капитал для добора · сверх {pct(effectiveSpotReserveFloorShare)}-резерва
          </span>
        </div>
        {cushionRoom > 0 && (
          <div className="v2-gate-cap-cushion">
            + подушка ещё {usd(cushionRoom)} до пола {usesAccountStrategyLimits ? "стратегии" : "фазы"} {pct(effectiveReserveFloorShare)}
          </div>
        )}
        <div className="v2-gate-buckets">
          {bucketRows(capitalBuckets, strategy).map((row) => (
            <div className="v2-gate-bucket" key={row.label}>
              <span>{row.label}</span>
              <strong>{usd(row.value)}</strong>
            </div>
          ))}
        </div>
        <div className="v2-gate-plan">
          Плановый крипто-блок: {usd(capitalBuckets.currentCryptoBlockUsd)} куплено +{" "}
          {usd(capitalBuckets.cryptoSpotBudgetUsd)} спот по умолчанию +{" "}
          {usd(capitalBuckets.averagingBudgetUsd)} ДСА добор ={" "}
          <strong>{usd(capitalBuckets.plannedCryptoBlockUsd)}</strong>
        </div>
      </div>

      {/* ── Форма ─────────────────────────────────────────── */}
      <div className="v2-gate-form v2-panel">
        <label className="v2-gate-field">
          <span className="v2-gate-label">Действие</span>
          <select
            className="v2-gate-input"
            value={tradeAction}
            onChange={(e) => {
              setTradeAction(e.target.value === "sell" ? "sell" : "buy");
              setSavedMarker(null);
              setExecutionMarker(null);
            }}
          >
            <option value="buy">Покупка</option>
            <option value="sell">Продажа</option>
          </select>
        </label>

        <label className="v2-gate-field">
          <span className="v2-gate-label">Актив</span>
          <select
            className="v2-gate-input"
            value={asset}
            onChange={(e) => handleAssetChange(e.target.value)}
          >
            {positions.map((p) => (
              <option key={p.asset} value={p.asset}>
                {p.asset} · {pct(p.value / (portfolio.totalPortfolioValue || 1))}
              </option>
            ))}
            <option value={NEW_ASSET}>+ Новый актив…</option>
          </select>
        </label>

        {isNew && (
          <>
            <label className="v2-gate-field">
              <span className="v2-gate-label">Тикер</span>
              <input
                className="v2-gate-input"
                value={newAsset}
                onChange={(e) => setNewAsset(e.target.value)}
                placeholder="напр. BTC"
                autoCapitalize="characters"
              />
            </label>
            <label className="v2-gate-field">
              <span className="v2-gate-label">Класс</span>
              <select
                className="v2-gate-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={CASH_CATEGORY}>{CASH_CATEGORY}</option>
              </select>
            </label>
          </>
        )}

        <label className="v2-gate-field">
          <span className="v2-gate-label">
            {isShortIncrease ? "Сумма добора шорта, $" : tradeAction === "sell" ? "Сумма продажи, $" : "Сумма покупки, $"}
          </span>
          <input
            className="v2-gate-input"
            type="number"
            inputMode="decimal"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="v2-gate-field">
          <span className="v2-gate-label">
            {isShortIncrease ? "Цена входа шорта" : tradeAction === "sell" ? "Цена продажи" : "Цена покупки"}
          </span>
          <input
            className="v2-gate-input"
            type="number"
            inputMode="decimal"
            min="0"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            placeholder={selectedPosition?.currentPrice ? String(selectedPosition.currentPrice) : "0"}
          />
        </label>
      </div>

      {/* ── Вердикт ───────────────────────────────────────── */}
      <div className={`v2-gate-verdict v2-panel ${statusClass}`}>
        {decision.status === "ЖДАТЬ" ? (
          <div className="v2-gate-verdict-idle">{decision.recommendedAction}</div>
        ) : (
          <>
            <div className="v2-gate-verdict-head">
              <span className="v2-gate-verdict-badge">{badgeText}</span>
              <span className="v2-gate-verdict-line">
                {decision.status === "РАЗРЕШЕНО"
                  ? `${resolvedAsset} · ${usd(amountNum)} — проходит проверку риска`
                  : decision.status === "БЛОКИРОВКА"
                    ? "Запрещено: сделка не проходит риск-фильтр"
                    : `${resolvedAsset} · ${usd(amountNum)} — ${decision.recommendedAction.toLowerCase()}`}
              </span>
            </div>

            {blockReasons.length > 0 && (
              <div className="v2-gate-blockers">
                {blockReasons.map((reason, i) => (
                  <div key={`${reason.kind}-${i}`} className="v2-gate-blocker-line">
                    <span className="v2-gate-blocker-tag">СТОП</span>
                    <span className="v2-gate-blocker-text">{reason.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="v2-gate-checks">
              {verdict.status !== "idle" && verdict.checks.map((c: GateCheck) => {
                const v = checkValues(c);
                const cls = c.ok ? "ok" : c.severity === "warn" ? "warn" : "fail";
                const mark = c.ok ? "✓" : c.severity === "warn" ? "!" : "✗";
                return (
                  <div key={c.key} className={`v2-gate-check ${cls}`}>
                    <span className="v2-gate-check-mark">{mark}</span>
                    <span className="v2-gate-check-label">{c.label}</span>
                    <span className="v2-gate-check-vals">
                      {v.before} <span className="v2-gate-arrow">→</span> {v.after}
                      <span className="v2-gate-check-limit"> · лимит {v.limit}</span>
                    </span>
                    {c.note && (!c.ok || c.key === "assetSlots") && <span className="v2-gate-check-note">{c.note}</span>}
                  </div>
                );
              })}
            </div>

            {decision.warnings.length > 0 && (
              <div className="v2-gate-warnings">
                {decision.warnings.map((w, i) => (
                  <div key={i} className="v2-gate-warn-line">
                    ⚠ {w.text}
                  </div>
                ))}
              </div>
            )}

            {(disciplineBlockers.length > 0 || disciplineWarnings.length > 0) && (
              <div className={`v2-gate-discipline ${disciplineBlockers.length > 0 ? "is-block" : "is-warn"}`}>
                <div className="v2-gate-discipline-head">
                  <span>Дисциплина</span>
                  <strong>{disciplineBlockers.length > 0 ? "ПАУЗА" : "НАБЛЮДЕНИЕ"}</strong>
                </div>
                {[...disciplineBlockers, ...disciplineWarnings].slice(0, 3).map((item) => (
                  <div key={item} className="v2-gate-discipline-line">{item}</div>
                ))}
              </div>
            )}

            {decision.tradePreview && (
              <div className="v2-gate-average">
                <div className="v2-gate-average-title">Калькулятор усреднения</div>
                <div className="v2-gate-average-grid">
                  <span>{isShortIncrease ? "Средняя шорта сейчас" : "Средняя сейчас"}</span>
                  <strong>{price(decision.tradePreview.averageEntryBefore)}</strong>
                  <span>{isShortIncrease ? "Цена добора шорта" : "Цена покупки"}</span>
                  <strong>{price(decision.tradePreview.buyPrice)}</strong>
                  <span>Количество добавится</span>
                  <strong>{decision.tradePreview.addedQuantity.toFixed(6)}</strong>
                  <span>{isShortIncrease ? "Новая средняя шорта" : "Новая средняя"}</span>
                  <strong>{price(decision.tradePreview.averageEntryAfter)}</strong>
                </div>
              </div>
            )}

            {!decision.tradePreview && amountNum > 0 && (
              <div className="v2-gate-average is-muted">
                {isShortIncrease
                  ? "Шорт-добор усредняет среднюю входа по новому notional. Это не закрытие текущей позиции."
                  : tradeAction === "sell"
                  ? "Продажа не пересчитывает среднюю входа. После сделки учёт должен уменьшить cost basis по старой средней."
                  : "Введите цену покупки — система рассчитает новую среднюю входа."}
              </div>
            )}

            {decision.survivalAfter && (
              <div className="v2-gate-survival">
                <span>Выживаемость после сделки</span>
                <strong>{decision.survivalAfter.status}</strong>
                <span>
                  худший сценарий: {decision.survivalAfter.survivalWorstScenario}, просадка{" "}
                  {pct(decision.survivalAfter.survivalShockLossPct)}
                </span>
              </div>
            )}

            {decision.healthPreview && (
              <div className={`v2-gate-health ${decision.healthPreview.applicable ? "" : "is-blocked"}`}>
                <div className="v2-gate-health-head">
                  <span>Здоровье портфеля</span>
                  {decision.healthPreview.applicable ? (
                    <strong>
                      {Math.round(decision.healthPreview.before.healthFactor)} →{" "}
                      {Math.round(decision.healthPreview.after.healthFactor)}
                      <span className={decision.healthPreview.delta < 0 ? "is-down" : "is-up"}>
                        {decision.healthPreview.delta !== 0 ? ` ${signedScore(decision.healthPreview.delta)}` : " 0"}
                      </span>
                    </strong>
                  ) : (
                    <strong>не применяется</strong>
                  )}
                </div>
                {decision.healthPreview.note ? (
                  <div className="v2-gate-health-note">{decision.healthPreview.note}</div>
                ) : decision.healthPreview.changedComponents.length > 0 ? (
                  <div className="v2-gate-health-grid">
                    {decision.healthPreview.changedComponents.slice(0, 3).map((component) => (
                      <div key={component.key} className="v2-gate-health-row">
                        <span>{component.label}</span>
                        <strong>
                          {component.before} → {component.after}
                          <em className={component.delta < 0 ? "is-down" : "is-up"}>
                            {component.delta !== 0 ? signedScore(component.delta) : "0"}
                          </em>
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="v2-gate-health-note">Сделка не меняет лучи здоровья.</div>
                )}
              </div>
            )}

            {decision.status === "БЛОКИРОВКА" && hasAssetQualityBlock && (
              <button type="button" className="v2-gate-fix is-blocked" disabled>
                Заблокировано — актив запрещён политикой риска
              </button>
            )}
            {decision.status === "БЛОКИРОВКА" && hasDisciplineBlock && !hasAssetQualityBlock && (
              <button type="button" className="v2-gate-fix is-blocked" disabled>
                Заблокировано — активна дисциплинарная пауза
              </button>
            )}
            {decision.status === "БЛОКИРОВКА" && hasMarketPsychologyBlock && !hasAssetQualityBlock && !hasDisciplineBlock && (
              <button type="button" className="v2-gate-fix is-blocked" disabled>
                Заблокировано — рынок в зоне перегрева
              </button>
            )}
            {decision.status === "БЛОКИРОВКА" && !hasAssetQualityBlock && !hasDisciplineBlock && !hasMarketPsychologyBlock && decision.maxAllowedAmount > 0 && (
              <button
                type="button"
                className="v2-gate-fix"
                onClick={() => setAmount(String(Math.floor(decision.maxSafeAmount || decision.maxAllowedAmount)))}
              >
                {decision.maxSafeAmount > 0
                  ? `Уменьшить до ${usd(decision.maxSafeAmount)} — полностью безопасно`
                  : `Максимум допустимо ${usd(decision.maxAllowedAmount)}`}
              </button>
            )}
            {decision.status === "БЛОКИРОВКА" && !hasAssetQualityBlock && !hasDisciplineBlock && !hasMarketPsychologyBlock && decision.maxAllowedAmount <= 0 && (
              <div className="v2-gate-nofix">
                Безопасного объёма для добора этого актива сейчас нет — лимит уже на пределе.
              </div>
            )}
            {(decision.status === "ОСТОРОЖНО" || decision.status === "РАЗРЕШЕНО_С_ЛИМИТОМ") && decision.maxSafeAmount > 0 && (
              <button
                type="button"
                className="v2-gate-fix subtle"
                onClick={() => setAmount(String(Math.floor(decision.maxSafeAmount)))}
              >
                Остаться в зелёном: {usd(decision.maxSafeAmount)}
              </button>
            )}

            {verdict.status !== "idle" && verdict.fearGreed && (
              <div className={`v2-gate-fg tone-${verdict.fearGreed.tone}`}>
                {verdict.fearGreed.text}
              </div>
            )}

            <div className="v2-gate-journal">
              <div className="v2-gate-journal-title">Журнал решения</div>
              <div className="v2-gate-journal-grid">
                <label className="v2-gate-journal-field">
                  <span>Сетап</span>
                  <select value={setup} onChange={(event) => setSetup(event.target.value)}>
                    {SETUPS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="v2-gate-journal-field">
                  <span>Состояние</span>
                  <select value={emotion} onChange={(event) => setEmotion(event.target.value)}>
                    {EMOTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="v2-gate-journal-field is-wide">
                <span>Тезис решения</span>
                <textarea
                  value={journalNote}
                  onChange={(event) => setJournalNote(event.target.value)}
                  placeholder="Почему сделка нужна именно сейчас и на каком правиле стратегии основана"
                />
              </label>
              <label className="v2-gate-journal-field is-wide">
                <span>Сценарий отмены</span>
                <textarea
                  value={invalidation}
                  onChange={(event) => setInvalidation(event.target.value)}
                  placeholder="При каком условии идея перестаёт быть действительной"
                />
              </label>
              <label className="v2-gate-journal-field is-wide">
                <span>План выхода</span>
                <textarea
                  value={exitPlan}
                  onChange={(event) => setExitPlan(event.target.value)}
                  placeholder="Тейки, частичное или полное закрытие, действие после выхода"
                />
              </label>
              <label className="v2-gate-journal-field is-wide">
                <span>План ордера</span>
                <textarea
                  value={orderPlan}
                  onChange={(event) => setOrderPlan(event.target.value)}
                  placeholder="Биржа, тип ордера, цена и сумма. Алерт сам по себе ордером не является"
                />
              </label>
              <div className="v2-gate-required-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={priceAndAmountChecked}
                    onChange={(event) => setPriceAndAmountChecked(event.target.checked)}
                  />
                  <span>Цена и сумма перепроверены</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={alertIsNotOrderConfirmed}
                    onChange={(event) => setAlertIsNotOrderConfirmed(event.target.checked)}
                  />
                  <span>Понимаю: алерт не означает, что ордер выставлен</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={planNotFomoConfirmed}
                    onChange={(event) => setPlanNotFomoConfirmed(event.target.checked)}
                  />
                  <span>Решение соответствует плану и не принимается из-за FOMO</span>
                </label>
              </div>
              {!preparationComplete && (
                <div className="v2-gate-required-status">
                  <strong>Допуск закрыт</strong>
                  <span>{missingPreparation.map((item) => item.label).join(" · ")}</span>
                </div>
              )}
              <button
                type="button"
                className="v2-gate-save"
                disabled={!canSaveDecision}
                onClick={saveDecision}
              >
                {preparationComplete ? "Сохранить решение" : "Заполните обязательный план"}
              </button>
              {savedMarker?.signature === decisionSignature && (
                <div className="v2-gate-save-note">
                  Снимок сохранён: {new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(savedMarker.savedAt))}
                </div>
              )}
              <div className={`v2-gate-execution ${isBlocked ? "is-blocked" : journalSaved ? "is-ready" : ""}`}>
                <button
                  type="button"
                  disabled={isBlocked || !journalSaved}
                  onClick={() => setExecutionMarker({ signature: decisionSignature, openedAt: new Date().toISOString() })}
                >
                  {isBlocked
                    ? "Сделка заблокирована"
                    : journalSaved
                      ? finalActionText
                      : preparationComplete
                        ? "Сначала сохранить решение"
                        : "Сначала заполнить обязательный план"}
                </button>
                <span>
                  {isBlocked
                    ? "Жёсткий запрет не даёт перейти к действию."
                    : journalSaved
                      ? "Допуск открыт только внутри кабинета. Следующий шаг — вручную выставить лимитку или исполнить сделку на Hyperliquid."
                      : "Финальная кнопка включится только после записи в журнал."}
                </span>
                {executionMarker && executionOpened && (
                  <em className="v2-gate-exchange-next">
                    Допуск открыт: {new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(executionMarker.openedAt))}. Ордер на Hyperliquid ещё не подтверждён кабинетом.
                  </em>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="v2-gate-foot">
        Спот-пол {pct(effectiveSpotReserveFloorShare)} · пол {usesAccountStrategyLimits ? "стратегии" : "фазы"} {pct(effectiveReserveFloorShare)}. Шлюз
        не исполняет сделки — только сверяет с политикой риска.
      </div>
    </div>
  );
}
