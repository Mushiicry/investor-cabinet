import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { V2LabData, V2Page } from "../InvestorCabinetV2Lab";
import type { HealthComponent } from "../../lib/portfolioHealth";
import { V2HealthDetailModal } from "./V2HealthDetailModal";
import { V2ReportsPage } from "./V2ReportsPage";
import { V2SignalsPage } from "./V2SignalsPage";
import { V2RiskEnginePage } from "./V2RiskEnginePage";
import { V2ScenariosPage } from "./V2ScenariosPage";
import { V2DeployableCapital } from "./V2DeployableCapital";
import { V2DCAStrategy } from "./V2DCAStrategy";
import { V2PortfolioAllocationCard } from "./V2PortfolioAllocationCard";
import { V2HealthCore } from "./V2HealthCore";
import { V2SettingsPage } from "./V2SettingsPage";
import { V2BtcDailyChart } from "./V2BtcDailyChart";
import { V2TabBar } from "./V2TabBar";

import { V2PortfolioPage } from "./V2PortfolioPage";
import { V2HealthPage } from "./V2HealthPage";
import { V2Sidebar } from "./V2Sidebar";
import { V2TopMetrics } from "./V2TopMetrics";
import { V2StarField } from "./V2StarField";

type Props = {
  data: V2LabData;
  page: V2Page;
  onNavigate: (page: V2Page) => void;
};

const DESKTOP_DESIGN_WIDTH = 1920;
const DESKTOP_DESIGN_HEIGHT = 1080;
const MOBILE_BREAKPOINT = 768;

function getDesktopViewport() {
  if (window.innerWidth <= MOBILE_BREAKPOINT) {
    return { scale: 1, logicalHeight: window.innerHeight };
  }

  const scale = Math.min(
    1,
    window.innerWidth / DESKTOP_DESIGN_WIDTH,
    window.innerHeight / DESKTOP_DESIGN_HEIGHT,
  );

  return {
    scale,
    logicalHeight: window.innerHeight / scale,
  };
}

export function V2Shell({ data, page, onNavigate }: Props) {
  const [profileName,   setProfileName]   = useState(() => localStorage.getItem("mushii-profile-name")   ?? "");
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem("mushii-profile-avatar") ?? "");
  const [selectedChip, setSelectedChip] = useState<HealthComponent | null>(null);
  const [capitalOpen, setCapitalOpen] = useState(false);
  const [desktopViewport, setDesktopViewport] = useState(getDesktopViewport);

  useEffect(() => {
    const updateViewport = () => setDesktopViewport(getDesktopViewport());
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  function handleSaveProfile(name: string, avatar: string) {
    setProfileName(name);
    setProfileAvatar(avatar);
    localStorage.setItem("mushii-profile-name",   name);
    localStorage.setItem("mushii-profile-avatar", avatar);
  }

  const criticalCount = useMemo(() => {
    const { portfolio } = data;
    let n = 0;
    if (portfolio.totalPortfolioValue > 0 && portfolio.stableReserve < portfolio.totalPortfolioValue * 0.05) n++;
    if (portfolio.totalPortfolioValue > 0 && portfolio.reserveShare < 0.10) n++;
    return n;
  }, [data.portfolio]);

  return (
    <div
      className="v2-lab"
      style={{
        "--v2-desktop-scale": desktopViewport.scale,
        "--v2-logical-height": `${desktopViewport.logicalHeight}px`,
      } as CSSProperties}
    >
      {/* Мобильная шапка (только ≤768px) */}
      <header className="v2-mob-header">
        <button className="v2-mob-hamburger" type="button" aria-label="Меню">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 5h14M2 9h14M2 13h14" strokeLinecap="round" />
          </svg>
        </button>
        <div className="v2-mob-brand">
          <span className="v2-mob-brand-title">MUSHII INVEST</span>
          <span className="v2-mob-brand-sub">RISK FIRST / PNL SECOND</span>
        </div>
        <button className="v2-mob-bell" type="button" aria-label="Уведомления">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M9 2a4 4 0 00-4 4c0 4-1.6 5-1.6 5h11.2S13 10 13 6a4 4 0 00-4-4z" />
            <path d="M7.4 14a1.6 1.6 0 003.2 0" strokeLinecap="round" />
          </svg>
          {criticalCount > 0 && <span className="v2-mob-bell-badge">{criticalCount}</span>}
        </button>
      </header>

      {/* Фото-фон космоса */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: -2,
        backgroundImage: 'url("/bg-space.png")',
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#00030a",
      }} aria-hidden="true" />
      {/* Живые звёзды и вспышки поверх фото */}
      <V2StarField />
      <V2Sidebar
        activePage={page}
        onNavigate={onNavigate}
        healthFactor={data.portfolio.healthFactor}
        healthStatus={data.portfolio.healthStatus}
        portfolio={data.portfolio}
        health={data.health}
        profileName={profileName}
        profileAvatar={profileAvatar}
      />
      <main className="v2-main">
        {page === "settings" ? (
          <V2SettingsPage
            initialName={profileName}
            initialAvatar={profileAvatar}
            onSave={handleSaveProfile}
          />
        ) : page === "signals" ? (
          <V2SignalsPage
            portfolio={data.portfolio}
            positions={data.positions}
            risk={data.risk}
            health={data.health}
            fearGreedStrategy={data.fearGreedStrategy}
            allocation={data.allocation}
          />
        ) : page === "reports" ? (
          <V2ReportsPage history={data.history} transactions={data.transactions} positions={data.positions} />
        ) : page === "portfolio" ? (
          <V2PortfolioPage positions={data.positions} playbook={data.playbook} />
        ) : page === "scenarios" ? (
          <V2ScenariosPage playbook={data.playbook} positions={data.positions} />
        ) : page === "health" ? (
          <V2HealthPage
            portfolio={data.portfolio}
            health={data.health}
          />
        ) : page === "risk" ? (
          <V2RiskEnginePage
            portfolio={data.portfolio}
            health={data.health}
            risk={data.risk}
            allocation={data.allocation}
          />
        ) : (
        <section className="v2-command-grid" aria-label="Investor Cabinet V2 overview">
          <V2TopMetrics
            portfolio={data.portfolio}
            history={data.history}
            capitalOpen={capitalOpen}
            onToggleCapital={() => setCapitalOpen((v) => !v)}
          />
          <div className={`v2-capital-dropdown ${capitalOpen ? "is-open" : ""}`}>
            <div className="v2-capital-dropdown-inner">
              <V2DeployableCapital
                portfolio={data.portfolio}
                strategy={data.fearGreedStrategy}
              />
            </div>
          </div>

          {/* Блок здоровья — на всю ширину */}
          <div className="v2-hero-reactor">
            <V2HealthCore portfolio={data.portfolio} health={data.health} onChipSelect={setSelectedChip} onNavigate={onNavigate} />
          </div>

          {/* Под радаром: распределение + DCA рядом */}
          <div className="v2-alloc-center-row">
            <div className="v2-alloc-center-inner">
              <span aria-hidden="true" className="v2-hud-corners" />
              <V2PortfolioAllocationCard allocation={data.allocation} total={data.portfolio.totalPortfolioValue} />
            </div>
            <div className="v2-alloc-dca-slot">
              <V2DCAStrategy
                portfolio={data.portfolio}
                strategy={data.fearGreedStrategy}
                onNavigate={onNavigate}
              />
            </div>
          </div>

          <V2BtcDailyChart currentFearGreed={data.fearGreedStrategy.currentIndex} />
        </section>
        )}
      </main>
      <V2TabBar activePage={page} onNavigate={onNavigate} criticalCount={criticalCount} />

      {selectedChip && (
        <V2HealthDetailModal
          component={selectedChip}
          portfolio={data.portfolio}
          onClose={() => setSelectedChip(null)}
        />
      )}
    </div>
  );
}
