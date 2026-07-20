// Лестница уровней инвестора — единая точка геймификации.
// Через неё проходят достижения, выполненные рекомендации и денежные поощрения.
//
// Логика наград (решение владельца): за переход на уровень инвестор выводит
// себе фиксированную сумму ИЗ КРИПТЫ — не обратно в рынок, а «на себя».
// Это ритуал фиксации прогресса, а не реинвест.
//
// Опыт = health factor: уровень открывается, когда здоровье портфеля держится
// выше порога. Дисциплина растит уровень, а не объём торговли (конституция).

import type { PortfolioHealth } from "../../lib/portfolioHealth";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

export type LadderAchievement = {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
};

/** Достижения — общий источник для лестницы и карточки инвестора. */
export function getAchievements(
  health: PortfolioHealth,
  portfolio?: V2Portfolio,
): LadderAchievement[] {
  const score = (key: string) => health.components.find((c) => c.key === key)?.score ?? 0;
  const positions = portfolio?.positionsCount ?? 0;

  return [
    {
      id: "positions",
      name: "Портфель собран",
      desc: "5+ позиций в работе",
      unlocked: positions >= 5,
      progress: positions,
      target: 5,
    },
    {
      id: "reserve",
      name: "Хранитель резерва",
      desc: "Резерв в умеренной зоне",
      unlocked: score("reserve") >= 50,
      progress: score("reserve"),
      target: 50,
    },
    {
      id: "flexibility",
      name: "Мастер гибкости",
      desc: "Гибкость портфеля выше 60",
      unlocked: score("flexibility") >= 60,
      progress: score("flexibility"),
      target: 60,
    },
    {
      id: "futures",
      name: "Фьючерсы под контролем",
      desc: "Спекулятивный бюджет и плечо в норме",
      unlocked: score("futures") >= 70,
      progress: score("futures"),
      target: 70,
    },
    {
      id: "guardian",
      name: "Страж портфеля",
      desc: "Здоровье портфеля выше 70",
      unlocked: health.healthFactor >= 70,
      progress: health.healthFactor,
      target: 70,
    },
    {
      id: "concentration",
      name: "Дисциплина лимитов",
      desc: "Ни один актив не выше своего лимита",
      unlocked: score("concentration") >= 80,
      progress: score("concentration"),
      target: 80,
    },
    {
      id: "diversification",
      name: "Диверсификатор",
      desc: "Диверсификация выше 60",
      unlocked: score("diversification") >= 60,
      progress: score("diversification"),
      target: 60,
    },
  ];
}

type LadderStep = {
  level: number;
  title: string;
  /** Порог health factor для входа на уровень. */
  hfFrom: number;
  /** Денежное поощрение за достижение уровня, $ (выводится из крипты «на себя»). */
  rewardUsd: number;
  /** Что нужно закрыть на этом уровне. */
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
    achievementIds: ["reserve", "positions"],
    focus: "Собрать подушку — резерв важнее доходности",
  },
  {
    level: 2,
    title: "Оператор",
    hfFrom: 40,
    rewardUsd: 10,
    achievementIds: ["flexibility"],
    focus: "Держать запас манёвра для откупов",
  },
  {
    level: 3,
    title: "Аналитик",
    hfFrom: 60,
    rewardUsd: 20,
    achievementIds: ["futures"],
    focus: "Спекулятивный блок под контролем",
  },
  {
    level: 4,
    title: "Исследователь",
    hfFrom: 75,
    rewardUsd: 35,
    achievementIds: ["guardian", "concentration"],
    focus: "Портфель здоров, лимиты не пробиты",
  },
  {
    level: 5,
    title: "Планировщик",
    hfFrom: 90,
    rewardUsd: 50,
    achievementIds: ["diversification"],
    focus: "Капитал разложен ровно по классам",
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
  /** Сколько ещё пунктов здоровья до следующего уровня. */
  hfToNext: number;
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
 */
export function buildLevelCards(
  health: PortfolioHealth,
  portfolio: V2Portfolio,
): LevelCard[] {
  const hf = health.healthFactor;
  const all = getAchievements(health, portfolio);
  const current = currentLadderLevel(hf);

  return LEVEL_LADDER.map((step, idx) => {
    const next = LEVEL_LADDER[idx + 1];
    const hfTo = next ? next.hfFrom : 100;
    const status: LevelCardStatus =
      step.level < current ? "done" : step.level === current ? "current" : "locked";

    const span = Math.max(hfTo - step.hfFrom, 1);
    const xpCurrent =
      status === "done" ? span : status === "current" ? Math.max(0, Math.min(hf - step.hfFrom, span)) : 0;

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
      achievements: all.filter((a) => step.achievementIds.includes(a.id)),
      hfToNext: Math.max(0, Math.round(hfTo - hf)),
    };
  });
}
