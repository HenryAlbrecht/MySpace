// Public guest search and exact artwork bytes, without cookies or playback streams.
const fs=require('fs'),{createYouTubeMusicClient}=require('../server/youtube-music.cjs');
(async()=>{const yt=createYouTubeMusicClient(),rows=[];fs.mkdirSync('artifacts/spaceamp-regressions',{recursive:true});
 for(const query of ['Thanatos Kinokoteikoku','Wonderwall Oasis','Kokudouslope Kinokoteikoku']){
 const result=await yt.search('music',query);const item=result.items[0];if(!item)throw Error('No search result');
 const core=await yt.details('music',item.catalogId.split(':')[2]);const row={...item,...core};
 const response=await fetch(row.image,{redirect:'error'});const bytes=Buffer.from(await response.arrayBuffer());
 const file='artifacts/spaceamp-regressions/artwork-'+rows.length+'.jpg';fs.writeFileSync(file,bytes);
 rows.push({query,item:row,hostname:new URL(row.image).hostname,status:response.status,contentType:response.headers.get('content-type'),cors:response.headers.get('access-control-allow-origin'),file});
 }
 fs.writeFileSync('artifacts/spaceamp-regressions/live-artwork.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.map(({query,item,hostname,status,cors})=>({query,title:item.title,image:item.image,hostname,status,cors}))));
 const apple=await (await fetch('https://itunes.apple.com/search?term=Wonderwall%20Oasis&entity=song&limit=1')).json(),legacy=apple.results?.[0];
 if(legacy)fs.writeFileSync('artifacts/spaceamp-regressions/legacy-artwork.json',JSON.stringify({title:legacy.trackName,artist:legacy.artistName,source:'áudio',sourceUrl:legacy.previewUrl||'legacy',artwork:legacy.artworkUrl100.replace('100x100bb','600x600bb')},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
