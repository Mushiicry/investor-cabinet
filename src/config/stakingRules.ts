// Ставки стейкинга по активам (APY).
//
// Источник — площадка ликвидного стейкинга, обновляется вручную:
// у Tonstakers нет публичного API для APY (значение считается из контракта
// tsTON), поэтому держим его здесь и правим при заметном изменении ставки.
//
// Ключ — тикер актива (как в поле transaction.asset), значение — APY в долях.
export const STAKING_APY: Record<string, number> = {
  TON: 0.1437, // Tonstakers (tsTON liquid staking) — ~14.37% APY
};

export function stakingApy(asset: string): number | null {
  const key = (asset || "").toUpperCase();
  return STAKING_APY[key] ?? null;
}
