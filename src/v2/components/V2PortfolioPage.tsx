import { useState, Fragment } from "react";
import type { ReactNode } from "react";
import type { V2Position } from "../InvestorCabinetV2Lab";
import type { PlaybookCard } from "../../lib/playbookSelectors";
import type { TonStaking } from "../../hooks/useTonStaking";
import type { CosmosStaking } from "../../hooks/useCosmosStaking";
import { CryptoLogo } from "../../components/crypto/CryptoLogo";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import { V2StakingCard } from "./V2StakingCard";
import { V2CosmosStakingCard } from "./V2CosmosStakingCard";

type Props = {
  positions: V2Position[];
  playbook: PlaybookCard[];
  staking?: TonStaking | null;
  cosmosStaking?: CosmosStaking | null;
  /** Реализованный профит по закрытым позициям — $ и доля 0..1. */
  realizedPnlUsd?: number;
  realizedPnlPct?: number;
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
// Стрелка динамики позиции: сразу видно, вырос капитал или просел
const trendArrow = (value: number) => (value > 0.004 ? "▲ " : value < -0.004 ? "▼ " : "");

const STATUS_TONE: Record<string, string> = {
  ACCUMULATE: "is-accumulate",
  WATCH: "is-watch",
  RESERVE: "is-reserve",
  HEDGE: "is-hedge",
  SPECULATION: "is-spec",
  HOLD: "is-hold",
  REDUCE: "is-reduce",
};

function pnlTone(value: number) {
  if (value > 0) return "is-up";
  if (value < 0) return "is-down";
  return "";
}

const FULL_NAME: Record<string, string> = {
  SPCXB: "SpaceX",
  ETH: "Ethereum",
  SOL: "Solana",
  TON: "GRAM",
  ATOM: "Cosmos",
  "BTC LONG": "Bitcoin",
  "MNT LONG": "Mantle",
  "GOLD LONG": "Gold",
  USDC: "USD Coin",
  "USDC HL": "USD Coin",
  USDT: "Tether",
  "USDT ARB": "Tether",
  "USDT BNB": "Tether",
};
const fullName = (asset: string) => FULL_NAME[asset] ?? asset;

const STABLE_META: Record<string, { network: string; purpose: string; net: string }> = {
  USDC: { network: "Arbitrum", purpose: "Спот · добор на DEX", net: "is-arb" },
  "USDC HL": { network: "Hyperliquid", purpose: "Маржа для фьючерсов", net: "is-hl" },
  USDT: { network: "TON", purpose: "Быстрый добор по стратегии", net: "is-ton" },
  "USDT ARB": { network: "Arbitrum", purpose: "Резерв · Arbitrum", net: "is-arb" },
  "USDT BNB": { network: "BNB Chain", purpose: "Резерв · неприкосновенный", net: "is-bnb" },
};

const RESERVE_STABLE: V2Position = {
  asset: "USDT BNB",
  category: "Свободные деньги",
  avgEntry: 1,
  currentPrice: 1,
  invested: 0,
  value: 0,
  pnl: 0,
  pnlPct: 0,
  share: 0,
  status: "RESERVE",
};

const GROUPS = [
  { title: "Спот", category: "Крипта" },
  { title: "Фьючи", category: "Фьючерсы" },
  { title: "Металлы", category: "Металлы" },
  { title: "Акции", category: "Акции" },
];

function IdentityCard({
  asset,
  card,
  staked,
  onOpen,
}: {
  asset: string;
  card: PlaybookCard | null;
  staked?: boolean;
  onOpen?: () => void;
}) {
  const inner = (
    <>
      <CryptoLogo asset={asset} className="v2-pid-logo" />
      <span className="v2-pid-name">
        {fullName(asset)}
        {staked && <span className="v2-pid-staked" title="В стейке (Tonstakers)">🔒 в стейке</span>}
      </span>
      {card ? (
        <>
          <span className="v2-pb-stat is-up">
            <i>Прибыль</i>
            {card.attack}
          </span>
          <span className="v2-pb-stat is-down">
            <i>Риск</i>
            {card.risk}
          </span>
        </>
      ) : (
        <>
          <span />
          <span />
        </>
      )}
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

function StableCard({ asset, meta }: { asset: string; meta: { network: string; net: string } }) {
  const logoAsset = asset.replace(" BNB", "").replace(" HL", "").replace(" ARB", "");
  return (
    <div className="v2-pid v2-pid-stable">
      <CryptoLogo asset={logoAsset} className="v2-pid-logo" />
      <div className="v2-pid-stable-info">
        <span className="v2-pid-name">{fullName(asset)}</span>
        <span className={`v2-pid-net-tag ${meta.net}`}>{meta.network}</span>
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
            <span className={`v2-port-status ${STATUS_TONE[card.status] ?? "is-hold"}`}>
              {card.status}
            </span>
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

export function V2PortfolioPage({ positions, playbook, staking, cosmosStaking, realizedPnlUsd, realizedPnlPct }: Props) {
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
    RESERVE_STABLE,
  ];
  const stablesTotal = stables.reduce((sum, position) => sum + position.value, 0);

  const showRealized = typeof realizedPnlUsd === "number" && realizedPnlUsd !== 0;

  return (
    <section className="v2-port-page" aria-label="Портфель — все позиции">
      {showRealized && (
        <div className="v2-panel v2-port-realized" title="Профит по закрытым и зафиксированным позициям — не входит в текущий PnL портфеля">
          <span className="v2-port-realized-label">Реализовано за всё время</span>
          <span className={`v2-port-realized-val ${realizedPnlUsd > 0 ? "is-up" : "is-down"}`}>
            {signedMoney(realizedPnlUsd)}
            {typeof realizedPnlPct === "number" && realizedPnlPct !== 0 && (
              <em>{signedPct(realizedPnlPct * 100)}</em>
            )}
          </span>
        </div>
      )}
      <div className="v2-panel v2-port-table">
        {GROUPS.map((group) => {
          const rows = positions
            .filter((position) => position.category === group.category)
            .sort((a, b) => b.invested - a.invested);
          if (!rows.length) return null;

          return (
            <div className="v2-port-group" key={group.title}>
              <div className="v2-pline">
                <div className="v2-pid v2-pid-head">
                  <span className="v2-port-cat-name">{group.title}</span>
                </div>
                <div className="v2-port-row v2-port-group-head">
                  <div className="v2-row-block">
                    <span>Ср. вход</span>
                    <span>PnL %</span>
                    <span>Цена</span>
                  </div>
                  <div className="v2-row-block">
                    <span>Вложено</span>
                    <span>PnL $</span>
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

                const row = (
                  <div className="v2-pline">
                    <IdentityCard
                      asset={position.asset}
                      card={card}
                      staked={isStaked}
                      onOpen={card ? () => setSelected({ card, position }) : undefined}
                    />
                    <div className="v2-port-row">
                      <div className="v2-row-block">
                        <span className="v2-rb-val">{money(position.avgEntry)}</span>
                        <span className={`v2-rb-val v2-port-pnl ${tone}`}>{trendArrow(position.pnl)}{signedPct(position.pnlPct)}</span>
                        <span className="v2-rb-val">{money(position.currentPrice)}</span>
                      </div>
                      <div className="v2-row-block">
                        <strong className="v2-rb-val">{money(position.invested)}</strong>
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
              <span />
              <strong className="v2-port-stables-total">{money0.format(stablesTotal)}</strong>
              <span />
              <span />
            </div>
          </div>

          {stables.map((position) => {
            const meta = STABLE_META[position.asset] ?? { network: "—", purpose: "—", net: "" };
            return (
              <div className="v2-pline" key={position.asset}>
                <StableCard asset={position.asset} meta={meta} />
                <div className="v2-port-srow">
                  <span className="v2-port-purpose">{meta.purpose}</span>
                  <strong>{money(position.value)}</strong>
                  <span className="v2-port-share">{position.share.toFixed(1)}%</span>
                  <span className={`v2-port-status ${STATUS_TONE[position.status] ?? "is-hold"}`}>
                    {position.status}
                  </span>
                </div>
              </div>
            );
          })}
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
