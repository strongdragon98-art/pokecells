// 진행 저장 (이어하기): 일시정지 메뉴의 '저장하기' · 포켓몬센터에 가면 자동 저장
//  챕터 지형은 시드로 다시 만든다 (같은 시드 → 같은 지형). 그 위에 바뀐 것만 덮어쓴다:
//  정화한 보스 · 들른 방 · 연 상자 · 주운 상처약 · 걷힌 흙 · 무너진 벽 · 쓴 센터/자판기 · 탐험한 칸 · 지나온 지역
//  파티(진화 단계·경험치·메가·장착 아이템·기술머신 기술)와 가방·메가스톤·Z크리스탈·공중날기 정거장도 함께 저장한다
//  도감 해금·정화 수는 원래대로 Save.js 가 따로 자동 저장한다
import { computeMods } from '../data/items.js';

const KEY = 'pokecells.run.v1';

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
    props: idxWhere(lv.props, p => p.used),
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
    idx: p.idx, stageBonus: p.stageBonus, bag: { ...p.bag }, stones: p.mega.stones, z: p.z.has, formItems: [...p.formItems],
    members: p.members.map(m => ({
      key: m.key, hp: Math.round(m.hp), alive: m.alive, tier: m.tier, exp: m.exp, mega: m.mega, megaPick: m.megaPick || 0,
      items: { ...m.items }, skills: { ...m.skills }, ups: [...m.ups], atkBonus: m.atkBonus, cdBonus: m.cdBonus, learned: [...m.learned]
    }))
  };
}

// 새로 만든 Player(저장된 파티 키로 만든 것)에 저장해 둔 진행을 덮어쓴다
export function restorePlayer(p, s) {
  s.members.forEach((d, i) => {
    const m = p.members[i];
    if (!m || m.key !== d.key) return;
    Object.assign(m, {
      tier: d.tier, exp: d.exp, mega: !!d.mega, megaPick: d.megaPick || 0, alive: d.alive !== false,
      items: { ...d.items }, mods: computeMods(d.items || {}), skills: { ...m.skills, ...d.skills }, ups: new Set(d.ups || []),
      atkBonus: d.atkBonus || 1, cdBonus: d.cdBonus || 1, learned: d.learned && d.learned.length ? [...d.learned] : m.learned
    });
  });
  p.stageBonus = s.stageBonus || 1;
  p.bag = { ...(s.bag || {}) };
  p.mega.stones = s.stones || 0;
  p.z.has = !!s.z;
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
