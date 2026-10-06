// Public guest catalog audit. No account cookies or user collection are read.
const fs=require('node:fs'),{createMusicCatalog}=require('../server/music-catalog.cjs'),{createYouTubeMusicClient}=require('../server/youtube-music.cjs'),{createLastfmClient}=require('../server/lastfm.cjs');
const {sameArtist}=require('../server/music-recommendation-ranking.cjs');
(async()=>{
 try{process.loadEnvFile('.env');}catch{}
 const root='artifacts/recommendation-strategy';fs.mkdirSync(root,{recursive:true});
 const requests=[];
 const youtubeMusic=createYouTubeMusicClient({timeout:20000,fetcher:async(url,options)=>{
   const body=options?.body?JSON.parse(options.body):{};
   requests.push({endpoint:String(url).split('/').pop().split('?')[0],browseId:body.browseId,videoId:body.videoId,query:body.query});
   return fetch(url,options);
 }});
 const lastfm=createLastfmClient({fetcher:async(url,options)=>{const query=new URL(url).searchParams;requests.push({endpoint:'lastfm',method:query.get('method'),artist:query.get('artist')});return fetch(url,options);}});
 const catalog=createMusicCatalog({youtubeMusic,lastfm});
 const album=(await youtubeMusic.search('album','Time Lapse Kinokoteikoku')).items.find(row=>row.title==='Time Lapse');
 const eps=(await youtubeMusic.search('album','Long Goodbye Kinokoteikoku')).items;
 const ep=eps.find(row=>row.albumType==='ep');if(!ep)throw Error('No real EP returned');
 const cases=[['mado','MPREb_pnNS2ekfHeB'],['whale-net','MPREb_WpaRwvXraMb'],['ep',ep.catalogId.split(':')[2]],['album',album.catalogId.split(':')[2]]];
 const observed={lastfmConfigured:!!process.env.LASTFM_API_KEY,cases:{}};
 for(const [label,id]of cases){
   const detail=await youtubeMusic.details('album',id),offset=requests.length,start=Date.now();
   const result=await catalog.recommendations('album',detail.artist,detail.title,{albumId:id});
   const metrics={title:detail.title,type:detail.albumType,count:result.items.length,cross:result.items.filter(row=>!sameArtist(detail,row)).length,own:result.items.filter(row=>sameArtist(detail,row)).length,ms:Date.now()-start};
   observed.cases[label]={detail,result,metrics,requests:requests.slice(offset)};
   fs.writeFileSync(root+'/live.json',JSON.stringify(observed,null,2));console.log(label,JSON.stringify({...metrics,budget:result.requestBudget,requests:requests.length-offset}));
   if(metrics.own>2||result.items.some(row=>row.albumType&&row.albumType!==detail.albumType))throw Error('Invalid recommendation policy');
 }
 observed.requests=requests;fs.writeFileSync(root+'/live.json',JSON.stringify(observed,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
