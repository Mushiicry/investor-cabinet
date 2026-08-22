/**
 * Wife portfolio API module.
 *
 * This file is bundled into the canonical Investor Cabinet Apps Script project.
 * Keep the former wife API implementation private inside IC_WIFE_API so its
 * generic helper names do not collide with the main account script files.
 */
var IC_WIFE_API = (function() {
  /**
   * Mushi Invest - Wife (Polina) Portfolio API v2.1
   * Blockchain-first: live balances fetched from verified public endpoints
   *
   * Update:
   * 1. Open this project in script.google.com and paste the whole file.
   * 2. Deploy -> Manage deployments -> Edit.
   * 3. Select new version and save. The URL remains the same.
   */

  var MAIN_SS_ID = '1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8';
  var WIFE_SS_ID = '1X8nywasqpGyULEUKu11OJbJqXZUwlFXcDLtQyH6_rqA';
  var PRICE_SS_ID = '1f35sUKkMBzGIF-xG1Fz0zNvrmcrVWo4Sx7I0XHCPhCY';
  var WIFE_CABINET_LIVE_URL = 'https://investor-cabinet.vercel.app/api/investor-wife';
  var KOSHA_SHEET_NAME = String.fromCharCode(1082, 1086, 1096, 1072);
  var CAT_CRYPTO = String.fromCharCode(1050, 1088, 1080, 1087, 1090, 1072);
  var CAT_STABLE = String.fromCharCode(1050, 1101, 1096, 32, 47, 32, 1057, 1090, 1077, 1081, 1073, 1083, 1099);
  var CAT_STOCKS = String.fromCharCode(1040, 1082, 1094, 1080, 1080);
  var CAT_METALS = String.fromCharCode(1052, 1077, 1090, 1072, 1083, 1083, 1099);
  var CAT_FUTURES = String.fromCharCode(1060, 1100, 1102, 1095, 1077, 1088, 1089, 1099);
  var TEXT_LIVE_BLOCKCHAIN = String.fromCharCode(76, 105, 118, 101, 32, 1073, 1083, 1086, 1082, 1095, 1077, 1081, 1085, 32, 1076, 1072, 1085, 1085, 1099, 1077);
  var TEXT_FOLLOW_STRATEGY = String.fromCharCode(1057, 1083, 1077, 1076, 1091, 1081, 1090, 1077, 32, 1089, 1090, 1088, 1072, 1090, 1077, 1075, 1080, 1080);
  var TEXT_WIFE_LIVE = String.fromCharCode(1055, 1086, 1088, 1090, 1092, 1077, 1083, 1100, 32, 1078, 1077, 1085, 1099, 32, 45, 32, 108, 105, 118, 101, 32, 1073, 1083, 1086, 1082, 1095, 1077, 1081, 1085);
  var TEXT_LONG_TERM = String.fromCharCode(1044, 1086, 1083, 1075, 1086, 1089, 1088, 1086, 1095, 1085, 1072, 1103, 32, 1089, 1090, 1088, 1072, 1090, 1077, 1075, 1080, 1103);
  var TEXT_GOOD = String.fromCharCode(1061, 1086, 1088, 1086, 1096, 1086);
  var TEXT_MODERATE = String.fromCharCode(1059, 1084, 1077, 1088, 1077, 1085, 1085, 1086);
  var TEXT_WARNING = String.fromCharCode(1042, 1085, 1080, 1084, 1072, 1085, 1080, 1077);
  var TEXT_CRITICAL = String.fromCharCode(1050, 1088, 1080, 1090, 1080, 1095, 1085, 1086);
  var TEXT_BUY = String.fromCharCode(1055, 1086, 1082, 1091, 1087, 1082, 1072);
  var TEXT_SELL = String.fromCharCode(1055, 1088, 1086, 1076, 1072, 1078, 1072);
  var SHEET_HISTORY = U(1048, 1089, 1090, 1086, 1088, 1080, 1103);
  var SHEET_TRANSACTIONS = U(1058, 1088, 1072, 1085, 1079, 1072, 1082, 1094, 1080, 1080);
  var SHEET_PORTFOLIO = U(1055, 1086, 1088, 1090, 1092, 1077, 1083, 1100);
  var WIFE_HISTORY_TRIGGER_HANDLER = 'syncWifeDailySnapshot';
  var H_DATE = U(1044, 1072, 1090, 1072);
  var H_PORTFOLIO_VALUE = U(1057, 1090, 1086, 1080, 1084, 1086, 1089, 1090, 1100, 32, 1087, 1086, 1088, 1090, 1092, 1077, 1083, 1103);
  var H_INVESTED = U(1042, 1083, 1086, 1078, 1077, 1085, 1086);
  var H_RESERVE = U(1056, 1077, 1079, 1077, 1088, 1074);
  var H_POSITIONS_COUNT = U(1050, 1086, 1083, 45, 1074, 1086, 32, 1087, 1086, 1079, 1080, 1094, 1080, 1081);
  var H_POINT_TYPE = U(1058, 1080, 1087, 32, 1090, 1086, 1095, 1082, 1080);
  var H_NOTE = U(1047, 1072, 1084, 1077, 1090, 1082, 1072);
  var H_AUTO_SNAPSHOT = U(1040, 1074, 1090, 1086, 45, 1089, 1085, 1080, 1084, 1086, 1082);
  var H_TRIGGER = U(1058, 1088, 1080, 1075, 1075, 1077, 1088);
  var H_SOURCE = U(1048, 1089, 1090, 1086, 1095, 1085, 1080, 1082);
  var H_COMMENT = U(1050, 1086, 1084, 1084, 1077, 1085, 1090, 1072, 1088, 1080, 1081);
  var H_ASSET = U(1040, 1082, 1090, 1080, 1074);
  var TEXT_NEED = U(1053, 1091, 1078, 1085, 1086);
  var TEXT_TETHER_SIGN = String.fromCharCode(8366);

  function U() {
    return String.fromCharCode.apply(null, arguments);
  }

  // Public wallet addresses (read-only)
  var EVM_ADDRESS = '0x06F03b067b34f3d6E569De9aB7839c988Bf6BAEE';
  var TON_ADDRESS = 'UQCMRrWTgMBqBMr6yUw04ZYz398fyIhDlaJyaqoQTchVNm74';
  var BTC_ADDRESS = 'bc1qmmpq6jm6rr02anv7ldnpq29cqrpqesswesv7at';
  var SOL_ADDRESS = '3XR4H5XiVKdWGFEb9r3KbFcJ7o2vhQsFvTsFt1MutuCs';

  // Token contracts
  var USDT_ARB_CONTRACT = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'; // Tether USDT on Arbitrum One

  // RPC endpoints verified with Google Apps Script
  // ETH and USDT are on Arbitrum, so one RPC is enough.
  var ARB_RPC      = 'https://1rpc.io/arb';                  // primary Arbitrum RPC
  var ARB_RPC_BCK  = 'https://arbitrum-one.public.blastapi.io'; // fallback
  var SOL_RPC      = 'https://api.mainnet-beta.solana.com';
  var HL_INFO_URL  = 'https://api.hyperliquid.xyz/info';

  // ----------------------------------------------------------------------------

  function doGet(e) {
    try {
      var result = buildWifePortfolioJson();
      return jsonOutput_(result);
    } catch (err) {
      return jsonOutput_({
        success:   false,
        error:     err.message,
        updatedAt: new Date().toISOString()
      });
    }
  }

  function jsonOutput_(value) {
    return ContentService
      .createTextOutput(JSON.stringify(value))
      .setMimeType(ContentService.MimeType.JSON);
  }

  function buildWifePortfolioJson(options) {
    options = options || {};
    var useLive = options.useLive === true;
    var useLivePrices = useLive || options.useLivePrices === true;
    var useLiveStable = useLive || options.useLiveStable === true;
    var liveBalances = (useLive || useLiveStable) ? fetchAllBlockchainBalances() : null;
    var blockchain = useLive
      ? liveBalances
      : useLiveStable
        ? {
            USDT: liveBalances.USDT,
            USDT_ARB: liveBalances.USDT_ARB,
            USDT_TON: liveBalances.USDT_TON,
            _errors: liveBalances._errors || {}
          }
        : { _errors: { mode: 'site read uses Google Sheets quantities; Vercel adds live prices' } };
    var priceMap = useLivePrices ? getLivePrices() : getSheetPrices_();

    var wifeSS    = SpreadsheetApp.openById(WIFE_SS_ID);
    var wifeSheet = wifeSS.getSheets()[0];
    var data      = wifeSheet.getDataRange().getValues();

    if (data.length < 2) throw new Error('Wife data sheet is empty');

    var headers = data[0].map(function(h) { return String(h).trim(); });

    function col(name) {
      var idx = headers.indexOf(name);
      if (idx < 0) throw new Error('Column not found: ' + name);
      return idx;
    }

    var iAsset    = col('asset');
    var iTicker   = col('ticker');
    var iCat      = col('category');
    var iEntry    = col('avgEntry');
    var iQty      = col('quantity');
    var iInvested = col('invested');
    var iStatus   = col('status');

    var positions       = [];
    var totalInvested   = 0;
    var totalCurrentVal = 0;
    var reserve         = 0;

    for (var i = 1; i < data.length; i++) {
      var row    = data[i];
      var asset  = String(row[iAsset] || '').trim();
      if (!asset) continue;

      var ticker   = String(row[iTicker]   || asset).trim();
      var category = String(row[iCat]      || CAT_CRYPTO).trim();
      var avgEntry = toFloat(row[iEntry]);
      var invested = toFloat(row[iInvested]);
      var status   = String(row[iStatus]   || 'Hold').trim();

      var isStable = (category === CAT_STABLE) || ticker === 'USDT' || ticker === 'USDC';

      // Priority: blockchain live > sheet manual > derived from invested/entry
      // Use > 0, not >= 0. A failed fetch returning zero must not
      // override sheet data. A real zero balance is handled by the client.
      var chainQty = blockchain.hasOwnProperty(ticker) ? blockchain[ticker] : -1;
      var sheetQty = toFloat(row[iQty]);
      var quantity;
      var source;

      if (chainQty > 0) {
        quantity = chainQty;
        source   = 'live';
      } else if (sheetQty > 0) {
        quantity = sheetQty;
        source   = 'manual';
      } else if (!isStable && avgEntry > 0 && invested > 0) {
        quantity = r6(invested / avgEntry);
        source   = 'derived';
      } else {
        quantity = 0;
        source   = 'zero';
      }

      var normalizedTicker = ticker.toUpperCase();
      var normalizedAsset  = asset.toUpperCase();
      var currentPrice = isStable
        ? 1.0
        : (priceMap[normalizedTicker] || priceMap[normalizedAsset] || avgEntry);
      var currentValue = isStable ? r2(quantity) : r2(quantity * currentPrice);

      // Stablecoins: invested equals current balance when available (1 USDT = 1 USD),
      // otherwise use the sheet value as fallback.
      var effectiveInvested = isStable
        ? (quantity > 0 ? r2(quantity) : r2(invested))
        : r2(invested);

      var pnl    = isStable ? 0 : r2(currentValue - effectiveInvested);
      var pnlPct = (!isStable && effectiveInvested > 0) ? r2(pnl / effectiveInvested * 100) : 0;

      totalInvested   += effectiveInvested;
      totalCurrentVal += currentValue;
      if (isStable) reserve += currentValue;

      positions.push({
        asset:        asset,
        ticker:       ticker,
        category:     category,
        quantity:     quantity,
        avgEntry:     avgEntry,
        invested:     effectiveInvested,
        currentPrice: rPrice(currentPrice),
        currentValue: currentValue,
        pnl:          pnl,
        pnlPct:       pnlPct,
        share:        0,
        status:       status,
        dataSource:   source
      });
    }

    var portfolioValue = r2(totalCurrentVal);

    positions.forEach(function(p) {
      p.share = portfolioValue > 0 ? r2(p.currentValue / portfolioValue * 100) : 0;
    });

    var totalPnl    = r2(totalCurrentVal - totalInvested);
    var totalPnlPct = totalInvested > 0 ? r6(totalPnl / totalInvested) : 0;

    var crypto = positions.filter(function(p) { return p.category !== CAT_STABLE; });
    var best   = crypto.length ? crypto.reduce(function(a, b) { return b.pnl > a.pnl ? b : a; }) : null;
    var worst  = crypto.length ? crypto.reduce(function(a, b) { return b.pnl < a.pnl ? b : a; }) : null;
    var largestRisk = crypto.length ? crypto.reduce(function(a, b) { return b.share > a.share ? b : a; }) : null;

    var reserveShare = portfolioValue > 0 ? reserve / portfolioValue : 0;
    var cryptoValue  = positions.filter(function(p) { return p.category === CAT_CRYPTO; })
                                 .reduce(function(s, p) { return s + p.currentValue; }, 0);
    var cryptoShare  = portfolioValue > 0 ? r2(cryptoValue / portfolioValue * 100) : 0;

    var health = computeHealth(reserveShare, cryptoShare / 100, largestRisk ? largestRisk.share / 100 : 0);

    var categoryNames = [CAT_CRYPTO, CAT_STOCKS, CAT_METALS, CAT_FUTURES, CAT_STABLE];
    var catMap = {};
    positions.forEach(function(p) { catMap[p.category] = (catMap[p.category] || 0) + p.currentValue; });
    var categories = categoryNames.map(function(name) {
      var val = catMap[name] || 0;
      return { name: name, value: r2(val), share: portfolioValue > 0 ? r4(val / portfolioValue) : 0 };
    });

    return {
      success:   true,
      patch:     useLive
        ? 'WIFE API v2.1 - blockchain-first'
        : useLivePrices
          ? 'WIFE API v2.6 - live snapshot base'
          : 'WIFE API v2.4 - sheet-base',
      updatedAt: new Date().toISOString(),

      // Debug: raw balances fetched from blockchain
      _chain: blockchain,

      overview: {
        investedLabel:  'Total Invested',
        invested:       r2(totalInvested),
        portfolioLabel: 'Portfolio Today',
        portfolioValue: portfolioValue,
        pnlLabel:       'Total PnL',
        pnl:            totalPnl,
        pnlPct:         totalPnlPct,
        reserve:        r2(reserve),
        positionsCount: crypto.length,
        health:         health,
        state:          healthLabel(health),
        signal:         useLive || useLivePrices ? 'Hyperliquid цены + live USDT' : 'Google Sheets база + Vercel live prices',
        action:         TEXT_FOLLOW_STRATEGY,
        categories:     categories,
        bestPosition:   best  ? { asset: best.asset,  pnl: best.pnl  } : null,
        worstPosition:  worst ? { asset: worst.asset, pnl: worst.pnl } : null
      },

      portfolio: positions,

      risk: {
        portfolioValue:   portfolioValue,
        reserve:          r2(reserve),
        reserveShare:     r2(reserveShare * 100),
        deployableCash:   0,
        largestRiskAsset: largestRisk ? largestRisk.asset : '',
        largestRiskShare: largestRisk ? r2(largestRisk.share) : 0,
        cryptoShare:      cryptoShare,
        health:           health,
        state:            healthLabel(health),
        signal:           TEXT_WIFE_LIVE,
        summary:          TEXT_LONG_TERM
      },

      fearGreedStrategy: {
        currentIndex:   50,
        currentMode:    'observation',
        portfolioValue: r2(totalInvested),
        rules:          []
      },

      history:      readHistory(wifeSS),
      transactions: readTransactions(wifeSS),
      decisions:    [],
      scenarios:    []
    };
  }

  //  Portfolio history sheet 
  function readHistory(ss) {
    var sheet = ss.getSheetByName(SHEET_HISTORY) || ss.getSheetByName('History');
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    var headers = data[0].map(function(h) { return String(h).trim(); });
    var rows    = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var get = function(name, alt) {
        var idx = headers.indexOf(name);
        if (idx < 0 && alt) idx = headers.indexOf(alt);
        return idx >= 0 ? row[idx] : '';
      };

      var dateVal = get('date', H_DATE);
      var pv      = Number(get('portfolioValue', H_PORTFOLIO_VALUE)) || 0;
      if (!dateVal || !pv) continue;

      var invested = Number(get('invested', H_INVESTED))        || 0;
      var pnl      = Number(get('pnl', 'PnL $'))              || 0;
      var pnlPct   = Number(get('pnlPct', 'PnL %'))           || 0;
      var reserve  = Number(get('reserve', H_RESERVE))         || 0;
      var cnt      = Number(get('positionsCount', H_POSITIONS_COUNT)) || 0;

      rows.push({
        date:           String(dateVal instanceof Date ? dateVal.toISOString() : dateVal),
        portfolioValue: r2(pv),
        invested:       r2(invested),
        pnl:            r2(pnl),
        pnlPct:         Math.abs(pnlPct) > 1 ? r6(pnlPct / 100) : r6(pnlPct),
        reserve:        r2(reserve),
        positionsCount: Math.round(cnt),
        pointType:      String(get('pointType', H_POINT_TYPE) || 'auto'),
        note:           String(get('note', H_NOTE)            || H_AUTO_SNAPSHOT),
        trigger:        String(get('trigger', H_TRIGGER)      || 'daily'),
        source:         String(get('source', H_SOURCE)        || 'sheet'),
        comment:        String(get('comment', H_COMMENT)      || ''),
      });
    }

    return rows;
  }

  function syncWifeDailySnapshot() {
    var wifeJson = fetchWifeCabinetLiveSnapshot_();
    if (!wifeJson || !wifeJson.success || !wifeJson.overview) {
      throw new Error('Wife portfolio JSON is not available');
    }

    return writeWifeDailySnapshotOverview_(wifeJson.overview, 'Wife portfolio daily snapshot; live valuation from cabinet API');
  }

  function recordWifeDailySnapshot(params) {
    var overview = {
      portfolioValue: toFloat(params && params.portfolioValue),
      invested: toFloat(params && params.invested),
      pnl: toFloat(params && params.pnl),
      pnlPct: toFloat(params && params.pnlPct),
      reserve: toFloat(params && params.reserve),
      positionsCount: toFloat(params && params.positionsCount)
    };

    if (overview.portfolioValue <= 0) throw new Error('Wife portfolio value is empty');
    if (overview.invested <= 0) throw new Error('Wife invested value is empty');

    return writeWifeDailySnapshotOverview_(overview, 'Wife portfolio daily snapshot; live valuation recorded from cabinet API');
  }

  function writeWifeDailySnapshotOverview_(overview, comment) {
    var ss = SpreadsheetApp.openById(WIFE_SS_ID);
    var sheet = getOrCreateWifeHistorySheet_(ss);
    var timezone = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'Europe/Moscow';
    var now = new Date();
    var targetRow = findWifeHistoryDateRow_(sheet, now, timezone);
    if (!targetRow) targetRow = Math.max(sheet.getLastRow() + 1, 3);

    var portfolioValue = r2(toFloat(overview.portfolioValue));
    var invested = r2(toFloat(overview.invested));
    var pnl = r2(toFloat(overview.pnl));
    var pnlPct = r6(toFloat(overview.pnlPct));
    var reserve = r2(toFloat(overview.reserve));
    var positionsCount = Math.round(toFloat(overview.positionsCount));

    if (portfolioValue <= 0) throw new Error('Wife portfolio value is empty');

    sheet.getRange(targetRow, 1, 1, 12).setValues([[
      now,
      portfolioValue,
      invested,
      pnl,
      pnlPct,
      reserve,
      positionsCount,
      'auto',
      H_AUTO_SNAPSHOT,
      'daily',
      'apps-script',
      comment || 'Wife portfolio daily snapshot; live valuation from cabinet API'
    ]]);
    sheet.getRange(targetRow, 1).setNumberFormat('dd.MM.yyyy');
    sheet.getRange(targetRow, 5).setNumberFormat('0.00%');

    return {
      row: targetRow,
      date: Utilities.formatDate(now, timezone, 'dd.MM.yyyy'),
      portfolioValue: portfolioValue,
      invested: invested,
      pnl: pnl,
      pnlPct: pnlPct,
      reserve: reserve,
      positionsCount: positionsCount
    };
  }

  function fetchWifeCabinetLiveSnapshot_() {
    var response = UrlFetchApp.fetch(WIFE_CABINET_LIVE_URL, {
      method: 'get',
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    var body = response.getContentText();
    if (code < 200 || code >= 300) {
      throw new Error('Wife cabinet live API failed: ' + code + ' ' + body.slice(0, 300));
    }

    var payload = JSON.parse(body);
    if (!payload || !payload.success || !payload.overview) {
      throw new Error('Wife cabinet live API returned invalid payload');
    }

    return payload;
  }

  function setupWifeDailySnapshotTrigger() {
    removeWifeDailySnapshotTrigger();

    ScriptApp.newTrigger(WIFE_HISTORY_TRIGGER_HANDLER)
      .timeBased()
      .everyDays(1)
      .atHour(23)
      .nearMinute(55)
      .create();

    return syncWifeDailySnapshot();
  }

  function removeWifeDailySnapshotTrigger() {
    ScriptApp.getProjectTriggers().forEach(function(trigger) {
      if (trigger.getHandlerFunction() === WIFE_HISTORY_TRIGGER_HANDLER) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
  }

  function getOrCreateWifeHistorySheet_(ss) {
    var sheet = ss.getSheetByName(SHEET_HISTORY) || ss.getSheetByName('History');
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_HISTORY);
    }

    var headers = ['date','portfolioValue','invested','pnl','pnlPct','reserve','positionsCount','pointType','note','trigger','source','comment'];
    var labels = [H_DATE,H_PORTFOLIO_VALUE,H_INVESTED,'PnL $','PnL %',H_RESERVE,H_POSITIONS_COUNT,H_POINT_TYPE,H_NOTE,H_TRIGGER,H_SOURCE,H_COMMENT];

    var firstRow = sheet.getLastRow() >= 1
      ? sheet.getRange(1, 1, 1, headers.length).getValues()[0].map(function(value) { return String(value).trim(); })
      : [];
    var needsHeaders = headers.some(function(header, index) { return firstRow[index] !== header; });

    if (needsHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(2, 1, 1, labels.length).setValues([labels]);
      sheet.setFrozenRows(2);
    }

    return sheet;
  }

  function findWifeHistoryDateRow_(sheet, date, timezone) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return 0;

    var targetKey = wifeHistoryDateKey_(date, timezone);
    var values = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      if (wifeHistoryDateKey_(values[i][0], timezone) === targetKey) return i + 3;
    }

    return 0;
  }

  function wifeHistoryDateKey_(value, timezone) {
    if (value instanceof Date) return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');

    var text = String(value || '').trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

    var match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) return match[3] + '-' + match[2] + '-' + match[1];

    var parsed = new Date(text);
    return isNaN(parsed.getTime()) ? text : Utilities.formatDate(parsed, timezone, 'yyyy-MM-dd');
  }

  //  Transaction history sheet 
  function readTransactions(ss) {
    var sheet = ss.getSheetByName(SHEET_TRANSACTIONS) || ss.getSheetByName('Transactions');
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    var headers = data[0].map(function(h) { return String(h).trim(); });
    var rows    = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var get = function(name) {
        var idx = headers.indexOf(name);
        return idx >= 0 ? row[idx] : '';
      };

      var id     = String(get('id')     || '').trim();
      var hash   = String(get('hash')   || '').trim();
      var asset  = String(get('asset')  || '').trim();
      var action = String(get('action') || '').trim();
      if (!id && !hash) continue;
      if (id === 'ID' || asset === H_ASSET) continue;
      if (!asset || !action) continue;

      var dateVal = get('date');
      rows.push({
        id:           id,
        status:       String(get('status')      || 'CONFIRMED'),
        date:         String(dateVal instanceof Date ? dateVal.toISOString() : dateVal),
        asset:        asset,
        category:     String(get('category')    || ''),
        action:       action,
        quantity:     Number(get('quantity'))   || 0,
        price:        Number(get('price'))      || 0,
        amount:       Number(get('amount'))     || 0,
        comment:      String(get('comment')     || ''),
        walletId:     String(get('walletId')    || ''),
        chain:        String(get('chain')       || ''),
        hash:         hash,
        direction:    String(get('direction')   || ''),
        counterparty: String(get('counterparty')|| ''),
        rawAsset:     String(get('rawAsset')    || ''),
        rawAmount:    Number(get('rawAmount'))  || 0,
        note:         String(get('note')        || ''),
      });
    }

    return rows;
  }

  //  Blockchain balance fetcher 

  function fetchAllBlockchainBalances() {
    var b = {};
    var errors = {};

    // ETH on Arbitrum, not mainnet.
    try {
      var ethRes = arbRpc('eth_getBalance', [EVM_ADDRESS, 'latest']);
      if (ethRes && ethRes.result) {
        b.ETH = r6(hexToInt(ethRes.result) / 1e18);
      } else {
        errors.ETH = 'no result';
      }
    } catch(e) { errors.ETH = e.message; }

    // USDT on Arbitrum via EVM balanceOf.
    // ABI: balanceOf(address) selector=0x70a08231, param=32-byte padded address
    try {
      var addrPadded = '000000000000000000000000' + EVM_ADDRESS.slice(2).toLowerCase();
      var callData   = '0x70a08231' + addrPadded;
      var usdtRes    = arbRpc('eth_call', [{ to: USDT_ARB_CONTRACT, data: callData }, 'latest']);
      if (usdtRes && usdtRes.result && usdtRes.result.length > 2) {
        b.USDT_ARB = r2(hexToInt(usdtRes.result) / 1e6); // USDT = 6 decimals
      } else {
        errors.USDT_ARB = 'empty result';
      }
    } catch(e) { errors.USDT_ARB = e.message; }

    // Native TON balance.
    try {
      var tonRes = UrlFetchApp.fetch(
        'https://tonapi.io/v2/accounts/' + TON_ADDRESS,
        { muteHttpExceptions: true }
      );
      var tonData = JSON.parse(tonRes.getContentText());
      if (tonData && tonData.balance !== undefined) {
        b.TON = r4(Number(tonData.balance) / 1e9); // nanotons to TON
      } else {
        errors.TON = JSON.stringify(tonData).slice(0, 100);
      }
    } catch(e) { errors.TON = e.message; }

    // USDT on TON from jetton balances.
    try {
      var jettonsRes = UrlFetchApp.fetch(
        'https://tonapi.io/v2/accounts/' + TON_ADDRESS + '/jettons',
        { muteHttpExceptions: true }
      );
      var jettonsData = JSON.parse(jettonsRes.getContentText());
      var balances    = jettonsData.balances || [];
      for (var j = 0; j < balances.length; j++) {
        var jt   = balances[j];
        var name = (jt.jetton || {}).name || '';
        var sym  = (jt.jetton || {}).symbol || '';
        // Find Tether USD, not a GRAM-like token.
        if (name === 'Tether USD' || sym.replace(TEXT_TETHER_SIGN, 'T') === 'USDT') {
          var dec = (jt.jetton || {}).decimals;
          dec = (dec !== undefined) ? Number(dec) : 6;
          b.USDT_TON = r2(Number(jt.balance) / Math.pow(10, dec));
          break;
        }
      }
      if (b.USDT_TON === undefined) errors.USDT_TON = 'not found in jettons list';
    } catch(e) { errors.USDT_TON = e.message; }

    // Total USDT on Arbitrum and TON.
    b.USDT = r2((b.USDT_ARB || 0) + (b.USDT_TON || 0));

    // BTC via Blockstream open API.
    try {
      var btcRes  = UrlFetchApp.fetch(
        'https://blockstream.info/api/address/' + BTC_ADDRESS,
        { muteHttpExceptions: true }
      );
      var btcData = JSON.parse(btcRes.getContentText());
      var funded  = (btcData.chain_stats || {}).funded_txo_sum || 0;
      var spent   = (btcData.chain_stats || {}).spent_txo_sum  || 0;
      b.BTC = r8((funded - spent) / 1e8); // satoshis to BTC
    } catch(e) { errors.BTC = e.message; }

    // SOL via public mainnet RPC.
    try {
      var solRes = UrlFetchApp.fetch(SOL_RPC, {
        method:      'post',
        contentType: 'application/json',
        payload:     JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [SOL_ADDRESS] }),
        muteHttpExceptions: true
      });
      var solData = JSON.parse(solRes.getContentText());
      if (solData.result && solData.result.value !== undefined) {
        b.SOL = r6(solData.result.value / 1e9); // lamports to SOL
      } else {
        errors.SOL = 'no result';
      }
    } catch(e) { errors.SOL = e.message; }

    b._errors = errors;
    return b;
  }

  // Arbitrum RPC with fallback.
  function arbRpc(method, params) {
    var payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params });
    var opts     = { method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true };
    var resp     = UrlFetchApp.fetch(ARB_RPC, opts);
    var data     = JSON.parse(resp.getContentText());
    // Try fallback RPC when primary fails.
    if (data.error || !data.result) {
      var resp2 = UrlFetchApp.fetch(ARB_RPC_BCK, opts);
      data      = JSON.parse(resp2.getContentText());
    }
    return data;
  }

  //  Live prices from Hyperliquid, sheet fallback 

  function getLivePrices() {
    var priceMap = {};

    try {
      var primary = fetchHyperliquidMids({ type: 'allMids' });
      var xyz     = fetchHyperliquidMids({ type: 'allMids', dex: 'xyz' });

      ['BTC', 'ETH', 'SOL', 'ATOM', 'BNB', 'MNT', 'APEX'].forEach(function(ticker) {
        addPrice_(priceMap, ticker, primary[ticker]);
      });

      addPrice_(priceMap, 'GRAM', primary.GRAM);
      addPrice_(priceMap, 'TON', primary.GRAM);

      var gold = xyz['xyz:GOLD'];
      addPrice_(priceMap, 'GOLD', gold);
      addPrice_(priceMap, 'GOLD LONG', gold);
      addPrice_(priceMap, 'XAU', gold);
      addPrice_(priceMap, 'XAUUSD', gold);

      var spcx = xyz['xyz:SPCX'];
      addPrice_(priceMap, 'SPACEX', spcx);
      addPrice_(priceMap, 'SPCX', spcx);
      addPrice_(priceMap, 'SPCXB', spcx);

      addPrice_(priceMap, 'USDT', 1);
      addPrice_(priceMap, 'USDC', 1);
    } catch(e) {
      Logger.log('getLivePrices Hyperliquid error: ' + e.message);
    }

    mergeSheetPrices_(priceMap);
    return priceMap;
  }

  function fetchHyperliquidMids(payload) {
    var response = UrlFetchApp.fetch(HL_INFO_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    var body = response.getContentText();
    if (code < 200 || code >= 300) {
      throw new Error('Hyperliquid request failed: ' + code + ' ' + body);
    }

    return JSON.parse(body);
  }

  function addPrice_(priceMap, ticker, value) {
    var key = String(ticker || '').trim().toUpperCase();
    var price = toFloat(value);
    if (key && price > 0) priceMap[key] = price;
  }

  function mergeSheetPrices_(priceMap) {
    try {
      var ss = SpreadsheetApp.openById(MAIN_SS_ID);
      var sheet = ss.getSheetByName(SHEET_PORTFOLIO);
      if (!sheet) return;

      var data = sheet.getDataRange().getValues();
      if (data.length < 2) return;

      var headers = data[0].map(function(h) { return String(h).trim(); });
      var tCol = headers.indexOf('ticker');
      var pCol = headers.indexOf('currentPrice');
      if (tCol < 0 || pCol < 0) return;

      for (var i = 1; i < data.length; i++) {
        var ticker = String(data[i][tCol] || '').trim().toUpperCase();
        var price = toFloat(data[i][pCol]);
        if (ticker && price > 0 && !priceMap[ticker]) priceMap[ticker] = price;
      }
    } catch(e) {
      Logger.log('mergeSheetPrices_ error: ' + e.message);
    }
  }

  function getSheetPrices_() {
    var priceMap = {};
    addPrice_(priceMap, 'USDT', 1);
    addPrice_(priceMap, 'USDC', 1);
    mergeSheetPrices_(priceMap);
    return priceMap;
  }

  function syncKoshaPriceSheet() {
    var wifeJson = buildWifePortfolioJson({ useLive: true });
    if (!wifeJson || !wifeJson.success) {
      throw new Error('Wife portfolio JSON is not available');
    }

    var ss = SpreadsheetApp.openById(PRICE_SS_ID);
    var sheet = ss.getSheetByName(KOSHA_SHEET_NAME);
    if (!sheet) throw new Error('Sheet not found: ' + KOSHA_SHEET_NAME);

    var order = ['ETH', 'TON', 'BTC', 'SOL', 'USDT', 'GOLD', 'SpaceX'];
    var byAsset = {};
    (wifeJson.portfolio || []).forEach(function(position) {
      var key = String(position.asset || '').trim().toUpperCase();
      if (key) byAsset[key] = position;
    });

    var data = sheet.getDataRange().getValues();
    var existingRows = {};
    var summaryRow = 0;

    for (var r = 1; r < data.length; r++) {
      var assetName = String(data[r][0] || '').trim().toUpperCase();
      if (assetName) existingRows[assetName] = r + 1;
      if (!summaryRow && String(data[r][2] || '').indexOf(TEXT_NEED) >= 0) {
        summaryRow = r + 1;
      }
    }

    if (!summaryRow) summaryRow = Math.max(sheet.getLastRow() + 1, 7);

    var added = [];
    var updated = [];

    order.forEach(function(assetName) {
      var key = assetName.toUpperCase();
      var position = byAsset[key];
      if (!position) return;

      var targetRow = existingRows[key];
      if (!targetRow) {
        sheet.insertRowsBefore(summaryRow, 1);
        targetRow = summaryRow;
        summaryRow++;
        if (targetRow > 2) {
          sheet.getRange(targetRow - 1, 1, 1, 7).copyTo(sheet.getRange(targetRow, 1, 1, 7), { formatOnly: true });
        }
        existingRows[key] = targetRow;
        added.push(assetName);
      } else {
        updated.push(assetName);
      }

      var currentPrice = toFloat(position.currentPrice);
      var avgEntry = toFloat(position.avgEntry);
      var invested = toFloat(position.invested);
      var currentValue = toFloat(position.currentValue);
      var pnl = toFloat(position.pnl);
      var pnlPct = toFloat(position.pnlPct) / 100;

      sheet.getRange(targetRow, 1, 1, 7).setValues([[
        assetName,
        rPrice(currentPrice),
        avgEntry,
        invested,
        pnlPct,
        r2(pnl),
        r2(currentValue)
      ]]);
    });

    sheet.getRange(2, 8, 1, 3).setValues([[
      r2(wifeJson.overview.invested),
      r2(wifeJson.overview.portfolioValue),
      r2(wifeJson.overview.pnl)
    ]]);

    return {
      success: true,
      sheet: KOSHA_SHEET_NAME,
      added: added,
      updated: updated,
      summary: {
        invested: r2(wifeJson.overview.invested),
        currentValue: r2(wifeJson.overview.portfolioValue),
        pnl: r2(wifeJson.overview.pnl)
      },
      updatedAt: new Date().toISOString()
    };
  }

  //  Health scoring 

  function computeHealth(reserveShare, cryptoShare, largestShare) {
    var reservePts = Math.min(100, reserveShare * 333);
    var concPts    = Math.max(0, 100 - Math.max(0, largestShare - 0.25) * 286);
    var expPts     = Math.max(0, 100 - Math.max(0, cryptoShare - 0.6) * 333);
    return Math.round(reservePts * 0.5 + concPts * 0.3 + expPts * 0.2);
  }

  function healthLabel(h) {
    if (h >= 80) return TEXT_GOOD;
    if (h >= 60) return TEXT_MODERATE;
    if (h >= 40) return TEXT_WARNING;
    return TEXT_CRITICAL;
  }

  //  Helpers 

  function hexToInt(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return parseInt(hex, 16);
  }

  function toFloat(v) {
    var n = parseFloat(String(v || '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function r2(n) { return Math.round(n * 100)        / 100;        }
  function r4(n) { return Math.round(n * 10000)       / 10000;      }
  function r6(n) { return Math.round(n * 1000000)     / 1000000;    }
  function r8(n) { return Math.round(n * 100000000)   / 100000000;  }
  function rPrice(n) {
    var abs = Math.abs(n);
    if (abs < 10) return r6(n);
    if (abs < 1000) return r4(n);
    return r2(n);
  }

  // 
  // ONE-TIME SETUP - run once, then keep or remove.
  // 

  /**
   * Creates History and Transactions sheets for Polina.
   * Run setupWifeSheets manually if needed.
   */
  function setupWifeSheets() {
    var wifeSS = SpreadsheetApp.openById(WIFE_SS_ID);
    _createHistorySheet(wifeSS);
    _createTransactionsSheet(wifeSS);
    Logger.log('setupWifeSheets: done');
  }

  function _styleHeader(sheet, row, ncols) {
    var r = sheet.getRange(row, 1, 1, ncols);
    r.setBackground('#1a1a2e');
    r.setFontColor('#00d4ff');
    r.setFontWeight('bold');
    r.setFontSize(10);
    r.setBorder(false,false,true,false,false,false,'#00d4ff', SpreadsheetApp.BorderStyle.SOLID);
  }

  function _createHistorySheet(ss) {
    var old = ss.getSheetByName(SHEET_HISTORY);
    if (old) ss.deleteSheet(old);
    var sh = ss.insertSheet(SHEET_HISTORY);

    var eng = ['date','portfolioValue','invested','pnl','pnlPct','reserve','positionsCount','pointType','note','trigger','source','comment'];
    var display = ['date','portfolio value','invested','pnl $','pnl %','reserve','positions count','point type','note','trigger','source','comment'];
    sh.getRange(1,1,1,eng.length).setValues([eng]);
    sh.getRange(2,1,1,display.length).setValues([display]);
    _styleHeader(sh, 1, eng.length);
    sh.getRange(2,1,1,display.length).setBackground('#0a0a1a').setFontColor('#7a7aaa').setFontWeight('bold');
    sh.setFrozenRows(2);

    var widths = [180,150,120,100,80,100,120,100,200,100,100,250];
    widths.forEach(function(w,i){ sh.setColumnWidth(i+1,w); });
    Logger.log('History sheet created');
  }

  // 
  // FIX USDT IN SHEET
  // Legacy owner-only helper. Not exposed through doGet.
  // Fetches real USDT balances from chain and writes them to the main sheet.
  //   quantity = blockchain balance, invested = same value for stablecoins.
  // After this the sheet has a fallback value if server-side fetch fails.
  // 
  function fixUsdtInSheet(overrideArb, overrideTon) {
    // 1. Fetch real balances or use passed values.
    var usdtArb = (overrideArb !== null && overrideArb !== undefined) ? overrideArb : _fetchUsdtArb();
    var usdtTon = (overrideTon !== null && overrideTon !== undefined) ? overrideTon : _fetchUsdtTon();
    var totalUsdt = r2(usdtArb + usdtTon);

    Logger.log('fixUsdtInSheet: ARB=' + usdtArb + ' TON=' + usdtTon + ' total=' + totalUsdt);

    // 2. Open the main sheet.
    var ss = SpreadsheetApp.openById(WIFE_SS_ID);
    var sheet = ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h){ return String(h).trim(); });

    function colIdx(name) {
      var i = headers.indexOf(name);
      if (i < 0) throw new Error('Column not found: ' + name);
      return i;
    }

    var iAsset    = colIdx('asset');
    var iQty      = colIdx('quantity');
    var iInvested = colIdx('invested');
    var iEntry    = colIdx('avgEntry');

    var updated = [];

    // 3. Find USDT row and update it.
    for (var r = 1; r < data.length; r++) {
      var asset = String(data[r][iAsset] || '').trim().toUpperCase();
      if (asset === 'USDT') {
        sheet.getRange(r + 1, iQty + 1).setValue(totalUsdt);
        sheet.getRange(r + 1, iInvested + 1).setValue(totalUsdt);
        // avgEntry = 1 if empty.
        if (!toFloat(data[r][iEntry])) {
          sheet.getRange(r + 1, iEntry + 1).setValue(1);
        }
        updated.push({ row: r + 1, qty: totalUsdt, invested: totalUsdt });
        Logger.log('fixUsdtInSheet: row ' + (r+1) + ' updated qty=' + totalUsdt + ' invested=' + totalUsdt);
      }
    }

    if (updated.length === 0) {
      Logger.log('fixUsdtInSheet: USDT row not found');
      return { success: false, error: 'USDT row not found in sheet', usdtArb: usdtArb, usdtTon: usdtTon };
    }

    return {
      success:   true,
      usdtArb:   usdtArb,
      usdtTon:   usdtTon,
      totalUsdt: totalUsdt,
      updated:   updated,
      updatedAt: new Date().toISOString()
    };
  }

  // Direct USDT balance helpers for owner-only fixUsdtInSheet.
  function _fetchUsdtArb() {
    try {
      var padded = '000000000000000000000000' + EVM_ADDRESS.slice(2).toLowerCase();
      var payload = JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', data: '0x70a08231' + padded }, 'latest']
      });
      var resp = UrlFetchApp.fetch(ARB_RPC, { method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true });
      var d = JSON.parse(resp.getContentText());
      var hex = d.result || '0x0';
      return Math.round(parseInt(hex, 16) / 1e4) / 100; // 6 decimals to 2dp
    } catch(e) {
      Logger.log('_fetchUsdtArb error: ' + e.message);
      return 0;
    }
  }

  function _fetchUsdtTon() {
    try {
      var url = 'https://tonapi.io/v2/accounts/' + TON_ADDRESS + '/jettons';
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var d = JSON.parse(resp.getContentText());
      for (var i = 0; i < (d.balances || []).length; i++) {
        var b = d.balances[i];
        var sym = (b.jetton && b.jetton.symbol || '').replace(TEXT_TETHER_SIGN, 'T');
        if (sym === 'USDT') {
          var dec = Number(b.jetton.decimals || 6);
          return Math.round(Number(b.balance) / Math.pow(10, dec) * 100) / 100;
        }
      }
      return 0;
    } catch(e) {
      Logger.log('_fetchUsdtTon error: ' + e.message);
      return 0;
    }
  }

  function _createTransactionsSheet(ss) {
    var old = ss.getSheetByName(SHEET_TRANSACTIONS);
    if (old) ss.deleteSheet(old);
    var sh = ss.insertSheet(SHEET_TRANSACTIONS);

    var eng = ['id','date','asset','category','action','quantity','price','amount','chain','hash','status','direction','walletId','counterparty','rawAsset','rawAmount','note','comment'];
    var display = ['id','date','asset','category','action','quantity','price','amount','chain','hash','status','direction','wallet id','counterparty','raw asset','raw amount','note','comment'];
    sh.getRange(1,1,1,eng.length).setValues([eng]);
    sh.getRange(2,1,1,display.length).setValues([display]);
    _styleHeader(sh, 1, eng.length);
    sh.getRange(2,1,1,display.length).setBackground('#0a0a1a').setFontColor('#7a7aaa').setFontWeight('bold');
    sh.setFrozenRows(2);

    var widths = [80,180,80,120,80,100,100,100,80,280,100,100,120,120,100,100,200,250];
    widths.forEach(function(w,i){ sh.setColumnWidth(i+1,w); });
    Logger.log('Transactions sheet created');
  }

  // 
  // BLOCKCHAIN TRANSACTION SYNC
  // Runs from the hourly trigger.
  // Run setupSyncTrigger once to install the trigger.
  // 

  // Install hourly trigger. Run manually once.
  function setupSyncTrigger() {
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === 'syncTransactions') ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('syncTransactions').timeBased().everyHours(1).create();
    Logger.log('syncTransactions trigger installed hourly');
  }

  // Main sync function. Writes new blockchain transactions to Transactions sheet.
  function syncTransactions() {
    var ss = SpreadsheetApp.openById(WIFE_SS_ID);
    var sheet = ss.getSheetByName(SHEET_TRANSACTIONS);
    if (!sheet) { _createTransactionsSheet(ss); sheet = ss.getSheetByName(SHEET_TRANSACTIONS); }

    var existingIds = _getExistingTxIds(sheet);
    var rows = [];

    _fetchArbTokenTransfers(existingIds, rows);
    _fetchArbEthTransfers(existingIds, rows);
    _fetchTonTransactions(existingIds, rows);
    _fetchBtcTransactions(existingIds, rows);

    if (rows.length > 0) {
      var lastRow = Math.max(sheet.getLastRow(), 2);
      sheet.getRange(lastRow + 1, 1, rows.length, 18).setValues(rows);
      Logger.log('syncTransactions: added ' + rows.length + ' new transactions');
    } else {
      Logger.log('syncTransactions: no new transactions');
    }
  }

  function _getExistingTxIds(sheet) {
    var ids = {};
    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return ids;
    var data = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    data.forEach(function(row) { if (row[0]) ids[String(row[0])] = true; });
    return ids;
  }

  function _fmtDate(dt) {
    if (!(dt instanceof Date)) dt = new Date(dt);
    return Utilities.formatDate(dt, 'Europe/Moscow', 'yyyy-MM-dd HH:mm:ss');
  }

  function _isStable(symbol) {
    return ['USDT','USDC','DAI','BUSD','USDE'].indexOf(_normalizeAssetSymbol(symbol)) >= 0;
  }

  function _normalizeAssetSymbol(symbol) {
    var normalized = String(symbol || '')
      .toUpperCase()
      .replace(/\u0301/g, '')
      .replace(TEXT_TETHER_SIGN, 'T')
      .replace(/Т/g, 'T');
    if (normalized === 'USDT0' || normalized === 'USDTE' || normalized.indexOf('USDT') === 0) return 'USDT';
    return normalized;
  }

  function _bcAction(symbol, isIn) {
    // Raw wallet stable transfers are capital flows unless a paired swap importer
    // explicitly rewrites them into buy/sell rows.
    if (_isStable(symbol)) return isIn ? 'Пополнение' : 'Вывод';
    return isIn ? TEXT_BUY : TEXT_SELL;
  }

  function _fetchArbTokenTransfers(existingIds, rows) {
    try {
      var url = 'https://arbitrum.blockscout.com/api/v2/addresses/' + EVM_ADDRESS + '/token-transfers';
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var d = JSON.parse(resp.getContentText());
      var items = d.items || [];
      items.forEach(function(item) {
        var hash = item.tx_hash || item.transaction_hash || '';
        var decimals = Number(item.token && item.token.decimals || 6);
        var rawQty = Number(item.total && item.total.value || 0);
        var quantity = rawQty / Math.pow(10, decimals);
        var rawSymbol = (item.token && item.token.symbol) || 'UNKNOWN';
        var symbol = _normalizeAssetSymbol(rawSymbol);
        if (quantity < 0.0001 || !hash) return;
        var id = 'bc:arb_tok:' + hash + ':' + rawQty;
        if (existingIds[id]) return;
        var isIn = (item.to && item.to.hash || '').toLowerCase() === EVM_ADDRESS.toLowerCase();
        var action = _bcAction(symbol, isIn);
        var amount = _isStable(symbol) ? quantity : 0;
        rows.push([id, _fmtDate(item.timestamp || new Date()), symbol, _isStable(symbol) ? CAT_STABLE : CAT_CRYPTO, action,
          quantity, 0, amount, 'ARB', hash, 'CONFIRMED', isIn ? 'IN' : 'OUT',
          EVM_ADDRESS, isIn ? (item.from && item.from.hash || '') : (item.to && item.to.hash || ''),
          rawSymbol, quantity, 'blockchain', '']);
        existingIds[id] = true;
      });
    } catch(e) { Logger.log('_fetchArbTokenTransfers error: ' + e.message); }
  }

  function _fetchArbEthTransfers(existingIds, rows) {
    try {
      var url = 'https://arbitrum.blockscout.com/api/v2/addresses/' + EVM_ADDRESS + '/transactions';
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var d = JSON.parse(resp.getContentText());
      var items = d.items || [];
      items.forEach(function(item) {
        var hash = item.hash || '';
        var ethAmount = parseInt(item.value || '0', 10) / 1e18;
        if (ethAmount < 0.0001 || !hash) return;
        var id = 'bc:arb_eth:' + hash;
        if (existingIds[id]) return;
        var isIn = (item.to && item.to.hash || '').toLowerCase() === EVM_ADDRESS.toLowerCase();
        rows.push([id, _fmtDate(item.timestamp || new Date()), 'ETH', CAT_CRYPTO, isIn ? TEXT_BUY : TEXT_SELL,
          ethAmount, 0, 0, 'ARB', hash, item.status === 'ok' ? 'CONFIRMED' : 'PENDING', isIn ? 'IN' : 'OUT',
          EVM_ADDRESS, isIn ? (item.from && item.from.hash || '') : (item.to && item.to.hash || ''),
          'ETH', ethAmount, 'blockchain', '']);
        existingIds[id] = true;
      });
    } catch(e) { Logger.log('_fetchArbEthTransfers error: ' + e.message); }
  }

  function _fetchTonTransactions(existingIds, rows) {
    try {
      var url = 'https://tonapi.io/v2/accounts/' + TON_ADDRESS + '/events?limit=50&subject_only=true';
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var d = JSON.parse(resp.getContentText());
      var events = d.events || [];
      events.forEach(function(evt) {
        var eventId = evt.event_id || String(evt.lt || '');
        var date = evt.timestamp ? new Date(evt.timestamp * 1000) : new Date();
        var actions = evt.actions || [];
        actions.forEach(function(act, i) {
          var rowId = 'bc:ton:' + eventId + ':' + i;
          if (existingIds[rowId]) return;
          if (act.type === 'TonTransfer') {
            var tt = act.TonTransfer || {};
            var qty = Number(tt.amount || 0) / 1e9;
            if (qty < 0.01) return;
            var isIn = (tt.sender && tt.sender.address || '').toLowerCase() !== TON_ADDRESS.toLowerCase();
            rows.push([rowId, _fmtDate(date), 'TON', CAT_CRYPTO, isIn ? TEXT_BUY : TEXT_SELL,
              qty, 0, 0, 'TON', eventId, 'CONFIRMED', isIn ? 'IN' : 'OUT',
              TON_ADDRESS, isIn ? (tt.sender && tt.sender.address || '') : (tt.recipient && tt.recipient.address || ''),
              'TON', qty, 'blockchain', '']);
            existingIds[rowId] = true;
          } else if (act.type === 'JettonTransfer') {
            var jt = act.JettonTransfer || {};
            var decimals = Number(jt.jetton && jt.jetton.decimals || 6);
            var qty = Number(jt.amount || 0) / Math.pow(10, decimals);
            if (qty < 0.001) return;
            var rawSymbol = jt.jetton && jt.jetton.symbol || 'USDT';
            var symbol = _normalizeAssetSymbol(rawSymbol);
            var isIn = (jt.sender && jt.sender.address || '').toLowerCase() !== TON_ADDRESS.toLowerCase();
            var action = _bcAction(symbol, isIn);
            var amount = _isStable(symbol) ? qty : 0;
            rows.push([rowId, _fmtDate(date), symbol, _isStable(symbol) ? CAT_STABLE : CAT_CRYPTO, action,
              qty, 0, amount, 'TON', eventId, 'CONFIRMED', isIn ? 'IN' : 'OUT',
              TON_ADDRESS, isIn ? (jt.sender && jt.sender.address || '') : (jt.recipient && jt.recipient.address || ''),
              rawSymbol, qty, 'blockchain', '']);
            existingIds[rowId] = true;
          }
        });
      });
    } catch(e) { Logger.log('_fetchTonTransactions error: ' + e.message); }
  }

  function _fetchBtcTransactions(existingIds, rows) {
    try {
      var url = 'https://blockstream.info/api/address/' + BTC_ADDRESS + '/txs';
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var txs = JSON.parse(resp.getContentText());
      txs.forEach(function(tx) {
        var hash = tx.txid || '';
        if (!hash) return;
        var id = 'bc:btc:' + hash;
        if (existingIds[id]) return;
        var received = (tx.vout || []).reduce(function(sum, out) {
          return sum + ((out.scriptpubkey_address || '') === BTC_ADDRESS ? Number(out.value || 0) : 0);
        }, 0);
        var spent = (tx.vin || []).reduce(function(sum, inp) {
          return sum + ((inp.prevout && inp.prevout.scriptpubkey_address || '') === BTC_ADDRESS ? Number(inp.prevout && inp.prevout.value || 0) : 0);
        }, 0);
        var net = (received - spent) / 1e8;
        if (Math.abs(net) < 0.000001) return;
        var isIn = net > 0;
        var qty = Math.abs(net);
        var ts = tx.status && tx.status.block_time ? new Date(tx.status.block_time * 1000) : new Date();
        rows.push([id, _fmtDate(ts), 'BTC', CAT_CRYPTO, isIn ? TEXT_BUY : TEXT_SELL,
          qty, 0, 0, 'BTC', hash, tx.status && tx.status.confirmed ? 'CONFIRMED' : 'PENDING', isIn ? 'IN' : 'OUT',
          BTC_ADDRESS, '', 'BTC', qty, 'blockchain', '']);
        existingIds[id] = true;
      });
    } catch(e) { Logger.log('_fetchBtcTransactions error: ' + e.message); }
  }


  return {
    buildPortfolioJson: buildWifePortfolioJson,
    syncDailySnapshot: syncWifeDailySnapshot,
    setupDailySnapshotTrigger: setupWifeDailySnapshotTrigger,
    removeDailySnapshotTrigger: removeWifeDailySnapshotTrigger,
    recordDailySnapshot: recordWifeDailySnapshot
  };
})();
