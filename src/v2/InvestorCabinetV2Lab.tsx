import { useEffect, useMemo, useState } from "react";
import { V2Shell } from "./components/V2Shell";
import { V2AuthModal } from "./components/V2AuthModal";
import { useAuth } from "../hooks/useAuth";
import { isFounderEmail, isWifeEmail } from "../lib/supabaseClient";
import { useInvestorData } from "../hooks/useInvestorData";
import { useWifeTransactions } from "../hooks/useWifeTransactions";
import { useTonStaking, MAIN_TON_ADDRESS } from "../hooks/useTonStaking";
import { useCosmosStaking, MAIN_COSMOS_ADDRESS } from "../hooks/useCosmosStaking";
import { useFearGreed } from "../hooks/useFearGreed";
import { useHyperliquidLeverage } from "../hooks/useHyperliquidLeverage";
import { buildFearGreedStrategy } from "../lib/fearGreedStrategy";
import { INVESTOR_API_URL, WIFE_API_URL } from "../config/constants";
import { buildPortfolioState } from "../lib/portfolioCalculations";
import type { HealthInput, PortfolioHealth } from "../lib/portfolioHealth";
import type { PlaybookCard } from "../lib/playbookSelectors";
import { rawPositions, decisionsData, scenariosData } from "../mocks/portfolioData";
import type { PortfolioState } from "../types/portfolio";
import { buildLiveV2Data, buildZeroedV2Data } from "./lib/v2LabData";
import type { InvestorStrategy } from "./lib/investorStrategy";
import type { InvestorProfile } from "./lib/investorProfile";
import type { InvestorDNA } from "./lib/investorDNA";
import "./v2.css";

export type V2Portfolio = {
  totalPortfolioValue: number;
  totalInvested: number;
  pnlUsd: number;
  pnlPct: number;
  stableReserve: number;
  positionsCount: number;
  healthFactor: number;
  healthStatus: "CONTROL" | "BALANCED" | "RISK";
  riskLevel: string;
  deployableCapital: number;
  spotDeployable: number;
  futuresDeployable: number;
  reserveShare: number;
  exposureMode: string;
  exposureSignal: string;
  /** Реализованный профит по закрытым позициям — $ и доля 0..1 (Расчеты O:U). */
  realizedPnlUsd?: number;
  realizedPnlPct?: number;
};

export type V2Position = {
  asset: string;
  category: string;
  avgEntry: number;
  currentPrice: number;
  invested: number;
  value: number; // текущая стоимость
  pnl: number;
  pnlPct: number; // в процентах
  share: number; // в процентах
  status: string;
};

export type V2Risk = {
  reserve: number;
  exposure: number;
  leverage: number;
  futuresShare: number;
  diversification: number;
  volatility: number;
  concentration: "LOW" | "MEDIUM" | "HIGH";
  futuresPressure: "LOW" | "MEDIUM" | "HIGH";
};

export type V2Market = {
  fearGreedValue: number;
  fearGreedLabel: string;
  marketMood: string;
  buyWindowStatus: "ACTIVE" | "WAIT" | "CLOSED";
  nextHalvingDays: number;
  cyclePhase: string;
};

export type V2Decision = {
  asset: string;
  thesis: string;
  nextAction: string;
  reviewTrigger: string;
  status: "READY" | "WAIT" | "BLOCKED";
};

export type V2Scenario = {
  asset: string;
  baseCase: string;
  bullCase: string;
  bearCase: string;
  invalidation: string;
  actionZone: string;
};

export type V2LabData = {
  strategy: InvestorStrategy;
  profile: InvestorProfile;
  dna: InvestorDNA;
  portfolio: V2Portfolio;
  positions: V2Position[];
  risk: V2Risk;
  market: V2Market;
  decisions: V2Decision[];
  scenarios: V2Scenario[];
  fearGreedStrategy: PortfolioState["fearGreedStrategy"];
  history: PortfolioState["history"];
  transactions: PortfolioState["transactions"];
  signals: PortfolioState["signals"];
  assetQuality: PortfolioState["assetQuality"];
  allocation: Array<{ name: string; share: number; value: number }>;
  health: PortfolioHealth;
  healthInput: HealthInput; // входы расчёта — нужны симулятору Health для честного пересчёта
  playbook: PlaybookCard[];
  ticker: Array<{ label: string; value: string; change: number }>;
};


export type V2Page = "overview" | "portfolio" | "scenarios" | "risk" | "reports" | "signals" | "settings" | "health" | "gate" | "dna" | "education";

export default function InvestorCabinetV2Lab() {
  const { accessToken, configured, loading: authLoading, user } = useAuth();
  const [page, setPage] = useState<V2Page>("overview");
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const fallbackData = useMemo(
    () => buildPortfolioState(rawPositions, decisionsData, scenariosData),
    []
  );
  const wife = isWifeEmail(user?.email);
  const investorDataReady = !configured || (!authLoading && Boolean(user));
  const investorData = useInvestorData(
    fallbackData,
    wife ? WIFE_API_URL : INVESTOR_API_URL,
    wife ? "wife" : undefined,
    investorDataReady,
    accessToken,
  );
  const blockchainTxs = useWifeTransactions(wife);
  const fearGreedLive = useFearGreed();
  const hlAddress = import.meta.env.VITE_HL_ADDRESS as string | undefined;
  const hlLeverage = useHyperliquidLeverage(hlAddress);

  // Портфель приходит из Apps Script/API. Фронтенд не накладывает второй слой балансов,
  // чтобы Google Sheets + Apps Script оставались единственным источником фактов.
  const portfolioData = investorData.data;

  const liveBase = useMemo(
    () => buildLiveV2Data(portfolioData, hlLeverage.leverage, hlLeverage.risk, wife ? "wife" : "main"),
    [portfolioData, hlLeverage.leverage, hlLeverage.risk, wife]
  );
  const zeroedBase = useMemo(() => buildZeroedV2Data(), []);

  // Личный портфель: владелец — реальные данные, жена — свои реальные данные, остальные — нули.
  const founder = isFounderEmail(user?.email);
  const base = !configured || founder || wife ? liveBase : zeroedBase;

  // Стейкинг TON (tsTON) — только для главного аккаунта (владелец/демо), не для жены.
  const staking = useTonStaking(MAIN_TON_ADDRESS, !wife && (founder || !configured));
  // Стейкинг ATOM (Cosmos Hub нативный) — тот же гейт.
  const cosmosStaking = useCosmosStaking(MAIN_COSMOS_ADDRESS, !wife && (founder || !configured));

  // Рыночный Fear & Greed всегда живой (реальный BTC-график, реальный индекс) —
  // даже у пустого аккаунта до подключения кошельков. Личный портфель при этом нули:
  // invested=0 → суммы покупок по стратегии = $0, но индекс/зона реальные.
  const data = useMemo(() => {
    const liveValue = fearGreedLive.status === "ready" ? fearGreedLive.data.value : null;
    if (liveValue === null) return base;

    const invested = base.fearGreedStrategy.portfolioValue;
    const liveStrategy = buildFearGreedStrategy(liveValue, invested, base.fearGreedStrategy.rules);

    const mergedHistory =
      base.fearGreedStrategy.history.length > 0
        ? base.fearGreedStrategy.history
        : fearGreedLive.liveHistory;

    return {
      ...base,
      fearGreedStrategy: {
        ...liveStrategy,
        lastBuy: base.fearGreedStrategy.lastBuy,
        strategyBuys: base.fearGreedStrategy.strategyBuys,
        history: mergedHistory,
      },
    };
  }, [base, fearGreedLive.status, fearGreedLive.data.value, fearGreedLive.liveHistory]);

  // Для аккаунта жены: добавляем blockchain-транзакции как fallback поверх API.
  // Дедупликация по id — API-запись побеждает при совпадении.
  const finalData = useMemo(() => {
    if (!wife || blockchainTxs.length === 0) return data;
    const apiIds = new Set(data.transactions.map((t) => t.id));
    const uniqueBlockchain = blockchainTxs.filter((t) => !apiIds.has(t.id));
    const merged = [...data.transactions, ...uniqueBlockchain].sort(
      (a, b) => Date.parse(b.date) - Date.parse(a.date)
    );
    return { ...data, transactions: merged };
  }, [wife, data, blockchainTxs]);

  // Гейт: авторизация настроена и пользователь не вошёл → дашборд заблокирован.
  const locked = configured && !authLoading && !user;

  // Автооткрытие окна входа, когда дашборд под замком.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- реакция на смену auth-состояния
    if (locked) setAuthOpen(true);
  }, [locked]);

  // После успешного входа окно закрываем.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- реакция на смену auth-состояния
    if (user) setAuthOpen(false);
  }, [user]);

  const openAuth = (tab: "signin" | "signup") => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

  return (
    <>
      <V2Shell
        data={finalData}
        page={page}
        onNavigate={setPage}
        locked={locked}
        onOpenAuth={openAuth}
        staking={staking}
        cosmosStaking={cosmosStaking}
        dataStatus={{
          source: investorData.source,
          status: investorData.status,
          lastLoadedAt: investorData.lastLoadedAt,
          error: investorData.error,
          onRefresh: investorData.refresh,
        }}
      />
      {authOpen && (
        <V2AuthModal initialTab={authTab} onClose={() => setAuthOpen(false)} />
      )}
    </>
  );
}
