// =====================================================================
//  📊 챕터별 고정 스펙 체크 (Static Gear-Check) 밸런스
// =====================================================================
//  보스 · 엘리트는 플레이어가 지닌 카드와 상관없이 지방마다 정해 둔 고정 배율로 나온다
//   (예전: 카드 1스택마다 체력 +6% · 공격 +3% 동적 스케일링 — 삭제. 카드를 모은 만큼 보스도 강해져 파밍한 보람이 없었다)
//   → 카드를 모으고 강화한 만큼 그대로 플레이어의 딜 · 클리어 타임으로 돌아온다. 파밍을 건너뛰면 보스가 그만큼 단단하고 아프다
//
//  기대 카드 점수(score): 그 지방을 정석대로 돌았을 때 지방 최종 보스 앞에서 가졌을 카드 점수 (cardScore = 보유 카드 수 + 강화 단계 합 · 파티 전체)
//   카드 1장을 얻으면 +1, 같은 카드를 합성하거나 지방 탐색 숙련도로 강화하면 +1 — 즉 「받은 카드 · 강화 횟수」의 합과 같다
//   지방마다 실제로 놓인 카드 공급원 (맵 생성 측정 · 시드 6개 중앙값):
//     필드(기술머신 제단 + 길목 캡슐 + 엘리트 TM 코어)  관동 15 · 성도 11 · 호연 11 · 신오 11 · 하나 10 · 가라르 8~9
//     보스 TM 코어(중간 · 최종 · 히든)                    관동 5 · 성도 5 · 호연 4 · 신오 5 · 하나 4 · 가라르 2
//   정석 탐험 = 필드 공급원의 70% + 지나온 보스 코어 모두 + 히든 보스 절반 + 지방 탐색 숙련도 강화 2번
//   start: 그 지방에 들어설 때 (앞 지방을 모두 마친 기대치) · score: 그 지방 최종 보스 앞 · 중간 보스는 그 사이 가운데
//
//  배율 (그 보스 · 엘리트의 원래 체력 · 공격력에 곱한다 · 보스는 데이터의 체력 · 공격력, 엘리트는 지방 · 침식 배율까지 곱한 뒤):
//   hp · atk: 체력 · 공격력 · shot: 보스 탄속 (패턴 탄속 상향) · hpBoss: 특정 보스만 다른 체력 배율 (시초의 방 아르세우스)
//   max3: 그 시점 기대 빌드의 ★초월(+3강) 카드 수 · grade: 테스트룸 자동 장착에 쓰는 스킬 강화 카드 등급 · bond: 그 시점 유대의 불꽃 단계
import { BOSSES, SKILLS } from './pokemon.js';
import { STAGES } from './stages.js';
import { bossHome } from '../game/TestRoom.js';
import { PERKS } from '../game/Perks.js';
import { applyCard, boostCard, BOOSTS, CARD_MAX_LV, cardScore } from './tm.js';

export const CHAPTER_SPEC = [
  { hp: 1.25, atk: 1.2,  shot: 1,    start: 0,  score: 15, max3: 0, grade: '커먼', bond: 0 },   // 1 관동 — 맨몸이면 평타가 간지럽게
  { hp: 1.7,  atk: 1.45, shot: 1.1,  start: 17, score: 30, max3: 0, grade: '레어', bond: 1 },   // 2 성도 — 패턴 탄속 상향
  { hp: 2.4,  atk: 1.8,  shot: 1.12, start: 31, score: 43, max3: 0, grade: '레어', bond: 2 },   // 3 호연 — 파밍을 건너뛰면 통곡의 벽
  { hp: 3.4,  atk: 2.25, shot: 1.15, start: 44, score: 55, max3: 2, grade: '유니크', bond: 3 },   // 4 신오 — ★초월 2장 · 유물 시너지
  { hp: 4.6,  atk: 2.8,  shot: 1.18, start: 58, score: 69, max3: 4, grade: '유니크', bond: 5, hpBoss: { arceus: 5.5 } },   // 5 하나 · 시초의 방 — ★초월 4장 · 양날의 검
  { hp: 6.5,  atk: 3.4,  shot: 1.2,  start: 71, score: 78, max3: 8, grade: '전설', bond: 6 }   // 6 가라르 최종장 — 주력 카드 풀강 · 유대의 불꽃 Lv.6
];
export const WARN_RATIO = .75;   // 권장 점수의 75% 미만이면 🔴 전력 부족 경고
export const GEAR_WARN = '⚠️ [전력 부족 경고] 현재 보유/강화한 기술머신(TM) 카드가 이 구역 보스의 권장 수준보다 부족합니다! (탐색 및 파밍 권장)';

export const specOf = ci => CHAPTER_SPEC[Math.max(0, Math.min(CHAPTER_SPEC.length - 1, ci | 0))];
export const bossCh = key => bossHome(key).ci;   // 그 보스가 사는 지방 (짝 · 이어 싸우는 보스 · 레드의 포켓몬은 같은 아레나의 지방)
// 그 보스의 고정 배율 { ci, hp, atk, shot }
export function bossSpec(key) {
  const ci = bossCh(key), s = specOf(ci);
  return { ci, hp: (s.hpBoss && s.hpBoss[key]) || s.hp, atk: s.atk, shot: s.shot };
}
// 그 보스의 권장 카드 점수: 중간 보스는 지방 입구와 최종 보스 기대치의 가운데 · 최종 · 히든 보스는 지방 최종 기대치
export function recommendedCardScore(key) {
  const s = specOf(bossCh(key)), d = BOSSES[key];
  return d && d.tier === 'mini' ? Math.round((s.start + s.score) / 2) : s.score;
}
// 전력 부족: { score, rec } (권장의 75% 미만일 때만) · 넉넉하면 null
export function gearCheck(player, key) {
  const score = cardScore(player), rec = recommendedCardScore(key);
  return score < rec * WARN_RATIO ? { score, rec } : null;
}

// ---------------- 🧪 테스트룸 ⚡ 권장 카드 스펙 자동 장착 (Auto-Preset) ----------------
//  그 지방 기대 카드 점수(score)에 맞춘 빌드를 1초 만에: 출전 중인 포켓몬이 주력(60%), 나머지 동료가 남은 점수를 나눠 갖는다
//  카드 수 : 강화 단계 ≈ 55 : 45 · ★초월(+3강)은 max3 장 (주력) — 앞쪽 카드부터 · 기술 카드(기술 교체)는 쓰지 않는다 (지금 기술 그대로 점검)
//  목록: [종류, 카드 (스킬 강화는 '종류:자리'), 이 지방부터]
const MAIN_BUILD = [
  ['boost', 'power:z', 0], ['boost', 'power:x', 0], ['perk', 'r_amplify', 0], ['perk', 'c_power', 0], ['boost', 'power:c', 0],
  ['perk', 'c_reflex', 0], ['perk', 'c_lightstep', 0], ['perk', 'c_crit', 0],
  ['perk', 'u_rapid', 1], ['perk', 'r_spark', 1], ['perk', 'r_counter', 1], ['boost', 'haste:z', 1],
  ['perk', 'u_charge', 2], ['perk', 'r_crit', 2], ['boost', 'haste:x', 2], ['perk', 'c_focus', 2],   // 호연: 2단 차징
  ['perk', 'l_band', 3], ['perk', 'u_shock', 3], ['boost', 'wide:x', 3], ['perk', 'c_vigor', 3], ['perk', 'c_afterimage', 3],   // 신오: 유물 시너지
  ['perk', 'r_glass', 4], ['perk', 'u_overload', 4], ['perk', 'l_specs', 4], ['boost', 'haste:c', 4], ['perk', 'c_breath', 4],   // 하나: 양날의 검(극대화)
  ['perk', 'l_orb', 5], ['perk', 'u_razor', 5], ['boost', 'wide:z', 5], ['perk', 'r_reload', 5], ['perk', 'c_steady', 5], ['perk', 'r_wave', 5]
];
const SUB_BUILD = [
  ['boost', 'power:z', 0], ['perk', 'c_power', 0], ['boost', 'power:x', 0], ['perk', 'c_reflex', 0], ['perk', 'c_crit', 0],
  ['boost', 'power:c', 1], ['perk', 'r_amplify', 1], ['perk', 'c_vigor', 1], ['perk', 'c_lightstep', 2], ['perk', 'c_focus', 2],
  ['boost', 'haste:z', 2], ['perk', 'u_rapid', 3], ['perk', 'r_crit', 3], ['perk', 'r_spark', 3], ['boost', 'haste:x', 4],
  ['perk', 'c_guard', 4], ['perk', 'r_counter', 4], ['perk', 'c_afterimage', 5], ['boost', 'wide:x', 5], ['perk', 'c_breath', 5]
];
// 목록 한 줄 → { card, slot, maxLv } (그 포켓몬이 못 받는 카드면 null)
function resolve(m, [kind, ref], grade) {
  if (kind === 'boost') {
    const [bk, slot] = ref.split(':'), sid = m.skills[slot], sk = SKILLS[sid], B = BOOSTS[bk];
    if (!sk || !B || (B.cdOnly && !sk.cd)) return null;
    return { card: boostCard({ bk, skill: sid, owner: m.key, grade, amt: B.amt[grade] }, slot), slot, maxLv: CARD_MAX_LV };
  }
  const pk = PERKS[ref];
  if (!pk) return null;
  return { card: { kind: 'perk', id: ref, name: pk.name, grade: pk.grade, max: pk.max }, slot: 'x', maxLv: Math.min(CARD_MAX_LV, (pk.max || 1) - 1) };
}
// 한 포켓몬의 계획: share 점수에 맞춰 [{ card, slot, maxLv, lv }]
function planFor(m, list, ci, share, m3, grade) {
  const items = list.filter(r => r[2] <= ci).map(r => resolve(m, r, grade)).filter(Boolean);
  if (share <= 0 || !items.length) return [];
  const lvTarget = Math.max(Math.round(share * .45), Math.min(share - 1, m3 * CARD_MAX_LV + Math.round(share * .1)));
  const pick = items.slice(0, Math.max(1, Math.min(items.length, share - lvTarget))).map(it => ({ ...it, lv: 0 }));
  let score = pick.length;
  for (const it of pick) {   // ① ★초월: 앞쪽에서 +3 이 되는 카드부터 m3 장
    if (m3 <= 0 || score >= share) break;
    if (it.maxLv >= CARD_MAX_LV) { const add = Math.min(CARD_MAX_LV, share - score); it.lv = add; score += add; m3--; }
  }
  for (let guard = 0; score < share && guard < 200; guard++) {   // ② 남은 점수: 앞 카드부터 한 단계씩 돌아가며 (모두 다 올렸으면 다음 카드를 더한다)
    let up = false;
    for (const it of pick) { if (score >= share) break; if (it.lv < it.maxLv) { it.lv++; score++; up = true; } }
    if (!up) { const nx = items[pick.length]; if (!nx) break; pick.push({ ...nx, lv: 0 }); score++; }
  }
  return pick;
}
// 파티에 장착 (지금 카드는 먼저 모두 지운 뒤 — GameScene.testResetCards) → { ci, score, rec, max3, cards }
//  total: 맞출 카드 점수 (없으면 그 지방 최종 기대치 · 중간 보스면 그 보스 권장 점수)
export function applyGearPreset(player, ci, total) {
  const s = specOf(ci), ms = player.members, main = player.m, subs = ms.filter(m => m !== main), goal = total || s.score;
  const mainShare = subs.length ? Math.round(goal * .6) : goal;
  const plans = [[main, planFor(main, MAIN_BUILD, ci, mainShare, s.max3, s.grade)]];
  subs.forEach((m, i) => {
    const left = goal - mainShare, share = Math.floor(left / subs.length) + (i < left % subs.length ? 1 : 0);
    plans.push([m, planFor(m, SUB_BUILD, ci, share, Math.floor(s.max3 / 4), s.grade)]);
  });
  let cards = 0, max3 = 0;
  for (const [m, plan] of plans) {
    for (const it of plan) {
      for (let k = 0; k <= it.lv; k++) applyCard(player, m, it.card, it.slot);   // 실전과 같은 합성 경로 (명함 → +1 → +2 승급 → +3 ★초월)
      cards++; if (it.lv >= CARD_MAX_LV) max3++;
    }
    player.refreshMods(m);
  }
  return { ci, score: cardScore(player), rec: goal, max3, cards, name: STAGES[ci].short };
}
