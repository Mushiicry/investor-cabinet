import { useState, type ReactNode } from "react";
import type { PortfolioHealth } from "../../lib/portfolioHealth";
import type { InvestorTransaction } from "../../types/portfolio";
import type { V2Page, V2Portfolio, V2Position } from "../InvestorCabinetV2Lab";
import { V2InvestorModal, computeLevel, getLevelTitle } from "./V2InvestorModal";
import { useAuth } from "../../hooks/useAuth";

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
    label: "Здоровье",
    page: "health",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M9 15.5C5 13.5 2 10.8 2 7.5a4 4 0 016-3.46A4 4 0 0116 7.5c0 3.3-3 6-7 8z" />
        <path d="M6 9h1.5l1-2.5 1.5 5 1-2.5H13" strokeLinecap="round" strokeLinejoin="round" />
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
    page: "reports",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="2" width="12" height="14" rx="1.6" />
        <path d="M6 6h6M6 9h6M6 12h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Сигналы",
    page: "signals",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M9 2a4 4 0 00-4 4c0 4-1.6 5-1.6 5h11.2S13 10 13 6a4 4 0 00-4-4z" />
        <path d="M7.4 14a1.6 1.6 0 003.2 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Проверка",
    page: "gate",
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M9 1.8l6 2.6v4.2c0 3.6-2.5 6.3-6 7.6-3.5-1.3-6-4-6-7.6V4.4L9 1.8z" />
        <path d="M6.4 9l1.8 1.9L11.8 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Настройки",
    page: "settings",
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
  healthFactor: number;
  healthStatus: string;
  portfolio: V2Portfolio;
  health: PortfolioHealth;
  positions?: V2Position[];
  transactions?: InvestorTransaction[];
  profileName: string;
  collapsed?: boolean;
  profileAvatar: string;
  onOpenAuth: (tab: "signin" | "signup") => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

const mainNavItems = navItems.filter(i => i.label !== "Настройки");
const settingsItem  = navItems.find(i => i.label === "Настройки")!;

export function V2Sidebar({ activePage, onNavigate, healthFactor, healthStatus, portfolio, health, positions = [], transactions = [], profileName, profileAvatar, onOpenAuth, mobileOpen = false, onCloseMobile, collapsed = false }: Props) {
  const { configured, user, displayName, signOut } = useAuth();
  const [levelOpen, setLevelOpen] = useState(false);
  const { level } = computeLevel(healthFactor);
  const levelTitle = getLevelTitle(level);
  const renderItem = (item: typeof navItems[0]) => {
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
  };

  const statusColors: Record<string, string> = {
    CONTROL: "#5af08d",
    BALANCED: "#e8b35a",
    RISK: "#ff5d6c",
  };
  const statusColor = statusColors[healthStatus] ?? "#5af8ff";

  return (
    <aside className={[
      "v2-sidebar",
      mobileOpen ? "is-mobile-open" : "",
      collapsed ? "is-collapsed" : "",
    ].filter(Boolean).join(" ")}>

      <button className="v2-sidebar-mob-close" type="button" aria-label="Закрыть меню" onClick={onCloseMobile}>
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
        </svg>
      </button>
      <div className="v2-brand">
        <div className="v2-brand-mark">
          {profileAvatar
            ? <img src={profileAvatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            : "M"
          }
        </div>
        <div>
          <div className="v2-brand-title">Mushii Invest</div>
          <div className="v2-brand-subtitle">Risk First / PnL Second</div>
        </div>
      </div>

      <nav className="v2-nav" aria-label="V2 Lab navigation">
        {mainNavItems.map(renderItem)}
      </nav>

      <div className="v2-sidebar-profile">
        <button className="v2-sidebar-profile-btn" type="button" onClick={() => setLevelOpen(true)}>
          <span className="v2-sidebar-profile-dot" style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}99` }} />
          <div className="v2-sidebar-profile-info">
            <span className="v2-sidebar-profile-name">{levelTitle}</span>
            <span className="v2-sidebar-profile-title">Уровень {level}</span>
          </div>
          <svg className="v2-sidebar-profile-arrow" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M4 2l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="v2-nav-bottom">
        {renderItem(settingsItem)}

        {configured && (
          user ? (
            <div className="v2-auth-account">
              <div className="v2-auth-account-info">
                <span className="v2-auth-account-name">{displayName || "Аккаунт"}</span>
                <span className="v2-auth-account-email">{user.email}</span>
              </div>
              <button
                className="v2-auth-btn v2-auth-btn--logout"
                type="button"
                onClick={() => signOut()}
              >
                Выйти
              </button>
            </div>
          ) : (
            <div className="v2-auth-actions">
              <button
                className="v2-auth-btn v2-auth-btn--signin"
                type="button"
                onClick={() => onOpenAuth("signin")}
              >
                Вход
              </button>
              <button
                className="v2-auth-btn v2-auth-btn--signup"
                type="button"
                onClick={() => onOpenAuth("signup")}
              >
                Регистрация
              </button>
            </div>
          )
        )}
      </div>

      {levelOpen && (
        <V2InvestorModal
          portfolio={portfolio}
          health={health}
          positions={positions}
          transactions={transactions}
          profileName={profileName}
          onClose={() => setLevelOpen(false)}
        />
      )}
    </aside>
  );
}
