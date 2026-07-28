import { useEffect, useMemo, useState } from "react";

import { saveInvestorDNAAudit } from "../../api/investorDNA";
import { INVESTOR_API_URL, WIFE_API_URL } from "../../config/constants";
import type { InvestorDNA, InvestorDNAQuestion, InvestorDNARecommendation } from "../lib/investorDNA";

type Props = {
  dna: InvestorDNA;
  onNavigate?: (page: "health" | "gate") => void;
};

const priorityLabel: Record<InvestorDNARecommendation["priority"], string> = {
  critical: "Критично",
  high: "Важно",
  medium: "Наблюдать",
};

const priorityClass: Record<InvestorDNARecommendation["priority"], string> = {
  critical: "is-block",
  high: "",
  medium: "",
};

type AuditKind = "lite" | "full";

type AuditAnswer = {
  option: string;
  note: string;
};

const defaultAnswerOptions = ["Не подходит", "Скорее нет", "Скорее да", "Полностью да"];

const liteAnswerOptions: Record<string, string[]> = {
  "lite-1": ["Защита", "Пассивный доход", "Рост", "Агрессивный рост"],
  "lite-2": ["До 3 лет", "3-5 лет", "5-10 лет", "Не планирую выводить"],
  "lite-3": ["Нет", "1 месяц", "3 месяца", "6+ месяцев"],
  "lite-4": ["0-1 месяц", "1-3 месяца", "3-6 месяцев", "6+ месяцев"],
  "lite-5": ["-10%", "-20%", "-30%", "-40% и ниже"],
  "lite-6": ["Продаю", "Держу", "Докупаю по плану", "Увеличиваю риск"],
  "lite-7": ["Потерять капитал", "Отстать от индекса", "Пропустить рост", "Не знаю"],
  "lite-8": ["До 10%", "10-30%", "30-50%", "50%+"],
  "lite-9": ["Нет", "Только учебно", "Отдельным бюджетом", "Да, активно"],
  "lite-10": ["0%", "До 5%", "До 10%", "Больше 10%"],
  "lite-11": ["Нет", "Только хедж", "Только с лимитом убытка", "Допустимо"],
  "lite-12": ["Акции/макро", "Риск-менеджмент", "Психология", "Анализ активов"],
};

function answerOptionsFor(question: InvestorDNAQuestion): string[] {
  if (liteAnswerOptions[question.id]) {
    return liteAnswerOptions[question.id];
  }

  if (question.id === "full-15" || question.id === "full-16" || question.id === "full-17" || question.id === "full-20") {
    return ["Продаю", "Снижаю риск", "Держу", "Докупаю по плану"];
  }

  if (question.id === "full-4" || question.id === "full-46" || question.id === "full-47") {
    return ["Нет резерва", "1-3 месяца", "3-6 месяцев", "6+ месяцев"];
  }

  if (question.id === "full-19") {
    return ["До -10%", "До -20%", "До -30-40%", "-50% и ниже"];
  }

  if (question.id === "full-22") {
    return ["Низкая просадка", "Умеренный рост", "Сильный рост", "Максимум капитала"];
  }

  if (question.id === "full-29") {
    return ["Не подходит", "Только хедж", "Только с бюджетом риска", "Допустимо активно"];
  }

  if (question.id === "full-32" || question.id === "full-34" || question.id === "full-35") {
    return ["До 10%", "10-30%", "30-50%", "50%+"];
  }

  if (question.id === "full-36") {
    return ["Пассивный", "70/30", "50/50", "Активное управление"];
  }

  if (question.id === "full-37") {
    return ["Нет", "Только обучение", "Отдельный бюджет", "Да"];
  }

  return defaultAnswerOptions;
}

function ScorePill({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="v2-hp-policy-panel">
      <div className="v2-hp-policy-kicker">{label}</div>
      <div className="v2-hp-policy-row">
        <span>Оценка</span>
        <strong>{value}/100</strong>
      </div>
      <div className="v2-hp-policy-ray">
        <span>Смысл</span>
        <em>{note}</em>
      </div>
    </div>
  );
}

function RecommendationRow({ item }: { item: InvestorDNARecommendation }) {
  return (
    <div className="v2-hp-policy-panel">
      <div className="v2-hp-policy-kicker">{priorityLabel[item.priority]} · {item.area}</div>
      <div className={`v2-hp-policy-row ${priorityClass[item.priority]}`}>
        <span>{item.title}</span>
        <strong>{item.priority === "critical" ? "обязательно" : "важно"}</strong>
      </div>
      <div className="v2-hp-policy-rays">
        <div className="v2-hp-policy-ray">
          <span>Действие</span>
          <em>{item.action}</em>
        </div>
        <div className="v2-hp-policy-ray">
          <span>Почему</span>
          <em>{item.reason}</em>
        </div>
        <div className="v2-hp-policy-ray">
          <span>Эффект</span>
          <em>{item.expectedEffect}</em>
        </div>
      </div>
    </div>
  );
}

function AuditQuestion({
  question,
  answer,
  groupTitle,
  number,
  onChoice,
  onNote,
}: {
  question: InvestorDNAQuestion;
  answer?: AuditAnswer;
  groupTitle?: string;
  number: number;
  onChoice: (questionId: string, option: string) => void;
  onNote: (questionId: string, note: string) => void;
}) {
  const options = answerOptionsFor(question);

  return (
    <div className="v2-dna-question-card">
      <div className="v2-dna-question-head">
        <div>
          <div className="v2-hp-policy-kicker">Вопрос {number}</div>
          {groupTitle && <span>{groupTitle}</span>}
        </div>
        <p>{question.text}</p>
      </div>
      <div className="v2-dna-options" role="group" aria-label={`Варианты ответа на вопрос ${number}`}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`v2-dna-option${answer?.option === option ? " is-selected" : ""}`}
            aria-pressed={answer?.option === option}
            onClick={() => onChoice(question.id, option)}
          >
            {option}
          </button>
        ))}
      </div>
      <textarea
        className="v2-dna-note"
        rows={2}
        value={answer?.note ?? ""}
        onChange={(event) => onNote(question.id, event.target.value)}
        placeholder="Свободное поле: суммы, исключения, контекст, что важно учесть"
      />
    </div>
  );
}

export function V2InvestorDNAPage({ dna, onNavigate }: Props) {
  const [openAudit, setOpenAudit] = useState<AuditKind | null>(null);
  const [answers, setAnswers] = useState<Record<string, AuditAnswer>>({});
  const [auditResult, setAuditResult] = useState<Partial<Record<AuditKind, string>>>({});
  const [savingAudit, setSavingAudit] = useState<AuditKind | null>(null);

  const fullQuestions = useMemo(
    () =>
      dna.fullQuestionGroups.flatMap((group) =>
        group.questions.map((question) => ({
          ...question,
          groupTitle: group.title,
        })),
      ),
    [dna.fullQuestionGroups],
  );

  const profileRows = [
    { label: "Тип инвестора", value: dna.investorType },
    { label: "Горизонт", value: dna.horizon },
    { label: "Цель", value: dna.capitalGoal },
    { label: "Просадка", value: dna.maxDrawdownRule },
    { label: "Ликвидность", value: dna.liquidityRule },
    { label: "Активное управление", value: dna.tradingBudgetRule },
    { label: "Кредитное плечо", value: dna.leverageRule },
  ];
  const accountLabel = dna.accountId === "wife" ? "Полина" : "Основной";
  const savedAnswers = useMemo(
    () =>
      (dna.answers ?? []).reduce<Record<string, AuditAnswer>>((acc, answer) => {
        acc[answer.questionId] = {
          option: answer.option,
          note: answer.note,
        };
        return acc;
      }, {}),
    [dna.answers],
  );
  const liteAnswered = dna.liteQuestions.filter((question) => {
    const answer = answers[question.id];
    return Boolean(answer?.option || answer?.note.trim());
  }).length;

  useEffect(() => {
    setAnswers((current) => (Object.keys(current).length ? current : savedAnswers));
  }, [savedAnswers]);
  const fullAnswered = fullQuestions.filter((question) => {
    const answer = answers[question.id];
    return Boolean(answer?.option || answer?.note.trim());
  }).length;

  function updateChoice(questionId: string, option: string) {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        option,
        note: current[questionId]?.note ?? "",
      },
    }));
  }

  function updateNote(questionId: string, note: string) {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        option: current[questionId]?.option ?? "",
        note,
      },
    }));
  }

  async function submitAudit(kind: AuditKind) {
    const total = kind === "lite" ? dna.liteQuestionCount : dna.fullAuditQuestionCount;
    const answered = kind === "lite" ? liteAnswered : fullAnswered;
    const questions = kind === "lite" ? dna.liteQuestions : fullQuestions;
    const submittedAt = new Date().toISOString();
    const payloadAnswers = questions
      .map((question) => ({
        questionId: question.id,
        option: answers[question.id]?.option ?? "",
        note: answers[question.id]?.note.trim() ?? "",
      }))
      .filter((answer) => answer.option || answer.note);

    setAuditResult((current) => ({
      ...current,
      [kind]: `Ответы приняты локально: заполнено ${answered} из ${total}. Следующий шаг - пересчёт риск-профиля, профиля инвестора и инвестдекларации.`,
    }));
    setOpenAudit(kind);
    setSavingAudit(kind);

    try {
      await saveInvestorDNAAudit(
        {
          accountId: dna.accountId,
          auditType: kind,
          submittedAt,
          answeredCount: answered,
          totalQuestions: total,
          answers: payloadAnswers,
        },
        dna.accountId === "wife" ? WIFE_API_URL : INVESTOR_API_URL,
      );
      setAuditResult((current) => ({
        ...current,
        [kind]: `Ответы сохранены в Google Sheets: заполнено ${answered} из ${total}. История аудита обновится после следующей загрузки данных.`,
      }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "неизвестная ошибка";
      setAuditResult((current) => ({
        ...current,
        [kind]: `Ответы приняты локально: заполнено ${answered} из ${total}. Сохранение в Google Sheets пока не прошло: ${reason}.`,
      }));
    } finally {
      setSavingAudit(null);
    }
  }

  return (
    <div className="v2-hp-page" aria-label="ДНК Инвестора">
      <section className="v2-hp-policy-card">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">ДНК Инвестора</div>
            <h2>{dna.investorType}</h2>
          </div>
          <span className="v2-hp-policy-badge">{accountLabel}</span>
        </div>
        <div className="v2-hp-policy-grid">
          <div className="v2-hp-policy-panel">
            <div className="v2-hp-policy-kicker">Финальный вердикт</div>
            <div className="v2-hp-policy-rays">
              <div className="v2-hp-policy-ray">
                <span>Диагноз</span>
                <em>{dna.thesis}</em>
              </div>
              <div className="v2-hp-policy-ray">
                <span>Правило</span>
                <em>{dna.keyVerdict}</em>
              </div>
            </div>
          </div>
          <ScorePill {...dna.riskWillingness} />
          <ScorePill {...dna.riskCapacity} />
          <div className="v2-hp-policy-panel">
            <div className="v2-hp-policy-kicker">Ориентир капитала</div>
            <div className="v2-hp-policy-ray">
              <span>$100 000</span>
              <em>{dna.benchmarkVerdict}</em>
            </div>
          </div>
        </div>
      </section>

      <section className="v2-hp-policy-card">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">Рекомендации ДНК</div>
            <h2>Что улучшить после аудита</h2>
          </div>
          <span className="v2-hp-policy-badge">{dna.recommendations.length} действия</span>
        </div>
        <div className="v2-hp-policy-grid">
          {dna.recommendations.map((item) => (
            <RecommendationRow key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="v2-hp-policy-card">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">Анкетирование</div>
            <h2>Аудиты ДНК</h2>
          </div>
          <span className="v2-hp-policy-badge">Первичный + полный</span>
        </div>

        <div className="v2-dna-audit-stack">
          <div className="v2-dna-audit-shell">
            <button
              className="v2-dna-audit-toggle"
              type="button"
              aria-expanded={openAudit === "lite"}
              onClick={() => setOpenAudit(openAudit === "lite" ? null : "lite")}
            >
              <span>
                <em>Первичный аудит</em>
                <strong>Быстрая анкета для первого профиля и грубых ограничений риска.</strong>
              </span>
              <b>{liteAnswered}/{dna.liteQuestionCount} · {openAudit === "lite" ? "Свернуть" : "Раскрыть"}</b>
            </button>
            {openAudit === "lite" && (
              <div className="v2-dna-audit-body">
                <div className="v2-dna-question-list">
                  {dna.liteQuestions.map((question, index) => (
                    <AuditQuestion
                      key={question.id}
                      question={question}
                      number={index + 1}
                      answer={answers[question.id]}
                      onChoice={updateChoice}
                      onNote={updateNote}
                    />
                  ))}
                </div>
                <div className="v2-dna-audit-footer">
                  <button
                    className="v2-hp-sim-btn"
                    type="button"
                    disabled={savingAudit === "lite"}
                    onClick={() => void submitAudit("lite")}
                  >
                    {savingAudit === "lite" ? "Сохраняю ответы" : "Отправить на проверку результата"}
                  </button>
                  {auditResult.lite && <span>{auditResult.lite}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="v2-dna-audit-shell">
            <button
              className="v2-dna-audit-toggle"
              type="button"
              aria-expanded={openAudit === "full"}
              onClick={() => setOpenAudit(openAudit === "full" ? null : "full")}
            >
              <span>
                <em>Полный аудит</em>
                <strong>Глубокая анкета для риск-профиля, типажа инвестора и инвестдекларации.</strong>
              </span>
              <b>{fullAnswered}/{dna.fullAuditQuestionCount} · {openAudit === "full" ? "Свернуть" : "Раскрыть"}</b>
            </button>
            {openAudit === "full" && (
              <div className="v2-dna-audit-body">
                <div className="v2-dna-question-list">
                  {dna.fullQuestionGroups.map((group) => (
                    <div key={group.title} className="v2-dna-question-group">
                      <div className="v2-dna-question-group-title">{group.title}</div>
                      {group.questions.map((question) => {
                        const questionNumber = fullQuestions.findIndex((item) => item.id === question.id) + 1;

                        return (
                          <AuditQuestion
                            key={question.id}
                            question={question}
                            groupTitle={group.title}
                            number={questionNumber}
                            answer={answers[question.id]}
                            onChoice={updateChoice}
                            onNote={updateNote}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="v2-dna-audit-footer">
                  <button
                    className="v2-hp-sim-btn"
                    type="button"
                    disabled={savingAudit === "full"}
                    onClick={() => void submitAudit("full")}
                  >
                    {savingAudit === "full" ? "Сохраняю ответы" : "Отправить на проверку результата"}
                  </button>
                  {auditResult.full && <span>{auditResult.full}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="v2-hp-policy-card">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">Состав анкет</div>
            <h2>Что проверяет ДНК</h2>
          </div>
          <span className="v2-hp-policy-badge">{dna.fullAuditQuestionCount} вопросов</span>
        </div>
        <div className="v2-hp-policy-grid">
          <div className="v2-hp-policy-panel">
            <div className="v2-hp-policy-kicker">Первичная анкета</div>
            <ul className="v2-hp-policy-list">
              {dna.liteQuestions.slice(0, 6).map((question) => (
                <li key={question.id}>{question.text}</li>
              ))}
            </ul>
          </div>
          <div className="v2-hp-policy-panel">
            <div className="v2-hp-policy-kicker">Полная анкета ДНК</div>
            <ul className="v2-hp-policy-list">
              {dna.fullQuestionGroups.map((group) => (
                <li key={group.title}>{group.title}: {group.questions.length} вопросов</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="v2-hp-policy-card">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">Профиль и инвестдекларация</div>
            <h2>От анкеты к правилам</h2>
          </div>
          <span className="v2-hp-policy-badge">Черновик правил</span>
        </div>
        <div className="v2-hp-policy-grid">
          <div className="v2-hp-policy-panel">
            <div className="v2-hp-policy-kicker">Профиль</div>
            <div className="v2-hp-policy-rays">
              {profileRows.map((row) => (
                <div key={row.label} className="v2-hp-policy-ray v2-dna-profile-rule">
                  <span>{row.label}</span>
                  <em>{row.value}</em>
                </div>
              ))}
            </div>
          </div>

          <div className="v2-hp-policy-panel">
            <div className="v2-hp-policy-kicker">Анкетирование</div>
            <div className="v2-hp-policy-rows">
              <div className="v2-hp-policy-row">
                <span>Первичная анкета</span>
                <strong>{dna.liteQuestionCount} вопросов</strong>
              </div>
              <div className="v2-hp-policy-row">
                <span>Полная анкета</span>
                <strong>{dna.fullAuditQuestionCount} вопросов</strong>
              </div>
              <div className="v2-hp-policy-ray">
                <span>Разделы</span>
                <em>{dna.auditSections.join(" / ")}</em>
              </div>
            </div>
          </div>

          <div className="v2-hp-policy-panel">
            <div className="v2-hp-policy-kicker">Выход инвестдекларации</div>
            <ul className="v2-hp-policy-list">
              {dna.ipsOutputs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="v2-hp-policy-panel">
            <div className="v2-hp-policy-kicker">Связь с системой</div>
            <div className="v2-hp-policy-rays">
              <div className="v2-hp-policy-ray">
                <span>Здоровье</span>
                <em>Показывает короткий вердикт и текущий конфликт профиля с портфелем.</em>
              </div>
              <div className="v2-hp-policy-ray">
                <span>Проверка сделки</span>
                <em>Блокирует или усиливает предупреждение, если сделка противоречит ДНК, резерву или бюджету риска.</em>
              </div>
            </div>
            <div className="v2-hp-policy-rows">
              {onNavigate && (
                <button className="v2-hp-sim-btn" type="button" onClick={() => onNavigate("gate")}>
                  Открыть проверку сделки
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
