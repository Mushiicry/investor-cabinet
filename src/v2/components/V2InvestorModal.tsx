/* eslint-disable react-refresh/only-export-components -- хук/хелперы намеренно рядом с компонентом (личный инструмент) */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { V2LevelLadder } from "./V2LevelLadder";
import { getAchievements } from "../lib/levelLadder";
import type { PortfolioHealth, HealthComponent } from "../../lib/portfolioHealth";
import type { InvestorTransaction } from "../../types/portfolio";
import type { V2Portfolio, V2Position } from "../InvestorCabinetV2Lab";

type Props = {
  portfolio: V2Portfolio;
  health: PortfolioHealth;
  positions?: V2Position[];
  transactions?: InvestorTransaction[];
  onClose: () => void;
};

const CLASS_BY_STATUS: Record<string, string> = {
  CONTROL: "Управляющий капиталом",
  BALANCED: "Стратегический инвестор",
  RISK: "Начинающий стратег",
};

const STAT_ICONS: Record<string, string> = {
  reserve: "◈",
  crypto: "◆",
  futures: "↗",
  concentration: "⬡",
  diversification: "✦",
  flexibility: "◎",
};

const STAT_LABELS: Record<string, string> = {
  reserve: "Резерв",
  crypto: "Крипта",
  futures: "Фьючерсы",
  concentration: "Концентрация",
  diversification: "Диверсификация",
  flexibility: "Гибкость",
};

function StatBar({ component }: { component: HealthComponent }) {
  const color =
    component.score >= 70
      ? "rgba(90,240,141,0.9)"
      : component.score >= 45
      ? "rgba(232,179,90,0.9)"
      : "rgba(255,93,108,0.8)";

  return (
    <div className="v2-im-stat">
      <span className="v2-im-stat-icon">{STAT_ICONS[component.key] ?? "◈"}</span>
      <span className="v2-im-stat-name">{STAT_LABELS[component.key] ?? component.label}</span>
      <div className="v2-im-stat-track">
        <span
          className="v2-im-stat-fill"
          style={{ width: `${component.score}%`, background: color }}
        />
      </div>
      <span className="v2-im-stat-val" style={{ color }}>
        {component.score}
      </span>
    </div>
  );
}


// Пороги здоровья для уровней 1..5 (совпадают с hfFrom в LEVEL_LADDER).
export const LEVEL_THRESHOLDS = [0, 40, 60, 75, 90, 101];

export const LEVEL_TITLES: Record<number, string> = {
  1: "Ученик",
  2: "Оператор",
  3: "Аналитик",
  4: "Исследователь",
  5: "Планировщик",
};

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? LEVEL_TITLES[5];
}

export function computeLevel(hf: number): { level: number; xpCurrent: number; xpMax: number } {
  for (let i = LEVEL_THRESHOLDS.length - 2; i >= 0; i--) {
    if (hf >= LEVEL_THRESHOLDS[i]) {
      return {
        level: i + 1,
        xpCurrent: hf - LEVEL_THRESHOLDS[i],
        xpMax: LEVEL_THRESHOLDS[i + 1] - LEVEL_THRESHOLDS[i],
      };
    }
  }
  return { level: 1, xpCurrent: hf, xpMax: 40 };
}

export function V2InvestorModal({ portfolio, health, positions = [], transactions = [], onClose }: Props) {
  const { level, xpCurrent, xpMax } = computeLevel(health.healthFactor);
  const xpFillPct = Math.round((xpCurrent / xpMax) * 100);
  const className = CLASS_BY_STATUS[portfolio.healthStatus] ?? "Стратегический инвестор";
  const achievements = getAchievements({ health, portfolio, positions, transactions });
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div className="v2-im-overlay" onClick={onClose}>
      <div className="v2-im-panel" onClick={(e) => e.stopPropagation()}>

        {/* ── Шапка персонажа ── */}
        <div className="v2-im-header">
          <div className="v2-im-avatar">
            <span className="v2-im-avatar-letter">M</span>
          </div>
          <div className="v2-im-identity">
            <div className="v2-im-name">ИНВЕСТОР</div>
            <div className="v2-im-class">{className}</div>
            <div className="v2-im-xp-row">
              <div className="v2-im-xp-track">
                <span className="v2-im-xp-fill" style={{ width: `${xpFillPct}%` }} />
              </div>
              <span className="v2-im-xp-label">
                {xpCurrent} / {xpMax} XP → LVL {level + 1}
              </span>
            </div>
          </div>
          <div className="v2-im-level-badge">
            <span className="v2-im-lvl-num">{level}</span>
            <span className="v2-im-lvl-label">LVL</span>
          </div>
          <button className="v2-im-close" type="button" onClick={onClose}>✕</button>
        </div>

        {/* ── Характеристики ── */}
        <div className="v2-im-section">
          <div className="v2-im-section-title">
            <span className="v2-im-section-line" />
            ХАРАКТЕРИСТИКИ
            <span className="v2-im-section-line" />
          </div>
          <div className="v2-im-stats-grid">
            {health.components.map((c) => (
              <StatBar key={c.key} component={c} />
            ))}
          </div>
        </div>

        {/* ── Путь инвестора: уровни, достижения и денежные поощрения ── */}
        <div className="v2-im-section">
          <div className="v2-im-section-title">
            <span className="v2-im-section-line" />
            ПУТЬ · {unlockedCount}/{achievements.length} ДОСТИЖЕНИЙ
            <span className="v2-im-section-line" />
          </div>
          <V2LevelLadder health={health} portfolio={portfolio} positions={positions} transactions={transactions} />
        </div>

      </div>
    </div>,
    document.body
  );
}