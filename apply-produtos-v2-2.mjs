import fs from "node:fs";
import { execFileSync } from "node:child_process";

const htmlFile = "admin/index.html";
const appFile = "admin/app.js";

for (const file of [htmlFile, appFile]) {
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

// ---------------------------------------------------------------------------
// HTML: substitui o bloco "Como funciona" por uma área visível de resultados.
// ---------------------------------------------------------------------------
let html = fs.readFileSync(htmlFile, "utf8");

html = replaceOnce(
  html,
  `        <div class="opItem">
          <span>Como funciona</span>
          <strong>1. Cole → 2. Valida → 3. Enfileira</strong>
          <small>
            O link é resolvido pelo backend, passa pelas regras atuais e só entra como pronto quando for válido.
          </small>
        </div>`,
  `        <div>
          <div class="head productResultHead">
            <div>
              <span class="muted small">RESULTADO DO ÚLTIMO ENVIO</span>
              <h3 style="margin:6px 0 0">Produtos processados</h3>
            </div>
            <button id="clearProductResults" type="button">Limpar</button>
          </div>

          <div id="productResults" class="list">
            <div class="empty">
              Adicione um produto para ver aqui se ele entrou na fila, foi retido ou falhou.
            </div>
          </div>
        </div>`,
  "Área de resultados dos produtos"
);

fs.writeFileSync(htmlFile, html, "utf8");

// ---------------------------------------------------------------------------
// JS: guarda e mostra os resultados do último envio.
// ---------------------------------------------------------------------------
let app = fs.readFileSync(appFile, "utf8");

app = replaceOnce(
  app,
  `const state={queue:[],reserve:[],reserveStatus:"available",role:null,publisher:null};`,
  `const state={queue:[],reserve:[],reserveStatus:"available",role:null,publisher:null,productResults:[]};`,
  "Estado dos resultados"
);

const renderer = `
function renderProductResults(){
  const container=$("#productResults");
  if(!container)return;

  const results=Array.isArray(state.productResults)?state.productResults:[];

  if(!results.length){
    container.innerHTML=\`<div class="empty">Adicione um produto para ver aqui se ele entrou na fila, foi retido ou falhou.</div>\`;
    return;
  }

  container.innerHTML=results.map(x=>{
    const status=x.status||"unknown";
    const statusLabel=
      status==="ready_to_publish"?"ENTROU NA FILA":
      status==="held"?"RETIDO":
      status==="resolution_failed"?"FALHA AO ABRIR":
      status==="error"?"ERRO":
      status;

    const klass=
      status==="ready_to_publish"?"ready_to_publish":
      status==="held"?"queued":
      "send_error";

    const detail=
      x.error||
      x.reason||
      x.heldReason||
      (
        status==="ready_to_publish"
          ?"Produto validado e disponível para publicação."
          :""
      );

    return \`<div class="row">
      <div class="thumb"></div>
      <div class="main">
        <b>\${esc(x.title||x.itemId||x.affiliateLink||"Produto")}</b>
        <div class="meta">
          \${esc(x.itemId||"")}
          \${detail?\` · \${esc(detail)}\`:""}
        </div>
      </div>
      <div class="side">
        \${money(x.price)}
        <br>
        <span class="badge \${klass}">\${esc(statusLabel)}</span>
      </div>
    </div>\`;
  }).join("");
}

function saveProductResults(results){
  state.productResults=Array.isArray(results)?results:[];
  try{
    sessionStorage.setItem(
      "tt_panel_product_results_v1",
      JSON.stringify(state.productResults)
    );
  }catch{}
  renderProductResults();
}

function restoreProductResults(){
  try{
    const stored=JSON.parse(
      sessionStorage.getItem("tt_panel_product_results_v1")||"[]"
    );
    state.productResults=Array.isArray(stored)?stored:[];
  }catch{
    state.productResults=[];
  }
  renderProductResults();
}

`;

app = replaceOnce(
  app,
  `function reserveImage(x){`,
  renderer + `function reserveImage(x){`,
  "Renderização dos resultados"
);

app = replaceOnce(
  app,
  `    const detail=(d.results||[])
      .filter(x=>x.status!=="ready_to_publish"&&x.status!=="held")
      .map(x=>x.error||x.reason)
      .filter(Boolean)[0];`,
  `    saveProductResults(d.results||[]);

    const detail=(d.results||[])
      .filter(x=>x.status!=="ready_to_publish"&&x.status!=="held")
      .map(x=>x.error||x.reason)
      .filter(Boolean)[0];`,
  "Exibição imediata do resultado"
);

app = replaceOnce(
  app,
  `$("#perfumeForm").onsubmit=async e=>{`,
  `$("#clearProductResults").onclick=()=>{
  saveProductResults([]);
};

$("#perfumeForm").onsubmit=async e=>{`,
  "Botão limpar resultados"
);

app = replaceOnce(
  app,
  `(async()=>{
  try{`,
  `(async()=>{
  restoreProductResults();

  try{`,
  "Restauração dos resultados"
);

fs.writeFileSync(appFile, app, "utf8");

execFileSync(process.execPath, ["--check", appFile], {
  stdio: "inherit"
});

console.log("");
console.log("✅ Produtos V2.2 aplicado.");
console.log("✅ Agora o resultado aparece no próprio painel.");
console.log("✅ Mostra: entrou na fila, retido ou falha.");
