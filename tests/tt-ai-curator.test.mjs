import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOffer, analyzeOfferWithAI } from "../lib/tt-ai-curator.js";

test("rejeita oferta sem preço válido", () => {
  assert.throws(() => normalizeOffer({ title: "Teste", price: 0 }), /price/);
});

test("não considera preço original menor como desconto", () => {
  const offer = normalizeOffer({ title: "Teste", price: 100, originalPrice: 90 });
  assert.equal(offer.originalPrice, null);
});

test("IA devolve JSON estruturado e não publica nada", async () => {
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    calls++;
    assert.equal(options.method, "POST");
    assert.equal(_url, "https://api.openai.com/v1/chat/completions");
    assert.ok(options.headers.authorization.startsWith("Bearer "));
    assert.ok(options.body.includes("Mouse sem fio"));
    assert.equal(JSON.parse(options.body).response_format.type, "json_schema");
    return {
      ok: true,
      json: async () => ({
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
          potencial: "medio",
          publicoAlvo: "Quem trabalha no computador",
          justificativa: "Pode interessar a quem busca mouse sem fio.",
          chamada: "Conheça este mouse sem fio",
          cuidados: "Sem histórico de preços, não é possível avaliar se a promoção é realmente vantajosa."
        }) } }],
        usage: { prompt_tokens: 100, completion_tokens: 90, total_tokens: 190 }
      })
    };
  };
  const result = await analyzeOfferWithAI({ title: "Mouse sem fio", price: 80 }, {
    apiKey: "CHAVE_FICTICIA_TESTE", fetchImpl
  });
  assert.equal(calls, 1);
  assert.equal(result.ai.potencial, "medio");
  assert.match(result.preview, /RASCUNHO/);
  assert.match(result.preview, /R\$\s?80,00/);
  assert.equal(result.mode, "somente_analise_sem_publicacao");
});

test("descarta resposta da IA em formato inválido", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ finish_reason: "stop", message: { content: "Isso parece barato!" } }] })
  });
  await assert.rejects(
    analyzeOfferWithAI({ title: "Cabo", price: 15 }, { apiKey: "TESTE", fetchImpl }),
    /JSON válido/
  );
});


test("descarta resposta truncada da OpenAI", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ finish_reason: "length", message: { content: "{}" } }] })
  });
  await assert.rejects(
    analyzeOfferWithAI({ title: "Cabo", price: 15 }, { apiKey: "TESTE", fetchImpl }),
    /limite de saída/
  );
});
