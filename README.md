# T&T Barateou — Etapa 6.7G

Objetivo:

```text
domainId
↓
API oficial de domínios do Mercado Livre
↓
categoryId
↓
árvore salva
↓
categoria principal
↓
comissão
```

Nesta etapa NÃO alteramos:

```text
api/offer.js
WhatsApp
```

Primeiro validamos o conversor isoladamente.

## Arquivos novos

Copie:

```text
lib/ml-domain-category.js
api/domain-category.js
```

## Deploy

```powershell
git add .
git commit -m "Adiciona conversao de dominio para categoria"
git push
```

## Primeiro teste — ar-condicionado

Abra:

```text
https://t-t-barateou.vercel.app/api/domain-category?domainId=MLB-AIR_CONDITIONERS
```

Se o domínio tiver apenas uma categoria oficial, esperamos:

```text
resolved: true
resolutionType: single_domain_category
selectedCategory: ...
```

E dentro de `selectedCategory` queremos encontrar:

```text
rootCategory
commissionKnown
directCommissionPercent
indirectCommissionPercent
```

## Segundo teste — suplementos

Depois testaremos:

```text
https://t-t-barateou.vercel.app/api/domain-category?domainId=MLB-SUPPLEMENTS
```

## Segurança contra classificação errada

Se um domínio apontar para várias categorias, o sistema NÃO escolhe
uma aleatoriamente.

Nesse caso ele retorna os candidatos.

Opcionalmente podemos passar também o título:

```text
/api/domain-category?domainId=...&title=...
```

e então ele usa o preditor oficial do Mercado Livre para tentar
escolher apenas entre as categorias daquele domínio.

Só depois de validarmos essa etapa vamos integrar ao `/api/offer`.
