// Native Bitcoin: confirmed history for an explicit set of owner-verified addresses.
// A receiving address cannot discover HD change addresses. Unknown outgoing
// outputs are imported for review, never treated as a sale or a zero balance.
var IC_BTC_WALLETS_SHEET = 'BTC_WALLETS';
var IC_BTC_BALANCES_SHEET = 'BTC_WALLET_BALANCES';
var IC_BTC_STATE_PROPERTY = 'IC_BTC_IMPORT_STATE';
var IC_BTC_PENDING_PROPERTY = 'IC_BTC_PENDING_APPLY';
var IC_BTC_SYNC_INTERVAL_MS = 15 * 60 * 1000;
var IC_BTC_API_URLS = ['https://blockstream.info/api', 'https://mempool.space/api'];

function setupBitcoinWalletImport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var wallets = ss.getSheetByName(IC_BTC_WALLETS_SHEET) || ss.insertSheet(IC_BTC_WALLETS_SHEET);
  // Sheet creation and header writes are separate Google operations. A timeout
  // can leave an empty tab; the next run must finish setup without duplicating it.
  if (!wallets.getLastRow()) {
    wallets.getRange(1, 1, 2, 6).setValues([
      ['Wallet ID', 'Receiving Address', 'Verified Change Addresses', 'Status', 'Last Sync At', 'Comment'],
      ['metamask-bitcoin-main', 'bc1q0u2ch352h0mjz9609z799pefufen42n9vhy28e',
        'bc1q39rzjxhdqyj8c5q599c6fh4g8ulv3g5l7w7z59', 'ACTIVE', '',
        'Адрес сдачи подтверждён операцией 28.09.2026 и балансом MetaMask; новые HD-адреса требуют проверки.']
    ]);
    wallets.setFrozenRows(1);
  }
  var balances = ss.getSheetByName(IC_BTC_BALANCES_SHEET) || ss.insertSheet(IC_BTC_BALANCES_SHEET);
  if (!balances.getLastRow()) {
    balances.getRange(1, 1, 1, 7).setValues([[
      'Wallet ID', 'Asset', 'Confirmed Quantity', 'Status', 'Last Sync At', 'Block Height', 'Comment'
    ]]);
    balances.setFrozenRows(1);
  }
}

function syncBitcoinWalletImports() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { skipped: 'locked' };
  try {
    setupBitcoinWalletImport();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var props = PropertiesService.getScriptProperties();
    // Finish an interrupted write before querying a newer blockchain snapshot.
    var pending = props.getProperty(IC_BTC_PENDING_PROPERTY);
    if (pending) IC_BTC_commitPlan_(ss, props, JSON.parse(pending));
    var state = JSON.parse(props.getProperty(IC_BTC_STATE_PROPERTY) || 'null');
    if (state && Date.now() - state.syncedAt < IC_BTC_SYNC_INTERVAL_MS) return { skipped: 'cooldown' };
    var config = IC_BTC_readConfig_(ss.getSheetByName(IC_BTC_WALLETS_SHEET));
    if (!config) return { skipped: 'inactive' };
    var calculations = ss.getSheetByName('Расчеты');
    var importSheet = ss.getSheetByName('Транзакции_IMPORT');
    if (!calculations || !importSheet) throw new Error('Missing BTC calculation/import sheet');
    var assetRow = IC_LEDGER_findAssetRow_(calculations, 'BTC');
    if (!assetRow) throw new Error('Missing BTC asset in Расчеты');
    var before = calculations.getRange(assetRow, 3, 1, 2).getValues()[0];
    var beforeSats = IC_BTC_quantityToSats_(before[0]);
    var avg = Number(before[1]);
    if (!isFinite(avg) || avg < 0) throw new Error('Invalid BTC cost basis');
    var snapshot = IC_BTC_readSnapshot_(config.addresses, state);
    var plan = IC_BTC_buildPlan_(config, state, snapshot, beforeSats, avg);
    plan.assetRow = assetRow;
    var encoded = JSON.stringify(plan);
    if (Utilities.newBlob(encoded).getBytes().length > 8000) throw new Error('BTC import batch too large; previous quantities preserved');
    props.setProperty(IC_BTC_PENDING_PROPERTY, encoded);
    IC_BTC_commitPlan_(ss, props, plan);
    return { status: plan.status, quantity: plan.nextSats / 1e8, transactions: plan.rows.length };
  } catch (error) {
    // An API error is never a valid zero. Keep the last successful quantity.
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(IC_BTC_BALANCES_SHEET);
      if (sheet && sheet.getLastRow() >= 2) {
        sheet.getRange(2, 4).setValue('ERROR');
        sheet.getRange(2, 7).setValue(String(error.message || error));
      }
    } catch (notificationError) { Logger.log('BTC sync error status write failed: ' + notificationError); }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function IC_BTC_readConfig_(sheet) {
  if (sheet.getLastRow() < 2) return null;
  var active = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues().filter(function(row) {
    return String(row[3]).trim().toUpperCase() === 'ACTIVE';
  });
  // Main has one BTC position. Multiple unrelated wallets need an explicit allocation.
  if (!active.length) return null;
  if (active.length !== 1) throw new Error('BTC import supports one active main wallet');
  var row = active[0];
  var addresses = [String(row[1]).trim()].concat(String(row[2] || '').split(/[\s,;]+/))
    .filter(function(address) { return address !== ''; });
  addresses = addresses.filter(function(address, index) { return addresses.indexOf(address) === index; });
  if (!row[0] || !addresses.length || addresses.some(function(address) {
    return !/^(bc1[ac-hj-np-z02-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
  })) throw new Error('Invalid BTC wallet configuration');
  return { walletId: String(row[0]), addresses: addresses.sort() };
}

function IC_BTC_readSnapshot_(addresses, state) {
  var failures = [];
  for (var apiIndex = 0; apiIndex < IC_BTC_API_URLS.length; apiIndex++) {
    var base = IC_BTC_API_URLS[apiIndex];
    try {
      var tipHash = IC_BTC_fetch_(base, '/blocks/tip/hash', false);
      if (!/^[a-f0-9]{64}$/.test(tipHash)) throw new Error('Invalid BTC tip hash');
      var height = IC_BTC_sats_(Number(IC_BTC_fetch_(base, '/blocks/tip/height', false)));
      if (IC_BTC_fetch_(base, '/block-height/' + height, false) !== tipHash) throw new Error('BTC tip changed');
      if (state && (height < state.height ||
          IC_BTC_fetch_(base, '/block-height/' + state.height, false) !== state.blockHash)) {
        throw new Error('BTC reorg/checkpoint mismatch; manual reconciliation required');
      }
      var total = 0;
      var mempoolCount = 0;
      var byHash = {};
      addresses.forEach(function(address) {
        var data = IC_BTC_fetch_(base, '/address/' + address, true);
        if (data.address !== address || !data.chain_stats || !data.mempool_stats) throw new Error('Invalid BTC address response');
        var balance = IC_BTC_sats_(data.chain_stats.funded_txo_sum) - IC_BTC_sats_(data.chain_stats.spent_txo_sum);
        if (balance < 0) throw new Error('Invalid BTC confirmed balance');
        total = IC_BTC_sats_(total + balance);
        mempoolCount += IC_BTC_sats_(data.mempool_stats.tx_count);
        if (!state) return; // Historical quantities were reconciled before the baseline.
        var cursor = '';
        var exhausted = false;
        for (var page = 0; page < 20; page++) {
          var txs = IC_BTC_fetch_(base, '/address/' + address + '/txs/chain' + (cursor ? '/' + cursor : ''), true);
          if (!Array.isArray(txs) || txs.length > 25) throw new Error('Invalid BTC history response');
          txs.forEach(function(tx) {
            IC_BTC_validateTx_(tx);
            if (tx.status.block_height > height) throw new Error('BTC transaction beyond snapshot');
            if (tx.status.block_height > state.height) byHash[tx.txid] = tx;
          });
          if (txs.length < 25 || txs.some(function(tx) { return tx.status.block_height <= state.height; })) {
            exhausted = true;
            break;
          }
          var nextCursor = txs[txs.length - 1].txid;
          if (cursor === nextCursor) throw new Error('BTC history cursor did not advance');
          cursor = nextCursor;
        }
        if (!exhausted) throw new Error('BTC history exceeds safe pagination limit');
      });
      if (IC_BTC_fetch_(base, '/blocks/tip/hash', false) !== tipHash) throw new Error('BTC tip changed during sync');
      var txs = Object.keys(byHash).map(function(hash) { return byHash[hash]; });
      return { sats: total, mempoolCount: mempoolCount, height: height, blockHash: tipHash, txs: IC_BTC_orderTransactions_(txs) };
    } catch (error) { failures.push(base + ': ' + (error.message || error)); }
  }
  throw new Error('BTC API unavailable/inconsistent: ' + failures.join(' | '));
}

function IC_BTC_fetch_(base, path, json) {
  var response = UrlFetchApp.fetch(base + path, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('HTTP ' + response.getResponseCode());
  var body = response.getContentText().trim();
  return json ? JSON.parse(body) : body;
}

function IC_BTC_sats_(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid BTC satoshi value');
  return value;
}

function IC_BTC_quantityToSats_(quantity) {
  if (quantity === '' || typeof quantity !== 'number' || !isFinite(quantity) || quantity < 0 ||
      Math.abs(quantity * 1e8 - Math.round(quantity * 1e8)) > 0.00001) throw new Error('Invalid BTC quantity');
  return IC_BTC_sats_(Math.round(quantity * 1e8));
}

function IC_BTC_validateTx_(tx) {
  if (!tx || !/^[a-f0-9]{64}$/.test(tx.txid) || !tx.status || tx.status.confirmed !== true ||
      !/^[a-f0-9]{64}$/.test(tx.status.block_hash) || !Array.isArray(tx.vin) || !tx.vin.length ||
      !Array.isArray(tx.vout) || !tx.vout.length) throw new Error('Invalid confirmed BTC transaction');
  IC_BTC_sats_(tx.status.block_height);
  IC_BTC_sats_(tx.status.block_time);
  IC_BTC_sats_(tx.fee);
  tx.vout.forEach(function(output) { IC_BTC_sats_(output.value); });
  var inputs = 0;
  tx.vin.forEach(function(input) {
    if (input.is_coinbase) return;
    if (!input.prevout) throw new Error('Missing BTC prevout');
    inputs += IC_BTC_sats_(input.prevout.value);
  });
  var outputs = tx.vout.reduce(function(sum, output) { return sum + output.value; }, 0);
  if (!tx.vin[0].is_coinbase && inputs - outputs !== tx.fee) throw new Error('BTC fee/conservation mismatch');
}

function IC_BTC_orderTransactions_(txs) {
  var byHash = {};
  var visited = {};
  var visiting = {};
  var ordered = [];
  txs.forEach(function(tx) { byHash[tx.txid] = tx; });
  function visit(tx) {
    if (visited[tx.txid]) return;
    if (visiting[tx.txid]) throw new Error('Cyclic BTC transaction history');
    visiting[tx.txid] = true;
    tx.vin.forEach(function(input) {
      if (byHash[input.txid]) visit(byHash[input.txid]);
    });
    visited[tx.txid] = true;
    ordered.push(tx);
  }
  txs.slice().sort(function(a, b) {
    return a.status.block_height - b.status.block_height || a.txid.localeCompare(b.txid);
  }).forEach(visit);
  return ordered;
}

function IC_BTC_buildPlan_(config, state, snapshot, beforeSats, avg) {
  var now = Date.now();
  var rows = [];
  var nextSats = beforeSats;
  var nextAvg = avg;
  var review = false;
  // Additions are explicit owner verification; silently removing tracked addresses is unsafe.
  if (state && (state.addresses.some(function(address) { return config.addresses.indexOf(address) < 0; }) ||
      state.sats !== beforeSats)) review = true;
  snapshot.txs.forEach(function(tx) {
    IC_BTC_validateTx_(tx);
    var ownedInput = 0;
    var foreignInput = false;
    tx.vin.forEach(function(input) {
      if (!input.is_coinbase && config.addresses.indexOf(input.prevout.scriptpubkey_address) >= 0) ownedInput += input.prevout.value;
      else foreignInput = true;
    });
    var ownedOutput = tx.vout.reduce(function(sum, output) {
      return sum + (config.addresses.indexOf(output.scriptpubkey_address) >= 0 ? output.value : 0);
    }, 0);
    var unknownOutput = tx.vout.some(function(output) { return config.addresses.indexOf(output.scriptpubkey_address) < 0; });
    if (!ownedInput && !ownedOutput) throw new Error('BTC history unrelated to configured addresses');
    var ambiguous = ownedInput > 0 && (foreignInput || unknownOutput);
    if (ambiguous) review = true;
    var delta = ownedOutput - ownedInput;
    var action = ownedInput ? (ambiguous ? 'Перевод' : 'Комиссия') : 'Перевод';
    if (!ambiguous && !review) {
      var previousBasis = nextSats / 1e8 * nextAvg;
      nextSats += delta;
      if (nextSats < 0) throw new Error('BTC delta exceeds tracked position');
      nextAvg = nextSats ? (delta > 0 ? previousBasis / (nextSats / 1e8) : nextAvg) : 0;
    }
    var date = new Date(tx.status.block_time * 1000);
    var tz = Session.getScriptTimeZone();
    var detail = tx.vout.map(function(output) {
      return (output.scriptpubkey_address || output.scriptpubkey) + '=' + output.value + ' sat';
    }).join('; ');
    rows.push([
      'BTC_TX:BITCOIN:' + tx.txid, 'PENDING', Utilities.formatDate(date, tz, 'dd.MM.yyyy'),
      'BTC', 'Крипта', action, Math.abs(delta) / 1e8, '', '',
      ambiguous ? 'BTC: требуется проверка адреса сдачи / назначения; баланс сохранён' : 'BTC confirmed transaction; цена приобретения неизвестна',
      config.walletId, 'BITCOIN', tx.txid, '', ownedInput ? 'OUT' : 'IN', '', 'BTC',
      'net=' + delta + ' sat; fee=' + tx.fee + ' sat',
      'BTC_REVIEW at ' + Utilities.formatDate(date, tz, "yyyy-MM-dd'T'HH:mm:ss") +
        '. feeBTC=' + tx.fee / 1e8 + '; blockHeight=' + tx.status.block_height + '; outputs: ' + detail
    ]);
  });
  if (nextSats !== snapshot.sats) review = true;
  if (review) {
    nextSats = beforeSats;
    nextAvg = avg;
  } else {
    rows.forEach(function(row) {
      row[18] = row[18].replace('BTC_REVIEW at ', 'BALANCE_APPLIED audit row at ') +
        '. BTC transfer/fee: quantity applied; no USD purchase/sale or PnL inferred.';
    });
  }
  var status = review ? 'NEEDS_ADDRESS_REVIEW' : (snapshot.mempoolCount ? 'MEMPOOL_PENDING' : 'READY');
  return {
    beforeSats: beforeSats, beforeAvg: avg, nextSats: nextSats, nextAvg: nextAvg, rows: rows,
    walletId: config.walletId, observedSats: snapshot.sats, status: status, syncedAt: now,
    nextState: review ? (state ? Object.assign({}, state, { syncedAt: now }) : null) : { height: snapshot.height, blockHash: snapshot.blockHash,
      sats: nextSats, addresses: config.addresses, syncedAt: now },
    height: snapshot.height,
    comment: review ? 'Неполный набор адресов или изменённый учёт. Проверить BTC-транзакции и добавить подтверждённую сдачу; Расчеты сохранены.' :
      'Подтверждённый баланс заданных адресов. Mempool не применяется. Новые HD-адреса автоматически не выводятся.'
  };
}

function IC_BTC_commitPlan_(ss, props, plan) {
  var calculations = ss.getSheetByName('Расчеты');
  var position = calculations.getRange(plan.assetRow, 3, 1, 2).getValues()[0];
  var sats = IC_BTC_quantityToSats_(position[0]);
  var avg = Number(position[1]);
  var isBefore = sats === plan.beforeSats && Math.abs(avg - plan.beforeAvg) < 1e-8;
  var isAfter = sats === plan.nextSats && Math.abs(avg - plan.nextAvg) < 1e-8;
  if (!isBefore && !isAfter) throw new Error('BTC interrupted import conflicts with manually changed position');
  var sheet = ss.getSheetByName('Транзакции_IMPORT');
  if (plan.rows.length) {
    // Preserve current dropdown choices and extend only the existing sheet range.
    var rule = sheet.getRange(2, 12).getDataValidation();
    if (rule && String(rule.getCriteriaType()) === 'VALUE_IN_LIST') {
      var args = rule.getCriteriaValues();
      var choices = args[0].map(String);
      if (choices.indexOf('BITCOIN') < 0) {
        choices.push('BITCOIN');
        sheet.getRange(2, 12, sheet.getMaxRows() - 1, 1).setDataValidation(rule.copy()
          .requireValueInList(choices, args.length > 1 ? args[1] !== false : true).build());
      }
    }
    var existing = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 19).getValues() : [];
    plan.rows.forEach(function(row) {
      var match = -1;
      existing.some(function(old, index) {
        if (String(old[0]) === row[0] || String(old[12]) === row[12]) { match = index; return true; }
        return false;
      });
      if (match < 0) {
        IC_LEDGER_appendRows_(sheet, [row]);
        existing.push(row);
      } else if (String(existing[match][0]) === row[0] && String(existing[match][18]).indexOf('BTC_REVIEW at ') === 0 &&
          String(row[18]).indexOf('BALANCE_APPLIED') === 0) {
        sheet.getRange(match + 2, 1, 1, 19).setValues([row]);
      }
    });
  }
  // One range write; E's existing formula and the API contract remain untouched.
  if (!isAfter) calculations.getRange(plan.assetRow, 3, 1, 2).setValues([[plan.nextSats / 1e8, plan.nextAvg]]);
  ss.getSheetByName(IC_BTC_BALANCES_SHEET).getRange(2, 1, 1, 7).setValues([[
    plan.walletId, 'BTC', plan.observedSats / 1e8, plan.status, new Date(plan.syncedAt), plan.height, plan.comment
  ]]);
  ss.getSheetByName(IC_BTC_WALLETS_SHEET).getRange(2, 5).setValue(new Date(plan.syncedAt));
  SpreadsheetApp.flush();
  if (plan.nextState) props.setProperty(IC_BTC_STATE_PROPERTY, JSON.stringify(plan.nextState));
  props.deleteProperty(IC_BTC_PENDING_PROPERTY);
}
