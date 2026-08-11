# T&T Barateou — Etapa 6.5B (diagnóstico)

Não altera o `/api/offer` e não envia nada para WhatsApp.

## Copiar

Copie:

```text
api/offer-debug.js
```

para a pasta `api` do projeto.

## Deploy

```powershell
git add .
git commit -m "Adiciona diagnostico de links sociais do Mercado Livre"
git push
```

Espere o Vercel publicar.

## Testar o link que falhou

Abra:

```text
https://t-t-barateou.vercel.app/api/offer-debug?link=https%3A%2F%2Fmeli.la%2F1B9vyix
```

Copie o JSON retornado e envie no chat.

O diagnóstico testa:

- desktop e mobile;
- URL original;
- `skipInApp=true`;
- `forceInApp=false` + `skipInApp=true`;
- meta tags;
- IDs MLB presentes no HTML;
- URLs relevantes;
- pequenos trechos de campos como `productId`, `itemId`, `target`, `redirect`, etc.

Não há token do Mercado Livre nesse endpoint.
