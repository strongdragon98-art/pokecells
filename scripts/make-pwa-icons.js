// 홈 화면 추가(PWA)용 아이콘 (npm run make-pwa-icons)
//  brand/pokecells-mark.png(512) → public/pwa/icon-512.png · icon-192.png · apple-touch-icon.png(180)
//  아이폰 홈 화면 아이콘은 투명한 곳을 검게 칠하므로 게임 배경색(#07060f) 위에 얹어 둔다.
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'brand', 'pokecells-mark.png');
const OUT = path.join(ROOT, 'public', 'pwa');

await mkdir(OUT, { recursive: true });
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  const pad = Math.round(size * .08);   // 둥근 모서리로 잘려도 마크가 남게 여백
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', SRC, '-filter_complex',
    `color=c=0x07060f:s=${size}x${size}[bg];[0]scale=${size - pad * 2}:${size - pad * 2}:flags=lanczos[m];[bg][m]overlay=${pad}:${pad}:format=auto,format=rgba`,
    '-frames:v', '1', path.join(OUT, name)]);
  console.log(`완료: public/pwa/${name} (${size}px)`);
}
