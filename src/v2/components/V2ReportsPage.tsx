import { useMemo } from "react";
import {
  getPortfolioHistorySummary,
  getSortedPortfolioHistory,
} from "../../lib/historySelectors";
import type { InvestorTransaction, PortfolioHistoryPoint } from "../../types/portfolio";
import type { V2Position } from "../InvestorCabinetV2Lab";

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

function transactionTone(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes("покуп") || normalized.includes("buy")) return "tx-buy";
  if (normalized.includes("прод") || normalized.includes("sell")) return "tx-sell";
  if (normalized.includes("перев") || normalized.includes("transfer")) return "tx-transfer";
  return "tx-reinforce";
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
                      <div key={`${point.date}-${index}`} className="v2-rep-row">
                        <span className="v2-rep-cell-date">{fmtDate(point.date)}</span>
                        <span className="v2-rep-cell-amount">{fmtUSD(point.portfolioValue)}</span>
                        <span className="v2-rep-cell-price">{fmtUSD(point.invested)}</span>
                        <span className={`v2-rep-cell-pnl ${pnlTone}`}>{signedMoney(point.pnl)}</span>
                        <span className={`v2-rep-cell-pnl ${pnlTone}`}>{fmtPct(point.pnlPct)}</span>
                        <span className="v2-rep-cell-price">{fmtUSD(point.reserve)}</span>
                        <span className="v2-rep-cell-fg">{Math.round(point.positionsCount)}</span>
                        <span className="v2-rep-tag is-manual">{source}</span>
                        <span className="v2-rep-cell-price" title={note}>{note}</span>
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
                <span>Сеть</span>
                <span>Статус</span>
                <span>Транзакция</span>
              </div>

              <div className="v2-rep-table-body">
                {transactions.length === 0 ? (
                  <div className="v2-rep-empty">API пока не вернул историю сделок</div>
                ) : transactions.map((transaction, index) => {
                  const transactionId = transaction.hash || transaction.id;
                  const details = transaction.comment || transaction.note || transaction.counterparty || transactionId;

                  return (
                    <div
                      key={`${transaction.id || transaction.hash}-${index}`}
                      className={`v2-rep-row ${transactionTone(transaction.action)}`}
                      title={details}
                    >
                      <span className="v2-rep-cell-date">{fmtDate(transaction.date)}</span>
                      <span className="v2-rep-cell-asset">{transaction.asset || transaction.rawAsset || "—"}</span>
                      <span className={`v2-rep-type-chip ${transactionTone(transaction.action)}`}>
                        {transaction.action || transaction.direction || "—"}
                      </span>
                      <span className="v2-rep-cell-price">{fmtQuantity(transaction.quantity || transaction.rawAmount)}</span>
                      <span className="v2-rep-cell-price">{transaction.price ? fmtUSD(transaction.price) : "—"}</span>
                      <span className="v2-rep-cell-amount">{transaction.amount ? fmtUSD(transaction.amount) : "—"}</span>
                      <span className="v2-rep-cell-fg">{transaction.chain || transaction.walletId || "—"}</span>
                      <span className={`v2-rep-tag ${transaction.status === "APPROVED" ? "is-strategy" : "is-manual"}`}>
                        {transaction.status || "—"}
                      </span>
                      <span className="v2-rep-cell-price" title={transactionId}>
                        {transactionId ? `${transactionId.slice(0, 8)}…` : "—"}
                      </span>
                    </div>
                  );
                })}
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
