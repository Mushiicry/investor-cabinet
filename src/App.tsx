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
portfolioValue: 394.1,
invested: 388.3,
pnl: 5.8,
pnlPct: 0.0149,
reserve: 245,
positionsCount: 9,
health: 0.95,
state: "Отлично",
signal: "Кэша много - можно добирать активы по сценарию",
action: "В работу по стратегии можно пустить около $126.8",
topPositions: [
{ asset: "USDT", share: 0.6217, value: 245, status: "Резерв" },
{ asset: "ETH", share: 0.141, value: 55.5, status: "Ядро" },
{ asset: "BTC", share: 0.0773, value: 30.4, status: "Ядро" },
],
categories: [
{ name: "Крипта", value: 149.1, share: 0.3783 },
{ name: "Золото", value: 0, share: 0 },
{ name: "Акции", value: 0, share: 0 },
{ name: "Свободные деньги", value: 245, share: 0.6217 },
],
},
portfolio: [
{ asset: "BTC", category: "Крипта", quantity: 0.0004367, avgEntry: 68200, invested: 29.78, currentPrice: 69759.62, currentValue: 30.44, pnl: 0.66, pnlPct: 2.2, share: 7.7, status: "Накапливать" },
{ asset: "ETH", category: "Крипта", quantity: 0.0258, avgEntry: 1921, invested: 49.58, currentPrice: 2156, currentValue: 55.53, pnl: 5.95, pnlPct: 12.0, share: 14.1, status: "Накапливать" },
{ asset: "TON", category: "Крипта", quantity: 11.63, avgEntry: 1.33, invested: 15.47, currentPrice: 1.27, currentValue: 14.77, pnl: -0.70, pnlPct: -4.5, share: 3.7, status: "Наблюдать" },
{ asset: "SOL", category: "Крипта", quantity: 0.1694, avgEntry: 90, invested: 15.24, currentPrice: 82.56, currentValue: 13.99, pnl: -1.25, pnlPct: -8.2, share: 3.5, status: "Накапливать" },
{ asset: "BNB", category: "Крипта", quantity: 0.0166, avgEntry: 594, invested: 9.83, currentPrice: 606.76, currentValue: 10.07, pnl: 0.24, pnlPct: 2.4, share: 2.6, status: "Наблюдать" },
{ asset: "TIA", category: "Крипта", quantity: 24.6, avgEntry: 0.32, invested: 7.89, currentPrice: 0.3, currentValue: 7.38, pnl: -0.51, pnlPct: -6.5, share: 1.9, status: "Наблюдать" },
{ asset: "APEX", category: "Крипта", quantity: 26.1, avgEntry: 0.29, invested: 7.57, currentPrice: 0.27, currentValue: 7.05, pnl: -0.52, pnlPct: -6.9, share: 1.8, status: "Наблюдать" },
{ asset: "MNT", category: "Крипта", quantity: 14.5, avgEntry: 0.55, invested: 7.92, currentPrice: 0.68, currentValue: 9.86, pnl: 1.94, pnlPct: 24.5, share: 2.5, status: "Наблюдать" },
{ asset: "USDT", category: "Свободные деньги", quantity: 245, avgEntry: 1, invested: 245, currentPrice: 1, currentValue: 245, pnl: 0, pnlPct: 0, share: 62.2, status: "Держать" },
],
risk: {
portfolioValue: 394.1,
reserve: 245,
reserveShare: 0.6217,
deployableCash: 126.8,
largestRiskAsset: "ETH",
largestRiskShare: 0.141,
cryptoShare: 0.3783,
stocksShare: 0,
metalsShare: 0,
cashShare: 0.6217,
health: 0.95,
state: "Отлично",
signal: "Резерв выше цели - можно добирать активы",
summary: "Структура защитная, ликвидность высокая",
},
decisions: [
{ asset: "BTC", thesis: "Базовый актив портфеля", whyHold: "Главный цифровой актив цикла", expect: "Умеренный рост по базовому сценарию", nextAction: "Добирать на сильной слабости", reviewTrigger: "Слом структуры рынка", status: "Держать" },
{ asset: "ETH", thesis: "Главный рисковый актив ядра", whyHold: "Сильная экосистема и ликвидность", expect: "Опережающий рост против части альтов", nextAction: "Приоритетный добор", reviewTrigger: "Потеря силы против BTC", status: "Накапливать" },
],
updatedAt: new Date().toISOString(),
};

const scenarios: ScenarioCard[] = [
{
asset: "BTC",
base: "Спокойный рост и удержание роли базового актива портфеля.",
bull: "Ускорение рынка и продолжение импульса вверх.",
bear: "Глубокая коррекция. Добирать только по плану.",
action: "Не гнаться. Работать от слабости и паники.",
invalidation: "Поломка глобальной структуры по рынку.",
status: "Активен",
},
{
asset: "ETH",
base: "Сильнее части рынка и остаётся главным рисковым активом ядра.",
bull: "Резкое усиление интереса и рост быстрее BTC.",
bear: "Просадка вместе с альтами. Покупки только ступенчато.",
action: "Добирать раньше большей части альтов.",
invalidation: "Потеря силы и ухудшение фундаментала.",
status: "Активен",
},
{
asset: "TON",
base: "Боковик и накопление до нового импульса.",
bull: "Всплеск внимания и сильное движение на новостях.",
bear: "Дальнейшее сползание без спроса.",
action: "Только точечные покупки в зонах слабости.",
invalidation: "Уход интереса рынка к активу.",
status: "Наблюдение",
},
];

function Badge({ children }: { children: React.ReactNode }) {
return (
<span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
{children}
</span>
);
}

function Sidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
const items: Page[] = ["Обзор", "Портфель", "Риск", "Решения", "Сценарии", "Вход"];

return (
<aside className="w-full lg:w-64 shrink-0">
<div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
<div className="px-3 py-2 mb-3">
<div className="text-xs uppercase tracking-[0.2em] text-slate-500">MVP</div>
<div className="text-xl font-bold mt-1 text-white">Кабинет инвестора</div>
</div>
<nav className="space-y-1">
{items.map((item) => (
<button
key={item}
onClick={() => setPage(item)}
className={`w-full text-left rounded-2xl px-4 py-3 transition border ${
page === item
? "bg-white text-slate-950 border-white"
: "bg-slate-900 text-slate-300 border-transparent hover:bg-slate-800"
}`}
>
{item}
</button>
))}
</nav>
</div>
</aside>
);
}

function MetricCard({ label, value }: { label: string; value: string }) {
return (
<div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
<div className="text-sm text-slate-400 mb-2">{label}</div>
<div className="text-3xl font-bold tracking-tight text-white">{value}</div>
</div>
);
}

function DonutChart({ categories }: { categories: ApiOverview["categories"] }) {
const total = categories.reduce((sum, item) => sum + Number(item.value || 0), 0);
let current = 0;
const colors = ["#38bdf8", "#22c55e", "#eab308", "#a78bfa", "#ef4444"];

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
<div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
<div className="text-lg font-semibold mb-4 text-white">Распределение средств</div>
<div className="flex flex-col xl:flex-row gap-6 items-center">
<div className="relative w-56 h-56 shrink-0">
<svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
<circle cx="60" cy="60" r="45" fill="none" stroke="#0f172a" strokeWidth="14" />
{segments.map((segment) => (
<circle
key={segment.name}
cx="60"
cy="60"
r="45"
fill="none"
stroke={segment.color}
strokeWidth="14"
strokeLinecap="round"
strokeDasharray={segment.dashArray}
strokeDashoffset={segment.dashOffset}
/>
))}
</svg>
<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
<div className="text-sm text-slate-400">Всего</div>
<div className="text-2xl font-bold text-white">{currency(total)}</div>
</div>
</div>

<div className="w-full space-y-3">
{segments.map((segment) => (
<div key={segment.name} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 flex items-center justify-between gap-4">
<div className="flex items-center gap-3">
<span className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
<div>
<div className="text-slate-100 font-medium">{segment.name}</div>
<div className="text-xs text-slate-500">{currency(segment.value)}</div>
</div>
</div>
<div className="text-slate-300 font-medium">{percent(segment.share)}</div>
</div>
))}
</div>
</div>
</div>
);
}

function OverviewPage({ overview, portfolio, risk }: { overview: ApiOverview; portfolio: ApiPosition[]; risk: ApiRisk }) {
const workPositions = portfolio.filter((item) => item.category !== "Свободные деньги");
const bestPosition = [...workPositions].sort((a, b) => Number(b.pnl) - Number(a.pnl))[0];
const worstPosition = [...workPositions].sort((a, b) => Number(a.pnl) - Number(b.pnl))[0];

return (
<div className="space-y-6">
<section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
<MetricCard label="Сколько вложил" value={currency(overview.invested)} />
<MetricCard label="Портфель сейчас" value={currency(overview.portfolioValue)} />
<MetricCard label="PnL в долларах" value={currency(overview.pnl)} />
<MetricCard label="PnL в процентах" value={percent(overview.pnlPct)} />
</section>

<section className="grid xl:grid-cols-12 gap-6">
<div className="xl:col-span-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
<div>
<div className="text-sm text-slate-400">Хелс фактор портфеля</div>
<div className="text-6xl font-bold tracking-tight mt-1 text-white">{percent(overview.health)}</div>
</div>
<Badge>{overview.state}</Badge>
</div>

<div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-sm text-slate-400 mb-2">Лучшая позиция</div>
<div className="text-xl font-bold text-white">{bestPosition?.asset ?? "-"}</div>
<div className="text-slate-300 mt-1">{bestPosition ? currency(bestPosition.pnl) : "-"}</div>
<div className="text-sm text-slate-500">{bestPosition ? percentDirect(bestPosition.pnlPct) : "-"}</div>
</div>

<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-sm text-slate-400 mb-2">Худшая позиция</div>
<div className="text-xl font-bold text-white">{worstPosition?.asset ?? "-"}</div>
<div className="text-slate-300 mt-1">{worstPosition ? currency(worstPosition.pnl) : "-"}</div>
<div className="text-sm text-slate-500">{worstPosition ? percentDirect(worstPosition.pnlPct) : "-"}</div>
</div>

<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-sm text-slate-400 mb-2">Можно пустить в работу</div>
<div className="text-xl font-bold text-white">{currency(risk.deployableCash)}</div>
<div className="text-sm text-slate-500 mt-1">По стратегии прямо сейчас</div>
</div>

<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-sm text-slate-400 mb-2">Свободные деньги</div>
<div className="text-xl font-bold text-white">{currency(overview.reserve)}</div>
<div className="text-sm text-slate-500 mt-1">Резерв для действий</div>
</div>
</div>

<div className="grid md:grid-cols-2 gap-4">
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-sm text-slate-400 mb-2">Короткая подсказка</div>
<div className="font-medium leading-6 text-slate-100">{overview.signal}</div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-sm text-slate-400 mb-2">Действие</div>
<div className="font-medium leading-6 text-slate-100">{overview.action}</div>
</div>
</div>
</div>

<div className="xl:col-span-4 space-y-4">
{overview.topPositions.map((p, idx) => (
<div key={`${p.asset}-${idx}`} className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
<div className="text-sm text-slate-400 mb-3">Топ позиция {idx + 1}</div>
<div className="flex items-start justify-between gap-4">
<div>
<div className="text-2xl font-bold text-white">{p.asset}</div>
<div className="text-sm text-slate-500 mt-1">{p.status}</div>
</div>
<Badge>{percent(p.share)}</Badge>
</div>
<div className="mt-4 text-lg font-semibold text-white">{currency(p.value)}</div>
</div>
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
const sorted = [...base].sort((a, b) => {
if (sortBy === "share") return Number(b.share) - Number(a.share);
if (sortBy === "pnl") return Number(b.pnl) - Number(a.pnl);
return Number(b.currentValue) - Number(a.currentValue);
});
return sorted;
}, [categoryFilter, sortBy, positions]);

return (
<div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm space-y-5">
<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
<div>
<h2 className="text-2xl font-bold text-white">Портфель</h2>
<p className="text-slate-400 mt-1">Основной рабочий экран по всем позициям.</p>
</div>
<div className="flex gap-3 flex-wrap">
<select
value={categoryFilter}
onChange={(e) => setCategoryFilter(e.target.value)}
className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-slate-200"
>
{categories.map((v) => (
<option key={v}>{v}</option>
))}
</select>
<select
value={sortBy}
onChange={(e) => setSortBy(e.target.value as "share" | "pnl" | "value")}
className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-slate-200"
>
<option value="share">Сортировка по доле</option>
<option value="pnl">Сортировка по PnL</option>
<option value="value">Сортировка по стоимости</option>
</select>
</div>
</div>

<div className="overflow-x-auto">
<table className="w-full text-sm text-slate-200">
<thead>
<tr className="border-b border-slate-800 text-left text-slate-400">
<th className="py-3 pr-4">Актив</th>
<th className="py-3 pr-4">Категория</th>
<th className="py-3 pr-4">Вложено</th>
<th className="py-3 pr-4">Средняя цена входа</th>
<th className="py-3 pr-4">Текущая цена</th>
<th className="py-3 pr-4">Текущая стоимость</th>
<th className="py-3 pr-4">PnL $</th>
<th className="py-3 pr-4">PnL %</th>
<th className="py-3 pr-4">Доля %</th>
<th className="py-3">Статус</th>
</tr>
</thead>
<tbody>
{filtered.map((p) => (
<tr key={p.asset} className="border-b border-slate-800 last:border-0">
<td className="py-3 pr-4 font-medium">{p.asset}</td>
<td className="py-3 pr-4">{p.category}</td>
<td className="py-3 pr-4">{currency(p.invested)}</td>
<td className="py-3 pr-4">{currency(p.avgEntry)}</td>
<td className="py-3 pr-4">{currency(p.currentPrice)}</td>
<td className="py-3 pr-4">{currency(p.currentValue)}</td>
<td className="py-3 pr-4">{currency(p.pnl)}</td>
<td className="py-3 pr-4">{percentDirect(p.pnlPct)}</td>
<td className="py-3 pr-4">{percentDirect(p.share)}</td>
<td className="py-3">
<Badge>{p.status}</Badge>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

function RiskPage({ risk }: { risk: ApiRisk }) {
const blocks = [
["Стоимость портфеля", currency(risk.portfolioValue)],
["Резерв", currency(risk.reserve)],
["Свободный кэш для добора", currency(risk.deployableCash)],
["Крупнейший рисковый актив", `${risk.largestRiskAsset} - ${percent(risk.largestRiskShare)}`],
];

return (
<div className="space-y-6">
<div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
<div className="grid lg:grid-cols-4 gap-4 items-start">
<div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-950 p-5">
<div className="text-sm text-slate-400">Здоровье портфеля</div>
<div className="text-5xl font-bold mt-2 text-white">{percent(risk.health)}</div>
<div className="mt-3"><Badge>{risk.state}</Badge></div>
</div>
<div className="lg:col-span-3 grid md:grid-cols-2 gap-4">
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-sm text-slate-400 mb-2">Главный сигнал</div>
<div className="font-medium text-slate-100">{risk.signal}</div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-sm text-slate-400 mb-2">Общий вывод</div>
<div className="font-medium text-slate-100">{risk.summary}</div>
</div>
</div>
</div>
</div>

<div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
{blocks.map(([label, value]) => (
<div key={label} className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
<div className="text-sm text-slate-400 mb-2">{label}</div>
<div className="text-2xl font-bold text-white">{value}</div>
</div>
))}
</div>

<div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
<div className="text-sm text-slate-400 mb-3">Структура портфеля по классам активов</div>
<div className="flex flex-wrap gap-x-6 gap-y-3 text-slate-200">
<span>Крипта - {percent(risk.cryptoShare)}</span>
<span>Акции - {percent(risk.stocksShare)}</span>
<span>Металлы - {percent(risk.metalsShare)}</span>
<span>Кэш - {percent(risk.cashShare)}</span>
</div>
</div>
</div>
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
<div key={position.asset} className="rounded-3xl border border-slate-800 bg-slate-900 shadow-sm overflow-hidden">
<button
onClick={() => setOpenAsset(isOpen ? null : position.asset)}
className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-800/40 transition"
>
<div>
<div className="text-xl font-bold text-white">{position.asset}</div>
<div className="text-sm text-slate-500 mt-1">{position.category}</div>
</div>
<Badge>{isOpen ? "Скрыть" : "Открыть"}</Badge>
</button>

{isOpen && (
<div className="border-t border-slate-800 px-5 py-5 grid lg:grid-cols-2 gap-4 text-sm">
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-slate-400 mb-1">Текущая идея</div>
<div className="text-slate-100">{item?.thesis ?? "Пока не заполнено"}</div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-slate-400 mb-1">Почему держу</div>
<div className="text-slate-100">{item?.whyHold ?? "Пока не заполнено"}</div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-slate-400 mb-1">Что ожидаю</div>
<div className="text-slate-100">{item?.expect ?? "Пока не заполнено"}</div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-slate-400 mb-1">Следующее действие</div>
<div className="text-slate-100">{item?.nextAction ?? "Пока не заполнено"}</div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 lg:col-span-2">
<div className="text-slate-400 mb-1">Триггер пересмотра</div>
<div className="text-slate-100">{item?.reviewTrigger ?? "Пока не заполнено"}</div>
</div>
</div>
)}
</div>
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
<div key={position.asset} className="rounded-3xl border border-slate-800 bg-slate-900 shadow-sm overflow-hidden">
<button
onClick={() => setOpenAsset(isOpen ? null : position.asset)}
className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-800/40 transition"
>
<div>
<div className="text-xl font-bold text-white">{position.asset}</div>
<div className="text-sm text-slate-500 mt-1">{position.category}</div>
</div>
<Badge>{isOpen ? "Скрыть" : "Открыть"}</Badge>
</button>

{isOpen && (
<div className="border-t border-slate-800 px-5 py-5 grid lg:grid-cols-2 gap-4 text-sm">
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-slate-400 mb-1">Базовый сценарий</div>
<div className="text-slate-100">{item?.base ?? "Пока не заполнено"}</div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-slate-400 mb-1">Бычий сценарий</div>
<div className="text-slate-100">{item?.bull ?? "Пока не заполнено"}</div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-slate-400 mb-1">Медвежий сценарий</div>
<div className="text-slate-100">{item?.bear ?? "Пока не заполнено"}</div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
<div className="text-slate-400 mb-1">Действие</div>
<div className="text-slate-100">{item?.action ?? "Пока не заполнено"}</div>
</div>
<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 lg:col-span-2">
<div className="text-slate-400 mb-1">Поломка идеи</div>
<div className="text-slate-100">{item?.invalidation ?? "Пока не заполнено"}</div>
</div>
</div>
)}
</div>
);
})}
</div>
);
}

function LoginPage() {
return (
<div className="min-h-[70vh] flex items-center justify-center">
<div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-sm">
<div className="text-center mb-6">
<div className="text-3xl font-bold text-white">Вход</div>
<div className="text-slate-400 mt-2">Черновой экран для MVP сайта</div>
</div>
<div className="space-y-4">
<input className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" placeholder="Email" />
<input className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" placeholder="Пароль" type="password" />
<button className="w-full rounded-2xl bg-white text-slate-900 px-4 py-3 font-medium">
Войти
</button>
<button className="w-full rounded-2xl border border-slate-700 px-4 py-3 font-medium text-slate-200">
Создать аккаунт
</button>
</div>
</div>
</div>
);
}

export default function App() {
const [page, setPage] = useState<Page>("Обзор");
const [data] = useState<ApiResponse>(demoData);

return (
<div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
<div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
<Sidebar page={page} setPage={setPage} />
<main className="flex-1 space-y-6">
<div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
<div>
<h1 className="text-3xl font-bold tracking-tight text-white">{page}</h1>
<p className="text-slate-400 mt-1">MVP сайта. Визуальный слой поверх движка портфеля.</p>
</div>
<div className="flex gap-2 flex-wrap">
<Badge>Web MVP</Badge>
<Badge>Тёмная тема</Badge>
<Badge>Тестовый режим</Badge>
</div>
</div>

{page === "Обзор" && <OverviewPage overview={data.overview} portfolio={data.portfolio} risk={data.risk} />}
{page === "Портфель" && <PortfolioPage positions={data.portfolio} />}
{page === "Риск" && <RiskPage risk={data.risk} />}
{page === "Решения" && <DecisionsPage decisions={data.decisions} portfolio={data.portfolio} />}
{page === "Сценарии" && <ScenariosPage portfolio={data.portfolio} />}
{page === "Вход" && <LoginPage />}
</main>
</div>
</div>
);
}