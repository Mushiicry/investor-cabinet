# TON WALLET IMPORT

Status: Stage 2 sheet structure created, event importer prepared  
Scope: public read-only TON wallet transaction and event import  
Primary wallets:
- `UQALTg4Pc2kWGwMY2cxv4-gSi-pmVOnvKjgK81oyb1vUhKMp`
- `UQD-JmUdBLDBlBvOzid3UBMs8A5Tk-E7ikV17NJ0IR8VccUj`

Investor Cabinet may read public blockchain transactions from this address. It must never request, store or transmit a seed phrase, private key, wallet password or signing permission.

---

# Goal

Create a safe import path:

TON public wallet address  
-> TON indexed event API  
-> Apps Script read-only fetch  
-> `Транзакции_IMPORT` pending rows  
-> `TON_WALLET_BALANCES` current wallet snapshot  
-> manual review  
-> `Транзакции` source-of-truth rows  
-> Sheets calculations  
-> `/api/investor`  
-> frontend

The importer is an accounting helper, not a trading tool.

---

# Current Implementation

Spreadsheet:

`Кабинет инвестора`

URL:

`https://docs.google.com/spreadsheets/d/1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8/edit`

Created sheets:

| Sheet | Sheet ID | Status |
| --- | --- | --- |
| `TON_WALLETS` | `182700001` | created |
| `Транзакции_IMPORT` | `182700002` | created |
| `TON_WALLET_BALANCES` | auto-created by Apps Script | prepared |

Wallet config:

- Wallet ID: `tonkeeper-main`;
- Chain: `TON`;
- Status: `ACTIVE`;
- Import mode: `PENDING_REVIEW`;
- Allowed assets: `TON,USDT,USDC`.
- Wallet ID: `tonkeeper-staking-main`;
- Chain: `TON`;
- Status: `ACTIVE`;
- Import mode: `PENDING_REVIEW`;
- Allowed assets: `TON,USDT,USDC,stTON,tsTON`.

Initial pending row:

- `MANUAL:TON:2026-05-27:TON:30:1.891`;
- status `PENDING`;
- TON quantity `15.8646`;
- price `1.891`;
- amount `$30`.

Still not implemented:
- Apps Script read-only fetcher installation in the live Apps Script project;
- approval-copy flow into `Транзакции`;
- frontend import status display.

Prepared Apps Script module:

`apps-script/tonWalletImport.gs`

The module contains:
- `syncTonWalletImports()`;
- `syncTonWalletBalances()`;
- optional `installTonWalletImportTrigger()`;
- TonAPI event read-only fetch;
- TonAPI current balance snapshot for tracked TON wallets;
- event normalization for swaps, TON transfers, jetton transfers and staking-like events;
- dedupe by `TON:<address>:<event_id>:<lt>:<action_index>`;
- pending row append into `Транзакции_IMPORT`;
- current `TON` and `USDT` wallet balances into `TON_WALLET_BALANCES`;
- aggregate `TON` and `USDT` sync into `Расчеты`;
- wallet sync metadata update in `TON_WALLETS`.

Install checklist:

1. Open the existing Google Sheets Apps Script project.
2. Add a new script file named `tonWalletImport`.
3. Paste the contents of `apps-script/tonWalletImport.gs`.
4. Run `syncTonWalletImports()` manually once.
5. Confirm new rows appear only in `Транзакции_IMPORT`.
6. After manual verification, run `installInvestorCabinetWalletSyncTrigger()` once to schedule one 5-minute read-only sync for TON and Arbitrum together.

Optional script property:

`TONAPI_KEY`

If the key is absent, the importer uses the public TonAPI endpoint without an API key.

---

# External Source

Recommended API:

`GET https://tonapi.io/v2/accounts/{address}/events`

Required query fields:
- `address`: tracked TON address in the URL path;
- `limit`: max events per sync;
- `start_date`: optional lower time bound for first sync.

Recommended dedupe keys:
- event `event_id`;
- event/action `lt`;
- action index;
- tracked wallet address.

---

# Sheet Structure

## `TON_WALLETS`

Configuration sheet.

Columns:

| Column | Meaning |
| --- | --- |
| `Wallet ID` | Stable internal label, for example `tonkeeper-main` |
| `Chain` | `TON` |
| `Address` | Public TON wallet address |
| `Status` | `ACTIVE` / `PAUSED` |
| `Allowed Assets` | comma-separated allowlist, for example `TON,USDT,USDC` |
| `Import Mode` | `PENDING_REVIEW` |
| `Last Seen LT` | last imported logical time |
| `Last Sync At` | ISO timestamp |
| `Comment` | human-readable note |

Initial row:

| Wallet ID | Chain | Address | Status | Allowed Assets | Import Mode | Last Seen LT | Last Sync At | Comment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tonkeeper-main` | `TON` | `UQALTg4Pc2kWGwMY2cxv4-gSi-pmVOnvKjgK81oyb1vUhKMp` | `ACTIVE` | `TON,USDT,USDC` | `PENDING_REVIEW` |  |  | `Public read-only TON wallet import` |

## `Транзакции_IMPORT`

Pending import sheet. Apps Script writes here first.

Columns:

| Column | Meaning |
| --- | --- |
| `Import ID` | stable dedupe key: `TON:<address>:<hash>:<lt>` |
| `Status` | `PENDING` / `APPROVED` / `SKIPPED` |
| `Дата` | transaction date |
| `Актив` | `TON`, `USDT`, `USDC`, etc. |
| `Категория` | `Крипта` or `Кэш / Стейблы` |
| `Действие` | `Покупка`, `Продажа`, `Обмен`, `Перевод`, `Стейкинг`, `Резерв`, `Комиссия` |
| `Количество` | asset quantity |
| `Цена` | price used for accounting, if known |
| `Сумма` | accounting amount in USD, if known |
| `Комментарий` | source note |
| `Wallet ID` | source wallet config id |
| `Chain` | `TON` |
| `Hash` | transaction hash |
| `LT` | logical time |
| `Direction` | `IN` / `OUT` / `UNKNOWN` |
| `Counterparty` | other address if known |
| `Raw Asset` | raw asset symbol or contract |
| `Raw Amount` | raw blockchain amount |
| `Review Note` | manual reviewer note |

## `Транзакции`

The main transaction sheet remains the source of truth for portfolio calculations.

Only reviewed rows should be moved or copied into `Транзакции`.

## `TON_WALLET_BALANCES`

Current public wallet snapshot. Apps Script recreates this table on every sync.

Columns:

| Column | Meaning |
| --- | --- |
| `Wallet ID` | source wallet id from `TON_WALLETS` |
| `Chain` | `TON` |
| `Asset` | normalized portfolio asset, currently `TON`, `USDT`, `USDC` |
| `Balance Type` | `LIQUID`, `JETTON`, `STAKED` |
| `Quantity` | portfolio quantity; for staked TON tokens this is TON-equivalent |
| `Category` | portfolio category |
| `Source` | TonAPI account or jetton balance |
| `Last Sync At` | sync timestamp |
| `Raw Asset` | original token symbol, for example `stTON` or `tsTON` |
| `Raw Quantity` | raw wallet token amount before conversion |
| `Conversion Rate` | raw-to-portfolio conversion rate |
| `Conversion Note` | conversion explanation |

Portfolio sync:

- aggregate `TON` from liquid TON plus supported staked TON-like rows;
- convert supported staked TON tokens (`stTON`, `tsTON`) into TON-equivalent before writing to `Расчеты`;
- aggregate `USDT` from TON wallet jetton balances;
- write aggregates into `Расчеты`;
- preserve TON average entry when wallet quantity changes; `Вложено` follows `Количество * Средняя входа`;
- when a new swap cannot be fully priced from the TonAPI event, use wallet balance delta as a fallback:
  `USDT decrease` becomes added TON cost basis, and `TON-equivalent increase` becomes received quantity;
- `TON-equivalent decrease` plus `USDT increase` is treated as a TON sale: cost basis is reduced at the previous average entry and realized PnL is written into the protected audit note;
- when balance-delta fallback applies a swap, append a protected audit row to `Транзакции_IMPORT` with:
  `TON_BALANCE_DELTA:*`, `Покупка` or `Продажа`, TON quantity, implied USDT/TON price and stable amount;
- balance-delta audit rows are marked with `BALANCE_APPLIED` and must not be approved again, because their cost basis is already written into `Расчеты`;
- do not overwrite unrelated `USDC` reserves from other wallets.

Repair utility:

- `repairTonCostBasisFromTransactions()` rebuilds TON quantity, average entry and invested value from reviewed rows in `Транзакции`;
- use it once after a previous bad sale sync if `TON` average entry was already inflated by preserving old invested capital across a lower quantity.

Important:

- `tsTON` is not counted 1:1 as liquid TON.
- Current Stage 2 patch uses a manual Tonstakers conversion rate from the wallet screenshot:
  `31.37 tsTON ~= 35.03 TON`.
- Future improvement: fetch the staking pool exchange rate automatically or move it into a dedicated sheet setting.

---

# Import Rules

Safe default:

- write every detected wallet event/action to `Транзакции_IMPORT`;
- keep event rows as audit/review trail;
- auto-skip duplicated `Import ID`;
- auto-skip unknown assets unless manually allowed;
- mark spam, dust, airdrops and unknown jettons as `SKIPPED`;
- do not infer purchase price from wallet transfer alone unless the transaction clearly contains a swap with enough data;
- if price is unknown, leave `Цена` and `Сумма` blank for review.
- staking events should usually stay in `Транзакции_IMPORT` for audit and should not be copied into `Транзакции` as a sale.
- current wallet balance is taken from TonAPI balance snapshots, not by blindly summing every transfer row.

Manual confirmation:

- reviewer sets `Status` to `APPROVED`;
- reviewed row can then be copied into `Транзакции`;
- `Транзакции` should keep the current columns: `Дата`, `Актив`, `Категория`, `Действие`, `Количество`, `Цена`, `Сумма`, `Комментарий`.

---

# Current Manual Purchase

User-reported operation:

- Date: `2026-05-27`;
- Asset: `TON`;
- Action: `Покупка`;
- Amount USD: `30`;
- Price: `1.891`;
- Estimated quantity: `15.8646`.

Suggested reviewed transaction row:

| Дата | Актив | Категория | Действие | Количество | Цена | Сумма | Комментарий |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `27.05.2026` | `TON` | `Крипта` | `Покупка` | `15.8646` | `1.891` | `30` | `Manual TON purchase; wallet import target: tonkeeper-main` |

---

# Apps Script Sketch

This is guidance only. Patch the real Apps Script source when it is available.

```js
function syncTonWalletImports_() {
  const ss = SpreadsheetApp.getActive();
  const wallets = readTonWalletConfig_(ss);
  const importSheet = ss.getSheetByName('Транзакции_IMPORT');

  wallets
    .filter((wallet) => wallet.chain === 'TON' && wallet.status === 'ACTIVE')
    .forEach((wallet) => {
      const events = fetchTonEvents_(wallet.address, wallet.lastSeenLt);
      const rows = events
        .flatMap((event) => normalizeTonEvent_(wallet, event))
        .filter((row) => row && !hasImportId_(importSheet, row.importId));

      appendImportRows_(importSheet, rows);
      updateWalletSyncState_(ss, wallet, txs);
    });
}
```

Important:
- this script reads public blockchain data only;
- no wallet signing;
- no private keys;
- no seed phrases;
- no direct trade execution;
- no direct mutation of `Портфель`;
- first implementation should write pending rows only.

---

# Future Frontend

Frontend can later display:
- last wallet import sync time;
- pending import count;
- approved import count;
- skipped import count.

Frontend must not:
- fetch the wallet directly as portfolio truth;
- write to Google Sheets directly;
- treat unreviewed wallet transactions as confirmed accounting rows.

---

# Automatic Sync

Preferred Stage 2 setup:

1. Push Apps Script files with `clasp push`.
2. Run `syncInvestorCabinetWallets()` once to verify combined wallet sync.
3. Run `installInvestorCabinetWalletSyncTrigger()` once.

`installInvestorCabinetWalletSyncTrigger()` removes old individual wallet triggers and installs one 5-minute trigger for:

- `syncTonWalletImports()`;
- `syncArbitrumWalletBalances()`.

Standalone TON-only scheduling remains available through `installTonWalletImportTrigger()`, but the unified trigger is preferred to avoid duplicate syncs.
