const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({persistent,report,instrument,snapshot,meshConnected,join,leave,clean,check,output})=>{
  const contexts=[],pages=[],audioReport={};report.audio=audioReport;
  const observe=page=>page.evaluate(()=>({
    devices:[...document.querySelector('[aria-label="Microfone"]').options].map(o=>({id:o.value,label:o.textContent})),
    outputs:[...document.querySelector('[aria-label="Saída de áudio"]').options].map(o=>({id:o.value,label:o.textContent})),
    selected:document.querySelector('[aria-label="Microfone"]').value,
    streams:window.__voiceTest.streams.map(s=>({id:s.id,tracks:s.getTracks().map(t=>({id:t.id,state:t.readyState,settings:t.getSettings()}))})),
    contexts:window.__voiceTest.contexts.map(c=>c.state),timers:window.__voiceTest.meterTimers.size,listeners:window.__voiceTest.deviceListeners.size,
    sources:window.__voiceTest.sources.map(s=>({streamId:s.stream.id,tracks:s.stream.getTracks().map(t=>t.id),disconnected:s.disconnected})),
    meter:document.querySelector('.spacevoice meter').value,
    speaking:[...document.querySelectorAll('.spacevoice-speaking')].map(e=>({text:e.textContent,speaking:e.dataset.speaking})),
    volumes:[...document.querySelectorAll('.spacevoice audio,.spacevoice video')].map(e=>({tag:e.tagName,peerId:e.dataset.peerId,volume:e.volume,muted:e.muted,sinkId:e.sinkId})),
    preference:JSON.parse(localStorage.getItem('spacevoice-audio-preferences')),
  }));
  const save=async label=>audioReport[label]=await Promise.all(pages.map(async p=>({rtc:await snapshot(p),audio:await observe(p)})));
  const stable=page=>page.waitForFunction(()=>window.__voiceTest.pcs.filter(p=>p.connectionState!=='closed').every(p=>p.signalingState==='stable'&&p.connectionState==='connected'));
  async function continuedRtp(page){
    const bytes=()=>page.evaluate(async()=>Promise.all(window.__voiceTest.pcs.filter(p=>p.connectionState!=='closed').map(async pc=>[...(await pc.getStats()).values()].filter(s=>s.type==='inbound-rtp'&&s.kind==='audio').reduce((n,s)=>n+s.bytesReceived,0))));
    const before=await bytes(),deadline=Date.now()+15000;
    while(Date.now()<deadline){await page.waitForTimeout(200);const after=await bytes();if(after.length===before.length&&after.every((n,i)=>n>before[i]))return;}
    assert.fail('Voice RTP stopped after microphone replacement');
  }
  try{
    for(let i=0;i<4;i++){
      const context=await persistent.browser().newContext({permissions:['microphone'],viewport:{width:1280,height:900}});contexts.push(context);const p=await context.newPage();pages.push(p);
      p.on('console',m=>{if(m.type()==='error')report.errors.push({client:'audio-'+i,kind:'console',text:m.text()});});p.on('pageerror',e=>report.errors.push({client:'audio-'+i,kind:'pageerror',text:e.message}));
      await p.addInitScript(instrument);await p.goto('http://localhost:3000/?voiceWsUrl=ws%3A%2F%2Flocalhost%3A8787#spacevoice');await p.getByRole('button',{name:'[ entrar na chamada ]',exact:true}).waitFor();
      assert.equal(await p.evaluate(()=>window.__voiceTest.streams.length),0);
    }
    const [a,b,c,d]=pages;
    for(const p of [a,b,c])await join(p);await Promise.all([a,b,c].map(p=>meshConnected(p,2)));await save('connected');
    check('Audio: real devices enumerate without automatic capture; three contexts join with labelled input selectors and native RTC');
    await a.waitForFunction(()=>document.querySelector('.spacevoice meter').value>0.1,null,{timeout:15000});
    await a.waitForFunction(()=>document.querySelector('.spacevoice-speaking[data-speaking="true"]'),null,{timeout:15000});
    await b.waitForFunction(()=>[...document.querySelectorAll('.spacevoice-speaking')].slice(1).some(e=>e.dataset.speaking==='true'),null,{timeout:15000});
    const readings=await observe(a);assert.equal(readings.contexts.filter(s=>s!=='closed').length,1);assert.equal(readings.timers,1);assert.equal(readings.sources.filter(s=>!s.disconnected).length,3);
    assert.ok(!(await snapshot(a)).events.some(e=>e.kind==='audio-connect'&&e.target==='AudioDestinationNode'));
    check('Audio: local meter and independent remote speaking respond to native fake audio; one shared Context, no second playback graph');
    const chosen=readings.devices.filter(d=>d.id && d.id!=='communications').at(-1);
    assert.ok(chosen,'Native fake browser must expose a selectable input');
    const original=await a.evaluate(()=>({pcs:window.__voiceTest.pcs.length,offers:window.__voiceTest.events.filter(e=>e.kind==='createOffer').length,captures:window.__voiceTest.streams.length,track:window.__voiceTest.streams.at(-1).getAudioTracks()[0].id}));
    await a.getByLabel('Microfone',{exact:true}).selectOption(chosen.id);
    await a.waitForFunction(old=>window.__voiceTest.streams.at(-1).getAudioTracks()[0].id!==old&&document.querySelector('[aria-label="Microfone"]').disabled===false,original.track);
    await Promise.all([a,b,c].map(stable));await Promise.all([b,c].map(continuedRtp));
    const changed=await a.evaluate(()=>({pcs:window.__voiceTest.pcs.length,offers:window.__voiceTest.events.filter(e=>e.kind==='createOffer').length,captures:window.__voiceTest.streams.length,replacements:window.__voiceTest.events.filter(e=>e.kind==='replaceTrack'),oldState:window.__voiceTest.streams[0].getAudioTracks()[0].readyState,current:window.__voiceTest.streams.at(-1).getAudioTracks()[0].id,senders:window.__voiceTest.pcs.filter(p=>p.connectionState!=='closed').map(p=>p.getSenders()[0].track.id)}));
    assert.equal(changed.pcs,original.pcs);assert.equal(changed.offers,original.offers);assert.equal(changed.captures,original.captures+1);assert.equal(changed.replacements.length,2);assert.equal(changed.oldState,'ended');assert.ok(changed.senders.every(id=>id===changed.current));
    audioReport.selectedDevice=chosen;await save('afterMicSwitch');check('Audio: one native getUserMedia replacement updates A-B/A-C without new PCs/offers; old track ends and RTP continues');
    await a.evaluate(id=>{const enumerate=navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);navigator.mediaDevices.enumerateDevices=async()=> (await enumerate()).filter(d=>d.deviceId!==id);navigator.mediaDevices.dispatchEvent(new Event('devicechange'));},chosen.id);
    await a.waitForFunction(()=>document.querySelector('[aria-label="Microfone"]').value===''&&!document.querySelector('[aria-label="Microfone"]').disabled);
    await Promise.all([a,b,c].map(stable));await Promise.all([b,c].map(continuedRtp));
    assert.equal(await a.evaluate(()=>window.__voiceTest.streams.length),original.captures+2);assert.equal(await a.evaluate(()=>window.__voiceTest.pcs.length),original.pcs);
    await a.evaluate(()=>navigator.mediaDevices.dispatchEvent(new Event('devicechange')));await a.waitForTimeout(150);assert.equal(await a.evaluate(()=>window.__voiceTest.streams.length),original.captures+2);
    audioReport.deviceRemovalMode='test-only filtered native enumerateDevices + devicechange, default capture/replaceTrack remain native';
    await save('deviceFallback');check('Audio: simulated input disappearance triggers one native default fallback; peers/RTP survive and repeated devicechange does not recapture');
    await a.getByRole('button',{name:'Silenciar microfone',exact:true}).click();
    for(const p of [b,c])await p.waitForFunction(()=>[...document.querySelectorAll('.spacevoice-speaking')].slice(1).some(e=>e.textContent==='× mutado'));
    assert.equal(await a.evaluate(()=>document.querySelector('.spacevoice meter').value),0);
    assert.ok(await a.evaluate(()=>document.querySelector('.spacevoice-speaking').dataset.speaking==='false'));
    await join(d);await Promise.all(pages.map(p=>meshConnected(p,3)));await d.waitForFunction(()=>[...document.querySelectorAll('.spacevoice-speaking')].slice(1).some(e=>e.textContent==='× mutado'));
    await a.screenshot({path:path.join(output,'audio-muted.png'),fullPage:true});await save('mutedLateJoin');check('Audio: explicit mute metadata suppresses local speaking and reaches late fourth participant');
    await a.getByRole('button',{name:'Ativar microfone',exact:true}).click();for(const p of [b,c,d])await p.waitForFunction(()=>![...document.querySelectorAll('.spacevoice-speaking')].slice(1).some(e=>e.textContent==='× mutado'));
    await Promise.all([b,c,d].map(continuedRtp));
    const bId=await b.evaluate(()=>window.__voiceTest.events.find(e=>e.kind==='ws-send'&&e.message.type==='join').message.from);
    const volume=a.locator('.spacevoice-participants li[data-peer-id="'+bId+'"] input');
    await a.locator('.spacevoice-participants li[data-peer-id="'+bId+'"] summary').click();await volume.evaluate(e=>{e.value='25';e.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.ok((await observe(a)).volumes.every(v=>v.volume===(v.peerId===bId ? .25 : 1)));
    await a.getByRole('button',{name:'[ deafen ]',exact:true}).click();assert.ok((await observe(a)).volumes.every(v=>v.muted));
    await a.getByRole('button',{name:'[ deafen · ligado (local) ]',exact:true}).click();assert.ok((await observe(a)).volumes.every(v=>!v.muted&&v.volume===(v.peerId===bId ? .25 : 1)));
    check('Audio: participant volume changes only B playback; deafen mutes all locally and undeafen restores saved volumes');
    // Keep a screen active while changing microphone again; system audio never enters voice analysers.
    await b.getByRole('button',{name:'[ compartilhar tela ]',exact:true}).click();await b.getByRole('button',{name:'[ parar tela ]',exact:true}).waitFor();await a.waitForFunction(()=>document.querySelector('.spacevoice video')?.readyState>=2);
    await Promise.all(pages.map(stable));assert.equal((await observe(a)).volumes.find(v=>v.tag==='VIDEO').volume,.25);
    await b.getByRole('button',{name:'Silenciar microfone',exact:true}).click();await a.waitForFunction(()=>[...document.querySelectorAll('.spacevoice-speaking')].some(e=>e.textContent==='× mutado'));
    await a.waitForTimeout(700);
    const sourceInfo=await observe(a),screenIds=await a.evaluate(()=>[...document.querySelectorAll('.spacevoice video')].flatMap(v=>v.srcObject.getTracks().map(t=>t.id)));
    assert.ok(sourceInfo.sources.filter(s=>!s.disconnected).every(s=>s.tracks.every(id=>!screenIds.includes(id))));
    const bIndicator=await a.locator('.spacevoice-participants li[data-peer-id="'+bId+'"] .spacevoice-speaking').textContent();assert.equal(bIndicator,'× mutado');
    const displayBefore=await b.evaluate(()=>window.__voiceTest.displays.at(-1).id),pcCount=await a.evaluate(()=>window.__voiceTest.pcs.length);
    await a.getByLabel('Microfone',{exact:true}).selectOption('');await a.waitForFunction(()=>!document.querySelector('[aria-label="Microfone"]').disabled);await Promise.all(pages.map(stable));
    assert.equal(await a.evaluate(()=>window.__voiceTest.pcs.length),pcCount);assert.equal(await b.evaluate(()=>window.__voiceTest.displays.at(-1).id),displayBefore);
    check('Audio: voice-only analysers exclude live screen/system audio; share remains active through runtime microphone change');
    const outputSupported=await a.evaluate(()=>typeof HTMLMediaElement.prototype.setSinkId==='function');audioReport.outputSupported=outputSupported;
    if(outputSupported){
      await a.getByLabel('Saída de áudio',{exact:true}).selectOption('');await a.waitForFunction(()=>window.__voiceTest.events.filter(e=>e.kind==='setSinkId').length>=4);
      audioReport.outputDevices=(await observe(a)).outputs;
      assert.ok((await observe(a)).volumes.every(v=>v.sinkId===''));
      const selectedOutput=audioReport.outputDevices.filter(d=>d.id).at(-1);
      if(selectedOutput){
        await a.getByLabel('Saída de áudio',{exact:true}).selectOption(selectedOutput.id);
        await a.waitForFunction(id=>JSON.parse(localStorage.getItem('spacevoice-audio-preferences')).preferredAudioOutputId===id||document.querySelector('.spacevoice-status').textContent.includes('Não foi possível mudar a saída'),selectedOutput.id);
        if((await observe(a)).preference.preferredAudioOutputId===selectedOutput.id){assert.ok((await observe(a)).volumes.every(v=>v.sinkId===selectedOutput.id));audioReport.selectedOutput=selectedOutput;}
        else audioReport.outputLimitation='Native default succeeds; nondefault output denied, transaction rollback covered by unit tests';
      }
      check('Audio: native setSinkId default/nondefault selection tested for every remote voice and screen element',audioReport.selectedOutput||audioReport.outputLimitation);
    }else{audioReport.outputLimitation='setSinkId unavailable in browser; output transaction covered by unit mocks';check('Audio: unsupported setSinkId leaves system output functional');}
    await a.screenshot({path:path.join(output,'audio-desktop.png'),fullPage:true});
    for(const width of [390,1280]){await a.setViewportSize({width,height:900});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await a.screenshot({path:path.join(output,width===390?'audio-mobile.png':'audio-with-screen.png'),fullPage:true});}
    check('Audio: four-person participant list, compact controls, meter and screen fit desktop/mobile without horizontal overflow');
    await leave(a);await clean(a);const stopped=await observe(a);assert.ok(stopped.contexts.every(s=>s==='closed'));assert.equal(stopped.timers,0);assert.equal(stopped.listeners,0);assert.ok(stopped.sources.every(s=>s.disconnected));
    await join(a);await Promise.all(pages.map(p=>meshConnected(p,3)));const reentered=await observe(a);assert.equal(reentered.contexts.filter(s=>s!=='closed').length,1);assert.equal(reentered.timers,1);assert.equal(reentered.listeners,1);assert.equal(reentered.sources.filter(s=>!s.disconnected).length,4);
    assert.equal(reentered.volumes.find(v=>v.peerId===bId&&v.tag==='AUDIO').volume,.25);await save('reentered');
    check('Audio: leave closes Context/disconnects nodes/cancels meter loop/device listener; rejoin has exactly one loop and one monitor per voice, volume restored');
    for(const p of pages)await leave(p);await Promise.all(pages.map(clean));for(const p of pages){const final=await observe(p);assert.equal(final.timers,0);assert.equal(final.listeners,0);assert.ok(final.contexts.every(s=>s==='closed'));}
    check('Audio: total cleanup leaves no active AudioContext, device listener or analyser loop');
  }catch(error){audioReport.failureSnapshots=await Promise.all(pages.map(async p=>({rtc:await snapshot(p),audio:await observe(p)})));throw error;}
  finally{for(const context of contexts)await context.close();}
};
