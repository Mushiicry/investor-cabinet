var IC_HL_INFO_URL = 'https://api.hyperliquid.xyz/info';
var IC_HL_MAIN_ADDRESS = '0xFEc18D4474826afd65d578ff931F4ff2926ee0c3';
var IC_HL_CALCULATIONS_SHEET = 'Расчеты';
var IC_HL_PRICES_SHEET = 'Цены';
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
  IC_HL_refreshPortfolioAccounting_(ss);
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
  var primaryMids = IC_HL_fetchInfo_({ type: 'allMids' });
  var dexMids = {};
  IC_HL_EXTRA_DEXES.forEach(function(dex) {
    dexMids[dex] = IC_HL_fetchInfo_({ type: 'allMids', dex: dex });
  });

  var positions = IC_HL_readPositionMap_(clearingStates);
  var usdc = IC_HL_readSpotUsdc_(spotState);

  IC_HL_ensureHyperliquidFuturesRows_(calculationsSheet);
  IC_HL_syncUsdcHl_(calculationsSheet, usdc.availableAfterMaintenance);
  IC_HL_syncSupportedFuturesPositions_(calculationsSheet, positions);
  IC_HL_syncLivePrices_(ss, primaryMids, dexMids);
  IC_HL_refreshPortfolioAccounting_(ss);
}

function IC_HL_syncLivePrices_(ss, primaryMids, dexMids) {
  var sheet = ss.getSheetByName(IC_HL_PRICES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return;

  IC_HL_ensurePriceRow_(sheet, 'GRAM LIVE');
  IC_HL_setPriceSource_(sheet, 'GRAM LIVE', 'GRAM', 'Hyperliquid', 'GRAM (ex-TON), live Hyperliquid mid');
  IC_HL_setPriceSource_(sheet, 'ATOM', 'ATOM', 'Hyperliquid', 'Live Hyperliquid ATOM mid');
  IC_HL_setPriceSource_(sheet, 'GOLD LONG', 'xyz:GOLD', 'Hyperliquid xyz', 'Live Hyperliquid xyz:GOLD mid');
  IC_HL_ensurePriceRow_(sheet, 'SPCXB');
  IC_HL_setPriceSource_(sheet, 'SPCXB', 'xyz:SPCX', 'Hyperliquid xyz', 'SpaceX tokenized (BNB Chain), live Hyperliquid xyz:SPCX mid');
  IC_HL_disableLegacyPriceRow_(sheet, 'BTC SHORT');
  IC_HL_disableLegacyPriceRow_(sheet, 'GRAM');

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  var updatedAt = new Date();

  rows.forEach(function(row, index) {
    var source = String(row[4] || '').toLowerCase();
    var apiTicker = String(row[5] || '').trim();
    var autoUpdate = String(row[6] || '').toLowerCase();
    if (source.indexOf('hyperliquid') < 0 || autoUpdate !== 'on' || !apiTicker) return;

    var price = 0;
    var dexSeparator = apiTicker.indexOf(':');
    if (dexSeparator > 0) {
      var dex = apiTicker.slice(0, dexSeparator);
      price = IC_HL_toNumber_(dexMids[dex] && dexMids[dex][apiTicker]);
    } else {
      price = IC_HL_toNumber_(primaryMids && primaryMids[apiTicker]);
    }

    if (!price) return;
    sheet.getRange(index + 2, 3, 1, 2).setValues([[price, updatedAt]]);
  });
}

function IC_HL_ensurePriceRow_(sheet, asset) {
  if (IC_HL_findAssetRow_(sheet, asset)) return;
  sheet.appendRow([asset, asset, '', '', '', '', 'Off', '']);
}

function IC_HL_setPriceSource_(sheet, asset, apiTicker, source, note) {
  var rowIndex = IC_HL_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  sheet.getRange(rowIndex, 5, 1, 4).setValues([[source, apiTicker, 'On', note]]);
}

function IC_HL_disableLegacyPriceRow_(sheet, asset) {
  var rowIndex = IC_HL_findAssetRow_(sheet, asset);
  if (!rowIndex) return;

  sheet.getRange(rowIndex, 7, 1, 2).setValues([['Off', 'Legacy closed position; retained for audit']]);
}

function IC_HL_refreshOverviewTopPositions_(ss) {
  var overview = ss.getSheetByName('Обзор');
  if (!overview) return;

  [1, 2, 3].forEach(function(rank, index) {
    var column = index + 1;
    var assetCell = overview.getRange(6, column);
    var assetRef = assetCell.getA1Notation();
    var rankedValue = 'LARGE(FILTER(\'Расчеты\'!G$2:G$100;\'Расчеты\'!G$2:G$100>0;\'Расчеты\'!B$2:B$100<>"Кэш / Стейблы");' + rank + ')';

    assetCell.setFormula('=IFERROR(INDEX(\'Расчеты\'!A$2:A$100;MATCH(' + rankedValue + ';\'Расчеты\'!G$2:G$100;0));"-")');
    overview.getRange(7, column).setFormula('=IFERROR(INDEX(\'Расчеты\'!J$2:J$100;MATCH(' + assetRef + ';\'Расчеты\'!A$2:A$100;0));0)');
    overview.getRange(8, column).setFormula('=IFERROR(INDEX(\'Расчеты\'!G$2:G$100;MATCH(' + assetRef + ';\'Расчеты\'!A$2:A$100;0));0)');
    overview.getRange(9, column).setFormula('=IFERROR(INDEX(\'Расчеты\'!K$2:K$100;MATCH(' + assetRef + ';\'Расчеты\'!A$2:A$100;0));"")');
  });
}

function IC_HL_refreshPortfolioAccounting_(ss) {
  var overview = ss.getSheetByName('Обзор');
  var calculations = ss.getSheetByName(IC_HL_CALCULATIONS_SHEET);
  var risk = ss.getSheetByName('Риск');
  var history = ss.getSheetByName('История');
  if (!overview || !calculations || !risk) return;

  var expectedOverviewFormula = '=ROUND(SUM(\'Расчеты\'!G2:G100),2)';
  if (
    overview.getRange('A2').getFormula().replace(/;/g, ',') === expectedOverviewFormula &&
    calculations.getRange('X4').getFormula().indexOf('SUMPRODUCT') >= 0
  ) return;

  calculations.getRange('X2').setFormula('=SUMIF(B2:B100,"\u0424\u044c\u044e\u0447\u0435\u0440\u0441\u044b",E2:E100)');
  calculations.getRange('X3').setFormula('=SUMIF(B2:B100,"\u0424\u044c\u044e\u0447\u0435\u0440\u0441\u044b",G2:G100)');
  calculations.getRange('X4').setFormula('=SUMPRODUCT((B2:B100="\u0424\u044c\u044e\u0447\u0435\u0440\u0441\u044b")*ABS(C2:C100*F2:F100))');
  calculations.getRange('X5').setFormula('=SUMIF(B2:B100,"\u0424\u044c\u044e\u0447\u0435\u0440\u0441\u044b",H2:H100)');
  calculations.getRange('X7').setFormula('=ROUND(SUM(G2:G100)*10%,2)');
  calculations.getRange('X8').setFormula('=X3+X10');
  calculations.getRange('X9').setFormula('=IFERROR(X4/SUM(G2:G100),0)');
  calculations.getRange('X10').setFormula('=SUMIF(A2:A100,"USDC HL",G2:G100)');
  calculations.getRange('X11').setFormula('=IF(X9>10%,"OVER LIMIT","OK")');
  calculations.getRange('X12').setFormula('=SUMIF(A2:A100,"GOLD LONG",E2:E100)');
  calculations.getRange('X15').setFormula('=SUMIF(A2:A100,"GOLD LONG",G2:G100)');
  calculations.getRange('X16').setFormula('=SUMIF(A2:A100,"GOLD LONG",H2:H100)');
  calculations.getRange('X17').setFormula('=MAX(0,X4-X7)');
  calculations.getRange('X18').setFormula('=IF(X17>0,"OVER LIMIT: \u0441\u043d\u0438\u0437\u0438\u0442\u044c \u043d\u043e\u043c\u0438\u043d\u0430\u043b \u0434\u043e 10%","OK: \u043d\u0438\u0436\u0435 \u043b\u0438\u043c\u0438\u0442\u0430 10%")');
  calculations.getRange('X19').setFormula('=X8+X15');
  calculations.getRange('X20').setFormula('=IFERROR(X19/SUM(G2:G100),0)');
  calculations.getRange('X21').setFormula('=X19');
  calculations.getRange('X22').setFormula('=X17');
  calculations.getRange('W24').setValue('btcCurrentMargin');
  calculations.getRange('X24').setFormula('=SUMIF(A2:A100,"BTC*",G2:G100)');
  calculations.getRange('W25').setValue('hlFreeAvailable');
  calculations.getRange('X25').setFormula('=X10');
  calculations.getRange('W26').setValue('btcUnrealizedPnl');
  calculations.getRange('X26').setFormula('=SUMIF(A2:A100,"BTC*",H2:H100)');
  calculations.getRange('W27').setValue('btcCurrentNotional');
  calculations.getRange('X27').setFormula('=SUMPRODUCT((LEFT(A2:A100,3)="BTC")*ABS(C2:C100*F2:F100))');
  calculations.getRange('X28').setFormula('=SUMIF(B2:B100,"\u041a\u044d\u0448 / \u0421\u0442\u0435\u0439\u0431\u043b\u044b",G2:G100)+SUMIF(B2:B100,"\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0435 \u0434\u0435\u043d\u044c\u0433\u0438",G2:G100)');
  calculations.getRange('X29').setFormula('=X28-X30');
  calculations.getRange('X30').setFormula('=SUMIF(A2:A100,"USDC HL",G2:G100)');
  calculations.getRange('X31').setFormula('=X28');
  calculations.getRange('X32').setFormula('=MAX(0,X28-SUM(G2:G100)*30%)');

  overview.getRange('A2').setFormula('=ROUND(SUM(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100),2)');
  overview.getRange('B2').setFormula('=ROUND(SUM(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!E2:E100),2)');
  overview.getRange('C2').setFormula('=A2-B2');
  overview.getRange('D2').setFormula('=IFERROR(C2/B2,0)');
  overview.getRange('E2').setFormula('=ROUND(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X28,2)');
  overview.getRange('F2').setFormula('=COUNTIFS(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100,">0",\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!B2:B100,"<>\u041a\u044d\u0448 / \u0421\u0442\u0435\u0439\u0431\u043b\u044b",\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!B2:B100,"<>\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0435 \u0434\u0435\u043d\u044c\u0433\u0438")');

  var categoryRows = [
    [12, '\u041a\u0440\u0438\u043f\u0442\u0430'],
    [13, '\u0410\u043a\u0446\u0438\u0438'],
    [14, '\u041c\u0435\u0442\u0430\u043b\u043b\u044b'],
    [15, '\u0424\u044c\u044e\u0447\u0435\u0440\u0441\u044b']
  ];
  categoryRows.forEach(function(item) {
    overview.getRange(item[0], 2).setFormula('=SUMIF(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!B2:B100,"' + item[1] + '",\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100)');
    overview.getRange(item[0], 3).setFormula('=IFERROR(B' + item[0] + '/$A$2,0)');
  });
  overview.getRange('B16').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X28');
  overview.getRange('C16').setFormula('=IFERROR(B16/$A$2,0)');

  overview.getRange('B18').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X2');
  overview.getRange('B19').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X3');
  overview.getRange('B20').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X4');
  overview.getRange('B21').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X5');
  overview.getRange('B22').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X7');
  overview.getRange('B23').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X8');
  overview.getRange('B24').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X9');
  overview.getRange('B25').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X12');
  overview.getRange('B26').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X19');
  overview.getRange('B27').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X21');
  overview.getRange('B28').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X17');
  overview.getRange('B29').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X18');
  overview.getRange('C18:C29').setValues([
    ['\u041d\u0430\u0447\u0430\u043b\u044c\u043d\u0430\u044f \u043c\u0430\u0440\u0436\u0430 BTC/MNT'],
    ['\u0422\u0435\u043a\u0443\u0449\u0430\u044f \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c \u043c\u0430\u0440\u0436\u0438 BTC/MNT'],
    ['\u041d\u043e\u043c\u0438\u043d\u0430\u043b\u044c\u043d\u0430\u044f \u044d\u043a\u0441\u043f\u043e\u0437\u0438\u0446\u0438\u044f BTC/MNT'],
    ['Unrealized PnL BTC/MNT'],
    ['10% \u043e\u0442 \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u0438 \u043f\u043e\u0440\u0442\u0444\u0435\u043b\u044f'],
    ['BTC/MNT current margin + \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0439 USDC HL'],
    ['\u041d\u043e\u043c\u0438\u043d\u0430\u043b BTC/MNT / \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c \u043f\u043e\u0440\u0442\u0444\u0435\u043b\u044f'],
    ['\u041d\u0430\u0447\u0430\u043b\u044c\u043d\u0430\u044f \u043c\u0430\u0440\u0436\u0430 GOLD'],
    ['\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u043a\u0430\u043f\u0438\u0442\u0430\u043b HL \u0432\u043a\u043b\u044e\u0447\u0430\u044f GOLD'],
    ['\u0422\u043e \u0436\u0435, \u0441\u0432\u0435\u0440\u043a\u0430'],
    ['\u041f\u0440\u0435\u0432\u044b\u0448\u0435\u043d\u0438\u0435 \u043d\u043e\u043c\u0438\u043d\u0430\u043b\u0430 BTC/MNT \u043d\u0430\u0434 10%'],
    ['\u0421\u0442\u0430\u0442\u0443\u0441 \u043f\u043e \u043d\u043e\u043c\u0438\u043d\u0430\u043b\u0443 BTC/MNT']
  ]);

  overview.getRange('N1').setFormula('=SUM(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!E2:E100)');
  overview.getRange('N2').setFormula('=SUM(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100)');
  overview.getRange('N6').setFormula('=B2');
  overview.getRange('N7').setFormula('=A2');
  overview.getRange('N8').setFormula('=C2');
  overview.getRange('Q1').setFormula('=IFERROR(INDEX(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!A2:A100,MATCH(MAXIFS(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!I2:I100,\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100,">0",\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!B2:B100,"<>\u041a\u044d\u0448 / \u0421\u0442\u0435\u0439\u0431\u043b\u044b"),\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!I2:I100,0)),"-")');
  overview.getRange('Q2').setFormula('=IFERROR(INDEX(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!H2:H100,MATCH(Q1,\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!A2:A100,0)),0)');
  overview.getRange('Q3').setFormula('=IFERROR(INDEX(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!A2:A100,MATCH(MINIFS(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!I2:I100,\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100,">0",\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!B2:B100,"<>\u041a\u044d\u0448 / \u0421\u0442\u0435\u0439\u0431\u043b\u044b"),\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!I2:I100,0)),"-")');
  overview.getRange('Q4').setFormula('=IFERROR(INDEX(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!H2:H100,MATCH(Q3,\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!A2:A100,0)),0)');

  risk.getRange('B2').setFormula('=SUM(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100)');
  risk.getRange('B3').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X28');
  risk.getRange('B4').setFormula('=IFERROR(B3/B2,0)');
  risk.getRange('B5').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X32');
  risk.getRange('B6').setFormula('=IFERROR(INDEX(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!A2:A100,MATCH(MAXIFS(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100,\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!B2:B100,"<>\u041a\u044d\u0448 / \u0421\u0442\u0435\u0439\u0431\u043b\u044b"),\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100,0)),"-")');
  risk.getRange('B7').setFormula('=IFERROR(MAXIFS(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100,\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!B2:B100,"<>\u041a\u044d\u0448 / \u0421\u0442\u0435\u0439\u0431\u043b\u044b")/B2,0)');
  risk.getRange('B8').setFormula('=IFERROR(SUMIF(\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!B2:B100,"\u041a\u0440\u0438\u043f\u0442\u0430",\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!G2:G100)/B2,0)');
  risk.getRange('B19').setFormula('=B8-B16');
  risk.getRange('B28').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X9');
  risk.getRange('B29').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X10');
  risk.getRange('B30').setFormula('=IF(B28>B27,"\u041f\u0440\u0435\u0432\u044b\u0448\u0435\u043d - \u0441\u043d\u0438\u0437\u0438\u0442\u044c \u043d\u043e\u043c\u0438\u043d\u0430\u043b \u0434\u043e 10%","\u0412 \u043d\u043e\u0440\u043c\u0435")');
  risk.getRange('B31').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X15');
  risk.getRange('B32').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X17');
  risk.getRange('B33').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X19');
  risk.getRange('B34').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X20');
  risk.getRange('B35').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X17');
  risk.getRange('B36').setFormula('=\'\u0420\u0430\u0441\u0447\u0435\u0442\u044b\'!X18');
  risk.getRange('A28').setValue('\u0422\u0435\u043a\u0443\u0449\u0430\u044f \u0434\u043e\u043b\u044f \u043d\u043e\u043c\u0438\u043d\u0430\u043b\u0430 BTC/MNT');
  risk.getRange('A31').setValue('GOLD current margin (\u041c\u0435\u0442\u0430\u043b\u043b\u044b)');
  risk.getRange('A33').setValue('\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u043a\u0430\u043f\u0438\u0442\u0430\u043b HL \u0441 GOLD');
  risk.getRange('A34').setValue('\u0414\u043e\u043b\u044f \u043a\u0430\u043f\u0438\u0442\u0430\u043b\u0430 HL \u0441 GOLD (\u0438\u043d\u0444\u043e)');
  risk.getRange('A37').setValue('BTC current margin');
  risk.getRange('A38').setValue('HL free available');
  risk.getRange('A39').setValue('BTC unrealized PnL');
  risk.getRange('A40').setValue('BTC current notional');

  if (history && history.getLastRow() >= 2) {
    var historyRows = history.getLastRow() - 1;
    var historyValues = history.getRange(2, 2, historyRows, 3).getValues();
    historyValues.forEach(function(row, index) {
      if (row[0] === '' || row[1] === '' || row[2] === '') return;
      history.getRange(index + 2, 5).setFormulaR1C1('=IFERROR(RC[-1]/RC[-2],0)');
    });
  }
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
  var leverage = Math.abs(IC_HL_toNumber_(position.leverage && position.leverage.value));
  var hasReturnOnEquity = position.returnOnEquity !== undefined && position.returnOnEquity !== null && position.returnOnEquity !== '';
  var returnOnEquity = IC_HL_toNumber_(position.returnOnEquity);
  var currentPrice = sizeAbs ? positionValue / sizeAbs : 0;
  var initialMargin = leverage ? sizeAbs * entryPx / leverage : marginUsed;

  return {
    coin: String(position.coin || '').toUpperCase(),
    direction: sizeSigned >= 0 ? 'LONG' : 'SHORT',
    sizeSigned: sizeSigned,
    sizeAbs: sizeAbs,
    entryPx: entryPx,
    currentPrice: currentPrice,
    marginUsed: marginUsed,
    initialMargin: initialMargin,
    unrealizedPnl: unrealizedPnl,
    currentValue: Math.max(0, marginUsed),
    pnlPct: hasReturnOnEquity ? returnOnEquity : (initialMargin ? unrealizedPnl / initialMargin : 0)
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
  IC_HL_setIfColumnExists_(sheet, rowIndex, 'invested', position.initialMargin);
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
