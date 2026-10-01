/* Visual metadata only. One inactivity deadline, no polling or media ownership. */
(function(root){
 const IDLE_MS=5*60*1000,UPDATE_MS=1000;
 function createPartyPresence({target=root.document,now=Date.now,schedule=root.setTimeout?.bind(root),cancel=root.clearTimeout?.bind(root),idleMs=IDLE_MS,onIdle=()=>{}}={}) {
  let active=false,idle=false,last=0,timer=null;
  const events=['pointerdown','pointermove','keydown','touchstart'];
  function check(){timer=null;if(!active)return;const remaining=idleMs-(now()-last);if(remaining>0)timer=schedule(check,remaining);else if(!idle){idle=true;onIdle(true);}}
  function interact(){if(!active)return;last=now();if(idle){idle=false;onIdle(false);}if(timer===null)timer=schedule(check,idleMs);}
  return {get idle(){return idle;},start(){if(active)return;active=true;last=now();idle=false;for(const e of events)target?.addEventListener?.(e,interact,{passive:true});timer=schedule?.(check,idleMs);},stop(){active=false;cancel?.(timer);timer=null;for(const e of events)target?.removeEventListener?.(e,interact);idle=false;}};
 }
 root.PARTY_PRESENCE={IDLE_MS,UPDATE_MS,create:createPartyPresence};
 if(typeof module!=='undefined')module.exports=root.PARTY_PRESENCE;
})(globalThis);
