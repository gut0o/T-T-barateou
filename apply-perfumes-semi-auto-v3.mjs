import fs from "node:fs";
import path from "node:path";

const files = {
  publisher: path.resolve("whatsapp/publish-queue.js"),
  reserve: path.resolve("lib/tt-fallback-reserve-store.js"),
  pending: path.resolve("lib/tt-pending-publication-store.js"),
  admin: path.resolve("lib/tt-queue-admin-actions.js")
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    console.error(`ERRO: arquivo obrigatório não encontrado (${name}): ${path.relative(process.cwd(), file)}`);
    console.error("Rode este instalador na raiz do projeto T-T-barateou.");
    process.exit(1);
  }
}

const raw = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")])
);

const src = Object.fromEntries(
  Object.entries(raw).map(([key, value]) => [key, value.replace(/\r\n/g, "\n")])
);

if (src.publisher.includes("PERFUMES_CIRCULAR_V4")) {
  console.log("OK: a V4 circular já está aplicada. Nenhuma alteração necessária.");
  process.exit(0);
}

if (!src.publisher.includes("PERFUMES_SEMI_AUTO_RESERVE_ONLY_V2")) {
  console.error("ERRO: a V3 semi-automática não foi encontrada em whatsapp/publish-queue.js.");
  console.error("Aplique primeiro a V3 que você já estava usando.");
  process.exit(1);
}

function replaceOnce(text, label, before, after) {
  const count = text.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: esperado 1 trecho, encontrado ${count}.`);
  }
  return text.replace(before, after);
}

function insertBeforeOnce(text, label, marker, insertion) {
  const count = text.split(marker).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: marcador esperado 1 vez, encontrado ${count}.`);
  }
  return text.replace(marker, insertion + marker);
}

let publisher = src.publisher;
let reserve = src.reserve;
let pending = src.pending;
let admin = src.admin;

try {
  // ---------------------------------------------------------------------------
  // 1) PUBLISHER: mantém Perfumes sem descoberta e deixa claro o modo circular.
  // Também protege qualquer chamada genérica de triggerAutoDiscovery().
  // ---------------------------------------------------------------------------
  publisher = replaceOnce(
    publisher,
    "proteção global de descoberta",
`async function triggerAutoDiscovery(
  sock,
  {
    group = null
  } = {}
) {
  if (group === "perfumes") {`,
`async function triggerAutoDiscovery(
  sock,
  {
    group = null
  } = {}
) {
  // PERFUMES_CIRCULAR_V4
  // Qualquer descoberta genérica é dividida somente entre os dois grupos
  // 100% automáticos. Perfumes nunca entra por descoberta.
  if (!group) {
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

    return;
  }

  if (group === "perfumes") {`
  );

  publisher = replaceOnce(
    publisher,
    "texto de status da reserva",
`        "ℹ️ Eletrônicos/Fitness: reserva é fallback. Perfumes: reserva é a fila semi-automática principal."`,
`        "ℹ️ Eletrônicos/Fitness: reserva é fallback. Perfumes: fila circular semi-automática; links usados voltam após 4h."`
  );

  publisher = replaceOnce(
    publisher,
    "log de fila vazia",
`            \`\${meta.emoji} 🌸 Fila de perfumes vazia. Nenhum perfume será descoberto automaticamente.\``,
`            \`\${meta.emoji} 🌸 Sem perfume disponível agora (fila vazia ou links aguardando o intervalo de reuso). Nenhum perfume será descoberto automaticamente.\``
  );

  publisher = replaceOnce(
    publisher,
    "log de startup",
`              "🌸 Perfumes: SEMI-AUTOMÁTICO | fila via RESERVA PERFUMES | sem descoberta automática"`,
`              "🌸 Perfumes: SEMI-AUTOMÁTICO CIRCULAR | RESERVA PERFUMES | reuso padrão 4h | sem descoberta automática"`
  );

  // ---------------------------------------------------------------------------
  // 2) BANCO DE RESERVA:
  // - Perfumes usados contam como duplicata para não criar cópias.
  // - Quando não há mais available, recicla o usado mais antigo após 4h.
  // - TT_PERFUME_REUSE_HOURS pode mudar o intervalo sem alterar código.
  // ---------------------------------------------------------------------------
  reserve = replaceOnce(
    reserve,
    "dedupe de perfumes usados",
`  const filters = [
    \`group_name=eq.\${encodeURIComponent(group)}\`,
    "status=in.(available,claimed,queued)",
    "select=*",`,
`  const activeStatusFilter =
    group === "perfumes"
      ? "status=in.(available,claimed,queued,used)"
      : "status=in.(available,claimed,queued)";

  const filters = [
    \`group_name=eq.\${encodeURIComponent(group)}\`,
    activeStatusFilter,
    "select=*",`
  );

  reserve = replaceOnce(
    reserve,
    "resumo incluindo perfumes em cooldown",
'    `${TABLE}?status=in.(available,claimed,queued)&select=id,group_name,status&order=added_at.asc&limit=5000`',
'    `${TABLE}?status=in.(available,claimed,queued,used)&select=id,group_name,status&order=added_at.asc&limit=5000`'
  );

  reserve = insertBeforeOnce(
    reserve,
    "helpers de fila circular",
`export async function claimNextFallbackReserve(group) {`,
`// PERFUMES_CIRCULAR_V4
function perfumeReuseCooldownMs() {
  const hours = Math.min(
    Math.max(
      Number(process.env.TT_PERFUME_REUSE_HOURS || 4) || 4,
      1
    ),
    24
  );

  return hours * 60 * 60 * 1000;
}

async function recycleNextEligibleUsedPerfume() {
  const cutoff = new Date(
    Date.now() - perfumeReuseCooldownMs()
  ).toISOString();

  const { payload } = await supabaseRequest(
    \`\${TABLE}?group_name=eq.perfumes\` +
      "&status=eq.used" +
      \`&used_at=lte.\${encodeURIComponent(cutoff)}\` +
      "&select=*" +
      "&order=used_at.asc" +
      "&limit=10"
  );

  const rows = Array.isArray(payload) ? payload : [];

  for (const row of rows) {
    const now = new Date().toISOString();

    // PATCH condicional: se outra instância já reciclou, esta não pega o mesmo.
    const recycled = await supabaseRequest(
      \`\${TABLE}?id=eq.\${encodeURIComponent(row.id)}&status=eq.used\`,
      {
        method: "PATCH",
        body: {
          status: "available",
          current_item_id: null,
          claimed_at: null,
          queued_at: null,
          failure_reason: null,
          last_checked_at: now,
          updated_at: now
        },
        prefer: "return=representation"
      }
    );

    if (Array.isArray(recycled.payload) && recycled.payload.length) {
      return rowToReserve(recycled.payload[0]);
    }
  }

  return null;
}

`
  );

  reserve = replaceOnce(
    reserve,
    "reciclagem quando available acaba",
`    if (!listed.entries.length) return null;`,
`    if (!listed.entries.length) {
      if (safeGroup === "perfumes") {
        const recycled = await recycleNextEligibleUsedPerfume();

        if (recycled) {
          // Recomeça a fila pelo perfume usado há mais tempo.
          continue;
        }
      }

      return null;
    }`
  );

  // ---------------------------------------------------------------------------
  // 3) FILA DE PUBLICAÇÃO:
  // cria um caminho EXCLUSIVO para a reserva circular de Perfumes.
  // O bloqueio normal de 30 dias continua intacto para Eletrônicos/Fitness.
  // ---------------------------------------------------------------------------
  pending = insertBeforeOnce(
    pending,
    "função de republicação circular",
`export async function queuePendingPublications(
`,
`// PERFUMES_CIRCULAR_V4
// Republicação especial usada SOMENTE pela RESERVA PERFUMES.
// Não altera a regra geral de 30 dias de Eletrônicos/Fitness.
export async function queueCircularReservePublication(
  candidate
) {
  requireSupabaseConfiguration();

  const itemId = safeItemId(candidate?.itemId);
  const productId = safeProductId(candidate?.productId);

  if (!itemId) {
    throw new Error(
      "Não é possível republicar perfume sem itemId válido."
    );
  }

  const existing =
    (
      productId
        ? await fetchOneByProductId(productId)
        : null
    ) ||
    await fetchOneByItemId(itemId);

  // Primeira passagem do perfume: usa o fluxo normal.
  if (!existing) {
    return queueOne(candidate);
  }

  // Segurança: só revive uma publicação que já terminou como sent.
  // Se ainda estiver ativa, não cria uma segunda cópia.
  if (existing.status !== "sent") {
    return {
      itemId,
      productId,
      queued: true,
      alreadyQueued: true,
      requeued: false,
      circularReuse: false,
      dedupeBy: productId ? "productId" : "itemId",
      existingItemId: existing.item_id || null,
      existingStatus: existing.status || null,
      pathname: pathnameFor(existing.item_id),
      uploadedAt: null
    };
  }

  const now = new Date().toISOString();
  const previousEnvelope = rowEnvelope(existing);
  const previousSentAt =
    existing.sent_at ||
    previousEnvelope?.data?.delivery?.sentAt ||
    null;

  const finalProductId =
    productId ||
    safeProductId(existing.product_id);

  const envelope = {
    version: 1,
    status: "awaiting_affiliate_link",
    queuedAt: now,
    updatedAt: now,
    source: "tt_perfume_circular_reserve",
    data: {
      ...candidate,
      affiliateLink: null,
      affiliateLinkStatus: "pending",
      publicationStatus: "awaiting_affiliate_link",
      retryCount: 0,
      delivery: null,
      republish: {
        previousSentAt,
        changes: [
          "perfume_circular_reuse"
        ],
        requeuedAt: now,
        cooldownHours:
          Number(process.env.TT_PERFUME_REUSE_HOURS || 4) || 4
      }
    }
  };

  const lookup =
    finalProductId
      ? \`product_id=eq.\${encodeURIComponent(finalProductId)}\`
      : \`item_id=eq.\${encodeURIComponent(existing.item_id)}\`;

  const { payload } = await supabaseRequest(
    \`\${TABLE}?\${lookup}\`,
    {
      method: "PATCH",
      body: {
        item_id: itemId,
        product_id: finalProductId,
        tt_category_id:
          candidate?.ttCategoryId ||
          existing.tt_category_id ||
          null,
        status: "awaiting_affiliate_link",
        priority: null,
        score: null,
        title: candidate?.title || existing.title || null,
        affiliate_url: null,
        payload: envelope,
        queued_at: now,
        updated_at: now,
        sent_at: previousSentAt
      },
      prefer: "return=representation"
    }
  );

  const revived =
    Array.isArray(payload) && payload.length
      ? payload[0]
      : null;

  if (!revived) {
    throw new Error(
      "Não consegui reativar o perfume circular na fila."
    );
  }

  return {
    itemId,
    productId: finalProductId,
    queued: true,
    alreadyQueued: false,
    requeued: true,
    circularReuse: true,
    dedupeBy: null,
    existingItemId: existing.item_id || null,
    existingStatus: existing.status || null,
    pathname: pathnameFor(revived.item_id),
    uploadedAt: now
  };
}

`
  );

  // ---------------------------------------------------------------------------
  // 4) ADMIN/API: somente Perfumes usa a republicação circular.
  // ---------------------------------------------------------------------------
  admin = replaceOnce(
    admin,
    "import queueCircularReservePublication",
`  markPublicationAffiliateReady,
  queuePendingPublications,
  repairPublicationQueueDuplicates,`,
`  markPublicationAffiliateReady,
  queueCircularReservePublication,
  queuePendingPublications,
  repairPublicationQueueDuplicates,`
  );

  admin = replaceOnce(
    admin,
    "materialização circular de perfumes",
`      const ready = plan.ready[0];
      const queueResult = await queuePendingPublications([ready]);
      const queueOutcome = queueResult.results?.[0] || null;`,
`      const ready = plan.ready[0];

      const queueOutcome =
        group === "perfumes"
          ? await queueCircularReservePublication(ready)
          : (
              await queuePendingPublications([ready])
            ).results?.[0] || null;`
  );

} catch (error) {
  console.error("");
  console.error("ERRO: nenhuma alteração V4 foi salva.");
  console.error(error?.message || error);
  process.exit(1);
}

// Backups apenas na primeira aplicação.
for (const [key, file] of Object.entries(files)) {
  const backup = `${file}.bak-before-perfumes-circular-v4`;
  if (!fs.existsSync(backup)) {
    fs.writeFileSync(backup, raw[key], "utf8");
  }
}

// Só grava depois de TODAS as transformações terem passado.
fs.writeFileSync(files.publisher, publisher, "utf8");
fs.writeFileSync(files.reserve, reserve, "utf8");
fs.writeFileSync(files.pending, pending, "utf8");
fs.writeFileSync(files.admin, admin, "utf8");

console.log("");
console.log("OK: V4 circular aplicada.");
console.log("");
console.log("📱 Eletrônicos: AUTOMÁTICO (regra normal de 30 dias)");
console.log("💪 Fitness: AUTOMÁTICO (regra normal de 30 dias)");
console.log("🌸 Perfumes: SOMENTE RESERVA PERFUMES");
console.log("🔁 Perfumes: fila circular");
console.log("⏱️ Reuso de perfume: 4h por padrão");
console.log("🔄 Ao reutilizar: reabre anúncio, atualiza dados e gera novo meli.la");
console.log("🚫 Perfumes continuam sem descoberta automática");
console.log("");
console.log("Arquivos alterados:");
console.log("  whatsapp/publish-queue.js");
console.log("  lib/tt-fallback-reserve-store.js");
console.log("  lib/tt-pending-publication-store.js");
console.log("  lib/tt-queue-admin-actions.js");
console.log("");
console.log("Agora valide com:");
console.log("  node --check whatsapp/publish-queue.js");
console.log("  node --check lib/tt-fallback-reserve-store.js");
console.log("  node --check lib/tt-pending-publication-store.js");
console.log("  node --check lib/tt-queue-admin-actions.js");
