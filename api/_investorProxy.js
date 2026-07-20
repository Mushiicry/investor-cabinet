const MAIN_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwBtbI9LmbZGyr4gi35oXym56i1py5J_oy0shp_gDotJBmsRnG2UmVVvmPFBigoE3uLeA/exec";

const WIFE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwPvwu-EMXb9hGCZeRFhr9O8Vvz5-2y1sqn4V4OMsgqNkTs2t3U6zGDw7SVgdPVmrwg/exec";

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

const ownerEmailFor = (kind) => {
  const envName = kind === "wife" ? "WIFE_EMAIL" : "FOUNDER_EMAIL";
  const viteEnvName = kind === "wife" ? "VITE_WIFE_EMAIL" : "VITE_FOUNDER_EMAIL";
  return (getEnv(envName) || getEnv(viteEnvName)).toLowerCase();
};

const targetUrlFor = (kind) => {
  if (kind === "wife") {
    return getEnv("WIFE_APPS_SCRIPT_URL") || WIFE_APPS_SCRIPT_URL;
  }

  return getEnv("INVESTOR_APPS_SCRIPT_URL") || MAIN_APPS_SCRIPT_URL;
};

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

  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  try {
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

    // Белый список query-параметров, которые уезжают в Apps Script.
    // Сейчас единственная операция — запись достигнутого уровня лестницы
    // (?action=setMaxLevel&level=N). Владельца уже проверили выше по Supabase.
    const upstreamUrl = new URL(targetUrlFor(kind));
    const incoming = new URL(req.url ?? "/", "http://localhost");
    const action = incoming.searchParams.get("action");
    if (action === "setMaxLevel") {
      const level = Number(incoming.searchParams.get("level"));
      if (Number.isFinite(level) && level >= 1 && level <= 5) {
        upstreamUrl.searchParams.set("action", action);
        upstreamUrl.searchParams.set("level", String(Math.floor(level)));
      }
    }

    const upstream = await fetch(upstreamUrl.toString(), {
      headers: { accept: "application/json" },
      redirect: "follow",
    });
    const body = await upstream.text();

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
