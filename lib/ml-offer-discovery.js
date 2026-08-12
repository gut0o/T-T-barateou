// T&T Barateou — Etapa 6.8A
//
// Primeira prova de descoberta:
// buscar candidatos diretamente nas listagens do Mercado Livre,
// sem o usuário fornecer um link de produto.
//
// Nesta etapa:
// - NÃO cria link de afiliado;
// - NÃO envia ao WhatsApp;
// - NÃO decide publicação;
// - apenas devolve candidatos encontrados.

const SITE_ID = "MLB";
const MAX_LIMIT = 10;
const DEFAULT_LIMIT = 5;
const DEFAULT_QUERY = "smartphone";

function clampLimit(value) {
  const parsed =
    Number.parseInt(
      String(value || ""),
      10
    );

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.max(parsed, 1),
    MAX_LIMIT
  );
}

function normalizeQuery(value) {
  const query =
    String(value || "")
      .trim()
      .replace(/\s+/g, " ");

  if (!query) {
    return DEFAULT_QUERY;
  }

  if (query.length > 100) {
    throw new Error(
      "A busca deve ter no máximo 100 caracteres."
    );
  }

  return query;
}

function calculateDiscount(
  price,
  originalPrice
) {
  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    typeof originalPrice !== "number" ||
    !Number.isFinite(originalPrice) ||
    originalPrice <= price ||
    originalPrice <= 0
  ) {
    return null;
  }

  return Math.round(
    (
      (originalPrice - price) /
      originalPrice
    ) * 100
  );
}

function normalizeResult(item) {
  const price =
    typeof item?.price === "number"
      ? item.price
      : null;

  const originalPrice =
    typeof item?.original_price === "number"
      ? item.original_price
      : null;

  return {
    itemId:
      item?.id || null,

    title:
      item?.title || null,

    price,

    originalPrice,

    discount:
      calculateDiscount(
        price,
        originalPrice
      ),

    currency:
      item?.currency_id || "BRL",

    permalink:
      item?.permalink || null,

    thumbnail:
      item?.thumbnail || null,

    categoryId:
      item?.category_id || null,

    domainId:
      item?.domain_id || null,

    sellerId:
      item?.seller?.id ||
      item?.seller_id ||
      null,

    freeShipping:
      item?.shipping?.free_shipping === true
  };
}

async function readErrorDetail(
  response
) {
  try {
    const data =
      await response.json();

    return {
      message:
        data?.message ||
        data?.error ||
        null,

      error:
        data?.error || null,

      cause:
        Array.isArray(data?.cause)
          ? data.cause
          : null
    };
  } catch {
    try {
      const text =
        await response.text();

      return {
        message:
          String(text || "")
            .replace(/\s+/g, " ")
            .slice(0, 500) ||
          null,

        error: null,
        cause: null
      };
    } catch {
      return {
        message: null,
        error: null,
        cause: null
      };
    }
  }
}

export async function discoverMlOffers({
  accessToken,
  query = null,
  limit = null
}) {
  if (!accessToken) {
    throw new Error(
      "Access token do Mercado Livre não está disponível."
    );
  }

  const normalizedQuery =
    normalizeQuery(query);

  const normalizedLimit =
    clampLimit(limit);

  const params =
    new URLSearchParams({
      q: normalizedQuery,
      limit:
        String(normalizedLimit)
    });

  const url =
    `https://api.mercadolibre.com/sites/${SITE_ID}/search?` +
    params.toString();

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      12000
    );

  let response;

  try {
    response =
      await fetch(
        url,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            Accept:
              "application/json"
          },
          signal:
            controller.signal
        }
      );
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "A busca do Mercado Livre excedeu 12 segundos."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail =
      await readErrorDetail(
        response
      );

    return {
      ok: false,

      source:
        "mercadolivre_sites_search",

      query:
        normalizedQuery,

      requestedLimit:
        normalizedLimit,

      httpStatus:
        response.status,

      mlError:
        detail,

      note:
        response.status === 401 ||
        response.status === 403
          ? (
              "O Mercado Livre recusou esta modalidade de busca para a credencial atual. " +
              "Nenhum token foi exposto; a próxima etapa pode trocar a estratégia de descoberta."
            )
          : (
              "O Mercado Livre respondeu com erro ao tentar descobrir candidatos."
            ),

      accessTokenExposed:
        false,

      refreshTokenExposed:
        false
    };
  }

  const data =
    await response.json();

  const rawResults =
    Array.isArray(data?.results)
      ? data.results
      : [];

  const candidates =
    rawResults
      .map(normalizeResult)
      .filter(
        (item) =>
          item.itemId ||
          item.permalink
      );

  return {
    ok: true,

    source:
      "mercadolivre_sites_search",

    query:
      normalizedQuery,

    requestedLimit:
      normalizedLimit,

    resultCount:
      candidates.length,

    paging: {
      total:
        data?.paging?.total ??
        null,

      offset:
        data?.paging?.offset ??
        null,

      limit:
        data?.paging?.limit ??
        normalizedLimit
    },

    candidates,

    discoveryStatus:
      candidates.length
        ? "candidates_found"
        : "no_candidates",

    note:
      "Estes são apenas candidatos de descoberta. Preço, desconto e elegibilidade serão validados antes de qualquer publicação.",

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}
