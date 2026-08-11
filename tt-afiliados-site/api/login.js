import crypto from "node:crypto";

function base64url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export default async function handler(req, res) {
  const clientId = process.env.ML_CLIENT_ID;
  const redirectUri = process.env.ML_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).send(
      "Faltam ML_CLIENT_ID e/ou ML_REDIRECT_URI no Vercel."
    );
  }

  const codeVerifier = base64url(crypto.randomBytes(48));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );
  const state = base64url(crypto.randomBytes(24));

  // NOVO: podemos testar diretamente um link curto/de afiliado.
  // Exemplo:
  // /api/login?link=https://meli.la/2EMjkct
  const link = String(req.query.link || "").trim();

  // Mantém compatibilidade com o teste antigo por item.
  const item = String(req.query.item || "").trim().toUpperCase();
  const itemValido = /^MLB\d+$/.test(item) ? item : "";

  let linkValido = "";
  if (link) {
    try {
      const parsed = new URL(link);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("protocolo inválido");
      }

      const host = parsed.hostname.toLowerCase();

      // Limitamos o teste a domínios do ecossistema Mercado Livre.
      const permitido =
        host === "meli.la" ||
        host === "mercadolivre.com.br" ||
        host.endsWith(".mercadolivre.com.br") ||
        host === "mercadolibre.com" ||
        host.endsWith(".mercadolibre.com");

      if (!permitido) {
        return res.status(400).send(
          "O parâmetro link precisa ser um link do Mercado Livre/meli.la."
        );
      }

      linkValido = parsed.toString();
    } catch {
      return res.status(400).send("Link de teste inválido.");
    }
  }

  const cookies = [
    `ml_pkce_verifier=${encodeURIComponent(codeVerifier)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    `ml_oauth_state=${encodeURIComponent(state)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  ];

  if (linkValido) {
    cookies.push(
      `ml_test_link=${encodeURIComponent(linkValido)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
    );
  } else if (itemValido) {
    cookies.push(
      `ml_test_item=${encodeURIComponent(itemValido)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
    );
  }

  res.setHeader("Set-Cookie", cookies);

  const authUrl = new URL(
    "https://auth.mercadolivre.com.br/authorization"
  );

  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return res.redirect(302, authUrl.toString());
}
