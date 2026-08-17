import crypto from "node:crypto";

const TOKEN_PROVIDER =
  "mercadolivre";

const DEFAULT_MIN_VALIDITY_MS =
  5 * 60 * 1000;

function sleep(
  ms
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function requireEncryptionKey() {
  const value =
    process.env
      .ML_TOKEN_ENCRYPTION_KEY;

  if (!value) {
    throw new Error(
      "Falta ML_TOKEN_ENCRYPTION_KEY no Vercel. " +
      "Crie uma chave Base64 de 32 bytes e salve como variável Sensitive."
    );
  }

  let key;

  try {
    key =
      Buffer.from(
        value,
        "base64"
      );
  } catch {
    throw new Error(
      "ML_TOKEN_ENCRYPTION_KEY não é Base64 válida."
    );
  }

  if (
    key.length !==
    32
  ) {
    throw new Error(
      "ML_TOKEN_ENCRYPTION_KEY precisa representar exatamente 32 bytes."
    );
  }

  return key;
}

function requireSupabaseConfiguration() {
  const url =
    String(
      process.env
        .SUPABASE_URL ||
      ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  const secretKey =
    String(
      process.env
        .SUPABASE_SECRET_KEY ||
      ""
    )
      .trim();

  if (
    !url ||
    !secretKey
  ) {
    throw new Error(
      "Faltam SUPABASE_URL e/ou SUPABASE_SECRET_KEY no Vercel."
    );
  }

  return {
    url,
    secretKey
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
  const {
    url,
    secretKey
  } =
    requireSupabaseConfiguration();

  const headers = {
    Accept:
      "application/json",

    apikey:
      secretKey,

    Authorization:
      `Bearer ${secretKey}`
  };

  if (
    body !== null
  ) {
    headers[
      "Content-Type"
    ] =
      "application/json";
  }

  if (
    prefer
  ) {
    headers.Prefer =
      prefer;
  }

  const response =
    await fetch(
      `${url}/rest/v1/${path}`,
      {
        method,
        headers,

        body:
          body === null
            ? undefined
            : JSON.stringify(
                body
              )
      }
    );

  const text =
    await response.text();

  let payload =
    null;

  if (
    text
  ) {
    try {
      payload =
        JSON.parse(
          text
        );
    } catch {
      payload =
        text;
    }
  }

  if (
    !response.ok
  ) {
    const detail =
      payload?.message ||
      payload?.details ||
      (
        typeof payload ===
        "string"
          ? payload
          : null
      ) ||
      `HTTP ${response.status}`;

    const error =
      new Error(
        `Supabase: ${detail}`
      );

    error.statusCode =
      response.status;

    throw error;
  }

  return {
    status:
      response.status,

    payload
  };
}

function encryptJson(
  value
) {
  const key =
    requireEncryptionKey();

  const iv =
    crypto.randomBytes(
      12
    );

  const cipher =
    crypto.createCipheriv(
      "aes-256-gcm",
      key,
      iv
    );

  cipher.setAAD(
    Buffer.from(
      "tt-barateou-ml-token-v1",
      "utf8"
    )
  );

  const plaintext =
    Buffer.from(
      JSON.stringify(
        value
      ),
      "utf8"
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        plaintext
      ),

      cipher.final()
    ]);

  const authTag =
    cipher.getAuthTag();

  return {
    version:
      1,

    algorithm:
      "aes-256-gcm",

    iv:
      iv.toString(
        "base64"
      ),

    authTag:
      authTag.toString(
        "base64"
      ),

    ciphertext:
      encrypted.toString(
        "base64"
      )
  };
}

function decryptJson(
  payload
) {
  if (
    !payload ||
    payload.version !== 1
  ) {
    throw new Error(
      "Formato de token armazenado não reconhecido."
    );
  }

  const key =
    requireEncryptionKey();

  const iv =
    Buffer.from(
      payload.iv,
      "base64"
    );

  const authTag =
    Buffer.from(
      payload.authTag,
      "base64"
    );

  const ciphertext =
    Buffer.from(
      payload.ciphertext,
      "base64"
    );

  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      iv
    );

  decipher.setAAD(
    Buffer.from(
      "tt-barateou-ml-token-v1",
      "utf8"
    )
  );

  decipher.setAuthTag(
    authTag
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        ciphertext
      ),

      decipher.final()
    ]);

  return JSON.parse(
    decrypted.toString(
      "utf8"
    )
  );
}

function normalizeTokenData(
  tokenData,
  source
) {
  if (
    !tokenData?.access_token ||
    !tokenData?.refresh_token
  ) {
    throw new Error(
      "O Mercado Livre não devolveu access_token e refresh_token completos."
    );
  }

  const obtainedAt =
    Date.now();

  const expiresIn =
    Number(
      tokenData.expires_in ||
      0
    );

  return {
    access_token:
      tokenData.access_token,

    refresh_token:
      tokenData.refresh_token,

    token_type:
      tokenData.token_type ||
      "bearer",

    expires_in:
      expiresIn,

    expires_at:
      obtainedAt +
      expiresIn *
        1000,

    obtained_at:
      obtainedAt,

    scope:
      tokenData.scope ||
      "",

    user_id:
      tokenData.user_id ??
      null,

    source
  };
}

function safeMetadata(
  record
) {
  if (!record) {
    return null;
  }

  return {
    connected:
      true,

    userId:
      record.user_id,

    scope:
      record.scope,

    obtainedAt:
      record.obtained_at,

    expiresAt:
      record.expires_at,

    expiresInSeconds:
      record.expires_in,

    source:
      record.source,

    remainingSeconds:
      Math.max(
        0,
        Math.floor(
          (
            record.expires_at -
            Date.now()
          ) /
          1000
        )
      )
  };
}

export async function saveMlTokenData(
  tokenData,
  source = "oauth"
) {
  const record =
    normalizeTokenData(
      tokenData,
      source
    );

  const encrypted =
    encryptJson(
      record
    );

  await supabaseRequest(
    "tt_ml_tokens?on_conflict=provider",
    {
      method:
        "POST",

      body: {
        provider:
          TOKEN_PROVIDER,

        token_envelope:
          encrypted
      },

      prefer:
        "resolution=merge-duplicates,return=minimal"
    }
  );

  return safeMetadata(
    record
  );
}

export async function loadLatestMlTokenData() {
  const {
    payload
  } =
    await supabaseRequest(
      "tt_ml_tokens" +
      "?provider=eq.mercadolivre" +
      "&select=token_envelope" +
      "&limit=1"
    );

  if (
    !Array.isArray(
      payload
    ) ||
    payload.length ===
      0
  ) {
    return null;
  }

  const encrypted =
    payload[0]
      ?.token_envelope;

  if (!encrypted) {
    throw new Error(
      "O registro do token no Supabase não possui token_envelope."
    );
  }

  try {
    return decryptJson(
      encrypted
    );
  } catch (error) {
    throw new Error(
      "O token armazenado no Supabase não pôde ser descriptografado: " +
      (
        error?.message ||
        "erro desconhecido"
      )
    );
  }
}

async function claimRefreshToken(
  refreshToken
) {
  const hash =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        refreshToken
      )
      .digest(
        "hex"
      );

  const {
    payload
  } =
    await supabaseRequest(
      "tt_ml_refresh_locks?on_conflict=refresh_hash",
      {
        method:
          "POST",

        body: {
          refresh_hash:
            hash,

          claimed_at:
            new Date()
              .toISOString()
        },

        prefer:
          "resolution=ignore-duplicates,return=representation"
      }
    );

  return (
    Array.isArray(
      payload
    ) &&
    payload.length >
      0
  );
}

async function exchangeRefreshToken(
  record
) {
  const clientId =
    process.env
      .ML_CLIENT_ID;

  const clientSecret =
    process.env
      .ML_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Faltam ML_CLIENT_ID e/ou ML_CLIENT_SECRET no Vercel."
    );
  }

  const claimed =
    await claimRefreshToken(
      record.refresh_token
    );

  if (!claimed) {
    // Outra execução provavelmente já está renovando
    // este mesmo refresh_token.
    for (
      let attempt = 0;
      attempt < 8;
      attempt += 1
    ) {
      await sleep(
        1000
      );

      const latest =
        await loadLatestMlTokenData();

      if (
        latest &&
        latest.refresh_token !==
          record.refresh_token &&
        latest.expires_at >
          Date.now()
      ) {
        return latest;
      }
    }

    throw new Error(
      "Outro processo iniciou a renovação do token, mas o novo token " +
      "ainda não apareceu no Supabase."
    );
  }

  const body =
    new URLSearchParams({
      grant_type:
        "refresh_token",

      client_id:
        clientId,

      client_secret:
        clientSecret,

      refresh_token:
        record.refresh_token
    });

  const response =
    await fetch(
      "https://api.mercadolibre.com/oauth/token",
      {
        method:
          "POST",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(
        text
      );
  } catch {
    data = {
      raw:
        text
    };
  }

  if (
    !response.ok ||
    !data.access_token ||
    !data.refresh_token
  ) {
    throw new Error(
      `Falha ao renovar token do Mercado Livre (HTTP ${response.status}): ` +
      `${
        data?.error ||
        data?.message ||
        "erro desconhecido"
      }`
    );
  }

  await saveMlTokenData(
    data,
    "refresh_token"
  );

  return normalizeTokenData(
    data,
    "refresh_token"
  );
}

export async function getValidMlTokenData(
  options = {}
) {
  const minValidityMs =
    options.minValidityMs ??
    DEFAULT_MIN_VALIDITY_MS;

  const record =
    await loadLatestMlTokenData();

  if (!record) {
    throw new Error(
      "Ainda não existe token persistido no Supabase. " +
      "Faça o OAuth por /api/login primeiro."
    );
  }

  if (
    record.expires_at -
      Date.now() >
    minValidityMs
  ) {
    return record;
  }

  return exchangeRefreshToken(
    record
  );
}

export async function getMlTokenStatus() {
  const record =
    await loadLatestMlTokenData();

  if (!record) {
    return {
      connected:
        false,

      storage:
        "supabase",

      message:
        "Nenhum token persistido no Supabase ainda."
    };
  }

  return {
    ...safeMetadata(
      record
    ),

    storage:
      "supabase",

    expired:
      record.expires_at <=
      Date.now(),

    refreshAvailable:
      Boolean(
        record.refresh_token
      )
  };
}
