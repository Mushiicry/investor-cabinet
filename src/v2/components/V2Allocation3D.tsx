import type { CSSProperties } from "react";
import {
  MAX_CRYPTO_EXPOSURE_SHARE,
  MAX_FUTURES_EXPOSURE_SHARE,
  RESERVE_TARGET_SHARE,
} from "../../config/riskRules";

type Allocation = {
  name: string;
  share: number; // доля 0..1
  value: number; // $ в категории
};

type Props = {
  allocation: Allocation[];
};

type LimitKind = "max" | "min" | "none";

// Холодная зимняя палитра + лимиты из политики (лист «Риск»)
const CFG: Record<
  string,
  { glyph: string; color: string; limit: number | null; limitKind: LimitKind }
> = {
  Крипта: { glyph: "₿", color: "#56d8f5", limit: MAX_CRYPTO_EXPOSURE_SHARE, limitKind: "max" },
  Металлы: { glyph: "◆", color: "#7aa6d8", limit: null, limitKind: "none" },
  Фьючерсы: { glyph: "↗", color: "#8f9ff0", limit: MAX_FUTURES_EXPOSURE_SHARE, limitKind: "max" },
  Акции: { glyph: "▲", color: "#6fb8e0", limit: null, limitKind: "none" },
  "Свободные деньги": { glyph: "$", color: "#5fe0cf", limit: RESERVE_TARGET_SHARE, limitKind: "min" },
};

const ORDER = ["Крипта", "Металлы", "Фьючерсы", "Акции", "Свободные деньги"];

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const pct = (share: number) => `${(share * 100).toFixed(1)}%`;

function statusOf(share: number, limit: number | null, kind: LimitKind) {
  if (limit === null || kind === "none") {
    return { text: "", kind: "none" as const, limitLabel: "" };
  }
  if (kind === "max") {
    const label = `лимит ${Math.round(limit * 100)}%`;
    return share > limit
      ? { text: "ВЫШЕ", kind: "high" as const, limitLabel: label }
      : { text: "OK", kind: "ok" as const, limitLabel: label };
  }
  // min — цель по нижней границе (резерв/кэш)
  const label = `цель ${Math.round(limit * 100)}%`;
  return share < limit
    ? { text: "НИЖЕ", kind: "high" as const, limitLabel: label }
    : { text: "OK", kind: "ok" as const, limitLabel: label };
}

export function V2Allocation3D({ allocation }: Props) {
  const sorted = [...allocation]
    .sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));

  return (
    <section className="v2-panel v2-allocation">
      <div className="v2-panel-header">
        <span>Распределение средств</span>
      </div>

      <div className="v2-alloc-cards">
        {sorted.map((item) => {
          const cfg = CFG[item.name] ?? {
            glyph: "•",
            color: "#6f86a6",
            limit: null,
            limitKind: "none" as LimitKind,
          };
          const status = statusOf(item.share, cfg.limit, cfg.limitKind);
          const fill = Math.max(0, Math.min(100, item.share * 100));

          return (
            <div
              className="v2-alloc-card"
              key={item.name}
              style={{ "--c": cfg.color } as CSSProperties}
            >
              <span className="v2-alloc-icon" aria-hidden="true">
                {cfg.glyph}
              </span>
              <div className="v2-alloc-main">
                <div className="v2-alloc-line">
                  <span className="v2-alloc-name">{item.name}</span>
                  <strong className="v2-alloc-pct">{pct(item.share)}</strong>
                </div>
                <div className="v2-alloc-sub">
                  <span className="v2-alloc-amount">{money.format(item.value)}</span>
                  <span className="v2-alloc-range">
                    {status.limitLabel}
                    {status.text ? (
                      <em className={`v2-alloc-status is-${status.kind}`}>{status.text}</em>
                    ) : null}
                  </span>
                </div>
                <div className="v2-alloc-track">
                  <span className="v2-alloc-fill" style={{ width: `${fill}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
