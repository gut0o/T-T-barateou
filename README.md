# T&T — Etapa 6.18H — cursores persistidos no Supabase

Esta etapa só persiste os cursores. Não altera pools, filtros, links afiliados
nem destinos.

Arquitetura:

```text
publish-queue.js local
    ↓ x-tt-admin-key
/api/app-state no Vercel
    ↓ SUPABASE_SECRET_KEY server-side
tt_app_state no Supabase
```

A `SUPABASE_SECRET_KEY` continua somente no Vercel.

Não precisa rodar SQL: `tt_app_state` já existe.

## Arquivos

Adicione:

```text
api/app-state.js
```

Substitua:

```text
whatsapp/publish-queue.js
```

Remova o endpoint temporário:

```text
api/supabase-status.js
```

## Git

```powershell
Remove-Item api\supabase-status.js -ErrorAction SilentlyContinue
git add -A
git commit -m "Persiste cursores no Supabase"
git push
```

Espere o Vercel ficar `Ready`.

Depois:

```powershell
node whatsapp\publish-queue.js
```

Na primeira inicialização deve aparecer:

```text
🧭 Cursores Supabase: Eletrônicos 0 | Fitness 0 | Perfumes 0
```

Depois que os lotes avançarem, o estado é salvo uma vez ao terminar cada grupo.

Para provar a persistência:

```text
1. deixe os cursores avançarem
2. Ctrl+C
3. node whatsapp\publish-queue.js
```

Na volta deve aparecer algo como:

```text
🧭 Cursores Supabase: Eletrônicos 11 | Fitness 10 | Perfumes 4
```

em vez de todos voltarem a zero.

O registro no `tt_app_state` usa a chave:

```text
publisher_group_cursors
```

e um valor semelhante a:

```json
{
  "eletronicos": 11,
  "fitness": 10,
  "perfumes": 4
}
```

A gravação é feita apenas ao final de cada grupo: aproximadamente 3 gravações
por ciclo completo, em vez de gravar a cada busca/produto.
