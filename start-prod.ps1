param(
  [int]$Port = 8080,
  [switch]$Rebuild = $false,
  [switch]$NoBrowser = $false,
  [switch]$NoLogFile = $false
)

# Runs the packaged app in single-port "prod" mode: one Spring Boot process
# serves both the API and the pre-built frontend on a free port. Logs stream to
# this console (and, by default, to logs/prod-<timestamp>.log). The dev flow
# (start-dev.cmd) is separate and unaffected.

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptRoot 'backend'
$frontendDir = Join-Path $scriptRoot 'frontend'
$distDir = Join-Path $frontendDir 'dist'

if (-not (Test-Path $backendDir)) { throw "Backend directory not found: $backendDir" }

# Free ports, health check, run state (shared with start-dev; ENG-06).
$appRun = Join-Path $scriptRoot 'tools\app-run.ps1'
. $appRun

# -- Java 17+ (optional override in .java-home; see tools\java-env.ps1) --------
. (Join-Path $scriptRoot 'tools\java-env.ps1')
Set-ProjectJavaHome $scriptRoot

# ── Load .env (optional; same convention as start-dev if present) ─────────────
$envFile = Join-Path $scriptRoot ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $key = $matches[1].Trim()
      $value = $matches[2].Trim()
      [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
  }
  Write-Host "[env] Loaded .env file"
}

# Checked after .env, which could set JAVA_HOME too; both the build and the jar need it.
$javaExe = Assert-ProjectJava $scriptRoot

# ── Locate the fat jar; build if missing or -Rebuild ─────────────────────────
function Get-Jar {
  Get-ChildItem (Join-Path $backendDir 'target') -Filter 'books-core-ideas-*.jar' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike '*.original' } |
    Select-Object -First 1
}

$jar = Get-Jar
if ($Rebuild -or -not $jar -or -not (Test-Path $distDir)) {
  Write-Host "Building production artifacts (first run or -Rebuild)..."
  & (Join-Path $scriptRoot 'build-prod.ps1')
  if ($LASTEXITCODE -ne 0) { throw "build-prod failed" }
  $jar = Get-Jar
}
if (-not $jar) { throw "Jar not found; build failed." }
if (-not (Test-Path $distDir)) { throw "Frontend dist not found: $distDir. Run build-prod.cmd first." }

# ── Resolve a free port ──────────────────────────────────────────────────────
$requestedPort = $Port
$Port = Get-FreePort -StartPort $Port
if ($Port -ne $requestedPort) {
  Write-Host "Port $requestedPort is in use, falling back to $Port"
}

# Record this run (port, PID) for stop-prod.ps1.
$stateFile = Join-Path $scriptRoot '.bci-prod-state.json'
Save-RunState $stateFile @{ port = $Port }

# ── Optional log file (console always streams regardless) ────────────────────
$logFile = $null
if (-not $NoLogFile) {
  $logsDir = Join-Path $scriptRoot 'logs'
  if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $logFile = Join-Path $logsDir "prod-$stamp.log"
}

# -- Open the browser once the app is healthy (background) ---------------------
if (-not $NoBrowser) {
  Start-Job -Name 'bci-prod-open' -ScriptBlock {
    param([string]$AppRun, [int]$Port)
    . $AppRun
    for ($i = 0; $i -lt 180; $i++) {
      if (Test-AppHealthy $Port) { Start-Process "http://localhost:$Port"; break }
      Start-Sleep -Seconds 1
    }
  } -ArgumentList $appRun, $Port | Out-Null
}

Write-Host ""
Write-Host "==============================================="
Write-Host " Books Core Ideas (prod) starting"
Write-Host "   URL       : http://localhost:$Port"
Write-Host "   Jar       : $($jar.FullName)"
Write-Host "   Frontend  : $distDir"
if ($logFile) { Write-Host "   Log       : $logFile" }
Write-Host " Press Ctrl+C to stop."
Write-Host "==============================================="
Write-Host ""

# Run in the foreground with cwd = backend so H2 (./data/booksdb) matches the
# dev flow. Program args (not env) carry the profile, port + dist so they always
# reach Spring reliably. The prod profile turns off the H2 Console (SEC-03).
Push-Location $backendDir
try {
  $jarArgs = @(
    '-jar', $jar.FullName,
    '--spring.profiles.active=prod',
    "--server.port=$Port",
    "--app.web.dist=$distDir"
  )
  if ($logFile) {
    & $javaExe @jarArgs 2>&1 | Tee-Object -FilePath $logFile
  } else {
    & $javaExe @jarArgs 2>&1
  }
} finally {
  Pop-Location
  Get-Job -Name 'bci-prod-open' -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue
  Remove-RunState $stateFile
}
