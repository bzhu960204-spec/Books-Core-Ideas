<#
.SYNOPSIS
  Snapshot backend\data (H2 database + uploaded images) into a timestamped zip.

.DESCRIPTION
  Intended to be run manually before risky changes (schema refactors, large
  imports). The app must be stopped so the database files are consistent: the
  script refuses while a process has the database open. A lock file left behind
  by a killed app (stale) is detected and ignored with a warning.

.EXAMPLE
  .\backup-data.ps1 -Label before-flyway-refactor
#>
[CmdletBinding()]
param(
  [string]$DataDir,
  [string]$BackupDir,
  [string]$Label = '',
  # Obsolete and ignored: stale lock files are now detected automatically, and an
  # open database can't be copied consistently, so there is nothing to override.
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptRoot 'tools\data-lock.ps1')
if (-not $DataDir)   { $DataDir   = Join-Path $scriptRoot 'backend\data' }
if (-not $BackupDir) { $BackupDir = Join-Path $scriptRoot 'backups' }

if (-not (Test-Path $DataDir)) { throw "Data directory not found: $DataDir" }

if ($Force) { Write-Warning '-Force is obsolete and ignored (stale lock files are detected automatically).' }
Assert-DataNotInUse $DataDir

$items = @(Get-ChildItem $DataDir -Force | Where-Object { $_.Name -notlike '*.lock.db' })
if ($items.Count -eq 0) { throw "Nothing to back up: $DataDir is empty." }

if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }

$safeLabel = ($Label -replace '[^A-Za-z0-9_-]+', '-').Trim('-')
$name = 'data-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
if ($safeLabel) { $name += "-$safeLabel" }
$zip = Join-Path $BackupDir "$name.zip"

try {
  Compress-Archive -Path $items.FullName -DestinationPath $zip -CompressionLevel Optimal
} catch {
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  throw
}

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "Backup created: $zip ($sizeMb MB)" -ForegroundColor Green
# Emit the path so callers (e.g. restore-data.ps1) can capture it.
Write-Output $zip
