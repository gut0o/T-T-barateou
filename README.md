# T&T Barateou — Pacote acelerado 6.13A → 6.13E

Objetivo: deixar o sistema praticamente operando sozinho hoje.

## Limite Vercel

Nenhuma Serverless Function nova.

```text
10 usadas
12 permitidas
2 vagas livres
```

---

# 1. Prévia duplicada corrigida

Antes:

```text
SIM
↓
pending era liberado cedo demais
↓
poll podia enxergar ready_to_publish de novo
↓
segunda prévia
```

Agora:

```text
SIM
↓
actionInProgress = true
↓
backend muda para sending
↓
só então a prévia é liberada
```

O polling fica bloqueado durante a transição.

---

# 2. Descoberta automática em várias categorias

O bot agora usa uma rotação inicial:

```text
Vestidos
Ares Condicionados
Suplementos Alimentares
Geladeiras de Brinquedo
```

Config:

```text
lib/tt-discovery-seeds.js
```

Cada execução consulta no máximo 2 categorias.

Se uma categoria não tiver ranking disponível, as outras continuam.

Por padrão:

```text
auto discovery = ligada
intervalo = 15 minutos
```

Variáveis opcionais:

```powershell
$env:TT_AUTO_DISCOVERY = "true"
$env:TT_AUTO_DISCOVERY_INTERVAL_MS = "900000"
```

---

# 3. Ofertas descobertas entram sozinhas na fila

Fluxo:

```text
auto-discover
→ highlights
→ PRODUCT
→ preço/imagem
→ comissão
→ score
→ categoria T&T
→ high/medium
→ awaiting_affiliate_link
```

Se o item já existe na fila:

```text
não duplica
```

Isso inclui:

```text
sent
ready_to_publish
awaiting_affiliate_link
rejected
...
```

---

# 4. O Aggin vira painel de controle

Comandos:

```text
STATUS
DESCOBRIR
```

## STATUS

Mostra:

```text
aguardando link
prontas
enviando
enviadas
erros
rejeitadas
```

E lista algumas ofertas que precisam de link afiliado.

## DESCOBRIR

Força uma busca agora, sem esperar os 15 minutos.

---

# 5. Link afiliado direto pelo WhatsApp

Agora não precisa mais PowerShell para ingestão.

Quando o bot avisar uma oferta:

```text
🔎 Abrir produto: ...
```

Abra, gere o link afiliado e simplesmente cole no Aggin:

```text
https://meli.la/...
```

O bot faz:

```text
meli.la
→ /api/offer
→ score
→ high/medium
→ atualiza/cria fila
→ ready_to_publish
→ abre prévia
→ SIM
→ envia
→ sent
```

Se for low:

```text
held
```

e ele avisa no Aggin.

---

# Arquivos

Substitua:

```text
api/discover-bestsellers.js

lib/tt-queue-admin-actions.js
lib/tt-pending-publication-store.js
lib/tt-publication-planner.js

whatsapp/publish-queue.js
```

Adicione:

```text
lib/tt-discovery-seeds.js
```

`group-routing.json` está incluído, mas permanece:

```json
"testMode": true
```

Então ainda usamos somente o Aggin.

---

# Deploy

Pare o bot:

```text
Ctrl + C
```

Depois:

```powershell
git add .
git commit -m "Automatiza descoberta e controle pelo WhatsApp"
git push
```

Espere o Vercel ficar Ready.

---

# Iniciar

A variável local continua:

```powershell
$env:TT_QUEUE_ADMIN_KEY = "SUA_CHAVE_ATUAL"
```

Depois:

```powershell
node whatsapp\publish-queue.js
```

O terminal deve mostrar:

```text
🔎 Auto discovery: SIM
💬 Comandos no Aggin: STATUS | DESCOBRIR | cole um meli.la
```

---

# TESTE 1

No Aggin envie:

```text
STATUS
```

O bot deve devolver o estado da fila.

---

# TESTE 2

No Aggin envie:

```text
DESCOBRIR
```

Ele consulta duas categorias da rotação.

Se houver novas high/medium, o Aggin recebe algo como:

```text
🔎 T&T encontrou 2 oferta(s) nova(s)

1. Produto...
💰 R$ ...
📂 Moda & Beleza
🔎 Abrir produto: https://www.mercadolivre.com.br/p/MLB...

Depois gere o link de afiliado e cole o meli.la aqui no Aggin.
```

---

# TESTE 3

Cole no Aggin um link:

```text
https://meli.la/...
```

O bot responde com o resultado.

Se aprovado:

```text
ready_to_publish
↓
prévia
↓
SIM
↓
sent
```

---

# O que ainda falta para 100% autônomo

Só a geração do próprio link afiliado.

Hoje o sistema já consegue sozinho:

```text
buscar
analisar
selecionar
não duplicar
organizar fila
pedir link
receber link pelo WhatsApp
validar
montar anúncio
pedir confirmação
publicar
registrar sent/error/retry
```

Enquanto o link afiliado precisar ser gerado pelas ferramentas do Mercado Livre,
o único trabalho manual fica sendo:

```text
abrir produto
→ gerar link
→ colar no Aggin
```
