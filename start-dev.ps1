param(
  [int]$BackendPort = 8080,
  [int]$FrontendPort = 5173,
  [switch]$StopExisting = $false
)

# Starts the backend (mvnw spring-boot:run, dev profile) and the Vite dev server as
# background jobs and streams their output. Stop with Ctrl+C or .\stop-dev.ps1, which
# finds this run through .bci-dev-state.json (ENG-06).

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir  = Join-Path $scriptRoot 'backend'
$frontendDir = Join-Path $scriptRoot 'frontend'
$stateFile   = Join-Path $scriptRoot '.bci-dev-state.json'

if (-not (Test-Path $backendDir))  { throw "Backend directory not found: $backendDir" }
if (-not (Test-Path $frontendDir)) { throw "Frontend directory not found: $frontendDir" }

. (Join-Path $scriptRoot 'tools\app-run.ps1')

# Java 17+ for mvnw spring-boot:run (optional override in .java-home; see tools\java-env.ps1).
# The backend job below inherits JAVA_HOME and PATH from this process.
. (Join-Path $scriptRoot 'tools\java-env.ps1')
Set-ProjectJavaHome $scriptRoot
Assert-ProjectJava $scriptRoot | Out-Null

if ($StopExisting) {
  & (Join-Path $scriptRoot 'stop-dev.ps1')
  Stop-PortListeners @($BackendPort, $FrontendPort)
}

$requestedBackendPort  = $BackendPort
$requestedFrontendPort = $FrontendPort

$BackendPort  = Get-FreePort -StartPort $BackendPort
$FrontendPort = Get-FreePort -StartPort $FrontendPort -Reserved @($BackendPort)

if ($BackendPort  -ne $requestedBackendPort)  { Write-Host "Backend port $requestedBackendPort is occupied. Switched to $BackendPort" }
if ($FrontendPort -ne $requestedFrontendPort) { Write-Host "Frontend port $requestedFrontendPort is occupied. Switched to $FrontendPort" }

Write-Host ""
Write-Host "=== Books Core Ideas - Dev Start ===" -ForegroundColor Cyan
Write-Host "  Backend   : http://localhost:$BackendPort" -ForegroundColor Green
Write-Host "  Frontend  : http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "  H2 Console: http://localhost:$BackendPort/h2-console" -ForegroundColor DarkGray
Write-Host ""

function Test-JobDone($Job) {
  return $Job.State -in @('Completed', 'Failed', 'Stopped')
}

function Write-JobOutput($Job, [string]$Prefix) {
  <# Prints what the job wrote, errors included (they used to be dropped, hiding why a
     service did not start). Returns whether there was anything. #>
  $hadOutput = $false
  Receive-Job -Job $Job -ErrorAction Continue 2>&1 | ForEach-Object {
    $hadOutput = $true
    Write-Host "[$Prefix] $_"
  }
  return $hadOutput
}

function Write-JobEnd($Job, [string]$Name) {
  $reason = $Job.ChildJobs | ForEach-Object { $_.JobStateInfo.Reason } | Where-Object { $_ } | Select-Object -First 1
  Write-Host ""
  Write-Host "[!] $Name process stopped unexpectedly ($($Job.State)). Check the output above." -ForegroundColor Red
  if ($reason) { Write-Host "    $($reason.Message)" -ForegroundColor Red }
}

Save-RunState $stateFile @{ backendPort = $BackendPort; frontendPort = $FrontendPort }

$backendJob = $null
$frontendJob = $null
try {
  # --- Start backend ---
  $backendJob = Start-Job -Name 'bci-backend' -ScriptBlock {
    param([string]$Dir, [int]$Port)
    Set-Location $Dir
    $env:SERVER_PORT = $Port.ToString()
    # dev profile = H2 Console (application-dev.properties). No CORS: the frontend reaches
    # the backend through the Vite proxy, same-origin.
    $env:SPRING_PROFILES_ACTIVE = 'dev'
    & .\mvnw.cmd spring-boot:run 2>&1 | ForEach-Object { $_.ToString() }
  } -ArgumentList $backendDir, $BackendPort

  # --- Wait for backend: /actuator/health UP, not just a listening port ---
  $reportedBackend = $false
  Write-Host "Waiting for backend on port $BackendPort..." -ForegroundColor Yellow
  $maxWait = 180
  $watch = [Diagnostics.Stopwatch]::StartNew()
  $ready = $false
  $nextNote = 10
  while ($watch.Elapsed.TotalSeconds -lt $maxWait) {
    Write-JobOutput $backendJob 'backend' | Out-Null
    if (Test-JobDone $backendJob) { break }
    if (Test-AppHealthy $BackendPort) { $ready = $true; break }
    Start-Sleep -Seconds 1
    if ($watch.Elapsed.TotalSeconds -ge $nextNote) {
      Write-Host "  still waiting... ($nextNote s)" -ForegroundColor DarkGray
      $nextNote += 10
    }
  }
  Write-JobOutput $backendJob 'backend' | Out-Null

  if ($ready) {
    Write-Host "Backend ready (health UP) after $([int]$watch.Elapsed.TotalSeconds) s." -ForegroundColor Green
  } elseif (Test-JobDone $backendJob) {
    Write-JobEnd $backendJob 'Backend'
    $reportedBackend = $true
    Write-Host "Starting the frontend anyway." -ForegroundColor Yellow
  } else {
    Write-Host "Backend was not healthy within $maxWait seconds. Starting the frontend anyway." -ForegroundColor Yellow
  }

  # --- Start frontend ---
  $frontendJob = Start-Job -Name 'bci-frontend' -ScriptBlock {
    param([string]$Dir, [int]$ApiPort, [int]$Port)
    Set-Location $Dir
    # The SPA calls same-origin /api; Vite proxies it to the backend (vite.config.js).
    # The backend listens on 127.0.0.1 only (SEC-03); Vite's default host is this machine only too.
    $env:VITE_API_PROXY_TARGET = "http://127.0.0.1:$ApiPort"
    # npx.cmd, not npx: npx resolves to npx.ps1, which the execution policy may refuse to run.
    & npx.cmd vite --port $Port --strictPort 2>&1 | ForEach-Object { $_.ToString() }
  } -ArgumentList $frontendDir, $BackendPort, $FrontendPort

  # --- Wait for frontend ---
  $frontendUrl = "http://localhost:$FrontendPort/"
  $watch.Restart()
  $frontendReady = $false
  while ($watch.Elapsed.TotalSeconds -lt 60) {
    Write-JobOutput $frontendJob 'frontend' | Out-Null
    if (Test-JobDone $frontendJob) { break }
    if (Test-HttpResponds $frontendUrl) { $frontendReady = $true; break }
    Start-Sleep -Milliseconds 500
  }

  Write-Host ""
  if ($ready -and $frontendReady) {
    Write-Host "Both services started: $frontendUrl  Press Ctrl+C to stop." -ForegroundColor Cyan
  } elseif ($frontendReady) {
    Write-Host "Frontend started ($frontendUrl), but the backend is not healthy. Press Ctrl+C to stop." -ForegroundColor Yellow
  } else {
    Write-Host "Frontend did not start (see above). Press Ctrl+C to stop." -ForegroundColor Red
  }
  Write-Host "  To stop without Ctrl+C: .\stop-dev.ps1" -ForegroundColor DarkGray
  Write-Host ""

  $reportedFrontend = $false
  while ($true) {
    $hadOutput = Write-JobOutput $backendJob 'backend'
    if (Write-JobOutput $frontendJob 'frontend') { $hadOutput = $true }

    $backendDone  = Test-JobDone $backendJob
    $frontendDone = Test-JobDone $frontendJob

    if ($backendDone -and -not $reportedBackend) { Write-JobEnd $backendJob 'Backend'; $reportedBackend = $true }
    if ($frontendDone -and -not $reportedFrontend) { Write-JobEnd $frontendJob 'Frontend'; $reportedFrontend = $true }

    if ($backendDone -and $frontendDone) { break }

    if (-not $hadOutput) { Start-Sleep -Milliseconds 250 }
  }
}
finally {
  $jobs = @($backendJob, $frontendJob) | Where-Object { $_ }
  Write-Host ""
  Write-Host "Process states: $(($jobs | ForEach-Object { "$($_.Name)=$($_.State)" }) -join ', ')" -ForegroundColor DarkGray

  foreach ($job in $jobs) {
    if (-not (Test-JobDone $job)) { Stop-Job -Job $job -ErrorAction SilentlyContinue }
  }
  if ($jobs) { Remove-Job -Job $jobs -Force -ErrorAction SilentlyContinue }
  Remove-RunState $stateFile
  Write-Host "Services stopped." -ForegroundColor Yellow
}