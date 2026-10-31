<#
.SYNOPSIS
  Snapshot backend\data (H2 database + uploaded images) into a timestamped zip.

.DESCRIPTION
  Intended to be run manually before risky changes (schema refactors, large
  imports). The app must be stopped so the database files are consistent; the
  script refuses to run while H2's lock file is present unless -Force is given.

.EXAMPLE
  .\backup-data.ps1 -Label before-flyway-refactor
#>
[CmdletBinding()]
param(
  [string]$DataDir,
  [string]$BackupDir,
  [string]$Label = '',
  # Skip the "app is running" check (e.g. a stale lock file left by a crash).
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $DataDir)   { $DataDir   = Join-Path $scriptRoot 'backend\data' }
if (-not $BackupDir) { $BackupDir = Join-Path $scriptRoot 'backups' }

if (-not (Test-Path $DataDir)) { throw "Data directory not found: $DataDir" }

$locks = @(Get-ChildItem $DataDir -Filter '*.lock.db' -File -ErrorAction SilentlyContinue)
if ($locks.Count -gt 0 -and -not $Force) {
  throw "Database appears to be in use ($($locks[0].Name) exists). Stop the app first (stop-dev.ps1 / stop-prod.ps1), or pass -Force if the lock file is stale."
}

$items = @(Get-ChildItem $DataDir -Force | Where-Object { $_.Name -notlike '*.lock.db' })
if ($items.Count -eq 0) { throw "Nothing to back up: $DataDir is empty." }

if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }

$safeLabel = ($Label -replace '[^A-Za-z0-9_-]+', '-').Trim('-')
$name = 'data-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
if ($safeLabel) { $name += "-$safeLabel" }
$zip = Join-Path $BackupDir "$name.zip"

Compress-Archive -Path $items.FullName -DestinationPath $zip -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "Backup created: $zip ($sizeMb MB)" -ForegroundColor Green
# Emit the path so callers (e.g. restore-data.ps1) can capture it.
Write-Output $zip
