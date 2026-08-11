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

  sock.ev.on("connection.update", async ({ connection }) => {
    if (connection !== "open") return;

    console.log("\n✅ WhatsApp conectado.");
    console.log("🔎 Confirmando grupo de destino...");

    await wait(1200);

    try {
      const metadata = await sock.groupMetadata(TARGET_GROUP_JID);

      console.log("\n======================================");
      console.log("      T&T BARATEOU - ETAPA 6.2");
      console.log("======================================");
      console.log(`Grupo: ${metadata.subject}`);
      console.log(`JID: ${metadata.id}`);
      console.log(
        `Participantes: ${metadata.participants?.length ?? "não informado"}`
      );
      console.log(
        `Somente admins enviam: ${metadata.announce ? "SIM" : "NÃO"}`
      );
      console.log("======================================");
      console.log("✅ Grupo de destino confirmado.");
      console.log("🚫 Nenhuma mensagem foi enviada.");
      console.log("======================================\n");

      setTimeout(() => process.exit(0), 500);
    } catch (error) {
      console.error("\n❌ Não consegui acessar o grupo.");
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
