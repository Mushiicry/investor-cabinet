import { useEffect, useRef, useState } from "react";
import type { V2Portfolio } from "../InvestorCabinetV2Lab";
import {
  buildCapitalLadderAssetLimits,
  buildCapitalLadderSteps,
  type CapitalLadderStepStatus,
} from "../lib/capitalLadder";

type Props = {
  portfolio: V2Portfolio;
  mode?: "overview" | "health";
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const stepStatusLabel: Record<CapitalLadderStepStatus, string> = {
  done: "Пройденная ступень",
  current: "Текущая ступень",
  next: "Следующая ступень",
};

function HudCornerTL() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--tl" aria-hidden="true">
      <path d="M44 0.8 L0.8 0.8 L0.8 44" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M44 5.5 L5.5 5.5 L5.5 44" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
      <line x1="20" y1="0.8" x2="20" y2="5" stroke="rgba(86,196,240,0.5)" strokeWidth="1" />
    </svg>
  );
}

function HudCornerTR() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--tr" aria-hidden="true">
      <path d="M0 0.8 L43.2 0.8 L43.2 44" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M0 5.5 L38.5 5.5 L38.5 44" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
      <line x1="24" y1="0.8" x2="24" y2="5" stroke="rgba(86,196,240,0.5)" strokeWidth="1" />
    </svg>
  );
}

function HudCornerBL() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--bl" aria-hidden="true">
      <path d="M44 43.2 L0.8 43.2 L0.8 0" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M44 38.5 L5.5 38.5 L5.5 0" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function HudCornerBR() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="v2-phc-corner v2-phc-corner--br" aria-hidden="true">
      <path d="M0 43.2 L43.2 43.2 L43.2 0" stroke="rgba(86,196,240,0.75)" strokeWidth="1.5" fill="none" />
      <path d="M0 38.5 L38.5 38.5 L38.5 0" stroke="rgba(86,196,240,0.28)" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function EdgeDots() {
  return (
    <div className="v2-phc-dots v2-phc-dots--top" aria-hidden="true">
      <span className="v2-phc-dot" />
      <span className="v2-phc-dot" />
      <span className="v2-phc-dot" />
      <span className="v2-phc-dot" />
    </div>
  );
}

export function V2CapitalLadder({ portfolio, mode = "overview" }: Props) {
  const steps = buildCapitalLadderSteps(portfolio.totalInvested || 0);
  const plan = steps.find((step) => step.status === "current") ?? steps[0];
  const currentStepRef = useRef<HTMLButtonElement | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTargetOverride, setSelectedTargetOverride] = useState<number | null>(null);
  const selectedTarget = selectedTargetOverride ?? plan.targetUsd;
  const selectedStep = steps.find((step) => step.targetUsd === selectedTarget) ?? plan;
  const assetLimits = buildCapitalLadderAssetLimits(selectedStep);
  const [selectedAssetLimitId, setSelectedAssetLimitId] = useState("major-crypto");
  const selectedAssetLimit = assetLimits.find((limit) => limit.id === selectedAssetLimitId) ?? assetLimits[0];

  useEffect(() => {
    const node = currentStepRef.current;
    if (!node) return;
    node.scrollIntoView({ block: "nearest", inline: "start" });
  }, [plan.targetUsd]);

  function toggleStepDetails(targetUsd: number) {
    const sameStep = selectedTarget === targetUsd;
    setSelectedTargetOverride(targetUsd);
    setDetailsOpen((open) => (sameStep ? !open : true));
  }

  return (
    <section className={`v2-cap-ladder v2-panel metric-card-beam is-${mode}`}>
      <HudCornerTL /><HudCornerTR /><HudCornerBL /><HudCornerBR />
      <EdgeDots />

      <div className="v2-cap-ladder-head">
        <div>
          <strong>Лестница капитала</strong>
        </div>
      </div>

      <div className="v2-cap-ladder-steps" aria-label="Ступени капитала">
        {steps.map((step) => (
          <button
            key={step.targetUsd}
            ref={step.status === "current" ? currentStepRef : undefined}
            type="button"
            className={`v2-cap-ladder-step is-${step.status}${selectedTarget === step.targetUsd ? " is-selected" : ""}`}
            onClick={() => toggleStepDetails(step.targetUsd)}
            aria-expanded={detailsOpen && selectedTarget === step.targetUsd}
          >
            <div className="v2-cap-ladder-step-head">
              <span>{stepStatusLabel[step.status]}</span>
              <strong>{money.format(step.targetUsd)}</strong>
            </div>
            <div className="v2-cap-ladder-main">
              <div className="v2-cap-ladder-score">
                <strong>{moneyExact.format(step.currentDepositsUsd)}</strong>
                <span>/ {money.format(step.targetUsd)}</span>
              </div>
              <div className="v2-cap-ladder-track" aria-label={`Прогресс до ступени ${step.progressPct}%`}>
                <span style={{ width: `${step.progressPct}%` }} />
              </div>
              <span className="v2-cap-ladder-pct">{step.progressPct}%</span>
            </div>
            <div className="v2-cap-ladder-step-foot">
              <span>{step.remainingUsd > 0 ? "До выполнения" : "Ступень закрыта"}</span>
              <strong>{step.remainingUsd > 0 ? moneyExact.format(step.remainingUsd) : "Готово"}</strong>
            </div>
            <span className="v2-cap-ladder-toggle">
              {detailsOpen && selectedTarget === step.targetUsd ? "Скрыть лимиты" : "Показать лимиты"}
            </span>
          </button>
        ))}
      </div>

      {detailsOpen && (
        <div className="v2-cap-ladder-panel">
          <div className="v2-cap-ladder-panel-head">
            <span>Лимиты ступени {money.format(selectedStep.targetUsd)}</span>
            <strong>{stepStatusLabel[selectedStep.status]}</strong>
          </div>
          <div className="v2-cap-ladder-panel-grid">
            {selectedStep.limits.map((limit) => (
              <div key={limit.label} className="v2-cap-ladder-panel-row">
                <span>{limit.label}</span>
                <strong>{limit.sharePct}% · {money.format(limit.valueUsd)}</strong>
              </div>
            ))}
          </div>
          <div className="v2-cap-ladder-asset">
            <div className="v2-cap-ladder-asset-head">
              <span>Лимит выбранного типа</span>
              <strong>{selectedAssetLimit ? money.format(selectedAssetLimit.valueUsd) : "—"}</strong>
            </div>
            <div className="v2-cap-ladder-asset-buttons">
              {assetLimits.map((limit) => (
                <button
                  key={limit.id}
                  type="button"
                  className={limit.id === selectedAssetLimit?.id ? "is-active" : ""}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedAssetLimitId(limit.id);
                  }}
                >
                  {limit.label}
                </button>
              ))}
            </div>
            {selectedAssetLimit && (
              <p>
                {selectedAssetLimit.shareText}: до {money.format(selectedAssetLimit.valueUsd)}. {selectedAssetLimit.rule}
              </p>
            )}
          </div>
          <div className="v2-cap-ladder-detail">
            <span>Резервный пол {money.format(selectedStep.reserveFloorUsd)}</span>
            <span>Будущая ступень не разрешает сделку</span>
            <span>Покупка всё равно идёт через проверку риска</span>
          </div>
        </div>
      )}
    </section>
  );
}
