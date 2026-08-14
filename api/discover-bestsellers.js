import {
  getValidMlTokenData
} from "../lib/ml-token-store.js";

import {
  discoverBestSellers
} from "../lib/ml-bestsellers-discovery.js";

import {
  enrichBestSellerCandidates
} from "../lib/ml-bestsellers-enrichment.js";

import {
  enrichOfferCategoryAndCommission
} from "../lib/ml-offer-category-enrichment.js";

import {
  calculateOfferScore
} from "../lib/offer-scoring.js";

import {
  routeToTtCategory
} from "../lib/tt-category-routing.js";

import {
  buildPublicationPlan
} from "../lib/tt-publication-planner.js";

import {
  queuePendingPublications
} from "../lib/tt-pending-publication-store.js";

import {
  handleAttachAffiliateAction,
  handleAutoDiscoverAction,
  handleIngestAffiliateLinksAction,
  handlePublicationStatusAction,
  handleQueueListAction,
  handleQueueSummaryAction
} from "../lib/tt-queue-admin-actions.js";


const PRODUCT_SCAN_LIMIT = 5;

function queryFlag(value) {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "sim"
  );
}

function estimateCommissionValue(
  price,
  percent
) {
  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    typeof percent !== "number" ||
    !Number.isFinite(percent)
  ) {
    return null;
  }

  return Number(
    (
      price *
      (percent / 100)
    ).toFixed(2)
  );
}

function priorityWeight(
  priority
) {
  if (priority === "high") {
    return 3;
  }

  if (priority === "medium") {
    return 2;
  }

  if (priority === "low") {
    return 1;
  }

  return 0;
}

async function buildAnalyzedCandidate({
  candidate,
  accessToken
}) {
  if (
    !candidate ||
    candidate.resolved !== true
  ) {
    return {
      ...candidate,
      analysisStatus:
        "not_analyzed_unresolved"
    };
  }

  const category =
    await enrichOfferCategoryAndCommission({
      categoryId:
        candidate.categoryId ||
        null,

      categoryName:
        null,

      domainId:
        candidate.domainId ||
        null,

      title:
        candidate.title ||
        null,

      accessToken
    });

  const estimatedDirectCommission =
    estimateCommissionValue(
      candidate.price,
      category
        .directCommissionPercent
    );

  const estimatedIndirectCommission =
    estimateCommissionValue(
      candidate.price,
      category
        .indirectCommissionPercent
    );

  const scoring =
    calculateOfferScore({
      discount:
        candidate.discount,

      directCommissionPercent:
        category
          .directCommissionPercent,

      estimatedDirectCommission
    });

  const routing =
    routeToTtCategory({
      rootCategory:
        category.rootCategory
    });

  const hasCoreOfferData =
    Boolean(
      candidate.title &&
      candidate.image &&
      typeof candidate.price === "number"
    );

  return {
    ...candidate,

    analysisStatus:
      "analyzed",

    rootCategory:
      category.rootCategory,

    categoryPath:
      category.categoryPath,

    resolvedCategoryId:
      category.categoryId,

    resolvedCategoryName:
      category.categoryName,

    commissionKnown:
      category.commissionKnown,

    directCommissionPercent:
      category
        .directCommissionPercent,

    indirectCommissionPercent:
      category
        .indirectCommissionPercent,

    estimatedDirectCommission,

    estimatedIndirectCommission,

    offerScore:
      scoring.offerScore,

    priority:
      scoring.priority,

    scoreStatus:
      scoring.scoreStatus,

    scoreBreakdown:
      scoring.scoreBreakdown,

    scoreVersion:
      scoring.scoreVersion,

    ttCategoryId:
      routing.ttCategoryId,

    ttCategoryName:
      routing.ttCategoryName,

    ttCategoryEmoji:
      routing.ttCategoryEmoji,

    ttRoutingKnown:
      routing.ttRoutingKnown,

    automationReadiness:
      hasCoreOfferData
        ? "ready_for_next_stage"
        : "needs_more_data"
  };
}

function sortShortlist(
  candidates
) {
  return candidates
    .slice()
    .sort(
      (a, b) => {
        const priorityDiff =
          priorityWeight(
            b.priority
          ) -
          priorityWeight(
            a.priority
          );

        if (priorityDiff) {
          return priorityDiff;
        }

        const aScore =
          typeof a.offerScore === "number"
            ? a.offerScore
            : -1;

        const bScore =
          typeof b.offerScore === "number"
            ? b.offerScore
            : -1;

        if (bScore !== aScore) {
          return bScore - aScore;
        }

        return (
          (a.rank ?? 999) -
          (b.rank ?? 999)
        );
      }
    );
}

export default async function handler(
  req,
  res
) {
  if (
    req.method !== "GET" &&
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      "GET, POST"
    );

    return res
      .status(405)
      .json({
        ok: false,

        error:
          "Use GET ou POST neste endpoint.",

        accessTokenExposed:
          false,

        refreshTokenExposed:
          false
      });
  }

  try {
    const action =
      String(
        req.query?.action ||
        req.body?.action ||
        ""
      )
        .trim()
        .toLowerCase();

    if (
      action ===
      "queue-summary"
    ) {
      const result =
        await handleQueueSummaryAction(
          req
        );

      return res
        .status(200)
        .json(
          result
        );
    }

    if (
      action ===
      "auto-discover"
    ) {
      if (
        req.method !== "GET" &&
        req.method !== "POST"
      ) {
        return res
          .status(405)
          .json({
            ok:
              false,

            error:
              "Use GET ou POST para descoberta automática.",

            accessTokenExposed:
              false,

            refreshTokenExposed:
              false
          });
      }

      const result =
        await handleAutoDiscoverAction(
          req
        );

      return res
        .status(200)
        .json(
          result
        );
    }

    if (
      action ===
      "queue-list"
    ) {
      const result =
        await handleQueueListAction(
          req
        );

      return res
        .status(200)
        .json(
          result
        );
    }

    if (
      action ===
      "attach-affiliate-link"
    ) {
      if (
        req.method !==
        "POST"
      ) {
        return res
          .status(405)
          .json({
            ok:
              false,

            error:
              "Use POST para anexar link afiliado.",

            accessTokenExposed:
              false,

            refreshTokenExposed:
              false
          });
      }

      const result =
        await handleAttachAffiliateAction(
          req
        );

      return res
        .status(
          result.ok === false
            ? 400
            : 200
        )
        .json(
          result
        );
    }

    if (
      action ===
      "publication-status"
    ) {
      if (
        req.method !==
        "POST"
      ) {
        return res
          .status(405)
          .json({
            ok:
              false,

            error:
              "Use POST para atualizar status de publicação.",

            accessTokenExposed:
              false,

            refreshTokenExposed:
              false
          });
      }

      const result =
        await handlePublicationStatusAction(
          req
        );

      return res
        .status(200)
        .json(
          result
        );
    }

    if (
      action ===
      "ingest-affiliate-links"
    ) {
      if (
        req.method !==
        "POST"
      ) {
        return res
          .status(405)
          .json({
            ok:
              false,

            error:
              "Use POST para importar links afiliados.",

            accessTokenExposed:
              false,

            refreshTokenExposed:
              false
          });
      }

      const result =
        await handleIngestAffiliateLinksAction(
          req
        );

      return res
        .status(
          result.ok === false
            ? 207
            : 200
        )
        .json(
          result
        );
    }

    if (
      req.method !==
      "GET"
    ) {
      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            "POST exige uma action válida.",

          accessTokenExposed:
            false,

          refreshTokenExposed:
            false
        });
    }

    const tokenData =
      await getValidMlTokenData();

    const result =
      await discoverBestSellers({
        accessToken:
          tokenData
            .access_token,

        categoryId:
          req.query
            ?.categoryId ||
          null
      });

    if (
      !result?.ok ||
      !Array.isArray(
        result?.candidates
      )
    ) {
      return res
        .status(200)
        .json(
          result
        );
    }

    // Nossa credencial já mostrou que ITEM e USER_PRODUCT
    // estão bloqueados para leitura de detalhes.
    // Em vez de gastar chamadas nesses tipos, percorremos o top 20
    // e selecionamos os primeiros PRODUCTs acessíveis.
    const productCandidates =
      result.candidates
        .filter(
          (candidate) =>
            candidate?.type ===
            "PRODUCT"
        )
        .slice(
          0,
          PRODUCT_SCAN_LIMIT
        );

    const enrichment =
      await enrichBestSellerCandidates({
        accessToken:
          tokenData
            .access_token,

        candidates:
          productCandidates,

        limit:
          PRODUCT_SCAN_LIMIT
      });

    const analyzedCandidates =
      [];

    for (
      const candidate of
      enrichment.candidates
    ) {
      analyzedCandidates.push(
        await buildAnalyzedCandidate({
          candidate,
          accessToken:
            tokenData
              .access_token
        })
      );
    }

    const readyCandidates =
      analyzedCandidates.filter(
        (candidate) =>
          candidate
            .automationReadiness ===
          "ready_for_next_stage"
      );

    const shortlist =
      sortShortlist(
        readyCandidates
      );

    const publicationPlan =
      buildPublicationPlan({
        shortlist,
        maxPublications:
          3
      });

    const persistQueue =
      queryFlag(
        req.query?.queue
      );

    let queuePersistence = {
      requested:
        persistQueue,

      status:
        persistQueue
          ? "nothing_to_queue"
          : "not_requested",

      queuedCount:
        0,

      newQueuedCount:
        0,

      duplicateCount:
        0,

      results:
        []
    };

    if (
      persistQueue &&
      publicationPlan.ready.length
    ) {
      const persistence =
        await queuePendingPublications(
          publicationPlan.ready
        );

      queuePersistence = {
        requested:
          true,

        status:
          "queue_saved",

        requestedCount:
          persistence
            .requestedCount,

        queuedCount:
          persistence
            .queuedCount,

        newQueuedCount:
          persistence
            .newQueuedCount,

        duplicateCount:
          persistence
            .duplicateCount,

        results:
          persistence
            .results
      };
    }

    return res
      .status(200)
      .json({
        ...result,

        discoveryStrategy:
          "top20_then_first_5_catalog_products",

        scannedHighlightCount:
          result.candidates.length,

        selectedProductCount:
          productCandidates.length,

        enrichmentLimit:
          PRODUCT_SCAN_LIMIT,

        enrichedCandidateCount:
          enrichment.requested,

        enrichedResolvedCount:
          enrichment.resolvedCount,

        enrichedUnresolvedCount:
          enrichment.unresolvedCount,

        analyzedCandidateCount:
          analyzedCandidates.length,

        readyCandidateCount:
          readyCandidates.length,

        analyzedCandidates,

        shortlist,

        shortlistStatus:
          shortlist.length > 0
            ? "offers_ready_for_next_stage"
            : "no_ready_offers",

        publicationPlan,

        queuePersistence,

        queueRequested:
          persistQueue,

        nextStage:
          publicationPlan.ready.length > 0
            ? "fill_affiliate_links_then_publish"
            : "try_another_leaf_category",

        note:
          "O T&T descobre, analisa, seleciona até 3 ofertas high/medium, monta a mensagem pronta e, com queue=1, grava uma fila privada sem duplicar produtos. O link afiliado e o envio ao WhatsApp continuam pendentes."
      });
  } catch (error) {
    return res
      .status(
        Number(
          error?.statusCode
        ) ||
        500
      )
      .json({
        ok: false,

        error:
          error?.message ||
          "Erro inesperado ao processar a solicitação.",

        accessTokenExposed:
          false,

        refreshTokenExposed:
          false
      });
  }
}
