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


import {
  AffiliateSessionError,
  affiliateSessionConfigured,
  affiliateSessionStatus,
  createAffiliateLink
} from "./ml-affiliate-link.js";

import {
  classifyOfferDestination,
  filterEligibleOffers
} from "./group-filters.js";

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


const APP_STATE_API =
  (
    process.env
      .TT_APP_STATE_API ||
    new URL(
      "/api/app-state",
      API_BASE
    )
      .toString()
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

const AUTO_BATCH_ENABLED =
  String(
    process.env
      .TT_AUTO_BATCH ||
    "true"
  )
    .trim()
    .toLowerCase() !==
  "false";

const AUTO_BATCH_SIZE =
  Math.max(
    Math.min(
      Number(
        process.env
          .TT_AUTO_BATCH_SIZE ||
        3
      ) || 3,
      10
    ),
    1
  );

const AUTO_BATCH_PAUSE_MS =
  Math.max(
    Number(
      process.env
        .TT_AUTO_BATCH_PAUSE_MS ||
      900000
    ) || 900000,
    60000
  );

// Janela do ENVIO AUTOMÁTICO.
// O processo e o WhatsApp permanecem conectados 24h.
const AUTO_SEND_START_HOUR =
  Math.min(
    Math.max(
      Number.parseInt(
        process.env
          .TT_SEND_START_HOUR ||
        "9",
        10
      ) || 0,
      0
    ),
    23
  );

const AUTO_SEND_END_HOUR =
  Math.min(
    Math.max(
      Number.parseInt(
        process.env
          .TT_SEND_END_HOUR ||
        "22",
        10
      ) || 0,
      0
    ),
    24
  );

const AUTO_SEND_TIMEZONE =
  String(
    process.env
      .TT_SEND_TIMEZONE ||
    "America/Sao_Paulo"
  )
    .trim() ||
  "America/Sao_Paulo";

const AUTO_SEND_WINDOW_CHECK_MS =
  60000;

const AUTO_BATCH_DISCOVERY_ATTEMPTS =
  Math.max(
    Math.min(
      Number(
        process.env
          .TT_AUTO_BATCH_DISCOVERY_ATTEMPTS ||
        8
      ) || 8,
      12
    ),
    1
  );

// Meta mínima do lote automático.
// Continua tentando chegar a 3, mas se as 8 buscas normais não bastarem,
// percorre o restante do pool para tentar garantir pelo menos 2 ofertas.
const AUTO_BATCH_MIN_SEND =
  Math.max(
    Math.min(
      Number(
        process.env
          .TT_AUTO_BATCH_MIN_SEND ||
        2
      ) || 2,
      AUTO_BATCH_SIZE
    ),
    1
  );

// Quantidade atual de frentes configuradas em tt-discovery-seeds.js.
// Serve como limite de segurança para permitir uma volta completa no pool
// quando o mínimo ainda não foi atingido.
const AUTO_BATCH_GROUP_POOL_SIZES = {
  eletronicos: 24,
  fitness: 24,
  perfumes: 42
};

const AUTO_BATCH_GROUPS = [
  "eletronicos",
  "fitness",
  "perfumes"
];

const AUTO_BATCH_LABELS = {
  eletronicos: {
    emoji:
      "📱",

    label:
      "Eletrônicos"
  },

  fitness: {
    emoji:
      "💪",

    label:
      "Fitness"
  },

  perfumes: {
    emoji:
      "🌸",

    label:
      "Perfumes"
  }
};

let discoveryCursor =
  0;

let automaticBatchInProgress =
  false;

// Socket atualmente válido.
// Em uma reconexão, o ciclo antigo pode continuar vivo por alguns
// segundos. Essas referências impedem que ele tente publicar usando
// o socket já fechado.
let activeWhatsAppSocket =
  null;

let whatsappConnectionOpen =
  false;

function isSocketActive(
  sock
) {
  return Boolean(
    whatsappConnectionOpen &&
    activeWhatsAppSocket ===
      sock
  );
}

function isConnectionClosedError(
  error
) {
  const message =
    String(
      error?.message ||
      error ||
      ""
    );

  return (
    error?.code ===
      "WHATSAPP_CONNECTION_CLOSED" ||
    /connection closed|socket closed|connection lost|not connected|connection terminated/i
      .test(
        message
      )
  );
}

function connectionClosedError() {
  const error =
    new Error(
      "WhatsApp desconectado durante o ciclo."
    );

  error.code =
    "WHATSAPP_CONNECTION_CLOSED";

  return error;
}

// Modo manual:
// - pausa novos lotes automáticos
// - mantém o bot conectado
// - permite colar um link no grupo de controle
// - usa a prévia + SIM/NÃO já existente
let manualModeEnabled =
  false;

let automaticWindowPauseLogged =
  false;

function automaticClockParts(
  date = new Date()
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          AUTO_SEND_TIMEZONE,

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23"
      }
    );

  const values =
    Object.fromEntries(
      formatter
        .formatToParts(
          date
        )
        .filter(
          (part) =>
            part.type !==
            "literal"
        )
        .map(
          (part) => [
            part.type,
            part.value
          ]
        )
    );

  return {
    hour:
      Number(
        values.hour ||
        0
      ),

    minute:
      Number(
        values.minute ||
        0
      ),

    second:
      Number(
        values.second ||
        0
      )
  };
}

function isAutomaticSendWindowOpen(
  date = new Date()
) {
  const {
    hour
  } =
    automaticClockParts(
      date
    );

  // Mesma hora = janela 24h.
  if (
    AUTO_SEND_START_HOUR ===
    AUTO_SEND_END_HOUR
  ) {
    return true;
  }

  // Ex.: 09 -> 22.
  if (
    AUTO_SEND_START_HOUR <
    AUTO_SEND_END_HOUR
  ) {
    return (
      hour >=
        AUTO_SEND_START_HOUR &&
      hour <
        AUTO_SEND_END_HOUR
    );
  }

  // Também suporta uma janela atravessando meia-noite.
  return (
    hour >=
      AUTO_SEND_START_HOUR ||
    hour <
      AUTO_SEND_END_HOUR
  );
}

function automaticWindowLabel() {
  const hourLabel =
    (hour) =>
      String(
        hour
      )
        .padStart(
          2,
          "0"
        ) +
      ":00";

  return (
    `${hourLabel(AUTO_SEND_START_HOUR)}–` +
    `${hourLabel(AUTO_SEND_END_HOUR)} ` +
    `(${AUTO_SEND_TIMEZONE})`
  );
}

function automaticCurrentClockLabel() {
  const {
    hour,
    minute,
    second
  } =
    automaticClockParts();

  return [
    hour,
    minute,
    second
  ]
    .map(
      (value) =>
        String(
          value
        )
          .padStart(
            2,
            "0"
          )
    )
    .join(":");
}

function automaticWindowClosedError() {
  const error =
    new Error(
      `Fora da janela automática ${automaticWindowLabel()}.`
    );

  error.code =
    "AUTOMATIC_SEND_WINDOW_CLOSED";

  return error;
}

function isAutomaticWindowClosedError(
  error
) {
  return (
    error?.code ===
    "AUTOMATIC_SEND_WINDOW_CLOSED"
  );
}

function scheduleAutomaticWindowCheck(
  sock
) {
  if (
    !AUTO_BATCH_ENABLED ||
    manualModeEnabled ||
    !isSocketActive(
      sock
    )
  ) {
    return;
  }

  scheduleTimeout(
    () => {
      runAutomaticBatchCycle(
        sock
      ).catch(
        console.error
      );
    },
    AUTO_SEND_WINDOW_CHECK_MS
  );
}

const automaticGroupCursors = {
  eletronicos:
    0,

  fitness:
    0,

  perfumes:
    0
};

const AUTO_AFFILIATE_ENABLED =
  String(
    process.env
      .TT_AUTO_AFFILIATE ||
    "true"
  )
    .trim()
    .toLowerCase() !==
  "false";

const AUTO_AFFILIATE_INTERVAL_MS =
  Math.max(
    Number(
      process.env
        .TT_AUTO_AFFILIATE_INTERVAL_MS ||
      30000
    ) || 30000,
    10000
  );

let affiliateFillInProgress =
  false;

let affiliateSessionBlocked =
  false;

let affiliateSessionWarningSent =
  false;

let discoveryInProgress =
  false;

// Proteção local contra leituras repetidas da fila logo após uma
// mudança de estado no backend.
//
// Mesmo que o Blob/API ainda devolva por alguns segundos um estado
// anterior, o mesmo produto não volta a gerar link ou prévia.
const RECENT_OPERATION_TTL_MS =
  Math.max(
    Number(
      process.env
        .TT_RECENT_OPERATION_TTL_MS ||
      600000
    ) || 600000,
    60000
  );

const recentAffiliateProducts =
  new Map();

const recentPreviewProducts =
  new Map();

const recentSentProducts =
  new Map();

function operationKey(
  entry
) {
  return String(
    entry?.productId ||
    entry?.itemId ||
    ""
  )
    .trim()
    .toUpperCase();
}

function cleanupRecentMap(
  map
) {
  const now =
    Date.now();

  for (
    const [
      key,
      expiresAt
    ] of
    map.entries()
  ) {
    if (
      expiresAt <= now
    ) {
      map.delete(
        key
      );
    }
  }
}

function isRecentlyHandled(
  map,
  entry
) {
  cleanupRecentMap(
    map
  );

  const key =
    operationKey(
      entry
    );

  if (!key) {
    return false;
  }

  const expiresAt =
    map.get(
      key
    );

  return (
    typeof expiresAt === "number" &&
    expiresAt > Date.now()
  );
}

function rememberHandled(
  map,
  entry,
  ttlMs =
    RECENT_OPERATION_TTL_MS
) {
  const key =
    operationKey(
      entry
    );

  if (!key) {
    return;
  }

  map.set(
    key,
    Date.now() +
    ttlMs
  );
}

function forgetHandled(
  map,
  entry
) {
  const key =
    operationKey(
      entry
    );

  if (
    key
  ) {
    map.delete(
      key
    );
  }
}

const activeTimers =
  new Set();

function scheduleInterval(
  callback,
  intervalMs
) {
  const timer =
    setInterval(
      callback,
      intervalMs
    );

  activeTimers.add(
    timer
  );

  return timer;
}

function scheduleTimeout(
  callback,
  delayMs
) {
  const timer =
    setTimeout(
      () => {
        activeTimers.delete(
          timer
        );

        callback();
      },
      delayMs
    );

  activeTimers.add(
    timer
  );

  return timer;
}

function clearActiveTimers() {
  for (
    const timer of
    activeTimers
  ) {
    clearInterval(
      timer
    );

    clearTimeout(
      timer
    );
  }

  activeTimers.clear();
}

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

function manualModeCommand(
  text
) {
  const value =
    normalizeAnswer(
      text
    );

  if (
    value === "manual" ||
    value === "manual on" ||
    value === "modo manual" ||
    value === "modo manual on" ||
    value === "pausar auto" ||
    value === "pausa auto"
  ) {
    return "on";
  }

  if (
    value === "manual off" ||
    value === "modo manual off" ||
    value === "auto" ||
    value === "modo auto" ||
    value === "retomar auto" ||
    value === "continuar auto"
  ) {
    return "off";
  }

  if (
    value === "manual status" ||
    value === "modo" ||
    value === "modo status"
  ) {
    return "status";
  }

  return null;
}


function discoverGroupCommand(
  text
) {
  const value =
    normalizeAnswer(
      text
    );

  if (
    value ===
      "descobrir eletronicos" ||
    value ===
      "buscar eletronicos" ||
    value ===
      "procurar eletronicos"
  ) {
    return "eletronicos";
  }

  if (
    value ===
      "descobrir fitness" ||
    value ===
      "buscar fitness" ||
    value ===
      "procurar fitness"
  ) {
    return "fitness";
  }

  if (
    value ===
      "descobrir perfumes" ||
    value ===
      "descobrir perfume" ||
    value ===
      "buscar perfumes" ||
    value ===
      "buscar perfume" ||
    value ===
      "procurar perfumes" ||
    value ===
      "procurar perfume"
  ) {
    return "perfumes";
  }

  return null;
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
    const backendError =
      new Error(
        data?.error ||
        `Backend respondeu HTTP ${response.status}.`
      );

    // Preserva os detalhes estruturados devolvidos pelo backend.
    // Isso é importante para diferenciar:
    // - erro temporário;
    // - link afiliado que resolveu para outro produto.
    backendError.httpStatus =
      response.status;

    backendError.backendData =
      data ||
      null;

    backendError.validation =
      data?.validation ||
      null;

    if (
      data
        ?.validation
        ?.reason ===
        "resolved_to_different_offer"
    ) {
      backendError.code =
        "AFFILIATE_LINK_MISMATCH";

      backendError.permanent =
        true;

      backendError.safeReason =
        "O link afiliado resolveu para outro produto.";
    }

    throw backendError;
  }

  return data;
}

function normalizeStoredCursor(value) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      number
    )
  );
}

async function loadAutomaticGroupCursors() {
  const response =
    await fetch(
      APP_STATE_API,
      {
        method:
          "GET",

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
      `Estado dos cursores respondeu HTTP ${response.status}.`
    );
  }

  const state =
    data?.state ||
    {};

  automaticGroupCursors
    .eletronicos =
      normalizeStoredCursor(
        state.eletronicos
      );

  automaticGroupCursors
    .fitness =
      normalizeStoredCursor(
        state.fitness
      );

  automaticGroupCursors
    .perfumes =
      normalizeStoredCursor(
        state.perfumes
      );

  return {
    ...automaticGroupCursors
  };
}

async function saveAutomaticGroupCursors() {
  const state = {
    eletronicos:
      normalizeStoredCursor(
        automaticGroupCursors
          .eletronicos
      ),

    fitness:
      normalizeStoredCursor(
        automaticGroupCursors
          .fitness
      ),

    perfumes:
      normalizeStoredCursor(
        automaticGroupCursors
          .perfumes
      )
  };

  const response =
    await fetch(
      APP_STATE_API,
      {
        method:
          "POST",

        headers:
          adminHeaders(),

        body:
          JSON.stringify({
            state
          })
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
      `Persistência dos cursores respondeu HTTP ${response.status}.`
    );
  }

  return data?.state ||
    state;
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

async function recoverConnectionSendErrors() {
  const response =
    await apiGet({
      action:
        "queue-list",

      status:
        "send_error",

      limit:
        100
    });

  const entries =
    response
      ?.queue
      ?.entries ||
    [];

  let recovered =
    0;

  for (
    const entry of
    entries
  ) {
    const lastError =
      String(
        entry
          ?.delivery
          ?.lastError ||
        ""
      );

    if (
      !/connection closed|socket closed|connection lost|not connected|connection terminated/i
        .test(
          lastError
        )
    ) {
      continue;
    }

    await setStatus(
      entry.itemId,
      "retry",
      {
        groupJid:
          entry
            ?.delivery
            ?.groupJid ||
          null,

        groupName:
          entry
            ?.delivery
            ?.groupName ||
          null
      }
    );

    recovered +=
      1;
  }

  return {
    scanned:
      entries.length,

    recovered
  };
}


async function repairQueueDuplicates() {
  return apiGet({
    action:
      "queue-dedupe"
  });
}


async function getAwaitingAffiliateItem(
  group = null
) {
  const response =
    await apiGet({
      action:
        "queue-list",

      status:
        "awaiting_affiliate_link",

      limit:
        100
    });

  const entries =
    response
      ?.queue
      ?.entries ||
    [];

  return (
    entries.find(
      (entry) => {
        const target =
          classifyOfferDestination(
            entry,
            routing
          );

        if (!target) {
          return false;
        }

        if (
          group &&
          target.filterKey !==
            group
        ) {
          return false;
        }

        return (
          !isRecentlyHandled(
            recentAffiliateProducts,
            entry
          ) &&
          !isRecentlyHandled(
            recentSentProducts,
            entry
          )
        );
      }
    ) ||
    null
  );
}

async function attachAffiliateLink({
  itemId,
  affiliateLink
}) {
  return apiPost(
    "attach-affiliate-link",
    {
      itemId,
      affiliateLink
    }
  );
}

async function runAutoDiscovery({
  group = null,
  cursor = null
} = {}) {
  const targeted =
    Boolean(
      group
    );

  const result =
    await apiPost(
      "auto-discover",
      {
        cursor:
          targeted
            ? (
                Number.isFinite(
                  Number(cursor)
                )
                  ? Number(cursor)
                  : 0
              )
            : discoveryCursor,

        limit:
          1,

        group:
          group ||
          null
      }
    );

  // A busca direcionada não mexe no cursor da busca automática.
  if (
    !targeted &&
    typeof result
      ?.nextCursor ===
      "number"
  ) {
    discoveryCursor =
      result.nextCursor;
  }

  return result;
}

async function getReadyItem(
  group = null,
  {
    ignorePreviewMemory = false
  } = {}
) {
  const response =
    await apiGet({
      action:
        "queue-list",

      status:
        "ready_to_publish",

      limit:
        100
    });

  const entries =
    response
      ?.queue
      ?.entries ||
    [];

  return (
    entries.find(
      (entry) => {
        const target =
          classifyOfferDestination(
            entry,
            routing
          );

        if (!target) {
          return false;
        }

        if (
          group &&
          target.filterKey !==
            group
        ) {
          return false;
        }

        return (
          (
            ignorePreviewMemory ||
            !isRecentlyHandled(
              recentPreviewProducts,
              entry
            )
          ) &&
          !isRecentlyHandled(
            recentSentProducts,
            entry
          )
        );
      }
    ) ||
    null
  );
}

function resolveDestination(
  entry
) {
  const target =
    classifyOfferDestination(
      entry,
      routing
    );

  if (!target) {
    return null;
  }

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
        `${target.name} → ${routing.controlGroup.name} (TESTE)`,

      realJid:
        target.jid,

      realName:
        target.name,

      filterKey:
        target.filterKey,

      filterLabel:
        target.filterLabel,

      testMode:
        true
    };
  }

  return {
    jid:
      target.jid,

    name:
      target.name,

    realJid:
      target.jid,

    realName:
      target.name,

    filterKey:
      target.filterKey,

    filterLabel:
      target.filterLabel,

    testMode:
      false
  };
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
    `Filtro: *${destination.filterLabel || "não informado"}*`,
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
      `⚠️ *MODO DE TESTE:* a oferta final também será enviada em ${routing.controlGroup.name}.`
    );
  }

  return lines.join(
    "\n"
  );
}

async function notifyAffiliateSessionProblem(
  sock,
  message
) {
  if (
    affiliateSessionWarningSent
  ) {
    return;
  }

  affiliateSessionWarningSent =
    true;

  await sock.sendMessage(
    routing
      .controlGroup
      .jid,
    {
      text:
        "⚠️ *AUTOMAÇÃO DO LINK AFILIADO PAROU*\n\n" +
        `${message}\n\n` +
        "Atualize localmente ML_AFFILIATE_COOKIE e ML_AFFILIATE_CSRF_TOKEN e reinicie o bot.\n\n" +
        "As ofertas continuam seguras na fila aguardando link."
    }
  );
}

async function fillNextAffiliateLink(
  sock,
  {
    group = null,
    batchMode = false
  } = {}
) {
  if (
    !AUTO_AFFILIATE_ENABLED ||
    affiliateFillInProgress ||
    affiliateSessionBlocked
  ) {
    return false;
  }

  if (
    !affiliateSessionConfigured()
  ) {
    return false;
  }

  affiliateFillInProgress =
    true;

  // Precisa existir fora do try para que o catch consiga
  // marcar a mesma oferta como rejected quando o Mercado Livre
  // devolver AFFILIATE_URL_NOT_ALLOWED.
  let entry =
    null;

  try {
    entry =
      await getAwaitingAffiliateItem(
        group
      );

    if (!entry) {
      return false;
    }

    // Bloqueia ANTES da chamada. Se outro trigger local ocorrer
    // enquanto createLink/validação ainda estão terminando,
    // ele não pega este mesmo produto.
    rememberHandled(
      recentAffiliateProducts,
      entry
    );

    console.log(
      `🔗 Gerando link afiliado: ${entry.title}`
    );

    const generated =
      await createAffiliateLink({
        itemId:
          entry.itemId,

        productId:
          entry.productId,

        catalogPageUrl:
          entry.catalogPageUrl,

        title:
          entry.title
      });

    console.log(
      `🔗 Link gerado: ${generated.shortUrl}`
    );

    const attached =
      await attachAffiliateLink({
        itemId:
          entry.itemId,

        affiliateLink:
          generated.shortUrl
      });

    if (
      attached?.ok !== true ||
      attached
        ?.publicationStatus !==
        "ready_to_publish"
    ) {
      const attachError =
        new Error(
          attached?.error ||
          "O link foi gerado, mas não passou pela validação do T&T."
        );

      if (
        attached
          ?.validation
          ?.reason ===
        "resolved_to_different_offer"
      ) {
        attachError.code =
          "AFFILIATE_LINK_MISMATCH";

        attachError.permanent =
          true;

        attachError.safeReason =
          "O link afiliado resolveu para outro produto.";
      }

      throw attachError;
    }

    if (
      !batchMode
    ) {
      await sock.sendMessage(
        routing
          .controlGroup
          .jid,
        {
          text:
            "🔗 *LINK AFILIADO GERADO AUTOMATICAMENTE*\n\n" +
            `${entry.title}\n` +
            `${generated.shortUrl}\n\n` +
            "✅ Validado e movido para ready_to_publish."
        }
      );

      await showNextPreview(
        sock
      );
    }

    return true;
  } catch (error) {
    if (
      error instanceof
        AffiliateSessionError
    ) {
      affiliateSessionBlocked =
        true;

      console.error(
        "⚠️ Sessão de afiliados inválida:",
        error.message
      );

      await notifyAffiliateSessionProblem(
        sock,
        error.message
      );

      return false;
    }

    console.error(
      "Erro ao gerar link afiliado:",
      error?.message ||
      error
    );

    if (
      error?.code
    ) {
      console.log(
        `🔎 Código do erro afiliado: ${error.code}`
      );
    }

    if (
      error
        ?.validation
        ?.reason
    ) {
      console.log(
        `🔎 Validação do link: ${error.validation.reason}`
      );
    }

    const affiliateProgramRejected =
      error?.code ===
        "AFFILIATE_URL_NOT_ALLOWED" ||
      /url not allowed in affiliates program/i
        .test(
          String(
            error?.message ||
            ""
          )
        );

    const affiliateLinkMismatch =
      error?.code ===
        "AFFILIATE_LINK_MISMATCH";

    const permanentAffiliateRejection =
      affiliateProgramRejected ||
      affiliateLinkMismatch;

    if (
      permanentAffiliateRejection &&
      entry?.itemId
    ) {
      try {
        await setStatus(
          entry.itemId,
          "rejected",
          {
            errorMessage:
              affiliateLinkMismatch
                ? "Link afiliado resolveu para produto diferente do enfileirado."
                : "Mercado Livre informou: URL not allowed in affiliates program."
          }
        );

        rememberHandled(
          recentAffiliateProducts,
          entry,
          24 * 60 * 60 * 1000
        );

        console.log(
          `🚫 Rejeitada definitivamente para afiliados: ${entry.title || entry.itemId}`
        );

        if (
          isSocketActive(
            sock
          )
        ) {
          try {
            await sock.sendMessage(
              routing
                .controlGroup
                .jid,
              {
                text:
                  "🚫 *OFERTA REJEITADA PARA PUBLICAÇÃO*\n\n" +
                  `${entry.title || entry.itemId}\n\n` +
                  (
                    affiliateLinkMismatch
                      ? "O link afiliado resolveu para um produto diferente do enfileirado."
                      : "O Mercado Livre informou que essa URL não é permitida no programa."
                  ) +
                  "\n\nEla foi marcada como *rejected* e não será tentada novamente."
              }
            );
          } catch (
            notificationError
          ) {
            console.log(
              "⚠️ Rejeição salva; aviso ao grupo de controle não pôde ser enviado."
            );
          }
        }

        return false;
      } catch (rejectError) {
        console.error(
          "⚠️ Não consegui marcar a oferta como rejected:",
          rejectError?.message ||
          rejectError
        );
      }
    }

    // Não repete imediatamente o mesmo erro a cada 30s.
    // Depois de 60s o item pode ser tentado novamente.
    if (
      entry
    ) {
      rememberHandled(
        recentAffiliateProducts,
        entry,
        60000
      );
    }

    if (
      isSocketActive(
        sock
      )
    ) {
      try {
        await sock.sendMessage(
          routing
            .controlGroup
            .jid,
          {
            text:
              "❌ Não consegui gerar/validar o link afiliado para uma oferta.\n\n" +
              `${error?.message || "Erro desconhecido."}\n\n` +
              "A oferta permaneceu aguardando link porque o erro não foi classificado como rejeição definitiva."
          }
        );
      } catch {
        // A falha ao avisar o grupo não pode derrubar o ciclo.
      }
    }

    return false;
  } finally {
    affiliateFillInProgress =
      false;
  }
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

    const windowOpen =
      isAutomaticSendWindowOpen();

    const lines = [
      "📊 *T&T - STATUS DA FILA*",
      "",
      `🕘 Automático: ${automaticWindowLabel()}`,
      `${windowOpen ? "🟢" : "🌙"} Janela agora: ${windowOpen ? "LIBERADA" : "PAUSADA"} (${automaticCurrentClockLabel()})`,
      `✋ Modo manual: ${manualModeEnabled ? "ATIVO" : "DESLIGADO"}`,
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
  const discoveredOffers =
    Array.isArray(
      result?.newOffers
    )
      ? result.newOffers
      : [];

  const newOffers =
    filterEligibleOffers(
      discoveredOffers,
      routing
    );

  const ignoredCount =
    Math.max(
      discoveredOffers.length -
      newOffers.length,
      0
    );

  if (!newOffers.length) {
    if (
      discoveredOffers.length > 0
    ) {
      console.log(
        `🔎 Descoberta automática: ${ignoredCount} oferta(s) nova(s) ignorada(s) pelos filtros. Próximo cursor: ${discoveryCursor}`
      );
    } else {
      console.log(
        `🔎 Descoberta automática: nenhuma oferta nova. Próximo cursor: ${discoveryCursor}`
      );
    }

    return;
  }

  const lines = [
    `🔎 *T&T encontrou ${newOffers.length} oferta(s) dentro dos filtros*`,
    "",
    "Elas pertencem a um dos grupos ativos e passaram pela validação básica de dados."
  ];

  if (
    ignoredCount > 0
  ) {
    lines.push(
      "",
      `🚫 Fora dos filtros e ignoradas: ${ignoredCount}`
    );
  }

  newOffers
    .slice(
      0,
      5
    )
    .forEach(
      (offer, index) => {
        const target =
          classifyOfferDestination(
            offer,
            routing
          );

        lines.push(
          "",
          `${index + 1}. *${offer.title}*`,
          offer.price !== null
            ? `💰 ${formatMoney(offer.price)}`
            : "",
          offer.discount !== null
            ? `🔥 ${offer.discount}% OFF`
            : "",
          target?.name
            ? `🎯 Grupo: ${target.name}`
            : "",
          offer.catalogPageUrl
            ? `🔎 Abrir produto: ${offer.catalogPageUrl}`
            : ""
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
  sock,
  {
    group = null
  } = {}
) {
  if (
    actionInProgress ||
    discoveryInProgress
  ) {
    return;
  }

  discoveryInProgress =
    true;

  try {
    const targetedLabels = {
      eletronicos: {
        emoji:
          "📱",

        label:
          "Eletrônicos"
      },

      fitness: {
        emoji:
          "💪",

        label:
          "Fitness"
      },

      perfumes: {
        emoji:
          "🌸",

        label:
          "Perfumes"
      }
    };

    const targeted =
      group
        ? targetedLabels[
            group
          ]
        : null;

    if (
      targeted
    ) {
      console.log(
        `${targeted.emoji} Descoberta direcionada: ${targeted.label}`
      );

      await sock.sendMessage(
        routing
          .controlGroup
          .jid,
        {
          text:
            `${targeted.emoji} Buscando ofertas de *${targeted.label}*...`
        }
      );
    } else {
      console.log(
        `🔎 Descoberta automática iniciada. Cursor: ${discoveryCursor}`
      );
    }

    const result =
      await runAutoDiscovery({
        group
      });

    await notifyAutoDiscovery(
      sock,
      result
    );

    if (
      AUTO_AFFILIATE_ENABLED &&
      affiliateSessionConfigured() &&
      !affiliateSessionBlocked
    ) {
      await fillNextAffiliateLink(
        sock
      );
    }
  } catch (error) {
    console.error(
      "Erro na descoberta automática:",
      error?.message ||
      error
    );
  } finally {
    discoveryInProgress =
      false;
  }
}

async function sendManualModeStatus(
  sock
) {
  await sock.sendMessage(
    routing
      .controlGroup
      .jid,
    {
      text:
        manualModeEnabled
          ? (
              "✋ *MODO MANUAL ATIVO*\n\n" +
              "🤖 Ciclos automáticos pausados.\n" +
              "🔗 Cole um link do Mercado Livre ou meli.la neste grupo.\n" +
              "👀 O T&T prepara a oferta e mostra a prévia.\n" +
              "✅ Responda *SIM* para enviar.\n" +
              "🚫 Responda *NÃO* para cancelar.\n\n" +
              "Para voltar à automação: *MANUAL OFF*"
            )
          : (
              "🤖 *MODO AUTOMÁTICO ATIVO*\n\n" +
              "Os ciclos automáticos estão liberados.\n" +
              "Para pausar e trabalhar só com links escolhidos por você: *MANUAL ON*"
            )
    }
  );
}

async function setManualMode(
  sock,
  enabled
) {
  const next =
    enabled === true;

  if (
    manualModeEnabled ===
    next
  ) {
    await sendManualModeStatus(
      sock
    );

    return;
  }

  manualModeEnabled =
    next;

  if (
    manualModeEnabled
  ) {
    console.log(
      "✋ Modo manual ATIVO. Novos lotes automáticos pausados."
    );

    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          "✋ *MODO MANUAL ATIVADO*\n\n" +
          "O T&T vai pausar os ciclos automáticos.\n\n" +
          "Agora cole aqui um link:\n" +
          "• mercadolivre.com.br/...\n" +
          "• meli.la/...\n\n" +
          "Quando a prévia aparecer:\n" +
          "✅ *SIM* → enviar\n" +
          "🚫 *NÃO* → cancelar\n\n" +
          "Para voltar: *MANUAL OFF*"
      }
    );

    return;
  }

  console.log(
    "🤖 Modo automático ATIVO."
  );

  await sock.sendMessage(
    routing
      .controlGroup
      .jid,
    {
      text:
        "🤖 *MODO AUTOMÁTICO REATIVADO*\n\n" +
        "Os ciclos automáticos foram liberados."
    }
  );

  if (
    AUTO_BATCH_ENABLED &&
    !automaticBatchInProgress
  ) {
    runAutomaticBatchCycle(
      sock
    ).catch(
      console.error
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
          manualModeEnabled
            ? `✋🔗 Processando ${links.length} link(s) no modo manual...`
            : `🔗 Processando ${links.length} link(s) afiliado(s)...`
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
      `⏸️ Ignoradas por dados/limite: ${result.heldCount || 0}`,
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
          `✅ ${item.title || item.itemId || "Oferta"} → pronta para publicação`
        );
      } else if (
        item.status ===
        "held"
      ) {
        lines.push(
          `⏸️ ${item.title || item.itemId || "Oferta"} → ${item.heldReason || "ignorada"}`
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


async function sendEntryAutomatically(
  sock,
  entry,
  group
) {
  const destination =
    resolveDestination(
      entry
    );

  if (!destination) {
    return false;
  }

  try {
    if (
      !isSocketActive(
        sock
      )
    ) {
      throw connectionClosedError();
    }

    if (
      !isAutomaticSendWindowOpen()
    ) {
      throw automaticWindowClosedError();
    }

    await setStatus(
      entry.itemId,
      "sending",
      {
        groupJid:
          destination.jid,

        groupName:
          destination.name
      }
    );

    const imageBuffer =
      await downloadImage(
        entry
          .whatsappPayload
          ?.image
      );

    if (
      !isAutomaticSendWindowOpen()
    ) {
      throw automaticWindowClosedError();
    }

    const sent =
      await sock.sendMessage(
        destination.jid,
        {
          image:
            imageBuffer,

          caption:
            entry
              .whatsappPayload
              ?.caption ||
            entry.messageDraft ||
            ""
        }
      );

    await setStatus(
      entry.itemId,
      "sent",
      {
        groupJid:
          destination.jid,

        groupName:
          destination.name,

        whatsappMessageId:
          sent?.key?.id ||
          null
      }
    );

    rememberHandled(
      recentSentProducts,
      entry,
      RECENT_OPERATION_TTL_MS
    );

    rememberHandled(
      recentPreviewProducts,
      entry,
      RECENT_OPERATION_TTL_MS
    );

    rememberHandled(
      recentAffiliateProducts,
      entry,
      RECENT_OPERATION_TTL_MS
    );

    const label =
      AUTO_BATCH_LABELS[
        group
      ]?.label ||
      group;

    console.log(
      `🤖 Lote ${label}: Sent → ${entry.title}`
    );

    return true;
  } catch (error) {
    if (
      isAutomaticWindowClosedError(
        error
      )
    ) {
      try {
        await setStatus(
          entry.itemId,
          "retry",
          {
            groupJid:
              destination.jid,

            groupName:
              destination.name
          }
        );

        console.log(
          `🌙 Horário automático encerrado; oferta devolvida para ready_to_publish: ${entry.title}`
        );
      } catch (
        retryError
      ) {
        console.error(
          "⚠️ Não consegui devolver a oferta após o encerramento do horário:",
          retryError?.message ||
          retryError
        );
      }

      throw automaticWindowClosedError();
    }

    if (
      isConnectionClosedError(
        error
      ) ||
      !isSocketActive(
        sock
      )
    ) {
      try {
        // Não é erro da oferta. A conexão caiu.
        // Volta para ready_to_publish para ser enviada após reconectar.
        await setStatus(
          entry.itemId,
          "retry",
          {
            groupJid:
              destination.jid,

            groupName:
              destination.name
          }
        );

        console.log(
          `🔄 WhatsApp caiu; oferta devolvida para ready_to_publish: ${entry.title}`
        );
      } catch (
        retryError
      ) {
        console.error(
          "⚠️ Não consegui devolver a oferta para ready_to_publish:",
          retryError?.message ||
          retryError
        );
      }

      throw connectionClosedError();
    }

    try {
      await setStatus(
        entry.itemId,
        "send_error",
        {
          groupJid:
            destination.jid,

          groupName:
            destination.name,

          errorMessage:
            error?.message ||
            "Erro desconhecido."
        }
      );
    } catch {
      // Não derruba o ciclo se falhar ao registrar o erro.
    }

    console.error(
      `❌ Lote ${group}:`,
      error?.message ||
      error
    );

    return false;
  }
}

async function getOrPrepareReadyBatchItem(
  sock,
  group,
  {
    affiliateAttempts = 6
  } = {}
) {
  // Primeiro aproveita o que já estiver pronto.
  let entry =
    await getReadyItem(
      group,
      {
        ignorePreviewMemory:
          true
      }
    );

  if (entry) {
    return entry;
  }

  // Uma oferta pode ser rejeitada pelo afiliado.
  // Nesse caso, não queremos encerrar o lote se houver outras
  // ofertas aguardando link logo atrás dela.
  for (
    let attempt = 1;
    attempt <= affiliateAttempts;
    attempt += 1
  ) {
    if (
      !isSocketActive(
        sock
      )
    ) {
      throw connectionClosedError();
    }

    if (
      !isAutomaticSendWindowOpen()
    ) {
      throw automaticWindowClosedError();
    }

    const generated =
      await fillNextAffiliateLink(
        sock,
        {
          group,
          batchMode:
            true
        }
      );

    if (
      generated
    ) {
      entry =
        await waitForReadyBatchItem(
          group
        );

      if (entry) {
        return entry;
      }
    }

    // Se fillNextAffiliateLink retornou false, pode ter sido porque:
    // - uma oferta foi rejeitada definitivamente; ou
    // - não existe mais nenhuma oferta aguardando link.
    //
    // Conferimos a fila antes de decidir parar.
    const nextAwaiting =
      await getAwaitingAffiliateItem(
        group
      );

    if (
      !nextAwaiting
    ) {
      break;
    }

    await sleep(
      250
    );
  }

  // Uma última leitura evita perder um ready que apareceu
  // entre a geração e a atualização da fila.
  return getReadyItem(
    group,
    {
      ignorePreviewMemory:
        true
    }
  );
}

async function waitForReadyBatchItem(
  group,
  {
    attempts = 8,
    delayMs = 750
  } = {}
) {
  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    const entry =
      await getReadyItem(
        group,
        {
          ignorePreviewMemory:
            true
        }
      );

    if (entry) {
      return entry;
    }

    if (
      attempt <
      attempts
    ) {
      await sleep(
        delayMs
      );
    }
  }

  return null;
}

function logDiscoveryDiagnostic(
  meta,
  result
) {
  const categories =
    Array.isArray(
      result?.categories
    )
      ? result.categories
      : [];

  if (
    categories.length === 0
  ) {
    console.log(
      `${meta.emoji}   ↳ sem diagnóstico de categoria`
    );

    return;
  }

  for (
    const category of
    categories
  ) {
    const seedLabel =
      category
        ?.seed
        ?.label ||
      category
        ?.seed
        ?.key ||
      "categoria";

    const status =
      category?.ok === true
        ? "OK"
        : "ERRO";

    const candidateCount =
      category
        ?.candidateCount ??
      0;

    const readyCount =
      category
        ?.readyCount ??
      0;

    const newQueuedCount =
      category
        ?.newQueuedCount ??
      0;

    const duplicateCount =
      category
        ?.duplicateCount ??
      0;

    const newOfferCount =
      Array.isArray(
        category?.newOffers
      )
        ? category.newOffers.length
        : 0;

    console.log(
      `${meta.emoji}   ↳ ${seedLabel}: ${status} | candidatos ${candidateCount} | ready ${readyCount} | novos ${newQueuedCount} | ofertas novas ${newOfferCount} | duplicados ${duplicateCount}`
    );

    if (
      category?.ok !== true &&
      category?.error
    ) {
      console.log(
        `${meta.emoji}      erro: ${category.error}`
      );
    }
  }

  const discovered =
    Array.isArray(
      result?.newOffers
    )
      ? result.newOffers
      : [];

  const eligible =
    filterEligibleOffers(
      discovered,
      routing
    ).filter(
      (offer) =>
        classifyOfferDestination(
          offer,
          routing
        )?.filterKey ===
        result?.group
    );

  console.log(
    `${meta.emoji}   ↳ total desta busca: novos ${discovered.length} | elegíveis para ${meta.label}: ${eligible.length}`
  );
}

async function processAutomaticBatchGroup(
  sock,
  group
) {
  const meta =
    AUTO_BATCH_LABELS[
      group
    ];

  if (!meta) {
    return 0;
  }

  const poolSize =
    Math.max(
      Number(
        AUTO_BATCH_GROUP_POOL_SIZES[
          group
        ] ||
        AUTO_BATCH_DISCOVERY_ATTEMPTS
      ) || AUTO_BATCH_DISCOVERY_ATTEMPTS,
      AUTO_BATCH_DISCOVERY_ATTEMPTS
    );

  console.log(
    `${meta.emoji} Lote iniciado: ${meta.label} (meta ${AUTO_BATCH_MIN_SEND}–${AUTO_BATCH_SIZE}) | cursor inicial ${automaticGroupCursors[group] || 0}`
  );

  let sentCount =
    0;

  let discoveryAttempts =
    0;

  let targetedCursor =
    Number(
      automaticGroupCursors[
        group
      ] ||
      0
    ) || 0;

  let wrappedPool =
    false;

  let minimumExtensionLogged =
    false;

  while (
    sentCount <
    AUTO_BATCH_SIZE
  ) {
    if (
      !isSocketActive(
        sock
      )
    ) {
      throw connectionClosedError();
    }

    if (
      !isAutomaticSendWindowOpen()
    ) {
      throw automaticWindowClosedError();
    }

    if (
      manualModeEnabled
    ) {
      console.log(
        `${meta.emoji} Lote ${meta.label} interrompido: modo manual ativo.`
      );

      break;
    }

    // Se ainda estamos abaixo do mínimo, podemos percorrer o pool inteiro.
    // Depois de atingir o mínimo, voltamos ao limite normal de 8 buscas
    // para tentar completar a terceira oferta sem alongar demais o ciclo.
    const discoveryLimit =
      sentCount <
        AUTO_BATCH_MIN_SEND
        ? poolSize
        : AUTO_BATCH_DISCOVERY_ATTEMPTS;

    if (
      sentCount <
        AUTO_BATCH_MIN_SEND &&
      discoveryAttempts >=
        AUTO_BATCH_DISCOVERY_ATTEMPTS &&
      !minimumExtensionLogged
    ) {
      console.log(
        `${meta.emoji} Mínimo ${AUTO_BATCH_MIN_SEND} ainda não atingido. Vou continuar procurando no restante do pool (até ${poolSize} frentes).`
      );

      minimumExtensionLogged =
        true;
    }

    // 1. Aproveita ready e tenta preparar vários awaiting.
    //    Se um link for rejected, tenta o próximo em vez de abandonar.
    let entry =
      await getOrPrepareReadyBatchItem(
        sock,
        group,
        {
          affiliateAttempts:
            6
        }
      );

    // 2. Se ainda não temos oferta pronta, descobre uma nova frente.
    if (
      !entry &&
      discoveryAttempts <
        discoveryLimit
    ) {
      const attempt =
        discoveryAttempts +
        1;

      console.log(
        `${meta.emoji} Busca ${attempt}/${discoveryLimit}: ${meta.label} (cursor ${targetedCursor})`
      );

      let result =
        null;

      try {
        result =
          await runAutoDiscovery({
            group,
            cursor:
              targetedCursor
          });

        logDiscoveryDiagnostic(
          meta,
          result
        );
      } catch (error) {
        console.error(
          `⚠️ Descoberta ${meta.label}:`,
          error?.message ||
          error
        );
      }

      discoveryAttempts +=
        1;

      const previousCursor =
        targetedCursor;

      if (
        typeof result
          ?.nextCursor ===
          "number"
      ) {
        targetedCursor =
          result.nextCursor;
      } else {
        targetedCursor +=
          1;
      }

      const justWrapped =
        targetedCursor <=
        previousCursor;

      if (
        justWrapped
      ) {
        wrappedPool =
          true;

        if (
          sentCount <
            AUTO_BATCH_MIN_SEND
        ) {
          console.log(
            `${meta.emoji} Fim do pool alcançado, mas o mínimo ${AUTO_BATCH_MIN_SEND} ainda não foi atingido. Continuando do início até completar uma volta de busca.`
          );
        } else {
          console.log(
            `${meta.emoji} Fim do pool alcançado com o mínimo já atendido.`
          );
        }
      }

      automaticGroupCursors[
        group
      ] =
        targetedCursor;

      // Importante: volta ao topo para consumir as ofertas recém-enfileiradas
      // ANTES de decidir que o pool acabou.
      continue;
    }

    // 3. Sem ready e sem novas buscas possíveis.
    if (!entry) {
      break;
    }

    const sent =
      await sendEntryAutomatically(
        sock,
        entry,
        group
      );

    if (!sent) {
      rememberHandled(
        recentSentProducts,
        entry,
        60000
      );

      // Não quebra o lote. Pode haver outra oferta pronta/awaiting.
      continue;
    }

    sentCount +=
      1;

    await sleep(
      2500
    );
  }

  try {
    await saveAutomaticGroupCursors();
  } catch (error) {
    console.error(
      `⚠️ Não consegui persistir cursor de ${meta.label}:`,
      error?.message ||
      error
    );
  }

  if (
    sentCount <
      AUTO_BATCH_MIN_SEND
  ) {
    console.log(
      `${meta.emoji} ⚠️ Mínimo não atingido: ${meta.label} enviou ${sentCount}/${AUTO_BATCH_MIN_SEND}. O pool consultado não tinha ofertas novas/válidas suficientes sem repetir produtos.`
    );
  } else {
    console.log(
      `${meta.emoji} ✅ Mínimo atingido: ${meta.label} enviou ${sentCount}/${AUTO_BATCH_MIN_SEND} ou mais.`
    );
  }

  console.log(
    `${meta.emoji} Lote concluído: ${meta.label} → ${sentCount}/${AUTO_BATCH_SIZE} | buscas ${discoveryAttempts}/${sentCount < AUTO_BATCH_MIN_SEND ? poolSize : Math.max(AUTO_BATCH_DISCOVERY_ATTEMPTS, discoveryAttempts)}${wrappedPool ? " | pool contornado" : ""}`
  );

  return sentCount;
}

async function runAutomaticBatchCycle(
  sock
) {
  if (
    !AUTO_BATCH_ENABLED ||
    automaticBatchInProgress
  ) {
    return;
  }

  if (
    manualModeEnabled
  ) {
    console.log(
      "✋ Ciclo automático não iniciado: modo manual ativo."
    );

    return;
  }

  if (
    !isAutomaticSendWindowOpen()
  ) {
    if (
      !automaticWindowPauseLogged
    ) {
      console.log(
        `🌙 Automação pausada fora do horário ${automaticWindowLabel()}. Agora: ${automaticCurrentClockLabel()}.`
      );
      console.log(
        "✅ WhatsApp permanece conectado. O modo manual continua liberado."
      );

      automaticWindowPauseLogged =
        true;
    }

    scheduleAutomaticWindowCheck(
      sock
    );

    return;
  }

  if (
    automaticWindowPauseLogged
  ) {
    console.log(
      `☀️ Janela automática liberada (${automaticWindowLabel()}). Retomando ciclos.`
    );

    automaticWindowPauseLogged =
      false;
  }

  automaticBatchInProgress =
    true;

  const counts = {
    eletronicos:
      0,

    fitness:
      0,

    perfumes:
      0
  };

  try {
    console.log("");
    console.log(
      "🤖 ===== CICLO AUTOMÁTICO T&T ====="
    );
    console.log(
      `🎯 Meta: mínimo ${AUTO_BATCH_MIN_SEND}, alvo até ${AUTO_BATCH_SIZE} por grupo`
    );

    for (
      const group of
      AUTO_BATCH_GROUPS
    ) {
      if (
        manualModeEnabled
      ) {
        console.log(
          "✋ Ciclo automático pausado antes do próximo grupo."
        );

        break;
      }

      if (
        !isAutomaticSendWindowOpen()
      ) {
        throw automaticWindowClosedError();
      }

      counts[
        group
      ] =
        await processAutomaticBatchGroup(
          sock,
          group
        );
    }

    const total =
      Object
        .values(
          counts
        )
        .reduce(
          (
            sum,
            value
          ) =>
            sum +
            value,
          0
        );

    console.log(
      `✅ Ciclo finalizado: Eletrônicos ${counts.eletronicos}/${AUTO_BATCH_SIZE} | Fitness ${counts.fitness}/${AUTO_BATCH_SIZE} | Perfumes ${counts.perfumes}/${AUTO_BATCH_SIZE}`
    );
    console.log(
      `⏸️ Pausa: ${Math.round(AUTO_BATCH_PAUSE_MS / 60000)} min`
    );

    await sock.sendMessage(
      routing
        .controlGroup
        .jid,
      {
        text:
          "🤖 *CICLO AUTOMÁTICO T&T CONCLUÍDO*\n\n" +
          `📱 Eletrônicos: ${counts.eletronicos}/${AUTO_BATCH_SIZE}\n` +
          `💪 Fitness: ${counts.fitness}/${AUTO_BATCH_SIZE}\n` +
          `🌸 Perfumes: ${counts.perfumes}/${AUTO_BATCH_SIZE}\n\n` +
          `🎯 Mínimo por grupo: ${AUTO_BATCH_MIN_SEND}\n` +
          `📤 Total enviado: ${total}\n` +
          `⏸️ Próximo ciclo em ${Math.round(AUTO_BATCH_PAUSE_MS / 60000)} minutos.`
      }
    );
  } catch (error) {
    if (
      isAutomaticWindowClosedError(
        error
      )
    ) {
      console.log(
        `🌙 Ciclo automático interrompido: chegou ao fim da janela ${automaticWindowLabel()}.`
      );

      automaticWindowPauseLogged =
        true;
    } else if (
      isConnectionClosedError(
        error
      )
    ) {
      console.log(
        "🔌 Ciclo automático interrompido porque o WhatsApp desconectou. Ele continuará após a reconexão."
      );
    } else {
      console.error(
        "❌ Erro no ciclo automático:",
        error?.message ||
        error
      );
    }
  } finally {
    automaticBatchInProgress =
      false;

    if (
      AUTO_BATCH_ENABLED &&
      !manualModeEnabled &&
      isSocketActive(
        sock
      )
    ) {
      const nextDelay =
        isAutomaticSendWindowOpen()
          ? AUTO_BATCH_PAUSE_MS
          : AUTO_SEND_WINDOW_CHECK_MS;

      scheduleTimeout(
        () => {
          runAutomaticBatchCycle(
            sock
          ).catch(
            console.error
          );
        },
        nextDelay
      );
    }
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

    rememberHandled(
      recentPreviewProducts,
      entry
    );

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

    if (
      typeof entry !== "undefined" &&
      entry
    ) {
      rememberHandled(
        recentPreviewProducts,
        entry,
        60000
      );
    }
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

    // Mesmo se a fila remota devolver por alguns instantes o estado
    // anterior, este produto fica impedido localmente de reaparecer.
    rememberHandled(
      recentSentProducts,
      current.entry,
      RECENT_OPERATION_TTL_MS
    );

    rememberHandled(
      recentPreviewProducts,
      current.entry,
      RECENT_OPERATION_TTL_MS
    );

    rememberHandled(
      recentAffiliateProducts,
      current.entry,
      RECENT_OPERATION_TTL_MS
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

async function resumeAutomaticBatchWhenReady(
  sock
) {
  // Se um ciclo do socket antigo ainda está finalizando, aguarda.
  while (
    isSocketActive(
      sock
    ) &&
    automaticBatchInProgress
  ) {
    await sleep(
      500
    );
  }

  if (
    !isSocketActive(
      sock
    ) ||
    !AUTO_BATCH_ENABLED ||
    manualModeEnabled
  ) {
    return;
  }

  await runAutomaticBatchCycle(
    sock
  );
}


async function start() {
  routing =
    await loadRouting();

  try {
    automaticClockParts();
  } catch {
    throw new Error(
      `TT_SEND_TIMEZONE inválido: ${AUTO_SEND_TIMEZONE}`
    );
  }

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
        activeWhatsAppSocket =
          sock;

        whatsappConnectionOpen =
          true;

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
            `🛡️ Anti-repeat local: ${RECENT_OPERATION_TTL_MS} ms`
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
            `🤖 Lote automático: ${AUTO_BATCH_ENABLED ? "SIM" : "NÃO"}`
          );
          if (
            AUTO_BATCH_ENABLED
          ) {
            console.log(
              `📦 Lote: mínimo ${AUTO_BATCH_MIN_SEND}, alvo até ${AUTO_BATCH_SIZE} por grupo`
            );
            console.log(
              `🔎 Busca normal: até ${AUTO_BATCH_DISCOVERY_ATTEMPTS} frentes; abaixo do mínimo, percorre o pool inteiro`
            );
            console.log(
              "🔄 Pool rotativo: cada grupo continua do cursor anterior"
            );
            console.log(
              `⏸️ Pausa após ciclo: ${AUTO_BATCH_PAUSE_MS} ms`
            );
            console.log(
              `🕘 Janela automática: ${automaticWindowLabel()}`
            );
            console.log(
              `${isAutomaticSendWindowOpen() ? "🟢" : "🌙"} Automação agora: ${isAutomaticSendWindowOpen() ? "LIBERADA" : "PAUSADA"} (${automaticCurrentClockLabel()})`
            );
            console.log(
              "✋ Modo manual: liberado em qualquer horário"
            );
          }
          console.log(
            `🔗 Auto affiliate: ${AUTO_AFFILIATE_ENABLED ? "SIM" : "NÃO"}`
          );

          const affiliateStatus =
            affiliateSessionStatus();

          console.log(
            affiliateStatus.configured
              ? "🔗 Sessão afiliado local: CONFIGURADA"
              : "🔗 Sessão afiliado local: NÃO CONFIGURADA"
          );

          if (
            AUTO_AFFILIATE_ENABLED &&
            affiliateStatus.configured
          ) {
            console.log(
              `🔗 Affiliate interval: ${AUTO_AFFILIATE_INTERVAL_MS} ms`
            );
          }
          console.log(
            `💬 Comandos em ${routing.controlGroup.name}: STATUS | MANUAL ON | MANUAL OFF | DESCOBRIR | DESCOBRIR ELETRONICOS | DESCOBRIR FITNESS | DESCOBRIR PERFUMES | cole um link ML/meli.la`
          );
          console.log(
            `✋ Modo manual: ${manualModeEnabled ? "ATIVO" : "DESLIGADO"}`
          );
          console.log(
            "🛑 Ctrl + C para parar.\n"
          );

          try {
            const repair =
              await repairQueueDuplicates();

            if (
              repair.markedCount > 0 ||
              repair.duplicateGroups > 0
            ) {
              console.log(
                `🧹 Dedupe fila: ${repair.duplicateGroups} grupo(s), ${repair.markedCount} entrada(s) neutralizada(s).`
              );
            } else {
              console.log(
                "🧹 Dedupe fila: nenhuma duplicata ativa."
              );
            }
          } catch (error) {
            console.error(
              "⚠️ Não consegui executar dedupe inicial:",
              error?.message ||
              error
            );
          }

          if (
            AUTO_BATCH_ENABLED
          ) {
            try {
              const recovery =
                await recoverConnectionSendErrors();

              if (
                recovery.recovered > 0
              ) {
                console.log(
                  `🔄 Recuperação pós-conexão: ${recovery.recovered} oferta(s) devolvida(s) para ready_to_publish.`
                );
              }
            } catch (error) {
              console.error(
                "⚠️ Não consegui recuperar send_error de conexão:",
                error?.message ||
                error
              );
            }

            try {
              const restored =
                await loadAutomaticGroupCursors();

              console.log(
                `🧭 Cursores Supabase: Eletrônicos ${restored.eletronicos} | Fitness ${restored.fitness} | Perfumes ${restored.perfumes}`
              );
            } catch (error) {
              console.error(
                "⚠️ Não consegui restaurar cursores do Supabase; usando memória local:",
                error?.message ||
                error
              );
            }

            resumeAutomaticBatchWhenReady(
              sock
            ).catch(
              console.error
            );
          } else {
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

            if (
              AUTO_AFFILIATE_ENABLED &&
              affiliateSessionConfigured()
            ) {
              fillNextAffiliateLink(
                sock
              ).catch(
                console.error
              );
            }
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
        if (
          activeWhatsAppSocket ===
          sock
        ) {
          whatsappConnectionOpen =
            false;

          activeWhatsAppSocket =
            null;
        }

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

        // Evita que intervals do socket antigo continuem rodando
        // junto com os intervals da nova conexão.
        clearActiveTimers();

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

          const manualCommand =
            manualModeCommand(
              text
            );

          if (
            manualCommand ===
            "on"
          ) {
            await setManualMode(
              sock,
              true
            );

            continue;
          }

          if (
            manualCommand ===
            "off"
          ) {
            await setManualMode(
              sock,
              false
            );

            continue;
          }

          if (
            manualCommand ===
            "status"
          ) {
            await sendManualModeStatus(
              sock
            );

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

          const discoverGroup =
            discoverGroupCommand(
              text
            );

          if (
            discoverGroup &&
            manualModeEnabled
          ) {
            await sock.sendMessage(
              routing
                .controlGroup
                .jid,
              {
                text:
                  "✋ Modo manual ativo. Cole o link escolhido ou envie *MANUAL OFF* para voltar à descoberta."
              }
            );

            continue;
          }

          if (
            discoverGroup
          ) {
            await triggerAutoDiscovery(
              sock,
              {
                group:
                  discoverGroup
              }
            );

            continue;
          }

          if (
            isDiscoverCommand(
              text
            ) &&
            manualModeEnabled
          ) {
            await sock.sendMessage(
              routing
                .controlGroup
                .jid,
              {
                text:
                  "✋ Modo manual ativo. Cole o link escolhido ou envie *MANUAL OFF* para voltar à descoberta."
              }
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

  if (
    !AUTO_BATCH_ENABLED
  ) {
    scheduleInterval(
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
      scheduleInterval(
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

    if (
      AUTO_AFFILIATE_ENABLED
    ) {
      scheduleInterval(
        () => {
          fillNextAffiliateLink(
            sock
          ).catch(
            console.error
          );
        },
        AUTO_AFFILIATE_INTERVAL_MS
      );
    }
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
