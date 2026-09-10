var IC_WALLET_SYNC_INTERVAL_MINUTES = 5;
var IC_WALLET_TON_SYNC_INTERVAL_MINUTES = 15;
var IC_WALLET_TON_RATE_LIMIT_COOLDOWN_MINUTES = 30;
var IC_WALLET_TON_NEXT_SYNC_PROPERTY = 'IC_WALLET_TON_NEXT_SYNC_AT';
var IC_WALLET_SYNC_TRIGGER_HANDLERS = [
  'syncInvestorCabinetWallets',
  'syncTonWalletImports',
  'syncTonWalletBalances',
  'syncArbitrumWalletBalances',
  'syncBnbWalletBalances',
  'syncSolanaWalletBalances',
  'syncCosmosWalletBalances',
  'syncHyperliquidAccountState'
];

function syncInvestorCabinetWallets() {
  var errors = [];

  IC_WALLET_runSyncStep_('TON wallet import', function() {
    IC_WALLET_syncTonWithRateLimitGuard_();
  }, errors);

  IC_WALLET_runSyncStep_('Arbitrum wallet balances', function() {
    setupArbitrumWalletImport();
    syncArbitrumWalletBalances();
  }, errors);

  IC_WALLET_runSyncStep_('Solana wallet balances', function() {
    setupSolanaWalletImport();
    syncSolanaWalletBalances();
  }, errors);

  IC_WALLET_runSyncStep_('Cosmos wallet balances', function() {
    setupCosmosWalletImport();
    syncCosmosWalletBalances();
  }, errors);

  IC_WALLET_runSyncStep_('Hyperliquid account state', function() {
    setupHyperliquidAccountImport();
    syncHyperliquidAccountState();
  }, errors);

  IC_WALLET_runSyncStep_('BNB wallet balances', function() {
    setupBnbWalletImport();
    syncBnbWalletBalances();
  }, errors);

  if (errors.length) {
    throw new Error('Investor Cabinet wallet sync finished with errors: ' + errors.join(' | '));
  }
}

function IC_WALLET_syncTonWithRateLimitGuard_() {
  var props = PropertiesService.getScriptProperties();
  var nowMs = new Date().getTime();
  var nextSyncAt = Number(props.getProperty(IC_WALLET_TON_NEXT_SYNC_PROPERTY) || 0);

  if (nextSyncAt > nowMs) {
    Logger.log('TON wallet sync skipped until ' + new Date(nextSyncAt).toISOString());
    return { ok: true, skipped: 'cooldown' };
  }

  try {
    syncTonWalletImports();
    props.setProperty(
      IC_WALLET_TON_NEXT_SYNC_PROPERTY,
      String(nowMs + IC_WALLET_TON_SYNC_INTERVAL_MINUTES * 60 * 1000)
    );
    return { ok: true };
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    if (message.indexOf('TON API request failed: 429') < 0) throw error;

    props.setProperty(
      IC_WALLET_TON_NEXT_SYNC_PROPERTY,
      String(nowMs + IC_WALLET_TON_RATE_LIMIT_COOLDOWN_MINUTES * 60 * 1000)
    );
    Logger.log('TON wallet sync skipped: TonAPI anonymous rate limit; previous sheet values preserved');
    return { ok: true, skipped: 'tonapi_rate_limit' };
  }
}

function installInvestorCabinetWalletSyncTrigger() {
  removeInvestorCabinetWalletSyncTriggers();

  ScriptApp.newTrigger('syncInvestorCabinetWallets')
    .timeBased()
    .everyMinutes(IC_WALLET_SYNC_INTERVAL_MINUTES)
    .create();
}

function removeInvestorCabinetWalletSyncTriggers() {
  var triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    if (IC_WALLET_SYNC_TRIGGER_HANDLERS.indexOf(handler) >= 0) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function IC_WALLET_runSyncStep_(label, syncFn, errors) {
  try {
    syncFn();
  } catch (error) {
    errors.push(label + ': ' + (error && error.message ? error.message : String(error)));
  }
}
