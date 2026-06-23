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
    page: "risk" as V2Page,
    label: "Решения",
    isCenter: true,
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="9" cy="9" r="7" />
        <circle cx="9" cy="9" r="3.5" />
        <circle cx="9" cy="9" r=".9" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    page: "scenarios" as V2Page,
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
  {
    page: "settings" as V2Page,
    label: "Профиль",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="9" cy="6" r="3" />
        <path d="M2 16c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeLinecap="round" />
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
            tab.isCenter ? "is-center" : "",
          ].filter(Boolean).join(" ")}
          onClick={() => onNavigate(tab.page)}
        >
          <span className="v2-tab-icon">
            {tab.icon}
            {tab.page === "risk" && criticalCount > 0 && (
              <span className="v2-tab-badge">{criticalCount}</span>
            )}
          </span>
          <span className="v2-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
