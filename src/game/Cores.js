// 보스의 코어 효과 (data/cores.js · 장착하면 Player.mods.core[flag])
//  갈고리: hit(적중 · Combat.damageEnemy) · amp(피해 배율) · cast(기술 시전 · Player.useSkill) · dash · dive · revive(쓰러지는 순간)
//          projectile(투사체가 생길 때 · Combat.spawnProjectile) · tick(매 프레임 · Player.update) · hurtMul(받는 피해)
import Phaser from 'phaser';
import { Sfx } from '../systems/Audio.js';
import { SKILLS } from '../data/pokemon.js';
import { bolt } from './Perks.js';
import { magmaEruption } from './Spectacle.js';

const RAINBOW = [0xff4a4a, 0xff9a2a, 0xffe04a, 0x6aff6a, 0x4ac8ff, 0x8a6aff, 0xff6ad8];
const has = (p, f) => !!(p && p.mods && p.mods.core && p.mods.core[f]);
const anyStatus = e => { const st = e.status || {}; return st.burn > 0 || st.poison > 0 || st.slow > 0 || st.root > 0 || st.stun > 0 || st.curse > 0; };

export const Cores = {
  // ---- 적중: o.proc(코어·특성이 만든 추가 타격)는 다시 일으키지 않는다 ----
  hit(combat, e, d, type, o) {
    const p = combat.p, sc = combat.s, now = sc.time.now;
    if (!p || o.proc || o.dot) return;
    // 칠색조: 불꽃·비행 → 강한 화상 100%
    if (has(p, 'hooh') && (type === 'fire' || type === 'flying')) { combat.applyStatus(e, { burn: 5 }); e.burnDps = Math.max(e.burnDps || 0, p.atk * .45); }
    // 스이쿤: 물·얼음 → 오로라 파동 (둘레 적 둔화)
    if (has(p, 'suicune') && (type === 'water' || type === 'ice') && now - (e.auroraAt || -999) > 400) {
      e.auroraAt = now;
      for (const q of sc.enemies) if (q.alive && Math.abs(q.x - e.x) < 70 && Math.abs(q.y - e.y) < 60) combat.applyStatus(q, { slow: 3 });
      sc.fx.ring(e.x, e.y, 70, 0x8ae8ff, 420); sc.fx.ring(e.x, e.y, 46, 0xd8b0ff, 360);
      sc.fx.burst(e.x, e.y, [0x8ae8ff, 0xd8b0ff, 0xffffff], 12, 90, { grav: -20, bounce: false, glow: true, life: .6 });
    }
    // 라이코: 전기 기술 · 평타 → 연쇄 번개 3마리
    if (has(p, 'raikou') && (type === 'electric' || (p.action && p.action.comboStep)) && now - (e.chainAt || -999) > 250) {
      e.chainAt = now;
      let from = e;
      const near = sc.enemies.filter(q => q !== e && q.alive && !q.intangible && Math.abs(q.x - e.x) < 150 && Math.abs(q.y - e.y) < 100).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x)).slice(0, 3);
      near.forEach((q, i) => sc.time.delayedCall(60 * (i + 1), () => {
        if (!q.alive) return;
        bolt(sc, from.x, from.y, q.x, q.y, 0xffe86a, 2, 200);
        combat.damageEnemy(q, p.atk * .6, 'electric', { proc: true, paralyze: .3, kb: 0, kby: -40, hs: 0 });
        from = q;
      }));
      if (near.length) Sfx.play('zap');
    }
    // 기라티나: 고스트·드래곤 → 차원 균열, 1초 뒤 암흑 폭발
    if (has(p, 'giratina') && (type === 'ghost' || type === 'dragon') && now - (e.riftAt || -999) > 600) {
      e.riftAt = now;
      const x = e.x, y = e.y, g = sc.add.graphics().setDepth(44).setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(2, 0xff3a5a, .9); g.lineBetween(x - 10, y - 14, x + 4, y - 2); g.lineBetween(x + 4, y - 2, x - 3, y + 6); g.lineBetween(x - 3, y + 6, x + 9, y + 15);
      g.lineStyle(1, 0xffffff, .9); g.lineBetween(x - 10, y - 14, x + 4, y - 2); g.lineBetween(x + 4, y - 2, x - 3, y + 6);
      sc.time.delayedCall(1000, () => {
        g.destroy();
        if (!sc.combat) return;
        sc.combat.hitCircle(x, y, 40, 1.4, 'ghost', { proc: true, kbx: 160, kby: -180, hs: 40 });
        sc.fx.ring(x, y, 40, 0xff3a5a, 300); sc.fx.glow(x, y, 34, 0x2a0612, 300, .9);
        sc.fx.burst(x, y, [0xff3a5a, 0x2a0612, 0x9a5aff], 18, 160, { glow: true, life: .5 });
        Sfx.play('boom');
      });
    }
    // 디아루가: 강철·드래곤 → 시간 정지
    if (has(p, 'dialga') && (type === 'steel' || type === 'dragon') && now - (e.timeAt || -999) > 3000) {
      e.timeAt = now;
      const t = e.boss ? .6 : 1.2;
      e.status.stun = Math.max(e.status.stun, t); e.frozenT = t;
      sc.fx.floatText(e.x, e.top - 12, '시간 정지!', '#9ad8ff', 10);
      sc.fx.ring(e.x, e.y, 32, 0x6ab0ff, 500); sc.fx.ring(e.x, e.y, 20, 0xffffff, 400);
    }
    // 다크라이: 악·고스트 → 25% 악몽(잠듦)
    if (has(p, 'darkrai') && (type === 'dark' || type === 'ghost') && Math.random() < .25 && !(e.status.stun > 0)) {
      e.status.stun = e.boss ? .5 : 1.6;
      sc.fx.floatText(e.x, e.top - 12, '악몽 💤', '#c8a0ff', 10);
      sc.fx.burst(e.x, e.top, [0x8a4ac0, 0x2a0a3a], 8, 30, { grav: -30, bounce: false, glow: true, life: .8 });
    }
    // 한카리아스: 맞힐 때마다 중첩 (최대 7 = 35%)
    if (has(p, 'garchomp')) { p.chomp = Math.min(7, (p.chomp || 0) + 1); p.chompT = 3; }
  },
  // 피해 배율 · 흡혈 (다크라이: 상태이상 걸린 적 +45%)
  amp(combat, e, d) {
    const p = combat.p;
    if (has(p, 'darkrai') && anyStatus(e)) { p.heal(d * 1.45 * .08, true); return 1.45; }
    return 1;
  },
  // ---- 투사체가 생길 때 ----
  projectile(combat, q) {
    const p = combat.p;
    if (!p || q.owner !== 'player') return;
    if (has(p, 'hooh') && (q.type === 'fire' || q.type === 'flying')) { q.color = RAINBOW[(Math.random() * RAINBOW.length) | 0]; q.rainbow = true; }   // 무지갯빛 성스러운 불꽃
    if (has(p, 'palkia') && (q.type === 'water' || q.type === 'dragon')) { q.life *= 1.5; q.r *= 1.5; q.pierce = 99; if (q.boom) q.boom = Object.assign({}, q.boom, { r: q.boom.r * 1.5 }); }
    if (p.deltaT > 0) { q.vx *= 1.5; q.vy *= 1.5; q.r *= 1.5; }   // 레쿠쟈: 델타스트림
  },
  // ---- 기술 시전 (Z 연타 제외) ----
  cast(p, id) {
    const sk = SKILLS[id], sc = p.scene;
    if (!sk) return;
    if (has(p, 'entei') && sk.type === 'fire') this.lava(p);
    if (has(p, 'rayquaza') && (sk.type === 'dragon' || sk.type === 'flying')) {
      if (!(p.deltaT > 0)) { sc.fx.floatText(p.x, p.b.y - 16, '델타스트림!', '#8affb0', 10); Sfx.play('wind'); }
      p.deltaT = 5;
    }
    if (has(p, 'garchomp') && (sk.type === 'ground' || sk.type === 'dragon' || /claw|slash|chop|punch|kick|fang|bite|tackle|tail|blade|cut|strike/.test(id))) {
      const f = p.face;   // 모래폭풍 검기: 앞으로 휘몰아치는 모래 칼날
      sc.combat.spawnProjectile({ owner: 'player', x: p.x + f * 10, y: p.y - 2, vx: f * 380, vy: 0, r: 9, mul: 1.1, type: 'ground', kind: 'wave', color: 0xd8b070, life: .5, pierce: 99, muzzle: false, kb: 120, status: { proc: true, hs: 20 } });
      sc.fx.slash(p.x + f * 14, p.y - 2, 18, f, 0xe8c890, { thick: 3 });
      sc.fx.burst(p.x + f * 14, p.y, [0xd8b070, 0xf8e0b0], 10, 120, { angle: f > 0 ? 0 : Math.PI, spread: .6, glow: false, life: .4 });
    }
  },
  dash(p) {
    if (has(p, 'entei')) this.lava(p);
    if (has(p, 'giratina')) {   // 깨어진 세계로 잠복: 0.5초 완전 무적
      p.inv = Math.max(p.inv, .5); p.sprite.setAlpha(.35);
      p.scene.fx.ring(p.x, p.y, 22, 0xff3a5a, 300);
      p.scene.time.delayedCall(500, () => { if (p.sprite) p.sprite.setAlpha(1); });
    }
  },
  dive(p) { if (has(p, 'entei')) this.lava(p); },
  // 엔테이: 발밑에서 용암 기둥 2번
  lava(p) {
    const sc = p.scene, now = sc.time.now;
    if (now - (p.lavaAt || -999) < 450) return;
    p.lavaAt = now;
    magmaEruption(p, { type: 'fire', n: 2, both: true, mul: .9, proc: true });
  },
  // ---- 쓰러지는 순간 (칠색조: 불사조 부활 · 지방/보스전마다 1번) ----
  revive(p) {
    if (!has(p, 'hooh') || p.rebornUsed) return false;
    const sc = p.scene, m = p.m;
    p.rebornUsed = true;
    m.hp = Math.round(m.maxhp * .5); p.inv = 2.5;
    sc.fx.hitStop(260); sc.cameras.main.flash(500, 255, 200, 120, true); sc.fx.shake(.02, 500);
    for (const side of [-1, 1]) for (let k = 0; k < 6; k++) {   // 불사조 날개: 양옆으로 펼쳐지는 무지개 깃털
      const a = -Math.PI / 2 + side * (.4 + k * .22), x = p.x + Math.cos(a) * 10, y = p.y + Math.sin(a) * 10;
      sc.fx.burst(x, y, [RAINBOW[k], 0xffffff], 6, 160, { angle: a, spread: .25, up: 0, grav: 40, bounce: false, glow: true, life: .9 });
    }
    sc.fx.ring(p.x, p.y, 60, 0xffb040, 600); sc.fx.glow(p.x, p.y, 70, 0xffe0a0, 700, 1);
    sc.events.emit('banner', '불사조의 부활!', '칠색조의 무지개 코어가 다시 일으켜 세웠다 (지방·보스전마다 1번)');
    Sfx.play('mega');
    return true;
  },
  // ---- 매 프레임 ----
  tick(p, dt) {
    if (p.deltaT > 0) {
      p.deltaT -= dt;
      if (!p.onGround && p.b.velocity.y > 0) p.b.setVelocityY(p.b.velocity.y * (1 - Math.min(1, dt * 3)));   // 체공 시간 증가
      if (Math.random() < .5) p.scene.fx.burst(p.x + (Math.random() - .5) * 30, p.y + (Math.random() - .5) * 30, [0x8affb0, 0xffffff], 1, 40, { grav: -10, bounce: false, glow: true, life: .5 });
    }
    if (p.chompT > 0) { p.chompT -= dt; if (p.chompT <= 0) p.chomp = 0; }
  },
  // 받는 피해 배율 (레쿠쟈: 델타스트림 중 공중이면 -30%)
  hurtMul(p) { return p.deltaT > 0 && !p.onGround ? .7 : 1; },
  // 이동 속도 · 재사용 배율 (한카리아스 중첩)
  speedMul(p) { return 1 + (p.chomp || 0) * .05; },
  cdMul(p) { return 1 - (p.chomp || 0) * .05; }
};
