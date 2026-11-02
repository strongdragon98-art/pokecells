// 보스의 코어 — 모든 보스(지방 보스 · 중간 보스 · 히든 전설 · 챔피언)가 정화될 때 100% 떨어뜨리는 전설 유물 (장착 도구 칸)
//  단순 수치가 아니라 기술의 '작동 방식'을 바꾼다. 효과는 game/Cores.js · 아이템 표는 data/items.js 가 이 표로 만든다
//  flag: 고유 효과 (game/Cores.js) · proj: 이 속성 투사체 +1 · boost: 이 속성 피해 +20% (고유 효과가 없는 보스의 코어)
import { typeName } from './types.js';

export const BOSS_CORES = {
  mewtwo: { id: 'mewtwo_core', name: '뮤츠의 코어', color: 0xb05aff, flag: 'psy', proj: ['psychic'],
    desc: '🔮 에스퍼 기술·평타·차징의 투사체 +1 · 에스퍼 기술이 맞으면 사이코 중력장(주변 폭발 + 끌어당김·경직) · 차징 샷 크기 +30%' },
  'ho-oh': { id: 'core_hooh', name: '칠색조의 무지개 코어', color: 0xff6a2a, flag: 'hooh', proj: ['fire', 'flying'],
    desc: '🔥 불꽃·비행 투사체가 무지갯빛 성스러운 불꽃으로 · 투사체 +1 · 맞으면 강한 화상 100% · 쓰러지는 순간 불사조 날개와 함께 체력 50%로 부활 (지방·보스전마다 1번)' },
  suicune: { id: 'core_suicune', name: '스이쿤의 북풍 코어', color: 0x8ad8ff, flag: 'suicune',
    desc: '💧 물·얼음 기술이 맞으면 오로라 파동 — 둘레 적의 이동·공격 속도 40% 둔화 · 모든 기술 재사용 -15%' },
  entei: { id: 'core_entei', name: '엔테이의 분화 코어', color: 0xff7a2a, flag: 'entei',
    desc: '🌋 불꽃 기술을 쓰거나 대시 · 공중 내려찍기를 하면 발밑에서 용암 기둥이 2번 더 터진다' },
  raikou: { id: 'core_raikou', name: '라이코의 뇌운 코어', color: 0xffe040, flag: 'raikou',
    desc: '⚡ 전기 기술 · 평타가 맞으면 둘레 적 3마리에게 연쇄 번개가 튄다' },
  rayquaza: { id: 'core_rayquaza', name: '레쿠쟈의 델타 코어', color: 0x4aff8a, flag: 'rayquaza',
    desc: '🌪️ 드래곤·비행 기술을 쓰면 5초간 델타스트림 — 투사체 속도·크기 ×1.5 · 공중에 더 오래 뜨고 · 공중에서 받는 피해 -30%' },
  giratina: { id: 'core_giratina', name: '기라티나의 반물질 코어', color: 0xff3a5a, flag: 'giratina',
    desc: '🌌 고스트·드래곤 기술이 맞은 자리에 차원 균열 — 1초 뒤 암흑 폭발 · 대시하면 0.5초간 깨어진 세계로 잠복 (완전 무적)' },
  dialga: { id: 'core_dialga', name: '디아루가의 금강 코어', color: 0x6ab0ff, flag: 'dialga',
    desc: '⏳ 강철·드래곤 기술이 맞으면 시간 왜곡 — 적을 1.2초간 시간 정지 (같은 적은 3초에 한 번 · 보스는 짧게)' },
  palkia: { id: 'core_palkia', name: '펄기아의 백옥 코어', color: 0xd88aff, flag: 'palkia',
    desc: '🌌 물·드래곤 투사체의 사거리 · 크기 · 폭발 범위 +50% · 화면 끝의 적까지 모두 관통' },
  darkrai: { id: 'core_darkrai', name: '다크라이의 나이트메어 코어', color: 0x8a4ac0, flag: 'darkrai',
    desc: '🌑 악·고스트 기술이 맞으면 25% 확률로 악몽(잠듦) · 상태이상에 걸린 적에게 주는 피해 +45% · 그 피해의 8% 흡혈' },
  garchomp: { id: 'core_garchomp', name: '한카리아스의 역린 코어', color: 0xd8a85a, flag: 'garchomp',
    desc: '⚔️ 땅·드래곤 기술 · 근접 기술을 쓰면 모래폭풍 검기가 휘몰아친다 · 맞힐 때마다 이동 속도 · 기술 재사용이 5%씩 빨라진다 (최대 35% · 3초 동안 못 맞히면 사라짐)' },
  zekrom: { id: 'core_zekrom', name: '제크로무의 뇌격 코어', color: 0x4a8aff, flag: 'zekrom',
    desc: '⚡ 전기·드래곤 · 근접(물리) 기술을 쓰면 몸 둘레에 푸른 교차 번개(크로스썬더)가 터진다 · 패링(↓ + Z)에 성공하면 화면 안 모든 적에게 낙뢰 + 5초간 공격 속도 +40%' },
  reshiram: { id: 'core_reshiram', name: '레시라무의 푸른불꽃 코어', color: 0x5ab0ff, flag: 'reshiram',
    desc: '🔥 불꽃·드래곤 기술 · 차징 샷(Z 홀드)의 화염이 초고온의 푸른 불꽃으로 — 반감 · 무효 · 보스의 방어 자세까지 무시하고 관통 · 맞은 자리(근접은 앞 바닥)에 3초간 타오르는 푸른 화염 장판' },
  'kyurem-black': { id: 'core_kyurem_black', name: '큐레무의 절대영도 코어', color: 0xbff0ff, flag: 'kyurem',
    desc: '❄️ 얼음·드래곤 기술이 맞으면 35% 확률로 즉시 빙결(보스는 짧게) · 빙결되거나 둔화된 적에게 주는 급소 피해 +60%' },
  arceus: { id: 'core_arceus', name: '아르세우스의 창조 코어', color: 0xfff0b0, flag: 'arceus',
    desc: '🌟 올라운드 플레이트 — 모든 공격이 상대 속성에 맞춰 「효과가 굉장했다」(약점) 판정으로 바뀐다 · 기술을 쓸 때마다 심판의뭉치 빛의 탄환 3발이 유도탄으로 함께 날아간다 (최종 궁극 유물)' },
  // ── 고유 효과가 없는 보스: 그 보스의 속성 투사체 +1 · 그 속성 피해 +20%
  onix: { id: 'core_onix', name: '롱스톤의 화석 코어', color: 0xa88c66, proj: ['rock', 'ground'], boost: ['rock', 'ground'] },
  gengar: { id: 'core_gengar', name: '팬텀의 망령 코어', color: 0x8a5ac0, proj: ['ghost', 'poison'], boost: ['ghost', 'poison'] },
  alakazam: { id: 'core_alakazam', name: '후딘의 염동 코어', color: 0xff8ad0, proj: ['psychic'], boost: ['psychic'] },
  steelix: { id: 'core_steelix', name: '강철톤의 강철 코어', color: 0xa8b0c8, proj: ['steel', 'ground'], boost: ['steel', 'ground'] },
  ampharos: { id: 'core_ampharos', name: '전룡의 등대 코어', color: 0xfff27a, proj: ['electric'], boost: ['electric'] },
  latias: { id: 'core_latias', name: '라티아스의 꿈 코어', color: 0xff8aa8, proj: ['dragon', 'psychic'], boost: ['dragon', 'psychic'] },
  latios: { id: 'core_latios', name: '라티오스의 유성 코어', color: 0x6a9aff, proj: ['dragon', 'psychic'], boost: ['dragon', 'psychic'] },
  groudon: { id: 'core_groudon', name: '그란돈의 대지 코어', color: 0xff6a2a, proj: ['ground', 'fire'], boost: ['ground', 'fire'] },
  eternatus: { id: 'core_eternatus', name: '무한다이노의 무한 코어', color: 0xff2a5a, proj: ['poison', 'dragon'], boost: ['poison', 'dragon'] },
  'pikachu-red': { id: 'core_pikachu_red', name: '레드의 피카츄 코어', color: 0xffe040, proj: ['electric'], boost: ['electric'] },
  'charizard-red': { id: 'core_charizard_red', name: '레드의 리자몽 코어', color: 0xff7a2a, proj: ['fire', 'flying'], boost: ['fire', 'flying'] }
};
for (const c of Object.values(BOSS_CORES)) if (!c.desc) c.desc = `💠 ${c.boost.map(t => typeName(t)).join('·')} 속성 투사체 +1 · 그 속성 피해 +20%`;
// 아이템 id → 코어 정의
export const CORE_BY_ITEM = Object.fromEntries(Object.values(BOSS_CORES).map(c => [c.id, c]));
// 보스 key → 코어 아이템 id
export const coreOfBoss = key => (BOSS_CORES[key] ? BOSS_CORES[key].id : null);

