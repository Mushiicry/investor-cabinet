import { CryptoLogo } from "../../components/crypto/CryptoLogo";
import type { PlaybookCard } from "../../lib/playbookSelectors";
import type { V2Position } from "../InvestorCabinetV2Lab";

type Props = {
  playbook: PlaybookCard[];
  positions: V2Position[];
};

const STATUS_STYLE: Record<string, string> = {
  ACCUMULATE: "dc-badge-accumulate",
  WATCH: "dc-badge-watch",
  HOLD: "dc-badge-hold",
  HEDGE: "dc-badge-hedge",
  RESERVE: "dc-badge-reserve",
  REDUCE: "dc-badge-reduce",
  SPECULATION: "dc-badge-spec",
  Накапливать: "dc-badge-accumulate",
  Наблюдать: "dc-badge-watch",
  Держать: "dc-badge-hold",
  Хедж: "dc-badge-hedge",
  Резерв: "dc-badge-reserve",
  Сократить: "dc-badge-reduce",
};

const STATUS_LABEL: Record<string, string> = {
  ACCUMULATE: "Накапливать",
  WATCH: "Наблюдать",
  HOLD: "Держать",
  HEDGE: "Хедж",
  RESERVE: "Резерв",
  REDUCE: "Сократить",
  SPECULATION: "Спекуляция",
};

const RARITY_CLASS: Record<string, string> = {
  legendary: "dc-rarity-legendary",
  epic: "dc-rarity-epic",
  rare: "dc-rarity-rare",
  common: "dc-rarity-common",
  defense: "dc-rarity-defense",
  risk: "dc-rarity-risk",
};

const FULL_NAME: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  TON: "TON",
  BNB: "BNB",
  ATOM: "Cosmos",
  TIA: "Celestia",
  MNT: "Mantle",
  USDT: "Tether",
  USDC: "USD Coin",
  "GOLD LONG": "Gold",
  "BTC LONG": "BTC Long",
  "BTC SHORT": "BTC Short",
  "MNT LONG": "MNT Long",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function V2DecisionsPage({ playbook, positions }: Props) {
  const positionSet = new Set(positions.map((p) => p.asset));
  const cards = playbook.filter((c) => positionSet.has(c.asset));

  return (
    <section className="v2-decisions-page">
      <div className="v2-decisions-header">
        <h2 className="v2-decisions-title">Decisions</h2>
        <p className="v2-decisions-sub">Текущие инвестиционные решения по портфелю</p>
      </div>
      <div className="v2-decisions-grid">
        {cards.map((card) => (
          <DecisionCard key={card.asset} card={card} />
        ))}
      </div>
    </section>
  );
}

function DecisionCard({ card }: { card: PlaybookCard }) {
  const rarityClass = RARITY_CLASS[card.rarity] ?? "dc-rarity-common";
  const badgeClass = STATUS_STYLE[card.status] ?? "dc-badge-hold";

  return (
    <article className={`v2-dc-card ${rarityClass}`}>
      <div className="v2-dc-head">
        <div className="v2-dc-id">
          <div className="v2-dc-logo">
            <CryptoLogo asset={card.asset} size={36} />
          </div>
          <div className="v2-dc-name-wrap">
            <span className="v2-dc-asset">{card.asset}</span>
            <span className="v2-dc-fullname">{FULL_NAME[card.asset] ?? card.asset}</span>
          </div>
        </div>
        <div className="v2-dc-meta">
          <span className={`v2-dc-badge ${badgeClass}`}>{statusLabel(card.status)}</span>
        </div>
      </div>

      <div className="v2-dc-rarity-row">
        <span className="v2-dc-rarity-title">{card.rarityTitle}</span>
        <div className="v2-dc-scores">
          <span className="v2-dc-score is-attack">
            <span className="v2-dc-score-dot" />
            Прибыль {card.attack}
          </span>
          <span className="v2-dc-score is-risk">
            <span className="v2-dc-score-dot" />
            Риск {card.risk}
          </span>
        </div>
      </div>

      <div className="v2-dc-thesis">
        <span className="v2-dc-field-label">Идея</span>
        <p className="v2-dc-field-text">{card.thesis}</p>
      </div>

      <div className="v2-dc-two-cols">
        <div className="v2-dc-col">
          <span className="v2-dc-field-label">Почему держу</span>
          <p className="v2-dc-field-text">{card.whyHold}</p>
        </div>
        <div className="v2-dc-col">
          <span className="v2-dc-field-label">Что жду</span>
          <p className="v2-dc-field-text">{card.expect}</p>
        </div>
      </div>

      <div className="v2-dc-action">
        <span className="v2-dc-field-label">Решение</span>
        <p className="v2-dc-action-text">{card.nextAction}</p>
      </div>

      <div className="v2-dc-trigger">
        <span className="v2-dc-field-label">Пересмотр</span>
        <p className="v2-dc-field-text is-dim">{card.reviewTrigger}</p>
      </div>
    </article>
  );
}
