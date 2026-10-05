const MusicModel = require('../dist/music-model.js');
const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const markers = ['live','remix','acoustic','demo','instrumental','karaoke','sped up','slowed','nightcore','remaster','radio edit','extended','version','cover'];
function versions(value) {
  const text = normalize(value).replace(/remastered/g, 'remaster');
  return markers.filter(marker => new RegExp('(?:^| )'+marker+'(?: |$)').test(text)).join('|');
}
function title(value) {
  return normalize(String(value || '').replace(/\s*\((?:original )?soundtrack\)\s*/ig, ' ').replace(/\s*\(?\b(?:feat\.?|ft\.?)\s+.*$/i, ''));
}
function artists(value) { return String(value || '').split(/\s*(?:,|&|\/|·|;|\bfeat\.?|\bft\.?|\bwith\b)\s*/i).map(normalize).filter(Boolean); }
function workTitle(value) { return title(String(value||'').replace(/\(([^)]*)\)/g,(whole,qualifier)=>versions(qualifier)?'':whole)); }
function scoreCandidate(target, candidate) {
  const reasons = []; let score = 0;
  const reject = reason => ({candidate, score:0, reasons:[reason], hardReject:true});
  let source;
  try { source=MusicModel.source({type:'youtube',videoId:candidate.videoId,url:candidate.url}); } catch { return reject('invalid-source'); }
  if(source.videoId!==candidate.videoId || candidate.resultType!=='song')return reject('not-song');
  if(versions(target.title)!==versions(candidate.title))return reject('version-conflict');
  if(!title(target.title)||title(target.title)!==title(candidate.title))return reject('title-conflict');
  score+=45;reasons.push('title-exact');
  const wanted=artists(target.artist), actual=artists(candidate.artist);
  if(!wanted.some(name=>actual.includes(name)))return reject('artist-conflict');
  score+=30;reasons.push('artist-match');
  const duration=target.trackDuration ?? target.duration;
  if(Number.isFinite(duration)&&duration>0&&Number.isFinite(candidate.duration)&&candidate.duration>0){
    const delta=Math.abs(duration-candidate.duration);
    if(delta>20)return reject('duration-conflict');
    score+=delta<=3?20:delta<=6?16:delta<=10?10:-15;reasons.push('duration:'+delta+'s');
  }
  if(normalize(target.albumTitle||target.album)&&normalize(target.albumTitle||target.album)===normalize(candidate.album)){score+=12;reasons.push('album-match');}
  score+=5;reasons.push('song');
  return {candidate,source,score,reasons,hardReject:false};
}
function matchPlayback(target, candidates) {
  const seen=new Set();
  const scored=(candidates||[]).filter(c=>!seen.has(c.videoId)&&seen.add(c.videoId)).map(c=>scoreCandidate(target,c));
  const ranked=scored.filter(r=>!r.hardReject).sort((a,b)=>b.score-a.score);
  const winner=ranked[0], margin=winner ? winner.score-(ranked[1]?.score||0) : 0;
  const matched=winner&&winner.score>=90&&margin>=8;
  // During manual choice, show related versions too, without making them
  // eligible for automatic matching or letting them hide a safe winner.
  const items=matched?ranked:ranked.length?scored.filter(r=>!r.reasons.includes('invalid-source')&&!r.reasons.includes('not-song')&&workTitle(r.candidate.title)===workTitle(target.title)&&artists(target.artist).some(name=>artists(r.candidate.artist).includes(name))):[];
  return {status:matched?'matched':ranked.length?'choose':'not-found',provider:'YouTube Music',source:matched?winner.source:null,items:items.slice(0,8).map(r=>r.candidate)};
}
module.exports={normalize,scoreCandidate,matchPlayback};
