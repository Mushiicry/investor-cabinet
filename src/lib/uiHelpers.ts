export type CardRarity = "legendary" | "epic" | "rare" | "common" | "defense" | "risk";

export function fgTone(value: number): "cyan" | "yellow" | "violet" {
  if (value < 25) return "violet";
  if (value < 55) return "yellow";
  return "cyan";
}

export function getAttackMetricClass(value: number): string {
  return value >= 6 ? "playbook-profit-high" : "playbook-profit-low";
}

export function getRiskMetricClass(value: number): string {
  return value >= 5 ? "playbook-risk-high" : "playbook-risk-low";
}

export function getProfitColor(value: number): "red" | "green" {
  return value >= 6 ? "green" : "red";
}

export function buildRiskRadarPolygon(values: number[], size = 380) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.37;
  return values
    .map((value, index) => {
      const angle = (-90 + index * 72) * (Math.PI / 180);
      const r = radius * (value / 100);
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");
}

export function buildRiskRadarGrid(level: number, count = 5, size = 380) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.37 * level;
  return Array.from({ length: count })
    .map((_, index) => {
      const angle = (-90 + index * 72) * (Math.PI / 180);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");
}

export function statusTone(status: string): "cyan" | "violet" | "yellow" {
  if (status === "Наблюдать") return "yellow";
  if (status === "Накапливать") return "violet";
  return "cyan";
}

export function assetGlyph(asset: string): string {
  const map: Record<string, string> = {
    BTC: "₿",
    ETH: "Ξ",
    SOL: "S",
    TON: "T",
    BNB: "B",
    TIA: "T",
    APEX: "A",
    MNT: "M",
    "MNT LONG": "M",
    "GOLD LONG": "G",
    "BTC LONG": "₿",
    "BTC SHORT": "₿",
    USDT: "$",
  };
  return map[asset] ?? asset[0];
}

export function assetRarity(asset: string): CardRarity {
  if (asset === "BTC") return "legendary";
  if (asset === "ETH") return "epic";
  if (asset === "SOL" || asset === "BNB") return "rare";
  if (asset === "GOLD LONG" || asset === "USDT") return "defense";
  if (asset === "BTC SHORT" || asset === "BTC LONG" || asset === "MNT LONG" || asset === "APEX") return "risk";
  return "common";
}

export function cardNumbers(asset: string): { attack: number; risk: number; className: string; title: string } {
  const map: Record<string, { attack: number; risk: number; className: string; title: string }> = {
    BTC: { attack: 9, risk: 2, className: "boss", title: "Легендарная карта цикла" },
    ETH: { attack: 8, risk: 3, className: "epic", title: "Эпическая карта ядра" },
    SOL: { attack: 8, risk: 6, className: "rare", title: "Редкая карта импульса" },
    TON: { attack: 6, risk: 5, className: "common", title: "Тактическая карта" },
    BNB: { attack: 6, risk: 4, className: "rare", title: "Редкая карта устойчивости" },
    TIA: { attack: 7, risk: 7, className: "common", title: "Спекулятивная карта" },
    APEX: { attack: 9, risk: 9, className: "risk", title: "Опасная карта" },
    MNT: { attack: 7, risk: 7, className: "common", title: "Спекулятивная карта" },
    "GOLD LONG": { attack: 3, risk: 1, className: "defense", title: "Защитная карта" },
    "BTC LONG": { attack: 8, risk: 8, className: "risk", title: "Лонг-карта" },
    "BTC SHORT": { attack: 8, risk: 8, className: "risk", title: "Шорт-карта" },
    "MNT LONG": { attack: 7, risk: 8, className: "risk", title: "Фьючерсная карта" },
    USDT: { attack: 2, risk: 1, className: "defense", title: "Резервная карта" },
  };
  return map[asset] ?? { attack: 5, risk: 5, className: "common", title: "Карточка актива" };
}
