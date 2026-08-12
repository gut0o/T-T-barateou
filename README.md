# T&T Barateou — Etapa 6.8B

## Objetivo

A busca genérica da Etapa 6.8A retornou:

```text
403 forbidden
```

Agora testamos uma fonte oficial diferente:

```text
Mercado Livre
↓
Mais vendidos da categoria
↓
até 20 IDs ranqueados
```

Endpoint utilizado:

```text
/highlights/MLB/category/{CATEGORY_ID}
```

## Importante

Nesta etapa ainda NÃO:

```text
buscamos preço
calculamos desconto
geramos link afiliado
pontuamos a oferta
enviamos WhatsApp
```

Primeiro queremos somente provar que conseguimos
descobrir produtos sem você fornecer um link.

## Arquivos

Adicione:

```text
api/discover-bestsellers.js
lib/ml-bestsellers-discovery.js
```

Nada precisa ser substituído.

## Deploy

```powershell
git add .
git commit -m "Adiciona descoberta por mais vendidos"
git push
```

## Primeiro teste

Depois do deploy abra:

```text
https://t-t-barateou.vercel.app/api/discover-bestsellers
```

Por padrão ele consulta:

```text
MLB108704 = Vestidos
```

Essa categoria foi escolhida porque já sabemos no nosso projeto
que ela é uma categoria folha.

## Resultado esperado

Algo parecido com:

```json
{
  "ok": true,
  "source": "mercadolivre_highlights",
  "highlightType": "BEST_SELLER",
  "criteria": "CATEGORY",
  "categoryId": "MLB108704",
  "candidateCount": 20,
  "candidates": [
    {
      "id": "...",
      "position": 1,
      "type": "PRODUCT"
    }
  ]
}
```

Os tipos podem ser:

```text
ITEM
PRODUCT
USER_PRODUCT
```

## Se der 404

Isso pode significar que o Mercado Livre não mantém um ranking
de mais vendidos para essa categoria específica.

Nesse caso testaremos outra categoria folha.
