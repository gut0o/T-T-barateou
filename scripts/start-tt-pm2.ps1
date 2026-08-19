$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================"
Write-Host " T&T BARATEOU - PM2"
Write-Host "======================================"

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "PM2 não encontrado. Instalando..."
    npm install -g pm2
}

Write-Host ""
Write-Host "Automatico: 09:00 ate 22:00"
Write-Host "Timezone: America/Sao_Paulo"
Write-Host ""

# IMPORTANTE:
# Execute no PowerShell em que TT_QUEUE_ADMIN_KEY e as credenciais
# locais do afiliado já estejam definidas.
#
# Nenhum segredo fica salvo neste arquivo.

$apps = pm2 jlist | ConvertFrom-Json
$existing = $apps | Where-Object { $_.name -eq "tt-barateou" }

if ($existing) {
    Write-Host "Atualizando processo existente..."
    pm2 restart ecosystem.config.cjs --only tt-barateou --update-env
}
else {
    Write-Host "Iniciando processo..."
    pm2 start ecosystem.config.cjs --only tt-barateou
}

pm2 save

Write-Host ""
pm2 status

Write-Host ""
Write-Host "Para acompanhar os logs:"
Write-Host "pm2 logs tt-barateou"
