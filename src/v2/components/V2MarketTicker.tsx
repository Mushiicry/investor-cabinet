type TickerItem = {
  label: string;
  value: string;
  change: number;
};

type Props = {
  ticker: TickerItem[];
};

export function V2MarketTicker({ ticker }: Props) {
  return (
    <footer className="v2-ticker" aria-label="Market ticker">
      <div className="v2-ticker-label">Market Ticker</div>
      {ticker.map((item) => (
        <div className="v2-ticker-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <em className={item.change >= 0 ? "is-positive" : "is-negative"}>
            {item.change >= 0 ? "+" : ""}
            {(item.change * 100).toFixed(2)}%
          </em>
        </div>
      ))}
    </footer>
  );
}
