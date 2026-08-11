import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { stdin as input, stdout as output } from "node:process";

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
  "https://t-t-barateou.vercel.app/api/offer";

const logger = P({ level: "silent" });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function money(value, currency = "BRL") {
  if (typeof value !== "number") {
    return "não informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency
  }).format(value);
}

function validateLink(rawLink) {
  const value = String(rawLink || "").trim();

  if (!value) {
    throw new Error("Nenhum link informado.");
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("O link informado não é uma URL válida.");
  }

  const host = url.hostname.toLowerCase();

  const allowed =
    host === "meli.la" ||
    host === "www.meli.la" ||
    host === "mercadolivre.com.br" ||
    host.endsWith(".mercadolivre.com.br") ||
    host === "mercadolibre.com" ||
    host.endsWith(".mercadolibre.com");

  if (!allowed) {
    throw new Error(
      "Use um link do Mercado Livre ou meli.la."
    );
  }

  return url.toString();
}

async function askLink() {
  const rl = readline.createInterface({
    input,
    output
  });

  console.log("\n======================================");
  console.log("       T&T BARATEOU - ETAPA 6.6A");
  console.log("======================================");
  console.log("\nCole um link afiliado do Mercado Livre.");

  const answer = await rl.question("\nLink: ");

  rl.close();

  return validateLink(answer);
}

async function askConfirmation() {
  const rl = readline.createInterface({
    input,
    output
  });

  const answer = await rl.question(
    "\nEnviar esta oferta para o grupo Aggin? (S/N): "
  );

  rl.close();

  return (
    String(answer || "")
      .trim()
      .toLowerCase() === "s"
  );
}

async function getOffer(link) {
  console.log("\n🛒 Consultando o backend T&T...");

  const url =
    `${OFFER_API}?link=${encodeURIComponent(link)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `O backend respondeu HTTP ${response.status}, mas não retornou JSON válido.`
    );
  }

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.error ||
      `Backend respondeu HTTP ${response.status}.`
    );
  }

  if (!data.title) {
    throw new Error(
      "O backend não retornou o título do produto."
    );
  }

  if (!data.image) {
    throw new Error(
      "O backend não retornou a imagem do produto."
    );
  }

  if (!data.affiliateLink) {
    throw new Error(
      "O backend não retornou o link afiliado."
    );
  }

  return data;
}

function buildCaption(offer) {
  const currency =
    offer.currency || "BRL";

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
    lines.push(
      `De: ~${money(
        offer.originalPrice,
        currency
      )}~`
    );

    lines.push(
      `💰 *Por: ${money(
        offer.price,
        currency
      )}*`
    );

    if (
      typeof offer.discount === "number"
    ) {
      lines.push(
        `🔥 *${offer.discount}% OFF*`
      );
    }
  } else if (
    typeof offer.price === "number"
  ) {
    lines.push(
      `💰 *Por: ${money(
        offer.price,
        currency
      )}*`
    );
  }

  lines.push("");
  lines.push(
    "👇 Comprar no Mercado Livre:"
  );
  lines.push(
    offer.affiliateLink
  );

  return lines.join("\n");
}

function showPreview(offer, caption) {
  console.log("\n======================================");
  console.log("             PRÉVIA");
  console.log("======================================");

  console.log(
    `Produto: ${offer.title}`
  );

  console.log(
    `Preço: ${money(
      offer.price,
      offer.currency || "BRL"
    )}`
  );

  if (
    typeof offer.originalPrice === "number"
  ) {
    console.log(
      `Preço anterior: ${money(
        offer.originalPrice,
        offer.currency || "BRL"
      )}`
    );
  }

  if (
    typeof offer.discount === "number"
  ) {
    console.log(
      `Desconto: ${offer.discount}%`
    );
  }

  console.log(
    `Imagem: ${offer.image}`
  );

  console.log(
    `Link: ${offer.affiliateLink}`
  );

  console.log(
    `Resolução: ${
      offer.resolutionType || "não informado"
    }`
  );

  console.log("\nMensagem que será enviada:\n");
  console.log(caption);

  console.log("\n======================================");
}

async function downloadImage(imageUrl) {
  console.log("\n🖼️ Baixando imagem...");

  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept:
        "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Não consegui baixar a imagem. HTTP ${response.status}.`
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error(
      "A imagem baixada está vazia."
    );
  }

  console.log(
    `✅ Imagem pronta (${Math.round(
      buffer.length / 1024
    )} KB).`
  );

  return buffer;
}

async function connectAndSend(
  offer,
  caption
) {
  const { state, saveCreds } =
    await useMultiFileAuthState(
      AUTH_DIR
    );

  const { version } =
    await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser:
      Browsers.windows(
        "T&T Barateou"
      ),
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on(
    "creds.update",
    saveCreds
  );

  return new Promise(
    (resolve, reject) => {
      let processed = false;

      sock.ev.on(
        "connection.update",
        async ({ connection }) => {
          if (
            connection !== "open" ||
            processed
          ) {
            return;
          }

          processed = true;

          try {
            console.log(
              "\n✅ WhatsApp conectado."
            );

            console.log(
              "🔎 Conferindo grupo..."
            );

            await wait(800);

            const metadata =
              await sock.groupMetadata(
                TARGET_GROUP_JID
              );

            if (
              metadata.id !==
                TARGET_GROUP_JID ||
              metadata.subject !==
                EXPECTED_GROUP_NAME
            ) {
              throw new Error(
                `Grupo não confere. Esperado "${EXPECTED_GROUP_NAME}" (${TARGET_GROUP_JID}), ` +
                `encontrado "${metadata.subject}" (${metadata.id}). Nada foi enviado.`
              );
            }

            console.log(
              `✅ Destino confirmado: ${metadata.subject}`
            );

            const imageBuffer =
              await downloadImage(
                offer.image
              );

            console.log(
              "\n📤 Enviando oferta..."
            );

            const result =
              await sock.sendMessage(
                TARGET_GROUP_JID,
                {
                  image:
                    imageBuffer,
                  caption
                }
              );

            console.log(
              "\n======================================"
            );

            console.log(
              "✅ OFERTA ENVIADA"
            );

            console.log(
              `Grupo: ${metadata.subject}`
            );

            console.log(
              `Produto: ${offer.title}`
            );

            console.log(
              `ID WhatsApp: ${
                result?.key?.id ||
                "não informado"
              }`
            );

            console.log(
              "======================================\n"
            );

            await wait(1000);

            resolve();
          } catch (error) {
            reject(error);
          }
        }
      );
    }
  );
}

async function main() {
  try {
    const link =
      await askLink();

    const offer =
      await getOffer(link);

    const caption =
      buildCaption(offer);

    showPreview(
      offer,
      caption
    );

    const confirmed =
      await askConfirmation();

    if (!confirmed) {
      console.log(
        "\n🚫 Envio cancelado. Nenhuma mensagem foi enviada."
      );

      process.exit(0);
    }

    await connectAndSend(
      offer,
      caption
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "\n❌ ERRO"
    );

    console.error(
      error?.message ||
      "Erro desconhecido."
    );

    console.log(
      "\nNenhuma oferta foi enviada."
    );

    process.exit(1);
  }
}

main();
