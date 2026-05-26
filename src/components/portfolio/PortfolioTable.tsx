import { currency, percentDirect } from "../../lib/formatters";
import { getProfitColor } from "../../lib/uiHelpers";
import type { PositionCalculated } from "../../types/portfolio";

function getStatusBadgeClass(status: string): string {
  const normalizedStatus = String(status).toUpperCase();

  if (normalizedStatus === "RESERVE" || status === "Резерв") {
    return "status-badge-reserve";
  }

  if (normalizedStatus === "ACCUMULATE" || status === "Накапливать") {
    return "status-badge-accumulate";
  }

  if (normalizedStatus === "WATCH" || status === "Наблюдать") {
    return "status-badge-watch";
  }

  if (normalizedStatus === "HEDGE" || status === "Хедж") {
    return "status-badge-hedge";
  }

  if (normalizedStatus === "SPECULATION" || status === "Спекуляция") {
    return "status-badge-spec";
  }

  return "status-badge-hold";
}

function getPortfolioPnlClass(item: PositionCalculated): string {
  if (item.category === "Свободные деньги") {
    return "portfolio-pnl-neutral";
  }

  return getProfitColor(item.pnlPct) === "green"
    ? "portfolio-pnl-positive"
    : "portfolio-pnl-negative";
}

type PortfolioTableProps = {
  portfolio: PositionCalculated[];
};

export function PortfolioTable({ portfolio }: PortfolioTableProps) {
  const sortedPortfolio = [...portfolio].sort((a, b) => b.invested - a.invested);

  return (
    <div className="overflow-x-auto portfolio-table-wrap">
      <table className="w-full min-w-[1000px] border-separate border-spacing-y-3 portfolio-table">
        <thead>
          <tr className="portfolio-table-head-row">
            <th className="px-3 portfolio-th portfolio-th-left">Актив</th>
            <th className="px-3 portfolio-th">Категория</th>
            <th className="px-3 portfolio-th">Средняя</th>
            <th className="px-3 portfolio-th">Текущая</th>
            <th className="px-3 portfolio-th">Вложено</th>
            <th className="px-3 portfolio-th">Стоимость</th>
            <th className="px-3 portfolio-th">PnL</th>
            <th className="px-3 portfolio-th">Доля</th>
            <th className="px-3 portfolio-th">Статус</th>
          </tr>
        </thead>

        <tbody>
          {sortedPortfolio.map((item) => {
            const statusClass = getStatusBadgeClass(item.status);
            const pnlClass = getPortfolioPnlClass(item);

            return (
              <tr key={item.asset} className="portfolio-table-row portfolio-row-glass">
                <td className="px-3 py-3 rounded-l-2xl portfolio-td portfolio-td-asset">{item.asset}</td>

                <td className="px-3 py-3 portfolio-td portfolio-td-center">{item.category}</td>

                <td className="px-3 py-3 portfolio-td portfolio-td-center">{currency(item.avgEntry)}</td>

                <td className="px-3 py-3 portfolio-td portfolio-td-center">{currency(item.currentPrice)}</td>

                <td className="px-3 py-3 portfolio-td portfolio-td-center portfolio-td-money">{currency(item.invested)}</td>

                <td className="px-3 py-3 portfolio-td portfolio-td-center portfolio-td-money">{currency(item.currentValue)}</td>

                <td className={`px-3 py-3 portfolio-td portfolio-td-center portfolio-pnl-cell ${pnlClass}`}>
                  <span className="portfolio-pnl-main">
                    {item.pnl > 0 ? "+" : ""}
                    {currency(item.pnl)}
                  </span>
                  <span className="portfolio-pnl-sep"> / </span>
                  <span className="portfolio-pnl-percent">
                    {item.pnlPct > 0 ? "+" : ""}
                    {percentDirect(item.pnlPct)}
                  </span>
                </td>

                <td className="px-3 py-3 portfolio-td portfolio-td-center">{percentDirect(item.share)}</td>

                <td className="px-3 py-3 rounded-r-2xl portfolio-td portfolio-td-center">
                  <span
                    className={`status-badge ${statusClass}`}
                    title={item.status}
                  >
                    {item.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
