import { encode } from "uqr";

const SCALE = 8;
const BORDER = 4;

type DeflateStream = {
  readable: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } };
  writable: { getWriter(): { write(chunk: Uint8Array): Promise<void>; close(): Promise<void> } };
};

export async function qrPng(text: string): Promise<Uint8Array> {
  const qr = encode(text, { ecc: "M", border: BORDER });
  const size = qr.size * SCALE;
  const raw = new Uint8Array((size + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    const row = qr.data[Math.floor(y / SCALE)] ?? [];
    for (let x = 0; x < size; x += 1) {
      raw[offset] = row[Math.floor(x / SCALE)] ? 0 : 255;
      offset += 1;
    }
  }

  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, size);
  header.setUint32(4, size);
  ihdr[8] = 8;

  return concat([
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", await zlib(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const name = new TextEncoder().encode(type);
  const body = concat([name, data]);
  const out = new Uint8Array(4 + body.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(4 + body.length, crc32(body));
  return out;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function zlib(data: Uint8Array): Promise<Uint8Array> {
  const Stream = (globalThis as { CompressionStream?: new (format: "deflate") => DeflateStream }).CompressionStream;
  if (!Stream) return zlibStore(data);
  const stream = new Stream("deflate");
  const writer = stream.writable.getWriter();
  await writer.write(data);
  await writer.close();
  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    if (step.value) parts.push(step.value);
  }
  return concat(parts);
}

function zlibStore(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.from([0x78, 0x01])];
  let offset = 0;
  do {
    const end = Math.min(offset + 65535, data.length);
    const block = data.subarray(offset, end);
    const header = new Uint8Array(5);
    header[0] = end === data.length ? 1 : 0;
    header[1] = block.length & 0xff;
    header[2] = (block.length >> 8) & 0xff;
    const complement = block.length ^ 0xffff;
    header[3] = complement & 0xff;
    header[4] = (complement >> 8) & 0xff;
    parts.push(header, block);
    offset = end;
  } while (offset < data.length);
  const checksum = adler32(data);
  parts.push(Uint8Array.from([(checksum >>> 24) & 0xff, (checksum >>> 16) & 0xff, (checksum >>> 8) & 0xff, checksum & 0xff]));
  return concat(parts);
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
