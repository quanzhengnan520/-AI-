. (Join-Path $PSScriptRoot 'common.ps1')
Initialize-NodeTools
$apiPython = Get-ApiPython
Push-Location (Join-Path $script:ProjectRoot 'services/api')
try {
    Invoke-Checked $apiPython @('-m', 'ruff', 'check', '.')
    Invoke-Checked $apiPython @('-m', 'ruff', 'format', '--check', '.')
    Invoke-Checked $apiPython @('-m', 'ruff', 'check', '../../scripts/smoke_api.py', '../../scripts/smoke_m1.py')
    Invoke-Checked $apiPython @('-m', 'ruff', 'format', '--check', '../../scripts/smoke_api.py', '../../scripts/smoke_m1.py')
    Invoke-Checked $apiPython @('-m', 'mypy', 'app')
    Invoke-Checked $apiPython @('-m', 'pytest', '-q')
} finally { Pop-Location }
Push-Location (Join-Path $script:ProjectRoot 'apps/mobile')
try {
    Invoke-Checked 'npm.cmd' @('run', 'typecheck')
    Invoke-Checked 'npm.cmd' @('run', 'lint')
    Invoke-Checked 'npm.cmd' @('run', 'format:check')
    Invoke-Checked '.\node_modules\.bin\prettier.cmd' @('--check', '../../scripts/smoke_ui.cjs', '../../scripts/smoke_m1_ui.cjs')
    Invoke-Checked 'npm.cmd' @('test', '--', '--runInBand')
    Invoke-Checked 'npx.cmd' @('expo', 'install', '--check')
} finally { Pop-Location }
