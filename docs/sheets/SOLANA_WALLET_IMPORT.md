# SOLANA WALLET IMPORT

Status: Stage 2 Solana balance sync prepared

Primary wallet:
- `E5dwGSC3DKKh4A1Hdpb2BXvcSpoWrfyWWicXq8h1Sus9`

Investor Cabinet reads only public balances. It must never request, store or transmit a seed phrase, private key, wallet password or signing permission.

---

# Goal

Solana public wallet address
-> Solana public RPC
-> Apps Script read-only fetch
-> `SOLANA_WALLET_BALANCES` current wallet snapshot
-> balance-delta audit rows in `Транзакции_IMPORT`
-> `Расчеты`
-> `/api/investor`
-> frontend

---

# Current Implementation

Apps Script module:

`apps-script/solanaWalletImport.gs`

The module contains:
- `setupSolanaWalletImport()`;
- `syncSolanaWalletBalances()`;
- optional `installSolanaWalletBalanceTrigger()`;
- Solana public RPC read-only balance fetch;
- native `SOL` balance via `getBalance`;
- SPL `USDC` balance via `getTokenAccountsByOwner`;
- current balances into `SOLANA_WALLET_BALANCES`;
- aggregate `SOL` sync into `Расчеты`;
- `USDC` delta sync into `Расчеты` after the first balance snapshot;
- protected balance-delta audit rows into `Транзакции_IMPORT`.

Tracked assets:
- `SOL`;
- Solana `USDC`.

Solana USDC mint:

`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

Solana RPC:

`https://api.mainnet-beta.solana.com`

---

# Accounting Rules

- First sync creates the balance baseline and syncs current `SOL` quantity without changing average entry.
- `USDC` is not overwritten as an absolute total because the portfolio can contain USDC on multiple networks.
- After the first snapshot, `USDC` balance deltas are applied to the aggregate `USDC` row in `Расчеты`.
- If `USDC` decreases and `SOL` increases in the same sync, the script treats it as `BUY SOL`.
- If `SOL` decreases and `USDC` increases in the same sync, the script treats it as `SELL SOL`.
- `SELL SOL` reduces cost basis at the previous average entry and does not change average entry for a partial sale.
- Balance-delta swaps append protected `BALANCE_APPLIED` audit rows to `Транзакции_IMPORT`.

---

# Manual Run

1. Push Apps Script files with `clasp push`.
2. Run `setupSolanaWalletImport()` once.
3. Run `syncSolanaWalletBalances()` once.
4. Confirm `SOLANA_WALLET_BALANCES` contains `SOL` and `USDC`.
5. Run `syncInvestorCabinetWallets()` once to verify TON, Arbitrum and Solana together.

# Automatic Sync

Preferred setup:

1. Push Apps Script files with `clasp push`.
2. Run `installInvestorCabinetWalletSyncTrigger()` once.

The unified trigger calls:
- `syncTonWalletImports()`;
- `syncArbitrumWalletBalances()`;
- `syncSolanaWalletBalances()`.
