// 테스트룸 (테스터 모드에서 로비의 「테스트룸」): 진행 저장·도감과 상관없는 빈 아레나 방 하나
//  포켓몬과 진화 단계를 바로바로 바꿔 기술·이펙트를 보고, 보스를 골라 그 자리에서 싸운다 (패널은 UIScene.showTest)
//  보스를 고르면 그 보스가 원래 나오는 지방·지역의 타일·배경·음악으로, 원래 아레나와 같은 크기·발판으로 다시 깐다
//  (날아다니는 보스는 2×2, 나머지는 2×1 — game/World.js 의 아레나 배치 그대로)
//  방 둘레엔 한 셀씩 바위를 두른다 — 보스전 카메라가 아레나보다 넓게 당겨져도 월드처럼 바위가 보이게
import { TILE } from '../config.js';
import { T } from './Level.js';
import { CW, CH, BIG_ARENA, arenaPlatforms, roomAt } from './World.js';
import { STAGES } from '../data/stages.js';

const WALL = 2, GROUND = 6;   // World.js 와 같은 벽 두께 · 바닥 밑 땅 두께
// 이어서 나오는 보스(펄기아 · 라티오스 · 레드의 포켓몬)는 원래 함께 나오는 보스의 아레나에서
const SAME_ARENA = { palkia: 'dialga', latios: 'latias', reshiram: 'zekrom', necrozma: 'eternatus', 'pikachu-red': 'eternatus', 'charizard-red': 'eternatus' };

// 보스가 원래 나오는 곳: { ci 지방, ai 지역, arena 아레나 주인, tall 2층 아레나 }
export function bossHome(key) {
  const arena = SAME_ARENA[key] || key;
  for (let ci = 0; ci < STAGES.length; ci++) {
    const areas = STAGES[ci].areas;
    for (let ai = 0; ai < areas.length; ai++) {
      const toks = [...areas[ai].plan, ...(areas[ai].branches || [])];
      if (toks.some(t => t.replace(/\^$/, '').split(':')[1] === arena)) return { ci, ai, arena, tall: BIG_ARENA.has(arena) };
    }
  }
  return { ci: 0, ai: 0, arena: null, tall: false };
}

// o: { ci, ai, arena, tall } → GameScene 이 쓰는 레벨 (World.buildChapter 와 같은 모양 · 방 하나 · 문·적·상자 없음)
export function buildTestRoom(o) {
  const ch = STAGES[o.ci], gh = o.tall ? 2 : 1, ncx = 4, ncy = gh + 2, cols = ncx * CW, rows = ncy * CH;
  const r = { id: 0, gx: 1, gy: 1, gw: 2, gh, kind: 'test', type: 'test', ai: o.ai, boss: o.arena || null, main: true, seg: 0,
    doors: [], links: new Set(), torches: [], entered: true, cleared: true, depth: 0, under: false, area: '테스트룸' };
  r.X0 = CW; r.X1 = 3 * CW; r.Y0 = CH; r.Y1 = (gh + 1) * CH;
  r.tx0 = r.X0 + WALL; r.tx1 = r.X1 - WALL; r.ty0 = r.Y0 + WALL; r.F = r.Y1 - GROUND;
  r.left = r.tx0 * TILE; r.right = r.tx1 * TILE; r.top = r.ty0 * TILE; r.bottom = r.F * TILE; r.cx = (r.left + r.right) / 2;
  const grid = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => x >= r.tx0 && x < r.tx1 && y >= r.ty0 && y < r.F ? '.' : 'S'));
  const setP = (x, y, w) => { for (let i = 0; i < w; i++) if (grid[y] && grid[y][x + i] === '.') grid[y][x + i] = 'P'; };
  arenaPlatforms(r, o.tall, setP);
  const props = [[r.tx0 + 1, 8], [r.tx1 - 3, 9]].map(([x, h], i) => ({ kind: 'pillar', x, g: r.F, h: Math.min(h, r.F - r.ty0 - 2), variant: i }));
  for (let tx = r.tx0 + 6; tx < r.tx1 - 4; tx += 10) { const ty = r.F - 8; if (grid[ty][tx] === '.') r.torches.push({ x: tx * TILE + 8, y: ty * TILE + 6 }); }
  // 타일 번호 (World.js 와 같은 규칙: 트인 방향마다 테두리)
  const S = (x, y) => y < 0 || y >= rows || x < 0 || x >= cols || grid[y][x] === 'S';
  const tileOf = (x, y) => {
    const c = grid[y][x];
    if (c === 'P') return T.PLAT;
    if (c !== 'S') return -1;
    return T.SOLID + (!S(x, y - 1) ? 1 : 0) + (!S(x, y + 1) ? 2 : 0) + (!S(x - 1, y) ? 4 : 0) + (!S(x + 1, y) ? 8 : 0);
  };
  const data = grid.map((row, y) => row.map((c, x) => tileOf(x, y)));
  const cellRoom = new Map();
  for (let y = r.gy; y < r.gy + gh; y++) for (let x = r.gx; x < r.gx + 2; x++) cellRoom.set(x + ',' + y, r);
  return {
    ci: o.ci, chapter: ch, test: true, data, grid, cols, rows, width: cols * TILE, height: rows * TILE, ncx, ncy, cellRoom,
    rooms: [r], doors: [], sides: [], breakables: [], props, chests: [], spawns: [], marks: [], potions: [], hubs: [], tileOf, terminals: [], npcs: [],
    start: { x: (r.tx0 + 5) * TILE, y: r.F * TILE - 12, room: r }, surfaceRow: 1
  };
}

// ---------------- 테스트 모드: 실제 지방 맵의 랜드마크로 워프 (GameScene.testWarpLandmark · UIScene 테스트 패널 「랜드마크」 탭) ----------------
const firstOf = (lv, f) => { const rs = lv.rooms.filter(f).sort((a, b) => a.id - b.id); return rs.find(r => r.main) || rs[0]; };   // 본 경로 방 먼저 (방 번호 = 본 경로 순서 · 곁방은 뒤 번호)
const spotAt = (room, x) => (room ? { room, x: x ?? room.left + 70 } : null);
const gateSpot = room => (room ? { room, x: room.doorTx ? room.doorTx * TILE - 60 : room.right - 110 } : null);   // 정문 한가운데(doorTx) 왼쪽 — F / ↑ 로 포털 확인
// 🗺️ 주요 랜드마크 입구 & 길목: 지방은 그 랜드마크 지역의 bg 로 찾는다 · path 진입로 길목 · gate 정문 앞 → { room, x }
//  방울탑 진입로 = 정문 앞 방과 문으로 이어진 방울로드(단풍 가로수길) 방 → 없으면 다른 방울로드 방 → 그래도 없으면 정문 앞 방 들머리
export const TEST_LANDMARKS = [
  { name: '방울탑', desc: '단풍나무 진입로 · 1층 정문 앞', bg: 'belltower', path: lv => { const g = firstOf(lv, r => r.trailEnd); return spotAt(lv.rooms.find(r => r.trail && !r.trailEnd && g && g.links.has(r.id)) || firstOf(lv, r => r.trail && !r.trailEnd) || g); }, gate: lv => gateSpot(firstOf(lv, r => r.trailEnd)) },
  { name: '하늘기둥', desc: '131번 수로 돌다리 · 외벽 정문 앞', bg: 'skypillar', path: lv => spotAt(firstOf(lv, r => r.seaBridge)), gate: lv => { const r = firstOf(lv, q => q.seaBridge); return r ? { room: r, x: r.right - 110 } : null; } },
  { name: '창기둥', desc: '천관산 만년설 협곡 · 창기둥 정문 앞', bg: 'coronet', path: lv => spotAt(firstOf(lv, r => r.snowPeak && !r.spearGate)), gate: lv => gateSpot(firstOf(lv, r => r.spearGate)) },
  { name: '깨어진 세계', desc: '반물질 플랫포밍 구간 · 왕좌 앞', bg: 'distortion', path: lv => spotAt(firstOf(lv, r => r.distortion && r.type !== 'sanctuary')), gate: lv => { const th = lv.rooms.find(q => q.throne), r = th && lv.rooms.find(q => q.distortion && q !== th && th.links.has(q.id)); return r ? { room: r, x: th.left >= r.right - 16 ? r.right - 90 : r.left + 90 } : null; } },   // 반물질의 왕좌(기라티나 성소)와 문으로 이어진 방 — 왕좌 쪽 끝
  { name: '용나선탑', desc: '설화시티 고대 다리 · 용나선탑 정문 앞', bg: 'icirrus', path: lv => spotAt(firstOf(lv, r => r.icirrus && !r.spiralGate)), gate: lv => gateSpot(firstOf(lv, r => r.spiralGate)) },
  { name: '시초의 방', desc: '천계의 유리 계단 · 시초의 성문 앞', bg: 'azure', path: lv => spotAt(firstOf(lv, r => r.azure && !r.originGate)), gate: lv => gateSpot(firstOf(lv, r => r.originGate)) },
  { name: '블랙나이트의 심장', desc: '플랜트 연구 일지 복도 · 최종 격리 게이트 앞', bg: 'plant', path: lv => { const j = (lv.props || []).find(q => q.kind === 'journal' && q.no === 1), r = j && roomAt(lv, j.x * TILE + 8, j.g * TILE - 4); return r ? { room: r, x: j.x * TILE - 30 } : spotAt(firstOf(lv, q => q.plant && q.main)); }, gate: lv => gateSpot(firstOf(lv, r => r.plantGate)) }
];
export const landmarkCi = L => STAGES.findIndex(st => st.areas.some(a => a.bg === L.bg));
