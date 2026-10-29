// 전설 플레이어블 스킬 2: 라티아스 · 라티오스 · 한카리아스 · 디아루가 · 펄기아 · 기라티나 · 다크라이
// p.mega.active = 한카리아스는 메가진화, 나머지는 '각성'. 보스 기술답게 연출은 크게, 배율은 일반 범위로
import Phaser from 'phaser';
import { typeColor } from '../../data/types.js';
import { Sfx } from '../../systems/Audio.js';
import { sizeMul, slashHit, shoot, lineFx, dashAction, view, groundAt } from '../skillKit.js';

const ADD = Phaser.BlendModes.ADD;

// ---------------- 공용 도구 ----------------
// 방향키 8방향 (입력 없으면 null)
function dir8(p) {
  const inp = p.lastInput || {};
  const dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  if (!dx && !dy) return null;
  const l = Math.hypot(dx, dy); return { x: dx / l, y: dy / l };
}
const inView = (v, e) => e.x > v.x - 10 && e.x < v.right + 10 && e.y > v.y - 20 && e.y < v.bottom + 20;

// 화면 전체 색 덮개 (카메라를 따라다니다 ms 뒤 서서히 사라짐)
function screenTint(sc, color, alpha, ms, fade = 300) {
  const v0 = sc.cameras.main.worldView, r = sc.add.rectangle(0, 0, v0.width + 80, v0.height + 80, color, alpha).setOrigin(0).setDepth(39);
  const fit = () => { if (!r.scene) { sc.events.off('update', fit); return; } const v = sc.cameras.main.worldView; r.setPosition(v.x - 40, v.y - 40); };
  fit(); sc.events.on('update', fit);
  sc.time.delayedCall(ms, () => { if (r.scene) sc.tweens.add({ targets: r, alpha: 0, duration: fade, onComplete: () => { sc.events.off('update', fit); r.destroy(); } }); });
  return r;
}

// 시계 문양 (디아루가)
function clockFx(sc, x, y, r, color, ms) {
  const g = sc.add.graphics().setDepth(44).setBlendMode(ADD);
  g.lineStyle(2, color, 1); g.strokeCircle(x, y, r); g.strokeCircle(x, y, r * .82);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, r0 = k % 3 ? r * .86 : r * .72; g.lineBetween(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r * .97, y + Math.sin(a) * r * .97); }
  g.lineStyle(3, 0xffffff, 1); g.lineBetween(x, y, x, y - r * .62); g.lineBetween(x, y, x + r * .42, y + r * .1);
  sc.tweens.add({ targets: g, alpha: 0, duration: ms, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
}

// 행동이 대시로 끊겨 end 가 불리지 않아도 무형 상태가 남지 않게 (알파는 Player 가 무형이 아니면 1로 되돌린다)
function guardVanish(p, act, ms) {
  const ev = p.scene.time.addEvent({ delay: 50, repeat: Math.ceil(ms / 50), callback: () => { if (p.action !== act) { p.intangible = false; ev.remove(); } } });
}

// 상태이상 보정 무시 (방어 자세 관통)
function pierceGuard(sc, fn) {
  const saved = [];
  for (const e of sc.enemies) if (e.guardMul && e.guardMul < 1) { saved.push([e, e.guardMul]); e.guardMul = 1; }
  fn();
  for (const [e, g] of saved) e.guardMul = g;
}

// 용의 형상: 투사체 q 를 머리로 삼아 몸통이 꿈틀대며 따라간다
function dragonBody(sc, q, s, col = 0x6a4aff, hi = 0xa88aff) {
  const g = sc.add.graphics().setDepth(32).setBlendMode(ADD), hist = [];
  let t = 0;
  const ev = sc.time.addEvent({
    delay: 16, loop: true, callback: () => {
      t += .016;
      if (!g.scene) { ev.remove(); return; }
      if (sc.combat.projs.includes(q)) hist.unshift({ x: q.x, y: q.y, dir: Math.sign(q.vx) || 1 }); else hist.pop();
      if (hist.length > 30) hist.pop();
      g.clear();
      if (!hist.length) { ev.remove(); g.destroy(); return; }
      for (let k = hist.length - 1; k > 0; k -= 2) {
        const h = hist[k], u = k / 30, w = Math.sin(t * 14 - k * .45) * 7 * s * (1 - u * .3), r = Math.max(1, (8 - u * 6) * s);
        g.fillStyle(k % 4 === 1 ? hi : col, .7 * (1 - u * .6)); g.fillCircle(h.x, h.y + w, r);
        if (k % 6 === 1) { g.lineStyle(1, 0xffffff, .6 * (1 - u)); g.lineBetween(h.x, h.y + w - r, h.x - h.dir * r, h.y + w - r * 1.8); }   // 등지느러미
      }
      const h = hist[0], d = h.dir;
      g.fillStyle(hi, .9); g.fillCircle(h.x, h.y, 7 * s);
      g.fillStyle(0xffffff, 1); g.fillTriangle(h.x + d * 14 * s, h.y + 1, h.x + d * 2 * s, h.y - 5 * s, h.x + d * 2 * s, h.y + 5 * s);   // 주둥이
      g.lineStyle(2, hi, 1); g.lineBetween(h.x, h.y - 4 * s, h.x - d * 12 * s, h.y - 13 * s); g.lineBetween(h.x - d * 3 * s, h.y - 2 * s, h.x - d * 15 * s, h.y - 6 * s);   // 뿔
      g.fillStyle(0xff3a6a, 1); g.fillRect(Math.round(h.x + d * 3 * s), Math.round(h.y - 3 * s), 2, 2);   // 눈
    }
  });
}

// 잠재우기 (다크홀): 기절 + 둥실 떠오름 + Zzz
function putToSleep(sc, e, t) {
  const st = e.status, dur = e.boss ? Math.min(.9, t * .3) : t;
  if (st.stun <= 0) sc.fx.floatText(e.x, e.top - 10, '잠들었다!', '#b89aff', 10);
  st.stun = Math.max(st.stun, dur);
  if (e.boss || e.flying) return;
  const ev = sc.time.addEvent({
    delay: 33, repeat: Math.ceil(dur / .033), callback: () => {
      if (!e.alive || e.status.stun <= 0) { ev.remove(); return; }
      e.b.setVelocityY(-18);
      if (Math.random() < .04) sc.fx.floatText(e.x + 6, e.top - 4, 'z', '#c8b0ff', 8);
    }
  });
}

export const SKILL_IMPL = {
  // ===== 라티아스 =====
  mist_ball(p, i) {
    const m = p.mega.active;
    if (i < 2) return { dur: .22, mm: .45, anim: 'Shoot', ev: [[.06, () => { shoot(p, { speed: 230, r: 5, mul: 1, type: 'psychic', life: .75, homing: .3, color: 0xffb0e0, count: m ? 2 : 1, spread: .2, oy: i ? -6 : -2 }); Sfx.play('wave'); }]] };
    return {
      dur: .32, mm: .3, anim: 'Shoot', ev: [[.1, () => {
        const sc = p.scene;
        shoot(p, {
          speed: 170, r: 8, mul: 0, type: 'psychic', life: 1, color: 0xffc8f0, light: true, status: { curse: 5 }, boom: { r: m ? 54 : 40, mul: m ? 2 : 1.7, kb: 200 },
          onExpire: m ? q => sc.combat.spawnZone({ x: q.x - 40, y: q.y - 22, w: 80, h: 44, life: 2.5, tick: .4, draw: 'cloud', type: 'psychic', color: 0xffc8f0, onTick: z => sc.combat.hitRect(z, .2, 'psychic', { slow: 1.5, kbx: 0, kby: 0, hs: 0 }) }) : undefined
        });
        sc.fx.glow(p.x + p.face * 12, p.y - 3, 18, 0xffb0e0, 200, .9);
        Sfx.play('wave'); Sfx.play('water');
      }]]
    };
  },
  heal_pulse(p) {
    const m = p.mega.active;
    return {
      dur: .5, mm: .2, anim: 'Shoot', inv: .5, ev: [[.15, () => {
        const sc = p.scene, s = sizeMul(p), r = 92 * s, pct = m ? .28 : .2;
        for (const mb of p.members) if (mb.alive) { if (mb === p.m) p.heal(mb.maxhp * pct); else mb.hp = Math.min(mb.maxhp, mb.hp + mb.maxhp * pct); }
        if (m) p.addBuff?.({ guard: .75, t: 4, color: 0xffb0e0 });
        sc.combat.hitCircle(p.x, p.y, r, m ? 1.2 : .8, 'psychic', { kbx: 420, kby: -220, hs: 40 });
        sc.combat.clearEnemyProjectiles({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 });
        for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 80, () => sc.fx.ring(p.x, p.y, r * (.4 + k * .2), k % 2 ? 0xffffff : 0xff9ad0, 360));
        sc.fx.glow(p.x, p.y, r * .8, 0xff9ad0, 420, .9);
        sc.fx.burst(p.x, p.y, [0xff9ad0, 0xffe0f0, 0x7dff9a, 0xffffff], 40, 160 * s, { grav: -30, bounce: false, glow: true, life: .9 });
        sc.fx.floatText(p.x, p.b.y - 18, '파티 회복!', '#7dff9a', 12);
        sc.cameras.main.flash(160, 255, 200, 230, true);
        Sfx.play('heal'); Sfx.play('wave');
      }]]
    };
  },
  glide_dash(p) {
    const m = p.mega.active, sp = m ? 480 : 400, d0 = dir8(p) || { x: p.face, y: 0 }, set = new Set(), dur = m ? 1.1 : .85;
    let vx = d0.x * sp, vy = d0.y * sp;
    Sfx.play('dash');
    return {
      dur, ctrl: true, noGrav: true, anim: 'Walk', inv: dur + .1, guard: m ? 'reflect' : 'spin', lockFace: true, rt: .25,
      update(p, a, dt) {
        const d = dir8(p);
        if (d) { const k = Math.min(1, dt * 7); vx += (d.x * sp - vx) * k; vy += (d.y * sp - vy) * k; const l = Math.hypot(vx, vy) || 1; vx = vx / l * sp; vy = vy / l * sp; }   // 방향키로 선회
        if (Math.abs(vx) > 30 && Math.sign(vx) !== p.face) { p.face = Math.sign(vx); p.refacing(); }
        p.b.setVelocity(vx, vy);
        a.rt -= dt; if (a.rt <= 0) { a.rt = .25; set.clear(); }   // 0.25초마다 다시 타격
        const s = sizeMul(p);
        p.scene.combat.hitRect({ x: p.b.x - 8 * s, y: p.b.y - 8 * s, w: p.b.width + 16 * s, h: p.b.height + 16 * s }, m ? 1 : .85, 'dragon', { set, kbx: 200, kby: -140, fromX: p.x - vx * .1, hs: 30 });
        a.gt = (a.gt || 0) - dt;
        if (a.gt <= 0) { a.gt = .025; p.scene.fx.ghost(p.sprite, Math.random() < .5 ? 0xff6a8a : 0xffffff, .55, 260); }
        p.scene.fx.embers(p.x - vx * .03, p.y - vy * .03, [0xff6a8a, 0xffe0f0], 1, { speed: 20, life: .4 });
      },
      end(p) {
        p.b.setVelocity(vx * .3, vy * .3); p.jumpsUsed = Math.min(p.jumpsUsed, 1);
        p.scene.fx.ring(p.x, p.y, 26, 0xff9ad0, 240);
      }
    };
  },

  // ===== 라티오스 =====
  luster_purge(p, i) {
    const m = p.mega.active;
    if (i < 2) return { dur: .22, mm: .45, anim: 'Shoot', ev: [[.06, () => { shoot(p, { speed: 300, r: 4, mul: 1.05, type: 'psychic', life: .6, color: 0xbfe0ff, count: m ? 2 : 1, spread: .14, oy: i ? -6 : -2 }); Sfx.play('zap'); }]] };
    const burst = (dx, r, mul) => {
      const sc = p.scene, x = p.x + p.face * dx, y = p.y - 2;
      sc.combat.hitCircle(x, y, r, mul, 'psychic', { curse: 3, kbx: 260, kby: -160, hs: 80 });
      sc.fx.glow(x, y, r * 1.2, 0x8ac0ff, 300, 1); sc.fx.ring(x, y, r, 0xffffff, 260); sc.time.delayedCall(60, () => sc.fx.ring(x, y, r * .7, 0x5a8aff, 240));
      sc.fx.burst(x, y, [0x8ac0ff, 0xffffff, 0x5a8aff], 22, r * 4, { glow: true, grav: 0, bounce: false });
      sc.fx.shake(.008, 140); Sfx.play('boom');
    };
    return {
      dur: .34, mm: .25, anim: 'Strike', ev: [
        [.04, () => { p.scene.fx.glow(p.x + p.face * 10, p.y - 2, 16, 0xffffff, 120, 1); Sfx.play('zap'); }],
        [.1, () => { const s = sizeMul(p); burst(30 * s, 34 * s, 1.8); }],
        ...(m ? [[.22, () => { const s = sizeMul(p); burst(74 * s, 30 * s, .7); }]] : [])
      ]
    };
  },
  dragon_pulse(p) {
    const m = p.mega.active, sc = p.scene;
    const fire = (mul, oy, col, hi) => {
      const n0 = sc.combat.projs.length, s = sizeMul(p);
      shoot(p, { speed: 300, r: 9, mul, type: 'dragon', life: 1.15, pierce: 99, ghost: true, kb: 240, color: col, light: true, oy, status: { hs: 60 } });
      for (const q of sc.combat.projs.slice(n0)) dragonBody(sc, q, s, col, hi);
      sc.fx.glow(p.x + p.face * 14, p.y + oy, 30 * s, hi, 260, 1); sc.fx.ring(p.x + p.face * 14, p.y + oy, 26 * s, 0xffffff, 220);
      sc.fx.shake(.01, 160); Sfx.play('beam'); Sfx.play('boss');
    };
    return {
      dur: m ? .75 : .55, mm: .1, anim: 'Shoot', lockFace: true,
      update(p, a) { if (a.t < .15 && Math.random() < .8) p.scene.fx.burst(p.x + p.face * 14 + (Math.random() - .5) * 30, p.y + (Math.random() - .5) * 24, [0x6a4aff, 0xa88aff], 1, 10, { grav: 0, bounce: false, glow: true, life: .25 }); },
      ev: [[.15, () => fire(m ? 2.3 : 2.6, -3, 0x6a4aff, 0xa88aff)], ...(m ? [[.4, () => fire(2.3, -10, 0x4a7aff, 0x9ad0ff)]] : [])]
    };
  },
  aerial_dive(p) {
    const m = p.mega.active, sc = p.scene, set = new Set();
    let dx = p.face * .5, dy = .866, landed = false;
    const impact = () => {
      const s = sizeMul(p), r = 58 * s * (m ? 1.35 : 1), x = p.x, y = p.bottom - 8;
      sc.combat.hitCircle(x, y, r, m ? 3.4 : 3, 'dragon', { kbx: 260, kby: -320, hs: 120 });
      for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 60, () => sc.fx.ring(x, y, r * (.5 + k * .25), k % 2 ? 0xffffff : 0x5a8aff, 380));
      sc.fx.glow(x, y, r * 1.2, 0x5a8aff, 420, 1);
      sc.fx.burst(x, p.bottom - 2, [0x5a8aff, 0xbfe0ff, 0xffffff, 0xc8c0e0], 50, 260 * s, { up: 180, glow: true });
      sc.cameras.main.flash(140, 180, 210, 255, true); sc.fx.shake(.02, 300);
      if (m) for (const d of [-1, 1]) sc.combat.spawnProjectile({ owner: 'player', x: x + d * 10, y: p.bottom - 6, vx: d * 320, vy: 0, r: 6 * s, mul: 1, type: 'dragon', kind: 'wave', life: .5, pierce: 99, color: 0x9ad0ff, kb: 200 });
      Sfx.play('boom'); Sfx.play('punch'); p.squash(1.4, .7);
    };
    return {
      dur: 1.3, ctrl: true, noGrav: true, anim: 'Walk', inv: 1.35, lockFace: true,
      update(p, a, dt) {
        a.gt = (a.gt || 0) - dt;
        if (a.t < .32) { p.b.setVelocity(-p.face * 40, -360 * (1 - a.t / .32) - 60); if (a.gt <= 0) { a.gt = .04; sc.fx.ghost(p.sprite, 0xbfe0ff, .45, 200); } return; }
        if (a.t < .44) {   // 정점에서 멈춰 겨눈다
          p.b.setVelocity(0, 0);
          if (!a.aim) {
            a.aim = true;
            const t = sc.combat.nearest(p.x, p.y + 80, 4, 280).find(e => e.y > p.y - 10);
            if (t) { const l = Math.hypot(t.x - p.x, t.y - p.y) || 1; dx = (t.x - p.x) / l; dy = (t.y - p.y) / l; if (dy < .6) { dy = .6; dx = Math.sign(dx || p.face) * .8; } }
            if (Math.abs(dx) > .05 && Math.sign(dx) !== p.face) { p.face = Math.sign(dx); p.refacing(); }
            sc.fx.glow(p.x, p.y, 26, 0x5a8aff, 200, 1); sc.fx.ring(p.x, p.y, 22, 0xffffff, 200); Sfx.play('dash');
          }
          return;
        }
        if (landed) { p.b.setVelocity(0, 0); return; }
        a.anim = 'Attack';
        p.b.setVelocity(dx * 640, dy * 640);
        const s = sizeMul(p);
        sc.combat.hitRect({ x: p.b.x - 6 * s, y: p.b.y - 6 * s, w: p.b.width + 12 * s, h: p.b.height + 12 * s }, 1, 'dragon', { set, kbx: 180, kby: 120, hs: 30 });
        if (a.gt <= 0) { a.gt = .02; sc.fx.ghost(p.sprite, Math.random() < .5 ? 0x5a8aff : 0xffffff, .6, 240); }
        sc.fx.embers(p.x, p.y, [0x5a8aff, 0xffffff], 2, { speed: 40, life: .35 });
        if (p.b.blocked.down || p.onGround || a.t > 1.1) { landed = true; impact(); a.dur = a.t + .18; p.b.setVelocity(0, 0); }
      },
      end(p) { p.b.setVelocity(p.b.velocity.x * .2, 0); }
    };
  },

  // ===== 한카리아스 =====
  dual_chop(p, i) {
    const m = p.mega.active, last = i === 2;
    const chop = (mul, flipV, big) => slashHit(p, { fwd: 14, w: big ? 36 : 26, h: big ? 30 : 22, mul, type: 'dragon', crit: big ? .25 : 0, kbx: big ? 260 : 110, color: 0x9a7aff, flipV, arc: big ? 18 : 13, thick: big ? 7 : 5 });
    if (!last) return { dur: .3, mm: .35, anim: 'Attack', ev: [[.05, () => chop(.6, i === 1, false)], [.14, () => chop(.6, i !== 1, false)]] };
    return {
      dur: .38, mm: .25, anim: 'Strike', ev: [
        [.06, () => chop(.8, false, false)],
        [.16, () => {
          chop(1, true, true);
          p.scene.fx.burst(p.x + p.face * 20, p.bottom - 2, [0xd8b060, 0xf0e0b0], 10, 90, { up: 80 });
          if (m) { shoot(p, { speed: 300, r: 6, mul: .8, type: 'ground', kind: 'wave', life: .35, pierce: 99, color: 0xd8b060, oy: 4, kb: 200 }); p.scene.fx.shake(.008, 120); }
          Sfx.play('punch');
        }]
      ]
    };
  },
  dragon_rush(p) {
    const m = p.mega.active, sc = p.scene;
    const tgt = sc.combat.nearest(p.x, p.y, 1, 240)[0];
    const tx = tgt ? tgt.x : p.x + p.face * 110, ty = tgt ? tgt.bottom : groundAt(p, tx);
    if (tgt && Math.sign(tgt.x - p.x) && Math.sign(tgt.x - p.x) !== p.face) { p.face = Math.sign(tgt.x - p.x); p.refacing(); }
    const x0 = p.x, y0 = p.bottom, T = .42, H = 70 + Math.abs(tx - x0) * .15;
    let hit = false;
    const impact = () => {
      const s = sizeMul(p), r = 60 * s * (m ? 1.35 : 1), x = p.x, y = p.bottom - 10;
      sc.combat.hitCircle(x, y, r, m ? 4.2 : 3.6, 'dragon', { stun: .8, kbx: 300, kby: -300, hs: 130 });
      // 용의 형상 오라: 솟구치는 기둥 + 퍼지는 고리
      for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * .28; lineFx(sc, x, y, x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6, k % 2 ? 0xa88aff : 0x6a4aff, { seg: 6, jag: 10, w: 3, ms: 360 }); }
      for (let k = 0; k < 5; k++) sc.time.delayedCall(k * 55, () => sc.fx.ring(x, y, r * (.4 + k * .22), [0x6a4aff, 0xffffff, 0xa88aff, 0xd8b060, 0x6a4aff][k], 420));
      sc.fx.glow(x, y, r * 1.3, 0x6a4aff, 500, 1);
      sc.fx.burst(x, p.bottom - 2, [0x6a4aff, 0xa88aff, 0xd8b060, 0xffffff], 70, 300 * s, { up: 200, glow: true, life: .9 });
      sc.fx.burst(x, p.bottom - 2, [0xd8b060, 0xa08050], 30, 200 * s, { up: 140 });
      sc.cameras.main.flash(160, 200, 170, 255, true); sc.fx.shake(.024, 380);
      Sfx.play('boom'); Sfx.play('punch'); p.squash(1.45, .65);
    };
    Sfx.play('jump');
    return {
      dur: 1, ctrl: true, noGrav: true, anim: 'Strike', inv: 1, lockFace: true,
      update(p, a, dt) {
        if (hit) { p.b.setVelocity(0, 0); return; }
        const u = Math.min(1, a.t / T);
        p.b.setVelocity((tx - x0) / T, ((ty - y0) - H * 4 * (1 - 2 * u)) / T);   // 포물선 도약
        a.gt = (a.gt || 0) - dt;
        if (a.gt <= 0) { a.gt = .025; sc.fx.ghost(p.sprite, Math.random() < .5 ? 0x6a4aff : 0xa88aff, .55, 260); }
        if ((u > .55 && p.onGround) || u >= 1) { hit = true; p.b.setVelocity(0, 0); impact(); a.dur = a.t + .3; }
      },
      end(p) { p.b.setVelocity(0, 0); }
    };
  },
  sand_tomb(p) {
    const m = p.mega.active;
    return {
      dur: .42, mm: .2, anim: 'Shoot', ev: [[.15, () => {
        const sc = p.scene, s = sizeMul(p), tgt = sc.combat.nearest(p.x, p.y, 1, 220)[0];
        const cx = tgt ? tgt.x : p.x + p.face * 70, gy = sc.groundBelow(cx, (tgt ? tgt.y : p.y) - 30), w = (m ? 130 : 92) * s, h = (m ? 64 : 50) * s;
        sc.combat.spawnZone({
          x: cx - w / 2, y: gy - h, w, h, life: 4, tick: .25, draw: 'cloud', type: 'ground', color: 0xd8b060,
          onTick: z => {
            for (const e of sc.combat.enemiesIn(z)) {
              sc.combat.damageEnemy(e, p.atk * .28, 'ground', { root: .5, dot: 'sand' });
              if (e.alive && !e.boss) e.b.setVelocityX((cx - e.x) * 3);   // 가운데로 빨아들임
            }
          },
          onUpdate: z => {
            const g = sc.combat.zg, now = sc.time.now / 1000, k = Math.min(1, z.t * 5, (z.life - z.t) * 3);
            for (let j = 0; j < 7; j++) {   // 소용돌이
              const u = j / 6, y = gy - u * h * .9, rx = (w / 2) * (.25 + u * .75), a0 = now * 9 + j * 1.1;
              g.lineStyle(2, j % 2 ? 0xd8b060 : 0xf0e0b0, .7 * k); g.beginPath(); g.arc(cx, y, rx, a0, a0 + 2.2); g.strokePath();
            }
            if (Math.random() < .6) sc.fx.burst(cx + (Math.random() - .5) * w, gy - 2, [0xd8b060, 0xa08050], 1, 30, { up: 60, life: .4 });
          },
          onEnd: m ? () => {   // 끝에 모래 분출
            sc.combat.hitRect({ x: cx - w / 2, y: gy - h * 1.6, w, h: h * 1.6 }, 1.5, 'ground', { kbx: 80, kby: -360, hs: 90 });
            sc.fx.burst(cx, gy - 4, [0xd8b060, 0xf0e0b0, 0xa08050], 50, 260, { up: 260 });
            sc.fx.ring(cx, gy - h / 2, w * .6, 0xd8b060, 320); sc.fx.shake(.014, 220); Sfx.play('boom');
          } : undefined
        });
        sc.fx.burst(cx, gy - 2, [0xd8b060, 0xf0e0b0], 30, 160, { up: 140 });
        sc.fx.ring(cx, gy - h / 2, w * .5, 0xd8b060, 300);
        Sfx.play('chain'); Sfx.play('fire');
      }]]
    };
  },

  // ===== 디아루가 =====
  metal_claw(p, i) {
    const m = p.mega.active;
    const spark = () => p.scene.fx.burst(p.x + p.face * 18, p.y - 2, [0xffffff, 0xd8e0f0, 0x8ac0ff], 6, 120, { glow: true });
    if (i < 2) return { dur: .24, mm: .35, anim: 'Attack', ev: [[.07, () => { slashHit(p, { fwd: 14, w: 26, h: 22, mul: 1.05, type: 'steel', color: 0xd8e0f0, flipV: i === 1, thick: 5 }); spark(); }]] };
    const fin = (mul, flipV) => {
      slashHit(p, { fwd: 16, w: 32, h: 28, mul, type: 'steel', crit: .25, kbx: 260, color: 0xe8f0ff, flipV, arc: 17, thick: 7 });
      for (const oy of [-7, 7]) p.scene.fx.slash(p.x + p.face * 10, p.y - 2 + oy, 15 * sizeMul(p), p.face, 0x8ac0ff, { flipV });   // 세 줄 발톱 자국
      spark(); Sfx.play('crack'); Sfx.play('punch');
    };
    return { dur: m ? .42 : .32, mm: .25, anim: 'Strike', ev: [[.1, () => fin(1.75, false)], ...(m ? [[.24, () => fin(.6, true)]] : [])] };
  },
  roar_of_time(p) {
    const m = p.mega.active, sc = p.scene, g = sc.add.graphics().setDepth(33).setBlendMode(ADD);
    sc.time.delayedCall(2000, () => g.destroy());
    const geo = () => { const s = sizeMul(p), len = 290 * s, hh = (m ? 54 : 38) * s, x0 = p.x + p.face * 10, y = p.y - 2; return { len, hh, x0, y, rect: { x: p.face > 0 ? x0 : x0 - len, y: y - hh / 2, w: len, h: hh } }; };
    Sfx.play('boss');
    return {
      dur: 1.25, mm: 0, anim: 'Shoot', lockFace: true,
      update(p, a, dt) {
        if (!g.scene) return;
        g.clear();
        const { len, hh, x0, y } = geo(), f = p.face;
        if (a.t < .2) {   // 기 모으기: 입가로 빛이 모인다
          const k = a.t / .2;
          g.fillStyle(0x4a7aff, .5 * k); g.fillCircle(x0, y, 6 + 10 * k);
          g.fillStyle(0xffffff, .9 * k); g.fillCircle(x0, y, 2 + 4 * k);
          if (Math.random() < .9) { const ang = Math.random() * Math.PI * 2, r = 30 + Math.random() * 20; lineFx(sc, x0 + Math.cos(ang) * r, y + Math.sin(ang) * r, x0, y, 0x8ac0ff, { seg: 3, jag: 3, w: 1, ms: 90 }); }
        } else if (a.t < .7) {   // 광선
          const k = 1 - Math.max(0, (a.t - .45) / .25), wob = Math.sin(a.t * 70) * 2.5, bx = f > 0 ? x0 : x0 - len;
          g.fillStyle(0x2a3aff, .35 * k); g.fillRect(bx, y - hh / 2 - wob, len, hh + wob * 2);
          g.fillStyle(0x5a9aff, .7 * k); g.fillRect(bx, y - hh * .3, len, hh * .6);
          g.fillStyle(0xe8f4ff, .95 * k); g.fillRect(bx, y - hh * .1, len, hh * .2);
          for (let j = 0; j < 6; j++) { const xx = x0 + f * ((a.t * 900 + j * len / 6) % len); g.lineStyle(2, 0xbfe6ff, .8 * k); g.strokeEllipse(xx, y, 8, hh * (1.1 + .2 * Math.sin(a.t * 40 + j))); }   // 시간 왜곡 물결
          g.fillStyle(0xffffff, k); g.fillCircle(x0, y, hh * .45);
          a.rt = (a.rt || 0) - dt;
          if (a.rt <= 0) { a.rt = .06; sc.fx.ring(x0 + f * len * Math.random(), y, hh * .6, 0x9ad0ff, 300); sc.fx.burst(x0 + f * len * Math.random(), y + (Math.random() - .5) * hh, [0x8ac0ff, 0xffffff], 3, 80, { grav: 0, bounce: false, glow: true, life: .35 }); }
          if (!a.light) a.light = sc.combat.takeLight(x0 + f * len / 2, y, 200, 0x5a8aff, 2.4);
          if (a.light) a.light.setPosition(x0 + f * len / 2, y);
        } else {   // 반동: 몸이 굳는다
          if (a.light) { sc.combat.freeLight(a.light); a.light = null; }
          a.tintFill = Math.floor(a.t * 12) % 2 ? 0x6a7aa0 : null;
        }
      },
      ev: [[.2, () => {
        const { hh, x0, y, rect } = geo();
        for (const e of sc.combat.enemiesIn(rect).slice(0, 6)) sc.fx.floatText(e.x, e.top - 16, '시간 왜곡!', '#9ad0ff', 10);
        sc.combat.hitRect(rect, m ? 5 : 4.4, 'dragon', { slow: m ? 9 : 6, kbx: 240, kby: -120, hs: 140 });
        clockFx(sc, x0, y, hh * 1.4, 0x8ac0ff, 600);
        sc.fx.glow(x0, y, hh * 1.6, 0x4a7aff, 400, 1);
        sc.cameras.main.flash(180, 140, 180, 255, true); sc.fx.shake(.024, 450);
        Sfx.play('beam'); Sfx.play('thunder');
      }]],
      end(p, a) { sc.combat.freeLight(a.light); a.light = null; if (g.scene) g.clear(); }
    };
  },
  chrono_stop(p) {
    const m = p.mega.active, sc = p.scene, T = m ? 3.4 : 2.5, TB = m ? 1.1 : .8;
    return {
      dur: .55, mm: 0, anim: 'Shoot', inv: .6, ev: [
        [0, () => { sc.fx.glow(p.x, p.y, 40, 0x8ac0ff, 300, 1); sc.fx.ring(p.x, p.y, 30, 0xffffff, 300); Sfx.play('recall'); }],
        [.2, () => {
          const v = view(p), s = sizeMul(p);
          screenTint(sc, 0x5a6a8a, .3, T * 1000, 300);
          clockFx(sc, p.x, p.y, 80 * s, 0xa8c0ff, 900);
          for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 80, () => sc.fx.ring(p.x, p.y, (60 + k * 50) * s, k % 2 ? 0xffffff : 0x8ac0ff, 500));
          sc.cameras.main.flash(220, 190, 210, 240, true); sc.fx.hitStop(120); sc.fx.shake(.012, 200);
          Sfx.play('boss'); Sfx.play('shatter');
          const frozen = [];
          for (const e of sc.enemies) {
            if (!e.alive || !inView(v, e)) continue;
            e.status.stun = Math.max(e.status.stun, e.boss ? TB : T);
            sc.fx.floatText(e.x, e.top - 10, '정지!', '#c8d8ff', 10); sc.fx.ring(e.x, e.y, 20, 0xa8c0ff, 300);
            if (!e.boss) { e.b.setVelocity(0, 0); frozen.push({ e, grav: e.b.allowGravity }); e.b.setAllowGravity(false); }
          }
          // 적 탄환도 제자리에 멈춘다
          const qs = [];
          for (const q of sc.combat.projs) if (q.owner === 'enemy' && q.x > v.x && q.x < v.right && q.y > v.y && q.y < v.bottom) { qs.push({ q, vx: q.vx, vy: q.vy, grav: q.grav, homing: q.homing }); q.vx = 0; q.vy = 0; q.grav = 0; q.homing = 0; q.life += T; }
          // 멈춘 동안 맞아도 밀려나지 않게 붙잡아 둔다
          const hold = sc.time.addEvent({ delay: 33, repeat: Math.ceil(T / .033), callback: () => { for (const f of frozen) if (f.e.alive) f.e.b.setVelocity(f.e.b.velocity.x * .4, f.e.b.velocity.y * .4); } });
          sc.time.delayedCall(T * 1000, () => {
            hold.remove();
            for (const o of qs) if (sc.combat.projs.includes(o.q) && o.q.owner === 'enemy') Object.assign(o.q, { vx: o.vx, vy: o.vy, grav: o.grav, homing: o.homing });
            // 시간이 다시 흐를 때 멈춰 있던 충격이 한꺼번에
            for (const f of frozen) if (f.e.alive) { f.e.b.setAllowGravity(f.grav); sc.combat.damageEnemy(f.e, p.atk * (m ? 2 : 1.6), 'steel', { hx: f.e.x, hy: f.e.y, hs: 30 }); sc.fx.ring(f.e.x, f.e.y, 24, 0xa8c0ff, 260); }
            if (frozen.length) { sc.fx.shake(.012, 200); Sfx.play('crack'); }
          });
        }]
      ]
    };
  },

  // ===== 펄기아 =====
  aqua_blade(p, i) {
    const m = p.mega.active;
    const splash = () => p.scene.fx.burst(p.x + p.face * 16, p.y - 2, [0x6ac8ff, 0xbfe6ff, 0xffffff], 8, 110, { up: 60 });
    if (i < 2) return { dur: .24, mm: .35, anim: 'Attack', ev: [[.07, () => { slashHit(p, { fwd: 14, w: 28, h: 22, mul: 1.05, type: 'water', color: 0x6ac8ff, flipV: i === 1, thick: 5 }); splash(); Sfx.play('water'); }]] };
    return {
      dur: .32, mm: .25, anim: 'Strike', ev: [[.1, () => {
        slashHit(p, { fwd: 16, w: 34, h: 28, mul: 1, type: 'water', kbx: 220, color: 0xbfe6ff, arc: 18, thick: 7 });
        shoot(p, { speed: 340, r: 6, mul: .8, type: 'water', kind: 'wave', life: .38, pierce: 99, color: 0x6ac8ff, kb: 200, count: m ? 2 : 1, spread: .22 });
        splash(); Sfx.play('water'); Sfx.play('swing');
      }]]
    };
  },
  spacial_rend(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), hh = (m ? 70 : 48) * s, by = p.y - 2, g = sc.add.graphics().setDepth(43).setBlendMode(ADD), gd = sc.add.graphics().setDepth(42);
    sc.time.delayedCall(1800, () => { g.destroy(); gd.destroy(); });
    const band = () => { const v = view(p); return { x: v.x - 10, y: by - hh / 2, w: v.width + 20, h: hh }; };
    const cut = (mul, st, diag) => {
      const r = band();
      sc.combat.hitRect(r, mul, 'dragon', Object.assign({ kbx: 120, kby: diag ? -200 : -80, hs: 100 }, st));
      if (diag) for (let x = r.x + 20; x < r.x + r.w; x += 70) { lineFx(sc, x - 24, by - hh * .7, x + 24, by + hh * .7, 0xff7ad0, { seg: 3, jag: 2, w: 3, ms: 280 }); lineFx(sc, x + 24, by - hh * .7, x - 24, by + hh * .7, 0xffffff, { seg: 3, jag: 2, w: 2, ms: 280 }); }
      else { lineFx(sc, r.x, by, r.x + r.w, by, 0xff7ad0, { seg: 14, jag: 3, w: 5, ms: 320 }); lineFx(sc, r.x, by, r.x + r.w, by, 0xffffff, { seg: 14, jag: 2, w: 2, ms: 260 }); }
      for (let x = r.x + 20, k = 0; x < r.x + r.w; x += 46, k++) sc.fx.slash(x, by, 16 * s, k % 2 ? 1 : -1, 0xff9ae0, { flipV: diag && k % 2 === 0, thick: 6, ms: 200 });
      sc.cameras.main.flash(140, 255, 150, 220, true); sc.fx.shake(diag ? .024 : .016, 300);
      Sfx.play(diag ? 'shatter' : 'crack'); Sfx.play('boom');
    };
    Sfx.play('recall');
    return {
      dur: .9, mm: 0, anim: 'Strike', lockFace: true, inv: .6,
      update(p, a) {
        if (!g.scene) return;
        g.clear(); gd.clear();
        const r = band(), now = sc.time.now;
        if (a.t < .35) {   // 균열이 몸에서 양옆으로 번진다
          const k = a.t / .35, half = r.w * k, flick = (Math.floor(now / 40) % 2) ? 1 : .6;
          g.fillStyle(0xff7ad0, .8 * flick); g.fillRect(p.x - half, by - 1, half * 2, 2);
          g.fillStyle(0xffffff, flick); g.fillRect(p.x - half, by, half * 2, 1);
        } else {   // 공간이 찢어져 벌어졌다 닫힌다
          const k = Math.sin(Math.min(1, (a.t - .35) / .55) * Math.PI), open = hh * .45 * k;
          gd.fillStyle(0x1a0620, .55 * k); gd.fillRect(r.x, by - open, r.w, open * 2);
          const top = [], bot = [];
          for (let x = r.x; x <= r.x + r.w; x += 10) { const j = Math.sin(x * .13 + now / 90) * 3 * k; top.push({ x, y: by - open + j }); bot.push({ x, y: by + open - j }); }
          g.lineStyle(2, 0xff7ad0, .9 * k); g.strokePoints(top, false); g.strokePoints(bot, false);
          g.lineStyle(1, 0xffffff, k); g.strokePoints(top, false); g.strokePoints(bot, false);
          if (Math.random() < .7) sc.fx.burst(r.x + Math.random() * r.w, by + (Math.random() - .5) * open * 2, [0xff7ad0, 0xc8a0ff, 0xffffff], 1, 20, { grav: 0, bounce: false, glow: true, life: .4 });
        }
      },
      ev: [[.35, () => cut(m ? 2.6 : 2.2, {}, false)], [.62, () => cut(m ? 2.8 : 2.4, { stun: .5 }, true)]],
      end() { if (g.scene) { g.clear(); gd.clear(); } }
    };
  },
  warp_rift(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), d = dir8(p) || { x: p.face, y: 0 };
    const ox = p.x, oy = p.y, w = p.b.width, h = p.b.height;
    const free = (x, y) => !sc.isSolidAt(x, y) && !sc.isSolidAt(x - w / 2 + 1, y) && !sc.isSolidAt(x + w / 2 - 1, y) && !sc.isSolidAt(x, y - h / 2 + 1) && !sc.isSolidAt(x, y + h / 2 - 1);
    let tx = ox, ty = oy;
    for (let k = 4, L = m ? 170 : 130; k <= L; k += 4) { const x = ox + d.x * k, y = oy + d.y * k; if (!free(x, y)) break; tx = x; ty = y; }   // 벽 앞에서 멈춘다
    if (Math.abs(d.x) > .1) p.face = Math.sign(d.x);
    const portal = (x, y) => {
      const pw = 44 * s, ph = 56 * s;
      sc.combat.spawnZone({
        x: x - pw / 2, y: y - ph / 2, w: pw, h: ph, life: m ? 3.5 : 2.5, tick: .3, type: 'dragon', color: 0xff7ad0,
        onTick: z => sc.combat.hitRect(z, .45, 'dragon', { slow: 1, kbx: 40, kby: -60, hs: 0, fromX: x }),
        onUpdate: z => {
          const k = Math.min(1, z.t * 6, (z.life - z.t) * 3), now = sc.time.now / 1000, g = sc.combat.zg, gn = sc.combat.zgn;
          gn.fillStyle(0x1a0620, .7 * k); gn.fillEllipse(x, y, pw * .8 * k, ph * k);
          g.lineStyle(2, 0xff7ad0, .9 * k); g.strokeEllipse(x, y, pw * (.85 + .08 * Math.sin(now * 12)) * k, ph * k);
          g.lineStyle(1, 0xc8a0ff, .8 * k);
          for (let j = 0; j < 3; j++) { const a0 = now * 6 + j * 2.1; g.beginPath(); g.arc(x, y, pw * .3 * k, a0, a0 + 1.4); g.strokePath(); }
          if (Math.random() < .4) sc.fx.embers(x + (Math.random() - .5) * pw * .6, y + (Math.random() - .5) * ph * .6, [0xff7ad0, 0xffffff], 1, { speed: 20, life: .4 });
        }
      });
    };
    const act = {
      dur: .42, ctrl: true, noGrav: true, mm: 0, anim: 'Shoot', inv: .6,
      update(p) { p.b.setVelocity(0, 0); },
      ev: [
        [0, () => { portal(ox, oy); p.intangible = true; sc.fx.glow(ox, oy, 34 * s, 0xff7ad0, 260, 1); sc.fx.ring(ox, oy, 30 * s, 0xffffff, 240); Sfx.play('recall'); }],
        [.1, () => {
          p.sprite.setAlpha(0);
          lineFx(sc, ox, oy, tx, ty, 0xff7ad0, { seg: 8, jag: 3, w: 3, ms: 260 }); lineFx(sc, ox, oy, tx, ty, 0xc8a0ff, { seg: 8, jag: 6, w: 1, ms: 300 });
          p.b.reset(tx, ty); p.refacing();
        }],
        [.18, () => {
          p.intangible = false; p.sprite.setAlpha(1);
          if (m) portal(tx, ty);
          sc.combat.hitCircle(tx, ty, 42 * s, 1.6, 'dragon', { kbx: 220, kby: -180, hs: 80 });
          for (let k = 0; k < 3; k++) sc.time.delayedCall(k * 60, () => sc.fx.ring(tx, ty, (24 + k * 16) * s, k % 2 ? 0xffffff : 0xff7ad0, 300));
          sc.fx.glow(tx, ty, 44 * s, 0xc8a0ff, 300, 1);
          sc.fx.burst(tx, ty, [0xff7ad0, 0xc8a0ff, 0xffffff], 26, 180 * s, { grav: 0, bounce: false, glow: true });
          sc.fx.shake(.01, 160); Sfx.play('boom'); p.squash(1.3, .8);
        }]
      ],
      end(p) { p.intangible = false; p.sprite.setAlpha(1); p.jumpsUsed = Math.min(p.jumpsUsed, 1); }
    };
    guardVanish(p, act, 600);
    return act;
  },

  // ===== 기라티나 =====
  shadow_claw(p, i) {
    const m = p.mega.active;
    if (i < 2) return { dur: .24, mm: .35, anim: 'Attack', ev: [[.07, () => { slashHit(p, { fwd: 14, w: 26, h: 22, mul: 1.05, type: 'ghost', crit: .2, color: 0x9a5aff, flipV: i === 1, thick: 5 }); p.scene.fx.embers(p.x + p.face * 16, p.y, [0x6a2aff, 0x2a0a3a], 4, { speed: 30 }); }]] };
    return {
      dur: .32, mm: .25, anim: 'Strike', ev: [[.1, () => {
        slashHit(p, { fwd: 16, w: 34, h: 30, mul: 1.7, type: 'ghost', crit: .4, kbx: 240, color: 0xc08aff, arc: 17, thick: 7, status: m ? { curse: 4 } : {} });
        for (const oy of [-8, 8]) p.scene.fx.slash(p.x + p.face * 10, p.y - 2 + oy, 15 * sizeMul(p), p.face, 0x6a2aff, { thick: 4 });
        p.scene.fx.glow(p.x + p.face * 18, p.y, 22, 0x6a2aff, 220, .9);
        Sfx.play('ghost'); Sfx.play('punch');
      }]]
    };
  },
  shadow_force(p) {
    const m = p.mega.active, sc = p.scene;
    const act = {
      dur: 1.25, mm: 1.15, anim: 'Walk', inv: 1.3,
      update(p, a) {
        if (a.t >= .9) return;
        p.intangible = true; p.sprite.setAlpha(0);
        if (Math.random() < .6) sc.fx.burst(p.x + (Math.random() - .5) * 16, p.bottom - 2, [0x2a0a3a, 0x6a2aff, 0x9a5aff], 1, 20, { up: 10, grav: -30, bounce: false, glow: true, life: .45 });   // 그림자 웅덩이만 움직인다
      },
      ev: [
        [0, () => { p.intangible = true; sc.fx.glow(p.x, p.y, 36, 0x6a2aff, 300, 1); sc.fx.ring(p.x, p.y, 30, 0x9a5aff, 260); sc.fx.burst(p.x, p.y, [0x2a0a3a, 0x6a2aff], 20, 120, { grav: -40, bounce: false }); Sfx.play('ghost'); }],
        [.9, () => {
          const a = act, s = sizeMul(p), tgt = sc.combat.nearest(p.x, p.y, 1, 320)[0];
          if (tgt) {   // 적 뒤편에서 나타난다
            const side = Math.sign(tgt.x - p.x) || p.face, y = tgt.bottom - p.b.height / 2 - 1;
            let x = tgt.x + side * 20;
            if (sc.isSolidAt(x, y)) x = tgt.x - side * 20;
            if (!sc.isSolidAt(x, y)) p.b.reset(x, y);
            const f = Math.sign(tgt.x - p.x) || -side; if (f !== p.face) { p.face = f; p.refacing(); }
          }
          p.intangible = false; p.sprite.setAlpha(1); a.anim = 'Strike'; a.mm = 0;
          const cx = tgt ? tgt.x : p.x + p.face * 24, cy = tgt ? tgt.y : p.y, r = 54 * s * (m ? 1.35 : 1);
          pierceGuard(sc, () => sc.combat.hitCircle(cx, cy, r, m ? 5 : 4.4, 'ghost', Object.assign({ kbx: 280, kby: -240, hs: 140 }, m ? { curse: 6 } : {})));
          for (let k = 0; k < 10; k++) { const ang = k / 10 * Math.PI * 2; lineFx(sc, cx, cy, cx + Math.cos(ang) * r * 1.5, cy + Math.sin(ang) * r * 1.1, k % 2 ? 0x9a5aff : 0x4a1a8a, { seg: 6, jag: 10, w: 3, ms: 420 }); }   // 그림자 촉수
          for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 60, () => sc.fx.ring(cx, cy, r * (.5 + k * .25), k % 2 ? 0xc08aff : 0x6a2aff, 420));
          sc.fx.glow(cx, cy, r * 1.4, 0x6a2aff, 500, 1);
          sc.fx.burst(cx, cy, [0x2a0a3a, 0x6a2aff, 0x9a5aff, 0xffffff], 60, 280 * s, { grav: 0, bounce: false, glow: true, life: .8 });
          sc.fx.ghost(p.sprite, 0x9a5aff, .8, 400);
          sc.cameras.main.flash(200, 90, 30, 140, true); sc.fx.shake(.024, 400);
          Sfx.play('boom'); Sfx.play('ghost');
        }]
      ],
      end(p) { p.intangible = false; p.sprite.setAlpha(1); }
    };
    guardVanish(p, act, 1300);
    return act;
  },
  distortion(p) {
    const m = p.mega.active;
    return {
      dur: .45, mm: .2, anim: 'Shoot', ev: [[.15, () => {
        const sc = p.scene, s = sizeMul(p), R = (m ? 120 : 90) * s, life = m ? 5.5 : 4;
        p.addBuff?.({ guard: .8, t: life, color: 0x9a5aff });
        sc.combat.hitCircle(p.x, p.y, R, 1.2, 'ghost', { curse: 4, slow: 2, kbx: 0, kby: -120, hs: 60 });
        for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 70, () => sc.fx.ring(p.x, p.y, R * (1 - k * .2), k % 2 ? 0x2a0a3a : 0x9a5aff, 420));
        sc.cameras.main.flash(260, 60, 20, 90, true); sc.fx.shake(.014, 260);
        Sfx.play('ghost'); Sfx.play('boss');
        sc.combat.spawnZone({
          x: p.x - R, y: p.y - R, w: R * 2, h: R * 2, life, tick: .3, type: 'ghost', color: 0x9a5aff,
          onTick: () => { for (const e of sc.enemies) if (e.alive && Math.hypot(e.x - p.x, e.y - p.y) < R) sc.combat.damageEnemy(e, p.atk * .22, 'ghost', { curse: 2, slow: 1.2, dot: 'curse' }); },
          onUpdate: (z, dt) => {
            z.x = p.x - R; z.y = p.y - R;
            for (const e of sc.enemies) if (e.alive && !e.boss && !e.flying && Math.hypot(e.x - p.x, e.y - p.y) < R) e.b.setVelocityY(Math.max(-55, e.b.velocity.y - 1000 * dt));   // 중력이 뒤집혀 둥실
            const k = Math.min(1, z.t * 4, (z.life - z.t) * 3), now = sc.time.now / 1000, g = sc.combat.zg, gn = sc.combat.zgn;
            gn.fillStyle(0x0a0614, .4 * k); gn.fillCircle(p.x, p.y, R);
            g.lineStyle(2, 0x9a5aff, .8 * k); g.strokeCircle(p.x, p.y, R * (1 + .03 * Math.sin(now * 5)));
            g.lineStyle(1, 0xc08aff, .6 * k);
            for (let j = 0; j < 6; j++) { const a0 = -now * 1.6 + j * Math.PI / 3; g.beginPath(); g.arc(p.x, p.y, R * .72, a0, a0 + .6); g.strokePath(); g.beginPath(); g.arc(p.x, p.y, R * .45, -a0, -a0 + .4); g.strokePath(); }
            if (Math.random() < .7) sc.fx.burst(p.x + (Math.random() - .5) * R * 1.6, p.y + R * .6, [0x9a5aff, 0x4a1a8a, 0xc08aff], 1, 10, { up: 0, grav: -220, bounce: false, glow: true, life: .8 });   // 위로 떨어지는 파편
          }
        });
      }]]
    };
  },

  // ===== 다크라이 =====
  dark_pulse(p, i) {
    const m = p.mega.active;
    if (i < 2) return {
      dur: .24, mm: .4, anim: 'Shoot', ev: [[.06, () => {
        const sc = p.scene, s = sizeMul(p), x = p.x, y = p.y;
        shoot(p, { speed: 260, r: 6, mul: 1, type: 'dark', kind: 'wave', life: .42, pierce: 2, color: 0x7a3ac0, kb: 120 });
        for (let k = 1; k <= 3; k++) sc.time.delayedCall(k * 45, () => sc.fx.ring(x + p.face * k * 22 * s, y - 3, (8 + k * 4) * s, k % 2 ? 0x7a3ac0 : 0x2a0a3a, 220));
        Sfx.play('wave');
      }]]
    };
    return {
      dur: .34, mm: .25, anim: 'Strike', ev: [[.1, () => {
        const sc = p.scene, s = sizeMul(p), r = 48 * s * (m ? 1.4 : 1);
        sc.combat.hitCircle(p.x, p.y, r, 1.7, 'dark', Object.assign({ stun: .6, kbx: 240, kby: -160, hs: 80 }, m ? { curse: 4 } : {}));
        for (let k = 0; k < 3; k++) sc.time.delayedCall(k * 60, () => sc.fx.ring(p.x, p.y, r * (.5 + k * .25), k % 2 ? 0x2a0a3a : 0x9a5aff, 320));
        sc.fx.glow(p.x, p.y, r, 0x4a1a7a, 300, .9);
        sc.fx.burst(p.x, p.y, [0x2a0a3a, 0x7a3ac0, 0xc08aff], 26, r * 4, { grav: 0, bounce: false, glow: true });
        sc.fx.shake(.01, 160); Sfx.play('ghost'); Sfx.play('boom');
      }]]
    };
  },
  dark_void(p) {
    const m = p.mega.active, sc = p.scene, sleep = m ? 3.2 : 2.5;
    return {
      dur: .6, mm: .2, anim: 'Shoot',
      update(p, a) { if (a.t < .2 && Math.random() < .8) sc.fx.burst(p.x + p.face * 12 + (Math.random() - .5) * 30, p.y + (Math.random() - .5) * 24, [0x2a0a3a, 0x7a3ac0], 1, 10, { grav: 0, bounce: false, life: .3 }); },
      ev: [[.2, () => {
        shoot(p, {
          speed: 130, r: 9, mul: .9, type: 'dark', kind: 'shadow', life: 1.1, pierce: 99, ghost: true, color: 0x4a1a7a, light: true, grow: 6, count: m ? 5 : 3, spread: .3,
          onHit: (e, q) => {
            sc.combat.damageEnemy(e, q.dmg, 'dark', { hx: q.x, hy: q.y, hs: 40 });
            if (!e.alive) return;
            putToSleep(sc, e, sleep);
            sc.fx.glow(e.x, e.y, 30, 0x2a0a3a, 400, .9); sc.fx.ring(e.x, e.y, 26, 0x7a3ac0, 360);   // 검은 구멍에 삼켜진다
          }
        });
        sc.fx.glow(p.x + p.face * 14, p.y - 3, 34, 0x4a1a7a, 300, 1); sc.fx.ring(p.x + p.face * 14, p.y - 3, 30, 0x9a5aff, 260);
        sc.cameras.main.flash(160, 40, 10, 60, true);
        Sfx.play('ghost'); Sfx.play('wave');
      }]]
    };
  },
  nightmare(p) {
    const m = p.mega.active, sc = p.scene, per = m ? .6 : .5;
    return {
      dur: .55, mm: .2, anim: 'Shoot', ev: [[.18, () => {
        const v = view(p);
        screenTint(sc, 0x2a0a3a, .3, 3600, 500);
        sc.cameras.main.flash(300, 60, 0, 90, true); sc.fx.shake(.014, 260);
        sc.fx.glow(p.x, p.y, 70, 0x4a1a7a, 500, 1);
        Sfx.play('ghost'); Sfx.play('boss');
        for (const e of sc.enemies) {
          if (!e.alive || !inView(v, e)) continue;
          if (e.status.stun > 0) {   // 잠들거나 기절한 적: 4초간 악몽
            sc.fx.floatText(e.x, e.top - 16, '악몽!', '#c08aff', 11);
            const ev = sc.time.addEvent({
              delay: 400, repeat: 9, callback: () => {
                if (!e.alive) { ev.remove(); return; }
                sc.combat.damageEnemy(e, p.atk * per, 'ghost', { curse: .6, dot: 'nightmare' });
                if (!e.alive) return;
                sc.fx.glow(e.x, e.y, 24, 0x6a2aff, 300, .8);
                const gy = sc.groundBelow(e.x, e.y - 10);
                lineFx(sc, e.x + (Math.random() - .5) * 20, gy, e.x, e.y, 0x9a5aff, { seg: 5, jag: 8, w: 2, ms: 260 });   // 그림자 손
              }
            });
          } else sc.combat.damageEnemy(e, p.atk * .8, 'ghost', { curse: 6, hx: e.x, hy: e.y, hs: 30 });
        }
      }]]
    };
  }
};
