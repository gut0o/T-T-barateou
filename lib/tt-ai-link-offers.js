// Busca um produto real do Mercado Livre pela API publica existente no T&T.
// SOMENTE LEITURA: nao acessa Supabase, fila ou WhatsApp.

const DEFAULT_TT_BASE = "https://t-t-barateou.vercel.app";
const ALLOWED_HOSTS = new Set([
  "meli.la",
  "www.meli.la",
  "mercadolivre.com.br",
  "www.mercadolivre.com.br",
  "mercadolibre.com",
  "www.mercadolibre.com"
]);

export function validateMercadoLivreLink(rawLink) {
  if (typeof rawLink !== "string" || !rawLink.trim() || rawLink.length > 2048) {
    throw new Error("Informe uma URL do Mercado Livre ou meli.la com ate 2048 caracteres.");
  }
  let url;
  try {
    url = new URL(rawLink.trim());
  } catch {
    throw new Error("Link invalido. Copie a URL completa do produto com https://.");
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) {
    throw new Error("Somente links https:// do Mercado Livre ou meli.la sao permitidos.");
  }
  return url.toString();
}

export function buildPublicOfferEndpoint(link, base = DEFAULT_TT_BASE) {
  const validated = validateMercadoLivreLink(link);
  let server;
  try {
    server = new URL(base);
  } catch {
    throw new Error("Endereco TT_PUBLIC_BASE_URL invalido.");
  }
  if (server.protocol !== "https:" || server.username || server.password) {
    throw new Error("TT_PUBLIC_BASE_URL precisa ser HTTPS.");
  }
  // O caminho e fixo, sem action de fila e sem chave administrativa.
  const endpoint = new URL("/api/offer", server);
  endpoint.searchParams.set("link", validated);
  return endpoint.toString();
}

export async function resolveOfferFromPublicLink(link, options = {}) {
  const sourceLink = validateMercadoLivreLink(link);
  const url = buildPublicOfferEndpoint(sourceLink, options.baseUrl ?? process.env.TT_PUBLIC_BASE_URL ?? DEFAULT_TT_BASE);
  const fetchImpl = options.fetchImpl ?? fetch;
  let response;
  try {
    response = await fetchImpl(url, { method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
  } catch (error) {
    throw new Error(`Nao foi possivel conectar ao endpoint publico do T&T (${error.name === "TimeoutError" ? "tempo limite" : "erro de rede"}).`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`T&T retornou uma resposta que nao e JSON (HTTP ${response.status}). Confira TT_PUBLIC_BASE_URL.`);
  }

  if (!response.ok || data?.ok !== true) {
    const reason = typeof data?.error === "string" ? data.error.slice(0, 200) : "Nao foi possivel resolver o produto.";
    throw new Error(`Falha ao consultar produto no T&T (HTTP ${response.status}): ${reason}`);
  }

  // O preview do T&T assume BRL; nunca exibir moedas diferentes como reais.
  if (data.currency && data.currency !== "BRL") {
    throw new Error("A oferta foi retornada em moeda diferente de BRL; analise cancelada.");
  }

  const price = Number(data.price);
  if (!data.title || !Number.isFinite(price) || price <= 0) {
    throw new Error("O T&T encontrou o produto, mas nao retornou titulo e preco validos. Tente outro link.");
  }

  return {
    itemId: data.itemId ?? "",
    title: data.title,
    price,
    originalPrice: data.originalPrice,
    category: data.ttCategoryName || data.rootCategory || data.categoryName || "Nao informada",
    // /api/offer nao informa frete gratis; nao inventar esse beneficio.
    freeShipping: false,
    sourceLink,
    resolvedUrl: data.resolvedUrl ?? null,
    priceSource: data.priceSource ?? null,
    observedAt: new Date().toISOString()
  };
}
