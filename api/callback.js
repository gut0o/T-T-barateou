const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

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
    "ml_test_item=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    "ml_test_link=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  ]);
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("\\/", "/")
    .replaceAll("\\u002F", "/")
    .replaceAll("\\u003A", ":")
    .replaceAll("\\u0026", "&");
}

function normalizeMlb(value) {
  const match = String(value || "").match(/MLB-?(\d{6,})/i);
  return match ? `MLB${match[1]}`.toUpperCase() : null;
}

function addCandidate(map, id, type, source, evidence = "") {
  const normalized = normalizeMlb(id);
  if (!normalized) return;

  const key = `${type}:${normalized}`;

  if (!map.has(key)) {
    map.set(key, {
      id: normalized,
      type,
      sources: [],
      evidence: []
    });
  }

  const candidate = map.get(key);

  if (!candidate.sources.includes(source)) {
    candidate.sources.push(source);
  }

  if (evidence && candidate.evidence.length < 3) {
    candidate.evidence.push(evidence.slice(0, 240));
  }
}

function collectUrls(html, finalUrl) {
  const urls = new Set();

  if (finalUrl) urls.add(finalUrl);

  const normalizedHtml = decodeHtmlEntities(html);

  const tagPatterns = [
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/gi,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["']/gi,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/gi,
    /<meta[^>]+name=["']twitter:url["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:url["']/gi
  ];

  for (const pattern of tagPatterns) {
    for (const match of normalizedHtml.matchAll(pattern)) {
      if (match[1]) urls.add(match[1]);
    }
  }

  // URLs absolutas embutidas em JSON/HTML.
  const urlPattern =
    /https?:\/\/(?:www\.)?(?:mercadolivre\.com\.br|mercadolibre\.com)[^"'<>\\\s]+/gi;

  for (const match of normalizedHtml.matchAll(urlPattern)) {
    urls.add(match[0]);
    if (urls.size >= 80) break;
  }

  return [...urls];
}

function collectCandidates(html, finalUrl) {
  const candidates = new Map();
  const urls = collectUrls(html, finalUrl);

  for (const urlText of urls) {
    const cleanUrl = decodeHtmlEntities(urlText);

    // URL no padrão /p/MLB... representa normalmente produto de catálogo/PDP.
    const catalogMatch = cleanUrl.match(/\/p\/(MLB-?\d{6,})/i);
    if (catalogMatch) {
      addCandidate(
        candidates,
        catalogMatch[1],
        "product",
        "URL /p/",
        cleanUrl
      );
    }

    // IDs MLB presentes em URLs de anúncio.
    for (const match of cleanUrl.matchAll(/MLB-?(\d{6,})/gi)) {
      const id = `MLB${match[1]}`;

      if (!catalogMatch || normalizeMlb(catalogMatch[1]) !== normalizeMlb(id)) {
        addCandidate(candidates, id, "item", "URL Mercado Livre", cleanUrl);
      }
    }
  }

  const normalizedHtml = decodeHtmlEntities(html);

  const structuredPatterns = [
    {
      type: "item",
      source: "campo item_id",
      regex: /["']item_id["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    },
    {
      type: "item",
      source: "campo itemId",
      regex: /["']itemId["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    },
    {
      type: "product",
      source: "campo catalog_product_id",
      regex: /["']catalog_product_id["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    },
    {
      type: "product",
      source: "campo catalogProductId",
      regex: /["']catalogProductId["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    },
    {
      type: "product",
      source: "campo product_id",
      regex: /["']product_id["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    },
    {
      type: "product",
      source: "campo productId",
      regex: /["']productId["']\s*:\s*["'](MLB-?\d{6,})["']/gi
    }
  ];

  for (const { type, source, regex } of structuredPatterns) {
    for (const match of normalizedHtml.matchAll(regex)) {
      const start = Math.max(0, match.index - 80);
      const end = Math.min(normalizedHtml.length, match.index + match[0].length + 120);
      const context = normalizedHtml.slice(start, end).replace(/\s+/g, " ");

      addCandidate(candidates, match[1], type, source, context);

      if (candidates.size >= 40) break;
    }
  }

  return {
    urls,
    candidates: [...candidates.values()]
  };
}

async function resolverAffiliateLink(link) {
  const response = await fetch(link, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml"
    }
  });

  const html = await response.text();

  if (!response.ok) {
    throw new Error(
      `Ao resolver o link, o Mercado Livre respondeu HTTP ${response.status}.`
    );
  }

  const finalUrl = response.url;
  const diagnostics = collectCandidates(html, finalUrl);

  return {
    originalUrl: link,
    finalUrl,
    htmlLength: html.length,
    ...diagnostics
  };
}

async function apiRequest(url, accessToken) {
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
    data = { raw: text.slice(0, 1000) };
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

function summarizeProduct(data) {
  if (!data || typeof data !== "object") return null;

  const image =
    data.pictures?.[0]?.secure_url ||
    data.pictures?.[0]?.url ||
    data.pictures?.[0]?.secure_url ||
    data.thumbnail ||
    data.secure_thumbnail ||
    data.pictures?.[0]?.id
      ? (
          data.pictures?.[0]?.secure_url ||
          data.pictures?.[0]?.url ||
          data.thumbnail ||
          data.secure_thumbnail ||
          ""
        )
      : "";

  return {
    id: data.id ?? "",
    title: data.title ?? data.name ?? data.short_description?.content ?? "",
    price: data.price ?? null,
    image
  };
}

async function testCandidate(candidate, accessToken) {
  const attempts = [];

  // Se a origem já indica catálogo, testamos products primeiro.
  const order =
    candidate.type === "product"
      ? ["product", "item", "multiget"]
      : ["item", "multiget", "product"];

  for (const kind of order) {
    let url;

    if (kind === "item") {
      url = `https://api.mercadolibre.com/items/${candidate.id}`;
    } else if (kind === "product") {
      url = `https://api.mercadolibre.com/products/${candidate.id}`;
    } else {
      url = `https://api.mercadolibre.com/items?ids=${candidate.id}`;
    }

    const result = await apiRequest(url, accessToken);

    let usableData = result.data;

    // /items?ids retorna array com code/body.
    if (
      kind === "multiget" &&
      Array.isArray(result.data) &&
      result.data.length > 0
    ) {
      const first = result.data[0];
      if (first?.code >= 200 && first?.code < 300 && first?.body) {
        return {
          success: true,
          kind,
          url,
          status: first.code,
          data: first.body,
          attempts: [
            ...attempts,
            { kind, status: first.code, ok: true }
          ]
        };
      }

      attempts.push({
        kind,
        status: first?.code ?? result.status,
        ok: false,
        error: first?.body?.message || first?.body?.error || "sem resultado"
      });
      continue;
    }

    attempts.push({
      kind,
      status: result.status,
      ok: result.ok,
      error:
        result.ok
          ? ""
          : result.data?.message ||
            result.data?.error ||
            JSON.stringify(result.data).slice(0, 200)
    });

    if (result.ok) {
      return {
        success: true,
        kind,
        url,
        status: result.status,
        data: usableData,
        attempts
      };
    }
  }

  return {
    success: false,
    attempts
  };
}

async function findWorkingCandidate(candidates, accessToken) {
  const results = [];

  // Evita dezenas de chamadas se a página tiver muito conteúdo relacionado.
  for (const candidate of candidates.slice(0, 15)) {
    const tested = await testCandidate(candidate, accessToken);
    results.push({ candidate, ...tested });

    if (tested.success) {
      return {
        winner: { candidate, ...tested },
        results
      };
    }
  }

  return { winner: null, results };
}

function formatPrice(value) {
  if (typeof value !== "number") return String(value ?? "Não informado");

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function renderAttemptResults(results) {
  if (!results.length) {
    return "<p>Nenhum candidato MLB foi encontrado para testar.</p>";
  }

  return results
    .map(({ candidate, success, kind, attempts }) => {
      const lines = attempts
        .map(
          (attempt) =>
            `${attempt.kind}: HTTP ${attempt.status} ${
              attempt.ok ? "✅" : `❌ ${attempt.error || ""}`
            }`
        )
        .join("\n");

      return `
        <div class="candidate">
          <strong>${escapeHtml(candidate.id)}</strong>
          <span class="tag">${escapeHtml(candidate.type)}</span>
          ${success ? '<span class="success">ENCONTRADO ✅</span>' : ""}
          <div class="muted">${escapeHtml(candidate.sources.join(", "))}</div>
          <pre>${escapeHtml(lines)}</pre>
        </div>
      `;
    })
    .join("");
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
      <p>Teste um link por <code>/api/login?link=https://meli.la/...</code>.</p>
    `);
  }

  const cookies = getCookies(req);
  const expectedState = cookies.ml_oauth_state;
  const codeVerifier = cookies.ml_pkce_verifier;
  const testItem = cookies.ml_test_item;
  const testLink = cookies.ml_test_link;

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

    const usuarioResult = await apiRequest(
      "https://api.mercadolibre.com/users/me",
      tokenData.access_token
    );

    if (!usuarioResult.ok) {
      throw new Error(
        `/users/me retornou HTTP ${usuarioResult.status}: ` +
        JSON.stringify(usuarioResult.data)
      );
    }

    const usuario = usuarioResult.data;
    let diagnosticHtml = "";

    if (testLink) {
      try {
        const resolved = await resolverAffiliateLink(testLink);
        const tested = await findWorkingCandidate(
          resolved.candidates,
          tokenData.access_token
        );

        let winnerHtml = "";

        if (tested.winner) {
          const info = summarizeProduct(tested.winner.data) || {};
          const image = info.image;

          winnerHtml = `
            <div class="winner">
              <h2>Produto encontrado ✅</h2>
              ${image ? `<img src="${escapeHtml(image)}" alt="Produto">` : ""}
              <p><strong>Tipo:</strong> ${escapeHtml(tested.winner.kind)}</p>
              <p><strong>ID correto:</strong> ${escapeHtml(tested.winner.candidate.id)}</p>
              <p><strong>Produto:</strong> ${escapeHtml(info.title || "Título não retornado")}</p>
              <p><strong>Preço:</strong> ${escapeHtml(formatPrice(info.price))}</p>
              <p><strong>Link afiliado preservado:</strong><br>
                <code>${escapeHtml(testLink)}</code>
              </p>
            </div>
          `;
        } else {
          winnerHtml = `
            <div class="warning">
              <h2>Ainda não encontramos um ID consultável</h2>
              <p>O link foi resolvido e os candidatos abaixo foram testados.
              Essa saída agora nos mostra exatamente onde o Mercado Livre está
              escondendo/representando o produto.</p>
            </div>
          `;
        }

        diagnosticHtml = `
          <hr>
          <h2>Diagnóstico do link de afiliado</h2>
          <p><strong>Link original:</strong><br><code>${escapeHtml(testLink)}</code></p>
          <p><strong>URL final:</strong><br><code>${escapeHtml(resolved.finalUrl)}</code></p>
          <p><strong>Tamanho do HTML:</strong> ${escapeHtml(resolved.htmlLength)} bytes</p>
          <p><strong>URLs relevantes encontradas:</strong> ${escapeHtml(resolved.urls.length)}</p>
          <p><strong>Candidatos MLB encontrados:</strong> ${escapeHtml(resolved.candidates.length)}</p>
          ${winnerHtml}
          <h3>Testes realizados</h3>
          ${renderAttemptResults(tested.results)}
        `;
      } catch (linkError) {
        diagnosticHtml = `
          <hr>
          <h2>Erro ao analisar o link</h2>
          <pre>${escapeHtml(linkError.message)}</pre>
        `;
      }
    } else if (testItem && /^MLB\d+$/.test(testItem)) {
      const candidate = {
        id: testItem,
        type: "item",
        sources: ["teste manual"]
      };

      const tested = await testCandidate(candidate, tokenData.access_token);

      diagnosticHtml = `
        <hr>
        <h2>Teste manual do ID ${escapeHtml(testItem)}</h2>
        ${renderAttemptResults([{ candidate, ...tested }])}
      `;
    }

    clearTemporaryCookies(res);

    return res.status(200).send(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>T&T Barateou - Mercado Livre</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              max-width: 900px;
              margin: 40px auto;
              padding: 20px;
              background: #111;
              color: #fff;
              line-height: 1.5;
            }
            .card {
              background: #1d1d1d;
              padding: 28px;
              border-radius: 18px;
            }
            .ok, .success { color: #36d676; }
            .muted { color: #aaa; font-size: 13px; margin-top: 6px; }
            .tag {
              display: inline-block;
              margin-left: 8px;
              padding: 2px 8px;
              border-radius: 999px;
              background: #333;
              font-size: 12px;
            }
            code, pre {
              background: #292929;
              padding: 8px;
              border-radius: 8px;
              white-space: pre-wrap;
              word-break: break-word;
            }
            code { display: inline-block; max-width: 100%; }
            .candidate {
              margin: 12px 0;
              padding: 14px;
              background: #171717;
              border: 1px solid #333;
              border-radius: 12px;
            }
            .candidate pre { margin-bottom: 0; }
            .winner {
              margin: 18px 0;
              padding: 20px;
              border: 1px solid #36d676;
              border-radius: 14px;
              background: #152019;
            }
            .winner img {
              display: block;
              max-width: 280px;
              max-height: 280px;
              object-fit: contain;
              background: white;
              border-radius: 12px;
              margin-bottom: 18px;
            }
            .warning {
              margin: 18px 0;
              padding: 18px;
              border: 1px solid #e6b84a;
              border-radius: 14px;
              background: #251f12;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>T&T Barateou</h1>
            <h2 class="ok">Mercado Livre conectado ✅</h2>
            <p><strong>User ID:</strong> ${escapeHtml(usuario.id)}</p>
            <p><strong>Nickname:</strong> ${escapeHtml(usuario.nickname || "")}</p>
            <p>O access token não é exibido nem salvo nesta etapa.</p>
            ${diagnosticHtml}
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
