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
      "moda_vestidos",

    categoryId:
      "MLB108704",

    label:
      "Vestidos",

    expectedTtCategoryId:
      "moda_beleza"
  },

  {
    key:
      "casa_ar_condicionado",

    categoryId:
      "MLB1646",

    label:
      "Ares Condicionados",

    expectedTtCategoryId:
      "casa_eletro"
  },

  {
    key:
      "saude_suplementos",

    categoryId:
      "MLB264201",

    label:
      "Suplementos Alimentares",

    expectedTtCategoryId:
      "saude_fitness"
  },

  {
    key:
      "bebes_geladeiras",

    categoryId:
      "MLB270287",

    label:
      "Geladeiras de Brinquedo",

    expectedTtCategoryId:
      "bebes_criancas"
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
    },

    {
      key:
        "eletronicos_notebooks",

      categoryQuery:
        "notebook laptop",

      label:
        "Notebooks",

      expectedTtCategoryId:
        "tecnologia_games"
    },

    {
      key:
        "eletronicos_smart_tv",

      categoryQuery:
        "smart tv television",

      label:
        "Smart TVs",

      expectedTtCategoryId:
        "tecnologia_games"
    },

    {
      key:
        "eletronicos_fones",

      categoryQuery:
        "fone bluetooth headset",

      label:
        "Fones e Headsets",

      expectedTtCategoryId:
        "tecnologia_games"
    },

    {
      key:
        "eletronicos_games",

      categoryQuery:
        "console videogame playstation xbox",

      label:
        "Games e Consoles",

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
    },

    {
      key:
        "fitness_creatina",

      categoryQuery:
        "creatina monohidratada suplemento",

      label:
        "Creatina",

      expectedTtCategoryId:
        "saude_fitness"
    },

    {
      key:
        "fitness_whey",

      categoryQuery:
        "whey protein suplemento",

      label:
        "Whey Protein",

      expectedTtCategoryId:
        "saude_fitness"
    },

    {
      key:
        "fitness_halteres",

      categoryQuery:
        "halter academia musculacao",

      label:
        "Halteres e Musculação",

      expectedTtCategoryId:
        "saude_fitness"
    },

    {
      key:
        "fitness_cardio",

      categoryQuery:
        "bicicleta ergometrica spinning academia",

      label:
        "Cardio e Spinning",

      expectedTtCategoryId:
        "saude_fitness"
    }
  ],

  perfumes: [
    {
      key:
        "perfumes_ranking_1",

      categoryQuery:
        "perfume eau de parfum",

      scanOffset:
        0,

      label:
        "Perfumes ranking 1–5",

      expectedTtCategoryId:
        "moda_beleza"
    },

    {
      key:
        "perfumes_ranking_2",

      categoryQuery:
        "perfume eau de parfum",

      scanOffset:
        4,

      label:
        "Perfumes ranking 5–9",

      expectedTtCategoryId:
        "moda_beleza"
    },

    {
      key:
        "perfumes_ranking_3",

      categoryQuery:
        "perfume eau de parfum",

      scanOffset:
        8,

      label:
        "Perfumes ranking 9–13",

      expectedTtCategoryId:
        "moda_beleza"
    },

    {
      key:
        "perfumes_ranking_4",

      categoryQuery:
        "perfume eau de parfum",

      scanOffset:
        12,

      label:
        "Perfumes ranking 13–17",

      expectedTtCategoryId:
        "moda_beleza"
    },

    {
      key:
        "perfumes_ranking_5",

      categoryQuery:
        "perfume eau de parfum",

      scanOffset:
        16,

      label:
        "Perfumes ranking 17–20",

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
    Array.isArray(
      groupedSeeds
    )
      ? total
      : 2;

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
