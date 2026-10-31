// 배포본(dist) 스프라이트 시트를 쓰는 방향(오른쪽·왼쪽 2행)만 남기고 잘라 팔레트 PNG 로 다시 저장한다
//  횡스크롤이라 8방향 중 2행만 쓴다 → 시트 한 장의 메모리가 1/4 로 (아이폰 첫 접속 크래시 방지)
//  게임(SpriteLoader)은 8행 원본과 2행 시트를 모두 읽는다 (rowFor). 개발 서버는 원본 그대로 쓴다
//  npm run build 뒤에 자동으로 돈다 (postbuild)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cropRows } from './lib/sheets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'assets');

async function main() {
  const meta = JSON.parse(await readFile(path.join(DIST, 'spritemeta.json'), 'utf8'));
  const done = new Set();
  let before = 0, after = 0;
  for (const e of Object.values(meta)) {
    for (const a of Object.values(e.anims)) {
      const file = e.files[a.source];
      if (!file || done.has(file)) continue;
      done.add(file);
      const p = path.join(DIST, file);
      let buf;
      try { buf = await readFile(p); } catch { continue; }
      const out = cropRows(buf, a.fh);
      before += buf.length; after += out.length;
      if (out !== buf) await writeFile(p, out);
    }
  }
  console.log(`배포본 시트 ${done.size}장 자름: ${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
