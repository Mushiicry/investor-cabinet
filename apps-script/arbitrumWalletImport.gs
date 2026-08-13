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
// USDT (Arbitrum One). Отслеживается всегда: без него пополнения кошелька
// стейблами и обмены стейбл-в-стейбл невидимы для истории сделок (кейс 2026-07-17:
// вывод 61.34 USDT с Bybit + свап в USDC прошли мимо отчётов).
var IC_EVM_ARBITRUM_USDT = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
var IC_EVM_USDT_CALC_ASSET = 'USDT ARB'; // имя строки в «Расчетах»
// APEX (ApeX Protocol) — ERC-20 на Arbitrum. Покупки идут через Uniswap за
// USDT/USDC, поэтому импорт должен видеть не только ETH, но и этот токен.
var IC_EVM_TRACKED_TOKENS = [
  {
    symbol: 'APEX',
    contract: '0x61A1ff55C5216b636a294A07D77C6F4Df10d3B56',
    decimals: 18,
    category: 'Крипта',
    minQuantity: 0.000001,
    minPrice: 0.000001,
    maxPrice: 100000,
    maxQuantity: 1000000
  }
];
// Порог «заметного» движения актива (ETH). Ниже — газ и пыль, выше — событие,
// которое обязано попасть в историю, даже если пары в стейблах не нашлось.
var IC_EVM_UNPAIRED_ASSET_THRESHOLD = 0.0002;

function setupArbitrumWalletImport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var walletSheet = IC_EVM_getOrCreateWalletSheet_(ss);
  IC_EVM_getOrCreateBalanceSheet_(ss);
  IC_EVM_ensureTrackedAssetsAllowed_(walletSheet);
  IC_EVM_ensureTrackedPortfolioRows_(ss);
}

function syncArbitrumWalletBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var walletSheet = IC_EVM_getOrCreateWalletSheet_(ss);
  var balanceSheet = IC_EVM_getOrCreateBalanceSheet_(ss);
  var calculationsSheet = ss.getSheetByName(IC_EVM_CALCULATIONS_SHEET);
  var importSheet = ss.getSheetByName(IC_EVM_IMPORT_SHEET);
  IC_EVM_ensureTrackedAssetsAllowed_(walletSheet);
  IC_EVM_ensureTrackedPortfolioRows_(ss);
  var wallets = IC_EVM_readWalletConfig_(walletSheet);
  var previousBalances = IC_EVM_readBalanceTotals_(balanceSheet);
  var syncStartedAt = new Date();
  var blockTag = IC_EVM_fetchBlockTag_();
  var rows = [];

  wallets.forEach(function(wallet) {
    if (wallet.chain !== IC_EVM_DEFAULT_CHAIN || wallet.status !== 'ACTIVE') return;
    rows = rows.concat(IC_EVM_fetchWalletBalanceRows_(wallet, syncStartedAt, blockTag));
    IC_EVM_updateWalletSyncState_(walletSheet, wallet.rowIndex, syncStartedAt);
  });

  IC_EVM_writeBalanceSnapshot_(balanceSheet, rows);

  var currentBalances = IC_EVM_readBalanceTotals_(balanceSheet);
  IC_EVM_assertSaneWalletBalance_('ETH', currentBalances.ETH || 0);
  IC_EVM_assertSaneWalletBalance_('USDC', currentBalances.USDC || 0);
  IC_EVM_TRACKED_TOKENS.forEach(function(token) {
    IC_EVM_assertSaneWalletBalance_(token.symbol, currentBalances[token.symbol] || 0);
  });

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

function IC_EVM_ensureTrackedAssetsAllowed_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  var headers = values[0].map(function(header) {
    return String(header || '').trim();
  });
  var allowedIndex = headers.indexOf('Allowed Assets');
  var chainIndex = headers.indexOf('Chain');
  var statusIndex = headers.indexOf('Status');
  if (allowedIndex < 0) return;

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    var chain = chainIndex >= 0 ? String(values[rowIndex][chainIndex] || '').trim() : '';
    var status = statusIndex >= 0 ? String(values[rowIndex][statusIndex] || '').trim() : '';
    if (chain !== IC_EVM_DEFAULT_CHAIN || status !== 'ACTIVE') continue;

    var current = String(values[rowIndex][allowedIndex] || '').trim();
    var allowed = current ? current.split(',').map(function(item) { return item.trim(); }).filter(Boolean) : [];
    var indexByAsset = allowed.reduce(function(index, asset) {
      index[String(asset).toUpperCase()] = true;
      return index;
    }, {});
    var changed = false;

    IC_EVM_TRACKED_TOKENS.forEach(function(token) {
      if (indexByAsset[token.symbol]) return;
      allowed.push(token.symbol);
      indexByAsset[token.symbol] = true;
      changed = true;
    });

    if (changed) sheet.getRange(rowIndex + 1, allowedIndex + 1).setValue(allowed.join(','));
  }
}

function IC_EVM_ensureTrackedPortfolioRows_(ss) {
  var sheet = ss.getSheetByName(IC_EVM_CALCULATIONS_SHEET);
  if (!sheet) return;

  IC_EVM_TRACKED_TOKENS.forEach(function(token) {
    IC_EVM_ensurePortfolioRow_(sheet, token.symbol, token.category);
  });
}

function IC_EVM_ensurePortfolioRow_(sheet, asset, category) {
  if (IC_EVM_findAssetRow_(sheet, asset)) return;

  var templateRow = IC_EVM_findAssetRow_(sheet, 'ETH');
  if (!templateRow) throw new Error('Нет спотовой строки-образца ETH в Расчетах');

  var lastRow = sheet.getLastRow();
  var values = sheet.getRange(2, 1, Math.max(1, lastRow - 1), 1).getValues();
  var blankRow = 0;
  for (var index = 0; index < values.length; index += 1) {
    if (String(values[index][0]).trim() === '') {
      blankRow = index + 2;
      break;
    }
  }
  if (!blankRow) throw new Error('Нет пустой строки в Расчетах для ' + asset);

  sheet.getRange(blankRow, 1).setValue(asset);
  sheet.getRange(blankRow, 2).setValue(category || 'Крипта');
  sheet.getRange(blankRow, 3).setValue(0);
  sheet.getRange(blankRow, 4).setValue(0);
  sheet.getRange(blankRow, 5).setFormula('=C' + blankRow + '*D' + blankRow);
  sheet.getRange(templateRow, 6, 1, 6).copyTo(sheet.getRange(blankRow, 6, 1, 6));
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

function IC_EVM_fetchWalletBalanceRows_(wallet, syncStartedAt, blockTag) {
  var rows = [];
  var syncAt = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");

  if (IC_EVM_isAllowedWalletAsset_(wallet, 'ETH')) {
    var ethQuantity = IC_EVM_fetchNativeBalance_(wallet.address, blockTag);
    if (ethQuantity) rows.push(IC_EVM_balanceRow_(wallet, 'ETH', 'NATIVE', ethQuantity, syncAt, 'ETH', 18, 'Arbitrum public RPC eth_getBalance'));
  }

  if (IC_EVM_isAllowedWalletAsset_(wallet, 'USDC')) {
    var usdcQuantity = IC_EVM_fetchErc20Balance_(wallet.address, IC_EVM_ARBITRUM_NATIVE_USDC, 6, blockTag);
    if (usdcQuantity) rows.push(IC_EVM_balanceRow_(wallet, 'USDC', 'ERC20_NATIVE', usdcQuantity, syncAt, IC_EVM_ARBITRUM_NATIVE_USDC, 6, 'Arbitrum native USDC balanceOf'));
  }

  // USDT мониторим всегда (не зависит от allowedAssets): нужен для детекта
  // пополнений и обменов стейбл-в-стейбл.
  var usdtQuantity = IC_EVM_fetchErc20Balance_(wallet.address, IC_EVM_ARBITRUM_USDT, 6, blockTag);
  if (usdtQuantity) rows.push(IC_EVM_balanceRow_(wallet, 'USDT', 'ERC20', usdtQuantity, syncAt, IC_EVM_ARBITRUM_USDT, 6, 'Arbitrum USDT balanceOf'));

  IC_EVM_TRACKED_TOKENS.forEach(function(token) {
    if (!IC_EVM_isAllowedWalletAsset_(wallet, token.symbol)) return;
    var quantity = IC_EVM_fetchErc20Balance_(wallet.address, token.contract, token.decimals, blockTag);
    if (quantity) rows.push(IC_EVM_balanceRow_(wallet, token.symbol, 'ERC20', quantity, syncAt, token.contract, token.decimals, 'Arbitrum ' + token.symbol + ' balanceOf'));
  });

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
  IC_EVM_TRACKED_TOKENS.forEach(function(token) {
    IC_EVM_setCalculationQuantity_(calculationsSheet, token.symbol, currentBalances[token.symbol] || 0);
  });
}

function IC_EVM_applyBalanceDeltas_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt) {
  var usdcDelta = (currentBalances.USDC || 0) - (previousBalances.USDC || 0);
  var usdtDelta = (currentBalances.USDT || 0) - (previousBalances.USDT || 0);
  var ethDelta = (currentBalances.ETH || 0) - (previousBalances.ETH || 0);
  var trackedHandled = IC_EVM_applyTrackedTokenDeltas_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt, usdcDelta, usdtDelta);
  if (trackedHandled) return;

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

  // ── Движение ETH без встречного стейбла ──
  // Раньше такая дельта проглатывалась молча: количество в «Расчетах»
  // обновлялось, а в истории не появлялось ничего. Так пропала продажа
  // 2026-07-21. Порог отсекает газ (комиссия Arbitrum — тысячные цента).
  if (importSheet && Math.abs(ethDelta) > IC_EVM_UNPAIRED_ASSET_THRESHOLD) {
    IC_EVM_appendStableFlowAuditRow_(importSheet,
      ethDelta > 0 ? 'Пополнение' : 'Вывод',
      'ETH', Math.abs(ethDelta), 0,
      'Движение ETH без встречного стейбла — проверьте вручную', syncStartedAt);
  }

  // ── Обмен стейбл-в-стейбл (USDT <-> USDC): дельты противоположны и почти
  // равны (допуск — комиссия/слиппедж до 2% или 1$). Нейтрально для PnL. ──
  var swapTolerance = Math.max(1, Math.abs(usdcDelta) * 0.02);
  if (
    Math.abs(usdtDelta) > 0.5 && Math.abs(usdcDelta) > 0.5 &&
    usdtDelta * usdcDelta < 0 &&
    Math.abs(usdtDelta + usdcDelta) <= swapTolerance
  ) {
    IC_EVM_applyStableDelta_(calculationsSheet, 'USDC', usdcDelta);
    IC_EVM_applyStableDelta_(calculationsSheet, IC_EVM_USDT_CALC_ASSET, usdtDelta);
    if (importSheet) {
      var fromAsset = usdtDelta < 0 ? 'USDT' : 'USDC';
      var toAsset = usdtDelta < 0 ? 'USDC' : 'USDT';
      var fromQty = usdtDelta < 0 ? -usdtDelta : -usdcDelta;
      var toQty = usdtDelta < 0 ? usdcDelta : usdtDelta;
      IC_EVM_appendStableFlowAuditRow_(importSheet, 'Обмен', toAsset, toQty, fromQty,
        fromAsset + ' -> ' + toAsset, syncStartedAt);
    }
    return;
  }

  // ── Пополнение / вывод стейбла: движение без встречной пары ──
  if (Math.abs(usdtDelta) > 0.5) {
    IC_EVM_applyStableDelta_(calculationsSheet, IC_EVM_USDT_CALC_ASSET, usdtDelta);
    if (importSheet) {
      IC_EVM_appendStableFlowAuditRow_(importSheet,
        usdtDelta > 0 ? 'Пополнение' : 'Вывод',
        'USDT', Math.abs(usdtDelta), Math.abs(usdtDelta),
        usdtDelta > 0 ? 'Приход USDT на кошелёк' : 'Уход USDT с кошелька', syncStartedAt);
    }
  } else if (Math.abs(usdtDelta) > 0.000001) {
    IC_EVM_applyStableDelta_(calculationsSheet, IC_EVM_USDT_CALC_ASSET, usdtDelta);
  }

  if (Math.abs(usdcDelta) > 0.5) {
    IC_EVM_applyStableDelta_(calculationsSheet, 'USDC', usdcDelta);
    if (importSheet) {
      IC_EVM_appendStableFlowAuditRow_(importSheet,
        usdcDelta > 0 ? 'Пополнение' : 'Вывод',
        'USDC', Math.abs(usdcDelta), Math.abs(usdcDelta),
        usdcDelta > 0 ? 'Приход USDC на кошелёк' : 'Уход USDC с кошелька', syncStartedAt);
    }
  } else if (Math.abs(usdcDelta) > 0.000001) {
    IC_EVM_applyStableDelta_(calculationsSheet, 'USDC', usdcDelta);
  }
}

function IC_EVM_applyTrackedTokenDeltas_(calculationsSheet, importSheet, previousBalances, currentBalances, syncStartedAt, usdcDelta, usdtDelta) {
  for (var index = 0; index < IC_EVM_TRACKED_TOKENS.length; index += 1) {
    var token = IC_EVM_TRACKED_TOKENS[index];
    var tokenDelta = (currentBalances[token.symbol] || 0) - (previousBalances[token.symbol] || 0);
    if (Math.abs(tokenDelta) <= token.minQuantity) continue;

    var stable = IC_EVM_pickSpentStable_(usdcDelta, usdtDelta);
    var stableSpent = stable ? -stable.delta : 0;
    var impliedBuyPrice = tokenDelta > 0 && stableSpent ? stableSpent / tokenDelta : 0;
    if (
      stable &&
      stableSpent > 0.5 &&
      tokenDelta > token.minQuantity &&
      impliedBuyPrice >= token.minPrice &&
      impliedBuyPrice <= token.maxPrice
    ) {
      IC_EVM_applyAssetPurchase_(calculationsSheet, token.symbol, tokenDelta, stableSpent);
      IC_EVM_applyStableDelta_(calculationsSheet, stable.calcAsset, stable.delta);
      if (importSheet) IC_EVM_appendBalanceDeltaBuyAuditRow_(importSheet, token.symbol, tokenDelta, impliedBuyPrice, stableSpent, syncStartedAt, stable.asset);
      return true;
    }

    stable = IC_EVM_pickReceivedStable_(usdcDelta, usdtDelta);
    var stableReceived = stable ? stable.delta : 0;
    var tokenSold = -tokenDelta;
    var impliedSellPrice = tokenSold ? stableReceived / tokenSold : 0;
    if (
      stable &&
      stableReceived > 0.5 &&
      tokenSold > token.minQuantity &&
      impliedSellPrice >= token.minPrice &&
      impliedSellPrice <= token.maxPrice
    ) {
      var sale = IC_EVM_applyAssetSale_(calculationsSheet, token.symbol, tokenSold, stableReceived);
      IC_EVM_applyStableDelta_(calculationsSheet, stable.calcAsset, stable.delta);
      if (importSheet) IC_EVM_appendBalanceDeltaSellAuditRow_(importSheet, token.symbol, tokenSold, impliedSellPrice, stableReceived, sale, syncStartedAt, stable.asset);
      return true;
    }

    Logger.log('Unpaired ' + token.symbol + ' wallet delta skipped: ' +
      IC_EVM_round_(tokenDelta, 12) + '. Portfolio quantity will be synced; trade history stays clean.');
    return true;
  }

  return false;
}

function IC_EVM_pickSpentStable_(usdcDelta, usdtDelta) {
  var candidates = [
    { asset: 'USDC', calcAsset: 'USDC', delta: usdcDelta },
    { asset: 'USDT', calcAsset: IC_EVM_USDT_CALC_ASSET, delta: usdtDelta }
  ].filter(function(stable) {
    return stable.delta < -0.5;
  });
  if (!candidates.length) return null;
  candidates.sort(function(a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
  return candidates[0];
}

function IC_EVM_pickReceivedStable_(usdcDelta, usdtDelta) {
  var candidates = [
    { asset: 'USDC', calcAsset: 'USDC', delta: usdcDelta },
    { asset: 'USDT', calcAsset: IC_EVM_USDT_CALC_ASSET, delta: usdtDelta }
  ].filter(function(stable) {
    return stable.delta > 0.5;
  });
  if (!candidates.length) return null;
  candidates.sort(function(a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
  return candidates[0];
}

// Колонки листа импорта защищены списками значений (наследие TON-импорта:
// «Действие» без Пополнения/Вывода, «Chain» только TON). Дописываем нужное
// значение в правило всей колонки, не ломая существующий список.
function IC_EVM_ensureListValidationAllows_(sheet, colLetter, value) {
  return IC_LEDGER_ensureListValidationAllows_(sheet, colLetter, value);
}

// Аудит-строка потока стейблов: Пополнение / Вывод / Обмен. Формат тот же,
// что у Покупки/Продажи — история сделок на сайте показывает их одной лентой.
function IC_EVM_appendStableFlowAuditRow_(sheet, action, asset, quantity, usdAmount, pairLabel, syncStartedAt, chain, walletId) {
  return IC_LEDGER_appendStableFlowRow_(sheet, {
    action: action, asset: asset, quantity: quantity, usdAmount: usdAmount,
    pairLabel: pairLabel, syncStartedAt: syncStartedAt,
    chain: chain || 'ARBITRUM', walletId: walletId || IC_EVM_DEFAULT_WALLET_ID
  });
}

function IC_EVM_appendBalanceDeltaBuyAuditRow_(sheet, asset, assetReceived, impliedPrice, stableSpent, syncStartedAt, stableAsset) {
  var fromAsset = stableAsset || 'USDC';
  var syncId = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss");
  var importId = [
    'EVM_BALANCE_DELTA',
    'ARBITRUM',
    syncId,
    fromAsset + '_TO_' + asset,
    IC_EVM_round_(stableSpent, 6),
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
    stableSpent,
    'Arbitrum wallet balance delta; already applied to Расчеты',
    IC_EVM_DEFAULT_WALLET_ID,
    'ARBITRUM',
    'BALANCE_DELTA',
    '',
    'SWAP',
    '',
    fromAsset + ' -> ' + asset,
    IC_EVM_round_(stableSpent, 6) + ' -> ' + IC_EVM_round_(assetReceived, 12),
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") + '. Do not approve again; cost basis was applied from Arbitrum wallet balance delta.'
  ]]);
}

function IC_EVM_appendBalanceDeltaSellAuditRow_(sheet, asset, assetSold, impliedPrice, stableReceived, sale, syncStartedAt, stableAsset) {
  var toAsset = stableAsset || 'USDC';
  var syncId = Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss");
  var importId = [
    'EVM_BALANCE_DELTA',
    'ARBITRUM',
    syncId,
    asset + '_TO_' + toAsset,
    IC_EVM_round_(assetSold, 12),
    IC_EVM_round_(stableReceived, 6)
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
    stableReceived,
    'Arbitrum wallet balance delta; already applied to Расчеты',
    IC_EVM_DEFAULT_WALLET_ID,
    'ARBITRUM',
    'BALANCE_DELTA',
    '',
    'SWAP',
    '',
    asset + ' -> ' + toAsset,
    IC_EVM_round_(assetSold, 12) + ' -> ' + IC_EVM_round_(stableReceived, 6),
    'BALANCE_APPLIED audit row at ' + Utilities.formatDate(syncStartedAt, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") +
      '. Do not approve again; cost basis was reduced at avgEntry ' + IC_EVM_round_(sale.avgEntry, 12) +
      '; costBasisSold=' + IC_EVM_round_(sale.costBasisSold, 6) +
      '; realizedPnL=' + IC_EVM_round_(sale.realizedPnl, 6) + '.'
  ]]);
}

// Высота блока для снимка балансов. Все балансы кошелька обязаны читаться
// на ОДНОМ блоке: с 'latest' запросы уходят на разные ноды публичного пула,
// и своп ETH→USDC может попасть в снимок наполовину (USDC уже пришёл, ETH ещё
// старый). Тогда дельты расходятся по разным прогонам и продажа теряется —
// кейс 2026-07-21: своп 0.014 ETH записался как «Пополнение USDC».
// Небольшой отступ от головы цепочки: ноды публичного пула отстают друг от
// друга на доли секунды, и запрос свежайшего блока часть из них ещё не видит.
// ~20 блоков Arbitrum ≈ 5 секунд — состояние гарантированно есть у всех.
var IC_EVM_BLOCK_LAG = 20;

function IC_EVM_fetchBlockTag_() {
  var head = parseInt(IC_EVM_rpcCall_('eth_blockNumber', []), 16);
  if (!isFinite(head) || head <= IC_EVM_BLOCK_LAG) return 'latest';
  return '0x' + (head - IC_EVM_BLOCK_LAG).toString(16);
}

function IC_EVM_fetchNativeBalance_(address, blockTag) {
  var result = IC_EVM_rpcCall_('eth_getBalance', [address, blockTag || 'latest']);
  return IC_EVM_hexUnits_(result, 18);
}

function IC_EVM_fetchErc20Balance_(address, contractAddress, decimals, blockTag) {
  var data = '0x70a08231' + IC_EVM_padAddress_(address);
  var result = IC_EVM_rpcCall_('eth_call', [{
    to: contractAddress,
    data: data
  }, blockTag || 'latest']);

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
  return IC_LEDGER_applyStableDelta_(sheet, asset, delta);
}

function IC_EVM_setCalculationQuantity_(sheet, asset, quantity) {
  var rowIndex = IC_EVM_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  sheet.getRange(rowIndex, 3).setValue(quantity);
  sheet.getRange(rowIndex, 5).setFormula('=C' + rowIndex + '*D' + rowIndex);
}

function IC_EVM_findAssetRow_(sheet, asset) {
  return IC_LEDGER_findAssetRow_(sheet, asset);
}

function IC_EVM_readExistingImportIds_(sheet) {
  return IC_LEDGER_readExistingImportIds_(sheet);
}

function IC_EVM_appendRows_(sheet, rows) {
  return IC_LEDGER_appendRows_(sheet, rows);
}

function IC_EVM_updateWalletSyncState_(sheet, rowIndex, date) {
  sheet.getRange(rowIndex, 7).setValue(Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"));
}

// Новая стейбл-строка в «Расчетах»: пишем в первую ПУСТУЮ строку колонки A
// в пределах 2..30 (диапазоны формул 2:100 её подхватят). insertRow НЕ используем:
// вставка сдвигает служебные блоки L-O и W-X (анти-паттерн HANDOFF §3.8).
// Формулы — только с ";" (русская локаль, HANDOFF §3.7). Цена стейбла = 1.
function IC_EVM_createStableRow_(sheet, asset) {
  return IC_LEDGER_createStableRow_(sheet, asset);
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
  return IC_LEDGER_isStable_(asset);
}

function IC_EVM_normalizeAssetSymbol_(asset) {
  return IC_LEDGER_normalizeAssetSymbol_(asset);
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
  return IC_LEDGER_round_(value, digits);
}

// Одноразово: если APEX был куплен до появления APEX в Arbitrum importer,
// первый старый синк мог увидеть только USDT-расход и не связать его с APEX.
// Эта функция фиксирует текущий APEX-баланс как покупку по фактической сумме.
// Запускать только вручную после проверки суммы покупки.
function initApexPositionFromChain() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupArbitrumWalletImport();

  var calc = ss.getSheetByName(IC_EVM_CALCULATIONS_SHEET);
  if (!calc) throw new Error('Missing sheet: ' + IC_EVM_CALCULATIONS_SHEET);
  var token = IC_EVM_TRACKED_TOKENS.filter(function(item) { return item.symbol === 'APEX'; })[0];
  if (!token) throw new Error('APEX token config missing');

  var row = IC_EVM_findAssetRow_(calc, token.symbol);
  if (!row) throw new Error('Нет строки APEX в «Расчетах»');

  var avg = IC_EVM_toNumber_(calc.getRange(row, 4).getValue());
  if (avg > 0) {
    Logger.log('APEX: средний вход уже задан (' + avg + ') — ничего не делаю');
    return;
  }

  var blockTag = IC_EVM_fetchBlockTag_();
  var quantity = IC_EVM_fetchErc20Balance_(IC_EVM_DEFAULT_ADDRESS, token.contract, token.decimals, blockTag);
  var amount = 6.80;
  if (quantity <= token.minQuantity) {
    Logger.log('APEX: баланс на кошельке 0 — нечего инициализировать');
    return;
  }

  var price = amount / quantity;
  calc.getRange(row, 3).setValue(quantity);
  calc.getRange(row, 4).setValue(IC_LEDGER_round_(price, 4));
  calc.getRange(row, 5).setFormula('=C' + row + '*D' + row);

  var importSheet = ss.getSheetByName(IC_EVM_IMPORT_SHEET);
  if (importSheet) IC_LEDGER_appendTradeRow_(importSheet, {
    action: 'Покупка',
    asset: token.symbol,
    category: token.category,
    quantity: quantity,
    price: price,
    amount: amount,
    pairLabel: 'Инициализация APEX: USDT -> APEX',
    syncStartedAt: new Date(),
    chain: 'ARBITRUM',
    walletId: IC_EVM_DEFAULT_WALLET_ID
  });

  Logger.log('APEX инициализирован: qty=' + quantity + ', вход=' + price + ', сумма=' + amount +
             '$. Строка «Покупка APEX» записана — кулдаун запустится.');
}

// Одноразово: чистит ошибочную audit-строку APEX/Пополнение, которая могла
// появиться после первичной инициализации APEX без встречной USDT/USDC-дельты.
function cleanupApexUnpairedFlow20260813() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(IC_EVM_IMPORT_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return 'нет строк для проверки';

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getValues();
  var removed = [];
  for (var index = values.length - 1; index >= 0; index -= 1) {
    var row = values[index];
    var importId = String(row[0] || '');
    var asset = String(row[3] || '').trim().toUpperCase();
    var action = String(row[5] || '').trim();
    var source = String(row[12] || '').trim();
    var pairLabel = String(row[16] || '').trim();
    var targetRow = index + 2;

    if (
      importId.indexOf('EVM_STABLE_FLOW:ARBITRUM:') === 0 &&
      asset === 'APEX' &&
      (action === 'Пополнение' || action === 'Вывод') &&
      source === 'BALANCE_DELTA' &&
      pairLabel.indexOf('Движение APEX без встречного стейбла') === 0
    ) {
      sheet.deleteRow(targetRow);
      removed.push(targetRow);
    }
  }

  return 'удалено ошибочных APEX flow-строк: ' + removed.length +
    (removed.length ? ' (' + removed.join(', ') + ')' : '');
}



// Одноразовая чистка 2026-07-17: три упавших на валидациях прогона бэкфила
// оставили полузаписанные строки (пустое действие) и дубли «Пополнения».
// Оставляем последнюю валидную пару (Пополнение + Обмен), остальные
// EVM_STABLE_FLOW-строки удаляем.
function cleanupStableFlowDuplicates20260717() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(IC_EVM_IMPORT_SHEET);
  var lastRow = sheet.getLastRow();
  var values = sheet.getRange(2, 1, lastRow - 1, 6).getValues(); // A..F
  var flowRows = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).indexOf('EVM_STABLE_FLOW') === 0) {
      flowRows.push({ row: i + 2, action: String(values[i][5]).trim() });
    }
  }
  // Валидные: последнее «Пополнение» и последний «Обмен». Остальные — мусор.
  var lastDeposit = -1, lastSwap = -1;
  flowRows.forEach(function(r) {
    if (r.action === 'Пополнение') lastDeposit = r.row;
    if (r.action === 'Обмен') lastSwap = r.row;
  });
  var removed = [];
  for (var j = flowRows.length - 1; j >= 0; j--) {
    var r = flowRows[j];
    if (r.row !== lastDeposit && r.row !== lastSwap) {
      sheet.deleteRow(r.row);
      removed.push(r.row + ':' + (r.action || 'пусто'));
    }
  }
  return 'удалено ' + removed.length + ' строк: ' + removed.join(', ');
}
