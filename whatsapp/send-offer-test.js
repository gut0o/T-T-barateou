import path from "node:path";
import { fileURLToPath } from "node:url";

import P from "pino";
import makeWASocket, {
  Browsers,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_DIR = path.join(__dirname, "auth_info");

const TARGET_GROUP_JID = "120363412894604457@g.us";
const EXPECTED_GROUP_NAME = "Aggin";

const AFFILIATE_LINK = "https://meli.la/2EMjkct";

const PRODUCT_PAGE =
  "https://www.mercadolivre.com.br/" +
  "creatina-monohidratada-1kg-soldiers-nutrition-100-pura-importada-" +
  "alta-performance-musculo-treino/p/MLB18725310";

const PRODUCT_TITLE =
  "Creatina 1kg Suplemento Monohidratada em pó 100% Pura - Soldiers Nutrition";

const PRICE = 59.90;
const ORIGINAL_PRICE = 239.90;

const logger = P({ level: "silent" });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function discountPercent(price, originalPrice) {
  return Math.round(
    ((originalPrice - price) / originalPrice) * 100
  );
}

function decodeHtml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x2F;", "/");
}

async function getProductImage() {
  console.log("🖼️ Buscando a imagem do produto no Mercado Livre...");

  const response = await fetch(PRODUCT_PAGE, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 Chrome/151 Safari/537.36",
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Mercado Livre respondeu HTTP ${response.status} ao buscar a imagem.`
    );
  }

  const html = await response.text();

  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /"secure_url"\s*:\s*"([^"]+)"/i,
    /"picture_url"\s*:\s*"([^"]+)"/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const imageUrl = decodeHtml(match[1]).replaceAll("\\/", "/");

      if (/^https?:\/\//i.test(imageUrl)) {
        console.log("✅ Imagem encontrada.");
        return imageUrl;
      }
    }
  }

  throw new Error(
    "Não consegui localizar a imagem na página do produto. Nada foi enviado."
  );
}

async function main() {
  const { state, saveCreds } =
    await useMultiFileAuthState(AUTH_DIR);

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.windows("T&T Barateou"),
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on("creds.update", saveCreds);

  let sent = false;

  sock.ev.on("connection.update", async ({ connection }) => {
    if (connection !== "open" || sent) return;
    sent = true;

    try {
      console.log("\n✅ WhatsApp conectado.");
      console.log("🔎 Conferindo grupo...");

      await wait(900);

      const metadata =
        await sock.groupMetadata(TARGET_GROUP_JID);

      if (
        metadata.id !== TARGET_GROUP_JID ||
        metadata.subject !== EXPECTED_GROUP_NAME
      ) {
        throw new Error(
          `Grupo não confere. Esperado "${EXPECTED_GROUP_NAME}" (${TARGET_GROUP_JID}); ` +
          `encontrado "${metadata.subject}" (${metadata.id}). Nada foi enviado.`
        );
      }

      console.log(`✅ Destino confirmado: ${metadata.subject}`);

      const imageUrl = await getProductImage();

      const discount =
        discountPercent(PRICE, ORIGINAL_PRICE);

      const caption =
`🔥 *T&T BARATEOU*

🛒 *${PRODUCT_TITLE}*

De: ~${money(ORIGINAL_PRICE)}~
💰 *Por: ${money(PRICE)}*
🔥 *${discount}% OFF*

👇 Comprar no Mercado Livre:
${AFFILIATE_LINK}`;

      console.log("\n📤 Enviando imagem + oferta...");

      const result = await sock.sendMessage(
        TARGET_GROUP_JID,
        {
          image: { url: imageUrl },
          caption
        }
      );

      console.log("\n======================================");
      console.log("      T&T BARATEOU - ETAPA 6.4");
      console.log("======================================");
      console.log(`Destino: ${metadata.subject}`);
      console.log(`Produto: ${PRODUCT_TITLE}`);
      console.log(`Preço: ${money(PRICE)}`);
      console.log(`Link: ${AFFILIATE_LINK}`);
      console.log(`ID: ${result?.key?.id ?? "não informado"}`);
      console.log("✅ Oferta com imagem enviada.");
      console.log("======================================\n");

      await wait(1500);
      process.exit(0);
    } catch (error) {
      console.error("\n❌ ENVIO CANCELADO / FALHOU");
      console.error(error.message);
      process.exit(1);
    }
  });
}

main().catch((error) => {
  console.error("\n❌ ERRO");
  console.error(error.message);
  process.exitCode = 1;
});
