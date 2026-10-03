/* Posição de leitura por página nesta sessão. */
(() => {
  const positions = new Map(); let current = location.hash || '#perfil', restoring = false, revision = 0;
  try { const rows=JSON.parse(sessionStorage.getItem('myspace-reading-positions') || '[]');if(Array.isArray(rows))for(const [key,value] of rows.slice(-30))if(typeof key==='string'&&Number.isFinite(value)&&value>=0&&value<=1000000)positions.set(key,value); } catch {}
  let saveTimer=null;
  function persist(){clearTimeout(saveTimer);saveTimer=null;try{sessionStorage.setItem('myspace-reading-positions',JSON.stringify([...positions]));}catch{}}
  function capture(hash=current,save=true){const value=Number(window.scrollY || 0);positions.set(hash,Math.max(0,value));if(positions.size>30)positions.delete(positions.keys().next().value);if(save)persist();else if(saveTimer===null)saveTimer=setTimeout(persist,150);}
  function restore(hash=location.hash || '#perfil') {
    if((location.hash || '#perfil')!==hash)return;
    current=hash;const value=positions.get(hash) || 0, token=++revision;restoring=true;
    const frame=window.requestAnimationFrame || (callback=>setTimeout(callback,0));
    frame(()=>{if(token!==revision)return;if((location.hash || '#perfil')===hash)window.scrollTo?.({top:value,behavior:'instant'});frame(()=>{if(token===revision)restoring=false;});});
  }
  window.addEventListener('scroll',()=>{if(!restoring && (location.hash || '#perfil')===current)capture(current,false);},{passive:true});
  window.addEventListener('pagehide',persist);
  window.addEventListener('hashchange',()=>restore());
  window.Navigation={capture,restore};
})();
