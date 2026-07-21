// Чистые хелперы и геометрия для V2HealthCore: score->подсказки/цвета,
// гексагон-радар, раскладка чипов, интерпретация здоровья, диагноз и рекомендации.
// Вынесено из V2HealthCore.tsx, чтобы компонент отвечал только за render.
import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import type { HealthComponent } from "../../lib/portfolioHealth";

export const CX = 140, CY = 140;
export const RADAR_R = 118;
export const OUTER_R = 136;

export const VB_OFF = 80;
export const VB_SIZE = 280 + VB_OFF * 2; // 440

export const CHIP_W = 89, CHIP_H = 52, GAP = 12, CHIP_R = 40;

export const CHIP_LABEL: Record<string, string> = {
  reserve:         "Резерв",
  crypto:          "Волатильность",
  futures:         "Контроль риска",
  concentration:   "Концентрация",
  diversification: "Диверсификация",
  flexibility:     "Гибкость",
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
  crypto:          "Волатильность",
  futures:         "Контроль риска",
  concentration:   "Концентрация",
  diversification: "Диверсификация",
  flexibility:     "Гибкость",
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

export function diagWhy(c: HealthComponent, portfolio: V2Portfolio): string {
  const reservePct = Math.round(portfolio.reserveShare * 100);
  const reserveUsd = portfolio.stableReserve;
  const targetUsd  = Math.round(portfolio.totalPortfolioValue * 0.30);
  switch (c.key) {
    case "reserve":
      if ((c.meta?.reserveBlockers ?? []).length) return c.meta?.reserveBlockers?.[0] ?? "";
      if ((c.meta?.reserveWarnings ?? []).length) return c.meta?.reserveWarnings?.[0] ?? "";
      if (c.score <= 0) return `Резерв $0 — подушки нет, нечем откупать`;
      if (c.score < 50)
        return `${reservePct}% от цели 30%. Дефицит ${fmt$(Math.max(0, targetUsd - reserveUsd))}`;
      return `${reservePct}% от цели 30%`;
    case "flexibility":
      if (c.score <= 0) return "Свободных денег нет — манёвра нет";
      return `Свободно ${fmt$(portfolio.deployableCapital)}`;
    case "diversification":
      return "Капитал сконцентрирован в одном классе";
    case "crypto":
      return "Доля крипты выше лимита 60%";
    case "concentration": {
      const m = c.meta;
      if (m?.worstConcentrationAsset && m.worstConcentrationAsset !== "-" && (m.maxAssetLimitUtilization ?? 0) > 1) {
        const limit = Math.round((m.worstConcentrationLimit ?? 0) * 100);
        return `${m.worstConcentrationAsset} выше своего лимита ${limit}%`;
      }
      if (c.score < 70) return "Актив близко к своему лимиту";
      return "Активы в пределах лимитов";
    }
    case "futures":
      if ((c.meta?.riskControlBlockers ?? []).length) return c.meta?.riskControlBlockers?.[0] ?? "";
      if ((c.meta?.leverageBreaches ?? []).length) return "Плечо превышено";
      if (c.meta?.futuresCount && c.meta.futuresCount > 3) return `${c.meta.futuresCount}/3 позиций — лимит превышен`;
      if ((c.meta?.futuresBreachUsd ?? 0) > 0) return "Превышен лимит активной торговли 10%";
      return `Занято ${Math.round((c.meta?.futuresShare ?? 0) * 1000) / 10}% из лимита 10%, плечо в норме`;
    default:
      return "";
  }
}

export type CoreRec = { action: string; gain: number; source: string; critical?: boolean };

export type CoreAchievement = { title: string; detail: string };

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

export function buildCoreRecs(
  weak: HealthComponent[],
  portfolio: V2Portfolio,
  all: HealthComponent[] = [],
): CoreRec[] {
  const deficit = Math.max(0, portfolio.totalPortfolioValue * 0.30 - portfolio.stableReserve);
  const result: CoreRec[] = [];
  const reserve = all.find((c) => c.key === "reserve");
  const rm = reserve?.meta;
  const reserveBlockers = rm?.reserveBlockers ?? [];
  const reserveTargetShortfallUsd = rm?.reserveTargetShortfallUsd ?? deficit;
  if (reserveBlockers.length) {
    result.push({
      action: `Не открывать новые позиции: ${reserveBlockers[0].toLowerCase()}`,
      gain: 7,
      source: "Сначала восстановить резерв → здоровье +7",
      critical: true,
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
      source: "Сначала устранить блокировку контроля риска → здоровье +6",
      critical: true,
    });
  }
  if (futuresBreachUsd >= 1) {
    result.push({
      action: `Сократить фьючерсный риск на ${fmt$(futuresBreachUsd)}`,
      gain: 6,
      source: `Занято ${fmt$(futuresUsedUsd)} при лимите ${fmt$(futuresCapUsd)} → здоровье +6`,
      critical: true,
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
      source: "Долить маржу или сократить позицию → здоровье +5",
      critical: fm.worstLiqDistance <= 0.1,
    });
  }

  // ── Концентрация: актив сверх своего per-asset лимита рекомендуем сократить
  // ДАЖЕ при «умеренном» балле (перевес не всегда роняет score ниже порога weak).
  // Конкретный актив и его лимит — из меты.
  const conc = all.find((c) => c.key === "concentration");
  const cm = conc?.meta;
  if (cm?.worstConcentrationAsset && cm.worstConcentrationAsset !== "-" && (cm.maxAssetLimitUtilization ?? 0) > 1) {
    const limit = Math.round((cm.worstConcentrationLimit ?? 0) * 100);
    const shareBase = Math.round((cm.worstConcentrationShare ?? 0) * 100);
    const over = cm.overLimitAssets?.length ?? 1;
    result.push({
      action: `Сократить ${cm.worstConcentrationAsset} — ${shareBase}% при лимите ${limit}%`,
      gain: 5,
      source:
        over > 1
          ? `${cm.worstConcentrationAsset} и ещё ${over - 1} актив(а) сверх лимита → здоровье +5`
          : `Приведёт ${cm.worstConcentrationAsset} к своему лимиту → здоровье +5`,
    });
  }

  // ── Критический сигнал: покупательская сила на нуле ──
  if (portfolio.deployableCapital < 50) {
    result.push({
      action: "Пополнить торговый баланс — покупательская сила на нуле",
      gain: 7,
      source: "Разблокирует откупы на просадках → здоровье +7",
      critical: true,
    });
  }
  // ── Критический сигнал: резерв сильно ниже цели ──
  if (deficit > portfolio.totalPortfolioValue * 0.10) {
    result.push({
      action: reserveTargetShortfallUsd > 0 ? `Пополнить резерв на ${fmt$(reserveTargetShortfallUsd)} до целевых 30%` : "Поддерживать резерв выше 30%",
      gain: 6,
      source: "Резерв вернётся к норме → здоровье +6",
      critical: true,
    });
  }

  for (const c of weak.slice(0, 5)) {
    switch (c.key) {
      case "reserve":
        if (!result.some(r => r.source.startsWith("Резерв")))
          result.push({
            action: reserveTargetShortfallUsd > 0 ? `Пополнить резерв на ${fmt$(reserveTargetShortfallUsd)}` : "Поддерживать резерв выше 30%",
            gain: 6, source: "Резерв вернётся к норме → здоровье +6"
          });
        result.push({ action: "Не открывать новые позиции, пока резерв не достигнут", gain: 3, source: "Сохранит подушку и манёвр → здоровье +3" });
        break;
      case "flexibility":
        result.push({ action: "Зафиксировать слабые позиции в кэш", gain: 4, source: "Повысит гибкость капитала → здоровье +4" });
        break;
      case "diversification": {
        // Конкретика из модели (portfolioHealth): кто перегружен и сколько добавить
        const m = c.meta;
        if (m?.largestClassShareOfRisk && m.largestClassShareOfRisk > 0.8 && m.rebalanceAddUsd) {
          const pct = Math.round(m.largestClassShareOfRisk * 100);
          const others = (m.otherClassNames ?? []).join(" / ").toLowerCase();
          const portfolioPct = Math.round((m.largestClassShareOfPortfolio ?? 0) * 100);
          result.push({
            action: `Добавить ≈${fmt$(m.rebalanceAddUsd)} в ${others}`,
            gain: 4,
            source: `${m.largestClassName} — ${portfolioPct}% портфеля, но ${pct}% рисковой части (без кэша), лимит 80% → +4`,
          });
        } else if (m?.missingClassNames?.length) {
          result.push({
            action: `Добавить отсутствующий класс: ${m.missingClassNames.join(" / ").toLowerCase()}`,
            gain: 4,
            source: "Снизит корреляцию портфеля → здоровье +4",
          });
        } else {
          result.push({ action: "Выравнивать классы к лимитам 60/10/10", gain: 4, source: "Снизит корреляцию портфеля → здоровье +4" });
        }
        break;
      }
      case "crypto":
        result.push({ action: "Зафиксировать часть крипты в стейблы", gain: 5, source: "Снизит волатильность портфеля → здоровье +5" });
        break;
      case "concentration":
        // Если уже добавили точечную «Сократить <актив>» — не дублируем.
        if (!result.some((r) => r.action.startsWith("Сократить")))
          result.push({ action: "Распределить часть крупнейшей позиции", gain: 5, source: "Снизит концентрацию риска → здоровье +5" });
        break;
      case "futures":
        result.push({ action: "Снизить маржу, плечо или число позиций", gain: 5, source: "Уменьшит фьючерсный риск → здоровье +5" });
        break;
    }
  }
  return result.slice(0, 5);
}
