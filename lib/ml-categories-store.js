import { get, list, put } from "@vercel/blob";

const CATEGORY_PREFIX =
  "tt/ml-categories/";

function requireBlobConfiguration() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Falta BLOB_READ_WRITE_TOKEN no Vercel."
    );
  }
}

function buildPathname(
  siteId,
  contentMd5
) {
  const safeSite =
    String(siteId || "MLB")
      .replace(/[^A-Z0-9_-]/gi, "");

  const safeMd5 =
    String(contentMd5 || "")
      .replace(/[^a-f0-9]/gi, "")
      .toLowerCase();

  if (!safeMd5) {
    throw new Error(
      "O dump não possui X-Content-MD5 válido."
    );
  }

  return (
    `${CATEGORY_PREFIX}` +
    `${safeSite}-${safeMd5}.json`
  );
}

async function findExactBlob(
  pathname
) {
  const result =
    await list({
      prefix: pathname,
      limit: 10
    });

  return (
    result.blobs?.find(
      (blob) =>
        blob.pathname === pathname
    ) || null
  );
}

async function readBlobJson(
  pathname
) {
  const result =
    await get(
      pathname,
      {
        access: "private"
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

  return JSON.parse(text);
}

export async function saveMlCategoriesDump({
  siteId = "MLB",
  metadata,
  data
}) {
  requireBlobConfiguration();

  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "Dump de categorias inválido."
    );
  }

  const pathname =
    buildPathname(
      siteId,
      metadata?.contentMd5
    );

  const existing =
    await findExactBlob(
      pathname
    );

  if (existing) {
    return {
      persisted: true,
      alreadyCurrent: true,
      pathname,
      uploadedAt:
        existing.uploadedAt || null,
      contentMd5:
        metadata?.contentMd5 || null
    };
  }

  const envelope = {
    version: 1,
    siteId,
    savedAt:
      new Date().toISOString(),

    source:
      "mercadolivre_category_dump",

    metadata: {
      contentCreated:
        metadata?.contentCreated || null,

      contentMd5:
        metadata?.contentMd5 || null,

      contentType:
        metadata?.contentType || null,

      contentEncoding:
        metadata?.contentEncoding || null
    },

    data
  };

  const body =
    JSON.stringify(envelope);

  try {
    const blob =
      await put(
        pathname,
        body,
        {
          access: "private",
          addRandomSuffix: false,
          contentType:
            "application/json",
          cacheControlMaxAge: 60
        }
      );

    return {
      persisted: true,
      alreadyCurrent: false,
      pathname:
        blob.pathname || pathname,
      uploadedAt:
        blob.uploadedAt || null,
      contentMd5:
        metadata?.contentMd5 || null,
      storedBytes:
        Buffer.byteLength(
          body,
          "utf8"
        )
    };
  } catch (error) {
    // Se duas Functions tentarem gravar a mesma
    // versão ao mesmo tempo, uma delas pode vencer.
    // Nesse caso confirmamos se o arquivo apareceu.
    const afterRace =
      await findExactBlob(
        pathname
      );

    if (afterRace) {
      return {
        persisted: true,
        alreadyCurrent: true,
        pathname,
        uploadedAt:
          afterRace.uploadedAt || null,
        contentMd5:
          metadata?.contentMd5 || null
      };
    }

    throw error;
  }
}

export async function loadLatestMlCategoriesDump() {
  requireBlobConfiguration();

  const result =
    await list({
      prefix: CATEGORY_PREFIX,
      limit: 1000
    });

  if (!result.blobs?.length) {
    return null;
  }

  const blobs =
    [...result.blobs].sort(
      (a, b) =>
        new Date(b.uploadedAt) -
        new Date(a.uploadedAt)
    );

  for (const blob of blobs) {
    try {
      const parsed =
        await readBlobJson(
          blob.pathname
        );

      if (
        parsed?.version === 1 &&
        parsed?.siteId &&
        parsed?.data
      ) {
        return {
          ...parsed,
          pathname:
            blob.pathname,
          uploadedAt:
            blob.uploadedAt || null
        };
      }
    } catch (error) {
      console.error(
        "Falha ao ler dump de categorias:",
        blob.pathname,
        error.message
      );
    }
  }

  throw new Error(
    "Nenhuma versão salva da árvore pôde ser lida."
  );
}

export async function getLatestMlCategoriesMetadata() {
  const latest =
    await loadLatestMlCategoriesDump();

  if (!latest) {
    return null;
  }

  return {
    siteId:
      latest.siteId,

    savedAt:
      latest.savedAt || null,

    uploadedAt:
      latest.uploadedAt || null,

    pathname:
      latest.pathname,

    contentCreated:
      latest.metadata
        ?.contentCreated || null,

    contentMd5:
      latest.metadata
        ?.contentMd5 || null
  };
}
