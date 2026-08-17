// T&T Barateou — filtros dos grupos ativos.
//
// Ordem importa:
// 1. Perfumes (regra mais específica)
// 2. Eletrônicos
// 3. Fitness
//
// Qualquer produto que não passe por um destes filtros é ignorado
// antes de gerar link afiliado e antes de criar prévia.

function normalize(value) {
  return String(
    value || ""
  )
    .trim()
    .toLocaleLowerCase(
      "pt-BR"
    )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function titleOf(entry) {
  return normalize(
    entry?.title
  );
}

function includesAny(
  text,
  terms
) {
  return terms.some(
    (term) =>
      text.includes(
        normalize(term)
      )
  );
}


function includesPerfumeAbbreviation(
  text
) {
  return (
    /(^|[\s\-\/])(edt|edp)(?=$|[\s\-\/0-9])/i
      .test(
        text
      )
  );
}

const PERFUME_TERMS = [
  "perfume",
  "parfum",
  "eau de parfum",
  "eau de toilette",
  "eau de cologne",
  "deo parfum",
  "deo colonia",
  "desodorante colonia",
  "fragrancia",
  "colonia",
  "body splash"
];

const PERFUME_EXCLUSIONS = [
  "porta perfume",
  "porta-perfume",
  "frasco vazio",
  "frasco para perfume",
  "atomizador vazio",
  "porta fragrancia",
  "porta-fragrancia",
  "adesivo perfume",
  "decant",
  "amostra perfume",
  "mostruario perfume"
];

const FITNESS_TERMS = [
  "fitness",
  "academia",
  "musculacao",
  "treino",
  "exercicio",
  "esporte",
  "esportivo",
  "creatina",
  "whey",
  "whey protein",
  "proteina",
  "suplemento",
  "pre treino",
  "pre-treino",
  "bcaa",
  "glutamina",
  "beta alanina",
  "hipercalorico",
  "halter",
  "anilha",
  "kettlebell",
  "barra fixa",
  "supino",
  "banco de musculacao",
  "bicicleta ergometrica",
  "spinning",
  "esteira ergometrica",
  "corda de pular",
  "faixa elastica",
  "elastico exercicio",
  "colchonete",
  "yoga",
  "pilates",
  "corrida",
  "tenis corrida",
  "legging fitness",
  "top fitness",
  "short fitness",
  "dry fit"
];

function perfumeDestination(
  entry,
  routing
) {
  const title =
    titleOf(
      entry
    );

  if (
    !title ||
    (
      !includesAny(
        title,
        PERFUME_TERMS
      ) &&
      !includesPerfumeAbbreviation(
        title
      )
    ) ||
    includesAny(
      title,
      PERFUME_EXCLUSIONS
    )
  ) {
    return null;
  }

  const configured =
    routing
      ?.destinations
      ?.perfumes;

  if (!configured?.jid) {
    return null;
  }

  return {
    filterKey:
      "perfumes",

    filterLabel:
      "Perfume / Fragrância",

    jid:
      configured.jid,

    name:
      configured.name ||
      "Perfumes"
  };
}

function electronicsDestination(
  entry,
  routing
) {
  const categoryId =
    normalize(
      entry?.ttCategoryId
    );

  if (
    categoryId !==
    "tecnologia_games"
  ) {
    return null;
  }

  const configured =
    routing
      ?.destinations
      ?.eletronicos ||
    routing
      ?.categories
      ?.tecnologia_games;

  if (!configured?.jid) {
    return null;
  }

  return {
    filterKey:
      "eletronicos",

    filterLabel:
      "Eletrônicos / Tecnologia / Games",

    jid:
      configured.jid,

    name:
      configured.name ||
      "Eletrônicos"
  };
}

function fitnessDestination(
  entry,
  routing
) {
  const title =
    titleOf(
      entry
    );

  const categoryId =
    normalize(
      entry?.ttCategoryId
    );

  const strongTitleMatch =
    includesAny(
      title,
      FITNESS_TERMS
    );

  // Saúde & Fitness só entra quando o título também parece
  // realmente relacionado a treino, esporte ou suplementação.
  //
  // Também aceitamos roupa/equipamento de outra categoria quando
  // o título possui um termo forte de fitness, por exemplo:
  // "legging fitness", "tênis corrida", "halter", etc.
  const allowed =
    (
      categoryId ===
        "saude_fitness" &&
      strongTitleMatch
    ) ||
    strongTitleMatch;

  if (!allowed) {
    return null;
  }

  const configured =
    routing
      ?.destinations
      ?.fitness ||
    routing
      ?.categories
      ?.saude_fitness;

  if (!configured?.jid) {
    return null;
  }

  return {
    filterKey:
      "fitness",

    filterLabel:
      "Fitness / Academia / Suplementos",

    jid:
      configured.jid,

    name:
      configured.name ||
      "Fitness"
  };
}

export function classifyOfferDestination(
  entry,
  routing
) {
  return (
    perfumeDestination(
      entry,
      routing
    ) ||
    electronicsDestination(
      entry,
      routing
    ) ||
    fitnessDestination(
      entry,
      routing
    ) ||
    null
  );
}

export function filterEligibleOffers(
  entries,
  routing
) {
  return (
    Array.isArray(entries)
      ? entries
      : []
  ).filter(
    (entry) =>
      Boolean(
        classifyOfferDestination(
          entry,
          routing
        )
      )
  );
}
