Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:FixtureWorkspace = [IO.Path]::GetFullPath('D:/Masarifi-integration-2026-10-10')
$script:FixtureRoot = Join-Path $script:FixtureWorkspace '.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/runner-prep/pg17'
$script:RuntimeRoot = Join-Path $script:FixtureRoot 'runtime'
$script:RuntimeBin = Join-Path $script:RuntimeRoot 'pgsql/bin'

function Assert-FixturePath([string]$Path, [string]$Root = $script:FixtureRoot) {
  $full = [IO.Path]::GetFullPath($Path)
  $rootFull = [IO.Path]::GetFullPath($Root)
  if ($full -ne $rootFull -and -not $full.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'FIXTURE_PATH_OUTSIDE_ROOT' }
  $cursor = $full
  while ($cursor) {
    if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'FIXTURE_REPARSE_POINT' }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  return $full
}

function Write-FixtureExclusive([string]$Path, [object]$Value) {
  $null = Assert-FixturePath $Path
  $stream = [IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($Value | ConvertTo-Json -Depth 8))
    $stream.Write($bytes,0,$bytes.Length)
    $stream.Flush($true)
  } finally { $stream.Dispose() }
}

function Get-FixtureRuntimeFiles {
  $null = Assert-FixturePath $script:RuntimeRoot
  $directories = [Collections.Generic.Stack[IO.DirectoryInfo]]::new()
  $directories.Push([IO.DirectoryInfo]::new($script:RuntimeRoot))
  $files = [Collections.Generic.Dictionary[string,IO.FileInfo]]::new([StringComparer]::OrdinalIgnoreCase)
  while ($directories.Count) {
    foreach ($entry in $directories.Pop().GetFileSystemInfos()) {
      if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'RUNTIME_REPARSE_POINT' }
      if ($entry -is [IO.DirectoryInfo]) { $directories.Push($entry) }
      else { $files.Add([IO.Path]::GetRelativePath($script:RuntimeRoot,$entry.FullName).Replace('\','/'),$entry) }
    }
  }
  return $files
}

function Get-FixtureFileHash([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  try { return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)) } finally { $stream.Dispose() }
}

function Assert-FixtureRuntime {
  $manifestPath = Join-Path $script:FixtureRoot 'runtime-manifest.json'
  $null = Assert-FixturePath $manifestPath
  if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -ne $script:FixtureBundle.runtimeManifestSha256) { throw 'RUNTIME_MANIFEST_CHANGED' }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $archive = Assert-FixturePath (Join-Path $script:FixtureRoot 'postgresql-17.11-windows-x64-binaries.zip')
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $manifest.archiveSha256 -or $manifest.archiveSha256 -ne '80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F') { throw 'RUNTIME_ARCHIVE_MISMATCH' }
  $actual = Get-FixtureRuntimeFiles
  if ($actual.Count -ne $manifest.files.Count) { throw 'RUNTIME_FILE_SET_MISMATCH' }
  foreach ($file in $manifest.files) {
    if (-not $actual.ContainsKey($file.path)) { throw 'RUNTIME_FILE_SET_MISMATCH' }
    $entry = $actual[$file.path]
    if ($entry.Length -ne $file.bytes -or (Get-FixtureFileHash $entry.FullName) -ne $file.sha256) { throw 'RUNTIME_FILE_HASH_MISMATCH' }
  }
}

function Test-FixtureServerIdentity([object]$Process, [object]$Intent) {
  if (-not $Process) { return $false }
  $binary = Join-Path $script:RuntimeBin 'postgres.exe'
  $data = Join-Path $script:FixtureRoot 'data'
  $argument = '(?:^|\s)(?:"-D"|-D)\s+(?:"' + [regex]::Escape($data) + '"|' + [regex]::Escape($data) + ')(?:\s|$)'
  return $Process.ExecutablePath -eq $binary -and $Process.CreationDate.ToUniversalTime() -ge [datetime]::Parse($Intent.createdAt).ToUniversalTime() -and $Process.CommandLine -match $argument
}

function New-FixtureProcessInfo([string]$Name, [string[]]$Arguments, [object]$Intent) {
  $binary = Assert-FixturePath (Join-Path $script:RuntimeBin $Name) $script:RuntimeRoot
  $null = Assert-FixturePath $Intent.runDirectory
  $info = [Diagnostics.ProcessStartInfo]::new($binary)
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.WorkingDirectory = $script:RuntimeBin
  foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
  $info.Environment.Clear()
  $info.Environment['SystemRoot'] = [Environment]::GetFolderPath('Windows')
  $info.Environment['WINDIR'] = [Environment]::GetFolderPath('Windows')
  $info.Environment['PATH'] = $script:RuntimeBin + ';' + [Environment]::GetFolderPath('System')
  $info.Environment['TEMP'] = $Intent.runDirectory
  $info.Environment['TMP'] = $Intent.runDirectory
  $info.Environment['PGCONNECT_TIMEOUT'] = '3'
  $info.Environment['PGOPTIONS'] = '-c statement_timeout=3000 -c lock_timeout=1000'
  return $info
}

function Invoke-FixtureNative([string]$Name, [string[]]$Arguments, [int]$DeadlineMs, [object]$Intent) {
  Assert-FixtureRuntime
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = New-FixtureProcessInfo $Name $Arguments $Intent
  try {
    if ($Intent.PSObject.Properties['beforeNativeStart']) { & $Intent.beforeNativeStart }
    if (-not $process.Start()) { throw 'FIXTURE_NATIVE_START_FAILED' }
    $null = $process.SafeHandle
    $outTask = $process.StandardOutput.ReadToEndAsync()
    $errTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($DeadlineMs)) {
      # This is the retained handle of our own helper, never a PID lookup or process tree.
      $process.Kill()
      $null = $process.WaitForExit(3000)
      throw 'FIXTURE_NATIVE_DEADLINE'
    }
    $stdout = $outTask.GetAwaiter().GetResult()
    $stderr = $errTask.GetAwaiter().GetResult()
    Write-FixtureExclusive (Join-Path $Intent.runDirectory ($Name + '-' + [guid]::NewGuid().ToString('n') + '.json')) ([ordered]@{binary=$process.StartInfo.FileName;exitCode=$process.ExitCode;stdout=$stdout;stderr=$stderr})
    if ($process.ExitCode -ne 0) { throw 'FIXTURE_NATIVE_NONZERO_EXIT' }
    return $stdout.Trim()
  } finally { $process.Dispose() }
}

function Start-FixturePostmaster([object]$Intent, [object]$Context) {
  Assert-FixtureRuntime
  $data = Assert-FixturePath (Join-Path $script:FixtureRoot 'data')
  $log = Assert-FixturePath (Join-Path $Intent.runDirectory 'server.log')
  if (Test-Path -LiteralPath $log) { throw 'FIXTURE_LOG_ALREADY_EXISTS' }
  $arguments = @('-D',$data,'-h','127.0.0.1','-p','55473','-c','max_connections=12','-c','shared_buffers=16MB','-c','max_worker_processes=0','-c','autovacuum=off','-c','logging_collector=on','-c',('log_directory='+$Intent.runDirectory),'-c','log_filename=server.log')
  $handle = [Diagnostics.Process]::new()
  $handle.StartInfo = New-FixtureProcessInfo 'postgres.exe' $arguments $Intent
  $handle.StartInfo.RedirectStandardOutput = $false
  $handle.StartInfo.RedirectStandardError = $false
  $handle.StartInfo.RedirectStandardInput = $true
  if (-not $handle.Start()) { $handle.Dispose();throw 'FIXTURE_POSTMASTER_START_FAILED' }
  $Context.Handle = $handle
  $null = $handle.SafeHandle
  $handle.StandardInput.Close()
  $Context.HandleStart = $handle.StartTime.ToUniversalTime().ToString('o')
  $cim = Get-CimInstance Win32_Process -Filter "ProcessId=$($handle.Id)"
  if (-not (Test-FixtureServerIdentity $cim $Intent) -or $handle.Path -ne $cim.ExecutablePath) { throw 'FIXTURE_DIRECT_LAUNCH_IDENTITY_MISMATCH' }
  $record = [ordered]@{status='provisional';pid=$handle.Id;handleStart=$Context.HandleStart;start=$cim.CreationDate.ToUniversalTime().ToString('o');binary=$handle.Path;commandLine=$cim.CommandLine;dataDirectory=$data;port=55473;listen='127.0.0.1';runDirectory=$Intent.runDirectory;bundleSha256=$Intent.bundleSha256}
  $Context.Record = $record
  Write-FixtureExclusive (Join-Path $Intent.runDirectory 'provisional-process.json') $record
  return $record
}

function Read-FixturePidFile([object]$Record) {
  $path = Assert-FixturePath (Join-Path $Record.dataDirectory 'postmaster.pid')
  $lines = [IO.File]::ReadAllLines($path)
  if ($lines.Count -lt 2) { throw 'FIXTURE_PIDFILE_INCOMPLETE' }
  return [pscustomobject]@{pid=[int]$lines[0];dataDirectory=[IO.Path]::GetFullPath($lines[1])}
}

function Read-FixtureOwnershipRecord([string]$Path) {
  $path = Assert-FixturePath $Path
  # ISO strings are exact ownership tokens; automatic DateTime conversion changes comparisons.
  return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json -DateKind String
}

function Assert-FixtureOwnedIdentity([object]$Record, [object]$Handle, [object]$Cim, [object]$PidFile) {
  if ($Record.binary -ne (Join-Path $script:RuntimeBin 'postgres.exe') -or $Record.dataDirectory -ne (Join-Path $script:FixtureRoot 'data') -or $Record.port -ne 55473 -or $Record.listen -ne '127.0.0.1') { throw 'FIXTURE_RECORDED_TARGET_MISMATCH' }
  if ($Handle.SafeHandle.IsInvalid -or $Handle.HasExited -or $Handle.Id -ne $Record.pid -or $Handle.Path -ne $Record.binary -or $Handle.StartTime.ToUniversalTime().ToString('o') -ne $Record.handleStart) { throw 'FIXTURE_HANDLE_IDENTITY_MISMATCH' }
  if (-not $Cim -or $Cim.ProcessId -ne $Record.pid -or $Cim.ExecutablePath -ne $Record.binary -or $Cim.CreationDate.ToUniversalTime().ToString('o') -ne $Record.start -or $Cim.CommandLine -ne $Record.commandLine) { throw 'FIXTURE_CIM_IDENTITY_MISMATCH' }
  if ($PidFile.pid -ne $Record.pid -or $PidFile.dataDirectory -ne $Record.dataDirectory) { throw 'FIXTURE_PIDFILE_IDENTITY_MISMATCH' }
}

function Signal-FixtureOwnedRecord([object]$Record, [object]$Handle, [object]$Intent) {
  $null = Assert-FixturePath $Record.dataDirectory
  $null = Assert-FixturePath $Record.runDirectory
  if ($Handle.HasExited) { return }
  # A real open SafeHandle pins the recorded process object/PID throughout signaling and waiting.
  $null = $Handle.SafeHandle
  $guard = {
    Assert-FixtureOwnedIdentity $Record $Handle (Get-CimInstance Win32_Process -Filter "ProcessId=$($Record.pid)") (Read-FixturePidFile $Record)
  }
  & $guard
  $signalContext = [pscustomobject]@{runDirectory=$Intent.runDirectory;beforeNativeStart=$guard}
  $null = Invoke-FixtureNative 'pg_ctl.exe' @('kill','INT',[string]$Record.pid) 5000 $signalContext
  if (-not $Handle.WaitForExit(8000)) { throw 'FIXTURE_CLEANUP_UNRESOLVED_RECORDED_PROCESS_REMAINS' }
  Write-FixtureExclusive (Join-Path $Record.runDirectory ('stopped-' + [guid]::NewGuid().ToString('n') + '.json')) ([ordered]@{pid=$Record.pid;handleStart=$Record.handleStart;stoppedAt=(Get-Date).ToUniversalTime().ToString('o')})
}

function Stop-FixtureOwnedRecord([object]$Record, [object]$Handle, [object]$Intent) {
  Assert-FixtureOwnedIdentity $Record $Handle (Get-CimInstance Win32_Process -Filter "ProcessId=$($Record.pid)") (Read-FixturePidFile $Record)
  if ($Record.status -eq 'verified') {
    $system = Invoke-FixtureNative 'psql.exe' @('-X','-h','127.0.0.1','-p','55473','-U','t03_owner','-d','postgres','-Atc','select system_identifier from pg_control_system()') 6000 $Intent
    if ($system -ne $Record.systemIdentifier) { throw 'FIXTURE_STOP_SYSTEM_ID_MISMATCH' }
  }
  Signal-FixtureOwnedRecord $Record $Handle $Intent
}
function Stop-FixtureCurrentStart([object]$Context, [object]$Intent) {
  if (-not $Context.Handle -or $Context.Handle.HasExited) { return }
  if ($Context.Record) {
    try {
      Signal-FixtureOwnedRecord $Context.Record $Context.Handle $Intent
      return
    } catch {
      $cause = $_.Exception.GetBaseException()
      if ($cause -isnot [IO.FileNotFoundException] -and $cause -isnot [IO.DirectoryNotFoundException] -and $_.Exception.Message -ne 'FIXTURE_PIDFILE_INCOMPLETE') { throw }
      # The provisional record precedes its disk write and the server's PID file creation.
      # Only this invocation's already-retained launch handle can resolve that early failure.
    }
  }
  if ($Context.Handle.HasExited) { return }
  # Receipt/CIM failure can occur immediately after our own Start(). Keep that same native handle.
  $handle = $Context.Handle
  if ($handle.SafeHandle.IsInvalid -or $handle.Path -ne (Join-Path $script:RuntimeBin 'postgres.exe') -or ($Context.HandleStart -and $handle.StartTime.ToUniversalTime().ToString('o') -ne $Context.HandleStart) -or ($Context.Record -and ($handle.Id -ne $Context.Record.pid -or $Context.Record.handleStart -ne $Context.HandleStart))) { throw 'FIXTURE_CURRENT_HANDLE_UNVERIFIED' }
  $handle.Kill()
  if (-not $handle.WaitForExit(5000)) { throw 'FIXTURE_CURRENT_CLEANUP_UNRESOLVED' }
}
