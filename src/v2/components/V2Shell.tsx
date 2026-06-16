import type { V2LabData } from "../InvestorCabinetV2Lab";
import { V2Allocation3D } from "./V2Allocation3D";
import { V2DecisionCards } from "./V2DecisionCards";
import { V2DeployableCapital } from "./V2DeployableCapital";
import { V2FearGreed } from "./V2FearGreed";
import { V2FearGreedStrategy } from "./V2FearGreedStrategy";
import { V2HealthCore } from "./V2HealthCore";
import { V2MarketTicker } from "./V2MarketTicker";
import { V2PortfolioHealth } from "./V2PortfolioHealth";
import { V2ScenarioCards } from "./V2ScenarioCards";
import { V2Sidebar } from "./V2Sidebar";
import { V2TopMetrics } from "./V2TopMetrics";

type Props = {
  data: V2LabData;
};

export function V2Shell({ data }: Props) {
  return (
    <div className="v2-lab">
      <V2Sidebar />
      <main className="v2-main">
        <section className="v2-command-grid" aria-label="Investor Cabinet V2 overview">
          <div className="v2-top-grid">
            <div className="v2-top-left">
              <div className="v2-metrics-area">
                <V2TopMetrics portfolio={data.portfolio} />
              </div>
              <div className="v2-hero-reactor">
                <V2HealthCore portfolio={data.portfolio} risk={data.risk} />
              </div>
              <V2PortfolioHealth risk={data.risk} />
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
          <div className="v2-analysis-row v2-analysis-row-2">
            <V2DecisionCards decisions={data.decisions} />
            <V2ScenarioCards scenarios={data.scenarios} />
          </div>
        </section>
        <V2MarketTicker ticker={data.ticker} />
      </main>
    </div>
  );
}
