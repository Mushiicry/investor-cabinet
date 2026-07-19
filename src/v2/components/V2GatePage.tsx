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
  evaluateTrade,
  type GateContext,
  type GateCheck,
} from "../lib/preTradeGate";

type Props = {
  portfolio: V2LabData["portfolio"];
  positions: V2LabData["positions"];
  allocation: V2LabData["allocation"];
  fearGreedStrategy: V2LabData["fearGreedStrategy"];
};

const NEW_ASSET = "__new__";
const CATEGORIES = [CRYPTO_CATEGORY, METALS_CATEGORY, STOCKS_CATEGORY, FUTURES_CATEGORY];

const pct = (share: number) => `${(share * 100).toFixed(1)}%`;
const usd = (v: number) => `${Math.round(v).toLocaleString("ru-RU")}$`;

/** Строка проверки в человекочитаемом виде «до → после · лимит». */
function checkValues(c: GateCheck) {
  if (c.isShare) {
    return { before: pct(c.before), after: pct(c.after), limit: pct(c.limit) };
  }
  return { before: usd(c.before), after: usd(c.after), limit: usd(c.limit) };
}

export function V2GatePage({ portfolio, positions, allocation, fearGreedStrategy }: Props) {
  const empty = isEmptyAccount(portfolio);

  const [asset, setAsset] = useState<string>(() => positions[0]?.asset ?? NEW_ASSET);
  const [newAsset, setNewAsset] = useState("");
  const [category, setCategory] = useState<string>(CRYPTO_CATEGORY);
  const [amount, setAmount] = useState<string>("");

  const isNew = asset === NEW_ASSET;
  const resolvedAsset = isNew ? newAsset.trim().toUpperCase() : asset;

  const phase = useMemo(() => getMarketPhase(new Date()), []);

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
      positions: positions.map((p) => ({ asset: p.asset, category: p.category, value: p.value })),
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
  }, [portfolio, positions, allocation, fearGreedStrategy, phase]);

  const amountNum = Number(amount);

  const verdict = useMemo(
    () => evaluateTrade({ asset: resolvedAsset || "—", amountUsd: amountNum, category }, ctx),
    [resolvedAsset, amountNum, category, ctx],
  );

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
    verdict.status === "ok"
      ? "is-ok"
      : verdict.status === "caution"
        ? "is-caution"
        : verdict.status === "block"
          ? "is-block"
          : "is-idle";

  const badgeText =
    verdict.status === "ok" ? "МОЖНО" : verdict.status === "caution" ? "ПОДУШКА" : "БЛОК";

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
      </div>

      {/* ── Форма ─────────────────────────────────────────── */}
      <div className="v2-gate-form v2-panel">
        <label className="v2-gate-field">
          <span className="v2-gate-label">Актив</span>
          <select
            className="v2-gate-input"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
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
      </div>

      {/* ── Вердикт ───────────────────────────────────────── */}
      <div className={`v2-gate-verdict v2-panel ${statusClass}`}>
        {verdict.status === "idle" ? (
          <div className="v2-gate-verdict-idle">{verdict.message}</div>
        ) : (
          <>
            <div className="v2-gate-verdict-head">
              <span className="v2-gate-verdict-badge">{badgeText}</span>
              <span className="v2-gate-verdict-line">
                {verdict.status === "ok"
                  ? `${resolvedAsset} · ${usd(amountNum)} — в пределах политики`
                  : verdict.status === "caution"
                    ? `${resolvedAsset} · ${usd(amountNum)} — разрешено, но с оговоркой`
                    : `Пробит лимит: ${verdict.reasons.join(", ")}`}
              </span>
            </div>

            <div className="v2-gate-checks">
              {verdict.checks.map((c) => {
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
                  </div>
                );
              })}
            </div>

            {verdict.warnings.length > 0 && (
              <div className="v2-gate-warnings">
                {verdict.warnings.map((w, i) => (
                  <div key={i} className="v2-gate-warn-line">
                    ⚠ {w}
                  </div>
                ))}
              </div>
            )}

            {verdict.status === "block" && verdict.maxAllowedAmount > 0 && (
              <button
                type="button"
                className="v2-gate-fix"
                onClick={() => setAmount(String(Math.floor(verdict.maxSafeAmount || verdict.maxAllowedAmount)))}
              >
                {verdict.maxSafeAmount > 0
                  ? `Уменьшить до ${usd(verdict.maxSafeAmount)} — полностью безопасно`
                  : `Максимум допустимо ${usd(verdict.maxAllowedAmount)}`}
              </button>
            )}
            {verdict.status === "block" && verdict.maxAllowedAmount <= 0 && (
              <div className="v2-gate-nofix">
                Безопасного объёма для добора сейчас нет — лимиты уже на пределе.
              </div>
            )}
            {verdict.status === "caution" && verdict.maxSafeAmount > 0 && (
              <button
                type="button"
                className="v2-gate-fix subtle"
                onClick={() => setAmount(String(Math.floor(verdict.maxSafeAmount)))}
              >
                Остаться в зелёном: {usd(verdict.maxSafeAmount)}
              </button>
            )}

            {verdict.fearGreed && (
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
