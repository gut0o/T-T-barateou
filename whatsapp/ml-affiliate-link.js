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

function isAllowedProductUrl(
  url,
  productId
) {
  const value =
    String(
      url ||
      ""
    ).trim();

  if (!value) {
    return false;
  }

  if (
    !/mercadolivre\.com\.br/i.test(
      value
    )
  ) {
    return false;
  }

  // Nunca enviar páginas intermediárias/conta para createLink.
  if (
    /\/gz\/account-verification/i.test(
      value
    ) ||
    /\/login/i.test(
      value
    ) ||
    /\/registration/i.test(
      value
    )
  ) {
    return false;
  }

  if (
    productId &&
    !value.includes(
      productId
    )
  ) {
    return false;
  }

  return true;
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

            // Agora usamos a mesma sessão do afiliado ao abrir a página.
            Cookie:
              env(
                "ML_AFFILIATE_COOKIE"
              ),

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
      isAllowedProductUrl(
        finalUrl,
        productId
      )
    ) {
      return {
        url:
          finalUrl,

        mode:
          finalUrl !== initial
            ? "authenticated_redirect_resolved"
            : "authenticated_original_url",

        httpStatus:
          response.status
      };
    }

    // Se o Mercado Livre mandar para account-verification/login,
    // NÃO usamos a URL final. Voltamos para /p/PRODUCT_ID.
    return {
      url:
        initial,

      mode:
        "blocked_redirect_ignored",

      httpStatus:
        response.status,

      rejectedFinalUrl:
        finalUrl
    };
  } catch {
    return {
      url:
        initial,

      mode:
        "initial_url_fallback",

      httpStatus:
        null
    };
  }
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

function uniqueStrings(
  values
) {
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            String(value || "")
              .trim()
        )
        .filter(Boolean)
    )
  );
}

function extractShortUrl(
  body
) {
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

  const direct =
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
          typeof direct === "string" &&
          direct.startsWith(
            "https://meli.la/"
          )
            ? direct
            : null
        );

  return {
    shortUrl,
    first,
    candidates
  };
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

  const initial =
    initialCatalogUrl({
      productId,
      catalogPageUrl
    });

  // Tentamos primeiro a URL canônica autenticada, se for válida.
  // Depois tentamos a URL simples /p/PRODUCT_ID.
  //
  // Isso replica melhor o comportamento observado no navegador e
  // evita enviar /gz/account-verification ao programa de afiliados.
  const targetCandidates =
    uniqueStrings([
      isAllowedProductUrl(
        canonical.url,
        productId
      )
        ? canonical.url
        : null,

      initial,

      productId
        ? `https://www.mercadolivre.com.br/p/${productId}`
        : null
    ]);

  const attempts =
    [];

  for (
    const targetCandidate of
    targetCandidates
  ) {
    const targetUrl =
      urlForAffiliatePayload(
        targetCandidate
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

    const parsed =
      extractShortUrl(
        body
      );

    const safeEntries =
      parsed.candidates
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

    attempts.push({
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

      targetUrl,

      entries:
        safeEntries
    });

    if (
      response.ok &&
      parsed.shortUrl
    ) {
      return {
        ok:
          true,

        shortUrl:
          parsed.shortUrl,

        originUrl:
          parsed.first?.origin_url ||
          parsed.first?.originUrl ||
          body?.origin_url ||
          body?.originUrl ||
          null,

        generatedTag:
          parsed.first?.tag ||
          body?.tag ||
          tag,

        id:
          parsed.first?.id ||
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

        successfulTargetUrl:
          targetUrl,

        attemptCount:
          attempts.length,

        requestPayload: {
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
  }

  const diagnostic =
    JSON.stringify({
      canonicalMode:
        canonical.mode,

      canonicalHttpStatus:
        canonical.httpStatus,

      rejectedRedirect:
        canonical
          .rejectedFinalUrl
          ? (
              /account-verification/i.test(
                canonical.rejectedFinalUrl
              )
                ? "account_verification"
                : "other"
            )
          : null,

      attempts
    });

  throw new Error(
    `createLink não gerou short_url após ${attempts.length} tentativa(s). Diagnóstico seguro: ${diagnostic}`
  );
}
