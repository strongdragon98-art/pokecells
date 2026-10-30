// 8·9세대 스타팅 라인 스킬 메타데이터 (흥나숭·염버니·울머기 / 나오하·뜨아거·꾸왁스)
// 형식은 data/pokemon.js 의 SKILLS 와 같다. 구현은 game/skills/gen89.js
export const SKILLS = {
  // ===== 흥나숭 =====
  branch_poke: { name: '가지찌르기', type: 'grass', cd: 0, icon: 'leaf', desc: '나뭇가지로 2번 찌른 뒤 3타째에 드럼스틱 내려찍기. 막타는 풀죽게 한다. 꾹 눌렀다 떼면 드럼 비트 지면 충격파.', mega: '찌르기 사거리 증가 + 내려찍기 양옆 뿌리 충격파(속박)' },
  drum_beating: { name: '드럼어택', type: 'grass', cd: 7, icon: 'boom', desc: '나무 드럼을 4번 두드린다. 박자마다 앞쪽 땅에서 뿌리가 점점 멀리 솟아 적을 띄우고 둔화.', mega: '뿌리가 앞뒤 양쪽으로 + 마지막 박자에 속박' },
  grassy_glide: { name: '그래스슬라이더', type: 'grass', cd: 4, icon: 'dash', desc: '잔디를 깔며 미끄러지듯 돌진. 잔디는 3.5초간 남아 적을 갉아먹는다. 풀 장판 위에서 쓰면 더 빠르고 강하다.', mega: '잔디가 6초간 남고, 그 위에 서 있으면 HP 회복' },

  // ===== 염버니 =====
  agile_kick: { name: '연속킥', type: 'fighting', cd: 0, icon: 'fist', desc: '빠른 발차기 2연타 후 3타째에 불꽃을 두른 날아차기로 돌진. 화상. 꾹 눌렀다 떼면 통통 튀는 불꽃 축구공 슛.', mega: '발차기마다 불꽃 추가타 + 날아차기 끝에 폭발' },
  pyro_ball: { name: '화염볼', type: 'fire', cd: 6, icon: 'flame', desc: '돌멩이를 튕겨 불을 붙여 차 날린다. 관통하는 큰 화염구가 땅에 한 번 튕기며 폭발. 화상.', mega: '세 번 튕기고 튕긴 자리마다 불길' },
  court_change: { name: '코트체인지', type: 'normal', cd: 6, icon: 'spin', desc: '가장 가까운 적과 자리를 맞바꾸며 피해를 주고 잠시 풀죽게 한다. 보스는 등 뒤로 이동.', mega: '원래 자리(적이 옮겨진 곳)에 화염 폭발' },

  // ===== 울머기 =====
  pound_water: { name: '막치기·물탄', type: 'water', cd: 0, icon: 'drop', desc: '손끝으로 물방울 탄을 빠르게 2연사한 뒤 3타째에 굵은 물탄 발사. 꾹 눌렀다 떼면 화면 끝까지 꿰뚫는 저격탄.', mega: '물탄이 관통하며 맞은 자리에 물보라(둔화)' },
  snipe_shot: { name: '노려맞히기', type: 'water', cd: 6, icon: 'orb', desc: '잠시 조준한 뒤 초고속 관통 물탄. 화면 안의 보스·가장 먼 적을 노리고 급소율이 높다.', mega: '두 발 연속 저격 + 급소율 증가' },
  camouflage: { name: '보호색', type: 'normal', cd: 9, icon: 'shield', desc: '3초간 모습을 감춰 피해를 받지 않고 빨라진다. 숨은 채 공격하면 해제되며 그 공격이 1.6배.', mega: '4.5초 · 더 빠르게 · 기습 2배' },

  // ===== 나오하 =====
  scratch_leaf: { name: '할퀴기·잎사귀', type: 'grass', cd: 0, icon: 'claw', desc: '할퀴기 2연타 후 3타째에 잎사귀 3장을 부채꼴로 날린다.', mega: '잎 4장 + 유도' },
  flower_trick: { name: '트릭플라워', type: 'grass', cd: 5, icon: 'seed', desc: '꽃다발을 포물선으로 던진다. 적이나 땅에 닿으면 폭발하며 반드시 급소.', mega: '폭발 범위 증가 + 꽃잎 5장이 흩어져 적을 추적(반드시 급소)' },
  sucker_punch: { name: '기습', type: 'dark', cd: 5, icon: 'fist', desc: '가장 가까운 적의 등 뒤로 순간이동해 일격. 풀죽음 · 시전 중 무적.', mega: '다른 적에게 한 번 더 기습' },

  // ===== 뜨아거 =====
  incinerate: { name: '불태우기', type: 'fire', cd: 0, icon: 'flame', desc: '불덩이를 포물선으로 뱉는다. 3타째는 큰 불덩이가 터지며 화상.', mega: '보랏빛 혼불 + 막타 자리에 저주 불길' },
  torch_song: { name: '플레어송', type: 'fire', cd: 7, icon: 'wave', desc: '불꽃 음표 5개를 부채꼴로 노래해 날린다(관통·약한 유도). 부를 때마다 8초간 공격 +10% (최대 3중첩).', mega: '음표 7개 + 최대 5중첩' },
  will_o_wisp: { name: '도깨비불', type: 'fire', cd: 9, icon: 'ghost', desc: '도깨비불 3개가 5초간 몸 주위를 돌며 닿는 적에게 피해와 화상.', mega: '5개 · 6초 · 궤도 확대 + 적 탄환을 지운다' },

  // ===== 꾸왁스 =====
  quick_peck: { name: '쪼기', type: 'flying', cd: 0, icon: 'wing', desc: '부리로 빠르게 2번 쪼고 3타째에 돌진 쪼기. 막타는 급소율이 높다.', mega: '쪼을 때마다 물방울 탄 발사' },
  aqua_step: { name: '아쿠아스텝', type: 'water', cd: 6, icon: 'bubble', desc: '춤추듯 전진하며 물 발차기 4연타. 끝까지 추면 4초간 이동속도 +30%.', mega: '발차기마다 물결 탄 + 5초간 공격 +15%까지' },
  drain_punch: { name: '드레인펀치', type: 'fighting', cd: 6, icon: 'fist', desc: '기를 모아 묵직한 일격. 준 피해의 50%만큼 HP 회복.', mega: '범위 증가 + 회복 75%' }
};
