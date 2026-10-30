// 6·7세대 스타팅 라인 스킬 구현 (도치마론 · 푸호꼬 · 개구마르 · 나몰빼미 · 냐오불 · 누리공)
// 각 스킬은 행동(action) 객체를 돌려준다:
//  { dur, mm(이동 배율), anim, ctrl(속도 직접 제어), noGrav, lockFace, guard, inv, ev:[[시각, fn]], update(p,a,dt), end(p,a) }
import Phaser from 'phaser';
import { typeColor } from '../../data/types.js';
import { Sfx } from '../../systems/Audio.js';
import { sizeMul, slashHit, shoot, lineFx, dashAction, groundAt } from '../skillKit.js';

// 몸 주변 판정 사각형 (pad 만큼 넓힘, 진화 크기 반영)
const bodyRect = (p, pad) => { const s = sizeMul(p); return { x: p.b.x - pad * s, y: p.b.y - pad * s, w: p.b.width + pad * 2 * s, h: p.b.height + pad * 2 * s }; };

// 방향키 8방향 (입력 없으면 바라보는 쪽)
function aim8(p) {
  const inp = p.lastInput || {};
  let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  if (!dx && !dy) dx = p.face;
  const len = Math.hypot(dx, dy);
  return [dx / len, dy / len];
}

// 방어 강화 중인가: 니들가드가 남긴 표시(p.spikyT) 또는 받는 피해 감소 버프
const guardOn = p => (p.spikyT || 0) > p.scene.time.now || !!(Array.isArray(p.buffs) && p.buffs.some(b => b.guard && b.guard < 1 && (b.t ?? 1) > 0));

// 물수리검: 잎날처럼 돌며 날아가는 물 표창 (shoot 과 같은 규칙으로 개수 +α)
function shuriken(p, o) {
  const sc = p.scene, s = sizeMul(p), count = (o.count ?? 1) + p.mods.extraProj, spread = o.spread ?? .12;
  for (let i = 0; i < count; i++) {
    const a = (o.angle ?? 0) + (i - (count - 1) / 2) * spread, sp = o.speed ?? 380;
    const q = sc.combat.spawnProjectile({
      owner: 'player', x: p.x + p.face * 10, y: p.y + (o.oy ?? -4), vx: Math.cos(a) * sp * p.face, vy: Math.sin(a) * sp, r: (o.r ?? 4) * s, mul: o.mul ?? 1,
      type: 'water', kind: 'leaf', life: o.life ?? .6, pierce: o.pierce ?? 1, boomerang: o.boomerang, color: o.color ?? 0x4ac0ff, kb: o.kb ?? 90, light: o.light, status: o.status || {}
    });
    if (q.spr) q.spr.setTint(0xeaf6ff);   // 잎 색 대신 물빛 (예전엔 q.core 였는데 투사체 그림이 바뀌며 없어졌다 — 그대로 부르면 오류로 게임이 멈췄다)
  }
  p.squash(.88, 1.1);
}

// 사이코쇼크 파편: (x, y) 둘레에 파편이 나타났다가 한가운데로 꽂힌다
function psyShards(p, x, y, mul, set) {
  const sc = p.scene, s = sizeMul(p), R = 40 * s, n = 6, off = Math.random() * Math.PI;
  sc.fx.glow(x, y, R, 0xff5a9a, 320, .35);
  for (let k = 0; k < n; k++) {
    const a = off + k / n * Math.PI * 2, c = sc.add.rectangle(x + Math.cos(a) * R, y + Math.sin(a) * R * .8, 3 * s, 9 * s, k % 2 ? 0xff9ad0 : 0xffffff)
      .setRotation(a - Math.PI / 2).setAlpha(0).setDepth(44).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: c, alpha: 1, duration: 120 });
    sc.tweens.add({ targets: c, x, y, delay: 260, duration: 140, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
  }
  sc.time.delayedCall(400, () => {
    sc.combat.hitCircle(x, y, 22 * s, mul, 'psychic', { set, kbx: 90, kby: -120, hs: 60 });
    sc.fx.ring(x, y, 24 * s, 0xff9ad0, 220); sc.fx.burst(x, y, [0xff5a9a, 0xffd0f0, 0xffffff], 12, 140, { glow: true });
    Sfx.play('crack');
  });
}

// 큰 거품에 갇힌 적: 거품 껍질이 적을 따라다니다 터진다
function trapBubble(sc, e, sec) {
  const b = sc.add.image(e.x, e.y, 'ring').setTint(0x9ad8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(44).setScale(Math.max(.5, e.b.height / 40));
  sc.tweens.add({
    targets: b, alpha: { from: .9, to: .45 }, duration: sec * 1000 * (e.boss ? .3 : 1),
    onUpdate: () => b.setPosition(e.x, e.y),
    onComplete: () => { sc.fx.burst(b.x, b.y, [0xbfe6ff, 0xffffff], 10, 90, { glow: true }); b.destroy(); }
  });
}

// 아쿠아링: 액션이 끝나도 남는 물의 고리 (시간 이벤트라 스테이지가 바뀌면 함께 정리된다)
function startAquaRing(p, m) {
  const sc = p.scene, mem = p.m, life = m ? 9 : 6, regen = m ? .02 : .012, combat = sc.combat;
  if (p.aquaRing) p.aquaRing.stop();
  const drops = [0, 1, 2].map(() => sc.add.image(p.x, p.y, 'glow').setTint(0x6ac8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(23).setScale(.3));
  let t = 0, last = sc.time.now, blocks = m ? 2 : 1, ev = null;
  const ring = { stop() { if (ev) ev.remove(); drops.forEach(d => d.destroy()); if (p.aquaRing === ring) p.aquaRing = null; } };
  p.aquaRing = ring;
  ev = sc.time.addEvent({
    delay: 16, loop: true, callback: () => {
      const now = sc.time.now, dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
      if (t >= life || !mem.alive) { if (p.m === mem) sc.fx.burst(p.x, p.y, [0x6ac8ff, 0xffffff], 10, 80, { glow: true }); return ring.stop(); }
      const here = p.m === mem, s = sizeMul(p);
      if (mem.hp < mem.maxhp) mem.hp = Math.min(mem.maxhp, mem.hp + mem.maxhp * regen * dt);   // 교대해 있어도 재생은 계속
      drops.forEach((d, k) => {
        const a = t * 4 + k * Math.PI * 2 / 3, blink = t > life - 1 && Math.floor(t * 10) % 2;
        d.setVisible(here).setPosition(p.x + Math.cos(a) * 16 * s, p.y - 2 + Math.sin(a) * 6 * s).setDepth(Math.sin(a) > 0 ? 23 : 19).setAlpha(blink ? .25 : blocks > 0 ? .9 : .5);
      });
      if (here && Math.random() < .15) sc.fx.embers(p.x + (Math.random() - .5) * 24 * s, p.y + 6, [0x6ac8ff, 0xbfe6ff], 1, { speed: 14 });
      if (!here || blocks <= 0) return;
      // 몸 가까이 온 적 투사체를 고리가 대신 맞는다
      const before = combat.projs.length;
      combat.clearEnemyProjectiles(bodyRect(p, 10));
      if (combat.projs.length < before) {
        blocks--;
        sc.fx.ring(p.x, p.y, 24 * s, 0x6ac8ff, 240); sc.fx.burst(p.x, p.y, [0x6ac8ff, 0xffffff], 12, 110, { glow: true });
        sc.fx.floatText(p.x, p.b.y - 10, blocks > 0 ? '아쿠아링!' : '고리가 막아냈다!', '#8ad8ff', 10);
        Sfx.play('water');
      }
    }
  });
}

const FAKE_OUT_T = new WeakMap();   // 속이다: 적별 마지막 풀죽음 시각

export const SKILL_IMPL = {
  // ===== 도치마론 =====
  needle_arm(p, i) {
    const last = i === 2, m = p.mega.active;
    return {
      dur: last ? .34 : .24, mm: .3, anim: last ? 'Strike' : 'Attack', ev: [[last ? .12 : .07, () => {
        const n = slashHit(p, { fwd: 15, w: last ? 34 : 26, h: last ? 28 : 20, mul: last ? 1.7 : 1, type: 'grass', crit: last ? .1 : 0, kbx: last ? 230 : 110, status: last ? { stun: .5 } : {}, color: 0x9ae05a, flipV: i === 1, arc: last ? 17 : 13, thick: last ? 7 : undefined });
        const s = sizeMul(p), tx = p.x + p.face * 22 * s;
        p.scene.fx.burst(tx, p.y - 2, [0x9ae05a, 0xf0ffd0], last ? 12 : 5, last ? 160 : 90, { angle: p.face > 0 ? 0 : Math.PI, spread: 1.4, up: 10 });   // 튀는 가시
        if (last) {
          Sfx.play('punch'); if (n) p.scene.fx.shake(.006, 120);
          if (m) shoot(p, { speed: 330, r: 3, mul: .55, type: 'grass', kind: 'bolt', life: .45, count: 3, spread: .22, pierce: 2, color: 0xc8ff8a });
        }
      }]]
    };
  },
  spiky_shield(p) {
    const m = p.mega.active, dur = m ? 1.1 : .8, hitT = new Map();
    return {
      dur, mm: 0, anim: 'Idle', guard: m ? 'reflect' : 'spin', inv: dur, lockFace: true, tintFill: 0x9ae05a, tk: 0,
      ev: [[0, () => { p.scene.fx.ring(p.x, p.y, 30 * sizeMul(p), 0x9ae05a, 220); p.squash(1.2, .82); Sfx.play('crack'); }]],
      update(p, a, dt) {
        const sc = p.scene, s = sizeMul(p), now = sc.time.now;
        a.tk -= dt;
        if (a.tk <= 0) {   // 몸 둘레로 가시가 솟는다
          a.tk = .14;
          for (let k = 0; k < 6; k++) { const g = Math.random() * Math.PI * 2; sc.fx.burst(p.x + Math.cos(g) * 14 * s, p.y + Math.sin(g) * 14 * s, [0x9ae05a, 0xe0ffb0], 1, 80, { angle: g, spread: .2, up: 0, grav: 0, bounce: false, life: .18, size: 2 }); }
        }
        // 가시에 닿은 적: 0.3초마다 찔려 튕겨난다
        for (const e of sc.combat.enemiesIn(bodyRect(p, 8))) {
          if (now - (hitT.get(e) ?? -1e9) < 300) continue;
          hitT.set(e, now);
          sc.combat.damageEnemy(e, p.atk * (m ? 1 : .8), 'grass', { kb: (Math.sign(e.x - p.x) || p.face) * 240, kby: -160, hx: e.x, hy: e.y, hs: 40 });
          sc.fx.ring(e.x, e.y, 14, 0xc8ff8a, 180); Sfx.play('crack');
        }
      },
      end(p) {
        const sc = p.scene;
        p.addBuff({ guard: m ? .55 : .7, t: 4, color: 0x9ae05a });
        p.spikyT = sc.time.now + 4000;   // 바디프레스 위력 판정용
        sc.fx.floatText(p.x, p.b.y - 10, '가시 갑옷!', '#b0ff8a', 10);
        if (m) { shoot(p, { speed: 300, r: 3, mul: .6, type: 'grass', kind: 'bolt', life: .4, count: 8, spread: Math.PI / 4, pierce: 2, color: 0xc8ff8a, oy: 0 }); Sfx.play('leaf'); }
      }
    };
  },
  body_press(p) {
    const m = p.mega.active, set = new Set();
    const slam = p => {
      const sc = p.scene, s = sizeMul(p), guarded = guardOn(p), r = 48 * s * (m ? 1.5 : 1), gy = p.bottom;
      sc.combat.hitCircle(p.x, gy - 8, r, 2.4 * (guarded ? 1.6 : 1), 'fighting', { kbx: 200, kby: -320, hs: 110, crit: guarded ? .2 : 0 });
      sc.fx.ring(p.x, gy - 4, r, guarded ? 0x9ae05a : 0xffb070, 300); sc.fx.glow(p.x, gy - 6, r * .8, 0xffb070, 260, .8);
      sc.fx.burst(p.x, gy - 2, [0xc0a070, 0xffd0a0, 0x9ae05a], 26, 220, { up: 150 });
      sc.fx.shake(guarded ? .016 : .011, 240); Sfx.play('boom'); p.squash(1.45, .65);
      if (guarded) sc.fx.floatText(p.x, p.b.y - 14, '철벽 프레스!', '#b0ff8a', 11);
      if (m) for (const ang of [0, Math.PI]) shoot(p, { speed: 300, r: 6, mul: 1, type: 'fighting', kind: 'wave', life: .45, pierce: 99, angle: ang, oy: p.bottom - p.y - 6, color: 0xffb070 });   // 지면 충격파
    };
    return {
      dur: 1.1, ctrl: true, anim: 'Strike', inv: .5, lockFace: true, ph: 0,
      ev: [[0, () => { p.squash(.7, 1.3); Sfx.play('jump'); }]],
      update(p, a, dt) {
        const sc = p.scene;
        if (a.ph === 0) { p.b.setVelocity(p.face * 90, -330); if (a.t > .17) a.ph = 1; return; }   // 뛰어올라
        if (a.ph === 1) {   // 내리꽂기
          p.b.setVelocity(p.face * 50, 760);
          sc.combat.hitRect(bodyRect(p, 4), .8, 'fighting', { set, kbx: 80, kby: -60 });
          a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .03; sc.fx.ghost(p.sprite, 0xd07a5a, .5, 200); }
          if (p.onGround || a.t > .9) { a.ph = 2; a.dur = a.t + .2; slam(p); }
          return;
        }
        p.b.setVelocityX(0);
      }
    };
  },

  // ===== 푸호꼬 =====
  mystical_fire(p, i) {
    const m = p.mega.active;
    if (i < 2) return {
      dur: .22, mm: .4, anim: 'Attack', ev: [[.06, () => {   // 지팡이를 휘두르면 끝에서 불티가 튄다
        const sc = p.scene, s = sizeMul(p), x = p.x + p.face * 20 * s, y = p.y - 6 + i * 6;
        sc.combat.hitCircle(x, y, 13 * s, 1, 'fire', { kbx: 100, kby: -60 });
        sc.fx.slash(p.x + p.face * 10 * s, p.y - 3, 11 * s, p.face, 0xff9ad0, { flipV: i === 1, thick: 2 });
        sc.fx.glow(x, y, 12 * s, 0xff7aa0, 160, .9); sc.fx.embers(x, y, [0xff7aa0, 0xffd04a], 4, { speed: 40 });
        Sfx.play('swing'); p.squash(1.1, .92);
      }]]
    };
    return {
      dur: .32, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        const st = { curse: m ? 6 : 4, burn: 2 }, base = { speed: 210, r: m ? 7 : 6, type: 'fire', kind: 'fire', life: .9, homing: m ? .5 : .35, light: true, color: 0xff6ab0, status: st };
        shoot(p, Object.assign(base, m ? { mul: 0, boom: { r: 34, mul: 1.8, kb: 180 } } : { mul: 1.6, kb: 140 }));
        p.scene.fx.ring(p.x + p.face * 12, p.y - 3, 14, 0xff9ad0, 200);
        Sfx.play('fire');
      }]]
    };
  },
  fire_spin(p) {
    const m = p.mega.active;
    return {
      dur: .4, mm: .2, anim: 'Shoot', ev: [[.14, () => {
        const sc = p.scene, s = sizeMul(p), w = 64 * s * (m ? 1.5 : 1), h = 58 * s * (m ? 1.3 : 1), cx = p.x + p.face * (30 * s + w / 2), gy = groundAt(p, cx);
        const g = sc.add.graphics().setDepth(43).setBlendMode(Phaser.BlendModes.ADD);
        sc.combat.spawnZone({
          x: cx - w / 2, y: gy - h, w, h, life: m ? 3.2 : 2.5, tick: .3, draw: 'fire', type: 'fire', color: 0xff7a2a,
          onTick: z => {
            const es = sc.combat.enemiesIn(z);
            for (const e of es) sc.combat.damageEnemy(e, p.atk * .32, 'fire', { root: .45, burn: 2.5, kb: m ? Math.sign(cx - e.x) * 70 : 0, kby: 0, hs: 0, hx: e.x, hy: e.y });   // 각성: 중심으로 빨아들인다
            if (es.length) Sfx.play('fire');
          },
          onUpdate: z => {   // 위로 갈수록 넓어지는 불꽃 소용돌이
            g.clear();
            const k = Math.min(1, z.t * 6, (z.life - z.t) * 4), sp = z.t * 12;
            for (let j = 0; j < 18; j++) {
              const u = j / 17, y = z.y + z.h - u * z.h, r = z.w / 2 * (.3 + .7 * u), a = sp + u * 7;
              g.lineStyle(2, j % 2 ? 0xffd04a : 0xff5a1a, .85 * k * (1 - u * .3));
              g.beginPath(); g.arc(cx, y, r, a, a + 2.2); g.strokePath();
            }
          },
          onEnd: () => g.destroy()
        });
        sc.fx.burst(cx, gy - 4, [0xff7a2a, 0xffd04a, 0xff4a2a], 18, 140, { up: 120, glow: true });
        Sfx.play('fire');
      }]]
    };
  },
  psyshock(p) {
    const m = p.mega.active;
    return {
      dur: .42, mm: .3, anim: 'Shoot', ev: [[.12, () => {
        const sc = p.scene, s = sizeMul(p), targets = sc.combat.nearest(p.x, p.y, m ? 6 : 3, 260).map(e => ({ x: e.x, y: e.y }));
        if (!targets.length) targets.push({ x: p.x + p.face * 70 * s, y: p.y - 4 });
        const set = new Set();
        for (const t of targets) psyShards(p, t.x, t.y, m ? 1.6 : 2.6, set);
        if (m) sc.time.delayedCall(380, () => { const set2 = new Set(); for (const t of targets) psyShards(p, t.x, t.y, 1.6, set2); });
        sc.fx.glow(p.x, p.y - 4, 22 * s, 0xff5a9a, 260, .8); p.flash(80);
        Sfx.play('wave');
      }]]
    };
  },

  // ===== 개구마르 =====
  water_shuriken(p, i) {
    const m = p.mega.active;
    if (i < 2) return { dur: .19, mm: .5, anim: 'Attack', ev: [[.05, () => slashHit(p, { fwd: 13, w: 24, h: 18, mul: .95, type: 'water', kbx: 100, color: 0x8ad0ff, flipV: i === 1 })]] };
    return {
      dur: m ? .4 : .32, mm: .4, anim: 'Shoot', ev: [
        ...[0, 1, 2].map(k => [.05 + k * .05, () => { shuriken(p, { mul: .6, angle: (k - 1) * .07, oy: -6 + k * 2 }); Sfx.play('swing'); }]),
        ...(m ? [[.2, () => {   // 유대변화: 등에 진 거대 물수리검
          shuriken(p, { r: 11, mul: 2, speed: 300, life: 1.6, pierce: 99, boomerang: .42, kb: 200, color: 0x2a8aff, light: true, oy: -8 });
          p.scene.fx.ring(p.x, p.y - 8, 26, 0x4ac0ff, 240); p.scene.fx.shake(.006, 120); Sfx.play('water');
        }]] : [])
      ]
    };
  },
  night_slash(p) {
    const m = p.mega.active, face = p.face;
    return dashAction(p, {
      dur: m ? .2 : .16, vx: m ? 680 : 560, mul: 0, type: 'dark', color: 0x7a5aa0, anim: 'Strike',   // 지날 때는 베지 않는다 (상태만)
      end(p, passed) {
        const sc = p.scene, s = sizeMul(p);
        sc.fx.slash(p.x - face * 6 * s, p.y - 2, 15 * s, face, 0xc8b0ff, { thick: 3 });
        Sfx.play('swing');
        // 한 박자 늦게, 지나친 적 모두가 베인다
        sc.time.delayedCall(140, () => {
          for (const e of passed) {
            if (!e.alive) continue;
            sc.combat.damageEnemy(e, p.atk * 2.8, 'dark', { crit: m ? .94 : .45, kb: face * 150, kby: -110, hx: e.x, hy: e.y, hs: 90 });
            const r = 16 * s;
            lineFx(sc, e.x - r, e.y - r, e.x + r, e.y + r, 0xc8b0ff, { seg: 2, jag: 0, w: 2, ms: 220 });
            lineFx(sc, e.x - r, e.y + r, e.x + r, e.y - r, 0x9a7aff, { seg: 2, jag: 0, w: 2, ms: 220 });
          }
          if (passed.size) { sc.fx.shake(.008, 140); Sfx.play('crack'); }
        });
      }
    });
  },
  double_team(p) {
    const m = p.mega.active;
    return {
      dur: .26, mm: 0, anim: 'Walk', inv: .6, ev: [[.02, () => {
        const sc = p.scene, s = sizeMul(p), sp = p.sprite, inp = p.lastInput || {}, dir = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) || p.face;
        const ox = p.x, oy = p.y, n = m ? 4 : 2, col = typeColor('dark');
        // 분신: 지금 모습을 본뜬 잔영
        const clones = [];
        for (let k = 0; k < n; k++) {
          const c = sc.add.image(sp.x - dir * k * 9 * s, sp.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setFlipX(sp.flipX).setScale(sp.scaleX, sp.scaleY)
            .setDepth(21).setTint(k % 2 ? 0x8aa0ff : 0x6a8aff).setAlpha(.75);
          c.flick = sc.tweens.add({ targets: c, alpha: .35, duration: 90, yoyo: true, repeat: -1 });
          clones.push(c);
        }
        // 순간이동: 벽에 막히기 전까지 한 칸씩 확인
        let d = 0; const max = 84 * s;
        while (d + 8 <= max && !sc.isSolidAt(ox + dir * (d + 8), oy) && !sc.isSolidAt(ox + dir * (d + 8), oy + 6)) d += 8;
        p.face = dir; p.refacing();
        p.b.reset(ox + dir * d, oy);
        sc.fx.burst(ox, oy, [col, 0x6a8aff, 0xffffff], 10, 90, { glow: true });
        sc.fx.ring(p.x, p.y, 18 * s, 0x8aa0ff, 200); Sfx.play('dash');
        // 분신이 터진다 (각성: 각자 가까운 적에게 달려든 뒤)
        const targets = m ? sc.combat.nearest(ox, oy, n, 220) : [];
        clones.forEach((c, k) => {
          const boom = () => {
            if (!c.active) return;
            sc.combat.hitCircle(c.x, c.y, 34 * s, m ? 1.1 : 1.3, 'dark', { kbx: 200, kby: -160 });
            sc.fx.ring(c.x, c.y, 34 * s, 0x6a8aff, 260); sc.fx.burst(c.x, c.y, [col, 0x4ac0ff, 0xffffff], 16, 160, { glow: true });
            Sfx.play('boom'); c.flick.remove(); c.destroy();
          };
          const t = targets[k];
          if (t) sc.tweens.add({ targets: c, x: t.x, y: t.y + (sp.y - oy), delay: 220 + k * 60, duration: 160, ease: 'Quad.easeIn', onComplete: boom });
          else sc.time.delayedCall(650 + k * 90, boom);
        });
      }]]
    };
  },

  // ===== 나몰빼미 =====
  leafage(p, i) {
    const m = p.mega.active, last = i === 2;
    return {
      dur: last ? .28 : .2, mm: .45, anim: 'Shoot', ev: [[.06, () => {
        shoot(p, { speed: last ? 300 : 340, r: last ? 3.5 : 3, mul: last ? (m ? .5 : .6) : 1, type: 'grass', kind: 'leaf', life: .6, count: last ? (m ? 5 : 3) : 1, spread: .2, angle: last ? 0 : (i ? -.08 : .04), pierce: m ? 2 : 1, kb: 70 });
        Sfx.play('leaf');
      }]]
    };
  },
  spirit_shackle(p) {
    const m = p.mega.active, n = m ? 5 : 3;
    const arrow = k => () => {
      const sc = p.scene;
      shoot(p, {
        speed: 440, r: 3, mul: .9, type: 'ghost', kind: 'bolt', life: .7, ghost: true, pierce: 2, color: 0x9a5aff, angle: (k - (n - 1) / 2) * .06, oy: -5,
        onHit: (e, q) => {   // 그림자를 땅에 꿰맨다
          sc.combat.damageEnemy(e, q.dmg, 'ghost', { root: m ? 2.2 : 1.4, curse: 5, kb: 0, kby: 0, hx: q.x, hy: q.y, hs: 40 });
          const gy = sc.groundBelow(e.x, e.y);
          lineFx(sc, q.x, q.y, e.x, gy, 0x9a5aff, { seg: 5, jag: 4, w: 2, ms: 600 });
          sc.fx.glow(e.x, gy - 2, 14, 0x6a2aff, 500, .8);
        }
      });
      Sfx.play('ghost');
    };
    return { dur: .2 + n * .06, mm: .3, anim: 'Shoot', lockFace: true, ev: Array.from({ length: n }, (_, k) => [.06 + k * .06, arrow(k)]) };
  },
  brave_bird(p) {
    const m = p.mega.active, [dx, dy] = aim8(p), sp = m ? 600 : 500, set = new Set(), col = 0x8ab8ff;
    if (dx) p.face = Math.sign(dx);
    return {
      dur: .44, ctrl: true, noGrav: true, anim: 'Attack', inv: .44, lockFace: true,
      ev: [[0, () => { p.scene.fx.glow(p.x, p.y, 30, col, 200, .9); p.squash(.7, 1.3); Sfx.play('wave'); }], [.14, () => { p.squash(1.35, .75); Sfx.play('dash'); }]],
      update(p, a, dt) {
        const sc = p.scene, s = sizeMul(p);
        if (a.t < .14) {   // 날개를 접고 살짝 물러섰다가
          p.b.setVelocity(-dx * 40, -dy * 40);
          sc.fx.embers(p.x, p.y, [col, 0xffffff], 2, { speed: 50 });
          return;
        }
        p.b.setVelocity(dx * sp, dy * sp);
        const n = sc.combat.hitRect(bodyRect(p, 8), m ? 3.2 : 2.8, 'flying', { set, kbx: 300, kby: -220, hs: 90 });
        if (n && !a.hit) { a.hit = true; sc.fx.ring(p.x, p.y, 34 * s, col, 260); sc.fx.burst(p.x, p.y, [col, 0xffffff], 20, 200, { glow: true }); sc.fx.shake(.012, 180); Sfx.play('boom'); }
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .025; sc.fx.ghost(p.sprite, col, .6, 240); }
        // 벽·땅에 처박히면 그 자리에서 충격
        const bl = p.b.blocked;
        if (!a.crash && ((dx > 0 && bl.right) || (dx < 0 && bl.left) || (dy > 0 && bl.down) || (dy < 0 && bl.up))) {
          a.crash = true; a.dur = a.t + .06;
          sc.combat.hitCircle(p.x, p.y, 30 * s, 1, 'flying', { set, kbx: 220 });
          sc.fx.ring(p.x, p.y, 30 * s, col, 220); sc.fx.shake(.008, 140); Sfx.play('punch');
        }
      },
      end(p, a) {
        p.b.setVelocity(p.b.velocity.x * .3, p.b.velocity.y * .3); p.jumpsUsed = 1;
        if (a.hit) { p.selfDamage(p.m.maxhp * (m ? .03 : .06)); p.scene.fx.floatText(p.x, p.b.y - 6, '반동!', '#ff9a8a', 10); }
      }
    };
  },

  // ===== 냐오불 =====
  fire_fang(p, i) {
    const m = p.mega.active, last = i === 2;
    return {
      dur: last ? .32 : .22, mm: .35, ctrl: last, anim: last ? 'Strike' : 'Attack',
      update: last ? (p, a) => p.b.setVelocityX(a.t < .12 ? p.face * 230 : p.b.velocity.x * .8) : undefined,   // 3타째는 달려들며 문다
      ev: [[last ? .1 : .06, () => {
        const sc = p.scene, s = sizeMul(p), fx = p.x + p.face * 14 * s, col = 0xff8a3a;
        slashHit(p, { fwd: 13, w: last ? 28 : 22, h: last ? 24 : 18, mul: last ? 1.7 : 1, type: 'fire', crit: last ? .15 : 0, kbx: last ? 200 : 90, status: last ? { burn: 3, stun: .45 } : {}, color: col, arc: last ? 15 : 11 });
        sc.fx.slash(fx, p.y - 2, (last ? 13 : 10) * s, p.face, 0xffe0a0, { flipV: true, thick: 3 });   // 아래 송곳니가 맞물린다
        sc.fx.embers(fx, p.y - 2, [col, 0xffd04a], last ? 8 : 3, { speed: 50 });
        if (last) {
          Sfx.play('punch'); Sfx.play('fire');
          if (m) { const bx = p.x + p.face * 24 * s; sc.combat.hitCircle(bx, p.y - 2, 28 * s, .8, 'fire', { burn: 3, kbx: 160 }); sc.fx.glow(bx, p.y - 2, 28 * s, 0xff5a1a, 240, 1); sc.fx.ring(bx, p.y - 2, 28 * s, 0xffd04a, 220); }
        }
      }]]
    };
  },
  darkest_lariat(p) {
    const m = p.mega.active, g = p.scene.add.graphics().setDepth(23).setBlendMode(Phaser.BlendModes.ADD);
    const arm = m ? 0xff5a1a : 0x8a5ad8;
    return {
      dur: m ? 1.3 : 1, mm: .65, anim: 'Attack', tk: 0, ft: 0, ang: 0,
      update(p, a, dt) {
        const sc = p.scene, s = sizeMul(p), r = 34 * s * (m ? 1.35 : 1);
        a.tk -= dt; a.ft -= dt; a.ang += dt * 22;
        if (a.ft <= 0) { a.ft = .09; p.face *= -1; p.refacing(); }
        // 회전하는 두 팔
        g.clear();
        for (const k of [0, Math.PI]) {
          const x2 = p.x + Math.cos(a.ang + k) * r, y2 = p.y - 2 + Math.sin(a.ang + k) * r * .35;
          g.lineStyle(4 * s, arm, .85); g.lineBetween(p.x, p.y - 2, x2, y2);
          g.fillStyle(0xffe0a0, 1); g.fillCircle(x2, y2, 3 * s);
        }
        if (a.tk <= 0) {   // 살짝 끌어당기며 연타
          a.tk = .13;
          sc.combat.hitCircle(p.x, p.y, r, .38, 'dark', Object.assign({ kbx: -50, kby: -60, hs: 20 }, m ? { burn: 2 } : {}));
          sc.fx.ring(p.x, p.y, r, arm, 140);
          if (m) sc.fx.embers(p.x, p.y, [0xff7a2a, 0xffd04a], 4, { speed: 60 });
          Sfx.play('swing');
        }
      },
      end(p, a) {
        g.destroy();
        if (a.t < a.dur - .02) return;   // 끊기면 마무리 없음
        const sc = p.scene, r = 38 * sizeMul(p) * (m ? 1.35 : 1);
        sc.combat.hitCircle(p.x, p.y, r, 1, 'dark', Object.assign({ kbx: 260, kby: -200, hs: 80 }, m ? { burn: 3 } : {}));
        sc.fx.ring(p.x, p.y, r, arm, 260); sc.fx.burst(p.x, p.y, [arm, 0xffe0a0, 0xffffff], 18, 180, { glow: true });
        sc.fx.shake(.008, 140); Sfx.play('punch');
      }
    };
  },
  fake_out(p) {
    const m = p.mega.active, stun = m ? 1.4 : 1;
    // 풀죽음: 같은 적은 4초에 한 번만
    const flinch = (sc, e) => { const now = sc.time.now; if (now - (FAKE_OUT_T.get(e) ?? -1e9) < 4000) return; FAKE_OUT_T.set(e, now); sc.combat.damageEnemy(e, 0, 'normal', { stun }); };
    const clap = p => {
      const sc = p.scene, s = sizeMul(p), x = p.x + p.face * 10 * s;
      sc.fx.ring(x, p.y - 6, 16 * s, 0xffffff, 180); sc.fx.burst(x, p.y - 6, [0xffffff, 0xfff0c0], 10, 120, { glow: true, up: 20 });
      p.flash(60); Sfx.play('punch');
      if (m) { const set = new Set(); sc.combat.hitCircle(p.x, p.y, 40 * s, .5, 'normal', { set, kbx: 80, kby: -60 }); for (const e of set) flinch(sc, e); sc.fx.ring(p.x, p.y, 40 * s, 0xfff0c0, 240); }
    };
    const act = dashAction(p, {
      dur: .1, vx: 520, mul: .9, type: 'normal', color: 0xfff0c0, anim: 'Strike', kbx: 60,
      tick(p, a, dt, set) { for (const e of set) if (!a.done?.has(e)) { a.done = a.done || new Set(); a.done.add(e); flinch(p.scene, e); } },
      end(p) { p.speedBuff = Math.max(p.speedBuff, 1); if (m) clap(p); }
    });
    act.ev = [[0, () => clap(p)]];
    return act;
  },

  // ===== 누리공 =====
  bubble_note(p, i) {
    const m = p.mega.active;
    if (i < 2) return { dur: .22, mm: .45, anim: 'Shoot', ev: [[.06, () => { shoot(p, { speed: 210, vy: i ? -20 : 10, r: 4, mul: .95, type: 'water', kind: 'bubble', life: .7, kb: 60, color: 0x7ad0ff }); Sfx.play('water'); }]] };
    return {
      dur: .34, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        const sc = p.scene, base = { speed: 120, r: 9, type: 'water', kind: 'bubble', life: 1.2, color: 0xa0e0ff, light: true };
        if (m) shoot(p, Object.assign(base, { mul: 0, status: { root: 1.6 }, boom: { r: 36, mul: 1.8, kb: 120 } }));   // 터지며 주변까지 가둔다
        else shoot(p, Object.assign(base, {
          mul: 1.6,
          onHit: (e, q) => { sc.combat.damageEnemy(e, q.dmg, 'water', { root: 1.6, kb: 0, kby: 0, hx: q.x, hy: q.y }); trapBubble(sc, e, 1.6); },
          onExpire: q => sc.fx.ring(q.x, q.y, q.r * 2, 0xbfe6ff, 200)
        }));
        Sfx.play('water');
      }]]
    };
  },
  sparkling_aria(p) {
    const m = p.mega.active;
    return {
      dur: 1.1, mm: .5, anim: 'Shoot', tk: 0,
      ev: [
        [0, () => { p.scene.fx.ring(p.x, p.y, 40 * sizeMul(p), 0xffa0e0, 300); Sfx.play('wave'); }],
        [1.05, () => {   // 끝까지 부르면 파티 회복
          const sc = p.scene;
          for (const mb of p.members) if (mb.alive) mb.hp = Math.min(mb.maxhp, mb.hp + mb.maxhp * (m ? .1 : .06));
          sc.fx.floatText(p.x, p.b.y - 16, '파티 회복!', '#7dff9a', 11);
          sc.fx.burst(p.x, p.y, [0xffa0e0, 0x7ad0ff, 0xffffff], 20, 120, { grav: -40, bounce: false, glow: true });
          Sfx.play('heal');
        }]
      ],
      update(p, a, dt) {
        a.tk -= dt;
        if (a.tk > 0 || a.t > .9) return;
        a.tk = m ? .05 : .075;
        // 머리 위에서 거품이 쏟아진다 (천장 안에서는 생기지 않게)
        const sc = p.scene, s = sizeMul(p), x = p.x + (Math.random() - .5) * 180 * s;
        let y = p.y - 90 * s; while (y < p.y - 10 && sc.isSolidAt(x, y)) y += 8;
        sc.combat.spawnProjectile({ owner: 'player', x, y, vx: (Math.random() - .5) * 30, vy: 40, grav: 220, r: (m ? 5 : 4) * s, mul: m ? .3 : .35, type: 'water', kind: 'bubble', life: 1.3, color: Math.random() < .5 ? 0x7ad0ff : 0xffa0e0, homing: m ? .5 : 0, kb: 40 });
        sc.fx.embers(x, y, [0xffffff, 0xffa0e0], 2, { speed: 20 });   // 음표처럼 반짝
        if (Math.random() < .3) Sfx.play('water');
      }
    };
  },
  aqua_ring(p) {
    const m = p.mega.active;
    return {
      dur: .45, mm: .2, anim: 'Idle', ev: [[.12, () => {
        const sc = p.scene, s = sizeMul(p);
        startAquaRing(p, m);
        sc.fx.ring(p.x, p.y, 26 * s, 0x6ac8ff, 300); sc.time.delayedCall(90, () => sc.fx.ring(p.x, p.y, 18 * s, 0xbfe6ff, 260));
        sc.fx.burst(p.x, p.y, [0x6ac8ff, 0xbfe6ff], 14, 90, { grav: -40, bounce: false, glow: true });
        Sfx.play('heal');
      }]]
    };
  }
};
