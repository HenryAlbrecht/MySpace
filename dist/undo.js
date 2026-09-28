/* Histórico de metadados na sessão; arquivos binários não entram nele. */
(() => {
  const proto = Object.getPrototypeOf(localStorage), set = proto.setItem, remove = proto.removeItem;
  const tracked = key => ['myspace-extras-v1', 'myspace-profile-v1', 'myspace-discovery-dismissed'].includes(key) || /^myspace\.(titleCover|titleBanner|titleBannerSettings|trackVideo):/.test(key);
  const sessionKey = 'myspace-undo-session';
  let stack = [], pending = null, timer, restoring = false;
  try { const stored=JSON.parse(sessionStorage.getItem(sessionKey) || '[]'); if(Array.isArray(stored))stack=stored.filter(entry=>Array.isArray(entry)&&entry.every(row=>Array.isArray(row)&&row.length===2&&tracked(row[0])&&(row[1]===null||typeof row[1]==='string'))).slice(-15); } catch {}
  const bar = document.createElement('div'); bar.className = 'undo-bar'; bar.hidden = true;
  const button = document.createElement('button'); button.type = 'button'; button.textContent = '↶ desfazer última alteração';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Fechar aviso de desfazer'); close.onclick = () => { bar.hidden = true; };
  bar.append(button, close); document.body.append(bar);
  function persistHistory() {
    let serialized=JSON.stringify(stack);
    while(serialized.length > 2*1024*1024 && stack.length>1) {stack.shift();serialized=JSON.stringify(stack);}
    try { if(serialized.length <= 2*1024*1024) sessionStorage.setItem(sessionKey,serialized); else sessionStorage.removeItem(sessionKey); } catch {}
    button.textContent='↶ desfazer ('+stack.length+' passos)';bar.hidden=!stack.length;
  }
  function flush() { if(pending) {stack.push([...pending]);stack=stack.slice(-15);pending=null;persistHistory();} }
  persistHistory();
  function record(key, old) {
    if (restoring || !tracked(key)) return;
    if (!pending) pending = new Map();
    if (!pending.has(key)) pending.set(key, old);
    clearTimeout(timer); timer = setTimeout(flush, 0);
  }
  proto.setItem = function(key, value) {
    const old = this.getItem(key); set.call(this,key,value);
    if (this === localStorage && old !== String(value)) {
      if (key === 'myspace-extras-v1') {
        try {
          const before=JSON.parse(old || '{}'),after=JSON.parse(String(value));
          const mediaChanged=JSON.stringify(before.featuredVideo || {})!==JSON.stringify(after.featuredVideo || {}) || (before.tracks || []).some(track=>(track.local || track.fileName)&&!(after.tracks || []).some(next=>next.id===track.id&&next.fileName===track.fileName&&next.local===track.local));
          if(mediaChanged) {window.Undo.clear();return;}
        } catch {}
      }
      record(String(key),old);
    }
  };
  proto.removeItem = function(key) { const old = this.getItem(key); remove.call(this,key); if (this === localStorage && old !== null) record(String(key),old); };
  button.onclick = () => {
    clearTimeout(timer);flush();const entry=stack[stack.length-1];if(!entry)return;const changes=new Map(entry);
    const current = new Map([...changes.keys()].map(key => [key,localStorage.getItem(key)])); restoring = true;
    const apply = entries => { for (const [key,value] of entries) value === null ? remove.call(localStorage,key) : set.call(localStorage,key,value); };
    try { apply(changes);stack.pop();persistHistory();location.reload(); }
    catch { try { apply(current); } catch {} button.textContent = 'Sem espaço para desfazer. Exporte um backup.'; }
    finally { restoring = false; }
  };
  window.Undo = { clear() { clearTimeout(timer);pending=null;stack=[];persistHistory(); }, count:()=>stack.length };
  window.addEventListener('load', () => {clearTimeout(timer);pending=null;persistHistory();}, { once: true });
})();
