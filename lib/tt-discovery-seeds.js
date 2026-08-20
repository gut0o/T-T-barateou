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
    { key: "audio_00", categoryQuery: "caixa de som bluetooth soundbar", scanOffset: 0, label: "Áudio", expectedTtCategoryId: "tecnologia_games" },

    // Expansão 6.18X — mais profundidade nas categorias que já funcionam.
    { key: "games_05", categoryQuery: "console videogame playstation xbox", scanOffset: 5, label: "Games e Consoles 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "games_10", categoryQuery: "console videogame playstation xbox", scanOffset: 10, label: "Games e Consoles 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "games_15", categoryQuery: "console videogame playstation xbox", scanOffset: 15, label: "Games e Consoles 16–20", expectedTtCategoryId: "tecnologia_games" },

    { key: "smartwatch_10", categoryQuery: "smartwatch relogio inteligente", scanOffset: 10, label: "Smartwatches 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "smartwatch_15", categoryQuery: "smartwatch relogio inteligente", scanOffset: 15, label: "Smartwatches 16–20", expectedTtCategoryId: "tecnologia_games" },

    { key: "tablet_05", categoryQuery: "tablet ipad", scanOffset: 5, label: "Tablets 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "tablet_10", categoryQuery: "tablet ipad", scanOffset: 10, label: "Tablets 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "tablet_15", categoryQuery: "tablet ipad", scanOffset: 15, label: "Tablets 16–20", expectedTtCategoryId: "tecnologia_games" },

    { key: "monitor_05", categoryQuery: "monitor gamer computador", scanOffset: 5, label: "Monitores 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "monitor_10", categoryQuery: "monitor gamer computador", scanOffset: 10, label: "Monitores 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "monitor_15", categoryQuery: "monitor gamer computador", scanOffset: 15, label: "Monitores 16–20", expectedTtCategoryId: "tecnologia_games" },

    { key: "ssd_05", categoryQuery: "ssd nvme armazenamento", scanOffset: 5, label: "SSD e Armazenamento 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "ssd_10", categoryQuery: "ssd nvme armazenamento", scanOffset: 10, label: "SSD e Armazenamento 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "ssd_15", categoryQuery: "ssd nvme armazenamento", scanOffset: 15, label: "SSD e Armazenamento 16–20", expectedTtCategoryId: "tecnologia_games" },

    { key: "perifericos_05", categoryQuery: "teclado mouse gamer", scanOffset: 5, label: "Periféricos 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "perifericos_10", categoryQuery: "teclado mouse gamer", scanOffset: 10, label: "Periféricos 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "perifericos_15", categoryQuery: "teclado mouse gamer", scanOffset: 15, label: "Periféricos 16–20", expectedTtCategoryId: "tecnologia_games" },

    { key: "audio_05", categoryQuery: "caixa de som bluetooth soundbar", scanOffset: 5, label: "Áudio 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "audio_10", categoryQuery: "caixa de som bluetooth soundbar", scanOffset: 10, label: "Áudio 11–15", expectedTtCategoryId: "tecnologia_games" },
    { key: "audio_15", categoryQuery: "caixa de som bluetooth soundbar", scanOffset: 15, label: "Áudio 16–20", expectedTtCategoryId: "tecnologia_games" },

    // Novas famílias para não depender só dos mesmos rankings.
    { key: "router_00", categoryQuery: "roteador wifi mesh", scanOffset: 0, label: "Roteadores 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "router_05", categoryQuery: "roteador wifi mesh", scanOffset: 5, label: "Roteadores 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "router_10", categoryQuery: "roteador wifi mesh", scanOffset: 10, label: "Roteadores 11–15", expectedTtCategoryId: "tecnologia_games" },

    { key: "printer_00", categoryQuery: "impressora multifuncional wifi", scanOffset: 0, label: "Impressoras 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "printer_05", categoryQuery: "impressora multifuncional wifi", scanOffset: 5, label: "Impressoras 6–10", expectedTtCategoryId: "tecnologia_games" },
    { key: "printer_10", categoryQuery: "impressora multifuncional wifi", scanOffset: 10, label: "Impressoras 11–15", expectedTtCategoryId: "tecnologia_games" },

    { key: "webcam_00", categoryQuery: "webcam full hd computador", scanOffset: 0, label: "Webcams 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "webcam_05", categoryQuery: "webcam full hd computador", scanOffset: 5, label: "Webcams 6–10", expectedTtCategoryId: "tecnologia_games" },

    { key: "microfone_00", categoryQuery: "microfone usb streaming computador", scanOffset: 0, label: "Microfones 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "microfone_05", categoryQuery: "microfone usb streaming computador", scanOffset: 5, label: "Microfones 6–10", expectedTtCategoryId: "tecnologia_games" },

    { key: "carregador_00", categoryQuery: "carregador celular usb c rapido", scanOffset: 0, label: "Carregadores 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "carregador_05", categoryQuery: "carregador celular usb c rapido", scanOffset: 5, label: "Carregadores 6–10", expectedTtCategoryId: "tecnologia_games" },

    { key: "powerbank_00", categoryQuery: "power bank carregador portatil", scanOffset: 0, label: "Power Banks 1–5", expectedTtCategoryId: "tecnologia_games" },
    { key: "powerbank_05", categoryQuery: "power bank carregador portatil", scanOffset: 5, label: "Power Banks 6–10", expectedTtCategoryId: "tecnologia_games" }
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
    { key: "balanca_00", categoryQuery: "balanca bioimpedancia fitness", scanOffset: 0, label: "Balanças Fitness", expectedTtCategoryId: "saude_fitness" },

    // Expansão 6.18X — aprofundar famílias existentes.
    { key: "halter_15", categoryQuery: "halter academia musculacao", scanOffset: 15, label: "Halteres 16–20", expectedTtCategoryId: "saude_fitness" },

    { key: "esteira_05", categoryQuery: "esteira eletrica academia", scanOffset: 5, label: "Esteiras 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "esteira_10", categoryQuery: "esteira eletrica academia", scanOffset: 10, label: "Esteiras 11–15", expectedTtCategoryId: "saude_fitness" },
    { key: "esteira_15", categoryQuery: "esteira eletrica academia", scanOffset: 15, label: "Esteiras 16–20", expectedTtCategoryId: "saude_fitness" },

    { key: "elastico_05", categoryQuery: "faixa elastica treino academia resistencia", scanOffset: 5, label: "Faixas Elásticas 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "elastico_10", categoryQuery: "faixa elastica treino academia resistencia", scanOffset: 10, label: "Faixas Elásticas 11–15", expectedTtCategoryId: "saude_fitness" },
    { key: "elastico_15", categoryQuery: "faixa elastica treino academia resistencia", scanOffset: 15, label: "Faixas Elásticas 16–20", expectedTtCategoryId: "saude_fitness" },

    { key: "banco_05", categoryQuery: "banco supino academia musculacao", scanOffset: 5, label: "Bancos e Supino 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "banco_10", categoryQuery: "banco supino academia musculacao", scanOffset: 10, label: "Bancos e Supino 11–15", expectedTtCategoryId: "saude_fitness" },
    { key: "banco_15", categoryQuery: "banco supino academia musculacao", scanOffset: 15, label: "Bancos e Supino 16–20", expectedTtCategoryId: "saude_fitness" },

    { key: "yoga_05", categoryQuery: "yoga pilates colchonete", scanOffset: 5, label: "Yoga e Pilates 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "yoga_10", categoryQuery: "yoga pilates colchonete", scanOffset: 10, label: "Yoga e Pilates 11–15", expectedTtCategoryId: "saude_fitness" },
    { key: "yoga_15", categoryQuery: "yoga pilates colchonete", scanOffset: 15, label: "Yoga e Pilates 16–20", expectedTtCategoryId: "saude_fitness" },

    { key: "luva_05", categoryQuery: "luva academia musculacao treino", scanOffset: 5, label: "Acessórios de Musculação 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "luva_10", categoryQuery: "luva academia musculacao treino", scanOffset: 10, label: "Acessórios de Musculação 11–15", expectedTtCategoryId: "saude_fitness" },

    { key: "corda_05", categoryQuery: "corda pular treino crossfit", scanOffset: 5, label: "Crossfit e Corda 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "corda_10", categoryQuery: "corda pular treino crossfit", scanOffset: 10, label: "Crossfit e Corda 11–15", expectedTtCategoryId: "saude_fitness" },
    { key: "corda_15", categoryQuery: "corda pular treino crossfit", scanOffset: 15, label: "Crossfit e Corda 16–20", expectedTtCategoryId: "saude_fitness" },

    { key: "balanca_05", categoryQuery: "balanca bioimpedancia fitness", scanOffset: 5, label: "Balanças Fitness 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "balanca_10", categoryQuery: "balanca bioimpedancia fitness", scanOffset: 10, label: "Balanças Fitness 11–15", expectedTtCategoryId: "saude_fitness" },

    // Novas famílias de treino.
    { key: "kettlebell_00", categoryQuery: "kettlebell academia musculacao", scanOffset: 0, label: "Kettlebells 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "kettlebell_05", categoryQuery: "kettlebell academia musculacao", scanOffset: 5, label: "Kettlebells 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "kettlebell_10", categoryQuery: "kettlebell academia musculacao", scanOffset: 10, label: "Kettlebells 11–15", expectedTtCategoryId: "saude_fitness" },

    { key: "anilha_00", categoryQuery: "anilha peso musculacao academia", scanOffset: 0, label: "Anilhas 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "anilha_05", categoryQuery: "anilha peso musculacao academia", scanOffset: 5, label: "Anilhas 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "anilha_10", categoryQuery: "anilha peso musculacao academia", scanOffset: 10, label: "Anilhas 11–15", expectedTtCategoryId: "saude_fitness" },

    { key: "barra_00", categoryQuery: "barra musculacao academia peso", scanOffset: 0, label: "Barras de Musculação 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "barra_05", categoryQuery: "barra musculacao academia peso", scanOffset: 5, label: "Barras de Musculação 6–10", expectedTtCategoryId: "saude_fitness" },
    { key: "barra_10", categoryQuery: "barra musculacao academia peso", scanOffset: 10, label: "Barras de Musculação 11–15", expectedTtCategoryId: "saude_fitness" },

    { key: "estacao_00", categoryQuery: "estacao musculacao academia multifuncional", scanOffset: 0, label: "Estações de Musculação 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "estacao_05", categoryQuery: "estacao musculacao academia multifuncional", scanOffset: 5, label: "Estações de Musculação 6–10", expectedTtCategoryId: "saude_fitness" },

    { key: "eliptico_00", categoryQuery: "eliptico academia cardio", scanOffset: 0, label: "Elípticos 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "eliptico_05", categoryQuery: "eliptico academia cardio", scanOffset: 5, label: "Elípticos 6–10", expectedTtCategoryId: "saude_fitness" },

    { key: "stepper_00", categoryQuery: "stepper academia cardio", scanOffset: 0, label: "Steppers 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "stepper_05", categoryQuery: "stepper academia cardio", scanOffset: 5, label: "Steppers 6–10", expectedTtCategoryId: "saude_fitness" },

    { key: "abdominal_00", categoryQuery: "aparelho abdominal academia treino", scanOffset: 0, label: "Abdominais 1–5", expectedTtCategoryId: "saude_fitness" },
    { key: "abdominal_05", categoryQuery: "aparelho abdominal academia treino", scanOffset: 5, label: "Abdominais 6–10", expectedTtCategoryId: "saude_fitness" }
  ],

  perfumes: [
    // Gerais — mantemos alguns rankings amplos.
    { key: "perf_00", categoryQuery: "perfume eau de parfum", scanOffset: 0, label: "Perfumes gerais 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "perf_05", categoryQuery: "perfume eau de parfum", scanOffset: 5, label: "Perfumes gerais 6–10", expectedTtCategoryId: "moda_beleza" },

    { key: "masc_00", categoryQuery: "perfume masculino", scanOffset: 0, label: "Masculinos", expectedTtCategoryId: "moda_beleza" },
    { key: "fem_00", categoryQuery: "perfume feminino", scanOffset: 0, label: "Femininos", expectedTtCategoryId: "moda_beleza" },
    { key: "arab_00", categoryQuery: "perfume arabe", scanOffset: 0, label: "Árabes", expectedTtCategoryId: "moda_beleza" },
    { key: "imp_00", categoryQuery: "perfume importado original", scanOffset: 0, label: "Importados", expectedTtCategoryId: "moda_beleza" },
    { key: "nac_00", categoryQuery: "perfume nacional", scanOffset: 0, label: "Nacionais", expectedTtCategoryId: "moda_beleza" },
    { key: "unissex_00", categoryQuery: "perfume unissex", scanOffset: 0, label: "Unissex", expectedTtCategoryId: "moda_beleza" },

    // A partir daqui entram frentes bem mais variadas.
    // Com o cursor atual próximo de 8, o próximo ciclo já começa nas marcas.
    { key: "natura_00", categoryQuery: "perfume natura", usePredictedBrand: true, scanOffset: 0, label: "Natura 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "natura_05", categoryQuery: "perfume natura", usePredictedBrand: true, scanOffset: 5, label: "Natura 6–10", expectedTtCategoryId: "moda_beleza" },

    { key: "eudora_00", categoryQuery: "perfume eudora", usePredictedBrand: true, scanOffset: 0, label: "Eudora 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "eudora_05", categoryQuery: "perfume eudora", usePredictedBrand: true, scanOffset: 5, label: "Eudora 6–10", expectedTtCategoryId: "moda_beleza" },

    { key: "boticario_00", categoryQuery: "perfume boticario", usePredictedBrand: true, scanOffset: 0, label: "O Boticário 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "boticario_05", categoryQuery: "perfume boticario", usePredictedBrand: true, scanOffset: 5, label: "O Boticário 6–10", expectedTtCategoryId: "moda_beleza" },

    { key: "avon_00", categoryQuery: "perfume avon", usePredictedBrand: true, scanOffset: 0, label: "Avon", expectedTtCategoryId: "moda_beleza" },
    { key: "jequiti_00", categoryQuery: "perfume jequiti", usePredictedBrand: true, scanOffset: 0, label: "Jequiti", expectedTtCategoryId: "moda_beleza" },
    { key: "hinode_00", categoryQuery: "perfume hinode", usePredictedBrand: true, scanOffset: 0, label: "Hinode", expectedTtCategoryId: "moda_beleza" },

    { key: "lattafa_00", categoryQuery: "perfume lattafa", usePredictedBrand: true, scanOffset: 0, label: "Lattafa 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "lattafa_05", categoryQuery: "perfume lattafa", usePredictedBrand: true, scanOffset: 5, label: "Lattafa 6–10", expectedTtCategoryId: "moda_beleza" },

    { key: "wataniah_00", categoryQuery: "perfume al wataniah", usePredictedBrand: true, scanOffset: 0, label: "Al Wataniah", expectedTtCategoryId: "moda_beleza" },
    { key: "maison_00", categoryQuery: "perfume maison alhambra", usePredictedBrand: true, scanOffset: 0, label: "Maison Alhambra", expectedTtCategoryId: "moda_beleza" },
    { key: "afnan_00", categoryQuery: "perfume afnan", usePredictedBrand: true, scanOffset: 0, label: "Afnan", expectedTtCategoryId: "moda_beleza" },

    { key: "paris_elysees_00", categoryQuery: "perfume paris elysees", usePredictedBrand: true, scanOffset: 0, label: "Paris Elysees", expectedTtCategoryId: "moda_beleza" },
    { key: "banderas_00", categoryQuery: "perfume antonio banderas", usePredictedBrand: true, scanOffset: 0, label: "Antonio Banderas", expectedTtCategoryId: "moda_beleza" },

    { key: "calvin_00", categoryQuery: "perfume calvin klein", usePredictedBrand: true, scanOffset: 0, label: "Calvin Klein", expectedTtCategoryId: "moda_beleza" },
    { key: "carolina_00", categoryQuery: "perfume carolina herrera", usePredictedBrand: true, scanOffset: 0, label: "Carolina Herrera", expectedTtCategoryId: "moda_beleza" },
    { key: "rabanne_00", categoryQuery: "perfume rabanne", usePredictedBrand: true, scanOffset: 0, label: "Rabanne", expectedTtCategoryId: "moda_beleza" },
    { key: "versace_00", categoryQuery: "perfume versace", usePredictedBrand: true, scanOffset: 0, label: "Versace", expectedTtCategoryId: "moda_beleza" },
    { key: "armani_00", categoryQuery: "perfume giorgio armani", usePredictedBrand: true, scanOffset: 0, label: "Giorgio Armani", expectedTtCategoryId: "moda_beleza" },
    { key: "lancome_00", categoryQuery: "perfume lancome", usePredictedBrand: true, scanOffset: 0, label: "Lancôme", expectedTtCategoryId: "moda_beleza" },
    { key: "boss_00", categoryQuery: "perfume hugo boss", usePredictedBrand: true, scanOffset: 0, label: "Hugo Boss", expectedTtCategoryId: "moda_beleza" },

    // Perfis olfativos — ajudam a encontrar outros produtos sem depender só da marca.
    { key: "doce_00", categoryQuery: "perfume feminino doce", scanOffset: 0, label: "Femininos doces", expectedTtCategoryId: "moda_beleza" },
    { key: "floral_00", categoryQuery: "perfume feminino floral", scanOffset: 0, label: "Florais femininos", expectedTtCategoryId: "moda_beleza" },
    { key: "gourmand_00", categoryQuery: "perfume gourmand", scanOffset: 0, label: "Gourmand", expectedTtCategoryId: "moda_beleza" },
    { key: "amadeirado_00", categoryQuery: "perfume masculino amadeirado", scanOffset: 0, label: "Masculinos amadeirados", expectedTtCategoryId: "moda_beleza" },
    { key: "fresco_00", categoryQuery: "perfume masculino fresco", scanOffset: 0, label: "Masculinos frescos", expectedTtCategoryId: "moda_beleza" },

    // Tipos de concentração.
    { key: "edp_fem_00", categoryQuery: "eau de parfum feminino", scanOffset: 0, label: "EDP Feminino", expectedTtCategoryId: "moda_beleza" },
    { key: "edp_masc_00", categoryQuery: "eau de parfum masculino", scanOffset: 0, label: "EDP Masculino", expectedTtCategoryId: "moda_beleza" },
    { key: "edt_fem_00", categoryQuery: "eau de toilette feminino", scanOffset: 0, label: "EDT Feminino", expectedTtCategoryId: "moda_beleza" },
    { key: "edt_masc_00", categoryQuery: "eau de toilette masculino", scanOffset: 0, label: "EDT Masculino", expectedTtCategoryId: "moda_beleza" },

    // Colônias continuam, mas sem as queries de Body Splash/Kits que já falharam no predictor.
    { key: "col_00", categoryQuery: "deo colonia fragrancia", scanOffset: 0, label: "Deo Colônias 1–5", expectedTtCategoryId: "moda_beleza" },
    { key: "col_05", categoryQuery: "deo colonia fragrancia", scanOffset: 5, label: "Deo Colônias 6–10", expectedTtCategoryId: "moda_beleza" },

    // Expansão 6.18X — rankings gerais mais profundos.
    { key: "perf_10", categoryQuery: "perfume eau de parfum", scanOffset: 10, label: "Perfumes gerais 11–15", expectedTtCategoryId: "moda_beleza" },
    { key: "perf_15", categoryQuery: "perfume eau de parfum", scanOffset: 15, label: "Perfumes gerais 16–20", expectedTtCategoryId: "moda_beleza" },

    { key: "masc_05", categoryQuery: "perfume masculino", scanOffset: 5, label: "Masculinos 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "masc_10", categoryQuery: "perfume masculino", scanOffset: 10, label: "Masculinos 11–15", expectedTtCategoryId: "moda_beleza" },

    { key: "fem_05", categoryQuery: "perfume feminino", scanOffset: 5, label: "Femininos 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "fem_10", categoryQuery: "perfume feminino", scanOffset: 10, label: "Femininos 11–15", expectedTtCategoryId: "moda_beleza" },

    { key: "arab_05", categoryQuery: "perfume arabe", scanOffset: 5, label: "Árabes 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "arab_10", categoryQuery: "perfume arabe", scanOffset: 10, label: "Árabes 11–15", expectedTtCategoryId: "moda_beleza" },
    { key: "arab_15", categoryQuery: "perfume arabe", scanOffset: 15, label: "Árabes 16–20", expectedTtCategoryId: "moda_beleza" },

    { key: "imp_05", categoryQuery: "perfume importado original", scanOffset: 5, label: "Importados 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "imp_10", categoryQuery: "perfume importado original", scanOffset: 10, label: "Importados 11–15", expectedTtCategoryId: "moda_beleza" },

    { key: "unissex_05", categoryQuery: "perfume unissex", scanOffset: 5, label: "Unissex 6–10", expectedTtCategoryId: "moda_beleza" },

    // Marcas que já fazem parte do pool, agora com mais profundidade.
    { key: "lattafa_10", categoryQuery: "perfume lattafa", usePredictedBrand: true, scanOffset: 10, label: "Lattafa 11–15", expectedTtCategoryId: "moda_beleza" },
    { key: "lattafa_15", categoryQuery: "perfume lattafa", usePredictedBrand: true, scanOffset: 15, label: "Lattafa 16–20", expectedTtCategoryId: "moda_beleza" },

    { key: "maison_05", categoryQuery: "perfume maison alhambra", usePredictedBrand: true, scanOffset: 5, label: "Maison Alhambra 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "maison_10", categoryQuery: "perfume maison alhambra", usePredictedBrand: true, scanOffset: 10, label: "Maison Alhambra 11–15", expectedTtCategoryId: "moda_beleza" },
    { key: "maison_15", categoryQuery: "perfume maison alhambra", usePredictedBrand: true, scanOffset: 15, label: "Maison Alhambra 16–20", expectedTtCategoryId: "moda_beleza" },

    { key: "afnan_05", categoryQuery: "perfume afnan", usePredictedBrand: true, scanOffset: 5, label: "Afnan 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "afnan_10", categoryQuery: "perfume afnan", usePredictedBrand: true, scanOffset: 10, label: "Afnan 11–15", expectedTtCategoryId: "moda_beleza" },
    { key: "afnan_15", categoryQuery: "perfume afnan", usePredictedBrand: true, scanOffset: 15, label: "Afnan 16–20", expectedTtCategoryId: "moda_beleza" },

    { key: "paris_elysees_05", categoryQuery: "perfume paris elysees", usePredictedBrand: true, scanOffset: 5, label: "Paris Elysees 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "banderas_05", categoryQuery: "perfume antonio banderas", usePredictedBrand: true, scanOffset: 5, label: "Antonio Banderas 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "calvin_05", categoryQuery: "perfume calvin klein", usePredictedBrand: true, scanOffset: 5, label: "Calvin Klein 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "carolina_05", categoryQuery: "perfume carolina herrera", usePredictedBrand: true, scanOffset: 5, label: "Carolina Herrera 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "rabanne_05", categoryQuery: "perfume rabanne", usePredictedBrand: true, scanOffset: 5, label: "Rabanne 6–10", expectedTtCategoryId: "moda_beleza" },
    { key: "versace_05", categoryQuery: "perfume versace", usePredictedBrand: true, scanOffset: 5, label: "Versace 6–10", expectedTtCategoryId: "moda_beleza" }
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

      poolSize:
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

    poolSize:
      total,

    seeds:
      selected
  };
}
