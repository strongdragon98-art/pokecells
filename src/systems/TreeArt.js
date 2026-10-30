// 고밀도 픽셀 고목 생성기 — 오프스크린 캔버스에 칸(기본 2x2 px) 단위로 찍는다
//  ① 땅을 움켜쥐는 뿌리 → 휘어 오르는 줄기 → 여러 갈래로 갈라지는 가지 (유기적인 실루엣)
//  ② 수피: 세로결 + 4단 명암(그림자·고동색·반사광·푸르스름한 달빛 림라이트), 경계는 디더링
//  ③ 침식된 고목: 자홍·청록으로 빛나는 수액 균열과 나무 구멍 (발광 캔버스에 따로 그려 맥동시킨다)
//  ④ 잎: 수백 개의 작은 잎 덩어리를 겹쳐 쌓는다 (심연 암녹 → 청록 → 달빛 민트/보라 하이라이트)
//  ⑤ 가지 사이 거미줄, 잎 아래로 늘어질 덩굴 자리(vines) — 덩굴은 따로 그려 흔든다 (drawVine)
// 같은 seed 면 늘 같은 나무가 나온다. silhouette 를 주면 배경용 단색 실루엣(+림라이트)만 찍는다.

const DEFAULT_PAL = {
  outline: 0x07050a, shadow: 0x161014, base: 0x35251f, hi: 0x5a4234, rim: 0x7a78b8,
  void: 0x040308, web: 0xc8c8d8,
  leaf: [0x081412, 0x10302a, 0x1f5a4a, 0x7ad8b8], leafAlt: 0xa88ad8,
  glow: [0xff3ab0, 0x3affd8]
};

function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const hex = c => '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6);

export function drawDetailedPixelTree(o = {}) {
  const r = rng(o.seed ?? 1), P = o.px ?? 2, GW = o.gw ?? 92, GH = o.gh ?? 124;
  const pal = Object.assign({}, DEFAULT_PAL, o.pal || {});
  const N = GW * GH, WOOD = new Uint8Array(N), U = new Float32Array(N), LEAF = new Int8Array(N).fill(-1), EM = new Uint32Array(N), EA = new Float32Array(N);
  const idx = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH) ? -1 : y * GW + x;
  const wood = (x, y, v, u = 0) => { const i = idx(x | 0, y | 0); if (i < 0) return; if (WOOD[i] !== 1 || v === 1) { WOOD[i] = v; U[i] = u; } };
  const disc = (x, y, rad, v) => { for (let dy = -Math.ceil(rad); dy <= Math.ceil(rad); dy++) for (let dx = -Math.ceil(rad); dx <= Math.ceil(rad); dx++) if (dx * dx + dy * dy <= rad * rad + .3) wood(x + dx, y + dy, v); };

  // ---- 줄기: 휘어진 2차 곡선, 밑동은 넓게 벌어진다 ----
  const crownY = GH * (o.crown ?? .4), bw = o.trunk ?? 7.5;
  const cx0 = GW / 2 + (r() - .5) * 6, cx1 = cx0 + (r() - .5) * 18, cxm = cx0 + (r() - .5) * 24;
  const trunkAt = t => { const a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t; return { x: a * cx0 + b * cxm + c * cx1, y: a * (GH - 1) + b * ((GH - 1 + crownY) / 2) + c * crownY }; };
  const trunkHW = t => bw * (1 - t * .6) + (t < .14 ? (.14 - t) * 34 : 0);
  for (let t = 0; t <= 1; t += .003) {
    const p = trunkAt(t), hw = trunkHW(t);
    for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) if (Math.abs(dx) <= hw) wood(p.x + dx, p.y, 1, dx / hw);
  }

  // ---- 획: 각도가 조금씩 틀어지며 가늘어지는 선 (가지·뿌리) ----
  const stroke = (x, y, a, len, t0, t1, curve, v, tips, sag = 0) => {
    for (let s = 0; s < len; s++) {
      const k = s / len;
      disc(x, y, t0 + (t1 - t0) * k, v);
      a += curve + (r() - .5) * .16; x += Math.cos(a); y += Math.sin(a) + sag * k;
      if (v === 2 && y > GH - 1.5) { y = GH - 1.5; a = Math.atan2(0, Math.cos(a)); }   // 뿌리는 땅 위를 기어간다
    }
    if (tips) tips.push({ x, y, a });
    return { x, y, a };
  };

  // 뿌리 4~6개: 밑동에서 바깥으로 뻗었다가 땅을 따라 휘어진다
  const roots = 4 + Math.floor(r() * 3);
  for (let k = 0; k < roots; k++) {
    const side = k % 2 ? 1 : -1, sx = cx0 + side * bw * (.5 + r() * .6), sy = GH - 3 - r() * 7;
    stroke(sx, sy, side > 0 ? .25 + r() * .5 : Math.PI - .25 - r() * .5, 12 + r() * 16, 2.8, .8, side * .02, 2, null, .35);
  }
  // 가지 5~7개 (+ 갈래) → 끝마다 잎 덩어리
  const tips = [];
  const branches = 5 + Math.floor(r() * 3);
  for (let k = 0; k < branches; k++) {
    const t = .5 + r() * .46, p = trunkAt(t), side = k % 2 ? 1 : -1;
    const a = -Math.PI / 2 + side * (.55 + r() * .8), len = 14 + r() * 18;
    const mid = stroke(p.x, p.y, a, len * .6, 3.2 * (1 - t * .4), 1.8, side * .012, 3);
    stroke(mid.x, mid.y, mid.a + side * (.2 + r() * .3), len * .4, 1.8, .7, side * .01, 3, tips);
    stroke(mid.x, mid.y, mid.a - side * (.5 + r() * .4), len * .45, 1.4, .6, -side * .015, 3, tips);
  }
  const top = trunkAt(1);
  tips.push({ x: top.x, y: top.y - 6 }, { x: top.x + (r() - .5) * 14, y: top.y - 12 });

  // ---- 침식: 나무 구멍 + 빛나는 수액 균열 ----
  const corrupt = o.corrupt ?? r() < .6, glowCol = pal.glow[Math.floor(r() * pal.glow.length)];
  if (corrupt && !o.silhouette) {
    const ht = .22 + r() * .14, hp = trunkAt(ht), rx = trunkHW(ht) * .42, ry = trunkHW(ht) * .78;
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const d = (dx / rx) ** 2 + (dy / ry) ** 2, i = idx(Math.round(hp.x + dx), Math.round(hp.y + dy));
      if (i < 0 || d > 1.25) continue;
      if (d <= 1) { WOOD[i] = 4; if (dy > 0 && d > .45) { EM[i] = glowCol; EA[i] = .55 * (1 - dy / ry * .3); } }   // 구멍 안 아래쪽이 은은하게 빛난다
      else WOOD[i] = WOOD[i] ? 5 : WOOD[i];                                                                           // 구멍 테두리
    }
    for (let c = 0; c < 2 + Math.floor(r() * 2); c++) {   // 지그재그 균열
      let t = .08 + r() * .2, u = (r() - .4) * .8;
      const end = t + .2 + r() * .25, col = c % 2 ? pal.glow[0] : glowCol;
      while (t < end) {
        const p = trunkAt(t), x = Math.round(p.x + u * trunkHW(t)), y = Math.round(p.y), i = idx(x, y);
        if (i >= 0 && WOOD[i] === 1) { WOOD[i] = 6; EM[i] = col; EA[i] = 1; for (const [dx, dy] of [[1, 0], [-1, 0]]) { const j = idx(x + dx, y + dy); if (j >= 0 && WOOD[j] === 1 && !EM[j]) { EM[j] = col; EA[j] = .3; } } }
        t += .006; u += (r() - .5) * .22; u = Math.max(-.7, Math.min(.7, u));
      }
    }
  }

  // ---- 잎: 덩어리마다 작은 잎 뭉치를 수백 개 겹친다 (위·왼쪽이 달빛을 받는다) ----
  const leafTone = (x, y, t) => { const i = idx(x, y); if (i >= 0) LEAF[i] = Math.max(0, Math.min(3, t)); };
  const clusters = tips.map(tp => ({ x: tp.x, y: tp.y, R: 7 + r() * 8 }));
  clusters.push({ x: top.x, y: top.y - 4, R: 13 + r() * 5 });
  clusters.sort((a, b) => b.y - a.y);   // 아래 덩어리부터 (위가 덮는다)
  for (const cl of clusters) {
    const rx = cl.R * 1.25, ry = cl.R * .85, n = Math.round(cl.R * cl.R * 1.6 * (o.leafMul ?? 1));   // leafMul: 시든 나무는 잎이 듬성듬성
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const dx = Math.cos(a) * rx * d, dy = Math.sin(a) * ry * d;
      const light = -dx / rx * .55 - dy / ry * .8 + (r() - .5) * .7;
      const tone = light > .75 ? 3 : light > .15 ? 2 : light > -.45 ? 1 : 0, s = r() < .3 ? 2 : 1;
      const bx = Math.round(cl.x + dx), by = Math.round(cl.y + dy);
      for (let j = 0; j < s; j++) for (let i = 0; i < s + (r() < .5 ? 1 : 0); i++) leafTone(bx + i, by + j, tone - (j && tone === 3 ? 1 : 0));
    }
  }
  // 잎 가장자리: 위가 트이면 밝게, 아래가 트이면 심연 녹색 (+ 디더링)
  const leafAt = (x, y) => { const i = idx(x, y); return i >= 0 && LEAF[i] >= 0; };
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x; if (LEAF[i] < 0) continue;
    if (!leafAt(x, y - 1)) LEAF[i] = Math.min(3, LEAF[i] + ((x + y) & 1 ? 1 : 0));
    else if (!leafAt(x, y + 1)) LEAF[i] = (x + y) & 1 ? 0 : Math.min(LEAF[i], 1);
  }

  // ---- 덩굴 자리: 잎 아래 가장자리에서 늘어진다 ----
  const vines = [];
  for (let k = 0; k < 40 && vines.length < (o.vines ?? 7); k++) {
    const x = Math.floor(r() * GW);
    for (let y = GH - 1; y > 0; y--) if (leafAt(x, y)) { if (!leafAt(x, y + 1) && y < GH * .7 && !vines.some(v => Math.abs(v.cx - x) < 4)) vines.push({ cx: x, cy: y, len: 10 + Math.floor(r() * 26) }); break; }
  }

  // ---- 그리기 ----
  const W = GW * P, H = GH * P;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const put = (x, y, col, a = 1) => { c.globalAlpha = a; c.fillStyle = hex(col); c.fillRect(x * P, y * P, P, P); };
  const woodAt = (x, y) => { const i = idx(x, y); return i >= 0 && WOOD[i] > 0; };
  const sil = o.silhouette;
  const tones = [pal.shadow, pal.base, pal.hi, pal.rim];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x, v = WOOD[i];
    if (!v) continue;
    if (sil !== undefined) { put(x, y, (!woodAt(x - 1, y) || !woodAt(x, y - 1)) && o.rim ? o.rim : sil); continue; }
    if (v === 4) { put(x, y, pal.void); continue; }
    if (v === 5) { put(x, y, pal.outline); continue; }
    if (v === 6) { put(x, y, 0x0a0610); continue; }
    let t;
    if (v === 1) {
      const u = U[i], d = (x + y) & 1;
      t = u < -.8 ? 3 : u < -.38 ? 2 : u > .42 ? 0 : 1;
      if (Math.abs(u + .8) < .08 || Math.abs(u + .38) < .08 || Math.abs(u - .42) < .08) t = d ? t : Math.max(0, t - 1);   // 경계 디더링
      if (t < 3 && (x * 13 + ((y / 4) | 0) * 7) % 9 === 0) t = Math.max(0, t - 1);                                   // 세로 나뭇결
      if (t < 3 && (x * 5 + y * 3) % 23 === 0) t = Math.min(2, t + 1);
    } else {
      const up = !woodAt(x, y - 1), dn = !woodAt(x, y + 1), lf = !woodAt(x - 1, y);
      t = up && lf ? 3 : up ? 2 : dn ? 0 : 1;
      if (t === 1 && ((x + y) & 1) && (x * 7 + y) % 5 === 0) t = 0;
    }
    if (!woodAt(x + 1, y) || !woodAt(x, y + 1)) t = -1;   // 오른쪽·아래 외곽선
    put(x, y, t < 0 ? pal.outline : tones[t]);
  }
  // 거미줄: 가지와 줄기 사이 (1px 실)
  if (!sil && r() < (o.web ?? .75)) {
    const bp = trunkAt(.62 + r() * .2), side = r() < .5 ? -1 : 1, ox = (bp.x + side * trunkHW(.7)) * P, oy = bp.y * P, R = (9 + r() * 6) * P;
    c.globalAlpha = .38; c.strokeStyle = hex(pal.web); c.lineWidth = 1;
    const angs = [0, .35, .7, 1.05, 1.4].map(a => (side > 0 ? -Math.PI / 2 + a : -Math.PI / 2 - a) + Math.PI / 2 * (side > 0 ? 0 : 0));
    for (const a of angs) { c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(a) * R * side, oy + Math.sin(a) * R + R * .6); c.stroke(); }
    for (let k = 1; k <= 3; k++) {
      c.beginPath();
      angs.forEach((a, j) => { const rr = R * k / 3.4, px = ox + Math.cos(a) * rr * side, py = oy + Math.sin(a) * rr + rr * .6; j ? c.lineTo(px, py + 1) : c.moveTo(px, py); });
      c.stroke();
    }
  }
  // 잎 (나무 위에 덮는다)
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const t = LEAF[y * GW + x];
    if (t < 0) continue;
    if (sil !== undefined) { put(x, y, (!leafAt(x, y - 1) || !leafAt(x - 1, y)) && o.rim ? o.rim : sil); continue; }
    put(x, y, t === 3 && (x * 3 + y * 5) % 4 === 0 ? pal.leafAlt : pal.leaf[t]);
  }
  c.globalAlpha = 1;

  // 발광 캔버스 (균열·구멍 빛 + 잎 속 창백한 포자 몇 점)
  let emis = null;
  if (!sil) {
    emis = document.createElement('canvas'); emis.width = W; emis.height = H;
    const e = emis.getContext('2d');
    for (let i = 0; i < N; i++) if (EM[i]) { e.globalAlpha = EA[i]; e.fillStyle = hex(EM[i]); e.fillRect((i % GW) * P, Math.floor(i / GW) * P, P, P); }
    for (let k = 0; k < 10; k++) { const cl = clusters[Math.floor(r() * clusters.length)], x = cl.x + (r() - .5) * cl.R * 2, y = cl.y + (r() - .5) * cl.R; if (leafAt(x | 0, y | 0)) { e.globalAlpha = .8; e.fillStyle = r() < .5 ? '#e8fff0' : hex(pal.leafAlt); e.fillRect((x | 0) * P, (y | 0) * P, P / 2 || 1, P / 2 || 1); } }
    e.globalAlpha = 1;
  }

  return {
    canvas, emis, W, H, P, baseX: cx0 * P, corrupt, glow: glowCol,
    vines: vines.map(v => ({ x: v.cx * P + P / 2, y: (v.cy + 1) * P, len: v.len })),
    canopy: clusters.map(cl => ({ x: cl.x * P, y: cl.y * P, r: cl.R * P }))
  };
}

// 축 늘어진 덩굴 한 가닥 (위 끝을 축으로 흔든다): 가늘게 물결치는 줄기 + 번갈아 달린 잎 + 끝의 작은 꽃봉오리
export function drawVine(len, seed = 1, pal = {}, P = 2) {
  const r = rng(seed + 77), W = 7 * P, H = len * P;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), col = [pal.dark ?? 0x0e2a22, pal.mid ?? 0x1f5a48, pal.light ?? 0x5ac8a0];
  const put = (x, y, k, a = 1) => { c.globalAlpha = a; c.fillStyle = hex(col[k]); c.fillRect(x * P, y * P, P, P); };
  let x = 3;
  for (let y = 0; y < len; y++) {
    if (r() < .25) x = Math.max(1, Math.min(5, x + (r() < .5 ? -1 : 1)));
    put(x, y, y % 3 ? 0 : 1);
    if (y % 4 === 1 && y < len - 2) { const s = (y >> 2) % 2 ? 1 : -1; put(x + s, y, 1); put(x + s * 2, y + 1, r() < .4 ? 2 : 1); }
  }
  put(x, len - 1, 2); if (r() < .5) { c.globalAlpha = .9; c.fillStyle = hex(pal.bud ?? 0xd88ad8); c.fillRect(x * P, (len - 1) * P, P, P); }
  c.globalAlpha = 1;
  return cv;
}
