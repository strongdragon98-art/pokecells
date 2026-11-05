// 진행 저장 (이어하기): 일시정지 메뉴의 '저장하기' · 포켓몬센터에 가면 자동 저장
//  챕터 지형은 시드로 다시 만든다 (같은 시드 → 같은 지형). 그 위에 바뀐 것만 덮어쓴다:
//  정화한 보스 · 들른 방 · 연 상자 · 주운 상처약 · 걷힌 흙 · 무너진 벽 · 쓴 센터/자판기 · 탐험한 칸 · 지나온 지역
//  파티(진화 단계·경험치·메가·장착 아이템·기술머신 기술)와 가방·메가스톤·Z크리스탈·공중날기 정거장도 함께 저장한다
//  도감 해금·정화 수는 원래대로 Save.js 가 따로 자동 저장한다
import { computeMods, MAX_EQUIP } from '../data/items.js';
import { boostTotals } from '../data/tm.js';
import { START_MONEY } from '../data/shop.js';

const KEY = 'pokecells.run.v2';   // v2: 튜토리얼 기술머신·엘리트 굴·회복기 보장으로 지형 생성이 바뀌었다 (v1 저장은 다른 지형이 되어 쓰지 않는다)

// 시드 난수 (mulberry32)
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// fn 이 도는 동안만 Math.random 을 시드 난수로 바꿔 끼운다 (game/World.js 의 buildChapter 는 Math.random 만 쓴다)
export function seeded(seed, fn) {
  const orig = Math.random;
  Math.random = mulberry32(seed);
  try { return fn(); } finally { Math.random = orig; }
}

export const newSeed = () => (Math.random() * 0x7fffffff) | 0;

// 탐험한 칸(Uint8Array 0/1) ↔ 비트를 묶은 base64
function packBits(u8) {
  const out = new Uint8Array(Math.ceil(u8.length / 8));
  for (let i = 0; i < u8.length; i++) if (u8[i]) out[i >> 3] |= 1 << (i & 7);
  let s = '';
  for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
  return btoa(s);
}
function unpackBits(b64, n) {
  const s = atob(b64), u8 = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (s.charCodeAt(i >> 3) & (1 << (i & 7))) u8[i] = 1;
  return u8;
}

const idxWhere = (arr, f) => arr.reduce((o, x, i) => (f(x) ? o.push(i) : 0, o), []);
// 지형이 같은지 확인하는 서명 (게임이 업데이트돼 같은 시드로 다른 지형이 나오면 바뀐 것을 덮어쓰지 않는다)
const sigOf = lv => `${lv.cols}x${lv.rows}:${lv.rooms.length}:${lv.chests.length}:${lv.potions.length}:${lv.breakables.length}:${lv.props.length}`;

// 챕터 월드 한 개 → 저장용 데이터
export function snapshotWorld(W) {
  const lv = W.level;
  return {
    seed: W.seed, sig: sigOf(lv),
    cleared: idxWhere(lv.rooms, r => r.cleared), entered: idxWhere(lv.rooms, r => r.entered),
    chests: idxWhere(lv.chests, c => c.opened), potions: idxWhere(lv.potions, p => p.taken),
    sides: idxWhere(lv.sides, s => s.revealed), walls: idxWhere(lv.breakables, b => b.broken),
    props: idxWhere(lv.props, p => p.used), tmx: idxWhere(lv.tmx || [], t => t.used),   // tmx: 길목 기술머신 (World 끝)
    sidePure: idxWhere(lv.rooms, r => r.isPurified), masteryGot: lv.masteryGot || 0,   // ✨ 샛길 정화: 정화한 샛길 구역(다시 몬스터가 나오지 않는다) · 받은 강화 수 (GameScene.purifySideRoom)
    explored: W.explored ? packBits(W.explored) : null,
    areas: [...W.areasSeen]
  };
}

// 저장해 둔 바뀐 것들을 새로 만든 월드에 덮어쓴다 (지형 서명이 다르면 처음 상태 그대로 둔다 → false)
export function applyWorld(W, s) {
  const lv = W.level;
  if (!s || s.sig !== sigOf(lv)) return false;
  const set = (arr, ids, k) => { const on = new Set(ids); arr.forEach((x, i) => { x[k] = on.has(i); }); };
  set(lv.rooms, s.cleared, 'cleared'); set(lv.rooms, s.entered, 'entered');
  for (const i of s.chests) lv.chests[i].opened = true;
  for (const i of s.potions) lv.potions[i].taken = true;
  for (const i of s.sides) lv.sides[i].revealed = true;
  for (const i of s.props) lv.props[i].used = true;
  for (const i of s.tmx || []) if (lv.tmx && lv.tmx[i]) lv.tmx[i].used = true;
  set(lv.rooms, s.sidePure || [], 'isPurified'); lv.masteryGot = s.masteryGot || 0;
  if (!s.sidePure && s.mastered) for (const i of s.mastered) if (lv.rooms[i] && !lv.rooms[i].main) lv.rooms[i].isPurified = true;   // 예전 저장(지방 탐색 숙련도): 몬스터를 모두 정화해 센 샛길 방은 정화한 샛길 구역으로
  // 무너진 벽: 격자에서 지우고 이웃 칸 타일 모양을 다시 맞춘다 (GameScene.breakWall 과 같은 계산, 타일 지도는 아직 없다)
  const touched = new Set();
  for (const i of s.walls) {
    const b = lv.breakables[i]; b.broken = true; b.hp = 0;
    for (const [x, y] of b.cells) { lv.grid[y][x] = '.'; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) touched.add((x + dx) + ',' + (y + dy)); }
  }
  for (const k of touched) {
    const [x, y] = k.split(',').map(Number);
    if (x >= 0 && y >= 0 && x < lv.cols && y < lv.rows) lv.data[y][x] = lv.tileOf(x, y);
  }
  if (s.explored) W.explored = unpackBits(s.explored, lv.cols * lv.rows);
  W.areasSeen = new Set(s.areas || []);
  return true;
}

// 파티 · 가방 등 플레이어 진행
export function snapshotPlayer(p) {
  return {
    idx: p.idx, stageBonus: p.stageBonus, bag: { ...p.bag }, formItems: [...p.formItems], candy: p.candy || 0,
    money: p.money, orbs: { ...(p.orbs || {}) }, nuggets: { ...p.nuggets }, uses: { ...p.uses }, shopLog: JSON.parse(JSON.stringify(p.shopLog || {})), shopStats: { ...p.shopStats },   // 포켓샵 경제 (data/shop.js)
    keyStone: !!p.keyStone, zRing: !!p.zRing, megaStones: [...p.stones], crystals: { ...p.crystals }, quests: { ...(p.quests || {}) },   // 메가스톤 · Z크리스탈 (data/gear.js) · 이야기 진행
    members: p.members.map(memberSnap),
    stored: Object.values(p.stored || {}).map(memberSnap)   // 포켓몬센터 보관함에 맡긴 포켓몬 (진화 · 아이템 · 기술 그대로)
  };
}
// 포켓몬 한 마리의 진행 (진화 단계 · 최고 단계 · 경험치 · 장착 아이템 · 기술머신 특성 · 기술 · 카드 등급)
function memberSnap(m) {
  return {
    key: m.key, hp: Math.round(m.hp), alive: m.alive, tier: m.tier, peakTier: Math.max(m.peakTier || 0, m.tier), exp: Math.round(m.exp * 100) / 100, xpv: 2, evoCi: m.evoCi ?? null, mega: m.mega, megaPick: m.megaPick || 0,
    items: { ...m.items }, perks: { ...(m.perks || {}) }, skills: { ...m.skills }, ups: [...m.ups], atkBonus: m.atkBonus, cdBonus: m.cdBonus, learned: [...m.learned], chargeType: m.chargeType || null, cardGrade: { ...(m.cardGrade || {}) }, cardLv: { ...(m.cardLv || {}) },
    gear: { ...(m.gear || {}) }, boostCards: (m.boostCards || []).map(e => ({ ...e })), vit: { ...(m.vit || {}) }, mastery: m.mastery || 0   // mastery: 숙련 카드 수 (카드 점수)
  };
}
// 예전 저장의 경험치 눈금(2단 30 · 3단 150)을 지금 눈금(100 · 750)으로 — 진화 단계 안에서의 진행 비율은 그대로
export function oldExp(tier, e) {
  if (tier >= 2) return 750;
  if (tier === 1) return 100 + Math.max(0, Math.min(.99, (e - 30) / 120)) * 650;
  return Math.max(0, Math.min(.99, e / 30)) * 100;
}
// 저장해 둔 진행을 포켓몬 m 에 덮어쓴다
function applyMember(m, d) {
  const tier = Math.max(0, Math.min(2, Math.max(d.tier || 0, d.peakTier || 0)));   // 저장된 최고 단계보다 낮게 복원하지 않는다
  Object.assign(m, {
    tier, peakTier: tier, exp: d.xpv === 2 ? d.exp : oldExp(tier, d.exp || 0), evoCi: d.evoCi ?? null, mega: !!d.mega, megaPick: d.megaPick || 0, alive: d.alive !== false,
    items: { ...d.items }, perks: { ...(d.perks || {}) }, vit: { ...(d.vit || {}) }, mods: computeMods(d.items || {}, d.perks || {}, d.vit || {}), skills: { ...m.skills, ...d.skills }, ups: new Set(d.ups || []), cardGrade: { ...(d.cardGrade || {}) },
    atkBonus: d.atkBonus || 1, cdBonus: d.cdBonus || 1, learned: d.learned && d.learned.length ? [...d.learned] : m.learned, chargeType: d.chargeType || null,
    gear: { stone: (d.gear && d.gear.stone) || null, crystal: (d.gear && d.gear.crystal) || null },
    boostCards: (d.boostCards || []).map(e => ({ ...e })), cardLv: { ...(d.cardLv || {}) }, boost: boostTotals(d.boostCards, d.cardLv),   // 스킬 강화 카드
    mastery: d.mastery || 0
  });
}

// 새로 만든 Player(저장된 파티 키로 만든 것)에 저장해 둔 진행을 덮어쓴다
export function restorePlayer(p, s) {
  s.members.forEach((d, i) => {
    const m = p.members[i];
    if (!m || m.key !== d.key) return;
    applyMember(m, d);
  });
  p.stored = {};
  for (const d of s.stored || []) {
    if (p.members.some(m => m.key === d.key)) continue;
    const m = p.makeMember(d.key);
    applyMember(m, d);
    m.maxhp = p.maxHpOf(m); m.hp = Math.max(1, Math.min(m.maxhp, d.hp || m.maxhp)); m.alive = true;
    p.stored[d.key] = m;
  }
  p.stageBonus = s.stageBonus || 1;
  p.bag = { ...(s.bag || {}) };
  p.candy = s.candy || 0;
  p.money = s.money ?? START_MONEY; p.orbs = { ...(s.orbs || {}) }; p.nuggets = { ...(s.nuggets || {}) }; p.uses = { ...(s.uses || {}) };   // 예전 저장(포켓샵 전): 용돈부터
  p.shopLog = s.shopLog ? JSON.parse(JSON.stringify(s.shopLog)) : {}; p.shopStats = { bought: 0, sold: 0, spent: 0, earned: 0, ...(s.shopStats || {}) };
  p.keyStone = !!s.keyStone; p.zRing = !!s.zRing;
  p.stones = new Set(s.megaStones || []); p.crystals = { ...(s.crystals || {}) }; p.quests = { ...(s.quests || {}) };
  // 예전 저장: 파티 공용 Z크리스탈 · 메가스톤 개수 → Z링 + 파티 속성 Z크리스탈 / 키스톤 + 파티 메가스톤 (모두 전용 칸에)
  if (s.z && !s.zRing) p.gainZ();
  if (s.stones > 0 && !s.keyStone) { p.keyStone = true; for (let k = 0; k < Math.min(3, s.stones); k++) p.gainStone(); }
  // 일반 도구 칸이 2칸으로 줄었다: 넘치는 것은 가방으로
  for (const m of [...p.members, ...Object.values(p.stored)]) {
    while (p.equipCount(m) > MAX_EQUIP) { const id = Object.keys(m.items).pop(); if (--m.items[id] <= 0) delete m.items[id]; p.bag[id] = (p.bag[id] || 0) + 1; }
    p.refreshMods(m);
  }
  p.formItems = new Set(s.formItems || []);
  p.idx = Math.min(s.idx || 0, p.members.length - 1);
  if (!p.m.alive) { const j = p.members.findIndex(m => m.alive); if (j >= 0) p.idx = j; }
  for (const [i, m] of p.members.entries()) {
    const d = s.members[i];
    m.maxhp = p.maxHpOf(m);
    m.hp = d && m.key === d.key ? Math.max(m.alive ? 1 : 0, Math.min(m.maxhp, d.hp)) : m.maxhp;
  }
  p.applyVisual();
}

export const RunSave = {
  has() { return !!this.peek(); },
  // 저장 내용 (로비의 이어하기 버튼에 지방·시각 표시)
  peek() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
  write(snap) {
    try { localStorage.setItem(KEY, JSON.stringify(snap)); return true; } catch (e) { return false; }   // 저장 공간이 꽉 찼거나 막혀 있으면 false
  },
  clear() { try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } }
};
