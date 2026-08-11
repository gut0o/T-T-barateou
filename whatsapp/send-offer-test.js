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

const OFFER_API =
  "https://t-t-barateou.vercel.app/api/offer-test";

const logger = P({ level: "silent" });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function money(value, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency
  }).format(value);
}

function buildCaption(offer) {
  const lines = [
    "🔥 *T&T BARATEOU*",
    "",
    `🛒 *${offer.title}*`,
    ""
  ];

  if (
    typeof offer.originalPrice === "number" &&
    typeof offer.price === "number" &&
    offer.originalPrice > offer.price
  ) {
    const discount = Math.round(
      ((offer.originalPrice - offer.price) /
        offer.originalPrice) *
        100
    );

    lines.push(
      `De: ~${money(offer.originalPrice, offer.currency)}~`
    );
    lines.push(
      `💰 *Por: ${money(offer.price, offer.currency)}*`
    );
    lines.push(`🔥 *${discount}% OFF*`);
  } else if (typeof offer.price === "number") {
    lines.push(
      `💰 *Por: ${money(offer.price, offer.currency)}*`
    );
  }

  lines.push("");
  lines.push("👇 Comprar no Mercado Livre:");
  lines.push(offer.affiliateLink);

  return lines.join("\n");
}

async function getOffer() {
  console.log("🛒 Buscando oferta no backend T&T...");

  const response = await fetch(OFFER_API, {
    headers: {
      Accept: "application/json"
    }
  });

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.error ||
      `Backend respondeu HTTP ${response.status}`
    );
  }

  if (!data.title) {
    throw new Error("Backend não retornou o título.");
  }

  if (!data.image) {
    throw new Error("Backend não retornou a imagem.");
  }

  if (!data.affiliateLink) {
    throw new Error("Backend não retornou o link afiliado.");
  }

  console.log("✅ Oferta recebida do backend.");
  console.log(`   Produto: ${data.title}`);
  console.log(
    `   Preço: ${
      typeof data.price === "number"
        ? money(data.price, data.currency || "BRL")
        : "não informado"
    }`
  );

  return data;
}

async function downloadImage(imageUrl) {
  console.log("🖼️ Baixando imagem do Mercado Livre...");

  const response = await fetch(imageUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao baixar imagem: HTTP ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error("A imagem baixada está vazia.");
  }

  console.log(
    `✅ Imagem baixada (${Math.round(buffer.length / 1024)} KB).`
  );

  return buffer;
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

  sock.ev.on(
    "connection.update",
    async ({ connection }) => {
      if (connection !== "open" || sent) return;
      sent = true;

      try {
        console.log("\n✅ WhatsApp conectado.");
        console.log("🔎 Conferindo grupo...");

        await wait(800);

        const metadata =
          await sock.groupMetadata(TARGET_GROUP_JID);

        if (
          metadata.id !== TARGET_GROUP_JID ||
          metadata.subject !== EXPECTED_GROUP_NAME
        ) {
          throw new Error(
            `Grupo não confere. Esperado "${EXPECTED_GROUP_NAME}" ` +
            `(${TARGET_GROUP_JID}), encontrado "${metadata.subject}" ` +
            `(${metadata.id}). Nada foi enviado.`
          );
        }

        console.log(
          `✅ Destino confirmado: ${metadata.subject}`
        );

        const offer = await getOffer();
        const imageBuffer =
          await downloadImage(offer.image);

        const caption = buildCaption(offer);

        console.log(
          "\n📤 Enviando imagem + oferta para o grupo..."
        );

        const result = await sock.sendMessage(
          TARGET_GROUP_JID,
          {
            image: imageBuffer,
            caption
          }
        );

        console.log("\n======================================");
        console.log("      T&T BARATEOU - ETAPA 6.4B");
        console.log("======================================");
        console.log(`Destino: ${metadata.subject}`);
        console.log(`Produto: ${offer.title}`);

        if (typeof offer.price === "number") {
          console.log(
            `Preço: ${money(
              offer.price,
              offer.currency || "BRL"
            )}`
          );
        }

        console.log(`Link: ${offer.affiliateLink}`);
        console.log(
          `ID WhatsApp: ${
            result?.key?.id || "não informado"
          }`
        );
        console.log("✅ Oferta enviada com imagem.");
        console.log("======================================\n");

        await wait(1500);
        process.exit(0);
      } catch (error) {
        console.error("\n❌ ENVIO CANCELADO / FALHOU");
        console.error(error.message);
        process.exit(1);
      }
    }
  );
}

main().catch((error) => {
  console.error("\n❌ ERRO");
  console.error(error.message);
  process.exitCode = 1;
});
