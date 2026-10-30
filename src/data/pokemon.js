// 플레이어로 쓸 수 있는 포켓몬 / 야생 적 / 보스 / 기술 데이터
// 플레이어블 규칙: 3단 진화 계열이거나, 2단 진화 + 메가진화가 있는 계열(예: 스라크→핫삼+메가핫삼)만. 가장 처음 모습으로 시작한다.
//  2단에서 끝나는 계열(꼬렛→레트라 등)은 플레이어블이 아니라 야생 몹(WILD)으로만 쓴다. 예외: 정화한 전설 보스(진화 없음)
//  라인 정의는 data/roster.js (PlayableRosterRegistry), 라인별 전용 기술 표시 정보는 data/skills/*.js
import { LINES, toSpecies } from './roster.js';
import * as gen23 from './skills/gen23.js';
import * as gen45 from './skills/gen45.js';
import * as gen67 from './skills/gen67.js';
import * as gen89 from './skills/gen89.js';
import * as special from './skills/special.js';
import * as legend1 from './skills/legend1.js';
import * as legend2 from './skills/legend2.js';
import * as typeMoves from './skills/typeMoves.js';

export const STARTERS = ['charmander', 'squirtle', 'bulbasaur'];
export const UNLOCKABLE = ['pichu', 'zubat', 'machop', 'gastly'];   // 같은 종을 정화해 등록 (야생으로 나오는 계열)
export const DEX_ORDER = LINES.map(l => l.id);
export const UNLOCK_KILLS = 10;

// ---------------- 한 판 안의 성장: 1단 → 2단 → (Z크리스탈) → 3단 → 영구 메가진화 ----------------
// 경험치는 파티 공용 (정화 1, 보스 12). 구역마다 전투방 4개(X-1·X-2 에 1개씩, X-4 에 2개) → 예상 정화 수 ≈ 48 / 56 / 94 / 106 기준으로
//  2단: 30 → 제1구역 상록숲(1-4) 첫 방쯤 (포켓몬센터에 들른 뒤, 보스 1은 2단으로 싸운다)
//  Z크리스탈: 제2구역 보스 드랍 → 2단 끝무렵에 Q 로 Z기술
//  3단: 150 → 제3구역 첫 방쯤
//  메가스톤: 제3구역 보스 드랍 → 3단이면 V 로 영구 메가진화, 마지막 제4구역을 메가로 싸운다
export const EVO_EXP = [30, 150];
export const EXP_PURIFY = 1, EXP_BOSS = 12;
export const DROPS = { zcrystal: 0, megastone: 2 };   // 몇 번째 챕터(0부터) 최종 보스가 떨어뜨리나 — 뮤츠: Z크리스탈 · 레쿠쟈: 메가스톤
// 단계별 배율: atk 공격력 · hp 최대 체력 · size 몸집 · fx 스킬 이펙트(범위·궤적) 크기
//  proj 투사체 크기·판정 반경 (진화할수록 눈에 띄게 커진다. 꼬리·적중 연출도 단계별로 화려해짐)
export const TIERS = [
  { name: '1단', atk: 1, hp: 1, size: 1, fx: 1, proj: 1 },
  { name: '2단', atk: 1.3, hp: 1.15, size: 1.08, fx: 1.2, proj: 1.45 },
  { name: '3단', atk: 1.65, hp: 1.3, size: 1.16, fx: 1.4, proj: 1.9 },
  { name: '메가', atk: 2, hp: 1.45, size: 1.24, fx: 1.65, proj: 2.3 }
];
export const Z_CD = 45;   // Z기술 재사용 대기 (초)

// 라인 정의(data/roster.js)에서 만든다. hp/atk 는 기본값. speed=px/s, jump=초기 점프 속도, jumps=공중 점프 포함 횟수
export const SPECIES = Object.fromEntries(LINES.map(l => [l.id, toSpecies(l)]));

// 기술 표시 정보 (실제 동작은 game/skills.js · game/skills/*.js)
//  필살앞니·분노의앞니·전광석화 / tag_normal / 울트라대시어택 은 꼬렛이 플레이어블에서 빠져 지금 쓰는 포켓몬이 없다 (노말 플레이어블이 생기면 다시 쓴다)
//  라인별 전용 기술을 먼저 펼치고 아래 기본·기술머신 기술로 덮는다 — 이름이 같으면(깨물어부수기·지진·파도타기 등) 기술머신판을 쓴다
export const SKILLS = {
  ...gen23.SKILLS, ...gen45.SKILLS, ...gen67.SKILLS, ...gen89.SKILLS, ...special.SKILLS, ...legend1.SKILLS, ...legend2.SKILLS,
  scratch_ember: { name: '할퀴기·불꽃세례', type: 'fire', cd: 0, icon: 'claw', desc: '할퀴기 2연타 후 3타째에 불꽃세례 발사. 화상.', mega: '불꽃세례가 파란 불꽃 3갈래로' },
  flamethrower: { name: '화염방사', type: 'fire', cd: 6, icon: 'flame', desc: '1.2초간 전방에 화염을 뿜는다. 천천히 이동 가능.', mega: '사거리·폭 대폭 증가' },
  flame_charge: { name: '니트로차지', type: 'fire', cd: 4, icon: 'dash', desc: '화염을 두르고 돌진. 무적 + 경로상 적 관통 피해.', mega: '지나간 자리에 불길' },
  tackle_watergun: { name: '몸통박치기·물대포', type: 'water', cd: 0, icon: 'drop', desc: '몸통박치기 2연타 후 3타째에 물대포 발사.', mega: '물대포 3연사' },
  bubblebeam: { name: '거품광선', type: 'water', cd: 5, icon: 'bubble', desc: '거품을 연사해 맞은 적을 둔화시킨다.', mega: '거대 거품이 관통' },
  rapid_spin: { name: '고속스핀', type: 'normal', cd: 4, icon: 'spin', desc: '회전하며 주변을 연타하고 적 투사체를 지운다.', mega: '범위 증가 + 투사체 반사' },
  vine_whip: { name: '덩굴채찍', type: 'grass', cd: 0, icon: 'vine', desc: '긴 덩굴로 중거리 연타.', mega: '사거리 1.5배' },
  razor_leaf: { name: '잎날가르기', type: 'grass', cd: 4, icon: 'leaf', desc: '관통하며 되돌아오는 잎 부메랑 2장.', mega: '잎 4장' },
  seed_field: { name: '씨뿌리기', type: 'grass', cd: 10, icon: 'seed', desc: '발밑에 4초간 회복 장판. 안의 적은 HP를 빼앗긴다.', mega: '장판 2배 + 회복량 증가' },
  hyper_fang: { name: '몸통박치기·필살앞니', type: 'normal', cd: 0, icon: 'fang', desc: '3타째 필살앞니는 급소율이 높고 풀죽게 한다.', mega: '필살앞니 범위 증가' },
  super_fang: { name: '분노의앞니', type: 'normal', cd: 6, icon: 'fang', desc: '돌진해 적 현재 HP의 25%(보스 6%)를 깎는다.', mega: '35% / 보스 9%' },
  quick_attack: { name: '전광석화', type: 'normal', cd: 2, icon: 'dash', desc: '순식간에 앞으로 이동하며 공격. 공중 사용 가능, 무적.', mega: '2회 연속 사용' },
  thundershock: { name: '전기쇼크', type: 'electric', cd: 0, icon: 'bolt', desc: '전기탄 연사. 3발째는 크고 마비시킨다. 꾹 눌렀다 떼면 하늘에서 낙뢰.', mega: '탄이 2갈래로' },
  thunderbolt: { name: '10만볼트', type: 'electric', cd: 5, icon: 'thunder', desc: '가까운 적 3마리에게 번개를 내리꽂는다.', mega: '6마리 + 연쇄' },
  volt_tackle: { name: '볼트태클', type: 'electric', cd: 4, icon: 'dash', desc: '전기를 두르고 돌진. 강하지만 반동 피해.', mega: '반동 없음' },
  leech_life: { name: '흡혈', type: 'poison', cd: 0, icon: 'fang', desc: '물어서 준 피해의 25%를 회복.', mega: '회복 40%' },
  supersonic: { name: '초음파', type: 'normal', cd: 6, icon: 'wave', desc: '전방 음파로 적을 혼란(행동불능)시킨다.', mega: '사방으로 퍼짐' },
  wing_dash: { name: '날개치기', type: 'flying', cd: 2.5, icon: 'wing', desc: '방향키 쪽 8방향으로 돌진 공격. 공중 점프 회복.', mega: '돌진 거리 증가' },
  karate_chop: { name: '태권당수', type: 'fighting', cd: 0, icon: 'fist', desc: '3연타. 마지막 타격은 급소율이 높다.', mega: '충격파 추가' },
  dynamic_punch: { name: '폭발펀치', type: 'fighting', cd: 6, icon: 'boom', desc: '힘을 모아 폭발하는 일격. 혼란.', mega: '폭발 반경 2배' },
  counter: { name: '카운터', type: 'fighting', cd: 4, icon: 'shield', desc: '0.6초 방어 자세. 그동안 맞으면 피해 없이 3배 반격.', mega: '방어 시간 증가' },
  lick_shadow: { name: '핥기·섀도볼', type: 'ghost', cd: 0, icon: 'ghost', desc: '핥기 2연타 후 작은 섀도볼 발사. 마비 확률. 꾹 눌렀다 떼면 벽을 뚫는 거대 섀도볼.', mega: '섀도볼 유도' },
  shadow_ball: { name: '섀도볼', type: 'ghost', cd: 4, icon: 'orb', desc: '벽을 통과하는 큰 섀도볼. 적에 닿으면 폭발.', mega: '섀도볼 3개' },
  phantom_dash: { name: '고스트다이브', type: 'ghost', cd: 4, icon: 'dash', desc: '실체를 감추고 적을 통과한 뒤, 지나간 적 모두를 기습.', mega: '통과한 적에 저주' },

  // ---- 기술머신으로 배우는 타 속성 기술 (data/tm.js 의 TM_POOL · 동작은 game/skills.js) ----
  crunch: { name: '깨물어부수기', type: 'dark', cd: 4, icon: 'fang', tm: true, desc: '파고들며 검보라 송곳니로 물어뜯는다. 상성 반감을 무시하고 풀죽게 한다.' },
  giga_impact: { name: '기가임팩트', type: 'normal', cd: 10, icon: 'fist', tm: true, desc: '금빛 기운을 모아 폭주 돌진한 뒤 거대한 충격 폭발. 쓴 뒤 잠깐 반동으로 굳는다.' },
  solar_beam: { name: '솔라빔', type: 'grass', cd: 9, icon: 'thunder', tm: true, desc: '햇빛을 모았다가 앞을 꿰뚫는 거대한 노란 광선을 쏜다.' },
  hurricane: { name: '폭풍', type: 'flying', cd: 8, icon: 'spin', tm: true, desc: '천천히 나아가는 회오리가 적을 빨아들이며 여러 번 친다.' },
  thunder_punch: { name: '번개펀치', type: 'electric', cd: 3, icon: 'fist', tm: true, desc: '전기를 두른 주먹 3연타. 맞은 적을 마비시킨다.' },
  dragon_claw: { name: '드래곤클로', type: 'dragon', cd: 4, icon: 'claw', tm: true, desc: '거대한 청록색 X자 참격으로 베어 가른다.' },
  ice_beam: { name: '냉동빔', type: 'ice', cd: 6, icon: 'thunder', tm: true, desc: '얼음 결정이 흩날리는 빔. 둔화시키고 가끔 얼려 버린다.' },
  flash_cannon: { name: '러스터캐논', type: 'steel', cd: 5, icon: 'orb', tm: true, desc: '반동과 함께 쏘는 무거운 은빛 포탄. 적 3마리까지 꿰뚫는다.' },
  dark_pulse: { name: '악의파동', type: 'dark', cd: 6, icon: 'wave', tm: true, desc: '적을 꿰뚫는 검보라 파동 3겹. 맞은 적이 잠깐 움찔한다.' },
  earthquake: { name: '지진', type: 'ground', cd: 10, icon: 'boom', tm: true, desc: '땅을 내리찍어 주변 땅 위의 적 모두에게 큰 피해. 떠 있는 적은 못 맞힌다.' },
  sludge_bomb: { name: '오물폭탄', type: 'poison', cd: 5, icon: 'bubble', tm: true, desc: '포물선으로 던진 독 덩어리가 터지며 중독 웅덩이를 남긴다.' },
  earth_power: { name: '대지의힘', type: 'ground', cd: 6, icon: 'boom', tm: true, desc: '가까운 적 3마리 발밑에서 암석 기둥이 솟아 띄운다.' },
  play_rough: { name: '치근거리기', type: 'fairy', cd: 5, icon: 'dash', tm: true, desc: '분홍 반짝이를 흩뿌리며 몰아치는 다단히트 돌진.' },
  giga_drain: { name: '기가드레인', type: 'grass', cd: 7, icon: 'seed', tm: true, desc: '가까운 적 3마리의 생기를 빨아들여 준 피해의 절반만큼 회복한다.' },
  iron_tail: { name: '아이언테일', type: 'steel', cd: 4, icon: 'claw', tm: true, desc: '단단한 꼬리를 휘둘러 내려찍는 거대한 은빛 일격. 급소율이 높다.' },
  surf: { name: '파도타기', type: 'water', cd: 8, icon: 'wave', tm: true, desc: '거대한 물의 벽이 앞으로 휩쓸며 적을 끝까지 밀어낸다.' },
  psychic: { name: '사이코키네시스', type: 'psychic', cd: 6, icon: 'orb', tm: true, desc: '가까운 적 3마리를 염동력으로 띄웠다가 땅에 내리꽂는다.' },
  heat_wave: { name: '열풍', type: 'fire', cd: 6, icon: 'flame', tm: true, desc: '부채꼴로 퍼지는 불꽃 5갈래. 화상을 입힌다.' },
  steel_wing: { name: '강철날개', type: 'steel', cd: 3, icon: 'wing', tm: true, desc: '은빛 날개를 펴고 비스듬히 치고 나간다. 공중 점프가 돌아온다.' },
  ice_punch: { name: '냉동펀치', type: 'ice', cd: 3, icon: 'fist', tm: true, desc: '얼음 주먹으로 치고 둔화시킨다. 가끔 얼려 버린다.' },
  stone_edge: { name: '스톤에지', type: 'rock', cd: 6, icon: 'boom', tm: true, desc: '앞으로 차례차례 솟는 날카로운 바위 칼날 5개. 급소율이 높다.' }
};

// 교체 등장 스킬
export const TAGS = {
  tag_fire: { name: '화염 폭발', type: 'fire', desc: '등장하며 주변에 화염 폭발 + 화상' },
  tag_water: { name: '물보라 파동', type: 'water', desc: '등장하며 주변 적을 크게 밀어낸다' },
  tag_grass: { name: '덩굴 속박', type: 'grass', desc: '등장하며 주변 적을 1.6초 속박' },
  tag_normal: { name: '전광석화 난입', type: 'normal', desc: '앞으로 뛰어들며 경로의 적을 친다' },
  tag_electric: { name: '방전', type: 'electric', desc: '등장하며 주변을 감전 + 마비' },
  tag_flying: { name: '초음파 폭발', type: 'flying', desc: '등장하며 주변 적을 혼란시킨다' },
  tag_fighting: { name: '지진 착지', type: 'fighting', desc: '내려찍어 주변 적을 띄운다' },
  tag_ghost: { name: '저주', type: 'ghost', desc: '주변 적에게 저주(받는 피해 +30%)' },
  ...typeMoves.TAGS
};

// Z기술 (Z크리스탈을 얻으면 Q). 실제 동작은 game/skills.js 의 ZMOVE_IMPL — 화면 안 모든 적에게 공격력 ×mul
export const ZMOVES = {
  bloom_doom: { name: '블룸샤인엑스트라', type: 'grass', mul: 12, desc: '거대한 꽃이 피어나 화면의 적을 휩쓸고, 파티 체력을 25% 회복한다.' },
  inferno_overdrive: { name: '다이내믹풀플레임', type: 'fire', mul: 13, desc: '하늘에서 거대한 화염구를 내리꽂아 폭발. 화상.' },
  hydro_vortex: { name: '슈퍼아쿠아토네이도', type: 'water', mul: 12, desc: '거대한 소용돌이로 적을 빨아들였다 날려 버린다.' },
  breakneck_blitz: { name: '울트라대시어택', type: 'normal', mul: 13, desc: '화면 끝까지 꿰뚫는 초고속 돌진을 왕복한다.' },
  catastropika: { name: '필살 피카슛', type: 'electric', mul: 13, desc: '전기를 두르고 날아올라 내리꽂는다. 화면 전체 감전 + 마비.' },
  acid_downpour: { name: '애시드포이즌딜리트', type: 'poison', mul: 11, desc: '독의 늪을 깔고 독비를 쏟는다. 맹독.' },
  all_out_pummeling: { name: '전력무쌍격렬권', type: 'fighting', mul: 13, desc: '수십 개의 주먹 탄환을 화면에 쏟아붓는다.' },
  never_ending_nightmare: { name: '무한암야로의 유인', type: 'ghost', mul: 12, desc: '땅에서 그림자 손이 솟아 적을 붙잡는다. 저주.' },
  ...typeMoves.ZMOVES
};

// 야생 적: 진화 계열 하나 = 항목 하나. forms 는 단계별 [도트 키, 이름], 능력치는 1단 기준. ai 는 game/Enemy.js 의 행동 패턴
//  나타날 때 출전 중인 포켓몬의 진화 단계에 맞춰 단계를 고른다 (pickWildStage): 한 단계 차이까지만, 두 단계 차이는 나지 않는다.
//  stages.js 의 pool 에는 계열 이름(첫 모습)을 적는다. 정화 진행도도 계열로 센다 (피츄·피카츄·라이츄 모두 피츄 계열).
//  shot: 투사체 공격 (Enemy.fireShot). 2단부터 쏜다 — 원래 원거리형인 피츄·고오스 계열만 1단부터(shotFrom: 0).
//   2단은 단발, 3단은 3연사(연속 투사체). 투사체끼리 부딪히면 Combat.clashProjectiles 규칙으로 맞대결한다.
export const WILD = {
  rattata: { forms: [['rattata', '꼬렛'], ['raticate', '레트라']], types: ['normal'], hp: 46, dmg: 9, speed: 62, ai: 'charger', atkType: 'normal',
    shot: { kind: 'wave', type: 'normal', r: 4, speed: 190, life: .8 } },   // 레트라: 앞니 충격파
  pichu: { forms: [['pichu', '피츄'], ['pikachu', '피카츄'], ['raichu', '라이츄']], types: ['electric'], hp: 42, dmg: 10, speed: 66, ai: 'shooter', atkType: 'electric',
    shot: { kind: 'bolt', type: 'electric', r: 3, speed: 170, life: 1.4 }, shotFrom: 0 },
  zubat: { forms: [['zubat', '주뱃'], ['golbat', '골뱃'], ['crobat', '크로뱃']], types: ['poison', 'flying'], hp: 36, dmg: 9, speed: 80, ai: 'flyer', atkType: 'poison', flying: true,
    shot: { kind: 'bolt', type: 'flying', r: 3, speed: 200, life: 1, color: 0xc8e0ff } },   // 에어커터
  machop: { forms: [['machop', '알통몬'], ['machoke', '근육몬'], ['machamp', '괴력몬']], types: ['fighting'], hp: 72, dmg: 13, speed: 50, ai: 'brawler', atkType: 'fighting', kbRes: .45,
    shot: { kind: 'wave', type: 'fighting', r: 5, speed: 165, life: .8 } },   // 기합 충격파
  gastly: { forms: [['gastly', '고오스'], ['haunter', '고우스트'], ['gengar', '팬텀']], types: ['ghost', 'poison'], hp: 54, dmg: 12, speed: 42, ai: 'ghost', atkType: 'ghost', flying: true, noclip: true,
    shot: { kind: 'shadow', type: 'ghost', r: 5, speed: 110, life: 2.6, homing: .9, ghost: true, color: 0x9a5aff }, shotFrom: 0 }
};
// 진화한 야생은 더 단단하고 아프다 (플레이어 진화 배율보다는 낮게 → 진화한 만큼 여전히 강해진 느낌)
export const WILD_STAGE = [{ hp: 1, dmg: 1, speed: 1 }, { hp: 1.3, dmg: 1.15, speed: 1.05 }, { hp: 1.6, dmg: 1.3, speed: 1.1 }];

// 계열 line 의 stage 단계 모습 → { key: 도트 키, def: Enemy 에 넘길 능력치 }
export function wildForm(line, stage) {
  const w = WILD[line], [key, name] = w.forms[stage], m = WILD_STAGE[stage];
  return { key, def: Object.assign({}, w, { name, hp: Math.round(w.hp * m.hp), dmg: w.dmg * m.dmg, speed: w.speed * m.speed }) };
}

// 야생 단계 고르기: 출전 중인 포켓몬 단계 tier(1단 0 · 2단 1 · 3단 2 · 메가 3)와 한 단계 차이 안에서만, 같은 단계가 두 배 흔하다.
//  pool 중 그 범위에 모습이 없는 계열(예: 메가일 때 꼬렛 계열)은 빼고, 남는 계열이 없으면 가장 가까운 단계로.
export function pickWildStage(pool, tier, rnd = Math.random) {
  const ok = pool.filter(l => tier - 1 <= WILD[l].forms.length - 1);
  if (!ok.length) { const l = pool[Math.floor(rnd() * pool.length)]; return { line: l, stage: WILD[l].forms.length - 1 }; }
  const line = ok[Math.floor(rnd() * ok.length)], top = WILD[line].forms.length - 1, opts = [];
  for (let s = Math.max(0, tier - 1); s <= Math.min(top, tier + 1); s++) opts.push([s, s === tier ? 2 : 1]);
  let r = rnd() * opts.reduce((a, o) => a + o[1], 0);
  for (const [s, w] of opts) if ((r -= w) < 0) return { line, stage: s };
  return { line, stage: opts[opts.length - 1][0] };
}

// 보스: ai 는 game/Boss.js 의 행동 패턴. 전용 패턴이 아직 없는 보스는 'legend'(전설 공용 패턴 — 돌진·탄막·내려찍기·낙하탄·광선)를
//  fly(공중) · kind(투사체 모양) · moves(쓸 패턴) 로 개성을 준다.  title: 보스 이름 위 작은 글 · megaSprite/megaName: 체력 50%에서 바뀌는 모습
//  tier: 중간 보스(mini) · 지방 최종(boss) · 히든 전설(hidden) — 지도 핀과 보상이 달라진다
// 밸런스: 지방이 오를수록 체력·공격이 오른다 (관동 1100~2600 → 하나 1500~4800). 이어 싸우는 보스는 합계로 맞춘다
//  칠색조 2600 (+ 30%에서 60%로 부활 ≈ 3400) · 디아루가 3000 + 펄기아 3000 · 레드의 피카츄 1500 + 리자몽 2200 + 무한다이노 4600
export const BOSSES = {
  // ---- 관동 ----
  onix: { name: '롱스톤', title: '회색시티 박물관의 거대 화석', types: ['rock', 'ground'], hp: 1100, dmg: 14, ai: 'onix', color: 0xa88c66, tier: 'mini' },
  gengar: { name: '팬텀', title: '포켓몬타워의 망령', types: ['ghost', 'poison'], hp: 1500, dmg: 16, ai: 'gengar', scale: 2, megaSprite: 'gengar-mega', megaName: '메가팬텀', tier: 'mini' },
  alakazam: { name: '후딘', title: '실프주식회사의 염동 지배자', types: ['psychic'], hp: 1500, dmg: 17, ai: 'alakazam', fly: true, color: 0xff5a9a, megaSprite: 'alakazam-mega', megaName: '메가후딘', tier: 'mini' },
  mewtwo: { name: '뮤츠', title: '심연에 폭주하는', types: ['psychic'], hp: 2070, dmg: 20, ai: 'mewtwo', fly: true, color: 0xb06aff, rage: '염동력이 걷잡을 수 없이 넘쳐흐른다', tier: 'boss' },   // hp: 2300 × 0.9 (전투 시간 단축)
  steelix: { name: '강철톤', title: '블루시티 동굴 밑바닥의', types: ['steel', 'ground'], hp: 2600, dmg: 21, ai: 'onix', steel: true, color: 0xa8b0c8, tier: 'hidden' },
  // ---- 성도 ----
  raikou: { name: '라이코', title: '방울탑 하층의 수호자', types: ['electric'], hp: 1700, dmg: 21, ai: 'raikou', color: 0xffe040, tier: 'mini' },
  entei: { name: '앤테이', title: '방울탑 중층의 수호자', types: ['fire'], hp: 1900, dmg: 22, ai: 'entei', color: 0xff7a2a, tier: 'mini' },
  suicune: { name: '스이쿤', title: '방울탑 상층의 수호자', types: ['water'], hp: 2100, dmg: 23, ai: 'suicune', color: 0x8ad8ff, tier: 'mini' },
  'ho-oh': { name: '칠색조', title: '검은 재로 물든', types: ['fire', 'flying'], hp: 2600, dmg: 25, ai: 'hooh', fly: true, color: 0xff4a2a, rage: '검붉은 불꽃이 거세진다', tier: 'boss' },
  ampharos: { name: '전룡', title: '빛을 잃은 등대지기', types: ['electric'], hp: 2600, dmg: 24, ai: 'ampharos', color: 0xfff27a, tier: 'hidden' },
  // ---- 호연 ----
  // 라티아스 & 라티오스: 한 아레나에서 둘이 함께 (pair) — 한 마리가 먼저 정화되면 남은 한 마리가 각성
  latias: { name: '라티아스', title: '남쪽 외딴섬의 두 유성', duo: '라티아스 & 라티오스', pair: 'latios', types: ['dragon', 'psychic'], hp: 1600, dmg: 25, ai: 'lati', fly: true, color: 0xff6a8a, tier: 'mini' },
  latios: { name: '라티오스', title: '남쪽 외딴섬의 푸른 유성', types: ['dragon', 'psychic'], hp: 1600, dmg: 25, ai: 'lati', fly: true, color: 0x6a9aff, tier: 'mini' },
  rayquaza: { name: '레쿠쟈', title: '심연의 천공룡', types: ['dragon', 'flying'], hp: 3800, dmg: 28, ai: 'rayquaza', fly: true, color: 0x4aff8a, rage: '천공룡이 포효한다', tier: 'boss' },
  groudon: { name: '그란돈', title: '굴뚝산 마그마 심층의', types: ['ground'], hp: 3600, dmg: 28, ai: 'groudon', color: 0xff6a2a, tier: 'hidden' },
  // ---- 신오 ----
  // 트레이너(trainer): 아레나 뒤 단상에 세뇌된 트레이너가 서서 손짓으로 지시한다 (game/Trainer.js)
  garchomp: { name: '한카리아스', title: '조종당하는 챔피언 난천의', types: ['dragon', 'ground'], hp: 3000, dmg: 30, ai: 'garchomp', trainer: 'cynthia', color: 0x6a8aff, megaSprite: 'garchomp-mega', megaName: '메가한카리아스', megaLine: '키스톤이여… 한카리아스, 메가진화.', tier: 'mini' },
  // then: 정화되는 순간 같은 아레나에서 이어 싸우는 다음 보스 · entrance: 다음 보스 등장 연출 (shatter 공간이 깨진다 · abyss 심연에서 솟는다)
  dialga: { name: '디아루가', title: '시간의 신', types: ['steel', 'dragon'], hp: 3000, dmg: 31, ai: 'dialga', color: 0x6ab0ff, then: 'palkia', tier: 'boss' },
  palkia: { name: '펄기아', title: '공간의 신', types: ['water', 'dragon'], hp: 3000, dmg: 31, ai: 'palkia', color: 0xd88aff, entrance: 'shatter', intro: '공간이 유리처럼 깨진다 — 공간의 신 펄기아 강림', tier: 'boss' },
  darkrai: { name: '다크라이', title: '악몽의 만월섬', types: ['dark'], hp: 3400, dmg: 30, ai: 'darkrai', fly: true, color: 0x6a2a9a, tier: 'hidden' },
  giratina: { name: '기라티나', title: '깨어진 세계의', types: ['ghost', 'dragon'], hp: 4200, dmg: 32, ai: 'giratina', fly: true, color: 0xff3a5a, megaSprite: 'giratina-origin', megaName: '기라티나 오리진폼', tier: 'hidden' },
  // ---- 하나 · 심연 ----
  zekrom: { name: '제크로무', title: '용나선탑의 검은 영웅', types: ['dragon', 'electric'], hp: 4000, dmg: 33, ai: 'zekrom', color: 0x4a8aff, tier: 'mini' },
  // 최종장: 세뇌된 레드의 피카츄 → 리자몽(메가리자몽X) → 레드가 풀려나면 심연의 핵에서 무한다이노 (체력 50% 무한다이맥스)
  eternatus: { name: '무한다이노', title: '모든 것의 원흉', types: ['poison', 'dragon'], hp: 4600, dmg: 36, ai: 'eternatus', fly: true, color: 0xff2a5a, prelude: ['pikachu-red', 'charizard-red'], entrance: 'abyss', intro: '심연의 핵이 깨어난다 — 모든 것의 원흉', megaName: '무한다이맥스 무한다이노', megaScale: 1.35, tier: 'boss' },
  'pikachu-red': { name: '피카츄', sprite: 'pikachu', title: '세뇌된 레드의 파트너', types: ['electric'], hp: 1500, dmg: 30, ai: 'pikachu', trainer: 'red', color: 0xffe040, tier: 'boss' },
  'charizard-red': { name: '리자몽', sprite: 'charizard', title: '세뇌된 레드의 에이스', types: ['fire', 'flying'], hp: 2200, dmg: 33, ai: 'charizard', trainer: 'red', color: 0xff7a2a, megaSprite: 'charizard-mega-x', megaName: '메가리자몽X', megaLine: '……', tier: 'boss' },
  'kyurem-black': { name: '블랙큐레무', title: '얼어붙은 이상의', types: ['dragon', 'ice'], hp: 4800, dmg: 34, ai: 'kyuremB', color: 0xbff0ff, tier: 'hidden' }
};
