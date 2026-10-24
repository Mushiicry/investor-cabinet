import type { V2Position } from "../InvestorCabinetV2Lab";
import { isCryptoMajorForStrategy, MAIN_INVESTOR_STRATEGY } from "./investorStrategy";

/** Наблюдение для позиции с вложением или текущим остатком меньше $1; только отображение. */
export function isObservationPortfolioPosition(
  position: Pick<V2Position, "invested" | "value">,
): boolean {
  return (Number.isFinite(position.invested) && position.invested >= 0 && position.invested < 1) ||
    (Number.isFinite(position.value) && position.value >= 0 && position.value < 1);
}

/** Только отображение: нулевые фьючерсы и альты остаются в исходных данных. */
export function isVisiblePortfolioPosition(
  position: Pick<V2Position, "asset" | "category" | "value" | "invested" | "pnl">,
  strategy = MAIN_INVESTOR_STRATEGY,
): boolean {
  const isSpotAltcoin = (position.category === "Крипта" || position.category === "Crypto") &&
    !isCryptoMajorForStrategy(position.asset, strategy);
  // Статус CLOSED может быть устаревшим. При ненулевом остатке/марже
  // или PnL позицию сохраняем, чтобы не спрятать риск или изменить итоги.
  return (position.category !== "Фьючерсы" && !isSpotAltcoin) ||
    position.value !== 0 || position.invested !== 0 || position.pnl !== 0;
}
