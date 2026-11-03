// 메가 · 특수 폼 도트 공방: SpriteCollab 에 아직 모션 시트가 없는 모습을 '기본형의 실제 모션 시트'로 만든다
//  ① 픽셀 팔레트 치환 — 기본형 도트의 색(정확한 RGB)을 그 메가 고유의 색으로 한 픽셀씩 바꾼다 (반투명 덧칠 아님)
//  ② 프레임 추적 파츠 덧그리기 — 프레임마다 실루엣을 재서(머리 꼭대기 · 앞뒤 손 · 꼬리 불꽃 · 날개 윗선) 그 자리에
//     메가 상징 부위를 도트로 그린다 (외곽선 → 그림자 → 기본 → 하이라이트 · 프레임 번호로 일렁인다)
//  결과는 원래 시트와 같은 크기 · 같은 프레임 수의 'sheet:{메가 key}:{모션}' 텍스처 — SpriteLoader 가 보통 시트처럼 애니메이션을 만든다
//  새 폼을 넣으려면 FORGE 에 { base, map, parts } 를 더하면 된다

const hex = n => [(n >> 16) & 255, (n >> 8) & 255, n & 255];

export const FORGE = {
  // 🔥 메가리자몽 Y: 더 밝고 뜨거운 주홍 피부 · 밝은 크림색 배 · 진한 청록 날개 안쪽 / 가운데 긴 뿔 · 백열 꼬리 불꽃 · 찢어진 날개 끝 · 손목 작은 날개
  'charizard-mega-y': {
    base: 'charizard',
    map: { d73f00: 0xff6a1e, '9f0000': 0xb8280a, ff875f: 0xffb072, '373f8f': 0x167a86, bfcff7: 0x9cf0e8, fff700: 0xfffbd2, dfb700: 0xffe08a, a76f00: 0xd8902a },
    parts: ['hornY', 'wingTipsY', 'wristFinY', 'tailFlameY']
  },
  // 🥊 메가번치코: 노란 털 → 순백 깃털 · 붉은 몸 → 짙은 다크 크림슨 · 가슴 · 다리 갈색 → 검은 갑주 / V자 볏 · 양 손목 화염 리본
  'blaziken-mega': {
    base: 'blaziken',
    map: { ffe79f: 0xffffff, d7a700: 0xd6dbe8, fff700: 0xf4f6ff, ff570f: 0xd2283a, '9f0000': 0x620a1a, a75f1f: 0x2a2232, df771f: 0x4a3c50, d7e7df: 0xffffff },
    // 가슴 띠(몸 높이 32~54% · 가운데 60%)의 노란 털은 흰 깃 대신 검은 갑주 문양으로
    zones: [{ band: [.32, .54], mid: .6, map: { ffe79f: 0x6a6478, d7a700: 0x2e2838, fff700: 0x8a8498 } }],
    parts: ['crestV', 'wristFlames']
  },
  // 🐸 유대변화(지우) 개굴닌자: 몸빛을 조금 더 깊게 · 머리의 붉은 볏 · 얼굴 양옆 검은 무늬 / 등 뒤 거대 물수리검은 따로 떠서 돈다 (Player.updateAshStar)
  'greninja-ash': {
    base: 'greninja',
    map: { '2657ba': 0x1f4cb0, '303b8a': 0x283480, '1c2350': 0x161c44 },
    parts: ['ashCrest', 'ashMask']
  }
};

// 기본형 시트 텍스처들 → 메가 시트 텍스처 (data: 기본형 AnimData { 모션: { fw, fh, source } })
export function forgeSheets(tm, key, data) {
  const spec = FORGE[key];
  if (!spec) return false;
  const done = new Set();
  let made = 0;
  for (const d of Object.values(data)) {
    if (!d || !d.fw || done.has(d.source)) continue;
    done.add(d.source);
    const src = `sheet:${spec.base}:${d.source}`, dst = `sheet:${key}:${d.source}`;
    if (!tm.exists(src) || tm.exists(dst)) continue;
    const img = tm.get(src).getSourceImage(), W = img.width, H = img.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    const im = c.getImageData(0, 0, W, H);
    forgeImage(im, spec, d.fw, d.fh, d.source);
    c.putImageData(im, 0, 0);
    tm.addSpriteSheet(dst, cv, { frameWidth: d.fw, frameHeight: d.fh });
    made++;
  }
  return made > 0;
}

function forgeImage(im, spec, fw, fh, anim) {
  const W = im.width, H = im.height, px = im.data, orig = new Uint8ClampedArray(px);
  // ① 팔레트 치환 (불투명 픽셀만 · 정확히 같은 색)
  const map = new Map(Object.entries(spec.map).map(([k, v]) => [parseInt(k, 16), hex(v)]));
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    const to = map.get((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
    if (to) { px[i] = to[0]; px[i + 1] = to[1]; px[i + 2] = to[2]; }
  }
  // ② 프레임마다 구역 치환 · 파츠 (오른쪽 · 왼쪽 줄만 — 원본 8행은 2 · 6행, 잘라 낸 2행은 0 · 1행)
  const cols = Math.floor(W / fw), rows = Math.floor(H / fh);
  const lanes = rows >= 8 ? [[2, 1], [6, -1]] : rows === 2 ? [[0, 1], [1, -1]] : [[0, 1]];
  const zones = (spec.zones || []).map(z => ({ ...z, m: new Map(Object.entries(z.map).map(([k, v]) => [parseInt(k, 16), hex(v)])) }));
  for (const [row, f] of lanes) for (let col = 0; col < cols; col++) {
    const fr = frameInfo(orig, W, col * fw, row * fh, fw, fh, f);
    if (!fr) continue;
    for (const z of zones) {   // 몸의 한 띠만 다른 색으로 (번치코 가슴 갑주)
      const ya = Math.round(fr.y0 + fr.h * z.band[0]), yb = Math.round(fr.y0 + fr.h * z.band[1]), cx = (fr.x0 + fr.x1) / 2, half = fr.w * z.mid / 2;
      for (let y = ya; y <= yb; y++) for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const i = ((row * fh + y) * W + col * fw + x) * 4, to = orig[i + 3] > 40 && z.m.get((orig[i] << 16) | (orig[i + 1] << 8) | orig[i + 2]);
        if (to) { px[i] = to[0]; px[i + 1] = to[1]; px[i + 2] = to[2]; }
      }
    }
    const pen = makePen(px, W, col * fw, row * fh, fw, fh);
    for (const part of spec.parts) PARTS[part](pen, fr, f, col, anim);
  }
}

// 프레임 실루엣: 테두리 상자 · 머리 꼭대기(앞쪽) · 몸 가운데 띠의 앞 · 뒤 끝 · 원래 색별 픽셀 위치 (orig: 치환 전)
function frameInfo(px, W, ox, oy, fw, fh, f) {
  let x0 = fw, x1 = -1, y0 = fh, y1 = -1;
  const at = (x, y) => px[((oy + y) * W + ox + x) * 4 + 3] > 40;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (at(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  // 머리 꼭대기: 앞쪽 60% 에서 가장 높은 픽셀
  let head = null;
  for (let y = y0; y <= y1 && !head; y++) for (let k = 0; k < w; k++) { const x = f > 0 ? x1 - k : x0 + k; if ((f > 0 ? x - x0 : x1 - x) < w * .4) break; if (at(x, y)) { head = { x, y }; break; } }
  // 몸 가운데 띠(30~62%)의 앞 · 뒤 끝 = 앞손 · 뒷손 (주먹을 내지르면 앞손이 멀리 나간다)
  let front = null, back = null;
  for (let y = Math.round(y0 + h * .3); y <= Math.round(y0 + h * .62); y++) {
    for (let x = x0; x <= x1; x++) if (at(x, y)) { const p = { x, y }; if (f > 0) { if (!back || x < back.x) back = p; } else if (!front || x < front.x) front = p; break; }
    for (let x = x1; x >= x0; x--) if (at(x, y)) { const p = { x, y }; if (f > 0) { if (!front || x > front.x) front = p; } else if (!back || x > back.x) back = p; break; }
  }
  // 원래 색 찾기 (꼬리 불꽃 · 날개 안쪽)
  const colorPts = cs => { const set = new Set(cs), out = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = ((oy + y) * W + ox + x) * 4; if (px[i + 3] > 40 && set.has((px[i] << 16) | (px[i + 1] << 8) | px[i + 2])) out.push({ x, y }); } return out; };
  return { x0, x1, y0, y1, w, h, head: head || { x: Math.round((x0 + x1) / 2), y: y0 }, front, back, colorPts };
}

// 프레임 안에만 찍는 붓 (front: 앞에 · behind: 몸 뒤 빈 칸에만)
function makePen(px, W, ox, oy, fw, fh) {
  const put = (x, y, col, behind = false) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= fw || y >= fh) return;
    const i = ((oy + y) * W + ox + x) * 4;
    if (behind && px[i + 3] > 40) return;
    const [r, g, b] = hex(col); px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  const alpha = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= fw || y >= fh) return 0; return px[((oy + y) * W + ox + x) * 4 + 3]; };
  return { put, alpha };
}

// 가늘어지는 뿔 · 깃 · 가시: (x, y) 에서 (dx, dy) 쪽으로 len 만큼, 굵기 wid → 0 · 외곽선 → 그림자 → 기본 → 하이라이트
//  pal: [외곽선, 그림자, 기본, 하이라이트] · bend: 끝으로 갈수록 휘는 양
function spike(pen, x, y, dx, dy, len, wid, pal, o = {}) {
  const n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, nx = -uy, ny = ux, pts = new Map();
  for (let t = 0; t <= len; t += .5) {
    const k = t / len, hw = Math.max(.35, wid * (1 - k)), bx = x + ux * t + nx * (o.bend || 0) * k * k * len, by = y + uy * t + ny * (o.bend || 0) * k * k * len;
    for (let s = -hw; s <= hw; s += .5) {
      const px = Math.round(bx + nx * s), py = Math.round(by + ny * s), tone = s > hw * .35 ? 3 : s < -hw * .35 ? 1 : 2;
      const key = px + ',' + py;
      if (!pts.has(key) || tone === 3) pts.set(key, tone);
    }
  }
  // 외곽선: 채운 칸 둘레의 빈 칸
  for (const key of pts.keys()) {
    const [px, py] = key.split(',').map(Number);
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k2 = (px + ax) + ',' + (py + ay); if (!pts.has(k2) && pen.alpha(px + ax, py + ay) < 40) pen.put(px + ax, py + ay, pal[0], o.behind); }
  }
  for (const [key, tone] of pts) { const [px, py] = key.split(',').map(Number); pen.put(px, py, pal[tone], o.behind); }
}
// 둥근 불꽃 덩이 (꼬리 불꽃): 위로 솟는 물방울 · 백열 속
function flameBlob(pen, x, y, r, phase, pal) {
  for (let yy = -r * 2.2; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
    const k = yy < 0 ? 1 + yy / (r * 2.2) : 1, rr = r * Math.max(0, k) + (yy < 0 ? Math.sin(phase + yy * .7) * .6 : 0);
    const d = Math.hypot(xx - (yy < 0 ? Math.sin(phase + yy * .5) * .8 : 0), Math.max(0, yy));
    if (d > rr) continue;
    const q = d / Math.max(1, rr);
    pen.put(x + xx, y + yy, q > .82 ? pal[0] : q > .55 ? pal[1] : q > .28 ? pal[2] : pal[3]);
  }
}

const PARTS = {
  // ── 메가리자몽 Y ──
  hornY(pen, fr, f) {   // 머리 가운데에서 뒤로 길게 솟은 뿔 (+ 양옆 작은 뿔)
    const h = fr.head, s = Math.max(4, Math.round(fr.h * .16));
    const pal = [0x5a1404, 0xb8280a, 0xff6a1e, 0xffc89a];
    spike(pen, h.x - f, h.y + 1, -f * .55, -1, s + 5, 2, pal, { bend: -f * .15 });
    spike(pen, h.x + f, h.y + 2, f * .2, -1, s * .55, 1, pal);
  },
  wingTipsY(pen, fr, f) {   // 날개 안쪽(청록) 윗선 바깥으로 뾰족하게 찢어진 날개 끝
    const pts = fr.colorPts([0x373f8f, 0xbfcff7]);
    if (!pts.length) return;
    const top = new Map();
    for (const p of pts) if (!top.has(p.x) || p.y < top.get(p.x)) top.set(p.x, p.y);
    const xs = [...top.keys()].sort((a, b) => a - b), pal = [0x3a0a04, 0x9f2008, 0xe8501a, 0xffa060], mid = (fr.x0 + fr.x1) / 2;
    const outer = xs.filter(x => Math.abs(x - mid) > fr.w * .22);   // 날개 바깥쪽만 (몸 가까운 곳은 그대로)
    for (let k = 0; k < outer.length; k += 5) {
      const x = outer[k];
      let y = top.get(x);
      while (y > 0 && pen.alpha(x, y - 1) > 40) y--;   // 날개 윗가죽 위로
      spike(pen, x, y, (x < mid ? -1 : 1) * .7, -1, 2 + (k % 10 ? 1 : 2), 1, pal, { behind: true });
    }
  },
  wristFinY(pen, fr, f) {   // 손목의 작은 날개 지느러미
    const p = fr.front;
    if (!p) return;
    spike(pen, p.x - f * 2, p.y - 1, -f * .8, -1, 4, 1.3, [0x3a0a04, 0x167a86, 0x2aa8b0, 0x9cf0e8]);
  },
  tailFlameY(pen, fr, f, col) {   // 훨씬 커진 백열 꼬리 불꽃 (뒤쪽 노란 불꽃 픽셀 무게중심)
    const pts = fr.colorPts([0xfff700, 0xdfb700]).filter(p => (p.x - (fr.x0 + fr.x1) / 2) * f < 0);
    if (pts.length < 3) return;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = Math.min(...pts.map(p => p.y)) + 2;
    flameBlob(pen, cx, cy, Math.max(3, Math.round(fr.h * .09)), col * 1.3, [0xb82808, 0xff6a1e, 0xffe08a, 0xffffff]);
  },
  // ── 메가번치코 ──
  crestV(pen, fr, f) {   // 머리 위로 날카롭게 솟은 V자 흰 볏 (뒤로 흩날린다)
    const h = fr.head, s = Math.max(5, Math.round(fr.h * .2)), pal = [0x5a5a68, 0xb8bccc, 0xeef0f8, 0xffffff];
    spike(pen, h.x - f, h.y + 1, -f * .35, -1, s + 2, 1.8, pal, { bend: -f * .2 });
    spike(pen, h.x - f * 3, h.y + 2, -f * 1, -.7, s, 1.6, pal, { bend: -f * .1 });
  },
  wristFlames(pen, fr, f, col, anim) {   // 양 손목에서 길게 타오르는 화염 리본 (프레임마다 일렁이고, 공격 모션에선 뒤로 길게 끌린다)
    const hot = [0x7a0a0a, 0xff5a1a, 0xffc040, 0xfff4c0], long = anim === 'Attack' || anim === 'Strike' || anim === 'Shoot' ? 1.4 : 1;
    for (const [p, side] of [[fr.front, 1], [fr.back, -1]]) {
      if (!p) continue;
      const L = Math.round(Math.max(7, fr.h * .32) * long), ph = col * 1.1 + (side > 0 ? 0 : 1.7);
      let px0 = p.x, py0 = p.y;
      for (let i = 0; i <= L; i++) {   // 손목에서 뒤 · 위로 물결치는 리본
        const x = p.x - f * i * .85, y = p.y - i * .55 + Math.sin(ph + i * .55) * 1.6, w = Math.max(.6, 2.2 * (1 - i / L));
        for (let s = -w; s <= w; s += .5) {
          const t = i / L, tone = t < .15 ? 3 : t < .45 ? 2 : t < .8 ? 1 : 0;
          pen.put(x, y + s, hot[tone], true);   // 몸 뒤로 지나가는 부분은 가려진다
        }
        px0 = x; py0 = y;
      }
      void px0; void py0;
      flameBlob(pen, p.x, p.y, 2, ph, [0x7a0a0a, 0xff5a1a, 0xffc040, 0xfff4c0]);   // 손목 불씨
    }
  },
  // ── 유대변화 개굴닌자 ──
  ashCrest(pen, fr, f) {   // 머리카락처럼 솟은 선명한 붉은 볏 (세 갈래)
    const h = fr.head, s = Math.max(4, Math.round(fr.h * .14)), pal = [0x3a0612, 0xa8142a, 0xe8283a, 0xff8a8a];
    spike(pen, h.x - f * 2, h.y + 1, -f * .6, -1, s + 2, 1.7, pal, { bend: -f * .2 });
    spike(pen, h.x, h.y + 1, -f * .1, -1, s, 1.4, pal);
    spike(pen, h.x - f * 4, h.y + 3, -f * 1, -.5, s, 1.3, pal);
  },
  ashMask(pen, fr, f) {   // 얼굴 양옆의 검은 무늬: 머리 앞쪽 아래 짧은 검은 띠
    const h = fr.head, y = h.y + Math.round(fr.h * .14);
    for (let k = 0; k < 3; k++) { if (pen.alpha(h.x - f * k, y) > 40) pen.put(h.x - f * k, y, 0x0a0a14); if (pen.alpha(h.x - f * k, y + 1) > 40) pen.put(h.x - f * k, y + 1, 0x1a1428); }
  }
};

// 유대변화 개굴닌자 등 뒤의 거대 물수리검 그림 (네 갈래 물날 · 가운데 물방울 · 외곽선 → 그림자 → 기본 → 하이라이트)
export function ashStarTexture(scene) {
  const key = 'ash-shuriken';
  if (scene.textures.exists(key)) return key;
  const S = 40, t = scene.textures.createCanvas(key, S, S), c = t.getContext();
  c.translate(S / 2, S / 2);
  for (let k = 0; k < 4; k++) {
    c.save(); c.rotate(k * Math.PI / 2);
    c.beginPath(); c.moveTo(-3, -3); c.quadraticCurveTo(4, -10, 2, -19); c.quadraticCurveTo(9, -9, 4, 2); c.closePath();
    c.fillStyle = '#0a2a6a'; c.fill();
    c.beginPath(); c.moveTo(-2, -3); c.quadraticCurveTo(4, -9, 2, -16); c.quadraticCurveTo(7, -8, 3, 1); c.closePath();
    const g = c.createLinearGradient(0, -16, 4, 0); g.addColorStop(0, '#bff4ff'); g.addColorStop(.5, '#3ec9ff'); g.addColorStop(1, '#1195f8');
    c.fillStyle = g; c.fill();
    c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(2, -13, 1, 6);
    c.restore();
  }
  c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fillStyle = '#0a2a6a'; c.fill();
  c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fillStyle = '#7ad8ff'; c.fill();
  c.fillStyle = '#ffffff'; c.fillRect(-2, -2, 2, 2);
  t.refresh();
  return key;
}
