// 지도(M) — 할로우 나이트풍 도식 지도 (지방 하나 = 2D 방 그래프)
//  실제 지형을 축소해 그리지 않고, 월드(game/World.js)를 '방 블록 + 문 통로'로 추상화해 그린다
//   · 방: 안쪽 공간 사각형 — 지역 색 반투명 채우기 + 밝은 외곽선 (지하 방은 같은 색을 더 어둡게)
//   · 통로: 좌우 문은 가로 통로, 위아래 문은 세로 갱도(꼭대기 철창 점선). 부서지는 벽은 무너뜨리기 전까지 안 그린다
//   · 탐험: 방은 한 칸이라도 본 적 있으면 통째로 드러나고, 안 가 본 방으로 이어지는 통로는 흰 점선
//     흙에 덮인 작은 굴(상처약·페이크)은 흙이 걷히기 전까지, 히든 성소는 가 보기 전까지 안 보인다 —
//     성소 바로 옆 방을 봤다면 그 자리에 흐릿한 보라 「?」만
//   · 핀: 포켓몬센터 · 아머까오 정거장 · 지방 보스(큰 해골) · 중간 보스(작은 해골) · 히든 전설(보라 ?) · 기술머신 · 보물 · 상처약 · 현재 위치
//   · 고딕 소용돌이 장식 테두리 · 가장자리 비네트 · 방향키/드래그로 이동 · Z/휠로 확대
import Phaser from 'phaser';
import { STAGES, mapColor, areaLabel } from '../data/stages.js';
import { HK, hkText } from './ui.js';
import { roundPortrait } from './Textures.js';
import { TILE } from '../config.js';

const ZOOMS = [1, 1.7, 2.8, 4.4];
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
  const corridors = level.doors.map(d => {
    const w = wallOf.get(d), shut = !!(w && !w.broken);
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
export class MapView {
  // ci: 보여 줄 지방 (지금 있는 지방이 아니어도 — 한 번이라도 들른 지방이면)
  constructor(ui, layer, ci) {
    this.ui = ui; this.L = layer;
    const gs = ui.gs, W = gs.worlds[ci], lv = W.level;
    this.gs = gs; this.ci = ci; this.W = W; this.lv = lv; this.stage = STAGES[ci];
    this.here = ci === gs.stageIdx;
    this.model = buildMapModel(lv, W.explored);
    this.progress = this.model.progress;
    this.base = Math.min(VP.w / lv.cols, VP.h / lv.rows) * .94;
    const p = gs.player;
    this.zi = this.here ? 2 : 0;
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
    // 드래그 이동 · 휠 확대
    this.zone = ui.add.zone(VP.x, VP.y, VP.w, VP.h).setOrigin(0).setInteractive({ draggable: false }); layer.add(this.zone);
    this.zone.on('pointermove', ptr => { if (!ptr.isDown) return; const s = this.scale(); this.cx -= (ptr.x - ptr.prevPosition.x) / ui.cameras.main.zoom / s; this.cy -= (ptr.y - ptr.prevPosition.y) / ui.cameras.main.zoom / s; this.clampPan(); this.draw(); });
    this.onWheel = (ptr, objs, dx, dy) => this.zoom(dy > 0 ? -1 : 1);
    ui.input.on('wheel', this.onWheel);
  }

  scale() { return this.base * ZOOMS[this.zi]; }
  clampPan() {
    const s = this.scale(), hw = VP.w / 2 / s, hh = VP.h / 2 / s, { cols, rows } = this.lv, mx = 40 / s, my = 30 / s;   // 가장자리 방도 가운데 올 수 있게 조금 여유
    this.cx = Phaser.Math.Clamp(this.cx, Math.min(hw - mx, cols / 2), Math.max(cols - hw + mx, cols / 2));
    this.cy = Phaser.Math.Clamp(this.cy, Math.min(hh - my, rows / 2), Math.max(rows - hh + my, rows / 2));
  }
  zoom(d) { const z = Phaser.Math.Clamp(this.zi + d, 0, ZOOMS.length - 1); if (z === this.zi) return; this.zi = z; this.clampPan(); this.draw(); }
  pan(dx, dy) { const s = this.scale(); this.cx += dx * 46 / s; this.cy += dy * 34 / s; this.clampPan(); this.draw(); }
  key(e) {
    if (e.code === 'ArrowLeft') this.pan(-1, 0); else if (e.code === 'ArrowRight') this.pan(1, 0);
    else if (e.code === 'ArrowUp') this.pan(0, -1); else if (e.code === 'ArrowDown') this.pan(0, 1);
    else if (e.code === 'KeyZ') this.zoom(e.shiftKey ? -1 : this.zi === ZOOMS.length - 1 ? -(ZOOMS.length - 1) : 1);
  }

  // 지도 내용 다시 그리기 (이동·확대할 때마다)
  draw() {
    const ui = this.ui, C = this.content, lv = this.lv, st = this.stage, s = this.scale(), gs = this.gs;
    ui.tweens.killTweensOf(C.list);
    C.removeAll(true);
    const ox = VP.x + VP.w / 2 - this.cx * s, oy = VP.y + VP.h / 2 - this.cy * s;
    const X = x => ox + x * s, Y = y => oy + y * s;
    const { blocks, corridors } = this.model, col = b => mapColor(st.areas[b.r.ai]);
    const g = ui.add.graphics(); C.add(g);
    // ① 방 블록: 지역 색 반투명 채우기 + 밝은 외곽선 (지하는 더 어둡게, 샛길 끝방은 하늘색 외곽선)
    for (const b of blocks) {
      if (!b.seen) continue;
      const c = col(b), x = X(b.xa), y = Y(b.ya), w = (b.xb - b.xa) * s, h = (b.yb - b.ya) * s, side = b.r.branch && !ARENA.has(b.r.type);
      g.fillStyle(c.fill, b.r.under ? .5 : .74); g.fillRect(x, y, w, h);
      g.lineStyle(Math.max(1.2, Math.min(2.4, s * 1.4)), side ? 0x9ad8ff : 0xefeae0, b.r.under ? .62 : .9); g.strokeRect(x, y, w, h);
    }
    // ② 통로: 둘 다 봤으면 외곽선을 덮어 이어 붙이고, 한쪽만이면 안 가 본 쪽으로 흰 점선 (비밀 문은 점선도 없다)
    for (const cd of corridors) {
      const A = cd.A, B = cd.B;
      if (!A.seen && !B.seen) continue;
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
      } else {
        if ((A.seen ? B : A).veiled) continue;   // 흙에 덮인 굴로 가는 길은 아직 모른다
        if ((A.seen ? B : A).r.type === 'sanctuary') continue;
        g.fillStyle(0xffffff, .75);
        const step = 4.5, len = 14;
        if (cd.vertical) {
          const xm = (x0 + x1) / 2, ys = A.seen ? Y(cd.y0) : Y(cd.y1), dir = A.seen ? 1 : -1;
          for (let k = 0; k < len; k += step) g.fillRect(xm - 1, ys + dir * k - 1, 2, 2);
        } else {
          const ym = (y0 + y1) / 2, xs = A.seen ? x0 : x1, dir = A.seen ? 1 : -1;
          for (let k = 0; k < len; k += step) g.fillRect(xs + dir * k - 1, ym - 1, 2, 2);
        }
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
      } else if (r.type === 'tm' && s > 1.2) {
        C.add(hkText(ui, X(mid), Y(b.ya) - 2, '샛길', 7.5, '#9ad8ff', { bold: true, ls: 2, origin: [.5, 1] }));
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
    // ⑤ 원형 핀
    const pg = ui.add.graphics(); C.add(pg);
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
      } else if (m.kind === 'corvi') {   // 아머까오: 남색 바탕에 은빛 날개
        pin(x, y, 0xb8c8ff, 0x1a2448);
        pg.lineStyle(1.4, 0xd8e0f0, 1);
        pg.strokePoints([{ x: x - 4, y: y - 1.5 }, { x: x - 1.5, y: y + .5 }, { x, y: y - .5 }, { x: x + 1.5, y: y + .5 }, { x: x + 4, y: y - 1.5 }], false);
        pg.fillStyle(0xd8e0f0, 1); pg.fillCircle(x, y + 1.6, 1.1);
      } else if (m.kind === 'boss' || m.kind === 'mini') {   // 해골 (지방 보스는 크게 · 정화하면 회색)
        const big = m.kind === 'boss', done = m.room.cleared;
        pin(x, y, done ? 0x8a8478 : big ? 0xff8a8a : 0xffc08a, done ? 0x1a1414 : 0x2a0a14, big ? 7.5 : 5.2);
        skull(x, y, big ? 1.15 : .8, done ? 0x1a1414 : 0x2a0a14);
      } else if (m.kind === 'tm') {   // 기술머신 디스크 (카드를 고르고 나면 회색)
        const used = lv.props.some(q => q.kind === 'tm' && q.x === m.x && q.used);
        pin(x, y, used ? 0x8a8478 : 0x9ad8ff, 0x101828);
        pg.fillStyle(used ? 0x5a5a6a : 0x7ab8ff, 1); pg.fillCircle(x, y, 4.2);
        pg.fillStyle(used ? 0x8a8a9a : 0xc8e4ff, 1); pg.fillCircle(x, y, 2.8);
        pg.fillStyle(0x101828, 1); pg.fillCircle(x, y, 1.1);
      } else if (m.kind === 'potion') {   // 상처약 (주우면 사라진다)
        if (lv.potions.some(pt => pt.room === m.room && pt.taken)) continue;
        pin(x, y, 0xe8b0ff, 0x1a1028);
        pg.fillStyle(0xd88aff, 1); pg.fillRoundedRect(x - 2.6, y - 1.6, 5.2, 5, 1.4);
        pg.fillStyle(0xf4f0e8, 1); pg.fillRect(x - 1.4, y - 3.6, 2.8, 2);
        pg.fillStyle(0xffffff, .8); pg.fillRect(x - 1.6, y - .8, 1, 2.6);
      } else if (m.kind === 'chest') {
        const op = lv.chests.some(c => Math.abs(c.x - (m.x * TILE + 8)) < 2 && c.opened);
        pin(x, y, op ? 0x8a8478 : 0xffe8a0, 0x1a1408);
        pg.fillStyle(op ? 0x6a5a40 : 0xffc84a, 1); pg.fillRect(x - 3.4, y - 1.6, 6.8, 4.4);
        pg.fillStyle(op ? 0x4a4030 : 0xd8902a, 1); pg.fillRect(x - 3.4, y - 3, 6.8, 1.8);
        pg.fillStyle(0x1a1408, 1); pg.fillRect(x - .6, y - .8, 1.2, 1.6);
      }
    }
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
    this.tZoom.setText(`확대 ×${ZOOMS[this.zi]}  [Z]   ·   방향키 / 드래그 이동`);
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
    const ty = 22, tx = 404;   // 제목 양옆: 가는 선 · 소용돌이 · 마름모 (제목은 왼쪽 위 탭을 피해 오른쪽에)
    for (const s of [-1, 1]) {
      const x0 = tx + s * 72;
      g.lineStyle(1, 0xefeae0, .7); g.lineBetween(x0, ty, x0 + s * 34, ty);
      curve([[x0 + s * 4, ty], [x0 + s * 12, ty - 7], [x0 + s * 22, ty - 4], [x0 + s * 26, ty]], .7);
      curve([[x0 + s * 4, ty], [x0 + s * 12, ty + 7], [x0 + s * 22, ty + 4], [x0 + s * 26, ty]], .7);
      spiral(x0 + s * 40, ty, 4, s > 0 ? Math.PI : 0, 1.3, s);
      diamond(x0 + s * 2, ty, 2.4);
    }
  }

  destroy() {
    this.ui.input.off('wheel', this.onWheel);
    this.ui.tweens.killTweensOf(this.content.list);
    this.maskG.destroy();
  }
}
