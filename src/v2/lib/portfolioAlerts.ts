import { MAX_SINGLE_RISK_ASSET_SHARE } from "../../config/riskRules";
import type { PortfolioHealth } from "../../lib/portfolioHealth";
import type { InterestSignal } from "../../types/portfolio";
import type { V2LabData } from "../InvestorCabinetV2Lab";
import { isEmptyAccount } from "./accountState";
import {
  MAIN_INVESTOR_STRATEGY,
  assetLimitForStrategy,
  type InvestorStrategy,
} from "./investorStrategy";
import type { MarketPsychology } from "./marketPsychology";
import { altcoinSlots, CRYPTO_ALT_LIMIT } from "./preTradeGate";
import {
  actionableLimitSignalsSummary,
  assessSignal,
  buildSignalNotificationPlan,
  getSignalDistance,
  sortBySignalPriority,
  type SignalNotificationPolicyOptions,
} from "./interestSignals";

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
  /** Рыночная психология — общий макро-фильтр перед новой сделкой. */
  marketPsychology?: Pick<MarketPsychology, "emotion" | "gate" | "stanceLabel">;
  /** Правила напоминаний: дневной лимит, повтор и дисциплинарная пауза. */
  signalNotification?: SignalNotificationPolicyOptions;
  /** Предыдущий Health Factor (с прошлого визита) — для тревоги о снижении. */
  previousHealthFactor?: number | null;
  strategy?: InvestorStrategy;
};

const toPercent = (share: number) => share * 100;
const fmtAlertUsd = (value: number) =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Единый источник тревог портфеля: и страница «Сигналы», и панель уведомлений
 * считают по нему, чтобы счётчик на колокольчике и список на странице
 * не расходились.
 */
export function buildPortfolioAlerts(ctx: AlertContext): Alert[] {
  const { portfolio, positions, allocation, currentFG } = ctx;
  const strategy = ctx.strategy ?? MAIN_INVESTOR_STRATEGY;
  const alerts: Alert[] = [];
  const marketPsychology = ctx.marketPsychology;

  // Пустой аккаунт (кошельки ещё не подключены): нули — это не «критичный риск»,
  // а отсутствие данных. Не генерим тревожные сигналы для пустого портфеля.
  if (isEmptyAccount(portfolio)) {
    return alerts;
  }

  // 1. Резерв
  const reserveBaseUsd = portfolio.totalInvested > 0 ? portfolio.totalInvested : portfolio.totalPortfolioValue;
  const reservePct = reserveBaseUsd > 0 ? (portfolio.stableReserve / reserveBaseUsd) * 100 : 0;
  const reserveFloorUsd = reserveBaseUsd * strategy.reserveFloorShare;
  const reserveTargetUsd = reserveBaseUsd * strategy.reserveTargetShare;
  const reserveBandMaxUsd = reserveBaseUsd * strategy.reserveBandMaxShare;
  const reserveTargetPct = toPercent(strategy.reserveTargetShare);
  const reserveBandMaxPct = toPercent(strategy.reserveBandMaxShare);
  if (portfolio.stableReserve < reserveFloorUsd) {
    alerts.push({
      id: "reserve-critical",
      level: "critical",
      title: "Нет резерва",
      detail: `${portfolio.stableReserve.toFixed(0)}$ · цель ${reserveTargetPct.toFixed(0)}% (${reserveTargetUsd.toFixed(0)}$)`,
      action: "Вывести часть прибыли в резерв",
    });
  } else if (reserveBaseUsd > 0 && portfolio.stableReserve / reserveBaseUsd < strategy.reserveTargetShare) {
    alerts.push({
      id: "reserve-low",
      level: "warning",
      title: "Резерв низкий",
      detail: `${reservePct.toFixed(0)}% вложенного капитала · цель ${reserveTargetPct.toFixed(0)}%`,
    });
  } else if (reserveBaseUsd > 0 && portfolio.stableReserve / reserveBaseUsd > strategy.reserveBandMaxShare) {
    const idleUsd = portfolio.stableReserve - reserveBandMaxUsd;
    const marketIsGreedy = ctx.currentFG >= 50;
    alerts.push({
      id: "reserve-idle",
      level: "warning",
      title: `Резерв выше ${reserveBandMaxPct.toFixed(0)}%`,
      detail: marketIsGreedy
        ? `${fmtAlertUsd(idleUsd)} ждёт страх, откат или лимитные зоны`
        : `${fmtAlertUsd(idleUsd)} сверх ${fmtAlertUsd(reserveBandMaxUsd)} простаивает`,
      action: marketIsGreedy ? "Не догонять рост: открыть разбор здоровья" : "Открыть разбор здоровья",
      priority: 12,
    });
  }

  // 2. Крипта выше лимита стратегии
  const cryptoAlloc = allocation.find((a) => a.name === "Крипта" || a.name === "Crypto");
  if (cryptoAlloc) {
    const cryptoPct = toPercent(cryptoAlloc.share);
    const cryptoLimitPct = toPercent(strategy.cryptoMaxShare);
    if (cryptoAlloc.share > strategy.cryptoMaxShare + 0.1) {
      alerts.push({
        id: "crypto-critical",
        level: "critical",
        title: "Крипта сильно превышает лимит",
        detail: `${cryptoPct.toFixed(1)}% при лимите ${cryptoLimitPct.toFixed(0)}%`,
      });
    } else if (cryptoAlloc.share > strategy.cryptoMaxShare) {
      alerts.push({
        id: "crypto-warn",
        level: "warning",
        title: "Крипта выше лимита",
        detail: `${cryptoPct.toFixed(1)}% · лимит ${cryptoLimitPct.toFixed(0)}%`,
      });
    }
  }

  // 3. Перевес отдельной позиции — любой актив у своего лимита, не только ETH.
  positions.forEach((position) => {
    if (!portfolio.totalPortfolioValue) return;
    // Резерв в стейблах — это подушка, а не перевес: чем его больше, тем спокойнее.
    if (CASH_CATEGORIES.has(position.category)) return;
    const isCrypto = position.category === "Крипта";
    const cryptoBase = cryptoAlloc?.value ?? 0;
    const limitBase = isCrypto ? cryptoBase : portfolio.totalPortfolioValue;
    if (limitBase <= 0) return;
    const limitShare =
      isCrypto
        ? assetLimitForStrategy(position.category, position.asset, strategy)
        : assetLimitForStrategy(position.category, position.asset, strategy);
    const normalizedLimitShare = limitShare > 0 ? limitShare : MAX_SINGLE_RISK_ASSET_SHARE;
    const positionLimitPct = toPercent(normalizedLimitShare);
    const portfolioShare = (position.value / portfolio.totalPortfolioValue) * 100;
    const limitBaseShare = (position.value / limitBase) * 100;
    const detail = isCrypto
      ? `${limitBaseShare.toFixed(1)}% крипто-блока при лимите ${positionLimitPct.toFixed(0)}% · в портфеле ${portfolioShare.toFixed(1)}%`
      : `${portfolioShare.toFixed(1)}% портфеля при лимите ${positionLimitPct.toFixed(0)}%`;
    const warningDetail = isCrypto
      ? `${limitBaseShare.toFixed(1)}% из ${positionLimitPct.toFixed(0)}% крипто-блока · в портфеле ${portfolioShare.toFixed(1)}%`
      : `${portfolioShare.toFixed(1)}% из ${positionLimitPct.toFixed(0)}% допустимых`;
    if (limitBaseShare > positionLimitPct) {
      alerts.push({
        id: `position-over-${position.asset}`,
        level: "critical",
        title: `${position.asset} выше лимита позиции`,
        detail,
        action: "Сократить позицию",
      });
    } else if (limitBaseShare > positionLimitPct - 1) {
      alerts.push({
        id: `position-limit-${position.asset}`,
        level: "warning",
        title: `${position.asset} на лимите позиции`,
        detail: warningDetail,
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
        detail: `Здоровье капитала ${Math.round(hf)} из 100`,
        action: "Открыть разбор здоровья",
      });
    } else if (hf < 60) {
      alerts.push({
        id: "health-warn",
        level: "warning",
        title: "Здоровье портфеля ниже нормы",
        detail: `Здоровье капитала ${Math.round(hf)} из 100`,
      });
    }

    // Снижение относительно прошлого визита — то, что легко пропустить.
    const previous = ctx.previousHealthFactor;
    if (previous != null && previous - hf >= 5) {
      alerts.push({
        id: "health-drop",
        level: "warning",
        title: "Здоровье капитала снизилось",
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
    const actionableLimitSignals = actionableLimitSignalsSummary(ctx.interestSignals);
    if (actionableLimitSignals.count > 0) {
      alerts.push({
        id: "exchange-limit-orders-unconfirmed",
        level: "critical",
        title: "Лимитки на бирже не подтверждены",
        detail: `Сайт/TG только напоминают. Активных уровней: ${actionableLimitSignals.count} на ${fmtAlertUsd(actionableLimitSignals.totalUsd)}. До новых действий выставь лимитки вручную или пометь сценарий как ручной.`,
        action: "Поставить лимитки вручную",
        priority: -10,
      });
    }

    const now = new Date();
    const ordered = sortBySignalPriority(ctx.interestSignals, now);
    const notificationPlan = buildSignalNotificationPlan(ctx.interestSignals, now, ctx.signalNotification);
    const notifications = new Map(
      notificationPlan.items.map((item) => [item.signal.id, item.notification])
    );

    ordered.slice(0, 5).forEach((signal) => {
      const assessment = assessSignal(signal, now);
      const notification = notifications.get(signal.id);
      const distance = getSignalDistance(signal);
      const pct = distance ? ` · осталось ${Math.abs(distance.pct).toFixed(1)}%` : "";
      const notificationText = notification ? ` ${notification.text}` : "";
      const action = notification?.status === "пауза" ? undefined : "Открыть проверку риска";

      if (assessment.priority === "сработал") {
        alerts.push({
          id: `signal-triggered-${signal.id}`,
          level: "critical",
          title: `${signal.asset}: точка сработала`,
          detail: `${signal.action} на ${signal.amountUsd}$ при ${signal.triggerPrice}. ${assessment.text}${notificationText}`,
          action,
          priority: assessment.priorityRank,
        });
      }

      if (assessment.priority === "близко") {
        alerts.push({
          id: `signal-near-${signal.id}`,
          level: "warning",
          title: `${signal.asset} рядом с уровнем`,
          detail: `${signal.action} при ${signal.triggerPrice}${pct}. ${assessment.text}${notificationText}`,
          action,
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

  // 7. Макро-фильтр рынка: Market Psychology Engine не даёт сигнал к сделке,
  // а усиливает режим осторожности/блока перед проверкой риска.
  if (marketPsychology?.gate.severity === "block") {
    alerts.push({
      id: "market-psychology-block",
      level: "critical",
      title: `Рынок: ${marketPsychology.emotion}`,
      detail: marketPsychology.gate.text,
      action: marketPsychology.stanceLabel,
    });
  } else if (marketPsychology?.gate.severity === "warning") {
    alerts.push({
      id: "market-psychology-warning",
      level: "warning",
      title: `Рынок: ${marketPsychology.emotion}`,
      detail: marketPsychology.gate.text,
      action: "Открыть проверку риска",
    });
  }

  // 8. Зона страха — окно покупки
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

  // 9. Альткоин-места. Мажоры (BTC/ETH/SOL/TON/BNB) занимают 85% крипто-блока,
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
