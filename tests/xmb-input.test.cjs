const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSampler}=require('../dist/xmb-input.js');
const pad=()=>({index:0,mapping:'standard',buttons:Array.from({length:16},()=>({pressed:false,value:0})),axes:[0,0]});
test('face actions edge only; directional repeat bounded and shared by stick/dpad',()=>{
 const actions=[],sample=createSampler(a=>actions.push(a)),p=pad();p.buttons[0].pressed=true;sample(p,0);sample(p,16);sample(p,400);assert.deepEqual(actions,['primary']);
 p.buttons[0].pressed=false;p.buttons[13].pressed=true;sample(p,500);sample(p,700);sample(p,780);sample(p,850);sample(p,885);assert.deepEqual(actions,['primary','down','down','down']);
 p.buttons[13].pressed=false;p.axes=[.2,.4];sample(p,1000);assert.equal(actions.length,4);
 p.axes=[.8,.9];sample(p,1100);assert.equal(actions.at(-1),'down');p.axes=[.95,.7];sample(p,1120);assert.equal(actions.at(-1),'right');
 sample(null,1200);sample({...pad(),mapping:'unknown'},1300);assert.equal(actions.length,6);
});
