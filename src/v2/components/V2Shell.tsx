import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { V2LabData, V2Page } from "../InvestorCabinetV2Lab";
import { computePortfolioHealth, type HealthComponent, type PortfolioHealth } from "../../lib/portfolioHealth";
import { V2HealthDetailModal } from "./V2HealthDetailModal";
import { V2ReportsPage } from "./V2ReportsPage";
import { V2TradingPage, type TradeCaseSyncState } from "./V2TradingPage";
import { V2ScenariosHubPage } from "./V2ScenariosHubPage";
import { V2DeployableCapital } from "./V2DeployableCapital";
import { V2CapitalLadder } from "./V2CapitalLadder";
import { V2DCAStrategy } from "./V2DCAStrategy";
import { V2PortfolioAllocationCard } from "./V2PortfolioAllocationCard";
import { V2HealthCore } from "./V2HealthCore";
import { V2SettingsPage } from "./V2SettingsPage";
import { V2BtcDailyChart } from "./V2BtcDailyChart";
import { V2TabBar } from "./V2TabBar";

import { V2PortfolioPage } from "./V2PortfolioPage";
import type { TonStaking } from "../../hooks/useTonStaking";
import type { CosmosStaking } from "../../hooks/useCosmosStaking";
import { V2HealthPage } from "./V2HealthPage";
import { V2EducationPage } from "./V2EducationPage";
import { V2AssistantWidget, type AssistantPageContext } from "./V2AssistantWidget";
import { V2NotificationsPanel } from "./V2NotificationsPanel";
import { buildPortfolioAlerts, sortAlerts, type Alert } from "../lib/portfolioAlerts";
import { V2Sidebar } from "./V2Sidebar";
import { V2TopMetrics } from "./V2TopMetrics";
import { V2StarField } from "./V2StarField";
import { useAuth } from "../../hooks/useAuth";
import {
  appendDecisionJournalEntry,
  readDecisionJournal,
  removeDecisionJournalEntry,
  type DecisionJournalDraft,
  type DecisionJournalEntry,
} from "../lib/decisionJournal";
import { evaluateBehavior } from "../lib/behaviorEngine";
import { getMarketPsychology } from "../lib/marketPsychology";
import { buildTradeCandidateFromSignal, type TradeCandidate } from "../lib/tradeCandidate";
import { buildCapitalBuckets } from "../lib/capitalBuckets";
import {
  readTraderJournal,
  upsertTraderJournalEntry,
  type TraderJournalDraft,
  type TraderJournalEntry,
} from "../lib/traderJournal";
import {
  mergeTradeCaseStores,
  readTradeCaseStore,
  tradeCandidateFromTradeCase,
  tradeCaseStoresEqual,
  tradingStepForTradeCase,
  updateTradeCase,
  upsertTradeCaseStore,
  writeTradeCaseStore,
  type TradeCase,
} from "../lib/tradeCase";
import { readCloudTradeCaseStore, upsertCloudTradeCaseStore } from "../../api/tradeCases";
import { buildTradingDataTrust } from "../lib/dataTrust";
import type { DataSyncStatus } from "../../types/dataStatus";

type Props = {
  data: V2LabData;
  page: V2Page;
  onNavigate: (page: V2Page) => void;
  locked?: boolean;
  onOpenAuth: (tab: "signin" | "signup") => void;
  staking?: TonStaking | null;
  cosmosStaking?: CosmosStaking | null;
  dataStatus?: {
    source: "cache" | "fallback" | "live";
    status: DataSyncStatus;
    lastLoadedAt: string | null;
    error: string | null;
    onRefresh: () => void;
  };
};

const DESKTOP_DESIGN_WIDTH = 1920;
const DESKTOP_DESIGN_HEIGHT = 1080;
const MOBILE_BREAKPOINT = 768;
// Геометрия сцены — те же значения, что в .v2-lab (padding / колонка / gap).
const SCENE_PADDING = 18;
const SCENE_GAP = 18;
const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 64;

const PAGE_META: Record<V2Page, { label: string; purpose: string; visibleBlocks: string[] }> = {
  overview: {
    label: "Обзор",
    purpose: "Главный экран состояния портфеля: капитал, резерв, здоровье, распределение, DCA и ключевые рекомендации.",
    visibleBlocks: ["Верхние метрики", "Здоровье портфеля", "Лестница капитала", "Распределение средств", "Стратегия DCA", "Рекомендации"],
  },
  portfolio: {
    label: "Портфель",
    purpose: "Текущие позиции, доли, PnL, статусы активов и соответствие лимитам стратегии.",
    visibleBlocks: ["Позиции", "Активы", "PnL", "Статусы", "Стейкинг"],
  },
  trading: {
    label: "Торговля",
    purpose: "Единый последовательный торговый цикл: идея, проверка риска, наблюдение за ценой, решение, дневник и ожидание результата без автоматического исполнения.",
    visibleBlocks: ["Идея", "Проверка", "Наблюдение", "Решение", "Дневник", "Ожидание"],
  },
  scenarios: {
    label: "Сценарии",
    purpose: "Единый экран плана действий: сценарии активов, условия пересмотра, лимиты и ограничения портфеля.",
    visibleBlocks: ["Сценарии активов", "Action zone", "Invalidation", "Risk engine", "Лимиты"],
  },
  risk: {
    label: "Сценарии · Риск",
    purpose: "Совместимый вход в раздел риска внутри вкладки «Сценарии»: лимиты, запреты и концентрация портфеля.",
    visibleBlocks: ["Сценарии активов", "Risk engine", "Лимиты", "Health", "Концентрация"],
  },
  reports: {
    label: "Отчёты",
    purpose: "История портфеля, журнал решений, история сделок и поведенческая дисциплина.",
    visibleBlocks: ["Сводка периода", "История портфеля", "Журнал решений", "История сделок", "Поведение"],
  },
  signals: {
    label: "Торговля · Наблюдение",
    purpose: "Совместимый вход в сигналы и ценовые алерты внутри последовательного торгового цикла.",
    visibleBlocks: ["Сигналы", "Алерты", "Risk checks", "Кандидаты сделок"],
  },
  settings: {
    label: "Настройки",
    purpose: "Локальные настройки профиля и отображения кабинета.",
    visibleBlocks: ["Профиль", "Имя", "Аватар"],
  },
  health: {
    label: "Здоровье",
    purpose: "Подробная расшифровка здоровья портфеля и ДНК инвестора: общий показатель, компоненты, правила стратегии, личный профиль, анкеты и ограничения.",
    visibleBlocks: ["Показатель здоровья", "Компоненты здоровья", "Правила стратегии", "ДНК инвестора", "Анкеты", "Ограничения"],
  },
  gate: {
    label: "Торговля · Проверка",
    purpose: "Совместимый вход в pre-trade risk gate внутри последовательного торгового цикла.",
    visibleBlocks: ["Проверка сделки", "Risk gate", "Журнал решения", "Блокировки"],
  },
  dna: {
    label: "Здоровье · ДНК",
    purpose: "Внутренний совместимый маршрут к раскрытому разделу ДНК во вкладке «Здоровье».",
    visibleBlocks: ["Здоровье портфеля", "Портрет инвестора", "Ответы ДНК", "Профиль риска", "Рекомендации"],
  },
  education: {
    label: "Обучение",
    purpose: "Учебная структура Investor Cabinet и темы для развития инвестиционной дисциплины.",
    visibleBlocks: ["Учебные главы", "Темы", "Материалы"],
  },
};

const HEALTH_PAGE_GUIDE = {
  source: "V2HealthPage visible structure",
  purpose: "Вкладка «Здоровье» объясняет, почему портфель находится в текущем состоянии, какие правила стратегии действуют и что нужно проверить перед любым новым риском.",
  answerRule: "Если пользователь спрашивает про вкладку/страницу «Здоровье», сначала объясняй назначение страницы и видимые разделы. Не делай полный расчет здоровья, если пользователь прямо не спрашивает почему здоровье такое или просит подробный разбор компонентов.",
  visibleSections: [
    {
      title: "Оценка здоровья инвестора",
      meaning: "общий показатель здоровья портфеля и текущий диагноз",
    },
    {
      title: "Диагноз",
      meaning: "короткий вывод, сильные и слабые стороны портфеля",
    },
    {
      title: "Рекомендации",
      meaning: "что может улучшить здоровье, без автоматического исполнения действий",
    },
    {
      title: "Цель капитала",
      meaning: "лестница капитала и прогресс до следующей ступени",
    },
    {
      title: "Инвестиционная стратегия",
      meaning: "базовая структура 60/10/10/10/10, лимиты классов и лимиты внутри крипто-блока",
    },
    {
      title: "Жёсткие ограничения",
      meaning: "что портфелю запрещено по стратегии",
    },
    {
      title: "Лучи здоровья",
      meaning: "какие компоненты формируют общий показатель здоровья",
    },
    {
      title: "ДНК инвестора",
      meaning: "что подходит пользователю как типу инвестора, отдельно от стратегии портфеля",
    },
    {
      title: "Разбор здоровья",
      meaning: "строки компонентов здоровья; подробности нужны только если пользователь просит разбор",
    },
    {
      title: "Симулятор здоровья",
      meaning: "гипотетическая проверка сценария, сделки не выполняет",
    },
  ],
};

const DCA_MODE_LABELS: Record<string, string> = {
  observation: "Наблюдаем",
  cautious: "Покупка на 1%",
  strong: "Покупка на 1.5%",
  aggressive: "Покупка на 2%",
};

const DCA_STATE_LABELS: Record<string, string> = {
  active: "активная зона",
  passive: "ожидание",
  cooldown: "пауза после покупки",
};

function getDesktopViewport() {
  if (window.innerWidth <= MOBILE_BREAKPOINT) {
    return { scale: 1, logicalHeight: window.innerHeight, offsetX: 0 };
  }

  // Museum canvas: one fixed 1920x1080 composition. Every desktop viewport sees
  // the same scene, scaled as a whole and centered with controlled side fields.
  const scale = Math.min(
    window.innerWidth / DESKTOP_DESIGN_WIDTH,
    window.innerHeight / DESKTOP_DESIGN_HEIGHT,
  );
  const offsetX = Math.max(0, (window.innerWidth - DESKTOP_DESIGN_WIDTH * scale) / 2);

  return {
    scale,
    logicalHeight: Math.max(DESKTOP_DESIGN_HEIGHT, window.innerHeight / scale),
    offsetX,
  };
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function historyDateKey(rawDate: string) {
  const trimmed = rawDate.trim();
  const ruDate = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (ruDate) {
    const [, day, month, year] = ruDate;
    return `${year}-${month}-${day}`;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return "";
  return localDateKey(new Date(parsed));
}

function historyTime(rawDate: string) {
  const key = historyDateKey(rawDate);
  return key ? Date.parse(`${key}T00:00:00`) : 0;
}

function previousDateKey(todayKey: string) {
  const parsed = Date.parse(`${todayKey}T00:00:00`);
  if (!Number.isFinite(parsed)) return "";
  const prev = new Date(parsed - 24 * 60 * 60 * 1000);
  return localDateKey(prev);
}

function findPreviousDailySnapshot(history: V2LabData["history"], todayKey: string) {
  const targetKey = previousDateKey(todayKey);
  return [...history]
    .filter((point) => point.portfolioValue > 0 && historyDateKey(point.date) === targetKey)
    .sort((a, b) => historyTime(a.date) - historyTime(b.date))
    .at(-1) ?? null;
}

function DataStatusBadge({ dataStatus }: { dataStatus: NonNullable<Props["dataStatus"]> }) {
  const { source, status, lastLoadedAt, error, onRefresh } = dataStatus;
  let tone = "is-live";
  let label = "ЖИВЫЕ";
  if (error && source === "fallback") { tone = "is-error"; label = "ОШИБКА"; }
  else if (status === "stale" || (error && source !== "fallback")) { tone = "is-stale"; label = "УСТАРЕЛО"; }
  else if (status === "refreshing") { tone = "is-refreshing"; label = "ОБНОВЛЯЕТСЯ"; }
  else if (source === "cache") { tone = "is-cache"; label = "КЭШ"; }
  else if (source === "fallback") { tone = "is-cache"; label = "ДЕМО"; }
  const isCompactLive = tone === "is-live";

  const time = lastLoadedAt
    ? new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastLoadedAt))
    : null;

  return (
    <div
      className={`v2-datastatus ${tone}${isCompactLive ? " is-compact" : ""}`}
      title={error ?? `Источник: ${source} · ${status}`}
    >
      <span className="v2-datastatus-dot" />
      {!isCompactLive && <span className="v2-datastatus-label">{label}</span>}
      {time && <span className="v2-datastatus-time">{time}</span>}
      <button
        className="v2-datastatus-refresh"
        type="button"
        onClick={onRefresh}
        aria-label="Обновить данные"
        title="Обновить данные"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M12.7 5.2A5 5 0 1 0 13 8h-1.4A3.6 3.6 0 1 1 11.4 6H9.5V4.6h4.2v4.2h-1.4V6.2a4.7 4.7 0 0 0 .4-1Z" />
        </svg>
      </button>
    </div>
  );
}

function buildAssistantPageContext({
  page,
  data,
  portfolio,
  health,
  healthInput,
  behavior,
  decisionJournal,
  alerts,
  marketPsychology,
  staking,
  cosmosStaking,
}: {
  page: V2Page;
  data: V2LabData;
  portfolio: V2LabData["portfolio"];
  health: PortfolioHealth;
  healthInput: V2LabData["healthInput"];
  behavior: ReturnType<typeof evaluateBehavior>;
  decisionJournal: DecisionJournalEntry[];
  alerts: Alert[];
  marketPsychology: ReturnType<typeof getMarketPsychology>;
  staking?: TonStaking | null;
  cosmosStaking?: CosmosStaking | null;
}): AssistantPageContext {
  const meta = PAGE_META[page];
  const previousDailySnapshot = findPreviousDailySnapshot(data.history, localDateKey(new Date()));
  const dailyPnlUsd = previousDailySnapshot
    ? portfolio.totalPortfolioValue - previousDailySnapshot.portfolioValue
    : null;
  const dailyPnlPct =
    dailyPnlUsd != null && previousDailySnapshot && previousDailySnapshot.portfolioValue > 0
      ? (dailyPnlUsd / previousDailySnapshot.portfolioValue) * 100
      : null;
  const dailyPnl = {
    source: "V2PortfolioPage visible P&L 24H formula",
    isAvailable: dailyPnlUsd != null,
    pnlUsd: dailyPnlUsd,
    pnlPct: dailyPnlPct,
    previousSnapshotDate: previousDailySnapshot?.date ?? null,
    previousPortfolioValue: previousDailySnapshot?.portfolioValue ?? null,
    rule: "Это дневное изменение к предыдущему дневному снимку; не путать с общим P&L.",
  };
  const fearGreed = {
    source: "fearGreedStrategy",
    currentIndex: data.fearGreedStrategy.currentIndex,
    mode: data.fearGreedStrategy.currentMode,
    currentZone: DCA_MODE_LABELS[data.fearGreedStrategy.currentMode] ?? data.fearGreedStrategy.currentMode,
    marketMood: data.market.marketMood,
  };
  const baseFacts = {
    accountStrategy: data.strategy.id,
    healthFactor: Math.round(health.healthFactor),
    healthState: health.riskLevel,
    portfolioValue: portfolio.totalPortfolioValue,
    invested: portfolio.totalInvested,
    pnlUsd: portfolio.pnlUsd,
    pnlPct: portfolio.pnlPct,
    reserveUsd: portfolio.stableReserve,
    reserveShare: portfolio.reserveShare,
    positionsCount: portfolio.positionsCount,
    dailyPnl,
    fearGreed,
  };
  const topPositions = data.positions
    .filter((position) => position.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((position) => ({
      asset: position.asset,
      category: position.category,
      value: position.value,
      share: position.share,
      pnl: position.pnl,
      pnlPct: position.pnlPct,
    }));
  const portfolioPagePositions = data.positions
    .filter((position) => position.category !== "Свободные деньги" && position.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
    .map((position) => {
      const isTonStaked = Boolean(staking && position.asset === "TON");
      const isAtomStaked = Boolean(cosmosStaking && position.asset === "ATOM");

      return {
        asset: position.asset,
        category: position.category,
        value: position.value,
        invested: position.invested,
        share: position.share,
        pnl: position.pnl,
        pnlPct: position.pnlPct,
        staking: isTonStaked
          ? {
              isStaked: true,
              label: "в стейке",
              source: "Tonstakers / tsTON",
              stakedAsset: "TON",
              stakedAmount: staking!.stakedTon,
              stakedValueUsd: staking!.stakedUsd,
              dailyIncomeAsset: staking!.dailyTon,
              dailyIncomeUsd: staking!.dailyUsd,
              apy: staking!.apy,
            }
          : isAtomStaked
            ? {
                isStaked: true,
                label: "в стейке",
                source: `Cosmos Hub / ${cosmosStaking!.validatorName}`,
                stakedAsset: "ATOM",
                stakedAmount: cosmosStaking!.staked,
                stakedValueUsd: cosmosStaking!.stakedUsd,
                dailyIncomeAsset: cosmosStaking!.dailyAtom,
                dailyIncomeUsd: cosmosStaking!.dailyUsd,
                apr: cosmosStaking!.apr,
                claimableAsset: cosmosStaking!.claimable,
                claimableUsd: cosmosStaking!.claimableUsd,
              }
            : { isStaked: false },
      };
    });
  const portfolioPageCash = data.positions
    .filter((position) => position.category === "Свободные деньги" && position.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((position) => ({
      asset: position.asset,
      value: position.value,
      share: position.share,
      role: position.asset.includes("HL")
        ? "свободная HL-маржа для фьючерсов; не считать обычным спот-активом"
        : "резерв/стейбл для спота или общего резерва; не считать инвестиционным активом",
    }));
  const capitalBuckets = buildCapitalBuckets({
    totalPortfolioValue: portfolio.totalPortfolioValue,
    investedCapital: portfolio.totalInvested,
    stableReserve: portfolio.stableReserve,
    allocation: data.allocation,
    strategyRules: data.fearGreedStrategy.rules,
    futuresDeployableUsd: portfolio.futuresDeployable,
    futuresUsedUsd: healthInput.futuresShare * portfolio.totalInvested,
  });
  const spotDoborBudgetUsd = Math.max(0, Math.min(capitalBuckets.spotBudgetUsd, portfolio.spotDeployable));
  const deployableCapitalBreakdown = {
    source: "V2DeployableCapital visible formula",
    meaning: "Спот в ручном доборе считается отдельно от ДСА и отдельно от свободной HL-маржи.",
    freeCashUsd: capitalBuckets.freeCashUsd,
    lockedReserveUsd: capitalBuckets.lockedReserveUsd,
    workCashUsd: capitalBuckets.workCashUsd,
    dcaAveragingBudgetUsd: capitalBuckets.averagingBudgetUsd,
    spotDeployableCashUsd: portfolio.spotDeployable,
    spotDoborBudgetUsd,
    futuresFreeMarginUsd: portfolio.futuresDeployable,
    rule: "Для вопроса 'сколько можно в спот добор сейчас' используй spotDoborBudgetUsd, а не spotBudgetUsd.",
  };
  const dcaStrategyFacts = {
    source: "V2DCAStrategy / fearGreedStrategy",
    name: "Стратегия по индексу страха и жадности",
    currentIndex: data.fearGreedStrategy.currentIndex,
    currentZone: DCA_MODE_LABELS[data.fearGreedStrategy.currentMode] ?? data.fearGreedStrategy.currentMode,
    principle: "Покупаем только в зоне страха, раз в неделю, фиксированным процентом от вложенного капитала. При жадности 50-100 включается анти-FOMO пауза: не догонять рост, свободные деньги считать правом ждать, а не ошибкой.",
    rules: data.fearGreedStrategy.rules.map((rule) => ({
      zone: DCA_MODE_LABELS[rule.mode] ?? rule.label,
      indexRange: rule.range,
      buyPercentOfInvestedCapital: rule.buyPct,
      buyPercentLabel: `${Number((rule.buyPct * 100).toFixed(2))}%`,
      buyAmountUsd: rule.buyAmount,
      cooldownDays: rule.cooldownDays,
      isCurrent: rule.isCurrent,
      state: DCA_STATE_LABELS[rule.status] ?? "",
    })),
    wordingRule: "Объясняй DCA по-русски: индекс 20-29 = покупка на 1%, 15-19 = 1.5%, 0-14 = 2%, 30-100 = наблюдаем. При 50-100 сначала сними FOMO: прибыль уже зафиксирована, резерв дает опциональность, новая покупка только в страхе. Не используй слова cautious, balanced, risk-gate, blockers.",
  };
  const visibleHealthComponents = health.components.map((component) => ({
    key: component.v2Key ?? component.key,
    label: component.label,
    score: component.score,
    weight: component.weight,
    desc: component.desc,
    blockers: component.meta?.reserveBlockers
      ?? component.meta?.survivalBlockers
      ?? component.meta?.riskControlBlockers
      ?? component.meta?.concentrationBlockers
      ?? component.meta?.diversificationBlockers
      ?? component.meta?.disciplineBlockers
      ?? [],
    warnings: component.meta?.reserveWarnings
      ?? component.meta?.survivalWarnings
      ?? component.meta?.riskControlWarnings
      ?? component.meta?.concentrationWarnings
      ?? component.meta?.diversificationWarnings
      ?? component.meta?.disciplineWarnings
      ?? [],
  }));
  const factsByPage: Partial<Record<V2Page, Record<string, unknown>>> = {
    overview: {
      ...baseFacts,
      visibleHealthComponents,
      deployableCapitalBreakdown,
      dcaStrategy: dcaStrategyFacts,
      allocation: data.allocation,
      recommendations: alerts.slice(0, 5).map((alert) => ({
        level: alert.level,
        title: alert.title,
        detail: alert.detail,
        action: alert.action,
      })),
      fearGreed,
    },
    portfolio: {
      ...baseFacts,
      visibleInvestmentPositions: portfolioPagePositions,
      cashAndReserveRows: portfolioPageCash,
      visiblePositionsCount: portfolioPagePositions.length,
      cashRowsAreNotInvestmentAssets: true,
      realizedPnlUsd: portfolio.realizedPnlUsd,
      realizedPnlPct: portfolio.realizedPnlPct,
      answerRule: "Если пользователь спрашивает 'какие активы в портфеле', сначала перечисляй visibleInvestmentPositions. Если спрашивает про стейкинг, используй visibleInvestmentPositions[].staking и называй только активы с staking.isStaked=true. Стейблы из cashAndReserveRows называй резервом/кэшем отдельно, а не активами портфеля.",
    },
    health: {
      ...baseFacts,
      pageGuide: HEALTH_PAGE_GUIDE,
      visibleHealthComponents,
      components: visibleHealthComponents,
      healthInput,
    },
    risk: {
      ...baseFacts,
      risk: data.risk,
      allocation: data.allocation,
      healthInput,
      alerts: alerts.slice(0, 8).map((alert) => ({
        level: alert.level,
        title: alert.title,
        detail: alert.detail,
        action: alert.action,
      })),
    },
    reports: {
      ...baseFacts,
      historySummary: {
        points: data.history.length,
        latest: data.history[0],
        recent: data.history.slice(0, 8),
      },
      behavior: {
        score: behavior.score,
        status: behavior.status,
        stats: behavior.stats,
        blockers: behavior.blockers,
        warnings: behavior.warnings,
        signals: behavior.signals.slice(0, 4),
      },
      decisionJournal: decisionJournal.slice(0, 8),
      transactions: data.transactions.slice(0, 10),
      realizedPnlUsd: portfolio.realizedPnlUsd,
    },
    scenarios: {
      positions: topPositions,
      playbook: data.playbook.slice(0, 8),
      scenarios: data.scenarios.slice(0, 8),
      decisions: data.decisions.slice(0, 8),
    },
    signals: {
      alerts: alerts.slice(0, 10),
      interestSignals: data.signals?.interestList?.slice(0, 12) ?? [],
      marketPsychology,
      fearGreed: data.fearGreedStrategy,
    },
    gate: {
      ...baseFacts,
      healthInput,
      strategy: data.strategy,
      profile: data.profile,
      behaviorBlockers: behavior.blockers,
      behaviorWarnings: behavior.warnings,
    },
    dna: {
      profile: data.profile,
      dna: data.dna,
      strategy: data.strategy,
    },
    education: {
      sections: PAGE_META.education.visibleBlocks,
      note: "Учебная вкладка пока является структурой для будущего наполнения.",
    },
    settings: {
      note: "Настройки профиля являются локальными UI-настройками и не меняют портфельные данные.",
    },
  };

  return {
    id: page,
    label: meta.label,
    purpose: meta.purpose,
    visibleBlocks: meta.visibleBlocks,
    facts: factsByPage[page] ?? baseFacts,
  };
}

export function V2Shell({ data, page, onNavigate, locked = false, onOpenAuth, staking, cosmosStaking, dataStatus }: Props) {
  const { user, displayName } = useAuth();
  // Профиль (имя/аватар) храним отдельно на каждый аккаунт — чтобы аватар и имя
  // одного пользователя не показывались другому на том же устройстве.
  const profileKeySuffix = user ? `:${user.id}` : "";
  const nameKey   = `mushii-profile-name${profileKeySuffix}`;
  const avatarKey = `mushii-profile-avatar${profileKeySuffix}`;
  const [profileName,   setProfileName]   = useState(() => localStorage.getItem(nameKey)   ?? "");
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem(avatarKey) ?? "");
  const [decisionJournal, setDecisionJournal] = useState<DecisionJournalEntry[]>(() =>
    readDecisionJournal(profileKeySuffix),
  );
  const [traderJournal, setTraderJournal] = useState<TraderJournalEntry[]>(() =>
    readTraderJournal(profileKeySuffix),
  );
  const [tradeCaseStore, setTradeCaseStore] = useState(() =>
    readTradeCaseStore(profileKeySuffix),
  );
  const tradeCaseStoreRef = useRef(tradeCaseStore);
  const tradeCaseSyncRequestRef = useRef(0);
  const [tradeCaseSyncState, setTradeCaseSyncState] = useState<TradeCaseSyncState>(
    user ? "syncing" : "local",
  );
  const [tradeCandidate, setTradeCandidate] = useState<TradeCandidate | null>(null);

  // При смене аккаунта подгружаем его профиль (или пустой у нового пользователя).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синк профиля из localStorage при смене аккаунта
    setProfileName(localStorage.getItem(nameKey)   ?? "");
    setProfileAvatar(localStorage.getItem(avatarKey) ?? "");
    setDecisionJournal(readDecisionJournal(profileKeySuffix));
    setTraderJournal(readTraderJournal(profileKeySuffix));
    const localTradeCaseStore = readTradeCaseStore(profileKeySuffix);
    tradeCaseStoreRef.current = localTradeCaseStore;
    setTradeCaseStore(localTradeCaseStore);
    setTradeCaseSyncState(user ? "syncing" : "local");
    setTradeCandidate(null);
  }, [nameKey, avatarKey, profileKeySuffix, user]);
  const [selectedChip, setSelectedChip] = useState<HealthComponent | null>(null);
  const [capitalOpen, setCapitalOpen] = useState(false);
  const [desktopViewport, setDesktopViewport] = useState(getDesktopViewport);
  const labRef = useRef<HTMLDivElement | null>(null);
  const [canvasContentHeight, setCanvasContentHeight] = useState(DESKTOP_DESIGN_HEIGHT);
  const activeTradeCase = useMemo(
    () => tradeCaseStore.cases.find((item) => item.tradeCaseId === tradeCaseStore.activeTradeCaseId) ?? null,
    [tradeCaseStore],
  );
  const effectiveTradeCandidate = useMemo(
    () => tradeCandidate ?? (activeTradeCase ? tradeCandidateFromTradeCase(activeTradeCase) : null),
    [tradeCandidate, activeTradeCase],
  );
  const activeSignal = useMemo(() => {
    const sourceId = effectiveTradeCandidate?.sourceId;
    if (!sourceId) return null;
    return data.signals.interestList.find((signal) => signal.id === sourceId)
      ?? (data.signals.interest?.id === sourceId ? data.signals.interest : null);
  }, [data.signals.interest, data.signals.interestList, effectiveTradeCandidate?.sourceId]);
  const tradingDataTrust = useMemo(
    () => buildTradingDataTrust({
      accountId: data.strategy.id,
      portfolioStatus: dataStatus
        ? {
            source: dataStatus.source,
            status: dataStatus.status,
            lastLoadedAt: dataStatus.lastLoadedAt,
            error: dataStatus.error,
          }
        : null,
      portfolioUpdatedAt: data.updatedAt,
      signal: activeSignal,
      expectsSignal: effectiveTradeCandidate?.source === "limit_order",
    }),
    [activeSignal, data.strategy.id, data.updatedAt, dataStatus, effectiveTradeCandidate?.source],
  );
  const tradeCaseIdByTransaction = useMemo(
    () => Object.fromEntries(
      tradeCaseStore.cases
        .filter((item) => item.transactionId)
        .map((item) => [item.transactionId as string, item.tradeCaseId]),
    ),
    [tradeCaseStore.cases],
  );

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let cancelled = false;
    const requestId = ++tradeCaseSyncRequestRef.current;

    void readCloudTradeCaseStore(data.strategy.id)
      .then(async (cloudStore) => {
        if (cancelled || requestId !== tradeCaseSyncRequestRef.current) return;
        const latestLocal = readTradeCaseStore(profileKeySuffix);
        const merged = mergeTradeCaseStores(cloudStore, latestLocal);
        const synchronized = tradeCaseStoresEqual(merged, cloudStore)
          ? cloudStore
          : await upsertCloudTradeCaseStore(data.strategy.id, merged);
        if (cancelled || requestId !== tradeCaseSyncRequestRef.current) return;
        const persisted = writeTradeCaseStore(synchronized, profileKeySuffix);
        tradeCaseStoreRef.current = persisted;
        setTradeCaseStore(persisted);
        const active = persisted.cases.find((item) => item.tradeCaseId === persisted.activeTradeCaseId) ?? null;
        setTradeCandidate(active ? tradeCandidateFromTradeCase(active) : null);
        setTradeCaseSyncState("synced");
      })
      .catch(() => {
        if (!cancelled && requestId === tradeCaseSyncRequestRef.current) {
          setTradeCaseSyncState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [data.strategy.id, profileKeySuffix, user]);

  useEffect(() => {
    const updateViewport = () => {
      setDesktopViewport(prev => {
        const next = getDesktopViewport();
        // iOS Safari шлёт resize на каждом кадре скролла (сворачивание
        // адресной строки меняет innerHeight). Обновление стейта здесь
        // перерисовывало весь shell и заставляло нижний таб-бар «плыть».
        // Дёргаем стейт только когда изменение реально значимо.
        if (next.scale === prev.scale && window.innerWidth <= MOBILE_BREAKPOINT) return prev;
        if (next.scale === prev.scale && Math.abs(next.logicalHeight - prev.logicalHeight) < 0.5) return prev;
        return next;
      });
    };
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    labRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [page]);

  function handleSaveProfile(name: string, avatar: string) {
    setProfileName(name);
    setProfileAvatar(avatar);
    localStorage.setItem(nameKey,   name);
    localStorage.setItem(avatarKey, avatar);
  }

  function handleSaveDecision(draft: DecisionJournalDraft) {
    setDecisionJournal((current) => appendDecisionJournalEntry(current, draft, profileKeySuffix));
  }

  function handleOpenTradeCandidate(candidate: TradeCandidate) {
    setTradeCandidate(candidate);
  }

  function queueTradeCaseCloudSync(store: ReturnType<typeof writeTradeCaseStore>) {
    if (!user) {
      setTradeCaseSyncState("local");
      return;
    }

    const requestId = ++tradeCaseSyncRequestRef.current;
    setTradeCaseSyncState("syncing");
    void upsertCloudTradeCaseStore(data.strategy.id, store)
      .then((cloudStore) => {
        if (requestId !== tradeCaseSyncRequestRef.current) return;
        const latestLocal = readTradeCaseStore(profileKeySuffix);
        const merged = mergeTradeCaseStores(cloudStore, latestLocal);
        const persisted = writeTradeCaseStore(merged, profileKeySuffix);
        tradeCaseStoreRef.current = persisted;
        setTradeCaseStore(persisted);
        setTradeCaseSyncState("synced");
      })
      .catch(() => {
        if (requestId === tradeCaseSyncRequestRef.current) {
          setTradeCaseSyncState("error");
        }
      });
  }

  function persistTradeCaseStore(store: ReturnType<typeof writeTradeCaseStore>) {
    const persisted = writeTradeCaseStore(store, profileKeySuffix);
    tradeCaseStoreRef.current = persisted;
    setTradeCaseStore(persisted);
    queueTradeCaseCloudSync(persisted);
    return persisted;
  }

  function handleSaveTradeCase(tradeCase: TradeCase, activate = true) {
    if (activate) setTradeCandidate(tradeCandidateFromTradeCase(tradeCase));
    persistTradeCaseStore(
      upsertTradeCaseStore(tradeCaseStoreRef.current, tradeCase, activate),
    );
  }

  function handleDeleteDecision(id: string) {
    setDecisionJournal((current) => removeDecisionJournalEntry(current, id, profileKeySuffix));
  }

  function handleSaveTradeReview(draft: TraderJournalDraft) {
    setTraderJournal((current) => upsertTraderJournalEntry(current, draft, profileKeySuffix));
    if (draft.tradeCaseId) {
      const current = tradeCaseStoreRef.current;
      const tradeCase = current.cases.find((item) => item.tradeCaseId === draft.tradeCaseId);
      if (!tradeCase) return;
      const reviewed = updateTradeCase(tradeCase, {
        status: "REVIEWED",
        reviewedAt: new Date().toISOString(),
        transactionId: draft.transactionId,
      });
      persistTradeCaseStore(upsertTradeCaseStore(current, reviewed, true));
    }
  }

  const marketPsychology = useMemo(
    () => getMarketPsychology(data.fearGreedStrategy.currentIndex, data.fearGreedStrategy.history),
    [data.fearGreedStrategy.currentIndex, data.fearGreedStrategy.history],
  );
  const behavior = useMemo(
    () => evaluateBehavior(decisionJournal, new Date(), marketPsychology),
    [decisionJournal, marketPsychology],
  );
  const behaviorHealthInput = useMemo(
    () => ({
      ...data.healthInput,
      ...behavior.healthInputs,
    }),
    [data.healthInput, behavior.healthInputs],
  );
  const behaviorHealth = useMemo<PortfolioHealth>(() => {
    const computed = computePortfolioHealth(behaviorHealthInput);
    return {
      ...computed,
      healthFactor: Math.round(computed.healthFactor),
    };
  }, [behaviorHealthInput]);
  const behaviorPortfolio = useMemo(
    () => ({
      ...data.portfolio,
      healthFactor: Math.round(behaviorHealth.healthFactor),
      healthStatus: behaviorHealth.status,
      riskLevel: behaviorHealth.riskLevel,
    }),
    [data.portfolio, behaviorHealth],
  );

  // Мобильное меню-шторка: на ≤768px сайдбар (все 8 страниц + Выход) скрыт,
  // а гамбургер его выдвигает. Навигация закрывает шторку.
  const [menuOpen, setMenuOpen] = useState(false);
  const handleNavigate = (p: V2Page) => {
    onNavigate(p);
    setMenuOpen(false);
  };

  const [notifOpen, setNotifOpen] = useState(false);

  // Свёрнутый сайдбар запоминаем: это осознанный выбор рабочего режима,
  // а не разовое действие.
  const collapseKey = "mushii-sidebar-collapsed";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(collapseKey) === "1"
  );

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      localStorage.setItem(collapseKey, prev ? "0" : "1");
      return !prev;
    });
  };

  useLayoutEffect(() => {
    const node = labRef.current;
    if (!node || window.innerWidth <= MOBILE_BREAKPOINT) return undefined;

    const measure = () => {
      const nextHeight = Math.max(DESKTOP_DESIGN_HEIGHT, Math.ceil(node.scrollHeight));
      setCanvasContentHeight((current) => current === nextHeight ? current : nextHeight);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, sidebarCollapsed, selectedChip]);

  // Health Factor с прошлого захода — чтобы поймать его просадку.
  // Читаем один раз при монтировании, перезаписываем уже после сравнения.
  const healthKey = `mushii-last-health${profileKeySuffix}`;
  const [previousHealthFactor] = useState<number | null>(() => {
    const raw = localStorage.getItem(healthKey);
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  });

  useEffect(() => {
    const hf = behaviorHealth.healthFactor;
    if (typeof hf === "number" && Number.isFinite(hf)) {
      localStorage.setItem(healthKey, String(hf));
    }
  }, [healthKey, behaviorHealth.healthFactor]);

  // Тревоги считаются тем же движком, что и на странице «Здоровье»,
  // иначе счётчик на колокольчике расходился бы со списком.
  const alerts = useMemo(
    () =>
      sortAlerts(
        buildPortfolioAlerts({
          portfolio: behaviorPortfolio,
          positions: data.positions,
          allocation: data.allocation,
          currentFG: data.fearGreedStrategy.currentIndex,
          health: behaviorHealth,
          interestSignals: data.signals?.interestList ?? [],
          marketPsychology,
          signalNotification: {
            disciplineCooldownActive: behavior.healthInputs.disciplineCooldownActive,
          },
          previousHealthFactor,
          strategy: data.strategy,
        })
      ),
    [behaviorPortfolio, data.positions, data.allocation, data.fearGreedStrategy.currentIndex, marketPsychology, behaviorHealth, data.signals, behavior.healthInputs.disciplineCooldownActive, previousHealthFactor, data.strategy]
  );

  const criticalCount = alerts.filter((alert) => alert.level === "critical").length;
  const assistantPageContext = useMemo(
    () => buildAssistantPageContext({
      page,
      data,
      portfolio: behaviorPortfolio,
      health: behaviorHealth,
      healthInput: behaviorHealthInput,
      behavior,
      decisionJournal,
      alerts,
      marketPsychology,
      staking,
      cosmosStaking,
    }),
    [page, data, behaviorPortfolio, behaviorHealth, behaviorHealthInput, behavior, decisionJournal, alerts, marketPsychology, staking, cosmosStaking],
  );

  function signalFromAlert(alert: Alert) {
    const signals = data.signals?.interestList ?? [];
    const prefixes = ["signal-triggered-", "signal-near-"];
    const prefix = prefixes.find((item) => alert.id.startsWith(item));
    if (!prefix) return null;
    const id = alert.id.slice(prefix.length);
    return signals.find((signal) => signal.id === id) ?? null;
  }

  function handleAlertAction(alert: Alert) {
    setNotifOpen(false);

    if (alert.action === "Открыть проверку риска") {
      const signal = signalFromAlert(alert);
      const candidate = signal ? buildTradeCandidateFromSignal(signal, data.positions) : null;
      if (candidate) {
        handleOpenTradeCandidate(candidate);
      }
      handleNavigate("gate");
      return;
    }

    if (alert.action?.toLocaleLowerCase("ru-RU").includes("открыть разбор здоровья")) {
      handleNavigate("health");
      return;
    }

    if (alert.action === "Открыть стратегию") {
      handleNavigate("health");
      return;
    }

    if (alert.action === "Пополнить резерв" || alert.action === "Срочно пополнить") {
      setCapitalOpen(true);
      handleNavigate("overview");
      return;
    }

    if (alert.action === "Поставить лимитки вручную") {
      handleNavigate("trading");
      return;
    }

    if (alert.action === "Сократить позицию") {
      handleNavigate("portfolio");
      return;
    }

    if (alert.action === "Новый альт — только вместо старого") {
      handleNavigate("gate");
    }
  }

  const canHandleAlertAction = (alert: Alert) =>
    alert.action === "Открыть проверку риска" ||
    Boolean(alert.action?.toLocaleLowerCase("ru-RU").includes("открыть разбор здоровья")) ||
    alert.action === "Открыть стратегию" ||
    alert.action === "Пополнить резерв" ||
    alert.action === "Срочно пополнить" ||
    alert.action === "Поставить лимитки вручную" ||
    alert.action === "Сократить позицию" ||
    alert.action === "Новый альт — только вместо старого";

  // Центр зазора между сайдбаром и контентом в координатах ЭКРАНА.
  // Сцена шириной 1920 масштабируется и центрируется, поэтому к отступу
  // сцены добавляем масштабированную ширину колонки и половину зазора.
  const isMobile = desktopViewport.scale === 1 && window.innerWidth <= MOBILE_BREAKPOINT;
  const railLeft = desktopViewport.offsetX +
    (SCENE_PADDING + (sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH) + SCENE_GAP / 2) * desktopViewport.scale;

  return (
    <div
      className="v2-canvas"
      style={{
        "--v2-desktop-scale": desktopViewport.scale,
        "--v2-logical-height": `${desktopViewport.logicalHeight}px`,
        "--v2-canvas-offset-x": `${desktopViewport.offsetX}px`,
        "--v2-canvas-width": `${DESKTOP_DESIGN_WIDTH * desktopViewport.scale}px`,
        "--v2-canvas-height": `${canvasContentHeight * desktopViewport.scale}px`,
      } as CSSProperties}
    >
    <div
      ref={labRef}
      className={sidebarCollapsed ? "v2-lab is-sidebar-collapsed" : "v2-lab"}
    >
      {/* Мобильная шапка (только ≤768px) */}
      <header className="v2-mob-header">
        <button className="v2-mob-hamburger" type="button" aria-label="Меню" onClick={() => setMenuOpen(true)}>
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 5h14M2 9h14M2 13h14" strokeLinecap="round" />
          </svg>
        </button>
        <div className="v2-mob-brand">
          <span className="v2-mob-brand-title">MUSHII INVEST</span>
          <span className="v2-mob-brand-sub">RISK FIRST / PNL SECOND</span>
        </div>
        <button className="v2-mob-bell" type="button" aria-label="Уведомления" onClick={() => setNotifOpen(true)}>
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M9 2a4 4 0 00-4 4c0 4-1.6 5-1.6 5h11.2S13 10 13 6a4 4 0 00-4-4z" />
            <path d="M7.4 14a1.6 1.6 0 003.2 0" strokeLinecap="round" />
          </svg>
          {criticalCount > 0 && <span className="v2-mob-bell-badge">{criticalCount}</span>}
        </button>
      </header>

      {/* Живые звёзды и вспышки поверх фото */}
      <V2StarField />
      {/* Бэкдроп мобильной шторки */}
      {menuOpen && <div className="v2-mob-drawer-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <V2Sidebar
        mobileOpen={menuOpen}
        onCloseMobile={() => setMenuOpen(false)}
        activePage={page}
        onNavigate={handleNavigate}
        healthFactor={behaviorPortfolio.healthFactor}
        healthStatus={behaviorPortfolio.healthStatus}
        portfolio={behaviorPortfolio}
        health={behaviorHealth}
        positions={data.positions}
        transactions={data.transactions}
        /* Имя из настроек профиля, а если его не задавали — имя аккаунта
           (метаданные регистрации, иначе часть email). «ИНВЕСТОР» остаётся
           только для гостя. */
        collapsed={sidebarCollapsed}
        profileName={profileName || displayName}
        profileAvatar={profileAvatar}
        onOpenAuth={onOpenAuth}
        dataStatus={dataStatus}
      />


      <main className={locked ? "v2-main is-locked" : "v2-main"}>
        {dataStatus && !locked && <DataStatusBadge dataStatus={dataStatus} />}
        {locked && (
          <div className="v2-lock-hint" aria-hidden="true">
            <span className="v2-lock-hint-icon">🔒</span>
            <span>Войдите, чтобы открыть кабинет</span>
          </div>
        )}
        {page === "settings" ? (
          <V2SettingsPage
            initialName={profileName}
            initialAvatar={profileAvatar}
            onSave={handleSaveProfile}
          />
        ) : page === "trading" || page === "signals" || page === "gate" ? (
          <V2TradingPage
            key={page}
            initialStep={page === "gate"
              ? "check"
              : page === "signals"
                ? "observe"
                : activeTradeCase
                  ? tradingStepForTradeCase(activeTradeCase.status)
                  : "idea"}
            candidate={effectiveTradeCandidate}
            tradeCases={tradeCaseStore.cases}
            activeTradeCaseId={tradeCaseStore.activeTradeCaseId}
            syncState={tradeCaseSyncState}
            dataTrust={tradingDataTrust}
            onSaveTradeCase={handleSaveTradeCase}
            signalsProps={{
              portfolio: behaviorPortfolio,
              positions: data.positions,
              risk: data.risk,
              fearGreedStrategy: data.fearGreedStrategy,
              interestSignals: data.signals?.interestList?.length
                ? data.signals.interestList
                : data.signals?.interest
                  ? [data.signals.interest]
                  : [],
              strategy: data.strategy,
              onOpenTradeCandidate: handleOpenTradeCandidate,
              onRefreshData: dataStatus?.onRefresh,
            }}
            gateProps={{
              portfolio: behaviorPortfolio,
              positions: data.positions,
              allocation: data.allocation,
              fearGreedStrategy: data.fearGreedStrategy,
              assetQuality: data.assetQuality,
              healthInput: behaviorHealthInput,
              strategy: data.strategy,
              profile: data.profile,
              futuresShare: data.risk.futuresShare,
              onSaveDecision: handleSaveDecision,
              candidate: effectiveTradeCandidate,
              onClearCandidate: () => setTradeCandidate(null),
              disciplineBlockers: behavior.blockers,
              disciplineWarnings: behavior.warnings,
            }}
            reportsProps={{
              history: data.history,
              transactions: data.transactions,
              positions: data.positions,
              realizedPnlUsd: data.portfolio.realizedPnlUsd,
              decisionJournal,
              traderJournal,
              behavior,
              strategy: data.strategy,
              onDeleteDecision: handleDeleteDecision,
              onSaveTradeReview: handleSaveTradeReview,
              tradeCaseIdByTransaction,
            }}
          />
        ) : page === "reports" ? (
          <V2ReportsPage
            history={data.history}
            transactions={data.transactions}
            positions={data.positions}
            realizedPnlUsd={data.portfolio.realizedPnlUsd}
            behavior={behavior}
            strategy={data.strategy}
          />
        ) : page === "portfolio" ? (
          <V2PortfolioPage
            portfolio={data.portfolio}
            positions={data.positions}
            playbook={data.playbook}
            history={data.history}
            staking={staking}
            cosmosStaking={cosmosStaking}
            realizedPnlUsd={data.portfolio.realizedPnlUsd}
            realizedPnlPct={data.portfolio.realizedPnlPct}
            strategy={data.strategy}
          />
        ) : page === "scenarios" || page === "risk" ? (
          <V2ScenariosHubPage
            key={page}
            initialSection={page === "risk" ? "risk" : "playbook"}
            playbook={data.playbook}
            positions={data.positions}
            portfolio={behaviorPortfolio}
            health={behaviorHealth}
            risk={data.risk}
            allocation={data.allocation}
            strategy={data.strategy}
            marketPsychology={marketPsychology}
          />
        ) : page === "health" || page === "dna" ? (
          <V2HealthPage
            key={page}
            portfolio={behaviorPortfolio}
            health={behaviorHealth}
            healthInput={behaviorHealthInput}
            strategy={data.strategy}
            dna={data.dna}
            fearGreedIndex={data.fearGreedStrategy.currentIndex}
            onOpenGate={() => handleNavigate("gate")}
            initialDNAExpanded={page === "dna"}
            portfolioAlerts={alerts}
            onPortfolioAlertAction={handleAlertAction}
            canRunPortfolioAlertAction={canHandleAlertAction}
          />
        ) : page === "education" ? (
          <V2EducationPage />
        ) : (
        <section className="v2-command-grid" aria-label="Investor Cabinet V2 overview">
          <V2TopMetrics
            portfolio={behaviorPortfolio}
            history={data.history}
            capitalOpen={capitalOpen}
            onToggleCapital={() => setCapitalOpen((v) => !v)}
          />
          <div className={`v2-capital-dropdown ${capitalOpen ? "is-open" : ""}`}>
            <div className="v2-capital-dropdown-inner">
              <V2DeployableCapital
                portfolio={behaviorPortfolio}
                allocation={data.allocation}
                positions={data.positions}
                strategy={data.fearGreedStrategy}
                investorStrategy={data.strategy}
                futuresShare={data.risk.futuresShare}
              />
            </div>
          </div>

          {/* Блок здоровья — на всю ширину */}
          <div className="v2-hero-reactor">
            <V2HealthCore
              portfolio={behaviorPortfolio}
              health={behaviorHealth}
              healthInput={behaviorHealthInput}
              strategy={data.strategy}
              fearGreedIndex={data.fearGreedStrategy.currentIndex}
              onChipSelect={setSelectedChip}
              onNavigate={onNavigate}
            />
          </div>

          <div className="v2-cap-ladder-slot">
            <V2CapitalLadder portfolio={behaviorPortfolio} strategy={data.strategy} />
          </div>

          {/* Под радаром: распределение + DCA рядом */}
          <div className="v2-alloc-center-row">
            <div className="v2-alloc-center-inner">
              <span aria-hidden="true" className="v2-hud-corners" />
              <V2PortfolioAllocationCard allocation={data.allocation} total={data.portfolio.totalPortfolioValue} positions={data.positions} strategy={data.strategy} futuresShare={data.risk.futuresShare} />
            </div>
            <div className="v2-alloc-dca-slot">
              <V2DCAStrategy
                portfolio={behaviorPortfolio}
                strategy={data.fearGreedStrategy}
                investorStrategy={data.strategy}
                onNavigate={onNavigate}
              />
            </div>
          </div>

          <V2BtcDailyChart currentFearGreed={data.fearGreedStrategy.currentIndex} />
        </section>
        )}
      </main>
      <V2TabBar activePage={page} onNavigate={onNavigate} criticalCount={criticalCount} />

      {/* Рычаг живёт ВНЕ .v2-lab: у сцены zoom, и fixed-потомок внутри него
          терял горизонтальное смещение центрирования — рычаг заезжал на
          сайдбар. Снаружи координата считается явно и не зависит от масштаба. */}
      {!isMobile && createPortal(
        <button
          className="v2-rail-toggle"
          type="button"
          style={{ left: `${railLeft}px` }}
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
          title={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          <span className="v2-rail-toggle-grip" aria-hidden="true" />
          <svg viewBox="0 0 12 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d={sidebarCollapsed ? "M4 4l5 5-5 5" : "M8 4L3 9l5 5"} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>,
        document.body
      )}

      {notifOpen && (
        <V2NotificationsPanel
          alerts={alerts}
          onClose={() => setNotifOpen(false)}
          onAction={handleAlertAction}
          canRunAction={canHandleAlertAction}
        />
      )}

      {selectedChip && (
        <V2HealthDetailModal
          component={selectedChip}
          portfolio={behaviorPortfolio}
          strategy={data.strategy}
          onClose={() => setSelectedChip(null)}
        />
      )}
      <V2AssistantWidget
        accountId={data.strategy.id}
        disabled={locked}
        uiContext={{
          currentPage: assistantPageContext,
          portfolio: behaviorPortfolio,
          health: behaviorHealth,
          healthInput: behaviorHealthInput,
          allocation: data.allocation,
        }}
      />
    </div>
    </div>
  );
}
