import type { ReactNode } from "react";
import type { V2Page } from "../InvestorCabinetV2Lab";

const navItems: { label: string; icon: ReactNode; page?: V2Page }[] = [
  {
    label: "Обзор",
    page: "overview",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="2" y="2" width="6" height="6" rx="1.5" />
        <rect x="10" y="2" width="6" height="6" rx="1.5" />
        <rect x="2" y="10" width="6" height="6" rx="1.5" />
        <rect x="10" y="10" width="6" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Портфель",
    page: "portfolio",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M9 2v7h7A7 7 0 109 2z" />
        <path d="M9 9l5 5" opacity=".5" />
      </svg>
    ),
  },
  {
    label: "Сценарии",
    page: "scenarios",
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
    label: "Риск",
    page: "risk",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M9 1.8l6 2.6v4.2c0 3.6-2.5 6.3-6 7.6-3.5-1.3-6-4-6-7.6V4.4L9 1.8z" />
        <path d="M9 6v3.4" strokeLinecap="round" />
        <circle cx="9" cy="12" r=".8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Отчёты",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="2" width="12" height="14" rx="1.6" />
        <path d="M6 6h6M6 9h6M6 12h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Сигналы",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M9 2a4 4 0 00-4 4c0 4-1.6 5-1.6 5h11.2S13 10 13 6a4 4 0 00-4-4z" />
        <path d="M7.4 14a1.6 1.6 0 003.2 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Настройки",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="9" cy="9" r="2.5" />
        <path d="M9 2v2.2M9 13.8V16M2 9h2.2M13.8 9H16M4 4l1.6 1.6M12.4 12.4L14 14M14 4l-1.6 1.6M5.6 12.4L4 14" strokeLinecap="round" />
      </svg>
    ),
  },
];

type Props = {
  activePage: V2Page;
  onNavigate: (page: V2Page) => void;
};

export function V2Sidebar({ activePage, onNavigate }: Props) {
  return (
    <aside className="v2-sidebar">
      <div className="v2-brand">
        <div className="v2-brand-mark">M</div>
        <div>
          <div className="v2-brand-title">Mushii Invest</div>
          <div className="v2-brand-subtitle">Risk First / PnL Second</div>
        </div>
      </div>

      <nav className="v2-nav" aria-label="V2 Lab navigation">
        {navItems.map((item) => {
          const isActive = item.page === activePage;
          return (
            <button
              className={isActive ? "v2-nav-item is-active" : "v2-nav-item"}
              key={item.label}
              type="button"
              disabled={!item.page}
              onClick={() => item.page && onNavigate(item.page)}
            >
              <span className="v2-nav-icon">{item.icon}</span>
              <span className="v2-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
