import type { DataSyncStatus } from "../../types/dataStatus";
import type { InterestSignal } from "../../types/portfolio";
import { assessSignal } from "./interestSignals";

export type TradingDataSource = "cache" | "fallback" | "live";
export type DataTrustState = "trusted" | "refreshing" | "manual" | "blocked";

export type TradingDataStatus = {
  source: TradingDataSource;
  status: DataSyncStatus;
  lastLoadedAt: string | null;
  error: string | null;
};

export type DataTrustFact = {
  id: "portfolio" | "price" | "signal";
  label: string;
  source: string;
  updatedAt: string | null;
  state: DataTrustState;
  note: string;
};

export type TradingDataTrust = {
  accountId: "main" | "wife";
  state: "trusted" | "refreshing" | "blocked";
  canCreateDecision: boolean;
  title: string;
  blockers: string[];
  facts: DataTrustFact[];
};

type Input = {
  accountId: "main" | "wife";
  portfolioStatus?: TradingDataStatus | null;
  portfolioUpdatedAt?: string | null;
  signal?: InterestSignal | null;
  expectsSignal: boolean;
  now?: Date;
};

const PORTFOLIO_MAX_AGE_MS = 2 * 60 * 1000;

const sourceLabel = (source: TradingDataSource, accountId: "main" | "wife") => {
  if (source === "live") {
    return accountId === "wife"
      ? "Google Sheets · Apps Script API + wallet proxy"
      : "Google Sheets · Apps Script API";
  }
  if (source === "cache") return "Локальный кэш последней загрузки";
  return "Fallback / демонстрационные данные";
};

const parseTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function buildTradingDataTrust({
  accountId,
  portfolioStatus,
  portfolioUpdatedAt,
  signal,
  expectsSignal,
  now = new Date(),
}: Input): TradingDataTrust {
  const blockers: string[] = [];
  const portfolioTime = portfolioUpdatedAt || portfolioStatus?.lastLoadedAt || null;
  const parsedPortfolioTime = parseTime(portfolioTime);
  const portfolioAge = parsedPortfolioTime === null
    ? null
    : Math.max(0, now.getTime() - parsedPortfolioTime);

  let portfolioState: DataTrustState = "blocked";
  let portfolioNote = "Статус портфельных данных отсутствует.";

  if (!portfolioStatus) {
    blockers.push("Нет подтверждённого статуса портфельных данных.");
  } else if (portfolioStatus.source !== "live") {
    portfolioNote = portfolioStatus.source === "cache"
      ? "Кэш можно анализировать, но нельзя использовать для нового решения."
      : "Fallback-данные не являются фактами текущего портфеля.";
    blockers.push(portfolioNote);
  } else if (["stale", "error", "initial-loading"].includes(portfolioStatus.status)) {
    portfolioNote = portfolioStatus.error || "Портфельные данные не подтверждены текущей загрузкой.";
    blockers.push("Портфельные данные устарели или не загрузились.");
  } else if (portfolioAge === null) {
    portfolioNote = "У источника нет подтверждённого времени обновления.";
    blockers.push(portfolioNote);
  } else if (portfolioAge > PORTFOLIO_MAX_AGE_MS) {
    portfolioNote = "Последнее подтверждённое обновление старше 2 минут.";
    blockers.push(portfolioNote);
  } else {
    portfolioState = portfolioStatus.status === "refreshing" ? "refreshing" : "trusted";
    portfolioNote = portfolioState === "refreshing"
      ? "Свежий подтверждённый снимок; параллельно идёт обновление."
      : "Портфель подтверждён текущей загрузкой.";
  }

  let signalFact: DataTrustFact;
  let priceFact: DataTrustFact;

  if (!expectsSignal) {
    signalFact = {
      id: "signal",
      label: "Сигнал",
      source: "Ручная идея",
      updatedAt: null,
      state: "manual",
      note: "Сигнал не используется; тезис вводится вручную.",
    };
    priceFact = {
      id: "price",
      label: "Цена",
      source: "Ручной ввод",
      updatedAt: null,
      state: "manual",
      note: "Цена и сумма должны быть подтверждены чекбоксом перед сохранением.",
    };
  } else if (!signal) {
    const missingSignal = "Связанный сигнал не найден в текущих данных.";
    blockers.push(missingSignal);
    signalFact = {
      id: "signal",
      label: "Сигнал",
      source: "Недоступен",
      updatedAt: null,
      state: "blocked",
      note: missingSignal,
    };
    priceFact = {
      id: "price",
      label: "Цена",
      source: "Недоступна",
      updatedAt: null,
      state: "blocked",
      note: "Нельзя подтвердить источник цены без исходного сигнала.",
    };
  } else {
    const assessment = assessSignal(signal, now);
    const signalBroken = assessment.priority === "сломано";
    const signalStale = assessment.freshness !== "свежий";
    const priceMissing = !Number.isFinite(signal.currentPrice) || signal.currentPrice <= 0;
    const signalBlocked = signalBroken || signalStale || priceMissing;
    const signalSource = signal.source || "Google Sheets · Сигналы";
    const signalNote = signalBroken
      ? "Сигнал помечен как требующий проверки или содержит ошибку."
      : signalStale
        ? "Цена сигнала не обновлялась в допустимом интервале 15 минут."
        : priceMissing
          ? "У сигнала отсутствует текущая цена."
          : "Сигнал и текущая цена подтверждены свежей проверкой.";

    if (signalBlocked) blockers.push(signalNote);
    signalFact = {
      id: "signal",
      label: "Сигнал",
      source: signalSource,
      updatedAt: signal.lastCheck || signal.triggeredAt || null,
      state: signalBlocked ? "blocked" : "trusted",
      note: signalNote,
    };
    priceFact = {
      id: "price",
      label: "Цена",
      source: signalSource,
      updatedAt: signal.lastCheck || null,
      state: signalBlocked ? "blocked" : "trusted",
      note: priceMissing ? "Текущая цена отсутствует." : `Текущая цена: ${signal.currentPrice}.`,
    };
  }

  const canCreateDecision = blockers.length === 0;
  const state = canCreateDecision
    ? portfolioState === "refreshing" ? "refreshing" : "trusted"
    : "blocked";

  return {
    accountId,
    state,
    canCreateDecision,
    title: canCreateDecision ? "Данные подтверждены" : "Новое решение заблокировано",
    blockers,
    facts: [
      {
        id: "portfolio",
        label: "Портфель",
        source: portfolioStatus ? sourceLabel(portfolioStatus.source, accountId) : "Статус отсутствует",
        updatedAt: portfolioTime,
        state: portfolioState,
        note: portfolioNote,
      },
      priceFact,
      signalFact,
    ],
  };
}
