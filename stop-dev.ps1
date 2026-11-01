param(
  # Stops whatever listens on these ports instead (the old behaviour).
  [int[]]$Ports
)

# Stops what start-dev.ps1 started: the start-dev process recorded in .bci-dev-state.json
# and everything it launched (job hosts, mvnw, the JVMs, Vite), whatever ports it ended up
# on (ENG-06). Without a running start-dev on record, falls back to the ports.

$ErrorActionPreference = 'Continue'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$stateFile = Join-Path $scriptRoot '.bci-dev-state.json'
. (Join-Path $scriptRoot 'tools\app-run.ps1')

$state = Read-RunState $stateFile
if (-not $Ports -and $state -and $state.running) {
  $count = Stop-ProcessTree ([int]$state.pid)
  Write-Host "Stopped start-dev (PID $($state.pid), backend port $($state.backendPort), frontend port $($state.frontendPort)): $count process(es)"
  Remove-Item $stateFile -ErrorAction SilentlyContinue
} else {
  if (-not $Ports) {
    $Ports = if ($state) { @([int]$state.backendPort, [int]$state.frontendPort) } else { @(8080, 5173) }
    Write-Host "No running start-dev on record; stopping whatever listens on ports $($Ports -join ', ')"
  }
  Stop-PortListeners $Ports
  if ($state -and -not $state.running) { Remove-Item $stateFile -ErrorAction SilentlyContinue }
}

# Also clean up any lingering background jobs from this session
Get-Job -Name 'bci-backend', 'bci-frontend' -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Job  $_ -ErrorAction SilentlyContinue
  Remove-Job $_ -Force -ErrorAction SilentlyContinue
  Write-Host "Removed background job: $($_.Name)"
}