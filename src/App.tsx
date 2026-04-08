import React, { useMemo, useState } from "react";

const currency = (n: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 1,
  }).format(Number(n || 0));

const percent = (n: number) => `${(Number(n || 0) * 100).toFixed(1)}%`;
const percentDirect = (n: number) => `${Number(n || 0).toFixed(1)}%`;

type Page = "Обзор" | "Портфель" | "Риск" | "Решения" | "Сценарии" | "Вход";

type ApiOverview = {
  portfolioValue: number;
  invested: number;
  pnl: number;
  pnlPct: number;
  reserve: number;
  positionsCount: number;
  health: number;
  state: string;
  signal: string;
  action: string;
  topPositions: Array<{
    asset: string;
    share: number;
    value: number;
    status: string;
  }>;
  categories: Array<{
    name: string;
    value: number;
    share: number;
  }>;
};

type ApiPosition = {
  asset: string;
  category: string;
  quantity: number;
  avgEntry: number;
  invested: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  share: number;
  status: string;
};

type ApiRisk = {
  portfolioValue: number;
  reserve: number;
  reserveShare: number;
  deployableCash: number;
  largestRiskAsset: string;
  largestRiskShare: number;
  cryptoShare: number;
  stocksShare: number;
  metalsShare: number;
  futuresShare: number;
  cashShare: number;
  health: number;
  state: string;
  signal: string;
  summary: string;
};

type ApiDecision = {
  asset: string;
  thesis: string;
  whyHold: string;
  expect: string;
  nextAction: string;
  reviewTrigger: string;
  status: string;
};

type ApiResponse = {
  overview: ApiOverview;
  portfolio: ApiPosition[];
  risk: ApiRisk;
  decisions: ApiDecision[];
  updatedAt: string;
};

type ScenarioCard = {
  asset: string;
  base: string;
  bull: string;
  bear: string;
  action: string;
  invalidation: string;
  status: string;
};

const demoData: ApiResponse = {
  overview: {
    portfolioValue: 438.9,
    invested: 431.0,
    pnl: 7.9,
    pnlPct: 0.0183,
    reserve: 244.8,
    positionsCount: 11,
    health: 0.88,
    state: "Контроль",
    signal: "Резерв высокий. Можно добирать ядро и держать спекулятивный лимит на фьючерсы.",
    action: "В работу по стратегии можно пустить около $112.0 без поломки структуры портфеля.",
    topPositions: [
      { asset: "USDT", share: 0.5578, value: 244.8, status: "Резерв" },
      { asset: "ETH", share: 0.1269, value: 55.7, status: "Ядро" },
      { asset: "BTC SHORT", share: 0.067, value: 29.4, status: "Спекуляция" },
    ],
    categories: [
      { name: "Крипта", value: 148.9, share: 0.3393 },
      { name: "Металлы", value: 15.8, share: 0.036 },
      { name: "Фьючерсы", value: 29.4, share: 0.067 },
      { name: "Акции", value: 0, share: 0 },
      { name: "Свободные деньги", value: 244.8, share: 0.5578 },
    ],
  },
  portfolio: [
    { asset: "BTC", category: "Крипта", quantity: 0.0004367, avgEntry: 68200, invested: 29.8, currentPrice: 69759.6, currentValue: 30.4, pnl: 0.6, pnlPct: 2.2, share: 6.9, status: "Накапливать" },
    { asset: "ETH", category: "Крипта", quantity: 0.0258, avgEntry: 1921, invested: 49.6, currentPrice: 2156, currentValue: 55.7, pnl: 6.1, pnlPct: 12.2, share: 12.7, status: "Накапливать" },
    { asset: "TON", category: "Крипта", quantity: 11.63, avgEntry: 1.33, invested: 15.5, currentPrice: 1.27, currentValue: 14.8, pnl: -0.7, pnlPct: -4.5, share: 3.4, status: "Наблюдать" },
    { asset: "SOL", category: "Крипта", quantity: 0.1694, avgEntry: 90, invested: 15.2, currentPrice: 82.56, currentValue: 14.0, pnl: -1.2, pnlPct: -8.2, share: 3.2, status: "Накапливать" },
    { asset: "BNB", category: "Крипта", quantity: 0.0166, avgEntry: 594, invested: 9.8, currentPrice: 606.76, currentValue: 10.1, pnl: 0.3, pnlPct: 2.4, share: 2.3, status: "Наблюдать" },
    { asset: "TIA", category: "Крипта", quantity: 24.6, avgEntry: 0.32, invested: 7.9, currentPrice: 0.3, currentValue: 7.4, pnl: -0.5, pnlPct: -6.5, share: 1.7, status: "Наблюдать" },
    { asset: "APEX", category: "Крипта", quantity: 26.1, avgEntry: 0.29, invested: 7.6, currentPrice: 0.27, currentValue: 7.1, pnl: -0.5, pnlPct: -6.9, share: 1.6, status: "Наблюдать" },
    { asset: "MNT", category: "Крипта", quantity: 14.5, avgEntry: 0.55, invested: 7.9, currentPrice: 0.68, currentValue: 9.4, pnl: 1.5, pnlPct: 18.9, share: 2.1, status: "Наблюдать" },
    { asset: "GOLD LONG", category: "Металлы", quantity: 0.0032, avgEntry: 4376.7, invested: 14.9, currentPrice: 4937.5, currentValue: 15.8, pnl: 0.9, pnlPct: 6.0, share: 3.6, status: "Хедж" },
    { asset: "BTC SHORT", category: "Фьючерсы", quantity: 0.00041, avgEntry: 71018, invested: 27.4, currentPrice: 66922, currentValue: 29.4, pnl: 2.0, pnlPct: 7.3, share: 6.7, status: "Спекуляция" },
    { asset: "USDT", category: "Свободные деньги", quantity: 244.8, avgEntry: 1, invested: 244.8, currentPrice: 1, currentValue: 244.8, pnl: 0, pnlPct: 0, share: 55.8, status: "Держать" },
  ],
  risk: {
    portfolioValue: 438.9,
    reserve: 244.8,
    reserveShare: 0.5578,
    deployableCash: 112.0,
    largestRiskAsset: "ETH",
    largestRiskShare: 0.1269,
    cryptoShare: 0.3393,
    stocksShare: 0,
    metalsShare: 0.036,
    futuresShare: 0.067,
    cashShare: 0.5578,
    health: 0.88,
    state: "Контроль",
    signal: "Структура сильная. Можно добирать ядро, но не раздувать спекулятивный блок.",
    summary: "Портфель защитный. Кэш высокий. Риск под контролем, но рост можно усиливать ступенчато.",
  },
  decisions: [
    { asset: "BTC", thesis: "Базовый актив цикла.", whyHold: "Фундамент ядра портфеля.", expect: "Плавное продолжение роста с коррекциями.", nextAction: "Добирать на слабости.", reviewTrigger: "Слом глобальной структуры.", status: "Держать" },
    { asset: "ETH", thesis: "Главный рисковый актив ядра.", whyHold: "Ликвидность, экосистема, сила к рынку.", expect: "Может идти сильнее части альтов.", nextAction: "Приоритетный добор.", reviewTrigger: "Ухудшение силы против BTC.", status: "Накапливать" },
    { asset: "TON", thesis: "Спекулятивный средний риск.", whyHold: "Есть история повторных всплесков.", expect: "Движение рывками, не линейно.", nextAction: "Только точечные покупки.", reviewTrigger: "Долгая стагнация без спроса.", status: "Наблюдать" },
    { asset: "SOL", thesis: "Актив с потенциалом импульса.", whyHold: "Высокая бета к рынку.", expect: "Резкие движения вверх и вниз.", nextAction: "Добирать при страхе.", reviewTrigger: "Потеря импульса к сектору.", status: "Накапливать" },
    { asset: "BNB", thesis: "Умеренно сильный актив.", whyHold: "Сильная платформа и ликвидность.", expect: "Стабильнее многих альтов.", nextAction: "Без агрессии, держать.", reviewTrigger: "Ослабление экосистемы.", status: "Наблюдать" },
    { asset: "TIA", thesis: "Небольшая ставка на апсайд.", whyHold: "Риск контролируем за счёт размера.", expect: "Либо резкий рост, либо долгий боковик.", nextAction: "Не усреднять без сигнала.", reviewTrigger: "Полная потеря интереса рынка.", status: "Наблюдать" },
    { asset: "APEX", thesis: "Малый спекулятивный блок.", whyHold: "Допуск на апсайд при ограниченном риске.", expect: "Высокая волатильность.", nextAction: "Без добора пока.", reviewTrigger: "Ломка идеи по ликвидности.", status: "Наблюдать" },
    { asset: "MNT", thesis: "Пока сильнее части малых позиций.", whyHold: "Есть локальная сила.", expect: "Может продолжить рост раньше остальных.", nextAction: "Держать и наблюдать.", reviewTrigger: "Потеря локального импульса.", status: "Наблюдать" },
    { asset: "GOLD LONG", thesis: "Защитный хедж.", whyHold: "Снижает чистую зависимость от крипты.", expect: "Спокойное движение без взрывной доходности.", nextAction: "Не раздувать, держать как страховку.", reviewTrigger: "Изменение общей защитной логики портфеля.", status: "Хедж" },
    { asset: "BTC SHORT", thesis: "Спекуляция против локального перегрева.", whyHold: "Отдельный тактический сценарий.", expect: "Быстрые движения. Нужен жёсткий контроль.", nextAction: "Частично фиксировать на движении.", reviewTrigger: "Импульс вверх против позиции.", status: "Спекуляция" },
    { asset: "USDT", thesis: "Резерв для действий.", whyHold: "Даёт манёвренность и контроль риска.", expect: "Снижает давление на портфель.", nextAction: "Часть вводить только по плану.", reviewTrigger: "Изменение рыночного режима.", status: "Резерв" },
  ],
  updatedAt: new Date().toISOString(),
};

const scenarios: ScenarioCard[] = [
  { asset: "BTC", base: "Базовый рост с паузами.", bull: "Сильный импульс продолжения.", bear: "Глубокая коррекция с шансом на добор.", action: "Не гнаться, работать от слабости.", invalidation: "Ломка старшего тренда.", status: "Активен" },
  { asset: "ETH", base: "Опережает часть рынка.", bull: "Делает рывок сильнее BTC.", bear: "Просадка вместе с альтами.", action: "Добор раньше вторичных альтов.", invalidation: "Потеря силы против BTC.", status: "Активен" },
  { asset: "TON", base: "Боковик с локальными вспышками.", bull: "Резкое ускорение на внимании.", bear: "Сползание без спроса.", action: "Покупки только в зонах страха.", invalidation: "Пропажа интереса.", status: "Наблюдение" },
  { asset: "SOL", base: "Высокая волатильность в растущем рынке.", bull: "Резкий ускоряющий импульс.", bear: "Сильная просадка глубже ядра.", action: "Покупать только ступенчато.", invalidation: "Потеря секторальной силы.", status: "Активен" },
  { asset: "BNB", base: "Спокойнее большинства альтов.", bull: "Умеренный рост без перегрева.", bear: "Боковик и отставание.", action: "Держать без агрессивных доборов.", invalidation: "Снижение силы экосистемы.", status: "Наблюдение" },
  { asset: "TIA", base: "Слабый/средний боковик.", bull: "Резкий импульс на хайпе.", bear: "Уход в длинную стагнацию.", action: "Не перегружать размер позиции.", invalidation: "Полный спад спроса.", status: "Наблюдение" },
  { asset: "APEX", base: "Чистая спекулятивная ставка.", bull: "Выстрел на ликвидности.", bear: "Медленное затухание.", action: "Без добавления до сигнала.", invalidation: "Проблемы с ликвидностью.", status: "Наблюдение" },
  { asset: "MNT", base: "Локальное удержание силы.", bull: "Продолжение роста раньше части рынка.", bear: "Откат к средним.", action: "Фиксировать частями на всплесках.", invalidation: "Слом импульса.", status: "Активен" },
  { asset: "GOLD LONG", base: "Спокойный защитный тренд.", bull: "Рост на защитном спросе.", bear: "Стоит на месте при risk-on (аппетит к риску).", action: "Держать как хедж.", invalidation: "Меняется логика защиты.", status: "Хедж" },
  { asset: "BTC SHORT", base: "Тактический шорт на локальном перегреве.", bull: "Позиция даёт быстрый профит на снижении.", bear: "Рынок выносит вверх.", action: "Фиксировать частями и держать риск маленьким.", invalidation: "Сильный ап-импульс против позиции.", status: "Спекуляция" },
  { asset: "USDT", base: "Резерв и гибкость.", bull: "Даёт возможность купить страх.", bear: "Снижает общую доходность при сильном росте рынка.", action: "Вводить в рынок частями.", invalidation: "Смена режима рынка на устойчивый рост.", status: "Резерв" },
];

const TEST_LOGIN = "mushi";
const TEST_PASSWORD = "invest2026";

function Badge({
  children,
  tone = "cyan",
}: {
  children: React.ReactNode;
  tone?: "cyan" | "violet" | "yellow";
}) {
  const map = {
    cyan: "cyber-badge-cyan",
    violet: "cyber-badge-violet",
    yellow: "cyber-badge-yellow",
  };

  return <span className={`cyber-badge ${map[tone]}`}>{children}</span>;
}

function Panel({
  children,
  tone = "cyan",
  className = "",
  hover = false,
}: {
  children: React.ReactNode;
  tone?: "cyan" | "violet" | "yellow";
  className?: string;
  hover?: boolean;
}) {
  const map = {
    cyan: "cyber-panel-cyan",
    violet: "cyber-panel-violet",
    yellow: "cyber-panel-yellow",
  };

  return <div className={`cyber-panel ${map[tone]} ${hover ? "cyber-hover-panel" : ""} ${className}`}>{children}</div>;
}

function Sidebar({
  page,
  setPage,
}: {
  page: Page;
  setPage: (p: Page) => void;
}) {
  const items: Page[] = ["Обзор", "Портфель", "Риск", "Решения", "Сценарии", "Вход"];

  return (
    <aside className="w-full lg:w-72 shrink-0">
      <Panel tone="violet" className="p-4 lg:sticky lg:top-6" hover>
        <div className="px-3 py-3 mb-4 float-slow">
          <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">MVP</div>
          <div className="text-[34px] leading-none font-black mt-4 text-white">Кабинет</div>
          <div className="text-[34px] leading-none font-black text-white/90">инвестора</div>
        </div>

        <nav className="space-y-2">
          {items.map((item, idx) => {
            const active = page === item;
            return (
              <button
                key={item}
                onClick={() => setPage(item)}
                className={`cyber-nav-btn ${active ? "cyber-nav-btn-active" : ""}`}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {item}
              </button>
            );
          })}
        </nav>
      </Panel>
    </aside>
  );
}

function MetricCard({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: string;
  tone?: "cyan" | "violet" | "yellow";
}) {
  return (
    <Panel tone={tone} className="p-5 min-h-[120px] flex flex-col justify-between metric-3d fade-in-up" hover>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </Panel>
  );
}

function DonutChart({ categories }: { categories: ApiOverview["categories"] }) {
  const total = categories.reduce((sum, item) => sum + Number(item.value || 0), 0);
  let current = 0;
  const colors = ["#5bd6ff", "#ffd84d", "#a855f7", "#22c55e", "#94a3b8"];

  const segments = categories
    .filter((item) => Number(item.value || 0) > 0)
    .map((item, idx) => {
      const fraction = total ? Number(item.value || 0) / total : 0;
      const start = current;
      current += fraction;

      return {
        ...item,
        color: colors[idx % colors.length],
        dashArray: `${fraction * 282.74} 282.74`,
        dashOffset: -start * 282.74,
      };
    });

  return (
    <Panel tone="yellow" className="p-6 section-3d fade-in-up" hover>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <div className="section-kicker text-yellow-300">Allocation (распределение)</div>
          <div className="section-title">Распределение средств</div>
        </div>
        <Badge tone="yellow">live view</Badge>
      </div>

      <div className="grid xl:grid-cols-[300px_1fr] gap-8 items-center">
        <div className="relative w-[280px] h-[280px] mx-auto float-slow">
          <div className="donut-halo" />
          <div className="donut-shell">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90 relative z-10">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#091122" strokeWidth="12" />
              {segments.map((segment) => (
                <circle
                  key={segment.name}
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={segment.dashArray}
                  strokeDashoffset={segment.dashOffset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-20">
              <div className="text-[12px] uppercase tracking-[0.18em] text-slate-400">Всего</div>
              <div className="text-[44px] font-black tracking-[-0.04em] text-white leading-none">
                {currency(total)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {categories.map((segment, idx) => {
            const color = colors[idx % colors.length];
            return (
              <div
                key={segment.name}
                className="allocation-card fade-in-up cyber-hover-panel"
                style={{
                  border: `1px solid ${color}33`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 34px rgba(0,0,0,0.34), 0 0 20px ${color}14`,
                  animationDelay: `${idx * 50}ms`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full pulse-soft"
                      style={{
                        backgroundColor: color,
                        boxShadow: `0 0 14px ${color}`,
                      }}
                    />
                    <div>
                      <div className="text-[18px] font-semibold text-white">{segment.name}</div>
                      <div className="text-[13px] text-slate-500">{currency(segment.value)}</div>
                    </div>
                  </div>
                  <div className="text-[22px] font-black tracking-[-0.03em] text-white">
                    {percent(segment.share)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function OverviewPage({
  overview,
  portfolio,
  risk,
}: {
  overview: ApiOverview;
  portfolio: ApiPosition[];
  risk: ApiRisk;
}) {
  const workPositions = portfolio.filter((item) => item.category !== "Свободные деньги");
  const bestPosition = [...workPositions].sort((a, b) => Number(b.pnl) - Number(a.pnl))[0];
  const worstPosition = [...workPositions].sort((a, b) => Number(a.pnl) - Number(b.pnl))[0];

  return (
    <div className="space-y-6">
      <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Сколько вложил" value={currency(overview.invested)} tone="cyan" />
        <MetricCard label="Портфель сейчас" value={currency(overview.portfolioValue)} tone="violet" />
        <MetricCard label="PnL в долларах" value={currency(overview.pnl)} tone="yellow" />
        <MetricCard label="PnL в процентах" value={percent(overview.pnlPct)} tone="cyan" />
      </section>

      <section className="grid xl:grid-cols-12 gap-6">
        <Panel tone="cyan" className="xl:col-span-8 p-6 section-3d fade-in-up" hover>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div className="float-soft">
              <div className="section-kicker text-cyan-300">Health (здоровье)</div>
              <div className="health-number">{percent(overview.health)}</div>
            </div>
            <Badge tone="cyan">{overview.state}</Badge>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            <div className="mini-panel mini-panel-cyan cyber-hover-panel fade-in-up">
              <div className="mini-label">Лучшая позиция</div>
              <div className="mini-title">{bestPosition?.asset ?? "-"}</div>
              <div className="mini-value">{bestPosition ? currency(bestPosition.pnl) : "-"}</div>
              <div className="mini-pct text-cyan-300">
                {bestPosition ? percentDirect(bestPosition.pnlPct) : "-"}
              </div>
            </div>

            <div className="mini-panel mini-panel-yellow cyber-hover-panel fade-in-up" style={{ animationDelay: "60ms" }}>
              <div className="mini-label">Худшая позиция</div>
              <div className="mini-title">{worstPosition?.asset ?? "-"}</div>
              <div className="mini-value">{worstPosition ? currency(worstPosition.pnl) : "-"}</div>
              <div className="mini-pct text-yellow-300">
                {worstPosition ? percentDirect(worstPosition.pnlPct) : "-"}
              </div>
            </div>

            <div className="mini-panel mini-panel-violet cyber-hover-panel fade-in-up" style={{ animationDelay: "120ms" }}>
              <div className="mini-label">Можно пустить в работу</div>
              <div className="mini-title">{currency(risk.deployableCash)}</div>
              <div className="mini-value text-slate-500">По стратегии прямо сейчас</div>
            </div>

            <div className="mini-panel mini-panel-cyan cyber-hover-panel fade-in-up" style={{ animationDelay: "180ms" }}>
              <div className="mini-label">Свободные деньги</div>
              <div className="mini-title">{currency(overview.reserve)}</div>
              <div className="mini-value text-slate-500">Резерв для действий</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="big-note big-note-violet cyber-hover-panel fade-in-up">
              <div className="big-note-label">Короткая подсказка</div>
              <div className="big-note-text">{overview.signal}</div>
            </div>
            <div className="big-note big-note-cyan cyber-hover-panel fade-in-up" style={{ animationDelay: "80ms" }}>
              <div className="big-note-label">Действие</div>
              <div className="big-note-text">{overview.action}</div>
            </div>
          </div>
        </Panel>

        <div className="xl:col-span-4 space-y-4">
          {overview.topPositions.map((p, idx) => (
            <Panel
              key={`${p.asset}-${idx}`}
              tone={idx === 0 ? "violet" : idx === 1 ? "cyan" : "yellow"}
              className="p-5 top-card-3d fade-in-up"
              hover
            >
              <div className="top-card-kicker">Топ позиция {idx + 1}</div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="top-card-title">{p.asset}</div>
                  <div className="top-card-status">{p.status}</div>
                </div>
                <Badge tone={idx === 0 ? "violet" : idx === 1 ? "cyan" : "yellow"}>
                  {percent(p.share)}
                </Badge>
              </div>
              <div className="top-card-value">{currency(p.value)}</div>
            </Panel>
          ))}
        </div>
      </section>

      <DonutChart categories={overview.categories} />
    </div>
  );
}

function PortfolioPage({ positions }: { positions: ApiPosition[] }) {
  const [categoryFilter, setCategoryFilter] = useState("Все");
  const [sortBy, setSortBy] = useState<"share" | "pnl" | "value">("share");

  const categories = useMemo(() => {
    const unique = Array.from(new Set(positions.map((p) => p.category).filter(Boolean)));
    return ["Все", ...unique];
  }, [positions]);

  const filtered = useMemo(() => {
    const base = positions.filter((p) => categoryFilter === "Все" || p.category === categoryFilter);
    return [...base].sort((a, b) => {
      if (sortBy === "share") return Number(b.share) - Number(a.share);
      if (sortBy === "pnl") return Number(b.pnl) - Number(a.pnl);
      return Number(b.currentValue) - Number(a.currentValue);
    });
  }, [categoryFilter, sortBy, positions]);

  return (
    <Panel tone="cyan" className="p-6 section-3d fade-in-up" hover>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
        <div>
          <div className="section-kicker text-cyan-300">Portfolio (портфель)</div>
          <div className="section-title">Портфель</div>
          <p className="text-slate-400 mt-1">Основной рабочий экран по всем позициям.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="cyber-select"
          >
            {categories.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "share" | "pnl" | "value")}
            className="cyber-select"
          >
            <option value="share">Сортировка по доле</option>
            <option value="pnl">Сортировка по PnL</option>
            <option value="value">Сортировка по стоимости</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full cyber-table">
          <thead>
            <tr>
              <th>Актив</th>
              <th>Категория</th>
              <th>Вложено</th>
              <th>Средняя цена входа</th>
              <th>Текущая цена</th>
              <th>Текущая стоимость</th>
              <th>PnL $</th>
              <th>PnL %</th>
              <th>Доля %</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, idx) => (
              <tr key={p.asset} className="fade-in-up" style={{ animationDelay: `${idx * 35}ms` }}>
                <td className="font-semibold text-white">{p.asset}</td>
                <td>{p.category}</td>
                <td>{currency(p.invested)}</td>
                <td>{currency(p.avgEntry)}</td>
                <td>{currency(p.currentPrice)}</td>
                <td>{currency(p.currentValue)}</td>
                <td>{currency(p.pnl)}</td>
                <td>{percentDirect(p.pnlPct)}</td>
                <td>{percentDirect(p.share)}</td>
                <td>
                  <Badge
                    tone={
                      p.status === "Спекуляция"
                        ? "yellow"
                        : p.status === "Хедж"
                        ? "violet"
                        : "cyan"
                    }
                  >
                    {p.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function RiskPage({ risk }: { risk: ApiRisk }) {
  const blocks = [
    ["Стоимость портфеля", currency(risk.portfolioValue), "cyan"],
    ["Резерв", currency(risk.reserve), "violet"],
    ["Свободный кэш для добора", currency(risk.deployableCash), "yellow"],
    ["Крупнейший рисковый актив", `${risk.largestRiskAsset} - ${percent(risk.largestRiskShare)}`, "yellow"],
  ] as const;

  return (
    <div className="space-y-6">
      <Panel tone="violet" className="p-6 section-3d fade-in-up" hover>
        <div className="grid lg:grid-cols-4 gap-4 items-start">
          <div className="cyber-health-card float-soft">
            <div className="section-kicker text-yellow-300">Risk health</div>
            <div className="text-[70px] font-black tracking-[-0.05em] mt-2 text-white leading-none">
              {percent(risk.health)}
            </div>
            <div className="mt-4">
              <Badge tone="yellow">{risk.state}</Badge>
            </div>
          </div>

          <div className="lg:col-span-3 grid md:grid-cols-2 gap-4">
            <div className="big-note big-note-cyan cyber-hover-panel fade-in-up">
              <div className="big-note-label">Главный сигнал</div>
              <div className="big-note-text">{risk.signal}</div>
            </div>
            <div className="big-note big-note-violet cyber-hover-panel fade-in-up" style={{ animationDelay: "70ms" }}>
              <div className="big-note-label">Общий вывод</div>
              <div className="big-note-text">{risk.summary}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {blocks.map(([label, value, tone], idx) => (
          <Panel
            key={label}
            tone={tone}
            className="p-5 min-h-[120px] flex flex-col justify-between metric-3d fade-in-up"
            hover
          >
            <div className="metric-label">{label}</div>
            <div className="text-[34px] font-black tracking-[-0.04em] text-white leading-none">{value}</div>
          </Panel>
        ))}
      </div>

      <Panel tone="cyan" className="p-5 section-3d fade-in-up" hover>
        <div className="section-kicker text-cyan-300 mb-4">Structure (структура)</div>
        <div className="grid md:grid-cols-5 gap-3">
          <div className="cyber-chip cyber-hover-panel">Крипта - {percent(risk.cryptoShare)}</div>
          <div className="cyber-chip cyber-hover-panel">Металлы - {percent(risk.metalsShare)}</div>
          <div className="cyber-chip cyber-hover-panel">Фьючерсы - {percent(risk.futuresShare)}</div>
          <div className="cyber-chip cyber-hover-panel">Акции - {percent(risk.stocksShare)}</div>
          <div className="cyber-chip cyber-hover-panel">Кэш - {percent(risk.cashShare)}</div>
        </div>
      </Panel>
    </div>
  );
}

function CollapsibleSection({
  asset,
  category,
  isOpen,
  onToggle,
  tone,
  children,
}: {
  asset: string;
  category: string;
  isOpen: boolean;
  onToggle: () => void;
  tone: "cyan" | "violet";
  children: React.ReactNode;
}) {
  return (
    <Panel tone={tone} className="overflow-hidden section-3d fade-in-up" hover>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-5 text-left transition"
        style={{ background: isOpen ? tone === "cyan" ? "rgba(91,214,255,0.08)" : "rgba(168,85,247,0.08)" : "transparent" }}
      >
        <div>
          <div className="text-[34px] font-black tracking-[-0.04em] text-white leading-none">{asset}</div>
          <div className="text-[14px] text-slate-500 mt-2">{category}</div>
        </div>
        <Badge tone={tone}>{isOpen ? "Скрыть" : "Открыть"}</Badge>
      </button>

      <div className={`collapsible-content ${isOpen ? "open" : ""}`}>
        <div className="collapsible-inner">
          {children}
        </div>
      </div>
    </Panel>
  );
}

function DecisionsPage({ decisions, portfolio }: { decisions: ApiDecision[]; portfolio: ApiPosition[] }) {
  const [openAsset, setOpenAsset] = useState<string | null>(portfolio[0]?.asset ?? null);
  const decisionMap = new Map(decisions.map((item) => [item.asset, item]));

  return (
    <div className="space-y-3">
      {portfolio.map((position) => {
        const item = decisionMap.get(position.asset);
        const isOpen = openAsset === position.asset;

        return (
          <CollapsibleSection
            key={position.asset}
            asset={position.asset}
            category={position.category}
            isOpen={isOpen}
            onToggle={() => setOpenAsset(isOpen ? null : position.asset)}
            tone="violet"
          >
            <div className="grid lg:grid-cols-2 gap-4 text-sm" style={{ borderTop: "1px solid rgba(168,85,247,0.14)" }}>
              {[
                ["Текущая идея", item?.thesis ?? "Пока не заполнено"],
                ["Почему держу", item?.whyHold ?? "Пока не заполнено"],
                ["Что ожидаю", item?.expect ?? "Пока не заполнено"],
                ["Следующее действие", item?.nextAction ?? "Пока не заполнено"],
              ].map(([title, value], idx) => (
                <div
                  key={title}
                  className="cyber-fold-card cyber-hover-panel"
                  style={{
                    border: idx % 2 === 0 ? "1px solid rgba(91,214,255,0.12)" : "1px solid rgba(168,85,247,0.12)",
                  }}
                >
                  <div className="cyber-fold-label">{title}</div>
                  <div className="cyber-fold-text">{value}</div>
                </div>
              ))}

              <div className="cyber-fold-card cyber-hover-panel lg:col-span-2" style={{ border: "1px solid rgba(255,216,77,0.12)" }}>
                <div className="cyber-fold-label">Триггер пересмотра</div>
                <div className="cyber-fold-text">{item?.reviewTrigger ?? "Пока не заполнено"}</div>
              </div>
            </div>
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

function ScenariosPage({ portfolio }: { portfolio: ApiPosition[] }) {
  const [openAsset, setOpenAsset] = useState<string | null>(portfolio[0]?.asset ?? null);
  const scenarioMap = new Map(scenarios.map((item) => [item.asset, item]));

  return (
    <div className="space-y-3">
      {portfolio.map((position) => {
        const item = scenarioMap.get(position.asset);
        const isOpen = openAsset === position.asset;

        return (
          <CollapsibleSection
            key={position.asset}
            asset={position.asset}
            category={position.category}
            isOpen={isOpen}
            onToggle={() => setOpenAsset(isOpen ? null : position.asset)}
            tone="cyan"
          >
            <div className="grid lg:grid-cols-2 gap-4 text-sm" style={{ borderTop: "1px solid rgba(91,214,255,0.14)" }}>
              {[
                ["Базовый сценарий", item?.base ?? "Пока не заполнено"],
                ["Бычий сценарий", item?.bull ?? "Пока не заполнено"],
                ["Медвежий сценарий", item?.bear ?? "Пока не заполнено"],
                ["Действие", item?.action ?? "Пока не заполнено"],
              ].map(([title, value], idx) => (
                <div
                  key={title}
                  className="cyber-fold-card cyber-hover-panel"
                  style={{
                    border: idx % 2 === 0 ? "1px solid rgba(91,214,255,0.12)" : "1px solid rgba(168,85,247,0.12)",
                  }}
                >
                  <div className="cyber-fold-label">{title}</div>
                  <div className="cyber-fold-text">{value}</div>
                </div>
              ))}

              <div className="cyber-fold-card cyber-hover-panel lg:col-span-2" style={{ border: "1px solid rgba(255,216,77,0.12)" }}>
                <div className="cyber-fold-label">Поломка идеи</div>
                <div className="cyber-fold-text">{item?.invalidation ?? "Пока не заполнено"}</div>
              </div>
            </div>
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

function LoginPage({
  login,
  password,
  error,
  onLoginChange,
  onPasswordChange,
  onSubmit,
}: {
  login: string;
  password: string;
  error: string;
  onLoginChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center cyber-scene px-4">
      <div className="scene-orb orb-cyan" />
      <div className="scene-orb orb-violet" />
      <div className="scene-orb orb-yellow" />
      <div className="scene-plane plane-left" />
      <div className="scene-plane plane-right" />

      <Panel tone="violet" className="w-full max-w-md p-8 section-3d fade-in-up relative z-10" hover>
        <div className="text-center mb-8 float-soft">
          <div className="section-kicker text-cyan-300">Access (доступ)</div>
          <div className="text-[54px] font-black tracking-[-0.05em] text-white leading-none mt-3">Вход</div>
          <div className="text-slate-400 mt-3">Тестовый доступ для друзей и коллег</div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            className="cyber-input"
            placeholder="Логин"
            value={login}
            onChange={(e) => onLoginChange(e.target.value)}
            autoComplete="username"
          />
          <input
            className="cyber-input"
            placeholder="Пароль"
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            autoComplete="current-password"
          />

          {error ? (
            <div
              className="rounded-[18px] px-4 py-3 text-sm"
              style={{
                background: "rgba(255, 80, 80, 0.08)",
                border: "1px solid rgba(255, 80, 80, 0.22)",
                color: "#ffd4d4",
              }}
            >
              {error}
            </div>
          ) : null}

          <button className="cyber-button-main" type="submit">
            Войти
          </button>
        </form>
      </Panel>
    </div>
  );
}

function AccountPage({
  onLogout,
}: {
  onLogout: () => void;
}) {
  return (
    <Panel tone="violet" className="p-6 section-3d fade-in-up" hover>
      <div className="section-kicker text-cyan-300">Account (аккаунт)</div>
      <div className="section-title mb-6">Вход</div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="big-note big-note-cyan cyber-hover-panel">
          <div className="big-note-label">Статус</div>
          <div className="big-note-text">Ты внутри тестовой версии продукта.</div>
        </div>

        <div className="big-note big-note-violet cyber-hover-panel">
          <div className="big-note-label">Доступ</div>
          <div className="big-note-text">Эта версия открывается по общему логину для друзей.</div>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onLogout}
          className="cyber-button-secondary"
          style={{ maxWidth: 260 }}
        >
          Выйти
        </button>
      </div>
    </Panel>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("Обзор");
  const [data] = useState<ApiResponse>(demoData);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (login.trim() === TEST_LOGIN && password === TEST_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError("");
      setPassword("");
      setPage("Обзор");
      return;
    }

    setAuthError("Неверный логин или пароль");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setLogin("");
    setPassword("");
    setAuthError("");
    setPage("Обзор");
  };

  if (!isAuthenticated) {
    return (
      <LoginPage
        login={login}
        password={password}
        error={authError}
        onLoginChange={setLogin}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen text-slate-100 p-4 md:p-6 cyber-scene">
      <div className="scene-orb orb-cyan" />
      <div className="scene-orb orb-violet" />
      <div className="scene-orb orb-yellow" />
      <div className="scene-plane plane-left" />
      <div className="scene-plane plane-right" />

      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 relative z-10">
        <Sidebar page={page} setPage={setPage} />

        <main className="flex-1 space-y-6">
          <Panel tone="cyan" className="p-5 hero-3d fade-in-up" hover>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="float-soft">
                <div className="section-kicker text-cyan-300">Dashboard (панель)</div>
                <h1 className="hero-title">{page}</h1>
                <p className="text-[16px] text-slate-400 mt-3">
                  MVP сайта. Визуальный слой поверх движка портфеля.
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Badge tone="cyan">Web MVP</Badge>
                <Badge tone="violet">Тёмная тема</Badge>
                <Badge tone="yellow">Защищено</Badge>
              </div>
            </div>
          </Panel>

          {page === "Обзор" && <OverviewPage overview={data.overview} portfolio={data.portfolio} risk={data.risk} />}
          {page === "Портфель" && <PortfolioPage positions={data.portfolio} />}
          {page === "Риск" && <RiskPage risk={data.risk} />}
          {page === "Решения" && <DecisionsPage decisions={data.decisions} portfolio={data.portfolio} />}
          {page === "Сценарии" && <ScenariosPage portfolio={data.portfolio} />}
          {page === "Вход" && <AccountPage onLogout={handleLogout} />}
        </main>
      </div>
    </div>
  );
}