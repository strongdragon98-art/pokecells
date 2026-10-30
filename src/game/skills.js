// 포켓몬별 스킬 3종(Z/X/C)과 교체 등장 스킬 구현
// 각 스킬은 행동(action) 객체를 돌려준다:
//  { dur, mm(이동 배율), anim, ctrl(속도 직접 제어), noGrav, lockFace, guard, inv, ev:[[시각, fn]], update(p,a,dt), end(p,a) }
import Phaser from 'phaser';
import { typeColor } from '../data/types.js';
import { Sfx } from '../systems/Audio.js';
import { SLASH_PAL } from '../systems/Fx.js';

// 기술 크기 배율: 아이템 × 진화 단계 (1단 1 · 2단 1.2 · 3단 1.4 · 메가 1.65) → 판정·궤적·투사체가 같이 커진다
const sizeMul = p => p.mods.sizeMul * p.fxMul * (p.sp.reach || 1);   // reach: 거대 몸집 포켓몬(롱스톤 계열)의 공격 범위 배율
const up = (p, id) => p.hasUp(id);   // 기술머신 강화 카드를 받았나 (data/tm.js 의 UPGRADES)

// 전방 근접 판정 + 3겹 도트 검기 (가장자리 오라 → 중간 → 순백 코어) + 맞은 자리 톱니 섬광
//  pal: 검기 색 (기본은 타입 색, palType 으로 다른 타입 색을 빌린다) · rot: X자 교차 베기 · reach: 사거리 배율
function slashHit(p, o) {
  const s = sizeMul(p) * (o.reach ?? 1), fwd = (o.fwd ?? 14) * s, w = (o.w ?? 26) * s, h = (o.h ?? 20) * s, fx = p.scene.fx;
  const cx = p.x + p.face * fwd, cy = p.y + (o.oy ?? -2), pal = o.pal || SLASH_PAL[o.palType || o.type] || null;
  const spark = pal ? pal[1] : (o.color ?? typeColor(o.type));
  const n = p.scene.combat.hitRect({ x: cx - w / 2, y: cy - h / 2, w, h }, o.mul ?? 1, o.type, Object.assign({ kbx: o.kbx ?? 120, kby: o.kby ?? -80, crit: o.crit || 0, onHit: e => fx.starburst(e.x, e.y - 2, spark, o.burst ?? .55, { debris: !!o.debris }) }, o.status || {}));
  if (!o.noArc) fx.slash(cx - p.face * w * .25, cy, (o.arc ?? 15) * s, p.face, o.color ?? typeColor(o.type), { pal, flipV: !!o.flipV, thick: o.thick ? o.thick * s : undefined, rot: o.rot, delay: o.delay, a0: o.a0, a1: o.a1, ms: o.ms });
  Sfx.play('swing');
  p.squash(1.15, .9);
  return n;
}

// 몸통박치기·주먹 같은 타격: 검기 대신 맞은 자리에 큰 톱니 섬광 + 바닥 파편이 세게 튄다
function strikeHit(p, o) {
  const s = sizeMul(p), fwd = (o.fwd ?? 12) * s, w = (o.w ?? 24) * s, h = (o.h ?? 22) * s, fx = p.scene.fx;
  const cx = p.x + p.face * fwd, cy = p.y + (o.oy ?? -2), col = o.color ?? (SLASH_PAL[o.type] || [0, 0xffffff])[1];
  const n = p.scene.combat.hitRect({ x: cx - w / 2, y: cy - h / 2, w, h }, o.mul ?? 1, o.type, Object.assign({
    kbx: o.kbx ?? 180, kby: o.kby ?? -90, crit: o.crit || 0,
    onHit: e => { fx.starburst(e.x - p.face * 3, e.y - 2, col, o.burst ?? 1, { debris: true }); if (o.onHit) o.onHit(e); }
  }, o.status || {}));
  if (!n) fx.burst(cx, cy, [col, 0xffffff], 4, 60, { glow: true, life: .2, up: 10 });
  Sfx.play(n ? 'punch' : 'swing');
  p.squash(1.2, .85);
  return n;
}

// 투사체 발사 (기술강화 코어·확산 = 개수 +1, 부채꼴로 퍼짐)
//  stream: 연속 투사체 — 불꽃세례·거품광선·전기쇼크 연사, 그리고 여러 갈래로 나가는 탄. 나머지(물대포·섀도볼 단발 등)는 단발
//  크기·판정은 진화 단계의 proj 배율(1 · 1.45 · 1.9 · 메가 2.3)을 따로 따른다. tier 는 연출 단계용
function shoot(p, o) {
  const count = (o.count ?? 1) + p.mods.extraProj, spread = o.spread ?? .12, s = p.mods.sizeMul * p.T.proj;
  const boom = o.boom && Object.assign({}, o.boom, { r: o.boom.r * (1 + (s - 1) * .6) });   // 폭발 반경은 조금 덜 (메가 ≈ 1.8배)
  const base = o.angle ?? 0;
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * spread;
    const sp = o.speed ?? 260;
    p.scene.combat.spawnProjectile({
      owner: 'player', x: p.x + p.face * (o.fwd ?? 10), y: p.y + (o.oy ?? -3),
      vx: Math.cos(a) * sp * p.face, vy: Math.sin(a) * sp + (o.vy ?? 0), r: (o.r ?? 4) * s, mul: o.mul ?? 1, type: o.type, kind: o.kind, life: o.life ?? .8,
      pierce: o.pierce ?? 1, grav: o.grav ?? 0, homing: o.homing, boomerang: o.boomerang, ghost: o.ghost, status: o.status || {}, boom,
      kb: o.kb, color: o.color, light: o.light, grow: o.grow, onExpire: o.onExpire, onHit: o.onHit, tier: p.tierIdx, pow: s,
      stream: !!o.stream || count > 1   // 연속 투사체(연사·여러 갈래)인가 → 적 투사체와 맞대결 (Combat.clashProjectiles)
    });
  }
  p.squash(.88, 1.1);
}

// 번개/덩굴 같은 선 이펙트
function lineFx(scene, x1, y1, x2, y2, color, o = {}) {
  const g = scene.add.graphics().setDepth(42).setBlendMode(Phaser.BlendModes.ADD);
  const pts = [{ x: x1, y: y1 }];
  const seg = o.seg ?? 7, jag = o.jag ?? 6;
  for (let i = 1; i < seg; i++) {
    const t = i / seg;
    pts.push({ x: Math.round(x1 + (x2 - x1) * t + (Math.random() - .5) * jag), y: Math.round(y1 + (y2 - y1) * t + (Math.random() - .5) * jag) });
  }
  pts.push({ x: x2, y: y2 });
  g.lineStyle(o.w ?? 2, color, 1); g.strokePoints(pts, false);
  g.lineStyle(1, 0xffffff, 1); g.strokePoints(pts, false);
  scene.tweens.add({ targets: g, alpha: 0, duration: o.ms ?? 160, onComplete: () => g.destroy() });
}

// 굵은 광선: hold 초 모았다가 dur 초 동안 앞으로 쭉 뻗는다 (관통). pal = [바깥, 중간, 코어]
//  솔라빔(노란 줄기) · 냉동빔(하늘색 + 얼음 결정) · 하이드로펌프(넉백 물줄기)
function beamAction(p, o) {
  const hold = o.hold || 0;
  return {
    dur: hold + o.dur, mm: o.mm ?? .15, anim: 'Shoot', lockFace: true, tk: 0,
    update(p, a, dt) {
      const sc = p.scene, s = sizeMul(p), mx = p.x + p.face * 10, my = p.y - 3, len = o.len * s, hh = o.hh * s;
      if (!a.g) a.g = sc.add.graphics().setDepth(43).setBlendMode(Phaser.BlendModes.ADD);
      const g = a.g; g.clear();
      if (a.t < hold) {   // 모으기: 빛 알갱이가 입 앞으로 빨려 든다
        const k = a.t / hold, ang = Math.random() * Math.PI * 2, d = 34 * (1 - k * .6);
        sc.fx.burst(mx + Math.cos(ang) * d, my + Math.sin(ang) * d, [o.pal[1], 0xffffff], 1, 0, { grav: 0, bounce: false, glow: true, life: .12, size: 1 });
        g.fillStyle(o.pal[0], .4 + k * .3); g.fillCircle(mx, my, (3 + k * 7) * s);
        g.fillStyle(0xffffff, .95); g.fillCircle(mx, my, (1 + k * 3) * s);
        return;
      }
      if (!a.fired) { a.fired = true; sc.fx.shake(o.shake ?? .008, 220, 'hit'); Sfx.play(o.sfx || 'beam'); a.light = sc.combat.takeLight(mx + p.face * len / 2, my, len * .7, o.pal[0], 2); }
      const k = (a.t - hold) / o.dur, w = hh * (k < .12 ? k / .12 : k > .8 ? (1 - k) / .2 : 1) * (1 + Math.sin(a.t * 60) * .08);
      const x1 = mx + p.face * len, L = Math.min(mx, x1), W = Math.abs(x1 - mx);
      g.fillStyle(o.pal[0], .5); g.fillRect(L, my - w, W, w * 2);
      g.fillStyle(o.pal[1], .9); g.fillRect(L, my - w * .62, W, w * 1.24);
      g.fillStyle(0xffffff, 1); g.fillRect(L, my - w * .26, W, Math.max(1, w * .52));
      g.fillStyle(o.pal[1], .9); g.fillCircle(mx, my, w * 1.4); g.fillStyle(0xffffff, 1); g.fillCircle(mx, my, w * .75);   // 발사구
      g.fillStyle(o.pal[1], .8); g.fillCircle(x1, my, w * 1.1);   // 끝머리
      sc.fx.burst(L + Math.random() * W, my + (Math.random() - .5) * w * 2, [o.pal[1], 0xffffff], 1, 40, { grav: 0, bounce: false, glow: true, life: .25, size: Math.random() < .3 ? 2 : 1 });
      if (o.particles) o.particles(sc, L, W, my, w);
      a.tk -= dt;
      if (a.tk <= 0) { a.tk = o.tick ?? .1; sc.combat.hitRect({ x: L, y: my - w - 2, w: W, h: w * 2 + 4 }, o.mul, o.type, Object.assign({ kbx: (o.kbx ?? 40) * 1, kby: o.kby ?? -20, hs: 0, fromX: p.x, onHit: o.onHit && (e => o.onHit(e, p)) }, o.status || {})); }
      if (a.light) a.light.setPosition(mx + p.face * len / 2, my);
    },
    end(p, a) { if (a.g) a.g.destroy(); p.scene.combat.freeLight(a.light); }
  };
}

// 바닥에서 솟는 암석 기둥 (대지의힘·스톤에지): 땅이 갈라진 뒤 delay 초에 솟아 적을 띄운다
const PILLAR = { ground: [0x3a2410, 0xb08040, 0xe8c888], rock: [0x2a2420, 0x9a8a6a, 0xe0d4b0] };
function rockPillar(p, x, o = {}) {
  const sc = p.scene, s = sizeMul(p), gy = sc.groundBelow(x, p.y - 30), h = (o.h ?? 34) * s, w = (o.w ?? 10) * s, pal = PILLAR[o.type] || PILLAR.ground;
  const g = sc.add.graphics().setDepth(42), st = { k: 0 };
  sc.fx.burst(x, gy - 1, [pal[1], pal[0]], 4, 50, { angle: -Math.PI / 2, spread: 1, up: 30, grav: 400, size: 1 });   // 갈라지는 예고
  sc.tweens.add({
    targets: st, k: 1, delay: (o.delay ?? 0) * 1000, duration: 520,
    onStart: () => {
      sc.combat.hitRect({ x: x - w / 2 - 3, y: gy - h, w: w + 6, h }, o.mul ?? 1.6, o.type || 'ground', { kbx: 40, kby: -340, crit: o.crit || 0, fromX: x, onHit: e => sc.fx.starburst(e.x, e.y, pal[2], 1, { debris: false }) });
      sc.fx.burst(x, gy - 2, [pal[0], pal[1], pal[2]], 10, 170, { angle: -Math.PI / 2, spread: 1.4, up: 170, grav: 700, bounce: true, size: 2, life: .7 });
      sc.fx.shake(.006, 90, 'hit'); Sfx.play('punch');
    },
    onUpdate: () => {
      const k = st.k, rise = Math.min(1, k / .18), fade = k < .7 ? 1 : 1 - (k - .7) / .3, hh = Math.round(h * rise), top = gy - hh, xl = Math.round(x - w / 2);
      g.clear(); g.setAlpha(fade);
      g.fillStyle(pal[0], 1); g.fillRect(xl - 1, top, Math.round(w) + 2, hh);
      g.fillStyle(pal[1], 1); g.fillRect(xl, top + 1, Math.round(w), hh - 1);
      g.fillStyle(pal[2], 1); g.fillRect(xl + 1, top + 2, 2, hh - 3);
      for (let yy = top + 5; yy < gy - 2; yy += 6) { g.fillStyle(pal[0], 1); g.fillRect(xl + 3, yy, Math.round(w) - 5, 1); }   // 결 무늬
      if (o.sharp) { g.fillStyle(pal[0], 1); g.fillTriangle(xl - 1, top, xl + w + 1, top, x, top - 9 * s); g.fillStyle(pal[2], 1); g.fillTriangle(xl + 2, top, x, top, x, top - 7 * s); }   // 뾰족한 날
    },
    onComplete: () => g.destroy()
  });
}

// 얼음 결정 몇 개가 바깥으로 튀며 빙글 돈다 (냉동빔·냉동펀치)
function iceShards(sc, x, y, n = 5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 14;
    const im = sc.add.image(x, y, 'pj-shard').setTint(i % 2 ? 0xbff0ff : 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(44).setScale(.7);
    sc.tweens.add({ targets: im, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, angle: 360, alpha: 0, duration: 360, ease: 'Cubic.easeOut', onComplete: () => im.destroy() });
  }
}

// 돌진형 스킬 공통
function dashAction(p, o) {
  const set = new Set();
  return {
    dur: o.dur, ctrl: true, noGrav: true, anim: o.anim ?? 'Attack', inv: o.inv ?? o.dur,
    update(p, a, dt) {
      const vx = (o.vx ?? 0) * p.face, vy = o.vy ?? 0;
      p.b.setVelocity(vx, vy);
      const s = sizeMul(p), fx = p.scene.fx;
      if (!a.boomed) { a.boomed = true; if (o.boom !== false) fx.sonicBoom(p.x, p.y - 2, p.face, s); }   // 돌진하는 순간 등 뒤 음속 충격파
      p.scene.combat.hitRect({ x: p.b.x - 6 * s, y: p.b.y - 4 * s, w: p.b.width + 12 * s, h: p.b.height + 8 * s }, o.mul, o.type, Object.assign({ set, kbx: o.kbx ?? 160, kby: -120, flat: 0, onHit: e => fx.starburst(e.x, e.y - 2, (SLASH_PAL[o.type] || [0, o.color ?? 0xffffff])[1], .9, { debris: true }) }, o.status || {}));
      a.ghostT = (a.ghostT || 0) - dt;
      if (a.ghostT <= 0) { a.ghostT = .03; p.scene.fx.ghost(p.sprite, o.color ?? typeColor(o.type), .5, 220); }
      if (o.tick) o.tick(p, a, dt, set);
    },
    end(p) { p.b.setVelocityX(p.b.velocity.x * .3); if (o.end) o.end(p, set); }
  };
}

export const SKILL_IMPL = {
  // ===== 파이리 =====
  // 할퀴기: 1타 위→아래 베기 · 2타 아래→위 올려베기 · 3타 거대한 X자 화염 발톱 + 불꽃세례
  //  강화 카드: 폭열 크로스(사거리 +40% · 마지막 타격에 화염 기둥) · 푸른 연옥(불꽃세례 피해 +50% · 푸른 불꽃 · 발사 +2)
  scratch_ember(p, i) {
    const reach = up(p, 'blast_cross') ? 1.4 : 1, blue = p.mega.active || up(p, 'blue_inferno');
    const pal = blue ? [0x2a6ad8, 0x9ad8ff, 0xffffff] : SLASH_PAL.fire;
    if (i < 2) return { dur: .22, mm: .35, anim: 'Attack', ev: [[.06, () => slashHit(p, { fwd: 14, w: 26, h: 22, mul: 1, type: 'normal', pal, flipV: i === 1, reach, arc: 18, thick: 9 })]] };
    return {
      dur: .34, mm: .3, anim: 'Attack', ev: [
        [.05, () => {   // 거대한 X자 교차 발톱: 납작하고 긴 검기 두 줄이 엇갈려 지나간다 (검기 한가운데 = 교차점)
          const s = sizeMul(p) * reach, R = 30 * s, cx = p.x + p.face * 22 * s, fx = p.scene.fx;
          slashHit(p, { fwd: 20, w: 40, h: 36, mul: 1.3, type: 'normal', pal, reach, burst: .9, debris: true, noArc: true });
          fx.slash(cx - p.face * R, p.y - 3, R, p.face, 0, { pal, a0: -.6, a1: .6, rot: -.8, thick: 11 * s, ms: 230, embers: 12 });
          fx.slash(cx - p.face * R, p.y - 3, R, p.face, 0, { pal, a0: -.6, a1: .6, rot: .8, flipV: true, thick: 11 * s, ms: 230, delay: 55, embers: 12 });
          fx.glow(cx, p.y - 3, 26 * s, pal[0], 200, .8);
          if (up(p, 'blast_cross')) {   // 전방 화염 기둥 폭발
            const sc = p.scene, x = p.x + p.face * 46 * sizeMul(p), gy = sc.groundBelow(x, p.y - 20);
            sc.time.delayedCall(90, () => {
              sc.combat.hitRect({ x: x - 14, y: gy - 64, w: 28, h: 64 }, 1.8, 'fire', { burn: 3, kbx: 60, kby: -300, fromX: p.x, onHit: e => sc.fx.starburst(e.x, e.y, 0xffd84a, 1) });
              for (let k = 0; k < 7; k++) sc.combat.pr.flamePuff(x + (Math.random() - .5) * 10, gy - 4, (Math.random() - .5) * 30, -170 - k * 25, .45, .6, 1.6, blue);
              sc.fx.glow(x, gy - 30, 40, blue ? 0x5ab0ff : 0xff7a2a, 320, 1); sc.fx.shake(.01, 200, 'hit'); Sfx.play('boom');
            });
          }
        }],
        [.12, () => {   // 불꽃세례
          const m = p.mega.active, inferno = up(p, 'blue_inferno');
          shoot(p, { speed: 270, r: m ? 5 : 4, mul: (m ? 1.3 : 1.5) * (inferno ? 1.5 : 1), type: 'fire', kind: 'fire', stream: true, life: .8, status: { burn: 2.5 }, light: true, color: blue ? 0x5ab0ff : undefined, count: (m ? 3 : 1) + (inferno ? 2 : 0), spread: .16 });
          Sfx.play('fire');
        }]
      ]
    };
  },
  flamethrower(p) {
    const m = p.mega.active;
    return {
      dur: m ? 1.6 : 1.2, mm: .3, anim: 'Shoot', lockFace: true, tk: 0,
      update(p, a, dt) {
        a.tk -= dt;
        const s = sizeMul(p), len = (m ? 150 : 92) * s, hh = (m ? 34 : 22) * s, mx = p.x + p.face * 8, my = p.y - 3;
        a.pt = (a.pt || 0) - dt;
        while (a.pt <= 0) { a.pt += .022; p.scene.combat.pr.flameBreath(mx, my, p.face, len, hh, m, p.tierIdx); }   // 불꽃 덩어리가 앞으로 쏟아진다
        if (a.tk <= 0) {
          a.tk = .1;
          p.scene.combat.hitRect({ x: p.face > 0 ? mx : mx - len, y: my - hh / 2, w: len, h: hh }, .55, 'fire', { burn: 2, kbx: 40, kby: -10, hs: 0 });
          Sfx.play('fire');
        }
        if (!a.light) a.light = p.scene.combat.takeLight(mx + p.face * 40, my, 120, m ? 0x5ab0ff : 0xff7a2a, 2);
        if (a.light) a.light.setPosition(mx + p.face * 40, my);
      },
      end(p, a) { p.scene.combat.freeLight(a.light); }
    };
  },
  flame_charge(p) {
    const m = p.mega.active;
    return dashAction(p, {
      dur: .28, vx: 340, mul: 2.2, type: 'fire', status: { burn: 2.5 }, color: m ? 0x5ab0ff : 0xff7a2a,
      tick(p, a, dt) {
        p.scene.fx.embers(p.x, p.y, m ? [0x5ab0ff, 0xffffff] : [0xff7a2a, 0xffd04a], 2, { speed: 40 });
        if (m) { a.ft = (a.ft || 0) - dt; if (a.ft <= 0) { a.ft = .07; const zx = p.x - 8; p.scene.combat.spawnZone({ x: zx, y: p.bottom - 12, w: 16, h: 12, life: 2, tick: .3, draw: 'fire', type: 'fire', color: 0x5ab0ff, onTick: z => p.scene.combat.hitRect(z, .3, 'fire', { burn: 1.5, kbx: 0, kby: 0, hs: 0 }) }); } }
      },
      end(p) { p.speedBuff = 2; }
    });
  },

  // ===== 꼬부기 =====
  // 몸통박치기 2연타(돌진하는 순간 등 뒤 음속 충격파 · 부딪힌 자리 톱니 섬광) → 3타 물대포
  //  강화 카드: 하이드로펌프 — 3타가 적을 끝까지 밀어내는 넉백 물줄기 광선
  tackle_watergun(p, i) {
    if (i < 2) return {
      dur: .26, ctrl: true, anim: 'Attack',
      update(p, a, dt) { p.b.setVelocityX(a.t < .1 ? p.face * 220 : p.b.velocity.x * .8); },
      ev: [[0, () => p.scene.fx.sonicBoom(p.x, p.y - 2, p.face, sizeMul(p) * .9)], [.08, () => strikeHit(p, { fwd: 10, w: 22, h: 20, mul: 1.2, type: 'normal', kbx: 200, color: 0xd8f0ff, burst: .9 })]]
    };
    if (up(p, 'hydro_pump')) return beamAction(p, { dur: .45, len: 210, hh: 6, mul: .55, tick: .08, type: 'water', pal: [0x1a6ad0, 0x8ad8ff, 0xffffff], kbx: 420, kby: -40, sfx: 'water', shake: .006,
      particles: (sc, L, W, my, w) => { if (Math.random() < .7) sc.fx.burst(L + Math.random() * W, my, [0xbfe8ff, 0xffffff], 1, 70, { up: 40, grav: 300, life: .4, size: 1 }); } });
    return { dur: .26, mm: .4, anim: 'Shoot', ev: [[.06, () => { const m = p.mega.active; shoot(p, { speed: 320, r: 4, mul: 1.8, type: 'water', kind: 'water', life: .7, kb: 220, count: m ? 3 : 1, spread: .1, oy: m ? -8 : -3 }); Sfx.play('water'); }]] };
  },
  bubblebeam(p) {
    const m = p.mega.active;
    return {
      dur: .6, mm: .4, anim: 'Shoot', tk: 0,
      update(p, a, dt) {
        a.tk -= dt;
        if (a.tk <= 0) {
          a.tk = .075;
          shoot(p, { speed: 150 + Math.random() * 70, vy: (Math.random() - .5) * 60, stream: true, r: m ? 6 : 3, mul: m ? .85 : .6, type: 'water', kind: 'bubble', life: 1, pierce: m ? 3 : 1, status: { slow: 2 }, kb: 30 });
          Sfx.play('water');
        }
      }
    };
  },
  rapid_spin(p) {
    const m = p.mega.active || up(p, 'tidal_spin'), big = up(p, 'tidal_spin') ? 1.5 : 1;   // 강화 카드 소용돌이 스핀: 범위·위력 ×1.5 + 반사
    return {
      dur: .7, mm: .75, anim: 'Attack', guard: m ? 'reflect' : 'spin', tk: 0, ft: 0,
      update(p, a, dt) {
        a.tk -= dt; a.ft -= dt;
        if (a.ft <= 0) { a.ft = .07; p.face *= -1; p.refacing(); p.scene.fx.ghost(p.sprite, 0x9ad8ff, .4, 160); }
        if (a.tk <= 0) {
          a.tk = .14;
          const r = 30 * sizeMul(p) * (p.mega.active ? 1.6 : 1) * big;
          p.scene.combat.hitCircle(p.x, p.y, r, .6 * big, 'normal', { kbx: 170, kby: -100, hs: 30 });
          p.scene.fx.ring(p.x, p.y, r, 0x9ad8ff, 160);
          if (!m) p.scene.combat.clearEnemyProjectiles({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 });
          Sfx.play('swing');
        }
      }
    };
  },

  // ===== 이상해씨 =====
  // 덩굴채찍: S자로 휘며 뻗는 덩굴, 끝이 꺾이는 순간 스파크·잎 조각이 터진다 (강화 카드 가시채찍: 사거리 +35% · 끝에서 폭발)
  vine_whip(p, i) {
    return {
      dur: .26, mm: .35, anim: 'Attack', ev: [[.06, () => {
        const thorn = up(p, 'thorn_lash'), reach = 54 * sizeMul(p) * (p.mega.active ? 1.5 : 1) * (thorn ? 1.35 : 1), y = p.y - 2 + (i - 1) * 4, sc = p.scene;
        sc.combat.hitRect({ x: p.face > 0 ? p.x : p.x - reach, y: y - 7, w: reach, h: 14 }, i === 2 ? 1.3 : 1, 'grass', { kbx: 140, kby: -60, onHit: e => sc.fx.starburst(e.x, e.y - 2, 0xb8ff7a, .5, { debris: false }) });
        sc.fx.vine(p.x + p.face * 6, p.y - 4, p.face, reach, { flip: i === 1, amp: 6 + i * 2, ang: (i - 1) * .06, leaves: thorn ? 9 : 5,
          onTip: thorn ? tip => { sc.combat.hitCircle(tip.x, tip.y, 16 * sizeMul(p), .8, 'grass', { kbx: 160, kby: -120 }); sc.fx.ring(tip.x, tip.y, 18, 0x8aff6a, 220); } : null });
        Sfx.play('swing'); p.squash(1.12, .92);
      }]]
    };
  },
  razor_leaf(p) {
    const m = p.mega.active, hf = up(p, 'hundred_flowers');   // 강화 카드 백화요란: 잎날 2배 · 피해 +40% · 한 장 더
    return { dur: .3, mm: .4, anim: 'Shoot', ev: [[.08, () => { shoot(p, { speed: 240, r: hf ? 8 : 4, mul: hf ? 1.7 : 1.2, type: 'grass', kind: 'leaf', life: 1.8, pierce: 99, boomerang: .38, count: (m ? 4 : 2) + (hf ? 1 : 0), spread: .28 }); Sfx.play('leaf'); }]] };
  },
  seed_field(p) {
    const m = p.mega.active;
    return {
      dur: .35, mm: .2, anim: 'Shoot', ev: [[.12, () => {
        const w = 76 * sizeMul(p) * (m ? 2 : 1), x = p.x - w / 2, y = p.bottom - 26;
        p.scene.combat.spawnZone({
          x, y, w, h: 26, life: 4, tick: .5, draw: 'seed', type: 'grass', color: 0x6aff7a,
          onTick: z => {
            const pb = p.bounds();
            if (pb.x + pb.w > z.x && pb.x < z.x + z.w && pb.y + pb.h > z.y - 10) p.heal(p.m.maxhp * (m ? .05 : .03));
            for (const e of p.scene.combat.enemiesIn(z)) { const d = p.scene.combat.damageEnemy(e, p.atk * .3, 'grass', { dot: 'seed' }); if (d) p.heal(d * .5, true); }
          }
        });
        p.scene.fx.burst(p.x, p.bottom - 2, [0x6aff7a, 0xc8ffb0], 14, 80, { glow: true });
        Sfx.play('leaf');
      }]]
    };
  },

  // ===== 꼬렛 =====
  hyper_fang(p, i) {
    if (i < 2) return { dur: .2, mm: .4, anim: 'Attack', ev: [[.06, () => slashHit(p, { fwd: 12, w: 22, h: 18, mul: .95, type: 'normal', flipV: i === 1 })]] };
    const m = p.mega.active;
    return { dur: .3, mm: .25, anim: 'Strike', ev: [[.1, () => { slashHit(p, { fwd: 16, w: m ? 40 : 30, h: m ? 32 : 24, mul: 1.8, type: 'normal', crit: .35, status: { stun: .5 }, color: 0xfff0c0, arc: 16, thick: 7 }); Sfx.play('punch'); }]] };
  },
  super_fang(p) {
    const m = p.mega.active, pct = m ? .35 : .25, bpct = m ? .09 : .06;
    return dashAction(p, {
      dur: .22, vx: 300, mul: 1, type: 'normal', color: 0xfff0c0, anim: 'Strike',
      tick(p, a, dt, set) {
        for (const e of set) if (!a.done?.has(e)) {
          a.done = a.done || new Set(); a.done.add(e);
          if (!e.alive) continue;
          p.scene.combat.damageEnemy(e, Math.max(1, e.hp * (e.boss ? bpct : pct)), 'none', { hs: 90, heavy: true });
          // 위아래 송곳니가 맞물리는 두 줄 검기 + 피처럼 튀는 파편
          const fx = p.scene.fx, s = sizeMul(p);
          fx.slash(e.x - p.face * 10, e.y - 6, 12 * s, p.face, 0, { pal: [0xfff0c0, 0xffffff, 0xffffff], a0: -.9, a1: .9, thick: 6 * s, ms: 160 });
          fx.slash(e.x - p.face * 10, e.y + 4, 12 * s, p.face, 0, { pal: [0xfff0c0, 0xffffff, 0xffffff], a0: -.9, a1: .9, flipV: true, thick: 6 * s, ms: 160, delay: 40 });
          fx.burst(e.x, e.y, [0xff5a5a, 0xfff0c0, 0xffffff], 14, 140, { up: 70, size: 2 });
          fx.ring(e.x, e.y, 20 * s, 0xfff0c0, 220);
        }
      }
    });
  },
  quick_attack(p) {
    // 전광석화: 흰 빛줄기 잔상을 길게 남기며 순식간에 내달린다 (출발·도착에 섬광 고리)
    const sc = p.scene, x0 = p.x, y0 = p.y;
    sc.fx.ring(x0, y0, 16, 0xffffff, 200); sc.fx.glow(x0, y0, 20, 0xffffff, 160, .9);
    return dashAction(p, { dur: .13, vx: 640, mul: 1.2, type: 'normal', color: 0xffffff,
      tick(p) { sc.fx.burst(p.x - p.face * 8, p.y + (Math.random() - .5) * 10, [0xffffff, 0xfff6c0], 2, 30, { angle: p.face > 0 ? Math.PI : 0, spread: .2, up: 0, grav: 0, bounce: false, glow: true, life: .25, size: 1 }); },
      end(p) {
        p.jumpsUsed = Math.min(p.jumpsUsed, 1);
        lineFx(sc, x0, y0, p.x, p.y, 0xfff6c0, { seg: 3, jag: 2, w: 3, ms: 220 });
        sc.fx.ring(p.x, p.y, 18, 0xffffff, 220); sc.fx.burst(p.x, p.y, [0xffffff, 0xfff6c0], 10, 90, { glow: true, life: .3 });
      } });
  },

  // ===== 피카츄 =====
  thundershock(p, i) {
    const m = p.mega.active, rail = up(p, 'rail_storm'), big = i === 2 || rail;   // 강화 카드 레일 쇼크: 매 발 큰 탄 + 3관통
    return { dur: .2, mm: .45, anim: 'Shoot', ev: [[.05, () => { shoot(p, { speed: rail ? 420 : 340, r: big ? 5 : 3, stream: true, mul: big ? 1.25 : .7, type: 'electric', kind: 'bolt', life: .55, status: { paralyze: big ? .35 : .1 }, count: m ? 2 : 1, spread: .16, light: big, pierce: rail ? 3 : 1 }); Sfx.play('zap'); }]] };
  },
  thunderbolt(p) {
    const m = p.mega.active;
    return {
      dur: .45, mm: .2, anim: 'Shoot', ev: [[.15, () => {
        const sc = p.scene, targets = sc.combat.nearest(p.x, p.y, (m ? 6 : 3) + (up(p, 'storm_lord') ? 3 : 0), 260);   // 강화 카드 뇌신: 대상 +3 · 연쇄
        const cam = sc.cameras.main;
        if (!targets.length) targets.push({ x: p.x + p.face * 60, y: p.y, fake: true });
        let prev = null;
        for (const t of targets) {
          lineFx(sc, t.x + (Math.random() - .5) * 20, cam.worldView.y, t.x, t.y, 0xffe040, { seg: 9, jag: 14, w: 3, ms: 220 });
          if ((m || up(p, 'storm_lord')) && prev) lineFx(sc, prev.x, prev.y, t.x, t.y, 0xfff6a0, { seg: 5, jag: 8, ms: 200 });
          sc.fx.glow(t.x, t.y, 30, 0xffe040, 220, 1);
          if (!t.fake) sc.combat.damageEnemy(t, p.atk * 2.6, 'electric', { paralyze: .5, hx: t.x, hy: t.y });
          prev = t;
        }
        sc.cameras.main.flash(80, 255, 240, 160, true);
        Sfx.play('zap'); Sfx.play('boom');
      }]]
    };
  },
  volt_tackle(p) {
    const m = p.mega.active;
    return dashAction(p, {
      dur: .3, vx: 420, mul: 2.4, type: 'electric', status: { paralyze: .3 }, color: 0xffe040,
      tick(p, a) {
        const sc = p.scene;
        sc.fx.embers(p.x, p.y, [0xffe040, 0xffffff], 2, { speed: 60 });
        a.zt = (a.zt || 0) - .016;   // 몸을 휘감는 번개 갈래
        if (a.zt <= 0) { a.zt = .05; const ang = Math.random() * Math.PI * 2; lineFx(sc, p.x, p.y, p.x + Math.cos(ang) * 22, p.y + Math.sin(ang) * 18, 0xffe040, { seg: 4, jag: 6, w: 2, ms: 90 }); }
      },
      end(p) {
        const sc = p.scene;
        sc.fx.ring(p.x, p.y, 30, 0xffe040, 260); sc.fx.glow(p.x, p.y, 30, 0xfff6a0, 220, 1);
        for (let k = 0; k < 4; k++) { const ang = Math.PI * 2 * k / 4 + .4; lineFx(sc, p.x, p.y, p.x + Math.cos(ang) * 40, p.y + Math.sin(ang) * 30, 0xffe040, { seg: 5, jag: 7, w: 2, ms: 180 }); }
        Sfx.play('zap');
        if (!m) p.selfDamage(p.m.maxhp * .04);
      }
    });
  },

  // ===== 주뱃 =====
  leech_life(p, i) {
    const vf = up(p, 'vampire_fang');   // 강화 카드 흡혈귀의 송곳니: 흡혈 +20% · 사거리 +30%
    return { dur: .22, mm: .4, anim: 'Attack', ev: [[.07, () => {
      const n = slashHit(p, { fwd: 12, w: 22, h: 18, mul: 1, type: 'poison', status: { lifesteal: (p.mega.active ? .4 : .25) + (vf ? .2 : 0) }, color: 0xd07aff, flipV: i === 1, reach: vf ? 1.3 : 1 });
      if (n) {   // 빨아들인 생명력: 붉은 알갱이가 적에게서 몸으로 흘러 들어온다
        const sc = p.scene, ex = p.x + p.face * 18;
        for (let k = 0; k < 6; k++) sc.time.delayedCall(k * 25, () => sc.fx.burst(ex + (Math.random() - .5) * 10, p.y + (Math.random() - .5) * 10, [0xff5a8a, 0xd07aff], 1, 160, { angle: p.face > 0 ? Math.PI : 0, spread: .3, up: 0, grav: 0, bounce: false, glow: true, life: .16, size: 2 }));
        sc.fx.glow(p.x, p.y, 16, 0xff7aa0, 200, .7);
      }
    }]] };
  },
  supersonic(p) {
    const st = up(p, 'sonic_storm'), m = p.mega.active || st;   // 강화 카드 음파 폭풍: 사방 · 범위 ×1.6 · 위력 ×1.5
    return {
      dur: .4, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        const s = sizeMul(p) * (st ? 1.6 : 1), sc = p.scene;
        if (m) sc.combat.hitCircle(p.x, p.y, 90 * s, st ? 2.1 : 1.4, 'normal', { confuse: 1.6, kbx: 60, kby: -40 });
        else sc.combat.hitRect({ x: p.face > 0 ? p.x : p.x - 92 * s, y: p.y - 22 * s, w: 92 * s, h: 44 * s }, 1.4, 'normal', { confuse: 1.6, kbx: 60, kby: -40 });
        for (let k = 1; k <= 4; k++) sc.time.delayedCall(k * 45, () => sc.fx.ring(m ? p.x : p.x + p.face * k * 20 * s, p.y, (m ? 22 * k : 10 + k * 5) * s, 0xc8b0ff, 220));
        // 음파 알갱이: 퍼지는 고리 사이로 보랏빛·흰 알갱이가 진동하며 흩어진다
        sc.fx.burst(m ? p.x : p.x + p.face * 30 * s, p.y, [0xc8b0ff, 0xffffff, 0x9a7aff], 18, 160 * s, m ? { grav: 0, bounce: false, glow: true, life: .4 } : { angle: p.face > 0 ? 0 : Math.PI, spread: .8, grav: 0, bounce: false, glow: true, life: .4 });
        sc.fx.glow(p.x + p.face * 12, p.y, 18 * s, 0xc8b0ff, 200, .8);
        Sfx.play('wave');
      }]]
    };
  },
  wing_dash(p) {
    const m = p.mega.active, inp = p.lastInput || {};
    let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (!dx && !dy) dx = p.face;
    const len = Math.hypot(dx, dy); dx /= len; dy /= len;
    if (dx) p.face = Math.sign(dx);
    const sp = m ? 470 : 360, set = new Set();
    return {
      dur: .22, ctrl: true, noGrav: true, anim: 'Attack', inv: .22,
      update(p, a, dt) {
        p.b.setVelocity(dx * sp, dy * sp);
        p.scene.combat.hitRect({ x: p.b.x - 6, y: p.b.y - 6, w: p.b.width + 12, h: p.b.height + 12 }, 1.3, 'flying', { set, kbx: 160, kby: -100 });
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .03; p.scene.fx.ghost(p.sprite, 0xb0a0ff, .5, 220); }
      },
      end(p) { p.b.setVelocity(p.b.velocity.x * .3, p.b.velocity.y * .3); p.jumpsUsed = 1; }
    };
  },

  // ===== 알통몬 =====
  // 태권당수: 짧은 당수 검기 + 맞은 자리 톱니 섬광, 3타는 음속 충격파와 함께 크게 (강화 카드 강철 당수: 3타 충격파 + 위력 ×1.3)
  karate_chop(p, i) {
    const last = i === 2, ic = up(p, 'iron_chop');
    return {
      dur: last ? .32 : .24, mm: .3, anim: last ? 'Strike' : 'Attack', ev: [
        [0, () => { if (last) p.scene.fx.sonicBoom(p.x, p.y - 2, p.face, sizeMul(p)); }],
        [last ? .12 : .07, () => {
          slashHit(p, { fwd: 14, w: last ? 30 : 24, h: last ? 26 : 20, mul: (last ? 1.7 : 1) * (last && ic ? 1.3 : 1), type: 'fighting', crit: last ? .3 : 0, kbx: last ? 260 : 120, flipV: i === 1, arc: last ? 17 : 13, burst: last ? 1.3 : .8, debris: last });
          if (last) { Sfx.play('punch'); if (p.mega.active || ic) shoot(p, { speed: 280, r: 6, mul: 1.2, type: 'fighting', kind: 'wave', life: .4, pierce: 99, oy: 2 }); }
        }]]
    };
  },
  dynamic_punch(p) {
    const m = p.mega.active, mf = up(p, 'meteor_fist');   // 강화 카드 메테오 너클: 폭발 반경 ×1.6 · 위력 ×1.4
    return {
      dur: .72, mm: 0, anim: 'Strike', charge: .36,
      update(p, a) { if (a.t < .36 && Math.random() < .7) p.scene.fx.burst(p.x + (Math.random() - .5) * 40, p.y + (Math.random() - .5) * 30, 0xff8a6a, 1, 10, { grav: 0, bounce: false, glow: true, life: .3 }); },
      ev: [[.38, () => {
        const r = 32 * sizeMul(p) * (m ? 2 : 1) * (mf ? 1.6 : 1), x = p.x + p.face * 18;
        p.scene.combat.hitCircle(x, p.y, r, 4.2 * (mf ? 1.4 : 1), 'fighting', { confuse: 1.2, kbx: 320, kby: -240, hs: 110, onHit: e => p.scene.fx.starburst(e.x, e.y, 0xffb070, 1.3) });
        p.scene.fx.ring(x, p.y, r, 0xffb070, 300); p.scene.fx.glow(x, p.y, r, 0xff8a3a, 300, 1);
        p.scene.fx.burst(x, p.y, [0xff8a3a, 0xffe0a0, 0xffffff], 26, 220, { glow: true });
        p.scene.fx.shake(.014, 220, 'hit'); Sfx.play('boom'); p.squash(1.3, .8);
      }]]
    };
  },
  counter(p) {
    // 카운터 자세: 몸 둘레에 하늘색 방어 결계가 맥박치고, 결계 위로 빛 알갱이가 돈다 (맞으면 Player.takeHit 가 반격)
    const sc = p.scene;
    return { dur: p.mega.active ? .9 : .6, mm: 0, anim: 'Idle', guard: 'counter', tintFill: 0x8ad8ff,
      update(p, a, dt) {
        a.rt = (a.rt || 0) - dt;
        if (a.rt <= 0) { a.rt = .14; sc.fx.ring(p.x, p.y, 22, 0x8ad8ff, 200); }
        const ang = a.t * 12;
        for (let k = 0; k < 2; k++) sc.fx.burst(p.x + Math.cos(ang + k * Math.PI) * 18, p.y + Math.sin(ang + k * Math.PI) * 14, [0x8ad8ff, 0xffffff], 1, 6, { grav: 0, bounce: false, glow: true, life: .16, size: 1 });
      } };
  },

  // ===== 고오스 =====
  lick_shadow(p, i) {
    if (i < 2) return { dur: .22, mm: .4, anim: 'Attack', ev: [[.07, () => slashHit(p, { fwd: 12, w: 22, h: 18, mul: 1, type: 'ghost', status: { paralyze: .15 }, color: 0xc89aff, flipV: i === 1 })]] };
    const pt = up(p, 'phantom_tongue');   // 강화 카드 망령의 혀: 섀도볼이 크고 유도 + 저주
    return { dur: .26, mm: .4, anim: 'Shoot', ev: [[.07, () => { shoot(p, { speed: 220, r: pt ? 6 : 4, mul: pt ? 1.7 : 1.3, type: 'ghost', kind: 'shadow', life: .9, ghost: true, homing: p.mega.active || pt ? .7 : 0, color: 0x9a5aff, status: pt ? { curse: 4 } : {} }); Sfx.play('ghost'); }]] };
  },
  shadow_ball(p) {
    const m = p.mega.active, no = up(p, 'nightmare_orb');   // 강화 카드 악몽의 구슬: 2개 더 · 폭발 ×1.3
    return { dur: .35, mm: .3, anim: 'Shoot', ev: [[.12, () => { shoot(p, { speed: 150, r: 7, mul: 0, type: 'ghost', kind: 'shadow', life: 1.4, ghost: true, pierce: 1, color: 0x9a5aff, light: true, count: (m ? 3 : 1) + (no ? 2 : 0), spread: .25, boom: { r: 36 * (no ? 1.3 : 1), mul: 3.4, kb: 220 } }); Sfx.play('ghost'); }]] };   // 적에 닿거나 사거리 끝에서 폭발
  },
  phantom_dash(p) {
    const m = p.mega.active;
    return dashAction(p, {
      dur: .45, vx: 280, mul: 0, type: 'ghost', color: 0x9a5aff, anim: 'Walk', status: m ? { curse: 5 } : {},
      tick(p) { p.intangible = true; p.sprite.setAlpha(.35); },
      end(p, passed) {
        p.intangible = false; p.sprite.setAlpha(1);
        // 통과한 적 모두에게 기습 + 빠져나온 자리에 작은 충격
        for (const e of passed) if (e.alive) { p.scene.combat.damageEnemy(e, p.atk * 2.4, 'ghost', Object.assign({ kb: p.face * 160, kby: -120, hx: e.x, hy: e.y }, m ? { curse: 5 } : {})); p.scene.fx.ring(e.x, e.y, 18, 0x9a5aff, 220); }
        p.scene.combat.hitCircle(p.x, p.y, 26 * sizeMul(p), 1, 'ghost', { kbx: 160 });
        p.scene.fx.ring(p.x, p.y, 28, 0x9a5aff, 260); Sfx.play('ghost');
      }
    });
  },

  // ================= 기술머신으로 배우는 타 속성 기술 (data/tm.js 의 TM_POOL) =================
  // 깨물어부수기(악): 파고들며 위아래 검보라 송곳니가 맞물린다 — 상성 반감을 무시하고 풀죽게 한다
  crunch(p) {
    return {
      dur: .32, ctrl: true, anim: 'Attack', update(p, a) { p.b.setVelocityX(a.t < .12 ? p.face * 260 : p.b.velocity.x * .8); },
      ev: [[0, () => p.scene.fx.sonicBoom(p.x, p.y - 2, p.face, .8 * sizeMul(p))], [.12, () => {
        const s = sizeMul(p), fx = p.scene.fx, x = p.x + p.face * 4 * s, pal = SLASH_PAL.dark;
        fx.slash(x, p.y - 3, 14 * s, p.face, 0, { pal, a0: -1.7, a1: .15, thick: 8 * s, embers: 6 });
        fx.slash(x, p.y - 1, 14 * s, p.face, 0, { pal, a0: -1.7, a1: .15, thick: 8 * s, flipV: true, embers: 6 });
        strikeHit(p, { fwd: 16, w: 30, h: 26, mul: 2.6, type: 'dark', status: { stun: .5, ignoreResist: true }, burst: 1.2, color: 0xc08aff });
        fx.burst(p.x + p.face * 16 * s, p.y, [0x2a0a3a, 0x6a2a9a, 0xd0a0ff], 14, 120, { glow: true, life: .4 });
      }]]
    };
  },
  // 솔라빔(풀): 햇빛을 모았다가 화면을 꿰뚫는 굵은 노란 줄기
  solar_beam(p) {
    return beamAction(p, { hold: .55, dur: .9, len: 250, hh: 10, mul: .7, tick: .09, type: 'grass', pal: [0xffa020, 0xfff27a, 0xffffff], kbx: 70, shake: .012,
      particles: (sc, L, W, my, w) => { if (Math.random() < .6) sc.fx.burst(L + Math.random() * W, my + (Math.random() - .5) * w * 3, [0x9aff6a, 0xffffff], 1, 30, { up: 20, grav: -30, bounce: false, glow: true, life: .4, size: 1 }); } });
  },
  // 폭풍(비행): 천천히 나아가는 회오리 — 적을 빨아들이며 여러 번 친다
  hurricane(p) {
    return {
      dur: .35, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        const sc = p.scene, s = sizeMul(p), face = p.face, x0 = p.x + face * 26, gy = sc.groundBelow(p.x, p.y - 10), H = 66 * s, W = 24 * s, st = { k: 0 };
        const g = sc.add.graphics().setDepth(43).setBlendMode(Phaser.BlendModes.ADD);
        let last = 0;
        Sfx.play('wave');
        sc.tweens.add({
          targets: st, k: 1, duration: 1800,
          onUpdate: () => {
            const now = sc.time.now, t = now / 1000, x = x0 + face * 150 * s * st.k, fade = st.k < .85 ? 1 : (1 - st.k) / .15;
            g.clear();
            for (let i = 0; i < 10; i++) {
              const yy = gy - 4 - i * H / 10, rw = W * (.3 + .7 * i / 9), sx = Math.sin(t * 9 + i * .8) * 4;
              g.lineStyle(2, i % 2 ? 0xe8f0ff : 0x9ab0ff, .8 * fade); g.strokeEllipse(x + sx, yy, rw * 2, 6);
              g.lineStyle(1, 0xffffff, .6 * fade); g.strokeEllipse(x + sx, yy, rw * 1.2, 3);
            }
            if (Math.random() < .8) { const a = t * 12, r = W * Math.random(); sc.fx.burst(x + Math.cos(a) * r, gy - Math.random() * H, [0xd8e4ff, 0xa8b0c0], 1, 40, { angle: a, grav: -60, bounce: false, life: .3, size: 1 }); }
            if (now - last > 130) {
              last = now;
              sc.combat.hitRect({ x: x - W, y: gy - H, w: W * 2, h: H }, .55, 'flying', { kbx: 0, kby: -110, hs: 0, fromX: x });
              for (const e of sc.enemies) if (e.alive && !e.boss && Math.abs(e.x - x) < 80 && Math.abs(e.y - (gy - H / 2)) < H) e.b.setVelocityX((x - e.x) * 4);   // 빨아들이기
            }
          },
          onComplete: () => g.destroy()
        });
      }]]
    };
  },
  // 번개펀치(전기): 음속 충격파와 함께 전기 주먹 3연타 — 마비
  thunder_punch(p) {
    const hit = () => {
      const n = strikeHit(p, { fwd: 14, w: 26, h: 22, mul: 1.05, type: 'electric', status: { paralyze: .3 }, burst: .9, color: 0xfff27a });
      const fx = p.x + p.face * 14 * sizeMul(p);
      for (let k = 0; k < 2; k++) lineFx(p.scene, fx, p.y - 2, fx + p.face * (10 + Math.random() * 14), p.y - 2 + (Math.random() - .5) * 24, 0xffe040, { seg: 4, jag: 6, w: 2, ms: 120 });
      Sfx.play('zap'); return n;
    };
    return { dur: .42, ctrl: true, anim: 'Attack', update(p, a) { p.b.setVelocityX(a.t < .1 ? p.face * 240 : p.b.velocity.x * .85); },
      ev: [[0, () => p.scene.fx.sonicBoom(p.x, p.y - 2, p.face, sizeMul(p))], [.06, hit], [.18, hit], [.3, hit]] };
  },
  // 드래곤클로(드래곤): 거대한 청록색 X자 참격
  dragon_claw(p) {
    return {
      dur: .34, ctrl: true, anim: 'Attack', update(p, a) { p.b.setVelocityX(a.t < .1 ? p.face * 200 : p.b.velocity.x * .8); },
      ev: [[.06, () => {
        const s = sizeMul(p);
        slashHit(p, { fwd: 18, w: 40, h: 36, mul: 2.6, type: 'dragon', arc: 22, thick: 10, rot: -.7, burst: 1.2, debris: true, crit: .15 });
        p.scene.fx.slash(p.x + p.face * (18 * s - 10), p.y - 2, 22 * s, p.face, 0, { pal: SLASH_PAL.dragon, rot: .7, flipV: true, thick: 10 * s, delay: 50 });
        p.scene.fx.burst(p.x + p.face * 20 * s, p.y, [0x6affe8, 0x14807a, 0xffffff], 16, 140, { glow: true, life: .4 });
      }]]
    };
  },
  // 냉동빔(얼음): 하늘색 빔 + 얼음 결정 — 맞은 적을 가끔 얼린다
  ice_beam(p) {
    return beamAction(p, { hold: .2, dur: .75, len: 210, hh: 5, mul: .55, tick: .1, type: 'ice', pal: [0x3ab0e8, 0xbff0ff, 0xffffff], status: { slow: 2.5 },
      onHit: (e, p) => { if (Math.random() < .3) { p.scene.combat.applyStatus(e, { freeze: 1.3 }); iceShards(p.scene, e.x, e.y, 6); } },
      particles: (sc, L, W, my, w) => { if (Math.random() < .35) iceShards(sc, L + Math.random() * W, my, 1); } });
  },
  // 러스터캐논(강철): 반동과 함께 쏘는 무거운 은빛 포탄 (3관통)
  flash_cannon(p) {
    return {
      dur: .4, mm: .2, anim: 'Shoot', ev: [[.12, () => {
        shoot(p, { speed: 430, r: 7, mul: 2.4, type: 'steel', kind: 'other', color: 0xd8e4f4, life: .8, pierce: 3, kb: 260, light: true });
        const sc = p.scene; sc.fx.starburst(p.x + p.face * 14, p.y - 3, 0xd8e4f4, 1.1, { debris: false }); sc.fx.shake(.008, 140, 'hit');
        p.b.setVelocityX(-p.face * 140); Sfx.play('boom');
      }]]
    };
  },
  // 악의파동(악): 꿰뚫는 검보라 파동 3겹 (연속 투사체)
  dark_pulse(p) {
    return {
      dur: .45, mm: .25, anim: 'Shoot', ev: [[.08, () => {
        const sc = p.scene;
        for (let k = 0; k < 3; k++) sc.time.delayedCall(k * 90, () => { if (!p.scene || !p.m.alive) return; shoot(p, { speed: 240, r: 9, mul: 1.1, type: 'dark', kind: 'wave', color: 0x8a4ad0, life: .7, pierce: 99, stream: true, status: { stun: .25 } }); });
        sc.fx.ring(p.x, p.y, 30, 0x6a2a9a, 300); sc.fx.burst(p.x, p.y, [0x1a0a2a, 0x4a1a6a, 0xb07aff], 16, 100, { glow: true, life: .5 });
        Sfx.play('ghost');
      }]]
    };
  },
  // 지진(땅): 크게 내려찍어 주변 땅 위의 적 모두를 흔든다 (떠 있는 적은 못 맞힘)
  earthquake(p) {
    return {
      dur: .55, mm: 0, anim: 'Strike', ev: [[.25, () => {
        const sc = p.scene, s = sizeMul(p), R = 220 * s, gy = sc.groundBelow(p.x, p.y - 10);
        sc.fx.shake(.02, 520, 'hit'); Sfx.play('boom'); Sfx.play('thunder');
        for (let k = 1; k <= 7; k++) for (const sd of [-1, 1]) sc.time.delayedCall(k * 45, () => {
          const x = p.x + sd * k * R / 7, g2 = sc.groundBelow(x, p.y - 30);
          sc.fx.burst(x, g2 - 2, [0x8a6a3a, 0xb08a50, 0x5a4a2a, 0xd8c090], 7, 160, { angle: -Math.PI / 2, spread: 1.2, up: 160, grav: 700, bounce: true, size: 2, life: .8 });
          sc.fx.ring(x, g2, 10, 0xd8b060, 200);
        });
        for (const e of sc.enemies) {
          if (!e.alive || e.flying || Math.abs(e.x - p.x) > R || Math.abs(e.bottom - gy) > 60) continue;
          sc.combat.damageEnemy(e, p.atk * 3.2, 'ground', { kb: Math.sign(e.x - p.x) * 60, kby: -260, hx: e.x, hy: e.bottom });
          sc.fx.starburst(e.x, e.bottom - 4, 0xd8b060, 1.1);
        }
      }]]
    };
  },
  // 오물폭탄(독): 포물선으로 던진 독 덩어리가 터져 중독 장판을 남긴다
  sludge_bomb(p) {
    return {
      dur: .35, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        shoot(p, { speed: 200, vy: -170, grav: 420, r: 6, mul: 1.6, type: 'poison', kind: 'bubble', color: 0xa04ad0, life: 1.6, status: { poison: 3 },
          onExpire: q => {
            const sc = p.scene, gy = sc.groundBelow(q.x, q.y - 10), w = 56 * sizeMul(p);
            sc.combat.spawnZone({ x: q.x - w / 2, y: gy - 14, w, h: 14, life: 3.2, tick: .4, draw: 'poison', type: 'poison', color: 0xa04ad0,
              onTick: z => { for (const e of sc.combat.enemiesIn(z)) sc.combat.damageEnemy(e, p.atk * .35, 'poison', { dot: 'poison', poison: 2 }); } });
            sc.fx.burst(q.x, q.y, [0x6a1a8a, 0xa04ad0, 0xc8ff6a], 16, 140, { glow: true, life: .5 }); Sfx.play('water');
          } });
        Sfx.play('water');
      }]]
    };
  },
  // 대지의힘(땅): 가까운 적 3마리 발밑에서 암석 기둥이 솟는다
  earth_power(p) {
    return {
      dur: .4, mm: .2, anim: 'Strike', ev: [[.12, () => {
        const sc = p.scene, ts = sc.combat.nearest(p.x, p.y, 3, 230).filter(e => !e.flying);
        const xs = ts.length ? ts.map(e => e.x) : [1, 2, 3].map(k => p.x + p.face * k * 34);
        xs.forEach((x, k) => rockPillar(p, x, { delay: .18 + k * .09, type: 'ground', mul: 2.4, h: 40 }));
        sc.fx.shake(.006, 200, 'hit');
      }]]
    };
  },
  // 치근거리기(페어리): 분홍 반짝이와 함께 몰아치는 다단히트 돌진
  play_rough(p) {
    return dashAction(p, {
      dur: .4, vx: 300, mul: .85, type: 'fairy', color: 0xff9ad8,
      tick(p, a, dt, set) {
        a.mt = (a.mt || 0) - dt; if (a.mt <= 0) { a.mt = .09; set.clear(); }   // 같은 적을 여러 번
        const sc = p.scene;
        sc.fx.burst(p.x + (Math.random() - .5) * 24, p.y + (Math.random() - .5) * 20, [0xff9ad8, 0xffffff, 0xffe0f0], 2, 50, { grav: 0, bounce: false, glow: true, life: .3, size: Math.random() < .4 ? 2 : 1 });
        if (Math.random() < .25) sc.fx.starburst(p.x + p.face * 12 + (Math.random() - .5) * 16, p.y + (Math.random() - .5) * 16, 0xffc0e8, .5, { debris: false });
      }
    });
  },
  // 기가드레인(풀): 가까운 적 3마리의 생기를 빨아들여 준 피해의 절반만큼 회복
  giga_drain(p) {
    return {
      dur: .5, mm: .2, anim: 'Shoot', ev: [[.15, () => {
        const sc = p.scene, ts = sc.combat.nearest(p.x, p.y, 3, 230);
        if (!ts.length) { sc.fx.burst(p.x + p.face * 20, p.y, [0x6aff7a, 0xffffff], 10, 60, { glow: true }); return; }
        for (const e of ts) {
          const d = sc.combat.damageEnemy(e, p.atk * 2, 'grass', { hx: e.x, hy: e.y });
          if (d) p.heal(d * .5, true);
          lineFx(sc, e.x, e.y, p.x, p.y - 4, 0x6aff7a, { seg: 8, jag: 10, w: 3, ms: 320 });
          for (let k = 0; k < 8; k++) sc.time.delayedCall(k * 32, () => { const t = k / 8; sc.fx.burst(e.x + (p.x - e.x) * t, e.y + (p.y - e.y) * t, [0xb8ff8a, 0xffffff], 2, 20, { grav: 0, bounce: false, glow: true, life: .3 }); });
        }
        sc.fx.glow(p.x, p.y, 30, 0x6aff7a, 400, .8); Sfx.play('heal');
      }]]
    };
  },
  // 아이언테일(강철): 꼬리를 휘둘러 내려찍는 거대한 은빛 검기
  iron_tail(p) {
    return {
      dur: .36, mm: .2, anim: 'Strike', ev: [[.1, () => {
        slashHit(p, { fwd: 16, w: 38, h: 34, mul: 2.8, type: 'steel', arc: 21, thick: 10, rot: -.45, kbx: 280, kby: -170, burst: 1.3, debris: true, crit: .2 });
        p.scene.fx.ghost(p.sprite, 0xd8e4f4, .5, 200); p.scene.fx.shake(.008, 140, 'hit');
      }]]
    };
  },
  // 파도타기(물): 거대한 물의 벽이 앞으로 휩쓸며 적을 끝까지 밀어낸다
  surf(p) {
    return {
      dur: .4, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        const sc = p.scene, s = sizeMul(p), face = p.face, x0 = p.x - face * 6, gy0 = sc.groundBelow(p.x, p.y - 10), H = 46 * s, L = 240 * s, st = { k: 0 }, set = new Set();
        const g = sc.add.graphics().setDepth(43);
        Sfx.play('water'); Sfx.play('wave');
        sc.tweens.add({
          targets: st, k: 1, duration: 800,
          onUpdate: () => {
            const k = st.k, x = x0 + face * L * k, gy = sc.groundBelow(x, gy0 - 40), h = H * Math.min(1, k * 4) * (k > .8 ? (1 - k) / .2 : 1);
            g.clear();
            const back = x - face * 54 * s, pts = [{ x: back, y: gy }];
            for (let i = 0; i <= 10; i++) { const t = i / 10, hx = back + (x - back) * t; pts.push({ x: Math.round(hx), y: Math.round(gy - h * Math.pow(t, 1.6) * (1 + Math.sin(i + k * 20) * .05)) }); }
            pts.push({ x: x + face * 4, y: gy - h * .7 }, { x: x + face * 6, y: gy });
            g.fillStyle(0x1a5ab0, .85); g.fillPoints(pts, true);
            g.fillStyle(0x4a9cff, .9); g.fillPoints(pts.map(q => ({ x: q.x, y: Math.round(gy - (gy - q.y) * .75) })), true);
            g.lineStyle(2, 0xffffff, .95); g.strokePoints(pts.slice(5, 13), false);   // 물마루 거품
            if (Math.random() < .9) sc.fx.burst(x, gy - h, [0xbfe8ff, 0xffffff], 2, 90, { angle: -Math.PI / 2 + face * .5, spread: 1, up: 60, grav: 400, life: .45, size: 1 });
            const rect = { x: Math.min(x, back), y: gy - h, w: Math.abs(x - back) + 6, h };
            sc.combat.hitRect(rect, 1.8, 'water', { set, kbx: 300, kby: -100 });
            for (const e of sc.combat.enemiesIn(rect)) if (!e.boss) e.b.setVelocityX(face * 300);   // 끝까지 밀어낸다
          },
          onComplete: () => g.destroy()
        });
      }]]
    };
  },
  // 사이코키네시스(에스퍼): 가까운 적 3마리를 분홍 염동력으로 띄웠다가 내리꽂는다
  psychic(p) {
    return {
      dur: .45, mm: .2, anim: 'Shoot', ev: [[.12, () => {
        const sc = p.scene, ts = sc.combat.nearest(p.x, p.y, 3, 240);
        sc.cameras.main.flash(90, 255, 120, 200, true); Sfx.play('wave');
        if (!ts.length) { sc.fx.ring(p.x + p.face * 40, p.y, 30, 0xff5a9a, 300); return; }
        for (const e of ts) {
          for (let k = 0; k < 3; k++) sc.time.delayedCall(k * 70, () => sc.fx.ring(e.x, e.y, 14 + k * 8, 0xff8ac0, 260));
          if (!e.boss && e.b) e.b.setVelocity(0, -260);
          sc.time.delayedCall(300, () => {
            if (!e.alive) return;
            if (!e.boss && e.b) e.b.setVelocityY(460);
            sc.combat.damageEnemy(e, p.atk * 2.6, 'psychic', { hx: e.x, hy: e.y, hs: 80 });
            sc.fx.starburst(e.x, e.y, 0xff8ac0, 1.2);
          });
        }
      }]]
    };
  },
  // 열풍(불꽃): 부채꼴로 퍼지는 뜨거운 불꽃 파도 5갈래 (화상)
  heat_wave(p) {
    return {
      dur: .35, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        shoot(p, { count: 5, spread: .2, kind: 'fire', type: 'fire', r: 5, speed: 230, mul: 1.1, life: .6, status: { burn: 2.5 }, pierce: 2 });
        for (let k = 0; k < 6; k++) p.scene.combat.pr.flamePuff(p.x + p.face * 10, p.y - 3, p.face * (120 + Math.random() * 60), (Math.random() - .5) * 140, .3, .4, 1.1, false);
        Sfx.play('fire');
      }]]
    };
  },
  // 강철날개(강철): 은빛 날개를 펴고 비스듬히 치고 나간다
  steel_wing(p) {
    p.scene.fx.slash(p.x - p.face * 4, p.y - 2, 15 * sizeMul(p), p.face, 0, { pal: SLASH_PAL.steel, a0: -1.6, a1: .4, thick: 7 });
    return dashAction(p, { dur: .24, vx: 380, vy: -40, mul: 1.9, type: 'steel', color: 0xd8e4f4,
      tick(p) { if (Math.random() < .6) p.scene.fx.burst(p.x - p.face * 6, p.y, [0xd8e4f4, 0xffffff, 0x8a94b0], 1, 50, { up: 10, grav: 200, glow: true, life: .3, size: 1 }); },   // 강철 날개에서 튀는 쇳가루
      end(p) { p.jumpsUsed = Math.min(p.jumpsUsed, 1); p.scene.fx.slash(p.x - p.face * 4, p.y - 2, 15 * sizeMul(p), p.face, 0, { pal: SLASH_PAL.steel, a0: -.4, a1: 1.6, flipV: true, thick: 7 }); } });
  },
  // 냉동펀치(얼음): 얼음 주먹 — 맞은 적을 가끔 얼린다
  ice_punch(p) {
    return {
      dur: .3, ctrl: true, anim: 'Attack', update(p, a) { p.b.setVelocityX(a.t < .1 ? p.face * 230 : p.b.velocity.x * .8); },
      ev: [[0, () => p.scene.fx.sonicBoom(p.x, p.y - 2, p.face, sizeMul(p))], [.1, () => {
        strikeHit(p, { fwd: 14, w: 26, h: 24, mul: 2.1, type: 'ice', status: { slow: 2.5 }, burst: 1.1, color: 0xbff0ff,
          onHit: e => { iceShards(p.scene, e.x, e.y, 6); if (Math.random() < .35) p.scene.combat.applyStatus(e, { freeze: 1.2 }); } });
      }]]
    };
  },
  // 스톤에지(바위): 앞으로 차례차례 솟는 날카로운 바위 칼날 5개 (급소율 높음)
  stone_edge(p) {
    return {
      dur: .45, mm: .1, anim: 'Strike', ev: [[.12, () => {
        const s = sizeMul(p);
        for (let k = 0; k < 5; k++) rockPillar(p, p.x + p.face * (20 + k * 18) * s, { delay: k * .07, type: 'rock', mul: 1.4, h: 28 + k * 4, w: 9, sharp: true, crit: .25 });
      }]]
    };
  },
  // 기가임팩트: 몸을 웅크려 황금빛 기운을 모았다가(0.28초) 앞으로 폭주 돌진 → 멈춰 서는 자리에서 거대한 충격 폭발. 쓴 뒤 반동으로 잠깐 굳는다
  giga_impact(p) {
    const sc = p.scene, s = sizeMul(p), set = new Set(), GOLD = [0xffe08a, 0xfff6d0, 0xffffff];
    return {
      dur: 1.25, ctrl: true, anim: 'Attack', inv: .75, noDash: true,
      update(p, a, dt) {
        if (a.t < .28) {   // 모으기: 금빛 알갱이가 몸으로 빨려 들고 몸이 납작해진다
          p.b.setVelocity(0, p.b.velocity.y);
          const ang = Math.random() * Math.PI * 2;
          sc.fx.burst(p.x + Math.cos(ang) * 30, p.y + Math.sin(ang) * 24, GOLD, 1, 100, { angle: ang + Math.PI, spread: .2, up: 0, grav: 0, bounce: false, glow: true, life: .25 });
          if (!a.sq) { a.sq = true; p.squash(1.3, .75); Sfx.play('charge2'); }
          return;
        }
        if (a.t < .62) {   // 폭주 돌진: 길에 닿는 적을 모두 들이받는다
          if (!a.go) { a.go = true; sc.fx.sonicBoom(p.x, p.y - 2, p.face, s * 1.3); sc.fx.shake(.008, 160, 'hit'); Sfx.play('dash'); }
          p.b.setVelocity(p.face * 430, 0); p.b.setAllowGravity(false);
          sc.combat.hitRect({ x: p.b.x - 8 * s, y: p.b.y - 6 * s, w: p.b.width + 16 * s, h: p.b.height + 12 * s }, 2.6, 'normal', { set, heavy: true, kbx: 340, kby: -200, onHit: e => sc.fx.starburst(e.x, e.y - 2, 0xffe08a, 1.2, { debris: true }) });
          a.gt = (a.gt || 0) - dt;
          if (a.gt <= 0) { a.gt = .025; sc.fx.ghost(p.sprite, 0xffe08a, .6, 240); sc.fx.burst(p.x - p.face * 10, p.y, GOLD, 2, 60, { grav: 0, bounce: false, glow: true, life: .3 }); }
          return;
        }
        if (!a.boom) {   // 충격 폭발: 금빛 고리 3겹 + 파편 + 땅 울림
          a.boom = true; p.b.setAllowGravity(true); p.b.setVelocity(-p.face * 120, -80);
          const x = p.x + p.face * 18 * s, y = p.y, R = 64 * s;
          sc.combat.hitCircle(x, y, R, 3.4, 'normal', { heavy: true, stun: .6, kbx: 320, kby: -260, hs: 110 });
          [0, 70, 140].forEach((d, k) => sc.time.delayedCall(d, () => sc.fx.ring(x, y, R * (.6 + k * .25), k === 1 ? 0xffffff : 0xffd860, 320)));
          sc.fx.glow(x, y, R, 0xffe08a, 360, 1); sc.fx.starburst(x, y, 0xfff0b0, 1.8, { debris: true });
          sc.fx.burst(x, y, GOLD, 34, 240, { up: 120, glow: true });
          sc.fx.hitStop(110); sc.fx.shake(.02, 380, 'hit'); sc.cameras.main.flash(160, 255, 240, 200, true);
          Sfx.play('hit_heavy'); Sfx.play('boom');
        }
        p.b.setVelocityX(p.b.velocity.x * .85);   // 반동: 남은 시간 동안 굳는다
        if (Math.random() < .3) sc.fx.embers(p.x, p.y, [0xffe08a, 0xffffff], 1, { speed: 20 });
      },
      end(p) { p.b.setAllowGravity(true); }
    };
  }
};

// 교체 등장 스킬
export const TAG_IMPL = {
  tag_fire(p) {
    const r = 58 * sizeMul(p), sc = p.scene;
    sc.combat.hitCircle(p.x, p.y, r, 2.2, 'fire', { burn: 3, kbx: 220, kby: -180 });
    sc.fx.ring(p.x, p.y, r, 0xff7a2a, 300); sc.fx.glow(p.x, p.y, r, 0xff5a1a, 320, 1);
    sc.fx.burst(p.x, p.y, [0xff7a2a, 0xffd04a, 0xffffff], 30, 200, { glow: true });
    sc.fx.shake(.012, 200, 'hit'); Sfx.play('fire'); Sfx.play('boom');
  },
  tag_water(p) {
    const r = 72 * sizeMul(p), sc = p.scene;
    sc.combat.hitCircle(p.x, p.y, r, 1.5, 'water', { kbx: 380, kby: -220 });
    sc.fx.ring(p.x, p.y, r, 0x4ac0ff, 300); sc.time.delayedCall(90, () => sc.fx.ring(p.x, p.y, r * .7, 0xbfe6ff, 260));
    sc.fx.burst(p.x, p.bottom - 2, [0x4ac0ff, 0xbfe6ff], 30, 220, { up: 120 });
    sc.fx.shake(.008, 160, 'hit'); Sfx.play('water');
  },
  tag_grass(p) {
    const r = 92 * sizeMul(p), sc = p.scene;
    for (const e of sc.combat.nearest(p.x, p.y, 8, r)) lineFx(sc, p.x, p.bottom - 2, e.x, e.y, 0x5ed04a, { seg: 6, jag: 6, w: 2, ms: 400 });
    sc.combat.hitCircle(p.x, p.y, r, 1, 'grass', { root: 1.6, kbx: 0, kby: 0 });
    sc.fx.ring(p.x, p.y, r, 0x5ed04a, 320); Sfx.play('leaf');
  },
  tag_normal(p) {
    p.startAction(SKILL_IMPL.quick_attack(p), 'tag');
    p.scene.combat.hitCircle(p.x, p.y, 30, 1.6, 'normal', { kbx: 200 });
  },
  tag_electric(p) {
    const r = 72 * sizeMul(p), sc = p.scene;
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; lineFx(sc, p.x, p.y, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .6, 0xffe040, { seg: 5, jag: 8, ms: 220 }); }
    sc.combat.hitCircle(p.x, p.y, r, 1.4, 'electric', { paralyze: .8, kbx: 120 });
    sc.fx.glow(p.x, p.y, r, 0xffe040, 240, .9); Sfx.play('zap');
  },
  tag_flying(p) {
    const r = 84 * sizeMul(p), sc = p.scene;
    sc.combat.hitCircle(p.x, p.y, r, .8, 'flying', { confuse: 1.4, kbx: 140 });
    for (let k = 1; k <= 3; k++) sc.time.delayedCall(k * 60, () => sc.fx.ring(p.x, p.y, r * k / 3, 0xc8b0ff, 240));
    Sfx.play('wave');
  },
  tag_fighting(p) {
    const r = 84 * sizeMul(p), sc = p.scene;
    sc.combat.hitCircle(p.x, p.bottom - 6, r, 2, 'fighting', { kbx: 120, kby: -380 });
    sc.fx.burst(p.x, p.bottom - 2, [0xc0a070, 0xffd0a0], 26, 200, { up: 150 });
    sc.fx.ring(p.x, p.bottom - 4, r, 0xffb070, 300); sc.fx.shake(.014, 240, 'hit'); Sfx.play('boom');
    p.squash(1.35, .7);
  },
  tag_ghost(p) {
    const r = 92 * sizeMul(p), sc = p.scene;
    sc.combat.hitCircle(p.x, p.y, r, 1.2, 'ghost', { curse: 5, kbx: 60 });
    sc.fx.ring(p.x, p.y, r, 0x9a5aff, 340); sc.fx.glow(p.x, p.y, r, 0x6a2aff, 340, .8); Sfx.play('ghost');
  }
};

// ---------------- Z기술 (Q) ----------------
// 공통 흐름: ① 기 모으기(0~0.55초) 시간 정지 · 크리스탈 빛 · 기술명 배너 → ② 기술별 연출 → ③ 일격: 화면 안 모든 적에게 공격력 × mul
// 시전 내내 무적. 연출 크기는 진화 단계(sizeMul)를 따른다.
const Z_COLORS = [0xffffff, 0xfff6a0, 0xffb0ff, 0x9ad8ff];

function zCharge(p, def) {
  const sc = p.scene, col = typeColor(def.type);
  sc.fx.hitStop(420);
  sc.cameras.main.flash(220, 255, 250, 220, true);
  sc.events.emit('banner', `Z기술!  ${def.name}`, `${p.name}의 전력`);
  for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 90, () => sc.fx.ring(p.x, p.y, 70 - k * 14, Z_COLORS[k], 380));
  sc.fx.burst(p.x, p.y, [col, ...Z_COLORS], 30, 160, { glow: true, grav: -40, bounce: false, life: .9 });
  sc.fx.glow(p.x, p.y, 70, col, 600, 1);
  p.flash(160);
  Sfx.play('zmove');
}

// 화면(카메라 시야) 안의 살아 있는 적 전원에게 일격
function zStrike(p, def, status = {}, o = {}) {
  const sc = p.scene, view = sc.cameras.main.worldView, col = typeColor(def.type);
  for (const e of sc.enemies) {
    if (!e.alive || e.x < view.x - 10 || e.x > view.right + 10 || e.y < view.y - 20 || e.y > view.bottom + 20) continue;
    sc.combat.damageEnemy(e, p.atk * def.mul, def.type, Object.assign({ kb: Math.sign(e.x - p.x || 1) * (o.kbx ?? 260), kby: o.kby ?? -260, hx: e.x, hy: e.y, hs: 30 }, status));
    sc.fx.ring(e.x, e.y, 34 * sizeMul(p), col, 360);
  }
  if (sc.props) sc.props.hitRect({ x: view.x, y: view.y, w: view.width, h: view.height });
  sc.cameras.main.flash(260, 255, 255, 255, true);
  sc.fx.shake(.022, 520, 'hit');
  Sfx.play('boom');
}

function zAction(p, def, o) {
  const dur = o.dur ?? 1.7;
  return {
    dur, mm: 0, anim: o.anim ?? 'Attack', inv: dur + .5, lockFace: true, noGrav: !!o.noGrav, ctrl: !!o.ctrl, update: o.update,
    ev: [[0, () => zCharge(p, def)], ...(o.ev || []), [o.hitAt ?? 1.1, () => zStrike(p, def, o.status, o)]],
    end: o.end
  };
}

// 라인별 전용 스킬 파일(game/skills/*.js)도 같은 도구를 쓴다 (game/skillKit.js 가 다시 내보낸다)
export { sizeMul, slashHit, strikeHit, shoot, lineFx, beamAction, rockPillar, iceShards, dashAction, zCharge, zStrike, zAction };

const zView = p => p.scene.cameras.main.worldView;
const zGround = (p, x) => p.scene.groundBelow(x, p.y - 30);

export const ZMOVE_IMPL = {
  // 다이내믹풀플레임: 하늘에서 거대한 화염구가 떨어져 폭발
  inferno_overdrive(p, def) {
    const sc = p.scene, s = sizeMul(p);
    let ball = null, tx = 0, ty = 0;
    return zAction(p, def, {
      status: { burn: 4 },
      ev: [
        [.55, () => {
          const v = zView(p); tx = p.x + p.face * 70; ty = zGround(p, tx);
          ball = sc.add.image(tx - p.face * 80, v.y - 30, 'glow').setTint(0xff5a1a).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2 * s).setDepth(45);
          sc.tweens.add({ targets: ball, x: tx, y: ty - 10, scale: 3.2 * s, duration: 520, ease: 'Quad.easeIn' });
          Sfx.play('fire');
        }],
        [.7, () => { if (ball) sc.fx.embers(ball.x, ball.y, [0xff7a2a, 0xffd04a], 12, { speed: 60 }); }],
        [1.08, () => {
          if (ball) ball.destroy();
          for (let k = 0; k < 6; k++) sc.time.delayedCall(k * 60, () => sc.fx.ring(tx, ty - 10, (60 + k * 40) * s, k % 2 ? 0xffd04a : 0xff5a1a, 500));
          sc.fx.glow(tx, ty - 10, 200 * s, 0xff5a1a, 700, 1);
          sc.fx.burst(tx, ty - 6, [0xff5a1a, 0xffd04a, 0xffffff, 0x8a1a0a], 90, 340 * s, { up: 220, glow: true, life: 1.1 });
        }]
      ]
    });
  },
  // 슈퍼아쿠아토네이도: 소용돌이가 솟아오른다
  hydro_vortex(p, def) {
    const sc = p.scene, s = sizeMul(p), g = sc.add.graphics().setDepth(44).setBlendMode(Phaser.BlendModes.ADD);
    let cx = 0, gy = 0;
    return zAction(p, def, {
      dur: 1.9, status: { slow: 3 }, kbx: 80, kby: -420,
      ev: [[.5, () => { cx = p.x + p.face * 60; gy = zGround(p, cx); Sfx.play('water'); }]],
      update(p, a) {
        g.clear();
        if (a.t < .5 || a.t > 1.8) return;
        const k = Math.min(1, (a.t - .5) / .5), H = 220 * s * k, t = a.t * 14;
        for (let i = 0; i < 26; i++) {
          const u = i / 25, y = gy - u * H, r = (12 + u * 70) * s, ang = t + u * 9;
          g.lineStyle(3, i % 2 ? 0x4ac0ff : 0xbfe6ff, .85 * (1 - u * .4));
          g.beginPath(); g.arc(cx, y, r, ang, ang + 2.4); g.strokePath();
        }
        if (Math.random() < .6) sc.fx.burst(cx + (Math.random() - .5) * 80 * s, gy - 4, [0x4ac0ff, 0xffffff], 3, 120, { up: 160 });
      },
      end() { g.destroy(); }
    });
  },
  // 블룸샤인엑스트라: 거대한 꽃이 피고 꽃잎 폭풍 + 파티 회복
  bloom_doom(p, def) {
    const sc = p.scene, s = sizeMul(p);
    return zAction(p, def, {
      status: { root: 2 },
      ev: [
        [.55, () => { for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; sc.fx.glow(p.x + Math.cos(a) * 40 * s, p.y - 20 + Math.sin(a) * 24 * s, 34 * s, k % 2 ? 0xff8ad0 : 0x7aff6a, 700, .9); } Sfx.play('leaf'); }],
        [.8, () => { const v = zView(p); for (let x = v.x + 20; x < v.right; x += 36) { const gy = zGround(p, x); lineFx(sc, x, gy, x + (Math.random() - .5) * 20, gy - (60 + Math.random() * 70) * s, 0x5ed04a, { seg: 6, jag: 10, w: 3, ms: 600 }); } }],
        [1.1, () => {
          sc.fx.burst(p.x, p.y, [0xff8ad0, 0xffd0f0, 0x7aff6a, 0xffffff], 100, 300 * s, { up: 120, grav: 60, glow: true, life: 1.4 });
          for (const m of p.members) if (m.alive) m.hp = Math.min(m.maxhp, m.hp + m.maxhp * .25);
          sc.fx.floatText(p.x, p.b.y - 16, '파티 회복!', '#7dff9a', 12);
        }]
      ]
    });
  },
  // 울트라대시어택: 화면 끝까지 왕복 돌진
  breakneck_blitz(p, def) {
    const sc = p.scene;
    return zAction(p, def, {
      dur: 1.6, ctrl: true, noGrav: true, hitAt: 1.15,
      update(p, a) {
        const v = zView(p);
        if (a.t < .5) { p.b.setVelocity(0, 0); return; }
        const dir = a.t < .85 ? p.face : -p.face;
        p.b.setVelocity(dir * 820, 0);
        if (p.x < v.x + 20 || p.x > v.right - 20) p.b.setVelocityX(0);
        a.gt = (a.gt || 0) - .016;
        if (a.gt <= 0) { a.gt = .02; sc.fx.ghost(p.sprite, 0xffffff, .6, 260); }
      },
      end(p) { p.b.setVelocity(0, 0); }
    });
  },
  // 필살 피카슛: 하늘에서 번개가 쏟아지고 몸통으로 내리꽂는다
  catastropika(p, def) {
    const sc = p.scene, s = sizeMul(p);
    return zAction(p, def, {
      status: { paralyze: 1 },
      ev: [
        [.5, () => { p.b.setVelocityY(-420); Sfx.play('thunder'); }],
        ...[.65, .75, .85, .95, 1.05].map(t => [t, () => { const v = zView(p); for (let k = 0; k < 3; k++) { const x = v.x + Math.random() * v.width; lineFx(sc, x, v.y, x + (Math.random() - .5) * 40, zGround(p, x), 0xffe040, { seg: 9, jag: 18, w: 3 * s, ms: 260 }); } Sfx.play('zap'); }]),
        [1.08, () => { p.b.setVelocityY(700); sc.fx.glow(p.x, p.y, 160 * s, 0xffe040, 600, 1); sc.fx.burst(p.x, p.y, [0xffe040, 0xffffff], 70, 300 * s, { glow: true }); }]
      ]
    });
  },
  // 애시드포이즌딜리트: 독의 늪 + 독비
  acid_downpour(p, def) {
    const sc = p.scene, s = sizeMul(p);
    return zAction(p, def, {
      dur: 1.9, status: { poison: 6 },
      update(p, a) {
        if (a.t < .5 || a.t > 1.6) return;
        const v = zView(p);
        for (let k = 0; k < 6; k++) sc.fx.burst(v.x + Math.random() * v.width, v.y + 4, [0xb84ad0, 0xd08aff, 0x6a1a8a], 1, 30, { angle: Math.PI / 2, spread: .2, up: -260, grav: 500, life: 1.2, size: 2 });
        if (Math.random() < .3) { const x = v.x + Math.random() * v.width; sc.fx.glow(x, zGround(p, x) - 2, 40 * s, 0x9a2ac0, 500, .7); }
      },
      ev: [[.5, () => Sfx.play('ghost')], [1.1, () => { const v = zView(p); for (let x = v.x; x < v.right; x += 30) sc.fx.burst(x, zGround(p, x) - 2, [0xb84ad0, 0x6a1a8a], 4, 90, { up: 100 }); }]]
    });
  },
  // 전력무쌍격렬권: 주먹 탄환이 화면에 쏟아진다
  all_out_pummeling(p, def) {
    const sc = p.scene, s = sizeMul(p);
    return zAction(p, def, {
      dur: 1.8,
      update(p, a) {
        if (a.t < .5 || a.t > 1.2) return;
        const v = zView(p), x = v.x + Math.random() * v.width, y = v.y + 30 + Math.random() * (v.height - 60);
        const fist = sc.add.image(p.x, p.y, 'glow').setTint(0xffb070).setBlendMode(Phaser.BlendModes.ADD).setScale(.5 * s).setDepth(45);
        sc.tweens.add({ targets: fist, x, y, duration: 140, onComplete: () => { sc.fx.ring(x, y, 22 * s, 0xffd0a0, 200); sc.fx.burst(x, y, [0xffb070, 0xffffff], 6, 120); fist.destroy(); } });
        if (Math.random() < .3) Sfx.play('punch');
      }
    });
  },
  // 무한암야로의 유인: 땅에서 그림자 손이 솟아 붙잡는다
  never_ending_nightmare(p, def) {
    const sc = p.scene, s = sizeMul(p);
    return zAction(p, def, {
      status: { curse: 8, stun: 1.2 },
      ev: [
        [.5, () => { sc.cameras.main.flash(400, 40, 0, 60, true); Sfx.play('ghost'); }],
        ...[.6, .72, .84, .96].map(t => [t, () => {
          const v = zView(p);
          for (let k = 0; k < 5; k++) { const x = v.x + Math.random() * v.width, gy = zGround(p, x); lineFx(sc, x, gy, x + (Math.random() - .5) * 30, gy - (50 + Math.random() * 60) * s, 0x9a5aff, { seg: 6, jag: 12, w: 4, ms: 500 }); sc.fx.glow(x, gy - 30, 30 * s, 0x6a2aff, 500, .8); }
        }])
      ]
    });
  }
};
