const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={queue:[],reserve:[],reserveStatus:"available",role:null,publisher:null,productResults:[]};
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const money=v=>typeof v==="number"?new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v):"—";
const labels={awaiting_affiliate_link:"Aguardando afiliado",ready_to_publish:"Pronta",sending:"Enviando",sent:"Enviada",send_error:"Erro",rejected:"Rejeitada",available:"Disponível",claimed:"Em validação",queued:"Na fila",used:"Usado",expired:"Expirado",duplicate:"Duplicado",removed:"Removido"};

async function api(action,{method="GET",body}={}){
  const r=await fetch(`/api/admin?action=${action}`,{
    method,credentials:"same-origin",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:body?JSON.stringify(body):undefined
  });

  let d=null;
  try{d=await r.json()}catch{}

  if(r.status===401){
    showLogin();
    throw new Error(d?.error||"Sessão expirada.");
  }

  if(!r.ok||d?.ok===false){
    throw new Error(d?.error||`Erro HTTP ${r.status}`);
  }

  return d;
}

function showLogin(){
  $("#appView").hidden=true;
  $("#loginView").hidden=false;
}

function showApp(){
  $("#loginView").hidden=true;
  $("#appView").hidden=false;
}

function msg(t,type="success"){
  const e=$("#msg");
  e.textContent=t;
  e.className=`msg ${type}`;
  e.hidden=false;
  clearTimeout(msg.t);
  msg.t=setTimeout(()=>e.hidden=true,6500);
}

function applyRole(role){
  state.role=role;
  const viewer=role==="viewer";

  $("#accessRole").textContent=viewer?"VISUALIZAÇÃO":"ADMIN";
  $("#accessRole").className=`roleBadge ${viewer?"viewer":"admin"}`;
  $("#viewerNotice").hidden=!viewer;
  $("#viewerPerfumeHint").hidden=!viewer;
  $("#perfumeForm").hidden=viewer;
  $("#viewerProductHint").hidden=!viewer;
  $("#productForm").hidden=viewer;

  $$(".adminOnly").forEach(el=>{
    el.disabled=viewer;
    el.classList.toggle("adminLocked",viewer);
  });
}

function renderQueue(){
  const f=$("#queueFilter").value;
  const a=f?state.queue.filter(x=>x.status===f):state.queue;

  $("#queueList").innerHTML=a.length?a.slice(0,100).map(x=>{
    const d=x.data||x.envelope?.data||x;
    return `<div class="row">${d.image?`<img class="thumb" src="${esc(d.image)}" alt="">`:`<div class="thumb"></div>`}<div class="main"><b>${esc(d.title||x.title||"Oferta")}</b><div class="meta">${esc(d.ttCategoryName||x.ttCategoryName||"Sem categoria")} · ${esc(d.itemId||x.itemId||"")}</div></div><div class="side">${money(d.price??x.price)}<br><span class="badge ${esc(x.status)}">${esc(labels[x.status]||x.status||"—")}</span></div></div>`;
  }).join(""):`<div class="empty">Nenhuma oferta neste filtro.</div>`;
}


function renderProductResults(){
  const container=$("#productResults");
  if(!container)return;

  const results=Array.isArray(state.productResults)?state.productResults:[];

  if(!results.length){
    container.innerHTML=`<div class="empty">Adicione um produto para ver aqui se ele entrou na fila, foi retido ou falhou.</div>`;
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

    return `<div class="row">
      <div class="thumb"></div>
      <div class="main">
        <b>${esc(x.title||x.itemId||x.affiliateLink||"Produto")}</b>
        <div class="meta">
          ${esc(x.itemId||"")}
          ${detail?` · ${esc(detail)}`:""}
        </div>
      </div>
      <div class="side">
        ${money(x.price)}
        <br>
        <span class="badge ${klass}">${esc(statusLabel)}</span>
      </div>
    </div>`;
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

function reserveImage(x){
  return x.image||x.metadata?.image||x.metadata?.lastResolvedOffer?.image||"";
}

function renderReserve(){
  $("#reserveList").innerHTML=state.reserve.length?state.reserve.map(x=>{
    const image=reserveImage(x);
    const status=x.status||state.reserveStatus;
    const canRemove=state.role==="admin"&&["available","claimed","queued"].includes(status);

    return `<div class="row">${image?`<img class="thumb" src="${esc(image)}" alt="">`:`<div class="thumb"></div>`}<div class="main"><b>${esc(x.title||"Perfume")}</b><div class="meta">#${esc(x.id)} · ${esc(labels[status]||status)}</div></div><div class="side">${money(x.price)}${canRemove?`<br><button data-remove="${esc(x.id)}" style="margin-top:6px;padding:4px 7px;font-size:8px;color:#ffabb1;background:transparent">Remover</button>`:""}</div></div>`;
  }).join(""):`<div class="empty">Nenhum perfume com status ${esc(labels[state.reserveStatus]||state.reserveStatus)}.</div>`;

  $$("[data-remove]").forEach(b=>b.onclick=async()=>{
    if(state.role!=="admin")return;
    if(!confirm(`Remover reserva #${b.dataset.remove}?`))return;

    try{
      await api("reserve-remove",{method:"POST",body:{id:Number(b.dataset.remove)}});
      msg("Reserva removida.");
      await refreshAll();
    }catch(e){
      msg(e.message,"error");
    }
  });
}

async function loadReserve(status=state.reserveStatus){
  const d=await api(`reserve-list&status=${encodeURIComponent(status)}`);
  state.reserveStatus=status;
  state.reserve=Array.isArray(d.reserve)?d.reserve:[];
  renderReserve();
}

function setStatusText(selector,text,kind=""){
  const el=$(selector);
  el.textContent=text;
  el.className=kind;
}

function relativeHeartbeat(iso){
  if(!iso)return"Sem heartbeat";
  const diff=Math.max(0,Date.now()-Date.parse(iso));
  if(diff<60000)return`há ${Math.max(1,Math.round(diff/1000))}s`;
  return`há ${Math.round(diff/60000)} min`;
}

function renderPublisher(p){
  state.publisher=p||{};
  const online=p?.online===true;

  setStatusText("#publisherStatus",online?"ONLINE":"OFFLINE",online?"good":"bad");
  $("#publisherHeartbeat").textContent=relativeHeartbeat(p?.heartbeatAt);

  setStatusText(
    "#whatsappStatus",
    p?.whatsappConnected?"CONECTADO":(online?"DESCONECTADO":"SEM SINAL"),
    p?.whatsappConnected?"good":"bad"
  );

  const manual=p?.manualModeEnabled===true;
  setStatusText("#manualStatus",manual?"MANUAL":"AUTOMÁTICO",manual?"warn":"good");
  $("#manualSource").textContent=p?.controlSource?`última origem: ${p.controlSource}`:"controle compartilhado";

  setStatusText(
    "#windowStatus",
    p?.automaticWindowOpen?"LIBERADA":"PAUSADA",
    p?.automaticWindowOpen?"good":"warn"
  );
  $("#windowLabel").textContent=p?.sendWindow||"09:00–22:00";

  setStatusText(
    "#cycleStatus",
    p?.automaticBatchInProgress?"EM ANDAMENTO":"AGUARDANDO",
    p?.automaticBatchInProgress?"warn":""
  );

  const affiliateOk=p?.affiliateConfigured&&!p?.affiliateBlocked;
  setStatusText(
    "#affiliateStatus",
    affiliateOk?"OK":(p?.affiliateBlocked?"BLOQUEADO":"AGUARDANDO"),
    affiliateOk?"good":(p?.affiliateBlocked?"bad":"warn")
  );

  const button=$("#manualToggle");
  button.textContent=manual?"Voltar ao automático":"Ativar modo manual";
  button.dataset.nextManual=manual?"false":"true";
}

async function refreshAll(){
  try{
    const d=await api("dashboard");
    applyRole(d.role||state.role||"viewer");

    const s=d.summary||{},c=s.counts||{};
    $("#total").textContent=d.queueTotalExact??s.total??0;
    $("#ready").textContent=c.ready_to_publish??0;
    $("#awaiting").textContent=c.awaiting_affiliate_link??0;
    $("#sent").textContent=c.sent??0;
    $("#perfumesCount").textContent=d.perfumeAvailableCount??0;
    $("#mlStatus").textContent=d.mlStatus?.connected?"OK":"Atenção";
    $("#mlDetail").textContent=d.mlStatus?.connected?(d.mlStatus?.expired?"token precisa renovar":"OAuth conectado"):(d.mlStatus?.message||"não conectado");

    state.queue=d.queue?.queue?.entries||d.queue?.queue||d.queue?.entries||[];
    renderQueue();
    renderPublisher(d.publisher||{});
    await loadReserve(state.reserveStatus);

    $("#lastUpdate").textContent="Atualizado "+new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit"}).format(new Date());
  }catch(e){
    msg(e.message,"error");
  }
}

$("#loginForm").onsubmit=async e=>{
  e.preventDefault();
  $("#loginError").hidden=true;

  try{
    const d=await api("login",{method:"POST",body:{password:$("#password").value}});
    $("#password").value="";
    applyRole(d.role);
    showApp();
    await refreshAll();
  }catch(x){
    $("#loginError").textContent=x.message;
    $("#loginError").hidden=false;
  }
};

$("#logoutButton").onclick=async()=>{
  try{await api("logout",{method:"POST",body:{}})}
  finally{
    state.role=null;
    showLogin();
  }
};

$("#refreshButton").onclick=refreshAll;
$("#queueFilter").onchange=renderQueue;

$("#manualToggle").onclick=async()=>{
  if(state.role!=="admin")return;
  const next=$("#manualToggle").dataset.nextManual==="true";
  $("#manualToggle").disabled=true;

  try{
    await api("publisher-control",{method:"POST",body:{manualModeEnabled:next}});
    msg(next?"Modo manual solicitado ao publisher.":"Retorno ao automático solicitado.");
    await new Promise(r=>setTimeout(r,1200));
    await refreshAll();
  }catch(e){
    msg(e.message,"error");
  }finally{
    $("#manualToggle").disabled=false;
  }
};

$$("[data-group]").forEach(b=>b.onclick=async()=>{
  if(state.role!=="admin")return;
  b.disabled=true;

  try{
    const d=await api("discover",{method:"POST",body:{group:b.dataset.group}});
    msg(`${b.dataset.group==="eletronicos"?"Eletrônicos":"Fitness"}: ${d.totalNewQueued??0} oferta(s) nova(s).`);
    await refreshAll();
  }catch(e){
    msg(e.message,"error");
  }finally{
    b.disabled=false;
  }
});


$("#productForm").onsubmit=async e=>{
  e.preventDefault();
  if(state.role!=="admin")return;

  const links=[...new Set(
    $("#productLinks").value
      .split(/\s+/)
      .map(x=>x.trim())
      .filter(x=>/^https?:\/\//i.test(x))
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

    saveProductResults(d.results||[]);

    const detail=(d.results||[])
      .filter(x=>x.status!=="ready_to_publish"&&x.status!=="held")
      .map(x=>x.error||x.reason)
      .filter(Boolean)[0];

    if(d.failedCount){
      msg(
        `Produtos: ${d.readyCount||0} pronto(s), ${d.heldCount||0} retido(s), ${d.failedCount||0} falha(s).${detail?` Motivo: ${detail}`:""}`,
        "error"
      );
    }else{
      msg(
        `Produtos: ${d.readyCount||0} pronto(s) para publicação e ${d.heldCount||0} retido(s) pelas regras.`
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

$("#clearProductResults").onclick=()=>{
  saveProductResults([]);
};

$("#perfumeForm").onsubmit=async e=>{
  e.preventDefault();
  if(state.role!=="admin")return;

  const links=[...new Set(
    $("#perfumeLinks").value.split(/\s+/).filter(x=>/^https?:\/\//i.test(x))
  )].slice(0,20);

  if(!links.length){
    return msg("Cole pelo menos um link válido.","error");
  }

  try{
    const d=await api("reserve-add",{method:"POST",body:{group:"perfumes",affiliateLinks:links}});

    if(d.failedCount){
      const first=(d.results||[]).find(x=>x.status==="error"||x.status==="resolution_failed"||(x.added===false&&!x.duplicate));
      const detail=first?.error||first?.reason||"um ou mais links não puderam ser adicionados";
      msg(`Reserva: ${d.addedCount||0} adicionado(s), ${d.duplicateCount||0} duplicado(s), ${d.failedCount||0} falha(s). Motivo: ${detail}`,"error");
    }else{
      msg(`Reserva: ${d.addedCount||0} adicionado(s), ${d.duplicateCount||0} duplicado(s).`);
    }

    if(d.addedCount)$("#perfumeLinks").value="";

    state.reserveStatus="available";
    $$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.status==="available"));
    await refreshAll();
  }catch(x){
    msg(x.message,"error");
  }
};

$$(".tab").forEach(t=>t.onclick=async()=>{
  $$(".tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");

  try{
    await loadReserve(t.dataset.status);
  }catch(e){
    msg(e.message,"error");
  }
});

(async()=>{
  restoreProductResults();

  try{
    const session=await api("session");
    applyRole(session.role);
    showApp();
    await refreshAll();
  }catch{
    showLogin();
  }
})();
