(function() {

// ISOBMFF constants.
const BOX_HEADER_SIZE = 8;
const BOX_FTYP = 0x66747970;
const BOX_META = 0x6d657461;
const BOX_ILOC = 0x696c6f63;

// MOV container stub with single video track.
const MOV_HEADER = (function() {
  const b64 = "AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAettb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAKgABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAABd3RyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAKgAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAHgAAABDgAAAAAARNtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAF3AAAAD6VXEAAAAAADrbWluZgAAAONzdGJsAAAAf3N0c2QAAAAAAAAAAQAAAG9hdjAxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAB4AEOABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAGWF2MUOBCAwACgsAAABCq7/Dd//mAQAAABhzdHRzAAAAAAAAAAEAAAABAAAD6QAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAAAAAAAAAQAAABRzdGNvAAAAAAAAAAEAAAIPAAAAAG1kYXQ=";
  const str = atob(b64);
  const len = str.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8[i] = str.charCodeAt(i);
  }
  return u8;
})();
const MOV_HEADER_SIZE = MOV_HEADER.byteLength;
const MOV_STSZ_OFFSET = 479;
const MOV_MDAT_OFFSET = 519;

// Pending fetch events.
const taskById = {};
let taskCounter = 0;

function assert(cond, str) {
  if (!cond) throw new Error(str);
}

// Convert raw pixel data to BMP.
// Based on canvas-to-bmp ((c) 2015 Ken "Epistemex" Fyrstenberg, MIT).
function rgba2bmp(ab, w, h) {
  // helper methods to move current buffer position
  function setU16(v) {view.setUint16(pos, v, true); pos += 2;}
  function setU32(v) {view.setUint32(pos, v, true); pos += 4;}

  const headerSize = 54;                             // 14 + 40 bytes
  const stride = Math.floor((32 * w + 31) / 32) * 3; // row length incl. padding
  const pixelArraySize = stride * h;                 // total bitmap size
  const fileLength = headerSize + pixelArraySize;    // header size is known + bitmap
  const file = new ArrayBuffer(fileLength);          // raw byte buffer (returned)
  const view = new DataView(file);                   // handle endian, reg. width etc.
  const data32 = new Uint32Array(ab);                // 32-bit representation of canvas
  const w3 = w * 3;
  let pos32 = 0;
  let pos = 0;
  let y = 0;

  // write file header
  setU16(0x4d42);         // BM
  setU32(fileLength);     // total length
  pos += 4;               // skip unused fields
  setU32(headerSize);     // offset to pixels

  // DIB header
  setU32(40);             // DIB header size
  setU32(w);              // width
  setU32(-h >>> 0);       // negative = top-to-bottom
  setU16(1);              // 1 plane
  setU16(24);             // 24-bit (RGB)
  setU32(0);              // no compression (BI_RGB)
  setU32(pixelArraySize); // bitmap size incl. padding (stride x height)
  setU32(2835);           // pixels/meter h (~72 DPI x 39.3701 inch/m)
  setU32(2835);           // pixels/meter v

  // bitmap data, change order of ABGR to BGR
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

// Extract OBU.
function avif2obu(ab) {
  function getU8() {const v = view.getUint8(pos); pos += 1; return v;}
  function getU16() {const v = view.getUint16(pos); pos += 2; return v;}
  function getU32() {const v = view.getUint32(pos); pos += 4; return v;}

  const view = new DataView(ab);
  const len = ab.byteLength;
  let brandsCheck = false;
  let pos = 0;

  while (pos < len) {
    const size = getU32();
    const type = getU32();
    const end = pos + size - BOX_HEADER_SIZE;
    assert(size >= BOX_HEADER_SIZE, "corrupted file");

    switch (type) {
    case BOX_FTYP:
      // FIXME(Kagami): Check brands.
      // TODO(Kagami): Also check that meta/hdlr.handler = "pict".
      brandsCheck = true;
      break;
    case BOX_META:
      pos += 1; // version
      pos += 3; // flags
      continue;
    case BOX_ILOC:
      assert(brandsCheck, "brands not found");
      pos += 1; // version
      pos += 3; // flags
      const offsetSizeAndLengthSize = getU8();
      const offsetSize = offsetSizeAndLengthSize >>> 4;
      assert(offsetSize < 8, "unsupported offset size");
      const lengthSize = offsetSizeAndLengthSize & 0xf;
      assert(lengthSize < 8, "unsupported length size");
      const baseOffsetSize = getU8() >>> 4;
      assert(baseOffsetSize < 8, "unsupported base offset size");
      const itemCount = getU16();
      assert(itemCount >= 1, "bad iloc items number");
      // XXX(Kagami): Choosing first item for simplicity.
      // TODO(Kagami): Use primary item (meta/pitm/item_ID).
      // TODO(Kagami): Also check that meta/iinf/infe[i].item_type = "av01".
      pos += 2; // item_ID
      pos += 2; // data_reference_index
      const baseOffset = baseOffsetSize === 4 ? getU32() : 0;
      pos += 2; // extent_count (>= 1)
      // XXX(Kagami): What should we do if extent_count > 1?
      const extentOffset = offsetSize === 4 ? getU32() : 0;
      const extentLength = lengthSize === 4 ? getU32() : 0;
      const u8 = new Uint8Array(ab);
      const offset = baseOffset + extentOffset;
      return u8.subarray(offset, offset + extentLength);
    }

    pos = end;
  }

  throw new Error("picture not found");
}

// Embed OBU into MOV container stub as video frame.
function obu2mov(obu) {
  const fileSize = MOV_HEADER_SIZE + obu.byteLength;
  const ab = new ArrayBuffer(fileSize);
  const view = new DataView(ab);
  const u8 = new Uint8Array(ab);
  u8.set(MOV_HEADER);
  u8.set(obu, MOV_HEADER_SIZE);
  // |....|stsz|.|...|xxxx|
  view.setUint32(MOV_STSZ_OFFSET + BOX_HEADER_SIZE + 4, obu.byteLength);
  // |xxxx|mdat|
  view.setUint32(MOV_MDAT_OFFSET, obu.byteLength + BOX_HEADER_SIZE);
  // FIXME(Kagami): Fix width, height, av1C metadata.
  return ab;
}

// Remux AVIF picture as MOV video with single frame.
function avif2mov(ab) {
  return obu2mov(avif2obu(ab));
}

// Do preparation work and pass job request to the DOM context.
// TODO(Kagami): Cache by URL?
function decodeAvif(id, req, client) {
  // TODO(Kagami): Apply request headers?
  return fetch(req.url, {credentials: "same-origin"})
    .then(res => res.arrayBuffer())
    .then(avifArr => {
      const movArr = avif2mov(avifArr);
      client.postMessage({id, type: "avif-mov", data: movArr}, [movArr]);
    });
}

// Handle job responses.
self.addEventListener("message", e => {
  const msg = e.data;
  if (msg && msg.type === "avif-rgba") {
    const bmpArr = rgba2bmp(msg.data, msg.width, msg.height);
    const blob = new Blob([bmpArr], {type: "image/bmp"});
    // TODO(Kagami): Apply response metadata?
    const res = new Response(blob);
    taskById[msg.id].resolve(res);
  } else if (msg && msg.type === "avif-error") {
    taskById[msg.id].reject(new Error(msg.data));
  }
});

// Handle AVIF requests.
// TODO(Kagami): Timeout for fetching/handling.
self.addEventListener("fetch", e => {
  if (!e.clientId) return;
  // TODO(Kagami): Better check for AVIF. HTTP headers?
  if (e.request.url.match(/\.avif$/i)) {
    const id = taskCounter++;
    // TODO(Kagami): What should we do in case of error?
    e.respondWith(new Promise((resolve, reject) => {
      taskById[id] = {resolve, reject};
      clients.get(e.clientId)
        .then(client => decodeAvif(id, e.request, client))
        .catch(reject);
    }).then(res => {
      delete taskById[id];
      return res;
    }, err => {
      delete taskById[id];
      throw err;
    }));
  }
});

// IIFE
})();
