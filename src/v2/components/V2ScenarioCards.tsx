import type { V2Scenario } from "../InvestorCabinetV2Lab";

type Props = {
  scenarios: V2Scenario[];
};

export function V2ScenarioCards({ scenarios }: Props) {
  return (
    <section className="v2-panel v2-card-list">
      <div className="v2-panel-kicker">Scenario Cards</div>
      {scenarios.map((scenario) => (
        <article className="v2-scenario-card" key={scenario.asset}>
          <div>
            <strong>{scenario.asset}</strong>
            <span>{scenario.actionZone}</span>
          </div>
          <p>{scenario.baseCase}</p>
          <div className="v2-scenario-grid">
            <span>Bull: {scenario.bullCase}</span>
            <span>Bear: {scenario.bearCase}</span>
            <span>Invalidation: {scenario.invalidation}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
