const { test } = require('node:test');
const assert = require('node:assert/strict');
const createMedia = require('../dist/voice/media.js');
const createCall = require('../dist/voice/state.js');
function fixture(acquire) {
  const track = { enabled:true, stopped:0, stop() { this.stopped++; }, label:'Microfone de teste',
    addEventListener(_, fn) { this.ended = fn; }, removeEventListener() { this.ended = null; } };
  const other = { stopped:0, stop() { this.stopped++; } };
  const stream = { getAudioTracks:() => [track], getTracks:() => [track, other] };
  let requests = 0;
  const media = createMedia({ secureContext:true, mediaDevices:{ getUserMedia(options) {
    requests++;
    assert.deepEqual(options, { audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true } });
    return acquire ? acquire(stream) : Promise.resolve(stream);
  } } });
  return { call:createCall(media), track, other, stream, requests:() => requests };
}
test('capture is explicit, mute changes real tracks, deafen is independent, leave releases all tracks', async () => {
  const f = fixture();
  assert.equal(f.requests(), 0);
  await f.call.join(); await f.call.join();
  assert.equal(f.requests(), 1); assert.equal(f.call.state.joined, true);
  f.call.toggleMute(); assert.equal(f.track.enabled, false);
  f.call.toggleDeafen(); assert.equal(f.call.state.deafened, true); assert.equal(f.track.enabled, false);
  f.call.toggleMute(); assert.equal(f.track.enabled, true);
  f.call.leave(); f.call.leave();
  assert.equal(f.track.stopped, 1); assert.equal(f.other.stopped, 1);
  assert.equal(f.call.state.localStream, null); assert.equal(f.call.state.joined, false);
});
test('pending permission cannot leak capture after leaving, including a new session', async () => {
  let resolve;
  const f = fixture(() => new Promise(r => { resolve = r; }));
  const pending = f.call.join();
  assert.equal(f.call.state.joining, true);
  f.call.leave(); resolve(f.stream); await pending;
  assert.equal(f.track.stopped, 1); assert.equal(f.call.state.localStream, null);
  assert.equal(f.call.state.joined, false);
});
test('permission, unavailable device/browser and insecure context show useful errors', async () => {
  for (const name of ['NotAllowedError','NotFoundError','NotReadableError']) {
    const f = fixture(() => Promise.reject(Object.assign(new Error(), { name })));
    await f.call.join();
    assert.ok(f.call.state.error); assert.equal(f.call.state.joining, false);
    assert.equal(f.call.state.localStream, null);
  }
  for (const options of [{ mediaDevices:{},secureContext:true }, { mediaDevices:{},secureContext:false }]) {
    const call = createCall(createMedia(options)); await call.join(); assert.ok(call.state.error);
  }
});
test('device removal attempts default capture while keeping the call open', async () => {
  const f = fixture(); await f.call.join(); f.track.ended();
  for(let i=0;i<20;i++)await Promise.resolve();
  assert.equal(f.call.state.joined, true); assert.equal(f.requests(),2);
  f.call.leave();
});
