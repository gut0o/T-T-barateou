// T&T Barateou — Etapa 6.18Y
// Descoberta contínua pelo buscador oficial de produtos de catálogo.

const SITE_ID = "MLB";
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 10;

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export async function discoverCatalogProducts({
  accessToken,
  query,
  offset = 0,
  limit = DEFAULT_LIMIT
}) {
  if (!accessToken) {
    throw new Error("Access token do Mercado Livre não está disponível.");
  }

  const q = String(query || "").trim();
  if (!q) {
    const error = new Error("catalogQuery vazio.");
    error.statusCode = 400;
    throw error;
  }

  const safeOffset = clampInt(offset, 0, 1000000, 0);
  const safeLimit = clampInt(limit, 1, MAX_LIMIT, DEFAULT_LIMIT);

  const url = new URL("https://api.mercadolibre.com/products/search");
  url.searchParams.set("status", "active");
  url.searchParams.set("site_id", SITE_ID);
  url.searchParams.set("q", q);
  url.searchParams.set("offset", String(safeOffset));
  url.searchParams.set("limit", String(safeLimit));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("A busca de catálogo excedeu 15 segundos.");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    return {
      ok: false,
      source: "mercadolivre_products_search",
      query: q,
      offset: safeOffset,
      limit: safeLimit,
      httpStatus: response.status,
      resetSuggested: safeOffset > 0 && [400, 404].includes(response.status),
      error:
        payload?.message ||
        payload?.error ||
        `Mercado Livre HTTP ${response.status}`,
      accessTokenExposed: false,
      refreshTokenExposed: false
    };
  }

  const results = Array.isArray(payload?.results) ? payload.results : [];
  const paging = {
    total: Number.isFinite(Number(payload?.paging?.total))
      ? Number(payload.paging.total)
      : null,
    offset: Number.isFinite(Number(payload?.paging?.offset))
      ? Number(payload.paging.offset)
      : safeOffset,
    limit: Number.isFinite(Number(payload?.paging?.limit))
      ? Number(payload.paging.limit)
      : safeLimit
  };

  const candidates = results
    .map((product, index) => ({
      id: product?.id || null,
      position: safeOffset + index + 1,
      type: "PRODUCT",
      searchName: product?.name || null,
      domainId: product?.domain_id || null
    }))
    .filter((candidate) => /^MLB\d+$/i.test(String(candidate.id || "")));

  return {
    ok: true,
    source: "mercadolivre_products_search",
    query: q,
    paging,
    resultCount: results.length,
    candidates,
    accessTokenExposed: false,
    refreshTokenExposed: false
  };
}
