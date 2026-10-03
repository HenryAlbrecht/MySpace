/* Only title presentation preferences are exported; credentials are never included. */
(() => {
  const prefixes = ['myspace.titleCover:', 'myspace.titleBanner:', 'myspace.titleBannerSettings:', 'myspace.trackVideo:'];
  const appValues={'spaceamp-party-music-v1':['true','false'],'spaceamp-global-controls-v1':['true','false'],'spaceamp-youtube-cover-v1':['true','false'],'myspace-collection-view':['list','covers']};
  const allowed = key => typeof key === 'string' && key.length <= 600 && (Object.hasOwn(appValues,key)||prefixes.some(prefix => key.startsWith(prefix) && key.length > prefix.length));
  function validate(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 2000) throw Error('Personalizações de títulos inválidas.');
    const result = Object.create(null);
    for (const [key, entry] of Object.entries(value)) {
      if (!allowed(key) || typeof entry !== 'string' || entry.length > 4 * 1024 * 1024) throw Error('Personalização de título inválida.');
      if(Object.hasOwn(appValues,key)){if(!appValues[key].includes(entry))throw Error('Preferência de interface inválida.');result[key]=entry;continue;}
      if (key.startsWith('myspace.titleBannerSettings:')) {
        const settings = JSON.parse(entry);
        if (!settings || typeof settings !== 'object' || Array.isArray(settings) || !['height','zoom','x','y'].every(field => typeof settings[field] === 'number' && Number.isFinite(settings[field])) || settings.height < 160 || settings.height > 600 || settings.zoom < 1 || settings.zoom > 3 || settings.x < 0 || settings.x > 100 || settings.y < 0 || settings.y > 100 || typeof settings.image !== 'string' || (settings.image && !safeUrl(settings.image, true))) throw Error('Ajustes de banner inválidos.');
        result[key] = JSON.stringify({ image: settings.image, height: settings.height, zoom: settings.zoom, x: settings.x, y: settings.y });
      } else {
        if (entry && !safeUrl(entry, !key.startsWith('myspace.trackVideo:'))) throw Error('Imagem ou vídeo inválido no backup.');
        result[key] = entry;
      }
    }
    return result;
  }
  function collect() {
    const result = Object.create(null);
    for (let index = 0; index < localStorage.length; index++) { const key = localStorage.key(index); if (allowed(key)) result[key] = localStorage.getItem(key); }
    return validate(result);
  }
  function replace(value) {
    const next = validate(value), old = collect();
    const apply = entries => { for (const key of Object.keys(collect())) localStorage.removeItem(key); for (const [key, entry] of Object.entries(entries)) localStorage.setItem(key, entry); };
    try { apply(next); } catch (error) { apply(old); throw error; }
    return () => apply(old);
  }
  window.TitlePreferences = { collect, validate, replace };
})();
