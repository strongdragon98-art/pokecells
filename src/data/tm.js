// 기술머신(TM): 맵 샛길 끝 제단에서 카드 3장을 뒤집어 보고 1장을 고른다 (UI 는 scenes/UIScene.showTM)
//  카드 종류 — move: 새 액티브 기술 습득(X·C 자리에 장착/교체 · 연타 기술이 아니면 Z 도) · up: 원작 개조(불꽃세례 → 푸른 연옥 …)
//   · boost: 지금 Z·X·C 에 단 기술을 직접 키우는 스킬 강화(위력 · 가속 · 광역 · 분열탄 — 모든 기술 공용) · perk: 특성 카드(game/Perks.js) · mastery: 숙련
//  카드는 '파티 전체' 기준으로 뽑는다: 출전 여부와 상관없이 파티의 누구든 쓸 수 있는 카드만 나오고(아무도 못 쓰는 카드는 풀에서 빠진다),
//   카드마다 쓸 수 있는 포켓몬(who: 계열 키 목록)을 달아 둔다 → 고를 때 둘 이상이면 누구에게 적용할지 고른다 (UIScene.showTM)
//  3장 중 2장(30% 확률로 3장 전부)은 [지금 가진 기술 강화] 카드 (boost · up) — 평균 75% 이상. 나머지 칸은 새 기술(60%) 또는 특성 카드
//  기술은 그 포켓몬이 원작·타입상 배울 수 있는 것만 (TM_LEARN)
//  등급 4단계: 커먼 · 레어 · 유니크 · 전설 (특성 카드 55 · 28 · 13 · 4% / 스킬 강화 카드는 레어 62 · 유니크 29 · 전설 9%)
import { SKILLS } from './pokemon.js';
import { typeName } from './types.js';
import { PERKS } from '../game/Perks.js';
import { LEARNSETS } from './MoveDatabase.js';

// 계열(SPECIES 키)마다 기술머신으로 배울 수 있는 자속성 밖 기술 (원작 기술머신 습득 고증)
export const TM_POOL = {
  charmander: ['crunch', 'solar_beam', 'hurricane', 'thunder_punch', 'dragon_claw'],
  squirtle: ['ice_beam', 'flash_cannon', 'dark_pulse', 'earthquake'],
  bulbasaur: ['sludge_bomb', 'earth_power', 'play_rough', 'giga_drain'],
  pichu: ['iron_tail', 'surf', 'thunder_punch'],
  zubat: ['dark_pulse', 'heat_wave', 'steel_wing'],
  machop: ['thunder_punch', 'ice_punch', 'stone_edge', 'earthquake'],
  gastly: ['thunderbolt', 'psychic', 'dark_pulse', 'giga_drain']
};

// 지금 가진 기술을 한 단계 개조하는 강화 카드 (효과는 game/skills.js 에서 up(p, id) 로 확인)
export const UPGRADES = {
  blue_inferno: { skill: 'scratch_ember', name: '불꽃세례 개조: 푸른 연옥', grade: '전설', desc: '불꽃세례 피해 +50%. 불꽃이 푸른 창염으로 바뀌고 발사 수 +2.' },
  blast_cross: { skill: 'scratch_ember', name: '할퀴기 진화: 폭열 크로스', grade: '유니크', desc: '할퀴기 사거리 +40%. 마지막 X자 타격 때 전방에 화염 기둥이 폭발한다.' },
  hydro_pump: { skill: 'tackle_watergun', name: '물대포 진화: 하이드로펌프', grade: '전설', desc: '3타 물대포가 적을 끝까지 밀어내는 넉백 물줄기 광선으로 바뀐다.' },
  tidal_spin: { skill: 'rapid_spin', name: '고속스핀 개조: 소용돌이 스핀', grade: '유니크', desc: '고속스핀 범위·위력 ×1.5, 메가가 아니어도 적 투사체를 되받아친다.' },
  hundred_flowers: { skill: 'razor_leaf', name: '잎날가르기 개조: 백화요란', grade: '전설', desc: '잎날 크기 2배 · 피해 +40% · 잎날 1장 추가. 꿰뚫고 돌아오며 2번 벤다.' },
  thorn_lash: { skill: 'vine_whip', name: '덩굴채찍 진화: 가시채찍', grade: '유니크', desc: '덩굴채찍 사거리 +35%. 채찍 끝이 꺾이는 자리에서 가시가 폭발한다.' },
  rail_storm: { skill: 'thundershock', name: '전기쇼크 개조: 레일 쇼크', grade: '유니크', desc: '모든 전기탄이 크고 빨라지며 적 3마리까지 꿰뚫는다.' },
  storm_lord: { skill: 'thunderbolt', name: '10만볼트 진화: 뇌신', grade: '전설', desc: '번개를 맞는 적 +3마리, 맞은 적끼리 번개가 연쇄로 이어진다.' },
  vampire_fang: { skill: 'leech_life', name: '흡혈 진화: 흡혈귀의 송곳니', grade: '유니크', desc: '흡혈 회복 +20%, 물기 사거리 +30%.' },
  sonic_storm: { skill: 'supersonic', name: '초음파 개조: 음파 폭풍', grade: '유니크', desc: '초음파가 사방으로 퍼지고 범위 ×1.6 · 위력 ×1.5.' },
  iron_chop: { skill: 'karate_chop', name: '태권당수 진화: 강철 당수', grade: '유니크', desc: '3타 위력 ×1.3, 마지막 타격마다 관통 충격파가 날아간다.' },
  meteor_fist: { skill: 'dynamic_punch', name: '폭발펀치 개조: 메테오 너클', grade: '전설', desc: '폭발 반경 ×1.6 · 위력 ×1.4.' },
  phantom_tongue: { skill: 'lick_shadow', name: '핥기 진화: 망령의 혀', grade: '유니크', desc: '3타 섀도볼이 커지고 적을 쫓아가며, 맞은 적을 저주한다.' },
  nightmare_orb: { skill: 'shadow_ball', name: '섀도볼 개조: 악몽의 구슬', grade: '전설', desc: '섀도볼 2개 추가, 폭발 반경 ×1.3.' }
};

// 지금 장착한 기술을 직접 키우는 스킬 강화 카드 (어떤 기술이든 · 같은 기술의 같은 갈래는 BOOST_MAX 장까지 겹친다)
//  효과는 Player.applyBoost(시전할 때 피해 · 크기 · 분열탄) · Player.cdOf(쿨타임)에서 읽는다 (m.boost = boostTotals(m.boostCards))
export const BOOST_MAX = 3;
export const BOOSTS = {
  power: { name: '위력 증폭', icon: '⚔', amt: { 레어: .25, 유니크: .4, 전설: .6 }, desc: (sk, a) => `${sk}의 피해 +${Math.round(a * 100)}%` },
  haste: { name: '가속 회로', icon: '⏱', cdOnly: true, amt: { 레어: .15, 유니크: .22, 전설: .3 }, desc: (sk, a) => `${sk}의 쿨타임 -${Math.round(a * 100)}% (누적 최대 -60%)` },
  wide: { name: '광역 확장', icon: '◎', amt: { 레어: .25, 유니크: .4, 전설: .6 }, desc: (sk, a) => `${sk}의 범위 · 투사체 크기 +${Math.round(a * 100)}%` },
  split: { name: '분열탄', icon: '✺', amt: { 레어: 2, 유니크: 3, 전설: 4 }, desc: (sk, a, ty) => `${sk}를 쓸 때마다 ${typeName(ty)} 유도탄 ${a}갈래가 함께 뻗어 나간다 (피해 45%)` }
};
const BOOST_W = { 레어: 62, 유니크: 29, 전설: 9 };
// ---- 중복 카드 합성: 같은 카드를 또 뽑으면 장수를 늘리지 않고 한 장의 강화 단계(+1 · +2 · +3)를 올린다 ----
//  강화 1단계마다 핵심 수치가 기본값의 60%씩 더 오른다 (lvMul) · +2 에 등급 한 단계 승급 · +3 = ★초월(MAX): 이름 앞 [★초월] · 홀로그램 · 특수 보너스 · 더는 기술머신에 나오지 않는다
//  합성되는 카드: 기술 카드(기술머신으로 배운 기술) · 스킬 강화 카드(같은 기술 · 같은 갈래) · 특성 카드 (원작 개조 카드는 한 번뿐 · 숙련 카드는 몇 번이고)
export const CARD_MAX_LV = 3, LV_GAIN = .6;
export const lvMul = lv => 1 + LV_GAIN * Math.max(0, lv);
export const lvTag = lv => lv >= CARD_MAX_LV ? '★MAX' : `+${lv}`;
export const promoteGrade = (grade, lv) => lv >= 2 ? GRADES[Math.min(GRADES.length - 1, GRADES.indexOf(grade) + 1)] : grade;
// ★초월 특수 보너스 (카드 앞면 · 합성 안내에 쓴다)
export const MAX_BONUS = { move: '★초월: 유도탄 2갈래 추가 · 쿨타임 -15%', boost: '★초월: 유도탄 2갈래 추가 · 쿨타임 -10%', perk: '★초월: 이 포켓몬의 공격력 +10%' };
// 포켓몬 m 이 이 카드를 이미 몇 강으로 가지고 있는가 (-1: 처음 · 0: 기본 · 1~3: 강화 단계)
export function heldLv(m, card) {
  if (!m || !card) return -1;
  if (card.kind === 'boost') {
    const es = (m.boostCards || []).filter(e => e.skill === card.skill && e.bk === card.bk);   // 예전 저장: 같은 카드가 여러 장으로 남아 있으면 장수만큼 단계로 친다
    return es.length ? es.reduce((s, e) => s + (e.lv || 0) + 1, 0) - 1 : -1;
  }
  if (card.kind === 'move') return m.cardGrade && m.cardGrade[card.id] ? ((m.cardLv || {})['move:' + card.id] || 0) : -1;
  if (card.kind === 'perk') { const n = (m.perks || {})[card.id] || 0; return n ? n - 1 : -1; }
  return -1;
}
// 카드를 m 에게 줬을 때의 합성 미리보기 { from, to, grade, cmp } — 합성이 아니면 null
//  cmp: 핵심 수치 비교 (기존 +25% ▶ 강화 후 +45% 🔺)
export function mergePreview(m, card) {
  const from = heldLv(m, card);
  if (from < 0 || card.kind === 'up' || card.kind === 'mastery') return null;
  const to = Math.min(CARD_MAX_LV, from + 1), pct = v => `${Math.round(v * 100)}%`;
  let cmp = '', base = card.grade;
  if (card.kind === 'boost') {
    const e = (m.boostCards || []).find(q => q.skill === card.skill && q.bk === card.bk), a = e ? e.amt : card.amt;
    base = e ? e.grade : card.grade;
    cmp = card.bk === 'split' ? `(기존 ${Math.round(a * lvMul(from))}갈래 ▶ 강화 후 ${Math.round(a * lvMul(to))}갈래 🔺)`
      : card.bk === 'haste' ? `(기존 -${pct(Math.min(.6, a * lvMul(from)))} ▶ 강화 후 -${pct(Math.min(.6, a * lvMul(to)))} 🔺)`
      : `(기존 +${pct(a * lvMul(from))} ▶ 강화 후 +${pct(a * lvMul(to))} 🔺)`;
  } else if (card.kind === 'move') {
    base = moveGrade(card.id);
    cmp = `(위력 기존 +${pct(LV_GAIN * from)} ▶ 강화 후 +${pct(LV_GAIN * to)} 🔺)`;
  } else if (card.kind === 'perk') {
    base = PERKS[card.id].grade;
    cmp = `(효과 기존 ×${lvMul(from).toFixed(1)} ▶ 강화 후 ×${lvMul(to).toFixed(1)} 🔺)`;
  }
  return { from, to, grade: promoteGrade(base, to), cmp, max: to >= CARD_MAX_LV };
}
// 카드에 합성 미리보기를 입힌다: 등급(승급) · 이름([★초월]) · merge — 쓸 수 있는 포켓몬이 여럿이면 가장 낮은 단계 기준 (고를 때 포켓몬마다 따로 보여 준다)
export function dressCard(p, card) {
  const ms = (card.who || []).map(k => p.members.find(q => q.key === k)).filter(Boolean);
  const pvs = ms.map(m => mergePreview(m, card)), pv = pvs.filter(Boolean).sort((a, b) => a.from - b.from)[0] || null;
  if (!pv) return card;
  card.merge = pv; card.baseName = card.baseName || card.name;
  if (pvs.every(Boolean)) {   // 쓸 수 있는 모두에게 합성이면 승급 등급 · [★초월] 이름까지 카드에 (누구에겐 새 카드면 배지만)
    card.grade = pv.grade;
    if (pv.max && !card.name.startsWith('[★초월]')) card.name = '[★초월] ' + card.name;
    if (card.kind === 'move') { card.dup = true; card.cat = '기술 카드 · 강화 합성'; }
  } else card.mixed = true;
  return card;
}

// 받은 스킬 강화 카드 목록 → 기술마다 누적 효과 { power, haste, wide, split, n: { 갈래: 장수 } }
//  cardLv: 기술 카드 강화 단계 { 'move:기술': 단계 } — 단계마다 위력 +60% · 범위 +25% · 쿨타임 -6% (★초월: 유도탄 2갈래 · 쿨타임 -15%)
export function boostTotals(list, cardLv) {
  const out = {}, at = id => out[id] || (out[id] = { power: 0, haste: 0, wide: 0, split: 0, n: {} });
  for (const e of list || []) {
    if (!BOOSTS[e.bk]) continue;
    const b = at(e.skill), lv = e.lv || 0;
    b[e.bk] += e.amt * lvMul(lv); b.n[e.bk] = (b.n[e.bk] || 0) + 1 + lv;
    if (lv >= CARD_MAX_LV) { b.split += 2; b.haste += .1; }
  }
  for (const [k, lv] of Object.entries(cardLv || {})) {
    if (!k.startsWith('move:') || !lv) continue;
    const b = at(k.slice(5));
    b.power += LV_GAIN * lv; b.wide += .25 * lv; b.haste += .06 * lv;
    if (lv >= CARD_MAX_LV) { b.split += 2; b.haste += .15; }
  }
  return out;
}
// 스킬 강화 카드 한 장의 모습 (기술머신 · 보유 카드 탭이 같은 카드 앞면으로 그린다)
export function boostCard(e, slot) {
  const sk = SKILLS[e.skill], B = BOOSTS[e.bk], where = slot ? `현재 ${slot.toUpperCase()}자리 ` : '';
  return { kind: 'boost', id: `${e.owner || ''}:${e.skill}:${e.bk}`, bk: e.bk, skill: e.skill, slot, owner: e.owner, grade: e.grade, amt: e.amt, type: sk.type,
    name: `${sk.name} 강화: ${B.name}`, desc: where + B.desc(sk.name, e.amt, sk.type), cat: '스킬 강화' };
}

// 기술머신으로 배우는 액티브 기술 45종 → 배울 수 있는 포켓몬 타입 ('*' 는 거의 모두 — 파괴광선·기가임팩트·지진·유턴)
//  포켓몬의 타입(진화·메가로 바뀐 타입 포함) 중 하나라도 들어 있으면 그 기술 카드가 나온다 (원작 기술머신·가르침 습득 경향을 타입으로 묶었다)
export const TM_LEARN = {
  flamethrower: ['fire', 'dragon', 'normal', 'ground', 'dark', 'poison'], fire_blast: ['fire', 'dragon', 'normal', 'ground'], heat_wave: ['fire', 'flying', 'dragon'],
  will_o_wisp: ['fire', 'ghost', 'psychic'],
  surf: ['water', 'ice', 'normal', 'dragon', 'ground', 'psychic'], hydro_pump: ['water', 'ice', 'dragon'], aqua_tail: ['water', 'dragon', 'ground', 'normal'],
  solar_beam: ['grass', 'fire', 'normal', 'bug', 'dragon', 'psychic', 'rock', 'ground'], giga_drain: ['grass', 'bug', 'poison', 'ghost'], leaf_storm: ['grass', 'dragon'],
  thunderbolt: ['electric', 'water', 'normal', 'psychic', 'dragon', 'ghost', 'steel', 'fairy'], thunder: ['electric', 'water', 'normal', 'psychic', 'dragon', 'ghost', 'steel', 'flying'],
  thunder_punch: ['electric', 'fighting', 'fire', 'normal', 'ghost', 'ground', 'psychic', 'dragon'], wild_charge: ['electric', 'normal', 'ground', 'fighting'],
  ice_beam: ['ice', 'water', 'normal', 'psychic', 'dragon', 'ghost', 'dark', 'steel', 'fairy'], ice_punch: ['ice', 'fighting', 'water', 'normal', 'ghost', 'psychic', 'ground', 'dragon'],
  shadow_ball: ['ghost', 'psychic', 'dark', 'normal', 'poison', 'dragon', 'fairy', 'water', 'fire', 'electric', 'grass', 'ice'],
  crunch: ['dark', 'dragon', 'water', 'ground', 'rock', 'normal', 'fire', 'poison', 'electric'], dark_pulse: ['dark', 'ghost', 'dragon', 'psychic', 'poison', 'water', 'fire'],
  night_slash: ['dark', 'bug', 'grass', 'dragon', 'ghost', 'steel', 'normal'],
  psychic: ['psychic', 'ghost', 'fairy', 'normal', 'water', 'grass', 'electric', 'poison', 'dragon', 'ice'], psyshock: ['psychic', 'fairy', 'ghost', 'dragon'],
  close_combat: ['fighting', 'normal', 'dragon', 'grass', 'fire', 'water', 'steel', 'dark', 'bug'], drain_punch: ['fighting', 'grass', 'ghost', 'normal', 'water', 'fire', 'poison'],
  body_press: ['fighting', 'rock', 'steel', 'ground', 'water', 'normal', 'dragon', 'grass'],
  earthquake: '*', earth_power: ['ground', 'fire', 'rock', 'poison', 'psychic', 'grass', 'dragon', 'electric', 'steel', 'normal'],
  stone_edge: ['rock', 'ground', 'fighting', 'dragon', 'steel', 'normal', 'fire', 'dark', 'bug'], rock_tomb: ['rock', 'ground', 'fighting', 'dragon', 'steel', 'normal', 'fire', 'water', 'ice', 'poison', 'dark'],
  flash_cannon: ['steel', 'water', 'electric', 'psychic', 'dragon', 'rock', 'ground', 'fairy', 'ghost', 'normal'],
  iron_tail: ['steel', 'electric', 'ground', 'rock', 'dragon', 'normal', 'water', 'fire', 'grass', 'dark', 'poison'], steel_wing: ['flying', 'steel', 'dragon', 'bug', 'poison'],
  dragon_claw: ['dragon', 'fire', 'ground', 'rock', 'water', 'dark', 'steel', 'normal', 'grass', 'fighting'],
  dragon_pulse: ['dragon', 'water', 'fire', 'electric', 'psychic', 'normal', 'steel', 'poison', 'flying'], draco_meteor: ['dragon'],
  outrage: ['dragon', 'water', 'ground', 'rock', 'normal', 'fighting', 'dark', 'fire', 'grass', 'steel'],
  hurricane: ['flying', 'dragon', 'bug', 'fire', 'water', 'psychic'], brave_bird: ['flying', 'fire', 'fighting', 'normal', 'dark'],
  x_scissor: ['bug', 'steel', 'dark', 'grass', 'fighting', 'normal', 'ground', 'rock', 'dragon', 'water'], u_turn: '*',
  sludge_bomb: ['poison', 'grass', 'ghost', 'water', 'dark', 'dragon', 'ground', 'rock', 'normal', 'bug', 'fire'],
  play_rough: ['fairy', 'normal', 'dark', 'fighting', 'water', 'fire', 'grass', 'electric', 'psychic', 'dragon', 'steel', 'bug'],
  moonblast: ['fairy', 'psychic', 'normal', 'water', 'grass', 'dragon', 'ice'],
  hyper_beam: '*', giga_impact: '*'
};
// 이 포켓몬이 기술머신으로 배울 수 있는 기술 (타입 + 계열 전용 TM_POOL)
export function learnableMoves(types, line) {
  const ts = new Set(types || []);
  const ids = Object.entries(TM_LEARN).filter(([, who]) => who === '*' || who.some(t => ts.has(t))).map(([id]) => id);
  // + GitHub(PokeAPI) 습득표: 그 계열이 역대 게임에서 기술머신·가르침·레벨업·알로 배우는 기술 (data/MoveDatabase.js · 기술 동작은 game/SkillGenerator.js)
  const L = LEARNSETS[line] || {}, real = ['tm', 'tutor', 'level', 'egg'].flatMap(k => L[k] || []);
  return [...new Set([...ids, ...(TM_POOL[line] || []), ...real])].filter(id => SKILLS[id] && !DASH_ONLY.has(id) && SKILLS[id].arch !== 'dash');
}

// 기술 카드 등급: 손으로 정한 값 → 없으면 GitHub 데이터의 위력으로 (130↑ 전설 · 100↑ 유니크 · 70↑ 레어 · 그 밖 커먼 · 변화 기술 레어)
// 대시와 다를 바 없는 단순 돌진 기술: 기술머신 카드로 나오지 않는다 (그 기믹은 '대시 진화' 특성 카드로 — game/Perks.js)
//  순간이동·잠복처럼 사라졌다 나타나는 기술(팬텀 그림자 잠복 등)은 여기에 넣지 않는다
export const DASH_ONLY = new Set(['flame_charge', 'quick_attack', 'steel_wing', 'play_rough', 'super_fang', 'volt_tackle', 'night_slash', 'grassy_glide', 'wild_charge', 'flare_blitz', 'fake_out', 'u_turn']);

export function moveGrade(id) {
  if (MOVE_GRADE[id]) return MOVE_GRADE[id];
  const s = SKILLS[id];
  if (!s || !s.gen) return '레어';
  if (s.cls === 'status') return '레어';
  const pw = s.power || 0;
  return pw >= 130 ? '전설' : pw >= 100 ? '유니크' : pw >= 70 ? '레어' : '커먼';
}

// 카드가 모자랄 때 채우는 숙련 카드 (몇 번이고 겹친다 — 어떤 경우에도 카드 3장을 채운다)
export const MASTERY = {
  power_memory: { name: '숙련의 기억: 힘', grade: '커먼', desc: '이 포켓몬의 공격력 +8%.', apply: m => { m.atkBonus *= 1.08; } },
  quick_memory: { name: '숙련의 기억: 집중', grade: '커먼', desc: '이 포켓몬의 모든 기술 쿨타임 -8%.', apply: m => { m.cdBonus *= .92; } },
  life_memory: { name: '숙련의 기억: 생명', grade: '커먼', desc: '이 포켓몬의 체력을 모두 회복하고, 공격력 +4%.', apply: (m, p) => { m.atkBonus *= 1.04; m.hp = m.maxhp; m.alive = true; } }
};

// 카드 등급 4단계 → 대표 색 (테두리 · 빛) / 등급 스타일 (UIScene 이 카드 앞면·뒷면·뒤집기 연출에 쓴다)
export const GRADES = ['커먼', '레어', '유니크', '전설'];
export const GRADE = { 커먼: 0xd0d7de, 레어: 0x00b4d8, 유니크: 0xb5179e, 전설: 0xffb703 };
export const GRADE_STYLE = {
  커먼: { en: 'COMMON', border: ['#d0d7de', '#d0d7de'], bg: ['#1c2638', '#0d1220'], glow: 0x9ab8ff },
  레어: { en: 'RARE', border: ['#00b4d8', '#48e5ff'], bg: ['#08304a', '#061424'], glow: 0x00b4d8 },
  유니크: { en: 'UNIQUE', border: ['#b5179e', '#7209b7'], bg: ['#2e0a3e', '#12061e'], glow: 0xb5179e },
  전설: { en: 'LEGENDARY', border: ['#ffb703', '#ff0054'], bg: ['#3e2208', '#1e0612'], glow: 0xffb703 }
};
const WEIGHT = { 커먼: 55, 레어: 28, 유니크: 13, 전설: 4 };
// 기술 카드 등급: 대기술은 전설 · 주력기는 유니크 · 나머지는 레어
const MOVE_GRADE = {
  solar_beam: '전설', earthquake: '전설', draco_meteor: '전설', hyper_beam: '전설', giga_impact: '전설', thunder: '전설', fire_blast: '전설', hydro_pump: '전설', close_combat: '전설',
  outrage: '전설', leaf_storm: '전설', brave_bird: '전설',
  hurricane: '유니크', psychic: '유니크', surf: '유니크', dragon_claw: '유니크', dragon_pulse: '유니크', ice_beam: '유니크', thunderbolt: '유니크', stone_edge: '유니크', flamethrower: '유니크',
  shadow_ball: '유니크', earth_power: '유니크', moonblast: '유니크', play_rough: '유니크', dark_pulse: '유니크', sludge_bomb: '유니크', flash_cannon: '유니크', x_scissor: '유니크',
  drain_punch: '유니크', wild_charge: '유니크', body_press: '유니크', psyshock: '유니크', night_slash: '유니크'
};
// 특성 카드 분류 → 카드에 붙는 알약 글자 · 속성 부여 카드는 그 속성 색
export const PERK_TYPE = { u_charge: 'electric', r_burn: 'fire', r_freeze: 'ice', r_para: 'electric', r_poison: 'poison', u_curse: 'ghost', u_chain: 'electric', l_storm: 'electric', u_flame: 'fire', u_toxic: 'poison', l_hole: 'dark' };

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function rollGrade() {
  let r = Math.random() * 100;
  for (const g of GRADES) { r -= WEIGHT[g]; if (r < 0) return g; }
  return '커먼';
}

// 파티 전체(p.members)가 지금 받을 수 있는 모든 카드 — 카드마다 쓸 수 있는 포켓몬 계열 키(who)를 단다
function partyCandidates(p) {
  const moveMap = new Map(), dupMap = new Map(), upMap = new Map(), boosts = [], perkWho = new Map();
  for (const m of p.members) {
    const types = p.typesOf(m), own = new Set(types), known = new Set([...Object.values(m.skills), ...(m.learned || [])]);   // 배웠다가 빼 둔 기술도 다시 나오지 않게
    // 기술머신으로 배운 기술 카드를 또 뽑으면 합성 (+1 ~ +3 · ★초월이면 더는 안 나온다)
    for (const id of Object.keys(m.cardGrade || {})) {
      if (!SKILLS[id] || DASH_ONLY.has(id) || heldLv(m, { kind: 'move', id }) >= CARD_MAX_LV) continue;
      let c = dupMap.get(id);
      if (!c) dupMap.set(id, c = { kind: 'move', id, name: SKILLS[id].name, type: SKILLS[id].type, grade: moveGrade(id), desc: SKILLS[id].desc, cd: SKILLS[id].cd, cat: '기술 카드 · 강화 합성', dup: true, who: [] });
      c.who.push(m.key);
    }
    for (const id of learnableMoves([...own, ...(m.sp.types || [])], m.key)) {
      if (known.has(id)) continue;
      let c = moveMap.get(id);
      if (!c) moveMap.set(id, c = { kind: 'move', id, name: SKILLS[id].name, type: SKILLS[id].type, grade: moveGrade(id), desc: SKILLS[id].desc, cd: SKILLS[id].cd, cat: '새 기술 · 습득', who: [] });
      c.who.push(m.key);
      if (own.has(SKILLS[id].type)) c.cat = '새 기술 · 자속성';
    }
    for (const [id, u] of Object.entries(UPGRADES)) {
      if (!known.has(u.skill) || m.ups.has(id) || !SKILLS[u.skill]) continue;
      let c = upMap.get(id);
      if (!c) upMap.set(id, c = { kind: 'up', id, name: u.name, type: SKILLS[u.skill].type, grade: u.grade, desc: u.desc, skill: u.skill, cat: '기술 강화', who: [] });
      c.who.push(m.key);
    }
    for (const slot of ['z', 'x', 'c']) {
      const sid = m.skills[slot], sk = SKILLS[sid];
      if (!sk) continue;
      for (const bk of Object.keys(BOOSTS)) {
        if (BOOSTS[bk].cdOnly && !sk.cd) continue;   // 연타 기본기는 쿨타임이 없다
        if (heldLv(m, { kind: 'boost', skill: sid, bk }) >= CARD_MAX_LV) continue;   // ★초월 카드는 더 나오지 않는다
        boosts.push({ bk, skill: sid, slot, owner: m.key, who: [m.key], active: m === p.m });
      }
    }
    for (const [id, pk] of Object.entries(PERKS)) if (((m.perks || {})[id] || 0) < Math.min(pk.max, CARD_MAX_LV + 1)) { if (!perkWho.has(id)) perkWho.set(id, []); perkWho.get(id).push(m.key); }
  }
  const perks = [...perkWho].map(([id, who]) => { const pk = PERKS[id]; return { kind: 'perk', id, name: pk.name, type: PERK_TYPE[id] || 'normal', grade: pk.grade, desc: pk.desc, cat: pk.cat, who }; });
  for (const [id, c] of dupMap) if (moveMap.has(id)) moveMap.get(id).who.push(...c.who); else moveMap.set(id, c);   // 누구에겐 새 기술 · 누구에겐 합성인 카드는 한 장으로 (고를 때 포켓몬마다 갈린다)
  return { moves: [...moveMap.values()], ups: [...upMap.values()], boosts, perks };
}

// 파티 p 에게 맞는 서로 다른 카드 '반드시 3장'
//  ① 지금 가진 기술 강화 카드 2장(30% 확률로 3장) — 원작 개조(up)가 남아 있으면 30%로 그쪽, 아니면 스킬 강화(boost) · 출전 중인 포켓몬의 기술이 두 배로 잘 나온다
//  ② 남은 칸: 60% 새 기술 카드(대기술일수록 드물게 — 전설 1 : 유니크 3 : 레어 6) · 40% 특성 카드(등급을 굴려 가까운 등급부터)
//  ③ 그래도 모자라면 남은 아무 카드 → 숙련 카드
//  o.floor: 이 등급보다 낮게 나오면 끌어올린다 · o.legend: 한 장은 반드시 전설 (히든 전설 정화 보상)
export function rollCards(p, o = {}) {
  const { moves, ups, boosts, perks } = partyCandidates(p), out = [], used = new Set(), floor = GRADES.indexOf(o.floor || '커먼');
  const all = p.members.map(m => m.key);
  const key = c => c.kind + ':' + c.id;
  const take = list => { const c = shuffle(list.filter(q => !used.has(key(q))))[0]; if (c) { used.add(key(c)); out.push(c); } return c; };
  const MOVE_W = { 레어: 6, 유니크: 3, 전설: 1, 커먼: 6 };
  const takeMove = () => {
    const pool = moves.filter(c => !used.has(key(c)) && GRADES.indexOf(c.grade) >= floor);
    const list = pool.length ? pool : moves.filter(c => !used.has(key(c)));
    if (!list.length) return null;
    let r = Math.random() * list.reduce((s, c) => s + MOVE_W[c.grade], 0);
    for (const c of shuffle(list.slice())) { if ((r -= MOVE_W[c.grade]) < 0) { used.add(key(c)); out.push(c); return c; } }
    return take(list);
  };
  const boostGrade = () => {
    let r = Math.random() * 100, g = '레어';
    for (const gg of ['레어', '유니크', '전설']) { r -= BOOST_W[gg]; if (r < 0) { g = gg; break; } }
    return GRADES[Math.max(GRADES.indexOf(g), floor)];
  };
  const takeBoost = (grade = null) => {
    const list = boosts.filter(b => !used.has(`boost:${b.owner}:${b.skill}:${b.bk}`));
    if (!list.length) return null;
    let r = Math.random() * list.reduce((s, b) => s + (b.active ? 2 : 1), 0), pick = list[0];
    for (const b of list) { if ((r -= b.active ? 2 : 1) < 0) { pick = b; break; } }
    const om = p.members.find(q => q.key === pick.owner), held = om && (om.boostCards || []).find(e => e.skill === pick.skill && e.bk === pick.bk);   // 이미 가진 카드면 그 카드의 등급 · 수치로 (합성)
    const g = held ? held.grade : grade || boostGrade(), c = Object.assign(boostCard({ owner: pick.owner, skill: pick.skill, bk: pick.bk, grade: g, amt: held ? held.amt : BOOSTS[pick.bk].amt[g] }, pick.slot), { who: pick.who });
    used.add(key(c)); out.push(c);
    return c;
  };
  const takeEnhance = () => {
    const upList = ups.filter(c => !used.has(key(c)) && GRADES.indexOf(c.grade) >= floor);
    if (upList.length && Math.random() < .3) return take(upList);
    return takeBoost() || take(upList);
  };
  if (o.legend) {
    const legendOthers = moves.concat(ups, perks).filter(c => c.grade === '전설');
    if (!(Math.random() < .5 && takeBoost('전설'))) take(legendOthers) || takeBoost('전설');
  }
  const wantEnhance = Math.random() < .3 ? 3 : 2;
  while (out.filter(c => c.kind === 'boost' || c.kind === 'up').length < wantEnhance && out.length < 3 && takeEnhance());
  while (out.length < 3) {
    if (Math.random() < .6 && takeMove()) continue;
    const gi = Math.max(floor, GRADES.indexOf(rollGrade())), g = GRADES[gi];
    const order = [g, ...GRADES.slice(0, gi).reverse(), ...GRADES.slice(gi + 1)];   // 같은 등급 → 낮은 등급 → 높은 등급
    let got = null;
    for (const gg of order) if ((got = take(perks.filter(c => c.grade === gg)))) break;
    if (!got && !takeMove() && !takeEnhance()) break;
  }
  for (const [id, c] of Object.entries(MASTERY)) if (out.length < 3) out.push({ kind: 'mastery', id, name: c.name, type: 'normal', grade: c.grade, desc: c.desc, cat: '숙련', who: all });
  return shuffle(out).slice(0, 3).map(c => dressCard(p, c));
}

// 고른 카드 적용. move 는 바꿀 슬롯(z·x·c)이 필요하다. 바뀐 내용을 글로 돌려준다
export function applyCard(player, m, card, slot) {
  const from = heldLv(m, card);
  if (from >= 0 && (card.kind === 'move' || card.kind === 'boost')) {   // 중복 카드 합성: 한 장으로 합치고 강화 단계 +1 (+2 에 등급 승급 · +3 ★초월)
    const to = Math.min(CARD_MAX_LV, from + 1);
    if (card.kind === 'move') {
      (m.cardLv = m.cardLv || {})['move:' + card.id] = to;
      m.cardGrade[card.id] = promoteGrade(moveGrade(card.id), to);   // 승급한 등급으로 시전 연출도 바뀐다 (Player.gradeCast)
    } else {
      const es = m.boostCards.filter(e => e.skill === card.skill && e.bk === card.bk), keep = es[0];
      m.boostCards = m.boostCards.filter(e => !es.includes(e) || e === keep);   // 예전 저장의 여러 장도 한 장으로
      keep.lv = to; keep.promoted = promoteGrade(keep.grade, to);
    }
    m.boost = boostTotals(m.boostCards, m.cardLv);
    const nm = card.baseName || card.name;
    return `${nm} 강화 합성 ${lvTag(from)} → ${lvTag(to)}${to === 2 ? ' · 등급 승급!' : ''}${to >= CARD_MAX_LV ? ' · ' + MAX_BONUS[card.kind] : ''}`;
  }
  if (card.kind === 'move') {
    const old = SKILLS[m.skills[slot]].name;
    m.skills[slot] = card.id; m.cd[slot] = 0;
    (m.cardGrade = m.cardGrade || {})[card.id] = card.grade;   // 유니크·전설 카드로 배운 기술은 시전 연출이 달라진다 (Player.gradeCast)
    if (m.learned && !m.learned.includes(card.id)) m.learned.push(card.id);   // 원래 기술은 배운 기술 목록에 그대로 남는다
    return `${old} → ${card.name} (${slot.toUpperCase()}) · 원래 기술은 가방 → 기술에서 다시 넣을 수 있다`;
  }
  if (card.kind === 'up') { m.ups.add(card.id); return card.name; }
  if (card.kind === 'boost') {
    (m.boostCards = m.boostCards || []).push({ skill: card.skill, bk: card.bk, grade: card.grade, amt: card.amt, lv: 0 });
    m.boost = boostTotals(m.boostCards, m.cardLv);
    return card.desc;
  }
  if (card.kind === 'perk') {
    const pk = PERKS[card.id];
    m.perks = m.perks || {};
    m.perks[card.id] = (m.perks[card.id] || 0) + 1;
    const n = m.perks[card.id], lv = n - 1;
    if (lv >= CARD_MAX_LV) m.atkBonus = (m.atkBonus || 1) * 1.1;   // ★초월 보너스
    player.refreshMods(m);
    if (pk.onGet) pk.onGet(player, m);
    return n > 1 ? `${pk.name} 강화 합성 ${lvTag(lv - 1)} → ${lvTag(lv)}${lv === 2 ? ' · 등급 승급!' : ''}${lv >= CARD_MAX_LV ? ' · ' + MAX_BONUS.perk : ''} · ${pk.desc} (효과 ×${lvMul(lv).toFixed(1)})` : pk.desc;
  }
  MASTERY[card.id].apply(m, player);
  return card.name;
}