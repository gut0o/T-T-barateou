# T&T Barateou — Etapa 6.7A

Objetivo desta microetapa:

```text
link
↓
produto
↓
preço
↓
imagem
↓
categoria
```

Ainda não muda nada no WhatsApp.

## O que foi adicionado

O `/api/offer` agora tenta retornar também:

```json
{
  "categoryId": "MLB...",
  "categoryName": "...",
  "domainId": "..."
}
```

A categoria é buscada primeiro pelos dados oficiais do
produto/anúncio. Nos casos de fallback social, o código também
tenta localizar `category_id` perto do produto correto na página.

## Copiar

Substitua somente:

```text
api/offer.js
```

## Deploy

```powershell
git add .
git commit -m "Adiciona categoria nas ofertas"
git push
```

## Primeiro teste

Depois do deploy, abra o vestido:

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F1wpNZf4
```

Procure no final do JSON por:

```text
categoryId
categoryName
domainId
```

Não altere `listen-offers.js` nesta etapa.
