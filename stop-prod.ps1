param(
  [int]$Port = 0
)

# Stops the single-port "prod" process. If -Port is omitted, reads the resolved
# port from .bci-prod-state.json (written by start-prod.ps1); falls back to 8080.

$ErrorActionPreference = 'Continue'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$stateFile = Join-Path $scriptRoot '.bci-prod-state.json'

if ($Port -le 0) {
  if (Test-Path $stateFile) {
    try {
      $state = Get-Content $stateFile -Raw | ConvertFrom-Json
      if ($state.port) { $Port = [int]$state.port }
    } catch { }
  }
  if ($Port -le 0) { $Port = 8080 }
}

$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $connections) {
  Write-Host "No listening process on port $Port"
} else {
  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Stopped process $processId on port $Port"
    } catch {
      Write-Host "Failed to stop process $processId on port ${Port}: $($_.Exception.Message)"
    }
  }
}

Get-Job -Name 'bci-prod-open' -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Job  $_ -Force -ErrorAction SilentlyContinue
  Remove-Job $_ -Force -ErrorAction SilentlyContinue
  Write-Host "Removed background job: $($_.Name)"
}

if (Test-Path $stateFile) { Remove-Item $stateFile -ErrorAction SilentlyContinue }
