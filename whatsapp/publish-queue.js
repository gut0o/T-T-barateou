import fs from "node:fs/promises";
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

const __filename =
  fileURLToPath(
    import.meta.url
  );

const __dirname =
  path.dirname(
    __filename
  );

const AUTH_DIR =
  path.join(
    __dirname,
    "auth_info"
  );

const ROUTING_FILE =
  path.join(
    __dirname,
    "group-routing.json"
  );

const API_BASE =
  (
    process.env
      .TT_QUEUE_API_BASE ||
    "https://t-t-barateou.vercel.app/api/discover-bestsellers"
  )
    .trim();

const ADMIN_KEY =
  (
    process.env
      .TT_QUEUE_ADMIN_KEY ||
    ""
  )
    .trim();

const POLL_INTERVAL_MS =
  Math.max(
    Number(
      process.env
        .TT_QUEUE_POLL_MS ||
      15000
    ) || 15000,
    5000
  );


const AUTO_DISCOVERY_ENABLED =
  String(
    process.env
      .TT_AUTO_DISCOVERY ||
    "true"
  )
    .trim()
    .toLowerCase() !==
  "false";

const AUTO_DISCOVERY_INTERVAL_MS =
  Math.max(
    Number(
      process.env
        .TT_AUTO_DISCOVERY_INTERVAL_MS ||
      900000
    ) || 900000,
    60000
  );

let discoveryCursor =
  0;

const logger =
  P({
    level:
      "silent"
  });

let routing =
  null;

let pending =
  null;

let polling =
  false;

// Impede que o polling abra uma segunda prévia enquanto uma
// confirmação está mudando o status no backend ou enviando mídia.
let actionInProgress =
  false;

const processedMessageIds =
  new Set();

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function normalizeAnswer(text) {
  return String(text || "")
    .trim()
    .toLocaleLowerCase(
      "pt-BR"
    )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function isYes(text) {
  const value =
    normalizeAnswer(
      text
    );

  return (
    value === "sim" ||
    value === "s"
  );
}

function isNo(text) {
  const value =
    normalizeAnswer(
      text
    );

  return (
    value === "nao" ||
    value === "n" ||
    value === "cancelar" ||
    value === "cancela"
  );
}

function isRetry(text) {
  const value =
    normalizeAnswer(
      text
    );

  return (
    value === "retry" ||
    value === "tentar novamente" ||
    value === "tenta novamente"
  );
}


function isStatusCommand(text) {
  const value =
    normalizeAnswer(
      text
    );

  return (
    value === "status" ||
    value === "fila"
  );
}

function isDiscoverCommand(text) {
  const value =
    normalizeAnswer(
      text
    );

  return (
    value === "descobrir" ||
    value === "buscar ofertas" ||
    value === "procurar ofertas"
  );
}

function extractAffiliateLinks(text) {
  const matches =
    String(text || "")
      .match(
        /https?:\/\/(?:meli\.la|(?:www\.)?mercadolivre\.com\.br)\/[^\s<>"']+/gi
      ) ||
    [];

  return Array.from(
    new Set(
      matches.map(
        (link) =>
          link
            .replace(
              /[),.;!?]+$/,
              ""
            )
      )
    )
  ).slice(
    0,
    10
  );
}

function formatMoney(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL"
    }
  ).format(
    value
  );
}

function unwrapMessage(message) {
  if (!message) {
    return null;
  }

  if (
    message.ephemeralMessage
      ?.message
  ) {
    return unwrapMessage(
      message
        .ephemeralMessage
        .message
    );
  }

  if (
    message.viewOnceMessage
      ?.message
  ) {
    return unwrapMessage(
      message
        .viewOnceMessage
        .message
    );
  }

  if (
    message.viewOnceMessageV2
      ?.message
  ) {
    return unwrapMessage(
      message
        .viewOnceMessageV2
        .message
    );
  }

  return message;
}

function extractText(message) {
  const msg =
    unwrapMessage(
      message
    );

  if (!msg) {
    return "";
  }

  const type =
    getContentType(
      msg
    );

  switch (type) {
    case "conversation":
      return (
        msg.conversation ||
        ""
      );

    case "extendedTextMessage":
      return (
        msg.extendedTextMessage
          ?.text ||
        ""
      );

    case "imageMessage":
      return (
        msg.imageMessage
          ?.caption ||
        ""
      );

    default:
      return "";
  }
}

function isBotText(text) {
  const value =
    String(text || "")
      .trim();

  return (
    value.startsWith(
      "🧪 *FILA T&T - PRÉVIA*"
    ) ||
    value.startsWith(
      "✅ Oferta enviada e marcada como sent."
    ) ||
    value.startsWith(
      "🚫 Oferta rejeitada."
    ) ||
    value.startsWith(
      "❌ Erro no envio da oferta."
    ) ||
    value.startsWith(
      "🔄 Oferta recolocada para tentativa."
    )
  );
}

async function loadRouting() {
  const raw =
    await fs.readFile(
      ROUTING_FILE,
      "utf8"
    );

  const parsed =
    JSON.parse(raw);

  if (
    !parsed
      ?.controlGroup
      ?.jid
  ) {
    throw new Error(
      "group-routing.json não possui controlGroup.jid."
    );
  }

  return parsed;
}

function adminHeaders() {
  if (!ADMIN_KEY) {
    throw new Error(
      "TT_QUEUE_ADMIN_KEY não está definida no PowerShell."
    );
  }

  return {
    Accept:
      "application/json",

    "Content-Type":
      "application/json",

    "x-tt-admin-key":
      ADMIN_KEY
  };
}

async function apiGet(params) {
  const url =
    new URL(
      API_BASE
    );

  Object.entries(
    params
  ).forEach(
    ([key, value]) => {
      if (
        value !== null &&
        value !== undefined
      ) {
        url.searchParams.set(
          key,
          String(value)
        );
      }
    }
  );

  const response =
    await fetch(
      url,
      {
        headers:
          adminHeaders()
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    data?.ok === false
  ) {
    throw new Error(
      data?.error ||
      `Backend respondeu HTTP ${response.status}.`
    );
  }

  return data;
}

async function apiPost(
  action,
  body
) {
  const url =
    new URL(
      API_BASE
    );

  url.searchParams.set(
    "action",
    action
  );

  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        headers:
          adminHeaders(),

        body:
          JSON.stringify(
            {
              action,
              ...body
            }
          )
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    data?.ok === false
  ) {
    throw new Error(
      data?.error ||
      `Backend respondeu HTTP ${response.status}.`
    );
  }

  return data;
}

async function setStatus(
  itemId,
  status,
  extra = {}
) {
  return apiPost(
    "publication-status",
    {
      itemId,
      status,
      ...extra
    }
  );
}


async function ingestAffiliateLinks(
  links
) {
  return apiPost(
    "ingest-affiliate-links",
    {
      affiliateLinks:
        links
    }
  );
}

async function getQueueSummary() {
  return apiGet({
    action:
      "queue-summary"
  });
}

async function runAutoDiscovery() {
  const result =
    await apiPost(
      "auto-discover",
      {
        cursor:
          discoveryCursor,

        limit:
          2
      }
    );

  if (
    typeof result
      ?.nextCursor ===
      "number"
  ) {
    discoveryCursor =
      result.nextCursor;
  }

  return result;
}

async function getReadyItem() {
  const response =
    await apiGet({
      action:
        "queue-list",

      status:
        "ready_to_publish",

      limit:
        1
    });

  return (
    response
      ?.queue
      ?.entries?.[0] ||
    null
  );
}

function resolveDestination(
  entry
) {
  if (
    routing.testMode ===
    true
  ) {
    return {
      jid:
        routing
          .controlGroup
          .jid,

      name:
        `${routing.controlGroup.name} (TESTE)`,

      testMode:
        true
    };
  }

  const category =
    routing
      ?.categories
      ?.[
        entry.ttCategoryId
      ];

  if (
    category?.jid
  ) {
    return {
      jid:
        category.jid,

      name:
        category.name ||
        entry.ttCategoryName ||
        entry.ttCategoryId,

      testMode:
        false
    };
  }

  return null;
}

async function downloadImage(
  imageUrl
) {
  const response =
    await fetch(
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

  const buffer =
    Buffer.from(
      await response.arrayBuffer()
    );

  if (!buffer.length) {
    throw new Error(
      "A imagem baixada está vazia."
    );
  }

  return buffer;
}

function previewCaption(
  entry,
  destination
) {
  const lines = [
    "🧪 *FILA T&T - PRÉVIA*",
    "",
    `Categoria: *${entry.ttCategoryName || entry.ttCategoryId || "não informada"}*`,
    `Destino: *${destination.name}*`,
    "",
    entry.messageDraft || "(sem mensagem)",
    "",
    "Responder *SIM* para enviar.",
    "Responder *NÃO* para rejeitar."
  ];

  if (
    destination.testMode
  ) {
    lines.push(
      "",
      "⚠️ *MODO DE TESTE:* a oferta final também será enviada no Aggin."
    );
  }

  return lines.join(
    "\n"
  );
}

async function sendQueueSummary(
  sock
) {
  try {
    const summary =
      await getQueueSummary();

    const counts =
      summary.counts ||
      {};

    const lines = [
      "📊 *T&T - STATUS DA FILA*",
      "",
      `⏳ Aguardando link: ${counts.awaiting_affiliate_link || 0}`,
      `✅ Prontas: ${counts.ready_to_publish || 0}`,
      `📤 Enviando: ${counts.sending || 0}`,
      `🟢 Enviadas: ${counts.sent || 0}`,
      `❌ Erro: ${counts.send_error || 0}`,
      `🚫 Rejeitadas: ${counts.rejected || 0}`
    ];

    if (
      Array.isArray(
        summary.awaitingAffiliateLinks
      ) &&
      summary.awaitingAffiliateLinks.length
    ) {
      lines.push(
        "",
        "🔗 *Precisam de link afiliado:*"
      );

      summary.awaitingAffiliateLinks
        .slice(
          0,
          5
        )
        .forEach(
          (offer, index) => {
            lines.push(
              "",
              `${index + 1}. ${offer.title}`,
              offer.price !== null
                ? `💰 ${formatMoney(offer.price)}`
                : "",
              offer.catalogPageUrl
                ? `🔎 ${offer.catalogPageUrl}`
                : ""
            );
          }
        );
    }

    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          lines
            .filter(
              (line) =>
                line !== ""
                ||
                true
            )
            .join("\n")
      }
    );
  } catch (error) {
    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          "❌ Não consegui consultar o status da fila.\n" +
          (
            error?.message ||
            "Erro desconhecido."
          )
      }
    );
  }
}

async function notifyAutoDiscovery(
  sock,
  result
) {
  const newOffers =
    Array.isArray(
      result?.newOffers
    )
      ? result.newOffers
      : [];

  if (!newOffers.length) {
    console.log(
      `🔎 Descoberta automática: nenhuma oferta nova. Próximo cursor: ${discoveryCursor}`
    );

    return;
  }

  const lines = [
    `🔎 *T&T encontrou ${newOffers.length} oferta(s) nova(s)*`,
    "",
    "Elas passaram pela regra high/medium e estão aguardando link afiliado."
  ];

  newOffers
    .slice(
      0,
      5
    )
    .forEach(
      (offer, index) => {
        lines.push(
          "",
          `${index + 1}. *${offer.title}*`,
          offer.price !== null
            ? `💰 ${formatMoney(offer.price)}`
            : "",
          offer.discount !== null
            ? `🔥 ${offer.discount}% OFF`
            : "",
          offer.ttCategoryName
            ? `📂 ${offer.ttCategoryName}`
            : "",
          offer.catalogPageUrl
            ? `🔎 Abrir produto: ${offer.catalogPageUrl}`
            : "",
          "Depois gere o link de afiliado e cole o meli.la aqui no Aggin."
        );
      }
    );

  await sock.sendMessage(
    routing
      .controlGroup
      .jid,
    {
      text:
        lines
          .filter(
            (line) =>
              line !== null
          )
          .join("\n")
    }
  );
}

async function triggerAutoDiscovery(
  sock
) {
  if (
    actionInProgress
  ) {
    return;
  }

  try {
    console.log(
      `🔎 Descoberta automática iniciada. Cursor: ${discoveryCursor}`
    );

    const result =
      await runAutoDiscovery();

    await notifyAutoDiscovery(
      sock,
      result
    );
  } catch (error) {
    console.error(
      "Erro na descoberta automática:",
      error?.message ||
      error
    );
  }
}

async function handleAffiliateLinksFromControl(
  sock,
  links
) {
  if (!links.length) {
    return;
  }

  try {
    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          `🔗 Processando ${links.length} link(s) afiliado(s)...`
      }
    );

    const result =
      await ingestAffiliateLinks(
        links
      );

    const lines = [
      "🔗 *RESULTADO DOS LINKS*",
      "",
      `✅ Prontas: ${result.readyCount || 0}`,
      `⏸️ Seguradas: ${result.heldCount || 0}`,
      `❌ Falhas: ${result.failedCount || 0}`
    ];

    for (
      const item of
      result.results ||
      []
    ) {
      lines.push(
        "",
        `• ${item.title || item.affiliateLink}`
      );

      if (
        item.status ===
        "ready_to_publish"
      ) {
        lines.push(
          `✅ ${item.priority || ""} → pronta para publicação`
        );
      } else if (
        item.status ===
        "held"
      ) {
        lines.push(
          `⏸️ ${item.priority || ""} → ${item.heldReason || "segurada"}`
        );
      } else {
        lines.push(
          `❌ ${item.error || item.reason || item.status || "falha"}`
        );
      }
    }

    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          lines.join(
            "\n"
          )
      }
    );

    // Se alguma ficou pronta, não esperamos o próximo poll.
    if (
      Number(
        result.readyCount ||
        0
      ) > 0
    ) {
      await showNextPreview(
        sock
      );
    }
  } catch (error) {
    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          "❌ Erro ao processar link afiliado.\n" +
          (
            error?.message ||
            "Erro desconhecido."
          )
      }
    );
  }
}

async function showNextPreview(
  sock
) {
  if (
    pending ||
    polling ||
    actionInProgress
  ) {
    return;
  }

  polling =
    true;

  try {
    const entry =
      await getReadyItem();

    if (!entry) {
      return;
    }

    const destination =
      resolveDestination(
        entry
      );

    if (!destination) {
      console.log(
        `⚠️ Sem grupo configurado para ${entry.ttCategoryId}.`
      );

      return;
    }

    pending = {
      entry,
      destination
    };

    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          previewCaption(
            entry,
            destination
          )
      }
    );

    console.log(
      `🧪 Prévia enviada: ${entry.title}`
    );
  } catch (error) {
    console.error(
      "Erro ao buscar fila:",
      error?.message ||
      error
    );
  } finally {
    polling =
      false;
  }
}

async function rejectPending(
  sock,
  quotedMessage
) {
  const current =
    pending;

  if (!current) {
    return;
  }

  actionInProgress =
    true;

  try {
    await setStatus(
      current.entry.itemId,
      "rejected",
      {
        groupJid:
          current.destination.jid,

        groupName:
          current.destination.name
      }
    );

    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          `🚫 Oferta rejeitada.\n\n${current.entry.title}`
      },
      quotedMessage
        ? {
            quoted:
              quotedMessage
          }
        : undefined
    );
  } catch (error) {
    console.error(
      "Erro ao rejeitar:",
      error?.message ||
      error
    );
  } finally {
    pending =
      null;

    actionInProgress =
      false;
  }
}

async function sendPending(
  sock,
  quotedMessage
) {
  const current =
    pending;

  if (!current) {
    return;
  }

  actionInProgress =
    true;

  try {
    // Primeiro travamos no backend. Só depois liberamos `pending`.
    // Assim o poll de 15s não consegue enxergar a mesma oferta
    // ainda como ready_to_publish e criar outra prévia.
    await setStatus(
      current.entry.itemId,
      "sending",
      {
        groupJid:
          current.destination.jid,

        groupName:
          current.destination.name
      }
    );

    pending =
      null;

    const imageBuffer =
      await downloadImage(
        current.entry
          .whatsappPayload
          ?.image
      );

    const sent =
      await sock.sendMessage(
        current
          .destination
          .jid,
        {
          image:
            imageBuffer,

          caption:
            current.entry
              .whatsappPayload
              ?.caption ||
            current.entry
              .messageDraft ||
            ""
        }
      );

    await setStatus(
      current.entry.itemId,
      "sent",
      {
        groupJid:
          current.destination.jid,

        groupName:
          current.destination.name,

        whatsappMessageId:
          sent?.key?.id ||
          null
      }
    );

    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          "✅ Oferta enviada e marcada como sent.\n\n" +
          `${current.entry.title}\n` +
          `Destino: ${current.destination.name}`
      },
      quotedMessage
        ? {
            quoted:
              quotedMessage
          }
        : undefined
    );

    console.log(
      `✅ Sent: ${current.entry.title}`
    );
  } catch (error) {
    try {
      await setStatus(
        current.entry.itemId,
        "send_error",
        {
          groupJid:
            current.destination.jid,

          groupName:
            current.destination.name,

          errorMessage:
            error?.message ||
            "Erro desconhecido."
        }
      );
    } catch (
      statusError
    ) {
      console.error(
        "Falha ao gravar send_error:",
        statusError?.message ||
        statusError
      );
    }

    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          "❌ Erro no envio da oferta.\n\n" +
          `${current.entry.title}\n\n` +
          `${error?.message || "Erro desconhecido."}\n\n` +
          "Envie *RETRY* para recolocar esta oferta na fila."
      },
      quotedMessage
        ? {
            quoted:
              quotedMessage
          }
        : undefined
    );

    pending = {
      ...current,
      failed:
        true
    };

    console.error(
      "Erro no envio:",
      error?.message ||
      error
    );
  } finally {
    actionInProgress =
      false;
  }
}

async function retryPending(
  sock,
  quotedMessage
) {
  const current =
    pending;

  if (
    !current ||
    current.failed !==
      true
  ) {
    return false;
  }

  try {
    await setStatus(
      current.entry.itemId,
      "retry",
      {
        groupJid:
          current.destination.jid,

        groupName:
          current.destination.name
      }
    );

    const title =
      current.entry.title;

    pending =
      null;

    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          "🔄 Oferta recolocada para tentativa.\n\n" +
          title
      },
      quotedMessage
        ? {
            quoted:
              quotedMessage
          }
        : undefined
    );

    return true;
  } catch (error) {
    console.error(
      "Erro no retry:",
      error?.message ||
      error
    );

    return true;
  }
}

async function validateControlGroup(
  sock
) {
  const expected =
    routing
      .controlGroup;

  const metadata =
    await sock.groupMetadata(
      expected.jid
    );

  if (
    metadata.id !==
      expected.jid
  ) {
    throw new Error(
      "JID do grupo de controle não confere."
    );
  }

  return metadata;
}

async function start() {
  routing =
    await loadRouting();

  if (!ADMIN_KEY) {
    throw new Error(
      "Defina TT_QUEUE_ADMIN_KEY no PowerShell antes de iniciar."
    );
  }

  const {
    state,
    saveCreds
  } =
    await useMultiFileAuthState(
      AUTH_DIR
    );

  const {
    version
  } =
    await fetchLatestBaileysVersion();

  const sock =
    makeWASocket({
      version,
      auth:
        state,
      logger,
      browser:
        Browsers.windows(
          "T&T Queue Publisher"
        ),
      markOnlineOnConnect:
        false,
      syncFullHistory:
        false
    });

  sock.ev.on(
    "creds.update",
    saveCreds
  );

  sock.ev.on(
    "connection.update",
    async (
      update
    ) => {
      const {
        connection,
        lastDisconnect
      } =
        update;

      if (
        connection ===
        "open"
      ) {
        try {
          const control =
            await validateControlGroup(
              sock
            );

          console.log(
            "\n======================================"
          );
          console.log(
            "      T&T BARATEOU - QUEUE PUBLISHER"
          );
          console.log(
            "======================================"
          );
          console.log(
            "✅ WhatsApp conectado."
          );
          console.log(
            `✅ Controle: ${control.subject}`
          );
          console.log(
            `🧪 Test mode: ${routing.testMode === true ? "SIM" : "NÃO"}`
          );
          console.log(
            `⏱️ Poll: ${POLL_INTERVAL_MS} ms`
          );
          console.log(
            `🔎 Auto discovery: ${AUTO_DISCOVERY_ENABLED ? "SIM" : "NÃO"}`
          );
          console.log(
            AUTO_DISCOVERY_ENABLED
              ? `🔎 Discovery interval: ${AUTO_DISCOVERY_INTERVAL_MS} ms`
              : "🔎 Discovery interval: desligado"
          );
          console.log(
            "💬 Comandos no Aggin: STATUS | DESCOBRIR | cole um meli.la"
          );
          console.log(
            "🛑 Ctrl + C para parar.\n"
          );

          await showNextPreview(
            sock
          );

          if (
            AUTO_DISCOVERY_ENABLED
          ) {
            triggerAutoDiscovery(
              sock
            ).catch(
              console.error
            );
          }
        } catch (error) {
          console.error(
            "❌",
            error?.message ||
            error
          );
        }
      }

      if (
        connection ===
        "close"
      ) {
        const statusCode =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;

        const loggedOut =
          statusCode ===
          DisconnectReason.loggedOut;

        if (
          loggedOut
        ) {
          console.error(
            "❌ Sessão desconectada. Vincule o WhatsApp novamente."
          );

          return;
        }

        console.log(
          "🔄 Reconectando..."
        );

        await sleep(
          1500
        );

        start()
          .catch(
            console.error
          );
      }
    }
  );

  sock.ev.on(
    "messages.upsert",
    async ({
      messages,
      type
    }) => {
      if (
        type !==
        "notify"
      ) {
        return;
      }

      for (
        const message of
        messages
      ) {
        try {
          if (
            !message
              ?.message
          ) {
            continue;
          }

          if (
            message.key
              .remoteJid !==
            routing
              .controlGroup
              .jid
          ) {
            continue;
          }

          const messageId =
            message
              .key
              .id;

          if (
            messageId &&
            processedMessageIds
              .has(
                messageId
              )
          ) {
            continue;
          }

          if (
            messageId
          ) {
            processedMessageIds
              .add(
                messageId
              );

            if (
              processedMessageIds
                .size >
              500
            ) {
              const first =
                processedMessageIds
                  .values()
                  .next()
                  .value;

              processedMessageIds
                .delete(
                  first
                );
            }
          }

          const text =
            extractText(
              message.message
            )
              .trim();

          if (!text) {
            continue;
          }

          if (
            message.key
              .fromMe &&
            isBotText(
              text
            )
          ) {
            continue;
          }

          const affiliateLinks =
            extractAffiliateLinks(
              text
            );

          if (
            affiliateLinks.length
          ) {
            await handleAffiliateLinksFromControl(
              sock,
              affiliateLinks
            );

            continue;
          }

          if (
            isStatusCommand(
              text
            )
          ) {
            await sendQueueSummary(
              sock
            );

            continue;
          }

          if (
            isDiscoverCommand(
              text
            )
          ) {
            await triggerAutoDiscovery(
              sock
            );

            continue;
          }

          if (
            pending
              ?.failed ===
              true
          ) {
            if (
              isRetry(
                text
              )
            ) {
              await retryPending(
                sock,
                message
              );
            }

            continue;
          }

          if (
            !pending
          ) {
            continue;
          }

          if (
            isNo(
              text
            )
          ) {
            await rejectPending(
              sock,
              message
            );

            continue;
          }

          if (
            isYes(
              text
            )
          ) {
            await sendPending(
              sock,
              message
            );
          }
        } catch (error) {
          console.error(
            "Erro ao processar mensagem:",
            error?.message ||
            error
          );
        }
      }
    }
  );

  setInterval(
    () => {
      showNextPreview(
        sock
      ).catch(
        console.error
      );
    },
    POLL_INTERVAL_MS
  );

  if (
    AUTO_DISCOVERY_ENABLED
  ) {
    setInterval(
      () => {
        triggerAutoDiscovery(
          sock
        ).catch(
          console.error
        );
      },
      AUTO_DISCOVERY_INTERVAL_MS
    );
  }

  return sock;
}

start()
  .catch(
    (error) => {
      console.error(
        "\n❌ Falha ao iniciar Queue Publisher:"
      );

      console.error(
        error?.message ||
        error
      );

      process.exit(
        1
      );
    }
  );
