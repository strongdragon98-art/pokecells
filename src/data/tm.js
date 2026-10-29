// 기술머신(TM): 맵 샛길 끝 제단에서 카드 3장을 뒤집어 보고 1장을 고른다 (UI 는 scenes/UIScene.showTM)
//  카드 두 종류 — move: 타 속성 기술 습득(Z·X·C 중 하나와 교체) · up: 지금 가진 기술 강화
//  카드는 '지금 출전 중인 포켓몬' 기준으로 뽑고, 받은 것은 그 포켓몬에게만 남는다 (Player.members[i].skills · ups)
import { SKILLS } from './pokemon.js';

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
  blast_cross: { skill: 'scratch_ember', name: '할퀴기 진화: 폭열 크로스', grade: '영웅', desc: '할퀴기 사거리 +40%. 마지막 X자 타격 때 전방에 화염 기둥이 폭발한다.' },
  hydro_pump: { skill: 'tackle_watergun', name: '물대포 진화: 하이드로펌프', grade: '전설', desc: '3타 물대포가 적을 끝까지 밀어내는 넉백 물줄기 광선으로 바뀐다.' },
  tidal_spin: { skill: 'rapid_spin', name: '고속스핀 개조: 소용돌이 스핀', grade: '영웅', desc: '고속스핀 범위·위력 ×1.5, 메가가 아니어도 적 투사체를 되받아친다.' },
  hundred_flowers: { skill: 'razor_leaf', name: '잎날가르기 개조: 백화요란', grade: '전설', desc: '잎날 크기 2배 · 피해 +40% · 잎날 1장 추가. 꿰뚫고 돌아오며 2번 벤다.' },
  thorn_lash: { skill: 'vine_whip', name: '덩굴채찍 진화: 가시채찍', grade: '영웅', desc: '덩굴채찍 사거리 +35%. 채찍 끝이 꺾이는 자리에서 가시가 폭발한다.' },
  rail_storm: { skill: 'thundershock', name: '전기쇼크 개조: 레일 쇼크', grade: '영웅', desc: '모든 전기탄이 크고 빨라지며 적 3마리까지 꿰뚫는다.' },
  storm_lord: { skill: 'thunderbolt', name: '10만볼트 진화: 뇌신', grade: '전설', desc: '번개를 맞는 적 +3마리, 맞은 적끼리 번개가 연쇄로 이어진다.' },
  vampire_fang: { skill: 'leech_life', name: '흡혈 진화: 흡혈귀의 송곳니', grade: '영웅', desc: '흡혈 회복 +20%, 물기 사거리 +30%.' },
  sonic_storm: { skill: 'supersonic', name: '초음파 개조: 음파 폭풍', grade: '영웅', desc: '초음파가 사방으로 퍼지고 범위 ×1.6 · 위력 ×1.5.' },
  iron_chop: { skill: 'karate_chop', name: '태권당수 진화: 강철 당수', grade: '영웅', desc: '3타 위력 ×1.3, 마지막 타격마다 관통 충격파가 날아간다.' },
  meteor_fist: { skill: 'dynamic_punch', name: '폭발펀치 개조: 메테오 너클', grade: '전설', desc: '폭발 반경 ×1.6 · 위력 ×1.4.' },
  phantom_tongue: { skill: 'lick_shadow', name: '핥기 진화: 망령의 혀', grade: '영웅', desc: '3타 섀도볼이 커지고 적을 쫓아가며, 맞은 적을 저주한다.' },
  nightmare_orb: { skill: 'shadow_ball', name: '섀도볼 개조: 악몽의 구슬', grade: '전설', desc: '섀도볼 2개 추가, 폭발 반경 ×1.3.' }
};

// 고를 카드가 모자랄 때 채우는 숙련 카드 (그 포켓몬 능력치)
export const MASTERY = {
  power_memory: { name: '숙련의 기억: 힘', grade: '일반', desc: '이 포켓몬의 공격력 +12%.', apply: m => { m.atkBonus *= 1.12; } },
  quick_memory: { name: '숙련의 기억: 집중', grade: '일반', desc: '이 포켓몬의 모든 기술 쿨타임 -12%.', apply: m => { m.cdBonus *= .88; } }
};

// 카드 등급 → 테두리 색
export const GRADE = { 일반: 0xa8a8b8, 희귀: 0x5aa8ff, 영웅: 0xc07aff, 전설: 0xffc84a };
const MOVE_GRADE = { solar_beam: '전설', earthquake: '전설', hurricane: '영웅', psychic: '영웅', surf: '영웅', dragon_claw: '영웅', ice_beam: '영웅' };

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 출전 중인 포켓몬 m 에게 맞는 카드 3장: 타 속성 기술과 강화 카드를 섞되 둘 다 있으면 한 장씩은 꼭 넣는다
export function rollCards(m) {
  const known = new Set([...Object.values(m.skills), ...(m.learned || [])]);   // 배웠다가 빼 둔 기술도 다시 나오지 않게
  const moves = shuffle((TM_POOL[m.key] || []).filter(id => !known.has(id) && SKILLS[id]))
    .map(id => ({ kind: 'move', id, name: SKILLS[id].name, type: SKILLS[id].type, grade: MOVE_GRADE[id] || '희귀', desc: SKILLS[id].desc, cd: SKILLS[id].cd }));
  const ups = shuffle(Object.entries(UPGRADES).filter(([id, u]) => known.has(u.skill) && !m.ups.has(id)))
    .map(([id, u]) => ({ kind: 'up', id, name: u.name, type: SKILLS[u.skill].type, grade: u.grade, desc: u.desc, skill: u.skill }));
  const out = [];
  if (moves.length) out.push(moves.shift());
  if (ups.length) out.push(ups.shift());
  const rest = shuffle(moves.concat(ups));
  while (out.length < 3 && rest.length) out.push(rest.shift());
  for (const [id, c] of Object.entries(MASTERY)) if (out.length < 3) out.push({ kind: 'mastery', id, name: c.name, type: 'normal', grade: c.grade, desc: c.desc });
  return shuffle(out);
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
  MASTERY[card.id].apply(m);
  return card.name;
}
