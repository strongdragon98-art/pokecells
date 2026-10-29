// 2·3세대 스타팅 계열 기술 표시 정보 (실제 동작은 game/skills/gen23.js)
export const SKILLS = {
  // ===== 치코리타 =====
  magical_leaf: { name: '매지컬리프', type: 'grass', cd: 0, icon: 'leaf', desc: '잎날 베기 2연타 후 3타째에 적을 쫓아가는 마법 잎 발사.', mega: '유도 잎 3장 + 벽 통과' },
  petal_blizzard: { name: '꽃보라', type: 'grass', cd: 7, icon: 'spin', desc: '1초간 몸 주위에 꽃잎 폭풍. 적을 안쪽으로 끌어당기며 다단 히트.', mega: '범위 1.5배 + 끝날 때 꽃잎 6장이 흩어져 적을 쫓는다' },
  synthesis: { name: '광합성', type: 'grass', cd: 10, icon: 'orb', desc: '햇빛을 받아 3초간 체력을 서서히 회복하고 받는 피해 감소.', mega: '회복량 1.5배 + 공격력 상승' },

  // ===== 브케인 =====
  flare_jab: { name: '불꽃펀치 연타', type: 'fire', cd: 0, icon: 'fist', desc: '파고드는 불꽃 주먹 연타. 3타째는 강한 일격. 화상.', mega: '3타째 주먹이 폭발한다' },
  eruption: { name: '분화', type: 'fire', cd: 8, icon: 'boom', desc: '등에서 불덩이를 쏘아 올려 앞쪽에 쏟아붓는다. 현재 체력이 많을수록 강하다.', mega: '불덩이 8발 + 떨어진 자리에 불길' },
  flame_wheel: { name: '화염바퀴', type: 'fire', cd: 5, icon: 'flame', desc: '불꽃을 두르고 땅을 따라 굴러간다. 벽에 튕기고 지나간 자리에 불길.', mega: '더 빠르고 길게 + 불길 지속 증가' },

  // ===== 리아코 =====
  chomp_combo: { name: '깨물기', type: 'dark', cd: 0, icon: 'fang', desc: '물기 2연타 후 3타째에 큰 턱으로 덥석. 풀죽게 한다.', mega: '턱 범위 1.5배 + 흡혈' },
  waterfall: { name: '폭포오르기', type: 'water', cd: 6, icon: 'wave', desc: '물기둥을 타고 솟구치며 올려친다. 맞은 적은 높이 뜬다.', mega: '더 높이 솟구치고 물기둥이 남아 계속 타격' },
  aqua_jet: { name: '아쿠아제트', type: 'water', cd: 3, icon: 'dash', desc: '물을 뿜으며 순식간에 돌진. 공중 사용 가능. 적중하면 튕겨 오르고 재사용 대기 60% 감소.', mega: '더 빠름 + 적중 시 물보라 폭발' },

  // ===== 나무지기 =====
  leaf_blade: { name: '리프블레이드', type: 'grass', cd: 0, icon: 'claw', desc: '빠르고 긴 잎칼 연속 베기. 급소율이 높다. 3타째는 파고들며 벤다.', mega: '3타째에 용의 칼날 파동 발사' },
  bullet_seed: { name: '기관총', type: 'grass', cd: 5, icon: 'seed', desc: '0.9초간 씨앗을 기관총처럼 연사. 쏘면서 이동 가능.', mega: '씨앗 2배 + 관통' },
  detect: { name: '판별', type: 'grass', cd: 6, icon: 'shield', desc: '0.5초간 무적 간파 자세. 적이 닿거나 탄이 오면 등 뒤로 돌아 급소 반격.', mega: '자세 시간 증가 + 드래곤 반격이 주변까지' },

  // ===== 아차모 =====
  double_kick: { name: '두번치기', type: 'fighting', cd: 0, icon: 'fist', desc: '한 번에 발차기 2연타. 3타째의 두 번째 발차기는 적을 띄운다.', mega: '발차기에 불꽃이 붙어 화상' },
  blaze_kick: { name: '브레이즈킥', type: 'fire', cd: 5, icon: 'flame', desc: '뛰어들며 불꽃 발차기. 급소율이 높고 적을 띄우며 화상.', mega: '착탄 폭발 + 가속(3초 이동 속도 증가)' },
  sky_uppercut: { name: '스카이업퍼', type: 'fighting', cd: 5, icon: 'fist', desc: '솟구치는 어퍼컷. 몸과 함께 적을 하늘로 끌어올린다.', mega: '더 높이 + 2연타 + 화상 + 공중 점프 회복' },

  // ===== 물짱이 =====
  mud_slap: { name: '진흙뿌리기', type: 'ground', cd: 0, icon: 'drop', desc: '진흙 따귀 2연타 후 3타째에 진흙덩이를 던져 둔화시킨다.', mega: '진흙덩이 3갈래' },
  muddy_water: { name: '탁류', type: 'water', cd: 7, icon: 'wave', desc: '땅을 따라 나아가는 흙탕물 파도. 적을 휩쓸어 밀어내고 둔화.', mega: '파도 1.5배 크기 + 더 멀리 + 2번 타격' },
  earthquake: { name: '지진', type: 'ground', cd: 9, icon: 'boom', desc: '땅을 내리쳐 넓은 범위의 땅 위 적을 모두 띄운다. 공중이면 먼저 내리꽂는다. 날아다니는 적은 피한다.', mega: '범위 증가 + 여진 한 번 더' }
};
