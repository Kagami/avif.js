// Convert raw pixel data to BMP.
// Based on canvas-to-bmp ((c) 2015 Ken "Epistemex" Fyrstenberg, MIT).
export function rgba2bmp(ab, w, h) {
  function setU16(v) {view.setUint16(pos, v, true); pos += 2;}
  function setU32(v) {view.setUint32(pos, v, true); pos += 4;}

  const headerSize = 54;                             // 14 + 40 bytes
  const stride = Math.floor((24 * w + 31) / 32) * 4; // row length incl. padding
  const pixelArraySize = stride * h;                 // total bitmap size
  const fileLength = headerSize + pixelArraySize;    // header size is known + bitmap
  const file = new ArrayBuffer(fileLength);          // raw byte buffer (returned)
  const view = new DataView(file);                   // handle endian, reg. width etc.
  const data32 = new Uint32Array(ab);                // 32-bit representation of canvas
  const w3 = w * 3;
  let pos32 = 0;
  let pos = 0;
  let y = 0;

  // BMP header.
  setU16(0x4d42);         // BM
  setU32(fileLength);     // total length
  pos += 4;               // skip unused fields
  setU32(headerSize);     // offset to pixels

  // DIB header.
  setU32(40);             // DIB header size
  setU32(w);              // width
  setU32(-h >>> 0);       // negative = top-to-bottom
  setU16(1);              // 1 plane
  setU16(24);             // 24-bit (RGB)
  setU32(0);              // no compression (BI_RGB)
  setU32(pixelArraySize); // bitmap size incl. padding (stride x height)
  setU32(2835);           // pixels/meter h (~72 DPI x 39.3701 inch/m)
  setU32(2835);           // pixels/meter v

  // Bitmap data, change order from ABGR to BGR.
  while (y < h) {
    const shift = headerSize + y * stride;
    let x = 0;
    while (x < w3) {
      const abgr = data32[pos32++];
      const bg = (abgr >> 8) & 0xffff;
      const r = abgr & 0xff;
      view.setUint16(shift + x, bg);
      view.setUint8(shift + x + 2, r);
      x += 3;
    }
    y++;
  }

  return file;
}
