# Shared by start-dev.ps1 / stop-dev.ps1 / start-prod.ps1 / stop-prod.ps1 (dot-sourced).
#
# Free ports, waiting for the backend to be healthy, and stopping exactly the processes a
# start script launched: each start script records its own PID and start time in a state
# file, and the stop script ends that process tree (ENG-06). The start time guards against
# a PID that Windows has since given to another process.

function Test-PortFree([int]$Port) {
  <# Nothing listens on the port (IPv4 or IPv6) and it can actually be bound: Windows
     can reserve ports (e.g. Hyper-V ranges) that nobody listens on but nobody may use. #>
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { return $false }
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

function Get-FreePort([int]$StartPort, [int[]]$Reserved = @(), [int]$MaxTries = 100) {
  <# The first free port from $StartPort on, skipping $Reserved (ports chosen for other
     services that are not listening yet). #>
  for ($i = 0; $i -lt $MaxTries; $i++) {
    $candidate = $StartPort + $i
    if (($Reserved -notcontains $candidate) -and (Test-PortFree $candidate)) { return $candidate }
  }
  throw "No free port found in range $StartPort..$($StartPort + $MaxTries - 1)"
}

function Test-AppHealthy([int]$Port) {
  <# The backend on this port answers /actuator/health with UP (it is ours, started, and
     can reach its database). The backend listens on 127.0.0.1 only (SEC-03). #>
  try {
    # Actuator's own media type (application/vnd.spring-boot.actuator.v3+json) is not text
    # to PS 5.1, which then returns the body as bytes: ask for JSON, and decode bytes anyway.
    $response = Invoke-WebRequest "http://127.0.0.1:$Port/actuator/health" -UseBasicParsing -TimeoutSec 3 `
      -Headers @{ Accept = 'application/json' }
    $content = $response.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    return (($content | ConvertFrom-Json).status -eq 'UP')
  } catch {
    return $false
  }
}

function Test-HttpResponds([string]$Url) {
  try {
    Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Save-RunState([string]$Path, [hashtable]$Values) {
  <# Records this process (PID + start time) with $Values, for the matching stop script. #>
  $self = Get-Process -Id $PID
  $state = @{ pid = $PID; startTicks = $self.StartTime.ToUniversalTime().Ticks; startedAt = (Get-Date).ToString('o') }
  foreach ($key in $Values.Keys) { $state[$key] = $Values[$key] }
  $state | ConvertTo-Json | Set-Content -Path $Path -Encoding UTF8
}

function Read-RunState([string]$Path) {
  <# The recorded state with .running = whether that very process is still alive; $null if
     there is no (readable) state file. #>
  if (-not (Test-Path $Path)) { return $null }
  try { $state = Get-Content $Path -Raw | ConvertFrom-Json } catch { return $null }
  $running = $false
  if ($state.pid) {
    $process = Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue
    $running = [bool]($process -and $process.StartTime.ToUniversalTime().Ticks -eq [long]$state.startTicks)
  }
  $state | Add-Member -NotePropertyName running -NotePropertyValue $running -Force
  return $state
}

function Remove-RunState([string]$Path) {
  <# Removes the state file if it describes this process (a newer run may have replaced it). #>
  $state = Read-RunState $Path
  if ($state -and [int]$state.pid -eq $PID) { Remove-Item $Path -ErrorAction SilentlyContinue }
}

function Get-ProcessTreeIds([int]$RootId) {
  <# $RootId and all its descendants. A child counts only if it is not older than its
     parent: ParentProcessId may name a PID that has since been reused. #>
  $created = @{}
  $children = @{}
  foreach ($p in Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, CreationDate) {
    $created[[int]$p.ProcessId] = $p.CreationDate
    $parent = [int]$p.ParentProcessId
    if (-not $children.ContainsKey($parent)) { $children[$parent] = New-Object System.Collections.Generic.List[int] }
    $children[$parent].Add([int]$p.ProcessId)
  }
  $ids = New-Object System.Collections.Generic.List[int]
  $queue = New-Object System.Collections.Generic.Queue[int]
  $queue.Enqueue($RootId)
  while ($queue.Count) {
    $id = $queue.Dequeue()
    if ($ids.Contains($id)) { continue }
    $ids.Add($id)
    if (-not $children.ContainsKey($id)) { continue }
    foreach ($child in $children[$id]) {
      if ($child -ne $id -and $created[$child] -ge $created[$id]) { $queue.Enqueue($child) }
    }
  }
  return $ids.ToArray()
}

function Stop-ProcessTree([int]$RootId) {
  <# Stops $RootId and everything it started (job hosts, mvnw, the JVMs, node). #>
  $ids = @(Get-ProcessTreeIds $RootId)
  [array]::Reverse($ids)
  foreach ($id in $ids) {
    try {
      Stop-Process -Id $id -Force -ErrorAction Stop
    } catch [Microsoft.PowerShell.Commands.ProcessCommandException] {
      # Already gone: it exited along with its parent.
    }
  }
  return $ids.Count
}

function Stop-PortListeners([int[]]$Ports) {
  <# Fallback when no running start script is recorded: stops whatever listens on the ports. #>
  foreach ($port in $Ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
      Write-Host "No listening process on port $port"
      continue
    }
    foreach ($processId in @($connections | Select-Object -ExpandProperty OwningProcess -Unique)) {
      try {
        Stop-Process -Id $processId -Force -ErrorAction Stop
        Write-Host "Stopped process $processId on port $port"
      } catch {
        Write-Host "Failed to stop process $processId on port ${port}: $($_.Exception.Message)"
      }
    }
  }
}
