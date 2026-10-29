// 아이템 그림 다운로드: 본가(소드실드·스칼렛바이올렛) 가방 아이콘 160×160 PNG
//  출처: Serebii 아이템 도감 (https://www.serebii.net/itemdex/) · 저작권은 Nintendo/Creatures/GAME FREAK
//  data/items.js 의 art 이름으로 받아 public/assets/items/<아이템 id>.png 로 저장하고 manifest.json 의 items 에 적는다.
//  npm run fetch-items        (따로 실행: 기존 manifest 에 items 만 덧붙임)
//  npm run fetch-assets 도 마지막에 이 함수를 불러 같이 받는다.
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ITEMS, CONSUMABLES } from '../src/data/items.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
export const ITEM_ART = 'https://www.serebii.net/itemdex/sprites/sv';
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = f => stat(f).then(() => true, () => false);

// 받은 그림 목록 { 아이템 id: 'items/<id>.png' } 를 돌려준다. 이미 받은 파일은 건너뛴다 (force 면 다시 받음)
export async function fetchItemArt({ force = false } = {}) {
  const out = {}, miss = [];
  let got = 0;
  const all = Object.assign({}, ITEMS, CONSUMABLES);   // 장착 아이템 + 상처약 같은 소모품
  for (const [id, it] of Object.entries(all)) {
    const file = `items/${id}.png`, dest = path.join(ASSETS, file);
    if (!it.art) { miss.push(id); continue; }
    if (!force && await exists(dest)) { out[id] = file; continue; }
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch(`${ITEM_ART}/${it.art}.png`, { signal: ctrl.signal, headers: { 'User-Agent': 'pokecells-asset-fetcher' } });
        clearTimeout(timer);
        if (res.status === 404) break;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.subarray(0, 4).equals(PNG_SIG)) throw new Error('PNG 가 아님');   // 없는 그림은 HTML 오류 페이지가 올 수 있다
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, buf);
        ok = true; got++;
      } catch (err) {
        clearTimeout(timer);
        if (attempt === 3) console.warn(`  ! 아이템 그림 실패 (${err.message}): ${it.art}`);
        else await sleep(600 * attempt);
      }
    }
    if (ok) out[id] = file; else miss.push(id);
    await sleep(150);   // 사이트에 부담을 주지 않게 하나씩 천천히
  }
  console.log(`  아이템 그림 ${Object.keys(out).length} / ${Object.keys(all).length}개 (새로 받음 ${got}개 · Serebii)${miss.length ? ` · 없음: ${miss.join(', ')} (도트 아이콘으로 대신)` : ''}`);
  return out;
}

// 따로 실행: 기존 manifest.json 에 items 만 덧붙인다
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mf = path.join(ASSETS, 'manifest.json');
  const manifest = JSON.parse(await readFile(mf, 'utf8'));
  manifest.items = await fetchItemArt({ force: process.argv.includes('--force') });
  manifest.sources = Object.assign(manifest.sources || {}, { itemArt: ITEM_ART });
  await writeFile(mf, JSON.stringify(manifest, null, 2));
  console.log(`manifest: ${path.relative(ROOT, mf)}`);
}
