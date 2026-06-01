# EVM WALLET IMPORT

Status: Stage 2 Arbitrum balance sync prepared  
Scope: public read-only Arbitrum wallet balance tracking  
Primary wallet:
- `0xFEc18D4474826afd65d578ff931F4ff2926ee0c3`

Investor Cabinet may read public blockchain balances from this address. It must never request, store or transmit a seed phrase, private key, wallet password or signing permission.

---

# Goal

Create a safe import path:

Arbitrum public wallet address  
-> Arbitrum public RPC  
-> Apps Script read-only fetch  
-> `EVM_WALLET_BALANCES` current wallet snapshot  
-> balance-delta audit rows in `Транзакции_IMPORT`  
-> Sheets calculations  
-> `/api/investor`  
-> frontend

The importer is an accounting helper, not a trading tool.

---

# Current Implementation

Prepared Apps Script module:

`apps-script/arbitrumWalletImport.gs`

The module contains:
- `setupArbitrumWalletImport()`;
- `syncArbitrumWalletBalances()`;
- optional `installArbitrumWalletBalanceTrigger()` for standalone Arbitrum sync;
- Arbitrum public RPC read-only balance fetch;
- native `ETH` balance via `eth_getBalance`;
- native Arbitrum `USDC` balance via ERC-20 `balanceOf`;
- current balances into `EVM_WALLET_BALANCES`;
- aggregate `ETH` sync into `Расчеты`;
- `USDC` delta sync into `Расчеты` after the first balance snapshot;
- protected balance-delta audit rows into `Транзакции_IMPORT`.

Tracked assets:
- `ETH`;
- native Arbitrum `USDC`.

Native Arbitrum USDC contract:

`0xaf88d065e77c8cC2239327C5EDb3A432268e5831`

Arbitrum RPC:

`https://arb1.arbitrum.io/rpc`

---

# Sheet Structure

## `EVM_WALLETS`

Configuration sheet.

Columns:

| Column | Meaning |
| --- | --- |
| `Wallet ID` | Stable internal label, for example `metamask-arbitrum-main` |
| `Chain` | `ARBITRUM` |
| `Address` | Public EVM wallet address |
| `Status` | `ACTIVE` / `PAUSED` |
| `Allowed Assets` | comma-separated allowlist, for example `ETH,USDC` |
| `Import Mode` | `BALANCE_SYNC` |
| `Last Sync At` | ISO timestamp |
| `Comment` | human-readable note |

## `EVM_WALLET_BALANCES`

Current public wallet snapshot. Apps Script recreates this table on every sync.

Columns:

| Column | Meaning |
| --- | --- |
| `Wallet ID` | source wallet id from `EVM_WALLETS` |
| `Chain` | `ARBITRUM` |
| `Asset` | normalized portfolio asset, currently `ETH`, `USDC` |
| `Balance Type` | `NATIVE`, `ERC20_NATIVE` |
| `Quantity` | wallet quantity |
| `Category` | portfolio category |
| `Source` | RPC method/source |
| `Last Sync At` | sync timestamp |
| `Raw Asset` | original asset or contract |
| `Decimals` | token decimals |
| `Chain ID` | `42161` |

Portfolio sync:

- `ETH` quantity is synced into `Расчеты` while preserving average entry; `Вложено` follows `Количество * Средняя входа`;
- `USDC` is not overwritten as an absolute total because the portfolio can contain USDC in other networks;
- after the first snapshot, `USDC` balance deltas are applied to the aggregate `USDC` row in `Расчеты`;
- if `USDC` decreases and `ETH` increases in the same sync, the script treats it as a wallet swap and applies ETH cost basis from the USDC delta;
- if `ETH` decreases and `USDC` increases in the same sync, the script treats it as an ETH sale, reduces ETH cost basis at the previous average entry and writes realized PnL into the protected audit note;
- balance-delta swaps append protected `BALANCE_APPLIED` audit rows to `Транзакции_IMPORT`;
- protected audit rows must not be approved again, because their cost basis is already written into `Расчеты`.

---

# Manual Run

1. Push Apps Script files with `clasp push`.
2. Run `setupArbitrumWalletImport()` once.
3. Run `syncArbitrumWalletBalances()` once.
4. Confirm `EVM_WALLET_BALANCES` contains `ETH` and `USDC`.
5. Run `syncArbitrumWalletBalances()` after a small Arbitrum wallet swap to verify delta accounting.

# Automatic Sync

Preferred Stage 2 setup:

1. Push Apps Script files with `clasp push`.
2. Run `setupArbitrumWalletImport()` once.
3. Run `syncInvestorCabinetWallets()` once to verify TON and Arbitrum together.
4. Run `installInvestorCabinetWalletSyncTrigger()` once.

`installInvestorCabinetWalletSyncTrigger()` removes old individual wallet triggers and installs one 5-minute trigger for:

- `syncTonWalletImports()`;
- `syncArbitrumWalletBalances()`.

Standalone Arbitrum-only scheduling remains available through `installArbitrumWalletBalanceTrigger()`, but the unified trigger is preferred to avoid duplicate syncs.
