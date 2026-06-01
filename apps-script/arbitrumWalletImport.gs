var IC_EVM_WALLETS_SHEET = 'EVM_WALLETS';
var IC_EVM_BALANCES_SHEET = 'EVM_WALLET_BALANCES';
var IC_EVM_IMPORT_SHEET = 'Транзакции_IMPORT';
var IC_EVM_CALCULATIONS_SHEET = 'Расчеты';
var IC_EVM_DEFAULT_WALLET_ID = 'metamask-arbitrum-main';
var IC_EVM_DEFAULT_CHAIN = 'ARBITRUM';
var IC_EVM_DEFAULT_ADDRESS = '0xFEc18D4474826afd65d578ff931F4ff2926ee0c3';
var IC_EVM_ARBITRUM_RPC_URL = 'https://arb1.arbitrum.io/rpc';
var IC_EVM_ARBITRUM_CHAIN_ID = 42161;
var IC_EVM_ARBITRUM_NATIVE_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

function setupArbitrumWalletImport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  IC_EVM_getOrCreateWalletSheet_(ss);
  IC_EVM_getOrCreateBalanceSheet_(ss);
}

function syncArbitrumWalletBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var walletSheet = IC_EVM_getOrCreateWalletSheet_(ss);
  var balanceSheet = IC_EVM_getOrCreateBalanceSheet_(ss);
  var calculationsSheet = ss.getSheetByName(IC_EVM_CALCULATIONS_SHEET);
  var importSheet = ss.getSheetByName(IC_EVM_IMPORT_SHEET);
  var wallets = IC_EVM_readWalletConfig_(walletSheet);
  var previousBalances = IC_EVM_readBalanceTotals_(balanceSheet);
  var syncStartedAt = new Date();
  var rows = [];

  wallets.forEach(function(wallet) {
    if (wallet.chain !== IC_EVM_DEFAULT_CHAIN || wallet.status !== 'ACTIVE') return;
    rows = rows.concat(IC_EVM_fetchWalletBalanceRows_(wallet, syncStartedAt));
    IC_EVM_updateWalletSyncState_(walletSheet, wallet.rowIndex, syncStartedAt);
  });

  IC_EVM_writeBalanceSnapshot_(balanceSheet, rows);

  var currentBalances = IC_EVM_readBalanceTotals_(balanceSheet);
  IC_EVM_assertSaneWalletBalance_('ETH', currentBalances.ETH || 0);
  IC_EVM_assertSaneWalletBalance_('USDC', currentBalances.USDC || 0);

  if (calculationsSheet) {
    IC_EVM_syncArbitrumSnapshotToCalculations_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt);
  }
}

function installArbitrumWalletBalanceTrigger() {
  ScriptApp.newTrigger('syncArbitrumWalletBalances')
    .timeBased()
    .everyMinutes(5)
    .create();
}

function IC_EVM_getOrCreateWalletSheet_(ss) {
  var sheet = ss.getSheetByName(IC_EVM_WALLETS_SHEET) || ss.insertSheet(IC_EVM_WALLETS_SHEET);
  var headers = ['Wallet ID', 'Chain', 'Address', 'Status', 'Allowed Assets', 'Import Mode', 'Last Sync At', 'Comment'];

  if (sheet.getLastRow() < 1 || String(sheet.getRange(1, 1).getValue() || '').trim() !== 'Wallet ID') {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, 1, headers.length).setValues([[
      IC_EVM_DEFAULT_WALLET_ID,
      IC_EVM_DEFAULT_CHAIN,
      IC_EVM_DEFAULT_ADDRESS,
      'ACTIVE',
      'ETH,USDC',
      'BALANCE_SYNC',
      '',
      'Public read-only Arbitrum wallet balance sync'
    ]]);
  }

  return sheet;
}

function IC_EVM_getOrCreateBalanceSheet_(ss) {
  return ss.getSheetByName(IC_EVM_BALANCES_SHEET) || ss.insertSheet(IC_EVM_BALANCES_SHEET);
}

function IC_EVM_readWalletConfig_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(1).map(function(row, index) {
    return {
      rowIndex: index + 2,
      walletId: IC_EVM_cell_(row, headers, 'Wallet ID'),
      chain: IC_EVM_cell_(row, headers, 'Chain'),
      address: IC_EVM_cell_(row, headers, 'Address'),
      status: IC_EVM_cell_(row, headers, 'Status'),
      allowedAssets: IC_EVM_cell_(row, headers, 'Allowed Assets'),
      importMode: IC_EVM_cell_(row, headers, 'Import Mode')
    };
  }).filter(function(wallet) {
    return wallet.walletId && wallet.address;
  });
}

function IC_EVM_fetchWalletBalanceRows_(wallet, syncStartedAt) {
  var rows = [];
  var syncAt = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");

  if (IC_EVM_isAllowedWalletAsset_(wallet, 'ETH')) {
    var ethQuantity = IC_EVM_fetchNativeBalance_(wallet.address);
    if (ethQuantity) rows.push(IC_EVM_balanceRow_(wallet, 'ETH', 'NATIVE', ethQuantity, syncAt, 'ETH', 18, 'Arbitrum public RPC eth_getBalance'));
  }

  if (IC_EVM_isAllowedWalletAsset_(wallet, 'USDC')) {
    var usdcQuantity = IC_EVM_fetchErc20Balance_(wallet.address, IC_EVM_ARBITRUM_NATIVE_USDC, 6);
    if (usdcQuantity) rows.push(IC_EVM_balanceRow_(wallet, 'USDC', 'ERC20_NATIVE', usdcQuantity, syncAt, IC_EVM_ARBITRUM_NATIVE_USDC, 6, 'Arbitrum native USDC balanceOf'));
  }

  return rows;
}

function IC_EVM_balanceRow_(wallet, asset, balanceType, quantity, syncAt, rawAsset, decimals, source) {
  return [
    wallet.walletId,
    wallet.chain,
    asset,
    balanceType,
    quantity,
    IC_EVM_category_(asset),
    source,
    syncAt,
    rawAsset,
    decimals,
    IC_EVM_ARBITRUM_CHAIN_ID
  ];
}

function IC_EVM_writeBalanceSnapshot_(sheet, rows) {
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

function IC_EVM_syncArbitrumSnapshotToCalculations_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt) {
  var hasPreviousSnapshot = previousBalances && Object.keys(previousBalances).length > 0;

  if (hasPreviousSnapshot) {
    IC_EVM_applyBalanceDeltas_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt);
  }

  IC_EVM_setCalculationQuantity_(calculationsSheet, 'ETH', currentBalances.ETH || 0);
}

function IC_EVM_applyBalanceDeltas_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt) {
  var usdcDelta = (currentBalances.USDC || 0) - (previousBalances.USDC || 0);
  var ethDelta = (currentBalances.ETH || 0) - (previousBalances.ETH || 0);
  var usdcSpent = -usdcDelta;
  var usdcReceived = usdcDelta;
  var ethReceived = ethDelta;
  var ethSold = -ethDelta;
  var impliedBuyPrice = ethReceived ? usdcSpent / ethReceived : 0;
  var impliedSellPrice = ethSold ? usdcReceived / ethSold : 0;

  if (usdcSpent > 0.5 && ethReceived > 0.0000001 && impliedBuyPrice >= 0.01 && impliedBuyPrice <= 100000) {
    IC_EVM_applyAssetPurchase_(calculationsSheet, 'ETH', ethReceived, usdcSpent);
    IC_EVM_applyStableDelta_(calculationsSheet, 'USDC', usdcDelta);
    if (importSheet) IC_EVM_appendBalanceDeltaBuyAuditRow_(importSheet, 'ETH', ethReceived, impliedBuyPrice, usdcSpent, syncStartedAt);
    return;
  }

  if (usdcReceived > 0.5 && ethSold > 0.0000001 && impliedSellPrice >= 0.01 && impliedSellPrice <= 100000) {
    var sale = IC_EVM_applyAssetSale_(calculationsSheet, 'ETH', ethSold, usdcReceived);
    IC_EVM_applyStableDelta_(calculationsSheet, 'USDC', usdcDelta);
    if (importSheet) IC_EVM_appendBalanceDeltaSellAuditRow_(importSheet, 'ETH', ethSold, impliedSellPrice, usdcReceived, sale, syncStartedAt);
    return;
  }

  if (Math.abs(usdcDelta) > 0.000001) {
    IC_EVM_applyStableDelta_(calculationsSheet, 'USDC', usdcDelta);
  }
}

function IC_EVM_appendBalanceDeltaBuyAuditRow_(sheet, asset, assetReceived, impliedPrice, usdcSpent, syncStartedAt) {
  var syncId = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss");
  var importId = [
    'EVM_BALANCE_DELTA',
    'ARBITRUM',
    syncId,
    'USDC_TO_' + asset,
    IC_EVM_round_(usdcSpent, 6),
    IC_EVM_round_(assetReceived, 12)
  ].join(':');

  if (IC_EVM_readExistingImportIds_(sheet)[importId]) return;

  IC_EVM_appendRows_(sheet, [[
    importId,
    'PENDING',
    Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
    asset,
    IC_EVM_category_(asset),
    'Покупка',
    assetReceived,
    impliedPrice,
    usdcSpent,
    'Arbitrum wallet balance delta; already applied to Расчеты',
    IC_EVM_DEFAULT_WALLET_ID,
    'ARBITRUM',
    'BALANCE_DELTA',
    '',
    'SWAP',
    '',
    'USDC -> ' + asset,
    IC_EVM_round_(usdcSpent, 6) + ' -> ' + IC_EVM_round_(assetReceived, 12),
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") + '. Do not approve again; cost basis was applied from Arbitrum wallet balance delta.'
  ]]);
}

function IC_EVM_appendBalanceDeltaSellAuditRow_(sheet, asset, assetSold, impliedPrice, usdcReceived, sale, syncStartedAt) {
  var syncId = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss");
  var importId = [
    'EVM_BALANCE_DELTA',
    'ARBITRUM',
    syncId,
    asset + '_TO_USDC',
    IC_EVM_round_(assetSold, 12),
    IC_EVM_round_(usdcReceived, 6)
  ].join(':');

  if (IC_EVM_readExistingImportIds_(sheet)[importId]) return;

  IC_EVM_appendRows_(sheet, [[
    importId,
    'PENDING',
    Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
    asset,
    IC_EVM_category_(asset),
    'Продажа',
    assetSold,
    impliedPrice,
    usdcReceived,
    'Arbitrum wallet balance delta; already applied to Расчеты',
    IC_EVM_DEFAULT_WALLET_ID,
    'ARBITRUM',
    'BALANCE_DELTA',
    '',
    'SWAP',
    '',
    asset + ' -> USDC',
    IC_EVM_round_(assetSold, 12) + ' -> ' + IC_EVM_round_(usdcReceived, 6),
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") +
      '. Do not approve again; cost basis was reduced at avgEntry ' + IC_EVM_round_(sale.avgEntry, 12) +
      '; costBasisSold=' + IC_EVM_round_(sale.costBasisSold, 6) +
      '; realizedPnL=' + IC_EVM_round_(sale.realizedPnl, 6) + '.'
  ]]);
}

function IC_EVM_fetchNativeBalance_(address) {
  var result = IC_EVM_rpcCall_('eth_getBalance', [address, 'latest']);
  return IC_EVM_hexUnits_(result, 18);
}

function IC_EVM_fetchErc20Balance_(address, contractAddress, decimals) {
  var data = '0x70a08231' + IC_EVM_padAddress_(address);
  var result = IC_EVM_rpcCall_('eth_call', [{
    to: contractAddress,
    data: data
  }, 'latest']);

  return IC_EVM_hexUnits_(result, decimals);
}

function IC_EVM_rpcCall_(method, params) {
  var response = UrlFetchApp.fetch(IC_EVM_ARBITRUM_RPC_URL, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: method,
      params: params
    })
  });

  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('Arbitrum RPC request failed: ' + statusCode + ' ' + response.getContentText());
  }

  var json = JSON.parse(response.getContentText());
  if (json.error) throw new Error('Arbitrum RPC error: ' + JSON.stringify(json.error));

  return json.result;
}

function IC_EVM_readBalanceTotals_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  var values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  return values.reduce(function(totals, row) {
    var asset = IC_EVM_normalizeAssetSymbol_(row[2]).toUpperCase();
    var quantity = IC_EVM_toNumber_(row[4]);
    if (!asset || !quantity) return totals;

    totals[asset] = (totals[asset] || 0) + quantity;
    return totals;
  }, {});
}

function IC_EVM_applyAssetPurchase_(sheet, asset, quantity, amount) {
  var rowIndex = IC_EVM_findAssetRow_(sheet, asset);
  if (!rowIndex) throw new Error('Missing asset in Расчеты: ' + asset);

  var currentQuantity = IC_EVM_toNumber_(sheet.getRange(rowIndex, 3).getValue());
  var currentAvgEntry = IC_EVM_toNumber_(sheet.getRange(rowIndex, 4).getValue());
  var currentInvested = currentQuantity * currentAvgEntry;
  var nextQuantity = currentQuantity + quantity;
  var nextAvgEntry = nextQuantity ? (currentInvested + amount) / nextQuantity : 0;

  sheet.getRange(rowIndex, 3).setValue(nextQuantity);
  sheet.getRange(rowIndex, 4).setValue(nextAvgEntry);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_EVM_applyAssetSale_(sheet, asset, quantity, proceeds) {
  var rowIndex = IC_EVM_findAssetRow_(sheet, asset);
  if (!rowIndex) throw new Error('Missing asset in Расчеты: ' + asset);

  var currentQuantity = IC_EVM_toNumber_(sheet.getRange(rowIndex, 3).getValue());
  var currentAvgEntry = IC_EVM_toNumber_(sheet.getRange(rowIndex, 4).getValue());
  var sellQuantity = Math.min(quantity, currentQuantity);
  var nextQuantity = Math.max(0, currentQuantity - sellQuantity);
  var costBasisSold = sellQuantity * currentAvgEntry;
  var realizedPnl = proceeds - costBasisSold;

  sheet.getRange(rowIndex, 3).setValue(nextQuantity);
  sheet.getRange(rowIndex, 4).setValue(nextQuantity ? currentAvgEntry : 0);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);

  return {
    avgEntry: currentAvgEntry,
    costBasisSold: costBasisSold,
    realizedPnl: realizedPnl
  };
}

function IC_EVM_applyStableDelta_(sheet, asset, delta) {
  var rowIndex = IC_EVM_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  var currentQuantity = IC_EVM_toNumber_(sheet.getRange(rowIndex, 3).getValue());
  var nextQuantity = Math.max(0, currentQuantity + delta);

  sheet.getRange(rowIndex, 3).setValue(nextQuantity);
  sheet.getRange(rowIndex, 4).setValue(1);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_EVM_setCalculationQuantity_(sheet, asset, quantity) {
  var rowIndex = IC_EVM_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  sheet.getRange(rowIndex, 3).setValue(quantity);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_EVM_findAssetRow_(sheet, asset) {
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var normalizedAsset = IC_EVM_normalizeAssetSymbol_(asset).toUpperCase();

  for (var index = 0; index < values.length; index += 1) {
    if (IC_EVM_normalizeAssetSymbol_(values[index][0]).toUpperCase() === normalizedAsset) return index + 1;
  }

  return 0;
}

function IC_EVM_readExistingImportIds_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  return sheet.getRange(2, 1, lastRow - 1, 1).getValues().reduce(function(index, row) {
    var importId = String(row[0] || '').trim();
    if (importId) index[importId] = true;
    return index;
  }, {});
}

function IC_EVM_appendRows_(sheet, rows) {
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function IC_EVM_updateWalletSyncState_(sheet, rowIndex, date) {
  sheet.getRange(rowIndex, 7).setValue(Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"));
}

function IC_EVM_isAllowedWalletAsset_(wallet, asset) {
  var normalizedAsset = IC_EVM_normalizeAssetSymbol_(asset).toUpperCase();
  var allowed = String(wallet.allowedAssets || '').toUpperCase().split(',').map(function(item) {
    return item.trim();
  });

  return allowed.indexOf(normalizedAsset) >= 0;
}

function IC_EVM_assertSaneWalletBalance_(asset, quantity) {
  if (asset === 'ETH' && quantity > 100) {
    throw new Error('Unsafe Arbitrum ETH wallet balance detected: ' + quantity + '. Sync stopped before writing to Расчеты.');
  }

  if (asset === 'USDC' && quantity > 100000) {
    throw new Error('Unsafe Arbitrum USDC wallet balance detected: ' + quantity + '. Sync stopped before writing to Расчеты.');
  }
}

function IC_EVM_category_(asset) {
  return IC_EVM_isStable_(asset) ? 'Кэш / Стейблы' : 'Крипта';
}

function IC_EVM_isStable_(asset) {
  var symbol = String(asset || '').toUpperCase();
  return symbol === 'USDC' || symbol === 'USDT';
}

function IC_EVM_normalizeAssetSymbol_(asset) {
  var symbol = String(asset || '').trim();
  if (symbol.toUpperCase() === 'USDCOIN') return 'USDC';
  return symbol;
}

function IC_EVM_padAddress_(address) {
  return String(address || '').toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function IC_EVM_hexUnits_(hexValue, decimals) {
  var hex = String(hexValue || '0x0').replace(/^0x/, '');
  if (!hex) return 0;

  return IC_EVM_decimalUnits_(IC_EVM_hexToDecimalString_(hex), decimals);
}

function IC_EVM_hexToDecimalString_(hex) {
  return String(hex || '0').split('').reduce(function(decimal, char) {
    var digit = parseInt(char, 16);
    if (!Number.isFinite(digit)) return decimal;

    return IC_EVM_addSmallInt_(IC_EVM_multiplyDecimalString_(decimal, 16), digit);
  }, '0');
}

function IC_EVM_decimalUnits_(decimalString, decimals) {
  var value = String(decimalString || '0').replace(/^0+/, '') || '0';
  var scale = decimals || 0;

  if (!scale) return Number(value);

  if (value.length <= scale) value = new Array(scale - value.length + 2).join('0') + value;

  var whole = value.slice(0, value.length - scale) || '0';
  var fraction = value.slice(value.length - scale).replace(/0+$/, '');

  return Number(fraction ? whole + '.' + fraction : whole);
}

function IC_EVM_multiplyDecimalString_(decimal, multiplier) {
  var carry = 0;
  var result = '';
  var source = String(decimal || '0');

  for (var index = source.length - 1; index >= 0; index -= 1) {
    var product = Number(source[index]) * multiplier + carry;
    result = String(product % 10) + result;
    carry = Math.floor(product / 10);
  }

  return (String(carry || '') + result).replace(/^0+/, '') || '0';
}

function IC_EVM_addSmallInt_(decimal, addend) {
  var carry = addend;
  var result = '';
  var source = String(decimal || '0');

  for (var index = source.length - 1; index >= 0; index -= 1) {
    var sum = Number(source[index]) + carry;
    result = String(sum % 10) + result;
    carry = Math.floor(sum / 10);
  }

  return (String(carry || '') + result).replace(/^0+/, '') || '0';
}

function IC_EVM_cell_(row, headers, name) {
  var index = headers.indexOf(name);
  return index >= 0 ? String(row[index] || '').trim() : '';
}

function IC_EVM_toNumber_(value) {
  var parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function IC_EVM_round_(value, digits) {
  var parsed = IC_EVM_toNumber_(value);
  return Number(parsed.toFixed(digits));
}
