// 정화한 전설 포켓몬 스킬 (1) — 뮤츠 · 칠색조 · 스이쿤 · 엔테이 · 라이코 · 레쿠쟈
// 전설의 X/C 는 보스 시그니처 기술: 화면을 뒤덮는 압도적인 연출 대신 재사용 대기가 길다 (data/skills/legend1.js)
// 메가가 없는 전설은 p.mega.active = '각성'. 뮤츠는 메가뮤츠X(격투 혼합) / Y(에스퍼 강화)를 타입으로 구분한다
import Phaser from 'phaser';
import { typeColor } from '../../data/types.js';
import { Sfx } from '../../systems/Audio.js';
import { sizeMul, slashHit, shoot, lineFx, dashAction, view, groundAt } from '../skillKit.js';

const ADD = Phaser.BlendModes.ADD;
const RAINBOW = [0xff5a4a, 0xffa03a, 0xffe04a, 0x7aff6a, 0x5ac8ff, 0xb07aff];
const PSY = 0xff5a9a, PSY_L = 0xffb0e0;
const megaX = p => p.mega.active && p.types.includes('fighting');   // 메가뮤츠X
const megaY = p => p.mega.active && !p.types.includes('fighting');  // 메가뮤츠Y

// 카메라 시야 안의 살아 있는 적
const viewEnemies = p => {
  const v = view(p);
  return p.scene.enemies.filter(e => e.alive && !e.intangible && e.x > v.x - 10 && e.x < v.right + 10 && e.y > v.y - 20 && e.y < v.bottom + 20);
};

// 행동이 끝난 뒤에도 이어지는 연출: dur 초 동안 매 프레임 fn(t, dt). fn 이 true 를 돌려주면 일찍 끝. 히트스톱 동안은 멈춘다
function tickFor(sc, dur, fn, done) {
  let t = 0, last = sc.time.now, over = false;
  const finish = () => { if (over) return; over = true; ev.remove(); if (done) done(); };
  const ev = sc.time.addEvent({
    delay: 16, loop: true, callback: () => {
      const now = sc.time.now, dt = Math.min(.05, (now - last) / 1000); last = now;
      if (sc.fx.hitStopUntil && performance.now() < sc.fx.hitStopUntil) return;
      t += dt;
      if (fn(t, dt) === true || t >= dur) finish();
    }
  });
  return ev;
}

// 적 하나당 최소 간격(cd 초)을 두고 반복 타격 (다단히트 기술 공용)
function hitEvery(p, cool, t, cd, rect, mul, type, o) {
  const sc = p.scene;
  for (const e of sc.combat.enemiesIn(rect)) {
    if ((cool.get(e) || -1) > t) continue;
    cool.set(e, t + cd);
    sc.combat.damageEnemy(e, p.atk * mul, type, Object.assign({ hx: e.x, hy: e.y }, o));
  }
  if (sc.props) sc.props.hitRect(rect);
}

export const SKILL_IMPL = {
  // ===== 뮤츠 =====
  psycho_cut(p, i) {
    const mx = megaX(p), my = megaY(p);
    if (i < 2) return {
      dur: .22, mm: .4, anim: 'Attack', ev: [[.07, () => {
        slashHit(p, { fwd: 14, w: 26, h: 20, mul: 1.05, type: 'psychic', color: PSY_L, flipV: i === 1, arc: 14 });
        shoot(p, { speed: 360, r: 3, mul: .4, type: 'psychic', kind: 'bolt', life: .25, pierce: 2, color: PSY, oy: i ? 2 : -6 });   // 짧은 염동 칼날
      }]]
    };
    if (mx) return {   // 메가X: 격투 기운을 실은 거대 베기 + 충격 칼날
      dur: .34, mm: .25, anim: 'Strike', ev: [[.12, () => {
        slashHit(p, { fwd: 18, w: 40, h: 34, mul: 1.8, type: 'fighting', crit: .25, kbx: 280, kby: -200, color: 0xffb0a0, arc: 20, thick: 8 });
        shoot(p, { speed: 320, r: 7, mul: 1, type: 'psychic', kind: 'wave', life: .45, pierce: 99, color: PSY });
        p.scene.fx.glow(p.x + p.face * 20, p.y, 34, 0xff7a6a, 220, .9); p.scene.fx.shake(.008, 140); Sfx.play('punch');
      }]]
    };
    return {
      dur: .3, mm: .35, anim: 'Shoot', ev: [[.09, () => {
        shoot(p, { speed: 330, r: 5, mul: my ? .5 : .6, type: 'psychic', kind: 'bolt', life: .75, pierce: 3, count: my ? 5 : 3, spread: .2, color: PSY, homing: my ? .35 : 0, light: false });
        p.scene.fx.ring(p.x + p.face * 10, p.y - 3, 18, PSY_L, 200); p.scene.fx.glow(p.x + p.face * 10, p.y - 3, 22, PSY, 180, .8);
        Sfx.play('swing'); Sfx.play('wave');
      }]]
    };
  },
  // 사이코브레이크: 시전 자리에서 화면 끝까지 퍼지는 염동 파동을 연달아 방출. 파면이 닿는 순간 타격
  psystrike(p) {
    const sc = p.scene, mx = megaX(p), my = megaY(p), s = sizeMul(p);
    const times = my ? [.1, .3, .5, .7, .9] : [.12, .36, .6, .84], g = sc.add.graphics().setDepth(43).setBlendMode(ADD), waves = [];
    const pulse = k => {
      const v = view(p), x = p.x, y = p.y, last = k === times.length - 1;
      const R = Math.max(...[[v.x, v.y], [v.right, v.y], [v.x, v.bottom], [v.right, v.bottom]].map(([cx, cy]) => Math.hypot(cx - x, cy - y))) + 30;
      waves.push({ x, y, t: 0, R, set: new Set(), shown: new Set(), last, type: last && mx ? 'fighting' : 'psychic', mul: last ? (mx ? 1.4 : 1.1) : (my ? .78 : .85) });
      sc.fx.glow(x, y, 50 * s, PSY, 260, 1); sc.fx.ring(x, y, 40 * s, 0xffffff, 220);
      sc.cameras.main.flash(90, 255, 110, 190, true);
      sc.fx.shake(last ? .016 : .01, last ? 260 : 140);
      sc.combat.clearEnemyProjectiles(v);   // 파동이 적 탄을 짓눌러 없앤다
      Sfx.play('wave'); if (k === 0 || last) Sfx.play('beam');
      p.squash(1.18, .86);
    };
    return {
      dur: times[times.length - 1] + .42, mm: .15, anim: 'Shoot', lockFace: true, inv: .5,
      ev: times.map((t, k) => [t, () => pulse(k)]),
      update(p, a, dt) {
        g.clear();
        if (Math.random() < .6) sc.fx.embers(p.x + (Math.random() - .5) * 26, p.y + (Math.random() - .5) * 26, [PSY, PSY_L, 0xffffff], 1, { speed: 40 });
        for (let i = waves.length - 1; i >= 0; i--) {
          const w = waves[i];
          w.t += dt;
          const k = Math.min(1, w.t / .34), r = w.R * (1 - (1 - k) * (1 - k)), fade = 1 - k * .8;
          // 이중 파면 + 안쪽 일그러짐
          g.lineStyle(8 * s, PSY, .35 * fade); g.strokeCircle(w.x, w.y, r);
          g.lineStyle(3, w.type === 'fighting' ? 0xffb070 : PSY_L, .9 * fade); g.strokeCircle(w.x, w.y, r);
          g.lineStyle(1, 0xffffff, fade); g.strokeCircle(w.x, w.y, Math.max(0, r - 10 * s));
          g.lineStyle(2, PSY, .4 * fade); g.strokeCircle(w.x, w.y, r * .6);
          const n = sc.combat.hitCircle(w.x, w.y, r, w.mul, w.type, { set: w.set, kbx: w.last ? 260 : 70, kby: w.last ? -220 : -50, hs: w.last ? 90 : 30, stun: w.last ? .6 : 0 });
          if (n) for (const e of w.set) if (!w.shown.has(e)) { w.shown.add(e); sc.fx.ring(e.x, e.y, 22 * s, PSY_L, 220); }
          if (k >= 1) waves.splice(i, 1);
        }
      },
      end() { g.destroy(); }
    };
  },
  // 미래예지: 표식 → 0.9초까지 적을 따라가다 자리 고정 → 1.2초에 빛의 기둥
  future_sight(p) {
    const sc = p.scene, mx = megaX(p), my = megaY(p), s = sizeMul(p);
    const strike = mk => {
      const v = view(p), w = (my ? 34 : 24) * s, top = v.y - 20, gy = sc.groundBelow(mk.x, mk.y - 10), h = Math.max(30, gy - top);
      sc.combat.spawnZone({
        x: mk.x - w / 2, y: top, w, h, life: .45, tick: 9, draw: 'pillar', type: 'psychic', color: mx ? 0xffb0a0 : 0xffd0f0,
        onTick: z => sc.combat.hitRect(z, my ? 4.6 : mx ? 4.2 : 3.8, mx ? 'fighting' : 'psychic', { stun: mx ? 1.1 : .6, kbx: 40, kby: -200, hs: 80 })
      });
      lineFx(sc, mk.x, top, mk.x, gy, 0xffffff, { seg: 4, jag: 2, w: w * .5, ms: 260 });
      sc.fx.glow(mk.x, gy - 10, 60 * s, PSY, 380, 1); sc.fx.glow(mk.x, mk.y, 34 * s, 0xffffff, 240, 1);
      sc.fx.ring(mk.x, gy - 4, 46 * s, PSY_L, 320); sc.time.delayedCall(80, () => sc.fx.ring(mk.x, gy - 4, 30 * s, 0xffffff, 260));
      sc.fx.burst(mk.x, gy - 4, [PSY, PSY_L, 0xffffff], 22, 200, { up: 160, glow: true });
    };
    return {
      dur: .5, mm: .2, anim: 'Shoot', ev: [[.16, () => {
        const marks = viewEnemies(p).map(e => ({ e, x: e.x, y: e.y }));
        if (!marks.length) for (let k = 1; k <= 3; k++) { const x = p.x + p.face * k * 46 * s; marks.push({ x, y: groundAt(p, x) - 12 }); }
        for (const mk of marks) {
          mk.ring = sc.add.image(mk.x, mk.y, 'ring').setTint(PSY).setBlendMode(ADD).setDepth(44).setScale(1.2 * s);
          mk.dot = sc.add.image(mk.x, mk.y, 'glow').setTint(PSY_L).setBlendMode(ADD).setDepth(44).setScale(.3 * s);
          lineFx(sc, p.x, p.y - 6, mk.x, mk.y, PSY_L, { seg: 5, jag: 4, w: 1, ms: 200 });
        }
        sc.cameras.main.flash(140, 255, 150, 220, true); sc.fx.glow(p.x, p.y - 6, 40 * s, PSY, 300, 1);
        Sfx.play('wave'); Sfx.play('ghost');
        tickFor(sc, 1.2, t => {
          for (const mk of marks) {
            if (t < .9 && mk.e && mk.e.alive) { mk.x = mk.e.x; mk.y = mk.e.y; }   // 0.9초 뒤엔 자리를 고정 (피할 틈)
            const k = t / 1.2, blink = t > .9 && Math.floor(t * 30) % 2;
            mk.ring.setPosition(mk.x, mk.y).setScale((1.2 - k * .8) * s).setAlpha(blink ? .3 : .9);
            mk.dot.setPosition(mk.x, mk.y).setScale((.3 + k * .5) * s).setAlpha(.6 + k * .4);
          }
        }, () => {
          for (const mk of marks) { mk.ring.destroy(); mk.dot.destroy(); strike(mk); }
          sc.cameras.main.flash(180, 255, 220, 240, true); sc.fx.shake(.018, 300);
          Sfx.play('beam'); Sfx.play('boom');
        });
      }]]
    };
  },

  // ===== 칠색조 =====
  flame_feather(p, i) {
    const aw = p.mega.active;
    if (i < 2) return {
      dur: .22, mm: .45, anim: 'Shoot', ev: [[.06, () => {
        for (let k = 0; k < 2; k++) shoot(p, { speed: 300, r: 3, mul: .55, type: 'fire', kind: 'bolt', life: .55, angle: (k - .5) * .14 + (i ? -.04 : .04), pierce: 2, color: RAINBOW[(i * 2 + k * 3) % 6], status: { burn: 1.5 } });
        p.scene.fx.burst(p.x + p.face * 8, p.y - 3, RAINBOW, 5, 70, { glow: true, grav: 0, bounce: false, life: .35 });
        Sfx.play('leaf');
      }]]
    };
    return {
      dur: .3, mm: .3, anim: 'Attack', ev: [[.09, () => {
        shoot(p, { speed: 330, r: 4, mul: .5, type: 'fire', kind: 'fire', life: .7, pierce: 2, count: aw ? 7 : 5, spread: aw ? .13 : .16, color: 0xff7a2a, status: { burn: 2.5 }, homing: aw ? .3 : 0 });
        const sc = p.scene, x = p.x + p.face * 10;
        sc.fx.burst(x, p.y - 3, [0xff7a2a, 0xffd04a, ...RAINBOW], 16, 140, { angle: p.face > 0 ? 0 : Math.PI, spread: 1.2, glow: true, grav: 40 });
        sc.fx.glow(x, p.y - 3, 26, 0xffa03a, 200, .9);
        Sfx.play('fire'); p.squash(1.2, .85);
      }]]
    };
  },
  // 성스러운불꽃: 무지개·황금 불기둥이 앞으로 휩쓸며 적을 실어 나르고, 지나간 땅에 성화를 남긴다
  sacred_fire(p) {
    const aw = p.mega.active, sc = p.scene, s = sizeMul(p), dir = p.face, cool = new Map();
    const sp = aw ? 300 : 240, w = (aw ? 44 : 30) * s, H = (aw ? 140 : 110) * s;
    const g = sc.add.graphics().setDepth(43).setBlendMode(ADD);
    return {
      dur: 1.05, mm: .2, anim: 'Shoot', lockFace: true, inv: .3, cx: p.x + dir * 18 * s, ft: 0, st: 0,
      ev: [[0, () => { sc.cameras.main.flash(160, 255, 220, 120, true); sc.fx.glow(p.x, p.y, 60 * s, 0xffd04a, 320, 1); Sfx.play('fire'); Sfx.play('beam'); }]],
      update(p, a, dt) {
        const gy = sc.groundBelow(a.cx, p.y - 30);
        if (!a.stop && !sc.isSolidAt(a.cx + dir * w / 2, gy - 12)) a.cx += dir * sp * dt; else a.stop = true;   // 벽에 막히면 그 자리에서 타오른다
        const k = Math.min(1, a.t / .12) * Math.min(1, (a.dur - a.t) / .15 + .1), h = H * k, x = a.cx;
        // 불기둥: 무지개 테두리 → 황금 → 흰 심지 (일렁임)
        g.clear();
        for (let j = 0; j < 6; j++) { const ww = w * (1.25 - j * .05) + Math.sin(a.t * 30 + j) * 2; g.fillStyle(RAINBOW[(j + Math.floor(a.t * 20)) % 6], .12 * k); g.fillRect(x - ww / 2, gy - h - j * 3, ww, h + j * 3); }
        g.fillStyle(0xffa03a, .5 * k); g.fillRect(x - w / 2, gy - h, w, h);
        g.fillStyle(0xffd04a, .7 * k); g.fillRect(x - w * .32, gy - h * .96, w * .64, h * .96);
        g.fillStyle(0xffffff, .8 * k); g.fillRect(x - w * .12, gy - h * .9, w * .24, h * .9);
        for (let j = 0; j < 3; j++) sc.fx.embers(x + (Math.random() - .5) * w, gy - Math.random() * h, j ? [0xffd04a, 0xffffff] : RAINBOW, 1, { speed: 50, life: .5 });
        if (!a.light) a.light = sc.combat.takeLight(x, gy - h / 2, 160, 0xffb040, 2.2);
        if (a.light) a.light.setPosition(x, gy - h / 2);
        // 판정: 같은 적은 0.12초마다, 기둥 진행 방향으로 실어 나른다
        hitEvery(p, cool, a.t, .12, { x: x - w / 2, y: gy - h, w, h }, .5, 'fire', { burn: 6, kb: dir * (sp + 60), kby: -40, hs: 20 });
        sc.combat.clearEnemyProjectiles({ x: x - w / 2, y: gy - h, w, h });
        // 지나간 자리에 오래 타는 성화
        a.ft -= dt;
        if (a.ft <= 0) {
          a.ft = .07; a.fn = (a.fn || 0) + 1;
          sc.combat.spawnZone({ x: x - 10 * s, y: gy - 12, w: 20 * s, h: 12, life: aw ? 7 : 5, tick: .4, draw: 'fire', type: 'fire', color: a.fn % 2 ? 0xffc040 : 0xff7a2a, onTick: z => sc.combat.hitRect(z, .22, 'fire', { burn: 3, kbx: 0, kby: 0, hs: 0 }) });
        }
        a.st -= dt; if (a.st <= 0) { a.st = .15; Sfx.play('fire'); }
      },
      end(p, a) { g.destroy(); sc.combat.freeLight(a.light); }
    };
  },
  // 브레이브버드: 솟구쳤다가 곡선을 그리며 활강 낙하 → 착지 폭발 + 파티 회복(재생)
  phoenix_dive(p) {
    const aw = p.mega.active, sc = p.scene, s = sizeMul(p), set = new Set();
    let P0 = null, P1, P2;
    const impact = (p, a) => {
      if (a.done) return; a.done = true;
      const r = (aw ? 96 : 72) * s, x = p.x, y = p.bottom - 8;
      sc.combat.hitCircle(x, y, r, aw ? 3.4 : 2.8, 'fire', { burn: 5, kbx: 260, kby: -280, hs: 110 });
      for (let k = 0; k < 6; k++) sc.time.delayedCall(k * 50, () => sc.fx.ring(x, y, r * (.4 + k * .14), RAINBOW[k], 380));
      sc.fx.glow(x, y, r * 1.2, 0xffa03a, 500, 1); sc.fx.glow(x, y, r * .6, 0xffffff, 260, 1);
      sc.fx.burst(x, y, [0xff7a2a, 0xffd04a, 0xffffff, ...RAINBOW], 60, 260 * s, { up: 200, glow: true, life: .9 });
      sc.combat.spawnZone({ x: x - r * .7, y: p.bottom - 14, w: r * 1.4, h: 14, life: 3, tick: .4, draw: 'fire', type: 'fire', color: 0xffb040, onTick: z => sc.combat.hitRect(z, .2, 'fire', { burn: 3, kbx: 0, kby: 0, hs: 0 }) });
      // 재생의 불꽃: 파티 전원 소량 회복
      for (const m of p.members) if (m.alive) m.hp = Math.min(m.maxhp, m.hp + m.maxhp * (aw ? .1 : .06));
      sc.fx.floatText(p.x, p.b.y - 16, '재생의 불꽃!', '#ffd070', 12);
      sc.cameras.main.flash(200, 255, 210, 140, true); sc.fx.shake(.02, 340); sc.fx.hitStop(110);
      Sfx.play('boom'); Sfx.play('fire'); Sfx.play('heal');
      p.squash(1.4, .7);
      a.dur = Math.min(a.dur, a.t + .2);
    };
    return {
      dur: 1.25, ctrl: true, noGrav: true, anim: 'Walk', inv: 1.35, lockFace: true,
      update(p, a, dt) {
        a.gt = (a.gt || 0) - dt;
        if (a.gt <= 0) { a.gt = .025; sc.fx.ghost(p.sprite, RAINBOW[Math.floor(a.t * 40) % 6], .55, 280); }
        if (a.t < .32) {   // ① 날개를 펴고 솟구친다
          p.b.setVelocity(-p.face * 50, -440 * (1 - a.t / .32) - 40);
          sc.fx.embers(p.x, p.bottom, [0xffd04a, 0xffffff], 2, { speed: 40 });
          return;
        }
        if (a.done) { p.b.setVelocity(0, 0); return; }
        if (!P0) {   // ② 표적을 정하고 곡선(2차 베지어)으로 활강
          const e = sc.combat.nearest(p.x, p.y, 1, 300)[0], tx = e ? e.x : p.x + p.face * 150 * s;
          P0 = { x: p.x, y: p.y }; P2 = { x: tx, y: (e ? e.bottom : groundAt(p, tx)) - p.b.height / 2 }; P1 = { x: P0.x + (P2.x - P0.x) * .1, y: Math.max(P0.y, P2.y) + 10 };
          if (tx !== p.x) { p.face = Math.sign(tx - p.x); p.refacing(); }
          a.u = 0; Sfx.play('fire'); Sfx.play('dash');
          sc.fx.glow(p.x, p.y, 40 * s, 0xffd04a, 220, 1);
        }
        a.u = Math.min(1, a.u + dt / .4);
        const u = a.u, v = 1 - u, bx = v * v * P0.x + 2 * v * u * P1.x + u * u * P2.x, by = v * v * P0.y + 2 * v * u * P1.y + u * u * P2.y;
        p.b.setVelocity(Phaser.Math.Clamp((bx - p.x) / dt, -1400, 1400), Phaser.Math.Clamp((by - p.y) / dt, -1400, 1400));
        sc.combat.hitRect({ x: p.b.x - 8 * s, y: p.b.y - 6 * s, w: p.b.width + 16 * s, h: p.b.height + 12 * s }, 1.2, 'flying', { set, burn: 3, kbx: 180, kby: -160 });
        sc.fx.burst(p.x, p.y, [0xff7a2a, 0xffd04a, 0xff4a2a], 4, 40, { up: 10, grav: -30, bounce: false, glow: true, life: .45, size: 2 });   // 불꽃 꼬리
        if (u >= 1 || (u > .3 && p.b.blocked.down)) impact(p, a);
      },
      end(p, a) { if (!a.done && P0) impact(p, a); p.b.setVelocity(p.b.velocity.x * .2, 0); }
    };
  },

  // ===== 스이쿤 =====
  aurora_beam(p, i) {
    const aw = p.mega.active, big = i === 2;
    return {
      dur: big ? .3 : .22, mm: .4, anim: 'Shoot', ev: [[.06, () => {
        const sc = p.scene, s = sizeMul(p), len = (big ? 140 : 96) * s, h = (big ? 12 : 7) * s, x0 = p.x + p.face * 8, y = p.y - 3;
        const rect = { x: p.face > 0 ? x0 : x0 - len, y: y - h / 2, w: len, h };
        sc.combat.hitRect(rect, big ? 1.6 : .95, 'ice', { slow: big ? 3 : 1.6, root: big && aw ? 1.2 : 0, kbx: big ? 160 : 50, kby: -30 });
        // 오로라 띠: 얼음빛 중심 + 분홍·초록 줄
        const cols = big ? [0xff9ad8, 0x8ae8ff, 0x9affb0] : [i ? 0x9affb0 : 0xff9ad8, 0x8ae8ff];
        cols.forEach((c, k) => sc.combat.spawnZone({ x: rect.x, y: y - h / 2 + k * h / cols.length, w: len, h: Math.max(2, h / cols.length), life: big ? .26 : .18, draw: 'beam', color: c }));
        sc.fx.glow(x0, y, (big ? 22 : 14) * s, 0x8ae8ff, 180, .9);
        for (let k = 0; k < (big ? 8 : 4); k++) sc.fx.burst(x0 + p.face * Math.random() * len, y, [0x8ae8ff, 0xffffff, 0xff9ad8], 1, 30, { grav: 0, bounce: false, glow: true, life: .4 });
        if (big && aw) for (const e of sc.combat.enemiesIn(rect)) sc.fx.shatter(e.x, e.y, 14, 14, { n: 5, speed: 90, scale: .6 });
        Sfx.play(big ? 'beam' : 'water');
      }]]
    };
  },
  // 파도타기: 화면 뒤쪽 끝에서 앞쪽 끝까지 큰 파도가 휩쓸며 적을 실어 나른다
  tidal_surf(p) {
    const aw = p.mega.active, sc = p.scene, s = sizeMul(p), dir = p.face;
    return {
      dur: .55, mm: .2, anim: 'Shoot', lockFace: true, inv: .4, ev: [[.15, () => {
        const v = view(p), x0 = dir > 0 ? v.x - 50 : v.right + 50, x1 = dir > 0 ? v.right + 120 : v.x - 120, T = aw ? 1.3 : 1.1, W = 96 * s, H = (aw ? 110 : 80) * s;
        const g = sc.add.graphics().setDepth(43), ga = sc.add.graphics().setDepth(44).setBlendMode(ADD), cool = new Map();
        sc.cameras.main.flash(140, 120, 190, 255, true); sc.fx.shake(.012, 300);
        Sfx.play('water'); Sfx.play('wave');
        tickFor(sc, T, (t, dt) => {
          const k = t / T, fx = x0 + (x1 - x0) * k, rise = Math.min(1, t / .2) * Math.min(1, (T - t) / .18 + .25);
          g.clear(); ga.clear();
          // 파도 몸통: 앞머리(볏)가 가장 높고 뒤로 갈수록 낮아진다
          for (let j = 0; j < W; j += 4) {
            const x = fx - dir * j, u = j / W, gy = groundAt(p, x);
            const h = H * rise * (u < .15 ? .78 + u / .15 * .22 : 1 - (u - .15) / .85 * .8) * (1 + Math.sin(t * 18 + j * .2) * .04);
            g.fillStyle(0x1a5ad8, .7); g.fillRect(x - 2, gy - h, 4, h);
            g.fillStyle(0x4ac0ff, .75); g.fillRect(x - 2, gy - h, 4, h * .45);
            ga.fillStyle(0xffffff, .85); ga.fillRect(x - 2, gy - h, 4, 2);
          }
          const gyF = groundAt(p, fx), top = gyF - H * rise;
          ga.fillStyle(0xbfe6ff, .8); ga.fillCircle(fx - dir * 8 * s, top + 6 * s, 8 * s);   // 말려드는 볏
          sc.fx.burst(fx, top + 4, [0xffffff, 0xbfe6ff, 0x4ac0ff], 3, 90, { up: 90, angle: dir > 0 ? -.6 : Math.PI + .6, spread: .8, life: .5 });
          const rect = { x: dir > 0 ? fx - W : fx, y: top, w: W, h: H * rise };
          hitEvery(p, cool, t, .12, rect, .45, 'water', { slow: 2, kb: dir * 420, kby: -120, hs: 15 });
          sc.combat.clearEnemyProjectiles(rect);
        }, () => { g.destroy(); ga.destroy(); });
      }]]
    };
  },
  // 미러코트: 수정 장막. 적 탄은 반사(guard 'reflect'), 몸에 닿는 공격은 피해 대신 2배로 되돌린다
  mirror_coat(p) {
    const aw = p.mega.active, sc = p.scene, s = sizeMul(p), r = 26 * s, R = 80 * s;
    const g = sc.add.graphics().setDepth(43).setBlendMode(ADD), st = { glint: 0 };
    const retaliate = (dmg, srcX) => {
      const base = Phaser.Math.Clamp(dmg * 2, p.atk * 2, p.atk * 5);
      let n = 0;
      for (const e of sc.enemies) {
        if (!e.alive || Math.abs(e.x - p.x) > R || Math.abs(e.y - p.y) > R) continue;
        sc.combat.damageEnemy(e, base, 'psychic', { kb: Math.sign(e.x - p.x || 1) * 280, kby: -200, hx: e.x, hy: e.y, hs: 90 });
        lineFx(sc, p.x, p.y, e.x, e.y, 0xbfe6ff, { seg: 3, jag: 2, w: 3, ms: 200 }); n++;
      }
      sc.fx.ring(p.x, p.y, R, 0xbfe6ff, 300); sc.fx.ring(p.x, p.y, R * .7, PSY_L, 260); sc.fx.glow(p.x, p.y, R * .8, 0x8ae8ff, 260, 1);
      sc.fx.burst(p.x, p.y, [0xbfe6ff, 0xffffff, PSY_L], 24, 200, { glow: true });
      sc.fx.floatText(p.x, p.b.y - 14, n ? '미러코트!' : '반사!', '#bfe6ff', 12);
      sc.fx.shake(.012, 200); Sfx.play('shatter'); Sfx.play('wave');
      st.glint = .25;
    };
    return {
      dur: aw ? 2 : 1.4, mm: .35, anim: 'Idle', guard: 'reflect',
      ev: [[0, () => {
        sc.fx.ring(p.x, p.y, r * 1.6, 0xbfe6ff, 260); sc.fx.glow(p.x, p.y, r * 1.5, 0x8ae8ff, 260, .9); Sfx.play('purify');
        // 이 행동 동안만 피격 처리를 가로챈다 (end 에서 원래대로)
        p.takeHit = (dmg, type, srcX, o = {}) => {
          if (o.force) return Object.getPrototypeOf(p).takeHit.call(p, dmg, type, srcX, o);
          if (p.inv > 0 || p.intangible || p.dash) return false;
          p.inv = .3; retaliate(dmg, srcX);
          return true;
        };
      }]],
      update(p, a, dt) {
        st.glint -= dt; g.clear();
        const k = st.glint > 0 ? 1 : .55 + Math.sin(a.t * 14) * .15, rr = r * (1 + Math.sin(a.t * 9) * .04), pts = [];
        for (let j = 0; j < 6; j++) { const an = j / 6 * Math.PI * 2 + a.t * .8; pts.push({ x: p.x + Math.cos(an) * rr, y: p.y + Math.sin(an) * rr }); }
        g.fillStyle(0x8ae8ff, .12 * k); g.fillPoints(pts, true);
        g.lineStyle(2, 0xbfe6ff, .9 * k); g.strokePoints(pts, true);
        g.lineStyle(1, PSY_L, .6 * k); for (let j = 0; j < 6; j += 2) g.lineBetween(pts[j].x, pts[j].y, pts[(j + 3) % 6].x, pts[(j + 3) % 6].y);
        if (Math.random() < .3) sc.fx.embers(pts[(Math.random() * 6) | 0].x, pts[(Math.random() * 6) | 0].y, [0xffffff, 0xbfe6ff], 1, { speed: 20, life: .4 });
      },
      end(p) {
        delete p.takeHit;
        g.destroy();
        sc.fx.shatter(p.x, p.y, r * 1.6, r * 1.6, { n: 10, speed: 120, scale: .7 }); Sfx.play('crack');
        if (aw) {   // 각성: 장막이 깨지며 수정 폭발
          sc.combat.hitCircle(p.x, p.y, 60 * s, 1.5, 'psychic', { kbx: 220, kby: -180 });
          sc.fx.ring(p.x, p.y, 60 * s, 0xbfe6ff, 300); sc.fx.burst(p.x, p.y, [0xbfe6ff, 0xffffff], 20, 180, { glow: true });
        }
      }
    };
  },

  // ===== 엔테이 =====
  lava_plume(p, i) {
    const aw = p.mega.active, big = i === 2;
    return {
      dur: big ? .34 : .24, mm: .3, anim: big ? 'Strike' : 'Attack', ev: [[big ? .12 : .07, () => {
        const sc = p.scene, s = sizeMul(p), r = (big ? 46 : 26) * s, cx = p.x + p.face * (big ? 6 : 14) * s, cy = p.y;
        sc.combat.hitCircle(cx, cy, r, big ? 1.7 : 1, 'fire', { burn: big ? 3.5 : 2, kbx: big ? 220 : 110, kby: big ? -240 : -80, hs: big ? 70 : 40 });
        for (let k = 0; k < (big ? 9 : 4); k++) {
          const an = Math.random() * Math.PI * 2, d = Math.random() * r;
          sc.fx.burst(cx + Math.cos(an) * d, cy + Math.sin(an) * d * .7, [0xff5a1a, 0xffb03a, 0xffe08a, 0x3a1a10], 5, 70, { up: 90, glow: true });
        }
        sc.fx.glow(cx, cy, r, 0xff5a1a, 220, .9); sc.fx.ring(cx, cy, r, 0xffa03a, 220);
        if (big) {
          sc.fx.shake(.009, 150); Sfx.play('boom'); p.squash(1.25, .8);
          if (aw) sc.combat.spawnZone({ x: cx - r, y: p.bottom - 14, w: r * 2, h: 14, life: 2.5, tick: .35, draw: 'fire', type: 'fire', onTick: z => sc.combat.hitRect(z, .25, 'fire', { burn: 2.5, kbx: 0, kby: 0, hs: 0 }) });
        } else p.squash(1.12, .92);
        Sfx.play('fire');
      }]]
    };
  },
  // 대문자: 大자 모양 화염탄 → 폭발 → 다섯 갈래 불길이 차례로 뻗는다
  fire_blast(p) {
    const aw = p.mega.active, sc = p.scene, s = sizeMul(p);
    const DIRS = [[-1, 0], [1, 0], [0, -1], [-.7, .7], [.7, .7]];   // 가로획 양쪽 · 위 · 두 다리
    const prongs = (x, y) => {
      const n = aw ? 8 : 6, step = 15 * s;
      for (const [dx, dy] of DIRS) {
        const set = new Set();
        for (let k = 1; k <= n; k++) sc.time.delayedCall(k * 45, () => {
          const px = x + dx * k * step, py = y + dy * k * step;
          if (sc.isSolidAt(px, py)) return;
          sc.combat.hitCircle(px, py, 13 * s, .5, 'fire', { set, burn: 3, kbx: 120, kby: -120, hs: 20 });
          sc.fx.burst(px, py, [0xff5a1a, 0xffa03a, 0xffe08a], 5, 60, { up: 50, glow: true, life: .45 });
          sc.fx.glow(px, py, 16 * s, 0xff7a2a, 200, .9);
          if (aw && k === n) sc.combat.spawnZone({ x: px - 14 * s, y: groundAt(p, px) - 12, w: 28 * s, h: 12, life: 3, tick: .4, draw: 'fire', type: 'fire', onTick: z => sc.combat.hitRect(z, .22, 'fire', { burn: 3, kbx: 0, kby: 0, hs: 0 }) });
        });
      }
      Sfx.play('fire');
    };
    return {
      dur: .45, mm: .2, anim: 'Shoot', ev: [[.16, () => {
        const g = sc.add.graphics().setDepth(43).setBlendMode(ADD);
        let done = false;
        const q = sc.combat.spawnProjectile({
          owner: 'player', x: p.x + p.face * 14, y: p.y - 4, vx: p.face * 230, vy: 0, r: 9 * s, mul: 0, type: 'fire', kind: 'fire', life: 1.1, pierce: 1, light: true, color: 0xff6a1a,
          status: { burn: 4 }, boom: { r: (aw ? 66 : 50) * s, mul: 2.2, kb: 260 },
          onExpire: q => { done = true; g.destroy(); prongs(q.x, q.y); sc.fx.shake(.016, 260); sc.cameras.main.flash(120, 255, 170, 90, true); }
        });
        // 날아가는 동안 '大' 모양 불꽃을 그린다
        tickFor(sc, 1.3, t => {
          if (done) return true;
          const L = (13 + Math.sin(t * 40) * 1.5) * s;
          g.clear();
          for (const [dx, dy] of DIRS) {
            g.lineStyle(5 * s, 0xff5a1a, .85); g.lineBetween(q.x, q.y, q.x + dx * L, q.y + dy * L);
            g.lineStyle(2 * s, 0xffe08a, 1); g.lineBetween(q.x, q.y, q.x + dx * L * .85, q.y + dy * L * .85);
          }
          if (Math.random() < .7) sc.fx.embers(q.x - p.face * 6, q.y, [0xff7a2a, 0xffd04a], 2, { speed: 40 });
        }, () => { if (!done) { done = true; g.destroy(); } });   // 스테이지 전환 등으로 탄이 조용히 사라진 경우
        sc.fx.glow(p.x + p.face * 14, p.y - 4, 30 * s, 0xff7a2a, 200, 1);
        Sfx.play('fire'); Sfx.play('beam'); p.squash(.8, 1.15);
      }]]
    };
  },
  // 발구름: 땅을 구르면 양옆으로 불기둥이 차례로 솟구친다
  flare_stomp(p) {
    const aw = p.mega.active, sc = p.scene, s = sizeMul(p);
    const erupt = (x, by, set, k) => {
      const gy = sc.groundBelow(x, by - 40);
      if (gy > by + 80) return;   // 낭떠러지 너머로는 번지지 않는다
      const H = (56 + k * 4) * s * (aw ? 1.3 : 1), w = 22 * s;
      sc.combat.hitRect({ x: x - w / 2, y: gy - H, w, h: H }, 2.2, 'fire', { set, burn: 4, kbx: 60, kby: -320, hs: 40 });
      sc.combat.spawnZone({ x: x - w / 2, y: gy - H, w, h: H, life: .32, draw: 'pillar', color: 0xff7a2a });
      sc.combat.spawnZone({ x: x - w / 2, y: gy - 12, w, h: 12, life: 2.5, tick: .4, draw: 'fire', type: 'fire', onTick: z => sc.combat.hitRect(z, .18, 'fire', { burn: 2.5, kbx: 0, kby: 0, hs: 0 }) });
      sc.fx.burst(x, gy - 4, [0xff5a1a, 0xffa03a, 0xffe08a, 0x3a1a10], 12, 120, { up: 240, glow: true, angle: -Math.PI / 2, spread: .5 });
      sc.fx.glow(x, gy - H / 2, H * .5, 0xff5a1a, 260, .9);
      sc.fx.shake(.007, 90); if (k % 2) Sfx.play('fire');
    };
    return {
      dur: .8, mm: 0, anim: 'Strike', inv: .5, ev: [[.22, () => {
        const by = p.bottom, n = aw ? 11 : 8, step = 28 * s, x = p.x;
        sc.combat.hitCircle(x, by - 10, 40 * s, 1.2, 'fire', { burn: 3, kbx: 160, kby: -240, hs: 90 });
        sc.fx.ring(x, by - 4, 46 * s, 0xffa03a, 320); sc.fx.glow(x, by - 6, 50 * s, 0xff5a1a, 320, 1);
        sc.fx.burst(x, by - 2, [0xc0a070, 0xff7a2a, 0xffd04a], 26, 200, { up: 150 });
        sc.cameras.main.flash(120, 255, 150, 80, true); sc.fx.shake(.018, 320);
        Sfx.play('boom'); p.squash(1.4, .68);
        for (const dir of [-1, 1]) { const set = new Set(); for (let k = 1; k <= n; k++) sc.time.delayedCall(k * 65, () => erupt(x + dir * k * step, by, set, k)); }
      }]]
    };
  },

  // ===== 라이코 =====
  thunder_fang(p, i) {
    const aw = p.mega.active;
    const sparks = (sc, x, y, n) => { for (let k = 0; k < n; k++) lineFx(sc, x, y, x + (Math.random() - .5) * 30, y + (Math.random() - .5) * 24, 0xffe040, { seg: 3, jag: 6, ms: 120 }); };
    if (i < 2) return {
      dur: .22, mm: .4, anim: 'Attack', ev: [[.07, () => {
        const n = slashHit(p, { fwd: 14, w: 24, h: 20, mul: 1.05, type: 'electric', status: { paralyze: .2 }, color: 0xffe040, flipV: i === 1 });
        sparks(p.scene, p.x + p.face * 14 * sizeMul(p), p.y - 2, 2); if (n) Sfx.play('zap');
      }]]
    };
    return {
      dur: .32, ctrl: true, anim: 'Strike',
      update(p, a) { p.b.setVelocityX(a.t < .12 ? p.face * 280 : p.b.velocity.x * .75); },
      ev: [[.1, () => {
        const sc = p.scene, s = sizeMul(p), x = p.x + p.face * 16 * s, y = p.y - 2;
        slashHit(p, { fwd: 16, w: 32, h: 26, mul: 1.7, type: 'electric', status: { paralyze: .55 }, kbx: 220, color: 0xfff6a0, arc: 17, thick: 7 });
        sc.fx.slash(x, y + 4 * s, 12 * s, p.face, 0xffe040, { flipV: true, thick: 4 });   // 아래 엄니
        sparks(sc, x, y, 4); sc.fx.glow(x, y, 26 * s, 0xffe040, 200, 1);
        if (aw) { let prev = { x, y }; for (const e of sc.combat.nearest(x, y, 2, 110)) { lineFx(sc, prev.x, prev.y, e.x, e.y, 0xfff6a0, { seg: 6, jag: 10, w: 2, ms: 200 }); sc.combat.damageEnemy(e, p.atk * .8, 'electric', { paralyze: .5, hx: e.x, hy: e.y }); prev = e; } }
        Sfx.play('zap'); Sfx.play('punch');
      }]]
    };
  },
  // 번개: 폭풍을 불러 화면 곳곳에 낙뢰. 같은 적은 0.26초에 한 번만 맞는다
  thunder(p) {
    const aw = p.mega.active, sc = p.scene, s = sizeMul(p);
    const bolt = (x, gy, cool, t) => {
      const v = view(p), top = v.y - 10, w = (aw ? 26 : 18) * s;
      lineFx(sc, x + (Math.random() - .5) * 40, top, x, gy, 0xffe040, { seg: 10, jag: 18, w: (aw ? 5 : 3) * s, ms: 260 });
      if (Math.random() < .6) { const mx = x + (Math.random() - .5) * 20, my = top + (gy - top) * (.3 + Math.random() * .3); lineFx(sc, mx, my, mx + (Math.random() - .5) * 60, my + 40, 0xfff6a0, { seg: 4, jag: 10, ms: 200 }); }
      sc.fx.glow(x, gy - 6, 34 * s, 0xffe040, 240, 1); sc.fx.ring(x, gy - 4, 24 * s, 0xfff6a0, 220);
      sc.fx.burst(x, gy - 2, [0xffe040, 0xffffff], 10, 140, { up: 120, glow: true });
      hitEvery(p, cool, t, .26, { x: x - w / 2, y: top, w, h: gy - top + 4 }, .85, 'electric', { paralyze: .35, kb: 0, kby: -60, hs: 30 });
      if (Math.random() < .3) sc.cameras.main.flash(60, 255, 250, 200, true);
      sc.fx.shake(.006, 90);
      if (Math.random() < .5) Sfx.play('zap');
    };
    return {
      dur: .5, mm: .2, anim: 'Shoot', inv: .3, ev: [[.14, () => {
        const T = aw ? 1.6 : 1.2, cool = new Map();
        let nt = 0;
        sc.cameras.main.flash(200, 30, 30, 70, true); sc.fx.glow(p.x, p.y, 50 * s, 0xffe040, 300, 1);
        lineFx(sc, p.x, p.y - 6, p.x + (Math.random() - .5) * 30, view(p).y - 10, 0xffe040, { seg: 8, jag: 12, w: 3, ms: 240 });   // 하늘로 쏘아 올림
        Sfx.play('thunder');
        tickFor(sc, T, t => {
          if (t < nt) return; nt = t + (aw ? .055 : .075);
          const v = view(p), es = viewEnemies(p), e = es.length && Math.random() < .6 ? es[(Math.random() * es.length) | 0] : null;
          const x = e ? e.x + (Math.random() - .5) * 8 : v.x + Math.random() * v.width;
          bolt(x, e ? sc.groundBelow(x, e.y - 10) : groundAt(p, x), cool, t);
          if (Math.random() < .12) Sfx.play('thunder');
        });
      }]]
    };
  },
  // 와일드볼트: 돌진하며 부딪힌 적에게서 주변 적으로 번개 연쇄. 약간의 반동
  wild_charge(p) {
    const aw = p.mega.active, sc = p.scene, src = new Set(), chained = new Set();
    return dashAction(p, {
      dur: .4, vx: 420, mul: 2.8, type: 'electric', status: { paralyze: .4 }, color: 0xffe040,
      tick(p, a, dt, set) {
        if (!a.go) { a.go = true; sc.fx.glow(p.x, p.y, 34, 0xffe040, 220, 1); Sfx.play('zap'); Sfx.play('dash'); }
        sc.fx.embers(p.x, p.y, [0xffe040, 0xffffff], 2, { speed: 60 });
        a.lt = (a.lt || 0) - dt;
        if (a.lt <= 0) { a.lt = .05; lineFx(sc, p.x + (Math.random() - .5) * 20, p.y + (Math.random() - .5) * 20, p.x + (Math.random() - .5) * 36, p.y + (Math.random() - .5) * 30, 0xfff6a0, { seg: 3, jag: 8, ms: 100 }); }
        for (const e of set) {
          if (src.has(e)) continue;
          src.add(e);
          let prev = e;
          const tg = sc.combat.nearest(e.x, e.y, aw ? 5 : 3, 140).filter(o => o !== e && !set.has(o) && !chained.has(o));
          for (const o of tg) {
            chained.add(o);
            lineFx(sc, prev.x, prev.y, o.x, o.y, 0xffe040, { seg: 7, jag: 12, w: 3, ms: 260 });
            sc.combat.damageEnemy(o, p.atk * 1.6, 'electric', { paralyze: .5, kb: Math.sign(o.x - prev.x || 1) * 120, kby: -100, hx: o.x, hy: o.y });
            sc.fx.glow(o.x, o.y, 24, 0xffe040, 200, 1);
            prev = o;
          }
          if (tg.length) Sfx.play('zap');
        }
      },
      end(p) {
        if (!aw) { p.selfDamage(p.m.maxhp * .03); p.flash(80); }
        sc.fx.burst(p.x, p.y, [0xffe040, 0xffffff], 12, 120, { glow: true });
      }
    });
  },

  // ===== 레쿠쟈 =====
  dragon_claw(p, i) {
    const m = p.mega.active, last = i === 2;
    return {
      dur: last ? .32 : .22, mm: .35, anim: last ? 'Strike' : 'Attack', ev: [[last ? .11 : .07, () => {
        const sc = p.scene, s = sizeMul(p), cx = p.x + p.face * (last ? 18 : 14) * s, cy = p.y - 2;
        slashHit(p, { fwd: last ? 18 : 14, w: last ? 36 : 26, h: last ? 30 : 22, mul: last ? 1.8 : 1.1, type: 'dragon', kbx: last ? 240 : 120, kby: last ? -260 : -80, crit: last ? .2 : .05, color: 0x5aff8a, flipV: i === 1, arc: last ? 18 : 13, thick: last ? 7 : undefined });
        for (const k of [-1, 1]) sc.fx.slash(cx - p.face * 4 * s, cy + k * 6 * s, (last ? 15 : 11) * s, p.face, k > 0 ? 0xffd84a : 0x3ad06a, { flipV: i === 1, thick: 2 });   // 세 줄 발톱
        if (last) {
          sc.fx.glow(cx, cy, 30 * s, 0x3ad06a, 200, .9); sc.fx.shake(.008, 130); Sfx.play('punch');
          if (m) shoot(p, { speed: 320, r: 7, mul: 1.1, type: 'dragon', kind: 'wave', life: .45, pierce: 99, color: 0x5aff8a, oy: -2 });
        }
      }]]
    };
  },
  // 화룡점정: 화면 위로 솟구침 → 표적 위로 이동(낙하 경고) → 내리꽂아 거대한 충격파
  dragon_ascent(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), up = new Set(), down = new Set(), hit = new Set();
    let phase = 0, tx = 0, gy = 0;
    const impact = (p, a) => {
      if (phase === 3) return; phase = 3;
      const r = (m ? 110 : 84) * s, x = p.x, y = p.bottom - 6, v = view(p);
      sc.combat.hitCircle(x, y, r, m ? 4 : 3.4, 'flying', { set: hit, kbx: 300, kby: -340, hs: 140 });
      sc.combat.hitRect({ x: x - r * 2, y: y - 18 * s, w: r * 4, h: 24 * s }, .9, 'flying', { set: hit, stun: .6, kbx: 220, kby: -220 });   // 땅을 타고 번지는 충격
      sc.combat.spawnZone({ x: x - 20 * s, y: v.y - 20, w: 40 * s, h: y - v.y + 20, life: .45, draw: 'pillar', color: 0x5aff8a });
      for (let k = 0; k < 6; k++) sc.time.delayedCall(k * 55, () => sc.fx.ring(x, y, r * (.5 + k * .3), k % 2 ? 0xffd84a : 0x3ad06a, 460));
      sc.fx.glow(x, y, r * 1.4, 0x3ad06a, 600, 1); sc.fx.glow(x, y, r * .7, 0xffd84a, 400, 1);
      sc.fx.burst(x, y, [0x3ad06a, 0x5aff8a, 0xffd84a, 0xffffff], 90, 340 * s, { up: 240, glow: true, life: 1 });
      sc.fx.burst(x, y, [0x8a7a5a, 0xc0a070], 30, 220, { up: 160 });
      for (let k = 0; k < 4; k++) { const lx = x + (Math.random() - .5) * r * 1.6; lineFx(sc, lx, v.y, lx + (Math.random() - .5) * 30, groundAt(p, lx), k % 2 ? 0xffd84a : 0x5aff8a, { seg: 8, jag: 14, w: 3, ms: 320 }); }
      sc.cameras.main.flash(260, 200, 255, 170, true); sc.fx.shake(.026, 460); sc.fx.hitStop(140);
      Sfx.play('boom'); Sfx.play('thunder');
      p.squash(1.5, .62);
      a.dur = Math.min(a.dur, a.t + .3);
    };
    return {
      dur: 1.7, ctrl: true, noGrav: true, anim: 'Attack', inv: 1.8, lockFace: true,
      update(p, a, dt) {
        a.gt = (a.gt || 0) - dt;
        if (a.gt <= 0 && phase !== 1) { a.gt = .025; sc.fx.ghost(p.sprite, phase === 2 ? 0xffd84a : 0x3ad06a, .6, 280); }
        if (phase === 0) {   // ① 하늘로 솟구친다
          if (a.sx === undefined) { a.sx = p.x; a.sy = p.y; sc.fx.ring(p.x, p.bottom, 30 * s, 0x5aff8a, 260); sc.fx.burst(p.x, p.bottom - 2, [0x3ad06a, 0xffd84a], 16, 160, { up: 120 }); Sfx.play('dash'); Sfx.play('beam'); }
          p.b.setVelocity(0, -950);
          sc.combat.hitRect({ x: p.b.x - 8 * s, y: p.b.y - 8 * s, w: p.b.width + 16 * s, h: p.b.height + 16 * s }, 1.2, 'flying', { set: up, kbx: 60, kby: -300 });
          sc.fx.embers(p.x, p.bottom, [0x5aff8a, 0xffd84a], 3, { speed: 50 });
          if (a.t > .38 || p.bottom < view(p).y - 10 || p.b.blocked.up) {
            phase = 1; a.t1 = a.t; p.sprite.setAlpha(0); p.intangible = true; p.b.setVelocity(0, 0);
            const e = sc.combat.nearest(a.sx, a.sy, 1, 420)[0];
            tx = e ? e.x : a.sx + p.face * 90 * s; gy = sc.groundBelow(tx, (e ? e.y : a.sy) - 10);
            if (tx !== a.sx) { p.face = Math.sign(tx - a.sx); p.refacing(); }
          }
        } else if (phase === 1) {   // ② 화면 밖에서 낙하 지점을 노린다 (경고 고리)
          p.b.setVelocity(0, 0); p.sprite.setAlpha(0);
          if (Math.floor(a.t * 30) % 3 === 0) sc.fx.ring(tx, gy - 4, 34 * s, 0x5aff8a, 160);
          if (a.t - a.t1 > .22) {
            const v = view(p), hh = p.b.height / 2;
            let y = gy - hh - 4;
            while (y > v.y - 30 && !sc.isSolidAt(tx, y - hh - 6)) y -= 8;   // 머리 위 천장 아래까지만
            p.b.reset(tx, Math.min(y, gy - hh - 4));
            p.sprite.setAlpha(1); p.intangible = false; phase = 2;
            Sfx.play('dash');
          }
        } else if (phase === 2) {   // ③ 내리꽂기
          p.b.setVelocity(0, 950);   // 너무 빠르면 얇은 발판을 뚫는다
          sc.combat.hitRect({ x: p.b.x - 8 * s, y: p.b.y, w: p.b.width + 16 * s, h: p.b.height + 10 * s }, 1, 'flying', { set: down, kbx: 80, kby: 200 });
          sc.fx.burst(p.x, p.b.y, [0x5aff8a, 0xffd84a, 0xffffff], 4, 50, { up: -60, grav: -60, bounce: false, glow: true, life: .4, size: 2 });
          if (p.b.blocked.down || p.bottom >= gy - 1) impact(p, a);
        } else p.b.setVelocity(0, 0);
      },
      end(p, a) {
        p.sprite.setAlpha(1); p.intangible = false;
        if (phase === 2) impact(p, a);
        p.b.setVelocity(0, 0);
      }
    };
  },
  // 용성군: 화면 위에서 유성이 비스듬히 쏟아진다. 일부는 적을 노리되 적 하나당 3발까지
  draco_meteor(p) {
    const m = p.mega.active, sc = p.scene, s = sizeMul(p), dir = p.face;
    return {
      dur: .55, mm: .2, anim: 'Shoot', ev: [[.18, () => {
        const T = m ? 2 : 1.5, aimed = new Map();
        let nt = 0;
        const orb = sc.add.image(p.x, p.y - 6, 'glow').setTint(0xff7a3a).setBlendMode(ADD).setScale(.6 * s).setDepth(45);
        sc.tweens.add({ targets: orb, y: view(p).y - 40, scale: 1.4 * s, duration: 260, ease: 'Quad.easeIn', onComplete: () => orb.destroy() });   // 하늘로 쏘아 올린 용의 기운
        sc.cameras.main.flash(220, 120, 80, 255, true); sc.fx.shake(.01, 240);
        Sfx.play('beam');
        tickFor(sc, T, t => {
          if (t < .2 || t < nt) return; nt = t + (m ? .05 : .07);
          const v = view(p), es = viewEnemies(p).filter(e => (aimed.get(e) || 0) < 3);
          const e = es.length && Math.random() < .45 ? es[(Math.random() * es.length) | 0] : null;
          if (e) aimed.set(e, (aimed.get(e) || 0) + 1);
          const lx = e ? e.x : v.x + Math.random() * v.width, ly = e ? e.y : groundAt(p, lx);
          const y0 = v.y - 20, vy = 380 + Math.random() * 80, vx = dir * vy * .45, life = Math.max(.05, (ly - y0) / vy);
          sc.combat.spawnProjectile({
            owner: 'player', x: lx - vx * life, y: y0, vx, vy, r: (m ? 7 : 6) * s, mul: 0, type: 'dragon', kind: 'fire', life, ghost: true, pierce: 1,
            color: Math.random() < .5 ? 0xff7a3a : 0x9a6aff, boom: { r: (m ? 34 : 28) * s, mul: .85, kb: 180 }
          });
        });
      }]]
    };
  }
};
