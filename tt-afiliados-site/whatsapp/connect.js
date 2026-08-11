import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import P from "pino";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";

const AUTH_DIR = "./whatsapp/auth_info";

const logger = P({
  level: "silent"
});

let reconnecting = false;

function normalizePhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function askPhoneNumber() {
  const rl = readline.createInterface({ input, output });

  console.log("\n======================================");
  console.log("     T&T BARATEOU - WHATSAPP 6.1");
  console.log("======================================");
  console.log("\nDigite o número que será vinculado ao bot.");
  console.log("Use DDI + DDD + número, somente números.");
  console.log("Exemplo Brasil: 5548999999999");

  const answer = await rl.question("\nNúmero: ");
  rl.close();

  const phone = normalizePhoneNumber(answer);

  if (phone.length < 10) {
    throw new Error(
      "Número inválido. Use DDI + DDD + número, somente números."
    );
  }

  return phone;
}

async function listGroups(sock) {
  console.log("\nBuscando grupos do WhatsApp...");

  const groupsObject = await sock.groupFetchAllParticipating();
  const groups = Object.values(groupsObject || {})
    .sort((a, b) =>
      String(a.subject || "").localeCompare(
        String(b.subject || ""),
        "pt-BR"
      )
    );

  console.log("\n======================================");
  console.log(`       GRUPOS ENCONTRADOS: ${groups.length}`);
  console.log("======================================\n");

  if (!groups.length) {
    console.log("Nenhum grupo encontrado nessa conta.");
    return;
  }

  groups.forEach((group, index) => {
    console.log(`${index + 1}. ${group.subject || "(sem nome)"}`);
    console.log(`   JID: ${group.id}`);
    console.log(
      `   Participantes: ${group.participants?.length ?? "não informado"}`
    );

    if (group.announce) {
      console.log("   Modo: somente admins enviam mensagens");
    }

    console.log("");
  });

  console.log("======================================");
  console.log("✅ WhatsApp conectado e grupos listados.");
  console.log("======================================");
  console.log(
    "\nNão vamos enviar nenhuma mensagem nesta etapa."
  );
  console.log(
    "Anote o NOME e o JID do grupo T&T que vamos usar na Etapa 6.2."
  );
}

async function startWhatsApp() {
  const { state, saveCreds } =
    await useMultiFileAuthState(AUTH_DIR);

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    logger,
    browser: Browsers.windows("T&T Barateou"),
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on("creds.update", saveCreds);

  if (!state.creds.registered) {
    const phone = await askPhoneNumber();

    // Dá um instante para o socket abrir antes de pedir o código.
    await wait(1500);

    const pairingCode = await sock.requestPairingCode(phone);

    console.log("\n======================================");
    console.log("        CÓDIGO DE PAREAMENTO");
    console.log("======================================");
    console.log(`\n             ${pairingCode}\n`);
    console.log("No celular:");
    console.log("WhatsApp → Configurações → Aparelhos conectados");
    console.log("→ Conectar um aparelho → Conectar com número de telefone");
    console.log("→ Digite o código acima.");
    console.log("\nAguardando conexão...");
  } else {
    console.log(
      "\nSessão do WhatsApp encontrada. Tentando reconectar..."
    );
  }

  sock.ev.on("connection.update", async (update) => {
    const {
      connection,
      lastDisconnect
    } = update;

    if (connection === "open") {
      reconnecting = false;

      console.log("\n✅ WhatsApp conectado.");

      // Pequena espera para terminar sincronizações iniciais.
      await wait(2500);

      try {
        await listGroups(sock);
      } catch (error) {
        console.error(
          "\n❌ Conectou, mas não consegui listar os grupos:"
        );
        console.error(error.message);
      }

      return;
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.statusCode;

      const loggedOut =
        statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.error(
          "\n❌ A sessão foi desconectada do WhatsApp."
        );
        console.error(
          `Apague a pasta ${AUTH_DIR} e rode npm run whatsapp novamente.`
        );
        process.exitCode = 1;
        return;
      }

      if (!reconnecting) {
        reconnecting = true;
        console.log(
          "\nConexão fechada temporariamente. Reconectando..."
        );

        await wait(2000);
        startWhatsApp().catch((error) => {
          console.error("Erro ao reconectar:", error.message);
        });
      }
    }
  });
}

startWhatsApp().catch((error) => {
  console.error("\n❌ ERRO AO INICIAR O WHATSAPP");
  console.error(error.message);
  process.exitCode = 1;
});
