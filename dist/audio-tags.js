/* Leitura local de tags ID3 e metadados FLAC. Não envia arquivos. */
(function (root) {
  const decodeFlacText = (data) => new TextDecoder("utf-8").decode(data);

  function parseFlacPicture(data, result) {
    const pictureView = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let cursor = 0;

    const readUint32 = () => {
      if (cursor + 4 > data.length) {
        throw Error("Truncated FLAC picture");
      }
      const value = pictureView.getUint32(cursor);
      cursor += 4;
      return value;
    };

    const readBytes = (length) => {
      if (cursor + length > data.length) {
        throw Error("Truncated FLAC picture");
      }
      const value = data.subarray(cursor, cursor + length);
      cursor += length;
      return value;
    };

    try {
      const pictureType = readUint32();
      const mimeType = decodeFlacText(readBytes(readUint32())).toLowerCase();
      readBytes(readUint32()); // Description precedes the four image properties.
      for (let i = 0; i < 4; i++) {
        readUint32(); // Width, height, depth and palette size.
      }

      const imageLength = readUint32();
      if (!imageLength || imageLength > 5 * 1024 * 1024) {
        return;
      }
      const image = readBytes(imageLength);
      const supportedMime = ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
      if (supportedMime && (!result.picture || pictureType === 3)) {
        result.picture = { mime: mimeType, bytes: image };
      }
    } catch {
      // Um bloco inválido não impede a leitura dos demais.
    }
  }

  function readFlacComments(bytes, view, offset, end, result) {
    let cursor = offset;
    const readUint32LE = () => {
      if (cursor + 4 > end) {
        throw Error("Truncated FLAC comment");
      }
      const value = view.getUint32(cursor, true);
      cursor += 4;
      return value;
    };

    try {
      const vendorLength = readUint32LE();
      cursor += vendorLength;
      const commentCount = readUint32LE();
      for (let i = 0; i < Math.min(commentCount, 10000); i++) {
        const commentLength = readUint32LE();
        if (cursor + commentLength > end) {
          break;
        }
        const comment = decodeFlacText(bytes.subarray(cursor, cursor + commentLength));
        cursor += commentLength;
        const separator = comment.indexOf("=");
        const key = comment.slice(0, separator).toUpperCase();
        const value = comment.slice(separator + 1).trim();

        if (key === "TITLE") {
          result.title = value;
        }
        if (key === "ARTIST") {
          result.artist = value;
        }
        if (
          key === "METADATA_BLOCK_PICTURE" &&
          value.length <= 8 * 1024 * 1024 &&
          typeof root.atob === "function"
        ) {
          try {
            const pictureBytes = Uint8Array.from(root.atob(value), (character) => character.charCodeAt(0));
            parseFlacPicture(pictureBytes, result);
          } catch {}
        }
      }
    } catch {
      // Comentários incompletos são ignorados.
    }
  }

  function readFlacTags(bytes) {
    const result = { title: "", artist: "", picture: null };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 4;
    while (offset + 4 <= bytes.length) {
      const last = !!(bytes[offset] & 128);
      const blockType = bytes[offset] & 127;
      const blockLength = bytes[offset + 1] * 65536 + bytes[offset + 2] * 256 + bytes[offset + 3];
      offset += 4;
      if (offset + blockLength > bytes.length) {
        break;
      }
      const end = offset + blockLength;
      if (blockType === 6) {
        parseFlacPicture(bytes.subarray(offset, end), result);
      }
      if (blockType === 4 && blockLength >= 8) {
        readFlacComments(bytes, view, offset, end, result);
      }
      offset = end;
      if (last) {
        break;
      }
    }
    return result;
  }
  function readAudioTags(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const result = { title: "", artist: "", picture: null };
    const ascii = (data) => String.fromCharCode(...data);
    if (bytes.length >= 4 && ascii(bytes.subarray(0, 4)) === "fLaC") return readFlacTags(bytes);
    const sync = (offset) =>
      (bytes[offset] & 127) * 2097152 +
      (bytes[offset + 1] & 127) * 16384 +
      (bytes[offset + 2] & 127) * 128 +
      (bytes[offset + 3] & 127);
    const uint = (data, offset) =>
      data[offset] * 16777216 +
      data[offset + 1] * 65536 +
      data[offset + 2] * 256 +
      data[offset + 3];
    if (bytes.length < 10 || ascii(bytes.subarray(0, 3)) !== "ID3")
      return result;
    const version = bytes[3];
    if (![2, 3, 4].includes(version)) return result;
    let body = bytes.subarray(10, Math.min(bytes.length, 10 + sync(6)));
    const deunsync = (data) => {
      const output = [];
      for (let i = 0; i < data.length; i++) {
        output.push(data[i]);
        if (data[i] === 255 && data[i + 1] === 0) i++;
      }
      return new Uint8Array(output);
    };
    if (bytes[5] & 128 && version < 4) body = deunsync(body);
    let offset = 0;
    if (bytes[5] & 64) {
      if (version === 2 || body.length < 4) return result;
      const n =
        version === 4
          ? (body[0] & 127) * 2097152 +
            (body[1] & 127) * 16384 +
            (body[2] & 127) * 128 +
            (body[3] & 127)
          : uint(body, 0) + 4;
      if (n < 4 || n > body.length) return result;
      offset = n;
    }
    const decoder = (data, encoding) => {
      try {
        return new TextDecoder(
          encoding === 0
            ? "windows-1252"
            : encoding === 3
              ? "utf-8"
              : encoding === 2
                ? "utf-16be"
                : data[0] === 254 && data[1] === 255
                  ? "utf-16be"
                  : "utf-16le",
        )
          .decode(data)
          .replace(/\u0000.*$/s, "")
          .replace(/^\uFEFF/, "")
          .trim();
      } catch {
        return "";
      }
    };
    while (offset + (version === 2 ? 6 : 10) <= body.length) {
      const short = version === 2,
        header = short ? 6 : 10,
        id = ascii(body.subarray(offset, offset + (short ? 3 : 4)));
      if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
      const size = short
        ? body[offset + 3] * 65536 + body[offset + 4] * 256 + body[offset + 5]
        : version === 4
          ? (body[offset + 4] & 127) * 2097152 +
            (body[offset + 5] & 127) * 16384 +
            (body[offset + 6] & 127) * 128 +
            (body[offset + 7] & 127)
          : uint(body, offset + 4);
      if (!size || offset + header + size > body.length) break;
      const flags = short ? 0 : body[offset + 9];
      let data = body.subarray(offset + header, offset + header + size);
      offset += header + size;
      if ((version === 3 && flags & 192) || (version === 4 && flags & 12))
        continue;
      if (version === 3 && flags & 32) data = data.subarray(1);
      if (version === 4) {
        if (bytes[5] & 128 || flags & 2) data = deunsync(data);
        if (flags & 64) data = data.subarray(1);
        if (flags & 1) data = data.subarray(4);
      }
      if (!data.length) continue;
      if (id === "TIT2" || id === "TT2")
        result.title = decoder(data.subarray(1), data[0]);
      if (id === "TPE1" || id === "TP1")
        result.artist = decoder(data.subarray(1), data[0]);
      if (id === "APIC" || id === "PIC") {
        const encoding = data[0];
        let cursor = 1,
          mime;
        if (id === "PIC") {
          mime = ascii(data.subarray(1, 4));
          mime =
            mime === "PNG" ? "image/png" : mime === "JPG" ? "image/jpeg" : "";
          cursor = 4;
        } else {
          const end = data.indexOf(0, cursor);
          if (end < 0) continue;
          mime = ascii(data.subarray(cursor, end)).toLowerCase();
          cursor = end + 1;
        }
        const type = data[cursor++];
        if (cursor >= data.length) continue;
        if (encoding === 1 || encoding === 2) {
          while (
            cursor + 1 < data.length &&
            (data[cursor] !== 0 || data[cursor + 1] !== 0)
          )
            cursor += 2;
          cursor += 2;
        } else {
          const end = data.indexOf(0, cursor);
          if (end < 0) continue;
          cursor = end + 1;
        }
        const picture = data.subarray(cursor);
        if (
          picture.length &&
          picture.length <= 5 * 1024 * 1024 &&
          ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
            mime,
          ) &&
          (!result.picture || type === 3)
        )
          result.picture = {
            mime: mime === "image/jpg" ? "image/jpeg" : mime,
            bytes: picture,
          };
      }
    }
    return result;
  }
  root.readAudioTags = readAudioTags;
  if (typeof module !== "undefined") module.exports = { readAudioTags };
})(typeof window === "undefined" ? globalThis : window);
