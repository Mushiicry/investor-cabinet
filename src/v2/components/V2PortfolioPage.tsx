import { useState, Fragment } from "react";
import type { ReactNode } from "react";
import type { V2Portfolio, V2Position } from "../InvestorCabinetV2Lab";
import type { PlaybookCard } from "../../lib/playbookSelectors";
import type { PortfolioHistoryPoint } from "../../types/portfolio";
import type { TonStaking } from "../../hooks/useTonStaking";
import type { CosmosStaking } from "../../hooks/useCosmosStaking";
import { CryptoLogo } from "../../components/crypto/CryptoLogo";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import { V2StakingCard } from "./V2StakingCard";
import { V2CosmosStakingCard } from "./V2CosmosStakingCard";
import { V2PortfolioMiniChart } from "./V2PortfolioMiniChart";
import type { InvestorStrategy } from "../lib/investorStrategy";
import { isWaitingRebuyStatus } from "../../lib/portfolioSelectors";
import { isObservationPortfolioPosition, isVisiblePortfolioPosition } from "../lib/portfolioVisibility";

type Props = {
  positions: V2Position[];
  playbook: PlaybookCard[];
  staking?: TonStaking | null;
  cosmosStaking?: CosmosStaking | null;
  /** Реализованный профит по закрытым позициям — $ и доля 0..1. */
  realizedPnlUsd?: number;
  realizedPnlPct?: number;
  portfolio?: V2Portfolio;
  history?: PortfolioHistoryPoint[];
  strategy?: InvestorStrategy;
};

const money0 = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function money(value: number): string {
  const abs = Math.abs(value);
  const digits = abs < 10 ? 2 : abs < 1000 ? 1 : 0;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

const signedMoney = (value: number) =>
  `${value > 0 ? "+" : ""}${money(value)}`;
const signedPct = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const fmtPct = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
// Стрелка динамики позиции: сразу видно, вырос капитал или просел
const trendArrow = (value: number) => (value > 0.004 ? "▲ " : value < -0.004 ? "▼ " : "");

function pnlTone(value: number) {
  if (value > 0) return "is-up";
  if (value < 0) return "is-down";
  return "";
}

const FULL_NAME: Record<string, string> = {
  SPCXB: "SpaceX",
  ETH: "Ethereum",
  SOL: "Solana",
  TON: "TON",
  ATOM: "Cosmos",
  "BTC LONG": "Bitcoin",
  "MNT LONG": "Mantle",
  "GOLD LONG": "Gold",
  USDC: "USD Coin",
  "USDC BNB": "USD Coin",
  "USDC HL": "USD Coin",
  USDT: "Tether",
  "USDT ARB": "Tether",
};
const fullName = (asset: string) => FULL_NAME[asset] ?? asset;

const STABLE_META: Record<string, { network: string; purpose: string; net: string }> = {
  USDC: { network: "Arbitrum", purpose: "Спот · добор на DEX", net: "is-arb" },
  "USDC BNB": { network: "BNB Chain", purpose: "Свободные деньги", net: "is-bnb" },
  "USDC HL": { network: "Hyperliquid", purpose: "Маржа для фьючерсов", net: "is-hl" },
  USDT: { network: "TON", purpose: "Быстрый добор по стратегии", net: "is-ton" },
  "USDT ARB": { network: "Arbitrum", purpose: "Резерв · Arbitrum", net: "is-arb" },
};

const GROUPS = [
  { title: "Крипта", category: "Крипта" },
  { title: "Фьючи", category: "Фьючерсы" },
  { title: "Металлы", category: "Металлы" },
  { title: "Акции", category: "Акции" },
];

const TRADINGVIEW_CHARTS: Record<string, { symbol: string; marketAsset: string; url: string }> = {
  GRAM: {
    symbol: "GRAM",
    marketAsset: "GRAM",
    url: "https://ru.tradingview.com/chart/?symbol=OKX%3AGRAMUSDT",
  },
  // В текущем API позиция GRAM приходит под историческим именем TON.
  TON: {
    symbol: "GRAM",
    marketAsset: "GRAM",
    url: "https://ru.tradingview.com/chart/?symbol=OKX%3AGRAMUSDT",
  },
  ATOM: {
    symbol: "ATOM",
    marketAsset: "ATOM",
    url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3AATOMUSDT",
  },
  SOL: {
    symbol: "SOL",
    marketAsset: "SOL",
    url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3ASOLUSDT",
  },
  BNB: {
    symbol: "BNB",
    marketAsset: "BNB",
    url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3ABNBUSDT",
  },
  BTC: {
    symbol: "BTC",
    marketAsset: "BTC",
    url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT",
  },
  ETH: {
    symbol: "ETH",
    marketAsset: "ETH",
    url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3AETHUSDT",
  },
  APEX: {
    symbol: "APEX",
    marketAsset: "APEX",
    url: "https://ru.tradingview.com/chart/?symbol=BYBIT%3AAPEXUSDT",
  },
  MNT: {
    symbol: "MNT",
    marketAsset: "MNT",
    url: "https://ru.tradingview.com/chart/?symbol=BYBIT%3AMNTUSDT",
  },
  CAKE: {
    symbol: "CAKE",
    marketAsset: "CAKE",
    url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3ACAKEUSDT",
  },
  GOLD: {
    symbol: "GOLD",
    marketAsset: "GOLD",
    url: "https://ru.tradingview.com/chart/?symbol=PEPPERSTONE%3AXAUUSD",
  },
  SPCXB: {
    symbol: "SPCXB",
    marketAsset: "SPCXB",
    url: "https://ru.tradingview.com/chart/?symbol=BINANCE%3ASPCXBUSDT",
  },
};

function summaryPnlPct(pnlPct: number) {
  const normalized = Math.abs(pnlPct) <= 1 ? pnlPct * 100 : pnlPct;
  return fmtPct(normalized);
}

function PortfolioMetricCard({
  label,
  value,
  note,
  tone,
  variant,
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
  variant?: "health";
}) {
  return (
    <div className={`v2-port-metric-card ${variant ? `is-${variant}` : ""}`}>
      <div>
        <span>{label}</span>
        <strong className={tone ?? ""}>{value}</strong>
        <em>{note}</em>
      </div>
      {variant === "health" && <i className="v2-port-metric-orb" aria-hidden="true" />}
    </div>
  );
}

function groupPnlPct(rows: V2Position[]) {
  const invested = rows.reduce((sum, position) => sum + position.invested, 0);
  const pnl = rows.reduce((sum, position) => sum + position.pnl, 0);
  return invested > 0 ? (pnl / invested) * 100 : 0;
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

function findPreviousDailySnapshot(history: PortfolioHistoryPoint[], todayKey: string) {
  const targetKey = previousDateKey(todayKey);
  return [...history]
    .filter((point) => point.portfolioValue > 0 && historyDateKey(point.date) === targetKey)
    .sort((a, b) => historyTime(a.date) - historyTime(b.date))
    .at(-1) ?? null;
}

function formatSnapshotDate(rawDate: string) {
  const key = historyDateKey(rawDate);
  if (!key) return "прошлому снимку";
  const [, month, day] = key.split("-");
  return `${day}.${month}`;
}

function IdentityCard({
  asset,
  card,
  pnlPct,
  pnl,
  staked,
  observing,
  onOpen,
}: {
  asset: string;
  card: PlaybookCard | null;
  pnlPct: number;
  pnl: number;
  staked?: boolean;
  observing?: boolean;
  onOpen?: () => void;
}) {
  const tone = pnlTone(pnl);
  const inner = (
    <>
      <CryptoLogo asset={asset} className="v2-pid-logo" />
      <span className="v2-pid-name-stack">
        <span className="v2-pid-name">{fullName(asset)}</span>
        {observing && <span className="v2-pid-observation" title="Наблюдение · вложено меньше $1">Наблюдение</span>}
        {staked && <span className="v2-pid-staked" title="В стейке">🔒 в стейке</span>}
      </span>
      <span className={`v2-pid-pnl ${tone}`}>
        {trendArrow(pnlPct)}
        {signedPct(pnlPct)}
      </span>
    </>
  );

  return card ? (
    <button type="button" className="v2-pid is-clickable" onClick={onOpen}>
      {inner}
    </button>
  ) : (
    <div className="v2-pid">{inner}</div>
  );
}

function TradingViewChartLink({ asset }: { asset: string }) {
  const normalizedAsset = asset.replace(/ (LONG|SHORT)$/, "");
  const chart = TRADINGVIEW_CHARTS[normalizedAsset];

  return (
    <div className="v2-port-chart-slot">
      {chart && (
        <V2PortfolioMiniChart
          asset={chart.marketAsset}
          symbol={chart.symbol}
          href={chart.url}
        />
      )}
    </div>
  );
}

function StableCard({ asset, meta, observing }: { asset: string; meta: { network: string; net: string }; observing: boolean }) {
  const logoAsset = asset.replace(" BNB", "").replace(" HL", "").replace(" ARB", "");
  return (
    <div className="v2-pid v2-pid-stable">
      <CryptoLogo asset={logoAsset} className="v2-pid-logo" />
      <div className="v2-pid-stable-info">
        <span className="v2-pid-name">{fullName(asset)}</span>
        <span className={`v2-pid-net-tag ${meta.net}`}>{meta.network}</span>
        {observing && <span className="v2-pid-observation" title="Наблюдение · вложено меньше $1">Наблюдение</span>}
      </div>
    </div>
  );
}

function ModalBlock({ label, tone, children }: { label: string; tone?: string; children: ReactNode }) {
  return (
    <div className="v2-pb-block">
      <span className={`v2-pb-block-label ${tone ?? ""}`}>{label}</span>
      <p>{children}</p>
    </div>
  );
}

function PlaybookModal({
  card,
  position,
  onClose,
}: {
  card: PlaybookCard;
  position: V2Position;
  onClose: () => void;
}) {
  useEscapeClose(true, onClose);

  return (
    <div className="v2-pb-overlay" onClick={onClose}>
      <div className="v2-pb-modal" onClick={(event) => event.stopPropagation()}>
        <div className="v2-pb-modal-head">
          <CryptoLogo asset={card.asset} className="v2-pb-modal-logo" />
          <div className="v2-pb-modal-title">
            <h2>{fullName(card.asset)}</h2>
            <span className="v2-pb-share">Доля {position.share.toFixed(1)}%</span>
          </div>
          <div className="v2-pb-modal-stats">
            <span className="v2-pb-stat is-up">
              <i>Прибыль</i>
              {card.attack}/10
            </span>
            <span className="v2-pb-stat is-down">
              <i>Риск</i>
              {card.risk}/10
            </span>
          </div>
          <button type="button" className="v2-pb-close" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="v2-pb-grid">
          {card.base && <ModalBlock label="База">{card.base}</ModalBlock>}
          {card.whyHold && <ModalBlock label="Роль">{card.whyHold}</ModalBlock>}
          {card.bear && (
            <ModalBlock label="Сценарий ↓" tone="is-down">
              {card.bear}
            </ModalBlock>
          )}
          {card.bull && (
            <ModalBlock label="Сценарий ↑" tone="is-up">
              {card.bull}
            </ModalBlock>
          )}
          {card.nextAction && <ModalBlock label="Решение">{card.nextAction}</ModalBlock>}
          {card.action && <ModalBlock label="Зоны интереса">{card.action}</ModalBlock>}
          {card.reviewTrigger && (
            <ModalBlock label="Пересмотр" tone="is-warn">
              {card.reviewTrigger}
            </ModalBlock>
          )}
          {card.invalidation && (
            <ModalBlock label="Инвалидация" tone="is-warn">
              {card.invalidation}
            </ModalBlock>
          )}
        </div>
      </div>
    </div>
  );
}

export function V2PortfolioPage({ positions, playbook, staking, cosmosStaking, portfolio, history = [], strategy }: Props) {
  const [selected, setSelected] = useState<{ card: PlaybookCard; position: V2Position } | null>(null);
  // Какая стейкинг-плашка раскрыта (по тикеру актива): "TON" | "ATOM" | null
  const [openStake, setOpenStake] = useState<string | null>(null);

  const playbookMap = new Map(playbook.map((card) => [card.asset, card]));
  const findPlaybook = (asset: string) =>
    playbookMap.get(asset) ?? playbookMap.get(asset.replace(/ (LONG|SHORT)$/, "")) ?? null;

  const stables = [
    ...positions
      .filter((position) => position.category === "Свободные деньги")
      .sort((a, b) => b.value - a.value),
  ];
  const stablesTotal = stables.reduce((sum, position) => sum + position.value, 0);

  const visibleGroups = GROUPS.filter(
    (group) => strategy?.futuresAllowed !== false || group.category !== "Фьючерсы",
  );

  const totalValue =
    portfolio?.totalPortfolioValue ?? positions.reduce((sum, position) => sum + position.value, 0);
  const marketValue = positions
    .filter((position) => position.category !== "Свободные деньги")
    .reduce((sum, position) => sum + position.value, 0);
  const totalInvested =
    portfolio?.totalInvested ?? positions.reduce((sum, position) => sum + position.invested, 0);
  const totalPnl = portfolio?.pnlUsd ?? positions.reduce((sum, position) => sum + position.pnl, 0);
  const totalPnlPct = portfolio ? summaryPnlPct(portfolio.pnlPct) : fmtPct(groupPnlPct(positions));
  const cashShare = totalValue > 0 ? (stablesTotal / totalValue) * 100 : 0;
  const previousDailySnapshot = findPreviousDailySnapshot(history, localDateKey(new Date()));
  const dailyPnlUsd = previousDailySnapshot ? totalValue - previousDailySnapshot.portfolioValue : null;
  const dailyPnlPct =
    dailyPnlUsd != null && previousDailySnapshot && previousDailySnapshot.portfolioValue > 0
      ? (dailyPnlUsd / previousDailySnapshot.portfolioValue) * 100
      : null;

  return (
    <section className="v2-port-page" aria-label="Портфель — все позиции">
      <div className="v2-port-shell">
        <header className="v2-port-hero">
          <div className="v2-port-metrics" aria-label="Ключевые метрики портфеля">
            <PortfolioMetricCard
              label="Всего в рынке"
              value={money(marketValue)}
              note={`Вложено ${money(totalInvested)}`}
            />
            <PortfolioMetricCard
              label="P&L всего"
              value={signedMoney(totalPnl)}
              note={totalPnlPct}
              tone={pnlTone(totalPnl)}
            />
            <PortfolioMetricCard
              label="P&L 24H"
              value={dailyPnlUsd != null ? signedMoney(dailyPnlUsd) : "—"}
              note={
                dailyPnlPct != null && previousDailySnapshot
                  ? `${fmtPct(dailyPnlPct)} к ${formatSnapshotDate(previousDailySnapshot.date)}`
                  : "Ждём снимок прошлого дня"
              }
              tone={dailyPnlUsd != null ? pnlTone(dailyPnlUsd) : ""}
            />
            <PortfolioMetricCard
              label="Cash"
              value={`${cashShare.toFixed(1)}%`}
              note={money(stablesTotal)}
            />
          </div>
        </header>

        <div className="v2-port-layout">
          <div className="v2-panel v2-port-table">
            {visibleGroups.map((group) => {
              const rows = positions
                .filter((position) => position.category === group.category)
                .filter((position) => isVisiblePortfolioPosition(position, strategy))
                .sort((a, b) => b.invested - a.invested);
              if (!rows.length) return null;

              const groupValue = rows.reduce((sum, position) => sum + position.value, 0);
              const groupPnl = rows.reduce((sum, position) => sum + position.pnl, 0);
              const groupTone = pnlTone(groupPnl);

              return (
                <div className="v2-port-group" key={group.title}>
                  <div className="v2-pline">
                    <div className="v2-pid v2-pid-head">
                      <span className="v2-port-cat-name">{group.title}</span>
                    </div>
                    <div className="v2-port-row v2-port-group-head">
                      <span>
                        Стоимость <strong>{money(groupValue)}</strong>
                      </span>
                      <span>
                        P&L{" "}
                        <strong className={groupTone}>
                          {signedMoney(groupPnl)} · {fmtPct(groupPnlPct(rows))}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="v2-pline v2-port-market-line v2-port-columns-line">
                    <div aria-hidden="true" />
                    <div aria-hidden="true" />
                    <div className="v2-port-row v2-port-column-head">
                      <div className="v2-row-block">
                        <span>Ср. вход</span>
                        <span>Цена</span>
                      </div>
                      <div className="v2-row-block">
                        <span>Вложено</span>
                        <span>P&L</span>
                        <span>Стоимость</span>
                      </div>
                    </div>
                  </div>

                  {rows.map((position) => {
                    const card = findPlaybook(position.asset);
                    const tone = pnlTone(position.pnl);

                    // Стейкинг-плашка: TON (Tonstakers) или ATOM (Cosmos Hub)
                    const tonStaked = !!staking && position.asset === "TON";
                    const atomStaked = !!cosmosStaking && position.asset === "ATOM";
                    const isStaked = tonStaked || atomStaked;
                    const dailyUsd = tonStaked ? staking!.dailyUsd : atomStaked ? cosmosStaking!.dailyUsd : 0;
                    const isOpen = openStake === position.asset;
                    const isWaitingRebuy = isWaitingRebuyStatus(position.status) && position.value <= 0;
                    const isObserving = isObservationPortfolioPosition(position);

                    const row = (
                      <div className={`v2-pline v2-port-market-line${isObserving ? " is-observing" : ""}`}>
                        <IdentityCard
                          asset={position.asset}
                          card={card}
                          pnlPct={position.pnlPct}
                          pnl={position.pnl}
                          staked={isStaked}
                          observing={isObserving}
                          onOpen={card ? () => setSelected({ card, position }) : undefined}
                        />
                        <TradingViewChartLink asset={position.asset} />
                        <div className="v2-port-row">
                          <div className="v2-row-block">
                            <span className="v2-rb-val">{isWaitingRebuy ? "—" : money(position.avgEntry)}</span>
                            <span className="v2-rb-val">{money(position.currentPrice)}</span>
                          </div>
                          <div className="v2-row-block">
                            <strong className="v2-rb-val">{isWaitingRebuy ? "—" : money(position.invested)}</strong>
                            <span className={`v2-rb-val v2-port-pnl ${tone}`}>{signedMoney(position.pnl)}</span>
                            <strong className="v2-rb-val">{money(position.value)}</strong>
                          </div>
                        </div>
                      </div>
                    );

                    // Строка + плашка стейкинга в одном контейнере — чтобы при наведении
                    // на другие монеты вся группа (включая стейкинг) блюрилась.
                    if (isStaked) {
                      return (
                        <div className="v2-stake-wrap" key={position.asset}>
                          {row}
                          <button
                            type="button"
                            className={`v2-stake-toggle ${isOpen ? "is-open" : ""}`}
                            onClick={() => setOpenStake((v) => (v === position.asset ? null : position.asset))}
                            aria-expanded={isOpen}
                          >
                            <span className="v2-stake-toggle-icon">💎</span>
                            <span className="v2-stake-toggle-label">Доход со стейкинга</span>
                            <span className="v2-stake-toggle-val is-up">
                              +{money(dailyUsd)} / день
                            </span>
                            <svg className="v2-stake-toggle-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {isOpen && tonStaked && <V2StakingCard staking={staking!} />}
                          {isOpen && atomStaked && <V2CosmosStakingCard staking={cosmosStaking!} />}
                        </div>
                      );
                    }

                    return <Fragment key={position.asset}>{row}</Fragment>;
                  })}
                </div>
              );
            })}

            <div className="v2-port-group v2-port-stables">
              <div className="v2-pline">
                <div className="v2-pid v2-pid-head">
                  <span className="v2-port-cat-name">Свободные деньги</span>
                </div>
                <div className="v2-port-srow v2-port-stables-head">
                  <span>Стейблы</span>
                  <strong className="v2-port-stables-total">{money0.format(stablesTotal)}</strong>
                  <span>{cashShare.toFixed(1)}%</span>
                </div>
              </div>

              {stables.map((position) => {
                const meta = STABLE_META[position.asset] ?? { network: "—", purpose: "—", net: "" };
                const isObserving = isObservationPortfolioPosition(position);
                return (
                  <div className={`v2-pline${isObserving ? " is-observing" : ""}`} key={position.asset}>
                    <StableCard asset={position.asset} meta={meta} observing={isObserving} />
                    <div className="v2-port-srow">
                      <span className="v2-port-purpose">{meta.purpose}</span>
                      <strong>{money(position.value)}</strong>
                      <span className="v2-port-share">{position.share.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <PlaybookModal
          card={selected.card}
          position={selected.position}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
