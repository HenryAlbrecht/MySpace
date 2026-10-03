// Manual network diagnostic; generates its own output directory.
const fs=require('node:fs'),path=require('node:path');
fs.mkdirSync('artifacts/music-real-services', {recursive:true});
process.loadEnvFile(path.join(__dirname,'../.env'));
const {createLastfmClient}=require('../server/lastfm.cjs'),{createMusicClient}=require('../server/music.cjs');
(async()=>{const lastfm=createLastfmClient(),apple=createMusicClient(),raw=await lastfm.recommendations('album','Oasis',"(What's the Story) Morning Glory?");const results=[];
 for(const row of raw.items.slice(0,3)){try{const found=await apple.search('album',row.title+' '+row.artist);results.push({suggestion:{title:row.title,artist:row.artist},apple:found.items.slice(0,3).map(r=>({title:r.title,artist:r.artist}))});}catch(e){results.push({suggestion:{title:row.title,artist:row.artist},error:e.message});}}
 const britney=await lastfm.summary('music','Britney Spears','Oops!... I Did It Again');const result={lastfmAlbumCount:raw.items.length,examples:results,britneyAsciiSummaryAvailable:!!britney.summary};fs.writeFileSync('artifacts/music-real-services/diagnostic.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));})().catch(e=>{console.error(e);process.exitCode=1;});
