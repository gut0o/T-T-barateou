# T&T Barateou — Pacote 6.14

## Objetivo

Eliminar o último passo manual:

```text
descoberta
→ geração automática do meli.la
→ validação
→ preview
→ SIM
→ WhatsApp
```

## Importante

O endpoint observado:

```text
POST https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink
```

é um endpoint interno da interface do Mercado Livre.

Não é uma API pública/documentada.

Ele pode:
- mudar;
- exigir uma sessão válida;
- parar de funcionar;
- ter regras do programa que precisam ser respeitadas.

Por isso a integração fica LOCAL e isolada.

---

# Segurança

NÃO coloque no Vercel:

```text
ML_AFFILIATE_COOKIE
ML_AFFILIATE_CSRF_TOKEN
```

NÃO coloque no Git.

NÃO mande esses valores no ChatGPT.

Eles ficam apenas na sessão local do PowerShell que roda o Baileys.

---

# Arquivos

Este pacote é autocontido em relação à 6.13.

Substitua:

```text
api/discover-bestsellers.js

lib/tt-queue-admin-actions.js
lib/tt-pending-publication-store.js
lib/tt-publication-planner.js
lib/tt-discovery-seeds.js

whatsapp/publish-queue.js
whatsapp/group-routing.json
```

Adicione:

```text
whatsapp/ml-affiliate-link.js
whatsapp/affiliate-session.example.txt
```

---

# Deploy

Primeiro pare o bot:

```text
Ctrl + C
```

Depois:

```powershell
git add .
git commit -m "Automatiza geracao local de link afiliado"
git push
```

Espere o Vercel ficar Ready.

---

# Configurar a sessão LOCAL

No DevTools, use a requisição:

```text
createLink
```

Em Request Headers você já identificou:

```text
Cookie
X-Csrf-Token
```

E no Payload existe:

```text
tag
```

No PowerShell, SEM mandar os valores para ninguém:

```powershell
$env:ML_AFFILIATE_COOKIE = 'COLE_LOCALMENTE_O_COOKIE_COMPLETO'
$env:ML_AFFILIATE_CSRF_TOKEN = 'COLE_LOCALMENTE_O_VALOR_DE_X-Csrf-Token'
$env:ML_AFFILIATE_TAG = 'COLE_LOCALMENTE_O_TAG_DO_PAYLOAD'
```

A TT_QUEUE_ADMIN_KEY continua:

```powershell
$env:TT_QUEUE_ADMIN_KEY = 'SUA_CHAVE_ATUAL'
```

Não use `setx` por enquanto.
Assim, os cookies desaparecem quando a janela do PowerShell é encerrada.

---

# Iniciar

```powershell
node whatsapp\publish-queue.js
```

Queremos ver:

```text
🔗 Auto affiliate: SIM
🔗 Sessão afiliado local: CONFIGURADA
```

---

# Fluxo automático

Quando houver:

```text
awaiting_affiliate_link
```

o bot faz localmente:

```text
itemId
productId
↓
POST createLink
↓
Cookie + X-Csrf-Token
↓
short_url
↓
https://meli.la/...
```

Depois chama o backend:

```text
attach-affiliate-link
```

O backend continua validando se o link corresponde ao item/produto esperado.

Se validar:

```text
ready_to_publish
```

e o Aggin recebe:

```text
🔗 LINK AFILIADO GERADO AUTOMATICAMENTE
...
✅ Validado e movido para ready_to_publish.
```

Logo depois aparece a prévia.

---

# Teste recomendado

Já temos itens antigos na fila `awaiting_affiliate_link`.

Então basta iniciar:

```powershell
node whatsapp\publish-queue.js
```

Não precisa enviar nada no Aggin.

Em até ~30 segundos o bot deve tentar gerar um link automaticamente.

No terminal:

```text
🔗 Gerando link afiliado: ...
🔗 Link gerado: https://meli.la/...
```

No Aggin:

```text
🔗 LINK AFILIADO GERADO AUTOMATICAMENTE
...
```

e depois:

```text
🧪 FILA T&T - PRÉVIA
```

---

# Se a sessão expirar

Se Mercado Livre responder 401/403:

```text
⚠️ AUTOMAÇÃO DO LINK AFILIADO PAROU
```

O bot NÃO perde a oferta.

Ela permanece:

```text
awaiting_affiliate_link
```

Você apenas:
1. abre novamente a Central de Afiliados;
2. gera um link manual uma vez;
3. copia novos Cookie e X-Csrf-Token para o PowerShell;
4. reinicia o bot.

---

# Estado final esperado

Com a sessão válida:

```text
T&T procura sozinho
→ escolhe sozinho
→ calcula score
→ evita duplicata
→ gera link afiliado sozinho
→ valida link
→ monta anúncio
→ pede SIM
→ envia
→ registra sent
```

Por enquanto:

```json
"testMode": true
```

Então a publicação continua somente no Aggin.
