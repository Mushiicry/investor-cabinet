/* eslint-disable react-refresh/only-export-components -- хук/хелперы намеренно рядом с компонентом (личный инструмент) */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { PortfolioHealth, HealthComponent } from "../../lib/portfolioHealth";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

type Props = {
  portfolio: V2Portfolio;
  health: PortfolioHealth;
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

type Achievement = {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
};

function getAchievements(health: PortfolioHealth, portfolio: V2Portfolio): Achievement[] {
  const score = (key: string) =>
    health.components.find((c) => c.key === key)?.score ?? 0;

  return [
    {
      id: "guardian",
      name: "Страж портфеля",
      desc: "Здоровье портфеля выше 70",
      unlocked: health.healthFactor >= 70,
      progress: health.healthFactor,
      target: 70,
    },
    {
      id: "reserve",
      name: "Хранитель резерва",
      desc: "Резерв в умеренной зоне",
      unlocked: score("reserve") >= 50,
      progress: score("reserve"),
      target: 50,
    },
    {
      id: "futures",
      name: "Фьючерсы под контролем",
      desc: "Фьючерсная экспозиция в норме",
      unlocked: score("futures") >= 70,
      progress: score("futures"),
      target: 70,
    },
    {
      id: "diversification",
      name: "Диверсификатор",
      desc: "Диверсификация выше 60",
      unlocked: score("diversification") >= 60,
      progress: score("diversification"),
      target: 60,
    },
    {
      id: "flexibility",
      name: "Мастер гибкости",
      desc: "Гибкость портфеля выше 60",
      unlocked: score("flexibility") >= 60,
      progress: score("flexibility"),
      target: 60,
    },
    {
      id: "tencount",
      name: "Опытный позиционер",
      desc: "Держит 10+ позиций",
      unlocked: portfolio.positionsCount >= 10,
      progress: portfolio.positionsCount,
      target: 10,
    },
  ];
}

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

function AchievementRow({ a }: { a: Achievement }) {
  const progressPct = a.target ? Math.min(100, ((a.progress ?? 0) / a.target) * 100) : 100;

  return (
    <div className={`v2-im-ach ${a.unlocked ? "is-unlocked" : "is-locked"}`}>
      <span className="v2-im-ach-icon">{a.unlocked ? "★" : "○"}</span>
      <div className="v2-im-ach-body">
        <div className="v2-im-ach-head">
          <span className="v2-im-ach-name">{a.name}</span>
          {a.unlocked ? (
            <span className="v2-im-ach-badge">РАЗБЛОКИРОВАНО</span>
          ) : (
            <span className="v2-im-ach-progress">
              {a.progress}/{a.target}
            </span>
          )}
        </div>
        {!a.unlocked && (
          <div className="v2-im-ach-track">
            <span className="v2-im-ach-fill" style={{ width: `${progressPct}%` }} />
          </div>
        )}
        <span className="v2-im-ach-desc">{a.desc}</span>
      </div>
    </div>
  );
}

export const LEVEL_THRESHOLDS = [0, 40, 60, 75, 90, 101];

export const LEVEL_TITLES: Record<number, string> = {
  1:  "Ученик",
  2:  "Оператор",
  3:  "Аналитик",
  4:  "Исследователь",
  5:  "Планировщик",
  6:  "Стратег",
  7:  "Архитектор",
  8:  "Координатор",
  9:  "Аллокатор",
  10: "Управляющий",
  11: "Директор",
  12: "Партнёр",
  13: "Куратор фонда",
  14: "Хранитель резерва",
  15: "Мастер риска",
  16: "Архитектор капитала",
  17: "Хранитель богатства",
  18: "Суверенный управляющий",
  19: "Владыка фонда",
  20: "Легенда капитала",
};

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? LEVEL_TITLES[20];
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

export function V2InvestorModal({ portfolio, health, onClose }: Props) {
  const { level, xpCurrent, xpMax } = computeLevel(health.healthFactor);
  const xpFillPct = Math.round((xpCurrent / xpMax) * 100);
  const className = CLASS_BY_STATUS[portfolio.healthStatus] ?? "Стратегический инвестор";
  const achievements = getAchievements(health, portfolio);
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

        {/* ── Достижения ── */}
        <div className="v2-im-section">
          <div className="v2-im-section-title">
            <span className="v2-im-section-line" />
            ДОСТИЖЕНИЯ · {unlockedCount}/{achievements.length}
            <span className="v2-im-section-line" />
          </div>
          <div className="v2-im-achievements">
            {achievements.map((a) => (
              <AchievementRow key={a.id} a={a} />
            ))}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}