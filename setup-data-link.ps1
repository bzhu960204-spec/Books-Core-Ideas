<#
.SYNOPSIS
  Link backend/data to the OneDrive ProjectData folder so application data is
  synced via OneDrive instead of committed to git.

.DESCRIPTION
  The real database + uploaded images live under:
    <OneDrive>\ProjectData\books-core-ideas\data
  This script creates a directory junction at backend\data pointing there.
  Run it once per machine after cloning the repo (the data folder is gitignored,
  so a fresh clone has no data until OneDrive syncs it down and this link exists).

.NOTES
  - Junction (mklink /J) does NOT require administrator rights.
  - Do NOT run the app on two machines at the same time: the live H2 database
    file is synced by OneDrive and concurrent access can create conflict copies
    and corrupt it. Close the app and wait for OneDrive to finish syncing
    (icon turns green) before using another machine.
#>
[CmdletBinding()]
param(
    # Override if your OneDrive root differs from the $env:OneDrive default.
    [string]$DataDir = (Join-Path $env:OneDrive 'ProjectData\books-core-ideas\data')
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$link = Join-Path $scriptRoot 'backend\data'

Write-Host "Project data link setup" -ForegroundColor Cyan
Write-Host "  Link  : $link"
Write-Host "  Target: $DataDir"
Write-Host ""

# Ensure the OneDrive target exists (first machine creates it; others wait for sync).
if (-not (Test-Path $DataDir)) {
    Write-Host "Target folder does not exist yet. Creating it..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
}

if (Test-Path $link) {
    $item = Get-Item $link -Force
    if ($item.LinkType -eq 'Junction') {
        if ($item.Target -eq $DataDir) {
            Write-Host "Junction already points to the target. Nothing to do." -ForegroundColor Green
            return
        }
        Write-Host "Removing existing junction (points elsewhere: $($item.Target))" -ForegroundColor Yellow
        cmd /c rmdir "$link" | Out-Null
    }
    else {
        throw "backend\data exists and is NOT a junction. Move/back up its contents to '$DataDir' first, then delete it and re-run."
    }
}

cmd /c mklink /J "$link" "$DataDir" | Out-Null

$item = Get-Item $link -Force
if ($item.LinkType -eq 'Junction' -and $item.Target -eq $DataDir) {
    Write-Host "Junction created successfully." -ForegroundColor Green
}
else {
    throw "Failed to create junction."
}
