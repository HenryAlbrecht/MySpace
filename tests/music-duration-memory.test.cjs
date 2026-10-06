const {test}=require('node:test'),assert=require('node:assert/strict');
const {durationFromText,parseSearch}=require('../server/youtube-music-parser.cjs');
const Collection=require('../dist/collection.js');
test('duration reads only explicit renderer text, including simpleText and hour clocks',()=>{
 for(const [value,seconds] of [[{simpleText:'3:59'},239],[{runs:[{text:'4:30'}]},270],[{simpleText:'1:02:15'},3735]])assert.equal(durationFromText(value),seconds);
 for(const value of ['2026','327K','12,004,240'])assert.equal(durationFromText({simpleText:value}),undefined);
 assert.equal(durationFromText({nested:{simpleText:'4:30'}}),undefined);
 const row={navigationEndpoint:{watchEndpoint:{videoId:'abcdefghijk',watchEndpointMusicSupportedConfigs:{watchEndpointMusicConfig:{musicVideoType:'MUSIC_VIDEO_TYPE_ATV'}}}},flexColumns:[{musicResponsiveListItemFlexColumnRenderer:{text:{simpleText:'Song'}}},{musicResponsiveListItemFlexColumnRenderer:{text:{runs:[{text:'Artist',navigationEndpoint:{browseEndpoint:{browseId:'UCtestartist123',browseEndpointContextSupportedConfigs:{browseEndpointContextMusicConfig:{pageType:'MUSIC_PAGE_TYPE_ARTIST'}}}}}]}}}],fixedColumns:[{musicResponsiveListItemFixedColumnRenderer:{text:{simpleText:'3:59'}}}]};
 assert.equal(parseSearch('music',{musicResponsiveListItemRenderer:row})[0].trackDuration,239);
 delete row.fixedColumns;row.flexColumns.push({musicResponsiveListItemFlexColumnRenderer:{text:{simpleText:'1:02:15'}}});
 assert.equal(parseSearch('music',{musicResponsiveListItemRenderer:row})[0].trackDuration,3735);
 row.flexColumns.pop();row.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text.simpleText='4:30';
 assert.equal(parseSearch('music',{musicResponsiveListItemRenderer:row})[0].trackDuration,undefined,'a clock-like title is not duration');
});
test('discoveryOrigin is optional, sanitized and invalid origins do not break legacy imports',()=>{
 const base={kind:'album',title:'Saved album',status:'planned'};
 const origin={kind:'music',catalogId:'ytmusic:video:abcdefghijk',title:'  Creep  ',surface:'global',timestamp:123,origins:['other']};
 assert.deepEqual(Collection.validateItem({...base,discoveryOrigin:origin}).discoveryOrigin,{kind:'music',catalogId:origin.catalogId,title:'Creep',surface:'global'});
 for(const bad of [null,[],{...origin,kind:'unknown'},{...origin,surface:'search'},{...origin,catalogId:'ytmusic:video:bad'},{...origin,title:'x'.repeat(121)},{...origin,catalogId:'https://a.test/?token=bad'}])assert.equal(Object.hasOwn(Collection.validateItem({...base,discoveryOrigin:bad}),'discoveryOrigin'),false);
 assert.equal(Object.hasOwn(Collection.validateItem(base),'discoveryOrigin'),false);
});
