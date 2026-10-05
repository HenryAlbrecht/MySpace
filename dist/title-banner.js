/* Per-title banner preferences stay in this browser. */
(() => {
  const identity = item => item.catalogId || 'local:' + item.id;
  const key = item => 'myspace.titleBannerSettings:' + identity(item);
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  function get(item) {
    let data = {}, legacy = ''; try { data = JSON.parse(localStorage.getItem(key(item)) || '{}') || {}; legacy = localStorage.getItem('myspace.titleBanner:' + identity(item)) || ''; } catch {}
    return { image: safeUrl(Object.hasOwn(data, 'image') ? data.image : legacy, true), height: clamp(data.height, 160, 600, 300), zoom: clamp(data.zoom, 1, 3, 1), x: clamp(data.x, 0, 100, 50), y: clamp(data.y, 0, 100, 50) };
  }
  function apply(hero, image, settings) {
    hero.style.height = settings.height + 'px';
    image.style.objectPosition = settings.x + '% ' + settings.y + '%';
    image.style.transform = 'scale(' + settings.zoom + ')';
    image.style.transformOrigin = settings.x + '% ' + settings.y + '%';
  }
  function reset(item) { localStorage.removeItem(key(item)); localStorage.removeItem('myspace.titleBanner:' + identity(item)); }
  function setImage(item, image) { localStorage.setItem(key(item), JSON.stringify({ ...get(item), image })); }
  function edit(item, onSave) {
    const settings = get(item); const dialog = document.createElement('dialog'); dialog.className = 'title-banner-editor';
    const make = (tag, text = '') => { const element = document.createElement(tag); element.textContent = text; return element; };
    const heading = make('h2', 'editar banner');
    const preview = make('div'); preview.className = 'title-banner banner-editor-preview'; const image = make('img'); image.alt = 'Prévia do banner'; preview.append(image);
    const notice = make('p'); notice.className = 'title-notice';
    const urlLabel = make('label', 'Link da imagem'); const url = make('input'); url.type = 'url'; url.placeholder = 'https://…'; url.value = /^https?:/.test(settings.image) ? settings.image : ''; urlLabel.append(url);
    const fileLabel = make('label', 'Ou uma imagem do computador'); const file = make('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp,image/gif'; fileLabel.append(file);
    function refresh() { const src = settings.image || safeUrl(item.bannerImage); preview.hidden = !src; if (src) image.src = Artwork.url(src); apply(preview, image, settings); }
    url.oninput = () => { if (!url.value.trim()) settings.image = ''; else if (safeUrl(url.value)) settings.image = safeUrl(url.value); refresh(); };
    file.onchange = async () => {
      const selected = file.files[0]; if (!selected) return;
      if (selected.size > 8 * 1024 * 1024 || !/^image\/(png|jpeg|webp|gif)$/.test(selected.type)) { notice.textContent = 'Escolha PNG, JPEG, WebP ou GIF de até 8 MB.'; return; }
      save.disabled = true;
      try { settings.image = await resizeImage(selected, 1600); url.value = ''; notice.textContent = ''; refresh(); } catch { notice.textContent = 'Não consegui abrir essa imagem.'; } finally { save.disabled = false; }
    };
    const controls = make('div'); controls.className = 'banner-editor-controls';
    for (const [name, label, min, max, step, unit] of [['height','Altura',160,600,10,' px'],['zoom','Zoom',1,3,.05,'×'],['x','Posição horizontal',0,100,1,'%'],['y','Posição vertical',0,100,1,'%']]) {
      const field = make('label', label); const value = make('output'); const input = make('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = settings[name];
      const update = () => { settings[name] = Number(input.value); value.textContent = settings[name] + unit; refresh(); };
      input.oninput = update; value.textContent = settings[name] + unit; field.append(value, input); controls.append(field);
    }
    const actions = make('div'); actions.className = 'title-actions';
    const close = () => { dialog.close(); dialog.remove(); };
    const cancel = make('button', 'cancelar'); cancel.type = 'button'; cancel.onclick = close;
    const restore = make('button', 'restaurar original'); restore.type = 'button'; restore.onclick = () => { try { reset(item); close(); onSave(); } catch { notice.textContent = 'Não consegui salvar neste navegador.'; } };
    const save = make('button', 'salvar banner'); save.type = 'button'; save.className = 'primary';
    save.onclick = () => { if (url.value.trim() && !safeUrl(url.value)) { notice.textContent = 'Use um link HTTP ou HTTPS válido.'; return; } try { localStorage.setItem(key(item), JSON.stringify(settings)); close(); onSave(); } catch { notice.textContent = 'Sem espaço para salvar a imagem. Tente uma menor.'; } };
    dialog.oncancel = event => { event.preventDefault(); close(); };
    actions.append(restore, cancel, save); dialog.append(heading, preview, urlLabel, fileLabel, controls, notice, actions); document.body.append(dialog); refresh(); dialog.showModal();
  }
  window.TitleBanner = { get, apply, reset, setImage, edit };
})();
