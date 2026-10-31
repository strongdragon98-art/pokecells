// 스프라이트 시트 PNG 공용 도구 (단일 HTML 빌드 · 배포본 시트 자르기 · 스프라이트 메타 생성)
import zlib from 'node:zlib';
import { PNG } from 'pngjs';

export const NEEDED = ['Idle', 'Walk', 'Attack', 'Strike', 'Shoot', 'Hurt'];
export const KEEP_ROWS = [2, 6];                              // 8방향 중 오른쪽, 왼쪽

// AnimData.xml 에서 필요한 모션(+CopyOf 원본)만 남긴다
export function trimXml(xml) {
  const blocks = [...xml.matchAll(/<Anim>[\s\S]*?<\/Anim>/g)].map(m => m[0]);
  const info = blocks.map(b => ({ b, name: (b.match(/<Name>(.*?)<\/Name>/) || [])[1], copy: (b.match(/<CopyOf>(.*?)<\/CopyOf>/) || [])[1] }));
  const keep = new Set(NEEDED);
  for (const i of info) if (keep.has(i.name) && i.copy) keep.add(i.copy);
  const anims = {};
  for (const i of info) {
    if (!keep.has(i.name)) continue;
    anims[i.name] = { fh: +((i.b.match(/<FrameHeight>(\d+)/) || [])[1] || 0), copy: i.copy };
  }
  const out = info.filter(i => keep.has(i.name)).map(i => i.b.replace(/>\s+</g, '><').trim()).join('');
  return { xml: `<AnimData><Anims>${out}</Anims></AnimData>`, anims };
}

// 도트 스프라이트는 색 수가 적으므로 팔레트(인덱스) PNG 로 저장해 크기를 줄인다
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
export function encodeIndexed(img) {
  const { width: w, height: h, data } = img;
  const index = new Map(), pal = [];
  const px = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3];
    const key = a === 0 ? 0 : ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | a) >>> 0;   // 완전 투명은 한 색으로
    let idx = index.get(key);
    if (idx === undefined) { if (pal.length >= 256) return null; idx = pal.length; index.set(key, idx); pal.push(a === 0 ? [0, 0, 0, 0] : [data[i], data[i + 1], data[i + 2], a]); }
    px[p] = idx;
  }
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; raw.set(px.subarray(y * w, y * w + w), y * (w + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', Buffer.from(pal.flatMap(c => c.slice(0, 3)))),
    pngChunk('tRNS', Buffer.from(pal.map(c => c[3]))),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

export function cropRows(buf, fh) {
  const src = PNG.sync.read(buf);
  const rows = fh ? Math.floor(src.height / fh) : 1;
  let img = src;
  if (rows >= 8) {
    img = new PNG({ width: src.width, height: fh * KEEP_ROWS.length });
    KEEP_ROWS.forEach((r, i) => PNG.bitblt(src, img, 0, r * fh, src.width, fh, 0, i * fh));
  }
  const indexed = encodeIndexed(img);
  const rgba = indexed ? null : PNG.sync.write(img, { deflateLevel: 9 });
  const out = indexed || rgba;
  return out.length < buf.length || rows >= 8 ? out : buf;
}

