# T&T Barateou — Etapa 6.5E

Esta versão melhora o fallback dos links `/social/`.

O diagnóstico do link:

```text
https://meli.la/1wpNZf4
```

mostrou:

```text
ogTitle:
Vestido Longo Tecido Crepinho C/forro Lastex Moda Evangélica

item:
MLB3976572103
```

A versão nova do `api/offer.js` mantém em memória as páginas
desktop/mobile usadas para resolver o link e, se a API/página
direta do anúncio não entregar tudo, tenta aproveitar os dados
da própria página social.

Ela procura, perto do ID correto do anúncio:

- `price`;
- `current_price`;
- `sale_price`;
- preço anterior;
- estruturas `fraction` + `cents`.

Também usa `og:title` e `og:image` como fallback.

## Copiar

Substitua:

```text
api/offer.js
```

pelo arquivo deste ZIP.

## Deploy

```powershell
git add .
git commit -m "Melhora fallback de links sociais e precos"
git push
```

## Teste

Depois do deploy:

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F1wpNZf4
```

Ainda NÃO alteramos o WhatsApp.

Se retornar `ok:true`, execute novamente:

```powershell
node whatsapp/send-offer.js
```

e confira a prévia antes de responder `S`.
