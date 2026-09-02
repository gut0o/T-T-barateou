import fs from "node:fs";

const files = [
  "whatsapp/publish-queue.js",
  "apply-painel-v2.mjs"
];

const oldValue =
  'new URL("/api/publisher-control", API_BASE).toString()';

const newValue =
  'new URL("/api/app-state?mode=publisher", API_BASE).toString()';

for (const file of files) {
  if (!fs.existsSync(file)) continue;

  let content = fs.readFileSync(file, "utf8");

  if (content.includes(oldValue)) {
    content = content.replaceAll(oldValue, newValue);
    fs.writeFileSync(file, content, "utf8");
    console.log(`✅ Endpoint ajustado em ${file}`);
  } else if (content.includes(newValue)) {
    console.log(`ℹ️ ${file} já estava ajustado.`);
  } else {
    console.log(`⚠️ Não encontrei o endpoint esperado em ${file}`);
  }
}

if (fs.existsSync("api/publisher-control.js")) {
  fs.unlinkSync("api/publisher-control.js");
  console.log("✅ api/publisher-control.js removido.");
}

console.log("");
console.log("✅ Hotfix Hobby aplicado.");
console.log("O controle do publisher agora reutiliza /api/app-state.");
