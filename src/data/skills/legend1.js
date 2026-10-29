// 정화한 전설 포켓몬 스킬 (1) — 뮤츠 · 칠색조 · 스이쿤 · 엔테이 · 라이코 · 레쿠쟈
// 형식은 data/pokemon.js 의 SKILLS 와 같다. 구현은 game/skills/legend1.js
// 메가가 없는 전설은 mega = '각성' 효과
export const SKILLS = {
  // ===== 뮤츠 =====
  psycho_cut: { name: '사이코커터', type: 'psychic', cd: 0, icon: 'claw', desc: '염동력 칼날 2연타 후 3타째에 칼날 3장을 날린다.', mega: 'X: 격투 기운의 거대 베기 · Y: 유도 칼날 5장' },
  psystrike: { name: '사이코브레이크', type: 'psychic', cd: 8, icon: 'wave', desc: '짓누르는 염동 파동을 연속 방출해 화면 안 모든 적을 반복 타격하고 적 탄을 지운다.', mega: 'X: 마지막 파동이 격투 타입 충격 · Y: 파동 5회' },
  future_sight: { name: '미래예지', type: 'psychic', cd: 10, icon: 'orb', desc: '화면 안 모든 적에 표식. 1.2초 뒤 표식 자리에 빛의 기둥이 내리꽂힌다.', mega: 'X: 격투 타입 · 긴 풀죽음 · Y: 기둥이 굵고 강해진다' },
  // ===== 칠색조 =====
  flame_feather: { name: '불꽃깃털', type: 'fire', cd: 0, icon: 'wing', desc: '무지갯빛 깃털 2연사 후 3타째에 불꽃 깃털을 부채꼴로 흩뿌린다. 화상.', mega: '깃털 7장 + 유도' },
  sacred_fire: { name: '성스러운불꽃', type: 'fire', cd: 8, icon: 'flame', desc: '무지개·황금빛 불기둥이 앞으로 휩쓸며 적을 밀고, 지나간 땅에 오래 타는 성화를 남긴다. 강한 화상.', mega: '불기둥이 굵고 빨라지며 성화가 더 오래 탄다' },
  phoenix_dive: { name: '브레이브버드', type: 'flying', cd: 11, icon: 'dash', desc: '높이 솟았다가 불꽃 꼬리를 끌며 가장 가까운 적에게 활강 낙하. 착지 시 폭발하고 파티를 조금 회복(재생).', mega: '폭발 범위·회복량 증가' },
  // ===== 스이쿤 =====
  aurora_beam: { name: '오로라빔', type: 'ice', cd: 0, icon: 'wave', desc: '얼음빛 광선 연사. 맞은 적은 둔화. 3타째는 굵은 오로라.', mega: '3타째가 적을 얼려 묶는다' },
  tidal_surf: { name: '파도타기', type: 'water', cd: 8, icon: 'drop', desc: '화면 끝에서 끝까지 큰 파도가 휩쓸며 적을 실어 나르고 적 탄을 지운다.', mega: '파도가 더 높고 오래 간다' },
  mirror_coat: { name: '미러코트', type: 'psychic', cd: 9, icon: 'shield', desc: '1.4초 수정 장막. 적 탄은 반사하고, 맞으면 피해 대신 2배로 되돌려준다.', mega: '장막 2초 + 끝날 때 수정 폭발' },
  // ===== 엔테이 =====
  lava_plume: { name: '분연', type: 'fire', cd: 0, icon: 'flame', desc: '몸 주변에 화염을 분출하는 3연타. 마지막은 큰 분화. 화상.', mega: '분화 자리에 불길' },
  fire_blast: { name: '대문자', type: 'fire', cd: 7, icon: 'boom', desc: '大자 모양 화염을 날린다. 터지면 다섯 갈래 불길이 뻗어 나간다.', mega: '폭발·불길 확대 + 불길 끝에 장판' },
  flare_stomp: { name: '발구름', type: 'fire', cd: 10, icon: 'fist', desc: '땅을 구르면 양옆으로 불기둥이 차례로 솟구치며 뻗어 나간다.', mega: '불기둥 수·높이 증가' },
  // ===== 라이코 =====
  thunder_fang: { name: '번개엄니', type: 'electric', cd: 0, icon: 'fang', desc: '전기 엄니 2연타 후 파고드는 물기. 마비 확률.', mega: '물기가 주변 적 2마리에게 튄다' },
  thunder: { name: '번개', type: 'electric', cd: 9, icon: 'thunder', desc: '폭풍을 불러 1.2초간 화면 곳곳에 낙뢰를 떨어뜨린다. 마비.', mega: '1.6초 · 더 굵고 잦은 낙뢰' },
  wild_charge: { name: '와일드볼트', type: 'electric', cd: 9, icon: 'dash', desc: '전기를 두르고 돌진. 부딪힌 적에게서 주변 적으로 번개가 연쇄된다. 약간의 반동.', mega: '연쇄 수 증가 + 반동 없음' },
  // ===== 레쿠쟈 =====
  dragon_claw: { name: '드래곤크루', type: 'dragon', cd: 0, icon: 'claw', desc: '세 줄 용의 발톱 3연타. 마지막은 적을 띄우는 올려베기.', mega: '마지막에 용의 충격파' },
  dragon_ascent: { name: '화룡점정', type: 'flying', cd: 9, icon: 'wing', desc: '화면 위로 솟구쳤다가 가장 가까운 적에게 내리꽂힌다. 거대한 충격파. 시전 중 무적.', mega: '충격 범위·위력 증가' },
  draco_meteor: { name: '용성군', type: 'dragon', cd: 12, icon: 'boom', desc: '1.5초간 화면에 유성이 비스듬히 쏟아져 폭발한다.', mega: '2초 · 더 많은 유성' }
};
