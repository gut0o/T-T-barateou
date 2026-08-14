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

function initialCatalogUrl({
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

  return /^https?:\/\//i.test(
    raw
  )
    ? raw
    : `https://${raw.replace(/^\/+/, "")}`;
}

async function resolveCanonicalProductUrl({
  productId,
  catalogPageUrl
}) {
  const initial =
    initialCatalogUrl({
      productId,
      catalogPageUrl
    });

  try {
    const response =
      await fetch(
        initial,
        {
          method:
            "GET",

          redirect:
            "follow",

          headers: {
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

            "Accept-Language":
              "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",

            "User-Agent":
              env(
                "ML_AFFILIATE_USER_AGENT"
              ) ||
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
          }
        }
      );

    const finalUrl =
      String(
        response.url ||
        initial
      ).trim();

    if (
      finalUrl &&
      /mercadolivre\.com\.br/i.test(
        finalUrl
      )
    ) {
      return {
        url:
          finalUrl,

        mode:
          finalUrl !== initial
            ? "redirect_resolved"
            : "original_url",

        httpStatus:
          response.status
      };
    }
  } catch {
    // Fallback seguro para a URL inicial.
  }

  return {
    url:
      initial,

    mode:
      "initial_url_fallback",

    httpStatus:
      null
  };
}

function urlForAffiliatePayload(
  url
) {
  return String(
    url ||
    ""
  )
    .trim()
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

  const canonical =
    await resolveCanonicalProductUrl({
      productId,
      catalogPageUrl
    });

  const targetUrl =
    urlForAffiliatePayload(
      canonical.url
    );

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

  const candidates = [
    ...(
      Array.isArray(
        body?.urls
      )
        ? body.urls
        : []
    ),

    ...(
      Array.isArray(
        body?.data?.urls
      )
        ? body.data.urls
        : []
    )
  ];

  const first =
    candidates.find(
      (entry) => {
        const value =
          entry?.short_url ||
          entry?.shortUrl ||
          entry?.url ||
          null;

        return (
          typeof value === "string" &&
          value.startsWith(
            "https://meli.la/"
          )
        );
      }
    ) ||
    null;

  const directShortUrl =
    body?.short_url ||
    body?.shortUrl ||
    body?.data?.short_url ||
    body?.data?.shortUrl ||
    null;

  const shortUrl =
    first
      ? (
          first.short_url ||
          first.shortUrl ||
          first.url
        )
      : (
          typeof directShortUrl === "string" &&
          directShortUrl.startsWith(
            "https://meli.la/"
          )
            ? directShortUrl
            : null
        );

  if (!shortUrl) {
    const safeEntries =
      candidates
        .slice(
          0,
          3
        )
        .map(
          (entry) => ({
            id:
              entry?.id ||
              null,

            created:
              entry?.created ??
              null,

            hasShortUrl:
              Boolean(
                entry?.short_url ||
                entry?.shortUrl
              ),

            typeUrl:
              entry?.type_url ||
              null,

            error:
              entry?.error ||
              entry?.message ||
              null
          })
        );

    const diagnostic =
      JSON.stringify({
        httpStatus:
          response.status,

        responseStatus:
          body?.status ??
          null,

        totalSuccess:
          body?.total_success ??
          body?.totalSuccess ??
          null,

        totalError:
          body?.total_error ??
          body?.totalError ??
          null,

        canonicalMode:
          canonical.mode,

        canonicalHttpStatus:
          canonical.httpStatus,

        targetUrl,

        entries:
          safeEntries
      });

    throw new Error(
      `createLink respondeu sem short_url meli.la. Diagnóstico seguro: ${diagnostic}`
    );
  }

  return {
    ok:
      true,

    shortUrl,

    originUrl:
      first?.origin_url ||
      first?.originUrl ||
      body?.origin_url ||
      body?.originUrl ||
      null,

    generatedTag:
      first?.tag ||
      body?.tag ||
      tag,

    id:
      first?.id ||
      body?.id ||
      null,

    totalSuccess:
      body?.total_success ??
      body?.totalSuccess ??
      null,

    totalError:
      body?.total_error ??
      body?.totalError ??
      null,

    canonicalResolution: {
      mode:
        canonical.mode,

      httpStatus:
        canonical.httpStatus
    },

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
