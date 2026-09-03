import fs from "node:fs";
import { execFileSync } from "node:child_process";

const files = [
  "whatsapp/ml-affiliate-link.js",
  "whatsapp/publish-queue.js",
  "lib/tt-publication-planner.js",
  "lib/tt-pending-publication-store.js",
  "lib/tt-queue-admin-actions.js",
  "api/admin.js",
  "admin/index.html",
  "admin/app.js"
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Não encontrei ${file}. Rode este instalador na raiz do projeto.`);
    process.exit(1);
  }
}

const originals = new Map(
  files.map((file) => [file, fs.readFileSync(file, "utf8")])
);

function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

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

function insertBefore(source, anchor, content, label) {
  if (source.includes(content.trim())) {
    console.log(`ℹ️ ${label} já aplicado.`);
    return source;
  }

  const index = source.indexOf(anchor);
  if (index < 0) {
    throw new Error(`Não encontrei o ponto de instalação: ${label}`);
  }

  console.log(`✅ ${label}`);
  return source.slice(0, index) + content + source.slice(index);
}

function replaceInSection(source, startAnchor, endAnchor, oldText, newText, label) {
  const start = source.indexOf(startAnchor);
  const end = source.indexOf(endAnchor, start + startAnchor.length);

  if (start < 0 || end < 0) {
    throw new Error(`Não encontrei a seção: ${label}`);
  }

  const section = source.slice(start, end);

  if (section.includes(newText)) {
    console.log(`ℹ️ ${label} já aplicado.`);
    return source;
  }

  if (!section.includes(oldText)) {
    throw new Error(`Não encontrei o trecho na seção: ${label}`);
  }

  const patched = section.replace(oldText, newText);
  console.log(`✅ ${label}`);
  return source.slice(0, start) + patched + source.slice(end);
}

try {
  // =========================================================================
  // 1) FALLBACK DE URL PARA O GERADOR DE AFILIADOS
  // =========================================================================
  {
    const file = "whatsapp/ml-affiliate-link.js";
    let s = originals.get(file);

    const helper = `
function itemListingUrl(
  itemId
) {
  const safe =
    String(
      itemId ||
      ""
    )
      .trim()
      .toUpperCase();

  if (
    !/^MLB\\d+$/.test(
      safe
    )
  ) {
    return null;
  }

  const dashed =
    safe.replace(
      /^MLB/,
      "MLB-"
    );

  return (
    "https://produto.mercadolivre.com.br/" +
    dashed +
    "-_JM"
  );
}


`;

    s = insertBefore(
      s,
      "function initialCatalogUrl({",
      helper,
      "Fallback por itemId no afiliado"
    );

    s = replaceOnce(
      s,
      `function initialCatalogUrl({
  productId,
  catalogPageUrl
}) {`,
      `function initialCatalogUrl({
  itemId,
  productId,
  catalogPageUrl
}) {`,
      "initialCatalogUrl aceita itemId"
    );

    s = replaceOnce(
      s,
      `      catalogPageUrl ||
      (
        productId
          ? \`https://www.mercadolivre.com.br/p/\${productId}\`
          : ""
      )`,
      `      catalogPageUrl ||
      (
        productId
          ? \`https://www.mercadolivre.com.br/p/\${productId}\`
          : itemListingUrl(
              itemId
            )
      )`,
      "URL de anúncio como fallback"
    );

    s = replaceOnce(
      s,
      `async function resolveCanonicalProductUrl({
  productId,
  catalogPageUrl
}) {`,
      `async function resolveCanonicalProductUrl({
  itemId,
  productId,
  catalogPageUrl
}) {`,
      "Resolução canônica aceita itemId"
    );

    s = replaceOnce(
      s,
      `    initialCatalogUrl({
      productId,
      catalogPageUrl
    });`,
      `    initialCatalogUrl({
      itemId,
      productId,
      catalogPageUrl
    });`,
      "Resolução inicial usa itemId"
    );

    s = replaceOnce(
      s,
      `    await resolveCanonicalProductUrl({
      productId,
      catalogPageUrl
    });`,
      `    await resolveCanonicalProductUrl({
      itemId:
        safeItemId,
      productId,
      catalogPageUrl
    });`,
      "CreateLink resolve anúncio por itemId"
    );

    // A segunda chamada de initialCatalogUrl dentro de createAffiliateLink.
    const secondOld = `    initialCatalogUrl({
      productId,
      catalogPageUrl
    });`;
    const secondNew = `    initialCatalogUrl({
      itemId:
        safeItemId,
      productId,
      catalogPageUrl
    });`;
    if (s.includes(secondOld)) {
      s = s.replace(secondOld, secondNew);
      console.log("✅ CreateLink monta fallback por itemId");
    }

    s = replaceOnce(
      s,
      `      initial,

      productId`,
      `      initial,

      itemListingUrl(
        safeItemId
      ),

      productId`,
      "CreateLink tenta URL do anúncio"
    );

    write(file, s);
  }

  // =========================================================================
  // 2) PROPAGA PRIORIDADE MANUAL PELO PLANNER
  // =========================================================================
  {
    const file = "lib/tt-publication-planner.js";
    let s = originals.get(file);

    s = replaceOnce(
      s,
      `    affiliateLinkStatus:
      "pending",

    itemId:`,
      `    affiliateLinkStatus:
      "pending",

    priority:
      candidate.priority ||
      null,

    source:
      candidate.source ||
      null,

    manualPanel:
      candidate.manualPanel ===
      true,

    itemId:`,
      "Planner preserva prioridade manual"
    );

    write(file, s);
  }

  // =========================================================================
  // 3) FILA: expõe prioridade e repara links não afiliados antigos
  // =========================================================================
  {
    const file = "lib/tt-pending-publication-store.js";
    let s = originals.get(file);

    s = replaceOnce(
      s,
      `    publicationStatus:
      data.publicationStatus ||
      row.status ||
      null,

    messageDraft:`,
      `    publicationStatus:
      data.publicationStatus ||
      row.status ||
      null,

    priority:
      data.priority ||
      row.priority ||
      null,

    source:
      data.source ||
      envelope.source ||
      null,

    manualPanel:
      data.manualPanel ===
        true,

    messageDraft:`,
      "Fila expõe prioridade manual"
    );

    const repairFn = `
export async function repairUnsafeReadyAffiliateLinks() {
  requireSupabaseConfiguration();

  const {
    payload
  } =
    await supabaseRequest(
      \`\${TABLE}?status=eq.ready_to_publish&select=*&order=queued_at.asc&limit=100\`
    );

  const rows =
    Array.isArray(
      payload
    )
      ? payload
      : [];

  let repairedCount =
    0;

  const repaired =
    [];

  for (
    const row of
    rows
  ) {
    const envelope =
      rowEnvelope(
        row
      );

    const data =
      envelope.data ||
      {};

    const affiliateLink =
      String(
        row.affiliate_url ||
        data.affiliateLink ||
        ""
      ).trim();

    if (
      /^https:\\/\\/meli\\.la\\//i.test(
        affiliateLink
      )
    ) {
      continue;
    }

    const looksLikeOldPanelLink =
      /mercadolivre\\.com\\.br/i.test(
        affiliateLink
      );

    const oldDraft =
      String(
        data.messageDraft ||
        ""
      );

    let pendingDraft =
      oldDraft;

    if (
      affiliateLink &&
      pendingDraft.includes(
        affiliateLink
      )
    ) {
      pendingDraft =
        pendingDraft.replace(
          affiliateLink,
          "[LINK_AFILIADO_PENDENTE]"
        );
    }

    if (
      !pendingDraft.includes(
        "[LINK_AFILIADO_PENDENTE]"
      )
    ) {
      pendingDraft =
        pendingDraft
          ? (
              pendingDraft +
              "\\n\\n👇 Comprar no Mercado Livre:\\n[LINK_AFILIADO_PENDENTE]"
            )
          : "[LINK_AFILIADO_PENDENTE]";
    }

    const now =
      new Date()
        .toISOString();

    const nextPriority =
      looksLikeOldPanelLink
        ? "manual_panel"
        : (
            data.priority ||
            row.priority ||
            null
          );

    const updatedEnvelope = {
      ...envelope,

      status:
        "awaiting_affiliate_link",

      updatedAt:
        now,

      source:
        looksLikeOldPanelLink
          ? "tt_panel_manual_migrated"
          : envelope.source,

      data: {
        ...data,

        priority:
          nextPriority,

        source:
          looksLikeOldPanelLink
            ? "tt_panel_manual"
            : (
                data.source ||
                null
              ),

        manualPanel:
          looksLikeOldPanelLink ||
          data.manualPanel === true,

        affiliateLink:
          null,

        affiliateLinkStatus:
          "pending",

        publicationStatus:
          "awaiting_affiliate_link",

        messageDraft:
          pendingDraft,

        whatsappPayload:
          null
      }
    };

    await updateRowByItemId(
      row.item_id,
      {
        status:
          "awaiting_affiliate_link",

        priority:
          nextPriority,

        affiliate_url:
          null,

        payload:
          updatedEnvelope,

        updated_at:
          now
      }
    );

    repairedCount +=
      1;

    repaired.push({
      itemId:
        row.item_id,

      previousLinkType:
        looksLikeOldPanelLink
          ? "mercado_livre_normal"
          : "missing_or_unknown"
    });
  }

  return {
    scannedCount:
      rows.length,

    repairedCount,

    repaired
  };
}


`;

    s = insertBefore(
      s,
      "export async function repairPublicationQueueDuplicates() {",
      repairFn,
      "Reparo de links prontos sem meli.la"
    );

    write(file, s);
  }

  // =========================================================================
  // 4) AÇÕES: produto do painel entra pendente e com prioridade
  // =========================================================================
  {
    const file = "lib/tt-queue-admin-actions.js";
    let s = originals.get(file);

    s = replaceOnce(
      s,
      `  queuePendingPublications,
  repairPublicationQueueDuplicates,`,
      `  queuePendingPublications,
  repairPublicationQueueDuplicates,
  repairUnsafeReadyAffiliateLinks,`,
      "Import do reparo de afiliados"
    );

    s = replaceOnce(
      s,
      `  let dedupe = null;

  // TRAVA FINAL:`,
      `  let dedupe = null;
  let unsafeAffiliateRepair = null;

  // TRAVA FINAL:`,
      "Estado do reparo na listagem"
    );

    s = replaceOnce(
      s,
      `  if (
    status ===
    "ready_to_publish"
  ) {
    dedupe =
      await repairPublicationQueueDuplicates();
  }`,
      `  if (
    status ===
    "ready_to_publish"
  ) {
    unsafeAffiliateRepair =
      await repairUnsafeReadyAffiliateLinks();

    dedupe =
      await repairPublicationQueueDuplicates();
  }`,
      "Repara link normal antes de publicar"
    );

    s = replaceOnce(
      s,
      `    dedupe,

    queue:`,
      `    dedupe,

    unsafeAffiliateRepair,

    queue:`,
      "Retorna diagnóstico de reparo"
    );

    s = replaceOnce(
      s,
      `    title:
      offer.title ||
      null,

    image:`,
      `    title:
      offer.title ||
      null,

    catalogPageUrl:
      offer.catalogPageUrl ||
      offer.permalink ||
      offer.url ||
      null,

    sellerId:
      offer.sellerId ??
      offer.seller_id ??
      null,

    image:`,
      "Ingestão preserva URL e seller"
    );

    s = replaceOnce(
      s,
      `async function ingestResolvedAffiliateOffer({
  affiliateLink,
  offer
}) {
  const candidate =
    offerToShortlistCandidate(
      offer
    );`,
      `async function ingestResolvedAffiliateOffer({
  affiliateLink,
  offer,
  manualPanel = false
}) {
  const candidate = {
    ...offerToShortlistCandidate(
      offer
    ),

    priority:
      manualPanel
        ? "manual_panel"
        : null,

    source:
      manualPanel
        ? "tt_panel_manual"
        : null,

    manualPanel:
      manualPanel === true
  };`,
      "Ingestão recebe modo painel"
    );

    const manualReturn = `
  if (
    manualPanel
  ) {
    const queueInfo =
      queueResult
        .results?.[0] ||
      null;

    if (
      queueInfo?.alreadyQueued === true &&
      ["sent", "rejected"].includes(
        String(
          queueInfo.existingStatus ||
          ""
        )
      )
    ) {
      return {
        affiliateLink,
        status:
          "held",
        queued:
          false,
        alreadyQueued:
          true,
        itemId:
          offer.itemId ||
          null,
        productId:
          offer.productId ||
          null,
        title:
          offer.title ||
          null,
        price:
          offer.price ??
          null,
        ttCategoryId:
          offer.ttCategoryId ||
          null,
        ttCategoryName:
          offer.ttCategoryName ||
          null,
        heldReason:
          "already_sent_or_closed_by_current_rules"
      };
    }

    return {
      affiliateLink,
      status:
        "awaiting_affiliate_link",
      queued:
        true,
      alreadyQueued:
        queueInfo
          ?.alreadyQueued ===
          true,
      priority:
        "manual_panel",
      itemId:
        offer.itemId ||
        null,
      productId:
        offer.productId ||
        null,
      title:
        offer.title ||
        null,
      price:
        offer.price ??
        null,
      ttCategoryId:
        offer.ttCategoryId ||
        null,
      ttCategoryName:
        offer.ttCategoryName ||
        null,
      publicationStatus:
        "awaiting_affiliate_link",
      affiliateLinkStatus:
        "pending_local_generation",
      message:
        "Na fila com prioridade. O publisher da VPS vai gerar e validar o meli.la antes do envio."
    };
  }

`;

    s = replaceInSection(
      s,
      "async function ingestResolvedAffiliateOffer(",
      "export async function handleIngestAffiliateLinksAction(",
      `  const updated =
    await markPublicationAffiliateReady({`,
      manualReturn + `  const updated =
    await markPublicationAffiliateReady({`,
      "Painel não reutiliza link normal como afiliado"
    );

    s = replaceOnce(
      s,
      `  const links =
    normalizeAffiliateLinks(
      body
    );`,
      `  const links =
    normalizeAffiliateLinks(
      body
    );

  const manualPanel =
    body.manualPanel ===
      true;`,
      "Lê flag manualPanel"
    );

    s = replaceOnce(
      s,
      `        await ingestResolvedAffiliateOffer({
          affiliateLink,

          offer:
            resolved.offer
        })`,
      `        await ingestResolvedAffiliateOffer({
          affiliateLink,

          offer:
            resolved.offer,

          manualPanel
        })`,
      "Propaga manualPanel"
    );

    s = replaceOnce(
      s,
      `  const held =
    results.filter(
      (item) =>
        item.status ===
        "held"
    );

  const failed =`,
      `  const held =
    results.filter(
      (item) =>
        item.status ===
        "held"
    );

  const pending =
    results.filter(
      (item) =>
        item.status ===
        "awaiting_affiliate_link"
    );

  const failed =`,
      "Conta pendentes de afiliado"
    );

    s = replaceOnce(
      s,
      `        item.status !==
          "ready_to_publish" &&
        item.status !==
          "held"`,
      `        item.status !==
          "ready_to_publish" &&
        item.status !==
          "held" &&
        item.status !==
          "awaiting_affiliate_link"`,
      "Pendente não conta como falha"
    );

    s = replaceOnce(
      s,
      `    heldCount:
      held.length,

    failedCount:`,
      `    heldCount:
      held.length,

    pendingCount:
      pending.length,

    failedCount:`,
      "Retorna pendingCount"
    );

    s = replaceOnce(
      s,
      `      priorityEnabled:
        false,`,
      `      priorityEnabled:
        manualPanel,`,
      "Política informa prioridade"
    );

    write(file, s);
  }

  // =========================================================================
  // 5) API ADMIN: prioridade manual + cooldown dos perfumes
  // =========================================================================
  {
    const file = "api/admin.js";
    let s = originals.get(file);

    const perfumeHelpers = `
function perfumeReuseHours() {
  return Math.min(
    Math.max(
      Number(
        process.env.TT_PERFUME_REUSE_HOURS ||
        4
      ) || 4,
      1
    ),
    24
  );
}

async function perfumeUsedEntries(req) {
  const result =
    await handleReserveListAction(
      adminRequest(req, {
        query: {
          group:
            "perfumes",
          status:
            "used",
          limit:
            100
        }
      })
    );

  const cooldownMs =
    perfumeReuseHours() *
    60 *
    60 *
    1000;

  const now =
    Date.now();

  return reserveEntries(
    result
  ).map(
    (entry) => {
      const usedMs =
        entry?.usedAt
          ? Date.parse(
              entry.usedAt
            )
          : NaN;

      const reuseAvailableAt =
        Number.isFinite(
          usedMs
        )
          ? new Date(
              usedMs +
              cooldownMs
            ).toISOString()
          : null;

      const reuseRemainingMs =
        reuseAvailableAt
          ? Math.max(
              0,
              Date.parse(
                reuseAvailableAt
              ) -
              now
            )
          : null;

      return {
        ...entry,

        reusable:
          reuseRemainingMs ===
          0,

        reuseRemainingMs,

        reuseAvailableAt
      };
    }
  );
}


`;

    s = insertBefore(
      s,
      "function publisherView(control, runtime) {",
      perfumeHelpers,
      "Helpers de cooldown dos perfumes"
    );

    s = replaceOnce(
      s,
      `  let perfumeAvailableCount = 0;

  try {`,
      `  let perfumeAvailableCount = 0;
  let perfumeCooldownCount = 0;
  let perfumeReusableCount = 0;

  try {`,
      "Contadores de cooldown"
    );

    s = replaceOnce(
      s,
      `  } catch {
    perfumeAvailableCount = 0;
  }

  return {`,
      `  } catch {
    perfumeAvailableCount = 0;
  }

  try {
    const used =
      await perfumeUsedEntries(
        req
      );

    perfumeCooldownCount =
      used.filter(
        (entry) =>
          entry.reusable !==
          true
      ).length;

    perfumeReusableCount =
      used.filter(
        (entry) =>
          entry.reusable ===
          true
      ).length;
  } catch {
    perfumeCooldownCount = 0;
    perfumeReusableCount = 0;
  }

  return {`,
      "Calcula cooldown no dashboard"
    );

    s = replaceOnce(
      s,
      `    perfumeAvailableCount,
    publisher:`,
      `    perfumeAvailableCount,
    perfumeCooldownCount,
    perfumeReusableCount,
    perfumeReuseHours:
      perfumeReuseHours(),
    publisher:`,
      "Dashboard retorna cooldown"
    );

    s = replaceOnce(
      s,
      `          body: {
            affiliateLinks: batch
          }`,
      `          body: {
            affiliateLinks: batch,
            manualPanel: true
          }`,
      "Produto do painel usa prioridade manual"
    );

    s = replaceOnce(
      s,
      `    heldCount: results.reduce(
      (sum, item) => sum + Number(item.heldCount || 0),
      0
    ),
    failedCount:`,
      `    heldCount: results.reduce(
      (sum, item) => sum + Number(item.heldCount || 0),
      0
    ),
    pendingCount: results.reduce(
      (sum, item) => sum + Number(item.pendingCount || 0),
      0
    ),
    failedCount:`,
      "API agrega pendingCount"
    );

    const specialReserve = `      if (
        status === "cooldown" ||
        status === "reusable"
      ) {
        const used =
          await perfumeUsedEntries(
            req
          );

        const entries =
          used
            .filter(
              (entry) =>
                status ===
                  "reusable"
                  ? entry.reusable === true
                  : entry.reusable !== true
            )
            .map(
              (entry) => ({
                ...entry,
                panelStatus:
                  status
              })
            );

        return res.status(200).json({
          ok: true,
          action:
            "reserve-list",
          reserve:
            entries,
          reserveMeta: {
            count:
              entries.length,
            group:
              "perfumes",
            status,
            reuseHours:
              perfumeReuseHours()
          }
        });
      }

`;

    s = replaceInSection(
      s,
      `    if (action === "reserve-list") {`,
      `    if (action === "publisher-control") {`,
      `      const result = await handleReserveListAction(`,
      specialReserve + `      const result = await handleReserveListAction(`,
      "Rotas cooldown/reutilizável"
    );

    write(file, s);
  }

  // =========================================================================
  // 6) PAINEL HTML
  // =========================================================================
  {
    const file = "admin/index.html";
    let s = originals.get(file);

    s = replaceOnce(
      s,
      `<small>disponíveis</small>`,
      `<small id="perfumesDetail">disponíveis</small>`,
      "Detalhe do card Perfumes"
    );

    s = replaceOnce(
      s,
      `            Cole links do Mercado Livre ou meli.la. O T&T identifica a categoria e prepara a oferta.
            Eletrônicos e Fitness entram na fila normal. Perfumes continuam na reserva circular abaixo.`,
      `            Cole links do Mercado Livre ou meli.la. O T&T identifica a categoria e prepara a oferta.
            Eletrônicos e Fitness entram com prioridade no próximo turno do grupo, e a VPS gera/valida o seu meli.la antes do envio.
            Perfumes continuam na reserva circular abaixo.`,
      "Explica prioridade e meli.la"
    );

    s = replaceOnce(
      s,
      `            Até 20 links por envio. Com modo automático ativo, as ofertas ficam disponíveis para os próximos ciclos.`,
      `            Até 20 links por envio. O produto não é enviado na hora: ele vira prioridade na próxima vez que o grupo correspondente for processado.`,
      "Explica quando o produto sai da fila"
    );

    s = replaceOnce(
      s,
      `            <button class="tab active" data-status="available">Disponíveis</button>
            <button class="tab" data-status="queued">Na fila</button>
            <button class="tab" data-status="used">Usados</button>
            <button class="tab" data-status="rejected">Rejeitados</button>`,
      `            <button class="tab active" data-status="available">Disponíveis</button>
            <button class="tab" data-status="cooldown">Em cooldown</button>
            <button class="tab" data-status="reusable">Prontos p/ reutilizar</button>
            <button class="tab" data-status="queued">Na fila</button>
            <button class="tab" data-status="rejected">Rejeitados</button>`,
      "Abas de cooldown dos perfumes"
    );

    s = s.replace(
      "T&T Painel v2",
      "T&T Painel v2.3"
    );

    write(file, s);
  }

  // =========================================================================
  // 7) FRONTEND: feedback, cooldown e prioridade visual
  // =========================================================================
  {
    const file = "admin/app.js";
    let s = originals.get(file);

    s = replaceOnce(
      s,
      `used:"Usado",expired:`,
      `used:"Usado",cooldown:"Em cooldown",reusable:"Pronto para reutilizar",expired:`,
      "Labels de cooldown"
    );

    s = replaceOnce(
      s,
      `<div class="meta">\${esc(d.ttCategoryName||x.ttCategoryName||"Sem categoria")} · \${esc(d.itemId||x.itemId||"")}</div>`,
      `<div class="meta">\${esc(d.ttCategoryName||x.ttCategoryName||"Sem categoria")} · \${esc(d.itemId||x.itemId||"")}\${(d.priority||x.priority)==="manual_panel"?" · ⭐ prioridade manual":""}</div>`,
      "Fila mostra prioridade manual"
    );

    s = replaceOnce(
      s,
      `      status==="ready_to_publish"?"ENTROU NA FILA":
      status==="held"?"RETIDO":`,
      `      status==="ready_to_publish"?"PRONTO PARA ENVIAR":
      status==="awaiting_affiliate_link"?"NA FILA · PRIORIDADE":
      status==="held"?"RETIDO":`,
      "Resultado mostra pendente prioritário"
    );

    s = replaceOnce(
      s,
      `      status==="ready_to_publish"?"ready_to_publish":
      status==="held"?"queued":`,
      `      status==="ready_to_publish"?"ready_to_publish":
      status==="awaiting_affiliate_link"?"ready_to_publish":
      status==="held"?"queued":`,
      "Badge do pendente prioritário"
    );

    s = replaceOnce(
      s,
      `        status==="ready_to_publish"
          ?"Produto validado e disponível para publicação."
          :""`,
      `        status==="ready_to_publish"
          ?"Produto validado e pronto para envio."
          :(
              status==="awaiting_affiliate_link"
                ?"Prioridade manual. A VPS vai gerar e validar o meli.la antes de enviar."
                :""
            )`,
      "Explica geração local do afiliado"
    );

    const reuseHelper = `
function formatReuseRemaining(ms){
  if(typeof ms!=="number"||!Number.isFinite(ms))return"";
  if(ms<=0)return"pode reutilizar agora";

  const totalMinutes=Math.ceil(ms/60000);
  const hours=Math.floor(totalMinutes/60);
  const minutes=totalMinutes%60;

  if(hours>0&&minutes>0)return\`reutiliza em \${hours}h \${minutes}min\`;
  if(hours>0)return\`reutiliza em \${hours}h\`;
  return\`reutiliza em \${minutes}min\`;
}

`;

    s = insertBefore(
      s,
      "function reserveImage(x){",
      reuseHelper,
      "Contador visual de cooldown"
    );

    s = replaceOnce(
      s,
      `    const status=x.status||state.reserveStatus;
    const canRemove=state.role==="admin"&&["available","claimed","queued"].includes(status);

    return \`<div class="row">\${image?\`<img class="thumb" src="\${esc(image)}" alt="">\`:\`<div class="thumb"></div>\`}<div class="main"><b>\${esc(x.title||"Perfume")}</b><div class="meta">#\${esc(x.id)} · \${esc(labels[status]||status)}</div></div><div class="side">\${money(x.price)}\${canRemove?\`<br><button data-remove="\${esc(x.id)}" style="margin-top:6px;padding:4px 7px;font-size:8px;color:#ffabb1;background:transparent">Remover</button>\`:""}</div></div>\`;`,
      `    const rawStatus=x.status||state.reserveStatus;
    const status=x.panelStatus||rawStatus;
    const canRemove=state.role==="admin"&&["available","claimed","queued"].includes(rawStatus);
    const reuseText=(status==="cooldown"||status==="reusable")?formatReuseRemaining(x.reuseRemainingMs):"";

    return \`<div class="row">\${image?\`<img class="thumb" src="\${esc(image)}" alt="">\`:\`<div class="thumb"></div>\`}<div class="main"><b>\${esc(x.title||"Perfume")}</b><div class="meta">#\${esc(x.id)} · \${esc(labels[status]||status)}\${reuseText?\` · \${esc(reuseText)}\`:""}</div></div><div class="side">\${money(x.price)}\${canRemove?\`<br><button data-remove="\${esc(x.id)}" style="margin-top:6px;padding:4px 7px;font-size:8px;color:#ffabb1;background:transparent">Remover</button>\`:""}</div></div>\`;`,
      "Perfumes exibem cooldown real"
    );

    s = replaceOnce(
      s,
      `    $("#perfumesCount").textContent=d.perfumeAvailableCount??0;
    $("#mlStatus")`,
      `    $("#perfumesCount").textContent=d.perfumeAvailableCount??0;
    $("#perfumesDetail").textContent=
      \`\${d.perfumeCooldownCount??0} cooldown · \${d.perfumeReusableCount??0} reutilizável\`;
    $("#mlStatus")`,
      "Card Perfumes mostra cooldown"
    );

    s = replaceOnce(
      s,
      `.filter(x=>x.status!=="ready_to_publish"&&x.status!=="held")`,
      `.filter(x=>x.status!=="ready_to_publish"&&x.status!=="awaiting_affiliate_link"&&x.status!=="held")`,
      "Pendente manual não aparece como erro"
    );

    s = replaceOnce(
      s,
      `        \`Produtos: \${d.readyCount||0} pronto(s), \${d.heldCount||0} retido(s), \${d.failedCount||0} falha(s).\${detail?\` Motivo: \${detail}\`:""}\`,`,
      `        \`Produtos: \${d.pendingCount||0} em prioridade, \${d.readyCount||0} pronto(s), \${d.heldCount||0} retido(s), \${d.failedCount||0} falha(s).\${detail?\` Motivo: \${detail}\`:""}\`,`,
      "Toast de falha inclui prioridade"
    );

    s = replaceOnce(
      s,
      `        \`Produtos: \${d.readyCount||0} pronto(s) para publicação e \${d.heldCount||0} retido(s) pelas regras.\``,
      `        \`Produtos: \${d.pendingCount||0} em prioridade para o próximo turno, \${d.readyCount||0} já pronto(s) e \${d.heldCount||0} retido(s).\``,
      "Toast de sucesso explica prioridade"
    );

    s = replaceOnce(
      s,
      `    if((d.readyCount||0)+(d.heldCount||0)>0){`,
      `    if((d.pendingCount||0)+(d.readyCount||0)+(d.heldCount||0)>0){`,
      "Limpa links quando entrou como prioridade"
    );

    write(file, s);
  }

  // =========================================================================
  // 8) PUBLISHER: prioridade manual sempre primeiro no grupo
  // =========================================================================
  {
    const file = "whatsapp/publish-queue.js";
    let s = originals.get(file);

    const priorityHelper = `
function sortManualPriorityEntries(
  entries
) {
  return (
    Array.isArray(
      entries
    )
      ? entries.slice()
      : []
  ).sort(
    (a, b) => {
      const aManual =
        a?.priority ===
          "manual_panel" ||
        a?.manualPanel ===
          true;

      const bManual =
        b?.priority ===
          "manual_panel" ||
        b?.manualPanel ===
          true;

      if (
        aManual !==
        bManual
      ) {
        return aManual
          ? -1
          : 1;
      }

      const aTime =
        Date.parse(
          a?.queuedAt ||
          ""
        );

      const bTime =
        Date.parse(
          b?.queuedAt ||
          ""
        );

      return (
        (
          Number.isFinite(
            aTime
          )
            ? aTime
            : 0
        ) -
        (
          Number.isFinite(
            bTime
          )
            ? bTime
            : 0
        )
      );
    }
  );
}


`;

    s = insertBefore(
      s,
      "async function getAwaitingAffiliateItem(",
      priorityHelper,
      "Ordenação de prioridade manual"
    );

    s = replaceInSection(
      s,
      "async function getAwaitingAffiliateItem(",
      "async function attachAffiliateLink(",
      `    entries.find(`,
      `    sortManualPriorityEntries(
      entries
    ).find(`,
      "Prioridade na geração de afiliado"
    );

    s = replaceInSection(
      s,
      "async function getReadyItem(",
      "function resolveDestination(",
      `    entries.find(`,
      `    sortManualPriorityEntries(
      entries
    ).find(`,
      "Prioridade no envio"
    );

    write(file, s);
  }

  // =========================================================================
  // VALIDAÇÃO FINAL
  // =========================================================================
  const jsFiles = files.filter(
    (file) =>
      file.endsWith(".js")
  );

  for (const file of jsFiles) {
    execFileSync(
      process.execPath,
      ["--check", file],
      { stdio: "inherit" }
    );
  }

  console.log("");
  console.log("✅ T&T Painel V2.3 aplicado por completo.");
  console.log("✅ Produto escolhido no painel entra com prioridade manual.");
  console.log("✅ A VPS gera/valida meli.la antes de enviar.");
  console.log("✅ Ofertas sem productId usam itemId como fallback.");
  console.log("✅ Links normais antigos marcados como prontos são auto-reparados.");
  console.log("✅ Perfumes agora mostram cooldown e reutilização.");
  console.log("");
  console.log("Agora rode: git status");
} catch (error) {
  console.error("");
  console.error("❌ Falha ao aplicar V2.3:", error?.message || error);
  console.error("↩️ Restaurando os arquivos originais...");

  for (const [file, content] of originals.entries()) {
    fs.writeFileSync(file, content, "utf8");
  }

  console.error("✅ Arquivos restaurados.");
  process.exit(1);
}
