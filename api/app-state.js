import crypto from "node:crypto";

const STATE_KEY = "publisher_group_cursors";

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    const error = new Error(`Variável ${name} não configurada.`);
    error.statusCode = 500;
    throw error;
  }

  return value;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req) {
  const expected = requiredEnv("TT_QUEUE_ADMIN_KEY");
  const received = String(req.headers["x-tt-admin-key"] || "");

  if (!safeEqual(received, expected)) {
    const error = new Error("Admin key inválida.");
    error.statusCode = 401;
    throw error;
  }
}

function supabaseConfig() {
  return {
    url: requiredEnv("SUPABASE_URL").replace(/\/+$/, ""),
    secret: requiredEnv("SUPABASE_SECRET_KEY")
  };
}

function cleanCursor(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.floor(number), 100000));
}

function cleanState(value) {
  return {
    eletronicos: cleanCursor(value?.eletronicos),
    fitness: cleanCursor(value?.fitness),
    perfumes: cleanCursor(value?.perfumes)
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
    const error = new Error(
      payload?.message ||
      payload?.details ||
      `Supabase HTTP ${response.status}.`
    );

    error.statusCode = 502;
    throw error;
  }

  return payload;
}

async function readState() {
  const payload = await supabaseRequest(
    "tt_app_state" +
    `?state_key=eq.${encodeURIComponent(STATE_KEY)}` +
    "&select=state_value" +
    "&limit=1"
  );

  if (!Array.isArray(payload) || payload.length === 0) {
    return cleanState(null);
  }

  return cleanState(payload[0]?.state_value);
}

async function writeState(value) {
  const state = cleanState(value);

  await supabaseRequest(
    "tt_app_state?on_conflict=state_key",
    {
      method: "POST",
      body: {
        state_key: STATE_KEY,
        state_value: state
      },
      prefer:
        "resolution=merge-duplicates,return=minimal"
    }
  );

  return state;
}

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    if (req.method === "GET") {
      const state = await readState();

      return res.status(200).json({
        ok: true,
        state,
        storage: "supabase",
        key: STATE_KEY
      });
    }

    if (req.method === "POST") {
      const state = await writeState(req.body?.state);

      return res.status(200).json({
        ok: true,
        saved: true,
        state,
        storage: "supabase",
        key: STATE_KEY
      });
    }

    return res.status(405).json({
      ok: false,
      error: "Method not allowed."
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      ok: false,
      error: error?.message || "Erro inesperado."
    });
  }
}
