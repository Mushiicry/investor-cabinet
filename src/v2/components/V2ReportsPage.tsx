import { useMemo, useState } from "react";
import { V2SourceTag } from "./V2SourceTag";
import {
  getPortfolioHistorySummary,
  getSortedPortfolioHistory,
} from "../../lib/historySelectors";
import type { InvestorTransaction, PortfolioHistoryPoint } from "../../types/portfolio";
import type { V2Position } from "../InvestorCabinetV2Lab";
import { stakingApy } from "../../config/stakingRules";
import type { DecisionJournalEntry } from "../lib/decisionJournal";
import type { BehaviorEngineResult } from "../lib/behaviorEngine";
import type { InvestorStrategy } from "../lib/investorStrategy";
import { calculateTransactionRealizedPnl } from "../lib/transactionRealizedPnl";
import {
  isTradeReviewComplete,
  transactionJournalId,
  type TraderJournalDraft,
  type TraderJournalEntry,
  type TradeErrorType,
  type TradePlanAdherence,
} from "../lib/traderJournal";

type Props = {
  mode?: "reports" | "trading";
  history: PortfolioHistoryPoint[];
  transactions: InvestorTransaction[];
  positions: V2Position[];
  /** Единственный источник зафиксированной прибыли — блок закрытых позиций. */
  realizedPnlUsd?: number;
  decisionJournal?: DecisionJournalEntry[];
  behavior?: BehaviorEngineResult;
  strategy?: InvestorStrategy;
  onDeleteDecision?: (id: string) => void;
  traderJournal?: TraderJournalEntry[];
  onSaveTradeReview?: (draft: TraderJournalDraft) => void;
  tradeCaseIdByTransaction?: Record<string, string>;
};

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const fmtUSD = (value: number) => money.format(value);
const fmtPct = (value: number) => `${value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${fmtUSD(value)}`;
const signedScore = (value: number) => (value > 0 ? `+${value}` : String(value));

function fmtQuantity(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value);
}

function isTransfer(action: string) {
  const a = (action || "").toLowerCase();
  return a.includes("перев") || a.includes("transfer");
}

// Входящий перевод (приход) — по полю direction = IN.
function isIncoming(t: InvestorTransaction) {
  return (t.direction || "").toUpperCase() === "IN";
}

// Название действия для строки: приход/перевод для трансферов, иначе как есть.
function displayAction(t: InvestorTransaction): string {
  if (isTransfer(t.action)) return isIncoming(t) ? "Приход" : "Перевод";
  return t.action || t.direction || "—";
}

function transactionTone(t: InvestorTransaction) {
  const normalized = (t.action || "").toLowerCase();
  if (normalized.includes("покуп") || normalized.includes("buy")) return "tx-buy";
  if (normalized.includes("прод") || normalized.includes("sell")) return "tx-sell";
  // Стейбл-потоки кошелька (Arbitrum-импорт, 2026-07-17)
  if (normalized.includes("пополн") || normalized.includes("deposit")) return "tx-in";
  if (normalized.includes("обмен") || normalized.includes("swap")) return "tx-swap";
  if (normalized.includes("вывод") || normalized.includes("withdraw")) return "tx-out";
  if (isTransfer(t.action)) return isIncoming(t) ? "tx-in" : "tx-transfer";
  return "tx-reinforce";
}

// Полностью пустая строка — ни количества, ни суммы, ни цены (служебные
// под-события вроде DepositStake/JettonMint). Не показываем.
function isEmptyRow(t: InvestorTransaction) {
  const qty = Number(t.quantity || t.rawAmount || 0);
  const amount = Number(t.amount || 0);
  const price = Number(t.price || 0);
  return !qty && !amount && !price;
}

function isStaking(action: string) {
  return /стейк|stak/i.test(action || "");
}

function tradeResultTitle(result: ReturnType<typeof calculateTransactionRealizedPnl>[number]) {
  if (!result) return "Для этой строки нет достаточной базы входа, поэтому результат не показывается.";
  const source = result.source === "api-note"
    ? "Точное число из audit note учетного слоя."
    : "Расчет по журналу сделок: сумма продажи минус списанная себестоимость по старой средней входа.";
  return `${source} Средняя входа: ${fmtUSD(result.avgEntry)}; себестоимость проданной части: ${fmtUSD(result.costBasisSold)}.`;
}

// Одна покупка/продажа приходит из двух источников: запись BALANCE_DELT
// (с кол-вом и ценой) и реальный on-chain своп (та же сумма, но кол-во 0,
// цена пустая). Схлопываем дубли по активу+действию+сумме, оставляя строку
// с числами (большее количество).
function dedupeTrades(list: InvestorTransaction[]): InvestorTransaction[] {
  const seen = new Map<string, number>();
  const out: InvestorTransaction[] = [];
  for (const t of list) {
    const amount = Number(t.amount || 0);
    const qty = Number(t.quantity || t.rawAmount || 0);
    if (!amount) {
      out.push(t);
      continue;
    }
    const key = `${(t.asset || t.rawAsset || "").toUpperCase()}|${(t.action || "").toLowerCase()}|${Math.round(amount * 100)}`;
    const existingIdx = seen.get(key);
    if (existingIdx === undefined) {
      seen.set(key, out.length);
      out.push(t);
    } else {
      const existing = out[existingIdx];
      const existingQty = Number(existing.quantity || existing.rawAmount || 0);
      if (qty > existingQty) out[existingIdx] = t; // оставляем строку с числами
    }
  }
  return out;
}

function isJournalTrade(transaction: InvestorTransaction) {
  return /покуп|buy|прод|sell/i.test(transaction.action || "");
}

function journalAction(transaction: InvestorTransaction): "buy" | "sell" {
  return /прод|sell/i.test(transaction.action || "") ? "sell" : "buy";
}

function findPreTradeDecision(
  transaction: InvestorTransaction,
  entries: DecisionJournalEntry[],
  tradeCaseId?: string | null,
) {
  if (tradeCaseId) {
    const exact = entries.find((entry) => entry.tradeCaseId === tradeCaseId);
    if (exact) return exact;
  }
  const transactionTime = Date.parse(transaction.date);
  const transactionAmount = Number(transaction.amount || 0);
  return entries.find((entry) => {
    if (entry.asset.toUpperCase() !== (transaction.asset || transaction.rawAsset).toUpperCase()) return false;
    if (entry.action !== journalAction(transaction)) return false;
    const decisionTime = Date.parse(entry.createdAt);
    if (Number.isFinite(transactionTime) && Number.isFinite(decisionTime)) {
      const distance = transactionTime - decisionTime;
      if (distance < 0 || distance > 14 * 24 * 60 * 60 * 1000) return false;
    }
    if (!transactionAmount || !entry.amountUsd) return true;
    return Math.abs(entry.amountUsd - transactionAmount) <= Math.max(1, transactionAmount * 0.05);
  });
}

const ADHERENCE_OPTIONS: Array<{ value: TradePlanAdherence; label: string }> = [
  { value: "", label: "Выберите" },
  { value: "yes", label: "Да" },
  { value: "partial", label: "Частично" },
  { value: "no", label: "Нет" },
];

const ERROR_OPTIONS: Array<{ value: TradeErrorType; label: string }> = [
  { value: "", label: "Выберите" },
  { value: "none", label: "Ошибки не было" },
  { value: "missing-limit", label: "Лимитка не была выставлена" },
  { value: "fomo", label: "FOMO / погоня за ростом" },
  { value: "no-plan", label: "Сделка без плана" },
  { value: "early-exit", label: "Ранний или полный выход без правила" },
  { value: "revenge", label: "Сделка после убытка" },
  { value: "oversize", label: "Превышен размер позиции" },
  { value: "other", label: "Другая ошибка" },
];

function EquityCurve({ points }: { points: PortfolioHistoryPoint[] }) {
  if (points.length < 2) {
    return <div className="v2-rep-empty">Недостаточно точек истории</div>;
  }

  const width = 280;
  const height = 80;
  const values = points.map((point) => point.portfolioValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coordinates = values.map((value, index) => ({
    x: index * step,
    y: height - ((value - min) / range) * (height - 12) - 6,
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const latest = coordinates[coordinates.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="v2-rep-equity-svg" aria-label="История стоимости портфеля">
      <defs>
        <linearGradient id="eq-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(77,239,255,0.22)" />
          <stop offset="100%" stopColor="rgba(77,239,255,0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#eq-area)" />
      <path d={linePath} fill="none" stroke="rgba(77,239,255,0.85)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={latest.x} cy={latest.y} r="3" fill="rgba(77,239,255,1)" />
    </svg>
  );
}

export function V2ReportsPage({
  mode = "reports",
  history,
  transactions,
  positions,
  realizedPnlUsd,
  decisionJournal = [],
  traderJournal = [],
  behavior,
  onDeleteDecision,
  onSaveTradeReview,
  tradeCaseIdByTransaction = {},
}: Props) {
  const editable = mode === "trading";
  const sortedHistory = useMemo(() => getSortedPortfolioHistory(history), [history]);
  const newestFirst = useMemo(() => [...sortedHistory].reverse(), [sortedHistory]);
  const summary = useMemo(() => getPortfolioHistorySummary(sortedHistory), [sortedHistory]);
  const positionPnl = useMemo(
    () => positions
      .filter((position) => position.invested > 0 || position.value > 0)
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)),
    [positions],
  );
  const maxAbsPnl = Math.max(1, ...positionPnl.map((position) => Math.abs(position.pnl)));
  const first = summary.firstPoint;
  const latest = summary.latestPoint;
  const changeTone = summary.portfolioValueChange >= 0 ? "is-pos" : "is-neg";
  const journalTrades = useMemo(
    () => editable
      ? dedupeTrades(transactions.filter((transaction) => !isEmptyRow(transaction) && isJournalTrade(transaction)))
      : [],
    [editable, transactions],
  );
  const reviewByTransaction = useMemo(
    () => new Map(traderJournal.map((entry) => [entry.transactionId, entry])),
    [traderJournal],
  );
  const journalTradeResults = useMemo(
    () => calculateTransactionRealizedPnl(journalTrades),
    [journalTrades],
  );
  const reviewedTrades = journalTrades.filter((transaction) =>
    isTradeReviewComplete(reviewByTransaction.get(transactionJournalId(transaction))),
  ).length;
  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<TraderJournalDraft | null>(null);

  const openTradeReview = (transaction: InvestorTransaction) => {
    if (!editable) return;
    const transactionId = transactionJournalId(transaction);
    const existing = reviewByTransaction.get(transactionId);
    const linkedTradeCaseId = existing?.tradeCaseId ?? tradeCaseIdByTransaction[transactionId] ?? null;
    const decision = findPreTradeDecision(transaction, decisionJournal, linkedTradeCaseId);
    setOpenReviewId(transactionId);
    setReviewDraft(existing
      ? { ...existing }
      : {
          transactionId,
          tradeCaseId: linkedTradeCaseId,
          thesis: decision?.note ?? "",
          expectedScenario: decision
            ? `${decision.setup}. ${decision.orderPlan || `${fmtUSD(decision.amountUsd)} по ${decision.buyPrice ? fmtUSD(decision.buyPrice) : "плановой цене"}`}`
            : "",
          invalidation: decision?.invalidation ?? "",
          executionReview: "",
          emotion: decision?.emotion ?? "",
          adherence: "",
          errorType: decision ? "none" : "",
          lesson: "",
          nextRule: "",
        });
  };

  const updateReview = <K extends keyof TraderJournalDraft>(key: K, value: TraderJournalDraft[K]) => {
    setReviewDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const saveTradeReview = () => {
    if (!editable || !reviewDraft || !onSaveTradeReview) return;
    onSaveTradeReview(reviewDraft);
    setOpenReviewId(null);
    setReviewDraft(null);
  };
  const reviewDraftComplete = reviewDraft
    ? isTradeReviewComplete({ ...reviewDraft, updatedAt: "" })
    : false;

  // Зафиксированная прибыль приходит из блока закрытых позиций «Расчетов» —
  // единственного источника. Прежняя оценка по журналу сделок давала второе,
  // другое число рядом и путала: какое из них правда.

  return (
    <section
      className={`v2-reports-page ${mode === "trading" ? "is-trading-workspace" : ""}`}
      aria-label={mode === "trading" ? "Дневник торгового цикла" : "Отчёты"}
    >
      <div className="v2-rep-kpi-row">
        <div className="v2-rep-kpi">
          <span className="v2-rep-kpi-label">Точек истории</span>
          <strong className="v2-rep-kpi-value">{summary.pointsCount}</strong>
        </div>
        <div className="v2-rep-kpi">
          <span className="v2-rep-kpi-label">Стоимость портфеля</span>
          <strong className="v2-rep-kpi-value">{latest ? fmtUSD(latest.portfolioValue) : "—"}</strong>
        </div>
        <div className="v2-rep-kpi">
          <span className="v2-rep-kpi-label">Вложено</span>
          <strong className="v2-rep-kpi-value">{latest ? fmtUSD(latest.invested) : "—"}</strong>
        </div>
        <div className="v2-rep-kpi">
          {/* Уточнение по решению владельца: это прибыль по ОТКРЫТЫМ позициям.
              Зафиксированная живёт отдельной строкой ниже. */}
          <span className="v2-rep-kpi-label">Нереализованный результат</span>
          <strong className={`v2-rep-kpi-value ${latest && latest.pnl >= 0 ? "v2-rep-accent" : ""}`}>
            {latest ? signedMoney(latest.pnl) : "—"}
          </strong>
        </div>
        <div className="v2-rep-kpi">
          <span className="v2-rep-kpi-label">Изменение за период</span>
          <strong className={`v2-rep-kpi-value v2-rep-cell-pnl ${changeTone}`}>
            {summary.pointsCount > 1 ? fmtPct(summary.portfolioValueChangePct) : "—"}
          </strong>
        </div>
        <div className="v2-rep-kpi">
          <span className="v2-rep-kpi-label">
            Реализованный результат
            <V2SourceTag source="manual" title="Блок закрытых позиций в «Расчетах» — заполняется вручную" />
          </span>
          <strong className={`v2-rep-kpi-value v2-rep-cell-pnl ${(realizedPnlUsd ?? 0) >= 0 ? "is-pos" : "is-neg"}`}>
            {typeof realizedPnlUsd === "number" ? signedMoney(realizedPnlUsd) : "—"}
          </strong>
        </div>
      </div>

      <div className="v2-rep-body">
        <div className="v2-rep-left">
          <div className="v2-panel v2-rep-journal-panel">
            <div className="v2-rep-journal-header">
              <span className="v2-panel-kicker">История портфеля</span>
              <V2SourceTag source="computed" title="Ежедневные снимки портфеля, считает система" />
            </div>

            <div className="v2-rep-table">
              <div className="v2-rep-table-head">
                <span>Дата</span>
                <span>Портфель</span>
                <span>Вложено</span>
                <span>Результат</span>
                <span>Результат %</span>
                <span>Резерв</span>
                <span>Позиции</span>
                <span>Источник</span>
                <span>Заметка</span>
              </div>

              <div className="v2-rep-table-body">
                {newestFirst.length === 0 ? (
                  <div className="v2-rep-empty">API пока не вернул историю портфеля</div>
                ) : (
                  newestFirst.map((point, index) => {
                    const note = point.note || point.comment || point.trigger || "—";
                    const source = point.source || point.pointType || "—";
                    const pnlTone = point.pnl >= 0 ? "is-pos" : "is-neg";

                    return (
                      // data-label подставляется как подпись поля в мобильной
                      // карточке (заголовок таблицы там скрыт).
                      <div key={`${point.date}-${index}`} className="v2-rep-row">
                        <span className="v2-rep-cell-date" data-label="Дата">{fmtDate(point.date)}</span>
                        <span className="v2-rep-cell-amount" data-label="Портфель">{fmtUSD(point.portfolioValue)}</span>
                        <span className="v2-rep-cell-price" data-label="Вложено">{fmtUSD(point.invested)}</span>
                        <span className={`v2-rep-cell-pnl ${pnlTone}`} data-label="Результат">{signedMoney(point.pnl)}</span>
                        <span className={`v2-rep-cell-pnl ${pnlTone}`} data-label="Результат %">{fmtPct(point.pnlPct)}</span>
                        <span className="v2-rep-cell-price" data-label="Резерв">{fmtUSD(point.reserve)}</span>
                        <span className="v2-rep-cell-fg" data-label="Позиции">{Math.round(point.positionsCount)}</span>
                        <span className="v2-rep-tag is-manual" data-label="Источник">{source}</span>
                        <span className="v2-rep-cell-price" data-label="Заметка" title={note}>{note}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {editable && (
          <div className="v2-panel v2-rep-journal-panel v2-rep-trader-panel">
            <div className="v2-rep-journal-header">
              <div>
                <span className="v2-panel-kicker">Дневник трейдера</span>
                <span className="v2-rep-trader-coverage">
                  Полный разбор: {reviewedTrades}/{journalTrades.length}
                </span>
              </div>
              <V2SourceTag source="computed" title="Сделки приходят из API; разбор сохраняется вручную на этом устройстве" />
            </div>

            <div className="v2-rep-trader-list">
              {journalTrades.length === 0 ? (
                <div className="v2-rep-empty">API пока не вернул покупки и продажи для разбора.</div>
              ) : journalTrades.map((transaction, index) => {
                const transactionId = transactionJournalId(transaction);
                const review = reviewByTransaction.get(transactionId);
                const reviewComplete = isTradeReviewComplete(review);
                const linkedTradeCaseId = review?.tradeCaseId ?? tradeCaseIdByTransaction[transactionId] ?? null;
                const decision = findPreTradeDecision(transaction, decisionJournal, linkedTradeCaseId);
                const linkedByTradeCaseId = Boolean(linkedTradeCaseId && decision?.tradeCaseId === linkedTradeCaseId);
                const tradeResult = journalTradeResults[index];
                const isOpen = openReviewId === transactionId && reviewDraft?.transactionId === transactionId;
                const gateLinkClass = linkedByTradeCaseId
                  ? "is-linked"
                  : decision
                    ? "is-approximate"
                    : "is-missing";

                return (
                  <div key={transactionId} className={`v2-rep-trader-row ${reviewComplete ? "is-reviewed" : "is-pending"}`}>
                    <div className="v2-rep-trader-head">
                      <span className="v2-rep-cell-date">{fmtDate(transaction.date)}</span>
                      <strong>{transaction.asset || transaction.rawAsset || "—"}</strong>
                      <span className={`v2-rep-type-chip ${transactionTone(transaction)}`}>{displayAction(transaction)}</span>
                      <span>{transaction.amount ? fmtUSD(transaction.amount) : "—"}</span>
                      <span className={`v2-rep-cell-pnl ${tradeResult ? tradeResult.realizedPnl >= 0 ? "is-pos" : "is-neg" : ""}`}>
                        {tradeResult ? signedMoney(tradeResult.realizedPnl) : "результат —"}
                      </span>
                      <span className={`v2-rep-trader-gate ${gateLinkClass}`}>
                        {linkedByTradeCaseId ? "Связан по ID" : decision ? "Приблизительное совпадение" : "Без допуска"}
                      </span>
                      <span className={`v2-rep-trader-state ${reviewComplete ? "is-complete" : ""}`}>
                        {reviewComplete ? "Разобрано" : "Нужен разбор"}
                      </span>
                      <button type="button" onClick={() => isOpen ? setOpenReviewId(null) : openTradeReview(transaction)}>
                        {isOpen ? "Закрыть" : review ? "Изменить" : "Разобрать"}
                      </button>
                    </div>

                    {editable && isOpen && reviewDraft && (
                      <div className="v2-rep-trader-form">
                        <label>
                          <span>Тезис сделки</span>
                          <textarea value={reviewDraft.thesis} onChange={(event) => updateReview("thesis", event.target.value)} />
                        </label>
                        <label>
                          <span>Ожидаемый сценарий и план</span>
                          <textarea value={reviewDraft.expectedScenario} onChange={(event) => updateReview("expectedScenario", event.target.value)} />
                        </label>
                        <label>
                          <span>Сценарий отмены</span>
                          <textarea value={reviewDraft.invalidation} onChange={(event) => updateReview("invalidation", event.target.value)} />
                        </label>
                        <label>
                          <span>Что произошло фактически</span>
                          <textarea value={reviewDraft.executionReview} onChange={(event) => updateReview("executionReview", event.target.value)} />
                        </label>
                        <label>
                          <span>Эмоциональное состояние</span>
                          <input value={reviewDraft.emotion} onChange={(event) => updateReview("emotion", event.target.value)} />
                        </label>
                        <label>
                          <span>Соблюдён план</span>
                          <select value={reviewDraft.adherence} onChange={(event) => updateReview("adherence", event.target.value as TradePlanAdherence)}>
                            {ADHERENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Тип ошибки</span>
                          <select value={reviewDraft.errorType} onChange={(event) => updateReview("errorType", event.target.value as TradeErrorType)}>
                            {ERROR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Главный урок</span>
                          <textarea value={reviewDraft.lesson} onChange={(event) => updateReview("lesson", event.target.value)} />
                        </label>
                        <label className="is-wide">
                          <span>Правило на следующую сделку</span>
                          <textarea value={reviewDraft.nextRule} onChange={(event) => updateReview("nextRule", event.target.value)} />
                        </label>
                        <div className="v2-rep-trader-form-foot">
                          <span>Полным считается разбор, где заполнены все поля.</span>
                          <button type="button" disabled={!onSaveTradeReview || !reviewDraftComplete} onClick={saveTradeReview}>
                            {reviewDraftComplete ? "Сохранить разбор" : "Заполните все поля"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {editable && (
          <div className="v2-panel v2-rep-journal-panel v2-rep-decision-panel">
            <div className="v2-rep-journal-header">
              <span className="v2-panel-kicker">Журнал допусков</span>
              <V2SourceTag source="manual" title="Снимки проверки сделки, сохранённые вручную на этом устройстве" />
            </div>

            <div className="v2-rep-decision-list">
              {decisionJournal.length === 0 ? (
                <div className="v2-rep-empty">
                  Пока нет сохранённых решений. Чтобы журнал стал выше 0%:
                  откройте «Проверка», заполните сделку, причину входа, риск,
                  сценарий отмены и сохраните решение.
                </div>
              ) : decisionJournal.slice(0, 8).map((entry) => (
                <div key={entry.id} className={`v2-rep-decision-row ${entry.status === "БЛОКИРОВКА" ? "is-block" : ""}`}>
                  <div className="v2-rep-decision-main">
                    <span className="v2-rep-cell-date">{fmtDate(entry.createdAt)}</span>
                    <strong>{entry.asset}</strong>
                    <span className="v2-rep-decision-muted">{entry.category}</span>
                    <div className="v2-rep-decision-actions">
                      <span className={`v2-rep-decision-status ${entry.status === "БЛОКИРОВКА" ? "is-block" : "is-ok"}`}>
                        {entry.status}
                      </span>
                      {editable && onDeleteDecision && (
                        <button type="button" onClick={() => onDeleteDecision(entry.id)}>
                          Удалить
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="v2-rep-decision-link">
                    {entry.tradeCaseId ? `TradeCase · ${entry.tradeCaseId}` : "Legacy запись · приблизительная связь"}
                  </div>
                  <div className="v2-rep-decision-grid">
                    <span>Сумма</span>
                    <strong>{fmtUSD(entry.amountUsd)}</strong>
                    <span>Цена</span>
                    <strong>{entry.buyPrice ? fmtUSD(entry.buyPrice) : "—"}</strong>
                    <span>Здоровье</span>
                    <strong>
                      {entry.healthBefore ?? "—"}
                      {entry.healthApplicable && entry.healthAfter !== null
                        ? ` → ${entry.healthAfter} ${entry.healthDelta !== null ? signedScore(entry.healthDelta) : ""}`
                        : " → не применяется"}
                    </strong>
                    <span>Сетап</span>
                    <strong>{entry.setup || "—"}</strong>
                    <span>Состояние</span>
                    <strong>{entry.emotion || "—"}</strong>
                    <span>Выживаемость</span>
                    <strong>{entry.survivalStatus || "—"}</strong>
                  </div>
                  {(entry.reasons.length > 0 || entry.note) && (
                    <div className="v2-rep-decision-note">
                      {entry.reasons[0] || entry.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="v2-panel v2-rep-journal-panel">
            <div className="v2-rep-journal-header">
              <span className="v2-panel-kicker">История сделок</span>
              {/* Строки пишут импорты кошельков, а не человек — в отличие
                  от блока реализованного профита в «Расчетах». */}
              <V2SourceTag source="api" title="Заполняется автоматически импортами кошельков" />
            </div>

            <div className="v2-rep-table v2-rep-transaction-table">
              <div className="v2-rep-table-head">
                <span>Дата</span>
                <span>Актив</span>
                <span>Действие</span>
                <span>Количество</span>
                <span>Цена</span>
                <span>Сумма</span>
                <span title="Точный результат сделки должен приходить из учетного слоя">Результат сделки</span>
                <span>Сеть</span>
                <span>Статус</span>
                <span>Транзакция</span>
              </div>

              <div className="v2-rep-table-body">
                {(() => {
                  // Показываем сделки И переводы (приход/расход) — не скрываем трансферы.
                  const tradeTransactions = dedupeTrades(
                    transactions.filter((t) => !isEmptyRow(t))
                  );
                  const tradeResults = calculateTransactionRealizedPnl(tradeTransactions);
                  return tradeTransactions.length === 0 ? (
                  <div className="v2-rep-empty">API пока не вернул историю сделок</div>
                ) : tradeTransactions.map((transaction, index) => {
                  const transactionId = transaction.hash || transaction.id;
                  const details = transaction.comment || transaction.note || transaction.counterparty || transactionId;
                  const tradeResult = tradeResults[index];

                  return (
                    <div
                      key={`${transaction.id || transaction.hash}-${index}`}
                      className={`v2-rep-row ${transactionTone(transaction)}`}
                      title={details}
                    >
                      <span className="v2-rep-cell-date" data-label="Дата">{fmtDate(transaction.date)}</span>
                      <span className="v2-rep-cell-asset" data-label="Актив">{transaction.asset || transaction.rawAsset || "—"}</span>
                      <span className={`v2-rep-type-chip ${transactionTone(transaction)}`}>
                        {displayAction(transaction)}
                      </span>
                      <span className="v2-rep-cell-price" data-label="Количество">{fmtQuantity(transaction.quantity || transaction.rawAmount)}</span>
                      <span className="v2-rep-cell-price" data-label="Цена">
                        {(() => {
                          const apy = isStaking(transaction.action)
                            ? stakingApy(transaction.asset || transaction.rawAsset)
                            : null;
                          if (apy != null) {
                            return (
                              <span className="v2-rep-apy-badge" title="Текущая ставка стейкинга (Tonstakers)">
                                {(apy * 100).toFixed(2)}% APY
                              </span>
                            );
                          }
                          return transaction.price ? fmtUSD(transaction.price) : "—";
                        })()}
                      </span>
                      <span className="v2-rep-cell-amount" data-label="Сумма">{transaction.amount ? fmtUSD(transaction.amount) : "—"}</span>
                      <span
                        className={`v2-rep-cell-pnl ${tradeResult ? tradeResult.realizedPnl >= 0 ? "is-pos" : "is-neg" : ""}`}
                        data-label="Результат сделки"
                        title={tradeResultTitle(tradeResult)}
                      >
                        {tradeResult ? signedMoney(tradeResult.realizedPnl) : "—"}
                      </span>
                      <span className="v2-rep-cell-fg" data-label="Сеть">{transaction.chain || transaction.walletId || "—"}</span>
                      <span className={`v2-rep-tag ${transaction.status === "APPROVED" ? "is-strategy" : "is-manual"}`} data-label="Статус">
                        {transaction.status || "—"}
                      </span>
                      <span className="v2-rep-cell-price" data-label="Транзакция" title={transactionId}>
                        {transactionId ? `${transactionId.slice(0, 8)}…` : "—"}
                      </span>
                    </div>
                  );
                });
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="v2-rep-right">
          {behavior && (
            <div className={`v2-panel v2-rep-behavior-panel ${behavior.status === "ПАУЗА" ? "is-block" : behavior.status === "НАБЛЮДЕНИЕ" ? "is-warn" : ""}`}>
              <div className="v2-panel-header">
                <span>Поведение</span>
                <span className="v2-rep-behavior-status">{behavior.status}</span>
              </div>
              <div className="v2-rep-behavior-score">
                <strong>{behavior.score}</strong>
                <span>/100</span>
              </div>
              <div className="v2-rep-behavior-grid">
                <span>Решений 24ч</span>
                <strong>{behavior.stats.decisions24h}</strong>
                <span>Блокировок 24ч</span>
                <strong>{behavior.stats.blocked24h}</strong>
                <span>Страх роста 30д</span>
                <strong>{behavior.stats.fomo30d}</strong>
                <span>После убытка 30д</span>
                <strong>{behavior.stats.afterLoss30d}</strong>
              </div>
              <div className="v2-rep-behavior-lines">
                {behavior.signals.length === 0 ? (
                  <span>Поведенческих нарушений нет.</span>
                ) : behavior.signals.slice(0, 4).map((signal) => (
                  <span key={`${signal.kind}-${signal.text}`} className={signal.severity === "block" ? "is-block" : ""}>
                    {signal.text}
                  </span>
                ))}
              </div>
              {behavior.cooldownUntil && (
                <div className="v2-rep-behavior-cooldown">
                  Пауза до {fmtDate(behavior.cooldownUntil)}
                </div>
              )}
            </div>
          )}

          <div className="v2-panel v2-rep-equity-panel">
            <div className="v2-panel-header">
              <span>Стоимость портфеля</span>
              <span className={`v2-rep-cell-pnl ${changeTone}`}>
                {summary.pointsCount > 1 ? signedMoney(summary.portfolioValueChange) : "—"}
              </span>
            </div>
            <div className="v2-rep-equity-labels">
              <span className="v2-rep-equity-now">{latest ? fmtUSD(latest.portfolioValue) : "—"}</span>
              <span className="v2-rep-equity-start">{first ? fmtUSD(first.portfolioValue) : "—"}</span>
            </div>
            <EquityCurve points={sortedHistory} />
            <div className="v2-rep-equity-foot">
              <span>Первая точка</span>
              <span>Последняя точка</span>
            </div>
          </div>

          <div className="v2-panel v2-rep-pnl-panel">
            <div className="v2-panel-header">
              <span>Текущий результат по позициям</span>
            </div>
            <div className="v2-rep-pnl-list">
              {positionPnl.length === 0 ? (
                <div className="v2-rep-empty">Нет открытых позиций</div>
              ) : positionPnl.map((position) => (
                <div key={position.asset} className="v2-rep-pnl-row">
                  <span className="v2-rep-pnl-asset">{position.asset}</span>
                  <div className="v2-rep-pnl-bar-wrap">
                    <div
                      className={`v2-rep-pnl-bar${position.pnl >= 0 ? " is-pos" : " is-neg"}`}
                      style={{ width: `${(Math.abs(position.pnl) / maxAbsPnl) * 100}%` }}
                    />
                  </div>
                  <span className={`v2-rep-pnl-val${position.pnl >= 0 ? " is-pos" : " is-neg"}`}>
                    {signedMoney(position.pnl)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
