// Лестница уровней инвестора — единая точка геймификации.
// Через неё проходят достижения, выполненные рекомендации и денежные поощрения.
//
// Логика наград (решение владельца): за переход на уровень инвестор выводит
// себе фиксированную сумму ИЗ КРИПТЫ — не обратно в рынок, а «на себя».
// Это ритуал фиксации прогресса, а не реинвест.
//
// Опыт = health factor: уровень открывается, когда здоровье портфеля держится
// выше порога. Дисциплина растит уровень, а не объём торговли (конституция).
// Достигнутый уровень не сгорает — см. levelProgress.ts.

import type { PortfolioHealth } from "../../lib/portfolioHealth";
import type { InvestorTransaction } from "../../types/portfolio";
import type { V2Portfolio, V2Position } from "../InvestorCabinetV2Lab";

export type LadderAchievement = {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
};

/** Всё, из чего считаются задания. positions/transactions опциональны. */
export type AchievementContext = {
  health: PortfolioHealth;
  portfolio: V2Portfolio;
  positions?: V2Position[];
  transactions?: InvestorTransaction[];
};

const isSell = (action: string) => /продаж/i.test(action ?? "");

/**
 * 25 заданий: 5 на уровень, с нарастанием сложности.
 * Типы намеренно разные — структура портфеля, дисциплина риска, размер
 * капитала, торговый результат. Один тип не должен закрывать весь уровень.
 */
export function getAchievements(ctx: AchievementContext): LadderAchievement[] {
  const { health, portfolio, positions = [], transactions = [] } = ctx;
  const score = (key: string) => health.components.find((c) => c.key === key)?.score ?? 0;

  const hf = health.healthFactor;
  const posCount = portfolio.positionsCount ?? 0;
  const value = portfolio.totalPortfolioValue ?? 0;
  const realized = portfolio.realizedPnlUsd ?? 0;
  const closedTrades = transactions.filter((t) => isSell(t.action)).length;
  const bestOpenPnlPct = positions.reduce((best, p) => Math.max(best, p.pnlPct ?? 0), 0);
  const statsAbove70 = health.components.filter((c) => c.score >= 70).length;

  const num = (id: string, name: string, desc: string, progress: number, target: number): LadderAchievement => ({
    id, name, desc, progress, target, unlocked: progress >= target,
  });

  return [
    // ── LVL 1: собрать основу ──
    num("pos3", "Портфель собран", "3+ позиции в работе", posCount, 3),
    num("reserve50", "Подушка заложена", "Резерв не ниже 50", score("reserve"), 50),
    num("value300", "Первые $300", "Портфель дороже $300", value, 300),
    num("flex40", "Запас манёвра", "Гибкость не ниже 40", score("flexibility"), 40),
    num("hf40", "Система запущена", "Здоровье портфеля выше 40", hf, 40),

    // ── LVL 2: дисциплина ──
    num("pos5", "Диверсифицирован", "5+ позиций в работе", posCount, 5),
    num("reserve70", "Хранитель резерва", "Резерв не ниже 70", score("reserve"), 70),
    num("value500", "Рубеж $500", "Портфель дороже $500", value, 500),
    num("flex60", "Гибкий капитал", "Гибкость не ниже 60", score("flexibility"), 60),
    num("trade1", "Первая фиксация", "Закрыта хотя бы одна сделка", closedTrades, 1),

    // ── LVL 3: контроль риска ──
    num("futures70", "Фьючерсы под контролем", "Спекулятивный бюджет и плечо в норме", score("futures"), 70),
    num("conc60", "Лимиты соблюдаются", "Концентрация не ниже 60", score("concentration"), 60),
    num("hf60", "Портфель окреп", "Здоровье портфеля выше 60", hf, 60),
    num("move10", "Взял движение", "Позиция в плюсе на 10%+", Math.round(bestOpenPnlPct), 10),
    num("trade3", "Рука набита", "3+ закрытых сделки", closedTrades, 3),

    // ── LVL 4: здоровье и лимиты ──
    num("hf75", "Страж портфеля", "Здоровье портфеля выше 75", hf, 75),
    num("conc80", "Дисциплина лимитов", "Ни один актив не выше своего лимита", score("concentration"), 80),
    num("value1000", "Рубеж $1000", "Портфель дороже $1000", value, 1000),
    num("realized50", "Прибыль зафиксирована", "Реализовано $50+", Math.round(realized), 50),
    num("div50", "Разложен по классам", "Диверсификация не ниже 50", score("diversification"), 50),

    // ── LVL 5: мастерство ──
    num("hf90", "Мастер здоровья", "Здоровье портфеля выше 90", hf, 90),
    num("div70", "Диверсификатор", "Диверсификация не ниже 70", score("diversification"), 70),
    num("allStats", "Всё под контролем", "5+ характеристик не ниже 70", statsAbove70, 5),
    num("realized150", "Капитал работает", "Реализовано $150+", Math.round(realized), 150),
    num("trade10", "Опытный трейдер", "10+ закрытых сделок", closedTrades, 10),
  ];
}

type LadderStep = {
  level: number;
  title: string;
  /** Порог health factor для входа на уровень. */
  hfFrom: number;
  /** Денежное поощрение за достижение уровня, $ (выводится из крипты «на себя»). */
  rewardUsd: number;
  /** Пять заданий уровня. */
  achievementIds: string[];
  /** Короткая формулировка смысла уровня. */
  focus: string;
};

// Пять уровней — договорённая глубина. Пороги совпадают с LEVEL_THRESHOLDS.
export const LEVEL_LADDER: LadderStep[] = [
  {
    level: 1,
    title: "Ученик",
    hfFrom: 0,
    rewardUsd: 0,
    achievementIds: ["pos3", "reserve50", "value300", "flex40", "hf40"],
    focus: "Собрать основу — резерв важнее доходности",
  },
  {
    level: 2,
    title: "Оператор",
    hfFrom: 40,
    rewardUsd: 10,
    achievementIds: ["pos5", "reserve70", "value500", "flex60", "trade1"],
    focus: "Дисциплина: запас манёвра и первая фиксация",
  },
  {
    level: 3,
    title: "Аналитик",
    hfFrom: 60,
    rewardUsd: 20,
    achievementIds: ["futures70", "conc60", "hf60", "move10", "trade3"],
    focus: "Контроль риска и умение взять движение",
  },
  {
    level: 4,
    title: "Исследователь",
    hfFrom: 75,
    rewardUsd: 35,
    achievementIds: ["hf75", "conc80", "value1000", "realized50", "div50"],
    focus: "Портфель здоров, лимиты не пробиты, прибыль зафиксирована",
  },
  {
    level: 5,
    title: "Планировщик",
    hfFrom: 90,
    rewardUsd: 50,
    achievementIds: ["hf90", "div70", "allStats", "realized150", "trade10"],
    focus: "Мастерство: капитал разложен и работает",
  },
];

export const MAX_LADDER_LEVEL = LEVEL_LADDER.length;

export type LevelCardStatus = "done" | "current" | "locked";

export type LevelCard = {
  level: number;
  title: string;
  focus: string;
  status: LevelCardStatus;
  hfFrom: number;
  /** Порог следующего уровня (для последнего — 100). */
  hfTo: number;
  /** Заработанный опыт внутри уровня (для текущего). */
  xpCurrent: number;
  xpMax: number;
  progressPct: number;
  rewardUsd: number;
  achievements: LadderAchievement[];
  /** Сколько заданий уровня закрыто. */
  doneCount: number;
  /** Сколько ещё пунктов здоровья до следующего уровня. */
  hfToNext: number;
  /**
   * true — здоровье просело ниже порога текущего уровня: опыт обнулён,
   * но сам уровень сохранён (награда не отбирается).
   */
  xpDrained: boolean;
};

/** Текущий уровень по health factor (1..5). */
export function currentLadderLevel(healthFactor: number): number {
  let lvl = 1;
  for (const step of LEVEL_LADDER) {
    if (healthFactor >= step.hfFrom) lvl = step.level;
  }
  return lvl;
}

/**
 * Карточки всех уровней с состоянием: пройден / вы здесь / заблокирован.
 * Прогресс внутри уровня = health factor между порогами.
 * maxLevelReached не даёт уровню откатиться при просадке здоровья.
 */
export function buildLevelCards(
  ctx: AchievementContext,
  maxLevelReached = 1,
): LevelCard[] {
  const hf = ctx.health.healthFactor;
  const all = getAchievements(ctx);
  // Уровень не откатывается: берём максимум из достигнутого ранее и текущего.
  const current = Math.max(currentLadderLevel(hf), Math.max(1, maxLevelReached));

  return LEVEL_LADDER.map((step, idx) => {
    const next = LEVEL_LADDER[idx + 1];
    const hfTo = next ? next.hfFrom : 100;
    const status: LevelCardStatus =
      step.level < current ? "done" : step.level === current ? "current" : "locked";

    const span = Math.max(hfTo - step.hfFrom, 1);
    // Опыт внутри текущего уровня живёт по фактическому здоровью и МОЖЕТ убывать.
    // Если здоровье упало ниже порога уровня — опыт 0, но уровень остаётся.
    const xpCurrent =
      status === "done" ? span : status === "current" ? Math.max(0, Math.min(hf - step.hfFrom, span)) : 0;
    const achievements = all.filter((a) => step.achievementIds.includes(a.id));

    return {
      level: step.level,
      title: step.title,
      focus: step.focus,
      status,
      hfFrom: step.hfFrom,
      hfTo,
      xpCurrent: Math.round(xpCurrent),
      xpMax: span,
      progressPct: Math.round((xpCurrent / span) * 100),
      rewardUsd: step.rewardUsd,
      achievements,
      doneCount: achievements.filter((a) => a.unlocked).length,
      hfToNext: Math.max(0, Math.round(hfTo - hf)),
      xpDrained: status === "current" && hf < step.hfFrom,
    };
  });
}
