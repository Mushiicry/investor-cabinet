import { useMemo, useState, type ComponentProps } from "react";
import type { DecisionJournalDraft } from "../lib/decisionJournal";
import type { TradeCandidate } from "../lib/tradeCandidate";
import { transactionJournalId } from "../lib/traderJournal";
import {
  createManualTradeCase,
  ensureTradeCaseForCandidate,
  updateTradeCase,
  type TradeCase,
  type TradeCaseStatus,
} from "../lib/tradeCase";
import { V2GatePage } from "./V2GatePage";
import { V2ReportsPage } from "./V2ReportsPage";
import { V2SignalsPage } from "./V2SignalsPage";
import { V2DataTrustPanel } from "./V2DataTrustPanel";
import type { TradingDataTrust } from "../lib/dataTrust";

export type V2TradingStep = "idea" | "check" | "observe" | "decision" | "journal" | "waiting";
export type TradeCaseSyncState = "local" | "syncing" | "synced" | "error";

type SignalsProps = ComponentProps<typeof V2SignalsPage>;
type GateProps = ComponentProps<typeof V2GatePage>;
type ReportsProps = Omit<ComponentProps<typeof V2ReportsPage>, "mode">;

type Props = {
  initialStep?: V2TradingStep;
  signalsProps: SignalsProps;
  gateProps: GateProps;
  reportsProps: ReportsProps;
  candidate?: TradeCandidate | null;
  tradeCases: TradeCase[];
  activeTradeCaseId: string | null;
  syncState: TradeCaseSyncState;
  dataTrust: TradingDataTrust;
  onSaveTradeCase: (tradeCase: TradeCase, activate?: boolean) => void;
};

const STEPS: Array<{ id: V2TradingStep; title: string; detail: string }> = [
  { id: "idea", title: "Идея", detail: "найти сетап" },
  { id: "check", title: "Проверка", detail: "сверить риск" },
  { id: "observe", title: "Наблюдение", detail: "поставить алерт" },
  { id: "decision", title: "Решение", detail: "задать лимитку" },
  { id: "journal", title: "Дневник", detail: "записать план" },
  { id: "waiting", title: "Ожидание", detail: "следить за итогом" },
];

const STEP_COPY: Record<V2TradingStep, { title: string; text: string }> = {
  idea: {
    title: "Шаг 1 · Идея",
    text: "Выберите сигнал или сформулируйте ручной сетап. На этом шаге сделка ещё не разрешена.",
  },
  check: {
    title: "Шаг 2 · Проверка идеи",
    text: "Проверьте резерв, лимиты, размер позиции, дисциплину и выживаемость портфеля.",
  },
  observe: {
    title: "Шаг 3 · Наблюдение",
    text: "Создайте ценовое напоминание и ждите уровня. Напоминание не является ордером на бирже.",
  },
  decision: {
    title: "Шаг 4 · Конкретное решение",
    text: "Зафиксируйте цену, сумму, сценарий отмены и план ручного лимитного ордера.",
  },
  journal: {
    title: "Шаг 5 · Дневник сделки",
    text: "Проверьте сохранённый допуск и разберите фактическую сделку, когда она появится в истории.",
  },
  waiting: {
    title: "Шаг 6 · Ожидание результата",
    text: "Кабинет хранит план, но не подтверждает состояние биржевого ордера. Контроль исполнения остаётся ручным.",
  },
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatUsd = (value: number) =>
  `${Math.round(value).toLocaleString("ru-RU")} $`;

const STATUS_LABELS: Record<TradeCaseStatus, string> = {
  IDEA: "Идея",
  CHECKING: "Проверка",
  WATCHING: "Наблюдение",
  DECISION_READY: "Решение готово",
  ORDER_PLACED: "Ордер выставлен вручную",
  WAITING: "Ожидание",
  FILLED: "Исполнено",
  CANCELLED: "Отменено",
  REVIEWED: "Разобрано",
};

export function V2TradingPage({
  initialStep = "idea",
  signalsProps,
  gateProps,
  reportsProps,
  candidate,
  tradeCases,
  activeTradeCaseId,
  dataTrust,
  onSaveTradeCase,
}: Props) {
  const [step, setStep] = useState<V2TradingStep>(initialStep);
  const [manualIdea, setManualIdea] = useState("");
  const [manualIdeaOpen, setManualIdeaOpen] = useState(false);
  const [transactionSelection, setTransactionSelection] = useState<Record<string, string>>({});
  const currentIndex = STEPS.findIndex((item) => item.id === step);
  const copy = STEP_COPY[step];
  const activeTradeCase = useMemo(
    () => tradeCases.find((item) => item.tradeCaseId === activeTradeCaseId) ?? null,
    [tradeCases, activeTradeCaseId],
  );
  const waitingCases = useMemo(
    () => tradeCases
      .filter((item) => !["IDEA", "CHECKING", "WATCHING"].includes(item.status))
      .slice(0, 12),
    [tradeCases],
  );
  const transactionOptions = useMemo(
    () => reportsProps.transactions
      .filter((transaction) => /покуп|buy|прод|sell/i.test(transaction.action || ""))
      .slice(0, 100),
    [reportsProps.transactions],
  );

  const handleOpenCandidate = (nextCandidate: TradeCandidate) => {
    const tradeCase = ensureTradeCaseForCandidate(tradeCases, nextCandidate);
    signalsProps.onOpenTradeCandidate?.(nextCandidate);
    onSaveTradeCase(tradeCase, true);
    setStep("check");
  };

  const handleStepChange = (nextStep: V2TradingStep) => {
    if (activeTradeCase && !["CANCELLED", "REVIEWED"].includes(activeTradeCase.status)) {
      if (nextStep === "check" && activeTradeCase.status === "IDEA") {
        onSaveTradeCase(updateTradeCase(activeTradeCase, { status: "CHECKING" }), true);
      }
      if (nextStep === "observe" && ["IDEA", "CHECKING"].includes(activeTradeCase.status)) {
        onSaveTradeCase(updateTradeCase(activeTradeCase, { status: "WATCHING" }), true);
      }
    }
    setStep(nextStep);
  };

  const handleSaveDecision = (draft: DecisionJournalDraft) => {
    if (!dataTrust.canCreateDecision) return;
    const base = activeTradeCase ?? createManualTradeCase(draft.note || `${draft.asset} · ручная идея`);
    const blocked = ["БЛОКИРОВКА", "СНИЗИТЬ_РИСК", "ЖДАТЬ"].includes(draft.decision.status);
    const tradeCase = updateTradeCase(base, {
      status: blocked ? "CHECKING" : "DECISION_READY",
      idea: base.idea || draft.note,
      asset: draft.asset,
      category: draft.category,
      action: draft.action ?? "buy",
      amountUsd: draft.amountUsd,
      price: draft.buyPrice,
      decisionStatus: draft.decision.status,
      orderPlan: draft.orderPlan,
    });
    onSaveTradeCase(tradeCase, true);
    gateProps.onSaveDecision?.({ ...draft, tradeCaseId: tradeCase.tradeCaseId });
    setStep(blocked ? "check" : "journal");
  };

  const createManualCase = () => {
    const idea = manualIdea.trim();
    if (!idea) return;
    const tradeCase = createManualTradeCase(idea);
    onSaveTradeCase(tradeCase, true);
    setManualIdea("");
    setManualIdeaOpen(false);
    setStep("idea");
  };

  const advanceCase = (tradeCase: TradeCase, status: TradeCaseStatus) => {
    onSaveTradeCase(updateTradeCase(tradeCase, { status }), true);
  };

  const linkTransaction = (tradeCase: TradeCase) => {
    const transactionId = transactionSelection[tradeCase.tradeCaseId];
    if (!transactionId) return;
    onSaveTradeCase(updateTradeCase(tradeCase, { transactionId, status: "FILLED" }), true);
    setStep("journal");
  };

  const signalsVisible = step === "idea" || step === "observe";
  const gateVisible = step === "check" || step === "decision";

  return (
    <section className="v2-trading-workflow" aria-label="Торговый цикл">
      <header className="v2-trading-workflow__header">
        <div className="v2-trading-workflow__heading">
          <span>Торговля</span>
          <strong>Один процесс — от идеи до результата</strong>
          <p>Risk first. Решение фиксируется до ручного действия на бирже.</p>
        </div>
      </header>

      <V2DataTrustPanel dataTrust={dataTrust} onRefresh={signalsProps.onRefreshData} />

      <nav className="v2-trading-workflow__steps" aria-label="Шаги торгового цикла">
        {STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={[
              "v2-trading-workflow__step",
              item.id === step ? "is-active" : "",
              index < currentIndex ? "is-complete" : "",
            ].filter(Boolean).join(" ")}
            aria-current={item.id === step ? "step" : undefined}
            onClick={() => handleStepChange(item.id)}
          >
            <span className="v2-trading-workflow__step-number">{index + 1}</span>
            <span className="v2-trading-workflow__step-copy">
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="v2-trading-workflow__context">
        <div>
          <strong>{copy.title}</strong>
          <span>{copy.text}</span>
        </div>
        {activeTradeCase ? (
          <div className="v2-trading-workflow__candidate">
            <span>Активный кейс · {activeTradeCase.tradeCaseId.slice(-8)}</span>
            <strong>{activeTradeCase.idea || candidate?.label || "Торговая идея"}</strong>
            <small>
              {STATUS_LABELS[activeTradeCase.status]}
              {activeTradeCase.asset ? ` · ${activeTradeCase.asset} · ${formatUsd(activeTradeCase.amountUsd)}` : ""}
            </small>
            <button type="button" onClick={() => setManualIdeaOpen((value) => !value)}>Новый кейс</button>
          </div>
        ) : (
          <div className="v2-trading-workflow__candidate is-empty">
            <span>Текущий контекст</span>
            <strong>Сделка ещё не выбрана</strong>
            <button type="button" onClick={() => setManualIdeaOpen(true)}>Создать ручную идею</button>
          </div>
        )}
      </div>

      {(manualIdeaOpen || !activeTradeCase) && (
        <div className="v2-trading-case-create v2-panel">
          <label>
            <span>Исходная идея</span>
            <input
              value={manualIdea}
              onChange={(event) => setManualIdea(event.target.value)}
              placeholder="Например: плановый добор ETH после возврата к уровню"
            />
          </label>
          <button type="button" disabled={!manualIdea.trim()} onClick={createManualCase}>Создать TradeCase</button>
        </div>
      )}

      <div className="v2-trading-workflow__panel" hidden={!signalsVisible}>
        <V2SignalsPage
          {...signalsProps}
          onOpenTradeCandidate={handleOpenCandidate}
        />
      </div>

      <div className="v2-trading-workflow__panel" hidden={!gateVisible}>
        <V2GatePage
          {...gateProps}
          key={gateProps.candidate?.id ?? "manual-gate"}
          dataTrust={dataTrust}
          onSaveDecision={handleSaveDecision}
        />
      </div>

      <div className="v2-trading-workflow__panel" hidden={step !== "journal"}>
        <V2ReportsPage {...reportsProps} mode="trading" />
      </div>

      <div className="v2-trading-workflow__panel" hidden={step !== "waiting"}>
        <div className="v2-trading-waiting v2-panel">
          <div className="v2-trading-waiting__head">
            <div>
              <span>Торговые кейсы с решением</span>
              <strong>{waitingCases.length}</strong>
            </div>
            <button type="button" onClick={() => setStep("journal")}>Открыть дневник</button>
          </div>
          {waitingCases.length === 0 ? (
            <div className="v2-trading-waiting__empty">
              Сначала сохраните разрешённое решение в проверке. Заблокированные сделки в ожидание не попадают.
            </div>
          ) : (
            <div className="v2-trading-waiting__list">
              {waitingCases.map((tradeCase) => (
                <article className="v2-trading-waiting__item" key={tradeCase.tradeCaseId}>
                  <div className="v2-trading-waiting__item-head">
                    <strong>{tradeCase.asset || "Ручная идея"}</strong>
                    <span>{STATUS_LABELS[tradeCase.status]}</span>
                    <time>{formatDate(tradeCase.updatedAt)}</time>
                  </div>
                  <div className="v2-trading-waiting__facts">
                    <span>{tradeCase.action === "sell" ? "Продажа" : "Покупка"}</span>
                    <strong>{formatUsd(tradeCase.amountUsd)}</strong>
                    <span>Цена</span>
                    <strong>{tradeCase.price ? tradeCase.price.toLocaleString("ru-RU") : "—"}</strong>
                  </div>
                  <p>{tradeCase.orderPlan || tradeCase.idea || "План ордера не заполнен"}</p>
                  <small>Проверьте биржевой ордер вручную. Кабинет не знает, выставлен или исполнен он.</small>
                  <div className="v2-trading-waiting__actions">
                    {tradeCase.status === "DECISION_READY" && (
                      <button type="button" onClick={() => advanceCase(tradeCase, "ORDER_PLACED")}>Ордер выставлен вручную</button>
                    )}
                    {tradeCase.status === "ORDER_PLACED" && (
                      <button type="button" onClick={() => advanceCase(tradeCase, "WAITING")}>Перевести в ожидание</button>
                    )}
                    {tradeCase.status === "WAITING" && (
                      <>
                        <select
                          value={transactionSelection[tradeCase.tradeCaseId] ?? ""}
                          onChange={(event) => setTransactionSelection((current) => ({
                            ...current,
                            [tradeCase.tradeCaseId]: event.target.value,
                          }))}
                        >
                          <option value="">Связать фактическую транзакцию…</option>
                          {transactionOptions.map((transaction) => {
                            const transactionId = transactionJournalId(transaction);
                            return (
                              <option key={transactionId} value={transactionId}>
                                {formatDate(transaction.date)} · {transaction.asset || transaction.rawAsset} · {transaction.action}
                              </option>
                            );
                          })}
                        </select>
                        <button
                          type="button"
                          disabled={!transactionSelection[tradeCase.tradeCaseId]}
                          onClick={() => linkTransaction(tradeCase)}
                        >
                          Подтвердить исполнение
                        </button>
                      </>
                    )}
                    {tradeCase.status === "FILLED" && (
                      <button type="button" onClick={() => { onSaveTradeCase(tradeCase, true); setStep("journal"); }}>
                        Разобрать сделку
                      </button>
                    )}
                    {!["CANCELLED", "REVIEWED", "FILLED"].includes(tradeCase.status) && (
                      <button type="button" className="is-cancel" onClick={() => advanceCase(tradeCase, "CANCELLED")}>Отменить кейс</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
