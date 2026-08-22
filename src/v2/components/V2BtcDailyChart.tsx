import { useState, useEffect } from "react";

interface Bar { ts: number; open: number; high: number; low: number; close: number }

// ─── Phase definitions ────────────────────────────────────────────────────────

type PhaseZone = "fear" | "rise" | "peak" | "panic" | "revival" | "proj";

interface CyclePhase {
  n: number; label: string;
  ts: number; price: number | null;
  above: boolean;
  zone: PhaseZone; projected: boolean;
}

const d = (s: string) => new Date(s).getTime();

const CYCLE_PHASES: CyclePhase[] = [
  { n:1,  label:"Отрицание",    ts:d("2023-01-16"), price:null,  above:true,  zone:"fear",   projected:false },
  { n:2,  label:"Надежда",      ts:d("2023-04-17"), price:null,  above:true,  zone:"fear",   projected:false },
  { n:3,  label:"Оптимизм",     ts:d("2023-10-18"), price:null,  above:true,  zone:"rise",   projected:false },
  { n:4,  label:"Вера",         ts:d("2024-03-14"), price:null,  above:true,  zone:"rise",   projected:false },
  { n:5,  label:"Возбуждение",  ts:d("2025-01-20"), price:null,  above:true,  zone:"rise",   projected:false },
  { n:6,  label:"Эйфория",      ts:d("2025-10-15"), price:null,  above:true,  zone:"peak",   projected:false },
  { n:7,  label:"Уступчивость", ts:d("2025-10-20"), price:null,  above:false, zone:"panic",  projected:false },
  { n:8,  label:"Тревога",      ts:d("2026-01-10"), price:null,  above:false, zone:"panic",  projected:false },
  { n:9,  label:"Отрицание",    ts:d("2026-08-01"), price:50000, above:false, zone:"proj",   projected:true  },
  { n:10, label:"Паника",       ts:d("2026-10-01"), price:36000, above:false, zone:"proj",   projected:true  },
  { n:11, label:"Капитуляция",  ts:d("2026-11-15"), price:22000, above:false, zone:"proj",   projected:true  },
  { n:12, label:"Гнев",         ts:d("2027-02-01"), price:26000, above:true,  zone:"proj",   projected:true  },
  { n:13, label:"Депрессия",    ts:d("2027-06-01"), price:31000, above:true,  zone:"proj",   projected:true  },
  { n:14, label:"Новая надежда",ts:d("2027-12-01"), price:48000, above:true,  zone:"revival",projected:true  },
];

const PHASE_DESC: Record<number, { what: string; action: string }> = {
  1:  { what: "Рынок восстанавливается после дна. Большинство ещё в отрицании.",  action: "Мониторинг. Осторожное накопление малыми порциями." },
  2:  { what: "Появляется надежда. Первые признаки восходящего тренда.",          action: "Начинать первые позиции." },
  3:  { what: "Оптимизм нарастает. Умные деньги уже в рынке.",                    action: "Удерживать позиции. Добавлять на откатах." },
  4:  { what: "Сильная вера в рост. Рынок стабильно растёт.",                     action: "Держать. Ребалансировать резерв." },
  5:  { what: "Возбуждение. Розничные инвесторы входят массово.",                 action: "Начать частичную фиксацию прибыли." },
  6:  { what: "Эйфория. Все уверены в росте. Исторический пик рядом.",            action: "Фиксировать позиции. Резерв в максимуме." },
  7:  { what: "Первая коррекция игнорируется большинством. Уступчивость рынка.",  action: "Снизить экспозицию. Защитить резерв." },
  8:  { what: "Тревога нарастает. Падение ускоряется. Рынок давит на психику.",   action: "Не паниковать. Держать резерв для окна покупок Q4 2026." },
  9:  { what: "Отрицание дна. Все ждут разворота — его ещё нет.",                 action: "Первые покупки малыми порциями, осторожно." },
  10: { what: "Паника. Массовые продажи по любым ценам. Рынок в ужасе.",          action: "Агрессивное накопление. Это окно покупок." },
  11: { what: "Капитуляция. Дно. Последние продавцы сдаются.",                    action: "Максимальное накопление. Это цель всей стратегии." },
  12: { what: "Гнев. Рынок немного восстановился, но никто не верит.",            action: "Держать позиции. Не продавать." },
  13: { what: "Депрессия. Боковое движение. Рынок устал.",                        action: "Терпеливо держать позиции." },
  14: { what: "Новая надежда. Первые признаки нового цикла роста.",               action: "Начать добавлять позиции." },
};

const BG_ZONES = [
  { from:"2022-11-15", to:"2023-09-01", label:"СТРАХ",       bg:"rgba(220,50,50,0.07)",   text:"rgba(235,80,80,0.90)",   color:"rgba(235,80,80,1)"    },
  { from:"2023-09-01", to:"2024-11-01", label:"РОСТ",        bg:"rgba(100,210,100,0.06)", text:"rgba(130,225,130,0.90)", color:"rgba(130,225,130,1)"  },
  { from:"2024-11-01", to:"2025-10-15", label:"ЭЙФОРИЯ",     bg:"rgba(40,220,40,0.08)",   text:"rgba(60,240,60,0.95)",   color:"rgba(60,240,60,1)"    },
  { from:"2025-10-15", to:"2027-02-01", label:"СТРАХ",       bg:"rgba(220,50,50,0.07)",   text:"rgba(235,80,80,0.90)",   color:"rgba(235,80,80,1)"    },
  { from:"2027-02-01", to:"2028-06-01", label:"ВОЗРОЖДЕНИЕ", bg:"rgba(240,90,170,0.06)",  text:"rgba(245,110,185,0.90)", color:"rgba(245,110,185,1)"  },
];

const ZONE_DOT: Record<PhaseZone, string> = {
  fear:    "rgba(86,200,245,0.95)",
  rise:    "rgba(52,220,160,0.95)",
  peak:    "rgba(245,185,20,1.0)",
  panic:   "rgba(240,110,85,0.95)",
  revival: "rgba(52,220,160,0.85)",
  proj:    "rgba(160,130,220,0.7)",
};

const ZONE_FILL: Record<PhaseZone, string> = {
  fear:    "rgba(86,200,245,0.16)",
  rise:    "rgba(52,220,160,0.16)",
  peak:    "rgba(245,185,20,0.16)",
  panic:   "rgba(240,110,85,0.20)",
  revival: "rgba(52,220,160,0.16)",
  proj:    "rgba(160,130,220,0.16)",
};

// ─── SVG constants ────────────────────────────────────────────────────────────

const CHART_START = new Date("2022-11-15").getTime();
const T_END_FIXED = d("2028-06-01");
const BUY_WIN_FROM = d("2026-10-10");
const BUY_WIN_TO   = d("2026-12-15");

// Следующий халвинг ~19 апр 2028, окно 500 дней = с ~5 ноя 2026
const HALVING_DATE   = d("2028-04-19");
const HALVING_500_FROM = d("2026-11-05");

const VW = 1400, VH = 520;
const ML = 12, MR = 66, MT = 34, MB = 36;
const CW = VW - ML - MR;
const CH = VH - MT - MB;

const MONTHS_RU = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];

function makeTx(tSpan: number) {
  return (ts: number) => ML + ((ts - CHART_START) / tSpan) * CW;
}
function makeTy(pMin: number, pMax: number) {
  return (price: number) => MT + CH - ((price - pMin) / (pMax - pMin)) * CH;
}

function priceExtreme(bars: Bar[], targetTs: number, useHigh: boolean): number {
  let best = bars[0];
  for (const b of bars) {
    if (Math.abs(b.ts - targetTs) < Math.abs(best.ts - targetTs)) best = b;
  }
  return useHigh ? best.high : best.low;
}

function isBar(value: unknown): value is Bar {
  if (!value || typeof value !== "object") return false;
  const bar = value as Partial<Bar>;
  return Number.isFinite(bar.ts)
    && Number.isFinite(bar.open)
    && Number.isFinite(bar.high)
    && Number.isFinite(bar.low)
    && Number.isFinite(bar.close);
}

async function fetchAllBars(): Promise<Bar[]> {
  const response = await fetch("/api/btc-daily", { cache: "no-store" });
  if (!response.ok) throw new Error(`BTC daily API failed: ${response.status}`);

  const json = await response.json() as { success?: unknown; bars?: unknown };
  if (!json.success || !Array.isArray(json.bars)) {
    throw new Error("BTC daily API returned invalid payload");
  }

  return json.bars.filter(isBar);
}

function getFearGreedLabel(v: number) {
  if (v <= 24) return "Экстремальный страх";
  if (v <= 44) return "Страх";
  if (v <= 54) return "Нейтрально";
  if (v <= 74) return "Жадность";
  return "Крайняя жадность";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function V2BtcDailyChart({ currentFearGreed }: { currentFearGreed?: number }) {
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // График на весь экран (на мобиле — с поворотом в горизонталь)
  const [chartFull, setChartFull] = useState(false);
  // Узкий экран: свёрнутый график заполняет контейнер целиком
  // (preserveAspectRatio="none") — без пустот сверху и снизу.
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    fetchAllBars()
      .then(data => { setBars(data); setLoadError(""); setLoading(false); })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "BTC chart load failed");
        setLoading(false);
      });
  }, []);

  // Date.now() один раз на маунт через ленивый useState — чистый render.
  const [NOW_TS] = useState(() => Date.now());

  const currentZone = BG_ZONES.find(z =>
    NOW_TS >= new Date(z.from).getTime() && NOW_TS < new Date(z.to).getTime()
  ) ?? BG_ZONES[3];

  const passedPhases = CYCLE_PHASES.filter(ph => ph.ts <= NOW_TS);
  const currentCyclePhase = passedPhases[passedPhases.length - 1] ?? CYCLE_PHASES[0];
  const nextPhase = CYCLE_PHASES.find(ph => ph.ts > NOW_TS);
  const phaseDesc = PHASE_DESC[currentCyclePhase.n];
  const daysToWindow = Math.max(0, Math.round((BUY_WIN_FROM - NOW_TS) / 86_400_000));

  const fgVal = currentFearGreed != null ? Math.round(currentFearGreed) : null;
  const fgLabel = fgVal != null ? getFearGreedLabel(fgVal) : null;
  const liveGreedOverride = fgVal != null && fgVal >= 50;
  const strategyAction = liveGreedOverride
    ? "Live-индекс в жадности: сценарий наблюдаем, покупку не ускоряем. Резерв держим до зоны страха."
    : phaseDesc?.action;

  if (loading) return (
    <div className="v2-btc-card">
      <div className="v2-btc-header"><span className="v2-btc-title">BTC / USDT · Дневной</span></div>
      <div className="v2-btc-loading">Загрузка графика…</div>
    </div>
  );
  if (bars.length === 0) return (
    <div className="v2-btc-card">
      <div className="v2-btc-header"><span className="v2-btc-title">BTC / USDT · Дневной</span></div>
      <div className="v2-btc-loading">
        {loadError ? `График временно недоступен: ${loadError}` : "Нет данных графика"}
      </div>
    </div>
  );

  const lastBarTs = bars[bars.length - 1].ts;
  const T_SPAN = T_END_FIXED - CHART_START;
  const tx = makeTx(T_SPAN);

  const projPrices = CYCLE_PHASES.filter(p => p.projected && p.price).map(p => p.price as number);
  const pHigh = Math.max(...bars.map(b => b.high));
  const pLow  = Math.min(...bars.map(b => b.low), ...projPrices);
  const pRange = pHigh - pLow;
  const P_MAX = pHigh + pRange * 0.12;
  const P_MIN = Math.max(0, pLow - pRange * 0.04);
  const ty = makeTy(P_MIN, P_MAX);

  const barW = Math.max(0.7, (CW / bars.length) * 0.65);

  const step = P_MAX > 100_000 ? 20_000 : 10_000;
  const priceGrid: number[] = [];
  for (let p = Math.ceil(P_MIN / step) * step; p <= P_MAX; p += step) priceGrid.push(p);

  const dateTicks: { ts: number; label: string; isJan: boolean }[] = [];
  for (let yr = 2022; yr <= 2029; yr++) {
    for (let mo = 0; mo < 12; mo++) {
      const ts = new Date(yr, mo, 1).getTime();
      if (ts < CHART_START - 86_400_000 * 20 || ts > T_END_FIXED) continue;
      dateTicks.push({ ts, label: mo === 0 ? String(yr) : MONTHS_RU[mo], isJan: mo === 0 });
    }
  }

  const rW: string[] = [], gW: string[] = [], rB: string[] = [], gB: string[] = [];
  bars.forEach(bar => {
    const x = tx(bar.ts + 43_200_000);
    const yH = ty(bar.high), yL = ty(bar.low);
    const yO = ty(bar.open), yC = ty(bar.close);
    const bull = bar.close >= bar.open;
    const bTop = Math.min(yO, yC);
    const bH = Math.max(0.7, Math.abs(yC - yO));
    const hw = barW / 2;
    const wick = `M${x.toFixed(1)},${yH.toFixed(1)} L${x.toFixed(1)},${yL.toFixed(1)}`;
    const body = `M${(x-hw).toFixed(1)},${bTop.toFixed(1)} h${barW.toFixed(1)} v${bH.toFixed(1)} h${(-barW).toFixed(1)} Z`;
    if (bull) { gW.push(wick); gB.push(body); } else { rW.push(wick); rB.push(body); }
  });

  const athBar = bars.reduce((max, b) => b.high > max.high ? b : max, bars[0]);

  const p7from = athBar.ts + 15 * 86_400_000;
  const p7to   = athBar.ts + 75 * 86_400_000;
  const p7bars = bars.filter(b => b.ts >= p7from && b.ts <= p7to);
  const phase7Bar = p7bars.length > 0
    ? p7bars.reduce((min, b) => b.low < min.low ? b : min, p7bars[0])
    : athBar;

  const p8from = athBar.ts + 75 * 86_400_000;
  const p8to   = athBar.ts + 240 * 86_400_000;
  const p8bars = bars.filter(b => b.ts >= p8from && b.ts <= p8to);
  const phase8Bar = p8bars.length > 0
    ? p8bars.reduce((min, b) => b.low < min.low ? b : min, p8bars[0])
    : phase7Bar;

  const phases = CYCLE_PHASES.map(ph => {
    if (ph.n === 6 && ph.price === null) {
      return { ...ph, resolvedTs: athBar.ts,    resolvedPrice: athBar.high    };
    }
    if (ph.n === 7 && ph.price === null) {
      return { ...ph, resolvedTs: phase7Bar.ts, resolvedPrice: phase7Bar.low  };
    }
    if (ph.n === 8 && ph.price === null) {
      return { ...ph, resolvedTs: phase8Bar.ts, resolvedPrice: phase8Bar.low  };
    }
    return {
      ...ph,
      resolvedTs: ph.ts,
      resolvedPrice: ph.price !== null ? ph.price : priceExtreme(bars, ph.ts, ph.above),
    };
  });

  const declinePts = phases.filter(p => p.n >= 6).map(p => ({
    x: tx(p.resolvedTs), y: ty(p.resolvedPrice),
  }));
  const declinePath = declinePts.map((pt, i) =>
    `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
  ).join(" ");

  const last = bars[bars.length - 1];
  const lastY   = ty(last.close);
  const lastBull = last.close >= last.open;
  const badgeFill = lastBull ? "rgba(30,170,95,0.9)" : "rgba(200,55,55,0.9)";
  const priceCol  = lastBull ? "rgba(38,200,118,0.95)" : "rgba(220,75,75,0.95)";
  const nowX = tx(lastBarTs + 43_200_000);

  const fmtPrice = (p: number) => p.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

  // Extract RGB from zone color for inline style construction
  const zoneColor = currentZone.color;
  const rgbMatch = zoneColor.match(/[\d.]+/g) ?? ["240","110","85","1"];
  const [zr, zg, zb] = rgbMatch;

  return (
    <div className="v2-btc-card">

      {/* ── Header ── */}
      <div className="v2-btc-header">
        <div className="v2-btc-header-left">
          <span className="v2-btc-title">BTC / USDT</span>
          <span className="v2-btc-sep">·</span>
          <span className="v2-btc-inline-price" style={{ color: priceCol }}>${fmtPrice(last.close)}</span>
          <span className={`v2-btc-trend-arrow ${lastBull ? "is-bull" : "is-bear"}`}>
            {lastBull ? "▲" : "▼"}
          </span>
        </div>
        <div className="v2-btc-header-right">
          <span className="v2-btc-live-dot" />
          <span className="v2-btc-live-label">ЖИВЫЕ</span>
          <span className="v2-btc-tf">Эмоциональный цикл · 2022–2028</span>
        </div>
      </div>

      {/* ── Current Phase Hero — 4-panel reference layout ── */}
      <div
        className="v2-btc-phase-hero"
        style={{
          borderColor: `rgba(${zr},${zg},${zb},0.28)`,
          background: `linear-gradient(180deg, rgba(2,7,18,0.94), rgba(1,4,13,0.92))`,
          backdropFilter: "blur(14px) saturate(1.3)",
          WebkitBackdropFilter: "blur(14px) saturate(1.3)",
          boxShadow: `0 0 36px -12px rgba(${zr},${zg},${zb},0.22), inset 0 0 40px -20px rgba(${zr},${zg},${zb},0.08)`,
        }}
      >
        {/* ── PANEL 1: Stage ── */}
        <div className="v2-bph-stage">
          <div className="v2-bph-meta-label">СТАДИЯ ЦИКЛА</div>
          <div className="v2-bph-stage-body">
            <span
              className="v2-bph-num"
              style={{
                color: zoneColor,
                borderColor: `rgba(${zr},${zg},${zb},0.50)`,
                boxShadow: `0 0 18px -4px rgba(${zr},${zg},${zb},0.55)`,
                background: `rgba(${zr},${zg},${zb},0.10)`,
              }}
            >
              {currentCyclePhase.n}
            </span>
            <span className="v2-bph-name" style={{ color: zoneColor }}>
              {currentCyclePhase.label.toUpperCase()}
            </span>
          </div>
          {nextPhase && (
            <div className="v2-bph-next">
              → следующая: <em>{nextPhase.label}</em>
            </div>
          )}
        </div>

        <div className="v2-bph-sep" style={{ background: `rgba(${zr},${zg},${zb},0.16)` }} />

        {/* ── PANEL 2: Why — 4 mini-cards ── */}
        <div className="v2-bph-why-panel">
          <div className="v2-bph-meta-label">ПОЧЕМУ ТАКАЯ СТАДИЯ?</div>
          <div className="v2-bph-mini-cards">

            {/* Card 1 — Price vs ATH */}
            <div className="v2-bph-mini-card">
              <svg className="v2-bph-mini-icon-svg" viewBox="0 0 28 28" fill="none">
                <path d="M3 8 L10 16 L15 11 L25 20" stroke={zoneColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 20 L25 20 L25 16" stroke={zoneColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="v2-bph-mini-title">Цена ниже ATH</div>
              <div className="v2-bph-mini-value" style={{ color: zoneColor }}>~42%</div>
            </div>

            {/* Card 2 — Fear & Greed */}
            <div className="v2-bph-mini-card">
              <svg className="v2-bph-mini-icon-svg" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="10.5" stroke={zoneColor} strokeWidth="2"/>
                <circle cx="10.5" cy="12.5" r="1.4" fill={zoneColor}/>
                <circle cx="17.5" cy="12.5" r="1.4" fill={zoneColor}/>
                <path d="M9.5 19.5 Q14 15.5 18.5 19.5" stroke={zoneColor} strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div className="v2-bph-mini-title">Страх и жадность</div>
              <div className="v2-bph-mini-value" style={{ color: zoneColor }}>{fgVal ?? "—"}</div>
              {fgLabel && <div className="v2-bph-mini-sub">{fgLabel}</div>}
            </div>

            {/* Card 3 — Bounces */}
            <div className="v2-bph-mini-card">
              <svg className="v2-bph-mini-icon-svg" viewBox="0 0 28 28" fill="none">
                <rect x="3"  y="17" width="5" height="8"  rx="1" fill="rgba(86,196,240,0.50)"/>
                <rect x="11" y="12" width="5" height="13" rx="1" fill="rgba(86,196,240,0.50)"/>
                <rect x="19" y="15" width="5" height="10" rx="1" fill="rgba(86,196,240,0.50)"/>
                <path d="M5.5 13 L14 7 L21.5 11" stroke="rgba(86,196,240,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2"/>
              </svg>
              <div className="v2-bph-mini-title">Отскоки слабые</div>
              <div className="v2-bph-mini-value">Структура</div>
              <div className="v2-bph-mini-sub">не сломана</div>
            </div>

            {/* Card 4 — Capitulation */}
            <div className="v2-bph-mini-card">
              <svg className="v2-bph-mini-icon-svg" viewBox="0 0 28 28" fill="none">
                <line x1="7" y1="3" x2="7" y2="26" stroke="rgba(86,196,240,0.70)" strokeWidth="2.2" strokeLinecap="round"/>
                <path d="M7 4 L23 9.5 L7 17.5 Z" fill="rgba(86,196,240,0.35)" stroke="rgba(86,196,240,0.60)" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              <div className="v2-bph-mini-title">Капитуляции</div>
              <div className="v2-bph-mini-value">ещё не было</div>
            </div>

          </div>
        </div>

        <div className="v2-bph-sep" style={{ background: `rgba(${zr},${zg},${zb},0.16)` }} />

        {/* ── PANEL 3: Zone ── */}
        <div className="v2-bph-zone-panel">
          <div className="v2-bph-meta-label">ТЕКУЩАЯ ЗОНА</div>
          <div className="v2-bph-zone-name-row">
            <div className="v2-bph-zone-accent" style={{ background: zoneColor }} />
            <div className="v2-bph-zone-name" style={{ color: zoneColor }}>
              {currentZone.label}
            </div>
          </div>
          <div
            className="v2-bph-why-zone-label"
            style={{ color: `rgba(${zr},${zg},${zb},0.72)` }}
          >
            ПОЧЕМУ {currentZone.label}?
          </div>
          {phaseDesc && (
            <div className="v2-bph-why-zone-text">{phaseDesc.what}</div>
          )}
          <div className="v2-bph-zone-deco" aria-hidden="true">☠</div>
        </div>

        <div className="v2-bph-sep" style={{ background: `rgba(${zr},${zg},${zb},0.16)` }} />

        {/* ── PANEL 4: Strategy ── */}
        <div className="v2-bph-strategy-panel">
          <div className="v2-bph-strategy-header">ПОКУПКИ ПО СТРАТЕГИИ</div>
          {strategyAction && (
            <div
              className="v2-bph-strategy-action"
              style={{ color: liveGreedOverride ? "rgba(90,239,141,0.90)" : `rgba(${zr},${zg},${zb},0.88)` }}
            >
              {strategyAction}
            </div>
          )}
          {daysToWindow > 0 && (
            <div className="v2-bph-countdown-big">
              <div className="v2-bph-cd-num">{daysToWindow}</div>
              <div className="v2-bph-cd-lbl">ДН. ДО ОКНА ПОКУПОК</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Chart SVG ── */}
      <div className={`v2-btc-chart-wrap${chartFull ? " is-fullscreen" : ""}`}>
        <button
          type="button"
          className="v2-btc-fs-btn"
          onClick={() => setChartFull((v) => !v)}
          aria-label={chartFull ? "Свернуть график" : "График на весь экран"}
        >
          {chartFull ? (
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M7 2v5H2M11 2v5h5M7 16v-5H2M11 16v-5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M2 7V2h5M16 7V2h-5M2 11v5h5M16 11v5h-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="v2-btc-svg"
          preserveAspectRatio={isNarrow && !chartFull ? "none" : "xMidYMid meet"}
        >
        <defs>
          <filter id="btcGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <filter id="btcGlowSoft" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="10" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <marker id="arrowCyan" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <polygon points="0,0 0,7 7,3.5" fill="rgba(56,189,248,0.55)" />
          </marker>
          <pattern id="scanlines" x="0" y="0" width="2" height="4" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2={VW} y2="0" stroke="rgba(0,180,255,0.018)" strokeWidth="1"/>
          </pattern>
        </defs>

        {/* Zone backgrounds */}
        {BG_ZONES.map(z => {
          const x1 = tx(new Date(z.from).getTime());
          const x2 = Math.min(tx(new Date(z.to).getTime()), VW - MR);
          const cx  = Math.max(x1, ML) + (Math.min(x2, VW - MR) - Math.max(x1, ML)) / 2;
          return (
            <g key={z.label + z.from}>
              <rect x={Math.max(x1, ML)} y={MT} width={Math.min(x2, VW-MR) - Math.max(x1, ML)} height={CH} fill={z.bg} />
              <text x={cx} y={MT + 26} textAnchor="middle"
                fontSize="13" fontWeight="800" letterSpacing="0.12em"
                fill={z.text} fontFamily="Inter,sans-serif">
                {z.label}
              </text>
            </g>
          );
        })}

        {/* Price grid */}
        {priceGrid.map(p => {
          const y = ty(p);
          if (y < MT - 2 || y > MT + CH + 2) return null;
          return (
            <g key={p}>
              <line x1={ML} y1={y} x2={VW - MR} y2={y}
                stroke="rgba(50,85,150,0.09)" strokeWidth="0.7" strokeDasharray="3 7" />
              <text x={VW - MR + 7} y={y + 3.5} fontSize="9"
                fill="rgba(110,155,210,0.55)" fontFamily="Inter,sans-serif" fontWeight="500">
                {p >= 1000 ? `${(p/1000).toFixed(0)}K` : p}
              </text>
            </g>
          );
        })}

        {/* Date ticks */}
        {dateTicks.map(tick => {
          const x = tx(tick.ts);
          if (x < ML || x > VW - MR + 5) return null;
          return (
            <g key={tick.ts}>
              <line x1={x} y1={MT} x2={x} y2={MT + CH}
                stroke={tick.isJan ? "rgba(70,100,180,0.2)" : "rgba(50,80,140,0.06)"}
                strokeWidth={tick.isJan ? 1 : 0.5} />
              <line x1={x} y1={MT + CH} x2={x} y2={MT + CH + 5}
                stroke="rgba(80,120,200,0.25)" strokeWidth="0.8" />
              <text x={x} y={MT + CH + 17} textAnchor="middle"
                fontSize={tick.isJan ? "9.5" : "7.5"}
                fontWeight={tick.isJan ? "700" : "400"}
                fill={tick.isJan ? "rgba(160,200,235,0.85)" : "rgba(100,145,190,0.38)"}
                fontFamily="Inter,sans-serif">
                {tick.label}
              </text>
            </g>
          );
        })}

        {/* Future zone dim overlay */}
        <rect x={nowX} y={MT} width={VW - MR - nowX} height={CH} fill="rgba(15,40,100,0.06)" />

        {/* Buying window — only in 25K–40K price band, no label */}
        {(() => {
          const x1 = tx(BUY_WIN_FROM), x2 = tx(BUY_WIN_TO);
          const yTop = ty(40000);
          const yBot = ty(25000);
          return (
            <rect x={x1} y={yTop} width={x2 - x1} height={yBot - yTop}
              fill="rgba(52,211,153,0.13)"
              stroke="rgba(52,211,153,0.45)" strokeWidth="0.9" rx="2" />
          );
        })()}

        {/* Халвинг + 500 дней — единый блок */}
        {(() => {
          const x1 = tx(HALVING_500_FROM);
          const xH  = tx(HALVING_DATE);

          // Combined label: lower and closer to halving line (right side of zone)
          const labelX = x1 + (xH - x1) * 0.72;
          const labelY = MT + CH * 0.38;

          // Buying window center (arrow target)
          const bwX1 = tx(BUY_WIN_FROM), bwX2 = tx(BUY_WIN_TO);
          const bwX  = (bwX1 + bwX2) / 2;
          const bwY  = (ty(40000) + ty(25000)) / 2;

          // Arrow: from below the label toward the buying window
          const arrowFromX = labelX - 30;
          const arrowFromY = labelY + 26;

          return (
            <g>
              {/* Zone border */}
              <rect x={x1} y={MT} width={xH - x1} height={CH}
                fill="rgba(56,189,248,0.04)"
                stroke="rgba(56,189,248,0.18)" strokeWidth="0.8"
                strokeDasharray="5 3" />

              {/* Halving date vertical line */}
              <line x1={xH} y1={MT} x2={xH} y2={MT + CH}
                stroke="rgba(56,189,248,0.50)" strokeWidth="1.2"
                strokeDasharray="6 3" />

              {/* Combined annotation */}
              <text x={labelX} y={labelY} textAnchor="middle"
                fontSize="11.5" fontWeight="800" letterSpacing="0.08em"
                fill="rgba(56,189,248,0.90)" fontFamily="Inter,sans-serif">
                ХАЛВИНГ апр 2028
              </text>
              <text x={labelX} y={labelY + 17} textAnchor="middle"
                fontSize="9" fontWeight="600" letterSpacing="0.04em"
                fill="rgba(56,189,248,0.55)" fontFamily="Inter,sans-serif">
                500 дней до
              </text>

              {/* Arrow → buying window */}
              <line
                x1={arrowFromX} y1={arrowFromY}
                x2={bwX + 4}    y2={bwY - 6}
                stroke="rgba(56,189,248,0.50)" strokeWidth="0.9"
                markerEnd="url(#arrowCyan)" />
            </g>
          );
        })()}

        {/* Candles */}
        <path d={rW.join(" ")} stroke="rgba(215,65,65,0.68)"  strokeWidth="0.85" fill="none" />
        <path d={gW.join(" ")} stroke="rgba(35,195,115,0.68)" strokeWidth="0.85" fill="none" />
        <path d={rB.join(" ")} fill="rgba(205,60,60,0.88)" />
        <path d={gB.join(" ")} fill="rgba(30,185,110,0.88)" />

        {/* Declining trend line */}
        <path d={declinePath} fill="none"
          stroke="rgba(200,155,100,0.28)" strokeWidth="1.3"
          strokeDasharray="7 4" strokeLinejoin="round" strokeLinecap="round" />

        {/* Phase markers */}
        {phases.map(ph => {
          const x   = tx(ph.resolvedTs);
          const y   = ty(ph.resolvedPrice);
          const col = ZONE_DOT[ph.zone];
          const fill = ZONE_FILL[ph.zone];
          const isCur = ph.n === currentCyclePhase.n;
          const alpha = ph.projected ? 0.45 : 1;
          const circR  = isCur ? 14 : ph.n === 6 ? 11 : 10;
          const above  = ph.above;
          const GAP = 18;
          const circY  = above ? y - GAP : y + GAP;
          const labelY = above ? circY - circR - 5 : circY + circR + 11;

          return (
            <g key={ph.n}>
              {isCur && (
                <>
                  <circle cx={nowX} cy={lastY} r={28} fill={fill.replace("0.20","0.04").replace("0.16","0.04")} filter="url(#btcGlowSoft)" />
                  <circle cx={nowX} cy={lastY} r={18} fill="none"
                    stroke={col} strokeWidth="0.9" strokeDasharray="3 4" opacity="0.55" />
                </>
              )}
              {ph.n === 6 && (
                <circle cx={x} cy={y} r={16} fill="rgba(245,185,20,0.04)" filter="url(#btcGlow)" />
              )}

              <circle cx={x} cy={y}
                r={isCur ? 6.5 : ph.n === 6 ? 5 : 3.5}
                fill={col} opacity={alpha}
                filter={isCur || ph.n === 6 ? "url(#btcGlow)" : undefined}
                className={isCur ? "v2-mp-cur-dot" : undefined}
              />

              <line
                x1={x} y1={above ? y - 4 : y + 4}
                x2={x} y2={above ? circY + circR : circY - circR}
                stroke={col} strokeWidth="0.8" opacity={alpha * 0.55}
              />

              <circle cx={x} cy={circY} r={circR}
                fill={isCur ? fill : ph.projected ? "rgba(8,18,32,0.75)" : "rgba(8,18,32,0.88)"}
                stroke={col}
                strokeWidth={isCur ? 2.2 : 1.0}
                opacity={alpha}
              />
              <text x={x} y={circY + 4} textAnchor="middle"
                fontSize={isCur ? "10" : "8.5"} fontWeight="800"
                fill={col}
                fontFamily="Inter,sans-serif" opacity={alpha}>
                {ph.n}
              </text>

              <text x={x} y={labelY} textAnchor="middle"
                fontSize={isCur ? "10.5" : ph.n === 6 ? "10" : "9"}
                fontWeight={isCur || ph.n === 6 ? "800" : "600"}
                fill={col}
                fontFamily="Inter,sans-serif" opacity={alpha}>
                {ph.label}
              </text>
            </g>
          );
        })}


        {/* Current price dashed line */}
        <line x1={ML} y1={lastY} x2={VW - MR} y2={lastY}
          stroke={lastBull ? "rgba(38,200,118,0.28)" : "rgba(215,65,65,0.28)"}
          strokeWidth="0.8" strokeDasharray="5 5" />

        {/* Current price badge */}
        <rect x={VW - MR + 1} y={lastY - 10} width={MR - 2} height={20} rx="3" fill={badgeFill} />
        <text x={VW - MR + 1 + (MR-2)/2} y={lastY + 4.5}
          textAnchor="middle" fontSize="9.5" fontWeight="700"
          fill="rgba(255,255,255,0.95)" fontFamily="Inter,sans-serif">
          {(last.close / 1000).toFixed(1)}K
        </text>

        {/* Axes */}
        <line x1={VW-MR} y1={MT} x2={VW-MR} y2={MT+CH} stroke="rgba(60,100,170,0.18)" strokeWidth="0.8" />
        <line x1={ML} y1={MT+CH} x2={VW-MR} y2={MT+CH} stroke="rgba(60,100,170,0.18)" strokeWidth="0.8" />

        {/* Scan-line overlay (above candles, below HUD) */}
        <rect x={ML} y={MT} width={CW} height={CH} fill="url(#scanlines)" />

        {/* HUD corner brackets */}
        {([
          [ML,    MT,     1,  1],
          [VW-MR, MT,    -1,  1],
          [ML,    MT+CH,  1, -1],
          [VW-MR, MT+CH, -1, -1],
        ] as [number,number,number,number][]).map(([cx, cy, sx, sy], i) => (
          <path key={`brk-${i}`}
            d={`M${cx},${cy + sy*20} L${cx},${cy} L${cx + sx*20},${cy}`}
            fill="none"
            stroke="rgba(86,196,240,0.50)"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
        ))}

        {/* Chart area top border line */}
        <line x1={ML} y1={MT} x2={VW-MR} y2={MT}
          stroke="rgba(86,196,240,0.14)" strokeWidth="0.8" />
        </svg>
      </div>
    </div>
  );
}
