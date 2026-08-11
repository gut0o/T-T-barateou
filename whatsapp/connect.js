import path from "node:path";
import { fileURLToPath } from "node:url";

import P from "pino";
import qrcode from "qrcode-terminal";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sempre usa a pasta ao lado deste arquivo, independentemente
// da pasta de onde o comando node foi executado.
const AUTH_DIR = path.join(__dirname, "auth_info");

const logger = P({ level: "silent" });

let starting = false;
let groupsListed = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listGroups(sock) {
  if (groupsListed) return;
  groupsListed = true;

  console.log("\nBuscando grupos do WhatsApp...");

  const groupsObject = await sock.groupFetchAllParticipating();
  const groups = Object.values(groupsObject || {}).sort((a, b) =>
    String(a.subject || "").localeCompare(
      String(b.subject || ""),
      "pt-BR"
    )
  );

  console.log("\n======================================");
  console.log(`       GRUPOS ENCONTRADOS: ${groups.length}`);
  console.log("======================================\n");

  groups.forEach((group, index) => {
    console.log(`${index + 1}. ${group.subject || "(sem nome)"}`);
    console.log(`   JID: ${group.id}`);
    console.log(
      `   Participantes: ${group.participants?.length ?? "não informado"}`
    );
    console.log("");
  });

  console.log("======================================");
  console.log("✅ WhatsApp conectado e grupos listados.");
  console.log("🚫 Nenhuma mensagem foi enviada.");
  console.log("======================================\n");
}

async function startWhatsApp() {
  if (starting) return;
  starting = true;

  try {
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

    // O Baileys dispara este evento quando as credenciais mudam.
    sock.ev.on("creds.update", async () => {
      try {
        await saveCreds();
      } catch (error) {
        console.error(
          "\n❌ Erro ao salvar a sessão:",
          error.message
        );
      }
    });

    sock.ev.on("connection.update", async (update) => {
      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      if (qr && !sock.authState.creds.registered) {
        console.clear();
        console.log("======================================");
        console.log("      T&T BARATEOU - WHATSAPP");
        console.log("======================================");
        console.log("\nEscaneie o QR Code abaixo:\n");

        qrcode.generate(qr, { small: true });

        console.log("\nNo celular:");
        console.log(
          "WhatsApp → Configurações → Aparelhos conectados"
        );
        console.log(
          "→ Conectar um aparelho → escaneie o QR acima."
        );
        console.log("\nAguardando conexão...");
      }

      if (connection === "open") {
        starting = false;

        // Garante uma gravação final da sessão atual.
        await saveCreds();

        console.log("\n✅ WhatsApp conectado!");
        console.log(
          `💾 Sessão registrada: ${
            sock.authState.creds.registered ? "SIM" : "NÃO"
          }`
        );
        console.log(`💾 Sessão salva em: ${AUTH_DIR}`);

        await wait(3000);

        try {
          await listGroups(sock);
        } catch (error) {
          groupsListed = false;
          console.error(
            "\n❌ Conectou, mas não consegui listar os grupos:"
          );
          console.error(error.message);
        }

        return;
      }

      if (connection === "close") {
        starting = false;

        const statusCode =
          lastDisconnect?.error?.output?.statusCode ||
          lastDisconnect?.error?.statusCode;

        // Depois de escanear um QR, o WhatsApp normalmente pede
        // que o socket seja recriado usando as novas credenciais.
        if (statusCode === DisconnectReason.restartRequired) {
          console.log(
            "\n🔄 Pareamento recebido. Reiniciando o socket..."
          );
          await wait(1000);
          return startWhatsApp();
        }

        if (statusCode === DisconnectReason.loggedOut) {
          console.error(
            "\n❌ O WhatsApp informou que a sessão foi desconectada."
          );
          console.error(
            "Será necessário fazer um novo pareamento."
          );
          return;
        }

        console.log(
          `\n🔄 Conexão fechada (${statusCode ?? "sem código"}). Reconectando...`
        );

        await wait(2000);
        return startWhatsApp();
      }
    });
  } catch (error) {
    starting = false;
    console.error("\n❌ ERRO AO INICIAR");
    console.error(error.message);
  }
}

startWhatsApp();
