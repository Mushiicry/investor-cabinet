# BTC → USDC через Bitcoin → Arbitrum, 28.09.2026

Статус: `PRODUCTION_VERIFIED`. Владелец явно разрешил интеграцию, production и будущий BTC-импорт 28.09.2026. Коррекция данных применена атомарно и проверена повторным чтением; код импорта объединён в main и опубликован в существующий main Apps Script deployment `@93`. Живой sync и повторные запуски проверены; выбранный address-only режим сохраняет ограничения HD discovery.

## Проверенные факты

- BTC tx: `45a1be5b9073d7b8749bd2a0867d5337ffbf0c3e7f776e1718525e70d86b9b4c`. Blockstream API подтвердил блок `969009`, время `2026-09-28T14:49:56Z` / 17:49:56 МСК, один input `62000` sat, outputs `30000` и `31719` sat, network fee `281` sat.
- Output `31719` sat находится на `bc1q39rzjxhdqyj8c5q599c6fh4g8ulv3g5l7w7z59`; адрес имеет один подтверждённый приход, расходов и mempool-операций при проверке нет. Остаток `0.00031719 BTC` согласуется с показанным пользователем балансом MetaMask `0.000317 BTC`.
- Скриншот MetaMask связывает отправку `0.0003 BTC` с получением `24.588692 USDC` в Arbitrum. Получение USDC независимо подтверждается строкой 197 таблицы. Arbitrum receipt отдельно не получен: прямой RPC ответил HTTP 403. Связь двух сторон обмена основана на подтверждённой операции MetaMask пользователя, а не на предположении по дельтам.
- В `Кабинет инвестора` (`1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8`) До коррекции `Расчеты!C9` было `0.00062`, `D9 = 56451.6129032258`, `E9 = C9*D9 = 35`.
- До коррекции `Транзакции_IMPORT!A197:S197` содержала `EVM_STABLE_FLOW:ARBITRUM:20260928T175329:ПОПОЛНЕНИЕ:USDC:24.588692`, `PENDING`, действие «Пополнение», сумму `24.58869199999998`, `BALANCE_APPLIED`. Production UI показывает эту строку как «Пополнение USDC», 17:53. USDC уже начислены в «Расчеты».
- Общий main-синхронизатор `walletSync.gs` не обслуживает Bitcoin. Arbitrum-код классифицирует непарный приход USDC как пополнение. BTC-код внутри `IC_WIFE_API` обслуживает другой аккаунт и другой адрес; подключать его к main нельзя.
- `clasp list-deployments` подтвердил существующий main deployment `@90`; read-only clone именно версии 90 совпал с локальными `walletSync`, `arbitrumWalletImport`, `walletLedger` и `Код`. Отсутствие main Bitcoin sync подтверждено опубликованным кодом, а не только текущей веткой.

## Применённая коррекция

Атомарный batch изменил только `Расчеты!C9` и существующую строку `Транзакции_IMPORT!A197:S197`. Перед записью повторно проверены Import ID, hash, quantity BTC, avgEntry, формула `E9` и отсутствие другой записи по этому hash. После записи повторно прочитаны C9:E9 и A197:S197: BTC = 0.00031719, avgEntry и формула сохранены, полный hash в M197, proceeds = 24.588692. USDC = 312.6761159999999 сохранены. Повторное применение не требуется.

| Область | Результат |
| --- | --- |
| `Расчеты!C9` | `0.00031719 BTC` = `0.00062 - 0.0003 - 0.00000281` |
| `Расчеты!D9:E9` | Сохраняются avgEntry и формула; оставшийся cost basis `17.90588709677419 USD` |
| Строка 197 | «Продажа BTC», `0.0003 BTC`, proceeds `24.588692 USD`, effective exit `81962.30666666667 USD/BTC` |
| `Hash` / `LT` | Полный BTC hash в M197, N197 пуст |
| Chain / Wallet ID | Сохранить `ARBITRUM` / `metamask-arbitrum-main` как сторону получения; Bitcoin → Arbitrum явно указать в raw pair и комментарии |
| Review Note | `BALANCE_APPLIED`, sold cost basis `16.93548387096774`, realizedPnL `7.65320812903226`, fee `0.00000281 BTC` |
| USDC | Не начислять повторно и не менять текущий баланс |

`realizedPnL` строки продажи следует текущему контракту: proceeds минус cost basis проданных `0.0003 BTC`. Комиссия отдельно отражена в note: её списанная себестоимость `0.1586290322580645 USD`, результат после этой себестоимости `7.494579096774196 USD`. Оставшийся BTC учитывает комиссию. Новое правило расчёта PnL, отдельная комиссия-строка и изменения блока закрытых позиций O:U в этот scope не входят.

Сохранить validations и форматирование, `PENDING` и маркер `BALANCE_APPLIED`, блокирующий повторное одобрение. Снимки истории не переписывать. Для времени использовать 17:49:56 МСК в note по существующему timestamp-контракту и проверить итоговую дату через API/UI.

## Проверка и ограничения

До записи: прочитаны metadata, исходные клетки с formulas/validations, баланс и транзакция Blockstream, production UI. Локальный dry-run подготовленного batch прошёл: сохранение satoshi и cost basis, точные диапазоны, API asset/quantity/hash/date, `BALANCE_APPLIED` guard, PnL из `calculateTransactionRealizedPnl()`. `npm test -- --run test/contracts/transactionRealizedPnl.test.ts test/contracts/walletTransferCostBasis.test.ts`: 2 файла, 6 tests PASS. `git diff --check` PASS. Это проверка плана, не применение и не production acceptance.

Запись и readback завершены. Проверка production API/UI после публикации импорта фиксируется ниже.

## Будущий импорт native BTC

`apps-script/bitcoinWalletImport.gs` подключён к существующему `syncInvestorCabinetWallets` (trigger каждые 5 минут, BTC cooldown 15 минут). Новые зависимости, публичные API-ключи и frontend-контракты не добавляются. `BTC_WALLETS` хранит один основной кошелёк: указанный владельцем receiving address и подтверждённую сдачу. `BTC_WALLET_BALANCES` показывает подтверждённый баланс именно этого набора, статус и время проверки.

Источник: [Blockstream Esplora API](https://github.com/Blockstream/esplora/blob/master/API.md), fallback `mempool.space/api`. Суммы проверяются как целые satoshi; данные одного прохода читаются у одного provider, контролируются tip и checkpoint/reorg. История пагинируется по 25 операций, объединяется по hash и сортируется с учётом зависимых транзакций. Mempool не изменяет quantity. Первичный baseline разрешён только при точном совпадении существующего BTC-учёта с подтверждённым балансом; старые пополнения и восстановленная продажа повторно не применяются.

Входящий перевод увеличивает BTC, сохраняет прежний invested capital и не выдумывает USD purchase price/PnL. Перемещение между подтверждёнными собственными адресами списывает только network fee. Все операции получают реальные hash в M и `BITCOIN` в Chain. Неизвестные исходящие outputs, смешанные inputs, расхождение баланса или ручное изменение учёта сохраняют `Расчеты` и создают `PENDING / BTC_REVIEW` со списком outputs; статус снимка — `NEEDS_ADDRESS_REVIEW`. Непарные USDC-приходы не считаются доказательством BTC-продажи.

Перезапуск после частичной записи восстанавливает durable pending plan из Script Properties: проверяет before/after позицию, не дублирует hash, обновляет quantity и avgEntry одним range write, flush и checkpoint выполняются до удаления pending plan. Ошибка API не превращается в нулевой BTC-баланс. E9 и остальные формулы не меняются.

### Ограничение выбранного владельцем режима

Пользователь выбрал импорт по адресу вместо public descriptor. Согласно [MetaMask Bitcoin wallet](https://support.metamask.io/configure/networks/bitcoin/), кошелёк использует Native SegWit; исходный receiving address не раскрывает все будущие HD-адреса. Текущая сдача добавлена по подтверждённой операции пользователя. При новой неизвестной сдаче нужна проверка принадлежности адреса; вывод/продажа и её USD-результат не могут быть достоверно определены только по исходному адресу.

После ручной проверки спорной операции владелец добавляет подтверждённые собственные адреса в `BTC_WALLETS`, сверяет продажи/комиссии и quantity в `Расчеты`, затем снимает старый checkpoint `IC_BTC_IMPORT_STATE` только для нового baseline. Повторное первичное чтение должно точно совпасть с исправленным учётом; pending plan `IC_BTC_PENDING_APPLY` нельзя удалять без разбора незавершённой записи. Это процедура ручной сверки, не автоматическое угадывание сдачи. Полный автоматический wallet discovery требует public descriptor/xpub и не входит в выбранный режим.

### Локальная верификация

- `npm test`: 58 файлов, 431 tests PASS, включая 19 новых BTC-сценариев.
- `npm run lint`: PASS.
- `npm run build`: PASS, существующее предупреждение о frontend chunk >500 kB; frontend не менялся.
- `git diff --check`: PASS.
- Проверены baseline без повторной продажи/USDC, точная комиссия, входящий transfer cost basis, неизвестная сдача, смешанные inputs, whole-batch hold, mempool, pagination, hash dedup, reorg, fallback API, повреждённые API-данные и outage, interrupted write до/после quantity, конфликт ручного учёта и сохранение остальных сетевых sync steps. Два дополнительных сценария проверяют восстановление setup после timeout: пустой лист и существующий snapshot под пустыми заголовками.

### Production acceptance

- Code commits: `464e1b0` (import + integration), `ab54a04` и `5233c25` (восстановление прерванного Google Sheets setup). Перед первой публикацией новый read-only `clasp pull` совпал с baseline `302751e` по всем 20 исходным Apps Script файлам: чужого remote drift не было.
- Apps Script main deployment `AKfycbwBtbI9LmbZGyr4gi35oXym56i1py5J_oy0shp_gDotJBmsRnG2UmVVvmPFBigoE3uLeA` опубликован как `@93`, URL сохранён. HEAD также обновлён, поэтому существующий time trigger видит новый импорт.
- В Apps Script UI подтверждён существующий `syncInvestorCabinetWallets` trigger **раз в 5 минут**. Новых trigger не создано. BTC самостоятельно соблюдает 15-minute cooldown.
- Первый ручной run 18:58:01–18:58:12 завершился Google Sheets timeout при setup. Подтверждён частичный результат: BTC config записан, balance tab создан пустым. Следующий unified trigger 18:58:25 записал успешный snapshot под пустым header. Восстановление исправлено и покрыто двумя tests: теперь проверяется сам header, сохраняется существующий snapshot; ошибка уведомления не маскирует исходное исключение.
- Повторные ручные `syncBitcoinWalletImports` в Apps Script UI: 19:00:39–19:00:42 и 19:03:39–19:03:41, оба **Выполнение завершено**. Execution API через `clasp run` не разрешил вызов; запуск проведён через существующий owner UI без изменения permissions.
- Финальный Sheet readback: `BTC_WALLETS` содержит ровно main receiving + подтверждённую сдачу; `BTC_WALLET_BALANCES!A1:G2` имеет правильные headers, quantity `0.00031719`, `READY`, block `969020`, last successful sync 18:58:30 МСК. Повторные запуски в cooldown snapshot и количество не меняют. `Транзакции_IMPORT!M2:M200` содержит исходный BTC hash ровно **один раз**.
- `Расчеты!C9:E9`: `0.00031719`, `56451.6129032258`, `17.905887096774194`. USDC C13: `312.6761159999999`; повторного начисления нет. Сохранены исходные формулы.
- Production `/exec?accountId=main`: `success:true`, portfolio BTC quantity `0.00031719`, invested `17.91`; единственная BTC sale transaction quantity `0.0003`, amount `24.588692`, full hash, date `2026-09-28T14:49:56Z`, realizedPnL note `7.6532081290322616`.
- Production UI: «Продажа BTC» 28.09.26 17:49, `0.0003`, `24.59 $`, `+7.65 $`, полный hash в title. В портфеле BTC invested `17.9 $`, value около `26.4 $` (рыночная цена меняется). При проверке также наблюдались отдельные API timeouts; успешный прямой production API read получен после них.
- Vercel auto deployment после первого main push `464e1b0` подтверждён через GitHub deployment `6714436493`, status `success`, environment `Production`; frontend source не менялся.

Новых live BTC-операций после baseline пока нет: реальное последующее пополнение/вывод не воспроизводилось переводом денег. Будущие сценарии проверены контракт-тестами, текущий production baseline — живыми Sheet/API/UI чтениями. Unknown change/output и классификация следующего cross-chain swap остаются ручной проверкой в выбранном address-only режиме.

### Rollback

Версия web app до работы — `@90`; при откате требуется также вернуть Apps Script HEAD к `302751e` (`clasp push` из отдельного проверенного checkout), потому что trigger исполняет HEAD. Затем redeploy того же deployment ID на `@90`. Для временной остановки только BTC importer можно изменить его `BTC_WALLETS` Status на `INACTIVE`; остальные сети продолжат работу. Pending plan нельзя удалять без сверки незавершённой записи. Восстановленная продажа и корректный BTC-баланс остаются валидными и отдельного отката данных не требуют. Не удалять пользовательские табы/операции ради rollback.


