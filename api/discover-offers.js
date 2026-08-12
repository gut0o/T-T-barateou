import {
  getValidMlTokenData
} from "../lib/ml-token-store.js";

import {
  discoverMlOffers
} from "../lib/ml-offer-discovery.js";

export default async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    res.setHeader(
      "Allow",
      "GET"
    );

    return res.status(405).json({
      ok: false,
      error:
        "Use GET neste endpoint.",
      accessTokenExposed: false,
      refreshTokenExposed: false
    });
  }

  try {
    const tokenData =
      await getValidMlTokenData();

    const result =
      await discoverMlOffers({
        accessToken:
          tokenData.access_token,

        query:
          req.query?.q || null,

        limit:
          req.query?.limit || null
      });

    // Mesmo se o Mercado Livre responder 401/403,
    // devolvemos JSON legível para facilitar o teste.
    return res.status(200).json(
      result
    );
  } catch (error) {
    return res.status(500).json({
      ok: false,

      error:
        error?.message ||
        "Erro inesperado na descoberta de ofertas.",

      accessTokenExposed:
        false,

      refreshTokenExposed:
        false
    });
  }
}
