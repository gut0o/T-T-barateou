import fs from "node:fs";
import { execFileSync } from "node:child_process";

const files = {
  api: "api/admin.js",
  html: "admin/index.html",
  app: "admin/app.js"
};

for (const file of Object.values(files)) {
  if (!fs.existsSync(file)) {
    console.error(`Não encontrei ${file}. Rode este instalador na raiz do projeto.`);
    process.exit(1);
  }
}

function replaceOnce(source, oldText, newText, label) {
  if (!source.includes(oldText)) {
    if (source.includes(newText)) {
      console.log(`ℹ️ ${label} já aplicado.`);
      return source;
    }
    throw new Error(`Não encontrei o ponto de instalação: ${label}`);
  }

  console.log(`✅ ${label}`);
  return source.replace(oldText, newText);
}

// API
let api = fs.readFileSync(files.api, "utf8");

api = replaceOnce(
  api,
  `  handleContinuousDiscoverAction,
  handleQueueListAction,`,
  `  handleContinuousDiscoverAction,
  handleIngestAffiliateLinksAction,
  handleQueueListAction,`,
  "Import do envio manual"
);

const productAddFunction = `
async function productAdd(req) {
  const body = bodyObject(req);
  const links = normalizeLinks(body.affiliateLinks || body.links);

  if (!links.length) {
    const error = new Error("Envie pelo menos um link válido.");
    error.statusCode = 400;
    throw error;
  }

  const batches = [];
  for (let index = 0; index < links.length; index += 10) {
    batches.push(links.slice(index, index + 10));
  }

  const results = [];

  for (const batch of batches) {
    results.push(
      await handleIngestAffiliateLinksAction(
        adminRequest(req, {
          body: {
            affiliateLinks: batch
          }
        })
      )
    );
  }

  return {
    ok: true,
    action: "product-add",
    requestedCount: links.length,
    readyCount: results.reduce(
      (sum, item) => sum + Number(item.readyCount || 0),
      0
    ),
    heldCount: results.reduce(
      (sum, item) => sum + Number(item.heldCount || 0),
      0
    ),
    failedCount: results.reduce(
      (sum, item) => sum + Number(item.failedCount || 0),
      0
    ),
    results: results.flatMap((item) => item.results || [])
  };
}

`;

api = replaceOnce(
  api,
  `function safeErrorMessage(error) {`,
  productAddFunction + `function safeErrorMessage(error) {`,
  "Função de adicionar produtos"
);

const productRoute = `    if (action === "product-add") {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Use POST." });
      }

      requireAdminSession(req);
      return res.status(200).json(await productAdd(req));
    }

`;

api = replaceOnce(
  api,
  `    if (action === "reserve-add") {`,
  productRoute + `    if (action === "reserve-add") {`,
  "Rota product-add"
);

fs.writeFileSync(files.api, api, "utf8");

// HTML
let html = fs.readFileSync(files.html, "utf8");

const section = `
    <section class="card perfume" id="manualProductsSection">
      <div class="head">
        <div>
          <p class="eyebrow">PRODUTOS ESCOLHIDOS POR VOCÊ</p>
          <h2>Adicionar produtos à fila</h2>
          <p class="muted">
            Cole links do Mercado Livre ou meli.la. O T&T identifica a categoria e prepara a oferta.
            Eletrônicos e Fitness entram na fila normal. Perfumes continuam na reserva circular abaixo.
          </p>
        </div>
      </div>

      <div class="perfumeGrid">
        <form id="productForm" class="adminOnlyBlock">
          <label>Links dos produtos</label>
          <textarea
            id="productLinks"
            rows="8"
            placeholder="https://www.mercadolivre.com.br/...\nhttps://meli.la/..."
          ></textarea>
          <small class="muted">
            Até 20 links por envio. Com modo automático ativo, as ofertas ficam disponíveis para os próximos ciclos.
          </small>
          <button class="primary">Adicionar à fila</button>
        </form>

        <div id="viewerProductHint" class="viewerPerfumeHint" hidden>
          👁 No modo visualização, você pode acompanhar a fila, mas não adicionar produtos.
        </div>

        <div class="opItem">
          <span>Como funciona</span>
          <strong>1. Cole → 2. Valida → 3. Enfileira</strong>
          <small>
            O link é resolvido pelo backend, passa pelas regras atuais e só entra como pronto quando for válido.
          </small>
        </div>
      </div>
    </section>

`;

html = replaceOnce(
  html,
  `    <section class="card perfume">
      <div class="head">
        <div>
          <p class="eyebrow">RESERVA CIRCULAR</p>`,
  section + `    <section class="card perfume">
      <div class="head">
        <div>
          <p class="eyebrow">RESERVA CIRCULAR</p>`,
  "Seção Adicionar produtos"
);

fs.writeFileSync(files.html, html, "utf8");

// Frontend
let app = fs.readFileSync(files.app, "utf8");

app = replaceOnce(
  app,
  `  $("#viewerPerfumeHint").hidden=!viewer;
  $("#perfumeForm").hidden=viewer;`,
  `  $("#viewerPerfumeHint").hidden=!viewer;
  $("#perfumeForm").hidden=viewer;
  $("#viewerProductHint").hidden=!viewer;
  $("#productForm").hidden=viewer;`,
  "Permissões da área de produtos"
);

const handler = `
$("#productForm").onsubmit=async e=>{
  e.preventDefault();
  if(state.role!=="admin")return;

  const links=[...new Set(
    $("#productLinks").value
      .split(/\\s+/)
      .map(x=>x.trim())
      .filter(x=>/^https?:\\/\\//i.test(x))
  )].slice(0,20);

  if(!links.length){
    return msg("Cole pelo menos um link válido do Mercado Livre.","error");
  }

  const button=$("#productForm button");
  button.disabled=true;
  button.textContent="Processando...";

  try{
    const d=await api("product-add",{
      method:"POST",
      body:{affiliateLinks:links}
    });

    const detail=(d.results||[])
      .filter(x=>x.status!=="ready_to_publish"&&x.status!=="held")
      .map(x=>x.error||x.reason)
      .filter(Boolean)[0];

    if(d.failedCount){
      msg(
        \`Produtos: \${d.readyCount||0} pronto(s), \${d.heldCount||0} retido(s), \${d.failedCount||0} falha(s).\${detail?\` Motivo: \${detail}\`:""}\`,
        "error"
      );
    }else{
      msg(
        \`Produtos: \${d.readyCount||0} pronto(s) para publicação e \${d.heldCount||0} retido(s) pelas regras.\`
      );
    }

    if((d.readyCount||0)+(d.heldCount||0)>0){
      $("#productLinks").value="";
    }

    await refreshAll();
  }catch(x){
    msg(x.message,"error");
  }finally{
    button.disabled=false;
    button.textContent="Adicionar à fila";
  }
};

`;

app = replaceOnce(
  app,
  `$("#perfumeForm").onsubmit=async e=>{`,
  handler + `$("#perfumeForm").onsubmit=async e=>{`,
  "Envio manual pelo painel"
);

fs.writeFileSync(files.app, app, "utf8");

for (const file of [files.api, files.app]) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

console.log("");
console.log("✅ Produtos V2.1 aplicado.");
console.log("✅ Agora existe uma área para colar produtos no painel.");
console.log("✅ Perfumes continuam usando a reserva circular existente.");
