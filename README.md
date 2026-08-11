# T&T Barateou — Etapa 6.7E

Objetivo:

```text
categoryId
↓
árvore salva
↓
categoria principal
↓
tabela de comissão
↓
comissão direta / indireta
```

Nesta etapa:

- NÃO alteramos o WhatsApp.
- NÃO alteramos `api/offer.js`.
- NÃO baixamos a árvore novamente.
- Usamos a árvore salva no Blob.
- Usamos somente percentuais visíveis na tabela fornecida.

## Arquivos novos

Copie:

```text
lib/ml-affiliate-commissions.js
api/commission-lookup.js
```

## Categorias mapeadas

### 16% direta / 8% indireta

```text
Beleza e Cuidado Pessoal
Calçados, Roupas e Bolsas
Esportes e Fitness
```

### 12% direta / 6% indireta

```text
Acessórios para Veículos
Bebês
Brinquedos e Hobbies
Casa, Móveis e Decoração
Construção
Ferramentas
Games
Joias e Relógios
Livros, Revistas e Comics
Mais Categorias
```

### 5% direta / 2,5% indireta

```text
Câmeras e Acessórios
Celulares e Telefones
Eletrodomésticos
Eletrônicos, Áudio e Vídeo
Informática
```

Categorias que não estavam visíveis na tabela NÃO recebem
percentual inventado.

## Deploy

```powershell
git add .
git commit -m "Adiciona tabela de comissao por categoria"
git push
```

## Primeiro teste — vestido

```text
https://t-t-barateou.vercel.app/api/commission-lookup?categoryId=MLB108704
```

Esperamos:

```json
{
  "categoryName": "Vestidos",
  "rootCategory": {
    "name": "Calçados, Roupas e Bolsas"
  },
  "commissionKnown": true,
  "directCommissionPercent": 16,
  "indirectCommissionPercent": 8
}
```

## Teste de categoria não mapeada

Se a categoria principal não estiver na tabela fornecida,
esperamos:

```json
{
  "commissionKnown": false,
  "directCommissionPercent": null,
  "indirectCommissionPercent": null
}
```

Isso é proposital: nunca inventamos uma comissão.
