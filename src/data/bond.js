// 유대의 불꽃 Lv.1~6 영구 권능 — 침식의 핵을 정화해 불꽃 단계(GameScene.bondStage)가 오를 때마다 하나씩 해금 (누적)
//  Lv.1 관동 뮤츠 · Lv.2 성도 칠색조 · Lv.3 호연 레쿠쟈 · Lv.4 신오 디아루가 → 펄기아 · Lv.5 하나 용나선탑 제크로무 → 레시라무 · Lv.6 시초의 방 아르세우스
//  (가라르 무한다이노는 모인 불꽃을 레드에게 돌려주는 이야기 — 단계는 이미 6)
//  상처약(GameScene.quickPotion · 포켓샵 소지 한도 data/shop.js) · 기술 쿨타임(Player.cdOf) · 공격력(GameScene.bondMul) · 유대의 기적 부활(Player.faint)
export const BOND_POWERS = [
  { lv: 1, name: '생명의 불씨', from: '관동 · 뮤츠 정화', title: '상처약 회복량 강화', desc: '상처약 회복량 최대 체력의 40% → 55%', gain: '상처약 회복량이 최대 체력의 55%로 증가했습니다!' },
  { lv: 2, name: '성스러운 불꽃', from: '성도 · 칠색조 정화', title: '상처약 최대 소지 +1', desc: '상처약 최대 소지 · 구매 한도 3 → 4개', gain: '상처약 최대 소지 횟수가 4개로 증가했습니다!' },
  { lv: 3, name: '천공의 숨결', from: '호연 · 레쿠쟈 정화', title: '상처약 가속 & 전투 보조', desc: '상처약을 쓰면 5초간 이동 · 공격 속도 +20% · 모든 액티브 기술(Z · X · C) 쿨타임 영구 -10%', gain: '상처약을 쓰면 5초간 이동 · 공격 속도 +20%, 모든 기술 쿨타임이 10% 줄었습니다!' },
  { lv: 4, name: '시공의 등불', from: '신오 · 디아루가 → 펄기아 정화', title: '상처약 회복량 2차 강화', desc: '상처약 회복량 최대 체력의 70% · 쓰는 순간 1초 피해 면역 보호막', gain: '상처약 회복량이 70%로 증가하고, 쓰는 순간 1초 무적 보호막이 펼쳐집니다!' },
  { lv: 5, name: '진실과 이상의 성화', from: '하나 · 제크로무 → 레시라무 정화', title: '상처약 최대 소지 +1', desc: '상처약 최대 소지 · 구매 한도 5개 (처음 3개 → 마지막 5개)', gain: '상처약 최대 소지 횟수가 5개로 증가했습니다!' },
  { lv: 6, name: '완전체 유대의 태양', from: '시초의 방 · 아르세우스 정화', title: '불멸의 유대', desc: '모든 공격력 +20% · 쓰러질 피해를 받으면 지방마다 1번 체력 30%로 즉시 부활 (유대의 기적)', gain: '모든 공격력 +20% · 쓰러지면 지방마다 1번, 유대의 기적으로 체력 30% 부활!' }
];
export const BOND_MAX = BOND_POWERS.length;
export const POTION_BASE_MAX = 3;
export const potionMaxAt = lv => POTION_BASE_MAX + (lv >= 2 ? 1 : 0) + (lv >= 5 ? 1 : 0);   // 3 → 4 → 5
export const potionHealAt = lv => (lv >= 4 ? .7 : lv >= 1 ? .55 : .4);                    // 40% → 55% → 70%
export const bondCdMul = lv => (lv >= 3 ? .9 : 1);                                         // 천공의 숨결: 액티브 기술 쿨타임 -10%
export const BOND_HASTE_T = 5, BOND_HASTE = 1.2;                                           // 천공의 숨결: 상처약을 쓰면 5초 이동 · 공격 속도 +20%
export const BOND_SHIELD_T = 1;                                                            // 시공의 등불: 상처약을 쓰는 순간 1초 무적
export const BOND_SUN_ATK = .2, BOND_MIRACLE_HP = .3;                                      // 완전체 유대의 태양: 공격력 +20% · 유대의 기적 체력 30%
// 정화 단계 키: 침식의 핵을 정화한 지방 번호(0~5) · 용나선탑 흑백 영웅('heroes') — 단계 = 서로 다른 키 수 (최대 6)
export const HEROES_KEY = 'heroes';
