// 절차적 도트 텍스처: 스킬/아이템 아이콘, 타일셋, 배경, 효과용 텍스처
import Phaser from 'phaser';
import { RES } from '../config.js';
import { STAGES } from '../data/stages.js';
import { SKILLS } from '../data/pokemon.js';
import { ITEMS } from '../data/items.js';
import { typeColor } from '../data/types.js';
import { drawDetailedPixelTree } from './TreeArt.js';

// 12x12 도트 아이콘. a=주색 b=밝은색 c=어두운색 k=외곽선 w=흰색
const MAPS = {
  flame: ['.....k......', '....kak.....', '....kaak....', '...kaabak...', '..kaabbak...', '..kabbwbak..', '.kaabwwbak..', '.kabbwwbbak.', '.kabwwwwbak.', '.kaabwwbaak.', '..kaaaaaak..', '...kkkkkk...'],
  drop: ['.....kk.....', '....kaak....', '....kaak....', '...kaaaak...', '...kabaak...', '..kabbaaak..', '..kabaaaak..', '.kaabaaaaak.', '.kaaaaaaaak.', '.kcaaaaaack.', '..kcaaaack..', '...kkkkkk...'],
  leaf: ['.........kk.', '.......kkak.', '.....kkaaak.', '....kaabaak.', '...kaabaaak.', '..kaabaaak..', '..kabaaak...', '.kabaaak....', '.kbaaak.....', '.kbkkk......', 'kbk.........', 'kk..........'],
  bolt: ['......kkkk..', '.....kaaak..', '....kaaak...', '...kaaak....', '..kaaakkkk..', '.kaaaaaaak..', '.kkkkaaak...', '....kaak....', '...kaak.....', '...kak......', '..kak.......', '..kk........'],
  fist: ['............', '..kkkkkkk...', '.kabkabkak..', '.kabkabkabk.', '.kaaaaaaabk.', '.kaaaaaaaak.', '.kkaaaaaaak.', '.kakaaaaaak.', '..kaaaaaack.', '..kcaaaacck.', '...kkkkkkk..', '............'],
  ghost: ['....kkkk....', '...kaaaak...', '..kaaaaaak..', '.kaawaawaak.', '.kaakaakaak.', '.kaaaaaaaak.', '.kaakkkkaak.', '.kaaaaaaaak.', '.kaaaaaaaak.', '.kakaakaakak', '.kk.kk.kk.kk', '............'],
  fang: ['............', '.kkkkkkkkkk.', '.kaaaaaaaak.', '.kcaaaaaack.', '.kkwkkkkwkk.', '..kwk..kwk..', '..kwk..kwk..', '..kwk..kwk..', '...k....k...', '............', '............', '............'],
  wing: ['............', '.k..........', '.kak........', '.kaak.......', '.kabaak.....', '.kabbaaak...', '..kabbaaaak.', '..kaabbaaak.', '...kaaabaak.', '....kkaaak..', '......kkk...', '............'],
  dash: ['............', '......kk....', '......kak...', '.kkk..kaak..', '......kaaak.', '.kkkkkkaaaak', '.kbbbbbaaaak', '.kkkkkkaaaak', '......kaaak.', '.kkk..kaak..', '......kak...', '......kk....'],
  bubble: ['............', '..kkk.......', '.kawak......', '.kaaak..kk..', '..kkk..kwak.', '.......kaak.', '...kkk..kk..', '..kawwk.....', '..kaaak.....', '..kaaak.....', '...kkk......', '............'],
  spin: ['....kkkk....', '..kkaaaakk..', '.kaakkkkaak.', '.kak....kak.', 'kak..kk..kak', 'kak.kak..kak', 'kak.ka...kak', 'kak..kk..kak', '.kak....kak.', '.kaakkkkk...', '..kkaaaa....', '....kkkk....'],
  vine: ['..........k.', '.........kak', '........kak.', '...kk..kak..', '..kabk.kak..', '..kaak.kak..', '...kk.kak...', '.....kak....', '....kak.kk..', '...kak.kabk.', '..kak..kaak.', '..kk....kk..'],
  seed: ['............', '.....kk.....', '....kbak....', '...kbaaak...', '...kbaaak...', '..kbaaaaak..', '..kaaaaaak..', '..kaaaaack..', '...kaaack...', '....kkkk....', '............', '............'],
  thunder: ['...kkkk.....', '..kwwwwkkk..', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '.....kaak...', '....kaak....', '...kaaakk...', '...kkkaak...', '.....kak....', '....kak.....', '....kk......', '............'],
  wave: ['............', '.k..........', '.kak..k.....', '..kak.kak...', '...kak.kak..', '...kak..kak.', '...kak..kak.', '...kak.kak..', '..kak.kak...', '.kak..k.....', '.k..........', '............'],
  boom: ['.....k......', '..k..kk..k..', '..kk.kak.k..', '...kkaaakk..', '.kkaaaaaakk.', '..kaabbaak..', 'kkaabwwbaakk', '..kaabbaak..', '.kkaaaaaakk.', '...kkaakk...', '..k..kk..k..', '.....k......'],
  shield: ['.kkkkkkkkkk.', '.kaaaaaaaak.', '.kabbbbbbak.', '.kabaaaabak.', '.kabaaaabak.', '.kabaaaabak.', '..kabaabak..', '..kabaabak..', '...kabbak...', '....kaak....', '.....kk.....', '............'],
  orb: ['....kkkk....', '..kkaaaakk..', '.kaabbaaaak.', '.kabwwbaaak.', 'kaabwbaaaaak', 'kaaabaaaaaak', 'kaaaaaaaaack', 'kaaaaaaaacck', '.kaaaaaaack.', '.kcaaaaacck.', '..kkcccckk..', '....kkkk....'],
  claw: ['............', '.k...k...k..', '.kk..kk..kk.', '.kak.kak.kak', '..kak.kak.kk', '..kak.kak.k.', '...kak.kak..', '...kak.kak..', '....kk..kk..', '............', '............', '............'],
  magnet: ['............', '.kkkk..kkkk.', '.kaak..kaak.', '.kaak..kaak.', '.kaak..kaak.', '.kaak..kaak.', '.kaakkkkaak.', '.kaaaaaaaak.', '..kaaaaaak..', '...kkkkkk...', '.kwwk..kbbk.', '.kkkk..kkkk.'],
  tag: ['..kkkkkkkk..', '..kwwwwwwk..', '..kwaaaawk..', '..kwwaawwk..', '..kwaaaawk..', '..kwwaawwk..', '..kwaaaawk..', '..kwwwwwwk..', '..kwwwwwwk..', '..kkkkkkkk..', '....kk......', '.....k......'],
  belt: ['............', '............', 'kkkkkkkkkkkk', 'kaaaaaaaaaak', 'kaaakkkkaaak', 'kkkkwwwwkkkk', '....kwwk....', '...kaakaak..', '..kaak.kaak.', '..kkk...kkk.', '............', '............'],
  scarf: ['............', '..kkkkkkkk..', '.kwwwwwwwwk.', '.kwbbbbbbwk.', '.kkkkkwwkkk.', '.....kwwk...', '.....kwbk...', '.....kwwk...', '.....kwbk...', '.....kwwk...', '.....kkkk...', '............'],
  barb: ['..........k.', '.........kwk', '........kak.', '.......kak..', '......kak...', '.....kak....', '....kak.....', '...kak......', '..kak.......', '.kak........', '.kk.........', '............'],
  core: ['....kkkk....', '..kkaaaakk..', '.kaaaaaaaak.', '.kaakkkkaak.', 'kaak.ww.kaak', 'kaak.ww.kaak', 'kaak.ww.kaak', 'kaak.ww.kaak', '.kaakkkkaak.', '.kaaaaaaaak.', '..kkaaaakk..', '....kkkk....'],
  food: ['.....kk.....', '......kk....', '...kkkkkkk..', '..kaaaaaabk.', '.kaaaaaaabbk', '.kaaaaaaaabk', '.kaaaaaaaaak', '.kaaaaaaaaak', '.kcaaaaaaack', '..kcaaaaack.', '...kkkkkkk..', '............'],
  bell: ['.....kk.....', '....kaak....', '...kaaaak...', '..kaabaaak..', '..kaabaaak..', '..kaabaaak..', '.kaaabaaaak.', '.kaaaaaaaak.', 'kkkkkkkkkkkk', '.....kk.....', '.....kk.....', '............'],
  chest: ['..kkkkkkkkkkkk..', '.kaaaaaaaaaaaak.', 'kaabbbbbbbbbbaak', 'kaaaaaaaaaaaaaak', 'kaaaaakkkkaaaaak', 'kkkkkkwwwwkkkkkk', 'kwwwwkwkkwkwwwwk', 'kwwwwkwwwwkwwwwk', 'kwwwwwkkkkwwwwwk', 'kwwwwwwwwwwwwwwk', 'kcwwwwwwwwwwwwck', '.kccccccccccccck', '..kkkkkkkkkkkkk.'],
  berry: ['..kk....', '.kbbk...', 'kaabak..', 'kabaaak.', 'kaaaaak.', 'kaaaack.', '.kaack..', '..kk....']
};

// Z크리스탈 (마름모 + Z 각인)
const ZCRYSTAL = ['.....kk.....', '....kbbk....', '...kbaaak...', '..kbzzzzak..', '.kbaaazaaak.', 'kbaaazaaaack', 'kaaazaaaaack', '.kaazaaaack.', '..kazzzzck..', '...kaacck...', '....kcck....', '.....kk.....'];

const ITEM_ICON = {
  charcoal: { map: 'orb', color: 0x2c2a34, extra: { b: 0xff8a3a, w: 0xffd0a0 } },
  drop: { map: 'drop', color: 0x4a9cff }, seed: { map: 'seed', color: 0x9a7a3a, extra: { b: 0x6ae05a } },
  magnet: { map: 'magnet', color: 0xd84848, extra: { w: 0xe8e8f0, b: 0x4a7aff } },
  tag: { map: 'tag', color: 0x8a5ad8, extra: { w: 0xf4ecd8 } }, belt: { map: 'belt', color: 0x2c2a34 },
  scarf: { map: 'scarf', color: 0xf4f0e8, extra: { w: 0xffffff, b: 0xd0c8d8 } }, barb: { map: 'barb', color: 0xb84ad0 },
  orb: { map: 'orb', color: 0x9a3ad0 }, core1: { map: 'core', color: 0x3ad0c0 }, core2: { map: 'core', color: 0xffc830 }, core3: { map: 'core', color: 0xff5a7a },
  food: { map: 'food', color: 0xe04a3a }, bell: { map: 'bell', color: 0xffb0c8 }, claw: { map: 'claw', color: 0xe8e8f0 }, claw2: { map: 'claw', color: 0xffd230 }
};

export const css = c => '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6);
export function shade(c, k) {
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  if (k >= 1) { const t = k - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  else { r *= k; g *= k; b *= k; }
  return (Math.min(255, r | 0) << 16) | (Math.min(255, g | 0) << 8) | Math.min(255, b | 0);
}
export const iconPalette = main => ({ a: main, b: shade(main, 1.45), c: shade(main, .55), k: 0x0e0b18, w: 0xffffff });

export function pixelTexture(scene, key, rows, pal, scale = 1) {
  if (scene.textures.exists(key)) return key;
  const h = rows.length, w = rows[0].length;
  const tex = scene.textures.createCanvas(key, w * scale, h * scale);
  const ctx = tex.getContext();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (ch === '.' || pal[ch] === undefined) continue;
    ctx.fillStyle = css(pal[ch]);
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }
  tex.refresh();
  return key;
}

export function skillIcon(scene, id) {
  const s = SKILLS[id];
  return pixelTexture(scene, `sk:${id}`, MAPS[s.icon] || MAPS.orb, iconPalette(typeColor(s.type)));
}
// game-icons.net 단색 SVG → 타입 색 스킬 아이콘 (64px, 매끈하게 줄여 쓴다)
//  흰 실루엣을 틀로 삼아: 어두운 외곽선 → 타입 색 빛무리 → 위는 밝고 아래는 짙은 타입 색 그라데이션 → 윗부분 반사광
export const SKILL_ICON_PX = 64;
export async function composeSkillIcons(scene, svgs) {
  const S = SKILL_ICON_PX, pad = 6;
  const canvas = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const rgba = (n, a) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  await Promise.all(Object.entries(svgs).map(async ([id, svg]) => {
    const key = `sk:${id}`, s = SKILLS[id];
    if (!s || scene.textures.exists(key)) return;
    try {
      const clean = svg.replace(/<path d="M0 0h512v512H0z"\s*\/>/, '').replace(/fill="#000"/g, 'fill="#fff"');
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clean);
      await img.decode();
      const col = typeColor(s.type);
      const mask = canvas(), mc = mask.getContext('2d');
      mc.drawImage(img, pad, pad, S - pad * 2, S - pad * 2);
      const tint = (fill) => { const c = canvas(), x = c.getContext('2d'); x.drawImage(mask, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = fill; x.fillRect(0, 0, S, S); return c; };
      const dark = tint('#0a0810');
      const g = mc.createLinearGradient(0, pad, 0, S - pad);
      g.addColorStop(0, css(shade(col, 1.75))); g.addColorStop(.45, css(shade(col, 1.15))); g.addColorStop(1, css(shade(col, .7)));
      const body = tint(g);
      const hl = canvas(), hx = hl.getContext('2d');   // 윗부분 반사광
      hx.drawImage(mask, 0, 0); hx.globalCompositeOperation = 'source-in';
      const hg = hx.createLinearGradient(0, pad, 0, S * .55); hg.addColorStop(0, 'rgba(255,255,255,.55)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      hx.fillStyle = hg; hx.fillRect(0, 0, S, S);
      const t = scene.textures.createCanvas(key, S, S), c = t.getContext();
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) c.drawImage(dark, dx, dy);
      c.save(); c.shadowColor = rgba(col, .85); c.shadowBlur = 7; c.drawImage(body, 0, 0); c.restore();
      c.drawImage(body, 0, 0); c.drawImage(hl, 0, 0);
      t.refresh(); t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    } catch (e) { console.warn('[icon] 스킬 아이콘을 그리지 못함 (도트 아이콘으로 대신)', id, e); }
  }));
}

export function tagIcon(scene, type) { return pixelTexture(scene, `tag:${type}`, MAPS.dash, iconPalette(typeColor(type))); }
// 가방·HUD 아이템 그림: 본가 가방 아이콘(itm:<id>, 160px)을 화면에 보일 크기(size × RES 픽셀)로 곱게 줄인 텍스처.
//  반씩 여러 번 줄여서 가장자리가 깨지지 않게 한다. 그림을 못 받았으면 null (도트 아이콘 it:<id> 로 대신)
export function itemArt(scene, id, size) {
  const src = `itm:${id}`;
  if (!scene.textures.exists(src)) return null;
  const px = Math.round(size * RES), key = `${src}@${px}`;
  if (scene.textures.exists(key)) return key;
  let img = scene.textures.get(src).getSourceImage(), w = img.width;
  while (w / 2 >= px * 1.5) {
    const half = document.createElement('canvas'); half.width = half.height = Math.round(w / 2);
    const hc = half.getContext('2d'); hc.imageSmoothingQuality = 'high'; hc.drawImage(img, 0, 0, half.width, half.height);
    img = half; w = half.width;
  }
  const t = scene.textures.createCanvas(key, px, px), c = t.getContext();
  c.imageSmoothingQuality = 'high'; c.drawImage(img, 0, 0, px, px);
  t.refresh(); t.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
}

export function itemIcon(scene, id) {
  const spec = ITEM_ICON[ITEMS[id].icon];
  return pixelTexture(scene, `it:${id}`, MAPS[spec.map], Object.assign(iconPalette(spec.color), spec.extra || {}));
}

// 고정 시드 난수 (텍스처가 매번 같은 모양이 되도록)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function generateBaseTextures(scene) {
  const T = scene.textures;
  if (!T.exists('px')) { const t = T.createCanvas('px', 2, 2); const c = t.getContext(); c.fillStyle = '#fff'; c.fillRect(0, 0, 2, 2); t.refresh(); }
  if (!T.exists('glow')) {
    const t = T.createCanvas('glow', 64, 64), c = t.getContext(), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); t.refresh();
  }
  if (!T.exists('ring')) {
    const t = T.createCanvas('ring', 64, 64), c = t.getContext();
    for (let a = 0; a < 360; a += 2) { const r = a * Math.PI / 180; c.fillStyle = '#fff'; c.fillRect(Math.round(32 + Math.cos(r) * 29), Math.round(32 + Math.sin(r) * 29), 2, 2); }
    t.refresh();
  }
  pixelTexture(scene, 'chest', MAPS.chest, { a: 0xd83a3a, b: 0xff7a6a, c: 0x7a1a20, k: 0x0e0b18, w: 0xf4f0e8 });
  pixelTexture(scene, 'chest-open', MAPS.chest.map((r, i) => i < 5 ? r.replace(/[abw]/g, '.') : r), { a: 0xd83a3a, b: 0xff7a6a, c: 0x7a1a20, k: 0x0e0b18, w: 0xf4f0e8 });
  pixelTexture(scene, 'oran', MAPS.berry, { a: 0x3a6ae0, b: 0x9ac0ff, c: 0x1a3a90, k: 0x0e0b18 });
  pixelTexture(scene, 'megastone', MAPS.orb, { a: 0x8a5aff, b: 0xff8ad0, c: 0x3a1a8a, k: 0x0e0b18, w: 0xfff6c0 });
  pixelTexture(scene, 'zcrystal', ZCRYSTAL, { k: 0x0e0b18, a: 0xffe86a, b: 0xfffbd0, c: 0xc89a2a, z: 0x8a4a10 });
  // HUD Q 구슬용 큰 Z크리스탈 (고해상도, 매끈하게)
  hiTex(scene, 'zcrystal-hi', 24, 24, c => {
    const pts = [[12, 1], [22, 12], [12, 23], [2, 12]];
    const g = c.createLinearGradient(0, 1, 0, 23); g.addColorStop(0, '#fffbd0'); g.addColorStop(.5, '#ffd84a'); g.addColorStop(1, '#a8701a');
    c.shadowColor = 'rgba(255,220,90,.9)'; c.shadowBlur = 4 * RES;
    c.fillStyle = g; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = '#3a2208'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#5a3008'; c.font = `bold 11px ${'Cinzel, serif'}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Z', 12, 12.5);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(12, 3); c.lineTo(17, 8); c.lineTo(12, 9); c.closePath(); c.fill();
  });
  makePurifyTextures(scene);
  makeHudTextures(scene);
  makeCutsceneTextures(scene);
  for (const id of Object.keys(SKILLS)) skillIcon(scene, id);
  for (const id of Object.keys(ITEMS)) itemIcon(scene, id);
  STAGES.forEach((st, i) => { makeTileset(scene, i, st.palette); makeBackgrounds(scene, i, st.palette); makeCaveBg(scene, i, st.palette); });
}

// ---------------- 할로우 나이트풍 UI 부품 (입체감 있는 고해상도 그림) ----------------
// 도트가 아니라 RES 배 해상도 캔버스에 그라데이션·반사광·그림자로 그리고, 화면에는 1/RES 로 줄여 1:1 로 찍는다.
// 빛은 왼쪽 위에서 온다고 가정한다.
const DARK = '#0a0810';

export function hiTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, Math.ceil(w * RES), Math.ceil(h * RES)), c = t.getContext();
  c.save(); c.scale(RES, RES); draw(c, w, h); c.restore();
  t.refresh(); t.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
}
const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const ringPath = (c, x, y, r0, r1) => { c.beginPath(); c.arc(x, y, r1, 0, Math.PI * 2); c.arc(x, y, r0, 0, Math.PI * 2, true); };
// 왼쪽 위가 밝은 구슬
function sphere(c, x, y, r, light, dark) {
  const g = c.createRadialGradient(x - r * .35, y - r * .42, r * .08, x, y, r);
  g.addColorStop(0, light); g.addColorStop(1, dark);
  c.fillStyle = g; circle(c, x, y, r); c.fill();
}
// 유리 반사광
function specular(c, x, y, r, a = .55) {
  const hx = x - r * .36, hy = y - r * .46, g = c.createRadialGradient(hx, hy, 0, hx, hy, r * .6);
  g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.save(); circle(c, x, y, r); c.clip(); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
// 금속 테두리 (위는 밝고 아래는 어둡다)
function metalRing(c, x, y, r0, r1, stops) {
  const g = c.createLinearGradient(0, y - r1, 0, y + r1);
  stops.forEach(([k, col]) => g.addColorStop(k, col));
  c.fillStyle = g; ringPath(c, x, y, r0, r1); c.fill('evenodd');
  c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = .7; circle(c, x, y, r1 + .35); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = .9; circle(c, x, y, r0 - .2); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .6; c.beginPath(); c.arc(x, y, (r0 + r1) / 2, Math.PI * 1.08, Math.PI * 1.62); c.stroke();
}
const SILVER = [[0, '#ffffff'], [.35, '#c9c4d6'], [.62, '#6c6880'], [1, '#2a2736']];
const GOLD = [[0, '#fff4c8'], [.35, '#e8c070'], [.65, '#9a6a24'], [1, '#4a3010']];

// 정사각 초상화를 둥글게 오려 낸 텍스처 (지름 40)
export function roundPortrait(scene, key) {
  const src = scene.textures.exists(`portrait:${key}`) ? `portrait:${key}` : `icon:${key}`, out = `round:${key}`;
  if (scene.textures.exists(out)) return out;
  if (!scene.textures.exists(src)) return 'px';
  const S = 40, t = scene.textures.createCanvas(out, S, S), c = t.getContext();
  c.imageSmoothingEnabled = false;
  const f = scene.textures.getFrame(src);
  c.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, S, S);
  const img = c.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((x + .5 - S / 2) ** 2 + (y + .5 - S / 2) ** 2 > (S / 2) ** 2) img.data[(y * S + x) * 4 + 3] = 0;
  c.putImageData(img, 0, 0);
  t.refresh();
  return out;
}

function makeHudTextures(scene) {
  const T = scene.textures;
  for (const k of ['glow', 'ring']) if (T.exists(k)) T.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
  // 양끝이 어둠 속으로 사라지는 가는 선 (장식 대신)
  hiTex(scene, 'line-fade', 240, 6, c => {
    const g = c.createLinearGradient(0, 0, 240, 0);
    g.addColorStop(0, 'rgba(239,234,224,0)'); g.addColorStop(.5, 'rgba(239,234,224,1)'); g.addColorStop(1, 'rgba(239,234,224,0)');
    c.globalAlpha = .18; c.fillStyle = g; c.fillRect(0, 1.5, 240, 3);
    c.globalAlpha = .95; c.fillRect(0, 2.6, 240, .8);
  });
  // HP 가면: 광택 있는 몬스터볼 / 비어 있는 유리 홈 / 깨질 때 흰 섬광
  hiTex(scene, 'ball-full', 18, 19, c => {
    const x = 9, y = 9, r = 7.4;
    c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 2.5 * RES; c.shadowOffsetY = 1.2 * RES;
    c.fillStyle = DARK; circle(c, x, y, r + .8); c.fill(); c.shadowColor = 'transparent';
    c.save(); c.beginPath(); c.rect(0, 0, 18, y); c.clip(); sphere(c, x, y, r, '#ff9a86', '#8a0e1e'); c.restore();
    c.save(); c.beginPath(); c.rect(0, y, 18, 19); c.clip(); sphere(c, x, y, r, '#ffffff', '#9a9488'); c.restore();
    c.fillStyle = DARK; c.fillRect(x - r, y - .85, r * 2, 1.7);
    circle(c, x, y, 2.5); c.fill();
    sphere(c, x, y, 1.6, '#ffffff', '#bdb6aa');
    specular(c, x, y, r, .65);
  });
  hiTex(scene, 'ball-empty', 18, 19, c => {
    const x = 9, y = 9, r = 7.4;
    c.fillStyle = 'rgba(0,0,0,.8)'; circle(c, x, y, r + .8); c.fill();
    sphere(c, x, y, r, '#2e2a42', '#08070d');
    c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x - r, y - .85, r * 2, 1.7);
    c.strokeStyle = 'rgba(239,234,224,.28)'; c.lineWidth = .6; circle(c, x, y, r - .2); c.stroke();
    specular(c, x, y, r, .18);
  });
  hiTex(scene, 'ball-white', 18, 19, c => { c.fillStyle = '#ffffff'; circle(c, 9, 9, 8.2); c.fill(); });
  // 메가 게이지 그릇: 위는 붉고 아래는 흰 몬스터볼 테두리 + 오른쪽 단추 (금속 광택)
  hiTex(scene, 'vessel3d', 58, 60, c => {
    const x = 29, y = 30, r0 = 20.2, r1 = 24.6;
    c.shadowColor = 'rgba(0,0,0,.75)'; c.shadowBlur = 5 * RES; c.shadowOffsetY = 2 * RES;
    c.fillStyle = DARK; ringPath(c, x, y, r0, r1 + .6); c.fill('evenodd'); c.shadowColor = 'transparent';
    c.save(); c.beginPath(); c.rect(0, 0, 58, y); c.clip();
    let g = c.createLinearGradient(0, y - r1, 0, y); g.addColorStop(0, '#ffa08e'); g.addColorStop(.45, '#d8323e'); g.addColorStop(1, '#6a0a16');
    c.fillStyle = g; ringPath(c, x, y, r0, r1); c.fill('evenodd'); c.restore();
    c.save(); c.beginPath(); c.rect(0, y, 58, 30); c.clip();
    g = c.createLinearGradient(0, y, 0, y + r1); g.addColorStop(0, '#ffffff'); g.addColorStop(.5, '#d4cec2'); g.addColorStop(1, '#6e695e');
    c.fillStyle = g; ringPath(c, x, y, r0, r1); c.fill('evenodd'); c.restore();
    c.save(); ringPath(c, x, y, r0, r1); c.clip('evenodd'); c.fillStyle = DARK; c.fillRect(0, y - 1.4, 58, 2.8); c.restore();
    c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 1; circle(c, x, y, r0 - .3); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = .9; c.beginPath(); c.arc(x, y, (r0 + r1) / 2 + .4, Math.PI * 1.1, Math.PI * 1.55); c.stroke();
    // 단추
    const bx = x + 22.6;
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 2 * RES; c.fillStyle = DARK; circle(c, bx, y, 4.8); c.fill(); c.shadowColor = 'transparent';
    sphere(c, bx, y, 3.4, '#ffffff', '#a8a294'); specular(c, bx, y, 3.4, .7);
  });
  // 유리 덮개: 안쪽 그림자 + 왼쪽 위 반사광 (초상화·액체 위에 올린다)
  hiTex(scene, 'gloss', 44, 44, c => {
    const x = 22, y = 22, r = 20.4;
    c.save(); circle(c, x, y, r); c.clip();
    let g = c.createRadialGradient(x, y + 2, r * .55, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
    c.fillStyle = g; c.fillRect(0, 0, 44, 44);
    c.translate(x - 6, y - 9); c.rotate(-.55); c.scale(1, .5);
    g = c.createRadialGradient(0, 0, 0, 0, 0, 11);
    g.addColorStop(0, 'rgba(255,255,255,.42)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; circle(c, 0, 0, 11); c.fill();
    c.restore();
  });
  // 스킬 구슬 (어두운 유리 + 은 테두리) · 대기 포켓몬 고리 · 로비 슬롯(은/금)
  hiTex(scene, 'orb3d', 36, 37, c => {
    c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 3 * RES; c.shadowOffsetY = 1.5 * RES;
    c.fillStyle = DARK; circle(c, 18, 18, 17.4); c.fill(); c.shadowColor = 'transparent';
    sphere(c, 18, 18, 15, '#3c3856', '#07060c');
    metalRing(c, 18, 18, 15, 17, SILVER);
  });
  hiTex(scene, 'mini3d', 28, 29, c => {
    c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 2.5 * RES; c.shadowOffsetY = 1 * RES;
    c.fillStyle = DARK; ringPath(c, 14, 14, 10, 13.4); c.fill('evenodd'); c.shadowColor = 'transparent';
    metalRing(c, 14, 14, 10.2, 12.8, SILVER);
  });
  for (const [key, stops] of [['slot3d', SILVER], ['slot3d-gold', GOLD]]) hiTex(scene, key, 52, 53, c => {
    c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 4 * RES; c.shadowOffsetY = 2 * RES;
    c.fillStyle = DARK; ringPath(c, 26, 26, 20, 24.4); c.fill('evenodd'); c.shadowColor = 'transparent';
    metalRing(c, 26, 26, 20.2, 23.3, stops);
  });
  // 로비 배경: 빛기둥 · 안개
  if (!T.exists('ray')) {
    const t = T.createCanvas('ray', 32, 256), c = t.getContext();
    const gx = c.createLinearGradient(0, 0, 32, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gx; c.fillRect(0, 0, 32, 256);
    c.globalCompositeOperation = 'destination-in';
    const gy = c.createLinearGradient(0, 0, 0, 256);
    gy.addColorStop(0, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gy; c.fillRect(0, 0, 32, 256);
    t.refresh(); t.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  if (!T.exists('fog')) {
    const W = 256, H = 64, t = T.createCanvas('fog', W, H), c = t.getContext(), r = rng(7);
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = 18 + r() * 34, rad = 14 + r() * 26;
      for (const ox of [x - W, x, x + W]) {   // 가로로 이어 붙여도 이음매가 없게
        const g = c.createRadialGradient(ox, y, 0, ox, y, rad);
        g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(ox - rad, y - rad, rad * 2, rad * 2);
      }
    }
    t.refresh(); t.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

// 정화 연출용 도트: 깨져 나가는 세뇌 껍질 유리 파편 4종 · 안도의 하트 · 반짝임
const SHARD_PAL = { k: 0x12051c, a: 0x4a1478, b: 0x8a3ad0, w: 0xeed8ff };
const SHARDS = [
  ['.w..', '.ab.', 'aabb', 'kaa.', '.k..'],
  ['wb.', 'ab.', 'kak'],
  ['wbb..', '.aabb', '..kka'],
  ['kb', 'kk', 'k.']
];
const HEART = ['.kk.kk.', 'krrkrrk', 'krwrrrk', '.krrrk.', '..krk..', '...k...'];
const SPARKLE = ['..w..', '..y..', 'wyWyw', '..y..', '..w..'];
const POKEBALL = [
  '...kkkkk...', '.kkrrrrrkk.', '.krrrrrwwk.', 'krrrrrrrwrk', 'krrrkkkrrrk', 'kkkkkwkkkkk',
  'kwwwkkkwwwk', 'kwwwwwwwwwk', '.kwwwwwwwk.', '.kkwwwwwkk.', '...kkkkk...'
];
function makePurifyTextures(scene) {
  pixelTexture(scene, 'pokeball', POKEBALL, { k: 0x1a1028, r: 0xe83a3a, w: 0xf4f0e8 });
  SHARDS.forEach((rows, i) => pixelTexture(scene, `shard${i}`, rows, SHARD_PAL));
  pixelTexture(scene, 'heart', HEART, { k: 0x5a0a24, r: 0xff5a8a, w: 0xffffff });
  pixelTexture(scene, 'sparkle', SPARKLE, { w: 0xfff2a0, y: 0xffe060, W: 0xffffff });
}

// 컷신용 도트: 트레이너 레드(옆모습, 오른쪽을 봄)·무릎 꿇은 레드·붉은 모자·포켓몬 도감
const RED_PAL = { k: 0x1a1028, r: 0xd83030, R: 0x8a1a20, w: 0xf4f0e8, h: 0x3a2418, s: 0xf0c8a0, S: 0xc89070, v: 0xe04040, V: 0x9a2020, b: 0x2a2a38, j: 0x3a5aa8, J: 0x263c78, o: 0x3a3a48 };
const RED_HEAD = ['....kkkkk.....', '...krrrrrk....', '..krrrrrrrk...', '..krwwrrrrrk..', '..kRRRRRRRRRRk', '..khhssssskk..', '..khsssksk....', '..khhsssSk....', '...kkssskk....', '..kvvvbbvk....', '.kvvvvbbvvk...'];
const RED_STAND = RED_HEAD.concat(['.kvvvvbbvvk...', '.kvVvvbbvvkss.', '.kvVvvbbvvkss.', '.kvvvvbbvvk...', '..kbbbbbbk....', '..kjjjjjjk....', '..kjjjjjjk....', '..kjjJjjjk....', '..kjjJkjjk....', '..kjjJkjjk....', '..kjjJkjjk....', '..kjjkkjjk....', '..kookkook....', '..koookooook..', '..kkkkkkkkkk..']);
const RED_KNEEL = RED_HEAD.concat(['.kvVvvbbvvkk..', '.kvVvvbbvvkssk', '..kbbbbbbk.kk.', '..kjjjjjjjjk..', '..kjjjjjjjjjk.', '..kjjJkkjjjjk.', '..kjjJk.kjjok.', '..koook..kook.', '..kkkkk..kkkk.']);
const RED_CAP = ['...kkkk...', '..krrrrk..', '.krwwrrrk.', '.kRRRRRRRk', '..kkkkkkk.'];
const DEX = ['kkkkkkkk', 'krrrrrrk', 'krbbrrrk', 'krbBbrrk', 'krrrrrrk', 'krwrwrrk', 'krrrrrrk', 'kRRRRRRk', 'krrrrrrk', 'kkkkkkkk'];

function makeCutsceneTextures(scene) {
  pixelTexture(scene, 'red-stand', RED_STAND, RED_PAL);
  pixelTexture(scene, 'red-kneel', RED_KNEEL, RED_PAL);
  pixelTexture(scene, 'red-cap', RED_CAP, RED_PAL);
  pixelTexture(scene, 'pokedex', DEX, { k: 0x1a1028, r: 0xd83030, R: 0x8a1a20, b: 0x8ad8ff, B: 0x2a8ad0, w: 0xffe08a });
}

// 타일셋 (Level.T 번호와 같은 순서, 16px 칸 24개)
//  3 통과 발판: 나무다리(널빤지 + 아래 받침) 또는 철제 격자 · 5 보이지 않는 통과 발판(집 지붕·발코니)
//  8+mask 벽: 돌벽돌 몸통 + 트인 방향마다 — 위: 네온 이끼 테두리와 늘어진 이끼 / 아래: 짙은 그림자 / 옆: 외곽선과 반사광, 트인 모서리는 둥글게
function makeTileset(scene, si, p) {
  const key = `tiles:${si}`;
  if (scene.textures.exists(key)) return;
  const st = STAGES[si], t = scene.textures.createCanvas(key, 24 * 16, 16), c = t.getContext();
  const fill = (x, y, w, h, col, a = 1) => { c.globalAlpha = a; c.fillStyle = css(col); c.fillRect(x, y, w, h); c.globalAlpha = 1; };
  const moss = p.moss || shade(p.edge, .5);

  // 통과 발판
  {
    const ox = 3 * 16;
    if (st.plat === 'metal') {
      const m = 0x6a6a74;
      fill(ox, 0, 16, 4, m); fill(ox, 0, 16, 1, shade(m, 1.6)); fill(ox, 3, 16, 1, shade(m, .45));
      for (let x = 1; x < 16; x += 3) fill(ox + x, 1, 2, 2, shade(m, .55));            // 격자 구멍
      fill(ox + 1, 4, 14, 1, shade(m, .4));
      for (let k = 0; k < 4; k++) { fill(ox + 2 + k * 3, 5 + k, 2, 1, shade(m, .7)); fill(ox + 13 - k * 3, 5 + k, 2, 1, shade(m, .6)); }   // X 받침
      fill(ox + 1, 1, 1, 1, 0xffffff, .5); fill(ox + 14, 1, 1, 1, 0xffffff, .5);
    } else {
      const wd = 0x7a5232;
      fill(ox, 0, 16, 5, wd); fill(ox, 0, 16, 1, shade(wd, 1.5)); fill(ox, 4, 16, 1, shade(wd, .45));
      fill(ox + 5, 1, 1, 3, shade(wd, .55)); fill(ox + 11, 1, 1, 3, shade(wd, .55));      // 널빤지 이음매
      fill(ox + 2, 2, 2, 1, shade(wd, 1.2)); fill(ox + 8, 3, 2, 1, shade(wd, .8));
      fill(ox + 2, 5, 2, 5, shade(wd, .55)); fill(ox + 12, 5, 2, 5, shade(wd, .55));      // 받침 기둥
      fill(ox + 4, 6, 8, 1, shade(wd, .5));
      fill(ox, 0, 16, 1, p.edge, .35);                                                  // 네온빛이 살짝 비친다
    }
  }

  // 벽 16종
  const r = rng(300 + si);
  for (let m = 0; m < 16; m++) {
    const ox = (8 + m) * 16, top = m & 1, bot = m & 2, left = m & 4, right = m & 8;
    fill(ox, 0, 16, 16, p.wall);
    // 돌벽돌: 8px 줄, 줄마다 엇갈린 줄눈 + 위 밝은 선 / 아래 어두운 선
    for (let y = 0; y < 16; y += 8) {
      const off = (y / 8) % 2 ? 4 : 12;
      fill(ox, y, 16, 1, p.wall2);
      fill(ox + off, y, 1, 8, p.wall2);
      fill(ox, y + 1, 16, 1, shade(p.wall, 1.18));
      fill(ox, y + 7, 16, 1, shade(p.wall, .82));
    }
    for (let k = 0; k < 4; k++) fill(ox + Math.floor(r() * 15), Math.floor(r() * 15), 1, 1, r() < .5 ? shade(p.wall, 1.35) : shade(p.wall, .7));
    if (left) { fill(ox, 0, 1, 16, shade(p.wall, .4)); fill(ox + 1, 0, 1, 16, shade(p.wall, 1.25)); }
    if (right) { fill(ox + 15, 0, 1, 16, shade(p.wall, .35)); fill(ox + 14, 0, 1, 16, shade(p.wall, .75)); }
    if (bot) {   // 아래로 갈수록 짙어지는 그림자 + 맺힌 물방울
      [.18, .3, .42, .56, .7].forEach((a, i) => fill(ox, 11 + i, 16, 1, 0x05030a, a));
      fill(ox + 4, 15, 1, 1, shade(moss, .6)); fill(ox + 11, 15, 1, 1, shade(moss, .5));
    }
    if (top) {   // 이끼 낀 윗면: 네온 테두리 1px + 이끼 3px + 아래로 늘어진 이끼
      fill(ox, 0, 16, 1, p.edge);
      fill(ox, 1, 16, 3, moss);
      fill(ox, 1, 16, 1, shade(moss, 1.35));
      for (const [x, h] of [[1, 2], [5, 4], [8, 1], [12, 3], [14, 2]]) fill(ox + x, 4, 1 + (x % 2), h, shade(moss, .75));
      fill(ox + 3, 0, 2, 1, shade(p.edge, 1.6));
    }
    // 트인 모서리는 둥글게 깎는다
    const cut = (x, y) => c.clearRect(ox + x, y, 1, 1);
    if (top && left) { cut(0, 0); cut(1, 0); cut(0, 1); }
    if (top && right) { cut(15, 0); cut(14, 0); cut(15, 1); }
    if (bot && left) { cut(0, 15); cut(1, 15); cut(0, 14); }
    if (bot && right) { cut(15, 15); cut(14, 15); cut(15, 14); }
  }
  t.refresh();
}

// 원경(하늘)/중경 배경. 중경은 지역 배경 종류(data/stages.js 의 bg)마다 따로 만들고, 게임 씬이 지역을 넘을 때 겹쳐 바꾼다
//  bgfar:<지방> · bgmid:<지방>:<종류>  (종류: default · town · road · city · forest · gym + 지역 랜드마크 LANDMARKS)
const BG_W = 704, BG_H = 400;   // 보스전에서 줌아웃한 화면(640x360 + 여유)보다 커야 세로로 반복되지 않는다
const bgF = (ctx, x, y, w, h, col, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = css(col); ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); ctx.globalAlpha = 1; };

// 무한다이노의 검붉은 폭풍우: 위쪽 소용돌이 구름 · 붉은 핵 · 먼 번개 빛 · 먼 산등성이
function stormSky(cf, p, r) {
  const W = BG_W, H = BG_H, F = (...a) => bgF(cf, ...a);
  const g = cf.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120408'); g.addColorStop(.45, '#1e0a12'); g.addColorStop(1, css(p.far));
  cf.fillStyle = g; cf.fillRect(0, 0, W, H);
  const vx = W * .58, vy = 34;
  const core = cf.createRadialGradient(vx, vy, 0, vx, vy, 90); core.addColorStop(0, 'rgba(200,30,60,.55)'); core.addColorStop(1, 'rgba(120,10,40,0)');
  cf.fillStyle = core; cf.fillRect(0, 0, W, 200);
  // 소용돌이: 중심에서 바깥으로 감기는 구름 띠 (픽셀 조각을 나선 위에 찍는다)
  for (let arm = 0; arm < 5; arm++) for (let k = 0; k < 420; k++) {
    const t = k / 420, a = arm * 1.26 + t * 7.5, rad = 10 + t * 260, x = vx + Math.cos(a) * rad * 1.5, y = vy + Math.sin(a) * rad * .45;
    if (y < -6 || y > 190) continue;
    F(x, y, 3 + r() * 6, 2, r() < .5 ? 0x3a0e1c : 0x2a0a20, .5 * (1 - t * .7));
    if (r() < .05) F(x, y, 2, 1, 0xa82a4a, .5 * (1 - t));
  }
  for (let k = 0; k < 4; k++) { const x = r() * W, y = 30 + r() * 80; const gl = cf.createRadialGradient(x, y, 0, x, y, 40); gl.addColorStop(0, 'rgba(255,60,90,.18)'); gl.addColorStop(1, 'rgba(255,60,90,0)'); cf.fillStyle = gl; cf.fillRect(x - 40, y - 40, 80, 80); }
  for (let i = 0; i < 40; i++) F(r() * W, r() * H * .6, 1, 1, 0xd88aa8, .25 + r() * .4);   // 떠도는 독기 입자
  const ridge = shade(p.far, .5);
  for (let x = 0; x < W; x += 2) { const h = 40 + Math.sin(x * .012) * 18 + Math.sin(x * .05) * 6; F(x, H - h, 2, h, ridge); }
}

// 지하 동굴 뒷벽 (이어 붙여도 이음매 없는 128px): 어두운 바위 덩어리 · 갈라진 틈 · 희미한 수정 · 물 자국
function makeCaveBg(scene, si, p) {
  const key = `bgcave:${si}`;
  if (scene.textures.exists(key)) return;
  const S = 128, t = scene.textures.createCanvas(key, S, S), c = t.getContext(), r = rng(700 + si), F = (...a) => bgF(c, ...a);
  // 색은 모두 벽 색을 어둡게 곱해서 (흰색 쪽으로 섞으면 회색 덩어리처럼 떠 보인다)
  const dk = k => shade(p.wall2, k), base = dk(.3);
  F(0, 0, S, S, base);
  for (let k = 0; k < 26; k++) {   // 바위 덩어리 (가장자리를 넘으면 반대편에도 그려 이음매를 없앤다)
    const x = r() * S, y = r() * S, w = 10 + r() * 26, h = 6 + r() * 14, kk = r() < .5 ? .4 : .22;
    for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { F(x + ox, y + oy, w, h, dk(kk)); F(x + ox, y + oy, w, 1, dk(kk + .14)); F(x + ox, y + oy + h - 1, w, 1, dk(kk * .6)); }
  }
  for (let k = 0; k < 8; k++) { let x = r() * S, y = r() * S; for (let s = 0; s < 18; s++) { F(x % S, y % S, 1, 1, dk(.12)); x += r() < .5 ? 1 : -1; y += 1; } }
  for (let k = 0; k < 6; k++) { const x = r() * S; F(x, r() * S, 1, 6 + r() * 10, shade(p.edge, .22), .4); }
  for (let k = 0; k < 9; k++) F(r() * S, r() * S, 1, 1, p.accent, .2 + r() * .25);
  t.refresh();
}

// 실루엣 고목 (TreeArt 를 단색 + 달빛 테두리로) 을 배경 캔버스에 찍는다
function silTree(ctx, seed, x, baseY, scale, col, rim) {
  const t = drawDetailedPixelTree({ seed, silhouette: col, rim, gw: 84, gh: 116, px: 2, vines: 0 });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(t.canvas, Math.round(x - t.baseX * scale), Math.round(baseY - t.H * scale), Math.round(t.W * scale), Math.round(t.H * scale));
}

// 둥근 빛 번짐 (배경 캔버스)
const glowAt = (ctx, x, y, rad, rgba) => { const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, rgba); g.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)')); ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2); };

// ---------------- 지역 랜드마크 중경 (data/stages.js 의 bg) ----------------
//  c: { F(x,y,w,h,색,투명도) · cm(캔버스) · r(시드 난수) · W · H · mc(짙은 실루엣) · ml(옅은 실루엣) · rim · p(팔레트) · smoke · glow(x,y,반지름,rgba) }
const LANDMARKS = {
  // 회색시티 화석 박물관: 무너진 박공의 열주 건물 + 받침대 위 거대한 프테라 화석 골격
  museum({ F, W, H, mc, ml, glow }) {
    const bx = 50, bw = 300, by = H - 150;
    F(bx, by, bw, 150, mc); F(bx - 10, by - 6, bw + 20, 8, ml);
    for (let k = 0; k < 6; k++) { const x = bx + 14 + k * 54; F(x, by + 8, 16, 142, ml); F(x + 3, by + 8, 3, 142, shade(ml, 1.2)); }
    for (let y = 0; y < 56; y += 2) { const w = (bw + 20) * (1 - y / 56); F(bx - 10 + (bw + 20 - w) / 2, by - 8 - y, Math.min(w, (bw + 20) * .62 - (bw + 20 - w) / 2 + 40), 2, ml); }   // 박공 (오른쪽이 무너짐)
    const bone = 0x8a8270, sx = 450, base = H - 40;
    F(sx - 60, base, 300, 12, ml); F(sx - 50, base - 4, 280, 4, shade(ml, 1.2));
    for (let k = 0; k < 24; k++) {   // 등뼈 아치 + 갈비뼈
      const t = k / 23, x = sx + t * 200, y = base - 120 - Math.sin(t * Math.PI) * 50;
      F(x, y, 7, 6, bone, .6);
      if (k > 4 && k < 18) F(x + 2, y + 6, 2, 26 - Math.abs(k - 11) * 2, bone, .45);
    }
    F(sx - 36, base - 134, 36, 18, bone, .6); F(sx - 46, base - 118, 34, 6, bone, .5); F(sx - 24, base - 130, 6, 5, mc);   // 두개골 · 턱
    for (let k = 0; k < 15; k++) { F(sx + 70 - k * 7, base - 172 - k * 7, 5, 4, bone, .5); F(sx + 130 + k * 7, base - 172 - k * 7, 5, 4, bone, .5); }   // 날개뼈
    F(sx + 60, base - 92, 4, 92, bone, .45); F(sx + 140, base - 92, 4, 92, bone, .45);
    glow(sx + 100, base - 120, 120, 'rgba(255,220,160,.06)');
  },
  // 보라타운 포켓몬타워: 위로 좁아지는 7층 탑(보랏빛 창) + 앞쪽 묘비 줄과 촛불
  tower({ F, H, mc, ml, r, glow }) {
    const cx = 360; let y = H;
    for (let f = 0; f < 7; f++) {
      const w = 200 - f * 22, h = 44;
      F(cx - w / 2, y - h, w, h, f % 2 ? mc : shade(mc, 1.12)); F(cx - w / 2 - 6, y - h, w + 12, 4, ml);
      for (let k = 0; k < 3; k++) F(cx - w / 2 + 14 + k * (w - 36) / 2, y - h + 14, 8, 14, 0x8a5aaa, .45);
      y -= h;
    }
    F(cx - 3, y - 40, 6, 40, mc); F(cx - 10, y - 8, 20, 8, mc);
    for (let k = 0; k < 16; k++) {
      const x = 16 + k * 44 + r() * 10, h = 22 + r() * 14;
      if (Math.abs(x - cx) < 116) continue;
      F(x, H - h, 18, h, ml); F(x + 2, H - h - 3, 14, 3, ml); F(x + 8, H - h + 4, 2, 9, mc); F(x + 5, H - h + 7, 8, 2, mc);
      if (r() < .7) { const fx = x + 21, fy = H - 12; F(fx, fy, 3, 8, 0xe8e0d0); F(fx, fy - 4, 3, 4, 0xffb050); glow(fx + 1, fy - 3, 16, 'rgba(255,170,80,.35)'); }
    }
  },
  // 노랑시티 실프주식회사: 네온 격자 창의 사이버 빌딩 + 초록 배양액이 차오른 캡슐 줄 + 배관
  silph({ F, H, mc, ml, r, glow }) {
    const bx = 170, w = 180, top = 40;
    F(bx, top, w, H - top, mc); F(bx - 8, top - 10, w + 16, 12, ml); F(bx + w / 2 - 2, top - 60, 4, 50, ml); F(bx + w / 2 - 2, top - 64, 4, 4, 0xff3a5a);
    for (let y = top + 50; y < H - 20; y += 12) for (let x = bx + 8; x < bx + w - 10; x += 12) if (r() < .5) F(x, y, 8, 6, r() < .5 ? 0x4affd8 : 0xff4a9a, .3 + r() * .3);
    F(bx + 20, top + 20, w - 40, 18, 0x101828); F(bx + 20, top + 20, w - 40, 2, 0x4affd8, .8); F(bx + 20, top + 36, w - 40, 2, 0x4affd8, .5);
    F(430, H - 196, 280, 5, ml);
    for (let k = 0; k < 4; k++) {
      const x = 450 + k * 62, y0 = H - 160;
      F(x + 15, H - 196, 4, 36, ml); F(x, y0 - 10, 34, 10, ml); F(x, H - 16, 34, 16, ml);
      F(x + 2, y0, 30, H - 16 - y0, 0x0a2a24, .9); F(x + 4, y0 + 30, 26, H - 50 - y0, 0x2aff9a, .22);
      F(x + 12, y0 + 52, 10, 46, 0x0a1a14, .85); F(x + 13, y0 + 40, 8, 12, 0x0a1a14, .85);   // 캡슐 속 실루엣
      for (let b = 0; b < 4; b++) F(x + 6 + r() * 20, y0 + 30 + r() * 90, 2, 2, 0xb0ffd8, .7);
      glow(x + 17, y0 + 70, 46, 'rgba(60,255,160,.16)');
    }
  },
  // 블루시티 동굴 · 석영고원: 동굴 천장 아치 + 빛나는 붉은 결정 + 멀리 석영고원 돔
  crystal({ F, W, H, mc, ml, r, glow }) {
    F(380, H - 120, 200, 120, ml);
    for (let k = 0; k <= 40; k++) { const a = Math.PI * k / 40; F(480 + Math.cos(a) * 100 - 3, H - 120 - Math.sin(a) * 60, 6, 6, ml); }
    F(476, H - 196, 8, 20, ml);
    for (let x = 0; x < W; x += 2) { const t = x / W, h = 70 + Math.sin(t * Math.PI * 2) * 34 + r() * 6; F(x, 0, 2, h, mc); }
    for (let k = 0; k < 9; k++) {
      const x = 30 + k * 76 + r() * 20, h = 40 + r() * 90, w = 12 + r() * 12, col = k % 3 ? 0xd04a7a : 0x8a3aff;
      for (let y = 0; y < h; y++) { const t = y / h, ww = t > .8 ? w * (1 - t) / .2 : w; F(x - ww / 2 + y * .15, H - y, ww, 1, col, .55); }
      F(x - 1, H - h * .8, 2, h * .7, 0xffd0e0, .5);
      glow(x, H - h * .5, 40, 'rgba(220,70,140,.16)');
    }
  },
  // 연두마을: 처마가 휘어 올라간 기와지붕 집 + 붉은 도리이 + 석등
  shrine({ F, H, mc, ml }) {
    const house = (x, w, h) => {
      const y = H - h;
      F(x, y, w, h, mc);
      for (let k = 0; k < 14; k++) F(x - 12 + k * 1.2, y - 14 + k, w + 24 - k * 2.4, 1, ml);
      F(x - 18, y - 6, 8, 3, ml); F(x + w + 10, y - 6, 8, 3, ml);   // 휘어 올라간 처마 끝
      F(x + 12, y + 16, 12, 14, 0xffc070, .35); F(x + w - 26, y + 16, 12, 14, 0xffc070, .25);
    };
    house(20, 120, 74); house(500, 140, 84);
    const tx = 270, red = 0x6a1a14;
    F(tx, H - 130, 10, 130, red); F(tx + 110, H - 130, 10, 130, red);
    F(tx - 22, H - 142, 174, 10, red); F(tx - 28, H - 146, 8, 4, red); F(tx + 140, H - 146, 8, 4, red);
    F(tx - 6, H - 112, 142, 7, red); F(tx + 55, H - 140, 10, 28, red);
    for (const x of [200, 420]) { F(x, H - 40, 6, 40, ml); F(x - 6, H - 52, 18, 12, ml); F(x - 2, H - 48, 10, 6, 0xffc070, .65); F(x - 8, H - 56, 22, 4, ml); }
  },
  // 금빛시티 라디오타워: 격자 송신탑(꼭대기 붉은 등) + 고가 선로 위에 멈춰 선 리니어
  radio({ F, W, H, mc, ml, glow }) {
    const cx = 190, top = 40;
    for (let y = top; y < H; y += 2) { const w = 8 + (y - top) * .3; F(cx - w / 2, y, 2, 2, mc); F(cx + w / 2 - 2, y, 2, 2, mc); }
    for (let y = top + 20; y < H - 10; y += 26) { const w = 8 + (y - top) * .3; for (let k = 0; k < w; k += 2) { F(cx - w / 2 + k, y + k * 26 / w, 2, 2, mc); F(cx + w / 2 - k - 2, y + k * 26 / w, 2, 2, mc); } }
    F(cx - 26, top + 90, 52, 6, mc); F(cx - 1, top - 34, 2, 34, mc); F(cx - 2, top - 38, 4, 4, 0xff3a3a); glow(cx, top - 36, 18, 'rgba(255,60,60,.45)');
    const ry = H - 110;
    F(0, ry, W, 8, ml); for (let x = 20; x < W; x += 90) F(x, ry + 8, 10, H - ry - 8, ml);
    F(360, ry - 26, 240, 26, mc);
    for (let k = 0; k < 26; k++) F(600, ry - 26 + k, Math.max(2, 30 - Math.abs(k - 14) * 2), 1, mc);
    for (let x = 372; x < 590; x += 22) F(x, ry - 20, 14, 8, 0x8ab0d8, .22);
    F(360, ry - 8, 270, 2, 0x4a6a9a, .55);
  },
  // 인주시티 불탄탑: 숯이 된 굵은 기둥(제각각 부러짐) · 무너진 대들보 · 단풍나무 · 불티
  burnt({ F, W, H, mc, r }) {
    for (let k = 0; k < 7; k++) {
      const x = 150 + k * 60, h = 120 + r() * 150;
      F(x, H - h, 16, h, mc); for (let j = 0; j < 16; j += 2) F(x + j, H - h - r() * 16, 2, 16, mc);
      F(x + 3, H - h + 10, 2, h - 10, 0x1a1210, .6);
      if (r() < .6) F(x + 4, H - h + 20 + r() * 40, 6, 3, 0xff6a2a, .5);
    }
    for (let k = 0; k < 60; k++) F(160 + k * 6, H - 210 + k * 1.6, 7, 8, mc);
    const maple = (x, y, s) => {
      F(x - 3, y, 6, H - y, mc);
      for (let k = 0; k < 90; k++) { const a = r() * Math.PI * 2, d = r() * 42 * s; F(x + Math.cos(a) * d * 1.3, y + Math.sin(a) * d * .8, 3, 3, [0x8a2a1a, 0xb04a1a, 0x6a1a12, 0xc8702a][Math.floor(r() * 4)], .8); }
    };
    maple(60, H - 150, 1.2); maple(650, H - 170, 1.4);
    for (let k = 0; k < 18; k++) F(r() * W, r() * (H - 40), 2, 2, k % 3 ? 0xb04a1a : 0xff8a3a, .6);
  },
  // 방울탑: 구름바다 위로 솟은 9층 탑(처마 끝 방울) · 꼭대기 제단의 금빛
  belltower({ F, W, H, mc, ml, r, glow }) {
    const cx = 360; let y = H - 40;
    for (let f = 0; f < 9; f++) {
      const w = 170 - f * 15, h = 30;
      F(cx - w / 2 + 10, y - h, w - 20, h, mc);
      F(cx - w / 2 - 12, y - h - 2, w + 24, 5, ml); F(cx - w / 2 - 17, y - h - 6, 6, 4, ml); F(cx + w / 2 + 11, y - h - 6, 6, 4, ml);
      if (f % 2 === 0) { F(cx - w / 2 - 12, y - h + 4, 3, 5, 0xc8a050, .7); F(cx + w / 2 + 9, y - h + 4, 3, 5, 0xc8a050, .7); }
      for (let k = 0; k < 3; k++) F(cx - 20 + k * 16, y - h + 10, 6, 10, 0xffc070, .25);
      y -= h;
    }
    F(cx - 2, y - 46, 4, 46, mc); for (let k = 0; k < 5; k++) F(cx - 6, y - 40 + k * 8, 12, 2, ml);
    glow(cx, y - 50, 60, 'rgba(255,200,90,.35)');
    for (let k = 0; k < 44; k++) { const x = r() * W, cy = H - 34 + r() * 30, w = 40 + r() * 90; F(x, cy, w, 10, 0x5a4a5a, .35); F(x + 6, cy - 5, w - 12, 6, 0x7a6a7a, .3); }
  },
  // 등화도시 해안 절벽: 오른쪽 절벽 위 등대(빛줄기) + 아래 바다 물결
  lighthouse({ F, cm, W, H, mc, ml, r, glow }) {
    for (let x = 360; x < W; x += 2) { const h = 140 + (x - 360) * .25 + Math.sin(x * .05) * 10 + r() * 6; F(x, H - h, 2, h, mc); }
    const lx = 530, ly = H - 184;
    for (let k = 0; k < 100; k++) { const w = 26 - k * .1; F(lx - w / 2, ly - k, w, 1, k % 24 < 12 ? ml : mc); }
    F(lx - 12, ly - 112, 24, 14, mc); F(lx - 8, ly - 110, 16, 8, 0xfff0a0, .85); F(lx - 16, ly - 118, 32, 6, mc);
    cm.fillStyle = 'rgba(255,240,170,.07)'; cm.beginPath(); cm.moveTo(lx, ly - 106); cm.lineTo(0, ly - 200); cm.lineTo(0, ly - 40); cm.closePath(); cm.fill();
    glow(lx, ly - 106, 40, 'rgba(255,240,170,.4)');
    for (let y = H - 44; y < H; y += 6) for (let x = 0; x < 370; x += 12) F(x + (y % 12 ? 6 : 0), y, 8, 2, 0x2a6a6a, .35);
    for (let k = 0; k < 12; k++) F(340 + r() * 30, H - 54 + r() * 24, 4, 2, 0xd8f0f0, .5);
  },
  // 굴뚝산: 분화구가 붉게 빛나는 화산 + 흘러내리는 용암 + 케이블카
  volcano({ F, H, mc, ml, r, smoke, glow }) {
    const cx = 440;
    for (let x = 140; x < 740; x += 2) { const d = Math.abs(x - cx), h = Math.max(0, 260 - d * .9) + 20; F(x, H - h, 2, h, mc); }
    glow(cx, H - 270, 80, 'rgba(255,90,40,.45)'); F(cx - 30, H - 262, 60, 4, 0xff5a1a, .8);
    for (const s of [-1, 1]) { let x = cx + s * 14, y = H - 258; for (let k = 0; k < 60; k++) { x += s * (1 + r()); y += 4; F(x, y, 3, 4, 0xff6a1a, .5); } }
    smoke(cx, H - 270, 24);
    for (let k = 0; k < 190; k++) F(k * 2, H - 260 + k * 2 * (140 / 380), 2, 1, ml);
    F(170, H - 196, 4, 10, ml); F(156, H - 186, 32, 22, mc); F(160, H - 182, 24, 8, 0xffb060, .3);
    F(300, H - 180, 6, 180, ml);
  },
  // 해저동굴 · 루네시티: 물에 잠긴 동굴 아치 + 위에서 비치는 빛줄기 + 물방울 + 멀리 분화구 속 하얀 집들
  seacave({ F, cm, W, H, mc, r }) {
    for (let k = 0; k < 9; k++) { F(290 + k * 30, 120 + (k % 3) * 10, 20, 14, 0xc8d8e0, .3); F(288 + k * 30, 116 + (k % 3) * 10, 24, 4, 0xa0b0c0, .3); }
    for (let k = 0; k < 5; k++) {
      const x = 60 + k * 150 + r() * 40;
      cm.fillStyle = 'rgba(160,230,255,.06)'; cm.beginPath(); cm.moveTo(x, 0); cm.lineTo(x + 30, 0); cm.lineTo(x + 90, H); cm.lineTo(x + 30, H); cm.closePath(); cm.fill();
    }
    for (let k = 0; k < 3; k++) {
      const ax = 60 + k * 240, aw = 200;
      for (let t = 0; t <= 40; t++) { const a = Math.PI * t / 40; F(ax + aw / 2 - Math.cos(a) * aw / 2 - 7, H - Math.sin(a) * 220, 14, 14, mc); }
      F(ax - 7, H - 30, 20, 30, mc); F(ax + aw - 7, H - 30, 20, 30, mc);
    }
    for (let k = 0; k < 40; k++) F(r() * W, r() * H, 2, 2, 0xb0e8ff, .4);
  },
  // 하늘기둥: 부서진 고대 석기둥 줄 · 떠 있는 돌덩이 · 성층권 오로라
  skypillar({ F, W, H, mc, ml, r }) {
    for (let band = 0; band < 3; band++) for (let x = 0; x < W; x += 2) { const y = 30 + band * 26 + Math.sin(x * .02 + band) * 18; F(x, y, 2, 14, [0x4aff9a, 0x6a8aff, 0xc06aff][band], .12); }
    for (let k = 0; k < 6; k++) {
      const x = 30 + k * 120 + r() * 20, h = 120 + r() * 160, w = 30;
      F(x, H - h, w, h, mc); for (let j = 4; j < w; j += 7) F(x + j, H - h, 2, h, shade(mc, 1.25));
      for (let j = 0; j < w; j += 3) F(x + j, H - h - r() * 18, 3, 18, mc);
    }
    for (let k = 0; k < 8; k++) { const x = r() * W, y = 90 + r() * 180, w = 20 + r() * 26; F(x, y, w, 10, ml); F(x + 4, y + 10, w - 8, 4, mc); }
  },
  // 축복시티: 눈 쌓인 박공지붕 집 · 침엽수 · 내리는 눈
  snowcity({ F, W, H, mc, ml, r }) {
    for (let k = 0; k < 5; k++) {
      const x = 20 + k * 150, w = 92, h = 70 + r() * 30, y = H - h;
      F(x, y, w, h, mc);
      for (let j = 0; j < 22; j++) F(x - 6 + j * 2.3, y - 22 + j, w + 12 - j * 4.6, 1, j < 4 ? 0xd8e0f0 : ml, j < 4 ? .6 : 1);
      F(x + 14, y + 20, 12, 14, 0xffc070, .35);
    }
    for (let k = 0; k < 6; k++) {
      const x = 80 + k * 120 + r() * 30;
      for (let y = 0; y < 90; y += 2) { const w = (y / 90) * 40; F(x - w / 2, H - 100 + y, w, 2, mc); if (y % 18 < 3) F(x - w / 2, H - 100 + y, w, 1, 0xd8e0f0, .45); }
      F(x - 3, H - 10, 6, 10, mc);
    }
    for (let k = 0; k < 120; k++) F(r() * W, r() * H, r() < .3 ? 2 : 1, r() < .3 ? 2 : 1, 0xffffff, .3 + r() * .4);
  },
  // 천관산 설산 신전: 눈보라 속 고대 신전 열주 + 뒤의 설산 봉우리
  temple({ F, W, H, mc, ml, r }) {
    for (let x = 0; x < W; x += 2) { const h = 190 + Math.abs(Math.sin(x * .006)) * 110 - Math.abs((x % 240) - 120) * .8; F(x, H - h, 2, h, ml); F(x, H - h, 2, 8, 0xc8d0e0, .4); }
    F(140, H - 30, 420, 30, mc); F(160, H - 40, 380, 10, mc);
    for (let k = 0; k < 6; k++) { const x = 180 + k * 64, broken = k === 4; F(x, H - (broken ? 120 : 200), 22, broken ? 80 : 160, mc); if (!broken) F(x - 4, H - 206, 30, 6, mc); }
    F(150, H - 226, 280, 20, mc);
    for (let k = 0; k < 90; k++) F(r() * W, r() * H, 6, 1, 0xe0e8ff, .22);
  },
  // 신오 챔피언로드: 뒤틀린 하늘의 균열 · 거꾸로 매달린 바위 · 떠 있는 바위섬
  rift({ F, W, H, mc, ml, r, glow }) {
    for (let c = 0; c < 3; c++) {
      let x = 80 + c * 220 + r() * 60, y = 20 + r() * 40;
      for (let s = 0; s < 40; s++) { F(x - 2, y - 2, 6, 6, 0x8a4aff, .18); F(x, y, 2, 2, 0xe0b0ff, .85); x += (r() - .5) * 8; y += 3 + r() * 3; }
      glow(x, y - 60, 60, 'rgba(170,90,255,.12)');
    }
    for (let k = 0; k < 7; k++) {
      const x = r() * W, y = 90 + r() * 200, w = 40 + r() * 60;
      F(x, y, w, 6, ml); for (let j = 0; j < 30; j += 2) F(x + j * .8, y + 6 + j, Math.max(2, w - j * 1.6), 2, mc);
    }
    for (let k = 0; k < 8; k++) { const x = r() * W, w = 20 + r() * 30, h = 30 + r() * 70; for (let j = 0; j < h; j += 2) F(x + j * .3, j, Math.max(2, w - j * .6), 2, mc); }
  },
  // 창기둥: 무너진 돌기둥 원 · 가운데 제단 · 하늘에 세로로 찢어진 시공 균열
  spear({ F, H, mc, ml, r, glow }) {
    glow(360, 140, 150, 'rgba(180,100,255,.18)');
    for (let y = 20; y < 260; y += 3) { const w = 6 + Math.sin(y * .05) * 4 + r() * 4, x = 360 + Math.sin(y * .13) * 10; F(x - w / 2 - 4, y, w + 8, 3, 0x8a4aff, .25); F(x - w / 2, y, w, 3, 0xe0b0ff, .7); F(x - 1, y, 2, 3, 0xffffff, .9); }
    for (let k = 0; k < 8; k++) {
      const x = 30 + k * 92, h = k % 3 === 1 ? 80 + r() * 40 : 180 + r() * 80;
      F(x, H - h, 26, h, mc); F(x + 6, H - h, 2, h, shade(mc, 1.25)); F(x + 16, H - h, 2, h, shade(mc, 1.25));
      for (let j = 0; j < 26; j += 3) F(x + j, H - h - r() * 14, 3, 14, mc);
    }
    F(300, H - 30, 120, 30, ml); F(320, H - 44, 80, 14, ml);
  },
  // 뇌문시티 폐허: 기울고 부서진 대관람차(바큇살·곤돌라) + 네온 현수교
  ferris({ F, H, mc, ml, r }) {
    const cx = 230, cy = H - 175, R = 130;
    for (let k = 0; k < 160; k++) { const a = k / 160 * Math.PI * 2; if (a > 4.5 && a < 5.3) continue; F(cx + Math.cos(a) * R, cy + Math.sin(a) * R * .95, 3, 3, mc); }
    for (let s = 0; s < 12; s++) {
      const a = s / 12 * Math.PI * 2; if (a > 4.4 && a < 5.4) continue;
      for (let d = 0; d < R; d += 4) F(cx + Math.cos(a) * d, cy + Math.sin(a) * d * .95, 2, 2, mc);
      const gx = cx + Math.cos(a) * R, gy = cy + Math.sin(a) * R * .95;
      if (r() < .75) { F(gx - 7, gy + 2, 14, 11, ml); if (r() < .4) F(gx - 4, gy + 4, 8, 4, 0xff4a9a, .5); }
    }
    for (let d = 0; d < 180; d += 3) { F(cx - d * .45, cy + d, 4, 3, mc); F(cx + d * .45, cy + d, 4, 3, mc); }
    F(cx + 90, H - 14, 16, 12, ml);   // 떨어진 곤돌라
    F(470, H - 210, 8, 210, mc); F(660, H - 210, 8, 210, mc);
    for (let x = 470; x < 668; x += 2) { const t = (x - 470) / 198, y = H - 206 + Math.sin(t * Math.PI) * 60; F(x, y, 2, 2, mc); if (x % 12 === 0) F(x, y + 2, 1, H - 122 - y, mc, .5); }
    F(410, H - 122, 310, 6, mc);
    for (let x = 414, k = 0; x < 716; x += 10, k++) F(x, H - 124, 2, 2, [0x4affd8, 0xff4a9a, 0xffd04a][k % 3], .7);
  },
  // 용나선탑: 위로 갈수록 좁아지는 원통 탑 + 몸을 감은 나선 띠 + 부서진 꼭대기 + 안개
  dragonspiral({ F, W, H, mc, ml, r }) {
    const cx = 360, top = 40;
    for (let y = top; y < H; y += 2) { const w = 110 + (y - top) * .25; F(cx - w / 2, y, w, 2, mc); }
    for (let k = 0; k < 500; k++) { const t = k / 500, y = H - t * (H - top), w = 110 + (y - top) * .25, a = t * Math.PI * 9; if (Math.sin(a) > 0) F(cx + Math.cos(a) * w / 2 - 2, y, 5, 4, ml); }
    for (let j = 0; j < 110; j += 3) F(cx - 55 + j, top - r() * 26, 3, 26, mc);
    for (let k = 0; k < 4; k++) F(cx - 6, 120 + k * 60, 12, 16, 0x4a8aff, .22);
    for (let k = 0; k < 30; k++) F(r() * W, H - 64 + r() * 54, 60 + r() * 60, 8, 0x6a6a7a, .12);
  },
  // N의 성 · 심연의 왕좌: 성벽과 첨탑 실루엣을 뚫고 솟은 거대한 붉은 에너지 결정
  core({ F, W, H, mc, r, glow }) {
    F(0, H - 140, W, 140, mc); for (let x = 0; x < W; x += 20) F(x, H - 150, 12, 10, mc);
    for (const x of [60, 320, 580]) { F(x, H - 260, 60, 260, mc); for (let j = 0; j < 40; j++) { const w = j * 1.5; F(x + 30 - w / 2, H - 300 + j, w, 1, mc); } F(x + 26, H - 220, 8, 14, 0xff2a5a, .35); }
    for (let k = 0; k < 6; k++) {
      const x = 40 + k * 120 + r() * 30, h = 120 + r() * 200, w = 24 + r() * 20, lean = (r() - .5) * .4;
      for (let y = 0; y < h; y++) { const t = y / h, ww = t > .82 ? w * (1 - t) / .18 : w; F(x + y * lean - ww / 2, H - y, ww, 1, 0xa0102a, .85); }
      for (let y = 0; y < h * .8; y++) F(x + y * lean - 2, H - y, 2, 1, 0xff8aa8, .5);
      glow(x + h * .6 * lean, H - h * .6, 70, 'rgba(255,40,80,.22)');
    }
  }
};

function makeBgMid(scene, si, kind, p) {
  const key = `bgmid:${si}:${kind}`;
  if (scene.textures.exists(key)) return;
  const W = BG_W, H = BG_H, mid = scene.textures.createCanvas(key, W, H), cm = mid.getContext(), r = rng(300 + si * 41 + kind.length * 7);
  const F = (...a) => bgF(cm, ...a);
  const mc = shade(p.wall2, .5), ml = shade(p.wall2, .72), rim = shade(p.accent, .26);   // 실루엣 테두리는 달빛이 겨우 닿는 정도로
  const smoke = (x, y, n) => { for (let k = 0; k < n; k++) { const s = 6 + k * 1.6; F(x + Math.sin(k * .7) * k * .8 - s / 2, y - k * 7, s, 7, 0x2a2428, .22 - k * .012); } };
  const lamp = (x, fallen) => {
    if (fallen) { for (let k = 0; k < 56; k++) F(x + k, H - 8 - k * .18, 2, 2, mc); F(x + 54, H - 22, 7, 5, mc); return; }
    F(x, H - 64, 2, 64, mc); F(x - 2, H - 66, 6, 2, mc); F(x - 2, H - 72, 6, 6, 0xffc070, .7); F(x - 4, H - 74, 10, 2, mc);
  };
  if (kind === 'town') {
    // 불탄 2층집들(지붕이 뜯겨 나감) · 연기 기둥 · 불씨 · 멀리 오박사 연구소
    const house = (x, w, h) => {
      const y = H - h;
      F(x, y, w, h, mc);
      for (let k = 0; k < 16; k++) { const L = x - 4 + k, R = x + w + 4 - k; for (let xx = L; xx < R; xx += 2) if (!(xx > x + w * .3 && xx < x + w * .62 && k < 12 + Math.sin(xx) * 3)) F(xx, y - 16 + k, 2, 1, ml); }
      for (let fl = 0; fl < 2; fl++) for (let wi = 0; wi < 2; wi++) { const wx = x + 8 + wi * (w - 24), wy = y + 10 + fl * 30; F(wx, wy, 8, 10, r() < .3 ? 0xff7a2a : shade(mc, .55), r() < .3 ? .55 : 1); }
      smoke(x + w * .45, y - 12, 18);
      for (let k = 0; k < 6; k++) F(x + r() * w, y - 10 - r() * 40, 1, 1, 0xff9a4a, .8);
    };
    const lab = (x, w) => { F(x, H - 70, w, 70, mc); F(x - 3, H - 74, w + 6, 4, ml); F(x + w * .2, H - 92, 2, 18, mc); F(x + w * .2 - 6, H - 94, 14, 3, mc); for (let k = 0; k < 4; k++) F(x + 8 + k * (w - 24) / 3, H - 56, 10, 12, shade(mc, .55)); };
    house(10, 58, 64); lamp(100); house(150, 64, 70); lab(250, 120); lamp(392, true); house(430, 56, 60); lamp(520);
    for (let x = 0; x < W; x += 4) F(x, H - 6 - r() * 3, 4, 9, shade(mc, .8));
  } else if (kind === 'road') {
    // 완만한 언덕 · 부서진 이정표 · 쓰러진 가로등 · 키 큰 뒤틀린 풀 · 드문 고목
    for (let x = 0; x < W; x += 2) { const h = 30 + Math.sin(x * .02 + 1) * 14 + Math.sin(x * .07) * 5; F(x, H - h, 2, h, ml); }
    silTree(cm, 3 + si, 120, H - 20, .7, mc, rim); silTree(cm, 9 + si, 470, H - 26, .62, mc, rim);
    const post = x => { F(x, H - 46, 3, 46, mc); for (let k = 0; k < 7; k++) F(x - 10 + k * .4, H - 46 + k, 24, 1, mc); };
    post(60); post(300); lamp(210, true); lamp(380); lamp(540, true);
    for (let x = 0; x < W; x += 3) { const h = 10 + r() * 22; for (let y = 0; y < h; y++) F(x + Math.sin(y * .3 + x) * 1.5, H - y, 1, 1, y > h - 3 ? 0x6a1a2a : mc); }
  } else if (kind === 'city') {
    // 무너진 도시: 층층이 금 간 빌딩 · 꺼져 가는 네온 창 · 가운데 아래 따뜻한 결계의 빛
    const glow = cm.createRadialGradient(W / 2, H, 0, W / 2, H, 220); glow.addColorStop(0, 'rgba(255,150,70,.22)'); glow.addColorStop(1, 'rgba(255,150,70,0)');
    cm.fillStyle = glow; cm.fillRect(0, 0, W, H);
    for (let x = -10; x < W; x += 40 + r() * 30) {
      const w = 30 + r() * 26, h = 90 + r() * 120, y = H - h;
      F(x, y, w, h, r() < .5 ? mc : ml);
      for (let xx = 0; xx < w; xx += 2) F(x + xx, y - r() * 10, 2, 10, r() < .5 ? mc : ml);   // 깨진 꼭대기
      for (let wy = y + 10; wy < H - 10; wy += 14) for (let wx = x + 4; wx < x + w - 6; wx += 9) if (r() < .12) F(wx, wy, 4, 5, [0xff4a8a, 0x4affd8, 0xffc070][Math.floor(r() * 3)], .55);
      if (r() < .4) smoke(x + w / 2, y, 14);
    }
  } else if (kind === 'forest') {
    // 하늘을 가린 거대 고목 실루엣 두 겹 + 어둠 속 붉은 안광
    for (let k = 0; k < 6; k++) silTree(cm, 20 + k * 3 + si, 40 + k * 100 + r() * 30, H + 6, 1.15 + r() * .25, shade(mc, .8), shade(rim, .6));
    for (let k = 0; k < 5; k++) silTree(cm, 50 + k * 5 + si, 90 + k * 120 + r() * 30, H + 10, 1.5 + r() * .3, mc, rim);
    for (let k = 0; k < 9; k++) { const x = r() * W, y = 120 + r() * 160; F(x, y, 2, 1, 0xff1a3a, .9); F(x + 5, y, 2, 1, 0xff1a3a, .9); }
  } else if (kind === 'gym') {
    // 무너진 회색시티 체육관: 갈라진 거대 암석 기둥 · 무너진 아치 · 바위 더미
    const pillar = (x, w, h) => { F(x, H - h, w, h, mc); F(x, H - h, 3, h, ml); for (let k = 0; k < w; k += 2) F(x + k, H - h - r() * 14, 2, 14, mc); for (let y = H - h + 20; y < H; y += 26) F(x, y, w, 2, shade(mc, .7)); };
    pillar(30, 34, 210); pillar(150, 28, 150); pillar(380, 34, 230); pillar(500, 30, 170);
    for (let k = 0; k < 40; k++) { const a = Math.PI * (k / 40); F(270 + Math.cos(a) * 110, H - 160 - Math.sin(a) * 60, 10, 6, ml); }
    for (let x = 0; x < W; x += 14) { const h = 6 + r() * 18; F(x, H - h, 12 + r() * 6, h, mc); }
  } else if (LANDMARKS[kind]) {   // 랜드마크는 하늘빛(지방 강조색)에 물든 안개 낀 실루엣으로 — 어두운 하늘 속에서도 모양이 읽히게
    const hz = (c, t) => { const k = (v, sh) => (v >> sh) & 255, m = sh => Math.round(k(c, sh) + (k(p.accent, sh) - k(c, sh)) * t) << sh; return m(16) | m(8) | m(0); };
    LANDMARKS[kind]({ F, cm, r, W, H, mc: hz(p.wall2, .2), ml: hz(p.wall2, .32), rim, p, smoke, glow: (x, y, rad, rgba) => glowAt(cm, x, y, rad, rgba) });
  }
  mid.refresh();
}

// 먼 산등성이 (원경·중경 아래쪽)
function ridgeLine(ctx, col, W, H, base, amp, f, ph = 0) { for (let x = 0; x < W; x += 2) { const h = base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 4.1 + ph) * amp * .3; bgF(ctx, x, H - h, 2, h, col); } }
// 성도: 재가 흩날리는 호박빛 황혼 · 구름 띠에 가린 큰 달 · 먼 능선
function johtoSky(cf, p, r) {
  const W = BG_W, H = BG_H, F = (...a) => bgF(cf, ...a);
  const g = cf.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120806'); g.addColorStop(.5, '#2a140a'); g.addColorStop(1, css(p.far)); cf.fillStyle = g; cf.fillRect(0, 0, W, H);
  const mx = W * .7, my = 90; glowAt(cf, mx, my, 130, 'rgba(255,170,90,.2)');
  for (let y = -34; y <= 34; y++) { const w = Math.sqrt(34 * 34 - y * y); F(mx - w, my + y, w * 2, 1, 0xe8b070, .5); }
  for (let k = 0; k < 8; k++) F(r() * W - 60, 56 + k * 15 + r() * 10, 140 + r() * 180, 4, 0x1e0c08, .75);
  for (let i = 0; i < 90; i++) F(r() * W, r() * H, 1, 1, r() < .3 ? 0xff8a4a : 0x8a7a6a, .4 + r() * .4);
  ridgeLine(cf, shade(p.far, .55), W, H, 60, 18, .012);
}
// 호연: 폭풍우 몰아치는 청록 하늘 · 비 줄기 · 먼 번개 · 위쪽 희미한 오로라
function hoennSky(cf, p, r) {
  const W = BG_W, H = BG_H, F = (...a) => bgF(cf, ...a);
  const g = cf.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#020a0a'); g.addColorStop(.5, '#0a2420'); g.addColorStop(1, css(p.far)); cf.fillStyle = g; cf.fillRect(0, 0, W, H);
  for (let band = 0; band < 2; band++) for (let x = 0; x < W; x += 2) F(x, 20 + band * 22 + Math.sin(x * .015 + band) * 14, 2, 12, [0x4aff9a, 0x6aa8ff][band], .08);
  for (let k = 0; k < 60; k++) F(r() * W - 40, 60 + r() * 120, 40 + r() * 120, 6, 0x0a1a18, .6);
  for (let b = 0; b < 2; b++) { let x = 120 + b * 380 + r() * 60, y = 60; while (y < 230) { F(x, y, 2, 6, 0xc8f0ff, .35); x += (r() - .5) * 10; y += 6; } glowAt(cf, x, 140, 60, 'rgba(160,230,255,.08)'); }
  for (let i = 0; i < 300; i++) F(r() * W, r() * H, 1, 6, 0x8ad8d8, .16);
  ridgeLine(cf, shade(p.far, .55), W, H, 40, 10, .02);
}
// 신오: 깊은 보랏빛 밤 · 빼곡한 별 · 하늘을 가르는 시공의 금 · 먼 부유 바위 · 눈 덮인 능선
function sinnohSky(cf, p, r) {
  const W = BG_W, H = BG_H, F = (...a) => bgF(cf, ...a);
  const g = cf.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#06040e'); g.addColorStop(.5, '#14102a'); g.addColorStop(1, css(p.far)); cf.fillStyle = g; cf.fillRect(0, 0, W, H);
  for (let i = 0; i < 170; i++) { const big = r() < .12; F(r() * W, r() * H * .75, big ? 2 : 1, big ? 2 : 1, 0xe0e8ff, .3 + r() * .6); }
  for (let c = 0; c < 2; c++) {
    let x = 160 + c * 330, y = 10;
    glowAt(cf, x, 90, 90, 'rgba(170,100,255,.12)');
    for (let s = 0; s < 36; s++) { F(x - 2, y - 1, 5, 4, 0x8a4aff, .2); F(x, y, 2, 3, 0xe0c0ff, .8); x += (r() - .5) * 10; y += 4; }
  }
  for (let k = 0; k < 6; k++) { const x = r() * W, y = 110 + r() * 120, w = 16 + r() * 22; for (let j = 0; j < 12; j++) F(x + j * .7, y + j, Math.max(1, w - j * 1.4), 1, shade(p.far, .6)); }
  ridgeLine(cf, shade(p.far, .6), W, H, 90, 40, .009);
  for (let x = 0; x < W; x += 2) { const h = 90 + Math.sin(x * .009) * 40 + Math.sin(x * .009 * 4.1) * 12; F(x, H - h, 2, 4, 0xc8d0e0, .25); }
}
// 하나 · 심연: 진홍 소용돌이 · 한가운데 무한다이노의 육각 핵 · 붉은 번개
function unovaSky(cf, p, r) {
  const W = BG_W, H = BG_H, F = (...a) => bgF(cf, ...a);
  const g = cf.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0e0206'); g.addColorStop(.5, '#2a0612'); g.addColorStop(1, css(p.far)); cf.fillStyle = g; cf.fillRect(0, 0, W, H);
  const vx = W * .5, vy = 70;
  glowAt(cf, vx, vy, 160, 'rgba(255,30,70,.28)');
  for (let arm = 0; arm < 6; arm++) for (let k = 0; k < 420; k++) {
    const t = k / 420, a = arm * 1.05 + t * 8, rad = 14 + t * 300, x = vx + Math.cos(a) * rad * 1.5, y = vy + Math.sin(a) * rad * .45;
    if (y < -6 || y > 220) continue;
    F(x, y, 3 + r() * 6, 2, r() < .5 ? 0x4a0a1c : 0x3a0614, .55 * (1 - t * .7));
  }
  const hex = k => ({ x: vx + Math.cos(k / 6 * Math.PI * 2) * 30, y: vy + Math.sin(k / 6 * Math.PI * 2) * 30 });
  cf.strokeStyle = 'rgba(255,90,130,.7)'; cf.lineWidth = 2; cf.beginPath(); for (let k = 0; k <= 6; k++) { const q = hex(k); if (k) cf.lineTo(q.x, q.y); else cf.moveTo(q.x, q.y); } cf.stroke();
  F(vx - 6, vy - 6, 12, 12, 0xff3a6a, .8); F(vx - 2, vy - 2, 4, 4, 0xffffff, .9);
  for (let b = 0; b < 3; b++) { let x = 60 + b * 250 + r() * 60, y = 110; while (y < 250) { F(x, y, 2, 5, 0xff4a6a, .3); x += (r() - .5) * 10; y += 5; } }
  ridgeLine(cf, shade(p.far, .5), W, H, 50, 16, .015);
}
const SKIES = [stormSky, johtoSky, hoennSky, sinnohSky, unovaSky];

function makeBackgrounds(scene, si, p) {
  const W = BG_W, H = BG_H;
  const far = scene.textures.createCanvas(`bgfar:${si}`, W, H), cf = far.getContext();
  const mid = scene.textures.createCanvas(`bgmid:${si}:default`, W, H), cm = mid.getContext();
  const r = rng(91 + si * 17);
  (SKIES[si] || stormSky)(cf, p, r);
  for (const kind of new Set(STAGES[si].areas.map(a => a.bg || 'default'))) if (kind !== 'default') makeBgMid(scene, si, kind, p);
  // 기본 중경 (랜드마크가 없는 지역): 두 겹 먼 산등성이
  const midCol = shade(p.wall2, .8);
  ridgeLine(cm, shade(midCol, .8), W, H, 70, 30, .011, si);
  ridgeLine(cm, midCol, W, H, 34, 14, .02, si * 2);
  far.refresh(); mid.refresh();
}
