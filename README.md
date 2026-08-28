# T&T — Etapa 6.18Z — Banco de Reserva

Esta etapa adiciona um banco manual de links no Supabase para proteger o T&T
contra períodos em que a descoberta automática não consiga achar ofertas novas.

## Regra do fallback

O fluxo automático continua nesta ordem:

```text
1. fila normal
2. descoberta contínua products/search
3. highlights complementar
4. até 24 páginas para tentar atingir o mínimo
5. ainda ficou abaixo de 2?
   ↓
   BANCO DE RESERVA
```

A reserva é usada **somente para completar o mínimo de 2**. Se o T&T já mandou
2 ofertas no grupo, ele preserva o estoque de reserva em vez de gastá-lo para
chegar a 3.

O dedupe continua valendo: uma reserva que já está na fila/histórico não é
forçada a publicar novamente.

## Comandos no grupo de controle

Adicionar um ou vários links:

```text
RESERVA ELETRONICOS https://mercadolivre...
RESERVA FITNESS https://mercadolivre...
RESERVA PERFUMES https://mercadolivre...
```

Até 10 links podem ser colocados na mesma mensagem.

Consultar:

```text
RESERVA STATUS
RESERVA LISTA
RESERVA LISTA ELETRONICOS
RESERVA LISTA FITNESS
RESERVA LISTA PERFUMES
```

Remover:

```text
RESERVA REMOVER 123
```

Ajuda:

```text
RESERVA
```

O comando normal `STATUS` também mostra quantas reservas disponíveis existem em
cada grupo.

## Estados da reserva

```text
available  = pronta para uso futuro
claimed    = sendo validada pelo backend
queued     = já virou oferta na fila normal
used       = enviada com sucesso no WhatsApp
rejected   = não passou nas regras/link afiliado
expired    = o link não pôde mais ser resolvido
 duplicate = produto já estava na fila/histórico
removed    = removida manualmente
```

## Validação na hora do uso

O link não fica congelado com preço antigo. Quando a reserva é necessária, o
backend abre a URL novamente e obtém os dados atuais da oferta antes de
colocá-la na fila.

Depois ela passa pelo fluxo normal:

```text
resolver oferta atual
→ dedupe
→ gerar link afiliado
→ validar link afiliado
→ enviar
```

Se o Mercado Livre rejeitar a URL ou o link resolver para outro produto, a
reserva é marcada como `rejected` e o bot tenta outra.

## FIFO e recuperação

A reserva usa FIFO: o link disponível mais antigo é tentado primeiro. Se o backend
cair depois de marcar um link como `claimed`, claims parados por mais de 10 minutos
voltam automaticamente para `available`.

## Arquivos desta etapa

```text
supabase/6.18Z_fallback_reserve.sql
lib/tt-fallback-reserve-store.js
lib/tt-queue-admin-actions.js
api/discover-bestsellers.js
whatsapp/publish-queue.js
```

## Aplicar — ordem importante

### 1. Supabase

Abra **Supabase → SQL Editor** e execute o conteúdo de:

```text
supabase/6.18Z_fallback_reserve.sql
```

### 2. Copie os arquivos do ZIP para o projeto

Substitua os existentes quando solicitado.

### 3. Git

```powershell
git add api/discover-bestsellers.js lib/tt-fallback-reserve-store.js lib/tt-queue-admin-actions.js whatsapp/publish-queue.js supabase/6.18Z_fallback_reserve.sql
git commit -m "Adiciona banco de reserva para fallback"
git push
```

### 4. Espere o deploy da Vercel terminar

Não reinicie o publisher antes do deploy concluir, pois as novas actions ficam
no endpoint existente `/api/discover-bestsellers`.

### 5. Reinicie o PM2

```powershell
pm2 restart tt-barateou
pm2 logs tt-barateou --lines 100
```

No startup esperado:

```text
🛟 Banco de Reserva: SIM | usado só abaixo do mínimo
```

## Teste depois do deploy

Primeiro, sem precisar esperar o pool acabar:

```text
RESERVA PERFUMES <um link do Mercado Livre>
RESERVA FITNESS <um link do Mercado Livre>
RESERVA ELETRONICOS <um link do Mercado Livre>
RESERVA STATUS
RESERVA LISTA
```

Isso valida cadastro, resolução, persistência e leitura.

O teste de consumo automático pode ser feito depois de forma controlada sem
apagar o histórico de produtos.

## Não mudou

- mínimo 2 / alvo 3;
- descoberta contínua paginada;
- highlights como fallback complementar;
- dedupe e reuso após 30 dias com mudança de oferta;
- horário automático 09:00–22:00;
- modo manual 24h;
- PM2;
- grupos reais;
- validação de affiliate mismatch;
- rejeição de URL não permitida;
- reconexão do WhatsApp.
