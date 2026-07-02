import { useEffect } from "react";
import type { HealthComponent, HealthComponentKey } from "../../lib/portfolioHealth";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

type Props = {
  component: HealthComponent;
  portfolio: V2Portfolio;
  onClose: () => void;
};

const WHAT: Record<HealthComponentKey, string> = {
  reserve:
    "Ваша «подушка безопасности» — выделенный резерв (стейблы) относительно цели 30% от портфеля. По принципу Risk First резерв наполняется первым: в работу идёт только то, что сверх него. Резерв — это возможность докупать на просадке, не продавать в панике и спокойно пережить турбулентность.",
  crypto:
    "Сопротивление волатильности — экспозиция в волатильных активах (крипта) против лимита 60%. Выше лимита портфель слишком сильно зависит от движений самого волатильного класса, и любая просадка рынка бьёт непропорционально сильно.",
  futures:
    "Дисциплина фьючерсов: 100 баллов без позиций. За каждую открытую позицию, используемое плечо и занятую часть лимита маржи снимаются баллы. Лимиты: начальная маржа ≤10% от вложенного капитала, ≤2x на альтах, ≤3x на BTC и золоте, максимум 3 позиции. GOLD остаётся категорией «Металлы», но его плечо контролируется по тому же правилу (≤3x) и учитывается в лимите позиций; маржа GOLD в лимит 10% пока не входит.",
  concentration:
    "Максимальная доля одного актива в портфеле. Лимит 35% — при резком падении этого актива потери будут непропорционально большими. Диверсификация снижает зависимость портфеля от одного события или актива.",
  diversification:
    "Равномерность распределения по разным классам активов: крипта, металлы, фьючерсы, акции. Чем более равномерно — тем устойчивее портфель к шокам в отдельных секторах рынка.",
  flexibility:
    "Запас манёвра — ликвидный кэш для быстрых и выгодных решений. Гибкость — это не просто безопасность, это конкурентное преимущество: покупать лучшие активы в лучший момент, когда другие вынуждены продавать.",
};

const HOW: Record<HealthComponentKey, string[]> = {
  reserve: [
    "Пополните счёт долларами или снизьте часть позиций в стейблы",
    "Не покупайте, пока не накопите резерв — сначала подушка, потом докупки",
    "Цель — не менее 30% портфеля в выделенном резерве",
  ],
  crypto: [
    "Зафиксируйте часть прибыли на волатильных позициях в стейблы",
    "Распределите часть в металлы, акции или другие классы активов",
    "В зоне жадности (F&G > 70) снижайте экспозицию — в зоне страха можно держать выше",
  ],
  futures: [
    "Снизьте плечо до лимита: ≤2x на альтах, ≤3x на BTC и золоте",
    "Сократите начальную маржу фьючерсов до ≤10% от вложенного капитала",
    "При высоком плече первая задача — снять риск ликвидации",
  ],
  concentration: [
    "Распределите часть крупнейшей позиции в другие активы",
    "Ни один актив не должен превышать 35% портфеля",
    "Не усредняйтесь в актив, который уже превышает лимит концентрации",
  ],
  diversification: [
    "Добавьте другой класс активов — металлы, акции или стейблы",
    "Не держите более 80% в одном классе активов",
    "Балансируйте распределение раз в квартал или при значимом изменении портфеля",
  ],
  flexibility: [
    "Выведите часть позиций с невысоким потенциалом в кэш",
    "Держите свободный резерв для входа на просадках — это ваше оружие",
    "Гибкость: иметь возможность купить лучшее в лучший момент",
  ],
};

function whyText(c: HealthComponent, portfolio: V2Portfolio): string {
  const { key, score } = c;
  const pct = Math.round(portfolio.reserveShare * 100);

  if (key === "reserve") {
    if (score <= 0) return "Выделенного резерва нет — 0. Портфель полностью без подушки: на просадке нечем докупать и нечем закрыть форс-мажор. Это лечится в первую очередь.";
    if (score < 40) return `Резерв ~${pct}% от портфеля — значительно ниже цели 30%. При просадке не будет ресурса для покупок по выгодным ценам.`;
    if (score < 70) return `Резерв ~${pct}% — ниже целевых 30%. Небольшое пополнение значительно улучшит показатель.`;
    return `Резерв в норме — ~${pct}% от портфеля. Продолжайте поддерживать этот уровень.`;
  }
  if (key === "crypto") {
    if (score < 40) return "Экспозиция в волатильных активах существенно превышает лимит 60%. Портфель сильно зависит от движений крипторынка.";
    if (score < 70) return "Доля волатильных активов немного выше лимита 60%. Небольшая фиксация улучшит показатель.";
    return "Экспозиция в волатильных активах в пределах нормы — ниже лимита 60%.";
  }
  if (key === "futures") {
    const m = c.meta;
    const count = m?.futuresCount ?? 0;
    const weightPct = m?.futuresShare != null ? Math.round(m.futuresShare * 1000) / 10 : null;
    const breaches = m?.leverageBreaches ?? [];

    // 1) Слишком много позиций — самое жёсткое нарушение
    if (count > 3) {
      return `Открыто ${count} фьючерс-позиций — это больше лимита 3. Чем больше одновременных плечевых ставок, тем выше шанс каскадной ликвидации. Сократите до 3.`;
    }
    // 2) Превышено плечо
    if (breaches.length) {
      const worst = breaches.reduce((a, b) => (b.leverage > a.leverage ? b : a));
      const list = breaches
        .map((b) => `${b.asset} ${b.leverage.toFixed(1)}x (лимит ${b.limit}x)`)
        .join(", ");
      return `Плечо превышено: ${list}. Самое опасное — ${worst.asset} при ${worst.leverage.toFixed(1)}x. Снизьте плечо — это риск ликвидации.`;
    }
    // 3) Начальная маржа близка к критическому лимиту 10%
    if ((m?.weightScore ?? 100) < 60 && weightPct != null) {
      return `Начальная маржа фьючерсов ${weightPct}% от вложенного капитала приближается к лимиту 10%. Сократите риск-бюджет.`;
    }
    if (weightPct != null) {
      return `Фьючерсы под контролем: ${count}/3 позиций, начальная маржа ${weightPct}% от вложенного капитала (лимит 10%), плечо в пределах ≤2x альты / ≤3x BTC.`;
    }
    return "Фьючерсы под контролем — вес, плечо и число позиций в пределах правил.";
  }
  if (key === "concentration") {
    if (score < 40) return "Один актив занимает слишком большую долю — выше лимита 35%. При падении этого актива убытки будут значительными.";
    if (score < 70) return "Концентрация в одном активе близка к лимиту 35%. Слегка диверсифицируйте.";
    return "Концентрация в норме — ни один актив не превышает 35% портфеля.";
  }
  if (key === "diversification") {
    if (score < 40) return "Портфель слабо диверсифицирован — большинство средств сконцентрировано в одном классе активов.";
    if (score < 70) return "Диверсификация умеренная. Добавление ещё одного класса активов улучшит устойчивость портфеля.";
    return "Диверсификация на хорошем уровне — средства распределены по нескольким классам активов.";
  }
  if (key === "flexibility") {
    if (score < 40) return "Свободного кэша почти нет. Вы лишены возможности быстро реагировать на рыночные возможности.";
    if (score < 70) return "Гибкость ниже комфортного уровня. Чуть больше свободного кэша увеличит ваш манёвр.";
    return "Гибкость на хорошем уровне — достаточно свободного кэша для оперативных решений.";
  }
  return "";
}

function scoreColor(score: number): string {
  if (score >= 75) return "#5AEF8D";
  if (score >= 50) return "#55C7FF";
  if (score >= 30) return "#E6B33A";
  return "#FF5D6C";
}

function scoreLabel(score: number): string {
  if (score >= 75) return "НОРМА";
  if (score >= 50) return "УМЕРЕННО";
  if (score >= 30) return "ОСТОРОЖНО";
  return "РИСК";
}

export function V2HealthDetailModal({ component, portfolio, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const color = scoreColor(component.score);
  const label = scoreLabel(component.score);
  const why = whyText(component, portfolio);
  const how = HOW[component.key];
  const what = WHAT[component.key];

  const circumference = 2 * Math.PI * 44;
  const dash = (component.score / 100) * circumference;

  return (
    <div className="v2-hdm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="v2-hdm-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="v2-hdm-header">
          <div className="v2-hdm-score-ring">
            <svg viewBox="0 0 100 100" width="100" height="100">
              <circle cx="50" cy="50" r="44" fill="none"
                stroke="rgba(86,196,240,0.12)" strokeWidth="6" />
              <circle cx="50" cy="50" r="44" fill="none"
                stroke={color} strokeWidth="6"
                strokeDasharray={`${dash} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s" }} />
              <text x="50" y="45" textAnchor="middle"
                fontSize="22" fontWeight="900" fill="white"
                fontFamily="'Black Ops One', system-ui">
                {component.score}
              </text>
              <text x="50" y="62" textAnchor="middle"
                fontSize="7" fontWeight="700" fill="rgba(200,230,245,0.6)"
                fontFamily="system-ui" letterSpacing="1">
                ИЗ 100
              </text>
            </svg>
          </div>
          <div className="v2-hdm-title-block">
            <span className="v2-hdm-status" style={{ color }}>{label}</span>
            <h2 className="v2-hdm-title">{component.label}</h2>
            <p className="v2-hdm-subtitle">Компонент Health Factor</p>
          </div>
          <button className="v2-hdm-close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="v2-hdm-body">
          <section className="v2-hdm-section">
            <div className="v2-hdm-section-label">За что отвечает</div>
            <p className="v2-hdm-text">{what}</p>
          </section>

          <section className="v2-hdm-section">
            <div className="v2-hdm-section-label">Почему сейчас {component.score}</div>
            <p className="v2-hdm-text v2-hdm-text--why">{why}</p>
          </section>

          <section className="v2-hdm-section">
            <div className="v2-hdm-section-label">Как улучшить</div>
            <ul className="v2-hdm-list">
              {how.map((item, i) => (
                <li key={i} className="v2-hdm-list-item">
                  <span className="v2-hdm-list-arrow" style={{ color }}>→</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

      </div>
    </div>
  );
}
