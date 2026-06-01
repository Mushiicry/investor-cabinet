import type { FearGreedStrategyApiRule, InvestorApiResponse } from "../types/api";
import type {
  FearGreedMode,
  FearGreedStrategy,
  FearGreedStrategyRule,
  FearGreedStrategyStatus,
} from "../types/portfolio";

type RuleBase = {
  mode: FearGreedMode;
  minIndex: number;
  maxIndex: number;
  label: string;
  buyPct: number;
  cooldownDays: number;
};

const DEFAULT_RULES: RuleBase[] = [
  { mode: "observation", minIndex: 30, maxIndex: 100, label: "Наблюдение", buyPct: 0, cooldownDays: 0 },
  { mode: "cautious", minIndex: 20, maxIndex: 29, label: "Осторожная покупка", buyPct: 0.01, cooldownDays: 7 },
  { mode: "strong", minIndex: 15, maxIndex: 19, label: "Усиленная покупка", buyPct: 0.015, cooldownDays: 7 },
  { mode: "aggressive", minIndex: 0, maxIndex: 14, label: "Агрессивная покупка", buyPct: 0.02, cooldownDays: 7 },
];

const isMode = (value: unknown): value is FearGreedMode =>
  value === "observation" || value === "cautious" || value === "strong" || value === "aggressive";

const isStatus = (value: unknown): value is FearGreedStrategyStatus =>
  value === "passive" || value === "active" || value === "cooldown";

const toNumber = (value: unknown, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDateTime = (value: unknown): number | null => {
  if (!value || typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const toIsoOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const splitRange = (range: unknown, fallback: RuleBase) => {
  if (typeof range !== "string") {
    return { minIndex: fallback.minIndex, maxIndex: fallback.maxIndex };
  }

  const [min, max] = range.split("-").map((part) => Number(part.trim()));
  return {
    minIndex: Number.isFinite(min) ? min : fallback.minIndex,
    maxIndex: Number.isFinite(max) ? max : fallback.maxIndex,
  };
};

export function getFearGreedMode(index: number): FearGreedMode {
  return DEFAULT_RULES.find((rule) => index >= rule.minIndex && index <= rule.maxIndex)?.mode ?? "observation";
}

export function buildFearGreedStrategy(
  currentIndex: number,
  portfolioValue: number,
  sourceRules: Partial<FearGreedStrategyRule>[] = [],
  now = Date.now()
): FearGreedStrategy {
  const normalizedIndex = Math.max(0, Math.min(100, Math.round(currentIndex)));
  const currentMode = getFearGreedMode(normalizedIndex);

  const rules = DEFAULT_RULES.map((fallback) => {
    const source = sourceRules.find((rule) => rule.mode === fallback.mode) ?? {};
    const { minIndex, maxIndex } = splitRange(source.range, fallback);
    const cooldownDays = toNumber(source.cooldownDays, fallback.cooldownDays);
    const buyPct = toNumber(source.buyPct, fallback.buyPct);
    const lastBuyAt = source.lastBuyAt ?? null;
    const lastBuyTimestamp = toDateTime(lastBuyAt);
    const nextAvailableAt = source.nextAvailableAt ?? (
      lastBuyTimestamp && cooldownDays
        ? new Date(lastBuyTimestamp + cooldownDays * 24 * 60 * 60 * 1000).toISOString()
        : null
    );
    const nextAvailableTimestamp = toDateTime(nextAvailableAt);
    const cooldownRemainingHours = nextAvailableTimestamp
      ? Math.max(0, Math.ceil((nextAvailableTimestamp - now) / (60 * 60 * 1000)))
      : 0;
    const isCurrent = fallback.mode === currentMode;
    const isAvailable = buyPct > 0 && cooldownRemainingHours <= 0;
    const status: FearGreedStrategyStatus = cooldownRemainingHours > 0 ? "cooldown" : isCurrent && isAvailable ? "active" : "passive";

    return {
      mode: fallback.mode,
      range: `${minIndex}-${maxIndex}`,
      label: typeof source.label === "string" && source.label ? source.label : fallback.label,
      buyPct,
      buyAmount: Number((portfolioValue * buyPct).toFixed(2)),
      cooldownDays,
      lastBuyAt,
      nextAvailableAt,
      isCurrent,
      isAvailable,
      cooldownRemainingHours,
      status,
    };
  });

  return {
    currentIndex: normalizedIndex,
    currentMode,
    portfolioValue,
    rules,
  };
}

const toApiRule = (item: unknown): FearGreedStrategyApiRule =>
  item && typeof item === "object" ? item as FearGreedStrategyApiRule : {};

export function normalizeFearGreedStrategyFromApi(
  source: InvestorApiResponse["fearGreedStrategy"],
  fallback: FearGreedStrategy,
  portfolioValue: number
): FearGreedStrategy {
  const safeFallback = fallback ?? buildFearGreedStrategy(50, portfolioValue);

  if (!source || !Array.isArray(source.rules)) {
    return buildFearGreedStrategy(safeFallback.currentIndex, portfolioValue, safeFallback.rules);
  }

  const sourceRules = source.rules.map((rawRule, index) => {
    const rule = toApiRule(rawRule);
    const fallbackRule = DEFAULT_RULES[index] ?? DEFAULT_RULES[0];

    return {
      mode: isMode(rule.mode) ? rule.mode : fallbackRule.mode,
      range: typeof rule.range === "string" ? rule.range : `${fallbackRule.minIndex}-${fallbackRule.maxIndex}`,
      label: typeof rule.label === "string" ? rule.label : fallbackRule.label,
      buyPct: toNumber(rule.buyPct, fallbackRule.buyPct),
      buyAmount: toNumber(rule.buyAmount, portfolioValue * fallbackRule.buyPct),
      cooldownDays: toNumber(rule.cooldownDays, fallbackRule.cooldownDays),
      lastBuyAt: toIsoOrNull(rule.lastBuyAt),
      nextAvailableAt: toIsoOrNull(rule.nextAvailableAt),
      isCurrent: Boolean(rule.isCurrent),
      isAvailable: Boolean(rule.isAvailable),
      cooldownRemainingHours: toNumber(rule.cooldownRemainingHours),
      status: isStatus(rule.status) ? rule.status : "passive",
    };
  });

  const currentIndex = toNumber(source.currentIndex, safeFallback.currentIndex);
  return buildFearGreedStrategy(currentIndex, portfolioValue, sourceRules);
}
