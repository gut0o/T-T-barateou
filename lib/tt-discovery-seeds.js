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
    { key: "cel_00", categoryId: "MLB1055", scanOffset: 0, label: "Celulares 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "cel_05", categoryId: "MLB1055", scanOffset: 5, label: "Celulares 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "cel_10", categoryId: "MLB1055", scanOffset: 10, label: "Celulares 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "cel_15", categoryId: "MLB1055", scanOffset: 15, label: "Celulares 16–20", expectedTtCategoryId: "tecnologia_games" },

    { key: "note_00", categoryQuery: "notebook laptop", scanOffset: 0, label: "Notebooks 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "note_05", categoryQuery: "notebook laptop", scanOffset: 5, label: "Notebooks 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "note_10", categoryQuery: "notebook laptop", scanOffset: 10, label: "Notebooks 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "note_15", categoryQuery: "notebook laptop", scanOffset: 15, label: "Notebooks 16–20", expectedTtCategoryId: "tecnologia_games" },

    { key: "tv_00", categoryQuery: "smart tv television", scanOffset: 0, label: "Smart TVs 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "tv_05", categoryQuery: "smart tv television", scanOffset: 5, label: "Smart TVs 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "tv_10", categoryQuery: "smart tv television", scanOffset: 10, label: "Smart TVs 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "tv_15", categoryQuery: "smart tv television", scanOffset: 15, label: "Smart TVs 16–20", expectedTtCategoryId: "tecnologia_games" },

    { key: "fone_00", categoryQuery: "fone bluetooth headset", scanOffset: 0, label: "Fones 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "fone_05", categoryQuery: "fone bluetooth headset", scanOffset: 5, label: "Fones 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "fone_10", categoryQuery: "fone bluetooth headset", scanOffset: 10, label: "Fones 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "fone_15", categoryQuery: "fone bluetooth headset", scanOffset: 15, label: "Fones 16–20", expectedTtCategoryId: "tecnologia_games" },

    { key: "games_00", categoryQuery: "console videogame playstation xbox", scanOffset: 0, label: "Games e Consoles", expectedTtCategoryId: "tecnologia_games" },
    { key: "smartwatch_00", categoryQuery: "smartwatch relogio inteligente", scanOffset: 0, label: "Smartwatches 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "smartwatch_05", categoryQuery: "smartwatch relogio inteligente", scanOffset: 5, label: "Smartwatches 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "tablet_00", categoryQuery: "tablet ipad", scanOffset: 0, label: "Tablets", expectedTtCategoryId: "tecnologia_games" },
    { key: "monitor_00", categoryQuery: "monitor gamer computador", scanOffset: 0, label: "Monitores", expectedTtCategoryId: "tecnologia_games" },
    { key: "ssd_00", categoryQuery: "ssd nvme armazenamento", scanOffset: 0, label: "SSD e Armazenamento", expectedTtCategoryId: "tecnologia_games" },
    { key: "perifericos_00", categoryQuery: "teclado mouse gamer", scanOffset: 0, label: "Periféricos", expectedTtCategoryId: "tecnologia_games" },
    { key: "audio_00", categoryQuery: "caixa de som bluetooth soundbar", scanOffset: 0, label: "Áudio", expectedTtCategoryId: "tecnologia_games" }
  ],

  fitness: [
    { key: "sup_00", categoryId: "MLB264201", scanOffset: 0, label: "Suplementos 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "sup_05", categoryId: "MLB264201", scanOffset: 5, label: "Suplementos 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "sup_10", categoryId: "MLB264201", scanOffset: 10, label: "Suplementos 11–15", expectedTtCategoryId: "saude_fitness" },

    { key: "crea_00", categoryQuery: "creatina monohidratada suplemento", scanOffset: 0, label: "Creatina 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "crea_05", categoryQuery: "creatina monohidratada suplemento", scanOffset: 5, label: "Creatina 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "crea_10", categoryQuery: "creatina monohidratada suplemento", scanOffset: 10, label: "Creatina 11–15", expectedTtCategoryId: "saude_fitness" },

    { key: "whey_00", categoryQuery: "whey protein suplemento", scanOffset: 0, label: "Whey 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "whey_05", categoryQuery: "whey protein suplemento", scanOffset: 5, label: "Whey 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "whey_10", categoryQuery: "whey protein suplemento", scanOffset: 10, label: "Whey 11–15", expectedTtCategoryId: "saude_fitness" },

    { key: "halter_00", categoryQuery: "halter academia musculacao", scanOffset: 0, label: "Halteres 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "halter_05", categoryQuery: "halter academia musculacao", scanOffset: 5, label: "Halteres 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "halter_10", categoryQuery: "halter academia musculacao", scanOffset: 10, label: "Halteres 11–15", expectedTtCategoryId: "saude_fitness" },

    { key: "cardio_00", categoryQuery: "bicicleta ergometrica spinning academia", scanOffset: 0, label: "Cardio 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "cardio_05", categoryQuery: "bicicleta ergometrica spinning academia", scanOffset: 5, label: "Cardio 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "cardio_10", categoryQuery: "bicicleta ergometrica spinning academia", scanOffset: 10, label: "Cardio 11–15", expectedTtCategoryId: "saude_fitness" },
    { key: "cardio_15", categoryQuery: "bicicleta ergometrica spinning academia", scanOffset: 15, label: "Cardio 16–20", expectedTtCategoryId: "saude_fitness" },

    { key: "esteira_00", categoryQuery: "esteira eletrica academia", scanOffset: 0, label: "Esteiras", expectedTtCategoryId: "saude_fitness" },
    { key: "elastico_00", categoryQuery: "faixa elastica treino academia resistencia", scanOffset: 0, label: "Faixas Elásticas", expectedTtCategoryId: "saude_fitness" },
    { key: "banco_00", categoryQuery: "banco supino academia musculacao", scanOffset: 0, label: "Bancos e Supino", expectedTtCategoryId: "saude_fitness" },
    { key: "yoga_00", categoryQuery: "yoga pilates colchonete", scanOffset: 0, label: "Yoga e Pilates", expectedTtCategoryId: "saude_fitness" },
    { key: "corrida_00", categoryQuery: "tenis corrida esporte", scanOffset: 0, label: "Corrida", expectedTtCategoryId: "saude_fitness" },
    { key: "luva_00", categoryQuery: "luva academia musculacao treino", scanOffset: 0, label: "Acessórios de Musculação", expectedTtCategoryId: "saude_fitness" },
    { key: "corda_00", categoryQuery: "corda pular treino crossfit", scanOffset: 0, label: "Crossfit e Corda", expectedTtCategoryId: "saude_fitness" },
    { key: "balanca_00", categoryQuery: "balanca bioimpedancia fitness", scanOffset: 0, label: "Balanças Fitness", expectedTtCategoryId: "saude_fitness" }
  ],

  perfumes: [
    { key: "perf_00", categoryQuery: "perfume eau de parfum", scanOffset: 0, label: "Perfumes 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "perf_05", categoryQuery: "perfume eau de parfum", scanOffset: 5, label: "Perfumes 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "perf_10", categoryQuery: "perfume eau de parfum", scanOffset: 10, label: "Perfumes 11–15", expectedTtCategoryId: "moda_beleza" },
    { key: "perf_15", categoryQuery: "perfume eau de parfum", scanOffset: 15, label: "Perfumes 16–20", expectedTtCategoryId: "moda_beleza" },

    { key: "masc_00", categoryQuery: "perfume masculino", scanOffset: 0, label: "Masculinos 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "masc_05", categoryQuery: "perfume masculino", scanOffset: 5, label: "Masculinos 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "masc_10", categoryQuery: "perfume masculino", scanOffset: 10, label: "Masculinos 11–15", expectedTtCategoryId: "moda_beleza" },
    { key: "masc_15", categoryQuery: "perfume masculino", scanOffset: 15, label: "Masculinos 16–20", expectedTtCategoryId: "moda_beleza" },

    { key: "fem_00", categoryQuery: "perfume feminino", scanOffset: 0, label: "Femininos 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "fem_05", categoryQuery: "perfume feminino", scanOffset: 5, label: "Femininos 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "fem_10", categoryQuery: "perfume feminino", scanOffset: 10, label: "Femininos 11–15", expectedTtCategoryId: "moda_beleza" },
    { key: "fem_15", categoryQuery: "perfume feminino", scanOffset: 15, label: "Femininos 16–20", expectedTtCategoryId: "moda_beleza" },

    { key: "arab_00", categoryQuery: "perfume arabe", scanOffset: 0, label: "Árabes 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "arab_05", categoryQuery: "perfume arabe", scanOffset: 5, label: "Árabes 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "arab_10", categoryQuery: "perfume arabe", scanOffset: 10, label: "Árabes 11–15", expectedTtCategoryId: "moda_beleza" },
    { key: "arab_15", categoryQuery: "perfume arabe", scanOffset: 15, label: "Árabes 16–20", expectedTtCategoryId: "moda_beleza" },
    { key: "col_00", categoryQuery: "deo colonia fragrancia", scanOffset: 0, label: "Deo Colônias", expectedTtCategoryId: "moda_beleza" },
    { key: "nac_00", categoryQuery: "perfume nacional boticario eudora natura", scanOffset: 0, label: "Perfumes Nacionais", expectedTtCategoryId: "moda_beleza" },
    { key: "imp_00", categoryQuery: "perfume importado original", scanOffset: 0, label: "Perfumes Importados", expectedTtCategoryId: "moda_beleza" },
    { key: "lux_00", categoryQuery: "eau de parfum feminino importado", scanOffset: 0, label: "EDP Feminino", expectedTtCategoryId: "moda_beleza" },
    { key: "edt_00", categoryQuery: "eau de toilette masculino", scanOffset: 0, label: "EDT Masculino", expectedTtCategoryId: "moda_beleza" },
    { key: "unissex_00", categoryQuery: "perfume unissex", scanOffset: 0, label: "Perfumes Unissex", expectedTtCategoryId: "moda_beleza" }
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
