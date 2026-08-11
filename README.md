# T&T Barateou — Etapa 6.7F

Agora ligamos categoria + árvore + comissão ao `/api/offer`.

Fluxo:

```text
link afiliado
↓
produto
↓
preço / imagem
↓
categoryId
↓
árvore salva no Blob
↓
categoria principal
↓
comissão
```

## Arquivos

Substitua:

```text
api/offer.js
```

Adicione:

```text
lib/ml-offer-category-enrichment.js
```

Os arquivos das etapas anteriores continuam necessários:

```text
lib/ml-categories-store.js
lib/ml-affiliate-commissions.js
```

## Importante

Nesta etapa NÃO alteramos o WhatsApp.

Produtos que ainda retornam somente `domainId` continuam
funcionando. Para eles a comissão fica desconhecida por enquanto.

Isso evita inventar uma comissão.

## Deploy

```powershell
git add .
git commit -m "Integra categoria e comissao ao endpoint de oferta"
git push
```

## Primeiro teste — vestido

Abra:

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F1wpNZf4
```

Além dos dados que já existiam, esperamos:

```json
{
  "categoryId": "MLB108704",
  "categoryName": "Vestidos",
  "rootCategory": {
    "id": "MLB1430",
    "name": "Calçados, Roupas e Bolsas"
  },
  "commissionKnown": true,
  "directCommissionPercent": 16,
  "indirectCommissionPercent": 8,
  "categoryEnrichmentSource": "vercel_blob_saved_tree"
}
```

## Depois

Quando este teste passar, testamos ar-condicionado e creatina.

Por enquanto eles podem retornar:

```text
commissionKnown: false
```

porque nos testes anteriores vieram com `domainId`, mas sem
`categoryId`.

A etapa seguinte poderá resolver também esses produtos por
`domainId`, sem quebrar o que já funciona.
