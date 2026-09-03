import {
  findQueuedPublicationByItemId,
  listPublicationQueue,
  markPublicationAffiliateReady,
  queueCircularReservePublication,
  queuePendingPublications,
  repairPublicationQueueDuplicates,
  repairUnsafeReadyAffiliateLinks,
  updatePublicationDeliveryState
} from "./tt-pending-publication-store.js";

import {
  buildPublicationPlan
} from "./tt-publication-planner.js";

import {
  selectDiscoverySeeds
} from "./tt-discovery-seeds.js";

import {
  takeContinuousDiscoveryPage,
  commitContinuousDiscoveryPage
} from "./tt-continuous-discovery-state.js";

import {
  addFallbackReserveEntry,
  claimNextFallbackReserve,
  completeFallbackReserveByItemId,
  listFallbackReserve,
  removeFallbackReserveEntry,
  summarizeFallbackReserve,
  updateFallbackReserveEntry
} from "./tt-fallback-reserve-store.js";

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
  let unsafeAffiliateRepair = null;

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
    unsafeAffiliateRepair =
      await repairUnsafeReadyAffiliateLinks();

    dedupe =
      await repairPublicationQueueDuplicates();
  }

  return {
    ok:
      true,

    action:
      "queue-list",

    dedupe,

    unsafeAffiliateRepair,

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

      // TT_AFFILIATE_VALIDATION_MESSAGE_FIX_V1
      error:
        validation.reason ===
          "affiliate_link_resolution_failed"
          ? (
              "Não consegui validar o link afiliado porque a consulta ao Mercado Livre falhou temporariamente." +
              (
                validation.resolved?.error
                  ? ` Detalhe: ${validation.resolved.error}`
                  : ""
              )
            )
          : "O link afiliado não corresponde ao produto enfileirado.",

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

    catalogPageUrl:
      offer.catalogPageUrl ||
      offer.permalink ||
      offer.url ||
      null,

    sellerId:
      offer.sellerId ??
      offer.seller_id ??
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

    selectionRule:
      "category_only",

    rank:
      null
  };
}

async function ingestResolvedAffiliateOffer({
  affiliateLink,
  offer,
  manualPanel = false
}) {
  const candidate = {
    ...offerToShortlistCandidate(
      offer
    ),

    priority:
      manualPanel
        ? "manual_panel"
        : null,

    source:
      manualPanel
        ? "tt_panel_manual"
        : null,

    manualPanel:
      manualPanel === true
  };

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


  if (
    manualPanel
  ) {
    const queueInfo =
      queueResult
        .results?.[0] ||
      null;

    if (
      queueInfo?.alreadyQueued === true &&
      ["sent", "rejected"].includes(
        String(
          queueInfo.existingStatus ||
          ""
        )
      )
    ) {
      return {
        affiliateLink,
        status:
          "held",
        queued:
          false,
        alreadyQueued:
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
        price:
          offer.price ??
          null,
        ttCategoryId:
          offer.ttCategoryId ||
          null,
        ttCategoryName:
          offer.ttCategoryName ||
          null,
        heldReason:
          "already_sent_or_closed_by_current_rules"
      };
    }

    return {
      affiliateLink,
      status:
        "awaiting_affiliate_link",
      queued:
        true,
      alreadyQueued:
        queueInfo
          ?.alreadyQueued ===
          true,
      priority:
        "manual_panel",
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
      ttCategoryId:
        offer.ttCategoryId ||
        null,
      ttCategoryName:
        offer.ttCategoryName ||
        null,
      publicationStatus:
        "awaiting_affiliate_link",
      affiliateLinkStatus:
        "pending_local_generation",
      message:
        "Na fila com prioridade. O publisher da VPS vai gerar e validar o meli.la antes do envio."
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

  const manualPanel =
    body.manualPanel ===
      true;

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
            resolved.offer,

          manualPanel
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

  const pending =
    results.filter(
      (item) =>
        item.status ===
        "awaiting_affiliate_link"
    );

  const failed =
    results.filter(
      (item) =>
        item.status !==
          "ready_to_publish" &&
        item.status !==
          "held" &&
        item.status !==
          "awaiting_affiliate_link"
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

    pendingCount:
      pending.length,

    failedCount:
      failed.length,

    results,

    policy: {
      selectionRule:
        "category_and_publishable_core",

      scoreEnabled:
        false,

      priorityEnabled:
        manualPanel,

      maxLinksPerRequest:
        10
    },

    accessTokenExposed:
      false,

    refreshTokenExposed:
      false
  };
}


const RESERVE_GROUP_CATEGORY = {
  eletronicos: {
    ttCategoryId: "tecnologia_games",
    ttCategoryName: "Tecnologia & Games",
    ttCategoryEmoji: "📱"
  },
  fitness: {
    ttCategoryId: "saude_fitness",
    ttCategoryName: "Saúde & Fitness",
    ttCategoryEmoji: "💪"
  },
  perfumes: {
    ttCategoryId: "moda_beleza",
    ttCategoryName: "Moda & Beleza",
    ttCategoryEmoji: "🌸"
  }
};

function normalizeReserveGroup(value) {
  const group = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(RESERVE_GROUP_CATEGORY, group)
    ? group
    : null;
}


function normalizeReserveText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function reserveOfferMatchesGroup(group, offer) {
  const title = normalizeReserveText(offer?.title);
  const category = normalizeReserveText(
    [offer?.ttCategoryName, offer?.rootCategory]
      .filter(Boolean)
      .join(" ")
  );

  if (group === "perfumes") {
    const exclusions = [
      "porta perfume", "porta-perfume", "frasco vazio", "decant",
      "amostra perfume", "atomizador vazio"
    ];

    if (exclusions.some((term) => title.includes(term))) return false;

    return [
      "perfume", "parfum", "eau de parfum", "eau de toilette",
      "eau de cologne", "deo parfum", "deo colonia", "fragrancia",
      "colonia", "body splash", "body mist"
    ].some((term) => title.includes(term) || category.includes(term)) ||
      /(^|[\s\-\/])(edt|edp)(?=$|[\s\-\/0-9])/i.test(title);
  }

  if (group === "fitness") {
    return [
      "fitness", "academia", "musculacao", "treino", "exercicio",
      "creatina", "whey", "proteina", "suplemento", "pre treino",
      "bcaa", "glutamina", "halter", "anilha", "kettlebell",
      "supino", "bicicleta ergometrica", "spinning", "esteira",
      "corda", "faixa elastica", "colchonete", "yoga", "pilates",
      "corrida", "dry fit"
    ].some((term) => title.includes(term) || category.includes(term));
  }

  // Eletrônicos já é protegido pelo roteamento explícito de categoria e
  // pelo link que o usuário escolheu para este banco.
  return group === "eletronicos";
}

export async function handleReserveAddAction(req) {
  assertQueueAdmin(req);

  const body = typeof req.body === "string"
    ? JSON.parse(req.body || "{}")
    : (req.body || {});

  const group = normalizeReserveGroup(body.group);
  const links = normalizeAffiliateLinks(body);

  if (!group) {
    const error = new Error("Grupo inválido. Use eletronicos, fitness ou perfumes.");
    error.statusCode = 400;
    throw error;
  }

  if (!links.length) {
    const error = new Error("Envie pelo menos um link do Mercado Livre para a reserva.");
    error.statusCode = 400;
    throw error;
  }

  const results = [];

  for (const originalUrl of links) {
    try {
      const resolved = await resolveAffiliateOffer(originalUrl);

      if (!resolved.ok) {
        results.push({
          originalUrl,
          status: "resolution_failed",
          added: false,
          error: resolved.error || resolved.reason || "Não consegui abrir a oferta."
        });
        continue;
      }

      const stored = await addFallbackReserveEntry({
        group,
        originalUrl,
        offer: resolved.offer
      });

      results.push({
        originalUrl,
        status: stored.duplicate ? "duplicate" : "available",
        added: stored.added,
        duplicate: stored.duplicate,
        id: stored.reserve?.id || null,
        itemId: stored.reserve?.itemId || null,
        productId: stored.reserve?.productId || null,
        title: stored.reserve?.title || resolved.offer?.title || null,
        price: stored.reserve?.price ?? resolved.offer?.price ?? null
      });
    } catch (error) {
      results.push({
        originalUrl,
        status: "error",
        added: false,
        error: error?.message || "Erro inesperado ao adicionar reserva."
      });
    }
  }

  const summary = await summarizeFallbackReserve();

  return {
    ok: true,
    allSucceeded: results.every((item) => item.status !== "error" && item.status !== "resolution_failed"),
    action: "reserve-add",
    group,
    requestedCount: links.length,
    addedCount: results.filter((item) => item.added).length,
    duplicateCount: results.filter((item) => item.duplicate).length,
    failedCount: results.filter((item) => item.status === "error" || item.status === "resolution_failed").length,
    results,
    summary,
    accessTokenExposed: false,
    refreshTokenExposed: false
  };
}

export async function handleReserveSummaryAction(req) {
  assertQueueAdmin(req);

  return {
    ok: true,
    action: "reserve-summary",
    summary: await summarizeFallbackReserve(),
    accessTokenExposed: false,
    refreshTokenExposed: false
  };
}

export async function handleReserveListAction(req) {
  assertQueueAdmin(req);

  const group = req.query?.group ? normalizeReserveGroup(req.query.group) : null;
  if (req.query?.group && !group) {
    const error = new Error("Grupo de reserva inválido.");
    error.statusCode = 400;
    throw error;
  }

  const status = String(req.query?.status || "available").trim().toLowerCase();

  return {
    ok: true,
    action: "reserve-list",
    reserve: await listFallbackReserve({
      group,
      status,
      limit: req.query?.limit || 20
    }),
    accessTokenExposed: false,
    refreshTokenExposed: false
  };
}

export async function handleReserveRemoveAction(req) {
  assertQueueAdmin(req);

  const body = typeof req.body === "string"
    ? JSON.parse(req.body || "{}")
    : (req.body || {});

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("ID de reserva inválido.");
    error.statusCode = 400;
    throw error;
  }

  const reserve = await removeFallbackReserveEntry(id);

  return {
    ok: true,
    action: "reserve-remove",
    removed: Boolean(reserve),
    reserve,
    accessTokenExposed: false,
    refreshTokenExposed: false
  };
}

export async function handleReserveMaterializeAction(req) {
  assertQueueAdmin(req);

  const body = typeof req.body === "string"
    ? JSON.parse(req.body || "{}")
    : (req.body || {});

  const group = normalizeReserveGroup(body.group);
  if (!group) {
    const error = new Error("Grupo de reserva inválido.");
    error.statusCode = 400;
    throw error;
  }

  const forcedCategory = RESERVE_GROUP_CATEGORY[group];
  const skipped = [];

  // Pode pular links vencidos/duplicados até encontrar um materializável.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reserve = await claimNextFallbackReserve(group);

    if (!reserve) {
      return {
        ok: true,
        action: "reserve-materialize",
        group,
        queued: false,
        empty: true,
        skipped,
        accessTokenExposed: false,
        refreshTokenExposed: false
      };
    }

    try {
      const resolved = await resolveAffiliateOffer(reserve.originalUrl);

      if (!resolved.ok) {
        await updateFallbackReserveEntry({
          id: reserve.id,
          status: "expired",
          failureReason: resolved.error || resolved.reason || "offer_resolution_failed"
        });

        skipped.push({ id: reserve.id, status: "expired", title: reserve.title });
        continue;
      }

      const freshOffer = {
        ...resolved.offer,
        ...forcedCategory
      };

      if (!reserveOfferMatchesGroup(group, freshOffer)) {
        await updateFallbackReserveEntry({
          id: reserve.id,
          status: "rejected",
          title: freshOffer.title || reserve.title,
          price: freshOffer.price,
          failureReason: "reserve_group_mismatch",
          metadata: {
            ...(reserve.metadata || {}),
            lastResolvedOffer: freshOffer,
            checkedAt: new Date().toISOString()
          }
        });

        skipped.push({
          id: reserve.id,
          status: "rejected",
          title: freshOffer.title || reserve.title,
          reason: "reserve_group_mismatch"
        });
        continue;
      }

      const candidate = offerToShortlistCandidate(freshOffer);
      const plan = buildPublicationPlan({
        shortlist: [candidate],
        maxPublications: 1
      });

      if (!plan.ready.length) {
        await updateFallbackReserveEntry({
          id: reserve.id,
          status: "rejected",
          title: freshOffer.title || reserve.title,
          price: freshOffer.price,
          failureReason: plan.held?.[0]?.reason || "missing_core_offer_data",
          metadata: {
            ...(reserve.metadata || {}),
            lastResolvedOffer: freshOffer,
            checkedAt: new Date().toISOString()
          }
        });

        skipped.push({ id: reserve.id, status: "rejected", title: freshOffer.title || reserve.title });
        continue;
      }

      const ready = plan.ready[0];

      const queueOutcome =
        group === "perfumes"
          ? await queueCircularReservePublication(ready)
          : (
              await queuePendingPublications([ready])
            ).results?.[0] || null;

      if (!queueOutcome || (queueOutcome.alreadyQueued === true && queueOutcome.requeued !== true)) {
        await updateFallbackReserveEntry({
          id: reserve.id,
          status: "duplicate",
          currentItemId: queueOutcome?.existingItemId || freshOffer.itemId || null,
          title: freshOffer.title || reserve.title,
          price: freshOffer.price,
          failureReason: "already_in_publication_queue_or_history",
          metadata: {
            ...(reserve.metadata || {}),
            lastResolvedOffer: freshOffer,
            checkedAt: new Date().toISOString()
          }
        });

        skipped.push({ id: reserve.id, status: "duplicate", title: freshOffer.title || reserve.title });
        continue;
      }

      const updatedReserve = await updateFallbackReserveEntry({
        id: reserve.id,
        status: "queued",
        currentItemId: ready.itemId,
        title: freshOffer.title || reserve.title,
        price: freshOffer.price,
        failureReason: null,
        metadata: {
          ...(reserve.metadata || {}),
          lastResolvedOffer: freshOffer,
          checkedAt: new Date().toISOString(),
          queueOutcome
        }
      });

      return {
        ok: true,
        action: "reserve-materialize",
        group,
        queued: true,
        empty: false,
        reserve: updatedReserve,
        itemId: ready.itemId,
        productId: ready.productId || null,
        title: ready.title,
        skipped,
        accessTokenExposed: false,
        refreshTokenExposed: false
      };
    } catch (error) {
      await updateFallbackReserveEntry({
        id: reserve.id,
        status: "expired",
        failureReason: error?.message || "unexpected_reserve_materialization_error"
      });

      skipped.push({
        id: reserve.id,
        status: "expired",
        title: reserve.title,
        error: error?.message || "unexpected_error"
      });
    }
  }

  return {
    ok: true,
    action: "reserve-materialize",
    group,
    queued: false,
    empty: false,
    exhaustedAttempts: true,
    skipped,
    accessTokenExposed: false,
    refreshTokenExposed: false
  };
}

export async function handleReserveCompleteAction(req) {
  assertQueueAdmin(req);

  const body = typeof req.body === "string"
    ? JSON.parse(req.body || "{}")
    : (req.body || {});

  const itemId = String(body.itemId || "").trim().toUpperCase();
  const status = String(body.status || "").trim().toLowerCase();

  if (!/^MLB\d+$/.test(itemId)) {
    const error = new Error("itemId de reserva inválido.");
    error.statusCode = 400;
    throw error;
  }

  if (!["used", "rejected", "expired"].includes(status)) {
    const error = new Error("status de conclusão inválido. Use used, rejected ou expired.");
    error.statusCode = 400;
    throw error;
  }

  const result = await completeFallbackReserveByItemId({
    itemId,
    status,
    failureReason: body.failureReason || null
  });

  return {
    ok: true,
    action: "reserve-complete",
    itemId,
    status,
    ...result,
    accessTokenExposed: false,
    refreshTokenExposed: false
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
        seed.categoryId ||
        null,

      categoryQuery:
        seed.categoryQuery ||
        null,

      usePredictedBrand:
        seed.usePredictedBrand ===
        true
          ? 1
          : null,

      scanOffset:
        seed.scanOffset ??
        0,

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

    brandFilter:
      result
        ?.discoveryCategory
        ?.brandFilter ||
      null,

    newOffers
  };
}


async function discoverOneCatalogPage(selection) {
  const url = buildInternalEndpointUrl({
    action: "catalog-search",
    catalogQuery: selection.query.q,
    catalogOffset: selection.offset,
    catalogLimit: selection.pageSize,
    group: selection.group,
    queue: 1
  });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-tt-admin-key": process.env.TT_QUEUE_ADMIN_KEY || ""
    }
  });

  let result = null;
  try { result = await response.json(); } catch { result = null; }

  const base = {
    seed: {
      key: `continuous_${selection.query.key}`,
      label: `${selection.query.label} · offset ${selection.offset}`,
      categoryQuery: selection.query.q
    },
    source: "catalog_search",
    query: selection.query.q,
    offset: selection.offset
  };

  if (!response.ok || !result?.ok) {
    return {
      ...base,
      ok: false,
      httpStatus: response.status,
      error: result?.error || result?.message || "catalog_search_failed",
      resetSuggested: result?.resetSuggested === true,
      candidateCount: 0,
      readyCount: 0,
      newQueuedCount: 0,
      duplicateCount: 0,
      requeuedCount: 0,
      newOffers: [],
      paging: result?.paging || null,
      resultCount: result?.resultCount || 0
    };
  }

  return {
    ...base,
    ok: true,
    candidateCount: result.candidateCount ?? 0,
    readyCount: result.readyCount ?? 0,
    newQueuedCount: result.newQueuedCount ?? 0,
    duplicateCount: result.duplicateCount ?? 0,
    requeuedCount: result.requeuedCount ?? 0,
    newOffers: Array.isArray(result.newOffers) ? result.newOffers : [],
    paging: result.paging || null,
    resultCount: result.resultCount ?? 0
  };
}

export async function handleContinuousDiscoverAction(req) {
  assertQueueAdmin(req);

  const body = typeof req.body === "string"
    ? JSON.parse(req.body || "{}")
    : (req.body || {});

  const group = String(body.group || req.query?.group || "")
    .trim()
    .toLowerCase();

  if (!["eletronicos", "fitness", "perfumes"].includes(group)) {
    const error = new Error("group deve ser eletronicos, fitness ou perfumes.");
    error.statusCode = 400;
    throw error;
  }

  const selection = await takeContinuousDiscoveryPage({
    group,
    pageSize: 3
  });

  let catalog;
  try {
    catalog = await discoverOneCatalogPage(selection);
  } catch (error) {
    catalog = {
      ok: false,
      seed: {
        key: `continuous_${selection.query.key}`,
        label: `${selection.query.label} · offset ${selection.offset}`
      },
      source: "catalog_search",
      query: selection.query.q,
      offset: selection.offset,
      error: error?.message || "unexpected_catalog_error",
      candidateCount: 0,
      readyCount: 0,
      newQueuedCount: 0,
      duplicateCount: 0,
      requeuedCount: 0,
      newOffers: [],
      resultCount: 0
    };
  }

  const committed = await commitContinuousDiscoveryPage(selection, {
    ok: catalog.ok,
    paging: catalog.paging,
    resultCount: catalog.resultCount,
    resetSuggested: catalog.resetSuggested
  });

  const categories = [catalog];

  // /highlights continua complementar, mas só entra quando a página contínua
  // não trouxe nada novo. Limitamos a aproximadamente 1 a cada 6 páginas.
  const useHighlightFallback =
    catalog.newQueuedCount === 0 &&
    (!catalog.ok || selection.sequence % 6 === 0);

  if (useHighlightFallback) {
    const fallback = selectDiscoverySeeds({
      cursor: selection.sequence,
      limit: 1,
      group
    });

    for (const seed of fallback.seeds) {
      try {
        categories.push(await discoverOneSeed(seed));
      } catch (error) {
        categories.push({
          ok: false,
          seed,
          source: "highlights_fallback",
          error: error?.message || "highlight_fallback_failed",
          newQueuedCount: 0,
          duplicateCount: 0,
          newOffers: []
        });
      }
    }
  }

  const rawNewOffers = categories.flatMap((category) => category.newOffers || []);
  const unique = new Map();
  for (const offer of rawNewOffers) {
    const key = offer?.productId || offer?.itemId;
    if (key && !unique.has(key)) unique.set(key, offer);
  }

  return {
    ok: true,
    action: "continuous-discover",
    group,
    source: "catalog_search_with_highlights_fallback",
    stream: {
      queryKey: selection.query.key,
      queryLabel: selection.query.label,
      query: selection.query.q,
      queryIndex: selection.queryIndex,
      queryCount: selection.queryCount,
      offset: selection.offset,
      pageSize: selection.pageSize,
      nextOffset: committed.nextOffset,
      exhausted: committed.exhausted,
      sequence: committed.sequence,
      rounds: committed.rounds
    },
    fallbackUsed: useHighlightFallback,
    scannedCategoryCount: categories.length,
    totalNewQueued: Array.from(unique.values()).length,
    categories,
    newOffers: Array.from(unique.values()),
    note:
      "Descoberta contínua por products/search com paginação persistente. " +
      "Highlights é apenas fallback. Dedupe permite republicação após cooldown quando a oferta muda.",
    accessTokenExposed: false,
    refreshTokenExposed: false
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

    poolSize:
      selection.poolSize,

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
      "Ofertas novas com dados mínimos entram na fila conforme a categoria. Não existe filtro por score/prioridade; itens já existentes, inclusive sent, não são duplicados.",

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

  let reserve = null;

  try {
    reserve = await summarizeFallbackReserve();
  } catch (error) {
    reserve = {
      unavailable: true,
      error: error?.message || "reserve_summary_failed"
    };
  }

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

    reserve,

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

