import fs from "node:fs";
import { execFileSync } from "node:child_process";

const apiFile = "api/admin.js";
const appFile = "admin/app.js";

for (const file of [apiFile, appFile]) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Não encontrei ${file}. Rode este instalador na raiz do projeto.`);
    process.exit(1);
  }
}

const originals = new Map([
  [apiFile, fs.readFileSync(apiFile, "utf8")],
  [appFile, fs.readFileSync(appFile, "utf8")]
]);

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`ℹ️ ${label} já aplicado.`);
    return source;
  }

  if (!source.includes(oldText)) {
    throw new Error(`Não encontrei o ponto de instalação: ${label}`);
  }

  console.log(`✅ ${label}`);
  return source.replace(oldText, newText);
}

try {
  // API: total realmente utilizável agora = available + reusable.
  let api = originals.get(apiFile);

  api = replaceOnce(
    api,
    `    perfumeAvailableCount,
    perfumeCooldownCount,
    perfumeReusableCount,
    perfumeReuseHours:
      perfumeReuseHours(),`,
    `    perfumeAvailableCount,
    perfumeCooldownCount,
    perfumeReusableCount,
    perfumeReadyNowCount:
      perfumeAvailableCount +
      perfumeReusableCount,
    perfumeReuseHours:
      perfumeReuseHours(),`,
    "API retorna perfumes prontos agora"
  );

  fs.writeFileSync(apiFile, api, "utf8");

  // Frontend: número principal mostra o que pode ser usado agora.
  let app = originals.get(appFile);

  app = replaceOnce(
    app,
    `    $("#perfumesCount").textContent=d.perfumeAvailableCount??0;
    $("#perfumesDetail").textContent=
      \`\${d.perfumeCooldownCount??0} cooldown · \${d.perfumeReusableCount??0} reutilizável\`;`,
    `    $("#perfumesCount").textContent=d.perfumeReadyNowCount??0;
    $("#perfumesDetail").textContent=
      \`\${d.perfumeAvailableCount??0} disponível · \${d.perfumeReusableCount??0} reutilizável · \${d.perfumeCooldownCount??0} cooldown\`;`
    ,
    "Card mostra perfumes realmente prontos"
  );

  fs.writeFileSync(appFile, app, "utf8");

  for (const file of [apiFile, appFile]) {
    execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
  }

  console.log("");
  console.log("✅ Hotfix V2.3.1 aplicado.");
  console.log("✅ O número do card Perfumes agora significa: pode ser usado agora.");
  console.log("✅ Disponíveis + reutilizáveis entram no total principal.");
  console.log("✅ Cooldown aparece apenas como detalhe.");
  console.log("");
  console.log("Agora rode: git status");
} catch (error) {
  console.error("");
  console.error("❌ Falha:", error?.message || error);
  console.error("↩️ Restaurando arquivos...");

  for (const [file, content] of originals.entries()) {
    fs.writeFileSync(file, content, "utf8");
  }

  console.error("✅ Arquivos restaurados.");
  process.exit(1);
}
