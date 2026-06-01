var IC_WALLET_SYNC_INTERVAL_MINUTES = 5;
var IC_WALLET_SYNC_TRIGGER_HANDLERS = [
  'syncInvestorCabinetWallets',
  'syncTonWalletImports',
  'syncTonWalletBalances',
  'syncArbitrumWalletBalances',
  'syncSolanaWalletBalances',
  'syncCosmosWalletBalances'
];

function syncInvestorCabinetWallets() {
  var errors = [];

  IC_WALLET_runSyncStep_('TON wallet import', function() {
    syncTonWalletImports();
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

  if (errors.length) {
    throw new Error('Investor Cabinet wallet sync finished with errors: ' + errors.join(' | '));
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
