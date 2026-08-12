import {
  getValidMlTokenData
} from "../lib/ml-token-store.js";

import {
  discoverBestSellers
} from "../lib/ml-bestsellers-discovery.js";

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

    return res
      .status(200)
      .json(
        result
      );
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
