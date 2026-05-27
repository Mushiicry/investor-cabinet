import { useMemo } from "react";
import { getMoodData } from "../../lib/moodData";
import { Panel } from "../shared/Panel";

export function MoodSummary() {
  const mood = useMemo(() => getMoodData(), []);

  return (
    <Panel tone="cyan" className="p-6 mood-panel" hover>
      <div className="section-kicker mood-kicker text-cyan-300">MY MOOD</div>
      <div className="section-title">Краткий вывод</div>

      <div className="mood-grid">
        <div className="mood-card mood-card-primary">
          <div className="mood-card-label">Текущий рынок</div>
          <div className="mood-card-text">{mood.currentMarket}</div>
        </div>

        <div className="mood-card mood-card-window">
          <div className="mood-card-label">Окно агрессивных покупок</div>
          <div className="mood-window-date">{mood.buyWindow}</div>
          <div className="mood-countdown">{mood.countdownLabel}</div>
        </div>

        <div className="mood-card">
          <div className="mood-card-label">Предполагаемая волна - крипта</div>
          <div className="mood-card-text">{mood.cryptoWave}</div>
        </div>

        <div className="mood-card">
          <div className="mood-card-label">Предполагаемая волна - золото</div>
          <div className="mood-card-text">{mood.goldWave}</div>
        </div>

        <div className="mood-card">
          <div className="mood-card-label">Предполагаемая волна - акции</div>
          <div className="mood-card-text">{mood.stocksWave}</div>
        </div>

        <div className="mood-card mood-card-logic">
          <div className="mood-card-label">Циклы, халвинг, сантимент, шкала эмоций</div>
          <div className="mood-card-text">{mood.cycleLogic}</div>
        </div>
      </div>
    </Panel>
  );
}
