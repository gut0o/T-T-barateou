import fs from "node:fs/promises";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

function extrairItemId(texto) {
  if (!texto) return null;

  // Exemplos aceitos:
  // MLB1234567890
  // MLB-1234567890
  // /MLB-1234567890-
  const match = texto.match(/MLB-?(\d{6,})/i);

  return match ? `MLB${match[1]}`.toUpperCase() : null;
}

function extrairItemIdDoHtml(html) {
  if (!html) return null;

  const padroes = [
    /["']item_id["']\s*:\s*["'](MLB\d+)["']/i,
    /["']itemId["']\s*:\s*["'](MLB\d+)["']/i,
    /["']itemId["']\s*:\s*["']MLB-?(\d+)["']/i,
    /["']id["']\s*:\s*["'](MLB\d{6,})["']/i,
    /\bMLB-?(\d{6,})\b/i
  ];

  for (const padrao of padroes) {
    const match = html.match(padrao);

    if (match) {
      const valor = match[1];
      if (/^MLB/i.test(valor)) {
        return valor.replace("-", "").toUpperCase();
      }
      return `MLB${valor}`.toUpperCase();
    }
  }

  return null;
}

async function resolverLink(url) {
  console.log("\n1) Resolvendo o link...");

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      "accept": "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(
      `O Mercado Livre respondeu HTTP ${response.status} ao abrir o link.`
    );
  }

  const urlFinal = response.url;
  console.log(`   URL final: ${urlFinal}`);

  // Primeiro tenta encontrar o ID diretamente na URL final.
  let itemId = extrairItemId(urlFinal);

  // Se não estiver na URL, lê o HTML e procura o ID do anúncio.
  if (!itemId) {
    console.log("   O ID não apareceu na URL. Procurando no HTML da página...");
    const html = await response.text();
    itemId = extrairItemIdDoHtml(html);
  }

  return { urlFinal, itemId };
}

async function buscarProduto(itemId) {
  console.log(`\n2) Consultando a API para ${itemId}...`);

  const headers = {
    "accept": "application/json"
  };

  // Opcional. Na próxima etapa podemos autenticar sua conta por OAuth.
  if (process.env.ML_ACCESS_TOKEN) {
    headers.authorization = `Bearer ${process.env.ML_ACCESS_TOKEN}`;
  }

  const response = await fetch(
    `https://api.mercadolibre.com/items/${itemId}`,
    { headers }
  );

  const body = await response.text();

  if (!response.ok) {
    let detalhe = body;
    try {
      detalhe = JSON.stringify(JSON.parse(body), null, 2);
    } catch {}

    throw new Error(
      `A API respondeu HTTP ${response.status}.\n${detalhe}\n\n` +
      "Se a API exigir autenticação para este item, configuraremos OAuth na próxima etapa."
    );
  }

  return JSON.parse(body);
}

function escolherImagem(produto) {
  if (Array.isArray(produto.pictures) && produto.pictures.length > 0) {
    return (
      produto.pictures[0].secure_url ||
      produto.pictures[0].url ||
      produto.thumbnail ||
      null
    );
  }

  return produto.secure_thumbnail || produto.thumbnail || null;
}

function formatarPreco(valor) {
  if (typeof valor !== "number") return String(valor ?? "Não informado");

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valor);
}

async function main() {
  console.log("====================================");
  console.log("       T&T OFERTAS - ETAPA 1");
  console.log("====================================");

  let link = process.argv[2];

  if (!link) {
    const rl = readline.createInterface({ input, output });
    link = await rl.question(
      "\nCole o link do produto/afiliado do Mercado Livre:\n> "
    );
    rl.close();
  }

  link = link.trim();

  if (!/^https?:\/\//i.test(link)) {
    throw new Error("O link precisa começar com http:// ou https://");
  }

  const { urlFinal, itemId } = await resolverLink(link);

  if (!itemId) {
    console.log("\n❌ Não consegui descobrir o ID MLB desse link.");
    console.log("URL resolvida:", urlFinal);
    console.log(
      "\nIsso não significa que o projeto acabou. Alguns links podem apontar " +
      "para páginas de catálogo cujo ID do anúncio não aparece diretamente. " +
      "Nesse caso vamos adaptar usando um link real seu."
    );
    process.exitCode = 2;
    return;
  }

  console.log(`   Item identificado: ${itemId}`);

  const produto = await buscarProduto(itemId);
  const imagem = escolherImagem(produto);

  const resultado = {
    linkAfiliado: link,
    urlFinal,
    itemId: produto.id,
    nome: produto.title,
    preco: produto.price,
    precoFormatado: formatarPreco(produto.price),
    precoOriginal: produto.original_price ?? null,
    moeda: produto.currency_id,
    imagem,
    permalink: produto.permalink ?? urlFinal
  };

  await fs.writeFile(
    "resultado.json",
    JSON.stringify(resultado, null, 2),
    "utf8"
  );

  console.log("\n====================================");
  console.log("             RESULTADO");
  console.log("====================================");
  console.log(`Produto : ${resultado.nome}`);
  console.log(`ID      : ${resultado.itemId}`);
  console.log(`Preço   : ${resultado.precoFormatado}`);
  console.log(`Imagem  : ${resultado.imagem ?? "não encontrada"}`);
  console.log(`Afiliado: ${resultado.linkAfiliado}`);
  console.log("\n✅ Também salvei tudo em resultado.json");
}

main().catch((erro) => {
  console.error("\n❌ ERRO");
  console.error(erro.message);
  process.exitCode = 1;
});
