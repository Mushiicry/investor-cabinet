import { computePortfolioHealth } from "../../lib/portfolioHealth";
import type { HealthInput, PortfolioHealth, HealthComponent } from "../../lib/portfolioHealth";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import { useMemo, useState } from "react";
import { V2HealthDetailModal } from "./V2HealthDetailModal";
import { isEmptyAccount } from "../lib/accountState";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import { buildCoreRecs, isActionableHealthComponent, type CoreRec } from "../lib/healthCoreHelpers";
import {
  buildDefaultHealthSimulatorLevers,
  buildHealthSimulatorInput,
  type HealthSimulatorLevers,
} from "../lib/healthSimulator";
import portfolioHealthScoreOrb from "../../assets/dna/portfolio-health-score-orb.png";
import dnaRiskReadiness from "../../assets/dna/dna-risk-readiness.webp";
import dnaRiskReadinessWife from "../../assets/dna/dna-risk-readiness-wife.webp";
import { MAIN_INVESTOR_STRATEGY, type InvestorStrategy } from "../lib/investorStrategy";
import { MAIN_INVESTOR_DNA, type InvestorDNA } from "../lib/investorDNA";
import { V2InvestorDNAPage } from "./V2InvestorDNAPage";
import { V2PortfolioAlertsPanel } from "./V2PortfolioAlertsPanel";
import { sortAlerts, type Alert } from "../lib/portfolioAlerts";

type Props = {
  portfolio: V2Portfolio;
  health: PortfolioHealth;
  healthInput: HealthInput; // входы расчёта — для точной симуляции
  strategy?: InvestorStrategy;
  dna?: InvestorDNA;
  fearGreedIndex?: number;
  onOpenGate?: () => void;
  initialDNAExpanded?: boolean;
  portfolioAlerts?: Alert[];
  onPortfolioAlertAction?: (alert: Alert) => void;
  canRunPortfolioAlertAction?: (alert: Alert) => boolean;
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
  const reservePct = Math.round((c.meta?.reserveShare ?? portfolio.reserveShare) * 100);
  const reserveUsd = portfolio.stableReserve;
  const targetUsd = Math.round(c.meta?.reserveTargetUsd ?? portfolio.totalPortfolioValue * 0.30);
  const reserveBaseUsd = c.meta?.reserveBaseUsd ?? portfolio.totalPortfolioValue;
  const targetPct = c.meta?.reserveTargetUsd && reserveBaseUsd
    ? Math.round((c.meta.reserveTargetUsd / reserveBaseUsd) * 100)
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
       : c.key === "reserve"     ? `Резерв ${Math.round((c.meta?.reserveShare ?? portfolio.reserveShare) * 100)}% — подушка сформирована.`
       : c.key === "flexibility" ? "Журнал и поведенческие правила в норме."
       : "В пределах нормы.",
  }));
  return { weak, strong };
}

function getHealthComponent(health: PortfolioHealth, key: HealthComponent["key"]) {
  return health.components.find((component) => component.key === key);
}

function healthTone(score: number): "ok" | "warn" | "bad" {
  if (score >= 75) return "ok";
  if (score >= 55) return "warn";
  return "bad";
}

function buildPermissionRows(strategy: InvestorStrategy, health: PortfolioHealth, healthInput: HealthInput, portfolio: V2Portfolio) {
  const reserve = getHealthComponent(health, "reserve");
  const concentration = getHealthComponent(health, "concentration");
  const survival = getHealthComponent(health, "crypto");
  const riskControl = getHealthComponent(health, "futures");
  const discipline = getHealthComponent(health, "flexibility");
  const reserveShare = healthInput.reserveShare ?? healthInput.cashShare;
  const hasReserveBlock = (reserve?.meta?.reserveBlockers?.length ?? 0) > 0 || reserveShare < strategy.reserveFloorShare;
  const hasConcentrationBlock = (concentration?.meta?.overLimitAssets?.length ?? 0) > 0;
  const hasSurvivalBlock = (survival?.meta?.survivalBlockers?.length ?? 0) > 0;
  const hasDisciplineBlock = (discipline?.meta?.disciplineBlockers?.length ?? 0) > 0;
  const plannedUsd = survival?.meta?.plannedLimitOrdersUsd ?? healthInput.plannedLimitOrdersUsd;
  const spotPower = healthInput.spotDeployableUsd ?? portfolio.spotDeployable ?? portfolio.deployableCapital;

  const purchaseBlocked = hasReserveBlock || hasConcentrationBlock || hasSurvivalBlock || hasDisciplineBlock;
  const futuresBlocked = !strategy.futuresAllowed || hasReserveBlock || (riskControl?.score ?? 100) < 55;

  return [
    {
      label: "Покупки",
      value: purchaseBlocked ? "Только через проверку риска" : "Разрешены по лимитам",
      note: purchaseBlocked ? "Сначала устранить блокеры здоровья" : "Каждая покупка всё равно проходит pre-trade проверку",
      tone: purchaseBlocked ? "warn" : "ok",
    },
    {
      label: "Фьючерсы",
      value: futuresBlocked ? "Пауза / сокращение" : "Разрешены внутри лимита",
      note: strategy.futuresAllowed ? `Лимит активной торговли ${pct(strategy.futuresMaxShare)}` : "Стратегия запрещает фьючерсы полностью",
      tone: futuresBlocked ? "bad" : "ok",
    },
    {
      label: "Новый риск",
      value: health.healthFactor >= 75 && !purchaseBlocked ? "Можно дозировано" : "Не добавлять",
      note: health.healthFactor >= 75 ? "Только если не ухудшает худший луч" : "Health ниже зоны контроля",
      tone: health.healthFactor >= 75 && !purchaseBlocked ? "ok" : "bad",
    },
    {
      label: "Лимитные уровни",
      value: spotPower > 0 ? "Можно выставлять" : "Нет свободного лимита",
      note: plannedUsd !== undefined ? `Уже подготовлено ${fmt$(plannedUsd)}` : "План лимитных уровней не подключён",
      tone: spotPower > 0 ? "ok" : "warn",
    },
  ];
}

function buildStressRows(health: PortfolioHealth, portfolio: V2Portfolio) {
  const survival = getHealthComponent(health, "crypto");
  const scenarios = survival?.meta?.survivalScenarios ?? [];
  if (scenarios.length === 0) {
    return [
      {
        name: survival?.meta?.survivalWorstScenario ?? "Стресс-сценарий",
        loss: survival?.meta?.survivalShockLossPct ?? 0,
        lossUsd: survival?.meta?.survivalLossUsd,
      },
    ];
  }

  return scenarios.slice(0, 4).map((scenario) => ({
    name: scenario.name,
    loss: scenario.lossPct,
    lossUsd: scenario.lossUsd ?? scenario.lossPct * portfolio.totalPortfolioValue,
  }));
}

function buildCapitalPowerRows(health: PortfolioHealth, healthInput: HealthInput, portfolio: V2Portfolio) {
  const reserve = getHealthComponent(health, "reserve");
  const meta = reserve?.meta;
  const reserveUsd = meta?.reserveUsd ?? portfolio.stableReserve;
  const floorUsd = meta?.reserveFloorUsd;
  const targetUsd = meta?.reserveTargetUsd;
  const bandMaxUsd = meta?.reserveBandMaxUsd;
  const idleUsd = meta?.reserveIdleUsd ?? 0;
  const targetShortfallUsd = meta?.reserveTargetShortfallUsd ?? 0;
  const spotPower = healthInput.spotDeployableUsd ?? portfolio.spotDeployable ?? portfolio.deployableCapital;
  const futuresPower = healthInput.futuresDeployableUsd ?? portfolio.futuresDeployable;
  const plannedUsd = healthInput.plannedLimitOrdersUsd;

  return [
    {
      label: "Текущий резерв",
      value: fmt$(reserveUsd),
      note: targetUsd && bandMaxUsd ? `рабочий коридор ${fmt$(targetUsd)}-${fmt$(bandMaxUsd)}` : "защитная часть капитала",
      tone: reserve?.score && reserve.score >= 75 ? "ok" : reserve?.score && reserve.score >= 55 ? "warn" : "bad",
    },
    {
      label: "Неприкосновенная часть",
      value: floorUsd !== undefined ? fmt$(floorUsd) : "нет данных",
      note: "ниже этого уровня новые сделки нельзя открывать",
      tone: reserveUsd >= (floorUsd ?? 0) ? "ok" : "bad",
    },
    {
      label: "Свободно для спота",
      value: fmt$(spotPower),
      note: plannedUsd !== undefined ? `лимитные уровни уже занимают ${fmt$(plannedUsd)}` : "уровни не подключены",
      tone: spotPower > 0 ? "ok" : "warn",
    },
    {
      label: "Свободно для активной торговли",
      value: fmt$(futuresPower),
      note: "использовать только после проверки риска",
      tone: futuresPower > 0 ? "warn" : "bad",
    },
    {
      label: idleUsd > 0 ? "Капитал простаивает" : "Дефицит до цели",
      value: idleUsd > 0 ? fmt$(idleUsd) : fmt$(targetShortfallUsd),
      note: idleUsd > 0 ? "часть резерва выше верхнего рабочего коридора" : "сколько не хватает до рабочей цели резерва",
      tone: idleUsd > 0 || targetShortfallUsd > 0 ? "warn" : "ok",
    },
  ];
}

function buildDisciplineRows(health: PortfolioHealth) {
  const discipline = getHealthComponent(health, "flexibility");
  const meta = discipline?.meta;
  const journal = meta?.disciplineJournalCoverage;
  const planConfirmed = meta?.disciplineLimitOrdersConfirmed;
  return [
    {
      label: "Журнал решений",
      value: journal !== undefined ? pct(journal) : "не подключён",
      note: `балл ${meta?.disciplineJournalScore ?? "?"}/100`,
      tone: journal !== undefined && journal >= 0.8 ? "ok" : "warn",
    },
    {
      label: "Нарушения за 30 дней",
      value: meta?.disciplineViolations30d !== undefined ? String(meta.disciplineViolations30d) : "нет данных",
      note: `FOMO ${meta?.fomoEvents30d ?? "?"} · revenge ${meta?.revengeTrades30d ?? "?"} · overtrade ${meta?.overtradingDays30d ?? "?"}`,
      tone: (meta?.disciplineViolations30d ?? 0) > 0 ? "bad" : "ok",
    },
    {
      label: "Дисциплинарная пауза",
      value: meta?.disciplineCooldownActive ? "активна" : "нет",
      note: `блокеры ${meta?.disciplineBlockerScore ?? "?"}/100`,
      tone: meta?.disciplineCooldownActive ? "bad" : "ok",
    },
    {
      label: "План уровней",
      value: meta?.disciplinePlannedOrdersUsd !== undefined ? fmt$(meta.disciplinePlannedOrdersUsd) : "не подключён",
      note: planConfirmed === false
        ? `не подтверждено биржей · балл ${meta?.disciplinePlanScore ?? "?"}/100`
        : `балл плана ${meta?.disciplinePlanScore ?? "?"}/100`,
      tone: planConfirmed === false ? "warn" : (meta?.disciplinePlannedOrdersUsd ?? 0) > 0 ? "ok" : "warn",
    },
  ];
}

function isHealthPageAlert(alert: Alert) {
  return !alert.id.startsWith("signal-") &&
    !alert.id.startsWith("market-psychology-") &&
    alert.id !== "fg-max" &&
    alert.id !== "fg-strong";
}

function recommendationDuplicatesAlert(recommendation: CoreRec, alerts: Alert[]) {
  const ids = alerts.map((alert) => alert.id);
  switch (recommendation.kind) {
    case "reserve":
      return ids.some((id) => id.startsWith("reserve-"));
    case "diversification":
      return ids.includes("health-component-diversification");
    case "concentration":
      return ids.some((id) => id.startsWith("position-over-") || id === "health-component-concentration");
    case "risk":
      return ids.includes("health-component-futures");
    case "survival":
      return ids.includes("health-component-crypto");
    case "discipline":
      return ids.includes("exchange-limit-orders-unconfirmed") || ids.includes("health-component-flexibility");
    default:
      return false;
  }
}

function recommendationAlert(recommendation: CoreRec, index: number): Alert {
  return {
    id: `health-recommendation-${recommendation.kind ?? index}`,
    level: recommendation.critical ? "critical" : "warning",
    title: recommendation.action,
    detail: recommendation.source,
    action: "Проверить в симуляторе",
    priority: 40 + index,
  };
}

// ── Цвет по score ──────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 75) return "#5AEF8D";
  if (s >= 50) return "#55C7FF";
  if (s >= 30) return "#E6B33A";
  return "#FF5D6C";
}

// ── Кольцо-gauge ─────────────────────────────────────────────
function ScoreRing({ value }: { value: number }) {
  return (
    <div className="v2-hp-ring-orb" aria-label={`Оценка здоровья инвестора ${value} из 100`}>
      <img src={portfolioHealthScoreOrb} alt="" />
      <span className="v2-hp-ring-orb-mask" aria-hidden="true" />
      <strong>{value}</strong>
      <span>из 100</span>
    </div>
  );
}

function HealthFactorCard({ c, onClick, empty }: { c: HealthComponent; onClick: () => void; empty?: boolean }) {
  const color = empty ? EMPTY_TONE : scoreColor(c.score);
  return (
    <button className="v2-hp-factor-card" type="button" onClick={onClick}>
      <span>{c.label}</span>
      <strong style={{ color }}>{c.score}</strong>
      <em>вес {Math.round(c.weight * 100)}%</em>
      <i aria-hidden="true"><b style={{ width: `${Math.min(100, c.score)}%`, background: color }} /></i>
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
  fearGreedIndex,
  onOpenGate,
  initialDNAExpanded = false,
  portfolioAlerts = [],
  onPortfolioAlertAction,
  canRunPortfolioAlertAction,
}: Props) {
  const [modal, setModal]   = useState<HealthComponent | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [dnaExpanded, setDnaExpanded] = useState(initialDNAExpanded);
  const [dnaMounted, setDnaMounted] = useState(initialDNAExpanded);
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
  const sortedComponents = useMemo(
    () => [...health.components].sort((a, b) => a.score - b.score),
    [health.components],
  );
  const weakForRecommendations = useMemo(
    () => sortedComponents.filter(isActionableHealthComponent),
    [sortedComponents],
  );
  const recommendations = useMemo(
    () => isEmpty
      ? []
      : buildCoreRecs(weakForRecommendations, portfolio, health.components, healthInput, { fearGreedIndex }),
    [fearGreedIndex, health.components, healthInput, isEmpty, portfolio, weakForRecommendations],
  );

  // ── Симулятор: 6 рычагов поверх реальных входов health ──
  const baseReserve = healthInput.reserveShare ?? healthInput.cashShare;
  const reserveComponent = health.components.find((component) => component.key === "reserve");
  const riskControlComponent = health.components.find((component) => component.key === "futures");
  const reserveBaseUsd = reserveComponent?.meta?.reserveBaseUsd ?? portfolio.totalPortfolioValue;
  const reserveTargetShare = reserveComponent?.meta?.reserveTargetUsd && reserveBaseUsd
    ? reserveComponent.meta.reserveTargetUsd / reserveBaseUsd
    : 0.3;
  const reserveFloorShare = reserveComponent?.meta?.reserveFloorUsd && reserveBaseUsd
    ? reserveComponent.meta.reserveFloorUsd / reserveBaseUsd
    : 0.1;
  const reserveBandMaxShare = reserveComponent?.meta?.reserveBandMaxUsd && reserveBaseUsd
    ? reserveComponent.meta.reserveBandMaxUsd / reserveBaseUsd
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
  const permissionRows = useMemo(
    () => buildPermissionRows(strategy, health, healthInput, portfolio),
    [strategy, health, healthInput, portfolio]
  );
  const stressRows = useMemo(() => buildStressRows(health, portfolio), [health, portfolio]);
  const survivalComponent = getHealthComponent(health, "crypto");
  const survivalMeta = survivalComponent?.meta;
  const plannedLimitOrdersUsd = survivalMeta?.plannedLimitOrdersUsd ?? healthInput.plannedLimitOrdersUsd;
  const worstStressLoss = survivalMeta?.survivalShockLossPct ?? 0;
  const stressPortfolioAfter = survivalMeta?.survivalPortfolioAfterShockUsd;
  const stressBuyPower = survivalMeta?.survivalBuyPowerAfterShockUsd;
  const capitalPowerRows = useMemo(
    () => buildCapitalPowerRows(health, healthInput, portfolio),
    [health, healthInput, portfolio]
  );
  const disciplineRows = useMemo(() => buildDisciplineRows(health), [health]);
  const strategyClassRows = useMemo(() => {
    const metalLabel = strategy.allowedMetalAssets?.every((asset) => ["GOLD", "XAU", "XAUUSD"].includes(asset))
      ? "Золото"
      : "Металлы";
    return [
      { label: "Крипта", value: `до ${pct(strategy.cryptoMaxShare)}` },
      { label: "Резерв · минимум", value: pct(strategy.reserveFloorShare) },
      { label: "Резерв · цель", value: pct(strategy.reserveTargetShare) },
      { label: "Резерв · верх коридора", value: pct(strategy.reserveBandMaxShare) },
      { label: metalLabel, value: `до ${pct(strategy.metalsMaxShare)}` },
      { label: "Акции", value: `до ${pct(strategy.stocksMaxShare)}` },
      { label: "Фьючерсы", value: strategy.futuresAllowed ? `до ${pct(strategy.futuresMaxShare)}` : "запрещены" },
    ];
  }, [strategy]);
  const cryptoLimitRows = useMemo(() => strategyCryptoRows(strategy), [strategy]);
  const visiblePortfolioAlerts = useMemo(
    () => portfolioAlerts.filter(isHealthPageAlert),
    [portfolioAlerts],
  );
  const visibleRecommendations = useMemo(
    () => recommendations.filter((recommendation) => !recommendationDuplicatesAlert(recommendation, visiblePortfolioAlerts)),
    [recommendations, visiblePortfolioAlerts],
  );
  const healthAlerts = useMemo(
    () => sortAlerts([
      ...visiblePortfolioAlerts,
      ...visibleRecommendations.map(recommendationAlert),
    ]),
    [visiblePortfolioAlerts, visibleRecommendations],
  );
  const activeTradingAlertVisible = healthAlerts.some(
    (alert) => alert.id === "health-recommendation-risk" || alert.title.includes("лимит активной торговли"),
  );
  const visiblePermissionRows = activeTradingAlertVisible
    ? permissionRows.filter((row) => row.label !== "Фьючерсы")
    : permissionRows;
  const dnaFigure = dna.accountId === "wife" ? dnaRiskReadinessWife : dnaRiskReadiness;

  const handleHealthAlertAction = (alert: Alert) => {
    if (alert.id.startsWith("health-recommendation-")) {
      resetLevers();
      setSimOpen(true);
      return;
    }
    onPortfolioAlertAction?.(alert);
  };

  const canRunHealthAlertAction = (alert: Alert) =>
    alert.id.startsWith("health-recommendation-") || Boolean(canRunPortfolioAlertAction?.(alert));

  return (
    <div className="v2-hp-page">

      <V2PortfolioAlertsPanel
        portfolio={portfolio}
        alerts={healthAlerts}
        onAction={handleHealthAlertAction}
        canRunAction={canRunHealthAlertAction}
      />

      <section className="v2-hp-command-card" aria-label="Командный диагноз здоровья">
        <div className="v2-hp-command-grid">
          <div className="v2-hp-command-score">
            <div className="v2-hp-score-label">ОЦЕНКА ЗДОРОВЬЯ ИНВЕСТОРА</div>
            <ScoreRing value={hf} />
            <div className="v2-hp-score-interp" style={{ color: interp.color }}>{interp.text}</div>
            <div className="v2-hp-score-sub">{interp.sub}</div>
          </div>

          <div className="v2-hp-command-main">
            <div className="v2-hp-card-title">
              Командный диагноз
              <span className="v2-hp-rx-kicker">что прямо сейчас влияет на решения</span>
            </div>
            {isEmpty ? (
              <div className="v2-hp-empty-note">Нет данных — подключите источники, и страница соберёт оценку здоровья автоматически.</div>
            ) : (
              <>
                <div className="v2-hp-command-verdict" style={{ color: interp.color }}>{interp.text}</div>
                <div className="v2-hp-command-sub">{interp.sub}</div>
                <div className="v2-hp-command-list">
                  {(weak.length ? weak : strong.slice(0, 3)).slice(0, 3).map((item) => (
                    <div key={item.label} className={`v2-hp-diag-row ${weak.length ? "v2-hp-diag-row--warn" : "v2-hp-diag-row--ok"}`}>
                      <span className="v2-hp-diag-icon">{weak.length ? "!" : "✓"}</span>
                      <div>
                        <div className="v2-hp-diag-name">{item.label} <span className="v2-hp-diag-score">{item.score}</span></div>
                        <div className="v2-hp-diag-why">{item.why}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="v2-hp-command-side">
            <div className="v2-hp-card-title">
              Допуск
              <span className="v2-hp-rx-kicker">можно ли действовать</span>
            </div>
            <div className="v2-hp-permission-list">
              {visiblePermissionRows.map((row) => (
                <div key={row.label} className={`v2-hp-permission-row is-${row.tone}`}>
                  <div>
                    <span>{row.label}</span>
                    <em>{row.note}</em>
                  </div>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

      <section className="v2-hp-engine-card" aria-label="Механика здоровья">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">Механика здоровья</div>
            <h2>Почему оценка сейчас {hf}/100</h2>
          </div>
          <span className="v2-hp-policy-badge">вес факторов</span>
        </div>
        <div className="v2-hp-factor-grid">
          {sortedComponents.map((component) => (
            <HealthFactorCard
              key={component.key}
              c={component}
              empty={isEmpty}
              onClick={() => setModal(component)}
            />
          ))}
        </div>
        <div className="v2-hp-brow-hint">Нажмите на строку фактора — откроется подробное объяснение и рекомендации.</div>
      </section>

      <section className="v2-hp-dna-system" aria-label="ДНК инвестора">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">ДНК инвестора</div>
            <h2>Главные ориентиры</h2>
          </div>
          <span className="v2-hp-policy-badge">{dna.investorType}</span>
        </div>
        <div className="v2-hp-dna-summary">
          <div className="v2-hp-dna-copy">
            <span>{dna.riskWillingness.label}</span>
            <strong>{dna.riskWillingness.value}<em>/100</em></strong>
            <p>{dna.riskWillingness.note}</p>
          </div>
          <button
            className="v2-hp-dna-figure"
            type="button"
            aria-expanded={dnaExpanded}
            aria-controls="investor-dna-content"
            onClick={() => {
              setDnaMounted(true);
              setDnaExpanded((current) => !current);
            }}
          >
            <img src={dnaFigure} alt="Фигура ДНК инвестора" />
            <span>{dnaExpanded ? "Свернуть ДНК инвестора" : "Открыть ДНК инвестора"}</span>
          </button>
          <div className="v2-hp-dna-copy is-right">
            <span>{dna.riskCapacity.label}</span>
            <strong>{dna.riskCapacity.value}<em>/100</em></strong>
            <p>{dna.riskCapacity.note}</p>
          </div>
        </div>
        <div className="v2-hp-dna-theses">
          <div>
            <span>Главное правило</span>
            <strong>{dna.keyVerdict}</strong>
          </div>
          <div>
            <span>Ориентир капитала</span>
            <strong>{dna.capitalGoal}</strong>
          </div>
        </div>
      </section>

      {dnaMounted && (
        <div id="investor-dna-content" hidden={!dnaExpanded}>
          <V2InvestorDNAPage
            dna={dna}
            embedded
            onNavigate={onOpenGate ? () => onOpenGate() : undefined}
          />
        </div>
      )}

      <section className="v2-hp-capital-system" aria-label="Капитал и выживаемость">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">Капитал и выживаемость</div>
            <h2>Резерв, покупательная сила и удар рынка</h2>
          </div>
          <span className={`v2-hp-policy-badge is-${healthTone(survivalComponent?.score ?? 0)}`}>
            {survivalMeta?.survivalStatus ?? "нет данных"}
          </span>
        </div>
        <div className="v2-hp-section-grid">
          <div className="v2-hp-passport-list">
            {capitalPowerRows.map((row) => (
              <div key={row.label} className={`v2-hp-passport-row is-${row.tone}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
                <em>{row.note}</em>
              </div>
            ))}
          </div>
          <div className="v2-hp-stress-card">
            <div className={`v2-hp-stress-status is-${healthTone(survivalComponent?.score ?? 0)}`}>
              <strong>{survivalMeta?.survivalStatus ?? "Нет данных"}</strong>
              <span>худший сценарий: {survivalMeta?.survivalWorstScenario ?? "не рассчитан"} · просадка {pct(worstStressLoss)}</span>
            </div>
            <div className="v2-hp-stress-list">
              {stressRows.map((row) => (
                <div key={row.name} className="v2-hp-stress-row">
                  <span>{row.name}</span>
                  <strong>-{pct(row.loss)}</strong>
                  <em>{row.lossUsd !== undefined ? fmt$(row.lossUsd) : "без $"}</em>
                </div>
              ))}
            </div>
            <div className="v2-hp-stress-footer">
              <span>После шока: {stressPortfolioAfter !== undefined ? fmt$(stressPortfolioAfter) : "нет данных"}</span>
              <span>Свободно после шока: {stressBuyPower !== undefined ? fmt$(stressBuyPower) : "нет данных"}</span>
              <span>План buy-уровней: {plannedLimitOrdersUsd !== undefined ? fmt$(plannedLimitOrdersUsd) : "не подключен"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="v2-hp-simulator-entry" aria-label="Симулятор здоровья">
        <div>
          <div className="v2-hp-card-title">Симулятор здоровья</div>
          <h2>Проверить изменение до действия</h2>
          <p>Смоделируйте резерв, концентрацию, диверсификацию и риск. Реальные сделки не выполняются.</p>
        </div>
        <button
          className="v2-hp-sim-btn"
          type="button"
          disabled={isEmpty}
          onClick={() => { resetLevers(); setSimOpen(true); }}
        >
          Открыть симулятор
        </button>
      </section>

      <section className="v2-hp-strategy-system" aria-label="Стратегия и лимиты">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">Стратегия и лимиты</div>
            <h2>{strategy.title}</h2>
          </div>
          <span className="v2-hp-policy-badge">{strategy.allocationLabel}</span>
        </div>
        <div className="v2-hp-section-grid">
          <div className="v2-hp-policy-rows">
            {strategyClassRows.map((row) => (
              <div key={row.label} className="v2-hp-policy-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className="v2-hp-policy-rows">
            {cryptoLimitRows.map((row) => (
              <div key={row.label} className="v2-hp-policy-row">
                <span>{row.label}</span>
                <strong>до {pct(row.value)} внутри крипты</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="v2-hp-psych-system" aria-label="Психология и дисциплина">
        <div className="v2-hp-policy-head">
          <div>
            <div className="v2-hp-card-title">Психология и дисциплина</div>
            <h2>Текущее поведение системы</h2>
          </div>
          <span className="v2-hp-policy-badge">30 дней</span>
        </div>
        <div className="v2-hp-discipline-grid">
          {disciplineRows.map((row) => (
            <div key={row.label} className={`v2-hp-passport-row is-${row.tone}`}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <em>{row.note}</em>
            </div>
          ))}
        </div>
      </section>

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
                <div className="v2-hp-sim-lever-hint">Подключить план buy-уровней на падение в пределах свободных денег после шока</div>
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
