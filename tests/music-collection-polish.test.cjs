const {test}=require('node:test'),assert=require('node:assert/strict'),model=require('../dist/music-model.js');
test('discovery work matching omits alternate album appearances without merging identities or versions',()=>{
 const saved={kind:'music',title:'iPod Touch',artist:'Ninajirachi',catalogId:'itunes:1'};
 assert.equal(model.sameWork(saved,{...saved,catalogId:'itunes:2'}),true);assert.equal(model.sameItem(saved,{...saved,catalogId:'itunes:2'}),false);
 assert.equal(model.sameWork(saved,{...saved,catalogId:'itunes:3',title:'iPod Touch (Live)'}),false);assert.equal(model.sameWork(saved,{...saved,catalogId:'itunes:2',artist:'Other'}),false);
});
