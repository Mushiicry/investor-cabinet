import type { ReactNode } from "react";

type OverviewTerminalTone = "cyan" | "violet" | "green" | "red";
type OverviewTerminalIconName = "wallet" | "capital" | "star" | "down";
type OverviewSparklineShape = "portfolio" | "capital" | "best" | "worst";

export function TrendArrow({ direction = "up" }: { direction?: "up" | "down" }) {
  return (
    <span
      aria-hidden="true"
      className={`trend-arrow ${direction === "up" ? "trend-arrow-up" : "trend-arrow-down"}`}
    >
      {direction === "up" ? "↗" : "↘"}
    </span>
  );
}

export function MiniInfo({
  label,
  value,
  sub,
  tone = "cyan",
  center = false,
  valueClassName = "",
  subClassName = "",
  labelClassName = "",
  panelClassName = "",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "cyan" | "violet" | "yellow";
  center?: boolean;
  valueClassName?: string;
  subClassName?: string;
  labelClassName?: string;
  panelClassName?: string;
}) {
  return (
    <div className={`mini-panel mini-panel-${tone} ${center ? "mini-panel-center" : ""} ${panelClassName}`.trim()}>
      <div className={`mini-label ${labelClassName}`.trim()}>{label}</div>
      <div className={`mini-value ${valueClassName}`.trim()}>{value}</div>
      {sub ? <div className={`mini-sub ${subClassName}`.trim()}>{sub}</div> : null}
    </div>
  );
}

export function OverviewTerminalIcon({ name }: { name: OverviewTerminalIconName }) {
  const icons = {
    wallet: (
      <>
        <path d="M7 9.5h12a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h11" />
        <path d="M7 4v5.5" />
        <path d="M17 14h.01" />
      </>
    ),
    capital: (
      <>
        <path d="M12 3v18" />
        <path d="M17 7.5c-.9-1.1-2.4-1.8-4.4-1.8-2.7 0-4.6 1.2-4.6 3.1 0 4.3 9.5 1.9 9.5 6.5 0 2-1.9 3.2-4.8 3.2-2.2 0-4-.8-5-2.2" />
      </>
    ),
    star: (
      <path d="m12 3.8 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6L7.1 19l.9-5.5-4-3.9 5.5-.8L12 3.8Z" />
    ),
    down: (
      <>
        <path d="M12 4v15" />
        <path d="m6 13 6 6 6-6" />
      </>
    ),
  };

  return (
    <span className={`overview-card-icon overview-card-icon-${name}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">{icons[name]}</svg>
    </span>
  );
}

export function OverviewSparkline({ tone, shape }: { tone: OverviewTerminalTone; shape: OverviewSparklineShape }) {
  const points = {
    portfolio: "4,67 16,66 25,58 33,63 43,48 51,53 61,38 71,55 82,47 91,56 104,41 113,46 124,31 137,36 147,25 158,29 171,18 184,23 196,14",
    capital: "4,28 13,14 22,55 31,34 39,46 48,29 58,44 67,38 78,59 90,47 104,51 119,42 132,49 148,53 164,50 180,60 196,68",
    best: "4,68 18,58 31,49 45,52 58,43 71,47 86,36 102,39 116,28 132,31 147,22 162,25 177,15 196,11",
    worst: "4,29 17,18 31,25 45,22 58,37 73,31 88,45 102,42 118,54 133,48 149,59 164,62 181,70 196,74",
  };

  return (
    <svg className={`overview-sparkline overview-sparkline-${tone}`} viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true">
      <path className="overview-sparkline-baseline" d="M4 72H196" />
      <polyline className="overview-sparkline-line" points={points[shape]} />
      <polyline className="overview-sparkline-glow" points={points[shape]} />
    </svg>
  );
}
