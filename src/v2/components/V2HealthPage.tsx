import {
  computePortfolioHealth,
  FUTURES_LEVERAGE_LIMIT_ALT,
  FUTURES_LEVERAGE_LIMIT_MAJOR,
  MAX_FUTURES_POSITIONS,
} from "../../lib/portfolioHealth";
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
import { MAIN_INVESTOR_STRATEGY, type InvestorStrategy } from "../lib/investorStrategy";
import { MAIN_INVESTOR_DNA, type InvestorDNA } from "../lib/investorDNA";

type Props = {
  portfolio: V2Portfolio;
  health: PortfolioHealth;
  healthInput: HealthInput; // входы расчёта — для точной симуляции
  strategy?: InvestorStrategy;
  dna?: InvestorDNA;
  onOpenDNA?: () => void;
};

const fmt$ = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const pct = (v: number) => {
  const value = Math.round(v * 1000) / 10;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
};

const strategyAssetLimit = (strategy: InvestorStrategy, asset: string) => strategy.cryptoAssetLimits[asset] ?? 0;

function strategyCryptoRows(strategy: InvestorStrategy) {
  const rows = [
    { label: "ETH", value: strategyAssetLimit(strategy, "ETH") },
    { label: "BTC", value: strategyAssetLimit(strategy, "BTC") },
    { label: "TON / GRAM", value: Math.max(strategyAssetLimit(strategy, "TON"), strategyAssetLimit(strategy, "GRAM")) },
    { label: "SOL", value: strategyAssetLimit(strategy, "SOL") },
  ];

  if (strategy.id === "main") {
    rows.push({ label: "BNB", value: strategyAssetLimit(strategy, "BNB") });
    if (strategy.defaultCryptoAssetLimit > 0) {
      rows.push({ label: "Прочие альты", value: strategy.defaultCryptoAssetLimit });
    }
  }

  return rows.filter((row) => row.value > 0);
}

function rayDescription(c: HealthComponent) {
  if (c.key === "reserve") return "пол резерва и покупательная способность";
  if (c.key === "diversification") return "доли классов и число рабочих направлений";
  if (c.key === "concentration") return "перегруз отдельных активов сверх лимита";
  if (c.key === "crypto") return "выживание портфеля при стресс-сценарии";
  if (c.key === "flexibility") return "журнал решений, паузы и отсутствие импульсных сделок";
  return c.label === "Качество активов"
    ? "чистота портфеля: только разрешённые активы"
    : "фьючерсный лимит, плечо, позиции и ликвидация";
}

function StrategyPolicyCard({ strategy, health }: { strategy: InvestorStrategy; health: PortfolioHealth }) {
  const goldOnly = strategy.allowedMetalAssets?.every((asset) => ["GOLD", "XAU", "XAUUSD"].includes(asset)) ?? false;
  const metalLabel = goldOnly ? "Золото" : "Металлы";
  const classRows = [
    { label: "Крипта", value: `максимум ${pct(strategy.cryptoMaxShare)}` },
    {
      label: "Резерв",
      value:
        strategy.reserveTargetShare === strategy.reserveFloorShare
          ? `минимум ${pct(strategy.reserveFloorShare)}`
          : `минимум ${pct(strategy.reserveFloorShare)} · рабочая цель ${pct(strategy.reserveTargetShare)}`,
    },
    { label: metalLabel, value: `максимум ${pct(strategy.metalsMaxShare)}` },
    { label: "Акции", value: `максимум ${pct(strategy.stocksMaxShare)}` },
    {
      label: "Фьючерсы",
      value: strategy.futuresAllowed ? `максимум ${pct(strategy.futuresMaxShare)}` : "запрещены",
      tone: strategy.futuresAllowed ? "neutral" : "block",
    },
  ];
  const hardRules = [
    strategy.futuresAllowed
      ? `Фьючерсы: до ${pct(strategy.futuresMaxShare)}, максимум ${MAX_FUTURES_POSITIONS} позиции, плечо до ${FUTURES_LEVERAGE_LIMIT_ALT}x на альтах и до ${FUTURES_LEVERAGE_LIMIT_MAJOR}x на BTC/золоте.`
      : "Фьючерсы запрещены полностью.",
    strategy.allowedCryptoAssets
      ? `Крипта вне списка ${strategyCryptoRows(strategy).map((row) => row.label).join(" / ")} запрещена.`
      : `Новые альты: максимум ${strategy.maxAltcoinSlots} места по ${pct(strategy.defaultCryptoAssetLimit)} внутри крипто-блока.`,
    `${metalLabel}: максимум ${pct(strategy.metalsMaxShare)} портфеля, позиций не больше ${strategy.maxMetalSlots}.`,
    `Акции: максимум ${pct(strategy.stocksMaxShare)} портфеля, позиций не больше ${strategy.maxStockSlots}.`,
  ];

  if (!strategy.futuresAllowed && strategy.defaultCryptoAssetLimit === 0) {
    hardRules.push("Спекулятивные активы и случайные альты вне стратегии запрещены.");
  }

  return (
    <section className="v2-hp-policy-card" aria-label="Инвестиционная стратегия аккаунта">
      <div className="v2-hp-policy-head">
        <div>
          <div className="v2-hp-card-title">Инвестиционная стратегия</div>
          <h2>{strategy.title}</h2>
        </div>
        <span className="v2-hp-policy-badge">{strategy.allocationLabel}</span>
      </div>

      <div className="v2-hp-policy-grid">
        <div className="v2-hp-policy-panel">
          <div className="v2-hp-policy-kicker">Базовая структура</div>
          <div className="v2-hp-policy-rows">
            {classRows.map((row) => (
              <div key={row.label} className={`v2-hp-policy-row ${row.tone === "block" ? "is-block" : ""}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="v2-hp-policy-panel">
          <div className="v2-hp-policy-kicker">Крипто-блок</div>
          <div className="v2-hp-policy-rows">
            {strategyCryptoRows(strategy).map((row) => (
              <div key={row.label} className="v2-hp-policy-row">
                <span>{row.label}</span>
                <strong>до {pct(row.value)} внутри крипты</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="v2-hp-policy-panel">
          <div className="v2-hp-policy-kicker">Жёсткие ограничения</div>
          <ul className="v2-hp-policy-list">
            {hardRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>

        <div className="v2-hp-policy-panel">
          <div className="v2-hp-policy-kicker">Лучи здоровья</div>
          <div className="v2-hp-policy-rays">
            {health.components.map((component) => (
              <div key={component.key} className="v2-hp-policy-ray">
                <span>{component.label}</span>
                <em>{rayDescription(component)}</em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function InvestorDNAVerdictCard({ dna, onOpenDNA }: { dna: InvestorDNA; onOpenDNA?: () => void }) {
  const rows = [
    { label: "Тип", value: dna.investorType },
    { label: "Готовность к риску", value: `${dna.riskWillingness.value}/100` },
    { label: "Способность принимать риск", value: `${dna.riskCapacity.value}/100`, tone: dna.riskCapacity.value < 50 ? "block" : "neutral" },
    { label: "Главный риск", value: dna.liquidityRule },
  ];

  return (
    <section className="v2-hp-policy-card" aria-label="Вердикт ДНК Инвестора">
      <div className="v2-hp-policy-head">
        <div>
          <div className="v2-hp-card-title">ДНК Инвестора</div>
          <h2>{dna.investorType}</h2>
        </div>
        <span className="v2-hp-policy-badge">Вердикт</span>
      </div>

      <div className="v2-hp-policy-grid">
        <div className="v2-hp-policy-panel">
          <div className="v2-hp-policy-kicker">Короткий вывод</div>
          <div className="v2-hp-policy-ray">
            <span>Правило</span>
            <em>{dna.keyVerdict}</em>
          </div>
          {onOpenDNA && (
            <button className="v2-hp-sim-btn" type="button" onClick={onOpenDNA}>
              Открыть ДНК Инвестора
            </button>
          )}
        </div>

        <div className="v2-hp-policy-panel">
          <div className="v2-hp-policy-kicker">Профиль</div>
          <div className="v2-hp-policy-rows">
            {rows.map((row) => (
              <div key={row.label} className={`v2-hp-policy-row ${row.tone === "block" ? "is-block" : ""}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="v2-hp-policy-panel">
          <div className="v2-hp-policy-kicker">Ближайшие действия</div>
          <ul className="v2-hp-policy-list">
            {dna.recommendations.slice(0, 3).map((item) => (
              <li key={item.id}>{item.title}: {item.action}</li>
            ))}
          </ul>
        </div>

        <div className="v2-hp-policy-panel">
          <div className="v2-hp-policy-kicker">Связь с риском</div>
          <div className="v2-hp-policy-rays">
            <div className="v2-hp-policy-ray">
              <span>Просадка</span>
              <em>{dna.maxDrawdownRule}</em>
            </div>
            <div className="v2-hp-policy-ray">
              <span>Кредитное плечо</span>
              <em>{dna.leverageRule}</em>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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
  const targetUsd = Math.round(c.meta?.reserveTargetUsd ?? portfolio.totalPortfolioValue * 0.30);
  const targetPct = c.meta?.reserveTargetUsd && portfolio.totalPortfolioValue
    ? Math.round((c.meta.reserveTargetUsd / portfolio.totalPortfolioValue) * 100)
    : 30;

  switch (c.key) {
    case "reserve":
      if (c.score <= 0) return `Резерв $0 — подушки нет. Нечем докупать и нечем закрыть форс-мажор.`;
      if (c.score < 50) return `Резерв ${reservePct}% (${fmt$(reserveUsd)}) — нужно ${fmt$(targetUsd)}. Дефицит ${fmt$(Math.max(0, targetUsd - reserveUsd))}.`;
      return `Резерв ${reservePct}% от портфеля — чуть ниже цели ${targetPct}%.`;

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
      return c.label === "Качество активов"
        ? "Проверяется чистота портфеля: фьючерсы и запрещённые активы не должны появляться."
        : `Контроль риска приближается к лимиту ${Math.round(((c.meta?.futuresCapUtilization && c.meta.futuresShare) ? c.meta.futuresShare / c.meta.futuresCapUtilization : 0.1) * 100)}% от вложенного капитала.`;

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
    why: c.key === "futures"     ? (c.label === "Качество активов" ? "Запрещённые активы не нарушают стратегию." : "Занятая часть лимита, плечо и число позиций в пределах правил.")
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

export function V2HealthPage({
  portfolio,
  health,
  healthInput,
  strategy = MAIN_INVESTOR_STRATEGY,
  dna = MAIN_INVESTOR_DNA,
  onOpenDNA,
}: Props) {
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
  const reserveComponent = health.components.find((component) => component.key === "reserve");
  const riskControlComponent = health.components.find((component) => component.key === "futures");
  const reserveTargetShare = reserveComponent?.meta?.reserveTargetUsd && portfolio.totalPortfolioValue
    ? reserveComponent.meta.reserveTargetUsd / portfolio.totalPortfolioValue
    : 0.3;
  const reserveFloorShare = reserveComponent?.meta?.reserveFloorUsd && portfolio.totalPortfolioValue
    ? reserveComponent.meta.reserveFloorUsd / portfolio.totalPortfolioValue
    : 0.1;
  const reserveBandMaxShare = reserveComponent?.meta?.reserveBandMaxUsd && portfolio.totalPortfolioValue
    ? reserveComponent.meta.reserveBandMaxUsd / portfolio.totalPortfolioValue
    : 0.6;
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
        <V2CapitalLadder portfolio={portfolio} mode="health" strategy={strategy} />
      </div>

      <StrategyPolicyCard strategy={strategy} health={health} />
      <InvestorDNAVerdictCard dna={dna} onOpenDNA={onOpenDNA} />

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
                  {levers.reserveShare > reserveBandMaxShare
                    ? `Выше ${(reserveBandMaxShare * 100).toFixed(0)}% капитал простаивает — резерв начинает падать`
                    : levers.reserveShare < reserveFloorShare
                      ? `Ниже пола ${(reserveFloorShare * 100).toFixed(0)}% — так низко резерв не опускаем`
                      : levers.reserveShare > baseReserve
                        ? `Перевести ~${fmt$((levers.reserveShare - baseReserve) * portfolio.totalPortfolioValue)} рисковых в стейблы · коридор ${(reserveTargetShare * 100).toFixed(0)}–${(reserveBandMaxShare * 100).toFixed(0)}%`
                        : `Коридор ${(reserveTargetShare * 100).toFixed(0)}–${(reserveBandMaxShare * 100).toFixed(0)}% = 100 · пол ${(reserveFloorShare * 100).toFixed(0)}%`}
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
                  <span>{riskControlComponent?.label ?? "Контроль риска"}</span>
                  <span className="v2-hp-sim-lever-val">{(levers.riskControlRepair * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={levers.riskControlRepair}
                  onChange={e => setLever({ riskControlRepair: +e.target.value })} />
                <div className="v2-hp-sim-lever-hint">
                  {hasFutures
                    ? "Снизить маржу, плечо, число позиций и риск ликвидации"
                    : riskControlComponent?.label === "Качество активов"
                      ? "Фьючерсы запрещены — держим портфель в рамках разрешённых активов"
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
