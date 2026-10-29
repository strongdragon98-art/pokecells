// 4·5세대 스타팅 스킬 메타데이터 (모부기 · 불꽃숭이 · 팽도리 · 주리비얀 · 뚜꾸리 · 수댕이)
// mega = 각성 상태에서 달라지는 점
export const SKILLS = {
  // ===== 모부기 =====
  seed_bomb: { name: '깨물기·씨폭탄', type: 'grass', cd: 0, icon: 'seed', desc: '깨물기 2연타 후 3타째에 포물선으로 씨폭탄을 던진다. 닿으면 폭발.', mega: '폭발하며 작은 씨앗 3알이 튀어 연쇄 폭발' },
  wood_hammer: { name: '우드해머', type: 'grass', cd: 7, icon: 'boom', desc: '거대한 통나무를 머리 위에서 내리찍는 강력한 일격. 체력 6% 반동.', mega: '앞으로 뻗는 뿌리 충격파 + 반동 절반' },
  earth_power: { name: '대지의힘', type: 'ground', cd: 6, icon: 'boom', desc: '가까운 적 3마리의 발밑에서 대지가 기둥처럼 솟구쳐 띄운다.', mega: '6마리 + 잠시 뒤 여진 기둥이 한 번 더' },

  // ===== 불꽃숭이 =====
  fury_swipes: { name: '마구할퀴기', type: 'normal', cd: 0, icon: 'claw', desc: '매우 빠른 할퀴기 연타. 3타째는 4연속 할퀴기.', mega: '할퀴기 횟수 +1 + 불꽃을 둘러 화상' },
  flare_blitz: { name: '플레어드라이브', type: 'fire', cd: 6, icon: 'flame', desc: '온몸에 불꽃을 두르고 강하게 돌진. 화상. 체력 7% 반동.', mega: '돌진 끝에 화염 폭발 + 반동 절반' },
  close_combat: { name: '인파이트', type: 'fighting', cd: 7, icon: 'fist', desc: '제자리에서 8연타 난타. 끝나면 3초간 받는 피해 30% 증가.', mega: '12연타 + 마지막 일격 충격파, 방어 하락 짧게' },

  // ===== 팽도리 =====
  peck_combo: { name: '쪼기·회전부리', type: 'flying', cd: 0, icon: 'fang', desc: '앞으로 찌르는 쪼기 2연타 후 회전하며 파고드는 다단 부리.', mega: '회전부리 끝에 강철 깃털 3발' },
  flash_cannon: { name: '러스터캐논', type: 'steel', cd: 6, icon: 'thunder', desc: '벽에 닿을 때까지 뻗는 강철 광선. 적 탄을 지우고 30% 확률로 방어 하락(저주).', mega: '광선이 굵어지고 2연사' },
  belly_slide: { name: '배치기', type: 'water', cd: 5, icon: 'wave', desc: '배로 땅을 미끄러지며 낮게 돌진해 적을 띄운다. 지나간 자리는 미끄러운 물길(적 둔화, 나는 가속).', mega: '더 멀리 미끄러지고 끝에 물기둥' },

  // ===== 주리비얀 =====
  leaf_tornado: { name: '덩굴채찍·리프토네이도', type: 'grass', cd: 0, icon: 'leaf', desc: '잎 베기 2연타 후 앞으로 나아가며 적을 휘감는 잎 회오리를 날린다.', mega: '회오리가 더 크고 오래 간다' },
  leaf_storm: { name: '리프스톰', type: 'grass', cd: 8, icon: 'leaf', desc: '전방으로 잎사귀 폭풍을 쏟아낸다. 쓴 뒤 4초간 공격력 20% 감소.', mega: '잎 1.5배 + 공격력 감소 없음' },
  coil: { name: '똬리틀기', type: 'normal', cd: 10, icon: 'spin', desc: '몸을 감아 6초간 공격력 30% · 속도 20% 증가, 받는 피해 15% 감소.', mega: '9초간 공격력 45% · 속도 30% · 받는 피해 30% 감소' },

  // ===== 뚜꾸리 =====
  arm_thrust: { name: '손바닥치기', type: 'fighting', cd: 0, icon: 'fist', desc: '손바닥 2연타씩 몰아친 뒤 양손으로 크게 밀쳐낸다.', mega: '마무리 장타가 불꽃을 둘러 화상 + 충격파' },
  heat_crash: { name: '헤비봄버', type: 'fire', cd: 7, icon: 'boom', desc: '높이 뛰었다가 내리꽂힌다. 떨어진 높이가 클수록 강해지고 양옆으로 화염 충격파. (↓로 빨리 낙하)', mega: '범위 1.4배 + 착지 자리에 불바다' },
  rollout: { name: '구르기', type: 'rock', cd: 7, icon: 'spin', desc: '몸을 말아 굴러간다. 구를수록 빨라지고 강해진다. 좌우로 방향 전환, 점프 가능, 벽에 튕긴다.', mega: '더 오래 · 더 빠르게 구르고 불길이 남는다' },

  // ===== 수댕이 =====
  razor_shell: { name: '셸블레이드', type: 'water', cd: 0, icon: 'claw', desc: '조개칼 2연베기 후 크게 내리벤다. 마무리는 50% 확률로 방어 하락(저주).', mega: '방어 하락 확정 + 물칼날 파동' },
  surf: { name: '파도타기', type: 'water', cd: 7, icon: 'wave', desc: '큰 파도를 타고 전진하며 앞의 적을 휩쓸어 실어 간다. 끝에 파도가 부서지며 타격.', mega: '파도가 더 높고 길게 + 부서질 때 더 강하게' },
  aqua_cutter: { name: '아쿠아커터', type: 'water', cd: 4, icon: 'drop', desc: '모든 적을 관통하는 빠른 물칼날. 급소율이 매우 높다.', mega: '물칼날 3갈래 + 급소율 증가' }
};
