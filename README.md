# T&T Barateou — Etapa 6.4A

Esta etapa corrige a obtenção da imagem.

Em vez de raspar o HTML da página do Mercado Livre, o backend usa:

```text
GET https://api.mercadolibre.com/products/MLB18725310
```

com o token do Mercado Livre que já está persistido no Vercel.

## Instalação

Copie:

```text
api/offer-test.js
```

para a pasta `api` do projeto.

Não altere `lib/ml-token-store.js`.

Depois faça commit/push para o GitHub para o Vercel publicar.

## Teste

Abra:

```text
https://t-t-barateou.vercel.app/api/offer-test
```

Esperado:

```json
{
  "ok": true,
  "productId": "MLB18725310",
  "title": "...",
  "image": "https://...",
  "price": 59.9,
  "affiliateLink": "https://meli.la/2EMjkct",
  "accessTokenExposed": false,
  "refreshTokenExposed": false
}
```

O endpoint não expõe os tokens.
