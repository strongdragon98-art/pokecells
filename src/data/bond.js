// 유대의 불꽃 Lv.1~6 영구 권능 — 침식의 핵을 정화해 불꽃 단계(GameScene.bondStage)가 오를 때마다 하나씩 해금 (누적 · 하드코어 압축)
//  Lv.1 관동 뮤츠 · Lv.2 성도 칠색조 · Lv.3 호연 레쿠쟈 · Lv.4 신오 디아루가 → 펄기아 · Lv.5 하나 용나선탑 제크로무 → 레시라무 · Lv.6 시초의 방 아르세우스
//  (가라르 무한다이노는 모인 불꽃을 레드에게 돌려주는 이야기 — 단계는 이미 6)
//  상처약(GameScene.quickPotion · 포켓샵 소지 한도 data/shop.js) · 패링(Player.parryChainStep) · 공격력(GameScene.bondMul) · 유대의 추가 타격(Player.bondStrike)
export const BOND_POWERS = [
  { lv: 1, name: '생명의 불씨', from: '관동 · 뮤츠 정화', title: '상처약 회복량 강화', desc: '상처약 회복량 최대 체력의 35% → 42%', gain: '상처약 회복량이 최대 체력의 42%로 증가했습니다!' },
  { lv: 2, name: '성스러운 불꽃', from: '성도 · 칠색조 정화', title: '상처약 최대 소지 +1', desc: '상처약 최대 소지 · 구매 한도 2 → 3개', gain: '상처약 최대 소지 횟수가 3개로 증가했습니다!' },
  { lv: 3, name: '천공의 반격', from: '호연 · 레쿠쟈 정화', title: '패링 강화', desc: '↓ + Z 패링 성공 시 보스 그로기 누적 +15% · 반사탄 · 카운터 피해 +20%', gain: '패링 성공 시 보스 그로기 누적 +15%, 반사 · 카운터 피해가 20% 증가했습니다!' },
  { lv: 4, name: '시공의 등불', from: '신오 · 디아루가 → 펄기아 정화', title: '상처약 회복량 최대', desc: '상처약 회복량 최대 체력의 42% → 50% (최대치)', gain: '상처약 회복량이 최대치인 50%로 증가했습니다!' },
  { lv: 5, name: '진실과 이상의 성화', from: '하나 · 제크로무 → 레시라무 정화', title: '상처약 최대 소지 +1', desc: '상처약 최대 소지 · 구매 한도 3 → 4개 (최종 최대치)', gain: '상처약 최대 소지 횟수가 최종 최대치인 4개로 증가했습니다!' },
  { lv: 6, name: '완전체 유대의 태양', from: '시초의 방 · 아르세우스 정화', title: '유대의 추가 타격', desc: '체력 80% 이상이면 모든 공격력 +15% · 풀차징 샷 · 패링 성공 시 황금빛 「유대의 추가 타격」 자동 발동', gain: '체력 80% 이상일 때 공격력 +15%, 풀차징 샷 · 패링 성공 시 유대의 추가 타격이 터집니다!' }
];
export const BOND_MAX = BOND_POWERS.length;
export const POTION_BASE_MAX = 2;
export const potionMaxAt = lv => POTION_BASE_MAX + (lv >= 2 ? 1 : 0) + (lv >= 5 ? 1 : 0);   // 2 → 3 → 4
export const potionHealAt = lv => (lv >= 4 ? .5 : lv >= 1 ? .42 : .35);                    // 35% → 42% → 50%
export const bondParry = lv => (lv >= 3 ? { stag: 1.15, pow: 1.2 } : { stag: 1, pow: 1 });   // 천공의 반격: 패링 그로기 누적 +15% · 반사 · 카운터 피해 +20%
export const BOND_SUN_ATK = .15, BOND_SUN_HP = .8;                                        // 완전체 유대의 태양: 체력 80% 이상이면 모든 공격력 +15%
export const BOND_STRIKE_MUL = 1.2, BOND_STRIKE_CD = .35;                                 // 유대의 추가 타격: 공격력 ×120% 황금 낙뢰 (0.35초에 한 번)
// 정화 단계 키: 침식의 핵을 정화한 지방 번호(0~5) · 용나선탑 흑백 영웅('heroes') — 단계 = 서로 다른 키 수 (최대 6)
export const HEROES_KEY = 'heroes';
