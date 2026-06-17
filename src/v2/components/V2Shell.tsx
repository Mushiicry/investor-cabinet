import type { V2LabData, V2Page } from "../InvestorCabinetV2Lab";
import { V2Allocation3D } from "./V2Allocation3D";
import { V2RiskEnginePage } from "./V2RiskEnginePage";
import { V2ScenariosPage } from "./V2ScenariosPage";
import { V2DeployableCapital } from "./V2DeployableCapital";
import { V2FearGreed } from "./V2FearGreed";
import { V2FearGreedStrategy } from "./V2FearGreedStrategy";
import { V2HealthCore } from "./V2HealthCore";
import { V2MarketPsychology } from "./V2MarketPsychology";
import { V2PortfolioHealth } from "./V2PortfolioHealth";
import { V2PortfolioPage } from "./V2PortfolioPage";
import { V2Sidebar } from "./V2Sidebar";
import { V2TopMetrics } from "./V2TopMetrics";

type Props = {
  data: V2LabData;
  page: V2Page;
  onNavigate: (page: V2Page) => void;
};

export function V2Shell({ data, page, onNavigate }: Props) {
  return (
    <div className="v2-lab">
      <V2Sidebar activePage={page} onNavigate={onNavigate} />
      <main className="v2-main">
        {page === "portfolio" ? (
          <V2PortfolioPage positions={data.positions} playbook={data.playbook} />
        ) : page === "scenarios" ? (
          <V2ScenariosPage playbook={data.playbook} positions={data.positions} />
        ) : page === "risk" ? (
          <V2RiskEnginePage
            portfolio={data.portfolio}
            health={data.health}
            risk={data.risk}
            allocation={data.allocation}
          />
        ) : (
        <section className="v2-command-grid" aria-label="Investor Cabinet V2 overview">
          <div className="v2-top-grid">
            <div className="v2-top-left">
              <div className="v2-metrics-area">
                <V2TopMetrics portfolio={data.portfolio} />
              </div>
              <div className="v2-hero-reactor">
                <V2HealthCore portfolio={data.portfolio} health={data.health} />
              </div>
              <V2PortfolioHealth health={data.health} />
            </div>
            <div className="v2-strategy-zone">
              <div className="v2-strategy-top">
                <div className="v2-right-top">
                  <V2FearGreed portfolio={data.portfolio} strategy={data.fearGreedStrategy} />
                </div>
                <V2FearGreedStrategy
                  variant="meta"
                  portfolio={data.portfolio}
                  strategy={data.fearGreedStrategy}
                />
              </div>
              <V2FearGreedStrategy
                variant="ladder"
                portfolio={data.portfolio}
                strategy={data.fearGreedStrategy}
              />
              <div className="v2-alloc-stables">
                <V2Allocation3D allocation={data.allocation} />
                <V2DeployableCapital
                  portfolio={data.portfolio}
                  strategy={data.fearGreedStrategy}
                />
              </div>
            </div>
          </div>
          <V2MarketPsychology />
        </section>
        )}
      </main>
    </div>
  );
}
