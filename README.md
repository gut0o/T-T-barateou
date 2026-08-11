# T&T Barateou — Etapa 6.7B

Objetivo:

```text
Mercado Livre
↓
dump completo MLB
↓
contar toda a árvore
↓
mostrar categorias principais
```

Ainda NÃO salvamos o dump.

Ainda NÃO alteramos o WhatsApp.

## Arquivo novo

Copie:

```text
api/categories-tree.js
```

para a pasta `api` do projeto.

Não substitua o `api/offer.js`.

## Deploy

```powershell
git add .
git commit -m "Adiciona leitura da arvore completa de categorias"
git push
```

## Testar

Depois do deploy, abra:

```text
https://t-t-barateou.vercel.app/api/categories-tree
```

A resposta deve conter campos como:

```text
ok
siteId
rootCategories
totalCategories
leafCategories
maxDepth
uniqueCategoryIds
topLevel
metadata
persisted
```

`persisted` deve ser:

```text
false
```

porque nesta etapa estamos apenas lendo e contando.

## Próxima etapa

Se funcionar, aí fazemos a persistência da árvore no backend
para não precisar baixar o dump inteiro toda vez.
