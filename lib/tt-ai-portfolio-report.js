// Evidencia reproduzivel da curadoria IA para portfolio.
// Somente dados explicitamente permitidos entram no relatorio.
// Nao inclui chaves, headers, URL de afiliado, payloads brutos da API nem segredos.

function safeText(value, maxLength = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}
function safePreview(value, maxLength = 900) {
  return String(value ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}
function markdown(value) {
  return safeText(value, 500).replace(/[\\`*_{}\[\]()#+.!|<>~-]/g, "\\$&");
}
function money(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
export function createPortfolioEvidence({ results, generatedAt = new Date().toISOString() }) {
  if (!Array.isArray(results) || !results.length) throw new Error("Informe pelo menos uma analise concluida.");
  const items = results.map(({ offer, result }) => {
    if (!offer || !result?.ai) throw new Error("Resultado de analise incompleto.");
    return {
      itemId: safeText(offer.itemId, 80),
      produto: safeText(offer.title, 220),
      categoria: safeText(offer.category, 100),
      precoConsultadoBRL: Number.isFinite(offer.price) ? offer.price : null,
      precoOriginalInformadoBRL: Number.isFinite(offer.originalPrice) && offer.originalPrice > offer.price ? offer.originalPrice : null,
      origemPreco: safeText(offer.priceSource, 100),
      consultadoEm: safeText(offer.observedAt, 60),
      analiseIA: {
        potencial: safeText(result.ai.potencial, 10),
        publicoAlvo: safeText(result.ai.publicoAlvo, 200),
        justificativa: safeText(result.ai.justificativa, 450),
        chamada: safeText(result.ai.chamada, 160),
        cuidados: safeText(result.ai.cuidados, 250)
      },
      rascunhoWhatsApp: safePreview(result.preview, 900),
      modelo: safeText(result.model, 100),
      tokens: Number.isFinite(result.usage?.total_tokens) ? result.usage.total_tokens : null,
      modo: "somente_analise_sem_publicacao"
    };
  });
  return {
    projeto: "T&T Barateou — Curadoria de ofertas com IA",
    geradoEm: safeText(generatedAt, 60),
    metodo: "Leitura de /api/offer + OpenAI; sem atualizar fila e sem WhatsApp",
    status: "protótipo — não implantado na publicação automática",
    produtosAnalisados: items.length,
    totalTokens: items.reduce((total, item) => total + (item.tokens ?? 0), 0),
    evidencia: items,
    limites: [
      "O modelo avalia relevância provável, não comprova que a oferta é o menor preço.",
      "Preço e disponibilidade devem ser conferidos antes de qualquer publicação.",
      "Nenhum desempenho comercial ou conversão de vendas foi medido nesta execução."
    ]
  };
}
export function renderPortfolioEvidenceMarkdown(report) {
  const sections = [
    "# Evidências de execução — T&T AI",
    "",
    `**Executado em:** ${markdown(report.geradoEm)}`,
    `**Modo:** ${markdown(report.status)}`,
    `**Produtos analisados:** ${report.produtosAnalisados}`,
    `**Tokens totais registrados:** ${report.totalTokens}`,
    "",
    "A consulta usa o endpoint público existente do T&T e uma chamada real à API da OpenAI. Este relatório não contém chaves nem links de afiliados.",
    ""
  ];
  for (const [i, item] of report.evidencia.entries()) {
    sections.push(
      `## ${i + 1}. ${markdown(item.produto)}`,
      "",
      `- **ID do anúncio:** ${markdown(item.itemId)}`,
      `- **Categoria:** ${markdown(item.categoria)}`,
      `- **Preço na consulta:** ${money(item.precoConsultadoBRL)}`,
      `- **Preço anterior informado:** ${money(item.precoOriginalInformadoBRL)}`,
      `- **Origem do preço:** ${markdown(item.origemPreco)}`,
      `- **Potencial estimado:** ${markdown(item.analiseIA.potencial)}`,
      `- **Público-alvo:** ${markdown(item.analiseIA.publicoAlvo)}`,
      `- **Justificativa:** ${markdown(item.analiseIA.justificativa)}`,
      `- **Cuidados apontados:** ${markdown(item.analiseIA.cuidados)}`,
      `- **Modelo:** ${markdown(item.modelo)}`,
      `- **Tokens:** ${item.tokens ?? "não informado"}`,
      "",
      "**Rascunho gerado (não enviado):**",
      "",
      "```text",
      safePreview(item.rascunhoWhatsApp, 900).replace(/```/g, "'''"),
      "```",
      ""
    );
  }
  sections.push("## Limitações", "", ...report.limites.map(x => `- ${x}`), "");
  return sections.join("\n");
}
