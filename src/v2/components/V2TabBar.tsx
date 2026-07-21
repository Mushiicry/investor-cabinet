import type { V2Page } from "../InvestorCabinetV2Lab";

type Props = {
  activePage: V2Page;
  onNavigate: (page: V2Page) => void;
  criticalCount?: number;
};

const TABS = [
  {
    page: "overview" as V2Page,
    label: "Обзор",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M9 2L2 7v9h5v-5h4v5h5V7L9 2z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    page: "portfolio" as V2Page,
    label: "Портфель",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M9 2v7h7A7 7 0 109 2z" />
        <path d="M9 9l5 5" opacity=".5" />
      </svg>
    ),
  },
  {
    page: "health" as V2Page,
    label: "Здоровье",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M15.3 4.6a3.6 3.6 0 00-5.1 0L9 5.8 7.8 4.6a3.6 3.6 0 10-5.1 5.1L9 16l6.3-6.3a3.6 3.6 0 000-5.1z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    page: "signals" as V2Page,
    label: "Сигналы",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M9 2a4.5 4.5 0 00-4.5 4.5c0 3.4-1.3 4.6-1.3 4.6h11.6s-1.3-1.2-1.3-4.6A4.5 4.5 0 009 2z" strokeLinejoin="round" />
        <path d="M7.6 14a1.6 1.6 0 002.8 0" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function V2TabBar({ activePage, onNavigate, criticalCount = 0 }: Props) {
  return (
    <nav className="v2-tab-bar" aria-label="Основная навигация">
      {TABS.map((tab) => (
        <button
          key={tab.page}
          type="button"
          className={[
            "v2-tab-item",
            activePage === tab.page ? "is-active" : "",
          ].filter(Boolean).join(" ")}
          onClick={() => onNavigate(tab.page)}
        >
          <span className="v2-tab-icon">
            {tab.icon}
            {tab.page === "signals" && criticalCount > 0 && (
              <span className="v2-tab-badge">{criticalCount}</span>
            )}
          </span>
          <span className="v2-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
