export const SPOT_RESERVE_FLOOR_SHARE = 0.3;
export const RESERVE_WORK_BUDGET_SHARE = 0.4575;

export const RESERVE_HEALTH_STRONG_SHARE = 0.5;
export const RESERVE_HEALTH_BALANCED_SHARE = 0.35;
export const RESERVE_HEALTH_LOW_SHARE = 0.2;

// Политика владельца (2026-07-16), «полная картина рынка» — всё куплено по лимитам:
// крипта 60% + акции 10% + золото/металлы 10% + фьючерсы 10% + резерв 10% = 100%.
// Целевая доля резерва 30%, при полном развороте в рынок может опускаться до 10%
// (RESERVE_FLOOR_SHARE) — ниже пола резерв не опускаем никогда.
export const RESERVE_TARGET_SHARE = 0.3;
export const RESERVE_FLOOR_SHARE = 0.1;
export const MAX_CRYPTO_EXPOSURE_SHARE = 0.6;
export const MAX_STOCKS_EXPOSURE_SHARE = 0.1;
export const MAX_METALS_EXPOSURE_SHARE = 0.1;
export const MAX_FUTURES_EXPOSURE_SHARE = 0.1;
export const MAX_SINGLE_RISK_ASSET_SHARE = 0.35;

// Верхняя граница коридора резерва. Резерв — это подушка и опциональность,
// но капитал сверх этой доли уже просто простаивает: инвестор не инвестирует.
// В диапазоне [RESERVE_TARGET_SHARE, RESERVE_BAND_MAX_SHARE] резерв = 100 баллов,
// выше — балл линейно падает до 0 при 100% в кэше.
export const RESERVE_BAND_MAX_SHARE = 0.6;
