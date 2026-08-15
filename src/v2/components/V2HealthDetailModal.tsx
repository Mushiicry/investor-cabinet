import { createPortal } from "react-dom";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import type { HealthComponent, HealthComponentKey } from "../../lib/portfolioHealth";
import reserveScoreOrb from "../../assets/dna/reserve-score-orb.webp";
import reserveShield from "../../assets/dna/reserve-shield.webp";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import type { InvestorStrategy } from "../lib/investorStrategy";

type Props = {
  component: HealthComponent;
  portfolio: V2Portfolio;
  strategy?: InvestorStrategy;
  onClose: () => void;
};

const RESERVE_ACCENT = "#55C7FF";
const ARROW_ACCENT = "#E6B33A";

const fmtUsd = (value: number) =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

function splitFormulaItem(item: string): { label: string; value: string } {
  const index = item.indexOf(":");
  if (index < 0) return { label: item, value: "" };
  return {
    label: item.slice(0, index),
    value: item.slice(index + 1).trim(),
  };
}

const WHAT: Record<HealthComponentKey, string> = {
  reserve:
    "Резерв — главный защитный параметр стратегии MUSHII Invest: на нем строятся мани-менеджмент, риск-менеджмент и право портфеля совершать сделки.\n\nВыше 60% капитал простаивает и получает штраф.\nНиже 30% включается жёсткая проверка перед любой покупкой, а фьючерсы отключаются,\nниже 10% отключаются полностью все сделки.",
  crypto:
    "Выживаемость — стресс-проверка портфеля. Луч отвечает не за прибыль и не за прогноз рынка, а за вопрос: останется ли капитал живым, если завтра рухнет крипта, просядут акции США, золото сложится вниз или активная торговля получит полный стресс.",
  futures:
    "Контроль риска: контроль фьючерсных позиций, плеча, занятой части лимита и близости к ликвидации. Лимиты: занято не более 10% от вложенного капитала, не выше 2x на альтах, не выше 3x на BTC и золоте, максимум 3 позиции. Золото остаётся категорией «Металлы», но его плечо контролируется по тому же правилу и учитывается в лимите позиций; маржа золота в лимит 10% пока не входит.",
  concentration:
    "Концентрация — контроль лимитов отдельных активов. Лимиты крипты, акций, металлов и число разрешённых позиций берутся из стратегии аккаунта. Балл = системный риск крупнейшей позиции минус штраф за активы сверх лимита.",
  diversification:
    "Диверсификация — распределение рискового капитала по спотовым классам: крипта, металлы и акции. Кэш и фьючерсы не входят в этот луч. Чем меньше зависимость от одного класса, тем устойчивее портфель к шокам в отдельных секторах рынка.",
  flexibility:
    "Дисциплина — целостность процесса принятия решений. Луч не оценивает прибыль и не наказывает убыточную сделку по правилам. Он показывает, есть ли журнал решений, покупки из страха упустить рост, сделки-месть, переторговка или активные дисциплинарные блокеры.",
};

const HOW: Record<HealthComponentKey, string[]> = {
  reserve: [
    "Держите инвестиционный резерв в разрешенном диапазоне стейблов 30–60% от вложено",
    "Не допускайте падения ниже 30%",
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
    "Крипто-лимиты, акции и металлы сверяются со стратегией аккаунта",
    "Не добавляйте активы вне разрешённого списка стратегии",
    "Не усредняйтесь в актив сверх его лимита — шлюз «Проверки» это заблокирует",
  ],
  diversification: [
    "Добавьте отсутствующий спотовый класс — металлы или акции",
    "Не держите более 80% рисковой части в одном классе активов",
    "Балансируйте распределение раз в квартал или при значимом изменении портфеля",
  ],
  flexibility: [
    "Заполняйте журнал решений до сделки, а не после результата",
    "Поставьте паузу на новые сделки при страхе упустить рост, сделке-мести или переторговке",
    "Оценивайте качество решения отдельно от прибыли или убытка",
  ],
};

function whyText(c: HealthComponent, portfolio: V2Portfolio): string {
  const { key, score } = c;
  const pct = Math.round((c.meta?.reserveShare ?? portfolio.reserveShare) * 100);

  if (key === "reserve") {
    const m = c.meta;
    const reserveWarnings = m?.reserveWarnings ?? [];
    const reserveBlockers = m?.reserveBlockers ?? [];
    const reserveTargetShortfallUsd = m?.reserveTargetShortfallUsd ?? 0;
    const reserveIdleUsd = m?.reserveIdleUsd ?? 0;
    const reserveBaseUsd = m?.reserveBaseUsd ?? portfolio.totalPortfolioValue;
    const reserveUsd = m?.reserveUsd ?? portfolio.stableReserve;
    const floorPct = m?.reserveFloorUsd && reserveBaseUsd
      ? Math.round((m.reserveFloorUsd / reserveBaseUsd) * 100)
      : 10;
    const floorUsd = m?.reserveFloorUsd ?? reserveBaseUsd * 0.10;
    const targetPct = m?.reserveTargetUsd && reserveBaseUsd
      ? Math.round((m.reserveTargetUsd / reserveBaseUsd) * 100)
      : 30;
    const bandMaxPct = m?.reserveBandMaxUsd && reserveBaseUsd
      ? Math.round((m.reserveBandMaxUsd / reserveBaseUsd) * 100)
      : 60;
    const targetUsd = m?.reserveTargetUsd ?? reserveBaseUsd * 0.30;
    const bandMaxUsd = m?.reserveBandMaxUsd ?? reserveBaseUsd * 0.60;
    if (reserveBlockers.length) {
      return `Резерв ~${pct}% (${fmtUsd(reserveUsd)}) — ниже неприкосновенной части ${floorPct}% (${fmtUsd(floorUsd)}).\nВсе сделки отключены до восстановления этой границы; до необходимого остатка ${targetPct}% не хватает ${fmtUsd(reserveTargetShortfallUsd)}.`;
    }
    if (reserveWarnings.some((warning) => warning.includes("необходимого остатка"))) {
      return `Резерв ~${pct}% (${fmtUsd(reserveUsd)}) — ниже необходимого остатка ${targetPct}% (${fmtUsd(targetUsd)}).\nФьючерсы отключаются, а новая покупка проходит только через жёсткую проверку риска; не хватает ${fmtUsd(reserveTargetShortfallUsd)}.`;
    }
    if (reserveWarnings.some((warning) => warning.includes("капитал простаивает"))) {
      return `Резерв ~${pct}% (${fmtUsd(reserveUsd)}) от вложено ${fmtUsd(reserveBaseUsd)} — выше разрешенного диапазона стейблов ${targetPct}–${bandMaxPct}%.\n${fmtUsd(reserveIdleUsd)} сверх ${fmtUsd(bandMaxUsd)} простаивает и снижает балл.`;
    }
    if (score <= 0) return "Инвестиционного резерва нет — портфель полностью без стейбл-защиты. Все сделки должны быть отключены до восстановления неприкосновенной части.";
    if (score < 40) return `Резерв ~${pct}% (${fmtUsd(reserveUsd)}) — значительно ниже необходимого остатка ${targetPct}% (${fmtUsd(targetUsd)}).\nСначала восстановить стейбл-защиту, потом возвращаться к покупкам.`;
    if (score < 70) return `Резерв ~${pct}% (${fmtUsd(reserveUsd)}) — ниже необходимого остатка ${targetPct}% (${fmtUsd(targetUsd)}).\nЛюбая покупка проходит через усиленную риск-проверку.`;
    return `Резерв ~${pct}% (${fmtUsd(reserveUsd)}) находится в разрешенном диапазоне стейблов ${targetPct}–${bandMaxPct}% от вложено ${fmtUsd(reserveBaseUsd)}.\nЭто базовый слой мани-менеджмента портфеля.`;
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
    const capPct = m?.futuresCapUsd && portfolio.totalInvested
      ? Math.round((m.futuresCapUsd / portfolio.totalInvested) * 100)
      : 10;

    if (c.label === "Качество активов" && count === 0 && (m?.futuresShare ?? 0) <= 0) {
      return "Фьючерсы не используются. Луч контролирует чистоту портфеля: запрещённые активы должны блокироваться стратегией.";
    }

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
      return `Контроль риска: занято ${weightPct}% от вложенного капитала, лимит ${capPct}% превышен на ${Math.round(breachUsd)}$. Сократите риск до лимита.`;
    }
    if (weightPct != null) {
      return `Контроль риска в норме: ${count}/3 позиций, занято ${weightPct}% от вложенного капитала при лимите ${capPct}%. Осталось до лимита ${Math.round(remainingUsd)}$. Плечо в пределах ≤2x альты / ≤3x BTC.`;
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
      return `Превышен лимит альткоин-мест: занято ${altUsed}/${altTotal}. Сократите лишний альт или не добавляйте новые.`;
    }
    if (m?.concentrationBlockers?.includes("Превышен лимит мест акций")) {
      return `Превышен лимит мест акций: занято ${stockUsed}/${stockTotal}. Сократите лишнюю акцию или не добавляйте новые.`;
    }
    if (m?.concentrationBlockers?.includes("Превышен лимит мест металлов")) {
      return `Превышен лимит мест металлов: занято ${metalUsed}/${metalTotal}. Сократите лишний металл или не добавляйте новые.`;
    }
    if (worst && worst !== "-" && overCount > 0 && (m?.maxAssetLimitUtilization ?? 0) > 1) {
      const shareBase = Math.round((m?.worstConcentrationShare ?? 0) * 100);
      const limit = Math.round((m?.worstConcentrationLimit ?? 0) * 100);
      const portShare = Math.round((m?.worstConcentrationPortfolioShare ?? 0) * 100);
      const others = overCount > 1 ? ` И ещё ${overCount - 1} актив(а) сверх лимита.` : "";
      return `${blocker ?? "Актив выше своего лимита"}: ${worst} сейчас ${shareBase}% при лимите ${limit}% (в портфеле ${portShare}%).${others} Не докупайте и не усредняйте ${worst}, пока доля не вернётся в лимит.`;
    }
    if (warning && worst && worst !== "-") {
      if (warning.startsWith("Все") && warning.includes("альткоин-мест")) {
        return `${warning}: ${altcoins.join(", ") || "список не определён"}. Новый альткоин добавлять нельзя, пока одно место не освободится.`;
      }
      if (warning.startsWith("Все") && warning.includes("места акций")) {
        return `${warning}: ${stocks.join(", ") || "список не определён"}. Новую акцию добавлять нельзя, пока одно место не освободится.`;
      }
      if (warning.startsWith("Все") && warning.includes("места металлов")) {
        return `${warning}: ${metals.join(", ") || "список не определён"}. Новый металл добавлять нельзя, пока одно место не освободится.`;
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
    const m = c.meta;
    const blocker = m?.disciplineBlockers?.[0];
    const warning = m?.disciplineWarnings?.[0];
    if (blocker) return `${blocker}. Новые сделки нужно поставить на паузу, пока нарушение не разобрано в журнале.`;
    if (warning) return `${warning}. Луч не ставит 100, пока дисциплинарный контур не подтверждён данными.`;
    if (score < 40) return "Дисциплина в зоне риска: процесс решений не защищает капитал от повторения ошибок.";
    if (score < 70) return "Дисциплина умеренная: есть пробелы в журнале или поведенческих маркерах.";
    return "Дисциплина в норме: решения проходят через процесс, а поведенческих блокеров нет.";
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

  const isReserve = component.key === "reserve";
  const usesPremiumLayout = true;
  const color = usesPremiumLayout ? RESERVE_ACCENT : scoreColor(component.score);
  const label = scoreLabel(component.score);
  const why = whyText(component, portfolio);
  const how = HOW[component.key];
  const what = component.desc || WHAT[component.key];
  const reserveIdleText = fmtUsd(component.meta?.reserveIdleUsd ?? 0);
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
  const disciplineBlockers =
    component.key === "flexibility" ? component.meta?.disciplineBlockers ?? [] : [];
  const disciplineWarnings =
    component.key === "flexibility" ? component.meta?.disciplineWarnings ?? [] : [];
  const disciplineFormula =
    component.key === "flexibility" ? component.meta?.disciplineFormula ?? [] : [];
  const factorBlockers = [
    ...riskControlBlockers,
    ...reserveBlockers,
    ...diversificationBlockers,
    ...concentrationBlockers,
    ...survivalBlockers,
    ...disciplineBlockers,
  ];
  const factorWarnings = [
    ...riskControlWarnings,
    ...reserveWarnings,
    ...diversificationWarnings,
    ...concentrationWarnings,
    ...survivalWarnings,
    ...disciplineWarnings,
  ];
  const factorFormula = [
    ...riskControlFormula,
    ...reserveFormula,
    ...diversificationFormula,
    ...concentrationFormula,
    ...survivalFormula,
    ...disciplineFormula,
  ];
  const hasFactorBlockers = factorBlockers.length > 0;
  const hasFactorWarnings = factorWarnings.length > 0;
  const reservePct = Math.round((component.meta?.reserveShare ?? portfolio.reserveShare) * 100);
  const reserveMarkerPct = clampPct((component.meta?.reserveShare ?? portfolio.reserveShare) * 100);
  const formulaIcons = ["◌", "◇", "◎", "▣"];

  const circumference = 2 * Math.PI * 44;
  const dash = (component.score / 100) * circumference;

  return createPortal(
    <div className="v2-hdm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`v2-hdm-card ${usesPremiumLayout ? "v2-hdm-card--reserve" : ""}`} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="v2-hdm-header">
          <div className="v2-hdm-score-ring">
            {usesPremiumLayout ? (
              <div className="v2-hdm-score-orb" aria-label={`${component.score} из 100`}>
                <img src={reserveScoreOrb} alt="" />
                <span className="v2-hdm-score-orb-mask" />
                <span className="v2-hdm-score-orb-value">{component.score}</span>
                <span className="v2-hdm-score-orb-total">/ 100</span>
              </div>
            ) : (
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
                  fontFamily="'Libre Baskerville', Georgia, serif">
                  {component.score}
                </text>
                <text x="50" y="62" textAnchor="middle"
                  fontSize="7" fontWeight="700" fill="rgba(200,230,245,0.6)"
                  fontFamily="'Libre Baskerville', Georgia, serif" letterSpacing="1">
                  / 100
                </text>
              </svg>
            )}
          </div>
          <div className="v2-hdm-title-block">
            <h2 className="v2-hdm-title">{component.label}</h2>
            {!usesPremiumLayout && (
              <>
                <p className="v2-hdm-subtitle">Компонент фактора здоровья</p>
                <span className="v2-hdm-status" style={{ color }}>{label}</span>
              </>
            )}
          </div>
          <button className="v2-hdm-close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {usesPremiumLayout ? (
          <div className="v2-hdm-body v2-hdm-body--reserve">
            <section className="v2-hdm-section v2-hdm-section--intro">
              <p className="v2-hdm-text v2-hdm-text--preline">{what}</p>
            </section>

            <section className="v2-hdm-section v2-hdm-section--why">
              <div className="v2-hdm-section-content">
                <div className="v2-hdm-section-heading">
                  <span className="v2-hdm-section-icon">?</span>
                  <div className="v2-hdm-section-label">Почему сейчас {component.score}</div>
                </div>
                <p className="v2-hdm-text v2-hdm-text--why v2-hdm-text--preline">{why}</p>
              </div>
            </section>

            {factorFormula.length > 0 && (
              <section className="v2-hdm-section v2-hdm-section--formula">
                <div className="v2-hdm-section-heading">
                  <span className="v2-hdm-section-icon">▦</span>
                  <div className="v2-hdm-section-label">Формула</div>
                </div>
                <div className="v2-hdm-metrics">
                  {factorFormula.map((item, index) => {
                    const metric = splitFormulaItem(item);
                    return (
                      <div key={item} className="v2-hdm-metric-row">
                        <span className="v2-hdm-metric-icon">{formulaIcons[index] ?? "•"}</span>
                        <span className="v2-hdm-metric-label">{metric.label}</span>
                        <span className="v2-hdm-metric-value">{metric.value}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {(hasFactorBlockers || hasFactorWarnings) && (
              <section className={`v2-hdm-section v2-hdm-section--warning ${!isReserve ? "v2-hdm-section--warning-plain" : ""}`}>
                <div className="v2-hdm-warning-copy">
                  <div className="v2-hdm-section-heading">
                    <span className="v2-hdm-section-icon v2-hdm-section-icon--warning">!</span>
                    <div className="v2-hdm-section-label v2-hdm-section-label--warning">
                      {hasFactorBlockers ? "Жёсткие блокировки" : "Предупреждения"}
                    </div>
                  </div>
                  <ul className="v2-hdm-list">
                    {[...factorBlockers, ...factorWarnings].map((item) => (
                      <li key={item} className="v2-hdm-list-item">
                        <span className="v2-hdm-list-arrow" style={{ color: ARROW_ACCENT }}>→</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                {isReserve && (
                  <div className="v2-hdm-reserve-scale" aria-label={`Текущий резерв ${reservePct}%`}>
                    <div className="v2-hdm-reserve-scale-badge" style={{ left: `${reserveMarkerPct}%` }}>{reservePct}%</div>
                    <div className="v2-hdm-reserve-scale-track">
                      <span className="v2-hdm-scale-zone v2-hdm-scale-zone--low" />
                      <span className="v2-hdm-scale-zone v2-hdm-scale-zone--ok" />
                      <span className="v2-hdm-scale-zone v2-hdm-scale-zone--high" />
                      <span className="v2-hdm-scale-marker" style={{ left: `${reserveMarkerPct}%` }} />
                    </div>
                    <div className="v2-hdm-reserve-scale-labels">
                      <span>0%</span>
                      <span>30%</span>
                      <span>60%</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className={`v2-hdm-section v2-hdm-section--how ${!isReserve ? "v2-hdm-section--how-plain" : ""}`}>
              <div className="v2-hdm-section-heading">
                <span className="v2-hdm-section-icon">↥</span>
                <div className="v2-hdm-section-label">Как улучшить</div>
              </div>
              <ul className="v2-hdm-list">
                {how.map((item, i) => (
                  <li key={i} className="v2-hdm-list-item">
                    <span className="v2-hdm-list-arrow" style={{ color: ARROW_ACCENT }}>→</span>
                    {item}
                  </li>
                ))}
                {(component.meta?.reserveIdleUsd ?? 0) > 0 && (
                  <li className="v2-hdm-list-item v2-hdm-list-item--strong">
                    <span className="v2-hdm-list-arrow" style={{ color: ARROW_ACCENT }}>→</span>
                    <span>{reserveIdleText} нужно пустить в работу</span>
                  </li>
                )}
              </ul>
              {isReserve && (
                <div className="v2-hdm-data-widget" aria-hidden="true">
                  <img src={reserveShield} alt="" />
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="v2-hdm-body">
          <section className="v2-hdm-section">
            {!isReserve && <div className="v2-hdm-section-label">За что отвечает</div>}
            <p className={`v2-hdm-text ${isReserve ? "v2-hdm-text--preline" : ""}`}>{what}</p>
          </section>

          <section className="v2-hdm-section">
            <div className="v2-hdm-section-label">Почему сейчас {component.score}</div>
            <p className="v2-hdm-text v2-hdm-text--why v2-hdm-text--preline">{why}</p>
          </section>

          {factorFormula.length > 0 && (
            <section className="v2-hdm-section">
              <div className="v2-hdm-section-label">Формула</div>
              <ul className="v2-hdm-list">
                {factorFormula.map((item) => (
                  <li key={item} className="v2-hdm-list-item">
                    <span className="v2-hdm-list-arrow" style={{ color: ARROW_ACCENT }}>→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(hasFactorBlockers || hasFactorWarnings) && (
            <section className="v2-hdm-section">
              <div className={`v2-hdm-section-label ${!hasFactorBlockers ? "v2-hdm-section-label--warning" : ""}`}>
                {hasFactorBlockers ? "Жёсткие блокировки" : "Предупреждения!"}
              </div>
              <ul className="v2-hdm-list">
                {[...factorBlockers, ...factorWarnings].map((item) => (
                  <li key={item} className="v2-hdm-list-item">
                    <span className="v2-hdm-list-arrow" style={{ color: ARROW_ACCENT }}>→</span>
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
                  <span className="v2-hdm-list-arrow" style={{ color: ARROW_ACCENT }}>→</span>
                  {item}
                </li>
              ))}
              {isReserve && (component.meta?.reserveIdleUsd ?? 0) > 0 && (
                <li className="v2-hdm-list-item">
                  <span className="v2-hdm-list-arrow" style={{ color: ARROW_ACCENT }}>→</span>
                  <span>{reserveIdleText} нужно пустить в работу</span>
                </li>
              )}
            </ul>
          </section>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}
