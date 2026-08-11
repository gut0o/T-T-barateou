# T&T Barateou

## Etapa atual: resolver corretamente o link de afiliado

O OAuth do Mercado Livre já está funcionando.

Nesta versão, em vez de informar manualmente um `MLB...`, o teste recebe
diretamente um link de afiliado:

```text
https://t-t-barateou.vercel.app/api/login?link=https://meli.la/2EMjkct
```

O fluxo:

1. autentica a conta via OAuth + PKCE;
2. segue o redirecionamento do link `meli.la`;
3. analisa URLs canônicas, `og:url` e dados estruturados da página;
4. separa candidatos a item de candidatos a produto de catálogo;
5. testa:
   - `/items/{ID}`
   - `/items?ids={ID}`
   - `/products/{ID}`
6. mostra qual ID realmente funciona e os erros dos demais.

O link de afiliado original é preservado para ser usado posteriormente na
mensagem do WhatsApp.

## Variáveis no Vercel

```text
ML_CLIENT_ID
ML_CLIENT_SECRET
ML_REDIRECT_URI
```

Redirect URI:

```text
https://t-t-barateou.vercel.app/api/callback
```

Nunca salve o `ML_CLIENT_SECRET` no GitHub.

## Teste antigo ainda suportado

```text
https://t-t-barateou.vercel.app/api/login?item=MLB2766771378
```

Mas o teste recomendado agora é usando `?link=`.


## Etapa 4 — preço e oferta vencedora

Quando o candidato encontrado é um produto de catálogo (`/products/{PRODUCT_ID}`),
o callback agora:

1. lê `buy_box_winner`;
2. obtém `item_id`, `price`, `original_price` e moeda quando disponíveis;
3. tenta consultar `/items/{ITEM_ID}/sale_price?context=channel_marketplace`;
4. se `buy_box_winner` vier vazio, consulta `/products/{PRODUCT_ID}/items` e usa
   uma oferta com preço como fallback;
5. calcula o percentual de desconto quando existe preço original;
6. gera uma prévia da mensagem que mais tarde será enviada ao WhatsApp.

O link de afiliado original continua sendo preservado.
