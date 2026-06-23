import { useState, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_PHASE = 9;
const BUYING_WINDOW = { from: "10 окт 2026", to: "15 дек 2026", daysLeft: 115 };

// Chart SVG geometry — tall chart, full width
const VW = 960, VH = 360;
const ML = 48, MR = 14, MT = 20, MB = 44;
const CW = VW - ML - MR;
const CH = VH - MT - MB;

// Time bounds
const T_START = new Date("2022-11-09").getTime();
const T_END   = new Date("2028-09-01").getTime();
const T_SPAN  = T_END - T_START;

// Price bounds (y-axis)
const P_MIN = 8_000;
const P_MAX = 150_000;

function tx(ts: number)     { return ML + ((ts - T_START) / T_SPAN) * CW; }
function ty(price: number)  { return MT + CH - ((price - P_MIN) / (P_MAX - P_MIN)) * CH; }

// ─── Russian month abbreviations ──────────────────────────────────────────────

const MON_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

// ─── Phase definitions ────────────────────────────────────────────────────────

type Zone = "fear" | "rise" | "peak" | "decline" | "new";

interface Phase {
  n: number; label: string; sub: string;
  ts: number; price: number;
  zone: Zone; projected: boolean;
  labelAbove: boolean;
}

const d = (s: string) => new Date(s).getTime();

const PHASES: Phase[] = [
  { n:1,  label:"Отрицание",    sub:"это не падение",    ts:d("2023-01-16"), price:21000,  zone:"fear",    projected:false, labelAbove:false },
  { n:2,  label:"Надежда",      sub:"отскок возможен",   ts:d("2023-04-17"), price:30000,  zone:"fear",    projected:false, labelAbove:false },
  { n:3,  label:"Оптимизм",     sub:"рынок оживает",     ts:d("2023-10-16"), price:28000,  zone:"rise",    projected:false, labelAbove:false },
  { n:4,  label:"Вера",         sub:"можно набирать",    ts:d("2024-02-12"), price:50000,  zone:"rise",    projected:false, labelAbove:false },
  { n:5,  label:"Возбуждение",  sub:"все покупают",      ts:d("2024-08-19"), price:61000,  zone:"rise",    projected:false, labelAbove:false },
  { n:6,  label:"Эйфория",      sub:"мы гении",          ts:d("2024-12-02"), price:104000, zone:"peak",    projected:false, labelAbove:true  },
  { n:7,  label:"Уступчивость", sub:"подождём",          ts:d("2025-03-17"), price:84000,  zone:"decline", projected:false, labelAbove:true  },
  { n:8,  label:"Тревога",      sub:"что-то не так",     ts:d("2025-07-07"), price:67000,  zone:"decline", projected:false, labelAbove:true  },
  { n:9,  label:"Отрицание",    sub:"не может быть",     ts:d("2026-01-12"), price:52000,  zone:"decline", projected:true,  labelAbove:true  },
  { n:10, label:"Паника",       sub:"все продают",       ts:d("2026-08-01"), price:38000,  zone:"decline", projected:true,  labelAbove:false },
  { n:11, label:"Капитуляция",  sub:"продаю всё",        ts:d("2027-01-01"), price:28000,  zone:"decline", projected:true,  labelAbove:false },
  { n:12, label:"Гнев",         sub:"кто виноват",       ts:d("2027-05-01"), price:33000,  zone:"new",     projected:true,  labelAbove:true  },
  { n:13, label:"Депрессия",    sub:"рынок умер",        ts:d("2027-10-01"), price:38000,  zone:"new",     projected:true,  labelAbove:true  },
  { n:14, label:"Новая надежда",sub:"возможен разворот", ts:d("2028-04-01"), price:50000,  zone:"new",     projected:true,  labelAbove:true  },
];

// ─── Zone visual config ───────────────────────────────────────────────────────

const ZC: Record<Zone, { bg: string; dot: string; text: string }> = {
  fear:    { bg:"rgba(45,120,220,0.07)",  dot:"rgba(86,200,245,0.95)",  text:"rgba(86,200,245,0.8)"  },
  rise:    { bg:"rgba(52,211,153,0.06)",  dot:"rgba(52,220,160,0.95)",  text:"rgba(52,220,160,0.8)"  },
  peak:    { bg:"rgba(245,172,20,0.09)",  dot:"rgba(245,185,20,1.0)",   text:"rgba(245,185,20,0.9)"  },
  decline: { bg:"rgba(235,90,65,0.06)",   dot:"rgba(240,110,85,0.95)",  text:"rgba(240,110,85,0.8)"  },
  new:     { bg:"rgba(140,90,240,0.06)",  dot:"rgba(160,120,255,0.95)", text:"rgba(160,120,255,0.8)" },
};

const ZONE_SPANS: { zone: Zone; from: string; to: string; label: string }[] = [
  { zone:"fear",    from:"2022-12-26", to:"2023-09-01", label:"СТРАХ"       },
  { zone:"rise",    from:"2023-09-01", to:"2024-11-01", label:"РОСТ"        },
  { zone:"peak",    from:"2024-11-01", to:"2025-02-15", label:"ЭЙФОРИЯ"     },
  { zone:"decline", from:"2025-02-15", to:"2027-03-01", label:"СТРАХ"       },
  { zone:"new",     from:"2027-03-01", to:"2028-09-01", label:"ВОЗРОЖДЕНИЕ" },
];

// Price levels for horizontal grid lines
const PRICE_GRID = [20000, 40000, 60000, 80000, 100000, 120000, 140000];

// Build quarterly X-axis ticks: every 3 months from 2023-Q1 to 2028-Q3
function buildDateTicks() {
  const ticks: { ts: number; label: string; isYear: boolean }[] = [];
  for (let yr = 2023; yr <= 2028; yr++) {
    for (let mo = 0; mo < 12; mo += 3) {
      const dt = new Date(yr, mo, 1);
      const ts = dt.getTime();
      if (ts < T_START || ts > T_END) continue;
      const isYear = mo === 0;
      ticks.push({
        ts,
        label: isYear ? `${MON_RU[mo]} ${yr}` : `${MON_RU[mo]} '${String(yr).slice(2)}`,
        isYear,
      });
    }
  }
  return ticks;
}

const DATE_TICKS = buildDateTicks();

// ─── BTC chart component ──────────────────────────────────────────────────────

type KlineRaw = [number, string, string, string, string, ...unknown[]];
interface BtcPoint { ts: number; close: number }

function getFearGreedLabel(value: number) {
  if (value <= 24) return "Экстремальный страх";
  if (value <= 44) return "Страх";
  if (value <= 54) return "Нейтрально";
  if (value <= 74) return "Жадность";
  return "Крайняя жадность";
}

function BtcChart({ data }: { data: BtcPoint[] }) {
  const cur = PHASES[CURRENT_PHASE - 1];

  const hist = data.filter(p => p.ts >= T_START && p.ts <= cur.ts + 7 * 24 * 3600 * 1000);

  let linePath = "";
  let areaPath = "";
  if (hist.length > 0) {
    const pts = hist.map(p => ({ x: tx(p.ts), y: ty(p.close) }));
    linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    areaPath = `${linePath} L${pts[pts.length-1].x.toFixed(1)},${(MT+CH).toFixed(1)} L${pts[0].x.toFixed(1)},${(MT+CH).toFixed(1)} Z`;
  }

  const futPts = PHASES.filter(p => p.n >= CURRENT_PHASE).map(p => ({ x: tx(p.ts), y: ty(p.price) }));
  const projPath = futPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // "now" line at current phase timestamp
  const nowX = tx(PHASES[CURRENT_PHASE - 1].ts);

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="v2-mp-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="btcLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(86,200,245,0.9)" />
          <stop offset="35%"  stopColor="rgba(52,220,160,0.9)" />
          <stop offset="52%"  stopColor="rgba(245,185,20,0.95)" />
          <stop offset="68%"  stopColor="rgba(240,110,85,0.9)" />
          <stop offset="100%" stopColor="rgba(160,120,255,0.8)" />
        </linearGradient>
        <linearGradient id="btcArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(50,130,200,0.18)" />
          <stop offset="100%" stopColor="rgba(50,130,200,0.0)" />
        </linearGradient>
        <filter id="fGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <filter id="fMild" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>

      {/* ── Zone backgrounds ── */}
      {ZONE_SPANS.map(z => {
        const x1 = tx(new Date(z.from).getTime());
        const x2 = tx(new Date(z.to).getTime());
        const mid = (x1 + x2) / 2;
        return (
          <g key={z.zone}>
            <rect x={x1} y={MT} width={x2-x1} height={CH} fill={ZC[z.zone].bg} />
            <text x={mid} y={MT + CH - 8} textAnchor="middle" fontSize="8.5"
              fill={ZC[z.zone].text} fontFamily="Inter,sans-serif"
              fontWeight="700" letterSpacing="0.1em" opacity="0.55">
              {z.label}
            </text>
          </g>
        );
      })}

      {/* ── Price grid + left axis labels ── */}
      {PRICE_GRID.map(p => {
        const y = ty(p);
        if (y < MT - 2 || y > MT + CH + 2) return null;
        return (
          <g key={p}>
            <line x1={ML} y1={y} x2={VW-MR} y2={y}
              stroke="rgba(50,90,160,0.11)" strokeWidth="0.8" strokeDasharray="3 7" />
            <text x={ML-5} y={y+3.5} textAnchor="end" fontSize="8.5"
              fill="rgba(110,155,210,0.55)" fontFamily="Inter,sans-serif" fontWeight="500">
              {p >= 1000 ? `${p/1000}K` : p}
            </text>
          </g>
        );
      })}

      {/* ── Date / X-axis ticks ── */}
      {DATE_TICKS.map(tick => {
        const x = tx(tick.ts);
        return (
          <g key={tick.ts}>
            <line x1={x} y1={MT} x2={x} y2={MT+CH}
              stroke={tick.isYear ? "rgba(50,90,160,0.18)" : "rgba(50,90,160,0.07)"}
              strokeWidth={tick.isYear ? 1 : 0.6} />
            <line x1={x} y1={MT+CH} x2={x} y2={MT+CH+5}
              stroke="rgba(80,120,200,0.3)" strokeWidth="1" />
            <text x={x} y={MT+CH+18} textAnchor="middle"
              fontSize={tick.isYear ? "9" : "8"} fontWeight={tick.isYear ? "700" : "400"}
              fill={tick.isYear ? "rgba(140,185,220,0.75)" : "rgba(110,155,190,0.45)"}
              fontFamily="Inter,sans-serif">
              {tick.label}
            </text>
          </g>
        );
      })}

      {/* ── BTC area fill ── */}
      {areaPath && <path d={areaPath} fill="url(#btcArea)" />}

      {/* ── BTC historical price line ── */}
      {linePath && (
        <path d={linePath} fill="none" stroke="url(#btcLine)"
          strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* ── "Сейчас" vertical marker ── */}
      <line x1={nowX} y1={MT} x2={nowX} y2={MT+CH}
        stroke="rgba(245,158,11,0.2)" strokeWidth="1.2" strokeDasharray="4 4" />
      <text x={nowX+4} y={MT+12} fontSize="8" fill="rgba(245,158,11,0.55)"
        fontFamily="Inter,sans-serif" fontWeight="600" letterSpacing="0.06em">
        СЕЙЧАС
      </text>

      {/* ── Projected dashed line ── */}
      <path d={projPath} fill="none" stroke="rgba(200,160,100,0.35)"
        strokeWidth="1.8" strokeDasharray="6 4" strokeLinejoin="round" />

      {/* ── Phase markers ── */}
      {PHASES.map(p => {
        const x = tx(p.ts);
        const y = ty(p.price);
        const isCur = p.n === CURRENT_PHASE;
        const col = ZC[p.zone].dot;
        const txtCol = ZC[p.zone].text;
        const above = p.labelAbove;

        const circleY = above ? y - 18 : y + 18;
        const labelY  = above ? y - 30 : y + 33;

        return (
          <g key={p.n}>
            {isCur && (
              <>
                <circle cx={x} cy={y} r="20" fill="rgba(245,158,11,0.04)" filter="url(#fGlow)"/>
                <circle cx={x} cy={y} r="11" fill="rgba(245,158,11,0.07)"/>
              </>
            )}

            <circle cx={x} cy={y}
              r={isCur ? 5.5 : p.projected ? 2.5 : 3.5}
              fill={isCur ? "rgba(245,158,11,1)" : p.projected ? col.replace("0.95","0.4").replace("1.0","0.4") : col}
              filter={isCur ? "url(#fGlow)" : p.projected ? undefined : "url(#fMild)"}
              className={isCur ? "v2-mp-cur-dot" : undefined}
            />

            <line x1={x} y1={above ? y-6 : y+6} x2={x} y2={above ? y-12 : y+12}
              stroke={isCur ? "rgba(245,158,11,0.5)" : col.replace("0.95","0.28").replace("1.0","0.28")}
              strokeWidth="0.8"
            />

            <circle cx={x} cy={circleY} r="9"
              fill={isCur ? "rgba(245,158,11,0.14)" : p.projected ? "rgba(4,10,22,0.7)" : "rgba(4,10,22,0.82)"}
              stroke={isCur ? "rgba(245,158,11,0.8)" : p.projected ? col.replace("0.95","0.22").replace("1.0","0.22") : col.replace("0.95","0.5").replace("1.0","0.5")}
              strokeWidth={isCur ? 1.3 : 0.8}
            />
            <text x={x} y={circleY+3.5} textAnchor="middle" fontSize="7.5"
              fill={isCur ? "rgba(245,158,11,1)" : p.projected ? txtCol.replace("0.8","0.38") : txtCol}
              fontFamily="Inter,sans-serif" fontWeight="700">
              {p.n}
            </text>

            <text x={x} y={labelY} textAnchor="middle" fontSize="7.5"
              fill={isCur ? "rgba(245,158,11,0.95)" : p.projected ? txtCol.replace("0.8","0.32") : txtCol.replace("0.8","0.7")}
              fontFamily="Inter,sans-serif" fontWeight={isCur ? "700" : "600"}>
              {p.label}
            </text>

            {isCur && (
              <text x={x} y={labelY + 11} textAnchor="middle" fontSize="6.5"
                fill="rgba(245,158,11,0.5)" fontFamily="Inter,sans-serif">
                {p.sub}
              </text>
            )}
          </g>
        );
      })}

      {/* ── Axes borders ── */}
      <line x1={ML} y1={MT} x2={ML} y2={MT+CH}
        stroke="rgba(60,110,190,0.2)" strokeWidth="1" />
      <line x1={ML} y1={MT+CH} x2={VW-MR} y2={MT+CH}
        stroke="rgba(60,110,190,0.2)" strokeWidth="1" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function V2MarketPsychology() {
  const [btcData, setBtcData] = useState<BtcPoint[]>([]);

  useEffect(() => {
    // Binance limit = 1000 bars per request.
    // Nov 9 2022 → today ≈ 1300+ days → need 2 pages.
    const fetchPage = async (startTime: number, accum: BtcPoint[]): Promise<BtcPoint[]> => {
      const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=${startTime}&limit=1000`;
      const raw: KlineRaw[] = await (await fetch(url)).json();
      if (raw.length === 0) return accum;
      const points = raw.map(k => ({ ts: k[0], close: parseFloat(k[4]) }));
      const all = [...accum, ...points];
      const lastTs = points[points.length - 1].ts;
      // If we got a full page and haven't reached today yet — fetch the next page
      if (raw.length === 1000 && lastTs < Date.now() - 86_400_000) {
        return fetchPage(lastTs + 86_400_000, all);
      }
      return all;
    };

    fetchPage(T_START, [])
      .then(data => setBtcData(data))
      .catch(() => {/* используем mock-кривую из фаз */});
  }, []);

  const cur = PHASES[CURRENT_PHASE - 1];

  return (
    <div className="v2-mp-card">

      {/* ── Шапка ── */}
      <div className="v2-mp-hdr">
        <div className="v2-mp-hdr-left">
          <span className="v2-mp-title-text">Эмоциональный цикл рынка</span>
        </div>
        <div className="v2-mp-hdr-right">
          <div className="v2-mp-phase-badge">
            <span className="v2-mp-phase-n">{CURRENT_PHASE}</span>
            <span className="v2-mp-phase-name">{cur.label.toUpperCase()}</span>
            <span className="v2-mp-phase-sub">{cur.sub}</span>
          </div>
          <div className="v2-mp-win-chip">
            <span className="v2-mp-win-label">Окно покупок через</span>
            <span className="v2-mp-win-days">{BUYING_WINDOW.daysLeft} дн.</span>
          </div>
        </div>
      </div>

      {/* ── График — на всю ширину, высокий ── */}
      <div className="v2-mp-chart-full">
        <BtcChart data={btcData} />
      </div>

    </div>
  );
}

// ─── Analysis panel: renders below BTC chart (used in V2Shell) ────────────────

export function V2MpAnalysis({ currentFearGreed }: { currentFearGreed: number }) {
  const fgValue = String(Math.round(currentFearGreed));
  const fgLabel = getFearGreedLabel(currentFearGreed);

  const WHY = [
    "Цена ниже от пика ~42%",
    `Страх и жадность: ${fgValue} (${fgLabel})`,
    "Отскоки слабые, структура не сломана",
    "Капитуляции ещё не было",
  ];

  const ACTIONS = [
    { text: "Не действуем эмоциями" },
    { text: "Сохраняем резерв" },
    { text: "Ждём подтверждений" },
  ];

  return (
    <div className="v2-mp-bottom-row">
      <div className="v2-mp-why-col">
        <div className="v2-mp-panel-label">Почему так</div>
        <ul className="v2-mp-bullets">
          {WHY.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </div>
      <div className="v2-mp-actions-col">
        <div className="v2-mp-panel-label">Зона действий</div>
        {ACTIONS.map((a, i) => (
          <div key={i} className="v2-mp-action">
            <span className="v2-mp-action-dot" />
            <span className="v2-mp-action-text">{a.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
