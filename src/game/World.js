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
import { reach, PAD_TILES } from './Reach.js';
import { LAB, TOWNS } from '../data/npcs.js';

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
const SHAPE = { start: [1, 1], wide: [2, 1], plaza: [2, 2], tower: [1, 3], abyss: [1, 3], stairs: [1, 2], bridge: [2, 1], hub: [2, 1], mini: [2, 1], boss: [2, 1], sanct: [2, 1] };
const C_SHAPES = [[1, 1], [1, 1], [1, 1], [2, 1], [1, 2]];
export const BIG_ARENA = new Set(['ho-oh', 'rayquaza', 'eternatus', 'latias', 'giratina', 'mewtwo', 'darkrai']);   // 날아다니는 보스는 2×2 아레나
const END = { tm: { shape: [1, 1], type: 'tm' }, treasure: { shape: [1, 1], type: 'treasure' }, potion: { shape: [1, 1], type: 'pocket' }, fake: { shape: [1, 1], type: 'pocket' }, sanctuary: { shape: [2, 1], type: 'sanctuary' } };

// 아레나: 평평한 바닥 + 양옆·가운데 발판 (2층 높이면 위로 더) — 테스트룸(game/TestRoom.js)도 같은 배치를 쓴다
export function arenaPlatforms(r, tall, setP) {
  const x0 = r.tx0, x1 = r.tx1, mid = (x0 + x1) >> 1, w = x1 - x0;
  setP(x0 + 4, r.F - 3, 7); setP(x1 - 11, r.F - 3, 7); setP(mid - 5, r.F - 6, 10);
  if (w > 40) { setP(x0 + 10, r.F - 9, 6); setP(x1 - 16, r.F - 9, 6); }
  if (tall) for (let y = r.F - 12, k = 0; y >= r.ty0 + 3; y -= 4, k++) setP(k % 2 ? x0 + 4 : x1 - 12, y, 8);
  // 뮤츠(관동 최종 보스)는 높이 떠다녀서 가운데 위쪽에 디딤 발판 3개를 더 깐다 (양옆 사다리 발판 사이를 잇는 높이)
  if (tall && r.boss === 'mewtwo') {
    const top = r.ty0 + 3, span = r.F - top;
    setP(mid - 4, r.F - Math.round(span * .42), 8);
    setP(x0 + Math.round(w * .3) - 3, r.F - Math.round(span * .66), 6);
    setP(x0 + Math.round(w * .7) - 3, r.F - Math.round(span * .66), 6);
  }
}

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
  const typeOf = kind => kind === 'start' ? 'start' : kind === 'hub' ? 'village' : kind === 'mini' ? 'mini' : kind === 'boss' ? 'boss' : kind === 'sanct' ? 'sanctuary' : 'combat';

  // ---- 본길 ----
  let cur = null, exitRow = 0, seg = 0;
  ch.areas.forEach((area, ai) => area.plan.forEach(tok0 => {
    const up = tok0.endsWith('^'), tok = up ? tok0.slice(0, -1) : tok0, [kind, arg] = tok.split(':');
    let [w, h] = kind === 'c' ? pick(C_SHAPES) : SHAPE[kind];
    if ((kind === 'boss' || kind === 'mini' || kind === 'sanct') && BIG_ARENA.has(arg)) [w, h] = [2, 2];
    if (ci === 0 && !cur) [w, h] = [2, 1];   // 오박사 연구소는 넓게 (박사 · 연구원 둘 · 튜토리얼 철창)
    let gx, gy;
    if (!cur) { gx = 0; gy = 0; }
    else if (up) { gx = cur.gx; gy = cur.gy - h; }
    else {
      gx = cur.gx + cur.gw;
      gy = kind === 'tower' || kind === 'stairs' ? exitRow - (h - 1) : kind === 'abyss' ? exitRow : exitRow - ri(0, h - 1);
    }
    for (let k = 0; k < 6 && !free(gx, gy, w, h); k++) gy -= 1;   // 드물게 겹치면 위로 비켜 놓는다
    const r = place({ gx, gy, gw: w, gh: h, kind, type: typeOf(kind), ai, boss: arg || null, main: true, seg, cleared: !(kind === 'boss' || kind === 'mini' || kind === 'sanct'), hub: kind === 'hub', city: kind === 'hub' ? area.city : null, lab: ci === 0 && !cur });
    // 오박사 연구소는 닫힌 실내: 바로 옆 태초마을과 벽으로 나뉘고, 연구소 안 출입문 ↔ 마을의 연구소 건물 문으로 오간다 (GameScene.useDoor)
    if (cur && cur.lab) r.oak = true;
    else if (cur) link(cur, r, up ? {} : { row: exitRow });
    exitRow = kind === 'tower' || kind === 'stairs' || up ? r.gy : kind === 'abyss' ? r.gy + h - 1 : r.gy + ri(0, h - 1);
    if (kind === 'mini') seg++;
    cur = r;
  }));
  const mainRooms = rooms.slice();
  // 게임이 시작되는 곳 = 오박사 연구소 안 (관동 첫 방 · lab). 샛길 · 고리 · 지름길은 연구소에 붙지 않는다 (지하의 튜토리얼 기술머신만)

  // ---- 튜토리얼 기술머신: 첫 챕터 입구 바로 아래 막다른 굴에 100% 확정 ----
  //  입구 바닥의 철창으로 내려가면 곧바로 기술머신 캡슐 — '막다른 길·샛길 끝을 탐험하면 새 기술·카드를 얻는다'를 시작하자마자 배운다
  if (ci === 0) {
    const s0 = mainRooms[0];
    if (free(s0.gx, s0.gy + 1, 1, 1)) {
      const r = place({ gx: s0.gx, gy: s0.gy + 1, gw: 1, gh: 1, kind: 'tm', type: 'tm', ai: s0.ai, branch: true, seg: 0, tutorial: true });
      link(s0, r, { col: s0.gx });
    }
  }

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
    let anchors = mainRooms.filter(r => r.ai === ai && !r.lab && (r.type === 'combat' || r.type === 'start' || r.type === 'village'));
    if (!anchors.length) anchors = mainRooms.filter(r => r.ai === ai && !r.lab && r.type !== 'boss');
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
  const anyAnchors = mainRooms.filter(r => !r.lab && (r.type === 'combat' || r.type === 'start'));
  for (let k = 0; k < 20 && rooms.filter(r => r.reward === 'potion').length < 1; k++) grow(anyAnchors, 'potion', { len: [0, 1] });
  for (let k = 0; k < 30 && rooms.filter(r => r.type === 'pocket' && r.reward === null).length < 2; k++) grow(anyAnchors, 'fake', { len: [0, 1] });
  if ((failed || rooms.filter(r => r.reward === 'potion').length < 1 || rooms.filter(r => r.type === 'pocket' && r.reward === null).length < 2) && retry < 20) return buildChapter(ch, ci, retry + 1);
  // 무보상 막다른 길 없애기: 비어 있던 굴은 모두 엘리트 수문장이 지키는 굴이 된다 (처치하면 이상한사탕 100% · 도구 25%)
  for (const r of rooms) if (r.type === 'pocket' && r.reward === null) r.reward = 'elite';

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
    if (!B || A.seg !== B.seg || A.lab || [A, B].some(r => r.type === 'boss' || r.type === 'mini')) continue;
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
  const loopable = r => !r.secret && !r.lab && r.type !== 'pocket' && r.type !== 'boss' && r.type !== 'mini' && r.type !== 'sanctuary';
  const pairs = new Map();
  for (const [k, r] of occ) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [0, 1]]) { const o = occ.get(ck(x + dx, y + dy)); if (o && o !== r) pairs.set(Math.min(r.id, o.id) + '-' + Math.max(r.id, o.id), [r, o]); }
  }
  for (const [a, b] of pairs.values()) if (!a.links.has(b.id) && loopable(a) && loopable(b) && a.seg === b.seg && Math.random() < .35) link(a, b);

  // ---- 침식 깊이 r.depth (0 = 입구의 햇살 비치는 숲 · 1 = 보스방 앞 심연): 본길 진행도 + 보스방까지의 방 거리 ----
  //  Props(나무: 푸릇푸릇 → 시들어 검붉게 · 풀) · GameScene(햇빛 줄기 · 주변광 · 색 보정 · 안개 · 어두운 비네팅)이 쓴다
  {
    const byIdD = new Map(rooms.map(r => [r.id, r])), n = mainRooms.length;
    mainRooms.forEach((r, i) => { r.prog = n > 1 ? i / (n - 1) : 0; });
    const q = mainRooms.slice(), seen = new Set(mainRooms.map(r => r.id));   // 샛길·고리 방은 가장 가까운 본길 방의 진행도
    while (q.length) { const r = q.shift(); for (const id of r.links) if (!seen.has(id)) { seen.add(id); const o = byIdD.get(id); o.prog = r.prog; q.push(o); } }
    const bossD = new Map(), bq = [];
    for (const r of rooms) if (r.type === 'boss' || r.type === 'mini' || r.type === 'sanctuary') { bossD.set(r.id, 0); bq.push(r); }
    while (bq.length) { const r = bq.shift(), d = bossD.get(r.id); for (const id of r.links) if (!bossD.has(id)) { bossD.set(id, d + 1); bq.push(byIdD.get(id)); } }
    for (const r of rooms) {
      const prox = Math.max(0, 1 - (bossD.get(r.id) ?? 9) / 4);
      let c = Math.min(1, (r.prog || 0) * .8 + prox * .55);
      if (r.type === 'village') c *= .45;   // 시내는 결계 안이라 덜 침식
      if (r.ai === 0) c = Math.min(c, .08);   // 지방의 첫 지역(결계 마을 둘레)은 침식이 거의 없다 — 밝은 햇살 · 따뜻한 빛
      if (r === mainRooms[0] || r.tutorial) c = 0;
      r.depth = Math.round(c * 100) / 100;
    }
  }

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
  const phaseCells = [], pads = [];   // 깨어진 세계: 유령 발판 칸 · 차원 도약 수정 (distortionRoom)
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
      setP(lx + tw, L.F - 1, 2); setP(rx - 2, L.F - 1, 2);   // 다리 밑 구덩이(6~7칸)에 빠져도 기어 나오도록 양쪽 기둥 안쪽에 디딤 발판
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
  const stalCells = [];   // 종유석 칸 (길 보장 마무리에서 막힌 틈을 만든 것만 걷어 낸다)
  const stalactites = (sx, ex, n) => {
    for (let k = 0; k < n; k++) {
      const w = ri(2, 4), x = ri(sx, Math.max(sx, ex - w)), len = ri(1, 3);
      for (let j = 0; j < len; j++) {
        const shrink = Math.floor(j * w / (len + 1)), y = L.top + j;
        for (let i = shrink >> 1; i < w - Math.ceil(shrink / 2); i++) {
          let g = y + 1; while (g < L.F && grid[g][x + i] === '.') g++;
          if (g - y - 1 >= 3) { grid[y][x + i] = 'S'; stalCells.push([x + i, y, L.room]); }   // 아래 바위·발판 위로 3칸 틈은 남긴다 (기어야만 지나가는 틈이 생기지 않게)
        }
      }
    }
  };
  const decorate = (sx, ex, every, crates = [3, 5]) => {
    for (let x = sx + ri(1, 4); x < ex - 3; x += ri(every[0], every[1])) {
      const kind = pickWeighted(propW), w = kind === 'fence' ? ri(3, 5) : kind === 'tree' ? 3 : kind === 'statue' || kind === 'tallgrass' || kind === 'pillar' ? 2 : 1;
      const g = flatAt(x, w);
      if (g < L.F - 8 || g > L.F + 1 || !freeCol(x, w)) continue;
      addProp({ kind, x, g, w, variant: ri(0, 3), ...(kind === 'pillar' ? { h: ri(4, 8) } : {}) }, w);   // 돌기둥: 천관산 협곡의 고대 석주
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
  // 깨어진 세계 방 (bg 'distortion'): 반물질 바닥 위로 부유섬 · 유령 발판 · 차원 도약 수정 — 적은 나오지 않는 플랫포밍 구역
  //  유령 발판은 평범한 통과 발판('P') 칸이라 길 보장(Reach)에 그대로 잡힌다 (모습만 다가갈 때 보랏빛 조각이 모여 조립된다 — GameScene.updateDistortion)
  //  차원 도약 수정은 밟거나 치면 중력을 거슬러 높이 솟구친다 — Reach 의 pads (그 자리에선 PAD_TILES 칸까지 오른다)
  //  구간마다 번갈아: 도약 수정 + 바로 옆 9칸 위 높은 부유섬(보물 상자) · 유령 발판 계단(4 · 7칸) + 낮은 부유섬. 키 큰 방은 위층 문까지 유령 발판 사다리
  //  도약 수정은 부유섬 옆에 둔다 (바로 밑이면 섬 밑바닥에 머리를 박는다) — 솟구친 뒤 옆으로 몸을 틀어 섬에 내려앉는다
  const distortionRoom = (r, tall) => {
    const x0 = r.tx0, x1 = r.tx1, W = x1 - x0, before = new Set();
    for (let x = x0; x < x1; x++) setGround(x, r.F);
    for (let y = r.ty0; y < r.F; y++) for (let x = x0; x < x1; x++) if (grid[y][x] === 'P') before.add(x + ',' + y);
    r.islands = [];
    const island = (ix, top, w) => { block(ix, top, w, 2); block(ix + 1, top + 2, w - 2, 1); r.islands.push({ x: ix, y: top, w }); };
    if (tall) zigzag(r);
    const segs = Math.max(1, Math.floor((W - 12) / 22)), sw = Math.floor((W - 12) / segs);
    for (let k = 0; k < segs; k++) {
      const sx = x0 + 6 + k * sw;
      if (k % 2 === 0) {
        const px = sx + ri(1, Math.max(1, sw - 12)), top = Math.max(r.ty0 + 3, r.F - 10);
        pads.push({ x: px, g: r.F, room: r, isl: [px + 3, 8] });
        island(px + 3, top, 8);
        chests.push({ x: (px + 7) * TILE + 8, y: top * TILE, island: true, room: r });
      } else {
        const ax = sx + ri(1, Math.max(1, sw - 16));
        setP(ax, r.F - 4, 4); setP(ax + 5, r.F - 7, 4);
        island(ax + 9, r.F - 9, 6);
      }
    }
    if (tall) {   // 키 큰 방: 가운데 높이에 도약 수정을 하나 더 (아래층 바닥 → 16칸 위 부유섬)
      const px = ((x0 + x1) >> 1) - 5, top = r.F - 16;
      if (top > r.ty0 + 3) { pads.push({ x: px, g: r.F, room: r, isl: [px + 3, 9] }); island(px + 3, top, 9); }
    }
    for (let y = r.ty0; y < r.F; y++) for (let x = x0; x < x1; x++) if (grid[y][x] === 'P' && !before.has(x + ',' + y)) phaseCells.push([x, y, r]);
  };
  const loreLeft = ch.areas.map(a => [...(a.lore || [])]);
  const lore = (ai, x, g) => { const text = loreLeft[ai].shift(); if (text && freeCol(x, 1)) addProp({ kind: 'lore', x, g, text }, 1); };
  const altar = (ax, F) => { block(ax - 2, F - 1, 5, 1); block(ax - 1, F - 2, 3, 1); return F - 2; };
  const altarWide = (ax, F) => { block(ax - 3, F - 1, 7, 1); block(ax - 2, F - 2, 5, 1); return F - 2; };   // 거대 기술머신 캡슐 받침 (5칸)
  const coverCells = new Map();   // 방 id → 흙 덮개 칸 (상처약·페이크 굴)

  for (const r of rooms) {
    const area = ch.areas[r.ai];
    terrain = area.terrain || ch.terrain || DEFAULT_TERRAIN;
    propW = area.props || ch.props || DEFAULT_PROPS;
    L = { F: r.F, top: r.ty0, bottom: r.Y1 - 1, room: r };
    taken = new Set();
    style.burnt = !!area.ash; style.ruined = (r.type === 'village' && r.ai > 0) || !!area.ash;   // 첫 지역 시내는 결계 덕에 멀쩡하다
    const x0 = r.tx0, x1 = r.tx1, tall = r.gh >= 2;
    if (r.lab) {
      // 오박사 연구소 안: 평평한 마룻바닥 + 실내 벽(책장 · 연구 장비 · 창문 · 몬스터볼 책상) — 사람들은 문을 다 뚫은 뒤에 세운다
      for (let x = x0; x < x1; x++) setGround(x, r.F);
      props.push({ kind: 'labroom', x: x0, g: r.F, w: x1 - x0, h: r.F - r.ty0 });
      props.push({ kind: 'labdoor', x: x1 - 5, g: r.F });   // 오른쪽 벽 가까이 출입문 → 마을의 연구소 건물 앞으로
    } else if (area.bg === 'distortion' && r.type === 'combat') {
      distortionRoom(r, tall);
    } else if (r.type === 'combat' || r.type === 'start') {
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
      // 시내: 가로등 · 표지판 · 집 · 포켓몬센터 · 포켓샵(프렌들리숍) · 아머까오 정거장 · 가로등 · 집 (적 없음)
      //  포켓샵은 예전 자판기 자리 — 소품 개수가 같아 예전 진행 저장의 '쓴 소품' 기록이 그대로 맞는다 (RunSave sigOf)
      const b = x0 + 1, g = r.F;
      for (let x = x0; x < x1; x++) setGround(x, g);
      addProp({ kind: 'lamp', x: b, g, warm: true });
      addProp({ kind: 'sign', x: b + 2, g }, 2);
      house(b + 8, g, 9, 2, -1, 0, r.oak ? 'oakhouse' : 'house');   // 태초마을: 맨 왼쪽 집이 오박사 연구소 (문이 정면 · 들어가면 연구소 안)
      if (r.oak) r.oakDoor = b + 8 + 7;   // 문 칸 (집 그림의 문 가운데)
      addProp({ kind: 'lamp', x: b + 19, g, warm: true });
      addProp({ kind: 'center', x: b + 21, g, w: 14 }, 14);
      addProp({ kind: 'mart', x: b + 38, g, w: 6 }, 6);
      addProp({ kind: 'corvi', x: b + 46, g, w: 6 }, 6);
      addProp({ kind: 'lamp', x: b + 53, g, warm: true });
      house(b + 55, g, 5, 2, 1, 2, 'house');
      lore(r.ai, b + 5, g);
      r.village = { fireflies: [x0 + 1, x1 - 1], center: b + 28 };
      marks.push({ kind: 'center', x: b + 28, y: g, room: r }, { kind: 'corvi', x: b + 49, y: g, room: r });
      hubs.push({ room: r, name: r.city || area.name, x: (b + 28) * TILE + 8, y: g * TILE });
    } else if (r.type === 'mini' || r.type === 'boss' || r.type === 'sanctuary') {
      const mid = (x0 + x1) >> 1;
      arenaPlatforms(r, tall, setP);
      if (area.gym || r.type === 'boss') for (const [x, h] of [[x0 + 1, 8], [x1 - 3, 9]]) addProp({ kind: 'pillar', x, g: r.F, h: Math.min(h, r.F - r.ty0 - 2), variant: ri(0, 2) }, 2);
      marks.push({ kind: r.type === 'boss' ? 'boss' : r.type === 'mini' ? 'mini' : 'hidden', x: mid, y: r.F, room: r });
    } else if (r.type === 'tm') {
      const ax = (x0 + x1) >> 1, g = altarWide(ax, r.F);
      props.push({ kind: 'tm', x: ax, g });
      marks.push({ kind: 'tm', x: ax, y: g, room: r });
      setP(x0 + 3, r.F - 4, 4); setP(x1 - 7, r.F - 4, 4);
    } else if (r.type === 'treasure') {
      // 제단 · 상자는 문을 다 뚫은 뒤에 놓는다 (아래 '보물방 제단') — 철창 구멍 · 사다리 자리가 제단을 지워 상자가 떠 있지 않게
      stalactites(x0 + 3, x1 - 3, ri(0, 2));
    } else if (r.type === 'pocket') {
      // 막다른 굴: 상처약이 있거나 아무것도 없다(페이크). 들어가기 전엔 흙 덮개
      r.end = Math.random() < .5 ? x0 + 3 : x1 - 4;
      if (r.reward === 'potion') { potions.push({ x: r.end * TILE + 8, y: r.F * TILE, room: r }); marks.push({ kind: 'potion', x: r.end, y: r.F, room: r }); }
      stalactites(x0 + 3, x1 - 3, ri(1, 3));
    }
    if (tall && r.type !== 'combat' && r.type !== 'start' && r.type !== 'mini' && r.type !== 'boss' && r.type !== 'sanctuary') zigzag(r);   // 아레나는 자기 발판만 (너무 빽빽하지 않게)
    // 벽 횃불
    if (r.type !== 'village' && !r.lab) for (let tx = x0 + 4; tx < x1 - 2; tx += ri(9, 12)) {
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
      const by = d.D.gy * CH, FU = by - GROUND, U = d.U, D = d.D;
      const lo = Math.max(U.tx0, D.tx0) + 3, hi = Math.min(U.tx1, D.tx1) - 7;
      let cx0 = Math.max(U.tx0 + 3, Math.max(D.tx0 + 3, Math.min(d.col * CW + (CW >> 1) - 2 + ri(-5, 5), Math.min(U.tx1, D.tx1) - 7)));
      // 철창 자리 고르기: 위 방 구멍 위로 솟은 땅이 없고 · 아래 방 천장에 종유석이 없는 열을 처음 고른 자리에서 가까운 쪽부터 찾는다
      //  (예전엔 종유석이 통로 바로 밑을 막거나 · 솟은 땅이 구멍을 덮어 들어갈 수 없는 방이 생겼다 — 회색시티 아래 보물방 등)
      //  태초마을의 오박사 연구소 문 앞(±4칸)은 비운다 (사다리 · 철창이 문을 가리지 않게)
      const clean = c => {
        for (const r of [U, D]) if (r.oak && c + 6 > r.oakDoor - 4 && c - 2 <= r.oakDoor + 4) return false;
        for (let x = c - 2; x < c + 6; x++) { for (let y = FU - 6; y < FU; y++) if (y >= U.ty0 && grid[y][x] === 'S') return false; for (let y = D.ty0; y < D.F; y++) if (grid[y][x] === 'S') return false; }
        return true;
      };
      //  시내는 포켓몬센터 · 포켓샵 앞을 비운다 (사다리 발판이 간판 · 문을 가리지 않게) — 깨끗한 자리가 없으면 땅을 파서라도 비켜 선다
      const shopFree = c => ![U, D].some(r => r.type === 'village' && c + 6 > r.tx0 + 20 && c - 2 <= r.tx0 + 46);
      const near = ok => { for (let k = 0; k <= hi - lo; k++) for (const c of [cx0 + k, cx0 - k]) if ((k === 0 || (c >= lo && c <= hi)) && ok(c)) return c; return null; };
      cx0 = near(c => clean(c) && shopFree(c)) ?? near(shopFree) ?? cx0;
      // 그래도 막혀 있으면 직접 판다: 아래 방은 통로 밑 사다리 자리(종유석 · 떠 있는 바위 · 솟은 땅)를 바닥까지 비우고,
      //  위 방 구멍을 덮은 땅은 우물처럼 파낸다 (깊으면 중간 발판)
      for (let x = cx0 - 2; x < cx0 + 6; x++) for (let y = D.ty0; y < D.F; y++) if (grid[y][x] === 'S') grid[y][x] = '.';
      let well = 0;
      for (let x = cx0 - 2; x < cx0 + 6; x++) { let y = FU - 5; while (y > U.ty0 && grid[y][x] === 'S') { grid[y][x] = '.'; y--; } well = Math.max(well, FU - 1 - y); }
      for (let x = cx0 - 2; x < cx0 + 6; x++) for (let y = FU - 4; y < FU; y++) if (y >= U.ty0) grid[y][x] = '.';   // 위 방: 구멍 둘레 비우기
      if (well >= 5) setP(cx0 - 2, FU - 3, 8);
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

  // ---- 보물방 제단 · 상자: 철창 구멍 · 사다리 · 옆문 앞을 비켜 방 가운데에서 가장 가까운 자리 (난수를 쓰지 않는다) ----
  for (const r of rooms) {
    if (r.type !== 'treasure') continue;
    const busy = new Set(), grate = new Set();
    for (const d of r.doors) {
      if (d.dir === 'v') for (let x = d.cap - 4; x <= d.cap + 7; x++) { busy.add(x); grate.add(x); }
      else for (let x = r.tx0; x <= r.tx0 + 7; x++) if (d.R === r) busy.add(x); else busy.add(r.tx1 - 1 - (x - r.tx0));
    }
    const mid = (r.tx0 + r.tx1) >> 1, fitsIn = set => ax => ax - 2 > r.tx0 && ax + 2 < r.tx1 - 1 && [-2, -1, 0, 1, 2].every(o => !set.has(ax + o));
    let ax = null;
    //  문이 셋이라 빈자리가 없으면 옆문 앞은 양보하되 철창(위아래 통로)만은 덮지 않는다 — 덮으면 아래 방으로 가는 길이 막힌다
    for (const fits of [fitsIn(busy), fitsIn(grate)]) for (let k = 0; k < r.tx1 - r.tx0 && ax === null; k++) { if (fits(mid + k)) ax = mid + k; else if (fits(mid - k)) ax = mid - k; }
    if (ax === null) ax = mid;
    for (let x = ax - 2; x <= ax + 2; x++) { grid[r.F][x] = 'S'; for (let y = r.F - 6; y < r.F; y++) if (y > r.ty0) grid[y][x] = '.'; }   // 바닥을 단단히 · 위는 비운다 (종유석 · 발판)
    const g = altar(ax, r.F);
    chests.push({ x: ax * TILE + 8, y: g * TILE, treasure: true });
    marks.push({ kind: 'chest', x: ax, y: g, room: r });
  }

  // ---- 튜토리얼 기술머신으로 내려가는 철창 옆 표지 (입구) ----
  for (const d of doors) {
    if (d.dir !== 'v' || !d.D.tutorial) continue;
    const U = d.U;
    const ok = x => (grid[U.F][x] === 'S' || grid[U.F][x] === 'B') && grid[U.F - 1][x] === '.' && grid[U.F - 2][x] === '.';
    for (const x of [d.cap - 4, d.cap - 5, d.cap - 3, d.cap - 6]) if (ok(x)) { props.push({ kind: 'sidesign', x, g: U.F, tutorial: true }); break; }   // 표지 오른쪽 4칸 = 철창 위 안내
  }

  // ---- 마을 사람들 (data/npcs.js): 오박사 연구소 안 · 시내 빈자리 (철창 · 표지 · 센터 문 · 자판기 · 정거장 앞은 비켜 선다) ----
  const npcs = [];
  {
    const BUSY = { center: [4, 11], mart: [0, 6], vending: [-1, 3], corvi: [0, 7], lore: [-1, 2], sign: [-1, 3], sidesign: [-2, 7], tm: [-3, 3], labdoor: [-2, 3], oakhouse: [5, 10] };
    const placeNpcs = (r, ids, slots) => {
      const busy = new Set();
      for (const d of r.doors) if (d.dir === 'v' && d.U === r) for (let x = d.cap - (d.D.tutorial ? 7 : 3); x <= d.cap + 6; x++) busy.add(x);   // 철창 둘레 (튜토리얼은 표지까지)
      for (const pr of props) { const b = BUSY[pr.kind]; if (b && pr.x >= r.tx0 && pr.x < r.tx1 && pr.g === r.F) for (let x = pr.x + b[0]; x <= pr.x + b[1]; x++) busy.add(x); }
      const ok = x => x > r.tx0 + 3 && x < r.tx1 - 5 && !busy.has(x) && grid[r.F][x] === 'S' && [1, 2, 3].every(h => grid[r.F - h][x] === '.');
      ids.forEach((id, i) => {
        const want = slots[i % slots.length];
        let x = null;
        for (let k = 0; k < 40 && x === null; k++) for (const c of [want + k, want - k]) if (ok(c)) { x = c; break; }
        if (x === null) return;
        for (let o = -3; o <= 3; o++) busy.add(x + o);   // 사람끼리도 붙어 서지 않게
        npcs.push({ id, x, g: r.F, room: r, face: i % 2 ? 1 : -1 });
      });
    };
    for (const r of rooms) {
      if (r.lab) placeNpcs(r, LAB, [r.tx0 + 12, r.tx0 + 26, r.tx0 + 40]);
      else if (r.type === 'village' && TOWNS[r.city]) { const b = r.tx0 + 1; placeNpcs(r, TOWNS[r.city], [b + 13, b + 52, b + 18, b + 33]); }
    }
    // ---- 정문(포털)으로만 들어가는 독립 던전 (성도 방울탑 · 신오 창기둥 · 깨어진 세계) ----
    //  sealRealm: 그 지역(ti)으로 걸어 들어가는 다른 문(지역 경계를 넘는 옆문 · 정문 방 천장 철창)을 벽으로 메운다
    //   (메워도 모든 방에 여전히 갈 수 있을 때만 — 포털은 통로로 친다 · 월드 생성 · 난수는 그대로라 저장과 무관)
    //   문 그래프로 이어져 있어도 방 안 지형(높은 단 · 섬)에 막혀 실제로는 못 가는 반쪽이 생길 수 있어, 메운 뒤 걸어서 닿는지(Reach)도 본다
    //   못 닿게 된 방이 생기면 그 둘레의 너무 높은 턱(점프로 못 오르는 6~10칸 단) 앞에 디딤 발판을 놓아 보고, 그래도 안 되면 문을 그대로 둔다
    // 깨어진 세계 도약 수정: 아래층으로 가는 바닥 문(사다리 구멍)에 바닥이 깎였으면 짝 부유섬 옆 가까운 멀쩡한 바닥으로 옮긴다 (길 보장 · 봉인 검사 전에)
    const padOk = (x, g) => [0, 1].every(dx => grid[g][x + dx] === 'S' && grid[g - 1][x + dx] === '.' && grid[g - 2][x + dx] === '.');
    for (const pd of pads) {
      if (padOk(pd.x, pd.g) || !pd.isl) continue;
      const [ix, iw] = pd.isl, r = pd.room, cand = [];
      for (let k = 0; k < 6; k++) cand.push(ix - 3 - k, ix + iw + 1 + k);
      const nx = cand.find(x => x >= r.tx0 + 1 && x + 1 <= r.tx1 - 2 && padOk(x, pd.g) && !pads.some(q => q !== pd && q.g === pd.g && Math.abs(q.x - x) < 3));
      if (nx != null) pd.x = nx;
    }
    for (let i = pads.length - 1; i > 0; i--) if (pads.slice(0, i).some(q => q.g === pads[i].g && Math.abs(q.x - pads[i].x) < 3)) pads.splice(i, 1);   // 겹쳐 놓인 도약 수정은 하나만
    const realmStarts = () => {
      const s0 = mainRooms[0], sx = s0.tx0 + 5; let sy = s0.ty0 + 1;
      while (sy < s0.F && !(grid[sy][sx] === '.' && grid[sy - 1][sx] === '.' && grid[sy + 1][sx] !== '.')) sy++;
      const st = [[sx, sy]];
      for (const d of doors) if (d.portalIn) st.push([d.portalIn.x, d.portalIn.y - 1]);
      return st;
    };
    const deadRooms = () => {
      const padSet = new Set(); for (const pd of pads) for (const dx of [0, 1]) padSet.add((pd.x + dx) + ',' + (pd.g - 1));
      const R = reach(grid, realmStarts(), { x0: 0, y0: 0, x1: cols, y1: rows }, { pads: padSet, padTiles: PAD_TILES });
      return new Set(rooms.filter(r => { for (let y = r.ty0; y < r.F; y++) for (let x = r.tx0; x < r.tx1; x++) if (R.has(x, y)) return false; return true; }));
    };
    //  stepUp: 새로 못 닿게 된 방과 그 이웃 방에서, 닿는 바닥 바로 옆에 6~10칸 높은 턱이 있으면 그 앞 3칸 위에 디딤 발판(P 3칸)을 놓는다 (undo 에 기록)
    const stepUp = undo => {
      const padSet = new Set(); for (const pd of pads) for (const dx of [0, 1]) padSet.add((pd.x + dx) + ',' + (pd.g - 1));
      const R = reach(grid, realmStarts(), { x0: 0, y0: 0, x1: cols, y1: rows }, { pads: padSet, padTiles: PAD_TILES });
      const near = new Set();
      for (const r of rooms) {
        let ok = false; for (let y = r.ty0; y < r.F && !ok; y++) for (let x = r.tx0; x < r.tx1 && !ok; x++) if (R.has(x, y)) ok = true;
        if (ok) continue;
        near.add(r); for (const d of r.doors) near.add(d.a === r ? d.b : d.a);
      }
      const free = (x, y) => grid[y] && grid[y][x] === '.';
      let placed = false;
      for (const r of near) for (let y = r.ty0 + 2; y < r.F; y++) for (let x = r.tx0 + 1; x < r.tx1 - 1; x++) {
        if (!R.has(x, y) || !(free(x, y) && free(x, y - 1) && !free(x, y + 1))) continue;
        for (const dir of [1, -1]) {
          const cx = x + dir; if (free(cx, y)) continue;
          let top = y; while (top > r.ty0 && !free(cx, top)) top--;
          const rise = y - top;
          if (rise < 6 || rise > 10 || !free(cx, top - 1) || R.has(cx, top)) continue;
          const p = y - 2, xs = dir > 0 ? [x - 2, x - 1, x] : [x, x + 1, x + 2];
          if (!xs.every(xx => free(xx, p) && free(xx, p - 1) && free(xx, p - 2))) continue;
          for (const xx of xs) { undo.push([xx, p, '.']); grid[p][xx] = 'P'; }
          placed = true;
        }
      }
      return placed;
    };
    const sealRealm = (ti, gate, isPortal) => {
      const sealed = new Set(), dead0 = deadRooms();   // 메우기 전에도 못 가던 방은 탓하지 않는다
      const walkable = () => { for (const r of deadRooms()) if (!dead0.has(r)) return false; return true; };
      const linked = () => {
        const seen = new Set([rooms[0]]), q = [rooms[0]];
        while (q.length) { const r = q.shift(); for (const d of r.doors) { if (sealed.has(d) || d.sealed) continue; const o = d.a === r ? d.b : d.a; if (!seen.has(o)) { seen.add(o); q.push(o); } } }   // 앞서 다른 던전을 봉인하며 메운 문도 막힌 것으로
        return seen.size === rooms.length;
      };
      for (const d of doors) {
        if (d.breakable || d.sealed || isPortal(d)) continue;
        if (!((d.a.ai === ti) !== (d.b.ai === ti) || (gate && d.dir === 'v' && (d.a === gate || d.b === gate)))) continue;
        sealed.add(d);
        if (!linked()) { sealed.delete(d); continue; }
        const undo = [];
        for (const [x, y] of d.cells) { undo.push([x, y, grid[y][x]]); grid[y][x] = 'S'; }   // 아래 방 사다리 발판은 그대로 둔다 (천장이 막혀도 방 안 높은 턱을 넘는 디딤이 된다 — 걷어 내면 반쪽이 갇히는 구덩이가 될 수 있다)
        for (let k = 0; k < 3 && !walkable(); k++) if (!stepUp(undo)) break;   // 메우면 높은 턱에 막혀 못 가는 방이 생기면 디딤 발판
        if (!walkable()) { for (let i = undo.length - 1; i >= 0; i--) { const [x, y, c] = undo[i]; grid[y][x] = c; } sealed.delete(d); continue; }   // 그래도 못 가는 방이 생긴다 → 그대로 둔다
        d.sealed = true;
      }
    };
    //  templeGate: gate(정문 외관이 서는 바깥 방 · 본 경로) 앞을 성역 마당으로 만들고 hall(정문 너머 첫 방)과 출입문(포털)으로 잇는다
    //   · 두 방이 맞닿아 있지 않으면 벽 없는 가상의 출입문으로 잇는다 (출입문은 원래 포털이라 붙어 있을 필요가 없다)
    //   · 정문 앞 성역 마당: 외관 너비만큼 언덕 · 떠 있는 바위 · 천장 덩어리를 걷어 평평한 돌바닥으로 · 그 위 소품은 바닥으로 (개수 그대로 — 저장 서명 유지)
    //     메우지 못한 문(다른 방으로 가는 유일한 길)의 철창 구멍 · 사다리 · 옆문 앞은 그대로 둔다
    //   · 수문장 NPC 둘을 정문 양옆에 · 두 방 사이 통로를 벽으로 막고 d.portal (정문 앞에서 ↑/F → 암전 → 첫 방 출입문 앞 — GameScene.useDoor)
    //   o: { npcs: [왼쪽, 오른쪽], faces: { id: -1|1 }, name: 지도에 적을 입구 이름 }
    const templeGate = (gate, hall, ti, o) => {
      if (gate && hall && !gate.doors.some(q => q.dir === 'h' && (q.a === hall || q.b === hall))) {
        const hd = hall.doors.find(q => q.dir === 'h' && q.R === hall);
        const vd = { dir: 'h', a: gate, b: hall, L: gate, R: hall, cells: [], mx: hall.tx0, my: hd ? hd.my : hall.F - 2.5, virtual: true };
        doors.push(vd); gate.doors.push(vd); hall.doors.push(vd);
      }
      const isPortalDoor = q => (q.dir === 'h' && hall && ((q.a === gate && q.b === hall) || (q.b === gate && q.a === hall))) || !!q.portal;
      if (!gate) return;
      gate.gateFront = true;
      gate.doorTx = gate.tx1 - 21;   // 거대한 정문 한가운데 칸 (Props 의 정문 외관 640px 이 오른쪽 벽 안에 들도록)
      sealRealm(ti, gate, isPortalDoor);
      const fx0 = Math.max(gate.tx0 + 1, gate.doorTx - 21), fx1 = gate.tx1 - 1, keep = new Set();
      for (const d of gate.doors) if (!d.sealed && !isPortalDoor(d)) {
        if (d.dir === 'v') for (let x = d.cap - 3; x <= d.cap + 6; x++) keep.add(x);
        else if (d.L === gate) for (let x = gate.tx1 - 8; x < gate.tx1; x++) keep.add(x);
      }
      for (let x = fx0; x <= fx1; x++) {
        if (keep.has(x)) continue;
        for (let y = gate.ty0; y < gate.F; y++) grid[y][x] = '.';
        grid[gate.F][x] = 'S'; grid[gate.F + 1][x] = 'S';
      }
      // 마당이 구덩이가 되지 않게: 마당에서 걸어서 들어온 문(메우지 않은 문)으로 되돌아갈 수 없으면 가로막는 왼쪽 턱 앞에 디딤 발판 계단을 놓는다
      //  (마당을 깎으며 턱 오른쪽에 있던 언덕 · 계단까지 걷혀 버린 경우 — 정문 안에서 나와도 갇히지 않게)
      const backOk = () => {
        const R = reach(grid, [[gate.doorTx, gate.F - 1]], { x0: gate.X0, y0: gate.Y0, x1: gate.X1, y1: gate.Y1 });
        return gate.doors.filter(d => !d.sealed && !isPortalDoor(d) && d.cells.length).every(d => d.cells.some(([x, y]) => R.has(x, y) || R.has(x - 1, y)));
      };
      if (!backOk()) {
        let cx = fx0 - 1; while (cx > gate.tx0 && grid[gate.F - 1][cx] !== 'S') cx--;
        let top = gate.F - 1; while (top > gate.ty0 && grid[top - 1][cx] === 'S') top--;
        const xs = [cx + 1, cx + 2, cx + 3];
        for (let st = gate.F - 1; st - (top - 1) > 5; st -= 3) {
          const p = st - 2;
          if (xs.every(x => grid[p][x] === '.' && grid[p - 1][x] === '.' && grid[p - 2][x] === '.')) for (const x of xs) grid[p][x] = 'P';
        }
      }
      for (const pr of props) if (pr.x >= fx0 && pr.x <= fx1 && pr.g != null && pr.g >= gate.ty0 && pr.g <= gate.F) {
        pr.g = gate.F;
        if (Math.abs(pr.x - gate.doorTx) <= 20 && ['statue', 'crate', 'lamp', 'tree', 'pillar', 'fence', 'tallgrass', 'signpost'].includes(pr.kind)) pr.hide = true;   // 정문 · 수문장 자리는 비운다
      }
      placeNpcs(gate, o.npcs, [gate.doorTx - 9, gate.doorTx + 9]);
      for (const n of npcs) if (n.room === gate) { n.face = o.faces[n.id] ?? n.face; n.guide = true; }
      const d = hall && gate.doors.find(q => q.dir === 'h' && (q.a === hall || q.b === hall));
      if (d) {
        for (const [x, y] of d.cells) grid[y][x] = 'S';   // 옆방 통로를 벽으로
        d.portal = true; d.portalName = o.name;
        gate.portalTo = hall; hall.portalFrom = gate;
        hall.portalY = d.my + 2.5;   // 첫 방 출입문 자리 바닥 줄 (문 앞 4칸은 방 바닥보다 높을 수 있다)
        d.portalOut = { x: gate.doorTx, y: gate.F }; d.portalIn = { x: hall.tx0 + 2, y: hall.portalY };
      }
    };
    // 성도 방울탑 (bg 'belltower' 지역): 바로 앞 지역(인주시티)의 지상 전투 구역 = 방울로드(단풍 가로수길 · 밝은 가을 햇살)
    //  그 끝 방 = 방울탑 정문 앞 막다른 성역 (초대형 1층 기단 · 정문 외관 · 수문장 승려 둘) · 탑 안 = 횃불이 일렁이는 목조 탑 · 칠색조 아레나 = 노을 지는 옥상
    //  방울로드 전체는 평화 구역(peaceful: 침식된 포켓몬이 하나도 나오지 않는다 — GameScene.updateSpawns · safeZones)
    {
      const ti = ch.areas.findIndex(a => a.bg === 'belltower');
      if (ti > 0) {
        const trail = rooms.filter(r => r.ai === ti - 1 && !r.under && (r.type === 'combat' || r.type === 'plaza')).sort((a, b) => a.id - b.id);
        for (const r of trail) { r.trail = true; r.peaceful = true; }
        const mainTrail = trail.filter(r => r.main);   // 탑 입구는 본 경로의 마지막 방 (곁가지 방이 아니라)
        for (const r of rooms) if (r.ai === ti) { r.tower = true; if (r.type === 'boss') r.rooftop = true; }
        const hall1 = rooms.filter(r => r.ai === ti && r.main).sort((a, b) => a.id - b.id)[0];   // 탑 안 1층
        const gate = mainTrail[mainTrail.length - 1];
        if (gate) gate.trailEnd = true;
        templeGate(gate, hall1, ti, { npcs: ['elder_monk', 'trainee_monk'], faces: { elder_monk: -1, trainee_monk: 1 }, name: '방울탑 입구' });   // 선임 노승려는 정문 왼쪽, 수행 승려는 오른쪽
      }
    }
    // 신오: 천관산 만년설 협곡(bg 'coronet') → 창기둥(bg 'spear') → 깨어진 세계(bg 'distortion') — 난수를 쓰지 않는다
    //  · 협곡: 동굴이 아닌 탁 트인 설산 길목 (snowPeak: 밝기 85% · 눈발 · 오로라 · 시공 균열 하늘 — GameScene) · 마지막 본 경로 방 = 창기둥 정문 앞 성역(몬스터 0 · 봉신마을 장로 · 유적 수호자)
    //  · 창기둥 안(spear): 무너진 대리석 기둥 · 금강옥(푸른) · 백옥(분홍) 결정이 맥동 (밝기 80%) · 디아루가 → 펄기아 제단(spearAltar)
    //  · 제단 뒤 차원 균열(rift): 창기둥 제단 ↔ 깨어진 세계 첫 방. 평소엔 닫혀 있다가 펄기아까지 정화하면 영구히 열린다 (GameScene.openRift · 방 cleared 로 저장)
    //  · 깨어진 세계(distortion): 적이 없는 플랫포밍 구역(부유섬 · 유령 발판 · 차원 도약 수정 — distortionRoom) · 맨 끝 반물질의 왕좌(throne) = 기라티나 성소
    {
      const idx = bg => ch.areas.findIndex(a => a.bg === bg);
      const ki = idx('coronet'), si = idx('spear'), di = idx('distortion');
      const mainOf = ai => rooms.filter(r => r.ai === ai && r.main).sort((a, b) => a.id - b.id);
      if (ki >= 0) for (const r of rooms) if (r.ai === ki && !r.under) r.snowPeak = true;
      if (si >= 0) for (const r of rooms) if (r.ai === si) { r.spear = true; if (r.type === 'boss') r.spearAltar = true; }
      if (di >= 0) for (const r of rooms) if (r.ai === di) { r.distortion = true; r.peaceful = true; if (r.type === 'sanctuary') r.throne = true; }
      // 제단 뒤 차원 균열: 창기둥 제단 아레나 ↔ 깨어진 세계 첫 방 (맞닿아 있지 않으면 가상의 문)
      const altarRoom = si >= 0 ? rooms.find(r => r.spearAltar) : null, dw0 = di >= 0 ? mainOf(di)[0] : null;
      if (altarRoom && dw0) {
        let d = altarRoom.doors.find(q => q.a === dw0 || q.b === dw0);
        if (!d) { d = { dir: 'h', a: altarRoom, b: dw0, L: altarRoom, R: dw0, cells: [], mx: dw0.tx0, my: dw0.F - 2.5, virtual: true }; doors.push(d); altarRoom.doors.push(d); dw0.doors.push(d); }
        for (const [x, y] of d.cells) grid[y][x] = 'S';
        d.portal = true; d.rift = true; d.portalName = '깨어진 세계';
        if (d.my == null) d.my = dw0.F - 2.5;   // 위아래로 맞닿은 문이면 균열 출구 높이는 깨어진 세계 첫 방 바닥에서
        altarRoom.riftTo = dw0; dw0.riftFrom = altarRoom;
        d.portalOut = { x: (altarRoom.tx0 + altarRoom.tx1) >> 1, y: altarRoom.F }; d.portalIn = { x: dw0.tx0 + 4, y: dw0.F };
        sealRealm(di, null, q => q === d);   // 깨어진 세계로 걸어 들어가는 다른 길(지름길 고리 · 샛길)은 없다
      }
      // 창기둥 정문 앞 성역 (협곡의 마지막 본 경로 방)
      if (ki >= 0 && si >= 0) {
        const gate = mainOf(ki).filter(r => r.type === 'combat').pop(), hall = mainOf(si)[0];
        if (gate) { gate.spearGate = true; gate.peaceful = true; }
        templeGate(gate, hall, si, { npcs: ['celestic_elder', 'coronet_guardian'], faces: { celestic_elder: -1, coronet_guardian: 1 }, name: '창기둥 입구' });
      }
      // 신오 초입: 시작 방에 신화 연구가 (시간 · 공간 · 반물질의 뒤틀림 — 천관산 정상으로)
      if (ki >= 0) {
        const s0 = mainRooms[0];
        placeNpcs(s0, ['myth_scholar'], [s0.tx0 + 10]);
        for (const n of npcs) if (n.id === 'myth_scholar') { n.face = -1; n.guide = true; }
      }
    }
    // 호연 기상 이변 · 하늘기둥 (지역 bg 로 찾는다 · 난수를 쓰지 않는다)
    //  굴뚝산(volcano) 지상 = 가뭄 길 (붉은 화산재 · 일식 · 용암 균열) → 본 경로 마지막 방 끝에 대지의 동굴 입구
    //  해저동굴(seacave) 지상 = 폭우 해안 (빗줄기 · 푸른 번개 · 발밑 바닷물) → 본 경로 첫 지상 방 끝에 해저동굴 입구
    //  하늘기둥(skypillar) 첫 방 = 131번 수로 고대 돌다리 (에메랄드 바다 · 달 · 오로라) → 끝에 하늘기둥 외관 + 장로 · 시련 캡틴
    //  하늘기둥 안 = 채광 · 발광 수정 · 금 간 바닥(GameScene.buildCracks) · 레쿠쟈 아레나 = 성층권 천공의 제단
    {
      const idx = bg => ch.areas.findIndex(a => a.bg === bg);
      const main = ai => rooms.filter(r => r.ai === ai && r.main && !r.under).sort((a, b) => a.id - b.id);
      const vi = idx('volcano'), si = idx('seacave'), pi = idx('skypillar');
      if (vi >= 0) { for (const r of rooms) if (r.ai === vi && !r.under) r.drought = true; const m = main(vi).filter(r => r.type !== 'mini' && r.type !== 'boss'); if (m.length) m[m.length - 1].magmaGate = true; }
      if (si >= 0) { for (const r of rooms) if (r.ai === si && !r.under) r.rain = true; const m = main(si).filter(r => r.type === 'combat'); if (m.length) m[0].seaGate = true; }
      if (pi >= 0) {
        const m = main(pi), bridge = m.find(r => r.type !== 'boss');
        for (const r of rooms) if (r.ai === pi) { if (r.type === 'boss') r.stratosphere = true; else if (r !== bridge) r.pillar = true; }
        if (bridge) {
          bridge.seaBridge = true;
          placeNpcs(bridge, ['pillar_elder', 'trial_captain'], [bridge.tx0 + 4, bridge.tx0 + 8]);   // 좁은 다리 방: 장로 · 캡틴이 나란히 (하늘기둥 외관은 오른쪽 끝)
          for (const n of npcs) if (n.room === bridge) { n.face = 1; n.guide = true; }
        }
      }
    }
    // 조작 힌트 (관동 초입): 태초마을을 나서 처음 만나는 전투 구역 입구엔 부상당한 베테랑(차징 샷),
    //  통과 발판이 처음 나오는 구역 앞엔 실프 연구원(공중 내려찍기). 난수를 쓰지 않으므로 같은 시드의 지형·저장 서명은 그대로다
    if (ci === 0) {
      const route = rooms.filter(r => r.type === 'combat' && !r.under).sort((a, b) => a.id - b.id);   // 방 번호 = 본 경로 순서 (위아래 곁방은 뒤 번호)
      const plat = r => { for (let y = r.F - 12; y < r.F; y++) for (let x = r.tx0; x < r.tx1; x++) if (grid[y] && grid[y][x] === 'P') return true; return false; };
      const first = route[0], high = route.slice(1, 4).find(plat) || route[1];
      const at = (r, id) => { if (r) placeNpcs(r, [id], [r.tx0 + 5]); const n = npcs[npcs.length - 1]; if (n && n.id === id) { n.face = -1; n.guide = true; } };   // 들어오는 쪽(왼쪽)을 보고 선다 · guide: 둘레에 적이 생기지 않는 연습 자리
      at(first, 'veteran');
      if (high !== first) at(high, 'silph_lab');
    }
  }

  // ---- 흙 덮개 (상처약·엘리트 굴: 방 안 + 들어오는 문 칸) ----
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
    if (r.type !== 'combat' || ch.areas[r.ai].bg === 'distortion' || r.spearGate) continue;   // 깨어진 세계는 적이 없는 플랫포밍 구역 · 창기둥 정문 앞 성역은 몬스터 0
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

  // ---- 엘리트 수문장: 기술머신이 없는 모든 막다른 길 끝 (보물방 · 상처약 굴 · 엘리트 굴) ----
  //  붉은 오라를 두른 강한 야생 포켓몬 1마리 — 처치하면 이상한사탕 100% · 장착 도구 25% (GameScene.killEnemy)
  for (const r of rooms) {
    if (r.type !== 'treasure' && r.type !== 'pocket') continue;
    const mid = (r.tx0 + r.tx1) >> 1;
    for (let k = 0; k < 12; k++) {
      const x = mid + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 2;
      if (!grid[r.F] || (grid[r.F][x] !== 'S' && grid[r.F][x] !== 'B') || grid[r.F - 1][x] !== '.' || grid[r.F - 2][x] !== '.') continue;
      spawns.push({ x: x * TILE + 8, y: r.F * TILE, room: r, spawned: false, elite: true });
      r.elite = true;
      break;
    }
  }

  // ---- 간이 포켓몬 회복기 (Field Recovery Terminal): 보스방(지방 보스·중간 보스·히든 성소)마다 반드시 하나 ----
  //  보스방에서 방 2~3칸 떨어진 안전한 방 바닥 → 없으면 바로 앞 방(1칸) → 그래도 바닥 자리가 없으면 가장 가까운 방 바닥을 2칸 평평하게 다진다
  //  단, 보스방에서 TOWN_NEAR 칸 안에 시내(포켓몬센터)가 있으면 두지 않는다 — 센터가 그 역할을 한다
  //  난수를 쓰지 않는다 (시드로 다시 만든 지형·저장 기록과 어긋나지 않게)
  const terminals = [], byId = new Map(rooms.map(r => [r.id, r]));
  const SKIP_ROOM = new Set(['boss', 'mini', 'sanctuary', 'tm', 'treasure', 'pocket']);
  const solid = (x, y) => grid[y] && (grid[y][x] === 'S' || grid[y][x] === 'B');
  const spot = (r, xx) => xx > r.tx0 + 2 && xx < r.tx1 - 3 && !(r.gateFront && xx > r.doorTx - 25) && [0, 1].every(o => solid(xx + o, r.F) && [1, 2, 3].every(h => grid[r.F - h][xx + o] === '.'));
  const TOWN_NEAR = 3;
  for (const boss of rooms.filter(r => r.type === 'boss' || r.type === 'mini' || r.type === 'sanctuary')) {
    const dist = new Map([[boss.id, 0]]), q = [boss];
    while (q.length) {
      const r = q.shift(), d = dist.get(r.id);
      if (d >= 3) continue;
      for (const id of r.links) if (!dist.has(id) && byId.has(id)) { dist.set(id, d + 1); q.push(byId.get(id)); }
    }
    if ([...dist.entries()].some(([id, d]) => d <= TOWN_NEAR && byId.get(id).type === 'village')) { boss.nearTown = true; continue; }   // 시내가 너무 가깝다
    const order = d => d === 2 ? 0 : d === 3 ? 1 : 2;   // 2칸 → 3칸 → 1칸
    const cand = rooms.filter(r => dist.get(r.id) >= 1 && dist.get(r.id) <= 3 && !SKIP_ROOM.has(r.type) && !terminals.some(t => t.room === r))
      .sort((a, b) => order(dist.get(a.id)) - order(dist.get(b.id)) || (b.main ? 1 : 0) - (a.main ? 1 : 0) || a.id - b.id);
    let placed = false;
    for (const r of cand) {
      const mid = (r.tx0 + r.tx1) >> 1, half = (r.tx1 - r.tx0) >> 1;
      let x = null;
      for (let k = 0; k < half && x === null; k++) for (const xx of [mid + k, mid - k]) if (spot(r, xx)) { x = xx; break; }
      if (x === null) continue;
      terminals.push({ x, g: r.F, room: r, boss });
      marks.push({ kind: 'terminal', x, y: r.F, room: r });
      placed = true;
      break;
    }
    if (!placed && cand.length) {   // 바닥을 다진다: 방 가운데 2칸 바닥을 단단하게, 그 위 4칸을 비운다
      const r = cand[0], x = r.gateFront ? r.tx0 + 4 : Math.max(r.tx0 + 4, Math.min(r.tx1 - 6, (r.tx0 + r.tx1) >> 1));   // 방울탑 · 창기둥 정문 앞은 비운다
      for (const o of [0, 1]) { grid[r.F][x + o] = 'S'; for (let h = 1; h <= 4; h++) if (r.F - h > r.ty0) grid[r.F - h][x + o] = '.'; }
      terminals.push({ x, g: r.F, room: r, boss, flattened: true });
      marks.push({ kind: 'terminal', x, y: r.F, room: r });
    }
  }

  // ---- 길 보장 마무리 (game/Reach.js): 입구에서 걸어서(진화해 커진 몸 · 2단 점프) 닿는 칸을 계산해서 ----
  //  · 방 안에 디딜 수 있는데 못 닿는 자리(바위 위가 종유석에 덮인 틈 등)가 있으면 그 둘레 종유석을 걷어 내고 다시 계산
  //  · 바닥 가까이(바닥선 3칸 위부터 아래)에 남은 못 닿는 칸(바위에 덮인 다리 밑 구덩이 등)은 메워 '보이는데 못 가는 틈'을 없앤다
  //  · 닿지 못하는 자리의 적 출현 지점은 지운다
  {
    const s0 = mainRooms[0], sx = s0.tx0 + 5;
    let sy = s0.ty0 + 1; while (sy < s0.F && !(grid[sy][sx] === '.' && grid[sy - 1][sx] === '.' && grid[sy + 1][sx] !== '.')) sy++;
    const oak = rooms.find(r => r.oak), starts = [[sx, sy]];
    if (oak) starts.push([oak.oakDoor, oak.F - 1]);   // 닫힌 연구소에서 문으로 나오는 자리 (마을의 연구소 건물 앞)
    for (const d of doors) if (d.portalIn) starts.push([d.portalIn.x, d.portalIn.y - 1]);   // 방울탑 안 1층 출입문 (정문과 벽으로 막혀 걸어선 못 닿는다 — 빠뜨리면 탑 안 전체가 '못 닿는 칸'으로 메워진다)
    const win = { x0: 0, y0: 0, x1: cols, y1: rows };
    const padSet = new Set(); for (const pd of pads) for (const dx of [0, 1]) padSet.add((pd.x + dx) + ',' + (pd.g - 1));   // 깨어진 세계 차원 도약 수정 (그 위에 선 발 칸)
    const ro = { pads: padSet, padTiles: PAD_TILES };
    let R = reach(grid, starts, win, ro);
    const standing = (x, y) => grid[y][x] === '.' && grid[y - 1][x] === '.' && grid[y + 1][x] !== '.';
    for (let pass = 0; pass < 3 && R.has(sx, sy); pass++) {
      let changed = false;
      for (const r of rooms) {
        let lo = Infinity, hi = -Infinity;
        for (let y = r.ty0 + 1; y < r.F; y++) for (let x = r.tx0; x < r.tx1; x++) if (standing(x, y) && !R.has(x, y)) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
        if (lo > hi) continue;
        for (const c of stalCells) if (c[2] === r && c[0] >= lo - 3 && c[0] <= hi + 3 && grid[c[1]][c[0]] === 'S') { grid[c[1]][c[0]] = '.'; changed = true; }
      }
      if (!changed) break;
      R = reach(grid, starts, win, ro);
    }
    if (R.has(sx, sy)) {
      // 몸이 들어가지 않는 낮은 틈(천장까지 2칸)인데 못 닿는 자리는 바위로 메운다 — 못 닿는 칸은 어떤 길에도 쓰이지 않으니 메워도 안전하다
      for (let k = 0; k < 2; k++) for (const r of rooms) for (let y = r.ty0 + 2; y < r.F; y++) for (let x = r.tx0; x < r.tx1; x++)
        if (standing(x, y) && grid[y - 2][x] !== '.' && !R.has(x, y)) { grid[y][x] = 'S'; grid[y - 1][x] = 'S'; }
      for (const r of rooms) for (let y = r.F - 3; y < r.Y1; y++) for (let x = r.tx0; x < r.tx1; x++) if (grid[y][x] === '.' && !R.has(x, y)) grid[y][x] = 'S';
      for (let i = spawns.length - 1; i >= 0; i--) { const sp = spawns[i], x = Math.floor(sp.x / TILE), y = sp.y / TILE - 1; if (!R.has(x, y) && !R.has(x, y - 1)) spawns.splice(i, 1); }
      for (let i = chests.length - 1; i >= 0; i--) { const c = chests[i], x = Math.floor(c.x / TILE), y = c.y / TILE - 1; if (c.island && !R.has(x, y) && !R.has(x + 1, y) && !R.has(x - 1, y)) chests.splice(i, 1); }   // 깨어진 세계 부유섬 상자 안전망
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
  // 탑 안 1층 출입문 바닥 줄: 지형을 다 깎은 뒤의 실제 바닥 (문 앞 계단 · 언덕이 나중에 솟을 수 있다 — 벽 속에 내려앉지 않게)
  for (const d of doors) if (d.portalIn) {
    const r = d.a.portalFrom || d.a.riftFrom ? d.a : d.b, x = d.portalIn.x;   // 출입문(포털)이 열리는 쪽 방 (방울탑 · 창기둥 안 1층 · 깨어진 세계 첫 방)
    const solidAt = yy => grid[yy][x] === 'S' || grid[yy][x] === 'P';
    let y = Math.max(r.ty0 + 1, Math.floor(d.my - 2.5));
    if (solidAt(y)) while (y > r.ty0 + 1 && solidAt(y - 1)) y--;   // 문 높이까지 땅이 솟았으면 그 위로
    else while (y < r.F + 2 && !solidAt(y)) y++;
    r.portalY = d.portalIn.y = y;
  }
  const data = grid.map((row, y) => row.map((c, x) => tileOf(x, y)));
  // 깨어진 세계: 유령 발판(문 뚫기 · 길 보장 뒤에도 남은 'P' 칸을 가로 줄 단위로) · 도약 수정(바닥이 그대로인 것만) · 부유섬 보물 상자(섬이 그대로인 것만)
  const phase = [];
  {
    const live = phaseCells.filter(([x, y]) => grid[y][x] === 'P').sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [x, y, r] of live) {
      const last = phase[phase.length - 1];
      if (last && last.y === y && last.x1 === x - 1) last.x1 = x; else phase.push({ x0: x, x1: x, y, room: r });
    }
  }
  for (let i = pads.length - 1; i >= 0; i--) { const pd = pads[i]; if (![0, 1].every(dx => grid[pd.g][pd.x + dx] === 'S' && grid[pd.g - 1][pd.x + dx] === '.' && grid[pd.g - 2][pd.x + dx] === '.')) pads.splice(i, 1); }
  for (let i = chests.length - 1; i >= 0; i--) {
    const c = chests[i]; if (!c.island) continue;
    const x = Math.floor(c.x / TILE), y = c.y / TILE;
    if (!(grid[y] && grid[y][x] === 'S' && grid[y - 1][x] === '.' && grid[y - 2][x] === '.')) chests.splice(i, 1);
  }

  const start = mainRooms[0];
  return {
    ci, chapter: ch, data, grid, cols, rows, width: cols * TILE, height: rows * TILE, ncx, ncy, cellRoom,
    rooms, doors, sides, breakables, props, chests, spawns, marks, potions, hubs, tileOf, terminals, npcs, phase, pads,
    start: { x: (start.tx0 + 5) * TILE, y: start.F * TILE - 12, room: start }, surfaceRow
  };
}

// 칸(x, y)이 들어 있는 방
export const roomAtCell = (level, x, y) => level.cellRoom.get(Math.floor(x / CW) + ',' + Math.floor(y / CH)) || null;
// 월드 픽셀 좌표가 들어 있는 방
export const roomAt = (level, px, py) => roomAtCell(level, Math.floor(px / TILE), Math.floor(py / TILE));
