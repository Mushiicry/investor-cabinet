import { useEffect, useMemo, useState } from "react";

type SparklinePoint = {
  ts: number;
  close: number;
};

type Props = {
  asset: string;
  symbol: string;
  href: string;
};

const VIEW_WIDTH = 174;
const VIEW_HEIGHT = 48;
const CHART_PAD = 3;

function isPoint(value: unknown): value is SparklinePoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<SparklinePoint>;
  return Number.isFinite(point.ts) && Number.isFinite(point.close);
}

function linePath(points: SparklinePoint[]) {
  if (points.length < 2) return "";
  const values = points.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.002, 0.000001);

  return points.map((point, index) => {
    const x = CHART_PAD + (index / (points.length - 1)) * (VIEW_WIDTH - CHART_PAD * 2);
    const y = CHART_PAD + (1 - (point.close - min) / range) * (VIEW_HEIGHT - CHART_PAD * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

export function V2PortfolioMiniChart({ asset, symbol, href }: Props) {
  const [points, setPoints] = useState<SparklinePoint[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`/api/market-sparkline?asset=${encodeURIComponent(asset)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Sparkline API failed: ${response.status}`);
        const json = await response.json() as { success?: unknown; points?: unknown };
        if (!json.success || !Array.isArray(json.points)) throw new Error("Invalid sparkline payload");
        const nextPoints = json.points.filter(isPoint);
        if (nextPoints.length < 2) throw new Error("Not enough sparkline points");
        setPoints(nextPoints);
        setFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
      }
    };

    void load();
    return () => controller.abort();
  }, [asset]);

  const path = useMemo(() => linePath(points), [points]);
  const rising = points.length > 1 && points[points.length - 1].close >= points[0].close;
  const stateClass = failed ? "is-failed" : path ? rising ? "is-up" : "is-down" : "is-loading";

  return (
    <a
      className={`v2-port-chart-link ${stateClass}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Открыть дневной график ${symbol} / USDT в TradingView`}
      aria-label={`Открыть дневной график ${symbol} / USDT в TradingView`}
    >
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        {path ? (
          <path d={path} />
        ) : (
          <path className="v2-port-chart-placeholder" d="M3 30 L35 25 L67 28 L99 20 L131 23 L171 14" />
        )}
      </svg>
    </a>
  );
}
