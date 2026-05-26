import { Panel } from "../shared/Panel";
import type { PortfolioState } from "../../types/portfolio";
import { PortfolioTable } from "./PortfolioTable";

type PortfolioPageProps = {
  data: PortfolioState;
};

export function PortfolioPage({ data }: PortfolioPageProps) {
  return (
    <div className="space-y-6">
      <Panel tone="cyan" className="p-6 portfolio-header-panel" hover>
        <div className="section-kicker portfolio-kicker text-cyan-300">PORTFOLIO</div>
        <div className="section-title portfolio-title">Все позиции</div>
      </Panel>

      <PortfolioTable portfolio={data.portfolio} />
    </div>
  );
}
