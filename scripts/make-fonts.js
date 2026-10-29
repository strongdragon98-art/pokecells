// UI 글꼴 준비: 프리텐다드(한글 고딕, OFL)·Cinzel(제목용 로마자, OFL) 원본을
// 자주 쓰는 한글 2,350자(KS X 1001) + 영문·숫자·기호만 남긴 woff2 로 줄인다.
// 사용법: node scripts/make-fonts.js  (원본은 임시 폴더에 받아 쓰고, 결과 woff2 만 src/fonts/ui 에 둔다)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const DIR = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'src', 'fonts', 'ui');
const CACHE = path.join(os.tmpdir(), 'pokecells-fonts');
const SOURCES = {
  'Pretendard-Regular.otf': 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Regular.otf',
  'Pretendard-SemiBold.otf': 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-SemiBold.otf',
  'Cinzel-VF.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf'
};
const kb = n => `${(n / 1024).toFixed(0)}KB`;

async function source(name) {
  const file = path.join(CACHE, name);
  if (!existsSync(file)) {
    await mkdir(CACHE, { recursive: true });
    const res = await fetch(SOURCES[name]);
    if (!res.ok) throw new Error(`${name} 다운로드 실패: ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFile(file);
}

let chars = '';
for (let c = 32; c < 127; c++) chars += String.fromCharCode(c);
chars += '…·•→←↑↓▶◀★☆✓✕×「」『』〈〉《》（）〔〕–—‘’“”%·∙ⅠⅡⅢ';
const dec = new TextDecoder('euc-kr');
for (let hi = 0xb0; hi <= 0xc8; hi++) for (let lo = 0xa1; lo <= 0xfe; lo++) chars += dec.decode(new Uint8Array([hi, lo]));   // 완성형 한글 2,350자
for (let c = 0x3131; c <= 0x318e; c++) chars += String.fromCharCode(c);                                                      // 한글 자모

const JOBS = [
  ['Pretendard-Regular.otf', 'Pretendard-Regular.woff2', chars],
  ['Pretendard-SemiBold.otf', 'Pretendard-SemiBold.woff2', chars],
  ['Cinzel-VF.ttf', 'Cinzel.woff2', chars.slice(0, 95) + '…·']
];
for (const [src, out, set] of JOBS) {
  const buf = await source(src);
  const sub = await subsetFont(buf, set, { targetFormat: 'woff2' });
  await writeFile(path.join(DIR, out), sub);
  console.log(`${src} ${kb(buf.length)} → ${out} ${kb(sub.length)}`);
}
