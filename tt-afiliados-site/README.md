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


# Etapa 5 — tokens persistentes e refresh automático

Nesta etapa o OAuth deixa de existir apenas durante uma requisição.

## Armazenamento

Os tokens são:

1. criptografados no backend usando AES-256-GCM;
2. gravados em um Vercel Blob **privado**;
3. salvos em arquivos imutáveis versionados;
4. nunca exibidos nas páginas de resposta.

Isso é importante porque o Mercado Livre devolve um novo `refresh_token` a
cada renovação, e somente o último refresh token pode continuar sendo usado.

## Configuração no Vercel

### 1. Criar Blob privado

No projeto:

`Storage → Create Database → Blob → Private`

Conecte o Blob ao projeto. O Vercel adicionará automaticamente:

`BLOB_READ_WRITE_TOKEN`

### 2. Criar chave de criptografia

No seu terminal local:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copie a saída.

No Vercel, crie uma variável **Sensitive**:

```text
ML_TOKEN_ENCRYPTION_KEY=COLE_A_CHAVE_AQUI
```

Não salve essa chave no GitHub.

### 3. Redeploy

Depois que o Blob e a variável estiverem configurados, faça um redeploy.

### 4. Fazer OAuth uma vez novamente

Abra, por exemplo:

```text
https://t-t-barateou.vercel.app/api/login?link=https%3A%2F%2Fmeli.la%2F2EMjkct
```

Ao concluir, a tela deve mostrar:

`Tokens persistidos com segurança ✅`

### 5. Testar persistência

Sem fazer login novamente, abra:

```text
https://t-t-barateou.vercel.app/api/ml-status
```

A rota NÃO mostra access token nem refresh token. Ela mostra apenas metadata
como usuário, expiração e se a renovação automática está pronta.

A futura integração com WhatsApp poderá chamar `getValidMlTokenData()`.
Se o access token estiver próximo de expirar, o helper troca o refresh token
por um novo par de tokens e salva a nova versão automaticamente.


# Etapa 6.1 — conectar WhatsApp e listar grupos

Esta etapa roda **localmente**, não no Vercel.

Ela faz somente:

1. conecta um número do WhatsApp via Baileys;
2. salva a sessão localmente em `whatsapp/auth_info/`;
3. lista todos os grupos da conta;
4. mostra o nome e o `JID` de cada grupo;
5. NÃO envia mensagens ainda.

## Segurança

A pasta abaixo está no `.gitignore` e não deve ir para o GitHub:

```text
whatsapp/auth_info/
```

Ela contém as credenciais da sessão vinculada ao WhatsApp.

## Instalar dependências

Depois de copiar os novos arquivos:

```powershell
npm install
```

## Iniciar

```powershell
npm run whatsapp
```

Na primeira execução, o terminal pedirá:

```text
DDI + DDD + número
```

Exemplo apenas de formato:

```text
5548999999999
```

Sem `+`, espaços, hífens ou parênteses.

O terminal exibirá um código de pareamento.

No celular:

```text
WhatsApp
→ Configurações
→ Aparelhos conectados
→ Conectar um aparelho
→ Conectar com número de telefone
```

Digite o código mostrado no terminal.

Depois da conexão, o programa mostrará:

```text
1. Nome do grupo
   JID: 1234567890-1234567890@g.us
   Participantes: 123
```

O `JID` será usado na Etapa 6.2 para selecionar o grupo T&T.

## Observação

Baileys é uma integração não oficial com o WhatsApp. A sessão deve ser usada
com cautela e sem spam ou envio em massa não solicitado.
