// T&T Barateou — tabela confirmada de comissão de afiliados.
//
// Esta versão contém SOMENTE os grupos e percentuais que foram
// confirmados na tabela apresentada pelo usuário em 2026-08-11.
//
// Regra oficial do Mercado Livre:
// - venda direta: percentual da categoria;
// - venda indireta: 50% da taxa da categoria comprada.
//
// Categorias não confirmadas continuam como commissionKnown: false.
// Nunca inferimos comissão apenas pelo nome do produto.

export const COMMISSION_TABLE_VERSION =
  "BR-2026-08-11-confirmed";

export const COMMISSION_TABLE_SOURCE =
  "mercadolivre_affiliates_confirmed_table";

const COMMISSIONS_BY_ROOT_ID = {
  // 16% direta / 8% indireta
  MLB1246: {
    name: "Beleza e Cuidado Pessoal",
    direct: 16,
    indirect: 8,
    group: "16_8"
  },

  MLB1430: {
    name: "Calçados, Roupas e Bolsas",
    direct: 16,
    indirect: 8,
    group: "16_8"
  },

  MLB1276: {
    name: "Esportes e Fitness",
    direct: 16,
    indirect: 8,
    group: "16_8"
  },

  // 12% direta / 6% indireta
  MLB5672: {
    name: "Acessórios para Veículos",
    direct: 12,
    indirect: 6,
    group: "12_6"
  },

  MLB1384: {
    name: "Bebês",
    direct: 12,
    indirect: 6,
    group: "12_6"
  },

  MLB1132: {
    name: "Brinquedos e Hobbies",
    direct: 12,
    indirect: 6,
    group: "12_6"
  },

  MLB1574: {
    name: "Casa, Móveis e Decoração",
    direct: 12,
    indirect: 6,
    group: "12_6"
  },

  MLB1500: {
    name: "Construção",
    direct: 12,
    indirect: 6,
    group: "12_6"
  },

  MLB263532: {
    name: "Ferramentas",
    direct: 12,
    indirect: 6,
    group: "12_6"
  },

  MLB1144: {
    name: "Games",
    direct: 12,
    indirect: 6,
    group: "12_6"
  },

  MLB3937: {
    name: "Joias e Relógios",
    direct: 12,
    indirect: 6,
    group: "12_6"
  },

  MLB1196: {
    name: "Livros, Revistas e Comics",
    direct: 12,
    indirect: 6,
    group: "12_6"
  },

  MLB1953: {
    name: "Mais Categorias",
    direct: 12,
    indirect: 6,
    group: "12_6"
  },

  // 5% direta / 2,5% indireta
  MLB1039: {
    name: "Câmeras e Acessórios",
    direct: 5,
    indirect: 2.5,
    group: "5_2_5"
  },

  MLB1051: {
    name: "Celulares e Telefones",
    direct: 5,
    indirect: 2.5,
    group: "5_2_5"
  },

  MLB5726: {
    name: "Eletrodomésticos",
    direct: 5,
    indirect: 2.5,
    group: "5_2_5"
  },

  MLB1000: {
    name: "Eletrônicos, Áudio e Vídeo",
    direct: 5,
    indirect: 2.5,
    group: "5_2_5"
  },

  MLB1648: {
    name: "Informática",
    direct: 5,
    indirect: 2.5,
    group: "5_2_5"
  }
};

const ROOT_ID_BY_NAME =
  Object.fromEntries(
    Object.entries(
      COMMISSIONS_BY_ROOT_ID
    ).map(
      ([id, value]) => [
        value.name,
        id
      ]
    )
  );

export function getAffiliateCommission(
  rootCategory
) {
  const rootId =
    typeof rootCategory === "object"
      ? rootCategory?.id || null
      : ROOT_ID_BY_NAME[
          String(rootCategory || "")
        ] || null;

  const rootName =
    typeof rootCategory === "object"
      ? rootCategory?.name || null
      : (
          typeof rootCategory === "string"
            ? rootCategory
            : null
        );

  const commission =
    rootId
      ? COMMISSIONS_BY_ROOT_ID[
          rootId
        ]
      : null;

  if (!commission) {
    return {
      commissionKnown: false,
      directCommissionPercent: null,
      indirectCommissionPercent: null,
      commissionGroup: null,
      commissionTableVersion:
        COMMISSION_TABLE_VERSION,
      commissionSource:
        COMMISSION_TABLE_SOURCE,
      matchedRootCategoryId:
        rootId,
      matchedRootCategoryName:
        rootName
    };
  }

  return {
    commissionKnown: true,

    directCommissionPercent:
      commission.direct,

    indirectCommissionPercent:
      commission.indirect,

    commissionGroup:
      commission.group,

    commissionTableVersion:
      COMMISSION_TABLE_VERSION,

    commissionSource:
      COMMISSION_TABLE_SOURCE,

    matchedRootCategoryId:
      rootId,

    matchedRootCategoryName:
      commission.name
  };
}
