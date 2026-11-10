// Exemplo:
// node scripts/ai-curator-links.mjs "https://meli.la/SEU_LINK"
// Aceita 1 a 3 links reais; usa /api/offer (GET) e OpenAI. Nao publica.
import { analyzeOfferWithAI } from "../lib/tt-ai-curator.js";
import { resolveOfferFromPublicLink } from "../lib/tt-ai-link-offers.js";

const links = process.argv.slice(2).filter(Boolean);
if (!links.length || links.length > 3) {
  console.error('Uso: node scripts/ai-curator-links.mjs "https://meli.la/SEU_LINK" ["https://..." ate 3 links]');
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error('Falta OPENAI_API_KEY. Exemplo (PowerShell): $env:OPENAI_API_KEY="SUA_CHAVE"');
  process.exit(1);
}

console.log(`\nT&T AI | ${links.length} link(s) reais | Somente consulta e analise. SEM WhatsApp, fila ou admin key.\n`);

let totalTokens = 0;
for (const [i, link] of links.entries()) {
  try {
    console.log(`Consultando produto ${i + 1}/${links.length} no T&T...`);
    const offer = await resolveOfferFromPublicLink(link);
    console.log(`Produto encontrado: ${offer.title} | R$ ${offer.price.toFixed(2)}`);
    const result = await analyzeOfferWithAI(offer);
    totalTokens += result.usage?.total_tokens ?? 0;
    console.log(JSON.stringify({
      produto: offer.title,
      itemId: offer.itemId,
      categoria: offer.category,
      precoConsultado: offer.price,
      precoOriginalInformado: offer.originalPrice,
      origemPreco: offer.priceSource,
      consultadoEm: offer.observedAt,
      analiseIA: result.ai,
      rascunhoWhatsApp: result.preview,
      modelo: result.model,
      tokens: result.usage?.total_tokens ?? null,
      modo: "DEMONSTRACAO — nao publica"
    }, null, 2));
    console.log("\n------------------------------------\n");
  } catch (error) {
    console.error(`Falha no produto ${i + 1}: ${error.message}`);
    process.exitCode = 1;
  }
}
console.log(`Tokens totais utilizados nesta execucao: ${totalTokens}`);
console.log("Os dados sao consultados no momento do teste; conferir preco/link antes de divulgar.");
