import type { Decision, PositionInput, ScenarioCard } from "../types/portfolio";

export const rawPositions: PositionInput[] = [
  { asset: "BTC", category: "Крипта", quantity: 0.0004367, avgEntry: 68200, currentPrice: 69759.6, status: "Накапливать" },
  { asset: "ETH", category: "Крипта", quantity: 0.0258, avgEntry: 1921, currentPrice: 2156, status: "Накапливать" },
  { asset: "TON", category: "Крипта", quantity: 11.63, avgEntry: 1.33, currentPrice: 1.27, status: "Наблюдать" },
  { asset: "SOL", category: "Крипта", quantity: 0.1694, avgEntry: 90, currentPrice: 82.56, status: "Накапливать" },
  { asset: "BNB", category: "Крипта", quantity: 0.0166, avgEntry: 594, currentPrice: 606.76, status: "Наблюдать" },
  { asset: "TIA", category: "Крипта", quantity: 24.6, avgEntry: 0.32, currentPrice: 0.3, status: "Наблюдать" },
  { asset: "APEX", category: "Крипта", quantity: 26.1, avgEntry: 0.29, currentPrice: 0.27, status: "Наблюдать" },
  { asset: "MNT", category: "Крипта", quantity: 14.5, avgEntry: 0.55, currentPrice: 0.68, status: "Наблюдать" },
  { asset: "GOLD LONG", category: "Металлы", quantity: 0.0032, avgEntry: 4376.7, currentPrice: 4937.5, status: "Хедж" },
  { asset: "BTC SHORT", category: "Фьючерсы", quantity: 0.00041, avgEntry: 71018, currentPrice: 66922, status: "Спекуляция" },
  { asset: "USDT", category: "Свободные деньги", quantity: 244.8, avgEntry: 1, currentPrice: 1, status: "Держать" },
];

export const decisionsData: Decision[] = [
  { asset: "BTC", thesis: "Базовый актив цикла.", whyHold: "Фундамент ядра портфеля.", expect: "Плавное продолжение роста с коррекциями.", nextAction: "Добирать на слабости.", reviewTrigger: "Слом глобальной структуры.", status: "Держать" },
  { asset: "ETH", thesis: "Главный рисковый актив ядра.", whyHold: "Ликвидность, экосистема, сила к рынку.", expect: "Может идти сильнее части альтов.", nextAction: "Приоритетный добор.", reviewTrigger: "Ухудшение силы против BTC.", status: "Накапливать" },
  { asset: "TON", thesis: "Спекулятивный средний риск.", whyHold: "Есть история повторных всплесков.", expect: "Движение рывками, не линейно.", nextAction: "Только точечные покупки.", reviewTrigger: "Долгая стагнация без спроса.", status: "Наблюдать" },
  { asset: "SOL", thesis: "Актив с потенциалом импульса.", whyHold: "Высокая бета к рынку.", expect: "Резкие движения вверх и вниз.", nextAction: "Добирать при страхе.", reviewTrigger: "Потеря импульса к сектору.", status: "Накапливать" },
  { asset: "BNB", thesis: "Умеренно сильный актив.", whyHold: "Сильная платформа и ликвидность.", expect: "Стабильнее многих альтов.", nextAction: "Без агрессии, держать.", reviewTrigger: "Ослабление экосистемы.", status: "Наблюдать" },
  { asset: "TIA", thesis: "Небольшая ставка на апсайд.", whyHold: "Риск контролируем за счёт размера.", expect: "Либо резкий рост, либо долгий боковик.", nextAction: "Не усреднять без сигнала.", reviewTrigger: "Полная потеря интереса рынка.", status: "Наблюдать" },
  { asset: "APEX", thesis: "Малый спекулятивный блок.", whyHold: "Допуск на апсайд при ограниченном риске.", expect: "Высокая волатильность.", nextAction: "Без добора пока.", reviewTrigger: "Ломка идеи по ликвидности.", status: "Наблюдать" },
  { asset: "MNT", thesis: "Пока сильнее части малых позиций.", whyHold: "Есть локальная сила.", expect: "Может продолжить рост раньше остальных.", nextAction: "Держать и наблюдать.", reviewTrigger: "Потеря локального импульса.", status: "Наблюдать" },
  { asset: "GOLD LONG", thesis: "Защитный хедж.", whyHold: "Снижает чистую зависимость от крипты.", expect: "Спокойное движение без взрывной доходности.", nextAction: "Не раздувать, держать как страховку.", reviewTrigger: "Изменение общей защитной логики портфеля.", status: "Хедж" },
  { asset: "BTC SHORT", thesis: "Спекуляция против локального перегрева.", whyHold: "Отдельный тактический сценарий.", expect: "Быстрые движения. Нужен жёсткий контроль.", nextAction: "Частично фиксировать на движении.", reviewTrigger: "Импульс вверх против позиции.", status: "Спекуляция" },
  { asset: "USDT", thesis: "Резерв для действий.", whyHold: "Даёт манёвренность и контроль риска.", expect: "Снижает давление на портфель.", nextAction: "Часть вводить только по плану.", reviewTrigger: "Изменение рыночного режима.", status: "Резерв" },
];

export const scenariosData: ScenarioCard[] = [
  { asset: "BTC", base: "Базовый рост с паузами.", bull: "Сильный импульс продолжения.", bear: "Глубокая коррекция с шансом на добор.", action: "Не гнаться, работать от слабости.", invalidation: "Ломка старшего тренда.", status: "Активен" },
  { asset: "ETH", base: "Опережает часть рынка.", bull: "Делает рывок сильнее BTC.", bear: "Просадка вместе с альтами.", action: "Добор раньше вторичных альтов.", invalidation: "Потеря силы против BTC.", status: "Активен" },
  { asset: "TON", base: "Боковик с локальными вспышками.", bull: "Резкое ускорение на внимании.", bear: "Сползание без спроса.", action: "Покупки только в зонах страха.", invalidation: "Пропажа интереса.", status: "Наблюдение" },
  { asset: "SOL", base: "Высокая волатильность в растущем рынке.", bull: "Резкий ускоряющий импульс.", bear: "Сильная просадка глубже ядра.", action: "Покупать только ступенчато.", invalidation: "Потеря секторальной силы.", status: "Активен" },
  { asset: "BNB", base: "Спокойнее большинства альтов.", bull: "Умеренный рост без перегрева.", bear: "Боковик и отставание.", action: "Держать без агрессивных доборов.", invalidation: "Снижение силы экосистемы.", status: "Наблюдение" },
  { asset: "TIA", base: "Слабый/средний боковик.", bull: "Резкий импульс на хайпе.", bear: "Уход в длинную стагнацию.", action: "Не перегружать размер позиции.", invalidation: "Полный спад спроса.", status: "Наблюдение" },
  { asset: "APEX", base: "Чистая спекулятивная ставка.", bull: "Выстрел на ликвидности.", bear: "Медленное затухание.", action: "Без добавления до сигнала.", invalidation: "Проблемы с ликвидностью.", status: "Наблюдение" },
  { asset: "MNT", base: "Локальное удержание силы.", bull: "Продолжение роста раньше части рынка.", bear: "Откат к средним.", action: "Фиксировать частями на всплесках.", invalidation: "Слом импульса.", status: "Активен" },
  { asset: "GOLD LONG", base: "Спокойный защитный тренд.", bull: "Рост на защитном спросе.", bear: "Стоит на месте при risk-on (аппетит к риску).", action: "Держать как хедж.", invalidation: "Меняется логика защиты.", status: "Хедж" },
  { asset: "BTC SHORT", base: "Тактический шорт на локальном перегреве.", bull: "Позиция даёт быстрый профит на снижении.", bear: "Рынок выносит вверх.", action: "Фиксировать частями и держать риск маленьким.", invalidation: "Сильный ап-импульс против позиции.", status: "Спекуляция" },
  { asset: "USDT", base: "Резерв и гибкость.", bull: "Даёт возможность купить страх.", bear: "Снижает доходность при сильном росте рынка.", action: "Вводить в рынок частями.", invalidation: "Смена режима рынка на устойчивый рост.", status: "Резерв" },
];
