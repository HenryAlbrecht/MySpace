const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readAudioTags } = require("../dist/audio-tags.js");
const sync = (n) => Buffer.from([(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127]);
const picture = Buffer.from([255, 216, 255, 224, 42, 255, 217]);
function frame(id, payload, version = 3) {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(payload.length);
  return Buffer.concat([
    Buffer.from(id),
    version === 4 ? sync(payload.length) : size,
    Buffer.alloc(2),
    payload,
  ]);
}
function tag(frames, version = 3) {
  const body = Buffer.concat(frames);
  return Buffer.concat([Buffer.from([73, 68, 51, version, 0, 0]), sync(body.length), body]);
}
const text = (s) => Buffer.concat([Buffer.from([3]), Buffer.from(s)]);
const cover = (description = Buffer.from([0]), encoding = 0) =>
  Buffer.concat([
    Buffer.from([encoding]),
    Buffer.from("image/jpeg\0"),
    Buffer.from([3]),
    description,
    picture,
  ]);
for (const version of [3, 4])
  test(`ID3v2.${version}: lê título, artista e capa`, () => {
    const result = readAudioTags(
      tag(
        [
          frame("TIT2", text("Música de teste"), version),
          frame("TPE1", text("Artista"), version),
          frame("APIC", cover(), version),
        ],
        version,
      ),
    );
    assert.equal(result.title, "Música de teste");
    assert.equal(result.artist, "Artista");
    assert.equal(result.picture.mime, "image/jpeg");
    assert.deepEqual(Buffer.from(result.picture.bytes), picture);
  });
test("Descrição UTF-16 não entra nos bytes da imagem", () => {
  const description = Buffer.concat([
    Buffer.from([255, 254]),
    Buffer.from("capa", "utf16le"),
    Buffer.from([0, 0]),
  ]);
  const result = readAudioTags(tag([frame("APIC", cover(description, 1))]));
  assert.deepEqual(Buffer.from(result.picture.bytes), picture);
});
test("ID3v2.2 com quadro PIC", () => {
  const data = Buffer.concat([Buffer.from([0]), Buffer.from("JPG"), Buffer.from([3, 0]), picture]);
  const body = Buffer.concat([Buffer.from("PIC"), Buffer.from([0, 0, data.length]), data]);
  const result = readAudioTags(
    Buffer.concat([Buffer.from([73, 68, 51, 2, 0, 0]), sync(body.length), body]),
  );
  assert.deepEqual(Buffer.from(result.picture.bytes), picture);
});
test("Prefere a capa frontal a outras imagens", () => {
  const back = cover();
  back[12] = 4;
  const result = readAudioTags(tag([frame("APIC", back), frame("APIC", cover())]));
  assert.deepEqual(Buffer.from(result.picture.bytes), picture);
});
test("Arquivo sem tags e quadros truncados não quebram o player", () => {
  assert.equal(readAudioTags(Buffer.from("sem tags")).picture, null);
  const broken = tag([frame("APIC", cover())]);
  assert.equal(readAudioTags(broken.subarray(0, 25)).picture, null);
});
