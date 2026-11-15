$ErrorActionPreference = 'Stop'
$script:ProjectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments = @())
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')"
    }
}

function Initialize-NodeTools {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Install Node.js 24 LTS, reopen PowerShell, and try again.'
    }
    $localBin = Join-Path $script:ProjectRoot '.tooling/bin'
    if (Test-Path -LiteralPath (Join-Path $localBin 'npm.cmd')) {
        $env:PATH = "$localBin;$env:PATH"
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        Write-Host 'npm is missing; downloading pinned npm 12.2.2 into project .tooling only.'
        $tooling = Join-Path $script:ProjectRoot '.tooling'
        $npmRoot = Join-Path $tooling 'npm'
        New-Item -ItemType Directory -Path $npmRoot, $localBin -Force | Out-Null
        $archive = Join-Path $tooling 'npm.tgz'
        $metadata = Invoke-RestMethod -Uri 'https://registry.npmjs.org/npm/12.2.2'
        Invoke-WebRequest -Uri 'https://registry.npmjs.org/npm/-/npm-12.2.2.tgz' -OutFile $archive -UseBasicParsing
        $digest = [Security.Cryptography.SHA512]::Create()
        try { $actual = [Convert]::ToBase64String($digest.ComputeHash([IO.File]::ReadAllBytes($archive))) }
        finally { $digest.Dispose() }
        if ("sha512-$actual" -ne $metadata.dist.integrity) { throw 'npm package integrity mismatch.' }
        Invoke-Checked 'tar.exe' @('-xzf', $archive, '-C', $npmRoot, '--strip-components=1')
        Set-Content -LiteralPath (Join-Path $localBin 'npm.cmd') -Encoding ascii -Value '@echo off', 'node "%~dp0..\npm\bin\npm-cli.js" %*'
        Set-Content -LiteralPath (Join-Path $localBin 'npx.cmd') -Encoding ascii -Value '@echo off', 'node "%~dp0..\npm\bin\npx-cli.js" %*'
        $env:PATH = "$localBin;$env:PATH"
    }
    $env:EXPO_NO_TELEMETRY = '1'
}

function Get-ApiPython {
    $venvPython = Join-Path $script:ProjectRoot 'services/api/.venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $venvPython)) {
        throw 'Python virtual environment is missing. Run scripts/setup.ps1 first.'
    }
    return $venvPython
}
