import { getMlTokenStatus } from "../lib/ml-token-store.js";

function safeError(error) {
  return {
    ok: false,
    error: error?.message || "Erro desconhecido"
  };
}

export default async function handler(req, res) {
  try {
    const status = await getMlTokenStatus();

    return res.status(200).json({
      ok: true,
      ...status,
      accessTokenExposed: false,
      refreshTokenExposed: false,
      automaticRefreshReady: true
    });
  } catch (error) {
    return res.status(500).json(safeError(error));
  }
}
