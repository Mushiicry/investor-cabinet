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
    page: "trading" as V2Page,
    activePages: ["trading", "signals", "gate"] as V2Page[],
    label: "Торговля",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M5 2v14M13 2v14" strokeLinecap="round" />
        <rect x="3" y="5" width="4" height="6" rx="1" />
        <rect x="11" y="7" width="4" height="5" rx="1" />
      </svg>
    ),
  },
  {
    page: "scenarios" as V2Page,
    activePages: ["scenarios", "risk"] as V2Page[],
    label: "Сценарии",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="4" cy="9" r="1.6" />
        <path d="M5.6 9h2.8" strokeLinecap="round" />
        <circle cx="9" cy="4.5" r="1.6" />
        <circle cx="9" cy="13.5" r="1.6" />
        <path d="M8.4 9 6.4 4.5M8.4 9 6.4 13.5" strokeLinecap="round" />
        <path d="M10.6 4.5H14M10.6 13.5H14" strokeLinecap="round" opacity=".5" />
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
            activePage === tab.page || tab.activePages?.includes(activePage) ? "is-active" : "",
          ].filter(Boolean).join(" ")}
          onClick={() => onNavigate(tab.page)}
        >
          <span className="v2-tab-icon">
            {tab.icon}
            {tab.page === "trading" && criticalCount > 0 && (
              <span className="v2-tab-badge">{criticalCount}</span>
            )}
          </span>
          <span className="v2-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
