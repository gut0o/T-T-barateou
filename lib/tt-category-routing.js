// T&T Barateou — roteamento interno de categorias
//
// Versão 1.0:
// transforma as 32 categorias raiz do Mercado Livre
// em 8 categorias T&T mais simples para os grupos.
//
// IMPORTANTE:
// isso é informação interna e não aparece no anúncio.

export const TT_ROUTING_VERSION =
  "TT-CATEGORIES-1.0";

const TT_CATEGORIES = {
  moda_beleza: {
    id: "moda_beleza",
    name: "Moda & Beleza",
    emoji: "👗"
  },

  casa_eletro: {
    id: "casa_eletro",
    name: "Casa & Eletro",
    emoji: "🏠"
  },

  tecnologia_games: {
    id: "tecnologia_games",
    name: "Tecnologia & Games",
    emoji: "📱"
  },

  saude_fitness: {
    id: "saude_fitness",
    name: "Saúde & Fitness",
    emoji: "💪"
  },

  bebes_criancas: {
    id: "bebes_criancas",
    name: "Bebês & Crianças",
    emoji: "👶"
  },

  auto_moto: {
    id: "auto_moto",
    name: "Auto & Moto",
    emoji: "🚗"
  },

  pet_shop: {
    id: "pet_shop",
    name: "Pet Shop",
    emoji: "🐶"
  },

  ofertas_variedades: {
    id: "ofertas_variedades",
    name: "Ofertas & Variedades",
    emoji: "🔥"
  }
};

const ROOT_CATEGORY_TO_TT = {
  // Moda & Beleza
  "Beleza e Cuidado Pessoal":
    "moda_beleza",

  "Calçados, Roupas e Bolsas":
    "moda_beleza",

  "Joias e Relógios":
    "moda_beleza",

  // Casa & Eletro
  "Casa, Móveis e Decoração":
    "casa_eletro",

  "Construção":
    "casa_eletro",

  "Eletrodomésticos":
    "casa_eletro",

  "Ferramentas":
    "casa_eletro",

  // Tecnologia & Games
  "Câmeras e Acessórios":
    "tecnologia_games",

  "Celulares e Telefones":
    "tecnologia_games",

  "Eletrônicos, Áudio e Vídeo":
    "tecnologia_games",

  "Games":
    "tecnologia_games",

  "Informática":
    "tecnologia_games",

  // Saúde & Fitness
  "Esportes e Fitness":
    "saude_fitness",

  "Saúde":
    "saude_fitness",

  // Bebês & Crianças
  "Bebês":
    "bebes_criancas",

  "Brinquedos e Hobbies":
    "bebes_criancas",

  // Auto & Moto
  "Acessórios para Veículos":
    "auto_moto",

  "Carros, Motos e Outros":
    "auto_moto",

  // Pet Shop
  "Pet Shop":
    "pet_shop",

  // Ofertas & Variedades
  "Agro":
    "ofertas_variedades",

  "Alimentos e Bebidas":
    "ofertas_variedades",

  "Antiguidades e Coleções":
    "ofertas_variedades",

  "Arte, Papelaria e Armarinho":
    "ofertas_variedades",

  "Festas e Lembrancinhas":
    "ofertas_variedades",

  "Imóveis":
    "ofertas_variedades",

  "Indústria e Comércio":
    "ofertas_variedades",

  "Ingressos":
    "ofertas_variedades",

  "Instrumentos Musicais":
    "ofertas_variedades",

  "Livros, Revistas e Comics":
    "ofertas_variedades",

  "Mais Categorias":
    "ofertas_variedades",

  "Música, Filmes e Seriados":
    "ofertas_variedades",

  "Serviços":
    "ofertas_variedades"
};

export function routeToTtCategory({
  rootCategory = null
} = {}) {
  const rootName =
    typeof rootCategory === "object"
      ? rootCategory?.name || null
      : (
          typeof rootCategory === "string"
            ? rootCategory
            : null
        );

  const matchedId =
    rootName
      ? ROOT_CATEGORY_TO_TT[
          rootName
        ] || null
      : null;

  const routeId =
    matchedId ||
    "ofertas_variedades";

  const category =
    TT_CATEGORIES[
      routeId
    ];

  return {
    ttCategoryId:
      category.id,

    ttCategoryName:
      category.name,

    ttCategoryEmoji:
      category.emoji,

    ttRoutingKnown:
      Boolean(matchedId),

    ttRoutingSource:
      matchedId
        ? "mercadolivre_root_category"
        : "fallback_ofertas_variedades",

    ttRoutingVersion:
      TT_ROUTING_VERSION,

    mlRootCategoryName:
      rootName
  };
}
