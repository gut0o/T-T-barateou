import {
  get,
  list,
  put
} from "@vercel/blob";

const QUEUE_PREFIX =
  "tt/publication-queue/pending/";

function requireBlobConfiguration() {
  if (
    !process.env
      .BLOB_READ_WRITE_TOKEN
  ) {
    throw new Error(
      "Falta BLOB_READ_WRITE_TOKEN no Vercel."
    );
  }
}

function sanitize(value) {
  return String(
    value || "unknown"
  )
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )
    .slice(
      0,
      120
    );
}

function buildPathname(candidate) {
  const category =
    sanitize(
      candidate
        ?.ttCategoryId ||
      "ofertas_variedades"
    );

  const itemId =
    sanitize(
      candidate?.itemId
    );

  if (
    !itemId ||
    itemId === "unknown"
  ) {
    throw new Error(
      "Não é possível enfileirar oferta sem itemId."
    );
  }

  return (
    `${QUEUE_PREFIX}` +
    `${category}/` +
    `${itemId}.json`
  );
}

async function findExactBlob(
  pathname
) {
  const result =
    await list({
      prefix:
        pathname,

      limit:
        10
    });

  return (
    result.blobs?.find(
      (blob) =>
        blob.pathname ===
        pathname
    ) ||
    null
  );
}

async function readBlobJson(
  pathname
) {
  const result =
    await get(
      pathname,
      {
        access:
          "private"
      }
    );

  if (
    !result ||
    result.statusCode !== 200 ||
    !result.stream
  ) {
    return null;
  }

  const text =
    await new Response(
      result.stream
    ).text();

  return JSON.parse(
    text
  );
}

async function queueOne(candidate) {
  const pathname =
    buildPathname(
      candidate
    );

  // O mesmo produto de catálogo pode mudar de seller/item representante.
  // Por isso a deduplicação principal é por productId, não apenas itemId.
  if (
    candidate?.productId
  ) {
    const existingProduct =
      await findQueuedPublicationByProductId(
        candidate.productId
      );

    if (existingProduct) {
      return {
        itemId:
          candidate.itemId,

        productId:
          candidate.productId,

        queued:
          true,

        alreadyQueued:
          true,

        dedupeBy:
          "productId",

        existingItemId:
          existingProduct.envelope
            ?.data
            ?.itemId ||
          null,

        existingStatus:
          existingProduct.envelope
            ?.status ||
          null,

        pathname:
          existingProduct.pathname,

        uploadedAt:
          null
      };
    }
  }

  const existing =
    await findExactBlob(
      pathname
    );

  if (existing) {
    return {
      itemId:
        candidate.itemId,

      productId:
        candidate.productId ||
        null,

      queued:
        true,

      alreadyQueued:
        true,

      dedupeBy:
        "itemId",

      pathname,

      uploadedAt:
        existing.uploadedAt ||
        null
    };
  }

  const envelope = {
    version: 1,

    status:
      "awaiting_affiliate_link",

    queuedAt:
      new Date()
        .toISOString(),

    updatedAt:
      new Date()
        .toISOString(),

    source:
      "tt_automatic_discovery",

    data:
      candidate
  };

  const body =
    JSON.stringify(
      envelope
    );

  try {
    const blob =
      await put(
        pathname,
        body,
        {
          access:
            "private",

          addRandomSuffix:
            false,

          contentType:
            "application/json",

          cacheControlMaxAge:
            60
        }
      );

    return {
      itemId:
        candidate.itemId,

      productId:
        candidate.productId ||
        null,

      queued:
        true,

      alreadyQueued:
        false,

      dedupeBy:
        null,

      pathname:
        blob.pathname ||
        pathname,

      uploadedAt:
        blob.uploadedAt ||
        null
    };
  } catch (error) {
    const afterRace =
      await findExactBlob(
        pathname
      );

    if (afterRace) {
      return {
        itemId:
          candidate.itemId,

        queued:
          true,

        alreadyQueued:
          true,

        pathname,

        uploadedAt:
          afterRace.uploadedAt ||
          null
      };
    }

    throw error;
  }
}

export async function queuePendingPublications(
  candidates = []
) {
  requireBlobConfiguration();

  const results =
    [];

  for (
    const candidate of
    candidates || []
  ) {
    results.push(
      await queueOne(
        candidate
      )
    );
  }

  return {
    requestedCount:
      candidates.length,

    queuedCount:
      results.filter(
        (item) =>
          item.queued === true
      ).length,

    newQueuedCount:
      results.filter(
        (item) =>
          item.queued === true &&
          item.alreadyQueued === false
      ).length,

    duplicateCount:
      results.filter(
        (item) =>
          item.alreadyQueued === true
      ).length,

    results
  };
}

async function listAllQueueBlobs() {
  requireBlobConfiguration();

  const all =
    [];

  let cursor =
    undefined;

  do {
    const result =
      await list({
        prefix:
          QUEUE_PREFIX,

        limit:
          1000,

        ...(cursor
          ? { cursor }
          : {})
      });

    all.push(
      ...(result.blobs || [])
    );

    cursor =
      result.cursor ||
      undefined;

    if (
      !result.hasMore
    ) {
      break;
    }
  } while (cursor);

  return all;
}

export async function listPublicationQueue({
  status = null,
  limit = 50
} = {}) {
  const blobs =
    await listAllQueueBlobs();

  const entries =
    [];

  for (
    const blob of
    blobs
  ) {
    if (
      entries.length >=
      Math.min(
        Math.max(
          Number(limit) || 1,
          1
        ),
        100
      )
    ) {
      break;
    }

    try {
      const envelope =
        await readBlobJson(
          blob.pathname
        );

      if (!envelope) {
        continue;
      }

      if (
        status &&
        envelope.status !==
          status
      ) {
        continue;
      }

      const data =
        envelope.data ||
        {};

      entries.push({
        pathname:
          blob.pathname,

        status:
          envelope.status ||
          null,

        queuedAt:
          envelope.queuedAt ||
          null,

        updatedAt:
          envelope.updatedAt ||
          null,

        affiliateAttachedAt:
          envelope
            .affiliateAttachedAt ||
          null,

        itemId:
          data.itemId ||
          null,

        productId:
          data.productId ||
          null,

        catalogPageUrl:
          data.catalogPageUrl ||
          (
            data.productId
              ? `https://www.mercadolivre.com.br/p/${data.productId}`
              : null
          ),

        title:
          data.title ||
          null,

        price:
          data.price ??
          null,

        discount:
          data.discount ??
          null,

        ttCategoryId:
          data.ttCategoryId ||
          null,

        ttCategoryName:
          data.ttCategoryName ||
          null,

        affiliateLinkStatus:
          data.affiliateLinkStatus ||
          null,

        publicationStatus:
          data.publicationStatus ||
          envelope.status ||
          null,

        messageDraft:
          data.messageDraft ||
          null,

        whatsappPayload:
          data.whatsappPayload ||
          null
      });
    } catch {
      // Uma entrada corrompida não derruba a listagem inteira.
    }
  }

  return {
    statusFilter:
      status,

    count:
      entries.length,

    entries
  };
}

export async function findQueuedPublicationByItemId(
  itemId
) {
  requireBlobConfiguration();

  const safeItemId =
    sanitize(
      itemId
    );

  if (
    !safeItemId ||
    safeItemId === "unknown"
  ) {
    return null;
  }

  const blobs =
    await listAllQueueBlobs();

  const match =
    blobs.find(
      (blob) =>
        blob.pathname.endsWith(
          `/${safeItemId}.json`
        )
    );

  if (!match) {
    return null;
  }

  const envelope =
    await readBlobJson(
      match.pathname
    );

  if (!envelope) {
    return null;
  }

  return {
    pathname:
      match.pathname,

    envelope
  };
}

export async function findQueuedPublicationByProductId(
  productId
) {
  requireBlobConfiguration();

  const safeProductId =
    String(
      productId ||
      ""
    )
      .trim()
      .toUpperCase();

  if (
    !/^MLB\d+$/.test(
      safeProductId
    )
  ) {
    return null;
  }

  const blobs =
    await listAllQueueBlobs();

  for (
    const blob of
    blobs
  ) {
    try {
      const envelope =
        await readBlobJson(
          blob.pathname
        );

      if (
        envelope
          ?.data
          ?.productId ===
        safeProductId
      ) {
        return {
          pathname:
            blob.pathname,

          envelope
        };
      }
    } catch {
      // Ignora blob inválido e continua procurando.
    }
  }

  return null;
}

function queueStatusWeight(
  status
) {
  switch (
    String(status || "")
  ) {
    case "sent":
      return 100;

    case "sending":
      return 90;

    case "ready_to_publish":
      return 80;

    case "awaiting_affiliate_link":
      return 70;

    case "send_error":
      return 60;

    case "rejected":
      return 20;

    case "duplicate_skipped":
      return 0;

    default:
      return 10;
  }
}

export async function repairPublicationQueueDuplicates() {
  requireBlobConfiguration();

  const blobs =
    await listAllQueueBlobs();

  const loaded =
    [];

  for (
    const blob of
    blobs
  ) {
    try {
      const envelope =
        await readBlobJson(
          blob.pathname
        );

      if (
        envelope
          ?.data
          ?.productId
      ) {
        loaded.push({
          pathname:
            blob.pathname,

          envelope
        });
      }
    } catch {
      // Não deixa um JSON quebrado derrubar a limpeza.
    }
  }

  const groups =
    new Map();

  for (
    const entry of
    loaded
  ) {
    const productId =
      entry.envelope
        .data
        .productId;

    const list =
      groups.get(
        productId
      ) ||
      [];

    list.push(
      entry
    );

    groups.set(
      productId,
      list
    );
  }

  let duplicateGroups =
    0;

  let markedCount =
    0;

  let historicalSentDuplicates =
    0;

  const marked =
    [];

  for (
    const [
      productId,
      entries
    ] of
    groups.entries()
  ) {
    if (
      entries.length <= 1
    ) {
      continue;
    }

    duplicateGroups +=
      1;

    const sorted =
      entries
        .slice()
        .sort(
          (a, b) => {
            const weightDiff =
              queueStatusWeight(
                b.envelope
                  ?.status
              ) -
              queueStatusWeight(
                a.envelope
                  ?.status
              );

            if (
              weightDiff !== 0
            ) {
              return weightDiff;
            }

            const aTime =
              Date.parse(
                a.envelope
                  ?.queuedAt ||
                ""
              ) ||
              Number.MAX_SAFE_INTEGER;

            const bTime =
              Date.parse(
                b.envelope
                  ?.queuedAt ||
                ""
              ) ||
              Number.MAX_SAFE_INTEGER;

            return (
              aTime -
              bTime
            );
          }
        );

    const keeper =
      sorted[0];

    for (
      const duplicate of
      sorted.slice(1)
    ) {
      const duplicateStatus =
        duplicate.envelope
          ?.status ||
        null;

      // Não alteramos histórico que já foi efetivamente enviado.
      // Mas qualquer cópia ainda ativa é neutralizada.
      if (
        duplicateStatus ===
        "sent"
      ) {
        historicalSentDuplicates +=
          1;

        continue;
      }

      if (
        duplicateStatus ===
        "duplicate_skipped"
      ) {
        continue;
      }

      const now =
        new Date()
          .toISOString();

      const updated = {
        ...duplicate.envelope,

        status:
          "duplicate_skipped",

        updatedAt:
          now,

        duplicateInfo: {
          detectedAt:
            now,

          productId,

          keptPathname:
            keeper.pathname,

          keptItemId:
            keeper.envelope
              ?.data
              ?.itemId ||
            null,

          keptStatus:
            keeper.envelope
              ?.status ||
            null
        },

        data: {
          ...(
            duplicate.envelope
              ?.data ||
            {}
          ),

          publicationStatus:
            "duplicate_skipped"
        }
      };

      await put(
        duplicate.pathname,
        JSON.stringify(
          updated
        ),
        {
          access:
            "private",

          addRandomSuffix:
            false,

          allowOverwrite:
            true,

          contentType:
            "application/json",

          cacheControlMaxAge:
            60
        }
      );

      markedCount +=
        1;

      marked.push({
        productId,

        itemId:
          duplicate.envelope
            ?.data
            ?.itemId ||
          null,

        previousStatus:
          duplicateStatus,

        keptItemId:
          keeper.envelope
            ?.data
            ?.itemId ||
          null,

        keptStatus:
          keeper.envelope
            ?.status ||
          null
      });
    }
  }

  return {
    scannedCount:
      loaded.length,

    duplicateGroups,

    markedCount,

    historicalSentDuplicates,

    marked
  };
}

export async function markPublicationAffiliateReady({
  pathname,
  envelope,
  affiliateLink,
  validatedOffer
}) {
  requireBlobConfiguration();

  if (
    !pathname ||
    !envelope?.data ||
    !affiliateLink
  ) {
    throw new Error(
      "Dados insuficientes para atualizar a fila."
    );
  }

  const oldDraft =
    String(
      envelope.data
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

  const body =
    JSON.stringify(
      updated
    );

  const blob =
    await put(
      pathname,
      body,
      {
        access:
          "private",

        addRandomSuffix:
          false,

        allowOverwrite:
          true,

        contentType:
          "application/json",

        cacheControlMaxAge:
          60
      }
    );

  return {
    updated:
      true,

    pathname:
      blob.pathname ||
      pathname,

    status:
      updated.status,

    data:
      updated.data
  };
}

const DELIVERY_STATUSES = new Set([
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
    String(status || "")
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
  requireBlobConfiguration();

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
    nextStatus === "send_error"
      ? previousRetryCount + 1
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
      data.delivery?.groupJid ||
      null,

    groupName:
      groupName ||
      data.delivery?.groupName ||
      null,

    whatsappMessageId:
      whatsappMessageId ||
      data.delivery?.whatsappMessageId ||
      null,

    lastError:
      nextStatus === "send_error"
        ? (
            errorMessage ||
            "Erro de envio não informado."
          )
        : (
            retryRequested
              ? null
              : data.delivery?.lastError || null
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

  const blob =
    await put(
      queued.pathname,
      JSON.stringify(
        updated
      ),
      {
        access:
          "private",

        addRandomSuffix:
          false,

        allowOverwrite:
          true,

        contentType:
          "application/json",

        cacheControlMaxAge:
          60
      }
    );

  return {
    updated:
      true,

    pathname:
      blob.pathname ||
      queued.pathname,

    itemId:
      data.itemId ||
      itemId,

    status:
      nextStatus,

    retryCount,

    delivery
  };
}

