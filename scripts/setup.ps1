param([string]$PythonPath = '')
. (Join-Path $PSScriptRoot 'common.ps1')
Initialize-NodeTools

if (-not $PythonPath) {
    # Prefer a normal Python install, then Codex's bundled runtime. Never change system PATH.
    $candidates = @('python', 'python3', (Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'))
    foreach ($candidate in $candidates) {
        if (Get-Command $candidate -ErrorAction SilentlyContinue) {
            $previousPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & $candidate -c 'import sys; sys.exit(0 if (3,12) <= sys.version_info[:2] < (3,14) else 1)' 2>$null
            $pythonExit = $LASTEXITCODE
            $ErrorActionPreference = $previousPreference
            if ($pythonExit -eq 0) { $PythonPath = $candidate; break }
        }
    }
}
if (-not $PythonPath) { throw 'Install Python 3.12 or 3.13, or pass -PythonPath C:\path\to\python.exe.' }

Push-Location $script:ProjectRoot
try {
    Invoke-Checked $PythonPath @('-c', 'import sys; assert (3,12) <= sys.version_info[:2] < (3,14)')
    $venv = Join-Path $script:ProjectRoot 'services/api/.venv'
    if (-not (Test-Path -LiteralPath (Join-Path $venv 'Scripts/python.exe'))) {
        Invoke-Checked $PythonPath @('-m', 'venv', $venv)
    }
    $apiPython = Get-ApiPython
    Invoke-Checked $apiPython @('-m', 'pip', 'install', '-r', 'services/api/requirements.lock')
    if (-not (Test-Path -LiteralPath 'services/api/.env')) { Copy-Item -LiteralPath '.env.example' -Destination 'services/api/.env' }
    if (-not (Test-Path -LiteralPath 'apps/mobile/.env')) { Copy-Item -LiteralPath 'apps/mobile/.env.example' -Destination 'apps/mobile/.env' }
    Push-Location 'services/api'
    try { Invoke-Checked $apiPython @('-m', 'alembic', 'upgrade', 'head') } finally { Pop-Location }
    Push-Location 'apps/mobile'
    try { Invoke-Checked 'npm.cmd' @('ci', '--no-audit', '--no-fund') } finally { Pop-Location }
    Write-Host 'Setup complete. Run scripts/start-api.ps1 and scripts/start-mobile.ps1 in separate terminals.'
} finally { Pop-Location }
