# T&T Barateou — Etapa 6.7K

Esta etapa adiciona o roteamento interno das ofertas.

As 32 categorias principais do Mercado Livre são agrupadas
em 8 categorias T&T:

```text
1. Moda & Beleza
2. Casa & Eletro
3. Tecnologia & Games
4. Saúde & Fitness
5. Bebês & Crianças
6. Auto & Moto
7. Pet Shop
8. Ofertas & Variedades
```

## Importante

Esses campos NÃO aparecem no anúncio.

Eles servem para o bot saber, futuramente, para qual grupo
a oferta deve ser enviada.

## Arquivos

Substitua:

```text
api/offer.js
```

Adicione:

```text
lib/tt-category-routing.js
```

## Deploy

```powershell
git add .
git commit -m "Adiciona roteamento de categorias TT"
git push
```

## Teste 1 — vestido

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F1wpNZf4
```

Esperado:

```text
ttCategoryId: moda_beleza
ttCategoryName: Moda & Beleza
ttRoutingKnown: true
```

## Teste 2 — ar-condicionado

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F2RzSExj
```

Esperado:

```text
ttCategoryId: casa_eletro
ttCategoryName: Casa & Eletro
ttRoutingKnown: true
```

## Teste 3 — creatina

```text
https://t-t-barateou.vercel.app/api/offer?link=https%3A%2F%2Fmeli.la%2F2EMjkct
```

Esperado:

```text
ttCategoryId: saude_fitness
ttCategoryName: Saúde & Fitness
ttRoutingKnown: true
```

## WhatsApp

Nada foi alterado no bot nesta etapa.
