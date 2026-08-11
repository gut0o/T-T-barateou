import {
  loadLatestMlCategoriesDump
} from "../lib/ml-categories-store.js";

import {
  getAffiliateCommission
} from "../lib/ml-affiliate-commissions.js";

function normalizeCategoryId(value) {
  if (!value) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .toUpperCase();

  return /^MLB\d+$/.test(normalized)
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

function findCategory(
  categories,
  categoryId
) {
  return (
    categories.find(
      (category) =>
        category?.id === categoryId
    ) || null
  );
}

function getCategoryPath(category) {
  return Array.isArray(
    category?.path_from_root
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
    const categoryId =
      normalizeCategoryId(
        req.query?.categoryId ||
        req.query?.id
      );

    if (!categoryId) {
      return res
        .status(400)
        .json({
          ok: false,
          error:
            "Informe um categoryId válido, por exemplo MLB108704."
        });
    }

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

    const category =
      findCategory(
        categories,
        categoryId
      );

    if (!category) {
      return res
        .status(404)
        .json({
          ok: false,
          categoryId,
          error:
            "Categoria não encontrada na árvore salva."
        });
    }

    const path =
      getCategoryPath(
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

    return res
      .status(200)
      .json({
        ok: true,

        categoryId:
          category.id,

        categoryName:
          category.name || null,

        rootCategory,

        path,

        ...commission,

        commissionSource:
          "user_provided_table_2026-08-11",

        note:
          commission.commissionKnown
            ? null
            : (
                "A categoria principal não estava visível na tabela de comissão fornecida, então nenhum percentual foi inferido."
              ),

        treeSource:
          "vercel_blob_saved_tree",

        treeVersion: {
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
        },

        accessTokenExposed:
          false,

        refreshTokenExposed:
          false
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
