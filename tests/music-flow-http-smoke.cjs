const assert = require('node:assert/strict');
const { createServer } = require('../server.cjs');
const { createDeezerClient } = require('../server/deezer.cjs');
const { createMusicCatalog } = require('../server/music-catalog.cjs');
const artist={id:74211202,name:'bôa',picture_big:'https://example.com/photo.jpg',nb_fan:23000};
const album={id:200,title:'Twilight',cover_big:'https://example.com/album.jpg',artist,release_date:'1998-01-01',record_type:'album'};
const track={id:201,title:'Duvet',artist,album,duration:203};
const deezer=createDeezerClient({fetcher:async url=>{
  const parsed=new URL(url),path=parsed.pathname;
  const data=path.startsWith('/search/') ? {data:[artist,{id:792,name:'BoA',picture_big:'https://example.com/other.jpg',nb_fan:47000}]}
    : path.endsWith('/top') ? {data:[track]}
    : path.endsWith('/albums') ? {data:[{...album,id:parsed.searchParams.get('index')==='20'?202:200}],next:parsed.searchParams.get('index')==='0'?'https://api.deezer.com/next':undefined}
    : path.startsWith('/album/') ? {...album,tracks:{data:[track]}}
    : path.startsWith('/track/') ? track : artist;
  return {ok:true,json:async()=>data};
}});
const music=createMusicCatalog({deezer,lastfm:{details:async()=>({summary:'Original biography',genres:[],similarArtists:[]})}});
(async()=>{
  const server=createServer({music});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  async function get(path){const response=await fetch(base+path);assert.equal(response.status,200);return response.json();}
  try{
    const html=await (await fetch(base+'/')).text();assert.ok(html.includes('media-package.js')&&html.includes('discovery-page.js'));
    const search=await get('/api/music/search?kind=artist&q=b%C3%B4a');assert.equal(search.items.length,2);assert.equal(search.items[0].knownTrack,'Duvet');
    const details=await get('/api/music/deezer/artist/74211202');assert.equal(details.discographyNext,20);
    const page=await get('/api/music/artist/74211202/albums?offset=20');assert.equal(page.items[0].releaseDate,'1998-01-01');assert.equal(page.next,null);
    const record=await get('/api/music/deezer/album/200');assert.equal(record.albumTracks[0].catalogId,'deezer:201');
    const song=await get('/api/music/deezer/music/201');assert.equal(song.albumCatalogId,'deezer:200');assert.equal(song.artistCatalogId,'deezer:74211202');
    assert.equal((await fetch(base+'/api/music/artist/74211202/albums?offset=-1')).status,400);
    console.log('HTTP flow: page assets, distinct artists, known song, paginated discography, album and track links OK.');
  }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
