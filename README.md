# T&T Barateou — 6.15 Anti-duplicação

Corrige o caso em que o mesmo produto apareceu duas vezes.

## Causa 1 — itemId não representa necessariamente o produto

Antes:

```text
dedupe = itemId
```

Um mesmo PRODUCT de catálogo pode ter um item representante diferente
quando o seller/preço muda.

Agora:

```text
productId disponível
→ dedupe por productId

sem productId
→ fallback por itemId
```

Se o produto já estiver:

```text
awaiting_affiliate_link
ready_to_publish
sending
sent
send_error
rejected
```

ele NÃO entra novamente.

## Causa 2 — intervals após reconexão

Antes uma reconexão Baileys podia iniciar novos timers sem encerrar
os anteriores.

Agora:

```text
connection close
→ clearActiveTimers()
→ reconecta
→ cria apenas um conjunto novo
```

Também existe:

```text
discoveryInProgress
```

para impedir duas descobertas simultâneas.

## Limpeza dos duplicados que já existem

Foi criada a ação interna:

```text
queue-dedupe
```

O publisher executa automaticamente ao conectar.

Ele:
- agrupa por productId;
- se já existe `sent`, mantém o enviado;
- neutraliza cópias ainda ativas;
- se nenhum foi enviado, mantém a entrada mais avançada;
- marca as demais como `duplicate_skipped`.

Histórico já enviado não é apagado.

No terminal:

```text
🧹 Dedupe fila: 2 grupo(s), 2 entrada(s) neutralizada(s).
```

ou:

```text
🧹 Dedupe fila: nenhuma duplicata ativa.
```

## Arquivos

Substitua:

```text
api/discover-bestsellers.js
lib/tt-queue-admin-actions.js
lib/tt-pending-publication-store.js
whatsapp/publish-queue.js
```

O ZIP inclui também o `ml-affiliate-link.js` mais recente para manter o
pacote consistente.

## Git

Pare o bot com Ctrl+C e rode:

```powershell
git add .
git commit -m "Corrige duplicacao de ofertas"
git push
```

Espere o Vercel ficar Ready.

Depois:

```powershell
node whatsapp\publish-queue.js
```

## Teste

No início queremos ver:

```text
🧹 Dedupe fila: ...
```

Depois envie no Aggin:

```text
DESCOBRIR
```

O mesmo productId não pode entrar novamente mesmo que o Mercado Livre
retorne outro itemId/seller para ele.
