/* Music rows share catalog navigation and the existing playlist controller. */
(() => {
  const node=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
  const plainText = (value) => String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|li)>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[entity])
    .replace(/&#(\d+);/g, (_, code) => Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : "")
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
    .trim().slice(0, 30000);
  const clock=value=>Number.isFinite(value)&&value>0?Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0'):'';
  function tagLink(value) {const a=node('a',plainText(value),'music-tag-link');a.href='#tag/'+encodeURIComponent(value.trim());return a;}
  function contextLink(value,kind,id) {if(!id||!MusicModel.validCatalogId(kind,id))return node('span',value);const a=node('a',value);a.href='#titulo/'+kind+'/'+encodeURIComponent(id);a.onclick=e=>{e.preventDefault();TitlePages.open({kind,catalogId:id,title:value,source:id.startsWith('ytmusic:')?'YouTube Music':'iTunes'});};return a;}
  function trackRow(item,index,{artwork=true,context=true}={}) {
    const row=node('li','','music-track-row'),number=node('span',String(index+1).padStart(2,'0'),'music-track-number');
    const link=node('a','','music-track-main');
    if(item.catalogId){link.href='#titulo/music/'+encodeURIComponent(item.catalogId);link.onclick=e=>{e.preventDefault();TitlePages.open(item);};}
    else link.removeAttribute('href');
    if(artwork){const img=node('img');img.alt='';Artwork.set(img,item.image);link.append(img);}
    link.append(node('span',item.title,'music-track-title'));row.append(number,link);
    if(context)row.append(node('small',[item.artist,item.albumTitle].filter(Boolean).join(' · '),'music-track-context'));
    const duration=clock(item.trackDuration);if(duration)row.append(node('span',duration,'music-track-duration'));
    if(item.playbackSource)row.append(MusicBridge.playlistButton(item));
    return row;
  }
  function tracklist(items,options) {const list=node('ol','','music-tracklist');items.forEach((item,index)=>list.append(trackRow(item,index,options)));return list;}
  window.MusicPageUI={plainText,tagLink,contextLink,trackRow,tracklist,clock};
})();
