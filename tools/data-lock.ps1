# Shared by backup-data.ps1 and restore-data.ps1 (dot-sourced).
#
# H2 leaves <db>.lock.db behind when the JVM is killed, so the lock file alone
# does not prove the database is in use. What does: the running H2 process keeps
# <db>.mv.db open, so nobody else can open it exclusively.

function Get-DataLockState([string]$DataDir) {
  <# Returns 'in-use' (a process has a database file open), 'stale' (lock file
     but nothing open) or 'free'. In-use also carries the file in $script:DataLockFile. #>
  foreach ($db in @(Get-ChildItem $DataDir -Filter '*.mv.db' -File -ErrorAction SilentlyContinue)) {
    try {
      $stream = [IO.File]::Open($db.FullName, 'Open', 'Read', 'None')
      $stream.Dispose()
    } catch [System.IO.IOException] {
      $script:DataLockFile = $db.Name
      return 'in-use'
    }
  }
  if (@(Get-ChildItem $DataDir -Filter '*.lock.db' -File -ErrorAction SilentlyContinue).Count -gt 0) { return 'stale' }
  return 'free'
}

function Assert-DataNotInUse([string]$DataDir) {
  switch (Get-DataLockState $DataDir) {
    'in-use' {
      throw "Database is in use: $script:DataLockFile is open by another process. Stop the app first (stop-dev.ps1 / stop-prod.ps1)."
    }
    'stale' {
      Write-Warning 'Ignoring a stale H2 lock file (left by an app that was killed): no process has the database open.'
    }
  }
}
