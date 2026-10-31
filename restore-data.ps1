<#
.SYNOPSIS
  Restore backend\data from a zip produced by backup-data.ps1.

.DESCRIPTION
  The app must be stopped. Before anything is overwritten, the current data is
  itself backed up (label "pre-restore"), so a restore can always be undone.
  backend\data may be a junction (see setup-data-link.ps1): only its contents
  are replaced, the directory/junction itself is kept.

.EXAMPLE
  .\restore-data.ps1 -Latest
  .\restore-data.ps1 -BackupFile .\backups\data-20261031-200000-before-flyway.zip
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
  [string]$BackupFile,
  [switch]$Latest,
  [string]$DataDir,
  [string]$BackupDir,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $DataDir)   { $DataDir   = Join-Path $scriptRoot 'backend\data' }
if (-not $BackupDir) { $BackupDir = Join-Path $scriptRoot 'backups' }

if ($Latest) {
  $BackupFile = Get-ChildItem $BackupDir -Filter 'data-*.zip' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike '*-pre-restore.zip' } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
  if (-not $BackupFile) { throw "No backups found in $BackupDir" }
}
if (-not $BackupFile) { throw "Specify -BackupFile <zip> or -Latest." }
if (-not (Test-Path $BackupFile)) { throw "Backup file not found: $BackupFile" }
$BackupFile = (Resolve-Path $BackupFile).Path

if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null }

$locks = @(Get-ChildItem $DataDir -Filter '*.lock.db' -File -ErrorAction SilentlyContinue)
if ($locks.Count -gt 0 -and -not $Force) {
  throw "Database appears to be in use ($($locks[0].Name) exists). Stop the app first, or pass -Force if the lock file is stale."
}

if (-not $PSCmdlet.ShouldProcess($DataDir, "Replace contents with $BackupFile")) { return }

$current = @(Get-ChildItem $DataDir -Force | Where-Object { $_.Name -notlike '*.lock.db' })
if ($current.Count -gt 0) {
  $safety = & (Join-Path $scriptRoot 'backup-data.ps1') -DataDir $DataDir -BackupDir $BackupDir -Label 'pre-restore' -Force |
    Select-Object -Last 1
  Write-Host "Current data saved to $safety"
}

Get-ChildItem $DataDir -Force | Remove-Item -Recurse -Force
Expand-Archive -Path $BackupFile -DestinationPath $DataDir -Force

Write-Host "Restored $BackupFile -> $DataDir" -ForegroundColor Green
