import fs from "node:fs";
import { execFileSync } from "node:child_process";

const file = "whatsapp/publish-queue.js";

if (!fs.existsSync(file)) {
  console.error(`Não encontrei ${file}. Rode este instalador na raiz do projeto.`);
  process.exit(1);
}

let source = fs.readFileSync(file, "utf8");

if (source.includes("PUBLISHER_CONTROL_SYNC_V2")) {
  console.log("Publisher V2 já aplicado.");
  process.exit(0);
}

const backup = `${file}.bak-before-panel-v2`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(file, backup);
}

function insertBefore(anchor, content, label) {
  const index = source.indexOf(anchor);
  if (index < 0) {
    throw new Error(`Não encontrei o ponto de instalação: ${label}`);
  }
  source = source.slice(0, index) + content + source.slice(index);
}

function insertAfter(anchor, content, label) {
  const index = source.indexOf(anchor);
  if (index < 0) {
    throw new Error(`Não encontrei o ponto de instalação: ${label}`);
  }
  const end = index + anchor.length;
  source = source.slice(0, end) + content + source.slice(end);
}

// 1) Configuração da API de controle.
insertBefore(
  "const POLL_INTERVAL_MS =",
  `// PUBLISHER_CONTROL_SYNC_V2
const PUBLISHER_CONTROL_API =
  (
    process.env.TT_PUBLISHER_CONTROL_API ||
    new URL("/api/publisher-control", API_BASE).toString()
  ).trim();

const PUBLISHER_CONTROL_POLL_MS =
  Math.max(
    Number(process.env.TT_PUBLISHER_CONTROL_POLL_MS || 15000) || 15000,
    5000
  );

const PUBLISHER_HEARTBEAT_MS =
  Math.max(
    Number(process.env.TT_PUBLISHER_HEARTBEAT_MS || 30000) || 30000,
    10000
  );

`,
  "const POLL_INTERVAL_MS"
);

// 2) Helpers HTTP do publisher.
insertBefore(
  "function normalizeStoredCursor(value) {",
  `async function publisherControlRequest({
  method = "GET",
  body = null
} = {}) {
  const response = await fetch(
    PUBLISHER_CONTROL_API,
    {
      method,
      headers: adminHeaders(),
      body: body === null ? undefined : JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!response.ok || data?.ok === false) {
    throw new Error(
      data?.error ||
      \`Publisher control respondeu HTTP \${response.status}.\`
    );
  }

  return data;
}

async function persistPublisherManualControl(
  enabled,
  source = "whatsapp"
) {
  return publisherControlRequest({
    method: "POST",
    body: {
      action: "control",
      manualModeEnabled: enabled === true,
      source
    }
  });
}

async function syncPublisherControlFromWeb(sock) {
  const data = await publisherControlRequest();
  const requested = data?.control?.manualModeEnabled;

  if (typeof requested !== "boolean") return false;
  if (requested === manualModeEnabled) return false;

  manualModeEnabled = requested;

  console.log(
    requested
      ? "✋ Modo manual ativado pelo painel web."
      : "🤖 Modo automático reativado pelo painel web."
  );

  if (isSocketActive(sock)) {
    try {
      await sock.sendMessage(
        routing.controlGroup.jid,
        {
          text: requested
            ? "✋ *MODO MANUAL ATIVADO PELO PAINEL WEB*\\n\\nOs novos ciclos automáticos foram pausados. O grupo de controle continua ativo."
            : "🤖 *MODO AUTOMÁTICO REATIVADO PELO PAINEL WEB*\\n\\nOs ciclos automáticos foram liberados."
        }
      );
    } catch (error) {
      console.log(
        "⚠️ Modo alterado pelo painel, mas não consegui avisar o grupo:",
        error?.message || error
      );
    }
  }

  if (
    !manualModeEnabled &&
    AUTO_BATCH_ENABLED &&
    !automaticBatchInProgress &&
    isSocketActive(sock)
  ) {
    runAutomaticBatchCycle(sock).catch(console.error);
  }

  return true;
}

async function publishPublisherHeartbeat() {
  try {
    await publisherControlRequest({
      method: "POST",
      body: {
        action: "heartbeat",
        runtime: {
          whatsappConnected: whatsappConnectionOpen === true,
          manualModeEnabled: manualModeEnabled === true,
          automaticWindowOpen: isAutomaticSendWindowOpen(),
          automaticBatchInProgress: automaticBatchInProgress === true,
          autoBatchEnabled: AUTO_BATCH_ENABLED,
          autoDiscoveryEnabled: AUTO_DISCOVERY_ENABLED,
          affiliateConfigured: affiliateSessionConfigured(),
          affiliateBlocked: affiliateSessionBlocked === true,
          testMode: routing?.testMode === true,
          sendWindow: automaticWindowLabel(),
          timezone: AUTO_SEND_TIMEZONE,
          currentClock: automaticCurrentClockLabel(),
          publisherVersion: "panel-v2"
        }
      }
    });
  } catch (error) {
    console.log(
      "⚠️ Heartbeat do painel não pôde ser atualizado:",
      error?.message || error
    );
  }
}

`,
  "function normalizeStoredCursor"
);

// 3) Comandos MANUAL ON/OFF também atualizam o estado compartilhado.
insertAfter(
  `  const next =
    enabled === true;
`,
  `
  try {
    await persistPublisherManualControl(
      next,
      "whatsapp"
    );
  } catch (error) {
    console.log(
      "⚠️ Não consegui sincronizar o modo com o painel:",
      error?.message || error
    );
  }
`,
  "setManualMode const next"
);

// 4) Ao conectar, lê o controle web antes de iniciar ciclos.
insertAfter(
  `        whatsappConnectionOpen =
          true;
`,
  `
        try {
          await syncPublisherControlFromWeb(sock);
        } catch (error) {
          console.log(
            "⚠️ Não consegui ler o controle do painel na conexão:",
            error?.message || error
          );
        }

        await publishPublisherHeartbeat();
`,
  "connection open"
);

// 5) Ao desconectar, registra imediatamente.
insertBefore(
  `        const statusCode =
`,
  `        await publishPublisherHeartbeat();

`,
  "connection close statusCode"
);

// 6) Poll do controle + heartbeat em qualquer modo do publisher.
insertBefore(
  `  return sock;
}
`,
  `  scheduleInterval(
    () => {
      syncPublisherControlFromWeb(sock).catch(
        (error) => console.log(
          "⚠️ Sync painel:",
          error?.message || error
        )
      );
    },
    PUBLISHER_CONTROL_POLL_MS
  );

  scheduleInterval(
    () => {
      publishPublisherHeartbeat().catch(console.error);
    },
    PUBLISHER_HEARTBEAT_MS
  );

  publishPublisherHeartbeat().catch(console.error);

`,
  "return sock"
);

fs.writeFileSync(file, source, "utf8");

try {
  execFileSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });
} catch (error) {
  fs.copyFileSync(backup, file);
  console.error("A sintaxe falhou. O publisher original foi restaurado do backup.");
  process.exit(1);
}

console.log("✅ Publisher V2 aplicado com sucesso.");
console.log(`✅ Backup: ${backup}`);
