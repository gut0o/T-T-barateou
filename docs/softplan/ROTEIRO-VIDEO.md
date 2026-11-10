# Roteiro de vídeo — demonstração T&T AI (90 a 120 segundos)

**Antes de gravar:** feche abas de Vercel, contas, e-mails, terminais com secrets e arquivos `.env`. Deixe aberto o README (`docs/softplan/README.md`) e a pasta do projeto no VS Code. Não digite nem mostre sua chave no vídeo; configure-a antes e limpe o terminal.

## 00:00–00:20 — problema

**Fale:** “Este é o T&T Barateou, um sistema que consulta ofertas e automatiza a organização para grupos. O desafio que escolhi é que automatizar a busca por produtos não basta para explicar qual público se interessaria por cada oferta. Queria adicionar uma camada de curadoria inteligente sem deixar uma IA decidir sozinha o que publicar.”

**Mostre:** o README ou a apresentação visual `docs/softplan/apresentacao.html`.

## 00:20–00:45 — arquitetura

**Fale:** “O programa recebe um link do Mercado Livre e consulta o endpoint já existente do T&T. Os dados passam por validação; o GPT-4o mini recebe título, categoria e preço e devolve um JSON estruturado com público-alvo, potencial, justificativa, chamada e limitações.”

**Mostre:** diagrama no README e `lib/tt-ai-curator.js` rapidamente.

## 00:45–01:15 — prova prática

**Fale:** “Aqui estou usando um anúncio real. O sistema busca os dados e a IA produz uma análise e um rascunho. Não envia ao WhatsApp; exige revisão humana.”

**Mostre no PowerShell:**

```powershell
node --test tests/tt-ai-curator.test.mjs tests/tt-ai-link-offers.test.mjs tests/tt-ai-portfolio-report.test.mjs
node scripts/ai-curator-links.mjs "https://meli.la/1teZH9f"
```

**Observação:** esta consulta pode retornar outro preço ou falhar no dia da gravação. Não afirme que o preço é fixo; mostre o resultado atual da execução. Se falhar, mostre o relatório de execução de 10/11, identificado como evidência anterior, em vez de simular sucesso.

## 01:15–01:40 — decisões e limites

**Fale:** “Eu separei regras determinísticas da etapa de IA, validei o formato da saída e recusei respostas inválidas ou truncadas. A IA não pode afirmar que o anúncio tem o menor preço sem um histórico confiável. No protótipo, a publicação automática fica desligada.”

**Mostre:** os testes ou a seção ‘Segurança e limites’ do README.

## 01:40–02:00 — conclusão

**Fale:** “O protótipo já foi validado com um produto real. O próximo passo seria comparar as recomendações com avaliações humanas e medir se elas ajudam a escolher e comunicar melhor as ofertas, antes de colocar isso em produção.”

**Finalize:** “Código e documentação estão no repositório.”

## Dicas

- Grave em 1080p, se possível; aumente o zoom do terminal.
- Não mostre os valores das chaves `OPENAI_API_KEY` ou `TT_QUEUE_ADMIN_KEY`.
- Não precisa editar um filme: a gravação de tela e voz, direta e clara, já é suficiente.
- Hospede o vídeo com acesso por link (por exemplo, não listado), confirme que abre em janela anônima e anexe esse link à candidatura se houver campo apropriado.
