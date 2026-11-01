// 스킬 아이콘 일러스트: 96×96 캔버스에 2D API(베지어·그라데이션·발광·가산 합성)로 그리는 모바일 RPG 풍 스킬 아이콘
//  drawSkillArt: Phaser 없이 순수 캔버스 그리기 (미리보기 페이지에서도 쓴다) · skillArt: sk:<id> 텍스처로 만들어 돌려준다
//  모티프 고르기: ① 기술 id 키워드 규칙 → ② 액션 형태(archetype) → ③ 옛 도트 아이콘 힌트 → ④ 타입 기본
//  같은 기술은 늘 같은 그림 (id 해시 시드) · 같은 모티프라도 기술마다 각도·개수·색조가 조금씩 다르다
import Phaser from 'phaser';
import { SKILLS } from '../data/pokemon.js';
import { MOVE_DB } from '../data/MoveDatabase.js';
import { archetypeOf } from '../data/moveRules.js';
import { typeColor } from '../data/types.js';

export const ART_SIZE = 96;
const TAU = Math.PI * 2, PI = Math.PI, rad = d => d * PI / 180;
let K = 1;   // 그리는 배율 (shadowBlur 는 변환을 안 따르므로 직접 곱한다)

// ---------------- 시드 난수 · 색 ----------------
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) { return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function toHsl(n) {
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const W = (a = 1) => `rgba(255,255,255,${a})`, B = (a = 1) => `rgba(0,0,0,${a})`;
// 타입 대표색 보정 (악은 진홍, 강철은 푸른 크롬) · 보조색 색상 회전
const TONE = { dark: 0xd0305a, steel: 0xa8bcdc, normal: 0xd8cca0, rock: 0xc89850, ground: 0xd8a050 };
const ACC = { fire: -20, water: -24, grass: -45, electric: 14, ghost: 45, psychic: -55, dragon: -75, fairy: 35, dark: -65, ice: 22, poison: 30, steel: 20, flying: -22, rock: -14, ground: -14, bug: 28, fighting: -15, normal: 20 };
function palette(type, R) {
  let [h, s, l] = toHsl(TONE[type] ?? typeColor(type));
  h += (R() - .5) * 14; s = Math.max(s, type === 'steel' || type === 'normal' ? .28 : .6); l = Math.min(Math.max(l, .5), .62);
  const ah = h + (ACC[type] ?? 25), mk = rgb => (a = 1) => css(rgb, a);
  const P = {
    main: mk(hsl(h, s, l)), light: mk(hsl(h, s, l + .2)), hot: mk(hsl(h + 6, s * .7, .92)),
    dark: mk(hsl(h, s * .95, l * .48)), deep: mk(hsl(h, s * .85, l * .2)),
    acc: mk(hsl(ah, s, l * .95)), accL: mk(hsl(ah, s, l + .16)),
    bgC: hsl(h, s * .9, l * .62), bgM: hsl(h, s * .85, l * .3), bgE: hsl(h, s * .8, l * .1)
  };
  if (type === 'dark') { P.bgC = hsl(h, s * .7, .26); P.bgM = hsl(h - 20, s * .6, .11); P.bgE = hsl(h - 40, .5, .04); }
  return P;
}

// ---------------- 그리기 도구 ----------------
const glow = (c, col, b) => { c.shadowColor = col; c.shadowBlur = b * K; };
const noGlow = c => { c.shadowBlur = 0; c.shadowColor = 'rgba(0,0,0,0)'; };
function lin(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) g.addColorStop(o, col); return g; }
function radl(c, x, y, r0, r1, stops, fx = x, fy = y) { const g = c.createRadialGradient(fx, fy, r0, x, y, r1); for (const [o, col] of stops) g.addColorStop(o, col); return g; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
function line(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); }
// 번진 빛 덩어리
function bloom(c, x, y, r, col, a = 1) { c.fillStyle = radl(c, x, y, 0, r, [[0, col], [1, 'rgba(0,0,0,0)']]); c.globalAlpha = a; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }
// 점 열 → 폭이 변하는 띠 (w(t) = 전체 폭)
function ribbon(c, pts, wf) {
  const n = pts.length, L = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = wf(i / (n - 1)) / 2, p = pts[i];
    L.push([p[0] - dy * w, p[1] + dx * w]); Rt.push([p[0] + dy * w, p[1] - dx * w]);
  }
  c.beginPath(); c.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) c.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) c.lineTo(Rt[i][0], Rt[i][1]);
  c.closePath();
}
function arcPts(cx, cy, r, a0, a1, n = 24, sy = 1) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy]); } return p; }
const taper = (t, e = .7) => Math.pow(Math.sin(PI * t), e);
// 반짝이 (네 갈래 별)
function sparkle(c, x, y, r, col) {
  c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r);
  c.fillStyle = col; c.fill();
}
function ember(c, x, y, r, col) { c.fillStyle = radl(c, x, y, 0, r, [[0, W()], [.35, col], [1, 'rgba(0,0,0,0)']]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
// 지그재그 번개 줄기
function jag(R, x0, y0, x1, y1, n, amp) {
  const p = [[x0, y0]], dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  for (let i = 1; i < n; i++) { const t = i / n, o = (R() - .5) * 2 * amp; p.push([x0 + dx * t + nx * o, y0 + dy * t + ny * o]); }
  p.push([x1, y1]); return p;
}
function zap(c, pts, col, w) {
  c.lineJoin = 'round'; c.lineCap = 'round';
  glow(c, col, 8); line(c, pts); c.strokeStyle = col; c.lineWidth = w; c.stroke();
  noGlow(c); line(c, pts); c.strokeStyle = W(.95); c.lineWidth = Math.max(.8, w * .38); c.stroke();
}
// 불꽃 혀: (x,y) 밑동, ang 방향(0 = 위)으로 길이 h
function flame(c, x, y, w, h, ang, bend, P) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const layer = (sw, sh, oy, stops) => {
    const X = w * sw, H = h * sh, bx = bend * sh;
    c.beginPath(); c.moveTo(bx, -H + oy);
    c.bezierCurveTo(X * .2 + bx * .4, -H * .62 + oy, X, -H * .45 + oy, X * .62, -H * .02 + oy);
    c.bezierCurveTo(X * .38, H * .3 + oy, -X * .38, H * .3 + oy, -X * .62, -H * .02 + oy);
    c.bezierCurveTo(-X, -H * .45 + oy, -X * .2 + bx * .4, -H * .62 + oy, bx, -H + oy);
    c.fillStyle = lin(c, 0, H * .25 + oy, 0, -H + oy, stops); c.fill();
  };
  glow(c, P.main(.9), 10);
  layer(1, 1, 0, [[0, P.light()], [.3, P.main()], [.72, P.acc(.9)], [1, P.acc(.15)]]);
  noGlow(c);
  layer(.64, .72, h * .05, [[0, P.hot()], [.45, P.light()], [1, P.main(0)]]);
  layer(.34, .42, h * .09, [[0, W()], [.55, P.hot()], [1, P.hot(0)]]);
  c.restore();
}
// 잎·깃털 (밑동 (x,y) 에서 ang 방향으로 len)
function leaf(c, x, y, len, wid, ang, P, opt = {}) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * .42, -wid, len, 0); c.quadraticCurveTo(len * .42, wid, 0, 0);
  glow(c, opt.glow || P.main(.8), opt.blur ?? 6);
  c.fillStyle = lin(c, 0, 0, len, 0, opt.stops || [[0, P.dark()], [.45, P.main()], [1, P.light()]]); c.fill(); noGlow(c);
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * .42, wid, len, 0); c.lineTo(0, 0); c.fillStyle = B(.22); c.fill();   // 아래 반쪽 그늘
  c.beginPath(); c.moveTo(len * .04, 0); c.quadraticCurveTo(len * .5, -wid * .08, len * .96, 0); c.strokeStyle = opt.rib || P.hot(.85); c.lineWidth = 1.1; c.stroke();
  if (!opt.noVein) for (let i = 1; i < 4; i++) { const t = i / 4.2; c.beginPath(); c.moveTo(len * t, 0); c.lineTo(len * (t + .1), -wid * .42 * (1 - t * .5)); c.moveTo(len * t, 0); c.lineTo(len * (t + .1), wid * .42 * (1 - t * .5)); c.strokeStyle = P.hot(.35); c.lineWidth = .7; c.stroke(); }
  c.restore();
}
// 결정 기둥 (밑동 (x,y), ang 방향(0 = 위))
function prism(c, x, y, len, w, ang, P) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const s = -len * .76, h = w / 2;
  glow(c, P.main(.9), 8);
  poly(c, [[-h, 0], [-h, s], [0, -len], [h, s], [h, 0]]); c.fillStyle = P.dark(); c.fill(); noGlow(c);
  poly(c, [[-h, 0], [-h, s], [0, -len], [0, 0]]); c.fillStyle = lin(c, -h, 0, 0, -len, [[0, P.main()], [.6, P.light()], [1, W()]]); c.fill();
  poly(c, [[0, 0], [0, -len], [h, s], [h, 0]]); c.fillStyle = lin(c, 0, 0, h, -len, [[0, P.deep()], [.7, P.dark()], [1, P.main()]]); c.fill();
  line(c, [[0, -2], [0, -len]]); c.strokeStyle = W(.85); c.lineWidth = .9; c.stroke();
  poly(c, [[-h, 0], [-h, s], [0, -len], [h, s], [h, 0]]); c.strokeStyle = P.hot(.6); c.lineWidth = .8; c.stroke();
  c.restore();
}
// 울퉁불퉁한 바위
function rock(c, x, y, r, R, P, n = 8, jag = .22) {
  const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * .3, q = r * (1 - jag + R() * jag * 1.4); pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q]); }
  glow(c, B(.6), 6); poly(c, pts); c.fillStyle = radl(c, x, y, 0, r * 1.1, [[0, P.light()], [.55, P.main()], [1, P.deep()]], x - r * .4, y - r * .45); c.fill(); noGlow(c);
  c.save(); poly(c, pts); c.clip();
  poly(c, pts.map(([px, py]) => [x + (px - x) * .55 - r * .25, y + (py - y) * .55 - r * .28])); c.fillStyle = W(.16); c.fill();
  line(c, [[x - r * .1, y - r * .2], [x + r * .2, y + r * .1], [x + r * .1, y + r * .5]]); c.strokeStyle = B(.45); c.lineWidth = 1; c.stroke();
  c.restore();
  poly(c, pts); c.strokeStyle = B(.6); c.lineWidth = 1.2; c.stroke();
}
// 광택 구슬
function sphere(c, x, y, r, P, core = P.hot()) {
  glow(c, P.main(.95), 14);
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = radl(c, x, y, 0, r, [[0, core], [.45, P.light()], [.82, P.main()], [1, P.dark()]], x - r * .3, y - r * .35); c.fill(); noGlow(c);
  c.beginPath(); c.arc(x, y, r - .6, 0, TAU); c.strokeStyle = P.hot(.55); c.lineWidth = 1.2; c.stroke();
  c.beginPath(); c.ellipse(x - r * .35, y - r * .45, r * .32, r * .17, -.6, 0, TAU); c.fillStyle = W(.85); c.fill();
}
// 꼬리 붙은 빛 줄기 (머리 (x1,y1))
function streak(c, x0, y0, x1, y1, w, col) {
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); }
  ribbon(c, pts, t => w * Math.pow(t, .8)); c.fillStyle = lin(c, x0, y0, x1, y1, [[0, 'rgba(0,0,0,0)'], [1, col]]); c.fill();
}
// 번개 아이콘 꼴 (⚡) 다각형
const BOLT = [[58, 4], [22, 52], [45, 52], [34, 92], [76, 38], [52, 38], [68, 4]];

// 타입 잔입자 (일반 모티프 둘레에 뿌려 타입 느낌을 더한다)
function typeFx(c, P, R, type, n) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0, k = 0; i < n && k < 60; k++) {
    const x = 8 + R() * 80, y = 8 + R() * 80; if (Math.hypot(x - 48, y - 48) < 26) continue; i++;
    const s = 1.6 + R() * 2.4;
    if (type === 'fire') ember(c, x, y, s * 1.6, P.main());
    else if (type === 'electric') { const p = jag(R, x - s * 1.6, y - s * 1.6, x + s * 1.6, y + s * 1.6, 3, s * .9); line(c, p); c.strokeStyle = P.hot(.9); c.lineWidth = 1; c.stroke(); }
    else if (type === 'water') { c.beginPath(); c.moveTo(x, y - s * 1.6); c.quadraticCurveTo(x + s, y, x, y + s * .7); c.quadraticCurveTo(x - s, y, x, y - s * 1.6); c.fillStyle = P.light(.8); c.fill(); }
    else if (type === 'grass' || type === 'bug') { c.save(); c.translate(x, y); c.rotate(R() * TAU); c.beginPath(); c.moveTo(-s * 1.5, 0); c.quadraticCurveTo(0, -s, s * 1.5, 0); c.quadraticCurveTo(0, s, -s * 1.5, 0); c.fillStyle = P.light(.75); c.fill(); c.restore(); }
    else if (type === 'rock' || type === 'ground') { c.globalCompositeOperation = 'source-over'; c.beginPath(); c.arc(x, y, s * .8, 0, TAU); c.fillStyle = P.light(.7); c.fill(); c.globalCompositeOperation = 'lighter'; }
    else if (type === 'poison' || type === 'ghost' || type === 'dark') { c.beginPath(); c.arc(x, y, s, 0, TAU); c.strokeStyle = P.light(.6); c.lineWidth = .9; c.stroke(); }
    else sparkle(c, x, y, s * 1.5, P.hot(.85));
  }
  c.restore();
}

// ---------------- 모티프 ----------------
const M = {};

// 불꽃 소용돌이 (가운데 백열)
M.vortex = (c, P, R) => {
  const n = 3 + (R() * 2 | 0), rot = R() * TAU, dir = R() < .5 ? 1 : -1, tilt = .74 + R() * .16;
  bloom(c, 48, 50, 46, P.main(.7));
  for (let i = 0; i < 3; i++) { const a = rad(-90 + (i - 1) * 38 + (R() - .5) * 14); flame(c, 48 + Math.cos(a) * 18, 52 + Math.sin(a) * 14, 13, 30 + R() * 8, a + PI / 2, (R() - .5) * 8, P); }
  c.save(); c.translate(48, 52); c.rotate((R() - .5) * .5); c.scale(1, tilt); c.rotate(rot);
  for (const [rm, wm, col, a, add] of [[44, 17, P.acc, .95, 0], [40, 12, P.main, .85, 1], [34, 7, P.light, .8, 1], [28, 3, P.hot, .9, 1]]) {
    c.globalCompositeOperation = add ? 'lighter' : 'source-over';
    if (!add) glow(c, P.main(.8), 10);
    for (let i = 0; i < n; i++) {
      const pts = []; for (let s = 0; s <= 28; s++) { const t = s / 28, an = i * TAU / n + dir * t * 3.6, r = 3 + rm * t; pts.push([Math.cos(an) * r, Math.sin(an) * r]); }
      ribbon(c, pts, t => wm * Math.pow(1 - t, .6) * Math.min(1, t * 5)); c.fillStyle = col(a); c.fill();
    }
    noGlow(c);
  }
  c.restore(); c.globalCompositeOperation = 'lighter';
  bloom(c, 48, 52, 20, W(.95)); bloom(c, 48, 52, 30, P.hot(.6));
  for (let i = 0; i < 9; i++) { const a = R() * TAU, r = 30 + R() * 14; ember(c, 48 + Math.cos(a) * r, 52 + Math.sin(a) * r * .8, 1.6 + R() * 2, P.light()); }
  c.globalCompositeOperation = 'source-over';
};
// 불꽃 바퀴
M.flameRing = (c, P, R) => {
  const dir = R() < .5 ? 1 : -1, n = 9 + (R() * 3 | 0);
  bloom(c, 48, 48, 44, P.main(.6));
  c.save(); c.translate(48, 48); c.scale(1, .9);
  for (let i = 0; i < n; i++) { const a = i / n * TAU; flame(c, Math.cos(a) * 24, Math.sin(a) * 24, 11, 22 + R() * 6, a + PI / 2 * dir + PI / 2 - PI / 2 * dir * .4, dir * 5, P); }
  c.globalCompositeOperation = 'lighter';
  ribbon(c, arcPts(0, 0, 22, 0, TAU, 40), () => 6); c.fillStyle = P.light(.8); c.fill();
  ribbon(c, arcPts(0, 0, 22, 0, TAU, 40), () => 2); c.fillStyle = W(.9); c.fill();
  c.restore();
  bloom(c, 48, 48, 16, P.hot(.7)); c.globalCompositeOperation = 'source-over';
};
// 불꽃 혀 여러 갈래
M.flames = (c, P, R, o) => {
  bloom(c, 48, 72, 44, P.main(.75));
  const n = 3 + (R() * 3 | 0), items = [];
  for (let i = 0; i < n; i++) { const u = i / (n - 1) * 2 - 1; items.push({ u, h: 58 - Math.abs(u) * 22 + R() * 6, w: 22 - Math.abs(u) * 7 }); }
  items.sort((a, b) => a.h - b.h);
  for (const f of items) flame(c, 48 + f.u * 22, 84 - Math.abs(f.u) * 6, f.w, f.h, f.u * .38 + (R() - .5) * .14, (R() - .5) * 12, P);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) ember(c, 14 + R() * 68, 10 + R() * 50, 1.5 + R() * 2.2, P.light());
  if (o.sparkle) for (let i = 0; i < 4; i++) sparkle(c, 16 + R() * 64, 12 + R() * 40, 4 + R() * 3, W(.9));
  c.globalCompositeOperation = 'source-over';
};
// 대(大)자 다섯 갈래 불꽃
M.flameStar = (c, P, R) => {
  const rot = (R() - .5) * .25;
  bloom(c, 48, 52, 48, P.main(.8));
  const arms = [[0, 40], [-80, 34], [80, 34], [-146, 38], [146, 38]];
  for (const [a, L] of arms.reverse()) flame(c, 48, 52, 16, L + R() * 4, rad(a) + rot + (R() - .5) * .08, (R() - .5) * 6, P);
  c.globalCompositeOperation = 'lighter'; bloom(c, 48, 52, 18, W()); bloom(c, 48, 52, 28, P.hot(.5)); c.globalCompositeOperation = 'source-over';
};
// 분화 (화산 + 용암 분수)
M.volcano = (c, P, R) => {
  bloom(c, 48, 40, 46, P.main(.6));
  c.beginPath(); c.moveTo(-2, 98); c.lineTo(28, 62); c.quadraticCurveTo(48, 55, 68, 62); c.lineTo(98, 98); c.closePath();
  glow(c, P.main(.8), 12); c.fillStyle = lin(c, 0, 56, 0, 96, [[0, '#7a3a22'], [.4, '#3a1a12'], [1, '#120806']]); c.fill(); noGlow(c);
  c.beginPath(); c.moveTo(4, 96); c.lineTo(28, 62); c.quadraticCurveTo(48, 55, 68, 62); c.lineTo(92, 96); c.strokeStyle = P.light(.75); c.lineWidth = 1.6; c.stroke();
  c.globalCompositeOperation = 'lighter';
  for (const [x0, x1] of [[40, 30], [54, 66], [47, 50]]) { glow(c, P.main(), 6); line(c, jag(R, x0, 62, x1 + (R() - .5) * 8, 96, 4, 3)); c.strokeStyle = P.light(.9); c.lineWidth = 2; c.stroke(); }
  noGlow(c); c.globalCompositeOperation = 'source-over';
  c.beginPath(); c.ellipse(48, 60, 18, 4, 0, 0, TAU); c.fillStyle = P.hot(); c.fill();
  flame(c, 48, 62, 22, 50, (R() - .5) * .15, (R() - .5) * 8, P);
  flame(c, 36, 62, 11, 26, -.5, 0, P); flame(c, 60, 62, 11, 26, .5, 0, P);
  for (let i = 0; i < 5; i++) { const x = 14 + R() * 68, y = 10 + R() * 30, r = 2.5 + R() * 2.5; streak(c, 48, 58, x, y, r * 1.6, P.main(.7)); ember(c, x, y, r * 1.8, P.light()); }
};
// 도깨비불 (떠다니는 귀화)
M.wisp = (c, P, R) => {
  bloom(c, 48, 50, 44, P.main(.6));
  const spots = [[48, 64, 1], [24, 50, .7], [72, 44, .75]];
  for (const [x, y, s] of spots.sort((a, b) => a[2] - b[2])) {
    flame(c, x + (R() - .5) * 6, y, 18 * s, 44 * s, (R() - .5) * .3, (R() - .5) * 14, P);
    c.globalCompositeOperation = 'lighter'; bloom(c, x, y - 6 * s, 10 * s, W(.8)); c.globalCompositeOperation = 'source-over';
  }
};
// 물수리검 (네온 청록 사방 표창 + 물보라 꼬리)
M.shuriken = (c, P, R) => {
  const cx = 54, cy = 42, r = 33, rot = .2 + R() * .6, cy0 = [90, 236, 255];
  bloom(c, cx, cy, 46, css(cy0, .45));
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const o = (i - 3) * 4.2 + (R() - .5) * 2; streak(c, 6 + o * .6 + R() * 6, 88 + o * .2, cx - 6 + o * .7, cy + 8 + o * .6, 2 + R() * 3.5, css(cy0, .55)); }
  for (let i = 0; i < 14; i++) { const t = R(), x = 10 + (cx - 10) * t + (R() - .5) * 18, y = 86 + (cy - 86) * t + (R() - .5) * 18; c.beginPath(); c.arc(x, y, .8 + R() * 2.2 * (1 - t * .5), 0, TAU); c.fillStyle = W(.75); c.fill(); }
  ribbon(c, arcPts(cx, cy, r + 7, rot + PI * .45, rot + PI * 1.3, 24), t => 4 * taper(t)); c.fillStyle = css(cy0, .55); c.fill();
  c.restore();
  c.save(); c.translate(cx, cy); c.rotate(rot);
  const tip = k => [Math.cos(k * PI / 2) * r, Math.sin(k * PI / 2) * r], ctl = k => [Math.cos(k * PI / 2 + PI / 4) * 7, Math.sin(k * PI / 2 + PI / 4) * 7];
  const star = () => { c.beginPath(); const t0 = tip(0); c.moveTo(t0[0], t0[1]); for (let k = 0; k < 4; k++) { const q = ctl(k), t = tip(k + 1); c.quadraticCurveTo(q[0], q[1], t[0], t[1]); } c.closePath(); };
  glow(c, css(cy0), 16); star(); c.fillStyle = lin(c, -r, -r, r, r, [[0, W()], [.4, css(cy0)], [1, '#105c9c']]); c.fill(); noGlow(c);
  for (let k = 0; k < 4; k++) {   // 면 나누기 (한쪽 날은 밝게, 반대쪽은 어둡게)
    const t0 = tip(k), q = ctl(k), t1 = tip(k + 1);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(t0[0], t0[1]); c.quadraticCurveTo(q[0], q[1], (t0[0] + t1[0]) * .5 * .25, (t0[1] + t1[1]) * .5 * .25); c.closePath();
    c.fillStyle = B(.28); c.fill();
    line(c, [[0, 0], t0]); c.strokeStyle = W(.9); c.lineWidth = 1; c.stroke();
  }
  star(); c.strokeStyle = '#c8ffff'; c.lineWidth = 1.4; glow(c, css(cy0), 6); c.stroke(); noGlow(c);
  c.beginPath(); c.arc(0, 0, 5.5, 0, TAU); c.fillStyle = '#062a48'; c.fill(); c.strokeStyle = W(.95); c.lineWidth = 1.6; c.stroke();
  c.restore();
  c.globalCompositeOperation = 'lighter'; sparkle(c, cx + Math.cos(rot) * r, cy + Math.sin(rot) * r, 7, W()); c.globalCompositeOperation = 'source-over';
};
// 물줄기 (모서리에서 뻗는 물대포)
M.jet = (c, P, R, o) => {
  const up = o.up, x0 = up ? 46 : 6, y0 = up ? 100 : 92, ang = up ? -PI / 2 + (R() - .5) * .2 : rad(-36 - R() * 16), L = up ? 76 : 80, amp = (R() - .5) * 16;
  const dx = Math.cos(ang), dy = Math.sin(ang), pts = [];
  for (let i = 0; i <= 26; i++) { const t = i / 26, s = Math.sin(PI * t) * amp; pts.push([x0 + dx * L * t - dy * s, y0 + dy * L * t + dx * s]); }
  const hx = pts[26][0], hy = pts[26][1], wf = t => 6 + 22 * Math.pow(t, .8);
  bloom(c, hx, hy, 34, P.light(.6));
  glow(c, P.main(.9), 10); ribbon(c, pts, t => wf(t) * 1.25); c.fillStyle = P.dark(.95); c.fill(); noGlow(c);
  ribbon(c, pts, wf); c.fillStyle = lin(c, x0, y0, hx, hy, [[0, P.dark()], [.5, P.main()], [1, P.light()]]); c.fill();
  c.globalCompositeOperation = 'lighter';
  ribbon(c, pts, t => wf(t) * .5); c.fillStyle = P.light(.6); c.fill();
  for (let k = 0; k < 2; k++) { const sp = pts.map((p, i) => { const t = i / 26, s = Math.sin(t * 14 + k * PI) * wf(t) * .32; return [p[0] - dy * s, p[1] + dx * s]; }); line(c, sp); c.strokeStyle = W(.55); c.lineWidth = 1.1; c.stroke(); }
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 8; i++) { const a = ang + (R() - .5) * 2.6, d = 6 + R() * 10; c.beginPath(); c.arc(hx + Math.cos(a) * d, hy + Math.sin(a) * d, 4 + R() * 6, 0, TAU); c.fillStyle = i < 4 ? P.light() : W(.95); c.fill(); }
  glow(c, P.light(), 10); c.beginPath(); c.arc(hx, hy, 9, 0, TAU); c.fillStyle = W(); c.fill(); noGlow(c);
  for (let i = 0; i < 9; i++) { const a = ang + (R() - .5) * 3, d = 18 + R() * 16, x = hx + Math.cos(a) * d, y = hy + Math.sin(a) * d, s = 1.2 + R() * 2.2; c.beginPath(); c.moveTo(x, y - s * 1.8); c.quadraticCurveTo(x + s, y, x, y + s); c.quadraticCurveTo(x - s, y, x, y - s * 1.8); c.fillStyle = W(.9); c.fill(); }
};
// 말려 오는 파도
M.wave = (c, P, R) => {
  c.save(); if (R() < .5) { c.translate(96, 0); c.scale(-1, 1); }
  const k = (R() - .5) * 6;
  bloom(c, 56, 40, 44, P.light(.45));
  // 뒤 파도
  c.beginPath(); c.moveTo(-2, 98); c.lineTo(-2, 64); c.bezierCurveTo(20, 56, 40, 60, 60, 66); c.bezierCurveTo(76, 70, 90, 64, 98, 60); c.lineTo(98, 98); c.closePath();
  c.fillStyle = lin(c, 0, 56, 0, 96, [[0, P.main(.8)], [1, P.deep()]]); c.fill();
  // 앞 파도 (말린 물마루)
  c.beginPath(); c.moveTo(-2, 98); c.lineTo(-2, 74); c.bezierCurveTo(16, 70, 24, 30 + k, 54, 20 + k); c.bezierCurveTo(80, 12 + k, 98, 32, 88, 50);
  c.bezierCurveTo(82, 60, 66, 60, 64, 48); c.bezierCurveTo(63, 41, 70, 38, 74, 43);
  c.bezierCurveTo(72, 34, 56, 34, 52, 48); c.bezierCurveTo(48, 64, 62, 82, 98, 84); c.lineTo(98, 98); c.closePath();
  glow(c, P.main(.8), 10); c.fillStyle = lin(c, 30, 20, 50, 96, [[0, P.light()], [.35, P.main()], [.8, P.dark()], [1, P.deep()]]); c.fill(); noGlow(c);
  c.save(); c.clip(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-2, 80 + i * 5); c.bezierCurveTo(16, 76 + i * 5, 28 - i * 3, 40 + i * 9, 54 - i * 2, 30 + i * 9); c.strokeStyle = W(.22 - i * .04); c.lineWidth = 1.4; c.stroke(); }
  c.restore();
  // 물거품 마루
  c.beginPath(); c.moveTo(18, 52); c.bezierCurveTo(26, 30 + k, 40, 22 + k, 54, 20 + k); c.bezierCurveTo(80, 12 + k, 98, 32, 88, 50); c.bezierCurveTo(84, 57, 76, 58, 70, 55);
  glow(c, W(.9), 8); c.strokeStyle = W(.95); c.lineWidth = 3.2; c.lineCap = 'round'; c.stroke(); noGlow(c);
  for (let i = 0; i < 12; i++) { const a = rad(-150 + R() * 150), d = 4 + R() * 12; c.beginPath(); c.arc(70 + Math.cos(a) * 22 + d * .3, 22 + k + Math.sin(a) * 10 - d * .4, .8 + R() * 2.4, 0, TAU); c.fillStyle = W(.9); c.fill(); }
  c.restore();
};
// 광택 거품
M.bubbles = (c, P, R, o) => {
  const bs = [];
  if (o.ring) { const n = 9; for (let i = 0; i < n; i++) { const a = i / n * TAU; bs.push([48 + Math.cos(a) * 28, 48 + Math.sin(a) * 28, 6 + R() * 4]); } bs.push([48, 48, 13]); }
  else for (let k = 0; k < 80 && bs.length < 7; k++) {
    const r = bs.length === 0 ? 19 + R() * 4 : 6 + R() * 11, x = r + 6 + R() * (84 - r * 2), y = r + 6 + R() * (84 - r * 2);
    if (bs.every(([bx, by, br]) => Math.hypot(bx - x, by - y) > br + r + 1)) bs.push([x, y, r]);
  }
  bloom(c, 48, 48, 46, P.main(.5));
  for (const [x, y, r] of bs) {
    glow(c, P.light(.9), 8);
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = radl(c, x, y, 0, r, [[0, P.main(.12)], [.7, P.main(.35)], [.92, P.light(.85)], [1, W(.95)]], x + r * .2, y + r * .25); c.fill(); noGlow(c);
    c.beginPath(); c.ellipse(x - r * .38, y - r * .42, r * .34, r * .18, -.7, 0, TAU); c.fillStyle = W(.95); c.fill();
    c.beginPath(); c.arc(x + r * .45, y + r * .45, r * .1, 0, TAU); c.fillStyle = W(.8); c.fill();
    c.beginPath(); c.arc(x, y, r * .78, rad(20), rad(80)); c.strokeStyle = W(.5); c.lineWidth = r * .08; c.stroke();
  }
};
// 물방울 왕관 튐
M.splat = (c, P, R) => {
  bloom(c, 48, 66, 40, P.main(.6));
  for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(48, 76, 16 + i * 11, 5 + i * 3.5, 0, 0, TAU); c.strokeStyle = P.light(.7 - i * .2); c.lineWidth = 2 - i * .4; c.stroke(); }
  c.beginPath(); c.moveTo(36, 78); c.bezierCurveTo(40, 60, 42, 46, 48, 30); c.bezierCurveTo(54, 46, 56, 60, 60, 78); c.closePath();
  glow(c, P.main(), 8); c.fillStyle = lin(c, 0, 30, 0, 78, [[0, W()], [.4, P.light()], [1, P.main()]]); c.fill(); noGlow(c);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = rad(-160 + i / (n - 1) * 140), d = 26 + R() * 10, x = 48 + Math.cos(a) * d, y = 62 + Math.sin(a) * d * .9, s = 3 + R() * 3;
    c.save(); c.translate(x, y); c.rotate(a + PI / 2); c.beginPath(); c.moveTo(0, s * 2.6); c.quadraticCurveTo(s * 1.1, -s * .2, 0, -s); c.quadraticCurveTo(-s * 1.1, -s * .2, 0, s * 2.6);
    glow(c, P.main(), 6); c.fillStyle = lin(c, 0, -s, 0, s * 2.6, [[0, W()], [1, P.light()]]); c.fill(); noGlow(c); c.restore();
  }
};
// 블랙홀 구체 + 보라 번개
M.voidOrb = (c, P, R, o) => {
  const cx = o.dash ? 58 : 48, cy = o.dash ? 40 : 48, r = (o.dash ? 15 : 17) + R() * 3, tilt = (R() - .5) * .9;
  bloom(c, cx, cy, 48, P.main(.85));
  if (o.dash) { c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const o2 = (i - 2) * 7; streak(c, -4 + o2, 100 + o2, cx - o2 * .3, cy + o2 * .3, 7 + R() * 6 - Math.abs(i - 2) * 2, (i % 2 ? P.acc : P.light)(.75)); } c.globalCompositeOperation = 'source-over'; }
  const ring = (a0, a1) => { c.save(); c.translate(cx, cy); c.rotate(tilt); ribbon(c, arcPts(0, 0, r + 12, a0, a1, 30, .32), t => 5 * taper(t, .5) + 1); c.fillStyle = P.light(.8); c.fill(); ribbon(c, arcPts(0, 0, r + 12, a0, a1, 30, .32), t => 1.6 * taper(t, .5)); c.fillStyle = W(.9); c.fill(); c.restore(); };
  c.globalCompositeOperation = 'lighter'; ring(PI, TAU); c.globalCompositeOperation = 'source-over';
  glow(c, P.light(), 16);
  c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fillStyle = radl(c, cx, cy, 0, r, [[0, '#000'], [.62, '#05020c'], [.86, P.deep()], [.96, P.main()], [1, P.hot()]]); c.fill(); noGlow(c);
  if (o.eye) M.eyeShape(c, P, cx, cy, r * .78);
  else { c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(cx, cy, r * (.35 + i * .18), R() * TAU, R() * TAU + 2); c.strokeStyle = P.main(.35); c.lineWidth = 1.2; c.stroke(); } c.globalCompositeOperation = 'source-over'; }
  c.globalCompositeOperation = 'lighter'; ring(0, PI);
  const nb = 4 + (R() * 3 | 0);
  for (let i = 0; i < nb; i++) {
    const a = i / nb * TAU + R() * .8, L = 16 + R() * 14, x0 = cx + Math.cos(a) * (r - 2), y0 = cy + Math.sin(a) * (r - 2);
    const p = jag(R, x0, y0, cx + Math.cos(a) * (r + L), cy + Math.sin(a) * (r + L), 4, 4); zap(c, p, P.light(), 2.6);
    if (R() < .6) { const q = p[2], b = a + (R() - .5) * 1.6; zap(c, jag(R, q[0], q[1], q[0] + Math.cos(b) * 10, q[1] + Math.sin(b) * 10, 3, 2.5), P.light(), 1.6); }
  }
  c.globalCompositeOperation = 'source-over';
  c.beginPath(); c.arc(cx, cy, r - 2, rad(200), rad(250)); c.strokeStyle = W(.6); c.lineWidth = 1.4; c.stroke();
  if (o.claw) M.clawMarks(c, P, R, 3, .8);
};
// 눈 (악몽·미래예지)
M.eyeShape = (c, P, x, y, s) => {
  c.save(); c.translate(x, y);
  c.beginPath(); c.moveTo(-s, 0); c.quadraticCurveTo(0, -s * .9, s, 0); c.quadraticCurveTo(0, s * .9, -s, 0);
  glow(c, P.light(), 10); c.fillStyle = '#08030f'; c.fill(); c.strokeStyle = P.hot(); c.lineWidth = 1.6; c.stroke(); noGlow(c);
  c.beginPath(); c.arc(0, 0, s * .42, 0, TAU); c.fillStyle = radl(c, 0, 0, 0, s * .42, [[0, W()], [.35, P.hot()], [.7, P.light()], [1, P.main()]]); c.fill();
  c.beginPath(); c.ellipse(0, 0, s * .1, s * .34, 0, 0, TAU); c.fillStyle = '#000'; c.fill();
  c.beginPath(); c.arc(-s * .14, -s * .16, s * .07, 0, TAU); c.fillStyle = W(); c.fill();
  c.restore();
};
M.eye = (c, P, R) => {
  bloom(c, 48, 48, 48, P.main(.8));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(48, 48, 26 + i * 9, (26 + i * 9) * .55, (R() - .5) * .2, 0, TAU); c.strokeStyle = P.light(.5 - i * .13); c.lineWidth = 2 - i * .4; c.stroke(); }
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; line(c, [[48 + Math.cos(a) * 34, 48 + Math.sin(a) * 22], [48 + Math.cos(a) * 44, 48 + Math.sin(a) * 30]]); c.strokeStyle = P.light(.5); c.lineWidth = 1.2; c.stroke(); }
  c.globalCompositeOperation = 'source-over';
  M.eyeShape(c, P, 48, 48, 30);
  c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) sparkle(c, 10 + R() * 76, 10 + R() * 76, 3 + R() * 3, P.hot(.8)); c.globalCompositeOperation = 'source-over';
};
// 악의 파동 (겹겹 동심 고리)
M.darkRings = (c, P, R, o) => {
  const full = o.full, ox = full ? 48 : 22, oy = full ? 48 : 72, mid = full ? 0 : rad(-48 + (R() - .5) * 16), span = full ? TAU : rad(118);
  bloom(c, ox, oy, 50, P.main(.75));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const r = 12 + i * 12.5, col = i % 2 ? P.acc : P.main;
    glow(c, col(), 8);
    const wob = full ? (a => r + Math.sin(a * 6 + i) * 1.6) : (() => r);
    const pts = []; for (let k = 0; k <= 32; k++) { const a = mid - span / 2 + span * k / 32, q = wob(a); pts.push([ox + Math.cos(a) * q, oy + Math.sin(a) * q]); }
    ribbon(c, pts, t => (7 - i * .7) * (full ? 1 : taper(t, .5))); c.fillStyle = col(.85 - i * .1); c.fill(); noGlow(c);
    ribbon(c, pts, t => (2.2 - i * .2) * (full ? 1 : taper(t, .5))); c.fillStyle = P.hot(.8 - i * .12); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  glow(c, P.main(), 14); c.beginPath(); c.arc(ox, oy, 9, 0, TAU); c.fillStyle = radl(c, ox, oy, 0, 9, [[0, '#000'], [.75, '#14040c'], [1, P.light()]]); c.fill(); noGlow(c);
  c.beginPath(); c.ellipse(ox, oy, 2, 5, 0, 0, TAU); c.fillStyle = P.hot(); c.fill();
};
// 염동력 고리 (흔들리는 동심원 + 가운데 빛)
M.psiRings = (c, P, R, o) => {
  const f = 3 + (R() * 4 | 0), ph = R() * TAU, n = 3 + (R() * 2 | 0);
  bloom(c, 48, 48, 48, P.main(.85));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const r0 = 14 + i * (28 / n) * 1.2, amp = 1.5 + i * .9, pts = [];
    for (let k = 0; k <= 60; k++) { const a = k / 60 * TAU, q = r0 + Math.sin(a * f + ph + i) * amp; pts.push([48 + Math.cos(a) * q, 48 + Math.sin(a) * q * (.9 + i * .03)]); }
    glow(c, (i % 2 ? P.acc : P.main)(), 10);
    line(c, pts); c.strokeStyle = (i % 2 ? P.accL : P.light)(.9 - i * .12); c.lineWidth = 3.2 - i * .4; c.stroke(); noGlow(c);
    line(c, pts); c.strokeStyle = W(.7 - i * .12); c.lineWidth = 1; c.stroke();
  }
  if (o.spikes) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + ph; zap(c, jag(R, 48 + Math.cos(a) * 20, 48 + Math.sin(a) * 20, 48 + Math.cos(a) * 44, 48 + Math.sin(a) * 44, 3, 3), P.light(), 2); }
  bloom(c, 48, 48, 18, P.hot(.9)); bloom(c, 48, 48, 9, W());
  sparkle(c, 48, 48, 15, W(.95));
  for (let i = 0; i < 6; i++) { const a = R() * TAU, d = 30 + R() * 12; sparkle(c, 48 + Math.cos(a) * d, 48 + Math.sin(a) * d, 2.5 + R() * 3, P.hot(.9)); }
  c.globalCompositeOperation = 'source-over';
};
// 초승달 칼날 (사이코커터·아쿠아커터·셸블레이드·아이언테일)
M.crescent = (c, P, R, o) => {
  const n = o.big ? 1 : 2 + (R() < .4 ? 1 : 0), rot = rad(-30 + (R() - .5) * 30);
  bloom(c, 48, 48, 46, P.main(.6));
  c.save(); c.translate(48, 48); c.rotate(rot); if (R() < .5) c.scale(-1, 1);
  for (let i = n - 1; i >= 0; i--) {
    const ox = i * -13, r = o.big ? 36 : 33 - i * 3, thick = o.big ? 17 : 15 - i * 2, a = i === 0 ? 1 : .55;
    const pts = arcPts(ox, 14 + i * 6, r, rad(-160), rad(-20), 30);
    c.globalCompositeOperation = 'lighter';
    if (i > 0) { ribbon(c, pts, t => thick * taper(t, .9)); c.fillStyle = P.main(.45 * a); c.fill(); continue; }
    c.globalCompositeOperation = 'source-over';
    glow(c, P.main(), 14); ribbon(c, pts, t => thick * taper(t, .9)); c.fillStyle = lin(c, 0, 14 - r, 0, 14, [[0, P.light()], [.6, P.main()], [1, P.dark()]]); c.fill(); noGlow(c);
    c.globalCompositeOperation = 'lighter';
    ribbon(c, arcPts(ox, 14 - thick * .22, r + thick * .2, rad(-155), rad(-25), 30), t => thick * .32 * taper(t, .9)); c.fillStyle = W(.9); c.fill();
  }
  c.restore(); c.globalCompositeOperation = 'source-over';
};
// 할퀸 자국 3줄 (공용)
M.clawMarks = (c, P, R, n, sc = 1, x = false) => {
  c.save(); c.translate(48, 48); c.scale(sc, sc); c.rotate((R() - .5) * .4); if (R() < .5) c.scale(-1, 1);
  const one = (flip) => {
    c.save(); if (flip) c.scale(-1, 1);
    const rs = n === 2 ? [62, 78] : n === 4 ? [50, 62, 74, 86] : [56, 70, 84];
    for (const r of rs) {
      const half = rad(Math.min(36, 2400 / r * .9)), pts = arcPts(40, -40, r, rad(135) - half, rad(135) + half, 28);
      glow(c, P.main(), 12); ribbon(c, pts, t => 10 * taper(t, .55)); c.fillStyle = lin(c, -30, -30, 30, 30, [[0, P.light()], [.5, P.main()], [1, P.dark()]]); c.fill(); noGlow(c);
      c.globalCompositeOperation = 'lighter'; ribbon(c, pts, t => 3.6 * taper(t, .55)); c.fillStyle = W(.95); c.fill(); c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  };
  one(false); if (x) one(true);
  c.restore();
};
M.claw = (c, P, R, o) => {
  bloom(c, 48, 48, 46, P.main(.7));
  const n = o.x ? 2 : o.n || (R() < .3 ? 2 : R() < .2 ? 4 : 3);
  M.clawMarks(c, P, R, n, o.x ? .9 : 1, o.x);
  c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) sparkle(c, 14 + R() * 68, 14 + R() * 68, 2 + R() * 3, W(.85)); c.globalCompositeOperation = 'source-over';
};
// 엄니 (위아래 이빨)
M.fang = (c, P, R) => {
  bloom(c, 48, 48, 46, P.main(.75));
  const tilt = (R() - .5) * .3, gap = 6 + R() * 4;
  c.save(); c.translate(48, 48); c.rotate(tilt);
  const jaw = (dir) => {
    c.save(); c.scale(1, dir);
    const base = x => -gap - 18 + (x * x) * .006;
    ribbon(c, (() => { const p = []; for (let x = -36; x <= 36; x += 4) p.push([x, base(x) - 2]); return p; })(), t => 7 * taper(t, .3) + 2);
    glow(c, P.main(), 8); c.fillStyle = lin(c, 0, -40, 0, -10, [[0, P.dark()], [1, P.main()]]); c.fill(); noGlow(c);
    const xs = [-28, -17, -6, 6, 17, 28];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i] + (dir < 0 ? 5 : 0), y = base(x), big = i === 1 || i === 4, L = big ? 26 : 13, w = big ? 6.5 : 5;
      c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w * .6, y + L * .7, x + (x < 0 ? 1.5 : -1.5), y + L); c.quadraticCurveTo(x + w * .7, y + L * .5, x + w, y); c.closePath();
      glow(c, P.main(), 6); c.fillStyle = lin(c, x - w, y, x + w, y + L, [[0, '#ffffff'], [.6, '#efe8d8'], [1, '#a89a88']]); c.fill(); noGlow(c);
      c.strokeStyle = P.deep(.8); c.lineWidth = 1; c.stroke();
    }
    c.restore();
  };
  jaw(1); jaw(-1); c.restore();
  c.globalCompositeOperation = 'lighter'; bloom(c, 48, 48, 14, P.hot(.8)); sparkle(c, 48, 48, 12, W(.9)); c.globalCompositeOperation = 'source-over';
};
// 주먹 (정면) + 충격
// 주먹 몸통 (원점 중심, 약 50×66)
function fistBody(c, P, glowOn = true) {
  const fill = (y0, y1) => lin(c, 0, y0, 0, y1, [[0, P.hot()], [.3, P.light()], [.75, P.main()], [1, P.dark()]]);
  const seg = (x, y, w, h, r, y0, y1) => { rr(c, x, y, w, h, r); c.fillStyle = fill(y0 ?? y, y1 ?? y + h); c.fill(); c.strokeStyle = P.deep(); c.lineWidth = 2; c.stroke(); };
  if (glowOn) { glow(c, P.main(), 14); rr(c, -24, -26, 49, 62, 12); c.fillStyle = P.main(); c.fill(); noGlow(c); }
  seg(-12, 18, 26, 22, 5, 18, 40);
  seg(-23, -12, 47, 36, 11, -20, 30);
  for (let i = 0; i < 4; i++) { seg(-23.5 + i * 11.75, -26, 12, 26, 6, -26, 0); c.beginPath(); c.ellipse(-17.5 + i * 11.75, -21, 3.2, 1.6, 0, 0, TAU); c.fillStyle = W(.85); c.fill(); }
  c.save(); c.rotate(-.08); seg(-25, 4, 33, 12.5, 6.2, 4, 17); c.restore();
  c.beginPath(); c.ellipse(-12, 8, 6, 1.6, -.08, 0, TAU); c.fillStyle = W(.6); c.fill();
}
// 주먹: streak 'up'|'side'|'down' 속도선 · ghosts 잔상 수 · burst 뒤 폭발 · debris 파편
M.fist = (c, P, R, o) => {
  const ang = o.streak === 'up' ? -.3 : (R() - .5) * .5, flip = R() < .5, fx = o.ghosts ? 54 : 48, fy = o.streak === 'up' ? 46 : 52;
  bloom(c, 48, 48, 48, P.main(.8));
  if (o.burst) M.burst(c, P, R); else M.starShape(c, P, R, fx, fy - 4, 44, 30, 12, .5);
  c.save(); c.globalCompositeOperation = 'lighter';
  if (o.streak) {
    const d = { up: [0, 1], side: [-1, .35], down: [-.5, -1] }[o.streak];
    for (let i = 0; i < 9; i++) { const s = (i - 4) * 6, x = fx - d[1] * s + d[0] * 26, y = fy + d[0] * s + d[1] * 26, L = 26 + R() * 22; streak(c, x + d[0] * L, y + d[1] * L, x, y, 3 + R() * 3, W(.6)); }
  } else for (let i = 0; i < 10; i++) { const a = R() * TAU, r0 = 30 + R() * 6; line(c, [[48 + Math.cos(a) * r0, 48 + Math.sin(a) * r0], [48 + Math.cos(a) * (r0 + 14 + R() * 10), 48 + Math.sin(a) * (r0 + 14 + R() * 10)]]); c.strokeStyle = W(.55); c.lineWidth = 1.2; c.stroke(); }
  c.restore();
  for (let g = o.ghosts || 0; g >= 1; g--) {   // 잔상 주먹
    c.save(); c.globalAlpha = .45 - g * .1; c.translate(fx - g * 15, fy + g * 9); c.rotate(ang - g * .12); if (flip) c.scale(-1, 1); c.scale(.8 - g * .06, .8 - g * .06); fistBody(c, P, false); c.restore();
  }
  c.save(); c.translate(fx, fy); c.rotate(ang); if (flip) c.scale(-1, 1); c.scale(o.ghosts ? .84 : .92, o.ghosts ? .84 : .92); fistBody(c, P); c.restore();
  if (o.debris) for (let i = 0; i < 7; i++) { const a = R() * TAU, d = 34 + R() * 10; rock(c, 48 + Math.cos(a) * d, 48 + Math.sin(a) * d, 3 + R() * 3.5, R, P, 6, .3); }
};
// 발차기 (휘두른 궤적 + 끝 충격)
M.kick = (c, P, R, o) => {
  bloom(c, 48, 48, 48, P.main(.8));
  c.save(); if (R() < .5) { c.translate(96, 0); c.scale(-1, 1); }
  const n = o.twin ? 2 : 1;
  for (let k = n - 1; k >= 0; k--) {
    const pts = arcPts(58 + k * 6, 68 - k * 10, 42 - k * 8, rad(165), rad(292), 32), e = pts[32], a = k ? .55 : 1;
    c.globalAlpha = a; glow(c, P.main(), 12); ribbon(c, pts, t => 22 * Math.pow(t, 1.3) * Math.min(1, (1 - t) * 8 + .25)); c.fillStyle = lin(c, 10, 80, e[0], e[1], [[0, P.main(0)], [.6, P.main()], [1, P.light()]]); c.fill(); noGlow(c);
    c.globalCompositeOperation = 'lighter'; ribbon(c, pts, t => 8 * Math.pow(t, 1.3) * Math.min(1, (1 - t) * 8 + .25)); c.fillStyle = W(.85); c.fill(); c.globalCompositeOperation = 'source-over';
    if (!k) M.starShape(c, P, R, e[0] + 2, e[1] + 2, 24, 10, 8);
    c.globalAlpha = 1;
  }
  c.restore();
};
// 뾰족 별 모양 충격 (공용)
M.starShape = (c, P, R, x, y, ro, ri, n, a = 1) => {
  const pts = []; const off = R() * TAU;
  for (let i = 0; i < n * 2; i++) { const an = off + i / (n * 2) * TAU, q = i % 2 ? ri * (.75 + R() * .3) : ro * (.75 + R() * .3); pts.push([x + Math.cos(an) * q, y + Math.sin(an) * q]); }
  c.globalAlpha = a; glow(c, P.main(), 12); poly(c, pts); c.fillStyle = radl(c, x, y, 0, ro, [[0, W()], [.3, P.hot()], [.6, P.light()], [1, P.main()]]); c.fill(); noGlow(c);
  poly(c, pts.map(([px, py]) => [x + (px - x) * .5, y + (py - y) * .5])); c.fillStyle = W(.9); c.fill(); c.globalAlpha = 1;
};
M.impact = (c, P, R) => {
  bloom(c, 48, 48, 48, P.main(.8));
  M.starShape(c, P, R, 48, 48, 44, 18, 9 + (R() * 4 | 0));
  c.globalCompositeOperation = 'lighter';
  c.beginPath(); c.ellipse(48, 48, 36, 30, R(), 0, TAU); c.strokeStyle = W(.5); c.lineWidth = 2; c.stroke();
  for (let i = 0; i < 6; i++) sparkle(c, 10 + R() * 76, 10 + R() * 76, 2 + R() * 3, W(.85));
  c.globalCompositeOperation = 'source-over';
};
// 번개 (⚡ + 갈래 번개)
M.bolt = (c, P, R, o) => {
  bloom(c, 48, 48, 48, P.main(.8));
  c.globalCompositeOperation = 'lighter';
  const nb = 3 + (R() * 3 | 0);
  for (let i = 0; i < nb; i++) { const a = R() * TAU, x0 = 48 + Math.cos(a) * 10, y0 = 48 + Math.sin(a) * 14; zap(c, jag(R, x0, y0, 48 + Math.cos(a) * 46, 48 + Math.sin(a) * 46, 5, 5), P.light(), 1.8); }
  if (o.dash) for (let i = 0; i < 5; i++) { const q = (i - 2) * 7; streak(c, 0, 70 + q, 34, 52 + q * .6, 3, P.light(.6)); }
  c.globalCompositeOperation = 'source-over';
  c.save(); c.translate(48, 48); c.rotate((R() - .5) * .5); if (R() < .5) c.scale(-1, 1); c.scale(.95, .95); c.translate(-49, -48);
  glow(c, P.main(), 16); poly(c, BOLT); c.fillStyle = lin(c, 30, 4, 66, 92, [[0, W()], [.35, P.hot()], [.7, P.light()], [1, P.main()]]); c.fill(); noGlow(c);
  poly(c, [[58, 4], [22, 52], [45, 52], [52, 38], [68, 4]]); c.fillStyle = W(.45); c.fill();
  poly(c, BOLT); c.strokeStyle = P.dark(); c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
  c.restore();
  c.globalCompositeOperation = 'lighter'; sparkle(c, 40, 50, 9, W()); c.globalCompositeOperation = 'source-over';
};
// 먹구름 + 낙뢰
M.cloud = (c, P, R) => {
  bloom(c, 48, 60, 44, P.main(.7));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) { const x = 14 + R() * 70; line(c, [[x, 44 + R() * 10], [x - 6, 70 + R() * 20]]); c.strokeStyle = W(.25); c.lineWidth = 1; c.stroke(); }
  c.globalCompositeOperation = 'source-over';
  c.save(); c.translate(48, 50); c.rotate((R() - .5) * .3); c.scale(.62, .62); c.translate(-49, -36);
  glow(c, P.main(), 16); poly(c, BOLT); c.fillStyle = lin(c, 30, 4, 66, 92, [[0, W()], [.35, P.hot()], [1, P.main()]]); c.fill(); noGlow(c);
  c.restore();
  c.globalCompositeOperation = 'lighter'; zap(c, jag(R, 30, 40, 18, 86, 5, 5), P.light(), 1.8); zap(c, jag(R, 66, 40, 80, 82, 5, 5), P.light(), 1.6); c.globalCompositeOperation = 'source-over';
  const puffs = [[22, 32, 13], [38, 22, 16], [58, 20, 17], [74, 32, 13], [48, 36, 16], [30, 38, 11], [66, 40, 11]];
  c.beginPath(); for (const [x, y, r] of puffs) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
  glow(c, B(.7), 8); c.fillStyle = lin(c, 0, 6, 0, 52, [[0, '#8a90a8'], [.5, '#4a4e66'], [1, '#22243a']]); c.fill(); noGlow(c);
  c.globalCompositeOperation = 'lighter';
  c.beginPath(); for (const [x, y, r] of puffs) { c.moveTo(x + r, y); c.arc(x, y + 4, r * .8, 0, TAU); } c.fillStyle = radl(c, 48, 50, 0, 28, [[0, P.light(.55)], [1, 'rgba(0,0,0,0)']]); c.fill();
  c.beginPath(); for (const [x, y, r] of puffs) { c.moveTo(x - r * .5, y - r * .7); c.arc(x - r * .25, y - r * .55, r * .3, 0, TAU); } c.fillStyle = W(.12); c.fill();
  c.globalCompositeOperation = 'source-over';
};
// 잎사귀 회오리 / 잎 칼날
M.leaves = (c, P, R, o) => {
  bloom(c, 48, 48, 46, P.main(.7));
  if (o.blade) {
    M.clawMarks(c, P, R, 2, .85);
    leaf(c, 18, 80, 76, 15, rad(-45 + (R() - .5) * 10), P, { stops: [[0, P.dark()], [.4, P.main()], [1, W()]] });
    return;
  }
  const n = o.n || 3 + (R() * 3 | 0), rot = R() * TAU, dir = R() < .5 ? 1 : -1;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; ribbon(c, arcPts(48, 48, 26, a - dir * 1.5, a, 20), t => 5 * t); c.fillStyle = P.light(.45); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < n; i++) {
    const a = rot + i * TAU / n, x = 48 + Math.cos(a) * 10, y = 48 + Math.sin(a) * 10;
    leaf(c, x, y, 36 - n * 1.5, 11, a + dir * .9, P);
  }
  if (o.sparkle) { c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) sparkle(c, 10 + R() * 76, 10 + R() * 76, 2.5 + R() * 3.5, W(.9)); c.globalCompositeOperation = 'source-over'; }
};
// 덩굴 채찍 (나선으로 감기는 덩굴)
M.vine = (c, P, R, o) => {
  bloom(c, 52, 44, 44, P.main(.6));
  const cx = 54 + (R() - .5) * 6, cy = 40, a0 = rad(150), turns = 4.6 + R() * .8, pts = [];
  for (let i = 0; i <= 50; i++) { const t = i / 50, a = a0 - t * turns, r = 46 * Math.pow(1 - t, .9) + 4; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * .95]); }
  glow(c, P.main(), 8); ribbon(c, pts, t => 12 * (1 - t) + 2); c.fillStyle = lin(c, 0, 96, 60, 10, [[0, P.deep()], [.4, P.dark()], [1, P.main()]]); c.fill(); noGlow(c);
  line(c, pts.slice(2, 46).map(([x, y], i) => [x - 1.5 * (1 - i / 46), y - 1.5 * (1 - i / 46)])); c.strokeStyle = P.light(.8); c.lineWidth = 1.2; c.stroke();
  for (let i = 6; i < 44; i += 7) {
    const p = pts[i], q = pts[i + 1], a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    if (o.thorn) { c.save(); c.translate(p[0], p[1]); c.rotate(a); poly(c, [[-3, -4], [0, -12], [3, -4]]); c.fillStyle = P.hot(); c.fill(); c.restore(); }
    else leaf(c, p[0], p[1], 16 - i * .15, 6, a - PI / 2 - .5, P, { blur: 3, noVein: 1 });
  }
};
// 꽃잎 폭풍 (나선으로 도는 꽃잎 / 잎)
M.petals = (c, P, R, o) => {
  bloom(c, 48, 48, 46, o.leafy ? P.main(.7) : 'rgba(255,150,200,.6)');
  const n = o.leafy ? 13 : 18, rot = R() * TAU, dir = R() < .5 ? 1 : -1;
  c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) { const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30, a = rot + k * TAU / 3 + dir * t * 4, r = 4 + 40 * t; pts.push([48 + Math.cos(a) * r, 48 + Math.sin(a) * r * .85]); } ribbon(c, pts, t => 6 * taper(t)); c.fillStyle = (o.leafy ? P.light : P.hot)(.35); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, a = rot + dir * t * 4 + i * 2.4, r = 6 + 38 * t, x = 48 + Math.cos(a) * r, y = 48 + Math.sin(a) * r * .85, s = 4 + t * 6;
    if (o.leafy || i % 5 === 4) { leaf(c, x, y, s * 2.4, s * .8, a + dir * 1.4, P, { blur: 3, noVein: 1 }); continue; }
    c.save(); c.translate(x, y); c.rotate(a + R() * 2);
    c.beginPath(); c.moveTo(0, s); c.bezierCurveTo(s * 1.3, s * .2, s * .8, -s, s * .2, -s * .9); c.lineTo(0, -s * .55); c.lineTo(-s * .2, -s * .9); c.bezierCurveTo(-s * .8, -s, -s * 1.3, s * .2, 0, s);
    glow(c, 'rgba(255,120,190,.9)', 5); c.fillStyle = lin(c, 0, s, 0, -s, [[0, '#ff6aa8'], [.6, '#ffb8d8'], [1, '#ffffff']]); c.fill(); noGlow(c);
    c.restore();
  }
};
// 씨앗 연사 / 씨폭탄
M.seeds = (c, P, R) => {
  bloom(c, 48, 48, 44, P.main(.6));
  const n = 3 + (R() * 3 | 0), ang = rad(-35 - R() * 20), dx = Math.cos(ang), dy = Math.sin(ang);
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 15 + (R() - .5) * 6, d = 18 + R() * 30, x = 22 + dx * d - dy * o + 10, y = 72 + dy * d + dx * o - 14, s = 6 + R() * 3;
    c.globalCompositeOperation = 'lighter'; streak(c, x - dx * 34, y - dy * 34, x, y, s * 1.4, P.light(.55)); c.globalCompositeOperation = 'source-over';
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(s * 1.6, 0); c.bezierCurveTo(s * .9, -s * 1.1, -s * 1.1, -s, -s * 1.1, 0); c.bezierCurveTo(-s * 1.1, s, s * .9, s * 1.1, s * 1.6, 0);
    glow(c, P.main(), 8); c.fillStyle = radl(c, 0, 0, 0, s * 1.6, [[0, '#f8e2a0'], [.5, '#c89048'], [1, '#6a4020']], -s * .3, -s * .4); c.fill(); noGlow(c);
    c.strokeStyle = '#3a2010'; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.ellipse(-s * .2, -s * .45, s * .5, s * .18, 0, 0, TAU); c.fillStyle = W(.7); c.fill();
    c.restore();
  }
  c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) sparkle(c, 50 + R() * 40, 8 + R() * 40, 2.5 + R() * 3, P.hot(.9)); c.globalCompositeOperation = 'source-over';
};
// 흡수 (빨려드는 빛줄기)
M.drain = (c, P, R) => {
  bloom(c, 48, 48, 46, P.main(.75));
  const n = 6 + (R() * 3 | 0), dir = R() < .5 ? 1 : -1;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU + R() * .4, pts = [];
    for (let k = 0; k <= 24; k++) { const t = k / 24, a = a0 + dir * t * 1.8, r = 46 - 36 * t; pts.push([48 + Math.cos(a) * r, 48 + Math.sin(a) * r]); }
    glow(c, P.main(), 6); ribbon(c, pts, t => 1 + 5 * t * (1 - t) * 3); c.fillStyle = (i % 2 ? P.light : P.hot)(.8); c.fill(); noGlow(c);
    ember(c, pts[0][0], pts[0][1], 3, P.light());
  }
  c.globalCompositeOperation = 'source-over';
  sphere(c, 48, 48, 13, P, W());
  c.globalCompositeOperation = 'lighter'; sparkle(c, 48, 48, 18, W(.8)); c.globalCompositeOperation = 'source-over';
};
// 얼음 결정 / 바위 칼날
M.crystals = (c, P, R) => {
  bloom(c, 48, 60, 46, P.main(.7));
  const n = 5 + (R() * 3 | 0), items = [];
  for (let i = 0; i < n; i++) { const u = i / (n - 1) * 2 - 1; items.push({ u, a: u * rad(58) + (R() - .5) * .2, L: 62 - Math.abs(u) * 26 + R() * 8, w: 15 - Math.abs(u) * 5 }); }
  items.sort((a, b) => a.L - b.L);
  for (const it of items) prism(c, 48 + it.u * 14, 88, it.L, it.w, it.a, P);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) sparkle(c, 10 + R() * 76, 8 + R() * 50, 2.5 + R() * 4, W(.9));
  bloom(c, 48, 86, 22, P.hot(.6));
  c.globalCompositeOperation = 'source-over';
};
// 떨어지는 바위 / 구르는 바위
M.boulders = (c, P, R, o) => {
  bloom(c, 48, 52, 46, P.main(.55));
  if (o.roll) {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const r = 32 + i * 3; ribbon(c, arcPts(52, 50, r, rad(110 + i * 8), rad(230 + i * 4), 20), t => 3 * taper(t)); c.fillStyle = P.light(.5); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(12 + R() * 28, 78 + R() * 12, 4 + R() * 6, 0, TAU); c.fillStyle = 'rgba(180,160,130,.35)'; c.fill(); }
    rock(c, 54, 48, 30, R, P, 13, .08);
    for (let i = 0; i < 3; i++) { const a = R() * TAU; c.beginPath(); c.arc(54, 48, 14 + i * 5, a, a + 1.2); c.strokeStyle = B(.35); c.lineWidth = 1.5; c.stroke(); }
    return;
  }
  const n = 2 + (R() < .5 ? 1 : 0), spots = [[56, 40, 22], [26, 64, 14], [76, 74, 11]];
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const [x, y, r] = spots[i]; streak(c, x + 30, y - 40, x, y, r * 1.6, P.light(.35)); }
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(10 + R() * 76, 82 + R() * 10, 5 + R() * 7, 0, TAU); c.fillStyle = 'rgba(190,170,140,.25)'; c.fill(); }
  for (let i = n - 1; i >= 0; i--) { const [x, y, r] = spots[i]; rock(c, x + (R() - .5) * 6, y + (R() - .5) * 6, r, R, P); }
  for (let i = 0; i < 6; i++) rock(c, 10 + R() * 76, 70 + R() * 20, 2 + R() * 2.5, R, P, 5);
};
// 지면 균열 (지진 · 대지의힘 · 구멍파기)
M.fissure = (c, P, R, o) => {
  c.beginPath(); c.moveTo(-2, 52); c.bezierCurveTo(30, 46, 66, 46, 98, 52); c.lineTo(98, 98); c.lineTo(-2, 98); c.closePath();
  c.fillStyle = lin(c, 0, 46, 0, 96, [[0, P.dark()], [.4, P.deep()], [1, '#0a0604']]); c.fill();
  const crack = jag(R, -2, 62 + R() * 8, 98, 68 + R() * 10, 7, 7);
  const cw = (t) => 2 + 6 * taper(t, .5);
  glow(c, P.main(), 14); ribbon(c, crack, cw); c.fillStyle = P.light(); c.fill(); noGlow(c);
  ribbon(c, crack, t => cw(t) * .4); c.fillStyle = W(.95); c.fill();
  for (let i = 0; i < 3; i++) { const p = crack[2 + i * 2]; const br = jag(R, p[0], p[1], p[0] + (R() - .5) * 24, 92 + R() * 6, 3, 4); glow(c, P.main(), 6); ribbon(c, br, t => 3 * (1 - t) + .5); c.fillStyle = P.light(.9); c.fill(); noGlow(c); }
  if (o.pillars) {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const p = crack[1 + i * 2 + (R() * 2 | 0)], w = 8 + R() * 6; c.fillStyle = lin(c, 0, p[1], 0, 0, [[0, P.hot(.9)], [.6, P.light(.4)], [1, P.main(0)]]); c.fillRect(p[0] - w / 2, 0, w, p[1]); c.fillStyle = lin(c, 0, p[1], 0, 10, [[0, W(.9)], [1, W(0)]]); c.fillRect(p[0] - w / 6, 6, w / 3, p[1] - 6); }
    c.globalCompositeOperation = 'source-over';
  }
  for (let i = 0; i < 7; i++) { const x = 10 + R() * 76, y = 8 + R() * 42; rock(c, x, y, 3 + R() * 5, R, P, 6, .3); c.globalCompositeOperation = 'lighter'; streak(c, x, y + 16, x, y + 4, 3, P.light(.3)); c.globalCompositeOperation = 'source-over'; }
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(R() * 96, 52 + R() * 8, 6 + R() * 8, 0, TAU); c.fillStyle = 'rgba(200,180,150,.18)'; c.fill(); }
};
// 내려찍기 (위에서 떨어지는 힘 + 충격파 + 파편)
M.slam = (c, P, R) => {
  bloom(c, 48, 70, 44, P.main(.8));
  c.fillStyle = lin(c, 0, 72, 0, 96, [[0, P.dark()], [1, P.deep()]]); c.fillRect(0, 72, 96, 24);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) { const x = 48 + (i - 3) * 9 + (R() - .5) * 4; streak(c, x + (i - 3) * 4, 0, x, 50, 2.5 + (3 - Math.abs(i - 3)) * 1.6, P.light(.6)); }
  glow(c, P.main(), 10);
  for (let i = 0; i < 3; i++) { ribbon(c, arcPts(48, 72, 16 + i * 13, PI, TAU, 30, .55), t => (5 - i) * taper(t, .5)); c.fillStyle = (i ? P.light : P.hot)(.85 - i * .2); c.fill(); }
  noGlow(c);
  bloom(c, 48, 72, 22, W(.95));
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 3; i++) { glow(c, P.main(), 6); ribbon(c, jag(R, 48 + (i - 1) * 6, 74, 48 + (i - 1) * 30, 96, 3, 3), t => 3 * (1 - t) + .5); c.fillStyle = P.light(); c.fill(); noGlow(c); }
  for (let i = 0; i < 7; i++) { const s = R() < .5 ? -1 : 1; rock(c, 48 + s * (14 + R() * 30), 44 + R() * 26, 2.5 + R() * 3.5, R, P, 6, .3); }
};
// 용의 기운 (이중 나선 + 용 머리 불꽃)
M.dragon = (c, P, R) => {
  const x0 = 8, y0 = 88, x1 = 80, y1 = 18, dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d, f = 2.2 + R() * .8;
  bloom(c, 50, 46, 48, P.main(.8));
  const helix = ph => { const p = []; for (let i = 0; i <= 40; i++) { const t = i / 40, s = Math.sin(t * PI * f + ph) * 14 * Math.sin(PI * Math.min(1, t * 1.1)); p.push([x0 + dx * t + nx * s, y0 + dy * t + ny * s]); } return p; };
  for (const [ph, col] of [[PI, P.acc], [0, P.main]]) {
    const pts = helix(ph);
    glow(c, col(), 12); ribbon(c, pts, t => 3 + 9 * Math.sin(PI * t * .9 + .1)); c.fillStyle = col(.95); c.fill(); noGlow(c);
    c.globalCompositeOperation = 'lighter'; ribbon(c, pts, t => 1 + 3 * Math.sin(PI * t)); c.fillStyle = W(.8); c.fill(); c.globalCompositeOperation = 'source-over';
    for (let i = 6; i < 36; i += 5) { const p = pts[i], q = pts[i + 1], a = Math.atan2(q[1] - p[1], q[0] - p[0]); c.save(); c.translate(p[0], p[1]); c.rotate(a); poly(c, [[-4, -3], [3, -11], [2, -3]]); c.fillStyle = col === P.main ? P.light() : P.accL(); c.fill(); c.restore(); }
  }
  flame(c, x1, y1, 18, 30, Math.atan2(dy, dx) + PI / 2, 0, P);
  c.globalCompositeOperation = 'lighter'; bloom(c, x1 - 4, y1 + 4, 14, W(.9)); bloom(c, x0 + 6, y0 - 6, 12, P.hot(.7)); c.globalCompositeOperation = 'source-over';
};
// 유성 낙하
M.meteors = (c, P, R) => {
  bloom(c, 30, 70, 44, P.main(.75));
  const n = 3 + (R() * 2 | 0);
  for (let i = 0; i < n; i++) {
    const x = 18 + i * (60 / n) + R() * 10, y = 40 + R() * 42 - i * 6, r = 4 + R() * 5 + (i === 0 ? 3 : 0), L = 40 + R() * 24;
    c.globalCompositeOperation = 'lighter';
    streak(c, x + L * .7, y - L * .7, x, y, r * 2.4, P.main(.8)); streak(c, x + L * .55, y - L * .55, x, y, r * 1.2, P.hot(.9));
    c.globalCompositeOperation = 'source-over';
    sphere(c, x, y, r, P, W());
    c.globalCompositeOperation = 'lighter'; bloom(c, x, y, r * 2.6, P.light(.6)); c.globalCompositeOperation = 'source-over';
  }
  c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) sparkle(c, 10 + R() * 76, 8 + R() * 40, 2 + R() * 2.5, W(.85)); c.globalCompositeOperation = 'source-over';
};
// 초승달 + 달빛 구체
M.moon = (c, P, R) => {
  const cx = 48, cy = 48, r = 28, ox = 11 + R() * 4, oy = -9 - R() * 4;
  bloom(c, cx, cy, 48, P.main(.9));
  c.globalCompositeOperation = 'lighter'; c.beginPath(); c.arc(cx, cy, r + 4, 0, TAU); c.fillStyle = radl(c, cx, cy, r * .3, r + 4, [[0, P.light(.0)], [.85, P.light(.35)], [1, P.hot(.0)]]); c.fill(); c.globalCompositeOperation = 'source-over';
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
  c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.arc(cx + ox, cy + oy, r * .88, 0, TAU, true);
  c.fillStyle = radl(c, cx - 8, cy + 6, 0, r * 1.2, [[0, W()], [.4, '#fff4fa'], [.8, P.light()], [1, P.main()]]); c.fill();
  c.restore();
  glow(c, P.light(), 16); c.beginPath(); c.arc(cx, cy, r, rad(80), rad(250)); c.strokeStyle = W(.9); c.lineWidth = 1.4; c.stroke(); noGlow(c);
  for (const [x, y, s] of [[38, 62, 3], [30, 44, 2.2], [44, 70, 1.8]]) { c.beginPath(); c.arc(x, y, s, 0, TAU); c.fillStyle = P.main(.35); c.fill(); }
  c.globalCompositeOperation = 'lighter';
  sparkle(c, 70, 26, 10, W()); for (let i = 0; i < 6; i++) sparkle(c, 10 + R() * 76, 10 + R() * 76, 2 + R() * 3.5, P.hot(.9));
  c.globalCompositeOperation = 'source-over';
};
// 반짝이 폭발 (페어리)
M.sparkles = (c, P, R) => {
  bloom(c, 48, 48, 48, P.main(.85));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(48, 48, 22 + i * 12, 0, TAU); c.strokeStyle = P.light(.45 - i * .15); c.lineWidth = 2; c.stroke(); }
  glow(c, P.main(), 14); sparkle(c, 48, 48, 30, W()); noGlow(c);
  sparkle(c, 48, 48, 18, P.hot());
  for (let i = 0; i < 7; i++) { const a = R() * TAU, d = 24 + R() * 16; glow(c, P.main(), 6); sparkle(c, 48 + Math.cos(a) * d, 48 + Math.sin(a) * d, 3 + R() * 6, W(.95)); noGlow(c); }
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 4; i++) { const x = 14 + R() * 68, y = 14 + R() * 68, s = 3 + R() * 2; c.beginPath(); c.moveTo(x, y + s); c.bezierCurveTo(x - s * 2, y - s * .3, x - s * .6, y - s * 1.6, x, y - s * .5); c.bezierCurveTo(x + s * .6, y - s * 1.6, x + s * 2, y - s * .3, x, y + s); c.fillStyle = '#ff8ac8'; c.fill(); }
};
// 강철 칼날 (크롬)
M.blade = (c, P, R) => {
  bloom(c, 48, 48, 46, P.main(.6));
  c.save(); c.translate(22, 76); c.rotate(rad(-45 + (R() - .5) * 14));
  glow(c, P.light(), 12);
  poly(c, [[6, -7], [58, -7], [76, 0], [58, 7], [6, 7]]); c.fillStyle = '#6a7488'; c.fill(); noGlow(c);
  poly(c, [[6, -7], [58, -7], [76, 0], [6, 0]]); c.fillStyle = lin(c, 0, -7, 0, 0, [[0, W()], [.5, '#dfe8f8'], [1, '#9aa8c0']]); c.fill();
  poly(c, [[6, 0], [76, 0], [58, 7], [6, 7]]); c.fillStyle = lin(c, 0, 0, 0, 7, [[0, '#5a6478'], [1, '#2a3040']]); c.fill();
  line(c, [[6, 0], [74, 0]]); c.strokeStyle = W(.9); c.lineWidth = .8; c.stroke();
  rr(c, -2, -14, 8, 28, 3); c.fillStyle = lin(c, 0, -14, 0, 14, [[0, P.light()], [1, P.dark()]]); c.fill(); c.strokeStyle = B(.6); c.lineWidth = 1; c.stroke();
  rr(c, -20, -4, 18, 8, 3); c.fillStyle = P.deep(); c.fill();
  c.restore();
  c.globalCompositeOperation = 'lighter'; sparkle(c, 66, 32, 11, W()); M.clawMarks(c, P, R, 2, .7); c.globalCompositeOperation = 'source-over';
};
// 독 덩어리 + 흘러내림
M.sludge = (c, P, R) => {
  bloom(c, 48, 46, 46, P.main(.75));
  c.beginPath(); c.ellipse(48, 86, 30, 6.5, 0, 0, TAU); c.fillStyle = radl(c, 48, 86, 0, 30, [[0, P.light(.8)], [.6, P.main(.7)], [1, P.dark(0)]]); c.fill();
  const x = 48, y = 38, r = 25, ph = R() * TAU, fill = () => radl(c, x, y + 10, 0, 50, [[0, P.light()], [.35, P.main()], [.8, P.dark()], [1, P.deep()]], x - 8, y - 12);
  const drips = [[-14, 20, 3.6], [0, 34, 4.4], [14, 24, 3.6]].map(([dx, L, w]) => [dx + (R() - .5) * 4, L + (R() - .5) * 8, w]);
  glow(c, P.main(), 14);
  for (const [dx, L, w] of drips) {   // 흘러내림: 몸통에서 아래로 늘어진 방울
    const bx = x + dx, by = y + Math.sqrt(r * r - dx * dx) - 6;
    c.beginPath(); c.moveTo(bx - w * 1.3, by); c.bezierCurveTo(bx - w * .5, by + L * .5, bx - w * 1.1, by + L - w, bx - w, by + L - w * .4);
    c.arc(bx, by + L - w * .4, w, PI, 0, true); c.bezierCurveTo(bx + w * 1.1, by + L - w, bx + w * .5, by + L * .5, bx + w * 1.3, by); c.closePath();
    c.fillStyle = fill(); c.fill();
  }
  const pts = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, q = r + Math.sin(a * 5 + ph) * 2.2; pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q * .92]); }
  poly(c, pts); c.fillStyle = fill(); c.fill(); noGlow(c);
  for (const [dx, L] of drips) { c.beginPath(); c.arc(x + dx + 1, y + 34 + L * .7, 2.4, 0, TAU); c.fillStyle = P.light(.9); c.fill(); }
  c.beginPath(); c.ellipse(x - 8, y - 10, 7, 3.6, -.6, 0, TAU); c.fillStyle = W(.85); c.fill();
  c.beginPath(); c.arc(x, y, r - 3, rad(20), rad(110)); c.strokeStyle = B(.25); c.lineWidth = 3; c.stroke();
  for (let i = 0; i < 6; i++) { const a = R() * TAU, d = R() * 14, bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d * .8, br = 1.6 + R() * 3.2; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fillStyle = P.light(.35); c.fill(); c.strokeStyle = P.hot(.8); c.lineWidth = 1; c.stroke(); }
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { const bx = 12 + R() * 72, by = 8 + R() * 26; c.beginPath(); c.arc(bx, by, 2 + R() * 3, 0, TAU); c.strokeStyle = P.light(.8); c.lineWidth = 1.2; c.stroke(); }
  c.globalCompositeOperation = 'source-over';
};
// 벌레 침 + 거미줄
M.stinger = (c, P, R) => {
  bloom(c, 48, 48, 46, P.main(.6));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; line(c, [[78, 78], [78 + Math.cos(a) * 60, 78 + Math.sin(a) * 60]]); c.strokeStyle = W(.22); c.lineWidth = .8; c.stroke(); }
  for (let k = 1; k < 4; k++) { c.beginPath(); c.arc(78, 78, k * 14, PI, PI * 1.5); c.strokeStyle = W(.2); c.stroke(); }
  c.globalCompositeOperation = 'source-over';
  c.save(); c.translate(22, 76); c.rotate(rad(-45 + (R() - .5) * 16));
  c.beginPath(); c.moveTo(0, -13); c.quadraticCurveTo(40, -9, 74, 0); c.quadraticCurveTo(40, 9, 0, 13); c.arc(0, 0, 13, PI / 2, PI * 1.5);
  glow(c, P.main(), 12); c.fillStyle = lin(c, 0, -13, 0, 13, [[0, P.hot()], [.4, P.light()], [.8, P.main()], [1, P.deep()]]); c.fill(); noGlow(c);
  c.save(); c.clip(); for (const x of [6, 18, 30]) { c.beginPath(); c.ellipse(x, 0, 2.5, 14, 0, 0, TAU); c.fillStyle = B(.45); c.fill(); } c.restore();
  c.restore();
  c.globalCompositeOperation = 'lighter'; sparkle(c, 74, 22, 9, W()); c.globalCompositeOperation = 'source-over';
};
// 날개 (위로 휜 앞날개 가장자리 + 아래로 늘어진 깃털, 틀에 맞춰 크기 조정) + 바람 칼날
M.wing = (c, P, R, o) => {
  bloom(c, 50, 46, 46, P.main(.8));
  const pair = R() < .35, fire = o.fire;
  c.save(); if (R() < .5) { c.translate(96, 0); c.scale(-1, 1); }
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { ribbon(c, arcPts(14, 100, 66 + i * 12, rad(-70), rad(-12), 24), t => 5 * taper(t)); c.fillStyle = P.light(.3); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  // 앞날개 가장자리: 어깨(왼쪽) → 손목(위) → 날개 끝(오른쪽)
  const A = [0, 34], C = [22, -10], T = [62, -4], edge = t => [(1 - t) ** 2 * A[0] + 2 * (1 - t) * t * C[0] + t * t * T[0], (1 - t) ** 2 * A[1] + 2 * (1 - t) * t * C[1] + t * t * T[1]];
  const n = 8, big = [], cov = [];
  for (let i = 0; i < n; i++) { const t = .1 + i / (n - 1) * .9, [x, y] = edge(t); big.push([x, y, 30 + i * 6 + (R() - .5) * 3, 10 + i * .4, rad(104 - i * 8.5 + (R() - .5) * 4)]); }
  for (let i = 0; i < 7; i++) { const t = .06 + i / 6 * .8, [x, y] = edge(t); cov.push([x, y, 18 + i * 2.2, 10.5, rad(98 - i * 8.5)]); }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;   // 깃털 끝까지 넣은 테두리 상자 → 틀 안에 맞춘다
  for (const [x, y, L, w, a] of big) for (const [px, py] of [[x, y], [x + Math.cos(a) * L, y + Math.sin(a) * L]]) { x0 = Math.min(x0, px - w / 2); y0 = Math.min(y0, py - w / 2); x1 = Math.max(x1, px + w / 2); y1 = Math.max(y1, py + w / 2); }
  y0 -= 4;
  const feather = (x, y, L, w, a, stops) => {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(0, -w / 2); c.lineTo(L - w * .9, -w / 2); c.quadraticCurveTo(L + w * .2, -w * .4, L, w * .1); c.quadraticCurveTo(L - w * .4, w / 2, L - w * 1.2, w / 2); c.lineTo(0, w / 2); c.closePath();
    c.fillStyle = lin(c, 0, 0, L, 0, stops); c.fill(); c.strokeStyle = P.deep(.7); c.lineWidth = 1; c.stroke();
    line(c, [[2, 0], [L - w * .6, 0]]); c.strokeStyle = W(.45); c.lineWidth = .8; c.stroke();
    c.restore();
  };
  const one = () => {
    const s1 = [[0, P.dark()], [.45, P.main()], [.8, P.light()], [1, fire ? P.hot() : W()]];
    glow(c, P.main(.9), 10); for (let i = n - 1; i >= 0; i--) feather(...big[i], s1); noGlow(c);
    for (let i = cov.length - 1; i >= 0; i--) feather(...cov[i], [[0, P.main()], [1, P.hot()]]);
    const ep = []; for (let i = 0; i <= 24; i++) ep.push(edge(i / 24));
    glow(c, P.light(), 8); ribbon(c, ep, t => 8 * (1 - t * .75)); c.fillStyle = lin(c, A[0], A[1], T[0], T[1], [[0, P.light()], [1, W()]]); c.fill(); noGlow(c);
    if (fire) { c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 10; i++) { const b = big[R() * n | 0]; ember(c, b[0] + Math.cos(b[4]) * b[2] * (.5 + R() * .6), b[1] + Math.sin(b[4]) * b[2] * (.5 + R() * .6), 2 + R() * 2.5, P.light()); } c.globalCompositeOperation = 'source-over'; }
  };
  const bw = x1 - x0, bh = y1 - y0;
  if (pair) {
    const k = Math.min(48 / bw, 80 / bh);
    for (const sx of [-1, 1]) { c.save(); c.translate(48 + sx * 2, 46 - bh * k / 2); c.rotate(sx * -.22); c.scale(sx * k, k); c.translate(-x0, -y0); one(); c.restore(); }
  } else {
    const k = Math.min(78 / bw, 76 / bh);
    c.save(); c.translate(48, 48); c.rotate((R() - .5) * .35); c.scale(k, k); c.translate(-(x0 + x1) / 2, -(y0 + y1) / 2); one(); c.restore();
  }
  c.restore();
};
// 회오리
M.tornado = (c, P, R) => {
  bloom(c, 48, 48, 46, P.main(.6));
  const ph = R() * TAU, n = 10;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), y = 16 + t * 66, rx = 36 - t * 28, x = 48 + Math.sin(t * 4 + ph) * 7 * t;
    glow(c, P.main(), 6);
    ribbon(c, arcPts(x, y, rx, rad(-20), rad(320), 30, .28), u => (4 - t * 2) * taper(u, .4)); c.fillStyle = (i % 2 ? P.light : P.main)(.75); c.fill(); noGlow(c);
    ribbon(c, arcPts(x, y, rx, rad(10), rad(170), 18, .28), u => 1.4 * taper(u)); c.fillStyle = W(.7); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 7; i++) { const t = R(), a = R() * TAU, r = 40 - t * 28; c.beginPath(); c.arc(48 + Math.cos(a) * r, 16 + t * 66 + Math.sin(a) * r * .28, 1.4 + R() * 2, 0, TAU); c.fillStyle = P.hot(.85); c.fill(); }
};
// 회전 (가운데 구슬 + 감도는 궤적)
M.spin = (c, P, R) => {
  bloom(c, 48, 48, 46, P.main(.7));
  const dir = R() < .5 ? 1 : -1, rot = R() * TAU;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const r = 22 + i * 7, a0 = rot + i * TAU / 3, pts = arcPts(48, 48, r, a0, a0 + dir * rad(220), 30);
    glow(c, P.main(), 10); ribbon(c, pts, t => 8 * Math.pow(t, 1.4)); c.fillStyle = P.light(.85); c.fill(); noGlow(c);
    ribbon(c, pts, t => 3 * Math.pow(t, 1.4)); c.fillStyle = W(.9); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  sphere(c, 48, 48, 14, P);
};
// 보호막 (육각 방패)
M.shield = (c, P, R, o) => {
  bloom(c, 48, 48, 48, P.main(.75));
  const hex = (r, x = 48, y = 48) => { const p = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - PI / 2; p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } return p; };
  if (o.spiky) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.save(); c.translate(48 + Math.cos(a) * 34, 48 + Math.sin(a) * 34); c.rotate(a + PI / 2); poly(c, [[-4, 0], [0, -12], [4, 0]]); glow(c, P.main(), 6); c.fillStyle = lin(c, 0, 0, 0, -12, [[0, P.main()], [1, W()]]); c.fill(); noGlow(c); c.restore(); }
  glow(c, P.main(), 14); poly(c, hex(36)); c.fillStyle = radl(c, 48, 48, 0, 36, [[0, P.main(.25)], [.7, P.main(.45)], [1, P.light(.85)]]); c.fill(); noGlow(c);
  c.save(); poly(c, hex(36)); c.clip();
  for (let gx = -2; gx <= 2; gx++) for (let gy = -3; gy <= 3; gy++) { const x = 48 + gx * 15 + (gy & 1) * 7.5, y = 48 + gy * 13; poly(c, hex(7.6, x, y)); c.strokeStyle = W(.16); c.lineWidth = 1; c.stroke(); }
  c.globalCompositeOperation = 'lighter';
  const bands = o.mirror ? 3 : 1;
  for (let i = 0; i < bands; i++) { c.save(); c.translate(36 + i * 16, 40 + i * 10); c.rotate(-.7); c.fillStyle = lin(c, -6, 0, 6, 0, [[0, W(0)], [.5, W(.5)], [1, W(0)]]); c.fillRect(-6, -50, 12 - i * 3, 100); c.restore(); }
  c.restore();
  glow(c, P.light(), 10); poly(c, hex(36)); c.strokeStyle = P.hot(); c.lineWidth = 3; c.lineJoin = 'round'; c.stroke(); noGlow(c);
  poly(c, hex(30)); c.strokeStyle = W(.5); c.lineWidth = 1; c.stroke();
  c.globalCompositeOperation = 'lighter'; sparkle(c, 34, 22, 7, W()); c.globalCompositeOperation = 'source-over';
};
// 회복 (솟는 오라 + 십자)
M.heal = (c, P, R, o) => {
  bloom(c, 48, 52, 46, P.main(.75));
  c.globalCompositeOperation = 'lighter';
  if (o.sun) { bloom(c, 48, 18, 30, 'rgba(255,240,150,.8)'); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; line(c, [[48 + Math.cos(a) * 12, 18 + Math.sin(a) * 12], [48 + Math.cos(a) * 26, 18 + Math.sin(a) * 26]]); c.strokeStyle = 'rgba(255,240,170,.6)'; c.lineWidth = 2; c.stroke(); } }
  c.beginPath(); c.ellipse(48, 80, 32, 9, 0, 0, TAU); c.strokeStyle = P.light(.7); c.lineWidth = 2; c.stroke();
  for (let i = 0; i < 6; i++) { const x = 20 + i * 11 + (R() - .5) * 4, h = 30 + R() * 34; c.fillStyle = lin(c, 0, 82, 0, 82 - h, [[0, P.light(.55)], [1, P.light(0)]]); rr(c, x - 3, 82 - h, 6, h, 3); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  const cross = () => { c.beginPath(); rr(c, 40, 28, 16, 44, 5); c.rect(0, 0, 0, 0); };
  glow(c, P.main(), 16); cross(); c.fillStyle = W(); c.fill(); rr(c, 26, 42, 44, 16, 5); c.fill(); noGlow(c);
  c.fillStyle = lin(c, 0, 28, 0, 72, [[0, P.hot()], [1, P.light()]]); rr(c, 43, 31, 10, 38, 3); c.fill(); rr(c, 29, 45, 38, 10, 3); c.fill();
  c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) sparkle(c, 12 + R() * 72, 12 + R() * 66, 2 + R() * 3.5, W(.9)); c.globalCompositeOperation = 'source-over';
};
// 강화 (위로 솟는 화살 겹)
M.buff = (c, P, R, o) => {
  bloom(c, 48, 50, 46, P.main(.75));
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = lin(c, 0, 90, 0, 6, [[0, P.light(.5)], [1, P.light(0)]]); c.fillRect(24, 6, 48, 84);
  c.beginPath(); c.ellipse(48, 82, 30, 8, 0, 0, TAU); c.strokeStyle = P.light(.7); c.lineWidth = 2; c.stroke();
  if (o.coil) { const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * TAU * 2.5; pts.push([48 + Math.cos(a) * 24, 84 - t * 74 + Math.sin(a) * 6]); } ribbon(c, pts, t => 2 + 4 * t); c.fillStyle = P.main(.8); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  const chev = (x, y, s, a) => { line(c, [[x - 16 * s, y + 10 * s], [x, y - 6 * s], [x + 16 * s, y + 10 * s]]); c.lineCap = 'round'; c.lineJoin = 'round'; glow(c, P.main(), 10); c.strokeStyle = P.light(a); c.lineWidth = 8 * s; c.stroke(); noGlow(c); c.strokeStyle = W(a * .9); c.lineWidth = 3 * s; c.stroke(); };
  if (o.clone) for (const dx of [-18, 18]) for (let i = 0; i < 3; i++) chev(48 + dx, 70 - i * 18, .7, .25);
  for (let i = 0; i < 3; i++) chev(48, 70 - i * 20, 1 + i * .08, .55 + i * .22);
  c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) sparkle(c, 14 + R() * 68, 10 + R() * 70, 2 + R() * 3, W(.85)); c.globalCompositeOperation = 'source-over';
};
// 돌진 (속도선 + 혜성 머리 + 쐐기)
M.dash = (c, P, R) => {
  const ang = rad(-28 - R() * 24), dx = Math.cos(ang), dy = Math.sin(ang), hx = 66, hy = 36;
  bloom(c, hx, hy, 40, P.main(.8));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) { const o = (i - 4) * 8 + (R() - .5) * 4, L = 26 + R() * 30, sx = 40 - dy * o - dx * 20 * R(), sy = 52 + dx * o - dy * 20 * R(); streak(c, sx - dx * L, sy - dy * L, sx, sy, 1.5 + R() * 1.5, W(.5)); }
  const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20, s = Math.sin(PI * t) * 8; pts.push([hx - dx * 70 * (1 - t) - dy * s, hy - dy * 70 * (1 - t) + dx * s]); }
  glow(c, P.main(), 12); ribbon(c, pts, t => 26 * Math.pow(t, 1.3)); c.fillStyle = P.main(.85); c.fill(); noGlow(c);
  ribbon(c, pts, t => 14 * Math.pow(t, 1.3)); c.fillStyle = P.light(.9); c.fill();
  ribbon(c, pts, t => 5 * Math.pow(t, 1.3)); c.fillStyle = W(.95); c.fill();
  bloom(c, hx, hy, 16, W()); c.globalCompositeOperation = 'source-over';
  c.save(); c.translate(hx, hy); c.rotate(ang);
  for (let i = 0; i < 2; i++) { line(c, [[4 + i * 9, -11], [14 + i * 9, 0], [4 + i * 9, 11]]); c.lineCap = 'round'; c.lineJoin = 'round'; glow(c, P.main(), 8); c.strokeStyle = W(); c.lineWidth = 4.5; c.stroke(); noGlow(c); }
  c.restore();
};
// 광선 (모서리 발사점 + 섬광)
M.beam = (c, P, R, o) => {
  const ox = 12, oy = 84, ang = rad(-40 - R() * 10), L = 120;
  c.save(); c.translate(ox, oy); c.rotate(ang);
  c.globalCompositeOperation = 'lighter';
  const body = (k, col) => { c.beginPath(); c.moveTo(0, -7 * k); c.lineTo(L, -16 * k); c.lineTo(L, 16 * k); c.lineTo(0, 7 * k); c.closePath(); c.fillStyle = col; c.fill(); };
  if (o.rainbow) {
    const cols = ['#ff6a8a', '#ffd25a', '#7aff9a', '#6ad8ff', '#b07aff'];
    for (let i = 0; i < 5; i++) { const y0 = -14 + i * 7; c.beginPath(); c.moveTo(0, y0 * .45); c.lineTo(L, y0 * 1.1 - 3); c.lineTo(L, y0 * 1.1 + 6); c.lineTo(0, y0 * .45 + 3); c.closePath(); c.fillStyle = cols[i]; c.globalAlpha = .6; c.fill(); }
    c.globalAlpha = 1;
  } else { glow(c, P.main(), 16); body(1.5, P.main(.55)); noGlow(c); body(1, P.main(.85)); }
  body(.62, P.light(.9)); body(.26, W());
  for (let i = 0; i < 3; i++) { const x = 30 + i * 22 + R() * 6; c.beginPath(); c.ellipse(x, 0, 4, 12 + x * .12, 0, 0, TAU); c.strokeStyle = P.hot(.7); c.lineWidth = 1.6; c.stroke(); }
  for (let i = 0; i < 10; i++) { const x = 10 + R() * 100, y = (R() - .5) * (14 + x * .2) * 2.2; sparkle(c, x, y, 1.5 + R() * 2.5, W(.85)); }
  c.restore();
  c.globalCompositeOperation = 'lighter';
  if (o.sun) bloom(c, ox, oy, 34, 'rgba(255,230,120,.9)');
  bloom(c, ox, oy, 26, P.light(.9)); bloom(c, ox, oy, 12, W());
  sparkle(c, ox + 2, oy - 2, 22, W(.9)); c.save(); c.translate(ox + 2, oy - 2); c.rotate(PI / 4); sparkle(c, 0, 0, 11, W(.7)); c.restore();
  c.globalCompositeOperation = 'source-over';
};
// 폭발 (방사형 충격)
M.burst = (c, P, R) => {
  bloom(c, 48, 50, 48, P.main(.9));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + R() * .2, r0 = 18, r1 = 38 + R() * 10; c.save(); c.translate(48, 50); c.rotate(a); poly(c, [[r0, -3], [r1, 0], [r0, 3]]); c.fillStyle = P.light(.7); c.fill(); c.restore(); }
  c.globalCompositeOperation = 'source-over';
  M.starShape(c, P, R, 48, 50, 36, 22, 10);
  c.globalCompositeOperation = 'lighter';
  c.beginPath(); c.ellipse(48, 50, 42, 40, 0, 0, TAU); c.strokeStyle = P.light(.6); c.lineWidth = 2.4; c.stroke();
  bloom(c, 48, 50, 16, W());
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 8; i++) { const a = R() * TAU, d = 34 + R() * 10; rock(c, 48 + Math.cos(a) * d, 50 + Math.sin(a) * d, 1.6 + R() * 2.2, R, P, 5, .3); }
};
// 장판 (땅 위 마법진 + 솟는 빛)
M.zone = (c, P, R, o) => {
  const cx = 48, cy = 66, rx = 40, ry = 15;
  bloom(c, cx, cy, 44, P.main(.8));
  c.globalCompositeOperation = 'lighter';
  glow(c, P.main(), 10);
  for (const [k, w] of [[1, 3], [.74, 1.6]]) { c.beginPath(); c.ellipse(cx, cy, rx * k, ry * k, 0, 0, TAU); c.strokeStyle = P.light(.95); c.lineWidth = w; c.stroke(); }
  noGlow(c);
  const nV = 5 + (R() < .5 ? 1 : 0), pts = []; for (let i = 0; i < nV; i++) { const a = i / nV * TAU + R(); pts.push([cx + Math.cos(a) * rx * .74, cy + Math.sin(a) * ry * .74]); }
  c.beginPath(); for (let i = 0; i < nV; i++) { const a = pts[i], b = pts[(i + 2) % nV]; c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); } c.strokeStyle = P.hot(.7); c.lineWidth = 1.2; c.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.beginPath(); c.arc(cx + Math.cos(a) * rx * .87, cy + Math.sin(a) * ry * .87, 1.2, 0, TAU); c.fillStyle = W(.8); c.fill(); }
  c.fillStyle = radl(c, cx, cy, 0, rx, [[0, P.light(.4)], [1, P.main(0)]]); c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.fill();
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + R(), x = cx + Math.cos(a) * rx * .6, y = cy + Math.sin(a) * ry * .6, w = 6 + R() * 4, h = 34 + R() * 20; c.fillStyle = lin(c, 0, y, 0, y - h, [[0, P.light(.7)], [1, P.light(0)]]); c.fillRect(x - w / 2, y - h, w, h); }
  for (let i = 0; i < 10; i++) { const x = 14 + R() * 68, y = 14 + R() * 50; c.beginPath(); c.arc(x, y, .8 + R() * 1.8, 0, TAU); c.fillStyle = P.hot(.9); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  if (o.sprout) {
    c.beginPath(); c.moveTo(48, 66); c.bezierCurveTo(46, 54, 50, 44, 48, 34); c.strokeStyle = '#3a8a2a'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
    leaf(c, 48, 40, 22, 8, rad(-150), P); leaf(c, 48, 36, 24, 8, rad(-30), P);
  }
};
// 구체 투사체 (꼬리 + 광택 구슬)
M.orb = (c, P, R, o) => {
  const x = 54 + (R() - .5) * 6, y = 42 + (R() - .5) * 6, r = 15 + R() * 4, tail = rad(130 + (R() - .5) * 30);
  bloom(c, x, y, 44, P.main(.8));
  c.globalCompositeOperation = 'lighter';
  const tx = x + Math.cos(tail) * 56, ty = y + Math.sin(tail) * 56;
  streak(c, tx, ty, x, y, r * 2, P.main(.7)); streak(c, tx, ty, x, y, r * 1, P.hot(.7));
  for (let i = 0; i < 6; i++) { const t = R(); ember(c, x + (tx - x) * t + (R() - .5) * 12, y + (ty - y) * t + (R() - .5) * 12, 1.5 + R() * 2, P.light()); }
  c.globalCompositeOperation = 'source-over';
  if (o.flame) for (let i = 0; i < 5; i++) { const a = tail + (i - 2) * .45; flame(c, x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6, 12, 26, a - PI / 2, 0, P); }
  sphere(c, x, y, r, P, W());
  c.globalCompositeOperation = 'lighter';
  c.save(); c.translate(x, y); c.rotate(R()); c.beginPath(); c.ellipse(0, 0, r + 8, (r + 8) * .3, 0, 0, TAU); c.strokeStyle = P.light(.6); c.lineWidth = 1.6; c.stroke(); c.restore();
  sparkle(c, x + r * .5, y - r * .6, 8, W(.9));
  c.globalCompositeOperation = 'source-over';
};
// 여러 발 투사체
M.multi = (c, P, R) => {
  bloom(c, 48, 48, 46, P.main(.7));
  const n = 3 + (R() * 3 | 0), ang = rad(-30 - R() * 25), dx = Math.cos(ang), dy = Math.sin(ang);
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 16, d = 20 + R() * 30, x = 20 + dx * d - dy * o + 10, y = 70 + dy * d + dx * o - 12, r = 4.5 + R() * 3;
    c.globalCompositeOperation = 'lighter'; streak(c, x - dx * 36, y - dy * 36, x, y, r * 1.8, P.light(.6)); c.globalCompositeOperation = 'source-over';
    sphere(c, x, y, r, P, W());
  }
};
// 음파 (호가 겹겹 퍼짐 + 음표)
M.sonic = (c, P, R, o) => {
  const ox = 20, oy = 70, mid = rad(-42 + (R() - .5) * 14);
  bloom(c, ox, oy, 46, P.main(.8));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const r = 14 + i * 12, span = rad(100 - i * 6), pts = arcPts(ox, oy, r, mid - span / 2, mid + span / 2, 24);
    glow(c, P.main(), 8); ribbon(c, pts, t => (6 - i * .6) * taper(t, .6)); c.fillStyle = P.light(.9 - i * .12); c.fill(); noGlow(c);
    ribbon(c, pts, t => 1.8 * taper(t, .6)); c.fillStyle = W(.85 - i * .12); c.fill();
  }
  bloom(c, ox, oy, 12, W());
  c.globalCompositeOperation = 'source-over';
  if (o.notes) {
    const note = (x, y, s) => {
      c.save(); c.translate(x, y); c.scale(s, s);
      glow(c, P.main(), 8); c.fillStyle = W(); c.strokeStyle = W();
      c.beginPath(); c.ellipse(0, 0, 5, 3.6, -.4, 0, TAU); c.fill();
      c.fillRect(3.6, -20, 2, 20);
      c.beginPath(); c.moveTo(5.6, -20); c.bezierCurveTo(12, -16, 13, -11, 9, -6); c.bezierCurveTo(10, -10, 8, -13, 5.6, -14); c.closePath(); c.fill();
      noGlow(c); c.restore();
    };
    note(66, 34, 1.1); note(78, 58, .8);
  }
};
// 시간 (시계 고리 + 바늘)
M.clock = (c, P, R, o) => {
  const cx = 48, cy = 48;
  bloom(c, cx, cy, 48, P.main(.85));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { const a = R() * TAU; ribbon(c, arcPts(cx, cy, 40 + i * 2, a, a + 1.6, 20), t => 3 * taper(t)); c.fillStyle = P.light(.6); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  glow(c, P.light(), 14); c.beginPath(); c.arc(cx, cy, 33, 0, TAU); c.fillStyle = radl(c, cx, cy, 0, 33, [[0, P.dark()], [.85, P.deep()], [1, P.main()]]); c.fill(); noGlow(c);
  c.beginPath(); c.arc(cx, cy, 33, 0, TAU); c.strokeStyle = lin(c, 15, 15, 81, 81, [[0, W()], [.5, P.light()], [1, P.main()]]); c.lineWidth = 4.5; c.stroke();
  c.beginPath(); c.arc(cx, cy, 26, 0, TAU); c.strokeStyle = P.light(.6); c.lineWidth = 1; c.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, l = i % 3 ? 3 : 6; line(c, [[cx + Math.cos(a) * 29, cy + Math.sin(a) * 29], [cx + Math.cos(a) * (29 - l), cy + Math.sin(a) * (29 - l)]]); c.strokeStyle = P.hot(); c.lineWidth = i % 3 ? 1.2 : 2.4; c.stroke(); }
  const h1 = rad(-90 + R() * 360), h2 = rad(-90 + R() * 360);
  c.lineCap = 'round'; glow(c, P.light(), 8);
  line(c, [[cx, cy], [cx + Math.cos(h1) * 15, cy + Math.sin(h1) * 15]]); c.strokeStyle = W(); c.lineWidth = 3.4; c.stroke();
  line(c, [[cx, cy], [cx + Math.cos(h2) * 23, cy + Math.sin(h2) * 23]]); c.lineWidth = 2; c.stroke(); noGlow(c);
  c.beginPath(); c.arc(cx, cy, 3.5, 0, TAU); c.fillStyle = P.hot(); c.fill();
  if (o.shock) { c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(cx, cy, 39 + i * 6, 0, TAU); c.strokeStyle = P.light(.4 - i * .15); c.lineWidth = 2; c.stroke(); } c.globalCompositeOperation = 'source-over'; }
  c.globalCompositeOperation = 'lighter'; sparkle(c, 30, 24, 8, W()); c.globalCompositeOperation = 'source-over';
};
// 공간 찢기 (갈라진 틈 + 파편)
M.rift = (c, P, R) => {
  bloom(c, 48, 48, 48, P.main(.85));
  const sp = jag(R, 40 + R() * 10, 2, 50 + R() * 10, 94, 8, 7), wf = t => 4 + 12 * taper(t, .7);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(48, 48, 20 + i * 12, 40 + i * 5, .2, 0, TAU); c.strokeStyle = P.light(.3 - i * .08); c.lineWidth = 1.5; c.stroke(); }
  c.globalCompositeOperation = 'source-over';
  glow(c, P.light(), 18); ribbon(c, sp, t => wf(t) * 1.25); c.fillStyle = P.main(); c.fill(); noGlow(c);
  ribbon(c, sp, wf); c.fillStyle = lin(c, 30, 0, 66, 0, [[0, P.light()], [.5, W()], [1, P.light()]]); c.fill();
  ribbon(c, sp, t => wf(t) * .35); c.fillStyle = '#1a0a2a'; c.fill();
  for (let i = 0; i < 9; i++) { const x = 10 + R() * 76, y = 8 + R() * 80, s = 3 + R() * 4, a = R() * TAU; if (Math.abs(x - 50) < 10) continue; c.save(); c.translate(x, y); c.rotate(a); poly(c, [[0, -s], [s * .7, s * .6], [-s * .6, s * .4]]); glow(c, P.main(), 6); c.fillStyle = lin(c, 0, -s, 0, s, [[0, W()], [1, P.light()]]); c.fill(); noGlow(c); c.restore(); }
};
// 차원 문 (빨려드는 소용돌이 + 검은 중심)
M.portal = (c, P, R) => {
  bloom(c, 48, 48, 48, P.main(.85));
  const n = 5, dir = R() < .5 ? 1 : -1, rot = R() * TAU;
  c.save(); c.translate(48, 48); c.scale(1, .82 + R() * .12);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const pts = []; for (let s = 0; s <= 28; s++) { const t = s / 28, a = rot + i * TAU / n + dir * t * 3.2, r = 44 - 32 * t; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    glow(c, P.main(), 8); ribbon(c, pts, t => 1 + 8 * taper(t, .6)); c.fillStyle = (i % 2 ? P.acc : P.light)(.8); c.fill(); noGlow(c);
    ribbon(c, pts, t => 2.4 * taper(t, .6)); c.fillStyle = W(.8); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  glow(c, P.light(), 16); c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fillStyle = radl(c, 0, 0, 0, 14, [[0, '#000'], [.7, '#0a0418'], [1, P.hot()]]); c.fill(); noGlow(c);
  c.restore();
};

// ---------------- 모티프 고르기 ----------------
// [정규식, 모티프, 옵션] — 위에서부터 처음 맞는 것. pal: 다른 타입 색 쓰기
const RULES = [
  [/water_shuriken/, 'shuriken'],
  [/fire_blast/, 'flameStar'],
  [/flame_wheel/, 'flameRing'],
  [/flamethrower|heat_wave|fire_spin/, 'vortex'],
  [/flare_blitz|giga_impact|explosion/, 'burst'],
  [/eruption|lava_plume/, 'volcano'],
  [/will_o_wisp/, 'wisp', { pal: 'ghost' }],
  [/pyro_ball/, 'orb', { flame: 1 }],
  [/torch_song|sparkling_aria/, 'sonic', { notes: 1 }],
  [/supersonic|drum_beating|hyper_voice|roar$/, 'sonic'],
  [/volt_tackle|wild_charge/, 'bolt', { dash: 1 }],
  [/hydro_pump|water_?gun|snipe_shot|aqua_jet|pound_water/, 'jet'],
  [/grassy_glide|quick_attack|extreme_speed|flame_charge|tackle|aerial_dive|u_turn|belly_slide/, 'dash'],
  [/flame_feather|phoenix|brave_bird/, 'wing', { fire: 1 }],
  [/wing|peck|glide|dragon_ascent|bounce/, 'wing'],
  [/heat_crash|body_press|wood_hammer|stomp/, 'slam'],
  [/waterfall/, 'jet', { up: 1 }],
  [/surf|muddy_water|aqua_tail/, 'wave'],
  [/aqua_ring/, 'bubbles', { ring: 1 }],
  [/bubble|aqua_step/, 'bubbles'],
  [/splash|mud_slap/, 'splat'],
  [/iron_tail/, 'crescent', { big: 1 }],
  [/aqua_cutter|aqua_blade|razor_shell|psycho_cut|air_slash/, 'crescent'],
  [/spacial_rend/, 'rift'],
  [/warp_rift|distortion/, 'portal'],
  [/roar_of_time/, 'clock', { shock: 1 }],
  [/chrono_stop/, 'clock'],
  [/nightmare|future_sight/, 'eye'],
  [/shadow_claw/, 'voidOrb', { claw: 1 }],
  [/phantom_dash|shadow_force/, 'voidOrb', { dash: 1 }],
  [/shadow_ball|lick_shadow|dark_void|spirit_shackle/, 'voidOrb'],
  [/dark_pulse/, 'darkRings'],
  [/psystrike/, 'psiRings', { spikes: 1 }],
  [/psychic|psyshock|confusion/, 'psiRings'],
  [/synthesis|morning_sun/, 'heal', { sun: 1 }],
  [/heal_pulse|recover|roost/, 'heal'],
  [/^thunder$/, 'cloud'],
  [/double_kick/, 'kick', { twin: 1 }],
  [/kick/, 'kick'],
  [/sky_uppercut/, 'fist', { streak: 'up' }],
  [/flare_jab|arm_thrust/, 'fist', { ghosts: 2, streak: 'side' }],
  [/close_combat/, 'fist', { ghosts: 3 }],
  [/bullet_punch|mach_punch/, 'fist', { streak: 'side' }],
  [/karate_chop/, 'fist', { streak: 'down' }],
  [/rock_smash|brick_break/, 'fist', { debris: 1 }],
  [/dynamic_punch|focus_punch/, 'fist', { burst: 1 }],
  [/punch|jab|uppercut|fake_out/, 'fist'],
  [/fang|crunch|chomp|leech_life|bite/, 'fang'],
  [/thunder|shock|bolt|spark|discharge/, 'bolt'],
  [/leaf_storm|leaf_tornado/, 'petals', { leafy: 1 }],
  [/petal|flower/, 'petals'],
  [/leaf_blade/, 'leaves', { blade: 1 }],
  [/magical_leaf/, 'leaves', { sparkle: 1 }],
  [/leaf/, 'leaves'],
  [/needle_arm/, 'vine', { thorn: 1 }],
  [/vine|branch/, 'vine'],
  [/giga_drain|mega_drain|absorb/, 'drain'],
  [/seed_field/, 'zone', { sprout: 1 }],
  [/seed/, 'seeds'],
  [/aurora_beam/, 'beam', { rainbow: 1 }],
  [/solar_beam/, 'beam', { sun: 1 }],
  [/beam|flash_cannon|dragon_pulse/, 'beam'],
  [/stone_edge/, 'crystals'],
  [/rollout/, 'boulders', { roll: 1 }],
  [/rock/, 'boulders'],
  [/earth_power/, 'fissure', { pillars: 1 }],
  [/earthquake|dig|bulldoze/, 'fissure'],
  [/sand_tomb|hurricane|twister/, 'tornado'],
  [/rapid_spin|court_change|flail|lariat/, 'spin'],
  [/draco_meteor|meteor/, 'meteors'],
  [/outrage|dragon_rush|dragon_tail/, 'dragon'],
  [/moon/, 'moon'],
  [/play_rough/, 'sparkles'],
  [/x_scissor/, 'claw', { x: 1 }],
  [/fury_swipes/, 'claw', { n: 4 }],
  [/claw|slash|swipe|chop|scissor|cut|scratch/, 'claw'],
  [/sludge|poison|toxic/, 'sludge'],
  [/spiky_shield/, 'shield', { spiky: 1 }],
  [/mirror_coat/, 'shield', { mirror: 1 }],
  [/detect|shield|counter|camouflage|protect/, 'shield'],
  [/coil/, 'buff', { coil: 1 }],
  [/double_team/, 'buff', { clone: 1 }],
  [/incinerate|ember|flare|blaze|sacred_fire/, 'flames'],
  [/mystical_fire/, 'flames', { sparkle: 1 }]
];
const BY_ARCH = { slash: 'claw', flurry: 'claw', strike: 'fist', fang: 'fang', slam: 'slam', shockwave: 'fissure', volley: 'multi', sky_fall: 'boulders', projectile: 'orb', boomerang: 'crescent', homing: 'orb', beam: 'beam', ring: 'sonic', burst: 'burst', sky: 'meteors', zone: 'zone', buff: 'buff', heal: 'heal', shield: 'shield', orbit: 'orb', hex: 'darkRings', dash: 'dash' };
const BY_ICON = { claw: 'claw', fang: 'fang', fist: 'fist', drop: 'jet', bubble: 'bubbles', wing: 'wing', ghost: 'voidOrb', leaf: 'leaves', seed: 'seeds', bolt: 'bolt', thunder: 'bolt', flame: 'flames', spin: 'spin', dash: 'dash', wave: 'sonic', shield: 'shield', vine: 'vine' };
const BY_TYPE = { fire: 'flames', water: 'jet', grass: 'leaves', electric: 'bolt', ghost: 'voidOrb', fighting: 'fist', dark: 'darkRings', dragon: 'dragon', normal: 'impact', flying: 'wing', poison: 'sludge', psychic: 'psiRings', ice: 'crystals', rock: 'boulders', ground: 'fissure', bug: 'stinger', steel: 'blade', fairy: 'sparkles' };
// 타입 잔입자를 뿌리는 (타입 색만으로는 타입이 덜 드러나는) 모티프
const GENERIC = new Set(['claw', 'fist', 'kick', 'impact', 'burst', 'dash', 'beam', 'orb', 'multi', 'slam', 'zone', 'shield', 'buff', 'spin', 'crescent', 'fang', 'sonic', 'tornado', 'wing', 'heal', 'clock', 'portal', 'meteors', 'dragon']);

function pickMotif(skill, id) {
  for (const [rx, m, o] of RULES) if (rx.test(id)) return [m, o || {}];
  let arch = skill.arch;
  if (!arch && MOVE_DB[id]) { try { arch = archetypeOf(MOVE_DB[id], id); } catch (e) { arch = null; } }
  if (arch && BY_ARCH[arch]) return [BY_ARCH[arch], arch === 'hex' ? { full: 1 } : {}];
  if (skill.icon && BY_ICON[skill.icon]) return [BY_ICON[skill.icon], {}];
  return [BY_TYPE[skill.type] || 'impact', {}];
}

// ---------------- 배경 · 테두리 ----------------
function background(c, P, R) {
  const g = radl(c, 48, 44, 2, 72, [[0, css(P.bgC)], [.5, css(P.bgM)], [1, css(P.bgE)]]);
  c.fillStyle = g; c.fillRect(0, 0, 96, 96);
  c.save(); c.globalCompositeOperation = 'lighter';
  const n = 12 + (R() * 8 | 0), off = R() * TAU;   // 은은한 방사 광선
  for (let i = 0; i < n; i++) { const a = off + i / n * TAU, w = .07 + R() * .06; c.beginPath(); c.moveTo(48, 46); c.arc(48, 46, 80, a - w, a + w); c.closePath(); c.fillStyle = W(.025 + R() * .025); c.fill(); }
  for (let i = 1; i < 4; i++) { c.beginPath(); c.arc(48, 46, i * 15, 0, TAU); c.strokeStyle = W(.035); c.lineWidth = 1; c.stroke(); }
  for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(R() * 96, R() * 96, .4 + R() * .9, 0, TAU); c.fillStyle = W(.12 + R() * .2); c.fill(); }
  c.restore();
}
function frame(c, P) {
  c.fillStyle = radl(c, 48, 48, 34, 70, [[0, B(0)], [.6, B(.22)], [1, B(.6)]]); c.fillRect(0, 0, 96, 96);   // 비네트
  c.fillStyle = lin(c, 0, 0, 0, 40, [[0, W(.13)], [1, W(0)]]); rr(c, 3, 3, 90, 40, 12); c.fill();   // 위 광택
  rr(c, 2, 2, 92, 92, 13); c.strokeStyle = lin(c, 0, 0, 96, 96, [[0, P.hot(.55)], [.45, P.light(.18)], [1, B(.3)]]); c.lineWidth = 1.6; c.stroke();   // 안쪽 테 반사광
  rr(c, .75, .75, 94.5, 94.5, 14); c.strokeStyle = B(.75); c.lineWidth = 1.5; c.stroke();
}

// ---------------- 공개 함수 ----------------
// skill: SKILLS[id] (없으면 일반 아이콘) · size: 캔버스 한 변 픽셀 (기본 96)
export function drawSkillArt(ctx, size, skill, id) {
  const sk = skill || { type: 'normal', cd: 0, icon: 'orb' }, key = String(id || sk.name || 'skill');
  const [motif, opt] = pickMotif(sk, key);
  const R = mulberry(hashStr(key)), type = sk.type || 'normal', P = palette(opt.pal || type, R);
  K = size / ART_SIZE;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.scale(K, K);
  rr(ctx, 0, 0, 96, 96, 14); ctx.clip();
  background(ctx, P, R);
  ctx.save();
  try { (M[motif] || M.impact)(ctx, P, R, opt); } catch (e) { console.warn('[skillArt] 그리기 실패', key, e); }
  ctx.restore();
  noGlow(ctx); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (GENERIC.has(motif)) typeFx(ctx, P, R, type, 6);
  frame(ctx, P);
  ctx.restore();
  return motif;
}
// sk:<id> 텍스처 (96×96, LINEAR 필터). 이미 있으면 그대로
export function skillArt(scene, id) {
  const key = `sk:${id}`;
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, ART_SIZE, ART_SIZE);
  drawSkillArt(t.getContext(), ART_SIZE, SKILLS[id], id);
  t.refresh(); t.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
}
