import { getValidMlTokenData } from "../lib/ml-token-store.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

const MAX_HTML_SIZE = 4_000_000;
const MAX_CANDIDATES_TO_TEST = 18;

function isAllowedInitialHost(hostname) {
  const host = String(hostname || "").toLowerCase();

  return (
    host === "meli.la" ||
    host === "www.meli.la" ||
    host === "mercadolivre.com.br" ||
    host === "www.mercadolivre.com.br" ||
    host === "mercadolibre.com" ||
    host === "www.mercadolibre.com"
  );
}

function isAllowedResolvedHost(hostname) {
  const host = String(hostname || "").toLowerCase();

  return (
    host === "meli.la" ||
    host.endsWith(".meli.la") ||
    host === "mercadolivre.com.br" ||
    host.endsWith(".mercadolivre.com.br") ||
    host === "mercadolibre.com" ||
    host.endsWith(".mercadolibre.com")
  );
}

function validateAffiliateLink(rawLink) {
  if (!rawLink || typeof rawLink !== "string") {
    throw new Error(
      "Informe o link. Exemplo: /api/offer?link=https://meli.la/SEU_LINK"
    );
  }

  if (rawLink.length > 2048) {
    throw new Error("O link é grande demais.");
  }

  let url;

  try {
    url = new URL(rawLink);
  } catch {
    throw new Error("O parâmetro link não é uma URL válida.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("O link precisa começar com http:// ou https://.");
  }

  if (!isAllowedInitialHost(url.hostname)) {
    throw new Error(
      "Por segurança, este endpoint aceita somente links do Mercado Livre ou meli.la."
    );
  }

  return url.toString();
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x2F;", "/")
    .replaceAll("\\/", "/")
    .replaceAll("\\u002F", "/")
    .replaceAll("\\u003A", ":")
    .replaceAll("\\u0026", "&");
}

function normalizeMlb(value) {
  const match = String(value || "").match(/MLB-?(\d{6,})/i);

  return match
    ? `MLB${match[1]}`.toUpperCase()
    : null;
}

function addCandidate(
  map,
  id,
  type,
  source,
  evidence = "",
  score = 0
) {
  const normalized = normalizeMlb(id);
  if (!normalized) return;

  const key = `${type}:${normalized}`;

  if (!map.has(key)) {
    map.set(key, {
      id: normalized,
      type,
      score,
      sources: [],
      evidence: []
    });
  }

  const candidate = map.get(key);
  candidate.score = Math.max(candidate.score, score);

  if (!candidate.sources.includes(source)) {
    candidate.sources.push(source);
  }

  if (evidence && candidate.evidence.length < 2) {
    candidate.evidence.push(
      String(evidence).replace(/\s+/g, " ").slice(0, 240)
    );
  }
}

function collectUrls(html, finalUrl) {
  const urls = new Set();

  if (finalUrl) {
    urls.add(finalUrl);
  }

  const normalizedHtml = decodeHtmlEntities(html);

  const tagPatterns = [
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/gi,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["']/gi,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/gi,
    /<meta[^>]+name=["']twitter:url["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:url["']/gi
  ];

  for (const pattern of tagPatterns) {
    for (const match of normalizedHtml.matchAll(pattern)) {
      if (match[1]) {
        urls.add(match[1]);
      }
    }
  }

  const urlPattern =
    /https?:\/\/(?:[^"'<>\\\s]+\.)?(?:mercadolivre\.com\.br|mercadolibre\.com)[^"'<>\\\s]*/gi;

  for (const match of normalizedHtml.matchAll(urlPattern)) {
    urls.add(match[0]);

    if (urls.size >= 100) {
      break;
    }
  }

  return [...urls];
}

function collectCandidates(html, finalUrl) {
  const candidates = new Map();
  const urls = collectUrls(html, finalUrl);

  // O endereço efetivamente resolvido tem prioridade máxima.
  const directCatalog =
    String(finalUrl || "").match(/\/p\/(MLB-?\d{6,})/i);

  if (directCatalog) {
    addCandidate(
      candidates,
      directCatalog[1],
      "product",
      "URL final /p/",
      finalUrl,
      100
    );
  }

  const directItem =
    String(finalUrl || "").match(/MLB-?(\d{6,})/i);

  if (directItem && !directCatalog) {
    addCandidate(
      candidates,
      `MLB${directItem[1]}`,
      "item",
      "URL final",
      finalUrl,
      95
    );
  }

  for (const urlText of urls) {
    const cleanUrl = decodeHtmlEntities(urlText);

    const catalogMatch =
      cleanUrl.match(/\/p\/(MLB-?\d{6,})/i);

    if (catalogMatch) {
      addCandidate(
        candidates,
        catalogMatch[1],
        "product",
        "URL /p/",
        cleanUrl,
        90
      );
    }

    // IDs presentes em URLs de anúncio.
    // Se for exatamente o ID do /p/, não duplicamos como item.
    for (
      const match of cleanUrl.matchAll(/MLB-?(\d{6,})/gi)
    ) {
      const id = `MLB${match[1]}`;

      if (
        !catalogMatch ||
        normalizeMlb(catalogMatch[1]) !== normalizeMlb(id)
      ) {
        addCandidate(
          candidates,
          id,
          "item",
          "URL Mercado Livre",
          cleanUrl,
          45
        );
      }
    }
  }

  const normalizedHtml = decodeHtmlEntities(html);

  const structuredPatterns = [
    {
      type: "product",
      source: "catalog_product_id",
      score: 88,
      regex:
        /["']catalog_product_id["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    },
    {
      type: "product",
      source: "catalogProductId",
      score: 88,
      regex:
        /["']catalogProductId["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    },
    {
      type: "product",
      source: "product_id",
      score: 82,
      regex:
        /["']product_id["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    },
    {
      type: "product",
      source: "productId",
      score: 82,
      regex:
        /["']productId["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    },
    {
      type: "item",
      source: "item_id",
      score: 70,
      regex:
        /["']item_id["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    },
    {
      type: "item",
      source: "itemId",
      score: 70,
      regex:
        /["']itemId["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    }
  ];

  for (
    const {
      type,
      source,
      score,
      regex
    } of structuredPatterns
  ) {
    for (const match of normalizedHtml.matchAll(regex)) {
      const start = Math.max(0, match.index - 80);
      const end = Math.min(
        normalizedHtml.length,
        match.index + match[0].length + 120
      );

      addCandidate(
        candidates,
        match[1],
        type,
        source,
        normalizedHtml.slice(start, end),
        score
      );

      if (candidates.size >= 50) {
        break;
      }
    }
  }

  return [...candidates.values()].sort(
    (a, b) => b.score - a.score
  );
}

async function resolveAffiliateLink(link) {
  const response = await fetch(link, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Ao resolver o link, o Mercado Livre respondeu HTTP ${response.status}.`
    );
  }

  const finalUrl = response.url;

  let finalParsed;
  try {
    finalParsed = new URL(finalUrl);
  } catch {
    throw new Error(
      "O Mercado Livre retornou uma URL final inválida."
    );
  }

  if (!isAllowedResolvedHost(finalParsed.hostname)) {
    throw new Error(
      "O link redirecionou para um domínio fora do Mercado Livre."
    );
  }

  const contentLength =
    Number(response.headers.get("content-length")) || 0;

  if (contentLength > MAX_HTML_SIZE) {
    throw new Error(
      "A página resolvida é grande demais para analisar."
    );
  }

  const html = await response.text();

  if (html.length > MAX_HTML_SIZE) {
    throw new Error(
      "A página resolvida é grande demais para analisar."
    );
  }

  const candidates =
    collectCandidates(html, finalUrl);

  if (!candidates.length) {
    throw new Error(
      "Não consegui identificar nenhum ID de produto/anúncio nesse link."
    );
  }

  return {
    finalUrl,
    candidates
  };
}

async function mlRequest(path, accessToken) {
  const response = await fetch(
    `https://api.mercadolibre.com${path}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

function firstImage(data) {
  return (
    data?.pictures?.[0]?.secure_url ||
    data?.pictures?.[0]?.url ||
    data?.secure_thumbnail ||
    data?.thumbnail ||
    null
  );
}

function titleOf(data) {
  return (
    data?.title ||
    data?.name ||
    data?.short_description?.content ||
    null
  );
}

async function getCatalogOffer(product, accessToken) {
  let offer = product?.buy_box_winner || null;
  let priceSource =
    offer?.item_id ? "buy_box_winner" : null;

  if (!offer?.item_id && product?.id) {
    const competition = await mlRequest(
      `/products/${encodeURIComponent(product.id)}/items`,
      accessToken
    );

    if (
      competition.ok &&
      Array.isArray(competition.data?.results)
    ) {
      const results = competition.data.results;

      const priced = results
        .filter(
          (item) => typeof item?.price === "number"
        )
        .sort((a, b) => a.price - b.price);

      offer = priced[0] || results[0] || null;

      if (offer) {
        priceSource = "products_items_fallback";
      }
    }
  }

  let price =
    typeof offer?.price === "number"
      ? offer.price
      : typeof product?.price === "number"
        ? product.price
        : null;

  let originalPrice =
    typeof offer?.original_price === "number"
      ? offer.original_price
      : typeof product?.original_price === "number"
        ? product.original_price
        : null;

  let currency =
    offer?.currency_id ||
    product?.currency_id ||
    "BRL";

  const itemId = offer?.item_id || null;

  // Tenta enriquecer com sale_price.
  // Se a API bloquear este item, mantemos o preço acima.
  if (itemId) {
    const salePrice = await mlRequest(
      `/items/${encodeURIComponent(itemId)}/sale_price?context=channel_marketplace`,
      accessToken
    );

    if (salePrice.ok) {
      if (typeof salePrice.data?.amount === "number") {
        price = salePrice.data.amount;
      }

      if (
        typeof salePrice.data?.regular_amount === "number"
      ) {
        originalPrice =
          salePrice.data.regular_amount;
      }

      currency =
        salePrice.data?.currency_id || currency;

      priceSource =
        `${priceSource || "catalog"}+sale_price`;
    }
  }

  return {
    itemId,
    price,
    originalPrice,
    currency,
    priceSource
  };
}

async function testProductCandidate(
  candidate,
  accessToken
) {
  const result = await mlRequest(
    `/products/${encodeURIComponent(candidate.id)}`,
    accessToken
  );

  if (!result.ok) {
    return null;
  }

  const product = result.data;

  const image = firstImage(product);
  const title = titleOf(product);

  // Um retorno 200 só é útil se parecer de fato um produto.
  if (!product?.id || (!title && !image)) {
    return null;
  }

  const offer = await getCatalogOffer(
    product,
    accessToken
  );

  return {
    resolutionType: "product",
    sourceId: product.id,
    productId: product.id,
    itemId: offer.itemId,
    title,
    image,
    price: offer.price,
    originalPrice: offer.originalPrice,
    currency: offer.currency,
    priceSource: offer.priceSource
  };
}

async function testItemCandidate(
  candidate,
  accessToken
) {
  const result = await mlRequest(
    `/items/${encodeURIComponent(candidate.id)}`,
    accessToken
  );

  if (!result.ok) {
    return null;
  }

  const item = result.data;
  const image = firstImage(item);
  const title = titleOf(item);

  if (!item?.id || (!title && !image)) {
    return null;
  }

  // Quando existe catalog_product_id, preferimos os dados
  // ricos do catálogo, mas mantemos o item como fallback.
  if (item.catalog_product_id) {
    const catalogCandidate = {
      id: item.catalog_product_id,
      type: "product"
    };

    const catalog = await testProductCandidate(
      catalogCandidate,
      accessToken
    );

    if (catalog) {
      return {
        ...catalog,
        itemId: catalog.itemId || item.id
      };
    }
  }

  return {
    resolutionType: "item",
    sourceId: item.id,
    productId: item.catalog_product_id || null,
    itemId: item.id,
    title,
    image,
    price:
      typeof item.price === "number"
        ? item.price
        : null,
    originalPrice:
      typeof item.original_price === "number"
        ? item.original_price
        : null,
    currency: item.currency_id || "BRL",
    priceSource: "item"
  };
}

async function findOffer(
  candidates,
  accessToken
) {
  const attempts = [];

  for (
    const candidate of candidates.slice(
      0,
      MAX_CANDIDATES_TO_TEST
    )
  ) {
    try {
      const offer =
        candidate.type === "product"
          ? await testProductCandidate(
              candidate,
              accessToken
            )
          : await testItemCandidate(
              candidate,
              accessToken
            );

      attempts.push({
        id: candidate.id,
        type: candidate.type,
        success: Boolean(offer)
      });

      if (offer) {
        return {
          offer,
          matchedCandidate: candidate,
          attempts
        };
      }
    } catch (error) {
      attempts.push({
        id: candidate.id,
        type: candidate.type,
        success: false,
        error: error?.message || "erro"
      });
    }
  }

  return {
    offer: null,
    matchedCandidate: null,
    attempts
  };
}

function calculateDiscount(price, originalPrice) {
  if (
    typeof price !== "number" ||
    typeof originalPrice !== "number" ||
    originalPrice <= price ||
    originalPrice <= 0
  ) {
    return null;
  }

  return Math.round(
    ((originalPrice - price) / originalPrice) * 100
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      ok: false,
      error: "Use GET."
    });
  }

  try {
    const rawLink = Array.isArray(req.query?.link)
      ? req.query.link[0]
      : req.query?.link;

    const affiliateLink =
      validateAffiliateLink(rawLink);

    const tokenData =
      await getValidMlTokenData();

    const resolved =
      await resolveAffiliateLink(affiliateLink);

    const found = await findOffer(
      resolved.candidates,
      tokenData.access_token
    );

    if (!found.offer) {
      return res.status(404).json({
        ok: false,
        error:
          "Consegui abrir o link, mas não consegui identificar um produto consultável pela API do Mercado Livre.",
        affiliateLink,
        resolvedUrl: resolved.finalUrl,
        accessTokenExposed: false,
        refreshTokenExposed: false
      });
    }

    const offer = found.offer;

    if (!offer.image) {
      return res.status(502).json({
        ok: false,
        error:
          "O produto foi identificado, mas a API não retornou imagem.",
        affiliateLink,
        resolvedUrl: resolved.finalUrl,
        productId: offer.productId,
        itemId: offer.itemId,
        accessTokenExposed: false,
        refreshTokenExposed: false
      });
    }

    const discount = calculateDiscount(
      offer.price,
      offer.originalPrice
    );

    return res.status(200).json({
      ok: true,

      // Link que o usuário forneceu: é este que iremos
      // preservar na futura mensagem do WhatsApp.
      affiliateLink,

      // Útil para diagnóstico; não substitui o link afiliado.
      resolvedUrl: resolved.finalUrl,

      resolutionType: offer.resolutionType,
      sourceId: offer.sourceId,
      productId: offer.productId,
      itemId: offer.itemId,

      title: offer.title,
      image: offer.image,

      price: offer.price,
      originalPrice: offer.originalPrice,
      discount,
      currency: offer.currency,
      priceSource: offer.priceSource,

      accessTokenExposed: false,
      refreshTokenExposed: false
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error:
        error?.message || "Erro desconhecido.",
      accessTokenExposed: false,
      refreshTokenExposed: false
    });
  }
}
