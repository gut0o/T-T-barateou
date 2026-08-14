# T&T Barateou — Etapa 6.8D

## Limite Vercel

Nenhuma Serverless Function nova.

```text
10 usadas
12 permitidas
2 vagas
```

## Alteração

Substitua somente:

```text
lib/ml-bestsellers-enrichment.js
```

Agora o enriquecimento também entende:

```text
PRODUCT
```

Fluxo:

```text
PRODUCT
↓
/products/{PRODUCT_ID}
↓
produto de catálogo
↓
buy_box_winner
↓
item vencedor + preço + categoria + frete
```

## Deploy

```powershell
git add .
git commit -m "Adiciona enriquecimento de produtos de catalogo"
git push
```

## Teste

```text
https://t-t-barateou.vercel.app/api/discover-bestsellers?categoryId=MLB432825&cb=20260814d
```

No ranking atual:

```text
#1 USER_PRODUCT
#2 PRODUCT
#3 PRODUCT
```

Se os PRODUCT forem acessíveis, esperamos aproximadamente:

```text
enrichedResolvedCount: 2
```

Nos candidatos #2 e #3 queremos ver:

```text
sourceType: PRODUCT
resolved: true
resolutionType: catalog_product_with_buy_box
title
price
image
permalink
categoryId
domainId
itemId
```

Ainda não gera link afiliado e não envia WhatsApp.
