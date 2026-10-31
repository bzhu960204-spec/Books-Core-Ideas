<#
.SYNOPSIS
  Builds the backend jar for a git ref (or the working tree) for rehearsals.

.DESCRIPTION
  With -Ref, the ref is checked out into a temporary git worktree and built
  there, so backend\target of the working copy is not touched (a running dev
  backend with devtools would restart on changes there and migrate the real
  database). Without -Ref the working tree itself is packaged, which rebuilds
  backend\target: the script refuses while something listens on port 8080.
  Tests are skipped; run them separately.

.EXAMPLE
  .\tools\rehearsal\build-jar.ps1 -Ref HEAD      # baseline: last commit
  .\tools\rehearsal\build-jar.ps1                # candidate: working tree
#>
[CmdletBinding()]
param(
  [string]$Ref,
  [string]$OutDir = (Join-Path $env:TEMP 'bci-jars')
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
New-Item -ItemType Directory $OutDir -Force | Out-Null

if ($Ref) {
  $sha = (git -C $repo rev-parse --short $Ref).Trim()
  $wt = Join-Path $env:TEMP "bci-wt-$sha"
  if (Test-Path $wt) { git -C $repo worktree remove --force $wt }
  git -C $repo worktree add --detach $wt $sha | Out-Null
  try {
    Push-Location (Join-Path $wt 'backend')
    try { mvn -q -DskipTests package; if ($LASTEXITCODE) { throw "build failed for $Ref" } } finally { Pop-Location }
    $jar = Join-Path $OutDir "$sha.jar"
    Copy-Item (Get-ChildItem (Join-Path $wt 'backend\target\*.jar') | Select-Object -First 1).FullName $jar -Force
  } finally {
    git -C $repo worktree remove --force $wt
  }
} else {
  if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 8080 is in use (dev backend running?). Stop it first: packaging rewrites backend\target.'
  }
  Push-Location (Join-Path $repo 'backend')
  try { mvn -q -DskipTests package; if ($LASTEXITCODE) { throw 'build failed' } } finally { Pop-Location }
  $jar = Join-Path $OutDir 'working-tree.jar'
  Copy-Item (Get-ChildItem (Join-Path $repo 'backend\target\*.jar') | Select-Object -First 1).FullName $jar -Force
}
Write-Output $jar
