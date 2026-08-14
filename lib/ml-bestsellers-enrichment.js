// T&T Barateou — Etapa 6.8D
//
// Enriquece somente os primeiros candidatos encontrados em /highlights.
//
// Suporta:
// - ITEM
// - PRODUCT
// - USER_PRODUCT
//
// Nesta etapa:
// - NÃO cria link de afiliado;
// - NÃO publica;
// - NÃO envia WhatsApp;
// - limita o enriquecimento aos candidatos recebidos pela API
//   (atualmente TOP 3 em api/discover-bestsellers.js).

const MAX_ENRICHED_CANDIDATES = 5;
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

function getProductImage(product) {
  if (
    Array.isArray(product?.pictures) &&
    product.pictures.length
  ) {
    const picture =
      product.pictures[0];

    return (
      picture?.secure_url ||
      picture?.url ||
      null
    );
  }

  if (
    typeof product?.thumbnail === "string"
  ) {
    return product.thumbnail;
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
  timeoutMs = 10000,
  useAuthorization = true
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  const headers = {
    Accept:
      "application/json"
  };

  if (
    useAuthorization &&
    accessToken
  ) {
    headers.Authorization =
      `Bearer ${accessToken}`;
  }

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers,

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

  const items =
    new Map();

  const diagnostics =
    new Map();

  if (!ids.length) {
    return {
      items,
      diagnostics,
      requestMode:
        "no_ids"
    };
  }

  const params =
    new URLSearchParams({
      ids:
        ids.join(",")
    });

  const url =
    "https://api.mercadolibre.com/items?" +
    params.toString();

  async function execute(
    useAuthorization
  ) {
    const result =
      await fetchJson(
        url,
        accessToken,
        12000,
        useAuthorization
      );

    const attempt = {
      requestHttpStatus:
        result.status,

      requestOk:
        result.ok,

      entries:
        {}
    };

    if (
      Array.isArray(
        result.body
      )
    ) {
      result.body.forEach(
        (entry, index) => {
          const requestedId =
            ids[index];

          const bodyId =
            entry?.body?.id ||
            null;

          const id =
            bodyId ||
            requestedId ||
            null;

          if (!id) {
            return;
          }

          attempt.entries[id] = {
            code:
              entry?.code ??
              null,

            message:
              entry?.body?.message ||
              entry?.body?.error ||
              null
          };

          if (
            entry?.code === 200 &&
            entry?.body?.id
          ) {
            items.set(
              entry.body.id,
              entry.body
            );
          }
        }
      );
    }

    return attempt;
  }

  const authorizedAttempt =
    await execute(true);

  for (
    const id of
    ids
  ) {
    diagnostics.set(
      id,
      {
        authorized:
          authorizedAttempt
            .entries[id] ||
          {
            code:
              authorizedAttempt
                .requestHttpStatus ||
              null,

            message:
              null
          },

        public:
          null
      }
    );
  }

  if (
    items.size ===
    ids.length
  ) {
    return {
      items,
      diagnostics,
      requestMode:
        "authorized_multiget"
    };
  }

  const unresolvedIds =
    ids.filter(
      (id) =>
        !items.has(id)
    );

  const publicParams =
    new URLSearchParams({
      ids:
        unresolvedIds.join(",")
    });

  const publicUrl =
    "https://api.mercadolibre.com/items?" +
    publicParams.toString();

  const publicResult =
    await fetchJson(
      publicUrl,
      null,
      12000,
      false
    );

  if (
    Array.isArray(
      publicResult.body
    )
  ) {
    publicResult.body.forEach(
      (entry, index) => {
        const requestedId =
          unresolvedIds[index];

        if (!requestedId) {
          return;
        }

        const current =
          diagnostics.get(
            requestedId
          ) || {
            authorized: null,
            public: null
          };

        current.public = {
          code:
            entry?.code ??
            null,

          message:
            entry?.body?.message ||
            entry?.body?.error ||
            null
        };

        diagnostics.set(
          requestedId,
          current
        );

        if (
          entry?.code === 200 &&
          entry?.body?.id
        ) {
          items.set(
            entry.body.id,
            entry.body
          );
        }
      }
    );
  } else {
    for (
      const id of
      unresolvedIds
    ) {
      const current =
        diagnostics.get(id) ||
        {
          authorized: null,
          public: null
        };

      current.public = {
        code:
          publicResult.status,

        message:
          publicResult.body
            ?.message ||
          publicResult.body
            ?.error ||
          null
      };

      diagnostics.set(
        id,
        current
      );
    }
  }

  return {
    items,
    diagnostics,

    requestMode:
      items.size > 0
        ? "authorized_then_public_fallback"
        : "details_still_blocked"
  };
}

async function resolveCatalogProduct({
  accessToken,
  candidate
}) {
  const productId =
    candidate?.id ||
    null;

  const rank =
    candidate?.position ??
    null;

  if (!productId) {
    return {
      rank,
      sourceId: null,
      sourceType:
        "PRODUCT",
      resolutionType:
        "product_invalid_id",
      resolved:
        false
    };
  }

  const url =
    `https://api.mercadolibre.com/products/${encodeURIComponent(productId)}`;

  const authorized =
    await fetchJson(
      url,
      accessToken,
      12000,
      true
    );

  let result =
    authorized;

  let requestMode =
    "authorized_product";

  let publicAttempt =
    null;

  if (!authorized.ok) {
    publicAttempt =
      await fetchJson(
        url,
        null,
        12000,
        false
      );

    if (publicAttempt.ok) {
      result =
        publicAttempt;

      requestMode =
        "public_product_fallback";
    } else {
      return {
        rank,

        sourceId:
          productId,

        sourceType:
          "PRODUCT",

        resolutionType:
          "product_unresolved",

        resolved:
          false,

        productId,

        productApiDiagnostic: {
          authorized: {
            code:
              authorized.status,

            message:
              authorized.body
                ?.message ||
              authorized.body
                ?.error ||
              null
          },

          public: {
            code:
              publicAttempt.status,

            message:
              publicAttempt.body
                ?.message ||
              publicAttempt.body
                ?.error ||
              null
          }
        },

        title: null,
        price: null,
        originalPrice: null,
        discount: null,
        image: null,
        permalink: null,
        categoryId: null,
        domainId: null,
        itemId: null
      };
    }
  }

  const product =
    result.body ||
    {};

  const winner =
    product
      ?.buy_box_winner ||
    null;

  let representativeListing =
    null;

  let catalogListingsDiagnostic =
    null;

  // Etapa 6.8E:
  // alguns produtos de catálogo são válidos, mas não retornam
  // buy_box_winner. Nesse caso consultamos as publicações PDP
  // que competem nessa página de produto.
  if (!winner) {
    const listingsUrl =
      `https://api.mercadolibre.com/products/${encodeURIComponent(productId)}/items`;

    const listingsResult =
      await fetchJson(
        listingsUrl,
        accessToken,
        12000,
        true
      );

    if (
      listingsResult.ok &&
      Array.isArray(
        listingsResult.body
          ?.results
      )
    ) {
      const listings =
        listingsResult.body.results
          .filter(
            (listing) =>
              listing?.item_id &&
              typeof listing?.price === "number" &&
              Number.isFinite(
                listing.price
              )
          );

      // Nesta etapa escolhemos apenas um representante para análise:
      // a publicação de menor preço retornada pelo recurso oficial.
      // Isso NÃO significa publicação automática nem "vencedor" do catálogo.
      representativeListing =
        listings
          .slice()
          .sort(
            (a, b) =>
              a.price - b.price
          )[0] ||
        null;

      catalogListingsDiagnostic = {
        httpStatus:
          listingsResult.status,

        total:
          listingsResult.body
            ?.paging
            ?.total ??
          listings.length,

        returned:
          listingsResult.body
            ?.results
            ?.length ??
          listings.length,

        eligibleForRepresentative:
          listings.length
      };
    } else {
      catalogListingsDiagnostic = {
        httpStatus:
          listingsResult.status,

        message:
          listingsResult.body
            ?.message ||
          listingsResult.body
            ?.error ||
          null
      };
    }
  }

  const price =
    typeof winner?.price === "number"
      ? winner.price
      : (
          typeof representativeListing
            ?.price === "number"
            ? representativeListing.price
            : (
                typeof product?.price === "number"
                  ? product.price
                  : null
              )
        );

  const originalPrice =
    typeof winner?.original_price === "number"
      ? winner.original_price
      : (
          typeof representativeListing
            ?.original_price === "number"
            ? representativeListing.original_price
            : (
                typeof product?.original_price === "number"
                  ? product.original_price
                  : null
              )
        );

  const title =
    product?.name ||
    product?.family_name ||
    null;

  const categoryId =
    winner?.category_id ||
    representativeListing
      ?.category_id ||
    product?.category_id ||
    null;

  const itemId =
    winner?.item_id ||
    representativeListing
      ?.item_id ||
    null;

  const currency =
    winner?.currency_id ||
    representativeListing
      ?.currency_id ||
    product?.currency_id ||
    "BRL";

  const sellerId =
    winner?.seller_id ||
    representativeListing
      ?.seller_id ||
    null;

  const freeShipping =
    winner?.shipping
      ?.free_shipping === true ||
    representativeListing
      ?.shipping
      ?.free_shipping === true;

  let resolutionType =
    "catalog_product_without_buy_box_or_listing";

  if (winner) {
    resolutionType =
      "catalog_product_with_buy_box";
  } else if (
    representativeListing
  ) {
    resolutionType =
      "catalog_product_with_representative_listing";
  }

  return {
    rank,

    sourceId:
      productId,

    sourceType:
      "PRODUCT",

    resolutionType,

    resolved:
      Boolean(
        title ||
        product?.permalink ||
        itemId ||
        price
      ),

    productRequestMode:
      requestMode,

    productId,

    itemId,

    title,

    familyName:
      product?.family_name ||
      null,

    status:
      product?.status ||
      null,

    price,

    originalPrice,

    discount:
      calculateDiscount(
        price,
        originalPrice
      ),

    currency,

    image:
      getProductImage(
        product
      ),

    permalink:
      product?.permalink ||
      null,

    categoryId,

    domainId:
      product?.domain_id ||
      null,

    sellerId,

    availableQuantity:
      typeof winner
        ?.available_quantity === "number"
        ? winner.available_quantity
        : (
            typeof representativeListing
              ?.available_quantity === "number"
              ? representativeListing.available_quantity
              : null
          ),

    soldQuantity:
      typeof winner
        ?.sold_quantity === "number"
        ? winner.sold_quantity
        : (
            typeof representativeListing
              ?.sold_quantity === "number"
              ? representativeListing.sold_quantity
              : (
                  typeof product
                    ?.sold_quantity === "number"
                    ? product.sold_quantity
                    : null
                )
          ),

    freeShipping,

    buyBoxWinnerFound:
      Boolean(winner),

    representativeListingFound:
      Boolean(
        representativeListing
      ),

    representativeSelection:
      representativeListing
        ? "lowest_catalog_listing_price"
        : null,

    catalogListingsDiagnostic
  };
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

  const itemFetch =
    await fetchItemsMulti({
      accessToken,
      itemIds:
        associatedIds
    });

  const itemMap =
    itemFetch.items;

  const items =
    associatedIds
      .map(
        (id) =>
          itemMap.get(id)
      )
      .filter(Boolean);

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

  const directItemFetch =
    await fetchItemsMulti({
      accessToken,

      itemIds:
        directItemCandidates.map(
          (candidate) =>
            candidate.id
        )
    });

  const itemMap =
    directItemFetch.items;

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
        const itemDiagnostic =
          directItemFetch
            .diagnostics
            .get(
              candidate.id
            ) ||
          null;

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

          itemApiDiagnostic:
            itemDiagnostic,

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
      "PRODUCT"
    ) {
      enriched.push(
        await resolveCatalogProduct({
          accessToken,
          candidate
        })
      );

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

    directItemRequestMode:
      directItemFetch
        ?.requestMode ||
      "no_direct_items",

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
