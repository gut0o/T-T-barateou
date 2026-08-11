# T&T Barateou — Etapa 6.7C

Objetivo:

```text
Mercado Livre
↓
dump completo MLB
↓
Vercel Blob privado
↓
árvore persistida
```

Nesta etapa:

- NÃO alteramos o WhatsApp.
- NÃO alteramos o `api/offer.js`.
- NÃO alteramos o `api/categories-tree.js`.
- Usamos o mesmo Blob privado já conectado ao projeto.
- Não criamos nenhuma variável de ambiente nova.

## Arquivos novos

Copie estes 2 arquivos:

```text
lib/ml-categories-store.js
api/categories-sync.js
```

## Deploy

```powershell
git add .
git commit -m "Persiste arvore de categorias no Blob"
git push
```

## Teste

Depois que o Vercel terminar o deploy, abra:

```text
https://t-t-barateou.vercel.app/api/categories-sync
```

Na primeira execução esperamos algo parecido com:

```json
{
  "ok": true,
  "rootCategories": 32,
  "totalCategories": 12237,
  "maxDepth": 7,
  "persisted": true,
  "alreadyCurrent": false
}
```

O número total pode mudar se o Mercado Livre atualizar a árvore.

## Segundo teste

Abra o MESMO endpoint novamente:

```text
https://t-t-barateou.vercel.app/api/categories-sync
```

Se o Mercado Livre ainda estiver servindo a mesma versão,
esperamos:

```json
{
  "persisted": true,
  "alreadyCurrent": true
}
```

Isso confirma que não estamos criando cópias repetidas da
mesma versão.

## Importante

O endpoint não devolve o conteúdo completo da árvore e não
expõe tokens.

A árvore fica em um caminho privado parecido com:

```text
tt/ml-categories/MLB-<md5>.json
```
