// T&T Barateou — Etapa 6.18Y
//
// Consultas contínuas. Diferente de /highlights, cada consulta possui
// paginação persistente no Supabase e continua de onde parou.

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const TT_CONTINUOUS_DISCOVERY_QUERIES = {
  eletronicos: [
    ["celular", "Celulares", "celular smartphone"],
    ["iphone", "iPhone", "iphone"],
    ["samsung_cel", "Samsung Galaxy", "samsung galaxy smartphone"],
    ["motorola", "Motorola", "motorola smartphone"],
    ["xiaomi", "Xiaomi", "xiaomi smartphone"],
    ["notebook", "Notebooks", "notebook"],
    ["notebook_gamer", "Notebooks gamer", "notebook gamer"],
    ["smart_tv", "Smart TVs", "smart tv"],
    ["fone_bt", "Fones Bluetooth", "fone bluetooth"],
    ["headset", "Headsets", "headset gamer"],
    ["smartwatch", "Smartwatches", "smartwatch"],
    ["tablet", "Tablets", "tablet"],
    ["monitor", "Monitores", "monitor computador"],
    ["ssd", "SSD/NVMe", "ssd nvme"],
    ["hd_externo", "HD externo", "hd externo"],
    ["teclado", "Teclados", "teclado gamer"],
    ["mouse", "Mouses", "mouse gamer"],
    ["roteador", "Roteadores", "roteador wifi"],
    ["impressora", "Impressoras", "impressora multifuncional"],
    ["webcam", "Webcams", "webcam full hd"],
    ["microfone", "Microfones", "microfone usb"],
    ["caixa_som", "Caixas de som", "caixa de som bluetooth"],
    ["soundbar", "Soundbars", "soundbar"],
    ["powerbank", "Power Banks", "power bank"],
    ["carregador", "Carregadores", "carregador usb c"],
    ["playstation", "PlayStation", "playstation console"],
    ["xbox", "Xbox", "xbox console"],
    ["nintendo", "Nintendo", "nintendo switch"]
  ],

  fitness: [
    ["creatina", "Creatina", "creatina"],
    ["whey", "Whey Protein", "whey protein"],
    ["pre_treino", "Pré-treino", "pre treino suplemento"],
    ["proteina", "Proteínas", "suplemento proteina"],
    ["halter", "Halteres", "halter musculacao"],
    ["anilha", "Anilhas", "anilha musculacao"],
    ["kettlebell", "Kettlebells", "kettlebell"],
    ["barra", "Barras", "barra musculacao"],
    ["banco", "Bancos/Supino", "banco supino academia"],
    ["estacao", "Estações", "estacao musculacao"],
    ["esteira", "Esteiras", "esteira eletrica"],
    ["bike", "Bicicletas ergométricas", "bicicleta ergometrica"],
    ["eliptico", "Elípticos", "eliptico academia"],
    ["stepper", "Steppers", "stepper academia"],
    ["faixa", "Faixas elásticas", "faixa elastica treino"],
    ["corda", "Cordas", "corda pular treino"],
    ["luva", "Luvas", "luva musculacao"],
    ["strap", "Straps", "strap musculacao"],
    ["cinturao", "Cinturões", "cinturao musculacao"],
    ["colchonete", "Colchonetes", "colchonete academia"],
    ["yoga", "Yoga", "yoga acessorios"],
    ["pilates", "Pilates", "pilates acessorios"],
    ["bola_pilates", "Bolas de Pilates", "bola pilates"],
    ["balanca", "Balanças", "balanca bioimpedancia"],
    ["abdominal", "Abdominais", "aparelho abdominal"],
    ["funcional", "Treino funcional", "treino funcional equipamento"],
    ["crossfit", "Crossfit", "crossfit equipamento"]
  ],

  perfumes: [
    ["perfume", "Perfume", "perfume"],
    ["edp", "Eau de Parfum", "eau de parfum"],
    ["edt", "Eau de Toilette", "eau de toilette"],
    ["edc", "Eau de Cologne", "eau de cologne"],
    ["deo_colonia", "Deo Colônia", "deo colonia"],
    ["fragrancia", "Fragrâncias", "fragrancia"],
    ["body_splash", "Body Splash", "body splash"],
    ["masculino", "Perfume masculino", "perfume masculino"],
    ["feminino", "Perfume feminino", "perfume feminino"],
    ["arabe", "Perfume árabe", "perfume arabe"],
    ["importado", "Perfume importado", "perfume importado"],
    ["unissex", "Perfume unissex", "perfume unissex"],
    ["lattafa", "Lattafa", "lattafa perfume"],
    ["afnan", "Afnan", "afnan perfume"],
    ["maison", "Maison Alhambra", "maison alhambra perfume"],
    ["carolina", "Carolina Herrera", "carolina herrera perfume"],
    ["rabanne", "Rabanne", "rabanne perfume"],
    ["versace", "Versace", "versace perfume"],
    ["calvin", "Calvin Klein", "calvin klein perfume"],
    ["banderas", "Antonio Banderas", "antonio banderas perfume"],
    ["lancome", "Lancôme", "lancome perfume"],
    ["hugo_boss", "Hugo Boss", "hugo boss perfume"],
    ["armani", "Armani", "giorgio armani perfume"]
  ]
};

for (const group of Object.keys(TT_CONTINUOUS_DISCOVERY_QUERIES)) {
  TT_CONTINUOUS_DISCOVERY_QUERIES[group] =
    TT_CONTINUOUS_DISCOVERY_QUERIES[group].map(([key, label, q]) => ({
      key,
      label,
      q
    }));
}

const PERFUME_INCLUDE = [
  /\bperfume\b/,
  /\bparfum\b/,
  /\beau de parfum\b/,
  /\beau de toilette\b/,
  /\beau de cologne\b/,
  /\bdeo parfum\b/,
  /\bdeo colonia\b/,
  /\bdesodorante colonia\b/,
  /\bfragrancia\b/,
  /\bbody splash\b/,
  /\bbody mist\b/,
  /\bedp\b/,
  /\bedt\b/
];

const PERFUME_EXCLUDE = [
  /\bporta perfume\b/,
  /\bfrasco vazio\b/,
  /\bfrasco para perfume\b/,
  /\bdecant\b/,
  /\bamostra\b/,
  /\btester vazio\b/
];

export function matchesContinuousDiscoveryTitle({
  group,
  title
}) {
  const value = normalizeText(title);

  if (!value) {
    return false;
  }

  if (group !== "perfumes") {
    return true;
  }

  if (PERFUME_EXCLUDE.some((pattern) => pattern.test(value))) {
    return false;
  }

  return PERFUME_INCLUDE.some((pattern) => pattern.test(value));
}

export function continuousQueriesForGroup(group) {
  const normalized = String(group || "").trim().toLowerCase();
  return TT_CONTINUOUS_DISCOVERY_QUERIES[normalized] || [];
}
