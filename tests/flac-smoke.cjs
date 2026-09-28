const assert = require("node:assert/strict");
const { readAudioTags } = require("../dist/audio-tags.js");
const number = (value, little = false) => {
  const buffer = Buffer.alloc(4);
  if (little) buffer.writeUInt32LE(value); else buffer.writeUInt32BE(value);
  return buffer;
};
const string = (value, little = false) => {
  const data = Buffer.from(value);
  return Buffer.concat([number(data.length, little), data]);
};
const block = (type, data, last = false) => {
  const header = Buffer.alloc(4);
  header[0] = type | (last ? 128 : 0);
  header.writeUIntBE(data.length, 1, 3);
  return Buffer.concat([header, data]);
};
const front = Buffer.from([255, 216, 255, 42, 255, 217]);
const picture = (type, data) => Buffer.concat([
  number(type), string("image/jpeg"), string("Album cover"),
  number(600), number(600), number(24), number(0), number(data.length), data,
]);
const comments = Buffer.concat([
  string("Fixture vendor", true), number(2, true),
  string("TITLE=Música de teste", true), string("ARTIST=Artista", true),
]);
const file = Buffer.concat([
  Buffer.from("fLaC"), block(0, Buffer.alloc(34)), block(4, comments),
  block(6, picture(4, Buffer.from([1, 2]))), block(6, picture(3, front), true),
]);
const tags = readAudioTags(file);
assert.equal(tags.title, "Música de teste");
assert.equal(tags.artist, "Artista");
assert.equal(tags.picture.mime, "image/jpeg");
assert.deepEqual(Buffer.from(tags.picture.bytes), front);
const padded = Buffer.concat([Buffer.alloc(8), file]);
assert.equal(readAudioTags(padded.subarray(8)).title, tags.title);
assert.equal(readAudioTags(file.subarray(0, file.length - 1)).picture.bytes.length, 2);
const embeddedComment = Buffer.concat([string("", true), number(1, true), string("METADATA_BLOCK_PICTURE=" + picture(3, front).toString("base64"), true)]);
assert.deepEqual(Buffer.from(readAudioTags(Buffer.concat([Buffer.from("fLaC"), block(4, embeddedComment, true)])).picture.bytes), front);
assert.equal(readAudioTags(Buffer.concat([Buffer.from("fLaC"), block(6, Buffer.from([1]), true)])).picture, null);
console.log("FLAC: título/artista, capa frontal, picture em comentários e arquivos incompletos OK.");
