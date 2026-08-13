# Investor Cabinet — мобильный API-контракт

Дата среза: 2026-08-12  
Scope: мобильная версия продукта / будущая PWA.  
Не меняет API, Google Sheets, Apps Script, desktop UI и Vercel config.

---

## 1. Вывод

Мобильный клиент должен читать только публичный frontend API:

- `GET /api/investor` — основной аккаунт.
- `GET /api/investor-wife` — аккаунт Полины.

Google Sheets остаётся source of truth. Мобильный клиент не знает структуру таблиц, формулы, Apps Script-вкладки и внутренние названия колонок.

---

## 2. Обязательные root-поля

Эти поля нужны mobile-клиенту для базового запуска:

| Поле | Тип | Правило |
| --- | --- | --- |
| `success` | `boolean` | `true` значит payload можно нормализовать. `false` переводит UI в error/stale. |
| `overview` | `object` | Главные цифры первого экрана. |
| `portfolio` | `array` | Список строк портфеля. Пустой массив допустим. |
| `risk` | `object` | Риск, резерв, deployable cash. |
| `updatedAt` | `string` | Время формирования ответа API. |

Допустимые endpoint-специфичные root-поля:

- main: `signals`, `investorDNA`, `assetQuality`, `progress`.
- wife: `_chain`.

Мобильный клиент не должен падать, если endpoint-специфичных полей нет.

---

## 3. Обязательные `overview` поля

| Поле | Тип | Единица |
| --- | --- | --- |
| `portfolioValue` | `number-like` | USD |
| `invested` | `number-like` | USD |
| `pnl` | `number-like` | USD |
| `pnlPct` | `number-like` | decimal fraction, не готовый процент |
| `reserve` | `number-like` | USD |
| `positionsCount` | `number-like` | количество |
| `state` | `string` | текстовый статус |
| `signal` | `string` | короткий сигнал |
| `action` | `string` | главное действие/рекомендация |

Важно: `pnlPct: -0.0004` отображается как `-0.04%`. Mobile не должен ожидать `-0.04`.

Legacy/secondary:

- `overview.health` может существовать, но не является главным Health Factor для V2/mobile.
- `investedLabel`, `pnlLabel`, `portfolioLabel` — presentation labels, mobile не должен строить логику на них.
- `bestPosition`, `worstPosition`, `categories`, `realizedPnl`, `realizedPnlPct` optional.

---

## 4. Обязательные `portfolio[]` поля

Каждая строка портфеля должна нормализоваться к:

| Поле | Тип | Правило |
| --- | --- | --- |
| `asset` | `string` | обязательный идентификатор строки |
| `category` | `string` | приводится к `Крипта`, `Металлы`, `Фьючерсы`, `Акции`, `Свободные деньги` |
| `quantity` | `number-like` | 0 допустим |
| `avgEntry` | `number-like` | 0 допустим |
| `currentPrice` | `number-like` | 0 допустим |
| `invested` | `number-like` | USD |
| `currentValue` | `number-like` | USD |
| `pnl` | `number-like` | USD |
| `pnlPct` | `number-like` | percent-style per-position value |
| `share` | `number-like` | percent-style per-position value |
| `status` | `string` | отображение/фильтры |

Optional:

- `ticker`
- `dataSource`

Mobile не должен хардкодить позиции и не должен пересчитывать `avgEntry` из продаж.

---

## 5. Обязательные `risk` поля

| Поле | Тип | Единица |
| --- | --- | --- |
| `portfolioValue` | `number-like` | USD |
| `reserve` | `number-like` | USD |
| `reserveShare` | `number-like` | decimal fraction |
| `deployableCash` | `number-like` | USD |
| `largestRiskAsset` | `string` | `-` допустимо |
| `largestRiskShare` | `number-like` | decimal fraction |
| `cryptoShare` | `number-like` | decimal fraction |
| `state` | `string` | risk state |
| `signal` | `string` | risk signal |
| `summary` | `string` | короткое объяснение |

Optional but important:

- `futuresDeployableCash`
- `spotDeployableCash`
- `health`

Если optional cash-поля отсутствуют, mobile использует нормализованные fallback-значения и не ломает экран.

---

## 6. Optional sections

Mobile обязан работать при отсутствии или пустом значении:

- `signals`
- `signals.interestList`
- `history`
- `transactions`
- `decisions`
- `scenarios`
- `investorDNA`
- `assetQuality`
- `progress`
- `fearGreedStrategy.lastBuy`
- `fearGreedStrategy.strategyBuys`
- `fearGreedStrategy.history`

Fallback-правило: отсутствие optional-блока не является ошибкой контракта, если `success`, `overview`, `portfolio`, `risk`, `updatedAt` доступны.

---

## 7. Статусы данных для mobile UI

Runtime-статусы клиента:

| Статус | Когда показывать |
| --- | --- |
| `initial-loading` | первый запуск, нет live/cache данных |
| `refreshing` | есть данные на экране, идёт обновление |
| `ready` | свежий live API ответ принят |
| `stale` | live обновление не удалось, показываем прошлое состояние |
| `error` | нет пригодных данных для доверительного отображения |

Источники данных:

| Source | Значение |
| --- | --- |
| `live` | данные пришли из API |
| `cache` | последнее локально сохранённое состояние |
| `fallback` | встроенный fallback, не финансовая правда |

Mobile indicator должен выводить:

- статус;
- source;
- `lastLoadedAt`;
- активный аккаунт `main` или `wife`;
- понятный цвет: зелёный live, синий refreshing/cache, жёлтый stale, красный error.

Mobile adapter:

- `src/v2/lib/mobileApiContract.ts` — строгий контрактный валидатор, не заменяет текущий web fallback-валидатор.
- `src/v2/lib/mobileInvestorData.ts` — отдельный mobile data layer: `validate -> normalize PortfolioState -> build V2 mobile data -> data trust status`.
- Desktop runtime не импортирует этот слой.

---

## 8. Текущий sanitized live shape

Срез production API от 2026-08-12, без raw-значений портфеля:

| Endpoint | Root sections | Portfolio rows | History rows | Transactions rows |
| --- | --- | ---: | ---: | ---: |
| `/api/investor` | `assetQuality`, `decisions`, `fearGreedStrategy`, `history`, `investorDNA`, `overview`, `patch`, `portfolio`, `progress`, `risk`, `scenarios`, `signals`, `success`, `transactions`, `updatedAt` | 14 | 46 | 133 |
| `/api/investor-wife` | `_chain`, `decisions`, `fearGreedStrategy`, `history`, `overview`, `patch`, `portfolio`, `risk`, `scenarios`, `success`, `transactions`, `updatedAt` | 7 | 9 | 78 |

Разница main/wife ожидаемая:

- wife может не иметь `signals`, `investorDNA`, `assetQuality`, `progress`;
- wife может иметь `_chain`;
- wife `decisions` и `scenarios` могут быть пустыми массивами.

---

## 9. Критерий готовности Sprint 1

Sprint 1 закрыт, когда:

1. mobile contract описан в документации;
2. `validateMobileInvestorApiPayload` проверяет строгий mobile-core contract отдельно от мягкого web fallback-валидатора;
3. contract tests проходят локально;
4. main/wife payloads не смешиваются;
5. пустые optional-блоки не ломают нормализацию;
6. desktop UI и API contract не изменены runtime-патчем.
