import type { CosmosStaking } from "../../hooks/useCosmosStaking";
import { CryptoLogo } from "../../components/crypto/CryptoLogo";

const money = (v: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

const atom = (v: number, digits = 4) =>
  `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v)} ATOM`;

const signedAtom = (v: number, digits = 4) =>
  `${v >= 0 ? "+" : "−"}${atom(Math.abs(v), digits)}`;
const signedUsd = (v: number) => `${v >= 0 ? "+" : "−"}${money(Math.abs(v))}`;

// Проекция накопления награды за 30 дней (линейно по суточному начислению).
function AccrualSparkline({ dailyAtom, atomPrice }: { dailyAtom: number; atomPrice: number }) {
  if (dailyAtom <= 0) return null;
  const DAYS = 30;
  const W = 620;
  const H = 130;
  const padX = 6;
  const padTop = 10;
  const padBot = 18;

  const pts = Array.from({ length: DAYS + 1 }, (_, i) => ({ day: i, val: dailyAtom * i }));
  const max = pts[pts.length - 1].val || 1;
  const X = (day: number) => padX + (day / DAYS) * (W - padX * 2);
  const Y = (val: number) => padTop + (1 - val / max) * (H - padTop - padBot);
  const coords = pts.map((p) => ({ x: X(p.day), y: Y(p.val) }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${H - padBot} L ${coords[0].x.toFixed(1)} ${H - padBot} Z`;
  const last = coords[coords.length - 1];
  const total30 = pts[pts.length - 1].val;

  return (
    <div className="v2-stake-chart">
      <div className="v2-stake-chart-head">
        <span className="v2-stake-chart-title">Накопление награды · проекция 30 дней</span>
        <span className="v2-stake-chart-range">
          +{atom(total30, 3)} (~{money(total30 * atomPrice)})
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="v2-stake-chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cosmos-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(90,240,141,0.3)" />
            <stop offset="100%" stopColor="rgba(90,240,141,0)" />
          </linearGradient>
          <filter id="cosmos-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 0.5, 1].map((g) => {
          const y = padTop + g * (H - padTop - padBot);
          return <line key={g} x1={padX} y1={y} x2={W - padX} y2={y} stroke="rgba(90,240,141,0.08)" strokeWidth="1" strokeDasharray="3 4" />;
        })}
        <path d={area} fill="url(#cosmos-area)" />
        <path d={line} fill="none" stroke="rgba(90,240,141,0.95)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" filter="url(#cosmos-glow)" />
        <circle cx={last.x} cy={last.y} r="8" fill="rgba(90,240,141,0.16)" />
        <circle cx={last.x} cy={last.y} r="4" fill="#5af08d" filter="url(#cosmos-glow)" />
      </svg>
      <div className="v2-stake-chart-axis">
        <span>сегодня</span>
        <span>+30 дней</span>
      </div>
    </div>
  );
}

export function V2CosmosStakingCard({ staking }: { staking: CosmosStaking }) {
  return (
    <div className="v2-stake-card">
      <div className="v2-stake-head">
        <CryptoLogo asset="ATOM" className="v2-stake-logo" />
        <div className="v2-stake-title">
          <span className="v2-stake-name">Стейкинг · ATOM</span>
          <span className="v2-stake-sub">Cosmos Hub · {staking.validatorName}</span>
        </div>
        <span className="v2-stake-apy">{(staking.apr * 100).toFixed(2)}% APR</span>
      </div>

      {/* Ежедневное начисление */}
      <div className="v2-stake-today">
        <span className="v2-stake-today-label">Начисление в сутки</span>
        <strong className="v2-stake-today-val is-up">{signedUsd(staking.dailyUsd)}</strong>
        <span className="v2-stake-today-ton is-up">{signedAtom(staking.dailyAtom)}</span>
      </div>

      {/* Награда к клейму (вместо таймера цикла) */}
      <div className="v2-stake-timer">
        <span className="v2-stake-timer-label">Награда к клейму</span>
        <span className="v2-stake-timer-val is-up">{atom(staking.claimable, 4)}</span>
      </div>

      <div className="v2-stake-grid">
        <div className="v2-stake-cell">
          <span className="v2-stake-cell-label">В стейке</span>
          <strong className="v2-stake-cell-val">{atom(staking.staked, 2)}</strong>
          <span className="v2-stake-cell-sub">{money(staking.stakedUsd)}</span>
        </div>
        <div className="v2-stake-cell">
          <span className="v2-stake-cell-label">Валидатор</span>
          <strong className="v2-stake-cell-val">{staking.validatorName}</strong>
          <span className="v2-stake-cell-sub">комиссия {(staking.commission * 100).toFixed(0)}%</span>
        </div>
        <div className="v2-stake-cell">
          <span className="v2-stake-cell-label">К клейму</span>
          <strong className="v2-stake-cell-val is-up">{signedAtom(staking.claimable, 4)}</strong>
          <span className="v2-stake-cell-sub is-up">{signedUsd(staking.claimableUsd)}</span>
        </div>
      </div>

      <AccrualSparkline dailyAtom={staking.dailyAtom} atomPrice={staking.atomPrice} />

      <p className="v2-stake-note">
        Нативный стейкинг Cosmos Hub. {atom(staking.staked, 2)} делегированы валидатору{" "}
        {staking.validatorName}. Награда капает непрерывно (~{atom(staking.dailyAtom, 4)}/сутки) и
        забирается кнопкой Claim. Начисление — за вычетом комиссии {(staking.commission * 100).toFixed(0)}%.
      </p>
    </div>
  );
}
