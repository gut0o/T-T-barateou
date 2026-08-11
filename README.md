# T&T Barateou — OAuth Etapa 2

Copie os arquivos `login.js` e `callback.js` para a pasta `api/` do projeto.

## Variáveis no Vercel

Em **Settings → Environment Variables**, crie:

- `ML_CLIENT_ID`
- `ML_CLIENT_SECRET`
- `ML_REDIRECT_URI`

Use esta Redirect URI:

`https://t-t-barateou.vercel.app/api/callback`

Não coloque o Client Secret no GitHub.

## Teste

Depois do deploy, abra:

`https://t-t-barateou.vercel.app/api/login`

Para testar também o item que antes deu 403:

`https://t-t-barateou.vercel.app/api/login?item=MLB2766771378`

O fluxo autentica sua conta, testa `/users/me` e, se houver `item`, consulta `/items/{ID}` com o access token.

Os tokens não são exibidos nem persistidos nesta etapa.
