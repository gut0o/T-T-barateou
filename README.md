# T&T Barateou — Pacote acelerado 6.10A → 6.10D

Este pacote continua sem criar nenhuma Serverless Function nova.

```text
10 usadas
12 permitidas
2 vagas livres
```

## 6.10A — Corrige metadados da fila

Antes havia uma colisão no campo:

```text
queuePersistence.requested
```

Agora fica claro:

```text
requested: true
requestedCount: 2
queuedCount: 2
newQueuedCount: 2
duplicateCount: 0
```

---

## 6.10B — Lista fila

A mesma função `discover-bestsellers` agora aceita uma ação administrativa:

```text
action=queue-list
```

Ela exige o header:

```text
x-tt-admin-key
```

A chave vem do ambiente:

```text
TT_QUEUE_ADMIN_KEY
```

Pode filtrar:

```text
awaiting_affiliate_link
ready_to_publish
```

---

## 6.10C — Anexa e VALIDA o link afiliado

A ação:

```text
attach-affiliate-link
```

recebe:

```text
itemId
affiliateLink
```

Antes de alterar a fila, ela chama o `/api/offer` do mesmo deployment.

O link só é aceito se resolver para:

```text
o mesmo itemId
OU
o mesmo productId
```

Se o link levar a outro produto:

```text
queueUpdated: false
```

Nada é gravado.

---

## 6.10D — Prepara payload do WhatsApp

Quando o link é válido:

```text
awaiting_affiliate_link
↓
ready_to_publish
```

E o placeholder:

```text
[LINK_AFILIADO_PENDENTE]
```

vira o link real.

Também é criado:

```json
{
  "whatsappPayload": {
    "image": "...",
    "caption": "...",
    "ttCategoryId": "...",
    "ttCategoryName": "..."
  }
}
```

Ainda NÃO envia nada ao WhatsApp.

---

# Segurança

Antes de testar as ações administrativas, crie uma variável secreta no Vercel:

```text
TT_QUEUE_ADMIN_KEY
```

Não use Client Secret, token do Mercado Livre ou BLOB token como essa chave.

Crie uma senha aleatória nova e guarde somente com você.

Depois de adicionar a variável ao Vercel:

```text
Redeploy
```

---

# Arquivos

Substitua:

```text
api/discover-bestsellers.js
lib/tt-pending-publication-store.js
```

Adicione:

```text
lib/tt-queue-admin-actions.js
```

Os outros dois arquivos estão no ZIP apenas para manter o pacote autocontido:

```text
lib/tt-publication-planner.js
lib/ml-bestsellers-enrichment.js
```

---

# Deploy

```powershell
git add .
git commit -m "Adiciona gerenciamento seguro da fila"
git push
```

---

# PRIMEIRO TESTE

Depois de configurar `TT_QUEUE_ADMIN_KEY`, no PowerShell:

```powershell
$TTKEY = "COLOQUE_AQUI_A_MESMA_CHAVE_DO_VERCEL"

$headers = @{
  "x-tt-admin-key" = $TTKEY
}

Invoke-RestMethod `
  -Method GET `
  -Uri "https://t-t-barateou.vercel.app/api/discover-bestsellers?action=queue-list&status=awaiting_affiliate_link" `
  -Headers $headers |
  ConvertTo-Json -Depth 10
```

Esperamos ver os dois produtos já gravados:

```text
MLB7397304804
MLB7266891468
```

---

# QUANDO VOCÊ TIVER UM LINK AFILIADO

Exemplo:

```powershell
$body = @{
  action = "attach-affiliate-link"
  itemId = "MLB7397304804"
  affiliateLink = "https://meli.la/SEU_LINK"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method POST `
  -Uri "https://t-t-barateou.vercel.app/api/discover-bestsellers?action=attach-affiliate-link" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body |
  ConvertTo-Json -Depth 10
```

Se for o produto correto:

```text
ok: true
queueUpdated: true
publicationStatus: ready_to_publish
whatsappPayload: {...}
```

Se for produto errado:

```text
ok: false
queueUpdated: false
```

---

# Ainda pendente

Depois desta etapa só falta encaixar:

```text
link afiliado
→ ready_to_publish
→ bot local lê payload
→ grupo correto
→ envio WhatsApp
```
