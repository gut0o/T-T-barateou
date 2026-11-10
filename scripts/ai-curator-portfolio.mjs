// Execute de 1 a 3 links e produza evidências Markdown e JSON sem informações secretas.
// Uso: node scripts/ai-curator-portfolio.mjs "https://meli.la/..." [mais links]
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeOfferWithAI } from "../lib/tt-ai-curator.js";
import { resolveOfferFromPublicLink, validateMercadoLivreLink } from "../lib/tt-ai-link-offers.js";
import { createPortfolioEvidence, renderPortfolioEvidenceMarkdown } from "../lib/tt-ai-portfolio-report.js";

const urls = process.argv.slice(2);
if (urls.length < 1 || urls.length > 3) {
  console.error('Uso: node scripts/ai-curator-portfolio.mjs "https://meli.la/LINK1" ["https://meli.la/LINK2"] ["https://meli.la/LINK3"]');
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error('Falta OPENAI_API_KEY nesta sessao do PowerShell. Nao insira a chave em arquivo do projeto.');
  process.exit(1);
}
try {
  urls.forEach(validateMercadoLivreLink);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const results = [];
console.log(`\nT&T AI — Portfolio Softplan | ${urls.length} produto(s) | SOMENTE LEITURA / SEM PUBLICACAO\n`);
for (const [index, url] of urls.entries()) {
  try {
    console.log(`Analisando link ${index + 1}/${urls.length}...`);
    const offer = await resolveOfferFromPublicLink(url);
    const result = await analyzeOfferWithAI(offer);
    results.push({ offer, result });
    console.log(`OK: ${offer.title} | ${result.ai.potencial} | ${result.usage?.total_tokens ?? "?"} tokens`);
  } catch (error) {
    // Nao imprimir URLs, tokens ou payloads brutos.
    console.error(`Falha no link ${index + 1}: ${error.message}`);
  }
}
if (!results.length) {
  console.error("Nenhuma analise concluida. Nenhum relatorio gerado.");
  process.exit(1);
}
const now = new Date().toISOString();
const report = createPortfolioEvidence({ results, generatedAt: now });
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(scriptDir, "../docs/softplan/evidencias");
await mkdir(outputDir, { recursive: true });
const stamp = now.replace(/[:.]/g, "-");
const basename = `execucao-${stamp}`;
const jsonPath = path.join(outputDir, `${basename}.json`);
const mdPath = path.join(outputDir, `${basename}.md`);
await writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
await writeFile(mdPath, renderPortfolioEvidenceMarkdown(report), { encoding: "utf8", flag: "wx" });
console.log(`\nConcluido: ${results.length}/${urls.length} produto(s) analisado(s).`);
console.log(`Tokens totais: ${report.totalTokens}`);
console.log(`Relatorio Markdown: ${path.relative(process.cwd(), mdPath)}`);
console.log(`Relatorio JSON: ${path.relative(process.cwd(), jsonPath)}`);
console.log("ATENCAO: Nenhuma publicacao ocorreu; dados e precos ainda exigem revisao humana.");
if (results.length < urls.length) process.exitCode = 1;
