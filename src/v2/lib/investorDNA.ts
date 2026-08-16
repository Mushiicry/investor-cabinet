import type { InvestorStrategyId } from "./investorStrategy";
import { MAIN_INVESTOR_PROFILE, WIFE_INVESTOR_PROFILE, type InvestorProfile } from "./investorProfile";

export type InvestorDNAPriority = "critical" | "high" | "medium";

export type InvestorDNARecommendation = {
  id: string;
  priority: InvestorDNAPriority;
  area: "резерв" | "цель" | "обучение" | "риск" | "дисциплина";
  title: string;
  action: string;
  reason: string;
  expectedEffect: string;
};

export type InvestorDNAScore = {
  label: string;
  value: number;
  note: string;
};

export type InvestorDNAQuestion = {
  id: string;
  text: string;
  answerKind: "choice" | "open";
  options?: string[];
  placeholder?: string;
};

export type InvestorDNAAuditAnswer = {
  auditId: string;
  accountId: InvestorStrategyId;
  auditType: "lite" | "full";
  questionId: string;
  option: string;
  note: string;
  answeredAt: string;
  source: string;
};

export type InvestorDNAAuditResult = {
  auditId: string;
  accountId: InvestorStrategyId;
  auditType: "lite" | "full";
  submittedAt: string;
  answeredCount: number;
  totalQuestions: number;
  profileId: string;
  investorType: string;
  riskWillingness: number;
  riskCapacity: number;
  resultNote: string;
};

export type InvestorDNAQuestionGroup = {
  title: string;
  questions: InvestorDNAQuestion[];
};

export type InvestorDNA = {
  id: string;
  accountId: InvestorStrategyId;
  title: string;
  investorType: string;
  thesis: string;
  profile: InvestorProfile;
  riskWillingness: InvestorDNAScore;
  riskCapacity: InvestorDNAScore;
  horizon: string;
  capitalGoal: string;
  benchmarkVerdict: string;
  maxDrawdownRule: string;
  stressDrawdown: string;
  liquidityRule: string;
  tradingBudgetRule: string;
  leverageRule: string;
  keyVerdict: string;
  recommendations: InvestorDNARecommendation[];
  liteQuestionCount: number;
  fullAuditQuestionCount: number;
  liteQuestions: InvestorDNAQuestion[];
  fullQuestionGroups: InvestorDNAQuestionGroup[];
  auditSections: string[];
  ipsOutputs: string[];
  answers?: InvestorDNAAuditAnswer[];
  auditHistory?: InvestorDNAAuditResult[];
};

const MAIN_LITE_QUESTIONS: InvestorDNAQuestion[] = [
  {
    id: "lite-1",
    text: "Какая главная цель капитала: защита, пассивный доход, рост или агрессивный рост?",
    answerKind: "choice",
    options: ["Защита", "Пассивный доход", "Рост", "Агрессивный рост"],
  },
  {
    id: "lite-2",
    text: "Когда деньги могут понадобиться: до 3 лет, 3-5 лет, 5-10 лет или капитал не планируется выводить?",
    answerKind: "choice",
    options: ["До 3 лет", "3-5 лет", "5-10 лет", "Не планирую выводить"],
  },
  {
    id: "lite-3",
    text: "Есть ли отдельная финансовая подушка вне инвестиционного портфеля?",
    answerKind: "choice",
    options: ["Нет", "1 месяц", "3 месяца", "6+ месяцев"],
  },
  {
    id: "lite-4",
    text: "Сколько месяцев обязательных платежей ты выдержишь без активного дохода?",
    answerKind: "choice",
    options: ["0-1 месяц", "1-3 месяца", "3-6 месяцев", "6+ месяцев"],
  },
  {
    id: "lite-5",
    text: "Какая просадка портфеля уже мешает спокойно спать: -10%, -20%, -30%, -40%, -50%?",
    answerKind: "choice",
    options: ["-10%", "-20%", "-30%", "-40% и ниже"],
  },
  {
    id: "lite-6",
    text: "Если рынок упал на -40%, а тезис не сломан, ты продаёшь, держишь или докупаешь?",
    answerKind: "choice",
    options: ["Продаю", "Держу", "Докупаю по плану", "Увеличиваю риск"],
  },
  {
    id: "lite-7",
    text: "Что хуже: потерять капитал, отстать от индекса или пропустить сильный рост?",
    answerKind: "choice",
    options: ["Потерять капитал", "Отстать от индекса", "Пропустить рост", "Не знаю"],
  },
  {
    id: "lite-8",
    text: "Какая доля портфеля может быть в крипте на текущем этапе?",
    answerKind: "choice",
    options: ["До 10%", "10-30%", "30-50%", "50%+"],
  },
  {
    id: "lite-9",
    text: "Допустим ли активный трейдинг отдельно от долгосрочного портфеля?",
    answerKind: "choice",
    options: ["Нет", "Только учебно", "Отдельным бюджетом", "Да, активно"],
  },
  {
    id: "lite-10",
    text: "Какая максимальная доля капитала может быть в активном трейдинге?",
    answerKind: "choice",
    options: ["0%", "До 5%", "До 10%", "Больше 10%"],
  },
  {
    id: "lite-11",
    text: "Допустимо ли кредитное плечо и при каких условиях?",
    answerKind: "choice",
    options: ["Нет", "Только хедж", "Только с лимитом убытка", "Допустимо"],
  },
  {
    id: "lite-12",
    text: "Какие знания сейчас слабее всего: акции, макроэкономика, риск-менеджмент, психология или анализ активов?",
    answerKind: "choice",
    options: ["Акции/макро", "Риск-менеджмент", "Психология", "Анализ активов"],
  },
];

const MAIN_FULL_QUESTION_GROUPS: InvestorDNAQuestionGroup[] = [
  {
    title: "Цель капитала",
    questions: [
      { id: "full-1", text: "Для чего тебе в первую очередь нужен инвестиционный капитал?", answerKind: "choice", options: ["Свобода решений", "Рост капитала", "Пассивный доход", "Защита семьи", "Крупная цель"] },
      { id: "full-2", text: "Что для тебя важнее на горизонте 5 лет?", answerKind: "choice", options: ["Сохранить базу", "Стабильно расти", "Сильно вырасти", "Максимально ускориться"] },
      { id: "full-3", text: "Если цель будет достигнута позже на 2-3 года, это приемлемо?", answerKind: "choice", options: ["Нет", "Скорее нет", "Скорее да", "Да"] },
      { id: "full-4", text: "Что должно быть главным рычагом роста капитала?", answerKind: "choice", options: ["Доходность портфеля", "Регулярные пополнения", "Рост активного дохода", "Сочетание факторов"] },
      { id: "full-5", text: "Какой результат через 5 лет ты считаешь хорошим, если риск был под контролем?", answerKind: "open", placeholder: "Сумма, диапазон или качественный результат" },
      { id: "full-6", text: "Что будет главным назначением капитала после достижения цели?", answerKind: "choice", options: ["Финансовая свобода", "Пассивный доход", "Безопасность семьи", "Новые инвестиции", "Бизнес"] },
      { id: "full-7", text: "Что для тебя хуже всего?", answerKind: "choice", options: ["Потерять капитал", "Не заработать достаточно", "Отстать от рынка", "Пропустить сильный рост"] },
      { id: "full-8", text: "Насколько цель капитала для тебя жёсткая?", answerKind: "choice", options: ["Необходимость", "Важная цель", "Ориентир", "Гибкая амбиция"] },
    ],
  },
  {
    title: "Риск и просадки",
    questions: [
      { id: "full-9", text: "Какая просадка уже эмоционально выбивает тебя из спокойного состояния?", answerKind: "choice", options: ["-10%", "-20%", "-30%", "-40%", "-50%+"] },
      { id: "full-10", text: "При какой просадке система должна запретить новые покупки до пересмотра риска?", answerKind: "choice", options: ["-10%", "-20%", "-30%", "-40%", "-50%+"] },
      { id: "full-11", text: "Если портфель упал на 25%, но план не нарушен, что правильно сделать?", answerKind: "choice", options: ["Продать", "Ничего не делать", "Докупать по лимиту", "Увеличить риск"] },
      { id: "full-12", text: "Если портфель упал на 45%, что обязательно проверить перед докупкой?", answerKind: "choice", options: ["Эмоцию", "Свободные деньги", "Тезис и лимиты", "Ничего"] },
      { id: "full-13", text: "Какой убыток в долларах будет психологически тяжёлым уже сейчас?", answerKind: "open", placeholder: "Например: $3 000, $10 000, $25 000" },
      { id: "full-14", text: "Что сильнее всего мешает тебе выдерживать просадку?", answerKind: "choice", options: ["Страх потерять деньги", "Желание отыграться", "Сомнение в активе", "Давление цели", "Нет проблемы"] },
      { id: "full-15", text: "Что для тебя важнее в просадке?", answerKind: "choice", options: ["Защитить капитал", "Следовать плану", "Купить дешевле", "Быстрее вернуть убыток"] },
      { id: "full-16", text: "Какую связку доходности и просадки ты готов принять на 10 лет?", answerKind: "choice", options: ["5-8% и до -10%", "10-15% и до -20%", "15-25% и до -35%", "25%+ и -50%+"] },
    ],
  },
  {
    title: "Поведение",
    questions: [
      { id: "full-17", text: "Что ты обычно хочешь сделать после серии неудачных решений?", answerKind: "choice", options: ["Остановиться", "Уменьшить размер", "Отыграться", "Вернуться к правилам"] },
      { id: "full-18", text: "Что сильнее провоцирует импульсивную сделку?", answerKind: "choice", options: ["Резкий рост", "Резкое падение", "Чужая прибыль", "Новость", "Ничего"] },
      { id: "full-19", text: "После трёх месяцев без роста портфеля что ты сделаешь?", answerKind: "choice", options: ["Сменю стратегию", "Увеличу риск", "Продолжу план", "Пересмотрю только факты"] },
      { id: "full-20", text: "После трёх лет отставания от рынка что будет самым сильным давлением?", answerKind: "choice", options: ["Сменить стратегию", "Увеличить риск", "Проверить процесс", "Ничего, если правила соблюдены"] },
      { id: "full-21", text: "Сможешь ли 6 месяцев ничего не покупать и не продавать, если система говорит ждать?", answerKind: "choice", options: ["Нет", "Скорее нет", "Скорее да", "Да"] },
      { id: "full-22", text: "Какие события должны заставить продать актив даже в минусе?", answerKind: "open", placeholder: "Сломан тезис, риск выше лимита, смена качества актива" },
      { id: "full-23", text: "Какое личное правило нельзя нарушать ради прибыли?", answerKind: "open", placeholder: "Одно правило, которое важнее PnL" },
      { id: "full-24", text: "Что для тебя означает быть хорошим инвестором?", answerKind: "open", placeholder: "Опиши свой критерий хорошего инвестора" },
    ],
  },
  {
    title: "Стиль инвестирования",
    questions: [
      { id: "full-25", text: "Какой стиль тебе ближе?", answerKind: "choice", options: ["Пассивный накопитель", "Системный DCA", "Активный аллокатор", "Спекулятивный охотник", "Смешанный"] },
      { id: "full-26", text: "Как часто ты готов принимать инвестиционные решения?", answerKind: "choice", options: ["Раз в месяц", "Раз в неделю", "Несколько раз в неделю", "Каждый день"] },
      { id: "full-27", text: "Какой формат стратегии тебе проще соблюдать?", answerKind: "choice", options: ["Фиксированные правила", "Диапазоны", "Ручные решения", "Сигналы системы"] },
      { id: "full-28", text: "Что тебе комфортнее?", answerKind: "choice", options: ["Редко, но крупно", "Часто, но мелко", "По зонам цены", "По календарю"] },
      { id: "full-29", text: "Как ты относишься к ребалансировке?", answerKind: "choice", options: ["Не хочу", "Только при сильных перекосах", "Планово", "Активно управляю долями"] },
      { id: "full-30", text: "Что должно быть главным ограничителем сделки?", answerKind: "choice", options: ["Цена", "Доля актива", "Общий риск", "Свободный кэш", "Сигнал"] },
      { id: "full-31", text: "Какой стиль ошибки для тебя наиболее опасен?", answerKind: "choice", options: ["Пересидеть убыток", "Продать рано", "Купить слишком много", "Бездействовать", "Нарушить лимиты"] },
      { id: "full-32", text: "Какие решения тебе лучше запретить заранее?", answerKind: "open", placeholder: "Например: покупка без лимита, плечо, добор после серии ошибок" },
    ],
  },
  {
    title: "Структура портфеля",
    questions: [
      { id: "full-33", text: "Какая базовая структура портфеля тебе ближе?", answerKind: "choice", options: ["Крипта-ядро", "Крипта + защитные активы", "Акции + крипта", "Мульти-активы"] },
      { id: "full-34", text: "Какая максимальная доля крипты допустима для тебя психологически?", answerKind: "choice", options: ["До 10%", "10-30%", "30-50%", "50%+"] },
      { id: "full-35", text: "Какая максимальная доля одного актива допустима без отдельного решения?", answerKind: "choice", options: ["До 10%", "10-20%", "20-30%", "30%+"] },
      { id: "full-36", text: "Какие активы или инструменты должны быть запрещены в долгосрочном портфеле?", answerKind: "open", placeholder: "Например: мемкоины, плечо, низколиквидные токены" },
      { id: "full-37", text: "Нужен ли отдельный спекулятивный блок?", answerKind: "choice", options: ["Нет", "Только обучение", "До 5%", "До 10%", "Больше 10%"] },
      { id: "full-38", text: "Если будет активный трейдинг, как он должен быть отделён?", answerKind: "choice", options: ["Не нужен", "Отдельный бюджет", "Отдельный счёт", "Отдельный счёт и журнал"] },
      { id: "full-39", text: "Какое отношение к плечу?", answerKind: "choice", options: ["Запрещено", "Только хедж", "Только с лимитом убытка", "Допустимо в отдельном блоке"] },
      { id: "full-40", text: "Какое правило должно останавливать сделку с плечом?", answerKind: "choice", options: ["Лимит убытка", "Запас до ликвидации", "Размер позиции", "Все вместе"] },
    ],
  },
  {
    title: "Способность принимать риск",
    questions: [
      { id: "full-41", text: "Какую сумму и в какой валюте ты реально можешь пополнять каждый месяц?", answerKind: "open", placeholder: "Например: 20 000 RUB в месяц, иногда $300, зависит от дохода" },
      { id: "full-42", text: "Насколько стабилен активный доход на 12 месяцев вперёд?", answerKind: "choice", options: ["Нестабилен", "Средний", "Стабильный", "Очень стабильный"] },
      { id: "full-43", text: "Сколько месяцев можно жить без продажи инвестиций при потере дохода?", answerKind: "choice", options: ["0-1 месяц", "1-3 месяца", "3-6 месяцев", "6+ месяцев"] },
      { id: "full-44", text: "Есть ли долги или обязательства, которые конкурируют с инвестициями?", answerKind: "choice", options: ["Нет", "Низкая нагрузка", "Средняя нагрузка", "Высокая нагрузка"] },
      { id: "full-45", text: "Какой резерв вне портфеля нужен, чтобы спокойно принимать риск?", answerKind: "open", placeholder: "Сумма, валюта или месяцы расходов" },
      { id: "full-46", text: "Какие источники капитала кроме портфеля могут поддержать план?", answerKind: "open", placeholder: "Работа, бизнес, подработка, недвижимость, семейный резерв" },
    ],
  },
  {
    title: "Самооценка и ограничения",
    questions: [
      { id: "full-47", text: "Какая одна тема сейчас сильнее всего ограничивает качество твоих решений?", answerKind: "choice", options: ["Риск-менеджмент", "Психология", "Макро", "Фундаментал", "Теханализ", "Налоги"] },
      { id: "full-48", text: "Что чаще всего мешает соблюдать систему?", answerKind: "choice", options: ["Эмоции", "Нехватка данных", "FOMO", "Отсутствие времени", "Нет проблемы"] },
      { id: "full-49", text: "Какие особенности твоего характера система должна учитывать?", answerKind: "open", placeholder: "Например: азарт, нетерпение, осторожность, желание всё контролировать" },
      { id: "full-50", text: "Какой формат рекомендаций ты реально будешь соблюдать?", answerKind: "choice", options: ["Жёсткие запреты", "Лимиты по долям", "Пошаговый план", "Сигналы перед сделкой", "Разбор после ошибок"] },
    ],
  },
];

export const MAIN_INVESTOR_DNA: InvestorDNA = {
  id: "main-aggressive-growth-active-allocator",
  accountId: "main",
  title: "ДНК Инвестора",
  investorType: "Долгосрочный риск-ориентированный инвестор",
  thesis:
    "Высокая готовность к волатильности и активной аллокации, но текущая способность принимать риск ограничена отсутствием отдельной финансовой подушки.",
  profile: MAIN_INVESTOR_PROFILE,
  riskWillingness: {
    label: "Готовность к риску",
    value: 83,
    note: "Готовность докупать в просадках высокая, паническая продажа маловероятна.",
  },
  riskCapacity: {
    label: "Способность принимать риск",
    value: 40,
    note: "До создания финансовой подушки риск нельзя масштабировать быстрее денежного потока.",
  },
  horizon: "Пожизненный горизонт, капитал не планируется выводить.",
  capitalGoal: "$100 000 как амбициозный ориентир, срок можно двигать.",
  benchmarkVerdict:
    "$100 000 за 5 лет не должны становиться требованием 30-40% среднегодовой доходности от портфеля. Основной рычаг ранней стадии - рост дохода и пополнений.",
  maxDrawdownRule:
    "Рабочий лимит инвестдекларации: -30-40%. -60%+ считать стресс-сценарием, а не нормальным режимом.",
  stressDrawdown:
    "При крупном капитале $100k -> $50k психологически уже тяжело, поэтому лимит должен опираться на правила, не на декларацию.",
  liquidityRule:
    "Финансовая подушка отдельно от портфеля: 3 месяца обязательных платежей. Инвестиционный резерв не смешивать с деньгами на жизнь.",
  tradingBudgetRule:
    "Активный трейдинг отдельно от долгосрочного капитала, максимум 10% капитала.",
  leverageRule:
    "Кредитное плечо не базовый ускоритель. Разрешать только после бюджета риска: максимальный убыток, расстояние до ликвидации, запас обеспечения.",
  keyVerdict:
    "Риск можно принимать для роста, но нельзя принимать риск, который лишает возможности продолжать инвестировать.",
  recommendations: [
    {
      id: "main-emergency-reserve",
      priority: "critical",
      area: "резерв",
      title: "Создать офлайн-подушку",
      action: "Накопить финансовую подушку на 3 месяца обязательных платежей отдельно от инвестиционного портфеля.",
      reason: "Сейчас при потере активного дохода придётся продавать инвестиции, возможно в просадке.",
      expectedEffect: "Повысит способность принимать риск и снизит риск вынужденной фиксации убытка.",
    },
    {
      id: "main-benchmark-reset",
      priority: "high",
      area: "цель",
      title: "Смягчить ориентир $100 000",
      action: "Оставить $100 000 целью, но считать срок гибким и разделить рост капитала на доходность портфеля и пополнения.",
      reason: "Математика ранней стадии не должна толкать портфель в 30-40% обязательной доходности.",
      expectedEffect: "Снизит давление на риск и уменьшит стимул к плечу и смене стиля.",
    },
    {
      id: "main-risk-management-study",
      priority: "high",
      area: "обучение",
      title: "Подтянуть риск-менеджмент",
      action: "Сфокусироваться на размере позиции, максимальном убытке, контроле просадки, риске ликвидации и журнале решений.",
      reason: "Самооценка риск-менеджмента 5/10 при крипте, децентрализованных финансах, концентрации и допускаемом плече.",
      expectedEffect: "Повысит качество решений до масштабирования капитала.",
    },
    {
      id: "main-leverage-budget",
      priority: "medium",
      area: "риск",
      title: "Формализовать бюджет плеча",
      action: "До отдельного бюджета риска не увеличивать плечо как способ ускорить достижение цели.",
      reason: "Плечо превращает временную волатильность в риск ликвидации.",
      expectedEffect: "Сохранит принцип никогда не выйти из игры.",
    },
  ],
  liteQuestionCount: 12,
  fullAuditQuestionCount: 50,
  liteQuestions: MAIN_LITE_QUESTIONS,
  fullQuestionGroups: MAIN_FULL_QUESTION_GROUPS,
  auditSections: [
    "финансовая база",
    "цели и горизонт",
    "готовность к риску",
    "способность принимать риск",
    "ликвидность",
    "поведение",
    "активное управление и плечо",
    "опыт и знания",
  ],
  ipsOutputs: [
    "профиль инвестора",
    "бюджет риска",
    "лимит максимальной просадки",
    "правило ликвидности",
    "бюджет активного управления",
    "политика кредитного плеча",
    "правила ребалансировки",
  ],
};

export const WIFE_INVESTOR_DNA: InvestorDNA = {
  id: "wife-protective-long-term-accumulator",
  accountId: "wife",
  title: "ДНК Инвестора",
  investorType: "Защитный долгосрочный накопитель",
  thesis:
    "Защитное долгосрочное накопление: стратегия должна защищать резерв, исключать фьючерсы и случайные спекулятивные активы.",
  profile: WIFE_INVESTOR_PROFILE,
  riskWillingness: {
    label: "Готовность к риску",
    value: 35,
    note: "Покупки только по плану, без импульсного активного риска.",
  },
  riskCapacity: {
    label: "Способность принимать риск",
    value: 45,
    note: "Способность принимать риск должна расти через резерв и регулярное накопление, не через риск.",
  },
  horizon: "Длинный горизонт накопления.",
  capitalGoal: "Накопление капитала без агрессивной торговли.",
  benchmarkVerdict: "Цель не должна требовать спекулятивного блока или фьючерсов.",
  maxDrawdownRule: "Рабочий режим: средне-низкая терпимость к просадке.",
  stressDrawdown: "Сильные просадки не должны усиливаться через случайные докупки.",
  liquidityRule: "Высокая важность резерва, покупки ниже нормы резерва блокируются или усиливаются предупреждением.",
  tradingBudgetRule: "Активный трейдинг не подходит.",
  leverageRule: "Фьючерсы и кредитное плечо не подходят.",
  keyVerdict:
    "Главная задача - спокойное накопление по плану; риск не должен усложнять жизнь инвестора.",
  recommendations: [
    {
      id: "wife-plan-only",
      priority: "critical",
      area: "дисциплина",
      title: "Покупки только по плану",
      action: "Разрешать новые покупки только в рамках стратегии и заранее выбранных активов.",
      reason: "Портрет защитный, случайные спекулятивные решения не подходят.",
      expectedEffect: "Сохранит простоту портфеля и снизит эмоциональный риск.",
    },
    {
      id: "wife-no-futures",
      priority: "critical",
      area: "риск",
      title: "Исключить фьючерсы",
      action: "Держать фьючерсы и кредитное плечо в режиме блокировки для аккаунта Полины.",
      reason: "Фьючерсы не соответствуют защитному долгосрочному накоплению.",
      expectedEffect: "Убирает риск ликвидации и сложного активного управления.",
    },
  ],
  liteQuestionCount: 12,
  fullAuditQuestionCount: 50,
  liteQuestions: MAIN_LITE_QUESTIONS,
  fullQuestionGroups: MAIN_FULL_QUESTION_GROUPS,
  auditSections: ["горизонт", "резерв", "просадка", "ликвидность", "дисциплина", "опыт"],
  ipsOutputs: ["профиль инвестора", "правило резерва", "разрешённые активы", "запрещённые инструменты"],
};

export const INVESTOR_DNA = {
  main: MAIN_INVESTOR_DNA,
  wife: WIFE_INVESTOR_DNA,
} satisfies Record<InvestorStrategyId, InvestorDNA>;

export function dnaForSlot(slot?: string | null): InvestorDNA {
  return slot === "wife" ? WIFE_INVESTOR_DNA : MAIN_INVESTOR_DNA;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

const number = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const accountId = (value: unknown, fallback: InvestorStrategyId): InvestorStrategyId =>
  value === "wife" ? "wife" : value === "main" ? "main" : fallback;

function normalizeScore(value: unknown, fallback: InvestorDNAScore): InvestorDNAScore {
  if (!isRecord(value)) return fallback;

  return {
    label: text(value.label, fallback.label),
    value: number(value.value, fallback.value),
    note: text(value.note, fallback.note),
  };
}

function normalizeRecommendation(value: unknown): InvestorDNARecommendation | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, "");
  const title = text(value.title, "");
  if (!id || !title) return null;

  const priority = value.priority === "critical" || value.priority === "high" || value.priority === "medium"
    ? value.priority
    : "medium";

  return {
    id,
    priority,
    area: text(value.area, "риск") as InvestorDNARecommendation["area"],
    title,
    action: text(value.action, ""),
    reason: text(value.reason, ""),
    expectedEffect: text(value.expectedEffect, ""),
  };
}

function normalizeAuditAnswer(value: unknown, fallbackAccountId: InvestorStrategyId): InvestorDNAAuditAnswer | null {
  if (!isRecord(value)) return null;
  const questionId = text(value.questionId, "");
  if (!questionId) return null;

  return {
    auditId: text(value.auditId, ""),
    accountId: accountId(value.accountId, fallbackAccountId),
    auditType: value.auditType === "full" ? "full" : "lite",
    questionId,
    option: text(value.option, ""),
    note: text(value.note, ""),
    answeredAt: text(value.answeredAt, ""),
    source: text(value.source, "google-sheets"),
  };
}

function normalizeAuditResult(value: unknown, fallbackAccountId: InvestorStrategyId): InvestorDNAAuditResult | null {
  if (!isRecord(value)) return null;
  const auditId = text(value.auditId, "");
  if (!auditId) return null;

  return {
    auditId,
    accountId: accountId(value.accountId, fallbackAccountId),
    auditType: value.auditType === "full" ? "full" : "lite",
    submittedAt: text(value.submittedAt, ""),
    answeredCount: number(value.answeredCount, 0),
    totalQuestions: number(value.totalQuestions, 0),
    profileId: text(value.profileId, ""),
    investorType: text(value.investorType, ""),
    riskWillingness: number(value.riskWillingness, 0),
    riskCapacity: number(value.riskCapacity, 0),
    resultNote: text(value.resultNote, ""),
  };
}

export function normalizeInvestorDNAFromApi(value: unknown, fallback: InvestorDNA): InvestorDNA {
  if (!isRecord(value)) return fallback;

  const normalizedAccountId = accountId(value.accountId, fallback.accountId);
  const recommendations = Array.isArray(value.recommendations)
    ? value.recommendations
        .map(normalizeRecommendation)
        .filter((item): item is InvestorDNARecommendation => item !== null)
    : fallback.recommendations;
  const answers = Array.isArray(value.answers)
    ? value.answers
        .map((item) => normalizeAuditAnswer(item, normalizedAccountId))
        .filter((item): item is InvestorDNAAuditAnswer => item !== null)
    : fallback.answers;
  const auditHistory = Array.isArray(value.auditHistory)
    ? value.auditHistory
        .map((item) => normalizeAuditResult(item, normalizedAccountId))
        .filter((item): item is InvestorDNAAuditResult => item !== null)
    : fallback.auditHistory;

  return {
    ...fallback,
    accountId: normalizedAccountId,
    id: text(value.id, fallback.id),
    title: text(value.title, fallback.title),
    investorType: text(value.investorType, fallback.investorType),
    thesis: text(value.thesis, fallback.thesis),
    riskWillingness: normalizeScore(value.riskWillingness, fallback.riskWillingness),
    riskCapacity: normalizeScore(value.riskCapacity, fallback.riskCapacity),
    horizon: text(value.horizon, fallback.horizon),
    capitalGoal: text(value.capitalGoal, fallback.capitalGoal),
    benchmarkVerdict: text(value.benchmarkVerdict, fallback.benchmarkVerdict),
    maxDrawdownRule: text(value.maxDrawdownRule, fallback.maxDrawdownRule),
    stressDrawdown: text(value.stressDrawdown, fallback.stressDrawdown),
    liquidityRule: text(value.liquidityRule, fallback.liquidityRule),
    tradingBudgetRule: text(value.tradingBudgetRule, fallback.tradingBudgetRule),
    leverageRule: text(value.leverageRule, fallback.leverageRule),
    keyVerdict: text(value.keyVerdict, fallback.keyVerdict),
    recommendations,
    answers,
    auditHistory,
  };
}
