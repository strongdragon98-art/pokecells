// itch.io(HTML 게임) · 아이폰 홈 화면 추가용 업로드 ZIP (npm run package:itch)
//  1) vite build → dist/  (vite.config.js 의 base './' 라 itch.io·GitHub Pages 의 하위 경로에서도 이미지·영상·글꼴 경로가 안 깨진다)
//  2) dist/ 안의 파일을 그대로(최상위에 index.html) pokecells-itch-mobile.zip 으로 묶는다
//  itch.io 제한(파일 1000개 · 파일 하나 200MB)을 넘지 않는지도 확인한다.
import { readFile, writeFile, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { makeZip } from './lib/zip.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'pokecells-itch-mobile.zip');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}

await rm(DIST, { recursive: true, force: true });
await build({ root: ROOT, logLevel: 'warn' });
const files = (await walk(DIST)).sort();
if (!files.some(f => path.relative(DIST, f) === 'index.html')) throw new Error('dist/index.html 이 없습니다');
if (files.length > 1000) throw new Error(`파일이 ${files.length}개 — itch.io 는 1000개까지`);
const entries = [];
let raw = 0;
for (const f of files) {
  const data = await readFile(f);
  if (data.length > 200 * 1024 * 1024) throw new Error(`${f} 가 200MB 를 넘습니다`);
  raw += data.length;
  entries.push({ name: path.relative(DIST, f).split(path.sep).join('/'), data });
}
await writeFile(OUT, makeZip(entries));
const mb = n => (n / 1024 / 1024).toFixed(1);
console.log(`완료: ${path.basename(OUT)} — 파일 ${files.length}개 · 원본 ${mb(raw)}MB → 압축 ${mb((await stat(OUT)).size)}MB`);
console.log('itch.io: Kind of project = HTML → 이 ZIP 업로드 → "This file will be played in the browser" 체크 → Embed options 에서 Mobile friendly(Landscape) · Fullscreen button 켜기');
