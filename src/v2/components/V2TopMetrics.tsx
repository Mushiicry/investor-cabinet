import type { ReactNode } from "react";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

type Props = {
  portfolio: V2Portfolio;
  fearGreedIndex?: number;
  fearGreedLabel?: string;
};

type Metric = {
  label: string;
  value: ReactNode;
  area: string;
  tone?: string;
  delta?: string;
  deltaTone?: string;
  sub?: string;
  subTone?: string;
  extraClass?: string;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const signedMoney = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "-" : ""}${money.format(Math.abs(value))}`;

const percent = (ratio: number, digits = 2) =>
  `${ratio >= 0 ? "+" : ""}${(ratio * 100).toFixed(digits)}%`;

export function V2TopMetrics({ portfolio, fearGreedIndex, fearGreedLabel }: Props) {
  const pnlTone =
    portfolio.pnlUsd > 0
      ? "top-metric-value-positive"
      : portfolio.pnlUsd < 0
        ? "top-metric-value-negative"
        : "";

  const metrics: Metric[] = [
    {
      label: "ВЛОЖЕНО",
      value: money.format(portfolio.totalInvested),
      area: "invested",
    },
    {
      label: "ПОЗИЦИИ",
      value: String(portfolio.positionsCount),
      area: "positions",
    },
    {
      label: "ПОРТФЕЛЬ СЕГОДНЯ",
      value: money.format(portfolio.totalPortfolioValue),
      delta: signedMoney(portfolio.pnlUsd),
      deltaTone: pnlTone,
      area: "portftoday",
    },
    {
      label: "PNL",
      value: percent(portfolio.pnlPct),
      tone: pnlTone,
      area: "pnl",
    },
    {
      label: "СВОБОДНЫЕ ДЕНЬГИ",
      value: money.format(portfolio.stableReserve),
      tone: portfolio.stableReserve > 0 ? "" : "top-metric-value-negative",
      area: "reserve",
    },
    ...(fearGreedIndex !== undefined ? [{
      label: "СТРАХ / ЖАДНОСТЬ",
      value: String(fearGreedIndex),
      tone: fearGreedIndex <= 25 ? "top-metric-value-negative" : fearGreedIndex >= 75 ? "top-metric-value-warn" : "",
      sub: fearGreedLabel ?? "",
      area: "feargreed",
      extraClass: "v2-metric--feargreed",
    }] : []),
  ];

  return (
    <header className="v2-topbar">
      <div className="v2-metrics">
        {metrics.map((metric) => (
          <div className={`v2-metric metric-card-beam${metric.extraClass ? ` ${metric.extraClass}` : ""}`} style={{ gridArea: metric.area }} key={metric.label}>
            <span className="top-metric-label">{metric.label}</span>
            {metric.value ? (
              <strong className={`top-metric-value ${metric.tone ?? ""}`}>{metric.value}</strong>
            ) : null}
            {metric.delta ? (
              <span className={`v2-metric-delta ${metric.deltaTone ?? ""}`}>{metric.delta}</span>
            ) : null}
            {metric.sub ? <span className={`v2-metric-subnote ${metric.subTone ?? ""}`}>{metric.sub}</span> : null}
          </div>
        ))}
      </div>
    </header>
  );
}
