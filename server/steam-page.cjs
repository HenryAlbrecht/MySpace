/* Optional store-page fields absent from appdetails. Failure means unknown. */
const text = value => String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function parseStorePage(html, currentId) {
  const drmBox = String(html).match(/<div[^>]*class="[^"]*DRM_notice[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const drm = drmBox ? text(drmBox[1]).slice(0, 1000) : '';
  const block = String(html).match(/id="recommended_block"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*clear/i)?.[1] || '';
  const relatedIds = [...new Set([...block.matchAll(/(?:\/app\/|data-ds-appid=")([1-9]\d{0,9})/g)].map(match => match[1]))].filter(id => id !== String(currentId)).slice(0, 8);
  const tagIds = String(html).match(/data-ds-tagids="(\[[0-9, ]+\])"/)?.[1];
  return { drm_notice: drm, related_ids: relatedIds, tag_ids: tagIds ? JSON.parse(tagIds).slice(0, 3).map(String) : [] };
}
module.exports = { parseStorePage };
