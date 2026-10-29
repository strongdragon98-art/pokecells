// 특수 포켓몬 라인 기술 구현 (랄토스 · 애버라스 · 미뇽 · 잉어킹/갸라도스 · 롱스톤 · 스라크)
// 각 스킬은 행동(action) 객체를 돌려준다:
//  { dur, mm(이동 배율), anim, ctrl(속도 직접 제어), noGrav, lockFace, guard, inv, ev:[[시각, fn]], update(p,a,dt), end(p,a) }
// 특성(순간이동 대시·슈퍼아머·모래바람·파닥 이동·거대 몸집·행동 속도)은 Player.js 담당
import Phaser from 'phaser';
import { typeColor } from '../../data/types.js';
import { Sfx } from '../../systems/Audio.js';
import { sizeMul, slashHit, shoot, lineFx, dashAction, view, groundAt } from '../skillKit.js';

const ADD = Phaser.BlendModes.ADD;
const PSY = typeColor('psychic'), FAIRY = typeColor('fairy'), DRAGON = typeColor('dragon');
const ROCK = [0xc0a050, 0x8a7048, 0xe0c890], DIRT = [0xd8b060, 0x8a6a3a, 0xb09060];
const STEEL_RED = 0xff3a4a;

// 행동이 끝나거나 대시·교대로 끊기면 한 번 정리 (대시는 end 를 부르지 않으므로 그래픽·투명화가 남지 않게)
function onLeave(p, a, fn) {
  const ev = p.scene.events, off = () => { ev.off('postupdate', h); ev.off('shutdown', off); }, h = () => { if (p.action !== a) { off(); fn(); } };
  ev.on('postupdate', h); ev.once('shutdown', off);
}

// 굵은 광선: 바깥 빛 → 안쪽 빛 → 흰 심지 + 발사구 빛
function drawBeam(g, x1, y1, x2, y2, w, col, inner) {
  if (w <= .5) return;
  g.lineStyle(w, col, .5); g.lineBetween(x1, y1, x2, y2);
  g.lineStyle(w * .6, inner, .8); g.lineBetween(x1, y1, x2, y2);
  g.lineStyle(Math.max(2, w * .2), 0xffffff, 1); g.lineBetween(x1, y1, x2, y2);
  g.fillStyle(inner, .9); g.fillCircle(x1, y1, w * .6);
}

// 선분(광선) 근처의 적에게 fn(e)
function segHit(sc, x1, y1, x2, y2, r, fn) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  for (const e of sc.enemies) {
    if (!e.alive) continue;
    const t = Phaser.Math.Clamp(((e.x - x1) * dx + (e.y - y1) * dy) / L2, 0, 1);
    if (Math.hypot(e.x - (x1 + dx * t), e.y - (y1 + dy * t)) <= r + e.b.width / 2) fn(e);
  }
}

// 모이는 기 파티클 (중심으로 빨려 든다)
function gather(sc, x, y, r, cols) {
  const ang = Math.random() * Math.PI * 2;
  sc.fx.burst(x + Math.cos(ang) * r, y + Math.sin(ang) * r, cols, 1, r * 2.6, { angle: ang + Math.PI, spread: .1, up: 0, grav: 0, bounce: false, glow: true, life: .35 });
}

// 땅에서 솟는 바위 가시
function spike(sc, x, gy, h, w) {
  const g = sc.add.graphics({ x, y: gy }).setDepth(41);
  g.fillStyle(0x4a3a24, 1); g.fillTriangle(-w / 2 - 1, 1, w / 2 + 1, 1, 0, -h - 2);
  g.fillStyle(ROCK[0], 1); g.fillTriangle(-w / 2, 0, w / 2, 0, 0, -h);
  g.fillStyle(ROCK[2], .9); g.fillTriangle(-w * .2, -h * .15, w * .05, -h * .2, 0, -h * .92);
  g.scaleY = 0;
  sc.tweens.add({ targets: g, scaleY: 1, duration: 70, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: g, alpha: 0, scaleY: .25, delay: 460, duration: 220, onComplete: () => g.destroy() });
}

// 떨어지는 바위 덩어리 (그래픽, 원점 = 바위 중심)
function boulder(sc, x, y, r) {
  const g = sc.add.graphics({ x, y }).setDepth(41);
  g.fillStyle(0x3a2e1c, 1); g.fillCircle(0, 1, r + 1);
  g.fillStyle(ROCK[1], 1); g.fillCircle(0, 0, r);
  g.fillStyle(ROCK[0], 1); g.fillCircle(-r * .2, -r * .25, r * .65);
  g.fillStyle(ROCK[2], 1); g.fillRect(Math.round(-r * .45), Math.round(-r * .55), Math.max(1, Math.round(r * .3)), Math.max(1, Math.round(r * .2)));
  g.rotation = Math.random() * Math.PI;
  return g;
}

// X자 베기 궤적
function xFx(sc, x, y, r, col) {
  lineFx(sc, x - r, y - r, x + r, y + r, col, { seg: 2, jag: 0, w: 3, ms: 180 });
  lineFx(sc, x - r, y + r, x + r, y - r, col, { seg: 2, jag: 0, w: 3, ms: 180 });
  sc.fx.glow(x, y, r * 1.2, col, 160, .6);
}

// 앞쪽 땅 높이 (낭떠러지면 null)
const groundAhead = (p, x) => { const gy = groundAt(p, x); return gy - p.bottom > 70 ? null : gy; };

export const SKILL_IMPL = {
  // ===== 랄토스 → 킬리아 → 가디안 =====
  confusion_orb(p, i) {
    const m = p.mega.active;
    if (i < 2) return {
      dur: .22, mm: .45, anim: 'Shoot', ev: [[.06, () => {
        shoot(p, { speed: 330, r: 3, mul: .85, type: 'psychic', kind: 'psy', life: .32, pierce: m ? 3 : 1, color: 0xff8ac0, oy: i ? 1 : -6, kb: 70 });
        p.scene.fx.ring(p.x + p.face * 10, p.y - 3, 10 * sizeMul(p), PSY, 160);
        Sfx.play('wave');
      }]]
    };
    return {
      dur: .32, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        shoot(p, { speed: 190, r: 6, mul: 1.6, type: 'psychic', kind: 'psy', life: 1.3, homing: .9, pierce: 1, status: { confuse: .6 }, color: PSY, light: true, count: m ? 2 : 1, spread: .35, kb: 140 });
        p.scene.fx.glow(p.x + p.face * 10, p.y - 3, 18 * sizeMul(p), PSY, 220, .9);
        Sfx.play('ghost');
      }]]
    };
  },
  psychic(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), held = [];
    return {
      dur: 1.05, mm: 0, anim: 'Shoot', lockFace: true,
      ev: [
        [.08, () => {
          for (const e of sc.combat.nearest(p.x, p.y, m ? 12 : 7, (m ? 210 : 150) * s)) {
            sc.combat.damageEnemy(e, p.atk * .4, 'psychic', { stun: 1.1, hs: 0 });
            let ty = e.y - 46 * s; if (sc.isSolidAt(e.x, ty - 8)) ty = e.y - 14;
            held.push({ e, sx: e.x, ty, k: Math.random() * 6 });
            lineFx(sc, p.x + p.face * 6, p.y - 6, e.x, e.y, PSY, { seg: 6, jag: 10, w: 2, ms: 260 });
          }
          sc.fx.ring(p.x, p.y, (m ? 210 : 150) * s, PSY, 360); sc.fx.glow(p.x, p.y - 6, 30 * s, PSY, 400, .9);
          sc.cameras.main.flash(90, 255, 140, 200, true);
          Sfx.play('wave'); p.squash(.85, 1.2);
        }],
        // 내리꽂기
        [.74, () => {
          for (const h of held) {
            const e = h.e; if (!e.alive) continue;
            sc.combat.damageEnemy(e, p.atk * (m ? 3.1 : 2.6), 'psychic', { stun: .5, hs: 40, hx: e.x, hy: e.y });
            if (!e.boss && e.alive) e.b.setVelocity(0, 640);
            const gx = e.x, gy = sc.groundBelow(e.x, e.y);
            sc.time.delayedCall(110, () => { sc.fx.ring(gx, gy - 2, 26 * s, PSY, 260); sc.fx.burst(gx, gy - 2, [PSY, 0xffd0f0, DIRT[0]], 12, 140, { up: 90 }); });
          }
          if (held.length) { sc.fx.shake(.014, 260); sc.time.delayedCall(110, () => Sfx.play('boom')); }
          p.squash(1.25, .8);
        }]
      ],
      update(p, a) {
        if (a.t < .08 || a.t > .74) return;
        for (const h of held) {
          const e = h.e; if (!e.alive) continue;
          if (Math.random() < .3) sc.fx.embers(e.x + (Math.random() - .5) * e.b.width, e.y, [PSY, 0xffd0f0], 1, { speed: 20 });
          if (e.boss) continue;   // 보스는 들리지 않고 붙잡힐 뿐
          e.b.setVelocity((h.sx - e.x) * 6, (h.ty + Math.sin(a.t * 10 + h.k) * 3 - e.y) * 9);
        }
        if (Math.random() < .25 && held.length) { const h = held[(Math.random() * held.length) | 0]; if (h.e.alive) lineFx(sc, p.x + p.face * 6, p.y - 6, h.e.x, h.e.y, 0xff8ac0, { seg: 5, jag: 8, w: 1, ms: 120 }); }
      }
    };
  },
  moonblast(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p);
    let orb = null;
    return {
      dur: .85, mm: 0, anim: 'Shoot', lockFace: true,
      update(p, a) {
        if (a.t >= .5) return;
        const ox = p.x + p.face * 12, oy = p.y - 6;
        if (!orb) { orb = sc.add.image(ox, oy, 'glow').setBlendMode(ADD).setTint(0xffd0f0).setDepth(44); const o = orb; onLeave(p, a, () => o.destroy()); }
        orb.setPosition(ox, oy).setScale((.2 + a.t * 1.7) * s).setAlpha(.6 + Math.random() * .4);
        if (Math.random() < .85) gather(sc, ox, oy, 36 * s, [0xffd0f0, 0xffffff, FAIRY]);
      },
      ev: [[.5, () => {
        if (orb) { orb.destroy(); orb = null; }
        shoot(p, { speed: m ? 130 : 110, r: m ? 10 : 9, mul: 0, type: 'fairy', kind: 'moon', life: 2.2, pierce: 1, color: 0xffc8f0, light: true, oy: -6, grow: m ? 6 : 0, status: { slow: 2 }, boom: { r: (m ? 84 : 62) * s, mul: m ? 4 : 3.4, kb: 280 } });
        sc.fx.ring(p.x + p.face * 12, p.y - 6, 30 * s, FAIRY, 300);
        sc.cameras.main.flash(90, 255, 220, 250, true);
        Sfx.play('wave'); Sfx.play('beam'); p.squash(.8, 1.2);
      }]]
    };
  },

  // ===== 애버라스 → 데기라스 → 마기라스 =====
  rock_smash(p, i) {
    if (i < 2) return {
      dur: .28, mm: .3, anim: 'Attack', ev: [[.1, () => {
        slashHit(p, { fwd: 14, w: 26, h: 22, mul: 1.05, type: 'fighting', kbx: 170, color: 0xffc8a0, flipV: i === 1, arc: 12, thick: 6 });
        p.scene.fx.shake(.005, 80); Sfx.play('punch');
      }]]
    };
    const m = p.mega.active;
    return {
      dur: .44, mm: 0, anim: 'Strike', ev: [[.18, () => {
        const sc = p.scene, s = sizeMul(p), x = p.x + p.face * 20 * s, gy = groundAt(p, x), y = Math.min(p.y, gy - 10 * s);
        sc.combat.hitCircle(x, y, 28 * s, 1.75, 'rock', { kbx: 260, kby: -260, hs: 90 });
        sc.fx.ring(x, y, 30 * s, ROCK[0], 280); sc.fx.glow(x, y, 26 * s, 0xffb070, 220, .8);
        sc.fx.burst(x, gy - 2, ROCK, 26, 200, { up: 170 });
        if (m) shoot(p, { speed: 230, vy: -170, grav: 650, r: 4, mul: .8, type: 'rock', kind: 'rock', life: .9, count: 3, spread: .3, color: ROCK[0], kb: 160 });
        sc.fx.shake(.012, 200); Sfx.play('boom'); Sfx.play('crack'); p.squash(1.3, .78);
      }]]
    };
  },
  stone_edge(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), n = m ? 9 : 6, set = new Set();
    let stop = false;
    const at = k => () => {
      if (stop) return;
      const x = p.x + p.face * (22 + k * 22) * s, gy = groundAhead(p, x);
      if (gy === null || sc.isSolidAt(x, gy - 8)) { stop = true; return; }
      const h = (m ? 46 : 36) * s * (.8 + Math.random() * .4), w = 12 * s;
      spike(sc, x, gy, h, w);
      sc.combat.hitRect({ x: x - w / 2, y: gy - h, w, h }, m ? 2.8 : 2.4, 'rock', { set, crit: .35, kbx: 60, kby: -340, hs: 60 });
      sc.fx.burst(x, gy - 2, DIRT, 6, 90, { up: 80 });
      sc.fx.shake(.004, 60); Sfx.play('crack');
    };
    return {
      dur: .4 + n * .05, mm: 0, anim: 'Strike', lockFace: true,
      ev: [[.08, () => { p.squash(1.25, .8); Sfx.play('punch'); }], ...Array.from({ length: n }, (_, k) => [.12 + k * .05, at(k)])]
    };
  },
  crunch(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p);
    const bite = (p, a) => {
      a.bit = true;
      const cx = p.x + p.face * 16 * s, cy = p.y - 2;
      sc.combat.hitRect({ x: cx - 16 * s, y: cy - 14 * s, w: 32 * s, h: 28 * s }, m ? 3.5 : 3, 'dark', { curse: m ? 9 : 6, crit: .15, lifesteal: m ? .25 : 0, kbx: 220, kby: -160, hs: 130 });
      sc.fx.slash(cx, cy - 4 * s, 15 * s, p.face, 0xffffff, { thick: 6, a0: -2.4, a1: -.2, ms: 180 });            // 윗턱
      sc.fx.slash(cx, cy + 4 * s, 15 * s, p.face, 0xffffff, { thick: 6, a0: -2.4, a1: -.2, flipV: true, ms: 180 }); // 아랫턱
      sc.fx.ring(cx, cy, 24 * s, typeColor('dark'), 260); sc.fx.burst(cx, cy, [0x6a5446, 0xffffff, 0xc890ff], 14, 140);
      sc.fx.shake(.012, 180); Sfx.play('crack'); Sfx.play('punch'); p.squash(1.3, .8);
    };
    return {
      dur: .52, ctrl: true, anim: 'Strike', inv: .3, lockFace: true,
      update(p, a, dt) {
        if (a.t < .1) { p.b.setVelocityX(0); if (!a.sq) { a.sq = true; p.squash(.8, 1.15); } return; }
        if (a.bit) { p.b.setVelocityX(p.b.velocity.x * .8); return; }
        p.b.setVelocityX(p.face * 400);
        a.gt = (a.gt || 0) - dt; if (a.gt <= 0) { a.gt = .03; sc.fx.ghost(p.sprite, 0x6a5446, .5, 200); }
        const fw = 22 * s;
        if (a.t >= .3 || sc.combat.enemiesIn({ x: p.face > 0 ? p.x : p.x - fw, y: p.y - 12 * s, w: fw, h: 24 * s }).length) bite(p, a);
      }
    };
  },

  // ===== 미뇽 → 신뇽 → 망나뇽 =====
  dragon_tail(p, i) {
    if (i < 2) return { dur: .24, mm: .4, anim: 'Attack', ev: [[.07, () => slashHit(p, { fwd: 12, w: 30, h: 18, oy: 3, mul: 1, type: 'dragon', kbx: 150, color: 0x9a8aff, flipV: i === 1, arc: 16 })]] };
    const m = p.mega.active;
    return {
      dur: .42, mm: .2, anim: 'Strike', ev: [[.14, () => {
        const sc = p.scene, r = 36 * sizeMul(p) * (m ? 1.4 : 1);
        sc.combat.hitCircle(p.x, p.y, r, 1.7, 'dragon', Object.assign({ kbx: 460, kby: -280, hs: 90 }, m ? { stun: .5 } : {}));
        sc.fx.slash(p.x + p.face * r * .4, p.y + 2, r * .8, p.face, 0x9a8aff, { thick: 8, ms: 180 });
        sc.fx.slash(p.x - p.face * r * .4, p.y + 2, r * .8, -p.face, 0x6a4aff, { thick: 8, flipV: true, ms: 200 });
        sc.fx.ring(p.x, p.y, r, DRAGON, 280); sc.fx.burst(p.x, p.y, [DRAGON, 0xc8b8ff, 0xffffff], 16, 180);
        sc.fx.ghost(p.sprite, 0x9a8aff, .6, 240);
        sc.fx.shake(.01, 160); Sfx.play('swing'); Sfx.play('punch'); p.squash(1.3, .8);
      }]]
    };
  },
  extreme_speed(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), v = view(p), hw = p.b.width / 2, x0 = p.x, y0 = p.y, face = p.face;
    // 화면 끝 또는 벽까지의 거리
    const maxD = Math.max(0, face > 0 ? v.right - 14 - x0 : x0 - v.x - 14);
    let d = 0;
    for (; d < maxD; d += 4) { const fx = x0 + face * (d + hw + 3); if (sc.isSolidAt(fx, y0) || sc.isSolidAt(fx, p.b.y + 2) || sc.isSolidAt(fx, p.bottom - 3)) break; }
    const x1 = x0 + face * d;
    return {
      dur: .4, ctrl: true, noGrav: true, anim: 'Attack', inv: .5, lockFace: true,
      update(p, a) {
        if (a.t < .05) { p.b.setVelocity(0, 0); if (!a.w) { a.w = true; p.flash(60); p.squash(1.3, .7); sc.fx.burst(p.x, p.bottom - 1, 0xffffff, 8, 90, { up: 20 }); } return; }
        if (a.t < .17) {
          const k = (a.t - .05) / .12;
          p.b.reset(x0 + face * d * k, y0);
          sc.fx.ghost(p.sprite, k < .5 ? 0xffffff : 0xc8d8ff, .7, 260);
          return;
        }
        if (!a.arrived) {
          a.arrived = true; p.b.reset(x1, y0);
          lineFx(sc, x0, y0, x1, y0, 0xffffff, { seg: 2, jag: 0, w: 3, ms: 260 });
          lineFx(sc, x0, y0 - 6, x1, y0 - 6, 0xc8d8ff, { seg: 2, jag: 0, w: 1, ms: 200 });
          sc.fx.burst(x1, y0, [0xffffff, 0xc8d8ff], 14, 160, { angle: face > 0 ? 0 : Math.PI, spread: .8 });
          Sfx.play('dash'); p.squash(.7, 1.25);
        }
      },
      // 지나간 길의 적이 한 박자 늦게 베인다
      ev: [[.24, () => {
        const h = p.b.height + 14 * s, rect = { x: Math.min(x0, x1) - hw - 4, y: y0 - h / 2, w: d + hw * 2 + 8, h };
        for (const e of sc.combat.enemiesIn(rect)) { sc.fx.slash(e.x, e.y, 14 * s, face, 0xffffff, { thick: 5, flipV: Math.random() < .5 }); sc.fx.ring(e.x, e.y, 18 * s, 0xc8d8ff, 220); }
        if (sc.combat.hitRect(rect, m ? 3.3 : 2.7, 'normal', Object.assign({ kbx: 260, kby: -180, hs: 120 }, m ? { stun: .6 } : {}))) { sc.cameras.main.flash(80, 255, 255, 255, true); sc.fx.shake(.012, 200); }
        Sfx.play('swing');
      }]],
      end(p) { p.b.setVelocity(face * 120, 0); p.jumpsUsed = Math.min(p.jumpsUsed, 1); }
    };
  },
  outrage(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), r = (m ? 56 : 42) * s;
    if (p.addBuff) p.addBuff({ guard: .75, t: 2, color: 0xff4a4a });
    return {
      dur: 2, mm: .6, anim: 'Attack', tk: 0, bt: .2,
      update(p, a, dt) {
        a.tk -= dt; a.bt -= dt;
        if (Math.random() < .6) sc.fx.embers(p.x + (Math.random() - .5) * 20, p.y + 6, [0xff4a4a, DRAGON, 0xffb0a0], 1, { speed: 50 });
        if (a.tk <= 0) {
          a.tk = .2;
          sc.combat.hitCircle(p.x, p.y, r, .3, 'dragon', { kbx: 140, kby: -90, hs: 20 });
          sc.fx.ring(p.x, p.y, r, a.n % 2 ? 0xff4a4a : DRAGON, 200);
          sc.fx.slash(p.x, p.y, r * .7, (a.n = (a.n || 0) + 1) % 2 ? 1 : -1, 0xff6a6a, { thick: 6, flipV: a.n % 4 > 1 });
          sc.fx.ghost(p.sprite, 0xff4a4a, .5, 200);
          sc.fx.shake(.005, 80); Sfx.play('swing'); p.squash(1.15, .88);
        }
        // 역린의 번개: 근처 적 하나에 내리친다
        if (a.bt <= 0) {
          a.bt = m ? .18 : .3;
          const ts = sc.combat.nearest(p.x, p.y, 5, 200 * s), cam = view(p);
          if (ts.length) {
            const t = ts[(Math.random() * ts.length) | 0];
            lineFx(sc, t.x + (Math.random() - .5) * 24, cam.y, t.x, t.y, Math.random() < .5 ? 0xffe040 : 0xb0a0ff, { seg: 9, jag: 14, w: 3, ms: 220 });
            sc.fx.glow(t.x, t.y, 26 * s, 0xffe040, 200, .9);
            sc.combat.damageEnemy(t, p.atk * .5, 'electric', { paralyze: .25, hx: t.x, hy: t.y, hs: 20, kby: -80 });
            Sfx.play('zap');
          }
        }
      },
      // 반동: 지쳐서 잠시 둔해진다 (메가는 없음)
      end(p, a) {
        if (m || a.t < a.dur) return;
        p.slowT = 1.2;
        sc.fx.floatText(p.x, p.b.y - 10, '지쳐서 혼란에 빠졌다!', '#ff9ad0', 10);
        sc.fx.burst(p.x, p.b.y, [0xffe36a, 0xffffff], 6, 50, { grav: 0, bounce: false });
      }
    };
  },

  // ===== 잉어킹 (일부러 한심하다) =====
  splash(p, i) {
    const sc = p.scene, set = new Set();
    return {
      dur: .45, mm: 0, anim: 'Attack',
      ev: [
        [0, () => { if (p.onGround) p.b.setVelocityY(i === 2 ? -260 : -200); p.squash(.7, 1.35); sc.fx.burst(p.x, p.bottom - 1, [0x4ac0ff, 0xbfe6ff], 5, 50, { up: 60 }); Sfx.play('jump'); }],
        [.3, () => { if (!set.size && Math.random() < .5) sc.fx.floatText(p.x, p.b.y - 8, '하지만 아무 일도 일어나지 않았다!', '#c8c8d8', 10); }]
      ],
      update(p) {
        for (const e of sc.combat.enemiesIn({ x: p.b.x - 3, y: p.b.y - 3, w: p.b.width + 6, h: p.b.height + 6 })) {
          if (set.has(e)) continue;
          set.add(e);
          sc.combat.damageEnemy(e, 1, 'none', { hs: 0 });   // 딱 1
          if (Math.random() < .5) sc.fx.floatText(e.x, e.top - 8, '하지만 아무 일도 일어나지 않았다!', '#c8c8d8', 10);
        }
      }
    };
  },
  // 뛰어오르기: 위로 크게 뛰었다가 땅에 닿는 순간 충격파. 잉어킹 공격력(1.3)으로도 야생을 2~3방에 정화할 만큼 배율을 크게 잡았다
  bounce(p) {
    const sc = p.scene;
    return {
      dur: 1.4, mm: .7, anim: 'Walk',
      ev: [[0, () => { p.b.setVelocityY(-440); p.squash(.6, 1.45); Sfx.play('jump'); sc.fx.burst(p.x, p.bottom - 1, [0x8ad0ff, 0xffffff], 8, 80, { up: 60, life: .35 }); }]],
      update(p, a) {
        if (a.t > .2 && !a.landed && p.b.velocity.y > 0) p.b.setVelocityY(Math.min(560, p.b.velocity.y + 18));   // 내려올 땐 더 빠르게 내리꽂는다
        if (a.t < .25 || a.landed || !p.onGround) return;
        a.landed = true; a.dur = a.t + .18;
        const s = sizeMul(p), r = 38 * s;
        sc.combat.hitCircle(p.x, p.bottom - 8, r, 20, 'flying', { kbx: 170, kby: -240, hs: 90 });
        sc.fx.ring(p.x, p.bottom - 4, r, 0xc8e0ff, 280); sc.fx.ring(p.x, p.bottom - 4, r * .6, 0xffffff, 220);
        sc.fx.burst(p.x, p.bottom - 2, [0x8ad0ff, 0xc8e0ff, 0xffffff], 22, 160, { up: 120, life: .5 });
        sc.fx.shake(.012, 200); Sfx.play('boom'); p.squash(1.45, .65);
      }
    };
  },
  karp_tackle(p) {
    const sc = p.scene, set = new Set();
    return {
      dur: .42, ctrl: true, anim: 'Walk',
      ev: [[0, () => { p.b.setVelocityY(-120); p.squash(1.3, .7); Sfx.play('swing'); }]],
      update(p, a) {
        p.b.setVelocityX(p.face * 170 * Math.max(0, 1 - a.t / .42));
        if (sc.combat.hitRect({ x: p.b.x - 2, y: p.b.y, w: p.b.width + 4, h: p.b.height }, .3, 'normal', { set, kbx: 40, kby: -20, hs: 20 })) sc.fx.floatText(p.x, p.b.y - 8, '퍼덕!', '#c8c8d8', 10);
        if (Math.random() < .3) sc.fx.burst(p.x, p.bottom - 2, 0x9ad8ff, 1, 30, { up: 30 });
      },
      end(p) { p.squash(1.25, .75); }
    };
  },
  flail(p) {
    const sc = p.scene, low = 1 - p.m.hp / p.m.maxhp;
    if (low > .7) sc.fx.floatText(p.x, p.b.y - 10, '바둥바둥!!', '#ff9a6a', 10);
    return {
      dur: 1.2, ctrl: true, anim: 'Hurt', tk: 0,
      update(p, a, dt) {
        a.tk -= dt;
        if (a.tk > 0) return;
        a.tk = .15;
        p.face *= -1; p.refacing();
        p.b.setVelocityX((Math.random() - .5) * 240);
        if (p.onGround) p.b.setVelocityY(-120 - Math.random() * 60);
        p.squash(Math.random() < .5 ? 1.3 : .75, Math.random() < .5 ? .75 : 1.3);
        sc.combat.hitRect({ x: p.b.x - 6, y: p.b.y - 4, w: p.b.width + 12, h: p.b.height + 8 }, .2 + low * 1.2, 'normal', { kbx: 50, kby: -40, hs: 0 });   // 체력이 낮을수록 세다
        sc.fx.burst(p.x, p.y, [0x4ac0ff, 0xbfe6ff, 0xffa060], 3, 60, { up: 50 });
        Sfx.play('swing');
      },
      end(p) { p.b.setVelocityX(0); }
    };
  },

  // ===== 갸라도스 =====
  aqua_tail(p, i) {
    const m = p.mega.active;
    if (i < 2) return {
      dur: .3, mm: .3, anim: 'Attack', ev: [[.1, () => {
        slashHit(p, { fwd: 18, w: 44, h: 30, mul: 1.05, type: 'water', kbx: 220, color: 0x4ac0ff, flipV: i === 1, arc: 22, thick: 8 });
        p.scene.fx.burst(p.x + p.face * 26 * sizeMul(p), p.y, [0x4ac0ff, 0xbfe6ff, 0xffffff], 10, 140, { up: 60 });
        Sfx.play('water');
      }]]
    };
    return {
      dur: .48, mm: .1, anim: 'Strike', ev: [[.18, () => {
        const sc = p.scene, s = sizeMul(p), r = 52 * s;
        sc.combat.hitCircle(p.x, p.y, r, 1.75, 'water', { kbx: 380, kby: -260, hs: 90 });
        sc.fx.slash(p.x + p.face * r * .3, p.y, r * .9, p.face, 0x4ac0ff, { thick: 10, ms: 200 });
        sc.fx.slash(p.x - p.face * r * .3, p.y, r * .9, -p.face, 0x2a7aff, { thick: 10, flipV: true, ms: 220 });
        sc.fx.ring(p.x, p.y, r, 0x4ac0ff, 300); sc.fx.burst(p.x, p.bottom - 2, [0x4ac0ff, 0xbfe6ff, 0xffffff], 30, 220, { up: 140 });
        sc.fx.shake(.012, 200); Sfx.play('water'); Sfx.play('boom'); p.squash(1.3, .8);
        // 용의춤: 8초짜리 강화를 최대 3중첩(메가 5)
        const now = sc.time.now, max = m ? 5 : 3;
        p.ddStacks = (p.ddStacks || []).filter(t => t > now);
        if (p.ddStacks.length < max && p.addBuff) {
          p.ddStacks.push(now + 8000);
          p.addBuff({ atk: 1.1, speed: 1.06, t: 8, color: DRAGON });
          sc.fx.floatText(p.x, p.b.y - 12, `용의춤 ×${p.ddStacks.length}`, '#b0a0ff', 11);
          sc.fx.embers(p.x, p.y, [DRAGON, 0xff4a4a, 0xffffff], 10, { speed: 60 });
        }
      }]]
    };
  },
  hydro_pump(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p);
    return {
      dur: 1.4, mm: 0, anim: 'Shoot', lockFace: true, tk: 0, ang: 0,
      update(p, a, dt) {
        if (!a.g) { const g = a.g = sc.add.graphics().setDepth(42).setBlendMode(ADD); onLeave(p, a, () => { g.destroy(); sc.combat.freeLight(a.light); }); Sfx.play('beam'); }
        const inp = p.lastInput || {};
        a.ang = Phaser.Math.Clamp(a.ang + ((inp.down ? 1 : 0) - (inp.up ? 1 : 0)) * 1.6 * dt, -.8, .8);   // ↑↓ 로 휘두른다
        const v = view(p), k = Math.max(0, Math.min(1, a.t / .12, (a.dur - a.t) / .15)), w = (m ? 30 : 22) * s * k * (1 + Math.sin(a.t * 50) * .1);
        const mx = p.x + p.face * 10, my = p.y - 3, len = Math.hypot(v.width, v.height);
        const ex = mx + Math.cos(a.ang) * len * p.face, ey = my + Math.sin(a.ang) * len;
        a.g.clear(); drawBeam(a.g, mx, my, ex, ey, w, 0x2a7aff, 0x9ad8ff);
        for (let j = 0; j < 3; j++) { const t = Math.random() * .8; sc.fx.burst(mx + (ex - mx) * t, my + (ey - my) * t, [0x4ac0ff, 0xbfe6ff, 0xffffff], 1, 60, { up: 30, life: .35 }); }
        a.tk -= dt;
        if (a.tk <= 0) {
          a.tk = .1;
          segHit(sc, mx, my, ex, ey, w / 2, e => sc.combat.damageEnemy(e, p.atk * (m ? .34 : .3), 'water', { kb: p.face * 150, kby: -40, hs: 0, hx: e.x, hy: e.y }));
          sc.fx.shake(.005, 90); Sfx.play('water');
        }
        if (!a.light) a.light = sc.combat.takeLight(mx + p.face * 50, my, 130, 0x4ac0ff, 2);
        if (a.light) a.light.setPosition(mx + Math.cos(a.ang) * 50 * p.face, my + Math.sin(a.ang) * 50);
      }
    };
  },
  hyper_beam(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), rech = m ? .65 : 1.3;
    return {
      dur: 1.1 + rech, mm: 0, anim: 'Shoot', lockFace: true, tk: 0,
      update(p, a, dt) {
        if (!a.g) { const g = a.g = sc.add.graphics().setDepth(42).setBlendMode(ADD); onLeave(p, a, () => { g.destroy(); sc.combat.freeLight(a.light); }); }
        const g = a.g, mx = p.x + p.face * 10, my = p.y - 3;
        g.clear();
        // ① 기 모으기
        if (a.t < .55) {
          for (let j = 0; j < 2; j++) gather(sc, mx, my, 44 * s, [0xffb04a, 0xffe0a0, 0xffffff]);
          g.fillStyle(0xffb04a, .5); g.fillCircle(mx, my, (3 + a.t * 18) * s); g.fillStyle(0xffffff, .9); g.fillCircle(mx, my, (1 + a.t * 7) * s);
          if (a.t > .3) sc.fx.shake(.003, 60);
          return;
        }
        // ② 발사: 화면 끝까지
        if (a.t < 1.1) {
          const k = Math.max(0, Math.min(1, (a.t - .55) / .06, (1.1 - a.t) / .15)), w = (m ? 40 : 30) * s * k * (1 + Math.sin(a.t * 60) * .08);
          const v = view(p), len = (p.face > 0 ? v.right - mx : mx - v.x) + 20, rect = { x: p.face > 0 ? mx : mx - len, y: my - w / 2, w: len, h: Math.max(4, w) };
          drawBeam(g, mx, my, mx + p.face * len, my, w, 0xff8a2a, 0xffe0a0);
          if (!a.fired) {
            a.fired = true; a.tk = .1;
            sc.combat.hitRect(rect, m ? 3.3 : 3, 'normal', { kbx: 360, kby: -200, hs: 130 });
            sc.cameras.main.flash(140, 255, 220, 160, true); sc.fx.shake(.022, 480);
            Sfx.play('beam'); Sfx.play('boom'); p.squash(1.3, .8);
          }
          a.tk -= dt;
          if (a.tk <= 0) { a.tk = .1; sc.combat.hitRect(rect, .22, 'normal', { kbx: 200, kby: -40, hs: 0 }); }
          for (let j = 0; j < 3; j++) sc.fx.burst(mx + p.face * Math.random() * len, my + (Math.random() - .5) * w, [0xffb04a, 0xffe0a0, 0xffffff], 1, 80, { up: 20, grav: 0, bounce: false, glow: true, life: .3 });
          if (!a.light) a.light = sc.combat.takeLight(mx + p.face * 60, my, 160, 0xff8a2a, 2.4);
          return;
        }
        // ③ 반동: 움직일 수 없다
        if (!a.rech) {
          a.rech = true; a.anim = 'Idle'; a.noDash = true;
          sc.combat.freeLight(a.light); a.light = null;
          sc.fx.floatText(p.x, p.b.y - 10, '반동으로 움직일 수 없다!', '#ffb070', 10);
        }
        if (Math.random() < .15) sc.fx.burst(p.x, p.b.y, [0x9a98aa, 0xffffff], 1, 20, { up: 20, grav: 60, bounce: false, life: .5 });
      }
    };
  },

  // ===== 롱스톤 → 강철톤 =====
  iron_tail(p, i) {
    const last = i === 2, m = p.mega.active;
    return {
      dur: last ? .52 : .34, mm: last ? 0 : .25, anim: last ? 'Strike' : 'Attack', ev: [[last ? .2 : .12, () => {
        const sc = p.scene, s = sizeMul(p), x = p.x + p.face * 24 * s, gy = groundAt(p, x), w = (last ? 44 : 34) * s, h = (last ? 40 : 32) * s;
        const y = Math.min(gy, p.bottom + 4);
        sc.combat.hitRect({ x: x - w / 2, y: y - h, w, h }, last ? 1.5 : 1.05, 'steel', { kbx: last ? 200 : 140, kby: last ? -300 : -180, hs: last ? 100 : 50 });
        sc.fx.slash(x - p.face * 6 * s, y - h * .6, h * .55, p.face, 0xd0d8f0, { thick: 7, a0: -1.6, a1: .9 });
        sc.fx.burst(x, y - 2, [0xa8b0c8, ...DIRT], last ? 22 : 12, last ? 200 : 130, { up: 120 });
        sc.fx.ring(x, y - 3, w * .7, 0xa8b0c8, 240);
        sc.fx.shake(last ? .014 : .007, last ? 220 : 110); Sfx.play('punch'); p.squash(1.25, .8);
        if (!last) return;
        // 충격파: 양옆으로 땅을 타고 퍼진다
        Sfx.play('boom');
        const set = new Set(), n = m ? 7 : 4;
        for (const dir of [-1, 1]) for (let k = 1; k <= n; k++) sc.time.delayedCall(k * 55, () => {
          const wx = x + dir * k * 20 * s, wy = sc.groundBelow(wx, y - 20);
          if (Math.abs(wy - y) > 40) return;
          sc.combat.hitRect({ x: wx - 10 * s, y: wy - 16 * s, w: 20 * s, h: 16 * s }, .45, 'ground', { set, fromX: x, kbx: 120, kby: -240, hs: 30 });
          sc.fx.burst(wx, wy - 2, DIRT, 6, 100, { up: 130 });
          sc.fx.glow(wx, wy - 4, 10 * s, 0xd8b060, 160, .6);
        });
      }]]
    };
  },
  dig(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), sp = m ? 240 : 190;
    const leave = () => { p.intangible = false; p.sprite.setAlpha(1); };
    return {
      dur: 1.6, ctrl: true, anim: 'Walk', inv: 1.5,
      update(p, a, dt) {
        if (!a.go) { a.go = true; p.intangible = true; onLeave(p, a, leave); Sfx.play('crack'); }
        a.dt = (a.dt || 0) - dt;
        // ① 파고들기
        if (a.t < .2) {
          p.b.setVelocityX(0); p.sprite.setAlpha(1 - a.t / .2); p.squash(1.3, .6);
          if (a.dt <= 0) { a.dt = .04; sc.fx.burst(p.x, p.bottom - 1, DIRT, 5, 110, { up: 120 }); }
          return;
        }
        // ② 땅속 이동: 먼지 자국만 보인다
        if (a.t < 1.35) {
          const inp = p.lastInput || {}, dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
          if (dir && dir !== p.face) { p.face = dir; p.refacing(); }
          p.b.setVelocityX(dir * sp); p.sprite.setAlpha(0);
          if (a.dt <= 0) { a.dt = .05; sc.fx.burst(p.x, p.bottom - 1, DIRT, dir ? 3 : 1, 50, { up: 50, life: .4 }); if (dir) sc.fx.shake(.002, 60); }
          return;
        }
        // ③ 솟구치기
        if (!a.up) {
          a.up = true; leave();
          p.b.setVelocity(0, -320); p.squash(.6, 1.5);
          const w = (m ? 80 : 60) * s, h = 80 * s;
          sc.combat.hitRect({ x: p.x - w / 2, y: p.bottom - h, w, h }, m ? 3.4 : 3, 'ground', { kbx: 120, kby: -420, hs: 110 });
          sc.fx.burst(p.x, p.bottom - 2, [...DIRT, ...ROCK], 40, 240, { up: 260 });
          sc.fx.ring(p.x, p.bottom - 4, w * .6, 0xd8b060, 300);
          sc.fx.shake(.014, 240); Sfx.play('boom'); Sfx.play('crack');
        }
      }
    };
  },
  rock_tomb(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), set = new Set();
    const drop = (x, delay) => sc.time.delayedCall(delay, () => {
      const gy = sc.groundBelow(x, p.y - 60), r = (8 + Math.random() * 3) * s, v = view(p);
      const g = boulder(sc, x, Math.max(v.y - 20, gy - 160), r);
      sc.tweens.add({ targets: g, y: gy - r, rotation: g.rotation + 1.5, duration: 280, ease: 'Quad.easeIn', onComplete: () => {
        sc.combat.hitCircle(x, gy - r, r + 8 * s, m ? 2.8 : 2.4, 'rock', { set, root: m ? 2.4 : 1.6, slow: 3, kbx: 0, kby: 0, hs: 60 });
        sc.fx.burst(x, gy - 2, [...ROCK, ...DIRT], 12, 130, { up: 100 });
        sc.fx.shake(.008, 120); Sfx.play('crack');
        sc.tweens.add({ targets: g, alpha: 0, delay: 900, duration: 300, onComplete: () => g.destroy() });
      } });
    });
    return {
      dur: .45, mm: 0, anim: 'Shoot', ev: [[.12, () => {
        const ts = sc.combat.nearest(p.x, p.y, m ? 6 : 4, 220 * s);
        if (!ts.length) ts.push({ x: p.x + p.face * 50 * s }, { x: p.x + p.face * 90 * s });
        ts.forEach((t, k) => { for (const o of [-1, 0, 1]) drop(t.x + o * 16 * s, k * 90 + (o + 1) * 50); });   // 적 주위로 세 덩이
        p.squash(1.2, .85); Sfx.play('boom');
      }]]
    };
  },

  // ===== 스라크 → 핫삼 =====
  bullet_punch(p, i) {
    const m = p.mega.active, last = i === 2, n = m ? 3 : 2;
    const jab = k => () => {
      p.b.setVelocityX(p.face * 90);
      slashHit(p, { fwd: 14, w: 24, h: 16, oy: k % 2 ? 1 : -4, mul: last ? .9 : .55, type: 'steel', crit: last && k === n - 1 ? .2 : 0, kbx: last && k === n - 1 ? 240 : 60, kby: -60, color: STEEL_RED, arc: 10, thick: 4, flipV: k % 2 === 1 });
      p.scene.fx.glow(p.x + p.face * 16 * sizeMul(p), p.y - 2, 8 * sizeMul(p), STEEL_RED, 100, .9);
      if (last && k === n - 1) Sfx.play('punch');
    };
    return { dur: m ? .24 : .2, mm: .5, anim: 'Attack', ev: Array.from({ length: n }, (_, k) => [.03 + k * .065, jab(k)]) };
  },
  x_scissor(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), set0 = new Set();
    return {
      dur: .42, ctrl: true, noGrav: true, anim: 'Attack', inv: .42, lockFace: true, tk: 0,
      update(p, a, dt) {
        p.b.setVelocity(p.face * (m ? 360 : 300), 0);
        a.tk -= dt; a.gt = (a.gt || 0) - dt;
        if (a.gt <= 0) { a.gt = .03; sc.fx.ghost(p.sprite, STEEL_RED, .5, 200); }
        if (a.tk > 0) return;
        a.tk = m ? .055 : .07;
        const cx = p.x + p.face * 14 * s, r = 14 * s;
        sc.combat.hitRect({ x: cx - r, y: p.y - r, w: r * 2, h: r * 2 }, m ? .5 : .55, 'bug', { crit: .1, kbx: 60, kby: -40, hs: 25 });
        sc.combat.hitRect({ x: p.b.x - 4, y: p.b.y - 4, w: p.b.width + 8, h: p.b.height + 8 }, .3, 'bug', { set: set0, kbx: 60, kby: -40, hs: 0 });   // 몸으로 지나친 적
        xFx(sc, cx, p.y - 2, r, (a.n = (a.n || 0) + 1) % 2 ? STEEL_RED : 0xffd0d0);
        Sfx.play('swing');
      },
      end(p) { p.b.setVelocity(p.b.velocity.x * .3, 0); p.jumpsUsed = Math.min(p.jumpsUsed, 1); }
    };
  },
  u_turn(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), e = sc.combat.nearest(p.x, p.y, 1, 170 * s)[0];
    const quick = () => dashAction(p, { dur: .13, vx: 640, mul: 1.2, type: 'bug', color: 0xd0ff6a, end(p) { p.jumpsUsed = Math.min(p.jumpsUsed, 1); } });
    if (!e) return quick();
    // 적 등 뒤 위치 (벽이 막으면 전광석화로)
    const dir = Math.sign(e.x - p.x) || p.face, x0 = p.x, y0 = p.y;
    const tx = e.x + dir * (e.b.width / 2 + p.b.width / 2 + 6), ty = e.bottom - p.b.height / 2 - 1;
    for (let x = x0; Math.abs(x - tx) > 4; x += dir * 4) if (sc.isSolidAt(x, y0)) return quick();
    if (sc.isSolidAt(tx, ty) || sc.isSolidAt(tx, ty - p.b.height / 2 + 2) || sc.isSolidAt(tx + dir * p.b.width / 2, ty)) return quick();
    const set = new Set([e]);
    p.face = dir; p.refacing();
    return {
      dur: .5, ctrl: true, anim: 'Attack', inv: .45, lockFace: true,
      update(p, a) {
        // ① 꿰뚫고 지나간다
        if (a.t < .12) {
          const k = a.t / .12;
          p.b.reset(x0 + (tx - x0) * k, y0 + (ty - y0) * k);
          sc.fx.ghost(p.sprite, 0xd0ff6a, .6, 220);
          sc.combat.hitRect({ x: p.b.x - 4, y: p.b.y - 4, w: p.b.width + 8, h: p.b.height + 8 }, .8, 'bug', { set, kbx: 80, kby: -60, hs: 20 });
          return;
        }
        // ② 등 뒤에서 일격 → ③ 뒤로 빠진다
        if (!a.hit) {
          a.hit = true; p.b.reset(tx, ty);
          p.face = -dir; p.refacing();
          if (e.alive) {
            sc.combat.damageEnemy(e, p.atk * (m ? 3 : 2.4), 'bug', { crit: .3, kb: -dir * 240, kby: -180, hs: 120, hx: e.x, hy: e.y });
            sc.fx.slash(e.x, e.y, 16 * s, -dir, 0xd0ff6a, { thick: 7, ms: 180 });
            xFx(sc, e.x, e.y, 10 * s, 0xffffff);
          }
          sc.fx.shake(.01, 160); Sfx.play('punch');
          p.b.setVelocity(dir * 220, -250); p.squash(.75, 1.3);
        }
      },
      end(p) { p.jumpsUsed = Math.min(p.jumpsUsed, 1); }
    };
  }
};
