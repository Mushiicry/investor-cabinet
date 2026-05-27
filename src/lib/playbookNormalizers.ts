import type { Decision, ScenarioCard } from "../types/portfolio";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toText = (value: unknown, fallback = "") =>
  String(value ?? fallback).trim();

const byAsset = <T extends { asset: string }>(items: T[]) =>
  new Map(items.map((item) => [item.asset, item]));

export function normalizeDecisions(
  decisions: unknown,
  fallback: Decision[]
): Decision[] {
  if (!Array.isArray(decisions)) return fallback;

  const fallbackMap = byAsset(fallback);
  const normalized = decisions
    .map((rawItem) => {
      const item = isRecord(rawItem) ? rawItem : {};
      const asset = toText(item.asset ?? item.Asset);
      const previous = fallbackMap.get(asset);

      return {
        asset,
        thesis: toText(item.thesis ?? item["Current Thesis"], previous?.thesis),
        whyHold: toText(item.whyHold ?? item["Why I Hold It"], previous?.whyHold),
        expect: toText(item.expect ?? item["What I Expect"], previous?.expect),
        nextAction: toText(item.nextAction ?? item["Next Action"], previous?.nextAction),
        reviewTrigger: toText(item.reviewTrigger ?? item["Review Trigger"], previous?.reviewTrigger),
        status: toText(item.status ?? item.Status, previous?.status),
      };
    })
    .filter((item) => item.asset);

  return normalized.length ? normalized : fallback;
}

export function normalizeScenarios(
  scenarios: unknown,
  fallback: ScenarioCard[]
): ScenarioCard[] {
  if (!Array.isArray(scenarios)) return fallback;

  const fallbackMap = byAsset(fallback);
  const normalized = scenarios
    .map((rawItem) => {
      const item = isRecord(rawItem) ? rawItem : {};
      const asset = toText(item.asset ?? item.Asset);
      const previous = fallbackMap.get(asset);

      return {
        asset,
        base: toText(item.base ?? item["Base Case"], previous?.base),
        bull: toText(item.bull ?? item["Bull Case"], previous?.bull),
        bear: toText(item.bear ?? item["Bear Case"], previous?.bear),
        action: toText(item.action ?? item["Action Zone"], previous?.action),
        invalidation: toText(item.invalidation ?? item.Invalidation, previous?.invalidation),
        status: toText(item.status ?? item.Status, previous?.status),
      };
    })
    .filter((item) => item.asset);

  return normalized.length ? normalized : fallback;
}
