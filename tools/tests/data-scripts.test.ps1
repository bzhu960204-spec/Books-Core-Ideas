<#
.SYNOPSIS
  Scenario tests for backup-data.ps1 / restore-data.ps1 (Windows PowerShell 5.1+).

.DESCRIPTION
  Runs entirely in temp directories; backend\data is never touched. "The app has
  the database open" is simulated by holding a handle on booksdb.mv.db, the way
  the H2 process does. Exits 1 if any scenario fails.

.EXAMPLE
  powershell -NoProfile -File tools\tests\data-scripts.test.ps1
#>
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$backupScript = Join-Path $repo 'backup-data.ps1'
$restoreScript = Join-Path $repo 'restore-data.ps1'
$failures = 0

function New-DataDir([switch]$Lock) {
  $root = Join-Path $env:TEMP ('bci-scripttest-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory "$root\data\images", "$root\backups" -Force | Out-Null
  Set-Content "$root\data\booksdb.mv.db" 'database bytes' -Encoding ASCII
  Set-Content "$root\data\images\a.png" 'image bytes' -Encoding ASCII
  if ($Lock) { Set-Content "$root\data\booksdb.lock.db" 'lock' -Encoding ASCII }
  return $root
}

function Open-Shared([string]$path) {
  # Same sharing as the JVM: others may read/write, but nobody can open it exclusively.
  return [IO.File]::Open($path, 'Open', 'ReadWrite', 'ReadWrite')
}

function Invoke-Quiet([scriptblock]$block) {
  try { & $block 3>$null 6>$null | Out-Null; return $null } catch { return $_.Exception.Message }
}

function Check([string]$name, [bool]$ok, [string]$detail = '') {
  if ($ok) { Write-Host "PASS  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name $detail" -ForegroundColor Red; $script:failures++ }
}

function Get-ZipEntries([string]$dir) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = Get-ChildItem "$dir\*.zip" | Select-Object -First 1
  if (-not $zip) { return @() }
  $z = [IO.Compression.ZipFile]::OpenRead($zip.FullName)
  try { return @($z.Entries | ForEach-Object { $_.FullName -replace '\\', '/' }) } finally { $z.Dispose() }
}

$roots = @()
try {
  # --- backup ---------------------------------------------------------------
  $r = New-DataDir; $roots += $r
  $err = Invoke-Quiet { & $backupScript -DataDir "$r\data" -BackupDir "$r\backups" -Label plain }
  Check 'backup: no lock file -> zip created' (-not $err -and (Get-ZipEntries "$r\backups") -contains 'booksdb.mv.db') $err

  $r = New-DataDir -Lock; $roots += $r
  $err = Invoke-Quiet { & $backupScript -DataDir "$r\data" -BackupDir "$r\backups" -Label stale }
  $entries = Get-ZipEntries "$r\backups"
  Check 'backup: stale lock file (nobody has the db open) -> zip created without the lock' `
    (-not $err -and $entries -contains 'booksdb.mv.db' -and $entries -notcontains 'booksdb.lock.db') $err

  $r = New-DataDir -Lock; $roots += $r
  $h = Open-Shared "$r\data\booksdb.mv.db"
  try {
    $err = Invoke-Quiet { & $backupScript -DataDir "$r\data" -BackupDir "$r\backups" -Label live }
    Check 'backup: database open by another process -> refused' ($err -match 'in use' -and @(Get-ChildItem "$r\backups\*.zip").Count -eq 0) $err
    # An open H2 file can't be copied consistently (and Compress-Archive can't even read it): no override.
    $err = Invoke-Quiet { & $backupScript -DataDir "$r\data" -BackupDir "$r\backups" -Label forced -Force }
    Check 'backup: -Force does not override a database in use, no partial zip' ($err -match 'in use' -and @(Get-ChildItem "$r\backups\*.zip").Count -eq 0) $err
  } finally { $h.Dispose() }

  # --- restore --------------------------------------------------------------
  $src = New-DataDir; $roots += $src
  Set-Content "$src\data\booksdb.mv.db" 'restored bytes' -Encoding ASCII
  $zip = & $backupScript -DataDir "$src\data" -BackupDir "$src\backups" -Label source 6>$null | Select-Object -Last 1

  $r = New-DataDir -Lock; $roots += $r
  $err = Invoke-Quiet { & $restoreScript -BackupFile $zip -DataDir "$r\data" -BackupDir "$r\backups" -Confirm:$false }
  Check 'restore: stale lock file -> restored, current data saved first' `
    (-not $err -and (Get-Content "$r\data\booksdb.mv.db") -eq 'restored bytes' -and
     @(Get-ChildItem "$r\backups\*-pre-restore.zip").Count -eq 1 -and -not (Test-Path "$r\data\booksdb.lock.db")) $err

  $r = New-DataDir -Lock; $roots += $r
  $h = Open-Shared "$r\data\booksdb.mv.db"
  try {
    $err = Invoke-Quiet { & $restoreScript -BackupFile $zip -DataDir "$r\data" -BackupDir "$r\backups" -Confirm:$false }
  } finally { $h.Dispose() }
  Check 'restore: database open by another process -> refused, nothing changed' `
    ($err -match 'in use' -and (Get-Content "$r\data\booksdb.mv.db") -eq 'database bytes') $err
} finally {
  $roots | ForEach-Object { Remove-Item $_ -Recurse -Force -ErrorAction SilentlyContinue }
}

if ($failures) { Write-Host "$failures scenario(s) failed" -ForegroundColor Red; exit 1 }
Write-Host 'All scenarios passed' -ForegroundColor Green
