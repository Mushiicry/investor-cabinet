import { useState } from "react";
import type { PortfolioHealth } from "../../lib/portfolioHealth";
import type { PlaybookCard } from "../../lib/playbookSelectors";
import type { V2Portfolio, V2Position, V2Risk } from "../InvestorCabinetV2Lab";
import type { InvestorStrategy } from "../lib/investorStrategy";
import type { MarketPsychology } from "../lib/marketPsychology";
import { V2RiskEnginePage } from "./V2RiskEnginePage";
import { V2ScenariosPage } from "./V2ScenariosPage";

export type V2ScenariosSection = "playbook" | "risk";

type AllocationItem = {
  name: string;
  share: number;
  value: number;
};

type Props = {
  initialSection?: V2ScenariosSection;
  playbook: PlaybookCard[];
  positions: V2Position[];
  portfolio: V2Portfolio;
  health: PortfolioHealth;
  risk: V2Risk;
  allocation: AllocationItem[];
  strategy?: InvestorStrategy;
  marketPsychology?: MarketPsychology;
};

export function V2ScenariosHubPage({
  initialSection = "playbook",
  playbook,
  positions,
  portfolio,
  health,
  risk,
  allocation,
  strategy,
  marketPsychology,
}: Props) {
  const [section, setSection] = useState<V2ScenariosSection>(initialSection);

  return (
    <section className="v2-scenarios-hub" aria-label="Сценарии и риск">
      <header className="v2-scenarios-hub__nav">
        <div className="v2-scenarios-hub__copy">
          <span className="v2-scenarios-hub__eyebrow">Сценарии</span>
          <strong>План действий и границы риска</strong>
          <p>Сначала определяем, что может произойти. Затем проверяем, что портфелю разрешено.</p>
        </div>

        <div className="v2-scenarios-hub__tabs" role="group" aria-label="Разделы сценариев">
          <button
            type="button"
            className={`v2-scenarios-hub__tab ${section === "playbook" ? "is-active" : ""}`}
            aria-pressed={section === "playbook"}
            onClick={() => setSection("playbook")}
          >
            <span>Сценарии и решения</span>
            <small>Что может произойти</small>
          </button>
          <button
            type="button"
            className={`v2-scenarios-hub__tab ${section === "risk" ? "is-active" : ""}`}
            aria-pressed={section === "risk"}
            onClick={() => setSection("risk")}
          >
            <span>Риск и ограничения</span>
            <small>Что портфелю разрешено</small>
          </button>
        </div>
      </header>

      {marketPsychology && (
        <section className={`v2-scenarios-hub__market is-${marketPsychology.gate.severity}`} aria-label="Рыночный контекст">
          <div>
            <span>Рыночный контекст · F&amp;G {marketPsychology.index}</span>
            <strong>{marketPsychology.emotion}</strong>
          </div>
          <p>{marketPsychology.disciplined}</p>
          <aside>
            <span>Опасное действие</span>
            <strong>{marketPsychology.dangerous}</strong>
          </aside>
        </section>
      )}

      <div className="v2-scenarios-hub__panel" hidden={section !== "playbook"}>
        <V2ScenariosPage playbook={playbook} positions={positions} />
      </div>
      <div className="v2-scenarios-hub__panel" hidden={section !== "risk"}>
        <V2RiskEnginePage
          portfolio={portfolio}
          health={health}
          risk={risk}
          allocation={allocation}
          strategy={strategy}
        />
      </div>
    </section>
  );
}
