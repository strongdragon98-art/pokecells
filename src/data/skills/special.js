// 특수 포켓몬 라인 기술 표시 정보 (랄토스 · 애버라스 · 미뇽 · 잉어킹/갸라도스 · 롱스톤 · 스라크)
//  동작은 game/skills/special.js
export const SKILLS = {
  // ===== 랄토스 → 킬리아 → 가디안 =====
  confusion_orb: { name: '염동력', type: 'psychic', cd: 0, icon: 'orb', desc: '염동력 탄을 2번 튕긴 뒤 3타째에 적을 쫓는 염동 구체. 혼란.', mega: '튕기는 탄이 관통 + 구체 2개' },
  psychic: { name: '사이코키네시스', type: 'psychic', cd: 7, icon: 'wave', desc: '주변 적을 염력으로 공중에 들어 올려 붙잡았다가 땅에 내리꽂는다.', mega: '범위·붙잡는 수 증가, 내리꽂기 강화' },
  moonblast: { name: '문포스', type: 'fairy', cd: 9, icon: 'boom', desc: '달빛을 모아 느리고 거대한 달 구체를 쏜다. 닿으면 크게 폭발하고 둔화.', mega: '구체가 날아가며 커지고 폭발 범위 증가' },

  // ===== 애버라스 → 데기라스 → 마기라스 =====
  rock_smash: { name: '바위깨기', type: 'fighting', cd: 0, icon: 'fist', desc: '묵직한 주먹 2연타 후 3타째에 땅을 쳐 바위를 터뜨린다.', mega: '3타째에 바위 파편이 앞으로 튄다' },
  stone_edge: { name: '스톤엣지', type: 'rock', cd: 6, icon: 'claw', desc: '앞쪽 땅에서 날카로운 바위 가시가 줄지어 솟는다. 급소율이 매우 높고 적을 띄운다.', mega: '가시 수·높이 증가' },
  crunch: { name: '깨물어부수기', type: 'dark', cd: 6, icon: 'fang', desc: '앞으로 덤벼들어 강하게 깨문다. 맞은 적은 방어가 깨져(저주) 받는 피해가 늘어난다.', mega: '저주 시간 증가 + 흡혈' },

  // ===== 미뇽 → 신뇽 → 망나뇽 =====
  dragon_tail: { name: '드래곤테일', type: 'dragon', cd: 0, icon: 'spin', desc: '꼬리 휘두르기 2연타 후 3타째에 몸을 돌려 주변을 크게 날려 버린다.', mega: '3타째 범위 증가 + 풀죽음' },
  extreme_speed: { name: '신속', type: 'normal', cd: 5, icon: 'dash', desc: '눈에 보이지 않는 속도로 화면 끝(벽)까지 돌진. 지나간 길의 적 전부가 뒤늦게 베인다. 무적.', mega: '피해 증가 + 풀죽음' },
  outrage: { name: '역린', type: 'dragon', cd: 9, icon: 'thunder', desc: '2초간 날뛰며 주변을 연타하고, 근처 적에게 번개를 떨어뜨린다. 끝나면 지쳐서 잠시 둔해진다.', mega: '범위 증가 · 번개 증가 · 반동 없음' },

  // ===== 잉어킹 (일부러 한심하다) =====
  splash: { name: '튀어오르기', type: 'water', cd: 0, icon: 'drop', desc: '제자리에서 팔딱 튀어오른다. 하지만 아무 일도 일어나지 않았다!', mega: '잉어킹은 메가진화할 수 없다…' },
  bounce: { name: '뛰어오르기', type: 'flying', cd: 3, icon: 'wing', desc: '높이 뛰어올랐다가 내리꽂혀 착지한 자리 주변을 크게 친다. 잉어킹의 유일한 제대로 된 공격.', mega: '잉어킹은 메가진화할 수 없다…' },
  karp_tackle: { name: '몸통박치기', type: 'normal', cd: 4, icon: 'dash', desc: '파닥거리며 앞으로 몸을 던진다. 매우 약하다.', mega: '잉어킹은 메가진화할 수 없다…' },
  flail: { name: '바둥바둥', type: 'normal', cd: 6, icon: 'spin', desc: '마구 바둥거린다. 체력이 낮을수록 세지지만… 여전히 약하다.', mega: '잉어킹은 메가진화할 수 없다…' },

  // ===== 갸라도스 =====
  aqua_tail: { name: '아쿠아테일', type: 'water', cd: 0, icon: 'wave', desc: '거대한 꼬리로 휩쓴다. 3타째는 주변 전체를 쓸어 버리고 용의춤(공격·속도 상승)을 쌓는다.', mega: '용의춤 최대 5중첩 (기본 3)' },
  hydro_pump: { name: '하이드로펌프', type: 'water', cd: 8, icon: 'drop', desc: '1.4초간 화면을 가르는 거대 물줄기. ↑↓ 로 물줄기를 휘두른다.', mega: '물줄기 굵기·피해 증가' },
  hyper_beam: { name: '파괴광선', type: 'normal', cd: 10, icon: 'boom', desc: '힘을 모아 화면 끝까지 닿는 거대 광선을 쏜다. 쏜 뒤 반동으로 잠시 움직일 수 없다.', mega: '광선이 굵어지고 반동 시간 절반' },

  // ===== 롱스톤 → 강철톤 =====
  iron_tail: { name: '아이언테일', type: 'steel', cd: 0, icon: 'spin', desc: '거대한 꼬리로 땅을 내려친다. 3타째는 양옆으로 충격파가 퍼진다.', mega: '충격파가 더 멀리' },
  dig: { name: '구멍파기', type: 'ground', cd: 7, icon: 'dash', desc: '땅속으로 파고들어 모습을 감추고(무적) 자유롭게 이동한 뒤, 솟구치며 위의 적을 모두 쳐올린다.', mega: '땅속 이동 속도·분출 범위 증가' },
  rock_tomb: { name: '암석봉인', type: 'rock', cd: 8, icon: 'shield', desc: '근처 적들 위로 바위를 떨어뜨려 가둔다. 속박 + 둔화.', mega: '대상 수 증가 + 속박 시간 증가' },

  // ===== 스라크 → 핫삼 =====
  bullet_punch: { name: '불릿펀치', type: 'steel', cd: 0, icon: 'fist', desc: '눈에 보이지 않는 강철 주먹. 한 번 누를 때마다 2연타.', mega: '한 번에 3연타' },
  x_scissor: { name: '시저크로스', type: 'bug', cd: 5, icon: 'claw', desc: '돌진하며 X자 칼날을 연속으로 긋는다. 무적.', mega: '더 빠르고 더 많이 벤다' },
  u_turn: { name: '유턴', type: 'bug', cd: 4, icon: 'wing', desc: '가장 가까운 적을 꿰뚫고 등 뒤로 돌아가 급소를 친 뒤 뒤로 빠진다. 적이 없으면 전광석화처럼 돌진.', mega: '등 공격 피해 증가' }
};
