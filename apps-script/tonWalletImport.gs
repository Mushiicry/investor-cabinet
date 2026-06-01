var IC_TON_API_BASE_URL = 'https://tonapi.io/v2';
var IC_TON_WALLETS_SHEET = 'TON_WALLETS';
var IC_TON_IMPORT_SHEET = 'Транзакции_IMPORT';
var IC_TON_BALANCES_SHEET = 'TON_WALLET_BALANCES';
var IC_MAIN_TRANSACTIONS_SHEET = 'Транзакции';
var IC_CALCULATIONS_SHEET = 'Расчеты';
var IC_TON_DEFAULT_LOOKBACK_DAYS = 14;
var IC_TON_FETCH_LIMIT = 100;
var IC_TON_STAKED_EXCHANGE_RATE = 35.03 / 31.37;

function syncTonWalletImports() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var walletSheet = ss.getSheetByName(IC_TON_WALLETS_SHEET);
  var importSheet = ss.getSheetByName(IC_TON_IMPORT_SHEET);

  if (!walletSheet || !importSheet) {
    throw new Error('Missing TON import sheets: TON_WALLETS and/or Транзакции_IMPORT');
  }

  var wallets = IC_TON_readWalletConfig_(walletSheet);
  var existingImportIds = IC_TON_readExistingImportIds_(importSheet);
  var previousBalances = IC_TON_readCurrentBalanceTotals_(ss);
  var syncStartedAt = new Date();

  wallets.forEach(function(wallet) {
    if (wallet.chain !== 'TON' || wallet.status !== 'ACTIVE') return;

    var transactions = IC_TON_fetchTransactions_(wallet);
    var rowsToAppend = [];
    var maxSeenLt = wallet.lastSeenLt || '';

    transactions.forEach(function(tx) {
      var normalizedRows = IC_TON_normalizeTransaction_(wallet, tx);
      if (!normalizedRows || !normalizedRows.length) return;

      normalizedRows.forEach(function(normalized) {
        if (wallet.lastSeenLt && normalized.lt && Number(normalized.lt) <= Number(wallet.lastSeenLt)) return;

        if (normalized.lt && (!maxSeenLt || Number(normalized.lt) > Number(maxSeenLt))) {
          maxSeenLt = normalized.lt;
        }

        if (existingImportIds[normalized.importId]) return;

        existingImportIds[normalized.importId] = true;
        rowsToAppend.push(IC_TON_toImportRow_(normalized));
      });
    });

    if (rowsToAppend.length) {
      IC_TON_appendRows_(importSheet, rowsToAppend);
    }

    IC_TON_updateWalletSyncState_(walletSheet, wallet.rowIndex, maxSeenLt, syncStartedAt);
  });

  IC_TON_refreshWalletBalanceSnapshot_(ss, wallets, syncStartedAt);
  IC_TON_syncBalanceSnapshotToCalculations_(ss, syncStartedAt, previousBalances);
}

function installTonWalletImportTrigger() {
  ScriptApp.newTrigger('syncTonWalletImports')
    .timeBased()
    .everyMinutes(5)
    .create();
}

function applyApprovedTonImports() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var importSheet = ss.getSheetByName(IC_TON_IMPORT_SHEET);
  var transactionsSheet = ss.getSheetByName(IC_MAIN_TRANSACTIONS_SHEET);
  var calculationsSheet = ss.getSheetByName(IC_CALCULATIONS_SHEET);

  if (!importSheet || !transactionsSheet || !calculationsSheet) {
    throw new Error('Missing sheets for TON approval flow');
  }

  var values = importSheet.getDataRange().getValues();
  if (values.length < 2) return;

  var headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  values.slice(1).forEach(function(row, index) {
    var rowIndex = index + 2;
    var status = IC_TON_cell_(row, headers, 'Status');
    var reviewNote = IC_TON_cell_(row, headers, 'Review Note');
    if (status !== 'APPROVED' || IC_TON_isImportAlreadyApplied_(reviewNote)) return;

    var tx = IC_TON_importRowToApprovedTransaction_(row, headers);
    if (!tx) return;

    var targetRow = IC_TON_appendMainTransaction_(transactionsSheet, tx);
    IC_TON_applyToCalculations_(calculationsSheet, tx);
    if (tx.comment) transactionsSheet.getRange(targetRow, 8).setValue(tx.comment);
    importSheet.getRange(rowIndex, 19).setValue('APPLIED to Транзакции row ' + targetRow + ' at ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") + '. ' + reviewNote);
  });
}

function syncTonWalletBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var walletSheet = ss.getSheetByName(IC_TON_WALLETS_SHEET);
  if (!walletSheet) throw new Error('Missing TON wallet sheet');

  var wallets = IC_TON_readWalletConfig_(walletSheet);
  var previousBalances = IC_TON_readCurrentBalanceTotals_(ss);
  var syncStartedAt = new Date();

  IC_TON_refreshWalletBalanceSnapshot_(ss, wallets, syncStartedAt);
  IC_TON_syncBalanceSnapshotToCalculations_(ss, syncStartedAt, previousBalances);
}

function repairTonCostBasisFromTransactions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var transactionsSheet = ss.getSheetByName(IC_MAIN_TRANSACTIONS_SHEET);
  var calculationsSheet = ss.getSheetByName(IC_CALCULATIONS_SHEET);

  if (!transactionsSheet || !calculationsSheet) {
    throw new Error('Missing sheets for TON cost-basis repair');
  }

  var state = IC_TON_calculateCostBasisFromTransactions_(transactionsSheet, 'TON');
  var rowIndex = IC_TON_findAssetRow_(calculationsSheet, 'TON');
  if (!rowIndex) throw new Error('Missing TON row in Расчеты');

  var avgEntry = state.quantity ? state.costBasis / state.quantity : 0;
  calculationsSheet.getRange(rowIndex, 3).setValue(state.quantity);
  calculationsSheet.getRange(rowIndex, 4).setValue(avgEntry);
  calculationsSheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);

  return {
    asset: 'TON',
    quantity: state.quantity,
    avgEntry: avgEntry,
    invested: state.costBasis,
    realizedPnL: state.realizedPnl
  };
}

function IC_TON_calculateCostBasisFromTransactions_(sheet, targetAsset) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { quantity: 0, costBasis: 0, realizedPnl: 0 };

  var rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues().map(function(row, index) {
    return {
      index: index,
      date: IC_TON_parseTransactionDate_(row[0]),
      asset: IC_TON_normalizeAssetSymbol_(row[1]).toUpperCase(),
      action: String(row[3] || '').trim(),
      quantity: IC_TON_toNumber_(row[4]),
      price: IC_TON_toNumber_(row[5]),
      amount: IC_TON_toNumber_(row[6])
    };
  }).filter(function(row) {
    return row.asset === String(targetAsset || '').toUpperCase() && row.quantity;
  }).sort(function(left, right) {
    var byDate = left.date.getTime() - right.date.getTime();
    return byDate || left.index - right.index;
  });

  return rows.reduce(function(state, tx) {
    var amount = tx.amount || tx.quantity * tx.price;
    if (tx.action === 'Покупка') {
      state.quantity += tx.quantity;
      state.costBasis += amount;
      return state;
    }

    if (tx.action === 'Продажа') {
      var avgEntry = state.quantity ? state.costBasis / state.quantity : 0;
      var soldQuantity = Math.min(tx.quantity, state.quantity);
      var costBasisSold = soldQuantity * avgEntry;
      state.quantity = Math.max(0, state.quantity - soldQuantity);
      state.costBasis = Math.max(0, state.costBasis - costBasisSold);
      state.realizedPnl += amount - costBasisSold;
    }

    return state;
  }, { quantity: 0, costBasis: 0, realizedPnl: 0 });
}

function IC_TON_parseTransactionDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value;

  var parts = String(value || '').trim().split('.');
  if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));

  return new Date(0);
}

function IC_TON_readWalletConfig_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(1).map(function(row, index) {
    return {
      rowIndex: index + 2,
      walletId: IC_TON_cell_(row, headers, 'Wallet ID'),
      chain: IC_TON_cell_(row, headers, 'Chain'),
      address: IC_TON_cell_(row, headers, 'Address'),
      status: IC_TON_cell_(row, headers, 'Status'),
      allowedAssets: IC_TON_cell_(row, headers, 'Allowed Assets'),
      importMode: IC_TON_cell_(row, headers, 'Import Mode'),
      lastSeenLt: IC_TON_cell_(row, headers, 'Last Seen LT')
    };
  }).filter(function(wallet) {
    return wallet.walletId && wallet.address;
  });
}

function IC_TON_importRowToApprovedTransaction_(row, headers) {
  var action = IC_TON_cell_(row, headers, 'Действие');
  var asset = IC_TON_normalizeAssetSymbol_(IC_TON_cell_(row, headers, 'Актив'));
  var category = IC_TON_cell_(row, headers, 'Категория') || IC_TON_category_(asset);
  var quantity = IC_TON_toNumber_(IC_TON_cell_(row, headers, 'Количество'));
  var price = IC_TON_toNumber_(IC_TON_cell_(row, headers, 'Цена'));
  var amount = IC_TON_toNumber_(IC_TON_cell_(row, headers, 'Сумма'));
  var rawAsset = IC_TON_cell_(row, headers, 'Raw Asset');

  if ((action !== 'Покупка' && action !== 'Продажа') || asset !== 'TON' || !quantity || !amount) return null;
  if (!price) price = amount / quantity;

  return {
    date: IC_TON_cell_(row, headers, 'Дата'),
    asset: asset,
    category: category,
    action: action,
    quantity: quantity,
    price: price,
    amount: amount,
    sourceStable: IC_TON_sourceStableAsset_(rawAsset),
    comment: 'Approved TON wallet import: ' + IC_TON_cell_(row, headers, 'Import ID')
  };
}

function IC_TON_appendMainTransaction_(sheet, tx) {
  var targetRow = IC_TON_firstEmptyTransactionRow_(sheet);

  sheet.getRange(targetRow, 1, 1, 8).setValues([[
    tx.date,
    tx.asset,
    tx.category,
    tx.action,
    tx.quantity,
    tx.price,
    '',
    tx.comment
  ]]);
  sheet.getRange(targetRow, 7).setFormula('=IF(OR(E' + targetRow + '="";F' + targetRow + '="");"";E' + targetRow + '*F' + targetRow + ')');

  return targetRow;
}

function IC_TON_firstEmptyTransactionRow_(sheet) {
  var values = sheet.getRange(2, 1, sheet.getMaxRows() - 1, 8).getValues();

  for (var index = 0; index < values.length; index += 1) {
    var row = values[index];
    var hasAccountingValue = row.slice(0, 6).some(function(value) {
      return value !== '' && value !== null;
    });

    if (!hasAccountingValue) return index + 2;
  }

  return sheet.getLastRow() + 1;
}

function IC_TON_applyToCalculations_(sheet, tx) {
  if (tx.action === 'Покупка') {
    IC_TON_applyAssetPurchase_(sheet, tx.asset, tx.quantity, tx.amount);
    if (tx.sourceStable) IC_TON_applyStableSpend_(sheet, tx.sourceStable, tx.amount);
    return;
  }

  if (tx.action === 'Продажа') {
    var sale = IC_TON_applyAssetSale_(sheet, tx.asset, tx.quantity, tx.amount);
    if (tx.sourceStable) IC_TON_applyStableReceive_(sheet, tx.sourceStable, tx.amount);
    tx.comment += '; costBasisSold=' + IC_TON_round_(sale.costBasisSold, 6) + '; realizedPnL=' + IC_TON_round_(sale.realizedPnl, 6);
  }
}

function IC_TON_applyAssetPurchase_(sheet, asset, quantity, amount) {
  var rowIndex = IC_TON_findAssetRow_(sheet, asset);
  if (!rowIndex) throw new Error('Missing asset in Расчеты: ' + asset);

  var currentQuantity = IC_TON_toNumber_(sheet.getRange(rowIndex, 3).getValue());
  var currentAvgEntry = IC_TON_toNumber_(sheet.getRange(rowIndex, 4).getValue());
  var currentInvested = currentQuantity * currentAvgEntry;
  var nextQuantity = currentQuantity + quantity;
  var nextAvgEntry = nextQuantity ? (currentInvested + amount) / nextQuantity : 0;

  sheet.getRange(rowIndex, 3).setValue(nextQuantity);
  sheet.getRange(rowIndex, 4).setValue(nextAvgEntry);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_TON_applyStableSpend_(sheet, asset, amount) {
  var rowIndex = IC_TON_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  var currentQuantity = IC_TON_toNumber_(sheet.getRange(rowIndex, 3).getValue());
  var nextQuantity = Math.max(0, currentQuantity - amount);

  sheet.getRange(rowIndex, 3).setValue(nextQuantity);
  sheet.getRange(rowIndex, 4).setValue(1);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_TON_applyAssetSale_(sheet, asset, quantity, proceeds) {
  var rowIndex = IC_TON_findAssetRow_(sheet, asset);
  if (!rowIndex) throw new Error('Missing asset in Расчеты: ' + asset);

  var currentQuantity = IC_TON_toNumber_(sheet.getRange(rowIndex, 3).getValue());
  var currentAvgEntry = IC_TON_toNumber_(sheet.getRange(rowIndex, 4).getValue());
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

function IC_TON_applyStableReceive_(sheet, asset, amount) {
  var rowIndex = IC_TON_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  var currentQuantity = IC_TON_toNumber_(sheet.getRange(rowIndex, 3).getValue());
  var nextQuantity = currentQuantity + amount;

  sheet.getRange(rowIndex, 3).setValue(nextQuantity);
  sheet.getRange(rowIndex, 4).setValue(1);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_TON_findAssetRow_(sheet, asset) {
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var normalizedAsset = IC_TON_normalizeAssetSymbol_(asset).toUpperCase();

  for (var index = 0; index < values.length; index += 1) {
    if (IC_TON_normalizeAssetSymbol_(values[index][0]).toUpperCase() === normalizedAsset) return index + 1;
  }

  return 0;
}

function IC_TON_sourceStableAsset_(rawAsset) {
  var parts = String(rawAsset || '').split('->').map(function(part) {
    return IC_TON_normalizeAssetSymbol_(part).trim();
  });

  return parts.find(function(asset) {
    return IC_TON_isStable_(asset);
  }) || '';
}

function IC_TON_readExistingImportIds_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  return sheet.getRange(2, 1, lastRow - 1, 1).getValues().reduce(function(index, row) {
    var importId = String(row[0] || '').trim();
    if (importId) index[importId] = true;
    return index;
  }, {});
}

function IC_TON_refreshWalletBalanceSnapshot_(ss, wallets, syncStartedAt) {
  var balanceSheet = IC_TON_getOrCreateBalanceSheet_(ss);
  var rows = [];

  wallets.forEach(function(wallet) {
    if (wallet.chain !== 'TON' || wallet.status !== 'ACTIVE') return;

    rows = rows.concat(IC_TON_fetchWalletBalanceRows_(wallet, syncStartedAt));
  });

  balanceSheet.clearContents();
  var headers = IC_TON_balanceHeaders_();
  balanceSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows.length) balanceSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function IC_TON_balanceHeaders_() {
  return [
    'Wallet ID',
    'Chain',
    'Asset',
    'Balance Type',
    'Quantity',
    'Category',
    'Source',
    'Last Sync At',
    'Raw Asset',
    'Raw Quantity',
    'Conversion Rate',
    'Conversion Note'
  ];
}

function IC_TON_getOrCreateBalanceSheet_(ss) {
  return ss.getSheetByName(IC_TON_BALANCES_SHEET) || ss.insertSheet(IC_TON_BALANCES_SHEET);
}

function IC_TON_fetchWalletBalanceRows_(wallet, syncStartedAt) {
  var rows = [];
  var syncAt = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  var account = IC_TON_fetchJson_('/accounts/' + encodeURIComponent(wallet.address));
  var tonQuantity = IC_TON_units_(account.balance || account.account && account.account.balance, 9);

  if (tonQuantity) {
    rows.push(IC_TON_balanceRow_(wallet, 'TON', 'LIQUID', tonQuantity, tonQuantity, 1, 'TonAPI account balance', syncAt, 'TON'));
  }

  var jettons = IC_TON_fetchJson_('/accounts/' + encodeURIComponent(wallet.address) + '/jettons');
  var balances = Array.isArray(jettons.balances) ? jettons.balances : [];

  balances.forEach(function(item) {
    var jetton = item.jetton || item.jetton_master || item.token || {};
    var asset = IC_TON_assetSymbol_(jetton);
    if (!asset) return;
    if (!IC_TON_isAllowedWalletAsset_(wallet, asset)) return;

    var quantity = IC_TON_units_(item.balance || item.quantity || item.amount, IC_TON_decimals_(jetton, asset));
    if (!quantity) return;

    var isStakedTon = IC_TON_isStakedTonAsset_(asset);
    var balanceType = isStakedTon ? 'STAKED' : 'JETTON';
    var portfolioAsset = isStakedTon ? 'TON' : asset;
    var tonEquivalent = isStakedTon ? quantity * IC_TON_STAKED_EXCHANGE_RATE : quantity;
    var conversionRate = isStakedTon ? IC_TON_STAKED_EXCHANGE_RATE : 1;
    rows.push(IC_TON_balanceRow_(wallet, portfolioAsset, balanceType, tonEquivalent, quantity, conversionRate, 'TonAPI jetton balance', syncAt, asset));
  });

  return rows;
}

function IC_TON_balanceRow_(wallet, asset, balanceType, quantity, rawQuantity, conversionRate, source, syncAt, rawAsset) {
  return [
    wallet.walletId,
    'TON',
    asset,
    balanceType,
    quantity,
    IC_TON_category_(asset),
    source,
    syncAt,
    rawAsset || asset,
    rawQuantity,
    conversionRate,
    balanceType === 'STAKED' ? 'Manual tsTON/TON rate from Tonstakers screenshot' : '1:1'
  ];
}

function IC_TON_syncBalanceSnapshotToCalculations_(ss, syncStartedAt, previousBalances) {
  var balanceSheet = ss.getSheetByName(IC_TON_BALANCES_SHEET);
  var calculationsSheet = ss.getSheetByName(IC_CALCULATIONS_SHEET);
  var importSheet = ss.getSheetByName(IC_TON_IMPORT_SHEET);

  if (!balanceSheet || !calculationsSheet) return;

  var appliedSwapCount = importSheet ? IC_TON_applyNewSwapCostBasis_(importSheet, calculationsSheet, syncStartedAt) : 0;

  var balances = IC_TON_readBalanceTotals_(balanceSheet);
  IC_TON_assertSaneWalletBalance_('TON', balances.TON || 0);
  IC_TON_assertSaneWalletBalance_('USDT', balances.USDT || 0);

  if (!appliedSwapCount) {
    IC_TON_applyBalanceDeltaCostBasis_(calculationsSheet, importSheet, previousBalances, balances, syncStartedAt);
  }

  IC_TON_setCalculationQuantity_(calculationsSheet, 'TON', balances.TON || 0);
  IC_TON_setCalculationQuantity_(calculationsSheet, 'USDT', balances.USDT || 0);
}

function IC_TON_readCurrentBalanceTotals_(ss) {
  var balanceSheet = ss.getSheetByName(IC_TON_BALANCES_SHEET);
  return balanceSheet ? IC_TON_readBalanceTotals_(balanceSheet) : {};
}

function IC_TON_assertSaneWalletBalance_(asset, quantity) {
  if (asset === 'TON' && quantity > 1000) {
    throw new Error('Unsafe TON wallet balance detected: ' + quantity + '. Sync stopped before writing to Расчеты.');
  }

  if ((asset === 'USDT' || asset === 'USDC') && quantity > 100000) {
    throw new Error('Unsafe stable wallet balance detected: ' + asset + ' ' + quantity + '. Sync stopped before writing to Расчеты.');
  }
}

function IC_TON_isAllowedWalletAsset_(wallet, asset) {
  var normalizedAsset = IC_TON_normalizeAssetSymbol_(asset).toUpperCase();
  var allowed = String(wallet.allowedAssets || '').toUpperCase().split(',').map(function(item) {
    return item.trim();
  });

  return allowed.indexOf(normalizedAsset) >= 0;
}

function IC_TON_readBalanceTotals_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  var values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  return values.reduce(function(totals, row) {
    var asset = IC_TON_normalizeAssetSymbol_(row[2]).toUpperCase();
    var quantity = IC_TON_toNumber_(row[4]);
    if (!asset || !quantity) return totals;

    totals[asset] = (totals[asset] || 0) + quantity;
    return totals;
  }, {});
}

function IC_TON_applyNewSwapCostBasis_(importSheet, calculationsSheet, syncStartedAt) {
  var values = importSheet.getDataRange().getValues();
  if (values.length < 2) return 0;

  var headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  var appliedCount = 0;

  values.slice(1).forEach(function(row, index) {
    var rowIndex = index + 2;
    var status = IC_TON_cell_(row, headers, 'Status');
    var note = IC_TON_cell_(row, headers, 'Review Note');
    if (status === 'SKIPPED' || IC_TON_isImportAlreadyApplied_(note)) return;

    var action = IC_TON_cell_(row, headers, 'Действие');
    var asset = IC_TON_normalizeAssetSymbol_(IC_TON_cell_(row, headers, 'Актив'));
    var direction = IC_TON_cell_(row, headers, 'Direction');
    var quantity = IC_TON_toNumber_(IC_TON_cell_(row, headers, 'Количество'));
    var amount = IC_TON_toNumber_(IC_TON_cell_(row, headers, 'Сумма'));
    var price = IC_TON_toNumber_(IC_TON_cell_(row, headers, 'Цена'));

    if (action !== 'Покупка' || direction !== 'SWAP' || asset !== 'TON' || !quantity || !amount) return;
    if (amount > 10000 || price > 100 || price < 0.01) return;

    IC_TON_applyAssetPurchase_(calculationsSheet, asset, quantity, amount);
    appliedCount += 1;
    importSheet.getRange(rowIndex, 19).setValue('BALANCE_APPLIED at ' + Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") + '. ' + note);
  });

  return appliedCount;
}

function IC_TON_applyBalanceDeltaCostBasis_(sheet, importSheet, previousBalances, currentBalances, syncStartedAt) {
  if (!previousBalances || !currentBalances) return;

  var usdtDelta = (currentBalances.USDT || 0) - (previousBalances.USDT || 0);
  var tonDelta = (currentBalances.TON || 0) - (previousBalances.TON || 0);
  var usdtSpent = -usdtDelta;
  var usdtReceived = usdtDelta;
  var tonReceived = tonDelta;
  var tonSold = -tonDelta;
  var impliedBuyPrice = tonReceived ? usdtSpent / tonReceived : 0;
  var impliedSellPrice = tonSold ? usdtReceived / tonSold : 0;

  if (usdtSpent > 0.5 && tonReceived > 0.0001 && usdtSpent <= 10000 && impliedBuyPrice >= 0.01 && impliedBuyPrice <= 100) {
    IC_TON_applyAssetPurchase_(sheet, 'TON', tonReceived, usdtSpent);
    if (importSheet) {
      IC_TON_appendBalanceDeltaBuyAuditRow_(importSheet, tonReceived, impliedBuyPrice, usdtSpent, syncStartedAt);
    }
    return;
  }

  if (usdtReceived > 0.5 && tonSold > 0.0001 && usdtReceived <= 10000 && impliedSellPrice >= 0.01 && impliedSellPrice <= 100) {
    var sale = IC_TON_applyAssetSale_(sheet, 'TON', tonSold, usdtReceived);
    if (importSheet) {
      IC_TON_appendBalanceDeltaSellAuditRow_(importSheet, tonSold, impliedSellPrice, usdtReceived, sale, syncStartedAt);
    }
  }
}

function IC_TON_appendBalanceDeltaBuyAuditRow_(sheet, tonReceived, impliedPrice, usdtSpent, syncStartedAt) {
  var syncId = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss");
  var importId = [
    'TON_BALANCE_DELTA',
    syncId,
    'USDT_TO_TON',
    IC_TON_round_(usdtSpent, 6),
    IC_TON_round_(tonReceived, 9)
  ].join(':');

  if (IC_TON_readExistingImportIds_(sheet)[importId]) return;

  IC_TON_appendRows_(sheet, [[
    importId,
    'PENDING',
    Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
    'TON',
    'Крипта',
    'Покупка',
    tonReceived,
    impliedPrice,
    usdtSpent,
    'TON wallet balance delta; already applied to Расчеты',
    'ton-wallet-balance-delta',
    'TON',
    'BALANCE_DELTA',
    '',
    'SWAP',
    '',
    'USDT -> TON',
    IC_TON_round_(usdtSpent, 6) + ' -> ' + IC_TON_round_(tonReceived, 9),
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") + '. Do not approve again; cost basis was applied from wallet balance delta.'
  ]]);
}

function IC_TON_appendBalanceDeltaSellAuditRow_(sheet, tonSold, impliedPrice, usdtReceived, sale, syncStartedAt) {
  var syncId = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss");
  var importId = [
    'TON_BALANCE_DELTA',
    syncId,
    'TON_TO_USDT',
    IC_TON_round_(tonSold, 9),
    IC_TON_round_(usdtReceived, 6)
  ].join(':');

  if (IC_TON_readExistingImportIds_(sheet)[importId]) return;

  IC_TON_appendRows_(sheet, [[
    importId,
    'PENDING',
    Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
    'TON',
    'Крипта',
    'Продажа',
    tonSold,
    impliedPrice,
    usdtReceived,
    'TON wallet balance delta; already applied to Расчеты',
    'ton-wallet-balance-delta',
    'TON',
    'BALANCE_DELTA',
    '',
    'SWAP',
    '',
    'TON -> USDT',
    IC_TON_round_(tonSold, 9) + ' -> ' + IC_TON_round_(usdtReceived, 6),
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") +
      '. Do not approve again; cost basis was reduced at avgEntry ' + IC_TON_round_(sale.avgEntry, 9) +
      '; costBasisSold=' + IC_TON_round_(sale.costBasisSold, 6) +
      '; realizedPnL=' + IC_TON_round_(sale.realizedPnl, 6) + '.'
  ]]);
}

function IC_TON_setCalculationQuantity_(sheet, asset, quantity) {
  var rowIndex = IC_TON_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  sheet.getRange(rowIndex, 3).setValue(quantity);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_TON_fetchJson_(path) {
  var headers = { Accept: 'application/json' };
  var apiKey = PropertiesService.getScriptProperties().getProperty('TONAPI_KEY');
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey;

  var response = UrlFetchApp.fetch(IC_TON_API_BASE_URL + path, {
    method: 'get',
    muteHttpExceptions: true,
    headers: headers
  });

  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('TON API request failed: ' + statusCode + ' ' + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

function IC_TON_fetchTransactions_(wallet) {
  var params = {
    limit: IC_TON_FETCH_LIMIT,
    initiator: false
  };

  // TonAPI actions are display-level events, so every row stays pending for manual review.
  if (!wallet.lastSeenLt) params.start_date = Math.floor(Date.now() / 1000) - IC_TON_DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60;

  var url = IC_TON_API_BASE_URL + '/accounts/' + encodeURIComponent(wallet.address) + '/events?' + IC_TON_toQueryString_(params);
  var headers = { Accept: 'application/json' };
  var apiKey = PropertiesService.getScriptProperties().getProperty('TONAPI_KEY');
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey;

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: headers
  });

  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('TON API request failed: ' + statusCode + ' ' + response.getContentText());
  }

  var json = JSON.parse(response.getContentText());
  var events = Array.isArray(json.events) ? json.events : [];

  return events.sort(function(left, right) {
    return Number(IC_TON_eventLt_(left)) - Number(IC_TON_eventLt_(right));
  });
}

function IC_TON_normalizeTransaction_(wallet, event) {
  var eventId = String(event.event_id || event.id || event.hash || event.trace_id || '').trim();
  var lt = IC_TON_eventLt_(event);
  if (!eventId || !lt) return [];

  var createdAt = event.timestamp ? new Date(Number(event.timestamp) * 1000) : new Date();
  var actions = Array.isArray(event.actions) && event.actions.length ? event.actions : [{ type: 'Event', Event: event }];
  var rows = [];

  actions.forEach(function(action, actionIndex) {
    var normalized = IC_TON_normalizeAction_(wallet, event, action, actionIndex, eventId, lt, createdAt);
    if (normalized) rows.push(normalized);
  });

  return rows;
}

function IC_TON_normalizeAction_(wallet, event, action, actionIndex, eventId, lt, createdAt) {
  var type = String(action.type || 'Event');
  var typeLower = type.toLowerCase();
  var payload = IC_TON_actionPayload_(action, type);
  var status = IC_TON_actionStatus_(action);

  if (typeLower.indexOf('swap') >= 0) {
    return IC_TON_normalizeSwapAction_(wallet, action, payload, actionIndex, eventId, lt, createdAt, status);
  }

  if (typeLower.indexOf('jettontransfer') >= 0) {
    return IC_TON_normalizeJettonTransfer_(wallet, action, payload, actionIndex, eventId, lt, createdAt, status);
  }

  if (typeLower.indexOf('tontransfer') >= 0) {
    return IC_TON_normalizeTonTransfer_(wallet, action, payload, actionIndex, eventId, lt, createdAt, status);
  }

  if (IC_TON_textContains_(payload, 'tonstakers') || IC_TON_textContains_(payload, 'stton') || typeLower.indexOf('stake') >= 0) {
    return IC_TON_baseImport_(wallet, actionIndex, eventId, lt, createdAt, {
      status: status === 'failed' ? 'SKIPPED' : 'PENDING',
      asset: 'TON',
      action: 'Стейкинг',
      direction: 'UNKNOWN',
      rawAsset: type,
      reviewNote: IC_TON_reviewNote_(status, 'Staking-related TON event imported from public wallet. Review manually before accounting.')
    });
  }

  return IC_TON_baseImport_(wallet, actionIndex, eventId, lt, createdAt, {
    status: status === 'failed' ? 'SKIPPED' : 'PENDING',
    action: 'Перевод',
    direction: 'UNKNOWN',
    rawAsset: type,
    reviewNote: IC_TON_reviewNote_(status, 'TON wallet event imported from public wallet. Review action/asset manually.')
  });
}

function IC_TON_normalizeSwapAction_(wallet, action, payload, actionIndex, eventId, lt, createdAt, status) {
  var assetIn = IC_TON_assetSymbol_(IC_TON_pickFirst_(payload, ['asset_in', 'token_in', 'jetton_master_in', 'jetton_in', 'in_token']));
  var assetOut = IC_TON_assetSymbol_(IC_TON_pickFirst_(payload, ['asset_out', 'token_out', 'jetton_master_out', 'jetton_out', 'out_token']));

  if (!assetIn && IC_TON_toNumber_(IC_TON_pickFirst_(payload, ['ton_in', 'tonIn'])) > 0) assetIn = 'TON';
  if (!assetOut && IC_TON_toNumber_(IC_TON_pickFirst_(payload, ['ton_out', 'tonOut'])) > 0) assetOut = 'TON';

  var amountIn = IC_TON_amount_(IC_TON_pickFirst_(payload, ['amount_in', 'amountIn', 'offer_amount', 'ask_amount']), IC_TON_assetDecimals_(assetIn));
  var amountOut = IC_TON_amount_(IC_TON_pickFirst_(payload, ['amount_out', 'amountOut', 'return_amount', 'min_out']), IC_TON_assetDecimals_(assetOut));
  var actionName = 'Обмен';
  if (IC_TON_isStable_(assetIn) && assetOut && !IC_TON_isStable_(assetOut)) actionName = 'Покупка';
  if (assetIn && !IC_TON_isStable_(assetIn) && IC_TON_isStable_(assetOut)) actionName = 'Продажа';

  var asset = actionName === 'Продажа' ? assetIn : assetOut || assetIn || 'TON';
  var quantity = actionName === 'Продажа' ? amountIn : amountOut || '';
  var amount = IC_TON_isStable_(assetIn) ? amountIn : IC_TON_isStable_(assetOut) ? amountOut : '';
  var price = amount && quantity ? amount / quantity : '';

  return IC_TON_baseImport_(wallet, actionIndex, eventId, lt, createdAt, {
    status: status === 'failed' ? 'SKIPPED' : IC_TON_allowedStatus_(wallet, asset),
    asset: asset,
    category: IC_TON_category_(asset),
    action: actionName,
    quantity: quantity,
    price: price,
    amount: amount,
    comment: 'TON wallet swap import; review before accounting',
    direction: 'SWAP',
    counterparty: IC_TON_counterpartyFromPayload_(payload),
    rawAsset: [assetIn || '?', assetOut || '?'].join(' -> '),
    rawAmount: [amountIn || '?', amountOut || '?'].join(' -> '),
    reviewNote: IC_TON_reviewNote_(status, 'Swap imported from public wallet. Confirm received asset, paid asset and USD price before copying to Транзакции.')
  });
}

function IC_TON_normalizeJettonTransfer_(wallet, action, payload, actionIndex, eventId, lt, createdAt, status) {
  var asset = IC_TON_assetSymbol_(IC_TON_pickFirst_(payload, ['jetton', 'asset', 'token'])) || 'JETTON';
  var decimals = IC_TON_decimals_(IC_TON_pickFirst_(payload, ['jetton', 'asset', 'token']), asset);
  var quantity = IC_TON_amount_(IC_TON_pickFirst_(payload, ['amount', 'value']), decimals);
  var sender = IC_TON_address_(IC_TON_pickFirst_(payload, ['sender', 'source', 'from']));
  var recipient = IC_TON_address_(IC_TON_pickFirst_(payload, ['recipient', 'destination', 'to']));
  var direction = IC_TON_direction_(wallet.address, sender, recipient);
  var actionName = asset.toUpperCase() === 'STTON' ? 'Стейкинг' : 'Перевод';

  return IC_TON_baseImport_(wallet, actionIndex, eventId, lt, createdAt, {
    status: status === 'failed' ? 'SKIPPED' : IC_TON_allowedStatus_(wallet, asset),
    asset: asset,
    category: IC_TON_category_(asset),
    action: actionName,
    quantity: quantity,
    direction: direction,
    counterparty: direction === 'IN' ? sender : recipient,
    rawAsset: asset,
    rawAmount: String(IC_TON_pickFirst_(payload, ['amount', 'value']) || ''),
    reviewNote: IC_TON_reviewNote_(status, 'Jetton transfer imported from public TON wallet. Review manually before accounting.')
  });
}

function IC_TON_normalizeTonTransfer_(wallet, action, payload, actionIndex, eventId, lt, createdAt, status) {
  var amount = IC_TON_amount_(IC_TON_pickFirst_(payload, ['amount', 'value']), 9);
  var sender = IC_TON_address_(IC_TON_pickFirst_(payload, ['sender', 'source', 'from']));
  var recipient = IC_TON_address_(IC_TON_pickFirst_(payload, ['recipient', 'destination', 'to']));
  var direction = IC_TON_direction_(wallet.address, sender, recipient);
  var stakingLike = IC_TON_textContains_(payload, 'tonstakers') || IC_TON_textContains_(payload, 'stake');

  return IC_TON_baseImport_(wallet, actionIndex, eventId, lt, createdAt, {
    status: status === 'failed' ? 'SKIPPED' : 'PENDING',
    asset: 'TON',
    action: stakingLike ? 'Стейкинг' : 'Перевод',
    quantity: amount,
    direction: direction,
    counterparty: direction === 'IN' ? sender : recipient,
    rawAsset: 'TON',
    rawAmount: String(IC_TON_pickFirst_(payload, ['amount', 'value']) || ''),
    reviewNote: IC_TON_reviewNote_(status, stakingLike
      ? 'TON staking/deposit transfer imported. Usually this is not a sale; review manually.'
      : 'TON transfer imported from public wallet. Review before accounting.')
  });
}

function IC_TON_baseImport_(wallet, actionIndex, eventId, lt, createdAt, overrides) {
  overrides = overrides || {};

  return {
    importId: ['TON', wallet.address, eventId, lt, actionIndex].join(':'),
    status: 'PENDING',
    date: Utilities.formatDate(createdAt, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
    asset: overrides.asset || 'TON',
    category: overrides.category || IC_TON_category_(overrides.asset || 'TON'),
    action: overrides.action || 'Перевод',
    quantity: overrides.quantity || '',
    price: overrides.price || '',
    amount: overrides.amount || '',
    comment: overrides.comment || 'TON wallet import; review before accounting',
    walletId: wallet.walletId,
    chain: 'TON',
    hash: eventId,
    lt: lt,
    direction: overrides.direction || 'UNKNOWN',
    counterparty: overrides.counterparty || '',
    rawAsset: overrides.rawAsset || 'TON',
    rawAmount: overrides.rawAmount || '',
    reviewNote: overrides.reviewNote || 'Imported from public TON wallet. Review action/price before copying to Транзакции.',
    statusOverride: overrides.status
  };
}

function IC_TON_toImportRow_(tx) {
  return [
    tx.importId,
    tx.statusOverride || tx.status,
    tx.date,
    tx.asset,
    tx.category,
    tx.action,
    tx.quantity,
    tx.price,
    tx.amount,
    tx.comment,
    tx.walletId,
    tx.chain,
    tx.hash,
    tx.lt,
    tx.direction,
    tx.counterparty,
    tx.rawAsset,
    tx.rawAmount,
    tx.reviewNote
  ];
}

function IC_TON_appendRows_(sheet, rows) {
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function IC_TON_updateWalletSyncState_(sheet, rowIndex, lastSeenLt, date) {
  if (lastSeenLt) sheet.getRange(rowIndex, 7).setValue(String(lastSeenLt));
  sheet.getRange(rowIndex, 8).setValue(Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"));
}

function IC_TON_eventLt_(event) {
  var candidates = [event.lt, event.logical_time, event.account_lt];
  var actions = Array.isArray(event.actions) ? event.actions : [];

  actions.forEach(function(action) {
    var baseTransactions = action.base_transactions || action.baseTransactions || [];
    if (!Array.isArray(baseTransactions)) return;

    baseTransactions.forEach(function(tx) {
      candidates.push(tx.lt || tx.logical_time || tx.transaction_id);
    });
  });

  return candidates.reduce(function(max, value) {
    var numberValue = IC_TON_toNumber_(value);
    return numberValue > max ? numberValue : max;
  }, 0).toString();
}

function IC_TON_actionPayload_(action, type) {
  if (!action) return {};

  return action[type] || action[type.charAt(0).toLowerCase() + type.slice(1)] || action[type.toLowerCase()] || action;
}

function IC_TON_actionStatus_(action) {
  return String(action && action.status || '').toLowerCase();
}

function IC_TON_reviewNote_(status, message) {
  if (status === 'failed') return 'Failed TON action; kept as SKIPPED for audit. ' + message;

  return message;
}

function IC_TON_isImportAlreadyApplied_(reviewNote) {
  var note = String(reviewNote || '').trim();
  return note.indexOf('APPLIED') === 0 || note.indexOf('BALANCE_APPLIED') === 0;
}

function IC_TON_allowedStatus_(wallet, asset) {
  var allowed = String(wallet.allowedAssets || '').toUpperCase().split(',').map(function(item) {
    return item.trim();
  });

  return allowed.indexOf(String(asset || '').toUpperCase()) >= 0 ? 'PENDING' : 'SKIPPED';
}

function IC_TON_category_(asset) {
  return IC_TON_isStable_(asset) ? 'Кэш / Стейблы' : 'Крипта';
}

function IC_TON_isStable_(asset) {
  var symbol = String(asset || '').toUpperCase();
  return symbol === 'USDT' || symbol === 'USDC';
}

function IC_TON_assetSymbol_(asset) {
  if (!asset) return '';
  if (typeof asset === 'string') return IC_TON_normalizeAssetSymbol_(asset);

  return IC_TON_normalizeAssetSymbol_(asset.symbol || asset.ticker || asset.name || asset.address || '');
}

function IC_TON_normalizeAssetSymbol_(asset) {
  var symbol = String(asset || '').trim();
  var normalized = symbol.toUpperCase().replace(/\s/g, '');

  if (normalized === 'USD₮' || normalized === 'USDTON' || normalized === 'TETHERUSD') return 'USDT';
  if (normalized === 'USDCOIN') return 'USDC';
  if (normalized === 'STTON') return 'stTON';
  if (normalized === 'TSTON') return 'tsTON';

  return symbol;
}

function IC_TON_isStakedTonAsset_(asset) {
  var symbol = String(asset || '').toUpperCase();
  return symbol === 'STTON' || symbol === 'TSTON';
}

function IC_TON_decimals_(asset, fallbackAsset) {
  if (!asset || typeof asset !== 'object') return IC_TON_assetDecimals_(fallbackAsset);

  var decimals = Number(asset.decimals);
  return Number.isFinite(decimals) ? decimals : IC_TON_assetDecimals_(fallbackAsset);
}

function IC_TON_assetDecimals_(asset) {
  var symbol = String(asset || '').toUpperCase();

  if (symbol === 'USDT' || symbol === 'USDC') return 6;

  return 9;
}

function IC_TON_amount_(rawAmount, decimals) {
  var amount = IC_TON_toNumber_(rawAmount);
  if (!amount) return '';

  var scale = Math.pow(10, decimals === undefined ? 9 : decimals);
  if (amount >= scale) return amount / scale;

  return amount;
}

function IC_TON_units_(rawAmount, decimals) {
  var amount = IC_TON_toNumber_(rawAmount);
  if (!amount) return '';

  return amount / Math.pow(10, decimals === undefined ? 9 : decimals);
}

function IC_TON_pickFirst_(object, keys) {
  if (!object) return '';

  for (var i = 0; i < keys.length; i += 1) {
    if (object[keys[i]] !== undefined && object[keys[i]] !== null && object[keys[i]] !== '') return object[keys[i]];
  }

  return '';
}

function IC_TON_address_(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;

  return String(value.address || value.account_address || value.user_friendly || value.name || '').trim();
}

function IC_TON_direction_(walletAddress, sender, recipient) {
  if (IC_TON_addressesMatch_(recipient, walletAddress)) return 'IN';
  if (IC_TON_addressesMatch_(sender, walletAddress)) return 'OUT';

  return 'UNKNOWN';
}

function IC_TON_counterpartyFromPayload_(payload) {
  return IC_TON_address_(IC_TON_pickFirst_(payload, ['router', 'dex', 'recipient', 'sender', 'source', 'destination']));
}

function IC_TON_textContains_(value, pattern) {
  return IC_TON_safeStringify_(value).toLowerCase().indexOf(String(pattern).toLowerCase()) >= 0;
}

function IC_TON_safeStringify_(value) {
  try {
    return JSON.stringify(value || {});
  } catch (error) {
    return String(value || '');
  }
}

function IC_TON_messageValue_(message) {
  if (!message) return 0;

  return IC_TON_toNumber_(message.value);
}

function IC_TON_pickOutgoingValue_(messages) {
  return messages.reduce(function(sum, message) {
    return sum + IC_TON_messageValue_(message);
  }, 0);
}

function IC_TON_counterparty_(inMsg, outMsgs, walletAddress, direction) {
  if (direction === 'IN') return String(inMsg.source || inMsg.src || '').trim();

  if (direction === 'OUT') {
    var firstExternalOut = outMsgs.find(function(message) {
      return !IC_TON_addressesMatch_(String(message.destination || message.dest || ''), walletAddress);
    });

    return firstExternalOut ? String(firstExternalOut.destination || firstExternalOut.dest || '').trim() : '';
  }

  return '';
}

function IC_TON_addressesMatch_(left, right) {
  if (!left || !right) return false;
  return String(left).trim() === String(right).trim();
}

function IC_TON_cell_(row, headers, name) {
  var index = headers.indexOf(name);
  return index >= 0 ? String(row[index] || '').trim() : '';
}

function IC_TON_toNumber_(value) {
  var parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function IC_TON_round_(value, digits) {
  var parsed = IC_TON_toNumber_(value);
  return Number(parsed.toFixed(digits));
}

function IC_TON_toQueryString_(params) {
  return Object.keys(params)
    .filter(function(key) {
      return params[key] !== undefined && params[key] !== null && params[key] !== '';
    })
    .map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    })
    .join('&');
}
