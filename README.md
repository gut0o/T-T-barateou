# Correção Etapa 6.7J

Bug encontrado:

```text
discountPercent is not defined
```

Causa:

O código chamou `discountPercent()`, mas a função existente no
`offer.js` se chama:

```text
calculateDiscount()
```

A correção altera somente essa chamada.

## Substituir

```text
api/offer.js
```

## Deploy

```powershell
git add api/offer.js
git commit -m "Corrige calculo da pontuacao de oferta"
git push
```

## Teste

Depois do deploy:

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F1wpNZf4
```

Agora o endpoint deve voltar a responder `ok: true` e também mostrar:

```text
offerScore
priority
scoreBreakdown
scoreVersion
```
