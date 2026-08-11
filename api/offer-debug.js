const USER_AGENTS = {
  desktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  mobile:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36"
};

const MAX_HTML = 4_000_000;

function allowedHost(hostname) {
  const host = String(hostname || "").toLowerCase();

  return (
    host === "meli.la" ||
    host.endsWith(".meli.la") ||
    host === "mercadolivre.com.br" ||
    host.endsWith(".mercadolivre.com.br") ||
    host === "mercadolibre.com" ||
    host.endsWith(".mercadolibre.com")
  );
}

function validateLink(raw) {
  if (!raw) {
    throw new Error("Informe ?link=https://meli.la/...");
  }

  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new Error("URL inválida.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Use apenas http/https.");
  }

  if (!allowedHost(url.hostname)) {
    throw new Error(
      "Este diagnóstico aceita apenas links do Mercado Livre/meli.la."
    );
  }

  return url.toString();
}

function decodeText(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("\\/", "/")
    .replaceAll("\\u002F", "/")
    .replaceAll("\\u003A", ":")
    .replaceAll("\\u0026", "&");
}

function oneMatch(html, regex) {
  const match = html.match(regex);
  return match?.[1] ? decodeText(match[1]).slice(0, 1000) : null;
}

function uniqueMlbIds(text) {
  const set = new Set();

  for (const match of decodeText(text).matchAll(/MLB-?(\d{6,})/gi)) {
    set.add(`MLB${match[1]}`);
    if (set.size >= 40) break;
  }

  return [...set];
}

function interestingUrls(html) {
  const decoded = decodeText(html);
  const urls = new Set();

  const regex =
    /https?:\/\/[^"'<>\\\s]+/gi;

  for (const match of decoded.matchAll(regex)) {
    const url = match[0]
      .replace(/[),.;]+$/g, "")
      .slice(0, 1800);

    if (
      /mercadolivre|mercadolibre|mlstatic|\/p\/|MLB-?\d/i.test(url)
    ) {
      urls.add(url);
    }

    if (urls.size >= 30) break;
  }

  return [...urls];
}

function keywordSnippets(html) {
  const decoded = decodeText(html);
  const needles = [
    "catalog_product_id",
    "catalogProductId",
    "product_id",
    "productId",
    "item_id",
    "itemId",
    "permalink",
    "target",
    "destination",
    "redirect",
    "deeplink",
    "deep_link",
    "ref"
  ];

  const snippets = [];

  for (const needle of needles) {
    const lower = decoded.toLowerCase();
    const index = lower.indexOf(needle.toLowerCase());

    if (index >= 0) {
      const start = Math.max(0, index - 140);
      const end = Math.min(decoded.length, index + needle.length + 240);

      snippets.push({
        keyword: needle,
        text: decoded
          .slice(start, end)
          .replace(/\s+/g, " ")
          .slice(0, 500)
      });
    }

    if (snippets.length >= 12) break;
  }

  return snippets;
}

function pageSummary(html, finalUrl, status) {
  return {
    status,
    finalUrl,
    htmlLength: html.length,
    title: oneMatch(
      html,
      /<title[^>]*>([\s\S]*?)<\/title>/i
    ),
    canonical: oneMatch(
      html,
      /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/i
    ),
    ogUrl:
      oneMatch(
        html,
        /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i
      ) ||
      oneMatch(
        html,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i
      ),
    ogTitle:
      oneMatch(
        html,
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      ) ||
      oneMatch(
        html,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
      ),
    ogImage:
      oneMatch(
        html,
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      ) ||
      oneMatch(
        html,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
      ),
    mlbIds: uniqueMlbIds(html),
    interestingUrls: interestingUrls(html),
    snippets: keywordSnippets(html)
  };
}

async function fetchPage(url, userAgent) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
    }
  });

  const finalUrl = response.url;

  let finalParsed;
  try {
    finalParsed = new URL(finalUrl);
  } catch {
    throw new Error("URL final inválida.");
  }

  if (!allowedHost(finalParsed.hostname)) {
    throw new Error(
      `Redirecionou para domínio não permitido: ${finalParsed.hostname}`
    );
  }

  const html = await response.text();

  if (html.length > MAX_HTML) {
    throw new Error("HTML grande demais para diagnóstico.");
  }

  return pageSummary(
    html,
    finalUrl,
    response.status
  );
}

function buildVariants(finalUrl) {
  const variants = [];

  const original = new URL(finalUrl);

  variants.push({
    name: "original",
    url: original.toString()
  });

  if (
    original.hostname.includes("mercadolivre") ||
    original.hostname.includes("mercadolibre")
  ) {
    const noForce = new URL(original.toString());
    noForce.searchParams.delete("forceInApp");
    noForce.searchParams.set("skipInApp", "true");

    variants.push({
      name: "skipInApp",
      url: noForce.toString()
    });

    const forceFalse = new URL(original.toString());
    forceFalse.searchParams.set("forceInApp", "false");
    forceFalse.searchParams.set("skipInApp", "true");

    variants.push({
      name: "forceFalse+skipInApp",
      url: forceFalse.toString()
    });
  }

  return variants;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      ok: false,
      error: "Use GET."
    });
  }

  try {
    const rawLink = Array.isArray(req.query?.link)
      ? req.query.link[0]
      : req.query?.link;

    const link = validateLink(rawLink);

    // Primeiro resolve o link curto normalmente.
    const first = await fetchPage(
      link,
      USER_AGENTS.desktop
    );

    const variants = buildVariants(first.finalUrl);
    const results = [];

    for (const variant of variants) {
      for (const [uaName, ua] of Object.entries(USER_AGENTS)) {
        try {
          const result = await fetchPage(
            variant.url,
            ua
          );

          results.push({
            variant: variant.name,
            userAgent: uaName,
            ...result
          });
        } catch (error) {
          results.push({
            variant: variant.name,
            userAgent: uaName,
            error: error?.message || "erro"
          });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      requestedLink: link,
      initialResolvedUrl: first.finalUrl,
      tests: results,
      note:
        "Este endpoint é apenas diagnóstico. Não envia WhatsApp e não expõe tokens."
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error?.message || "Erro desconhecido."
    });
  }
}
