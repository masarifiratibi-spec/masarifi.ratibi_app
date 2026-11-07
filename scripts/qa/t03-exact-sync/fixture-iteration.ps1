param([switch]$RunApprovedIteration,[string]$ReviewedBundleSha256,[string]$ReviewedSourcesManifestSha256,[string]$ExpectedOriginalReceiptSha256,[switch]$ProductOnly,[switch]$RestoredSuccessorOnly)
$ErrorActionPreference = 'Stop'
if ($RestoredSuccessorOnly -and -not $ProductOnly) { throw 'RESTORED_SUCCESSOR_REQUIRES_PRODUCT_ONLY' }
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
if ($RunApprovedIteration -and (-not $ReviewedBundleSha256 -or $ReviewedBundleSha256 -ne $bundleHash)) { throw 'REVIEWED_FIXTURE_BUNDLE_REQUIRED' }
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
$data=Assert-FixturePath (Join-Path $root 'data')
$originalPath=Assert-FixturePath (Join-Path $root 'owned-process.json')
$originalHash=(Get-FileHash -LiteralPath $originalPath -Algorithm SHA256).Hash
if ($originalHash -ne $ExpectedOriginalReceiptSha256) { throw 'ITERATION_ORIGINAL_RECEIPT_PIN_REQUIRED' }
$original=Read-FixtureOwnershipRecord $originalPath
if ($original.status -ne 'verified' -or $original.dataDirectory -ne $data -or $original.binary -ne (Join-Path $script:RuntimeBin 'postgres.exe') -or $original.port -ne 55473 -or $original.listen -ne '127.0.0.1' -or -not $original.systemIdentifier) { throw 'ITERATION_ORIGINAL_CLUSTER_MISMATCH' }
$versionPath=Assert-FixturePath (Join-Path $data 'PG_VERSION')
if ((Get-Content -LiteralPath $versionPath -Raw).Trim() -ne '17') { throw 'ITERATION_REQUIRES_ORIGINAL_PG17_DATA' }
if (Test-Path -LiteralPath (Assert-FixturePath (Join-Path $data 'postmaster.pid'))) { throw 'ITERATION_PIDFILE_ALREADY_EXISTS' }
if (Get-NetTCPConnection -LocalPort 55473 -ErrorAction SilentlyContinue) { throw 'ITERATION_PORT_OCCUPIED' }
$manifestPath=Assert-FixturePath (Join-Path $workspace 'docs/evidence/2026-10-25-astra-remediation-review/execution/T03/runner-prep/source-manifest.json') $workspace
if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -ne $ReviewedSourcesManifestSha256) { throw 'ITERATION_REVIEWED_SOURCE_MANIFEST_REQUIRED' }
$sources=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
$fixtureNode='C:/Program Files/nodejs/node.exe'
if (-not $sources.fixtureNode -or $sources.fixtureNode.path -ne $fixtureNode -or (Get-FileHash -LiteralPath $fixtureNode -Algorithm SHA256).Hash -ne $sources.fixtureNode.sha256) { throw 'ITERATION_NODE_RUNTIME_PIN_MISMATCH' }
foreach ($requiredSource in @('scripts/qa/t03-exact-sync/pg17.test.cjs','scripts/qa/t03-session-consumer/fixture-role-setup.sql','scripts/qa/t03-session-consumer/product-ledger.pg17.test.cjs','scripts/qa/t03-session-consumer/product-fixture.cjs','scripts/qa/t03-session-consumer/product-schema.cjs')) {
  if ($requiredSource -notin $sources.files.path) { throw 'ITERATION_KNOWN_SUITE_PINS_REQUIRED' }
}
foreach ($file in $sources.files) {
  $path=Assert-FixturePath (Join-Path $workspace $file.path) $workspace
  if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $file.sha256) { throw 'ITERATION_SOURCE_PIN_MISMATCH' }
}
if (-not $RunApprovedIteration) { Write-Output 'Static existing-cluster preflight passed; no native execution, initialization, reset or data move.'; return }
$run=Assert-FixturePath (Join-Path $root ('runs/iteration-'+[guid]::NewGuid().ToString('n')))
$null=New-Item -ItemType Directory -Path $run
$intent=[ordered]@{status='intent';createdAt=(Get-Date).ToUniversalTime().ToString('o');dataDirectory=$data;binary=$original.binary;port=55473;listen='127.0.0.1';runDirectory=$run;bundleSha256=$bundleHash;originalReceiptSha256=$originalHash;expectedSystemIdentifier=$original.systemIdentifier}
Write-FixtureExclusive (Join-Path $run 'intent.json') $intent
$context=@{Handle=$null;HandleStart=$null;Record=$null}
$startExit=$null;$testExit=$null;$claimExit=$null;$productExit=$null;$roleExit=$null;$stopExit=$null;$failure=$null;$verified=$false
$priorReceipt=$env:T03_FIXTURE_RECEIPT_PATH
try {
  $provisional=Start-FixturePostmaster $intent $context
  $deadline=[Diagnostics.Stopwatch]::StartNew();$ready=$false
  while ($deadline.ElapsedMilliseconds -lt 15000 -and -not $context.Handle.HasExited) {
    $pidPath=Assert-FixturePath (Join-Path $data 'postmaster.pid')
    if (Test-Path -LiteralPath $pidPath) {
      $lines=[IO.File]::ReadAllLines($pidPath)
      if ($lines.Count -ge 8 -and $lines[7].Trim() -eq 'ready') { $ready=$true;break }
    }
    Start-Sleep -Milliseconds 100
  }
  if (-not $ready) { throw 'ITERATION_POSTMASTER_READY_DEADLINE' }
  Assert-FixtureOwnedIdentity $provisional $context.Handle (Get-CimInstance Win32_Process -Filter "ProcessId=$($provisional.pid)") (Read-FixturePidFile $provisional)
  $sql="select json_build_object('version',current_setting('server_version_num')::int,'dataDirectory',current_setting('data_directory'),'listen',current_setting('listen_addresses'),'port',inet_server_port(),'systemIdentifier',(pg_control_system()).system_identifier::text)"
  $identity=(Invoke-FixtureNative 'psql.exe' @('-X','-h','127.0.0.1','-p','55473','-U','t03_owner','-d','postgres','-Atc',$sql) 6000 $intent)|ConvertFrom-Json
  if ($identity.version -lt 170000 -or $identity.version -ge 180000 -or [IO.Path]::GetFullPath($identity.dataDirectory) -ne $data -or $identity.port -ne 55473 -or $identity.listen -ne '127.0.0.1' -or $identity.systemIdentifier -ne $original.systemIdentifier) { throw 'ITERATION_LIVE_ORIGINAL_CLUSTER_MISMATCH' }
  $record=[ordered]@{status='verified';pid=$provisional.pid;handleStart=$provisional.handleStart;start=$provisional.start;binary=$provisional.binary;commandLine=$provisional.commandLine;dataDirectory=$data;port=55473;listen='127.0.0.1';systemIdentifier=$identity.systemIdentifier;pgVersion='17';runDirectory=$run;bundleSha256=$bundleHash}
  $context.Record=$record
  $receiptPath=Join-Path $run 'owned-process.json'
  Write-FixtureExclusive $receiptPath $record
  $verified=$true;$startExit=0
  Write-FixtureExclusive (Join-Path $run 'start-exit.json') ([ordered]@{exit=0;identity=$identity})
  $env:T03_FIXTURE_RECEIPT_PATH=$receiptPath
  $roleSql=Assert-FixturePath (Join-Path $workspace 'scripts/qa/t03-session-consumer/fixture-role-setup.sql') $workspace
  $roleOutput=Invoke-FixtureNative 'psql.exe' @('-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55473','-U','t03_owner','-d','postgres','-Atf',$roleSql) 8000 $intent
  $roleExit=0
  Write-FixtureExclusive (Join-Path $run 'role-setup.json') ([ordered]@{exit=$roleExit;output=$roleOutput})
  if (-not $ProductOnly) {
    & $fixtureNode --test --test-isolation=none --test-timeout=90000 (Join-Path $workspace 'scripts/qa/t03-exact-sync/pg17.test.cjs') *> (Join-Path $run 'pg17-tests.log')
    $claimExit=$LASTEXITCODE
  }
  Write-FixtureExclusive (Join-Path $run 'claim-suite-exit.json') ([ordered]@{exit=$claimExit;status=if ($ProductOnly) { 'NOT_RUN_PRODUCT_ONLY' } else { 'RUN' }})
  if ($ProductOnly -or $claimExit -eq 0) {
    if ($RestoredSuccessorOnly) {
      & $fixtureNode --test --test-isolation=none --test-timeout=120000 --test-name-pattern='^restored successor ' (Join-Path $workspace 'scripts/qa/t03-session-consumer/product-ledger.pg17.test.cjs') *> (Join-Path $run 'product-ledger-tests.log')
    } else {
      & $fixtureNode --test --test-isolation=none --test-timeout=120000 (Join-Path $workspace 'scripts/qa/t03-session-consumer/product-ledger.pg17.test.cjs') *> (Join-Path $run 'product-ledger-tests.log')
    }
    $productExit=$LASTEXITCODE
  }
  $testExit=if (($ProductOnly -or $claimExit -eq 0) -and $productExit -eq 0) { 0 } else { 1 }
  Write-FixtureExclusive (Join-Path $run 'test-exit.json') ([ordered]@{exit=$testExit})
} catch {
  $failure=$_.Exception.Message
  if ($null -eq $startExit) { $startExit=1;Write-FixtureExclusive (Join-Path $run 'start-exit.json') ([ordered]@{exit=1;failure=$failure}) }
} finally {
  $env:T03_FIXTURE_RECEIPT_PATH=$priorReceipt
  try {
    if ($context.Handle) {
      if ($verified) { Stop-FixtureOwnedRecord $context.Record $context.Handle $intent }
      else { Stop-FixtureCurrentStart $context $intent }
    }
    $stopExit=0
  } catch { $stopExit=1;$failure=$_.Exception.Message }
  finally { if ($context.Handle) { $context.Handle.Dispose() } }
  Write-FixtureExclusive (Join-Path $run 'stop-exit.json') ([ordered]@{exit=$stopExit;failure=$failure})
  Write-FixtureExclusive (Join-Path $run 'product-suite-exit.json') ([ordered]@{exit=$productExit;status=if ($null -eq $productExit) { 'NOT_RUN' } else { 'RUN' }})
  Write-FixtureExclusive (Join-Path $run 'lifecycle.json') ([ordered]@{startExit=$startExit;roleExit=$roleExit;claimExit=$claimExit;claimStatus=if ($ProductOnly) { 'NOT_RUN_PRODUCT_ONLY' } else { 'RUN' };productOnly=[bool]$ProductOnly;restoredSuccessorOnly=[bool]$RestoredSuccessorOnly;productExit=$productExit;testExit=$testExit;stopExit=$stopExit;failure=$failure;originalReceiptSha256=$originalHash;systemIdentifier=$original.systemIdentifier;runDirectory=$run})
}
Get-Content -LiteralPath (Join-Path $run 'lifecycle.json') -Raw
if ($startExit -ne 0 -or $testExit -ne 0 -or $stopExit -ne 0) { exit 1 }
