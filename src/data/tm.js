// 기술머신(TM): 맵 샛길 끝 제단에서 카드 4장(TM_CARDS)을 뒤집어 보고 1장을 고른다 (UI 는 scenes/UIScene.showTM)
//  카드 종류 — move: 새 액티브 기술 습득(X·C 자리에 장착/교체 · 연타 기술이 아니면 Z 도) · up: 원작 개조(불꽃세례 → 푸른 연옥 …)
//   · boost: 지금 Z·X·C 에 단 기술을 직접 키우는 스킬 강화(위력 · 가속 · 광역 · 분열탄 — 모든 기술 공용) · perk: 특성 카드(game/Perks.js) · mastery: 숙련
//  카드는 '파티 전체' 기준으로 뽑는다: 출전 여부와 상관없이 파티의 누구든 쓸 수 있는 카드만 나오고(아무도 못 쓰는 카드는 풀에서 빠진다),
//   카드마다 쓸 수 있는 포켓몬(who: 계열 키 목록)을 달아 둔다 → 고를 때 둘 이상이면 누구에게 적용할지 고른다 (UIScene.showTM)
//  4장 = 지금 가진 기술 강화 2장 (boost · up) + 새 기술 1장 확정 (파티에 없는 다른 속성 우선) + 자유 1장 (새 기술 60% 또는 특성 카드)
//  기술은 그 포켓몬이 원작·타입상 배울 수 있는 것만 (TM_LEARN)
//  등급 5단계: ⚪ 커먼 · 🟢 언커먼 · 🔵 레어 · 🟣 유니크 · 🟡 전설 — 지방(챕터)별 확률표 GRADE_W (관동은 커먼 68% · 전설 0%) · 칸마다 등급을 한 번 굴리고 그 등급 안에서 고른다
//   (그 등급 카드가 없으면 낮은 등급으로 — 굴린 등급보다 높게는 올리지 않는다) · 스킬 강화 수치는 커먼 +5% · 언커먼 +8% · 레어 +15% (📉 스탯 인플레이션 억제)
//   원작 개조(유니크 · 전설)는 그 등급이 굴러 나왔을 때만 · 차징 카드 보장 15%(등급 확률대로) · 합성 +2 에 한 등급 승급 (커먼 → 언커먼 → 레어 …)
//  ⚖️ 양날의 검 특성 카드 8종(game/Perks.js curse): 대가를 안고 한 메커니즘을 폭발시킨다 — 특성 카드 풀에 그대로 섞인다 (모두 유니크 — 초반 지방엔 드물게)
//  새 카드는 🟡 모험 보상 기술머신 캡슐(game/World.js: A 도전 금고 · B 정화 봉인 · C 비밀 벽감 · D 수문장 둥지 — 예전 길목 캡슐 · 보스 · 엘리트 TM 코어를 옮겼다)에서만 — 몬스터 처치 수 보상은 없다
//  ✨ 샛길 정화: 지방마다 침식된 샛길 구역(본길에서 갈라지는 방)을 마지막 한 마리까지 정화해 3곳 · 6곳(sideSteps)에 닿으면 '보유 카드 강화' (ownedUpgrades · upgradeInfo · GameScene.checkRoomClear)
import { SKILLS } from './pokemon.js';
import { typeName } from './types.js';
import { PERKS, perkMods } from '../game/Perks.js';
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
  tidal_spin: { skill: 'rapid_spin', name: '고속스핀 개조: 소용돌이 스핀', grade: '유니크', desc: '고속스핀 범위 +15% · 위력 ×1.5, 메가가 아니어도 적 투사체를 되받아친다.' },
  hundred_flowers: { skill: 'razor_leaf', name: '잎날가르기 개조: 백화요란', grade: '전설', desc: '잎날 크기 +15% · 피해 +40% · 잎날 1장 추가. 꿰뚫고 돌아오며 2번 벤다.' },
  thorn_lash: { skill: 'vine_whip', name: '덩굴채찍 진화: 가시채찍', grade: '유니크', desc: '덩굴채찍 사거리 +35%. 채찍 끝이 꺾이는 자리에서 가시가 폭발한다.' },
  rail_storm: { skill: 'thundershock', name: '전기쇼크 개조: 레일 쇼크', grade: '유니크', desc: '모든 전기탄이 강해지고(크기 +15%) 빨라지며 적 3마리까지 꿰뚫는다.' },
  storm_lord: { skill: 'thunderbolt', name: '10만볼트 진화: 뇌신', grade: '전설', desc: '번개를 맞는 적 +3마리, 맞은 적끼리 번개가 연쇄로 이어진다.' },
  vampire_fang: { skill: 'leech_life', name: '흡혈 진화: 흡혈귀의 송곳니', grade: '유니크', desc: '흡혈 회복 +20%, 물기 사거리 +30%.' },
  sonic_storm: { skill: 'supersonic', name: '초음파 개조: 음파 폭풍', grade: '유니크', desc: '초음파가 사방으로 퍼지고 범위 +15% · 위력 ×1.5.' },
  iron_chop: { skill: 'karate_chop', name: '태권당수 진화: 강철 당수', grade: '유니크', desc: '3타 위력 ×1.3, 마지막 타격마다 관통 충격파가 날아간다.' },
  meteor_fist: { skill: 'dynamic_punch', name: '폭발펀치 개조: 메테오 너클', grade: '전설', desc: '폭발 반경 +15% · 위력 ×1.4.' },
  phantom_tongue: { skill: 'lick_shadow', name: '핥기 진화: 망령의 혀', grade: '유니크', desc: '3타 섀도볼이 커지고(+15%) 적을 쫓아가며, 맞은 적을 저주한다.' },
  nightmare_orb: { skill: 'shadow_ball', name: '섀도볼 개조: 악몽의 구슬', grade: '전설', desc: '섀도볼 2개 추가, 폭발 반경 +12%.' }
};

// 지금 장착한 기술을 직접 키우는 스킬 강화 카드 (어떤 기술이든 · 같은 기술의 같은 갈래는 BOOST_MAX 장까지 겹친다)
//  효과는 Player.applyBoost(시전할 때 피해 · 크기 · 분열탄) · Player.cdOf(쿨타임)에서 읽는다 (m.boost = boostTotals(m.boostCards))
export const BOOST_MAX = 3;
export const BOOSTS = {
  // 📉 스탯 인플레이션 억제: 커먼 3 ~ 5% · 언커먼 6 ~ 10% · 레어 12 ~ 18% (유니크 · 전설은 그대로 — 초반 지방엔 거의 나오지 않는다)
  power: { name: '위력 증폭', icon: '⚔', amt: { 커먼: .05, 언커먼: .08, 레어: .15, 유니크: .4, 전설: .6 }, desc: (sk, a) => `${sk}의 피해 +${Math.round(a * 100)}%` },
  haste: { name: '가속 회로', icon: '⏱', cdOnly: true, amt: { 커먼: .04, 언커먼: .07, 레어: .12, 유니크: .22, 전설: .3 }, desc: (sk, a) => `${sk}의 쿨타임 -${Math.round(a * 100)}% (누적 최대 -60%)` },
  // 📏 광역 확장: 크기 증가는 예전의 3분의 1 남짓 (커먼 5 → 2% · 레어 15 → 5% · 유니크 40 → 12% · 전설 60 → 15%) — 다른 크기 증가와 더해 최종 최대 1.45배 (data/items.js SIZE_CAP)
  wide: { name: '광역 확장', icon: '◎', amt: { 커먼: .02, 언커먼: .03, 레어: .05, 유니크: .12, 전설: .15 }, desc: (sk, a) => `${sk}의 범위 · 투사체 크기 +${Math.round(a * 100)}% (크기는 합쳐 최대 1.45배)` },
  split: { name: '분열탄', icon: '✺', amt: { 커먼: 1, 언커먼: 1, 레어: 2, 유니크: 3, 전설: 4 }, desc: (sk, a, ty) => `${sk}를 쓸 때마다 ${typeName(ty)} 유도탄 ${a}갈래가 함께 뻗어 나간다 (피해 45%)` }
};
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
    const pk = PERKS[card.id];
    base = pk.grade;
    cmp = pk.curse ? `(극대화 ×${lvMul(from).toFixed(1)} ▶ ×${lvMul(to).toFixed(1)} 🔺 · 대가 ${Math.round((pk.ease || 0) * to * 100)}% 완화)`   // 양날의 검: 대가는 커지지 않고 줄어든다
      : `(효과 기존 ×${lvMul(from).toFixed(1)} ▶ 강화 후 ×${lvMul(to).toFixed(1)} 🔺)`;
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
//  cardLv: 기술 카드 강화 단계 { 'move:기술': 단계 } — 단계마다 위력 +60% · 범위 +8% · 쿨타임 -6% (★초월: 유도탄 2갈래 · 쿨타임 -15%)
const CARD_LV_WIDE = .08;   // 기술 카드 강화 단계마다 범위 · 크기 +8% (예전 +25%)
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
    b.power += LV_GAIN * lv; b.wide += CARD_LV_WIDE * lv; b.haste += .06 * lv;
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

// 기술 카드 등급: 손으로 정한 값 → 없으면 GitHub 데이터의 위력으로 (130↑ 전설 · 100↑ 유니크 · 80↑ 레어 · 60↑ 언커먼 · 그 밖 커먼 · 변화 기술 언커먼)
// 대시와 다를 바 없는 단순 돌진 기술: 기술머신 카드로 나오지 않는다 (그 기믹은 '대시 진화' 특성 카드로 — game/Perks.js)
//  순간이동·잠복처럼 사라졌다 나타나는 기술(팬텀 그림자 잠복 등)은 여기에 넣지 않는다
export const DASH_ONLY = new Set(['flame_charge', 'quick_attack', 'steel_wing', 'play_rough', 'super_fang', 'volt_tackle', 'night_slash', 'grassy_glide', 'wild_charge', 'flare_blitz', 'fake_out', 'u_turn']);

export function moveGrade(id) {
  if (MOVE_GRADE[id]) return MOVE_GRADE[id];
  const s = SKILLS[id];
  if (!s || !s.gen) return '레어';
  if (s.cls === 'status') return '언커먼';
  const pw = s.power || 0;
  return pw >= 130 ? '전설' : pw >= 100 ? '유니크' : pw >= 80 ? '레어' : pw >= 60 ? '언커먼' : '커먼';
}

export const TM_CARDS = 4;   // 한 번에 뒤집는 카드 수
export const BONUS_CARDS = 3;   // 현장 전송(전투 데이터 · 예전 저장에 남은 빛나는 TM 코어)이 보내는 카드 수
// ✨ 샛길 정화 (오염 구역 정화 보상): 본길에서 갈라지는 샛길 구역(GameScene.sideRooms)의 침식된 포켓몬을 마지막 한 마리까지 쓰러뜨리면
//  그 방이 영구히 정화되고(다시 와도 몬스터가 나오지 않는 성역) 정화한 수가 SIDE_STEPS(3곳 · 6곳)에 닿을 때마다 보유 카드 강화 1번 (지방마다 2번)
//   방에 들어서기만 해서는 세지 않는다 · 본길 방은 몬스터를 다 잡아도 세지 않고, 다른 방에 다녀오면 다시 나타난다 (긴장감 유지)
//   샛길 구역은 지방마다 12 ~ 40곳 — 6곳까지는 갈림길 몇 곳을 정리하면 닿는다 · 보스를 정화하면 지방 전체가 정화돼 더 세지 않는다
//  강화할 카드가 하나도 없으면(없거나 모두 +3강 ★초월) 대신 출전 중인 포켓몬 체력 MASTERY_HEAL 회복 · 한 번에 보여 주는 카드 MASTERY_CARDS 장
export const SIDE_STEPS = [3, 6], MASTERY_HEAL = .3, MASTERY_CARDS = 3;
// 정화할 수 있는 샛길 구역이 n 곳뿐인 지방이면 기준을 그 안으로 줄인다 (두 번째는 n 을 넘지 않게 · 첫 번째는 두 번째보다 적어도 1 작게)
export function sideSteps(n) {
  const b = Math.max(1, Math.min(n, SIDE_STEPS[1]));
  return [Math.max(1, Math.min(b - 1, SIDE_STEPS[0])), b];
}
// 카드 점수(총 카드 가치): 파티가 지닌 · 강화한 기술머신 카드 = 보유 카드 수 + 강화 단계 합 (특성 장 수 · 스킬 강화 1 + 단계 · 기술 카드 1 + 단계 · 원작 개조 · 숙련)
//  보스 · 엘리트 스탯에는 쓰지 않는다 (챕터별 고정 스펙 — data/balance.js) · 보스전 🔴 전력 부족 경고와 테스트룸 자동 장착이 권장 점수와 견준다
export function cardScore(p) {
  let n = 0;
  for (const m of (p && p.members) || []) {
    for (const v of Object.values(m.perks || {})) n += v || 0;
    for (const e of m.boostCards || []) n += 1 + (e.lv || 0);
    for (const id of Object.keys(m.cardGrade || {})) n += 1 + ((m.cardLv || {})['move:' + id] || 0);
    n += (m.ups && m.ups.size) || 0;
    n += m.mastery || 0;
  }
  return n;
}
// 카드가 모자랄 때 채우는 숙련 카드 (몇 번이고 겹친다 — 어떤 경우에도 카드 4장을 채운다)
export const MASTERY = {
  power_memory: { name: '숙련의 기억: 힘', grade: '커먼', desc: '이 포켓몬의 공격력 +4%.', apply: m => { m.atkBonus *= 1.04; } },
  quick_memory: { name: '숙련의 기억: 집중', grade: '커먼', desc: '이 포켓몬의 모든 기술 쿨타임 -4%.', apply: m => { m.cdBonus *= .96; } },
  life_memory: { name: '숙련의 기억: 생명', grade: '커먼', desc: '이 포켓몬의 체력을 모두 회복하고, 공격력 +2%.', apply: (m, p) => { m.atkBonus *= 1.02; m.hp = m.maxhp; m.alive = true; } }
};

// 카드 등급 5단계 (⚪ 커먼 → 🟢 언커먼 → 🔵 레어 → 🟣 유니크 → 🟡 전설) → 대표 색 (테두리 · 빛) / 등급 스타일 (UIScene 이 카드 앞면·뒷면·뒤집기 연출에 쓴다)
//  합성 +2 에 한 등급 승급 (커먼 → 언커먼 → 레어 …)
export const GRADES = ['커먼', '언커먼', '레어', '유니크', '전설'];
export const GRADE = { 커먼: 0xd0d7de, 언커먼: 0x3ec46d, 레어: 0x00b4d8, 유니크: 0xb5179e, 전설: 0xffb703 };
export const GRADE_STYLE = {
  커먼: { en: 'COMMON', border: ['#d0d7de', '#d0d7de'], bg: ['#1c2638', '#0d1220'], glow: 0x9ab8ff },
  언커먼: { en: 'UNCOMMON', border: ['#3ec46d', '#8affb0'], bg: ['#0e3a24', '#061a10'], glow: 0x3ec46d },
  레어: { en: 'RARE', border: ['#00b4d8', '#48e5ff'], bg: ['#08304a', '#061424'], glow: 0x00b4d8 },
  유니크: { en: 'UNIQUE', border: ['#b5179e', '#7209b7'], bg: ['#2e0a3e', '#12061e'], glow: 0xb5179e },
  전설: { en: 'LEGENDARY', border: ['#ffb703', '#ff0054'], bg: ['#3e2208', '#1e0612'], glow: 0xffb703 }
};
// 🎰 지방(챕터)별 카드 등급 등장 확률 (%) — 기술머신 캡슐 · 빛나는 TM 코어 · 스킬 강화 등급 · 특성 등급 · 원작 개조 모두 이 표를 따른다
//  관동엔 전설이 아예 나오지 않는다 (히든 전설 보상도 관동에선 유니크 한 장이 최고) · 커먼 + 언커먼이 70 ~ 90%
export const GRADE_W = [
  { 커먼: 68, 언커먼: 25, 레어: 6.5, 유니크: .5, 전설: 0 },     // 1 관동
  { 커먼: 55, 언커먼: 30, 레어: 12, 유니크: 2.5, 전설: .5 },     // 2 성도
  { 커먼: 42, 언커먼: 33, 레어: 18, 유니크: 5.5, 전설: 1.5 },    // 3 호연
  { 커먼: 42, 언커먼: 33, 레어: 18, 유니크: 5.5, 전설: 1.5 },    // 4 신오
  { 커먼: 30, 언커먼: 35, 레어: 23, 유니크: 9, 전설: 3 },        // 5 하나
  { 커먼: 30, 언커먼: 35, 레어: 23, 유니크: 9, 전설: 3 }         // 6 가라르
];
export const gradeW = ci => GRADE_W[Math.max(0, Math.min(GRADE_W.length - 1, ci || 0))];
// 기술 카드 등급: 대기술은 전설 · 주력기는 유니크 · 나머지는 레어
const MOVE_GRADE = {
  solar_beam: '전설', earthquake: '전설', draco_meteor: '전설', hyper_beam: '전설', giga_impact: '전설', thunder: '전설', fire_blast: '전설', hydro_pump: '전설', close_combat: '전설',
  outrage: '전설', leaf_storm: '전설', brave_bird: '전설',
  hurricane: '유니크', psychic: '유니크', surf: '유니크', dragon_claw: '유니크', dragon_pulse: '유니크', ice_beam: '유니크', thunderbolt: '유니크', stone_edge: '유니크', flamethrower: '유니크',
  shadow_ball: '유니크', earth_power: '유니크', moonblast: '유니크', play_rough: '유니크', dark_pulse: '유니크', sludge_bomb: '유니크', flash_cannon: '유니크', x_scissor: '유니크',
  drain_punch: '유니크', wild_charge: '유니크', body_press: '유니크', psyshock: '유니크', night_slash: '유니크'
};
// ---------------- ✨ 보유 카드 강화 (오염 구역 정화 보상 — 샛길 정화 3곳 · 6곳) ----------------
// 파티가 지닌 카드 가운데 한 단계 더 올릴 수 있는 것 [{ m, card }] — 기술머신으로 배운 기술 · 스킬 강화 · 특성 (+3강 ★초월 · 겹칠 수 없는 카드는 빠진다)
//  card 는 기술머신 카드와 같은 모양이라 applyCard 가 그대로 합성한다 (원작 개조 · 숙련 카드는 강화 단계가 없다)
export function ownedUpgrades(p) {
  const out = [];
  for (const m of (p && p.members) || []) {
    for (const id of Object.keys(m.cardGrade || {})) {
      const sk = SKILLS[id];
      if (!sk || DASH_ONLY.has(id)) continue;
      const card = { kind: 'move', id, name: sk.name, type: sk.type, grade: m.cardGrade[id], desc: sk.desc, cd: sk.cd, cat: '기술 카드 · 강화', who: [m.key], dup: true };
      if (heldLv(m, card) < CARD_MAX_LV) out.push({ m, card });
    }
    const seen = new Set();
    for (const e of m.boostCards || []) {
      const k = e.skill + ':' + e.bk;
      if (seen.has(k) || !SKILLS[e.skill] || !BOOSTS[e.bk]) continue;
      seen.add(k);
      const slot = ['z', 'x', 'c'].find(s => m.skills[s] === e.skill), card = Object.assign(boostCard(Object.assign({}, e, { owner: m.key }), slot), { who: [m.key] });
      if (heldLv(m, card) < CARD_MAX_LV) out.push({ m, card });
    }
    for (const [id, n] of Object.entries(m.perks || {})) {
      const pk = PERKS[id];
      if (!pk || !n || n >= Math.min(pk.max, CARD_MAX_LV + 1)) continue;
      out.push({ m, card: { kind: 'perk', id, name: pk.name, type: PERK_TYPE[id] || 'normal', grade: pk.grade, desc: pk.desc, cat: pk.cat, who: [m.key] } });
    }
  }
  return out;
}
// 강화 미리보기 수치 표: 특성 카드 mods 키 → [이름, 모양, 배율] (up: 곱 +% · down: 곱 -% · pct: 더하는 % · n: 개수 · sec: 초 · x: 배)
const PERK_STAT = {
  atkMul: ['공격력', 'up'], cdMul: ['기술 쿨타임', 'down'], hpMul: ['최대 체력', 'up'], speedMul: ['이동 속도', 'up'], dashCdMul: ['대시 쿨타임', 'down'], guard: ['받는 피해', 'down'],
  swapCdMul: ['교대 쿨타임', 'down'], regen: ['초당 회복', 'pct1'], crit: ['급소율', 'pct'], lifesteal: ['흡혈', 'pct'], sizeAdd: ['판정 · 이펙트 크기', 'pct'], dashInvAdd: ['대시 무적', 'sec'],
  extraJumps: ['공중 점프', 'n'], pBurn: ['화상 확률', 'pct'], pFreeze: ['빙결 확률', 'pct'], pPara: ['마비 확률', 'pct'], pPoison: ['맹독 확률', 'pct'], extraProj: ['투사체', 'n'],
  dashDist: ['대시 거리', 'pct'], dashGale: ['대시 뒤 이동 속도', 'pct', .05], extraAirDash: ['공중 대시', 'n'], dashSpark: ['스파크 피해 (평타 대비)', 'pct', .8], dashReload: ['회피 시 쿨타임 감소', 'sec', .8],
  parryCdMul: ['헛방 쿨타임', 'down'], parryWinMul: ['패링 판정 시간', 'up'], parryHeal: ['패링 회복', 'pct'], reflectAmp: ['패링 반사 데미지', 'pct', .15], parryWave: ['충격파 위력', 'pct', .6],
  parryCounter: ['반격 기술 피해', 'pct', .15], razorPow: ['반사 · 카운터 피해', 'pct'], razorStag: ['보스 그로기 누적', 'x'], overCharge: ['차징 샷 피해', 'pct'], overBoom: ['폭발 반경', 'x'],
  allMul: ['최종 공격력', 'up'], dashInvX: ['대시 무적', 'x'], dashCrit: ['확정 치명타 시간', 'sec'], bloodRage: ['저체력 최대 공격력', 'pct'], heavyHit: ['평타 1타 피해', 'pct'],
  heavyStag: ['평타 그로기', 'x'], skillPow: ['기술 피해', 'pct'], skillSize: ['기술 크기', 'x'], nearPow: ['근접 피해', 'pct'], berserk: ['위기 공격력', 'pct'], execute: ['마무리 피해', 'pct'],
  thorns: ['가시 반사 피해', 'pct', 1 / 1.2],
  bandMul: ['평타(Z) 피해', 'up'], specsMul: ['기술(X · C) 피해', 'up'], comboHaste: ['평타 속도', 'pct'], critDmg: ['치명타 피해', 'pct'], chargeFast: ['차징 시간', 'neg'],
  jumpAdd: ['점프력', 'pct'], kbResist: ['피격 넉백', 'neg'], stagAdd: ['보스 그로기 누적', 'pct']
};
// 양날의 검 대가 (합성하면 완화된다)
const COST_STAT = {
  parryWinMul: ['패링 판정 시간', 'signed'], whiffCdAdd: ['헛방 쿨타임', 'secp'], chargeSlow: ['차징 중 이동 속도', 'neg'], chargeHurt: ['차징 중 받는 피해', 'pctp'], hpMul: ['최대 체력', 'signed'],
  invMul: ['피격 무적 시간', 'signed'], dashCdMul: ['대시 쿨타임', 'signed'], potionCut: ['상처약 회복 효율', 'neg'], comboSlow: ['평타 속도', 'neg'], finishLag: ['피니시 후딜레이', 'secp'],
  castCost: ['기술 체력 코스트', 'pct1'], farCut: ['원거리 피해', 'neg']
};
const pctS = v => `${Math.round(v * 100)}%`;
function fmtStat(f, v) {
  const [, kind, k = 1] = f;
  if (kind === 'up') return `+${pctS((v ?? 1) - 1)}`;
  if (kind === 'down') return `-${pctS(1 - (v ?? 1))}`;
  if (kind === 'signed') return (v ?? 1) >= 1 ? `+${pctS((v ?? 1) - 1)}` : `-${pctS(1 - (v ?? 1))}`;
  if (kind === 'neg') return `-${pctS((v || 0) * k)}`;
  if (kind === 'pctp' || kind === 'pct') return `+${pctS((v || 0) * k)}`;
  if (kind === 'pct1') return `${((v || 0) * k * 100).toFixed(1)}%`;
  if (kind === 'n') return `+${Math.round((v || 0) * k)}`;
  if (kind === 'sec' || kind === 'secp') return `+${((v || 0) * k).toFixed(2)}초`;
  if (kind === 'x') return `×${(1 + (v || 0) * k).toFixed(1)}`;
  return String(v);
}
// 차징 카드는 수치 mods 가 없어 장 수로 설명한다 (Player.chargeMax · CHG_FAST · chargeShockField)
const CHARGE_LINE = {
  u_charge: (a, b) => ['차징 단계', `${a + 1}단`, `${b + 1}단`],
  u_rapid: (a, b) => ['차징 시간', `-${[0, 15, 25, 35][Math.min(3, a)]}%`, `-${[0, 15, 25, 35][Math.min(3, b)]}%`],
  u_shock: (a, b) => ['폭발 장판 크기 · 위력', `×${(1 + .3 * (a - 1)).toFixed(1)}`, `×${(1 + .3 * (b - 1)).toFixed(1)}`]
};
// 보유 카드 한 장을 한 단계 올렸을 때: { from, to, promote(+2 등급 승급), max(★초월), grade(올린 뒤 등급), lines: [{ label, a, b, cost }] }
export function upgradeInfo(m, card) {
  const from = heldLv(m, card), to = Math.min(CARD_MAX_LV, from + 1), pv = mergePreview(m, card), lines = [];
  if (card.kind === 'boost') {
    const e = (m.boostCards || []).find(q => q.skill === card.skill && q.bk === card.bk), a = e ? e.amt : card.amt, A = x => a * lvMul(x);
    const label = { power: '기술 위력', haste: '쿨타임', wide: '범위 · 탄 크기', split: '분열 유도탄' }[card.bk];
    if (card.bk === 'split') lines.push({ label, a: `${Math.round(A(from))}갈래`, b: `${Math.round(A(to))}갈래` });
    else if (card.bk === 'haste') lines.push({ label, a: `-${pctS(Math.min(.6, A(from)))}`, b: `-${pctS(Math.min(.6, A(to)))}` });
    else lines.push({ label, a: `+${pctS(A(from))}`, b: `+${pctS(A(to))}` });
  } else if (card.kind === 'move') {
    lines.push({ label: '기술 위력', a: `+${pctS(LV_GAIN * from)}`, b: `+${pctS(LV_GAIN * to)}` }, { label: '범위', a: `+${pctS(.25 * from)}`, b: `+${pctS(.25 * to)}` });
  } else if (card.kind === 'perk') {
    const pk = PERKS[card.id], n = (m.perks || {})[card.id] || 0, A = perkMods({ [card.id]: n }), B = perkMods({ [card.id]: n + 1 });
    for (const k of Object.keys(pk.mods)) { const f = PERK_STAT[k]; if (f && lines.length < 2) lines.push({ label: f[0], a: fmtStat(f, A[k]), b: fmtStat(f, B[k]) }); }
    if (!lines.length && CHARGE_LINE[card.id]) { const [label, a, b] = CHARGE_LINE[card.id](n, n + 1); lines.push({ label, a, b }); }
    if (!lines.length) lines.push({ label: '효과', a: `×${lvMul(n - 1).toFixed(1)}`, b: `×${lvMul(n).toFixed(1)}` });
    const ck = Object.keys(pk.cost || {})[0], cf = ck && COST_STAT[ck];
    if (cf) lines.push({ label: '대가 · ' + cf[0], a: fmtStat(cf, A[ck]), b: fmtStat(cf, B[ck]), cost: true });
  }
  return { from, to, promote: to === 2, max: to >= CARD_MAX_LV, grade: pv ? pv.grade : card.grade, lines, bonus: to >= CARD_MAX_LV ? MAX_BONUS[card.kind] : '' };
}

// 특성 카드 분류 → 카드에 붙는 알약 글자 · 속성 부여 카드는 그 속성 색
export const PERK_TYPE = { r_spark: 'electric', r_wave: 'fighting', r_amplify: 'psychic', u_rapid: 'electric', u_shock: 'fire', u_charge: 'electric', r_burn: 'fire', r_freeze: 'ice', r_para: 'electric', r_poison: 'poison', u_curse: 'ghost', u_chain: 'electric', l_storm: 'electric', u_flame: 'fire', u_toxic: 'poison', l_hole: 'dark' };

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// 등급을 지방 확률표 W 그대로 굴리고 → 그 등급 카드가 목록에 없으면 가까운 낮은 등급 → 그래도 없으면 높은 등급 (확률 0 인 등급은 아예 고르지 않는다)
//  (예전엔 목록에 있는 등급끼리 다시 나눠, 낮은 등급 기술이 없는 파티에선 레어 · 유니크가 표보다 자주 나왔다) → 그 등급 안에서 w(카드) 가중으로 고른다
//  noUp: 굴린 등급보다 높게는 올리지 않는다 (없으면 null — 그 칸은 같은 등급의 다른 카드로 채운다 · 위력 80 이상 기술뿐인 파티에서 레어가 표보다 많이 나오지 않게)
function pickGraded(list, w = () => 1, W = GRADE_W[0], noUp = false) {
  const have = GRADES.filter(g => W[g] > 0 && list.some(c => c.grade === g));
  if (!have.length) return null;
  const gi = GRADES.indexOf(rollGrade(W)), order = [...GRADES.slice(0, gi + 1).reverse(), ...(noUp ? [] : GRADES.slice(gi + 1))], g = order.find(x => have.includes(x));
  if (!g) return null;
  const sub = list.filter(c => c.grade === g);
  let q = Math.random() * sub.reduce((s, c) => s + w(c), 0);
  for (const c of shuffle(sub.slice())) if ((q -= w(c)) < 0) return c;
  return sub[0];
}
function rollGrade(W = GRADE_W[0]) {
  let r = Math.random() * GRADES.reduce((s, g) => s + W[g], 0);
  for (const g of GRADES) { r -= W[g]; if (r < 0) return g; }
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

// 차징 카드 (game/Perks.js · 모든 포켓몬 공용): 4장 중 하나도 없으면 이 확률로 자유 칸을 차징 카드로 바꾼다 (자연 등장과 합쳐 30% 이상)
export const CHARGE_PERKS = ['u_charge', 'u_rapid', 'u_shock', 'c_charge_stab', 'n_focus_shot'];   // 커먼 차징 안정화 · 언커먼 응축 사격 훈련도 (지방 등급 확률을 지키며 차징 카드가 나오게)
const CHARGE_CARD_P = .15;

// 파티 p 에게 맞는 서로 다른 카드 '반드시 4장'
//  ① 지금 가진 기술 강화 카드 2장 — 원작 개조(up)가 남아 있으면 30%로 그쪽, 아니면 스킬 강화(boost) · 출전 중인 포켓몬의 기술이 두 배로 잘 나온다
//  ② 새 기술 카드 1장 확정 — 파티 누구의 속성도 아닌 '다른 속성' 기술을 3배 자주 (속성 조합 짜기)
//  ③ 자유 칸: 60% 새 기술 카드(대기술일수록 드물게 — 전설 1 : 유니크 3 : 레어 6) · 40% 특성 카드(등급을 굴려 가까운 등급부터)
//  ④ 그래도 모자라면 남은 아무 카드 → 숙련 카드
//  o.floor: 이 등급보다 낮게 나오면 끌어올린다 · o.legend: 한 장은 반드시 전설 (히든 전설 정화 보상 — 전설이 없는 관동은 유니크)
//  🎰 등급은 지금 지방의 확률표(GRADE_W · o.ci 가 없으면 p.scene.stageIdx)를 따른다 — 그 지방 확률이 0 인 등급(관동의 전설)은 어떤 칸에도 나오지 않는다
export function rollCards(p, o = {}) {
  const W = gradeW(o.ci ?? (p.scene && p.scene.stageIdx) ?? 0), ok = c => W[c.grade] > 0, topI = GRADES.reduce((t, g, i) => (W[g] > 0 ? i : t), 0);
  const C0 = partyCandidates(p), moves = C0.moves.filter(ok), ups = C0.ups.filter(ok), boosts = C0.boosts, perks = C0.perks.filter(ok), out = [], used = new Set();
  const legendG = GRADES[topI], floor = Math.min(GRADES.indexOf(o.floor || '커먼'), o.legend && W['전설'] <= 0 ? topI - 1 : topI);
  const all = p.members.map(m => m.key);
  const key = c => c.kind + ':' + c.id;
  const take = list => { const c = shuffle(list.filter(q => !used.has(key(q))))[0]; if (c) { used.add(key(c)); out.push(c); } return c; };
  const takeMove = () => {
    const pool = moves.filter(c => !used.has(key(c)) && GRADES.indexOf(c.grade) >= floor);
    const list = pool.length ? pool : moves.filter(c => !used.has(key(c)));
    const c = pickGraded(list, undefined, W, true);
    if (c) { used.add(key(c)); out.push(c); }
    return c;
  };
  const boostGrade = () => GRADES[Math.min(topI, Math.max(GRADES.indexOf(rollGrade(W)), floor))];
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
    const g = GRADES[Math.min(topI, Math.max(floor, GRADES.indexOf(rollGrade(W))))], same = upList.filter(c => c.grade === g);   // 한 칸에 등급은 한 번만 굴린다
    if (same.length && Math.random() < .5) return take(same);   // 원작 개조(유니크 · 전설)는 그 등급이 굴러 나왔을 때만 — 지방 확률 그대로 드물게
    return takeBoost(g) || (Math.random() < .15 && take(upList));
  };
  if (o.legend) {
    const legendOthers = moves.concat(ups, perks).filter(c => c.grade === legendG);
    if (!(Math.random() < .5 && takeBoost(legendG))) take(legendOthers) || takeBoost(legendG);
  }
  while (out.filter(c => c.kind === 'boost' || c.kind === 'up').length < 2 && out.length < TM_CARDS - 1 && takeEnhance());
  // 새 기술 확정 칸: 아직 배우지 않은 기술 · 파티에 없는 속성이면 3배 (카드에 '다른 속성' 표시)
  {
    const own = new Set(p.members.flatMap(m => p.typesOf(m))), open = moves.filter(c => !c.dup && !used.has(key(c)));
    const high = open.filter(c => GRADES.indexOf(c.grade) >= floor), fresh = high.length ? high : open;   // 전설 제단: 최소 등급부터
    if (fresh.length && fresh.some(ok)) {
      const pick = pickGraded(fresh, c => (own.has(c.type) ? 1 : 3), W, !o.legend);   // 등급을 굴린 뒤 그 등급 안에서 다른 속성 3배 (굴린 등급의 새 기술이 없으면 이 칸은 다른 카드로)
      if (pick) {
        if (!own.has(pick.type)) pick.cat = '새 기술 · 다른 속성';
        used.add(key(pick)); out.push(pick);
      }
    }
  }
  while (out.length < TM_CARDS) {
    if (Math.random() < .6 && takeMove()) continue;
    const gi = Math.min(topI, Math.max(floor, GRADES.indexOf(rollGrade(W)))), g = GRADES[gi];
    const order = [g, ...GRADES.slice(0, gi).reverse(), ...GRADES.slice(gi + 1)].filter(gg => W[gg] > 0);   // 같은 등급 → 낮은 등급 → 높은 등급 (이 지방에 없는 등급은 빼고)
    let got = null;
    for (const gg of order) if ((got = take(perks.filter(c => c.grade === gg)))) break;
    if (!got && !takeMove() && !takeEnhance()) break;
  }
  // 차징 카드 등장 보장: 4장 중 차징 카드가 없으면 CHARGE_CARD_P 확률로 맨 뒤(자유 칸) 한 장을 차징 카드로 바꾼다 (전설 연출 카드는 그대로)
  //  초고압 차징 코어(단계 해금)를 가장 자주 · 다 익힌 카드는 partyCandidates 가 이미 뺐다
  const isChg = c => c.kind === 'perk' && CHARGE_PERKS.includes(c.id), chg = perks.filter(c => isChg(c) && !used.has(key(c)));
  const chgPick = chg.length && !out.some(isChg) && Math.random() < CHARGE_CARD_P ? pickGraded(chg, c => (c.id === 'u_charge' ? 3 : 1), W, true) : null;
  if (chgPick) {
    const pick = chgPick;   // 지방 등급 확률을 그대로 따른다 (굴린 등급보다 높게는 안 올린다) · 같은 등급이면 초고압 차징 코어 3배
    used.add(key(pick));
    const i = out.length < TM_CARDS ? out.length : out.map((c, k) => (o.legend && c.grade === '전설' ? -1 : k)).filter(k => k >= 0).pop();
    if (pick) out[i ?? out.length] = pick;
  }
  for (const [id, c] of Object.entries(MASTERY)) if (out.length < TM_CARDS) out.push({ kind: 'mastery', id, name: c.name, type: 'normal', grade: c.grade, desc: c.desc, cat: '숙련', who: all });
  // o.n: 그보다 적게 (전투 데이터 축적 보너스 · 빛나는 TM 코어는 3장) — 자유 칸부터 덜어 낸다
  const keep = o.n && o.n < out.length ? out.slice(0, o.n) : out;
  // 합성 승급(+2 에 한 등급 위)으로 이 지방에 없는 등급이 되면(관동의 전설) 그 카드는 빼고 숙련 카드로 채운다
  const dressed = shuffle(keep).slice(0, TM_CARDS).map(c => dressCard(p, c)).filter(c => c.kind === 'mastery' || W[c.grade] > 0);
  for (const [id, c] of Object.entries(MASTERY)) if (dressed.length < Math.min(TM_CARDS, keep.length) && !dressed.some(q => q.id === id)) dressed.push({ kind: 'mastery', id, name: c.name, type: 'normal', grade: c.grade, desc: c.desc, cat: '숙련', who: all });
  return dressed;
}

// 🃏 카드 샌드박스 (테스트 모드 · UIScene 테스트 패널 '카드' 탭): 제약 없이 모든 카드 — group 으로 분류
//  move: 액티브 기술 (기술머신 45종 + 계열 전용 · 대시 같은 돌진 기술 제외) · boost: 원작 개조 + 출전 중인 포켓몬의 Z·X·C 스킬 강화(갈래 × 레어 · 유니크 · 전설)
//  charge: 2 · 3단 차징 해금 등 차징 카드 · dash: 대시 진화 · perk: 그 밖의 특성(능력치 · 기동 · 속성 부여 · 스킬 변이 · 유물 · 유틸) · mastery: 숙련
export const SANDBOX_GROUPS = [['all', '전체'], ['move', '액티브 기술'], ['boost', '기술 강화'], ['charge', '차징'], ['dash', '대시'], ['parry', '패링'], ['curse', '양날의 검'], ['perk', '특성 · 스탯'], ['mastery', '숙련']];
export function sandboxCards(p) {
  const out = [], m = p.m;
  const ids = [...new Set([...Object.keys(TM_LEARN), ...Object.values(TM_POOL).flat()])].filter(id => SKILLS[id] && !DASH_ONLY.has(id) && SKILLS[id].arch !== 'dash');
  for (const id of ids) { const s = SKILLS[id]; out.push({ group: 'move', kind: 'move', id, name: s.name, type: s.type, grade: moveGrade(id), desc: s.desc, cd: s.cd, cat: '새 기술 · 습득' }); }
  for (const [id, u] of Object.entries(UPGRADES)) if (SKILLS[u.skill]) out.push({ group: 'boost', kind: 'up', id, name: u.name, type: SKILLS[u.skill].type, grade: u.grade, desc: u.desc, skill: u.skill, cat: '원작 개조' });
  for (const slot of ['z', 'x', 'c']) {
    const sid = m.skills[slot], sk = SKILLS[sid];
    if (!sk) continue;
    for (const bk of Object.keys(BOOSTS)) {
      if (BOOSTS[bk].cdOnly && !sk.cd) continue;
      for (const grade of GRADES) out.push(Object.assign(boostCard({ bk, skill: sid, owner: m.key, grade, amt: BOOSTS[bk].amt[grade] }, slot), { group: 'boost', who: [m.key] }));
    }
  }
  for (const [id, pk] of Object.entries(PERKS)) out.push({ group: pk.cat === '차징' ? 'charge' : pk.cat === '대시 진화' || pk.cat === '대시' ? 'dash' : pk.cat === '패링' ? 'parry' : pk.curse ? 'curse' : 'perk', kind: 'perk', id, name: pk.name, type: PERK_TYPE[id] || 'normal', grade: pk.grade, desc: pk.desc, cat: pk.cat, max: pk.max });
  for (const [id, c] of Object.entries(MASTERY)) out.push({ group: 'mastery', kind: 'mastery', id, name: c.name, type: 'normal', grade: c.grade, desc: c.desc, cat: '숙련' });
  const gi = c => SANDBOX_GROUPS.findIndex(g => g[0] === c.group);
  return out.sort((a, b) => gi(a) - gi(b) || GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade) || (a.kind === 'boost' && b.kind === 'boost' ? 0 : a.name.localeCompare(b.name, 'ko')));
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
  m.mastery = (m.mastery || 0) + 1;   // 카드 점수 (cardScore)
  return card.name;
}