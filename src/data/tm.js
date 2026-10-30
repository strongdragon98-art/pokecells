// 기술머신(TM): 맵 샛길 끝 제단에서 카드 3장을 뒤집어 보고 1장을 고른다 (UI 는 scenes/UIScene.showTM)
//  카드 세 종류 — move: 새 액티브 기술 습득(X·C 자리에 장착/교체 · 연타 기술이 아니면 Z 도) · up: 지금 가진 기술 강화 · perk: 특성 카드(game/Perks.js, 40종 이상)
//  3장 중 1~2장은 반드시 [기술 습득 카드] (2장일 확률 55% → 평균 절반 이상). 기술은 그 포켓몬이 원작·타입상 배울 수 있는 것만 (TM_LEARN)
//  등급 4단계: 커먼 · 레어 · 유니크 · 전설 (특성·강화 카드가 뽑힐 확률 55 · 28 · 13 · 4%)
//  카드는 '지금 출전 중인 포켓몬' 기준으로 뽑고, 받은 것은 그 포켓몬에게만 남는다 (Player.members[i].skills · ups)
import { SKILLS } from './pokemon.js';
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
const PERK_TYPE = { u_charge: 'electric', r_burn: 'fire', r_freeze: 'ice', r_para: 'electric', r_poison: 'poison', u_curse: 'ghost', u_chain: 'electric', l_storm: 'electric', u_flame: 'fire', u_toxic: 'poison', l_hole: 'dark' };

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function rollGrade() {
  let r = Math.random() * 100;
  for (const g of GRADES) { r -= WEIGHT[g]; if (r < 0) return g; }
  return '커먼';
}

// 이 포켓몬(m)이 지금 받을 수 있는 모든 카드
function candidates(m, types) {
  const known = new Set([...Object.values(m.skills), ...(m.learned || [])]);   // 배웠다가 빼 둔 기술도 다시 나오지 않게
  const own = new Set(types || m.sp.types || []);
  const ids = learnableMoves([...own, ...(m.sp.types || [])], m.key).filter(id => !known.has(id));
  const moves = ids.map(id => ({ kind: 'move', id, name: SKILLS[id].name, type: SKILLS[id].type, grade: moveGrade(id), desc: SKILLS[id].desc, cd: SKILLS[id].cd,
    cat: own.has(SKILLS[id].type) ? '새 기술 · 자속성' : '새 기술 · 습득' }));
  const ups = Object.entries(UPGRADES).filter(([id, u]) => known.has(u.skill) && !m.ups.has(id) && SKILLS[u.skill])
    .map(([id, u]) => ({ kind: 'up', id, name: u.name, type: SKILLS[u.skill].type, grade: u.grade, desc: u.desc, skill: u.skill, cat: '기술 강화' }));
  const perks = Object.entries(PERKS).filter(([id, pk]) => ((m.perks || {})[id] || 0) < pk.max)
    .map(([id, pk]) => ({ kind: 'perk', id, name: pk.name, type: PERK_TYPE[id] || 'normal', grade: pk.grade, desc: pk.desc, cat: pk.cat }));
  return { moves, ups, perks };
}

// 출전 중인 포켓몬 m 에게 맞는 서로 다른 카드 '반드시 3장'
//  ① 신기술 카드 1~2장 (2장일 확률 55%) — 배울 수 있는 기술이 남아 있는 한 무조건. 등급은 대기술일수록 드물게(전설 1 : 유니크 3 : 레어 6)
//  ② 남은 칸: 등급을 굴려 강화·특성 카드에서 하나 → 그 등급이 비면 가까운 등급부터 → 그래도 없으면 남은 기술 카드 → 숙련 카드
//  o.floor: 이 등급보다 낮게 나오면 끌어올린다 · o.legend: 한 장은 반드시 전설 (히든 전설 정화 보상) · o.types: 지금 모습의 타입
export function rollCards(m, o = {}) {
  const { moves, ups, perks } = candidates(m, o.types), out = [], used = new Set(), floor = GRADES.indexOf(o.floor || '커먼');
  const key = c => c.kind + ':' + c.id;
  const take = list => { const c = shuffle(list.filter(q => !used.has(key(q))))[0]; if (c) { used.add(key(c)); out.push(c); } return c; };
  const others = ups.concat(perks), all = moves.concat(others);
  const MOVE_W = { 레어: 6, 유니크: 3, 전설: 1, 커먼: 6 };
  const takeMove = () => {
    const pool = moves.filter(c => !used.has(key(c)) && GRADES.indexOf(c.grade) >= floor);
    const list = pool.length ? pool : moves.filter(c => !used.has(key(c)));
    if (!list.length) return null;
    let r = Math.random() * list.reduce((s, c) => s + MOVE_W[c.grade], 0);
    for (const c of shuffle(list.slice())) { if ((r -= MOVE_W[c.grade]) < 0) { used.add(key(c)); out.push(c); return c; } }
    return take(list);
  };
  if (o.legend) take(all.filter(c => c.grade === '전설'));
  const wantMoves = Math.random() < .55 ? 2 : 1;
  while (out.filter(c => c.kind === 'move').length < wantMoves && out.length < 3 && takeMove());
  while (out.length < 3) {
    const gi = Math.max(floor, GRADES.indexOf(rollGrade())), g = GRADES[gi];
    const order = [g, ...GRADES.slice(0, gi).reverse(), ...GRADES.slice(gi + 1)];   // 같은 등급 → 낮은 등급 → 높은 등급
    let got = null;
    for (const gg of order) if ((got = take(others.filter(c => c.grade === gg)))) break;
    if (!got && !takeMove()) break;
  }
  for (const [id, c] of Object.entries(MASTERY)) if (out.length < 3) out.push({ kind: 'mastery', id, name: c.name, type: 'normal', grade: c.grade, desc: c.desc, cat: '숙련' });
  return shuffle(out).slice(0, 3);
}

// 고른 카드 적용. move 는 바꿀 슬롯(z·x·c)이 필요하다. 바뀐 내용을 글로 돌려준다
export function applyCard(player, m, card, slot) {
  if (card.kind === 'move') {
    const old = SKILLS[m.skills[slot]].name;
    m.skills[slot] = card.id; m.cd[slot] = 0;
    (m.cardGrade = m.cardGrade || {})[card.id] = card.grade;   // 유니크·전설 카드로 배운 기술은 시전 연출이 달라진다 (Player.gradeCast)
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