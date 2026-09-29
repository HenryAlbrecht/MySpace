/* Device lists and JSON-only preferences. Enumeration never requests capture. */
(function (root) {
  function createVoiceDevices({media, storage, sinkSupported = typeof root.HTMLMediaElement?.prototype.setSinkId === 'function', onChange = () => {}, onError = () => {}}) {
    if (storage === undefined) { try { storage = root.localStorage; } catch { } }
    const key = 'spacevoice-audio-preferences';
    let saved = {};
    try { saved = JSON.parse(storage?.getItem(key) || '{}') || {}; } catch { }
    const validId = id => typeof id === 'string' && id.length <= 512 ? id : '';
    const preferences = {preferredAudioInputId:validId(saved.preferredAudioInputId), preferredAudioOutputId:validId(saved.preferredAudioOutputId), remoteVolumes:Object.create(null)};
    for (const [id, value] of Object.entries(saved.remoteVolumes || {}).slice(-100)) {
      if (id.length <= 128 && typeof value === 'number' && Number.isFinite(value)) preferences.remoteVolumes[id] = Math.max(0,Math.min(1,value));
    }
    let inputs = [], outputs = [], detach = null, refreshId = 0, outputQueue = Promise.resolve(), permissionKnown = false;
    const save = () => { try { storage?.setItem(key, JSON.stringify(preferences)); } catch { /* In-memory settings still work. */ } };
    const notify = () => onChange({inputs, outputs, preferences, sinkSupported});
    async function refresh({permissionGranted = false} = {}) {
      permissionKnown ||= permissionGranted;
      const id = ++refreshId;
      try {
        const list = await media.enumerate();
        if (id !== refreshId) return;
        inputs = list.inputs; outputs = list.outputs;
        // Empty IDs may mean permission has not exposed the list yet.
        if ((permissionKnown || inputs.some(d => d.deviceId)) && preferences.preferredAudioInputId && !inputs.some(d => d.deviceId === preferences.preferredAudioInputId)) preferences.preferredAudioInputId = '';
        if ((permissionKnown || outputs.some(d => d.deviceId)) && preferences.preferredAudioOutputId && !outputs.some(d => d.deviceId === preferences.preferredAudioOutputId)) preferences.preferredAudioOutputId = '';
        if (!sinkSupported) preferences.preferredAudioOutputId = '';
        save(); notify();
      } catch { onError('Não foi possível listar dispositivos. O padrão do sistema continua disponível.'); }
    }
    function enqueue(action) { const task = outputQueue.then(action); outputQueue = task.catch(() => {}); return task; }
    return {
      preferences, get inputs() { return inputs; }, get outputs() { return outputs; }, sinkSupported,
      refresh,
      start() { if (!detach) detach = media.watchDevices(() => { void refresh(); }); return refresh(); },
      stop() { detach?.(); detach = null; refreshId++; },
      setInput(id) { preferences.preferredAudioInputId = validId(id); save(); notify(); },
      volume(id) { return preferences.remoteVolumes[id] ?? 1; },
      setVolume(id, value) {
        if (!Number.isFinite(value)) return;
        preferences.remoteVolumes[id] = Math.max(0,Math.min(1,value));
        const ids = Object.keys(preferences.remoteVolumes); if (ids.length > 100) delete preferences.remoteVolumes[ids[0]];
        save();
      },
      route(element) {
        if (!sinkSupported || !element?.setSinkId) return Promise.resolve();
        return enqueue(async () => {
          try { await element.setSinkId(preferences.preferredAudioOutputId); }
          catch { onError('Não foi possível aplicar a saída selecionada. Verifique a permissão do navegador.'); }
        });
      },
      setOutput(id, elements) {
        if (!sinkSupported) return Promise.resolve(false);
        return enqueue(async () => {
          const previous = preferences.preferredAudioOutputId, next = validId(id);
          const targets = elements.filter(e => typeof e.setSinkId === 'function');
          const results = await Promise.allSettled(targets.map(e => e.setSinkId(next)));
          if (results.some(r => r.status === 'rejected')) {
            await Promise.allSettled(targets.map(e => e.setSinkId(previous)));
            onError('Não foi possível mudar a saída. A seleção anterior foi mantida.'); notify(); return false;
          }
          preferences.preferredAudioOutputId = next; save(); notify(); return true;
        });
      },
    };
  }
  root.createVoiceDevices = createVoiceDevices;
  if (typeof module !== 'undefined') module.exports = createVoiceDevices;
})(globalThis);
