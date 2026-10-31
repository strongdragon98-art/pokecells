// 스프라이트 메타 미리 계산 → public/assets/spritemeta.json
//  예전에는 부팅할 때 167종의 모션 시트 759장(압축을 풀면 약 774MB)을 한꺼번에 받아 몸 크기·발 위치를 재서,
//  아이폰(WebKit) 메모리 한도를 넘겨 첫 접속에 튕겼다. 이제 잰 값은 여기서 미리 계산해 두고,
//  게임은 이 JSON 하나만 받은 뒤 시트는 그 포켓몬이 필요할 때 불러온다 (systems/SpriteLoader.js 의 ensure)
//  에셋을 새로 받으면(npm run fetch-assets) 다시 만든다 — npm run build 전에 자동으로 돈다 (prebuild)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { NEEDED } from './lib/sheets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
const FALLBACK = { Idle: ['Walk'], Walk: ['Idle'], Attack: ['Strike', 'Shoot', 'Walk'], Strike: ['Attack', 'Shoot', 'Walk'], Shoot: ['Attack', 'Strike', 'Walk'], Hurt: ['Idle', 'Walk'] };

// AnimData.xml → { Walk: { fw, fh, durations, hit, source } } (CopyOf 는 원본으로) — SpriteLoader.parseAnimData 와 같은 결과
function parseAnimData(xml) {
  const out = {};
  for (const m of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const b = m[1], get = t => { const r = b.match(new RegExp(`<${t}>([^<]*)</${t}>`)); return r ? r[1].trim() : null; };
    const name = get('Name');
    if (!name) continue;
    out[name] = { name, copyOf: get('CopyOf'), fw: parseInt(get('FrameWidth') || '0', 10), fh: parseInt(get('FrameHeight') || '0', 10),
      durations: [...b.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(d => parseInt(d[1], 10) || 1), hit: get('HitFrame') !== null ? parseInt(get('HitFrame'), 10) : -1 };
  }
  for (const k of Object.keys(out)) {
    const a = out[k];
    if (a.copyOf && out[a.copyOf]) out[k] = { ...out[a.copyOf], name: k, source: out[a.copyOf].name };
    else a.source = k;
  }
  return out;
}

const pngSize = buf => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

// Walk(없으면 Idle) 오른쪽 첫 프레임의 불투명 영역 → 발 위치 · 몸통 크기 · 눈 위치 (SpriteLoader.measure 와 같은 계산)
function measure(png, d) {
  const rows = Math.max(1, Math.floor(png.height / d.fh)), row = rows >= 8 ? 2 : 0;
  const A = (x, y) => png.data[((row * d.fh + y) * png.width + x) * 4 + 3];
  let minX = d.fw, maxX = -1, minY = d.fh, maxY = -1;
  for (let y = 0; y < d.fh; y++) for (let x = 0; x < d.fw; x++) if (A(x, y) > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (maxX < 0) return { foot: d.fh / 4, w: d.fw / 2, h: d.fh / 2, eye: { dx: 4, dy: -d.fh / 3 } };
  const band = minY + Math.max(2, Math.round((maxY - minY) * .4));
  let frontX = minX, frontY = minY;
  for (let y = minY; y <= band; y++) for (let x = maxX; x >= minX; x--) if (A(x, y) > 40) { if (x > frontX) { frontX = x; frontY = y; } break; }
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const ex = frontX - Math.max(2, Math.round(w * .14)), ey = Math.min(frontY, minY + Math.round(h * .28)), footY = maxY + 1;
  return { foot: footY - d.fh / 2, w, h, eye: { dx: ex + .5 - d.fw / 2, dy: ey + .5 - footY } };
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(ASSETS, 'manifest.json'), 'utf8'));
  const out = {};
  let n = 0;
  for (const [key, e] of Object.entries(manifest.pokemon)) {
    if (!e.animData) continue;
    let xml;
    try { xml = await readFile(path.join(ASSETS, e.animData), 'utf8'); } catch { continue; }
    const parsed = parseAnimData(xml), anims = {}, files = {};
    for (const anim of NEEDED) {
      const d = parsed[anim];
      if (!d || !d.fw) continue;
      const file = e.anims[d.source] || e.anims[anim];
      if (!file) continue;
      let buf;
      try { buf = await readFile(path.join(ASSETS, file)); } catch { continue; }
      const [W] = pngSize(buf);
      files[d.source] = file;
      anims[anim] = { fw: d.fw, fh: d.fh, durations: d.durations.slice(0, Math.max(1, Math.floor(W / d.fw))), hit: d.hit, source: d.source };
    }
    // 빠진 모션은 비슷한 모션으로 (SpriteLoader.resolve 의 FALLBACK)
    for (const anim of NEEDED) if (!anims[anim]) for (const c of FALLBACK[anim]) if (anims[c]) { anims[anim] = { ...anims[c] }; break; }
    const base = anims.Walk || anims.Idle;
    if (!base) continue;
    const png = PNG.sync.read(await readFile(path.join(ASSETS, files[base.source])));
    out[key] = { anims, files, measured: measure(png, base) };
    n++;
  }
  await writeFile(path.join(ASSETS, 'spritemeta.json'), JSON.stringify(out));
  console.log(`spritemeta.json: ${n}종`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
