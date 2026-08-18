const TABLE =
  "tt_publication_queue";

const SYNTHETIC_PREFIX =
  "supabase://tt_publication_queue/";

function requireSupabaseConfiguration() {
  const url =
    String(
      process.env
        .SUPABASE_URL ||
      ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  const secretKey =
    String(
      process.env
        .SUPABASE_SECRET_KEY ||
      ""
    )
      .trim();

  if (
    !url ||
    !secretKey
  ) {
    throw new Error(
      "Faltam SUPABASE_URL e/ou SUPABASE_SECRET_KEY no Vercel."
    );
  }

  return {
    url,
    secretKey
  };
}

async function supabaseRequest(
  path,
  {
    method = "GET",
    body = null,
    prefer = null,
    allowConflict = false
  } = {}
) {
  const {
    url,
    secretKey
  } =
    requireSupabaseConfiguration();

  const headers = {
    Accept:
      "application/json",

    apikey:
      secretKey,

    Authorization:
      `Bearer ${secretKey}`
  };

  if (
    body !== null
  ) {
    headers[
      "Content-Type"
    ] =
      "application/json";
  }

  if (
    prefer
  ) {
    headers.Prefer =
      prefer;
  }

  const response =
    await fetch(
      `${url}/rest/v1/${path}`,
      {
        method,
        headers,

        body:
          body === null
            ? undefined
            : JSON.stringify(
                body
              )
      }
    );

  const text =
    await response.text();

  let payload =
    null;

  if (text) {
    try {
      payload =
        JSON.parse(
          text
        );
    } catch {
      payload =
        text;
    }
  }

  if (
    !response.ok
  ) {
    if (
      allowConflict &&
      response.status === 409
    ) {
      return {
        status:
          response.status,

        conflict:
          true,

        payload
      };
    }

    const detail =
      payload?.message ||
      payload?.details ||
      payload?.hint ||
      (
        typeof payload ===
        "string"
          ? payload
          : null
      ) ||
      `HTTP ${response.status}`;

    const error =
      new Error(
        `Supabase: ${detail}`
      );

    error.statusCode =
      response.status;

    error.supabase =
      payload;

    throw error;
  }

  return {
    status:
      response.status,

    conflict:
      false,

    payload
  };
}

function safeItemId(
  value
) {
  const itemId =
    String(
      value ||
      ""
    )
      .trim()
      .toUpperCase();

  if (
    !/^MLB\d+$/.test(
      itemId
    )
  ) {
    return null;
  }

  return itemId;
}

function safeProductId(
  value
) {
  const productId =
    String(
      value ||
      ""
    )
      .trim()
      .toUpperCase();

  if (!productId) {
    return null;
  }

  if (
    !/^MLB\d+$/.test(
      productId
    )
  ) {
    return null;
  }

  return productId;
}

function pathnameFor(
  itemId
) {
  return (
    SYNTHETIC_PREFIX +
    itemId
  );
}

function rowEnvelope(
  row
) {
  const payload =
    row?.payload;

  if (
    payload &&
    typeof payload ===
      "object" &&
    payload.data
  ) {
    return payload;
  }

  // Compatibilidade defensiva caso algum registro seja
  // inserido manualmente no banco.
  return {
    version:
      1,

    status:
      row?.status ||
      null,

    queuedAt:
      row?.queued_at ||
      null,

    updatedAt:
      row?.updated_at ||
      null,

    source:
      "supabase",

    data: {
      itemId:
        row?.item_id ||
        null,

      productId:
        row?.product_id ||
        null,

      ttCategoryId:
        row?.tt_category_id ||
        null,

      title:
        row?.title ||
        null,

      score:
        row?.score ??
        null,

      priority:
        row?.priority ||
        null,

      affiliateLink:
        row?.affiliate_url ||
        null,

      publicationStatus:
        row?.status ||
        null
    }
  };
}

function rowToQueueEntry(
  row
) {
  const envelope =
    rowEnvelope(
      row
    );

  const data =
    envelope.data ||
    {};

  return {
    pathname:
      pathnameFor(
        row.item_id
      ),

    status:
      row.status ||
      envelope.status ||
      null,

    queuedAt:
      row.queued_at ||
      envelope.queuedAt ||
      null,

    updatedAt:
      row.updated_at ||
      envelope.updatedAt ||
      null,

    affiliateAttachedAt:
      envelope
        .affiliateAttachedAt ||
      null,

    itemId:
      data.itemId ||
      row.item_id ||
      null,

    productId:
      data.productId ||
      row.product_id ||
      null,

    catalogPageUrl:
      data.catalogPageUrl ||
      (
        (
          data.productId ||
          row.product_id
        )
          ? `https://www.mercadolivre.com.br/p/${
              data.productId ||
              row.product_id
            }`
          : null
      ),

    title:
      data.title ||
      row.title ||
      null,

    price:
      data.price ??
      null,

    discount:
      data.discount ??
      null,

    ttCategoryId:
      data.ttCategoryId ||
      row.tt_category_id ||
      null,

    ttCategoryName:
      data.ttCategoryName ||
      null,

    affiliateLinkStatus:
      data.affiliateLinkStatus ||
      null,

    publicationStatus:
      data.publicationStatus ||
      row.status ||
      null,

    messageDraft:
      data.messageDraft ||
      null,

    whatsappPayload:
      data.whatsappPayload ||
      null,

    delivery:
      data.delivery ||
      null,

    retryCount:
      Number(
        data.retryCount ||
        0
      ) || 0
  };
}

async function fetchOneByItemId(
  itemId
) {
  const safe =
    safeItemId(
      itemId
    );

  if (!safe) {
    return null;
  }

  const {
    payload
  } =
    await supabaseRequest(
      `${TABLE}` +
      `?item_id=eq.${encodeURIComponent(safe)}` +
      "&select=*" +
      "&limit=1"
    );

  return (
    Array.isArray(
      payload
    ) &&
    payload.length
      ? payload[0]
      : null
  );
}

async function fetchOneByProductId(
  productId
) {
  const safe =
    safeProductId(
      productId
    );

  if (!safe) {
    return null;
  }

  const {
    payload
  } =
    await supabaseRequest(
      `${TABLE}` +
      `?product_id=eq.${encodeURIComponent(safe)}` +
      "&select=*" +
      "&limit=1"
    );

  return (
    Array.isArray(
      payload
    ) &&
    payload.length
      ? payload[0]
      : null
  );
}

async function queueOne(
  candidate
) {
  const itemId =
    safeItemId(
      candidate?.itemId
    );

  if (!itemId) {
    throw new Error(
      "Não é possível enfileirar oferta sem itemId válido."
    );
  }

  const productId =
    safeProductId(
      candidate?.productId
    );

  if (productId) {
    const existingProduct =
      await fetchOneByProductId(
        productId
      );

    if (
      existingProduct
    ) {
      return {
        itemId,

        productId,

        queued:
          true,

        alreadyQueued:
          true,

        dedupeBy:
          "productId",

        existingItemId:
          existingProduct.item_id ||
          null,

        existingStatus:
          existingProduct.status ||
          null,

        pathname:
          pathnameFor(
            existingProduct.item_id
          ),

        uploadedAt:
          null
      };
    }
  }

  const existingItem =
    await fetchOneByItemId(
      itemId
    );

  if (
    existingItem
  ) {
    return {
      itemId,

      productId,

      queued:
        true,

      alreadyQueued:
        true,

      dedupeBy:
        "itemId",

      existingItemId:
        existingItem.item_id,

      existingStatus:
        existingItem.status,

      pathname:
        pathnameFor(
          existingItem.item_id
        ),

      uploadedAt:
        null
    };
  }

  const now =
    new Date()
      .toISOString();

  const envelope = {
    version:
      1,

    status:
      "awaiting_affiliate_link",

    queuedAt:
      now,

    updatedAt:
      now,

    source:
      "tt_automatic_discovery",

    data:
      candidate
  };

  const row = {
    item_id:
      itemId,

    product_id:
      productId,

    tt_category_id:
      candidate
        ?.ttCategoryId ||
      null,

    status:
      "awaiting_affiliate_link",

    priority:
      candidate
        ?.priority ||
      null,

    score:
      candidate
        ?.score ??
      null,

    title:
      candidate
        ?.title ||
      null,

    affiliate_url:
      candidate
        ?.affiliateLink ||
      null,

    payload:
      envelope,

    queued_at:
      now,

    updated_at:
      now,

    sent_at:
      null
  };

  const inserted =
    await supabaseRequest(
      TABLE,
      {
        method:
          "POST",

        body:
          row,

        prefer:
          "return=representation",

        allowConflict:
          true
      }
    );

  if (
    inserted.conflict
  ) {
    // Corrida entre duas execuções. O índice UNIQUE de
    // product_id/item_id no Postgres decide o vencedor.
    const afterRace =
      (
        productId
          ? await fetchOneByProductId(
              productId
            )
          : null
      ) ||
      await fetchOneByItemId(
        itemId
      );

    if (
      afterRace
    ) {
      return {
        itemId,

        productId,

        queued:
          true,

        alreadyQueued:
          true,

        dedupeBy:
          (
            productId &&
            afterRace.product_id ===
              productId
          )
            ? "productId"
            : "itemId",

        existingItemId:
          afterRace.item_id,

        existingStatus:
          afterRace.status,

        pathname:
          pathnameFor(
            afterRace.item_id
          ),

        uploadedAt:
          null
      };
    }

    throw new Error(
      "Conflito ao inserir oferta no Supabase, mas o registro vencedor não foi localizado."
    );
  }

  return {
    itemId,

    productId,

    queued:
      true,

    alreadyQueued:
      false,

    dedupeBy:
      null,

    pathname:
      pathnameFor(
        itemId
      ),

    uploadedAt:
      now
  };
}

export async function queuePendingPublications(
  candidates = []
) {
  requireSupabaseConfiguration();

  const values =
    Array.isArray(
      candidates
    )
      ? candidates
      : [];

  const results =
    [];

  for (
    const candidate of
    values
  ) {
    results.push(
      await queueOne(
        candidate
      )
    );
  }

  return {
    requestedCount:
      values.length,

    queuedCount:
      results.filter(
        (item) =>
          item.queued ===
          true
      ).length,

    newQueuedCount:
      results.filter(
        (item) =>
          item.queued ===
            true &&
          item.alreadyQueued ===
            false
      ).length,

    duplicateCount:
      results.filter(
        (item) =>
          item.alreadyQueued ===
          true
      ).length,

    results
  };
}

export async function listPublicationQueue({
  status = null,
  limit = 50
} = {}) {
  requireSupabaseConfiguration();

  const safeLimit =
    Math.min(
      Math.max(
        Number(
          limit
        ) || 1,
        1
      ),
      100
    );

  const filters =
    [];

  if (
    status
  ) {
    filters.push(
      `status=eq.${encodeURIComponent(
        String(status)
          .trim()
          .toLowerCase()
      )}`
    );
  }

  filters.push(
    "select=*"
  );

  filters.push(
    "order=queued_at.asc"
  );

  filters.push(
    `limit=${safeLimit}`
  );

  const {
    payload
  } =
    await supabaseRequest(
      `${TABLE}?${filters.join("&")}`
    );

  const rows =
    Array.isArray(
      payload
    )
      ? payload
      : [];

  const entries =
    rows.map(
      rowToQueueEntry
    );

  return {
    statusFilter:
      status,

    count:
      entries.length,

    storage:
      "supabase",

    entries
  };
}

export async function findQueuedPublicationByItemId(
  itemId
) {
  requireSupabaseConfiguration();

  const row =
    await fetchOneByItemId(
      itemId
    );

  if (!row) {
    return null;
  }

  return {
    pathname:
      pathnameFor(
        row.item_id
      ),

    envelope:
      rowEnvelope(
        row
      )
  };
}

export async function findQueuedPublicationByProductId(
  productId
) {
  requireSupabaseConfiguration();

  const row =
    await fetchOneByProductId(
      productId
    );

  if (!row) {
    return null;
  }

  return {
    pathname:
      pathnameFor(
        row.item_id
      ),

    envelope:
      rowEnvelope(
        row
      )
  };
}

export async function repairPublicationQueueDuplicates() {
  requireSupabaseConfiguration();

  // O Supabase/Postgres impede novas duplicatas de product_id
  // pelo índice UNIQUE parcial criado na Etapa 6.18A.
  //
  // Portanto esta função permanece para compatibilidade com o
  // restante do sistema, mas não precisa varrer/reescrever a fila.
  const {
    payload
  } =
    await supabaseRequest(
      `${TABLE}?select=item_id&limit=1000`
    );

  return {
    storage:
      "supabase",

    scannedCount:
      Array.isArray(
        payload
      )
        ? payload.length
        : 0,

    duplicateGroups:
      0,

    markedCount:
      0,

    historicalSentDuplicates:
      0,

    marked:
      [],

    protectedBy:
      "unique_product_id_index"
  };
}

function itemIdFromContext({
  pathname,
  envelope
}) {
  const direct =
    safeItemId(
      envelope
        ?.data
        ?.itemId
    );

  if (direct) {
    return direct;
  }

  const text =
    String(
      pathname ||
      ""
    );

  const match =
    text.match(
      /MLB\d+/i
    );

  return match
    ? safeItemId(
        match[0]
      )
    : null;
}

async function updateRowByItemId(
  itemId,
  patch
) {
  const safe =
    safeItemId(
      itemId
    );

  if (!safe) {
    throw new Error(
      "itemId inválido ao atualizar fila."
    );
  }

  const {
    payload
  } =
    await supabaseRequest(
      `${TABLE}` +
      `?item_id=eq.${encodeURIComponent(safe)}`,
      {
        method:
          "PATCH",

        body:
          patch,

        prefer:
          "return=representation"
      }
    );

  if (
    !Array.isArray(
      payload
    ) ||
    payload.length ===
      0
  ) {
    const error =
      new Error(
        "Oferta não encontrada na fila."
      );

    error.statusCode =
      404;

    throw error;
  }

  return payload[0];
}

export async function markPublicationAffiliateReady({
  pathname,
  envelope,
  affiliateLink,
  validatedOffer
}) {
  requireSupabaseConfiguration();

  if (
    !envelope?.data ||
    !affiliateLink
  ) {
    throw new Error(
      "Dados insuficientes para atualizar a fila."
    );
  }

  const itemId =
    itemIdFromContext({
      pathname,
      envelope
    });

  if (!itemId) {
    throw new Error(
      "Não foi possível identificar o itemId da oferta."
    );
  }

  const oldDraft =
    String(
      envelope
        .data
        .messageDraft ||
      ""
    );

  const finalMessage =
    oldDraft.includes(
      "[LINK_AFILIADO_PENDENTE]"
    )
      ? oldDraft.replace(
          "[LINK_AFILIADO_PENDENTE]",
          affiliateLink
        )
      : (
          oldDraft
            ? `${oldDraft}\n${affiliateLink}`
            : affiliateLink
        );

  const now =
    new Date()
      .toISOString();

  const updated = {
    ...envelope,

    status:
      "ready_to_publish",

    updatedAt:
      now,

    affiliateAttachedAt:
      now,

    affiliateValidation: {
      source:
        "api_offer_validation",

      resolvedItemId:
        validatedOffer
          ?.itemId ||
        null,

      resolvedProductId:
        validatedOffer
          ?.productId ||
        null,

      validatedAt:
        now
    },

    data: {
      ...envelope.data,

      affiliateLink,

      affiliateLinkStatus:
        "verified",

      publicationStatus:
        "ready_to_publish",

      messageDraft:
        finalMessage,

      whatsappPayload: {
        image:
          envelope.data
            .image ||
          validatedOffer
            ?.image ||
          null,

        caption:
          finalMessage,

        ttCategoryId:
          envelope.data
            .ttCategoryId ||
          null,

        ttCategoryName:
          envelope.data
            .ttCategoryName ||
          null
      }
    }
  };

  const row =
    await updateRowByItemId(
      itemId,
      {
        status:
          "ready_to_publish",

        tt_category_id:
          updated.data
            .ttCategoryId ||
          null,

        priority:
          updated.data
            .priority ||
          null,

        score:
          updated.data
            .score ??
          null,

        title:
          updated.data
            .title ||
          null,

        affiliate_url:
          affiliateLink,

        payload:
          updated,

        updated_at:
          now
      }
    );

  return {
    updated:
      true,

    pathname:
      pathnameFor(
        row.item_id
      ),

    status:
      updated.status,

    data:
      updated.data,

    storage:
      "supabase"
  };
}

const DELIVERY_STATUSES =
  new Set([
    "ready_to_publish",
    "sending",
    "sent",
    "send_error",
    "rejected"
  ]);

function normalizeDeliveryStatus(
  status
) {
  const value =
    String(
      status ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    !DELIVERY_STATUSES.has(
      value
    )
  ) {
    throw new Error(
      `Status de entrega inválido: ${value || "(vazio)"}`
    );
  }

  return value;
}

export async function updatePublicationDeliveryState({
  itemId,
  status,
  groupJid = null,
  groupName = null,
  whatsappMessageId = null,
  errorMessage = null,
  retryRequested = false
}) {
  requireSupabaseConfiguration();

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

  const nextStatus =
    normalizeDeliveryStatus(
      status
    );

  const envelope =
    queued.envelope;

  const data =
    envelope.data ||
    {};

  const now =
    new Date()
      .toISOString();

  const previousRetryCount =
    Number(
      data.retryCount ||
      0
    ) || 0;

  const retryCount =
    nextStatus ===
      "send_error"
      ? previousRetryCount +
        1
      : previousRetryCount;

  const delivery = {
    ...(
      data.delivery ||
      {}
    ),

    status:
      nextStatus,

    updatedAt:
      now,

    groupJid:
      groupJid ||
      data.delivery
        ?.groupJid ||
      null,

    groupName:
      groupName ||
      data.delivery
        ?.groupName ||
      null,

    whatsappMessageId:
      whatsappMessageId ||
      data.delivery
        ?.whatsappMessageId ||
      null,

    lastError:
      nextStatus ===
        "send_error"
        ? (
            errorMessage ||
            "Erro de envio não informado."
          )
        : (
            retryRequested
              ? null
              : data.delivery
                  ?.lastError ||
                null
          )
  };

  if (
    nextStatus ===
    "sending"
  ) {
    delivery.sendingAt =
      now;
  }

  if (
    nextStatus ===
    "sent"
  ) {
    delivery.sentAt =
      now;

    delivery.lastError =
      null;
  }

  if (
    nextStatus ===
    "send_error"
  ) {
    delivery.failedAt =
      now;
  }

  if (
    nextStatus ===
    "rejected"
  ) {
    delivery.rejectedAt =
      now;
  }

  if (
    retryRequested
  ) {
    delivery.retryRequestedAt =
      now;

    delivery.lastError =
      null;
  }

  const updated = {
    ...envelope,

    status:
      nextStatus,

    updatedAt:
      now,

    data: {
      ...data,

      publicationStatus:
        nextStatus,

      retryCount,

      delivery
    }
  };

  const row =
    await updateRowByItemId(
      itemId,
      {
        status:
          nextStatus,

        payload:
          updated,

        updated_at:
          now,

        sent_at:
          nextStatus ===
            "sent"
            ? now
            : null
      }
    );

  return {
    updated:
      true,

    pathname:
      pathnameFor(
        row.item_id
      ),

    itemId:
      data.itemId ||
      itemId,

    status:
      nextStatus,

    retryCount,

    delivery,

    storage:
      "supabase"
  };
}
