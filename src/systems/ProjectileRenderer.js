// 기술 투사체 그리기 — 단색 동그라미 대신 속성마다 고유한 도트 실루엣 + 3~4단 명암 + 비행 꼬리 + 발사 섬광 + 적중 폭발
//  ① 텍스처: 오프스크린 캔버스에 1px 단위로 찍는다 (월드 도트와 같은 크기). 오른쪽을 향하게 그리고 날아가는 방향으로 돌린다
//     불꽃: 앞은 둥글고 뒤는 두 갈래로 갈라져 일렁이는 눈물방울 3프레임 (흰 코어 → 노랑 → 주황 → 진홍, ADD 로 스스로 빛남)
//     잎날: 양끝이 뾰족하게 휜 초승달 칼날 (연두 잎맥 + 흰 칼날 하이라이트), 날면서 초고속 회전 + 잔상
//     물: 앞이 둥글게 뭉치고 뒤로 물보라가 흩어지는 유선형 탄환 (흰 반사광) · 거품: 투명한 막 + 반사광
//     전기: 지그재그로 꺾이는 스파크 3프레임 · 고스트: 보라 코어에 검은 아지랑이가 감긴 영혼 구체 · 격투: 초승달 충격파
//  ② 꼬리: 불티·연기 / 베기 잔상 리본·잎 조각 / 떨어져 튀는 물방울 / 튀는 스파크 / 피어오르는 아지랑이
//  ③ 발사 섬광(0.1초)과 적중 연출(불꽃 폭발·X자 베기·물보라 링·감전·영혼 흩어짐) — 맞으면 그냥 사라지지 않는다
import Phaser from 'phaser';
import { Sfx } from './Audio.js';

const ADD = Phaser.BlendModes.ADD;
const DEG = Math.PI / 180;

// ---------------- 텍스처 ----------------
// fn(x, y) → 색(0xRRGGBB) 또는 [색, 알파] 또는 null(투명). 픽셀 중심 좌표로 부른다.
function pixTex(scene, key, w, h, fn) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h), c = t.getContext(), img = c.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x + .5, y + .5);
    if (v == null) continue;
    const [col, a] = Array.isArray(v) ? v : [v, 1], i = (y * w + x) * 4;
    img.data[i] = (col >> 16) & 255; img.data[i + 1] = (col >> 8) & 255; img.data[i + 2] = col & 255; img.data[i + 3] = Math.round(a * 255);
  }
  c.putImageData(img, 0, 0);
  t.refresh();
  return key;
}

// 불꽃 눈물방울: 머리(앞, 오른쪽)는 둥글고 꼬리는 가늘어지며 일렁이다가 끝에서 두 갈래로 갈라진다
const FIRE_PAL = { orange: [0xffffff, 0xffee55, 0xff6600, 0xcc1100], blue: [0xffffff, 0xbfe6ff, 0x5ab0ff, 0x1a3aa8] };
function flame(f, P) {
  const cy = 7, hx = 15, R = 5;
  return (x, y) => {
    const dy = y - cy, dHead = 1 - Math.hypot(x - hx, dy) / R;
    let dTail = -1;
    if (x < hx && x > 1) {
      const u = (x - 1) / (hx - 1), wob = Math.sin(x * .8 + f * 2.1) * 1.4 * (1 - u);
      const lick = 1 + Math.sin(x * 1.7 + f * 2.6 + (dy < 0 ? 0 : 1.9)) * .22 * (1 - u);   // 위아래 가장자리가 혀처럼 날름거린다
      const hw = R * Math.pow(u, .7) * lick, ady = Math.abs(dy - wob);
      const fork = u < .5 && ady < (.5 - u) * 3.6;
      if (ady < hw && !fork) dTail = 1 - ady / hw;
    }
    const d = Math.max(dHead, dTail);
    if (d <= 0) return null;
    const heat = d * (.5 + .5 * Math.min(1, x / hx));
    return heat > .62 ? P[0] : heat > .42 ? P[1] : heat > .2 ? P[2] : P[3];
  };
}

// 초승달 잎 칼날: 휘어진 중심선 + 양끝이 뾰족한 두께, 바깥(위) 날에 흰 하이라이트, 가운데 연두 잎맥
function razorLeaf(x, y) {
  const u = x / 18;
  if (u <= 0 || u >= 1) return null;
  const s = Math.sin(Math.PI * u), yc = 7.4 - 1.3 * s + (u - .5) * 1.6, th = 3.7 * Math.pow(s, .8), dy = y - yc, a = Math.abs(dy);
  if (a > th) return null;
  if (a > th - 1) return dy < 0 && u > .14 && u < .86 ? 0xffffff : 0x1b551d;
  if (a < .55) return 0xc8ff9a;
  if (dy > 0 && Math.round(x) % 4 === 1 && a < 1.6) return 0x8ae05a;   // 옆 잎맥
  return dy < 0 ? 0x62d44a : 0x2e963a;
}

// 물 탄환: 앞이 둥글게 뭉치고 뒤로 가늘어지며, 꼬리 뒤에 물보라 점이 흩어진다
const SPRAY = [[[1, 4], [2, 8], [4, 2], [0, 6], [3, 10]], [[0, 3], [2, 6], [3, 9], [1, 10], [4, 1]]];
function waterShot(f) {
  const cy = 6, hx = 14, R = 4.6;
  return (x, y) => {
    const dHead = 1 - Math.hypot(x - hx, y - cy) / R;
    let dTail = -1;
    if (x < hx && x > 3) {
      const u = (x - 3) / (hx - 3), hw = R * Math.pow(u, 1.2), ady = Math.abs(y - cy - Math.sin(x * .9 + f * 2) * .6 * (1 - u));
      if (ady < hw) dTail = 1 - ady / hw;
    }
    const d = Math.max(dHead, dTail);
    if (d <= 0) return SPRAY[f].some(([sx, sy]) => Math.floor(x) === sx && Math.floor(y) === sy) ? [0x8ad8ff, .85] : null;
    if (y < cy - 1.4 && x > hx - 2.2 && x < hx + 2 && d > .3) return 0xffffff;   // 반사광
    if (Math.floor(x) === hx - 4 && Math.floor(y) === cy - 2) return 0xffffff;
    return d < .25 ? 0x1a6ac8 : d < .55 ? 0x3ab0ff : 0x9ae0ff;
  };
}

// 거품: 얇은 막 + 투명한 속 + 왼쪽 위 반사광
function bubble(x, y) {
  const d = Math.hypot(x - 6, y - 6);
  if (d > 5.3) return null;
  if (d > 4.3) return [0xbfe8ff, .95];
  if ((x - 4.2) ** 2 + (y - 4.2) ** 2 < 1.7) return [0xffffff, 1];
  if ((x - 8.2) ** 2 + (y - 8.4) ** 2 < .6) return [0xffffff, .8];
  return [0x5ab8ff, .28];
}

// 전기 스파크: 지그재그 꺾은선에서의 거리로 흰 코어 → 노랑 → 하늘색 번짐, 프레임마다 꺾임이 바뀐다
function spark(f) {
  const ys = [[6, 2, 10, 2.5, 6], [6, 10, 2, 9.5, 6], [6.5, 2.5, 9.5, 1.5, 6]][f];
  const pts = ys.map((y, i) => [i * 5 - .3, y]);
  const branch = [[pts[2][0], ys[2]], [pts[2][0] + 3.5, ys[2] < 6 ? .5 : 11.5]];
  const segD = (x, y, [ax, ay], [bx, by]) => { const vx = bx - ax, vy = by - ay, t = Phaser.Math.Clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1); return Math.hypot(x - ax - vx * t, y - ay - vy * t); };
  return (x, y) => {
    let d = segD(x, y, branch[0], branch[1]) + .5;
    for (let i = 1; i < pts.length; i++) d = Math.min(d, segD(x, y, pts[i - 1], pts[i]));
    return d < .6 ? 0xffffff : d < 1.2 ? 0xffee66 : d < 1.9 ? [0x6ad8ff, .7] : null;
  };
}

// 영혼 구체: 보라 코어 + 일렁이는 검은 아지랑이
function soul(f) {
  return (x, y) => {
    const dx = x - 8, dy = y - 8, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (d < 2.4) return 0xe8c8ff;
    if (d < 3.6) return 0xa060ff;
    if (d < 4.5) return 0x5a2a9a;
    const rr = 5.4 + 1.8 * Math.sin(3 * a + f * 2.2) + 1 * Math.sin(5 * a - f * 1.3);
    if (d < rr) return [0x2c0c44, .95];
    if (d < rr + 1.1) return [0x7a3ad0, .55];
    return null;
  };
}

// 격투 충격파: 오른쪽으로 볼록한 초승달
function shockWave(x, y) {
  const d = Math.hypot(x - 1, y - 10), a = Math.atan2(y - 10, x - 1);
  if (Math.abs(a) > 1.2) return null;
  const k = 1 - Math.abs(a) / 1.2, inner = 9.6 - k * 1.6, outer = 10.4 + k * 1.4;
  if (d < inner || d > outer) return null;
  return d < inner + .9 ? 0xffffff : d < outer - .8 ? 0xffd0a0 : 0xff8a3a;
}

// 기타 속성: 빛나는 마름모 파편 (색은 틴트)
function shard(x, y) {
  const dx = Math.abs(x - 6), dy = Math.abs(y - 6);
  if (dx + dy < 2.2) return 0xffffff;
  if (dx + dy < 4) return [0xffffff, .75];
  if ((dx < .7 && dy < 6) || (dy < .7 && dx < 6)) return [0xffffff, .55 * (1 - Math.max(dx, dy) / 6)];
  return null;
}

// 바위 덩이: 울퉁불퉁한 외곽 + 왼쪽 위 밝은 면 · 아래 그늘 · 금 한 줄. pal: [그늘·외곽, 바탕, 밝은 면, 하이라이트]
const ROCK_PAL = { rock: [0x3a2e24, 0x7a6448, 0xa88c66, 0xd8c8a8], steel: [0x2a2e3a, 0x6a7088, 0xa0a8c0, 0xeef2ff] };
function rock(pal) {
  return (x, y) => {
    const dx = x - 6, dy = y - 6.3, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
    const rr = 5 + .8 * Math.sin(3 * a + 1) + .5 * Math.sin(5 * a);
    if (d > rr) return null;
    if (d > rr - 1) return pal[0];
    if (Math.abs(dx - dy * .6 - .5) < .5 && d < rr - 1.5 && dy > -1) return pal[0];   // 금
    const light = -dx * .5 - dy;
    if (light > 3.2) return pal[3];
    if (light > 1) return pal[2];
    if (light < -2.5) return pal[0];
    return pal[1];
  };
}
// 후딘 숟가락: 은빛 자루 + 오른쪽 둥근 머리
function spoon(x, y) {
  const bx = x - 12, by = y - 4, bd = Math.hypot(bx / 1.2, by);
  if (bd < 2.6) return bd < 1.2 ? 0xffffff : 0xd8dce8;
  if (bd < 3.4) return 0x6a6e80;
  if (x >= 1 && x < 10 && Math.abs(y - 4) < 1) return x < 3 ? 0x6a6e80 : 0xc8ccd8;
  if (x >= 1 && x < 10 && Math.abs(y - 4) < 1.6) return 0x4a4e60;
  return null;
}

// 발사 섬광: 가로·세로 긴 빛살 + 짧은 대각선 + 밝은 중심
function flash(x, y) {
  const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5), m = Math.max(dx, dy);
  if (m < 1.6) return 0xffffff;
  if ((dx < .7 || dy < .7) && m < 7.5) return [0xffffff, 1 - m / 7.5];
  if (Math.abs(dx - dy) < .7 && m < 4) return [0xffffff, .7 * (1 - m / 4)];
  return null;
}

// 베기 선: 가운데가 두껍고 양끝이 뾰족한 렌즈 (흰색, 틴트로 색을 입힌다)
function slashLine(x, y) {
  const u = x / 28, s = Math.sin(Math.PI * u), th = 3 * Math.pow(Math.max(0, s), .7), a = Math.abs(y - 4);
  if (u <= 0 || u >= 1 || a > th) return null;
  return a < th * .4 ? 0xffffff : [0xffffff, .55];
}

export function makeProjectileTextures(scene) {
  for (const [name, pal] of Object.entries(FIRE_PAL)) for (let f = 0; f < 3; f++) pixTex(scene, `pj-fire-${name}${f}`, 22, 14, flame(f, pal));
  pixTex(scene, 'pj-leaf', 18, 13, razorLeaf);
  for (let f = 0; f < 2; f++) pixTex(scene, `pj-water${f}`, 20, 12, waterShot(f));
  pixTex(scene, 'pj-bubble', 12, 12, bubble);
  for (let f = 0; f < 3; f++) pixTex(scene, `pj-bolt${f}`, 20, 12, spark(f));
  for (let f = 0; f < 2; f++) pixTex(scene, `pj-soul${f}`, 16, 16, soul(f));
  pixTex(scene, 'pj-wave', 13, 20, shockWave);
  pixTex(scene, 'pj-shard', 12, 12, shard);
  pixTex(scene, 'pj-rock', 12, 12, rock(ROCK_PAL.rock));
  pixTex(scene, 'pj-steel', 12, 12, rock(ROCK_PAL.steel));
  pixTex(scene, 'pj-spoon', 16, 8, spoon);
  pixTex(scene, 'pj-flash', 15, 15, flash);
  pixTex(scene, 'pj-slash', 28, 8, slashLine);
}

// ---------------- 종류별 설정 ----------------
//  frames: 텍스처 · fps: 프레임 속도 · blend · orient: 날아가는 방향으로 돌림 · spin: 초당 회전(도)
//  glow: 뒤의 은은한 빛 세기 · tint: q.color 로 물들임 · col: 꼬리·섬광 색
const KINDS = {
  fire: { frames: ['pj-fire-orange0', 'pj-fire-orange1', 'pj-fire-orange2'], fps: 16, blend: ADD, orient: true, glow: .28, scale: .95, col: [0xff6600, 0xffee55] },
  leaf: { frames: ['pj-leaf'], spin: 1500, glow: .12, scale: .95, col: [0x62d44a, 0xc8ff9a] },
  water: { frames: ['pj-water0', 'pj-water1'], fps: 10, orient: true, glow: .22, scale: .9, col: [0x3ab0ff, 0xbfe8ff] },
  bubble: { frames: ['pj-bubble'], wobble: true, glow: .18, scale: 1, tint: true, col: [0x8ad8ff, 0xffffff] },
  bolt: { frames: ['pj-bolt0', 'pj-bolt1', 'pj-bolt2'], fps: 22, blend: ADD, orient: true, glow: .3, scale: .9, col: [0xffee66, 0x6ad8ff] },
  shadow: { frames: ['pj-soul0', 'pj-soul1'], fps: 7, glow: .5, scale: 1, col: [0x9a5aff, 0x12061c] },
  wave: { frames: ['pj-wave'], blend: ADD, orient: true, glow: .35, scale: 1, col: [0xffd0a0, 0xffffff] },
  other: { frames: ['pj-shard'], blend: ADD, spin: 400, glow: .45, scale: 1, tint: true, col: [0xffffff, 0xffffff] },
  rock: { frames: ['pj-rock'], spin: 260, glow: .06, scale: 1, col: [0x8a7a62, 0xd8c8a8] },            // 롱스톤 낙석·바위 던지기
  steel: { frames: ['pj-steel'], spin: 360, glow: .2, scale: 1, col: [0xa8b0c8, 0xffffff] },           // 강철톤 쇠 파편
  debris: { frames: ['pj-rock'], spin: 120, glow: .4, scale: 1, col: [0xc070ff, 0xffd8ff] },           // 뮤츠가 염동력으로 띄운 지형 파편 (보랏빛 기운)
  spoon: { frames: ['pj-spoon'], spin: 1100, glow: .25, scale: 1, col: [0xffd8f0, 0xffffff] }          // 후딘 숟가락 부메랑
};
const isBlue = c => c != null && (c & 255) > ((c >> 16) & 255) + 40;

export class ProjectileRenderer {
  constructor(scene) {
    this.s = scene;
    makeProjectileTextures(scene);
    this.ribbons = scene.add.graphics().setDepth(29).setBlendMode(ADD);   // 잎날 베기 잔상 리본
  }
  get fx() { return this.s.fx; }
  get pool() { return this.s.fx.pool; }   // 투사체 그림·섬광·불꽃 덩어리 등은 Fx 의 오브젝트 풀을 함께 쓴다

  cfg(q) {
    if (q.kind === 'bolt' && q.type !== 'electric') return Object.assign({}, KINDS.bolt, { tint: true });   // 바람 칼날 등은 같은 모양에 색만
    if (q.kind === 'wave' && q.type !== 'fighting') return Object.assign({}, KINDS.wave, { tint: true });   // 레트라 앞니 충격파 등
    return KINDS[q.kind] || KINDS.other;
  }

  // 투사체 그림 붙이기
  attach(q) {
    const s = this.s, c = this.cfg(q);
    q.cfg = c;
    q.frames = q.kind === 'fire' && isBlue(q.color) ? ['pj-fire-blue0', 'pj-fire-blue1', 'pj-fire-blue2'] : c.frames;
    q.tier = q.tier || 0; q.pow = q.pow || 1;   // 진화 단계(0~3)·크기 배율 — 적 투사체는 0·1
    q.glow = this.pool.get(q.x, q.y, 'glow').setBlendMode(ADD).setTint(q.kind === 'shadow' ? 0x9a5aff : q.color).setAlpha(c.glow + q.tier * .06).setDepth(29);
    // 2단부터: 같은 모양의 큰 기운이 투사체를 감싼다 (단계가 오를수록 진하게)
    if (q.tier >= 1) q.aura = this.pool.get(q.x, q.y, q.frames[0]).setDepth(30).setBlendMode(ADD).setTintFill(c.tint && q.color != null ? q.color : c.col[0]);
    q.spr = this.pool.get(q.x, q.y, q.frames[0]).setDepth(31);
    if (c.blend) q.spr.setBlendMode(c.blend);
    if (c.tint && q.color != null) q.spr.setTint(q.color);
    q.spin = (Math.random() < .5 ? -1 : 1) * (c.spin || 0);
    q.trail = [];
    q.emitT = 0; q.ghostT = 0;
    this.place(q, 0);
  }

  // 반사 등으로 주인·색이 바뀌었을 때
  restyle(q) { this.detach(q); this.attach(q); }

  detach(q) {
    this.pool.release(q.spr); this.pool.release(q.glow); this.pool.release(q.aura);   // 투사체 그림은 풀로 돌려놓는다 (systems/Pool.js)
    q.spr = q.glow = q.aura = null;
  }

  place(q, dt) {
    const c = q.cfg, sc = Phaser.Math.Clamp(q.r / 4, .6, 4.4) * c.scale;
    const fi = q.frames.length > 1 ? Math.floor(q.t * (c.fps || 10) + (q.seed || 0)) % q.frames.length : 0;
    q.spr.setTexture(q.frames[fi]).setPosition(Math.round(q.x), Math.round(q.y));
    if (c.orient) q.spr.setRotation(Math.atan2(q.vy, q.vx));
    else if (q.spin) q.spr.angle += q.spin * dt;
    if (c.wobble) q.spr.setScale(sc * (1 + Math.sin(q.t * 18) * .08), sc * (1 - Math.sin(q.t * 18) * .08));
    else q.spr.setScale(sc);
    if (q.aura) q.aura.setTexture(q.spr.texture.key).setPosition(q.spr.x, q.spr.y).setRotation(q.spr.rotation)
      .setScale(q.spr.scaleX * 1.3, q.spr.scaleY * 1.3).setAlpha((.14 + q.tier * .07) * (.8 + .2 * Math.sin(q.t * 24 + q.seed)));
    q.glow.setPosition(q.x, q.y).setScale(Math.max(.3, q.r / 8) * (1 + q.tier * .15));
  }

  // 매 프레임: 위치·회전·애니메이션 + 꼬리 파티클 (진화할수록 더 많이·굵게: 1단 ×1 · 2·3단 ×2 · 메가 ×3)
  update(q, dt) {
    if (!q.spr) return;
    this.place(q, dt);
    q.emitT -= dt;
    if (q.emitT > 0) return;
    q.emitT = .016;
    if (q.kind === 'leaf') {   // 베기 리본(아래 tick 에서) + 회전 잔상
      q.trail.push({ x: q.x, y: q.y }); if (q.trail.length > 8 + q.tier * 2) q.trail.shift();
      q.ghostT -= .016;
      if (q.ghostT <= 0) { q.ghostT = .035; this.afterimage(q, 0x9aff7a); }
    }
    for (let i = q.tier >= 3 ? 3 : q.tier >= 1 ? 2 : 1; i > 0; i--) this.emit(q);
  }

  // 꼬리 파티클 한 번 (큰 투사체는 몸통 전체에서 흩뿌린다)
  emit(q) {
    const fx = this.fx, P = q.pow, sz = q.tier >= 2 ? 2 : 1, sp = Math.hypot(q.vx, q.vy) || 1, bx = -q.vx / sp * P, by = -q.vy / sp * P;
    const x = q.x + (Math.random() - .5) * (P - 1) * 6, y = q.y + (Math.random() - .5) * (P - 1) * 6;
    const blue = q.frames[0].includes('blue');
    switch (q.kind) {
      case 'fire':   // 불티 + 짙은 연기가 뒤로 흩날리며 피어오른다
        if (Math.random() < .75) fx.burst(x + bx * 4, y + by * 4, blue ? [0x5ab0ff, 0xbfe6ff, 0xffffff] : [0xff6600, 0xffee55, 0xffaa22], 1, 40, { angle: Math.atan2(by, bx), spread: 1, up: 22, grav: -40, bounce: false, glow: true, life: .35, size: sz });
        if (Math.random() < .3) fx.burst(x + bx * 6, y + by * 6, [0x3a3438, 0x2a2428, 0x4a4248], 1, 14, { angle: -Math.PI / 2, spread: 1.2, up: 10, grav: -30, bounce: false, life: .6, size: sz + 1, drag: .95 });
        break;
      case 'leaf':   // 잎 부스러기
        if (Math.random() < .3) fx.burst(x, y, [0x62d44a, 0xc8ff9a, 0x2e963a], 1, 30, { up: 6, grav: 40, bounce: false, life: .5, size: sz, drag: .94 });
        break;
      case 'water':   // 물방울이 아래로 톡톡 떨어져 튄다
        if (Math.random() < .45) fx.burst(x + bx * 5, y + by * 5 + 1, [0x8ad8ff, 0xffffff, 0x3ab0ff], 1, 30, { angle: Math.atan2(by, bx), spread: .9, up: -10, grav: 460, bounce: true, life: .6, size: sz });
        break;
      case 'bubble':
        if (Math.random() < .12) fx.burst(x, y, [0xffffff, 0xbfe8ff], 1, 10, { up: 8, grav: -10, bounce: false, glow: true, life: .3, size: sz });
        break;
      case 'bolt':   // 튀는 스파크
        if (Math.random() < .55) fx.burst(x, y, q.cfg.tint ? [q.color, 0xffffff] : [0xffffff, 0xffee66, 0x6ad8ff], 1, 70 * P, { up: 0, grav: 0, bounce: false, glow: true, life: .14, size: sz, drag: .85 });
        break;
      case 'shadow':   // 검보라 아지랑이가 피어오른다
        if (Math.random() < .4) fx.burst(x + (Math.random() - .5) * 6, y + (Math.random() - .5) * 6, [0x12061c, 0x3a1a5a, 0x9a5aff], 1, 10, { angle: -Math.PI / 2, spread: 1, up: 12, grav: -26, bounce: false, life: .55, size: sz + 1, drag: .96 });
        break;
      case 'wave':
        if (Math.random() < .35) fx.burst(x, y, [0xffffff, 0xffd0a0], 1, 30, { up: 0, grav: 0, bounce: false, glow: true, life: .2, size: sz });
        break;
      case 'rock': case 'steel': case 'debris':   // 부스러기가 떨어진다 (염동력 파편은 보랏빛 알갱이도)
        if (Math.random() < .25) fx.burst(x, y + 2, q.kind === 'steel' ? [0x6a7088, 0xa0a8c0] : [0x5a4a38, 0x8a7a62], 1, 20, { up: -10, grav: 420, bounce: false, life: .5, size: sz });
        if (q.kind === 'debris' && Math.random() < .35) fx.burst(x + (Math.random() - .5) * 10, y + (Math.random() - .5) * 10, [0xc070ff, 0xffd8ff], 1, 12, { up: 6, grav: -20, bounce: false, glow: true, life: .35, size: sz });
        break;
      case 'spoon':
        if (Math.random() < .3) fx.burst(x, y, [0xffd8f0, 0xff7ac0], 1, 10, { up: 0, grav: 0, bounce: false, glow: true, life: .25, size: sz });
        break;
      default:
        if (Math.random() < .4) fx.burst(x, y, [q.color, 0xffffff], 1, 14, { up: 6, grav: -10, bounce: false, glow: true, life: .3, size: sz });
    }
  }

  // 회전하는 투사체의 잔상 (각도까지 그대로 복사)
  afterimage(q, col) {
    const sp = q.spr, im = this.pool.get(sp.x, sp.y, sp.texture.key).setRotation(sp.rotation).setScale(sp.scaleX, sp.scaleY)
      .setDepth(30).setTintFill(col).setAlpha(.45).setBlendMode(ADD);
    this.s.tweens.add({ targets: im, alpha: 0, duration: 140, onComplete: () => this.pool.release(im) });
  }

  // 한 번만: 잎날 리본 그리기
  tick(projs) {
    const g = this.ribbons; g.clear();
    for (const q of projs) {
      const tr = q.trail;
      if (!tr || tr.length < 2) continue;
      for (let i = 1; i < tr.length; i++) {
        const k = i / (tr.length - 1);
        g.lineStyle((1 + 2.4 * k) * q.pow, 0x5ae04a, .45 * k); g.lineBetween(tr[i - 1].x, tr[i - 1].y, tr[i].x, tr[i].y);
        g.lineStyle(q.tier >= 2 ? 2 : 1, 0xeaffd8, .7 * k); g.lineBetween(tr[i - 1].x, tr[i - 1].y, tr[i].x, tr[i].y);
      }
    }
  }

  // 발사 섬광: 입·손 앞에서 0.1초 번쩍
  muzzle(q) {
    const s = this.s, col = q.kind === 'shadow' ? 0xb07aff : q.color, x = q.x - q.vx * .01, y = q.y - q.vy * .01;
    const im = this.pool.get(x, y, 'pj-flash').setBlendMode(ADD).setTint(col).setDepth(32).setScale(.4).setAngle(Math.random() * 90);
    s.tweens.add({ targets: im, scale: Phaser.Math.Clamp(q.r / 4, .7, 4) * 1.1, alpha: { from: 1, to: 0 }, duration: 100, onComplete: () => this.pool.release(im) });
    this.fx.glow(x, y, 8 + q.r * 1.5, col, 100, .8);
    if (q.tier >= 1) this.fx.ring(x, y, 4 + q.r * 1.3, col, 120 + q.tier * 30);   // 2단부터: 발사 충격 고리
  }

  // 불꽃 덩어리 하나 (적중 폭발·화염방사): 텍스처 프레임을 넘기며 커지다 사라진다
  flamePuff(x, y, vx, vy, life, s0, s1, blue = false) {
    const s = this.s, pal = blue ? 'blue' : 'orange';
    const im = this.pool.get(x, y, `pj-fire-${pal}0`).setBlendMode(ADD).setDepth(33).setScale(s0).setRotation(Math.atan2(vy, vx));
    const o = { k: 0 };
    s.tweens.add({
      targets: o, k: 1, duration: life * 1000,
      onUpdate: () => {
        const k = o.k;
        im.setPosition(x + vx * life * k, y + vy * life * k - 10 * k * k).setScale(s0 + (s1 - s0) * k).setAlpha(1 - k * k)
          .setTexture(`pj-fire-${pal}${Math.floor(k * 9) % 3}`);
      },
      onComplete: () => this.pool.release(im)
    });
  }

  // 화염방사 한 줄기: 입 앞에서 불꽃 덩어리가 앞으로 쏟아진다
  flameBreath(x, y, face, len, hh, blue, tier = 0) {
    const sp = len / .32, k = 1 + tier * .25;   // 진화할수록 불꽃 덩어리가 굵어지고 불티가 많아진다
    this.flamePuff(x, y + (Math.random() - .5) * 3, face * sp * (.8 + Math.random() * .4), (Math.random() - .5) * hh * 2.4, .32, .45 * k, (1.2 + hh / 30) * k, blue);
    if (Math.random() < .5 + tier * .15) this.fx.burst(x + face * len * Math.random(), y + (Math.random() - .5) * hh, blue ? [0x5ab0ff, 0xffffff] : [0xff6600, 0xffee55], 1, 30, { up: 20, grav: -40, bounce: false, glow: true, life: .35, size: tier >= 2 ? 2 : 1 });
    if (Math.random() < .2) this.fx.burst(x + face * len * (.6 + Math.random() * .4), y - 4, [0x3a3438, 0x4a4248], 1, 12, { angle: -Math.PI / 2, spread: 1, up: 14, grav: -30, bounce: false, life: .7, size: 2, drag: .95 });
  }

  // 베기 선 (잎날 적중의 X자)
  slash(x, y, ang, len, col) {
    const s = this.s;
    for (const [tint, w, a] of [[col, 1, .9], [0xffffff, .55, 1]]) {
      const im = this.pool.get(x, y, 'pj-slash').setBlendMode(ADD).setTint(tint).setDepth(34).setRotation(ang).setScale(len / 28 * .3, w);
      s.tweens.add({ targets: im, scaleX: len / 28, duration: 70, ease: 'Quad.easeOut' });
      s.tweens.add({ targets: im, alpha: { from: a, to: 0 }, scaleY: 0, delay: 70, duration: 140, onComplete: () => this.pool.release(im) });
    }
  }

  // 잎 조각: 작은 잎이 빙글빙글 돌며 하늘하늘 떨어진다
  leafBits(x, y, n, k = 1) {
    const s = this.s;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (40 + Math.random() * 60) * k, vx = Math.cos(a) * v, vy = Math.sin(a) * v - 30;
      const life = .6 + Math.random() * .3, spin = (Math.random() < .5 ? -1 : 1) * (6 + Math.random() * 6), o = { k: 0 };
      const im = this.pool.get(x, y, 'pj-leaf').setDepth(33).setScale((.3 + Math.random() * .15) * k).setRotation(a).setTint(i % 2 ? 0xffffff : 0xb8f0a0);
      s.tweens.add({
        targets: o, k: 1, duration: life * 1000,
        onUpdate: () => { const t = o.k * life; im.setPosition(x + vx * t * (1 - o.k * .5) + Math.sin(t * 12 + i) * 2, y + vy * t + 90 * t * t).setRotation(a + spin * t).setAlpha(1 - o.k * o.k); },
        onComplete: () => this.pool.release(im)
      });
    }
  }

  // 적중·벽 충돌 연출. reason: 'hit'(적) · 'wall'(벽·바닥) · 'expire'(수명 끝)
  //  진화 단계(q.tier)가 오를수록 크기(big)·파편 수(n)·파편 굵기(sz)가 늘고, 2단부터 충격파 고리·메가는 섬광이 더해진다
  impact(q, reason) {
    const fx = this.fx, x = q.x, y = q.y, big = Phaser.Math.Clamp(q.r / 4, .7, 4.4), blue = q.frames && q.frames[0].includes('blue');
    const T = q.tier || 0, n = c => Math.round(c * (1 + T * .5)), sz = T >= 2 ? 2 : 1;
    if (reason === 'expire') { fx.glow(x, y, 6 + q.r, q.kind === 'shadow' ? 0x9a5aff : q.color, 160, .5); fx.burst(x, y, [q.color, 0xffffff], n(3), 40, { glow: true, life: .3, size: sz }); return; }
    switch (q.kind) {
      case 'fire': {   // 작은 화염 폭발 + 바닥에 통통 튀며 구르는 불똥
        for (let i = 0, m = 4 + T * 2; i < m; i++) { const a = -Math.PI / 2 + (i - (m - 1) / 2) * (2.8 / m); this.flamePuff(x, y, Math.cos(a) * 40 * big, Math.sin(a) * 40 * big, .3 + T * .04, .5 * big, 1.1 * big, blue); }
        fx.glow(x, y, 16 * big, blue ? 0x5ab0ff : 0xff7a2a, 200, 1);
        fx.burst(x, y, blue ? [0x5ab0ff, 0xbfe6ff, 0xffffff] : [0xff6600, 0xffee55, 0xffaa22, 0xffffff], n(8 + Math.random() * 4), 150 * big, { up: 110, grav: 520, bounce: true, glow: true, life: .9, size: sz });
        // 연기는 폭발 섬광이 걷힌 뒤 위쪽에서 피어오른다 (터지는 순간 가운데 검은 점처럼 보이지 않게)
        this.s.time.delayedCall(140, () => fx.burst(x, y - 4 * big, [0x3a3438, 0x2a2428], n(4), 20 * big, { angle: -Math.PI / 2, spread: 1.4, up: 20, grav: -30, bounce: false, life: .8, size: sz + 1, drag: .95 }));
        break;
      }
      case 'leaf': {   // X자 베기 + 사방으로 흩날리는 잎 조각
        const a = (Math.random() - .5) * .4;
        this.slash(x, y, -Math.PI / 4 + a, 26 * big, 0x5ae04a);
        this.slash(x, y, Math.PI / 4 + a, (reason === 'hit' ? 26 : 18) * big, 0x9aff7a);
        if (T >= 2) this.slash(x, y, a, 20 * big, 0xeaffd8);   // 3단부터 가로 한 줄 더 (✳)
        this.leafBits(x, y, (reason === 'hit' ? 6 : 4) + T * 2, 1 + T * .3);
        fx.burst(x, y, [0x62d44a, 0xc8ff9a, 0x2e963a, 0xffffff], n(8), 120 * big, { up: 40, grav: 120, bounce: false, life: .6, drag: .95, size: sz });
        break;
      }
      case 'water': case 'bubble': {   // 물풍선이 터지듯 둥근 물보라 링 + 사방으로 튀는 물방울
        const k = q.kind === 'bubble' ? .6 : 1;
        fx.ring(x, y, 16 * big * k, 0x8ad8ff, 260);
        fx.ring(x, y, 9 * big * k, 0xffffff, 180);
        fx.glow(x, y, 10 * big * k, 0x3ab0ff, 160, .6);
        fx.burst(x, y, [0x8ad8ff, 0xffffff, 0x3ab0ff], n(12 * k), 130 * big, { up: 80, grav: 520, bounce: true, life: .7, size: sz });
        break;
      }
      case 'bolt': {   // 감전: 짧은 번개 갈래 + 튀는 스파크
        const col = q.cfg && q.cfg.tint ? q.color : 0xffee66;
        const g = this.s.add.graphics().setDepth(34).setBlendMode(ADD);
        for (let i = 0; i < 3 + T; i++) {
          let px = x, py = y; const a = Math.random() * Math.PI * 2, pts = [{ x: px, y: py }];
          for (let k = 0; k < 3 + (T >= 2); k++) { px += Math.cos(a + (Math.random() - .5) * 1.4) * 5 * big; py += Math.sin(a + (Math.random() - .5) * 1.4) * 5 * big; pts.push({ x: Math.round(px), y: Math.round(py) }); }
          g.lineStyle(sz * 2, col, .8); g.strokePoints(pts, false); g.lineStyle(sz, 0xffffff, 1); g.strokePoints(pts, false);
        }
        this.s.tweens.add({ targets: g, alpha: 0, duration: 140 + T * 30, onComplete: () => g.destroy() });
        fx.glow(x, y, 12 * big, col, 140, .9);
        fx.burst(x, y, [0xffffff, col, 0x6ad8ff], n(10), 160 * big, { up: 20, grav: 200, bounce: true, glow: true, life: .35, size: sz });
        break;
      }
      case 'shadow': {   // 영혼이 흩어지며 검보라 아지랑이
        fx.ring(x, y, 14 * big, 0x9a5aff, 260);
        fx.glow(x, y, 12 * big, 0x9a5aff, 220, .8);
        fx.burst(x, y, [0x12061c, 0x3a1a5a, 0x9a5aff, 0xe8c8ff], n(14), 90 * big, { up: 30, grav: -40, bounce: false, life: .7, size: sz + 1, drag: .94 });
        break;
      }
      case 'rock': case 'steel': case 'debris': {   // 바위가 깨지며 돌 조각이 바닥에 튀고 흙먼지
        const pal = q.kind === 'steel' ? [0x6a7088, 0xa0a8c0, 0xeef2ff] : [0x5a4a38, 0x8a7a62, 0xa88c66];
        fx.burst(x, y, pal, n(10), 150 * big, { up: 120, grav: 700, bounce: true, life: .8, size: sz + 1 });
        fx.burst(x, y, [0x6a6058, 0x8a8078], n(5), 40 * big, { angle: -Math.PI / 2, spread: 1.6, up: 20, grav: -20, bounce: false, life: .6, size: sz + 1, drag: .94 });
        if (q.kind === 'debris') fx.ring(x, y, 14 * big, 0xc070ff, 220);
        if (q.kind === 'steel') fx.ring(x, y, 10 * big, 0xeef2ff, 160);
        fx.shake(.004, 80); Sfx.play('crack');
        break;
      }
      case 'wave': {
        fx.ring(x, y, 18 * big, 0xffd0a0, 220);
        fx.burst(x, y, [0xffffff, 0xffd0a0, 0xff8a3a], n(10), 140 * big, { up: 40, glow: true, life: .4, size: sz });
        break;
      }
      default: {
        fx.ring(x, y, 12 * big, q.color, 200);
        fx.glow(x, y, 10 * big, q.color, 160, .8);
        fx.burst(x, y, [q.color, 0xffffff], n(8), 110 * big, { up: 40, glow: true, life: .45, size: sz });
      }
    }
    // 단계 보너스: 2단부터 바깥으로 번지는 충격파 고리, 메가는 십자 섬광까지
    const col = q.kind === 'shadow' ? 0x9a5aff : blue ? 0x5ab0ff : q.cfg && !q.cfg.tint ? q.cfg.col[0] : q.color;
    if (T >= 1) fx.ring(x, y, (12 + T * 8) * big * .7, col, 200 + T * 50);
    if (T >= 3) {
      const im = this.pool.get(x, y, 'pj-flash').setBlendMode(ADD).setTint(col).setDepth(34).setScale(big * .8).setAngle(45);
      this.s.tweens.add({ targets: im, scale: big * 2.2, alpha: { from: 1, to: 0 }, duration: 180, onComplete: () => this.pool.release(im) });
    }
  }
}
