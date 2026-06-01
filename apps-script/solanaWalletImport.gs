var IC_SOLANA_WALLETS_SHEET = 'SOLANA_WALLETS';
var IC_SOLANA_BALANCES_SHEET = 'SOLANA_WALLET_BALANCES';
var IC_SOLANA_IMPORT_SHEET = 'Транзакции_IMPORT';
var IC_SOLANA_CALCULATIONS_SHEET = 'Расчеты';
var IC_SOLANA_DEFAULT_WALLET_ID = 'phantom-solana-main';
var IC_SOLANA_DEFAULT_CHAIN = 'SOLANA';
var IC_SOLANA_DEFAULT_ADDRESS = 'E5dwGSC3DKKh4A1Hdpb2BXvcSpoWrfyWWicXq8h1Sus9';
var IC_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
var IC_SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
var IC_SOLANA_CHAIN_ID = 101;

function setupSolanaWalletImport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  IC_SOLANA_getOrCreateWalletSheet_(ss);
  IC_SOLANA_getOrCreateBalanceSheet_(ss);
}

function syncSolanaWalletBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var walletSheet = IC_SOLANA_getOrCreateWalletSheet_(ss);
  var balanceSheet = IC_SOLANA_getOrCreateBalanceSheet_(ss);
  var calculationsSheet = ss.getSheetByName(IC_SOLANA_CALCULATIONS_SHEET);
  var importSheet = ss.getSheetByName(IC_SOLANA_IMPORT_SHEET);
  var wallets = IC_SOLANA_readWalletConfig_(walletSheet);
  var previousBalances = IC_SOLANA_readBalanceTotals_(balanceSheet);
  var syncStartedAt = new Date();
  var rows = [];

  wallets.forEach(function(wallet) {
    if (wallet.chain !== IC_SOLANA_DEFAULT_CHAIN || wallet.status !== 'ACTIVE') return;
    rows = rows.concat(IC_SOLANA_fetchWalletBalanceRows_(wallet, syncStartedAt));
    IC_SOLANA_updateWalletSyncState_(walletSheet, wallet.rowIndex, syncStartedAt);
  });

  IC_SOLANA_writeBalanceSnapshot_(balanceSheet, rows);

  var currentBalances = IC_SOLANA_readBalanceTotals_(balanceSheet);
  IC_SOLANA_assertSaneWalletBalance_('SOL', currentBalances.SOL || 0);
  IC_SOLANA_assertSaneWalletBalance_('USDC', currentBalances.USDC || 0);

  if (calculationsSheet) {
    IC_SOLANA_syncSnapshotToCalculations_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt);
  }
}

function installSolanaWalletBalanceTrigger() {
  ScriptApp.newTrigger('syncSolanaWalletBalances')
    .timeBased()
    .everyMinutes(5)
    .create();
}

function IC_SOLANA_getOrCreateWalletSheet_(ss) {
  var sheet = ss.getSheetByName(IC_SOLANA_WALLETS_SHEET) || ss.insertSheet(IC_SOLANA_WALLETS_SHEET);
  var headers = ['Wallet ID', 'Chain', 'Address', 'Status', 'Allowed Assets', 'Import Mode', 'Last Sync At', 'Comment'];

  if (sheet.getLastRow() < 1 || String(sheet.getRange(1, 1).getValue() || '').trim() !== 'Wallet ID') {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, 1, headers.length).setValues([[
      IC_SOLANA_DEFAULT_WALLET_ID,
      IC_SOLANA_DEFAULT_CHAIN,
      IC_SOLANA_DEFAULT_ADDRESS,
      'ACTIVE',
      'SOL,USDC',
      'BALANCE_SYNC',
      '',
      'Public read-only Solana wallet balance sync'
    ]]);
  }

  return sheet;
}

function IC_SOLANA_getOrCreateBalanceSheet_(ss) {
  return ss.getSheetByName(IC_SOLANA_BALANCES_SHEET) || ss.insertSheet(IC_SOLANA_BALANCES_SHEET);
}

function IC_SOLANA_readWalletConfig_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(1).map(function(row, index) {
    return {
      rowIndex: index + 2,
      walletId: IC_SOLANA_cell_(row, headers, 'Wallet ID'),
      chain: IC_SOLANA_cell_(row, headers, 'Chain'),
      address: IC_SOLANA_cell_(row, headers, 'Address'),
      status: IC_SOLANA_cell_(row, headers, 'Status'),
      allowedAssets: IC_SOLANA_cell_(row, headers, 'Allowed Assets'),
      importMode: IC_SOLANA_cell_(row, headers, 'Import Mode')
    };
  }).filter(function(wallet) {
    return wallet.walletId && wallet.address;
  });
}

function IC_SOLANA_fetchWalletBalanceRows_(wallet, syncStartedAt) {
  var rows = [];
  var syncAt = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");

  if (IC_SOLANA_isAllowedWalletAsset_(wallet, 'SOL')) {
    var solQuantity = IC_SOLANA_fetchNativeBalance_(wallet.address);
    if (solQuantity) rows.push(IC_SOLANA_balanceRow_(wallet, 'SOL', 'NATIVE', solQuantity, syncAt, 'SOL', 9, 'Solana public RPC getBalance'));
  }

  if (IC_SOLANA_isAllowedWalletAsset_(wallet, 'USDC')) {
    var usdcQuantity = IC_SOLANA_fetchSplTokenBalance_(wallet.address, IC_SOLANA_USDC_MINT);
    if (usdcQuantity) rows.push(IC_SOLANA_balanceRow_(wallet, 'USDC', 'SPL_TOKEN', usdcQuantity, syncAt, IC_SOLANA_USDC_MINT, 6, 'Solana public RPC getTokenAccountsByOwner'));
  }

  return rows;
}

function IC_SOLANA_balanceRow_(wallet, asset, balanceType, quantity, syncAt, rawAsset, decimals, source) {
  return [
    wallet.walletId,
    wallet.chain,
    asset,
    balanceType,
    quantity,
    IC_SOLANA_category_(asset),
    source,
    syncAt,
    rawAsset,
    decimals,
    IC_SOLANA_CHAIN_ID
  ];
}

function IC_SOLANA_writeBalanceSnapshot_(sheet, rows) {
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

function IC_SOLANA_syncSnapshotToCalculations_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt) {
  var hasPreviousSnapshot = previousBalances && Object.keys(previousBalances).length > 0;

  if (hasPreviousSnapshot) {
    IC_SOLANA_applyBalanceDeltas_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt);
  }

  IC_SOLANA_setCalculationQuantity_(calculationsSheet, 'SOL', currentBalances.SOL || 0);
}

function IC_SOLANA_applyBalanceDeltas_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt) {
  var usdcDelta = (currentBalances.USDC || 0) - (previousBalances.USDC || 0);
  var solDelta = (currentBalances.SOL || 0) - (previousBalances.SOL || 0);
  var usdcSpent = -usdcDelta;
  var usdcReceived = usdcDelta;
  var solReceived = solDelta;
  var solSold = -solDelta;
  var impliedBuyPrice = solReceived ? usdcSpent / solReceived : 0;
  var impliedSellPrice = solSold ? usdcReceived / solSold : 0;

  if (usdcSpent > 0.5 && solReceived > 0.000001 && impliedBuyPrice >= 0.01 && impliedBuyPrice <= 10000) {
    IC_SOLANA_applyAssetPurchase_(calculationsSheet, 'SOL', solReceived, usdcSpent);
    IC_SOLANA_applyStableDelta_(calculationsSheet, 'USDC', usdcDelta);
    if (importSheet) IC_SOLANA_appendBalanceDeltaBuyAuditRow_(importSheet, 'SOL', solReceived, impliedBuyPrice, usdcSpent, syncStartedAt);
    return;
  }

  if (usdcReceived > 0.5 && solSold > 0.000001 && impliedSellPrice >= 0.01 && impliedSellPrice <= 10000) {
    var sale = IC_SOLANA_applyAssetSale_(calculationsSheet, 'SOL', solSold, usdcReceived);
    IC_SOLANA_applyStableDelta_(calculationsSheet, 'USDC', usdcDelta);
    if (importSheet) IC_SOLANA_appendBalanceDeltaSellAuditRow_(importSheet, 'SOL', solSold, impliedSellPrice, usdcReceived, sale, syncStartedAt);
    return;
  }

  if (Math.abs(usdcDelta) > 0.000001) {
    IC_SOLANA_applyStableDelta_(calculationsSheet, 'USDC', usdcDelta);
  }
}

function IC_SOLANA_appendBalanceDeltaBuyAuditRow_(sheet, asset, assetReceived, impliedPrice, usdcSpent, syncStartedAt) {
  var syncId = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss");
  var importId = [
    'SOLANA_BALANCE_DELTA',
    syncId,
    'USDC_TO_' + asset,
    IC_SOLANA_round_(usdcSpent, 6),
    IC_SOLANA_round_(assetReceived, 12)
  ].join(':');

  if (IC_SOLANA_readExistingImportIds_(sheet)[importId]) return;

  IC_SOLANA_appendRows_(sheet, [[
    importId,
    'PENDING',
    Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
    asset,
    IC_SOLANA_category_(asset),
    'Покупка',
    assetReceived,
    impliedPrice,
    usdcSpent,
    'Solana wallet balance delta; already applied to Расчеты',
    IC_SOLANA_DEFAULT_WALLET_ID,
    'SOLANA',
    'BALANCE_DELTA',
    '',
    'SWAP',
    '',
    'USDC -> ' + asset,
    IC_SOLANA_round_(usdcSpent, 6) + ' -> ' + IC_SOLANA_round_(assetReceived, 12),
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") + '. Do not approve again; cost basis was applied from Solana wallet balance delta.'
  ]]);
}

function IC_SOLANA_appendBalanceDeltaSellAuditRow_(sheet, asset, assetSold, impliedPrice, usdcReceived, sale, syncStartedAt) {
  var syncId = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss");
  var importId = [
    'SOLANA_BALANCE_DELTA',
    syncId,
    asset + '_TO_USDC',
    IC_SOLANA_round_(assetSold, 12),
    IC_SOLANA_round_(usdcReceived, 6)
  ].join(':');

  if (IC_SOLANA_readExistingImportIds_(sheet)[importId]) return;

  IC_SOLANA_appendRows_(sheet, [[
    importId,
    'PENDING',
    Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
    asset,
    IC_SOLANA_category_(asset),
    'Продажа',
    assetSold,
    impliedPrice,
    usdcReceived,
    'Solana wallet balance delta; already applied to Расчеты',
    IC_SOLANA_DEFAULT_WALLET_ID,
    'SOLANA',
    'BALANCE_DELTA',
    '',
    'SWAP',
    '',
    asset + ' -> USDC',
    IC_SOLANA_round_(assetSold, 12) + ' -> ' + IC_SOLANA_round_(usdcReceived, 6),
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") +
      '. Do not approve again; cost basis was reduced at avgEntry ' + IC_SOLANA_round_(sale.avgEntry, 12) +
      '; costBasisSold=' + IC_SOLANA_round_(sale.costBasisSold, 6) +
      '; realizedPnL=' + IC_SOLANA_round_(sale.realizedPnl, 6) + '.'
  ]]);
}

function IC_SOLANA_fetchNativeBalance_(address) {
  var result = IC_SOLANA_rpcCall_('getBalance', [address]);
  var lamports = result && result.value ? Number(result.value) : 0;
  return lamports / 1000000000;
}

function IC_SOLANA_fetchSplTokenBalance_(address, mint) {
  var result = IC_SOLANA_rpcCall_('getTokenAccountsByOwner', [
    address,
    { mint: mint },
    { encoding: 'jsonParsed' }
  ]);

  var accounts = result && Array.isArray(result.value) ? result.value : [];
  return accounts.reduce(function(total, account) {
    var amount = account &&
      account.account &&
      account.account.data &&
      account.account.data.parsed &&
      account.account.data.parsed.info &&
      account.account.data.parsed.info.tokenAmount;
    var quantity = amount ? Number(amount.uiAmountString || amount.uiAmount || 0) : 0;
    return total + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
}

function IC_SOLANA_rpcCall_(method, params) {
  var response = UrlFetchApp.fetch(IC_SOLANA_RPC_URL, {
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
    throw new Error('Solana RPC request failed: ' + statusCode + ' ' + response.getContentText());
  }

  var json = JSON.parse(response.getContentText());
  if (json.error) throw new Error('Solana RPC error: ' + JSON.stringify(json.error));

  return json.result;
}

function IC_SOLANA_readBalanceTotals_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  var values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  return values.reduce(function(totals, row) {
    var asset = IC_SOLANA_normalizeAssetSymbol_(row[2]).toUpperCase();
    var quantity = IC_SOLANA_toNumber_(row[4]);
    if (!asset || !quantity) return totals;

    totals[asset] = (totals[asset] || 0) + quantity;
    return totals;
  }, {});
}

function IC_SOLANA_applyAssetPurchase_(sheet, asset, quantity, amount) {
  var rowIndex = IC_SOLANA_findAssetRow_(sheet, asset);
  if (!rowIndex) throw new Error('Missing asset in Расчеты: ' + asset);

  var currentQuantity = IC_SOLANA_toNumber_(sheet.getRange(rowIndex, 3).getValue());
  var currentAvgEntry = IC_SOLANA_toNumber_(sheet.getRange(rowIndex, 4).getValue());
  var currentInvested = currentQuantity * currentAvgEntry;
  var nextQuantity = currentQuantity + quantity;
  var nextAvgEntry = nextQuantity ? (currentInvested + amount) / nextQuantity : 0;

  sheet.getRange(rowIndex, 3).setValue(nextQuantity);
  sheet.getRange(rowIndex, 4).setValue(nextAvgEntry);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_SOLANA_applyAssetSale_(sheet, asset, quantity, proceeds) {
  var rowIndex = IC_SOLANA_findAssetRow_(sheet, asset);
  if (!rowIndex) throw new Error('Missing asset in Расчеты: ' + asset);

  var currentQuantity = IC_SOLANA_toNumber_(sheet.getRange(rowIndex, 3).getValue());
  var currentAvgEntry = IC_SOLANA_toNumber_(sheet.getRange(rowIndex, 4).getValue());
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

function IC_SOLANA_applyStableDelta_(sheet, asset, delta) {
  var rowIndex = IC_SOLANA_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  var currentQuantity = IC_SOLANA_toNumber_(sheet.getRange(rowIndex, 3).getValue());
  var nextQuantity = Math.max(0, currentQuantity + delta);

  sheet.getRange(rowIndex, 3).setValue(nextQuantity);
  sheet.getRange(rowIndex, 4).setValue(1);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_SOLANA_setCalculationQuantity_(sheet, asset, quantity) {
  var rowIndex = IC_SOLANA_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  sheet.getRange(rowIndex, 3).setValue(quantity);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_SOLANA_findAssetRow_(sheet, asset) {
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var normalizedAsset = IC_SOLANA_normalizeAssetSymbol_(asset).toUpperCase();

  for (var index = 0; index < values.length; index += 1) {
    if (IC_SOLANA_normalizeAssetSymbol_(values[index][0]).toUpperCase() === normalizedAsset) return index + 1;
  }

  return 0;
}

function IC_SOLANA_readExistingImportIds_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  return sheet.getRange(2, 1, lastRow - 1, 1).getValues().reduce(function(index, row) {
    var importId = String(row[0] || '').trim();
    if (importId) index[importId] = true;
    return index;
  }, {});
}

function IC_SOLANA_appendRows_(sheet, rows) {
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function IC_SOLANA_updateWalletSyncState_(sheet, rowIndex, date) {
  sheet.getRange(rowIndex, 7).setValue(Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"));
}

function IC_SOLANA_isAllowedWalletAsset_(wallet, asset) {
  var normalizedAsset = IC_SOLANA_normalizeAssetSymbol_(asset).toUpperCase();
  var allowed = String(wallet.allowedAssets || '').toUpperCase().split(',').map(function(item) {
    return item.trim();
  });

  return allowed.indexOf(normalizedAsset) >= 0;
}

function IC_SOLANA_assertSaneWalletBalance_(asset, quantity) {
  if (asset === 'SOL' && quantity > 10000) {
    throw new Error('Unsafe Solana SOL wallet balance detected: ' + quantity + '. Sync stopped before writing to Расчеты.');
  }

  if (asset === 'USDC' && quantity > 100000) {
    throw new Error('Unsafe Solana USDC wallet balance detected: ' + quantity + '. Sync stopped before writing to Расчеты.');
  }
}

function IC_SOLANA_category_(asset) {
  return IC_SOLANA_isStable_(asset) ? 'Кэш / Стейблы' : 'Крипта';
}

function IC_SOLANA_isStable_(asset) {
  var symbol = String(asset || '').toUpperCase();
  return symbol === 'USDC' || symbol === 'USDT';
}

function IC_SOLANA_normalizeAssetSymbol_(asset) {
  return String(asset || '').trim();
}

function IC_SOLANA_cell_(row, headers, name) {
  var index = headers.indexOf(name);
  return index >= 0 ? String(row[index] || '').trim() : '';
}

function IC_SOLANA_toNumber_(value) {
  var parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function IC_SOLANA_round_(value, digits) {
  var parsed = IC_SOLANA_toNumber_(value);
  return Number(parsed.toFixed(digits));
}
