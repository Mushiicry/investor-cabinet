import { useEscapeClose } from "../../hooks/useEscapeClose";
import type { HealthComponent, HealthComponentKey } from "../../lib/portfolioHealth";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";

type Props = {
  component: HealthComponent;
  portfolio: V2Portfolio;
  onClose: () => void;
};

const WHAT: Record<HealthComponentKey, string> = {
  reserve:
    "Резерв — выделенная защитная часть капитала. Пол 10%, цель 30%, коридор нормы 30–60%. Резерв наполняется первым: в работу идёт только то, что сверх него. Это возможность докупать на просадке, не продавать в панике и спокойно пережить турбулентность.",
  crypto:
    "Выживаемость — стресс-проверка портфеля. Луч отвечает не за прибыль и не за прогноз рынка, а за вопрос: останется ли капитал живым, если завтра рухнет крипта, просядут акции США, золото сложится вниз или активная торговля получит полный стресс.",
  futures:
    "Контроль риска: контроль фьючерсных позиций, плеча, занятой части лимита и близости к ликвидации. Лимиты: занято не более 10% от вложенного капитала, не выше 2x на альтах, не выше 3x на BTC и золоте, максимум 3 позиции. Золото остаётся категорией «Металлы», но его плечо контролируется по тому же правилу и учитывается в лимите позиций; маржа золота в лимит 10% пока не входит.",
  concentration:
    "Концентрация — контроль лимитов отдельных активов. Внутри крипто-блока: ETH 35%, BTC 20%, SOL/TON/BNB 10%, альткоины 5%. Под альткоины есть только 3 места по 5%. Акции: весь класс до 10%, один актив до 5%, максимум 2 акции. Металлы: весь класс до 10%, один актив до 5%, максимум 2 металла. Балл = системный риск крупнейшей позиции минус штраф за активы сверх лимита.",
  diversification:
    "Диверсификация — распределение рискового капитала по спотовым классам: крипта, металлы и акции. Кэш и фьючерсы не входят в этот луч. Чем меньше зависимость от одного класса, тем устойчивее портфель к шокам в отдельных секторах рынка.",
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
    "Подготовьте лимитные ордера на падение до входа в стресс-сценарий",
    "Сохраните покупательскую способность после худшего сценария",
    "Не добавляйте новый риск, если после падения система теряет способность покупать и анализировать",
  ],
  futures: [
    "Снизьте плечо до лимита: ≤2x на альтах, ≤3x на BTC и золоте",
    "Сократите занятую часть лимита активной торговли до ≤10% от вложенного капитала",
    "При высоком плече первая задача — снять риск ликвидации",
  ],
  concentration: [
    "Сократите активы, вышедшие за свой лимит (какие — в блоке ниже)",
    "Крипто-лимиты: ETH 35% · BTC 20% · SOL/TON/BNB 10% · альты 5% · максимум 3 альта",
    "Акции и металлы: класс 10%, актив 5%, максимум 2 актива",
    "Не усредняйтесь в актив сверх его лимита — шлюз «Проверки» это заблокирует",
  ],
  diversification: [
    "Добавьте отсутствующий спотовый класс — металлы или акции",
    "Не держите более 80% рисковой части в одном классе активов",
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
    const m = c.meta;
    const reserveWarnings = m?.reserveWarnings ?? [];
    const reserveBlockers = m?.reserveBlockers ?? [];
    const reserveTargetShortfallUsd = m?.reserveTargetShortfallUsd ?? 0;
    const reserveIdleUsd = m?.reserveIdleUsd ?? 0;
    if (reserveBlockers.length) {
      return `${reserveBlockers[0]}. До цели 30% не хватает ${Math.round(reserveTargetShortfallUsd)}$. Новые рисковые действия нужно поставить на паузу.`;
    }
    if (reserveWarnings.includes("Резерв ниже цели 30%")) {
      return `Резерв ~${pct}% — ниже целевых 30%. До цели не хватает ${Math.round(reserveTargetShortfallUsd)}$.`;
    }
    if (reserveWarnings.includes("Резерв выше 60% — капитал простаивает")) {
      return `Резерв ~${pct}% — выше коридора нормы. Около ${Math.round(reserveIdleUsd)}$ сверх 60% простаивает без работы.`;
    }
    if (score <= 0) return "Выделенного резерва нет — 0. Портфель полностью без подушки: на просадке нечем докупать и нечем закрыть форс-мажор. Это лечится в первую очередь.";
    if (score < 40) return `Резерв ~${pct}% от портфеля — значительно ниже цели 30%. При просадке не будет ресурса для покупок по выгодным ценам.`;
    if (score < 70) return `Резерв ~${pct}% — ниже целевых 30%. Небольшое пополнение значительно улучшит показатель.`;
    return `Резерв в норме — ~${pct}% от портфеля. Продолжайте поддерживать этот уровень.`;
  }
  if (key === "crypto") {
    const m = c.meta;
    const blocker = m?.survivalBlockers?.[0];
    const warning = m?.survivalWarnings?.[0];
    const lossPct = Math.round((m?.survivalShockLossPct ?? 0) * 100);
    const afterUsd = m?.survivalPortfolioAfterShockUsd;
    const buyPowerUsd = m?.survivalBuyPowerAfterShockUsd;
    const buyPowerPct = Math.round((m?.survivalBuyPowerAfterShockShare ?? 0) * 100);
    const scenario = m?.survivalWorstScenario ?? "худший сценарий";
    const afterText = afterUsd !== undefined ? `останется около ${Math.round(afterUsd)}$` : `останется ${Math.round((m?.survivalPortfolioAfterShockShare ?? 0) * 100)}% портфеля`;
    const buyPowerText = buyPowerUsd !== undefined ? `покупательская способность около ${Math.round(buyPowerUsd)}$` : `покупательская способность ${buyPowerPct}% портфеля`;
    if (blocker) return `${blocker}. ${scenario}: просадка около ${lossPct}%, ${afterText}, ${buyPowerText}. Новый риск нельзя добавлять.`;
    if (warning) return `${warning}. ${scenario}: просадка около ${lossPct}%, ${afterText}, ${buyPowerText}.`;
    return `Стресс-сценарий выдержан. ${scenario}: просадка около ${lossPct}%, ${afterText}, ${buyPowerText}.`;
  }
  if (key === "futures") {
    const m = c.meta;
    const count = m?.futuresCount ?? 0;
    const weightPct = m?.futuresShare != null ? Math.round(m.futuresShare * 1000) / 10 : null;
    const breaches = m?.leverageBreaches ?? [];
    const breachUsd = m?.futuresBreachUsd ?? 0;
    const remainingUsd = m?.futuresRemainingUsd ?? 0;

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
    // 3) Превышен лимит активной торговли 10%
    if (breachUsd > 0 && weightPct != null) {
      return `Контроль риска: занято ${weightPct}% от вложенного капитала, лимит 10% превышен на ${Math.round(breachUsd)}$. Сократите риск до лимита.`;
    }
    if (weightPct != null) {
      return `Контроль риска в норме: ${count}/3 позиций, занято ${weightPct}% от вложенного капитала при лимите 10%. Осталось до лимита ${Math.round(remainingUsd)}$. Плечо в пределах ≤2x альты / ≤3x BTC.`;
    }
    return "Контроль риска в норме — вес, плечо и число позиций в пределах правил.";
  }
  if (key === "concentration") {
    const m = c.meta;
    const worst = m?.worstConcentrationAsset;
    const overCount = m?.overLimitAssets?.length ?? 0;
    const blocker = m?.concentrationBlockers?.[0];
    const warning = m?.concentrationWarnings?.[0];
    const altUsed = m?.altcoinSlotsUsed;
    const altTotal = m?.altcoinSlotsTotal;
    const altcoins = m?.altcoins ?? [];
    const stockUsed = m?.stockSlotsUsed;
    const stockTotal = m?.stockSlotsTotal;
    const stocks = m?.stocks ?? [];
    const metalUsed = m?.metalSlotsUsed;
    const metalTotal = m?.metalSlotsTotal;
    const metals = m?.metals ?? [];
    if (m?.concentrationBlockers?.includes("Превышен лимит альткоин-мест")) {
      return `Превышен лимит альткоин-мест: занято ${altUsed}/${altTotal}. В крипто-блоке есть только 3 места под альткоины по 5%. Сократите лишний альт или не добавляйте новые.`;
    }
    if (m?.concentrationBlockers?.includes("Превышен лимит мест акций")) {
      return `Превышен лимит мест акций: занято ${stockUsed}/${stockTotal}. В портфеле есть только 2 места под акции по 5%. Сократите лишнюю акцию или не добавляйте новые.`;
    }
    if (m?.concentrationBlockers?.includes("Превышен лимит мест металлов")) {
      return `Превышен лимит мест металлов: занято ${metalUsed}/${metalTotal}. В портфеле есть только 2 места под металлы по 5%. Сократите лишний металл или не добавляйте новые.`;
    }
    if (worst && worst !== "-" && overCount > 0 && (m?.maxAssetLimitUtilization ?? 0) > 1) {
      const shareBase = Math.round((m?.worstConcentrationShare ?? 0) * 100);
      const limit = Math.round((m?.worstConcentrationLimit ?? 0) * 100);
      const portShare = Math.round((m?.worstConcentrationPortfolioShare ?? 0) * 100);
      const others = overCount > 1 ? ` И ещё ${overCount - 1} актив(а) сверх лимита.` : "";
      return `${blocker ?? "Актив выше своего лимита"}: ${worst} сейчас ${shareBase}% при лимите ${limit}% (в портфеле ${portShare}%).${others} Не докупайте и не усредняйте ${worst}, пока доля не вернётся в лимит.`;
    }
    if (warning && worst && worst !== "-") {
      if (warning === "Все 3 альткоин-места заняты") {
        return `Все 3 альткоин-места заняты: ${altcoins.join(", ") || "список не определён"}. Новый альткоин добавлять нельзя, пока одно место не освободится.`;
      }
      if (warning === "Все 2 места акций заняты") {
        return `Все 2 места акций заняты: ${stocks.join(", ") || "список не определён"}. Новую акцию добавлять нельзя, пока одно место не освободится.`;
      }
      if (warning === "Все 2 места металлов заняты") {
        return `Все 2 места металлов заняты: ${metals.join(", ") || "список не определён"}. Новый металл добавлять нельзя, пока одно место не освободится.`;
      }
      const util = Math.round((m?.maxAssetLimitUtilization ?? 0) * 100);
      return `${warning}: ${worst} уже использует ${util}% своего лимита. Новые покупки этого актива требуют осторожности.`;
    }
    if (score < 70) return "Есть актив близко к своему лимиту. Слегка распределите, чтобы не упереться в потолок.";
    return "Концентрация в норме — каждый актив в пределах своего лимита.";
  }
  if (key === "diversification") {
    const m = c.meta;
    const blocker = m?.diversificationBlockers?.[0];
    const warning = m?.diversificationWarnings?.[0];
    const largest = m?.largestClassName;
    const largestPct = Math.round((m?.largestClassShareOfRisk ?? 0) * 100);
    const active = m?.activeClassCount ?? 0;
    if (blocker) return `${blocker}. Активных классов: ${active}/3. Портфель зависит от одного сектора.`;
    if (warning && largest) return `${warning}. Крупнейший класс: ${largest}, ${largestPct}% рисковой части.`;
    if (score < 40) return "Портфель слабо диверсифицирован — большинство средств сконцентрировано в одном классе активов.";
    if (score < 70) return "Диверсификация умеренная. Добавление ещё одного спотового класса улучшит устойчивость портфеля.";
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
  useEscapeClose(true, onClose);

  const color = scoreColor(component.score);
  const label = scoreLabel(component.score);
  const why = whyText(component, portfolio);
  const how = HOW[component.key];
  const what = WHAT[component.key];
  const riskControlBlockers =
    component.key === "futures" ? component.meta?.riskControlBlockers ?? [] : [];
  const riskControlWarnings =
    component.key === "futures" ? component.meta?.riskControlWarnings ?? [] : [];
  const riskControlFormula =
    component.key === "futures" ? component.meta?.riskControlFormula ?? [] : [];
  const reserveBlockers =
    component.key === "reserve" ? component.meta?.reserveBlockers ?? [] : [];
  const reserveWarnings =
    component.key === "reserve" ? component.meta?.reserveWarnings ?? [] : [];
  const reserveFormula =
    component.key === "reserve" ? component.meta?.reserveFormula ?? [] : [];
  const diversificationBlockers =
    component.key === "diversification" ? component.meta?.diversificationBlockers ?? [] : [];
  const diversificationWarnings =
    component.key === "diversification" ? component.meta?.diversificationWarnings ?? [] : [];
  const diversificationFormula =
    component.key === "diversification" ? component.meta?.diversificationFormula ?? [] : [];
  const concentrationBlockers =
    component.key === "concentration" ? component.meta?.concentrationBlockers ?? [] : [];
  const concentrationWarnings =
    component.key === "concentration" ? component.meta?.concentrationWarnings ?? [] : [];
  const concentrationFormula =
    component.key === "concentration" ? component.meta?.concentrationFormula ?? [] : [];
  const survivalBlockers =
    component.key === "crypto" ? component.meta?.survivalBlockers ?? [] : [];
  const survivalWarnings =
    component.key === "crypto" ? component.meta?.survivalWarnings ?? [] : [];
  const survivalFormula =
    component.key === "crypto" ? component.meta?.survivalFormula ?? [] : [];
  const factorBlockers = [
    ...riskControlBlockers,
    ...reserveBlockers,
    ...diversificationBlockers,
    ...concentrationBlockers,
    ...survivalBlockers,
  ];
  const factorWarnings = [
    ...riskControlWarnings,
    ...reserveWarnings,
    ...diversificationWarnings,
    ...concentrationWarnings,
    ...survivalWarnings,
  ];
  const factorFormula = [
    ...riskControlFormula,
    ...reserveFormula,
    ...diversificationFormula,
    ...concentrationFormula,
    ...survivalFormula,
  ];

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
            <p className="v2-hdm-subtitle">Компонент фактора здоровья</p>
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

          {factorFormula.length > 0 && (
            <section className="v2-hdm-section">
              <div className="v2-hdm-section-label">Формула</div>
              <ul className="v2-hdm-list">
                {factorFormula.map((item) => (
                  <li key={item} className="v2-hdm-list-item">
                    <span className="v2-hdm-list-arrow" style={{ color }}>→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(factorBlockers.length > 0 || factorWarnings.length > 0) && (
            <section className="v2-hdm-section">
              <div className="v2-hdm-section-label">
                {factorBlockers.length > 0 ? "Жёсткие блокировки" : "Предупреждения"}
              </div>
              <ul className="v2-hdm-list">
                {[...factorBlockers, ...factorWarnings].map((item) => (
                  <li key={item} className="v2-hdm-list-item">
                    <span className="v2-hdm-list-arrow" style={{ color }}>→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

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
