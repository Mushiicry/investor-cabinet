import { getPortfolioStatusBadgeClass } from "../../lib/portfolioPresentation";

export function PortfolioStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`status-badge ${getPortfolioStatusBadgeClass(status)}`}
      title={status}
    >
      {status}
    </span>
  );
}
