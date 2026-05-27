import type { Risk } from "../types/portfolio";
import { round } from "./portfolioCalculations";

export const RISK_BAR_COLORS = ["#63d8ff", "#3ddb72", "#9f57ff", "#f7d64a", "#ff6f8e", "#ff8b2a", "#45c2ff", "#53ea87"];

export const RISK_HEALTH_AXES = [
  { short: "Диверс.", title: "Диверсификация", score: 78, note: "Категории и отсутствие перегруза одним активом.", color: "#d875ff" },
  { short: "Гибкость", title: "Гибкость", score: 95, note: "Запас манёвра и возможность двигать капитал.", color: "#89df18" },
  { short: "Кэш", title: "Покупательская сила", score: 93, note: "Свободные деньги для добора по плану.", color: "#57d1ff" },
  { short: "Фьючи", title: "Фьючерсная дисциплина", score: 70, note: "Малое плечо и небольшой вес фьючерсов.", color: "#ffd42b" },
  { short: "MM", title: "Мани-менеджмент", score: 73, note: "Баланс резерва, риска и размеров позиций.", color: "#ff7288" },
];

export function buildRiskMarketBars(risk: Risk) {
  return [
    { name: "Доллары", value: round(risk.cashShare * 100, 1), color: "#63d8ff", order: 0 },
    { name: "Спот крипта", value: round(risk.cryptoShare * 100, 1), color: "#53ea87", order: 1 },
    { name: "Фьючерсы", value: round(risk.futuresShare * 100, 1), color: "#ff9a3c", order: 2 },
    { name: "Металлы", value: round(risk.metalsShare * 100, 1), color: "#f7d64a", order: 3 },
    { name: "Акции", value: round(risk.stocksShare * 100, 1), color: "#8b9bb8", order: 4 },
    { name: "Валюта", value: 0, color: "#9f57ff", order: 5 },
  ].sort((a, b) => (b.value - a.value) || (a.order - b.order));
}

export function getRiskHealthSummary(healthScore: number): string {
  if (healthScore >= 80) {
    return `При текущей оценке ${healthScore} портфель выглядит защищённым: запас кэша высокий, структура не перегружена, пространство для добора сохраняется.`;
  }

  if (healthScore >= 60) {
    return `При текущей оценке ${healthScore} портфель выглядит сбалансированным, но запас манёвра уже нужно расходовать только по плану.`;
  }

  return `При текущей оценке ${healthScore} приоритетом остаётся защита: новые входы требуют строгого отбора и контроля размера позиции.`;
}

export function getHealthTone(health: number): "cyan" | "violet" {
  return health >= 0.6 ? "cyan" : "violet";
}
