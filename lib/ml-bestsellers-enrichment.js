// T&T Barateou — Etapa 6.8C
//
// Enriquece apenas os primeiros candidatos encontrados em /highlights.
//
// Objetivo:
// ID ranqueado
// → título
// → preço
// → preço anterior
// → desconto
// → imagem
// → categoria
// → link normal do Mercado Livre
//
// Importante:
// - NÃO cria link de afiliado;
// - NÃO publica;
// - NÃO envia WhatsApp;
// - limita a 3 candidatos por padrão.

const MAX_ENRICHED_CANDIDATES = 3;
const USER_PRODUCT_ITEM_LIMIT = 5;

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

function getImage(item) {
  if (
    typeof item?.secure_thumbnail === "string" &&
    item.secure_thumbnail
  ) {
    return item.secure_thumbnail;
  }

  if (
    Array.isArray(item?.pictures) &&
    item.pictures.length
  ) {
    const picture =
      item.pictures[0];

    return (
      picture?.secure_url ||
      picture?.url ||
      null
    );
  }

  if (
    typeof item?.thumbnail === "string"
  ) {
    return item.thumbnail;
  }

  return null;
}

function normalizeItem(
  item,
  extra = {}
) {
  if (!item) {
    return null;
  }

  const price =
    typeof item?.price === "number"
      ? item.price
      : null;

  const originalPrice =
    typeof item?.original_price === "number"
      ? item.original_price
      : null;

  return {
    rank:
      extra.rank ??
      null,

    sourceId:
      extra.sourceId ||
      item?.id ||
      null,

    sourceType:
      extra.sourceType ||
      "ITEM",

    resolutionType:
      extra.resolutionType ||
      "item_details",

    itemId:
      item?.id ||
      null,

    userProductId:
      item?.user_product_id ||
      extra.userProductId ||
      null,

    title:
      item?.title ||
      item?.family_name ||
      null,

    price,

    originalPrice,

    discount:
      calculateDiscount(
        price,
        originalPrice
      ),

    currency:
      item?.currency_id ||
      "BRL",

    image:
      getImage(item),

    permalink:
      item?.permalink ||
      null,

    categoryId:
      item?.category_id ||
      null,

    domainId:
      item?.domain_id ||
      null,

    sellerId:
      item?.seller_id ||
      null,

    status:
      item?.status ||
      null,

    freeShipping:
      item?.shipping
        ?.free_shipping === true
  };
}

async function fetchJson(
  url,
  accessToken,
  timeoutMs = 10000
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

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

    let body = null;

    try {
      body =
        await response.json();
    } catch {
      body = null;
    }

    return {
      ok:
        response.ok,

      status:
        response.status,

      body
    };
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      return {
        ok: false,
        status: 408,
        body: {
          message:
            "timeout"
        }
      };
    }

    return {
      ok: false,
      status: 500,
      body: {
        message:
          error?.message ||
          "request_failed"
      }
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

async function fetchItemsMulti({
  accessToken,
  itemIds
}) {
  const ids =
    Array.from(
      new Set(
        (itemIds || [])
          .filter(Boolean)
      )
    );

  if (!ids.length) {
    return new Map();
  }

  const params =
    new URLSearchParams({
      ids:
        ids.join(",")
    });

  const url =
    "https://api.mercadolibre.com/items?" +
    params.toString();

  const result =
    await fetchJson(
      url,
      accessToken,
      12000
    );

  const map =
    new Map();

  if (
    !result.ok ||
    !Array.isArray(
      result.body
    )
  ) {
    return map;
  }

  for (
    const entry of
    result.body
  ) {
    const body =
      entry?.body ||
      null;

    if (
      entry?.code === 200 &&
      body?.id
    ) {
      map.set(
        body.id,
        body
      );
    }
  }

  return map;
}

async function resolveUserProduct({
  accessToken,
  candidate
}) {
  const upId =
    candidate?.id;

  const rank =
    candidate?.position ??
    null;

  const upResult =
    await fetchJson(
      `https://api.mercadolibre.com/user-products/${encodeURIComponent(upId)}`,
      accessToken
    );

  if (
    !upResult.ok ||
    !upResult.body
  ) {
    return {
      rank,
      sourceId:
        upId,
      sourceType:
        "USER_PRODUCT",
      resolutionType:
        "user_product_unresolved",
      resolved:
        false,
      httpStatus:
        upResult.status,
      title:
        null,
      price:
        null,
      originalPrice:
        null,
      discount:
        null,
      image:
        null,
      permalink:
        null,
      categoryId:
        null,
      domainId:
        null,
      itemId:
        null,
      userProductId:
        upId
    };
  }

  const up =
    upResult.body;

  const sellerId =
    up?.user_id ||
    null;

  if (!sellerId) {
    return {
      rank,
      sourceId:
        upId,
      sourceType:
        "USER_PRODUCT",
      resolutionType:
        "user_product_without_seller",
      resolved:
        false,
      title:
        up?.name ||
        up?.family_name ||
        null,
      price:
        null,
      originalPrice:
        null,
      discount:
        null,
      image:
        null,
      permalink:
        null,
      categoryId:
        null,
      domainId:
        up?.domain_id ||
        null,
      itemId:
        null,
      userProductId:
        upId
    };
  }

  const searchParams =
    new URLSearchParams({
      user_product_id:
        upId,
      limit:
        String(
          USER_PRODUCT_ITEM_LIMIT
        )
    });

  const searchUrl =
    `https://api.mercadolibre.com/users/${sellerId}/items/search?` +
    searchParams.toString();

  const searchResult =
    await fetchJson(
      searchUrl,
      accessToken
    );

  const associatedIds =
    searchResult.ok &&
    Array.isArray(
      searchResult.body
        ?.results
    )
      ? searchResult.body.results
          .slice(
            0,
            USER_PRODUCT_ITEM_LIMIT
          )
      : [];

  if (!associatedIds.length) {
    return {
      rank,
      sourceId:
        upId,
      sourceType:
        "USER_PRODUCT",
      resolutionType:
        "user_product_without_item",
      resolved:
        false,
      title:
        up?.name ||
        up?.family_name ||
        null,
      price:
        null,
      originalPrice:
        null,
      discount:
        null,
      image:
        null,
      permalink:
        null,
      categoryId:
        null,
      domainId:
        up?.domain_id ||
        null,
      itemId:
        null,
      userProductId:
        upId,
      sellerId
    };
  }

  const itemMap =
    await fetchItemsMulti({
      accessToken,
      itemIds:
        associatedIds
    });

  const items =
    associatedIds
      .map(
        (id) =>
          itemMap.get(id)
      )
      .filter(Boolean);

  // Um User Product pode ter mais de uma condição de venda.
  // Nesta prova escolhemos um representante:
  // 1) item ativo com preço;
  // 2) menor preço entre os candidatos válidos.
  const activeItems =
    items.filter(
      (item) =>
        item?.status === "active" &&
        typeof item?.price === "number"
    );

  const pool =
    activeItems.length
      ? activeItems
      : items.filter(
          (item) =>
            typeof item?.price === "number"
        );

  const selected =
    pool
      .sort(
        (a, b) =>
          a.price - b.price
      )[0] ||
    items[0] ||
    null;

  if (!selected) {
    return {
      rank,
      sourceId:
        upId,
      sourceType:
        "USER_PRODUCT",
      resolutionType:
        "user_product_item_details_unavailable",
      resolved:
        false,
      title:
        up?.name ||
        up?.family_name ||
        null,
      price:
        null,
      originalPrice:
        null,
      discount:
        null,
      image:
        null,
      permalink:
        null,
      categoryId:
        null,
      domainId:
        up?.domain_id ||
        null,
      itemId:
        null,
      userProductId:
        upId,
      sellerId
    };
  }

  return {
    resolved:
      true,

    ...normalizeItem(
      selected,
      {
        rank,
        sourceId:
          upId,
        sourceType:
          "USER_PRODUCT",
        userProductId:
          upId,
        resolutionType:
          "user_product_to_representative_item"
      }
    ),

    associatedItemCount:
      associatedIds.length,

    representativeSelection:
      "lowest_active_price"
  };
}

export async function enrichBestSellerCandidates({
  accessToken,
  candidates,
  limit =
    MAX_ENRICHED_CANDIDATES
}) {
  if (!accessToken) {
    throw new Error(
      "Access token do Mercado Livre não está disponível."
    );
  }

  const selectedCandidates =
    (candidates || [])
      .slice(
        0,
        Math.min(
          Math.max(
            Number(limit) || 1,
            1
          ),
          MAX_ENRICHED_CANDIDATES
        )
      );

  const directItemCandidates =
    selectedCandidates.filter(
      (candidate) =>
        candidate?.type ===
        "ITEM"
    );

  const itemMap =
    await fetchItemsMulti({
      accessToken,

      itemIds:
        directItemCandidates.map(
          (candidate) =>
            candidate.id
        )
    });

  const enriched =
    [];

  for (
    const candidate of
    selectedCandidates
  ) {
    if (
      candidate?.type ===
      "ITEM"
    ) {
      const item =
        itemMap.get(
          candidate.id
        );

      if (item) {
        enriched.push({
          resolved:
            true,

          ...normalizeItem(
            item,
            {
              rank:
                candidate.position,

              sourceId:
                candidate.id,

              sourceType:
                "ITEM",

              resolutionType:
                "item_multiget"
            }
          )
        });
      } else {
        enriched.push({
          rank:
            candidate.position,

          sourceId:
            candidate.id,

          sourceType:
            "ITEM",

          resolutionType:
            "item_unresolved",

          resolved:
            false,

          itemId:
            candidate.id,

          title:
            null,

          price:
            null,

          originalPrice:
            null,

          discount:
            null,

          image:
            null,

          permalink:
            null,

          categoryId:
            null,

          domainId:
            null
        });
      }

      continue;
    }

    if (
      candidate?.type ===
      "USER_PRODUCT"
    ) {
      enriched.push(
        await resolveUserProduct({
          accessToken,
          candidate
        })
      );

      continue;
    }

    enriched.push({
      rank:
        candidate?.position ??
        null,

      sourceId:
        candidate?.id ||
        null,

      sourceType:
        candidate?.type ||
        "UNKNOWN",

      resolutionType:
        "unsupported_highlight_type",

      resolved:
        false
    });
  }

  return {
    requested:
      selectedCandidates.length,

    resolvedCount:
      enriched.filter(
        (item) =>
          item?.resolved === true
      ).length,

    unresolvedCount:
      enriched.filter(
        (item) =>
          item?.resolved !== true
      ).length,

    candidates:
      enriched
  };
}
