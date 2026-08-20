$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================"
Write-Host " T&T BARATEOU - PM2"
Write-Host "======================================"

$pm2Command = Get-Command pm2 -ErrorAction SilentlyContinue

if (-not $pm2Command) {
    Write-Host "PM2 nao encontrado. Instalando..."
    npm install -g pm2

    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao instalar o PM2."
    }

    $pm2Command = Get-Command pm2 -ErrorAction SilentlyContinue

    if (-not $pm2Command) {
        throw "PM2 foi instalado, mas o comando ainda nao esta disponivel neste PowerShell."
    }
}

Write-Host ""
Write-Host "Automatico: 09:00 ate 22:00"
Write-Host "Timezone: America/Sao_Paulo"
Write-Host ""

# No Windows/PowerShell, `pm2 describe nome` escreve WARN no stderr quando o
# processo nao existe. Com ErrorActionPreference=Stop isso vira excecao.
#
# Executamos somente essa verificacao via cmd.exe e descartamos stdout/stderr.
# Assim conseguimos usar o exit code de forma confiavel.
cmd.exe /d /c "pm2 describe tt-barateou >nul 2>&1"
$processExists = ($LASTEXITCODE -eq 0)

if ($processExists) {
    Write-Host "Processo tt-barateou ja existe. Reiniciando com as variaveis atuais..."

    & pm2 restart ecosystem.config.cjs --only tt-barateou --update-env

    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao reiniciar o processo tt-barateou."
    }
}
else {
    Write-Host "Processo tt-barateou ainda nao existe. Iniciando..."

    & pm2 start ecosystem.config.cjs --only tt-barateou

    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao iniciar o processo tt-barateou."
    }
}

Write-Host ""
Write-Host "Salvando a lista de processos do PM2..."

& pm2 save

if ($LASTEXITCODE -ne 0) {
    throw "O T&T iniciou, mas o PM2 nao conseguiu executar pm2 save."
}

Write-Host ""
Write-Host "Status:"
& pm2 status

Write-Host ""
Write-Host "Comandos uteis:"
Write-Host "  pm2 status"
Write-Host "  pm2 logs tt-barateou"
Write-Host "  pm2 restart tt-barateou --update-env"
Write-Host "  pm2 stop tt-barateou"
Write-Host ""
Write-Host "IMPORTANTE: Ctrl+C dentro de 'pm2 logs' fecha apenas os logs."
Write-Host "O processo continua rodando em background."
