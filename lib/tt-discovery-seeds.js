// T&T Barateou — sementes iniciais de descoberta automática.
//
// Começamos com categorias que já passaram pelo fluxo do projeto.
// Se uma categoria não possuir highlights no momento, ela falha
// isoladamente e as demais continuam.
//
// A ação auto-discover processa no máximo 2 por chamada por padrão
// para manter a execução leve no Vercel.

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

export function selectDiscoverySeeds({
  cursor = 0,
  limit = 2
} = {}) {
  const total =
    TT_DISCOVERY_SEEDS.length;

  if (!total) {
    return {
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

  const normalizedLimit =
    Math.min(
      Math.max(
        Number(limit) || 2,
        1
      ),
      2
    );

  const selected =
    [];

  for (
    let index = 0;
    index < normalizedLimit;
    index += 1
  ) {
    selected.push(
      TT_DISCOVERY_SEEDS[
        (
          normalizedCursor +
          index
        ) %
        total
      ]
    );
  }

  return {
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
