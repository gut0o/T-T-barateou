# Correção 6.8C — diagnóstico + fallback público

## Limite do Vercel

Nenhuma função nova:

```text
10 / 12 Serverless Functions
```

## Por que esta correção

O `/highlights` encontrou os mais vendidos, mas os três primeiros
não conseguiram obter detalhes.

Agora, para ITEM:

```text
/items?ids=...
↓
tenta COM token
↓
se bloquear
↓
tenta a mesma consulta SEM Authorization
```

Também mostramos o código retornado em cada tentativa.

## Arquivos

Substitua:

```text
api/discover-bestsellers.js
lib/ml-bestsellers-enrichment.js
```

## Deploy

```powershell
git add .
git commit -m "Adiciona fallback publico ao enriquecimento"
git push
```

## Teste

```text
https://t-t-barateou.vercel.app/api/discover-bestsellers
```

Procure:

```text
directItemRequestMode
```

Se o fallback funcionar:

```text
enrichedResolvedCount > 0
```

Se continuar bloqueado, cada ITEM não resolvido terá:

```json
"itemApiDiagnostic": {
  "authorized": {
    "code": 403,
    "message": "..."
  },
  "public": {
    "code": 403,
    "message": "..."
  }
}
```

Com isso sabemos exatamente qual caminho ainda está acessível,
sem criar endpoints novos e sem adivinhar.
