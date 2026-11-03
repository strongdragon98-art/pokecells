// 메가 · 특수 폼 도트 공방: SpriteCollab 에 아직 모션 시트가 없는 모습을 '기본형의 실제 모션 시트'로 만든다
//  ① 픽셀 팔레트 치환 — 기본형 도트의 색(정확한 RGB)을 그 메가 고유의 색으로 한 픽셀씩 바꾼다 (반투명 덧칠 아님)
//  ② 프레임 추적 파츠 덧그리기 — 프레임마다 실루엣을 재서(머리 꼭대기 · 앞뒤 손 · 꼬리 불꽃 · 날개 윗선) 그 자리에
//     메가 상징 부위를 도트로 그린다 (외곽선 → 그림자 → 기본 → 하이라이트 · 프레임 번호로 일렁인다)
//  결과는 원래 시트와 같은 크기 · 같은 프레임 수의 'sheet:{메가 key}:{모션}' 텍스처 — SpriteLoader 가 보통 시트처럼 애니메이션을 만든다
//  새 폼을 넣으려면 FORGE 에 { base, map, parts } 를 더하면 된다

const hex = n => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
// 파츠 색 [외곽선, 그림자, 기본, 하이라이트]
const PAL = {
  pink: [0x5a0a2a, 0xc02a68, 0xff6aa8, 0xffc8e0], gold: [0x4a3004, 0xb07818, 0xf0c040, 0xfff0a0], crimson: [0x3a0408, 0x9a0a1a, 0xe02a3a, 0xff9a9a],
  navy: [0x0a1030, 0x1a2a68, 0x3a5aa8, 0x8ab0f0], orange: [0x4a1a04, 0xc0500a, 0xff8a1a, 0xffd08a], fire: [0x6a0a04, 0xff4a10, 0xffb030, 0xfff4c0],
  leaf: [0x0a2a08, 0x2a6a1a, 0x5aa83a, 0xb0e890], bark: [0x2a1a0a, 0x6a4a28, 0xa07848, 0xe0c090], violet: [0x1a0a2a, 0x5a2a8a, 0x9a5ad8, 0xe0c0ff],
  shadow: [0x05050a, 0x1a1828, 0x3a3450, 0x7a7090], teal: [0x053a3a, 0x0a7a78, 0x2ab8b0, 0x9af0e8], electric: [0x0a2058, 0x2a6ad8, 0x6ac8ff, 0xe8faff],
  steel: [0x10122a, 0x3a3e68, 0x6a70a8, 0xc0c8f0]
};

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
  // ── 나머지 메가 · 특수 폼 (범용 파츠: horn 뿔 · ridge 등 가시 · blade 손 칼날 · cannon 주포 · shield 방패 · claw 집게 · petals 꽃잎 · flame 불꽃 · ribbons 리본 · sparks 전기) ──
  'venusaur-mega': {   // 메가이상해꽃: 더 짙은 잎 · 분홍빛 큰 꽃 / 꽃잎이 더 크게 펼쳐지고 이마에 작은 꽃
    base: 'venusaur',
    map: { '278700': 0x1d6a12, '5fb727': 0x4aa82e, '9f0000': 0xa01848, d73f00: 0xe0487a, ff875f: 0xff9ac0 },
    parts: [['petals', { at: 'backTop', n: 6, len: .2, pal: PAL.pink }], ['petals', { at: 'head', n: 4, len: .07, pal: PAL.pink, dy: 1 }]]
  },
  'blastoise-mega': {   // 메가거북왕: 등딱지 위 거대 주포 하나 · 양팔 작은 포
    base: 'blastoise',
    map: { '373f8f': 0x2c3a9a, '4f5f97': 0x4058a8, '6787af': 0x6a90c8 },
    parts: [['cannon', { at: 'backTop', len: .42, r: .07 }], ['cannon', { at: 'front', len: .16, r: .045 }]]
  },
  'garchomp-mega': {   // 메가한카리아스: 더 짙은 남색 · 선명한 붉은 배 / 양팔의 거대한 낫 칼날 · 등 가시
    base: 'garchomp',
    map: { '4f6fb7': 0x3a5aa8, '6f9fe7': 0x5a88d8, '37478f': 0x28367a, '9f172f': 0xb0102a, cf473f: 0xe83040, ff6f57: 0xff7a60 },
    parts: [['blade', { hand: 'both', len: .34, wid: 2.2, pal: PAL.crimson }], ['ridge', { n: 4, len: .09, pal: PAL.navy }]]
  },
  'garchomp-mega-z': {   // 메가한카리아스Z: 칠흑 같은 남색 · 황금 / 황금 낫 칼날 · 황금 뿔
    base: 'garchomp',
    map: { '4f6fb7': 0x2a2f58, '6f9fe7': 0x45508a, '37478f': 0x1a1d3a, '9f172f': 0xa07a10, cf473f: 0xe0b030, ff6f57: 0xffe070 },
    parts: [['blade', { hand: 'both', len: .36, wid: 2.4, pal: PAL.gold }], ['horn', { len: .14, wid: 1.6, pal: PAL.gold, dx: -.5 }], ['ridge', { n: 5, len: .1, pal: PAL.gold }]]
  },
  'meganium-mega': {   // 메가메가니움: 선명한 연두 · 진분홍 목 꽃 / 목둘레 큰 꽃잎 고리 · 머리 위 꽃
    base: 'meganium',
    map: { d7efa7: 0xe6ffb8, '9fcf6f': 0xa8e070, '5fb727': 0x52c22e, '9f0000': 0xa0124a, d73f00: 0xe8407a, ff875f: 0xff9ad0 },
    parts: [['petals', { at: 'neck', n: 8, len: .16, pal: PAL.pink }], ['petals', { at: 'head', n: 5, len: .09, pal: PAL.gold, dy: 1 }]]
  },
  'feraligatr-mega': {   // 메가장크로다일: 깊은 바다빛 · 타오르는 붉은 등지느러미 / 등 가시 · 머리 볏
    base: 'feraligatr',
    map: { '0067b7': 0x004c98, '1f9fe7': 0x1a84d8, '9f0000': 0xb8101a, d73f00: 0xff3a1a },
    parts: [['ridge', { n: 6, len: .12, pal: PAL.crimson }], ['horn', { len: .12, wid: 1.6, pal: PAL.crimson, dx: -.7, n: 3 }]]
  },
  'swampert-mega': {   // 메가대짱이: 짙은 청색 · 더 진한 주황 볼 / 머리 지느러미 · 볼의 주황 가시
    base: 'swampert',
    map: { '1f9fe7': 0x1878c8, '0067b7': 0x00508f, bf7727: 0xff8a1a, d73f00: 0xff5a10, ff875f: 0xffb060 },
    parts: [['horn', { len: .16, wid: 2.2, pal: PAL.navy, dx: -.6 }], ['blade', { hand: 'cheek', len: .1, wid: 1.4, pal: PAL.orange }]]
  },
  'emboar-mega': {   // 메가염무왕: 칠흑 몸 · 목의 거대한 불꽃 갈기 · 머리 불꽃
    base: 'emboar',
    map: { '5b5756': 0x3a3436, '444140': 0x221e20, d13500: 0xff3a10 },
    parts: [['flame', { at: 'neck', r: .13, pal: PAL.fire }], ['flame', { at: 'head', r: .08, pal: PAL.fire }], ['ribbons', { at: 'front', pal: PAL.fire, len: .28 }]]
  },
  'chesnaught-mega': {   // 메가브리가론: 짙은 초록 갑주 / 팔의 가시 방패 · 등 가시
    base: 'chesnaught',
    map: { '5c9940': 0x3e8030, '97c97e': 0x7ab860, '244216': 0x16300c },
    parts: [['shield', { hand: 'front', r: .13, pal: PAL.leaf }], ['ridge', { n: 5, len: .1, pal: PAL.bark }]]
  },
  'delphox-mega': {   // 메가마폭시: 짙은 진홍 털 / 지팡이 끝 큰 불꽃 · 귀 끝 불꽃
    base: 'delphox',
    map: { c63f41: 0xb02040, '8e3636': 0x7a1a2a, '681d1d': 0x4a0a14 },
    parts: [['flame', { at: 'front', r: .12, pal: PAL.fire, dy: -.12 }], ['flame', { at: 'head', r: .07, pal: PAL.fire }], ['ribbons', { at: 'back', pal: PAL.fire, len: .3 }]]
  },
  'greninja-mega': {   // 메가개굴닌자: 보랏빛 밤 · 보라 혀 목도리 / 목에서 흩날리는 그림자 리본 · 검은 볏
    base: 'greninja',
    map: { '2657ba': 0x5a2a9a, '303b8a': 0x3a2070, '1c2350': 0x1a1038, c13069: 0x8a30c1, f46881: 0xc070f4, '59172f': 0x3a1259 },
    parts: [['ribbons', { at: 'neck', pal: PAL.violet, len: .4 }], ['horn', { len: .12, wid: 1.4, pal: PAL.shadow, dx: -.6, n: 2 }]]
  },
  'dragonite-mega': {   // 메가망나뇽: 밝은 주황 · 청록 날개 / 날개 끝 가시 · 긴 더듬이 두 줄
    base: 'dragonite',
    map: { df771f: 0xff8a2a, '5fb727': 0x2aa8a0, '278700': 0x0a6a6a, '7fdf57': 0x7af0e0 },
    parts: [['horn', { len: .2, wid: 1, pal: PAL.orange, dx: -.3, n: 2 }], ['ridge', { n: 4, len: .1, pal: PAL.teal }]]
  },
  'gyarados-mega': {   // 메가갸라도스: 짙은 남색 · 검은 지느러미 / 등 가시 지느러미 · 머리 볏
    base: 'gyarados',
    map: { '0067b7': 0x1a2a5a, '1f9fe7': 0x2a4a8a, '7fcfff': 0x5a7ab8, a77f27: 0x3a2a20, dfb767: 0x6a5040, f7e79f: 0xa08870 },
    parts: [['ridge', { n: 7, len: .12, pal: PAL.shadow }], ['horn', { len: .13, wid: 1.6, pal: PAL.crimson, dx: -.8, n: 3 }]]
  },
  'scizor-mega': {   // 메가핫삼: 선명한 붉은 강철 / 양손의 거대 집게
    base: 'scizor',
    map: { d73f00: 0xe8281a, '9f0000': 0x9a0a10, ff875f: 0xff6a50 },
    parts: [['claw', { hand: 'both', r: .1, pal: PAL.crimson }]]
  },
  'raichu-mega-x': {   // 메가라이츄X: 푸른 전류 털 / 귀 끝 번개 뿔 · 몸 둘레 스파크
    base: 'raichu',
    map: { ffaf47: 0x6ac8ff, df871f: 0x3a8ae8, a75f1f: 0x1a4aa8, '773f00': 0x0a2058, b78727: 0x2a5ab8 },
    parts: [['horn', { len: .16, wid: 1.4, pal: PAL.electric, dx: -.4, n: 2 }], ['sparks', { pal: PAL.electric }]]
  },
  'raichu-mega-y': {   // 메가라이츄Y: 황금빛 털 / 귀 끝 번개 뿔 · 몸 둘레 스파크
    base: 'raichu',
    map: { ffaf47: 0xffe070, df871f: 0xe8b030, a75f1f: 0xb07818, '773f00': 0x5a3a08, b78727: 0xc09030 },
    parts: [['horn', { len: .16, wid: 1.4, pal: PAL.gold, dx: -.4, n: 2 }], ['sparks', { pal: PAL.gold }]]
  },
  'mewtwo-mega-x': {   // 메가뮤츠X: 회청빛 근육질 · 짙은 보라 / 머리에서 등으로 이어지는 관 · 등 돌기
    base: 'mewtwo',
    map: { af6fb7: 0x5a6aa0, '873f87': 0x3a3a78, d797df: 0x8a9ad0 },
    parts: [['horn', { len: .3, wid: 2, pal: PAL.steel, dx: -1.4, dy: .55, n: 1 }], ['ridge', { n: 3, len: .07, pal: PAL.steel }]]
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
    for (const part of spec.parts) { const [name, o] = Array.isArray(part) ? part : [part, {}]; PARTS[name](pen, fr, f, col, anim, o); }
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
  head = head || { x: Math.round((x0 + x1) / 2), y: y0 };
  // 등 꼭대기: 뒤쪽 45% 에서 가장 높은 픽셀 · 목: 머리 꼭대기에서 조금 아래 · 뒤
  let backTop = null;
  for (let y = y0; y <= y1 && !backTop; y++) for (let k = 0; k < w * .45; k++) { const x = f > 0 ? x0 + k : x1 - k; if (at(x, y)) { backTop = { x, y }; break; } }
  const neck = { x: Math.round(head.x - f * w * .08), y: Math.round(head.y + h * .2) };
  // 등선: 뒤쪽 절반 열마다 가장 높은 픽셀 (등 가시 · 지느러미)
  const ridge = [];
  for (let k = 0; k < w * .55; k += 1) { const x = f > 0 ? x0 + k : x1 - k; for (let y = y0; y <= y1; y++) if (at(x, y)) { ridge.push({ x, y }); break; } }
  return { x0, x1, y0, y1, w, h, head, front, back, backTop: backTop || head, neck, ridge, colorPts };
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

const ptOf = (fr, at) => (at === 'front' ? fr.front : at === 'back' ? fr.back : at === 'backTop' ? fr.backTop : at === 'neck' ? fr.neck : fr.head);
const PARTS = {
  // ── 범용 파츠 (o: 옵션 · 길이 · 크기는 몸 높이 비율) ──
  horn(pen, fr, f, col, anim, o) {   // 머리 위 뿔 · 볏 · 더듬이 (n 갈래)
    const h = fr.head, n = o.n || 1, len = Math.max(3, fr.h * (o.len || .14));
    for (let k = 0; k < n; k++) spike(pen, h.x - f * (1 + k * 3), h.y + 1 + k, -f * ((o.dx ?? -.4) * -1 + k * .35), -(1 - (o.dy || 0)) + (o.dy || 0), len * (1 - k * .2), o.wid || 1.5, o.pal, { bend: -f * .15 });
  },
  ridge(pen, fr, f, col, anim, o) {   // 등선을 따라 바깥으로 돋은 가시 · 지느러미 (몸 뒤 빈 칸에만)
    const r = fr.ridge, n = o.n || 4, len = Math.max(2, fr.h * (o.len || .1));
    if (r.length < 4) return;
    for (let k = 0; k < n; k++) { const p = r[Math.round((k + .5) / n * (r.length - 1))]; spike(pen, p.x, p.y, -f * .5, -1, len * (k % 2 ? .75 : 1), 1.3, o.pal, { behind: true }); }
  },
  blade(pen, fr, f, col, anim, o) {   // 손 · 볼에서 뻗은 칼날 · 가시 (hand: front · back · both · cheek)
    const pts = o.hand === 'both' ? [fr.front, fr.back] : o.hand === 'cheek' ? [{ x: fr.head.x - f * 2, y: fr.head.y + Math.round(fr.h * .16) }] : [ptOf(fr, o.hand || 'front')];
    for (const p of pts) if (p) spike(pen, p.x, p.y, f * .35, .9, Math.max(3, fr.h * (o.len || .25)), o.wid || 2, o.pal, { bend: f * .3 });
  },
  cannon(pen, fr, f, col, anim, o) {   // 앞으로 뻗은 강철 포신 (외곽선 → 그림자 → 기본 → 하이라이트 · 포구)
    const p = ptOf(fr, o.at || 'backTop');
    if (!p) return;
    const L = Math.max(4, fr.h * (o.len || .3)), R = Math.max(1.5, fr.h * (o.r || .06)), pal = [0x10141c, 0x4a5262, 0x8a94a8, 0xdde4f0];
    for (let t = 0; t <= L; t++) for (let s = -R - 1; s <= R + 1; s++) {
      const x = p.x + f * (t - L * .2), y = p.y - R * .5 + s, edge = Math.abs(s) > R || t === 0 || t === Math.round(L);
      pen.put(x, y, edge ? pal[0] : s < -R * .3 ? pal[3] : s > R * .4 ? pal[1] : pal[2]);
    }
    for (let s = -R + 1; s <= R - 1; s++) pen.put(p.x + f * (L * .8), p.y - R * .5 + s, 0x05070a);   // 포구
  },
  shield(pen, fr, f, col, anim, o) {   // 팔에 든 가시 방패 (둥근 판 + 가장자리 가시)
    const p = ptOf(fr, o.hand || 'front');
    if (!p) return;
    const R = Math.max(3, fr.h * (o.r || .12)), cx = p.x + f * 2, cy = p.y;
    for (let y = -R - 1; y <= R + 1; y++) for (let x = -R * .6 - 1; x <= R * .6 + 1; x++) {
      const d = Math.hypot(x / .6, y);
      if (d > R + 1) continue;
      pen.put(cx + x, cy + y, d > R ? o.pal[0] : x * f > R * .2 ? o.pal[3] : y > R * .4 ? o.pal[1] : o.pal[2]);
    }
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * .55; spike(pen, cx + f * Math.cos(a) * R * .55, cy + Math.sin(a) * R, f * Math.cos(a), Math.sin(a), 2.5, 1, PAL.bark); }
  },
  claw(pen, fr, f, col, anim, o) {   // 거대 집게 (위아래 두 날 · 가운데 눈 무늬)
    for (const p of [fr.front, fr.back]) {
      if (!p) continue;
      const R = Math.max(3, fr.h * (o.r || .1));
      spike(pen, p.x, p.y - 1, f, -.55, R * 1.6, R * .55, o.pal, { bend: f * .4 });
      spike(pen, p.x, p.y + 1, f, .45, R * 1.3, R * .45, o.pal, { bend: -f * .4 });
      pen.put(p.x + f * 2, p.y, 0x1a1a1a); pen.put(p.x + f * 3, p.y, 0xfff0a0);
    }
  },
  petals(pen, fr, f, col, anim, o) {   // 둘레로 펼쳐진 꽃잎 (몸 뒤 빈 칸에 · 조금씩 일렁인다)
    const p = ptOf(fr, o.at || 'backTop'), n = o.n || 6, len = Math.max(2.5, fr.h * (o.len || .15));
    if (!p) return;
    for (let k = 0; k < n; k++) { const a = Math.PI + (k / (n - 1)) * Math.PI + Math.sin(col * .8 + k) * .08; spike(pen, p.x, p.y + (o.dy || 0), Math.cos(a), Math.sin(a), len, Math.max(1.2, len * .35), o.pal, { behind: true }); }
  },
  flame(pen, fr, f, col, anim, o) {   // 그 자리에서 타오르는 불꽃 덩이
    const p = ptOf(fr, o.at || 'head');
    if (p) flameBlob(pen, p.x, p.y + Math.round(fr.h * (o.dy || 0)), Math.max(2, Math.round(fr.h * (o.r || .07))), col * 1.2, o.pal);
  },
  ribbons(pen, fr, f, col, anim, o) {   // 뒤로 흩날리는 리본 두 가닥 (목도리 · 그림자)
    const p = ptOf(fr, o.at || 'neck');
    if (!p) return;
    for (const off of [0, 1.8]) {
      const L = Math.round(Math.max(6, fr.h * (o.len || .35))), ph = col * 1.1 + off;
      for (let i = 0; i <= L; i++) {
        const x = p.x - f * i * .9, y = p.y + off * 1.5 - i * .2 + Math.sin(ph + i * .5) * 1.4, w = Math.max(.5, 1.6 * (1 - i / L));
        for (let s = -w; s <= w; s += .5) pen.put(x, y + s, o.pal[i < L * .2 ? 3 : i < L * .55 ? 2 : 1], true);
      }
    }
  },
  sparks(pen, fr, f, col, anim, o) {   // 몸 둘레로 튀는 지그재그 전기 (프레임마다 다른 자리)
    for (let k = 0; k < 3; k++) {
      const a = (col * 2.3 + k * 2.1) % (Math.PI * 2), cx = (fr.x0 + fr.x1) / 2 + Math.cos(a) * fr.w * .55, cy = (fr.y0 + fr.y1) / 2 + Math.sin(a) * fr.h * .45;
      let x = cx, y = cy;
      for (let s = 0; s < 4; s++) { const nx = x + (s % 2 ? 1.5 : -1.5), ny = y + 1.5; pen.put(x, y, o.pal[3], true); pen.put(nx, ny, o.pal[2], true); x = nx; y = ny; }
    }
  },
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
