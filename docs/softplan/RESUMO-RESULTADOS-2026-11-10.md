# Resumo consolidado — T&T AI — 10/11/2026

> Evidências das execuções de terminal compartilhadas pelo candidato. Trata-se de uma prova de funcionamento técnico, **não de resultados comerciais** ou de validação independente de preços.

## Resultado consolidado

- **15 testes automatizados aprovados** no ambiente local do candidato, 0 falhas.
- **3 anúncios reais** consultados pelo endpoint `/api/offer` do T&T e analisados pela OpenAI (`gpt-4o-mini`).
- **1.354 tokens** consumidos nas três análises (450 + 439 + 465).
- **0 publicações automáticas** pela nova funcionalidade; os scripts são de demonstração/somente leitura.

| ID do anúncio | Descrição resumida | Preço na consulta | Potencial IA | Tokens | Evidência |
|---|---|---:|---|---:|---|
| `MLB5066134658` | Hugo Boss Jeans EDT Masculino 125 ml | R$ 316,94 | Médio | 450 | [Transcrição da primeira execução](RESULTADO-REAL-2026-11-10.md) |
| `MLB4757227441` | Adesivo logo retrô PlayStation PS5 (2 un.) | R$ 15,59 | Médio | 439 | [Relatório JSON](evidencias/execucao-2026-11-10T20-47-04-058Z.json) |
| `MLB7451220610` | Corda de pular CrossFit | R$ 26,14 | Médio | 465 | [Relatório Markdown](evidencias/execucao-2026-11-10T20-47-04-058Z.md) |

## O que a IA efetivamente fez

Recebeu informações consultadas pelo T&T, classificou *potencial de interesse* de maneira qualitativa, sugeriu público-alvo, justificativa, chamada e cuidados; o programa formatou rascunhos para revisão humana. O uso da OpenAI foi real, e não apenas uma regra `if/else`.

## Limitações explícitas

- As três avaliações foram “médio”; **não** comprovam acurácia preditiva nem vantagem comercial.
- Preços e preços anteriores são valores retornados na consulta daquele momento; **não** há validação independente de histórico de preços nem garantia de desconto.
- O mapeamento de categorias retornou “Ofertas & Variedades” nas amostras observadas; pode ser refinado.
- O protótipo não foi conectado ao envio automático de WhatsApp e não mede cliques, vendas ou economia de tempo.
- Os 15 testes são automatizados e usam mocks; os três resultados reais são a evidência complementar de chamadas ao modelo.

**Como reproduzir:** veja o [README do portfólio](README.md) e o [roteiro da demonstração](ROTEIRO-VIDEO.md).
