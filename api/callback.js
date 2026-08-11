function getCookies(req) {
  const header = req.headers.cookie || "";

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        const key = index >= 0 ? part.slice(0, index) : part;
        const value = index >= 0 ? part.slice(index + 1) : "";
        return [key, decodeURIComponent(value)];
      })
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearTemporaryCookies(res) {
  res.setHeader("Set-Cookie", [
    "ml_pkce_verifier=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    "ml_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    "ml_test_item=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  ]);
}

async function getJson(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`
    }
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `GET ${url} retornou HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return data;
}

export default async function handler(req, res) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  const redirectUri = process.env.ML_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).send(
      "Faltam ML_CLIENT_ID, ML_CLIENT_SECRET ou ML_REDIRECT_URI no Vercel."
    );
  }

  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    clearTemporaryCookies(res);
    return res.status(400).send(`
      <h1>T&T Barateou</h1>
      <h2>Autorização recusada ou com erro</h2>
      <p>${escapeHtml(error)}</p>
      <p>${escapeHtml(errorDescription)}</p>
    `);
  }

  if (!code) {
    return res.status(200).send(`
      <h1>T&T Barateou</h1>
      <p>Callback OAuth funcionando ✅</p>
      <p>Inicie o login em <code>/api/login</code>.</p>
    `);
  }

  const cookies = getCookies(req);
  const expectedState = cookies.ml_oauth_state;
  const codeVerifier = cookies.ml_pkce_verifier;
  const testItem = cookies.ml_test_item;

  if (!expectedState || !state || state !== expectedState) {
    clearTemporaryCookies(res);
    return res.status(400).send(
      "<h1>T&T Barateou</h1><p>State inválido. Inicie novamente por /api/login.</p>"
    );
  }

  if (!codeVerifier) {
    clearTemporaryCookies(res);
    return res.status(400).send(
      "<h1>T&T Barateou</h1><p>Code verifier não encontrado. Inicie novamente por /api/login.</p>"
    );
  }

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: String(code),
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    });

    const tokenResponse = await fetch(
      "https://api.mercadolibre.com/oauth/token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      }
    );

    const tokenText = await tokenResponse.text();
    let tokenData;

    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      tokenData = { raw: tokenText };
    }

    if (!tokenResponse.ok || !tokenData.access_token) {
      clearTemporaryCookies(res);
      return res.status(400).send(`
        <h1>T&T Barateou</h1>
        <h2>Erro ao trocar o código pelo token</h2>
        <pre>${escapeHtml(JSON.stringify(tokenData, null, 2))}</pre>
      `);
    }

    const usuario = await getJson(
      "https://api.mercadolibre.com/users/me",
      tokenData.access_token
    );

    let produtoHtml = "";

    if (testItem && /^MLB\d+$/.test(testItem)) {
      try {
        const produto = await getJson(
          `https://api.mercadolibre.com/items/${testItem}`,
          tokenData.access_token
        );

        const imagem =
          produto.pictures?.[0]?.secure_url ||
          produto.pictures?.[0]?.url ||
          produto.secure_thumbnail ||
          produto.thumbnail ||
          "";

        const preco =
          typeof produto.price === "number"
            ? produto.price.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL"
              })
            : produto.price ?? "Não informado";

        produtoHtml = `
          <hr>
          <h2>Produto de teste ✅</h2>
          ${imagem ? `<img src="${escapeHtml(imagem)}" alt="Produto" style="max-width:260px;border-radius:12px">` : ""}
          <p><strong>ID:</strong> ${escapeHtml(produto.id)}</p>
          <p><strong>Produto:</strong> ${escapeHtml(produto.title)}</p>
          <p><strong>Preço:</strong> ${escapeHtml(preco)}</p>
        `;
      } catch (produtoError) {
        produtoHtml = `
          <hr>
          <h2>Conta conectada, mas o produto ainda falhou</h2>
          <pre>${escapeHtml(produtoError.message)}</pre>
        `;
      }
    }

    clearTemporaryCookies(res);

    return res.status(200).send(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>T&T Barateou - OAuth</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 700px;
              margin: 50px auto;
              padding: 20px;
              background: #111;
              color: #fff;
            }
            .card {
              background: #1d1d1d;
              padding: 28px;
              border-radius: 18px;
            }
            .ok { color: #36d676; }
            code, pre {
              background: #292929;
              padding: 8px;
              border-radius: 8px;
              white-space: pre-wrap;
              word-break: break-word;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>T&T Barateou</h1>
            <h2 class="ok">Mercado Livre conectado ✅</h2>
            <p>A autenticação OAuth funcionou.</p>
            <p><strong>User ID:</strong> ${escapeHtml(usuario.id)}</p>
            <p><strong>Nickname:</strong> ${escapeHtml(usuario.nickname || "")}</p>
            <p>O access token não foi exibido nem salvo nesta etapa.</p>
            ${produtoHtml}
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    clearTemporaryCookies(res);

    return res.status(500).send(`
      <h1>T&T Barateou</h1>
      <h2>Erro inesperado</h2>
      <pre>${escapeHtml(err.message)}</pre>
    `);
  }
}
