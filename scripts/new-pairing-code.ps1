. (Join-Path $PSScriptRoot 'common.ps1')
$apiPython = Get-ApiPython
$artifactDirectory = Join-Path $script:ProjectRoot '.artifacts'
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
$codeName = 'pairing-code-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt'
$codePath = Join-Path $artifactDirectory $codeName
Push-Location (Join-Path $script:ProjectRoot 'services/api')
try {
    Invoke-Checked $apiPython @('-m', 'alembic', 'upgrade', 'head')
    Invoke-Checked $apiPython @('-m', 'app.manage', 'pairing-code', '--output', $codePath)
    Write-Host 'A short-lived one-time pairing code was written locally. It is never printed.'
    Write-Host "Open this private file on this computer, then enter the code in the M1 workspace: $codePath"
    Write-Host 'Do not paste the code or device token into chat. Generate a new code after it is used or expires.'
} finally { Pop-Location }
