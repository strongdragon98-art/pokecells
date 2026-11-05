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
//  층고 규칙 (점프 개편 — 꾹 누른 1단 점프 약 100px · 6칸): 바닥 → 1층 발판 · 층과 층 사이는 4칸(64px · 1단 점프의 64%) 이하,
//   가로 틈은 오르는 칸 수에 따라 5~7칸 이하 — 1단 점프 한 번이면 넉넉히 올라선다 (검증: 테스트 도구 seg-check 와 같은 규칙)
//  공중 발판 · 부유섬은 모두 아래에서 뚫고 오르는 통과형: 'P' 발판은 원래 그렇고, 부유섬(isle)은 r.isleCells 에 칸을 적어 두면
//   GameScene 이 윗면 칸만 위에서 밟히게 · 몸통 칸은 충돌 없이 만든다 (그림 · 격자 문자 'S' 는 그대로 — 탄환은 바위에 막힌다)
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
  //  r.isleCells: [x, y, 윗면?] — 칸마다 그 기둥에서 가장 위 칸이 윗면 (모양이 안쪽으로 깎인 둘레 칸은 한 줄 아래가 윗면)
  r.isleCells = [];
  const isle = (dx, h, w, shape) => {
    const ty = F - h, n = Math.min(shape.length, h - 1);
    for (let j = 0; j < n; j++) for (let i = shape[j]; i < w - shape[j]; i++) S(x0 + dx + i, ty + j);
    for (let i = 0; i < w; i++) { let first = true; for (let j = 0; j < n; j++) { const x = x0 + dx + i, y = ty + j; if (grid[y][x] !== 'S' || i < shape[j] || i >= w - shape[j]) continue; r.isleCells.push([x, y, first]); first = false; } }
    return { x: x0 + dx, y: ty, w, h: n };
  };
  r.arenaStyle = style;
  const A = r.arena = { style };

  if (style === 'biolab') {
    // 양 끝 데크(4칸 위) · 냉각수 경기장으로 내려서는 2칸 턱 · 가운데 오목한 경기장
    raise(0, 11, 4); raise(W - 12, W - 1, 4); raise(12, 13, 2); raise(W - 14, W - 13, 2);
    fill();
    // 철제 캣워크 3층 (8 · 12 · 16칸 — 데크(4) 위로 4칸씩) + 맨 위 관제 브리지(20 · 위 크레인에서 4칸)
    P(1, 8, 9); P(W - 10, 8, 9);
    P(2, 12, 9); P(W - 11, 12, 9);
    P(1, 16, 7); P(W - 8, 16, 7);
    if (H > 26) P((W >> 1) - 4, 20, 8);
    A.pit = [x0 + 14, x1 - 15];
    A.decks = [[x0, x0 + 11], [x1 - 12, x1 - 1]];
    // 사슬 크레인 발판 (칸 단위 · 런타임에 좌우로 오간다 — GameScene.buildCranes): y 윗면 줄 · 왕복 구간 · 너비 · 속도(px/s) · 시작 위상
    //  아래 크레인 = 1층 캣워크 높이(8) · 위 크레인 = 3층 캣워크 높이(16) — 캣워크 끝에서 옆으로 건너 타고, 위 크레인에서 관제 브리지로 오른다
    A.cranes = [{ y: F - 8, a: x0 + 15, b: x1 - 21, w: 6, sp: 26, ph: 0 }, { y: F - 16, a: x0 + 16, b: x1 - 22, w: 6, sp: 34, ph: .55 }].filter(c => c.y > top + 2);
  } else if (style === 'bellroof') {
    for (let i = 0; i < W; i++) raise(i, i, ROOF[Math.min(ROOF.length - 1, Math.min(i, W - 1 - i))]);
    fill();
    // 청사초롱 · 풍등 발판 (윗면 = 초롱 뚜껑) — 처마 끝(5) · 지붕 비탈 · 용마루(7)에서 1단 점프 한 번(4칸 이하)이면 다음 초롱 위로 넉넉히
    //  처마 5 → 9 → 13 → 17 → 21 → 24 → 27 · 비탈 4~5 → 8 · 용마루 7 → 11 → 15 → 19 → 23 → 27 (좌우 대칭 · 가운데 셋)
    //  이웃 초롱끼리 가로 틈 4칸 이하 (오르는 칸이 4면 3칸 이하) — 초롱 가운데에서 뛰어도 1단 점프 한 번에 닿는다
    A.lanterns = [];
    for (const [dx, h, w] of [[6, 9, 4], [W - 10, 9, 4], [18, 8, 4], [W - 22, 8, 4], [24, 11, 3], [W - 27, 11, 3], [12, 13, 3], [W - 15, 13, 3],
      [19, 15, 4], [W - 23, 15, 4], [6, 17, 3], [W - 9, 17, 3], [27, 19, 6], [11, 21, 3], [W - 14, 21, 3], [28, 23, 4], [17, 24, 4], [W - 21, 24, 4], [24, 27, 12]]) {
      if (F - h <= top + 1) continue;
      P(dx, h, w); A.lanterns.push({ x: x0 + dx, y: F - h, w });
    }
    A.ridge = [x0 + 25, x0 + W - 26];
    A.bells = [x0 + 1, x1 - 2];
  } else if (style === 'summit') {
    // 3단 피라미드 제단 (4 · 8 · 12칸 — 단차마다 64px: 꾹 누른 1단 점프 약 100px 로 가볍게) · 좌우 끊어진 절벽 (모서리가 부서져 내려앉았다)
    raise(14, W - 15, 4); raise(19, W - 20, 8); raise(24, W - 25, 12);
    raise(0, 5, 9); raise(6, 6, 8); raise(7, 7, 6);
    raise(W - 6, W - 1, 9); raise(W - 7, W - 7, 8); raise(W - 8, W - 8, 6);
    fill();
    // 고대 문양 부유석 (통과형 — 아래에서 뚫고 올라선다): 절벽(9) 위 13 · 제단 1단 위 17 · 꼭대기 21 (4칸 간격)
    A.stones = [isle(4, 13, 4, [0, 1]), isle(W - 8, 13, 4, [0, 1]), isle(14, 17, 4, [0, 1]), isle(W - 18, 17, 4, [0, 1])];
    if (H > 26) A.stones.push(isle(20, 21, 20, [0, 0, 2, 6]));   // 꼭대기 부유석: 20칸 — 안쪽 기류(한 칸 옆)에서 떠올라 → 만 누르면 바로 건너 앉는다
    // 초록빛 상승 기류 (wind — Props.updateHeroes 가 열기보다 세게 밀어 올린다)
    //  ① 절벽과 제단 사이 틈 (6칸 너비): 바닥 구름바다에서 꼭대기 부유석 높이(21)까지
    //  ② 안쪽 부유석 아래 (제단 1단 윗면에서): 그대로 실려 꼭대기 부유석 위까지 붕 떠오른다 — 점프를 안 눌러도 레쿠쟈 머리 위로
    const TOPL = Math.max(top + 2, F - 21);
    for (const dx of [8, W - 14]) lifts.push({ x0: x0 + dx, x1: x0 + dx + 5, y0: TOPL, y1: F - 1, room: r, wind: true });
    for (const dx of [14, W - 19]) lifts.push({ x0: x0 + dx, x1: x0 + dx + 4, y0: TOPL, y1: F - 5, room: r, wind: true });
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
    //  섬 높이: 낮은 섬 4 → 가운데 섬 7 · 날개 섬 8 → 작은 섬 11~12 → 꼭대기 섬 15 · 벽 쪽 디딤 섬 16 (위층 문 턱 20 까지 4칸) — 어디서든 1단 점프 4칸 이하
    const big = [[ia, 4, 7, [0, 0, 1, 3]], [10, 8, 6, [0, 0, 2]], [18, 4, 6, [0, 1, 2]], [25, 7, 10, [0, 0, 1, 2, 4]], [W - 24, 4, 6, [0, 1, 2]], [W - 16, 8, 6, [1, 0, 2]], [ig, 4, 7, [0, 0, 2, 3]]];
    if (H > 26) big.push([26, 15, 8, [0, 0, 1, 3]]);
    const small = H > 20 ? [[6, 12, 3], [W - 9, 12, 3], [19, 11, 3], [W - 22, 11, 3], [2, 16, 3], [W - 5, 16, 3]] : [[6, 8, 3], [W - 9, 8, 3]];
    A.islands = big.map(([dx, h, w, sh]) => isle(dx, h, w, sh)).concat(small.map(([dx, h, w]) => isle(dx, h, w, [0, 1])));
    r.islands = A.islands.map(q => ({ x: q.x, y: q.y, w: q.w }));
    // 차원 도약 수정 (낮은 섬 둘): 밟거나 치면 높이 솟구친다
    for (const dx of [20, W - 22]) { const g = F - 4; if (grid[g][x0 + dx] === 'S' && grid[g][x0 + dx + 1] === 'S') pads.push({ x: x0 + dx, g, room: r, isl: null }); }
    A.abyss = 'void';
    A.openWalls = true;
    A.throneY = F - 7;   // 가운데 섬(7칸) 윗면
  } else if (style === 'yinyang') {
    // 왼쪽 레시라무의 백색 대리석 계단 (벽 쪽으로 3단) · 오른쪽 제크로무의 흑요석 계단 (낮은 둔덕 + 솟은 흑요석 단) · 가운데 결투장
    //  (오른쪽 벽엔 늘 천계로 가는 문이 바닥 높이에 있어, 흑요석 계단은 벽에서 8칸 안쪽에 솟는다)
    raise(0, 5, 3); raise(6, 8, 2); raise(9, 11, 1);
    raise(W - 20, W - 18, 1); raise(W - 17, W - 15, 2); raise(W - 14, W - 12, 3); raise(W - 11, W - 9, 2);
    fill();
    P(2, 7, 7); P(14, 5, 7);            // 흰 대리석 판 (가운데 쪽으로 한 칸 — 제단 상판까지 가로 틈 1칸)
    P(W - 23, 5, 6); P(W - 15, 7, 6);   // 검은 흑요석 파편
    P(22, 8, 12);                       // 가운데 위: 흑백이 맞물린 제단 상판 (8칸 — 양쪽 판(5)에서 3칸)
    A.split = mid;
  } else if (style === 'origin') {
    // 바닥은 유리 회랑 (밑으로 별이 비친다) · 둥근 천체 발판 고리 (12개 · 30도마다) · 가운데 원반 · 양옆 유리 회랑 3층
    //  고리: 가운데 12칸 · 세로 반지름 8 → 발판 높이 4 · 5 · 8 · 12 · 16 · 19 · 20 (이웃 발판끼리 4칸 이하) · 유리 회랑 4 · 8 · 12 · 16
    const cx = mid, cy = F - 12, rx = 13, ry = 8;
    A.ring = { cx, cy, rx, ry, pads: [] };
    if (H > 26) for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, x = Math.round(cx + rx * Math.cos(a)) - 2, y = Math.round(cy - ry * Math.sin(a));
      setP(x, y, 4); A.ring.pads.push({ x, y, w: 4 });
    }
    if (H > 26) setP(cx - 3, cy + 3, 6);   // 가운데 원반 (9칸 — 아래 고리 발판 5칸에서 4칸)
    for (const [dx, h, w] of [[1, 4, 6], [3, 8, 6], [1, 12, 6], [3, 16, 6], [W - 7, 4, 6], [W - 9, 8, 6], [W - 7, 12, 6], [W - 9, 16, 6]]) P(dx, h, w);
    A.glass = true;
  } else if (style === 'reactor') {
    // 원자로 해치 돔: 가운데 29칸이 반원으로 5칸까지 솟는다
    const R = 14.5, c = W / 2 - .5;
    const dh = []; for (let i = 0; i < W; i++) { const d = (i - c) / R; dh.push(Math.abs(d) < 1 ? Math.round(5 * Math.sqrt(1 - d * d)) : 0); }
    for (let i = 1; i < W; i++) dh[i] = Math.min(dh[i], dh[i - 1] + 1);   // 한 칸씩만 오르게 (가장자리 2칸 턱 없이 걸어 오른다)
    for (let i = W - 2; i >= 0; i--) dh[i] = Math.min(dh[i], dh[i + 1] + 1);
    dh.forEach((h, i) => { if (h) raise(i, i, h); });
    fill();
    // 붉은 강철 트러스 빔: 벽에서 가운데로 오르다 꺾여 벽으로, 다시 가운데로 — 지그재그 3단 계단 (토막마다 1칸 · 꺾이는 곳 2~3칸 · 층 사이 3칸 틈)
    //  1단 4~7 (벽 → 가운데) · 2단 9~13 (가운데 → 벽) · 3단 16~19 (벽 → 가운데, 위층 문 턱 20 바로 아래) + 꼭대기 갠트리 21
    //  wall: 벽에 박힌 빔 (ArenaArt 가 벽에서부터 보를 긋는다) — 꺾여 돌아오는 2단은 공중에서 시작한다
    A.beams = [];
    const beam = (dx0, h0, n, dir, wall = true) => { const seg = []; for (let k = 0; k < n; k++) { const dx = dir > 0 ? dx0 + k * 3 : dx0 - k * 3, h = h0 + k; if (F - h <= top + 1) break; P(dx, h, 3); seg.push({ x: x0 + dx, y: F - h, w: 3 }); } seg.wall = wall; A.beams.push(seg); };
    beam(2, 4, 4, 1); beam(W - 5, 4, 4, -1);
    if (H > 20) { beam(14, 9, 5, -1, false); beam(W - 17, 9, 5, 1, false); beam(5, 16, 4, 1); beam(W - 8, 16, 4, -1); }
    if (H > 26) { P(20, 21, W - 40); A.gantry = { x: x0 + 20, y: F - 21, w: W - 40 }; }
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
