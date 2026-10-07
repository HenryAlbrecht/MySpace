param([ValidateSet('default', 'quick', 'quick-music', 'quick-spaceamp', 'quick-party-ui', 'smoke', 'syntax', 'visual', 'party', 'legacy')] [string]$Group = 'default')
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    $quick = @(
        'media/artwork', 'collection/collection', 'catalog/catalog', 'audio-tags', 'music/youtube-music-catalog', 'music/youtube-music', 'music/music-playback-resolver', 'music/music-legacy-apple', 'music/apple-discography',
        'music/artist-search-photos', 'health-pass-2', 'music/lastfm-recommendation-seed',
        'music/music-auto-source', 'music/music-catalog-consistency', 'music/music-editorial',
        'music/music-recommendation-recovery', 'music/music-recommendation-resolution',
        'music/music-search-quality', 'music/music-search-reserve', 'music/music-unified-search',
        'music/music-collection-polish', 'music/music-v16', 'music/playback-suggestions',
        'project/organization', 'spaceamp', 'spaceamp-integrations', 'spaceamp-now-playing', 'spacevoice',
        'party-room-ui', 'party-presence', 'party-network', 'party-metered',
        'voice-chat', 'voice-media-settings', 'voice-screen-audio', 'xmb/xmb', 'voice-ui'
    )
    $domainQuick = @{
        'quick-music' = @(
            'catalog/catalog', 'audio-tags', 'music/youtube-music-catalog', 'music/youtube-music',
            'music/music-playback-resolver', 'music/music-legacy-apple', 'music/apple-discography',
            'music/artist-search-photos', 'music/lastfm-recommendation-seed', 'music/music-auto-source',
            'music/music-catalog-consistency', 'music/music-editorial', 'music/music-recommendation-recovery',
            'music/music-recommendation-resolution', 'music/music-search-quality', 'music/music-search-reserve',
            'music/music-unified-search', 'music/music-collection-polish', 'music/music-v16', 'music/playback-suggestions'
        )
        'quick-spaceamp' = @('media/artwork', 'spaceamp', 'spaceamp-integrations', 'spaceamp-now-playing', 'xmb/xmb')
        'quick-party-ui' = @(
            'spacevoice', 'party-room-ui', 'party-presence', 'party-network', 'party-metered',
            'voice-chat', 'voice-media-settings', 'voice-screen-audio', 'voice-ui'
        )
    }
    # Keep the global quick selection intact; domain groups are strict subsets.
    $selectedQuick = if ($domainQuick.ContainsKey($Group)) { $domainQuick[$Group] } else { $quick }
    $smokes = @('page', 'media/flac', 'media/media-package', 'media/media-metadata', 'music/artist-artwork',
        'catalog/personalized-discovery', 'navigation/navigation', 'catalog/title-preferences', 'music/music-flow-http')
    if ($Group -in @('default', 'quick') -or $domainQuick.ContainsKey($Group)) {
        foreach ($name in $selectedQuick) {
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
        & node --test --experimental-test-isolation=none tests/music/deezer-unified-search.test.cjs
        if ($LASTEXITCODE -ne 0) { throw 'Deezer adapter' }
        & node tests/music/deezer-smoke.cjs
        if ($LASTEXITCODE -ne 0) { throw 'Deezer adapter smoke' }
    }
} finally { Pop-Location }
