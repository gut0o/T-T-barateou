# Texto sugerido para a candidatura — Softplan Futures

## Título

**T&T Barateou — Curadoria inteligente de ofertas com OpenAI**

## Resumo curto (campo de portfólio)

Desenvolvi um protótipo de curadoria com IA para o T&T Barateou, um sistema de automação de ofertas do Mercado Livre. O projeto consulta dados reais de produtos, utiliza o GPT-4o mini para sugerir público-alvo, relevância e mensagens de divulgação e devolve avaliações estruturadas para revisão humana. A arquitetura separa regras de validação dos resultados gerados pelo modelo. O protótipo foi validado com três anúncios reais de tipos de produto diferentes e 15 testes automatizados aprovados, sem envio de mensagens ou alteração da fila de produção. O objetivo é reduzir o esforço de curadoria mantendo limites claros para afirmações sobre preços e descontos.

## O problema e o motivo de usar IA (versão de entrevista)

O T&T já automatizava a parte operacional de descoberta e organização de ofertas, mas faltava apoio na interpretação qualitativa dos anúncios e na comunicação adequada para diferentes públicos. Regras fixas ajudam a filtrar categorias e preços, mas são limitadas para explicar relevância e sugerir textos contextualizados. Por isso, experimentei um modelo de linguagem para a parte subjetiva, mantendo o preço e o controle de publicação nas regras tradicionais.

## Resultados e o que falta validar

- **Já demonstrado:** três análises reais com GPT-4o mini (perfume, adesivo para PS5 e corda de pular), com respostas JSON estruturadas e mensagens sugeridas; 15/15 testes automatizados e nenhuma publicação automática realizada pela funcionalidade de IA.
- **Ainda não demonstrado:** melhoria de conversão, economia de tempo ou superioridade sobre avaliação humana.
- **Próximos passos:** ampliar a amostra, comparar respostas com curadoria humana, melhorar o mapeamento de categorias e testar um fluxo de aprovação antes de qualquer uso em produção.

## Links para a inscrição

- **Portfólio de IA:** https://github.com/gut0o/T-T-barateou/blob/feat/softplan-ia-portfolio/docs/softplan/README.md
- **Código na branch da Softplan:** https://github.com/gut0o/T-T-barateou/tree/feat/softplan-ia-portfolio
- **Evidências:** https://github.com/gut0o/T-T-barateou/tree/feat/softplan-ia-portfolio/docs/softplan/evidencias
- **Vídeo:** adicionar após gravar e conferir o acesso por link, se o formulário aceitar.

**Atenção à autoria:** ajuste o texto para refletir sua contribuição real e saiba explicar as decisões e o código apresentado. Não afirme que a IA já está em produção ou que teve aumento de vendas.
