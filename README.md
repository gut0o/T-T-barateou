# T&T Barateou — Etapa 6.8C

## Limite do Vercel

Esta etapa NÃO cria uma nova Serverless Function.

Continuamos com:

```text
10 funções usadas
12 permitidas
2 vagas livres
```

Alteramos apenas:

```text
api/discover-bestsellers.js
```

e adicionamos:

```text
lib/ml-bestsellers-enrichment.js
```

Arquivos em `lib/` não viram endpoints separados.

## O que muda

Antes:

```text
/highlights
→ 20 IDs
```

Agora:

```text
/highlights
→ 20 IDs
→ pega somente TOP 3
→ resolve detalhes
```

Para os três primeiros tentamos obter:

```text
título
preço
preço anterior
desconto
imagem
permalink
categoria
domainId
frete grátis
```

## ITEM

Os ITEMs são consultados em lote usando:

```text
/items?ids=...
```

## USER_PRODUCT

Para um `MLBU...`:

```text
/user-products/{id}
↓
seller
↓
/users/{seller}/items/search?user_product_id=...
↓
itens associados
↓
escolhe um representante ativo com menor preço
```

Isso é apenas uma estratégia de descoberta.
Ainda não significa que esse item será publicado.

## Arquivos

Substitua:

```text
api/discover-bestsellers.js
```

Adicione:

```text
lib/ml-bestsellers-enrichment.js
```

`lib/ml-bestsellers-discovery.js` é incluído no ZIP apenas como referência;
se já está no projeto, não precisa alterar.

## Deploy

```powershell
git add .
git commit -m "Enriquece top 3 dos mais vendidos"
git push
```

## Teste

Depois do deploy:

```text
https://t-t-barateou.vercel.app/api/discover-bestsellers
```

Continue procurando:

```text
candidateCount: 20
```

e agora também:

```text
enrichmentLimit: 3
enrichedCandidateCount: 3
enrichedCandidates: [...]
```

Cada candidato resolvido deve ter algo semelhante a:

```json
{
  "rank": 1,
  "sourceType": "ITEM",
  "resolved": true,
  "title": "...",
  "price": 109.9,
  "originalPrice": 149.99,
  "discount": 27,
  "image": "...",
  "permalink": "...",
  "categoryId": "..."
}
```

## Ainda não fazemos

```text
link afiliado
score final
publicação automática
WhatsApp
```
