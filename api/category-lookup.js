import {
  loadLatestMlCategoriesDump
} from "../lib/ml-categories-store.js";

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

function buildPath(category) {
  const path =
    Array.isArray(
      category?.path_from_root
    )
      ? category.path_from_root
      : [];

  return path.map(
    (part) => ({
      id:
        part?.id || null,
      name:
        part?.name || null
    })
  );
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
      buildPath(category);

    const rootCategory =
      path.length
        ? path[0]
        : {
            id:
              category.id,
            name:
              category.name || null
          };

    const parentCategory =
      path.length > 1
        ? path[
            path.length - 2
          ]
        : null;

    return res
      .status(200)
      .json({
        ok: true,

        categoryId:
          category.id,

        categoryName:
          category.name || null,

        rootCategory,

        parentCategory,

        depth:
          path.length || 1,

        path,

        directChildren:
          Array.isArray(
            category.children_categories
          )
            ? category
                .children_categories
                .length
            : 0,

        source:
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
