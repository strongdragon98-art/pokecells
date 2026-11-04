// ✨ 샛길 정화 구역 (side_purifiable_room) — 그림 · 연출
//  어떤 방이 샛길 정화 구역인지 · 언제 정화되는지(침식된 포켓몬을 마지막 한 마리까지) · 보상은 GameScene 이 정한다 (sideRoomsOf · checkRoomClear · purifySideRoom)
//  여기서는 그 방을 덮은 침식과 정화하는 순간, 정화 뒤의 성역을 그린다
//   · 침식(정화 전): 벽 · 천장 · 바닥을 타고 뻗은 보랏빛 가시 덩굴 · 바닥과 허리 높이에 고인 검붉은 침식 안개 두 겹 ·
//     방을 가라앉히는 검붉은 그늘 · 바닥에서 숨 쉬는 핏빛 기운 · 피어오르는 오염된 포자(update)
//     — 어두운 비네팅 · 채도 · 주변광은 GameScene.updateAtmosphere 가 이 방의 침식 깊이를 끌어올려 맡는다
//   · 정화 순간(purify): 플레이어 가슴에서 🔥 유대의 불꽃 파동이 방 전체로 퍼지고, 파동이 닿는 차례로 덩굴이 금빛 불티로 타 사라지며 안개 · 그늘이 걷힌다
//   · 정화 뒤(성역): 바닥의 따뜻한 빛 웅덩이 · 작은 꽃 · 날아다니는 반딧불이와 흩날리는 꽃잎(update) — 밝기 95 ~ 100% 는 GameScene (depthOf 0)
//  그림은 방마다 한 번 그려 두고, 카메라 둘레에 걸친 방만 보인다 (덩굴 그래픽은 화면 밖이면 숨긴다)
import Phaser from 'phaser';
import { TILE } from '../config.js';

const ADD = Phaser.BlendModes.ADD;
const VINE = { dark: 0x1e0626, mid: 0x4a1458, light: 0x8a2aa0, thorn: 0xd27aff, tip: 0xff4a7a };
const SPORE = [0x9a3aff, 0xff3a6a, 0x6a1a4a, 0xc05aff];
const FLY = [0xd8ff8a, 0xfff0a0, 0xb8ffd8];
const PETAL = [0xffb8d8, 0xffe0ec, 0xfff4f8, 0xffd0a0];
// 칸마다 고정된 난수 (다시 지어도 · 이어하기로 와도 덩굴 모양이 같다)
const hash = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export class SideRooms {
  // rooms: 이 지방의 샛길 정화 구역 (GameScene.sideRoomsOf) — 이미 정화한 방은 처음부터 성역으로
  constructor(scene, level, rooms) {
    this.s = scene; this.level = level;
    this.corrupt = new Map();   // 방 → { objs, g, fogs, pulse, pts }
    this.pure = new Map();      // 방 → { objs, glows }
    for (const r of rooms) { if (r.isPurified) this.buildPure(r, false); else this.buildCorrupt(r); }
  }

  solid(x, y) { const G = this.level.grid; return !!(G[y] && (G[y][x] === 'S' || G[y][x] === 'B')); }
  open(x, y) { const G = this.level.grid; return !!(G[y] && G[y][x] === '.'); }

  // 가시 덩굴 한 줄기: 점들을 따라 2px 굵은 줄기(짙은 보라) + 1px 윤 · 마디마다 양쪽으로 번갈아 뾰족한 가시 · 끝에 핏빛 싹
  strand(g, pts, pts2) {
    for (const [x, y] of pts) { g.fillStyle(VINE.dark, .95); g.fillRect(x - 1, y - 1, 3, 3); }
    for (const [x, y] of pts) { g.fillStyle(VINE.mid, 1); g.fillRect(x, y, 2, 2); }
    pts.forEach(([x, y], i) => {
      if (i % 3 === 0) { g.fillStyle(VINE.light, .9); g.fillRect(x, y, 1, 1); }
      if (i % 4 === 2) {   // 가시: 줄기 방향에 직각으로 2 ~ 3px
        const [px, py] = pts[Math.max(0, i - 1)], dx = x - px, dy = y - py, sd = (i >> 2) % 2 ? 1 : -1;
        const nx = dy !== 0 ? sd : 0, ny = dx !== 0 ? sd : 0;
        g.fillStyle(VINE.thorn, 1); g.fillRect(x + nx * 2, y + ny * 2, 1, 1); g.fillRect(x + nx * 3, y + ny * 3, 1, 1);
        g.fillStyle(VINE.dark, 1); g.fillRect(x + nx, y + ny, 1, 1);
      }
    });
    const [ex, ey] = pts[pts.length - 1];
    g.fillStyle(VINE.tip, .9); g.fillRect(ex - 1, ey, 2, 2);
    if (pts2) for (let i = 0; i < pts.length; i += 3) pts2.push(pts[i]);
  }

  buildCorrupt(r) {
    const s = this.s, g = s.add.graphics().setDepth(10.33), pts = [], objs = [g];
    const L = r.left, R = r.right, T = r.top, B = r.F * TILE, W = R - L;
    // ① 천장 · 종유석 아래로 늘어진 가시 덩굴
    for (let ty = r.ty0; ty < r.F; ty++) for (let tx = r.tx0; tx < r.tx1; tx++) {
      if (!this.open(tx, ty) || !this.solid(tx, ty - 1) || hash(tx, ty, 1) > .42) continue;
      let room = 0; while (room < 6 && this.open(tx, ty + room)) room++;
      const len = Math.min(room * TILE - 10, 14 + Math.floor(hash(tx, ty, 2) * 46));
      if (len < 10) continue;
      const x0 = tx * TILE + 3 + Math.floor(hash(tx, ty, 3) * 10), ph = hash(tx, ty, 4) * 6, line = [];
      for (let d = 0; d <= len; d += 2) line.push([Math.round(x0 + Math.sin(d * .16 + ph) * 2.2), ty * TILE + d]);
      this.strand(g, line, pts);
    }
    // ② 바닥 · 턱을 기어가는 덤불 가시 (윗면을 따라 낮게 물결치며, 군데군데 아치처럼 솟는다)
    for (let ty = r.ty0 + 1; ty <= r.F; ty++) {
      let run = [];
      const flush = () => {
        if (run.length >= 2) {
          const x0 = run[0] * TILE, x1 = (run[run.length - 1] + 1) * TILE, line = [], ph = hash(run[0], ty, 5) * 6;
          for (let x = x0 + 1; x < x1 - 1; x += 2) line.push([x, ty * TILE - 2 - Math.round(Math.abs(Math.sin(x * .07 + ph)) * 3)]);
          if (line.length > 2) this.strand(g, line, pts);
          for (const c of run) if (hash(c, ty, 6) < .22) {   // 솟은 가시 덤불 아치
            const cx = c * TILE + 8, h = 6 + Math.floor(hash(c, ty, 7) * 8), arc = [];
            for (let a = 0; a <= Math.PI; a += .32) arc.push([Math.round(cx - Math.cos(a) * 6), Math.round(ty * TILE - 1 - Math.sin(a) * h)]);
            this.strand(g, arc, pts);
          }
        }
        run = [];
      };
      for (let tx = r.tx0; tx <= r.tx1; tx++) {
        const top = tx < r.tx1 && this.solid(tx, ty) && this.open(tx, ty - 1) && hash(tx, ty, 8) < .72;
        if (top) run.push(tx); else flush();
      }
    }
    // ③ 벽을 타고 오르는 덩굴 (양쪽 벽면 · 바닥에서 위로)
    for (const side of [-1, 1]) {
      const tx = side < 0 ? r.tx0 : r.tx1 - 1, wx = side < 0 ? r.tx0 * TILE + 1 : r.tx1 * TILE - 3;
      for (let ty = r.F - 1; ty > r.ty0; ty--) {
        if (!this.open(tx, ty) || !this.solid(tx + side, ty) || hash(tx, ty, 9) > .3) continue;
        const h = 24 + Math.floor(hash(tx, ty, 10) * 60), ph = hash(tx, ty, 11) * 6, line = [];
        for (let d = 0; d <= h; d += 2) { const y = ty * TILE + 14 - d; if (y < T) break; line.push([Math.round(wx - side * Math.abs(Math.sin(d * .12 + ph)) * 3), y]); }
        if (line.length > 3) this.strand(g, line, pts);
        ty -= 3;
      }
    }
    // ④ 검붉은 침식 안개 (바닥에 짙게 · 허리 높이에 옅게) · 방을 가라앉히는 그늘 · 바닥에서 숨 쉬는 핏빛 기운
    const fogs = [];
    for (const [y, a, sp, sc, tint] of [[B - 16, .46, 7, 1.15, 0x7a0a24], [T + (B - T) * .55, .24, -4, 1.7, 0x4a0a3a]]) {
      const f = s.add.tileSprite(L, y, W, 36, 'fog').setOrigin(0, .5).setTint(tint).setAlpha(a).setDepth(14.45).setTileScale(sc, 1);
      f.sp = sp; f.base = a; f.tilePositionY = 14; fogs.push(f); objs.push(f);
    }
    const shade = s.add.rectangle(L, T, W, r.bottom - T, 0x1a0208, .2).setOrigin(0).setDepth(14.3);
    const pulse = s.add.image(r.cx, B - 6, 'glow').setBlendMode(ADD).setTint(0xff1a3a).setScale(W / 70, 1.1).setAlpha(.12).setDepth(14.35);
    objs.push(shade, pulse);
    this.corrupt.set(r, { objs, g, fogs, pulse, pts, shown: true });
  }

  // 성역: 바닥의 따뜻한 빛 웅덩이 · 윗면마다 드문드문 작은 꽃 (fade: 정화 순간엔 천천히 피어난다)
  buildPure(r, fade = true) {
    const s = this.s, objs = [], glows = [], B = r.F * TILE, W = r.right - r.left;
    const n = Math.max(2, Math.round(W / 220));
    for (let k = 0; k < n; k++) {
      const gl = s.add.image(r.left + W * (k + .5) / n, B - 10, 'glow').setBlendMode(ADD).setTint(k % 2 ? 0xfff0b0 : 0xffd890).setScale(3.4, 1.3).setAlpha(0).setDepth(14.35);
      gl.base = .16; gl.ph = k * 1.7; glows.push(gl); objs.push(gl);
    }
    const beam = s.add.image(r.cx, r.top + 4, 'glow').setOrigin(.5, 0).setBlendMode(ADD).setTint(0xfff4d0).setScale(Math.max(1.4, W / 120), 5).setAlpha(0).setDepth(3.3).setAngle(-12);   // 위에서 내려오는 따스한 햇살
    beam.base = .14; beam.ph = 0; glows.push(beam); objs.push(beam);
    const wash = s.add.rectangle(r.left, r.top, W, r.bottom - r.top, 0xffe2b0, 1).setOrigin(0).setBlendMode(ADD).setAlpha(0).setDepth(2.5);   // 어두운 동굴 뒷벽까지 따뜻하게 밝힌다
    wash.base = .09; wash.ph = 1.1; glows.push(wash); objs.push(wash);
    for (let ty = r.ty0 + 1; ty <= r.F; ty++) for (let tx = r.tx0; tx < r.tx1; tx++) {
      if (!this.solid(tx, ty) || !this.open(tx, ty - 1) || hash(tx, ty, 12) > .3) continue;
      const fl = s.add.image(tx * TILE + 3 + Math.floor(hash(tx, ty, 13) * 10), ty * TILE + 2, `dec:flower:${Math.floor(hash(tx, ty, 14) * 4)}`).setOrigin(.5, 1).setDepth(13).setAlpha(fade ? 0 : 1);
      objs.push(fl);
      if (fade) s.tweens.add({ targets: fl, alpha: 1, duration: 600, delay: 300 + hash(tx, ty, 15) * 900 });
    }
    for (const gl of glows) if (!fade) gl.setAlpha(gl.base);
    this.pure.set(r, { objs, glows, born: fade ? 0 : 1 });
  }

  // 정화하는 순간 (px, py: 플레이어 가슴)
  purify(r, px, py) {
    const s = this.s, fx = s.fx, cam = s.cameras.main, Rr = Math.max(240, Math.hypot(r.right - r.left, r.bottom - r.top));
    cam.flash(520, 255, 228, 180, true);
    // 🔥 유대의 불꽃 파동: 가슴에서 불꽃이 터지고 금빛 · 주황 고리가 방 끝까지 번진다 + 방을 쓸고 지나가는 빛의 물결
    fx.burst(px, py, [0xff9a3a, 0xffd25a, 0xffffff, 0xff6a2a], 30, 170, { glow: true, up: 90, grav: -30, bounce: false, life: 1.1 });
    fx.glow(px, py, 46, 0xffb040, 520, 1);
    [0xffb040, 0xffe08a, 0xfff4d0, 0xff9a3a, 0xffffff].forEach((col, k) => s.time.delayedCall(k * 130, () => fx.ring(px, py, Rr * (.42 + k * .2), col, 950 + k * 140)));
    const wave = s.add.image(px, py, 'glow').setBlendMode(ADD).setTint(0xffe2a0).setScale(.4).setAlpha(.9).setDepth(44);
    s.tweens.add({ targets: wave, scale: Rr / 26, alpha: 0, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => wave.destroy() });
    // 침식이 걷힌다: 파동이 닿는 차례로 덩굴이 금빛 불티로 타 사라지고, 안개 · 그늘 · 핏빛 기운이 눈 녹듯 옅어진다
    const c = this.corrupt.get(r);
    if (c) {
      this.corrupt.delete(r);
      const pts = c.pts.filter((q, i) => i % Math.max(1, Math.ceil(c.pts.length / 70)) === 0);
      for (const [x, y] of pts) {
        const d = Math.hypot(x - px, y - py) / Rr;
        s.time.delayedCall(80 + d * 900, () => fx.burst(x, y, [0xffd25a, 0xff9a3a, 0xc05aff], 2, 34, { glow: true, up: 26, grav: -40, bounce: false, life: .8, size: 1 }));
      }
      for (const o of c.objs) { s.tweens.killTweensOf(o); s.tweens.add({ targets: o, alpha: 0, delay: 250, duration: 1300, ease: 'Sine.easeIn', onComplete: () => o.destroy() }); }
    }
    s.time.delayedCall(700, () => { if (!this.dead && !this.pure.has(r)) this.buildPure(r, true); });
  }

  update(dt, view) {
    const fx = this.s.fx, pad = 80, t = this.s.time.now / 1000;
    const near = r => r.right > view.x - pad && r.left < view.right + pad && r.bottom > view.y - pad && r.top < view.bottom + pad;
    for (const [r, c] of this.corrupt) {
      const on = near(r);
      if (on !== c.shown) { c.shown = on; for (const o of c.objs) o.setVisible(on); }
      if (!on) continue;
      for (const f of c.fogs) f.tilePositionX += f.sp * dt;
      c.pulse.setAlpha(.1 + Math.sin(t * 1.6 + r.id) * .05);
      // 오염된 포자: 이 방 안 화면에 보이는 자리의 바닥 쪽에서 피어오른다
      const x0 = Math.max(r.left, view.x), x1 = Math.min(r.right, view.right), y0 = Math.max(r.top, view.y), y1 = Math.min(r.bottom, view.bottom);
      if (x1 > x0 && y1 > y0 && Math.random() < .55 * Math.min(1, (x1 - x0) / 300)) {
        fx.burst(x0 + Math.random() * (x1 - x0), y0 + (y1 - y0) * (.45 + Math.random() * .55), SPORE, 1, 10, { angle: -Math.PI / 2, spread: .8, up: 12, grav: -12, bounce: false, glow: true, life: 2.2, size: Math.random() < .3 ? 2 : 1, drag: .99 });
      }
    }
    for (const [r, p] of this.pure) {
      if (!near(r)) continue;
      p.born = Math.min(1, p.born + dt * .8);
      for (const gl of p.glows) gl.setAlpha(p.born * (gl.base + Math.sin(t * 1.3 + gl.ph) * gl.base * .3));
      const x0 = Math.max(r.left, view.x), x1 = Math.min(r.right, view.right), y0 = Math.max(r.top, view.y), y1 = Math.min(r.bottom, view.bottom);
      if (x1 <= x0 || y1 <= y0) continue;
      const k = Math.min(1, (x1 - x0) / 300) * p.born;
      if (Math.random() < .3 * k)   // 반딧불이: 바닥 위를 천천히 떠오르며 깜빡인다
        fx.burst(x0 + Math.random() * (x1 - x0), y0 + (y1 - y0) * (.35 + Math.random() * .6), FLY, 1, 8, { up: 6, grav: -5, bounce: false, glow: true, life: 2.6, size: Math.random() < .25 ? 2 : 1, drag: .995 });
      if (Math.random() < .2 * k)   // 꽃잎: 위에서 하늘하늘 흩날린다
        fx.burst(x0 + Math.random() * (x1 - x0), y0 + 4, PETAL, 1, 16, { angle: Math.PI / 2 + .5, spread: 1.4, up: 0, grav: 10, bounce: false, life: 3.4, size: 2, drag: .985 });
    }
  }

  destroy() {
    this.dead = true;
    for (const c of this.corrupt.values()) for (const o of c.objs) o.destroy();
    for (const p of this.pure.values()) for (const o of p.objs) o.destroy();
    this.corrupt.clear(); this.pure.clear();
  }
}
