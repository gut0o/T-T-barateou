# T&T Barateou — Etapa 6.8A

## Objetivo

Primeira prova de descoberta automática.

Até agora o fluxo começava assim:

```text
você fornece um link
↓
T&T analisa a oferta
```

Agora começamos a testar:

```text
T&T faz uma busca
↓
encontra produtos candidatos
↓
retorna título + preço + imagem + link normal
```

Ainda NÃO:

```text
gera link de afiliado
envia ao WhatsApp
publica automaticamente
```

## Arquivos

Adicione:

```text
api/discover-offers.js
lib/ml-offer-discovery.js
```

Nenhum arquivo atual precisa ser substituído.

## Deploy

```powershell
git add .
git commit -m "Adiciona primeira descoberta automatica de ofertas"
git push
```

## Primeiro teste

Depois que o Vercel terminar:

```text
https://t-t-barateou.vercel.app/api/discover-offers
```

Sem parâmetro, o teste usa:

```text
smartphone
```

e tenta trazer até 5 candidatos.

Se funcionar, esperamos:

```json
{
  "ok": true,
  "query": "smartphone",
  "resultCount": 5,
  "candidates": [
    {
      "itemId": "...",
      "title": "...",
      "price": 0,
      "permalink": "...",
      "categoryId": "..."
    }
  ]
}
```

## Se retornar 401 ou 403

Não é vazamento de token e não significa que nosso projeto quebrou.

O endpoint devolverá algo como:

```text
ok: false
httpStatus: 403
```

Nesse caso a Etapa 6.8A serviu para confirmar que essa modalidade
de busca não está habilitada para nossa credencial, e mudamos a
estratégia de descoberta na próxima microetapa.

## Teste opcional depois

Somente se o primeiro funcionar:

```text
https://t-t-barateou.vercel.app/api/discover-offers?q=air%20fryer&limit=5
```
