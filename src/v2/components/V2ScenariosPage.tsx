import { useState } from "react";
import { CryptoLogo } from "../../components/crypto/CryptoLogo";
import type { PlaybookCard } from "../../lib/playbookSelectors";
import type { V2Position } from "../InvestorCabinetV2Lab";

type Props = {
  playbook: PlaybookCard[];
  positions: V2Position[];
};

const FULL_NAME: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", TON: "Toncoin",
  BNB: "BNB Chain", ATOM: "Cosmos", TIA: "Celestia", MNT: "Mantle",
  USDT: "Tether", USDC: "USD Coin", "GOLD LONG": "Gold Futures",
  "BTC LONG": "BTC Long", "BTC SHORT": "BTC Short", "MNT LONG": "MNT Long",
};

const STATUS_TONE: Record<string, string> = {
  ACCUMULATE: "sc-dot-buy",   Накапливать: "sc-dot-buy",
  WATCH: "sc-dot-watch",      Наблюдать:   "sc-dot-watch",
  HOLD: "sc-dot-hold",        Держать:     "sc-dot-hold",
  HEDGE: "sc-dot-hedge",      Хедж:        "sc-dot-hedge",
  RESERVE: "sc-dot-reserve",  Резерв:      "sc-dot-reserve",
  SPECULATION: "sc-dot-spec", Спекуляция:  "sc-dot-spec",
};

const STATUS_LABEL: Record<string, string> = {
  ACCUMULATE: "Накапливать", WATCH: "Наблюдать", HOLD: "Держать",
  HEDGE: "Хедж", RESERVE: "Резерв", SPECULATION: "Спекуляция",
};

function statusLabel(s: string) { return STATUS_LABEL[s] ?? s; }
function dotClass(s: string)    { return STATUS_TONE[s] ?? "sc-dot-hold"; }

function signedPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function BranchSvg() {
  return (
    <svg className="sc-branch-svg" viewBox="0 0 80 160" preserveAspectRatio="none" aria-hidden="true">
      <circle cx="8" cy="80" r="3.5" fill="rgba(86,196,240,0.7)" />
      <circle cx="8" cy="80" r="7" fill="none" stroke="rgba(86,196,240,0.2)" strokeWidth="1" />
      <path d="M 11 80 C 35 80 45 80 78 80"
        stroke="rgba(86,196,240,0.55)" strokeWidth="1.4" fill="none" strokeDasharray="3 3"
        className="sc-branch-base" />
      <circle cx="78" cy="80" r="2.5" fill="rgba(86,196,240,0.6)" />
      <path d="M 11 80 C 35 80 45 28 78 28"
        stroke="rgba(52,211,153,0.5)" strokeWidth="1.4" fill="none" strokeDasharray="3 3"
        className="sc-branch-bull" />
      <circle cx="78" cy="28" r="2.5" fill="rgba(52,211,153,0.55)" />
      <path d="M 11 80 C 35 80 45 132 78 132"
        stroke="rgba(248,113,113,0.45)" strokeWidth="1.4" fill="none" strokeDasharray="3 3"
        className="sc-branch-bear" />
      <circle cx="78" cy="132" r="2.5" fill="rgba(248,113,113,0.5)" />
      <line x1="78" y1="28" x2="78" y2="132" stroke="rgba(86,196,240,0.08)" strokeWidth="1" />
    </svg>
  );
}

export function V2ScenariosPage({ playbook, positions }: Props) {
  const positionSet = new Set(positions.map((p) => p.asset));
  const filteredCards = playbook.filter((c) => positionSet.has(c.asset));
  const cards = filteredCards.length > 0 ? filteredCards : playbook;

  const [selectedAsset, setSelectedAsset] = useState(cards[0]?.asset ?? "");
  const [animKey, setAnimKey] = useState(0);

  function selectAsset(asset: string) {
    if (asset === selectedAsset) return;
    setSelectedAsset(asset);
    setAnimKey((k) => k + 1);
  }

  const card = cards.find((c) => c.asset === selectedAsset) ?? cards[0];
  const pos  = positions.find((p) => p.asset === selectedAsset);
  if (!card) return null;

  const pnlClass = pos && pos.pnl >= 0 ? "sc-pos" : "sc-neg";

  return (
    <section className="v2-sc-page">

      {/* ── PAGE HEADER ── */}
      <div className="v2-sc-header">
        <div>
          <h2 className="v2-sc-title">Сценарии и решения</h2>
          <p className="v2-sc-sub">Сценарный анализ и инвестиционные решения по позициям</p>
        </div>
        <div className="v2-sc-header-chips">
          <span className="v2-sc-chip sc-chip-base">Базовый</span>
          <span className="v2-sc-chip sc-chip-bull">Рост</span>
          <span className="v2-sc-chip sc-chip-bear">Снижение</span>
        </div>
      </div>

      <div className="v2-sc-body">
        {/* ── LEFT ASSET RAIL ── */}
        <aside className="v2-sc-rail">
          <div className="v2-sc-rail-label">ПОЗИЦИИ</div>
          {cards.map((c) => {
            const p = positions.find((pos) => pos.asset === c.asset);
            const isActive = c.asset === selectedAsset;
            return (
              <button
                key={c.asset}
                type="button"
                className={`v2-sc-rail-item ${isActive ? "is-active" : ""}`}
                onClick={() => selectAsset(c.asset)}
              >
                <div className="v2-sc-rail-logo">
                  <CryptoLogo asset={c.asset} className="v2-sc-logo-img" />
                </div>
                <div className="v2-sc-rail-info">
                  <div className="v2-sc-rail-asset">
                    <span className="v2-sc-rail-name">{c.asset}</span>
                    <span className={`v2-sc-rail-dot ${dotClass(c.status)}`} />
                  </div>
                  <span className="v2-sc-rail-full">{FULL_NAME[c.asset] ?? c.asset}</span>
                  {p && (
                    <span className={`v2-sc-rail-pnl ${p.pnl >= 0 ? "sc-pos" : "sc-neg"}`}>
                      {signedPct(p.pnlPct)}
                    </span>
                  )}
                </div>
                {isActive && <div className="v2-sc-rail-active-bar" />}
              </button>
            );
          })}
        </aside>

        {/* ── MAIN PANEL ── */}
        <div className="v2-sc-panel" key={animKey}>

          {/* Asset Header Strip */}
          <div className="v2-sc-asset-head">
            <div className="v2-sc-asset-id">
              <div className="v2-sc-asset-logo">
                <CryptoLogo asset={card.asset} className="v2-sc-asset-logo-img" />
              </div>
              <div className="v2-sc-asset-names">
                <span className="v2-sc-asset-ticker">{card.asset}</span>
                <span className="v2-sc-asset-full">{FULL_NAME[card.asset] ?? card.asset}</span>
              </div>
              <div className={`v2-sc-status-badge ${dotClass(card.status)}`}>
                {statusLabel(card.status)}
              </div>
            </div>
            <div className="v2-sc-asset-meta">
              {pos && (
                <>
                  <div className="v2-sc-meta-item">
                    <span className="v2-sc-meta-label">Цена</span>
                    <span className="v2-sc-meta-val">
                      {pos.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="v2-sc-meta-item">
                    <span className="v2-sc-meta-label">PnL</span>
                    <span className={`v2-sc-meta-val ${pnlClass}`}>{signedPct(pos.pnlPct)}</span>
                  </div>
                  <div className="v2-sc-meta-item">
                    <span className="v2-sc-meta-label">Доля</span>
                    <span className="v2-sc-meta-val">{pos.share.toFixed(1)}%</span>
                  </div>
                </>
              )}
              <div className="v2-sc-meta-item">
                <span className="v2-sc-meta-label">Потенциал / Риск</span>
                <span className="v2-sc-meta-val">
                  <span style={{ color: "#56c4f0" }}>{card.attack}</span>
                  <span style={{ color: "rgba(141,167,181,0.4)", margin: "0 3px" }}>/</span>
                  <span style={{ color: "rgba(248,113,113,0.75)" }}>{card.risk}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Thesis + WhyHold — 2 cols */}
          <div className="v2-sc-context-grid">
            <div className="v2-sc-context-block">
              <span className="v2-sc-field-label">Инвестиционная идея</span>
              <p className="v2-sc-context-text">{card.thesis}</p>
            </div>
            {card.whyHold && (
              <div className="v2-sc-context-block">
                <span className="v2-sc-field-label">Почему держу</span>
                <p className="v2-sc-context-text">{card.whyHold}</p>
              </div>
            )}
          </div>

          {/* Expect — full width */}
          {card.expect && (
            <div className="v2-sc-expect">
              <span className="v2-sc-field-label">Что жду</span>
              <p className="v2-sc-expect-text">{card.expect}</p>
            </div>
          )}

          {/* Scenario Matrix */}
          <div className="v2-sc-matrix">
            <BranchSvg />
            <div className="v2-sc-columns">
              <div className="v2-sc-col sc-col-base">
                <div className="v2-sc-col-head">
                  <span className="v2-sc-col-icon">◈</span>
                  <span className="v2-sc-col-title">Базовый</span>
                  <span className="v2-sc-col-tag">Ожидаемый</span>
                </div>
                <p className="v2-sc-col-text">{card.base}</p>
              </div>
              <div className="v2-sc-col sc-col-bull">
                <div className="v2-sc-col-head">
                  <span className="v2-sc-col-icon">▲</span>
                  <span className="v2-sc-col-title">Бычий</span>
                  <span className="v2-sc-col-tag">Апсайд</span>
                </div>
                <p className="v2-sc-col-text">{card.bull}</p>
              </div>
              <div className="v2-sc-col sc-col-bear">
                <div className="v2-sc-col-head">
                  <span className="v2-sc-col-icon">▼</span>
                  <span className="v2-sc-col-title">Медвежий</span>
                  <span className="v2-sc-col-tag">Риск</span>
                </div>
                <p className="v2-sc-col-text">{card.bear}</p>
              </div>
            </div>
          </div>

          {/* РЕШЕНИЕ — full width highlighted */}
          <div className="v2-sc-decision-block">
            <span className="v2-sc-field-label">
              <span className="v2-sc-bottom-icon">⊕</span> Решение
            </span>
            <p className="v2-sc-decision-text">{card.nextAction}</p>
          </div>

          {/* Invalidation + Action Zone — 2 cols */}
          <div className="v2-sc-bottom">
            <div className="v2-sc-invalidation">
              <div className="v2-sc-bottom-label">
                <span className="v2-sc-bottom-icon">⊗</span>
                Инвалидация
              </div>
              <p className="v2-sc-invalidation-text">{card.invalidation}</p>
            </div>
            <div className="v2-sc-action">
              <div className="v2-sc-bottom-label">
                <span className="v2-sc-bottom-icon">◎</span>
                Зона действия
              </div>
              <p className="v2-sc-action-text">{card.action}</p>
            </div>
          </div>

          {/* Scores strip */}
          <div className="v2-sc-scores-strip">
            <div className="v2-sc-score-item">
              <span className="v2-sc-score-label">Потенциал</span>
              <div className="v2-sc-score-bar-wrap">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`v2-sc-score-seg ${i < card.attack ? "is-on is-attack" : ""}`} />
                ))}
              </div>
              <span className="v2-sc-score-num is-attack">{card.attack}/10</span>
            </div>
            <div className="v2-sc-score-item">
              <span className="v2-sc-score-label">Риск</span>
              <div className="v2-sc-score-bar-wrap">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`v2-sc-score-seg ${i < card.risk ? "is-on is-risk" : ""}`} />
                ))}
              </div>
              <span className="v2-sc-score-num is-risk">{card.risk}/10</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
