// 액션 메커니즘 모음 — 2D 액션·로그라이크에서 흔히 쓰는 투사체 궤적·광역 패턴을 이 게임 투사체(Combat.spawnProjectile)·판정 위에 얹었다
//  (외부 코드를 그대로 옮기지 않고 같은 기법을 이 게임 구조에 맞게 새로 짰다)
//  · bezierMissiles  유도탄: 2차 베지어 곡선으로 휘어 날아가 목표를 끝까지 쫓는다 (목표가 움직이면 끝점이 따라간다)
//  · groundShockwave 지면 충격파: 바닥을 타고 달리고, 낭떠러지·벽을 만나면 사라진다
//  · orbitSatellites 위성 구체: 몸 둘레를 돌며 닿는 적을 0.4초마다 다시 때린다
//  · skyStrike       하늘 강타: 적 머리 위로 번개·바위가 내리꽂힌다 (경고 표시 → 강타)
//  · soundRing       음파 고리: 퍼져 나가는 고리가 지나가는 적을 한 번씩 친다
//  · radialBurst     주변 폭발: 몸 둘레 원형 판정 + 충격 고리
//  · groundZone      장판: 바닥에 몇 초 남아 계속 피해
//  · boomerang       부메랑 왕복은 Combat 투사체의 boomerang 옵션을 그대로 쓴다
import Phaser from 'phaser';
import { typeColor } from '../data/types.js';
import { Sfx } from '../systems/Audio.js';
import { shockwave } from '../systems/PostFX.js';

const ADD = Phaser.BlendModes.ADD;
const sizeOf = p => p.mods.sizeMul * p.fxMul * (p.sp.reach || 1);

// 타입 → 투사체 모양 (systems/ProjectileRenderer.js 의 kind)
export const KIND = { fire: 'fire', water: 'water', grass: 'leaf', electric: 'bolt', ghost: 'shadow', dark: 'shadow', rock: 'rock', ground: 'rock', steel: 'steel', poison: 'bubble', bug: 'leaf' };
export const kindOf = type => KIND[type] || 'other';

// ---------------- 유도탄 (2차 베지어) ----------------
//  o: { n, mul, type, speed, r, status, lifesteal, arc(휘는 정도) }
export function bezierMissiles(p, o) {
  const sc = p.scene, s = sizeOf(p), n = (o.n ?? 2) + p.mods.extraProj, targets = sc.combat.nearest(p.x, p.y, n, 300);
  for (let i = 0; i < n; i++) {
    const tgt = targets[i % Math.max(1, targets.length)] || null;
    const x0 = p.x + p.face * 10, y0 = p.y - 6, side = i % 2 ? 1 : -1, arc = (o.arc ?? 70) * (1 + i * .15);
    const c = { x: x0 + p.face * 30, y: y0 - arc * (side > 0 ? 1 : .55) };   // 조종점: 앞 위쪽으로 크게 휘었다가 내려꽂힌다
    const fallback = { x: x0 + p.face * 220, y: y0 + side * 20 };
    const end = () => (tgt && tgt.alive ? { x: tgt.x, y: tgt.y } : fallback);
    const e0 = end(), T = Math.max(.35, Math.hypot(e0.x - x0, e0.y - y0) / (o.speed ?? 320));
    sc.time.delayedCall(i * 70, () => {
      if (!p.scene) return;
      sc.combat.spawnProjectile({
        owner: 'player', x: x0, y: y0, vx: 0, vy: 0, r: (o.r ?? 4) * s, mul: o.mul ?? .8, type: o.type, kind: kindOf(o.type), color: o.color ?? typeColor(o.type),
        life: T + .6, pierce: 1, ghost: true, status: o.status || {}, tier: p.tierIdx, pow: s, stream: true,
        update: (q, dt) => {
          const k = q.t / T;
          if (k >= 1) { q.ghost = false; return; }   // 끝까지 오면 마지막 방향으로 곧게
          const e = end(), u = 1 - k, bx = u * u * x0 + 2 * u * k * c.x + k * k * e.x, by = u * u * y0 + 2 * u * k * c.y + k * k * e.y;
          q.vx = (bx - q.x) / Math.max(dt, .001); q.vy = (by - q.y) / Math.max(dt, .001);   // 적분 뒤 정확히 곡선 위에 오도록 속도로 맞춘다
        },
        onHit: o.lifesteal ? (e, q) => { sc.combat.damageEnemy(e, q.dmg, q.type, Object.assign({ lifesteal: o.lifesteal, hx: q.x, hy: q.y }, q.status)); } : undefined
      });
    });
  }
  Sfx.play('wave');
}

// ---------------- 지면 충격파 ----------------
//  o: { dirs: [1] | [-1, 1], mul, type, speed, life, r }
export function groundShockwave(p, o) {
  const sc = p.scene, s = sizeOf(p), col = o.color ?? typeColor(o.type);
  for (const d of o.dirs || [p.face]) {
    const r = (o.r ?? 7) * s, gy0 = sc.groundBelow(p.x, p.y - 4);
    let dustT = 0;
    sc.combat.spawnProjectile({
      owner: 'player', x: p.x + d * 12, y: gy0 - r, vx: d * (o.speed ?? 300), vy: 0, r, mul: o.mul ?? 1, type: o.type, kind: 'wave', color: col,
      life: o.life ?? .9, pierce: 99, muzzle: false, tier: p.tierIdx, pow: s, kb: 60, status: Object.assign({ kby: -220 }, o.status || {}),
      update: (q, dt) => {
        const gy = sc.groundBelow(q.x, q.y - 6);
        if (gy - (q.y + q.r) > 26) { q.kill = 'expire'; return; }   // 낭떠러지: 땅이 끊기면 사라진다
        q.y = gy - q.r - 1; q.vy = 0;
        dustT -= dt;
        if (dustT <= 0) { dustT = .05; sc.fx.burst(q.x, gy - 1, [col, 0xe8dcc0], 2, 60, { angle: -Math.PI / 2, spread: .9, up: 70, grav: 600, size: 2, life: .35 }); }
      }
    });
  }
  sc.fx.shake(.008, 160, 'hit'); Sfx.play('boom');
}

// ---------------- 위성 구체 ----------------
//  o: { n, mul, type, dur, R, speed(rad/s), r }
export function orbitSatellites(p, o) {
  const sc = p.scene, s = sizeOf(p), n = (o.n ?? 3) + p.mods.extraProj, R = (o.R ?? 30) * s, w = o.speed ?? 4.2, dur = o.dur ?? 4;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2;
    let reHit = .4;
    sc.combat.spawnProjectile({
      owner: 'player', x: p.x, y: p.y, vx: 0, vy: 0, r: (o.r ?? 5) * s, mul: o.mul ?? .5, type: o.type, kind: kindOf(o.type), color: o.color ?? typeColor(o.type),
      life: dur, pierce: 999, ghost: true, muzzle: false, tier: p.tierIdx, pow: s, status: o.status || {},
      update: (q, dt) => {
        if (!p.scene || !p.m.alive) { q.life = 0; return; }
        const a = a0 + q.t * w, tx = p.x + Math.cos(a) * R, ty = p.y - 4 + Math.sin(a) * R * .75;
        q.vx = (tx - q.x) / Math.max(dt, .001); q.vy = (ty - q.y) / Math.max(dt, .001);
        reHit -= dt;
        if (reHit <= 0) { reHit = .4; q.hit.clear(); }   // 같은 적을 0.4초마다 다시
      }
    });
  }
  sc.fx.ring(p.x, p.y, R, o.color ?? typeColor(o.type), 300); Sfx.play('wave');
}

// ---------------- 하늘 강타 ----------------
//  o: { n, mul, type, falling(바위처럼 떨어진다), status }
export function skyStrike(p, o) {
  const sc = p.scene, s = sizeOf(p), col = o.color ?? typeColor(o.type), n = (o.n ?? 3) + p.mods.extraProj;
  const tg = sc.combat.nearest(p.x, p.y, n, 280).map(e => e.x);
  while (tg.length < n) tg.push(p.x + p.face * (50 + tg.length * 46) * s);
  const top = sc.cameras.main.worldView.y - 10;
  tg.forEach((x0, k) => {
    const x = x0 + (Math.random() - .5) * 8, gy = sc.groundBelow(x, p.y - 30), w = 16 * s;
    sc.fx.glow(x, gy - 2, 14 * s, col, 300, .6);
    sc.time.delayedCall(260 + k * 110, () => {
      if (!p.scene) return;
      if (o.falling) {
        sc.combat.spawnProjectile({ owner: 'player', x, y: Math.max(top, gy - 220), vx: 0, vy: 520, grav: 300, r: 7 * s, mul: o.mul ?? 1, type: o.type, kind: 'rock', color: col, life: 1.2, ghost: true, muzzle: false, tier: p.tierIdx, pow: s,
          boom: { r: 26 * s, mul: o.mul ?? 1, kb: 160 }, status: o.status || {}, update: q => { if (q.y >= gy - 6) q.kill = 'wall'; } });
      } else {
        sc.combat.hitRect({ x: x - w / 2, y: Math.max(top, gy - 220), w, h: gy - Math.max(top, gy - 220) }, o.mul ?? 1, o.type, Object.assign({ kbx: 40, kby: -200, hs: 40, fromX: x }, o.status || {}));
        const g = sc.add.graphics().setDepth(42).setBlendMode(ADD);
        for (const [lw, c, a] of [[w * .9, col, .35], [w * .45, col, .8], [w * .18, 0xffffff, 1]]) { g.fillStyle(c, a); g.fillRect(x - lw / 2, Math.max(top, gy - 220), lw, gy - Math.max(top, gy - 220)); }
        sc.tweens.add({ targets: g, alpha: 0, scaleX: .2, x: x * .8, duration: 260, onComplete: () => g.destroy() });
        sc.fx.burst(x, gy - 2, [col, 0xffffff], 12, 140, { up: 120, glow: true }); sc.fx.ring(x, gy - 4, 20 * s, col, 240);
        sc.fx.shake(.005, 90, 'hit'); Sfx.play(o.type === 'electric' ? 'zap' : 'boom');
      }
    });
  });
}

// ---------------- 음파 고리 ----------------
export function soundRing(p, o) {
  const sc = p.scene, s = sizeOf(p), col = o.color ?? typeColor(o.type), max = (o.R ?? 110) * s, speed = 260, hit = new Set(), cx = p.x, cy = p.y - 4;
  const g = sc.add.graphics().setDepth(42).setBlendMode(ADD);
  let R = 8;
  const ev = sc.time.addEvent({ delay: 16, loop: true, callback: () => {
    if (!g.scene) { ev.remove(); return; }
    R += speed * .016;
    const a = Math.max(0, 1 - R / max);
    g.clear(); g.lineStyle(6 * s, col, .3 * a); g.strokeCircle(cx, cy, R); g.lineStyle(2, 0xffffff, .9 * a); g.strokeCircle(cx, cy, R);
    for (const e of sc.enemies) {
      if (!e.alive || hit.has(e) || Math.abs(Phaser.Math.Distance.Between(cx, cy, e.x, e.y) - R) > 12) continue;
      hit.add(e);
      sc.combat.damageEnemy(e, p.atk * (o.mul ?? 1), o.type, Object.assign({ kb: Math.sign(e.x - cx) * 160, kby: -90, hx: e.x, hy: e.y }, o.status || {}));
    }
    if (R >= max) { ev.remove(); g.destroy(); }
  } });
  Sfx.play('wave');
}

// ---------------- 주변 폭발 ----------------
export function radialBurst(p, o) {
  const sc = p.scene, s = sizeOf(p), col = o.color ?? typeColor(o.type), r = (o.R ?? 54) * s;
  sc.combat.hitCircle(p.x, p.y, r, o.mul ?? 1, o.type, Object.assign({ kbx: 220, kby: -200, hs: 70 }, o.status || {}));
  for (let k = 0; k < 3; k++) sc.time.delayedCall(k * 70, () => sc.fx.ring(p.x, p.y, r * (.55 + k * .25), k % 2 ? 0xffffff : col, 320));
  sc.fx.glow(p.x, p.y, r, col, 320, .8);
  sc.fx.burst(p.x, p.y, [col, 0xffffff], 30, 220 * s, { glow: true, grav: 0, bounce: false, life: .5 });
  sc.fx.shake(.01, 200, 'hit'); Sfx.play('boom');
  shockwave(sc, p.x, p.y, .03, 550);
}

// ---------------- 장판 ----------------
export function groundZone(p, o) {
  const sc = p.scene, s = sizeOf(p), col = o.color ?? typeColor(o.type), w = (o.w ?? 80) * s, x = p.x + p.face * (o.fwd ?? 46) * s, gy = sc.groundBelow(x, p.y - 30);
  sc.combat.spawnZone({
    owner: 'player', x: x - w / 2, y: gy - 18, w, h: 18, life: o.life ?? 2.5, tick: .35, type: o.type, color: col, draw: o.type === 'fire' ? 'fire' : 'seed',
    onTick: z => {
      sc.combat.hitRect({ x: z.x, y: z.y - 6, w: z.w, h: z.h + 6 }, o.mul ?? .3, o.type, Object.assign({ kbx: 0, kby: 0, hs: 0 }, o.status || {}));
      sc.fx.burst(z.x + Math.random() * z.w, z.y + z.h - 2, [col, 0xffffff], 2, 30, { angle: -Math.PI / 2, spread: .5, up: 40, grav: -40, bounce: false, life: .5, glow: true });
    }
  });
  sc.fx.burst(x, gy - 4, [col, 0xffffff], 14, 120, { up: 90, glow: true }); Sfx.play('wave');
}
