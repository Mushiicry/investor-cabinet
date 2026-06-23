import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { FearGreedHistoryPoint, FearGreedStrategy } from "../../types/portfolio";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

type Props = {
  portfolio: V2Portfolio;
  strategy: FearGreedStrategy;
};

type ChartGeometry = {
  area: string;
  line: string;
  max: number;
  middle: number;
  min: number;
};

function buildChartGeometry(values: number[], w: number, h: number, pad = 3): ChartGeometry | null {
  if (values.length < 2) return null;

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const dataSpan = dataMax - dataMin;
  const margin = Math.max(4, dataSpan * 0.2);
  let min = Math.max(0, Math.floor(dataMin - margin));
  let max = Math.min(100, Math.ceil(dataMax + margin));

  if (max - min < 10) {
    const midpoint = (max + min) / 2;
    min = Math.max(0, Math.floor(midpoint - 5));
    max = Math.min(100, Math.ceil(midpoint + 5));
  }

  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const line = values
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return {
    line,
    area: `${line} L${w - pad},${h} L${pad},${h} Z`,
    max,
    middle: Math.round((max + min) / 2),
    min,
  };
}

function getMoscowDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function getFearGreedLabel(value: number) {
  if (value <= 24) return "Экстремальный страх";
  if (value <= 44) return "Страх";
  if (value <= 54) return "Нейтрально";
  if (value <= 74) return "Жадность";
  return "Крайняя жадность";
}

function formatHistoryDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return year && month && day ? `${day}.${month}.${year}` : dateKey;
}

export function V2FearGreed({ strategy }: Props) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const value = Math.max(0, Math.min(100, Math.round(strategy.currentIndex)));
  const historyPoints = useMemo(() => {
    const byDate = new Map<string, FearGreedHistoryPoint>();

    (strategy.history ?? []).forEach((point) => {
      const date = getMoscowDateKey(point.date);
      if (date) byDate.set(date, point);
    });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, point]) => ({ ...point, date, value: Math.round(point.value) }));
  }, [strategy.history]);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayValue = historyPoints.find((point) => point.date === getMoscowDateKey(yesterday))?.value;
  const chartPoints = useMemo(() => {
    const byDate = new Map(historyPoints.map((point) => [point.date, point.value]));
    byDate.set(getMoscowDateKey(new Date()), value);
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-30);
  }, [historyPoints, value]);
  const w = 320;
  const h = 96;
  const chart = buildChartGeometry(chartPoints.map(([, pointValue]) => pointValue), w, h);
  const modalChart = buildChartGeometry(historyPoints.slice(-30).map((point) => point.value), 640, 180, 8);

  useEffect(() => {
    if (!isHistoryOpen) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsHistoryOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isHistoryOpen]);

  return (
    <>
      <section className="v2-panel v2-fear">
        <div className="v2-panel-header">
          <span>Индекс страха / жадности</span>
          <button className="v2-fg2-history-trigger" type="button" onClick={() => setIsHistoryOpen(true)}>
            История
          </button>
        </div>

        <div className="v2-fg2">
          <div className="v2-fg2-head">
            <div className="v2-fg2-readout">
              <strong>{value}</strong>
              <span>{getFearGreedLabel(value)}</span>
            </div>
            <div className="v2-fg2-meta">
              <span>Вчера</span>
              <b>{yesterdayValue ?? "—"}</b>
            </div>
          </div>

          <div className={`v2-fg2-chart${chart ? "" : " is-empty"}`}>
            {chart ? (
              <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="v2-fg2-svg" aria-label="История индекса страха и жадности">
                <defs>
                  <linearGradient id="v2-fg2-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6cc8e8" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#6cc8e8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgba(120,160,220,0.12)" strokeWidth="1" strokeDasharray="3 4" />
                <path d={chart.area} fill="url(#v2-fg2-area)" />
                <path d={chart.line} fill="none" stroke="#6cc8e8" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            ) : (
              <span className="v2-fg2-empty">История ожидает первую дневную точку</span>
            )}
            <div className="v2-fg2-yax" aria-hidden="true">
              <span>{chart?.max ?? 100}</span>
              <span>{chart?.middle ?? 50}</span>
              <span>{chart?.min ?? 0}</span>
            </div>
          </div>

          <div className="v2-fg2-scale">
            <div className="v2-fg2-bar">
              <span className="v2-fg2-marker" style={{ left: `${value}%` }} />
            </div>
            <div className="v2-fg2-ticks">
              <span>Страх</span>
              <span>Нейтрально</span>
              <span>Жадность</span>
            </div>
          </div>
        </div>
      </section>

      {isHistoryOpen && createPortal(
        <div className="v2-fg-history-overlay" role="presentation" onMouseDown={() => setIsHistoryOpen(false)}>
          <section
            className="v2-fg-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="v2-fg-history-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="v2-fg-history-head">
              <div>
                <span className="v2-panel-kicker">Индекс страха / жадности</span>
                <h2 id="v2-fg-history-title">История индекса</h2>
              </div>
              <button type="button" className="v2-fg-history-close" onClick={() => setIsHistoryOpen(false)} aria-label="Закрыть историю">
                ×
              </button>
            </div>

            <div className="v2-fg-history-chart">
              {modalChart ? (
                <svg viewBox="0 0 640 180" preserveAspectRatio="none" aria-label="График истории индекса">
                  <defs>
                    <linearGradient id="v2-fg-history-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6cc8e8" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#6cc8e8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={modalChart.area} fill="url(#v2-fg-history-area)" />
                  <path d={modalChart.line} fill="none" stroke="#6cc8e8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              ) : (
                <div className="v2-fg-history-empty">
                  История еще не синхронизирована. После первого дневного snapshot здесь появится график.
                </div>
              )}
            </div>

            <div className="v2-fg-history-list">
              {[...historyPoints].reverse().map((point) => (
                <div className="v2-fg-history-row" key={point.date}>
                  <time dateTime={point.date}>{formatHistoryDate(point.date)}</time>
                  <strong>{point.value}</strong>
                  <span>{point.label || getFearGreedLabel(point.value)}</span>
                  <small>{point.source || "—"}</small>
                </div>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
