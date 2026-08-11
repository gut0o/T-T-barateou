import { getValidMlTokenData } from "../lib/ml-token-store.js";
import {
  saveMlCategoriesDump
} from "../lib/ml-categories-store.js";

const SITE_ID = "MLB";

const CATEGORY_DUMP_URL =
  `https://api.mercadolibre.com/sites/${SITE_ID}/categories/all`;

function normalizeCategories(data) {
  const raw =
    Array.isArray(data)
      ? data
      : (
          data &&
          typeof data === "object"
            ? Object.values(data)
            : []
        );

  const byId =
    new Map();

  for (const category of raw) {
    if (
      category &&
      typeof category === "object" &&
      typeof category.id === "string"
    ) {
      byId.set(
        category.id,
        category
      );
    }
  }

  return [...byId.values()];
}

function summarize(
  categories
) {
  let rootCategories = 0;
  let leafCategories = 0;
  let maxDepth = 0;

  for (
    const category
    of categories
  ) {
    const path =
      Array.isArray(
        category.path_from_root
      )
        ? category.path_from_root
        : [];

    const children =
      Array.isArray(
        category.children_categories
      )
        ? category.children_categories
        : [];

    if (path.length === 1) {
      rootCategories += 1;
    }

    if (!children.length) {
      leafCategories += 1;
    }

    maxDepth =
      Math.max(
        maxDepth,
        path.length
      );
  }

  return {
    rootCategories,
    totalCategories:
      categories.length,
    leafCategories,
    maxDepth
  };
}

async function fetchCategoryDump(
  accessToken
) {
  const response =
    await fetch(
      CATEGORY_DUMP_URL,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          Accept:
            "application/json"
        }
      }
    );

  if (!response.ok) {
    let detail = "";

    try {
      detail =
        (
          await response.text()
        )
          .replace(/\s+/g, " ")
          .slice(0, 300);
    } catch {
      // sem detalhe
    }

    throw new Error(
      `Mercado Livre respondeu HTTP ${response.status}` +
      (
        detail
          ? `: ${detail}`
          : "."
      )
    );
  }

  const metadata = {
    contentCreated:
      response.headers.get(
        "x-content-created"
      ) || null,

    contentMd5:
      response.headers.get(
        "x-content-md5"
      ) || null,

    contentType:
      response.headers.get(
        "content-type"
      ) || null,

    contentEncoding:
      response.headers.get(
        "content-encoding"
      ) || null
  };

  if (!metadata.contentMd5) {
    throw new Error(
      "O Mercado Livre não devolveu X-Content-MD5."
    );
  }

  let data;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      "Não consegui interpretar o dump de categorias."
    );
  }

  return {
    data,
    metadata
  };
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    res.setHeader(
      "Allow",
      "GET"
    );

    return res
      .status(405)
      .json({
        ok: false,
        error: "Use GET."
      });
  }

  try {
    const tokenData =
      await getValidMlTokenData();

    if (!tokenData?.access_token) {
      throw new Error(
        "Mercado Livre não está conectado."
      );
    }

    const {
      data,
      metadata
    } =
      await fetchCategoryDump(
        tokenData.access_token
      );

    const categories =
      normalizeCategories(
        data
      );

    if (!categories.length) {
      throw new Error(
        "Nenhuma categoria válida foi encontrada."
      );
    }

    const stats =
      summarize(
        categories
      );

    const storage =
      await saveMlCategoriesDump({
        siteId:
          SITE_ID,
        metadata,
        data
      });

    return res
      .status(200)
      .json({
        ok: true,

        siteId:
          SITE_ID,

        source:
          "mercadolivre_category_dump",

        rootCategories:
          stats.rootCategories,

        totalCategories:
          stats.totalCategories,

        leafCategories:
          stats.leafCategories,

        maxDepth:
          stats.maxDepth,

        contentCreated:
          metadata.contentCreated,

        contentMd5:
          metadata.contentMd5,

        persisted:
          storage.persisted,

        alreadyCurrent:
          storage.alreadyCurrent,

        blobPath:
          storage.pathname,

        storedBytes:
          storage.storedBytes || null,

        accessTokenExposed:
          false,

        refreshTokenExposed:
          false,

        nextStep:
          "A árvore está persistida. Depois podemos fazer o T&T consultá-la sem baixar novamente do Mercado Livre."
      });
  } catch (error) {
    return res
      .status(500)
      .json({
        ok: false,

        error:
          error?.message ||
          "Erro desconhecido.",

        accessTokenExposed:
          false,

        refreshTokenExposed:
          false
      });
  }
}
