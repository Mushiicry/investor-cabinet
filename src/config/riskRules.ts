export const SPOT_RESERVE_FLOOR_SHARE = 0.3;
export const RESERVE_WORK_BUDGET_SHARE = 0.4575;

export const RESERVE_HEALTH_STRONG_SHARE = 0.5;
export const RESERVE_HEALTH_BALANCED_SHARE = 0.35;
export const RESERVE_HEALTH_LOW_SHARE = 0.2;

// Политика из листа «Риск» (единый источник правды):
// целевая доля резерва 30%, цель по крипте 60%, фьючерсы ≤10%, макс. на одну позицию 35%.
export const RESERVE_TARGET_SHARE = 0.3;
export const MAX_CRYPTO_EXPOSURE_SHARE = 0.6;
export const MAX_FUTURES_EXPOSURE_SHARE = 0.1;
export const MAX_SINGLE_RISK_ASSET_SHARE = 0.35;
