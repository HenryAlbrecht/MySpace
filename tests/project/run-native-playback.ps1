$ErrorActionPreference = 'Stop'
$names = @('MYSPACE_PLAYBACK_FIXTURE', 'MYSPACE_PLAYBACK_PROFILE', 'TAURI_CONFIG', 'WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', 'MYSPACE_SMOKE_PORT')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$testId = [guid]::NewGuid().ToString()
$fixture = Join-Path ([IO.Path]::GetTempPath()) "myspace-playback-$testId"
$profileName = "local.myspace.desktop.playback-test-$testId"
$profile = Join-Path $env:LOCALAPPDATA $profileName
$tracked = @{}
$harness = $null
$port = 19347
$result = 1
$compiled = $false
$cleanupFailed = $false
$ownsFixture = $false
$ownsProfile = $false
$cargo = Join-Path $env:USERPROFILE '.cargo/bin/cargo.exe'
try {
    $ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
    if (Test-Path -LiteralPath $fixture) { throw 'Fixture already exists' }
    if (Test-Path -LiteralPath $profile) { throw 'Test profile already exists' }
    $ownsFixture = $true
    New-Item -ItemType Directory -Path (Join-Path $fixture 'music') | Out-Null
    & $ffmpeg -hide_banner -loglevel error -f lavfi -i 'sine=frequency=440:duration=45' -c:a libmp3lame -b:a 320k -metadata 'title=Fixture MP3' -metadata 'artist=MySpace fixture' (Join-Path $fixture 'music/01.mp3')
    if ($LASTEXITCODE) { throw 'MP3 fixture generation failed' }
    & $ffmpeg -hide_banner -loglevel error -f lavfi -i 'anoisesrc=duration=45:sample_rate=44100:seed=42' -ac 2 -c:a flac -metadata 'title=Fixture FLAC' -metadata 'artist=MySpace fixture' (Join-Path $fixture 'music/02.flac')
    if ($LASTEXITCODE) { throw 'FLAC fixture generation failed' }
    $hashes = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'music') -File | Get-FileHash | Select-Object Path, Hash)
    $env:MYSPACE_PLAYBACK_FIXTURE = $fixture
    $env:MYSPACE_PLAYBACK_PROFILE = $profileName
    $env:TAURI_CONFIG = @{ identifier = $profileName } | ConvertTo-Json -Compress
    $ownsProfile = $true
    & $cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --features custom-protocol seed_webview_playback_fixture -- --ignored
    if ($LASTEXITCODE) { throw 'Native fixture authorization failed' }
    $compiled = $true
    & $cargo build --locked --offline --manifest-path src-tauri/Cargo.toml --features custom-protocol
    if ($LASTEXITCODE) { throw 'Test profile build failed' }
    Copy-Item -LiteralPath 'src-tauri/target/debug/myspace-desktop.exe' -Destination (Join-Path $fixture 'test-app.exe')
    while (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        Write-Output "Preserving preexisting listener on port $port"
        $port++
    }
    $env:MYSPACE_SMOKE_PORT = [string]$port
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$port --remote-debugging-address=127.0.0.1 --autoplay-policy=no-user-gesture-required"
    $app = Start-Process -FilePath (Join-Path $fixture 'test-app.exe') -WindowStyle Hidden -PassThru
    $root = Get-CimInstance Win32_Process -Filter "ProcessId=$($app.Id)"
    $tracked[$root.ProcessId] = $root
    $outLog = Join-Path $fixture 'native.log'
    $errorLog = Join-Path $fixture 'native.stderr.log'
    $harness = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'tests/project/native-playback.cjs' -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errorLog
    # Cache the process handle before exit; Windows PowerShell otherwise loses ExitCode.
    $null = $harness.Handle
    $deadline = (Get-Date).AddSeconds(150)
    do {
        $processes = @(Get-CimInstance Win32_Process)
        do {
            $added = $false
            foreach ($process in $processes) {
                $parent = $processes | Where-Object { $_.ProcessId -eq $process.ParentProcessId } | Select-Object -First 1
                $ownedParent = $parent -and $tracked.ContainsKey($parent.ProcessId) -and $parent.CreationDate -eq $tracked[$parent.ProcessId].CreationDate
                if ($ownedParent -and $process.CreationDate -ge $parent.CreationDate -and -not $tracked.ContainsKey($process.ProcessId)) {
                    $tracked[$process.ProcessId] = $process
                    $added = $true
                }
            }
        } while ($added)
        Start-Sleep -Milliseconds 300
        $harness.Refresh()
    } while (-not $harness.HasExited -and (Get-Date) -lt $deadline)
    if (-not $harness.HasExited) { throw 'Native playback timed out' }
    $harness.WaitForExit()
    Get-Content -LiteralPath $outLog
    Get-Content -LiteralPath $errorLog
    $result = if ($null -eq $harness.ExitCode) { 1 } else { $harness.ExitCode }
    Write-Output "Native harness exit=$result"
    foreach ($hash in $hashes) {
        if ((Get-FileHash -LiteralPath $hash.Path).Hash -ne $hash.Hash) { throw 'Fixture content changed' }
    }
    Write-Output 'Original fixture content unchanged'
} catch {
    Write-Output $_
    $result = 1
} finally {
    foreach ($record in @($tracked.Values | Sort-Object CreationDate -Descending)) {
        $live = Get-CimInstance Win32_Process -Filter "ProcessId=$($record.ProcessId)"
        if ($live -and $live.CreationDate -eq $record.CreationDate) { Stop-Process -Id $record.ProcessId -ErrorAction SilentlyContinue }
    }
    if ($harness -and -not $harness.HasExited) { $harness.Kill() }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
    Start-Sleep -Milliseconds 700
    foreach ($record in $tracked.Values) {
        $live = Get-CimInstance Win32_Process -Filter "ProcessId=$($record.ProcessId)"
        if ($live -and $live.CreationDate -eq $record.CreationDate) {
            Write-Output "Remaining test process: PID=$($live.ProcessId) name=$($live.Name)"
            $cleanupFailed = $true
        }
    }
    if ($tracked.Count) {
        $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
        Write-Output "Test port=$port remaining listeners=$($listeners.Count)"
        if ($listeners.Count) { $cleanupFailed = $true }
    }
    $restored = $true
    foreach ($name in $names) {
        if ([Environment]::GetEnvironmentVariable($name, 'Process') -ne $previous[$name]) { $restored = $false }
    }
    Write-Output "Environment restored=$restored; tracked processes=$($tracked.Count)"
    if (-not $restored) { $cleanupFailed = $true }
    # Verify absolute targets before recursive cleanup. Both names are unique to this run.
    $safeFixture = [IO.Path]::GetFullPath($fixture)
    $safeProfile = [IO.Path]::GetFullPath($profile)
    if ($safeFixture -ne (Join-Path ([IO.Path]::GetFullPath([IO.Path]::GetTempPath())) "myspace-playback-$testId")) { throw 'Unsafe fixture cleanup target' }
    if ($safeProfile -ne (Join-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) "local.myspace.desktop.playback-test-$testId")) { throw 'Unsafe profile cleanup target' }
    if (-not $cleanupFailed) {
        if ($ownsFixture -and (Test-Path -LiteralPath $safeFixture)) { Remove-Item -LiteralPath $safeFixture -Recurse -Force }
        if ($ownsProfile -and (Test-Path -LiteralPath $safeProfile)) { Remove-Item -LiteralPath $safeProfile -Recurse -Force }
    }
    # Restore the ordinary embedded application after the isolated-profile build.
    if ($compiled) {
        & $cargo build --locked --offline --manifest-path src-tauri/Cargo.toml --features custom-protocol
        if ($LASTEXITCODE) { $cleanupFailed = $true }
    }
}
if ($cleanupFailed) { exit 1 }
exit $result
