import { useMemo } from "react";
import {
  getPortfolioHistorySummary,
  getSortedPortfolioHistory,
} from "../../lib/historySelectors";
import type { InvestorTransaction, PortfolioHistoryPoint } from "../../types/portfolio";
import type { V2Position } from "../InvestorCabinetV2Lab";
import { stakingApy } from "../../config/stakingRules";

type Props = {
  history: PortfolioHistoryPoint[];
  transactions: InvestorTransaction[];
  positions: V2Position[];
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

function isSell(action: string) {
  const a = (action || "").toLowerCase();
  return a.includes("прод") || a.includes("sell");
}

// Реализованный PnL с продажи: (цена продажи − средняя цена входа) × количество.
// avgEntry берём текущий из позиций (приближение — исторические лоты не трекаем;
// на Arbitrum комиссии <$0.01, поэтому считаем до газа).
function computeRealizedPnl(
  t: InvestorTransaction,
  avgByAsset: Map<string, number>,
): number | null {
  if (!isSell(t.action)) return null;
  const asset = (t.asset || t.rawAsset || "").toUpperCase();
  const avg = avgByAsset.get(asset);
  const price = Number(t.price || 0);
  const qty = Number(t.quantity || t.rawAmount || 0);
  if (!avg || !price || !qty) return null;
  return (price - avg) * qty;
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

export function V2ReportsPage({ history, transactions, positions }: Props) {
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

  // Средняя цена входа по каждому активу — для реализованного PnL с продаж.
  const avgEntryByAsset = useMemo(() => {
    const m = new Map<string, number>();
    positions.forEach((p) => {
      if (p.avgEntry > 0) {
        const key = p.asset.toUpperCase();
        const base = p.asset.replace(/ (LONG|SHORT)$/i, "").toUpperCase();
        m.set(key, p.avgEntry);
        if (!m.has(base)) m.set(base, p.avgEntry);
      }
    });
    return m;
  }, [positions]);

  // Итого зафиксировано с продаж (сумма реализованного PnL по всем сделкам-продажам).
  const totalRealized = useMemo(() => {
    const trades = dedupeTrades(
      transactions.filter((t) => !isTransfer(t.action) && !isEmptyRow(t)),
    );
    let sum = 0;
    let has = false;
    for (const t of trades) {
      const r = computeRealizedPnl(t, avgEntryByAsset);
      if (r != null) {
        sum += r;
        has = true;
      }
    }
    return has ? sum : null;
  }, [transactions, avgEntryByAsset]);

  return (
    <section className="v2-reports-page" aria-label="Отчёты">
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
          <span className="v2-rep-kpi-label">PnL</span>
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
          <span className="v2-rep-kpi-label" title="Оценка по текущей средней цене входа. Для точного налогового/бухгалтерского учёта нужен лотовый (FIFO) расчёт с учётом комиссий.">
            Зафиксировано с продаж · <em className="v2-rep-est">оценка</em>
          </span>
          <strong className={`v2-rep-kpi-value v2-rep-cell-pnl ${totalRealized != null && totalRealized >= 0 ? "is-pos" : "is-neg"}`}>
            {totalRealized != null ? `≈ ${signedMoney(totalRealized)}` : "—"}
          </strong>
        </div>
      </div>

      <div className="v2-rep-body">
        <div className="v2-rep-left">
          <div className="v2-panel v2-rep-journal-panel">
            <div className="v2-rep-journal-header">
              <span className="v2-panel-kicker">История портфеля</span>
            </div>

            <div className="v2-rep-table">
              <div className="v2-rep-table-head">
                <span>Дата</span>
                <span>Портфель</span>
                <span>Вложено</span>
                <span>PnL</span>
                <span>PnL %</span>
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
                        <span className={`v2-rep-cell-pnl ${pnlTone}`} data-label="PnL">{signedMoney(point.pnl)}</span>
                        <span className={`v2-rep-cell-pnl ${pnlTone}`} data-label="PnL %">{fmtPct(point.pnlPct)}</span>
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

          <div className="v2-panel v2-rep-journal-panel">
            <div className="v2-rep-journal-header">
              <span className="v2-panel-kicker">История сделок</span>
            </div>

            <div className="v2-rep-table v2-rep-transaction-table">
              <div className="v2-rep-table-head">
                <span>Дата</span>
                <span>Актив</span>
                <span>Действие</span>
                <span>Количество</span>
                <span>Цена</span>
                <span>Сумма</span>
                <span title="Реализованный PnL — оценка по текущей средней цене входа (без лотового учёта и комиссий)">PnL сделки ≈</span>
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
                  return tradeTransactions.length === 0 ? (
                  <div className="v2-rep-empty">API пока не вернул историю сделок</div>
                ) : tradeTransactions.map((transaction, index) => {
                  const transactionId = transaction.hash || transaction.id;
                  const details = transaction.comment || transaction.note || transaction.counterparty || transactionId;

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
                      {(() => {
                        const realized = computeRealizedPnl(transaction, avgEntryByAsset);
                        if (realized == null) return <span className="v2-rep-cell-price" data-label="PnL сделки">—</span>;
                        return (
                          <span
                            className={`v2-rep-cell-pnl ${realized >= 0 ? "is-pos" : "is-neg"}`}
                            data-label="PnL сделки"
                            title="Реализованный PnL: (цена продажи − средняя цена входа) × количество"
                          >
                            {signedMoney(realized)}
                          </span>
                        );
                      })()}
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
              <span>Текущий PnL по позициям</span>
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
