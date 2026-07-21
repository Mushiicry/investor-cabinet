# Stage 0 Audit: Risk & Portfolio Health

Дата: 2026-07-21  
Статус: read-only audit  
Scope: API/Sheets contract, current Health model, Risk rules, Pre-Trade Gate, data gaps before HealthFactorV2.

## 0. Вывод

Этап 0 подтверждает: в проекте уже есть сильная risk-first база, но текущая модель еще не соответствует новому manifesto полностью.

Главное:

1. Health Factor уже считается чистой функцией `computePortfolioHealth`.
2. Центральный радар уже существует и получает 6 компонентов.
3. Pre-Trade Gate уже существует как дисциплинарный шлюз спот-добора.
4. Risk rules уже имеют ключевые лимиты: резерв, крипта, акции, металлы, фьючерсы, single asset.
5. Frontend уже частично достраивает risk state из portfolio fallback-расчетов.
6. Основной конфликт: фьючерсный блок все еще трактует 10% как target funding, а не hard cap.
7. Survival Engine отсутствует.
8. Decision Engine отсутствует как отдельный слой.
9. Forbidden Tokens Gate отсутствует.
10. Behavior Engine и Trade Journal для активной торговли отсутствуют.

Следующий безопасный шаг: не UI и не Sheets, а `HealthFactorV2` schema + pure calculation plan.

## 1. Что уже есть

### 1.1 Source of truth

Текущая позиция проекта:

1. Google Sheets / API остаются источником фактов.
2. Frontend может выводить fallback-значения, но не должен становиться источником портфельной истины.
3. Legacy `deployableCash` нельзя использовать как fallback для futures bucket.
4. Risk layer важнее PnL layer.

Зафиксировано в:

1. `docs/DATA_SOURCE_OF_TRUTH.md`;
2. `docs/sheets/API_CONTRACT.md`;
3. `docs/ACCOUNTING_RULES.md`.

### 1.2 Текущий API risk contract

Frontend ожидает `risk`:

```ts
{
  portfolioValue: number;
  health: number;
  reserve: number;
  reserveShare: number;
  deployableCash: number;
  futuresDeployableCash: number;
  spotDeployableCash: number;
  largestRiskAsset: string;
  largestRiskShare: number;
  cryptoShare: number;
  stocksShare: number;
  metalsShare: number;
  futuresShare: number;
  cashShare: number;
  state: string;
  signal: string;
  summary: string;
}
```

Важно:

1. `overview.health` и `risk.health` - score `0..100`.
2. `risk.*Share` поля из API могут приходить как прямые проценты.
3. Frontend нормализует share-поля там, где нужен ratio `0..1`.
4. API contract не содержит survival, decision, forbidden token, behavior или trade journal fields.

### 1.3 Текущие risk constants

Есть:

```ts
RESERVE_TARGET_SHARE = 0.3;
RESERVE_FLOOR_SHARE = 0.1;
SPOT_RESERVE_FLOOR_SHARE = 0.3;
MAX_CRYPTO_EXPOSURE_SHARE = 0.6;
MAX_STOCKS_EXPOSURE_SHARE = 0.1;
MAX_METALS_EXPOSURE_SHARE = 0.1;
MAX_FUTURES_EXPOSURE_SHARE = 0.1;
MAX_SINGLE_RISK_ASSET_SHARE = 0.35;
RESERVE_BAND_MAX_SHARE = 0.6;
```

Вывод:

1. Базовые лимиты уже есть.
2. 10% futures cap уже есть как constant.
3. Нужно изменить интерпретацию в Health, а не изобретать новый лимит.

### 1.4 Текущая Health model

Текущие компоненты:

```ts
reserve
crypto
futures
concentration
diversification
flexibility
```

Текущая функция:

```ts
computePortfolioHealth(input: HealthInput): PortfolioHealth
```

Текущий output:

```ts
{
  healthFactor: number;
  status: "CONTROL" | "BALANCED" | "RISK";
  riskLevel: string;
  components: HealthComponent[];
}
```

Сильные стороны:

1. Health считается чистой функцией.
2. Компоненты имеют score, weight, meta.
3. Резерв уже считается коридором, а не принципом «чем больше кэша, тем лучше».
4. Концентрация уже умеет использовать per-asset модель через `assetConcentration`.
5. Фьючерсы уже учитывают плечо, число позиций и ликвидационную дистанцию.
6. Есть Health Simulator поверх реального `computePortfolioHealth`.

Слабые стороны:

1. Лучи не соответствуют manifesto v2.
2. `crypto` фактически является exposure/volatility proxy, а не отдельным survival-фактором.
3. `flexibility` дублирует reserve/liquidity layer.
4. `diversification` и `concentration` частично пересекаются.
5. `futures` все еще содержит target funding логику.
6. Нет отдельного `Scenario Survival`.
7. Нет отдельного `Discipline Integrity`.

### 1.5 Текущий конфликт futures logic

Сейчас в `computePortfolioHealth`:

```ts
fundingRatio = futuresShare / MAX_FUTURES_EXPOSURE_SHARE
underfunded = max(0, 1 - fundingRatio)
overfunded = max(0, fundingRatio - 1)
marginPenalty = underfunded * 25 + overfunded * 50
```

Проблема:

1. `underfunded` снимает баллы за то, что trading sleeve меньше 10%.
2. По manifesto 10% - hard cap, а не target.
3. Health не должен стимулировать пополнять фьючерсный счет до 10%.

Новая логика должна быть:

```ts
used = futuresRiskBudgetUsed
cap = totalDeposit * 0.1
remaining = max(0, cap - used)
breach = used > cap
```

Health должен штрафовать:

1. breach выше 10%;
2. excessive leverage;
3. liquidation pressure;
4. too many active futures positions;
5. increasing risk after loss, когда появится Behavior Engine.

Health не должен штрафовать:

1. unused futures budget;
2. low trading sleeve;
3. отсутствие желания добить фьючерсы до 10%.

### 1.6 Текущий Pre-Trade Gate

Уже есть:

1. `evaluateTrade(input, ctx)`;
2. spot add gate;
3. reserve floor check;
4. phase floor check;
5. position limit check;
6. class limit check;
7. Fear & Greed note;
8. `maxSafeAmount`;
9. `maxAllowedAmount`;
10. status `idle / ok / caution / block`.

Текущий `TradeInput`:

```ts
{
  asset: string;
  amountUsd: number;
  category?: string;
}
```

Чего нет:

1. buy price / limit price;
2. current quantity;
3. current avg entry;
4. current cost basis;
5. new quantity;
6. new avg entry;
7. Health before/after;
8. Survival after buy;
9. forbidden token check;
10. behavior/cooldown hard blockers.

Вывод:

Pre-Trade Gate уже правильное место для развития. Его не нужно выбрасывать. Его нужно расширять до `Pre-Trade Engine`.

### 1.7 Текущая concentration model

Уже есть:

1. crypto per-asset limits;
2. ETH 35%;
3. BTC 20%;
4. SOL / TON / BNB 10%;
5. other altcoins 5%;
6. max 3 altcoin slots;
7. non-crypto single asset limit 35%;
8. `assetConcentration`;
9. `overLimitAssets`.

Вывод:

Это сильная часть системы. Ее нужно переиспользовать в HealthFactorV2, Decision Engine и Pre-Trade Engine.

## 2. Чего сейчас нет

### 2.1 Нет Survival Engine

Отсутствуют поля и расчеты:

1. BTC -20%;
2. BTC -40%;
3. market -60%;
4. altcoin -80%;
5. reserve after shock;
6. loss in USD;
7. loss in %;
8. largest shock driver;
9. post-shock breached limits;
10. `SURVIVES / CAUTION / DOES_NOT_SURVIVE`.

### 2.2 Нет Decision Engine

Нет отдельного output:

```ts
ALLOW
ALLOW_WITH_LIMIT
CAUTION
BLOCK
WAIT
REDUCE_RISK
```

Нет:

1. `hardBlockReasons`;
2. `warnings`;
3. `maxAllowedBuyUsd`;
4. `recommendedAction`;
5. `decisionConfidence`;
6. `healthBefore`;
7. `healthAfter`;
8. `survivalBefore`;
9. `survivalAfter`.

### 2.3 Нет Forbidden Tokens Gate

Не найдено:

1. CoinMarketCap Top-100 field;
2. Binance Monitoring Tag field;
3. forbidden token list;
4. hard block reason для forbidden assets;
5. API/Sheets source для forbidden status.

Важно:

Нельзя хардкодить forbidden list во frontend.

### 2.4 Нет Pre-Trade buy price / averaging

Сейчас Gate принимает сумму, но не принимает цену покупки.

Не хватает:

1. `buyPrice`;
2. `currentQty`;
3. `currentAvgEntry`;
4. `currentCostBasis`;
5. `newBuyQty`;
6. `newAvgEntry`;
7. `avgEntryDelta`;
8. `postBuyAssetShare`;
9. `postBuyClassShare`;
10. `postBuyRiskBudget`.

### 2.5 Нет Trade Journal для активной торговли

Есть reports/journal UI в отчетах, но это не active trading journal из manifesto.

Не хватает:

1. trade ticket;
2. setup tag;
3. screenshot;
4. emotion tag;
5. R result;
6. decision quality;
7. Health before/after snapshot;
8. rule violation;
9. behavior feedback.

### 2.6 Нет Behavior Engine

Не найдено:

1. 3 losses cooldown;
2. daily max trades;
3. daily max drawdown;
4. no leverage increase after loss;
5. revenge trading marker;
6. FOMO marker;
7. panic sell marker;
8. discipline score;
9. discipline impact on Health.

Есть только Fear & Greed cooldown для DCA rules. Это не Behavior Engine.

## 3. Что можно сделать без изменения API/Sheets

Можно сделать в frontend pure-calculation layer:

1. HealthFactorV2 schema draft.
2. Пересборку названий и смысла health components.
3. Удаление futures underfunded penalty.
4. Cap-control futures scoring.
5. Basic scenario survival на основе текущих category shares.
6. Health before/after для planned spot buy.
7. Buy price + averaging calculator, если текущие `quantity`, `avgEntry`, `invested` уже есть в portfolio state.
8. Decision Engine v1 без forbidden external data.

Ограничение:

Без API/Sheets нельзя честно реализовать:

1. authoritative forbidden token lists;
2. Binance Monitoring Tag;
3. CoinMarketCap Top-100 freshness;
4. persistent Trade Journal;
5. persistent Behavior Engine;
6. reliable daily drawdown/trading limits;
7. historical decision quality.

## 4. Что потребует отдельного согласования

### 4.1 Google Sheets / API

Потребуют согласования:

1. источник forbidden token status;
2. добавление `assetQuality` fields;
3. добавление trade journal tab / fields;
4. добавление behavior fields;
5. добавление daily limits;
6. добавление decision snapshots;
7. добавление survival outputs в API, если решим считать на backend/Apps Script.

### 4.2 UI

Потребуют отдельного UI scope:

1. переименование лучей радара;
2. изменение Health Hexagon labels;
3. добавление survival block;
4. добавление Decision result block;
5. расширение Gate form;
6. добавление Trade Journal screen;
7. добавление Behavior status.

### 4.3 Accounting

Потребуют проверки:

1. averaging calculator;
2. current cost basis source;
3. partial SELL behavior;
4. realizedPnL source;
5. SWAP decomposition;
6. futures invested basis.

## 5. HealthFactorV2 schema proposal

### 5.1 Component keys

```ts
type HealthV2ComponentKey =
  | "liquidityReserve"
  | "allocationStructure"
  | "concentrationRisk"
  | "speculativeRisk"
  | "scenarioSurvival"
  | "disciplineIntegrity";
```

### 5.2 Component output

```ts
type HealthV2Component = {
  key: HealthV2ComponentKey;
  label: string;
  score: number;      // 0..100
  weight: number;
  status: "ok" | "watch" | "risk" | "blocked";
  driver: string;
  action: string;
  blockers: string[];
  meta: Record<string, unknown>;
};
```

### 5.3 Health output

```ts
type PortfolioHealthV2 = {
  healthFactor: number;
  status: "CONTROL" | "WATCH" | "RISK" | "BLOCKED";
  topRiskDriver: string;
  allowedActions: string[];
  blockedActions: string[];
  components: HealthV2Component[];
};
```

### 5.4 Health input

```ts
type HealthV2Input = {
  portfolioValue: number;
  investedCapital: number;
  reserveUsd: number;
  reserveShare: number;
  spotDeployableCash: number;
  futuresDeployableCash: number;
  categoryShares: {
    crypto: number;
    stocks: number;
    metals: number;
    futures: number;
    cash: number;
  };
  concentration: AssetConcentration;
  speculative: {
    usedUsd: number;
    capUsd: number;
    remainingUsd: number;
    breachUsd: number;
    futuresShare: number;
    futuresCount: number;
    worstLeverage?: number;
    worstLeverageAsset?: string;
    worstLiquidationDistance?: number;
  };
  scenario?: ScenarioSurvivalResult;
  discipline?: DisciplineState;
};
```

### 5.5 Speculative Risk v2

Новая логика:

```ts
capUsd = investedCapital * 0.1
usedUsd = futuresMarginUsed + freeFuturesMargin
remainingUsd = max(0, capUsd - usedUsd)
breachUsd = max(0, usedUsd - capUsd)
```

Score должен ухудшаться от:

1. `breachUsd > 0`;
2. leverage breach;
3. liquidation distance too close;
4. too many positions;
5. behavior violations, когда появится Behavior Engine.

Score не должен ухудшаться от:

1. `remainingUsd > 0`;
2. `usedUsd < capUsd`;
3. отсутствия фьючерсных позиций.

## 6. Stage 1 recommended scope

Первый code scope должен быть маленьким:

1. добавить types для `HealthFactorV2`;
2. добавить pure helper для speculative cap-control;
3. убрать underfunded futures penalty;
4. не менять UI labels сразу;
5. не менять API;
6. не менять Sheets;
7. покрыть расчет unit tests или lightweight test script;
8. проверить, что build/lint проходят.

Не включать в первый code scope:

1. forbidden tokens;
2. buy price;
3. averaging calculator;
4. trade journal;
5. behavior engine;
6. UI redesign.

## 7. Stage 0 decision

Этап 0 можно считать завершенным, если принимаем следующие решения:

1. HealthFactorV2 строится поверх текущего `computePortfolioHealth`, но с новой schema.
2. 10% active trading block переводится в cap-control.
3. Survival Engine v1 можно считать frontend pure calculation до изменения API.
4. Forbidden tokens требуют отдельного data-source решения.
5. Trade Journal и Behavior Engine требуют отдельного persistent data-source решения.
6. UI меняется только после готовности расчетной модели.

## 8. Следующий шаг

Следующий шаг после Stage 0:

```text
Stage 1A:
Speculative Risk cap-control patch
```

Scope Stage 1A:

1. заменить `underfunded` penalty на cap-control;
2. сохранить leverage/count/liquidation scoring;
3. переименовать futures meta с target/top-up на cap/used/remaining/breach;
4. не менять UI визуально, кроме текста, если он прямо говорит про target funding;
5. проверить build/lint.

Это самый безопасный первый code patch, потому что он исправляет главный философский конфликт без изменения API/Sheets.
