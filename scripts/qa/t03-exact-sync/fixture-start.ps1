param([switch]$StartApprovedFixture,[string]$ReviewedBundleSha256)
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath('D:/Masarifi-integration-2026-10-10')
$root = Join-Path $workspace '.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/runner-prep/pg17'
$bundlePath = Join-Path $root 'fixture-bundle.json'
# Bootstrap trust check precedes dot sourcing and every native call.
foreach ($path in @($bundlePath,$PSCommandPath)) {
  $cursor = [IO.Path]::GetFullPath($path)
  if (-not $cursor.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'BUNDLE_OUTSIDE_WORKSPACE' }
  while ($cursor) {
    if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'BUNDLE_REPARSE_POINT' }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
}
$bundleHash = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash
if ($StartApprovedFixture -and (-not $ReviewedBundleSha256 -or $ReviewedBundleSha256 -ne $bundleHash)) { throw 'REVIEWED_FIXTURE_BUNDLE_REQUIRED' }
$bundle = Get-Content -LiteralPath $bundlePath -Raw | ConvertFrom-Json
$expectedScripts = @('scripts/qa/t03-exact-sync/fixture-start.ps1','scripts/qa/t03-exact-sync/fixture-stop.ps1','scripts/qa/t03-exact-sync/fixture-common.ps1')
if ((@($bundle.scripts.path | Sort-Object) -join '|') -ne (@($expectedScripts | Sort-Object) -join '|')) { throw 'BUNDLE_SCRIPT_SET_MISMATCH' }
foreach ($file in $bundle.scripts) {
  $path = [IO.Path]::GetFullPath((Join-Path $workspace $file.path))
  if (-not $path.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'BUNDLE_SCRIPT_OUTSIDE_WORKSPACE' }
  $cursor = $path
  while ($cursor) {
    if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'BUNDLE_SCRIPT_REPARSE_POINT' }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $file.sha256) { throw 'BUNDLE_SCRIPT_MISMATCH' }
}
. (Join-Path $workspace 'scripts/qa/t03-exact-sync/fixture-common.ps1')
$script:FixtureBundle = $bundle
Assert-FixtureRuntime
$data = Assert-FixturePath (Join-Path $root 'data')
$intentPath = Assert-FixturePath (Join-Path $root 'startup-intent.json')
$receiptPath = Assert-FixturePath (Join-Path $root 'owned-process.json')
if ((Test-Path -LiteralPath $data) -or (Test-Path -LiteralPath $intentPath) -or (Test-Path -LiteralPath $receiptPath)) { throw 'FIXTURE_REQUIRES_NEW_OWNED_CLUSTER' }
if (Get-NetTCPConnection -LocalPort 55473 -ErrorAction SilentlyContinue) { throw 'FIXTURE_PORT_OCCUPIED' }
if (-not $StartApprovedFixture) { Write-Output 'Static preflight only: pinned bundle/runtime, safe paths, new data and free port; no native binary executed.'; return }

$run = Assert-FixturePath (Join-Path $root ('runs/' + [guid]::NewGuid().ToString('n')))
$null = New-Item -ItemType Directory -Path $run
$intent = [ordered]@{status='intent';createdAt=(Get-Date).ToUniversalTime().ToString('o');dataDirectory=$data;binary=(Join-Path $script:RuntimeBin 'postgres.exe');port=55473;listen='127.0.0.1';runDirectory=$run;bundleSha256=$bundleHash}
Write-FixtureExclusive $intentPath $intent
$success = $false
$context = @{Handle=$null;HandleStart=$null;Record=$null}
try {
  $version = Invoke-FixtureNative 'postgres.exe' @('--version') 5000 $intent
  if ($version -ne 'postgres (PostgreSQL) 17.11') { throw 'PG17_BINARY_VERSION_MISMATCH' }
  $null = Invoke-FixtureNative 'initdb.exe' @('-D',$data,'-U','t03_owner','-A','trust','--no-locale','--encoding','UTF8') 30000 $intent
  $pgVersionPath = Assert-FixturePath (Join-Path $data 'PG_VERSION')
  if ((Get-Content -LiteralPath $pgVersionPath -Raw).Trim() -ne '17') { throw 'PG17_DATA_VERSION_MISMATCH' }
  $provisional = Start-FixturePostmaster $intent $context
  $deadline = [Diagnostics.Stopwatch]::StartNew()
  $ready = $false
  while ($deadline.ElapsedMilliseconds -lt 15000 -and -not $context.Handle.HasExited) {
    $pidFile = Assert-FixturePath (Join-Path $data 'postmaster.pid')
    if (Test-Path -LiteralPath $pidFile) {
      $lines = [IO.File]::ReadAllLines($pidFile)
      if ($lines.Count -ge 8 -and $lines[7].Trim() -eq 'ready') { $ready=$true;break }
    }
    Start-Sleep -Milliseconds 100
  }
  if (-not $ready) { throw 'FIXTURE_POSTMASTER_READY_DEADLINE' }
  Assert-FixtureOwnedIdentity $provisional $context.Handle (Get-CimInstance Win32_Process -Filter "ProcessId=$($provisional.pid)") (Read-FixturePidFile $provisional)
  $sql = "select json_build_object('version',current_setting('server_version_num')::int,'dataDirectory',current_setting('data_directory'),'listen',current_setting('listen_addresses'),'port',inet_server_port(),'systemIdentifier',(pg_control_system()).system_identifier::text)"
  $identity = (Invoke-FixtureNative 'psql.exe' @('-X','-h','127.0.0.1','-p','55473','-U','t03_owner','-d','postgres','-Atc',$sql) 6000 $intent) | ConvertFrom-Json
  if ($identity.version -lt 170000 -or $identity.version -ge 180000 -or [IO.Path]::GetFullPath($identity.dataDirectory) -ne $data -or $identity.listen -ne '127.0.0.1' -or $identity.port -ne 55473 -or -not $identity.systemIdentifier) { throw 'FIXTURE_SERVER_IDENTITY_MISMATCH' }
  $verified = [ordered]@{status='verified';pid=$provisional.pid;handleStart=$provisional.handleStart;start=$provisional.start;binary=$provisional.binary;commandLine=$provisional.commandLine;dataDirectory=$data;port=55473;listen='127.0.0.1';systemIdentifier=$identity.systemIdentifier;pgVersion='17';runDirectory=$run;bundleSha256=$bundleHash}
  $context.Record = $verified
  Write-FixtureExclusive $receiptPath $verified
  $null = Invoke-FixtureNative 'psql.exe' @('-X','-h','127.0.0.1','-p','55473','-U','t03_owner','-d','postgres','-v','ON_ERROR_STOP=1','-c','create database t03_synthetic') 6000 $intent
  $success = $true
  Write-Output 'Verified synthetic PostgreSQL17 fixture started; use pinned stop script in test-owner finally.'
} finally {
  try {
    if (-not $success) { Stop-FixtureCurrentStart $context $intent }
  } finally {
    if ($context.Handle) { $context.Handle.Dispose() }
  }
}