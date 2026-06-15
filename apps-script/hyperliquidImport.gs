var IC_HL_INFO_URL = 'https://api.hyperliquid.xyz/info';
var IC_HL_MAIN_ADDRESS = '0xFEc18D4474826afd65d578ff931F4ff2926ee0c3';
var IC_HL_CALCULATIONS_SHEET = 'Расчеты';
var IC_HL_USDC_HL_ASSET = 'USDC HL';
var IC_HL_SUPPORTED_POSITION_COINS = ['BTC', 'GOLD', 'MNT'];
var IC_HL_EXTRA_DEXES = ['xyz'];
var IC_HL_LEGACY_FUTURES_ASSETS = {
  BTC: ['BTC SHORT'],
  GOLD: ['GOLD LONG'],
  PAXG: ['GOLD LONG'],
  MNT: []
};

function setupHyperliquidAccountImport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var calculationsSheet = ss.getSheetByName(IC_HL_CALCULATIONS_SHEET);
  if (!calculationsSheet) throw new Error('Missing sheet: ' + IC_HL_CALCULATIONS_SHEET);

  IC_HL_ensureHyperliquidFuturesRows_(calculationsSheet);
}

function syncHyperliquidAccountState() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var calculationsSheet = ss.getSheetByName(IC_HL_CALCULATIONS_SHEET);
  if (!calculationsSheet) throw new Error('Missing sheet: ' + IC_HL_CALCULATIONS_SHEET);

  var clearingStates = [IC_HL_fetchInfo_({
    type: 'clearinghouseState',
    user: IC_HL_MAIN_ADDRESS
  })];
  IC_HL_EXTRA_DEXES.forEach(function(dex) {
    clearingStates.push(IC_HL_fetchInfo_({
      type: 'clearinghouseState',
      user: IC_HL_MAIN_ADDRESS,
      dex: dex
    }));
  });
  var spotState = IC_HL_fetchInfo_({
    type: 'spotClearinghouseState',
    user: IC_HL_MAIN_ADDRESS
  });

  var positions = IC_HL_readPositionMap_(clearingStates);
  var usdc = IC_HL_readSpotUsdc_(spotState);

  IC_HL_ensureHyperliquidFuturesRows_(calculationsSheet);
  IC_HL_syncUsdcHl_(calculationsSheet, usdc.availableAfterMaintenance);
  IC_HL_syncSupportedFuturesPositions_(calculationsSheet, positions);
}

function IC_HL_fetchInfo_(payload) {
  var response = UrlFetchApp.fetch(IC_HL_INFO_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var statusCode = response.getResponseCode();
  var body = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('Hyperliquid request failed: ' + statusCode + ' ' + body);
  }

  return JSON.parse(body);
}

function IC_HL_readSpotUsdc_(spotState) {
  var balances = spotState && spotState.balances ? spotState.balances : [];
  var usdcBalance = balances.filter(function(balance) {
    return String(balance.coin || '').toUpperCase() === 'USDC';
  })[0] || {};
  var availableAfterMaintenance = 0;

  (spotState && spotState.tokenToAvailableAfterMaintenance || []).forEach(function(row) {
    if (Number(row[0]) === 0) availableAfterMaintenance = IC_HL_toNumber_(row[1]);
  });

  return {
    total: IC_HL_toNumber_(usdcBalance.total),
    hold: IC_HL_toNumber_(usdcBalance.hold),
    availableAfterMaintenance: availableAfterMaintenance
  };
}

function IC_HL_readPositionMap_(clearingStates) {
  var result = {};
  var states = Array.isArray(clearingStates) ? clearingStates : [clearingStates];

  states.forEach(function(clearingState) {
    var assetPositions = clearingState && clearingState.assetPositions ? clearingState.assetPositions : [];

    assetPositions.forEach(function(item) {
      var position = item && item.position ? item.position : null;
      if (!position || !position.coin) return;

      var normalizedPosition = IC_HL_normalizePosition_(position);
      result[String(position.coin).toUpperCase()] = normalizedPosition;
      result[IC_HL_canonicalFuturesCoin_(position.coin)] = normalizedPosition;
    });
  });

  return result;
}

function IC_HL_normalizePosition_(position) {
  var sizeSigned = IC_HL_toNumber_(position.szi);
  var sizeAbs = Math.abs(sizeSigned);
  var positionValue = IC_HL_toNumber_(position.positionValue);
  var marginUsed = IC_HL_toNumber_(position.marginUsed);
  var unrealizedPnl = IC_HL_toNumber_(position.unrealizedPnl);
  var entryPx = IC_HL_toNumber_(position.entryPx);
  var currentPrice = sizeAbs ? positionValue / sizeAbs : 0;

  return {
    coin: String(position.coin || '').toUpperCase(),
    direction: sizeSigned >= 0 ? 'LONG' : 'SHORT',
    sizeSigned: sizeSigned,
    sizeAbs: sizeAbs,
    entryPx: entryPx,
    currentPrice: currentPrice,
    marginUsed: marginUsed,
    unrealizedPnl: unrealizedPnl,
    currentValue: Math.max(0, marginUsed + unrealizedPnl),
    pnlPct: marginUsed ? unrealizedPnl / marginUsed : 0
  };
}

function IC_HL_syncSupportedFuturesPositions_(sheet, positions) {
  var syncedAssets = {};

  IC_HL_SUPPORTED_POSITION_COINS.forEach(function(coin) {
    var canonicalCoin = IC_HL_canonicalFuturesCoin_(coin);
    var position = coin === 'GOLD'
      ? (positions.GOLD || positions.PAXG || null)
      : (positions[coin] || null);

    if (!position || !position.sizeAbs) {
      IC_HL_clearKnownFuturesRows_(sheet, canonicalCoin);
      return;
    }

    var syncedAsset = IC_HL_syncFuturesCoinPosition_(sheet, canonicalCoin, position);
    if (syncedAsset) syncedAssets[syncedAsset] = true;
  });

  return syncedAssets;
}

function IC_HL_ensureHyperliquidFuturesRows_(sheet) {
  [
    { asset: 'BTC LONG', category: 'Фьючерсы' },
    { asset: 'GOLD LONG', category: 'Металлы' },
    { asset: 'MNT LONG', category: 'Фьючерсы' }
  ].forEach(function(row) {
    if (!IC_HL_findAssetRowInPrimaryTable_(sheet, row.asset)) {
      IC_HL_createFuturesRow_(sheet, row.asset, row.category);
    }
  });
}

function IC_HL_createFuturesRow_(sheet, asset, category) {
  var lastColumn = Math.max(sheet.getLastColumn(), 10);
  var tableEndRow = IC_HL_getPrimaryTableEndRow_(sheet);
  var insertAfter = Math.max(1, tableEndRow - 1);
  var templateRow = Math.max(2, insertAfter);
  sheet.insertRowAfter(insertAfter);
  var rowIndex = insertAfter + 1;

  sheet
    .getRange(templateRow, 1, 1, lastColumn)
    .copyTo(sheet.getRange(rowIndex, 1, 1, lastColumn), { contentsOnly: false });

  IC_HL_setIfColumnExists_(sheet, rowIndex, 'asset', asset);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'category', category);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'quantity', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'avgEntry', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'invested', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'currentPrice', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'currentValue', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'pnl', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'pnlPct', 0);

  return rowIndex;
}

function IC_HL_syncUsdcHl_(sheet, availableAfterMaintenance) {
  var rowIndex = IC_HL_findAssetRow_(sheet, IC_HL_USDC_HL_ASSET);
  if (!rowIndex) return;

  var freeCash = Math.max(0, availableAfterMaintenance);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'quantity', freeCash);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'avgEntry', 1);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'invested', freeCash);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'currentPrice', 1);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'currentValue', freeCash);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'pnl', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'pnlPct', 0);
}

function IC_HL_syncFuturesCoinPosition_(sheet, coin, position) {
  var asset = IC_HL_futuresAssetName_(coin, position.direction);
  var rowIndex = IC_HL_findFuturesRow_(sheet, coin, position.direction);
  if (!rowIndex) {
    rowIndex = IC_HL_createFuturesRow_(sheet, asset, IC_HL_futuresCategory_(coin));
  }

  IC_HL_setIfColumnExists_(sheet, rowIndex, 'asset', asset);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'category', IC_HL_futuresCategory_(coin));
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'quantity', position.sizeAbs);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'avgEntry', position.entryPx);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'invested', position.marginUsed);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'currentPrice', position.currentPrice);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'currentValue', position.currentValue);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'pnl', position.unrealizedPnl);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'pnlPct', position.pnlPct);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'status', IC_HL_futuresStatus_(coin));
  IC_HL_clearOppositeFuturesRows_(sheet, coin, position.direction, asset);
  IC_HL_clearDuplicateAssetRows_(sheet, asset, rowIndex);

  return asset;
}

function IC_HL_clearFuturesPosition_(sheet, asset) {
  var rowIndex = IC_HL_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  IC_HL_setIfColumnExists_(sheet, rowIndex, 'quantity', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'avgEntry', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'invested', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'currentValue', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'pnl', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'pnlPct', 0);
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'status', 'CLOSED');
}

function IC_HL_setIfColumnExists_(sheet, rowIndex, field, value) {
  var columnIndex = IC_HL_getColumnIndex_(sheet, field);
  if (!columnIndex) return;

  sheet.getRange(rowIndex, columnIndex).setValue(value);
}

function IC_HL_getColumnIndex_(sheet, field) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var aliases = {
    asset: ['asset', 'актив'],
    category: ['category', 'категория'],
    quantity: ['quantity', 'количество'],
    avgEntry: ['avgentry', 'средняя входа', 'средняя вход'],
    invested: ['invested', 'вложено'],
    currentPrice: ['currentprice', 'текущая цена'],
    currentValue: ['currentvalue', 'текущая стоимость'],
    pnl: ['pnl', 'pnl $'],
    pnlPct: ['pnlpct', 'pnl %'],
    status: ['status', 'статус', 'столбец1', 'столбец 1']
  }[field] || [];

  for (var index = 0; index < headers.length; index += 1) {
    var normalizedHeader = IC_HL_normalizeHeader_(headers[index]);
    if (aliases.indexOf(normalizedHeader) >= 0) return index + 1;
  }

  var fallbackColumns = {
    asset: 1,
    category: 2,
    quantity: 3,
    avgEntry: 4,
    invested: 5,
    currentPrice: 6,
    currentValue: 7,
    pnl: 8,
    pnlPct: 9,
    status: 11
  };

  return fallbackColumns[field] || 0;
}

function IC_HL_findAssetRow_(sheet, asset) {
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var normalizedAsset = IC_HL_normalizeAsset_(asset);

  for (var index = 0; index < values.length; index += 1) {
    if (IC_HL_normalizeAsset_(values[index][0]) === normalizedAsset) return index + 1;
  }

  return 0;
}

function IC_HL_findAssetRowInPrimaryTable_(sheet, asset) {
  var tableEndRow = IC_HL_getPrimaryTableEndRow_(sheet);
  var normalizedAsset = IC_HL_normalizeAsset_(asset);
  if (tableEndRow < 2) return 0;

  var values = sheet.getRange(2, 1, tableEndRow - 1, 1).getValues();
  for (var index = 0; index < values.length; index += 1) {
    if (IC_HL_normalizeAsset_(values[index][0]) === normalizedAsset) return index + 2;
  }

  return 0;
}

function IC_HL_getPrimaryTableEndRow_(sheet) {
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var tableEndRow = 1;

  for (var index = 0; index < values.length; index += 1) {
    var asset = IC_HL_normalizeAsset_(values[index][0]);
    if (!asset) break;
    tableEndRow = index + 2;
  }

  return Math.max(2, tableEndRow);
}

function IC_HL_clearDuplicateAssetRows_(sheet, asset, keepRowIndex) {
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var normalizedAsset = IC_HL_normalizeAsset_(asset);

  for (var index = 0; index < values.length; index += 1) {
    var rowIndex = index + 1;
    if (rowIndex === keepRowIndex) continue;
    if (IC_HL_normalizeAsset_(values[index][0]) !== normalizedAsset) continue;

    sheet.getRange(rowIndex, 1, 1, Math.max(sheet.getLastColumn(), 10)).clearContent();
  }
}

function IC_HL_normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function IC_HL_normalizeAsset_(value) {
  return String(value || '').trim().toUpperCase();
}

function IC_HL_clearKnownFuturesRows_(sheet, coin) {
  [IC_HL_futuresAssetName_(coin, 'LONG'), IC_HL_futuresAssetName_(coin, 'SHORT')]
    .concat(IC_HL_LEGACY_FUTURES_ASSETS[coin] || [])
    .forEach(function(asset) {
      IC_HL_clearFuturesPosition_(sheet, asset);
    });
}

function IC_HL_clearOppositeFuturesRows_(sheet, coin, activeDirection, activeAsset) {
  var normalizedActiveAsset = IC_HL_normalizeAsset_(activeAsset);
  var oppositeDirection = String(activeDirection || 'LONG').toUpperCase() === 'LONG' ? 'SHORT' : 'LONG';
  var rowsToClear = [IC_HL_futuresAssetName_(coin, oppositeDirection)]
    .concat(IC_HL_LEGACY_FUTURES_ASSETS[coin] || [])
    .filter(function(asset) {
      return IC_HL_normalizeAsset_(asset) !== normalizedActiveAsset;
    });

  rowsToClear.forEach(function(asset) {
    IC_HL_clearFuturesPosition_(sheet, asset);
  });
}

function IC_HL_findFuturesRow_(sheet, coin, direction) {
  var preferredAsset = IC_HL_futuresAssetName_(coin, direction);
  var preferredRow = IC_HL_findAssetRow_(sheet, preferredAsset);
  if (preferredRow) return preferredRow;

  var oppositeDirection = String(direction || 'LONG').toUpperCase() === 'LONG' ? 'SHORT' : 'LONG';
  var oppositeRow = IC_HL_findAssetRow_(sheet, IC_HL_futuresAssetName_(coin, oppositeDirection));
  if (oppositeRow) return oppositeRow;

  var legacyAssets = IC_HL_LEGACY_FUTURES_ASSETS[coin] || [];
  for (var index = 0; index < legacyAssets.length; index += 1) {
    var legacyRow = IC_HL_findAssetRow_(sheet, legacyAssets[index]);
    if (legacyRow) return legacyRow;
  }

  return 0;
}

function IC_HL_canonicalFuturesCoin_(coin) {
  var normalizedCoin = IC_HL_normalizeAsset_(coin);
  if (normalizedCoin.indexOf('GOLD') >= 0 || normalizedCoin.indexOf('PAXG') >= 0) return 'GOLD';
  if (normalizedCoin.indexOf('BTC') >= 0) return 'BTC';
  if (normalizedCoin.indexOf('MNT') >= 0) return 'MNT';
  return normalizedCoin;
}

function IC_HL_futuresAssetName_(coin, direction) {
  return IC_HL_canonicalFuturesCoin_(coin) + ' ' + String(direction || 'LONG').toUpperCase();
}

function IC_HL_futuresCategory_(coin) {
  return IC_HL_canonicalFuturesCoin_(coin) === 'GOLD' ? 'Металлы' : 'Фьючерсы';
}

function IC_HL_futuresStatus_(coin) {
  return IC_HL_canonicalFuturesCoin_(coin) === 'GOLD' ? 'Hedge' : 'Speculation';
}

function IC_HL_toNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;
  var normalized = String(value)
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace('%', '')
    .replace(/[^\d.+-]/g, '');
  var number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}
