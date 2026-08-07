# T&T Ofertas — Etapa 1

Nesta etapa o projeto faz somente isto:

1. recebe um link do Mercado Livre (inclusive link curto/de afiliado);
2. segue os redirecionamentos via HTTP;
3. tenta descobrir o ID `MLB...` do anúncio;
4. consulta a API de itens do Mercado Livre;
5. mostra nome, preço e imagem;
6. salva os dados em `resultado.json`.

**Não existe bot de WhatsApp nesta versão.**
**Não existe automação de navegador.**
**Não existe login na sua conta do Mercado Livre nesta versão.**

## Requisito

Node.js 18 ou superior.

Confira:

```bash
node --version
```

## Como testar

Abra esta pasta no VS Code.

No terminal:

```bash
npm start
```

Vai aparecer:

```text
Cole o link do produto/afiliado do Mercado Livre:
>
```

Cole um dos seus links e pressione Enter.

Também dá para passar o link diretamente:

```bash
node index.js "https://mercadolivre.com/sec/SEU_LINK"
```

## Resultado esperado

Algo parecido com:

```text
Produto : Nome do produto
ID      : MLB1234567890
Preço   : R$ 199,90
Imagem  : https://...
Afiliado: https://mercadolivre.com/sec/...

✅ Também salvei tudo em resultado.json
```

## Importante

Links de afiliado podem usar diferentes formatos e redirecionamentos.
Esta primeira versão tenta identificar o `MLB` tanto pela URL final quanto pelo
HTML retornado pelo Mercado Livre.

Se um link seu não funcionar, copie para o ChatGPT:

- o link que você testou;
- a saída completa do terminal.

A próxima correção será feita usando esse caso real.

## Access token (opcional)

O código já suporta a variável de ambiente `ML_ACCESS_TOKEN`, mas você NÃO
precisa configurar isso agora.

Depois vamos conectar sua conta de forma correta via OAuth, sem colocar sua
senha no código.
