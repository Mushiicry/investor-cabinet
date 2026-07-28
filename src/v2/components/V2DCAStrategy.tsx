import { useEffect, useState } from "react";
import { buildFearGreedStrategy } from "../../lib/fearGreedStrategy";
import type { FearGreedMode, FearGreedStrategy, FearGreedStrategyRule } from "../../types/portfolio";
import type { V2Portfolio, V2Page } from "../InvestorCabinetV2Lab";
import type { InvestorStrategy } from "../lib/investorStrategy";

// Открытая подсказка «?» закрывается тапом в любом месте экрана
// (обработчик самого тултипа стоит раньше и через stopPropagation
// перехватывает тап по кнопке — документный слушатель ловит остальное,
// включая тап по карточке с текстом подсказки).
function useCloseOnOutsideTap(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = () => close();
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open, close]);
}

type Props = {
  portfolio: V2Portfolio;
  strategy: FearGreedStrategy;
  investorStrategy?: InvestorStrategy;
  onNavigate?: (page: V2Page) => void;
};

// ── Formatting helpers ─────────────────────────────────────────
function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatCooldown(hours: number) {
  const total = Math.floor(hours * 60);
  const days = Math.floor(total / 1440);
  const hh = String(Math.floor((total % 1440) / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return days > 0 ? `${days}д ${hh}:${mm}` : `${hh}:${mm}`;
}

// ── Mode labels ────────────────────────────────────────────────
const MODE_LABEL: Record<string, string> = {
  observation: "Наблюдаем",
  cautious:    "Покупка на 1%",
  strong:      "Покупка на 1,5%",
  aggressive:  "Покупка на 2%",
};

// ── Hover tooltip content per mode ────────────────────────────
const MODE_TOOLTIP: Record<string, { when: string; action: string; logic: string }> = {
  observation: {
    when:   "Индекс 30–100 — рынок нейтрален или жаден",
    action: "Не покупаем. Держим позиции и резерв.",
    logic:  "Цены на среднем или высоком уровне. Покупка сейчас — переплата. Ждём когда рынок даст скидку.",
  },
  cautious: {
    when:   "Индекс 20–29 — рынок в зоне страха",
    action: "Покупаем 1% от вложенного капитала.",
    logic:  "Рынок испуган, но не капитулировал. Первый осторожный шаг накопления. Размер небольшой — сохраняем резерв для более глубоких уровней.",
  },
  strong: {
    when:   "Индекс 15–19 — сильный страх, давление продавцов",
    action: "Покупаем 1.5% от вложенного капитала.",
    logic:  "Второй уровень стратегии: увеличенный размер. Рынок даёт хорошую скидку — используем её дисциплинированно.",
  },
  aggressive: {
    when:   "Индекс 0–14 — экстремальный страх / капитуляция",
    action: "Покупаем 2% от вложенного капитала.",
    logic:  "Редкий и ценный момент. Рынок в панике, большинство продаёт. Лучшие точки входа для долгосрочного инвестора с резервом.",
  },
};

// ── F&G zone color ─────────────────────────────────────────────
function indexColor(v: number) {
  if (v <= 14) return "#FF5D6C";
  if (v <= 29) return "#E6B33A";
  if (v <= 49) return "#55C7FF";
  return "#5AEF8D";
}

function indexLabel(v: number) {
  if (v <= 14) return "Экстремальный страх";
  if (v <= 29) return "Страх";
  if (v <= 49) return "Нейтрально";
  if (v <= 74) return "Жадность";
  return "Экстремальная жадность";
}

function statusKind(row: FearGreedStrategyRule) {
  if (row.cooldownRemainingHours > 0) return "cooldown";
  if (row.isAvailable) return "available";
  return "passive";
}

function statusLabel(row: FearGreedStrategyRule) {
  if (row.cooldownRemainingHours > 0) return formatCooldown(row.cooldownRemainingHours);
  if (row.isAvailable) return "Доступно";
  return "—";
}

// ── Mode tooltip (hover + tap) ─────────────────────────────────
function ModeTooltip({ mode, color }: { mode: string; color: string }) {
  const [open, setOpen] = useState(false);
  useCloseOnOutsideTap(open, () => setOpen(false));
  const tip = MODE_TOOLTIP[mode];
  if (!tip) return null;

  return (
    <span
      className={`v2-dca-tip-wrap${open ? " is-open" : ""}`}
      onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
    >
      <span className="v2-dca-tip-btn" style={{ color }} aria-label="Объяснение">?</span>
      <div className="v2-dca-tip-card">
        <div className="v2-dca-tip-row">
          <span className="v2-dca-tip-key">Когда</span>
          <span>{tip.when}</span>
        </div>
        <div className="v2-dca-tip-row">
          <span className="v2-dca-tip-key">Действие</span>
          <strong>{tip.action}</strong>
        </div>
        <div className="v2-dca-tip-row">
          <span className="v2-dca-tip-key">Логика</span>
          <span>{tip.logic}</span>
        </div>
      </div>
    </span>
  );
}

// ── DCA abbreviation tooltip ───────────────────────────────────
function DcaTooltip() {
  const [open, setOpen] = useState(false);
  useCloseOnOutsideTap(open, () => setOpen(false));
  return (
    <span
      className={`v2-dca-abbr-wrap${open ? " is-open" : ""}`}
      onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
    >
      <span className="v2-dca-abbr-label">DCA<sup>*</sup></span>
      <div className="v2-dca-abbr-card">
        <strong>DCA — Dollar Cost Averaging</strong>
        <span>Стратегия усреднения стоимости входа.</span>
        <span>Вместо одной крупной покупки — покупаем регулярно, фиксированными суммами. Это снижает среднюю цену входа и убирает угадывание дна.</span>
        <span>В нашей версии: покупаем только когда рынок в страхе — чтобы усредняться на скидках, а не в эйфории.</span>
      </div>
    </span>
  );
}

// ── F&G index tooltip ──────────────────────────────────────────
function FgIndexTooltip({ color }: { color: string }) {
  const [open, setOpen] = useState(false);
  useCloseOnOutsideTap(open, () => setOpen(false));
  return (
    <span
      className={`v2-dca-fg-tip-wrap${open ? " is-open" : ""}`}
      onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
    >
      <span className="v2-dca-fg-tip-btn" style={{ borderColor: color + "60", color }} aria-label="Что такое индекс">?</span>
      <div className="v2-dca-fg-tip-card">
        <strong>Индекс страха и жадности</strong>
        <p>Шкала от 0 до 100, отражающая общие эмоции крипторынка.</p>
        <div className="v2-dca-fg-tip-scale">
          <span style={{ color: "#FF5D6C" }}>0–14 Экстремальный страх</span>
          <span style={{ color: "#E6B33A" }}>15–29 Страх</span>
          <span style={{ color: "#55C7FF" }}>30–49 Нейтрально</span>
          <span style={{ color: "#5AEF8D" }}>50–100 Жадность</span>
        </div>
        <p>Считается по: волатильности, объёму торгов, активности в соцсетях, доминированию Bitcoin и поисковым трендам.</p>
        <p>Зачем смотрим: лучшие точки входа — когда рынок в панике. Покупать в жадность — значит переплачивать.</p>
      </div>
    </span>
  );
}

// ── Dot color per mode ─────────────────────────────────────────
function modeColor(mode: FearGreedMode | string): string {
  if (mode === "observation") return "rgba(130,170,190,0.55)";
  if (mode === "cautious")    return "#E6B33A";
  if (mode === "strong")      return "#FF8C42";
  if (mode === "aggressive")  return "#FF5D6C";
  return "#56d8f5";
}

// ── Main component ─────────────────────────────────────────────
export function V2DCAStrategy({ portfolio, strategy, onNavigate }: Props) {
  const idx = strategy.currentIndex;
  const idxColor = indexColor(idx);

  const invested = portfolio.totalInvested || strategy.portfolioValue || 0;
  const active = buildFearGreedStrategy(idx, invested, strategy.rules ?? []);

  return (
    <section className="v2-panel v2-dca-panel">
      <span aria-hidden="true" className="v2-hud-corners" />

      {/* ── Шапка ── */}
      <div className="v2-dca-header">
        <div className="v2-dca-title-block">
          <span className="v2-dca-kicker">
            СТРАТЕГИЯ <DcaTooltip />
          </span>
          <h3 className="v2-dca-title">По индексу страха и жадности</h3>
          <div className="v2-dca-desc-lines">
            <span>Покупаем только в зоне страха — раз в неделю.</span>
            <span>Фиксированный размер от капитала.</span>
            <span>Никакой жадной торговли.</span>
          </div>
        </div>
        <div className="v2-dca-index-now">
          {/* Голое число не отвечало на вопрос «26 — это из чего?».
              База шкалы должна стоять рядом с оценкой. */}
          <span className="v2-dca-index-val" style={{ color: idxColor }}>
            {idx}
            <span className="v2-dca-index-scale">/ 100</span>
          </span>
          <div className="v2-dca-index-label-row">
            <span className="v2-dca-index-label" style={{ color: idxColor }}>{indexLabel(idx)}</span>
            <FgIndexTooltip color={idxColor} />
          </div>
        </div>
      </div>

      {/* ── Зоны — карточный вид ── */}
      <div className="v2-dca-zones">
        {active.rules.map(row => {
          const color = modeColor(row.mode);
          const kind = statusKind(row);

          return (
            <div key={row.mode} className={[
              "v2-dca-zone",
              `mode-${row.mode}`,
              row.isCurrent ? "is-current" : "",
              kind === "available" ? "is-available" : "",
              kind === "cooldown" ? "is-cooldown" : "",
            ].filter(Boolean).join(" ")}>

              <span className="v2-dca-zone-bar" style={{ background: color }} />
              <div className="v2-dca-zone-info">
                <div className="v2-dca-zone-title">
                  {MODE_LABEL[row.mode] ?? row.mode}
                  <ModeTooltip mode={row.mode} color={color} />
                </div>
                <div className="v2-dca-zone-range">{row.range}</div>
              </div>

              <div className="v2-dca-zone-right">
                {row.mode !== "observation" && (
                  <span className="v2-dca-zone-amount">{formatMoney(row.buyAmount)}</span>
                )}
                {kind === "available" ? (
                  <a
                    href="https://app.uniswap.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="v2-dca-zone-status is-available"
                  >
                    Доступно
                  </a>
                ) : kind === "cooldown" ? (
                  <span className="v2-dca-zone-status is-cooldown">
                    <svg className="v2-cd-spin" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.6"
                        strokeDasharray="16 10" strokeLinecap="round" />
                    </svg>
                    {statusLabel(row)}
                  </span>
                ) : row.mode !== "observation" ? (
                  <span className="v2-dca-zone-status is-passive">{statusLabel(row)}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Ссылка на историю ── */}
      <div className="v2-dca-footer">
        <button
          className="v2-dca-history-btn"
          type="button"
          onClick={() => onNavigate?.("reports")}
        >
          История покупок
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 2l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}
