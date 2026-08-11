# T&T Barateou — Etapa 6.7D

Objetivo:

```text
categoryId
↓
árvore salva no Blob
↓
categoria exata
↓
caminho completo
↓
categoria principal
```

Nesta etapa:

- NÃO alteramos o WhatsApp.
- NÃO alteramos o `api/offer.js`.
- NÃO baixamos a árvore novamente do Mercado Livre.
- Usamos apenas a versão já salva no Blob privado.

## Arquivo novo

Copie apenas:

```text
api/category-lookup.js
```

## Deploy

```powershell
git add .
git commit -m "Adiciona consulta de categoria salva"
git push
```

## Primeiro teste

Use a categoria do vestido:

```text
https://t-t-barateou.vercel.app/api/category-lookup?categoryId=MLB108704
```

Esperamos algo parecido com:

```json
{
  "ok": true,
  "categoryId": "MLB108704",
  "categoryName": "Vestidos",
  "rootCategory": {
    "id": "MLB1430",
    "name": "Calçados, Roupas e Bolsas"
  },
  "depth": 3,
  "path": [
    {
      "id": "MLB1430",
      "name": "Calçados, Roupas e Bolsas"
    }
  ]
}
```

O caminho real pode ter mais níveis.

## O que isso nos dá

Depois desta etapa, o T&T consegue transformar:

```text
MLB108704
```

em algo como:

```text
Vestidos
→ Roupas
→ Calçados, Roupas e Bolsas
```

A próxima etapa poderá ligar a categoria principal
à tabela de comissão.
