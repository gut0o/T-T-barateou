# T&T Barateou — Etapa 6.7L

Objetivo:

Diferenciar:

```text
oferta realmente fraca
```

de:

```text
oferta que ainda não tem dados suficientes para ser avaliada
```

## Nova regra

Se não houver:

```text
desconto confirmado
E
comissão conhecida
```

o sistema retorna:

```text
offerScore: null
priority: unknown
scoreStatus: insufficient_data
```

Isso evita que uma oferta boa seja tratada como ruim apenas porque
o Mercado Livre não retornou desconto ou porque a comissão daquela
categoria ainda não está cadastrada.

## Quando existe dado suficiente

Se houver desconto OU comissão conhecida, a pontuação continua sendo
calculada normalmente.

Exemplo do ar-condicionado:

```text
sem desconto
mas comissão conhecida
→ score calculado normalmente
```

Exemplo da creatina atual:

```text
sem desconto
comissão desconhecida
→ insufficient_data
→ priority: unknown
```

## Novos campos

```text
scoreStatus
scoreSignals
scoreVersion: TT-1.1
```

`scoreSignals` mostra internamente quais sinais estavam disponíveis.

## Arquivos

Substitua:

```text
api/offer.js
lib/offer-scoring.js
```

## Deploy

```powershell
git add .
git commit -m "Diferencia score baixo de dados insuficientes"
git push
```

## Primeiro teste — creatina

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F2EMjkct
```

Esperado:

```text
offerScore: null
priority: unknown
scoreStatus: insufficient_data

scoreSignals:
  hasDiscountData: false
  hasCommissionData: false
```

## Segundo teste — ar-condicionado

Deve continuar calculando normalmente porque a comissão é conhecida.

## WhatsApp

Nada foi alterado no bot.
