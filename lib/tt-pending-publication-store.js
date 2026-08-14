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

  const existing =
    await findExactBlob(
      pathname
    );

  if (existing) {
    return {
      itemId:
        candidate.itemId,

      queued:
        true,

      alreadyQueued:
        true,

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

      queued:
        true,

      alreadyQueued:
        false,

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
