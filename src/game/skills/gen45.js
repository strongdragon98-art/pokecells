// 4·5세대 스타팅 스킬 구현 (모부기 · 불꽃숭이 · 팽도리 · 주리비얀 · 뚜꾸리 · 수댕이)
// 각 스킬은 행동(action) 객체를 돌려준다:
//  { dur, mm(이동 배율), anim, ctrl(속도 직접 제어), noGrav, lockFace, guard, inv, ev:[[시각, fn]], update(p,a,dt), end(p,a) }
// p.mega.active = 각성 상태 (강화판)
import Phaser from 'phaser';
import { typeColor } from '../../data/types.js';
import { Sfx } from '../../systems/Audio.js';
import { sizeMul, slashHit, shoot, lineFx, dashAction, view, groundAt } from '../skillKit.js';

// 일시 강화/약화 (atk·speed 배율, guard = 받는 피해 배율). addBuff 가 없으면 속도 버프로 대신한다
const buff = (p, o) => { if (p.addBuff) p.addBuff(o); else if ((o.speed || 1) > 1) p.speedBuff = Math.max(p.speedBuff, o.t); };
// 플레이어 몸 판정을 넓힌 사각형
const bodyRect = (p, ex, ey) => ({ x: p.b.x - ex, y: p.b.y - ey, w: p.b.width + ex * 2, h: p.b.height + ey * 2 });

export const SKILL_IMPL = {
  // ===== 모부기 =====
  seed_bomb(p, i) {
    if (i < 2) return { dur: .22, mm: .35, anim: 'Attack', ev: [[.07, () => { slashHit(p, { fwd: 12, w: 22, h: 18, mul: 1, type: 'grass', color: 0xc8ffb0, flipV: i === 1, arc: 11, thick: 5 }); Sfx.play('punch'); }]] };
    const m = p.mega.active, s = sizeMul(p);
    return {
      dur: .32, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        shoot(p, {
          speed: 170, vy: -170, grav: 520, r: 5, mul: 0, type: 'grass', kind: 'seed', life: 1.2, color: 0x8ad04a, oy: -8, boom: { r: 30, mul: 1.7, kb: 200 },
          // 각성: 터지면서 작은 씨앗이 사방으로 튀어 다시 터진다
          onExpire: q => { if (m) for (let k = 0; k < 3; k++) p.scene.combat.spawnProjectile({ owner: 'player', x: q.x, y: q.y - 8, vx: (k - 1) * 90, vy: -150, r: 3 * s, mul: 0, type: 'grass', kind: 'seed', life: .6, grav: 520, color: 0xb0ff6a, boom: { r: 18, mul: .6, kb: 120 } }); }
        });
        Sfx.play('leaf');
      }]]
    };
  },
  wood_hammer(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p);
    let log = null;
    return {
      dur: .66, mm: 0, anim: 'Strike', lockFace: true,
      update(p, a) { if (a.t < .3 && Math.random() < .5) sc.fx.burst(p.x + (Math.random() - .5) * 30, p.y - 20 * s, [0x8a5a2a, 0x5ed04a], 1, 20, { grav: -20, bounce: false, life: .3 }); },
      ev: [
        // 통나무를 머리 위로 치켜든다
        [.06, () => {
          log = sc.add.rectangle(p.x, p.y - 2, 10 * s, 42 * s, 0x8a5a2a).setOrigin(.5, 1).setStrokeStyle(2, 0x5a3a1a).setDepth(23).setRotation(-p.face * .35);
          p.squash(.85, 1.2);
        }],
        [.26, () => { if (log) sc.tweens.add({ targets: log, rotation: p.face * Math.PI * .58, duration: 90, ease: 'Quad.easeIn' }); }],
        [.36, () => {
          const reach = 50 * s, H = 46 * s;
          sc.combat.hitRect({ x: p.face > 0 ? p.x : p.x - reach, y: p.bottom - H, w: reach, h: H }, 4.2, 'grass', { kbx: 220, kby: -260, hs: 130 });
          const gx = p.x + p.face * reach * .7;
          sc.fx.ring(gx, p.bottom - 4, 34 * s, 0x8aff6a, 300); sc.fx.glow(gx, p.bottom - 10, 40 * s, 0x5ed04a, 300, 1);
          sc.fx.burst(gx, p.bottom - 2, [0x8a5a2a, 0x5ed04a, 0xd8b060, 0xffffff], 30, 200, { up: 140 });
          sc.fx.shake(.016, 260); Sfx.play('boom'); Sfx.play('punch'); p.squash(1.35, .7);
          if (log) { const lg = log; sc.tweens.add({ targets: lg, alpha: 0, duration: 220, delay: 120, onComplete: () => lg.destroy() }); }
          log = null;
          // 반동 (각성은 절반)
          p.selfDamage(p.m.maxhp * (m ? .03 : .06)); p.flash(80);
          sc.fx.floatText(p.x, p.b.y - 10, '반동!', '#ffb0a0', 9);
          // 각성: 땅을 타고 뻗어나가는 뿌리 충격파
          if (m) {
            const set = new Set();
            for (let k = 1; k <= 4; k++) sc.time.delayedCall(k * 80, () => {
              const x = p.x + p.face * (reach + k * 26 * s), gy = groundAt(p, x);
              sc.combat.hitRect({ x: x - 14 * s, y: gy - 36 * s, w: 28 * s, h: 36 * s }, 1.2, 'grass', { set, kbx: 100, kby: -300 });
              lineFx(sc, x, gy, x + p.face * 6, gy - 34 * s, 0x5ed04a, { seg: 5, jag: 8, w: 3, ms: 260 });
              sc.fx.burst(x, gy - 2, [0x8a5a2a, 0x5ed04a], 8, 120, { up: 120 }); Sfx.play('leaf');
            });
          }
        }]
      ],
      end() { if (log) log.destroy(); }
    };
  },
  earth_power(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p);
    return {
      dur: .4, mm: .2, anim: 'Strike', ev: [[.14, () => {
        const v = view(p), targets = sc.combat.nearest(p.x, p.y, m ? 6 : 3, 220).filter(e => e.x > v.x && e.x < v.right);
        // 적이 없으면 앞쪽 세 군데에서 솟구친다
        const spots = targets.length ? targets.map(e => ({ x: e.x, gy: sc.groundBelow(e.x, e.y - 6) })) : [1, 2, 3].map(k => { const x = p.x + p.face * k * 40 * s; return { x, gy: groundAt(p, x) }; });
        const set = new Set(), w = 24 * s, h = 70 * s;
        const pillar = (x, gy, delay, mul, st) => sc.combat.spawnZone({
          x: x - w / 2, y: gy - h, w, h, delay, life: delay + .32, tick: 99, draw: 'pillar', type: 'ground', color: 0xd8b060,
          onTick: z => {
            sc.combat.hitRect(z, mul, 'ground', { set: st, kbx: 40, kby: -340, hs: 70 });
            sc.fx.burst(x, gy - 2, [0xd8b060, 0xff8a3a, 0x8a6a3a], 16, 180, { up: 200 });
            sc.fx.glow(x, gy - h / 2, w, 0xff9a4a, 260, .8); sc.fx.shake(.008, 140); Sfx.play('boom');
          }
        });
        for (const t of spots) {
          pillar(t.x, t.gy, .35, 2.8, set);
          if (m) pillar(t.x, t.gy, .75, 1.2, new Set());   // 각성: 여진
        }
        sc.fx.burst(p.x, p.bottom - 2, [0xd8b060, 0x8a6a3a], 14, 120, { up: 80 });
        sc.fx.shake(.006, 300); Sfx.play('crack'); p.squash(1.25, .8);
      }]]
    };
  },

  // ===== 불꽃숭이 =====
  fury_swipes(p, i) {
    const m = p.mega.active, last = i === 2, n = (last ? 4 : 2) + (m ? 1 : 0), gap = last ? .05 : .055;
    return {
      dur: .07 + n * gap, mm: .45, anim: 'Attack',
      ev: [...Array(n)].map((_, k) => [.03 + k * gap, () => slashHit(p, {
        fwd: 12 + (k % 2) * 3, w: 22, h: 20, oy: -2 + ((k % 3) - 1) * 4, mul: last ? .42 : .55, type: 'normal', flipV: k % 2 === 1, arc: 11, thick: 4,
        kbx: last && k === n - 1 ? 200 : 40, kby: last && k === n - 1 ? -120 : -20, color: m ? 0xffb050 : 0xfff0d0, status: Object.assign({ hs: 20 }, m ? { burn: 1.5 } : {})
      })])
    };
  },
  flare_blitz(p) {
    const m = p.mega.active;
    let light = null;
    const act = dashAction(p, {
      dur: .36, vx: 400, mul: 2.8, type: 'fire', status: { burn: 3, hs: 80 }, color: 0xff5a1a, kbx: 280, anim: 'Strike',
      tick(p) {
        p.scene.fx.embers(p.x, p.y, [0xff5a1a, 0xffd04a, 0xffffff], 3, { speed: 60 });
        if (!light) light = p.scene.combat.takeLight(p.x, p.y, 110, 0xff5a1a, 2);
        if (light) light.setPosition(p.x, p.y);
      },
      end(p) {
        const sc = p.scene;
        sc.combat.freeLight(light); light = null;
        p.selfDamage(p.m.maxhp * (m ? .035 : .07)); p.flash(80);
        sc.fx.floatText(p.x, p.b.y - 10, '반동!', '#ffb0a0', 9);
        if (m) {   // 각성: 돌진 끝 화염 폭발
          const r = 46 * sizeMul(p), x = p.x + p.face * 12;
          sc.combat.hitCircle(x, p.y, r, 1.4, 'fire', { burn: 3, kbx: 260, kby: -220 });
          sc.fx.ring(x, p.y, r, 0xffd04a, 300); sc.fx.glow(x, p.y, r, 0xff5a1a, 320, 1);
          sc.fx.burst(x, p.y, [0xff5a1a, 0xffd04a, 0xffffff], 26, 220, { glow: true });
          sc.fx.shake(.012, 200); Sfx.play('boom');
        }
        Sfx.play('fire');
      }
    });
    act.tintFill = 0xff8a3a;   // 온몸이 불꽃으로 물든다
    return act;
  },
  close_combat(p) {
    const m = p.mega.active, n = m ? 12 : 8, gap = m ? .052 : .075, sc = p.scene;
    return {
      dur: .14 + n * gap + .12, mm: 0, anim: 'Attack', lockFace: true,
      ev: [
        ...[...Array(n)].map((_, k) => [.06 + k * gap, () => {
          const fin = k === n - 1;
          slashHit(p, { fwd: 14, w: fin ? 32 : 26, h: fin ? 28 : 22, oy: -2 + (Math.random() - .5) * 10, mul: fin ? 1 : .38, type: 'fighting', flipV: k % 2 === 1, arc: fin ? 17 : 11, thick: fin ? 7 : 4, kbx: fin ? 300 : 20, kby: fin ? -200 : -10, color: 0xffb0a0, status: { hs: fin ? 110 : 25 } });
          sc.fx.burst(p.x + p.face * 18 * sizeMul(p), p.y + (Math.random() - .5) * 14, [0xffd0a0, 0xffffff], 3, 90);
          if (k % 2 === 0) Sfx.play('punch');
          if (fin) {
            sc.fx.shake(.012, 200); p.squash(1.3, .8);
            if (m) shoot(p, { speed: 300, r: 7, mul: 1, type: 'fighting', kind: 'wave', life: .4, pierce: 99, kb: 240 });   // 각성: 마지막 일격 충격파
          }
        }]),
        // 무방비: 잠시 받는 피해 증가
        [.14 + n * gap, () => { buff(p, { guard: 1.3, t: m ? 1.5 : 3, color: 0xff6a5a }); sc.fx.floatText(p.x, p.b.y - 12, '방어↓', '#ff8a8a', 9); }]
      ]
    };
  },

  // ===== 팽도리 =====
  peck_combo(p, i) {
    const m = p.mega.active;
    if (i < 2) return {
      dur: .2, ctrl: true, anim: 'Attack',
      update(p, a) { p.b.setVelocityX(a.t < .08 ? p.face * 150 : p.b.velocity.x * .75); },
      ev: [[.06, () => slashHit(p, { fwd: 15, w: 24, h: 12, oy: -1, mul: 1, type: 'flying', color: 0xd8f0ff, arc: 9, thick: 3, kbx: 110 })]]
    };
    // 회전부리: 회전하며 파고드는 다단 찌르기
    return {
      dur: .36, ctrl: true, anim: 'Strike', lockFace: true, tk: 0,
      update(p, a, dt) {
        p.b.setVelocityX(p.face * (a.t < .22 ? 260 : 60));
        a.tk -= dt;
        if (a.tk <= 0 && a.t < .3) {
          a.tk = .1;
          const s = sizeMul(p), x = p.x + p.face * 16 * s;
          p.scene.combat.hitRect({ x: x - 13 * s, y: p.y - 9 * s, w: 26 * s, h: 18 * s }, .55, 'flying', { kbx: 70, kby: -30, hs: 30 });
          p.scene.fx.ring(x, p.y - 1, 10 * s, 0xbfe6ff, 120); Sfx.play('swing');
        }
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .04; p.scene.fx.ghost(p.sprite, 0x9ad8ff, .45, 180); }
      },
      ev: m ? [[.3, () => { shoot(p, { speed: 340, r: 3, mul: .5, type: 'steel', kind: 'bolt', life: .5, count: 3, spread: .2, color: 0xd8e0f0 }); Sfx.play('crack'); }]] : [],
      end(p) { p.b.setVelocityX(p.b.velocity.x * .3); }
    };
  },
  flash_cannon(p) {
    const m = p.mega.active, sc = p.scene;
    const fire = (mul, thick) => {
      const s = sizeMul(p), max = 230 * s, h = thick * s, x0 = p.x + p.face * 10, y = p.y - 3;
      let len = 0;
      while (len < max && !sc.isSolidAt(x0 + p.face * (len + 8), y)) len += 8;   // 벽에서 멈춘다
      const rect = { x: p.face > 0 ? x0 : x0 - len, y: y - h / 2, w: Math.max(8, len), h };
      sc.combat.spawnZone(Object.assign({}, rect, { life: .3, tick: 99, draw: 'beam', type: 'steel', color: 0xe8f0ff, onTick: z => sc.combat.hitRect(z, mul, 'steel', { curse: Math.random() < .3 ? 4 : 0, kbx: 200, kby: -60, hs: 80 }) }));
      sc.combat.clearEnemyProjectiles(rect);
      sc.fx.glow(x0, y, 20 * s, 0xe8f0ff, 260, 1); sc.fx.glow(x0 + p.face * len, y, 16 * s, typeColor('steel'), 260, .9);
      sc.fx.burst(x0 + p.face * len, y, [0xffffff, typeColor('steel'), 0xd8e0ff], 12, 150, { glow: true });
      sc.cameras.main.flash(70, 230, 240, 255, true); sc.fx.shake(.006, 140);
      Sfx.play('beam'); p.squash(1.2, .85);
    };
    return {
      dur: m ? .78 : .56, mm: .1, anim: 'Shoot', lockFace: true,
      update(p, a) {
        if (a.t < .18 && Math.random() < .7) { const s = sizeMul(p), ang = Math.random() * Math.PI * 2; sc.fx.burst(p.x + p.face * 10 + Math.cos(ang) * 18 * s, p.y - 3 + Math.sin(ang) * 18 * s, [0xe8f0ff, 0xa8b0c8], 1, 10, { grav: 0, bounce: false, glow: true, life: .2 }); }
        if (!a.light) a.light = sc.combat.takeLight(p.x + p.face * 10, p.y, 100, 0xd8e8ff, 1.8);
      },
      ev: [[.18, () => fire(3.2, m ? 22 : 14)], ...(m ? [[.44, () => fire(1.4, 22)]] : [])],
      end(p, a) { sc.combat.freeLight(a.light); }
    };
  },
  belly_slide(p) {
    const m = p.mega.active, sc = p.scene, set = new Set();
    return {
      dur: m ? .78 : .55, ctrl: true, anim: 'Walk', lockFace: true, inv: .15, sp: m ? 420 : 360, ft: 0,
      update(p, a, dt) {
        a.sp *= Math.pow(m ? .55 : .4, dt);
        p.b.setVelocityX(p.face * a.sp);
        p.squash(1.4, .6);   // 납작하게 엎드린다
        const s = sizeMul(p), h = 12 * s;
        // 낮은 판정: 발밑 높이로 쓸어 띄운다
        sc.combat.hitRect({ x: p.b.x - 6 * s, y: p.bottom - h, w: p.b.width + 12 * s, h }, 2.2, 'water', { set, kbx: 90, kby: -340, hs: 60 });
        if (p.onGround && Math.random() < .7) sc.fx.burst(p.x - p.face * 8, p.bottom - 2, [0x4ac0ff, 0xbfe6ff, 0xffffff], 2, 80, { up: 60, angle: p.face > 0 ? Math.PI : 0, spread: .6 });
        // 지나간 자리에 미끄러운 물길
        a.ft -= dt;
        if (a.ft <= 0 && p.onGround) {
          a.ft = .06;
          const zx = p.x - 10;
          sc.combat.spawnZone({
            x: zx, y: p.bottom - 6, w: 20, h: 6, life: 3, tick: .2, type: 'water', color: 0x4ac0ff,
            onTick: z => {
              for (const e of sc.combat.enemiesIn({ x: z.x, y: z.y - 8, w: z.w, h: z.h + 8 })) sc.combat.damageEnemy(e, 0, 'water', { slow: 1.2 });
              const pb = p.bounds();
              if (pb.x + pb.w > z.x && pb.x < z.x + z.w && Math.abs(pb.y + pb.h - (z.y + z.h)) < 8) p.speedBuff = Math.max(p.speedBuff, .4);
            },
            onUpdate: z => {
              const g = sc.combat.zg, k = Math.min(1, (z.life - z.t) * 2);
              g.fillStyle(0x4ac0ff, .35 * k); g.fillRect(z.x, z.y + 2, z.w, 4);
              g.fillStyle(0xffffff, .6 * k); g.fillRect(z.x + ((sc.time.now / 20 + z.x) % z.w), z.y + 2, 3, 1);
            }
          });
        }
      },
      end(p) {
        p.b.setVelocityX(p.b.velocity.x * .3);
        if (m) {   // 각성: 멈춘 자리에 물기둥
          const s = sizeMul(p), w = 30 * s, h = 64 * s, x = p.x + p.face * 14;
          sc.combat.hitRect({ x: x - w / 2, y: p.bottom - h, w, h }, 1.3, 'water', { kbx: 60, kby: -360 });
          lineFx(sc, x, p.bottom, x, p.bottom - h, 0x4ac0ff, { seg: 6, jag: 6, w: 6 * s, ms: 300 });
          sc.fx.burst(x, p.bottom - 2, [0x4ac0ff, 0xbfe6ff, 0xffffff], 26, 200, { up: 240 });
          sc.fx.shake(.008, 160); Sfx.play('water');
        }
      },
      ev: [[0, () => { Sfx.play('water'); Sfx.play('dash'); }]]
    };
  },

  // ===== 주리비얀 =====
  leaf_tornado(p, i) {
    if (i < 2) return { dur: .22, mm: .4, anim: 'Attack', ev: [[.07, () => { slashHit(p, { fwd: 14, w: 26, h: 18, mul: 1, type: 'grass', color: 0x8aff6a, flipV: i === 1 }); Sfx.play('leaf'); }]] };
    const m = p.mega.active;
    return {
      dur: .32, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        const sc = p.scene, s = sizeMul(p) * (m ? 1.4 : 1), w = 26 * s, h = 40 * s, set = new Set();
        // 앞으로 나아가며 적을 휘감아 올리는 잎 회오리 (여러 번 타격)
        sc.combat.spawnZone({
          x: p.x + p.face * 12 - w / 2, y: p.bottom - h, w, h, vx: p.face * 150, life: m ? 1.2 : .8, tick: .15, type: 'grass', color: 0x5ed04a,
          onTick: z => sc.combat.hitRect(z, .32, 'grass', { fromX: z.x + z.w / 2, kbx: 10, kby: -110, hs: 15 }),
          onUpdate: (z, dt) => {
            z.x += z.vx * dt;
            if (sc.isSolidAt(z.x + z.w / 2 + Math.sign(z.vx) * z.w / 2, z.y + z.h / 2)) z.vx = 0;
            const g = sc.combat.zg, t = sc.time.now / 70, cx = z.x + z.w / 2, k = Math.min(1, (z.life - z.t) * 4);
            for (let j = 0; j < 7; j++) {
              const u = j / 6, y = z.y + z.h - u * z.h, r = (5 + u * 9) * s, ang = t + j * 1.3;
              g.fillStyle(j % 2 ? 0x8aff6a : 0x3a9a2a, .75 * k);
              g.fillRect(Math.round(cx + Math.cos(ang) * r) - 2, Math.round(y), 4, 2);
              g.fillRect(Math.round(cx - Math.cos(ang) * r) - 1, Math.round(y - 3), 3, 2);
            }
            if (Math.random() < .4) sc.fx.burst(cx, z.y + Math.random() * z.h, [0x8aff6a, 0xc8ffb0], 1, 50, { grav: -20, bounce: false, life: .3 });
          }
        });
        Sfx.play('leaf'); Sfx.play('wave');
      }]]
    };
  },
  leaf_storm(p) {
    const m = p.mega.active;
    return {
      dur: .78, mm: .15, anim: 'Shoot', lockFace: true, tk: 0,
      update(p, a, dt) {
        a.tk -= dt;
        if (a.tk <= 0 && a.t < .62) {
          a.tk = m ? .03 : .045;
          shoot(p, { speed: 280 + Math.random() * 130, angle: (Math.random() - .5) * .7, r: 4, mul: .3, type: 'grass', kind: 'leaf', life: .7, pierce: 2, kb: 60, color: Math.random() < .5 ? 0x5ed04a : 0x8aff6a });
          if (Math.random() < .35) Sfx.play('leaf');
        }
        if (Math.random() < .6) p.scene.fx.burst(p.x + p.face * 12, p.y - 3, [0x5ed04a, 0xc8ffb0], 1, 60, { angle: p.face > 0 ? 0 : Math.PI, spread: .6, grav: 0, bounce: false, life: .3 });
      },
      ev: [[.05, () => { p.scene.fx.glow(p.x + p.face * 10, p.y, 30 * sizeMul(p), 0x5ed04a, 300, .9); Sfx.play('wave'); }]],
      end(p) { if (!m) { buff(p, { atk: .8, t: 4, color: 0x7a8a6a }); p.scene.fx.floatText(p.x, p.b.y - 12, '공격↓', '#c8d0a0', 9); } }   // 반동: 특공 하락
    };
  },
  coil(p) {
    const m = p.mega.active, sc = p.scene;
    return {
      dur: .5, mm: 0, anim: 'Idle', tintFill: 0x8aff6a,
      update(p, a, dt) {
        a.rt = (a.rt || 0) - dt;
        if (a.rt <= 0) { a.rt = .08; const s = sizeMul(p), r = (30 - a.t * 40) * s; sc.fx.ring(p.x, p.y, Math.max(6, r), a.t * 20 % 2 < 1 ? 0x5ed04a : 0xc8ffb0, 160); }   // 똬리가 조여든다
      },
      ev: [[.38, () => {
        buff(p, { atk: m ? 1.45 : 1.3, speed: m ? 1.3 : 1.2, guard: m ? .7 : .85, t: m ? 9 : 6, color: 0x5ed04a });
        sc.fx.glow(p.x, p.y, 34 * sizeMul(p), 0x5ed04a, 360, 1);
        sc.fx.burst(p.x, p.y, [0x5ed04a, 0xc8ffb0, 0xffffff], 18, 120, { grav: -40, glow: true });
        sc.fx.floatText(p.x, p.b.y - 12, '공격·속도↑', '#8aff8a', 10);
        p.squash(.8, 1.3); Sfx.play('heal');
      }]]
    };
  },

  // ===== 뚜꾸리 =====
  arm_thrust(p, i) {
    const m = p.mega.active;
    if (i < 2) return {
      dur: .24, mm: .35, anim: 'Attack',
      ev: [.04, .12].map((t, k) => [t, () => { slashHit(p, { fwd: 13, w: 22, h: 18, oy: -2 + (k ? 4 : -3), mul: .55, type: 'fighting', color: 0xffd0a0, flipV: k === 1, arc: 10, thick: 4, kbx: 60 }); if (k) Sfx.play('punch'); }])
    };
    return {
      dur: .34, mm: .2, anim: 'Strike', ev: [[.12, () => {
        slashHit(p, { fwd: 15, w: 30, h: 28, mul: 1.6, type: m ? 'fire' : 'fighting', color: m ? 0xff7a2a : 0xffb0a0, arc: 17, thick: 7, kbx: 320, kby: -140, status: Object.assign({ hs: 90 }, m ? { burn: 2.5 } : {}) });
        Sfx.play('punch'); p.squash(1.3, .8);
        if (m) { shoot(p, { speed: 260, r: 7, mul: .8, type: 'fire', kind: 'wave', life: .35, pierce: 99, kb: 260, status: { burn: 2 } }); Sfx.play('fire'); }   // 각성: 불꽃 장타 충격파
      }]]
    };
  },
  heat_crash(p) {
    const m = p.mega.active, sc = p.scene;
    return {
      dur: 1.6, ctrl: true, anim: 'Strike', lockFace: true, top: p.y,
      ev: [[0, () => { p.b.setVelocity(p.face * 110, m ? -480 : -420); p.squash(.7, 1.35); Sfx.play('jump'); }]],
      update(p, a, dt) {
        a.top = Math.min(a.top, p.y);
        if (a.landed) { p.b.setVelocityX(0); return; }
        if (!a.fall && (a.t > .34 || (a.t > .1 && p.lastInput?.down))) { a.fall = true; Sfx.play('dash'); }   // ↓ 로 빨리 낙하
        if (!a.fall) { if (Math.random() < .6) sc.fx.embers(p.x, p.y, [0xff7a2a, 0xffd04a], 1, { speed: 30 }); return; }
        p.b.setVelocity(0, m ? 820 : 720);
        p.inv = Math.max(p.inv, .12); p.squash(.8, 1.25);
        sc.fx.embers(p.x, p.y - 6, [0xff5a1a, 0xffd04a], 2, { speed: 40 });
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .03; sc.fx.ghost(p.sprite, 0xff7a2a, .5, 200); }
        if (!(p.onGround || a.t > 1.5)) return;
        // 착지: 떨어진 높이만큼 강해진다
        a.landed = true; a.dur = a.t + .22;
        const s = sizeMul(p), k = Phaser.Math.Clamp((p.y - a.top) / 180, 0, 1);
        const r = (34 + k * 30) * s * (m ? 1.4 : 1), mul = 1.6 + k * 2.4, y = p.bottom - 8;
        sc.combat.hitCircle(p.x, y, r, mul, 'fire', { burn: 2.5, kbx: 200, kby: -280, hs: 90 + k * 60 });
        sc.fx.ring(p.x, y, r, 0xffd04a, 320); sc.fx.glow(p.x, y, r, 0xff5a1a, 320, 1);
        sc.fx.burst(p.x, p.bottom - 2, [0xff5a1a, 0xffd04a, 0x8a5a3a, 0xffffff], 20 + k * 30, 160 + k * 120, { up: 160, glow: true });
        sc.fx.shake(.008 + k * .016, 200 + k * 200); Sfx.play('boom'); Sfx.play('fire'); p.squash(1.5, .6);
        if (k > .6) sc.fx.floatText(p.x, p.b.y - 14, '초중량!', '#ffb070', 10);
        // 양옆으로 번지는 화염 충격파
        const set = new Set(), x0 = p.x, gy = p.bottom;
        for (let j = 1; j <= 3; j++) sc.time.delayedCall(j * 70, () => {
          for (const d of [-1, 1]) {
            const x = x0 + d * (r + j * 20 * s);
            sc.combat.hitRect({ x: x - 12 * s, y: gy - 22 * s, w: 24 * s, h: 22 * s }, .5, 'fire', { set, burn: 1.5, kbx: 160, kby: -160, fromX: x0 });
            sc.fx.burst(x, gy - 2, [0xff5a1a, 0xffd04a], 8, 100, { up: 120, glow: true });
          }
        });
        // 각성: 착지 자리에 불바다
        if (m) sc.combat.spawnZone({ x: x0 - r, y: gy - 12, w: r * 2, h: 12, life: 3, tick: .3, draw: 'fire', type: 'fire', onTick: z => sc.combat.hitRect(z, .3, 'fire', { burn: 1.5, kbx: 0, kby: 0, hs: 0 }) });
      },
      end(p) { p.b.setVelocityX(0); }
    };
  },
  rollout(p) {
    const m = p.mega.active, sc = p.scene, max = m ? 480 : 400;
    return {
      dur: m ? 2.6 : 2, ctrl: true, anim: 'Walk', sp: 150, dir: p.face, rt: 0, set: new Set(),
      ev: [[0, () => { p.squash(.75, .75); Sfx.play('dash'); }]],
      update(p, a, dt) {
        const inp = p.lastInput || {}, want = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
        if (want && want !== a.dir) { a.dir = want; a.sp *= .55; p.face = want; p.refacing(); }   // 방향을 틀면 속도가 줄어든다
        if ((a.dir > 0 && p.b.blocked.right) || (a.dir < 0 && p.b.blocked.left)) {   // 벽에 튕긴다
          a.dir *= -1; a.sp *= .7; p.face = a.dir; p.refacing();
          sc.fx.ring(p.x - a.dir * 8, p.y, 16, 0xc0a050, 200); sc.fx.shake(.006, 100); Sfx.play('punch');
        }
        a.sp = Math.min(max, a.sp + dt * 230);
        p.b.setVelocityX(a.dir * a.sp);
        const k = a.sp / 400, s = sizeMul(p);
        a.rt -= dt; if (a.rt <= 0) { a.rt = .22; a.set = new Set(); }   // 같은 적을 주기적으로 다시 친다
        sc.combat.hitRect(bodyRect(p, 6 * s, 4 * s), .35 + k * .5, 'rock', { set: a.set, kbx: 120 + a.sp * .4, kby: -160, hs: 30 });
        p.squash(.85 + Math.sin(a.t * 40) * .08, .85 - Math.sin(a.t * 40) * .08);
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .05 - k * .025; sc.fx.ghost(p.sprite, k > .8 ? 0xff9a4a : 0xc0a050, .45, 200); }
        if (p.onGround && Math.random() < .5 + k * .4) sc.fx.burst(p.x - a.dir * 6, p.bottom - 2, [0xc0a070, 0x8a6a3a], 1, 40 + k * 60, { up: 40, life: .3 });
        // 각성: 빠르게 구르면 불길이 남는다
        if (m && k > .6 && p.onGround) { a.ft = (a.ft || 0) - dt; if (a.ft <= 0) { a.ft = .08; sc.combat.spawnZone({ x: p.x - 8, y: p.bottom - 12, w: 16, h: 12, life: 2, tick: .3, draw: 'fire', type: 'fire', onTick: z => sc.combat.hitRect(z, .3, 'fire', { burn: 1.5, kbx: 0, kby: 0, hs: 0 }) }); } }
      },
      end(p) { p.b.setVelocityX(p.b.velocity.x * .3); }
    };
  },

  // ===== 수댕이 =====
  razor_shell(p, i) {
    if (i < 2) return { dur: .24, mm: .35, anim: 'Attack', ev: [[.07, () => { slashHit(p, { fwd: 15, w: 28, h: 20, mul: 1, type: 'water', color: 0xbfe6ff, flipV: i === 1, arc: 15, thick: 4 }); Sfx.play('water'); }]] };
    const m = p.mega.active;
    return {
      dur: .34, mm: .2, anim: 'Strike', ev: [[.12, () => {
        slashHit(p, { fwd: 16, w: 34, h: 30, mul: 1.7, type: 'water', color: 0xe8f6ff, arc: 19, thick: 7, kbx: 240, kby: -120, status: Object.assign({ hs: 90 }, (m || Math.random() < .5) ? { curse: 4 } : {}) });
        Sfx.play('punch');
        if (m) { shoot(p, { speed: 300, r: 6, mul: .9, type: 'water', kind: 'wave', life: .45, pierce: 99, kb: 180, color: 0xbfe6ff }); Sfx.play('water'); }   // 각성: 물칼날 파동
      }]]
    };
  },
  surf(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), g = sc.add.graphics().setDepth(21);
    const H = (m ? 64 : 46) * s, sp = m ? 300 : 260, back = 26 * s, front = 36 * s;
    const waveRect = p => { const x1 = p.x - p.face * back, x2 = p.x + p.face * front; return { x: Math.min(x1, x2), y: p.bottom + 2 - H, w: back + front, h: H }; };
    return {
      dur: m ? 1.25 : .95, ctrl: true, anim: 'Idle', lockFace: true, inv: .4, tk: 0,
      ev: [[0, () => { Sfx.play('water'); Sfx.play('wave'); }]],
      update(p, a, dt) {
        p.b.setVelocityX(p.face * sp);
        const rect = waveRect(p);
        for (const e of sc.combat.enemiesIn(rect)) if (!e.boss) e.knock(p.face * sp * 1.05, -30);   // 파도에 실려 간다
        a.tk -= dt;
        if (a.tk <= 0) { a.tk = .16; sc.combat.hitRect(rect, .38, 'water', { kbx: 0, kby: 0, hs: 0 }); sc.combat.clearEnemyProjectiles(rect); }
        // 파도 그리기: 뒤는 낮고 앞으로 갈수록 높아지는 물마루
        g.clear();
        const n = 14, bot = p.bottom + 2, wob = sc.time.now / 90, grow = Math.min(1, a.t * 6, (a.dur - a.t) * 5);
        for (let j = 0; j < n; j++) {
          const u = j / (n - 1), x = p.x - p.face * back + p.face * u * (back + front), hh = Math.max(0, H * grow * (.3 + .7 * Math.sin(u * Math.PI * .85)) + Math.sin(wob + j) * 2);
          g.fillStyle(0x2a7ad8, .8); g.fillRect(Math.round(x) - 3, Math.round(bot - hh), 6, Math.round(hh));
          g.fillStyle(0x6ac8ff, .9); g.fillRect(Math.round(x) - 3, Math.round(bot - hh), 6, 4);
          g.fillStyle(0xffffff, .9); g.fillRect(Math.round(x) - 2, Math.round(bot - hh), 4, 1);
        }
        if (Math.random() < .8) sc.fx.burst(p.x + p.face * front, bot - H * grow, [0xffffff, 0xbfe6ff, 0x4ac0ff], 2, 90, { up: 80, life: .4 });
      },
      // 파도가 부서지며 앞쪽을 덮친다
      end(p) {
        g.destroy();
        const x = p.x + p.face * front, w = (m ? 70 : 52) * s;
        sc.combat.hitRect({ x: p.face > 0 ? p.x : p.x - w, y: p.bottom - H, w, h: H }, m ? 1.8 : 1.4, 'water', { kbx: 320, kby: -240, hs: 80 });
        sc.fx.burst(x, p.bottom - H / 2, [0x4ac0ff, 0xbfe6ff, 0xffffff], 34, 220, { up: 160 });
        sc.fx.ring(x, p.bottom - H / 2, H * .6, 0xbfe6ff, 280);
        sc.fx.shake(.01, 200); Sfx.play('water'); Sfx.play('boom');
        p.b.setVelocityX(p.b.velocity.x * .3);
      }
    };
  },
  aqua_cutter(p) {
    const m = p.mega.active;
    return {
      dur: .3, mm: .35, anim: 'Strike', ev: [[.08, () => {
        p.scene.fx.slash(p.x + p.face * 10 * sizeMul(p), p.y - 3, 14 * sizeMul(p), p.face, 0xbfe6ff, { thick: 5 });
        shoot(p, { speed: 420, r: 6, mul: 2.4, type: 'water', kind: 'wave', life: .65, pierce: 99, kb: 140, color: 0x8ae0ff, light: true, status: { crit: m ? .6 : .45 }, count: m ? 3 : 1, spread: .12 });
        Sfx.play('water'); Sfx.play('swing');
      }]]
    };
  }
};
