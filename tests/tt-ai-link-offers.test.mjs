import test from "node:test";
import assert from "node:assert/strict";
import {
  validateMercadoLivreLink,
  buildPublicOfferEndpoint,
  resolveOfferFromPublicLink
} from "../lib/tt-ai-link-offers.js";

const link = "https://meli.la/Teste123";

// Os testes usam respostas simuladas: NENHUMA consulta real ao Mercado Livre ou OpenAI.
test("aceita apenas dominios do Mercado Livre/meli.la", () => {
  assert.match(validateMercadoLivreLink(link), /^https:\/\/meli\.la\//);
  assert.throws(() => validateMercadoLivreLink("https://example.com/produto"), /Somente links/);
  assert.throws(() => validateMercadoLivreLink("https://meli.la.evil.com/teste"), /Somente links/);
  assert.throws(() => validateMercadoLivreLink("http://meli.la/teste"), /Somente links/);
  assert.throws(() => validateMercadoLivreLink("https://user:pass@meli.la/teste"), /Somente links/);
});

test("consulta somente o endpoint publico /api/offer", () => {
  const endpoint = new URL(buildPublicOfferEndpoint(link));
  assert.equal(endpoint.origin, "https://t-t-barateou.vercel.app");
  assert.equal(endpoint.pathname, "/api/offer");
  assert.equal(endpoint.searchParams.get("link"), link);
  assert.equal(endpoint.searchParams.has("action"), false);
});

test("converte resposta publica do T&T em entrada para a IA", async () => {
  let requestedUrl, method, headers;
  const result = await resolveOfferFromPublicLink(link, {
    fetchImpl: async (url, opts) => {
      requestedUrl = url;
      method = opts.method;
      headers = opts.headers;
      return { ok: true, status: 200, json: async () => ({
        ok: true, itemId: "MLB123456789", title: "Mouse sem fio", price: 79.90,
        originalPrice: 99.90, currency: "BRL", ttCategoryName: "Tecnologia & Games",
        resolvedUrl: "https://www.mercadolivre.com.br/MLB-123456789",
        priceSource: "item"
      }) };
    }
  });
  assert.equal(new URL(requestedUrl).pathname, "/api/offer");
  assert.equal(method, "GET");
  assert.deepEqual(headers, { Accept: "application/json" });
  assert.equal(result.price, 79.90);
  assert.equal(result.category, "Tecnologia & Games");
  assert.equal(result.freeShipping, false);
  assert.equal(result.sourceLink, link);
});

test("rejeita erro do endpoint e nao envia oferta sem preco", async () => {
  await assert.rejects(
    resolveOfferFromPublicLink(link, { fetchImpl: async () => ({
      ok: false, status: 400, json: async () => ({ ok: false, error: "Produto indisponivel" })
    }) }),
    /Produto indisponivel/
  );
  await assert.rejects(
    resolveOfferFromPublicLink(link, { fetchImpl: async () => ({
      ok: true, status: 200, json: async () => ({ ok: true, title: "Produto", price: null })
    }) }),
    /preco validos/
  );
});

test("nao representa moedas estrangeiras como BRL", async () => {
  await assert.rejects(
    resolveOfferFromPublicLink(link, { fetchImpl: async () => ({
      ok: true, status: 200, json: async () => ({ ok: true, title: "Produto", price: 4, currency: "USD" })
    }) }),
    /moeda diferente/
  );
});

test("rejeita endereco HTTP para servidor de destino", () => {
  assert.throws(() => buildPublicOfferEndpoint(link, "http://example.test"), /HTTPS/);
});
