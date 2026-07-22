/**
 * Market Psychology Engine — поведенческий гид от ЖИВОГО индекса страха и жадности.
 *
 * Конституция: «цель не прогноз, а поведенческое руководство». Поэтому здесь нет
 * фиксированных дат и целевых цен будущего — только текущее эмоциональное состояние
 * рынка, выведенное из реального F&G-индекса и его тренда, плюс что делает
 * дисциплинированный инвестор и какие действия становятся опасными.
 *
 * Тренд отличает состояния с одинаковым индексом, но разной динамикой:
 * F&G=12 на падении = Капитуляция, F&G=12 на росте = Неверие (дно нащупано).
 */

export type PsychZoneKey =
  | "capitulation"
  | "fear"
  | "disbelief"
  | "neutral"
  | "optimism"
  | "excitement"
  | "euphoria";

export type PsychTrend = "rising" | "falling" | "flat";
export type MarketRiskMode =
  | "покупать_по_плану"
  | "держать_план"
  | "снижать_риск"
  | "защита_капитала";

export type MarketPsychologyGate = {
  severity: "info" | "warning" | "block";
  text: string;
};

export type MarketPsychology = {
  index: number;            // текущий F&G 0..100
  trend: PsychTrend;
  key: PsychZoneKey;
  emotion: string;          // «Капитуляция», «Эйфория» …
  feels: string;            // что чувствует толпа
  disciplined: string;      // что делает дисциплинированный инвестор
  dangerous: string;        // какое действие сейчас опаснее всего
  stance: "aggressive-buy" | "accumulate" | "hold" | "trim" | "de-risk";
  stanceLabel: string;      // короткий ярлык действия
  riskMode: MarketRiskMode; // как рынок влияет на допуск к новой сделке
  gate: MarketPsychologyGate;
  color: string;
};

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Тренд по истории F&G: сравниваем текущее значение со средним последних точек.
 * Порог 4 пункта отсекает шум. Нет истории → flat.
 */
export function fearGreedTrend(index: number, history?: { value: number }[]): PsychTrend {
  if (!history || history.length < 3) return "flat";
  const recent = history.slice(-7);
  const avg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
  if (index > avg + 4) return "rising";
  if (index < avg - 4) return "falling";
  return "flat";
}

type ZoneDef = Omit<MarketPsychology, "index" | "trend">;

/** Базовое состояние по значению индекса (без учёта тренда). */
function zoneByIndex(index: number): ZoneDef {
  if (index <= 14) {
    return {
      key: "capitulation",
      emotion: "Капитуляция",
      feels: "Максимум боли. Толпа продаёт «на любых условиях» и клянётся больше не входить в рынок.",
      disciplined: "Исторически лучшая зона для покупок. Докупает по плану, малыми порциями, из резерва.",
      dangerous: "Паническая продажа на дне и фиксация убытка в самой невыгодной точке.",
      stance: "aggressive-buy",
      stanceLabel: "Зона агрессивной покупки",
      riskMode: "покупать_по_плану",
      gate: {
        severity: "info",
        text: "Рынок в капитуляции — добор допустим только по плану, малой суммой и без нарушения резерва.",
      },
      color: "#f2704a",
    };
  }
  if (index <= 24) {
    return {
      key: "fear",
      emotion: "Страх",
      feels: "Пессимизм и недоверие. Плохие новости кажутся важнее хороших.",
      disciplined: "Усиленные плановые покупки. Именно здесь формируется будущая доходность.",
      dangerous: "Замереть и ничего не делать «до ясности» — ясность приходит уже дороже.",
      stance: "accumulate",
      stanceLabel: "Усиленный набор",
      riskMode: "покупать_по_плану",
      gate: {
        severity: "info",
        text: "Рынок в страхе — можно использовать плановый добор, если резерв и лимиты проходят проверку.",
      },
      color: "#56c4f0",
    };
  }
  if (index <= 44) {
    return {
      key: "optimism",
      emotion: "Осторожный оптимизм",
      feels: "Рынок оживает, но вера ещё хрупкая. Первые верят в разворот.",
      disciplined: "Плановый набор продолжается, без спешки. Дисциплина важнее темпа.",
      dangerous: "Отказаться от плана и ждать «идеальной» точки входа.",
      stance: "accumulate",
      stanceLabel: "Плановый набор",
      riskMode: "покупать_по_плану",
      gate: {
        severity: "info",
        text: "Рынок выходит из страха — добор только по плану и без увеличения концентрации сверх лимитов.",
      },
      color: "#5fe0cf",
    };
  }
  if (index <= 54) {
    return {
      key: "neutral",
      emotion: "Равновесие",
      feels: "Ни страха, ни жадности. Рынок в поиске направления.",
      disciplined: "Держит структуру и резерв. Не форсирует ни покупки, ни продажи.",
      dangerous: "Искать сильные движения там, где их нет, и переторговывать.",
      stance: "hold",
      stanceLabel: "Удержание",
      riskMode: "держать_план",
      gate: {
        severity: "info",
        text: "Рынок нейтрален — решение должно опираться на лимиты, резерв и качество актива.",
      },
      color: "#9fb3c8",
    };
  }
  if (index <= 74) {
    return {
      key: "excitement",
      emotion: "Оптимизм и возбуждение",
      feels: "«Все покупают», рост кажется само собой разумеющимся. Появляется FOMO.",
      disciplined: "Не догоняет. Фиксирует прибыль по плану и наращивает резерв.",
      dangerous: "Покупать по факту роста и заходить на всю котлету из страха «упустить».",
      stance: "trim",
      stanceLabel: "Фиксация по плану",
      riskMode: "снижать_риск",
      gate: {
        severity: "warning",
        text: "Рынок в зоне жадности — новая покупка риска разрешена только после ручной проверки.",
      },
      color: "#e6b35a",
    };
  }
  if (index <= 89) {
    return {
      key: "excitement",
      emotion: "Жадность",
      feels: "Эйфория близко. Убытки забыты, риск кажется бесплатным.",
      disciplined: "Снижает долю риска, выводит прибыль в стейблы, гасит плечо.",
      dangerous: "Наращивать плечо и концентрацию на пике оптимизма.",
      stance: "de-risk",
      stanceLabel: "Снижение риска",
      riskMode: "снижать_риск",
      gate: {
        severity: "warning",
        text: "Рынок в жадности — не увеличивать риск без причины из плана и проверки выживаемости.",
      },
      color: "#f0a35a",
    };
  }
  return {
    key: "euphoria",
    emotion: "Эйфория",
    feels: "«В этот раз всё иначе». Толпа уверена, что рост вечен.",
    disciplined: "Максимально дисциплинирован: режет риск, держит резерв, не верит в вечный рост.",
    dangerous: "Плечо, вера в «новую нормальность» и вход крупной суммой на самом верху.",
    stance: "de-risk",
    stanceLabel: "Защита капитала",
    riskMode: "защита_капитала",
    gate: {
      severity: "block",
      text: "Рынок в эйфории — увеличение риска заблокировано до выхода из зоны перегрева.",
    },
    color: "#f2704a",
  };
}

/**
 * Полное состояние: базовая зона по индексу + поправка на тренд.
 * Ключевая нелинейность — выход ВВЕРХ из экстремального страха = «Неверие»
 * (дно нащупано, но толпа не верит): по-прежнему зона покупок, но риторика другая.
 */
export function getMarketPsychology(
  index: number,
  history?: { value: number }[],
): MarketPsychology {
  const idx = clamp(index);
  const trend = fearGreedTrend(idx, history);
  const zone = zoneByIndex(idx);

  if (idx <= 24 && trend === "rising") {
    return {
      index: idx,
      trend,
      key: "disbelief",
      emotion: "Неверие",
      feels: "Дно нащупано, рынок отскакивает — но толпа считает это ловушкой и не верит росту.",
      disciplined: "Продолжает набор: развороты рождаются в неверии, а не в очевидности.",
      dangerous: "Ждать «подтверждённого» тренда — подтверждение приходит уже заметно дороже.",
      stance: "accumulate",
      stanceLabel: "Набор на неверии",
      riskMode: "покупать_по_плану",
      gate: {
        severity: "info",
        text: "Рынок в неверии — плановый добор допустим, если резерв, лимиты и качество актива в норме.",
      },
      color: "#56c4f0",
    };
  }

  return { index: idx, trend, ...zone };
}
