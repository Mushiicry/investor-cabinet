import {
  BUY_WINDOW_END,
  BUY_WINDOW_START,
  NEXT_HALVING,
} from "../config/constants";

export function getMoodData() {
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysToStart = Math.ceil((BUY_WINDOW_START.getTime() - now.getTime()) / msPerDay);
  const daysToEnd = Math.ceil((BUY_WINDOW_END.getTime() - now.getTime()) / msPerDay);
  const daysToHalving = Math.ceil((NEXT_HALVING.getTime() - now.getTime()) / msPerDay);
  const inWindow = now >= BUY_WINDOW_START && now <= BUY_WINDOW_END;
  const beforeWindow = now < BUY_WINDOW_START;
  const countdownLabel = inWindow ? `Окно открыто. До закрытия ${Math.max(daysToEnd, 0)} дн.` : beforeWindow ? `До окна ${Math.max(daysToStart, 0)} дн.` : "Окно уже прошло.";

  return {
    currentMarket: "Текущий рынок - страх. Стейблы на руках, ликвидность высокая, портфель не перегружен. Покупки допустимы только постепенно и без веры в быстрый разворот.",
    cryptoWave: "Крипта - поздняя волна цикла после основной бычьей фазы. Базовый сценарий - доборы только в сильной слабости и по плану.",
    goldWave: "Золото - защитная волна. Логика удержания сохраняется, пока рынок не вернулся в устойчивый risk-on (аппетит к риску).",
    stocksWave: "Акции - нейтрально/осторожно. Массовой силы для агрессивного набора пока нет, приоритет у кэша и точечных действий.",
    buyWindow: "10 октября 2026 - 15 декабря 2026",
    countdownLabel,
    cycleLogic: `Логика цикла: после халвинга рынок проходит эйфорию, затем охлаждение. До следующего халвинга осталось ${Math.max(daysToHalving, 0)} дн. Сейчас приоритет - сантимент, шкала эмоций и дисциплина входа, а не вера в мгновенную бычку.`,
  };
}
