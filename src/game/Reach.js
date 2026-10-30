// 걸어서 닿는 칸 계산 — game/World.js 의 길 보장(막힌 통로 뚫기)이 쓴다. Phaser 없이 격자만 본다
//  격자 문자: 'S' 벽 · 'B' 부서지는 벽(부술 수 있으니 지나간다) · 'P'·'H' 통과 발판 · '.' 빈칸
//  몸: 가로 bw칸 × 세로 2칸 — 칸 (x, y) = 몸 왼쪽 아래(발) 칸. 진화해 커진 포켓몬(약 18~24px)도 지나가도록 기본 2칸 너비
//  점프: 땅을 디디면 jmax 칸까지 오를 수 있다 (2단 점프 포함 — 가장 낮게 뛰는 포켓몬이 약 5.2칸)
//  공중 좌우 이동은 제한 없이 본다 (2단 점프 + 공중 대시로 10칸 넘게 난다) · 통과 발판은 아래에서 뚫고 오르고 ↓ + Space 로 내려간다
export const BODY_W = 2, JUMP_TILES = 5;

// starts: [[x, y], ...] 발 칸 · win: { x0, y0, x1, y1 } 이 창 밖은 벽으로 본다 (x1·y1 은 미포함)
export function reach(grid, starts, win, o = {}) {
  const jmax = o.jmax ?? JUMP_TILES, bw = o.bw ?? BODY_W;
  const { x0, y0, x1, y1 } = win, W = x1 - x0, H = y1 - y0;
  const at = (x, y) => (x < x0 || x >= x1 || y < y0 || y >= y1) ? 'S' : grid[y][x];
  const solid = (x, y) => at(x, y) === 'S';
  const floorish = (x, y) => { const c = at(x, y); return c === 'S' || c === 'B' || c === 'P' || c === 'H'; };
  const free = (x, y) => { for (let i = 0; i < bw; i++) if (solid(x + i, y) || solid(x + i, y - 1)) return false; return true; };
  const grounded = (x, y) => { for (let i = 0; i < bw; i++) if (floorish(x + i, y + 1)) return true; return false; };
  const best = new Int8Array(W * H).fill(-1), q = [];
  const push = (x, y, b) => {
    if (!free(x, y)) return;
    if (grounded(x, y)) b = jmax;
    const k = (y - y0) * W + (x - x0);
    if (best[k] >= b) return;
    best[k] = b; q.push(x, y, b);
  };
  for (const [x, y] of starts) for (let i = 0; i < bw; i++) push(x - i, y, jmax);   // 몸 어디가 그 칸에 걸쳐 있어도 된다
  while (q.length) {
    const b = q.pop(), y = q.pop(), x = q.pop();
    push(x - 1, y, b); push(x + 1, y, b);
    let up = b > 0, down = true;
    for (let i = 0; i < bw; i++) { if (solid(x + i, y - 2)) up = false; if (solid(x + i, y + 1)) down = false; }
    if (up) push(x, y - 1, b - 1);
    if (down) push(x, y + 1, b);
  }
  // 칸 (x, y) 를 몸이 덮을 수 있는가 (몸 왼쪽이 x-bw+1 ~ x 중 어디든)
  const has = (x, y) => {
    if (y < y0 || y >= y1) return false;
    for (let i = 0; i < bw; i++) { const xx = x - i; if (xx >= x0 && xx < x1 && best[(y - y0) * W + xx - x0] >= 0) return true; }
    return false;
  };
  return { best, has };
}
