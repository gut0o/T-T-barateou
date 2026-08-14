// T&T Barateou — pacote acelerado 6.9
//
// Transforma a shortlist analisada em um plano de publicação.
//
// IMPORTANTE:
// - comissão, score e dados internos NÃO entram na mensagem;
// - o link de afiliado ainda fica pendente;
// - ofertas low/unknown são seguradas nesta versão;
// - high/medium podem entrar na fila.

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

function isApprovedPriority(candidate) {
  return (
    candidate?.scoreStatus === "calculated" &&
    (
      candidate?.priority === "high" ||
      candidate?.priority === "medium"
    )
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

    itemId:
      candidate.itemId,

    productId:
      candidate.productId ||
      null,

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

    internalPriority:
      candidate.priority,

    internalOfferScore:
      candidate.offerScore,

    sourceRank:
      candidate.rank ??
      null,

    messageDraft:
      buildMessageDraft(
        candidate
      )
  };
}

function heldReason(candidate) {
  if (!hasPublishableCore(candidate)) {
    return "missing_core_offer_data";
  }

  if (
    candidate?.scoreStatus ===
    "insufficient_data"
  ) {
    return "insufficient_score_data";
  }

  if (
    candidate?.priority === "low"
  ) {
    return "low_priority";
  }

  if (
    candidate?.priority === "unknown"
  ) {
    return "unknown_priority";
  }

  return "not_approved_by_current_rules";
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
      ready.length < max &&
      hasPublishableCore(candidate) &&
      isApprovedPriority(candidate)
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

      priority:
        candidate?.priority ||
        null,

      offerScore:
        candidate?.offerScore ??
        null,

      reason:
        heldReason(
          candidate
        )
    });
  }

  return {
    planVersion:
      "TT-PUBLISH-1.0",

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
