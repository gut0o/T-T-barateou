# T&T Barateou — Pacote acelerado 6.8E → 6.8G

Este pacote junta várias microetapas em um único deploy/teste.

## Limite do Vercel

Nenhuma nova Serverless Function.

```text
10 usadas
12 permitidas
2 vagas livres
```

## O que este pacote faz

### 1. Descoberta

```text
/highlights
→ top 20 da categoria
```

### 2. Filtragem inteligente

Como nossa credencial já demonstrou bloqueio nos detalhes de:

```text
ITEM
USER_PRODUCT
```

o T&T passa a procurar dentro do top 20 os primeiros:

```text
até 5 PRODUCT
```

Assim não desperdiçamos chamadas nos tipos já conhecidos como bloqueados.

### 3. Resolução de PRODUCT

```text
/products/{PRODUCT_ID}
```

Se houver:

```text
buy_box_winner
```

usamos o vencedor.

Se NÃO houver:

```text
/products/{PRODUCT_ID}/items
```

e escolhemos temporariamente a publicação de menor preço como
representante para análise.

Isso ainda NÃO significa publicação automática.

### 4. Inteligência que já construímos

Cada candidato resolvido passa por:

```text
categoria Mercado Livre
→ categoria raiz
→ comissão
→ comissão estimada em R$
→ offerScore
→ priority
→ categoria T&T
```

### 5. Shortlist

O endpoint devolve:

```text
analyzedCandidates
shortlist
```

A shortlist contém apenas candidatos com:

```text
título
imagem
preço
```

e ordena por:

```text
priority
→ offerScore
→ posição nos mais vendidos
```

## Arquivos

Substitua:

```text
api/discover-bestsellers.js
lib/ml-bestsellers-enrichment.js
```

Nenhum arquivo novo em `api/`.

## Dependências já existentes no projeto

Este pacote reutiliza:

```text
lib/ml-offer-category-enrichment.js
lib/offer-scoring.js
lib/tt-category-routing.js
```

Esses arquivos já foram adicionados nas etapas anteriores.

## Deploy

```powershell
git add .
git commit -m "Cria shortlist automatica de ofertas"
git push
```

## Teste único

Depois do deploy:

```text
https://t-t-barateou.vercel.app/api/discover-bestsellers?categoryId=MLB432825&cb=20260814batch
```

## O que procurar

Idealmente:

```text
selectedProductCount: 5
enrichedResolvedCount: > 0
readyCandidateCount: > 0
shortlistStatus: offers_ready_for_next_stage
```

Dentro de `shortlist` queremos ofertas com:

```text
title
price
image
itemId
categoryId
rootCategory
commissionKnown
directCommissionPercent
estimatedDirectCommission
offerScore
priority
ttCategoryId
ttCategoryName
automationReadiness
```

## O que continua fora deste pacote

Ainda NÃO fazemos:

```text
geração automática de link afiliado
envio automático ao WhatsApp
seleção dos grupos reais
agendamento periódico
```

Se a shortlist funcionar, o próximo bloco pode atacar link afiliado +
mensagem + fila de publicação de uma vez.
