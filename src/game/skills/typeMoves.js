// 타입별 교체 등장 스킬 · Z기술 구현 (독·에스퍼·악·드래곤·강철·바위·땅·얼음·벌레·페어리 / 비행 Z)
// 메타데이터는 data/skills/typeMoves.js. 형식은 game/skills.js 의 TAG_IMPL · ZMOVE_IMPL 과 같다.
import Phaser from 'phaser';
import { typeColor } from '../../data/types.js';
import { Sfx } from '../../systems/Audio.js';
import { sizeMul, lineFx, view, groundAt } from '../skillKit.js';
import { zAction } from '../skills.js';

// 별 모양 꼭짓점 (그래픽스 fillPoints 용)
const starPts = (x, y, r, rot = 0, n = 5) => { const pts = []; for (let i = 0; i < n * 2; i++) { const a = rot + i / (n * 2) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .45 : r; pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr }); } return pts; };
const ADD = () => Phaser.BlendModes.ADD;

// 교체 등장 스킬
export const TAG_IMPL = {
  tag_poison(p) {
    const r = 80 * sizeMul(p), sc = p.scene;
    sc.combat.hitCircle(p.x, p.y, r, 1.2, 'poison', { poison: 5, kbx: 100, kby: -100 });
    for (let k = 0; k < 5; k++) sc.time.delayedCall(k * 50, () => sc.fx.glow(p.x + (Math.random() - .5) * r, p.y + (Math.random() - .5) * r * .5, r * .45, k % 2 ? 0x9a2ac0 : 0xb84ad0, 420, .75));
    sc.fx.burst(p.x, p.y, [0xb84ad0, 0xd08aff, 0x6a1a8a], 30, 160, { grav: -30, bounce: false, life: .9 });
    sc.fx.ring(p.x, p.y, r, 0xb84ad0, 320); Sfx.play('ghost');
  },
  tag_psychic(p) {
    const r = 90 * sizeMul(p), sc = p.scene;
    sc.combat.hitCircle(p.x, p.y, r, 1.4, 'psychic', { confuse: 1.2, kbx: 80, kby: -320 });
    for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 70, () => sc.fx.ring(p.x, p.y, r * (1 - k * .2), k % 2 ? 0xffb0d8 : 0xff5a9a, 300));
    sc.fx.glow(p.x, p.y, r * .8, 0xff5a9a, 300, .8); Sfx.play('wave');
  },
  tag_dark(p) {
    const r = 80 * sizeMul(p), sc = p.scene;
    for (const e of sc.combat.nearest(p.x, p.y, 6, r)) { sc.fx.slash(e.x, e.y, 16 * sizeMul(p), Math.sign(e.x - p.x) || p.face, 0x8a6aa0, { ms: 200 }); sc.fx.slash(e.x, e.y, 14 * sizeMul(p), -(Math.sign(e.x - p.x) || p.face), 0x3a2a4a, { ms: 200, flipV: true }); }
    sc.combat.hitCircle(p.x, p.y, r, 1.6, 'dark', { curse: 5, kbx: 160 });
    sc.fx.glow(p.x, p.y, r, 0x2a1a3a, 300, .9); sc.fx.ghost(p.sprite, 0x6a5446, .7, 300);
    Sfx.play('swing'); Sfx.play('ghost');
  },
  tag_dragon(p) {
    const r = 96 * sizeMul(p), sc = p.scene;
    sc.combat.hitCircle(p.x, p.y, r, 1.6, 'dragon', { stun: .8, kbx: 320, kby: -200 });
    for (let k = 0; k < 3; k++) sc.time.delayedCall(k * 80, () => sc.fx.ring(p.x, p.y, r * (.6 + k * .2), k % 2 ? 0xb09aff : 0x6a4aff, 320));
    sc.fx.glow(p.x, p.y, r * .9, 0x6a4aff, 320, .9);
    sc.fx.shake(.014, 260); Sfx.play('beam'); p.squash(.8, 1.25);
  },
  tag_steel(p) {
    const r = 70 * sizeMul(p), sc = p.scene;
    p.b.setVelocityY(600);
    sc.combat.hitCircle(p.x, p.bottom - 6, r, 2.2, 'steel', { kbx: 220, kby: -300 });
    sc.fx.ring(p.x, p.bottom - 4, r, 0xa8b0c8, 300); sc.fx.glow(p.x, p.bottom - 6, r * .7, 0xe0e8ff, 260, 1);
    sc.fx.burst(p.x, p.bottom - 2, [0xa8b0c8, 0xffffff, 0xffe080], 24, 220, { up: 120 });
    sc.fx.shake(.016, 240); Sfx.play('crack'); Sfx.play('boom'); p.squash(1.4, .65);
  },
  tag_rock(p) {
    const r = 88 * sizeMul(p), sc = p.scene, s = sizeMul(p);
    const tg = sc.combat.nearest(p.x, p.y, 4, r);
    if (!tg.length) tg.push({ x: p.x + p.face * 40, y: p.y });
    for (const e of tg) sc.fx.shatter(e.x, e.y - 14, 18 * s, 16 * s, { n: 10, speed: 110, up: 60 });
    sc.combat.hitCircle(p.x, p.y, r, 2, 'rock', { stun: .5, kbx: 120, kby: -160 });
    sc.fx.burst(p.x, p.bottom - 2, [0xc0a050, 0x8a7030, 0xe0d0a0], 24, 180, { up: 100 });
    sc.fx.shake(.014, 220); Sfx.play('boom'); Sfx.play('crack');
  },
  tag_ground(p) {
    const r = 100 * sizeMul(p), sc = p.scene, s = sizeMul(p);
    for (let k = -3; k <= 3; k++) { const x = p.x + k * r / 3.5, gy = groundAt(p, x); lineFx(sc, x, gy, x + (Math.random() - .5) * 8, gy - (26 + Math.random() * 20) * s, 0xd8b060, { seg: 3, jag: 4, w: 5, ms: 360 }); }
    sc.combat.hitCircle(p.x, p.bottom - 6, r, 1.8, 'ground', { slow: 2, kbx: 60, kby: -360 });
    sc.fx.burst(p.x, p.bottom - 2, [0xd8b060, 0x9a7a3a, 0x6a4a20], 36, 220, { up: 180 });
    sc.fx.shake(.016, 260); Sfx.play('boom');
  },
  tag_ice(p) {
    const r = 84 * sizeMul(p), sc = p.scene;
    sc.combat.hitCircle(p.x, p.y, r, 1.3, 'ice', { slow: 3, stun: .6, kbx: 120 });
    sc.fx.glow(p.x, p.y, r, 0x8ae8ff, 360, .9); sc.fx.ring(p.x, p.y, r, 0xdff8ff, 300);
    sc.fx.shatter(p.x, p.y, r * .8, r * .5, { n: 14, speed: 160 });
    sc.fx.burst(p.x, p.y, [0x8ae8ff, 0xffffff], 24, 200, { grav: 80, glow: true });
    Sfx.play('shatter');
  },
  tag_bug(p) {
    const r = 88 * sizeMul(p), sc = p.scene;
    for (const e of sc.combat.nearest(p.x, p.y, 6, r)) for (let k = 0; k < 3; k++) lineFx(sc, p.x, p.y, e.x + (Math.random() - .5) * 10, e.y + (Math.random() - .5) * 10, 0xa0c020, { seg: 6, jag: 14, w: 1, ms: 300 });
    sc.combat.hitCircle(p.x, p.y, r, 1.5, 'bug', { slow: 2, kbx: 100 });
    sc.fx.burst(p.x, p.y, [0xa0c020, 0xd0f060, 0x4a5a10], 34, 200, { grav: 0, bounce: false, life: .6, drag: .94 });
    sc.fx.ring(p.x, p.y, r, 0xa0c020, 300); Sfx.play('chain');
  },
  tag_fairy(p) {
    const r = 90 * sizeMul(p), sc = p.scene;
    sc.combat.hitCircle(p.x, p.y, r, 1.2, 'fairy', { curse: 4, kbx: 140 });
    for (const m of p.members) if (m.alive) m.hp = Math.min(m.maxhp, m.hp + m.maxhp * .08);
    sc.fx.burst(p.x, p.y, [0xffa0e0, 0xffffff, 0xfff0a0], 30, 180, { grav: -20, bounce: false, glow: true, life: .9 });
    sc.fx.ring(p.x, p.y, r, 0xffa0e0, 340); sc.fx.glow(p.x, p.y, r * .7, 0xffd0f0, 340, .8);
    sc.fx.floatText(p.x, p.b.y - 16, '파티 회복!', '#7dff9a', 10); Sfx.play('heal');
  }
};

// ---------------- Z기술 (Q) ----------------
export const ZMOVE_IMPL = {
  // 파이널다이브클래시: 화면 위 끝까지 솟구쳤다가 음속으로 내리꽂힌다
  supersonic_skystrike(p, def) {
    const sc = p.scene, s = sizeMul(p);
    return zAction(p, def, {
      dur: 1.6, ctrl: true, noGrav: true, hitAt: 1.12, kby: -380,
      ev: [
        [.5, () => { sc.fx.burst(p.x, p.bottom, [0xc8b0ff, 0xffffff], 30, 220, { up: 60 }); Sfx.play('dash'); }],
        [.85, () => { sc.fx.glow(p.x, p.y, 60 * s, 0xffffff, 300, 1); Sfx.play('wave'); }],
        [1.12, () => {
          const gy = groundAt(p, p.x);
          for (let k = 0; k < 5; k++) sc.time.delayedCall(k * 50, () => sc.fx.ring(p.x, gy - 6, (50 + k * 50) * s, k % 2 ? 0xffffff : 0x9ab0ff, 480));
          sc.fx.burst(p.x, gy - 2, [0x9ab0ff, 0xffffff, 0xc8b0ff], 80, 360 * s, { up: 160, glow: true });
        }]
      ],
      update(p, a, dt) {
        const v = view(p);
        if (a.t < .5) { p.b.setVelocity(0, 0); return; }
        if (a.t < .85) p.b.setVelocity(0, p.y > v.y + 30 ? -900 : 0);
        else if (a.t < 1.12) { p.b.setVelocity(p.face * 380, 1100); if (p.x < v.x + 20 || p.x > v.right - 20) p.b.setVelocityX(0); }
        else p.b.setVelocity(0, 0);
        a.gt = (a.gt || 0) - dt;
        if (a.gt <= 0 && a.t < 1.12) { a.gt = .02; sc.fx.ghost(p.sprite, a.t < .85 ? 0x9ab0ff : 0xffffff, .6, 280); if (a.t > .85) lineFx(sc, p.x - p.face * 40, p.y - 90, p.x, p.y, 0xc8b0ff, { seg: 2, jag: 0, w: 3, ms: 200 }); }
      },
      end(p) { p.b.setVelocity(0, 0); }
    });
  },
  // 맥시멈사이브레이커: 회전하는 염동력 만화경이 화면을 뒤덮는다
  shattered_psyche(p, def) {
    const sc = p.scene, s = sizeMul(p), g = sc.add.graphics().setDepth(44).setBlendMode(ADD());
    return zAction(p, def, {
      dur: 1.8, status: { confuse: 2 }, kbx: 60, kby: -520,
      ev: [[.5, () => { sc.cameras.main.flash(300, 255, 90, 160, true); Sfx.play('wave'); }], [.8, () => Sfx.play('beam')]],
      update(p, a) {
        g.clear();
        if (a.t < .5 || a.t > 1.7) return;
        const v = view(p), cx = v.centerX, cy = v.centerY, k = Math.min(1, (a.t - .5) / .4), fade = a.t > 1.1 ? Math.max(0, 1 - (a.t - 1.1) / .6) : 1, R = Math.max(v.width, v.height) * .7 * k;
        for (let i = 0; i < 12; i++) {
          const ang = a.t * 2.2 + i / 12 * Math.PI * 2;
          g.lineStyle(2, i % 2 ? 0xff5a9a : 0xffb0d8, .7 * fade);
          g.lineBetween(cx, cy, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
        }
        for (let j = 0; j < 4; j++) {
          const rr = ((a.t * 160 + j * 60) % 240) * s * k, rot = -a.t * 3 + j;
          g.lineStyle(3, j % 2 ? 0xff5a9a : 0xffffff, .8 * fade);
          g.strokePoints(starPts(cx, cy, rr, rot, 6), true);
        }
        if (Math.random() < .5) { const x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height; sc.fx.glow(x, y, 16 * s, 0xff5a9a, 300, .7); }
      },
      end() { g.destroy(); }
    });
  },
  // 블랙홀이클립스: 하늘에 블랙홀이 열려 화면의 빛과 적을 빨아들인다
  black_hole_eclipse(p, def) {
    const sc = p.scene, s = sizeMul(p), g = sc.add.graphics().setDepth(45);
    let cx = 0, cy = 0;
    return zAction(p, def, {
      dur: 1.9, status: { curse: 8 }, hitAt: 1.25, kbx: 40, kby: -200,
      ev: [
        [.5, () => { const v = view(p); cx = p.x + p.face * 60; cy = v.y + v.height * .35; sc.cameras.main.flash(300, 30, 0, 40, true); Sfx.play('ghost'); }],
        [1.25, () => { sc.fx.glow(cx, cy, 220 * s, 0x6a5446, 600, 1); for (let k = 0; k < 6; k++) sc.time.delayedCall(k * 50, () => sc.fx.ring(cx, cy, (40 + k * 50) * s, k % 2 ? 0x9a5aff : 0x2a1a3a, 500)); }]
      ],
      update(p, a) {
        g.clear();
        if (a.t < .5 || a.t > 1.8) return;
        const grow = Math.min(1, (a.t - .5) / .45), shrink = a.t > 1.25 ? Math.max(0, 1 - (a.t - 1.25) / .3) : 1, R = 46 * s * grow * shrink;
        if (R <= 0) return;
        g.fillStyle(0x6a2aff, .25); g.fillCircle(cx, cy, R * 1.9);
        g.fillStyle(0x9a5aff, .4); g.fillCircle(cx, cy, R * 1.35);
        g.fillStyle(0x000000, 1); g.fillCircle(cx, cy, R);
        for (let i = 0; i < 3; i++) { g.lineStyle(2, i ? 0x9a5aff : 0xffe0a0, .9); g.beginPath(); g.arc(cx, cy, R * (1.1 + i * .18), a.t * (6 + i * 2), a.t * (6 + i * 2) + 2.2); g.strokePath(); }
        // 빨려 들어가는 빛 부스러기
        if (a.t < 1.25) for (let k = 0; k < 4; k++) {
          const ang = Math.random() * Math.PI * 2, d = (160 + Math.random() * 120) * s;
          sc.fx.burst(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, [0x9a5aff, 0xd8c0ff, 0x6a5446], 1, d * 1.6, { angle: ang + Math.PI, spread: .1, up: 0, grav: 0, bounce: false, life: .5, glow: true, drag: 1 });
        }
      },
      end() { g.destroy(); }
    });
  },
  // 얼티메이트드래곤번: 용의 기운이 화면을 휘감아 돌다가 내리꽂힌다
  devastating_drake(p, def) {
    const sc = p.scene, s = sizeMul(p), g = sc.add.graphics().setDepth(44).setBlendMode(ADD());
    let tx = 0, ty = 0;
    return zAction(p, def, {
      dur: 1.85, status: { stun: 1.2 }, hitAt: 1.2,
      ev: [
        [.5, () => { tx = p.x + p.face * 80; ty = groundAt(p, tx); Sfx.play('beam'); }],
        [.9, () => Sfx.play('mega')],
        [1.2, () => {
          sc.fx.glow(tx, ty - 20, 220 * s, 0x6a4aff, 700, 1);
          for (let k = 0; k < 6; k++) sc.time.delayedCall(k * 55, () => sc.fx.ring(tx, ty - 10, (60 + k * 45) * s, k % 2 ? 0xb09aff : 0xff6a3a, 520));
          sc.fx.burst(tx, ty - 6, [0x6a4aff, 0xb09aff, 0xff6a3a, 0xffffff], 90, 340 * s, { up: 200, glow: true, life: 1.1 });
        }]
      ],
      update(p, a) {
        g.clear();
        if (a.t < .5 || a.t > 1.3) return;
        const v = view(p), N = 22;
        // 머리 위치: 화면 위를 크게 한 바퀴 휘돌고(.5~.95) 목표 지점으로 급강하(.95~1.2)
        const head = t => {
          if (t < .95) { const u = (t - .5) / .45, ang = -Math.PI / 2 + u * Math.PI * 2.2 * p.face; return { x: v.centerX + Math.cos(ang) * v.width * .38, y: v.y + v.height * .38 + Math.sin(ang) * v.height * .25 }; }
          const h0 = head(.9499), u = Math.min(1, (t - .95) / .25); return { x: h0.x + (tx - h0.x) * u, y: h0.y + (ty - 20 - h0.y) * u * u };
        };
        for (let i = N - 1; i >= 0; i--) {
          const q = head(Math.max(.5, a.t - i * .014)), r = (16 - i * .55) * s;
          g.fillStyle(i % 3 ? 0x6a4aff : 0xb09aff, .85 - i / N * .5); g.fillCircle(q.x, q.y, r);
          if (i === 0) { g.fillStyle(0xff6a3a, 1); g.fillCircle(q.x, q.y, r * .45); }
        }
      },
      end() { g.destroy(); }
    });
  },
  // 초월나선연격: 강철 드릴이 되어 회전하며 화면을 꿰뚫는다
  corkscrew_crash(p, def) {
    const sc = p.scene, s = sizeMul(p), g = sc.add.graphics().setDepth(44).setBlendMode(ADD());
    return zAction(p, def, {
      dur: 1.7, ctrl: true, noGrav: true, hitAt: 1.15, kbx: 420, kby: -220,
      ev: [[.5, () => { Sfx.play('dash'); Sfx.play('crack'); }], [1.15, () => { sc.fx.shatter(p.x + p.face * 20, p.y, 40 * s, 30 * s, { n: 16, speed: 200 }); sc.fx.glow(p.x, p.y, 120 * s, 0xe0e8ff, 500, 1); }]],
      update(p, a, dt) {
        g.clear();
        const v = view(p);
        if (a.t < .5 || a.t > 1.2) { p.b.setVelocity(0, 0); p.sprite.setAngle(0); return; }
        p.b.setVelocity(p.face * 760, 0);
        if (p.x < v.x + 20 || p.x > v.right - 20) p.b.setVelocityX(0);
        p.sprite.setAngle(a.t * 2200 % 360);
        // 앞쪽 원뿔 드릴 + 나선 궤적
        const L = 60 * s, W = 22 * s, tip = p.x + p.face * L;
        g.fillStyle(0xa8b0c8, .55); g.fillTriangle(p.x, p.y - W, p.x, p.y + W, tip, p.y);
        for (let i = 0; i < 6; i++) { const u = ((a.t * 8 + i / 6) % 1), x = p.x + p.face * L * u, w = W * (1 - u); g.lineStyle(2, i % 2 ? 0xffffff : 0xffe080, .9); g.lineBetween(x, p.y - w, x + p.face * 8 * s, p.y + w); }
        a.gt = (a.gt || 0) - dt;
        if (a.gt <= 0) { a.gt = .025; sc.fx.ring(p.x - p.face * 10, p.y, 22 * s, 0xa8b0c8, 240); sc.fx.burst(p.x + p.face * L, p.y, [0xffe080, 0xffffff], 3, 160, { up: 40 }); }
      },
      end(p) { g.destroy(); p.sprite.setAngle(0); p.b.setVelocity(0, 0); }
    });
  },
  // 월즈엔드폴: 하늘에서 산만 한 바위가 떨어져 부서진다
  continental_crush(p, def) {
    const sc = p.scene, s = sizeMul(p);
    let rock = null, tx = 0, ty = 0;
    return zAction(p, def, {
      dur: 1.85, status: { stun: 1.2 }, hitAt: 1.15, kby: -320,
      ev: [
        [.5, () => {
          const v = view(p); tx = p.x + p.face * 80; ty = groundAt(p, tx);
          const R = 70 * s, pts = [];
          for (let i = 0; i < 9; i++) { const ang = i / 9 * Math.PI * 2, rr = R * (.8 + Math.random() * .3); pts.push({ x: Math.cos(ang) * rr, y: Math.sin(ang) * rr }); }
          rock = sc.add.graphics().setDepth(45).setPosition(tx, v.y - R * 1.2);
          rock.fillStyle(0x6a5a30, 1); rock.fillPoints(pts, true);
          rock.fillStyle(0xc0a050, 1); rock.fillPoints(pts.map(q => ({ x: q.x * .8 - R * .08, y: q.y * .8 - R * .1 })), true);
          rock.lineStyle(3, 0x3a2a10, 1); rock.strokePoints(pts, true);
          rock.lineStyle(2, 0x6a5a30, 1); rock.lineBetween(-R * .3, -R * .2, R * .1, R * .3); rock.lineBetween(R * .2, -R * .4, R * .4, 0);
          sc.tweens.add({ targets: rock, y: ty - R * .6, angle: p.face * 120, duration: 600, ease: 'Quad.easeIn' });
          Sfx.play('boss');
        }],
        [.8, () => sc.fx.shake(.008, 340)],
        [1.12, () => {
          if (rock) { rock.destroy(); rock = null; }
          sc.fx.shatter(tx, ty - 30 * s, 120 * s, 80 * s, { n: 30, speed: 280, up: 160, scale: 1.6 });
          for (let k = 0; k < 5; k++) sc.time.delayedCall(k * 60, () => sc.fx.ring(tx, ty - 6, (70 + k * 55) * s, k % 2 ? 0xe0d0a0 : 0xc0a050, 520));
          const v = view(p); for (let x = v.x; x < v.right; x += 26) sc.fx.burst(x, groundAt(p, x) - 2, [0xc0a050, 0x8a7030, 0xe0d0a0], 3, 140, { up: 160 });
        }]
      ],
      end() { if (rock) rock.destroy(); }
    });
  },
  // 라이징랜드오버: 지면이 파도처럼 연달아 솟구친다
  tectonic_rage(p, def) {
    const sc = p.scene, s = sizeMul(p), g = sc.add.graphics().setDepth(43);
    let ox = 0;
    return zAction(p, def, {
      dur: 1.85, status: { slow: 4 }, hitAt: 1.2, kbx: 60, kby: -480,
      ev: [[.5, () => { ox = p.x; p.squash(1.5, .5); sc.fx.burst(p.x, p.bottom, [0xd8b060, 0x6a4a20], 30, 200, { up: 120 }); Sfx.play('boom'); }], [.8, () => Sfx.play('boss')], [1.2, () => Sfx.play('crack')]],
      update(p, a) {
        g.clear();
        if (a.t < .55 || a.t > 1.75) return;
        const v = view(p), front = (a.t - .55) * v.width * 1.6, fade = a.t > 1.4 ? Math.max(0, 1 - (a.t - 1.4) / .35) : 1;
        sc.fx.shake(.006, 60);
        for (let x = v.x; x < v.right; x += 22) {
          const d = Math.abs(x - ox); if (d > front) continue;
          const gy = groundAt(p, x), h = (40 + ((x * 37) % 50)) * s * Math.min(1, (front - d) / 80) * fade;
          if (h <= 1) continue;
          g.fillStyle(0x6a4a20, 1); g.fillTriangle(x - 12 * s, gy, x + 12 * s, gy, x + ((x * 13) % 6 - 3), gy - h);
          g.fillStyle(0xd8b060, 1); g.fillTriangle(x - 7 * s, gy, x + 3 * s, gy, x + ((x * 13) % 6 - 3), gy - h);
          if (Math.random() < .05) sc.fx.burst(x, gy - h, [0xd8b060, 0x9a7a3a], 3, 100, { up: 120 });
        }
      },
      end() { g.destroy(); }
    });
  },
  // 레이징지오프리즈: 화면이 얼어붙고 얼음 기둥이 솟았다가 산산조각
  subzero_slammer(p, def) {
    const sc = p.scene, s = sizeMul(p), g = sc.add.graphics().setDepth(43).setBlendMode(ADD()), cols = [];
    return zAction(p, def, {
      dur: 1.8, status: { slow: 4, stun: 1.5 }, hitAt: 1.2,
      ev: [
        [.5, () => { const v = view(p); sc.cameras.main.flash(400, 160, 230, 255, true); for (let x = v.x + 14; x < v.right; x += 34 + Math.random() * 20) cols.push({ x, gy: groundAt(p, x), h: (50 + Math.random() * 70) * s, w: (8 + Math.random() * 6) * s }); Sfx.play('water'); }],
        [1.2, () => { for (const c of cols) sc.fx.shatter(c.x, c.gy - c.h / 2, c.w * 2, c.h, { n: 6, speed: 200, up: 120 }); cols.length = 0; g.clear(); Sfx.play('shatter'); }]
      ],
      update(p, a) {
        if (a.t < .5 || a.t > 1.2) return;
        g.clear();
        const v = view(p), k = Math.min(1, (a.t - .5) / .5);
        g.fillStyle(0x8ae8ff, .12 * k); g.fillRect(v.x, v.y, v.width, v.height);
        for (const c of cols) {
          const h = c.h * k;
          g.fillStyle(0x4ab0e0, .7); g.fillTriangle(c.x - c.w, c.gy, c.x + c.w, c.gy, c.x, c.gy - h);
          g.fillStyle(0xdff8ff, .9); g.fillTriangle(c.x - c.w * .4, c.gy, c.x + c.w * .2, c.gy, c.x, c.gy - h);
        }
        if (Math.random() < .7) sc.fx.burst(v.x + Math.random() * v.width, v.y + 4, [0xffffff, 0xdff8ff], 2, 30, { angle: Math.PI / 2, spread: .6, up: -80, grav: 60, bounce: false, life: 1.2 });
      },
      end() { g.destroy(); }
    });
  },
  // 절대포식회전참: 화면을 실로 옭아매고 고치로 감아 조인다
  savage_spin_out(p, def) {
    const sc = p.scene, s = sizeMul(p), g = sc.add.graphics().setDepth(44);
    let cx = 0, cy = 0;
    return zAction(p, def, {
      dur: 1.8, status: { root: 2.5, slow: 3 }, hitAt: 1.2, kbx: 120, kby: -200,
      ev: [
        [.5, () => { const v = view(p); cx = v.centerX; cy = v.centerY; Sfx.play('chain'); }],
        [.9, () => Sfx.play('swing')],
        [1.2, () => { sc.fx.burst(cx, cy, [0xa0c020, 0xffffff, 0xd0f060], 80, 320 * s, { glow: true, life: 1 }); for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 60, () => sc.fx.ring(cx, cy, (80 + k * 60) * s, 0xd0f060, 480)); }]
      ],
      update(p, a) {
        g.clear();
        if (a.t < .5 || a.t > 1.25) return;
        const v = view(p), k = Math.min(1, (a.t - .5) / .35), R = Math.max(v.width, v.height) * .75;
        // 거미줄: 방사형 실 + 조여 드는 나선
        g.lineStyle(1, 0xf0f8e0, .8);
        for (let i = 0; i < 16; i++) { const ang = i / 16 * Math.PI * 2; g.lineBetween(cx, cy, cx + Math.cos(ang) * R * k, cy + Math.sin(ang) * R * k); }
        const squeeze = a.t > .85 ? 1 - (a.t - .85) / .4 * .8 : 1;
        g.lineStyle(2, 0xa0c020, .9);
        for (let ring = 1; ring <= 7; ring++) {
          const rr = ring * 34 * s * k * squeeze, spin = a.t * 3 * (ring % 2 ? 1 : -1);
          g.beginPath(); for (let i = 0; i <= 16; i++) { const ang = spin + i / 16 * Math.PI * 2, x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokePath();
        }
        // 회전 베기 궤적
        if (a.t > .85) { const ang = a.t * 18; g.lineStyle(4, 0xffffff, .9); g.beginPath(); g.arc(cx, cy, 60 * s * squeeze + 20, ang, ang + 2.4); g.strokePath(); }
      },
      end() { g.destroy(); }
    });
  },
  // 러블리스타임팩트: 별빛 공간에서 별을 휘감고 반짝이는 몸통박치기
  twinkle_tackle(p, def) {
    const sc = p.scene, s = sizeMul(p), g = sc.add.graphics().setDepth(44).setBlendMode(ADD()), stars = [];
    return zAction(p, def, {
      dur: 1.75, ctrl: true, noGrav: true, hitAt: 1.15, status: { curse: 5, confuse: 1.5 },
      ev: [
        [.5, () => { const v = view(p); sc.cameras.main.flash(300, 255, 160, 230, true); for (let i = 0; i < 40; i++) stars.push({ x: v.x + Math.random() * v.width, y: v.y + Math.random() * v.height, r: (3 + Math.random() * 6) * s, ph: Math.random() * 6, c: [0xffa0e0, 0xfff0a0, 0xffffff, 0x9ad8ff][i % 4] }); Sfx.play('purify'); }],
        [.85, () => Sfx.play('dash')],
        [1.15, () => { sc.fx.burst(p.x, p.y, [0xffa0e0, 0xfff0a0, 0xffffff], 90, 320 * s, { glow: true, grav: 40, life: 1.2 }); for (let k = 0; k < 5; k++) sc.time.delayedCall(k * 50, () => sc.fx.ring(p.x, p.y, (50 + k * 45) * s, k % 2 ? 0xffa0e0 : 0xfff0a0, 460)); }]
      ],
      update(p, a, dt) {
        g.clear();
        const v = view(p);
        if (a.t >= .5 && a.t < 1.6) {
          const fade = a.t > 1.2 ? Math.max(0, 1 - (a.t - 1.2) / .4) : 1;
          g.fillStyle(0x3a1a4a, .25 * fade); g.fillRect(v.x, v.y, v.width, v.height);
          for (const st of stars) { const tw = .5 + Math.sin(a.t * 10 + st.ph) * .5; g.fillStyle(st.c, (.4 + tw * .6) * fade); g.fillPoints(starPts(st.x, st.y, st.r * (.7 + tw * .5), a.t * 2 + st.ph), true); }
          // 몸을 감싸는 별 고리
          for (let i = 0; i < 6; i++) { const ang = a.t * 8 + i / 6 * Math.PI * 2; g.fillStyle(i % 2 ? 0xfff0a0 : 0xffa0e0, fade); g.fillPoints(starPts(p.x + Math.cos(ang) * 26 * s, p.y + Math.sin(ang) * 14 * s, 6 * s, ang), true); }
        }
        if (a.t < .85 || a.t > 1.15) { p.b.setVelocity(0, 0); return; }
        p.b.setVelocity(p.face * 900, 0);
        if (p.x < v.x + 20 || p.x > v.right - 20) p.b.setVelocityX(0);
        a.gt = (a.gt || 0) - dt;
        if (a.gt <= 0) { a.gt = .02; sc.fx.ghost(p.sprite, 0xffa0e0, .6, 300); sc.fx.burst(p.x, p.y, [0xfff0a0, 0xffffff], 2, 80, { glow: true }); }
      },
      end(p) { g.destroy(); p.b.setVelocity(0, 0); }
    });
  }
};
