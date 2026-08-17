import {
  findQueuedPublicationByItemId,
  listPublicationQueue,
  markPublicationAffiliateReady,
  queuePendingPublications,
  repairPublicationQueueDuplicates,
  updatePublicationDeliveryState
} from "./tt-pending-publication-store.js";

import {
  buildPublicationPlan
} from "./tt-publication-planner.js";

import {
  selectDiscoverySeeds
} from "./tt-discovery-seeds.js";

function getAdminKey(
  req
) {
  const header =
    req.headers?.[
      "x-tt-admin-key"
    ];

  if (
    Array.isArray(header)
  ) {
    return header[0] ||
      "";
  }

  return String(
    header || ""
  );
}

export function assertQueueAdmin(
  req
) {
  const configured =
    process.env
      .TT_QUEUE_ADMIN_KEY;

  if (!configured) {
    const error =
      new Error(
        "TT_QUEUE_ADMIN_KEY ainda não foi configurada no Vercel."
      );

    error.statusCode =
      503;

    throw error;
  }

  const received =
    getAdminKey(
      req
    );

  if (
    !received ||
    received !== configured
  ) {
    const error =
      new Error(
        "Chave administrativa inválida."
      );

    error.statusCode =
      401;

    throw error;
  }
}

function currentDeploymentBaseUrl() {
  // IMPORTANTE:
  // VERCEL_URL pode apontar para a URL única do deployment,
  // que pode estar protegida pelo Deployment Protection.
  //
  // Para chamadas internas HTTP que precisam atingir a aplicação
  // pública, preferimos:
  //
  // 1. TT_PUBLIC_BASE_URL, caso o projeto queira fixar explicitamente;
  // 2. VERCEL_PROJECT_PRODUCTION_URL, domínio público de produção;
  // 3. VERCEL_URL apenas como último fallback.
  const host =
    process.env
      .TT_PUBLIC_BASE_URL ||
    process.env
      .VERCEL_PROJECT_PRODUCTION_URL ||
    process.env
      .VERCEL_URL;

  if (!host) {
    throw new Error(
      "Não foi possível identificar a URL pública da aplicação para validar o link."
    );
  }

  const normalized =
    String(host)
      .trim()
      .replace(/\/$/, "");

  return (
    /^https?:\/\//i.test(
      normalized
    )
      ? normalized
      : `https://${normalized}`
  );
}

async function validateAffiliateLink({
  affiliateLink,
  expectedItemId,
  expectedProductId
}) {
  const baseUrl =
    currentDeploymentBaseUrl();

  const url =
    `${baseUrl}/api/offer?link=` +
    encodeURIComponent(
      affiliateLink
    );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json"
        }
      }
    );

  let result =
    null;

  try {
    result =
      await response.json();
  } catch {
    result =
      null;
  }

  if (
    !response.ok ||
    !result?.ok
  ) {
    return {
      valid:
        false,

      reason:
        "affiliate_link_resolution_failed",

      httpStatus:
        response.status,

      resolved:
        result
    };
  }

  const itemMatches =
    Boolean(
      expectedItemId &&
      result.itemId &&
      expectedItemId ===
        result.itemId
    );

  const productMatches =
    Boolean(
      expectedProductId &&
      result.productId &&
      expectedProductId ===
        result.productId
    );

  return {
    valid:
      itemMatches ||
      productMatches,

    itemMatches,

    productMatches,

    reason:
      itemMatches ||
      productMatches
        ? "matched_queued_offer"
        : "resolved_to_different_offer",

    resolved:
      result
  };
}

export async function handleQueueListAction(
  req
) {
  assertQueueAdmin(
    req
  );

  const status =
    req.query?.status ||
    null;

  let dedupe = null;

  // TRAVA FINAL:
  // toda vez que o bot pedir uma oferta pronta,
  // limpamos duplicatas por productId ANTES de responder.
  //
  // Assim uma duplicata antiga nunca consegue virar
  // uma segunda prévia depois que outra cópia foi enviada.
  if (
    status ===
    "ready_to_publish"
  ) {
    dedupe =
      await repairPublicationQueueDuplicates();
  }

  return {
    ok:
      true,

    action:
      "queue-list",

    dedupe,

    queue:
      await listPublicationQueue({
        status,
        limit:
          req.query?.limit ||
          50
      }),

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}

export async function handleAttachAffiliateAction(
  req
) {
  assertQueueAdmin(
    req
  );

  const body =
    typeof req.body === "string"
      ? JSON.parse(
          req.body || "{}"
        )
      : (
          req.body ||
          {}
        );

  const itemId =
    String(
      body.itemId ||
      req.query?.itemId ||
      ""
    )
      .trim()
      .toUpperCase();

  const affiliateLink =
    String(
      body.affiliateLink ||
      req.query?.affiliateLink ||
      ""
    )
      .trim();

  if (
    !/^MLB\d+$/.test(
      itemId
    )
  ) {
    const error =
      new Error(
        "itemId inválido."
      );

    error.statusCode =
      400;

    throw error;
  }

  if (
    !/^https?:\/\//i.test(
      affiliateLink
    )
  ) {
    const error =
      new Error(
        "affiliateLink inválido."
      );

    error.statusCode =
      400;

    throw error;
  }

  const queued =
    await findQueuedPublicationByItemId(
      itemId
    );

  if (!queued) {
    const error =
      new Error(
        "Oferta não encontrada na fila."
      );

    error.statusCode =
      404;

    throw error;
  }

  const expected =
    queued.envelope
      .data ||
    {};

  const validation =
    await validateAffiliateLink({
      affiliateLink,

      expectedItemId:
        expected.itemId,

      expectedProductId:
        expected.productId
    });

  if (!validation.valid) {
    return {
      ok:
        false,

      action:
        "attach-affiliate-link",

      error:
        "O link afiliado não corresponde ao produto enfileirado.",

      validation: {
        reason:
          validation.reason,

        expectedItemId:
          expected.itemId ||
          null,

        expectedProductId:
          expected.productId ||
          null,

        resolvedItemId:
          validation.resolved
            ?.itemId ||
          null,

        resolvedProductId:
          validation.resolved
            ?.productId ||
          null
      },

      queueUpdated:
        false,

      accessTokenExposed:
        false,

      refreshTokenExposed:
        false
    };
  }

  const updated =
    await markPublicationAffiliateReady({
      pathname:
        queued.pathname,

      envelope:
        queued.envelope,

      affiliateLink,

      validatedOffer:
        validation.resolved
    });

  return {
    ok:
      true,

    action:
      "attach-affiliate-link",

    validation: {
      valid:
        true,

      itemMatches:
        validation.itemMatches,

      productMatches:
        validation.productMatches,

      resolvedItemId:
        validation.resolved
          ?.itemId ||
        null,

      resolvedProductId:
        validation.resolved
          ?.productId ||
        null
    },

    queueUpdated:
      true,

    publicationStatus:
      updated.status,

    itemId,

    whatsappPayload:
      updated.data
        ?.whatsappPayload ||
      null,

    messageDraft:
      updated.data
        ?.messageDraft ||
      null,

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}

function normalizeAffiliateLinks(
  body
) {
  const raw =
    Array.isArray(
      body?.affiliateLinks
    )
      ? body.affiliateLinks
      : (
          body?.affiliateLink
            ? [body.affiliateLink]
            : []
        );

  return Array.from(
    new Set(
      raw
        .map(
          (value) =>
            String(value || "")
              .trim()
        )
        .filter(
          (value) =>
            /^https?:\/\//i.test(
              value
            )
        )
    )
  ).slice(
    0,
    10
  );
}

async function resolveAffiliateOffer(
  affiliateLink
) {
  const baseUrl =
    currentDeploymentBaseUrl();

  const url =
    `${baseUrl}/api/offer?link=` +
    encodeURIComponent(
      affiliateLink
    );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json"
        }
      }
    );

  let result =
    null;

  try {
    result =
      await response.json();
  } catch {
    result =
      null;
  }

  if (
    !response.ok ||
    !result?.ok
  ) {
    return {
      ok:
        false,

      affiliateLink,

      reason:
        "offer_resolution_failed",

      httpStatus:
        response.status,

      error:
        result?.error ||
        result?.message ||
        null
    };
  }

  return {
    ok:
      true,

    affiliateLink,

    offer:
      result
  };
}

function offerToShortlistCandidate(
  offer
) {
  return {
    resolved:
      true,

    itemId:
      offer.itemId ||
      null,

    productId:
      offer.productId ||
      null,

    title:
      offer.title ||
      null,

    image:
      offer.image ||
      null,

    price:
      typeof offer.price === "number"
        ? offer.price
        : null,

    originalPrice:
      typeof offer.originalPrice === "number"
        ? offer.originalPrice
        : null,

    discount:
      typeof offer.discount === "number"
        ? offer.discount
        : null,

    freeShipping:
      offer.freeShipping === true,

    currency:
      offer.currency ||
      "BRL",

    ttCategoryId:
      offer.ttCategoryId ||
      "ofertas_variedades",

    ttCategoryName:
      offer.ttCategoryName ||
      "Ofertas & Variedades",

    ttCategoryEmoji:
      offer.ttCategoryEmoji ||
      "🔥",

    priority:
      offer.priority ||
      "unknown",

    offerScore:
      typeof offer.offerScore === "number"
        ? offer.offerScore
        : null,

    scoreStatus:
      offer.scoreStatus ||
      "insufficient_data",

    rank:
      null
  };
}

async function ingestResolvedAffiliateOffer({
  affiliateLink,
  offer
}) {
  const candidate =
    offerToShortlistCandidate(
      offer
    );

  const plan =
    buildPublicationPlan({
      shortlist:
        [candidate],

      maxPublications:
        1
    });

  if (
    !plan.ready.length
  ) {
    return {
      affiliateLink,

      status:
        "held",

      queued:
        false,

      itemId:
        offer.itemId ||
        null,

      productId:
        offer.productId ||
        null,

      title:
        offer.title ||
        null,

      price:
        offer.price ??
        null,

      priority:
        offer.priority ||
        null,

      offerScore:
        offer.offerScore ??
        null,

      ttCategoryId:
        offer.ttCategoryId ||
        null,

      ttCategoryName:
        offer.ttCategoryName ||
        null,

      heldReason:
        plan.held?.[0]
          ?.reason ||
        "not_approved_by_current_rules"
    };
  }

  const ready =
    plan.ready[0];

  const queueResult =
    await queuePendingPublications(
      [ready]
    );

  const queued =
    await findQueuedPublicationByItemId(
      ready.itemId
    );

  if (!queued) {
    throw new Error(
      "A oferta foi aprovada, mas não pôde ser reencontrada na fila."
    );
  }

  const updated =
    await markPublicationAffiliateReady({
      pathname:
        queued.pathname,

      envelope:
        queued.envelope,

      affiliateLink,

      validatedOffer:
        offer
    });

  return {
    affiliateLink,

    status:
      "ready_to_publish",

    queued:
      true,

    alreadyQueued:
      queueResult
        .results?.[0]
        ?.alreadyQueued === true,

    itemId:
      offer.itemId ||
      null,

    productId:
      offer.productId ||
      null,

    title:
      offer.title ||
      null,

    price:
      offer.price ??
      null,

    priority:
      offer.priority ||
      null,

    offerScore:
      offer.offerScore ??
      null,

    ttCategoryId:
      offer.ttCategoryId ||
      null,

    ttCategoryName:
      offer.ttCategoryName ||
      null,

    publicationStatus:
      updated.status,

    messageDraft:
      updated.data
        ?.messageDraft ||
      null,

    whatsappPayload:
      updated.data
        ?.whatsappPayload ||
      null
  };
}

export async function handleIngestAffiliateLinksAction(
  req
) {
  assertQueueAdmin(
    req
  );

  const body =
    typeof req.body === "string"
      ? JSON.parse(
          req.body || "{}"
        )
      : (
          req.body ||
          {}
        );

  const links =
    normalizeAffiliateLinks(
      body
    );

  if (!links.length) {
    const error =
      new Error(
        "Envie affiliateLink ou affiliateLinks."
      );

    error.statusCode =
      400;

    throw error;
  }

  const results =
    [];

  for (
    const affiliateLink of
    links
  ) {
    try {
      const resolved =
        await resolveAffiliateOffer(
          affiliateLink
        );

      if (!resolved.ok) {
        results.push({
          affiliateLink,

          status:
            "resolution_failed",

          queued:
            false,

          reason:
            resolved.reason,

          httpStatus:
            resolved.httpStatus,

          error:
            resolved.error
        });

        continue;
      }

      results.push(
        await ingestResolvedAffiliateOffer({
          affiliateLink,

          offer:
            resolved.offer
        })
      );
    } catch (error) {
      results.push({
        affiliateLink,

        status:
          "error",

        queued:
          false,

        error:
          error?.message ||
          "unexpected_ingestion_error"
      });
    }
  }

  const ready =
    results.filter(
      (item) =>
        item.status ===
        "ready_to_publish"
    );

  const held =
    results.filter(
      (item) =>
        item.status ===
        "held"
    );

  const failed =
    results.filter(
      (item) =>
        item.status !==
          "ready_to_publish" &&
        item.status !==
          "held"
    );

  return {
    ok:
      failed.length === 0,

    action:
      "ingest-affiliate-links",

    requestedCount:
      links.length,

    readyCount:
      ready.length,

    heldCount:
      held.length,

    failedCount:
      failed.length,

    results,

    policy: {
      publishPriorities:
        [
          "high",
          "medium"
        ],

      holdPriorities:
        [
          "low",
          "unknown"
        ],

      maxLinksPerRequest:
        10
    },

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}

const ALLOWED_DELIVERY_ACTIONS = new Set([
  "sending",
  "sent",
  "send_error",
  "rejected",
  "retry"
]);

export async function handlePublicationStatusAction(
  req
) {
  assertQueueAdmin(
    req
  );

  const body =
    typeof req.body === "string"
      ? JSON.parse(
          req.body || "{}"
        )
      : (
          req.body ||
          {}
        );

  const itemId =
    String(
      body.itemId ||
      ""
    )
      .trim()
      .toUpperCase();

  const requested =
    String(
      body.status ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    !/^MLB\d+$/.test(
      itemId
    )
  ) {
    const error =
      new Error(
        "itemId inválido."
      );

    error.statusCode =
      400;

    throw error;
  }

  if (
    !ALLOWED_DELIVERY_ACTIONS.has(
      requested
    )
  ) {
    const error =
      new Error(
        "status inválido. Use sending, sent, send_error, rejected ou retry."
      );

    error.statusCode =
      400;

    throw error;
  }

  const isRetry =
    requested ===
    "retry";

  const nextStatus =
    isRetry
      ? "ready_to_publish"
      : requested;

  const updated =
    await updatePublicationDeliveryState({
      itemId,

      status:
        nextStatus,

      groupJid:
        body.groupJid ||
        null,

      groupName:
        body.groupName ||
        null,

      whatsappMessageId:
        body.whatsappMessageId ||
        null,

      errorMessage:
        body.errorMessage ||
        null,

      retryRequested:
        isRetry
    });

  let dedupeAfterSent =
    null;

  // Assim que uma cópia do produto vira SENT,
  // qualquer outra cópia ativa do mesmo productId
  // é neutralizada imediatamente.
  if (
    updated.status ===
    "sent"
  ) {
    dedupeAfterSent =
      await repairPublicationQueueDuplicates();
  }

  return {
    ok:
      true,

    action:
      "publication-status",

    itemId,

    requestedStatus:
      requested,

    publicationStatus:
      updated.status,

    retryCount:
      updated.retryCount,

    delivery:
      updated.delivery,

    dedupeAfterSent,

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}

function buildInternalEndpointUrl(
  params = {}
) {
  const url =
    new URL(
      `${currentDeploymentBaseUrl()}/api/discover-bestsellers`
    );

  Object.entries(
    params
  ).forEach(
    ([key, value]) => {
      if (
        value !== null &&
        value !== undefined
      ) {
        url.searchParams.set(
          key,
          String(value)
        );
      }
    }
  );

  return url.toString();
}

async function discoverOneSeed(
  seed
) {
  const url =
    buildInternalEndpointUrl({
      categoryId:
        seed.categoryId,

      queue:
        1,

      source:
        "auto"
    });

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json"
        }
      }
    );

  let result =
    null;

  try {
    result =
      await response.json();
  } catch {
    result =
      null;
  }

  if (
    !response.ok ||
    !result?.ok
  ) {
    return {
      ok:
        false,

      seed,

      httpStatus:
        response.status,

      error:
        result?.error ||
        result?.message ||
        "discovery_failed",

      newQueuedCount:
        0,

      newOffers:
        []
    };
  }

  const ready =
    Array.isArray(
      result
        ?.publicationPlan
        ?.ready
    )
      ? result
          .publicationPlan
          .ready
      : [];

  const persistenceResults =
    Array.isArray(
      result
        ?.queuePersistence
        ?.results
    )
      ? result
          .queuePersistence
          .results
      : [];

  const newItemIds =
    new Set(
      persistenceResults
        .filter(
          (item) =>
            item?.queued === true &&
            item?.alreadyQueued === false
        )
        .map(
          (item) =>
            item.itemId
        )
        .filter(Boolean)
    );

  const newOffers =
    ready
      .filter(
        (offer) =>
          newItemIds.has(
            offer.itemId
          )
      )
      .map(
        (offer) => ({
          itemId:
            offer.itemId ||
            null,

          productId:
            offer.productId ||
            null,

          catalogPageUrl:
            offer.catalogPageUrl ||
            (
              offer.productId
                ? `https://www.mercadolivre.com.br/p/${offer.productId}`
                : null
            ),

          title:
            offer.title ||
            null,

          price:
            offer.price ??
            null,

          originalPrice:
            offer.originalPrice ??
            null,

          discount:
            offer.discount ??
            null,

          priority:
            offer.internalPriority ||
            null,

          offerScore:
            offer.internalOfferScore ??
            null,

          ttCategoryId:
            offer.ttCategoryId ||
            null,

          ttCategoryName:
            offer.ttCategoryName ||
            null,

          affiliateLinkStatus:
            "pending"
        })
      );

  return {
    ok:
      true,

    seed,

    candidateCount:
      result.candidateCount ??
      null,

    selectedProductCount:
      result.selectedProductCount ??
      null,

    readyCount:
      result
        ?.publicationPlan
        ?.readyCount ??
      0,

    heldCount:
      result
        ?.publicationPlan
        ?.heldCount ??
      0,

    newQueuedCount:
      result
        ?.queuePersistence
        ?.newQueuedCount ??
      newOffers.length,

    duplicateCount:
      result
        ?.queuePersistence
        ?.duplicateCount ??
      0,

    newOffers
  };
}

export async function handleAutoDiscoverAction(
  req
) {
  assertQueueAdmin(
    req
  );

  const body =
    typeof req.body === "string"
      ? JSON.parse(
          req.body || "{}"
        )
      : (
          req.body ||
          {}
        );

  const selection =
    selectDiscoverySeeds({
      cursor:
        body.cursor ??
        req.query?.cursor ??
        0,

      limit:
        body.limit ??
        req.query?.limit ??
        2,

      group:
        body.group ??
        req.query?.group ??
        null
    });

  const categories =
    [];

  for (
    const seed of
    selection.seeds
  ) {
    try {
      categories.push(
        await discoverOneSeed(
          seed
        )
      );
    } catch (error) {
      categories.push({
        ok:
          false,

        seed,

        error:
          error?.message ||
          "unexpected_discovery_error",

        newQueuedCount:
          0,

        newOffers:
          []
      });
    }
  }

  const rawNewOffers =
    categories
      .flatMap(
        (category) =>
          category.newOffers ||
          []
      );

  const uniqueNewOffersMap =
    new Map();

  for (
    const offer of
    rawNewOffers
  ) {
    const key =
      offer?.productId ||
      offer?.itemId;

    if (
      key &&
      !uniqueNewOffersMap.has(
        key
      )
    ) {
      uniqueNewOffersMap.set(
        key,
        offer
      );
    }
  }

  const newOffers =
    Array.from(
      uniqueNewOffersMap.values()
    );

  return {
    ok:
      true,

    action:
      "auto-discover",

    group:
      selection.group ||
      null,

    cursor:
      selection.cursor,

    nextCursor:
      selection.nextCursor,

    scannedCategoryCount:
      categories.length,

    successfulCategoryCount:
      categories.filter(
        (category) =>
          category.ok === true
      ).length,

    failedCategoryCount:
      categories.filter(
        (category) =>
          category.ok !== true
      ).length,

    totalNewQueued:
      newOffers.length,

    categories,

    newOffers,

    note:
      "Ofertas high/medium novas entram como awaiting_affiliate_link. Itens já existentes na fila, inclusive sent, não são duplicados.",

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}

export async function handleQueueSummaryAction(
  req
) {
  assertQueueAdmin(
    req
  );

  const result =
    await listPublicationQueue({
      limit:
        100
    });

  const counts = {
    awaiting_affiliate_link:
      0,

    ready_to_publish:
      0,

    sending:
      0,

    sent:
      0,

    send_error:
      0,

    rejected:
      0,

    other:
      0
  };

  const byCategory =
    {};

  for (
    const entry of
    result.entries ||
    []
  ) {
    const status =
      entry.status ||
      "other";

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          counts,
          status
        )
    ) {
      counts[status] +=
        1;
    } else {
      counts.other +=
        1;
    }

    const category =
      entry.ttCategoryName ||
      entry.ttCategoryId ||
      "Sem categoria";

    byCategory[category] =
      (
        byCategory[category] ||
        0
      ) +
      1;
  }

  const awaitingAffiliateLinks =
    (
      result.entries ||
      []
    )
      .filter(
        (entry) =>
          entry.status ===
          "awaiting_affiliate_link"
      )
      .slice(
        0,
        10
      )
      .map(
        (entry) => ({
          itemId:
            entry.itemId,

          productId:
            entry.productId,

          title:
            entry.title,

          price:
            entry.price,

          ttCategoryName:
            entry.ttCategoryName,

          catalogPageUrl:
            entry.catalogPageUrl
        })
      );

  return {
    ok:
      true,

    action:
      "queue-summary",

    total:
      result.count,

    counts,

    byCategory,

    awaitingAffiliateLinks,

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}

export async function handleQueueDedupeAction(
  req
) {
  assertQueueAdmin(
    req
  );

  const result =
    await repairPublicationQueueDuplicates();

  return {
    ok:
      true,

    action:
      "queue-dedupe",

    ...result,

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}

