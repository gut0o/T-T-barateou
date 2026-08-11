# T&T Barateou — Etapa 6.7H

Agora o `/api/offer` resolve automaticamente produtos que vierem
com `domainId`, mas sem `categoryId`.

Fluxo:

```text
link
↓
produto
↓
categoryId existe?
├─ sim → árvore salva
└─ não
   ↓
   domainId + título
   ↓
   API oficial de domínio do Mercado Livre
   ↓
   categoria segura
   ↓
   árvore salva
   ↓
   categoria principal
   ↓
   comissão
```

## Arquivos

Substitua:

```text
api/offer.js
lib/ml-offer-category-enrichment.js
```

A Etapa 6.7G precisa continuar no projeto:

```text
lib/ml-domain-category.js
```

## Deploy

```powershell
git add .
git commit -m "Integra resolucao por dominio nas ofertas"
git push
```

## Primeiro teste — ar-condicionado

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F2RzSExj
```

Esperamos algo parecido com:

```json
{
  "domainId": "MLB-AIR_CONDITIONERS",
  "rootCategory": {
    "name": "Eletrodomésticos"
  },
  "commissionKnown": true,
  "directCommissionPercent": 5,
  "indirectCommissionPercent": 2.5,
  "categoryEnrichmentSource": "domain_resolver_plus_vercel_blob_saved_tree",
  "domainCategoryResolutionType": "single_domain_category",
  "resolvedCategoryId": "MLB1646"
}
```

## Segundo teste — creatina

Depois testaremos:

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F2EMjkct
```

Esperamos que o título ajude o Mercado Livre a escolher:

```text
Suplementos Alimentares
→ Saúde
```

Como `Saúde` ainda não está na tabela de comissão fornecida,
esperamos:

```text
commissionKnown: false
```

Isso é correto e proposital.

## WhatsApp

Ainda não alteramos nada no bot.
