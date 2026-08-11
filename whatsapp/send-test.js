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

const TEST_MESSAGE = `🤖 *T&T Barateou*

Bot conectado com sucesso! ✅`;

const logger = P({ level: "silent" });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    console.log("\n✅ WhatsApp conectado.");
    console.log("🔎 Conferindo grupo antes do envio...");

    try {
      await wait(1000);

      const metadata =
        await sock.groupMetadata(TARGET_GROUP_JID);

      console.log(`Grupo encontrado: ${metadata.subject}`);
      console.log(`JID: ${metadata.id}`);

      if (metadata.id !== TARGET_GROUP_JID) {
        throw new Error("O JID encontrado não é o configurado.");
      }

      if (metadata.subject !== EXPECTED_GROUP_NAME) {
        throw new Error(
          `O nome do grupo mudou. Esperado: "${EXPECTED_GROUP_NAME}", encontrado: "${metadata.subject}". Nada foi enviado.`
        );
      }

      console.log("\n📤 Enviando UMA mensagem de teste...");

      const result = await sock.sendMessage(
        TARGET_GROUP_JID,
        { text: TEST_MESSAGE }
      );

      console.log("\n======================================");
      console.log("      T&T BARATEOU - ETAPA 6.3");
      console.log("======================================");
      console.log(`Destino: ${metadata.subject}`);
      console.log(`JID: ${metadata.id}`);
      console.log("✅ Mensagem enviada pelo Baileys.");
      console.log(`ID: ${result?.key?.id ?? "não informado"}`);
      console.log("======================================");
      console.log("\nMensagem:");
      console.log(TEST_MESSAGE);
      console.log("");

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
