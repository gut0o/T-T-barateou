const CONTROL_KEY = "publisher_control_v1";
const RUNTIME_KEY = "publisher_runtime_v1";

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    const error = new Error(`Variável ${name} não configurada.`);
    error.statusCode = 503;
    throw error;
  }
  return value;
}

function supabaseConfig() {
  return {
    url: requiredEnv("SUPABASE_URL").replace(/\/+$/, ""),
    secret: requiredEnv("SUPABASE_SECRET_KEY")
  };
}

async function supabaseRequest(
  path,
  {
    method = "GET",
    body = null,
    prefer = null
  } = {}
) {
  const { url, secret } = supabaseConfig();

  const headers = {
    Accept: "application/json",
    apikey: secret,
    Authorization: `Bearer ${secret}`
  };

  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }

  if (prefer) {
    headers.Prefer = prefer;
  }

  const response = await fetch(
    `${url}/rest/v1/${path}`,
    {
      method,
      headers,
      body:
        body === null
          ? undefined
          : JSON.stringify(body)
    }
  );

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      payload?.message ||
      payload?.details ||
      payload?.hint ||
      (typeof payload === "string" ? payload : null) ||
      `HTTP ${response.status}`;

    const error = new Error(`Supabase publisher state: ${detail}`);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

function safeIso(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function cleanControl(value) {
  return {
    manualModeEnabled: value?.manualModeEnabled === true,
    source: String(value?.source || "default").slice(0, 40),
    updatedAt: safeIso(value?.updatedAt)
  };
}

function cleanRuntime(value) {
  return {
    heartbeatAt: safeIso(value?.heartbeatAt),
    whatsappConnected: value?.whatsappConnected === true,
    manualModeEnabled: value?.manualModeEnabled === true,
    automaticWindowOpen: value?.automaticWindowOpen === true,
    automaticBatchInProgress: value?.automaticBatchInProgress === true,
    autoBatchEnabled: value?.autoBatchEnabled !== false,
    autoDiscoveryEnabled: value?.autoDiscoveryEnabled !== false,
    affiliateConfigured: value?.affiliateConfigured === true,
    affiliateBlocked: value?.affiliateBlocked === true,
    testMode: value?.testMode === true,
    sendWindow: String(value?.sendWindow || "").slice(0, 120) || null,
    timezone: String(value?.timezone || "").slice(0, 80) || null,
    currentClock: String(value?.currentClock || "").slice(0, 20) || null,
    publisherVersion: String(value?.publisherVersion || "v2").slice(0, 40)
  };
}

async function readState(key) {
  const payload = await supabaseRequest(
    "tt_app_state" +
      `?state_key=eq.${encodeURIComponent(key)}` +
      "&select=state_value" +
      "&limit=1"
  );

  if (!Array.isArray(payload) || !payload.length) {
    return null;
  }

  return payload[0]?.state_value || null;
}

async function writeState(key, value) {
  await supabaseRequest(
    "tt_app_state?on_conflict=state_key",
    {
      method: "POST",
      body: {
        state_key: key,
        state_value: value
      },
      prefer: "resolution=merge-duplicates,return=minimal"
    }
  );

  return value;
}

export async function readPublisherControlState() {
  return cleanControl(await readState(CONTROL_KEY));
}

export async function writePublisherControlState({
  manualModeEnabled,
  source = "panel"
}) {
  const value = cleanControl({
    manualModeEnabled: manualModeEnabled === true,
    source,
    updatedAt: new Date().toISOString()
  });

  return writeState(CONTROL_KEY, value);
}

export async function readPublisherRuntimeState() {
  return cleanRuntime(await readState(RUNTIME_KEY));
}

export async function writePublisherRuntimeState(runtime = {}) {
  const value = cleanRuntime({
    ...runtime,
    heartbeatAt: new Date().toISOString()
  });

  return writeState(RUNTIME_KEY, value);
}
