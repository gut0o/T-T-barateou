# T&T Barateou — Etapa 6.5A

Nesta etapa o produto deixa de ser fixo.

O novo endpoint recebe um link do Mercado Livre:

```text
/api/offer?link=https://meli.la/...
```

e tenta devolver:

- nome;
- imagem;
- preço;
- preço anterior, se a API realmente informar;
- desconto, se houver preço anterior válido;
- productId/itemId;
- o link afiliado original.

## 1. Copiar

Copie:

```text
api/offer.js
```

para:

```text
tt-afiliados-site/api/offer.js
```

Não apague `api/offer-test.js` ainda.

## 2. Commit/push

```powershell
git add .
git commit -m "Adiciona endpoint dinamico de ofertas"
git push
```

Espere o deploy do Vercel terminar.

## 3. Primeiro teste

Abra:

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F2EMjkct
```

O resultado esperado é semelhante a:

```json
{
  "ok": true,
  "affiliateLink": "https://meli.la/2EMjkct",
  "productId": "MLB18725310",
  "title": "Creatina 1kg ...",
  "image": "https://http2.mlstatic.com/...",
  "price": 59.9,
  "currency": "BRL",
  "accessTokenExposed": false,
  "refreshTokenExposed": false
}
```

## Segurança

O endpoint aceita apenas:

- `meli.la`;
- domínios oficiais do Mercado Livre.

Isso evita que o parâmetro `link` seja usado para fazer requisições arbitrárias a outros sites.

## Importante

Nesta etapa ainda NÃO há envio para WhatsApp.

Primeiro vamos testar este endpoint com alguns links diferentes.
