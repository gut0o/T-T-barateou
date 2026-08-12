import {
  getValidMlTokenData
} from "../lib/ml-token-store.js";

import {
  discoverBestSellers
} from "../lib/ml-bestsellers-discovery.js";

import {
  enrichBestSellerCandidates
} from "../lib/ml-bestsellers-enrichment.js";

export default async function handler(
  req,
  res
) {
  if (
    req.method !==
    "GET"
  ) {
    res.setHeader(
      "Allow",
      "GET"
    );

    return res
      .status(405)
      .json({
        ok: false,

        error:
          "Use GET neste endpoint.",

        accessTokenExposed:
          false,

        refreshTokenExposed:
          false
      });
  }

  try {
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

    const enrichment =
      await enrichBestSellerCandidates({
        accessToken:
          tokenData
            .access_token,

        candidates:
          result.candidates,

        limit:
          3
      });

    return res
      .status(200)
      .json({
        ...result,

        enrichmentLimit:
          3,

        enrichedCandidateCount:
          enrichment.requested,

        directItemRequestMode:
          enrichment.directItemRequestMode,

        enrichedResolvedCount:
          enrichment.resolvedCount,

        enrichedUnresolvedCount:
          enrichment.unresolvedCount,

        enrichedCandidates:
          enrichment.candidates,

        enrichmentStatus:
          enrichment.resolvedCount > 0
            ? "details_found"
            : "details_unavailable",

        note:
          "Os 20 mais vendidos continuam sendo retornados, mas somente os 3 primeiros são enriquecidos nesta etapa para manter a execução leve."
      });
  } catch (error) {
    return res
      .status(500)
      .json({
        ok: false,

        error:
          error?.message ||
          "Erro inesperado ao consultar mais vendidos.",

        accessTokenExposed:
          false,

        refreshTokenExposed:
          false
      });
  }
}
