import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import type { PortfolioHistoryPoint } from "../../types/portfolio";
import { V2PortfolioHeroCard } from "./V2PortfolioHeroCard";

type Props = {
  portfolio: V2Portfolio;
  history?: PortfolioHistoryPoint[];
  capitalOpen?: boolean;
  onToggleCapital?: () => void;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function MoneyValue({ value, className = "" }: { value: number; className?: string }) {
  const formatted = money.format(value).replace(/^\$/, "");
  return (
    <strong className={`top-metric-value ${className}`}>
      <span className="v2-phc-value-currency">$</span>
      {formatted}
    </strong>
  );
}

function HudCornerTL() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--tl" aria-hidden="true">
      <path d="M44 0.8 L0.8 0.8 L0.8 44" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M44 5.5 L5.5 5.5 L5.5 44" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
      <line x1="20" y1="0.8" x2="20" y2="5" stroke="rgba(86,196,240,0.5)" strokeWidth="1" />
    </svg>
  );
}
function HudCornerTR() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--tr" aria-hidden="true">
      <path d="M0 0.8 L43.2 0.8 L43.2 44" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M0 5.5 L38.5 5.5 L38.5 44" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
      <line x1="24" y1="0.8" x2="24" y2="5" stroke="rgba(86,196,240,0.5)" strokeWidth="1" />
    </svg>
  );
}
function HudCornerBL() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--bl" aria-hidden="true">
      <path d="M44 43.2 L0.8 43.2 L0.8 0" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M44 38.5 L5.5 38.5 L5.5 0" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
    </svg>
  );
}
function HudCornerBR() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--br" aria-hidden="true">
      <path d="M0 43.2 L43.2 43.2 L43.2 0" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M0 38.5 L38.5 38.5 L38.5 0" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

export function V2TopMetrics({ portfolio, capitalOpen = false, onToggleCapital }: Props) {
  return (
    <header className="v2-topbar">
      {/* Две карточки, отцентрованы над радаром (живут в колонке радара) */}
      <div className="v2-metrics-left">
        {/* ── Hero portfolio card ── */}
        <V2PortfolioHeroCard portfolio={portfolio} />

        {/* ── Вложено + Позиции — объединённая карточка ── */}
        <div className="v2-metric metric-card-beam v2-metric-split">
          <HudCornerTL /><HudCornerTR /><HudCornerBL /><HudCornerBR />
          {/* row 1: labels — выровнены с "Портфель сегодня" */}
          <div className="v2-metric-split-labels">
            <span className="top-metric-label v2-metric-split-label">Вложено</span>
            <span className="top-metric-label v2-metric-split-label">Позиций</span>
          </div>
          {/* row 2: values — выровнены с "$501.90" */}
          <div className="v2-metric-split-values">
            <MoneyValue value={portfolio.totalInvested} />
            <div className="v2-metric-split-divider" aria-hidden="true" />
            <strong className="top-metric-value">{String(portfolio.positionsCount)}</strong>
          </div>
          {/* row 3: свободные деньги — кликабельно, раскрывает «Торговый капитал» */}
          <div className="v2-metric-split-reserve">
            <span className="top-metric-label v2-metric-split-reserve-label">из них свободных денег</span>
            <button
              type="button"
              className={`v2-free-toggle ${capitalOpen ? "is-open" : ""}`}
              onClick={onToggleCapital}
              aria-expanded={capitalOpen}
              title="Показать торговый капитал"
            >
              <MoneyValue value={portfolio.stableReserve} className={portfolio.stableReserve > 0 ? "" : "top-metric-value-negative"} />
              <svg className="v2-free-toggle-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
