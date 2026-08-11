# T&T Barateou — Etapa 6.5D

Esta versão mantém toda a lógica anterior e acrescenta
um fallback para anúncios que existem publicamente, mas
não ficam acessíveis no endpoint `/items/{id}` da API.

## Como funciona

```text
meli.la
  ↓
página social
  ↓
URL interna do anúncio
  ↓
tenta API /items/{id}
  ↓
se bloquear:
  ↓
abre a página pública do anúncio
  ↓
JSON-LD / Open Graph
  ↓
nome + imagem + preço
```

O link afiliado original continua preservado.

## Copiar

Substitua:

```text
api/offer.js
```

pelo arquivo deste ZIP.

## Deploy

```powershell
git add .
git commit -m "Adiciona fallback para pagina publica do produto"
git push
```

## Testar

Depois do deploy:

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F1B9vyix
```

Esperamos agora:

```text
ok: true
title: Tênis Masculino Feminino Kappa Park 2.0 Original
itemId: MLB4049279695
image: https://...
price: ...
priceSource: mercadolivre_public_page
```

Ainda não há alteração no WhatsApp.
