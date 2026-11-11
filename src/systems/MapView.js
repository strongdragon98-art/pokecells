// 지도(M) — 할로우 나이트풍 도식 지도 (지방 하나 = 2D 방 그래프)
//  실제 지형을 축소해 그리지 않고, 월드(game/World.js)를 '방 블록 + 문 통로'로 추상화해 그린다
//   · 방: 안쪽 공간 사각형 — 지역 색 반투명 채우기 + 밝은 외곽선 (지하 방은 같은 색을 더 어둡게)
//   · 통로: 좌우 문은 가로 통로, 위아래 문은 세로 갱도(꼭대기 철창 점선). 부서지는 벽은 무너뜨리기 전까지 안 그린다
//   · 탐험: 방은 한 칸이라도 본 적 있으면 통째로 드러나고, 안 가 본 방으로 이어지는 통로는 흰 점선
//     흙에 덮인 작은 굴(상처약·페이크)은 흙이 걷히기 전까지, 히든 성소는 가 보기 전까지 안 보인다 —
//     성소 바로 옆 방을 봤다면 그 자리에 흐릿한 보라 「?」만
//   · 핀: 포켓몬센터 · 아머까오 정거장 · 지방 보스(큰 해골) · 중간 보스(작은 해골) · 히든 전설(보라 ?) · 기술머신 · 보물 · 상처약 · 현재 위치
//   · 고딕 소용돌이 장식 테두리 · 가장자리 비네트 · 방향키/드래그로 이동 · Z/휠/핀치/+– 로 0.6 ~ 2.5배 확대 (아래 「보기」)
//   · 방 상태 3단계 색 · 무늬 · 글 배지 (systems/RoomState.js) · 1.2배부터 방 안 지형 · 문 · 핀 이름
import Phaser from 'phaser';
import { STAGES, mapColor, areaLabel } from '../data/stages.js';
import { HK, hkText } from './ui.js';
import { roundPortrait } from './Textures.js';
import { TILE } from '../config.js';
import { roomState, ROOM_STATES } from './RoomState.js';

export const VP = { x: 30, y: 64, w: 580, h: 236 };   // 지도가 보이는 창 (논리 좌표)
const ARENA = new Set(['mini', 'boss', 'sanctuary']);

// ---------------- 모델: 월드 → 방 블록 · 통로 ----------------
export function buildMapModel(level, explored) {
  const { cols, rows } = level;
  const seenRect = (x0, x1, y0, y1) => {
    if (!explored) return false;
    for (let y = Math.max(0, y0); y <= Math.min(rows - 1, y1); y += 2)
      for (let x = Math.max(0, x0); x <= Math.min(cols - 1, x1); x += 2) if (explored[y * cols + x]) return true;
    return false;
  };
  const sideOf = new Map((level.sides || []).map(sd => [sd.room, sd])), wallOf = new Map((level.breakables || []).map(b => [b.door, b]));
  const blocks = level.rooms.map(r => {
    const sd = sideOf.get(r), veiled = !!(sd && !sd.revealed);   // 흙 덮개가 아직 그대로인 굴
    const seen = !veiled && (r.entered || seenRect(r.tx0, r.tx1 - 1, r.ty0, r.F - 1));
    return { r, xa: r.tx0, xb: r.tx1, ya: r.ty0, yb: r.F, seen, veiled };
  });
  const byRoom = new Map(blocks.map(b => [b.r, b]));
  const corridors = level.doors.filter(d => !d.sealed).map(d => {   // sealed: 벽으로 메운 문 (방울탑 샛길)
    const w = wallOf.get(d), shut = !!(w && !w.broken);
    if (d.portal) { const out = d.a.portalTo || d.a.riftTo ? d.a : d.b, inn = out === d.a ? d.b : d.a; return { A: byRoom.get(d.a), B: byRoom.get(d.b), portal: true, rift: !!d.rift, closed: !!(d.rift && !out.cleared), name: d.portalName, ends: [{ b: byRoom.get(out), p: d.portalOut, out: true }, { b: byRoom.get(inn), p: d.portalIn }] }; }   // rift: 창기둥 제단 뒤 차원 균열 (펄기아까지 정화해야 열린다)
    if (d.dir === 'h') { const Fr = d.my + 2.5; return { A: byRoom.get(d.L), B: byRoom.get(d.R), x0: d.mx - 2, x1: d.mx + 2, y0: Fr - 5, y1: Fr, shut, secret: d.breakable || d.hidden }; }
    return { A: byRoom.get(d.U), B: byRoom.get(d.D), x0: d.cap, x1: d.cap + 4, y0: d.U.F, y1: d.D.ty0, vertical: true, grate: !d.breakable, shut, secret: d.breakable || d.hidden };
  });
  // 히든 성소 힌트: 문으로 이어진 방 중 하나라도 봤으면 「?」
  for (const b of blocks) if (b.r.type === 'sanctuary' && !b.seen) b.hint = corridors.some(c => (c.A === b && c.B.seen) || (c.B === b && c.A.seen));
  const total = blocks.filter(b => !b.veiled && b.r.type !== 'sanctuary').length;
  const seenN = blocks.filter(b => b.seen && b.r.type !== 'sanctuary').length;
  return { blocks, corridors, byRoom, progress: total ? Math.min(1, seenN / total) : 0 };
}

// ---------------- 보기 ----------------
// 🗺️ 인터랙티브 고디테일 전술 지도
//  확대: 0.6× (지방 전체 조망) ~ 2.5× (방 안 상세) — 휠(커서 자리를 붙잡고) · 지도 창 오른쪽 위 [–][+] · Z · 휴대폰 두 손가락 핀치. 부드럽게 이어진다
//  이동: 마우스 · 터치 드래그 · 방향키
//  방 상태 (systems/RoomState.js — 화면 위 현재 방 배지와 같은 말 · 같은 색):
//   ⚠️ 침식 구역(샛길 · 정화 가능): 검붉고 보랏빛인 침식 독기 맥동 줄기 + 해골 침식 마크
//   ✨ 정화 완료(샛길): 에메랄드 바탕 · 금빛 테두리 · 반짝이는 별 알갱이
//   ♾️ 심연 침식로(본길 · 정화 불가 · 재진입 시 리젠): 검붉은 가시 덩굴 문양 + 진홍 오라 맥동 + ♾ 표식
//  DETAIL(1.2×) 이상: 방 안 지형 실루엣(벽 · 단상 · 통과 발판) · 문 자리 · 방 상태 글 배지(남은 침식 개체 수) · 핀 이름(🟡 기술머신 · 🛒 상점 · 💀 보스 · 🔥 회복)
export const Z_MIN = .6, Z_MAX = 2.5, DETAIL = 1.2;

// 방 안 지형 실루엣: 벽('S' · 'B')과 통과 발판('P' · 'H')을 가로로 이어 붙인 줄 — 지방마다 한 번 세어 둔다
function roomRuns(lv, r) {
  const cache = lv.mapRuns || (lv.mapRuns = new Map());
  if (cache.has(r)) return cache.get(r);
  const solid = [], plat = [], G = lv.grid;
  for (let y = r.ty0; y < r.F; y++) {
    const row = G[y]; if (!row) continue;
    let s0 = -1, p0 = -1;
    for (let x = r.tx0; x <= r.tx1; x++) {
      const c = x < r.tx1 ? row[x] : '.', sol = c === 'S' || c === 'B', pl = c === 'P' || c === 'H';
      if (sol && s0 < 0) s0 = x; if (!sol && s0 >= 0) { solid.push([s0, x, y]); s0 = -1; }
      if (pl && p0 < 0) p0 = x; if (!pl && p0 >= 0) { plat.push([p0, x, y]); p0 = -1; }
    }
  }
  const out = { solid, plat };
  cache.set(r, out);
  return out;
}
// 방마다 늘 같은 무늬 (방 번호로 정하는 의사 난수)
const rnd = seed => { let s = (seed * 9301 + 49297) % 233280; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };

export class MapView {
  // ci: 보여 줄 지방 (지금 있는 지방이 아니어도 — 한 번이라도 들른 지방이면)
  constructor(ui, layer, ci) {
    this.ui = ui; this.L = layer;
    const gs = ui.gs, W = gs.worlds[ci], lv = W.level;
    this.gs = gs; this.ci = ci; this.W = W; this.lv = lv; this.stage = STAGES[ci];
    this.here = ci === gs.stageIdx;
    this.model = buildMapModel(lv, W.explored);
    this.progress = this.model.progress;
    this.base = Math.min(VP.w / lv.cols, VP.h / lv.rows) * .94;   // Z_MIN 에서 지방 전체가 창에 들어오는 배율
    const p = gs.player;
    this.z = this.here ? 1.6 : Z_MIN;
    if (this.here) { this.cx = p.x / TILE; this.cy = p.bottom / TILE - 4; }
    else { this.cx = lv.cols / 2; this.cy = lv.rows / 2; }
    // 지도 내용 (창 밖은 가린다)
    this.content = ui.add.container(0, 0); layer.add(this.content);
    const mg = ui.make.graphics({ add: false }); mg.fillStyle(0xffffff); mg.fillRect(VP.x, VP.y, VP.w, VP.h);
    this.content.setMask(mg.createGeometryMask()); this.maskG = mg;
    this.drawFrame();
    this.tZoom = hkText(ui, VP.x + VP.w - 4, VP.y + VP.h + 6, '', 9, HK.dim, { origin: [1, 0] }); layer.add(this.tZoom);
    this.clampPan();
    this.draw();
    // 드래그 이동 · 두 손가락 핀치 확대 · 휠 확대(커서 자리를 붙잡고)
    if (ui.input.manager.pointersTotal < 2) ui.input.addPointer(1);
    const cam = ui.cameras.main, at = ptr => cam.getWorldPoint(ptr.x, ptr.y);
    this.zone = ui.add.zone(VP.x, VP.y, VP.w, VP.h).setOrigin(0).setInteractive({ draggable: false }); layer.add(this.zone);
    this.zone.on('pointermove', ptr => {
      const p1 = ui.input.pointer1, p2 = ui.input.pointer2;
      if (p1 && p2 && p1.isDown && p2.isDown) {   // 핀치
        const a = at(p1), b = at(p2), d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchD) this.zoomAt(this.z * d / this.pinchD, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinchD = d;
        return;
      }
      this.pinchD = null;
      if (!ptr.isDown) return;
      const s = this.scale(); this.cx -= (ptr.x - ptr.prevPosition.x) / cam.zoom / s; this.cy -= (ptr.y - ptr.prevPosition.y) / cam.zoom / s; this.clampPan(); this.draw();
    });
    this.zone.on('pointerup', () => { this.pinchD = null; });
    this.onWheel = (ptr, objs, dx, dy) => { const w = at(ptr); if (w.x < VP.x || w.x > VP.x + VP.w || w.y < VP.y || w.y > VP.y + VP.h) return; this.zoomAt(this.z * (dy > 0 ? 1 / 1.15 : 1.15), w.x, w.y); };
    ui.input.on('wheel', this.onWheel);
  }

  scale(z = this.z) { return this.base * z / Z_MIN; }
  clampPan() {
    const s = this.scale(), hw = VP.w / 2 / s, hh = VP.h / 2 / s, { cols, rows } = this.lv, mx = 40 / s, my = 30 / s;   // 가장자리 방도 가운데 올 수 있게 조금 여유
    this.cx = Phaser.Math.Clamp(this.cx, Math.min(hw - mx, cols / 2), Math.max(cols - hw + mx, cols / 2));
    this.cy = Phaser.Math.Clamp(this.cy, Math.min(hh - my, rows / 2), Math.max(rows - hh + my, rows / 2));
  }
  // ax · ay(화면 논리 좌표) 아래의 지점을 붙잡은 채 확대 배율을 z 로 (바로)
  zoomAt(z, ax = VP.x + VP.w / 2, ay = VP.y + VP.h / 2) {
    z = Phaser.Math.Clamp(z, Z_MIN, Z_MAX);
    if (Math.abs(z - this.z) < 1e-4) return;
    const s0 = this.scale(), s1 = this.scale(z), mx = VP.x + VP.w / 2, my = VP.y + VP.h / 2;
    const wx = this.cx + (ax - mx) / s0, wy = this.cy + (ay - my) / s0;
    this.z = z; this.cx = wx - (ax - mx) / s1; this.cy = wy - (ay - my) / s1;
    this.clampPan(); this.draw();
  }
  // 버튼 · 키: 0.16초에 걸쳐 부드럽게
  zoomTo(z, ax, ay) {
    z = Phaser.Math.Clamp(z, Z_MIN, Z_MAX);
    if (this.zoomTw) this.zoomTw.stop();
    const from = this.z;
    this.zoomTw = this.ui.tweens.addCounter({ from: 0, to: 1, duration: 160, ease: 'Sine.easeOut', onUpdate: tw => this.zoomAt(from + (z - from) * tw.getValue(), ax, ay) });
  }
  zoom(d) { this.zoomTo(this.z * (d > 0 ? 1.3 : 1 / 1.3)); }
  pan(dx, dy) { const s = this.scale(); this.cx += dx * 46 / s; this.cy += dy * 34 / s; this.clampPan(); this.draw(); }
  key(e) {
    if (e.code === 'ArrowLeft') this.pan(-1, 0); else if (e.code === 'ArrowRight') this.pan(1, 0);
    else if (e.code === 'ArrowUp') this.pan(0, -1); else if (e.code === 'ArrowDown') this.pan(0, 1);
    else if (e.code === 'KeyZ') { if (e.shiftKey) this.zoom(-1); else if (this.z >= Z_MAX - .01) this.zoomTo(Z_MIN); else this.zoom(1); }
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') this.zoom(1);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.zoom(-1);
  }

  // 지도 내용 다시 그리기 (이동·확대할 때마다)
  draw() {
    const ui = this.ui, C = this.content, lv = this.lv, st = this.stage, s = this.scale(), gs = this.gs, detail = this.z >= DETAIL - 1e-6;
    ui.tweens.killTweensOf(C.list);
    C.removeAll(true);
    const ox = VP.x + VP.w / 2 - this.cx * s, oy = VP.y + VP.h / 2 - this.cy * s;
    const X = x => ox + x * s, Y = y => oy + y * s;
    const inView = (x, y, w, h) => x + w > VP.x - 20 && x < VP.x + VP.w + 20 && y + h > VP.y - 20 && y < VP.y + VP.h + 20;
    const { blocks, corridors } = this.model, col = b => mapColor(st.areas[b.r.ai]);
    const g = ui.add.graphics(); C.add(g);
    const gVein = ui.add.graphics().setBlendMode(Phaser.BlendModes.ADD), gAbyss = ui.add.graphics().setBlendMode(Phaser.BlendModes.ADD), gStar = ui.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const labels = [];
    // ① 방 블록: 상태별 바탕 (지역 색 · 침식 · 정화 · 심연 침식로) + 외곽선
    for (const b of blocks) {
      if (!b.seen) continue;
      const c = col(b), x = X(b.xa), y = Y(b.ya), w = (b.xb - b.xa) * s, h = (b.yb - b.ya) * s, side = b.r.branch && !ARENA.has(b.r.type);
      if (!inView(x, y, w, h)) continue;
      const rs = roomState(gs, b.r, lv), k = rs ? rs.key : null, R = rnd(b.r.id + 7);
      b.state = k;
      if (k === 'corrupt') {
        g.fillStyle(0x2a0820, .9); g.fillRect(x, y, w, h);
        g.fillStyle(0x6a1a4a, .25); for (let yy = y + 2; yy < y + h - 1; yy += 4) g.fillRect(x + 1, yy, w - 2, 1);   // 잿빛 · 보랏빛 침식 줄무늬
        // 침식 독기 맥동 줄기: 바닥에서 솟아 갈라지는 검붉은 · 보랏빛 혈관 (따로 그린 층이 숨 쉬듯 밝아졌다 어두워진다)
        const n = Math.max(2, Math.min(7, Math.round(w / 26)));
        for (let i = 0; i < n; i++) {
          let px = x + w * (i + .5) / n + (R() - .5) * 6, py = y + h;
          const pts = [{ x: px, y: py }];
          for (let j = 0; j < 4; j++) { px += (R() - .5) * Math.min(16, w / n); py -= h * (.18 + R() * .12); pts.push({ x: Phaser.Math.Clamp(px, x + 1, x + w - 1), y: Math.max(y + 1, py) }); }
          gVein.lineStyle(Math.max(1, Math.min(2.4, s * .9)), i % 2 ? 0xc04aff : 0xff3a7a, .9); gVein.strokePoints(pts, false);
        }
        gVein.lineStyle(Math.max(1.2, Math.min(2.4, s * 1.4)), 0xff5ab0, .9); gVein.strokeRect(x, y, w, h);
      } else if (k === 'pure') {
        g.fillStyle(0x1f8f6c, .84); g.fillRect(x, y, w, h);
        g.fillStyle(0xffe08a, .26); g.fillRect(x, y, w, Math.max(2, h * .22));   // 금빛 햇살
        const n = Math.max(1, Math.min(8, Math.round(w * h / 900)));
        for (let i = 0; i < n; i++) { const sx = x + 3 + R() * (w - 6), sy = y + 3 + R() * (h - 6), u = Math.max(1.2, Math.min(2.6, s * .8)); gStar.fillStyle(0xfff4c0, .95); gStar.fillRect(sx - u, sy - .5, u * 2, 1); gStar.fillRect(sx - .5, sy - u, 1, u * 2); }   // 반짝이는 별 알갱이
      } else if (k === 'abyss') {
        g.fillStyle(0x24060c, .9); g.fillRect(x, y, w, h);
        // 검붉은 가시 덩굴: 방을 가로지르는 지그재그 줄기 + 짧은 가시
        g.lineStyle(Math.max(1, Math.min(2, s * .7)), 0x7a1424, .95);
        for (let row = 0; row < Math.max(1, Math.round(h / 22)); row++) {
          const yy = y + h * (row + .5) / Math.max(1, Math.round(h / 22)), pts = [];
          for (let xx = x + 2, k2 = 0; xx < x + w - 1; xx += Math.max(4, 6 * Math.min(1.6, s)), k2++) pts.push({ x: xx, y: yy + (k2 % 2 ? -2 : 2) * Math.min(1.5, s * .6) });
          if (pts.length > 1) { g.strokePoints(pts, false); for (let q = 1; q < pts.length; q += 2) g.lineBetween(pts[q].x, pts[q].y, pts[q].x + 1.5, pts[q].y - 3); }
        }
        gAbyss.lineStyle(Math.max(1.4, Math.min(2.6, s * 1.5)), 0xff2a4a, .95); gAbyss.strokeRect(x, y, w, h);
        gAbyss.fillStyle(0xff2a4a, .12); gAbyss.fillRect(x, y, w, h);
      } else {
        g.fillStyle(c.fill, b.r.under ? .5 : .74); g.fillRect(x, y, w, h);
      }
      const edge = k === 'pure' ? 0xffd860 : k === 'corrupt' ? 0xa83a72 : k === 'abyss' ? 0xc02a3a : side ? 0x9ad8ff : 0xefeae0;
      g.lineStyle(Math.max(1.2, Math.min(2.4, s * 1.4)), edge, b.r.under && !k ? .62 : .9); g.strokeRect(x, y, w, h);
      // 방 가운데 표식: 침식 해골 · ♾ (작게 · 방이 충분히 클 때)
      if (w > 22 && h > 14) {
        const mx = x + w / 2, my = y + h / 2;
        if (k === 'corrupt') { const kk = Math.min(1.6, s * .55); g.fillStyle(0xd08aff, .95); g.fillCircle(mx, my - kk, 3 * kk); g.fillRect(mx - 1.8 * kk, my + 1.4 * kk, 3.6 * kk, 1.8 * kk); g.fillStyle(0x2a0820, 1); g.fillCircle(mx - 1.1 * kk, my - 1.2 * kk, .8 * kk); g.fillCircle(mx + 1.1 * kk, my - 1.2 * kk, .8 * kk); }
        else if (k === 'abyss') labels.push(hkText(ui, mx, my, '♾', Math.min(16, Math.max(8, s * 3.4)), '#ff4a5a', { origin: .5, bold: true }).setAlpha(.85));
        else if (k === 'pure' && !detail) labels.push(hkText(ui, mx, my, '✦', Math.min(14, Math.max(7, s * 3)), '#fff4c0', { origin: .5 }));
      }
      // 🔎 상세(1.2× 이상): 방 안 지형 실루엣 — 벽 · 단상은 짙게, 통과 발판은 밝은 선
      if (detail && w > 20) {
        const run = roomRuns(lv, b.r);
        g.fillStyle(0x07050c, k ? .55 : .5);
        for (const [x0, x1, yy] of run.solid) g.fillRect(X(x0), Y(yy), (x1 - x0) * s, s);
        g.fillStyle(k === 'pure' ? 0xfff0c0 : k === 'corrupt' ? 0xffb0d8 : k === 'abyss' ? 0xff9aa8 : 0xefeae0, .75);
        for (const [x0, x1, yy] of run.plat) g.fillRect(X(x0), Y(yy), (x1 - x0) * s, Math.max(1, s * .3));
      }
    }
    C.add([gAbyss, gVein, gStar]);
    // 맥동: 침식 줄기는 숨 쉬듯 (0.75초) · 심연 침식로의 진홍 오라는 빠르게 (0.45초) · 별 알갱이는 반짝
    gVein.setAlpha(.45); ui.tweens.add({ targets: gVein, alpha: 1, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    gAbyss.setAlpha(.35); ui.tweens.add({ targets: gAbyss, alpha: .95, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    gStar.setAlpha(.3); ui.tweens.add({ targets: gStar, alpha: 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // ② 통로: 둘 다 봤으면 외곽선을 덮어 이어 붙이고, 한쪽만이면 안 가 본 쪽으로 흰 점선 + ? (비밀 문은 점선도 없다)
    for (const cd of corridors) {
      const A = cd.A, B = cd.B;
      if (!A.seen && !B.seen) continue;
      if (cd.portal) {   // 건물 출입문(포털): 이어 붙이지 않고 양쪽 방에 금빛 문 아이콘 — 독립된 던전으로 들어가는 입구 (차원 균열은 검붉은 소용돌이 · 열리기 전엔 안 그린다)
        if (cd.closed) continue;
        for (const { b, p, out } of cd.ends) {
          if (!b || !b.seen || !p) continue;
          const x = X(p.x + .5), y = Y(p.y), u = Math.max(3.5, Math.min(7, s * 2.2));
          if (cd.rift) {
            g.fillStyle(0x12000a, .95); g.fillEllipse(x, y - u * 1.4, u * 1.7, u * 2.7);
            g.lineStyle(1.4, 0xff2a4a, 1); g.strokeEllipse(x, y - u * 1.4, u * 1.7, u * 2.7);
            g.lineStyle(1, 0xc06aff, .9); g.strokeEllipse(x, y - u * 1.4, u * 2.4, u * 3.4);
            if (detail && out && cd.name) C.add(hkText(ui, x, y - u * 3.2, cd.name, 7.5, '#ffa0b8', { bold: true, ls: 1, origin: [.5, 1] }));
            continue;
          }
          g.fillStyle(0x140a06, .95); g.fillRect(x - u, y - u * 2.2, u * 2, u * 2.2);
          g.fillStyle(0xffd890, .85); g.fillRect(x - u * .45, y - u * 1.5, u * .9, u * 1.5);
          g.lineStyle(1.2, 0xffd060, 1); g.strokeRect(x - u, y - u * 2.2, u * 2, u * 2.2);
          g.fillStyle(0xb83a24, 1); g.fillTriangle(x - u * 1.6, y - u * 2.2, x + u * 1.6, y - u * 2.2, x, y - u * 3.2);
          g.lineStyle(1, 0xffd060, .9); g.lineBetween(x - u * 1.6, y - u * 2.2, x + u * 1.6, y - u * 2.2);
          if (detail && out && cd.name) C.add(hkText(ui, x, y - u * 3.4, cd.name, 7.5, '#ffd890', { bold: true, ls: 1, origin: [.5, 1] }));
        }
        continue;
      }
      if (cd.shut && !(A.seen && B.seen)) continue;
      const x0 = X(cd.x0), x1 = X(cd.x1), y0 = Y(cd.y0), y1 = Y(cd.y1), c = col(A.seen ? A : B), lw = Math.max(1.2, Math.min(2.4, s * 1.4));
      if (A.seen && B.seen) {
        if (cd.shut) {   // 둘 다 봤지만 아직 안 무너뜨린 벽: 금 간 자국만
          g.lineStyle(1, 0xd8c8a0, .7);
          const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          g.lineBetween(mx - 2, my - 4, mx + 1, my); g.lineBetween(mx + 1, my, mx - 1, my + 4);
          continue;
        }
        g.fillStyle(c.fill, .8);
        if (cd.vertical) {
          g.fillRect(x0 + lw / 2, y0 - lw, x1 - x0 - lw, y1 - y0 + lw * 2);
          g.lineStyle(lw, 0xefeae0, .85); g.lineBetween(x0, y0, x0, y1); g.lineBetween(x1, y0, x1, y1);
          if (cd.grate) { g.lineStyle(1, 0xefeae0, .7); for (let x = x0 + 1; x < x1 - 1; x += 3) g.lineBetween(x, y0, x + 1.5, y0); }   // 철창 뚜껑
        } else {
          g.fillRect(x0 - lw, y0 + lw / 2, x1 - x0 + lw * 2, y1 - y0 - lw);
          g.lineStyle(lw, 0xefeae0, .85); g.lineBetween(x0, y0, x1, y0); g.lineBetween(x0, y1, x1, y1);
        }
        if (detail) {   // 문 자리: 방 테두리에 금빛 문틀 (좌우 문은 세로 · 위아래 갱도는 가로)
          g.fillStyle(0xffd890, .95);
          if (cd.vertical) { g.fillRect(x0, y0 - 1, x1 - x0, 2); g.fillRect(x0, y1 - 1, x1 - x0, 2); }
          else { g.fillRect(x0 - 1, y0, 2, y1 - y0); g.fillRect(x1 - 1, y0, 2, y1 - y0); }
        }
      } else {
        if ((A.seen ? B : A).veiled) continue;   // 흙에 덮인 굴로 가는 길은 아직 모른다
        if ((A.seen ? B : A).r.type === 'sanctuary') continue;
        g.fillStyle(0xffffff, .75);
        const step = 4.5, len = 14;
        let qx, qy;
        if (cd.vertical) {
          const xm = (x0 + x1) / 2, ys = A.seen ? Y(cd.y0) : Y(cd.y1), dir = A.seen ? 1 : -1;
          for (let k = 0; k < len; k += step) g.fillRect(xm - 1, ys + dir * k - 1, 2, 2);
          qx = xm; qy = ys + dir * (len + 5);
        } else {
          const ym = (y0 + y1) / 2, xs = A.seen ? x0 : x1, dir = A.seen ? 1 : -1;
          for (let k = 0; k < len; k += step) g.fillRect(xs + dir * k - 1, ym - 1, 2, 2);
          qx = xs + dir * (len + 5); qy = ym;
        }
        labels.push(hkText(ui, qx, qy, '?', 8, '#e8e0d0', { origin: .5, bold: true }).setAlpha(.8));   // 미탐사 연결 통로
      }
    }
    // ③ 방 안 장식: 시내(집 실루엣 + 센터 아치) · 아레나 기둥 · 기술머신 샛길 이름
    for (const b of blocks) {
      if (!b.seen) continue;
      const r = b.r, fy = Y(b.yb), mid = (b.xa + b.xb) / 2;
      if (r.type === 'village') {
        g.lineStyle(1, 0xffffff, .35);
        for (const hx of [b.xa + 9, b.xb - 9]) {   // 박공지붕 집 두 채
          const L = X(hx - 4), R = X(hx + 4), top = Y(b.yb - 5), roof = Y(b.yb - 7.5);
          g.strokePoints([{ x: L, y: fy }, { x: L, y: top }, { x: X(hx), y: roof }, { x: R, y: top }, { x: R, y: fy }], false);
        }
        const rr = 5 * s;
        g.beginPath(); g.arc(X(mid), fy, rr, Math.PI, 0); g.strokePath();
        g.beginPath(); g.arc(X(mid), fy, rr * .55, Math.PI, 0); g.strokePath();
      } else if (ARENA.has(r.type)) {
        g.lineStyle(1, 0xffffff, .26);
        for (const k of [.1, .9]) { const x = X(b.xa + (b.xb - b.xa) * k); g.lineBetween(x - 1.5, fy, x - 1.5, Y(b.yb - 8)); g.lineBetween(x + 1.5, fy, x + 1.5, Y(b.yb - 9)); }
      } else if (r.type === 'tm' && detail) {
        C.add(hkText(ui, X(mid), Y(b.ya) - 2, '샛길', 7.5, '#9ad8ff', { bold: true, ls: 2, origin: [.5, 1] }));
      }
      // 🔎 상세: 방 상태 글 배지 (침식 구역은 남은 침식 개체 수까지 — 지금 있는 지방만 셀 수 있다)
      if (detail && (b.state === 'corrupt' || b.state === 'pure' || b.state === 'abyss')) {
        const rs = ROOM_STATES[b.state], w = (b.xb - b.xa) * s;
        if (w < 34) continue;
        const left = b.state === 'corrupt' && this.here && gs.sideRemain ? gs.sideRemain(r) : null;
        const t = hkText(ui, X(mid), Y(b.ya) + 2, rs.short + (left != null ? ` (${left})` : ''), Math.min(8, Math.max(6.5, s * 1.6)), rs.col, { origin: [.5, 0], bold: true });
        if (t.width > w - 4) t.setText(rs.icon + (left != null ? ` ${left}` : ''));
        labels.push(t);
      }
    }
    // ④ 지역 이름: 그 지역의 본 방들 위 가운데 (들른 지역만). 겹치면 위로 한 단씩
    const placed = [];
    st.areas.forEach((a, ai) => {
      const bs = blocks.filter(b => b.r.ai === ai && b.seen && !b.r.secret);
      if (!bs.length || !this.W.areasSeen.has(ai)) return;
      const xa = Math.min(...bs.map(b => b.xa)), xb = Math.max(...bs.map(b => b.xb)), top = Math.min(...bs.map(b => b.ya));
      const c = mapColor(a), hex = '#' + c.line.toString(16).padStart(6, '0');
      const name = hkText(ui, 0, 0, a.name, 9, hex, { bold: true, ls: 1, origin: [.5, 1], glow: true, glowColor: 'rgba(0,0,0,.9)' });
      const hw = name.width / 2 + 4, cx = Phaser.Math.Clamp((X(xa) + X(xb)) / 2, VP.x + hw, VP.x + VP.w - hw);   // 창 가장자리에서 잘리지 않게
      let y = Math.max(VP.y + 24, Y(top) - 5);
      name.setX(cx);
      while (placed.some(q => cx - hw < q.x1 && cx + hw > q.x0 && Math.abs(q.y - y) < 24)) y -= 24;
      placed.push({ x0: cx - hw, x1: cx + hw, y });
      name.setY(y);
      C.add([name, hkText(ui, cx, y - 12, areaLabel(this.ci, ai, a), 7.5, HK.dim, { title: true, ls: 2, origin: [.5, 1] })]);
    });
    C.add(labels);
    // ⑤ 원형 핀 (상세에선 아래에 이름: 🟡 기술머신 · 🛒 상점 · 💀 보스 · 🔥 회복)
    const pg = ui.add.graphics(); C.add(pg);
    const caps = [];
    const capBoxes = [];
    const cap = (x, y, s2, color) => {   // 핀 이름: 이미 놓인 이름과 겹치면 한 줄 아래로 · 그래도 겹치면 생략 (핀이 몰린 시내)
      if (!detail) return;
      const t = hkText(ui, x, y + 9, s2, 6.5, color, { origin: [.5, 0], bold: true }), w = t.width, h = 8;
      for (let k = 0; k < 3; k++) {
        const ty = y + 9 + k * 8.5, box = { x0: x - w / 2 - 1, x1: x + w / 2 + 1, y0: ty, y1: ty + h };
        if (!capBoxes.some(q => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0)) { t.setY(ty); capBoxes.push(box); caps.push(t); return; }
      }
      t.destroy();
    };
    const pin = (x, y, ring, fill, r = 6.5, a = 1) => { pg.fillStyle(0x000000, .5 * a); pg.fillCircle(x + .8, y + 1.2, r + .7); pg.fillStyle(fill, a); pg.fillCircle(x, y, r); pg.lineStyle(1.6, ring, a); pg.strokeCircle(x, y, r); };
    const skull = (x, y, k, fill) => {
      pg.fillStyle(0xf4f0e8, 1); pg.fillCircle(x, y - .8 * k, 3.2 * k); pg.fillRect(x - 2 * k, y + 1.4 * k, 4 * k, 2 * k);
      pg.fillStyle(fill, 1); pg.fillCircle(x - 1.2 * k, y - 1 * k, .9 * k); pg.fillCircle(x + 1.2 * k, y - 1 * k, .9 * k); pg.fillRect(x - .3 * k, y + 1.6 * k, .6 * k, 1.6 * k);
    };
    const question = (x, y, a) => C.add(hkText(ui, x, y + .5, '?', 9, '#e0b0ff', { bold: true, origin: .5 }).setAlpha(a));
    for (const m of lv.marks) {
      const b = this.model.byRoom.get(m.room);
      if (!b) continue;
      const x = X(m.x + .5), y = Y(m.y) - 9;
      if (m.kind === 'hidden') {   // 히든 전설: 보라 ? (가 보기 전엔 옆방에서 본 흐릿한 힌트만)
        if (!b.seen && !b.hint) continue;
        const a = b.seen ? 1 : .55, done = m.room.cleared;
        pin(x, y, done ? 0x8a8478 : 0xd08aff, done ? 0x1a1420 : 0x2a1040, 6.5, a);
        question(x, y, a);
        continue;
      }
      if (!b.seen) continue;
      if (m.kind === 'center') {   // 몬스터볼
        pin(x, y, 0xffffff, 0x1a1028);
        pg.fillStyle(0xe8484a, 1); pg.slice(x, y, 4.2, Math.PI, 0, false); pg.fillPath();
        pg.fillStyle(0xf4f0e8, 1); pg.slice(x, y, 4.2, 0, Math.PI, false); pg.fillPath();
        pg.fillStyle(0x1a1028, 1); pg.fillRect(x - 4.2, y - .6, 8.4, 1.2); pg.fillCircle(x, y, 1.6); pg.fillStyle(0xffffff, 1); pg.fillCircle(x, y, .9);
        cap(x, y, '🔥 회복 · 센터', '#ffd0a0');
      } else if (m.kind === 'corvi') {   // 아머까오: 남색 바탕에 은빛 날개
        pin(x, y, 0xb8c8ff, 0x1a2448);
        pg.lineStyle(1.4, 0xd8e0f0, 1);
        pg.strokePoints([{ x: x - 4, y: y - 1.5 }, { x: x - 1.5, y: y + .5 }, { x, y: y - .5 }, { x: x + 1.5, y: y + .5 }, { x: x + 4, y: y - 1.5 }], false);
        pg.fillStyle(0xd8e0f0, 1); pg.fillCircle(x, y + 1.6, 1.1);
        cap(x, y, '아머까오', '#c8d8ff');
      } else if (m.kind === 'boss' || m.kind === 'mini') {   // 해골 (지방 보스는 크게 · 정화하면 회색)
        const big = m.kind === 'boss', done = m.room.cleared;
        pin(x, y, done ? 0x8a8478 : big ? 0xff8a8a : 0xffc08a, done ? 0x1a1414 : 0x2a0a14, big ? 7.5 : 5.2);
        skull(x, y, big ? 1.15 : .8, done ? 0x1a1414 : 0x2a0a14);
        cap(x, y + (big ? 1 : -1), done ? '💀 정화 완료' : big ? '💀 지방 보스 제단' : '💀 중간 보스', done ? '#a8a094' : '#ffa8a0');
      } else if (m.kind === 'tm') {   // 기술머신 디스크 (카드를 고르고 나면 회색 · 봉인된 받침대는 붉은 테)
        if (m.pr && m.pr.secret && !m.pr.secret.broken) continue;   // 🟡 비밀 벽감: 벽이 무너지기 전엔 지도에도 없다
        const used = m.pr ? m.pr.used : lv.props.some(q => q.kind === 'tm' && q.x === m.x && q.used);
        const sealed = !used && m.pr && m.pr.seal && gs && gs.tmSealed && gs.tmSealed(m.pr);
        pin(x, y, used ? 0x8a8478 : sealed ? 0xff6a8a : 0xffd84a, sealed ? 0x2a0a14 : 0x101828);
        pg.fillStyle(used ? 0x5a5a6a : 0xffc84a, 1); pg.fillCircle(x, y, 4.2);
        pg.fillStyle(used ? 0x8a8a9a : 0xfff0b0, 1); pg.fillCircle(x, y, 2.8);
        pg.fillStyle(0x101828, 1); pg.fillCircle(x, y, 1.1);
        cap(x, y, used ? '기술머신 (받음)' : sealed ? '🔒 봉인된 기술머신' : '🟡 기술머신', used ? '#a8a094' : '#ffe08a');
      } else if (m.kind === 'terminal') {   // 간이 포켓몬 회복기 (회복 성소): 청록 바탕에 흰 십자
        pin(x, y, 0x7dffd0, 0x0a2a24);
        pg.fillStyle(0xffffff, 1); pg.fillRect(x - .9, y - 3.2, 1.8, 6.4); pg.fillRect(x - 3.2, y - .9, 6.4, 1.8);
        cap(x, y, '🔥 회복 성소', '#9affd8');
      } else if (m.kind === 'potion') {   // 상처약 (주우면 사라진다)
        if (lv.potions.some(pt => pt.room === m.room && pt.taken)) continue;
        pin(x, y, 0xe8b0ff, 0x1a1028);
        pg.fillStyle(0xd88aff, 1); pg.fillRoundedRect(x - 2.6, y - 1.6, 5.2, 5, 1.4);
        pg.fillStyle(0xf4f0e8, 1); pg.fillRect(x - 1.4, y - 3.6, 2.8, 2);
        pg.fillStyle(0xffffff, .8); pg.fillRect(x - 1.6, y - .8, 1, 2.6);
        cap(x, y, '상처약', '#e8b0ff');
      } else if (m.kind === 'chest') {
        const op = lv.chests.some(c => Math.abs(c.x - (m.x * TILE + 8)) < 2 && c.opened);
        pin(x, y, op ? 0x8a8478 : 0xffe8a0, 0x1a1408);
        pg.fillStyle(op ? 0x6a5a40 : 0xffc84a, 1); pg.fillRect(x - 3.4, y - 1.6, 6.8, 4.4);
        pg.fillStyle(op ? 0x4a4030 : 0xd8902a, 1); pg.fillRect(x - 3.4, y - 3, 6.8, 1.8);
        pg.fillStyle(0x1a1408, 1); pg.fillRect(x - .6, y - .8, 1.2, 1.6);
        cap(x, y, op ? '보물 (열림)' : '보물 상자', op ? '#a8a094' : '#ffe8a0');
      }
    }
    // 🛒 포켓샵 (시내 · 상점 건물 자리): 남색 바탕에 노란 카트
    for (const pr of lv.props) {
      if (pr.kind !== 'mart') continue;
      const rr = lv.rooms.find(q => q.type === 'village' && pr.x >= q.tx0 && pr.x < q.tx1 && pr.g >= q.ty0 && pr.g <= q.F + 1), b = rr && this.model.byRoom.get(rr);
      if (!b || !b.seen) continue;
      const x = X(pr.x + (pr.w || 6) / 2), y = Y(pr.g) - 9;
      pin(x, y, 0x8ac8ff, 0x10203a);
      pg.lineStyle(1.2, 0xffd84a, 1); pg.strokePoints([{ x: x - 4, y: y - 3 }, { x: x - 2.6, y: y - 3 }, { x: x - 1.6, y: y + 1.4 }, { x: x + 3.4, y: y + 1.4 }, { x: x + 4, y: y - 1.6 }, { x: x - 2.2, y: y - 1.6 }], false);
      pg.fillStyle(0xffd84a, 1); pg.fillCircle(x - 1, y + 3, .9); pg.fillCircle(x + 2.6, y + 3, .9);
      cap(x, y, '🛒 포켓샵', '#9ad8ff');
    }
    C.add(caps);
    // 현재 위치: 빛나는 출전 포켓몬 초상화 핀 (지금 있는 지방일 때만)
    if (this.here) {
      const p = gs.player, px = X(p.x / TILE), py = Y(p.bottom / TILE) - 10;
      const halo = ui.add.image(px, py, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd8a0).setScale(.55).setAlpha(.8);
      ui.tweens.add({ targets: halo, scale: .8, alpha: .35, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const ring = ui.add.circle(px, py, 8.5, 0x1a1028).setStrokeStyle(1.8, 0xffffff);
      const face = ui.add.image(px, py, roundPortrait(ui, p.formKey())).setScale(.38);
      const tip = ui.add.triangle(px, py + 11, -3, 0, 3, 0, 0, 4, 0xffffff);
      C.add([halo, ring, face, tip]);
    }
    this.tZoom.setText(`확대 ×${this.z.toFixed(1)} (0.6 ~ 2.5)${detail ? ' · 방 내부 상세' : ` · ×${DETAIL} 부터 방 내부`}   [휠 · 핀치 · +– · Z]   ·   드래그 · 방향키 이동`);
  }

  // 고딕 장식 테두리: 네 모서리 소용돌이 덩굴 · 제목 양옆 장식 · 가장자리 비네트
  drawFrame() {
    const ui = this.ui, g = ui.add.graphics(); this.L.add(g);
    for (let i = 0; i < 10; i++) { g.lineStyle(3, 0x05040a, .16 - i * .012); g.strokeRect(VP.x + i * 2.5, VP.y + i * 2.5, VP.w - i * 5, VP.h - i * 5); }
    g.lineStyle(1, 0xefeae0, .35); g.strokeRect(VP.x - 3, VP.y - 3, VP.w + 6, VP.h + 6);
    g.lineStyle(1, 0xefeae0, .14); g.strokeRect(VP.x - 6, VP.y - 6, VP.w + 12, VP.h + 12);
    const curve = (pts, a = .85, w = 1.2) => { g.lineStyle(w, 0xefeae0, a); g.strokePoints(new Phaser.Curves.CubicBezier(...pts.map(([x, y]) => new Phaser.Math.Vector2(x, y))).getPoints(18), false); };
    const spiral = (cx, cy, r, a0, turns, dir) => {   // 안으로 말려 들어가는 소용돌이
      const pts = [];
      for (let k = 0; k <= 40; k++) { const t = k / 40, a = a0 + dir * t * Math.PI * 2 * turns, rr = r * (1 - t * .75); pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr }); }
      g.lineStyle(1.2, 0xefeae0, .85); g.strokePoints(pts, false);
    };
    const diamond = (x, y, r, a = .9) => { g.fillStyle(0xefeae0, a); g.fillPoints([{ x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }], true); };
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const cx = sx > 0 ? VP.x - 6 : VP.x + VP.w + 6, cy = sy > 0 ? VP.y - 6 : VP.y + VP.h + 6;
      const P = (dx, dy) => [cx + dx * sx, cy + dy * sy];
      curve([P(0, 0), P(18, -2), P(30, 8), P(46, 2)]);
      curve([P(0, 0), P(-2, 18), P(8, 26), P(2, 40)]);
      curve([P(4, 4), P(14, 10), P(10, 22), P(20, 20)], .55);
      spiral(...P(14, 14), 7, sx * sy > 0 ? Math.PI : 0, 1.4, sx * sy);
      spiral(...P(46, 2), 4, 0, 1.2, sx * sy);
      spiral(...P(2, 40), 4, Math.PI / 2, 1.2, -sx * sy);
      diamond(...P(0, 0), 3.2);
      diamond(...P(26, 4), 1.6, .6); diamond(...P(4, 26), 1.6, .6);
    }
    // (창 제목 장식은 없앴다 — 맨 위는 한 줄 통합 탭바 · scenes/GameMenu.js overlayChrome)
  }

  destroy() {
    this.ui.input.off('wheel', this.onWheel);
    this.ui.tweens.killTweensOf(this.content.list);
    this.maskG.destroy();
  }
}
