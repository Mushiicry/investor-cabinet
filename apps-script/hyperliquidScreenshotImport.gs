var IC_HL_SCREENSHOT_IMPORT_SHEET = 'Транзакции_IMPORT';

function importHyperliquidScreenshotFills_20260620() {
  var ss = SpreadsheetApp.openById('1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8');
  var sheet = ss.getSheetByName(IC_HL_SCREENSHOT_IMPORT_SHEET);
  if (!sheet) throw new Error('Missing sheet: ' + IC_HL_SCREENSHOT_IMPORT_SHEET);

  var fills = IC_HL_getScreenshotFills_20260620_();
  var existingIds = {};
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().forEach(function(row) {
      if (row[0]) existingIds[row[0]] = true;
    });
  }

  var rows = fills
    .filter(function(fill) { return !existingIds[fill.id]; })
    .map(IC_HL_buildScreenshotImportRow_);

  if (!rows.length) {
    return { inserted: 0, skipped: fills.length };
  }

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, 19).setValues(rows);
  sheet.getRange(startRow, 3, rows.length, 1).setNumberFormat('dd.MM.yyyy');

  return {
    inserted: rows.length,
    skipped: fills.length - rows.length,
    firstRow: startRow,
    lastRow: startRow + rows.length - 1
  };
}

function IC_HL_buildScreenshotImportRow_(fill) {
  var actionMap = {
    'Open Long': 'Покупка',
    'Close Long': 'Продажа',
    'Buy': 'Покупка',
    'Sell': 'Продажа',
    'Open Short': 'Продажа',
    'Close Short': 'Покупка',
    'Short > Long': 'Обмен'
  };

  return [
    fill.id,
    'PENDING',
    IC_HL_parseScreenshotDate_(fill.timestamp),
    fill.asset,
    fill.category,
    actionMap[fill.direction],
    fill.quantity,
    fill.price,
    fill.tradeValue,
    'Hyperliquid fill: ' + fill.direction + '; audit only, do not approve before futures accounting review',
    'hyperliquid-main',
    '',
    '',
    fill.timestamp,
    '',
    'Hyperliquid',
    fill.direction + ' ' + fill.rawAsset,
    fill.quantity + ' ' + fill.rawAsset + ' @ ' + fill.price,
    'Trade value ' + fill.tradeValue.toFixed(2) + ' USDC; fee ' + fill.fee +
      '; closed PnL ' + fill.closedPnl + '. Screenshot verified 20.06.2026.'
  ];
}

function IC_HL_parseScreenshotDate_(timestamp) {
  var parts = timestamp.split(/[. :]/).map(Number);
  return new Date(parts[2], parts[1] - 1, parts[0], parts[3], parts[4], parts[5]);
}

function IC_HL_getScreenshotFills_20260620_() {
  return [
    { id: 'HL_SCREENSHOT:20260619T210235:GOLD:OPEN_LONG', timestamp: '19.06.2026 21:02:35', asset: 'GOLD PERP', rawAsset: 'GOLD', category: 'Металлы', direction: 'Open Long', price: 4161.9, quantity: 0.0038, tradeValue: 15.82, fee: '0.01 USDC', closedPnl: '-0.01 USDC' },
    { id: 'HL_SCREENSHOT:20260617T143907:GOLD:CLOSE_LONG', timestamp: '17.06.2026 14:39:07', asset: 'GOLD PERP', rawAsset: 'GOLD', category: 'Металлы', direction: 'Close Long', price: 4327.0, quantity: 0.0049, tradeValue: 21.20, fee: '0.02 USDC', closedPnl: '0.04 USDC' },
    { id: 'HL_SCREENSHOT:20260615T231400:GOLD:CLOSE_LONG', timestamp: '15.06.2026 23:14:00', asset: 'GOLD PERP', rawAsset: 'GOLD', category: 'Металлы', direction: 'Close Long', price: 4317.7, quantity: 0.0028, tradeValue: 12.09, fee: '0.01 USDC', closedPnl: '-0.00 USDC' },
    { id: 'HL_SCREENSHOT:20260615T165307:GOLD:CLOSE_LONG', timestamp: '15.06.2026 16:53:07', asset: 'GOLD PERP', rawAsset: 'GOLD', category: 'Металлы', direction: 'Close Long', price: 4360.4, quantity: 0.0064, tradeValue: 27.91, fee: '0.02 USDC', closedPnl: '0.26 USDC' },
    { id: 'HL_SCREENSHOT:20260611T014620:GOLD:OPEN_LONG', timestamp: '11.06.2026 01:46:20', asset: 'GOLD PERP', rawAsset: 'GOLD', category: 'Металлы', direction: 'Open Long', price: 4061.5, quantity: 0.0098, tradeValue: 39.80, fee: '0.03 USDC', closedPnl: '-0.03 USDC' },
    { id: 'HL_SCREENSHOT:20260528T105311:GOLD:OPEN_LONG', timestamp: '28.05.2026 10:53:11', asset: 'GOLD PERP', rawAsset: 'GOLD', category: 'Металлы', direction: 'Open Long', price: 4385.5, quantity: 0.0062, tradeValue: 27.19, fee: '0.02 USDC', closedPnl: '-0.02 USDC' },
    { id: 'HL_SCREENSHOT:20260525T132809:GOLD:OPEN_LONG', timestamp: '25.05.2026 13:28:09', asset: 'GOLD PERP', rawAsset: 'GOLD', category: 'Металлы', direction: 'Open Long', price: 4570.8, quantity: 0.0022, tradeValue: 10.06, fee: '0.01 USDC', closedPnl: '-0.01 USDC' },
    { id: 'HL_SCREENSHOT:20260525T132739:GOLD:OPEN_LONG', timestamp: '25.05.2026 13:27:39', asset: 'GOLD PERP', rawAsset: 'GOLD', category: 'Металлы', direction: 'Open Long', price: 4570.1, quantity: 0.0022, tradeValue: 10.05, fee: '0.01 USDC', closedPnl: '-0.01 USDC' },
    { id: 'HL_SCREENSHOT:20260519T223853:GOLD:OPEN_LONG', timestamp: '19.05.2026 22:38:53', asset: 'GOLD PERP', rawAsset: 'GOLD', category: 'Металлы', direction: 'Open Long', price: 4491.0, quantity: 0.0053, tradeValue: 23.80, fee: '0.02 USDC', closedPnl: '-0.02 USDC' },
    { id: 'HL_SCREENSHOT:20260604T150755:MNT:OPEN_LONG', timestamp: '04.06.2026 15:07:55', asset: 'MNT PERP', rawAsset: 'MNT', category: 'Крипта', direction: 'Open Long', price: 0.55125, quantity: 18.3, tradeValue: 10.09, fee: '0.00 USDC', closedPnl: '-0.00 USDC' },
    { id: 'HL_SCREENSHOT:20260525T205708:SOL:SELL', timestamp: '25.05.2026 20:57:08', asset: 'SOL', rawAsset: 'SOL/USDC', category: 'Крипта', direction: 'Sell', price: 86.015, quantity: 0.232, tradeValue: 19.96, fee: '0.01 USDC', closedPnl: '-0.04 USDC' },
    { id: 'HL_SCREENSHOT:20260525T205503:SOL:BUY', timestamp: '25.05.2026 20:55:03', asset: 'SOL', rawAsset: 'SOL/USDC', category: 'Крипта', direction: 'Buy', price: 86.074, quantity: 0.232, tradeValue: 19.97, fee: '0.00015590 SOL', closedPnl: '-0.01 USDC' },
    { id: 'HL_SCREENSHOT:20260525T205408:SOL:SELL', timestamp: '25.05.2026 20:54:08', asset: 'SOL', rawAsset: 'SOL/USDC', category: 'Крипта', direction: 'Sell', price: 86.054, quantity: 0.231, tradeValue: 19.88, fee: '0.01 USDC', closedPnl: '-0.03 USDC' },
    { id: 'HL_SCREENSHOT:20260525T205052:SOL:BUY', timestamp: '25.05.2026 20:50:52', asset: 'SOL', rawAsset: 'SOL/USDC', category: 'Крипта', direction: 'Buy', price: 86.072, quantity: 0.232, tradeValue: 19.97, fee: '0.00015590 SOL', closedPnl: '-0.01 USDC' },
    { id: 'HL_SCREENSHOT:20260617T143808:TIA:CLOSE_LONG', timestamp: '17.06.2026 14:38:08', asset: 'TIA PERP', rawAsset: 'TIA', category: 'Крипта', direction: 'Close Long', price: 0.39669, quantity: 25.7, tradeValue: 10.19, fee: '0.00 USDC', closedPnl: '0.11 USDC' },
    { id: 'HL_SCREENSHOT:20260616T235411:TIA:OPEN_LONG', timestamp: '16.06.2026 23:54:11', asset: 'TIA PERP', rawAsset: 'TIA', category: 'Крипта', direction: 'Open Long', price: 0.39228, quantity: 25.7, tradeValue: 10.08, fee: '0.00 USDC', closedPnl: '-0.00 USDC' },
    { id: 'HL_SCREENSHOT:20260615T231340:BTC:CLOSE_LONG', timestamp: '15.06.2026 23:13:40', asset: 'BTC PERP', rawAsset: 'BTC', category: 'Крипта', direction: 'Close Long', price: 66537, quantity: 0.00021, tradeValue: 13.97, fee: '0.01 USDC', closedPnl: '0.35 USDC' },
    { id: 'HL_SCREENSHOT:20260615T165300:BTC:CLOSE_LONG', timestamp: '15.06.2026 16:53:00', asset: 'BTC PERP', rawAsset: 'BTC', category: 'Крипта', direction: 'Close Long', price: 66583, quantity: 0.00028, tradeValue: 18.64, fee: '0.01 USDC', closedPnl: '0.48 USDC' },
    { id: 'HL_SCREENSHOT:20260604T134220:BTC:OPEN_LONG', timestamp: '04.06.2026 13:42:20', asset: 'BTC PERP', rawAsset: 'BTC', category: 'Крипта', direction: 'Open Long', price: 62666, quantity: 0.00039, tradeValue: 24.44, fee: '0.01 USDC', closedPnl: '-0.01 USDC' },
    { id: 'HL_SCREENSHOT:20260603T192052:BTC:OPEN_LONG', timestamp: '03.06.2026 19:20:52', asset: 'BTC PERP', rawAsset: 'BTC', category: 'Крипта', direction: 'Open Long', price: 65984, quantity: 0.00057, tradeValue: 37.61, fee: '0.02 USDC', closedPnl: '-0.02 USDC' },
    { id: 'HL_SCREENSHOT:20260603T191916:BTC:SHORT_TO_LONG', timestamp: '03.06.2026 19:19:16', asset: 'BTC PERP', rawAsset: 'BTC', category: 'Крипта', direction: 'Short > Long', price: 65969, quantity: 0.00045, tradeValue: 29.69, fee: '0.01 USDC', closedPnl: '3.19 USDC' },
    { id: 'HL_SCREENSHOT:20260602T122346:BTC:CLOSE_SHORT', timestamp: '02.06.2026 12:23:46', asset: 'BTC PERP', rawAsset: 'BTC', category: 'Крипта', direction: 'Close Short', price: 69470, quantity: 0.00030, tradeValue: 20.84, fee: '0.01 USDC', closedPnl: '2.38 USDC' },
    { id: 'HL_SCREENSHOT:20260424T212130:BTC:OPEN_SHORT', timestamp: '24.04.2026 21:21:30', asset: 'BTC PERP', rawAsset: 'BTC', category: 'Крипта', direction: 'Open Short', price: 77422, quantity: 0.00058, tradeValue: 44.90, fee: '0.02 USDC', closedPnl: '-0.02 USDC' }
  ];
}
