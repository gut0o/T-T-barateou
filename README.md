# T&T Barateou — Etapa 6.7I

Esta etapa FECHA a primeira versão da camada de comissão.

## O que mudou

A tabela agora usa os IDs das categorias principais do Mercado Livre,
não apenas o nome textual.

Também adicionamos:

```text
commissionGroup
commissionTableVersion
commissionSource
estimatedDirectCommission
estimatedIndirectCommission
```

## Segurança da regra

Só cadastramos percentuais confirmados na tabela fornecida:

```text
16% / 8%
12% / 6%
5% / 2,5%
```

Categorias sem percentual confirmado continuam:

```text
commissionKnown: false
```

Isso inclui `Saúde` nesta versão.

Não inventamos comissão.

## Arquivos

Substitua:

```text
api/offer.js
lib/ml-offer-category-enrichment.js
lib/ml-affiliate-commissions.js
```

## Deploy

```powershell
git add .
git commit -m "Fecha camada de comissao das ofertas"
git push
```

## Teste 1 — vestido

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F1wpNZf4
```

Com preço de R$ 109,90 e comissão direta de 16% esperamos:

```text
estimatedDirectCommission: 17.58
estimatedIndirectCommission: 8.79
```

## Teste 2 — ar-condicionado

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F2RzSExj
```

Com R$ 2.699 e 5% direta:

```text
estimatedDirectCommission: 134.95
estimatedIndirectCommission: 67.48
```

## Teste 3 — creatina

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F2EMjkct
```

Como a categoria resolvida é Saúde e ainda não há percentual
confirmado na tabela:

```text
commissionKnown: false
estimatedDirectCommission: null
estimatedIndirectCommission: null
```

## Importante

Esses valores são estimativas com base no preço atual do produto e
na taxa padrão cadastrada. Não representam garantia de pagamento,
pois a venda ainda precisa ser atribuída e validada pelo programa.

O WhatsApp continua inalterado nesta etapa.
