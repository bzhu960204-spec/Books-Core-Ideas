param(
  # Stops whatever listens on this port instead.
  [int]$Port = 0
)

# Stops what start-prod.ps1 started: the start-prod process recorded in
# .bci-prod-state.json and the Java process it runs (ENG-06). Without a running
# start-prod on record, falls back to whatever listens on the recorded port (or 8080).

$ErrorActionPreference = 'Continue'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$stateFile = Join-Path $scriptRoot '.bci-prod-state.json'
. (Join-Path $scriptRoot 'tools\app-run.ps1')

$state = Read-RunState $stateFile
if ($Port -le 0 -and $state -and $state.running) {
  $count = Stop-ProcessTree ([int]$state.pid)
  Write-Host "Stopped start-prod (PID $($state.pid), port $($state.port)): $count process(es)"
  Remove-Item $stateFile -ErrorAction SilentlyContinue
} else {
  if ($Port -le 0) {
    $Port = if ($state -and $state.port) { [int]$state.port } else { 8080 }
    Write-Host "No running start-prod on record; stopping whatever listens on port $Port"
  }
  Stop-PortListeners @($Port)
  if ($state -and -not $state.running) { Remove-Item $stateFile -ErrorAction SilentlyContinue }
}

Get-Job -Name 'bci-prod-open' -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Job  $_ -ErrorAction SilentlyContinue
  Remove-Job $_ -Force -ErrorAction SilentlyContinue
  Write-Host "Removed background job: $($_.Name)"
}