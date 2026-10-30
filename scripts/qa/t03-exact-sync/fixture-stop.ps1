param([Parameter(Mandatory=$true)][string]$ReviewedBundleSha256)
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath('D:/Masarifi-integration-2026-10-10')
$root = Join-Path $workspace '.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/runner-prep/pg17'
$bundlePath = Join-Path $root 'fixture-bundle.json'
foreach ($path in @($bundlePath,$PSCommandPath)) {
  $cursor = [IO.Path]::GetFullPath($path)
  if (-not $cursor.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'BUNDLE_OUTSIDE_WORKSPACE' }
  while ($cursor) {
    if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'BUNDLE_REPARSE_POINT' }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
}
if ((Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash -ne $ReviewedBundleSha256) { throw 'REVIEWED_FIXTURE_BUNDLE_REQUIRED' }
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
$intentPath = Assert-FixturePath (Join-Path $root 'startup-intent.json')
$intent = Get-Content -LiteralPath $intentPath -Raw | ConvertFrom-Json
if ($intent.bundleSha256 -ne $ReviewedBundleSha256 -or $intent.dataDirectory -ne (Join-Path $root 'data') -or $intent.binary -ne (Join-Path $script:RuntimeBin 'postgres.exe') -or $intent.port -ne 55473 -or $intent.listen -ne '127.0.0.1') { throw 'FIXTURE_STOP_INTENT_MISMATCH' }
$recordPath = Assert-FixturePath (Join-Path $root 'owned-process.json')
if (-not (Test-Path -LiteralPath $recordPath)) { $recordPath=Assert-FixturePath (Join-Path $intent.runDirectory 'provisional-process.json') }
$record = Read-FixtureOwnershipRecord $recordPath
if ($record.status -notin @('verified','provisional') -or $record.bundleSha256 -ne $ReviewedBundleSha256 -or $record.runDirectory -ne $intent.runDirectory) { throw 'FIXTURE_STOP_RECORD_MISMATCH' }
$handle = [Diagnostics.Process]::GetProcessById([int]$record.pid)
try {
  $null = $handle.SafeHandle
  Stop-FixtureOwnedRecord $record $handle $intent
} finally { $handle.Dispose() }
Write-Output 'Recorded fixture process stopped; no replacement adopted.'
