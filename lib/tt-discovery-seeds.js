// T&T Barateou — sementes da descoberta automática.
//
// A descoberta normal continua usando as 4 sementes antigas.
// A descoberta direcionada "eletronicos" usa uma lista separada.
//
// Para o primeiro teste direcionado, usamos MLB1055
// (Celulares e Smartphones), categoria confirmada pelo recurso
// /highlights do Mercado Livre.

export const TT_DISCOVERY_SEEDS = [
  {
    key:
      "auto_eletronicos",

    categoryId:
      "MLB1055",

    label:
      "Eletrônicos — Celulares e Smartphones",

    discoveryGroup:
      "eletronicos",

    expectedTtCategoryId:
      "tecnologia_games"
  },

  {
    key:
      "auto_fitness",

    categoryId:
      "MLB264201",

    label:
      "Fitness — Suplementos Alimentares",

    discoveryGroup:
      "fitness",

    expectedTtCategoryId:
      "saude_fitness"
  },

  {
    key:
      "auto_perfumes",

    categoryQuery:
      "perfume eau de parfum",

    label:
      "Perfumes",

    discoveryGroup:
      "perfumes",

    expectedTtCategoryId:
      "moda_beleza"
  }
];

export const TT_DISCOVERY_GROUPS = {
  eletronicos: [
    {
      key:
        "eletronicos_celulares",

      categoryId:
        "MLB1055",

      label:
        "Celulares e Smartphones",

      expectedTtCategoryId:
        "tecnologia_games"
    }
  ],

  fitness: [
    {
      key:
        "fitness_suplementos",

      categoryId:
        "MLB264201",

      label:
        "Suplementos Alimentares",

      expectedTtCategoryId:
        "saude_fitness"
    }
  ],

  perfumes: [
    {
      key:
        "perfumes_preditor",

      // Não chutamos um categoryId.
      // O endpoint de discovery resolve esta frase com
      // /sites/MLB/domain_discovery/search.
      categoryQuery:
        "perfume eau de parfum",

      label:
        "Perfumes",

      expectedTtCategoryId:
        "moda_beleza"
    }
  ]
};

function normalizeGroup(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLocaleLowerCase(
      "pt-BR"
    )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

export function selectDiscoverySeeds({
  cursor = 0,
  limit = 2,
  group = null
} = {}) {
  const normalizedGroup =
    normalizeGroup(
      group
    );

  const groupedSeeds =
    normalizedGroup
      ? TT_DISCOVERY_GROUPS[
          normalizedGroup
        ]
      : null;

  const source =
    Array.isArray(
      groupedSeeds
    )
      ? groupedSeeds
      : TT_DISCOVERY_SEEDS;

  const total =
    source.length;

  if (!total) {
    return {
      group:
        normalizedGroup ||
        null,

      cursor:
        0,

      nextCursor:
        0,

      seeds:
        []
    };
  }

  const normalizedCursor =
    (
      Math.max(
        Number(cursor) || 0,
        0
      ) %
      total
    );

  const maxLimit =
    1;

  const normalizedLimit =
    Math.min(
      Math.max(
        Number(limit) || 1,
        1
      ),
      maxLimit
    );

  const selected =
    [];

  for (
    let index = 0;
    index < normalizedLimit;
    index += 1
  ) {
    selected.push(
      source[
        (
          normalizedCursor +
          index
        ) %
        total
      ]
    );
  }

  return {
    group:
      Array.isArray(
        groupedSeeds
      )
        ? normalizedGroup
        : null,

    cursor:
      normalizedCursor,

    nextCursor:
      (
        normalizedCursor +
        selected.length
      ) %
      total,

    seeds:
      selected
  };
}
