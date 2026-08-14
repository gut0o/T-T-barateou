// T&T Barateou — geração LOCAL de link afiliado.
//
// ATENÇÃO:
// Este recurso usa o endpoint interno observado na Central de Afiliados.
// Não é uma API pública/documentada do Mercado Livre.
//
// As credenciais de sessão ficam SOMENTE no computador local:
//
// ML_AFFILIATE_COOKIE
// ML_AFFILIATE_CSRF_TOKEN
// ML_AFFILIATE_TAG
//
// Nunca coloque esses valores no Git ou no Vercel.

const CREATE_LINK_URL =
  "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink";

function env(name) {
  return String(
    process.env[name] ||
    ""
  ).trim();
}

export function affiliateSessionConfigured() {
  return Boolean(
    env("ML_AFFILIATE_COOKIE") &&
    env("ML_AFFILIATE_CSRF_TOKEN") &&
    env("ML_AFFILIATE_TAG")
  );
}

export function affiliateSessionStatus() {
  return {
    configured:
      affiliateSessionConfigured(),

    cookieConfigured:
      Boolean(
        env(
          "ML_AFFILIATE_COOKIE"
        )
      ),

    csrfConfigured:
      Boolean(
        env(
          "ML_AFFILIATE_CSRF_TOKEN"
        )
      ),

    tagConfigured:
      Boolean(
        env(
          "ML_AFFILIATE_TAG"
        )
      )
  };
}

function normalizeCatalogUrl({
  productId,
  catalogPageUrl
}) {
  const raw =
    String(
      catalogPageUrl ||
      (
        productId
          ? `https://www.mercadolivre.com.br/p/${productId}`
          : ""
      )
    ).trim();

  if (!raw) {
    throw new Error(
      "Não existe URL de catálogo para gerar o link afiliado."
    );
  }

  // O payload observado na interface enviava a URL sem protocolo.
  return raw
    .replace(
      /^https?:\/\//i,
      ""
    )
    .replace(
      /^\/+/,
      ""
    );
}

export class AffiliateSessionError extends Error {
  constructor(
    message,
    statusCode = null
  ) {
    super(message);
    this.name =
      "AffiliateSessionError";

    this.statusCode =
      statusCode;
  }
}

export async function createAffiliateLink({
  itemId,
  productId,
  catalogPageUrl
}) {
  if (
    !affiliateSessionConfigured()
  ) {
    throw new AffiliateSessionError(
      "Sessão de afiliados não configurada. Defina ML_AFFILIATE_COOKIE, ML_AFFILIATE_CSRF_TOKEN e ML_AFFILIATE_TAG."
    );
  }

  const safeItemId =
    String(
      itemId ||
      ""
    )
      .trim()
      .toUpperCase();

  if (
    !/^MLB\d+$/.test(
      safeItemId
    )
  ) {
    throw new Error(
      "itemId inválido para createLink."
    );
  }

  const tag =
    env(
      "ML_AFFILIATE_TAG"
    );

  const targetUrl =
    normalizeCatalogUrl({
      productId,
      catalogPageUrl
    });

  const payload = {
    itemId:
      safeItemId,

    itemAddToList:
      safeItemId,

    buyBoxWinner:
      safeItemId,

    tag,

    type:
      "product",

    extraCommission:
      "true",

    urls: [
      targetUrl
    ]
  };

  const response =
    await fetch(
      CREATE_LINK_URL,
      {
        method:
          "POST",

        headers: {
          Accept:
            "application/json, text/plain, */*",

          "Accept-Language":
            "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",

          "Content-Type":
            "application/json",

          Cookie:
            env(
              "ML_AFFILIATE_COOKIE"
            ),

          "X-Csrf-Token":
            env(
              "ML_AFFILIATE_CSRF_TOKEN"
            ),

          Origin:
            "https://www.mercadolivre.com.br",

          Referer:
            "https://www.mercadolivre.com.br/",

          "User-Agent":
            env(
              "ML_AFFILIATE_USER_AGENT"
            ) ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

  let body =
    null;

  try {
    body =
      await response.json();
  } catch {
    body =
      null;
  }

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    throw new AffiliateSessionError(
      "A sessão de afiliados foi recusada pelo Mercado Livre. Atualize Cookie e X-Csrf-Token localmente.",
      response.status
    );
  }

  if (!response.ok) {
    throw new Error(
      body?.message ||
      body?.error ||
      `createLink respondeu HTTP ${response.status}.`
    );
  }

  const first =
    Array.isArray(
      body?.urls
    )
      ? body.urls.find(
          (entry) =>
            typeof entry
              ?.short_url ===
              "string" &&
            entry.short_url
              .startsWith(
                "https://meli.la/"
              )
        )
      : null;

  if (!first) {
    throw new Error(
      "createLink respondeu sem short_url meli.la."
    );
  }

  return {
    ok:
      true,

    shortUrl:
      first.short_url,

    originUrl:
      first.origin_url ||
      null,

    generatedTag:
      first.tag ||
      tag,

    id:
      first.id ||
      null,

    totalSuccess:
      body?.total_success ??
      null,

    totalError:
      body?.total_error ??
      null,

    requestPayload: {
      // Mantemos somente campos não secretos para diagnóstico.
      itemId:
        safeItemId,

      productId:
        productId ||
        null,

      targetUrl,

      type:
        "product"
    }
  };
}
