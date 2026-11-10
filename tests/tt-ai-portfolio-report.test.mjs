import test from "node:test";
import assert from "node:assert/strict";
import { createPortfolioEvidence, renderPortfolioEvidenceMarkdown } from "../lib/tt-ai-portfolio-report.js";
const sample = {
  offer: {
    itemId: "MLB123456", title: "Mouse sem fio", price: 79.9,
    originalPrice: 99.9, sourceLink: "https://meli.la/SECRET_LINK",
    priceSource: "mercadolivre_public_page", observedAt: "2026-11-10T19:42:47.000Z",
    category: "Tecnologia"
  },
  result: {
    model: "gpt-4o-mini", usage: { total_tokens: 400, prompt_tokens: 300 },
    ai: { potencial: "alto", publicoAlvo: "Profissionais", justificativa: "Ergonomia", chamada: "Conforto", cuidados: "Não há histórico" },
    preview: "Mensagem de exemplo\nPreço R$ 79,90\nNão enviada",
    privateKey: "chave_ficticia_FAKE_SECRET_VALUE"
  }
};
test("relatorio tem resultados e tokens comprovados", () => {
  const report = createPortfolioEvidence({ results: [sample], generatedAt: "2026-11-10T19:44:00Z" });
  assert.equal(report.produtosAnalisados, 1);
  assert.equal(report.totalTokens, 400);
  assert.equal(report.evidencia[0].modelo, "gpt-4o-mini");
  assert.equal(report.evidencia[0].modo, "somente_analise_sem_publicacao");
});
test("relatorio nao inclui links de afiliado, segredos nem payloads brutos", () => {
  const report = createPortfolioEvidence({ results: [sample] });
  const raw = JSON.stringify(report);
  assert.doesNotMatch(raw, /SECRET_LINK|FAKE_SECRET_VALUE|sourceLink|privateKey|prompt_tokens/);
});
test("Markdown separa demonstracao de producao", () => {
  const report = createPortfolioEvidence({ results: [sample] });
  const md = renderPortfolioEvidenceMarkdown(report);
  assert.match(md, /protótipo — não implantado/);
  assert.match(md, /Não enviada/);
  assert.match(md, /Mensagem de exemplo\nPreço R\$ 79,90\nNão enviada/);
  assert.match(md, /não comprova que a oferta é o menor preço/);
});
test("nao aceita relatorio sem analises reais", () => {
  assert.throws(() => createPortfolioEvidence({ results: [] }), /pelo menos uma analise/);
});
