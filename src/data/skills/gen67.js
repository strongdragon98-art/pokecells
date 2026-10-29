// 6·7세대 스타팅 라인 스킬 메타데이터 (도치마론 · 푸호꼬 · 개구마르 · 나몰빼미 · 냐오불 · 누리공)
// 형식은 data/pokemon.js 의 SKILLS 와 같다. 구현은 game/skills/gen67.js
export const SKILLS = {
  // ===== 도치마론 =====
  needle_arm: { name: '바늘팔', type: 'grass', cd: 0, icon: 'fist', desc: '가시 돋친 팔 3연타. 3타째는 풀죽게 한다.', mega: '3타째에 가시 3발 사출' },
  spiky_shield: { name: '니들가드', type: 'grass', cd: 7, icon: 'shield', desc: '0.8초 무적 가드. 닿은 적은 가시에 찔려 튕겨나고 투사체는 막힌다. 끝나면 4초간 받는 피해 30% 감소.', mega: '가드 시간 증가 + 투사체 반사 + 끝날 때 사방으로 가시 발사' },
  body_press: { name: '바디프레스', type: 'fighting', cd: 6, icon: 'boom', desc: '뛰어올라 몸으로 내리찍는다. 방어 강화(니들가드) 중이면 위력 1.6배.', mega: '충격 범위 증가 + 지면을 타고 양쪽으로 충격파' },

  // ===== 푸호꼬 =====
  mystical_fire: { name: '매지컬플레임', type: 'fire', cd: 0, icon: 'flame', desc: '나뭇가지 지팡이로 불티 2연타 후, 3타째에 유도 마법 불꽃구슬. 저주(받는 피해 증가)+화상.', mega: '불꽃구슬이 적에 닿으면 폭발' },
  fire_spin: { name: '회오리불꽃', type: 'fire', cd: 7, icon: 'spin', desc: '전방에 불꽃 소용돌이를 일으켜 안의 적을 묶고 계속 태운다.', mega: '소용돌이 확대·지속 증가 + 적을 중심으로 빨아들임' },
  psyshock: { name: '사이코쇼크', type: 'psychic', cd: 6, icon: 'orb', desc: '가까운 적 3마리 주위에 염동 파편을 만들어 한꺼번에 꽂는다.', mega: '6마리 + 파편이 두 번 수렴' },

  // ===== 개구마르 =====
  water_shuriken: { name: '물수리검', type: 'water', cd: 0, icon: 'drop', desc: '빠른 손날 2연타 후, 3타째에 물수리검 3장을 연달아 던진다.', mega: '유대변화: 등의 거대 물수리검을 던진다 (관통 · 되돌아옴)' },
  night_slash: { name: '깜짝베기', type: 'dark', cd: 4, icon: 'claw', desc: '순식간에 적을 꿰뚫고 지나간 뒤, 지나친 적 모두를 늦게 벤다. 급소율 매우 높음.', mega: '유대변화: 돌진 거리 증가 + 급소 확정' },
  double_team: { name: '그림자분신', type: 'dark', cd: 6, icon: 'dash', desc: '분신 2개를 남기고 앞으로 순간이동(잠깐 무적). 분신은 잠시 뒤 터진다.', mega: '유대변화: 분신 4개가 각자 적에게 달려들어 터진다' },

  // ===== 나몰빼미 =====
  leafage: { name: '잎사귀', type: 'grass', cd: 0, icon: 'leaf', desc: '잎 화살 2연사 후, 3타째에 잎 3장을 부채꼴로 날린다.', mega: '잎이 관통 + 3타째 5장' },
  spirit_shackle: { name: '그림자꿰매기', type: 'ghost', cd: 6, icon: 'ghost', desc: '벽을 뚫는 화살 3연사. 맞은 적의 그림자를 땅에 꿰매 묶고 저주한다.', mega: '화살 5발 + 속박 시간 증가' },
  brave_bird: { name: '브레이브버드', type: 'flying', cd: 4, icon: 'wing', desc: '날개를 접었다가 방향키 쪽 8방향으로 맹돌진. 적중하면 반동 피해.', mega: '돌진 속도·위력 증가 + 반동 절반' },

  // ===== 냐오불 =====
  fire_fang: { name: '불꽃엄니', type: 'fire', cd: 0, icon: 'fang', desc: '불꽃 이빨로 2연속 물기 후, 달려들며 크게 문다. 3타째 화상 + 풀죽음.', mega: '3타째에 화염 폭발 추가' },
  darkest_lariat: { name: 'DD래리어트', type: 'dark', cd: 7, icon: 'spin', desc: '양팔을 휘두르며 회전해 주변을 연타한다. 움직일 수 있고, 마지막에 크게 날려 보낸다.', mega: '회전 시간·범위 증가 + 화염을 둘러 화상' },
  fake_out: { name: '속이다', type: 'normal', cd: 2.5, icon: 'fist', desc: '손뼉과 함께 짧게 돌진해 맞은 적을 풀죽게 한다. 같은 적은 4초에 한 번만 풀죽는다.', mega: '출발점·도착점에 손뼉 충격파 + 풀죽음 시간 증가' },

  // ===== 누리공 =====
  bubble_note: { name: '거품', type: 'water', cd: 0, icon: 'bubble', desc: '거품 2연사 후, 3타째에 커다란 거품으로 적을 가둔다(속박).', mega: '큰 거품이 터지며 주변까지 가둔다' },
  sparkling_aria: { name: '물거품아리아', type: 'water', cd: 9, icon: 'wave', desc: '노래하며 주변에 거품을 쏟아붓고, 끝까지 부르면 파티 전원 HP 6% 회복.', mega: '거품이 적을 따라감 + 파티 회복 10%' },
  aqua_ring: { name: '아쿠아링', type: 'water', cd: 10, icon: 'shield', desc: '6초간 물의 고리를 두른다. 초당 HP 1.2% 재생 + 적 투사체 1회 차단.', mega: '9초 · 초당 2% · 2회 차단' }
};
