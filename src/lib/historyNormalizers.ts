import type { PortfolioHistoryPoint } from "../types/portfolio";
import { toNumber, toRatio } from "./portfolioNormalizers";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toDateString = (value: unknown) => String(value ?? "").trim();

const normalizeHistoryNumberString = (value: string) =>
  value
    .trim()
    .replace(/\s/g, "")
    .replace("$", "")
    .replace("%", "")
    .replace(",", ".");

const toHistoryNumber = (value: unknown, fallback = 0) => {
  if (typeof value !== "string") return toNumber(value, fallback);

  const parsed = Number(normalizeHistoryNumberString(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toHistoryRatio = (value: unknown, fallback = 0) => {
  if (typeof value !== "string") return toRatio(value, fallback);

  const parsed = toHistoryNumber(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.abs(parsed) > 1 || value.includes("%") ? parsed / 100 : parsed;
};

export function normalizeHistory(
  history: unknown,
  fallback: PortfolioHistoryPoint[]
): PortfolioHistoryPoint[] {
  if (!Array.isArray(history)) return fallback;

  return history
    .map((rawItem) => {
      const item = isRecord(rawItem) ? rawItem : {};

      return {
        date: toDateString(item.date ?? item["Дата"]),
        portfolioValue: toHistoryNumber(item.portfolioValue ?? item["Стоимость портфеля"]),
        invested: toHistoryNumber(item.invested ?? item["Вложено"]),
        pnl: toHistoryNumber(item.pnl ?? item["PnL $"]),
        pnlPct: toHistoryRatio(item.pnlPct ?? item["PnL %"]),
        reserve: toHistoryNumber(item.reserve ?? item["Резерв"]),
        positionsCount: toHistoryNumber(item.positionsCount ?? item["Кол-во позиций"]),
        pointType: String(item.pointType ?? item["Тип точки"] ?? ""),
        note: String(item.note ?? item["Заметка"] ?? ""),
        trigger: String(item.trigger ?? item["Триггер"] ?? ""),
        source: String(item.source ?? item["Источник"] ?? ""),
        comment: String(item.comment ?? item["Комментарий"] ?? ""),
      };
    })
    .filter((item) => item.date && item.portfolioValue > 0);
}
