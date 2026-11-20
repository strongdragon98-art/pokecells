// 💠 2회차(New Game+) 보스 정수 — 진 엔딩(전당등록)을 본 포켓몬을 파티에 넣고 새 여정을 시작하면, 지금까지 정화한 지방 최종 보스의 정수 중 딱 하나를 쥐고 출발한다
//  (systems/EssencePicker.js — 로비 [던전 입장] → 난이도 → 정수 선택)
//  파티 공용 유물이라 장착 칸을 차지하지 않는다 · 효과는 Player.refreshMods 가 장착 보정값(mods)에 더한다 (essenceMods)
//  강화 단계 (Save.data.essence[id] · 영구): 처음 가져가면 +0 — 미완성 파편이라 수치가 30% (예: 기술 재사용 -20% → -6%)
//   2회차 이상의 여정에서 지방 최종 보스를 정화할 때마다 보스의 혼을 흡수해 +1 (최대 +3)
//   +1 수치 100% 복구 · +2 그 보스 코어의 고유 효과 해금 (초월 Ⅰ — 장착 칸 없이) · +3 수치 130% + 다회차 전용 초월 Ⅱ
import { BOSS_CORES } from './cores.js';
import { typeName } from './types.js';
import { SIZE_CAP } from './items.js';

export const ESSENCE_MAX = 3;
export const ESSENCE_K = [.3, 1, 1, 1.3];   // 강화 단계별 수치 배율 (+0 파편 30% · +3 한계 돌파 130%)
const STAT_NAME = { cdCut: '기술 재사용', atk: '공격력', speed: '이동 속도', guardCut: '받는 피해', crit: '급소율', hp: '최대 체력' };

//  boss: 정화하면 이 정수를 고를 수 있게 되는 지방 최종 보스 · core: 초월 Ⅰ 로 해금하는 보스 코어 (data/cores.js)
//  stats: 강화 단계에 따라 곱하는 수치 · over: 초월 Ⅱ (+3 · 다회차 전용 — 원래 코어에는 없는 한계 돌파)
export const ESSENCES = {
  mewtwo: { id: 'mewtwo', boss: 'mewtwo', name: '뮤츠의 사이코 정수', icon: '🔮', color: 0xb05aff, core: 'mewtwo',
    stats: { cdCut: .2, type: { psychic: .2 } }, over: { sizeAdd: .15, text: '사이코 중력장 · 에스퍼 탄 범위 +15%' } },
  'ho-oh': { id: 'ho-oh', boss: 'ho-oh', name: '칠색조의 무지개 정수', icon: '🌈', color: 0xff6a2a, core: 'ho-oh',
    stats: { atk: .12, type: { fire: .2, flying: .2 } }, over: { regen: .004, text: '불사조의 숨결 — 매초 최대 체력 0.4% 회복' } },
  rayquaza: { id: 'rayquaza', boss: 'rayquaza', name: '레쿠쟈의 델타 정수', icon: '🌪️', color: 0x4aff8a, core: 'rayquaza',
    stats: { speed: .12, type: { dragon: .2, flying: .2 } }, over: { jumps: 1, text: '하늘을 가르는 날개 — 공중 점프 +1' } },
  giratina: { id: 'giratina', boss: 'giratina', name: '기라티나의 반물질 정수', icon: '🌌', color: 0xff3a5a, core: 'giratina',
    stats: { guardCut: .15, type: { ghost: .2, dragon: .2 } }, over: { dashInv: .08, text: '깨어진 세계의 그림자 — 대시 무적 +0.08초' } },
  reshiram: { id: 'reshiram', boss: 'reshiram', name: '진실과 이상의 정수', icon: '☯️', color: 0x8ab8ff, core: 'truth_ideal',
    stats: { atk: .1, type: { electric: .15, fire: .15, dragon: .15 } }, over: { crit: .1, text: '영웅의 일섬 — 급소율 +10%' } },
  arceus: { id: 'arceus', boss: 'arceus', name: '아르세우스의 창조 정수', icon: '🌟', color: 0xfff0b0, core: 'arceus',
    stats: { atk: .08, guardCut: .08, cdCut: .08 }, over: { hp: .1, text: '창조의 축복 — 최대 체력 +10%' } },
  eternatus: { id: 'eternatus', boss: 'eternatus', name: '무한다이노의 무한 정수', icon: '☄️', color: 0xff2a5a, core: 'eternatus',
    stats: { atk: .08, type: { dragon: .2, poison: .2 } }, over: { sizeAdd: .15, text: '무한의 포격 — 다이맥스포 · 탄 범위 +15%' } }
};
export const ESSENCE_ORDER = ['mewtwo', 'ho-oh', 'rayquaza', 'giratina', 'reshiram', 'arceus', 'eternatus'];
// 지방 최종 보스 → 정수 id (하나의 영웅전은 마지막 레시라무)
export const ESSENCE_OF_BOSS = Object.fromEntries(Object.values(ESSENCES).map(e => [e.boss, e.id]));

const pct = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
// 이 단계의 효과 줄 [글, 종류('stat' · 'core' · 'over')]
export function essenceLines(id, lv) {
  const E = ESSENCES[id], k = ESSENCE_K[Math.max(0, Math.min(ESSENCE_MAX, lv))], out = [];
  if (!E) return out;
  const st = E.stats;
  for (const key of ['cdCut', 'atk', 'speed', 'guardCut']) if (st[key]) out.push([`${STAT_NAME[key]} ${key === 'cdCut' || key === 'guardCut' ? '-' : '+'}${+(st[key] * k * 100).toFixed(1)}%`, 'stat']);
  for (const [t, v] of Object.entries(st.type || {})) out.push([`${typeName(t)} 속성 피해 ${pct(v * k).replace(/\.\d+/, '')}`, 'stat']);
  const core = BOSS_CORES[E.core];
  if (lv >= 2 && core) out.push([`초월 Ⅰ · ${core.name.replace(/코어$/, '코어 효과')}`, 'core']);
  if (lv >= 3) out.push([`초월 Ⅱ · ${E.over.text}`, 'over']);
  return out;
}
// 다음 단계에서 열리는 것 (선택 창 · 강화 배너)
export function essenceNext(id, lv) {
  const E = ESSENCES[id];
  if (!E || lv >= ESSENCE_MAX) return '';
  if (lv === 0) return '+1 · 수치 100% 복구';
  if (lv === 1) return `+2 · 초월 Ⅰ 「${(BOSS_CORES[E.core] || {}).name || '보스 코어'}」 효과 해금`;
  return `+3 · 수치 130% + 초월 Ⅱ 「${E.over.text}」`;
}

// 장착 보정값(data/items.js computeMods 결과)에 정수를 더한다 — ess: { id, lv } (Player.essence)
export function essenceMods(mods, ess) {
  const E = ess && ESSENCES[ess.id];
  if (!E) return mods;
  const lv = Math.max(0, Math.min(ESSENCE_MAX, ess.lv || 0)), k = ESSENCE_K[lv], st = E.stats;
  if (st.cdCut) mods.cdMul *= 1 - st.cdCut * k;
  if (st.atk) mods.atkMul *= 1 + st.atk * k;
  if (st.speed) mods.speedMul *= 1 + st.speed * k;
  if (st.guardCut) mods.guard *= 1 - st.guardCut * k;
  mods.typeBoost = Object.assign({}, mods.typeBoost);
  for (const [t, v] of Object.entries(st.type || {})) mods.typeBoost[t] = (mods.typeBoost[t] || 0) + v * k;
  if (lv >= 2) {   // 초월 Ⅰ: 그 보스 코어의 고유 효과 (장착 칸 없이) · 투사체 +1
    const core = BOSS_CORES[E.core];
    if (core) {
      mods.core = Object.assign({}, mods.core); mods.coreProj = Object.assign({}, mods.coreProj);
      for (const f of [core.flag, ...(core.flags || [])]) if (f) mods.core[f] = true;
      for (const t of core.proj || []) mods.coreProj[t] = (mods.coreProj[t] || 0) + 1;
      if (mods.core.psy) mods.psyCore = true;
    }
  }
  if (lv >= 3) {   // 초월 Ⅱ: 다회차 전용 한계 돌파
    const o = E.over;
    if (o.sizeAdd) mods.sizeMul = Math.min(SIZE_CAP, (mods.sizeMul || 1) + o.sizeAdd);
    if (o.regen) mods.regen = (mods.regen || 0) + o.regen;
    if (o.jumps) mods.extraJumps = (mods.extraJumps || 0) + o.jumps;
    if (o.dashInv) mods.dashInvAdd = (mods.dashInvAdd || 0) + o.dashInv;
    if (o.crit) mods.crit = (mods.crit || 0) + o.crit;
    if (o.hp) mods.hpMul *= 1 + o.hp;
  }
  mods.essence = { id: E.id, lv };
  return mods;
}
