# T&T Barateou — Pacote acelerado 6.12A → 6.12D

Este pacote conecta a fila pronta ao bot Baileys.

## Vercel

Nenhuma Serverless Function nova.

```text
10 usadas
12 permitidas
2 vagas livres
```

---

## 6.12A — Bot lê ready_to_publish

Novo arquivo:

```text
whatsapp/publish-queue.js
```

Ele consulta periodicamente:

```text
queue-list
status=ready_to_publish
```

Por padrão:

```text
a cada 15 segundos
```

---

## 6.12B — Preview no Aggin

Quando encontra uma oferta pronta:

```text
ready_to_publish
↓
PRÉVIA no Aggin
↓
SIM / NÃO
```

Nesta etapa:

```text
testMode = true
```

Portanto mesmo a oferta final vai para o Aggin.

Isso evita mandar oferta acidentalmente para um grupo real.

---

## 6.12C — Roteamento por categoria T&T

Novo arquivo:

```text
whatsapp/group-routing.json
```

Já contém as 8 categorias:

```text
moda_beleza
casa_eletro
tecnologia_games
saude_fitness
bebes_criancas
auto_moto
pet_shop
ofertas_variedades
```

Os JIDs reais estão `null`.

Quando os grupos existirem:

1. preencher os JIDs;
2. mudar:

```json
"testMode": false
```

A partir daí o bot escolhe o grupo usando:

```text
ttCategoryId
```

---

## 6.12D — sent / rejected / send_error / retry

### SIM

```text
ready_to_publish
→ sending
→ envia imagem + caption
→ sent
```

Guarda:

```text
groupJid
groupName
whatsappMessageId
sentAt
```

### NÃO

```text
ready_to_publish
→ rejected
```

### Erro

```text
sending
→ send_error
retryCount + 1
```

O Aggin recebe:

```text
RETRY
```

Ao responder:

```text
RETRY
→ ready_to_publish
```

e a oferta volta para a fila.

---

# Arquivos

Substitua no backend:

```text
api/discover-bestsellers.js
lib/tt-queue-admin-actions.js
lib/tt-pending-publication-store.js
```

Adicione no WhatsApp:

```text
whatsapp/publish-queue.js
whatsapp/group-routing.json
```

Não remova ainda:

```text
whatsapp/listen-offers.js
```

O publisher novo é separado do listener antigo para o teste ficar controlado.

---

# Deploy backend

```powershell
git add .
git commit -m "Conecta fila ao publicador WhatsApp"
git push
```

Espere o Vercel ficar Ready.

---

# Antes de rodar o bot

Use a TT_QUEUE_ADMIN_KEY NOVA que está no Vercel:

```powershell
$env:TT_QUEUE_ADMIN_KEY = "SUA_CHAVE_NOVA"
```

Opcionalmente:

```powershell
$env:TT_QUEUE_POLL_MS = "15000"
```

Não coloque a chave no Git.

---

# Rodar

Na raiz do projeto:

```powershell
node whatsapp\publish-queue.js
```

O script reutiliza:

```text
whatsapp/auth_info
```

da sessão Baileys já vinculada.

---

# Resultado esperado com a bicicleta

A bicicleta já está:

```text
ready_to_publish
```

Então em até ~15 segundos o Aggin deve receber:

```text
🧪 FILA T&T - PRÉVIA

Categoria: Saúde & Fitness
Destino: Aggin (TESTE)

🔥 T&T BARATEOU
...
https://meli.la/2dEmkZq

Responder SIM para enviar.
Responder NÃO para rejeitar.
```

Responda:

```text
SIM
```

O bot envia a imagem + mensagem final no próprio Aggin e o backend passa para:

```text
sent
```

---

# Verificar depois

No PowerShell:

```powershell
$headers = @{
  "x-tt-admin-key" = $env:TT_QUEUE_ADMIN_KEY
}

Invoke-RestMethod `
  -Method GET `
  -Uri "https://t-t-barateou.vercel.app/api/discover-bestsellers?action=queue-list&status=sent" `
  -Headers $headers |
  ConvertTo-Json -Depth 12
```

Devemos encontrar a bicicleta com:

```text
publicationStatus: sent
```

---

# Atenção

Baileys continua sendo uma integração não oficial do WhatsApp.

Nesta etapa mantemos:

```text
testMode: true
```

e usamos apenas o grupo Aggin.

Não configure grupos reais ainda.
