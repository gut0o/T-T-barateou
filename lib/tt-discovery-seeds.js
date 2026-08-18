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
    { key: "eletronicos_celulares_top", categoryId: "MLB1055", scanOffset: 0, label: "Celulares ranking 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_celulares_deeper", categoryId: "MLB1055", scanOffset: 5, label: "Celulares ranking 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_notebooks_top", categoryQuery: "notebook laptop", scanOffset: 0, label: "Notebooks ranking 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_notebooks_deeper", categoryQuery: "notebook laptop", scanOffset: 5, label: "Notebooks ranking 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_tv_top", categoryQuery: "smart tv television", scanOffset: 0, label: "Smart TVs ranking 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_tv_deeper", categoryQuery: "smart tv television", scanOffset: 5, label: "Smart TVs ranking 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_fones_top", categoryQuery: "fone bluetooth headset", scanOffset: 0, label: "Fones e Headsets ranking 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_fones_deeper", categoryQuery: "fone bluetooth headset", scanOffset: 5, label: "Fones e Headsets ranking 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_games_top", categoryQuery: "console videogame playstation xbox", scanOffset: 0, label: "Games e Consoles ranking 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_games_deeper", categoryQuery: "console videogame playstation xbox", scanOffset: 5, label: "Games e Consoles ranking 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_smartwatch", categoryQuery: "smartwatch relogio inteligente", scanOffset: 0, label: "Smartwatches", expectedTtCategoryId: "tecnologia_games" },
    { key: "eletronicos_cameras", categoryQuery: "camera digital gopro drone", scanOffset: 0, label: "Câmeras e Ação", expectedTtCategoryId: "tecnologia_games" }
  ],

  fitness: [
    { key: "fitness_suplementos_top", categoryId: "MLB264201", scanOffset: 0, label: "Suplementos ranking 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_suplementos_deeper", categoryId: "MLB264201", scanOffset: 5, label: "Suplementos ranking 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_creatina_top", categoryQuery: "creatina monohidratada suplemento", scanOffset: 0, label: "Creatina ranking 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_creatina_deeper", categoryQuery: "creatina monohidratada suplemento", scanOffset: 5, label: "Creatina ranking 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_whey_top", categoryQuery: "whey protein suplemento", scanOffset: 0, label: "Whey ranking 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_whey_deeper", categoryQuery: "whey protein suplemento", scanOffset: 5, label: "Whey ranking 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_halteres_top", categoryQuery: "halter academia musculacao", scanOffset: 0, label: "Halteres e Musculação ranking 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_halteres_deeper", categoryQuery: "halter academia musculacao", scanOffset: 5, label: "Halteres e Musculação ranking 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_cardio_top", categoryQuery: "bicicleta ergometrica spinning academia", scanOffset: 0, label: "Cardio e Spinning ranking 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_cardio_deeper", categoryQuery: "bicicleta ergometrica spinning academia", scanOffset: 5, label: "Cardio e Spinning ranking 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_yoga_pilates", categoryQuery: "yoga pilates colchonete faixa elastica", scanOffset: 0, label: "Yoga e Pilates", expectedTtCategoryId: "saude_fitness" },
    { key: "fitness_corrida", categoryQuery: "corrida tenis corrida fitness", scanOffset: 0, label: "Corrida e Fitness", expectedTtCategoryId: "saude_fitness" }
  ],

  perfumes: [
    { key: "perfumes_geral_1", categoryQuery: "perfume eau de parfum", scanOffset: 0, label: "Perfumes ranking 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_geral_2", categoryQuery: "perfume eau de parfum", scanOffset: 4, label: "Perfumes ranking 5–9", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_geral_3", categoryQuery: "perfume eau de parfum", scanOffset: 8, label: "Perfumes ranking 9–13", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_geral_4", categoryQuery: "perfume eau de parfum", scanOffset: 12, label: "Perfumes ranking 13–17", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_geral_5", categoryQuery: "perfume eau de parfum", scanOffset: 16, label: "Perfumes ranking 17–20", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_masculinos_top", categoryQuery: "perfume masculino", scanOffset: 0, label: "Perfumes Masculinos ranking 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_masculinos_deeper", categoryQuery: "perfume masculino", scanOffset: 5, label: "Perfumes Masculinos ranking 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_femininos_top", categoryQuery: "perfume feminino", scanOffset: 0, label: "Perfumes Femininos ranking 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_femininos_deeper", categoryQuery: "perfume feminino", scanOffset: 5, label: "Perfumes Femininos ranking 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_arabes_top", categoryQuery: "perfume arabe", scanOffset: 0, label: "Perfumes Árabes ranking 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_arabes_deeper", categoryQuery: "perfume arabe", scanOffset: 5, label: "Perfumes Árabes ranking 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "perfumes_colonias", categoryQuery: "deo colonia perfume", scanOffset: 0, label: "Deo Colônias", expectedTtCategoryId: "moda_beleza" }
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
