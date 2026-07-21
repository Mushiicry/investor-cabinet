# Глубокий аудит блока «Здоровье портфеля»

Дата: 2026-07-21  
Проект: Investor Cabinet / Кабинет инвестора  
Режим: read-only product/risk audit, без изменений runtime-кода, API, Apps Script, Google Sheets, Vercel.

## 0. Короткий вывод

Текущий блок «Здоровье портфеля» уже попал в правильную философию проекта: он не построен вокруг PnL, считает резерв, концентрацию, крипто-экспозицию, фьючерсы, диверсификацию и гибкость. Это не декоративный score уровня «красиво выглядит». В нем уже есть настоящая risk-first логика.

Главная проблема не в том, что метрик мало. Главная проблема в том, что модель пока недостаточно строго разделяет пять разных слоев:

1. здоровье самого портфеля;
2. состояние рынка;
3. качество конкретного актива;
4. торговый сигнал;
5. поведение инвестора.

Сейчас Portfolio Health почти полностью измеряет структуру капитала. Это хорошее ядро, но это еще не профессиональное «здоровье капитала». Не хватает трех вещей:

1. сценарной устойчивости: что будет при BTC -20%, BTC -40%, рынок -60%, liquidity shock;
2. дисциплины инвестора: были ли сделки против правил, cooldown, FOMO, revenge trading, добор сверх лимита;
3. качества ликвидности/актива: можно ли выйти, не разрушая структуру капитала, и не деградирует ли актив.

Самый спорный текущий элемент: фьючерсы. Код трактует 10% спекулятивного бюджета как целевое финансирование и снимает баллы за недофинансирование. Манифест формулирует спекулятивный блок как «не более 10% капитала», то есть потолок риска, а не обязательную квоту. Это нужно пересмотреть концептуально до следующих правок.

## Использованные источники

1. Манифест: `MushiiInvest/Инвестиционная стратегия 36e417146d6f80aeaebfde9d9e90d446.md`.
2. Hard rules: `MushiiInvest/Свод правил 36e417146d6f8094aabcfb74aaa8ae04.md`.
3. Product philosophy: `docs/vision/PRODUCT_PHILOSOPHY.md`.
4. Finance architecture: `docs/vision/ARCHITECTURE_FINANCE.md`.
5. UI principles: `docs/vision/UI_PRINCIPLES.md`.
6. Current health engine: `src/lib/portfolioHealth.ts`.
7. Live V2 data builder: `src/v2/lib/v2LabData.ts`.
8. Pre-trade gate and concentration model: `src/v2/lib/preTradeGate.ts`.
9. Risk constants: `src/config/riskRules.ts`.
10. Health UI: `src/v2/components/V2HealthPage.tsx`, `src/v2/components/V2HealthCore.tsx`, `src/v2/components/V2HealthDetailModal.tsx`.
11. Alerts and market signals: `src/v2/lib/portfolioAlerts.ts`, `src/lib/fearGreedStrategy.ts`, `src/v2/components/V2SignalsPage.tsx`.

## Часть 1. Восстановление инвестиционной философии

### Investment Philosophy Map

| Принцип | Что он означает | Как влияет на портфель | Какие метрики нужны |
|---|---|---|---|
| Капитал должен переживать поколения | Отдельная сделка вторична; устойчивость системы важнее локального результата | Нельзя уничтожать ликвидность, психологическую устойчивость и способность продолжать стратегию | reserve floor, survival score, max drawdown scenario, liquidity runway |
| Риск важнее прибыли | PnL не является главным индикатором качества | Высокая доходность не компенсирует нарушение лимитов | risk budget usage, exposure limits, leverage pressure, concentration |
| Оставаться в игре всегда | Главная ошибка - обнулить капитал или потерять способность принимать решения | Portfolio Health должен наказывать не просадку как факт, а хрупкость после просадки | stress tests, drawdown survivability, reserve after shock |
| Резерв - стратегическая ликвидность | Кэш не «простоит», а дает свободу действий и снижает эмоциональное давление | Резерв должен быть первым слоем защиты, но избыток кэша тоже может быть неэффективностью | reserve corridor, deployable capital, cash optionality |
| Циклическое мышление | Рыночная фаза меняет допустимый риск | Одни и те же доли имеют разный смысл в накоплении, страхе, росте и эйфории | phase-adjusted limits, cycle regime, risk-on/risk-off modifier |
| Паника создает возможности, эйфория повышает риск | Рынок движется эмоциями, но эмоции не должны управлять инвестором | В страхе можно аккуратно использовать резерв; в эйфории нужно снижать риск | Fear & Greed as context/modifier, not direct health component |
| Диверсификация должна служить устойчивости | Не нужно равенство ради равенства; нужна защита от одного сценария | Классы активов должны снижать зависимость от крипто-цикла | scenario concentration, class concentration, correlation proxy |
| Крипта - долгосрочная инфраструктурная ставка | BTC и ETH имеют особую роль; альты не равны ядру | Лимиты внутри крипто-блока должны отличать core от speculative | per-asset limits, core/satellite split, alt slots |
| Спекуляция не является ядром | Фьючерсы могут усилить систему, но не должны разрушать инвестиционное ядро | Спекулятивный блок должен быть capped, gated, monitored | futures cap, leverage, liquidation distance, trade discipline |
| Дисциплина важнее интеллекта | Ошибки поведения опаснее нехватки аналитики | Health должен учитывать не только структуру, но и соблюдение правил | discipline violations, cooldown breaches, revenge/FOMO flags |
| Бездействие часто правильно | Система не должна провоцировать ежедневную активность | Основной вывод может быть «ничего не делать» | action gate, no-action state, decision confidence |
| Ликвидность обязательна | Возможность выйти важнее потенциальной сверхдоходности | Актив без ликвидности должен быть фильтром, а не просто контекстом | liquidity filter, exit capacity, market depth proxy |

### Что является ядром философии

1. Risk first: любые действия проходят через риск.
2. Резерв: нельзя разрушать ликвидность.
3. Циклы: допустимый риск зависит от фазы.
4. Дисциплина: система должна снижать FOMO, panic selling, overtrading.
5. Структура капитала: портфель должен быть устойчивым, а не просто прибыльным.
6. Качество активов: фундаментал, ликвидность, выживаемость через циклы.
7. Спекуляция - вспомогательный слой, не ядро.

### Что является второстепенным

1. Красивый абсолютный score сам по себе.
2. PnL как главный сигнал.
3. Количество метрик.
4. Технические сигналы без связи с риск-моделью.
5. Псевдоинституциональные термины, если они не меняют решение.

### Что противоречит философии

1. Любая модель, где высокий PnL перекрывает разрушенный резерв.
2. Любая модель, где 10% фьючерсов считается обязательной целью, а не верхним пределом риска.
3. Любой score, где рыночная эйфория улучшает состояние портфеля.
4. Любая рекомендация «добавить риск», если не проверены резерв, лимиты, концентрация и сценарий -50%.
5. Любая метрика, которая создает ощущение точности, но не меняет решение.

### Какие элементы текущего проекта не соответствуют манифесту

| Элемент | Где видно | Проблема | Рекомендация |
|---|---|---|---|
| Фьючерсы как «счет должен быть укомплектован на 10%» | `src/lib/portfolioHealth.ts` считает underfunded penalty и top-up | Манифест говорит «не более 10%», не «обязательно 10%» | Перевести в режим cap/risk budget, а не target, либо явно подтвердить отдельным продуктовым решением |
| Health Detail: диверсификация описана как крипта/металлы/фьючерсы/акции | `V2HealthDetailModal.tsx` | Код исключает фьючерсы из diversifiable classes, текст говорит обратное | Синхронизировать текст с реальной моделью |
| Risk Engine limits: металлы 15%, акции 20% | `V2RiskEnginePage.tsx` | Манифест и `riskRules.ts` говорят 10%/10% | Исправить в отдельном code scope после согласования |
| Alerts: flat 35% по позиции | `portfolioAlerts.ts` | Health уже знает per-asset лимиты крипто-блока, alerts еще частично нет | Объединить alert logic с `assetConcentration` |
| Behavior layer почти отсутствует в score | В health components нет discipline component | Манифест называет поведение главным источником потерь | Добавить отдельный Investor Discipline слой, но не смешивать его с чистой структурой портфеля |
| Market phase не является modifier health score | Health использует fixed crypto 60% | Манифест требует динамической модели по фазам | Сделать phase-adjusted health limits |

## Часть 2. Разделение понятий

### 1. Здоровье портфеля

Что измеряет: насколько структура капитала устойчива.

Должно включать:

1. резерв;
2. ликвидность;
3. концентрацию;
4. class allocation;
5. leverage/futures risk;
6. scenario resilience;
7. ability to act after shock.

Не должно включать напрямую:

1. Fear & Greed как отдельный score;
2. цену BTC;
3. торговую точку;
4. относительную силу актива;
5. красивый PnL.

### 2. Состояние рынка

Что измеряет: внешнюю среду.

Примеры:

1. Fear & Greed;
2. market phase;
3. liquidity regime;
4. BTC cycle;
5. risk-on/risk-off;
6. macro pressure.

Роль: modifier/context. Market state не делает портфель здоровым или больным. Он меняет допустимый риск.

Пример: портфель может быть здоровым при F&G 80, если он уже снизил риск и поднял резерв. Но если F&G 80, а портфель перегружен криптой и фьючерсами, это должно усиливать тревогу.

### 3. Качество конкретного актива

Что измеряет: можно ли актив держать/докупать.

Примеры:

1. ликвидность;
2. top-100 market cap;
3. ecosystem strength;
4. developer/user activity;
5. reputation;
6. Binance Monitoring List;
7. способность пережить медвежий рынок.

Роль: filter/gate. Asset Quality не должен просто добавлять +7 к Portfolio Health. Плохой актив должен запретить добор или потребовать review.

### 4. Торговый сигнал

Что измеряет: есть ли конкретная краткосрочная возможность.

Примеры:

1. зона интереса;
2. цена достигла триггера;
3. F&G диапазон добора;
4. cooldown;
5. technical setup.

Роль: signal. Он не должен входить в health score. Сигнал может быть сильным, но действие должно быть запрещено, если резерв/лимиты/качество не проходят.

### 5. Поведение инвестора

Что измеряет: соблюдает ли инвестор собственную систему.

Примеры:

1. сделки в cooldown;
2. добор сверх лимита;
3. увеличение плеча после убытков;
4. FOMO-покупки в жадности;
5. хаотичное усреднение;
6. отсутствие плана до сделки.

Роль: отдельный discipline score. Он может снижать общий Investment System Health, но его нельзя смешивать с механическим allocation score без объяснения.

## Часть 3. Архитектура здоровья портфеля

### Что оставить в PORTFOLIO HEALTH

PORTFOLIO HEALTH должен отвечать на один вопрос:

> Если рынок резко ухудшится, останется ли система живой, ликвидной и управляемой?

### Предлагаемая архитектура

| Блок | Роль | Входит в score | Почему |
|---|---|---:|---|
| A. Liquidity & Reserve Health | Есть ли подушка и свобода действий | Да | Это ядро манифеста |
| B. Concentration & Allocation Health | Нет ли перегруза по активу, классу, сценарию | Да | Определяет уязвимость структуры |
| C. Speculative Risk Health | Фьючерсы, плечо, ликвидация, число позиций | Да, как penalty/cap | Спекуляция не должна разрушать ядро |
| D. Scenario Resilience | Что будет при шоках | Да | Сейчас критически не хватает |
| E. Liquidity Exit Health | Можно ли выйти без ущерба | Да/Filter | Ликвидность - hard doctrine |
| F. Investor Discipline | Соблюдаются ли правила | Отдельный score рядом | Это не состояние портфеля, а качество поведения |
| G. Market Regime | Фаза, F&G, macro/liquidity | Modifier, не score | Это внешняя среда |
| H. Asset Quality | Качество конкретных активов | Filter, не общий score | Плохой актив не лечится красивой аллокацией |

### Что не нужно копировать автоматически из фондового подхода

1. Sharpe/Sortino в главном экране без надежной истории и объяснимого решения.
2. Beta к BTC как главный показатель: почти все крипто-активы будут beta-like к BTC, но решение меняет не beta сама по себе, а сценарная зависимость.
3. Value-at-Risk с псевдоточностью на малой истории и волатильных активах.
4. Сложные macro dashboards, если они не меняют размер позиции, резерв или запрет сделки.
5. «100 факторов» без clear action.

### Что нужно именно этому проекту

1. Health как минимальная decision system.
2. Pre-trade filter: разрешено/запрещено/максимальный размер/почему.
3. Scenario loss map: потеря в $ и % при ключевых шоках.
4. Discipline ledger: когда система была нарушена.
5. Phase-adjusted risk: 60/80/20-40 crypto cap, reserve 30/10/80 по фазе.
6. Liquidity and quality gates для активов.

## Часть 4. Разделение метрик по важности

### Tier 1 - Decision Critical

| Метрика | Категория | Что измеряет | Какое решение меняет | Возможные дубли | Рекомендация |
|---|---|---|---|---|---|
| Reserve Share | Portfolio Health | Подушка и ликвидность | Можно ли покупать, нужно ли пополнять резерв | Flexibility/cash | Оставить как главный компонент |
| Reserve Floor Breach | Filter | Пробит ли абсолютный пол 10%/фазовый пол | Запрещает действие | Reserve Share | Выделить как hard filter, не только score |
| Deployable Capital | Portfolio Health/Decision | Сколько можно использовать без нарушения резерва | Размер добора | Reserve Share | Оставить, показывать как действие |
| Per-Asset Limit Utilization | Portfolio Health/Filter | Насколько актив превысил свой лимит | Запрещает добор/требует ребаланс | Concentration | Оставить, связать Health/Alerts/Gate |
| Class Exposure vs Phase Limit | Portfolio Health/Filter | Крипта/акции/металлы/фьючерсы против лимитов | Запрет/снижение размера | Volatility, allocation | Оставить, сделать phase-aware |
| Futures Risk Budget Used | Speculative Risk | Сколько спекулятивного бюджета занято | Запрет новых фьючерсов/снижение | Leverage pressure | Оставить как cap, не как target |
| Leverage / Liquidation Distance | Speculative Risk | Риск принудительной ликвидации | Сократить, долить, запретить | Futures risk | Оставить |
| Scenario Loss: BTC -40% / market -60% | Portfolio Resilience | Потерю устойчивости при шоке | Размер позиции, резерв, добор | Volatility/concentration | Добавить P0 |
| Liquidity Exit Gate | Asset Quality/Filter | Можно ли выйти из позиции | Запрет добора/выход из актива | Asset quality | Добавить P0/P1 |
| Discipline Violations | Investor Behavior | Нарушения правил | Cooldown, запрет риска, review | Alerts | Добавить отдельным score |

### Tier 2 - Important Context

| Метрика | Категория | Что измеряет | Какое решение влияет | Рекомендация |
|---|---|---|---|---|
| Fear & Greed | Market State | Эмоциональную среду | Размер DCA, осторожность | Оставить как context/modifier |
| Cycle Phase | Market Regime | Где рынок в вероятностном цикле | Фазовые лимиты риска | Оставить как modifier |
| Health Factor Trend | Portfolio Health | Ухудшается ли структура | Требует review | Оставить |
| Largest Class Share of Risk | Portfolio Health | Зависимость от одного класса | Ребаланс | Оставить |
| Altcoin Slots Used | Allocation/Quality | Сколько мест занято альтами | Запрет нового альта | Оставить |
| Price Alert Proximity | Trading Signal | Насколько близка зона интереса | Внимание, но не разрешение сделки | Оставить вне Health |
| Current PnL / Realized PnL | Performance Context | Результат, а не качество структуры | Может влиять на фиксацию, но не health | Оставить вторичным |

### Tier 3 - Supporting Data

| Метрика | Роль | Рекомендация |
|---|---|---|
| Positions count | Описывает сложность портфеля | Оставить в деталях |
| Number of futures positions | Полезно внутри futures risk | Оставить как subcomponent |
| Stablecoin list/locations | Операционная проверка | Оставить в details |
| Source tag: API/manual/calculation | Доверие к данным | Оставить |
| Last check timestamp | Операционная свежесть | Оставить |
| Component weights | Объяснение модели | Оставить в details, не выводить как главный UX |

### Tier 4 - Decorative / Noise

| Метрика/прием | Почему шум | Рекомендация |
|---|---|---|
| Health as one big number without cause | Создает ложную простоту | Показывать вместе с главной проблемой и главным действием |
| «Волатильность» как просто доля крипты | Название обещает market volatility, формула считает exposure | Переименовать или расширить |
| Точные gain `+6`, `+5` без расчетной модели влияния | Создает ложную точность | Сделать qualitative impact или считать delta через simulator |
| «Пополнить фьючерсный счет до 10%» как health action | Может провоцировать риск | Убрать из health core, если 10% не подтверждено как обязательная квота |
| Слишком много тревог одновременно | Размывает приоритет | Ввести top risk driver |

## Часть 5. Поиск дублирования

### Кластер 1. Резерв / кэш / гибкость / deployable capital

1. Что действительно разное:
   - резерв - стратегическая подушка;
   - deployable capital - что можно использовать;
   - flexibility - способность действовать.
2. Что дублирует:
   - `reserve` и `flexibility` частично измеряют один и тот же cash layer;
   - alerts «мало стейблов» и reserve warnings частично дублируют друг друга.
3. Что оставить:
   - Reserve Health как score component;
   - Deployable Capital как decision output.
4. Что объединить:
   - Flexibility лучше сделать subcomponent внутри Liquidity & Reserve Health, а не отдельной равновесной гранью.
5. Что удалить:
   - отдельную «Гибкость» из top-level Health, если она продолжит быть просто `cashShare / 50%`.

### Кластер 2. Крипто-экспозиция / волатильность / class allocation

1. Что действительно разное:
   - доля крипты - allocation risk;
   - волатильность - поведение цен;
   - phase-adjusted crypto cap - policy rule.
2. Что дублирует:
   - текущая «Сопротивление волатильности» фактически является долей крипты против 60%.
3. Что оставить:
   - Crypto Exposure vs Limit.
4. Что объединить:
   - назвать компонент честно: `Volatile Asset Exposure`, а не volatility.
5. Что удалить:
   - обещание измерять волатильность, пока нет actual volatility/downside data.

### Кластер 3. Concentration / diversification / allocation risk

1. Что действительно разное:
   - concentration - риск одного актива;
   - diversification - риск одного класса;
   - allocation - соответствие манифесту.
2. Что дублирует:
   - concentration и diversification оба реагируют на перегруз, но на разных уровнях.
3. Что оставить:
   - per-asset concentration;
   - scenario/class concentration.
4. Что объединить:
   - class allocation и diversification можно объединить в `Allocation Structure`.
5. Что удалить:
   - flat 35% alerts как основной источник, если есть per-asset concentration.

### Кластер 4. Futures share / leverage / liquidation / futures count

1. Что действительно разное:
   - margin share - сколько капитала поставлено под риск;
   - leverage - насколько умножен риск;
   - liquidation distance - насколько близок forced loss;
   - count - сложность управления.
2. Что дублирует:
   - futures share и leverage pressure оба говорят о speculative risk, но не одно и то же.
3. Что оставить:
   - все четыре как subcomponents внутри one `Speculative Risk`.
4. Что объединить:
   - не делать их отдельными top-level health blocks.
5. Что удалить:
   - underfunded futures penalty, если 10% - потолок, а не план.

### Кластер 5. Fear & Greed / market psychology / buy zones / price alerts

1. Что действительно разное:
   - Fear & Greed - market emotion;
   - buy zones - strategy pacing;
   - price alerts - execution attention;
   - market psychology - behavioral context.
2. Что дублирует:
   - F&G zone и market psychology частично описывают один и тот же sentiment.
3. Что оставить:
   - F&G как context/modifier.
4. Что объединить:
   - F&G + psychology + cycle phase в `Market Regime Panel`.
5. Что удалить:
   - попытку превращать market emotion в portfolio health points.

## Часть 6. Поиск конфликтов

### Конфликт 1. Спекулятивный блок: target vs cap

Сигнал A: фьючерсный счет не добит до 10%, health снимает баллы.  
Сигнал B: манифест говорит, что спекулятивный блок не более 10% и не является ядром.

Приоритет: манифест.

Фактор большего веса: preservation of investment core.  
Фильтр: превышение 10%, плечо, ликвидация, количество позиций.  
Предупреждение: недофинансирование может быть operational note, но не health problem.  
Не должно влиять на основное решение: желание «добить» фьючи ради score.

### Конфликт 2. Высокий cash улучшает резерв, но ухудшает capital deployment

Сигнал A: резерв высокий - безопасно.  
Сигнал B: слишком много кэша - капитал не работает.

Приоритет: фаза рынка. В эйфории 80% кэша может быть правильно; в накоплении 94% кэша может быть простой.

Фильтр: резерв ниже floor.  
Modifier: фаза цикла.  
Warning: слишком большой cash outside phase.  
Не должно влиять напрямую: PnL от некупленного движения.

### Конфликт 3. Актив силен по momentum, но макро/режим опасен

Сигнал A: актив растет.  
Сигнал B: market regime перегрет, F&G высокий.

Приоритет: risk regime.

Фильтр: reserve/limits/quality.  
Modifier: market regime снижает допустимый размер.  
Warning: momentum без margin of safety.  
Не должно влиять: краткосрочная «сила» как разрешение на нарушение лимитов.

### Конфликт 4. Портфель диверсифицирован по количеству активов, но зависим от BTC

Сигнал A: много монет.  
Сигнал B: все активы падают вместе с BTC.

Приоритет: scenario/correlation concentration.

Фильтр: asset/class limits.  
Modifier: BTC downside scenario.  
Warning: false diversification.  
Не должно влиять: количество тикеров само по себе.

### Конфликт 5. Asset looks cheap, but liquidity deteriorates

Сигнал A: цена упала, зона интереса близко.  
Сигнал B: ликвидность ухудшилась, актив может быть difficult exit.

Приоритет: liquidity/quality.

Фильтр: liquidity exit gate.  
Modifier: размер позиции.  
Warning: cheap can get cheaper.  
Не должно влиять: discount без качества.

### Конфликт 6. Высокий Health, но плохое поведение инвестора

Сигнал A: структура портфеля пока нормальная.  
Сигнал B: последние сделки нарушали cooldown/лимиты/план.

Приоритет: investor discipline для будущих решений.

Фильтр: cooldown/blocked action.  
Modifier: размер следующей сделки.  
Warning: system behavior degrading.  
Не должно влиять: текущий хороший score как разрешение на импульсивность.

## Часть 7. Разделение факторов на типы

| Показатель | Тип | Может ли входить в score | Почему |
|---|---|---:|---|
| Reserve floor breach | Filter | Да, но как hard floor | Ниже пола действие запрещается |
| Reserve corridor | Score Component | Да | Показывает устойчивость |
| Deployable capital | Context/Decision output | Нет | Это результат, а не здоровье |
| Crypto exposure | Score Component/Modifier | Да | Но лимит должен зависеть от фазы |
| Per-asset limit breach | Filter + Score Component | Да | Нарушает риск-модель |
| Largest position share | Score Component | Да | Системный риск |
| Diversifiable class HHI | Score Component | Да | Но нужен scenario overlay |
| Futures margin > cap | Filter | Да как penalty | Превышение разрушает систему |
| Futures underfunded | Context | Нет | Не риск, если нет обязательной квоты |
| Leverage breach | Filter | Да | Может запретить действие |
| Liquidation distance | Alert/Score Component | Да | Прямой риск forced loss |
| Fear & Greed | Context/Modifier | Нет напрямую | Внешняя среда |
| F&G buy zone | Signal | Нет | Создает возможность, не разрешение |
| Price alert trigger | Signal/Alert | Нет | Не health |
| Asset liquidity | Filter | Да/отдельно | Может запретить актив |
| Asset fundamental deterioration | Filter/Alert | Нет в portfolio score, да в asset score | Требует review/exit |
| Discipline violation | Alert/Discipline Score | Отдельно | Поведение инвестора, не allocation |
| Health Factor trend drop | Alert | Нет | Предупреждение о деградации |

## Часть 8. Новая система Portfolio Health Score

### Принцип

Итоговый score должен быть объяснимым:

1. почему score такой;
2. что ухудшило здоровье;
3. что улучшит здоровье;
4. какое действие имеет максимальный эффект;
5. какие действия запрещены независимо от score.

### Предлагаемая модель

```text
PORTFOLIO HEALTH

82 / 100

Liquidity & Reserve       90
Allocation Structure      78
Concentration Risk        74
Speculative Risk          86
Scenario Resilience       62
Data & Execution Safety   88

Separate:
Investor Discipline       71
Market Regime             Risk-off / accumulation
Asset Quality Gate        Pass / Review / Block
```

### Почему именно так

1. `Liquidity & Reserve` объединяет reserve + flexibility, чтобы не дублировать cash.
2. `Allocation Structure` отвечает за class allocation относительно манифеста.
3. `Concentration Risk` отвечает за один актив и per-asset limits.
4. `Speculative Risk` отвечает за futures/leverage/liquidation/cap.
5. `Scenario Resilience` добавляет отсутствующий слой шоков.
6. `Data & Execution Safety` нужен, потому что проект зависит от Google Sheets/API/Apps Script; stale/partial data может сделать любой score ложным.
7. `Investor Discipline` показывается рядом, но не растворяется внутри структуры портфеля.
8. `Market Regime` является modifier, не частью механического health.
9. `Asset Quality Gate` является фильтром.

### Правило итогового вывода

Score без действия бесполезен. Экран должен всегда показывать:

```text
Главная проблема:
Крипто-сценарий доминирует: при BTC -40% портфель теряет устойчивость быстрее, чем допускает риск-модель.

Главная сила:
Резерв выше фазового пола, ликвидность сохранена.

Главное действие:
Не добавлять новые высококоррелированные активы; следующий добор только после проверки сценария -50% и per-asset лимита.

Запрещено:
Увеличивать фьючерсный риск, если liquidation distance или reserve floor ухудшатся.
```

### Формула должна быть weighted, но с hard floors

Нельзя, чтобы высокий резерв компенсировал критическое плечо. Нельзя, чтобы хорошая диверсификация компенсировала нулевую ликвидность.

Предлагаемое правило:

1. Сначала hard filters.
2. Потом sub-scores.
3. Потом weighted score.
4. Потом top driver explanation.

Hard filters:

1. reserve below absolute floor;
2. futures above cap;
3. leverage above allowed limit;
4. asset quality block;
5. liquidity exit block;
6. scenario -50% destroys reserve/structure;
7. trade violates per-asset or class limit.

## Часть 9. Уникальная философия проекта

### Чем проект отличается от Bloomberg, TradingView и обычного portfolio tracker

1. Он не пытается быть терминалом рынка.
2. Он пытается быть операционной системой инвестора.
3. Он не фетишизирует PnL.
4. Он считает резерв не «idle cash», а стратегической ликвидностью.
5. Он учитывает поведение инвестора как источник риска.
6. Он работает с рыночными циклами как вероятностной моделью, а не с сигналом «точно будет».
7. Он строится вокруг вопроса: можно ли продолжать стратегию после шока?

### Уникальные идеи

1. `Risk first. Discipline first. PnL second.`
2. Health как диагноз, а не как красота.
3. Резерв как инструмент спокойствия.
4. Pre-trade gate: разрешено/запрещено/максимальный размер/почему.
5. «Ничего не делать» как валидное решение.
6. Спекулятивный блок как изолированный risk sleeve.
7. Cycle-aware reserve and crypto exposure.
8. Инвестор как часть риск-модели.

### Уникальные термины, которые стоит закрепить

1. `Здоровье капитала`.
2. `Резервный слой`.
3. `Спекулятивная нагрузка`.
4. `Покупательская сила`.
5. `Дисциплинарный шлюз`.
6. `Сценарная устойчивость`.
7. `Фазовый лимит риска`.
8. `Ошибка системы`, а не просто «убыток».

### Что невозможно просто скопировать

Нельзя скопировать главную идентичность проекта без философии владельца: капитал как результат времени, труда и дисциплины; отказ от азарта; приоритет психологической устойчивости; готовность не действовать; жесткое разделение инвестиционного ядра и спекулятивного блока.

Другие продукты могут скопировать карточки, графики и score. Сложнее скопировать логику, где интерфейс не продает активность, а удерживает инвестора внутри собственной конституции.

## Часть 10. Критика текущей системы

### Что действительно полезно

1. Health не строится вокруг PnL.
2. Резерв и floor уже центральны.
3. Per-asset concentration уже стал ближе к манифесту.
4. Диверсификация исправлена: кэш и фьючерсы не воюют с классами.
5. Pre-trade gate - правильное направление продукта.
6. Alerts вынесены в единый источник для страницы сигналов и уведомлений.
7. Пустой аккаунт не рисуется как «критический риск» - это правильно.

### Что выглядит красиво, но может быть слабым

1. Один большой Health number может создавать ложное ощущение точности.
2. `+6`, `+5`, `+4` в рекомендациях выглядят точнее, чем фактическая модель влияния.
3. Radar/hexagon визуально сильный, но должен не конкурировать с главным действием.
4. Слово «волатильность» сейчас скрывает простой exposure cap.

### Что слишком сложно

1. Health, Risk Engine, Alerts, Signals и Pre-trade Gate частично повторяют одни и те же идеи разными словами.
2. Концентрация уже обновлена в health/gate, но alerts еще используют flat position limit.
3. Разные тексты описывают диверсификацию по-разному.

### Где есть ложная точность

1. Health `82/100` без confidence/data freshness.
2. Recommendation gain `+6`, если это не результат simulator delta.
3. Futures top-up до точной суммы, если сама идея «надо добить до 10%» не подтверждена как философская норма.
4. Any pseudo-quant volatility, если нет реальной волатильности, correlation или downside history.

### Где интерфейс может вводить в заблуждение

1. Если Health высокий, но asset quality ухудшается.
2. Если F&G показывает зону добора, но резерв/лимит запрещают сделку.
3. Если диверсификация по количеству активов воспринимается как защита, хотя все активы BTC-correlated.
4. Если «фьючерсный счет недофинансирован» воспринимается как необходимость увеличить риск.

### Где система слишком примитивна

1. Нет сценарного stress layer.
2. Нет behavior/discipline score.
3. Нет liquidity depth / exit capacity.
4. Нет phase-adjusted health score.
5. Нет asset quality gate в главном decision loop.
6. Нет explicit top risk driver.

### Где система уже похожа на настоящий инвестиционный инструмент

1. Разделение source of truth: Google Sheets/API как данные, frontend как отображение.
2. Pre-trade gate как дисциплинарный слой.
3. Per-asset limits внутри крипто-блока.
4. Резервный слой и deployable capital.
5. Фьючерсный risk control: margin, leverage, liquidation distance.
6. Health simulator, если он не превращается в game of score.

## Часть 11. Результат аудита

### 1. Главные проблемы: топ-10

1. Фьючерсы трактуются как target funding, хотя философски это cap.
2. Portfolio Health не имеет scenario resilience.
3. Behavior layer отсутствует как отдельная измеримая система.
4. Asset quality не встроен как filter/gate.
5. Market phase не модифицирует health limits.
6. Liquidity depth/exit capacity отсутствует.
7. Reserve/flexibility дублируются.
8. Alert logic местами отстает от per-asset concentration.
9. Risk Engine class limits не совпадают с манифестом/riskRules.
10. Score и recommendation gains могут выглядеть точнее, чем есть.

### 2. Что удалить

1. Фьючерсный underfunded penalty из основного Health, если 10% не утверждено как обязательная квота.
2. Отдельную top-level «Гибкость» как простой cashShare, если она не станет частью liquidity layer.
3. Flat 35% position alert как главный сигнал концентрации.
4. Формулировки, где market signal выглядит как разрешение сделки.
5. Любые декоративные компоненты score, которые не дают действия.

### 3. Что объединить

| Объединить | В новый блок | Почему |
|---|---|---|
| Reserve + Flexibility + Deployable | Liquidity & Reserve Health | Один слой ликвидности |
| Crypto exposure + class caps + allocation | Allocation Structure | Один слой структуры капитала |
| Futures share + leverage + liquidation + count | Speculative Risk | Один risk sleeve |
| F&G + cycle + psychology | Market Regime | Внешняя среда, не health |
| Price alerts + zones + cooldown | Opportunity/Signal Layer | Торговое внимание, не health |

### 4. Что добавить

1. Scenario Resilience:
   - BTC -20%;
   - BTC -40%;
   - market -60%;
   - altcoin -80%;
   - stable reserve after shock;
   - largest loss driver.
2. Investor Discipline:
   - cooldown violations;
   - trades against gate;
   - leverage increase after loss;
   - FOMO buys in greed;
   - averaging beyond planned risk.
3. Asset Quality Gate:
   - liquidity;
   - top-100;
   - ecosystem/reputation;
   - monitoring list;
   - thesis invalidation.
4. Phase-adjusted health:
   - reserve target/floor by phase;
   - crypto cap by phase;
   - risk reduction mode in euphoria.
5. Top Risk Driver:
   - one line: what currently hurts health most.
6. Decision Output:
   - allowed / blocked / reduce / watch / no action.

### 5. Что оставить как уникальную особенность

1. Health as diagnosis.
2. Reserve first.
3. Pre-trade gate.
4. Risk-first copywriting.
5. Anti-emotional UX.
6. Cycle-aware discipline.
7. Спекулятивный блок как изолированный risk sleeve.
8. Google Sheets as source of truth.

### 6. Идеальная модель Portfolio Health

```text
PORTFOLIO HEALTH

Score: 0-100
Status: CONTROL / WATCH / RISK / BLOCKED

1. Liquidity & Reserve Health
   - reserve vs phase floor
   - deployable capital
   - cash optionality
   - reserve after shock

2. Allocation Structure
   - class caps by phase
   - crypto exposure
   - metals/stocks caps
   - risk class balance

3. Concentration Risk
   - largest asset
   - per-asset crypto limits
   - altcoin slots
   - scenario concentration

4. Speculative Risk
   - futures margin cap
   - leverage
   - liquidation distance
   - position count
   - speculative sleeve isolation

5. Scenario Resilience
   - BTC -20/-40
   - market -60
   - alt -80
   - post-shock reserve
   - max single scenario damage

6. Data & Execution Safety
   - data freshness
   - source tags
   - API/sheet consistency
   - manual input risk

Separate:
Investor Discipline
Market Regime
Asset Quality Gate
Trade Signal Layer
```

### 7. Приоритеты

#### P0

1. Решить философский конфликт futures: cap vs target.
2. Добавить Scenario Resilience как отдельный health block.
3. Привести Risk Engine limits к манифесту/riskRules.
4. Синхронизировать alerts concentration с per-asset model.
5. Сделать reserve/class limits phase-aware в health.

#### P1

1. Добавить Investor Discipline score.
2. Добавить Asset Quality Gate.
3. Объединить reserve/flexibility в Liquidity & Reserve.
4. Переименовать «Сопротивление волатильности» в более точный термин или добавить actual downside/volatility.
5. Ввести top risk driver.

#### P2

1. Добавить confidence/data freshness badge.
2. Сделать recommendation gain расчетом из simulator delta.
3. Развести Market Regime panel и Health panel текстово и визуально.
4. Добавить history trend для Health components.

#### P3

1. Sharpe/Sortino/volatility metrics после появления надежной истории.
2. Correlation matrix после накопления данных.
3. Advanced macro dashboard.
4. More institutional analytics, только если они меняют действие.

## Финальная задача. Как должен мыслить Кабинет Инвестора о здоровье капитала

Кабинет Инвестора должен мыслить не так:

> Сколько я заработал и где следующий сигнал?

А так:

> Сохраняет ли моя система способность пережить плохой сценарий, использовать хороший сценарий и не разрушиться из-за моего поведения?

Здоровье капитала - это не сумма красивых показателей. Это способность:

1. сохранить ликвидность;
2. выдержать просадку;
3. не нарушить лимиты;
4. не стать заложником одного актива/сценария;
5. использовать страх рынка без паники;
6. снизить риск в эйфории;
7. не превратить спекуляцию в ядро;
8. соблюдать собственную конституцию;
9. признать ошибку до того, как она разрушит систему.

### 5-10 вещей, которые CIO хотел бы видеть каждое утро

1. `Можно ли сегодня добавлять риск?`
   - Ответ: yes/no/caution.
   - Причина: reserve, limits, phase, scenario.

2. `Что сейчас главный риск портфеля?`
   - Один driver, не список из 20 метрик.

3. `Что будет при BTC -40% и market -60%?`
   - Потеря в $, потеря в %, reserve after shock, лимит нарушен/нет.

4. `Сколько капитала реально можно пустить в работу?`
   - Spot deployable, futures cap remaining, reserve floor preserved.

5. `Какие действия запрещены?`
   - Конкретно: не добирать TON, не увеличивать фьючи, не тратить резерв ниже floor.

6. `Какая фаза рынка и как она меняет лимиты?`
   - Фаза не как прогноз, а как risk modifier.

7. `Есть ли ухудшение дисциплины?`
   - Сделки против правил, cooldown, FOMO, увеличение плеча после убытка.

8. `Какие активы требуют review качества?`
   - Liquidity, thesis, monitoring list, ecosystem degradation.

9. `Есть ли возможность, которая прошла фильтры?`
   - Price/F&G signal + gate pass + max size.

10. `Что лучшее действие сегодня?`
    - Купить / ждать / снизить риск / пополнить резерв / ничего не делать.

## Итоговая формула

Профессиональный Portfolio Health для этого проекта должен быть не «100 метрик», а короткой системой принятия решений:

```text
Health = устойчивость структуры капитала
Regime = внешняя среда
Quality = можно ли держать/докупать актив
Signal = появилась ли возможность
Discipline = соблюдается ли стратегия

Decision = действие, размер, запрет или ожидание
```

Главное:

> Если показатель не защищает капитал, не улучшает распределение, не помогает найти возможность, не снижает ошибку и не усиливает дисциплину, он не должен попадать в ядро системы.

