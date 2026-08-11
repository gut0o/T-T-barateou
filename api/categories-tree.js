import { getValidMlTokenData } from "../lib/ml-token-store.js";

const SITE_ID = "MLB";
const CATEGORY_DUMP_URL =
  `https://api.mercadolibre.com/sites/${SITE_ID}/categories/all`;

function normalizeCategories(data) {
  const raw = Array.isArray(data)
    ? data
    : (
        data &&
        typeof data === "object"
          ? Object.values(data)
          : []
      );

  const byId = new Map();

  for (const category of raw) {
    if (
      !category ||
      typeof category !== "object" ||
      typeof category.id !== "string"
    ) {
      continue;
    }

    byId.set(
      category.id,
      category
    );
  }

  return [...byId.values()];
}

function getChildren(category) {
  return Array.isArray(
    category?.children_categories
  )
    ? category.children_categories
    : [];
}

function getPath(category) {
  return Array.isArray(
    category?.path_from_root
  )
    ? category.path_from_root
    : [];
}

function findRoots(categories) {
  const withPath =
    categories.filter(
      (category) =>
        getPath(category).length > 0
    );

  if (withPath.length) {
    const roots =
      categories.filter(
        (category) =>
          getPath(category).length === 1
      );

    if (roots.length) {
      return {
        roots,
        strategy:
          "path_from_root"
      };
    }
  }

  // Fallback caso o formato do dump mude algum dia:
  // raiz = categoria que nunca aparece como filha.
  const childIds =
    new Set();

  for (const category of categories) {
    for (
      const child
      of getChildren(category)
    ) {
      if (child?.id) {
        childIds.add(
          child.id
        );
      }
    }
  }

  return {
    roots:
      categories.filter(
        (category) =>
          !childIds.has(
            category.id
          )
      ),
    strategy:
      "child_reference_fallback"
  };
}

function calculateStats(categories) {
  let leafCategories = 0;
  let maxDepth = 0;
  let categoriesWithPath = 0;

  const depthDistribution =
    {};

  for (const category of categories) {
    if (
      getChildren(category).length === 0
    ) {
      leafCategories += 1;
    }

    const path =
      getPath(category);

    if (path.length) {
      categoriesWithPath += 1;

      maxDepth =
        Math.max(
          maxDepth,
          path.length
        );

      depthDistribution[
        path.length
      ] =
        (
          depthDistribution[
            path.length
          ] || 0
        ) + 1;
    }
  }

  return {
    totalCategories:
      categories.length,
    leafCategories,
    maxDepth:
      maxDepth || null,
    categoriesWithPath,
    depthDistribution
  };
}

function rootSummary(roots) {
  return roots
    .map((root) => ({
      id:
        root.id,
      name:
        root.name || null,
      directChildren:
        getChildren(root).length
    }))
    .sort((a, b) =>
      String(a.name || "")
        .localeCompare(
          String(b.name || ""),
          "pt-BR"
        )
    );
}

function deepestSamples(
  categories,
  maxDepth
) {
  if (!maxDepth) {
    return [];
  }

  return categories
    .filter(
      (category) =>
        getPath(category).length ===
        maxDepth
    )
    .slice(0, 5)
    .map((category) => ({
      id:
        category.id,
      name:
        category.name || null,
      path:
        getPath(category).map(
          (part) => ({
            id:
              part?.id || null,
            name:
              part?.name || null
          })
        )
    }));
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

  let data;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      "Recebi o dump, mas não consegui interpretar o JSON."
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
      normalizeCategories(data);

    if (!categories.length) {
      throw new Error(
        "O dump foi recebido, mas nenhuma categoria válida foi encontrada."
      );
    }

    const {
      roots,
      strategy
    } =
      findRoots(categories);

    const stats =
      calculateStats(
        categories
      );

    return res
      .status(200)
      .json({
        ok: true,

        siteId: SITE_ID,

        source:
          "mercadolivre_category_dump",

        dumpShape:
          Array.isArray(data)
            ? "array"
            : "object",

        metadata,

        // Agora o número de raízes representa
        // apenas categorias cujo path_from_root
        // começa e termina nelas mesmas.
        rootCategories:
          roots.length,

        totalCategories:
          stats.totalCategories,

        leafCategories:
          stats.leafCategories,

        maxDepth:
          stats.maxDepth,

        uniqueCategoryIds:
          stats.totalCategories,

        categoriesWithPath:
          stats.categoriesWithPath,

        hierarchyStrategy:
          strategy,

        depthDistribution:
          stats.depthDistribution,

        topLevel:
          rootSummary(roots),

        deepestSamples:
          deepestSamples(
            categories,
            stats.maxDepth
          ),

        accessTokenExposed:
          false,

        refreshTokenExposed:
          false,

        persisted:
          false,

        nextStep:
          "Se esta hierarquia estiver correta, a próxima etapa será persistir o dump completo para uso interno do T&T."
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
