/* Temporary artwork clones; never move a real image or playback node. */
(function(root){
 let clone,animation,hiddenTarget,pendingSource,readyFrame,revision=0;const entrances=[];
 function cleanup(){revision++;cancelAnimationFrame(readyFrame);pendingSource=null;for(const entry of entrances)entry.cancel();entrances.length=0;animation?.cancel();animation=null;clone?.remove();clone=null;if(hiddenTarget){hiddenTarget.classList.remove('xmb-handoff-hidden');hiddenTarget=null;}}
 function valid(source){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||innerWidth<600||!source?.complete||!source.naturalWidth)return false;
  const rect=source.getBoundingClientRect();return !!rect.width&&!!rect.height&&rect.bottom>=0&&rect.top<=innerHeight;
 }
 function prepare(source,expected){
  cleanup();if(expected&&valid(source)){
   pendingSource=expected;
   document.querySelector('#spaceampNowPlaying')?.setAttribute('data-artwork-handoff','');
  }
 }
 function covers(source){return !!pendingSource&&pendingSource===source;}
 function run(source,target){
  const expected=pendingSource || source?.getAttribute('src');
  cleanup();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced||innerWidth<600||!source?.complete||!source.naturalWidth||!target?.isConnected)return;
  // A shared clone targets final geometry, never the shell's entry scale.
  target.closest('#spaceampNowPlaying')?.setAttribute('data-artwork-handoff','');
  const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
  if(!a.width||!a.height||a.bottom<0||a.top>innerHeight||!b.width||!b.height)return;
  clone=source.cloneNode(false);clone.className='xmb-handoff-artwork';clone.removeAttribute('id');clone.alt='';clone.setAttribute('aria-hidden','true');
  Object.assign(clone.style,{position:'fixed',left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px',objectFit:'cover',zIndex:'2147483646',pointerEvents:'none',margin:'0',transformOrigin:'top left'});
  const appearance=getComputedStyle(target);
  Object.assign(clone.style,{boxSizing:'border-box',border:appearance.border,borderRadius:appearance.borderRadius,boxShadow:appearance.boxShadow,objectPosition:appearance.objectPosition});
  document.body.append(clone);
  hiddenTarget=target;target.classList.add('xmb-handoff-hidden');
  pendingSource=expected;const tokenRevision=revision;
  const css=getComputedStyle(target),token=css.getPropertyValue('--motion-standard').trim();
  const duration=Math.max(200,Math.min(260,parseFloat(token)*(token.endsWith('ms')?1:1000)||220));
  animation=clone.animate([{transform:`translate(${a.left-b.left}px,${a.top-b.top}px) scale(${a.width/b.width},${a.height/b.height})`},{transform:'none'}],{duration,easing:css.getPropertyValue('--ease-xmb').trim()||'ease',fill:'both'});
  animation.onfinish=()=>{
   // Keep the final clone frame until the matching destination has decoded.
   const reveal=async()=>{
    if(tokenRevision!==revision)return;
    const correct=target.getAttribute('src')&&new URL(target.getAttribute('src'),document.baseURI).href===new URL(expected,document.baseURI).href;
    if(correct&&target.complete&&target.naturalWidth&&target.dataset.artworkState!=='loading'){
     try{await target.decode();}catch{}
     if(tokenRevision===revision)cleanup();
    }else if(!target.isConnected||target.dataset.artworkState==='error')cleanup();
    else readyFrame=requestAnimationFrame(reveal);
   };
   void reveal();
  };animation.oncancel=()=>{clone?.remove();clone=null;if(hiddenTarget){hiddenTarget.classList.remove('xmb-handoff-hidden');hiddenTarget=null;}};
 }
 function enterPresentation(shell){
  if(!shell||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const css=getComputedStyle(shell),easing=css.getPropertyValue('--ease-xmb').trim()||'ease';
  for(const [selector,delay] of [['.np-chrome',60],['.np-lyrics',110]])for(const node of shell.querySelectorAll(selector))entrances.push(node.animate([{opacity:.94},{opacity:1}],{duration:150,delay,easing,fill:'backwards'}));
 }
 root.addEventListener('spaceamp:nowplaying-closed',()=>document.querySelector('#spaceampNowPlaying')?.removeAttribute('data-artwork-handoff'));
 root.XmbHandoff={run,prepare,covers,cleanup,enterPresentation};
})(window);
