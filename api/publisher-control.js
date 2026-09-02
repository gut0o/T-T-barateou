import crypto from "node:crypto";

import {
  readPublisherControlState,
  readPublisherRuntimeState,
  writePublisherControlState,
  writePublisherRuntimeState
} from "../lib/tt-publisher-control-store.js";

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    const error = new Error(`Variável ${name} não configurada.`);
    error.statusCode = 503;
    throw error;
  }
  return value;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdmin(req) {
  const expected = requiredEnv("TT_QUEUE_ADMIN_KEY");
  const received = String(req.headers?.["x-tt-admin-key"] || "");

  if (!safeEqual(received, expected)) {
    const error = new Error("Admin key inválida.");
    error.statusCode = 401;
    throw error;
  }
}

function bodyObject(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }
  return req.body || {};
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    requireAdmin(req);

    if (req.method === "GET") {
      const [control, runtime] = await Promise.all([
        readPublisherControlState(),
        readPublisherRuntimeState()
      ]);

      return res.status(200).json({
        ok: true,
        control,
        runtime
      });
    }

    if (req.method === "POST") {
      const body = bodyObject(req);
      const action = String(body.action || "").trim().toLowerCase();

      if (action === "control") {
        const control = await writePublisherControlState({
          manualModeEnabled: body.manualModeEnabled === true,
          source: body.source || "api"
        });

        return res.status(200).json({
          ok: true,
          action,
          control
        });
      }

      if (action === "heartbeat") {
        const runtime = await writePublisherRuntimeState(body.runtime || {});

        return res.status(200).json({
          ok: true,
          action,
          runtime
        });
      }

      return res.status(400).json({
        ok: false,
        error: "Ação inválida. Use control ou heartbeat."
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
