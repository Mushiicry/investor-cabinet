import { computePortfolioHealth } from "../../lib/portfolioHealth";
import type { HealthInput, PortfolioHealth, HealthComponent } from "../../lib/portfolioHealth";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import { useMemo, useState } from "react";
import { V2HealthDetailModal } from "./V2HealthDetailModal";
import { isEmptyAccount } from "../lib/accountState";

type Props = {
  portfolio: V2Portfolio;
  health: PortfolioHealth;
  healthInput: HealthInput; // входы расчёта — для точной симуляции
};

const fmt$ = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

// ── Уровни здоровья ────────────────────────────────────────────
function interpretation(hf: number): { text: string; sub: string; color: string } {
  if (hf >= 80) return { text: "Отличное состояние",   sub: "Портфель сбалансирован. Можно наращивать позиции.", color: "#5AEF8D" };
  if (hf >= 65) return { text: "Хорошее состояние",    sub: "Структура крепкая. Небольшие зоны риска.", color: "#76DCAA" };
  if (hf >= 50) return { text: "Под наблюдением",      sub: "Несколько критериев в зоне риска.", color: "#55C7FF" };
  if (hf >= 35) return { text: "Требует внимания",     sub: "Кэш на исходе. Новые покупки нежелательны.", color: "#E6B33A" };
  if (hf >= 20) return { text: "Высокий риск",         sub: "Портфель перегружен. Сначала резерв, потом покупки.", color: "#FF8C42" };
  return         { text: "Критическое состояние",      sub: "Практически нет резерва. Риск эмоциональных решений.", color: "#FF5D6C" };
}

// ── Конкретная строка «почему» для слабой стороны ─────────────
function whyLine(c: HealthComponent, portfolio: V2Portfolio): string {
  const reservePct = Math.round(portfolio.reserveShare * 100);
  const reserveUsd = portfolio.stableReserve;
  const targetUsd  = Math.round(portfolio.totalPortfolioValue * 0.30);

  switch (c.key) {
    case "reserve":
      if (c.score <= 0) return `Резерв $0 — подушки нет. Нечем докупать и нечем закрыть форс-мажор.`;
      if (c.score < 50) return `Резерв ${reservePct}% (${fmt$(reserveUsd)}) — нужно ${fmt$(targetUsd)}. Дефицит ${fmt$(Math.max(0, targetUsd - reserveUsd))}.`;
      return `Резерв ${reservePct}% от портфеля — чуть ниже цели 30%.`;

    case "flexibility":
      if (c.score <= 0) return `Свободных денег нет — манёвра нет. Хорошие активы купить не на что.`;
      if (c.score < 40) return `Свободный кэш ~${fmt$(portfolio.deployableCapital)} — критически мало для откупов.`;
      return `Свободный кэш ${fmt$(portfolio.deployableCapital)} — ниже комфортного уровня.`;

    case "diversification":
      if (c.score < 40) return `Портфель почти в одном классе активов. Добавьте металлы, акции или стейблы.`;
      return `Диверсификация умеренная — добавьте ещё один класс активов.`;

    case "crypto":
      return `Доля волатильных активов превышает лимит 60% — любая просадка крипты бьёт непропорционально.`;

    case "concentration":
      return `Один актив занимает слишком большую долю. При его резком падении убытки будут значительными.`;

    case "futures":
      if (c.meta?.futuresCount && c.meta.futuresCount > 3)
        return `${c.meta.futuresCount} фьючерс-позиции открыты — лимит 3. Каскадная ликвидация становится вероятнее.`;
      if ((c.meta?.leverageBreaches ?? []).length)
        return `Плечо превышено на одной или нескольких позициях. Снизьте до ≤2x альты / ≤3x BTC.`;
      return `Начальная маржа фьючерсов приближается к лимиту 10% от вложенного капитала.`;

    default:
      return "";
  }
}

// ── Слабые/сильные с конкретным текстом ───────────────────────
type DiagItem = { label: string; score: number; why: string };

function richDiagnosis(components: HealthComponent[], portfolio: V2Portfolio) {
  const sorted = [...components].sort((a, b) => a.score - b.score);
  const weak   = sorted.filter(c => c.score < 55).map<DiagItem>(c => ({
    label: c.label, score: c.score, why: whyLine(c, portfolio),
  }));
  const strong = sorted.filter(c => c.score >= 70).reverse().map<DiagItem>(c => ({
    label: c.label, score: c.score,
    why: c.key === "futures"     ? "Маржа, плечо и число позиций в пределах правил."
       : c.key === "reserve"     ? `Резерв ${Math.round(portfolio.reserveShare * 100)}% — подушка сформирована.`
       : c.key === "flexibility" ? `Есть ${fmt$(portfolio.deployableCapital)} для маневра.`
       : "В пределах нормы.",
  }));
  return { weak, strong };
}

// ── Prescription с конкретным gain ───────────────────────────
type Rx = { action: string; gain: number; source: string };

function buildPrescriptions(components: HealthComponent[], portfolio: V2Portfolio): Rx[] {
  const sorted = [...components].sort((a, b) => a.score - b.score);
  const weak = sorted.filter(c => c.score < 60).slice(0, 3);
  const reserveTarget = portfolio.totalPortfolioValue * 0.30;
  const deficit = Math.max(0, reserveTarget - portfolio.stableReserve);

  const result: Rx[] = [];
  for (const c of weak) {
    switch (c.key) {
      case "reserve":
        result.push({ action: deficit > 0 ? `Пополнить резерв на ${fmt$(deficit)} до 30%` : "Поддерживать резерв выше 30%", gain: 6, source: c.label });
        result.push({ action: "Не открывать новые позиции пока резерв не достигнут", gain: 3, source: c.label });
        break;
      case "flexibility":
        result.push({ action: "Зафиксировать слабые позиции — вывести в кэш", gain: 4, source: c.label });
        result.push({ action: "Держать свободные деньги для откупов на просадках", gain: 3, source: c.label });
        break;
      case "diversification": {
        // Умный расчёт из модели: кто перегружен, сколько $ и куда добавить
        const m = c.meta;
        if (m?.largestClassShareOfRisk && m.largestClassShareOfRisk > 0.8 && m.rebalanceAddUsd) {
          const pct = Math.round(m.largestClassShareOfRisk * 100);
          const portfolioPct = Math.round((m.largestClassShareOfPortfolio ?? 0) * 100);
          const others = (m.otherClassNames ?? []).join(" / ").toLowerCase();
          result.push({
            action: `${m.largestClassName}: ${portfolioPct}% портфеля, но ${pct}% рисковой части (без кэша) — лимит 80%. Добавить ≈${fmt$(m.rebalanceAddUsd)} в ${others}`,
            gain: 4,
            source: c.label,
          });
        } else if (m?.missingClassNames?.length) {
          result.push({
            action: `Добавить отсутствующий класс: ${m.missingClassNames.join(" / ").toLowerCase()}`,
            gain: 4,
            source: c.label,
          });
        } else {
          result.push({ action: "Выравнивать классы к лимитам: крипта 60% / металлы 10% / акции 10%", gain: 4, source: c.label });
        }
        result.push({ action: "Не держать более 80% рискового капитала в одном классе", gain: 3, source: c.label });
        break;
      }
      case "crypto":
        result.push({ action: "Зафиксировать часть волатильных активов в стейблы", gain: 5, source: c.label });
        result.push({ action: "В зоне жадности (F&G > 70) снижать долю крипты", gain: 3, source: c.label });
        break;
      case "concentration":
        result.push({ action: "Распределить часть крупнейшей позиции в другие активы", gain: 5, source: c.label });
        result.push({ action: "Не усредняться в актив с долей > 35%", gain: 3, source: c.label });
        break;
      case "futures":
        result.push({ action: "Снизить плечо: ≤2x альты, ≤3x BTC", gain: 5, source: c.label });
        result.push({ action: "Сократить число позиций до 3 максимум", gain: 4, source: c.label });
        break;
    }
  }
  return result.slice(0, 6);
}

// ── Цвет по score ──────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 75) return "#5AEF8D";
  if (s >= 50) return "#55C7FF";
  if (s >= 30) return "#E6B33A";
  return "#FF5D6C";
}

// ── Кольцо-gauge ─────────────────────────────────────────────
function ScoreRing({ value, color }: { value: number; color: string }) {
  const R = 88, circ = 2 * Math.PI * R;
  const dash = (value / 100) * circ;
  return (
    <svg viewBox="0 0 220 220" className="v2-hp-ring-svg" aria-hidden="true">
      <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(86,196,240,0.10)" strokeWidth="10" />
      <circle cx="110" cy="110" r={R} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`}
        transform="rotate(-90 110 110)"
        style={{ transition: "stroke-dasharray 1s ease, stroke 0.5s" }} />
      <circle cx="110" cy="110" r={R} fill="none" stroke={color} strokeWidth="3"
        strokeOpacity="0.22" strokeDasharray={`${dash} ${circ - dash}`}
        transform="rotate(-90 110 110)" />
      <text x="110" y="100" textAnchor="middle" fontSize="54" fontWeight="900" fill="white"
        fontFamily="'Libre Baskerville', Georgia, serif">{value}</text>
      <text x="110" y="128" textAnchor="middle" fontSize="13"
        fill="rgba(200,230,245,0.55)" fontFamily="'Bodoni Moda', Georgia, serif" letterSpacing="2">
        ИЗ 100
      </text>
    </svg>
  );
}

// ── Breakdown row ─────────────────────────────────────────────
function BreakdownRow({ c, onClick, empty }: { c: HealthComponent; onClick: () => void; empty?: boolean }) {
  const color = empty ? EMPTY_TONE : scoreColor(c.score);
  return (
    <button className="v2-hp-brow" type="button" onClick={onClick}>
      <span className="v2-hp-brow-label">{c.label}</span>
      <span className="v2-hp-brow-track">
        <span className="v2-hp-brow-fill" style={{ width: `${Math.min(100, c.score)}%`, background: color }} />
      </span>
      <span className="v2-hp-brow-score" style={{ color }}>{c.score}</span>
      <span className="v2-hp-brow-weight">×{c.weight}</span>
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────
// Нейтральный тон для пустого аккаунта — спокойный info-голубой, не тревожный красный.
const EMPTY_TONE = "#55C7FF";

// ── Health Simulator ──────────────────────────────────────────────
// «Что если»: строим изменённый HealthInput и гоняем через РЕАЛЬНЫЙ
// computePortfolioHealth(). Никаких обратных восстановлений из баллов —
// симуляция точна и не разъедется с движком. Реальные сделки НЕ выполняются.
//
// Шесть рычагов покрывают все шесть граней здоровья:
//   резерв → Резерв + Гибкость | выравнивание классов → Диверсификация + Волатильность
//   крупнейшая позиция → Концентрация | плечо / маржа / число позиций → Фьючерсы
type SimLevers = {
  reserve: number;       // целевая доля резерва (стейблы)
  rebalance: number;     // 0..1 — выровнять спотовые классы к равным долям
  largest: number;       // целевая доля крупнейшей позиции
  leverageCut: number;   // 0..1 — срезать плечо фьючерсов
  futuresMargin: number; // целевая доля маржи фьючерсов
  futuresCount: number;  // целевое число фьючерс-позиций
};

const sumOf = (xs: number[]) => xs.reduce((sum, v) => sum + v, 0);

function buildSimInput(base: HealthInput, levers: SimLevers): HealthInput {
  const baseReserve = base.reserveShare ?? base.cashShare;
  const spot = base.riskCategoryShares;
  const spotTotal = sumOf(spot);

  // 1) Резерв: капитал перетекает между рисковыми активами и стейблами.
  const delta = levers.reserve - baseReserve;
  const newSpotTotal = Math.max(0, spotTotal - delta);
  const scale = spotTotal > 0 ? newSpotTotal / spotTotal : 0;
  let newSpot = spot.map((s) => s * scale);

  // 2) Выравнивание: тянем доли классов к равным (при 100% — идеально ровно).
  const equal = newSpot.length > 0 ? newSpotTotal / newSpot.length : 0;
  newSpot = newSpot.map((s) => s + levers.rebalance * (equal - s));

  // 3) Фьючерсы: число позиций, плечо на каждой, маржа.
  const legs = (base.futuresLegs ?? [])
    .slice(0, Math.max(0, Math.round(levers.futuresCount)))
    .map((leg) => ({
      ...leg,
      leverage: leg.leverage == null ? null : leg.leverage * (1 - levers.leverageCut),
    }));

  return {
    ...base,
    cashShare: Math.max(0, base.cashShare + delta),
    reserveShare: Math.max(0, levers.reserve),
    cryptoShare: newSpot[0] ?? 0, // крипта — первый спотовый класс (DIVERSIFIABLE_CLASSES)
    riskCategoryShares: newSpot,
    largestShare: Math.max(0, levers.largest),
    futuresShare: Math.max(0, levers.futuresMargin),
    futuresLegs: legs,
  };
}

export function V2HealthPage({ portfolio, health, healthInput }: Props) {
  const [modal, setModal]   = useState<HealthComponent | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const hf = health.healthFactor;
  // Пустой/кастдев-аккаунт (кошельки не подключены): 0 — это отсутствие данных,
  // а не «критическое состояние». Показываем спокойный «нет данных» вместо
  // тревожного диагноза и рецептов. Реальный аккаунт (value > 0) не затрагивается.
  const isEmpty = isEmptyAccount(portfolio);
  const interp = isEmpty
    ? { text: "Кошельки не подключены", sub: "Подключите источники данных — оценка здоровья появится автоматически", color: EMPTY_TONE }
    : interpretation(hf);
  const { weak, strong } = isEmpty
    ? { weak: [] as DiagItem[], strong: [] as DiagItem[] }
    : richDiagnosis(health.components, portfolio);
  const prescriptions = isEmpty ? [] : buildPrescriptions(health.components, portfolio);
  const sortedComponents = [...health.components].sort((a, b) => a.score - b.score);

  // ── Симулятор: 6 рычагов поверх реальных входов health ──
  const baseReserve = healthInput.reserveShare ?? healthInput.cashShare;
  const baseLegs = healthInput.futuresLegs ?? [];
  const hasFutures = baseLegs.length > 0 || healthInput.futuresShare > 0;
  const defaultLevers: SimLevers = {
    reserve: baseReserve,
    rebalance: 0,
    largest: healthInput.largestShare,
    leverageCut: 0,
    futuresMargin: healthInput.futuresShare,
    futuresCount: baseLegs.length,
  };
  const [levers, setLevers] = useState<SimLevers>(defaultLevers);
  const resetLevers = () => setLevers(defaultLevers);
  const setLever = (patch: Partial<SimLevers>) => setLevers((l) => ({ ...l, ...patch }));

  const sim = useMemo(
    () => computePortfolioHealth(buildSimInput(healthInput, levers)),
    [healthInput, levers]
  );
  const simScores = useMemo(
    () => Object.fromEntries(sim.components.map((c) => [c.key, c.score])) as Record<string, number>,
    [sim]
  );
  const simDelta = sim.healthFactor - hf;
  const simInterp = interpretation(sim.healthFactor);

  return (
    <div className="v2-hp-page">

      {/* ── Верхний ряд: Score + Diagnosis + Prescription ── */}
      <div className="v2-hp-top">

        {/* Score */}
        <div className="v2-hp-score-card">
          <div className="v2-hp-score-label">INVESTOR HEALTH SCORE</div>
          <ScoreRing value={hf} color={interp.color} />
          <div className="v2-hp-score-interp" style={{ color: interp.color }}>{interp.text}</div>
          <div className="v2-hp-score-sub">{interp.sub}</div>
          {/* Health Simulator — открывается только при наличии данных */}
          {!isEmpty && (
            <button
              className="v2-hp-sim-btn"
              type="button"
              onClick={() => { resetLevers(); setSimOpen(true); }}
              title="Открыть симулятор здоровья портфеля"
            >
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="7" cy="7" r="5.5" />
                <path d="M5 7h4M7 5v4" strokeLinecap="round" />
              </svg>
              Симулятор Health
            </button>
          )}
        </div>

        {/* Diagnosis */}
        <div className="v2-hp-diag-card">
          <div className="v2-hp-card-title">Диагноз</div>

          {strong.length > 0 && (
            <div className="v2-hp-diag-group">
              <div className="v2-hp-diag-group-label v2-hp-diag-group-label--ok">Сильные стороны</div>
              {strong.map((s, i) => (
                <div key={i} className="v2-hp-diag-row v2-hp-diag-row--ok">
                  <span className="v2-hp-diag-icon">✓</span>
                  <div>
                    <div className="v2-hp-diag-name">{s.label} <span className="v2-hp-diag-score" style={{ color: "#5AEF8D" }}>{s.score}</span></div>
                    <div className="v2-hp-diag-why">{s.why}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {weak.length > 0 && (
            <div className="v2-hp-diag-group">
              <div className="v2-hp-diag-group-label v2-hp-diag-group-label--warn">Слабые стороны</div>
              {weak.map((w, i) => (
                <div key={i} className="v2-hp-diag-row v2-hp-diag-row--warn">
                  <span className="v2-hp-diag-icon">⚠</span>
                  <div>
                    <div className="v2-hp-diag-name">{w.label} <span className="v2-hp-diag-score" style={{ color: "#E6B33A" }}>{w.score}</span></div>
                    {w.why && <div className="v2-hp-diag-why">{w.why}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {strong.length === 0 && weak.length === 0 && (
            isEmpty ? (
              <div className="v2-hp-diag-row">
                <span className="v2-hp-diag-icon">—</span>
                <span>Нет данных — подключите кошельки, диагноз появится автоматически</span>
              </div>
            ) : (
              <div className="v2-hp-diag-row v2-hp-diag-row--ok">
                <span className="v2-hp-diag-icon">✓</span>
                <span>Все показатели в норме</span>
              </div>
            )
          )}
        </div>

        {/* Prescription */}
        <div className="v2-hp-rx-card">
          <div className="v2-hp-card-title">
            Prescription
            <span className="v2-hp-rx-kicker">Что улучшит Health прямо сейчас</span>
          </div>
          <div className="v2-hp-rx-list">
            {prescriptions.length === 0 ? (
              isEmpty ? (
                <div className="v2-hp-rx-row">
                  <span className="v2-hp-rx-gain" style={{ color: EMPTY_TONE }}>—</span>
                  <span>Нет данных — подключите источники, рекомендации появятся автоматически</span>
                </div>
              ) : (
                <div className="v2-hp-rx-row">
                  <span className="v2-hp-rx-gain" style={{ color: "#5AEF8D" }}>✓</span>
                  <span>Портфель в отличной форме — удерживайте структуру</span>
                </div>
              )
            ) : prescriptions.map((p, i) => (
              <div key={i} className="v2-hp-rx-row">
                <span className="v2-hp-rx-gain">+{p.gain}</span>
                <div className="v2-hp-rx-text">
                  <div className="v2-hp-rx-action">{p.action}</div>
                  <div className="v2-hp-rx-source">{p.source}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Breakdown ── */}
      <div className="v2-hp-breakdown-card">
        <div className="v2-hp-card-title">Health Breakdown — из чего складывается оценка</div>
        <div className="v2-hp-brows">
          {sortedComponents.map(c => (
            <BreakdownRow key={c.key} c={c} empty={isEmpty} onClick={() => setModal(c)} />
          ))}
        </div>
        <div className="v2-hp-brow-total">
          <span>Итого</span>
          <span className="v2-hp-brow-total-num" style={{ color: interp.color }}>{hf} / 100</span>
        </div>
        <div className="v2-hp-brow-hint">Нажмите на строку — подробное объяснение и рекомендации</div>
      </div>

      {/* ── Health Simulator ── */}
      {simOpen && (
        <div className="v2-hp-sim-overlay" onClick={() => setSimOpen(false)}>
          <div className="v2-hp-sim-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Симулятор здоровья портфеля">
            <div className="v2-hp-sim-head">
              <div>
                <div className="v2-hp-sim-title">Симулятор Health</div>
                <div className="v2-hp-sim-note">Гипотетический расчёт — реальные сделки не выполняются</div>
              </div>
              <button className="v2-hp-sim-x" onClick={() => setSimOpen(false)} aria-label="Закрыть">✕</button>
            </div>

            <div className="v2-hp-sim-scoreboard">
              <div className="v2-hp-sim-score">
                <span className="v2-hp-sim-score-lab">Сейчас</span>
                <strong style={{ color: interp.color }}>{hf}</strong>
              </div>
              <svg className="v2-hp-sim-arrow" viewBox="0 0 24 12" aria-hidden="true"><path d="M2 6h18m0 0l-5-4m5 4l-5 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div className="v2-hp-sim-score">
                <span className="v2-hp-sim-score-lab">Стало</span>
                <strong style={{ color: simInterp.color }}>{sim.healthFactor}</strong>
              </div>
              <div className={`v2-hp-sim-delta ${simDelta > 0 ? "up" : simDelta < 0 ? "down" : "flat"}`}>
                {simDelta > 0 ? "+" : ""}{simDelta}
              </div>
            </div>

            <div className="v2-hp-sim-levers">
              {/* Резерв → Резерв + Гибкость */}
              <div className="v2-hp-sim-lever">
                <div className="v2-hp-sim-lever-top">
                  <span>Резерв (стейблы)</span>
                  <span className="v2-hp-sim-lever-val">{(levers.reserve * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="0.9" step="0.01" value={levers.reserve}
                  onChange={e => setLever({ reserve: +e.target.value })} />
                <div className="v2-hp-sim-lever-hint">
                  {levers.reserve > 0.6
                    ? "Выше 60% капитал простаивает — резерв начинает падать"
                    : levers.reserve < 0.1
                      ? "Ниже пола 10% — так низко резерв не опускаем"
                      : levers.reserve > baseReserve
                        ? `Перевести ~${fmt$((levers.reserve - baseReserve) * portfolio.totalPortfolioValue)} рисковых в стейблы · коридор 30–60%`
                        : "Коридор 30–60% = 100 · при полном рынке допустим пол 10%"}
                </div>
              </div>

              {/* Выравнивание классов → Диверсификация + Волатильность */}
              <div className="v2-hp-sim-lever">
                <div className="v2-hp-sim-lever-top">
                  <span>Выровнять классы (крипта / металлы / акции)</span>
                  <span className="v2-hp-sim-lever-val">{(levers.rebalance * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={levers.rebalance}
                  onChange={e => setLever({ rebalance: +e.target.value })} />
                <div className="v2-hp-sim-lever-hint">Разложить рисковый капитал поровну — 100% даёт максимум диверсификации</div>
              </div>

              {/* Крупнейшая позиция → Концентрация */}
              <div className="v2-hp-sim-lever">
                <div className="v2-hp-sim-lever-top">
                  <span>Крупнейшая позиция</span>
                  <span className="v2-hp-sim-lever-val">{(levers.largest * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max={Math.max(healthInput.largestShare, 0.2)} step="0.01" value={levers.largest}
                  onChange={e => setLever({ largest: +e.target.value })} />
                <div className="v2-hp-sim-lever-hint">Распределить крупнейший актив — ≤20% даёт 100 баллов</div>
              </div>

              {hasFutures && (
                <>
                  {/* Маржа фьючерсов → Фьючерсы (вес) */}
                  <div className="v2-hp-sim-lever">
                    <div className="v2-hp-sim-lever-top">
                      <span>Маржа фьючерсов</span>
                      <span className="v2-hp-sim-lever-val">{(levers.futuresMargin * 100).toFixed(1)}%</span>
                    </div>
                    <input type="range" min="0" max={Math.max(healthInput.futuresShare, 0.1)} step="0.005" value={levers.futuresMargin}
                      onChange={e => setLever({ futuresMargin: +e.target.value })} />
                    <div className="v2-hp-sim-lever-hint">Лимит политики — 10% от вложенного капитала</div>
                  </div>

                  {/* Плечо → Фьючерсы (плечо) */}
                  <div className="v2-hp-sim-lever">
                    <div className="v2-hp-sim-lever-top">
                      <span>Снизить плечо</span>
                      <span className="v2-hp-sim-lever-val">−{(levers.leverageCut * 100).toFixed(0)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={levers.leverageCut}
                      onChange={e => setLever({ leverageCut: +e.target.value })} />
                    <div className="v2-hp-sim-lever-hint">Меньше плечо — ниже риск ликвидации (≤2x альты, ≤3x BTC/золото)</div>
                  </div>

                  {/* Число позиций → Фьючерсы (количество) */}
                  {baseLegs.length > 0 && (
                    <div className="v2-hp-sim-lever">
                      <div className="v2-hp-sim-lever-top">
                        <span>Фьючерс-позиций</span>
                        <span className="v2-hp-sim-lever-val">{Math.round(levers.futuresCount)}</span>
                      </div>
                      <input type="range" min="0" max={baseLegs.length} step="1" value={levers.futuresCount}
                        onChange={e => setLever({ futuresCount: +e.target.value })} />
                      <div className="v2-hp-sim-lever-hint">Каждая позиция несёт риск — лимит 3</div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="v2-hp-sim-effects">
              {health.components.map(c => {
                const ns = simScores[c.key] ?? c.score;
                const d = ns - c.score;
                return (
                  <div key={c.key} className={`v2-hp-sim-eff ${d > 0 ? "up" : d < 0 ? "down" : "flat"}`}>
                    <span className="v2-hp-sim-eff-lab">{c.label}</span>
                    <span className="v2-hp-sim-eff-val">{c.score}<i>→</i>{ns}</span>
                  </div>
                );
              })}
            </div>

            <div className="v2-hp-sim-actions">
              <button className="v2-hp-sim-reset" onClick={resetLevers}>Сбросить</button>
              <button className="v2-hp-sim-close" onClick={() => setSimOpen(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <V2HealthDetailModal
          component={modal}
          portfolio={portfolio}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
