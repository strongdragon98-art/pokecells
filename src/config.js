// 화면/월드 공통 상수
export const GAME_W = 640;          // 논리 화면 크기 (UI 좌표는 모두 이 기준)
export const GAME_H = 360;
export const ZOOM = 1.25;           // 월드 배율 → 월드는 512x288 픽셀 도트로 보인다 (크게 보려면 1.5~2)
export const TILE = 16;
export const ROOM_H = 26;           // 방 높이(타일) — 화면 세로(18칸)보다 높아 위아래로도 탐험한다
export const FLOOR_ROW = 21;        // 바닥 윗면 행 (아래 5칸이 땅 — 구덩이를 4칸까지 판다)
// 지하 길: 지상 방 아래로 같은 높이의 동굴층이 한 겹 더 있다 (지상 26칸 + 지하 26칸)
export const WORLD_ROWS = 52;
export const LOW_TOP = 30;          // 지하 동굴 천장 아래 첫 빈 행
export const LOW_FLOOR = 46;        // 지하 바닥 윗면 행

// 렌더링 배율: 좌표는 640x360 그대로 두고 캔버스만 2~3배로 키워 글자·장식을 매끈하게 그린다.
// (도트는 그대로 크게 보이고, 글자·선·광택만 고해상도로 그려진다) 휴대폰은 성능을 위해 2배.
// 캔버스 크기는 devicePixelRatio 를 따라 커지지 않는다 (아이폰 DPR 3 이어도 휴대폰은 1280x720 고정 — VRAM 폭주 방지).
// 안전 모드(지난 접속이 부팅 중 끊김 · WebGL 컨텍스트 손실 — systems/Perf.js)면 고해상도 PC 도 3배 대신 2배로
export const RES = (() => {
  if (typeof window === 'undefined') return 2;
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const px = Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1);
  let safe = false;
  try { safe = localStorage.getItem('pokecells.safe') === '1'; } catch (e) { /* 저장소를 못 쓰면 평소대로 */ }
  if (coarse) return 2;
  return px >= 1800 && !safe ? 3 : 2;
})();

// UI 글꼴: 프리텐다드(한글 고딕) · 제목 로마자는 Cinzel — 둘 다 SIL OFL 1.1
export const FONT_UI = "'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
export const FONT_TITLE = "'Cinzel', 'Pretendard', serif";
// 월드 안(데미지 숫자 등)은 도트 화면에 맞춰 픽셀 글꼴을 쓴다
export const FONT = 'Galmuri11';
export const FONT_S = 'Galmuri9';
export const FONT_L = 'Galmuri14';

// UI 글자 (고해상도로 그려 매끈하다). 같은 숫자의 도트 글꼴과 비슷한 크기로 보이도록 살짝 키운다.
export function txt(size = 12, color = '#efeae0', extra = {}) {
  return Object.assign({ fontFamily: FONT_UI, fontSize: `${Math.round(size * 1.08 * 10) / 10}px`, color, resolution: RES }, extra);
}
// 월드 안 도트 글자 (도트 글꼴은 정수 크기에서만 선명하다)
export function pxt(size = 12, color = '#f4ecd8', extra = {}) {
  const family = size >= 15 ? FONT_L : size <= 10 ? FONT_S : FONT;
  return Object.assign({ fontFamily: family, fontSize: `${size}px`, color, resolution: 1 }, extra);
}

// UI 씬 카메라: 논리 640x360 이 캔버스 전체를 채우도록 확대
export function uiCamera(scene) {
  return scene.cameras.main.setZoom(RES).centerOn(GAME_W / 2, GAME_H / 2);
}

// 조작 키
export const KEYS = {
  left: ['LEFT'], right: ['RIGHT'], up: ['UP'], down: ['DOWN'],
  jump: ['SPACE', 'UP'], dash: ['SHIFT'],
  z: ['Z'], x: ['X'], c: ['C'],
  swapNext: ['TAB', 'E'], s1: ['ONE'], s2: ['TWO'], s3: ['THREE'],
  zmove: ['Q'], mega: ['V'], pause: ['ESC', 'P'], map: ['M'], inventory: ['I'], mute: ['N'], use: ['F', 'UP']
};
