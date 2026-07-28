type EducationStage = {
  id: string;
  stage: string;
  title: string;
  topics: string[];
};

const EDUCATION_STAGES: EducationStage[] = [
  {
    id: "machine",
    stage: "Этап I",
    title: "Как работает экономическая машина",
    topics: [
      "Деньги",
      "Банковская система",
      "Кредит",
      "Долг",
      "Процентные ставки",
      "Центральные банки",
      "Денежная масса",
      "Ликвидность",
      "Инфляция",
      "Экономический рост",
      "Экономические циклы",
      "Рецессия",
      "Долговые циклы",
      "Сокращение долговой нагрузки",
    ],
  },
  {
    id: "bonds",
    stage: "Этап II",
    title: "Рынок облигаций",
    topics: [
      "Облигации",
      "Цена облигации",
      "Доходность облигации",
      "Купон",
      "Срок погашения",
      "Дюрация",
      "Государственные облигации",
      "Казначейские облигации США",
      "Кривая доходности",
      "Инверсия кривой доходности",
      "Кредитный спред",
      "Номинальная доходность",
      "Реальная доходность",
    ],
  },
  {
    id: "assets",
    stage: "Этап III",
    title: "Классы активов",
    topics: [
      "Денежные средства",
      "Депозиты и инструменты денежного рынка",
      "Облигации",
      "Акции",
      "Золото",
      "Сырьевые товары",
      "Недвижимость",
      "Криптовалюты",
      "Производные финансовые инструменты",
      "Альтернативные инвестиции",
    ],
  },
  {
    id: "business",
    stage: "Этап IV",
    title: "Как устроен бизнес",
    topics: [
      "Бизнес-модель компании",
      "Выручка",
      "Расходы",
      "Прибыль",
      "Отчёт о прибылях и убытках",
      "Баланс компании",
      "Отчёт о движении денежных средств",
      "Операционный денежный поток",
      "Капитальные расходы",
      "Свободный денежный поток",
      "Долговая нагрузка",
      "Маржинальность",
      "Рентабельность капитала",
      "ROE",
      "ROIC",
      "Оценка стоимости компании",
      "Мультипликаторы",
      "DCF-анализ",
    ],
  },
  {
    id: "portfolio",
    stage: "Этап V",
    title: "Управление инвестиционным портфелем",
    topics: [
      "Ожидаемая доходность",
      "Риск",
      "Волатильность",
      "Корреляция активов",
      "Диверсификация",
      "Максимальная просадка",
      "Размер позиции",
      "Распределение капитала",
      "Распределение по классам активов",
      "Ребалансировка",
      "Соотношение риска и доходности",
      "Доходность с поправкой на риск",
      "Коэффициент Шарпа",
      "Управление рисками",
    ],
  },
  {
    id: "funds",
    stage: "Этап VI",
    title: "Как работают инвестиционные фонды",
    topics: [
      "Инвестиционный фонд",
      "Паевой / взаимный фонд",
      "ETF",
      "Хедж-фонд",
      "Пенсионный фонд",
      "Фонд прямых инвестиций",
      "Венчурный фонд",
      "Семейный инвестиционный офис",
      "Суверенный фонд",
      "Структура фонда",
      "Привлечение капитала",
      "Инвестиционный мандат",
      "Инвестиционная стратегия",
      "Управление портфелем",
      "Управление рисками",
      "Использование кредитного плеча",
      "Хеджирование",
      "Система принятия инвестиционных решений",
    ],
  },
];

export function V2EducationPage() {
  const totalTopics = EDUCATION_STAGES.reduce((sum, stage) => sum + stage.topics.length, 0);

  return (
    <section className="v2-edu-page" aria-label="Обучение">
      <div className="v2-edu-header">
        <div>
          <span className="v2-edu-kicker">Учебная карта</span>
          <h1>Обучение</h1>
        </div>
        <div className="v2-edu-stats" aria-label="Структура обучения">
          <span>{EDUCATION_STAGES.length} этапов</span>
          <strong>{totalTopics} тем</strong>
        </div>
      </div>

      <div className="v2-edu-grid">
        {EDUCATION_STAGES.map((stage, index) => (
          <details className="v2-edu-stage" key={stage.id}>
            <summary>
              <span className="v2-edu-stage-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="v2-edu-stage-copy">
                <span>{stage.stage}</span>
                <strong>{stage.title}</strong>
              </span>
              <span className="v2-edu-stage-count">{stage.topics.length} тем</span>
              <span className="v2-edu-stage-chevron" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 4.5 6 7.5l3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </summary>

            <div className="v2-edu-topic-list">
              {stage.topics.map((topic, topicIndex) => (
                <div className="v2-edu-topic" key={topic}>
                  <span className="v2-edu-topic-num">{String(topicIndex + 1).padStart(2, "0")}</span>
                  <span className="v2-edu-topic-title">{topic}</span>
                  <span className="v2-edu-topic-state">пусто</span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
