// 2·3세대 스타팅 계열 스킬 구현 (치코리타·브케인·리아코·나무지기·아차모·물짱이)
// 각 스킬은 행동(action) 객체를 돌려준다:
//  { dur, mm(이동 배율), anim, ctrl(속도 직접 제어), noGrav, lockFace, guard, inv, ev:[[시각, fn]], update(p,a,dt), end(p,a) }
import Phaser from 'phaser';
import { typeColor } from '../../data/types.js';
import { Sfx } from '../../systems/Audio.js';
import { sizeMul, slashHit, shoot, lineFx, view, groundAt } from '../skillKit.js';

const PETAL = [0xff8ad0, 0xffd0f0, 0xffffff, 0x8aff6a];
const MUD = [0x8a6a3a, 0xb08a50, 0x6a5030];

export const SKILL_IMPL = {
  // ===== 치코리타 =====
  magical_leaf(p, i) {
    if (i < 2) return { dur: .22, mm: .4, anim: 'Attack', ev: [[.06, () => { slashHit(p, { fwd: 14, w: 26, h: 20, mul: 1, type: 'grass', color: 0x8aff6a, flipV: i === 1 }); p.scene.fx.burst(p.x + p.face * 16, p.y - 2, [0x8aff6a, 0xc8ffb0], 4, 60, { grav: 60 }); }]] };
    const m = p.mega.active;
    return { dur: .28, mm: .35, anim: 'Shoot', ev: [[.08, () => { shoot(p, { speed: 210, r: 4, mul: m ? 1.2 : 1.6, type: 'grass', kind: 'leaf', life: 1.4, homing: 1.2, ghost: m, count: m ? 3 : 1, spread: .5, color: 0x9aff5a, light: true }); Sfx.play('leaf'); }]] };   // 반드시 맞는 잎: 오래 유도
  },
  petal_blizzard(p) {
    const m = p.mega.active;
    return {
      dur: 1.05, mm: .6, anim: 'Attack', tk: 0, ang: 0,
      update(p, a, dt) {
        const sc = p.scene, r = 46 * sizeMul(p) * (m ? 1.5 : 1);
        a.ang += dt * 9; a.tk -= dt;
        for (let k = 0; k < 4; k++) { const t = a.ang + k * Math.PI / 2 + Math.random() * .5, rr = r * (.35 + Math.random() * .65); sc.fx.burst(p.x + Math.cos(t) * rr, p.y + Math.sin(t) * rr * .6, PETAL, 1, 20, { grav: 0, bounce: false, glow: k % 2 === 0, life: .3, size: 2 }); }
        if (a.tk <= 0) {
          a.tk = .13;
          sc.combat.hitCircle(p.x, p.y, r, .42, 'grass', { kbx: -50, kby: -30, hs: 0 });   // 소용돌이가 적을 안쪽으로 끌어당긴다
          sc.fx.ring(p.x, p.y, r, 0xff8ad0, 180);
          Sfx.play('leaf');
        }
      },
      end(p) { if (m) { shoot(p, { speed: 200, r: 4, mul: .55, type: 'grass', kind: 'leaf', life: 1.2, homing: .8, count: 6, spread: Math.PI / 3, color: 0xff8ad0 }); Sfx.play('leaf'); } }   // 메가: 흩어지는 꽃잎이 적을 쫓는다
    };
  },
  synthesis(p) {
    const m = p.mega.active, mem = p.m, sc = p.scene;
    return {
      dur: .5, mm: 0, anim: 'Idle', tintFill: 0xfff6a0,
      ev: [[.12, () => {
        const v = view(p);
        for (let k = 0; k < 4; k++) { const x = p.x + (k - 1.5) * 9; lineFx(sc, x + 30, v.y, x, p.y, 0xfff6a0, { seg: 3, jag: 2, w: 3, ms: 420 }); }   // 하늘에서 내리쬐는 햇살
        sc.fx.glow(p.x, p.y, 40, 0xfff6a0, 500, .9); sc.fx.ring(p.x, p.y, 30, 0x9aff7a, 360);
        if (p.addBuff) p.addBuff(Object.assign({ guard: m ? .5 : .65, t: 3, color: 0x9aff7a }, m ? { atk: 1.2 } : {}));
        // 3초간 0.5초마다 회복 (교대하면 끊긴다)
        sc.combat.spawnZone({
          x: p.x, y: p.y, w: 1, h: 1, life: 3, tick: .5, type: 'grass',
          onTick: () => { if (p.m === mem && mem.alive) p.heal(mem.maxhp * (m ? .045 : .03)); },
          onUpdate: () => { if (p.m === mem && Math.random() < .4) sc.fx.embers(p.x + (Math.random() - .5) * 16, p.bottom - 2, [0x9aff7a, 0xfff6a0], 1, { speed: 20 }); }
        });
        Sfx.play('heal');
      }]]
    };
  },

  // ===== 브케인 =====
  flare_jab(p, i) {
    const m = p.mega.active, last = i === 2;
    return {
      dur: last ? .3 : .2, ctrl: true, anim: last ? 'Strike' : 'Attack',
      update(p, a) { p.b.setVelocityX(a.t < .08 ? p.face * (last ? 220 : 150) : p.b.velocity.x * .75); },   // 한 걸음씩 파고드는 주먹
      ev: [[last ? .1 : .06, () => {
        const sc = p.scene, s = sizeMul(p);
        slashHit(p, { fwd: 13, w: last ? 30 : 22, h: last ? 26 : 18, mul: last ? 1.7 : .9, type: 'fire', status: { burn: last ? 2.5 : 1.2 }, crit: last ? .15 : 0, kbx: last ? 240 : 100, kby: last ? -160 : -60, color: 0xffb04a, arc: last ? 16 : 11, thick: last ? 6 : undefined, flipV: i === 1 });
        sc.fx.embers(p.x + p.face * 16 * s, p.y - 2, [0xff7a2a, 0xffd04a], last ? 8 : 3, { speed: 50 });
        Sfx.play('punch');
        if (last && m) {
          const x = p.x + p.face * 24 * s, r = 30 * s;
          sc.combat.hitCircle(x, p.y, r, .9, 'fire', { burn: 3, kbx: 220, kby: -180, hs: 0 });
          sc.fx.ring(x, p.y, r, 0xffd04a, 260); sc.fx.glow(x, p.y, r, 0xff5a1a, 260, 1);
          sc.fx.burst(x, p.y, [0xff7a2a, 0xffd04a, 0xffffff], 18, 160, { glow: true });
          sc.fx.shake(.008, 140); Sfx.play('fire');
        }
      }]]
    };
  },
  eruption(p) {
    const m = p.mega.active, sc = p.scene, k = Phaser.Math.Clamp(p.m.hp / p.m.maxhp, 0, 1), n = (m ? 8 : 5) + p.mods.extraProj;
    const mul = .3 + .6 * k;   // 체력이 가득하면 한 발 0.9배 (5발 모두 4.5배), 바닥이면 0.3배
    const ev = [[.08, () => {
      sc.fx.floatText(p.x, p.b.y - 12, `위력 ${Math.round(mul / .9 * 100)}%`, k > .5 ? '#ffb070' : '#ff7a6a', 10);
      sc.fx.glow(p.x - p.face * 4, p.b.y, 30 * sizeMul(p), 0xff5a1a, 400, 1);
      sc.fx.shake(.006, 240); p.squash(1.25, .82); Sfx.play('fire');
    }]];
    for (let j = 0; j < n; j++) ev.push([.14 + j * .07, () => {
      const s = sizeMul(p);
      sc.combat.spawnProjectile({
        owner: 'player', x: p.x - p.face * 6, y: p.b.y + 2, vx: p.face * (40 + Math.random() * 170), vy: -(250 + Math.random() * 130), grav: 620,
        r: 5 * s, mul: 0, type: 'fire', kind: 'fire', life: 2.2, status: { burn: 2 }, light: j % 3 === 0, boom: { r: 26 * s, mul, kb: 160 },
        onExpire: m ? q => {   // 메가: 떨어진 자리에 불길
          const gy = sc.groundBelow(q.x, q.y - 8), w = 24 * s;
          sc.combat.spawnZone({ x: q.x - w / 2, y: gy - 10, w, h: 10, life: 2.5, tick: .35, draw: 'fire', type: 'fire', onTick: z => sc.combat.hitRect(z, .25, 'fire', { burn: 2, kbx: 0, kby: 0, hs: 0 }) });
        } : undefined
      });
      sc.fx.burst(p.x - p.face * 6, p.b.y, [0xff7a2a, 0xffd04a], 5, 80, { angle: -Math.PI / 2, spread: .8, up: 60, glow: true });
      Sfx.play('fire');
    }]);
    return { dur: .3 + n * .07, mm: .15, anim: 'Shoot', ev };
  },
  flame_wheel(p) {
    const m = p.mega.active, set = new Set(), sp = m ? 380 : 300;
    return {
      dur: m ? .7 : .55, ctrl: true, anim: 'Walk', inv: .25, tk: 0, ang: 0, bounced: 0,
      update(p, a, dt) {
        const sc = p.scene, s = sizeMul(p), r = 14 * s;
        if ((p.face > 0 ? p.b.blocked.right : p.b.blocked.left) && a.bounced < 2) { a.bounced++; set.clear(); p.face *= -1; p.refacing(); sc.fx.ring(p.x, p.y, r * 1.6, 0xffd04a, 200); sc.fx.shake(.006, 100); }   // 벽에 튕겨 되돌아 굴러간다
        p.b.setVelocityX(p.face * sp);
        sc.combat.hitRect({ x: p.b.x - 6 * s, y: p.b.y - 4 * s, w: p.b.width + 12 * s, h: p.b.height + 8 * s }, 1.7, 'fire', { set, burn: 2.5, kbx: 200, kby: -160 });
        // 몸을 감싸고 도는 불바퀴
        a.ang += dt * 22 * p.face;
        for (let k = 0; k < 3; k++) { const t = a.ang + k * Math.PI * 2 / 3; sc.fx.burst(p.x + Math.cos(t) * r, p.y + Math.sin(t) * r, [0xff7a2a, 0xffd04a, 0xffffff], 1, 10, { grav: -20, bounce: false, glow: true, life: .25, size: 2 }); }
        p.squash(1.1, .9);
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .04; sc.fx.ghost(p.sprite, 0xff7a2a, .45, 200); }
        a.tk -= dt;
        if (a.tk <= 0 && p.onGround) {
          a.tk = .06;
          const w = 16 * s;
          sc.combat.spawnZone({ x: p.x - w / 2, y: p.bottom - 10, w, h: 10, life: m ? 3 : 1.8, tick: .3, draw: 'fire', type: 'fire', onTick: z => sc.combat.hitRect(z, .2, 'fire', { burn: 1.5, kbx: 0, kby: 0, hs: 0 }) });
        }
        if (Math.random() < .3) Sfx.play('fire');
      },
      end(p) { p.b.setVelocityX(p.b.velocity.x * .35); }
    };
  },

  // ===== 리아코 =====
  chomp_combo(p, i) {
    const m = p.mega.active, last = i === 2;
    // 위턱·아래턱이 맞물리는 두 갈래 궤적
    const bite = (o) => {
      const s = sizeMul(p), n = slashHit(p, o);
      p.scene.fx.slash(p.x + p.face * (o.fwd * .6) * s, p.y + 4 * s, (o.arc ?? 13) * s, p.face, o.color, { flipV: true, thick: o.thick });
      return n;
    };
    if (!last) return { dur: .22, mm: .4, anim: 'Attack', ev: [[.07, () => { bite({ fwd: 12, oy: -4, w: 22, h: 18, mul: 1, type: 'dark', color: 0xbfe6ff, status: m ? { lifesteal: .15 } : {} }); Sfx.play('punch'); }]] };
    return {
      dur: .36, ctrl: true, anim: 'Strike',
      update(p, a) { p.b.setVelocityX(a.t < .1 ? p.face * 170 : p.b.velocity.x * .7); },
      ev: [
        [.04, () => p.squash(.85, 1.2)],
        [.13, () => {
          const sc = p.scene, s = sizeMul(p), w = m ? 50 : 34, h = m ? 42 : 30;
          bite({ fwd: 16, oy: -4, w, h, mul: 1.8, type: 'dark', crit: .2, status: Object.assign({ stun: .6, hs: 110 }, m ? { lifesteal: .3 } : {}), kbx: 200, kby: -120, color: 0xffffff, arc: m ? 24 : 18, thick: 7 });
          sc.fx.burst(p.x + p.face * 18 * s, p.y - 2, [0x4ac0ff, 0xbfe6ff, 0xffffff], m ? 20 : 10, 140, { up: 70 });
          if (m) sc.fx.ring(p.x + p.face * 18 * s, p.y, 30 * s, 0x4ac0ff, 260);
          sc.fx.shake(.008, 140); Sfx.play('punch'); Sfx.play('water');
        }]
      ]
    };
  },
  waterfall(p) {
    const m = p.mega.active, set = new Set(), up = m ? 480 : 400, T = .42;
    return {
      dur: T, ctrl: true, noGrav: true, anim: 'Strike', inv: .2,
      ev: [[0, () => {
        const sc = p.scene, s = sizeMul(p), gy = groundAt(p, p.x), w = 22 * s, h = (m ? 140 : 100) * s;
        // 발밑에서 솟구치는 물기둥 (메가는 남아서 계속 친다)
        sc.combat.spawnZone({
          x: p.x - w / 2, y: gy - h, w, h, life: m ? 1.6 : .5, tick: .2, draw: 'pillar', color: 0x4ac0ff,
          onTick: m ? z => { if (z.t > .3) sc.combat.hitRect(z, .3, 'water', { kbx: 0, kby: -220, hs: 0 }); } : undefined
        });
        sc.fx.burst(p.x, gy - 2, [0x4ac0ff, 0xbfe6ff, 0xffffff], 24, 160, { up: 220 });
        sc.fx.ring(p.x, gy - 4, 28 * s, 0xbfe6ff, 260);
        Sfx.play('water');
      }]],
      update(p, a, dt) {
        const sc = p.scene, s = sizeMul(p), k = 1 - a.t / T;
        p.b.setVelocity(p.face * 60 * k, -up * Math.max(.2, k));
        sc.combat.hitRect({ x: p.x - 16 * s, y: p.b.y - 20 * s, w: 32 * s, h: p.b.height + 34 * s }, 2.6, 'water', { set, stun: .4, kbx: 40, kby: -420 });   // 맞은 적은 같이 솟아오른다
        if (Math.random() < .7) sc.fx.burst(p.x + (Math.random() - .5) * 14 * s, p.bottom, [0x4ac0ff, 0xbfe6ff], 2, 40, { up: -40, grav: 300, life: .4 });
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .03; sc.fx.ghost(p.sprite, 0x4ac0ff, .5, 220); }
      },
      end(p) { p.b.setVelocity(p.b.velocity.x * .3, -40); }
    };
  },
  aqua_jet(p) {
    const m = p.mega.active, mem = p.m, set = new Set(), sp = m ? 620 : 520, T = .17;
    return {
      dur: T, ctrl: true, noGrav: true, anim: 'Attack', inv: T,
      update(p, a, dt) {
        const sc = p.scene, s = sizeMul(p);
        p.b.setVelocity(p.face * sp, 0);
        sc.combat.hitRect({ x: p.b.x - 6 * s, y: p.b.y - 4 * s, w: p.b.width + 12 * s, h: p.b.height + 8 * s }, 1.5, 'water', { set, kbx: 220, kby: -100 });
        sc.fx.burst(p.x - p.face * 8, p.y, [0x4ac0ff, 0xbfe6ff, 0xffffff], 3, 60, { angle: p.face > 0 ? Math.PI : 0, spread: .6, up: 10, grav: 200, life: .35 });
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .025; sc.fx.ghost(p.sprite, 0x4ac0ff, .55, 200); }
      },
      ev: [[0, () => Sfx.play('water')]],
      end(p, a) {
        const sc = p.scene, s = sizeMul(p);
        if (!set.size) { p.b.setVelocityX(p.b.velocity.x * .3); return; }
        // 적중: 물보라와 함께 뒤로 튕겨 오르고 재사용 대기 감소 → 치고 빠지기
        p.b.setVelocity(-p.face * 140, -260); p.jumpsUsed = Math.min(p.jumpsUsed, 1);
        if (a.slot && mem.cd[a.slot] > 0) mem.cd[a.slot] *= .4;
        sc.fx.ring(p.x + p.face * 10, p.y, 22 * s, 0xbfe6ff, 220);
        if (m) {
          const x = p.x + p.face * 12 * s, r = 36 * s;
          sc.combat.hitCircle(x, p.y, r, 1, 'water', { kbx: 240, kby: -160, hs: 0 });
          sc.fx.ring(x, p.y, r, 0x4ac0ff, 260); sc.fx.burst(x, p.y, [0x4ac0ff, 0xbfe6ff, 0xffffff], 20, 160, { up: 80 });
          Sfx.play('water');
        }
      }
    };
  },

  // ===== 나무지기 =====
  leaf_blade(p, i) {
    const m = p.mega.active;
    if (i < 2) return { dur: .17, mm: .5, anim: 'Attack', ev: [[.04, () => slashHit(p, { fwd: 16, w: 34, h: 14, mul: .95, type: 'grass', crit: .25, kbx: 80, kby: -40, color: 0x7aff8a, flipV: i === 1, arc: 17, thick: 3 })]] };
    return {
      dur: .3, ctrl: true, anim: 'Strike', inv: .12,
      update(p, a, dt) {
        p.b.setVelocityX(a.t < .1 ? p.face * 380 : p.b.velocity.x * .7);   // 순식간에 파고들며 벤다
        if (a.t < .1) { a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .025; p.scene.fx.ghost(p.sprite, m ? 0x7affc0 : 0x7aff8a, .55, 200); } }
      },
      ev: [[.1, () => {
        slashHit(p, { fwd: 8, w: 46, h: 22, mul: 1.6, type: 'grass', crit: .45, kbx: 200, kby: -120, color: 0xc8ffb0, arc: 21, thick: 5 });
        if (m) shoot(p, { speed: 300, r: 6, mul: 1, type: 'dragon', kind: 'wave', life: .45, pierce: 99, color: typeColor('dragon'), oy: -2 });   // 메가: 용의 칼날 파동
        Sfx.play('leaf');
      }]]
    };
  },
  bullet_seed(p) {
    const m = p.mega.active;
    return {
      dur: .9, mm: .5, anim: 'Shoot', lockFace: true, tk: 0, n: 0,
      update(p, a, dt) {
        a.tk -= dt;
        if (a.tk > 0) return;
        a.tk = .05;
        shoot(p, { speed: 380, angle: (Math.random() - .5) * .14, r: 2, mul: m ? .15 : .22, type: 'grass', kind: 'seed', life: .5, pierce: m ? 2 : 1, kb: 20, color: 0xd8c060, count: m ? 2 : 1, spread: .1, status: { hs: 0 } });
        p.scene.fx.burst(p.x + p.face * 12, p.y - 3, [0xfff0a0, 0xd8c060], 1, 40, { angle: p.face > 0 ? 0 : Math.PI, spread: .5, up: 0, grav: 0, bounce: false, life: .12 });   // 총구 섬광
        if (a.n++ % 2 === 0) Sfx.play('leaf');
      }
    };
  },
  detect(p) {
    const m = p.mega.active, dur = m ? .8 : .5;
    return {
      dur, mm: 0, anim: 'Idle', inv: dur, tintFill: 0xc8ffc8,
      ev: [[0, () => { p.scene.fx.ring(p.x, p.y, 24, 0xc8ffc8, 200); Sfx.play('select'); }]],
      update(p, a) {
        if (a.done) return;
        const sc = p.scene, pb = p.bounds(), pad = 6;
        let foe = sc.combat.enemiesIn({ x: pb.x - pad, y: pb.y - pad, w: pb.w + pad * 2, h: pb.h + pad * 2 }).find(e => !e.intangible);
        const shot = sc.combat.projs.some(q => q.owner === 'enemy' && Math.abs(q.x - p.x) < 26 && Math.abs(q.y - p.y) < 26);
        if (!foe && !shot) return;
        // 간파! 탄은 지우고, 적의 등 뒤로 돌아 급소를 벤다
        a.done = true; a.dur = a.t + .22;
        if (shot) sc.combat.clearEnemyProjectiles({ x: p.x - 30, y: p.y - 30, w: 60, h: 60 });
        foe = foe || sc.combat.nearest(p.x, p.y, 1, 160)[0];
        sc.fx.floatText(p.x, p.b.y - 10, '판별!', '#c8ffc8', 12);
        sc.fx.hitStop(80); p.inv = Math.max(p.inv, .6);
        Sfx.play('swing');
        if (!foe) return;
        const s = sizeMul(p), dir = Math.sign(foe.x - p.x) || p.face, fb = foe.bounds(), tx = foe.x + dir * (fb.w / 2 + p.b.width / 2 + 4);
        sc.fx.ghost(p.sprite, 0x7aff8a, .7, 300);
        if (!sc.isSolidAt(tx, p.y) && !sc.isSolidAt(tx, p.b.y + 2)) p.b.reset(tx, p.y);
        p.face = -dir; p.refacing();
        const type = m ? 'dragon' : 'grass', col = m ? 0x7affc0 : 0x7aff8a;
        sc.combat.damageEnemy(foe, p.atk * (m ? 3.6 : 3), type, { crit: .5, kb: -dir * 260, kby: -180, hs: 120, hx: foe.x, hy: foe.y });
        sc.fx.slash(foe.x, foe.y, 18 * s, -dir, col, { thick: 6 }); sc.fx.slash(foe.x, foe.y, 18 * s, -dir, 0xffffff, { flipV: true, thick: 3 });
        if (m) { const r = 44 * s; sc.combat.hitCircle(foe.x, foe.y, r, 1.5, 'dragon', { kbx: 200, kby: -140, hs: 0 }); sc.fx.ring(foe.x, foe.y, r, col, 260); }
        p.squash(1.25, .82); Sfx.play('punch');
      }
    };
  },

  // ===== 아차모 =====
  double_kick(p, i) {
    const m = p.mega.active, last = i === 2, col = m ? 0xff9a4a : 0xffc070;
    // 한 번 누르면 발차기 두 번: 낮게 한 번 · 높게 한 번
    const kick = k => () => {
      const up = last && k === 1;
      slashHit(p, { fwd: 14, oy: k ? -6 : 3, w: last ? 28 : 24, h: last ? 22 : 16, mul: last ? (k ? 1 : .8) : .55, type: 'fighting', status: m ? { burn: 1.5 } : {}, kbx: up ? 200 : 80, kby: up ? -280 : -60, color: col, flipV: !k, arc: last ? 15 : 12 });
      if (m) p.scene.fx.embers(p.x + p.face * 16, p.y - 2, [0xff7a2a, 0xffd04a], 3, { speed: 40 });
      Sfx.play('punch');
    };
    return { dur: last ? .34 : .26, mm: .35, anim: last ? 'Strike' : 'Attack', ev: [[.05, kick(0)], [last ? .17 : .14, kick(1)]] };
  },
  blaze_kick(p) {
    const m = p.mega.active;
    return {
      dur: .42, ctrl: true, anim: 'Strike', inv: .15,
      update(p, a) {
        if (a.t < .14) p.b.setVelocity(p.face * 230, a.t < .03 ? -150 : p.b.velocity.y);   // 살짝 뛰어들며
        else p.b.setVelocityX(p.b.velocity.x * .85);
        if (a.t < .2) p.scene.fx.embers(p.x + p.face * 8, p.bottom - 4, [0xff7a2a, 0xffd04a], 2, { speed: 30 });
      },
      ev: [[.14, () => {
        const sc = p.scene, s = sizeMul(p), x = p.x + p.face * 18 * s;
        slashHit(p, { fwd: 18, oy: 2, w: 36, h: 28, mul: 3, type: 'fire', crit: .4, status: { burn: 3.5, hs: 110 }, kbx: 260, kby: -360, color: 0xff8a2a, arc: 20, thick: 7 });
        sc.fx.glow(x, p.y, 26 * s, 0xff5a1a, 240, 1); sc.fx.burst(x, p.y, [0xff7a2a, 0xffd04a, 0xffffff], 14, 150, { glow: true });
        sc.fx.shake(.008, 150); Sfx.play('fire');
        if (m) {   // 메가: 착탄 폭발 + 가속
          const r = 40 * s;
          sc.combat.hitCircle(x, p.y, r, 1.2, 'fire', { burn: 3, kbx: 200, kby: -240, hs: 0 });
          sc.fx.ring(x, p.y, r, 0xffd04a, 280); sc.fx.glow(x, p.y, r, 0xff7a2a, 280, .9);
          p.speedBuff = 3; sc.fx.floatText(p.x, p.b.y - 12, '가속!', '#ffb070', 10);
          Sfx.play('boom');
        }
      }]]
    };
  },
  sky_uppercut(p) {
    const m = p.mega.active, set = new Set(), up = m ? 520 : 430, T = .42;
    return {
      dur: T, ctrl: true, noGrav: true, anim: 'Strike', inv: .2,
      ev: [[0, () => {
        const sc = p.scene, s = sizeMul(p);
        sc.fx.slash(p.x + p.face * 6 * s, p.y - 6 * s, 18 * s, p.face, 0xffd0a0, { a0: -2.4, a1: -.3, thick: 6, ms: 220 });
        sc.fx.burst(p.x, p.bottom - 2, [0xc8c0e0, 0xffd0a0], 10, 90, { up: 60 });
        Sfx.play('punch'); p.squash(.7, 1.35);
      }]],
      update(p, a, dt) {
        const sc = p.scene, s = sizeMul(p), k = 1 - a.t / T;
        p.b.setVelocity(p.face * 70 * k, -up * Math.max(.15, k));
        if (m && a.t > .2 && !a.re) { a.re = true; set.clear(); Sfx.play('punch'); }   // 메가: 상승 중 한 번 더
        sc.combat.hitRect({ x: p.face > 0 ? p.b.x : p.b.x - 10 * s, y: p.b.y - 18 * s, w: p.b.width + 10 * s, h: p.b.height + 18 * s }, m ? 1.6 : 2.6, 'fighting', Object.assign({ set, crit: .2, kbx: 40, kby: -460 }, m ? { burn: 2 } : {}));   // 적을 하늘로 끌어올린다
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .03; sc.fx.ghost(p.sprite, m ? 0xff9a4a : 0xffd0a0, .5, 220); }
        if (m) sc.fx.embers(p.x, p.bottom, [0xff7a2a, 0xffd04a], 1, { speed: 30 });
      },
      end(p) {
        p.b.setVelocity(p.b.velocity.x * .3, -60);
        p.scene.fx.ring(p.x, p.b.y, 20 * sizeMul(p), 0xffd0a0, 220);
        if (m) p.jumpsUsed = Math.min(p.jumpsUsed, 1);
      }
    };
  },

  // ===== 물짱이 =====
  mud_slap(p, i) {
    const m = p.mega.active;
    if (i < 2) return { dur: .22, mm: .4, anim: 'Attack', ev: [[.07, () => { slashHit(p, { fwd: 12, w: 24, h: 18, mul: 1, type: 'ground', color: 0xc0a070, flipV: i === 1 }); p.scene.fx.burst(p.x + p.face * 14, p.y, MUD, 5, 70, { up: 40 }); }]] };
    return {
      dur: .28, mm: .35, anim: 'Shoot', ev: [[.08, () => {
        shoot(p, {
          speed: 250, vy: -70, grav: 300, r: 5, mul: m ? 1.2 : 1.5, type: 'ground', kind: 'mud', life: .9, color: 0x9a7040, status: { slow: 2.5 }, kb: 120, count: m ? 3 : 1, spread: .2,
          onExpire: q => p.scene.fx.burst(q.x, q.y, MUD, 8, 80, { up: 50 })   // 진흙이 튄다
        });
        Sfx.play('water');
      }]]
    };
  },
  // 하이드로 와류 (아쿠아제트 돌격): 물줄기를 휘감고(0.1초) 아쿠아제트로 돌진 — 길의 적을 다단히트로 밀어붙인다
  //  → 멈춘 자리 앞에 고압 물기둥 소용돌이가 솟아 둘레 적을 빨아들이며 다단히트 → 파란 충격파로 터지며 날려 보낸다
  //  물보라 파티클 · 3겹 나선 물줄기 · 파란 쇼크웨이브 링 · 넉백. 메가: 소용돌이 1.35배 + 두 번 터진다
  muddy_water(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p) * (m ? 1.35 : 1);
    const AQUA = [0x1a6ad0, 0x3ab0ff, 0x8ad8ff, 0xffffff];
    const vortex = (x, delay = 0) => sc.time.delayedCall(delay, () => {
      const gy = groundAt(p, x), H = 76 * s, W = 30 * s, cx = x;
      const g = sc.add.graphics().setDepth(43).setBlendMode(Phaser.BlendModes.ADD), gb = sc.add.graphics().setDepth(19);
      sc.fx.ring(cx, gy - 6, 26 * s, 0x3ab0ff, 260); sc.fx.burst(cx, gy - 2, AQUA, 16, 140, { up: 160, size: 2 });
      Sfx.play('water');
      sc.combat.spawnZone({
        x: cx - W, y: gy - H, w: W * 2, h: H, life: m ? 1.15 : .95, tick: .08, type: 'water',
        onTick: z => {   // 빨아들이며 다단히트 (가운데로 끌어당긴다)
          sc.combat.hitRect({ x: cx - W * 1.6, y: gy - H, w: W * 3.2, h: H }, .42, 'water', { kbx: -110, kby: -70, fromX: cx, hs: 0, slow: 1.5 });
          sc.fx.ring(cx, gy - H * (.25 + Math.random() * .6), W * (.8 + Math.random() * .5), 0x8ad8ff, 160);
        },
        onUpdate: (z, dt) => {
          const k = Math.min(1, z.t * 5, (z.life - z.t) * 6), N = 16;
          g.clear(); gb.clear();
          gb.fillStyle(0x0a3a7a, .35 * k); gb.fillEllipse(cx, gy - 1, W * 2.6, 6);   // 바닥 물웅덩이 그림자
          g.fillStyle(0x1a6ad0, .22 * k); g.fillRect(cx - W * .55, gy - H, W * 1.1, H);   // 물기둥 몸통
          for (let j = 0; j < 3; j++) for (let i = 0; i <= N; i++) {   // 3겹 나선 물줄기 (위로 갈수록 넓게 휘돈다)
            const u = i / N, ph = z.t * 15 + u * 7 + j * 2.09, wide = W * (.35 + .75 * u), px = cx + Math.sin(ph) * wide, py = gy - u * H;
            const front = Math.cos(ph) > 0, col = front ? (j === 0 ? 0xffffff : 0x8ad8ff) : 0x3ab0ff;
            g.fillStyle(col, (front ? .95 : .5) * k); g.fillRect(Math.round(px - 1.5), Math.round(py - 1.5), front ? 4 : 3, 3);
          }
          g.fillStyle(0xffffff, .8 * k); g.fillEllipse(cx, gy - H, W * 2.2 * (1 + Math.sin(z.t * 20) * .08), 7);   // 꼭대기 물보라 거품
          if (Math.random() < .9) sc.fx.burst(cx + (Math.random() - .5) * W * 2, gy - H + Math.random() * 10, AQUA, 2, 110, { up: 120, grav: 380, life: .5, size: Math.random() < .4 ? 2 : 1 });
          if (Math.random() < .5) sc.fx.burst(cx + (Math.random() < .5 ? -1 : 1) * W, gy - Math.random() * H, [0x8ad8ff, 0xffffff], 1, 70, { up: 30, grav: 300, life: .35, size: 1 });
        },
        onEnd: () => {   // 파란 쇼크웨이브로 터진다: 바깥으로 크게 날려 보낸다
          g.destroy(); gb.destroy();
          const cy = gy - H * .45, R = 62 * s;
          sc.combat.hitCircle(cx, cy, R, m ? 2.6 : 2.2, 'water', { heavy: true, stun: .35, kbx: 340, kby: -260, hs: 80, onHit: e => sc.fx.starburst(e.x, e.y, 0x8ad8ff, 1.1, { debris: false }) });
          [0, 60, 120].forEach((d, k) => sc.time.delayedCall(d, () => sc.fx.ring(cx, cy, R * (.55 + k * .3), k === 1 ? 0xffffff : 0x3ab0ff, 320)));
          sc.fx.glow(cx, cy, R, 0x3ab0ff, 320, 1);
          sc.fx.burst(cx, cy, AQUA, 40, 260, { up: 150, size: 2, life: .7 });
          sc.fx.shake(.014, 260, 'hit'); Sfx.play('boom'); Sfx.play('water');
        }
      });
    });
    return {
      dur: .5, ctrl: true, anim: 'Attack', inv: .3,
      update(p, a, dt) {
        if (a.t < .1) {   // 물줄기를 휘감는다: 파란 알갱이가 몸으로 빨려 든다
          p.b.setVelocityX(0);
          const ang = Math.random() * Math.PI * 2;
          sc.fx.burst(p.x + Math.cos(ang) * 26, p.y + Math.sin(ang) * 20, AQUA, 2, 140, { angle: ang + Math.PI, spread: .2, up: 0, grav: 0, bounce: false, glow: true, life: .18 });
          return;
        }
        if (a.t < .34) {   // 아쿠아제트 돌격: 몸 둘레를 나선 물줄기가 감싸고, 길의 적을 0.06초마다 때리며 밀어붙인다
          if (!a.go) { a.go = true; sc.fx.sonicBoom(p.x, p.y - 2, p.face, s); sc.fx.ring(p.x, p.y, 20 * s, 0x3ab0ff, 220); Sfx.play('water'); }
          p.b.setAllowGravity(false); p.b.setVelocity(p.face * 300, 0);
          for (let j = 0; j < 3; j++) { const ph = a.t * 46 + j * 2.09; sc.fx.burst(p.x + Math.cos(ph) * 4 - p.face * 4, p.y + Math.sin(ph) * 13 * s, j ? [0x3ab0ff, 0x8ad8ff] : [0xffffff], 1, 20, { angle: p.face > 0 ? Math.PI : 0, spread: .3, up: 0, grav: 0, bounce: false, glow: true, life: .22, size: 2 }); }
          a.tk = (a.tk || 0) - dt;
          if (a.tk <= 0) {
            a.tk = .06;
            sc.combat.hitRect({ x: p.b.x - 6 * s, y: p.b.y - 6 * s, w: p.b.width + 12 * s, h: p.b.height + 12 * s }, .45, 'water', { kbx: 160, kby: -60, hs: 20, onHit: e => sc.fx.burst(e.x, e.y, AQUA, 6, 90, { up: 60, size: 2 }) });
          }
          a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .03; sc.fx.ghost(p.sprite, 0x3ab0ff, .5, 200); }
          return;
        }
        if (!a.vort) {   // 멈춰 서며 앞에 소용돌이를 일으킨다
          a.vort = true; p.b.setAllowGravity(true); p.b.setVelocityX(p.face * 30);
          const vx = p.x + p.face * 34 * s;
          vortex(vx);
          if (m) vortex(vx + p.face * 46 * s, 520);   // 메가: 한 번 더 앞에서
          p.squash(1.25, .82);
        }
      },
      end(p) { p.b.setAllowGravity(true); }
    };
  },
  earthquake(p) {
    const m = p.mega.active, sc = p.scene;
    // 땅 위(접지)한 적만 맞는다. 날아다니는 적은 피한다
    const quake = (cx, by, mul, rng) => {
      const s = sizeMul(p), R = rng * s;
      for (const e of sc.enemies) {
        if (!e.alive || e.intangible || e.flying || Math.abs(e.x - cx) > R) continue;
        if (!e.onGround && Math.abs(sc.groundBelow(e.x, e.y) - e.bottom) > 8) continue;
        sc.combat.damageEnemy(e, p.atk * mul, 'ground', { stun: .35, kb: (Math.sign(e.x - cx) || 1) * 60, kby: -280, hx: e.x, hy: e.bottom - 4, hs: 40 });
        sc.fx.burst(e.x, e.bottom - 2, [0xd8b060, 0x8a6a3a], 8, 120, { up: 160 });
      }
      if (sc.props) sc.props.hitRect({ x: cx - R, y: by - 24, w: R * 2, h: 30 });
      for (let dx = -R; dx <= R; dx += 22) { const gx = cx + dx, gb = sc.groundBelow(gx, by - 30); sc.time.delayedCall(Math.abs(dx) * 1.2, () => sc.fx.burst(gx, gb - 1, [0xd8b060, 0x8a6a3a, 0xc0a050], 4, 90, { up: 150 })); }
      for (const d of [-1, 1]) lineFx(sc, cx, by - 1, cx + d * R * .8, by - 1, 0xd8b060, { seg: 10, jag: 5, w: 2, ms: 500 });   // 갈라지는 땅
      sc.fx.ring(cx, by - 4, R * .5, 0xd8b060, 360);
      sc.fx.shake(.02, 380); Sfx.play('boom'); Sfx.play('thunder');
    };
    return {
      dur: 1, ctrl: true, anim: 'Strike', inv: .3,
      update(p, a) {
        if (a.fired) { p.b.setVelocityX(0); return; }
        if (!p.onGround && a.t < .7) { p.b.setVelocity(0, 640); a.gt = (a.gt || 0) - .016; if (a.gt <= 0) { a.gt = .03; sc.fx.ghost(p.sprite, 0xd8b060, .5, 200); } return; }   // 공중이면 먼저 내리꽂는다
        a.fired = true; a.dur = a.t + (m ? .55 : .3);
        p.b.setVelocity(0, 0); p.squash(1.45, .62);
        const cx = p.x, by = p.bottom;
        quake(cx, by, 3, m ? 300 : 230);
        if (m) sc.time.delayedCall(400, () => quake(cx, by, 1.5, 300));   // 메가: 여진
      }
    };
  }
};
