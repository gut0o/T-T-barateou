import crypto from "node:crypto";
import { get, list, put } from "@vercel/blob";

const TOKEN_PREFIX = "tt/ml-tokens/";
const REFRESH_LOCK_PREFIX = "tt/ml-refresh-locks/";
const DEFAULT_MIN_VALIDITY_MS = 5 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEncryptionKey() {
  const value = process.env.ML_TOKEN_ENCRYPTION_KEY;

  if (!value) {
    throw new Error(
      "Falta ML_TOKEN_ENCRYPTION_KEY no Vercel. " +
      "Crie uma chave Base64 de 32 bytes e salve como variável Sensitive."
    );
  }

  let key;

  try {
    key = Buffer.from(value, "base64");
  } catch {
    throw new Error("ML_TOKEN_ENCRYPTION_KEY não é Base64 válida.");
  }

  if (key.length !== 32) {
    throw new Error(
      "ML_TOKEN_ENCRYPTION_KEY precisa representar exatamente 32 bytes."
    );
  }

  return key;
}

function requireBlobConfiguration() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Falta BLOB_READ_WRITE_TOKEN. Crie/conecte um Vercel Blob privado ao projeto."
    );
  }
}

function encryptJson(value) {
  const key = requireEncryptionKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("tt-barateou-ml-token-v1", "utf8"));

  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: encrypted.toString("base64")
  };
}

function decryptJson(payload) {
  if (!payload || payload.version !== 1) {
    throw new Error("Formato de token armazenado não reconhecido.");
  }

  const key = requireEncryptionKey();
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from("tt-barateou-ml-token-v1", "utf8"));
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

function normalizeTokenData(tokenData, source) {
  if (!tokenData?.access_token || !tokenData?.refresh_token) {
    throw new Error(
      "O Mercado Livre não devolveu access_token e refresh_token completos."
    );
  }

  const obtainedAt = Date.now();
  const expiresIn = Number(tokenData.expires_in || 0);

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type || "bearer",
    expires_in: expiresIn,
    expires_at: obtainedAt + expiresIn * 1000,
    obtained_at: obtainedAt,
    scope: tokenData.scope || "",
    user_id: tokenData.user_id ?? null,
    source
  };
}

function safeMetadata(record) {
  if (!record) return null;

  return {
    connected: true,
    userId: record.user_id,
    scope: record.scope,
    obtainedAt: record.obtained_at,
    expiresAt: record.expires_at,
    expiresInSeconds: record.expires_in,
    source: record.source,
    remainingSeconds: Math.max(
      0,
      Math.floor((record.expires_at - Date.now()) / 1000)
    )
  };
}

async function readBlobText(pathname) {
  const result = await get(pathname, {
    access: "private"
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Não foi possível ler o Blob privado ${pathname}.`);
  }

  return new Response(result.stream).text();
}

export async function saveMlTokenData(tokenData, source = "oauth") {
  requireBlobConfiguration();

  const record = normalizeTokenData(tokenData, source);
  const encrypted = encryptJson(record);

  // Blob imutável: cada rotação cria um arquivo novo.
  // Assim não dependemos de cache de overwrite para um refresh_token de uso único.
  const pathname =
    `${TOKEN_PREFIX}` +
    `${String(Date.now()).padStart(13, "0")}-` +
    `${crypto.randomUUID()}.json`;

  await put(pathname, JSON.stringify(encrypted), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });

  return safeMetadata(record);
}

export async function loadLatestMlTokenData() {
  requireBlobConfiguration();

  const result = await list({
    prefix: TOKEN_PREFIX,
    limit: 1000
  });

  if (!result.blobs?.length) {
    return null;
  }

  // A listagem não deve ser tratada como ordenada por data.
  const blobs = [...result.blobs].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );

  // Se houver um arquivo corrompido, tenta versões anteriores.
  for (const blob of blobs) {
    try {
      const text = await readBlobText(blob.pathname);
      const encrypted = JSON.parse(text);
      return decryptJson(encrypted);
    } catch (error) {
      console.error(
        "Falha ao ler uma versão de token armazenada:",
        blob.pathname,
        error.message
      );
    }
  }

  throw new Error("Nenhum token armazenado pôde ser descriptografado.");
}

async function claimRefreshToken(refreshToken) {
  requireBlobConfiguration();

  const hash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const pathname = `${REFRESH_LOCK_PREFIX}${hash}.lock`;

  try {
    // Não usamos allowOverwrite. O primeiro processo cria o lock.
    // Qualquer processo concorrente tentando usar o MESMO refresh token falha.
    await put(
      pathname,
      JSON.stringify({
        claimedAt: new Date().toISOString()
      }),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60
      }
    );

    return true;
  } catch {
    return false;
  }
}

async function exchangeRefreshToken(record) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltam ML_CLIENT_ID e/ou ML_CLIENT_SECRET no Vercel."
    );
  }

  const claimed = await claimRefreshToken(record.refresh_token);

  if (!claimed) {
    // Outro request provavelmente já está renovando este refresh token.
    // Esperamos a nova versão aparecer no Blob.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await sleep(1000);

      const latest = await loadLatestMlTokenData();

      if (
        latest &&
        latest.refresh_token !== record.refresh_token &&
        latest.expires_at > Date.now()
      ) {
        return latest;
      }
    }

    throw new Error(
      "Outro processo iniciou a renovação do token, mas o novo token " +
      "ainda não apareceu no armazenamento."
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: record.refresh_token
  });

  const response = await fetch(
    "https://api.mercadolibre.com/oauth/token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new Error(
      `Falha ao renovar token do Mercado Livre (HTTP ${response.status}): ` +
      `${data?.error || data?.message || "erro desconhecido"}`
    );
  }

  await saveMlTokenData(data, "refresh_token");

  return normalizeTokenData(data, "refresh_token");
}

export async function getValidMlTokenData(options = {}) {
  const minValidityMs =
    options.minValidityMs ?? DEFAULT_MIN_VALIDITY_MS;

  const record = await loadLatestMlTokenData();

  if (!record) {
    throw new Error(
      "Ainda não existe token persistido. Faça o OAuth por /api/login primeiro."
    );
  }

  if (record.expires_at - Date.now() > minValidityMs) {
    return record;
  }

  return exchangeRefreshToken(record);
}

export async function getMlTokenStatus() {
  const record = await loadLatestMlTokenData();

  if (!record) {
    return {
      connected: false,
      message: "Nenhum token persistido ainda."
    };
  }

  return {
    ...safeMetadata(record),
    expired: record.expires_at <= Date.now(),
    refreshAvailable: Boolean(record.refresh_token)
  };
}
