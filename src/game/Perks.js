// 기술머신 특성 카드(perk): 카드로 받은 포켓몬에게만 남는 상시 효과 (Player.members[i].perks = { id: 겹친 수 })
//  수치형 효과는 mods 로 합쳐지고(data/items.js computeMods), 적중·피격·처치 때 터지는 효과는 아래 onHit / onHurt / onKill 갈고리가 맡는다
//  등급 5단계: ⚪ 커먼 · 🟢 언커먼 · 🔵 레어 · 🟣 유니크 · 🟡 전설 (data/tm.js GRADE) — max: 겹칠 수 있는 최대 수 (전설 유물은 1개)
//  📉 스탯 인플레이션 억제: 단순 수치 카드는 커먼 3 ~ 5% · 언커먼 6 ~ 10% · 레어 12 ~ 18% (합성 한 단계마다 기본값의 60% — 커먼은 +2 ~ 3%p 씩)
//   고위험 · 고수익 양날의 검(curse)은 유니크 등급으로 올려 초반 지방엔 드물게 (지방별 등급 확률 — data/tm.js GRADE_W)
//  step: 합성할 때마다 기본 효과의 60% 대신 이만큼 더한다 (곱해지는 값은 '줄어드는 양'에 — 경량화 스텝 -15% → -25% → -35% → -45%)
//  ⚖️ 양날의 검(curse): mods = 극대화 효과(합성할수록 대폭 상승) · cost = 대가(합성해도 커지지 않고 ease 만큼씩 완화) · up / down = 카드 앞면의 두 줄 설명
import Phaser from 'phaser';
import { Sfx } from '../systems/Audio.js';
import { typeColor } from '../data/types.js';

export const PERKS = {
  // ================= ⚪ 커먼 =================
  c_power: { grade: '커먼', cat: '능력치', name: '숙련의 기억: 힘', desc: '이 포켓몬의 공격력 +5%.', max: 5, mods: { atkMul: 1.05 } },
  c_focus: { grade: '커먼', cat: '능력치', name: '숙련의 기억: 집중', desc: '모든 기술 쿨타임 -5%.', max: 4, mods: { cdMul: .95 } },
  c_vigor: { grade: '커먼', cat: '능력치', name: '단련된 몸', desc: '최대 체력 +5%.', max: 4, mods: { hpMul: 1.05 } },
  c_swift: { grade: '커먼', cat: '기동', name: '신속의 깃털', desc: '이동 속도 +5%.', max: 3, mods: { speedMul: 1.05 } },
  c_dash: { grade: '커먼', cat: '기동', name: '질풍 대시', desc: '대시 쿨타임 -5%.', max: 2, mods: { dashCdMul: .95 } },
  c_regen: { grade: '커먼', cat: '유틸', name: '오렌 주머니', desc: '출전 중 매초 최대 체력의 0.2% 회복.', max: 3, mods: { regen: .002 } },
  c_crit: { grade: '커먼', cat: '능력치', name: '날카로운 눈', desc: '급소율 +4%.', max: 3, mods: { crit: .04 } },
  c_guard: { grade: '커먼', cat: '유틸', name: '단단한 비늘', desc: '받는 피해 -4%.', max: 3, mods: { guard: .96 } },
  c_swap: { grade: '커먼', cat: '유틸', name: '재빠른 교대', desc: '교대 쿨타임 -5%.', max: 2, mods: { swapCdMul: .95 } },
  c_leech: { grade: '커먼', cat: '유틸', name: '흡혈 이빨', desc: '준 피해의 3%만큼 회복.', max: 3, mods: { lifesteal: .03 } },
  c_reach: { grade: '커먼', cat: '능력치', name: '넓은 시야', desc: '공격 판정·이펙트 크기 +5%.', max: 3, mods: { sizeAdd: .05 } },
  c_iframe: { grade: '커먼', cat: '기동', name: '회피 본능', desc: '대시 무적 시간 +0.04초 (약 +15%).', max: 2, mods: { dashInvAdd: .04 } },
  // ⚪ 기초 단련 (단순 소폭 수치 · 합성할 때마다 +2 ~ 3%p)
  c_basic_atk: { grade: '커먼', cat: '능력치', name: '기초 근력 단련', desc: '모든 공격력 +4%.', max: 4, mods: { atkMul: 1.04 } },
  c_basic_hp: { grade: '커먼', cat: '능력치', name: '기초 체력 단련', desc: '최대 체력(Max HP) +5%.', max: 4, mods: { hpMul: 1.05 } },
  c_light_feet: { grade: '커먼', cat: '기동', name: '가벼운 발걸음', desc: '이동 속도 +4%.', max: 4, mods: { speedMul: 1.04 } },
  c_wrist: { grade: '커먼', cat: '능력치', name: '손목 스냅 훈련', desc: '기본 평타(Z) 공격 속도 +5%.', max: 4, mods: { comboHaste: .05 } },
  c_breathe: { grade: '커먼', cat: '대시', name: '호흡 가다듬기', desc: '대시(Shift) 재사용 대기시간 -5%.', max: 4, mods: { dashCdMul: .95 } },
  c_warmup: { grade: '커먼', cat: '능력치', name: '기술 예열', desc: '액티브 스킬(X · C · V) 쿨타임 -4%.', max: 4, mods: { cdMul: .96 } },
  c_crit_intro: { grade: '커먼', cat: '능력치', name: '급소 노리기 입문', desc: '치명타 확률 +3%.', max: 4, mods: { crit: .03 } },
  c_sharp: { grade: '커먼', cat: '능력치', name: '날카로운 타격', desc: '치명타 피해량 +8%.', max: 4, mods: { critDmg: .08 } },
  c_armor: { grade: '커먼', cat: '유틸', name: '방어구 보강', desc: '적에게 받는 모든 피해 -3%.', max: 4, mods: { guard: .97 } },
  c_charge_stab: { grade: '커먼', cat: '차징', name: '차징 안정화', desc: 'Z 홀드 차징 시간 -5%.', max: 4, mods: { chargeFast: .05 } },

  // ================= 🟢 언커먼 (커먼보다 한 단계 높은 단순 수치 상향 · 6 ~ 10%) =================
  n_martial: { grade: '언커먼', cat: '능력치', name: '중급 무술 교본', desc: '기본 평타(Z) 3타 데미지 +8%.', max: 4, mods: { bandMul: 1.08 } },
  n_core: { grade: '언커먼', cat: '능력치', name: '고밀도 에너지 코어', desc: '액티브 스킬(X · C) 데미지 +8%.', max: 4, mods: { specsMul: 1.08 } },
  n_vital: { grade: '언커먼', cat: '능력치', name: '강인한 생명력', desc: '최대 체력(Max HP) +9%.', max: 4, mods: { hpMul: 1.09 } },
  n_agile: { grade: '언커먼', cat: '기동', name: '순발력 강화', desc: '이동 속도 +6% · 점프력 +4%.', max: 4, mods: { speedMul: 1.06, jumpAdd: .04 } },
  n_evade: { grade: '언커먼', cat: '대시', name: '날렵한 회피 기동', desc: '대시(Shift) 쿨타임 -8% · 대시 거리 +6%.', max: 4, mods: { dashCdMul: .92, dashDist: .06 } },
  n_reflex: { grade: '언커먼', cat: '패링', name: '반사 신경 연마', desc: '↓ + Z 패링 성공 시 반사 · 카운터 데미지 +10%.', max: 4, mods: { razorPow: .1 } },
  n_focus_shot: { grade: '언커먼', cat: '차징', name: '응축 사격 훈련', desc: 'Z 홀드 차징 샷 데미지 +9%.', max: 4, mods: { overCharge: .09 } },
  n_precise: { grade: '언커먼', cat: '능력치', name: '정밀 타격술', desc: '치명타 확률 +5% · 치명타 피해 +10%.', max: 4, mods: { crit: .05, critDmg: .1 } },
  n_hide: { grade: '언커먼', cat: '유틸', name: '단단한 외피', desc: '받는 피해 -5% · 피격 넉백 -30%.', max: 4, mods: { guard: .95, kbResist: .3 } },
  n_impact: { grade: '언커먼', cat: '능력치', name: '타격감 증폭', desc: '보스에게 입히는 모든 그로기(Stagger) 누적량 +7%.', max: 4, mods: { stagAdd: .07 } },

  // ================= 🔵 레어 =================
  r_jump: { grade: '레어', cat: '기동', name: '비상의 깃털', desc: '공중 점프 횟수 +1 — 기본 2단 점프가 3단 점프가 된다.', max: 2, mods: { extraJumps: 1 } },
  r_dash: { grade: '레어', cat: '기동', name: '순풍의 가호', desc: '대시 쿨타임 -15%.', max: 1, mods: { dashCdMul: .85 } },
  r_speed: { grade: '레어', cat: '기동', name: '쾌속 스카프', desc: '이동 속도 +15%.', max: 2, mods: { speedMul: 1.15 } },
  r_burn: { grade: '레어', cat: '속성 부여', name: '불꽃 부여', desc: '적중 시 15% 확률로 화상 (4초 지속 피해).', max: 2, mods: { pBurn: .15 } },
  r_freeze: { grade: '레어', cat: '속성 부여', name: '냉기 부여', desc: '적중 시 12% 확률로 빙결 (1초 이동 불가).', max: 2, mods: { pFreeze: .12 } },
  r_para: { grade: '레어', cat: '속성 부여', name: '전기 부여', desc: '적중 시 15% 확률로 마비 (3초 속도 감소).', max: 2, mods: { pPara: .15 } },
  r_poison: { grade: '레어', cat: '속성 부여', name: '독 부여', desc: '적중 시 15% 확률로 맹독 (5초 지속 피해).', max: 2, mods: { pPoison: .15 } },
  r_proj: { grade: '레어', cat: '스킬 변이', name: '확산 렌즈', desc: '투사체 +1개.', max: 2, mods: { extraProj: 1 } },
  r_haste: { grade: '레어', cat: '능력치', name: '가속 회로', desc: '모든 기술 쿨타임 -15%.', max: 2, mods: { cdMul: .85 } },
  r_shell: { grade: '레어', cat: '유틸', name: '조개껍질 방울', desc: '준 피해의 6%만큼 회복.', max: 2, mods: { lifesteal: .06 } },
  r_bomb: { grade: '레어', cat: '대시 진화', name: '⚡ 대시 진화: 대시 폭탄', desc: '대시를 시작한 자리에 폭탄을 남긴다 (0.45초 뒤 폭발).', max: 1, mods: { dashBomb: 1 } },
  r_tough: { grade: '레어', cat: '유틸', name: '강철 몸', desc: '받는 피해 -12%.', max: 2, mods: { guard: .88 } },
  r_crit: { grade: '레어', cat: '능력치', name: '예리한 발톱', desc: '급소율 +12%.', max: 2, mods: { crit: .12 } },

  // ================= 🟣 유니크 =================
  u_curse: { grade: '유니크', cat: '속성 부여', name: '저주 부여', desc: '적중 시 30% 확률로 저주 (5초간 받는 피해 +30%).', max: 1, mods: { pCurse: .3 } },
  u_split: { grade: '유니크', cat: '스킬 변이', name: '분열 코어', desc: '투사체 +2갈래.', max: 1, mods: { extraProj: 2 } },
  u_giant: { grade: '유니크', cat: '스킬 변이', name: '거대화 코어', desc: '스킬 크기 1.5배.', max: 1, mods: { sizeMul: 1.5 } },
  u_chain: { grade: '유니크', cat: '스킬 변이', name: '연쇄 번개', desc: '적중 시 20% 확률로 가까운 적 3마리에게 번개가 연쇄로 튄다.', max: 1, mods: { chain: .2, chainN: 3 } },
  u_flame: { grade: '유니크', cat: '스킬 변이', name: '화염 장판', desc: '적중 시 20% 확률로 그 자리에 2초간 불타는 장판이 생긴다.', max: 1, mods: { flameZone: .2 } },
  u_toxic: { grade: '유니크', cat: '스킬 변이', name: '독 늪', desc: '적중 시 20% 확률로 그 자리에 2.5초간 독 늪이 생긴다.', max: 1, mods: { toxicZone: .2 } },
  u_homing: { grade: '유니크', cat: '스킬 변이', name: '유도 탄두', desc: '투사체가 가까운 적을 쫓아간다.', max: 1, mods: { homing: 1 } },
  u_clone: { grade: '유니크', cat: '대시 진화', name: '⚡ 대시 진화: 분신 베기', desc: '대시한 길에 분신이 남아 지나간 적을 벤다.', max: 1, mods: { dashClone: 1 } },
  u_berserk: { grade: '유니크', cat: '능력치', name: '역린의 비늘', desc: '체력 50% 이하일 때 공격력 +35%.', max: 1, mods: { berserk: .35 } },
  u_execute: { grade: '유니크', cat: '능력치', name: '마무리 일격', desc: '체력 25% 이하인 적에게 주는 피해 +50%.', max: 1, mods: { execute: .5 } },
  // ===== 차징 카드 (모든 포켓몬 공용 · 등장 보장 — data/tm.js CHARGE_PERKS) — 효과는 Player.chargeMax · chargeAt · fireCharge 가 장 수를 직접 센다 =====
  u_charge: { grade: '유니크', cat: '차징', name: '⚡ 초고압 차징 코어', desc: 'Z 홀드 차징 2단 해금 — 총합 650% 중형 기탄 (투사체 1.8배 · 다단히트↑). 한 장 더 합성(+1강)하면 3단 풀차징 해금 — 총합 1,100% 초대형 속성포!', max: 2, mods: {} },
  u_rapid: { grade: '레어', cat: '차징', name: '🔋 고속 축전 코일', desc: '차징에 걸리는 시간 -15% · 발사 반동으로 멈칫하지 않는다 (합성하면 -25% → -35%).', max: 3, mods: {} },
  u_shock: { grade: '유니크', cat: '차징', name: '💥 차징 임팩트 웨이브', desc: '완충한 차징 샷이 맞으면 그 자리에 2차 연쇄 속성 폭발 장판이 생기고, 보스 그로기 게이지를 2배로 깎는다 (합성하면 장판이 더 크고 세게).', max: 2, mods: {} },
  u_thorns: { grade: '유니크', cat: '유틸', name: '가시 갑옷', desc: '맞으면 주변 적에게 공격력 ×1.2 피해를 되돌려 준다.', max: 1, mods: { thorns: 1.2 } },

  // ================= ⚡ 대시 진화 (예전 단순 돌진 기술들의 기믹 → Shift 대시 자체가 공격기로) =================
  d_flame: { grade: '레어', cat: '대시 진화', name: '⚡ 대시 진화: 화염 대시', desc: '대시한 길에 2초간 불길 장판이 남는다 (화상).', max: 1, mods: { dashFlame: 1 } },
  d_aqua: { grade: '레어', cat: '대시 진화', name: '⚡ 대시 진화: 아쿠아 제트', desc: '대시 중 부딪히는 적을 물살로 밀쳐 내며 여러 번 친다.', max: 1, mods: { dashAqua: 1 } },
  d_frost: { grade: '레어', cat: '대시 진화', name: '⚡ 대시 진화: 서리 질주', desc: '대시로 스친 적을 얼려 둔화시키고, 지나간 길에 얼음 결정이 흩날린다.', max: 1, mods: { dashFrost: 1 } },
  d_thunder: { grade: '유니크', cat: '대시 진화', name: '⚡ 대시 진화: 썬더 스텝', desc: '대시를 시작한 자리와 끝난 자리에 낙뢰가 떨어져 폭발한다 (마비).', max: 1, mods: { dashThunder: 1 } },
  d_decoy: { grade: '유니크', cat: '대시 진화', name: '⚡ 대시 진화: 환영 분신', desc: '대시한 자리에 분신이 남아 1.2초 동안 주변 적을 끌어당긴 뒤 폭발한다.', max: 1, mods: { dashDecoy: 1 } },
  d_shadow: { grade: '유니크', cat: '대시 진화', name: '⚡ 대시 진화: 그림자 질주', desc: '대시 무적 시간 +0.2초. 스쳐 지나간 적에게 저주(받는 피해 +30%)를 건다.', max: 1, mods: { dashShadow: 1, dashInvAdd: .2 } },
  d_nova: { grade: '전설', cat: '대시 진화', name: '⚡ 대시 진화: 신속의 섬광', desc: '대시 쿨타임 -50%. 대시가 끝날 때마다 둘레에 빛의 충격파가 터진다.', max: 1, mods: { dashCdMul: .5, dashNova: 1 } },

  // ================= 💨 대시 · 🛡️ 패링 (모든 포켓몬 공용 · 커먼 · 레어) =================
  //  효과: Player(대시 거리 · 공중 대시 · 패링 판정 · 헛방 쿨타임 · 회피 재장전 · 반격의 일격) · 아래 onDash(질풍 · 스파크) · onParry(회복 · 충격파 · 반격) · Combat(증폭 반사탄)
  c_lightstep: { grade: '커먼', cat: '대시', name: '💨 경량화 스텝', desc: '대시 재사용 쿨타임 -5% (합성할 때마다 3%p 더 — -8% · -11% · -14%).', max: 4, step: .03, mods: { dashCdMul: .95 } },
  c_afterimage: { grade: '커먼', cat: '대시', name: '💨 잔상 회피', desc: '대시 무적 시간 +0.03초 · 대시 거리 +5%.', max: 4, mods: { dashInvAdd: .03, dashDist: .05 } },
  c_gale: { grade: '커먼', cat: '대시', name: '💨 질풍의 추진력', desc: '대시 직후 2초간 이동 속도 +5% · 다음 평타 1타가 1.5배 빨라진다.', max: 4, mods: { dashGale: 1 } },
  r_airboost: { grade: '레어', cat: '대시', name: '💨 공중 기동 부스터', desc: '점프 중 공중 대시 횟수 +1회.', max: 2, mods: { extraAirDash: 1 } },
  r_spark: { grade: '레어', cat: '대시', name: '💨 스파크 대시', desc: '대시한 길에 속성 정전기 흔적이 남아, 스쳐 지나간 적에게 평타 80% 피해 · 짧은 경직.', max: 4, mods: { dashSpark: 1 } },
  r_reload: { grade: '레어', cat: '대시', name: '💨 전술 재장전 스텝', desc: '대시 무적으로 적의 공격을 피하면 쿨타임 중인 기술(Z · X · C)의 남은 쿨타임이 0.8초 줄어든다.', max: 4, mods: { dashReload: 1 } },
  c_steady: { grade: '커먼', cat: '패링', name: '🛡️ 굳건한 방어 태세', desc: '↓ + Z 패링 헛방 뒤 재사용 쿨타임(1.8초) -5% · 무방비 후딜레이도 그만큼 짧아진다.', max: 4, mods: { parryCdMul: .95 } },
  c_reflex: { grade: '커먼', cat: '패링', name: '🛡️ 예리한 반사 신경', desc: '↓ + Z 패링 성공 판정 시간 +5%.', max: 4, mods: { parryWinMul: 1.05 } },
  c_breath: { grade: '커먼', cat: '패링', name: '🛡️ 철벽의 호흡', desc: '패링에 성공하면 체력을 최대 HP의 3% 즉시 회복 (합성하면 회복량 증가).', max: 4, mods: { parryHeal: .03 } },
  r_amplify: { grade: '레어', cat: '패링', name: '🛡️ 증폭 반사경', desc: '패링으로 튕겨 낸 적 투사체의 크기 · 비행 속도 +30% · 반사 피해 +15%.', max: 4, mods: { reflectAmp: 1 } },
  r_wave: { grade: '레어', cat: '패링', name: '🛡️ 충격파 카운터', desc: '근접 공격이나 투사체를 패링하는 순간 둘레 120px 에 충격파가 터져 주변 적을 밀쳐 내고 보스 그로기를 더 쌓는다.', max: 4, mods: { parryWave: 1 } },
  r_counter: { grade: '레어', cat: '패링', name: '🛡️ 반격의 일격', desc: '패링 성공 뒤 2초 안에 Z 를 누르고 있으면 차징 샷이 즉시 완충 · 또는 그 안에 쓴 다음 기술 피해 +15%.', max: 4, mods: { parryCounter: 1 } },

  // ================= ⚖️ 양날의 검 (하이리스크 · 하이리턴 — 치명적인 대가를 안고 한 메커니즘을 괴물처럼 폭발시킨다) =================
  //  카드 테두리에 검붉은 스파크 · 보랏빛 오라 (UIScene.tmCurseFrame) · 설명은 [🔺 극대화 효과] / [🔻 대가 · 디버프] 두 칸
  //  합성(+1 ~ +3강): 극대화 효과만 기본값의 60% 씩 더 오르고, 대가는 그대로 ease(10%) 씩 완화된다 (perkMods)
  //  효과: 찰나의 카운터 Player.parryChainStep · parryWhiff / 과부하 Combat.damageEnemy · Player.fireCharge · takeHit / 유리대포 items.computeMods · takeHit
  //   도박사 Player 대시 / 광전사 Player.atk · cardSpeed · GameScene.quickPotion / 초중량 Player.useSkill · Combat.damageEnemy / 마력 폭주 Player.manaDrive / 영거리 Combat.damageEnemy
  u_razor: { grade: '유니크', cat: '양날의 검', curse: true, name: '⚖️ 찰나의 카운터', en: 'Razor-Thin Parry', max: 4, ease: .1,
    up: '↓ + Z 패링 성공 시 반사 투사체 · 카운터 피해 +160% 폭증 · 보스 그로기 누적 2배!', down: '패링 성공 판정 시간 -35% (0.22 → 0.14초) · 헛방 재사용 쿨타임 +1.0초',
    mods: { razorPow: 1.6, razorStag: 1 }, cost: { parryWinMul: .65, whiffCdAdd: 1 } },
  u_overload: { grade: '유니크', cat: '양날의 검', curse: true, name: '⚖️ 과부하 차징 캐논', en: 'Overloaded Charge Core', max: 4, ease: .1,
    up: 'Z 홀드 차징 샷 최종 피해 +120% · 폭발 반경 1.8배 확대!', down: '차징을 모으는 동안 이동 속도 -60% (거의 제자리) · 모으는 중 받는 피해 +30%',
    mods: { overCharge: 1.2, overBoom: .8 }, cost: { chargeSlow: .6, chargeHurt: .3 } },
  r_glass: { grade: '유니크', cat: '양날의 검', curse: true, name: '⚖️ 유리대포의 각오', en: 'Glass Cannon Protocol', max: 4, ease: .1,
    up: '모든 평타 · 차징 샷 · 기술 최종 공격력 +65% 영구 증가 · 급소율 +20%!', down: '이 포켓몬의 최대 체력 -30% · 피격 뒤 무적 시간 -25%',
    mods: { allMul: 1.65, crit: .2 }, cost: { hpMul: .7, invMul: .75 } },
  r_allin: { grade: '유니크', cat: '양날의 검', curse: true, name: '⚖️ 도박사의 외줄타기 스텝', en: 'All-In Dash', max: 4, ease: .1,
    up: '대시(Shift) 무적 시간 2배 · 대시 직후 2초 안의 다음 공격은 100% 확정 치명타!', down: '대시 재사용 쿨타임 +60% (남발 불가)',
    mods: { dashInvX: 1, dashCrit: 2 }, cost: { dashCdMul: 1.6 } },
  r_blood: { grade: '유니크', cat: '양날의 검', curse: true, name: '⚖️ 광전사의 혈투', en: "Berserker's Pact", max: 4, ease: .1,
    up: '적중할 때마다 준 피해의 3% 흡혈 · 남은 체력이 낮을수록 공격 속도 · 피해 최대 +80% 폭증!', down: '상처약 회복 효율 -50%',
    mods: { lifesteal: .03, bloodRage: .8 }, cost: { potionCut: .5 } },
  r_heavy: { grade: '유니크', cat: '양날의 검', curse: true, name: '⚖️ 초중량 일격', en: 'Heavyweight Impact', max: 4, ease: .1,
    up: '평타(Z) 3타 콤보 1타당 피해 +90% · 평타만으로도 보스 그로기 · 3타 피니시는 잡몹 경직!', down: '평타 공격 속도 -25% · 3타 피니시 후딜레이 +0.3초 (대시 · 기술로 끊자)',
    mods: { heavyHit: .9, heavyStag: 1 }, cost: { comboSlow: .25, finishLag: .3 } },
  u_manadrive: { grade: '유니크', cat: '양날의 검', curse: true, name: '⚖️ 마력 폭주 기관', en: 'Mana Overdrive', max: 4, ease: .1,
    up: '액티브 기술(X · C) 피해 +85% · 기술 크기 · 범위 1.5배 확대!', down: '기술을 쓸 때마다 지금 체력의 4% 를 코스트로 소모 (체력 5% 이하면 소모 없음)',
    mods: { skillPow: .85, skillSize: .5 }, cost: { castCost: .04 } },
  r_pointblank: { grade: '유니크', cat: '양날의 검', curse: true, name: '⚖️ 영거리 사격술', en: 'Point-Blank Sniper', max: 4, ease: .1,
    up: '적과 140px 안 근접 거리에서 맞힌 모든 공격 · 차징 샷 피해 +75% 증폭!', down: '300px 밖 먼 거리에서 맞힌 원거리 공격 피해 -30%',
    mods: { nearPow: .75 }, cost: { farCut: .3 } },

  // ================= 🟡 전설 (태고의 유물) =================
  l_orb: { grade: '전설', cat: '유물', name: '태고의 유물: 생명의구슬', desc: '모든 최종 피해 +45%. 기술(X·C)을 쓸 때 체력 3% 소모, 적을 쓰러뜨리면 체력 3% 회복.', max: 1, mods: { allMul: 1.45, orbCost: true, killHeal: .03 } },
  l_band: { grade: '전설', cat: '유물', name: '태고의 유물: 구애머리띠', desc: 'Z칸 기술(기본 연타·근접) 피해 +60%.', max: 1, mods: { bandMul: 1.6 } },
  l_specs: { grade: '전설', cat: '유물', name: '태고의 유물: 구애안경', desc: 'X·C칸 기술 피해 +60%.', max: 1, mods: { specsMul: 1.6 } },
  l_sash: { grade: '전설', cat: '유물', name: '태고의 유물: 기합의띠', desc: '쓰러질 피해를 받으면 체력 1로 버티고 3초간 완전 무적 (방마다 1번).', max: 1, mods: { sturdy: 1 } },
  l_mega: { grade: '전설', cat: '유물', name: '태고의 유물: 메가스톤 코어', desc: '메가스톤 1개를 바로 얻고, 이 포켓몬의 진화 경험치 획득량 2배.', max: 1, mods: { expMul: 2 }, onGet: p => { p.mega.stones++; } },
  l_hole: { grade: '전설', cat: '스킬 변이', name: '태고의 유물: 사건의 지평선', desc: '적중 시 12% 확률로 블랙홀이 생겨 주변 적을 빨아들이며 계속 피해를 준다.', max: 1, mods: { blackhole: .12 } },
  l_storm: { grade: '전설', cat: '스킬 변이', name: '태고의 유물: 뇌신의 가호', desc: '적중 시 40% 확률로 연쇄 번개가 최대 5마리까지 튄다.', max: 1, mods: { chain: .4, chainN: 5 } }
};

const MUL = new Set(['atkMul', 'cdMul', 'hpMul', 'speedMul', 'dashCdMul', 'guard', 'swapCdMul', 'sizeMul', 'allMul', 'bandMul', 'specsMul', 'expMul', 'parryCdMul', 'parryWinMul', 'invMul']);
for (const pk of Object.values(PERKS)) if (pk.curse) pk.desc = `🔺 ${pk.up}  🔻 ${pk.down}`;   // 양날의 검: 한 줄 설명 (샌드박스 목록 · 보유 카드)
const MAXED = new Set(['chain', 'chainN']);   // 겹치지 않고 큰 쪽을 쓴다 (연쇄 번개 · 뇌신의 가호)

// 받은 특성 카드 → 수치 합계 (곱해지는 값은 곱하고, 나머지는 더한다)
export function perkMods(perks = {}) {
  const out = {};
  for (const [id, n] of Object.entries(perks)) {
    const pk = PERKS[id];
    if (!pk || !n) continue;
    for (const [k, v] of Object.entries(pk.mods)) {
      if (typeof v === 'boolean') out[k] = out[k] || v;
      else if (MAXED.has(k)) out[k] = Math.max(out[k] || 0, v);
      else if (MUL.has(k)) out[k] = (out[k] ?? 1) * (pk.step != null ? v + Math.sign(v - 1) * pk.step * (n - 1) : 1 + (v - 1) * (1 + .6 * (n - 1)));   // 중복 카드 합성: 강화 1단계마다 기본 효과의 60% 씩 더 (data/tm.js lvMul) · step 이 있으면 그만큼
      else out[k] = (out[k] || 0) + v * (1 + .6 * (n - 1));
    }
    for (const [k, v] of Object.entries(pk.cost || {})) {   // 양날의 검 대가: 합성해도 커지지 않고 ease 만큼씩 줄어든다 (-30% → -27% → -24% → -21%)
      const e = Math.max(0, 1 - (pk.ease || 0) * (n - 1));
      if (MUL.has(k)) out[k] = (out[k] ?? 1) * (1 + (v - 1) * e);
      else out[k] = (out[k] || 0) + v * e;
    }
  }
  return out;
}

// ---------------- 적중 갈고리 (Combat.damageEnemy 가 플레이어 공격이 맞을 때 부른다) ----------------
//  o.proc: 갈고리가 만든 2차 피해(연쇄 번개·장판·블랙홀)는 다시 갈고리를 부르지 않는다
export function onHit(combat, e, d, type, o) {
  const md = combat.p.mods, sc = combat.s, fx = combat.fx;
  if (o.proc || o.dot) return;
  const st = e.status, r = e.boss ? .3 : 1, atk = combat.p.atk;
  const roll = c => c > 0 && Math.random() < c;
  if (roll(md.pBurn)) { st.burn = Math.max(st.burn, 4); e.burnDps = atk * .28; fx.floatText(e.x, e.top - 10, '화상!', '#ffb070', 10); }
  if (roll(md.pPoison)) { st.poison = Math.max(st.poison, 5); e.poisonDps = atk * .3; fx.floatText(e.x, e.top - 10, '맹독!', '#c890ff', 10); }
  if (roll(md.pPara)) { st.slow = Math.max(st.slow, 3); fx.floatText(e.x, e.top - 10, '마비!', '#ffe36a', 10); fx.burst(e.x, e.y, [0xffe36a, 0xffffff], 6, 60, { glow: true, life: .3 }); }
  if (roll(md.pFreeze)) combat.applyStatus(e, { freeze: 1 });
  if (roll(md.pCurse)) { if (st.curse <= 0) fx.floatText(e.x, e.top - 10, '저주!', '#c890ff', 10); st.curse = Math.max(st.curse, 5); }
  if (roll(md.chain)) chainLightning(combat, e, md.chainN || 3);
  if (roll(md.flameZone)) groundZone(combat, e, 'fire', 0xff7a2a, 2, { burn: 3 });
  if (roll(md.toxicZone)) groundZone(combat, e, 'poison', 0xa04aff, 2.5, { poison: 4 });
  if (roll(md.blackhole) && !sc.blackholeOn) blackHole(combat, e.x, e.y);
  void r;
}

// 연쇄 번개: 맞은 적 → 가장 가까운 다른 적 → … (n마리)
function chainLightning(combat, from, n) {
  const sc = combat.s, hit = new Set([from]);
  let cur = from;
  for (let k = 0; k < n; k++) {
    const next = sc.enemies.filter(q => q.alive && !q.intangible && !hit.has(q) && Phaser.Math.Distance.Between(cur.x, cur.y, q.x, q.y) < 150)
      .sort((a, b) => Phaser.Math.Distance.Between(cur.x, cur.y, a.x, a.y) - Phaser.Math.Distance.Between(cur.x, cur.y, b.x, b.y))[0];
    if (!next) break;
    const a = cur, b = next;
    hit.add(b);
    sc.time.delayedCall(k * 70, () => {
      if (!b.alive) return;
      bolt(sc, a.x, a.y, b.x, b.y, 0xffe86a);
      combat.damageEnemy(b, combat.p.atk * .55, 'electric', { proc: true, hs: 20 });
    });
    cur = b;
  }
  if (hit.size > 1) Sfx.play('zap');
}

// 지그재그 번개 한 줄기 (흰 심 + 색 테두리)
export function bolt(sc, x1, y1, x2, y2, color, w = 2, ms = 220) {
  const g = sc.add.graphics().setDepth(42).setBlendMode(Phaser.BlendModes.ADD), pts = [{ x: x1, y: y1 }], seg = 7;
  for (let i = 1; i < seg; i++) { const k = i / seg; pts.push({ x: x1 + (x2 - x1) * k + (Math.random() - .5) * 12, y: y1 + (y2 - y1) * k + (Math.random() - .5) * 12 }); }
  pts.push({ x: x2, y: y2 });
  for (const [lw, c] of [[w + 3, color], [w, 0xffffff]]) { g.lineStyle(lw, c, lw > w ? .5 : 1); g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (const p of pts) g.lineTo(p.x, p.y); g.strokePath(); }
  sc.fx.glow(x2, y2, 14, color, ms, .9);
  sc.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
}

// 맞은 자리 바닥 장판 (화염 · 독)
function groundZone(combat, e, type, color, life, status) {
  const sc = combat.s, gy = sc.groundBelow(e.x, e.bottom - 4), w = 48;
  combat.spawnZone({
    owner: 'player', x: e.x - w / 2, y: gy - 14, w, h: 14, life, tick: .4, type, color, draw: 'seed',
    onTick: z => {
      combat.hitRect({ x: z.x, y: z.y, w: z.w, h: z.h }, .22, type, Object.assign({ proc: true, kbx: 0, kby: 0, hs: 0 }, status));
      sc.fx.burst(z.x + Math.random() * z.w, z.y + z.h - 2, [color, 0xffffff], 2, 30, { angle: -Math.PI / 2, spread: .5, up: 30, grav: -40, bounce: false, life: .5, glow: true });
    }
  });
}

// 블랙홀: 1.4초 동안 주변 적을 끌어당기며 0.2초마다 피해
function blackHole(combat, x, y) {
  const sc = combat.s, fx = combat.fx, R = 90;
  sc.blackholeOn = true;
  const core = sc.add.image(x, y, 'glow').setTint(0x1a0030).setScale(.2).setDepth(41);
  const rim = sc.add.image(x, y, 'glow').setTint(0x9a5aff).setBlendMode(Phaser.BlendModes.ADD).setScale(.3).setDepth(40).setAlpha(.8);
  sc.tweens.add({ targets: core, scale: 1, duration: 260, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: rim, scale: 1.8, duration: 260, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: rim, angle: 360, duration: 1400 });
  Sfx.play('ghost');
  let n = 0;
  const ev = sc.time.addEvent({
    delay: 100, repeat: 13, callback: () => {
      n++;
      for (const e of sc.enemies) {
        if (!e.alive || e.boss) continue;
        const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
        if (d < R && d > 6) e.b.setVelocity(dx / d * 160, dy / d * 160);
      }
      if (n % 2 === 0) combat.hitCircle(x, y, R * .55, .25, 'dark', { proc: true, kbx: 0, kby: 0, hs: 0 });
      for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2; fx.burst(x + Math.cos(a) * R * .8, y + Math.sin(a) * R * .8, [0x9a5aff, 0x2a0a3a], 1, 10, { grav: 0, bounce: false, life: .3, glow: true }); }
      if (n >= 14) {
        ev.remove(); sc.blackholeOn = false;
        combat.hitCircle(x, y, R * .7, 1.2, 'dark', { proc: true, kbx: 260, kby: -200, hs: 80 });
        fx.ring(x, y, R, 0xc08aff, 320); fx.shake(.01, 220, 'hit'); Sfx.play('boom');
        sc.tweens.add({ targets: [core, rim], scale: 0, alpha: 0, duration: 200, onComplete: () => { core.destroy(); rim.destroy(); } });
      }
    }
  });
}

// ---------------- 피격 갈고리 (Player.takeHit) ----------------
// 가시 갑옷: 맞으면 주변 적에게 되돌려 준다
export function onHurt(p) {
  const md = p.mods, sc = p.scene;
  if (md.thorns) {
    sc.combat.hitCircle(p.x, p.y, 50, md.thorns, p.types[0], { proc: true, kbx: 220, kby: -160, hs: 40 });
    sc.fx.ring(p.x, p.y, 46, 0xd8c8a0, 240);
  }
}

// ---------------- 대시 중 갈고리 (Player.update 대시 진행 중) ----------------
//  아쿠아 제트: 0.06초마다 몸 앞 판정으로 밀쳐 내며 다단히트 · 서리 질주: 스친 적 빙결·둔화 · 그림자 질주: 스친 적 저주
export function onDashTick(p, d, dt) {
  const md = p.mods, sc = p.scene;
  if (!md.dashAqua && !md.dashFrost && !md.dashShadow) return;
  const box = { x: p.b.x - 8, y: p.b.y - 6, w: p.b.width + 16, h: p.b.height + 12 };
  if (md.dashAqua) {
    d.tick -= dt;
    if (d.tick <= 0) { d.tick = .06; sc.combat.hitRect(box, .3, 'water', { proc: true, kbx: 260 * (d.dir || 1), kby: -60, hs: 0, fromX: p.x - d.dir * 30 }); }
    sc.fx.burst(p.x - d.dir * 8, p.y + (Math.random() - .5) * 10, [0x5ac8ff, 0xffffff], 2, 60, { angle: d.dir > 0 ? Math.PI : 0, spread: .6, grav: 200, life: .3, glow: true });
  }
  if (md.dashFrost || md.dashShadow) {
    for (const e of sc.combat.enemiesIn(box)) {
      if (d.hitSet.has(e)) continue;
      d.hitSet.add(e);
      sc.combat.damageEnemy(e, p.atk * .4, md.dashFrost ? 'ice' : 'ghost', Object.assign({ proc: true, kb: 0, kby: 0, hs: 0 }, md.dashFrost ? { freeze: .6, slow: 2.5 } : {}, md.dashShadow ? { curse: 5 } : {}));
    }
    if (md.dashFrost && Math.random() < .7) sc.fx.burst(p.x, p.y + (Math.random() - .5) * 12, [0xbff0ff, 0xffffff], 1, 30, { grav: 0, bounce: false, glow: true, life: .5, size: 2 });
    if (md.dashShadow && Math.random() < .7) sc.fx.burst(p.x, p.y, [0x6a2aff, 0x2a0a3a], 1, 20, { grav: -20, bounce: false, glow: true, life: .45 });
  }
}

// 썬더 스텝 낙뢰 한 줄기
function thunderAt(p, x) {
  const sc = p.scene, gy = sc.groundBelow(x, p.y - 20), top = sc.cameras.main.worldView.y - 10;
  sc.combat.hitRect({ x: x - 14, y: top, w: 28, h: gy - top }, .9, 'electric', { proc: true, paralyze: .6, kbx: 60, kby: -220, hs: 30, fromX: x });
  bolt(sc, x + (Math.random() - .5) * 24, top, x, gy, 0xffe86a, 3, 260);
  sc.fx.burst(x, gy - 2, [0xffe86a, 0xffffff], 14, 150, { up: 130, glow: true }); sc.fx.ring(x, gy - 4, 26, 0xffe86a, 260);
  sc.fx.shake(.006, 90, 'hit'); Sfx.play('zap');
}

// 환영 분신: 대시한 자리에 반투명 분신 → 1.2초 동안 주변 적을 끌어당기고 폭발
function decoyAt(p, x, y) {
  const sc = p.scene, sp = p.sprite;
  const img = sc.add.image(x, y + sp.displayHeight * (sp.originY - .5), sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setFlipX(sp.flipX).setScale(sp.scaleX, sp.scaleY)
    .setTintFill(0xc8a0ff).setAlpha(.6).setDepth(21);
  img.y = p.bottom;
  sc.tweens.add({ targets: img, alpha: { from: .35, to: .7 }, duration: 200, yoyo: true, repeat: 2 });
  let n = 0;
  const ev = sc.time.addEvent({ delay: 100, repeat: 11, callback: () => {
    n++;
    for (const e of sc.enemies) { if (!e.alive || e.boss) continue; const dx = x - e.x, d = Math.abs(dx); if (d < 150 && d > 10 && Math.abs(e.y - y) < 80) e.b.setVelocityX(Math.sign(dx) * 140); }
    if (n >= 12) {
      ev.remove();
      if (sc.combat) sc.combat.hitCircle(x, y, 54, 1.4, p.types[0], { proc: true, kbx: 260, kby: -220, hs: 50 });
      sc.fx.ring(x, y, 54, 0xc8a0ff, 320); sc.fx.burst(x, y, [0xc8a0ff, 0xffffff], 26, 220, { glow: true, up: 80 });
      sc.fx.shake(.01, 180, 'hit'); Sfx.play('boom');
      img.destroy();
    }
  } });
}

// ---------------- 처치 갈고리 (GameScene.killEnemy) ----------------
export function onKill(p) {
  const md = p.mods;
  if (md.killHeal && p.m.alive) p.heal(p.m.maxhp * md.killHeal, true);
}

// ---------------- 대시 갈고리 (Player.update 대시 시작) ----------------
export function onDash(p, d) {
  const md = p.mods, sc = p.scene, x0 = p.x, y0 = p.y;
  d.hitSet = new Set(); d.tick = 0;
  if (md.dashGale) { p.galeT = 2; p.galeHit = true; sc.fx.burst(x0, p.bottom - 2, [0xd8fff0, 0x8affd8], 8, 90, { angle: d.dir > 0 ? Math.PI : 0, spread: .5, up: 20, grav: 0, bounce: false, glow: true, life: .35 }); }   // 질풍의 추진력
  if (md.dashSpark) {   // 스파크 대시: 지나간 길에 속성 정전기 흔적 → 스친 적에게 평타 80% · 짧은 경직 (적마다 한 번)
    const hit = new Set(), type = p.types[0], col = typeColor(type);
    sc.time.delayedCall(190, () => {
      if (!p.scene || !sc.combat) return;
      const x1 = p.x, L = Math.min(x0, x1) - 8, W = Math.abs(x1 - x0) + 16;
      sc.combat.hitRect({ x: L, y: y0 - 16, w: W, h: 32 }, .8 * md.dashSpark, type, { proc: true, set: hit, stun: .35, kbx: 60, kby: -60, hs: 25 });
      for (let k = 0; k < 2; k++) bolt(sc, x0, y0 + (k ? 6 : -6), x1, y0 + (k ? -4 : 4), col, 1.5, 320);
      for (let x = L; x < L + W; x += 10) sc.fx.burst(x, y0 + (Math.random() - .5) * 14, [col, 0xffffff], 1, 40, { up: 10, grav: 0, bounce: false, glow: true, life: .5, size: 1 });
      Sfx.play('zap');
    });
  }
  if (md.dashThunder) { thunderAt(p, x0); sc.time.delayedCall(210, () => { if (p.scene) thunderAt(p, p.x); }); }
  if (md.dashFlame || md.dashNova || md.dashDecoy) sc.time.delayedCall(200, () => {
    if (!p.scene || !sc.combat) return;
    const x1 = p.x, L = Math.min(x0, x1), W = Math.abs(x1 - x0) + 16, gy = sc.groundBelow((x0 + x1) / 2, y0);
    if (md.dashFlame) sc.combat.spawnZone({ owner: 'player', x: L - 8, y: gy - 16, w: W, h: 16, life: 2, tick: .3, type: 'fire', color: 0xff7a2a, draw: 'fire',
      onTick: z => sc.combat.hitRect({ x: z.x, y: z.y - 4, w: z.w, h: z.h + 4 }, .22, 'fire', { proc: true, burn: 3, kbx: 0, kby: 0, hs: 0 }) });
    if (md.dashNova) { sc.combat.hitCircle(x1, p.y, 46, 1, p.types[0], { proc: true, kbx: 200, kby: -160, hs: 30 }); sc.fx.ring(x1, p.y, 46, 0xffffff, 300); sc.fx.ring(x1, p.y, 30, 0xffe08a, 260); Sfx.play('boom'); }
    if (md.dashDecoy) decoyAt(p, x0, y0);
  });
  if (md.dashBomb) {
    const bomb = sc.add.image(x0, y0 + 4, 'glow').setTint(0xff7a2a).setBlendMode(Phaser.BlendModes.ADD).setScale(.35).setDepth(30);
    sc.tweens.add({ targets: bomb, scale: .55, duration: 110, yoyo: true, repeat: 1 });
    sc.time.delayedCall(450, () => {
      bomb.destroy();
      if (!sc.combat) return;
      sc.combat.hitCircle(x0, y0, 40, 1.1, 'fire', { proc: true, kbx: 220, kby: -200, hs: 40 });
      sc.fx.ring(x0, y0, 40, 0xff9a4a, 260); sc.fx.glow(x0, y0, 34, 0xff7a2a, 240, .9);
      sc.fx.burst(x0, y0, [0xff7a2a, 0xffd04a, 0xffffff], 18, 140, { up: 80, glow: true });
      Sfx.play('boom');
    });
  }
  if (md.dashClone) {
    const hit = new Set();
    sc.time.delayedCall(200, () => {
      const x1 = p.x, L = Math.min(x0, x1) - 8, W = Math.abs(x1 - x0) + 16;
      sc.combat.hitRect({ x: L, y: y0 - 16, w: W, h: 32 }, .9, p.types[0], { proc: true, set: hit, kbx: 120, kby: -80, hs: 30 });
      for (let k = 0; k < 3; k++) sc.fx.ghost(p.sprite, 0xc8a0ff, .7 - k * .2, 300 + k * 80);
      sc.fx.slash((x0 + x1) / 2, y0, Math.max(14, W / 2), d.dir, 0xc8a0ff, { thick: 3 });
    });
  }
}

// ---------------- 패링 성공 갈고리 (Player.doParry) ----------------
//  철벽의 호흡: 체력 회복 · 충격파 카운터: 둘레 120px 충격파 + 보스 그로기 · 반격의 일격: 2초 동안 즉발 차징 · 다음 기술 피해 +40%
export function onParry(p, x, y, kind, ch) {
  const md = p.mods, sc = p.scene, m = p.m;
  if (md.parryHeal && m.alive && m.hp < m.maxhp) {
    p.heal(m.maxhp * md.parryHeal, true);
    sc.fx.floatText(p.x, p.b.y - 34, `+${Math.round(m.maxhp * md.parryHeal)}`, '#7dff9a', 10);
    sc.fx.burst(p.x, p.y, [0x7dff9a, 0xffffff], 8, 60, { grav: -40, bounce: false, glow: true, life: .4 });
  }
  if (md.parryWave && sc.combat) {
    const R = 120;
    sc.combat.hitCircle(p.x, p.y, R, .6 * md.parryWave * Math.max(.4, ch.dmg), p.types[0], { proc: true, kbx: 380, kby: -220, hs: 20 });
    sc.fx.ring(p.x, p.y, R, 0xffe36a, 360); sc.fx.ring(p.x, p.y, R * .6, 0xffffff, 260); sc.fx.shake(.008, 160, 'hit');
    const boss = sc.enemies.find(e => e.alive && e.boss && Math.hypot(e.x - p.x, e.y - p.y) < R + 60);
    if (boss && boss.addStaggerRaw && ch.stag > 0) boss.addStaggerRaw(14 * md.parryWave * ch.stag);
  }
  if (md.parryCounter) {
    p.counterT = sc.time.now + 2000;
    sc.fx.floatText(p.x, p.b.y - 44, '반격 준비! (2초)', '#ffe36a', 9);
  }
}
