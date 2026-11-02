// 보스의 코어 효과 (data/cores.js · 장착하면 Player.mods.core[flag])
//  갈고리: hit(적중 · Combat.damageEnemy) · amp(피해 배율) · cast(기술 시전 · Player.useSkill) · dash · dive · revive(쓰러지는 순간)
//          projectile(투사체가 생길 때 · Combat.spawnProjectile) · tick(매 프레임 · Player.update) · hurtMul(받는 피해)
//          parry(패링 성공 · Player.doParry) · critMul(급소 피해 배율) · allPlate(모든 공격 약점 판정 — 아르세우스)
//  유대의 불꽃 오버드라이브(GameScene.overdrive · 가라르 진 최종전)도 여기서: 황금빛 · 진홍빛 오라 · 맞힌 자리마다 화염 폭발 · 투사체 색 (피해 2배는 Combat.damageEnemy)
import Phaser from 'phaser';
import { Sfx } from '../systems/Audio.js';
import { SKILLS } from '../data/pokemon.js';
import { bolt } from './Perks.js';
import { magmaEruption } from './Spectacle.js';
import { makeTrainerArt } from './Trainer.js';

const RAINBOW = [0xff4a4a, 0xff9a2a, 0xffe04a, 0x6aff6a, 0x4ac8ff, 0x8a6aff, 0xff6ad8];
const has = (p, f) => !!(p && p.mods && p.mods.core && p.mods.core[f]);
const anyStatus = e => { const st = e.status || {}; return st.burn > 0 || st.poison > 0 || st.slow > 0 || st.root > 0 || st.stun > 0 || st.curse > 0; };
const MELEE = /claw|slash|chop|punch|kick|fang|bite|tackle|tail|blade|cut|strike/;   // 근접(물리) 기술 이름 (한카리아스 · 제크로무 코어)
const BLUE_FLARE = 0x5ab0ff;
const GOLD = 0xffc040, CRIMSON = 0xff3a4a, DMAX = 0xff2a5a;   // 유대의 불꽃 · 다이맥스포
const SKILL_SLOTS = new Set(['x', 'c', 'ult', 'zmove']);
const skillNow = p => !!(p.action && !p.action.comboStep && SKILL_SLOTS.has(p.action.slot));   // 지금 쓰는 기술(X · C · 메가 필살기 · Z기술) — 평타 연타는 빼고

export const Cores = {
  // ---- 적중: o.proc(코어·특성이 만든 추가 타격)는 다시 일으키지 않는다 ----
  hit(combat, e, d, type, o) {
    const p = combat.p, sc = combat.s, now = sc.time.now;
    if (!p || o.proc || o.dot) return;
    // 유대의 불꽃 오버드라이브: 맞힌 자리마다 황금빛 · 진홍빛 화염 폭발 (같은 적은 0.11초에 한 번)
    if (sc.overdrive && now - (e.odAt || -999) > 110) {
      e.odAt = now;
      const x = o.hx ?? e.x, y = o.hy ?? e.y;
      sc.time.delayedCall(40, () => {
        if (!sc.combat || !sc.player) return;
        sc.combat.hitCircle(x, y, 28, .35, 'fire', { proc: true, kbx: 0, kby: -40, hs: 0 });
        sc.fx.ring(x, y, 28, GOLD, 240); sc.fx.glow(x, y, 28, CRIMSON, 220, .9);
        sc.fx.burst(x, y, [GOLD, CRIMSON, 0xffffff], 14, 180, { glow: true, up: 60, life: .45 });
      });
    }
    // 레드의 유대의 불꽃: 기술마다 황금빛 추가 화염 타격 (같은 적은 0.15초에 한 번)
    if (has(p, 'bond') && skillNow(p) && now - (e.bondHitAt || -999) > 150) {
      e.bondHitAt = now;
      sc.time.delayedCall(70, () => {
        if (!e.alive || !sc.combat) return;
        sc.combat.damageEnemy(e, p.atk * .5, 'fire', { proc: true, hs: 0, kb: 0, kby: -30 });
        sc.fx.burst(e.x, e.y, [GOLD, 0xffe8a0, 0xffffff], 10, 120, { angle: -Math.PI / 2, spread: 1, up: 80, glow: true, life: .45 });
        sc.fx.glow(e.x, e.y, 22, GOLD, 200, .9);
      });
    }
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
    // 큐레무: 얼음·드래곤 → 35% 즉시 빙결 (보스는 짧게)
    if (has(p, 'kyurem') && (type === 'ice' || type === 'dragon') && Math.random() < .35 && !(e.frozenT > 0)) combat.applyStatus(e, { freeze: e.boss ? 1.6 : 1.4 });
  },
  // 급소 피해 배율 (큐레무: 빙결 · 둔화된 적 +60%)
  critMul(combat, e) {
    return has(combat.p, 'kyurem') && (e.frozenT > 0 || (e.status && e.status.slow > 0)) ? 1.6 : 1;
  },
  // 아르세우스: 올라운드 플레이트 — 모든 공격이 약점 판정
  allPlate(p) { return has(p, 'arceus'); },
  // 피해 배율 · 흡혈 (다크라이: 상태이상 걸린 적 +45%)
  amp(combat, e, d) {
    const p = combat.p;
    let k = has(p, 'dynamax') && e.boss ? 1.5 : 1;   // 무한다이노의 다이맥스 코어: 보스에게 주는 피해 +50%
    if (has(p, 'darkrai') && anyStatus(e)) { p.heal(d * k * 1.45 * .08, true); k *= 1.45; }
    return k;
  },
  // ---- 투사체가 생길 때 ----
  projectile(combat, q) {
    const p = combat.p;
    if (!p || q.owner !== 'player') return;
    if (has(p, 'hooh') && (q.type === 'fire' || q.type === 'flying')) { q.color = RAINBOW[(Math.random() * RAINBOW.length) | 0]; q.rainbow = true; }   // 무지갯빛 성스러운 불꽃
    if (has(p, 'palkia') && (q.type === 'water' || q.type === 'dragon')) { q.life *= 1.5; q.r *= 1.5; q.pierce = 99; if (q.boom) q.boom = Object.assign({}, q.boom, { r: q.boom.r * 1.5 }); }
    if (p.deltaT > 0) { q.vx *= 1.5; q.vy *= 1.5; q.r *= 1.5; }   // 레쿠쟈: 델타스트림
    if (has(p, 'dynamax') && (combat.chargeSpawn || skillNow(p)) && !q.bonus) {   // 무한다이노: 차징 샷 · 기술이 거대한 다이맥스포로 — 굵게 · 멀리 · 관통 · 폭발 범위 2배 (폭발탄이 아니면 사라지는 자리에서 터진다)
      q.color = DMAX; q.r *= 1.8; q.life *= 1.3; q.pierce = Math.max(q.pierce, 6); q.dmax = true;
      if (q.boom) q.boom = Object.assign({}, q.boom, { r: q.boom.r * 2 });
      else { const end = q.onExpire; q.onExpire = qq => { if (end) end(qq); this.dmaxBlast(combat.s, qq.x, qq.y, qq.type); }; }
    }
    if (combat.s.overdrive && !q.blueFlare && !q.dmax) q.color = Math.random() < .5 ? GOLD : CRIMSON;   // 유대의 불꽃 오버드라이브: 황금빛 · 진홍빛 탄
    if (has(p, 'reshiram') && (q.type === 'fire' || q.type === 'dragon' || combat.chargeSpawn)) {   // 레시라무: 초고온의 푸른 불꽃 — 반감 · 무효 · 방어 자세 무시 · 떨어진 자리에 푸른 화염 장판
      q.color = BLUE_FLARE; q.blueFlare = true;
      q.status = Object.assign({}, q.status, { ignoreResist: true, pierceGuard: true });
      const end = q.onExpire;
      q.onExpire = qq => { if (end) end(qq); this.blueFlare(combat.s, qq.x, qq.y); };
    }
  },
  // 레시라무: 3초간 타오르는 푸른 화염 장판 (같은 자리에 겹쳐 깔리지 않게 0.25초에 하나)
  blueFlare(sc, x, y) {
    const p = sc.player, now = sc.time.now;
    if (!p || !sc.combat || now - (p.flareAt || -999) < 250) return;
    p.flareAt = now;
    const gy = sc.groundBelow(x, y - 4);
    if (gy - y > 120) return;   // 허공 높이에서 사라진 탄은 장판을 깔지 않는다
    sc.combat.spawnZone({ owner: 'player', x: x - 28, y: gy - 14, w: 56, h: 14, life: 3, tick: .3, type: 'fire', color: BLUE_FLARE, draw: 'fire',
      onTick: z => sc.combat.hitRect({ x: z.x, y: z.y - 6, w: z.w, h: z.h + 6 }, .25, 'fire', { proc: true, burn: 2, ignoreResist: true, pierceGuard: true, kbx: 0, kby: 0, hs: 0 }) });
    sc.fx.burst(x, gy - 4, [BLUE_FLARE, 0xd8f0ff, 0xffffff], 8, 80, { angle: -Math.PI / 2, spread: .8, up: 50, glow: true, life: .5 });
  },
  // 무한다이노: 다이맥스포가 사라지는 자리의 폭발 (반지름 2배 · 0.12초에 한 번)
  dmaxBlast(sc, x, y, type) {
    const p = sc.player, now = sc.time.now;
    if (!p || !sc.combat || now - (p.dmaxBoomAt || -999) < 120) return;
    p.dmaxBoomAt = now;
    sc.combat.hitCircle(x, y, 40, .6, type, { proc: true, kbx: 160, kby: -160, hs: 0 });
    sc.fx.ring(x, y, 40, DMAX, 280); sc.fx.glow(x, y, 40, DMAX, 260, .9);
    sc.fx.burst(x, y, [DMAX, 0xff8aa0, 0xffffff], 18, 200, { glow: true, up: 60, life: .5 });
    Sfx.play('boom');
  },
  // 무한다이노: 기술을 쓰면 앞으로 거대한 다이맥스포 광선 (벽에서 멈춘다 · 끝에서 폭발)
  dynamaxBeam(p) {
    const sc = p.scene, now = sc.time.now;
    if (now - (p.dmaxAt || -999) < 300) return;
    p.dmaxAt = now;
    const f = p.face, x0 = p.x + f * 8, y = p.y - 4;
    let len = 0; while (len < 320 && !sc.isSolidAt(x0 + f * (len + 8), y)) len += 8;
    const x1 = x0 + f * len, g = sc.add.graphics().setDepth(31).setBlendMode(Phaser.BlendModes.ADD);
    for (const [w, col, a] of [[26, DMAX, .22], [14, DMAX, .7], [6, 0xffd0d8, .95], [2, 0xffffff, 1]]) { g.lineStyle(w, col, a); g.lineBetween(x0, y, x1, y); }
    sc.tweens.add({ targets: g, alpha: 0, duration: 340, onComplete: () => g.destroy() });
    if (len > 0) sc.combat.hitRect({ x: Math.min(x0, x1), y: y - 13, w: len, h: 26 }, .8, p.types[0], { proc: true, kbx: 200, kby: -60, hs: 30, heavy: true, fromX: p.x });
    this.dmaxBlast(sc, x1, y, p.types[0]);
    sc.fx.ring(x0, y, 18, DMAX, 200); sc.fx.shake(.008, 160);
    Sfx.play('beam');
  },
  // ---- 기술 시전 (Z 연타 제외) ----
  cast(p, id) {
    const sk = SKILLS[id], sc = p.scene;
    if (!sk) return;
    if (has(p, 'dynamax')) this.dynamaxBeam(p);
    if (has(p, 'entei') && sk.type === 'fire') this.lava(p);
    if (has(p, 'rayquaza') && (sk.type === 'dragon' || sk.type === 'flying')) {
      if (!(p.deltaT > 0)) { sc.fx.floatText(p.x, p.b.y - 16, '델타스트림!', '#8affb0', 10); Sfx.play('wind'); }
      p.deltaT = 5;
    }
    if (has(p, 'zekrom') && (sk.type === 'electric' || sk.type === 'dragon' || MELEE.test(id))) this.crossThunder(p);   // 제크로무: 크로스썬더
    if (has(p, 'reshiram') && (sk.type === 'fire' || sk.type === 'dragon')) this.blueFlare(sc, p.x + p.face * 30, p.y);   // 레시라무: 앞 바닥에 푸른 화염
    if (has(p, 'arceus')) {   // 아르세우스: 심판의뭉치 — 빛의 탄환 3발이 유도탄으로
      const f = p.face;
      for (let k = 0; k < 3; k++) sc.combat.spawnProjectile({ owner: 'player', bonus: true, x: p.x + f * 6, y: p.y - 8, vx: f * (160 + k * 30), vy: -150 + k * 110, r: 5, mul: .55, type: p.types[0], kind: 'ball', color: 0xfff0b0, life: 1.6, homing: 1.6, pierce: 1, light: k === 1, status: { proc: true } });
      sc.fx.ring(p.x, p.y - 8, 20, 0xfff0b0, 240);
    }
    if (has(p, 'garchomp') && (sk.type === 'ground' || sk.type === 'dragon' || MELEE.test(id))) {
      const f = p.face;   // 모래폭풍 검기: 앞으로 휘몰아치는 모래 칼날
      sc.combat.spawnProjectile({ owner: 'player', x: p.x + f * 10, y: p.y - 2, vx: f * 380, vy: 0, r: 9, mul: 1.1, type: 'ground', kind: 'wave', color: 0xd8b070, life: .5, pierce: 99, muzzle: false, kb: 120, status: { proc: true, hs: 20 } });
      sc.fx.slash(p.x + f * 14, p.y - 2, 18, f, 0xe8c890, { thick: 3 });
      sc.fx.burst(p.x + f * 14, p.y, [0xd8b070, 0xf8e0b0], 10, 120, { angle: f > 0 ? 0 : Math.PI, spread: .6, glow: false, life: .4 });
    }
  },
  // 제크로무: 몸 둘레에 X 자로 교차하는 푸른 번개가 터진다
  crossThunder(p) {
    const sc = p.scene, now = sc.time.now;
    if (now - (p.crossAt || -999) < 350) return;
    p.crossAt = now;
    const x = p.x, y = p.y, R = 46;
    for (const [a, b] of [[-1, -1], [1, -1]]) bolt(sc, x + a * R, y + b * R * .8, x - a * R, y - b * R * .8, 0x6ab0ff, 3, 220);
    sc.combat.hitCircle(x, y, R, .9, 'electric', { proc: true, paralyze: .25, kbx: 140, kby: -120, hs: 20 });
    sc.fx.ring(x, y, R, 0x6ab0ff, 260); sc.fx.glow(x, y, 30, 0xb8d8ff, 200, .9);
    Sfx.play('zap');
  },
  // ---- 패링 성공 (제크로무: 화면 안 모든 적에게 낙뢰 · 5초간 공격 속도 +40% · 레드의 유대의 불꽃: 레드의 환영이 합동 카운터) ----
  parry(p) {
    if (has(p, 'bond')) this.bondCounter(p);
    if (!has(p, 'zekrom')) return;
    const sc = p.scene, v = sc.cameras.main.worldView;
    p.boltT = 5;
    const k = (p.parryChain && p.parryChain.dmg) || 1;   // 연속 패링 점감 (Player.parryChainStep)
    for (const e of sc.enemies) {
      if (!e.alive || e.intangible || e.x < v.x || e.x > v.right || e.y < v.y || e.y > v.bottom) continue;
      bolt(sc, e.x + (Math.random() - .5) * 20, v.y - 4, e.x, e.y, 0x8ab0ff, 3, 260);
      sc.combat.damageEnemy(e, p.atk * 1.2 * k, 'electric', { proc: true, paralyze: .5, kb: 0, kby: -60, hs: 0 });
    }
    sc.cameras.main.flash(120, 120, 170, 255, true); Sfx.play('thunder');
    sc.fx.floatText(p.x, p.b.y - 34, '⚡ 크로스썬더 · 공격 속도 +40%', '#8ac8ff', 10);
  },
  // 레드의 유대의 불꽃: 패링 순간 등 뒤에 레드의 황금빛 환영이 나타나, 가장 가까운 보스(없으면 적)에게 화염 합동 일격 (1.2초에 한 번)
  bondCounter(p) {
    const sc = p.scene, now = sc.time.now;
    if (now - (p.bondAt || -999) < 1200 || !sc.combat) return;
    const tgt = (sc.bosses || []).find(b => b.alive && !b.intangible) || sc.combat.nearest(p.x, p.y, 1, 420)[0];
    if (!tgt) return;
    p.bondAt = now;
    makeTrainerArt(sc, 'red');
    const gx = p.x - p.face * 26, gy = p.bottom, right = tgt.x > gx;
    const ghost = sc.add.image(gx, gy, 'trainer:red:free').setOrigin(.5, 1).setScale(2).setTintFill(0xffd070).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(30).setFlipX(right);
    sc.tweens.add({ targets: ghost, alpha: .75, duration: 140 });
    sc.fx.floatText(gx, gy - 100, '레드: 지금이다!', '#ffd070', 10);
    sc.time.delayedCall(260, () => {
      if (!ghost.scene) return;
      sc.tweens.add({ targets: ghost, alpha: 0, y: gy - 12, delay: 260, duration: 400, onComplete: () => ghost.destroy() });
      if (!tgt.alive || !sc.combat) return;
      const hx = gx + (right ? 14 : -14), hy = gy - 56, g = sc.add.graphics().setDepth(31).setBlendMode(Phaser.BlendModes.ADD);
      for (const [w, col, a] of [[14, CRIMSON, .35], [7, GOLD, .85], [2, 0xffffff, 1]]) { g.lineStyle(w, col, a); g.lineBetween(hx, hy, tgt.x, tgt.y); }
      sc.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
      const ch = p.parryChain || { dmg: 1, stag: 1 };   // 연속 패링 점감
      sc.combat.damageEnemy(tgt, p.atk * 3 * ch.dmg, 'fire', { proc: true, hs: 70, heavy: true, kb: 0, kby: 0, hx: tgt.x, hy: tgt.y });
      if (tgt.boss && tgt.addStaggerRaw && ch.stag > 0) tgt.addStaggerRaw(12 * ch.stag);
      sc.fx.ring(tgt.x, tgt.y, 50, GOLD, 380); sc.fx.ring(tgt.x, tgt.y, 30, CRIMSON, 300);
      sc.fx.burst(tgt.x, tgt.y, [GOLD, CRIMSON, 0xffffff], 30, 240, { glow: true, up: 80, life: .6 });
      Sfx.play('fire'); Sfx.play('boom');
    });
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
    this.bondAura(p, dt);
    if (p.boltT > 0) { p.boltT -= dt; if (Math.random() < .3) p.scene.fx.burst(p.x + (Math.random() - .5) * 24, p.y + (Math.random() - .5) * 24, [0x8ac8ff, 0xffffff], 1, 50, { up: 0, grav: 0, bounce: false, glow: true, life: .15, size: 1 }); }   // 제크로무: 공격 속도 +40%
    if (p.deltaT > 0) {
      p.deltaT -= dt;
      if (!p.onGround && p.b.velocity.y > 0) p.b.setVelocityY(p.b.velocity.y * (1 - Math.min(1, dt * 3)));   // 체공 시간 증가
      if (Math.random() < .5) p.scene.fx.burst(p.x + (Math.random() - .5) * 30, p.y + (Math.random() - .5) * 30, [0x8affb0, 0xffffff], 1, 40, { grav: -10, bounce: false, glow: true, life: .5 });
    }
    if (p.chompT > 0) { p.chompT -= dt; if (p.chompT <= 0) p.chomp = 0; }
  },
  // 유대의 불꽃 오라 (레드의 유대의 불꽃 유물 · 오버드라이브): 몸을 감싸 일렁이는 황금빛 · 진홍빛 두 겹 + 피어오르는 불티 (오버드라이브는 더 짙게)
  bondAura(p, dt) {
    const sc = p.scene, od = !!sc.overdrive, on = od || has(p, 'bond');
    if (!on && !p.bondGlow) return;
    if (!p.bondGlow || !p.bondGlow[0].scene) p.bondGlow = [GOLD, CRIMSON].map(c => sc.add.image(p.x, p.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(c).setAlpha(0).setDepth(19.4));
    const t = sc.time.now / 1000, k = on ? (od ? 1 : .6) : 0;
    p.bondGlow.forEach((o, i) => o.setVisible(k > 0).setPosition(p.x, p.y - 4).setScale((i ? 1.5 : 1.15) * (1 + Math.sin(t * (3 + i)) * .08)).setAlpha(k * (i ? .22 : .3) * (.8 + Math.sin(t * 5 + i) * .2)));
    if (k > 0 && Math.random() < (od ? .7 : .35)) sc.fx.burst(p.x + (Math.random() - .5) * 22, p.bottom - Math.random() * 26, [GOLD, CRIMSON, 0xffe8a0], 1, 30, { angle: -Math.PI / 2, spread: .6, up: 50, grav: -40, bounce: false, glow: true, life: .6, size: Math.random() < .3 ? 2 : 1 });
  },
  // 받는 피해 배율 (레쿠쟈: 델타스트림 중 공중이면 -30%)
  hurtMul(p) { return p.deltaT > 0 && !p.onGround ? .7 : 1; },
  // 이동 속도 · 재사용 배율 (한카리아스 중첩)
  speedMul(p) { return 1 + (p.chomp || 0) * .05; },
  cdMul(p) { return 1 - (p.chomp || 0) * .05; }
};
