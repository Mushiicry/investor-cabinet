import type { Page } from "../../types/portfolio";

type SidebarProps = {
  page: Page;
  setPage: (page: Page) => void;
};

function SidebarIcon({ item }: { item: Page }) {
  switch (item) {
    case "Обзор":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 24h22" />
          <path d="M7 22l6-7 5 4 7-10" />
          <path d="M20 9h5v5" />
        </svg>
      );
    case "Портфель":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 5v11h11" />
          <path d="M16 5a11 11 0 1 1-9.2 5" />
          <path d="M16 16l7.8 7.8" />
        </svg>
      );
    case "Риск":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 4l10 4v7c0 6.2-4 10.6-10 13-6-2.4-10-6.8-10-13V8l10-4z" />
          <path d="M11 16l3 3 7-8" />
        </svg>
      );
    case "Сценарии и решения":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="10" />
          <circle cx="16" cy="16" r="4" />
          <path d="M16 2v6" />
          <path d="M16 24v6" />
          <path d="M2 16h6" />
          <path d="M24 16h6" />
        </svg>
      );
    case "Вход":
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="11" r="5" />
          <path d="M7 27c1.4-5.4 4.5-8 9-8s7.6 2.6 9 8" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar({ page, setPage }: SidebarProps) {
  const items: Page[] = ["Обзор", "Портфель", "Риск", "Сценарии и решения", "Вход"];
  return (
    <aside className="sidebar-root w-full lg:w-72 shrink-0">
      <div className="sidebar-shell lg:sticky lg:top-6">
        <div className="sidebar-hardware-glow" aria-hidden="true" />
        <div className="sidebar-hardware-frame" aria-hidden="true" />
        <div className="sidebar-edge sidebar-edge-left" aria-hidden="true" />
        <div className="sidebar-edge sidebar-edge-right" aria-hidden="true" />
        <div className="sidebar-corner sidebar-corner-tl" aria-hidden="true" />
        <div className="sidebar-corner sidebar-corner-br" aria-hidden="true" />
        <div className="sidebar-inner-panel" aria-hidden="true" />
        <div className="sidebar-reflection" aria-hidden="true" />
        <div className="sidebar-micro-hud" aria-hidden="true">
          <span className="sidebar-hud-corner sidebar-hud-corner-tl" />
          <span className="sidebar-hud-corner sidebar-hud-corner-tr" />
          <span className="sidebar-hud-corner sidebar-hud-corner-bl" />
          <span className="sidebar-hud-corner sidebar-hud-corner-br" />
          <span className="sidebar-circuit sidebar-circuit-top" />
          <span className="sidebar-circuit sidebar-circuit-bottom" />
          <span className="sidebar-node sidebar-node-one" />
          <span className="sidebar-node sidebar-node-two" />
          <span className="sidebar-node sidebar-node-three" />
        </div>
        <div className="sidebar-glow" aria-hidden="true" />
        <div className="sidebar-noise" aria-hidden="true" />
        <div className="sidebar-hud" aria-hidden="true" />
        <div className="sidebar-content">
          <div className="sidebar-head">
            <div className="sidebar-kicker">PATCH 6</div>
            <div className="sidebar-title">Кабинет</div>
            <div className="sidebar-title sidebar-title-second">инвестора</div>
          </div>
          <nav className="sidebar-nav">
            {items.map((item) => {
              const active = page === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={`sidebar-nav-btn ${active ? "sidebar-nav-btn-active" : ""}`}
                >
                  <span className="sidebar-nav-surface" aria-hidden="true" />
                  <span className="sidebar-nav-edge" aria-hidden="true" />
                  <span className="sidebar-nav-corners" aria-hidden="true" />
                  <span className="sidebar-nav-data-line" aria-hidden="true" />
                  <span className="sidebar-nav-shimmer" aria-hidden="true" />
                  <span className="sidebar-nav-icon">
                    <span className="sidebar-nav-icon-rim" aria-hidden="true" />
                    <span className="sidebar-nav-icon-core" aria-hidden="true" />
                    <span className="sidebar-nav-icon-ticks" aria-hidden="true" />
                    <SidebarIcon item={item} />
                  </span>
                  <span className="sidebar-nav-label">{item}</span>
                  <span className="sidebar-nav-dots" />
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
