import { useEffect, useRef, useState } from "react";
import type { PortfolioHealth } from "../../lib/portfolioHealth";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import {
  buildLevelCards,
  currentLadderLevel,
  MAX_LADDER_LEVEL,
  type LevelCard,
} from "../lib/levelLadder";
import { persistMaxLevel, readMaxLevel } from "../lib/levelProgress";

type Props = { health: PortfolioHealth; portfolio: V2Portfolio };

const STATUS_LABEL: Record<LevelCard["status"], string> = {
  done: "ПРОЙДЕН",
  current: "ВЫ ЗДЕСЬ",
  locked: "ЗАКРЫТ",
};

/**
 * Лестница уровней: горизонтальные карточки со свайпом.
 * Пройденный уровень гаснет, но показывает что закрыто и какая награда получена;
 * текущий — прогресс и что осталось; закрытый — требования и будущая награда.
 */
export function V2LevelLadder({ health, portfolio }: Props) {
  // Уровень не сгорает: фиксируем максимум достигнутого и больше не опускаем.
  const hfLevel = currentLadderLevel(health.healthFactor);
  const [maxLevel, setMaxLevel] = useState(() => Math.max(readMaxLevel(), hfLevel));
  useEffect(() => {
    setMaxLevel(persistMaxLevel(hfLevel));
  }, [hfLevel]);

  const cards = buildLevelCards(health, portfolio, maxLevel);
  const currentIdx = Math.max(0, cards.findIndex((c) => c.status === "current"));
  const [active, setActive] = useState(currentIdx);
  const trackRef = useRef<HTMLDivElement>(null);

  // На открытии проматываем к текущему уровню — «вы здесь».
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[currentIdx] as HTMLElement | undefined;
    if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "auto" });
  }, [currentIdx]);

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const children = Array.from(track.children) as HTMLElement[];
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    children.forEach((el, i) => {
      const mid = el.offsetLeft - track.offsetLeft + el.clientWidth / 2;
      const d = Math.abs(mid - center);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setActive(best);
  };

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[i] as HTMLElement | undefined;
    if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  };

  return (
    <div className="v2-lad">
      <div className="v2-lad-head">
        <span className="v2-lad-title">Путь инвестора</span>
        <span className="v2-lad-counter">{active + 1} / {MAX_LADDER_LEVEL}</span>
      </div>

      <div className="v2-lad-track" ref={trackRef} onScroll={onScroll}>
        {cards.map((c) => (
          <article key={c.level} className={`v2-lad-card is-${c.status}`}>
            <header className="v2-lad-card-head">
              <div className="v2-lad-lvl">
                <span className="v2-lad-lvl-num">{c.level}</span>
                <span className="v2-lad-lvl-cap">LVL</span>
              </div>
              <div className="v2-lad-name-wrap">
                <span className="v2-lad-name">{c.title}</span>
                <span className="v2-lad-focus">{c.focus}</span>
              </div>
              <span className={`v2-lad-status is-${c.status}`}>{STATUS_LABEL[c.status]}</span>
            </header>

            {/* Шкала здоровья: от порога входа до порога следующего уровня */}
            <div className="v2-lad-scale">
              <span className="v2-lad-scale-from">{c.hfFrom}</span>
              <div className="v2-lad-scale-track">
                <span className="v2-lad-scale-fill" style={{ width: `${c.progressPct}%` }} />
              </div>
              <span className="v2-lad-scale-to">{c.hfTo}</span>
            </div>

            {/* Награда — крупно, как приз */}
            <div className="v2-lad-reward">
              {c.rewardUsd > 0 ? (
                <>
                  <span className={`v2-lad-reward-sum${c.status === "locked" ? " is-locked" : ""}`}>
                    {c.status === "locked" && <span className="v2-lad-lock">🔒</span>}
                    ${c.rewardUsd}
                  </span>
                  <span className="v2-lad-reward-cap">
                    {c.status === "done"
                      ? "получено · выведено себе"
                      : "вывести себе из крипты"}
                  </span>
                </>
              ) : (
                <>
                  <span className="v2-lad-reward-sum is-start">СТАРТ</span>
                  <span className="v2-lad-reward-cap">базовый уровень, без выплаты</span>
                </>
              )}
            </div>

            <div className="v2-lad-progress-line">
              {c.status === "done" && <>Опыт получен: <b>{c.xpMax} XP</b></>}
              {c.status === "current" && (
                c.xpDrained ? (
                  <span className="v2-lad-drained">
                    Опыт просел до <b>0 / {c.xpMax} XP</b> — здоровье ниже {c.hfFrom}.
                    Уровень сохранён, награда остаётся за тобой.
                  </span>
                ) : (
                  <>Опыт: <b>{c.xpCurrent} / {c.xpMax} XP</b> · до LVL {c.level + 1} ещё <b>{c.hfToNext}</b></>
                )
              )}
              {c.status === "locked" && <>Откроется при здоровье <b>{c.hfFrom}</b></>}
            </div>

            <div className="v2-lad-ach-cap">Что закрыть</div>
            <div className="v2-lad-ach-list">
              {c.achievements.map((a) => (
                <div key={a.id} className={`v2-lad-ach ${a.unlocked ? "is-on" : "is-off"}`}>
                  <span className="v2-lad-ach-mark">{a.unlocked ? "★" : "○"}</span>
                  <div className="v2-lad-ach-body">
                    <span className="v2-lad-ach-name">{a.name}</span>
                    <span className="v2-lad-ach-desc">{a.desc}</span>
                  </div>
                  {!a.unlocked && a.target !== undefined && (
                    <span className="v2-lad-ach-prog">{Math.round(a.progress ?? 0)}/{a.target}</span>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="v2-lad-dots">
        {cards.map((c, i) => (
          <button
            key={c.level}
            type="button"
            aria-label={`Уровень ${c.level}`}
            className={`v2-lad-dot${i === active ? " is-active" : ""} is-${c.status}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
