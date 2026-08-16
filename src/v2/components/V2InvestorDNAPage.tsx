import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { saveInvestorDNAAudit } from "../../api/investorDNA";
import dnaPriorityOrb from "../../assets/dna/dna-priority-orb.png";
import dnaRiskReadiness from "../../assets/dna/dna-risk-readiness.webp";
import dnaRiskReadinessWife from "../../assets/dna/dna-risk-readiness-wife.webp";
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
type DnaPanelKind = AuditKind | "profile-rules";

type AuditAnswer = {
  option: string;
  note: string;
};

type DnaAuditCardProps = {
  kind: "lite" | "full" | "rules";
  title: string;
  subtitle: string;
  answered: number;
  total: number;
  isOpen: boolean;
  onToggle: () => void;
  ctaLabel?: string;
  onPrimaryAction?: () => void;
  children: ReactNode;
};

const defaultAnswerOptions = ["Не подходит", "Скорее нет", "Скорее да", "Полностью да"];

function answerOptionsFor(question: InvestorDNAQuestion): string[] {
  if (question.answerKind === "open") {
    return [];
  }

  return question.options?.length ? question.options : defaultAnswerOptions;
}

function DnaScoreRing({ value, accountId }: { value: number; accountId: InvestorDNA["accountId"] }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const readinessImage = accountId === "wife" ? dnaRiskReadinessWife : dnaRiskReadiness;

  return (
    <div className="v2-dna-risk-readiness" aria-label={`Готовность к риску ${clampedValue} из 100`}>
      <img src={readinessImage} alt="" />
    </div>
  );
}

function DnaMetricValue({ value }: { value: string }) {
  const scoreMatch = value.match(/^(\d+)\/100$/);

  if (scoreMatch) {
    return (
      <div className="v2-dna-readiness-score">
        <strong>{scoreMatch[1]}</strong>
        <span>/ 100</span>
      </div>
    );
  }

  return <div className="v2-dna-readiness-score"><strong>{value}</strong></div>;
}

function DnaStars({ value, label }: { value: number; label: string }) {
  const filledStars = Math.max(0, Math.min(5, Math.round(value / 20)));
  const stars = "★".repeat(filledStars) + "☆".repeat(5 - filledStars);

  return <div className="v2-dna-stars" aria-label={label}>{stars}</div>;
}

function DnaHeroMetric({
  label,
  value,
  note,
  stars,
}: {
  label: string;
  value: string;
  note: string;
  stars?: number;
}) {
  return (
    <div className="v2-dna-hero-metric">
      <div className="v2-dna-hero-metric-label">{label}</div>
      <DnaMetricValue value={value} />
      {typeof stars === "number" && <DnaStars value={stars} label={`Оценка ${label.toLowerCase()}`} />}
      <p>{note}</p>
    </div>
  );
}

function RecommendationRow({
  item,
  number,
  isOpen,
  onToggle,
}: {
  item: InvestorDNARecommendation;
  number: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const priorityText = item.priority === "critical" ? "обязательно" : priorityLabel[item.priority].toLowerCase();
  const iconPath =
    number === 1
      ? "M7 14.5h9a4 4 0 0 0-.5-7.96A5.5 5.5 0 0 0 5.3 8.2 3.4 3.4 0 0 0 7 14.5Zm3-3 2-2 2 2M12 9.5v7"
      : number === 2
        ? "M12 5v2M12 17v2M5 12h2M17 12h2M8.5 8.5l-1.4-1.4M15.5 15.5l1.4 1.4M15.5 8.5l1.4-1.4M8.5 15.5l-1.4 1.4M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
        : number === 3
          ? "M12 3 18 5.7v4.4c0 4.2-2.4 7.2-6 8.9-3.6-1.7-6-4.7-6-8.9V5.7L12 3Z"
          : "M6 17V9h3v8M11 17V5h3v12M16 17v-6h3v6";

  return (
    <div className={`v2-dna-rec-row${isOpen ? " is-open" : ""}`}>
      <button
        className="v2-dna-rec-toggle"
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className="v2-dna-rec-number">{number}</span>
        <span className="v2-dna-rec-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d={iconPath} />
          </svg>
        </span>
        <span className="v2-dna-rec-copy">
          <strong>{item.title}</strong>
          <span className="v2-dna-rec-action">{item.action}</span>
        </span>
        <span className={`v2-dna-rec-priority ${priorityClass[item.priority]}`}>{priorityText}</span>
        <span className="v2-dna-rec-chevron" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="M6.1 4.2 9.9 8l-3.8 3.8" />
          </svg>
        </span>
      </button>
      {isOpen && (
        <div className="v2-dna-rec-details">
          <p>{item.reason}</p>
          <p>{item.expectedEffect}</p>
        </div>
      )}
    </div>
  );
}

function DnaAuditCard({
  kind,
  title,
  subtitle,
  answered,
  total,
  isOpen,
  onToggle,
  ctaLabel,
  onPrimaryAction,
  children,
}: DnaAuditCardProps) {
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0;

  if (kind === "lite" || kind === "full") {
    const index = kind === "lite" ? "01" : "02";
    const description =
      kind === "lite"
        ? `${total} вопросов, чтобы определить ваш риск-профиль и ключевые ограничения.`
        : subtitle;
    const duration = kind === "lite" ? "~ 3 минуты" : "~ 10 минут";

    return (
      <div className={`v2-dna-audit-shell v2-dna-audit-card v2-dna-audit-primary ${isOpen ? "is-open" : ""}`}>
        <div className="v2-dna-audit-primary-layout">
          <div className="v2-dna-audit-primary-left">
            <span className="v2-dna-audit-primary-kind">{index}</span>
            <div className="v2-dna-audit-primary-copy">
              <h3>{title}</h3>
              <p>{description}</p>
              <div className="v2-dna-audit-primary-meta">
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <strong>{duration}</strong>
                  <em>на прохождение</em>
                </span>
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3 19 6v5c0 4.8-2.9 8.2-7 10-4.1-1.8-7-5.2-7-10V6l7-3Z" />
                  </svg>
                  <strong>100% конфиденциально</strong>
                  <em>ваши данные защищены</em>
                </span>
              </div>
            </div>
          </div>
          <div className="v2-dna-audit-primary-action">
            <div className="v2-dna-audit-primary-progress" aria-label={`Заполнено ${answered} из ${total}`}>
              <span>Прогресс</span>
              <strong>{answered} / {total}</strong>
              <i>
                <span style={{ width: `${progress}%` }} />
              </i>
            </div>
            <button className="v2-dna-audit-primary-cta" type="button" onClick={onPrimaryAction ?? onToggle}>
              <span className="v2-dna-audit-primary-dna" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M7 3c0 4 10 4 10 8s-10 4-10 10" />
                  <path d="M17 3c0 4-10 4-10 8s10 4 10 10" />
                  <path d="M8.5 7h7" />
                  <path d="M8.5 17h7" />
                </svg>
              </span>
              <span>{ctaLabel ?? (isOpen ? "Свернуть аудит" : kind === "lite" ? "Пройти аудит" : "Пройти анкету")}</span>
            </button>
            <div className="v2-dna-audit-primary-hint">
              {total} вопросов <span>•</span> {duration}
            </div>
          </div>
        </div>
        {isOpen && children}
      </div>
    );
  }

  return (
    <div className={`v2-dna-audit-shell v2-dna-audit-card ${isOpen ? "is-open" : ""}`}>
      <button
        className="v2-dna-audit-toggle v2-dna-audit-card-toggle"
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className="v2-dna-audit-kind">03</span>
        <span className="v2-dna-audit-copy">
          <em>{title}</em>
          <strong>{subtitle}</strong>
        </span>
        <span className="v2-dna-audit-progress" aria-label={`Заполнено ${answered} из ${total}`}>
          <b>{answered}/{total}</b>
          <i>
            <span style={{ width: `${progress}%` }} />
          </i>
        </span>
        <span className="v2-dna-rec-chevron" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="M4.2 6.1 8 9.9l3.8-3.8" />
          </svg>
        </span>
      </button>
      {isOpen && children}
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
  const isOpenAnswer = question.answerKind === "open";

  return (
    <div className="v2-dna-question-card">
      <div className="v2-dna-question-head">
        <div>
          <div className="v2-hp-policy-kicker">Вопрос {number}</div>
          {groupTitle && <span>{groupTitle}</span>}
        </div>
        <p>{question.text}</p>
      </div>
      {options.length > 0 && (
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
      )}
      <textarea
        className="v2-dna-note"
        rows={isOpenAnswer ? 3 : 2}
        value={answer?.note ?? ""}
        onChange={(event) => onNote(question.id, event.target.value)}
        placeholder={question.placeholder ?? (isOpenAnswer ? "Ответ" : "Свободное поле: суммы, исключения, контекст, что важно учесть")}
      />
    </div>
  );
}

function DnaAuditResultPanel({
  kind,
  dna,
  answered,
  total,
  onClose,
}: {
  kind: AuditKind;
  dna: InvestorDNA;
  answered: number;
  total: number;
  onClose: () => void;
}) {
  const title = kind === "lite" ? "Предварительное амплуа инвестора" : "Итоговое амплуа инвестора";
  const scope = kind === "lite"
    ? "На базе первичного аудита результат показывает быстрый риск-портрет и главные ограничения."
    : "На базе полной анкеты результат должен лечь в инвестдекларацию, лимиты и рекомендации.";
  const primaryRecommendation = dna.recommendations[0];

  return createPortal(
    <div className="v2-dna-result-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="v2-dna-result-modal" onClick={(event) => event.stopPropagation()}>
        <button className="v2-dna-result-modal-close" type="button" onClick={onClose} aria-label="Закрыть">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
          </svg>
        </button>

        <div className="v2-dna-audit-result-panel">
          <div className="v2-dna-audit-result-head">
            <div>
              <div className="v2-hp-card-title">Результат ДНК</div>
              <h3>{title}</h3>
            </div>
            <span>{answered} / {total}</span>
          </div>

          <div className="v2-dna-audit-result-grid">
            <div className="v2-dna-audit-result-main">
              <em>Архетип</em>
              <strong>{dna.investorType}</strong>
              <p>{dna.thesis}</p>
            </div>
            <div className="v2-dna-audit-result-main">
              <em>Главный вывод</em>
              <strong>{dna.keyVerdict}</strong>
              <p>{scope}</p>
            </div>
          </div>

          <div className="v2-dna-audit-result-facts">
            <div>
              <span>{dna.riskWillingness.label}</span>
              <strong>{dna.riskWillingness.value}/100</strong>
              <p>{dna.riskWillingness.note}</p>
            </div>
            <div>
              <span>{dna.riskCapacity.label}</span>
              <strong>{dna.riskCapacity.value}/100</strong>
              <p>{dna.riskCapacity.note}</p>
            </div>
            <div>
              <span>Первое действие</span>
              <strong>{primaryRecommendation?.title ?? "Проверить риск-лимиты"}</strong>
              <p>{primaryRecommendation?.action ?? "Сверить ответы с лимитами портфеля перед новой сделкой."}</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function V2InvestorDNAPage({ dna, onNavigate }: Props) {
  const [openAudit, setOpenAudit] = useState<DnaPanelKind | null>(null);
  const [openRecommendationId, setOpenRecommendationId] = useState<string | null>(null);
  const [openResult, setOpenResult] = useState<AuditKind | null>(null);
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
  const capitalTarget = "$20 000";
  const capitalTargetNote = "Амбициозный ориентир без требования форсировать риск.";
  const dnaCheckModules = [
    { label: "Цель капитала", value: "8 вопросов", note: "Зачем нужен капитал и насколько жёсткая цель." },
    { label: "Риск и просадка", value: "8 вопросов", note: "Какая волатильность допустима без срыва плана." },
    { label: "Поведение", value: "8 вопросов", note: "Что происходит под давлением ошибок, FOMO и ожидания." },
    { label: "Стиль", value: "8 вопросов", note: "Какой режим принятия решений реально соблюдать." },
    { label: "Структура", value: "8 вопросов", note: "Активы, концентрация, спекулятивный блок и плечо." },
    { label: "Способность к риску", value: "6 вопросов", note: "Можно ли масштабировать риск сейчас, а не в теории." },
    { label: "Ограничения", value: "4 вопроса", note: "Слабые зоны, характер и желаемый итог теста." },
  ];
  const ruleFlowSteps = [
    { label: "Анкета", value: `${dna.liteQuestionCount} + ${dna.fullAuditQuestionCount}`, note: "Собирает ограничения и поведенческие реакции." },
    { label: "Профиль", value: `${dna.riskWillingness.value}/100`, note: "Отделяет желание риска от способности его выдержать." },
    { label: "Правила", value: dna.ipsOutputs.length.toString(), note: "Переводит ответы в лимиты и запреты." },
    { label: "Проверка", value: "Gate", note: "Сравнивает новую сделку с ДНК и текущим риском." },
  ];
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
  const liteComplete = liteAnswered >= dna.liteQuestionCount;
  const fullComplete = fullAnswered >= dna.fullAuditQuestionCount;

  function handleAuditPrimaryAction(kind: AuditKind) {
    const complete = kind === "lite" ? liteComplete : fullComplete;

    if (complete) {
      setOpenAudit(null);
      setOpenResult(openResult === kind ? null : kind);
      return;
    }

    setOpenResult(null);
    setOpenAudit(openAudit === kind ? null : kind);
  }

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
      setOpenAudit(null);
      setOpenResult(kind);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "неизвестная ошибка";
      setAuditResult((current) => ({
        ...current,
        [kind]: `Ответы приняты локально: заполнено ${answered} из ${total}. Сохранение в Google Sheets пока не прошло: ${reason}.`,
      }));
      setOpenAudit(null);
      setOpenResult(kind);
    } finally {
      setSavingAudit(null);
    }
  }

  return (
    <div className="v2-hp-page v2-dna-page" aria-label="ДНК Инвестора">
      <section className="v2-hp-policy-card v2-dna-audit-card-section">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">Анкетирование</div>
            <h2>Аудит ДНК</h2>
          </div>
        </div>

        <div className="v2-dna-audit-stack">
          <DnaAuditCard
            kind="lite"
            title="Первичный аудит"
            subtitle="Быстрая анкета для первого профиля и грубых ограничений риска."
            answered={liteAnswered}
            total={dna.liteQuestionCount}
            isOpen={openAudit === "lite"}
            onToggle={() => setOpenAudit(openAudit === "lite" ? null : "lite")}
            ctaLabel={openAudit === "lite" ? "Свернуть аудит" : liteComplete ? (openResult === "lite" ? "Скрыть итог" : "Итог аудита") : "Пройти аудит"}
            onPrimaryAction={() => handleAuditPrimaryAction("lite")}
          >
            {openAudit === "lite" && (
              <div className="v2-dna-audit-body">
                <div className="v2-dna-audit-actionbar">
                  <span>Заполнено {liteAnswered} из {dna.liteQuestionCount}</span>
                  <button
                    className="v2-hp-sim-btn"
                    type="button"
                    disabled={savingAudit === "lite"}
                    onClick={() => void submitAudit("lite")}
                  >
                    {savingAudit === "lite" ? "Сохраняю ответы" : "Сохранить ответы"}
                  </button>
                </div>
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
          </DnaAuditCard>

          <DnaAuditCard
            kind="full"
            title="Полная анкета ДНК"
            subtitle="Глубокая анкета для риск-профиля, типажа инвестора и инвестдекларации."
            answered={fullAnswered}
            total={dna.fullAuditQuestionCount}
            isOpen={openAudit === "full"}
            onToggle={() => setOpenAudit(openAudit === "full" ? null : "full")}
            ctaLabel={openAudit === "full" ? "Свернуть анкету" : fullComplete ? (openResult === "full" ? "Скрыть итог" : "Итог анкеты") : "Пройти анкету"}
            onPrimaryAction={() => handleAuditPrimaryAction("full")}
          >
            {openAudit === "full" && (
              <div className="v2-dna-audit-body">
                <div className="v2-dna-audit-actionbar">
                  <span>Заполнено {fullAnswered} из {dna.fullAuditQuestionCount}</span>
                  <button
                    className="v2-hp-sim-btn"
                    type="button"
                    disabled={savingAudit === "full"}
                    onClick={() => void submitAudit("full")}
                  >
                    {savingAudit === "full" ? "Сохраняю ответы" : "Сохранить полную анкету"}
                  </button>
                </div>
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
          </DnaAuditCard>
        </div>

        {openResult === "lite" && (
          <DnaAuditResultPanel
            kind="lite"
            dna={dna}
            answered={liteAnswered}
            total={dna.liteQuestionCount}
            onClose={() => setOpenResult(null)}
          />
        )}

        {openResult === "full" && (
          <DnaAuditResultPanel
            kind="full"
            dna={dna}
            answered={fullAnswered}
            total={dna.fullAuditQuestionCount}
            onClose={() => setOpenResult(null)}
          />
        )}

        <div className="v2-dna-check-card v2-dna-check-card-inline">
          <div className="v2-hp-policy-head">
            <div>
              <div className="v2-hp-card-title">Состав анкет</div>
              <h2>Что проверяет ДНК</h2>
            </div>
          </div>
          <div className="v2-dna-check-grid">
            {dnaCheckModules.map((module) => (
              <div key={module.label} className="v2-dna-check-tile">
                <strong>{module.label}</strong>
                <span>{module.value}</span>
                <p>{module.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="v2-dna-hero-card">
        <div className="v2-hp-policy-head v2-dna-hero-head">
          <div>
            <div className="v2-hp-card-title">ДНК Инвестора</div>
            <h2>Главные ориентиры</h2>
          </div>
        </div>
        <div className="v2-dna-hero-summary">
          <div className="v2-dna-score-widget">
            <DnaScoreRing value={dna.riskWillingness.value} accountId={dna.accountId} />
            <div className="v2-dna-score-copy">
              <div className="v2-dna-hero-metric-label">{dna.riskWillingness.label}</div>
              <div className="v2-dna-readiness-score" aria-label={`Оценка ${dna.riskWillingness.value} из 100`}>
                <strong>{dna.riskWillingness.value}</strong>
                <span>/ 100</span>
              </div>
              <DnaStars value={dna.riskWillingness.value} label="Оценка готовности к риску" />
              <p>{dna.riskWillingness.note}</p>
              <span>Профиль ДНК</span>
            </div>
          </div>
          <DnaHeroMetric
            label={dna.riskCapacity.label}
            value={`${dna.riskCapacity.value}/100`}
            note={dna.riskCapacity.note}
            stars={dna.riskCapacity.value}
          />
          <DnaHeroMetric
            label="Ориентир капитала"
            value={capitalTarget}
            note={capitalTargetNote}
          />
        </div>
      </section>

      <section className="v2-hp-policy-card v2-dna-rec-card" aria-label="Рекомендации ДНК">
        <div className="v2-dna-priority-head">
          <div className="v2-dna-priority-copy">
            <div className="v2-hp-card-title">Приоритеты ДНК</div>
            <h2>Что сделать дальше</h2>
            <p>{dna.recommendations.length} ключевых действия для усиления портфеля и достижения ваших целей.</p>
            <div className="v2-dna-priority-stats">
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
                </svg>
                <strong>{dna.recommendations.length} действия</strong>
                <em>по приоритету</em>
              </span>
            </div>
          </div>
          <aside className="v2-dna-priority-visual" aria-hidden="true">
            <img src={dnaPriorityOrb} alt="" />
          </aside>
        </div>
        <div className="v2-dna-rec-list">
          {dna.recommendations.map((item, index) => (
            <RecommendationRow
              key={item.id}
              item={item}
              number={index + 1}
              isOpen={openRecommendationId === item.id}
              onToggle={() => setOpenRecommendationId((current) => (current === item.id ? null : item.id))}
            />
          ))}
        </div>
        <button className="v2-dna-priority-cta" type="button">
          <span className="v2-dna-priority-cta-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M13 4c3.5.4 6.2 3.1 6.6 6.6l-5.1 5.1-4.8-4.8L13 4Z" />
              <path d="M9.7 10.9 5 12l3.2 3.2L9.7 10.9Z" />
              <path d="M14.5 15.7 13.4 20l-3.2-3.2 4.3-1.1Z" />
              <path d="M5 19l2.2-2.2" />
            </svg>
          </span>
          <span>
            <strong>Перейти к плану действий</strong>
            <em>Детальный план и инструменты</em>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </button>
      </section>

      <section className="v2-hp-policy-card v2-dna-rules-card">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">Профиль и инвестдекларация</div>
            <h2>От анкеты к правилам</h2>
          </div>
          <span className="v2-hp-policy-badge">Черновик правил</span>
        </div>
        <div className="v2-dna-rule-flow">
          {ruleFlowSteps.map((step) => (
            <div key={step.label} className="v2-dna-rule-step">
              <span>{step.label}</span>
              <strong>{step.value}</strong>
              <p>{step.note}</p>
            </div>
          ))}
        </div>

        <div className="v2-dna-profile-accordion">
          <DnaAuditCard
            kind="rules"
            title="Профиль и правила"
            subtitle="Подробные ограничения, выходы инвестдекларации и связь с проверкой сделки."
            answered={profileRows.length}
            total={profileRows.length + dna.ipsOutputs.length}
            isOpen={openAudit === "profile-rules"}
            onToggle={() => setOpenAudit(openAudit === "profile-rules" ? null : "profile-rules")}
          >
            {openAudit === "profile-rules" && (
              <div className="v2-hp-policy-grid v2-dna-profile-grid">
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
            )}
          </DnaAuditCard>
        </div>
      </section>
    </div>
  );
}
