/**
 * Mushi Invest — Жена (Polina) Portfolio API v2.1
 * Blockchain-first: live balances fetched from verified public endpoints
 *
 * КАК ОБНОВИТЬ:
 * 1. script.google.com → открыть проект → вставить весь этот код
 * 2. Развернуть → Управление развёртываниями → ✏️ Edit
 *    → Версия: "Новая версия" → Сохранить (URL не меняется)
 */

var MAIN_SS_ID = '1bk_Ex8Kl6jSlcxDNV0BIBio0CRTFK_jyRdB5-06Mpm8';
var WIFE_SS_ID = '1X8nywasqpGyULEUKu11OJbJqXZUwlFXcDLtQyH6_rqA';

// ─── Публичные адреса кошельков (read-only) ─────────────────────────────────
var EVM_ADDRESS = '0x06F03b067b34f3d6E569De9aB7839c988Bf6BAEE';
var TON_ADDRESS = 'UQCMRrWTgMBqBMr6yUw04ZYz398fyIhDlaJyaqoQTchVNm74';
var BTC_ADDRESS = 'bc1qmmpq6jm6rr02anv7ldnpq29cqrpqesswesv7at';
var SOL_ADDRESS = '3XR4H5XiVKdWGFEb9r3KbFcJ7o2vhQsFvTsFt1MutuCs';

// ─── Token contracts ─────────────────────────────────────────────────────────
var USDT_ARB_CONTRACT = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'; // Tether USDT on Arbitrum One

// ─── RPC endpoints (проверены на работу с Google Apps Script) ────────────────
// ETH и USDT оба на Arbitrum — используем один RPC
var ARB_RPC      = 'https://1rpc.io/arb';                  // основной Arbitrum RPC
var ARB_RPC_BCK  = 'https://arbitrum-one.public.blastapi.io'; // резервный
var SOL_RPC      = 'https://api.mainnet-beta.solana.com';

// ─────────────────────────────────────────────────────────────────────────────

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;

  // ?action=fixUsdt — записывает USDT в лист (пробует blockchain fetch)
  if (action === 'fixUsdt') {
    try {
      var res = fixUsdtInSheet(null, null);
      return ContentService
        .createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ?action=fixUsdtNow — записывает USDT напрямую без UrlFetch (значения из blockchain на 08.07.2026)
  // Запускается один раз для патча. После этого buildWifePortfolioJson сам подтянет live данные.
  if (action === 'fixUsdtNow') {
    try {
      var res = fixUsdtInSheet(406.58, 250.40);
      return ContentService
        .createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  try {
    var result = buildWifePortfolioJson();
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success:   false,
        error:     err.message,
        updatedAt: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function buildWifePortfolioJson() {
  var blockchain = fetchAllBlockchainBalances();
  var priceMap   = getLivePrices();

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
    var category = String(row[iCat]      || 'Крипта').trim();
    var avgEntry = toFloat(row[iEntry]);
    var invested = toFloat(row[iInvested]);
    var status   = String(row[iStatus]   || 'Hold').trim();

    var isStable = (category === 'Кэш / Стейблы') || ticker === 'USDT' || ticker === 'USDC';

    // Priority: blockchain live > sheet manual > derived from invested/entry
    // ВАЖНО: используем > 0, а не >= 0 — ноль от упавшего fetch не должен
    // перебивать данные листа. Реальный нулевой баланс обработается клиентом.
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

    var currentPrice = isStable ? 1.0 : (priceMap[ticker] || avgEntry);
    var currentValue = isStable ? r2(quantity) : r2(quantity * currentPrice);

    // Для стейблов: invested = текущий баланс если есть (1 USDT = 1$),
    // иначе берём из листа как fallback (после fixUsdtInSheet будет заполнено).
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
      currentPrice: r2(currentPrice),
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

  var crypto = positions.filter(function(p) { return p.category !== 'Кэш / Стейблы'; });
  var best   = crypto.length ? crypto.reduce(function(a, b) { return b.pnl > a.pnl ? b : a; }) : null;
  var worst  = crypto.length ? crypto.reduce(function(a, b) { return b.pnl < a.pnl ? b : a; }) : null;

  var reserveShare = portfolioValue > 0 ? reserve / portfolioValue : 0;
  var cryptoValue  = positions.filter(function(p) { return p.category === 'Крипта'; })
                               .reduce(function(s, p) { return s + p.currentValue; }, 0);
  var cryptoShare  = portfolioValue > 0 ? r2(cryptoValue / portfolioValue * 100) : 0;

  var health = computeHealth(reserveShare, cryptoShare / 100, best ? best.share / 100 : 0);

  var categoryNames = ['Крипта', 'Акции', 'Металлы', 'Фьючерсы', 'Кэш / Стейблы'];
  var catMap = {};
  positions.forEach(function(p) { catMap[p.category] = (catMap[p.category] || 0) + p.currentValue; });
  var categories = categoryNames.map(function(name) {
    var val = catMap[name] || 0;
    return { name: name, value: r2(val), share: portfolioValue > 0 ? r4(val / portfolioValue) : 0 };
  });

  return {
    success:   true,
    patch:     'WIFE API v2.1 — blockchain-first',
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
      signal:         'Live блокчейн данные',
      action:         'Следуйте стратегии',
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
      largestRiskAsset: best ? best.asset : '',
      largestRiskShare: best ? r2(best.share) : 0,
      cryptoShare:      cryptoShare,
      health:           health,
      state:            healthLabel(health),
      signal:           'Портфель жены — live блокчейн',
      summary:          'Долгосрочная стратегия'
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

// ─── История портфеля (вкладка «История») ────────────────────────────────────
function readHistory(ss) {
  var sheet = ss.getSheetByName('История') || ss.getSheetByName('History');
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

    var dateVal = get('date', 'Дата');
    var pv      = Number(get('portfolioValue', 'Стоимость портфеля')) || 0;
    if (!dateVal || !pv) continue;

    var invested = Number(get('invested', 'Вложено'))        || 0;
    var pnl      = Number(get('pnl', 'PnL $'))              || 0;
    var pnlPct   = Number(get('pnlPct', 'PnL %'))           || 0;
    var reserve  = Number(get('reserve', 'Резерв'))         || 0;
    var cnt      = Number(get('positionsCount', 'Кол-во позиций')) || 0;

    rows.push({
      date:           String(dateVal instanceof Date ? dateVal.toISOString() : dateVal),
      portfolioValue: r2(pv),
      invested:       r2(invested),
      pnl:            r2(pnl),
      pnlPct:         Math.abs(pnlPct) > 1 ? r6(pnlPct / 100) : r6(pnlPct),
      reserve:        r2(reserve),
      positionsCount: Math.round(cnt),
      pointType:      String(get('pointType', 'Тип точки') || 'auto'),
      note:           String(get('note', 'Заметка')         || 'Авто-снимок'),
      trigger:        String(get('trigger', 'Триггер')      || 'daily'),
      source:         String(get('source', 'Источник')      || 'sheet'),
      comment:        String(get('comment', 'Комментарий')  || ''),
    });
  }

  return rows;
}

// ─── История транзакций (вкладка «Транзакции») ────────────────────────────────
function readTransactions(ss) {
  var sheet = ss.getSheetByName('Транзакции') || ss.getSheetByName('Transactions');
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

    var id   = String(get('id')   || '');
    var hash = String(get('hash') || '');
    if (!id && !hash) continue;

    var dateVal = get('date');
    rows.push({
      id:           id,
      status:       String(get('status')      || 'CONFIRMED'),
      date:         String(dateVal instanceof Date ? dateVal.toISOString() : dateVal),
      asset:        String(get('asset')       || ''),
      category:     String(get('category')    || ''),
      action:       String(get('action')      || ''),
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

// ─── Blockchain balance fetcher ───────────────────────────────────────────────

function fetchAllBlockchainBalances() {
  var b = {};
  var errors = {};

  // ETH на Arbitrum (не mainnet — кошелёк использует Arbitrum)
  try {
    var ethRes = arbRpc('eth_getBalance', [EVM_ADDRESS, 'latest']);
    if (ethRes && ethRes.result) {
      b.ETH = r6(hexToInt(ethRes.result) / 1e18);
    } else {
      errors.ETH = 'no result';
    }
  } catch(e) { errors.ETH = e.message; }

  // USDT на Arbitrum (balanceOf через EVM RPC)
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

  // TON нативный баланс
  try {
    var tonRes = UrlFetchApp.fetch(
      'https://tonapi.io/v2/accounts/' + TON_ADDRESS,
      { muteHttpExceptions: true }
    );
    var tonData = JSON.parse(tonRes.getContentText());
    if (tonData && tonData.balance !== undefined) {
      b.TON = r4(Number(tonData.balance) / 1e9); // nanotons → TON
    } else {
      errors.TON = JSON.stringify(tonData).slice(0, 100);
    }
  } catch(e) { errors.TON = e.message; }

  // USDT на TON — через список всех jetton балансов, ищем Tether USD
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
      // Ищем Tether USD (не GRAM scam token)
      if (name === 'Tether USD' || sym === 'USD₮') {
        var dec = (jt.jetton || {}).decimals;
        dec = (dec !== undefined) ? Number(dec) : 6;
        b.USDT_TON = r2(Number(jt.balance) / Math.pow(10, dec));
        break;
      }
    }
    if (b.USDT_TON === undefined) errors.USDT_TON = 'not found in jettons list';
  } catch(e) { errors.USDT_TON = e.message; }

  // Суммарный USDT (Arbitrum + TON)
  b.USDT = r2((b.USDT_ARB || 0) + (b.USDT_TON || 0));

  // BTC через Blockstream (open API, без авторизации)
  try {
    var btcRes  = UrlFetchApp.fetch(
      'https://blockstream.info/api/address/' + BTC_ADDRESS,
      { muteHttpExceptions: true }
    );
    var btcData = JSON.parse(btcRes.getContentText());
    var funded  = (btcData.chain_stats || {}).funded_txo_sum || 0;
    var spent   = (btcData.chain_stats || {}).spent_txo_sum  || 0;
    b.BTC = r8((funded - spent) / 1e8); // satoshis → BTC
  } catch(e) { errors.BTC = e.message; }

  // SOL через публичный mainnet RPC
  try {
    var solRes = UrlFetchApp.fetch(SOL_RPC, {
      method:      'post',
      contentType: 'application/json',
      payload:     JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [SOL_ADDRESS] }),
      muteHttpExceptions: true
    });
    var solData = JSON.parse(solRes.getContentText());
    if (solData.result && solData.result.value !== undefined) {
      b.SOL = r6(solData.result.value / 1e9); // lamports → SOL
    } else {
      errors.SOL = 'no result';
    }
  } catch(e) { errors.SOL = e.message; }

  b._errors = errors;
  return b;
}

// Arbitrum RPC с fallback на резервный
function arbRpc(method, params) {
  var payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params });
  var opts     = { method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true };
  var resp     = UrlFetchApp.fetch(ARB_RPC, opts);
  var data     = JSON.parse(resp.getContentText());
  // Если основной вернул ошибку — пробуем резервный
  if (data.error || !data.result) {
    var resp2 = UrlFetchApp.fetch(ARB_RPC_BCK, opts);
    data      = JSON.parse(resp2.getContentText());
  }
  return data;
}

// ─── Live prices from main spreadsheet ───────────────────────────────────────

function getLivePrices() {
  var priceMap = {};
  try {
    var ss      = SpreadsheetApp.openById(MAIN_SS_ID);
    var sheet   = ss.getSheetByName('Портфель');
    if (!sheet) return priceMap;
    var data    = sheet.getDataRange().getValues();
    if (data.length < 2) return priceMap;
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var tCol    = headers.indexOf('ticker');
    var pCol    = headers.indexOf('currentPrice');
    if (tCol < 0 || pCol < 0) return priceMap;
    for (var i = 1; i < data.length; i++) {
      var ticker = String(data[i][tCol] || '').trim();
      var price  = toFloat(data[i][pCol]);
      if (ticker && price > 0) priceMap[ticker] = price;
    }
  } catch(e) {}
  return priceMap;
}

// ─── Health scoring ───────────────────────────────────────────────────────────

function computeHealth(reserveShare, cryptoShare, largestShare) {
  var reservePts = Math.min(100, reserveShare * 333);
  var concPts    = Math.max(0, 100 - Math.max(0, largestShare - 0.25) * 286);
  var expPts     = Math.max(0, 100 - Math.max(0, cryptoShare - 0.6) * 333);
  return Math.round(reservePts * 0.5 + concPts * 0.3 + expPts * 0.2);
}

function healthLabel(h) {
  if (h >= 80) return 'Хорошо';
  if (h >= 60) return 'Умеренно';
  if (h >= 40) return 'Внимание';
  return 'Критично';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ═════════════════════════════════════════════════════════════════════════════
// ОДНОРАЗОВАЯ НАСТРОЙКА — запустить один раз, потом можно удалить
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Создаёт вкладки «История» и «Транзакции» в таблице Полины.
 * Запустить: выбрать функцию setupWifeSheets → ▶ Run
 */
function setupWifeSheets() {
  var wifeSS = SpreadsheetApp.openById(WIFE_SS_ID);
  _createHistorySheet(wifeSS);
  _createTransactionsSheet(wifeSS);
  Logger.log('✅ Готово: История + Транзакции созданы');
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
  var old = ss.getSheetByName('История');
  if (old) ss.deleteSheet(old);
  var sh = ss.insertSheet('История');

  var eng = ['date','portfolioValue','invested','pnl','pnlPct','reserve','positionsCount','pointType','note','trigger','source','comment'];
  var rus = ['Дата','Стоимость портфеля','Вложено','PnL $','PnL %','Резерв','Кол-во позиций','Тип точки','Заметка','Триггер','Источник','Комментарий'];
  sh.getRange(1,1,1,eng.length).setValues([eng]);
  sh.getRange(2,1,1,rus.length).setValues([rus]);
  _styleHeader(sh, 1, eng.length);
  sh.getRange(2,1,1,rus.length).setBackground('#0a0a1a').setFontColor('#7a7aaa').setFontWeight('bold');
  sh.setFrozenRows(2);

  var widths = [180,150,120,100,80,100,120,100,200,100,100,250];
  widths.forEach(function(w,i){ sh.setColumnWidth(i+1,w); });
  Logger.log('История: создана');
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIX USDT IN SHEET
// Вызывается через ?action=fixUsdt или вручную.
// Фетчит реальные балансы USDT из блокчейна и пишет в главный лист:
//   quantity = blockchain balance, invested = то же самое (стейблы 1:1)
// После этого даже если server-side fetch упадёт — в листе будет fallback.
// ═══════════════════════════════════════════════════════════════════════════════
function fixUsdtInSheet(overrideArb, overrideTon) {
  // 1. Получаем реальные балансы (или используем переданные значения)
  var usdtArb = (overrideArb !== null && overrideArb !== undefined) ? overrideArb : _fetchUsdtArb();
  var usdtTon = (overrideTon !== null && overrideTon !== undefined) ? overrideTon : _fetchUsdtTon();
  var totalUsdt = r2(usdtArb + usdtTon);

  Logger.log('fixUsdtInSheet: ARB=' + usdtArb + ' TON=' + usdtTon + ' total=' + totalUsdt);

  // 2. Открываем главный лист
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

  // 3. Ищем USDT строку и обновляем
  for (var r = 1; r < data.length; r++) {
    var asset = String(data[r][iAsset] || '').trim().toUpperCase();
    if (asset === 'USDT') {
      sheet.getRange(r + 1, iQty + 1).setValue(totalUsdt);
      sheet.getRange(r + 1, iInvested + 1).setValue(totalUsdt);
      // avgEntry = 1 если не задан
      if (!toFloat(data[r][iEntry])) {
        sheet.getRange(r + 1, iEntry + 1).setValue(1);
      }
      updated.push({ row: r + 1, qty: totalUsdt, invested: totalUsdt });
      Logger.log('fixUsdtInSheet: строка ' + (r+1) + ' обновлена → qty=' + totalUsdt + ' invested=' + totalUsdt);
    }
  }

  if (updated.length === 0) {
    Logger.log('fixUsdtInSheet: строка USDT не найдена');
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

// Балансы USDT напрямую (для fixUsdtInSheet — вызывается с правами владельца)
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
    return Math.round(parseInt(hex, 16) / 1e4) / 100; // 6 decimals → 2dp
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
      var sym = (b.jetton && b.jetton.symbol || '').replace('₮','T');
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
  var old = ss.getSheetByName('Транзакции');
  if (old) ss.deleteSheet(old);
  var sh = ss.insertSheet('Транзакции');

  var eng = ['id','date','asset','category','action','quantity','price','amount','chain','hash','status','direction','walletId','counterparty','rawAsset','rawAmount','note','comment'];
  var rus = ['ID','Дата','Актив','Категория','Действие','Количество','Цена','Сумма $','Сеть','Hash','Статус','Направление','Кошелёк','Контрагент','Исходный актив','Исходная сумма','Заметка','Комментарий'];
  sh.getRange(1,1,1,eng.length).setValues([eng]);
  sh.getRange(2,1,1,rus.length).setValues([rus]);
  _styleHeader(sh, 1, eng.length);
  sh.getRange(2,1,1,rus.length).setBackground('#0a0a1a').setFontColor('#7a7aaa').setFontWeight('bold');
  sh.setFrozenRows(2);

  var widths = [80,180,80,120,80,100,100,100,80,280,100,100,120,120,100,100,200,250];
  widths.forEach(function(w,i){ sh.setColumnWidth(i+1,w); });
  Logger.log('Транзакции: создана');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCKCHAIN TRANSACTION SYNC
// Запускается автоматически по триггеру (hourly).
// Чтобы установить триггер — запусти setupSyncTrigger() вручную 1 раз.
// ═══════════════════════════════════════════════════════════════════════════════

// Установка hourly-триггера. Запустить вручную один раз.
function setupSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncTransactions') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncTransactions').timeBased().everyHours(1).create();
  Logger.log('Триггер syncTransactions установлен — каждый час');
}

// Главная функция синхронизации — пишет новые blockchain-транзакции в лист «Транзакции».
function syncTransactions() {
  var ss = SpreadsheetApp.openById(WIFE_SS_ID);
  var sheet = ss.getSheetByName('Транзакции');
  if (!sheet) { _createTransactionsSheet(ss); sheet = ss.getSheetByName('Транзакции'); }

  var existingIds = _getExistingTxIds(sheet);
  var rows = [];

  _fetchArbTokenTransfers(existingIds, rows);
  _fetchArbEthTransfers(existingIds, rows);
  _fetchTonTransactions(existingIds, rows);
  _fetchBtcTransactions(existingIds, rows);

  if (rows.length > 0) {
    var lastRow = Math.max(sheet.getLastRow(), 2);
    sheet.getRange(lastRow + 1, 1, rows.length, 18).setValues(rows);
    Logger.log('syncTransactions: добавлено ' + rows.length + ' новых транзакций');
  } else {
    Logger.log('syncTransactions: нет новых транзакций');
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
  return ['USDT','USDC','DAI','BUSD','USDE'].indexOf((symbol || '').toUpperCase().replace('₮','T')) >= 0;
}

function _bcAction(symbol, isIn) {
  // Стейблы: пришли → продали крипту → «Продажа»; ушли → купили крипту → «Покупка»
  // Крипта: пришла → «Покупка»; ушла → «Продажа»
  if (_isStable(symbol)) return isIn ? 'Продажа' : 'Покупка';
  return isIn ? 'Покупка' : 'Продажа';
}

function _fetchArbTokenTransfers(existingIds, rows) {
  try {
    var url = 'https://arbitrum.blockscout.com/api/v2/addresses/' + EVM_ADDRESS + '/token-transfers?filter=from%7Cto&limit=100';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var d = JSON.parse(resp.getContentText());
    var items = d.items || [];
    items.forEach(function(item) {
      var hash = item.tx_hash || '';
      var decimals = Number(item.token && item.token.decimals || 6);
      var rawQty = Number(item.total && item.total.value || 0);
      var quantity = rawQty / Math.pow(10, decimals);
      var symbol = (item.token && item.token.symbol) || 'UNKNOWN';
      if (quantity < 0.0001 || !hash) return;
      var id = 'bc:arb_tok:' + hash + ':' + rawQty;
      if (existingIds[id]) return;
      var isIn = (item.to && item.to.hash || '').toLowerCase() === EVM_ADDRESS.toLowerCase();
      var action = _bcAction(symbol, isIn);
      var amount = _isStable(symbol) ? quantity : 0;
      rows.push([id, _fmtDate(item.timestamp || new Date()), symbol, 'Крипта', action,
        quantity, 0, amount, 'ARB', hash, 'CONFIRMED', isIn ? 'IN' : 'OUT',
        EVM_ADDRESS, isIn ? (item.from && item.from.hash || '') : (item.to && item.to.hash || ''),
        symbol, quantity, 'blockchain', '']);
      existingIds[id] = true;
    });
  } catch(e) { Logger.log('_fetchArbTokenTransfers error: ' + e.message); }
}

function _fetchArbEthTransfers(existingIds, rows) {
  try {
    var url = 'https://arbitrum.blockscout.com/api/v2/addresses/' + EVM_ADDRESS + '/transactions?filter=to%7Cfrom&limit=50';
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
      rows.push([id, _fmtDate(item.timestamp || new Date()), 'ETH', 'Крипта', isIn ? 'Покупка' : 'Продажа',
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
          rows.push([rowId, _fmtDate(date), 'TON', 'Крипта', isIn ? 'Покупка' : 'Продажа',
            qty, 0, 0, 'TON', eventId, 'CONFIRMED', isIn ? 'IN' : 'OUT',
            TON_ADDRESS, isIn ? (tt.sender && tt.sender.address || '') : (tt.recipient && tt.recipient.address || ''),
            'TON', qty, 'blockchain', '']);
          existingIds[rowId] = true;
        } else if (act.type === 'JettonTransfer') {
          var jt = act.JettonTransfer || {};
          var decimals = Number(jt.jetton && jt.jetton.decimals || 6);
          var qty = Number(jt.amount || 0) / Math.pow(10, decimals);
          if (qty < 0.001) return;
          var symbol = (jt.jetton && jt.jetton.symbol || 'USDT').replace('₮', 'T');
          var isIn = (jt.sender && jt.sender.address || '').toLowerCase() !== TON_ADDRESS.toLowerCase();
          var action = _bcAction(symbol, isIn);
          var amount = _isStable(symbol) ? qty : 0;
          rows.push([rowId, _fmtDate(date), symbol, 'Крипта', action,
            qty, 0, amount, 'TON', eventId, 'CONFIRMED', isIn ? 'IN' : 'OUT',
            TON_ADDRESS, isIn ? (jt.sender && jt.sender.address || '') : (jt.recipient && jt.recipient.address || ''),
            symbol, qty, 'blockchain', '']);
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
      rows.push([id, _fmtDate(ts), 'BTC', 'Крипта', isIn ? 'Покупка' : 'Продажа',
        qty, 0, 0, 'BTC', hash, tx.status && tx.status.confirmed ? 'CONFIRMED' : 'PENDING', isIn ? 'IN' : 'OUT',
        BTC_ADDRESS, '', 'BTC', qty, 'blockchain', '']);
      existingIds[id] = true;
    });
  } catch(e) { Logger.log('_fetchBtcTransactions error: ' + e.message); }
}
