import fs from "node:fs";
import path from "node:path";

const target = path.resolve("whatsapp/publish-queue.js");

if (!fs.existsSync(target)) {
  console.error("ERRO: whatsapp/publish-queue.js não encontrado. Rode este script na raiz do projeto.");
  process.exit(1);
}

let src = fs.readFileSync(target, "utf8");

if (!src.includes("PERFUMES_SEMI_AUTO_RESERVE_ONLY_V2")) {
  console.error("ERRO: a alteração V2 não foi encontrada. Aplique primeiro a V2 que você já executou.");
  process.exit(1);
}

const backup = path.resolve("whatsapp/publish-queue.js.bak-before-perfumes-semi-auto-v3");
if (!fs.existsSync(backup)) {
  fs.copyFileSync(target, backup);
}

function replaceOnce(label, before, after) {
  const count = src.split(before).length - 1;
  if (count !== 1) {
    console.error(`ERRO: ${label}: esperado 1 trecho, encontrado ${count}. Nenhuma alteração foi salva.`);
    process.exit(1);
  }
  src = src.replace(before, after);
}

// 1) Quando uma descoberta for direcionada, gera link apenas para o mesmo grupo.
// Isso evita que DESCOBRIR ELETRONICOS/FITNESS pegue uma oferta pendente de Perfumes.
replaceOnce(
  "fillNextAffiliateLink direcionado",
`      await fillNextAffiliateLink(
        sock
      );`,
`      await fillNextAffiliateLink(
        sock,
        {
          group:
            group || null
        }
      );`
);

// 2) O comando genérico DESCOBRIR não pode mais chamar auto-discover global,
// pois o backend global também pode enfileirar Perfumes.
// Agora ele faz duas descobertas direcionadas: Eletrônicos e Fitness.
replaceOnce(
  "comando DESCOBRIR genérico",
`          if (
            isDiscoverCommand(
              text
            )
          ) {
            await triggerAutoDiscovery(
              sock
            );

            continue;
          }`,
`          if (
            isDiscoverCommand(
              text
            )
          ) {
            // PERFUMES_SEMI_AUTO_GENERIC_DISCOVERY_GUARD_V3
            // O comando genérico procura apenas os grupos 100% automáticos.
            await triggerAutoDiscovery(
              sock,
              {
                group:
                  "eletronicos"
              }
            );

            await triggerAutoDiscovery(
              sock,
              {
                group:
                  "fitness"
              }
            );

            continue;
          }`
);

fs.writeFileSync(target, src, "utf8");

console.log("");
console.log("OK: correção V3 aplicada em whatsapp/publish-queue.js");
console.log("Backup:", path.relative(process.cwd(), backup));
console.log("");
console.log("📱 Eletrônicos: AUTOMÁTICO");
console.log("💪 Fitness: AUTOMÁTICO");
console.log("🌸 Perfumes: SOMENTE RESERVA PERFUMES");
console.log("🔒 DESCOBRIR genérico: não enfileira mais Perfumes");
console.log("🔒 Descoberta direcionada: gera afiliado apenas do grupo solicitado");
console.log("");
console.log("Agora rode: node --check whatsapp/publish-queue.js");
