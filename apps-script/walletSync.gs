var IC_WALLET_SYNC_INTERVAL_MINUTES = 5;
var IC_WALLET_SYNC_TRIGGER_HANDLERS = [
  'syncInvestorCabinetWallets',
  'syncTonWalletImports',
  'syncTonWalletBalances',
  'syncArbitrumWalletBalances',
  'syncSolanaWalletBalances',
  'syncCosmosWalletBalances',
  'syncHyperliquidAccountState'
];

function syncInvestorCabinetWallets() {
  var errors = [];
  var warnings = [];

  IC_WALLET_runSyncStep_('TON wallet import', function() {
    syncTonWalletImports();
  }, errors, warnings);

  IC_WALLET_runSyncStep_('Arbitrum wallet balances', function() {
    setupArbitrumWalletImport();
    syncArbitrumWalletBalances();
  }, errors, warnings);

  IC_WALLET_runSyncStep_('Solana wallet balances', function() {
    setupSolanaWalletImport();
    syncSolanaWalletBalances();
  }, errors, warnings);

  IC_WALLET_runSyncStep_('Cosmos wallet balances', function() {
    setupCosmosWalletImport();
    syncCosmosWalletBalances();
  }, errors, warnings);

  IC_WALLET_runSyncStep_('Hyperliquid account state', function() {
    setupHyperliquidAccountImport();
    syncHyperliquidAccountState();
  }, errors, warnings);

  if (errors.length) {
    throw new Error('Investor Cabinet wallet sync finished with errors: ' + errors.join(' | '));
  }

  if (warnings.length) {
    Logger.log('Investor Cabinet wallet sync finished with warnings: ' + warnings.join(' | '));
  }

  return {
    success: true,
    warnings: warnings
  };
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

function IC_WALLET_runSyncStep_(label, syncFn, errors, warnings) {
  try {
    syncFn();
  } catch (error) {
    var message = label + ': ' + (error && error.message ? error.message : String(error));
    if (IC_WALLET_isSoftSyncError_(label, message)) {
      warnings.push(message);
      return;
    }
    errors.push(message);
  }
}

function IC_WALLET_isSoftSyncError_(label, message) {
  if (label !== 'Solana wallet balances') return false;

  return (
    message.indexOf('Solana RPC request failed') >= 0 &&
    (
      message.indexOf('HTTP 429') >= 0 ||
      message.indexOf('"code":429') >= 0 ||
      message.indexOf('Too many requests') >= 0
    )
  );
}
