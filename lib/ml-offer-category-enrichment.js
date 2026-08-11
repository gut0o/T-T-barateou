import {
  loadLatestMlCategoriesDump
} from "./ml-categories-store.js";

import {
  getAffiliateCommission
} from "./ml-affiliate-commissions.js";

// Cache somente em memória da Function.
// Em uma instância "quente" do Vercel, evita reler
// e reindexar os ~12 mil registros em toda chamada.
// Se a Function reiniciar, o cache simplesmente é
// reconstruído a partir do Blob privado.
let cachedIndex = null;
let cachedContentMd5 = null;

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

function normalizePath(category) {
  if (
    !Array.isArray(
      category?.path_from_root
    )
  ) {
    return [];
  }

  return category.path_from_root.map(
    (part) => ({
      id:
        part?.id || null,
      name:
        part?.name || null
    })
  );
}

async function getCategoryIndex() {
  const savedDump =
    await loadLatestMlCategoriesDump();

  if (!savedDump?.data) {
    throw new Error(
      "Nenhuma árvore de categorias foi encontrada no Blob."
    );
  }

  const contentMd5 =
    savedDump
      .metadata
      ?.contentMd5 ||
    null;

  if (
    cachedIndex &&
    cachedContentMd5 === contentMd5
  ) {
    return {
      index: cachedIndex,
      contentMd5
    };
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

  cachedIndex = index;
  cachedContentMd5 =
    contentMd5;

  return {
    index,
    contentMd5
  };
}

function emptyResult({
  categoryId,
  categoryName,
  domainId,
  note
}) {
  return {
    categoryId:
      categoryId || null,

    categoryName:
      categoryName || null,

    domainId:
      domainId || null,

    rootCategory:
      null,

    categoryPath:
      [],

    categoryDepth:
      null,

    commissionKnown:
      false,

    directCommissionPercent:
      null,

    indirectCommissionPercent:
      null,

    source:
      "not_enriched",

    note:
      note || null
  };
}

export async function enrichOfferCategoryAndCommission({
  categoryId = null,
  categoryName = null,
  domainId = null
}) {
  // Alguns produtos de catálogo do Mercado Livre
  // ainda retornam domainId, mas não categoryId.
  // Não vamos inventar um vínculo categoria→comissão.
  if (!categoryId) {
    return emptyResult({
      categoryId,
      categoryName,
      domainId,
      note:
        domainId
          ? (
              "O produto possui domainId, mas não categoryId. A comissão ainda não foi inferida por domínio."
            )
          : (
              "O produto não retornou categoryId suficiente para consultar a árvore salva."
            )
    });
  }

  try {
    const {
      index
    } =
      await getCategoryIndex();

    const category =
      index.get(categoryId);

    if (!category) {
      return emptyResult({
        categoryId,
        categoryName,
        domainId,
        note:
          "O categoryId não foi encontrado na versão salva da árvore."
      });
    }

    const path =
      normalizePath(
        category
      );

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
        category.name ||
        categoryName ||
        null,

      domainId:
        domainId || null,

      rootCategory,

      categoryPath:
        path,

      categoryDepth:
        path.length || 1,

      commissionKnown:
        commission
          .commissionKnown,

      directCommissionPercent:
        commission
          .directCommissionPercent,

      indirectCommissionPercent:
        commission
          .indirectCommissionPercent,

      source:
        "vercel_blob_saved_tree",

      note:
        commission.commissionKnown
          ? null
          : (
              "A categoria foi encontrada, mas sua categoria principal ainda não possui comissão cadastrada na tabela fornecida."
            )
    };
  } catch (error) {
    // A camada de comissão é enriquecimento.
    // Nunca derrubamos a oferta principal por causa dela.
    console.error(
      "Falha ao enriquecer categoria/comissão:",
      error?.message ||
      error
    );

    return emptyResult({
      categoryId,
      categoryName,
      domainId,
      note:
        "Não foi possível consultar a árvore salva nesta chamada; a oferta principal continua válida."
    });
  }
}
