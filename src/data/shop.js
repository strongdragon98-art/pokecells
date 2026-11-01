// 포켓샵(프렌들리숍) 경제: 포켓달러(₽) · 금구슬 3종 · 상점 품목 · 매입가 · 재고
//  돈 버는 길: 샛길의 엘리트 · 보스가 떨어뜨리는 금구슬을 포켓샵에 판다 (야생 포켓몬은 돈을 주지 않는다)
//  쓰는 길: 포켓몬센터 옆 포켓샵에서 이상한사탕 · 회복약 · 영양제 · 전술 장착 도구 · 메가스톤 · Z크리스탈을 산다
//  재고는 포켓샵(시내)마다 따로 센다 — 구매 이력(Player.shopLog)이 진행 저장(RunSave)에 함께 남는다
import { ITEMS } from './items.js';
import { SPECIES } from './pokemon.js';
import { usesStone, stoneName, zTypeOf, crystalName } from './gear.js';
import { typeColor } from './types.js';

export const START_MONEY = 3000;   // 새 모험의 용돈 (본가처럼 3,000 ₽)
export const won = n => `${Math.round(n).toLocaleString('ko-KR')} ₽`;

// 금구슬: 환금 전용 (장착 · 사용 불가) — 판매가 고정
export const NUGGETS = {
  tiny_nugget: { name: '작은 금구슬', en: 'Tiny Nugget', icon: '🔸', sell: 1500, color: 0xffc04a, desc: '작은 황금 알갱이. 포켓샵에 1,500 ₽ 에 팔 수 있다.' },
  nugget: { name: '금구슬', en: 'Nugget', icon: '🟡', sell: 5000, color: 0xffd84a, desc: '순금으로 된 구슬. 포켓샵에 5,000 ₽ 에 팔 수 있다.' },
  big_nugget: { name: '큰 금구슬', en: 'Big Nugget', icon: '🌟', sell: 15000, color: 0xfff08a, desc: '눈부시게 빛나는 커다란 금구슬. 포켓샵에 15,000 ₽ 에 팔 수 있다.' }
};
export const NUGGET_KEYS = Object.keys(NUGGETS);

// 가방에 담아 두고 쓰는 소모품 (가방 탭 · 포켓샵에서 산다). heal: 최대 체력 비율 · revive: 쓰러진 포켓몬을 그 비율로 깨운다
//  영양제(vit): 포켓몬 한 마리의 능력치를 영구히 올린다 — 종류마다 VIT_MAX 번까지 (data/items.js computeMods)
export const VIT_MAX = 5;
export const USES = {
  potion: { name: '상처약', cat: 'heal', heal: .4, desc: '포켓몬 하나의 체력을 40% 회복한다.' },
  super_potion: { name: '고급상처약', cat: 'heal', heal: .7, desc: '포켓몬 하나의 체력을 70% 회복한다.' },
  full_restore: { name: '풀회복약', cat: 'heal', heal: 1, desc: '포켓몬 하나의 체력을 모두 회복한다.' },
  revive: { name: '기력의조각', cat: 'revive', revive: .5, desc: '쓰러진 포켓몬 하나를 체력 50% 로 깨운다.' },
  hp_up: { name: '맥스업', cat: 'vit', vit: 'hp', desc: `최대 체력 +4% (영구 · 포켓몬마다 ${VIT_MAX}번까지)` },
  taurine: { name: '타우린', cat: 'vit', vit: 'atk', desc: `공격력 +3% (영구 · 포켓몬마다 ${VIT_MAX}번까지)` },
  saponin: { name: '사포닌', cat: 'vit', vit: 'def', desc: `받는 피해 -3% (영구 · 포켓몬마다 ${VIT_MAX}번까지)` },
  zinc: { name: '키토산', cat: 'vit', vit: 'cd', desc: `기술 재사용 시간 -3% (영구 · 포켓몬마다 ${VIT_MAX}번까지)` },
  carbos: { name: '알칼로이드', cat: 'vit', vit: 'spd', desc: `이동 속도 +2% (영구 · 포켓몬마다 ${VIT_MAX}번까지)` }
};

// 판매 품목: cat — grow 소비/성장 · tool 전술 장착 도구 · core 특수 핵심 (고액)
//  stock: 포켓샵마다 살 수 있는 개수 (없으면 무제한)
export const SHOP_STOCK = [
  { id: 'rare_candy', kind: 'candy', cat: 'grow', price: 3000, stock: 3 },
  { id: 'potion', kind: 'use', cat: 'grow', price: 300 },
  { id: 'super_potion', kind: 'use', cat: 'grow', price: 900 },
  { id: 'full_restore', kind: 'use', cat: 'grow', price: 2500 },
  { id: 'revive', kind: 'use', cat: 'grow', price: 2000 },
  { id: 'hp_up', kind: 'use', cat: 'grow', price: 3500 },
  { id: 'taurine', kind: 'use', cat: 'grow', price: 3500 },
  { id: 'saponin', kind: 'use', cat: 'grow', price: 3500 },
  { id: 'zinc', kind: 'use', cat: 'grow', price: 3500 },
  { id: 'carbos', kind: 'use', cat: 'grow', price: 3500 },
  { id: 'leftovers', kind: 'tool', cat: 'tool', price: 6000, stock: 1 },
  { id: 'life_orb', kind: 'tool', cat: 'tool', price: 8000, stock: 1 },
  { id: 'shell_bell', kind: 'tool', cat: 'tool', price: 6000, stock: 1 },
  { id: 'scope_lens', kind: 'tool', cat: 'tool', price: 5000, stock: 1 },
  { id: 'choice_band', kind: 'tool', cat: 'tool', price: 9000, stock: 1 },
  { id: 'focus_sash', kind: 'tool', cat: 'tool', price: 7000, stock: 1 },
  { id: 'quick_claw', kind: 'tool', cat: 'tool', price: 4000, stock: 1 }
];
export const STONE_PRICE = 30000, CRYSTAL_PRICE = 20000;
export const SHOP_CATS = [['grow', '💊 소비 · 성장'], ['tool', '🎽 전술 도구'], ['core', '💎 특수 핵심']];
const TOOL_BASE = 4000;   // 포켓샵에서 팔지 않는 도구(속성 강화 · 코어)의 기준가 → 그 절반에 산다

// 이름 · 설명 · 그림 id (UIScene.itemImage 로 그린다)
export function goodsInfo(e) {
  if (e.kind === 'candy') return { name: '이상한사탕', desc: '다음 진화 경험치의 40% 를 바로 채운다 (차면 진화) · 최종 진화면 체력 회복 + 공격력 +3%', art: 'rare_candy' };
  if (e.kind === 'use') return { name: USES[e.id].name, desc: USES[e.id].desc, art: e.id };
  if (e.kind === 'tool') return { name: ITEMS[e.id].name, desc: ITEMS[e.id].desc, art: e.id };
  if (e.kind === 'nugget') return { name: NUGGETS[e.id].name, desc: NUGGETS[e.id].desc, art: e.id };
  if (e.kind === 'stone') return e.line ? { name: stoneName(e.line), desc: `${SPECIES[e.line].name} 계열 전용 메가스톤 · 키스톤과 함께 3단 진화 뒤 V 로 메가진화`, tint: typeColor(SPECIES[e.line].types[0]), tex: 'megastone' }
    : { name: '메가스톤', desc: '파티 포켓몬 계열의 메가스톤 · 키스톤과 함께 3단 진화 뒤 V 로 메가진화', tint: 0xff8ad0, tex: 'megastone' };
  return { name: crystalName(e.type), desc: `${crystalName(e.type)} — 이 속성(첫 속성) 포켓몬이 Z링과 함께 Q 로 Z기술`, tint: typeColor(e.type), tex: 'zcrystal' };
}

// 이 포켓샵의 재고 키 (지방 · 시내 방) — 구매 이력은 여기에 센다
export const martKey = (ci, roomId) => `${ci}:${roomId}`;
export function boughtHere(p, key, id) { return ((p.shopLog || {})[key] || {})[id] || 0; }

// 지금 이 포켓샵의 진열대: { ...품목, left(남은 재고 · null 무제한), lock(못 사는 까닭) }
//  특수 핵심: 키스톤 · Z링을 이야기 속에서 얻은 뒤에만 — 파티 · 보관함 포켓몬 가운데 아직 돌/크리스탈이 없는 것만 고가에
export function shopGoods(p, key) {
  const out = SHOP_STOCK.map(s => {
    const left = s.stock ? Math.max(0, s.stock - boughtHere(p, key, s.id)) : null;
    return { ...s, left, lock: left === 0 ? '품절 — 다른 시내의 포켓샵에서' : null };
  });
  const all = [...p.members, ...Object.values(p.stored || {})];
  const hasStone = line => p.stones.has(line) || all.some(m => m.gear.stone === line);
  const lines = [...new Set(all.map(m => m.key))].filter(k => usesStone(k) && !hasStone(k));
  if (!p.keyStone) out.push({ id: 'stone:locked', kind: 'stone', cat: 'core', line: lines[0] || null, price: STONE_PRICE, left: null, lock: '🔒 키스톤을 얻은 뒤 (성도 방울탑의 노승려)' });
  else for (const line of lines) out.push({ id: `stone:${line}`, kind: 'stone', cat: 'core', line, price: STONE_PRICE, left: 1, lock: null });
  const hasCrystal = t => (p.crystals[t] || 0) > 0 || all.some(m => m.gear.crystal === t);
  const types = [...new Set(all.map(m => zTypeOf(m.key)))].filter(t => !hasCrystal(t));
  if (!p.zRing) out.push({ id: 'crystal:locked', kind: 'crystal', cat: 'core', type: types[0] || 'normal', price: CRYSTAL_PRICE, left: null, lock: '🔒 Z링을 얻은 뒤 (호연 하늘기둥의 시련 캡틴)' });
  else for (const type of types) out.push({ id: `crystal:${type}`, kind: 'crystal', cat: 'core', type, price: CRYSTAL_PRICE, left: 1, lock: null });
  return out;
}

// 매입가: 금구슬은 고유 고가 · 나머지는 포켓샵 판매가의 50%
export function sellPrice(kind, id) {
  if (kind === 'nugget') return NUGGETS[id].sell;
  const s = SHOP_STOCK.find(q => q.id === id && q.kind === kind);
  if (s) return Math.floor(s.price / 2);
  if (kind === 'tool') return ITEMS[id] && !ITEMS[id].relic ? TOOL_BASE / 2 : 0;
  return 0;
}

// 가방에서 팔 수 있는 것 (+ 실수로 팔지 않게 잠근 것): { kind, id, n, price, lock }
//  보스의 코어(전설 유물) · 장착 중인 도구 · 메가스톤 · Z크리스탈(이야기 속 유일한 물건)은 잠근다
export function sellables(p) {
  const out = [];
  for (const id of NUGGET_KEYS) if ((p.nuggets || {})[id] > 0) out.push({ kind: 'nugget', id, n: p.nuggets[id], price: sellPrice('nugget', id) });
  if (p.candy > 0) out.push({ kind: 'candy', id: 'rare_candy', n: p.candy, price: sellPrice('candy', 'rare_candy') });
  for (const [id, n] of Object.entries(p.uses || {})) if (n > 0) out.push({ kind: 'use', id, n, price: sellPrice('use', id) });
  for (const [id, n] of Object.entries(p.bag)) if (n > 0) out.push({ kind: 'tool', id, n, price: sellPrice('tool', id), lock: ITEMS[id].relic ? '🔒 판매 불가 · 전설 유물' : null });
  p.members.forEach((m, i) => { for (const [id, n] of Object.entries(m.items)) if (n > 0) out.push({ kind: 'tool', id, n, from: i, price: sellPrice('tool', id), lock: ITEMS[id].relic ? '🔒 판매 불가 · 전설 유물' : `🔒 ${p.formName(m)} 장착 중 · 가방에서 해제 후 판매` }); });
  for (const line of p.stones) out.push({ kind: 'stone', id: `stone:${line}`, line, n: 1, price: 0, lock: '🔒 판매 불가 · 이야기 속 유일한 물건' });
  for (const [type, n] of Object.entries(p.crystals)) if (n > 0) out.push({ kind: 'crystal', id: `crystal:${type}`, type, n, price: 0, lock: '🔒 판매 불가 · 이야기 속 유일한 물건' });
  return out;
}
// 가방 속 금구슬을 모두 팔면 받는 돈
export const nuggetTotal = p => NUGGET_KEYS.reduce((s, id) => s + ((p.nuggets || {})[id] || 0) * NUGGETS[id].sell, 0);

// 엘리트 · 보스 처치 금구슬 (stageIdx: 0 관동 ~ 4 하나)
//  엘리트: 초반(관동 · 성도) 작은 금구슬 확정 · 중후반은 작은 금구슬 2개 + 금구슬 35% · 큰 금구슬은 극악 확률
//  보스: 중간 보스 금구슬 확정 · 지방 보스 · 히든 보스는 큰 금구슬 확정 (+ 금구슬)
export function eliteNuggets(stageIdx, rnd = Math.random) {
  const late = stageIdx >= 2, out = ['tiny_nugget'];
  if (late) out.push('tiny_nugget');
  if (rnd() < (late ? .35 : .08)) out.push('nugget');
  if (rnd() < (late ? .03 : .01)) out.push('big_nugget');
  return out;
}
export function bossNuggets(roomType) {
  if (roomType === 'mini') return ['nugget'];
  return ['big_nugget', 'nugget'];
}
