// Чистые хелперы и геометрия для V2HealthCore: score->подсказки/цвета,
// гексагон-радар, раскладка чипов, интерпретация здоровья, диагноз и рекомендации.
// Вынесено из V2HealthCore.tsx, чтобы компонент отвечал только за render.
import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import { computePortfolioHealth, findHealthComponentByKey } from "../../lib/portfolioHealth";
import type { HealthComponent, HealthInput } from "../../lib/portfolioHealth";
import {
  buildDefaultHealthSimulatorLevers,
  buildHealthSimulatorInput,
} from "./healthSimulator";

export const CX = 140, CY = 140;
export const RADAR_R = 118;
export const OUTER_R = 136;

export const VB_OFF = 80;
export const VB_SIZE = 280 + VB_OFF * 2; // 440

export const CHIP_W = 89, CHIP_H = 52, GAP = 12, CHIP_R = 40;

export const CHIP_LABEL: Record<string, string> = {
  reserve:         "Резерв",
  crypto:          "Выживаемость",
  survival:        "Выживаемость",
  futures:         "Контроль риска",
  riskControl:     "Контроль риска",
  concentration:   "Концентрация",
  diversification: "Диверсификация",
  flexibility:     "Дисциплина",
  discipline:      "Дисциплина",
};

export function scoreHint(s: number): string {
  if (s >= 75) return "НОРМА";
  if (s >= 50) return "УМЕРЕННО";
  if (s >= 30) return "ОСТОРОЖНО";
  return "РИСК";
}

export function scoreAlpha(s: number): number {
  if (s >= 75) return 1;
  if (s >= 50) return 0.82;
  if (s >= 30) return 0.62;
  return 0.42;
}

export function chipColor(s: number): string {
  if (s >= 75) return "#5AEF8D";
  if (s >= 50) return "#55C7FF";
  if (s >= 30) return "#E6B33A";
  return "#FF5D6C";
}

// Hex polygon points centered at CX,CY
export function hexPts(r: number, startDeg = -90): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (startDeg + i * 60) * (Math.PI / 180);
    return `${(CX + r * Math.cos(a)).toFixed(2)},${(CY + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

// Hex points with arbitrary center (for offset shadows)
export function hexPtsAt(cx: number, cy: number, r: number, startDeg = -90): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (startDeg + i * 60) * (Math.PI / 180);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

export function chipLayout(idx: number): {
  rx: number; ry: number;
  vx: number; vy: number;
  ax: number; ay: number;
} {
  const a = (-90 + idx * 60) * (Math.PI / 180);
  const vx = CX + OUTER_R * Math.cos(a);
  const vy = CY + OUTER_R * Math.sin(a);
  if (idx === 0)          return { rx: vx - CHIP_W / 2, ry: vy - GAP - CHIP_H, vx, vy, ax: vx, ay: vy - GAP };
  if (idx === 1 || idx === 2) return { rx: vx + GAP,        ry: vy - CHIP_H / 2,   vx, vy, ax: vx + GAP, ay: vy };
  if (idx === 3)          return { rx: vx - CHIP_W / 2, ry: vy + GAP,          vx, vy, ax: vx, ay: vy + GAP };
  return                         { rx: vx - GAP - CHIP_W, ry: vy - CHIP_H / 2, vx, vy, ax: vx - GAP, ay: vy };
}

// Scale value polygon toward center by factor (for inner highlight effect)
export function scaleValuePts(pts: string, factor: number): string {
  return pts.split(" ").map(p => {
    const [x, y] = p.split(",").map(Number);
    return `${(CX + (x - CX) * factor).toFixed(2)},${(CY + (y - CY) * factor).toFixed(2)}`;
  }).join(" ");
}

export const SCORE_LABEL: Record<string, string> = {
  reserve:         "Резерв",
  crypto:          "Выживаемость",
  survival:        "Выживаемость",
  futures:         "Контроль риска",
  riskControl:     "Контроль риска",
  concentration:   "Концентрация",
  diversification: "Диверсификация",
  flexibility:     "Дисциплина",
  discipline:      "Дисциплина",
};


export function healthInterpretation(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "Здоров — портфель сбалансирован по всем критериям", color: "#5AEF8D" };
  if (score >= 65) return { text: "Удовлетворительно — есть что подтянуть до нормы", color: "#55C7FF" };
  if (score >= 50) return { text: "Под наблюдением — несколько критериев в зоне риска", color: "#E6B33A" };
  if (score >= 30) return { text: "Диагноз: риск — портфель требует лечения", color: "#FF8A4A" };
  return { text: "Диагноз: критично — портфель уязвим к просадке", color: "#FF5D6C" };
}

export const fmt$ = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const fmtExactUsd = (v: number) =>
  `$${v.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

export function diagWhy(c: HealthComponent, portfolio: V2Portfolio): string {
  const reservePct = Math.round((c.meta?.reserveShare ?? portfolio.reserveShare) * 100);
  const reserveUsd = portfolio.stableReserve;
  const targetUsd = Math.round(c.meta?.reserveTargetUsd ?? portfolio.totalPortfolioValue * 0.30);
  const reserveBaseUsd = c.meta?.reserveBaseUsd ?? portfolio.totalPortfolioValue;
  const targetPct = c.meta?.reserveTargetUsd && reserveBaseUsd
    ? Math.round((c.meta.reserveTargetUsd / reserveBaseUsd) * 100)
    : 30;
  switch (c.key) {
    case "reserve":
      if ((c.meta?.reserveBlockers ?? []).length) return c.meta?.reserveBlockers?.[0] ?? "";
      if ((c.meta?.reserveWarnings ?? []).length) return c.meta?.reserveWarnings?.[0] ?? "";
      if (c.score <= 0) return `Резерв $0 — подушки нет, нечем откупать`;
      if (c.score < 50)
        return `${reservePct}% от цели ${targetPct}%. Дефицит ${fmt$(Math.max(0, targetUsd - reserveUsd))}`;
      return `${reservePct}% от цели ${targetPct}%`;
    case "flexibility":
      if ((c.meta?.disciplineBlockers ?? []).length) return c.meta?.disciplineBlockers?.[0] ?? "";
      if ((c.meta?.disciplineWarnings ?? []).length) return c.meta?.disciplineWarnings?.[0] ?? "";
      return "Процесс решений соблюдается";
    case "diversification":
      if ((c.meta?.diversificationBlockers ?? []).length) return c.meta?.diversificationBlockers?.[0] ?? "";
      if ((c.meta?.diversificationWarnings ?? []).length) return c.meta?.diversificationWarnings?.[0] ?? "";
      return "Капитал сконцентрирован в одном классе";
    case "crypto":
      if ((c.meta?.survivalBlockers ?? []).length) return c.meta?.survivalBlockers?.[0] ?? "";
      if ((c.meta?.survivalWarnings ?? []).length) return c.meta?.survivalWarnings?.[0] ?? "";
      return c.meta?.survivalWorstScenario
        ? `${c.meta.survivalWorstScenario}: просадка ${Math.round((c.meta.survivalShockLossPct ?? 0) * 100)}%`
        : "Стресс-сценарий выдержан";
    case "concentration": {
      const m = c.meta;
      if ((m?.concentrationBlockers ?? []).includes("Превышен лимит альткоин-мест")) return "Превышен лимит альткоин-мест";
      if ((m?.concentrationBlockers ?? []).includes("Превышен лимит мест акций")) return "Превышен лимит мест акций";
      if ((m?.concentrationBlockers ?? []).includes("Превышен лимит мест металлов")) return "Превышен лимит мест металлов";
      if ((m?.concentrationWarnings ?? []).includes("Все 3 альткоин-места заняты")) return "Все 3 альткоин-места заняты";
      if ((m?.concentrationWarnings ?? []).includes("Все 2 места акций заняты")) return "Все 2 места акций заняты";
      if ((m?.concentrationWarnings ?? []).includes("Все 2 места металлов заняты")) return "Все 2 места металлов заняты";
      if ((m?.concentrationBlockers ?? []).length) return m?.concentrationBlockers?.[0] ?? "";
      if ((m?.concentrationWarnings ?? []).length) return m?.concentrationWarnings?.[0] ?? "";
      if (m?.worstConcentrationAsset && m.worstConcentrationAsset !== "-" && (m.maxAssetLimitUtilization ?? 0) > 1) {
        const limit = Math.round((m.worstConcentrationLimit ?? 0) * 100);
        return `${m.worstConcentrationAsset} выше своего лимита ${limit}%`;
      }
      if (c.score < 70) return "Актив близко к своему лимиту";
      return "Активы в пределах лимитов";
    }
    case "futures": {
      if ((c.meta?.riskControlBlockers ?? []).length) return c.meta?.riskControlBlockers?.[0] ?? "";
      if ((c.meta?.leverageBreaches ?? []).length) return "Плечо превышено";
      if (c.meta?.futuresCount && c.meta.futuresCount > 3) return `${c.meta.futuresCount}/3 позиций — лимит превышен`;
      if (c.label === "Качество активов") return "Запрещённые активы не нарушают стратегию";
      const futuresLimit = c.meta?.futuresCapUtilization && c.meta.futuresShare
        ? c.meta.futuresShare / c.meta.futuresCapUtilization
        : 0.1;
      if ((c.meta?.futuresBreachUsd ?? 0) > 0) return `Превышен лимит активной торговли ${Math.round(futuresLimit * 100)}%`;
      return `Занято ${Math.round((c.meta?.futuresShare ?? 0) * 1000) / 10}% из лимита ${Math.round(futuresLimit * 100)}%, плечо в норме`;
    }
    default:
      return "";
  }
}

type CoreRecKind =
  | "reserve"
  | "diversification"
  | "concentration"
  | "risk"
  | "survival"
  | "discipline";

export type CoreRecDetailRow = {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "danger";
};

export type CoreRecDetailStep = {
  title: string;
  body: string;
  rows?: CoreRecDetailRow[];
  primary?: boolean;
};

export type CoreRecDetails = {
  title: string;
  score: number;
  summary: string;
  steps: CoreRecDetailStep[];
  formula?: CoreRecDetailRow[];
};

export type CoreRec = {
  action: string;
  gain: number;
  source: string;
  critical?: boolean;
  kind?: CoreRecKind;
  details?: CoreRecDetails;
};

export type CoreAchievement = { title: string; detail: string };

export function isActionableHealthComponent(c: HealthComponent): boolean {
  switch (c.key) {
    case "reserve": {
      const blockers = c.meta?.reserveBlockers ?? [];
      const warnings = c.meta?.reserveWarnings ?? [];
      return c.score < 75 || blockers.length > 0 || warnings.length > 0;
    }
    case "crypto":
      return c.score < 100 || (c.meta?.survivalBlockers ?? []).length > 0 || (c.meta?.survivalWarnings ?? []).length > 0;
    case "futures":
      return c.score < 100 || (c.meta?.riskControlBlockers ?? []).length > 0 || (c.meta?.riskControlWarnings ?? []).length > 0;
    case "concentration":
      return c.score < 100 || (c.meta?.concentrationBlockers ?? []).length > 0 || (c.meta?.concentrationWarnings ?? []).length > 0;
    case "diversification":
      return c.score < 100 || (c.meta?.diversificationBlockers ?? []).length > 0 || (c.meta?.diversificationWarnings ?? []).length > 0;
    case "flexibility":
      return c.score < 100 || (c.meta?.disciplineBlockers ?? []).length > 0 || (c.meta?.disciplineWarnings ?? []).length > 0;
  }
}

export function buildCoreAchievements(all: HealthComponent[]): CoreAchievement[] {
  const out: CoreAchievement[] = [];
  const fm = all.find((c) => c.key === "futures")?.meta;
  const futuresUsedUsd = fm?.futuresUsedUsd ?? 0;
  const futuresBreachUsd = fm?.futuresBreachUsd ?? 0;
  const futuresCapUsd = fm?.futuresCapUsd ?? 0;
  const futuresRemainingUsd = fm?.futuresRemainingUsd ?? 0;
  if (futuresUsedUsd > 0 && futuresBreachUsd === 0 && futuresCapUsd > 0) {
    out.push({
      title: "Контроль риска в норме",
      detail: `Занято ${fmt$(futuresUsedUsd)} из ${fmt$(futuresCapUsd)}. Осталось до лимита ${fmt$(futuresRemainingUsd)}.`,
    });
  }
  return out;
}

function healthAfterRecommendation(input: HealthInput, kind: CoreRecKind): number {
  const baseLevers = buildDefaultHealthSimulatorLevers(input);
  const reserveShare = input.reserveShare ?? input.cashShare;
  const nextInput = (() => {
    switch (kind) {
      case "reserve":
        return buildHealthSimulatorInput(input, {
          ...baseLevers,
          reserveShare: reserveShare < 0.3 ? 0.3 : Math.min(reserveShare, 0.6),
        });
      case "diversification":
        return buildHealthSimulatorInput(input, { ...baseLevers, diversificationRepair: 1 });
      case "concentration":
        return buildHealthSimulatorInput(input, { ...baseLevers, concentrationRepair: 1 });
      case "risk":
        return buildHealthSimulatorInput(input, { ...baseLevers, riskControlRepair: 1 });
      case "survival":
        return buildHealthSimulatorInput(input, { ...baseLevers, survivalPlan: 1 });
      case "discipline":
        return buildHealthSimulatorInput(input, { ...baseLevers, disciplineRepair: 1 });
    }
  })();

  return computePortfolioHealth(nextInput).healthFactor;
}

function componentGain(kind: CoreRecKind | undefined, all: HealthComponent[]): number {
  if (!kind) return 0;
  const keyByKind = {
    reserve: "reserve",
    diversification: "diversification",
    concentration: "concentration",
    risk: "riskControl",
    survival: "survival",
    discipline: "discipline",
  } as const;
  const component = findHealthComponentByKey(all, keyByKind[kind]);
  if (!component) return 0;
  return Math.max(0, Math.round((100 - component.score) * component.weight));
}

const fmtPct = (value: number) => `${Math.round(value * 1000) / 10}%`;

function healthWithPatchedInput(input: HealthInput, patch: Partial<HealthInput>): number {
  return computePortfolioHealth({ ...input, ...patch }).healthFactor;
}

function recommendationDetails(
  rec: CoreRec,
  healthInput: HealthInput | undefined,
  all: HealthComponent[],
  currentHealth: number | undefined,
): CoreRecDetails | undefined {
  if (!healthInput || !rec.kind || currentHealth === undefined) return undefined;

  const projectedHealth = healthAfterRecommendation(healthInput, rec.kind);

  if (rec.kind === "risk") {
    const fm = all.find((component) => component.key === "futures")?.meta;
    const baseCapital = healthInput.investedCapital ?? healthInput.portfolioValue ?? 0;
    const futuresUsedUsd = fm?.futuresUsedUsd ?? baseCapital * healthInput.futuresShare;
    const futuresCapUsd = fm?.futuresCapUsd ?? baseCapital * (healthInput.strategy?.futuresMaxShare ?? 0.1);
    const futuresBreachUsd = fm?.futuresBreachUsd ?? Math.max(0, futuresUsedUsd - futuresCapUsd);
    const freeMarginUsd = Math.max(0, healthInput.futuresDeployableUsd ?? 0);
    const withdrawUsd = Math.min(freeMarginUsd, futuresBreachUsd);
    const futuresAfterWithdraw = Math.max(0, futuresUsedUsd - withdrawUsd);
    const nextFuturesShare = baseCapital > 0 ? futuresAfterWithdraw / baseCapital : healthInput.futuresShare;
    const healthAfterWithdraw = healthWithPatchedInput(healthInput, {
      futuresShare: nextFuturesShare,
      futuresDeployableUsd: Math.max(0, freeMarginUsd - withdrawUsd),
    });
    const limitShare = baseCapital > 0 && futuresCapUsd > 0 ? futuresCapUsd / baseCapital : (healthInput.strategy?.futuresMaxShare ?? 0.1);
    const capitalNeeded = limitShare > 0 ? futuresUsedUsd / limitShare : 0;
    const capitalToAdd = Math.max(0, capitalNeeded - baseCapital);

    return {
      title: "Контроль фьючерсного риска",
      score: projectedHealth,
      summary:
        `Сейчас активная торговля занимает ${fmtExactUsd(futuresUsedUsd)} при лимите ${fmtExactUsd(futuresCapUsd)}. ` +
        `Чтобы вернуться в лимит ${fmtPct(limitShare)}, нужно убрать ${fmtExactUsd(futuresBreachUsd)} из HL-кармана или увеличить базу капитала.`,
      steps: [
        {
          title: "Вариант 1 — вывести с HL",
          body:
            withdrawUsd > 0
              ? `Выведите ${fmtExactUsd(withdrawUsd)} со свободной HL-маржи в общий резерв. Тогда активная торговля вернется в лимит без закрытия позиций.`
              : "Свободной HL-маржи не хватает для мягкого исправления. Нужна частичная фиксация позиции или пополнение капитала.",
          primary: true,
          rows: [
            { label: "Сейчас занято", value: fmtExactUsd(futuresUsedUsd), tone: futuresBreachUsd > 0 ? "danger" : "ok" },
            { label: "Лимит стратегии", value: fmtExactUsd(futuresCapUsd) },
            { label: "Убрать с HL", value: fmtExactUsd(futuresBreachUsd), tone: futuresBreachUsd > 0 ? "warn" : "ok" },
            { label: "После вывода", value: fmtExactUsd(futuresAfterWithdraw), tone: futuresAfterWithdraw <= futuresCapUsd ? "ok" : "warn" },
            { label: "Health после шага", value: `${healthAfterWithdraw}/100`, tone: healthAfterWithdraw > currentHealth ? "ok" : "warn" },
          ],
        },
        {
          title: "Вариант 2 — увеличить капитал",
          body:
            `Если не сокращать HL-карман, вложенный капитал должен быть не ниже ${fmtExactUsd(capitalNeeded)}. ` +
            `Тогда текущие ${fmtExactUsd(futuresUsedUsd)} фьючерсов будут ровно ${fmtPct(limitShare)} от базы.`,
          rows: [
            { label: "Текущая база", value: fmtExactUsd(baseCapital) },
            { label: "Нужная база", value: fmtExactUsd(capitalNeeded), tone: "ok" },
            { label: "Добавить капитал", value: fmtExactUsd(capitalToAdd), tone: capitalToAdd > 0 ? "warn" : "ok" },
          ],
        },
        {
          title: "До исправления",
          body: "Не открывать новые фьючерсные сделки: лимит активной торговли уже превышен.",
        },
      ],
      formula: [
        { label: "Фьючерсный лимит", value: `${fmtPct(limitShare)} от вложенного капитала` },
        { label: "Превышение", value: `${fmtExactUsd(futuresUsedUsd)} − ${fmtExactUsd(futuresCapUsd)} = ${fmtExactUsd(futuresBreachUsd)}` },
        { label: "Оценка здоровья", value: `${currentHealth}/100 → ${Math.max(projectedHealth, healthAfterWithdraw)}/100` },
      ],
    };
  }

  if (rec.kind === "reserve") {
    const rm = all.find((component) => component.key === "reserve")?.meta;
    const reserveUsd = rm?.reserveUsd ?? (healthInput.reserveShare ?? healthInput.cashShare) * (healthInput.investedCapital ?? healthInput.portfolioValue ?? 0);
    const targetUsd = rm?.reserveTargetUsd ?? 0;
    const bandMaxUsd = rm?.reserveBandMaxUsd ?? 0;
    const idleUsd = rm?.reserveIdleUsd ?? Math.max(0, reserveUsd - bandMaxUsd);
    const shortfallUsd = rm?.reserveTargetShortfallUsd ?? Math.max(0, targetUsd - reserveUsd);

    return {
      title: "Резерв и свободные деньги",
      score: projectedHealth,
      summary:
        idleUsd > 0
          ? `В резерве лишние ${fmtExactUsd(idleUsd)} сверх верхнего коридора. Эти деньги можно вернуть в работу без нарушения подушки.`
          : `Резерв ниже целевой зоны на ${fmtExactUsd(shortfallUsd)}. Сначала восстановите подушку, потом добавляйте риск.`,
      steps: [
        {
          title: idleUsd > 0 ? "Вернуть лишний резерв в работу" : "Восстановить резерв",
          body:
            idleUsd > 0
              ? `Переведите ${fmtExactUsd(idleUsd)} из резерва в разрешенные покупки по текущим лимитам.`
              : `Пополните резерв минимум на ${fmtExactUsd(shortfallUsd)} до целевой зоны стратегии.`,
          primary: true,
          rows: [
            { label: "Текущий резерв", value: fmtExactUsd(reserveUsd) },
            { label: "Цель резерва", value: fmtExactUsd(targetUsd) },
            { label: "Верх коридора", value: fmtExactUsd(bandMaxUsd) },
            { label: "Health после шага", value: `${projectedHealth}/100`, tone: "ok" },
          ],
        },
      ],
    };
  }

  if (rec.kind === "diversification") {
    const dm = all.find((component) => component.key === "diversification")?.meta;
    return {
      title: "Диверсификация",
      score: projectedHealth,
      summary: dm?.missingClassNames?.length
        ? `В портфеле отсутствует класс: ${dm.missingClassNames.join(" / ")}. Добавление класса снижает зависимость от одного рынка.`
        : `${dm?.largestClassName ?? "Крупнейший класс"} занимает ${fmtPct(dm?.largestClassShareOfRisk ?? 0)} рисковой части.`,
      steps: [
        {
          title: "Добрать недостающий класс",
          body: dm?.rebalanceAddUsd
            ? `Добавьте около ${fmtExactUsd(dm.rebalanceAddUsd)} в ${dm.otherClassNames?.join(" / ").toLowerCase() || "другие классы"}.`
            : "Добавьте отсутствующий спотовый класс небольшим размером внутри лимитов.",
          primary: true,
          rows: [
            { label: "Крупнейший класс", value: dm?.largestClassName ?? "-" },
            { label: "Доля риска", value: fmtPct(dm?.largestClassShareOfRisk ?? 0), tone: (dm?.largestClassShareOfRisk ?? 0) > 0.8 ? "danger" : "ok" },
            { label: "Health после шага", value: `${projectedHealth}/100`, tone: "ok" },
          ],
        },
      ],
    };
  }

  if (rec.kind === "concentration") {
    const cm = all.find((component) => component.key === "concentration")?.meta;
    const asset = cm?.worstConcentrationAsset ?? "Актив";
    const limit = cm?.worstConcentrationLimit ?? 0;
    const share = cm?.worstConcentrationShare ?? 0;
    const portfolioShare = cm?.worstConcentrationPortfolioShare ?? 0;
    const portfolioValue = healthInput.portfolioValue ?? healthInput.investedCapital ?? 0;
    const currentUsd = portfolioValue > 0 && portfolioShare > 0 ? portfolioValue * portfolioShare : 0;
    const concentrationBaseUsd = currentUsd > 0 && share > 0 ? currentUsd / share : 0;
    const limitUsd = concentrationBaseUsd * limit;
    const rotateWithinBaseUsd = Math.max(0, currentUsd - limitUsd);
    const sellToCashUsd =
      limit > 0 && limit < 1
        ? Math.max(0, (currentUsd - limit * concentrationBaseUsd) / (1 - limit))
        : rotateWithinBaseUsd;
    const hasReductionMath =
      currentUsd > 0 && concentrationBaseUsd > 0 && share > limit && limit > 0;
    const steps: CoreRecDetailStep[] = [
      {
        title: `Не докупать ${asset}`,
        body:
          `Пауза на добор без долларовой суммы: новые покупки ${asset} усиливают нарушение концентрации. ` +
          `Сначала нужно вернуть долю к лимиту ${fmtPct(limit)}.`,
        primary: true,
        rows: [
          { label: "Актив", value: asset },
          { label: "Текущая доля в базе", value: fmtPct(share), tone: share > limit ? "danger" : "ok" },
          { label: "Лимит", value: fmtPct(limit) },
          { label: "Доля в портфеле", value: fmtPct(portfolioShare) },
        ],
      },
    ];

    if (hasReductionMath) {
      steps.push({
        title: "Если возвращать в лимит",
        body:
          `Если переложить часть ${asset} в другой актив той же базы, нужно переложить около ${fmtExactUsd(rotateWithinBaseUsd)}. ` +
          `Если выводить из этой базы в кэш, нужно продать около ${fmtExactUsd(sellToCashUsd)}.`,
        rows: [
          { label: `Стоимость ${asset}`, value: fmtExactUsd(currentUsd) },
          { label: "База расчета", value: fmtExactUsd(concentrationBaseUsd) },
          { label: "Лимит в базе", value: fmtExactUsd(limitUsd) },
          { label: "Переложить внутри базы", value: fmtExactUsd(rotateWithinBaseUsd), tone: "warn" },
          { label: "Продать в кэш", value: fmtExactUsd(sellToCashUsd), tone: "warn" },
          { label: "Health после шага", value: `${projectedHealth}/100`, tone: "ok" },
        ],
      });
    }

    return {
      title: "Концентрация актива",
      score: projectedHealth,
      summary:
        `${asset} занимает ${fmtPct(share)} своей базы при лимите ${fmtPct(limit)}. ` +
        `Не докупать — это режим паузы; сумма нужна только для отдельного действия сокращения или перекладки.`,
      steps,
    };
  }

  if (rec.kind === "survival") {
    const sm = all.find((component) => component.key === "crypto")?.meta;
    const plannedUsd = sm?.plannedLimitOrdersUsd ?? healthInput.plannedLimitOrdersUsd ?? 0;
    const buyPowerAfterShockUsd = sm?.survivalBuyPowerAfterShockUsd ?? 0;
    const orderShortfallUsd = Math.max(0, plannedUsd - buyPowerAfterShockUsd);
    return {
      title: "Выживаемость",
      score: projectedHealth,
      summary:
        `Стресс-сценарий: ${sm?.survivalWorstScenario ?? "рыночный шок"}. ` +
        `Проверяем, хватит ли свободных денег после падения на уже подготовленный план покупок.`,
      steps: [
        {
          title: "Проверить план лимитных покупок",
          body:
            orderShortfallUsd > 0
              ? `Сейчас план покупок на падении больше свободных денег после стресс-сценария на ${fmtExactUsd(orderShortfallUsd)}. Уменьшите сумму активных buy-уровней или увеличьте свободный резерв до новых покупок.`
              : `План покупок на падении помещается в свободные деньги после стресс-сценария. Новый риск все равно проходит обычную проверку сделки.`,
          primary: true,
          rows: [
            { label: "Оценочная просадка", value: fmtPct(sm?.survivalShockLossPct ?? 0), tone: "warn" },
            { label: "Портфель после шока", value: fmtExactUsd(sm?.survivalPortfolioAfterShockUsd ?? 0) },
            { label: "Свободно после шока", value: fmtExactUsd(buyPowerAfterShockUsd), tone: buyPowerAfterShockUsd > 0 ? "ok" : "danger" },
            { label: "План buy-ордеров", value: fmtExactUsd(plannedUsd), tone: plannedUsd > buyPowerAfterShockUsd ? "danger" : "ok" },
            { label: "Что изменить", value: orderShortfallUsd > 0 ? `снизить план на ${fmtExactUsd(orderShortfallUsd)}` : "не увеличивать риск без проверки", tone: orderShortfallUsd > 0 ? "warn" : "ok" },
            { label: "Health после шага", value: `${projectedHealth}/100`, tone: "ok" },
          ],
        },
        {
          title: "Что считается планом",
          body: "В расчет входят только активные уровни покупки из вкладки «Сигналы»: актив, действие Купить/Buy, сумма в долларах и цена входа. Продажи, сработавшие, отключенные и пустые строки не должны занимать покупательскую способность.",
        },
      ],
      formula: [
        { label: "1. Стресс-сценарий", value: sm?.survivalWorstScenario ?? "рыночный шок" },
        { label: "2. Свободно после шока", value: fmtExactUsd(buyPowerAfterShockUsd), tone: buyPowerAfterShockUsd > 0 ? "ok" : "danger" },
        { label: "3. План buy-ордеров", value: fmtExactUsd(plannedUsd), tone: plannedUsd > buyPowerAfterShockUsd ? "danger" : "ok" },
        { label: "4. Разница", value: orderShortfallUsd > 0 ? `не хватает ${fmtExactUsd(orderShortfallUsd)}` : "план помещается", tone: orderShortfallUsd > 0 ? "warn" : "ok" },
      ],
    };
  }

  if (rec.kind === "discipline") {
    const dm = all.find((component) => component.key === "flexibility")?.meta;
    const coverage = dm?.disciplineJournalCoverage ?? healthInput.disciplineJournalCoverage ?? 0;
    return {
      title: "Дисциплина решений",
      score: projectedHealth,
      summary: `Журнал решений заполнен на ${fmtPct(coverage)}. Это не PnL и не история сделок, а покрытие новых проверок сделки сохранёнными решениями.`,
      steps: [
        {
          title: "Закрыть журнал решений",
          body: "Путь простой: открыть «Проверка», ввести актив и сумму, заполнить причину входа, риск, сценарий отмены и план выхода, затем сохранить решение. После этого запись появится в «Отчётах» и начнёт повышать покрытие журнала.",
          primary: true,
          rows: [
            { label: "Текущее покрытие", value: fmtPct(coverage), tone: coverage >= 0.8 ? "ok" : "warn" },
            { label: "Цель процесса", value: "80%" },
            { label: "Если сейчас 0%", value: "нет сохранённых проверок сделки" },
            { label: "Health после шага", value: `${projectedHealth}/100`, tone: "ok" },
          ],
        },
      ],
    };
  }

  return undefined;
}

function coreRecKindForComponent(component: HealthComponent): CoreRecKind {
  switch (component.key) {
    case "reserve":
      return "reserve";
    case "diversification":
      return "diversification";
    case "concentration":
      return "concentration";
    case "futures":
      return "risk";
    case "crypto":
      return "survival";
    case "flexibility":
      return "discipline";
  }
}

function componentAlerts(component: HealthComponent): string[] {
  switch (component.key) {
    case "reserve":
      return [...(component.meta?.reserveBlockers ?? []), ...(component.meta?.reserveWarnings ?? [])];
    case "diversification":
      return [...(component.meta?.diversificationBlockers ?? []), ...(component.meta?.diversificationWarnings ?? [])];
    case "concentration":
      return [...(component.meta?.concentrationBlockers ?? []), ...(component.meta?.concentrationWarnings ?? [])];
    case "futures":
      return [...(component.meta?.riskControlBlockers ?? []), ...(component.meta?.riskControlWarnings ?? [])];
    case "crypto":
      return [...(component.meta?.survivalBlockers ?? []), ...(component.meta?.survivalWarnings ?? [])];
    case "flexibility":
      return [...(component.meta?.disciplineBlockers ?? []), ...(component.meta?.disciplineWarnings ?? [])];
  }
}

function recommendationFromAlert(component: HealthComponent, alert: string): string {
  const lower = alert.toLowerCase();
  const meta = component.meta;

  switch (component.key) {
    case "reserve": {
      const idleUsd = meta?.reserveIdleUsd ?? 0;
      if (lower.includes("капитал простаивает") && idleUsd > 0) return `${fmtExactUsd(idleUsd)} нужно пустить в работу`;
      if (lower.includes("неприкосновенной")) return "Отключить сделки и восстановить неприкосновенную часть";
      if (lower.includes("необходимого остатка")) return "Не добавлять риск до восстановления необходимого остатка";
      return "Вернуть резерв в правила стратегии";
    }
    case "crypto":
      if (lower.includes("покупатель")) return "Не добавлять риск до восстановления покупательской способности";
      return "Подготовить стресс-план до нового риска";
    case "futures":
      if (lower.includes("ликвидац")) return "Снять риск ликвидации: сократить позицию или добавить маржу";
      if (lower.includes("плеч")) return "Снизить плечо до лимита стратегии";
      if (lower.includes("лимит")) return "Сократить активную торговлю до лимита";
      return "Снизить фьючерсный риск перед новыми сделками";
    case "concentration":
      if (lower.includes("мест")) return "Не добавлять новый актив, пока место не освободится";
      if (meta?.worstConcentrationAsset && meta.worstConcentrationAsset !== "-") {
        return `Не докупать ${meta.worstConcentrationAsset}: вернуть актив в лимит`;
      }
      return "Вернуть активы в лимиты стратегии";
    case "diversification":
      if (meta?.missingClassNames?.length) return `Добавить отсутствующий класс: ${meta.missingClassNames.join(" / ").toLowerCase()}`;
      return "Сбалансировать спотовые классы риска";
    case "flexibility":
      if (lower.includes("журнал")) return "Заполнить журнал решений до новых сделок";
      return "Поставить сделки на паузу и закрыть нарушение дисциплины";
  }
}

function buildAlertRecs(all: HealthComponent[]): CoreRec[] {
  const seenKinds = new Set<CoreRecKind>();

  return all.flatMap((component) => {
    const kind = coreRecKindForComponent(component);
    const alert = componentAlerts(component)[0];
    if (!alert || seenKinds.has(kind)) return [];
    seenKinds.add(kind);
    const gain = Math.max(1, componentGain(kind, all));

    return [{
      action: recommendationFromAlert(component, alert),
      gain,
      source: `${component.label}: ${alert} → здоровье +${gain}`,
      critical: true,
      kind,
    }];
  });
}

function finalizeCoreRecs(recs: CoreRec[], healthInput: HealthInput | undefined, all: HealthComponent[]): CoreRec[] {
  const currentHealth = healthInput ? computePortfolioHealth(healthInput).healthFactor : undefined;
  const seen = new Set<string>();

  return recs
    .map((rec) => {
      const simulatedGain =
        healthInput && currentHealth !== undefined && rec.kind
          ? Math.max(0, Math.round(healthAfterRecommendation(healthInput, rec.kind) - currentHealth))
          : rec.gain;
      const realRayGain = componentGain(rec.kind, all);
      const gain = Math.max(simulatedGain, realRayGain);

      return {
        ...rec,
        gain,
        source: `${rec.source} → здоровье +${gain}`,
        details: recommendationDetails({ ...rec, gain }, healthInput, all, currentHealth),
      };
    })
    .filter((rec) => rec.gain > 0)
    .filter((rec) => {
      const key = rec.kind ?? rec.action;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(Boolean(b.critical)) - Number(Boolean(a.critical)) || b.gain - a.gain)
    .slice(0, 5);
}

export function buildHealthBoardRecs(
  weak: HealthComponent[],
  portfolio: V2Portfolio,
  all: HealthComponent[] = [],
  healthInput?: HealthInput,
): CoreRec[] {
  const alertRecs = buildAlertRecs(all);
  const usedKinds = new Set(alertRecs.map((rec) => rec.kind));
  const generalRecs = buildCoreRecs(weak, portfolio, all, healthInput)
    .filter((rec) => !rec.kind || !usedKinds.has(rec.kind))
    .map((rec) => ({ ...rec, critical: false }));

  const seen = new Set<string>();
  const currentHealth = healthInput ? computePortfolioHealth(healthInput).healthFactor : undefined;
  return [...alertRecs, ...generalRecs]
    .filter((rec) => {
      const key = `${rec.kind ?? ""}:${rec.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 7)
    .map((rec) => ({
      ...rec,
      details: rec.details ?? recommendationDetails(rec, healthInput, all, currentHealth),
    }));
}

function isExpansionRecommendation(rec: CoreRec): boolean {
  return (
    rec.action.startsWith("Добавить") ||
    rec.action.startsWith("Выравнивать") ||
    rec.action.startsWith("Распределить")
  );
}

export function buildCoreRecs(
  weak: HealthComponent[],
  portfolio: V2Portfolio,
  all: HealthComponent[] = [],
  healthInput?: HealthInput,
): CoreRec[] {
  const result: CoreRec[] = [];
  const reserve = all.find((c) => c.key === "reserve");
  const rm = reserve?.meta;
  const reserveTargetUsd = rm?.reserveTargetUsd ?? portfolio.totalPortfolioValue * 0.30;
  const reserveBaseUsd = rm?.reserveBaseUsd ?? portfolio.totalPortfolioValue;
  const reserveTargetPct = reserveBaseUsd > 0
    ? Math.round((reserveTargetUsd / reserveBaseUsd) * 100)
    : 30;
  const deficit = Math.max(0, reserveTargetUsd - portfolio.stableReserve);
  const reserveBlockers = rm?.reserveBlockers ?? [];
  const reserveTargetShortfallUsd = rm?.reserveTargetShortfallUsd ?? deficit;
  const reserveIdleUsd = rm?.reserveIdleUsd ?? 0;
  const reserveBandMaxUsd = rm?.reserveBandMaxUsd ?? reserveBaseUsd * 0.60;
  const reserveBandMaxPct = reserveBaseUsd > 0
    ? Math.round((reserveBandMaxUsd / reserveBaseUsd) * 100)
    : 60;
  const reserveShare = rm?.reserveShare ?? portfolio.reserveShare ?? 0;
  const hasHardReserveGate = reserveBlockers.length > 0 || reserveShare < 0.10 || portfolio.deployableCapital < 50;
  if (reserveBlockers.length) {
    result.push({
      action: `Не открывать новые позиции: ${reserveBlockers[0].toLowerCase()}`,
      gain: 7,
      source: "Сначала восстановить резерв",
      critical: true,
      kind: "reserve",
    });
  }
  if (reserveIdleUsd > 0) {
    result.push({
      action: `${fmtExactUsd(reserveIdleUsd)} нужно пустить в работу`,
      gain: 4,
      source: `Резерв выше ${reserveBandMaxPct}% — капитал простаивает`,
      kind: "reserve",
    });
  }

  // ── Контроль риска: штрафуем только превышение, не свободный остаток. ──
  const fut = all.find((c) => c.key === "futures");
  const fm = fut?.meta;
  const futuresBreachUsd = fm?.futuresBreachUsd ?? 0;
  const futuresUsedUsd = fm?.futuresUsedUsd ?? 0;
  const futuresCapUsd = fm?.futuresCapUsd ?? 0;
  const riskControlBlockers = fm?.riskControlBlockers ?? [];
  if (riskControlBlockers.length) {
    result.push({
      action: `Не добавлять новый риск: ${riskControlBlockers[0].toLowerCase()}`,
      gain: 6,
      source: "Сначала устранить блокировку контроля риска",
      critical: true,
      kind: "risk",
    });
  }
  if (futuresBreachUsd >= 1) {
    result.push({
      action: `Сократить фьючерсный риск на ${fmt$(futuresBreachUsd)}`,
      gain: 6,
      source: `Занято ${fmt$(futuresUsedUsd)} при лимите ${fmt$(futuresCapUsd)}`,
      critical: true,
      kind: "risk",
    });
  }

  // ── Близость к ликвидации: чем ближе цена, тем громче сигнал. ──
  if (fm?.worstLiqAsset && fm.worstLiqDistance !== undefined && fm.worstLiqDistance < 0.4) {
    const pct = Math.round(fm.worstLiqDistance * 100);
    result.push({
      action:
        fm.worstLiqDistance <= 0.1
          ? `Срочно: ${fm.worstLiqAsset} в ${pct}% от ликвидации`
          : `Увеличить запас по ${fm.worstLiqAsset} — ${pct}% до ликвидации`,
      gain: 5,
      source: "Долить маржу или сократить позицию",
      critical: fm.worstLiqDistance <= 0.1,
      kind: "risk",
    });
  }

  // ── Концентрация: актив сверх своего per-asset лимита рекомендуем сократить
  // ДАЖЕ при «умеренном» балле (перевес не всегда роняет score ниже порога weak).
  // Конкретный актив и его лимит — из меты.
  const conc = all.find((c) => c.key === "concentration");
  const cm = conc?.meta;
  const concentrationBlockers = cm?.concentrationBlockers ?? [];
  if (concentrationBlockers.includes("Превышен лимит альткоин-мест")) {
    result.push({
      action: "Сократить лишний альткоин или освободить место",
      gain: 5,
      source: "В крипто-блоке только 3 места под альткоины по 5%",
      critical: true,
      kind: "concentration",
    });
  }
  if (concentrationBlockers.includes("Превышен лимит мест акций")) {
    result.push({
      action: "Сократить лишнюю акцию или освободить место",
      gain: 5,
      source: "В портфеле только 2 места под акции по 5%",
      critical: true,
      kind: "concentration",
    });
  }
  if (concentrationBlockers.includes("Превышен лимит мест металлов")) {
    result.push({
      action: "Сократить лишний металл или освободить место",
      gain: 5,
      source: "В портфеле только 2 места под металлы по 5%",
      critical: true,
      kind: "concentration",
    });
  }
  if ((cm?.concentrationWarnings ?? []).includes("Все 3 альткоин-места заняты")) {
    result.push({
      action: "Не добавлять новые альткоины",
      gain: 3,
      source: "Все 3 места под альткоины уже заняты",
      kind: "concentration",
    });
  }
  if ((cm?.concentrationWarnings ?? []).includes("Все 2 места акций заняты")) {
    result.push({
      action: "Не добавлять новые акции",
      gain: 3,
      source: "Все 2 места под акции уже заняты",
      kind: "concentration",
    });
  }
  if ((cm?.concentrationWarnings ?? []).includes("Все 2 места металлов заняты")) {
    result.push({
      action: "Не добавлять новые металлы",
      gain: 3,
      source: "Все 2 места под металлы уже заняты",
      kind: "concentration",
    });
  }
  if (cm?.worstConcentrationAsset && cm.worstConcentrationAsset !== "-" && (cm.maxAssetLimitUtilization ?? 0) > 1) {
    const limit = Math.round((cm.worstConcentrationLimit ?? 0) * 100);
    const shareBase = Math.round((cm.worstConcentrationShare ?? 0) * 100);
    const over = cm.overLimitAssets?.length ?? 1;
    result.push({
      action: concentrationBlockers.length
        ? `Не докупать ${cm.worstConcentrationAsset}: ${concentrationBlockers[0].toLowerCase()}`
        : `Сократить ${cm.worstConcentrationAsset} — ${shareBase}% при лимите ${limit}%`,
      gain: 5,
      source:
        over > 1
          ? `${cm.worstConcentrationAsset} и ещё ${over - 1} актив(а) сверх лимита`
          : `Приведёт ${cm.worstConcentrationAsset} к своему лимиту`,
      critical: concentrationBlockers.length > 0,
      kind: "concentration",
    });
  }

  const survival = all.find((c) => c.key === "crypto");
  const survivalBlockers = survival?.meta?.survivalBlockers ?? [];
  if (survivalBlockers.length) {
    result.push({
      action: `Не добавлять риск: ${survivalBlockers[0].toLowerCase()}`,
      gain: 6,
      source: "Сначала пройти стресс-сценарий",
      critical: true,
      kind: "survival",
    });
  }

  const discipline = all.find((c) => c.key === "flexibility");
  const disciplineBlockers = discipline?.meta?.disciplineBlockers ?? [];
  if (disciplineBlockers.length) {
    result.push({
      action: `Пауза на новые сделки: ${disciplineBlockers[0].toLowerCase()}`,
      gain: 6,
      source: "Сначала восстановить дисциплину решений",
      critical: true,
      kind: "discipline",
    });
  }

  // ── Критический сигнал: покупательская сила на нуле ──
  if (portfolio.deployableCapital < 50) {
    result.push({
      action: "Пополнить торговый баланс — покупательская сила на нуле",
      gain: 7,
      source: "Разблокирует откупы на просадках",
      critical: true,
      kind: "reserve",
    });
  }
  // ── Критический сигнал: резерв сильно ниже цели ──
  if (deficit > portfolio.totalPortfolioValue * 0.10) {
    result.push({
      action: reserveTargetShortfallUsd > 0 ? `Пополнить резерв на ${fmt$(reserveTargetShortfallUsd)} до целевых ${reserveTargetPct}%` : `Поддерживать резерв выше ${reserveTargetPct}%`,
      gain: 6,
      source: "Резерв вернётся к норме",
      critical: true,
      kind: "reserve",
    });
  }

  for (const c of weak.slice(0, 5)) {
    switch (c.key) {
      case "reserve":
        if (!result.some(r => r.source.startsWith("Резерв")))
          result.push({
            action: reserveTargetShortfallUsd > 0 ? `Пополнить резерв на ${fmt$(reserveTargetShortfallUsd)}` : `Поддерживать резерв выше ${reserveTargetPct}%`,
            gain: 6, source: "Резерв вернётся к норме", kind: "reserve"
          });
        result.push({ action: "Не открывать новые позиции, пока резерв не достигнут", gain: 3, source: "Сохранит подушку и манёвр", kind: "reserve" });
        break;
      case "flexibility":
        if ((c.meta?.disciplineBlockers ?? []).length) {
          if (!result.some((r) => r.action.startsWith("Пауза на новые сделки"))) {
            result.push({
              action: `Пауза на новые сделки: ${c.meta?.disciplineBlockers?.[0]?.toLowerCase()}`,
              gain: 6,
              source: "Сначала восстановить дисциплину решений",
              critical: true,
              kind: "discipline",
            });
          }
        }
        result.push({
          action: "Заполнить журнал решений и убрать сделки вне плана",
          gain: 4,
          source: "Дисциплина влияет на здоровье капитала",
          kind: "discipline",
        });
        break;
      case "diversification": {
        // Конкретика из модели (portfolioHealth): кто перегружен и сколько добавить
        const m = c.meta;
        if ((m?.diversificationBlockers ?? []).length) {
          result.push({
            action: "Добавить второй спотовый класс",
            gain: 5,
            source: "Снизит зависимость от одного класса",
            kind: "diversification",
          });
        }
        if (m?.largestClassShareOfRisk && m.largestClassShareOfRisk > 0.8 && m.rebalanceAddUsd) {
          const pct = Math.round(m.largestClassShareOfRisk * 100);
          const others = (m.otherClassNames ?? []).join(" / ").toLowerCase();
          const portfolioPct = Math.round((m.largestClassShareOfPortfolio ?? 0) * 100);
          result.push({
            action: `Добавить ≈${fmt$(m.rebalanceAddUsd)} в ${others}`,
            gain: 4,
            source: `${m.largestClassName} — ${portfolioPct}% портфеля, но ${pct}% рисковой части (без кэша), лимит 80%`,
            kind: "diversification",
          });
        } else if (m?.missingClassNames?.length) {
          result.push({
            action: `Добавить отсутствующий класс: ${m.missingClassNames.join(" / ").toLowerCase()}`,
            gain: 4,
            source: "Снизит корреляцию портфеля",
            kind: "diversification",
          });
        } else {
          result.push({ action: "Выравнивать классы к лимитам 60/10/10", gain: 4, source: "Снизит корреляцию портфеля", kind: "diversification" });
        }
        break;
      }
      case "crypto":
        if ((c.meta?.survivalBlockers ?? []).length) {
          if (!result.some((r) => r.action.startsWith("Не добавлять риск"))) {
            result.push({
              action: `Не добавлять риск: ${c.meta?.survivalBlockers?.[0]?.toLowerCase()}`,
              gain: 6,
              source: "Сначала пройти стресс-сценарий",
              critical: true,
              kind: "survival",
            });
          }
        }
        result.push({
          action: "Снизить уязвимость к рыночному шоку",
          gain: 5,
          source: "План ордеров и покупательская способность после падения",
          kind: "survival",
        });
        break;
      case "concentration":
        // Если уже добавили точечную «Сократить <актив>» — не дублируем.
        if (!result.some((r) => r.action.startsWith("Сократить")))
          result.push({ action: "Распределить часть крупнейшей позиции", gain: 5, source: "Снизит концентрацию риска", kind: "concentration" });
        break;
      case "futures":
        result.push({ action: "Снизить маржу, плечо или число позиций", gain: 5, source: "Уменьшит фьючерсный риск", kind: "risk" });
        break;
    }
  }
  return finalizeCoreRecs([
    ...result.filter((rec) => rec.critical),
    ...result.filter((rec) => !rec.critical),
  ].filter((rec) => !hasHardReserveGate || !isExpansionRecommendation(rec)), healthInput, all);
}
