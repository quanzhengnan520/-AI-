param([switch]$Lan)
. (Join-Path $PSScriptRoot 'common.ps1')
$apiPython = Get-ApiPython
$bindAddress = '127.0.0.1'
if ($Lan) {
    $bindAddress = '0.0.0.0'
    Write-Host 'LAN mode listens on ALL network interfaces. Use trusted private Wi-Fi with a firewall; no tunnel or firewall change is created.'
}
Push-Location (Join-Path $script:ProjectRoot 'services/api')
try {
    Invoke-Checked $apiPython @('-m', 'alembic', 'upgrade', 'head')
    Invoke-Checked $apiPython @('-m', 'uvicorn', 'app.main:app', '--host', $bindAddress, '--port', '8000', '--no-access-log')
} finally { Pop-Location }
