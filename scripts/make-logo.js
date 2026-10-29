// 포켓 셀즈 게임 마크(도트 로고) 생성
//  - 128x128 논리 픽셀로 그린 뒤 4배 확대 → brand/pokecells-mark.png (512x512)
//  - 몬스터볼 모양 시작 버튼만 담은 파비콘 → brand/pokecells-icon.png (64x64)
// 제목 글자는 Galmuri 비트맵 글꼴(BDF)을 그대로 찍어 도트 느낌을 살린다.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'brand');
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255];

class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Uint8Array(w * h * 4); }
  set(x, y, c, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, p = this.px, k = a * (c[3] / 255);
    for (let j = 0; j < 3; j++) p[i + j] = Math.round(p[i + j] * (1 - k) + c[j] * k);
    p[i + 3] = Math.min(255, Math.round(p[i + 3] + (255 - p[i + 3]) * k));
  }
  rect(x, y, w, h, c, a = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c, a); }
  inCircle(x, y, cx, cy, r) { const dx = x + .5 - cx, dy = y + .5 - cy; return dx * dx + dy * dy <= r * r; }
  disc(cx, cy, r, c, test = () => true) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (this.inCircle(x, y, cx, cy, r) && test(x, y)) this.set(x, y, c);
  }
  // 정수배 확대
  scaled(s) {
    const out = new PNG({ width: this.w * s, height: this.h * s });
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
      const si = ((Math.floor(y / s)) * this.w + Math.floor(x / s)) * 4, di = (y * out.width + x) * 4;
      out.data[di] = this.px[si]; out.data[di + 1] = this.px[si + 1]; out.data[di + 2] = this.px[si + 2]; out.data[di + 3] = this.px[si + 3];
    }
    return PNG.sync.write(out, { deflateLevel: 9 });
  }
}

// BDF 비트맵 글꼴
async function loadBdf(file) {
  const text = await readFile(file, 'utf8');
  const glyphs = new Map();
  const re = /ENCODING (\d+)[\s\S]*?DWIDTH (-?\d+) [\s\S]*?BBX (-?\d+) (-?\d+) (-?\d+) (-?\d+)\s+BITMAP\s+([\s\S]*?)ENDCHAR/g;
  let m;
  while ((m = re.exec(text))) {
    const [, enc, dw, w, h, xo, yo, bmp] = m;
    glyphs.set(+enc, { dw: +dw, w: +w, h: +h, xo: +xo, yo: +yo, rows: bmp.trim().split(/\s+/).filter(Boolean) });
  }
  return glyphs;
}
function glyphPixels(font, str, scale) {
  const pts = []; let pen = 0;
  for (const ch of str) {
    const g = font.get(ch.codePointAt(0)) || font.get(63);
    g.rows.forEach((row, ry) => {
      const bits = parseInt(row, 16), nb = row.length * 4;
      for (let bx = 0; bx < g.w; bx++) if (bits & (1 << (nb - 1 - bx))) {
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) pts.push([(pen + g.xo + bx) * scale + sx, (-g.yo - g.h + ry) * scale + sy]);
      }
    });
    pen += g.dw;
  }
  return { pts, width: pen * scale };
}
function drawText(cv, font, str, cx, baseline, scale, fill, outline, shadow) {
  const { pts, width } = glyphPixels(font, str, scale);
  const ox = Math.round(cx - width / 2);
  if (shadow) for (const [x, y] of pts) cv.set(ox + x + scale, baseline + y + scale, shadow);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) for (const [x, y] of pts) cv.set(ox + x + dx, baseline + y + dy, outline);
  for (const [x, y] of pts) cv.set(ox + x, baseline + y, typeof fill === 'function' ? fill(y) : fill);
}

// 스프라이트 시트에서 한 프레임을 잘라 붙이기 (row: 0 정면, 2 오른쪽, 6 왼쪽)
async function stamp(cv, key, row, cx, footY) {
  const dir = path.join(ROOT, 'public', 'assets', 'sprites', key);
  const xml = await readFile(path.join(dir, 'AnimData.xml'), 'utf8');
  const block = (xml.match(/<Anim>\s*<Name>Idle<\/Name>[\s\S]*?<\/Anim>/) || [])[0];
  const fw = +block.match(/<FrameWidth>(\d+)/)[1], fh = +block.match(/<FrameHeight>(\d+)/)[1];
  const png = PNG.sync.read(await readFile(path.join(dir, 'Idle-Anim.png')));
  let minX = fw, maxX = 0, minY = fh, maxY = 0;
  const at = (x, y) => ((row * fh + y) * png.width + x) * 4;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (png.data[at(x, y) + 3] > 40) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const ox = Math.round(cx - (maxX - minX + 1) / 2) - minX, oy = footY - maxY - 1;
  // 그림자
  for (let x = minX - 1; x <= maxX + 1; x++) cv.set(ox + x, footY, hex('#05040c'), .55);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const i = at(x, y);
    if (png.data[i + 3] > 40) cv.set(ox + x, oy + y, [png.data[i], png.data[i + 1], png.data[i + 2], 255]);
  }
}

// 몬스터볼 모양 시작 버튼 (가운데 ▶)
function playBall(cv, cx, cy, r) {
  const ink = hex('#1a0e2a');
  for (let k = 3; k >= 1; k--) cv.disc(cx, cy, r + 2 + k * 2, hex('#b08aff'), () => true), cv.px;   // 바깥 발광 (아래 덮어씀)
  for (let y = cy - r - 8; y <= cy + r + 8; y++) for (let x = cx - r - 8; x <= cx + r + 8; x++) {
    const d = Math.hypot(x + .5 - cx, y + .5 - cy);
    if (d > r + 1 && d < r + 8) cv.set(x, y, hex('#b08aff'), Math.max(0, .55 - (d - r) * .07));
  }
  cv.disc(cx, cy, r + 1.5, ink);
  cv.disc(cx, cy, r, hex('#e3483c'), (x, y) => y + .5 < cy);
  cv.disc(cx, cy, r, hex('#f4f0ea'), (x, y) => y + .5 >= cy);
  cv.disc(cx - r * .35, cy - r * .45, r * .32, hex('#ff8a7a'), (x, y) => y + .5 < cy - 2);          // 윗면 하이라이트
  cv.disc(cx, cy, r, hex('#c8c0d8'), (x, y) => y + .5 >= cy && Math.hypot(x + .5 - cx, y + .5 - cy) > r - 3);   // 아랫면 음영
  cv.rect(cx - r, cy - 2, r * 2, 4, ink);
  cv.disc(cx, cy, r * .42, ink);
  cv.disc(cx, cy, r * .42 - 2.2, hex('#f4f0ea'));
  // ▶ 삼각형
  const t = r * .22;
  for (let y = Math.floor(cy - t); y <= cy + t; y++) for (let x = Math.floor(cx - t * .7); x <= cx + t; x++) {
    const px = x + .5, py = y + .5, k = (px - (cx - t * .7)) / (t * 1.7);
    if (k >= 0 && k <= 1 && Math.abs(py - cy) <= t * (1 - k)) cv.set(x, y, hex('#e3483c'));
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const bold = await loadBdf(path.join(ROOT, 'node_modules', 'galmuri', 'dist', 'Galmuri11-Bold.bdf'));
  const cv = new Canvas(128, 128);

  // 둥근 사각 앱 아이콘 배경 (세로 그라데이션 + 네온 테두리)
  const R = 16, inside = (x, y, inset = 0) => {
    const l = inset, t = inset, rr = 127 - inset, b = 127 - inset, rad = R - inset;
    if (x < l || y < t || x > rr || y > b) return false;
    const cxr = x < l + rad ? l + rad : x > rr - rad ? rr - rad : x, cyr = y < t + rad ? t + rad : y > b - rad ? b - rad : y;
    return Math.hypot(x - cxr, y - cyr) <= rad;
  };
  const top = hex('#2c2066'), bot = hex('#0c0920');
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    if (!inside(x, y)) continue;
    if (!inside(x, y, 3)) { cv.set(x, y, inside(x, y, 1) ? hex('#9a7aff') : hex('#1a0e2a')); continue; }
    const k = y / 127;
    cv.set(x, y, [0, 1, 2].map(i => Math.round(top[i] * (1 - k) + bot[i] * k)).concat(255));
  }
  for (let x = 6; x < 122; x++) if (inside(x, 4, 3)) cv.set(x, 4, hex('#c8b8ff'), .6);   // 윗변 하이라이트
  // 별가루
  [[14, 40], [112, 34], [24, 84], [104, 78], [40, 112], [92, 110], [10, 64], [118, 58]].forEach(([x, y], i) => { cv.set(x, y, hex(i % 2 ? '#9ad8ff' : '#ffd25a')); cv.set(x + 1, y, hex('#ffffff'), .5); });

  // 제목
  drawText(cv, bold, '포켓 셀즈', 64, 29, 2, y => y < -14 ? hex('#fff6d0') : hex('#ffd25a'), hex('#1a0e2a'), hex('#e3483c'));
  // 시작 버튼
  playBall(cv, 64, 66, 23);
  // 스타팅 3마리
  await stamp(cv, 'charmander', 2, 20, 101);
  await stamp(cv, 'squirtle', 6, 108, 101);
  await stamp(cv, 'bulbasaur', 0, 64, 118);

  await writeFile(path.join(OUT, 'pokecells-mark.png'), cv.scaled(4));

  // 파비콘: 버튼만
  const ic = new Canvas(32, 32);
  playBall(ic, 16, 16, 12);
  await writeFile(path.join(OUT, 'pokecells-icon.png'), ic.scaled(2));
  console.log('brand/pokecells-mark.png (512x512), brand/pokecells-icon.png (64x64) 생성');
}

main().catch(e => { console.error(e); process.exitCode = 1; });
