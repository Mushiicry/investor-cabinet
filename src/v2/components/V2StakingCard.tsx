import { useEffect, useState } from "react";
import type { TonStaking, RatePoint } from "../../hooks/useTonStaking";
import { CryptoLogo } from "../../components/crypto/CryptoLogo";

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

const ton = (v: number, digits = 3) =>
  `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v)} TON`;

const signedTon = (v: number, digits = 4) =>
  `${v >= 0 ? "+" : "−"}${ton(Math.abs(v), digits)}`;
const signedUsd = (v: number) => `${v >= 0 ? "+" : "−"}${money(Math.abs(v))}`;

// ── Живой обратный отсчёт до конца цикла ──
function CycleTimer({ cycleEnd }: { cycleEnd: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, cycleEnd - now);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="v2-stake-timer">
      <span className="v2-stake-timer-label">След. пересчёт через</span>
      <span className="v2-stake-timer-val">
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </div>
  );
}

// Уплотняем реальные точки-якоря (депозиты) до ежедневных — линейная
// интерполяция между наблюдениями. Курс растёт ~линейно, так что это честно.
function densify(anchors: RatePoint[]): RatePoint[] {
  if (anchors.length < 2) return anchors;
  const DAY = 86400;
  const start = anchors[0].t;
  const end = anchors[anchors.length - 1].t;
  const out: RatePoint[] = [];
  for (let t = start; t < end; t += DAY) {
    let i = 0;
    while (i < anchors.length - 1 && anchors[i + 1].t < t) i++;
    const a = anchors[i];
    const b = anchors[Math.min(i + 1, anchors.length - 1)];
    const frac = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    out.push({ t, rate: a.rate + (b.rate - a.rate) * frac });
  }
  out.push(anchors[anchors.length - 1]);
  return out;
}

const dm = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" });

// ── Мини-график роста курса tsTON→GRAM (реальные точки из депозитов) ──
function RateSparkline({ points }: { points: RatePoint[] }) {
  if (points.length < 2) return null;

  const W = 620;
  const H = 130;
  const padX = 6;
  const padTop = 10;
  const padBot = 18;

  const dense = densify(points);
  const rates = dense.map((p) => p.rate);
  let min = Math.min(...rates);
  let max = Math.max(...rates);
  const span = max - min || max * 0.001 || 0.001;
  min -= span * 0.15; // немного воздуха сверху/снизу
  max += span * 0.15;
  const range = max - min;

  const tMin = dense[0].t;
  const tRange = dense[dense.length - 1].t - tMin || 1;
  const X = (t: number) => padX + ((t - tMin) / tRange) * (W - padX * 2);
  const Y = (r: number) => padTop + (1 - (r - min) / range) * (H - padTop - padBot);

  const coords = dense.map((p) => ({ x: X(p.t), y: Y(p.rate) }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${H - padBot} L ${coords[0].x.toFixed(1)} ${H - padBot} Z`;
  const last = coords[coords.length - 1];

  // Горизонтальные линии сетки
  const gridRows = [0, 0.5, 1];
  // Якоря = реальные наблюдения (депозиты + текущая)
  const anchors = points.map((p) => ({ x: X(p.t), y: Y(p.rate), rate: p.rate, t: p.t }));

  return (
    <div className="v2-stake-chart">
      <div className="v2-stake-chart-head">
        <span className="v2-stake-chart-title">Курс tsTON → GRAM · рост награды</span>
        <span className="v2-stake-chart-range">{points[0].rate.toFixed(4)} → {points[points.length - 1].rate.toFixed(4)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="v2-stake-chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="stake-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(90,240,141,0.3)" />
            <stop offset="100%" stopColor="rgba(90,240,141,0)" />
          </linearGradient>
          <filter id="stake-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Сетка */}
        {gridRows.map((g) => {
          const y = padTop + g * (H - padTop - padBot);
          return <line key={g} x1={padX} y1={y} x2={W - padX} y2={y} stroke="rgba(90,240,141,0.08)" strokeWidth="1" strokeDasharray="3 4" />;
        })}

        {/* Область + линия со свечением */}
        <path d={area} fill="url(#stake-area)" />
        <path d={line} fill="none" stroke="rgba(90,240,141,0.95)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" filter="url(#stake-glow)" />

        {/* Реальные якоря-депозиты */}
        {anchors.slice(0, -1).map((a, i) => (
          <g key={i}>
            <circle cx={a.x} cy={a.y} r="3.4" fill="#08131a" stroke="rgba(90,240,141,0.9)" strokeWidth="1.6" />
          </g>
        ))}

        {/* Текущая точка — крупная, с пульсом */}
        <circle cx={last.x} cy={last.y} r="8" fill="rgba(90,240,141,0.16)" />
        <circle cx={last.x} cy={last.y} r="4" fill="#5af08d" filter="url(#stake-glow)" />
      </svg>
      <div className="v2-stake-chart-axis">
        <span>{dm.format(new Date(points[0].t * 1000))}</span>
        <span>сегодня</span>
      </div>
    </div>
  );
}

export function V2StakingCard({ staking }: { staking: TonStaking }) {
  return (
    <div className="v2-stake-card">
      <div className="v2-stake-head">
        <CryptoLogo asset="TON" className="v2-stake-logo" />
        <div className="v2-stake-title">
          <span className="v2-stake-name">Стейкинг · GRAM</span>
          <span className="v2-stake-sub">Tonstakers · tsTON</span>
        </div>
        <span className="v2-stake-apy">{(staking.apy * 100).toFixed(2)}% APY</span>
      </div>

      {/* Ежедневное начисление + таймер цикла */}
      <div className="v2-stake-today">
        <span className="v2-stake-today-label">Начисление в сутки</span>
        <strong className="v2-stake-today-val is-up">{signedUsd(staking.dailyUsd)}</strong>
        <span className="v2-stake-today-ton is-up">{signedTon(staking.dailyTon)}</span>
      </div>

      {staking.cycleEnd > 0 && <CycleTimer cycleEnd={staking.cycleEnd} />}

      <div className="v2-stake-grid">
        <div className="v2-stake-cell">
          <span className="v2-stake-cell-label">В стейке</span>
          <strong className="v2-stake-cell-val">{ton(staking.stakedTon, 2)}</strong>
          <span className="v2-stake-cell-sub">{money(staking.stakedUsd)}</span>
        </div>
        <div className="v2-stake-cell">
          <span className="v2-stake-cell-label">tsTON на руках</span>
          <strong className="v2-stake-cell-val">{staking.tstonBalance.toFixed(2)}</strong>
          <span className="v2-stake-cell-sub">курс {staking.rate.toFixed(4)}</span>
        </div>
        {staking.depositedTon > 0 && (
          <div className="v2-stake-cell">
            <span className="v2-stake-cell-label">Всего заработано</span>
            <strong className="v2-stake-cell-val is-up">{signedTon(staking.earnedTon, 3)}</strong>
            <span className="v2-stake-cell-sub is-up">{signedUsd(staking.earnedUsd)}</span>
          </div>
        )}
      </div>

      <RateSparkline points={staking.ratePoints} />

      <p className="v2-stake-note">
        Награда не приходит монетами — растёт курс tsTON→GRAM. Твои{" "}
        {staking.tstonBalance.toFixed(2)} tsTON представляют всё больше GRAM каждый
        цикл (~18ч). Забираешь при выводе.
      </p>
    </div>
  );
}
