import {
  getValidMlTokenData
} from "../lib/ml-token-store.js";

import {
  resolveDomainCategory
} from "../lib/ml-domain-category.js";

export default async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    res.setHeader(
      "Allow",
      "GET"
    );

    return res
      .status(405)
      .json({
        ok: false,
        error:
          "Use GET."
      });
  }

  try {
    const domainId =
      req.query?.domainId ||
      req.query?.id ||
      null;

    const title =
      req.query?.title ||
      null;

    if (!domainId) {
      return res
        .status(400)
        .json({
          ok: false,
          error:
            "Informe domainId, por exemplo MLB-AIR_CONDITIONERS."
        });
    }

    const tokenData =
      await getValidMlTokenData();

    if (
      !tokenData?.access_token
    ) {
      throw new Error(
        "Mercado Livre não está conectado."
      );
    }

    const result =
      await resolveDomainCategory({
        domainId,
        title,
        accessToken:
          tokenData.access_token
      });

    return res
      .status(200)
      .json({
        ok: true,

        ...result,

        source:
          "mercadolivre_catalog_domain_categories",

        accessTokenExposed:
          false,

        refreshTokenExposed:
          false
      });
  } catch (error) {
    return res
      .status(500)
      .json({
        ok: false,

        error:
          error?.message ||
          "Erro desconhecido.",

        accessTokenExposed:
          false,

        refreshTokenExposed:
          false
      });
  }
}
