# T&T Barateou — Etapa 6.7J

Objetivo:

```text
oferta
↓
desconto
+ comissão
+ ganho estimado
↓
pontuação interna
↓
prioridade
```

## Importante

A pontuação NÃO aparece no anúncio do WhatsApp.

Ela serve apenas para o sistema decidir quais ofertas
merecem prioridade no futuro.

## Escala

```text
0 a 100
```

A primeira regra é:

```text
Desconto ................ até 40 pontos
Comissão direta ......... até 30 pontos
Ganho direto estimado ... até 30 pontos
```

Prioridade:

```text
60–100 = high
35–59  = medium
0–34   = low
```

Essa regra é apenas a versão inicial:

```text
scoreVersion: TT-1.0
```

Depois podemos ajustar com dados reais.

## Arquivos

Substitua:

```text
api/offer.js
```

Adicione:

```text
lib/offer-scoring.js
```

## Deploy

```powershell
git add .
git commit -m "Adiciona pontuacao interna das ofertas"
git push
```

## Primeiro teste — vestido

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F1wpNZf4
```

Com os dados atuais do vestido esperamos aproximadamente:

```text
discount: 27
directCommissionPercent: 16
estimatedDirectCommission: 17.58

offerScore: ~62
priority: high
```

O JSON também mostra:

```text
scoreBreakdown
scoreVersion
```

## WhatsApp

Nada foi alterado no bot.
