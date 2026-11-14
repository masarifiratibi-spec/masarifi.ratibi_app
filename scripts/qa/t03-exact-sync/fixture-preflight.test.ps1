$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'fixture-common.ps1')
$intent = [pscustomobject]@{createdAt='2026-10-25T14:00:00Z';runDirectory=(Join-Path $script:FixtureRoot 'runs/nonexecuting-test')}
$cim = [pscustomobject]@{ProcessId=87654;ExecutablePath=(Join-Path $script:RuntimeBin 'postgres.exe');CreationDate=[datetime]'2026-10-25T14:01:00Z';CommandLine=('postgres.exe -D "' + (Join-Path $script:FixtureRoot 'data') + '" -h 127.0.0.1 -p 55473')}
$record = [pscustomobject]@{status='provisional';pid=87654;handleStart=([datetime]'2026-10-25T14:01:00.0001Z').ToUniversalTime().ToString('o');start=$cim.CreationDate.ToUniversalTime().ToString('o');binary=$cim.ExecutablePath;commandLine=$cim.CommandLine;dataDirectory=(Join-Path $script:FixtureRoot 'data');port=55473;listen='127.0.0.1';runDirectory=$intent.runDirectory}
function New-TestHandle {
  $handle = [pscustomobject]@{Id=87654;Path=$cim.ExecutablePath;StartTime=[datetime]'2026-10-25T14:01:00.0001Z';SafeHandle=[pscustomobject]@{IsInvalid=$false};HasExited=$false;KillObserved=$false}
  $handle | Add-Member ScriptMethod Kill { $this.KillObserved=$true;$this.HasExited=$true }
  $handle | Add-Member ScriptMethod WaitForExit { param($Timeout) return $this.HasExited }
  return $handle
}
$pidFile = [pscustomobject]@{pid=87654;dataDirectory=$record.dataDirectory}
Assert-FixtureOwnedIdentity $record (New-TestHandle) $cim $pidFile
$roundTripPath=Join-Path $script:FixtureRoot ('ownership-roundtrip-'+[guid]::NewGuid().ToString('n')+'.json')
try {
  Write-FixtureExclusive $roundTripPath $record
  $readBack=Read-FixtureOwnershipRecord $roundTripPath
  if ($readBack.handleStart -isnot [string] -or $readBack.start -isnot [string]) { throw 'TEST_OWNERSHIP_JSON_MUST_PRESERVE_STRINGS' }
  Assert-FixtureOwnedIdentity $readBack (New-TestHandle) $cim $pidFile
} finally {
  $null=Assert-FixturePath $roundTripPath
  if (Test-Path -LiteralPath $roundTripPath) { [IO.File]::Delete($roundTripPath) }
}
foreach ($variant in @('handle-reuse','replacement-cim','pidfile','other-data')) {
  $handle = New-TestHandle
  $candidateCim = [pscustomobject]@{ProcessId=$cim.ProcessId;ExecutablePath=$cim.ExecutablePath;CreationDate=$cim.CreationDate;CommandLine=$cim.CommandLine}
  $candidateFile = [pscustomobject]@{pid=$pidFile.pid;dataDirectory=$pidFile.dataDirectory}
  if ($variant -eq 'handle-reuse') { $handle.StartTime=$handle.StartTime.AddSeconds(1) }
  if ($variant -eq 'replacement-cim') { $candidateCim.CreationDate=$candidateCim.CreationDate.AddSeconds(1) }
  if ($variant -eq 'pidfile') { $candidateFile.pid=99999 }
  if ($variant -eq 'other-data') { $candidateFile.dataDirectory+='-other' }
  $rejected = $false
  try { Assert-FixtureOwnedIdentity $record $handle $candidateCim $candidateFile } catch { $rejected=$_.Exception.Message -match '^FIXTURE_(HANDLE|CIM|PIDFILE)_IDENTITY_MISMATCH$' }
  if (-not $rejected -or $handle.KillObserved) { throw ('TEST_REPLACEMENT_NOT_REJECTED_'+$variant) }
}
$escaped=$false
try { $null=Assert-FixturePath (Join-Path $script:FixtureRoot '../not-owned') } catch { $escaped=$_.Exception.Message -eq 'FIXTURE_PATH_OUTSIDE_ROOT' }
if (-not $escaped) { throw 'TEST_PATH_ESCAPE' }
$noApproval=$false
try { & (Join-Path $PSScriptRoot 'fixture-start.ps1') -StartApprovedFixture -ReviewedBundleSha256 ('0' * 64) } catch { $noApproval=$_.Exception.Message -eq 'REVIEWED_FIXTURE_BUNDLE_REQUIRED' }
if (-not $noApproval) { throw 'TEST_UNREVIEWED_START' }
# Model a failure before the provisional receipt/CIM query using the exact handle returned by Start().
$currentHandle=New-TestHandle
Stop-FixtureCurrentStart @{Handle=$currentHandle;HandleStart=$record.handleStart;Record=$null} $intent
if (-not $currentHandle.KillObserved -or -not $currentHandle.HasExited) { throw 'TEST_CURRENT_HANDLE_RECEIPT_FAILURE_CLEANUP' }
# System boundaries are doubled below: no native process, SQL, PID lookup or filesystem write occurs.
$script:signalObserved=$false
$script:receiptWriteFailed=$false
$script:activeHandle=New-TestHandle
function Get-CimInstance { param($ClassName,$Filter) return $cim }
function Read-FixturePidFile { param($Record) return $pidFile }
function Invoke-FixtureNative {
  param($Name,$Arguments,$DeadlineMs,$Intent)
  if ($Name -ne 'pg_ctl.exe' -or $Arguments.Count -ne 3 -or $Arguments[0] -ne 'kill' -or $Arguments[1] -ne 'INT' -or $Arguments[2] -ne '87654') { throw 'TEST_SIGNAL_NOT_EXACT_PID' }
  & $Intent.beforeNativeStart
  $script:signalObserved=$true
  $script:activeHandle.HasExited=$true
  return ''
}
function Write-FixtureExclusive { param($Path,$Value) $script:receiptWriteFailed=$true;throw 'SIMULATED_RECEIPT_DISK_FAILURE' }
$failed=$false
try { Stop-FixtureCurrentStart @{Handle=$script:activeHandle;HandleStart=$record.handleStart;Record=$record} $intent } catch { $failed=$_.Exception.Message -eq 'SIMULATED_RECEIPT_DISK_FAILURE' }
if (-not $failed -or -not $script:signalObserved -or -not $script:receiptWriteFailed -or -not $script:activeHandle.HasExited -or $script:activeHandle.KillObserved) { throw 'TEST_RECORDED_HANDLE_RECEIPT_FAILURE_CLEANUP' }
Write-Output 'PASS: exact identity with separate CIM/handle precision; replacement creation, PID/handle reuse, foreign PID file/data, escape and unreviewed bundle rejected.'
Write-Output 'PASS: early current-start identity/receipt failure uses only the retained own-launch handle; recorded receipt-write failure still signals exactly recorded PID. No native execution or process tree termination.'

foreach ($mode in @('absent','incomplete')) {
  $script:pidFileFailureMode=$mode
  function Read-FixturePidFile {
    param($Record)
    if ($script:pidFileFailureMode -eq 'absent') { throw [IO.FileNotFoundException]::new('SYNTHETIC_MISSING_PIDFILE') }
    throw 'FIXTURE_PIDFILE_INCOMPLETE'
  }
  $script:activeHandle=New-TestHandle
  $script:signalObserved=$false
  $context=@{Handle=$script:activeHandle;HandleStart=$record.handleStart;Record=$record}
  $provisionalWriteFailed=$false
  try { Write-FixtureExclusive 'synthetic-provisional-path' $record } catch { $provisionalWriteFailed=$_.Exception.Message -eq 'SIMULATED_RECEIPT_DISK_FAILURE' }
  $cleanupError=$null
  try { Stop-FixtureCurrentStart $context $intent } catch { $cleanupError=$_.Exception.Message }
  if ($cleanupError -or -not $provisionalWriteFailed -or -not $context.Handle.HasExited -or -not $context.Handle.KillObserved -or $script:signalObserved) { throw ('TEST_RECORD_PRESENT_PROVISIONAL_FAILURE_UNRESOLVED_'+$mode) }
  # The outer startup finally may dispose only after the exact own-launch handle has exited.
  $strictHandle=New-TestHandle
  $strictRejected=$false
  try { Stop-FixtureOwnedRecord $record $strictHandle $intent } catch { $strictRejected=$true }
  if (-not $strictRejected -or $strictHandle.KillObserved) { throw 'TEST_NORMAL_STOP_MUST_REMAIN_STRICT' }
  $reusedHandle=New-TestHandle
  $reusedHandle.StartTime=$reusedHandle.StartTime.AddSeconds(1)
  $reuseRejected=$false
  try { Stop-FixtureCurrentStart @{Handle=$reusedHandle;HandleStart=$record.handleStart;Record=$record} $intent } catch { $reuseRejected=$_.Exception.Message -eq 'FIXTURE_CURRENT_HANDLE_UNVERIFIED' }
  if (-not $reuseRejected -or $reusedHandle.KillObserved) { throw 'TEST_CURRENT_FALLBACK_CANNOT_ADOPT_REUSED_HANDLE' }
}
Write-Output 'PASS: Record-present provisional receipt-write failure plus absent/incomplete PIDfile resolves same own-launch handle before disposal; normal stop remains strict.'
