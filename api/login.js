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

  const item = String(req.query.item || "").trim().toUpperCase();
  const itemValido = /^MLB\d+$/.test(item) ? item : "";

  const cookies = [
    `ml_pkce_verifier=${encodeURIComponent(codeVerifier)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    `ml_oauth_state=${encodeURIComponent(state)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  ];

  if (itemValido) {
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
