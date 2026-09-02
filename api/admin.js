import crypto from "node:crypto";

import {
  handleContinuousDiscoverAction,
  handleIngestAffiliateLinksAction,
  handleQueueListAction,
  handleQueueSummaryAction,
  handleReserveAddAction,
  handleReserveListAction,
  handleReserveRemoveAction
} from "../lib/tt-queue-admin-actions.js";

import { getMlTokenStatus } from "../lib/ml-token-store.js";

import {
  readPublisherControlState,
  readPublisherRuntimeState,
  writePublisherControlState
} from "../lib/tt-publisher-control-store.js";

const COOKIE_NAME = "tt_panel_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PUBLISHER_ONLINE_MAX_AGE_MS = 90 * 1000;

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    const error = new Error(`Variável ${name} não configurada.`);
    error.statusCode = 503;
    throw error;
  }

  return value;
}

function optionalEnv(name) {
  return String(process.env[name] || "").trim();
}

function timingSafeTextEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sessionSignature(payload) {
  return crypto
    .createHmac("sha256", requiredEnv("TT_PANEL_SESSION_SECRET"))
    .update(payload)
    .digest("base64url");
}

function createSessionToken(role) {
  const payload = Buffer.from(
    JSON.stringify({
      v: 2,
      role,
      exp: Date.now() + SESSION_TTL_MS,
      nonce: crypto.randomBytes(12).toString("hex")
    })
  ).toString("base64url");

  return `${payload}.${sessionSignature(payload)}`;
}

function readCookies(req) {
  const cookies = {};

  for (const part of String(req.headers?.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key) cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function sessionInfo(req) {
  const token = readCookies(req)[COOKIE_NAME];
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (
    !payload ||
    !signature ||
    !timingSafeTextEqual(signature, sessionSignature(payload))
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (
      decoded?.v !== 2 ||
      !["admin", "viewer"].includes(decoded?.role) ||
      Number(decoded?.exp) <= Date.now()
    ) {
      return null;
    }

    return {
      role: decoded.role,
      expiresAt: new Date(Number(decoded.exp)).toISOString()
    };
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  );
}

function requireSession(req) {
  const session = sessionInfo(req);

  if (!session) {
    const error = new Error("Sessão do painel inválida ou expirada.");
    error.statusCode = 401;
    throw error;
  }

  return session;
}

function requireAdminSession(req) {
  const session = requireSession(req);

  if (session.role !== "admin") {
    const error = new Error("Acesso somente para administrador.");
    error.statusCode = 403;
    throw error;
  }

  return session;
}

function assertSameOrigin(req) {
  const origin = String(req.headers?.origin || "").trim();
  if (!origin) return;

  const proto = String(req.headers?.["x-forwarded-proto"] || "https")
    .split(",")[0]
    .trim();

  const host = String(req.headers?.host || "").trim();

  if (origin !== `${proto}://${host}`) {
    const error = new Error("Origem inválida.");
    error.statusCode = 403;
    throw error;
  }
}

function bodyObject(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }
  return req.body || {};
}

function adminRequest(req, { query = {}, body = {} } = {}) {
  return {
    method: req.method,
    headers: {
      ...(req.headers || {}),
      "x-tt-admin-key": requiredEnv("TT_QUEUE_ADMIN_KEY")
    },
    query,
    body
  };
}

function reserveEntries(result) {
  if (Array.isArray(result?.reserve)) return result.reserve;
  if (Array.isArray(result?.reserve?.entries)) return result.reserve.entries;
  return [];
}

function publisherView(control, runtime) {
  const heartbeatAt = runtime?.heartbeatAt || null;
  const heartbeatTime = heartbeatAt ? Date.parse(heartbeatAt) : NaN;

  const online =
    Number.isFinite(heartbeatTime) &&
    Date.now() - heartbeatTime <= PUBLISHER_ONLINE_MAX_AGE_MS;

  return {
    online,
    heartbeatAt,
    whatsappConnected: online && runtime?.whatsappConnected === true,
    manualModeEnabled:
      typeof runtime?.manualModeEnabled === "boolean"
        ? runtime.manualModeEnabled
        : control?.manualModeEnabled === true,
    requestedManualModeEnabled: control?.manualModeEnabled === true,
    controlSource: control?.source || null,
    controlUpdatedAt: control?.updatedAt || null,
    automaticWindowOpen: runtime?.automaticWindowOpen === true,
    automaticBatchInProgress: runtime?.automaticBatchInProgress === true,
    autoBatchEnabled: runtime?.autoBatchEnabled !== false,
    autoDiscoveryEnabled: runtime?.autoDiscoveryEnabled !== false,
    affiliateConfigured: runtime?.affiliateConfigured === true,
    affiliateBlocked: runtime?.affiliateBlocked === true,
    testMode: runtime?.testMode === true,
    sendWindow: runtime?.sendWindow || "09:00–22:00 (America/Sao_Paulo)",
    timezone: runtime?.timezone || "America/Sao_Paulo",
    currentClock: runtime?.currentClock || null,
    publisherVersion: runtime?.publisherVersion || null
  };
}

async function exactQueueCount() {
  try {
    const url = requiredEnv("SUPABASE_URL").replace(/\/+$/, "");
    const secret = requiredEnv("SUPABASE_SECRET_KEY");

    const response = await fetch(
      `${url}/rest/v1/tt_publication_queue?select=id&limit=1`,
      {
        headers: {
          Accept: "application/json",
          apikey: secret,
          Authorization: `Bearer ${secret}`,
          Prefer: "count=exact",
          Range: "0-0"
        }
      }
    );

    if (!response.ok) return null;

    const contentRange = String(
      response.headers.get("content-range") || ""
    );

    const total = Number(contentRange.split("/")[1]);

    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

async function dashboard(req, role) {
  const [
    summary,
    queue,
    mlStatus,
    control,
    runtime,
    queueTotalExact
  ] = await Promise.all([
    handleQueueSummaryAction(adminRequest(req, { query: {} })),
    handleQueueListAction(adminRequest(req, { query: { limit: 100 } })),
    getMlTokenStatus()
      .then((status) => ({ ok: true, ...status }))
      .catch((error) => ({
        ok: false,
        connected: false,
        message: error?.message || "Não consegui consultar o Mercado Livre."
      })),
    readPublisherControlState(),
    readPublisherRuntimeState(),
    exactQueueCount()
  ]);

  let perfumeAvailableCount = 0;

  try {
    const result = await handleReserveListAction(
      adminRequest(req, {
        query: {
          group: "perfumes",
          status: "available",
          limit: 100
        }
      })
    );

    perfumeAvailableCount = reserveEntries(result).length;
  } catch {
    perfumeAvailableCount = 0;
  }

  return {
    ok: true,
    action: "dashboard",
    role,
    summary,
    queue,
    queueTotalExact,
    mlStatus,
    perfumeAvailableCount,
    publisher: publisherView(control, runtime)
  };
}

function normalizeLinks(raw) {
  const values = Array.isArray(raw)
    ? raw
    : String(raw || "").split(/\s+/);

  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((value) => /^https?:\/\//i.test(value))
    )
  ).slice(0, 20);
}

async function reserveAdd(req) {
  const body = bodyObject(req);
  const group = String(body.group || "").trim().toLowerCase();

  if (!["eletronicos", "fitness", "perfumes"].includes(group)) {
    const error = new Error("Grupo inválido.");
    error.statusCode = 400;
    throw error;
  }

  const links = normalizeLinks(body.affiliateLinks || body.links);

  if (!links.length) {
    const error = new Error("Envie pelo menos um link válido.");
    error.statusCode = 400;
    throw error;
  }

  const batches = [];
  for (let index = 0; index < links.length; index += 10) {
    batches.push(links.slice(index, index + 10));
  }

  const results = [];

  for (const batch of batches) {
    results.push(
      await handleReserveAddAction(
        adminRequest(req, {
          body: {
            group,
            affiliateLinks: batch
          }
        })
      )
    );
  }

  const flatResults = results.flatMap((item) => item.results || []);
  const addedCount = results.reduce(
    (sum, item) => sum + Number(item.addedCount || 0),
    0
  );
  const duplicateCount = results.reduce(
    (sum, item) => sum + Number(item.duplicateCount || 0),
    0
  );
  const failedCount = results.reduce(
    (sum, item) => sum + Number(item.failedCount || 0),
    0
  );

  return {
    ok: true,
    operationOk: failedCount === 0,
    action: "reserve-add",
    group,
    requestedCount: links.length,
    addedCount,
    duplicateCount,
    failedCount,
    results: flatResults
  };
}


async function productAdd(req) {
  const body = bodyObject(req);
  const links = normalizeLinks(body.affiliateLinks || body.links);

  if (!links.length) {
    const error = new Error("Envie pelo menos um link válido.");
    error.statusCode = 400;
    throw error;
  }

  const batches = [];
  for (let index = 0; index < links.length; index += 10) {
    batches.push(links.slice(index, index + 10));
  }

  const results = [];

  for (const batch of batches) {
    results.push(
      await handleIngestAffiliateLinksAction(
        adminRequest(req, {
          body: {
            affiliateLinks: batch
          }
        })
      )
    );
  }

  return {
    ok: true,
    action: "product-add",
    requestedCount: links.length,
    readyCount: results.reduce(
      (sum, item) => sum + Number(item.readyCount || 0),
      0
    ),
    heldCount: results.reduce(
      (sum, item) => sum + Number(item.heldCount || 0),
      0
    ),
    failedCount: results.reduce(
      (sum, item) => sum + Number(item.failedCount || 0),
      0
    ),
    results: results.flatMap((item) => item.results || [])
  };
}

function safeErrorMessage(error) {
  if (typeof error?.message === "string") return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Erro inesperado no painel.";
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");

  try {
    const action = String(req.query?.action || "").trim().toLowerCase();

    if (action === "login") {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Use POST." });
      }

      assertSameOrigin(req);

      const body = bodyObject(req);
      const received = String(body.password || "");
      const adminPassword = requiredEnv("TT_PANEL_PASSWORD");
      const viewerPassword = optionalEnv("TT_PANEL_VIEW_PASSWORD");

      let role = null;

      if (timingSafeTextEqual(received, adminPassword)) {
        role = "admin";
      } else if (
        viewerPassword &&
        timingSafeTextEqual(received, viewerPassword)
      ) {
        role = "viewer";
      }

      if (!role) {
        return res.status(401).json({
          ok: false,
          error: "Senha incorreta."
        });
      }

      setSessionCookie(res, createSessionToken(role));

      return res.status(200).json({
        ok: true,
        authenticated: true,
        role
      });
    }

    if (action === "logout") {
      assertSameOrigin(req);
      clearSessionCookie(res);

      return res.status(200).json({
        ok: true,
        authenticated: false
      });
    }

    if (action === "session") {
      const session = sessionInfo(req);

      if (!session) {
        return res.status(401).json({
          ok: false,
          authenticated: false,
          error: "Sessão não autenticada."
        });
      }

      return res.status(200).json({
        ok: true,
        authenticated: true,
        role: session.role,
        expiresAt: session.expiresAt
      });
    }

    const session = requireSession(req);

    if (req.method === "POST") {
      assertSameOrigin(req);
    }

    if (action === "dashboard") {
      return res.status(200).json(
        await dashboard(req, session.role)
      );
    }

    if (action === "reserve-list") {
      const status = String(
        req.query?.status || "available"
      ).trim().toLowerCase();

      const result = await handleReserveListAction(
        adminRequest(req, {
          query: {
            group: "perfumes",
            status,
            limit: 100
          }
        })
      );

      const entries = reserveEntries(result);

      return res.status(200).json({
        ...result,
        ok: true,
        reserve: entries,
        reserveMeta: {
          count: result?.reserve?.count ?? entries.length,
          group: result?.reserve?.group ?? "perfumes",
          status: result?.reserve?.status ?? status
        }
      });
    }

    if (action === "publisher-control") {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Use POST." });
      }

      requireAdminSession(req);
      const body = bodyObject(req);

      const control = await writePublisherControlState({
        manualModeEnabled: body.manualModeEnabled === true,
        source: "panel"
      });

      return res.status(200).json({
        ok: true,
        action,
        control
      });
    }

    if (action === "product-add") {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Use POST." });
      }

      requireAdminSession(req);
      return res.status(200).json(await productAdd(req));
    }

    if (action === "reserve-add") {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Use POST." });
      }

      requireAdminSession(req);
      return res.status(200).json(await reserveAdd(req));
    }

    if (action === "reserve-remove") {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Use POST." });
      }

      requireAdminSession(req);

      const body = bodyObject(req);
      const id = Number(body.id);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ ok: false, error: "ID inválido." });
      }

      const result = await handleReserveRemoveAction(
        adminRequest(req, { body: { id } })
      );

      return res.status(200).json(result);
    }

    if (action === "discover") {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Use POST." });
      }

      requireAdminSession(req);

      const body = bodyObject(req);
      const group = String(body.group || "").trim().toLowerCase();

      if (!["eletronicos", "fitness"].includes(group)) {
        return res.status(400).json({
          ok: false,
          error: "Use eletronicos ou fitness."
        });
      }

      const result = await handleContinuousDiscoverAction(
        adminRequest(req, {
          body: { group },
          query: {}
        })
      );

      return res.status(200).json(result);
    }

    return res.status(404).json({
      ok: false,
      error: "Ação administrativa não encontrada."
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      ok: false,
      error: safeErrorMessage(error)
    });
  }
}
