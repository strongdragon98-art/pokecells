// 보스 결전장 다층 배경 (game/Arenas.js 의 r.arenaStyle · r.arena · 타일 그림은 systems/ArenaArt.js)
//  결전장마다 3~4겹 패럴랙스 (반 해상도 캔버스를 ×2 로 — 도트 질감) + 움직이는 요소 (입자 · 회전 · 번개 · 깜빡임 · 흔들림)
//  겹마다 카메라를 따라가는 비율(k)이 달라 깊이가 생긴다 · 겹은 방 사각형(벽 포함)으로 잘라 이웃 방 배경에 번지지 않는다
//  화면에 결전장이 걸릴 때만 보이고 움직인다 (GameScene.updateArenaDrops)
import Phaser from 'phaser';
import { TILE } from '../config.js';
import { hash, noise, fbm, mix, rgba, brush, pixels } from './ArenaArt.js';

const MARGIN = 120;   // 겹마다 방 사각형 바깥 여유 (월드 px) — 카메라를 따라 밀려도 빈 데가 보이지 않게
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ADD = () => Phaser.BlendModes.ADD;
// 작은 캔버스 텍스처 (한 번만 만든다)
function tex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h), c = t.getContext();
  draw(c, brush(c)); t.refresh();
  return key;
}

class Backdrop {
  constructor(scene, r) {
    this.s = scene; this.r = r; this.layers = []; this.objs = []; this.lights = []; this.anims = []; this.t = 0; this.vis = null;
    this.RX = r.X0 * TILE; this.RY = r.Y0 * TILE; this.RW = (r.X1 - r.X0) * TILE; this.RH = (r.Y1 - r.Y0) * TILE;
    this.cx = this.RX + this.RW / 2; this.cy = this.RY + this.RH / 2;
    this.key = `arena:${scene.stageIdx}:${r.id}`;
    // 반 해상도 캔버스 좌표: 방 사각형 왼쪽 위 (m, m) · 크기 rw × rh · 천장선 top · 바닥선 floor · 양 벽 안쪽 x0 · x1 · 가운데 cx
    const m = MARGIN / 2;
    this.g = { m, rw: this.RW / 2, rh: this.RH / 2, w: Math.ceil((this.RW + MARGIN * 2) / 2), h: Math.ceil((this.RH + MARGIN * 2) / 2),
      top: m + (r.ty0 - r.Y0) * 8, floor: m + (r.F - r.Y0) * 8, x0: m + (r.tx0 - r.X0) * 8, x1: m + (r.tx1 - r.X0) * 8, cx: m + this.RW / 4 };
  }
  // 캔버스(반 해상도) 좌표 → 월드 좌표
  X(x) { return this.RX - MARGIN + x * 2; }
  Y(y) { return this.RY - MARGIN + y * 2; }
  // 겹 하나: k = 카메라를 따라가는 비율 (1 에 가까울수록 멀다)
  layer(name, k, depth, draw, o = {}) {
    const s = this.s, key = `${this.key}:${name}`, { w, h } = this.g;
    if (s.textures.exists(key)) s.textures.remove(key);
    const t = s.textures.createCanvas(key, w, h), c = t.getContext();
    draw(c, brush(c), this.g);
    t.refresh();
    const box = s.add.container(0, 0).setDepth(depth);
    const img = s.add.image(this.RX - MARGIN, this.RY - MARGIN, key).setOrigin(0).setScale(2);
    if (o.blend) img.setBlendMode(o.blend);
    box.add(img);
    if (o.alpha != null) box.setAlpha(o.alpha);
    const L = { box, img, k, key, ox: 0, oy: 0 };
    this.layers.push(L); this.objs.push(box);
    return L;
  }
  put(L, o) { L.box.add(o); return o; }                                     // 그 겹을 따라 움직이는 스프라이트 (월드 좌표)
  world(o, depth) { o.setDepth(depth); this.objs.push(o); return o; }       // 월드에 붙은 앞쪽 요소
  light(x, y, rad, col, k) { if (!this.s.webgl) return null; const l = this.s.lights.addLight(x, y, rad, col, k); this.lights.push(l); return l; }
  glow(L, x, y, col, sx, sy, a, depth = 0) { const o = this.s.add.image(x, y, 'glow').setBlendMode(ADD()).setTint(col).setScale(sx, sy).setAlpha(a); return L ? this.put(L, o) : this.world(o, depth); }
  pulse(o, base, amp, sp, ph = 0) { this.anims.push((dt, t) => o.setAlpha(Math.max(0, base + Math.sin(t * sp + ph) * amp))); return o; }
  // 입자 무리: spawn(p, first) 이 자리 · 속도를 정하고 · 방 사각형 밖으로 나가거나 수명이 다하면 다시 spawn
  swarm(n, key, depth, spawn, o = {}) {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const img = this.s.add.image(0, 0, key);
      if (o.blend) img.setBlendMode(o.blend);
      const p = { o: img, vx: 0, vy: 0, life: 99, t: 0, spin: 0, i };
      spawn(p, true); ps.push(p);
      if (o.layer) this.put(o.layer, img); else this.world(img, depth);
    }
    const x0 = this.RX - 20, x1 = this.RX + this.RW + 20, y0 = this.RY - 20, y1 = this.RY + this.RH + 20;
    this.anims.push(dt => {
      for (const p of ps) {
        p.t += dt; p.o.x += p.vx * dt; p.o.y += p.vy * dt;
        if (p.spin) p.o.rotation += p.spin * dt;
        if (p.wob) p.o.x += Math.sin(p.t * p.wob) * p.wa * dt;
        if (p.fade) p.o.setAlpha(Math.max(0, p.a0 * (1 - p.t / p.life)));
        if (p.t > p.life || p.o.x < x0 || p.o.x > x1 || p.o.y < y0 || p.o.y > y1) { p.t = 0; spawn(p, false); }
      }
    });
    return ps;
  }
  update(dt) {
    const v = this.s.cameras.main.worldView;
    const vis = v.right > this.RX && v.x < this.RX + this.RW && v.bottom > this.RY && v.y < this.RY + this.RH;
    if (vis !== this.vis) { this.vis = vis; for (const o of this.objs) o.setVisible(vis); }
    if (!vis) return;
    const dx = v.centerX - this.cx, dy = v.centerY - this.cy;
    for (const L of this.layers) {
      const ox = clamp(dx * L.k, -MARGIN + 2, MARGIN - 2), oy = clamp(dy * L.k, -MARGIN + 2, MARGIN - 2);
      L.ox = ox; L.oy = oy;
      L.box.setPosition(ox, oy);
      L.img.setCrop((MARGIN - ox) / 2, (MARGIN - oy) / 2, this.RW / 2, this.RH / 2);
    }
    this.t += dt;
    for (const f of this.anims) f(dt, this.t);
  }
  destroy() {
    const s = this.s;
    if (s.webgl) for (const l of this.lights) s.lights.removeLight(l);
    for (const L of this.layers) if (s.textures.exists(L.key)) s.textures.remove(L.key);
    this.lights = []; this.anims = []; this.layers = [];
  }
}

// 공용 그림 조각 (반 해상도 캔버스)
const ridge = (b, w, H, base, amp, f, col, ph = 0, k2 = .3) => { for (let x = 0; x < w; x += 1) { const hh = base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.7 + ph * 2) * amp * k2 + (noise(x / 9, ph, 3) - .5) * amp * .4; b.F(x, H - hh, 1, hh, col); } };
const cloudBand = (b, x, y, w, hh, dark, lit, glowC, a = 1) => {   // 아래에서 비치는 노을 구름: 어두운 몸통 · 밝은 아랫단 · 빛나는 테
  for (let k = 0; k < Math.max(3, w / 14); k++) { const cx = x + hash(k, 1, x | 0) * w, rx = 10 + hash(k, 2, x | 0) * w * .25, ry = hh * (.4 + hash(k, 3, x | 0) * .5); b.ellipse(cx, y, rx, ry, dark, .75 * a); }
  b.ellipse(x + w / 2, y + hh * .35, w * .48, hh * .32, lit, .7 * a); b.ellipse(x + w / 2, y + hh * .48, w * .36, hh * .16, glowC, .75 * a);
};
const pagoda = (b, x, base, floors, s, col, rim) => {   // 층층 지붕 탑 실루엣 (처마 끝이 위로 휜다)
  let y = base;
  for (let f = 0; f < floors; f++) {
    const w = (26 - f * 4) * s, hh = 9 * s;
    b.F(x - w * .32, y - hh, w * .64, hh, col);
    b.poly([[x - w / 2 - 3 * s, y - hh + 1], [x - w * .36, y - hh - 4 * s], [x + w * .36, y - hh - 4 * s], [x + w / 2 + 3 * s, y - hh + 1]], col);
    b.F(x - w / 2 - 3 * s, y - hh, 2, 1, rim); b.F(x + w / 2 + 3 * s - 2, y - hh, 2, 1, rim);
    y -= hh + 4 * s;
  }
  b.F(x - 1, y - 12 * s, 2, 12 * s, col); b.circle(x, y - 12 * s, 1.5 * s, rim);
};
const column = (b, x, base, hh, w, col, lite, dark, broken = 0) => {   // 그리스식 기둥 (홈 · 주두 · 주춧돌 · 부러진 윗단)
  const top = base - hh;
  b.F(x - w / 2 - 2, base - 3, w + 4, 3, dark);
  b.F(x - w / 2, top, w, hh - 3, col);
  for (let i = 1; i < w; i += 3) b.F(x - w / 2 + i, top + 3, 1, hh - 7, i % 2 ? lite : dark);
  if (!broken) { b.F(x - w / 2 - 3, top - 3, w + 6, 3, lite); b.F(x - w / 2 - 1, top, w + 2, 2, dark); }
  else for (let i = 0; i < w; i += 2) { const n = Math.floor(hash(i, x | 0, 3) * broken); b.F(x - w / 2 + i, top - n, 2, n + 1, col); }
};
const boltPath = (gfx, x, y, len, step, jit, col, w) => { gfx.lineStyle(w, col, .95).beginPath().moveTo(x, y); let px = x; for (let yy = y; yy < y + len; yy += step) { px += (Math.random() - .5) * jit; gfx.lineTo(px, yy); } gfx.strokePath(); };

const DROPS = {
  // ---------------- 뮤츠: 생체 공학 코어 ----------------
  //  먼 벽: 패널 격자 · 천장 조명 띠 · 점멸등이 박힌 서버 랙 줄 / 가운데: 유리가 산산조각 난 초대형 원통 배양 캡슐 (흘러내리는 초록 배양액 · 끊어진 전선 · 스파크)
  //  앞: 요동치는 그래프 · 염기서열 · 뮤츠 스캔이 뜬 슈퍼컴퓨터 홀로그램 모니터 수십 장 · 붉은 회전 경광등
  biolab(bd, r) {
    const s = bd.s, sparks = [], drips = [], mons = [];
    bd.layer('wall', .56, 1.6, (c, b, g) => {
      b.grad(0, 0, g.w, g.h, [[0, 0x071014], [.55, 0x0d1a20], [1, 0x081014]]);
      for (let x = 0; x < g.w; x += 20) for (let y = 0; y < g.h; y += 15) { if (hash(x, y, 1) < .35) b.F(x + 2, y + 2, 16, 11, 0x12212a, .9); b.F(x, y, 20, 1, 0x050a0c, .7); b.F(x, y, 1, 15, 0x050a0c, .8); }
      for (let x = 6; x < g.w; x += 26) { b.glow(x + 7, g.top + 4, 16, 0x8ae0ff, .2); b.F(x, g.top + 2, 14, 2, 0xbff0ff, .6); }
      for (let x = 0; x < g.w; x += 9) {
        const hh = 30 + hash(x, 3, 2) * 34, y = g.floor - hh;
        b.F(x, y, 8, hh, 0x0b151b); b.F(x, y, 8, 1, 0x2a3a44); b.F(x + 7, y, 1, hh, 0x050a0c);
        for (let yy = y + 4; yy < g.floor - 2; yy += 4) { b.F(x + 1, yy, 6, 1, 0x0f1b22); if (hash(x, yy, 4) < .33) b.P(x + 1 + Math.floor(hash(x, yy, 5) * 5), yy - 1, [0x4aff8a, 0xffb02a, 0xff3a3a, 0x4ad8ff][Math.floor(hash(x, yy, 6) * 4)], .95); }
      }
      for (const yy of [g.top + 30, g.top + 64]) { b.F(0, yy, g.w, 4, 0x1a262e); b.F(0, yy, g.w, 1, 0x3a4c58); for (let x = 10; x < g.w; x += 40) b.F(x, yy - 1, 3, 6, 0x2e3e48); }
    });
    const cap = bd.layer('capsule', .38, 1.7, (c, b, g) => {
      const cx = g.cx, W2 = Math.min(48, g.rw * .1), top = g.top + 14, bot = g.floor - 6, gy0 = top + 22, gy1 = bot - 22;
      b.glow(cx, (gy0 + gy1) / 2, W2 * 3.2, 0x2aff7a, .22);
      // 받침대 · 양옆 배관
      b.F(cx - W2 - 18, bot - 4, (W2 + 18) * 2, 12, 0x1a242c); b.F(cx - W2 - 18, bot - 4, (W2 + 18) * 2, 2, 0x4a5a66);
      for (const d of [-1, 1]) { const x = d < 0 ? cx - W2 - 70 : cx + W2 + 4; b.F(x, bot - 26, 66, 7, 0x26323c); b.F(x, bot - 26, 66, 1, 0x5a6a76); b.F(x, gy0 + 6, 66, 5, 0x22303a); for (let i = 0; i < 66; i += 14) b.F(x + i, bot - 28, 3, 11, 0x3a4854); }
      // 아래 · 위 기계 뚜껑 (고리 · 볼트 · 경고 띠)
      for (const [y, hh] of [[bot - 22, 18], [top, 22]]) {
        b.F(cx - W2 - 6, y, (W2 + 6) * 2, hh, 0x28323c); b.F(cx - W2 - 6, y, (W2 + 6) * 2, 2, 0x6a7a86); b.F(cx - W2 - 6, y + hh - 2, (W2 + 6) * 2, 2, 0x10161c);
        for (let x = cx - W2; x < cx + W2; x += 8) b.F(x, y + hh / 2 - 1, 2, 2, 0x9aa8b4);
        b.F(cx - W2 - 6, y + 4, (W2 + 6) * 2, 2, 0xf0c020, .8);
      }
      // 유리 원통 속: 어둠 · 남은 배양액 · 기포
      b.grad(cx - W2, gy0, W2 * 2, gy1 - gy0, [[0, 0x041009], [1, 0x082016]]);
      const lvl = gy1 - (gy1 - gy0) * .28;
      b.grad(cx - W2, lvl, W2 * 2, gy1 - lvl, [[0, 0x4aff9a, .85], [1, 0x0a6a3a, .95]]); b.F(cx - W2, lvl, W2 * 2, 1, 0xcaffe0);
      for (let k = 0; k < 40; k++) b.circle(cx - W2 + 3 + hash(k, 1, 3) * (W2 * 2 - 6), lvl + 3 + hash(k, 2, 3) * (gy1 - lvl - 4), .8 + hash(k, 3, 3) * 1.4, 0xcaffe0, .6);
      // 뮤츠가 빠져나간 자리: 끊어진 연결관 · 늘어진 전선 (끝은 스파크)
      for (let k = 0; k < 14; k++) {
        const x0 = cx - W2 + 6 + k * (W2 * 2 - 12) / 13, len = 20 + hash(k, 4, 2) * (lvl - gy0 - 26), sway = (hash(k, 5, 2) - .5) * 14, col = [0x1a1a1e, 0x9a1e1e, 0x2a5aa8, 0xc8a422][k % 4];
        const pts = []; for (let j = 0; j <= 10; j++) { const t = j / 10; pts.push([x0 + sway * t * t, gy0 + len * t]); }
        b.path(pts, 1.4, col); if (k % 3 === 0) sparks.push(pts[pts.length - 1]);
      }
      // 유리: 왼쪽 반만 남았다 — 세로 반사광 · 들쭉날쭉한 깨진 가장자리 · 바닥에 흩어진 조각
      const edge = y => cx + W2 * .1 + Math.sin(y * .31) * 6 + (hash(Math.floor(y / 5), 1, 7) - .5) * 12;
      for (let y = gy0; y < gy1; y++) { const ex = Math.min(cx + W2, edge(y)); b.F(cx - W2, y, ex - (cx - W2), 1, 0x8affc8, .1); b.P(ex, y, 0xe0fff0, .9); b.P(ex - 1, y, 0x8affc8, .5); }
      b.F(cx - W2 + 4, gy0 + 4, 3, gy1 - gy0 - 8, 0xffffff, .28); b.F(cx - W2 + 10, gy0 + 4, 1, gy1 - gy0 - 8, 0xffffff, .18);
      b.F(cx - W2, gy0, 2, gy1 - gy0, 0xbfffe0, .5); b.F(cx + W2 - 2, gy0, 2, (gy1 - gy0) * .18, 0xbfffe0, .5); b.F(cx + W2 - 2, gy1 - (gy1 - gy0) * .12, 2, (gy1 - gy0) * .12, 0xbfffe0, .5);
      for (let k = 0; k < 26; k++) { const x = cx - W2 - 30 + hash(k, 6, 1) * (W2 * 2 + 70), y = bot - 6 - hash(k, 7, 1) * 4, w = 2 + hash(k, 8, 1) * 5; b.poly([[x, y], [x + w, y - 1 - hash(k, 9, 1) * 4], [x + w + 2, y]], 0xa8ffd8, .55); }
      // 깨진 틈에서 흘러내린 배양액 줄기 · 받침대 위 웅덩이
      for (let k = 0; k < 5; k++) { const y0 = lvl + 2 + k * 3, x = edge(y0) + 1; b.F(x, y0, 2, bot - 4 - y0, 0x4aff9a, .75); b.F(x, y0, 1, bot - 4 - y0, 0xcaffe0, .6); drips.push([x + 1, y0]); }
      b.ellipse(cx + W2 + 18, bot - 2, 36, 3, 0x3aff8a, .7); b.ellipse(cx + W2 + 14, bot - 3, 22, 1.5, 0xcaffe0, .7);
      // 천장에서 늘어진 끊어진 전선 (끝에서 스파크)
      for (let k = 0; k < 9; k++) { const x0 = cx - W2 - 40 + k * (W2 * 2 + 80) / 8, len = 14 + hash(k, 2, 9) * 40, pts = []; for (let j = 0; j <= 8; j++) { const t = j / 8; pts.push([x0 + Math.sin(t * 3 + k) * 4, g.top + len * t]); } b.path(pts, 1.2, [0x1a1a1e, 0x9a1e1e, 0x2a5aa8][k % 3]); if (k % 2) sparks.push(pts[pts.length - 1]); }
    });
    const holo = bd.layer('holo', .2, 1.8, (c, b, g) => {
      const col = 0x4af0ff, W = 34, H = 22, banks = [];
      for (const side of [-1, 1]) for (let ci = 0; ci < 4; ci++) for (let ri = 0; ri < 3; ri++) {
        const x = side < 0 ? g.x0 + 10 + ci * (W + 6) : g.x1 - 10 - (ci + 1) * (W + 6) + 6, y = g.top + 22 + ri * (H + 8) + (ci % 2) * 4;
        if (Math.abs(x + W / 2 - g.cx) < 76 || y + H > g.floor - 40) continue;
        banks.push([x, y, ci * 3 + ri + (side > 0 ? 12 : 0)]);
      }
      for (const [x, y, n] of banks) {
        const kind = n % 6, C = n % 7 === 3 ? 0xff4a5a : col;
        b.F(x, y, W, H, C, .1); b.F(x, y, W, 1, C, .9); b.F(x, y + H - 1, W, 1, C, .6); b.F(x, y, 1, H, C, .7); b.F(x + W - 1, y, 1, H, C, .7);
        b.F(x + 2, y + 2, 10, 1, C, .8); b.F(x + W - 6, y + 2, 4, 1, 0xffffff, .7);
        if (kind === 0) for (let i = 0; i < 8; i++) { const hh = 3 + hash(n, i, 3) * 12; b.F(x + 3 + i * 3.6, y + H - 3 - hh, 2, hh, C, .8); }
        else if (kind === 1) mons.push([x + 2, y + 6, W - 4, H - 9, C]);
        else if (kind === 2) for (let i = 0; i < 5; i++) b.F(x + 3, y + 6 + i * 3, 6 + hash(n, i, 4) * 22, 1, C, .7);
        else if (kind === 3) for (let i = 0; i < 26; i++) { const t = i / 25, yy = y + 6 + t * (H - 9), a = Math.sin(t * 9) * 6; b.P(x + W / 2 + a, yy, C, .9); b.P(x + W / 2 - a, yy, 0xffffff, .6); if (i % 3 === 0) b.F(x + W / 2 - Math.abs(a), yy, Math.abs(a) * 2, 1, C, .35); }
        else if (kind === 4) { b.circle(x + W / 2, y + 9, 4, C, .5); b.F(x + W / 2 - 3, y + 13, 6, 6, C, .45); b.F(x + W / 2 + 2, y + 14, 6, 2, C, .45); b.ring(x + W / 2, y + 12, 8, 1, C, .5); b.F(x + 2, y + H - 4, W - 4, 1, 0xff4a5a, .8); }
        else { b.poly([[x + W / 2, y + 5], [x + W / 2 + 7, y + H - 4], [x + W / 2 - 7, y + H - 4]], 0xff4a5a, .6); b.F(x + W / 2, y + 9, 1, 5, 0xffffff, .9); mons.push([x + 2, y + H - 5, W - 4, 3, 0xff4a5a]); }
      }
      for (const [x] of banks) b.F(x + 6, g.floor - 20, 22, 20, 0x0c161c, .9);
    }, { blend: ADD() });
    // 모니터 그래프 칸 위를 흐르는 파형
    const wave = tex(s, 'arena:wave', 64, 12, (c, b) => { for (let x = 0; x < 64; x++) { const y = 6 + Math.sin(x * .3) * 3 + Math.sin(x * 1.3) * 2 * (x % 16 < 8 ? 1 : .3); b.P(x, y, 0xffffff); b.P(x, y + 1, 0xffffff, .4); } });
    for (const [x, y, w, h, col] of mons) {
      const ts = bd.put(holo, s.add.tileSprite(bd.X(x), bd.Y(y), w * 2, h * 2, wave).setOrigin(0).setTint(col).setBlendMode(ADD()).setAlpha(.85));
      const sp = 30 + hash(x | 0, y | 0, 2) * 50; bd.anims.push(dt => { ts.tilePositionX += dt * sp; });
    }
    bd.anims.push((dt, t) => holo.box.setAlpha(.82 + Math.sin(t * 23) * .04 + (Math.random() < .02 ? -.3 : 0)));
    // 붉은 회전 경광등 (양 벽)
    for (const [x, y] of [[bd.RX + 34, r.ty0 * TILE + 70], [bd.RX + bd.RW - 34, r.ty0 * TILE + 70], [bd.RX + 34, r.F * TILE - 150], [bd.RX + bd.RW - 34, r.F * TILE - 150]]) {
      bd.world(s.add.rectangle(x, y, 8, 6, 0x5a1010), 10.3);
      const core = bd.glow(null, x, y, 0xff2a3a, .5, .5, .9, 10.35), beam = bd.glow(null, x, y, 0xff2a3a, 3, .45, .3, 10.34), L = bd.light(x, y + 10, 140, 0xff2a3a, 1);
      bd.anims.push((dt, t) => { const k = (Math.sin(t * 6 + x) + 1) / 2; beam.setScale(.6 + 2.6 * k, .45).setAlpha(.1 + k * .3); core.setAlpha(.5 + k * .5); if (L) L.setIntensity(.3 + k * 1.1); });
    }
    // 스파크 · 배양액 방울 (캡슐 겹을 따라)
    const sp = bd.swarm(18, 'px', 0, (p, first) => { const q = sparks[Math.floor(Math.random() * sparks.length)] || [bd.g.cx, bd.g.top]; p.o.setPosition(bd.X(q[0]), bd.Y(q[1])).setTint(Math.random() < .5 ? 0xffffff : 0x8ae8ff).setScale(1.5).setAlpha(.95); p.vx = (Math.random() - .5) * 120; p.vy = -40 - Math.random() * 80; p.life = first ? Math.random() * 1.2 : .25 + Math.random() * .5; p.fade = true; p.a0 = 1; }, { layer: cap, blend: ADD() });
    bd.anims.push(dt => { for (const p of sp) p.vy += 260 * dt; });
    bd.swarm(6, 'px', 0, (p, first) => { const q = drips[Math.floor(Math.random() * drips.length)] || [bd.g.cx, bd.g.floor]; p.o.setPosition(bd.X(q[0]), bd.Y(q[1]) + (first ? Math.random() * 60 : 0)).setTint(0x6aff9a).setScale(2, 3); p.vx = 0; p.vy = 70 + Math.random() * 40; p.life = 1.4; }, { layer: cap });
    bd.light(bd.cx, r.F * TILE - 110, 280, 0x3aff8a, .9);
    bd.light(bd.RX + 150, r.ty0 * TILE + 120, 220, 0x4af0ff, .7); bd.light(bd.RX + bd.RW - 150, r.ty0 * TILE + 120, 220, 0x4af0ff, .7);
  },

  // ---------------- 칠색조: 방울탑 꼭대기 ----------------
  //  하늘: 보랏빛 → 핏빛 → 황금빛 노을 · 거대한 보름달 · 아래에서 불타는 노을 구름 / 먼 산맥 · 인주시티 탑들 · 불탄탑 실루엣 · 단풍 언덕
  //  앞: 양 끝 붉은 주칠 기둥과 바람에 흔들리는 거대한 황금 방울 · 흩날리는 단풍잎과 금빛 재
  bellroof(bd, r) {
    const s = bd.s, g = bd.g;
    bd.layer('sky', .62, 1.6, (c, b, g) => {
      b.grad(0, 0, g.w, g.h, [[0, 0x1c1040], [.22, 0x46205a], [.45, 0xa8364a], [.62, 0xe86a3a], [.8, 0xffb05a], [1, 0xffe0a0]]);
      b.stars(120, 0, 0, g.w, g.h * .3, 3, [0xffffff, 0xffe0f0]);
      const mx = g.m + g.rw * .27, my = g.m + g.rh * .3, R = Math.min(64, g.rh * .18);
      b.glow(mx, my, R * 2.6, 0xfff0d8, .32);
      b.circle(mx, my, R, 0xf8e8cc);
      for (let k = 0; k < 9; k++) b.ellipse(mx + (hash(k, 1, 2) - .5) * R * 1.3, my + (hash(k, 2, 2) - .5) * R * 1.3, R * (.08 + hash(k, 3, 2) * .18), R * (.06 + hash(k, 4, 2) * .14), 0xd8c4a8, .7);
      b.ellipse(mx - R * .2, my - R * .15, R * .5, R * .34, 0xe0ccb0, .45);
      b.arc(mx, my, R, -2.2, .4, 2, 0xfffaf0, .8);
      for (let k = 0; k < 28; k++) { const y = g.m + g.rh * (.3 + hash(k, 1, 4) * .5), x = hash(k, 2, 4) * g.w, w = 40 + hash(k, 3, 4) * 130, hh = 5 + hash(k, 4, 4) * 9; cloudBand(b, x - w / 2, y, w, hh, k % 2 ? 0x4a2240 : 0x5a2a46, 0xff7a4a, 0xffd890, .9); }
      const sx = g.m + g.rw * .8, sy = g.floor - 6; b.glow(sx, sy, 140, 0xffd890, .5); b.glow(sx, sy, 50, 0xfff4d0, .8); b.circle(sx, sy, 16, 0xfff8e0);
    });
    bd.layer('far', .45, 1.7, (c, b, g) => {
      ridge(b, g.w, g.floor + 4, 60, 14, .011, 0x6a3a5a, 1); ridge(b, g.w, g.floor + 4, 42, 10, .019, 0x4a2440, 3);
      for (let k = 0; k < 7; k++) pagoda(b, g.m + g.rw * (.08 + k * .14) + (hash(k, 1, 5) - .5) * 30, g.floor - 22 - hash(k, 2, 5) * 10, 3 + (k % 3), .7 + hash(k, 3, 5) * .4, 0x2a1428, 0xffb060);
      const bx = g.m + g.rw * .63, by = g.floor - 26;   // 불탄탑: 그을려 기운 실루엣 · 무너진 꼭대기에서 오르는 연기
      b.poly([[bx - 18, by], [bx - 12, by - 60], [bx - 2, by - 72], [bx + 6, by - 64], [bx + 14, by - 70], [bx + 18, by]], 0x1a0a14);
      for (let k = 0; k < 10; k++) b.ellipse(bx + k * 3, by - 76 - k * 7, 6 + k * 1.6, 3 + k, 0x3a2a34, .35 - k * .025);
      for (let x = 0; x < g.w; x += 2) { const hh = 18 + Math.sin(x * .05) * 5 + hash(x, 1, 9) * 4; b.F(x, g.floor - hh + 30, 2, hh, hash(x, 2, 9) < .5 ? 0x8a2a1a : 0xa83a1a); if (hash(x, 3, 9) < .3) b.P(x, g.floor - hh + 29, 0xff7a3a); }
    });
    bd.layer('mid', .26, 1.8, (c, b, g) => {
      for (let k = 0; k < 12; k++) { const y = g.m + g.rh * (.55 + hash(k, 1, 8) * .3), x = hash(k, 2, 8) * g.w, w = 60 + hash(k, 3, 8) * 120; cloudBand(b, x - w / 2, y, w, 8 + hash(k, 4, 8) * 6, 0x6a2a3a, 0xff9a5a, 0xffe0a0, .55); }
      for (let k = 0; k < 14; k++) { const x = hash(k, 5, 8) * g.w, y = g.m + hash(k, 6, 8) * g.rh * .5; b.F(x, y, 3, 1, 0x2a1020, .7); b.P(x - 1, y - 1, 0x2a1020, .7); b.P(x + 3, y - 1, 0x2a1020, .7); }   // 멀리 나는 새 떼
    });
    // 양 끝: 붉은 주칠 기둥 · 단청 띠 · 공포(받침) · 방울을 거는 팔
    const near = bd.layer('pillars', .06, 1.9, (c, b, g) => {
      for (const side of [-1, 1]) {
        const x = side < 0 ? g.x0 + 4 : g.x1 - 4, y0 = g.top - 4, y1 = g.floor - 40, w = 9;
        b.F(x - w / 2, y0, w, y1 - y0, 0xa8241e); b.F(x - w / 2, y0, 2, y1 - y0, 0xd84a3a); b.F(x + w / 2 - 2, y0, 2, y1 - y0, 0x6a120e);
        for (let y = y0 + 10; y < y1 - 10; y += 46) { b.F(x - w / 2 - 1, y, w + 2, 6, 0x2a8a6a); b.F(x - w / 2 - 1, y + 2, w + 2, 2, 0xf0c050); b.F(x - w / 2 - 1, y + 4, w + 2, 1, 0x2a5aa8); }
        b.F(x - w / 2 - 4, y0, w + 8, 6, 0x2a8a6a); b.F(x - w / 2 - 4, y0 + 2, w + 8, 1, 0xf0c050);
        const ax = side < 0 ? x : x - 12; b.F(ax - 2, y0 + 14, 16, 3, 0x5a2a14); b.F(ax - 2, y0 + 14, 16, 1, 0xf0c050);
      }
    });
    const bell = tex(s, 'arena:bell', 16, 22, (c, b) => {
      b.F(7, 0, 2, 4, 0x6a4a18);
      b.poly([[8, 3], [13, 8], [14, 17], [16, 19], [0, 19], [2, 17], [3, 8]], 0xc89030);
      b.poly([[8, 4], [12, 8], [12, 16], [4, 16], [4, 8]], 0xf0c050); b.F(5, 7, 2, 9, 0xfff0b0, .8);
      b.F(1, 18, 14, 2, 0x8a6020); b.circle(8, 21, 1.6, 0x8a6020);
    });
    for (const side of [-1, 1]) {
      const x = bd.X(side < 0 ? g.x0 + 4 + 10 : g.x1 - 4 - 10), y = bd.Y(g.top + 13);
      const bl = bd.put(near, s.add.image(x, y, bell).setOrigin(.5, 0).setScale(1.6));
      const gl = bd.put(near, s.add.image(x, y + 26, 'glow').setBlendMode(ADD()).setTint(0xffd070).setScale(1.2).setAlpha(.35));
      bd.anims.push((dt, t) => { const a = Math.sin(t * 1.4 + side) * .22 + Math.sin(t * 3.1) * .04; bl.setRotation(a); gl.setPosition(x - Math.sin(a) * 26, y + Math.cos(a) * 26).setAlpha(.3 + Math.abs(a) * .5); });
    }
    // 청사초롱 빛 (몸통 가운데 · 맥동) + 조명
    for (const [i, L] of (r.arena.lanterns || []).entries()) {
      const x = (L.x + L.w / 2) * TILE, y = L.y * TILE + 18;
      bd.pulse(bd.glow(null, x, y, 0xff9a4a, .9 + L.w * .3, .9, .55, 10.4), .5, .12, 2 + i * .3, i);
      if (i % 2 === 0) bd.light(x, y, 150, 0xffa060, 1.1);
    }
    // 흩날리는 단풍잎 · 금빛 재 (앞쪽)
    const leaf = tex(s, 'arena:leaf', 6, 5, (c, b) => { b.F(1, 1, 4, 3, 0xffffff); b.P(0, 2, 0xffffff); b.P(5, 2, 0xffffff); b.P(2, 0, 0xffffff); b.P(3, 4, 0xffffff); });
    bd.swarm(26, leaf, 10.6, (p, first) => { p.o.setPosition(bd.RX + Math.random() * bd.RW, first ? bd.RY + Math.random() * bd.RH : bd.RY - 10).setTint([0xd83a1a, 0xf06a1a, 0xffa02a, 0xb82010][p.i % 4]).setScale(1 + Math.random()).setAlpha(.9); p.vx = 20 + Math.random() * 30; p.vy = 26 + Math.random() * 30; p.spin = (Math.random() - .5) * 5; p.wob = 1.5 + Math.random() * 2; p.wa = 40; p.life = 30; });
    bd.swarm(30, 'px', 10.6, (p, first) => { p.o.setPosition(bd.RX + Math.random() * bd.RW, first ? bd.RY + Math.random() * bd.RH : bd.RY + bd.RH + 5).setTint(Math.random() < .6 ? 0xffd070 : 0xff8a3a).setScale(1 + Math.random()).setAlpha(.8); p.vx = 10 + Math.random() * 20; p.vy = -14 - Math.random() * 22; p.wob = 2; p.wa = 20; p.life = 8 + Math.random() * 6; p.fade = true; p.a0 = .85; }, { blend: ADD() });
    bd.light(bd.RX + bd.RW * .8, r.F * TILE - 60, 420, 0xffb070, .8);
  },

  // ---------------- 레쿠쟈: 하늘기둥 성층권 정상 ----------------
  //  하늘: 성층권의 짙푸른 남빛 · 빽빽한 별 · 에메랄드 오로라 커튼 / 먼 아래: 소용돌이치는 구름바다 · 번개 치는 적란운 / 가까이: 구름 둑 · 떠도는 고대 석주 조각
  //  앞: 바닥을 덮은 구름바다(디디면 떨어진다) · 스치는 바람 줄기 · 상형문자 빛 맥동
  summit(bd, r) {
    const s = bd.s, bolts = [];
    const sky = bd.layer('sky', .62, 1.6, (c, b, g) => {
      b.grad(0, 0, g.w, g.h, [[0, 0x01030c], [.35, 0x061636], [.65, 0x103e62], [.85, 0x2a7896], [1, 0x7ac0d0]]);
      b.stars(700, 0, 0, g.w, g.h * .62, 5, [0xffffff, 0xd8f0ff, 0xa8ffe0], .06);
      for (let k = 0; k < 6; k++) {
        const x0 = g.m + g.rw * (.06 + k * .17), ww = 60 + hash(k, 1, 6) * 50, yt = g.m + 6 + hash(k, 2, 6) * 30, yb = yt + 60 + hash(k, 3, 6) * 60, col = [0x4affb0, 0x2ad8a0, 0x8affd8, 0x5affc0, 0x3ac8a8, 0xa0ffe0][k];
        for (let x = 0; x < ww; x++) { const o = Math.sin((x0 + x) * .045 + k) * 9 + Math.sin((x0 + x) * .13) * 3, a = Math.sin(x / ww * Math.PI) * .5, gr = c.createLinearGradient(0, yt + o, 0, yb + o); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.8, rgba(col, a * .6)); gr.addColorStop(1, rgba(col, a)); c.fillStyle = gr; c.fillRect(x0 + x, yt + o, 1, yb - yt); }
      }
    });
    const far = bd.layer('far', .45, 1.7, (c, b, g) => {
      const cy = g.floor + 30;
      b.grad(0, cy - 70, g.w, g.h - cy + 70, [[0, 0x7ab8cc, 0], [.4, 0x9ac8d8, .7], [1, 0xd8eef4, 1]]);
      for (let arm = 0; arm < 4; arm++) for (let k = 0; k < 160; k++) { const t = k / 160, a = arm * 1.57 + t * 6.5, rad = 8 + t * g.rw * .55, x = g.cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * .16; b.ellipse(x, y, 6 + t * 16, 2 + t * 4, k % 3 ? 0xeaf6fa : 0xa8c8d8, .55 * (1 - t * .5)); }
      for (const [x, k2] of [[g.m + g.rw * .1, 1], [g.m + g.rw * .88, .8], [g.m + g.rw * .55, .6]]) {
        for (let k = 0; k < 14; k++) b.circle(x + (hash(k, 1, x | 0) - .5) * 60 * k2, cy - 20 - k * 6 * k2, (16 - k * .6) * k2, k % 2 ? 0x5a7a90 : 0x7a98aa, .9);
        b.ellipse(x, cy - 18, 46 * k2, 10 * k2, 0x2a3a4a, .8); bolts.push([x, cy - 30 * k2]);
      }
    });
    bd.layer('mid', .26, 1.8, (c, b, g) => {
      for (let k = 0; k < 18; k++) { const x = hash(k, 1, 7) * g.w, y = g.floor - 10 + hash(k, 2, 7) * 30, w = 30 + hash(k, 3, 7) * 60; b.ellipse(x, y, w, 8 + hash(k, 4, 7) * 6, 0xe8f4f8, .5); b.ellipse(x, y + 4, w * .8, 4, 0xffffff, .5); }
      for (let k = 0; k < 4; k++) {   // 떠도는 부서진 석주 조각
        const x = g.m + g.rw * (.12 + k * .26), y = g.m + g.rh * (.22 + hash(k, 5, 7) * .3), w = 10 + hash(k, 6, 7) * 8, hh = 18 + hash(k, 7, 7) * 20, a = (hash(k, 8, 7) - .5) * .8;
        c.save(); c.translate(x, y); c.rotate(a); b.F(-w / 2, -hh / 2, w, hh, 0x1a4a3e); b.F(-w / 2, -hh / 2, 2, hh, 0x3a8a6e); b.F(-w / 2 + 3, -hh / 4, 3, 3, 0x6affc8, .8); c.restore();
      }
    });
    // 오로라 일렁임 (하늘 겹 위 빛)
    for (let k = 0; k < 5; k++) { const au = bd.glow(sky, bd.RX + bd.RW * (.1 + k * .2), bd.RY + bd.RH * .2, k % 2 ? 0x4affb0 : 0x2ad8a0, 3, 4, .2); au.setOrigin(.5, 0); bd.anims.push((dt, t) => au.setScale(2.6 + Math.sin(t * .6 + k) * .9, 4).setAlpha(.12 + Math.sin(t * .9 + k * 2) * .08)); }
    // 먼 적란운 번개
    const flash = bd.glow(far, 0, 0, 0xd8f0ff, 3, 3, 0), bolt = bd.put(far, s.add.graphics().setBlendMode(ADD()));
    let nx = 2;
    bd.anims.push((dt, t) => {
      if (t > nx && bolts.length) { nx = t + 2.5 + Math.random() * 4; const q = bolts[Math.floor(Math.random() * bolts.length)], x = bd.X(q[0]), y = bd.Y(q[1]); flash.setPosition(x, y).setAlpha(.7); bolt.clear(); boltPath(bolt, x, y - 60, 100, 10, 16, 0xffffff, 2); bolt.setAlpha(1); }
      flash.setAlpha(Math.max(0, flash.alpha - dt * 2.5)); bolt.setAlpha(Math.max(0, bolt.alpha - dt * 5));
    });
    // 바닥을 덮은 구름바다 (앞 · 뒤 두 겹)
    const cloud = tex(s, 'arena:cloudbank', 128, 40, (c, b) => {
      b.grad(0, 14, 128, 26, [[0, 0xffffff, .9], [1, 0xd8eaf2, 1]]);
      for (let k = 0; k < 16; k++) { const x = (k * 37) % 128, y = 8 + (k * 11) % 10, rr = 7 + (k * 5) % 8; for (const dx of [-128, 0, 128]) b.circle(x + dx, y + rr * .5, rr, k % 3 ? 0xf4fafc : 0xd0e2ec); }
      for (let x = 0; x < 128; x += 7) b.F(x, 5 + (x % 6), 4, 1, 0xffffff, .8);
    });
    const gy = r.F * TILE;
    const back = bd.world(s.add.tileSprite(bd.RX, gy - 34, bd.RW, 40, cloud).setOrigin(0).setAlpha(.75).setTint(0xc8dcea), 9.7);
    const front = bd.world(s.add.tileSprite(bd.RX, gy - 14, bd.RW, 40, cloud).setOrigin(0).setAlpha(.95), 10.5);
    bd.world(s.add.rectangle(bd.RX, gy + 20, bd.RW, bd.RY + bd.RH - gy - 20, 0xe4f0f6).setOrigin(0), 10.5);
    bd.anims.push(dt => { back.tilePositionX -= dt * 8; front.tilePositionX += dt * 16; });
    // 바람 줄기 · 상형문자 빛
    bd.swarm(12, 'px', 9.8, (p, first) => { p.o.setPosition(first ? bd.RX + Math.random() * bd.RW : bd.RX - 10, bd.RY + 40 + Math.random() * (bd.RH - 120)).setScale(20 + Math.random() * 40, 1).setTint(0xe0fff4).setAlpha(.18 + Math.random() * .15); p.vx = 260 + Math.random() * 200; p.vy = 0; p.life = 9; }, { blend: ADD() });
    for (const [i, q] of (r.arena.glyphs || []).entries()) bd.pulse(bd.glow(null, q.x, q.y, 0x6affc8, .5, .35, .5, 10.2), .35, .3, 1.2 + (i % 5) * .3, i * 1.7);
    const al = r.arena.altar; if (al) bd.light((al[0] + al[1]) / 2 * TILE, al[2] * TILE - 30, 300, 0x6affc8, 1);
    bd.light(bd.RX + bd.RW * .2, bd.RY + bd.RH * .4, 260, 0xa8e8ff, .6); bd.light(bd.RX + bd.RW * .8, bd.RY + bd.RH * .4, 260, 0xa8e8ff, .6);
  },

  // ---------------- 디아루가 · 펄기아: 창기둥 제단 ----------------
  //  하늘: 시공의 균열로 반쪽으로 갈라진 은하수 (왼쪽 푸른 시간 · 오른쪽 보랏빛 공간 · 가운데 하얗게 타는 금) / 거대한 시간의 톱니바퀴 · 공간의 기하 문양이 맞물려 돈다
  //  가까이: 눈 덮인 천관산 봉우리 · 반쯤 무너진 신전 열주 · 내리는 눈
  spear(bd, r) {
    const s = bd.s;
    const crack = y => bd.g.cx + Math.sin(y * .05) * 10 + Math.sin(y * .17) * 5 + (hash(Math.floor(y / 6), 2, 4) - .5) * 8;
    const sky = bd.layer('sky', .62, 1.6, (c, b, g) => {
      pixels(c, 0, 0, g.w, g.h, (x, y) => {
        const L = x < crack(y), n = fbm(x / 60, y / 50, L ? 2 : 5), band = Math.exp(-(((y - g.h * .45) - (x - g.w / 2) * (L ? .25 : -.25)) ** 2) / 900);
        const base = L ? mix(0x050a26, 0x1a3a8a, y / g.h * .5 + n * .5) : mix(0x16061e, 0x6a2a6a, y / g.h * .5 + n * .5);
        return mix(base, L ? 0x8ab8ff : 0xffa0e0, band * n * .6);
      });
      b.stars(600, 0, 0, g.w, g.h, 9, [0xffffff, 0xc8dcff, 0xffd8f4], .07);
      const pts = []; for (let y = 0; y <= g.h; y += 3) pts.push([crack(y), y]);
      b.path(pts, 9, 0x6a4aff, .18); b.path(pts, 4, 0xff8ad8, .4); b.path(pts, 2, 0xe0e8ff, .85); b.path(pts, 1, 0xffffff, 1);
    });
    const gear = tex(s, 'arena:timegear', 140, 140, (c, b) => {
      const C = 70; b.glow(C, C, 70, 0x6a9aff, .22);
      for (let k = 0; k < 24; k++) { c.save(); c.translate(C, C); c.rotate(k / 24 * Math.PI * 2); b.F(-4, -66, 8, 10, 0x4a6aa8); b.F(-3, -66, 2, 10, 0x9ab8ff); c.restore(); }
      b.ring(C, C, 56, 6, 0x3a5a98); b.ring(C, C, 56, 1, 0xa8c8ff); b.ring(C, C, 40, 2, 0xe8c060, .8);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, l = k % 3 ? 40 : 46; b.line(C + Math.cos(a) * 34, C + Math.sin(a) * 34, C + Math.cos(a) * l, C + Math.sin(a) * l, k % 3 ? 1 : 2, 0xe8c060); }
      for (let k = 0; k < 6; k++) { c.save(); c.translate(C, C); c.rotate(k / 6 * Math.PI * 2); b.F(-2, -50, 4, 36, 0x2a4a88); c.restore(); }
      b.circle(C, C, 12, 0x3a5a98); b.ring(C, C, 12, 2, 0xe8c060); b.circle(C, C, 4, 0xd8e8ff);
    });
    const geom = tex(s, 'arena:spacegeom', 140, 140, (c, b) => {
      const C = 70; b.glow(C, C, 70, 0xff7ad8, .2);
      for (let n = 0; n < 4; n++) { const R = 64 - n * 14, sides = [6, 3, 6, 4][n], rot = n * .4, pts = []; for (let k = 0; k <= sides; k++) { const a = rot + k / sides * Math.PI * 2; pts.push([C + Math.cos(a) * R, C + Math.sin(a) * R]); } b.path(pts, 2, n % 2 ? 0xff9ae8 : 0xd8a0ff, .8); }
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.line(C, C, C + Math.cos(a) * 64, C + Math.sin(a) * 64, 1, 0xffd8f8, .5); b.circle(C + Math.cos(a) * 64, C + Math.sin(a) * 64, 3, 0xff8ad8); }
      b.ring(C, C, 30, 1, 0xffffff, .6); b.circle(C, C, 5, 0xffe0f8);
    });
    const L1 = bd.layer('halo', .48, 1.7, (c, b, g) => { b.glow(g.m + g.rw * .26, g.m + g.rh * .4, 90, 0x6a9aff, .18); b.glow(g.m + g.rw * .74, g.m + g.rh * .4, 90, 0xff7ad8, .18); });
    const sc = Math.max(.9, Math.min(1.6, bd.RH / 260));
    const ga = bd.put(L1, s.add.image(bd.RX + bd.RW * .26, bd.RY + bd.RH * .4, gear).setScale(sc).setAlpha(.75)), gb = bd.put(L1, s.add.image(bd.RX + bd.RW * .74, bd.RY + bd.RH * .4, geom).setScale(sc).setAlpha(.75));
    bd.anims.push(dt => { ga.rotation -= dt * .12; gb.rotation += dt * .16; });
    bd.layer('temple', .26, 1.8, (c, b, g) => {
      for (let k = 0; k < 6; k++) { const x = g.m + g.rw * (k / 5), hh = 70 + hash(k, 1, 3) * 50, w = 70 + hash(k, 2, 3) * 50; b.poly([[x - w, g.floor + 10], [x, g.floor - hh], [x + w, g.floor + 10]], 0x8a90b8, .6); b.poly([[x - w * .25, g.floor - hh * .75], [x, g.floor - hh], [x + w * .25, g.floor - hh * .75]], 0xf4f8ff, .8); }
      for (let x = g.x0 + 12, k = 0; x < g.x1 - 8; x += 26, k++) { const br = k % 3 === 1, hh = (g.floor - g.top) * (br ? .55 : .9); column(b, x, g.floor, hh, 8, 0xb8bcd8, 0xe4e8f8, 0x8a8eb0, br ? 6 : 0); b.F(x - 5, g.floor - hh - 4, 10, 2, 0xffffff); }
      for (let x = g.x0 + 4; x < g.x1; x += 52) if (hash(x | 0, 2, 7) < .7) { b.F(x, g.top + 6, 40, 5, 0xc4c8e0); b.F(x, g.top + 6, 40, 1, 0xffffff); b.F(x, g.top + 10, 40, 1, 0x8a8eb0); }
    }, { alpha: .9 });
    bd.pulse(bd.glow(sky, bd.X(bd.g.cx), bd.cy, 0xe8e0ff, .8, 6, .3), .25, .12, 1.7);
    const flake = tex(s, 'arena:flake', 3, 3, (c, b) => { b.P(1, 0, 0xffffff); b.F(0, 1, 3, 1, 0xffffff); b.P(1, 2, 0xffffff); });
    bd.swarm(34, flake, 10.6, (p, first) => { p.o.setPosition(bd.RX + Math.random() * bd.RW, first ? bd.RY + Math.random() * bd.RH : bd.RY - 6).setScale(.7 + Math.random() * .8).setAlpha(.85); p.vx = -8 + Math.random() * 16; p.vy = 18 + Math.random() * 22; p.wob = 1.2; p.wa = 14; p.life = 40; });
    bd.light(bd.RX + bd.RW * .25, bd.RY + bd.RH * .4, 300, 0x8ab8ff, .8); bd.light(bd.RX + bd.RW * .75, bd.RY + bd.RH * .4, 300, 0xff9ad8, .8);
  },

  // ---------------- 기라티나 · 다크라이: 깨어진 세계 ----------------
  //  허공: 보랏빛 · 청록 성운 · 거대한 심연의 소용돌이 성운(천천히 돈다) / 거꾸로 매달린 고대 신전 · 비틀린 계단 / 아래에서 위로 치솟는 역류 폭포
  //  앞: 심연 위 반물질 안개 · 떠오르는 보랏빛 티끌 — 다크라이 성소는 악몽의 초승달과 검푸른 안개
  distortion(bd, r) {
    const s = bd.s, dark = r.boss === 'darkrai';
    const sky = bd.layer('void', .62, 1.6, (c, b, g) => {
      pixels(c, 0, 0, g.w, g.h, (x, y) => { const n = fbm(x / 70, y / 60, 4), m2 = fbm(x / 40 + 9, y / 45, 7); let col = mix(0x04020a, dark ? 0x10102a : 0x1a0a30, y / g.h); col = mix(col, dark ? 0x2a2a5a : 0x5a1a8a, Math.max(0, n - .45) * 1.8); return mix(col, 0x1a6a7a, Math.max(0, m2 - .55) * 1.6); });
      b.stars(380, 0, 0, g.w, g.h, 13, [0xd8a0ff, 0x8affe8, 0xffffff], .08);
      if (dark) { const mx = g.m + g.rw * .7, my = g.m + g.rh * .25, R = Math.min(60, g.rh * .17); b.glow(mx, my, R * 2.4, 0xc8c0ff, .25); b.circle(mx, my, R, 0xe0dcf0); b.circle(mx + R * .38, my - R * .1, R * .92, 0x0c0c22); b.glow(mx - R * .6, my, R * .8, 0xff3a6a, .12); }
    });
    const vortex = tex(s, 'arena:vortex', 200, 200, (c, b) => {
      const C = 100; b.glow(C, C, 100, 0x6a1ac0, .35); b.glow(C, C, 50, 0xc01a4a, .3);
      for (let arm = 0; arm < 5; arm++) for (let k = 0; k < 120; k++) { const t = k / 120, a = arm * 1.256 + t * 6.2, rad = 6 + t * 92; b.ellipse(C + Math.cos(a) * rad, C + Math.sin(a) * rad, 3 + t * 6, 1.5 + t * 2, k % 4 ? 0x8a4ae8 : 0x4ae8d8, .5 * (1 - t * .6), a); }
      b.circle(C, C, 10, 0x020004, .95); b.ring(C, C, 12, 2, 0xff5a8a, .7);
    });
    const vx = bd.put(sky, s.add.image(bd.RX + bd.RW * (dark ? .3 : .5), bd.RY + bd.RH * .3, vortex).setScale(Math.min(2.4, bd.RH / 260)).setAlpha(.8));
    bd.anims.push(dt => { vx.rotation += dt * .07; });
    bd.layer('ruins', .45, 1.7, (c, b, g) => {
      const C = dark ? 0x141428 : 0x221438, RIM = dark ? 0x5a5aa8 : 0x8a5ae8;
      for (let k = 0; k < 5; k++) {   // 거꾸로 매달린 신전: 위에 주춧돌 · 아래로 늘어진 기둥 · 맨 아래 박공
        const x = g.m + g.rw * (.08 + k * .21) + (hash(k, 1, 4) - .5) * 30, w = 46 + hash(k, 2, 4) * 40, hh = 40 + hash(k, 3, 4) * 50, y0 = g.top - 8 + hash(k, 4, 4) * 10;
        b.F(x - w / 2, y0, w, 6, C, .85); b.F(x - w / 2, y0 + 5, w, 1, RIM, .7);
        for (let i = 0; i < 3; i++) { const cx = x - w / 2 + 7 + i * (w - 14) / 2, ch = hh * (i === 1 ? 1 : .55 + hash(k, i, 6) * .3); b.F(cx - 4, y0 + 6, 8, ch, C, .8); b.F(cx - 4, y0 + 6, 1, ch, RIM, .8); b.F(cx - 6, y0 + 6 + ch, 12, 3, C, .85); b.F(cx - 6, y0 + 8 + ch, 12, 1, RIM, .6); }   // 거꾸로 선 기둥 (주두가 아래)
        if (hash(k, 9, 4) < .6) { b.F(x - w / 2 - 2, y0 + 6 + hh, w + 4, 4, C, .85); b.poly([[x - w / 2 - 4, y0 + 10 + hh], [x, y0 + 26 + hh], [x + w / 2 + 4, y0 + 10 + hh]], C, .85); b.line(x - w / 2 - 4, y0 + 10 + hh, x, y0 + 26 + hh, 1, RIM); b.line(x, y0 + 26 + hh, x + w / 2 + 4, y0 + 10 + hh, 1, RIM, .6); }
      }
      for (let k = 0; k < 6; k++) { const x = hash(k, 5, 4) * g.w, y = g.m + g.rh * (.3 + hash(k, 6, 4) * .5), a = (hash(k, 7, 4) - .5) * 1.6; c.save(); c.translate(x, y); c.rotate(a); for (let i = 0; i < 5; i++) { b.F(i * 6, -i * 4, 7, 4, C); b.F(i * 6, -i * 4, 7, 1, RIM); } c.restore(); }
      for (let k = 0; k < 10; k++) { const x = hash(k, 8, 4) * g.w, y = g.m + hash(k, 9, 4) * g.rh * .8, w = 8 + hash(k, 10, 4) * 20; b.poly([[x - w, y], [x + w, y], [x + w * .5, y + w * .7], [x - w * .3, y + w]], C); b.F(x - w, y, w * 2, 1, RIM); }
    });
    const falls = bd.layer('mist', .26, 1.8, (c, b, g) => { for (let k = 0; k < 8; k++) b.glow(hash(k, 1, 2) * g.w, g.floor - hash(k, 2, 2) * 40, 40 + hash(k, 3, 2) * 40, dark ? 0x1a1a3a : 0x3a1a5a, .4); });
    const rev = tex(s, 'arena:revfall', 12, 64, (c, b) => { for (let k = 0; k < 18; k++) { const x = (k * 5) % 12, y = (k * 23) % 64; b.F(x, y, 1, 10 + (k % 4) * 4, k % 3 ? 0x6ae8ff : 0xffffff, .8); } b.F(5, 0, 2, 64, 0x3ad8e8, .35); });
    for (let k = 0; k < 3; k++) {
      const x = bd.RX + bd.RW * (.2 + k * .3) + (hash(k, r.id, 3) - .5) * 60, fall = bd.put(falls, s.add.tileSprite(x, bd.RY, 16, r.F * TILE - bd.RY, rev).setOrigin(.5, 0).setBlendMode(ADD()).setAlpha(.55));
      bd.put(falls, s.add.image(x, r.F * TILE - 6, 'glow').setBlendMode(ADD()).setTint(0x3ad8e8).setScale(1.4, .35).setAlpha(.5));
      bd.anims.push(dt => { fall.tilePositionY += dt * 80; });
    }
    // 심연 위 반물질 안개 · 떠오르는 티끌
    const gy = r.F * TILE, fog = tex(s, 'arena:abyssfog', 4, 48, (c, b) => b.grad(0, 0, 4, 48, [[0, 0x8a3ae8, 0], [.6, 0x6a1ac0, .45], [1, 0x2a0a4a, .9]]));
    bd.pulse(bd.world(s.add.image(bd.RX, gy - 40, fog).setOrigin(0).setDisplaySize(bd.RW, 56).setBlendMode(ADD()), 10.45), .7, .2, 1.3);
    bd.swarm(28, 'px', 9.8, (p, first) => { p.o.setPosition(bd.RX + Math.random() * bd.RW, first ? bd.RY + Math.random() * bd.RH : gy).setTint(Math.random() < .5 ? 0xc890ff : 0x8affe8).setScale(1 + Math.random() * 1.5).setAlpha(.8); p.vx = (Math.random() - .5) * 10; p.vy = -18 - Math.random() * 30; p.life = 12; p.wob = 1; p.wa = 10; p.fade = true; p.a0 = .8; }, { blend: ADD() });
    bd.light(bd.cx, bd.RY + bd.RH * .35, 340, dark ? 0x8a8aff : 0xb070ff, .9); bd.light(bd.RX + bd.RW * .2, gy - 60, 220, 0x4ae8d8, .6); bd.light(bd.RX + bd.RW * .8, gy - 60, 220, 0xff3a6a, .5);
  },

  // ---------------- 제크로무 · 레시라무: 용나선탑 꼭대기 ----------------
  //  하늘: 왼쪽 진실의 백열 노을 · 오른쪽 이상의 검은 뇌운 (푸른 번개) / 무너진 용나선탑 너머 다리로 이어진 거대한 N의 성
  //  가까이: 왼쪽 흰 불꽃 화로 기둥 · 오른쪽 푸른 뇌전 회로가 흐르는 흑요석 오벨리스크
  yinyang(bd, r) {
    const s = bd.s, g = bd.g;
    const sky = bd.layer('sky', .62, 1.6, (c, b, g) => {
      pixels(c, 0, 0, g.w, g.h, (x, y) => { const t = clamp((x - g.cx) / (g.rw * .3) + .5, 0, 1), n = fbm(x / 40, y / 30, 3), warm = mix(mix(0x5a2a3a, 0xd8784a, y / g.h), 0xf8c890, n * .45), cold = mix(mix(0x06081a, 0x1a2244, y / g.h), 0x2a3a6a, n * .5); return mix(warm, cold, t); });   // 왼쪽: 진실의 불꽃이 비친 황혼 (눈부시지 않게)
      for (let k = 0; k < 16; k++) { const L = k < 8, x = L ? g.m + hash(k, 1, 2) * g.rw * .45 : g.m + g.rw * (.55 + hash(k, 1, 2) * .45), y = g.m + hash(k, 2, 2) * g.rh * .55, w = 40 + hash(k, 3, 2) * 70; if (L) cloudBand(b, x - w / 2, y, w, 8, 0x6a3040, 0xf0a060, 0xfff0c8, .7); else { b.ellipse(x, y, w / 2, 9, 0x0a0c18, .85); b.ellipse(x, y + 4, w * .4, 3, 0x3a6ad8, .45); } }
      b.glow(g.m + g.rw * .2, g.floor - 20, 120, 0xfff0d0, .35);
    });
    bd.layer('castle', .45, 1.7, (c, b, g) => {
      const fl = g.floor + 8, C = 0x1a1628, WIN = 0xffd890;
      const tx = g.m + g.rw * .12;   // 무너진 용나선탑 (나선 띠를 두른 원뿔 · 부서진 꼭대기)
      b.poly([[tx - 30, fl], [tx - 18, fl - 110], [tx - 8, fl - 128], [tx + 2, fl - 118], [tx + 10, fl - 134], [tx + 18, fl - 104], [tx + 30, fl]], 0x4a3a44, .85);
      for (let y = fl - 10; y > fl - 108; y -= 12) { const w = 30 - (fl - y) * .11; b.line(tx - w, y, tx + w, y - 7, 2, 0x8a6a70, .7); b.line(tx - w, y + 1, tx + w, y - 6, 1, 0xf0b880, .4); }
      for (let k = 0; k < 4; k++) b.F(tx - 3 + k * 2, fl - 70 + k * 14, 2, 4, 0xffd890, .6);
      const cx0 = g.m + g.rw * .62, cw = g.rw * .34;   // N의 성: 성벽 · 첨탑 다섯 · 불 켜진 창
      b.F(cx0, fl - 70, cw, 70, C); for (let x = cx0; x < cx0 + cw; x += 8) b.F(x, fl - 76, 5, 6, C);
      for (const [f, hh, w] of [[.1, 120, 16], [.3, 160, 22], [.52, 200, 30], [.74, 150, 20], [.92, 110, 14]]) { const x = cx0 + cw * f; b.F(x - w / 2, fl - hh, w, hh, 0x221d34); b.poly([[x - w / 2 - 3, fl - hh], [x, fl - hh - w * 1.4], [x + w / 2 + 3, fl - hh]], 0x2a2440); for (let y = fl - hh + 12; y < fl - 20; y += 16) b.F(x - 1, y, 3, 5, WIN, .7); b.glow(x, fl - hh - w * 1.2, 8, 0x6ab0ff, .4); }
      for (let x = tx + 30; x < cx0; x += 1) { const t = (x - tx) / (cx0 - tx), y = fl - 64 - Math.sin(t * Math.PI) * 10; b.F(x, y, 1, 3, 0x2a2638, .9); b.P(x, y, 0x6a5a70, .8); if ((x - tx - 30) % 46 < 1) { const pts = []; for (let j = 0; j <= 10; j++) pts.push([x + j * 4.6, y + 3 + Math.sin(j / 10 * Math.PI) * 14]); b.path(pts, 1, 0x2a2638, .8); } }   // 탑과 성을 잇는 아치 다리
    });
    const mid = bd.layer('mid', .26, 1.8, (c, b, g) => {
      for (let k = 0; k < 3; k++) { const x = g.x0 + 20 + k * 46, hh = 60 + k * 10; b.F(x - 5, g.floor - hh, 10, hh, 0xd8d0c0); b.F(x - 5, g.floor - hh, 2, hh, 0xfff8e8); b.F(x - 9, g.floor - hh - 6, 18, 6, 0xb8a888); b.F(x - 9, g.floor - hh - 6, 18, 1, 0xf8d870); }
      for (let k = 0; k < 3; k++) { const x = g.x1 - 20 - k * 46, hh = 70 + k * 12; b.poly([[x - 6, g.floor], [x - 4, g.floor - hh], [x, g.floor - hh - 10], [x + 4, g.floor - hh], [x + 6, g.floor]], 0x14121c); for (let y = g.floor - 8; y > g.floor - hh; y -= 9) { b.F(x - 3, y, 6, 1, 0x2a6ad8); b.P(x, y, 0xa8dcff); } }
    });
    for (let k = 0; k < 3; k++) { const hh = 60 + k * 10, x = bd.X(g.x0 + 20 + k * 46), y = bd.Y(g.floor - hh - 8); const f = bd.glow(mid, x, y, 0xffd8a0, .9, 1.3, .5), f2 = bd.glow(mid, x, y + 4, 0xfff4e0, .4, .6, .7); bd.anims.push((dt, t) => { f.setScale(1 + Math.sin(t * 9 + k) * .15, 1.5 + Math.sin(t * 13 + k) * .3); f2.setAlpha(.7 + Math.random() * .3); }); bd.light(x, y + 40, 150, 0xffd8a0, .55); }
    for (let k = 0; k < 3; k++) { const hh = 70 + k * 12, x = bd.X(g.x1 - 20 - k * 46), y = bd.Y(g.floor - hh - 10); const e = bd.glow(mid, x, y, 0x6ab0ff, .8, .8, .6); bd.anims.push(dt => e.setAlpha(Math.random() < .08 ? 1 : Math.max(.3, e.alpha - dt * 2))); bd.light(x, y + 40, 160, 0x6ab0ff, .9); }
    const bolt = bd.put(sky, s.add.graphics().setBlendMode(ADD())), flash = bd.glow(sky, 0, 0, 0x8ac8ff, 4, 4, 0);
    let nx = 1.5;
    bd.anims.push((dt, t) => {
      if (t > nx) { nx = t + 1.8 + Math.random() * 3; const x = bd.RX + bd.RW * (.6 + Math.random() * .38), y = bd.RY + 20; flash.setPosition(x, y + 60).setAlpha(.6); bolt.clear(); boltPath(bolt, x, y, 170, 14, 26, 0x6ab0ff, 3); bolt.setAlpha(1); }
      flash.setAlpha(Math.max(0, flash.alpha - dt * 2)); bolt.setAlpha(Math.max(0, bolt.alpha - dt * 4));
    });
  },

  // ---------------- 아르세우스: 시초의 방 ----------------
  //  우주: 황금빛 · 라일락빛 성운 · 빽빽한 별 / 거대한 천체 시계(아스트롤라베) 세 고리가 서로 다른 빠르기로 돈다 / 18장 속성 플레이트 성좌가 둘레를 천천히 돈다 · 한가운데서 뻗는 빛살
  origin(bd, r) {
    const s = bd.s;
    bd.layer('cosmos', .62, 1.6, (c, b, g) => {
      pixels(c, 0, 0, g.w, g.h, (x, y) => { const n = fbm(x / 80, y / 70, 21), m2 = fbm(x / 50 + 4, y / 40, 23); let col = mix(0x05040c, 0x120a1e, y / g.h); col = mix(col, 0x6a4a1a, Math.max(0, n - .42) * 1.6); return mix(col, 0x5a4a9a, Math.max(0, m2 - .55) * 1.4); });
      b.stars(800, 0, 0, g.w, g.h, 17, [0xffffff, 0xffe8a8, 0xd8d0ff], .08);
      b.glow(g.cx, g.m + g.rh * .42, 160, 0xffe8b0, .18);
    });
    const ring = (key, R, draw) => tex(s, key, R * 2 + 8, R * 2 + 8, (c, b) => draw(c, b, R + 4, R));
    const outer = ring('arena:astro1', 120, (c, b, C, R) => {
      b.ring(C, C, R - 3, 5, 0xb88a30, .85); b.ring(C, C, R - 3, 1, 0xfff0c0); b.ring(C, C, R - 12, 1, 0xe8c060, .7);
      for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2, l = k % 6 ? 4 : 9; b.line(C + Math.cos(a) * (R - 8), C + Math.sin(a) * (R - 8), C + Math.cos(a) * (R - 8 - l), C + Math.sin(a) * (R - 8 - l), 1, 0xffe8a0, .9); }
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + .26, x = C + Math.cos(a) * (R - 22), y = C + Math.sin(a) * (R - 22); b.ring(x, y, 5, 1, 0xfff0c0, .9); b.circle(x, y, 1.5, 0xffe8a0); }
    });
    const middle = ring('arena:astro2', 84, (c, b, C, R) => {
      b.ring(C, C, R - 2, 2, 0xe8c060, .85); b.ring(C, C, R - 8, 1, 0xfff0c0, .6);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.line(C + Math.cos(a) * 20, C + Math.sin(a) * 20, C + Math.cos(a) * (R - 2), C + Math.sin(a) * (R - 2), 1, 0xe8c060, .5); b.circle(C + Math.cos(a) * (R - 14), C + Math.sin(a) * (R - 14), 3, 0xfff4d8); }
      c.save(); c.globalAlpha = .6; c.strokeStyle = rgba(0xffe8a0); c.beginPath(); c.ellipse(C, C, R - 6, (R - 6) * .35, .5, 0, Math.PI * 2); c.stroke(); c.restore();
    });
    const inner = ring('arena:astro3', 48, (c, b, C, R) => {
      const pts = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, rr = k % 2 ? R * .45 : R - 2; pts.push([C + Math.cos(a) * rr, C + Math.sin(a) * rr]); }
      b.poly(pts, 0xffe8a0, .35); b.path(pts, 1, 0xfff4d8, .9); b.ring(C, C, R * .3, 2, 0xe8c060); b.circle(C, C, 5, 0xffffff);
    });
    const plates = tex(s, 'arena:plates', 380, 380, (c, b) => {   // 18 속성 플레이트 성좌 (불꽃 · 물 · 전기 … 노말)
      const C = 190, R = 170, PL = [0xf08030, 0x6890f0, 0xf8d030, 0x78c850, 0x98d8d8, 0xc03028, 0xa040a0, 0xe0c068, 0xa890f0, 0xf85888, 0xa8b820, 0xb8a038, 0x705898, 0x7038f8, 0x705848, 0xb8b8d0, 0xee99ac, 0xa8a878];
      const pts = PL.map((col, k) => { const a = k / 18 * Math.PI * 2; return [C + Math.cos(a) * R, C + Math.sin(a) * R * .92, col]; });
      for (let k = 0; k < 18; k++) { const p = pts[k], q = pts[(k + 1) % 18], o = pts[(k + 7) % 18]; b.line(p[0], p[1], q[0], q[1], 1, 0xffe8b0, .35); if (k % 3 === 0) b.line(p[0], p[1], o[0], o[1], 1, 0xffe8b0, .15); }
      for (const [x, y, col] of pts) { b.glow(x, y, 12, col, .45); b.F(x - 5, y - 4, 10, 8, col); b.F(x - 5, y - 4, 10, 1, 0xffffff, .8); b.F(x - 4, y - 3, 1, 6, 0xffffff, .5); b.ring(x, y, 7, 1, 0xffe8a0, .8); }
    });
    const L1 = bd.layer('astro', .46, 1.7, (c, b, g) => { b.glow(g.cx, g.m + g.rh * .42, 120, 0xfff0c0, .15); });
    const L2 = bd.layer('plates', .3, 1.8, () => {});
    const x = bd.cx, y = bd.RY + bd.RH * .42, k = Math.min(1.7, bd.RH / 380);
    const o1 = bd.put(L1, s.add.image(x, y, outer).setScale(k * 2).setAlpha(.5)), o2 = bd.put(L1, s.add.image(x, y, middle).setScale(k * 2).setAlpha(.45)), o3 = bd.put(L1, s.add.image(x, y, inner).setScale(k * 1.6).setAlpha(.38));   // 결전 중 탄이 잘 보이게 은은하게
    const pl = bd.put(L2, s.add.image(x, y, plates).setScale(k * 1.5).setAlpha(.7));
    const rays = []; for (let i = 0; i < 10; i++) rays.push(bd.put(L1, s.add.image(x, y, 'glow').setOrigin(.5, 0).setBlendMode(ADD()).setTint(0xffe8b0).setScale(.5, 8 * k).setAlpha(.12).setRotation(i / 10 * Math.PI * 2)));
    bd.anims.push(dt => { o1.rotation += dt * .04; o2.rotation -= dt * .07; o3.rotation += dt * .12; pl.rotation += dt * .02; for (const q of rays) q.rotation += dt * .03; });
    const tw = bd.swarm(20, 'px', 9.8, (p, first) => { p.o.setPosition(bd.RX + Math.random() * bd.RW, bd.RY + Math.random() * bd.RH).setTint(Math.random() < .5 ? 0xfff0c0 : 0xffffff).setScale(1 + Math.random()).setAlpha(0); p.vx = 0; p.vy = -6; p.life = 2 + Math.random() * 3; if (first) p.t = Math.random() * p.life; }, { blend: ADD() });
    bd.anims.push(() => { for (const p of tw) p.o.setAlpha(Math.max(0, Math.sin(p.t / p.life * Math.PI)) * .9); });
    bd.light(x, y, 420, 0xfff0c0, .9); bd.light(bd.cx, r.F * TILE - 40, 360, 0xffe8b0, .7);
  },

  // ---------------- 무한다이노 · 아비스 네크로즈마: 블랙나이트의 심장 ----------------
  //  하늘: 검붉은 블랙나이트 폭풍 소용돌이 · 번개 · 뜯겨 나간 플랜트 천장 철골 / 한가운데 거대한 붉은 다이맥스 결정 기둥 + 기둥으로 이어진 에너지 공급 튜브 수십 가닥
  //  가까이: 양옆 고압 방전 코일 기둥 (스파크) — 아비스 네크로즈마전: 천장이 완전히 뜯겨 나가며 황금빛 · 보랏빛 울트라홀 우주로 바뀐다 (phase2)
  //  (결정 속 사슬에 묶인 레드는 Props.buildRedCore 가 돔 꼭대기에 세운다 — 유대의 불꽃 시네마틱이 깬다)
  reactor(bd, r) {
    const s = bd.s, tubes = [], coils = [];
    const storm = bd.layer('storm', .62, 1.6, (c, b, g) => {
      b.grad(0, 0, g.w, g.h, [[0, 0x08030a], [.4, 0x1a0810], [1, 0x240a14]]);
      const vx = g.cx, vy = g.m + g.rh * .12;
      for (let arm = 0; arm < 5; arm++) for (let k = 0; k < 300; k++) { const t = k / 300, a = arm * 1.26 + t * 7.2, rad = 6 + t * g.rw * .6, x = vx + Math.cos(a) * rad * 1.4, y = vy + Math.sin(a) * rad * .42; b.F(x, y, 3 + hash(k, arm, 1) * 7, 2, hash(k, arm, 2) < .5 ? 0x3a0e1c : 0x220812, .55 * (1 - t * .6)); if (hash(k, arm, 3) < .05) b.F(x, y, 2, 1, 0xc02a4a, .6 * (1 - t)); }
      b.glow(vx, vy, 100, 0xd01a3a, .4);
      for (let x = 0; x < g.w; x += 24) { const hh = 10 + hash(x, 1, 5) * 18; b.F(x, 0, 4, g.top + hh, 0x0a0608); b.line(x + 2, g.top + hh, x + 14, g.top + hh * .3, 2, 0x140a0e); }
      b.F(0, 0, g.w, g.top - 6, 0x080406); for (let x = 0; x < g.w; x += 6) if (hash(x, 2, 5) < .55) b.F(x, g.top - 8, 6, 2 + hash(x, 3, 5) * 6, 0x080406);
    });
    const core = bd.layer('crystal', .44, 1.7, (c, b, g) => {
      const cx = g.cx, w = Math.min(40, g.rw * .08), y0 = g.top + 4, y1 = g.floor;
      b.glow(cx, (y0 + y1) / 2, w * 4, 0xff1a3a, .3);
      for (let k = 0; k < 18; k++) {   // 결정 기둥으로 이어진 에너지 공급 튜브
        const side = k % 2 ? 1 : -1, y = y0 + 20 + hash(k, 1, 3) * (y1 - y0 - 50), x1 = side < 0 ? hash(k, 2, 3) * g.x0 * .9 : g.w - hash(k, 2, 3) * (g.w - g.x1) * .9, pts = [];
        for (let j = 0; j <= 16; j++) { const t = j / 16, xx = cx + side * w * .8 + (x1 - cx - side * w * .8) * t, yy = y + Math.sin(t * Math.PI) * (20 + hash(k, 3, 3) * 30) * (k % 4 < 2 ? 1 : -1); pts.push([xx, yy]); }
        b.path(pts, 4, 0x1e1014, .9); b.path(pts, 2, 0x4a1a22, .9); for (let j = 3; j < 16; j += 4) b.F(pts[j][0] - 1, pts[j][1] - 1, 3, 3, 0xff3a5a, .7); tubes.push(pts[8]);
      }
      for (const [dx, col] of [[-w, 0x5a0a1a], [-w * .5, 0xc01a3a], [0, 0xff4a6a], [w * .5, 0xa01430]]) b.poly([[cx + dx, y1], [cx + dx + w * .5, y1], [cx + dx * .3 + w * .25, y0]], col, .82);
      b.poly([[cx - w, y1], [cx, y0 - 20], [cx + w, y1]], 0xff6a8a, .18);
      for (let y = y0 + 10; y < y1; y += 9) b.F(cx - w * .7 + Math.sin(y) * 4, y, w * 1.4, 1, 0xffb0c0, .25);
      b.glow(cx, (y0 + y1) * .55, w * 1.8, 0xffd0d8, .35);
    });
    const coilL = bd.layer('coils', .24, 1.8, (c, b, g) => {
      for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
        const x = side < 0 ? g.x0 + 10 + k * 34 : g.x1 - 10 - k * 34, hh = 90 + k * 20, top = g.floor - hh;
        b.F(x - 4, top, 8, hh, 0x2a2228); b.F(x - 4, top, 1, hh, 0x5a4a52);
        for (let y = top + 6; y < g.floor - 6; y += 4) { b.F(x - 7, y, 14, 2, 0xb8682a); b.F(x - 7, y, 14, 1, 0xf0a050); }
        b.ellipse(x, top - 4, 12, 5, 0x5a5460); b.ellipse(x, top - 5, 10, 3, 0x8a8494); coils.push([x, top - 6]);
      }
    });
    // 튜브 맥동 · 결정 숨결
    for (const [i, q] of tubes.entries()) if (i % 2 === 0) bd.pulse(bd.glow(core, bd.X(q[0]), bd.Y(q[1]), 0xff2a4a, .4, .4, .5), .4, .35, 2.4 + (i % 5) * .4, i);
    bd.pulse(bd.glow(core, bd.cx, bd.Y((bd.g.top + bd.g.floor) * .55), 0xff3a5a, 2.6, 5, .35), .32, .14, 1.2);
    // 방전 코일 스파크 (짧게 지지직)
    const arcs = bd.put(coilL, s.add.graphics().setBlendMode(ADD()));
    bd.anims.push(dt => {
      if (Math.random() < .18) {
        arcs.clear();
        for (const [x0, y0] of coils) { if (Math.random() < .5) continue; const x = bd.X(x0), y = bd.Y(y0); arcs.lineStyle(1, Math.random() < .5 ? 0xffffff : 0xff6a8a, 1).beginPath().moveTo(x, y); let px = x, py = y; for (let k = 0; k < 5; k++) { px += (Math.random() - .5) * 24; py -= 6 + Math.random() * 8; arcs.lineTo(px, py); } arcs.strokePath(); }
        arcs.setAlpha(1);
      } else arcs.setAlpha(Math.max(0, arcs.alpha - dt * 6));
    });
    // 폭풍 번개
    const bolt = bd.put(storm, s.add.graphics().setBlendMode(ADD())), flash = bd.glow(storm, 0, 0, 0xff8aa0, 4, 3, 0);
    let nx = 1;
    bd.anims.push((dt, t) => {
      if (t > nx) { nx = t + 1.5 + Math.random() * 3; const x = bd.RX + bd.RW * (.1 + Math.random() * .8), y = bd.RY + 20; flash.setPosition(x, y + 40).setAlpha(.55); bolt.clear(); boltPath(bolt, x, y, 120, 12, 24, 0xff5a7a, 2); bolt.setAlpha(1); }
      flash.setAlpha(Math.max(0, flash.alpha - dt * 2.2)); bolt.setAlpha(Math.max(0, bolt.alpha - dt * 4));
    });
    // 아비스 네크로즈마전: 울트라홀 우주 (처음엔 숨겨 둔다)
    const ultra = bd.layer('ultra', .62, 1.61, (c, b, g) => {
      pixels(c, 0, 0, g.w, g.h, (x, y) => { const dx = x - g.cx, dy = y - g.m - g.rh * .32, d = Math.hypot(dx, dy * 1.3), a = Math.atan2(dy, dx), sw = (Math.sin(a * 3 + d * .045) + 1) / 2; let col = mix(0xfff0c0, 0xd8a040, Math.min(1, d / 60)); col = mix(col, 0x7a2ab0, Math.min(1, Math.max(0, (d - 50) / 140))); col = mix(col, 0x12061e, Math.min(1, Math.max(0, (d - 170) / 160))); return mix(col, 0xffe0a0, sw * Math.max(0, 1 - d / 260) * .35); });
      b.stars(300, 0, 0, g.w, g.h, 31, [0xffffff, 0xffe8a8, 0xd8b0ff]);
      for (let k = 0; k < 16; k++) { const x = hash(k, 1, 8) * g.w, y = g.m + hash(k, 2, 8) * g.rh * .8, w = 6 + hash(k, 3, 8) * 12; b.poly([[x, y - w], [x + w * .6, y + w * .4], [x - w * .6, y + w * .4]], k % 2 ? 0xfff4d8 : 0xe8c8ff, .7); b.poly([[x, y - w], [x + w * .6, y + w * .4], [x, y]], 0xffffff, .4); }
    });
    ultra.box.setAlpha(0);
    const swirl = bd.glow(ultra, bd.cx, bd.Y(bd.g.m + bd.g.rh * .32), 0xffe0a0, 4, 4, .5); bd.anims.push(dt => { swirl.rotation += dt * .3; });
    bd.phase2 = () => {
      if (bd.inUltra) return;
      bd.inUltra = true;
      s.tweens.add({ targets: ultra.box, alpha: 1, duration: 1800, ease: 'Sine.easeInOut' });
      s.tweens.add({ targets: [storm.box, core.box], alpha: 0, duration: 2200, ease: 'Sine.easeIn' });
      for (let k = 0; k < 18; k++) {   // 뜯겨 나가는 천장 철골 조각
        const piece = s.add.rectangle(bd.RX + Math.random() * bd.RW, r.ty0 * TILE + Math.random() * 40, 10 + Math.random() * 30, 4 + Math.random() * 6, Math.random() < .5 ? 0x1a1014 : 0x3a2228).setDepth(1.85);
        s.tweens.add({ targets: piece, y: piece.y - 260 - Math.random() * 200, x: piece.x + (Math.random() - .5) * 200, angle: (Math.random() - .5) * 720, alpha: 0, duration: 1600 + Math.random() * 1200, ease: 'Cubic.easeIn', delay: Math.random() * 500, onComplete: () => piece.destroy() });
      }
    };
    bd.light(bd.cx, r.F * TILE - 120, 360, 0xff2a4a, 1.1);
  }
};

export function buildArenaBackdrop(scene, r) {
  const bd = new Backdrop(scene, r);
  const f = DROPS[r.arenaStyle];
  if (f) f(bd, r);
  bd.update(0);
  return bd;
}

// 하늘기둥 정상 초록 상승 기류 기둥 (Props 의 붉은 열기 상승 기류 그림 대신 — 위로 흐르는 바람 줄무늬)
export function windLiftArt(scene) {
  return tex(scene, 'arena:windlift', 16, 64, (c, b) => {
    b.grad(0, 0, 16, 64, [[0, 0x4affb0, .1], [1, 0x4affb0, .18]]);
    for (let k = 0; k < 14; k++) { const x = 2 + (k * 5) % 12, y = (k * 19) % 64; b.F(x, y, 1, 8 + (k % 3) * 5, k % 3 ? 0x8affc8 : 0xffffff, .55); }
  });
}

// 뮤츠 결전장 크레인 발판 (w 칸): 경고선을 칠한 철판 · 리벳 · 양 끝 사슬 고리
export function craneArt(scene, w) {
  const W = w * TILE;
  return tex(scene, `arena:crane:${w}`, W, 14, (c, b) => {
    b.F(0, 0, W, 2, 0xd0dae4); b.F(0, 2, W, 6, 0x4a5664);
    for (let x = 0; x < W; x += 1) if (((x >> 2) & 1) === 0) b.F(x, 3, 1, 4, 0xf0c020);
    b.F(0, 8, W, 2, 0x1a2028); b.F(2, 10, W - 4, 3, 0x2e3640);
    for (let x = 6; x < W - 4; x += 12) b.F(x, 5, 2, 2, 0xa0acb8);
    for (const x of [4, W - 8]) { b.F(x, 0, 4, 2, 0x8a96a4); b.ring(x + 2, 1, 2, 1, 0x8a96a4); }
  });
}
export function chainArt(scene) {
  return tex(scene, 'arena:chain', 4, 8, (c, b) => { b.F(1, 0, 2, 4, 0x8a96a4); b.F(1, 1, 2, 2, 0x2a323a); b.F(0, 4, 4, 4, 0x6a7684); b.F(1, 5, 2, 2, 0x1a2028); });
}
