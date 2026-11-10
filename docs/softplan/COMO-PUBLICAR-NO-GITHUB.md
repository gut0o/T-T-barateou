# Publicar o portfólio sem afetar produção

A pasta `tt-afiliados-site` pode ter qualquer nome local. Antes de enviar, confirme que o remoto aponta para o repositório correto:

```powershell
git remote -v
git status
```

Se `origin` não for o repositório desejado, **não dê push** até conferir. Se tiver alterações não relacionadas em andamento, não as inclua no commit do portfólio.

## Caminho recomendado: branch separado

```powershell
# Execute na raiz do projeto, depois de extrair o ZIP:
git switch -c softplan-portfolio

git add lib/tt-ai-curator.js lib/tt-ai-link-offers.js lib/tt-ai-portfolio-report.js
git add scripts/ai-curator-links.mjs scripts/ai-curator-portfolio.mjs
git add tests/tt-ai-curator.test.mjs tests/tt-ai-link-offers.test.mjs tests/tt-ai-portfolio-report.test.mjs
git add docs/softplan/README.md docs/softplan/RESULTADO-REAL-2026-11-10.md docs/softplan/ROTEIRO-VIDEO.md docs/softplan/TEXTO-INSCRICAO.md docs/softplan/COMO-PUBLICAR-NO-GITHUB.md docs/softplan/apresentacao.html docs/softplan/evidencias/LEIA.md

# Revise a lista completa antes de confirmar:
git diff --cached --stat
git diff --cached --name-only

git commit -m "Adiciona portfolio de curadoria com IA para Softplan"
git push -u origin softplan-portfolio
```

Se a branch já existir, use `git switch softplan-portfolio` em vez de `git switch -c`.

**Por que usar branch?** A alteração não modifica o branch principal do projeto, e a Softplan pode abrir diretamente os arquivos da branch. Eventuais integrações de preview dependem da configuração do repositório, mas o código do módulo não possui comandos de publicação.

## Qual link usar na inscrição?

Depois de confirmar que o `push` funcionou e que o repositório é o `gut0o/T-T-barateou`, use:

`https://github.com/gut0o/T-T-barateou/blob/softplan-portfolio/docs/softplan/README.md`

Esse endereço é **um modelo de link**. Ele só funcionará depois de a branch e os arquivos estarem publicados. Abra em uma janela anônima para confirmar. Se o repositório for privado, o avaliador não conseguirá acessar sem permissão.

## Sobre evidências de outras execuções

O script `ai-curator-portfolio.mjs` salva arquivos em `docs/softplan/evidencias/`. Revise manualmente se pretende versioná-los. Eles não contêm chaves nem links de afiliado por projeto, mas exibem produtos e mensagens de texto geradas.
