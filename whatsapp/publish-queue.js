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

async function showNextPreview(
  sock
) {
  if (
    pending ||
    polling
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

  pending =
    null;

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

  pending =
    null;

  try {
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
            "🛑 Ctrl + C para parar.\n"
          );

          await showNextPreview(
            sock
          );
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
