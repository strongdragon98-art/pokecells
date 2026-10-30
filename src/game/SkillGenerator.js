// SkillGenerator — GitHub(PokeAPI)에서 받은 턴제 기술 데이터(data/MoveDatabase.js)를 이 게임의 실시간 2D 액션 기술로 바꾼다
//  1) archetypeOf: 분류·위력·대상·성질 플래그·이름으로 액션 형태를 고른다
//      물리 → 베기(slash) · 펀치(strike) · 물기(fang) · 연속 베기(flurry) · 돌진(dash) · 내려찍기(slam) · 지면 충격파(shockwave) · 연사(volley) · 하늘 강타(낙석)
//      특수 → 투사체(projectile) · 부메랑(boomerang) · 유도탄(homing) · 관통 빔(beam) · 음파 고리(ring) · 주변 폭발(burst) · 하늘 강타(sky) · 장판(zone)
//      변화 → 능력 강화 오라(buff) · 회복(heal) · 보호막(shield) · 위성 구체(orbit) · 약화 파동(hex)
//  2) toSkillMeta: 이름·속성·쿨타임(PP 에서)·아이콘·설명 → SKILLS 형식
//  3) toImpl: 위력·연속 횟수·부가 효과(상태이상 확률·흡수·반동·급소·풀죽음·능력치 하락)를 실어 행동(action) 객체를 만든다
//  손으로 만든 기술(data/skills/*.js · data/pokemon.js 의 SKILLS)이 있으면 그쪽이 우선이다 — 여기서는 없는 기술만 만든다
//  새 기술을 손으로 다듬고 싶으면: npm run gen-skill -- <기술 id> 로 이 결과를 뼈대 코드로 뽑아 data/skills·game/skills 로 옮긴다
import { MOVE_DB, LEARNSETS } from '../data/MoveDatabase.js';
import { archetypeOf, cooldownOf, totalMulOf, toSkillMeta, ARCH_NAME } from '../data/moveRules.js';
export { archetypeOf, cooldownOf, totalMulOf, toSkillMeta, ARCH_NAME };
import { typeColor } from '../data/types.js';
import { Sfx } from '../systems/Audio.js';
import { slashHit, strikeHit, shoot, beamAction, dashAction } from './skills.js';
import { bezierMissiles, groundShockwave, orbitSatellites, skyStrike, soundRing, radialBurst, groundZone, kindOf } from './Mechanics.js';

// 부가 효과 → 이 게임 상태이상 (확률은 쓸 때마다 굴린다). 확률 0 인데 상태이상이 있으면(변화 기술) 반드시
function rollStatus(m, mega) {
  const st = {}, roll = pct => Math.random() * 100 < (pct || 100) * (mega ? 1.5 : 1);
  if (m.ail && roll(m.ailP)) {
    if (m.ail === 'burn') st.burn = 3;
    else if (m.ail === 'paralysis') st.paralyze = 1;
    else if (m.ail === 'freeze') st.freeze = 1;
    else if (m.ail === 'poison' || m.ail === 'leech-seed') st.poison = 4;
    else if (m.ail === 'sleep' || m.ail === 'yawn') st.stun = 1.4;
    else if (m.ail === 'confusion') st.confuse = 1;
    else if (m.ail === 'trap') st.root = 1.4;
  }
  if (m.flinch && roll(m.flinch)) st.stun = Math.max(st.stun || 0, .35);
  if (m.stats && (!m.statP || roll(m.statP))) {
    if (Object.entries(m.stats).some(([k, v]) => v < 0 && (k === 'def' || k === 'spd'))) st.curse = 4;   // 방어·특방 하락 → 받는 피해 +30%
    if ((m.stats.speed || 0) < 0) st.slow = 3;
  }
  if (m.crit) st.crit = .15 * m.crit;
  return st;
}

// ---------------- 3) 행동 만들기 ----------------
//  돌려주는 함수 (p, i) → action — Player.useSkill 이 부른다 (손으로 만든 기술과 같은 모양)
export function toImpl(id) {
  const m = MOVE_DB[id], arch = archetypeOf(m, id);
  if (!arch) return null;
  const cd = cooldownOf(m, arch), total = totalMulOf(m, cd), type = m.type, col = typeColor(type);
  const hitsN = m.hits ? Math.round((m.hits[0] + m.hits[1]) / 2) : 1;
  const after = p => {   // 반동·흡수 마무리 (흡수는 판정 쪽에서 lifesteal 로)
    if (m.recoil) p.selfDamage(p.m.maxhp * m.recoil / 100 * .12);
  };
  const st = p => Object.assign(rollStatus(m, p.mega.active), m.drain ? { lifesteal: m.drain / 100 * .5 } : {});
  const mega = p => p.mega.active;
  return (p, i) => {
    const sc = p.scene, M = mega(p), extra = M ? 1 : 0;
    const fin = fn => [[.06, () => { fn(); after(p); }]];
    switch (arch) {
      case 'slash': return { dur: .3, mm: .35, anim: 'Attack', ev: [[.06, () => slashHit(p, { fwd: 15, w: 30, h: 24, mul: total * .55, type, status: st(p), thick: 5 })], [.16, () => { slashHit(p, { fwd: 17, w: 32, h: 26, mul: total * .45, type, status: st(p), flipV: true, thick: 5 }); after(p); }]] };
      case 'fang': return { dur: .26, mm: .3, anim: 'Attack', ev: fin(() => slashHit(p, { fwd: 12, w: 24, h: 22, mul: total, type, status: Object.assign({ crit: .25 }, st(p)), thick: 6, burst: .9 })) };
      case 'strike': return { dur: .28, mm: .3, anim: 'Strike', ev: fin(() => { strikeHit(p, { fwd: 14, w: 26, h: 22, mul: total, type, status: st(p), kbx: 260 }); sc.fx.shake(.006, 100, 'hit'); }) };
      case 'flurry': {
        const n = hitsN + extra, ev = [];
        for (let k = 0; k < n; k++) ev.push([.04 + k * .07, () => slashHit(p, { fwd: 14, w: 26, h: 22, mul: total / n, type, status: k === n - 1 ? st(p) : {}, flipV: k % 2 === 1, thick: 4 })]);
        ev.push([.05 + n * .07, () => after(p)]);
        return { dur: .1 + n * .07, mm: .3, anim: 'Attack', ev };
      }
      case 'dash': return dashAction(p, { dur: .2, vx: 520, mul: total, type, color: col, anim: 'Strike', status: st(p), end: () => after(p) });
      case 'slam': return { dur: .38, mm: 0, anim: 'Strike', ev: [[.12, () => { strikeHit(p, { fwd: 12, w: 30, h: 28, mul: total * .6, type, status: st(p), kby: -260 }); groundShockwave(p, { dirs: [-1, 1], mul: total * .4, type, speed: 260, life: .6 }); after(p); }]] };
      case 'shockwave': return { dur: .36, mm: 0, anim: 'Strike', ev: [[.12, () => { groundShockwave(p, { dirs: [-1, 1], mul: total * .7, type, speed: 300, life: .9, status: st(p) }); sc.fx.ring(p.x, p.bottom - 2, 40, col, 300); after(p); }]] };
      case 'volley': {
        const n = hitsN + extra, ev = [];
        for (let k = 0; k < n; k++) ev.push([.05 + k * .06, () => { shoot(p, { mul: total / n, type, kind: kindOf(type), speed: 340, r: 3, life: .6, status: k === n - 1 ? st(p) : {}, stream: true, angle: (Math.random() - .5) * .12 }); Sfx.play('swing'); }]);
        ev.push([.06 + n * .06, () => after(p)]);
        return { dur: .1 + n * .06, mm: .4, anim: 'Shoot', ev };
      }
      case 'sky_fall': return { dur: .34, mm: .2, anim: 'Shoot', ev: fin(() => skyStrike(p, { n: 2 + extra, mul: total / 2, type, falling: true, status: st(p) })) };
      case 'projectile': return { dur: .3, mm: .3, anim: 'Shoot', ev: fin(() => { shoot(p, { mul: total, type, kind: kindOf(type), speed: 300, r: 5, life: .9, count: 1 + extra, status: st(p), light: true }); Sfx.play('eshot'); }) };
      case 'boomerang': return { dur: .3, mm: .35, anim: 'Shoot', ev: fin(() => { shoot(p, { mul: total * .6, type, kind: 'leaf', speed: 300, r: 6, life: 1.4, pierce: 99, boomerang: .38, count: 1 + extra, status: st(p), color: col }); Sfx.play('swing'); }) };
      case 'homing': return { dur: .34, mm: .3, anim: 'Shoot', ev: fin(() => bezierMissiles(p, { n: 2, mul: total / 2, type, status: st(p), lifesteal: m.drain ? m.drain / 100 * .5 : 0 })) };
      case 'beam': {
        const a = beamAction(p, { hold: .22, dur: .5, len: 170, hh: 6, mul: total / 5, tick: .1, type, pal: [col, 0xffffff], status: st(p) });
        const end0 = a.end; a.end = (pp, aa) => { end0(pp, aa); after(pp); };
        return a;
      }
      case 'ring': return { dur: .3, mm: .2, anim: 'Shoot', ev: fin(() => { soundRing(p, { mul: total, type, status: st(p) }); if (M) sc.time.delayedCall(160, () => soundRing(p, { mul: total * .5, type })); }) };
      case 'burst': return { dur: .34, mm: 0, anim: 'Strike', ev: fin(() => radialBurst(p, { mul: total, type, status: st(p), R: M ? 70 : 54 })) };
      case 'sky': return { dur: .34, mm: .2, anim: 'Shoot', ev: fin(() => skyStrike(p, { n: 3 + extra, mul: total / 3, type, status: st(p) })) };
      case 'zone': return { dur: .3, mm: .2, anim: 'Shoot', ev: fin(() => groundZone(p, { mul: total / 6, type, status: st(p), life: 2.5, w: M ? 110 : 80 })) };
      case 'orbit': return { dur: .3, mm: .4, anim: 'Shoot', ev: [[.08, () => orbitSatellites(p, { n: 3 + extra, mul: Math.max(.35, total / 4), type, dur: 4.5, status: st(p) })]] };
      case 'hex': return { dur: .32, mm: 0, anim: 'Shoot', ev: [[.1, () => {
        const r = 70 * p.mods.sizeMul, s0 = st(p);
        sc.combat.hitCircle(p.x, p.y, r, .15, type, Object.assign({ kbx: 40, kby: -40, hs: 0 }, s0, m.ail ? rollStatus(Object.assign({}, m, { ailP: 0 }), M) : {}));
        sc.fx.ring(p.x, p.y, r, col, 380); sc.fx.ring(p.x, p.y, r * .6, 0xffffff, 300); Sfx.play('wave');
      }]] };
      case 'buff': {
        const s0 = m.stats || {}, k = v => 1 + Math.max(0, v || 0) * .15 * (M ? 1.3 : 1);
        return { dur: .3, mm: .3, anim: 'Shoot', ev: [[.08, () => {
          p.addBuff({ atk: Math.max(k(s0.atk), k(s0.spa)), speed: k(s0.speed), guard: 1 / Math.max(k(s0.def), k(s0.spd)), t: 7, color: col });
          sc.fx.glow(p.x, p.y, 34, col, 500, .9); sc.fx.embers(p.x, p.bottom - 2, [col, 0xffffff], 10, { speed: 40 }); Sfx.play('heal');
          sc.fx.floatText(p.x, p.b.y - 10, `${m.ko || m.en}!`, '#ffe08a', 10);
        }]] };
      }
      case 'heal': return { dur: .34, mm: .2, anim: 'Shoot', ev: [[.1, () => { p.heal(p.m.maxhp * Math.min(.5, (m.heal || 40) / 100 * .6) * (M ? 1.3 : 1)); sc.fx.ring(p.x, p.y, 30, 0x7dff9a, 360); Sfx.play('heal'); }]] };
      case 'shield': return { dur: .45, mm: .2, anim: 'Shoot', guard: 'spin', inv: .45, ev: [[.04, () => {
        p.addBuff({ guard: .5, t: 3.5, color: col });
        sc.fx.ring(p.x, p.y, 26, col, 450); sc.fx.glow(p.x, p.y, 30, col, 600, .8); Sfx.play('select');
      }]] };
    }
    return null;
  };
}

// ---------------- 라인별 배울 수 있는 기술 ----------------
//  lineId: data/roster.js 의 id · own: 손으로 만든 기술 id 집합 (있으면 그쪽을 쓴다)
export function learnableFor(lineId, how = ['tm', 'tutor', 'level', 'egg']) {
  const L = LEARNSETS[lineId];
  if (!L) return [];
  return [...new Set(how.flatMap(k => L[k] || []))];
}

// 손으로 만든 SKILLS 에 없는 기술만 모아 { SKILLS, SKILL_IMPL } 로 (게임 시작 때 한 번)
export function buildGenerated(own) {
  const SK = {}, IMPL = {};
  for (const id of Object.keys(MOVE_DB)) {
    if (own[id]) continue;
    const meta = toSkillMeta(id), impl = meta && toImpl(id);
    if (!meta || !impl) continue;
    SK[id] = meta; IMPL[id] = impl;
  }
  return { SKILLS: SK, SKILL_IMPL: IMPL };
}

// 액션 형태별 개수 (요약·디버그용)
export function archetypeStats() {
  const o = {};
  for (const id of Object.keys(MOVE_DB)) { const a = archetypeOf(MOVE_DB[id], id) || '(쓰지 않음)'; o[a] = (o[a] || 0) + 1; }
  return o;
}
