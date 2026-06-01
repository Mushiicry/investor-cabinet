# COSMOS WALLET IMPORT

Status: Stage 2 Cosmos balance sync prepared

Primary wallet:
- `cosmos19cykvjv5sqgqgrrw0n94et2knvj3t3chpv7hka`

Investor Cabinet reads only public balances and staking data. It must never request, store or transmit a seed phrase, private key, wallet password or signing permission.

---

# Goal

Cosmos public wallet address
-> Cosmos public REST API
-> Apps Script read-only fetch
-> `COSMOS_WALLET_BALANCES` current wallet snapshot
-> `Расчеты`
-> `/api/investor`
-> frontend

---

# Current Implementation

Apps Script module:

`apps-script/cosmosWalletImport.gs`

The module contains:
- `setupCosmosWalletImport()`;
- `syncCosmosWalletBalances()`;
- optional `installCosmosWalletBalanceTrigger()`;
- liquid `ATOM` balance via `/cosmos/bank/v1beta1/balances`;
- staked `ATOM` balance via `/cosmos/staking/v1beta1/delegations`;
- unclaimed `ATOM` rewards via `/cosmos/distribution/v1beta1/delegators`;
- current balances into `COSMOS_WALLET_BALANCES`;
- aggregate `ATOM` quantity sync into `Расчеты`.

Tracked portfolio quantity:
- `ATOM LIQUID`;
- `ATOM STAKED`.

Tracked but excluded from portfolio quantity:
- `ATOM_REWARD`.

Rewards are excluded from `Расчеты` until claimed, so cost basis is not inflated by unclaimed staking rewards.

Cosmos REST endpoint:

`https://cosmos-rest.publicnode.com`

---

# Accounting Rules

- `ATOM` quantity in `Расчеты` is synced as liquid + staked.
- `ATOM_REWARD` is written to the snapshot only and does not change cost basis.
- Average entry is preserved by the sync.
- `Вложено` follows the existing `=C*D` formula.
- This importer does not infer buy/sell price because the Cosmos wallet snapshot has no observable stablecoin counter-asset.
- If ATOM is bought/sold outside the wallet, cost basis should still come from the reviewed `Транзакции` row.

---

# Manual Run

1. Push Apps Script files with `clasp push`.
2. Run `setupCosmosWalletImport()` once.
3. Run `syncCosmosWalletBalances()` once.
4. Confirm `COSMOS_WALLET_BALANCES` contains `ATOM` liquid/staked and optional `ATOM_REWARD`.
5. Confirm `Расчеты` ATOM quantity equals liquid + staked.

# Automatic Sync

Preferred setup:

1. Push Apps Script files with `clasp push`.
2. Run `installInvestorCabinetWalletSyncTrigger()` once.

The unified trigger calls:
- `syncTonWalletImports()`;
- `syncArbitrumWalletBalances()`;
- `syncSolanaWalletBalances()`;
- `syncCosmosWalletBalances()`.
