// T&T Barateou — Etapa 6.18K
//
// Seleção simplificada:
// - dados mínimos válidos;
// - roteamento por categoria;
// - sem score;
// - sem prioridade high/medium/low.

const DEFAULT_MAX_PUBLICATIONS = 3;

function formatBRL(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  ).format(value);
}

function hasPublishableCore(candidate) {
  return Boolean(
    candidate?.itemId &&
    candidate?.title &&
    candidate?.image &&
    typeof candidate?.price === "number" &&
    Number.isFinite(candidate.price)
  );
}

function buildMessageDraft(candidate) {
  const lines = [
    "🔥 T&T BARATEOU",
    "",
    `🛒 ${candidate.title}`
  ];

  const originalPrice =
    formatBRL(
      candidate.originalPrice
    );

  const currentPrice =
    formatBRL(
      candidate.price
    );

  if (
    originalPrice &&
    typeof candidate.originalPrice === "number" &&
    candidate.originalPrice > candidate.price
  ) {
    lines.push(
      `De: ${originalPrice}`
    );
  }

  if (currentPrice) {
    lines.push(
      `💰 Por: ${currentPrice}`
    );
  }

  if (
    typeof candidate.discount === "number" &&
    Number.isFinite(candidate.discount) &&
    candidate.discount > 0
  ) {
    lines.push(
      `🔥 ${candidate.discount}% OFF`
    );
  }

  if (
    candidate.freeShipping === true
  ) {
    lines.push(
      "🚚 Frete grátis"
    );
  }

  lines.push(
    "",
    "👇 Comprar no Mercado Livre:",
    "[LINK_AFILIADO_PENDENTE]"
  );

  return lines.join("\n");
}

function buildReadyCandidate(candidate) {
  return {
    queueKey:
      candidate.itemId,

    publicationStatus:
      "awaiting_affiliate_link",

    affiliateLink:
      null,

    affiliateLinkStatus:
      "pending",

    priority:
      candidate.priority ||
      null,

    source:
      candidate.source ||
      null,

    manualPanel:
      candidate.manualPanel ===
      true,

    itemId:
      candidate.itemId,

    productId:
      candidate.productId ||
      null,

    sellerId:
      candidate.sellerId ??
      candidate.seller_id ??
      null,

    catalogPageUrl:
      candidate.catalogPageUrl ||
      (
        candidate.productId
          ? `https://www.mercadolivre.com.br/p/${candidate.productId}`
          : null
      ),

    title:
      candidate.title,

    image:
      candidate.image,

    price:
      candidate.price,

    originalPrice:
      candidate.originalPrice ??
      null,

    discount:
      candidate.discount ??
      null,

    freeShipping:
      candidate.freeShipping === true,

    currency:
      candidate.currency ||
      "BRL",

    ttCategoryId:
      candidate.ttCategoryId ||
      "ofertas_variedades",

    ttCategoryName:
      candidate.ttCategoryName ||
      "Ofertas & Variedades",

    ttCategoryEmoji:
      candidate.ttCategoryEmoji ||
      "🔥",

    sourceRank:
      candidate.rank ??
      null,

    messageDraft:
      buildMessageDraft(
        candidate
      )
  };
}

export function buildPublicationPlan({
  shortlist = [],
  maxPublications =
    DEFAULT_MAX_PUBLICATIONS
} = {}) {
  const max =
    Math.min(
      Math.max(
        Number(maxPublications) || 1,
        1
      ),
      DEFAULT_MAX_PUBLICATIONS
    );

  const ready =
    [];

  const held =
    [];

  for (
    const candidate of
    shortlist || []
  ) {
    if (
      !hasPublishableCore(
        candidate
      )
    ) {
      held.push({
        itemId:
          candidate?.itemId ||
          null,

        title:
          candidate?.title ||
          null,

        reason:
          "missing_core_offer_data"
      });

      continue;
    }

    if (
      ready.length <
      max
    ) {
      ready.push(
        buildReadyCandidate(
          candidate
        )
      );

      continue;
    }

    held.push({
      itemId:
        candidate?.itemId ||
        null,

      title:
        candidate?.title ||
        null,

      reason:
        "batch_limit_reached"
    });
  }

  return {
    planVersion:
      "TT-PUBLISH-2.0-CATEGORY-ONLY",

    selectionRule:
      "publishable_core_and_category_routing",

    maxPublications:
      max,

    readyCount:
      ready.length,

    heldCount:
      held.length,

    ready,

    held,

    status:
      ready.length
        ? "awaiting_affiliate_links"
        : "nothing_ready_to_queue"
  };
}
