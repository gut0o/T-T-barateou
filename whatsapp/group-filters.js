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
  "deo-colonia",
  "deo cologne",
  "desodorante colonia",
  "desodorante-colonia",
  "colonia desodorante",
  "agua de colonia",
  "fragrancia",
  "fragrance",
  "colonia",
  "body splash",
  "body mist",
  "splash corporal",
  "mist corporal",
  "spray corporal perfumado",
  "perfume corporal"
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

const ELECTRONICS_TERMS = [
  "celular",
  "smartphone",
  "iphone",
  "galaxy",
  "tablet",
  "ipad",
  "notebook",
  "laptop",
  "macbook",
  "chromebook",
  "computador",
  "pc gamer",
  "desktop",
  "monitor",
  "smart tv",
  "televisao",
  "televisor",
  "fone de ouvido",
  "headphone",
  "headset",
  "earbuds",
  "tws",
  "airpods",
  "caixa de som",
  "soundbar",
  "speaker bluetooth",
  "microfone",
  "webcam",
  "camera digital",
  "camera fotografica",
  "gopro",
  "drone",
  "playstation",
  "ps4",
  "ps5",
  "xbox",
  "nintendo switch",
  "videogame",
  "video game",
  "console",
  "controle gamer",
  "joystick",
  "placa de video",
  "gpu",
  "processador",
  "memoria ram",
  "ssd",
  "hd externo",
  "roteador",
  "modem",
  "wifi",
  "wi-fi",
  "teclado",
  "mouse",
  "smartwatch",
  "smart watch",
  "apple watch",
  "impressora",
  "projetor",
  "echo dot",
  "alexa"
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

  const categoryText =
    normalize(
      [
        entry?.ttCategoryName,
        entry?.resolvedCategoryName,
        entry?.rootCategory,
        Array.isArray(
          entry?.categoryPath
        )
          ? entry.categoryPath
              .map(
                (part) =>
                  typeof part === "string"
                    ? part
                    : (
                        part?.name ||
                        ""
                      )
              )
              .join(" ")
          : ""
      ]
        .filter(Boolean)
        .join(" ")
    );

  const titleLooksLikePerfume =
    Boolean(
      title &&
      (
        includesAny(
          title,
          PERFUME_TERMS
        ) ||
        includesPerfumeAbbreviation(
          title
        )
      )
    );

  const categoryLooksLikePerfume =
    includesAny(
      categoryText,
      [
        "perfume",
        "perfumaria",
        "fragrancia",
        "colonia"
      ]
    );

  if (
    (
      !titleLooksLikePerfume &&
      !categoryLooksLikePerfume
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
  const title =
    titleOf(
      entry
    );

  const categoryId =
    normalize(
      entry?.ttCategoryId
    );

  const categoryName =
    normalize(
      entry?.ttCategoryName
    );

  const categoryMatch =
    categoryId ===
      "tecnologia_games" ||
    includesAny(
      categoryName,
      [
        "tecnologia",
        "games",
        "eletronicos",
        "informatica",
        "celulares"
      ]
    );

  const titleMatch =
    includesAny(
      title,
      ELECTRONICS_TERMS
    );

  // A rota interna do Mercado Livre nem sempre chega com
  // ttCategoryId=tecnologia_games, mesmo quando a busca foi
  // claramente Celulares, TVs, Notebooks ou Fones.
  //
  // Portanto aceitamos:
  // 1) categoria T&T correta, OU
  // 2) nome de categoria claramente eletrônico, OU
  // 3) título com um termo forte de eletrônicos.
  if (
    !categoryMatch &&
    !titleMatch
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
