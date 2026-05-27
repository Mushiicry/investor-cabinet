import type { CSSProperties } from "react";
import gaugeBg from "../../assets/fear-greed/gauge-bg.webp";
import { fgTone } from "../../lib/uiHelpers";
import type { FearGreed } from "../../types/portfolio";
import { Panel } from "../shared/Panel";

export function FearGreedGauge({
  data,
  isLoading = false,
  source = "live",
}: {
  data: FearGreed;
  isLoading?: boolean;
  source?: "cache" | "fallback" | "live";
}) {
  const isSyncingWithoutFreshValue = isLoading && source === "fallback";
  const tone = fgTone(data.value);
  const clampedValue = Math.max(0, Math.min(100, isSyncingWithoutFreshValue ? 50 : data.value));
  const needleAngle = -90 + (clampedValue / 100) * 180;
  const buyLadderRows = [
    { range: "30 - 100", action: "Наблюдение", size: "0%", mode: "Пассивный", active: !isSyncingWithoutFreshValue && clampedValue >= 30 },
    { range: "20 - 29", action: "Осторожная покупка", size: "1%", mode: "Активный", active: !isSyncingWithoutFreshValue && clampedValue >= 20 && clampedValue <= 29 },
    { range: "15 - 19", action: "Усиленная покупка", size: "1.5%", mode: "Агрессивный", active: !isSyncingWithoutFreshValue && clampedValue >= 15 && clampedValue <= 19 },
    { range: "0 - 14", action: "Агрессивная покупка", size: "2%", mode: "Максимальный", active: !isSyncingWithoutFreshValue && clampedValue <= 14 },
  ];

  return (
    <Panel tone={tone} className="fear-greed-panel fg-clean-panel h-full" hover>
      <div
        className="fg-image-gauge"
        style={{ "--fg-angle": `${needleAngle}deg` } as CSSProperties}
        aria-label={`Fear and Greed index ${clampedValue}`}
      >
        <img src={gaugeBg} alt="" className="fg-image-gauge-bg" />
        <div className="fg-image-bloom" aria-hidden="true" />
        <div className="fg-image-needle-wrap" aria-hidden="true">
          <div className="fg-image-needle" />
        </div>
        <div className="fg-image-center-value" aria-label={`Fear and Greed value ${isSyncingWithoutFreshValue ? "syncing" : clampedValue}`}>
          {isSyncingWithoutFreshValue ? "..." : clampedValue}
        </div>
      </div>

      <div className="fg-buy-ladder">
        <div className="fg-buy-ladder-table">
          {buyLadderRows.map((row) => (
            <div key={row.range} className={`fg-buy-row ${row.active ? "is-active" : ""}`.trim()}>
              <div className="fg-buy-cell">{row.range}</div>
              <div className="fg-buy-cell">{row.action}</div>
              <div className="fg-buy-cell">{row.size}</div>
              <div className="fg-buy-cell">
                <span className="fg-buy-mode">{row.mode}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="fg-buy-note">
          <div className="fg-buy-note-icon" aria-hidden="true" />
          <div>
            <div className="fg-buy-note-title">ВАЖНОЕ УТОЧНЕНИЕ</div>
            <div className="fg-buy-note-text">
              {isSyncingWithoutFreshValue ? (
                <>Синхронизируем индекс. До live-значения сигнал не используется.</>
              ) : (
                <>По данной стратегии допускается только <strong>1 покупка в неделю.</strong></>
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
