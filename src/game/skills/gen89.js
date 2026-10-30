// 8·9세대 스타팅 라인 스킬 구현 (흥나숭·염버니·울머기 / 나오하·뜨아거·꾸왁스)
// 각 스킬은 행동(action) 객체를 돌려준다 — 형식은 game/skills.js 와 같다:
//  { dur, mm(이동 배율), anim, ctrl(속도 직접 제어), noGrav, lockFace, guard, inv, ev:[[시각, fn]], update(p,a,dt), end(p,a) }
import Phaser from 'phaser';
import { typeColor } from '../../data/types.js';
import { Sfx } from '../../systems/Audio.js';
import { sizeMul, slashHit, shoot, lineFx, dashAction, view, groundAt } from '../skillKit.js';

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// 플레이어 발밑이 풀 장판(씨뿌리기·잔디 등 플레이어의 풀 타입 장판) 위인지
const onGrass = p => { const b = p.bounds(), feet = { x: b.x, y: b.y + b.h - 4, w: b.w, h: 10 }; return p.scene.combat.zones.some(z => z.owner === 'player' && z.type === 'grass' && z.t >= z.delay && overlap(z, feet)); };

// 적 옆(side 쪽)으로 발 높이를 맞춰 순간이동하고 적을 바라본다. 그쪽이 벽이면 반대편
function blinkBeside(p, e, side) {
  const sc = p.scene, off = e.b.width / 2 + p.b.width / 2 + 3;
  let x = e.x + side * off;
  if (sc.isSolidAt(x, e.y) || sc.isSolidAt(x, e.bottom - 4)) x = e.x - side * off;
  p.b.reset(x, e.bottom - p.b.height / 2 - 1);
  p.face = Math.sign(e.x - x) || p.face; p.refacing();
}

const songStacks = new WeakMap();   // 플레어송 공격 버프 중첩: 플레이어 → 만료 시각 목록

export const SKILL_IMPL = {
  // ===== 흥나숭 =====
  branch_poke(p, i) {
    const m = p.mega.active;
    if (i < 2) return {
      dur: .22, ctrl: true, anim: 'Attack',
      update(p, a) { p.b.setVelocityX(a.t < .08 ? p.face * 120 : p.b.velocity.x * .75); },
      ev: [[.07, () => {
        const s = sizeMul(p), reach = (m ? 48 : 34) * s, y = p.y - 2 + (i ? 3 : -3);
        p.scene.combat.hitRect({ x: p.face > 0 ? p.x : p.x - reach, y: y - 5 * s, w: reach, h: 10 * s }, 1, 'grass', { kbx: 110, kby: -50 });
        lineFx(p.scene, p.x + p.face * 4, y, p.x + p.face * reach, y, 0xc89a5a, { seg: 3, jag: 1, w: 3, ms: 110 });
        p.scene.fx.burst(p.x + p.face * reach, y, [0x8aff6a, 0xc89a5a], 4, 60, { angle: p.face > 0 ? 0 : Math.PI, spread: .8 });
        Sfx.play('swing'); p.squash(1.15, .9);
      }]]
    };
    return {
      dur: .36, mm: .15, anim: 'Strike', ev: [
        [.05, () => p.squash(.85, 1.2)],
        [.15, () => {
          const s = sizeMul(p), sc = p.scene, x = p.x + p.face * 18 * s, gy = groundAt(p, x);
          sc.combat.hitRect({ x: x - 16 * s, y: p.y - 22 * s, w: 32 * s, h: 22 * s + Math.max(0, gy - p.y) }, 1.7, 'grass', { stun: .35, kbx: 90, kby: -220, hs: 80 });
          sc.fx.slash(x, p.y - 4, 16 * s, p.face, 0xc89a5a, { flipV: true, thick: 7 });
          sc.fx.burst(x, gy - 2, [0xc0a070, 0x8aff6a], 12, 120, { up: 90 });
          sc.fx.ring(x, gy - 4, 20 * s, 0x5ed04a, 220); sc.fx.shake(.008, 140);
          // 메가: 내려찍은 충격이 양옆 땅을 타고 뿌리로 솟는다
          if (m) for (const d of [-1, 1]) { const wx = x + d * 30 * s; sc.combat.hitRect({ x: wx - 22 * s, y: gy - 14 * s, w: 44 * s, h: 14 * s }, .8, 'grass', { root: .8, kbx: 60, kby: -160 }); sc.fx.burst(wx, gy - 2, [0x5ed04a, 0xc8ffb0], 8, 100, { up: 120 }); lineFx(sc, wx, gy, wx + d * 4, gy - 18 * s, 0x6ad04a, { seg: 4, jag: 4, w: 2, ms: 260 }); }
          Sfx.play('punch'); p.squash(1.3, .78);
        }]
      ]
    };
  },
  drum_beating(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), beats = [.22, .44, .66, .88];
    let drum = null;
    // 박자마다 뿌리가 한 칸씩 멀리 솟는다
    const beat = k => {
      const last = k === beats.length - 1, dx = drum ? drum.x : p.x;
      if (drum) sc.tweens.add({ targets: drum, scaleY: .7, duration: 50, yoyo: true });
      sc.fx.ring(dx, p.bottom - 8, (last ? 26 : 18) * s, 0xc89a5a, 200); Sfx.play('punch'); p.squash(1.18, .86);
      for (const d of m ? [1, -1] : [1]) {
        const x = p.x + p.face * d * (34 + k * 26) * s, gy = groundAt(p, x), w = (last ? 30 : 22) * s, h = (last ? 46 : 34) * s;
        sc.combat.spawnZone({
          x: x - w / 2, y: gy - h, w, h, delay: .06, life: .4, tick: 9, draw: 'pillar', type: 'grass', color: 0x5ed04a,
          onTick: z => sc.combat.hitRect(z, last ? 1 : .6, 'grass', Object.assign({ slow: 2.5, kbx: 40, kby: -200, hs: 30, fromX: x }, m && last ? { root: 1.2 } : {}))
        });
        for (let j = 0; j < 4; j++) { const rx = x + (Math.random() - .5) * w; lineFx(sc, rx, gy, rx + (Math.random() - .5) * 8, gy - h * (.6 + Math.random() * .4), 0x6ad04a, { seg: 5, jag: 5, w: 2, ms: 360 }); }
        sc.fx.burst(x, gy - 2, [0xc0a070, 0x5ed04a], 8, 90, { up: 110 });
      }
      if (last) sc.fx.shake(.008, 140);
    };
    return {
      dur: 1.05, mm: 0, anim: 'Attack', lockFace: true,
      ev: [
        [.06, () => {
          // 그루터기 드럼 (아래쪽 기준으로 그려 두드릴 때 납작해진다)
          const x = p.x + p.face * 12 * s;
          drum = sc.add.graphics().setDepth(21).setPosition(x, p.bottom);
          drum.fillStyle(0x7a4a22, 1); drum.fillRect(-9 * s, -14 * s, 18 * s, 14 * s);
          drum.fillStyle(0xc89a5a, 1); drum.fillRect(-9 * s, -16 * s, 18 * s, 3 * s);
          drum.fillStyle(0x5ed04a, 1); drum.fillRect(-9 * s, -8 * s, 18 * s, 2 * s);
          sc.fx.burst(x, p.bottom - 8, [0x5ed04a, 0xc8ffb0], 10, 70, { glow: true }); Sfx.play('leaf');
        }],
        ...beats.map((t, k) => [t, () => beat(k)])
      ],
      end() { if (drum) { const d = drum; drum = null; sc.tweens.add({ targets: d, alpha: 0, duration: 200, onComplete: () => d.destroy() }); } }
    };
  },
  grassy_glide(p) {
    const m = p.mega.active, sc = p.scene, boost = onGrass(p), x0 = p.x;
    // 지나간 길에 잔디 장판이 깔린다 (돌진하는 동안 길이가 늘어난다)
    const carpet = sc.combat.spawnZone({
      x: x0, y: p.bottom - 8, w: 1, h: 8, life: m ? 6 : 3.5, tick: .5, draw: 'seed', type: 'grass', color: 0x6ad04a,
      onTick: z => {
        for (const e of sc.combat.enemiesIn({ x: z.x, y: z.y - 16, w: z.w, h: z.h + 16 })) sc.combat.damageEnemy(e, p.atk * .2, 'grass', { dot: 'seed', slow: 1 });
        if (m && overlap(p.bounds(), { x: z.x, y: z.y - 6, w: z.w, h: z.h + 6 })) p.heal(p.m.maxhp * .012, true);
      }
    });
    if (boost) sc.fx.floatText(p.x, p.b.y - 12, '잔디 가속!', '#8aff6a', 10);
    Sfx.play('dash'); Sfx.play('leaf');
    return dashAction(p, {
      dur: boost ? .36 : .3, vx: boost ? 470 : 330, mul: boost ? 2.2 : 1.6, type: 'grass', color: 0x6ad04a, anim: 'Walk', kbx: 200,
      tick(p) {
        const l = Math.min(x0, p.x), r = Math.max(x0, p.x); carpet.x = l; carpet.w = Math.max(1, r - l);
        sc.fx.burst(p.x - p.face * 6, p.bottom - 2, [0x5ed04a, 0xc8ffb0], 1, 60, { up: 50, angle: p.face > 0 ? Math.PI : 0, spread: .6 });
      },
      end(p) { if (boost) p.speedBuff = 2; }
    });
  },

  // ===== 염버니 =====
  agile_kick(p, i) {
    const m = p.mega.active, sc = p.scene;
    if (i < 2) return {
      dur: .18, mm: .5, anim: 'Attack', ev: [
        [.05, () => slashHit(p, { fwd: 13, w: 22, h: 14, oy: 3, mul: .9, type: 'fighting', kbx: 100, color: 0xffd0a0, flipV: i === 1, arc: 11 })],
        // 메가: 반대쪽 발로 불꽃 추가타
        ...(m ? [[.11, () => slashHit(p, { fwd: 15, w: 22, h: 14, oy: -4, mul: .5, type: 'fire', status: { burn: 1.5 }, kbx: 140, color: 0xff7a2a, flipV: i !== 1, arc: 11 })]] : [])
      ]
    };
    const set = new Set();
    return {
      dur: .34, ctrl: true, noGrav: true, anim: 'Attack',
      ev: [[0, () => { Sfx.play('swing'); Sfx.play('fire'); }]],
      update(p, a, dt) {
        const s = sizeMul(p), b = p.b;
        if (a.t < .24) {
          b.setVelocity(p.face * 360, a.t < .07 ? -110 : 70);
          sc.combat.hitRect({ x: b.x - 6 * s, y: b.y - 4 * s, w: b.width + 12 * s, h: b.height + 8 * s }, 1.6, 'fire', { set, burn: 2.5, kbx: 240, kby: -160, hs: 70 });
          sc.fx.embers(p.x - p.face * 4, p.y + 4, [0xff7a2a, 0xffd04a], 2, { speed: 40 });
          a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .03; sc.fx.ghost(p.sprite, 0xff7a2a, .5, 200); }
        } else b.setVelocityX(b.velocity.x * .8);
      },
      end(p) {
        p.b.setVelocityX(p.b.velocity.x * .3);
        if (m) { const s = sizeMul(p), x = p.x + p.face * 10 * s; sc.combat.hitCircle(x, p.y, 30 * s, 1, 'fire', { burn: 2, kbx: 200, kby: -180 }); sc.fx.ring(x, p.y, 30 * s, 0xffd04a, 240); sc.fx.burst(x, p.y, [0xff7a2a, 0xffd04a, 0xffffff], 16, 160, { glow: true }); Sfx.play('boom'); }
      }
    };
  },
  pyro_ball(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), maxB = m ? 3 : 1;
    let ball = null;
    // 땅에 떨어지면 폭발하며 튕겨 오른다 (같은 적은 다시 관통 피해를 받지 않는다)
    const bounce = q => {
      const n = (q.bounces || 0) + 1;
      if (n > maxB || q.life <= 0 || q.vy < 40 || !sc.isSolidAt(q.x, q.y)) return;
      const gy = sc.groundBelow(q.x, q.y - 20), r = (m ? 34 : 26) * s;
      sc.combat.hitCircle(q.x, gy - 8, r, 1.2, 'fire', { burn: 3, kbx: 160, kby: -220 });
      sc.fx.ring(q.x, gy - 8, r, 0xffd04a, 240); sc.fx.glow(q.x, gy - 8, r, 0xff5a1a, 240, .9);
      sc.fx.burst(q.x, gy - 4, [0xff7a2a, 0xffd04a, 0xffffff], 16, 160, { up: 120, glow: true });
      sc.fx.shake(.008, 140); Sfx.play('boom');
      if (m) sc.combat.spawnZone({ x: q.x - 18 * s, y: gy - 12, w: 36 * s, h: 12, life: 2.5, tick: .35, draw: 'fire', type: 'fire', onTick: z => sc.combat.hitRect(z, .25, 'fire', { burn: 2, kbx: 0, kby: 0, hs: 0 }) });
      const nq = sc.combat.spawnProjectile({ owner: 'player', x: q.x, y: gy - q.r - 2, vx: q.vx * .9, vy: -250, r: q.r, mul: q.mul, type: 'fire', kind: 'fire', life: 1.4, pierce: 99, grav: 420, status: q.status, kb: q.kb, light: true, hit: q.hit, onExpire: bounce });
      nq.bounces = n;
    };
    return {
      dur: .72, mm: 0, anim: 'Strike', lockFace: true,
      update(p, a) {
        if (!ball) return;
        const hot = a.t > .24;
        ball.setTint(hot ? 0xff7a2a : 0xc0a070).setScale((.25 + Math.min(1, a.t / .45) * .35) * s);
        if (hot) sc.fx.embers(ball.x, ball.y, [0xff7a2a, 0xffd04a], 1, { speed: 20 });
      },
      ev: [
        [.02, () => {
          // 돌멩이를 발등으로 두 번 튕기며 불을 붙인다
          ball = sc.add.image(p.x + p.face * 6, p.bottom - 4, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(32);
          sc.tweens.add({ targets: ball, y: p.y - 22 * s, duration: 110, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
        }],
        [.13, () => Sfx.play('swing')], [.35, () => { Sfx.play('fire'); if (ball) sc.fx.glow(ball.x, ball.y, 14 * s, 0xff7a2a, 160, .9); }],
        [.46, () => {
          if (ball) { ball.destroy(); ball = null; }
          shoot(p, { speed: 330, vy: -70, grav: 420, r: m ? 9 : 7, mul: 2.2, type: 'fire', kind: 'fire', life: 1.6, pierce: 99, status: { burn: 3 }, kb: 200, light: true, onExpire: bounce });
          sc.fx.glow(p.x + p.face * 12, p.y + 2, 30 * s, 0xff7a2a, 200, 1);
          sc.fx.burst(p.x + p.face * 12, p.y + 2, [0xff7a2a, 0xffd04a, 0xffffff], 14, 140, { glow: true });
          sc.fx.shake(.008, 120); Sfx.play('fire'); Sfx.play('punch'); p.squash(1.3, .8);
        }]
      ],
      end() { if (ball) { ball.destroy(); ball = null; } }
    };
  },
  court_change(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p);
    return {
      dur: .4, mm: 0, anim: 'Strike', inv: .5, lockFace: true, ev: [[.04, () => {
        const e = sc.combat.nearest(p.x, p.y, 1, 220)[0];
        sc.fx.ghost(p.sprite, 0xff7a2a, .7, 320);
        if (!e) { sc.fx.burst(p.x, p.bottom - 2, [0xff7a2a, 0xffd04a], 8, 70, { up: 60 }); Sfx.play('swing'); return; }
        const ox = p.x, oy = p.y, ob = p.bottom;
        lineFx(sc, ox, oy, e.x, e.y, 0xffd04a, { seg: 6, jag: 10, w: 2, ms: 220 });
        sc.fx.ring(ox, oy, 18 * s, 0xff7a2a, 220); sc.fx.ring(e.x, e.y, 18 * s, 0xff7a2a, 220);
        // 보스는 옮길 수 없으니 등 뒤로, 일반 적은 서로 자리 교환
        const ey = ob - e.b.height / 2 - 1;
        if (e.boss || sc.isSolidAt(ox, ey)) blinkBeside(p, e, Math.sign(e.x - ox) || p.face);
        else { const ex = e.x, eb = e.bottom; e.b.reset(ox, ey); p.b.reset(ex, eb - p.b.height / 2 - 1); p.face = Math.sign(e.x - p.x) || p.face; p.refacing(); }
        sc.combat.damageEnemy(e, p.atk * 2.2, 'normal', { stun: .9, kb: p.face * 80, kby: -80, hs: 90, hx: e.x, hy: e.y });
        sc.fx.glow(p.x, p.y, 24 * s, 0xffd04a, 220, 1); p.flash(80);
        Sfx.play('swap'); Sfx.play('punch');
        // 메가: 떠나온 자리(이제 적이 서 있는 곳)가 폭발한다
        if (m) sc.time.delayedCall(120, () => {
          const r = 34 * s;
          sc.combat.hitCircle(ox, oy, r, 1.4, 'fire', { burn: 3, kbx: 200, kby: -220 });
          sc.fx.ring(ox, oy, r, 0xffd04a, 260); sc.fx.glow(ox, oy, r, 0xff5a1a, 260, 1);
          sc.fx.burst(ox, oy, [0xff7a2a, 0xffd04a, 0xffffff], 22, 180, { glow: true });
          sc.fx.shake(.01, 160); Sfx.play('boom');
        });
      }]]
    };
  },

  // ===== 울머기 =====
  pound_water(p, i) {
    // 스파이답게 손끝으로 물방울 탄을 빠르게 쏜다 (꾹 눌렀다 떼면 저격탄 — game/Signature.js)
    if (i < 2) return { dur: .17, mm: .5, anim: 'Shoot', noTierFx: true, ev: [[.04, () => { shoot(p, { speed: 560, r: 2.5 + p.tierIdx * .5, mul: .85, type: 'water', kind: 'water', life: .5, kb: 90, stream: true, oy: i ? -5 : -2, status: { crit: .15 } }); Sfx.play('water'); }]] };
    const m = p.mega.active, sc = p.scene;
    // 메가: 관통하며 맞은 자리마다 물보라
    const splash = (e, q) => {
      sc.combat.damageEnemy(e, q.dmg, 'water', { kb: Math.sign(q.vx || 1) * 200, kby: -60, hx: q.x, hy: q.y });
      const r = 22 * sizeMul(p);
      sc.combat.hitCircle(q.x, q.y, r, .4, 'water', { slow: 1.5, kbx: 60, kby: -40, hs: 0 });
      sc.fx.ring(q.x, q.y, r, 0xbfe6ff, 200); sc.fx.burst(q.x, q.y, [0x4a9cff, 0xffffff], 8, 100, { up: 60 });
    };
    return { dur: .26, mm: .4, anim: 'Shoot', ev: [[.07, () => { shoot(p, { speed: 360, r: 4, mul: 1.6, type: 'water', kind: 'water', life: .7, kb: 200, pierce: m ? 3 : 1, onHit: m ? splash : undefined }); Sfx.play('water'); }]] };
  },
  snipe_shot(p) {
    const m = p.mega.active, sc = p.scene, v = view(p), g = sc.add.graphics().setDepth(43).setBlendMode(Phaser.BlendModes.ADD);
    // 표적: 화면 안 보스 → 가장 먼 적
    const score = e => (e.boss ? 1e4 : 0) + Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * .5;
    const tgt = sc.enemies.filter(e => e.alive && !e.intangible && e.x > v.x && e.x < v.right && e.y > v.y && e.y < v.bottom).sort((a, b) => score(b) - score(a))[0] || null;
    if (tgt) { p.face = Math.sign(tgt.x - p.x) || p.face; p.refacing(); }
    const aim = () => tgt && tgt.alive ? { x: tgt.x, y: tgt.y } : { x: p.x + p.face * 300, y: p.y - 3 };
    const fire = (mul, crit) => {
      const t = aim(), ang = Math.atan2(t.y - (p.y - 3), Math.abs(t.x - p.x) || 1), L = 640;
      shoot(p, { speed: 950, angle: ang, r: 3, mul, type: 'water', kind: 'water', life: .66, pierce: 99, kb: 260, status: { crit, hs: 90 }, color: 0x8ad0ff, light: true });
      lineFx(sc, p.x + p.face * 10, p.y - 3, p.x + p.face * Math.cos(ang) * L, p.y - 3 + Math.sin(ang) * L, 0xbfe6ff, { seg: 2, jag: 0, w: 1, ms: 180 });
      sc.fx.glow(p.x + p.face * 10, p.y - 3, 16, 0x8ad0ff, 160, 1); sc.fx.ring(p.x + p.face * 10, p.y - 3, 14, 0xffffff, 160);
      p.b.setVelocityX(-p.face * 110); sc.fx.shake(.006, 100);
      Sfx.play('water'); Sfx.play('crack');
    };
    return {
      dur: m ? .8 : .6, mm: 0, anim: 'Shoot', lockFace: true,
      update(p, a) {
        g.clear();
        if (a.t > .34) return;
        const t = aim();
        g.lineStyle(1, 0x8ad0ff, Math.floor(a.t * 30) % 2 ? .9 : .35); g.lineBetween(p.x + p.face * 8, p.y - 3, t.x, t.y);
        if (tgt && tgt.alive) { g.lineStyle(1, 0xffffff, .9); g.strokeCircle(t.x, t.y, Math.max(3, 12 - a.t * 26)); }
      },
      ev: [[0, () => Sfx.play('select')], [.36, () => fire(3, m ? .6 : .45)], ...(m ? [[.6, () => fire(1.8, .6)]] : [])],
      end() { g.destroy(); }
    };
  },
  camouflage(p) {
    const m = p.mega.active, sc = p.scene, dur = m ? 4.5 : 3, mem = p.m;
    const cast = {
      dur: .3, mm: .2, anim: 'Idle', tintFill: 0x9ad8ff, ev: [[.22, () => {
        sc.fx.burst(p.x, p.y, [0x4a9cff, 0xbfe6ff, 0xffffff], 16, 90, { glow: true });
        sc.fx.ring(p.x, p.y, 22 * sizeMul(p), 0x9ad8ff, 260); Sfx.play('water');
        p.intangible = true; p.sprite.setAlpha(.2);
        p.addBuff({ speed: m ? 1.3 : 1.15, t: dur, color: 0x4a9cff });
        // 숨은 동안: 시간이 다 되거나 · 교대하거나 · 공격 스킬을 쓰면 해제. 공격으로 풀리면 그 일격이 강해진다
        const t0 = sc.time.now;
        const loop = sc.time.addEvent({
          delay: 16, loop: true, callback: () => {
            const a = p.action, el = (sc.time.now - t0) / 1000, strike = !!a && a !== cast && (a.slot === 'z' || a.slot === 'x' || a.slot === 'c');
            if (p.m !== mem || !mem.alive || el >= dur || strike) {
              loop.remove(); p.intangible = false; p.sprite.setAlpha(1);
              sc.fx.burst(p.x, p.y, [0x4a9cff, 0xbfe6ff], 10, 80);
              if (strike && p.m === mem) { p.addBuff({ atk: m ? 2 : 1.6, t: .6, color: 0xbfe6ff }); sc.fx.floatText(p.x, p.b.y - 12, '기습!', '#9ad8ff', 11); Sfx.play('crit'); }
              return;
            }
            p.sprite.setAlpha(.16 + Math.sin(el * 9) * .06);
            if (Math.random() < .15) sc.fx.burst(p.x + (Math.random() - .5) * 14, p.y + (Math.random() - .5) * 14, 0xbfe6ff, 1, 10, { grav: 0, bounce: false, life: .3 });
          }
        });
      }]]
    };
    return cast;
  },

  // ===== 나오하 =====
  scratch_leaf(p, i) {
    if (i < 2) return { dur: .2, mm: .4, anim: 'Attack', ev: [[.06, () => slashHit(p, { fwd: 12, w: 22, h: 18, mul: 1, type: 'normal', color: 0xe8ffd8, flipV: i === 1 })]] };
    const m = p.mega.active;
    return { dur: .28, mm: .35, anim: 'Shoot', ev: [[.07, () => { shoot(p, { speed: 280, r: 4, mul: .6, type: 'grass', kind: 'leaf', life: .5, count: m ? 4 : 3, spread: .2, homing: m ? .5 : 0, kb: 80 }); Sfx.play('leaf'); }]] };
  },
  flower_trick(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p);
    const bloom = q => {
      sc.fx.burst(q.x, q.y, [0xff8ad0, 0xffd0f0, 0xfff6a0, 0x7aff6a], 24, 150, { up: 90, glow: true, life: .9 });
      // 메가: 꽃잎이 흩어져 주변 적을 쫓는다
      if (m) for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * .5; sc.combat.spawnProjectile({ owner: 'player', x: q.x, y: q.y - 4, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, r: 3 * s, mul: .3, type: 'grass', kind: 'leaf', life: .9, homing: .8, color: 0xff8ad0, status: { crit: 1 }, kb: 60 }); }
    };
    return {
      dur: .34, mm: .35, anim: 'Shoot', ev: [[.1, () => {
        shoot(p, { speed: 210, vy: -150, grav: 420, r: 5, mul: 0, type: 'grass', kind: 'leaf', life: 1.6, color: 0xff8ad0, status: { crit: 1 }, boom: { r: m ? 48 : 34, mul: 2.4, kb: 180 }, onExpire: bloom });   // 반드시 급소
        Sfx.play('leaf');
      }]]
    };
  },
  sucker_punch(p) {
    const m = p.mega.active, sc = p.scene;
    let prev = null;
    const blink = () => {
      const e = sc.combat.nearest(p.x, p.y, 3, 230).find(t => t !== prev);
      sc.fx.ghost(p.sprite, 0x6a5446, .8, 300);
      if (!e) { p.b.setVelocityX(p.face * 200); return; }
      blinkBeside(p, e, Math.sign(e.x - p.x) || p.face); prev = e;
      sc.fx.glow(p.x, p.y, 20, 0x3a2a4a, 200, .9); Sfx.play('dash');
    };
    const hit = mul => { slashHit(p, { fwd: 12, w: 26, h: 22, mul, type: 'dark', crit: .25, status: { stun: .4, hs: 90 }, kbx: 220, color: 0xb08aff, arc: 16, thick: 6 }); Sfx.play('punch'); p.squash(1.25, .82); };
    return {
      dur: m ? .46 : .3, mm: 0, anim: 'Strike', inv: m ? .5 : .35, lockFace: true,
      ev: [[.02, blink], [.1, () => hit(2.6)], ...(m ? [[.22, blink], [.3, () => hit(1.8)]] : [])]
    };
  },

  // ===== 뜨아거 =====
  incinerate(p, i) {
    const m = p.mega.active, sc = p.scene, col = m ? 0xb07aff : undefined;
    if (i < 2) return { dur: .2, mm: .45, anim: 'Shoot', ev: [[.06, () => { shoot(p, { speed: 250, vy: -70, grav: 300, r: 3, mul: .85, type: 'fire', kind: 'fire', life: .7, status: { burn: 1.5 }, color: col, kb: 60 }); Sfx.play('fire'); }]] };
    // 메가: 큰 불덩이가 터진 자리에 저주 불길
    const pool = q => {
      const gy = sc.groundBelow(q.x, q.y - 20), w = 40 * sizeMul(p);
      sc.combat.spawnZone({ x: q.x - w / 2, y: gy - 12, w, h: 12, life: 2.5, tick: .35, draw: 'fire', type: 'fire', color: 0xb07aff, onTick: z => sc.combat.hitRect(z, .25, 'fire', { burn: 2, curse: 3, kbx: 0, kby: 0, hs: 0 }) });
    };
    return { dur: .3, mm: .4, anim: 'Shoot', ev: [[.08, () => { shoot(p, { speed: 230, vy: -110, grav: 360, r: 6, mul: 0, type: 'fire', kind: 'fire', life: 1, status: { burn: 3 }, color: col, light: true, boom: { r: 26, mul: 1.6, kb: 180 }, onExpire: m ? pool : undefined }); Sfx.play('fire'); p.squash(.8, 1.2); }]] };
  },
  torch_song(p) {
    const m = p.mega.active, sc = p.scene, n = m ? 7 : 5, ev = [];
    // 위에서 앞으로 쓸어내리는 부채꼴로 음표를 날린다
    for (let k = 0; k < n; k++) ev.push([.1 + k * .1, () => {
      const ang = -.7 + k / (n - 1) * .9;
      shoot(p, { speed: 170, angle: ang, r: 4, mul: .6, type: 'fire', kind: 'fire', life: 1.1, pierce: 2, homing: .3, status: { burn: 2 }, color: k % 2 ? 0xffd04a : 0xff7a2a, oy: -8, kb: 60 });
      sc.fx.ring(p.x + p.face * 8, p.y - 8, 8, 0xffd04a, 160);
      Sfx.play(k % 2 ? 'select' : 'pickup'); p.squash(k % 2 ? 1.08 : .94, k % 2 ? .94 : 1.08);
    }]);
    // 노래가 끝나면 공격 버프 한 겹 (상한까지)
    ev.push([.12 + n * .1, () => {
      const now = sc.time.now, list = (songStacks.get(p) || []).filter(t => t > now), cap = m ? 5 : 3;
      if (list.length < cap) { list.push(now + 8000); p.addBuff({ atk: 1.1, t: 8, color: 0xff7a2a }); }
      songStacks.set(p, list);
      sc.fx.floatText(p.x, p.b.y - 12, `공격 업 ${list.length}단`, '#ffb070', 10);
      sc.fx.glow(p.x, p.y, 30, typeColor('fire'), 300, .8); Sfx.play('wave');
    }]);
    return { dur: .25 + n * .1, mm: .5, anim: 'Shoot', ev };
  },
  will_o_wisp(p) {
    const m = p.mega.active, sc = p.scene, n = m ? 5 : 3, life = m ? 6 : 5, mem = p.m;
    return {
      dur: .35, mm: .3, anim: 'Shoot', ev: [[.15, () => {
        const s = sizeMul(p), R = (m ? 34 : 26) * s, orbs = [];
        for (let k = 0; k < n; k++) orbs.push({
          glow: sc.add.image(p.x, p.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7a8aff).setScale(.55 * s).setDepth(32),
          core: sc.add.image(p.x, p.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xe0e8ff).setScale(.2 * s).setDepth(33),
          set: new Set(), cd: 0, tk: 0
        });
        sc.fx.ring(p.x, p.y, R, 0x7a8aff, 280); Sfx.play('ghost');
        // 몸 주위를 도는 혼불: 같은 적은 0.45초마다 한 번씩만 데운다. 교대·기절하면 사라진다
        const t0 = sc.time.now;
        let last = t0;
        const loop = sc.time.addEvent({
          delay: 16, loop: true, callback: () => {
            const now = sc.time.now, el = (now - t0) / 1000, dt = (now - last) / 1000; last = now;
            if (el >= life || p.m !== mem || !mem.alive) {
              loop.remove();
              for (const o of orbs) { sc.fx.burst(o.glow.x, o.glow.y, [0x7a8aff, 0xffffff], 6, 60, { glow: true }); o.glow.destroy(); o.core.destroy(); }
              return;
            }
            for (let k = 0; k < n; k++) {
              const o = orbs[k], ang = el * 4 + k / n * Math.PI * 2, x = p.x + Math.cos(ang) * R, y = p.y - 2 + Math.sin(ang) * R * .65, fl = 1 + Math.sin(now / 60 + k) * .12;
              o.glow.setPosition(x, y).setScale(.55 * s * fl); o.core.setPosition(x, y);
              o.cd -= dt; if (o.cd <= 0) { o.cd = .45; o.set.clear(); }
              o.tk -= dt;
              if (o.tk <= 0) {
                o.tk = .06;
                if (sc.combat.hitCircle(x, y, 7 * s, .35, 'fire', { set: o.set, burn: 3, kbx: 60, kby: -60, hs: 0 })) sc.fx.ring(x, y, 12, 0x7a8aff, 160);
                if (m) sc.combat.clearEnemyProjectiles({ x: x - 7 * s, y: y - 7 * s, w: 14 * s, h: 14 * s });
              }
              if (Math.random() < .3) sc.fx.embers(x, y, [0x7a8aff, 0xc0c8ff], 1, { speed: 14, life: .4 });
            }
          }
        });
      }]]
    };
  },

  // ===== 꾸왁스 =====
  quick_peck(p, i) {
    const m = p.mega.active, sc = p.scene;
    const drop = () => { if (m) shoot(p, { speed: 300, r: 3, mul: .4, type: 'water', kind: 'water', life: .3, kb: 60 }); };   // 메가: 물방울 탄
    if (i < 2) return { dur: .17, mm: .5, anim: 'Attack', ev: [[.05, () => { slashHit(p, { fwd: 14, w: 20, h: 12, oy: i ? 1 : -5, mul: .9, type: 'flying', kbx: 90, color: 0xd8f0ff, flipV: i === 1, arc: 10, thick: 3 }); drop(); }]] };
    return {
      dur: .32, ctrl: true, anim: 'Strike',
      update(p, a) { p.b.setVelocityX(a.t < .12 ? p.face * 280 : p.b.velocity.x * .78); },
      ev: [[.1, () => {
        slashHit(p, { fwd: 16, w: 26, h: 16, mul: 1.7, type: 'flying', crit: .25, kbx: 240, color: 0xffffff, arc: 15, thick: 5 });
        sc.fx.burst(p.x + p.face * 18, p.y, [0x4a9cff, 0xbfe6ff, 0xffffff], 8, 100);
        Sfx.play('punch'); drop();
      }]]
    };
  },
  aqua_step(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), dir = p.face, steps = [.08, .22, .36, .52];
    // 발차기마다 몸을 휙 돌리지만(춤) 나아가는 방향은 그대로
    const kick = k => {
      const last = k === steps.length - 1, r = (last ? 30 : 22) * s, x = p.x + dir * 8 * s;
      sc.combat.hitCircle(x, p.y, r, last ? 1.2 : .8, 'water', { kbx: last ? 240 : 100, kby: last ? -200 : -90, hs: 30 });
      sc.fx.ring(x, p.y, r, 0x4a9cff, 200); sc.fx.burst(x, p.bottom - 2, [0x4a9cff, 0xbfe6ff, 0xffffff], 10, 120, { up: 100 });
      if (m) sc.combat.spawnProjectile({ owner: 'player', x: p.x + dir * 10, y: p.y, vx: dir * 320, vy: 0, r: 5 * s, mul: .4, type: 'water', kind: 'wave', life: .35, pierce: 99, kb: 120 });
      p.face = last ? dir : (k % 2 ? dir : -dir); p.refacing(); p.squash(last ? 1.3 : 1.15, last ? .8 : .88);
      Sfx.play(last ? 'water' : 'swing');
    };
    return {
      dur: .62, ctrl: true, anim: 'Attack', lockFace: true,
      update(p, a, dt) {
        p.b.setVelocityX(dir * (a.t < .56 ? 220 : 60));
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .04; sc.fx.ghost(p.sprite, 0x4a9cff, .45, 200); }
      },
      ev: steps.map((t, k) => [t, () => kick(k)]),
      end(p, a) {
        p.face = dir; p.refacing(); p.b.setVelocityX(p.b.velocity.x * .4);
        if (a.t < .5) return;   // 끝까지 춰야 버프
        p.addBuff(Object.assign({ speed: 1.3, t: m ? 5 : 4, color: 0x4a9cff }, m ? { atk: 1.15 } : {}));
        sc.fx.floatText(p.x, p.b.y - 12, m ? '스피드·공격 업!' : '스피드 업!', '#8ad0ff', 10); Sfx.play('wave');
      }
    };
  },
  drain_punch(p) {
    const m = p.mega.active, sc = p.scene;
    return {
      dur: .55, mm: 0, anim: 'Strike', lockFace: true,
      // 기를 모으는 동안 초록 빛이 주먹으로 빨려 든다
      update(p, a) { if (a.t < .22 && Math.random() < .6) { const ang = Math.random() * Math.PI * 2; sc.fx.burst(p.x + Math.cos(ang) * 26, p.y + Math.sin(ang) * 26, 0x7aff8a, 1, 70, { angle: ang + Math.PI, spread: .1, up: 0, grav: 0, bounce: false, glow: true, life: .3 }); } },
      ev: [[.24, () => {
        const s = sizeMul(p), w = (m ? 44 : 30) * s, h = (m ? 34 : 24) * s, cx = p.x + p.face * 16 * s, rect = { x: cx - w / 2, y: p.y - 2 - h / 2, w, h };
        let sum = 0;
        for (const e of sc.combat.enemiesIn(rect)) {
          const d = sc.combat.damageEnemy(e, p.atk * 3.2, 'fighting', { kb: p.face * 300, kby: -160, hs: 110, hx: e.x, hy: e.y });
          if (d) { sum += d; lineFx(sc, e.x, e.y, p.x, p.y, 0x7aff8a, { seg: 5, jag: 6, w: 2, ms: 300 }); }
        }
        if (sc.props) sc.props.hitRect(rect);
        sc.fx.slash(cx, p.y - 2, 16 * s, p.face, 0xd04a3a, { thick: 7 });
        sc.fx.glow(cx, p.y, 26 * s, 0xd04a3a, 220, 1); sc.fx.ring(cx, p.y, 24 * s, 0x7aff8a, 260);
        sc.fx.shake(.01, 160); Sfx.play('punch'); p.squash(1.3, .8);
        if (sum > 0) { p.heal(sum * (m ? .75 : .5)); sc.fx.glow(p.x, p.y, 24, 0x7aff8a, 300, .8); Sfx.play('heal'); }
      }]]
    };
  }
};
