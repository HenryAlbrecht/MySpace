param([ValidateSet('default', 'quick', 'smoke', 'syntax', 'visual', 'party', 'legacy')] [string]$Group = 'default')
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    $quick = @(
        'artwork', 'collection', 'catalog', 'audio-tags', 'youtube-music-catalog', 'youtube-music', 'music-playback-resolver', 'music-legacy-apple', 'apple-discography',
        'artist-search-photos', 'health-pass-2', 'lastfm-recommendation-seed',
        'music-auto-source', 'music-catalog-consistency', 'music-editorial',
        'music-recommendation-recovery', 'music-recommendation-resolution',
        'music-search-quality', 'music-search-reserve', 'music-unified-search',
        'music-collection-polish', 'music-v16', 'playback-suggestions',
        'organization', 'spaceamp', 'spaceamp-integrations', 'spaceamp-now-playing', 'spacevoice',
        'party-room-ui', 'party-presence', 'party-network', 'party-metered',
        'voice-chat', 'voice-media-settings', 'voice-screen-audio', 'xmb', 'voice-ui'
    )
    $smokes = @('page', 'flac', 'media-package', 'media-metadata', 'artist-artwork',
        'personalized-discovery', 'navigation', 'title-preferences', 'music-flow-http')
    if ($Group -in @('default', 'quick')) {
        foreach ($name in $quick) {
            # One process per file prevents VM/global fixture pollution.
            & node --test --experimental-test-isolation=none "tests/$name.test.cjs"
            if ($LASTEXITCODE -ne 0) { throw "Failed: $name" }
        }
    }
    if ($Group -in @('default', 'smoke')) {
        foreach ($name in $smokes) {
            & node "tests/$name-smoke.cjs"
            if ($LASTEXITCODE -ne 0) { throw "Failed smoke: $name" }
        }
    }
    if ($Group -in @('default', 'syntax')) {
        $files = @(Get-ChildItem dist, server, tests -Recurse -File | Where-Object {
            $_.Extension -in @('.js', '.cjs') -and $_.FullName -notmatch '[\\/]node_modules[\\/]'
        }) + @(Get-Item server.cjs, launcher.cjs)
        foreach ($file in $files) {
            & node --check $file.FullName
            if ($LASTEXITCODE -ne 0) { throw "Syntax: $($file.FullName)" }
        }
        & node tests/premerge-audit.cjs
        if ($LASTEXITCODE -ne 0) { throw 'Static audit failed' }
    }
    if ($Group -eq 'visual') {
        & node tests/premerge-visual.cjs
        if ($LASTEXITCODE -ne 0) { throw 'Visual failed' }
    }
    if ($Group -eq 'party') {
        foreach ($name in @('party-room', 'voice-chat-server', 'voice-chat-transport', 'party-ice-server')) {
            & node --test --experimental-test-isolation=none "tests/$name.test.cjs"
            if ($LASTEXITCODE -ne 0) { throw "PARTY: $name" }
        }
    }
    if ($Group -eq 'legacy') {
        & node --test --experimental-test-isolation=none tests/deezer-unified-search.test.cjs
        if ($LASTEXITCODE -ne 0) { throw 'Deezer adapter' }
        & node tests/deezer-smoke.cjs
        if ($LASTEXITCODE -ne 0) { throw 'Deezer adapter smoke' }
    }
} finally { Pop-Location }
