import { getValidMlTokenData } from "../lib/ml-token-store.js";

import {
  enrichOfferCategoryAndCommission
} from "../lib/ml-offer-category-enrichment.js";

import {
  calculateOfferScore
} from "../lib/offer-scoring.js";

import {
  routeToTtCategory
} from "../lib/tt-category-routing.js";

const USER_AGENTS = {
  desktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  mobile:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36"
};

const MAX_HTML_SIZE = 4_000_000;
const MAX_CANDIDATES_TO_TEST = 30;

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


function safeDecodeURIComponent(value) {
  let current = String(value || "");

  // Há páginas sociais do ML com URLs codificadas mais de uma vez.
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(current);

      if (decoded === current) {
        break;
      }

      current = decoded;
    } catch {
      break;
    }
  }

  return current;
}

function expandNestedEncodedUrls(html) {
  const variants = new Set();
  const base = decodeHtmlEntities(html);

  variants.add(base);

  // Decodifica o documento inteiro uma ou duas vezes.
  // Isso revela padrões como:
  // url=https%3A%2F%2Fproduto.mercadolivre.com.br%2FMLB-...
  let decoded = base;

  for (let i = 0; i < 2; i += 1) {
    const next = safeDecodeURIComponent(decoded);

    if (next === decoded) {
      break;
    }

    variants.add(next);
    decoded = next;
  }

  // Também extrai especificamente parâmetros "url=" presentes
  // em wrappers/deep links como ddnf.adj.st/webview.
  const paramRegex =
    /(?:[?&]|["'])url=([^"'&<>\s]+)/gi;

  for (const source of [...variants]) {
    for (const match of source.matchAll(paramRegex)) {
      if (!match[1]) continue;

      const nested = safeDecodeURIComponent(
        decodeHtmlEntities(match[1])
      );

      if (nested) {
        variants.add(nested);
      }

      if (variants.size >= 40) {
        break;
      }
    }

    if (variants.size >= 40) {
      break;
    }
  }

  return [...variants];
}

function addNestedUrlCandidates(candidates, html) {
  const variants = expandNestedEncodedUrls(html);

  for (const source of variants) {
    // URL direta de anúncio:
    // https://produto.mercadolivre.com.br/MLB-4049279695-...
    const directItemUrlRegex =
      /https?:\/\/(?:produto\.)?mercadolivre\.com\.br\/MLB-?(\d{6,})[^"'<>\\\s]*/gi;

    for (const match of source.matchAll(directItemUrlRegex)) {
      addCandidate(
        candidates,
        `MLB${match[1]}`,
        "item",
        "URL interna decodificada",
        match[0],
        120
      );
    }

    // URL de catálogo /p/MLB...
    const directCatalogUrlRegex =
      /https?:\/\/(?:www\.)?mercadolivre\.com\.br\/[^"'<>\\\s]*\/p\/(MLB-?\d{6,})[^"'<>\\\s]*/gi;

    for (const match of source.matchAll(directCatalogUrlRegex)) {
      addCandidate(
        candidates,
        match[1],
        "product",
        "URL interna de catálogo decodificada",
        match[0],
        125
      );
    }
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

  // Casos de link social podem esconder o anúncio dentro de
  // URLs percent-encoded em deep links/wrappers.
  addNestedUrlCandidates(candidates, html);

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


function normalizeJsonishText(value) {
  return decodeHtmlEntities(value)
    .replaceAll('\\"', '"')
    .replaceAll("\\\\/", "/");
}

function pageMeta(html, property, name) {
  const normalized = normalizeJsonishText(html);
  const escapedProperty = String(property).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
  const escapedName = String(name).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const patterns = [
    new RegExp(
      `<meta[^>]+${escapedProperty}=["']${escapedName}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+${escapedProperty}=["']${escapedName}["']`,
      "i"
    )
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }

  return null;
}

function moneyFromObjectText(block) {
  if (!block) {
    return null;
  }

  const valueMatch = block.match(
    /"(?:value|amount)"\s*:\s*"?(\d+(?:[.,]\d+)?)"?/i
  );

  if (valueMatch?.[1]) {
    return parseNumber(valueMatch[1]);
  }

  const fractionMatch = block.match(
    /"fraction"\s*:\s*"?(\d+)"?/i
  );

  if (!fractionMatch?.[1]) {
    return null;
  }

  const fraction = Number(fractionMatch[1]);

  const centsMatch = block.match(
    /"cents"\s*:\s*"?(\d{1,2})"?/i
  );

  const cents = centsMatch?.[1]
    ? Number(String(centsMatch[1]).padEnd(2, "0"))
    : 0;

  if (!Number.isFinite(fraction) || !Number.isFinite(cents)) {
    return null;
  }

  return fraction + cents / 100;
}

function moneyNearKey(text, keys) {
  for (const key of keys) {
    const escapedKey = String(key).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    // Objeto de preço, por exemplo:
    // "price":{"fraction":93,"cents":12,...}
    const objectPattern = new RegExp(
      `"${escapedKey}"\\s*:\\s*\\{([\\s\\S]{0,1800})`,
      "i"
    );

    const objectMatch = text.match(objectPattern);

    if (objectMatch?.[1]) {
      const value = moneyFromObjectText(
        objectMatch[1]
      );

      if (typeof value === "number") {
        return value;
      }
    }

    // Número simples:
    // "price":93.12
    const numberPattern = new RegExp(
      `"${escapedKey}"\\s*:\\s*"?([0-9]+(?:[.,][0-9]+)?)"?`,
      "i"
    );

    const numberMatch = text.match(numberPattern);

    if (numberMatch?.[1]) {
      const value = parseNumber(
        numberMatch[1]
      );

      if (typeof value === "number") {
        return value;
      }
    }
  }

  return null;
}

function priceNearItem(html, itemId) {
  const normalized = normalizeJsonishText(html);
  const normalizedItem = normalizeMlb(itemId);

  if (!normalizedItem) {
    return {
      price: null,
      originalPrice: null
    };
  }

  const withDash = normalizedItem.replace(
    /^MLB/,
    "MLB-"
  );

  const anchors = [
    `"id":"${normalizedItem}"`,
    `"item_id":"${normalizedItem}"`,
    `"itemId":"${normalizedItem}"`,
    normalizedItem,
    withDash
  ];

  let index = -1;

  for (const anchor of anchors) {
    index = normalized.indexOf(anchor);

    if (index >= 0) {
      break;
    }
  }

  if (index < 0) {
    return {
      price: null,
      originalPrice: null
    };
  }

  // O preço do polycard normalmente aparece perto do metadata.id.
  // Mantemos uma janela limitada para não capturar outro produto.
  const start = Math.max(0, index - 5000);
  const end = Math.min(
    normalized.length,
    index + 30000
  );

  const window = normalized.slice(
    start,
    end
  );

  const price = moneyNearKey(
    window,
    [
      "price",
      "current_price",
      "currentPrice",
      "sale_price",
      "salePrice"
    ]
  );

  const originalPrice = moneyNearKey(
    window,
    [
      "original_price",
      "originalPrice",
      "previous_price",
      "previousPrice",
      "regular_price",
      "regularPrice"
    ]
  );

  return {
    price,
    originalPrice
  };
}

function socialFallbackForItem(pages, itemId) {
  const normalizedItem = normalizeMlb(itemId);

  if (!normalizedItem) {
    return null;
  }

  let best = null;

  for (const page of pages || []) {
    if (!page?.html) {
      continue;
    }

    const normalized =
      normalizeJsonishText(page.html);

    const withDash =
      normalizedItem.replace(
        /^MLB/,
        "MLB-"
      );

    if (
      !normalized.includes(normalizedItem) &&
      !normalized.includes(withDash)
    ) {
      continue;
    }

    const title =
      pageMeta(
        page.html,
        "property",
        "og:title"
      ) ||
      pageMeta(
        page.html,
        "name",
        "twitter:title"
      );

    const image =
      pageMeta(
        page.html,
        "property",
        "og:image"
      ) ||
      pageMeta(
        page.html,
        "name",
        "twitter:image"
      );

    const prices =
      priceNearItem(
        page.html,
        normalizedItem
      );

    const directUrl =
      (() => {
        const variants =
          expandNestedEncodedUrls(
            page.html
          );

        for (const source of variants) {
          const match = source.match(
            new RegExp(
              `https?:\\\\/\\\\/(?:produto\\\\.)?mercadolivre\\\\.com\\\\.br\\\\/MLB-?${normalizedItem.replace(
                /^MLB/,
                ""
              )}[^"'<>\\\\\\\\\\\\s]*`,
              "i"
            )
          );

          if (match?.[0]) {
            return match[0];
          }
        }

        return null;
      })();

    const score =
      (title ? 2 : 0) +
      (image ? 2 : 0) +
      (
        typeof prices.price === "number"
          ? 3
          : 0
      ) +
      (directUrl ? 2 : 0);

    const candidate = {
      title,
      image,
      price: prices.price,
      originalPrice:
        prices.originalPrice,
      directUrl,
      score
    };

    if (
      !best ||
      candidate.score > best.score
    ) {
      best = candidate;
    }
  }

  return best;
}

function priceFromPublicProductPage(html) {
  const normalized =
    normalizeJsonishText(html);

  // 1. JSON-LD / meta já tratados em testItemPageFallback.
  // 2. Estruturas internas comuns do Mercado Livre.
  const value =
    moneyNearKey(
      normalized,
      [
        "price",
        "current_price",
        "currentPrice",
        "sale_price",
        "salePrice"
      ]
    );

  if (typeof value === "number") {
    return value;
  }

  // 3. HTML visual do componente andes-money-amount.
  const fractionMatch =
    normalized.match(
      /andes-money-amount__fraction[^>]*>\s*([0-9.]+)\s*</i
    );

  if (fractionMatch?.[1]) {
    const fraction = Number(
      fractionMatch[1].replaceAll(".", "")
    );

    const centsMatch =
      normalized.match(
        /andes-money-amount__cents[^>]*>\s*(\d{1,2})\s*</i
      );

    const cents =
      centsMatch?.[1]
        ? Number(
            String(
              centsMatch[1]
            ).padEnd(2, "0")
          )
        : 0;

    if (
      Number.isFinite(fraction) &&
      Number.isFinite(cents)
    ) {
      return fraction + cents / 100;
    }
  }

  return null;
}

async function fetchResolvedPage(url, userAgent) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
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

  return {
    finalUrl,
    html
  };
}

async function resolveAffiliateLink(link) {
  const desktop = await fetchResolvedPage(
    link,
    USER_AGENTS.desktop
  );

  const pages = [
    {
      kind: "desktop",
      finalUrl: desktop.finalUrl,
      html: desktop.html
    }
  ];

  const mergedCandidates = new Map();

  function mergeCandidates(list) {
    for (const candidate of list) {
      const key = `${candidate.type}:${candidate.id}`;

      if (!mergedCandidates.has(key)) {
        mergedCandidates.set(
          key,
          candidate
        );
        continue;
      }

      const existing =
        mergedCandidates.get(key);

      existing.score = Math.max(
        existing.score,
        candidate.score
      );

      existing.sources = [
        ...new Set([
          ...(existing.sources || []),
          ...(candidate.sources || [])
        ])
      ];

      existing.evidence = [
        ...new Set([
          ...(existing.evidence || []),
          ...(candidate.evidence || [])
        ])
      ].slice(0, 4);
    }
  }

  mergeCandidates(
    collectCandidates(
      desktop.html,
      desktop.finalUrl
    )
  );

  if (/\/social\//i.test(desktop.finalUrl)) {
    try {
      const mobile =
        await fetchResolvedPage(
          desktop.finalUrl,
          USER_AGENTS.mobile
        );

      pages.push({
        kind: "mobile",
        finalUrl: mobile.finalUrl,
        html: mobile.html
      });

      mergeCandidates(
        collectCandidates(
          mobile.html,
          mobile.finalUrl
        )
      );
    } catch {
      // Desktop permanece disponível.
    }
  }

  const candidates =
    [...mergedCandidates.values()]
      .sort(
        (a, b) => b.score - a.score
      );

  if (!candidates.length) {
    throw new Error(
      "Não consegui identificar nenhum ID de produto/anúncio nesse link."
    );
  }

  return {
    finalUrl: desktop.finalUrl,
    candidates,
    pages
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


async function getCategoryName(
  categoryId,
  accessToken
) {
  if (!categoryId) {
    return null;
  }

  const result = await mlRequest(
    `/categories/${encodeURIComponent(categoryId)}`,
    accessToken
  );

  if (!result.ok) {
    return null;
  }

  return (
    result.data?.name ||
    null
  );
}

async function enrichCategoryInfo({
  categoryId = null,
  itemId = null,
  product = null,
  accessToken
}) {
  let resolvedCategoryId =
    categoryId ||
    product?.category_id ||
    null;

  let domainId =
    product?.domain_id ||
    null;

  // Em produtos de catálogo, às vezes a categoria fica mais
  // clara no anúncio vencedor/selecionado.
  if (
    !resolvedCategoryId &&
    itemId
  ) {
    const itemResult =
      await mlRequest(
        `/items/${encodeURIComponent(itemId)}`,
        accessToken
      );

    if (itemResult.ok) {
      resolvedCategoryId =
        itemResult.data?.category_id ||
        resolvedCategoryId;

      domainId =
        itemResult.data?.domain_id ||
        domainId;
    }
  }

  const categoryName =
    await getCategoryName(
      resolvedCategoryId,
      accessToken
    );

  return {
    categoryId:
      resolvedCategoryId,
    categoryName,
    domainId
  };
}

function categoryIdFromSocialPages(
  pages,
  itemId
) {
  const normalizedItem =
    normalizeMlb(itemId);

  if (!normalizedItem) {
    return null;
  }

  for (const page of pages || []) {
    if (!page?.html) {
      continue;
    }

    const normalized =
      normalizeJsonishText(
        page.html
      );

    const itemIndex =
      normalized.indexOf(
        normalizedItem
      );

    if (itemIndex < 0) {
      continue;
    }

    const start =
      Math.max(
        0,
        itemIndex - 12000
      );

    const end =
      Math.min(
        normalized.length,
        itemIndex + 18000
      );

    const window =
      normalized.slice(
        start,
        end
      );

    const match =
      window.match(
        /"category_id"\s*:\s*"(MLB\d+)"/i
      );

    if (match?.[1]) {
      return match[1];
    }
  }

  // Último fallback: páginas sociais costumam trazer
  // a categoria do produto principal no evento de trigger.
  for (const page of pages || []) {
    if (!page?.html) {
      continue;
    }

    const normalized =
      normalizeJsonishText(
        page.html
      );

    const match =
      normalized.match(
        /"trigger"\s*:\s*\{[\s\S]{0,600}?"category_id"\s*:\s*"(MLB\d+)"/i
      );

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
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

  const category =
    await enrichCategoryInfo({
      categoryId:
        product?.category_id ||
        null,
      itemId: offer.itemId,
      product,
      accessToken
    });

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
    priceSource: offer.priceSource,
    categoryId:
      category.categoryId,
    categoryName:
      category.categoryName,
    domainId:
      category.domainId
  };
}


function metaContent(html, attribute, value) {
  const escaped = String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const patterns = [
    new RegExp(
      `<meta[^>]+${attribute}=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escaped}["']`,
      "i"
    )
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }

  return null;
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}

function walkJson(value, visitor) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const result = visitor(value);

  if (result) {
    return result;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = walkJson(item, visitor);

      if (nested) {
        return nested;
      }
    }

    return null;
  }

  for (const child of Object.values(value)) {
    const nested = walkJson(child, visitor);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function findJsonLdProduct(html) {
  const regex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(regex)) {
    const raw = decodeHtmlEntities(match[1]).trim();

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);

      const product = walkJson(
        parsed,
        (value) => {
          const type = value?.["@type"];

          if (
            type === "Product" ||
            (
              Array.isArray(type) &&
              type.includes("Product")
            )
          ) {
            return value;
          }

          return null;
        }
      );

      if (product) {
        return product;
      }
    } catch {
      // Alguns scripts não são JSON válido. Ignoramos e
      // continuamos procurando outro bloco estruturado.
    }
  }

  return null;
}

function productImageFromJsonLd(product) {
  const image = product?.image;

  if (typeof image === "string") {
    return image;
  }

  if (Array.isArray(image)) {
    const first = image.find(
      (value) => typeof value === "string"
    );

    if (first) {
      return first;
    }
  }

  if (
    image &&
    typeof image === "object"
  ) {
    return (
      image.url ||
      image.contentUrl ||
      null
    );
  }

  return null;
}

function offerFromJsonLd(product) {
  const offers = product?.offers;

  const offer =
    Array.isArray(offers)
      ? offers.find(Boolean)
      : offers;

  if (!offer || typeof offer !== "object") {
    return {
      price: null,
      currency: null
    };
  }

  const price =
    parseNumber(offer.price) ??
    parseNumber(offer.lowPrice) ??
    parseNumber(
      offer?.priceSpecification?.price
    );

  const currency =
    offer.priceCurrency ||
    offer?.priceSpecification?.priceCurrency ||
    null;

  return {
    price,
    currency
  };
}

async function fetchPublicProductPage(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": USER_AGENTS.desktop,
      Accept:
        "text/html,application/xhtml+xml",
      "Accept-Language":
        "pt-BR,pt;q=0.9,en;q=0.8"
    }
  });

  if (!response.ok) {
    return null;
  }

  let parsed;

  try {
    parsed = new URL(response.url);
  } catch {
    return null;
  }

  if (!isAllowedResolvedHost(parsed.hostname)) {
    return null;
  }

  const html = await response.text();

  if (
    !html ||
    html.length > MAX_HTML_SIZE
  ) {
    return null;
  }

  return {
    finalUrl: response.url,
    html
  };
}

function directMercadoLivreUrl(candidate) {
  const evidence =
    Array.isArray(candidate?.evidence)
      ? candidate.evidence
      : [];

  for (const value of evidence) {
    const decoded =
      safeDecodeURIComponent(
        decodeHtmlEntities(value)
      );

    const match = decoded.match(
      /https?:\/\/(?:produto\.)?mercadolivre\.com\.br\/MLB-?\d{6,}[^"'<>\\\s]*/i
    );

    if (match?.[0]) {
      return match[0];
    }
  }

  return null;
}

async function testItemPageFallback(
  candidate,
  pages = []
) {
  const social =
    socialFallbackForItem(
      pages,
      candidate.id
    );

  const directUrl =
    directMercadoLivreUrl(candidate) ||
    social?.directUrl ||
    null;

  let page = null;

  if (directUrl) {
    page =
      await fetchPublicProductPage(
        directUrl
      );
  }

  let product = null;
  let jsonOffer = {
    price: null,
    currency: null
  };

  let pageTitle = null;
  let pageImage = null;
  let pagePrice = null;

  if (page?.html) {
    product =
      findJsonLdProduct(
        page.html
      );

    jsonOffer =
      offerFromJsonLd(product);

    pageTitle =
      product?.name ||
      metaContent(
        page.html,
        "property",
        "og:title"
      ) ||
      metaContent(
        page.html,
        "name",
        "twitter:title"
      ) ||
      null;

    pageImage =
      productImageFromJsonLd(
        product
      ) ||
      metaContent(
        page.html,
        "property",
        "og:image"
      ) ||
      metaContent(
        page.html,
        "name",
        "twitter:image"
      ) ||
      null;

    const metaPrice =
      parseNumber(
        metaContent(
          page.html,
          "itemprop",
          "price"
        )
      );

    pagePrice =
      jsonOffer.price ??
      metaPrice ??
      priceFromPublicProductPage(
        page.html
      );
  }

  const title =
    pageTitle ||
    social?.title ||
    null;

  const image =
    pageImage ||
    social?.image ||
    null;

  const price =
    pagePrice ??
    social?.price ??
    null;

  const originalPrice =
    social?.originalPrice ??
    null;

  if (
    !title ||
    !image ||
    typeof price !== "number"
  ) {
    return null;
  }

  const itemId =
    normalizeMlb(candidate.id);

  const socialCategoryId =
    categoryIdFromSocialPages(
      pages,
      itemId
    );

  return {
    resolutionType:
      page?.html
        ? "item_page_fallback"
        : "social_page_fallback",
    sourceId: itemId,
    productId: null,
    itemId,
    title,
    image,
    price,
    originalPrice,
    currency:
      jsonOffer.currency || "BRL",
    priceSource:
      page?.html
        ? (
            social?.price === price
              ? "mercadolivre_social_page"
              : "mercadolivre_public_page"
          )
        : "mercadolivre_social_page",
    categoryId:
      socialCategoryId,
    categoryName: null,
    domainId: null
  };
}

async function testItemCandidate(
  candidate,
  accessToken,
  pages = []
) {
  const result = await mlRequest(
    `/items/${encodeURIComponent(candidate.id)}`,
    accessToken
  );

  if (!result.ok) {
    // Alguns anúncios públicos existem normalmente no site,
    // mas o endpoint /items/{id} pode negar o acesso para
    // nossa aplicação. Nesses casos usamos a própria página
    // pública do anúncio como fallback.
    return testItemPageFallback(
      candidate,
      pages
    );
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

  const category =
    await enrichCategoryInfo({
      categoryId:
        item.category_id ||
        null,
      itemId: item.id,
      product: item,
      accessToken
    });

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
    priceSource: "item",
    categoryId:
      category.categoryId,
    categoryName:
      category.categoryName,
    domainId:
      category.domainId
  };
}

async function findOffer(
  candidates,
  accessToken,
  pages = []
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
              accessToken,
              pages
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


function estimateCommissionValue(
  price,
  percent
) {
  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    typeof percent !== "number" ||
    !Number.isFinite(percent)
  ) {
    return null;
  }

  return Number(
    (
      price *
      (percent / 100)
    ).toFixed(2)
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
      tokenData.access_token,
      resolved.pages
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

    if (
      offer.categoryId &&
      !offer.categoryName
    ) {
      offer.categoryName =
        await getCategoryName(
          offer.categoryId,
          tokenData.access_token
        );
    }

    // Etapa 6.7F:
    // usa a árvore já salva no Blob para descobrir
    // a categoria principal e, quando mapeada,
    // a comissão de afiliado.
    //
    // Importante: falha nesta camada NÃO deve impedir
    // a oferta principal de continuar funcionando.
    const categoryEnrichment =
      await enrichOfferCategoryAndCommission({
        categoryId:
          offer.categoryId || null,
        categoryName:
          offer.categoryName || null,
        domainId:
          offer.domainId || null,
        title:
          offer.title || null,
        accessToken:
          tokenData.access_token
      });

    const estimatedDirectCommission =
      estimateCommissionValue(
        offer.price,
        categoryEnrichment
          .directCommissionPercent
      );

    const estimatedIndirectCommission =
      estimateCommissionValue(
        offer.price,
        categoryEnrichment
          .indirectCommissionPercent
      );

    const offerScoring =
      calculateOfferScore({
        discount:
          calculateDiscount(
            offer.price,
            offer.originalPrice
          ),
        directCommissionPercent:
          categoryEnrichment
            .directCommissionPercent,
        estimatedDirectCommission
      });

    const ttRouting =
      routeToTtCategory({
        rootCategory:
          categoryEnrichment
            .rootCategory
      });

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

      // Etapa 6.7A:
      // começamos a ensinar o sistema a reconhecer a
      // categoria antes de automatizar o roteamento.
      categoryId:
        offer.categoryId || null,
      categoryName:
        offer.categoryName || null,
      domainId:
        offer.domainId || null,

      // Etapa 6.7F:
      // classificação principal + comissão.
      rootCategory:
        categoryEnrichment.rootCategory,

      categoryPath:
        categoryEnrichment.categoryPath,

      categoryDepth:
        categoryEnrichment.categoryDepth,

      commissionKnown:
        categoryEnrichment.commissionKnown,

      directCommissionPercent:
        categoryEnrichment.directCommissionPercent,

      indirectCommissionPercent:
        categoryEnrichment.indirectCommissionPercent,

      commissionGroup:
        categoryEnrichment.commissionGroup,

      commissionTableVersion:
        categoryEnrichment.commissionTableVersion,

      commissionSource:
        categoryEnrichment.commissionSource,

      estimatedDirectCommission,

      estimatedIndirectCommission,

      // Etapa 6.7J:
      // pontuação somente para uso interno do T&T.
      offerScore:
        offerScoring.offerScore,

      priority:
        offerScoring.priority,

      scoreBreakdown:
        offerScoring.scoreBreakdown,

      scoreVersion:
        offerScoring.scoreVersion,

      // Etapa 6.7K:
      // roteamento interno para as categorias T&T.
      ttCategoryId:
        ttRouting.ttCategoryId,

      ttCategoryName:
        ttRouting.ttCategoryName,

      ttCategoryEmoji:
        ttRouting.ttCategoryEmoji,

      ttRoutingKnown:
        ttRouting.ttRoutingKnown,

      ttRoutingSource:
        ttRouting.ttRoutingSource,

      ttRoutingVersion:
        ttRouting.ttRoutingVersion,

      categoryEnrichmentSource:
        categoryEnrichment.source,

      categoryEnrichmentNote:
        categoryEnrichment.note,

      domainCategoryResolutionType:
        categoryEnrichment.domainCategoryResolutionType,

      domainCategoryCandidateCount:
        categoryEnrichment.domainCategoryCandidateCount,

      resolvedCategoryId:
        categoryEnrichment.categoryId,

      resolvedCategoryName:
        categoryEnrichment.categoryName,

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
