var IC_WIFE_MORNING_TELEGRAM_HANDLER = 'sendWifeMorningTelegram';
var IC_WIFE_MORNING_TELEGRAM_CHAT_KEY = 'TELEGRAM_WIFE_CHAT_ID';
var IC_WIFE_MORNING_TELEGRAM_TIMEZONE = 'Europe/Moscow';
var IC_WIFE_MORNING_TELEGRAM_URL = 'https://investor-cabinet.vercel.app/api/investor-wife';

function setupWifeMorningTelegram() {
  var chat = IC_WIFE_MORNING_resolveChat_();
  PropertiesService.getScriptProperties().setProperty(IC_WIFE_MORNING_TELEGRAM_CHAT_KEY, chat.id);

  removeWifeMorningTelegramTrigger();
  ScriptApp.newTrigger(IC_WIFE_MORNING_TELEGRAM_HANDLER)
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .nearMinute(30)
    .create();

  var testResult = IC_WIFE_MORNING_send_(true);
  return {
    ok: true,
    testSent: testResult.sent,
    chat: IC_WIFE_MORNING_chatLabel_(chat),
    schedule: '08:30 Europe/Moscow',
    triggerCount: IC_WIFE_MORNING_triggerCount_()
  };
}

function testWifeMorningTelegram() {
  var chat = IC_WIFE_MORNING_resolveChat_();
  PropertiesService.getScriptProperties().setProperty(IC_WIFE_MORNING_TELEGRAM_CHAT_KEY, chat.id);
  var result = IC_WIFE_MORNING_send_(true);

  return {
    ok: true,
    sent: result.sent,
    chat: IC_WIFE_MORNING_chatLabel_(chat),
    scheduleInstalled: IC_WIFE_MORNING_triggerCount_() > 0
  };
}

function sendWifeMorningTelegram() {
  return IC_WIFE_MORNING_send_(false);
}

function getWifeMorningTelegramStatus() {
  return {
    ok: true,
    schedule: '08:30 Europe/Moscow',
    triggerCount: IC_WIFE_MORNING_triggerCount_(),
    chatConfigured: Boolean(String(PropertiesService.getScriptProperties().getProperty(IC_WIFE_MORNING_TELEGRAM_CHAT_KEY) || '').trim())
  };
}

function removeWifeMorningTelegramTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === IC_WIFE_MORNING_TELEGRAM_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });

  return { ok: true, removed: removed, remaining: IC_WIFE_MORNING_triggerCount_() };
}

function IC_WIFE_MORNING_send_(isTest) {
  var props = PropertiesService.getScriptProperties();
  var token = String(props.getProperty('TELEGRAM_BOT_TOKEN') || '').trim();
  var chatId = String(props.getProperty(IC_WIFE_MORNING_TELEGRAM_CHAT_KEY) || '').trim();
  if (!token) throw new Error('Telegram bot is not configured');
  if (!chatId) throw new Error('Telegram chat for Polina is not configured');

  var payload = IC_WIFE_MORNING_fetchPortfolio_();
  var text = IC_WIFE_MORNING_buildMessage_(payload, new Date(), isTest === true);
  IC_SIGNAL_ALERT_sendTelegram_(token, chatId, text);

  return {
    ok: true,
    sent: true,
    portfolioValue: IC_WIFE_MORNING_number_(payload.overview && payload.overview.portfolioValue),
    sentAt: new Date().toISOString()
  };
}

function IC_WIFE_MORNING_fetchPortfolio_() {
  var response = UrlFetchApp.fetch(IC_WIFE_MORNING_TELEGRAM_URL, {
    method: 'get',
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('Wife cabinet API failed: ' + status + ' ' + body.slice(0, 240));
  }

  var payload = JSON.parse(body);
  if (!payload || !payload.success || !payload.overview) {
    throw new Error('Wife cabinet API returned invalid payload');
  }

  return payload;
}

function IC_WIFE_MORNING_buildMessage_(payload, now, isTest) {
  var overview = payload.overview || {};
  var risk = payload.risk || {};
  var portfolioValue = IC_WIFE_MORNING_number_(overview.portfolioValue);
  var invested = IC_WIFE_MORNING_number_(overview.invested);
  var pnl = IC_WIFE_MORNING_number_(overview.pnl);
  var pnlPct = IC_WIFE_MORNING_number_(overview.pnlPct) * 100;
  var reserve = IC_WIFE_MORNING_number_(overview.reserve);
  var previous = IC_WIFE_MORNING_previousSnapshot_(payload.history, now);
  var dailyPnl = previous ? portfolioValue - previous.portfolioValue : null;
  var dailyPnlPct = previous && previous.portfolioValue > 0
    ? dailyPnl / previous.portfolioValue * 100
    : null;
  var positions = IC_WIFE_MORNING_positions_(payload.portfolio);
  var health = IC_WIFE_MORNING_computeHealth_(payload, positions);
  var fearGreedSource = payload.fearGreedStrategy || {};
  var fearGreedIndex = fearGreedSource.currentIndex === null || fearGreedSource.currentIndex === undefined
    ? null
    : Math.round(IC_WIFE_MORNING_number_(fearGreedSource.currentIndex));
  var recommendations = IC_WIFE_MORNING_recommendations_(positions, portfolioValue, reserve, risk);
  var lines = [];

  lines.push(
    'Доброе утро, Полина!',
    '',
    'Сегодня ваш портфель оценивается в ' + IC_WIFE_MORNING_money_(portfolioValue) + '.',
    'Вложено: ' + IC_WIFE_MORNING_money_(invested),
    'Общий результат: ' + IC_WIFE_MORNING_signedMoney_(pnl) + ' (' + IC_WIFE_MORNING_signedPct_(pnlPct) + ').',
    dailyPnl === null
      ? 'За 24 часа: ждём снимок прошлого дня.'
      : 'За 24 часа: ' + IC_WIFE_MORNING_signedMoney_(dailyPnl) + ' (' + IC_WIFE_MORNING_signedPct_(dailyPnlPct) + ').',
    '',
    'Позиции:'
  );
  positions.slice(0, 6).forEach(function(position) {
    var marker = position.pnl < 0 ? '❤️‍🩹' : '🍀';
    lines.push(position.asset + ': ' + IC_WIFE_MORNING_signedPct_(position.pnlPct) + ' / ' + IC_WIFE_MORNING_signedMoney_(position.pnl) + ' ' + marker);
  });
  lines.push(
    '',
    'Здоровье портфеля: ' + health + '/100.',
    IC_WIFE_MORNING_healthSummary_(health),
    '',
    'Настроение рынка:',
    fearGreedIndex === null
      ? 'Индекс страха и жадности: данные пока не получены.'
      : 'Индекс страха и жадности: ' + fearGreedIndex + '/100 — ' + IC_WIFE_MORNING_fearGreedMood_(fearGreedIndex) + '.',
    '',
    'Рекомендации:'
  );
  recommendations.forEach(function(recommendation) {
    lines.push('• ' + recommendation);
  });
  lines.push('', 'Хорошего дня!', 'By Mushii 💋');

  return lines.join('\n');
}

function IC_WIFE_MORNING_positions_(portfolio) {
  if (!Array.isArray(portfolio)) return [];
  return portfolio.map(function(position) {
    var asset = String(position.asset || position.ticker || 'Актив').trim();
    var category = String(position.category || '').trim();
    var currentValue = IC_WIFE_MORNING_number_(position.currentValue || position.value);
    return {
      asset: asset,
      category: category,
      currentValue: currentValue,
      invested: IC_WIFE_MORNING_number_(position.invested),
      pnl: IC_WIFE_MORNING_number_(position.pnl),
      pnlPct: IC_WIFE_MORNING_number_(position.pnlPct)
    };
  }).filter(function(position) {
    return position.currentValue >= 1 && !IC_WIFE_MORNING_isCash_(position);
  }).sort(function(a, b) {
    return b.currentValue - a.currentValue;
  });
}

function IC_WIFE_MORNING_isCash_(position) {
  var category = String(position.category || '').toLowerCase();
  var asset = String(position.asset || '').toUpperCase();
  return category.indexOf('свобод') >= 0
    || category.indexOf('кэш') >= 0
    || category.indexOf('cash') >= 0
    || ['USDC', 'USDT', 'USD'].indexOf(asset) >= 0;
}

function IC_WIFE_MORNING_isCrypto_(position) {
  return String(position.category || '').toLowerCase().indexOf('крип') >= 0;
}

function IC_WIFE_MORNING_recommendations_(positions, portfolioValue, reserve, risk) {
  var recommendations = [];
  var reserveShare = IC_WIFE_MORNING_number_(risk.reserveShare);
  if (reserveShare > 1) reserveShare /= 100;
  if (reserveShare <= 0 && portfolioValue > 0) reserveShare = reserve / portfolioValue;
  var crypto = positions.filter(IC_WIFE_MORNING_isCrypto_);
  var cryptoValue = crypto.reduce(function(sum, position) { return sum + position.currentValue; }, 0);
  var cryptoShare = portfolioValue > 0 ? cryptoValue / portfolioValue : 0;
  var eth = crypto.filter(function(position) { return String(position.asset).toUpperCase().split(/\s+/)[0] === 'ETH'; })[0];
  var ethShare = eth && cryptoValue > 0 ? eth.currentValue / cryptoValue : 0;

  if (reserveShare < 0.1) {
    recommendations.push('Восстановить резерв минимум до 10%: сейчас ' + IC_WIFE_MORNING_pctPlain_(reserveShare * 100, 2) + '.');
  }
  if (cryptoShare > 0.75) {
    recommendations.push('Не увеличивать долю крипты: сейчас ' + IC_WIFE_MORNING_pctPlain_(cryptoShare * 100, 2) + ' при лимите 75%.');
  }
  if (ethShare > 0.75) {
    recommendations.push('Обратить внимание на концентрацию ETH: ' + IC_WIFE_MORNING_pctPlain_(ethShare * 100, 1) + ' крипто-блока при лимите 75%.');
  }
  if (!recommendations.length) {
    recommendations.push('Сохранять текущий план и не увеличивать риск без отдельного решения.');
  }
  return recommendations.slice(0, 3);
}

function IC_WIFE_MORNING_fearGreedMood_(index) {
  if (index < 25) return 'крайний страх';
  if (index < 45) return 'на рынке преобладает страх';
  if (index <= 55) return 'нейтральное настроение';
  if (index <= 75) return 'на рынке преобладает жадность';
  return 'крайняя жадность';
}

function IC_WIFE_MORNING_healthSummary_(health) {
  if (health < 40) return 'Портфель требует внимания к резерву и концентрации.';
  if (health < 70) return 'Портфелю нужен контроль риска и постепенное восстановление резерва.';
  return 'Портфель находится в устойчивом состоянии.';
}

function IC_WIFE_MORNING_computeHealth_(payload, positions) {
  var overview = payload.overview || {};
  var portfolioValue = IC_WIFE_MORNING_number_(overview.portfolioValue);
  var invested = IC_WIFE_MORNING_number_(overview.invested);
  var reserve = IC_WIFE_MORNING_number_(overview.reserve);
  var cryptoValue = IC_WIFE_MORNING_categoryValue_(positions, 'Крипта');
  var metalsValue = IC_WIFE_MORNING_categoryValue_(positions, 'Металлы');
  var stocksValue = IC_WIFE_MORNING_categoryValue_(positions, 'Акции');
  var futures = positions.filter(function(position) { return position.category === 'Фьючерсы'; });
  var futuresInvested = futures.reduce(function(sum, position) { return sum + position.invested; }, 0);
  var reserveShare = invested > 0 ? reserve / invested : 0;
  var reservePortfolioShare = portfolioValue > 0 ? reserve / portfolioValue : 0;
  var cryptoShare = portfolioValue > 0 ? cryptoValue / portfolioValue : 0;
  var metalsShare = portfolioValue > 0 ? metalsValue / portfolioValue : 0;
  var stocksShare = portfolioValue > 0 ? stocksValue / portfolioValue : 0;
  var futuresShare = invested > 0 ? futuresInvested / invested : 0;
  var reserveScore = IC_WIFE_MORNING_reserveScore_(reserveShare);
  var shockLoss = Math.min(1, cryptoShare * 0.6 + metalsShare * 0.5 + stocksShare * 0.3 + futuresShare);
  var lossScore = IC_WIFE_MORNING_score_((0.6 - shockLoss) / (0.6 - 0.25));
  var spotDeployable = Math.max(0, reserve - portfolioValue * 0.3);
  var buyPowerScore = IC_WIFE_MORNING_score_((portfolioValue > 0 ? spotDeployable / portfolioValue : 0) / 0.15);
  var survivalScore = Math.round(lossScore * 0.45 + buyPowerScore * 0.35 + 60 * 0.2);
  var futuresUtilization = invested > 0 ? futuresInvested / (invested * 0.1) : 0;
  var riskControlScore = Math.max(0, Math.round(100 - Math.max(0, futuresUtilization - 1) * 50 - futures.length * 5));
  var concentrationScore = IC_WIFE_MORNING_concentrationScore_(positions, portfolioValue, cryptoValue);
  var diversificationScore = IC_WIFE_MORNING_diversificationScore_([cryptoShare, metalsShare, stocksShare]);
  var disciplineScore = 61;

  return Math.round(
    reserveScore * 0.2
      + survivalScore * 0.17
      + riskControlScore * 0.15
      + concentrationScore * 0.18
      + diversificationScore * 0.15
      + disciplineScore * 0.15
  );
}

function IC_WIFE_MORNING_categoryValue_(positions, category) {
  return positions.filter(function(position) {
    return position.category === category;
  }).reduce(function(sum, position) {
    return sum + position.currentValue;
  }, 0);
}

function IC_WIFE_MORNING_score_(value) {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function IC_WIFE_MORNING_reserveScore_(share) {
  if (share <= 0) return 0;
  if (share < 0.1) return Math.round(share / 0.1 * 30);
  if (share < 0.3) return Math.round(30 + (share - 0.1) / 0.2 * 70);
  if (share <= 0.6) return 100;
  return IC_WIFE_MORNING_score_((1 - share) / 0.4);
}

function IC_WIFE_MORNING_cryptoLimit_(asset) {
  var symbol = String(asset || '').toUpperCase().split(/\s+/)[0];
  var limits = {
    ETH: 0.35,
    WETH: 0.35,
    ETHEREUM: 0.35,
    BTC: 0.2,
    WBTC: 0.2,
    BITCOIN: 0.2,
    SOL: 0.1,
    SOLANA: 0.1,
    TON: 0.1,
    GRAM: 0.1,
    BNB: 0.1,
    WBNB: 0.1
  };
  return limits[symbol] || 0.05;
}

function IC_WIFE_MORNING_concentrationScore_(positions, portfolioValue, cryptoValue) {
  var largestPortfolioShare = 0;
  var disciplinePenalty = 0;
  positions.forEach(function(position) {
    if (position.currentValue <= 0) return;
    var isCrypto = position.category === 'Крипта';
    var base = isCrypto ? cryptoValue : portfolioValue;
    if (base <= 0) return;
    var share = position.currentValue / base;
    var portfolioShare = portfolioValue > 0 ? position.currentValue / portfolioValue : 0;
    var limit = isCrypto
      ? IC_WIFE_MORNING_cryptoLimit_(position.asset)
      : (position.category === 'Акции' || position.category === 'Металлы')
        ? 0.05
        : position.category === 'Фьючерсы'
          ? 0.1
          : 0.35;
    if (portfolioShare > largestPortfolioShare) largestPortfolioShare = portfolioShare;
    if (share > limit) {
      disciplinePenalty += Math.min(share / limit - 1, 2) * portfolioShare * 120;
    }
  });
  var systemicScore = (0.5 - largestPortfolioShare) / 0.3;
  return IC_WIFE_MORNING_score_(systemicScore - Math.min(disciplinePenalty, 45) / 100);
}

function IC_WIFE_MORNING_diversificationScore_(shares) {
  var total = shares.reduce(function(sum, value) { return sum + value; }, 0);
  if (shares.length < 2 || total <= 0) return 0;
  var hhi = shares.reduce(function(sum, value) {
    var weight = value / total;
    return sum + weight * weight;
  }, 0);
  return IC_WIFE_MORNING_score_((1 - hhi) / 0.5);
}

function IC_WIFE_MORNING_previousSnapshot_(history, now) {
  if (!Array.isArray(history)) return null;
  var yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  var targetKey = Utilities.formatDate(yesterday, IC_WIFE_MORNING_TELEGRAM_TIMEZONE, 'yyyy-MM-dd');
  var found = null;

  history.forEach(function(point) {
    var date = new Date(point && point.date);
    var portfolioValue = IC_WIFE_MORNING_number_(point && point.portfolioValue);
    if (isNaN(date.getTime()) || portfolioValue <= 0) return;
    if (Utilities.formatDate(date, IC_WIFE_MORNING_TELEGRAM_TIMEZONE, 'yyyy-MM-dd') !== targetKey) return;
    if (!found || date.getTime() > found.date.getTime()) {
      found = { date: date, portfolioValue: portfolioValue };
    }
  });

  return found;
}

function IC_WIFE_MORNING_resolveChat_() {
  var props = PropertiesService.getScriptProperties();
  var existing = String(props.getProperty(IC_WIFE_MORNING_TELEGRAM_CHAT_KEY) || '').trim();
  if (existing) return { id: existing, firstName: 'Полина', username: '' };

  var token = String(props.getProperty('TELEGRAM_BOT_TOKEN') || '').trim();
  var mainChatId = String(props.getProperty('TELEGRAM_CHAT_ID') || '').trim();
  if (!token) throw new Error('Telegram bot is not configured');

  var response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates?limit=100', {
    method: 'get',
    muteHttpExceptions: true
  });
  var body = response.getContentText();
  var parsed = JSON.parse(body);
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || !parsed.ok) {
    throw new Error('Telegram getUpdates failed');
  }

  var chatsById = {};
  (parsed.result || []).forEach(function(update) {
    var message = update.message || update.edited_message || (update.callback_query && update.callback_query.message);
    var chat = message && message.chat;
    if (!chat || chat.type !== 'private') return;
    var id = String(chat.id || '');
    if (!id || id === mainChatId) return;
    chatsById[id] = {
      id: id,
      firstName: String(chat.first_name || ''),
      lastName: String(chat.last_name || ''),
      username: String(chat.username || '')
    };
  });

  var chats = Object.keys(chatsById).map(function(id) { return chatsById[id]; });
  var named = chats.filter(function(chat) {
    return /polina|полина|polly|полли/i.test([chat.firstName, chat.lastName, chat.username].join(' '));
  });
  var selected = named.length === 1 ? named[0] : (chats.length === 1 ? chats[0] : null);
  if (!selected) {
    throw new Error('Chat Polina not found. Ask Polina to open the bot, send /start, then repeat setup. Candidates: ' + chats.length);
  }

  return selected;
}

function IC_WIFE_MORNING_triggerCount_() {
  return ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === IC_WIFE_MORNING_TELEGRAM_HANDLER;
  }).length;
}

function IC_WIFE_MORNING_chatLabel_(chat) {
  var name = [chat.firstName, chat.lastName].filter(Boolean).join(' ').trim();
  return name || (chat.username ? '@' + chat.username : 'Полина');
}

function IC_WIFE_MORNING_number_(value) {
  var parsed = Number(String(value === null || value === undefined ? '' : value).replace(',', '.'));
  return isFinite(parsed) ? parsed : 0;
}

function IC_WIFE_MORNING_money_(value) {
  return IC_WIFE_MORNING_number_(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' $';
}

function IC_WIFE_MORNING_signedMoney_(value) {
  var number = IC_WIFE_MORNING_number_(value);
  return (number > 0 ? '+' : '') + IC_WIFE_MORNING_money_(number);
}

function IC_WIFE_MORNING_signedPct_(value) {
  var number = IC_WIFE_MORNING_number_(value);
  return (number > 0 ? '+' : '') + number.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + '%';
}

function IC_WIFE_MORNING_pctPlain_(value, digits) {
  return IC_WIFE_MORNING_number_(value).toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }) + '%';
}
