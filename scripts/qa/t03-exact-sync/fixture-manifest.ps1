$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'fixture-common.ps1')
$archive = Assert-FixturePath (Join-Path $script:FixtureRoot 'postgresql-17.11-windows-x64-binaries.zip')
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne '80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F') { throw 'ARCHIVE_HASH_MISMATCH' }
$manifestPath = Assert-FixturePath (Join-Path $script:FixtureRoot 'runtime-manifest.json')
if (Test-Path -LiteralPath $manifestPath) { throw 'RUNTIME_MANIFEST_ALREADY_EXISTS' }
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
$files = [Collections.Generic.List[object]]::new()
$seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$actual = Get-FixtureRuntimeFiles
try {
  foreach ($entry in $zip.Entries) {
    if ($entry.FullName.EndsWith('/')) { continue }
    if (-not $seen.Add($entry.FullName)) { throw 'ZIP_DUPLICATE_PATH' }
    if (-not $actual.ContainsKey($entry.FullName)) { throw 'ZIP_EXTRACTED_PATH_MISMATCH' }
    $file = $actual[$entry.FullName]
    $stream = $entry.Open()
    try { $digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)) } finally { $stream.Dispose() }
    if ($file.Length -ne $entry.Length -or (Get-FixtureFileHash $file.FullName) -ne $digest) { throw 'ZIP_EXTRACTED_CONTENT_MISMATCH' }
    $files.Add([ordered]@{path=$entry.FullName;bytes=$entry.Length;sha256=$digest})
  }
} finally { $zip.Dispose() }
if ($actual.Count -ne $files.Count) { throw 'ZIP_EXTRACTED_FILE_SET_MISMATCH' }
Write-FixtureExclusive $manifestPath ([ordered]@{version=1;archiveSha256='80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F';correlation='Every non-directory ZIP entry compared by byte length and SHA256 with exactly one extracted file; no extras';files=@($files | Sort-Object path)})
Write-Output ('ZIP-correlated runtime files: ' + $files.Count)
