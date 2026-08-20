# T&T — Etapa 6.18W — mínimo 2 ofertas por grupo

## Nova regra

Cada ciclo continua tendo alvo de até 3 ofertas:

```text
Eletrônicos: mínimo 2, alvo 3
Fitness:     mínimo 2, alvo 3
Perfumes:    mínimo 2, alvo 3
```

## Como funciona

Primeiro o T&T usa as 8 buscas normais.

Se já conseguiu 2 ou 3:

```text
✅ segue normalmente
```

Se ainda estiver com 0 ou 1:

```text
🔎 continua procurando
🔎 percorre o restante do pool daquele grupo
🔎 tenta consumir todas as ofertas awaiting/ready encontradas
```

Pools atuais:

```text
Eletrônicos: 24 frentes
Fitness:     24 frentes
Perfumes:    42 frentes
```

## Correção importante

Antes, uma oferta `AFFILIATE_LINK_MISMATCH` podia ser rejeitada e o lote
encerrar mesmo existindo outras ofertas novas aguardando link.

Agora:

```text
produto A → rejected
produto B → tenta gerar link
produto C → tenta gerar link
...
```

A rejeição de um item não abandona os seguintes.

## Dedupe continua

O T&T NÃO repete produto já enviado apenas para preencher o mínimo.

Portanto:

```text
mínimo 2 = sempre que existirem 2 ofertas novas/válidas no pool
```

Se uma volta completa no pool não tiver 2 novas ofertas, o log deixa explícito:

```text
⚠️ Mínimo não atingido ... sem ofertas novas/válidas suficientes sem repetir produtos.
```

Garantir 2 mesmo com o pool completamente esgotado exigiria permitir repetição,
o que esta etapa deliberadamente não faz.

## Instalação

Substitua somente:

```text
whatsapp/publish-queue.js
```

Não precisa alterar Vercel, Supabase, grupos nem o script PM2.

Com o arquivo substituído:

```powershell
git add whatsapp/publish-queue.js
git commit -m "Garante busca minima de duas ofertas por grupo"
git push
```

Depois reinicie o processo existente:

```powershell
pm2 restart tt-barateou
```

Não use `--update-env` para esta alteração, pois não é necessário.

Veja os logs:

```powershell
pm2 logs tt-barateou --lines 100
```

No startup deverá aparecer:

```text
📦 Lote: mínimo 2, alvo até 3 por grupo
🔎 Busca normal: até 8 frentes; abaixo do mínimo, percorre o pool inteiro
```
