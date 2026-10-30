import { perkMods } from '../game/Perks.js';

// 런(한 판) 동안 유지되는 강화 아이템. 같은 아이템은 중첩된다.
// icon: 그림을 못 받았을 때 쓰는 도트 아이콘(Textures.js) · art: 가방·HUD·땅에 떨어진 아이템에 보이는 본가(소드실드·스칼렛바이올렛) 가방 아이콘 이름
//  (npm run fetch-items 가 public/assets/items/<id>.png 로 받는다). 게임 오리지널인 기술강화 코어는 뜻이 가까운 본가 도구 그림을 쓴다:
//  확산 → 속임수주사위(연속기 횟수↑) · 가속 → 파워풀허브(모으기 없이 바로) · 거대화 → 광각렌즈(넓게)
export const ITEMS = {
  charcoal: { name: '목탄', desc: '불꽃 기술 피해 +30%', boostType: 'fire', icon: 'charcoal', art: 'charcoal' },
  mystic_water: { name: '신비의물방울', desc: '물 기술 피해 +30%', boostType: 'water', icon: 'drop', art: 'mysticwater' },
  miracle_seed: { name: '기적의씨', desc: '풀 기술 피해 +30%', boostType: 'grass', icon: 'seed', art: 'miracleseed' },
  magnet: { name: '자석', desc: '전기 기술 피해 +30%', boostType: 'electric', icon: 'magnet', art: 'magnet' },
  spell_tag: { name: '저주부적', desc: '고스트 기술 피해 +30%', boostType: 'ghost', icon: 'tag', art: 'spelltag' },
  black_belt: { name: '검은띠', desc: '격투 기술 피해 +30%', boostType: 'fighting', icon: 'belt', art: 'blackbelt' },
  silk_scarf: { name: '실크스카프', desc: '노말 기술 피해 +30%', boostType: 'normal', icon: 'scarf', art: 'silkscarf' },
  poison_barb: { name: '독바늘', desc: '독·비행 기술 피해 +30%', boostType: 'poison', boostType2: 'flying', icon: 'barb', art: 'poisonbarb' },
  life_orb: { name: '생명의구슬', desc: '모든 피해 +30%. 기술(X·C) 사용 시 HP 3% 소모', icon: 'orb', art: 'lifeorb' },
  core_multi: { name: '기술강화 코어·확산', desc: '투사체 +1개', icon: 'core1', art: 'loadeddice' },
  core_haste: { name: '기술강화 코어·가속', desc: '스킬 쿨타임 -20%', icon: 'core2', art: 'powerherb' },
  core_giant: { name: '기술강화 코어·거대화', desc: '공격 판정·궤적 크기 +30%', icon: 'core3', art: 'widelens' },
  leftovers: { name: '먹다남은음식', desc: '출전 중인 포켓몬 매초 HP 0.6% 회복', icon: 'food', art: 'leftovers' },
  shell_bell: { name: '조개껍질방울', desc: '준 피해의 6%만큼 회복', icon: 'bell', art: 'shellbell' },
  razor_claw: { name: '예리한손톱', desc: '급소율 +15%', icon: 'claw', art: 'razorclaw' },
  scope_lens: { name: '피트렌즈', desc: '급소율 +12% · 급소 피해 +20%', icon: 'claw', art: 'scopelens' },   // 그림은 systems/Textures.js 의 도트 (엘리트 드랍)
  quick_claw: { name: '선제공격손톱', desc: '교대 쿨타임 -40%', icon: 'claw2', art: 'quickclaw' }
};

export const ITEM_KEYS = Object.keys(ITEMS);
export const MAX_EQUIP = 5;   // 포켓몬 한 마리가 장착할 수 있는 아이템 수 (같은 아이템 2개도 2칸)

// 바로 쓰는 소모품 (장착하지 않는다). 상처약: 샛길 끝에서 줍는 회복약 — 출전 중인 포켓몬 체력 40% 회복
export const CONSUMABLES = {
  potion: { name: '상처약', art: 'potion', heal: .4, desc: '출전 중인 포켓몬 체력 40% 회복' }
};

// 강화 아이템이 나올 확률: 효과가 커서 평소엔 드물다
//  보스는 반드시 · 마을(포켓몬센터 옆) 자판기는 가끔(아니면 오렌열매) · 상자는 아주 가끔(아니면 오렌열매) · 야생 포켓몬은 안 떨어뜨림
export const ITEM_DROP = { boss: 1, vending: .4, treasure: .2, chest: .08, wild: 0 };

// 보유 아이템 + 기술머신 특성 카드(game/Perks.js) → 계산된 보정치
//  특성 카드의 다른 값(pBurn·chain·dashBomb·sturdy …)은 그대로 실려 간다
export function computeMods(items, perks) {
  const n = k => items[k] || 0, pm = perkMods(perks);
  const typeBoost = {};
  for (const k of ITEM_KEYS) {
    const it = ITEMS[k];
    if (it.boostType) typeBoost[it.boostType] = (typeBoost[it.boostType] || 0) + .3 * n(k);
    if (it.boostType2) typeBoost[it.boostType2] = (typeBoost[it.boostType2] || 0) + .3 * n(k);
  }
  return Object.assign({ atkMul: 1, hpMul: 1, speedMul: 1, dashCdMul: 1, dashInvAdd: 0, extraJumps: 0, guard: 1, bandMul: 1, specsMul: 1, expMul: 1 }, pm, {
    typeBoost,
    all: (1 + .3 * n('life_orb')) * (pm.allMul || 1),
    orbCost: n('life_orb') > 0 || !!pm.orbCost,
    extraProj: n('core_multi') + (pm.extraProj || 0),
    cdMul: Math.pow(.8, n('core_haste')) * (pm.cdMul || 1),
    sizeMul: (1 + .3 * n('core_giant') + (pm.sizeAdd || 0)) * (pm.sizeMul || 1),
    regen: .006 * n('leftovers') + (pm.regen || 0),
    lifesteal: .06 * n('shell_bell') + (pm.lifesteal || 0),
    crit: .15 * n('razor_claw') + .12 * n('scope_lens') + (pm.crit || 0), critMul: 1 + .2 * n('scope_lens'),
    swapCdMul: Math.pow(.6, n('quick_claw')) * (pm.swapCdMul || 1)
  });
}