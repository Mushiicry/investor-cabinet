var IC_COSMOS_WALLETS_SHEET = 'COSMOS_WALLETS';
var IC_COSMOS_BALANCES_SHEET = 'COSMOS_WALLET_BALANCES';
var IC_COSMOS_CALCULATIONS_SHEET = 'Расчеты';
var IC_COSMOS_DEFAULT_WALLET_ID = 'trust-cosmos-main';
var IC_COSMOS_DEFAULT_CHAIN = 'COSMOS';
var IC_COSMOS_DEFAULT_ADDRESS = 'cosmos19cykvjv5sqgqgrrw0n94et2knvj3t3chpv7hka';
var IC_COSMOS_REST_URL = 'https://cosmos-rest.publicnode.com';
var IC_COSMOS_CHAIN_ID = 'cosmoshub-4';

function setupCosmosWalletImport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  IC_COSMOS_getOrCreateWalletSheet_(ss);
  IC_COSMOS_getOrCreateBalanceSheet_(ss);
}

function syncCosmosWalletBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var walletSheet = IC_COSMOS_getOrCreateWalletSheet_(ss);
  var balanceSheet = IC_COSMOS_getOrCreateBalanceSheet_(ss);
  var calculationsSheet = ss.getSheetByName(IC_COSMOS_CALCULATIONS_SHEET);
  var wallets = IC_COSMOS_readWalletConfig_(walletSheet);
  var syncStartedAt = new Date();
  var rows = [];

  wallets.forEach(function(wallet) {
    if (wallet.chain !== IC_COSMOS_DEFAULT_CHAIN || wallet.status !== 'ACTIVE') return;
    rows = rows.concat(IC_COSMOS_fetchWalletBalanceRows_(wallet, syncStartedAt));
    IC_COSMOS_updateWalletSyncState_(walletSheet, wallet.rowIndex, syncStartedAt);
  });

  IC_COSMOS_writeBalanceSnapshot_(balanceSheet, rows);

  var currentBalances = IC_COSMOS_readBalanceTotals_(balanceSheet);
  IC_COSMOS_assertSaneWalletBalance_('ATOM', currentBalances.ATOM || 0);

  if (calculationsSheet) {
    IC_COSMOS_setCalculationQuantity_(calculationsSheet, 'ATOM', currentBalances.ATOM || 0);
  }
}

function installCosmosWalletBalanceTrigger() {
  ScriptApp.newTrigger('syncCosmosWalletBalances')
    .timeBased()
    .everyMinutes(5)
    .create();
}

function IC_COSMOS_getOrCreateWalletSheet_(ss) {
  var sheet = ss.getSheetByName(IC_COSMOS_WALLETS_SHEET) || ss.insertSheet(IC_COSMOS_WALLETS_SHEET);
  var headers = ['Wallet ID', 'Chain', 'Address', 'Status', 'Allowed Assets', 'Import Mode', 'Last Sync At', 'Comment'];

  if (sheet.getLastRow() < 1 || String(sheet.getRange(1, 1).getValue() || '').trim() !== 'Wallet ID') {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, 1, headers.length).setValues([[
      IC_COSMOS_DEFAULT_WALLET_ID,
      IC_COSMOS_DEFAULT_CHAIN,
      IC_COSMOS_DEFAULT_ADDRESS,
      'ACTIVE',
      'ATOM',
      'BALANCE_SYNC',
      '',
      'Public read-only Cosmos Hub wallet balance and staking sync'
    ]]);
  }

  return sheet;
}

function IC_COSMOS_getOrCreateBalanceSheet_(ss) {
  return ss.getSheetByName(IC_COSMOS_BALANCES_SHEET) || ss.insertSheet(IC_COSMOS_BALANCES_SHEET);
}

function IC_COSMOS_readWalletConfig_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(1).map(function(row, index) {
    return {
      rowIndex: index + 2,
      walletId: IC_COSMOS_cell_(row, headers, 'Wallet ID'),
      chain: IC_COSMOS_cell_(row, headers, 'Chain'),
      address: IC_COSMOS_cell_(row, headers, 'Address'),
      status: IC_COSMOS_cell_(row, headers, 'Status'),
      allowedAssets: IC_COSMOS_cell_(row, headers, 'Allowed Assets'),
      importMode: IC_COSMOS_cell_(row, headers, 'Import Mode')
    };
  }).filter(function(wallet) {
    return wallet.walletId && wallet.address;
  });
}

function IC_COSMOS_fetchWalletBalanceRows_(wallet, syncStartedAt) {
  var rows = [];
  var syncAt = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");

  if (!IC_COSMOS_isAllowedWalletAsset_(wallet, 'ATOM')) return rows;

  var liquid = IC_COSMOS_fetchLiquidAtom_(wallet.address);
  var staked = IC_COSMOS_fetchStakedAtom_(wallet.address);
  var rewards = IC_COSMOS_fetchRewardAtom_(wallet.address);

  if (liquid) rows.push(IC_COSMOS_balanceRow_(wallet, 'ATOM', 'LIQUID', liquid, syncAt, 'uatom', 6, 'Cosmos REST bank balance'));
  if (staked) rows.push(IC_COSMOS_balanceRow_(wallet, 'ATOM', 'STAKED', staked, syncAt, 'uatom', 6, 'Cosmos REST staking delegations'));
  if (rewards) rows.push(IC_COSMOS_balanceRow_(wallet, 'ATOM_REWARD', 'REWARD', rewards, syncAt, 'uatom', 6, 'Cosmos REST distribution rewards'));

  return rows;
}

function IC_COSMOS_balanceRow_(wallet, asset, balanceType, quantity, syncAt, rawAsset, decimals, source) {
  return [
    wallet.walletId,
    wallet.chain,
    asset,
    balanceType,
    quantity,
    IC_COSMOS_category_(asset),
    source,
    syncAt,
    rawAsset,
    decimals,
    IC_COSMOS_CHAIN_ID
  ];
}

function IC_COSMOS_writeBalanceSnapshot_(sheet, rows) {
  var headers = [
    'Wallet ID',
    'Chain',
    'Asset',
    'Balance Type',
    'Quantity',
    'Category',
    'Source',
    'Last Sync At',
    'Raw Asset',
    'Decimals',
    'Chain ID'
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function IC_COSMOS_fetchLiquidAtom_(address) {
  var json = IC_COSMOS_fetchJson_('/cosmos/bank/v1beta1/balances/' + encodeURIComponent(address) + '/by_denom?denom=uatom');
  return IC_COSMOS_microUnits_(json && json.balance ? json.balance.amount : 0);
}

function IC_COSMOS_fetchStakedAtom_(address) {
  var json = IC_COSMOS_fetchJson_('/cosmos/staking/v1beta1/delegations/' + encodeURIComponent(address));
  var delegations = json && Array.isArray(json.delegation_responses) ? json.delegation_responses : [];

  return delegations.reduce(function(total, delegation) {
    return total + IC_COSMOS_microUnits_(delegation && delegation.balance ? delegation.balance.amount : 0);
  }, 0);
}

function IC_COSMOS_fetchRewardAtom_(address) {
  var json = IC_COSMOS_fetchJson_('/cosmos/distribution/v1beta1/delegators/' + encodeURIComponent(address) + '/rewards');
  var rewards = json && Array.isArray(json.total) ? json.total : [];

  return rewards.reduce(function(total, reward) {
    if (String(reward.denom || '') !== 'uatom') return total;
    return total + IC_COSMOS_microUnits_(reward.amount || 0);
  }, 0);
}

function IC_COSMOS_fetchJson_(path) {
  var response = UrlFetchApp.fetch(IC_COSMOS_REST_URL + path, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Accept: 'application/json' }
  });

  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('Cosmos REST request failed: ' + statusCode + ' ' + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

function IC_COSMOS_readBalanceTotals_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  var values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  return values.reduce(function(totals, row) {
    var asset = IC_COSMOS_normalizeAssetSymbol_(row[2]).toUpperCase();
    var quantity = IC_COSMOS_toNumber_(row[4]);
    if (asset !== 'ATOM' || !quantity) return totals;

    totals.ATOM = (totals.ATOM || 0) + quantity;
    return totals;
  }, {});
}

function IC_COSMOS_setCalculationQuantity_(sheet, asset, quantity) {
  var rowIndex = IC_COSMOS_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  sheet.getRange(rowIndex, 3).setValue(quantity);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_COSMOS_findAssetRow_(sheet, asset) {
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var normalizedAsset = IC_COSMOS_normalizeAssetSymbol_(asset).toUpperCase();

  for (var index = 0; index < values.length; index += 1) {
    if (IC_COSMOS_normalizeAssetSymbol_(values[index][0]).toUpperCase() === normalizedAsset) return index + 1;
  }

  return 0;
}

function IC_COSMOS_updateWalletSyncState_(sheet, rowIndex, date) {
  sheet.getRange(rowIndex, 7).setValue(Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"));
}

function IC_COSMOS_isAllowedWalletAsset_(wallet, asset) {
  var normalizedAsset = IC_COSMOS_normalizeAssetSymbol_(asset).toUpperCase();
  var allowed = String(wallet.allowedAssets || '').toUpperCase().split(',').map(function(item) {
    return item.trim();
  });

  return allowed.indexOf(normalizedAsset) >= 0;
}

function IC_COSMOS_assertSaneWalletBalance_(asset, quantity) {
  if (asset === 'ATOM' && quantity > 100000) {
    throw new Error('Unsafe Cosmos ATOM wallet balance detected: ' + quantity + '. Sync stopped before writing to Расчеты.');
  }
}

function IC_COSMOS_category_(asset) {
  return String(asset || '').toUpperCase() === 'ATOM_REWARD' ? 'Крипта' : 'Крипта';
}

function IC_COSMOS_normalizeAssetSymbol_(asset) {
  return String(asset || '').trim();
}

function IC_COSMOS_cell_(row, headers, name) {
  var index = headers.indexOf(name);
  return index >= 0 ? String(row[index] || '').trim() : '';
}

function IC_COSMOS_microUnits_(value) {
  var parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed / 1000000 : 0;
}

function IC_COSMOS_toNumber_(value) {
  var parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
