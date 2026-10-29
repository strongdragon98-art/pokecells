// 메트로배니아식 2D 챕터 월드 (할로우 나이트풍 상호연결 방 그래프) — data/stages.js 의 챕터 하나를 타일 지도로 만든다
//  셀(32×20칸 ≈ 한 화면) 격자 위에 방을 놓는다.
//   · 본길: 지역 순서대로 오른쪽으로 이어지며, 탑(위로)·갱도(아래로)·계단·쌓인 방(^, 바로 위)으로 오르내린다.
//     중간 보스 아레나를 지나야 다음 구간으로 갈 수 있다 (구간 = seg).
//   · 샛길: 지역마다 본길 방의 위·아래·옆 빈칸으로 자라난다 — 기술머신 비밀방 · 보물 · 상처약 · 막다른 굴(페이크) ·
//     히든 전설 성소(첫 문이 부서지는 벽, 2~4방 깊이). 상처약·페이크 굴은 들어가기 전까지 흙으로 덮인 '환영 벽' 너머에 있다.
//   · 같은 구간 안에서 맞닿은 방끼리는 가끔 문을 더 뚫어 지름길 고리를 만든다 (비밀·아레나 방은 빼고).
//  방마다 바깥 벽 2칸 · 바닥 밑 땅 6칸. 좌우 문은 그 셀 줄의 바닥 높이에 5칸 높이로, 위아래 문은 철창 뚜껑 + 디딤 발판 사다리로.
//  grid 문자: 'S' 벽 · 'B' 부서지는 벽 · 'P' 통과 발판(보이는 다리·철창) · 'H' 통과 발판(집 지붕·발코니) · '.' 빈칸
import { TILE } from '../config.js';
import { T } from './Level.js';

export const CW = 32, CH = 20;          // 셀 하나의 크기 (타일)
const WALL = 2, GROUND = 6;             // 방 벽 두께 · 바닥 밑 땅 두께 (바닥 윗면 = 셀 아래 경계 - 6)

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickWeighted = w => {
  let r = Math.random() * Object.values(w).reduce((s, v) => s + v, 0);
  for (const [k, v] of Object.entries(w)) if ((r -= v) < 0) return k;
  return Object.keys(w)[0];
};
const DEFAULT_TERRAIN = { terrace: 3, pit: 2, island: 2, ziggurat: 1, bridge: 2, house: 2, tiers: 1, flat: 1 };
const DEFAULT_PROPS = { lamp: 2, tree: 1, statue: 1, fence: 1 };

// 방 모양 [폭, 높이] (셀)
const SHAPE = { start: [1, 1], wide: [2, 1], plaza: [2, 2], tower: [1, 3], abyss: [1, 3], stairs: [1, 2], bridge: [2, 1], hub: [2, 1], mini: [2, 1], boss: [2, 1] };
const C_SHAPES = [[1, 1], [1, 1], [1, 1], [2, 1], [1, 2]];
const BIG_ARENA = new Set(['ho-oh', 'rayquaza', 'eternatus', 'latias', 'giratina', 'mewtwo', 'darkrai']);   // 날아다니는 보스는 2×2 아레나
const END = { tm: { shape: [1, 1], type: 'tm' }, treasure: { shape: [1, 1], type: 'treasure' }, potion: { shape: [1, 1], type: 'pocket' }, fake: { shape: [1, 1], type: 'pocket' }, sanctuary: { shape: [2, 1], type: 'sanctuary' } };
const FAKE_LORE = ['막다른 길이다. 차가운 바람만 새어 든다.', '누군가 먼저 다녀간 흔적… 아무것도 남지 않았다.', '벽에 긁힌 글씨: "여긴 아무것도 없어"', '무너진 흙더미뿐이다. 괜히 들어왔다.'];

export function buildChapter(ch, ci, retry = 0) {
  // ================= ① 방 배치 (셀 격자 그래프) =================
  const rooms = [], doors = [], occ = new Map();
  const ck = (x, y) => x + ',' + y;
  const free = (gx, gy, w, h, extra) => { for (let y = gy; y < gy + h; y++) for (let x = gx; x < gx + w; x++) if (occ.has(ck(x, y)) || (extra && extra.has(ck(x, y)))) return false; return true; };
  const place = o => {
    const r = Object.assign({ id: rooms.length, doors: [], links: new Set(), torches: [], entered: false, cleared: true, seg: 0 }, o);
    rooms.push(r);
    for (let y = r.gy; y < r.gy + r.gh; y++) for (let x = r.gx; x < r.gx + r.gw; x++) occ.set(ck(x, y), r);
    return r;
  };
  // 맞닿은 두 방 사이에 문 하나 (좌우면 겹치는 셀 줄 중 하나, 위아래면 겹치는 셀 칸 중 하나)
  const link = (a, b, o = {}) => {
    let d = null;
    if (a.gx + a.gw === b.gx || b.gx + b.gw === a.gx) {
      const [L, R] = a.gx < b.gx ? [a, b] : [b, a];
      const lo = Math.max(L.gy, R.gy), hi = Math.min(L.gy + L.gh, R.gy + R.gh) - 1;
      if (lo <= hi) d = { dir: 'h', L, R, row: o.row != null && o.row >= lo && o.row <= hi ? o.row : ri(lo, hi) };
    }
    if (!d && (a.gy + a.gh === b.gy || b.gy + b.gh === a.gy)) {
      const [U, D] = a.gy < b.gy ? [a, b] : [b, a];
      const lo = Math.max(U.gx, D.gx), hi = Math.min(U.gx + U.gw, D.gx + D.gw) - 1;
      if (lo <= hi) d = { dir: 'v', U, D, col: o.col != null && o.col >= lo && o.col <= hi ? o.col : ri(lo, hi) };
    }
    if (!d) return null;
    Object.assign(d, { id: doors.length, a, b, breakable: !!o.breakable, hidden: !!o.hidden });
    doors.push(d); a.doors.push(d); b.doors.push(d); a.links.add(b.id); b.links.add(a.id);
    return d;
  };
  const typeOf = kind => kind === 'start' ? 'start' : kind === 'hub' ? 'village' : kind === 'mini' ? 'mini' : kind === 'boss' ? 'boss' : 'combat';

  // ---- 본길 ----
  let cur = null, exitRow = 0, seg = 0;
  ch.areas.forEach((area, ai) => area.plan.forEach(tok0 => {
    const up = tok0.endsWith('^'), tok = up ? tok0.slice(0, -1) : tok0, [kind, arg] = tok.split(':');
    let [w, h] = kind === 'c' ? pick(C_SHAPES) : SHAPE[kind];
    if ((kind === 'boss' || kind === 'mini') && BIG_ARENA.has(arg)) [w, h] = [2, 2];
    let gx, gy;
    if (!cur) { gx = 0; gy = 0; }
    else if (up) { gx = cur.gx; gy = cur.gy - h; }
    else {
      gx = cur.gx + cur.gw;
      gy = kind === 'tower' || kind === 'stairs' ? exitRow - (h - 1) : kind === 'abyss' ? exitRow : exitRow - ri(0, h - 1);
    }
    for (let k = 0; k < 6 && !free(gx, gy, w, h); k++) gy -= 1;   // 드물게 겹치면 위로 비켜 놓는다
    const r = place({ gx, gy, gw: w, gh: h, kind, type: typeOf(kind), ai, boss: arg || null, main: true, seg, cleared: !(kind === 'boss' || kind === 'mini'), hub: kind === 'hub', city: kind === 'hub' ? area.city : null });
    if (cur) link(cur, r, up ? {} : { row: exitRow });
    exitRow = kind === 'tower' || kind === 'stairs' || up ? r.gy : kind === 'abyss' ? r.gy + h - 1 : r.gy + ri(0, h - 1);
    if (kind === 'mini') seg++;
    cur = r;
  }));
  const mainRooms = rooms.slice();

  // ---- 샛길: anchor 방에서 len 방을 지나 끝방(end)까지 빈칸으로 자란다 ----
  const grow = (anchors, endKind, o = {}) => {
    for (let tries = 0; tries < 90; tries++) {
      const a = pick(anchors), len = ri(o.len[0], o.len[1]), plan = [], temp = new Set();
      let P = a, ok = true;
      for (let i = 0; i <= len; i++) {
        const last = i === len;
        let shape = last ? END[endKind].shape : null;
        if (last && endKind === 'sanctuary' && BIG_ARENA.has(o.boss)) shape = [2, 2];
        const dirs = shuffle(['down', 'up', 'left', 'right']);
        if (o.dir) dirs.sort((x, y) => (y === o.dir) - (x === o.dir));
        let placed = null;
        for (const d of dirs) {
          const [w, hh] = shape || (d === 'up' || d === 'down' ? [1, 2] : pick([[1, 1], [2, 1]]));
          let gx, gy;
          if (d === 'down') { gx = ri(P.gx - w + 1, P.gx + P.gw - 1); gy = P.gy + P.gh; }
          else if (d === 'up') { gx = ri(P.gx - w + 1, P.gx + P.gw - 1); gy = P.gy - hh; }
          else if (d === 'left') { gx = P.gx - w; gy = ri(P.gy - hh + 1, P.gy + P.gh - 1); }
          else { gx = P.gx + P.gw; gy = ri(P.gy - hh + 1, P.gy + P.gh - 1); }
          if (!free(gx, gy, w, hh, temp)) continue;
          placed = { gx, gy, w, h: hh };
          break;
        }
        if (!placed) { ok = false; break; }
        for (let y = placed.gy; y < placed.gy + placed.h; y++) for (let x = placed.gx; x < placed.gx + placed.w; x++) temp.add(ck(x, y));
        plan.push(placed); P = { gx: placed.gx, gy: placed.gy, gw: placed.w, gh: placed.h };
      }
      if (!ok) continue;
      let prev = a; const made = [];
      plan.forEach((pl, i) => {
        const last = i === plan.length - 1;
        const r = place({ gx: pl.gx, gy: pl.gy, gw: pl.w, gh: pl.h, kind: last ? endKind : pl.h > 1 ? 'bshaft' : 'bc', type: last ? END[endKind].type : 'combat',
          ai: a.ai, branch: true, secret: !!o.secret, seg: a.seg, boss: last ? o.boss || null : null, cleared: !(last && endKind === 'sanctuary'),
          reward: last ? (endKind === 'potion' ? 'potion' : endKind === 'fake' ? null : undefined) : undefined, hidden: last && END[endKind].type === 'pocket' });
        link(prev, r, { breakable: !!o.secret && i === 0, hidden: r.hidden });
        prev = r; made.push(r);
      });
      return made;
    }
    return null;
  };
  let failed = false;
  ch.areas.forEach((area, ai) => {
    let anchors = mainRooms.filter(r => r.ai === ai && (r.type === 'combat' || r.type === 'start' || r.type === 'village'));
    if (!anchors.length) anchors = mainRooms.filter(r => r.ai === ai && r.type !== 'boss');
    for (const b of area.branches || []) {
      const [kind, arg] = b.split(':');
      let got;
      if (kind === 'hidden') got = grow(anchors, 'sanctuary', { len: [2, 3], dir: area.hiddenDir || 'down', secret: true, boss: arg }) || grow(anchors, 'sanctuary', { len: [1, 2], secret: true, boss: arg });
      else if (kind === 'tm') got = grow(anchors, 'tm', { len: [1, 2] }) || grow(anchors, 'tm', { len: [0, 0] });
      else got = grow(anchors, kind, { len: [0, 1] });
      if (!got && kind === 'hidden') failed = true;
    }
  });
  // 최소 보장: 상처약 굴 1 · 막다른 굴 2
  const anyAnchors = mainRooms.filter(r => r.type === 'combat' || r.type === 'start');
  for (let k = 0; k < 20 && rooms.filter(r => r.reward === 'potion').length < 1; k++) grow(anyAnchors, 'potion', { len: [0, 1] });
  for (let k = 0; k < 30 && rooms.filter(r => r.type === 'pocket' && r.reward === null).length < 2; k++) grow(anyAnchors, 'fake', { len: [0, 1] });
  if ((failed || rooms.filter(r => r.reward === 'potion').length < 1 || rooms.filter(r => r.type === 'pocket' && r.reward === null).length < 2) && retry < 20) return buildChapter(ch, ci, retry + 1);

  // ---- 갈림길 고리: 같은 구간의 본길 방 A 에서 위나 아래로 돌아 뒤쪽 본길 방 B 로 다시 이어지는 다른 길 (빈칸 BFS, 7칸까지) ----
  const roundabout = (A, B) => {
    const startCells = [], goal = new Set();
    for (let x = A.gx; x < A.gx + A.gw; x++) for (const y of [A.gy - 1, A.gy + A.gh]) if (free(x, y, 1, 1)) startCells.push([x, y]);
    for (let x = B.gx; x < B.gx + B.gw; x++) for (const y of [B.gy - 1, B.gy + B.gh]) goal.add(ck(x, y));
    for (let y = B.gy; y < B.gy + B.gh; y++) goal.add(ck(B.gx - 1, y));
    const prev = new Map(), q = [];
    for (const c of shuffle(startCells)) { prev.set(ck(...c), null); q.push([...c, 0]); }
    while (q.length) {
      const [x, y, dist] = q.shift(), key = ck(x, y);
      if (goal.has(key) && dist >= 1) {
        const path = []; let k = key;
        while (k) { path.unshift(k.split(',').map(Number)); k = prev.get(k); }
        return path;
      }
      if (dist >= 7) continue;
      for (const [dx, dy] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])) {
        const nx = x + dx, ny = y + dy, nk = ck(nx, ny);
        if (prev.has(nk) || !free(nx, ny, 1, 1)) continue;
        prev.set(nk, key); q.push([nx, ny, dist + 1]);
      }
    }
    return null;
  };
  for (let n = 0, tries = 0; n < 3 + ch.areas.length && tries < 40; tries++) {
    const i = ri(0, mainRooms.length - 3), j = i + ri(2, 4), A = mainRooms[i], B = mainRooms[j];
    if (!B || A.seg !== B.seg || [A, B].some(r => r.type === 'boss' || r.type === 'mini')) continue;
    const path = roundabout(A, B);
    if (!path) continue;
    let prevRoom = A;
    for (const [x, y] of path) {
      const r = place({ gx: x, gy: y, gw: 1, gh: 1, kind: 'bc', type: 'combat', ai: A.ai, branch: true, loop: true, seg: A.seg });
      link(prevRoom, r); prevRoom = r;
    }
    link(prevRoom, B);
    n++;
  }

  // ---- 지름길 고리: 같은 구간에서 맞닿은 방끼리 가끔 문을 더 뚫는다 ----
  const loopable = r => !r.secret && r.type !== 'pocket' && r.type !== 'boss' && r.type !== 'mini' && r.type !== 'sanctuary';
  const pairs = new Map();
  for (const [k, r] of occ) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [0, 1]]) { const o = occ.get(ck(x + dx, y + dy)); if (o && o !== r) pairs.set(Math.min(r.id, o.id) + '-' + Math.max(r.id, o.id), [r, o]); }
  }
  for (const [a, b] of pairs.values()) if (!a.links.has(b.id) && loopable(a) && loopable(b) && a.seg === b.seg && Math.random() < .35) link(a, b);

  // ================= ② 격자 → 타일 =================
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) { minX = Math.min(minX, r.gx); minY = Math.min(minY, r.gy); maxX = Math.max(maxX, r.gx + r.gw); maxY = Math.max(maxY, r.gy + r.gh); }
  for (const r of rooms) { r.gx -= minX; r.gy -= minY; }
  for (const d of doors) { if (d.dir === 'h') d.row -= minY; else d.col -= minX; }   // 문 위치도 같이 옮긴다
  const ncx = maxX - minX, ncy = maxY - minY, cols = ncx * CW, rows = ncy * CH;
  const cellRoom = new Map();
  for (const r of rooms) for (let y = r.gy; y < r.gy + r.gh; y++) for (let x = r.gx; x < r.gx + r.gw; x++) cellRoom.set(ck(x, y), r);
  const grid = Array.from({ length: rows }, () => new Array(cols).fill('S'));
  const surfaceRow = mainRooms[0].gy;
  for (const r of rooms) {
    r.X0 = r.gx * CW; r.X1 = r.X0 + r.gw * CW; r.Y0 = r.gy * CH; r.Y1 = r.Y0 + r.gh * CH;
    r.tx0 = r.X0 + WALL; r.tx1 = r.X1 - WALL; r.ty0 = r.Y0 + WALL; r.F = r.Y1 - GROUND;
    r.left = r.tx0 * TILE; r.right = r.tx1 * TILE; r.top = r.ty0 * TILE; r.bottom = r.F * TILE;
    r.cx = (r.left + r.right) / 2; r.under = r.gy > surfaceRow;
    r.area = ch.areas[r.ai].name;
    for (let y = r.ty0; y < r.F; y++) for (let x = r.tx0; x < r.tx1; x++) grid[y][x] = '.';
  }

  // ---- 방 안 지형 (예전 일자 맵의 지형 덩어리를 방마다 그 방 바닥 기준으로) ----
  const props = [], chests = [], spawns = [], marks = [], potions = [], hubs = [];
  let L = null, taken = new Set(), terrain = DEFAULT_TERRAIN, propW = DEFAULT_PROPS;
  const style = { burnt: false, ruined: false };
  const setP = (x, y, w, chr = 'P') => { for (let i = 0; i < w; i++) if (grid[y] && grid[y][x + i] === '.') grid[y][x + i] = chr; };
  const block = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (grid[y + j] && grid[y + j][x + i] !== undefined) grid[y + j][x + i] = 'S'; };
  const setGround = (x, top) => { for (let y = Math.min(top, L.F); y <= L.bottom; y++) grid[y][x] = y >= top ? 'S' : '.'; };
  const groundTop = x => { let y = L.top; while (y <= L.bottom && grid[y][x] !== 'S') y++; return y; };
  const flatAt = (x, w) => { const g = groundTop(x); for (let i = 1; i < w; i++) if (groundTop(x + i) !== g) return -1; return g; };
  const freeCol = (x, w) => { for (let i = -1; i <= w; i++) if (taken.has(x + i)) return false; return true; };
  const take = (x, w) => { for (let i = 0; i < w; i++) taken.add(x + i); };
  const addProp = (p, w = 1) => { take(p.x, w); props.push(p); };
  const house = (hx, g, w, floors, side, variant, kind = 'house') => {
    const top = g - 3 * floors;
    for (let k = 1; k <= floors; k++) {
      const y = g - 3 * k, outer = k === floors;
      if (side > 0) setP(hx + w + (outer ? 1 : -1), y, outer ? 2 : 4, 'H');
      else setP(hx - 3, y, outer ? 2 : 4, 'H');
    }
    setP(hx + 2, top - 2, w - 4, 'H');
    addProp({ kind, x: hx, g, w, floors, side, variant, burnt: style.burnt, ruined: style.ruined }, w);
    take(hx - 3, 3); take(hx + w, 3);
  };
  const room = () => L.room;
  const FEATURES = {
    terrace(sx, sw) {
      const H = Math.min(ri(4, 6), L.F - L.top - 6), prof = [];
      let h = 0;
      while (prof.length < sw && h < H) { h = Math.min(H, h + 2); for (let k = ri(2, 4); k > 0 && prof.length < sw; k--) prof.push(h); }
      for (let k = ri(3, 6); k > 0 && prof.length < sw; k--) prof.push(H);
      while (prof.length < sw) { h = Math.max(0, h - 2); for (let k = ri(2, 4); k > 0 && prof.length < sw; k--) prof.push(h); }
      prof.forEach((v, i) => setGround(sx + i, L.F - Math.min(v, 2 * (((sw - 1 - i) >> 1) + 1))));
    },
    pit(sx, sw) {
      const pw = ri(5, Math.min(9, sw - 4)), px = sx + ri(2, sw - pw - 2), D = ri(3, 4);
      for (let i = 0; i < pw; i++) setGround(px + i, L.F + D);
      setGround(px + (Math.random() < .5 ? 0 : pw - 2), L.F + D - 2); setGround(px + (Math.random() < .5 ? 1 : pw - 1), L.F + D - 2);
      if (Math.random() < .55) setP(px - 1, L.F - 2, pw + 2);
      take(px, pw);
    },
    island(sx, sw) {
      const iw = ri(6, Math.min(10, sw - 4)), th = 3, top = L.F - ri(6, Math.min(8, L.F - L.top - 3)), ix = sx + ri(2, Math.max(2, sw - iw - 2));
      for (let j = 0; j < th; j++) { const cut = j === 0 ? 0 : Math.min((iw >> 1) - 1, j + (Math.random() < .5 ? 0 : 1)); block(ix + cut, top + j, iw - cut * 2, 1); }
      const left = Math.random() < .5;
      setP(left ? ix - 3 : ix + iw, L.F - 3, 3);
      if (Math.random() < .5) props.push({ kind: Math.random() < .5 ? 'crate' : 'statue', x: ix + (iw >> 1) - 1, g: top });
    },
    ziggurat(sx, sw) {
      const Lv = ri(2, 3), bw = Math.min(sw - 2, 4 * Lv + ri(2, 4)), bx = sx + ((sw - bw) >> 1);
      for (let l = 0; l < Lv; l++) block(bx + 2 * l, L.F - 2 * (l + 1), bw - 4 * l, 2);
      const tw = bw - 4 * (Lv - 1), gx = bx + 2 * (Lv - 1);
      if (tw >= 3 && Math.random() < .7) props.push({ kind: 'statue', x: gx + (tw >> 1) - 1, g: L.F - 2 * Lv });
      take(bx, bw);
    },
    bridge(sx, sw) {
      const H = ri(3, 4), tw = 3, gap = Math.max(4, Math.min(sw - 2 * tw - 4, ri(6, 9))), lx = sx + ((sw - (2 * tw + gap)) >> 1), rx = lx + tw + gap;
      block(lx, L.F - H, tw, H); block(rx, L.F - H, tw, H);
      block(lx - 2, L.F - 2, 2, 2); block(rx + tw, L.F - 2, 2, 2);
      for (let i = 0; i < gap; i++) setGround(lx + tw + i, L.F + 3);
      setP(lx + tw, L.F - H, gap);
      take(lx - 2, 2 * tw + gap + 4);
    },
    house(sx, sw) {
      const w = ri(8, 10), floors = 2, side = Math.random() < .5 ? 1 : -1, hx = sx + ((sw - w) >> 1);
      for (let i = -3; i < w + 3; i++) setGround(hx + i, L.F);
      house(hx, L.F, w, floors, side, ri(0, 3));
    },
    tiers(sx, sw) {
      const cx = sx + (sw >> 1), floors = Math.min(ri(2, 4), Math.floor((L.F - L.top - 3) / 3));
      for (let l = 1; l <= floors; l++) { const pw = ri(3, 6); setP(cx + (l % 2 ? 1 : -1) * ri(0, 3) - (pw >> 1), L.F - 3 * l, pw); }
    },
    flat(sx, sw) { if (Math.random() < .6) setP(sx + ri(1, Math.max(1, sw - 6)), L.F - 3, ri(3, 5)); }
  };
  const fillTerrain = (sx, end, weights) => {
    let prev = null;
    while (end - sx >= 12) {
      const sw = Math.min(end - sx, ri(13, 18));
      let f = pickWeighted(weights);
      if (f === prev) f = pickWeighted(weights);
      FEATURES[f](sx, sw);
      prev = f; sx += sw;
    }
  };
  const stalactites = (sx, ex, n) => {
    for (let k = 0; k < n; k++) {
      const w = ri(2, 4), x = ri(sx, Math.max(sx, ex - w)), len = ri(1, 3);
      for (let j = 0; j < len; j++) { const shrink = Math.floor(j * w / (len + 1)); for (let i = shrink >> 1; i < w - Math.ceil(shrink / 2); i++) grid[L.top + j][x + i] = 'S'; }
    }
  };
  const decorate = (sx, ex, every, crates = [3, 5]) => {
    for (let x = sx + ri(1, 4); x < ex - 3; x += ri(every[0], every[1])) {
      const kind = pickWeighted(propW), w = kind === 'fence' ? ri(3, 5) : kind === 'tree' ? 3 : kind === 'statue' || kind === 'tallgrass' ? 2 : 1;
      const g = flatAt(x, w);
      if (g < L.F - 8 || g > L.F + 1 || !freeCol(x, w)) continue;
      addProp({ kind, x, g, w, variant: ri(0, 3) }, w);
    }
    for (let k = ri(crates[0], crates[1]); k > 0; k--) {
      const x = ri(sx, ex - 2), n = ri(1, 3), g = flatAt(x, n);
      if (g < L.F - 8 || g > L.F + 1 || !freeCol(x, n)) continue;
      for (let i = 0; i < n; i++) props.push({ kind: 'crate', x: x + i, g });
      if (n >= 2 && Math.random() < .5) props.push({ kind: 'crate', x: x + (n === 3 ? 1 : 0), g: g - 1, stacked: true });
      take(x, n);
    }
  };
  // 키 큰 방: 바닥부터 천장 근처까지 3칸마다 좌우로 번갈아 놓인 발판
  const zigzag = r => {
    const iw = r.tx1 - r.tx0, pw = Math.max(8, Math.round(iw * .55));
    for (let y = r.F - 3, k = 0; y >= r.ty0 + 2; y -= 3, k++) setP(k % 2 ? r.tx1 - pw : r.tx0, y, pw);
  };
  const loreLeft = ch.areas.map(a => [...(a.lore || [])]);
  const lore = (ai, x, g) => { const text = loreLeft[ai].shift(); if (text && freeCol(x, 1)) addProp({ kind: 'lore', x, g, text }, 1); };
  const altar = (ax, F) => { block(ax - 2, F - 1, 5, 1); block(ax - 1, F - 2, 3, 1); return F - 2; };
  const coverCells = new Map();   // 방 id → 흙 덮개 칸 (상처약·페이크 굴)

  for (const r of rooms) {
    const area = ch.areas[r.ai];
    terrain = area.terrain || ch.terrain || DEFAULT_TERRAIN;
    propW = area.props || ch.props || DEFAULT_PROPS;
    L = { F: r.F, top: r.ty0, bottom: r.Y1 - 1, room: r };
    taken = new Set();
    style.burnt = !!area.ash; style.ruined = r.type === 'village' || !!area.ash;
    const x0 = r.tx0, x1 = r.tx1, tall = r.gh >= 2;
    if (r.type === 'combat' || r.type === 'start') {
      if (!tall) {
        if (r.kind === 'bridge') { FEATURES.bridge(x0 + 6, Math.min(30, x1 - x0 - 12)); fillTerrain(x0 + 40, x1 - 6, { pit: 2, island: 1, flat: 1 }); }
        else if (r.type === 'combat') fillTerrain(x0 + 6, x1 - 6, terrain);
        stalactites(x0 + 3, x1 - 3, ri(...(ch.stalactites || [0, 2])));
        decorate(x0 + 3, x1 - 3, area.forest ? [4, 7] : [6, 10]);
      } else {
        if (r.kind === 'plaza') { fillTerrain(x0 + 6, x1 - 6, terrain); FEATURES.island(x0 + ((x1 - x0) >> 1) - 9, 18); }
        zigzag(r);
        stalactites(x0 + 3, x1 - 3, ri(1, 3));
        decorate(x0 + 3, x1 - 3, [8, 12], [1, 3]);
      }
      if (r.type === 'start') { addProp({ kind: 'lamp', x: x0 + 3, g: r.F }); lore(r.ai, x0 + 6, r.F); if (area.ash) addProp({ kind: 'lab', x: x0 + 12, g: r.F, w: 13 }, 13); }
      else if (Math.random() < .5) lore(r.ai, x0 + 2 + ri(0, 3), r.F);
    } else if (r.type === 'village') {
      // 시내: 가로등 · 표지판 · 집 · 포켓몬센터 · 자판기 · 아머까오 정거장 · 집 (적 없음)
      const b = x0 + 1, g = r.F;
      for (let x = x0; x < x1; x++) setGround(x, g);
      addProp({ kind: 'lamp', x: b, g, warm: true });
      addProp({ kind: 'sign', x: b + 2, g }, 2);
      house(b + 8, g, 9, 2, -1, 0, 'house');
      addProp({ kind: 'lamp', x: b + 19, g, warm: true });
      addProp({ kind: 'center', x: b + 21, g, w: 14 }, 14);
      addProp({ kind: 'vending', x: b + 36, g }, 2);
      addProp({ kind: 'corvi', x: b + 40, g, w: 6 }, 6);
      addProp({ kind: 'lamp', x: b + 47, g, warm: true });
      house(b + 49, g, 7, 2, 1, 2, 'house');
      lore(r.ai, b + 5, g);
      r.village = { fireflies: [x0 + 1, x1 - 1], center: b + 28 };
      marks.push({ kind: 'center', x: b + 28, y: g, room: r }, { kind: 'corvi', x: b + 43, y: g, room: r });
      hubs.push({ room: r, name: r.city || area.name, x: (b + 28) * TILE + 8, y: g * TILE });
    } else if (r.type === 'mini' || r.type === 'boss' || r.type === 'sanctuary') {
      // 아레나: 평평한 바닥 + 양옆·가운데 발판 (2층 높이면 위로 더)
      const mid = (x0 + x1) >> 1, w = x1 - x0;
      setP(x0 + 4, r.F - 3, 7); setP(x1 - 11, r.F - 3, 7); setP(mid - 5, r.F - 6, 10);
      if (w > 40) { setP(x0 + 10, r.F - 9, 6); setP(x1 - 16, r.F - 9, 6); }
      if (tall) for (let y = r.F - 12, k = 0; y >= r.ty0 + 3; y -= 4, k++) setP(k % 2 ? x0 + 4 : x1 - 12, y, 8);
      if (area.gym || r.type === 'boss') for (const [x, h] of [[x0 + 1, 8], [x1 - 3, 9]]) addProp({ kind: 'pillar', x, g: r.F, h: Math.min(h, r.F - r.ty0 - 2), variant: ri(0, 2) }, 2);
      marks.push({ kind: r.type === 'boss' ? 'boss' : r.type === 'mini' ? 'mini' : 'hidden', x: mid, y: r.F, room: r });
    } else if (r.type === 'tm') {
      const ax = (x0 + x1) >> 1, g = altar(ax, r.F);
      props.push({ kind: 'tm', x: ax, g });
      marks.push({ kind: 'tm', x: ax, y: g, room: r });
      setP(x0 + 3, r.F - 4, 4); setP(x1 - 7, r.F - 4, 4);
    } else if (r.type === 'treasure') {
      const ax = (x0 + x1) >> 1, g = altar(ax, r.F);
      chests.push({ x: ax * TILE + 8, y: g * TILE, treasure: true });
      marks.push({ kind: 'chest', x: ax, y: g, room: r });
      stalactites(x0 + 3, x1 - 3, ri(0, 2));
    } else if (r.type === 'pocket') {
      // 막다른 굴: 상처약이 있거나 아무것도 없다(페이크). 들어가기 전엔 흙 덮개
      r.end = Math.random() < .5 ? x0 + 3 : x1 - 4;
      if (r.reward === 'potion') { potions.push({ x: r.end * TILE + 8, y: r.F * TILE, room: r }); marks.push({ kind: 'potion', x: r.end, y: r.F, room: r }); }
      else if (Math.random() < .5) props.push({ kind: 'lore', x: r.end, g: r.F, text: pick(FAKE_LORE) });
      stalactites(x0 + 3, x1 - 3, ri(1, 3));
    }
    if (tall && r.type !== 'combat' && r.type !== 'start' && r.type !== 'mini' && r.type !== 'boss' && r.type !== 'sanctuary') zigzag(r);   // 아레나는 자기 발판만 (너무 빽빽하지 않게)
    // 벽 횃불
    if (r.type !== 'village') for (let tx = x0 + 4; tx < x1 - 2; tx += ri(9, 12)) {
      const ty = Math.max(r.ty0 + 1, r.F - 8);
      if (grid[ty][tx] === '.' && !taken.has(tx)) r.torches.push({ x: tx * TILE + 8, y: ty * TILE + 6 });
    }
  }

  // ---- 문 뚫기 (지형을 다 깐 뒤에 — 문 앞은 늘 비워 둔다) ----
  const ladderUnder = (D, cx0, by) => { for (let y = by + 3, k = 0; y <= D.F - 2; y += 3, k++) setP(k % 2 ? cx0 + 1 : cx0 - 2, y, 5); };
  for (const d of doors) {
    if (d.dir === 'h') {
      const bx = d.R.gx * CW, Fr = (d.row + 1) * CH - GROUND, fill = d.breakable ? 'B' : '.';
      for (let y = Fr - 5; y < Fr; y++) for (let x = bx - WALL; x < bx + WALL; x++) grid[y][x] = fill;
      for (const [r, side] of [[d.L, 1], [d.R, -1]]) {
        const ex0 = side > 0 ? r.tx1 - 4 : r.tx0, ex1 = side > 0 ? r.tx1 - 1 : r.tx0 + 3;   // 문 앞 4칸
        for (let y = Fr - 5; y < Fr; y++) for (let x = ex0; x <= ex1; x++) grid[y][x] = '.';
        if (r.F !== Fr) { const lx0 = side > 0 ? r.tx1 - 7 : r.tx0, lx1 = side > 0 ? r.tx1 - 1 : r.tx0 + 6; for (let y = Fr; y < Fr + 2; y++) for (let x = lx0; x <= lx1; x++) grid[y][x] = 'S'; }
        else for (let x = ex0; x <= ex1; x++) for (let y = Fr; y < Fr + 2; y++) grid[y][x] = 'S';
      }
      d.rect = { x: (bx - WALL) * TILE, y: (Fr - 5) * TILE, w: 2 * WALL * TILE, h: 5 * TILE };
      d.cells = []; for (let y = Fr - 5; y < Fr; y++) for (let x = bx - WALL; x < bx + WALL; x++) d.cells.push([x, y]);
      d.mx = bx; d.my = Fr - 2.5;
    } else {
      const by = d.D.gy * CH, FU = by - GROUND, cx0 = Math.max(d.U.tx0 + 3, Math.max(d.D.tx0 + 3, Math.min(d.col * CW + (CW >> 1) - 2 + ri(-5, 5), Math.min(d.U.tx1, d.D.tx1) - 7)));
      for (let x = cx0 - 2; x < cx0 + 6; x++) for (let y = FU - 4; y < FU; y++) if (y >= d.U.ty0) grid[y][x] = '.';   // 위 방: 구멍 둘레 비우기
      for (let x = cx0 - 2; x < cx0 + 6; x++) grid[FU][x] = 'S';
      for (let y = FU; y < by + WALL; y++) for (let x = cx0; x < cx0 + 4; x++) grid[y][x] = '.';
      for (let x = cx0; x < cx0 + 4; x++) grid[FU][x] = d.breakable ? 'B' : 'P';   // 철창 뚜껑 (↓ + Space) — 비밀 샛길이면 부서지는 바닥
      for (let y = FU + 3; y < by + WALL; y += 3) for (let x = cx0; x < cx0 + 4; x++) grid[y][x] = 'P';
      ladderUnder(d.D, cx0, by);
      d.rectU = { x: cx0 * TILE, y: (FU - 1) * TILE, w: 4 * TILE, h: TILE };            // 위 방 쪽 관문
      d.rectD = { x: cx0 * TILE, y: (by + WALL) * TILE, w: 4 * TILE, h: TILE };          // 아래 방 쪽 관문
      d.cells = []; for (let y = FU; y < by + WALL; y++) for (let x = cx0; x < cx0 + 4; x++) d.cells.push([x, y]);
      d.mx = cx0 + 2; d.my = by;
      d.cap = cx0;
    }
  }

  // ---- 흙 덮개 (상처약·페이크 굴: 방 안 + 들어오는 문 칸) ----
  const sides = [];
  for (const r of rooms) {
    if (r.type !== 'pocket') continue;
    const cells = [];
    for (let y = r.ty0; y < r.F; y++) for (let x = r.tx0; x < r.tx1; x++) if (grid[y][x] !== 'S') cells.push([x, y]);
    for (const d of r.doors) for (const [x, y] of d.cells) if (grid[y][x] !== 'S' && grid[y][x] !== 'P') cells.push([x, y]);
    sides.push({ hidden: true, room: r, cells, reward: r.reward, end: r.end, revealed: false, area: { x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top } });
  }

  // ---- 부서지는 벽 (히든 성소로 가는 첫 문) ----
  const breakables = doors.filter(d => d.breakable).map(d => ({ door: d, cells: d.cells.filter(([x, y]) => grid[y][x] === 'B'), hp: 3, broken: false }));
  for (const b of breakables) {
    const xs = b.cells.map(c => c[0]), ys = b.cells.map(c => c[1]);
    b.rect = { x: Math.min(...xs) * TILE, y: Math.min(...ys) * TILE, w: (Math.max(...xs) - Math.min(...xs) + 1) * TILE, h: (Math.max(...ys) - Math.min(...ys) + 1) * TILE };
  }

  // ---- 적 자리: 전투방 바닥·발판 위 (방 넓이 × 챕터) ----
  for (const r of rooms) {
    if (r.type !== 'combat') continue;
    const n = Math.round(r.gw * r.gh * (2.6 + ci * .5) * (r.branch ? .7 : 1));
    for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
      const x = ri(r.tx0 + 3, r.tx1 - 4), y0 = ri(r.ty0 + 1, r.F - 2);
      if (r === mainRooms[0] && x < r.tx0 + 14) continue;   // 입구 바로 앞은 비운다
      let y = y0; while (y < r.F && grid[y][x] === '.') y++;
      if (y <= y0 || (grid[y][x] !== 'S' && grid[y][x] !== 'P') || grid[y - 1][x] !== '.' || grid[y - 2][x] !== '.') continue;
      spawns.push({ x: x * TILE + 8, y: y * TILE, room: r, spawned: false });
      k++;
    }
  }

  // ---- 타일 번호 (트인 방향마다 이끼·그림자·테두리) ----
  const S = (x, y) => y < 0 || y >= rows || x < 0 || x >= cols || grid[y][x] === 'S' || grid[y][x] === 'B';
  const tileOf = (x, y) => {
    const c = grid[y][x];
    if (c === 'P') return T.PLAT;
    if (c === 'H') return T.HPLAT;
    if (c !== 'S' && c !== 'B') return -1;
    return T.SOLID + (!S(x, y - 1) ? 1 : 0) + (!S(x, y + 1) ? 2 : 0) + (!S(x - 1, y) ? 4 : 0) + (!S(x + 1, y) ? 8 : 0);
  };
  const data = grid.map((row, y) => row.map((c, x) => tileOf(x, y)));

  const start = mainRooms[0];
  return {
    ci, chapter: ch, data, grid, cols, rows, width: cols * TILE, height: rows * TILE, ncx, ncy, cellRoom,
    rooms, doors, sides, breakables, props, chests, spawns, marks, potions, hubs, tileOf,
    start: { x: (start.tx0 + 5) * TILE, y: start.F * TILE - 12, room: start }, surfaceRow
  };
}

// 칸(x, y)이 들어 있는 방
export const roomAtCell = (level, x, y) => level.cellRoom.get(Math.floor(x / CW) + ',' + Math.floor(y / CH)) || null;
// 월드 픽셀 좌표가 들어 있는 방
export const roomAt = (level, px, py) => roomAtCell(level, Math.floor(px / TILE), Math.floor(py / TILE));
