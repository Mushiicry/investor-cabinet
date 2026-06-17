import { assetRarity, cardNumbers } from "./uiHelpers";
import type { CardRarity } from "./uiHelpers";
import type { Decision, ScenarioCard } from "../types/portfolio";

const orderedAssets = [
  "USDT",
  "GOLD LONG",
  "BTC",
  "ETH",
  "BNB",
  "TON",
  "SOL",
  "ATOM",
  "TIA",
  "MNT",
  "BTC SHORT",
  "APEX",
];

const riskOrder: Record<string, number> = Object.fromEntries(
  orderedAssets.map((asset, index) => [asset, index])
);

export type PlaybookCard = {
  asset: string;
  status: string;
  rarity: CardRarity;
  attack: number;
  risk: number;
  rarityTitle: string;
  thesis: string;
  whyHold: string;
  expect: string;
  nextAction: string;
  reviewTrigger: string;
  base: string;
  bull: string;
  bear: string;
  action: string;
  invalidation: string;
};

export function buildPlaybookCards(
  decisions: Decision[],
  scenarios: ScenarioCard[]
): PlaybookCard[] {
  const scenarioMap = new Map(scenarios.map((item) => [item.asset, item]));

  return decisions
    .map((decision) => {
      const scenario = scenarioMap.get(decision.asset);
      const numbers = cardNumbers(decision.asset);

      return {
        asset: decision.asset,
        status: decision.status,
        rarity: assetRarity(decision.asset),
        attack: numbers.attack,
        risk: numbers.risk,
        rarityTitle: numbers.title,
        thesis: decision.thesis,
        whyHold: decision.whyHold,
        expect: decision.expect,
        nextAction: decision.nextAction,
        reviewTrigger: decision.reviewTrigger,
        base: scenario?.base ?? "Базовый сценарий не задан.",
        bull: scenario?.bull ?? "Сценарий роста не задан.",
        bear: scenario?.bear ?? "Сценарий снижения не задан.",
        action: scenario?.action ?? decision.nextAction,
        invalidation: scenario?.invalidation ?? decision.reviewTrigger,
      };
    })
    .sort((a, b) => {
      const aOrder = riskOrder[a.asset] ?? 999;
      const bOrder = riskOrder[b.asset] ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      if (a.risk !== b.risk) return a.risk - b.risk;
      return a.asset.localeCompare(b.asset);
    });
}
