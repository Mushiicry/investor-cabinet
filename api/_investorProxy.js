const MAIN_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwBtbI9LmbZGyr4gi35oXym56i1py5J_oy0shp_gDotJBmsRnG2UmVVvmPFBigoE3uLeA/exec";

const CAPITAL_LADDER_LEVELS = 7;
const READ_RETRY_ATTEMPTS = 3;
const READ_RETRY_DELAY_MS = 700;
const WIFE_PRICE_TIMEOUT_MS = 8_000;
const WIFE_EVM_ADDRESS = "0x06F03b067b34f3d6E569De9aB7839c988Bf6BAEE";
const WIFE_TON_ADDRESS = "UQCMRrWTgMBqBMr6yUw04ZYz398fyIhDlaJyaqoQTchVNm74";
const USDT_ARB_CONTRACT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
const ARB_RPC_URLS = [
  "https://arb1.arbitrum.io/rpc",
  "https://arbitrum-one-rpc.publicnode.com",
  "https://1rpc.io/arb",
];
const TONAPI_JETTONS_URL = `https://tonapi.io/v2/accounts/${WIFE_TON_ADDRESS}/jettons`;
const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

const getEnv = (name) => process.env[name]?.trim() ?? "";

const getHeader = (req, name) => {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
};

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
};

const roundPrice = (value) => {
  const abs = Math.abs(Number(value || 0));
  if (abs < 10) return round(value, 6);
  if (abs < 1000) return round(value, 4);
  return round(value, 2);
};

const toNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = WIFE_PRICE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

const isJsonPayload = (upstream, body) => {
  const contentType = upstream.headers.get("content-type") ?? "";
  return contentType.includes("application/json") || /^[\[{]/.test(body.trim());
};

const isRetryableReadFailure = (upstream, body) =>
  upstream.status === 404 ||
  upstream.status >= 500 ||
  !isJsonPayload(upstream, body);

async function fetchInvestorUpstream(upstreamUrl, req) {
  const isReadOnly = req.method === "GET";
  const attempts = isReadOnly ? READ_RETRY_ATTEMPTS : 1;
  let lastResult = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: req.method,
      headers: { accept: "application/json" },
      body: req.method === "POST" ? req : undefined,
      duplex: req.method === "POST" ? "half" : undefined,
      redirect: "follow",
    });
    const body = await upstream.text();
    lastResult = { upstream, body, attempt };

    if (!isReadOnly || !isRetryableReadFailure(upstream, body)) {
      return lastResult;
    }

    if (attempt < attempts) {
      await delay(READ_RETRY_DELAY_MS);
    }
  }

  return lastResult;
}

const ownerEmailFor = (kind) => {
  const envName = kind === "wife" ? "WIFE_EMAIL" : "FOUNDER_EMAIL";
  const viteEnvName = kind === "wife" ? "VITE_WIFE_EMAIL" : "VITE_FOUNDER_EMAIL";
  return (getEnv(envName) || getEnv(viteEnvName)).toLowerCase();
};

const targetUrlFor = () => {
  return getEnv("INVESTOR_APPS_SCRIPT_URL") || MAIN_APPS_SCRIPT_URL;
};

export const investorReadUrlFor = (kind) => {
  const upstreamUrl = new URL(targetUrlFor(kind));
  upstreamUrl.searchParams.set("accountId", kind);
  return upstreamUrl.toString();
};

async function fetchHyperliquidMids(payload) {
  return fetchJsonWithTimeout(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function fetchWifePriceMap() {
  const [primary, xyz] = await Promise.all([
    fetchHyperliquidMids({ type: "allMids" }),
    fetchHyperliquidMids({ type: "allMids", dex: "xyz" }),
  ]);
  const priceMap = {};
  const addPrice = (ticker, value) => {
    const price = toNumber(value);
    if (ticker && price > 0) priceMap[String(ticker).toUpperCase()] = price;
  };

  ["BTC", "ETH", "SOL", "ATOM", "BNB", "MNT"].forEach((ticker) => addPrice(ticker, primary[ticker]));
  addPrice("GRAM", primary.GRAM);
  addPrice("TON", primary.GRAM);
  addPrice("GOLD", xyz["xyz:GOLD"]);
  addPrice("GOLD LONG", xyz["xyz:GOLD"]);
  addPrice("XAU", xyz["xyz:GOLD"]);
  addPrice("XAUUSD", xyz["xyz:GOLD"]);
  addPrice("SPACEX", xyz["xyz:SPCX"]);
  addPrice("SPCX", xyz["xyz:SPCX"]);
  addPrice("SPCXB", xyz["xyz:SPCX"]);
  addPrice("USDT", 1);
  addPrice("USDC", 1);

  return priceMap;
}

async function fetchWifeUsdtArb() {
  const paddedAddress = `000000000000000000000000${WIFE_EVM_ADDRESS.slice(2).toLowerCase()}`;
  const callData = `0x70a08231${paddedAddress}`;
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: USDT_ARB_CONTRACT, data: callData }, "latest"],
  });
  const errors = [];

  for (const rpcUrl of ARB_RPC_URLS) {
    try {
      const data = await fetchJsonWithTimeout(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });
      const raw = typeof data.result === "string" ? BigInt(data.result) : 0n;
      return round(Number(raw) / 1e6, 2);
    } catch (error) {
      errors.push(`${rpcUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(errors.join(" | "));
}

async function fetchWifeUsdtTon() {
  const data = await fetchJsonWithTimeout(TONAPI_JETTONS_URL);
  const balances = Array.isArray(data.balances) ? data.balances : [];

  for (const balance of balances) {
    const jetton = isRecord(balance?.jetton) ? balance.jetton : {};
    const symbol = String(jetton.symbol || "").replace("₮", "T");
    const name = String(jetton.name || "");
    if (symbol === "USDT" || name === "Tether USD") {
      const decimals = Number(jetton.decimals || 6);
      return round(Number(balance.balance || 0) / 10 ** decimals, 2);
    }
  }

  return 0;
}

async function fetchWifeStableBalance() {
  const [arb, ton] = await Promise.allSettled([fetchWifeUsdtArb(), fetchWifeUsdtTon()]);
  const usdtArb = arb.status === "fulfilled" ? arb.value : 0;
  const usdtTon = ton.status === "fulfilled" ? ton.value : 0;

  return {
    USDT_ARB: usdtArb,
    USDT_TON: usdtTon,
    USDT: round(usdtArb + usdtTon, 2),
    complete: arb.status === "fulfilled" && ton.status === "fulfilled",
    _errors: {
      ...(arb.status === "rejected" ? { USDT_ARB: arb.reason instanceof Error ? arb.reason.message : String(arb.reason) } : {}),
      ...(ton.status === "rejected" ? { USDT_TON: ton.reason instanceof Error ? ton.reason.message : String(ton.reason) } : {}),
    },
  };
}

const WIFE_STABLE_CATEGORY = "Кэш / Стейблы";
const WIFE_CATEGORY_NAMES = ["Крипта", "Акции", "Металлы", "Фьючерсы", WIFE_STABLE_CATEGORY];

const wifeHealth = (reserveShare, cryptoShare, largestShare) => {
  const reservePts = Math.min(100, reserveShare * 333);
  const concPts = Math.max(0, 100 - Math.max(0, largestShare - 0.25) * 286);
  const expPts = Math.max(0, 100 - Math.max(0, cryptoShare - 0.6) * 333);
  return Math.round(reservePts * 0.5 + concPts * 0.3 + expPts * 0.2);
};

const wifeHealthLabel = (health) => {
  if (health >= 80) return "Хорошо";
  if (health >= 60) return "Умеренно";
  if (health >= 40) return "Внимание";
  return "Критично";
};

function rebuildWifePayload(payload, priceMap, stableBalance) {
  if (!payload.success || !Array.isArray(payload.portfolio) || !isRecord(payload.overview)) {
    return payload;
  }

  const positions = payload.portfolio.map((position) => {
    const ticker = String(position.ticker || position.asset || "").trim().toUpperCase();
    const asset = String(position.asset || "").trim().toUpperCase();
    const category = String(position.category || "");
    const isStable = category === WIFE_STABLE_CATEGORY || ticker === "USDT" || ticker === "USDC";
    const liveStableQuantity = ticker === "USDT" && stableBalance.complete ? toNumber(stableBalance.USDT) : 0;
    const quantity = liveStableQuantity > 0 ? liveStableQuantity : toNumber(position.quantity);
    const invested = isStable && liveStableQuantity > 0 ? round(liveStableQuantity, 2) : toNumber(position.invested);
    const currentPrice = isStable ? 1 : (priceMap[ticker] || priceMap[asset] || toNumber(position.currentPrice));
    const currentValue = isStable ? round(quantity, 2) : round(quantity * currentPrice, 2);
    const pnl = isStable ? 0 : round(currentValue - invested, 2);
    const pnlPct = !isStable && invested > 0 ? round((pnl / invested) * 100, 2) : 0;

    return {
      ...position,
      quantity,
      invested,
      currentPrice: roundPrice(currentPrice),
      currentValue,
      pnl,
      pnlPct,
      dataSource: liveStableQuantity > 0 && ticker === "USDT" ? "live-stable" : position.dataSource,
    };
  });

  const portfolioValue = round(positions.reduce((sum, position) => sum + toNumber(position.currentValue), 0), 2);
  const invested = round(positions.reduce((sum, position) => sum + toNumber(position.invested), 0), 2);
  const reserve = round(positions
    .filter((position) => String(position.category || "") === WIFE_STABLE_CATEGORY)
    .reduce((sum, position) => sum + toNumber(position.currentValue), 0), 2);
  const totalPnl = round(portfolioValue - invested, 2);
  const totalPnlPct = invested > 0 ? round(totalPnl / invested, 6) : 0;

  positions.forEach((position) => {
    position.share = portfolioValue > 0 ? round((toNumber(position.currentValue) / portfolioValue) * 100, 2) : 0;
  });

  const crypto = positions.filter((position) => String(position.category || "") !== WIFE_STABLE_CATEGORY);
  const largestRisk = crypto.reduce((largest, position) =>
    !largest || toNumber(position.share) > toNumber(largest.share) ? position : largest, null);
  const best = crypto.reduce((current, position) =>
    !current || toNumber(position.pnl) > toNumber(current.pnl) ? position : current, null);
  const worst = crypto.reduce((current, position) =>
    !current || toNumber(position.pnl) < toNumber(current.pnl) ? position : current, null);
  const reserveShare = portfolioValue > 0 ? reserve / portfolioValue : 0;
  const cryptoValue = positions
    .filter((position) => String(position.category || "") === "Крипта")
    .reduce((sum, position) => sum + toNumber(position.currentValue), 0);
  const cryptoShare = portfolioValue > 0 ? round((cryptoValue / portfolioValue) * 100, 2) : 0;
  const health = wifeHealth(reserveShare, cryptoShare / 100, largestRisk ? toNumber(largestRisk.share) / 100 : 0);
  const categories = WIFE_CATEGORY_NAMES.map((name) => {
    const value = round(positions
      .filter((position) => String(position.category || "") === name)
      .reduce((sum, position) => sum + toNumber(position.currentValue), 0), 2);
    return { name, value, share: portfolioValue > 0 ? round(value / portfolioValue, 4) : 0 };
  });

  return {
    ...payload,
    patch: "WIFE API v2.5 - vercel-live-prices",
    _chain: stableBalance,
    overview: {
      ...payload.overview,
      invested,
      portfolioValue,
      pnl: totalPnl,
      pnlPct: totalPnlPct,
      reserve,
      positionsCount: crypto.length,
      health,
      state: wifeHealthLabel(health),
      signal: "Hyperliquid цены + live USDT",
      categories,
      bestPosition: best ? { asset: best.asset, pnl: best.pnl } : null,
      worstPosition: worst ? { asset: worst.asset, pnl: worst.pnl } : null,
    },
    portfolio: positions,
    risk: {
      ...payload.risk,
      portfolioValue,
      reserve,
      reserveShare: round(reserveShare * 100, 2),
      largestRiskAsset: largestRisk ? largestRisk.asset : "",
      largestRiskShare: largestRisk ? round(toNumber(largestRisk.share), 2) : 0,
      cryptoShare,
      health,
      state: wifeHealthLabel(health),
      signal: "Hyperliquid цены + live USDT",
    },
    fearGreedStrategy: isRecord(payload.fearGreedStrategy)
      ? { ...payload.fearGreedStrategy, portfolioValue: invested }
      : payload.fearGreedStrategy,
  };
}

async function enrichWifeReadPayload(body) {
  const payload = JSON.parse(body);
  if (!payload.success) return payload;

  try {
    const [priceMap, stableBalance] = await Promise.all([
      fetchWifePriceMap(),
      fetchWifeStableBalance(),
    ]);
    return rebuildWifePayload(payload, priceMap, stableBalance);
  } catch (error) {
    return {
      ...payload,
      _livePricingError: error instanceof Error ? error.message : "Wife live pricing failed",
    };
  }
}

async function verifySupabaseUser(req) {
  const supabaseUrl = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY") || getEnv("VITE_SUPABASE_ANON_KEY");
  const authHeader = getHeader(req, "authorization");
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!supabaseUrl || !anonKey || !token) {
    return null;
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function proxyInvestorApi(req, res, kind) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  try {
    const incoming = new URL(req.url ?? "/", "http://localhost");
    const action = incoming.searchParams.get("action");
    const requiresOwnerAuth = req.method !== "GET" || Boolean(action);

    if (requiresOwnerAuth) {
      const ownerEmail = ownerEmailFor(kind);
      const user = await verifySupabaseUser(req);
      const userEmail = user?.email?.trim().toLowerCase() ?? "";

      if (!userEmail) {
        sendJson(res, 401, { success: false, error: "Unauthorized" });
        return;
      }

      if (!ownerEmail) {
        sendJson(res, 503, { success: false, error: "Owner email is not configured" });
        return;
      }

      if (userEmail !== ownerEmail) {
        sendJson(res, 403, { success: false, error: "Forbidden" });
        return;
      }
    }

    // Белый список query-параметров, которые уезжают в Apps Script.
    // Сейчас единственная операция — запись достигнутого уровня лестницы
    // (?action=setMaxLevel&level=N). Владельца уже проверили выше по Supabase.
    const upstreamUrl = new URL(targetUrlFor(kind));
    upstreamUrl.searchParams.set("accountId", kind);

    if (req.method === "POST" && action !== "saveInvestorDNAAnswers") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }

    if (action === "setMaxLevel") {
      const level = Number(incoming.searchParams.get("level"));
      if (Number.isFinite(level) && level >= 1 && level <= CAPITAL_LADDER_LEVELS) {
        upstreamUrl.searchParams.set("action", action);
        upstreamUrl.searchParams.set("level", String(Math.floor(level)));
      }
    }

    if (action === "saveInvestorDNAAnswers") {
      upstreamUrl.searchParams.set("action", action);
    }

    const { upstream, body, attempt } = await fetchInvestorUpstream(upstreamUrl, req);

    if (!upstream.ok || !isJsonPayload(upstream, body)) {
      sendJson(res, 502, {
        success: false,
        error: "Investor upstream returned invalid response",
        upstreamStatus: upstream.status,
        attempts: attempt,
      });
      return;
    }

    if (kind === "wife" && req.method === "GET" && !action) {
      sendJson(res, upstream.status, await enrichWifeReadPayload(body));
      return;
    }

    res.statusCode = upstream.status;
    res.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(body);
  } catch (error) {
    sendJson(res, 502, {
      success: false,
      error: error instanceof Error ? error.message : "Investor proxy failed",
    });
  }
}
