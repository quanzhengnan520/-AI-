param([switch]$Web, [switch]$Lan)
. (Join-Path $PSScriptRoot 'common.ps1')
Initialize-NodeTools
Push-Location (Join-Path $script:ProjectRoot 'apps/mobile')
try {
    $expoArgs = @('expo', 'start')
    if ($Web) { $expoArgs += '--web' }
    if (-not $Lan) { $expoArgs += '--localhost' }
    Invoke-Checked 'npx.cmd' $expoArgs
} finally { Pop-Location }
