/* Only trusted provider URLs become embeds. */
const MediaEmbeds = (() => {
  function parse(value) {
    let url;
    try { url = new URL(value); } catch { return null; }
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'open.spotify.com') {
      const match = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show)\/([a-zA-Z0-9]{22})\/?$/);
      if (!match) return null;
      return { provider: 'spotify', src: 'https://open.spotify.com/embed/' + match[1] + '/' + match[2], url: 'https://open.spotify.com/' + match[1] + '/' + match[2] };
    }
    if (!['youtube.com', 'www.youtube.com', 'music.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) return null;
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(id || '')) return { provider: 'youtube', src: 'https://www.youtube.com/embed/' + id, url: 'https://www.youtube.com/watch?v=' + id };
    const list = url.searchParams.get('list');
    if (/^[a-zA-Z0-9_-]{10,100}$/.test(list || '')) return { provider: 'youtube', src: 'https://www.youtube.com/embed?listType=playlist&list=' + list, url: 'https://www.youtube.com/playlist?list=' + list };
    return null;
  }
  function frame(embed, title) {
    const iframe = document.createElement('iframe');
    const source = new URL(embed.src);
    if (embed.provider === 'spotify') source.searchParams.set('theme', '0');
    else { source.searchParams.set('rel', '0'); source.searchParams.set('playsinline', '1'); }
    iframe.src = source.href;
    iframe.title = title;
    iframe.loading = 'lazy';
    iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    iframe.setAttribute('allowfullscreen', '');
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    return iframe;
  }
  const requests = new Map();
  async function metadata(value) {
    const embed = parse(value);
    if (!embed) return null;
    if (!requests.has(embed.url)) requests.set(embed.url, (async () => {
      try {
        const response = await fetch('/api/media/metadata?url=' + encodeURIComponent(embed.url));
        if (!response.ok) throw Error('Metadata unavailable');
        const result = await response.json();
        return typeof result.title === 'string' ? result : null;
      } catch { requests.delete(embed.url); return null; }
    })());
    return requests.get(embed.url);
  }
  function surface(embed, title, info = {}) {
    const box = document.createElement('div');
    box.className = 'provider-surface provider-' + embed.provider;
    box.dataset.source = embed.src;
    if (embed.provider === 'spotify') { box.append(frame(embed, title)); return box; }
    const launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'video-launch';
    const id = new URL(embed.url).searchParams.get('v');
    const poster = info.thumbnail || (id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '');
    if (/^https:\/\//.test(poster)) { const image = document.createElement('img'); image.src = poster; image.alt = ''; launch.append(image); }
    const text = document.createElement('span');
    text.textContent = '▶ reproduzir no YouTube';
    launch.append(text);
    launch.setAttribute('aria-label', 'Reproduzir: ' + title);
    launch.onclick = () => {
      const player = frame(embed, title);
      player.src += '&autoplay=1';
      box.replaceChildren(player);
    };
    box.append(launch);
    return box;
  }
  function directVideo(value) {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && /\.(mp4|webm|ogg)$/i.test(url.pathname) ? url.href : ''; } catch { return ''; }
  }
  return { parse, frame, surface, metadata, directVideo };
})();
if (typeof module !== 'undefined') module.exports = MediaEmbeds;
