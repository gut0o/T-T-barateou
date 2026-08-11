// T&T Barateou — tabela de comissão de afiliados
//
// Fonte desta primeira versão:
// tabela fornecida pelo usuário em 2026-08-11.
//
// IMPORTANTE:
// Só cadastramos categorias e percentuais que estavam
// visíveis na tabela fornecida. Categorias não mapeadas
// retornam commissionKnown: false.

export const ML_AFFILIATE_COMMISSIONS = {
  "Beleza e Cuidado Pessoal": {
    direct: 16,
    indirect: 8
  },

  "Calçados, Roupas e Bolsas": {
    direct: 16,
    indirect: 8
  },

  "Esportes e Fitness": {
    direct: 16,
    indirect: 8
  },

  "Acessórios para Veículos": {
    direct: 12,
    indirect: 6
  },

  "Bebês": {
    direct: 12,
    indirect: 6
  },

  "Brinquedos e Hobbies": {
    direct: 12,
    indirect: 6
  },

  "Casa, Móveis e Decoração": {
    direct: 12,
    indirect: 6
  },

  "Construção": {
    direct: 12,
    indirect: 6
  },

  "Ferramentas": {
    direct: 12,
    indirect: 6
  },

  "Games": {
    direct: 12,
    indirect: 6
  },

  "Joias e Relógios": {
    direct: 12,
    indirect: 6
  },

  "Livros, Revistas e Comics": {
    direct: 12,
    indirect: 6
  },

  "Mais Categorias": {
    direct: 12,
    indirect: 6
  },

  "Câmeras e Acessórios": {
    direct: 5,
    indirect: 2.5
  },

  "Celulares e Telefones": {
    direct: 5,
    indirect: 2.5
  },

  "Eletrodomésticos": {
    direct: 5,
    indirect: 2.5
  },

  "Eletrônicos, Áudio e Vídeo": {
    direct: 5,
    indirect: 2.5
  },

  "Informática": {
    direct: 5,
    indirect: 2.5
  }
};

export function getAffiliateCommission(
  rootCategoryName
) {
  const commission =
    ML_AFFILIATE_COMMISSIONS[
      rootCategoryName
    ];

  if (!commission) {
    return {
      commissionKnown: false,
      directCommissionPercent: null,
      indirectCommissionPercent: null
    };
  }

  return {
    commissionKnown: true,
    directCommissionPercent:
      commission.direct,
    indirectCommissionPercent:
      commission.indirect
  };
}
