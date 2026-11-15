param([switch]$Rotate)
. (Join-Path $PSScriptRoot 'common.ps1')
$configPath = Join-Path $script:ProjectRoot 'services/api/.env'
if (-not (Test-Path -LiteralPath $configPath)) { throw 'Run setup.ps1 first.' }
$config = [IO.File]::ReadAllText($configPath)
if (($config -match '(?m)^DEVICE_TOKEN_SHA256=[a-fA-F0-9]{64}\s*$') -and (-not $Rotate)) {
    throw 'A device token hash already exists. Pass -Rotate only if you intend to invalidate the old token.'
}
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
$sha = [Security.Cryptography.SHA256]::Create()
try {
    $bytes = New-Object byte[] 32
    $random.GetBytes($bytes)
    $token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $hash = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($token)))).Replace('-', '').ToLowerInvariant()
    if ($config -match '(?m)^DEVICE_TOKEN_SHA256=.*$') {
        $config = [regex]::Replace($config, '(?m)^DEVICE_TOKEN_SHA256=.*$', "DEVICE_TOKEN_SHA256=$hash")
    } else { $config += "`nDEVICE_TOKEN_SHA256=$hash`n" }
    $artifactDir = Join-Path $script:ProjectRoot '.artifacts'
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
    $tokenPath = Join-Path $artifactDir 'dev-device-token.txt'
    [IO.File]::WriteAllText($tokenPath, $token, (New-Object Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText($configPath, $config, (New-Object Text.UTF8Encoding($false)))
    Write-Host 'Local demo token created; token text is never printed. Restart the API after rotation.'
    Write-Host "Token file (private, ignored by Git): $tokenPath"
    Write-Host 'Keep this file on your trusted computer. Do not paste it into chat or a mobile EXPO_PUBLIC variable.'
} finally {
    $random.Dispose()
    $sha.Dispose()
    $token = $null
}
