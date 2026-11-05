// 보스 결전장 그림 (game/Arenas.js 의 r.arenaStyle · r.arena 를 읽는다)
//  ① bakeArenaTiles: 결전장 방 한 장을 보스마다 다른 재질로 한 픽셀씩 굽는다 — 공용 타일셋(색만 바꾼 돌벽돌)을 쓰지 않는다
//     칸마다 트인 방향(윗면 · 아랫면 · 옆면) · 땅속 깊이 · 벽/바닥/지형 구역을 보고 윗면 껍질 · 속 재질 무늬 · 아래 그림자를 따로 칠한 뒤,
//     그 위에 환경 장식(잔디 · 눈더미 · 결정 · 전선 · 초롱 · 용머리 · 문양 …)을 캔버스로 덧그린다
//     무늬는 월드 픽셀 좌표로 이어진다 (벽돌 · 기와 · 육각 장갑이 칸 경계에서 끊기지 않는다) · 부서지는 벽 칸은 타일 지도가 그대로 그린다 (GameScene)
//  ② buildArenaBackdrop: 결전장마다 3~4겹 패럴랙스 배경 (반 해상도 캔버스 ×2 도트) + 움직이는 요소(입자 · 회전 · 번개 · 깜빡임)
//     겹마다 카메라를 따라가는 비율이 달라 깊이가 생기고, 방 사각형(벽 포함) 밖으로는 잘라 이웃 방 배경에 번지지 않는다
import Phaser from 'phaser';
import { TILE } from '../config.js';

// ---------------- 공용 도우미 ----------------
const hash = (x, y, s = 0) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const noise = (x, y, s = 0) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y, s = 0) => noise(x, y, s) * .58 + noise(x * 2.03, y * 2.03, s + 7) * .29 + noise(x * 4.1, y * 4.1, s + 13) * .13;
const cR = c => (c >> 16) & 255, cG = c => (c >> 8) & 255, cB = c => c & 255;
const mix = (a, b, t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return (Math.round(cR(a) + (cR(b) - cR(a)) * t) << 16) | (Math.round(cG(a) + (cG(b) - cG(a)) * t) << 8) | Math.round(cB(a) + (cB(b) - cB(a)) * t); };
const sh = (c, k) => { const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return (f(cR(c)) << 16) | (f(cG(c)) << 8) | f(cB(c)); };
const pk = (c, a = 255) => (((a & 255) << 24) | (cB(c) << 16) | (cG(c) << 8) | cR(c)) >>> 0;   // 0xRRGGBB → ImageData 한 픽셀 (ABGR)
const rgba = (c, a = 1) => `rgba(${cR(c)},${cG(c)},${cB(c)},${a})`;
const mod = (v, m) => ((v % m) + m) % m;
// 평평한 윗변 육각 격자: 픽셀 → 칸 (q, r) · 칸 가운데에서의 거리 dx, dy · 테두리 가까움 e (0 가운데 ~ 1 테두리)
const hexAt = (x, y, s) => {
  const q = (2 / 3 * x) / s, rr = (-x / 3 + Math.sqrt(3) / 3 * y) / s;
  let cx = q, cz = rr, cy = -cx - cz, rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
  const ex = Math.abs(rx - cx), ey = Math.abs(ry - cy), ez = Math.abs(rz - cz);
  if (ex > ey && ex > ez) rx = -ry - rz; else if (ey > ez) ry = -rx - rz; else rz = -rx - ry;
  const hx = s * 1.5 * rx, hy = s * Math.sqrt(3) * (rz + rx / 2), dx = x - hx, dy = y - hy, k = Math.sqrt(3) / 2 * s;
  return { q: rx, r: rz, dx, dy, e: Math.max(Math.abs(dy), .866 * Math.abs(dx) + .5 * Math.abs(dy)) / k };
};
// 캔버스 붓
const brush = c => ({
  F(x, y, w, h, col, a = 1) { c.globalAlpha = a; c.fillStyle = rgba(col); c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); c.globalAlpha = 1; },
  P(x, y, col, a = 1) { c.globalAlpha = a; c.fillStyle = rgba(col); c.fillRect(Math.round(x), Math.round(y), 1, 1); c.globalAlpha = 1; },
  grad(x, y, w, h, stops, horiz = false) { const g = horiz ? c.createLinearGradient(x, 0, x + w, 0) : c.createLinearGradient(0, y, 0, y + h); for (const [t, col, a = 1] of stops) g.addColorStop(t, rgba(col, a)); c.fillStyle = g; c.fillRect(x, y, w, h); },
  glow(x, y, rad, col, a) { if (rad <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); },
  circle(x, y, rad, col, a = 1) { c.globalAlpha = a; c.fillStyle = rgba(col); c.beginPath(); c.arc(x, y, Math.max(.5, rad), 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; },
  ellipse(x, y, rx, ry, col, a = 1, rot = 0) { c.globalAlpha = a; c.fillStyle = rgba(col); c.beginPath(); c.ellipse(x, y, Math.max(.5, rx), Math.max(.5, ry), rot, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; },
  ring(x, y, rad, lw, col, a = 1) { c.globalAlpha = a; c.strokeStyle = rgba(col); c.lineWidth = lw; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; },
  arc(x, y, rad, a0, a1, lw, col, a = 1) { c.globalAlpha = a; c.strokeStyle = rgba(col); c.lineWidth = lw; c.beginPath(); c.arc(x, y, rad, a0, a1); c.stroke(); c.globalAlpha = 1; },
  line(x0, y0, x1, y1, lw, col, a = 1) { c.globalAlpha = a; c.strokeStyle = rgba(col); c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.globalAlpha = 1; },
  path(pts, lw, col, a = 1) { if (pts.length < 2) return; c.globalAlpha = a; c.strokeStyle = rgba(col); c.lineWidth = lw; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]); c.stroke(); c.globalAlpha = 1; },
  poly(pts, col, a = 1) { c.globalAlpha = a; c.fillStyle = rgba(col); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]); c.closePath(); c.fill(); c.globalAlpha = 1; },
  stars(n, x, y, w, h, seed, cols = [0xffffff], big = .08) { for (let k = 0; k < n; k++) { const sx = x + hash(k, 1, seed) * w, sy = y + hash(k, 2, seed) * h, col = cols[k % cols.length], a = .35 + hash(k, 3, seed) * .65; c.globalAlpha = a; c.fillStyle = rgba(col); c.fillRect(Math.round(sx), Math.round(sy), 1, 1); if (hash(k, 4, seed) < big) { c.globalAlpha = a * .45; c.fillRect(Math.round(sx) - 1, Math.round(sy), 3, 1); c.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 3); } } c.globalAlpha = 1; }
});
// 픽셀 단위로 직접 칠하는 캔버스 구역 (성운 · 노을처럼 넓은 면): f(x, y) → 0xRRGGBB 또는 [색, 알파]
function pixels(c, x0, y0, w, h, f) {
  const im = c.getImageData(x0, y0, w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = f(x0 + x, y0 + y); if (v == null) continue;
    const col = Array.isArray(v) ? v[0] : v, a = Array.isArray(v) ? v[1] : 1, o = (y * w + x) * 4, ia = 1 - a;
    d[o] = cR(col) * a + d[o] * ia; d[o + 1] = cG(col) * a + d[o + 1] * ia; d[o + 2] = cB(col) * a + d[o + 2] * ia; d[o + 3] = Math.max(d[o + 3], a * 255);
  }
  c.putImageData(im, x0, y0);
}

// ---------------- ① 타일 굽기 ----------------
// 결전장 방 사각형(벽 · 바닥 밑 땅 포함)의 'S' · 'P' 칸을 그린다. 'B'(부서지는 벽) · 빈칸은 비운다
export function bakeArenaTiles(scene, level, r) {
  const key = `arena:${level.ci}:${r.id}:tiles`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const W = (r.X1 - r.X0) * TILE, H = (r.Y1 - r.Y0) * TILE;
  const tex = scene.textures.createCanvas(key, W, H), c = tex.getContext();
  const img = c.createImageData(W, H), buf = new Uint32Array(img.data.buffer);
  const G = level.grid, at = (x, y) => (G[y] && G[y][x] !== undefined ? G[y][x] : 'S');
  const sol = (x, y) => { const q = at(x, y); return q === 'S' || q === 'B'; };
  const PT = PAINT[r.arenaStyle], k = Object.assign({ F: r.F, r }, PT.ctx ? PT.ctx(r) : {});
  for (let ty = r.Y0; ty < r.Y1; ty++) for (let tx = r.X0; tx < r.X1; tx++) {
    const ch = at(tx, ty);
    if (ch === '.' && ty > r.F && PT.shaft) {   // 바닥 밑 통로 (아래층으로 가는 철창 갱도): 배경이 비치지 않게 그 방 재질의 어두운 뒷벽
      const ox = (tx - r.X0) * TILE, oy = (ty - r.Y0) * TILE, col = PT.shaft;
      for (let ly = 0; ly < TILE; ly++) for (let lx = 0; lx < TILE; lx++) buf[(oy + ly) * W + ox + lx] = pk(hash(tx * TILE + lx, ty * TILE + ly, 5) < .08 ? sh(col, 1.35) : (lx + ly) % 9 === 0 ? sh(col, .8) : col);
      continue;
    }
    if (ch !== 'S' && ch !== 'P') continue;
    let depth = 0;
    if (ch === 'S') while (depth < 12 && sol(tx, ty - depth - 1)) depth++;
    const cell = { tx, ty, ch, depth, top: !sol(tx, ty - 1), bot: !sol(tx, ty + 1), left: !sol(tx - 1, ty), right: !sol(tx + 1, ty),
      wall: tx < r.tx0 || tx >= r.tx1 || ty < r.ty0, ground: ty >= r.F, h: hash(tx, ty, 7), pl: at(tx - 1, ty) !== 'P', pr: at(tx + 1, ty) !== 'P' };
    const ox = (tx - r.X0) * TILE, oy = (ty - r.Y0) * TILE;
    for (let ly = 0; ly < TILE; ly++) {
      let o = (oy + ly) * W + ox;
      for (let lx = 0; lx < TILE; lx++, o++) { const v = PT.px(cell, lx, ly, tx * TILE + lx, ty * TILE + ly, k); if (v) buf[o] = v; }
    }
  }
  c.putImageData(img, 0, 0);
  // 장식: 윗면 줄 · 아랫면 줄 (칸 좌표 · 방 사각형 안)
  const runs = pred => {
    const out = [];
    for (let ty = r.Y0; ty < r.Y1; ty++) { let s = null; for (let tx = r.X0; tx <= r.X1; tx++) { const on = tx < r.X1 && pred(tx, ty); if (on && s === null) s = tx; if (!on && s !== null) { out.push({ y: ty, x0: s, x1: tx - 1 }); s = null; } } }
    return out;
  };
  const h = {
    at, sol, b: brush(c), ox: r.X0 * TILE, oy: r.Y0 * TILE,
    X: tx => (tx - r.X0) * TILE, Y: ty => (ty - r.Y0) * TILE,   // 칸 → 캔버스 픽셀
    tops: runs((x, y) => sol(x, y) && !sol(x, y - 1) && at(x, y - 1) !== 'B'),
    bots: runs((x, y) => sol(x, y) && !sol(x, y + 1) && y + 1 < r.Y1),
    plats: runs((x, y) => at(x, y) === 'P'),
    inside: (tx, ty) => tx >= r.tx0 && tx < r.tx1 && ty >= r.ty0 && ty < r.F
  };
  if (PT.deco) PT.deco(c, r, k, h);
  tex.refresh();
  return key;
}

// 룬 (하늘기둥 고대 레쿠쟈 상형문자 · 10×6)
const RUNES = [
  ['..##..##..', '.#..##..#.', '#...##...#', '.#..##..#.', '..##..##..', '....##....'],
  ['#..####..#', '.#.#..#.#.', '..##..##..', '..##..##..', '.#.#..#.#.', '#..####..#'],
  ['...####...', '..#.##.#..', '.#..##..#.', '#########.', '.#..##..#.', '...#..#...'],
  ['.########.', '.#......#.', '.#.####.#.', '.#.#..#.#.', '...#..#...', '..##..##..']
];

// 보스방마다 전용 픽셀 셰이더: px(칸, 칸 안 x, y, 월드 x, y, 문맥) → 한 픽셀 (0 = 비움) · deco: 캔버스 장식
const PAINT = {
  // ---------------- 뮤츠: 생체 공학 코어 ----------------
  //  바닥: 노랑·검정 경고선 + 합금 프레임 + 구멍 뚫린 그레이팅(경기장 밑은 푸른 냉각수가 비친다) · 속: 기계 패널 · 리벳 · 환기 슬릿 · 냉각수 탱크 창
  //  벽: 32px 티타늄 격벽(모서리 리벳) · 96px 마다 6가닥 전선 다발 · 가로 배관(플랜지) · 캣워크: 난간 · 격자 · 아래 X 트러스
  biolab: {
    shaft: 0x0c1218,
    ctx: r => ({ pit: r.arena.pit || [0, -1] }),
    px(c, lx, ly, wx, wy, k) {
      if (c.ch === 'P') {
        if (ly === 0) return pk(0xd0dae4);
        if (ly === 1) return pk(0x8a96a4);
        if (ly < 5) return pk(mod(wx, 3) === 0 || ly === 4 ? 0x5a6674 : ly === 2 ? 0x2a3440 : 0x1c242c);
        if (ly === 5) return pk(0x161c24);
        if (ly < 11) { if (mod(lx + ly, 8) === 0 || mod(lx - ly, 8) === 0) return pk(0x4a5664); if ((c.pl && lx < 2) || (c.pr && lx > 13)) return pk(0x3a4450); return 0; }
        if (ly === 11 && ((c.pl && lx < 3) || (c.pr && lx > 12))) return pk(0x2a323c);
        return 0;
      }
      if (c.wall && !c.ground) {
        const px = mod(wx, 32), py = mod(wy, 32);
        let col = mix(0x242c36, 0x36424e, noise(wx / 37, wy / 37, 3));
        if (px === 0 || py === 0) col = 0x5a6672; else if (px === 31 || py === 31) col = 0x10151b; else if (px === 1 || py === 1) col = sh(col, 1.18);
        if ((px === 4 || px === 27) && (py === 4 || py === 27)) col = 0xa2aebc; else if ((px === 4 || px === 27) && (py === 5 || py === 28)) col = 0x14191f;
        const cb = mod(wx, 96);
        if (cb >= 40 && cb < 58) {
          const s = (cb - 40) >> 1, base = [0x9a1e1e, 0xc8a422, 0x1e4e96, 0x1a1a1e, 0x2a7a3a, 0x70747c, 0x9a1e1e, 0x2a5aa8, 0xd8d8d8][s];
          const sag = Math.sin(wy * .11 + s * 1.7);
          return pk((cb - 40) % 2 ? sh(base, .62 + sag * .08) : sh(base, 1 + sag * .18));
        }
        const pp = mod(wy, 112);
        if (pp >= 60 && pp < 68) { const g = [0x8494a2, 0x6e7c8a, 0x5c6874, 0x4c5662, 0x3e4852, 0x343c46, 0x2a323a, 0x1c232a][pp - 60]; return pk(mod(wx, 64) < 4 ? sh(g, 1.35) : g); }
        if ((c.left && lx === 0) || (c.right && lx === 15)) col = 0x0a0e12;
        if (c.bot && ly >= 12) col = mix(col, 0x05070a, (ly - 11) * .2);
        if (c.top && ly < 2) col = ly ? 0x6a7684 : 0xa0acb8;
        return pk(col);
      }
      const inPit = c.tx >= k.pit[0] && c.tx <= k.pit[1];
      if (c.depth === 0 && c.top) {
        if (ly === 0) return pk(0xd8e0e8);
        if (ly < 4) return pk(((wx - wy) >> 2) & 1 ? 0xf0c020 : 0x1c1a16);
        if (ly === 4) return pk(0x0c1014);
        if (lx === 0 || lx === 15 || ly === 15) return pk(lx === 0 ? 0x6a7684 : 0x262e36);
        if ((lx % 4 === 1 || lx % 4 === 2) && (ly % 4 === 2 || ly % 4 === 3)) return pk(inPit ? mix(0x1462a0, 0x5ae0ff, .5 + .5 * Math.sin(wx * .07 + wy * .31)) : 0x0a1218);
        return pk(mix(0x4a5664, 0x6e7c8a, 1 - ly / 15));
      }
      let col = mix(0x1a2129, 0x28313b, noise(wx / 23, wy / 23, 5));
      if (inPit && c.depth <= 3 && c.ground) {
        if (lx >= 2 && lx <= 13 && ly >= 3 && ly <= 12) { const b = .5 + .5 * Math.sin(wy * .25 - wx * .05); return pk(hash(wx >> 1, wy >> 1, 9) < .05 ? 0xbff0ff : mix(0x0a3a66, 0x2ab8ff, b * .7)); }
        if (lx === 1 || lx === 14 || ly === 2 || ly === 13) return pk(0x8a96a4);
      }
      if (lx === 0) col = 0x0c1116; else if (lx === 1) col = sh(col, 1.25);
      if ((lx === 3 || lx === 12) && (ly === 3 || ly === 12)) col = 0x7a8694;
      if (c.h < .3 && ly >= 5 && ly <= 10 && lx >= 4 && lx <= 11 && ly % 2 === 0) col = 0x080b0e;
      if ((c.left && lx < 2) || (c.right && lx > 13)) col = (wy >> 2) & 1 ? 0xf0c020 : 0x1c1a16;
      if (c.bot && ly >= 12) col = mix(col, 0x020304, (ly - 11) * .22);
      return pk(col);
    },
    deco(c, r, k, h) {
      const b = h.b;
      // 캣워크 받침 기둥: 캣워크 끝과 6칸마다 아래 땅까지 (I 형강 · 사선 보강)
      for (const p of h.plats) {
        if (!h.inside(p.x0, p.y) || p.x1 - p.x0 < 4) continue;
        const xs = []; for (let x = p.x0 + 1; x <= p.x1 - 1; x += 6) xs.push(x); xs.push(p.x1 - 1);
        for (const tx of xs) {
          let gy = p.y + 1; while (gy < r.F + 1 && h.at(tx, gy) === '.') gy++;
          if (gy - p.y > 16 || h.at(tx, gy) === '.') continue;
          const X = h.X(tx) + 6, y0 = h.Y(p.y) + 11, y1 = h.Y(gy);
          b.F(X, y0, 4, y1 - y0, 0x3a4450); b.F(X, y0, 1, y1 - y0, 0x6a7684); b.F(X + 3, y0, 1, y1 - y0, 0x161c22);
          for (let y = y0 + 6; y < y1 - 4; y += 12) { b.line(X - 3, y, X + 7, y + 8, 1, 0x4a5664); b.line(X + 7, y, X - 3, y + 8, 1, 0x2e3640); }
          b.F(X - 2, y1 - 3, 8, 3, 0x5a6674);
        }
      }
      // 크레인 레일 (천장 밑 I 빔 · 볼트)
      for (const cr of r.arena.cranes || []) {
        const x0 = h.X(cr.a) - 8, x1 = h.X(cr.b + cr.w) + 8, y = h.Y(r.ty0);
        b.F(x0, y, x1 - x0, 7, 0x4a5664); b.F(x0, y, x1 - x0, 1, 0x8a96a4); b.F(x0, y + 6, x1 - x0, 1, 0x1a2028); b.F(x0, y + 2, x1 - x0, 3, 0x2e3640);
        for (let x = x0 + 4; x < x1; x += 16) b.F(x, y + 3, 2, 1, 0xa0acb8);
        b.F(x0 - 3, y - 2, 4, 11, 0x5a6672); b.F(x1 - 1, y - 2, 4, 11, 0x5a6672);
      }
      // 데크 앞면 경고판 (바이오해저드) · 경기장 쪽 냉각수 배관
      for (const [a, z] of r.arena.decks || []) {
        const face = a === r.tx0 ? z : a, gy = (() => { let y = r.ty0; while (y < r.F && !h.sol(face, y)) y++; return y; })();
        if (gy >= r.F) continue;
        const X = h.X(face) + 3, Y = h.Y(gy) + 20;
        b.poly([[X + 5, Y], [X + 11, Y + 10], [X - 1, Y + 10]], 0xf0c020); b.poly([[X + 5, Y + 2], [X + 9, Y + 9], [X + 1, Y + 9]], 0x1a1a16);
        b.circle(X + 5, Y + 6, 1.6, 0xf0c020); b.F(X + 2, Y + 14, 8, 2, 0xf0c020, .8);
      }
      const [pa, pz] = r.arena.pit || [0, -1];
      if (pz > pa) { const y = h.Y(r.F) + 34; b.F(h.X(pa), y, h.X(pz + 1) - h.X(pa), 5, 0x2a6a9a); b.F(h.X(pa), y, h.X(pz + 1) - h.X(pa), 1, 0x8ad8ff); for (let x = h.X(pa) + 10; x < h.X(pz + 1); x += 40) b.F(x, y - 1, 4, 7, 0x8a96a4); }
    }
  },

  // ---------------- 칠색조: 방울탑 꼭대기 황금 처마 지붕 ----------------
  //  지붕 껍질 2칸: 반원 수키와 · 암키와 골 · 줄마다 엇갈린 기와 · 막새 금빛 무늬 · 용마루(능선)는 흰 회반죽 띠
  //  그 아래: 붉은 주칠 서까래 마구리(초록 · 붉은 · 흰 단청 고리) + 32px 마다 단청 도리 띠 · 벽 · 천장은 비운다 (탁 트인 옥상 하늘)
  bellroof: {
    shaft: 0x24100c,
    ctx: r => ({ ridge: r.arena.ridge || [0, -1] }),
    px(c, lx, ly, wx, wy, k) {
      if (c.wall && !c.ground) return 0;
      if (c.ch === 'P' && c.ground) return ly < 2 ? pk(ly ? 0x6a3a1a : 0xc8904a) : ly < 4 ? pk(0x4a2410) : (lx === 2 || lx === 13) && ly < 9 ? pk(0x3a1a0c) : 0;   // 탑 안으로 내려가는 나무 사다리 디딤
      if (c.ch === 'P') {
        if (ly === 0) return pk(0xf4c850);
        if (ly < 3) return pk(ly === 1 ? 0x6a3420 : 0x4a2214);
        if (ly === 3) return pk(0xc8342a);
        if (ly === 4) return pk(0x7a1a14);
        return 0;
      }
      if (c.depth <= 1) {
        const ridge = c.top && c.tx >= k.ridge[0] && c.tx <= k.ridge[1];
        if (ridge && ly < 6) return pk(ly === 0 ? 0xf8e8a0 : ly === 1 ? 0xe8b440 : ly === 5 ? 0x8a7a60 : mix(0xf0ece0, 0xd8d0c0, ly / 5));
        if (c.top && ly === 0) return pk(0xb8c4d4);
        const row = Math.floor(wy / 6), off = (row & 1) * 4, u = mod(wx + off, 8), v = mod(wy, 6);
        const base = mix(0x3a4656, 0x5a687e, noise(wx / 50, wy / 50, 2));
        let col = mix(sh(base, .62), sh(base, 1.38), 1 - Math.abs(u - 3.5) / 3.5);
        if (u === 0) col = sh(base, .48);
        if (v === 5) col = sh(base, .42);
        if (v === 4 && (u === 3 || u === 4)) col = 0xf0b848;
        if (c.left && lx < 2) col = lx ? 0xe8b040 : 0x6a4a20;
        if (c.right && lx > 13) col = lx === 15 ? 0x6a4a20 : 0xe8b040;
        return pk(col);
      }
      const band = mod(wy, 32);
      if (band < 6) {
        if (band === 0 || band === 5) return pk(0x1a0e0a);
        const q = Math.floor(wx / 6), cols = [0x2a8a6a, 0x2a5aa8, 0xc0302a, 0xf0e0c0];
        return pk(cols[(q + band) & 3]);
      }
      const u = mod(wx, 10), v = mod(band - 6, 10), d = Math.hypot(u - 4.5, v - 4.5);
      if (d < 4.3) return pk(d < 1.2 ? 0xf4ece0 : d < 2.4 ? 0xc8342a : d < 3.4 ? 0x2a8a6a : 0x8a1a14);
      let col = mix(0x3a1410, 0x5a2016, noise(wx / 20, wy / 20, 4));
      if (c.bot && ly > 11) col = mix(col, 0x0a0404, (ly - 11) * .2);
      return pk(col);
    },
    deco(c, r, k, h) {
      const b = h.b;
      // 처마 끝 금빛 테 · 계단 모서리 금 장식
      for (const t of h.tops) {
        if (!h.inside(t.x0, t.y - 1) && t.y !== r.F) continue;
        const X0 = h.X(t.x0), X1 = h.X(t.x1 + 1), Y = h.Y(t.y);
        b.F(X0, Y - 1, X1 - X0, 1, 0x2a2a3a, .6);
        if (!h.sol(t.x0 - 1, t.y)) { b.F(X0 - 1, Y - 2, 3, 3, 0xf0c050); b.P(X0, Y - 3, 0xfff0b0); }
        if (!h.sol(t.x1 + 1, t.y)) { b.F(X1 - 2, Y - 2, 3, 3, 0xf0c050); b.P(X1 - 1, Y - 3, 0xfff0b0); }
      }
      // 용마루 양 끝 치미 (하늘로 휘어 오른 꼬리 장식)
      const [ra, rz] = r.arena.ridge || [0, -1];
      if (rz > ra) {
        let ty = r.ty0; while (ty < r.F && !h.sol(ra, ty)) ty++;
        for (const [tx, d] of [[ra, -1], [rz, 1]]) {
          const X = h.X(tx) + (d < 0 ? 2 : 14), Y = h.Y(ty);
          b.poly([[X, Y], [X + d * 2, Y - 14], [X + d * 7, Y - 22], [X + d * 9, Y - 18], [X + d * 6, Y - 12], [X + d * 7, Y]], 0x2a2a36);
          b.poly([[X + d * 1, Y - 2], [X + d * 3, Y - 13], [X + d * 7, Y - 19], [X + d * 7, Y - 15], [X + d * 5, Y - 10], [X + d * 5, Y - 2]], 0xe8b040);
          for (let j = 0; j < 4; j++) b.F(X + d * (2 + j), Y - 4 - j * 4, 2, 1, 0x8a6a20);
        }
      }
      // 처마 끝 용머리 (양 벽 쪽 가장 높은 처마 위)
      for (const side of [-1, 1]) {
        const tx = side < 0 ? r.tx0 : r.tx1 - 1;
        let ty = r.ty0; while (ty < r.F && !h.sol(tx, ty)) ty++;
        if (ty >= r.F) continue;
        const X = h.X(tx) + 8, Y = h.Y(ty), d = side;
        b.poly([[X - d * 6, Y], [X - d * 6, Y - 10], [X + d * 2, Y - 18], [X + d * 12, Y - 16], [X + d * 14, Y - 10], [X + d * 8, Y - 8], [X + d * 4, Y]], 0x7a5a18);
        b.poly([[X - d * 4, Y - 1], [X - d * 4, Y - 9], [X + d * 2, Y - 16], [X + d * 11, Y - 14], [X + d * 12, Y - 10], [X + d * 6, Y - 9], [X + d * 3, Y - 1]], 0xe8b440);
        b.F(X + d * 6, Y - 14, 2, 2, 0xc0201a); b.line(X + d * 2, Y - 16, X - d * 6, Y - 24, 1, 0xf0c050); b.line(X + d * 6, Y - 16, X + d * 2, Y - 26, 1, 0xf0c050);   // 눈 · 뿔
        b.F(X + d * 10, Y - 9, 5 * d, 1, 0xfff0b0);   // 입에 문 구슬 빛
      }
      // 청사초롱 몸통 (발판 = 초롱 뚜껑) · 금빛 살 · 아래 술
      for (const L of r.arena.lanterns || []) {
        if (h.at(L.x, L.y) !== 'P') continue;
        const X = h.X(L.x) + 2, w = L.w * TILE - 4, Y = h.Y(L.y) + 5, hh = 14 + Math.min(10, L.w * 2);
        b.F(X, Y, w, hh, 0xb8241e); b.F(X + 1, Y + 1, w - 2, hh - 2, 0xe0402a);
        b.grad(X + 2, Y + 2, w - 4, hh - 4, [[0, 0xff9a5a, .9], [.5, 0xffd08a, .85], [1, 0xe0402a, .6]]);
        for (let x = X + 4; x < X + w - 2; x += 6) b.F(x, Y, 1, hh, 0xf0c050, .85);
        b.F(X, Y + 3, w, 1, 0x2a6a9a); b.F(X, Y + hh - 4, w, 1, 0x2a6a9a);
        b.F(X - 1, Y + hh, w + 2, 2, 0x5a2a14);
        b.F(X + w / 2 - 1, Y + hh + 2, 2, 5, 0xf0c050); b.F(X + w / 2 - 2, Y + hh + 6, 4, 5, 0xc8342a);
      }
    }
  },

  // ---------------- 레쿠쟈: 하늘기둥 성층권 정상 ----------------
  //  풍화된 비취 석재: 줄마다 엇갈린 16×8 벽돌 · 깎인 모서리 · 줄눈 이끼 · 비바람 자국 · 벽돌 열에 하나 꼴로 에메랄드 네온 상형문자
  //  벽 · 바닥(구름바다) · 땅속은 비운다 — 하늘과 구름이 비친다 (바닥에 닿으면 구름바다로 떨어진다 — GameScene.updateAbyss)
  summit: {
    px(c, lx, ly, wx, wy) {
      if (c.wall || c.ground) return 0;
      if (c.ch === 'P') {
        if (ly === 0) return pk(0x9affd8);
        if (ly < 5) return pk(mix(0x2a8a70, 0x1a5a48, ly / 5));
        if (ly === 5) return pk(0x0e2a22);
        return 0;
      }
      const row = Math.floor(wy / 8), off = (row & 1) * 8, bx = Math.floor((wx + off) / 16), u = mod(wx + off, 16), v = mod(wy, 8), bh = hash(bx, row, 11);
      let col = mix(0x1e6a56, 0x3c9e7e, bh * .65 + noise(wx / 9, wy / 9, 4) * .35);
      if (v === 0) col = sh(col, 1.22); else if (v === 6) col = sh(col, .78);
      if (v === 7 || u === 0) col = hash(wx, wy, 3) < .38 ? (hash(wx, wy, 8) < .5 ? 0x6ab03a : 0x4a8a2a) : 0x0c261e;
      else if (bh > .55 && ((u <= 1 && v <= 1) || (u >= 14 && v >= 5))) col = sh(col, .45);
      else if (hash(wx, wy, 5) < .05) col = sh(col, .7);
      if (bh < .1 && u >= 3 && u <= 12 && v >= 1 && v <= 6) { const g = RUNES[Math.floor(bh * 40) % RUNES.length]; if (g[v - 1][u - 3] === '#') col = 0x8affd8; }
      if (c.top && ly < 3) col = ly === 0 ? 0xa8e05a : mix(0x5aa83a, col, ly / 3);
      if (c.bot && ly > 12) col = mix(col, 0x03100c, (ly - 12) * .25);
      if ((c.left && lx === 0) || (c.right && lx === 15)) col = sh(col, .55);
      return pk(col);
    },
    deco(c, r, k, h) {
      const b = h.b;
      // 윗면 풀 · 이끼 덤불 (바람에 한쪽으로 눕는다)
      for (const t of h.tops) {
        if (!h.inside(t.x0, t.y)) continue;
        for (let tx = t.x0; tx <= t.x1; tx++) for (let i = 0; i < 16; i += 2) {
          const x = h.X(tx) + i, hh = 1 + Math.floor(noise((tx * 16 + i) / 7, t.y, 3) * 5);
          if (hash(tx * 16 + i, t.y, 2) < .55) b.F(x, h.Y(t.y) - hh, 1, hh, hh > 3 ? 0x8ad84a : 0x5aa83a);
          if (hash(tx * 16 + i, t.y, 4) < .12) b.P(x + 1, h.Y(t.y) - hh - 1, 0xc8ff8a);
        }
      }
      // 아랫면 늘어진 이끼 · 덩굴
      for (const t of h.bots) {
        if (!h.inside(t.x0, t.y)) continue;
        for (let tx = t.x0; tx <= t.x1; tx++) for (let i = 1; i < 16; i += 3) { if (hash(tx * 16 + i, t.y, 6) > .45) continue; const len = 2 + Math.floor(hash(tx, i, t.y) * 9); b.F(h.X(tx) + i, h.Y(t.y + 1), 1, len, 0x3a8a3a); b.P(h.X(tx) + i, h.Y(t.y + 1) + len, 0x8ad84a); }
      }
      // 상형문자 자리를 기록 (빛 맥동 — buildArenaBackdrop)
      const g = r.arena.glyphs = [];
      for (let ty = r.ty0; ty < r.F; ty++) for (let tx = r.tx0; tx < r.tx1; tx++) {
        if (!h.sol(tx, ty)) continue;
        for (const sub of [0, 8]) { const wy = ty * TILE + sub, row = Math.floor(wy / 8), off = (row & 1) * 8; for (const wx of [tx * TILE, tx * TILE + 8]) { const bx = Math.floor((wx + off) / 16); if (hash(bx, row, 11) < .1 && !g.some(q => q.bx === bx && q.row === row)) g.push({ bx, row, x: bx * 16 - off + 8, y: row * 8 + 4 }); } }
      }
      r.arena.glyphs = g.slice(0, 40);
    }
  },

  // ---------------- 디아루가 · 펄기아: 창기둥 제단 ----------------
  //  순백 대리석(큰 마름돌 · 흐린 결 · 금빛 균열) · 윗면 눈 · 계단 앞면 달걀-화살촉 몰딩 · 옆면 세로 홈(플루트)
  //  쓰러진 기둥 = 비스듬한 홈 무늬 원기둥 · 그루터기 = 세로 홈 · 벽 = 신전 마름돌 + 벽기둥 · 천장 아랫면 = 그리스 뇌문 띠
  spear: {
    shaft: 0x5a5672,
    ctx: r => ({ fa: r.arena.fallen, st: r.arena.stump, dr: r.arena.drum, flip: r.arena.flip }),
    px(c, lx, ly, wx, wy, k) {
      if (c.ch === 'P') {
        if (ly < 3) return pk(ly === 2 ? 0xd8e4ff : 0xffffff);
        if (ly < 7) return pk(mix(0xf0eef8, 0xc8c4d8, (ly - 3) / 4));
        if (ly === 7) return pk(0x8a86a2);
        if (ly < 11) return mod(wx, 4) < 2 ? pk(0xd8d4e6) : pk(0xa8a4be);
        return 0;
      }
      if (c.wall) {
        const row = Math.floor(wy / 16), off = (row & 1) * 16, u = mod(wx + off, 32), v = mod(wy, 16);
        let col = mix(0xb0acc4, 0xc8c4d8, noise(wx / 30, wy / 30, 1));
        if (u === 0 || v === 0) col = 0x86829e;
        const pil = mod(wx, 80); if (pil < 14) { col = pil % 4 < 2 ? 0xdcd8e8 : 0xa4a0ba; if (pil === 0 || pil === 13) col = 0x76728e; }
        if (c.bot && ly >= 8) { const m = mod(wx, 12), n = ly - 8; const key = (n === 0 || n === 7) || (m === 0 && n < 6) || (n === 5 && m < 9) || (m === 8 && n > 1 && n < 6) || (n === 2 && m > 3 && m < 9) || (m === 4 && n > 1 && n < 4); col = key ? 0xe0b450 : 0x7a7694; }
        if (c.top && ly < 3) col = 0xffffff;
        if ((c.left && lx === 15) || (c.right && lx === 0)) col = sh(col, .7);
        return pk(col);
      }
      const inF = !c.ground && k.fa && c.tx >= k.fa[0] && c.tx <= k.fa[1], inS = !c.ground && k.st && c.tx >= k.st[0] && c.tx <= k.st[1], inD = !c.ground && k.dr && c.tx >= k.dr[0] && c.tx <= k.dr[1];
      let col;
      if (inF) { const s = mod(Math.floor(((k.flip ? -wx : wx) * .42 + wy) / 3), 3); col = [0xf0eef8, 0xd4d0e2, 0xb4b0c8][s]; if (mod(Math.floor(((k.flip ? -wx : wx) * .42 + wy)), 9) === 0) col = 0x9a96b0; }
      else if (inS) { const s = mod(wx, 5); col = s === 0 ? 0x9a96b0 : s < 3 ? 0xeceaf4 : 0xc4c0d6; }
      else if (inD) { const s = mod(wy, 6); col = s === 0 ? 0xa8a4be : 0xe4e2ee; if (mod(wx, 5) === 0) col = sh(col, .85); }
      else {
        col = mix(0xdedae8, 0xf4f2fa, noise(wx / 40, wy / 40, 2));
        const row = Math.floor(wy / 16), off = (row & 1) * 16;
        if (mod(wx + off, 32) === 0 || mod(wy, 16) === 0) col = 0xc4c0d6;
        if (Math.abs(fbm(wx / 90, wy / 30, 6) - .5) < .007) col = 0xb4b0c8;   // 결: 비스듬히 길게 흐르는 가는 회색 줄
        if (Math.abs(fbm(wx / 120 + 3, wy / 44, 9) - .5) < .0035) col = 0xe8b448;   // 금빛 균열
        if (c.ground && c.depth > 1) col = sh(col, .86);
      }
      if (c.top) {
        if (ly < 3) return pk(ly === 2 ? 0xd8e4ff : 0xffffff);
        if (c.depth === 0 && ly >= 5 && ly <= 9 && !inF) {
          const u = mod(wx, 8), v = ly - 5, egg = ((u - 3) ** 2) / 6.5 + ((v - 2) ** 2) / 4.4;
          col = v === 0 || v === 4 ? 0xc4c0d6 : egg <= .55 ? 0xf8f6fc : egg <= 1.05 ? 0x9e9ab6 : u === 7 ? 0x8e8aa8 : 0xe4e2ee;
        }
      }
      if (((c.left && lx < 3) || (c.right && lx > 12)) && !inF) col = (lx % 2 ? 0xa8a4be : 0xeceaf4);
      if (c.bot && ly > 11) col = mix(col, 0x4a4660, (ly - 11) * .16);
      return pk(col);
    },
    deco(c, r, k, h) {
      const b = h.b;
      // 윗면 눈더미 (봉긋봉긋 · 아래쪽은 푸른 그늘 · 반짝이)
      for (const t of h.tops) {
        if (t.y < r.ty0 - 1) continue;
        for (let x = h.X(t.x0) - 1; x <= h.X(t.x1 + 1); x++) {
          const hh = 1 + Math.floor(noise(x / 9, t.y, 5) * 4.5);
          b.F(x, h.Y(t.y) - hh, 1, hh, 0xffffff); b.P(x, h.Y(t.y) - 1, 0xd8e4ff);
          if (hash(x, t.y, 9) < .04) b.P(x, h.Y(t.y) - hh, 0xbfe0ff);
        }
      }
      for (const p of h.plats) for (let x = h.X(p.x0); x < h.X(p.x1 + 1); x++) { const hh = 1 + Math.floor(noise(x / 7, p.y, 2) * 3); b.F(x, h.Y(p.y) - hh, 1, hh, 0xffffff); }
      // 아랫면 고드름
      for (const t of [...h.bots, ...h.plats]) {
        for (let x = h.X(t.x0) + 2; x < h.X(t.x1 + 1) - 1; x += 3) {
          if (hash(x, t.y, 3) > .4) continue;
          const len = 3 + Math.floor(hash(x, t.y, 4) * 8), Y = h.Y(t.y + 1) - (h.at(t.x0, t.y) === 'P' ? 5 : 0);
          for (let j = 0; j < len; j++) b.F(x + (j > len * .6 ? .5 : 0), Y + j, j > len * .6 ? 1 : 2, 1, j === len - 1 ? 0xffffff : 0xb8dcff, .9);
        }
      }
      // 쓰러진 기둥: 기둥머리(코린트 아칸서스 잎) 쪽 끝 · 부러진 쪽 끝의 들쭉날쭉한 단면
      if (k.fa) {
        const lo = k.flip ? k.fa[1] : k.fa[0], hi = k.flip ? k.fa[0] : k.fa[1];
        let gy = r.ty0; while (gy < r.F && !h.sol(hi, gy)) gy++;
        const X = h.X(hi) + (k.flip ? 0 : 16), Y = h.Y(gy), d = k.flip ? -1 : 1;
        for (let j = 0; j < 4; j++) b.ellipse(X + d * 3, Y + 4 + j * 5, 5, 3, j % 2 ? 0xe8e4f0 : 0xb4b0c8);
        b.F(X + d * 1 - (d < 0 ? 6 : 0), Y - 4, 7, 4, 0xf4f2fa);
        for (let j = 0; j < 6; j++) b.F(h.X(lo) + (k.flip ? 16 : -2) - d * j, h.Y(r.F) - 3 - (j % 3) * 2, 2, 3, 0xdcd8e8);
      }
      // 부러진 그루터기 윗면: 깨진 단면
      if (k.st) { let gy = r.ty0; while (gy < r.F && !h.sol(k.st[0], gy)) gy++; const X0 = h.X(k.st[0]), X1 = h.X(k.st[1] + 1), Y = h.Y(gy); for (let x = X0; x < X1; x += 2) { const hh = Math.floor(hash(x, 1, 5) * 6); b.F(x, Y - hh, 2, hh, 0xeceaf4); b.P(x, Y - hh, 0xffffff); } }
    }
  },

  // ---------------- 기라티나 · 다크라이: 깨어진 세계 ----------------
  //  자주 · 검푸른 육각 현무암 결정 (칸마다 색 · 테두리 빛 · 그림자) + 보랏빛 반물질 에너지 줄기
  //  바닥 줄 = 반물질 심연의 막 (반투명 · 소용돌이 무늬) · 그 아래 · 벽은 허공
  distortion: {
    px(c, lx, ly, wx, wy, k) {
      if (c.ground) {
        const d = c.ty - k.F;
        if (d === 0) { if (ly < 2) return pk(ly ? 0x9a5ae8 : 0xe0b8ff, 235); const sw = fbm(wx / 26 + wy / 40, wy / 9, 3); return pk(mix(0x16052a, 0x7a34c8, sw * 1.2 - .1), Math.max(60, 210 - ly * 9)); }
        return pk(0x0a0216, Math.max(0, 110 - d * 26 - ly * 2));
      }
      if (c.wall) return 0;
      if (c.ch === 'P') {
        if (ly === 0) return pk(0xf0d8ff, 245);
        if (ly < 4) return pk(mix(0xa070ff, 0x6a3ad0, ly / 4), 175);
        if (ly === 4) return pk(0x3a1a8a, 120);
        return 0;
      }
      const hx = hexAt(wx, wy, 6), hc = [0x2a1a46, 0x36205c, 0x221636, 0x40286a][Math.floor(hash(hx.q, hx.r, 2) * 4)];
      let col = hx.e > .78 ? (hx.dy < 0 || hx.dx < 0 ? sh(hc, 1.7) : 0x0a0516) : mix(sh(hc, 1.25), hc, .5 + hx.dy / 10);
      const vn = Math.abs(fbm(wx / 20, wy / 20, 8) - .5);
      if (vn < .032) col = vn < .012 ? 0xf4e0ff : 0xa864ff;
      if (c.top && ly < 2) col = ly ? 0x8a6ad8 : 0xb8f4ff;
      if (c.bot && ly > 10) col = mix(col, 0x04010a, (ly - 10) * .17);
      if ((c.left && lx === 0) || (c.right && lx === 15)) col = sh(col, .6);
      return pk(col);
    },
    deco(c, r, k, h) {
      const b = h.b;
      // 섬 윗면에 솟은 육각 결정 기둥 (보라 · 청록 빛 끝)
      for (const t of h.tops) {
        if (!h.inside(t.x0, t.y) || t.y >= r.F) continue;
        for (let x = h.X(t.x0) + 2; x < h.X(t.x1 + 1) - 2; x += 3) {
          if (hash(x, t.y, 1) > .34) continue;
          const hh = 3 + Math.floor(hash(x, t.y, 2) * 11), w = hh > 9 ? 3 : 2, Y = h.Y(t.y), tint = hash(x, t.y, 3) < .5 ? 0x8a5ae8 : 0x4ad8d8;
          b.F(x, Y - hh, w, hh, 0x2a1a4a); b.F(x, Y - hh + 1, 1, hh - 1, tint); b.P(x + (w > 2 ? 1 : 0), Y - hh, 0xffffff);
          b.F(x + w, Y - Math.floor(hh / 2), 1, Math.floor(hh / 2), 0x140a24);
        }
      }
      // 섬 아래로 거꾸로 자란 결정 송곳 (빛나는 끝)
      for (const t of h.bots) {
        if (!h.inside(t.x0, t.y)) continue;
        for (let x = h.X(t.x0) + 1; x < h.X(t.x1 + 1) - 1; x += 2) {
          if (hash(x, t.y, 5) > .4) continue;
          const len = 4 + Math.floor(hash(x, t.y, 6) * 16), Y = h.Y(t.y + 1);
          for (let j = 0; j < len; j++) { const w = j < len * .5 ? 2 : 1; b.F(x, Y + j, w, 1, j > len - 3 ? 0x8affff : mix(0x3a2268, 0x8a5ae8, j / len)); }
        }
      }
      // 심연의 막 위 반물질 줄기 (가로로 흐르는 빛 선)
      const Y = h.Y(r.F);
      for (let x = 0; x < (r.X1 - r.X0) * TILE; x += 2) { const v = Math.sin(x * .045) * 2 + Math.sin(x * .013 + 1) * 3; if (hash(x, 3, 7) < .7) b.P(x, Y + 5 + v, 0xc890ff, .7); }
    }
  },

  // ---------------- 제크로무 · 레시라무: 용나선탑 꼭대기 흑과 백의 제단 ----------------
  //  왼쪽: 금빛 뇌문을 상감한 백색 대리석 (24×12 마름돌) · 오른쪽: 푸른 번개 회로가 흐르는 흑요석 (윤이 나는 사선 반사광)
  //  가운데 경계는 물결처럼 휘어 흑과 백이 맞물린다 · 가운데 바닥 앞면에 거대한 태극(음양) 문양
  yinyang: {
    shaft: 0x1a1820,
    ctx: r => ({ s: r.arena.split * TILE }),
    px(c, lx, ly, wx, wy, k) {
      const white = wx < k.s + Math.sin(wy / 18) * 10;
      if (c.ch === 'P') {
        if (white) return ly === 0 ? pk(0xf8d870) : ly < 4 ? pk(mix(0xf4f0e8, 0xd8d0c0, ly / 4)) : ly === 4 ? pk(0xa89878) : 0;
        return ly === 0 ? pk(0x8ac8ff) : ly < 4 ? pk(mix(0x2a2836, 0x14121a, ly / 4)) : ly === 4 ? pk(0x2a5ab8) : 0;
      }
      let col;
      if (white) {
        const row = Math.floor(wy / 12), off = (row & 1) * 12, u = mod(wx + off, 24), v = mod(wy, 12);
        col = mix(0xe4ded2, 0xf8f4ec, noise(wx / 30, wy / 30, 1));
        if (u === 0 || v === 0) col = 0xc4baa4;
        const gm = mod(wx, 24), gv = mod(wy, 24);
        if (!c.wall && ((gv === 14 && gm > 2 && gm < 22) || (gm === 3 && gv > 14 && gv < 20) || (gm === 21 && gv > 8 && gv < 14) || (gv === 8 && gm > 14 && gm < 22))) col = 0xd8a840;
        if (c.top && ly < 2) col = ly ? 0xc89838 : 0xfce090;
      } else {
        col = mix(0x13111a, 0x24202e, noise(wx / 26, wy / 26, 3));
        if (mod(wx + wy, 37) < 2) col = sh(col, 2.1);
        const gx = mod(wx, 16), gy = mod(wy, 16), bh = hash(wx >> 4, wy >> 4, 5);
        if (!c.wall || hash(wx >> 5, wy >> 5, 2) < .5) {
          if (bh < .55 && gx === 7) col = 0x2a6ad8;
          if (bh > .3 && gy === 9) col = 0x2a6ad8;
          if ((gx === 7 || gx === 8) && (gy === 9 || gy === 10) && bh < .75) col = 0xa8dcff;
        }
        if (c.top && ly < 2) col = ly ? 0x2a5ab8 : 0x9ad4ff;
      }
      if ((c.left && lx === 0) || (c.right && lx === 15)) col = sh(col, white ? .78 : .5);
      if (c.bot && ly > 11) col = mix(col, white ? 0x6a6050 : 0x020204, (ly - 11) * .18);
      return pk(col);
    },
    deco(c, r, k, h) {
      const b = h.b;
      // 태극 문양: 가운데 바닥 앞면 (흰 반쪽 · 검은 반쪽 · 서로의 눈)
      const X = h.X(r.arena.split), Y = h.Y(r.F) + 46, R = 38;
      b.circle(X, Y, R + 3, 0xd8a840);
      c.save(); c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.clip();
      b.F(X - R, Y - R, R, R * 2, 0xf4f0e8); b.F(X, Y - R, R, R * 2, 0x16141c);
      b.circle(X, Y - R / 2, R / 2, 0xf4f0e8); b.circle(X, Y + R / 2, R / 2, 0x16141c);
      c.restore();
      b.circle(X, Y - R / 2, R / 6, 0x16141c); b.circle(X, Y + R / 2, R / 6, 0xf4f0e8);
      b.ring(X, Y, R + 1, 2, 0x2a6ad8, .8); b.glow(X, Y - R / 2, R * .6, 0xfff0c0, .25); b.glow(X, Y + R / 2, R * .6, 0x6ab0ff, .3);
      // 계단 모서리 장식: 흰 쪽 금빛 꼭지 · 검은 쪽 푸른 결정 가시
      for (const t of h.tops) {
        if (!h.inside(t.x0, t.y)) continue;
        for (const tx of [t.x0, t.x1]) {
          const white = tx * TILE < k.s, Xs = h.X(tx) + (tx === t.x0 ? 1 : 13), Ys = h.Y(t.y);
          if (white) { b.F(Xs - 1, Ys - 3, 3, 3, 0xf8d870); b.P(Xs, Ys - 4, 0xffffff); }
          else { b.poly([[Xs - 2, Ys], [Xs, Ys - 9], [Xs + 2, Ys]], 0x1a1828); b.F(Xs, Ys - 8, 1, 7, 0x6ab0ff); }
        }
      }
    }
  },

  // ---------------- 아르세우스: 시초의 방 ----------------
  //  반투명 순백 · 황금빛 유리 (깊을수록 투명 — 밑으로 별이 비친다) · 칸마다 금세공 테두리 · 모서리 꽃장식 · 사선 굴절광
  //  벽 = 황금 결정 열주 (깎은 면 · 반투명) 사이 금빛 격자 · 유리 발판 = 금테 원반
  origin: {
    px(c, lx, ly, wx, wy) {
      if (c.ch === 'P') {
        if (ly === 0) return pk(0xfffbe8, 250);
        if (ly === 1) return pk(0xe8c060);
        if (ly < 5) return ((c.pl && lx < 2) || (c.pr && lx > 13)) ? pk(0xe8c060, 230) : pk(0xfff0d0, 150);
        if (ly === 5) return pk(0xd8b050, 210);
        if (ly === 6 && ((c.pl && lx < 4) || (c.pr && lx > 11))) return pk(0xd8b050, 160);
        return 0;
      }
      if (c.wall) {
        const p = mod(wx, 64);
        if (p < 18) { const f = p % 6; if (p === 0 || p === 17) return pk(0xb88a30, 220); return pk([0xfff2c8, 0xf0d890, 0xe2c272, 0xd0b060, 0xeacc80, 0xfff6dc][f], 170); }
        if (mod(wx + wy, 16) === 0 || mod(wx - wy, 16) === 0) return pk(0xe8c060, 110);
        if (c.top && ly < 2) return pk(0xfff0c0, 200);
        return pk(0xfff4d8, 22);
      }
      const a = c.depth === 0 ? 215 : c.depth === 1 ? 140 : c.depth === 2 ? 80 : 32;
      if (c.top && ly < 2) return pk(ly ? 0xe8c060 : 0xfffcf0, 252);
      if (lx === 0 || ly === 0) return pk(0xe8c060, Math.min(255, a + 70));
      if ((lx <= 2 && ly <= 2) || (lx >= 13 && ly <= 2)) return pk(0xf8dc80, Math.min(255, a + 50));
      if (lx === 8 && ly === 8) return pk(0xffffff, Math.min(255, a + 60));
      const st = mod(lx - ly, 16); if (st === 3 || st === 4) return pk(0xffffff, Math.min(255, a + 25));
      return pk(mix(0xfff4d8, 0xe8dcff, noise(wx / 40, wy / 40, 2)), a);
    },
    deco(c, r, k, h) {
      const b = h.b;
      // 천체 발판 고리: 발판마다 작은 행성 문장 (속성 플레이트 빛) · 고리를 잇는 빛의 궤도선
      const ring = r.arena.ring;
      if (ring && ring.pads.length) {
        const cx = h.X(ring.cx) + 8, cy = h.Y(ring.cy) + 2;
        c.save(); c.setLineDash([3, 4]); c.globalAlpha = .5; c.strokeStyle = rgba(0xffe8a0); c.lineWidth = 1; c.beginPath(); c.ellipse(cx, cy, ring.rx * TILE, ring.ry * TILE, 0, 0, Math.PI * 2); c.stroke(); c.restore();
        const PL = [0xff6a3a, 0x3a8aff, 0xffd83a, 0x5ad86a, 0x8ae8ff, 0xc85a3a, 0xa05ac8, 0xd8b06a, 0x9ab8ff, 0xff6aa8, 0xa8c83a, 0xb8a070];
        ring.pads.forEach((p, i) => { if (h.at(p.x, p.y) !== 'P') return; const X = h.X(p.x) + p.w * 8, Y = h.Y(p.y) + 10; b.circle(X, Y, 3.5, PL[i % PL.length]); b.ring(X, Y, 5, 1, 0xe8c060, .9); b.P(X - 1, Y - 2, 0xffffff); });
      }
      // 벽 금세공 소용돌이 (결정 기둥 사이)
      for (let ty = r.Y0 + 2; ty < r.F; ty += 4) for (const tx of [r.X0, r.X1 - 2]) {
        const X = h.X(tx) + 16, Y = h.Y(ty);
        b.arc(X, Y, 5, Math.PI * .2, Math.PI * 1.6, 1, 0xe8c060, .7); b.arc(X + 2, Y + 1, 2, 0, Math.PI * 2, 1, 0xfff0c0, .8);
      }
    }
  },

  // ---------------- 무한다이노 · 아비스 네크로즈마: 블랙나이트의 심장 원자로 ----------------
  //  흑철 육각 장갑판 (모서리 경사광 · 가운데 리벳) + 혈관처럼 흐르는 붉은 다이맥스 에너지 · 윗면 강철 테와 붉은 발광선
  //  원자로 해치 돔: 방사형 이음매 · 붉은/검은 경고 고리 · 트러스 빔 = 붉은 강철 플랜지 + X 격자
  reactor: {
    shaft: 0x0e0a0e,
    ctx: r => ({ d: r.arena.dome }),
    px(c, lx, ly, wx, wy, k) {
      if (c.ch === 'P') {
        if (ly === 0) return pk(0xff7a5a);
        if (ly === 1) return pk(0xc8302a);
        if (ly === 2) return pk(0x6a1010);
        if (ly < 11) { if (mod(lx + ly, 8) === 0 || mod(lx - ly, 8) === 0 || (c.pl && lx < 2) || (c.pr && lx > 13)) return pk(0x9a2020); return 0; }
        if (ly === 11) return pk(0x8a1a1a);
        return 0;
      }
      const hx = hexAt(wx, wy, 8), hc = mix(0x201d26, 0x3a3542, hash(hx.q, hx.r, 4));
      let col = hx.e > .84 ? (hx.dy < 0 || hx.dx < 0 ? 0x48434f : 0x070609) : mix(sh(hc, 1.35), hc, .5 + hx.dy / 16);
      if (Math.abs(hx.dx) < 1.2 && Math.abs(hx.dy) < 1.2) col = 0x5a5462;
      const vn = Math.abs(fbm(wx / 26, wy / 26, 12) - .5);
      if (vn < .011) col = vn < .004 ? 0xff7a90 : 0xb01836;
      if (k.d && !c.wall && c.depth <= 2) {
        const dx = wx - k.d.cx * TILE, dy = wy - (k.F + 2) * TILE, rr = Math.hypot(dx, dy), R = k.d.r * TILE;
        if (rr < R + 8) {
          const ang = Math.atan2(dy, dx);
          if (mod(ang * 12 / Math.PI, 1) < .06) col = 0x070609;
          if (Math.abs(rr - R * .62) < 2.5) col = Math.floor((ang + 4) * 14) & 1 ? 0xd01a3a : 0x14080c;
          if (Math.abs(rr - R * .62) < .8) col = 0xff9aa8;
        }
      }
      if (c.top && ly < 3) col = ly === 0 ? 0x6e6874 : ly === 1 ? 0xff3a5a : 0x8a1428;
      if (c.bot && ly > 11) col = mix(col, 0x020102, (ly - 11) * .22);
      if ((c.left && lx === 0) || (c.right && lx === 15)) col = 0x050406;
      return pk(col);
    },
    deco(c, r, k, h) {
      const b = h.b;
      // 사선 트러스: 토막 발판을 굵은 붉은 강철 보로 잇는다 (벽에서 가운데로)
      for (const seg of r.arena.beams || []) {
        if (seg.length < 2) continue;
        const a = seg[0], z = seg[seg.length - 1], dir = z.x > a.x ? 1 : -1, wall = seg.wall !== false;   // wall: 벽에 박힌 빔 · 아니면 공중의 첫 토막에서부터 (지그재그 2단)
        const X0 = wall ? h.X(dir > 0 ? r.tx0 : r.tx1) : h.X(a.x) + (dir > 0 ? 0 : a.w * 16), Y0 = h.Y(a.y) + 14, X1 = h.X(z.x) + (dir > 0 ? z.w * 16 : 0), Y1 = h.Y(z.y) + 12;
        b.line(X0, Y0 + 6, X1, Y1 + 6, 3, 0x6a1010); b.line(X0, Y0 + 5, X1, Y1 + 5, 1, 0xc8302a);
        const n = Math.max(2, Math.round(Math.abs(X1 - X0) / 16));
        for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, xa = X0 + (X1 - X0) * t0, ya = Y0 + (Y1 - Y0) * t0, xb = X0 + (X1 - X0) * t1, yb = Y0 + (Y1 - Y0) * t1; b.line(xa, ya - 10, xb, yb + 6, 1, 0x9a2020, .85); b.line(xa, ya + 6, xb, yb - 10, 1, 0x7a1818, .85); }
        if (wall) { b.F(X0 - (dir > 0 ? 0 : 6), Y0 - 10, 6, 20, 0x4a4450); b.F(X0 - (dir > 0 ? 0 : 6), Y0 - 10, 6, 1, 0x8a8494); }   // 벽 받침쇠
      }
      // 갠트리 아래 경고등 · 케이블
      const gt = r.arena.gantry;
      if (gt) for (let x = h.X(gt.x) + 12; x < h.X(gt.x + gt.w) - 8; x += 32) { b.F(x, h.Y(gt.y) + 12, 4, 3, 0xff2a4a); b.P(x + 1, h.Y(gt.y) + 12, 0xffd0d8); b.line(x + 2, h.Y(gt.y) + 15, x + 2 + 6, h.Y(gt.y) + 40, 1, 0x1a1418, .8); }
      // 돔 꼭대기 해치 볼트 고리
      const d = r.arena.dome;
      if (d) { const X = (d.cx - r.X0) * TILE, Y = h.Y(r.F - d.h); for (let i = -3; i <= 3; i++) b.F(X + i * 10 - 1, Y + 5, 3, 2, 0x8a8494); }
    }
  }
};

// 배경(systems/ArenaBackdrop.js)이 같이 쓰는 도우미
export { hash, noise, fbm, mix, sh, rgba, mod, brush, pixels };
