// 컷신 영상 준비: assets-src/cutscene 의 원본(1280x720, 약 4~5MB)을 자르고 가볍게 다시 인코딩해 public/assets/video 에 둔다.
//  eternatus.mp4  — 무한다이노 등장 (원본 10초 전체 · 목소리·자막 없이 효과음만)
//  bond.mp4       — 레드가 유대의 불꽃을 나눠 주고 어둠의 사슬에 끌려가는 장면 → 「PokeCell.」 (원본 10초 전체)
//  두 원본 모두 오른쪽 아래에 Gemini 별(✦) 로고가 있어, watermark-mask.png(별 모양만 흰색)로 그 자리를 주변 색으로 메운다 (ffmpeg removelogo)
//   마스크는 무한다이노 원본 0.5초(어두운 구름) 화면에서 밝은 별 모양을 따고 3px 넓혔다. 영상 안의 보이지 않는 AI 생성 표시(SynthID)는 그대로 남는다
// 사용법: node scripts/make-videos.js [eternatus|bond ...]   (이름을 주면 그 영상만 · ffmpeg 는 개발 의존성 ffmpeg-static 의 실행 파일을 쓴다)
import { spawnSync } from 'node:child_process';
import { statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets-src', 'cutscene'), OUT = path.join(ROOT, 'public', 'assets', 'video');
const MASK = 'watermark-mask.png';   // SRC 안 (ffmpeg 필터에 경로를 넣지 않게 SRC 에서 실행한다)
const CLIPS = [
  { src: 'eternatus.mp4', out: 'eternatus.mp4', start: 0, dur: 10, mask: true },
  { src: 'bond-flame.mp4', out: 'bond.mp4', start: 0, dur: 10, mask: true }
];
const only = process.argv.slice(2);
const kb = n => `${(n / 1024).toFixed(0)}KB`;

mkdirSync(OUT, { recursive: true });
for (const c of CLIPS) {
  if (only.length && !only.includes(path.basename(c.out, '.mp4'))) continue;
  const src = path.join(SRC, c.src), out = path.join(OUT, c.out), fadeAt = Math.max(0, c.dur - .35).toFixed(2);
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(c.start), '-t', String(c.dur), '-i', c.src,
    '-vf', `${c.mask ? `removelogo=f=${MASK},` : ''}scale=1280:720:flags=lanczos,fps=24`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-maxrate', '1500k', '-bufsize', '3000k',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '80k', '-ac', '2', '-af', `afade=t=out:st=${fadeAt}:d=0.35`, out];
  const r = spawnSync(ffmpeg, args, { stdio: 'inherit', cwd: SRC });
  if (r.status !== 0) throw new Error(`${c.src} 인코딩 실패`);
  console.log(`${c.src} ${kb(statSync(src).size)} → ${c.out} ${kb(statSync(out).size)} (${c.dur}초${c.mask ? ' · 워터마크 지움' : ''})`);
}
