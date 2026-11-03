// 보스 결전장 지형 (game/World.js 의 아레나 방 · 테스트룸의 실제 보스방 워프도 같은 방을 쓴다)
//  보스마다 바닥 높낮이 · 경사 · 벽 · 발판 배치를 따로 짠다 — 평평한 바닥 + 발판 셋인 공용 아레나(World.arenaPlatforms)를 쓰지 않는다
//  난수를 쓰지 않는다: 같은 시드의 나머지 월드 · 진행 저장 서명(RunSave sigOf)이 그대로다
//  타일 한 칸 한 칸의 그림 · 다층 배경은 systems/ArenaArt.js (r.arenaStyle · r.arena 를 읽는다)
//
//  biolab     뮤츠 — 실프/오박사 지하 생체 공학 코어: 양 끝 2층 철제 캣워크 데크 · 가운데 한 단 낮은 냉각수 경기장 · 사슬에 매달려 오가는 크레인 발판 둘
//  bellroof   칠색조 — 방울탑 꼭대기 황금 처마 지붕: 가운데로 솟은 기와지붕 능선(용마루) · 양 끝 하늘로 휘어 오른 처마 · 높낮이가 다른 청사초롱 발판
//  summit     레쿠쟈 — 하늘기둥 성층권 정상: 벽 없는 하늘 한가운데 3단 계단식 고대 제단 · 좌우 끊어진 절벽 · 틈새의 초록 상승 기류 · 문양 부유석 (아래는 구름바다)
//  spear      디아루가 → 펄기아 — 창기둥 제단: 가운데 4계단 대리석 단상 · 쓰러진 기둥 경사로 · 부러진 기둥 그루터기 · 떨어져 나온 기둥 토막 다리 (비대칭 유적)
//  distortion 기라티나 · 다크라이 — 깨어진 세계: 일자 바닥이 없다 (반물질 심연) · 높낮이가 제각각인 부유 바위섬 여덟 + 결정 조각 · 차원 도약 수정
//  yinyang    제크로무 → 레시라무 — 용나선탑 꼭대기: 왼쪽 백색 대리석 계단 · 오른쪽 흑요석 계단이 가운데 결투장에서 맞물리는 흑백 대립 지형
//  origin     아르세우스 — 시초의 방: 흙 한 줌 없는 황금빛 크리스탈 공중 회랑 · 둥글게 도는 천체 발판 고리 · 양옆 유리 회랑
//  reactor    무한다이노 → 아비스 네크로즈마 — 블랙나이트의 심장: 가운데 볼록 솟은 원자로 해치 돔 · 양옆에서 가운데로 사선으로 뻗은 붉은 강철 트러스 빔
//
//  문: 좌우 문이 바닥 높이(F)에 있으면 그 벽 쪽 5칸은 평평하게 두고 2칸마다 1칸씩만 오르게 깎는다 (문 뚫기가 지형에 구멍을 내지 않게 · 걸어 들어오게)
//   위층 문(2×2 방)은 World 가 벽 앞에 턱을 깔아 준다 · 바닥 철창(위아래 문)은 World 가 우물처럼 파서 잇는다
export const ARENA_STYLE = { mewtwo: 'biolab', 'ho-oh': 'bellroof', rayquaza: 'summit', dialga: 'spear', giratina: 'distortion', darkrai: 'distortion', zekrom: 'yinyang', arceus: 'origin', eternatus: 'reactor' };

// 칠색조 지붕 단면: 벽에서 가운데까지 칸마다 바닥(F) 위 높이 (처마 끝 5 → 골 0 → 용마루 7)
const ROOF = [5, 5, 5, 4, 4, 3, 3, 2, 1, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 7, 7];

// r: 아레나 방 · o: { grid, setP, lifts, pads, CH, GROUND }
export function buildArena(style, r, o) {
  const { grid, setP, lifts, pads, CH, GROUND } = o;
  const x0 = r.tx0, x1 = r.tx1, W = x1 - x0, F = r.F, top = r.ty0, mid = (x0 + x1) >> 1, H = F - top;
  // 비워 둘 자리 (World 가 먼저 뚫어 둔 문 · 철창 · 사다리): 옆문 = 문 높이 위아래 · 벽에서 8칸 / 바닥 철창 = 구멍 위 8칸 기둥 / 천장 철창 = 사다리 기둥 전체
  const keep = [], shafts = [];
  for (const d of r.doors) {
    if (d.dir === 'h' && !d.virtual) { const Fr = (d.row + 1) * CH - GROUND, s = d.R === r ? -1 : 1; keep.push([s < 0 ? x0 : x1 - 8, s < 0 ? x0 + 7 : x1 - 1, Fr - 6, Fr + 1]); }
    else if (d.dir === 'v' && d.cap != null) {
      if (d.U === r) { keep.push([d.cap - 2, d.cap + 5, F - 6, F]); shafts.push(d.cap); }
      if (d.D === r) keep.push([d.cap - 2, d.cap + 5, top, F]);
    }
  }
  const kept = (x, y) => keep.some(([a, b, c, e]) => x >= a && x <= b && y >= c && y <= e);
  const S = (x, y) => { if (x >= x0 && x < x1 && y >= top && y < F && grid[y][x] === '.' && !kept(x, y)) grid[y][x] = 'S'; };
  const P = (dx, h, w) => { if (F - h > top) for (let i = 0; i < w; i++) if (!kept(x0 + dx + i, F - h)) setP(x0 + dx + i, F - h, 1); };   // dx: 왼쪽 벽 안쪽에서 · h: 바닥 위 높이
  const surf = new Array(W).fill(F);
  const raise = (a, b, h) => { for (let i = Math.max(0, a); i <= Math.min(W - 1, b); i++) surf[i] = Math.min(surf[i], F - h); };
  // 바닥 높이 문: 그 벽 쪽은 평평하게 · 그 뒤로 2칸마다 1칸씩만 오른다
  const floorDoors = new Set();
  for (const d of r.doors) if (d.dir === 'h' && !d.virtual && (d.row + 1) * CH - GROUND === F) floorDoors.add(d.R === r ? -1 : 1);
  const fill = () => {
    for (const s of floorDoors) for (let i = 0; i < W; i++) { const k = s < 0 ? i : W - 1 - i, lim = i < 5 ? 0 : ((i - 5) >> 1) + 1; surf[k] = Math.max(surf[k], F - lim); }
    for (const c of shafts) for (let x = c - 2; x <= c + 5; x++) if (x >= x0 && x < x1) surf[x - x0] = F;   // 바닥 철창 위는 바닥 그대로
    for (let i = 0; i < W; i++) for (let y = surf[i]; y < F; y++) S(x0 + i, y);
    // 철창 구멍 둘레가 높게 솟았으면(제단 · 지붕 · 돔 속) 구멍 안에 4칸마다 디딤 발판 (좌우 번갈아) — 아래층에서 올라와 지형 위로 나선다
    for (const c of shafts) {
      const hl = c - 3 >= x0 ? F - surf[c - 3 - x0] : 0, hr = c + 6 < x1 ? F - surf[c + 6 - x0] : 0, hm = Math.max(hl, hr);
      for (let h = 4, k = 0; h <= hm && hm > 4; h += 4, k++) setP(k % 2 ? c + 2 : c - 2, F - h, 4);
    }
  };
  // 부유섬: 윗면 w칸 · 아래로 갈수록 shape 만큼 안쪽으로 깎인다 (심연 바로 위 한 줄은 비운다)
  const isle = (dx, h, w, shape) => {
    const ty = F - h, n = Math.min(shape.length, h - 1);
    for (let j = 0; j < n; j++) for (let i = shape[j]; i < w - shape[j]; i++) S(x0 + dx + i, ty + j);
    return { x: x0 + dx, y: ty, w, h: n };
  };
  r.arenaStyle = style;
  const A = r.arena = { style };

  if (style === 'biolab') {
    // 양 끝 데크(4칸 위) · 냉각수 경기장으로 내려서는 2칸 턱 · 가운데 오목한 경기장
    raise(0, 11, 4); raise(W - 12, W - 1, 4); raise(12, 13, 2); raise(W - 14, W - 13, 2);
    fill();
    // 철제 캣워크 2 · 3층 (데크 위 4 · 9칸) + 맨 위 관제 브리지
    P(1, 8, 9); P(W - 10, 8, 9);
    P(2, 13, 9); P(W - 11, 13, 9);
    P(1, 18, 7); P(W - 8, 18, 7);
    if (H > 26) P((W >> 1) - 4, 23, 8);
    A.pit = [x0 + 14, x1 - 15];
    A.decks = [[x0, x0 + 11], [x1 - 12, x1 - 1]];
    // 사슬 크레인 발판 (칸 단위 · 런타임에 좌우로 오간다 — GameScene.buildCranes): y 윗면 줄 · 왕복 구간 · 너비 · 속도(px/s) · 시작 위상
    A.cranes = [{ y: F - 9, a: x0 + 15, b: x1 - 21, w: 6, sp: 26, ph: 0 }, { y: F - 16, a: x0 + 16, b: x1 - 22, w: 6, sp: 34, ph: .55 }].filter(c => c.y > top + 2);
  } else if (style === 'bellroof') {
    for (let i = 0; i < W; i++) raise(i, i, ROOF[Math.min(ROOF.length - 1, Math.min(i, W - 1 - i))]);
    fill();
    // 청사초롱 · 풍등 발판 (윗면 = 초롱 뚜껑) — 처마 끝 · 지붕 비탈에서 한 번에 오르는 높이로 층층이
    A.lanterns = [];
    for (const [dx, h, w] of [[6, 10, 4], [W - 10, 10, 4], [18, 11, 4], [W - 22, 11, 4], [27, 15, 6], [11, 16, 3], [W - 14, 16, 3], [4, 20, 3], [W - 7, 20, 3], [20, 21, 4], [W - 24, 21, 4], [28, 26, 4]]) {
      if (F - h <= top + 1) continue;
      P(dx, h, w); A.lanterns.push({ x: x0 + dx, y: F - h, w });
    }
    A.ridge = [x0 + 25, x0 + W - 26];
    A.bells = [x0 + 1, x1 - 2];
  } else if (style === 'summit') {
    // 3단 피라미드 제단 (4 · 8 · 12칸) · 좌우 끊어진 절벽 (모서리가 부서져 내려앉았다)
    raise(14, W - 15, 4); raise(19, W - 20, 8); raise(24, W - 25, 12);
    raise(0, 5, 9); raise(6, 6, 8); raise(7, 7, 6);
    raise(W - 6, W - 1, 9); raise(W - 7, W - 7, 8); raise(W - 8, W - 8, 6);
    fill();
    // 고대 문양 부유석 (상승 기류 곁 · 제단 위)
    A.stones = [isle(4, 14, 4, [0, 0, 1]), isle(W - 8, 14, 4, [0, 0, 1]), isle(14, 19, 4, [0, 1]), isle(W - 18, 19, 4, [0, 1])];
    if (H > 26) A.stones.push(isle(24, 24, 12, [0, 0, 2, 4]));
    // 절벽과 제단 사이 틈: 초록빛 상승 기류 (바닥 구름바다에서 부유석 높이까지)
    for (const dx of [9, W - 13]) lifts.push({ x0: x0 + dx, x1: x0 + dx + 3, y0: Math.max(top + 2, F - 20), y1: F - 1, room: r, wind: true });
    A.abyss = 'cloud';
    A.openWalls = true;
    A.altar = [x0 + 24, x1 - 25, F - 12];
  } else if (style === 'spear') {
    // 비대칭 유적: 쓰러진 기둥 경사로는 철창(아래층에서 올라오는 구멍)이 없는 쪽에 눕는다 (flip = 좌우를 뒤집어 깐다)
    const flip = shafts.some(c => c - x0 < W / 2) && !shafts.some(c => c - x0 >= W / 2);
    const R2 = (a, b, h) => (flip ? raise(W - 1 - b, W - 1 - a, h) : raise(a, b, h)), P2 = (dx, h, w) => P(flip ? W - dx - w : dx, h, w), X = dx => x0 + (flip ? W - 1 - dx : dx);
    // 가운데 4계단 대리석 단상 (윗면 10칸 · 제단이 선다)
    raise(16, W - 17, 1); raise(19, W - 20, 2); raise(22, W - 23, 3); raise(25, W - 26, 4);
    // 한쪽: 비스듬히 쓰러진 기둥 경사로 · 다른 쪽: 부러진 기둥 그루터기 + 굴러떨어진 기둥 북
    R2(4, 6, 1); R2(7, 9, 2); R2(10, 11, 3);
    R2(W - 11, W - 9, 2); R2(W - 15, W - 14, 1);
    fill();
    // 기둥 머리 조각 · 떨어져 나온 기둥 토막 다리 · 단상 위 부서진 박공 조각
    P2(6, 7, 6); P2(W - 16, 6, 10); P(26, 8, 8);
    // 천장에서 늘어진 부서진 처마도리 (비대칭) — 아래 땅(좌우 ±6칸 — 보스 몸 너비 — 중 가장 높은 곳)에 선 키 큰 보스(몸 높이 6칸 남짓) 머리에 닿지 않게 깊이를 줄인다
    const hi = x => { let m = F; for (let k = -6; k <= 6; k++) { const q = x - x0 + k; if (q >= 0 && q < W) m = Math.min(m, surf[q]); } return m; };
    for (const [a, b, d] of [[13, 19, 2], [14, 17, 3], [W - 22, W - 14, 2], [W - 20, W - 16, 3]]) for (let i = a; i <= b; i++) { const x = X(i), dd = Math.min(d, Math.floor(hi(x) - 6.5 - top)); for (let j = 0; j < dd; j++) S(x, top + j); }
    A.flip = flip;
    A.fallen = [Math.min(X(3), X(12)), Math.max(X(3), X(12))];
    A.stump = [Math.min(X(W - 11), X(W - 9)), Math.max(X(W - 11), X(W - 9))];
    A.drum = [Math.min(X(W - 15), X(W - 14)), Math.max(X(W - 15), X(W - 14))];
    A.dais = [x0 + 16, x1 - 17];
    A.altarY = F - 4;
  } else if (style === 'distortion') {
    // 바닥(F)은 반물질 심연 — 디디면 가장 가까운 섬으로 튕겨 올라온다 (GameScene.updateAbyss)
    //  바닥 높이 문이 있는 벽 쪽 첫 섬은 문 앞 터를 비켜 안쪽으로 (문 앞 디딤 땅에서 바로 뛰어오르게)
    const ia = floorDoors.has(-1) ? 7 : 1, ig = floorDoors.has(1) ? W - 14 : W - 8;
    const big = [[ia, 5, 7, [0, 0, 1, 3]], [10, 10, 6, [0, 0, 2]], [18, 4, 6, [0, 1, 2]], [25, 8, 10, [0, 0, 1, 2, 4]], [W - 24, 4, 6, [0, 1, 2]], [W - 16, 10, 6, [1, 0, 2]], [ig, 5, 7, [0, 0, 2, 3]]];
    if (H > 26) big.push([26, 21, 8, [0, 0, 1, 3]]);
    const small = H > 20 ? [[6, 15, 3], [W - 9, 15, 3], [15, 17, 3], [W - 18, 17, 3]] : [[6, 8, 3], [W - 9, 8, 3]];
    A.islands = big.map(([dx, h, w, sh]) => isle(dx, h, w, sh)).concat(small.map(([dx, h, w]) => isle(dx, h, w, [0, 1])));
    r.islands = A.islands.map(q => ({ x: q.x, y: q.y, w: q.w }));
    // 차원 도약 수정 (낮은 섬 둘): 밟거나 치면 높이 솟구친다
    for (const dx of [20, W - 22]) { const g = F - 4; if (grid[g][x0 + dx] === 'S' && grid[g][x0 + dx + 1] === 'S') pads.push({ x: x0 + dx, g, room: r, isl: null }); }
    A.abyss = 'void';
    A.openWalls = true;
    A.throneY = F - 8;
  } else if (style === 'yinyang') {
    // 왼쪽 레시라무의 백색 대리석 계단 (벽 쪽으로 3단) · 오른쪽 제크로무의 흑요석 계단 (낮은 둔덕 + 솟은 흑요석 단) · 가운데 결투장
    //  (오른쪽 벽엔 늘 천계로 가는 문이 바닥 높이에 있어, 흑요석 계단은 벽에서 8칸 안쪽에 솟는다)
    raise(0, 5, 3); raise(6, 8, 2); raise(9, 11, 1);
    raise(W - 20, W - 18, 1); raise(W - 17, W - 15, 2); raise(W - 14, W - 12, 3); raise(W - 11, W - 9, 2);
    fill();
    P(2, 7, 7); P(14, 5, 6);            // 흰 대리석 판
    P(W - 23, 5, 6); P(W - 15, 7, 6);   // 검은 흑요석 파편
    P(24, 9, 8);                        // 가운데 위: 흑백이 맞물린 제단 상판
    A.split = mid;
  } else if (style === 'origin') {
    // 바닥은 유리 회랑 (밑으로 별이 비친다) · 둥근 천체 발판 고리 (12개 · 30도마다) · 가운데 원반 · 양옆 유리 회랑 3층
    const cx = mid, cy = F - 14, rx = 13, ry = 9;
    A.ring = { cx, cy, rx, ry, pads: [] };
    if (H > 26) for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, x = Math.round(cx + rx * Math.cos(a)) - 2, y = Math.round(cy - ry * Math.sin(a));
      setP(x, y, 4); A.ring.pads.push({ x, y, w: 4 });
    }
    if (H > 26) setP(cx - 3, cy, 6);
    for (const [dx, h, w] of [[1, 5, 6], [3, 10, 6], [1, 15, 6], [W - 7, 5, 6], [W - 9, 10, 6], [W - 7, 15, 6]]) P(dx, h, w);
    A.glass = true;
  } else if (style === 'reactor') {
    // 원자로 해치 돔: 가운데 29칸이 반원으로 5칸까지 솟는다
    const R = 14.5, c = W / 2 - .5;
    const dh = []; for (let i = 0; i < W; i++) { const d = (i - c) / R; dh.push(Math.abs(d) < 1 ? Math.round(5 * Math.sqrt(1 - d * d)) : 0); }
    for (let i = 1; i < W; i++) dh[i] = Math.min(dh[i], dh[i - 1] + 1);   // 한 칸씩만 오르게 (가장자리 2칸 턱 없이 걸어 오른다)
    for (let i = W - 2; i >= 0; i--) dh[i] = Math.min(dh[i], dh[i + 1] + 1);
    dh.forEach((h, i) => { if (h) raise(i, i, h); });
    fill();
    // 붉은 강철 트러스 빔: 양 벽에서 가운데로 사선으로 (아래 4토막 · 위 6토막 · 토막마다 1칸씩 오른다) + 꼭대기 갠트리
    A.beams = [];
    const beam = (dx0, h0, n, dir) => { const seg = []; for (let k = 0; k < n; k++) { const dx = dir > 0 ? dx0 + k * 3 : dx0 - k * 3, h = h0 + k; if (F - h <= top + 1) break; P(dx, h, 3); seg.push({ x: x0 + dx, y: F - h, w: 3 }); } A.beams.push(seg); };
    beam(2, 5, 4, 1); beam(W - 5, 5, 4, -1);
    if (H > 20) { beam(1, 12, 6, 1); beam(W - 4, 12, 6, -1); }
    if (H > 26) { P(24, 22, W - 48); A.gantry = { x: x0 + 24, y: F - 22, w: W - 48 }; }
    A.dome = { cx: x0 + W / 2, r: R, h: 5 };
    A.coreY = F - 5;
  }
  return A;
}

// 방 안 x 칸 기둥에서 위에서부터 처음 만나는 단단한 땅(벽 · 부서지는 벽)의 줄 — 통과 발판은 건너뛴다 (from: 그 줄부터 아래로)
//  from 칸이 이미 땅 속이면 그 땅의 윗면으로 올라간다
export function solidRowAt(grid, r, tx, from = r.ty0) {
  const hard = y => { const c = grid[y] && grid[y][tx]; return c === 'S' || c === 'B'; };
  let y = Math.max(r.ty0, Math.min(r.F, from));
  if (hard(y)) { while (y > r.ty0 && hard(y - 1)) y--; return y; }
  for (; y <= r.F; y++) if (hard(y)) return y;
  return r.F;
}
