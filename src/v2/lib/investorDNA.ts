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
  { id: "lite-1", text: "Какая главная цель капитала: защита, пассивный доход, рост или агрессивный рост?" },
  { id: "lite-2", text: "Когда деньги могут понадобиться: до 3 лет, 3-5 лет, 5-10 лет или капитал не планируется выводить?" },
  { id: "lite-3", text: "Есть ли отдельная финансовая подушка вне инвестиционного портфеля?" },
  { id: "lite-4", text: "Сколько месяцев обязательных платежей ты выдержишь без активного дохода?" },
  { id: "lite-5", text: "Какая просадка портфеля уже мешает спокойно спать: -10%, -20%, -30%, -40%, -50%?" },
  { id: "lite-6", text: "Если рынок упал на -40%, а тезис не сломан, ты продаёшь, держишь или докупаешь?" },
  { id: "lite-7", text: "Что хуже: потерять капитал, отстать от индекса или пропустить сильный рост?" },
  { id: "lite-8", text: "Какая доля портфеля может быть в крипте на текущем этапе?" },
  { id: "lite-9", text: "Допустим ли активный трейдинг отдельно от долгосрочного портфеля?" },
  { id: "lite-10", text: "Какая максимальная доля капитала может быть в активном трейдинге?" },
  { id: "lite-11", text: "Допустимо ли кредитное плечо и при каких условиях?" },
  { id: "lite-12", text: "Какие знания сейчас слабее всего: акции, макроэкономика, риск-менеджмент, психология или анализ активов?" },
];

const MAIN_FULL_QUESTION_GROUPS: InvestorDNAQuestionGroup[] = [
  {
    title: "Финансовая база",
    questions: [
      { id: "full-1", text: "Какой общий размер капитала с учётом активов и долгов?" },
      { id: "full-2", text: "Какая сумма сейчас находится именно в инвестиционном портфеле?" },
      { id: "full-3", text: "Сколько свободного капитала можно дополнительно инвестировать ежегодно?" },
      { id: "full-4", text: "Есть ли резерв вне инвестиционного портфеля и на сколько месяцев расходов его хватит?" },
      { id: "full-5", text: "Какая доля капитала может понадобиться в ближайшие 3 года?" },
      { id: "full-6", text: "Есть ли крупные обязательства на ближайшие 3-5 лет?" },
      { id: "full-7", text: "Насколько текущий доход зависит от инвестиционного портфеля?" },
    ],
  },
  {
    title: "Цели и горизонт",
    questions: [
      { id: "full-8", text: "Главная цель портфеля?" },
      { id: "full-9", text: "Какой капитал хочется получить?" },
      { id: "full-10", text: "За какой срок хочется достичь этой суммы?" },
      { id: "full-11", text: "Планируется ли увеличивать ежегодные пополнения?" },
      { id: "full-12", text: "Что важнее: сохранность, умеренный рост, сильный рост или максимизация капитала?" },
      { id: "full-13", text: "Когда портфель станет большим, для чего он будет нужен?" },
      { id: "full-14", text: "Какой реальный инвестиционный горизонт?" },
    ],
  },
  {
    title: "Риск и просадки",
    questions: [
      { id: "full-15", text: "Портфель $10 000 упал до $8 000. Что делаешь?" },
      { id: "full-16", text: "Портфель $10 000 упал до $7 000. Что делаешь?" },
      { id: "full-17", text: "Портфель $10 000 упал до $5 000. Что делаешь?" },
      { id: "full-18", text: "Портфель $100 000 упал до $50 000. Ответ будет тем же?" },
      { id: "full-19", text: "Какая максимальная просадка приемлема для стратегии?" },
      { id: "full-20", text: "Рынок упал на -40%, тезис не сломан, есть свободные деньги. Что делаешь?" },
      { id: "full-21", text: "Что хуже: потерять 30%, получить 0%, отстать от рынка или пропустить рост в 10 раз?" },
      { id: "full-22", text: "Какую связку доходности и просадки выбираешь на 10 лет?" },
    ],
  },
  {
    title: "Поведенческий риск",
    questions: [
      { id: "full-23", text: "Паника длится 12 месяцев, покупки уже были, рынок падает дальше. Что делаешь?" },
      { id: "full-24", text: "Один актив упал на -60%, рынок упал только на -20%. Что делаешь?" },
      { id: "full-25", text: "Что важнее: не фиксировать убыток, сохранить капитал, следовать системе или быстро вернуть потерянное?" },
      { id: "full-26", text: "Портфель $100 000 -> $140 000 -> $85 000. Какая цифра психологически важнее?" },
      { id: "full-27", text: "После трёх лет портфель отстал от индекса. Что беспокоит сильнее?" },
      { id: "full-28", text: "Сможешь ли 6 месяцев ничего не покупать и не продавать, если система говорит ждать?" },
      { id: "full-29", text: "Как относишься к кредитному плечу?" },
      { id: "full-30", text: "Что для тебя означает быть хорошим инвестором?" },
    ],
  },
  {
    title: "Структура портфеля",
    questions: [
      { id: "full-31", text: "Какие рынки и классы активов хочешь использовать?" },
      { id: "full-32", text: "Какую долю портфеля готов держать в крипте?" },
      { id: "full-33", text: "Готов ли держать один актив на 30-50% портфеля?" },
      { id: "full-34", text: "Максимальная доля одного высокорискового актива?" },
      { id: "full-35", text: "Какая минимальная доля портфеля должна оставаться ликвидной?" },
      { id: "full-36", text: "Что ближе: пассивный портфель, 70/30, 50/50 или активное управление?" },
      { id: "full-37", text: "Хочешь ли заниматься трейдингом отдельно от инвестиционного портфеля?" },
      { id: "full-38", text: "Как часто готов заниматься инвестициями?" },
      { id: "full-39", text: "Какие инструменты уже реально использовал?" },
      { id: "full-40", text: "Оцени знания по крипте, акциям, макроэкономике, фундаментальному анализу, техническому анализу и риск-менеджменту." },
    ],
  },
  {
    title: "Способность принимать риск",
    questions: [
      { id: "full-41", text: "Какой средний чистый доход в месяц?" },
      { id: "full-42", text: "Сколько обязательных расходов в месяц?" },
      { id: "full-43", text: "Какой платёж по ипотеке?" },
      { id: "full-44", text: "Есть ли кредиты или долги: остаток, ставка, ежемесячный платёж?" },
      { id: "full-45", text: "Насколько стабилен активный доход?" },
      { id: "full-46", text: "Если завтра потерять активный доход, сколько месяцев можно жить без продажи инвестиций?" },
      { id: "full-47", text: "Какой резерв нужно создать отдельно от инвестиционного портфеля?" },
      { id: "full-48", text: "Есть ли недвижимость, бизнес или другой капитал вне инвестиционного портфеля?" },
      { id: "full-49", text: "$100 000 через 5 лет - это необходимость, важная цель, ориентир или гибкий амбициозный рубеж?" },
      { id: "full-50", text: "Готов ли увеличивать активный доход и пополнения вместо попытки выжать чрезмерную доходность из портфеля?" },
    ],
  },
];

export const MAIN_INVESTOR_DNA: InvestorDNA = {
  id: "main-aggressive-growth-active-allocator",
  accountId: "main",
  title: "ДНК Инвестора",
  investorType: "Агрессивный рост / Активный распределитель капитала",
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
