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
      disciplined: "Покупай только по плану: малыми порциями, из резерва и без нарушения лимитов.",
      dangerous: "Не продавай в панике на дне и не фиксируй убыток в самой невыгодной точке.",
      stance: "aggressive-buy",
      stanceLabel: "Зона агрессивной покупки",
      riskMode: "покупать_по_плану",
      gate: {
        severity: "info",
        text: "Добор допустим только по плану: малой суммой, без нарушения резерва и лимитов.",
      },
      color: "#f2704a",
    };
  }
  if (index <= 24) {
    return {
      key: "fear",
      emotion: "Страх",
      feels: "Пессимизм и недоверие. Плохие новости кажутся важнее хороших.",
      disciplined: "Добирай по плану усиленной, но контролируемой порцией. Именно здесь формируется будущая доходность.",
      dangerous: "Не замирай «до ясности»: ясность обычно приходит уже дороже.",
      stance: "accumulate",
      stanceLabel: "Усиленный набор",
      riskMode: "покупать_по_плану",
      gate: {
        severity: "info",
        text: "Можно использовать плановый добор, если резерв, лимиты и качество актива проходят проверку.",
      },
      color: "#56c4f0",
    };
  }
  if (index <= 44) {
    return {
      key: "optimism",
      emotion: "Осторожный оптимизм",
      feels: "Рынок оживает, но вера ещё хрупкая. Первые верят в разворот.",
      disciplined: "Продолжай плановый набор без спешки. Дисциплина важнее темпа.",
      dangerous: "Не отказывайся от плана ради ожидания «идеальной» точки входа.",
      stance: "accumulate",
      stanceLabel: "Плановый набор",
      riskMode: "покупать_по_плану",
      gate: {
        severity: "info",
        text: "Добор только по плану и без увеличения концентрации сверх лимитов.",
      },
      color: "#5fe0cf",
    };
  }
  if (index <= 54) {
    return {
      key: "neutral",
      emotion: "Равновесие",
      feels: "Ни страха, ни жадности. Рынок в поиске направления.",
      disciplined: "Держи структуру и резерв. Не форсируй ни покупки, ни продажи.",
      dangerous: "Не ищи сильные движения там, где их нет, и не переторговывай.",
      stance: "hold",
      stanceLabel: "Удержание",
      riskMode: "держать_план",
      gate: {
        severity: "info",
        text: "Решение должно опираться на лимиты, резерв и качество актива, а не на шум рынка.",
      },
      color: "#9fb3c8",
    };
  }
  if (index <= 74) {
    return {
      key: "excitement",
      emotion: "Оптимизм и возбуждение",
      feels: "«Все покупают», рост кажется само собой разумеющимся. Появляется FOMO.",
      disciplined: "Не покупай только потому, что рынок растёт. Если сделка увеличивает риск — сначала проверь причину, размер и выживаемость.",
      dangerous: "Не догоняй рост рыночной покупкой, не увеличивай плечо и не заходи крупной суммой из страха «упустить».",
      stance: "trim",
      stanceLabel: "Не покупать без плана",
      riskMode: "снижать_риск",
      gate: {
        severity: "warning",
        text: "Не покупай просто из-за роста. Любая новая сделка, которая увеличивает риск, требует ручной проверки причины, размера и выживаемости.",
      },
      color: "#e6b35a",
    };
  }
  if (index <= 89) {
    return {
      key: "excitement",
      emotion: "Жадность",
      feels: "Эйфория близко. Убытки забыты, риск кажется бесплатным.",
      disciplined: "Поставь новые рисковые сделки на паузу, если причины нет в плане. Прибыль и плечо сокращай только по заранее заданным правилам.",
      dangerous: "Не наращивай плечо, концентрацию или размер позиции на пике оптимизма.",
      stance: "de-risk",
      stanceLabel: "Снижение риска",
      riskMode: "снижать_риск",
      gate: {
        severity: "warning",
        text: "Не увеличивай риск без записанной причины из плана и проверки выживаемости.",
      },
      color: "#f0a35a",
    };
  }
  return {
    key: "euphoria",
    emotion: "Эйфория",
    feels: "«В этот раз всё иначе». Толпа уверена, что рост вечен.",
    disciplined: "Защищай капитал: режь риск по плану, держи резерв и не верь в вечный рост.",
    dangerous: "Не открывай плечо, не верь в «новую нормальность» и не входи крупной суммой на самом верху.",
    stance: "de-risk",
    stanceLabel: "Защита капитала",
    riskMode: "защита_капитала",
    gate: {
      severity: "block",
      text: "Не увеличивай риск: рынок в эйфории, новые рисковые сделки заблокированы до выхода из перегрева.",
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
      disciplined: "Продолжай набор по плану: развороты рождаются в неверии, а не в очевидности.",
      dangerous: "Не жди «подтверждённого» тренда: подтверждение часто приходит уже заметно дороже.",
      stance: "accumulate",
      stanceLabel: "Набор на неверии",
      riskMode: "покупать_по_плану",
      gate: {
        severity: "info",
        text: "Плановый добор допустим, если резерв, лимиты и качество актива в норме.",
      },
      color: "#56c4f0",
    };
  }

  return { index: idx, trend, ...zone };
}
