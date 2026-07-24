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
import { buildCapitalBuckets, type CapitalBuckets } from "../lib/capitalBuckets";
import { BINANCE_MONITORING_ASSET_QUALITY } from "../lib/assetQualitySource";
import type { DecisionJournalDraft } from "../lib/decisionJournal";
import { getMarketPsychology } from "../lib/marketPsychology";
import type { TradeCandidate } from "../lib/tradeCandidate";

type Props = {
  portfolio: V2LabData["portfolio"];
  positions: V2LabData["positions"];
  allocation: V2LabData["allocation"];
  fearGreedStrategy: V2LabData["fearGreedStrategy"];
  assetQuality: V2LabData["assetQuality"];
  healthInput: V2LabData["healthInput"];
  futuresShare?: number;
  onSaveDecision?: (draft: DecisionJournalDraft) => void;
  candidate?: TradeCandidate | null;
  onClearCandidate?: () => void;
  disciplineBlockers?: string[];
  disciplineWarnings?: string[];
};

const NEW_ASSET = "__new__";
const CATEGORIES = [CRYPTO_CATEGORY, METALS_CATEGORY, STOCKS_CATEGORY, FUTURES_CATEGORY];
const SETUPS = ["Плановый добор", "Лимитный ордер", "Усреднение", "Ребаланс", "Защитное действие", "Учебная сделка"];
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

function bucketRows(buckets: CapitalBuckets) {
  return [
    { label: "Резерв", value: buckets.lockedReserveUsd },
    { label: "Фьючерсы", value: buckets.futuresBudgetUsd },
    { label: "Усреднение", value: buckets.averagingBudgetUsd },
    { label: "Спот", value: buckets.spotBudgetUsd },
    { label: "Металлы до", value: buckets.metalsBudgetUsd },
    { label: "Акции до", value: buckets.stocksBudgetUsd },
  ];
}

export function V2GatePage({
  portfolio,
  positions,
  allocation,
  fearGreedStrategy,
  assetQuality,
  healthInput,
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
  const [setup, setSetup] = useState(candidate ? "Лимитный ордер" : SETUPS[0]);
  const [emotion, setEmotion] = useState(EMOTIONS[0]);
  const [journalNote, setJournalNote] = useState(candidate ? `${candidate.label}. Источник: лимитный ордер.` : "");
  const [savedMarker, setSavedMarker] = useState<{ signature: string; savedAt: string } | null>(null);
  const [executionMarker, setExecutionMarker] = useState<{ signature: string; openedAt: string } | null>(null);

  const isNew = asset === NEW_ASSET;
  const resolvedAsset = isNew ? newAsset.trim().toUpperCase() : asset;
  const selectedPosition = positions.find((p) => p.asset === resolvedAsset);
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

  const capitalBuckets = useMemo(
    () =>
      buildCapitalBuckets({
        totalPortfolioValue: portfolio.totalPortfolioValue,
        stableReserve: portfolio.stableReserve,
        allocation: allocation.map((a) => ({ name: a.name, value: a.value })),
        strategyRules: fearGreedStrategy.rules,
        futuresDeployableUsd: portfolio.futuresDeployable,
      }),
    [portfolio.totalPortfolioValue, portfolio.stableReserve, portfolio.futuresDeployable, allocation, fearGreedStrategy.rules],
  );

  const activeAssetQuality = assetQuality?.connected ? assetQuality : BINANCE_MONITORING_ASSET_QUALITY;

  const ctx: DecisionContext = useMemo(() => {
    const strategy = buildFearGreedStrategy(
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
      stableReserve: portfolio.stableReserve,
      spotDeployable: portfolio.spotDeployable || 0,
      reserveFloorShare: phase.reserveFloorShare,
      cryptoMaxShare: phase.cryptoMaxShare,
      futuresShare,
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
      fearGreedRules: strategy.rules.map((r) => ({
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
    phase,
    futuresShare,
    capitalBuckets,
    activeAssetQuality,
    healthInput,
    disciplineBlockers,
    disciplineWarnings,
  ]);

  const amountNum = Number(amount);
  const buyPriceNum = Number(buyPrice);

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
    decision.status,
    candidate?.id ?? "",
  ].join("|");
  const journalSaved = savedMarker?.signature === decisionSignature;
  const executionOpened = executionMarker?.signature === decisionSignature;
  const isBlocked = decision.status === "БЛОКИРОВКА" || decision.status === "ЖДАТЬ";
  const finalActionText = tradeAction === "sell" ? "Перейти к продаже" : "Перейти к покупке";

  // Капитал под спот: зелёный лимит (сверх 30%) и потолок до пола ФАЗЫ.
  const greenMax = Math.max(portfolio.spotDeployable || 0, 0);
  const hardMax = Math.max(
    greenMax,
    Math.max(portfolio.stableReserve - phase.reserveFloorShare * portfolio.totalPortfolioValue, 0),
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
  const canSaveDecision = Boolean(onSaveDecision) && decision.status !== "ЖДАТЬ" && Boolean(resolvedAsset);
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
    });
    setSavedMarker({ signature: decisionSignature, savedAt: new Date().toISOString() });
  };

  return (
    <div className="v2-gate-page">
      <div className="v2-gate-header">
        <span className="v2-gate-title">{tradeAction === "sell" ? "Проверка продажи" : "Проверка покупки"}</span>
        <span className="v2-gate-sub">
          Фаза: {phase.label} · резерв ≥ {pct(phase.reserveFloorShare)} · крипта ≤{" "}
          {pct(phase.cryptoMaxShare)}
        </span>
      </div>

      {candidate && (
        <div className="v2-gate-route v2-panel">
          <div className="v2-gate-route-head">
            <span>Маршрут сделки</span>
            <button type="button" onClick={onClearCandidate}>Ручной ввод</button>
          </div>
          <div className="v2-gate-route-steps">
            <span className="is-done">Лимитный ордер</span>
            <span className="is-active">Проверка риска</span>
            <span className={journalSaved ? "is-done" : ""}>Журнал решения</span>
            <span className={journalSaved && !isBlocked ? "is-active" : ""}>
              {tradeAction === "sell" ? "Продажа" : "Покупка"}
            </span>
          </div>
          <div className="v2-gate-route-source">
            {candidate.label} · цена {price(candidate.price)} · статус {candidateStatusLabel(candidate.status)}
          </div>
        </div>
      )}

      {/* ── Капитал под спот ──────────────────────────────── */}
      <div className="v2-gate-capital v2-panel">
        <div className="v2-gate-cap-main">
          <span className="v2-gate-cap-value">{usd(greenMax)}</span>
          <span className="v2-gate-cap-label">
            спот-капитал к доборку · сверх {pct(SPOT_RESERVE_FLOOR_SHARE)}-резерва
          </span>
        </div>
        {cushionRoom > 0 && (
          <div className="v2-gate-cap-cushion">
            + подушка ещё {usd(cushionRoom)} до пола фазы {pct(phase.reserveFloorShare)}
          </div>
        )}
        <div className="v2-gate-buckets">
          {bucketRows(capitalBuckets).map((row) => (
            <div className="v2-gate-bucket" key={row.label}>
              <span>{row.label}</span>
              <strong>{usd(row.value)}</strong>
            </div>
          ))}
        </div>
        <div className="v2-gate-plan">
          Плановый крипто-блок: {usd(capitalBuckets.currentCryptoBlockUsd)} куплено +{" "}
          {usd(capitalBuckets.cryptoSpotBudgetUsd)} спот по умолчанию +{" "}
          {usd(capitalBuckets.averagingBudgetUsd)} усреднение ={" "}
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
          <span className="v2-gate-label">{tradeAction === "sell" ? "Сумма продажи, $" : "Сумма покупки, $"}</span>
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
          <span className="v2-gate-label">{tradeAction === "sell" ? "Цена продажи" : "Цена покупки"}</span>
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
                    ? `Запрещено: ${decision.reasons.map((reason) => reason.text).join(", ")}`
                    : `${resolvedAsset} · ${usd(amountNum)} — ${decision.recommendedAction.toLowerCase()}`}
              </span>
            </div>

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
                    {!c.ok && c.note && <span className="v2-gate-check-note">{c.note}</span>}
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
                  <span>Средняя сейчас</span>
                  <strong>{price(decision.tradePreview.averageEntryBefore)}</strong>
                  <span>Цена покупки</span>
                  <strong>{price(decision.tradePreview.buyPrice)}</strong>
                  <span>Количество добавится</span>
                  <strong>{decision.tradePreview.addedQuantity.toFixed(6)}</strong>
                  <span>Новая средняя</span>
                  <strong>{price(decision.tradePreview.averageEntryAfter)}</strong>
                </div>
              </div>
            )}

            {!decision.tradePreview && amountNum > 0 && (
              <div className="v2-gate-average is-muted">
                {tradeAction === "sell"
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
                <span>Заметка</span>
                <input
                  value={journalNote}
                  onChange={(event) => setJournalNote(event.target.value)}
                  placeholder="Почему это решение принимается сейчас"
                />
              </label>
              <button
                type="button"
                className="v2-gate-save"
                disabled={!canSaveDecision}
                onClick={saveDecision}
              >
                Сохранить решение
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
                      : "Сначала сохранить решение"}
                </button>
                <span>
                  {isBlocked
                    ? "Жёсткий запрет не даёт перейти к действию."
                    : journalSaved
                      ? "Допуск открыт. Система не исполняет сделку — действие выполняется вручную на бирже."
                      : "Финальная кнопка включится только после записи в журнал."}
                </span>
                {executionMarker && executionOpened && (
                  <em>
                    Допуск открыт: {new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(executionMarker.openedAt))}
                  </em>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="v2-gate-foot">
        Спот-пол {pct(SPOT_RESERVE_FLOOR_SHARE)} · пол фазы {pct(phase.reserveFloorShare)}. Шлюз
        не исполняет сделки — только сверяет с политикой риска.
      </div>
    </div>
  );
}
