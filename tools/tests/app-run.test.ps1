<#
.SYNOPSIS
  Scenario tests for tools\app-run.ps1, the helpers of the start/stop scripts (ENG-06).

.DESCRIPTION
  Uses only temporary files, throw-away processes (cmd + ping) and ports it opens itself;
  the repository's state files and running apps are not touched. Exits 1 if any scenario fails.

.EXAMPLE
  powershell -NoProfile -File tools\tests\app-run.test.ps1
#>
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $repo 'tools\app-run.ps1')
$failures = 0

function Check([string]$name, [bool]$ok, [string]$detail = '') {
  if ($ok) { Write-Host "PASS  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name $detail" -ForegroundColor Red; $script:failures++ }
}

function Start-Tree {
  <# cmd running ping: a parent with one child, both alive for a minute. #>
  $parent = Start-Process cmd -ArgumentList '/c', 'ping -n 60 127.0.0.1 >nul' -WindowStyle Hidden -PassThru
  for ($i = 0; $i -lt 50; $i++) {
    $child = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($parent.Id) AND Name = 'PING.EXE'" | Select-Object -First 1
    if ($child) { return @{ Parent = $parent.Id; Child = [int]$child.ProcessId } }
    Start-Sleep -Milliseconds 100
  }
  throw 'ping did not start'
}

function Test-Alive([int]$Id) { return [bool](Get-Process -Id $Id -ErrorAction SilentlyContinue) }

function Start-FakeHealth([int]$Port, [string]$Body) {
  <# Answers every request like Spring Boot's actuator does by default: with its own media
     type, which PS 5.1 does not treat as text (the body arrives as bytes). #>
  $job = Start-Job -ScriptBlock {
    param([int]$Port, [string]$Body)
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    # Polls instead of blocking in AcceptTcpClient, which Stop-Job cannot interrupt.
    $deadline = (Get-Date).AddMinutes(2)
    while ((Get-Date) -lt $deadline) {
      if (-not $listener.Pending()) { Start-Sleep -Milliseconds 50; continue }
      $client = $listener.AcceptTcpClient()
      $stream = $client.GetStream()
      $reader = New-Object IO.StreamReader($stream)
      while ($true) { $line = $reader.ReadLine(); if (-not $line) { break } }
      $bytes = [Text.Encoding]::UTF8.GetBytes($Body)
      $head = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 200 OK`r`nContent-Type: application/vnd.spring-boot.actuator.v3+json`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n")
      $stream.Write($head, 0, $head.Length); $stream.Write($bytes, 0, $bytes.Length); $stream.Flush()
      $client.Close()
    }
  } -ArgumentList $Port, $Body
  for ($i = 0; $i -lt 100 -and (Test-PortFree $Port); $i++) { Start-Sleep -Milliseconds 100 }
  return $job
}

$listeners = @()
$cleanup = @()
$jobs = @()
$temp = Join-Path $env:TEMP ('bci-apprun-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory $temp | Out-Null
try {
  # --- ports ----------------------------------------------------------------
  $start = Get-FreePort 47100
  $held = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $start); $held.Start(); $listeners += $held
  Check 'ports: a port in use (IPv4) is not free' (-not (Test-PortFree $start))
  Check 'ports: Get-FreePort skips it' ((Get-FreePort $start) -gt $start)
  $next = Get-FreePort $start
  Check 'ports: Get-FreePort also skips reserved ports' ((Get-FreePort $start -Reserved @($next)) -gt $next)

  $v6port = Get-FreePort ($next + 10)
  $v6 = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Loopback, $v6port); $v6.Start(); $listeners += $v6
  Check 'ports: a port in use on ::1 only (Vite on "localhost") is not free' (-not (Test-PortFree $v6port))

  Check 'health: nothing listening -> not healthy' (-not (Test-AppHealthy $start))

  $upPort = Get-FreePort ($v6port + 10)
  $jobs += Start-FakeHealth $upPort '{"status":"UP"}'
  Check 'health: UP in actuator''s media type -> healthy' (Test-AppHealthy $upPort)
  $downPort = Get-FreePort ($upPort + 1)
  $jobs += Start-FakeHealth $downPort '{"status":"DOWN"}'
  Check 'health: DOWN -> not healthy' (-not (Test-AppHealthy $downPort))

  # --- run state ------------------------------------------------------------
  $file = Join-Path $temp 'state.json'
  Check 'state: no file -> $null' ($null -eq (Read-RunState $file))
  Save-RunState $file @{ port = 1234 }
  $state = Read-RunState $file
  Check 'state: round trip, this process is running' ($state.running -and [int]$state.port -eq 1234 -and [int]$state.pid -eq $PID)

  $doc = Get-Content $file -Raw | ConvertFrom-Json
  $doc.startTicks = [long]$doc.startTicks - 10000000
  $doc | ConvertTo-Json | Set-Content $file -Encoding UTF8
  Check 'state: same PID, other start time (PID reused) -> not running' (-not (Read-RunState $file).running)

  $tree = Start-Tree; $cleanup += $tree.Parent, $tree.Child
  Stop-Process -Id $tree.Parent -Force; Stop-Process -Id $tree.Child -Force
  Start-Sleep -Milliseconds 300
  $doc.pid = $tree.Parent
  $doc | ConvertTo-Json | Set-Content $file -Encoding UTF8
  Check 'state: recorded process has exited -> not running' (-not (Read-RunState $file).running)

  Remove-RunState $file
  Check 'state: Remove-RunState leaves another run''s file alone' (Test-Path $file)
  Save-RunState $file @{}
  Remove-RunState $file
  Check 'state: Remove-RunState removes this run''s file' (-not (Test-Path $file))

  Set-Content $file 'not json' -Encoding ASCII
  Check 'state: unreadable file -> $null' ($null -eq (Read-RunState $file))

  # --- process tree -----------------------------------------------------------
  $tree = Start-Tree; $cleanup += $tree.Parent, $tree.Child
  $other = Start-Tree; $cleanup += $other.Parent, $other.Child
  # The tree also holds the conhost.exe that Windows gives the hidden cmd.
  $ids = Get-ProcessTreeIds $tree.Parent
  Check 'tree: the parent and its child, nothing from another tree' (
    $ids -contains $tree.Parent -and $ids -contains $tree.Child -and $ids -notcontains $other.Parent -and $ids -notcontains $other.Child)
  Stop-ProcessTree $tree.Parent | Out-Null
  Start-Sleep -Milliseconds 300
  Check 'tree: Stop-ProcessTree ends the whole tree' (@($ids | Where-Object { Test-Alive $_ }).Count -eq 0)
  Check 'tree: an unrelated process keeps running' ((Test-Alive $other.Parent) -and (Test-Alive $other.Child))
} finally {
  foreach ($l in $listeners) { $l.Stop() }
  if ($jobs) { $jobs | Stop-Job; $jobs | Remove-Job -Force }
  $alive = @($cleanup | Where-Object { Test-Alive $_ })
  if ($alive.Count) { Stop-Process -Id $alive -Force -ErrorAction SilentlyContinue }
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}

if ($failures) { Write-Host "$failures scenario(s) failed" -ForegroundColor Red; exit 1 }
Write-Host 'All scenarios passed' -ForegroundColor Green
