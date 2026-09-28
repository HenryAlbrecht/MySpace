const assert = require('node:assert/strict');
const { parse } = require('../dist/media-embeds.js');
assert.equal(parse('https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=123').src, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
assert.equal(parse('https://open.spotify.com/intl-pt/album/4uLU6hMCjMI75M1A2tKUQC?si=123').provider, 'spotify');
assert.equal(parse('https://youtube.com/playlist?list=PLabcdefghijk12345').provider, 'youtube');
for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://open.spotify.com/artist/4uLU6hMCjMI75M1A2tKUQC', 'https://youtu.be/nope', 'invalid']) assert.equal(parse(url), null);
console.log('Media embeds: normalization and rejected URLs OK.');
