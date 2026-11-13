// Removes every APPn (EXIF/GPS, XMP, IPTC...) and COM segment from a JPEG. Returns null if the bytes are not a well-formed JPEG.
function stripJpegMetadata(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xda) {
      parts.push(buf.subarray(i));
      return Buffer.concat(parts);
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return null;
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}

function decodeJpegDataUrl(dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  return m ? stripJpegMetadata(Buffer.from(m[1], 'base64')) : null;
}

module.exports = { stripJpegMetadata, decodeJpegDataUrl };
