// 타일 공통: 타일 번호 · 통과 발판/벽 판정 · 바닥 찾기
// 월드(방 배치·지형·문)는 game/World.js 가 만든다. 여기엔 그 결과(level.grid)를 읽는 도우미만 둔다.
// grid 문자: 'S' 벽 · 'B' 부서지는 벽 · 'P' 통과 발판(보이는 다리·철창) · 'H' 통과 발판(집 지붕·발코니) · '.' 빈칸
import { TILE } from '../config.js';

// 타일 번호: 3 통과 발판 · 5 보이지 않는 통과 발판 · 8+mask 벽 (mask: 1 위 2 아래 4 왼쪽 8 오른쪽이 트여 있음)
export const T = { PLAT: 3, HPLAT: 5, SOLID: 8 };
export const PLAT_SET = new Set([T.PLAT, T.HPLAT]);
export const SOLID_SET = new Set(Array.from({ length: 16 }, (_, m) => T.SOLID + m));

// 해당 x 열에서 fromY 아래로 처음 만나는 발 디딜 곳(벽 윗면/발판)의 y 픽셀
export function groundYAt(level, px, fromY = 2 * TILE) {
  const tx = Math.floor(px / TILE);
  if (tx < 0 || tx >= level.cols) return null;
  for (let ty = Math.max(0, Math.floor(fromY / TILE)); ty < level.rows; ty++) {
    const c = level.grid[ty][tx];
    if (c !== '.') return ty * TILE;
  }
  return null;
}
