import type { CSSProperties } from "react";
import type { FearGreedStrategy } from "../../types/portfolio";
import type { V2LabData, V2Portfolio, V2Position } from "../InvestorCabinetV2Lab";
import { buildCapitalBuckets, buildFuturesLimitSnapshot } from "../lib/capitalBuckets";
import { MAIN_INVESTOR_STRATEGY, type InvestorStrategy } from "../lib/investorStrategy";

type Props = {
  portfolio: V2Portfolio;
  allocation: V2LabData["allocation"];
  positions?: V2Position[];
  strategy: FearGreedStrategy;
  investorStrategy?: InvestorStrategy;
  /** Спекулятивная нагрузка 0..1 (маржа открытых фьючей + свободная маржа HL). */
  futuresShare?: number;
};

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function V2DeployableCapital({
  portfolio,
  allocation,
  positions = [],
  strategy,
  investorStrategy = MAIN_INVESTOR_STRATEGY,
  futuresShare = 0,
}: Props) {
  const totalPortfolio = portfolio.totalPortfolioValue || 0;
  const investedCapital = portfolio.totalInvested || totalPortfolio;
  const reserveTarget = investedCapital * investorStrategy.reserveTargetShare;
  const futuresLimit = buildFuturesLimitSnapshot({
    positions,
    futuresDeployableUsd: portfolio.futuresDeployable,
    investedCapital,
    investorStrategy,
  });
  const futuresUsedFallback = futuresShare * investedCapital;
  const futuresUsed = futuresLimit.usedUsd || futuresUsedFallback;
  const futuresRemaining = futuresLimit.usedUsd
    ? futuresLimit.remainingUsd
    : Math.max(investorStrategy.futuresMaxShare * investedCapital - futuresUsedFallback, 0);
  const futuresBreach = futuresLimit.usedUsd
    ? futuresLimit.breachUsd
    : Math.max(futuresUsedFallback - investorStrategy.futuresMaxShare * investedCapital, 0);
  const buckets = buildCapitalBuckets({
    totalPortfolioValue: portfolio.totalPortfolioValue,
    investedCapital,
    stableReserve: portfolio.stableReserve || portfolio.spotDeployable + portfolio.futuresDeployable,
    allocation,
    strategyRules: strategy.rules,
    futuresDeployableUsd: portfolio.futuresDeployable,
    futuresUsedUsd: futuresUsed,
    investorStrategy,
  });
  const deployable = buckets.workCashUsd;
  const spotDoborBudget = Math.max(0, Math.min(buckets.spotBudgetUsd, portfolio.spotDeployable));
  const pureReserve = buckets.lockedReserveUsd;
  const reserveShort = pureReserve < reserveTarget;

  const futuresCapUsd = investorStrategy.futuresMaxShare * investedCapital;
  const futuresOver = futuresBreach > 0;
  const reserveTargetPct = Math.round(investorStrategy.reserveTargetShare * 100);
  const futuresLimitPct = Math.round(investorStrategy.futuresMaxShare * 100);
  const metalsLimitPct = Math.round(investorStrategy.metalsMaxShare * 100);
  const stocksLimitPct = Math.round(investorStrategy.stocksMaxShare * 100);

  const rows: Array<{
    label: string;
    value: number;
    glyph: string;
    color: string;
    hint?: string;
    hintDanger?: boolean;
  }> = [
    { label: "ДСА добор", value: buckets.averagingBudgetUsd, glyph: "◇", color: "#5fe0cf" },
    {
      label: "Спот",
      value: spotDoborBudget,
      glyph: "○",
      color: "#56d8f5",
      hint: "Спот-добор: без отдельного ДСА и без свободной HL-маржи",
    },
    ...(investorStrategy.futuresAllowed
      ? [{
          label: "Фьючерсы",
          value: futuresLimit.freeMarginUsd,
          glyph: "↗",
          color: "#8f9ff0",
          hint: investedCapital
            ? futuresOver
              ? `Карман выше цели на ${money.format(futuresBreach)} — снять с HL или вернуть в общий резерв`
              : futuresRemaining > 0
                ? `До цели ${futuresLimitPct}% не хватает ${money.format(futuresRemaining)} — можно докинуть на HL`
                : `Карман у цели ${futuresLimitPct}%: позиции + свободная HL-маржа сбалансированы`
            : undefined,
          hintDanger: futuresOver,
        }]
      : []),
    {
      label: "Металлы до",
      value: buckets.metalsBudgetUsd,
      glyph: "◆",
      color: "#e2b66b",
      hint: `Класс металлов ограничен ${metalsLimitPct}% портфеля`,
    },
    {
      label: "Акции до",
      value: buckets.stocksBudgetUsd,
      glyph: "□",
      color: "#76dcaa",
      hint: `Класс акций ограничен ${stocksLimitPct}% портфеля`,
    },
  ];

  const maxValue = Math.max(...rows.map((r) => r.value), 1);

  return (
    <section className="v2-panel v2-allocation">
      <div className="v2-panel-header">
        <span>Торговый капитал</span>
        <strong className="v2-stables-total">{money.format(deployable)}</strong>
      </div>
      <div className="v2-alloc-kicker">можно пустить в работу сверх резерва</div>

      <div className="v2-alloc-cards">
        {rows.map((row) => {
          const fill = Math.max(0, Math.min(100, (row.value / maxValue) * 100));
          return (
            <div
              className="v2-alloc-card"
              key={row.label}
              style={{ "--c": row.color } as CSSProperties}
            >
              <span className="v2-alloc-icon" aria-hidden="true">
                {row.glyph}
              </span>
              <div className="v2-alloc-main">
                <div className="v2-alloc-line">
                  <span className="v2-alloc-name">{row.label}</span>
                  <strong className="v2-alloc-pct">{money.format(row.value)}</strong>
                </div>
                <div className="v2-alloc-track">
                  <span className="v2-alloc-fill" style={{ width: `${fill}%` }} />
                </div>
                {row.hint && (
                  <div className={`v2-alloc-hint${row.hintDanger ? " is-danger" : ""}`}>
                    {row.hint}
                  </div>
                )}
                {row.label === "Фьючерсы" && investorStrategy.futuresAllowed && (
                  <div className="v2-futures-breakdown">
                    <div className="v2-futures-breakdown-col">
                      <span>В позициях {money.format(futuresLimit.positionMarginUsd)}</span>
                      <span>Свободная маржа {money.format(futuresLimit.freeMarginUsd)}</span>
                    </div>
                    <div className="v2-futures-breakdown-col">
                      <span>Лимит {money.format(futuresCapUsd)}</span>
                      <span className={futuresOver ? "is-danger" : futuresRemaining > 0 ? "is-warn" : "is-ok"}>
                        {futuresOver
                          ? `Убрать ${money.format(futuresLimit.withdrawFromHlUsd)}`
                          : futuresRemaining > 0
                            ? `Добавить ${money.format(futuresLimit.transferToHlUsd)}`
                            : "Баланс"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Строка резерва — всегда показываем, красная варнинг если ниже цели */}
        <div className={`v2-alloc-card v2-reserve-row ${reserveShort ? "is-danger" : "is-ok"}`}>
          <span className="v2-alloc-icon v2-reserve-icon" aria-hidden="true">
            {reserveShort ? "⚠" : "◈"}
          </span>
          <div className="v2-alloc-main">
            <div className="v2-alloc-line">
              <span className="v2-alloc-name">
                Резерв
                <span className="v2-reserve-target"> · цель {reserveTargetPct}%</span>
              </span>
              <strong className="v2-alloc-pct">{money.format(pureReserve)}</strong>
            </div>
            {reserveShort && (
              <div className="v2-reserve-warning">
                ⚠ Опасно — резерв не сформирован. Нужно {money.format(reserveTarget)}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
