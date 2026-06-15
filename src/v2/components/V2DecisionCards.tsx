import type { V2Decision } from "../InvestorCabinetV2Lab";

type Props = {
  decisions: V2Decision[];
};

export function V2DecisionCards({ decisions }: Props) {
  return (
    <section className="v2-panel v2-card-list">
      <div className="v2-panel-kicker">Decision Cards</div>
      {decisions.map((decision) => (
        <article className="v2-decision-card" key={decision.asset}>
          <div>
            <strong>{decision.asset}</strong>
            <span className={`v2-status-pill status-${decision.status.toLowerCase()}`}>{decision.status}</span>
          </div>
          <p>{decision.thesis}</p>
          <dl>
            <dt>Next action</dt>
            <dd>{decision.nextAction}</dd>
            <dt>Review trigger</dt>
            <dd>{decision.reviewTrigger}</dd>
          </dl>
        </article>
      ))}
    </section>
  );
}
