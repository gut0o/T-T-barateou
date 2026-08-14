# T&T Barateou — Fix 6.11

## Problema

A importação em lote retornava:

```text
401
Protected deployment
```

Os links afiliados estavam corretos.

O problema era a chamada interna para:

```text
/api/offer
```

usar primeiro:

```text
VERCEL_URL
```

Essa variável pode apontar para a URL única do deployment, protegida pelo Vercel.

## Correção

Agora a ordem é:

```text
TT_PUBLIC_BASE_URL
↓
VERCEL_PROJECT_PRODUCTION_URL
↓
VERCEL_URL (último fallback)
```

Na configuração atual, o esperado é usar automaticamente:

```text
VERCEL_PROJECT_PRODUCTION_URL
```

que deve apontar para o domínio público de produção.

## Arquivo

Substitua somente:

```text
lib/tt-queue-admin-actions.js
```

## Deploy

```powershell
git add .
git commit -m "Corrige URL publica nas chamadas internas"
git push
```

## Opcional

Não é necessário criar outra variável se `VERCEL_PROJECT_PRODUCTION_URL`
estiver exposta pelo Vercel.

Mas, se quisermos fixar explicitamente a URL no futuro, podemos criar:

```text
TT_PUBLIC_BASE_URL=https://t-t-barateou.vercel.app
```

## Reteste

Use exatamente o mesmo teste dos dois links da etapa 6.11.
