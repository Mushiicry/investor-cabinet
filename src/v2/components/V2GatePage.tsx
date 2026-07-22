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
  type GateContext,
  type GateCheck,
} from "../lib/preTradeGate";
import { evaluateDecision } from "../lib/decisionEngine";
import { buildCapitalBuckets, type CapitalBuckets } from "../lib/capitalBuckets";
import { BINANCE_MONITORING_ASSET_QUALITY } from "../lib/assetQualitySource";

type Props = {
  portfolio: V2LabData["portfolio"];
  positions: V2LabData["positions"];
  allocation: V2LabData["allocation"];
  fearGreedStrategy: V2LabData["fearGreedStrategy"];
  futuresShare?: number;
};

const NEW_ASSET = "__new__";
const CATEGORIES = [CRYPTO_CATEGORY, METALS_CATEGORY, STOCKS_CATEGORY, FUTURES_CATEGORY];

const pct = (share: number) => `${(share * 100).toFixed(1)}%`;
const usd = (v: number) => `${Math.round(v).toLocaleString("ru-RU")}$`;
const price = (v: number | null | undefined) =>
  v && Number.isFinite(v)
    ? `$${v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 2 : 6 })}`
    : "—";

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

export function V2GatePage({ portfolio, positions, allocation, fearGreedStrategy, futuresShare = 0 }: Props) {
  const empty = isEmptyAccount(portfolio);

  const [asset, setAsset] = useState<string>(() => positions[0]?.asset ?? NEW_ASSET);
  const [newAsset, setNewAsset] = useState("");
  const [category, setCategory] = useState<string>(CRYPTO_CATEGORY);
  const [amount, setAmount] = useState<string>("");
  const [buyPrice, setBuyPrice] = useState<string>(() =>
    positions[0]?.currentPrice && positions[0].currentPrice > 0 ? String(positions[0].currentPrice) : "",
  );

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

  const ctx: GateContext = useMemo(() => {
    const strategy = buildFearGreedStrategy(
      fearGreedStrategy.currentIndex,
      portfolio.totalPortfolioValue || 0,
      fearGreedStrategy.rules ?? [],
    );
    return {
      totalPortfolioValue: portfolio.totalPortfolioValue,
      stableReserve: portfolio.stableReserve,
      spotDeployable: portfolio.spotDeployable || 0,
      reserveFloorShare: phase.reserveFloorShare,
      cryptoMaxShare: phase.cryptoMaxShare,
      futuresShare,
      capitalBuckets,
      assetQuality: BINANCE_MONITORING_ASSET_QUALITY,
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
  }, [portfolio, positions, allocation, fearGreedStrategy, phase, futuresShare, capitalBuckets]);

  const amountNum = Number(amount);
  const buyPriceNum = Number(buyPrice);

  const decision = useMemo(
    () =>
      evaluateDecision(
        { asset: resolvedAsset || "—", amountUsd: amountNum, category, buyPrice: buyPriceNum },
        ctx,
      ),
    [resolvedAsset, amountNum, category, buyPriceNum, ctx],
  );
  const verdict = decision.gate;

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
          <span className="v2-gate-title">Проверка добора</span>
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

  return (
    <div className="v2-gate-page">
      <div className="v2-gate-header">
        <span className="v2-gate-title">Проверка добора</span>
        <span className="v2-gate-sub">
          Фаза: {phase.label} · резерв ≥ {pct(phase.reserveFloorShare)} · крипта ≤{" "}
          {pct(phase.cryptoMaxShare)}
        </span>
      </div>

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
          <span className="v2-gate-label">Сумма добора, $</span>
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
          <span className="v2-gate-label">Цена покупки</span>
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
                Введите цену покупки — система рассчитает новую среднюю входа.
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

            {decision.status === "БЛОКИРОВКА" && decision.maxAllowedAmount > 0 && (
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
            {decision.status === "БЛОКИРОВКА" && decision.maxAllowedAmount <= 0 && (
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
