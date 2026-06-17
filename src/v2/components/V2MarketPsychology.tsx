import { useFearGreed } from "../../hooks/useFearGreed";

const CURRENT_PHASE = 8;

const PHASES = [
  { n: 1,  label: "Отрицание",    sub: "это не падение",    x: 16,  y: 92,  zone: "recovery" },
  { n: 2,  label: "Надежда",      sub: "отскок возможен",   x: 52,  y: 60,  zone: "recovery" },
  { n: 3,  label: "Оптимизм",     sub: "рынок оживает",     x: 92,  y: 28,  zone: "rise" },
  { n: 4,  label: "Вера",         sub: "можно набирать",    x: 136, y: 10,  zone: "rise" },
  { n: 5,  label: "Возбуждение",  sub: "все покупают",      x: 172, y: 6,   zone: "rise" },
  { n: 6,  label: "Эйфория",      sub: "мы гении",          x: 204, y: 7,   zone: "peak" },
  { n: 7,  label: "Уступчивость", sub: "подождём",          x: 244, y: 22,  zone: "decline" },
  { n: 8,  label: "Тревога",      sub: "что-то не так",     x: 278, y: 54,  zone: "fear" },
  { n: 9,  label: "Отрицание",    sub: "не может быть",     x: 310, y: 88,  zone: "fear" },
  { n: 10, label: "Паника",       sub: "все продают",       x: 336, y: 116, zone: "panic" },
  { n: 11, label: "Капитуляция",  sub: "продаю всё",        x: 358, y: 132, zone: "panic" },
  { n: 12, label: "Гнев",         sub: "кто виноват",       x: 394, y: 128, zone: "recovery" },
  { n: 13, label: "Депрессия",    sub: "рынок умер",        x: 432, y: 116, zone: "recovery" },
  { n: 14, label: "Новая надежда",sub: "возможен разворот", x: 472, y: 106, zone: "new" },
];

const BUYING_WINDOW = { from: "10 окт 2026", to: "15 дек 2026", daysUntil: 115 };

const ACTIONS = [
  { icon: "⊘", text: "Не действуем эмоциями" },
  { icon: "◈", text: "Сохраняем резерв" },
  { icon: "◎", text: "Ждём подтверждений" },
];

function dotColor(zone: string, isCurrent: boolean) {
  if (isCurrent) return "rgba(245,158,11,0.95)";
  const map: Record<string, string> = {
    recovery: "rgba(86,196,240,0.45)",
    rise:     "rgba(52,211,153,0.45)",
    peak:     "rgba(52,211,153,0.65)",
    decline:  "rgba(245,158,11,0.45)",
    fear:     "rgba(245,158,11,0.5)",
    panic:    "rgba(248,113,113,0.5)",
    new:      "rgba(86,196,240,0.5)",
  };
  return map[zone] ?? "rgba(141,167,181,0.35)";
}

export function V2MarketPsychology() {
  const fearGreed = useFearGreed();
  const fgValue = fearGreed.isLoading ? "…" : String(fearGreed.data.value);
  const fgLabel = fearGreed.data.label;

  const WHY = [
    "Цена ниже от пика ~42%",
    `Индекс страха: ${fgValue} (${fgLabel})`,
    "Отскоки слабые, структура не сломана",
    "Капитуляции ещё не было",
  ];

  const cur = PHASES[CURRENT_PHASE - 1];

  return (
    <div className="v2-mp-card">
      {/* Header */}
      <div className="v2-mp-hdr">
        <div className="v2-mp-hdr-left">
          <span className="v2-mp-eyebrow">Market Psychology</span>
          <span className="v2-mp-title-text">Эмоциональный цикл рынка</span>
        </div>
        <div className="v2-mp-hdr-right">
          <div className="v2-mp-phase-badge">
            <span className="v2-mp-phase-n">{CURRENT_PHASE}</span>
            <span className="v2-mp-phase-name">{cur.label.toUpperCase()}</span>
            <span className="v2-mp-phase-sub">{cur.sub}</span>
          </div>
          <div className="v2-mp-win-chip">
            <span className="v2-mp-win-label">Окно покупок через</span>
            <span className="v2-mp-win-days">{BUYING_WINDOW.daysUntil} дн.</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="v2-mp-body">

        {/* Curve */}
        <div className="v2-mp-curve-col">
          <svg
            className="v2-mp-svg"
            viewBox="0 0 492 148"
            preserveAspectRatio="xMidYMid meet"
            aria-label="Эмоциональный цикл рынка"
          >
            <defs>
              <filter id="mp-glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Grid lines subtle */}
            <line x1="16" y1="138" x2="475" y2="138" stroke="rgba(86,196,240,0.07)" strokeWidth="1" />

            {/* Curve base */}
            <path
              d="M 16 92 C 75 8 145 2 204 7 C 268 14 315 104 358 132 C 398 136 448 118 475 106"
              fill="none"
              stroke="rgba(86,196,240,0.12)"
              strokeWidth="1.8"
            />
            {/* Curve glow (thicker, more transparent) */}
            <path
              d="M 16 92 C 75 8 145 2 204 7 C 268 14 315 104 358 132 C 398 136 448 118 475 106"
              fill="none"
              stroke="rgba(86,196,240,0.06)"
              strokeWidth="5"
            />

            {/* Phase dots + numbers */}
            {PHASES.map((p) => {
              const isCurrent = p.n === CURRENT_PHASE;
              const aboveCurve = p.n <= 6 || (p.n >= 12);
              return (
                <g key={p.n}>
                  {isCurrent && (
                    <>
                      <circle cx={p.x} cy={p.y} r="13" fill="rgba(245,158,11,0.06)" />
                      <circle cx={p.x} cy={p.y} r="8" fill="rgba(245,158,11,0.1)" />
                    </>
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isCurrent ? 4.5 : 2.5}
                    fill={dotColor(p.zone, isCurrent)}
                    className={isCurrent ? "v2-mp-cur-dot" : ""}
                  />
                  {/* Phase number */}
                  <text
                    x={p.x}
                    y={aboveCurve ? p.y - 8 : p.y + 13}
                    textAnchor="middle"
                    fontSize="7"
                    fill={isCurrent ? "rgba(245,158,11,0.9)" : "rgba(141,167,181,0.4)"}
                    fontFamily="Inter,sans-serif"
                    fontWeight={isCurrent ? "700" : "400"}
                  >
                    {p.n}
                  </text>
                </g>
              );
            })}

            {/* Current phase callout */}
            <text
              x={cur.x + 9}
              y={cur.y - 11}
              fontSize="8"
              fill="rgba(245,158,11,0.85)"
              fontFamily="Inter,sans-serif"
              fontWeight="600"
            >
              ← {cur.label}
            </text>

            {/* Timeline labels */}
            {([
              [38,  "Страх"],
              [108, "Рост"],
              [204, "Эйфория"],
              [322, "Спад"],
              [426, "Возрождение"],
            ] as [number, string][]).map(([x, t]) => (
              <text key={t} x={x} y="147" textAnchor="middle" fontSize="7"
                fill="rgba(141,167,181,0.28)" fontFamily="Inter,sans-serif"
                letterSpacing="0.04em">
                {t.toUpperCase()}
              </text>
            ))}
          </svg>
        </div>

        {/* Why bullets */}
        <div className="v2-mp-why-col">
          <div className="v2-mp-panel-label">Почему так?</div>
          <ul className="v2-mp-bullets">
            {WHY.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>

        {/* Actions + window */}
        <div className="v2-mp-actions-col">
          <div className="v2-mp-panel-label">Зона действий</div>
          {ACTIONS.map((a, i) => (
            <div key={i} className="v2-mp-action">
              <span className="v2-mp-action-icon">{a.icon}</span>
              <span className="v2-mp-action-text">{a.text}</span>
            </div>
          ))}
          <div className="v2-mp-win-block">
            <div className="v2-mp-win-block-label">Окно агрессивных покупок</div>
            <div className="v2-mp-win-dates">{BUYING_WINDOW.from} — {BUYING_WINDOW.to}</div>
            <div className="v2-mp-win-pill">До окна {BUYING_WINDOW.daysUntil} дн.</div>
          </div>
        </div>

      </div>
    </div>
  );
}
