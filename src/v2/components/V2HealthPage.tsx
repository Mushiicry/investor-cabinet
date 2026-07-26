import { computePortfolioHealth } from "../../lib/portfolioHealth";
import type { HealthInput, PortfolioHealth, HealthComponent } from "../../lib/portfolioHealth";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import { useMemo, useState } from "react";
import { V2HealthDetailModal } from "./V2HealthDetailModal";
import { isEmptyAccount } from "../lib/accountState";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import { buildCoreRecs, isActionableHealthComponent } from "../lib/healthCoreHelpers";
import {
  buildDefaultHealthSimulatorLevers,
  buildHealthSimulatorInput,
  type HealthSimulatorLevers,
} from "../lib/healthSimulator";
import { V2CapitalLadder } from "./V2CapitalLadder";

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
      if ((c.meta?.disciplineBlockers ?? []).length) return c.meta?.disciplineBlockers?.[0] ?? "";
      if ((c.meta?.disciplineWarnings ?? []).length) return c.meta?.disciplineWarnings?.[0] ?? "";
      return `Процесс решений соблюдается.`;

    case "diversification":
      if (c.score < 40) return `Портфель почти в одном классе активов. Добавьте металлы, акции или стейблы.`;
      return `Диверсификация умеренная — добавьте ещё один класс активов.`;

    case "crypto":
      if ((c.meta?.survivalBlockers ?? []).length) return c.meta?.survivalBlockers?.[0] ?? "";
      if ((c.meta?.survivalWarnings ?? []).length) return c.meta?.survivalWarnings?.[0] ?? "";
      return `${c.meta?.survivalWorstScenario ?? "Худший сценарий"}: просадка около ${Math.round((c.meta?.survivalShockLossPct ?? 0) * 100)}%.`;

    case "concentration":
      return `Один актив занимает слишком большую долю. При его резком падении убытки будут значительными.`;

    case "futures":
      if (c.meta?.futuresCount && c.meta.futuresCount > 3)
        return `${c.meta.futuresCount} фьючерс-позиции открыты — лимит 3. Каскадная ликвидация становится вероятнее.`;
      if ((c.meta?.leverageBreaches ?? []).length)
        return `Плечо превышено на одной или нескольких позициях. Снизьте до ≤2x альты / ≤3x BTC.`;
      return `Контроль риска приближается к лимиту 10% от вложенного капитала.`;

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
    why: c.key === "futures"     ? "Занятая часть лимита, плечо и число позиций в пределах правил."
       : c.key === "reserve"     ? `Резерв ${Math.round(portfolio.reserveShare * 100)}% — подушка сформирована.`
       : c.key === "flexibility" ? "Журнал и поведенческие правила в норме."
       : "В пределах нормы.",
  }));
  return { weak, strong };
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

export function V2HealthPage({ portfolio, health, healthInput }: Props) {
  const [modal, setModal]   = useState<HealthComponent | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  useEscapeClose(simOpen, () => setSimOpen(false));
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
  const sortedComponents = [...health.components].sort((a, b) => a.score - b.score);
  const weakForRecommendations = sortedComponents.filter(isActionableHealthComponent);
  const recommendations = isEmpty
    ? []
    : buildCoreRecs(weakForRecommendations, portfolio, health.components, healthInput);

  // ── Симулятор: 6 рычагов поверх реальных входов health ──
  const baseReserve = healthInput.reserveShare ?? healthInput.cashShare;
  const hasFutures = (healthInput.futuresLegs ?? []).length > 0 || healthInput.futuresShare > 0;
  const defaultLevers = buildDefaultHealthSimulatorLevers(healthInput);
  const [levers, setLevers] = useState<HealthSimulatorLevers>(defaultLevers);
  const resetLevers = () => setLevers(defaultLevers);
  const setLever = (patch: Partial<HealthSimulatorLevers>) => setLevers((l) => ({ ...l, ...patch }));

  const sim = useMemo(
    () => computePortfolioHealth(buildHealthSimulatorInput(healthInput, levers)),
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

      {/* ── Верхний ряд: оценка + диагноз + рекомендации ── */}
      <div className="v2-hp-top">

        {/* Score */}
        <div className="v2-hp-score-card">
          <div className="v2-hp-score-label">ОЦЕНКА ЗДОРОВЬЯ ИНВЕСТОРА</div>
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
              Симулятор здоровья
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

        {/* Рекомендации */}
        <div className="v2-hp-rx-card">
          <div className="v2-hp-card-title">
            Рекомендации
            <span className="v2-hp-rx-kicker">Что улучшит здоровье прямо сейчас</span>
          </div>
          <div className="v2-hp-rx-list">
            {recommendations.length === 0 ? (
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
            ) : recommendations.map((p, i) => (
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

      <div className="v2-hp-capital-goal">
        <div className="v2-hp-card-title">Цель капитала</div>
        <V2CapitalLadder portfolio={portfolio} mode="health" />
      </div>

      {/* ── Breakdown ── */}
      <div className="v2-hp-breakdown-card">
        <div className="v2-hp-card-title">Разбор здоровья — из чего складывается оценка</div>
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
                <div className="v2-hp-sim-title">Симулятор здоровья</div>
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
              <div className="v2-hp-sim-lever">
                <div className="v2-hp-sim-lever-top">
                  <span>Резерв</span>
                  <span className="v2-hp-sim-lever-val">{(levers.reserveShare * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="0.9" step="0.01" value={levers.reserveShare}
                  onChange={e => setLever({ reserveShare: +e.target.value })} />
                <div className="v2-hp-sim-lever-hint">
                  {levers.reserveShare > 0.6
                    ? "Выше 60% капитал простаивает — резерв начинает падать"
                    : levers.reserveShare < 0.1
                      ? "Ниже пола 10% — так низко резерв не опускаем"
                      : levers.reserveShare > baseReserve
                        ? `Перевести ~${fmt$((levers.reserveShare - baseReserve) * portfolio.totalPortfolioValue)} рисковых в стейблы · коридор 30–60%`
                        : "Коридор 30–60% = 100 · при полном рынке допустим пол 10%"}
                </div>
              </div>

              <div className="v2-hp-sim-lever">
                <div className="v2-hp-sim-lever-top">
                  <span>Диверсификация</span>
                  <span className="v2-hp-sim-lever-val">{(levers.diversificationRepair * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={levers.diversificationRepair}
                  onChange={e => setLever({ diversificationRepair: +e.target.value })} />
                <div className="v2-hp-sim-lever-hint">Разложить рисковый капитал поровну — 100% даёт максимум диверсификации</div>
              </div>

              <div className="v2-hp-sim-lever">
                <div className="v2-hp-sim-lever-top">
                  <span>Концентрация</span>
                  <span className="v2-hp-sim-lever-val">{(levers.concentrationRepair * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={levers.concentrationRepair}
                  onChange={e => setLever({ concentrationRepair: +e.target.value })} />
                <div className="v2-hp-sim-lever-hint">Разгрузить активы выше лимита, освободить места и снизить крупнейшую позицию</div>
              </div>

              <div className="v2-hp-sim-lever">
                <div className="v2-hp-sim-lever-top">
                  <span>Контроль риска</span>
                  <span className="v2-hp-sim-lever-val">{(levers.riskControlRepair * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={levers.riskControlRepair}
                  onChange={e => setLever({ riskControlRepair: +e.target.value })} />
                <div className="v2-hp-sim-lever-hint">
                  {hasFutures
                    ? "Снизить маржу, плечо, число позиций и риск ликвидации"
                    : "Активной торговли нет — луч уже должен быть близок к норме"}
                </div>
              </div>

              <div className="v2-hp-sim-lever">
                <div className="v2-hp-sim-lever-top">
                  <span>Выживаемость</span>
                  <span className="v2-hp-sim-lever-val">{(levers.survivalPlan * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={levers.survivalPlan}
                  onChange={e => setLever({ survivalPlan: +e.target.value })} />
                <div className="v2-hp-sim-lever-hint">Подключить план лимитных ордеров на падение без съедания покупательской способности</div>
              </div>

              <div className="v2-hp-sim-lever">
                <div className="v2-hp-sim-lever-top">
                  <span>Дисциплина</span>
                  <span className="v2-hp-sim-lever-val">{(levers.disciplineRepair * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={levers.disciplineRepair}
                  onChange={e => setLever({ disciplineRepair: +e.target.value })} />
                <div className="v2-hp-sim-lever-hint">Заполнить журнал, убрать страх упустить рост, переторговку и дисциплинарную паузу</div>
              </div>
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
