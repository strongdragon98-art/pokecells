// 컷신 영상 준비: assets-src/cutscene 의 원본(1280x720, 약 4~5MB)을 자르고 가볍게 다시 인코딩해 public/assets/video 에 둔다.
//  eternatus.mp4  — 무한다이노 등장 (원본 10초 전체)
//  bond.mp4       — 레드가 유대의 불꽃을 나눠 주는 장면까지만 (원본 0~5.0초, 이후 포켓몬이 반응하는 부분은 쓰지 않음)
// 사용법: node scripts/make-videos.js   (ffmpeg 는 개발 의존성 ffmpeg-static 의 실행 파일을 쓴다)
import { spawnSync } from 'node:child_process';
import { statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets-src', 'cutscene'), OUT = path.join(ROOT, 'public', 'assets', 'video');
const CLIPS = [
  { src: 'eternatus.mp4', out: 'eternatus.mp4', start: 0, dur: 10 },
  { src: 'bond-flame.mp4', out: 'bond.mp4', start: 0, dur: 5.0 }
];
const kb = n => `${(n / 1024).toFixed(0)}KB`;

mkdirSync(OUT, { recursive: true });
for (const c of CLIPS) {
  const src = path.join(SRC, c.src), out = path.join(OUT, c.out), fadeAt = Math.max(0, c.dur - .35).toFixed(2);
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(c.start), '-t', String(c.dur), '-i', src,
    '-vf', 'scale=1280:720:flags=lanczos,fps=24', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-maxrate', '1500k', '-bufsize', '3000k',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '80k', '-ac', '2', '-af', `afade=t=out:st=${fadeAt}:d=0.35`, out];
  const r = spawnSync(ffmpeg, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${c.src} 인코딩 실패`);
  console.log(`${c.src} ${kb(statSync(src).size)} → ${c.out} ${kb(statSync(out).size)} (${c.dur}초)`);
}
