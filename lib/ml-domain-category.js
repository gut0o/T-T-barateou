import {
  loadLatestMlCategoriesDump
} from "./ml-categories-store.js";

import {
  getAffiliateCommission
} from "./ml-affiliate-commissions.js";

const SITE_ID = "MLB";

function normalizeDomainId(value) {
  if (!value) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .toUpperCase();

  return /^MLB-[A-Z0-9_]+$/.test(normalized)
    ? normalized
    : null;
}

function normalizeCategories(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (
    data &&
    typeof data === "object"
  ) {
    return Object.values(data);
  }

  return [];
}

async function getSavedCategoryIndex() {
  const savedDump =
    await loadLatestMlCategoriesDump();

  if (!savedDump?.data) {
    throw new Error(
      "Nenhuma árvore de categorias foi encontrada no Blob."
    );
  }

  const categories =
    normalizeCategories(
      savedDump.data
    );

  const index =
    new Map();

  for (const category of categories) {
    if (
      category &&
      typeof category.id === "string"
    ) {
      index.set(
        category.id,
        category
      );
    }
  }

  return {
    index,
    version: {
      contentCreated:
        savedDump
          .metadata
          ?.contentCreated ||
        null,

      contentMd5:
        savedDump
          .metadata
          ?.contentMd5 ||
        null
    }
  };
}

function categoryInfoFromTree(
  categoryId,
  index
) {
  const category =
    index.get(categoryId);

  if (!category) {
    return {
      categoryId,
      categoryName:
        null,
      rootCategory:
        null,
      path: [],
      commissionKnown:
        false,
      directCommissionPercent:
        null,
      indirectCommissionPercent:
        null
    };
  }

  const path =
    Array.isArray(
      category.path_from_root
    )
      ? category.path_from_root.map(
          (part) => ({
            id:
              part?.id || null,
            name:
              part?.name || null
          })
        )
      : [];

  const rootCategory =
    path.length
      ? path[0]
      : {
          id:
            category.id,
          name:
            category.name || null
        };

  const commission =
    getAffiliateCommission(
      rootCategory.name
    );

  return {
    categoryId:
      category.id,

    categoryName:
      category.name || null,

    rootCategory,

    path,

    commissionKnown:
      commission
        .commissionKnown,

    directCommissionPercent:
      commission
        .directCommissionPercent,

    indirectCommissionPercent:
      commission
        .indirectCommissionPercent
  };
}

async function fetchDomainCategories(
  domainId,
  accessToken
) {
  const url =
    `https://api.mercadolibre.com/catalog_domains/` +
    `${encodeURIComponent(domainId)}/categories`;

  const response =
    await fetch(
      url,
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

  const data =
    await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "A resposta de categorias do domínio não veio em formato de lista."
    );
  }

  return data;
}

async function predictCategoryByTitle(
  title,
  domainId,
  accessToken
) {
  if (!title) {
    return null;
  }

  const params =
    new URLSearchParams({
      limit: "8",
      q: title
    });

  const url =
    `https://api.mercadolibre.com/sites/${SITE_ID}/domain_discovery/search?` +
    params.toString();

  const response =
    await fetch(
      url,
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
    return null;
  }

  const data =
    await response.json();

  if (!Array.isArray(data)) {
    return null;
  }

  return (
    data.find(
      (candidate) =>
        candidate?.domain_id ===
          domainId &&
        candidate?.category_id
    ) || null
  );
}

export async function resolveDomainCategory({
  domainId,
  title = null,
  accessToken
}) {
  const normalizedDomainId =
    normalizeDomainId(
      domainId
    );

  if (!normalizedDomainId) {
    throw new Error(
      "domainId inválido."
    );
  }

  const officialCategories =
    await fetchDomainCategories(
      normalizedDomainId,
      accessToken
    );

  if (!officialCategories.length) {
    return {
      domainId:
        normalizedDomainId,

      resolved:
        false,

      resolutionType:
        "no_categories",

      selectedCategory:
        null,

      candidates: []
    };
  }

  const {
    index,
    version
  } =
    await getSavedCategoryIndex();

  const candidates =
    officialCategories
      .filter(
        (category) =>
          typeof category?.id === "string"
      )
      .map(
        (category) => {
          const treeInfo =
            categoryInfoFromTree(
              category.id,
              index
            );

          return {
            categoryId:
              category.id,

            categoryName:
              category.name ||
              treeInfo.categoryName ||
              null,

            rootCategory:
              treeInfo.rootCategory,

            commissionKnown:
              treeInfo.commissionKnown,

            directCommissionPercent:
              treeInfo.directCommissionPercent,

            indirectCommissionPercent:
              treeInfo.indirectCommissionPercent
          };
        }
      );

  let selectedCategory =
    null;

  let resolutionType =
    "multiple_categories";

  if (candidates.length === 1) {
    selectedCategory =
      candidates[0];

    resolutionType =
      "single_domain_category";
  } else if (
    candidates.length > 1 &&
    title
  ) {
    const prediction =
      await predictCategoryByTitle(
        title,
        normalizedDomainId,
        accessToken
      );

    if (prediction?.category_id) {
      selectedCategory =
        candidates.find(
          (candidate) =>
            candidate.categoryId ===
            prediction.category_id
        ) || null;

      if (selectedCategory) {
        resolutionType =
          "title_predictor_within_domain";
      }
    }
  }

  return {
    domainId:
      normalizedDomainId,

    resolved:
      Boolean(selectedCategory),

    resolutionType,

    selectedCategory,

    candidateCount:
      candidates.length,

    candidates,

    treeVersion:
      version
  };
}
