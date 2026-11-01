<#
.SYNOPSIS
  Runs a backend jar against a COPY of the real data and captures everything
  needed to compare it with another run.

.DESCRIPTION
  Extracts a backup zip (default: the newest in backups\) into
  %TEMP%\bci-rehearsal\<Label>\data, starts the jar on it with the datasource
  and upload dir overridden (backend\data is never touched), captures every
  GET endpoint (capture_api.py), stops the app, then dumps every table to CSV
  and the schema to schema.sql. Flyway migrations therefore run on the copy,
  exactly as they would on the real database at the next start.
  Without -Jar it only extracts and dumps the untouched backup (the reference
  for compare_tables.py).

.EXAMPLE
  .\tools\rehearsal\rehearse.ps1 -Label orig
  .\tools\rehearsal\rehearse.ps1 -Label before -Jar $baseJar -Port 18083
  .\tools\rehearsal\rehearse.ps1 -Label after  -Jar $newJar  -Port 18084
  python tools\rehearsal\compare_api.py    $env:TEMP\bci-rehearsal\before\api    $env:TEMP\bci-rehearsal\after\api
  python tools\rehearsal\compare_tables.py $env:TEMP\bci-rehearsal\orig\tables   $env:TEMP\bci-rehearsal\after\tables
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$Label,
  [string]$Jar,
  [int]$Port = 18083,
  [string]$Backup
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $Backup) {
  $Backup = (Get-ChildItem (Join-Path $repo 'backups\*.zip') | Sort-Object LastWriteTime | Select-Object -Last 1).FullName
  if (-not $Backup) { throw 'No backup zip found in backups\; run backup-data.ps1 first.' }
}
$java = if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) { Join-Path $env:JAVA_HOME 'bin\java.exe' } else { 'java' }
$h2 = (Get-ChildItem (Join-Path $env:USERPROFILE '.m2\repository\com\h2database\h2') -Recurse -Filter 'h2-*.jar' |
       Sort-Object FullName | Select-Object -Last 1).FullName
if (-not $h2) { throw 'H2 jar not found in ~/.m2; build the backend once first.' }

$root = Join-Path $env:TEMP "bci-rehearsal\$Label"
if (Test-Path $root) { Remove-Item -Recurse -Force $root }
New-Item -ItemType Directory "$root\data\images", "$root\tables" -Force | Out-Null
Expand-Archive $Backup "$root\data"
Get-ChildItem "$root\data" -Filter '*.lock.db' | Remove-Item -Force
$dbPath = ($root -replace '\\', '/') + '/data/booksdb'
Write-Host "[rehearse] $Label <- $(Split-Path $Backup -Leaf)"

if ($Jar) {
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Port $Port is in use." }
  $p = Start-Process -FilePath $java -WorkingDirectory $root -PassThru -WindowStyle Hidden `
      -RedirectStandardOutput "$root\app.log" -RedirectStandardError "$root\app.err" `
      -ArgumentList @('-Dfile.encoding=UTF-8', '-jar', $Jar, "--server.port=$Port",
          "--spring.datasource.url=jdbc:h2:file:$dbPath", "--app.upload.dir=$root\data\images",
          '--spring.h2.console.enabled=false', '--spring.devtools.restart.enabled=false')
  try {
    for ($i = 0; $i -lt 90 -and -not $p.HasExited; $i++) {
      Start-Sleep 1
      if (Select-String -Path "$root\app.log" -Pattern 'Started BooksCoreIdeasApplication|APPLICATION FAILED|Application run failed' -Quiet) { break }
    }
    Select-String -Path "$root\app.log" -Pattern 'Migrat|Started Books|FAILED|ERROR' |
      ForEach-Object { $_.Line.Substring([Math]::Min(60, $_.Line.Length)) }
    if (-not (Select-String -Path "$root\app.log" -Pattern 'Started BooksCoreIdeasApplication' -Quiet)) {
      throw "App did not start; see $root\app.log"
    }
    # 127.0.0.1: the app listens only there (SEC-03); "localhost" tries ::1 first, and on
    # Windows each refused attempt costs ~2 s per request.
    python (Join-Path $PSScriptRoot 'capture_api.py') "http://127.0.0.1:$Port" "$root\api"
    if ($LASTEXITCODE) { throw 'capture failed' }
  } finally {
    if (-not $p.HasExited) { Stop-Process -Id $p.Id; $p.WaitForExit() }
  }
}

$tables = 'BOOKS', 'PARTS', 'CHAPTERS', 'KEY_IDEAS', 'EXCERPTS', 'BOOK_REVIEWS', 'CHAPTER_IMAGES',
          'CHAPTER_EXPLANATIONS', 'BOOK_COLLECTIONS', 'BOOK_COLLECTION_ITEMS', 'READING_BOOKMARKS', 'EXPLANATION_MARKS'
$out = ($root -replace '\\', '/') + '/tables'
$sql = ($tables | ForEach-Object { "CALL CSVWRITE('$out/$_.csv', 'SELECT * FROM $_ ORDER BY ID', 'charset=UTF-8');" }) -join "`n"
Set-Content "$root\dump.sql" $sql -Encoding ASCII
& $java -cp $h2 org.h2.tools.RunScript -url "jdbc:h2:file:$dbPath" -user sa -script "$root\dump.sql" | Out-Null
& $java -cp $h2 org.h2.tools.Script -url "jdbc:h2:file:$dbPath" -user sa -script "$root\schema.sql" -options NODATA | Out-Null
Write-Host "[rehearse] ready: $root"
