// 기술머신(TM): 맵 샛길 끝 제단에서 카드 3장을 뒤집어 보고 1장을 고른다 (UI 는 scenes/UIScene.showTM)
//  카드 세 종류 — move: 타 속성 기술 습득(Z·X·C 중 하나와 교체) · up: 지금 가진 기술 강화 · perk: 특성 카드(game/Perks.js, 40종 이상)
//  등급 4단계: 커먼 · 레어 · 유니크 · 전설 (뽑힐 확률 55 · 28 · 13 · 4%)
//  카드는 '지금 출전 중인 포켓몬' 기준으로 뽑고, 받은 것은 그 포켓몬에게만 남는다 (Player.members[i].skills · ups)
import { SKILLS } from './pokemon.js';
import { PERKS } from '../game/Perks.js';

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

// 다른 포켓몬도 배울 수 있는 범용 기술머신 (TM_POOL 에 없는 계열 · 자기 타입 기술은 빼고 '타 속성'만)
const GENERIC_TM = ['crunch', 'earthquake', 'surf', 'psychic', 'flash_cannon', 'earth_power', 'iron_tail', 'stone_edge', 'dragon_claw', 'dark_pulse',
  'ice_beam', 'thunderbolt', 'sludge_bomb', 'giga_drain', 'heat_wave', 'hurricane', 'play_rough', 'thunder_punch', 'ice_punch', 'solar_beam', 'steel_wing'];

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
const MOVE_GRADE = { solar_beam: '전설', earthquake: '전설', hurricane: '유니크', psychic: '유니크', surf: '유니크', dragon_claw: '유니크', ice_beam: '유니크', thunderbolt: '유니크', stone_edge: '유니크' };
// 특성 카드 분류 → 카드에 붙는 알약 글자 · 속성 부여 카드는 그 속성 색
const PERK_TYPE = { r_burn: 'fire', r_freeze: 'ice', r_para: 'electric', r_poison: 'poison', u_curse: 'ghost', u_chain: 'electric', l_storm: 'electric', u_flame: 'fire', u_toxic: 'poison', l_hole: 'dark' };

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function rollGrade() {
  let r = Math.random() * 100;
  for (const g of GRADES) { r -= WEIGHT[g]; if (r < 0) return g; }
  return '커먼';
}

// 이 포켓몬(m)이 지금 받을 수 있는 모든 카드
function candidates(m) {
  const known = new Set([...Object.values(m.skills), ...(m.learned || [])]);   // 배웠다가 빼 둔 기술도 다시 나오지 않게
  const types = new Set(m.sp.types || []);
  const ids = [...new Set([...(TM_POOL[m.key] || []), ...GENERIC_TM])].filter(id => SKILLS[id] && !known.has(id) && !types.has(SKILLS[id].type));
  const moves = ids.map(id => ({ kind: 'move', id, name: SKILLS[id].name, type: SKILLS[id].type, grade: MOVE_GRADE[id] || '레어', desc: SKILLS[id].desc, cd: SKILLS[id].cd, cat: '새 기술 · 타 속성' }));
  const ups = Object.entries(UPGRADES).filter(([id, u]) => known.has(u.skill) && !m.ups.has(id) && SKILLS[u.skill])
    .map(([id, u]) => ({ kind: 'up', id, name: u.name, type: SKILLS[u.skill].type, grade: u.grade, desc: u.desc, skill: u.skill, cat: '기술 강화' }));
  const perks = Object.entries(PERKS).filter(([id, pk]) => ((m.perks || {})[id] || 0) < pk.max)
    .map(([id, pk]) => ({ kind: 'perk', id, name: pk.name, type: PERK_TYPE[id] || 'normal', grade: pk.grade, desc: pk.desc, cat: pk.cat }));
  return { moves, ups, perks };
}

// 출전 중인 포켓몬 m 에게 맞는 서로 다른 카드 '반드시 3장'
//  칸마다 등급을 굴려 그 등급에서 하나 → 그 등급이 비면 가까운 등급부터 → 그래도 없으면 숙련 카드로 채운다
//  기술 카드(습득·강화)가 있으면 첫 칸은 60% 확률로 기술 카드 중에서 고른다
//  o.floor: 이 등급보다 낮게 나오면 끌어올린다 · o.legend: 한 장은 반드시 전설 (히든 전설 정화 보상)
export function rollCards(m, o = {}) {
  const { moves, ups, perks } = candidates(m), out = [], used = new Set(), floor = GRADES.indexOf(o.floor || '커먼');
  const key = c => c.kind + ':' + c.id;
  const take = list => { const c = shuffle(list.filter(q => !used.has(key(q))))[0]; if (c) { used.add(key(c)); out.push(c); } return c; };
  const skillCards = moves.concat(ups), all = skillCards.concat(perks);
  if (o.legend) take(all.filter(c => c.grade === '전설'));
  else if (skillCards.length && Math.random() < .6) take(skillCards.filter(c => GRADES.indexOf(c.grade) >= floor).length ? skillCards.filter(c => GRADES.indexOf(c.grade) >= floor) : skillCards);
  while (out.length < 3) {
    const gi = Math.max(floor, GRADES.indexOf(rollGrade())), g = GRADES[gi];
    const order = [g, ...GRADES.slice(0, gi).reverse(), ...GRADES.slice(gi + 1)];   // 같은 등급 → 낮은 등급 → 높은 등급
    let got = null;
    for (const gg of order) if ((got = take(all.filter(c => c.grade === gg)))) break;
    if (!got) break;
  }
  for (const [id, c] of Object.entries(MASTERY)) if (out.length < 3) out.push({ kind: 'mastery', id, name: c.name, type: 'normal', grade: c.grade, desc: c.desc, cat: '숙련' });
  return shuffle(out).slice(0, 3);
}

// 고른 카드 적용. move 는 바꿀 슬롯(z·x·c)이 필요하다. 바뀐 내용을 글로 돌려준다
export function applyCard(player, m, card, slot) {
  if (card.kind === 'move') {
    const old = SKILLS[m.skills[slot]].name;
    m.skills[slot] = card.id; m.cd[slot] = 0;
    if (m.learned && !m.learned.includes(card.id)) m.learned.push(card.id);   // 원래 기술은 배운 기술 목록에 그대로 남는다
    return `${old} → ${card.name} (${slot.toUpperCase()}) · 원래 기술은 가방 → 기술에서 다시 넣을 수 있다`;
  }
  if (card.kind === 'up') { m.ups.add(card.id); return card.name; }
  if (card.kind === 'perk') {
    const pk = PERKS[card.id];
    m.perks = m.perks || {};
    m.perks[card.id] = (m.perks[card.id] || 0) + 1;
    player.refreshMods(m);
    if (pk.onGet) pk.onGet(player, m);
    const n = m.perks[card.id];
    return n > 1 ? `${pk.desc} (×${n})` : pk.desc;
  }
  MASTERY[card.id].apply(m, player);
  return card.name;
}