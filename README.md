# T&T Barateou — Etapa 6.5C

Correção do endpoint dinâmico para links sociais do Mercado Livre.

O diagnóstico mostrou um caso em que o `meli.la` abre:

```text
/social/gp...
```

e a página mobile contém uma URL interna codificada como:

```text
ddnf.adj.st/webview/?url=https%3A%2F%2Fproduto.mercadolivre.com.br%2FMLB-...
```

A nova versão de `api/offer.js`:

1. resolve o link como desktop;
2. se cair em `/social/`, também busca a versão mobile;
3. decodifica URLs percent-encoded até 3 níveis;
4. encontra links internos de anúncio e catálogo;
5. dá prioridade alta a esses IDs;
6. consulta a API do Mercado Livre normalmente;
7. preserva o link afiliado original.

## Copiar

Substitua:

```text
api/offer.js
```

pelo arquivo deste ZIP.

## Deploy

```powershell
git add .
git commit -m "Corrige resolucao de links sociais do Mercado Livre"
git push
```

## Teste que falhava

Depois do deploy, abra:

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F1B9vyix
```

O produto esperado é:

```text
Tênis Masculino Feminino Kappa Park 2.0 Original
```

e o anúncio detectado pelo diagnóstico foi:

```text
MLB4049279695
```

Ainda NÃO há alteração no WhatsApp.
