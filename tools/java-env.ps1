# Shared by start-dev.ps1, start-prod.ps1 and build-prod.ps1 (dot-sourced).
#
# The backend needs Java 17+, both to build (Maven, which also enforces it) and to run.
# If JAVA_HOME or the java on PATH is older, put the path of a JDK 17+ in a .java-home
# file in the repository root (git-ignored): the scripts use it for their own session
# only (ENG-04).

$script:MinimumJavaVersion = 17

function Set-ProjectJavaHome([string]$RepoRoot) {
  <# Applies .java-home, if present, to this process (JAVA_HOME and PATH). #>
  $file = Join-Path $RepoRoot '.java-home'
  if (-not (Test-Path $file)) { return }
  $javaHome = (Get-Content $file -Raw).Trim()
  if (-not $javaHome) { return }
  if (-not (Test-Path (Join-Path $javaHome 'bin\java.exe'))) {
    throw ".java-home points to '$javaHome', which has no bin\java.exe."
  }
  $env:JAVA_HOME = $javaHome
  $env:Path = "$javaHome\bin;$env:Path"
  Write-Host "[java] JAVA_HOME -> $javaHome (from .java-home)"
}

function Get-JavaMajorVersion([string]$JavaExe) {
  <# 17 for "17.0.19", 8 for "1.8.0_x"; $null if it cannot be run or parsed. #>
  try {
    $info = New-Object Diagnostics.ProcessStartInfo $JavaExe, '-version'
    $info.UseShellExecute = $false
    $info.RedirectStandardError = $true
    $info.RedirectStandardOutput = $true
    $info.CreateNoWindow = $true
    $process = [Diagnostics.Process]::Start($info)
    $text = $process.StandardError.ReadToEnd() + $process.StandardOutput.ReadToEnd()
    $process.WaitForExit()
  } catch {
    return $null
  }
  $match = [regex]::Match($text, 'version "(\d+)(?:\.(\d+))?')
  if (-not $match.Success) { return $null }
  $major = [int]$match.Groups[1].Value
  if ($major -eq 1 -and $match.Groups[2].Success) { $major = [int]$match.Groups[2].Value }
  return $major
}

function Assert-ProjectJava([string]$RepoRoot) {
  <# Checks the Java that Maven and the scripts will use (JAVA_HOME, else java on PATH)
     and returns its executable; throws with a hint when it is missing or too old. #>
  $min = $script:MinimumJavaVersion
  $hint = "Install JDK $min+ and set JAVA_HOME, or put the JDK path in $(Join-Path $RepoRoot '.java-home')."
  if ($env:JAVA_HOME) {
    $java = Join-Path $env:JAVA_HOME 'bin\java.exe'
    if (-not (Test-Path $java)) { throw "JAVA_HOME is '$env:JAVA_HOME', which has no bin\java.exe. $hint" }
  } else {
    $command = Get-Command java -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) { throw "Java not found (no JAVA_HOME, no java on PATH). $hint" }
    $java = $command.Source
  }
  $major = Get-JavaMajorVersion $java
  if ($null -eq $major) { throw "Could not determine the version of $java. $hint" }
  if ($major -lt $min) { throw "Java $major found ($java), but the backend needs Java $min or newer. $hint" }
  return $java
}
