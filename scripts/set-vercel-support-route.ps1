param(
  [ValidateSet('Add', 'Remove')]
  [string]$Mode = 'Add'
)

$ErrorActionPreference = 'Stop'

$hostsPath = [System.IO.Path]::GetFullPath(
  'C:\Windows\System32\drivers\etc\hosts'
)
$expectedHostsPath = 'C:\Windows\System32\drivers\etc\hosts'
$workspaceRoot = [System.IO.Path]::GetFullPath(
  'C:\Users\crist\Desktop\avatar-ai'
)
$backupDirectory = [System.IO.Path]::GetFullPath(
  'C:\Users\crist\Desktop\avatar-ai\output\diagnostics'
)
$routePattern = '^\s*76\.76\.21\.21\s+vercel\.com(?:\s|$)'
$routeEntry = '76.76.21.21 vercel.com # Temporary Vercel support route'

if ($hostsPath -ne $expectedHostsPath) {
  throw "Ruta hosts inesperada: $hostsPath"
}

if (-not $backupDirectory.StartsWith(
    "$workspaceRoot\",
    [System.StringComparison]::OrdinalIgnoreCase
  )) {
  throw "Ruta de respaldo fuera del proyecto: $backupDirectory"
}

New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$lines = @(Get-Content -LiteralPath $hostsPath)

if ($Mode -eq 'Add') {
  $backupPath = Join-Path $backupDirectory 'hosts-before-vercel-support-route.txt'
  Copy-Item -LiteralPath $hostsPath -Destination $backupPath -Force

  if (-not ($lines -match $routePattern)) {
    Add-Content -LiteralPath $hostsPath -Value "`r`n$routeEntry" -Encoding ascii
  }
} else {
  $remainingLines = @($lines | Where-Object { $_ -notmatch $routePattern })
  [System.IO.File]::WriteAllLines($hostsPath, $remainingLines)
}

Clear-DnsClientCache
Write-Output "VERCEL_SUPPORT_ROUTE_$($Mode.ToUpperInvariant())"
