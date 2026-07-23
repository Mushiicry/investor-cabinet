import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_SINGLE_RISK_ASSET_SHARE,
  RESERVE_TARGET_SHARE,
} from "../../config/riskRules";
import type { PortfolioHealth } from "../../lib/portfolioHealth";
import type { InterestSignal } from "../../types/portfolio";
import type { V2LabData } from "../InvestorCabinetV2Lab";
import { isEmptyAccount } from "./accountState";
import { altcoinSlots, CRYPTO_ALT_LIMIT } from "./preTradeGate";
import { assessSignal, getSignalDistance, sortBySignalPriority } from "./interestSignals";

export const CRYPTO_CATEGORIES = new Set(["Крипта", "Crypto"]);

/** Кэш и стейблы: лимит на размер РИСКОВОЙ позиции к ним не применяется. */
const CASH_CATEGORIES = new Set(["Свободные деньги", "Стейблы", "Cash"]);

export type AlertLevel = "critical" | "warning" | "info";

export type Alert = {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  action?: string;
  priority?: number;
};

export type AlertContext = {
  portfolio: V2LabData["portfolio"];
  positions: V2LabData["positions"];
  allocation: V2LabData["allocation"];
  currentFG: number;
  /** Нужен для тревог по здоровью портфеля — панель уведомлений его передаёт. */
  health?: PortfolioHealth;
  /** Ценовые точки из листа «Сигналы» — близкие и сработавшие. */
  interestSignals?: InterestSignal[];
  /** Предыдущий Health Factor (с прошлого визита) — для тревоги о снижении. */
  previousHealthFactor?: number | null;
};

const toPercent = (share: number) => share * 100;

/**
 * Единый источник тревог портфеля: и страница «Сигналы», и панель уведомлений
 * считают по нему, чтобы счётчик на колокольчике и список на странице
 * не расходились.
 */
export function buildPortfolioAlerts(ctx: AlertContext): Alert[] {
  const { portfolio, positions, allocation, currentFG } = ctx;
  const alerts: Alert[] = [];

  // Пустой аккаунт (кошельки ещё не подключены): нули — это не «критичный риск»,
  // а отсутствие данных. Не генерим тревожные сигналы для пустого портфеля.
  if (isEmptyAccount(portfolio)) {
    return alerts;
  }

  // 1. Резерв
  const reservePct = portfolio.reserveShare * 100;
  if (portfolio.stableReserve < portfolio.totalPortfolioValue * 0.05) {
    alerts.push({
      id: "reserve-critical",
      level: "critical",
      title: "Нет резерва",
      detail: `${portfolio.stableReserve.toFixed(0)}$ · цель ${(RESERVE_TARGET_SHARE * 100).toFixed(0)}% (${(portfolio.totalPortfolioValue * RESERVE_TARGET_SHARE).toFixed(0)}$)`,
      action: "Вывести часть прибыли в резерв",
    });
  } else if (reservePct < 20) {
    alerts.push({
      id: "reserve-low",
      level: "warning",
      title: "Резерв низкий",
      detail: `${reservePct.toFixed(0)}% портфеля · цель ${(RESERVE_TARGET_SHARE * 100).toFixed(0)}%`,
    });
  }

  // 2. Крипта > 60% портфеля
  const cryptoAlloc = allocation.find((a) => a.name === "Крипта" || a.name === "Crypto");
  if (cryptoAlloc) {
    const cryptoPct = toPercent(cryptoAlloc.share);
    const cryptoLimitPct = toPercent(MAX_CRYPTO_EXPOSURE_SHARE);
    if (cryptoAlloc.share > MAX_CRYPTO_EXPOSURE_SHARE + 0.1) {
      alerts.push({
        id: "crypto-critical",
        level: "critical",
        title: "Крипта сильно превышает лимит",
        detail: `${cryptoPct.toFixed(1)}% при лимите ${cryptoLimitPct.toFixed(0)}%`,
      });
    } else if (cryptoAlloc.share > MAX_CRYPTO_EXPOSURE_SHARE) {
      alerts.push({
        id: "crypto-warn",
        level: "warning",
        title: "Крипта выше лимита",
        detail: `${cryptoPct.toFixed(1)}% · лимит ${cryptoLimitPct.toFixed(0)}%`,
      });
    }
  }

  // 3. Перевес отдельной позиции — любой актив у своего лимита, не только ETH.
  const positionLimitPct = toPercent(MAX_SINGLE_RISK_ASSET_SHARE);
  positions.forEach((position) => {
    if (!portfolio.totalPortfolioValue) return;
    // Резерв в стейблах — это подушка, а не перевес: чем его больше, тем спокойнее.
    if (CASH_CATEGORIES.has(position.category)) return;
    const share = (position.value / portfolio.totalPortfolioValue) * 100;
    if (share > positionLimitPct) {
      alerts.push({
        id: `position-over-${position.asset}`,
        level: "critical",
        title: `${position.asset} выше лимита позиции`,
        detail: `${share.toFixed(1)}% портфеля при лимите ${positionLimitPct.toFixed(0)}%`,
        action: "Сократить позицию",
      });
    } else if (share > positionLimitPct - 1) {
      alerts.push({
        id: `position-limit-${position.asset}`,
        level: "warning",
        title: `${position.asset} на лимите позиции`,
        detail: `${share.toFixed(1)}% из ${positionLimitPct.toFixed(0)}% допустимых`,
      });
    }
  });

  // 4. Мало стейблов на споте
  const freeAlloc = allocation.find((a) =>
    a.name === "Свободные деньги" || a.name === "Стейблы" || a.name === "Cash",
  );
  const freePct = freeAlloc
    ? toPercent(freeAlloc.share)
    : (portfolio.stableReserve / portfolio.totalPortfolioValue) * 100;
  if (freePct < 8 && freePct > 0) {
    alerts.push({
      id: "stables-low",
      level: "warning",
      title: "Мало стейблов для откупа",
      detail: `${freePct.toFixed(1)}% на споте · недостаточно для усреднения`,
      action: "Пополнить резерв",
    });
  } else if (freePct === 0 || portfolio.stableReserve === 0) {
    alerts.push({
      id: "stables-zero",
      level: "critical",
      title: "Нет стейблов на споте",
      detail: "Невозможно откупить просадку",
      action: "Срочно пополнить",
    });
  }

  // 5. Здоровье портфеля: и абсолютный уровень, и просевшие компоненты.
  if (ctx.health) {
    const hf = ctx.health.healthFactor;
    if (hf < 40) {
      alerts.push({
        id: "health-critical",
        level: "critical",
        title: "Здоровье портфеля в красной зоне",
        detail: `Health Factor ${Math.round(hf)} из 100`,
        action: "Открыть разбор здоровья",
      });
    } else if (hf < 60) {
      alerts.push({
        id: "health-warn",
        level: "warning",
        title: "Здоровье портфеля ниже нормы",
        detail: `Health Factor ${Math.round(hf)} из 100`,
      });
    }

    // Снижение относительно прошлого визита — то, что легко пропустить.
    const previous = ctx.previousHealthFactor;
    if (previous != null && previous - hf >= 5) {
      alerts.push({
        id: "health-drop",
        level: "warning",
        title: "Health Factor снизился",
        detail: `${Math.round(previous)} → ${Math.round(hf)} со времени прошлого захода`,
      });
    }

    ctx.health.components
      .filter((component) => component.score < 35)
      .forEach((component) => {
        alerts.push({
          id: `health-component-${component.key}`,
          level: "warning",
          title: `${component.label}: ${Math.round(component.score)}`,
          detail: "Компонент здоровья в зоне риска",
        });
      });
  }

  // 6. Ценовые точки из листа «Сигналы».
  if (ctx.interestSignals?.length) {
    const ordered = sortBySignalPriority(ctx.interestSignals);

    ordered.slice(0, 5).forEach((signal) => {
      const assessment = assessSignal(signal);
      const distance = getSignalDistance(signal);
      const pct = distance ? ` · осталось ${Math.abs(distance.pct).toFixed(1)}%` : "";

      if (assessment.priority === "сработал") {
        alerts.push({
          id: `signal-triggered-${signal.id}`,
          level: "critical",
          title: `${signal.asset}: точка сработала`,
          detail: `${signal.action} на ${signal.amountUsd}$ при ${signal.triggerPrice}. ${assessment.text}`,
          action: "Открыть проверку риска",
          priority: assessment.priorityRank,
        });
      }

      if (assessment.priority === "близко") {
        alerts.push({
          id: `signal-near-${signal.id}`,
          level: "warning",
          title: `${signal.asset} рядом с уровнем`,
          detail: `${signal.action} при ${signal.triggerPrice}${pct}. ${assessment.text}`,
          action: "Открыть проверку риска",
          priority: assessment.priorityRank,
        });
      }

      if (assessment.priority === "сломано" || assessment.priority === "устарел") {
        alerts.push({
          id: `signal-${assessment.priority}-${signal.id}`,
          level: "warning",
          title: `${signal.asset}: сигнал требует проверки`,
          detail: assessment.text,
          priority: assessment.priorityRank,
        });
      }
    });
  }

  // 7. Зона страха — окно покупки
  if (currentFG <= 14) {
    alerts.push({
      id: "fg-max",
      level: "info",
      title: "Экстремальный страх — максимум",
      detail: `F&G ${currentFG} · зона агрессивной покупки`,
      action: "Открыть стратегию",
    });
  } else if (currentFG <= 19) {
    alerts.push({
      id: "fg-strong",
      level: "info",
      title: "Зона страха — усиленная покупка",
      detail: `F&G ${currentFG} · исторически выгодная зона`,
      action: "Открыть стратегию",
    });
  }

  // 8. Альткоин-места. Мажоры (BTC/ETH/SOL/TON/BNB) занимают 85% крипто-блока,
  // на альткоины по 5% остаётся 3 места. Напоминаем, сколько свободно.
  const cryptoAssets = positions
    .filter((p) => CRYPTO_CATEGORIES.has(p.category))
    .map((p) => p.asset);
  const slots = altcoinSlots(cryptoAssets);
  if (slots.used > 0 || slots.free < slots.total) {
    if (slots.free === 0) {
      alerts.push({
        id: "altcoins-full",
        level: "warning",
        title: "Нет места для новых альткоинов",
        detail: `Занято ${slots.used}/${slots.total} (${slots.altcoins.join(", ")}). Лимит ${toPercent(CRYPTO_ALT_LIMIT).toFixed(0)}% на альт.`,
        action: "Новый альт — только вместо старого",
      });
    } else {
      alerts.push({
        id: "altcoins-slots",
        level: "info",
        title: `Альткоины: свободно ${slots.free} из ${slots.total}`,
        detail: `Занято: ${slots.altcoins.join(", ") || "—"}. Мажоры (BTC/ETH/SOL/TON/BNB) — вне счёта.`,
      });
    }
  }

  return alerts;
}

/** Порядок показа: сначала то, что требует действия сегодня. */
const LEVEL_ORDER: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };

export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const levelDiff = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
    if (levelDiff !== 0) return levelDiff;
    return (a.priority ?? 100) - (b.priority ?? 100);
  });
}

export function topAlerts(alerts: Alert[], limit = 5): Alert[] {
  return sortAlerts(alerts).slice(0, limit);
}
