# T&T Barateou — Pacote acelerado 6.11A → 6.11D

Nenhuma nova Serverless Function.

```text
10 usadas
12 permitidas
2 vagas livres
```

## O que entra neste pacote

### 6.11A — Importação em lote

Agora você pode mandar:

```json
{
  "affiliateLinks": [
    "https://meli.la/...",
    "https://meli.la/..."
  ]
}
```

Limite atual:

```text
10 links por chamada
```

### 6.11B — Resolve tudo automaticamente

Para cada link:

```text
meli.la
→ /api/offer
→ itemId
→ productId
→ título
→ preço
→ imagem
→ categoria T&T
→ score
→ priority
```

Não precisa informar itemId manualmente.

### 6.11C — Regra automática de aprovação

```text
high
medium
→ ready_to_publish

low
unknown
→ held
```

Oferta `held` NÃO entra na fila de publicação.

### 6.11D — Fila + mensagem final + WhatsApp payload

Se aprovada:

```text
fila
→ affiliateLinkStatus: verified
→ publicationStatus: ready_to_publish
→ placeholder substituído
→ whatsappPayload criado
```

Se o item já estiver na fila:

```text
alreadyQueued: true
```

e ele é atualizado em vez de duplicado.

## Arquivos

Substitua somente:

```text
api/discover-bestsellers.js
lib/tt-queue-admin-actions.js
```

Não precisa alterar as outras libs da etapa 6.10.

## Deploy

```powershell
git add .
git commit -m "Adiciona importacao em lote de links afiliados"
git push
```

## Segurança

Use a TT_QUEUE_ADMIN_KEY NOVA/ROTACIONADA.

Não use novamente uma chave que já tenha sido compartilhada em chat ou log.

## Teste com os dois links atuais

```powershell
$TTKEY = "SUA_CHAVE_NOVA"

$headers = @{
  "x-tt-admin-key" = $TTKEY
}

$body = @{
  action = "ingest-affiliate-links"
  affiliateLinks = @(
    "https://meli.la/2dEmkZq",
    "https://meli.la/2E9Wmu7"
  )
} | ConvertTo-Json

Invoke-RestMethod `
  -Method POST `
  -Uri "https://t-t-barateou.vercel.app/api/discover-bestsellers?action=ingest-affiliate-links" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body |
  ConvertTo-Json -Depth 12
```

## Resultado esperado com os dados que já vimos

Bicicleta:

```text
priority: medium
status: ready_to_publish
queued: true
whatsappPayload: preenchido
```

Espelho:

```text
priority: low
status: held
queued: false
heldReason: low_priority
```

## Depois deste pacote

O fluxo manual de teste fica:

```text
colar links afiliados
→ sistema resolve sozinho
→ sistema decide sozinho
→ sistema cria mensagem
→ sistema coloca só as boas na fila
→ payload WhatsApp pronto
```

O próximo bloco pode conectar:

```text
ready_to_publish
→ bot Baileys
→ categoria T&T
→ preview
→ enviado / erro / retry
```
