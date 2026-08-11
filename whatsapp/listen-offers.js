import path from "node:path";
import { fileURLToPath } from "node:url";

import P from "pino";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  getContentType,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_DIR = path.join(__dirname, "auth_info");

const CONTROL_GROUP_JID = "120363412894604457@g.us";
const CONTROL_GROUP_NAME = "Aggin";

const OFFER_API =
  "https://t-t-barateou.vercel.app/api/offer";

const logger = P({ level: "silent" });

// Nesta etapa mantemos apenas UMA oferta pendente por vez.
// Isso deixa o teste previsível antes de evoluirmos para fila/múltiplos grupos.
let pendingOffer = null;

// Evita processar a mesma mensagem duas vezes.
const processedMessageIds = new Set();

function sleep(ms) {
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

function unwrapMessage(message) {
  if (!message) {
    return null;
  }

  if (message.ephemeralMessage?.message) {
    return unwrapMessage(
      message.ephemeralMessage.message
    );
  }

  if (
    message.viewOnceMessage?.message
  ) {
    return unwrapMessage(
      message.viewOnceMessage.message
    );
  }

  if (
    message.viewOnceMessageV2?.message
  ) {
    return unwrapMessage(
      message.viewOnceMessageV2.message
    );
  }

  if (
    message.documentWithCaptionMessage
      ?.message
  ) {
    return unwrapMessage(
      message.documentWithCaptionMessage
        .message
    );
  }

  return message;
}

function extractText(message) {
  const msg = unwrapMessage(message);

  if (!msg) {
    return "";
  }

  const type = getContentType(msg);

  switch (type) {
    case "conversation":
      return msg.conversation || "";

    case "extendedTextMessage":
      return (
        msg.extendedTextMessage?.text || ""
      );

    case "imageMessage":
      return (
        msg.imageMessage?.caption || ""
      );

    case "videoMessage":
      return (
        msg.videoMessage?.caption || ""
      );

    case "documentMessage":
      return (
        msg.documentMessage?.caption || ""
      );

    default:
      return "";
  }
}

function isBotGeneratedText(text) {
  const value = String(text || "").trim();

  if (!value) {
    return false;
  }

  return (
    value.startsWith("🔎 Recebi o link.") ||
    value.startsWith("🧪 *PRÉVIA T&T BARATEOU*") ||
    value.startsWith("⏳ Já existe uma oferta") ||
    value.startsWith("❌ Não consegui montar esta oferta.") ||
    value.startsWith("🚫 Oferta cancelada:") ||
    value.startsWith("⚠️ Nesta etapa somente") ||
    value.startsWith("❌ A confirmação foi recebida") ||
    value.startsWith("🔥 *T&T BARATEOU*")
  );
}

function findMercadoLivreLink(text) {
  if (!text) {
    return null;
  }

  const matches =
    String(text).match(
      /https?:\/\/[^\s<>()]+/gi
    ) || [];

  for (const raw of matches) {
    const cleaned = raw.replace(
      /[),.;!?]+$/g,
      ""
    );

    try {
      const url = new URL(cleaned);
      const host =
        url.hostname.toLowerCase();

      const allowed =
        host === "meli.la" ||
        host === "www.meli.la" ||
        host === "mercadolivre.com.br" ||
        host.endsWith(
          ".mercadolivre.com.br"
        ) ||
        host === "mercadolibre.com" ||
        host.endsWith(
          ".mercadolibre.com"
        );

      if (allowed) {
        return url.toString();
      }
    } catch {
      // ignora URL inválida
    }
  }

  return null;
}

async function getOffer(link) {
  const url =
    `${OFFER_API}?link=${encodeURIComponent(
      link
    )}`;

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
      `Backend respondeu HTTP ${response.status}, mas sem JSON válido.`
    );
  }

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.error ||
      `Backend respondeu HTTP ${response.status}.`
    );
  }

  if (
    !data.title ||
    !data.image ||
    !data.affiliateLink
  ) {
    throw new Error(
      "O backend não retornou todos os dados necessários da oferta."
    );
  }

  return data;
}

function buildFinalCaption(offer) {
  const currency =
    offer.currency || "BRL";

  const lines = [
    "🔥 *T&T BARATEOU*",
    "",
    `🛒 *${offer.title}*`,
    ""
  ];

  if (
    typeof offer.originalPrice ===
      "number" &&
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

function buildPreviewMessage(offer) {
  const currency =
    offer.currency || "BRL";

  const lines = [
    "🧪 *PRÉVIA T&T BARATEOU*",
    "",
    `🛒 *${offer.title}*`,
    `💰 Preço: *${money(
      offer.price,
      currency
    )}*`
  ];

  if (
    typeof offer.originalPrice ===
      "number" &&
    offer.originalPrice > offer.price
  ) {
    lines.push(
      `🏷️ Antes: ~${money(
        offer.originalPrice,
        currency
      )}~`
    );
  }

  if (
    typeof offer.discount === "number"
  ) {
    lines.push(
      `🔥 Desconto: *${offer.discount}%*`
    );
  }

  lines.push("");
  lines.push(
    `🔗 ${offer.affiliateLink}`
  );
  lines.push("");
  lines.push(
    "Responder *SIM* para enviar a oferta final."
  );
  lines.push(
    "Responder *NÃO* para cancelar."
  );
  lines.push("");
  lines.push(
    "⚠️ Nesta etapa o envio continua somente no grupo de teste Aggin."
  );

  return lines.join("\n");
}

async function downloadImage(imageUrl) {
  const response = await fetch(
    imageUrl,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Accept:
          "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
      }
    }
  );

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

  return buffer;
}

function normalizeAnswer(text) {
  return String(text || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function isYes(text) {
  const value =
    normalizeAnswer(text);

  return (
    value === "sim" ||
    value === "s"
  );
}

function isNo(text) {
  const value =
    normalizeAnswer(text);

  return (
    value === "nao" ||
    value === "n" ||
    value === "cancelar" ||
    value === "cancela"
  );
}

async function validateControlGroup(sock) {
  const metadata =
    await sock.groupMetadata(
      CONTROL_GROUP_JID
    );

  if (
    metadata.id !==
      CONTROL_GROUP_JID ||
    metadata.subject !==
      CONTROL_GROUP_NAME
  ) {
    throw new Error(
      `Grupo de controle não confere. Esperado "${CONTROL_GROUP_NAME}" (${CONTROL_GROUP_JID}), ` +
      `encontrado "${metadata.subject}" (${metadata.id}).`
    );
  }

  return metadata;
}

async function handleNewLink(
  sock,
  message,
  link
) {
  if (pendingOffer) {
    await sock.sendMessage(
      CONTROL_GROUP_JID,
      {
        text:
          "⏳ Já existe uma oferta aguardando confirmação.\n\n" +
          "Responda *SIM* para enviar ou *NÃO* para cancelar antes de mandar outro link."
      },
      {
        quoted: message
      }
    );

    return;
  }

  await sock.sendMessage(
    CONTROL_GROUP_JID,
    {
      text:
        "🔎 Recebi o link. Consultando o Mercado Livre..."
    },
    {
      quoted: message
    }
  );

  try {
    const offer =
      await getOffer(link);

    pendingOffer = {
      offer,
      requestedBy:
        message.key.participant ||
        message.key.remoteJid,
      sourceMessageId:
        message.key.id,
      createdAt:
        Date.now()
    };

    await sock.sendMessage(
      CONTROL_GROUP_JID,
      {
        text:
          buildPreviewMessage(
            offer
          )
      },
      {
        quoted: message
      }
    );

    console.log(
      `🧪 Oferta aguardando confirmação: ${offer.title}`
    );
  } catch (error) {
    pendingOffer = null;

    await sock.sendMessage(
      CONTROL_GROUP_JID,
      {
        text:
          "❌ Não consegui montar esta oferta.\n\n" +
          `${error?.message || "Erro desconhecido."}\n\n` +
          "Nada foi enviado."
      },
      {
        quoted: message
      }
    );

    console.error(
      "Erro ao processar link:",
      error?.message || error
    );
  }
}

async function handleConfirmation(
  sock,
  message,
  text
) {
  if (!pendingOffer) {
    return false;
  }

  if (isNo(text)) {
    const title =
      pendingOffer.offer.title;

    pendingOffer = null;

    await sock.sendMessage(
      CONTROL_GROUP_JID,
      {
        text:
          `🚫 Oferta cancelada:\n${title}\n\nNenhuma oferta final foi enviada.`
      },
      {
        quoted: message
      }
    );

    console.log(
      `🚫 Oferta cancelada: ${title}`
    );

    return true;
  }

  if (!isYes(text)) {
    return false;
  }

  const confirmationSender =
    message.key.participant ||
    message.key.remoteJid;

  // Só quem enviou o link pode confirmar nesta etapa.
  if (
    confirmationSender !==
      pendingOffer.requestedBy
  ) {
    await sock.sendMessage(
      CONTROL_GROUP_JID,
      {
        text:
          "⚠️ Nesta etapa somente a pessoa que enviou o link pode confirmar esta oferta."
      },
      {
        quoted: message
      }
    );

    return true;
  }

  const current =
    pendingOffer;

  // Limpa antes do envio para evitar confirmação dupla.
  pendingOffer = null;

  try {
    const imageBuffer =
      await downloadImage(
        current.offer.image
      );

    const caption =
      buildFinalCaption(
        current.offer
      );

    await sock.sendMessage(
      CONTROL_GROUP_JID,
      {
        image: imageBuffer,
        caption
      }
    );

    console.log(
      `✅ Oferta enviada: ${current.offer.title}`
    );
  } catch (error) {
    await sock.sendMessage(
      CONTROL_GROUP_JID,
      {
        text:
          "❌ A confirmação foi recebida, mas ocorreu um erro no envio final.\n\n" +
          `${error?.message || "Erro desconhecido."}`
      },
      {
        quoted: message
      }
    );

    console.error(
      "Erro no envio final:",
      error?.message || error
    );
  }

  return true;
}

async function start() {
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

  sock.ev.on(
    "connection.update",
    async (update) => {
      const {
        connection,
        lastDisconnect
      } = update;

      if (connection === "open") {
        try {
          const group =
            await validateControlGroup(
              sock
            );

          console.log(
            "\n======================================"
          );
          console.log(
            "      T&T BARATEOU - ETAPA 6.6B"
          );
          console.log(
            "======================================"
          );
          console.log(
            "✅ WhatsApp conectado."
          );
          console.log(
            `✅ Grupo de controle: ${group.subject}`
          );
          console.log(
            "👂 Aguardando um link do Mercado Livre..."
          );
          console.log(
            "🛑 Ctrl + C para parar.\n"
          );
        } catch (error) {
          console.error(
            "❌",
            error?.message || error
          );
        }
      }

      if (connection === "close") {
        const statusCode =
          lastDisconnect?.error
            ?.output?.statusCode;

        const loggedOut =
          statusCode ===
          DisconnectReason.loggedOut;

        if (loggedOut) {
          console.error(
            "❌ A sessão do WhatsApp foi desconectada. Será necessário vincular novamente."
          );
          return;
        }

        console.log(
          "🔄 Conexão caiu. Tentando reconectar..."
        );

        await sleep(1500);
        start().catch(
          console.error
        );
      }
    }
  );

  sock.ev.on(
    "messages.upsert",
    async ({ messages, type }) => {
      if (type !== "notify") {
        return;
      }

      for (const message of messages) {
        try {
          if (!message?.message) {
            continue;
          }

          if (
            message.key.remoteJid !==
              CONTROL_GROUP_JID
          ) {
            continue;
          }

          const messageId =
            message.key.id;

          if (
            messageId &&
            processedMessageIds.has(
              messageId
            )
          ) {
            continue;
          }

          if (messageId) {
            processedMessageIds.add(
              messageId
            );

            if (
              processedMessageIds.size >
              500
            ) {
              const first =
                processedMessageIds
                  .values()
                  .next()
                  .value;

              processedMessageIds.delete(
                first
              );
            }
          }

          const text =
            extractText(
              message.message
            ).trim();

          if (!text) {
            continue;
          }

          // IMPORTANTE:
          // Quando o usuário usa a mesma conta vinculada ao Baileys,
          // mensagens digitadas manualmente também chegam como fromMe=true.
          // Por isso não ignoramos mais todo fromMe.
          //
          // Em vez disso, ignoramos apenas textos reconhecidamente
          // gerados pelo próprio bot, evitando loops.
          if (
            message.key.fromMe &&
            isBotGeneratedText(text)
          ) {
            continue;
          }

          console.log(
            `📩 Mensagem recebida no Aggin: ${text.slice(0, 120)}`
          );

          const handledConfirmation =
            await handleConfirmation(
              sock,
              message,
              text
            );

          if (
            handledConfirmation
          ) {
            continue;
          }

          const link =
            findMercadoLivreLink(
              text
            );

          if (!link) {
            continue;
          }

          await handleNewLink(
            sock,
            message,
            link
          );
        } catch (error) {
          console.error(
            "Erro ao processar mensagem:",
            error?.message || error
          );
        }
      }
    }
  );

  return sock;
}

start().catch((error) => {
  console.error(
    "\n❌ Falha ao iniciar o bot:"
  );

  console.error(
    error?.message || error
  );

  process.exit(1);
});
