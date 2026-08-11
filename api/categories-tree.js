import { getValidMlTokenData } from "../lib/ml-token-store.js";

const SITE_ID = "MLB";
const CATEGORY_DUMP_URL =
  `https://api.mercadolibre.com/sites/${SITE_ID}/categories/all`;

function getRoots(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (
    data &&
    typeof data === "object"
  ) {
    // O dump do Mercado Livre pode vir como um objeto
    // indexado por IDs das categorias principais.
    return Object.values(data).filter(
      (value) =>
        value &&
        typeof value === "object"
    );
  }

  return [];
}

function walkCategoryTree(roots) {
  const seenIds = new Set();

  let totalCategories = 0;
  let leafCategories = 0;
  let maxDepth = 0;

  function visit(category, depth) {
    if (
      !category ||
      typeof category !== "object"
    ) {
      return;
    }

    const id =
      typeof category.id === "string"
        ? category.id
        : null;

    // Protege contra categorias repetidas no dump.
    if (
      id &&
      seenIds.has(id)
    ) {
      return;
    }

    if (id) {
      seenIds.add(id);
    }

    totalCategories += 1;
    maxDepth = Math.max(
      maxDepth,
      depth
    );

    const children =
      Array.isArray(
        category.children_categories
      )
        ? category.children_categories
        : [];

    if (!children.length) {
      leafCategories += 1;
      return;
    }

    for (const child of children) {
      visit(
        child,
        depth + 1
      );
    }
  }

  for (const root of roots) {
    visit(root, 1);
  }

  return {
    totalCategories,
    leafCategories,
    maxDepth,
    uniqueIds:
      seenIds.size
  };
}

function summarizeRoots(roots) {
  return roots.map((root) => ({
    id:
      root?.id || null,
    name:
      root?.name || null,
    directChildren:
      Array.isArray(
        root?.children_categories
      )
        ? root.children_categories.length
        : 0
  }));
}

async function fetchCategoryDump(
  accessToken
) {
  const response = await fetch(
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
      const body =
        await response.text();

      detail = body
        .replace(/\s+/g, " ")
        .slice(0, 300);
    } catch {
      // Sem detalhe adicional.
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

  const contentCreated =
    response.headers.get(
      "x-content-created"
    );

  const contentMd5 =
    response.headers.get(
      "x-content-md5"
    );

  const contentType =
    response.headers.get(
      "content-type"
    );

  const contentEncoding =
    response.headers.get(
      "content-encoding"
    );

  let data;

  try {
    // O fetch do Node/Vercel descomprime gzip automaticamente.
    data = await response.json();
  } catch {
    throw new Error(
      "Recebi o dump, mas não consegui interpretar o JSON."
    );
  }

  return {
    data,
    metadata: {
      contentCreated:
        contentCreated || null,
      contentMd5:
        contentMd5 || null,
      contentType:
        contentType || null,
      contentEncoding:
        contentEncoding || null
    }
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

    return res.status(405).json({
      ok: false,
      error:
        "Use GET."
    });
  }

  try {
    const tokenData =
      await getValidMlTokenData();

    if (
      !tokenData?.access_token
    ) {
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

    const roots =
      getRoots(data);

    if (!roots.length) {
      throw new Error(
        "O Mercado Livre retornou o dump, mas não encontrei categorias na resposta."
      );
    }

    const stats =
      walkCategoryTree(
        roots
      );

    const topLevel =
      summarizeRoots(
        roots
      );

    return res.status(200).json({
      ok: true,

      siteId: SITE_ID,

      source:
        "mercadolivre_category_dump",

      dumpShape:
        Array.isArray(data)
          ? "array"
          : "object",

      metadata,

      rootCategories:
        roots.length,

      totalCategories:
        stats.totalCategories,

      leafCategories:
        stats.leafCategories,

      maxDepth:
        stats.maxDepth,

      uniqueCategoryIds:
        stats.uniqueIds,

      topLevel,

      // Segurança:
      // nenhum token é devolvido pelo endpoint.
      accessTokenExposed:
        false,

      refreshTokenExposed:
        false,

      persisted:
        false,

      nextStep:
        "Depois de validar este dump, podemos persistir a árvore para uso interno do T&T."
    });
  } catch (error) {
    return res.status(500).json({
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
