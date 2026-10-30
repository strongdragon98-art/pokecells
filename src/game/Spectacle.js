// 대형 연출 — 유니크·전설 등급 기술 카드 · 메가 전용 필살기(R) · 진화 단계별 평타 강화가 함께 쓴다
//  cinematic        전설 컷인: 0.15초 시간 정지 + 화면이 어두워지고 시전자에게 스포트라이트 + 기술 이름 띠
//  magicCircle      유니크 시전 마법진: 발밑에 속성색 원진이 펼쳐지고 충격파 고리
//  megaBeam         화면 절반을 덮는 초대형 레이저 · meteorRain 하늘에서 쏟아지는 거대 운석
//  lightningPillars 번개(물이면 물기둥) 기둥 연쇄 · magmaEruption 지면을 쪼개는 분출(불이면 마그마, 그 밖엔 속성 기운)
//  bladeStorm       화면을 가르는 거대 검기 난무 · eclipse 검은 태양이 빨아들였다 터진다 · nova 별빛 대폭발
//  legendFinisher   기술 형태·속성으로 위 중 하나를 고른다 · MEGA_ULT 라인별 메가 필살기 정의 · megaUltAction 행동 객체
import Phaser from 'phaser';
import { typeColor } from '../data/types.js';
import { Sfx } from '../systems/Audio.js';
import { shockwave } from '../systems/PostFX.js';
import { lineFx } from './skills.js';

const ADD = Phaser.BlendModes.ADD;
const sz = p => p.mods.sizeMul * p.fxMul;

// 카메라를 따라다니는 화면 덮개 (ms 뒤 사라짐)
function screenRect(sc, color, alpha, ms, depth = 39) {
  const v0 = sc.cameras.main.worldView, r = sc.add.rectangle(v0.x - 40, v0.y - 40, v0.width + 80, v0.height + 80, color, alpha).setOrigin(0).setDepth(depth);
  const fit = () => { if (!r.scene) { sc.events.off('update', fit); return; } const v = sc.cameras.main.worldView; r.setPosition(v.x - 40, v.y - 40); };
  sc.events.on('update', fit);
  sc.tweens.add({ targets: r, alpha: 0, delay: ms * .6, duration: ms * .4, onComplete: () => { sc.events.off('update', fit); r.destroy(); } });
  return r;
}

// ---------------- 전설 컷인 ----------------
export function cinematic(p, color, title) {
  const sc = p.scene, col = color ?? typeColor(p.types[0]);
  sc.fx.hitStop(150);                                    // 0.15초 시간 정지
  screenRect(sc, 0x05030a, .62, 520, 39);                // 화면이 어두워지고
  const spot = sc.add.image(p.x, p.y, 'glow').setBlendMode(ADD).setTint(col).setScale(3.2).setAlpha(.85).setDepth(39.5);   // 시전자에게 스포트라이트
  sc.tweens.add({ targets: spot, scale: 5, alpha: 0, duration: 560, onComplete: () => spot.destroy() });
  for (let k = 0; k < 8; k++) {   // 집중선
    const a = k / 8 * Math.PI * 2;
    lineFx(sc, p.x + Math.cos(a) * 140, p.y + Math.sin(a) * 90, p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 20, k % 2 ? 0xffffff : col, { seg: 2, jag: 0, w: 2, ms: 260 });
  }
  if (title) sc.events.emit('cutin', title, col);
  sc.cameras.main.flash(140, 255, 255, 255, true);
  Sfx.play('card_legend');
}

// ---------------- 유니크 마법진 ----------------
export function magicCircle(p, color) {
  const sc = p.scene, col = color ?? typeColor(p.types[0]), s = sz(p), x = p.x, y = p.bottom - 1, R = 34 * s;
  const g = sc.add.graphics().setDepth(19).setBlendMode(ADD);
  const draw = k => {
    g.clear();
    g.lineStyle(2, col, .9 * k); g.strokeEllipse(x, y, R * 2, R * .55);
    g.lineStyle(1, 0xffffff, .7 * k); g.strokeEllipse(x, y, R * 1.45, R * .4);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + sc.time.now / 300; g.fillStyle(i % 2 ? col : 0xffffff, k); g.fillRect(x + Math.cos(a) * R - 1.5, y + Math.sin(a) * R * .27 - 1.5, 3, 3); }
  };
  const st = { k: 1 };
  sc.tweens.add({ targets: st, k: 0, duration: 700, onUpdate: () => draw(st.k), onComplete: () => g.destroy() });
  draw(1);
  sc.fx.ring(p.x, p.y, 40 * s, col, 360); sc.fx.ring(p.x, p.y, 26 * s, 0xc08aff, 300);
  sc.cameras.main.flash(120, 170, 90, 255, true);   // 화면 외곽 보랏빛 번짐
  sc.fx.shake(.008, 160, 'hit');
}

// ---------------- 초대형 레이저 ----------------
export function megaBeam(p, o = {}) {
  const sc = p.scene, col = o.color ?? typeColor(o.type), f = p.face, v = sc.cameras.main.worldView, x0 = p.x + f * 12, y = p.y - 4;
  const len = Math.max(260, v.width * .9), hh = (o.hh ?? 26) * Math.max(1, sz(p) * .8), L = f > 0 ? x0 : x0 - len;
  const g = sc.add.graphics().setDepth(43).setBlendMode(ADD), set = new Set(), st = { t: 0 };
  const T = o.dur ?? .7;
  sc.tweens.add({ targets: st, t: 1, duration: T * 1000, onUpdate: () => {
    const k = Math.min(1, st.t * 6, (1 - st.t) * 4), w = hh * k;
    g.clear();
    g.fillStyle(col, .35); g.fillRect(L, y - w * 1.5, len, w * 3);
    g.fillStyle(col, .8); g.fillRect(L, y - w, len, w * 2);
    g.fillStyle(0xffffff, 1); g.fillRect(L, y - w * .4, len, w * .8);
    g.fillStyle(0xffffff, .9); g.fillCircle(x0, y, w * 1.6);
    if (Math.random() < .8) sc.fx.burst(L + Math.random() * len, y + (Math.random() - .5) * w * 2, [col, 0xffffff], 2, 80, { grav: 0, bounce: false, glow: true, life: .3, size: 2 });
  }, onComplete: () => g.destroy() });
  for (let k = 0; k < 5; k++) sc.time.delayedCall(k * (T * 1000 / 5), () => {
    set.clear();
    sc.combat.hitRect({ x: L, y: y - hh * 1.4, w: len, h: hh * 2.8 }, (o.mul ?? 2) / 5, o.type, Object.assign({ set, kbx: 60, kby: -40, hs: 25, fromX: p.x, proc: o.proc }, o.status || {}));
  });
  shockwave(sc, x0, y, .04, 600); sc.fx.shake(.02, T * 1000, 'hit'); Sfx.play('beam'); Sfx.play('boom');
}

// ---------------- 거대 운석 ----------------
export function meteorRain(p, o = {}) {
  const sc = p.scene, col = o.color ?? typeColor(o.type), v = sc.cameras.main.worldView, n = o.n ?? 5;
  for (let k = 0; k < n; k++) {
    const x = p.x + p.face * (40 + k * 46) + (Math.random() - .5) * 30, gy = sc.groundBelow(x, p.y - 30), r = 14 + Math.random() * 6;
    sc.fx.glow(x, gy - 2, 20, col, 400, .6);
    sc.time.delayedCall(180 + k * 130, () => {
      if (!p.scene) return;
      sc.combat.spawnProjectile({ owner: 'player', x: x - p.face * 60, y: v.y - 20, vx: p.face * 120, vy: 560, r, mul: (o.mul ?? 2) / n, type: o.type, kind: 'rock', color: col, life: 2, ghost: true, muzzle: false, tier: 3, pow: 2.2, light: true,
        boom: { r: 46, mul: (o.mul ?? 2) / n, kb: 220 }, status: Object.assign({ proc: o.proc }, o.status || {}),
        update: q => { sc.fx.burst(q.x, q.y - q.r, [col, 0xffd07a, 0x4a3020], 2, 40, { angle: -Math.PI / 2, spread: .5, grav: 0, bounce: false, glow: true, life: .35, size: 2 }); if (q.y >= gy - 8) q.kill = 'wall'; } });
    });
  }
  sc.time.delayedCall(220, () => sc.fx.shake(.02, 800, 'hit'));
  Sfx.play('thunder');
}

// ---------------- 번개 · 물기둥 ----------------
export function lightningPillars(p, o = {}) {
  const sc = p.scene, col = o.color ?? typeColor(o.type), v = sc.cameras.main.worldView, n = o.n ?? 6, water = o.type === 'water';
  for (let k = 0; k < n; k++) sc.time.delayedCall(80 + k * 90, () => {
    if (!p.scene) return;
    const x = p.x + p.face * (30 + k * 38), gy = sc.groundBelow(x, p.y - 30), top = water ? gy - 150 : v.y - 10, w = 22;
    sc.combat.hitRect({ x: x - w / 2, y: top, w, h: gy - top }, (o.mul ?? 2) / n, o.type, Object.assign({ kbx: 40, kby: -260, hs: 35, fromX: x, proc: o.proc }, o.status || {}));
    const g = sc.add.graphics().setDepth(42).setBlendMode(ADD);
    for (const [lw, c, a] of [[w * 1.4, col, .3], [w * .8, col, .85], [w * .3, 0xffffff, 1]]) { g.fillStyle(c, a); g.fillRect(x - lw / 2, top, lw, gy - top); }
    sc.tweens.add({ targets: g, alpha: 0, duration: 340, onComplete: () => g.destroy() });
    if (!water) lineFx(sc, x + (Math.random() - .5) * 30, top, x, gy, 0xffffff, { seg: 8, jag: 14, w: 3, ms: 260 });
    sc.fx.burst(x, gy - 2, [col, 0xffffff], 16, 160, { up: 140, glow: true }); sc.fx.ring(x, gy - 4, 30, col, 280);
    sc.fx.shake(.008, 100, 'hit'); Sfx.play(water ? 'water' : 'zap');
  });
  Sfx.play('thunder');
}

// ---------------- 지면 분출 ----------------
export function magmaEruption(p, o = {}) {
  const sc = p.scene, col = o.color ?? typeColor(o.type), n = o.n ?? 7, magma = o.type === 'fire' || o.type === 'ground';
  const hot = magma ? [0xff3a1a, 0xff9a2a, 0xffe08a] : [col, 0xffffff, col];
  for (const d of o.both ? [-1, 1] : [p.face]) for (let k = 0; k < n; k++) sc.time.delayedCall(60 + k * 75, () => {
    if (!p.scene) return;
    const x = p.x + d * (26 + k * 30), gy = sc.groundBelow(x, p.y - 30), h = 70 + k * 8, w = 20;
    lineFx(sc, x - 14, gy - 1, x + 14, gy - 1, hot[0], { seg: 5, jag: 4, w: 2, ms: 300 });   // 지면 균열
    sc.combat.hitRect({ x: x - w / 2, y: gy - h, w, h }, (o.mul ?? 2) / n, o.type, Object.assign({ kbx: 30, kby: -320, hs: 30, fromX: x, proc: o.proc }, magma ? { burn: 3 } : {}, o.status || {}));
    const g = sc.add.graphics().setDepth(42).setBlendMode(ADD).setPosition(x, gy);
    g.fillStyle(hot[0], .5); g.fillTriangle(-w, 0, w, 0, 0, -h * 1.1);
    g.fillStyle(hot[1], .9); g.fillTriangle(-w * .6, 0, w * .6, 0, 0, -h);
    g.fillStyle(hot[2], 1); g.fillTriangle(-w * .25, 0, w * .25, 0, 0, -h * .8);
    g.setScale(1, 0);
    sc.tweens.add({ targets: g, scaleY: 1, duration: 90, ease: 'Back.easeOut' });
    sc.tweens.add({ targets: g, alpha: 0, scaleY: .3, delay: 240, duration: 260, onComplete: () => g.destroy() });
    sc.fx.burst(x, gy - 4, hot, 14, 200, { angle: -Math.PI / 2, spread: .8, up: 220, grav: 500, life: .7, size: 2 });
    sc.fx.shake(.009, 100, 'hit'); Sfx.play(magma ? 'fire' : 'boom');
  });
}

// ---------------- 검기 난무 ----------------
export function bladeStorm(p, o = {}) {
  const sc = p.scene, col = o.color ?? typeColor(o.type), s = sz(p), n = o.n ?? 6;
  for (let k = 0; k < n; k++) sc.time.delayedCall(k * 70, () => {
    if (!p.scene) return;
    const cx = p.x + p.face * (40 + k * 26) * Math.max(1, s * .7), cy = p.y - 6 + (k % 2 ? -10 : 10), r = 34 * Math.max(1, s * .8);
    sc.fx.slash(cx, cy, r, p.face, col, { thick: 9, flipV: k % 2 === 1 });
    sc.combat.hitRect({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, (o.mul ?? 2) / n, o.type, Object.assign({ kbx: 120, kby: -80, hs: 25, proc: o.proc }, o.status || {}));
    Sfx.play('swing');
  });
  sc.fx.shake(.012, 420, 'hit');
}

// ---------------- 검은 태양 ----------------
export function eclipse(p, o = {}) {
  const sc = p.scene, col = o.color ?? typeColor(o.type), x = p.x + p.face * 90, y = p.y - 30, R = 80;
  const core = sc.add.image(x, y, 'glow').setTint(0x05000a).setScale(.2).setDepth(41), rim = sc.add.image(x, y, 'glow').setBlendMode(ADD).setTint(col).setScale(.3).setDepth(40.9);
  sc.tweens.add({ targets: core, scale: 2.4, duration: 600, ease: 'Cubic.easeOut' });
  sc.tweens.add({ targets: rim, scale: 3.6, duration: 600, ease: 'Cubic.easeOut' });
  screenRect(sc, 0x10001a, .35, 1100, 38.5);
  let n = 0;
  const ev = sc.time.addEvent({ delay: 120, repeat: 7, callback: () => {
    n++;
    for (const e of sc.enemies) if (e.alive && !e.boss) { const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy); if (d < 200 && d > 8) e.b.setVelocity(dx / d * 180, dy / d * 180); }
    sc.combat.hitCircle(x, y, R, (o.mul ?? 2) * .06, o.type, { kbx: 0, kby: 0, hs: 0, proc: o.proc });
    if (n === 8) {
      sc.combat.hitCircle(x, y, R * 1.4, (o.mul ?? 2) * .52, o.type, Object.assign({ kbx: 300, kby: -240, hs: 100, proc: o.proc }, o.status || {}));
      sc.fx.ring(x, y, R * 1.6, col, 420); sc.fx.burst(x, y, [col, 0xffffff, 0x2a0a3a], 50, 300, { glow: true, grav: 0, bounce: false, life: .7 });
      shockwave(sc, x, y, .05, 700); sc.fx.shake(.024, 500, 'hit'); Sfx.play('boom');
      sc.tweens.add({ targets: [core, rim], scale: 0, alpha: 0, duration: 220, onComplete: () => { core.destroy(); rim.destroy(); } });
      ev.remove();
    }
  } });
  Sfx.play('ghost');
}

// ---------------- 별빛 대폭발 ----------------
export function nova(p, o = {}) {
  const sc = p.scene, col = o.color ?? typeColor(o.type), R = (o.R ?? 120) * Math.max(1, sz(p) * .7);
  for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 110, () => {
    if (!p.scene) return;
    sc.combat.hitCircle(p.x, p.y, R * (.45 + k * .2), (o.mul ?? 2) / 4, o.type, Object.assign({ kbx: 240, kby: -220, hs: 40, proc: o.proc }, o.status || {}));
    sc.fx.ring(p.x, p.y, R * (.5 + k * .25), k % 2 ? 0xffffff : col, 380);
    sc.fx.burst(p.x, p.y, [col, 0xffffff, 0xffd0f0], 20, 260, { glow: true, grav: 0, bounce: false, life: .6 });
  });
  shockwave(sc, p.x, p.y, .045, 750); sc.fx.shake(.02, 520, 'hit'); Sfx.play('boom');
}

// ---------------- 전설 등급 기술 카드: 기술 형태·속성으로 마무리 대연출 고르기 ----------------
export function legendFinisher(p, type, arch, mul = 1.6) {
  const o = { type, mul, proc: true };
  if (['beam', 'projectile', 'homing', 'boomerang', 'ring', 'volley'].includes(arch) && !['rock', 'ground'].includes(type)) return megaBeam(p, o);
  if (['electric', 'flying'].includes(type) || arch === 'sky') return lightningPillars(p, o);
  if (type === 'water') return lightningPillars(p, o);
  if (['rock', 'dragon', 'steel', 'ice', 'psychic', 'fairy'].includes(type) || arch === 'sky_fall') return meteorRain(p, o);
  if (['dark', 'ghost'].includes(type)) return eclipse(p, o);
  if (['bug', 'normal', 'fighting'].includes(type) && ['slash', 'flurry', 'fang', 'strike'].includes(arch)) return bladeStorm(p, o);
  return magmaEruption(p, o);   // 불·땅·풀·독·격투 …
}

// ---------------- 메가 전용 필살기 (R) ----------------
//  라인마다 이름과 연출 묶음(seq: 차례로 터지는 대연출). 메가진화(폼체인지·유대변화 포함) 중에만 쓸 수 있다
export const MEGA_ULT_CD = 24;
export const MEGA_ULT = {
  bulbasaur: { name: '하드플랜트 : 대지붕괴', type: 'grass', seq: [['eruption', { both: true, n: 8 }], ['nova', {}]] },
  charmander: { name: '블라스트번 : 창염폭발', type: 'fire', seq: [['beam', {}], ['eruption', { n: 6 }]] },
  squirtle: { name: '하이드로캐논 : 일제포격', type: 'water', seq: [['beam', { hh: 20 }], ['beam', { hh: 14 }], ['pillars', { n: 5 }]] },
  chikorita: { name: '프렌지플랜트 : 꽃의 성역', type: 'grass', seq: [['eruption', { both: true }], ['nova', {}]] },
  totodile: { name: '하이드로캐논 : 아쿠아 크래시', type: 'water', seq: [['pillars', {}], ['blades', {}]] },
  treecko: { name: '리프스톰 : 숲의 칼날', type: 'grass', seq: [['blades', { n: 8 }], ['eruption', {}]] },
  torchic: { name: '블레이즈킥 : 불사조 연각', type: 'fire', seq: [['blades', {}], ['eruption', { both: true }]] },
  mudkip: { name: '해일 : 대지의 파도', type: 'water', seq: [['pillars', { n: 7 }], ['eruption', { both: true }]] },
  tepig: { name: '플레어드라이브 : 화산 강림', type: 'fire', seq: [['eruption', { both: true, n: 8 }], ['meteor', { n: 4 }]] },
  chespin: { name: '우드해머 : 가시 요새', type: 'grass', seq: [['nova', {}], ['eruption', { both: true }]] },
  fennekin: { name: '매지컬플레임 : 화염 결계', type: 'fire', seq: [['nova', {}], ['beam', {}]] },
  froakie: { name: '물수리검 : 거대 수리검 난무', type: 'water', seq: [['blades', { n: 8 }], ['pillars', {}]] },
  gastly: { name: '섀도이클립스', type: 'ghost', seq: [['eclipse', {}]] },
  ralts: { name: '문포스 노바', type: 'fairy', seq: [['nova', { R: 150 }], ['meteor', { n: 4 }]] },
  larvitar: { name: '스톤에지 : 대지 분쇄', type: 'rock', seq: [['eruption', { both: true }], ['meteor', {}]] },
  dratini: { name: '용성군 : 천공 낙하', type: 'dragon', seq: [['meteor', { n: 7 }]] },
  magikarp: { name: '파괴광선 : 폭룡파', type: 'water', seq: [['beam', { hh: 32 }]] },
  onix: { name: '헤비슬램 : 강철 붕괴', type: 'steel', seq: [['eruption', { both: true }], ['meteor', { n: 4 }]] },
  scyther: { name: '시저크로스 : 천참', type: 'bug', seq: [['blades', { n: 10 }]] },
  gible: { name: '드래곤다이브 : 영역전개', type: 'dragon', seq: [['nova', { R: 150 }], ['meteor', { n: 5 }]] },
  pichu: { name: '볼트태클 : 뇌신강림', type: 'electric', seq: [['pillars', { n: 8 }], ['nova', {}]] },
  mewtwo: { name: '사이코브레이크 : 염동 붕괴', type: 'psychic', seq: [['nova', { R: 160 }], ['beam', {}]] },
  rayquaza: { name: '화룡점정 : 천공의 일격', type: 'dragon', seq: [['meteor', { n: 6 }], ['beam', { hh: 30 }]] },
  latias: { name: '미스트볼 : 유성의 춤', type: 'psychic', seq: [['meteor', { n: 5 }], ['nova', {}]] },
  latios: { name: '러스터퍼지 : 유성의 춤', type: 'psychic', seq: [['beam', {}], ['meteor', { n: 4 }]] },
  dialga: { name: '시간의포효 : 시간 정지', type: 'steel', seq: [['beam', { hh: 34 }], ['nova', {}]] },
  palkia: { name: '공간절단 : 차원 단절', type: 'water', seq: [['blades', { n: 8 }], ['beam', {}]] },
  giratina: { name: '섀도다이브 : 반전세계', type: 'ghost', seq: [['eclipse', {}], ['eruption', { both: true }]] },
  darkrai: { name: '다크홀 : 영원한 악몽', type: 'dark', seq: [['eclipse', {}]] }
};
const RUN = { beam: megaBeam, meteor: meteorRain, pillars: lightningPillars, eruption: magmaEruption, blades: bladeStorm, eclipse, nova };

// 라인에 정의가 없으면 출전 포켓몬 첫 속성으로 만든다
export function megaUltOf(p) {
  const def = MEGA_ULT[p.m.key];
  if (def) return def;
  const t = p.types[0];
  return { name: `${p.formName()} 각성 필살기`, type: t, seq: [[t === 'electric' || t === 'water' ? 'pillars' : t === 'dark' || t === 'ghost' ? 'eclipse' : 'nova', {}], ['beam', {}]] };
}

// R 행동: 컷인 → 연출 묶음을 차례로 (총 배율 7 · 시전 중 무적)
export function megaUltAction(p) {
  const def = megaUltOf(p), sc = p.scene, col = typeColor(def.type), total = 7, each = total / def.seq.length;
  const ev = [[0, () => cinematic(p, col, `${p.formName()} · ${def.name}`)]];
  def.seq.forEach(([kind, o], i) => ev.push([.22 + i * .5, () => RUN[kind](p, Object.assign({ type: def.type, mul: each }, o))]));
  return { dur: .3 + def.seq.length * .5, mm: 0, anim: 'Shoot', inv: .4 + def.seq.length * .5, lockFace: true, ev };
}

// ---------------- 진화 단계별 평타(Z 연타) 강화 ----------------
//  tier 1(2단): 1.4배 이중 검기 + 속성 스파크 · 넓어진 판정
//  tier 2(3단)·메가: 화면을 넓게 가르는 거대 검기 + 지면 균열 + 잔상 폭발 · 3타째엔 앞으로 속성 웨이브가 날아간다
export function tierComboFx(p, step) {
  const sc = p.scene, t = p.tierIdx, type = p.chargeType ? p.chargeType() : p.types[0], col = typeColor(type), s = sz(p), f = p.face;
  if (t < 1) return;
  const cx = p.x + f * 20 * s, cy = p.y - 2;
  if (t === 1) {
    sc.fx.slash(cx, cy, 18 * s * 1.4, f, col, { thick: 6, flipV: step % 2 === 0 });
    sc.fx.burst(cx, cy, [col, 0xffffff], 8, 120, { glow: true, life: .3, angle: f > 0 ? 0 : Math.PI, spread: 1.2, up: 20 });
    sc.combat.hitRect({ x: cx - 18 * s, y: cy - 14 * s, w: 36 * s, h: 28 * s }, .25, type, { kbx: 60, kby: -40, hs: 0, proc: true });
    return;
  }
  const R = 34 * s;
  sc.fx.slash(cx + f * 6, cy, R, f, col, { thick: 11, flipV: step % 2 === 0 });
  sc.fx.slash(cx + f * 14, cy, R * .7, f, 0xffffff, { thick: 5, flipV: step % 2 === 1, delay: .03 });
  const gy = sc.groundBelow(cx, p.y - 20);
  if (gy - p.bottom < 24) lineFx(sc, p.x + f * 8, gy - 1, p.x + f * 60 * s, gy - 1, col, { seg: 6, jag: 3, w: 2, ms: 260 });   // 지면 균열
  sc.fx.ghost(p.sprite, col, .55, 220);
  sc.fx.burst(cx, cy, [col, 0xffffff], 14, 190, { glow: true, life: .35, angle: f > 0 ? 0 : Math.PI, spread: 1.4, up: 40 });
  sc.combat.hitRect({ x: cx - R, y: cy - R * .8, w: R * 2, h: R * 1.6 }, .4, type, { kbx: 140, kby: -90, hs: 20, proc: true });
  sc.fx.shake(.006, 90, 'hit');
  if (step === 2) {   // 마지막 타: 전방 속성 웨이브
    sc.combat.spawnProjectile({ owner: 'player', x: p.x + f * 16, y: p.y - 4, vx: f * 360, vy: 0, r: 9 * s, mul: .9, type, kind: 'wave', color: col, life: .55, pierce: 99, tier: 3, pow: s, light: true, status: { proc: true } });
    Sfx.play('swing');
  }
}

// ---------------- 메가 심볼 (등 뒤 홀로그램 텍스처, 한 번만 그린다) ----------------
//  바깥 고리 · 안쪽 고리 · 가운데서 갈라져 휘감는 두 갈래 문양 (흰색 — 쓰는 쪽이 무지갯빛으로 물들인다)
export function megaSymbol(scene) {
  const key = 'fx:megasym';
  if (scene.textures.exists(key)) return key;
  const S = 96, t = scene.textures.createCanvas(key, S, S), c = t.getContext(), m = S / 2;
  c.strokeStyle = '#ffffff'; c.lineCap = 'round';
  c.globalAlpha = .9; c.lineWidth = 3; c.beginPath(); c.arc(m, m, 42, 0, Math.PI * 2); c.stroke();
  c.globalAlpha = .55; c.lineWidth = 1.5; c.beginPath(); c.arc(m, m, 34, 0, Math.PI * 2); c.stroke();
  c.globalAlpha = 1; c.lineWidth = 5;
  for (const s of [1, -1]) { c.beginPath(); c.moveTo(m, m); c.bezierCurveTo(m + 22 * s, m - 24 * s, m + 30 * s, m + 8 * s, m + 6 * s, m + 26 * s); c.stroke(); }
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(m, m, 7, 0, Math.PI * 2); c.fill();
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; c.globalAlpha = .7; c.fillRect(m + Math.cos(a) * 38 - 1.5, m + Math.sin(a) * 38 - 1.5, 3, 3); }
  t.refresh();
  return key;
}
