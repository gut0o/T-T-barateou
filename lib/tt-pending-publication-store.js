import {
  list,
  put
} from "@vercel/blob";

// Uma fila persistente por item e por categoria T&T.
// Cada produto ocupa um pathname determinístico.
// Assim uma nova descoberta não duplica o mesmo item.
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
    // Proteção para duas execuções descobrirem o mesmo item
    // praticamente ao mesmo tempo.
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
    requested:
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
