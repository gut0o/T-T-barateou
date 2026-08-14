# T&T Barateou — Pacote acelerado 6.9A → 6.9D

Este pacote faz 4 passos de uma vez.

## Vercel

Nenhuma Serverless Function nova.

```text
10 usadas
12 permitidas
2 vagas livres
```

Arquivos novos ficam em `lib/`, portanto não criam endpoints.

---

## Passo 1 — Seleção de publicação

A shortlist continua existindo.

Agora o T&T separa:

```text
high / medium
→ ready

low / unknown / dados incompletos
→ held
```

No máximo 3 ofertas entram como `ready` por execução.

---

## Passo 2 — Mensagem pronta

Cada oferta `ready` recebe:

```text
messageDraft
```

Exemplo:

```text
🔥 T&T BARATEOU

🛒 Nome do produto
De: R$ 259,90
💰 Por: R$ 129,95
🔥 50% OFF
🚚 Frete grátis

👇 Comprar no Mercado Livre:
[LINK_AFILIADO_PENDENTE]
```

IMPORTANTE:

A mensagem NÃO mostra:

```text
comissão
score
priority
dados internos
```

---

## Passo 3 — Estado do link afiliado

A oferta fica com:

```text
publicationStatus: awaiting_affiliate_link
affiliateLink: null
affiliateLinkStatus: pending
```

Isso cria um ponto claro para encaixarmos a geração do link depois.

---

## Passo 4 — Fila privada + deduplicação

Com:

```text
?queue=1
```

as ofertas `ready` são gravadas no Vercel Blob privado.

Estrutura:

```text
tt/publication-queue/pending/
  bebes_criancas/
    MLBxxxx.json
```

O `itemId` vira a chave.

Se rodar de novo com o mesmo produto:

```text
alreadyQueued: true
```

e não cria duplicata.

---

## Arquivos

Substitua:

```text
api/discover-bestsellers.js
lib/ml-bestsellers-enrichment.js
```

Adicione:

```text
lib/tt-publication-planner.js
lib/tt-pending-publication-store.js
```

## Deploy

```powershell
git add .
git commit -m "Adiciona plano e fila de publicacao"
git push
```

---

## Teste único

Depois do deploy:

```text
https://t-t-barateou.vercel.app/api/discover-bestsellers?categoryId=MLB432825&queue=1&cb=20260814queue
```

Procure:

```text
publicationPlan
queuePersistence
```

Idealmente, com os dados do teste anterior:

```text
publicationPlan.readyCount: 2
publicationPlan.heldCount: 3

queuePersistence.status: queue_saved
queuePersistence.newQueuedCount: 2
```

Dentro de `publicationPlan.ready` queremos ver:

```text
publicationStatus: awaiting_affiliate_link
affiliateLinkStatus: pending
messageDraft
```

## Segundo clique opcional

Se abrir a mesma URL novamente:

```text
queuePersistence.duplicateCount
```

deve aumentar, comprovando que o mesmo item não foi duplicado.

---

## Ainda não faz

```text
geração automática de link afiliado
envio ao WhatsApp
grupo real
agendamento automático
```

Mas depois deste pacote o pipeline fica:

```text
descoberta
→ análise
→ shortlist
→ aprovação automática high/medium
→ mensagem pronta
→ fila persistente
→ AGUARDA LINK AFILIADO
```
