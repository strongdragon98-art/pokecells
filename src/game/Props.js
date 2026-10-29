// 월드 소품: 월드 생성기(World.props)가 정한 자리에 절차적 도트 그림을 세운다
//  집(지붕·발코니는 Level 의 보이지 않는 통과 발판, 불탄 집·덩굴 감긴 폐허) · 오박사 연구소 폐허 · 포켓몬센터(결계·깜빡이는 네온) · 자판기
//  가로등(1번 도로에선 쓰러짐) · 고밀도 픽셀 고목(덩굴·포자) · 석상 · 울타리 · 이정표 · 뒤틀린 풀 · 체육관 암석 기둥 · 로어 표지판
//  부서지는 나무 상자 · 땅 위 수풀(흔들림)·돌멩이·빛나는 버섯 · 다리 난간 · 마을 반딧불이 · 낮은 안개 · 숲의 붉은 안광 · 잿가루
//  시내의 아머까오 정거장(공중날기 택시)
// 월드가 넓어서, 카메라에서 먼 방의 소품은 그리지 않는다 (cameraFilter 로 메인 카메라에서만 숨김 — visible 과 따로 논다)
// 몸통은 Light2D 조명을 받고(어둠 속에 묻힘), 창문·간판·등불 같은 발광부는 따로 그려 조명과 상관없이 빛난다.
import Phaser from 'phaser';
import { TILE } from '../config.js';
import { css, shade } from '../systems/Textures.js';
import { drawDetailedPixelTree, drawVine } from '../systems/TreeArt.js';
import { Sfx } from '../systems/Audio.js';
import { roomAt } from './World.js';

const ADD = Phaser.BlendModes.ADD;
const WARM = 0xffc070;
const rand = (a, b) => a + Math.random() * (b - a);

// 캔버스 텍스처 하나를 그린다. F(x,y,w,h,색,투명도) 로 픽셀 사각형을 칠한다
function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h)), c = t.getContext();
  const F = (x, y, ww, hh, col, a = 1) => { if (ww <= 0 || hh <= 0) return; c.globalAlpha = a; c.fillStyle = css(col); c.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); c.globalAlpha = 1; };
  draw(F, c);
  t.refresh();
  return key;
}

// ---------------- 그림 ----------------
// 집: 목조 2~3층 + 사다리꼴 지붕(평평한 용마루) + 굴뚝 + 층마다 한쪽 발코니(난간·받침)
//  텍스처 좌표: 벽 왼쪽 48, 바닥 TH. 월드에는 (hx-3)*16, g*16 에 왼쪽 아래 기준으로 놓는다
const houseCache = new Map();   // 텍스처를 다시 쓸 때 창문 불빛 배치도 같이 쓴다
function houseArt(scene, key, o) {
  if (houseCache.has(key) && scene.textures.exists(key)) return houseCache.get(key);
  const res = drawHouse(scene, key, o);
  houseCache.set(key, res);
  return res;
}
function drawHouse(scene, key, o) {
  const { w, floors, side, roof, wall, glass, broken, burnt, ruined } = o;
  const TW = (w + 6) * 16, TH = (3 * floors + 2) * 16 + 16, WX = 48, WR = 48 + w * 16, GY = TH, WT = GY - 3 * floors * 16, RT = WT - 32;
  const wallD = shade(wall, .62), beam = shade(wall, .42), frame = 0x2a1a14, wood = 0x6a4428;
  const winX = []; for (let k = 0, n = Math.max(2, Math.floor(w / 3.4)); k < n; k++) winX.push(WX + 10 + Math.round(k * (w * 16 - 30) / Math.max(1, n - 1)));
  const doorX = side > 0 ? WX + 14 : WR - 28;
  const lit = winX.map(() => Array.from({ length: floors }, () => Math.random() < (burnt ? .12 : .7)));
  // 부서진 지붕 구멍 자리 (불탄 집은 크게, 폐허 마을 집은 작게)
  const holeX = WX + Math.round(w * 16 * (side > 0 ? .22 : .55)), holeW = burnt ? 30 + Math.round(Math.random() * 14) : ruined ? 16 : 0;
  const body = canvasTex(scene, key, TW, TH, (F, c) => {
    // 벽 + 반목조 기둥·층 보
    F(WX, WT, w * 16, GY - WT, wall);
    for (let y = WT; y < GY; y += 4) F(WX, y, w * 16, 1, shade(wall, .92));
    F(WX, WT, 2, GY - WT, beam); F(WR - 2, WT, 2, GY - WT, beam);
    for (let k = 1; k < floors; k++) F(WX, GY - 48 * k - 2, w * 16, 3, beam);
    F(WX, GY - 6, w * 16, 6, shade(wall, .5));                                    // 기단
    if (broken) for (let k = 0; k < 6; k++) F(WX + Math.random() * (w * 16 - 8), WT + Math.random() * (GY - WT - 10), 3 + Math.random() * 6, 1, wallD);   // 금
    // 창문 틀 (유리는 발광 그림이 칠한다)
    winX.forEach((x, i) => { for (let f = 0; f < floors; f++) { const y = GY - 48 * f - 36; F(x - 1, y - 1, 12, 14, frame); F(x, y, 10, 12, lit[i][f] ? 0x1a1420 : 0x14101a); F(x - 2, y + 13, 14, 2, beam); } });
    // 문 + 계단
    F(doorX - 1, GY - 27, 16, 27, frame); F(doorX, GY - 26, 14, 26, wood); F(doorX + 7, GY - 26, 1, 26, shade(wood, .6)); F(doorX + 10, GY - 14, 2, 2, 0xd8b060);
    F(doorX - 3, GY - 3, 20, 3, shade(wall, .45));
    // 지붕: 처마는 벽보다 한 칸씩 넓고 위로 갈수록 좁아진다 + 기와 줄 + 용마루
    for (let y = RT; y < WT; y++) {
      const t = (y - RT) / 32, x0 = Phaser.Math.Linear(WX + 32, WX - 16, t), x1 = Phaser.Math.Linear(WR - 32, WR + 16, t);
      F(x0, y, x1 - x0, 1, (y - RT) % 5 === 0 ? shade(roof, .7) : roof);
      F(x0, y, 1, 1, shade(roof, .5)); F(x1 - 1, y, 1, 1, shade(roof, .5));
    }
    F(WX + 30, RT - 2, w * 16 - 60, 3, shade(roof, 1.35)); F(WX + 30, RT + 1, w * 16 - 60, 1, shade(roof, .6));
    F(WX - 16, WT - 1, w * 16 + 32, 2, shade(roof, .45)); F(WX, WT + 1, w * 16, 3, 0x05030a, .5);   // 처마 그림자
    const cx = WX + Math.round(w * 16 * .7);
    F(cx, RT - 12, 9, 22, shade(wall, .55)); F(cx - 1, RT - 14, 11, 3, shade(wall, .4));
    // 발코니: 나무 바닥판 + 받침대 + 난간
    for (let k = 1; k <= floors; k++) {
      const y = GY - 48 * k, outer = k === floors;
      const a = side > 0 ? WX + (w + (outer ? 1 : -1)) * 16 : WX - 48, b = side > 0 ? WX + (w + 3) * 16 : WX + (outer ? -16 : 16);
      F(a, y, b - a, 4, wood); F(a, y, b - a, 1, shade(wood, 1.5)); F(a, y + 3, b - a, 1, shade(wood, .45));
      const wallSide = side > 0 ? WR : WX, far = side > 0 ? b - 3 : a + 1;
      for (let s = 0; s < 6; s++) F(Phaser.Math.Linear(wallSide, far, s / 6), y + 4 + s, 3, 1, shade(wood, .55));   // 비스듬한 받침
      for (let x = a + 1; x < b; x += 4) F(x, y - 7, 1, 7, shade(wood, .6));
      F(a, y - 8, b - a, 1, shade(wood, 1.2)); F(a, y - 4, b - a, 1, shade(wood, .7));
      if (outer) F(far, y + 4, 2, 10, shade(wood, .5));
    }
    // 그을음: 아래에서 위로 번지는 검댕 + 창 위로 탄 자국
    if (burnt) {
      for (let y = WT; y < GY; y += 2) F(WX, y, w * 16, 2, 0x0a0606, .55 * Math.pow((y - WT) / (GY - WT), .6));
      winX.forEach(x => { for (let f = 0; f < floors; f++) { const y = GY - 48 * f - 37; F(x - 2, y - 8, 14, 8, 0x0a0606, .6); F(x, y - 13, 10, 5, 0x0a0606, .4); } });
    }
    // 무너진 지붕: 들쭉날쭉 구멍 + 드러난 서까래 (구멍 너머로 하늘이 보인다)
    if (holeW) {
      for (let x = 0; x < holeW; x++) {
        const d = Math.round(Math.sin(x * .7) * 3 + Math.random() * 4 + (1 - Math.abs(x / holeW - .5) * 2) * 22);
        c.clearRect(holeX + x, RT - 4, 1, Math.min(32, d) + 4);
      }
      for (let k = 0; k < 3; k++) { const x = holeX + 4 + k * (holeW / 3); for (let s = 0; s < 18; s++) F(x + s * .5, RT + 4 + s, 2, 1, 0x1a100c); }
    }
    // 덩굴: 지붕 처마와 벽을 타고 늘어진다
    if (ruined) for (let k = 0; k < Math.round(w * .9); k++) {
      const x = WX + Math.random() * w * 16, len = 10 + Math.random() * (GY - WT) * .6;
      let xx = x;
      for (let s = 0; s < len; s++) { if (Math.random() < .25) xx += Math.random() < .5 ? -1 : 1; F(xx, WT + s, 1, 1, s % 5 ? 0x1a3a26 : 0x2e6a40); if (s % 6 === 3) F(xx + 1, WT + s, 2, 1, 0x2e6a40); }
    }
  });
  const emis = canvasTex(scene, `${key}:e`, TW, TH, F => {
    winX.forEach((x, i) => {
      for (let f = 0; f < floors; f++) {
        if (!lit[i][f]) continue;
        const y = GY - 48 * f - 36;
        F(x, y, 10, 12, glass, .9); F(x + 1, y + 1, 3, 4, 0xffffff, .45); F(x + 4, y, 1, 12, shade(glass, .55)); F(x, y + 5, 10, 1, shade(glass, .55));
        if (broken && Math.random() < .55) { F(x + 5, y + 1, 5, 3, 0x0a0610); F(x + 6, y + 4, 3, 2, 0x0a0610); F(x + 1, y + 8, 3, 4, 0x0a0610); }
      }
    });
    if (!burnt) F(doorX + 4, GY - 32, 6, 3, glass, .9);   // 문 위 등
    if (burnt) for (let k = 0; k < 9; k++) F(holeX + Math.random() * holeW, RT + 18 + Math.random() * 14, 1, 1, Math.random() < .5 ? 0xff7a2a : 0xffc04a, .9);   // 남은 불씨
  });
  return { body, emis, TW, TH, winX, floors, GY, lit, doorX };
}

// 포켓몬센터: 붉은 지붕 · 하얀 벽 · 붉은 띠 · 유리 자동문 · 큰 창 · 몬스터볼 네온 간판
function centerArt(scene, w) {
  const TW = w * 16 + 32, TH = 8 * 16, WX = 16, WR = 16 + w * 16, GY = TH, WT = GY - 5 * 16, RT = WT - 26, mid = TW / 2;
  const red = 0xd83a3a, white = 0xf0ece4;
  const body = canvasTex(scene, 'prop:center', TW, TH, F => {
    F(WX, WT, w * 16, GY - WT, white);
    for (let y = WT; y < GY; y += 6) F(WX, y, w * 16, 1, shade(white, .93));
    F(WX, GY - 24, w * 16, 6, red); F(WX, GY - 24, w * 16, 1, shade(red, 1.4)); F(WX, GY - 6, w * 16, 6, shade(white, .55));
    F(WX, WT, 3, GY - WT, shade(white, .7)); F(WR - 3, WT, 3, GY - WT, shade(white, .7));
    // 지붕: 둥근 붉은 지붕 + 처마 띠
    for (let y = RT; y < WT; y++) {
      const t = (y - RT) / (WT - RT), inset = Math.round((1 - Math.sqrt(t)) * 22);
      F(WX - 10 + inset, y, w * 16 + 20 - inset * 2, 1, (y - RT) % 6 === 0 ? shade(red, .75) : red);
    }
    F(WX - 12, WT - 2, w * 16 + 24, 4, shade(red, .55)); F(WX - 12, WT - 2, w * 16 + 24, 1, shade(red, 1.4));
    F(WX, WT + 2, w * 16, 3, 0x05030a, .45);
    // 간판 받침 (원판)
    F(mid - 16, RT - 6, 32, 30, shade(white, .8)); F(mid - 14, RT - 4, 28, 26, white);
    // 자동문 틀 + 큰 창 틀
    F(mid - 18, GY - 46, 36, 40, 0x3a3a48); F(mid - 1, GY - 44, 2, 38, 0x3a3a48);
    for (const x of [WX + 12, WR - 12 - 40]) { F(x - 2, WT + 14, 44, 30, 0x3a3a48); F(x + 19, WT + 14, 2, 30, 0x3a3a48); }
    F(mid - 22, GY - 6, 44, 6, shade(white, .4));
  });
  const emis = canvasTex(scene, 'prop:center:e', TW, TH, F => {
    // 유리문 · 창 (따뜻한 실내)
    F(mid - 16, GY - 44, 15, 38, 0x8ad0ff, .85); F(mid + 1, GY - 44, 15, 38, 0x8ad0ff, .85);
    F(mid - 14, GY - 42, 3, 20, 0xffffff, .5); F(mid + 3, GY - 42, 3, 20, 0xffffff, .5);
    for (const x of [WX + 12, WR - 12 - 40]) { F(x, WT + 16, 19, 26, 0xffe0a0, .85); F(x + 21, WT + 16, 19, 26, 0xffe0a0, .85); F(x + 2, WT + 18, 4, 8, 0xffffff, .4); }
    // 몬스터볼 간판
    const by = RT + 9, R = 11;
    for (let y = -R; y <= R; y++) { const hw = Math.round(Math.sqrt(R * R - y * y)); F(mid - hw, by + y, hw * 2, 1, y < 0 ? 0xff4a4a : 0xffffff); }
    F(mid - R, by - 1, R * 2, 3, 0x1a1028); F(mid - 4, by - 4, 8, 8, 0x1a1028); F(mid - 2, by - 2, 4, 4, 0xffffff);
    F(mid - 7, by - 8, 4, 3, 0xffffff, .55);
  });
  return { body, emis, TW, TH, mid, signY: RT + 9, doorY: GY - 26 };
}

// 프렌들리숍 자판기: 파란 몸체 · 하얀 머리띠 · 유리 진열창(상품) · 버튼 · 배출구
function vendingArt(scene) {
  const W = 28, H = 46, blue = 0x2a5ad0;
  const body = canvasTex(scene, 'prop:vending', W, H, F => {
    F(0, 0, W, H, shade(blue, .5)); F(1, 1, W - 2, H - 2, blue); F(1, 1, 2, H - 2, shade(blue, 1.35));
    F(2, 3, W - 4, 7, 0xf0ece4); F(3, 34, 14, 6, 0x101018); F(20, 14, 5, 16, shade(blue, .6));
    F(0, H - 2, W, 2, 0x101018);
  });
  const emis = canvasTex(scene, 'prop:vending:e', W, H, F => {
    F(4, 12, 14, 20, 0xbfe6ff, .9);
    const cols = [0xff6a6a, 0xffd86a, 0x6aff9a, 0x6ac0ff, 0xff9ad8];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) F(5 + k * 4, 14 + r * 6, 3, 4, cols[(r * 3 + k) % cols.length]);
    F(21, 16, 3, 2, 0x6aff6a); F(21, 20, 3, 2, 0xffd84a); F(21, 24, 3, 2, 0xff6a6a);
    F(4, 5, 20, 3, 0x2a5ad0, .9); F(6, 6, 3, 1, 0xffffff); F(11, 6, 3, 1, 0xffffff); F(16, 6, 6, 1, 0xffffff);
  });
  return { body, emis, W, H };
}

// 고풍스러운 가로등 (주철 기둥 · 장식 고리 · 등갓 달린 등불)
function lampArt(scene, warm) {
  const W = 14, H = 82, iron = 0x24222c, key = warm ? 'prop:lamp:w' : 'prop:lamp';
  const body = canvasTex(scene, key, W, H, F => {
    F(3, H - 4, 8, 4, iron); F(4, H - 8, 6, 4, shade(iron, 1.4)); F(6, 14, 2, H - 22, iron); F(6, 14, 1, H - 22, shade(iron, 1.8));
    F(4, 30, 6, 2, iron); F(3, 12, 8, 2, iron); F(2, 2, 10, 2, iron); F(4, 0, 6, 2, iron); F(3, 4, 1, 8, iron); F(10, 4, 1, 8, iron);
    F(8, 18, 3, 1, iron); F(10, 19, 1, 3, iron);
  });
  const emis = canvasTex(scene, `${key}:e`, W, H, F => { F(4, 4, 6, 8, warm ? WARM : 0xd8fff0, .95); F(5, 5, 2, 3, 0xffffff, .7); });
  return { body, emis, W, H };
}

// 거대한 고목 (systems/TreeArt.js 의 고밀도 픽셀 생성기). 스테이지마다 4종, 텍스처·덩굴 자리를 함께 기억한다
const treeCache = new Map();
export function treePalette(si, p) {
  if (si === 0) return {};   // 기본: 심연 암녹 → 청록 → 민트/보라 하이라이트
  const m = p.moss || 0x2a6a4a;
  return { leaf: [shade(m, .16), shade(m, .38), shade(m, .72), shade(m, 1.7)], leafAlt: p.accent, rim: shade(p.accent, .7) };
}
function treeArt(scene, si, v, p) {
  const key = `tree:${si}:${v}`;
  if (treeCache.has(key) && scene.textures.exists(key)) return treeCache.get(key);
  const big = v % 2 === 0;
  const t = drawDetailedPixelTree({ seed: 101 + si * 31 + v * 7, pal: treePalette(si, p), gw: big ? 92 : 78, gh: big ? 124 : 104, trunk: big ? 7.5 : 6, corrupt: v !== 1 });
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, t.canvas);
  if (t.emis) { if (scene.textures.exists(`${key}:e`)) scene.textures.remove(`${key}:e`); scene.textures.addCanvas(`${key}:e`, t.emis); }
  t.vineKeys = t.vines.map((vn, k) => {
    const vk = `${key}:v${k}`;
    if (!scene.textures.exists(vk)) scene.textures.addCanvas(vk, drawVine(vn.len, k + v * 13 + si * 5, si === 0 ? {} : { dark: shade(p.moss, .3), mid: shade(p.moss, .6), light: shade(p.moss, 1.3), bud: p.accent }));
    return vk;
  });
  t.key = key;
  treeCache.set(key, t);
  return t;
}

// 오박사 연구소 폐허: 넓은 2층 콘크리트 건물 · 평지붕 일부 붕괴 · 깨진 큰 창 · 위성 안테나 · 현판
function labArt(scene, w) {
  const W = w * 16, H = 108, GY = H, WT = GY - 80, wall = 0x8a8478, dark = 0x2a2620;
  const body = canvasTex(scene, `prop:lab:${w}`, W, H, (F, c) => {
    F(0, WT, W, GY - WT, wall); for (let y = WT; y < GY; y += 5) F(0, y, W, 1, shade(wall, .9));
    F(0, WT - 4, W, 5, shade(wall, .6)); F(0, WT - 5, W, 1, shade(wall, 1.3));                      // 평지붕 처마
    F(0, GY - 40, W, 3, shade(wall, .55));                                                          // 층 띠
    for (let y = WT; y < GY; y += 2) F(0, y, W, 2, 0x0a0606, .5 * Math.pow((y - WT) / (GY - WT), .7));   // 그을음
    for (let k = 0; k < 4; k++) for (let f = 0; f < 2; f++) { const x = 14 + k * ((W - 40) / 3), y = WT + 10 + f * 40; F(x - 1, y - 1, 22, 22, dark); F(x, y, 20, 20, 0x14121a); F(x + 9, y, 2, 20, dark); F(x, y + 9, 20, 2, dark); }
    F(W / 2 - 12, GY - 30, 24, 30, dark); F(W / 2 - 10, GY - 28, 9, 28, 0x3a2a20); F(W / 2 + 1, GY - 22, 9, 22, 0x3a2a20, .6);   // 부서진 문
    F(W / 2 - 22, GY - 48, 44, 9, shade(wall, .45)); F(W / 2 - 20, GY - 46, 40, 5, 0x5a4a30);       // 현판
    for (let k = 0; k < 6; k++) F(W / 2 - 16 + k * 6, GY - 45, 4, 3, 0x2a2010);
    // 무너진 지붕 귀퉁이 + 기울어진 위성 안테나
    for (let x = 0; x < 40; x++) c.clearRect(W - 40 + x, WT - 6, 1, Math.max(0, Math.round((x / 40) * 22 + Math.sin(x) * 3)));
    for (let s = 0; s < 14; s++) F(22 + s * .6, WT - 6 - s, 2, 1, 0x3a3a42); F(14, WT - 26, 18, 4, 0x5a5a62); F(16, WT - 30, 14, 4, 0x4a4a52);
    for (let k = 0; k < 10; k++) F(Math.random() * W, WT + Math.random() * 70, 2 + Math.random() * 7, 1, shade(wall, .5));   // 금
    for (let k = 0; k < w; k++) { let x = Math.random() * W; for (let s = 0; s < 14 + Math.random() * 40; s++) { if (Math.random() < .25) x += Math.random() < .5 ? -1 : 1; F(x, WT + s, 1, 1, s % 4 ? 0x1a3a26 : 0x2e6a40); } }   // 덩굴
  });
  const emis = canvasTex(scene, `prop:lab:${w}:e`, W, H, F => {
    F(14 + 1 * ((W - 40) / 3) + 2, WT + 52, 6, 8, 0x6affc8, .5);   // 깜빡이는 단말기 불빛 하나
    for (let k = 0; k < 6; k++) F(W - 34 + Math.random() * 28, WT + Math.random() * 10, 1, 1, 0xff7a2a, .8);
  });
  return { body, emis, W, H };
}

// 부서진 로어 표지판 (읽을 수 있다): 기울어진 나무판 + 긁힌 글씨 자국
function loreArt(scene) {
  const wood = 0x6a4a2e;
  return canvasTex(scene, 'prop:lore', 30, 30, F => {
    F(13, 10, 3, 20, shade(wood, .55));
    for (let y = 0; y < 13; y++) F(2 + Math.round(y * .25), 3 + y, 25 - (y > 10 ? 6 : 0), 1, y === 0 ? shade(wood, 1.3) : wood);
    F(20, 12, 7, 4, 0x0a0806);   // 떨어져 나간 귀퉁이
    for (let k = 0; k < 4; k++) F(5 + Math.round(k * .25), 6 + k * 2.4, 13 - k * 2, 1, shade(wood, .4));
    F(4, 13, 3, 3, 0x7a2a3a, .8);   // 검붉은 이끼
  });
}

// 1번 도로 이정표 (부서져 기울어짐)
function signpostArt(scene) {
  const wood = 0x5a3e28;
  return canvasTex(scene, 'prop:signpost', 26, 34, F => {
    for (let y = 8; y < 34; y++) F(11 + Math.round((34 - y) * .12), y, 3, 1, shade(wood, .6));
    for (let y = 0; y < 8; y++) F(3 + y * .5, 6 + y, 18, 1, y ? wood : shade(wood, 1.3));
    F(19, 7, 4, 3, wood); F(21, 9, 3, 2, wood);   // 화살표 끝
    F(6, 9, 9, 1, shade(wood, .4)); F(6, 11, 6, 1, shade(wood, .4));
  });
}

// 지하로 내려가는 철창 표지: 쇠기둥 + 「↓」 이 새겨진 철판
function dropSignArt(scene) {
  const m = 0x5a5a66;
  return canvasTex(scene, 'prop:dropsign', 20, 30, F => {
    F(9, 12, 3, 18, shade(m, .6));
    F(1, 1, 18, 13, shade(m, .45)); F(2, 2, 16, 11, m); F(2, 2, 16, 1, shade(m, 1.5));
    F(9, 4, 2, 6, 0xd8e8ff); F(6, 7, 8, 1, 0xd8e8ff); F(7, 8, 6, 1, 0xd8e8ff); F(8, 9, 4, 1, 0xd8e8ff); F(9, 10, 2, 1, 0xd8e8ff);   // ↓
    F(3, 12, 3, 1, 0x7a2a3a, .8);
  });
}

// 기술머신 제단: 룬이 새겨진 돌 받침 + 둥둥 떠서 도는 TM 디스크
function tmArt(scene) {
  const stone = 0x4a4858;
  const altar = canvasTex(scene, 'prop:tm-altar', 26, 12, F => {
    F(0, 4, 26, 8, shade(stone, .55)); F(1, 5, 24, 6, stone); F(1, 5, 24, 1, shade(stone, 1.6));
    F(4, 0, 18, 5, shade(stone, .6)); F(5, 1, 16, 3, shade(stone, 1.2)); F(5, 1, 16, 1, shade(stone, 1.7));
    for (const x of [4, 9, 16, 21]) F(x, 7, 2, 2, 0x8ad8ff);   // 빛나는 룬
    F(12, 7, 2, 3, 0xbff0ff);
  });
  const disc = canvasTex(scene, 'prop:tm-disc', 15, 15, (F, c) => {
    const ring = (r, col) => { c.fillStyle = css(col); c.beginPath(); c.arc(7.5, 7.5, r, 0, Math.PI * 2); c.fill(); };
    ring(7.5, 0x1a2440); ring(6.5, 0x7ab8ff); ring(5.2, 0xc8e4ff); ring(3, 0x5a8ad8); ring(1.6, 0x1a2440);
    F(3, 3, 3, 1, 0xffffff); F(3, 4, 1, 2, 0xffffff);   // 반사광
    F(9, 10, 3, 1, 0x2a4a90, .8);
  });
  return { altar, disc };
}
// 샛길 갱도 옆 표지: TM 디스크 무늬 + 아래 화살표
function sideSignArt(scene) {
  const m = 0x4a4a66;
  return canvasTex(scene, 'prop:sidesign', 20, 30, F => {
    F(9, 12, 3, 18, shade(m, .6));
    F(1, 1, 18, 13, shade(m, .45)); F(2, 2, 16, 11, m); F(2, 2, 16, 1, shade(m, 1.5));
    F(4, 4, 6, 6, 0x7ab8ff); F(5, 5, 4, 4, 0xc8e4ff); F(6, 6, 2, 2, 0x1a2440);   // 디스크
    F(13, 4, 2, 5, 0xd8e8ff); F(12, 8, 4, 1, 0xd8e8ff); F(13, 9, 2, 1, 0xd8e8ff);   // ↓
  });
}

// 독기에 뒤틀린 키 큰 풀 (끝이 검붉다)
function tallGrassArt(scene, si, p) {
  const moss = p.moss || 0x2e7a52;
  return canvasTex(scene, `prop:tallgrass:${si}`, 30, 26, F => {
    for (let k = 0; k < 14; k++) {
      let x = 2 + k * 2 + Math.random() * 2;
      const h = 12 + Math.random() * 13;
      for (let y = 0; y < h; y++) { x += Math.sin(y * .4 + k) * .3; F(x, 26 - y, 1, 1, y > h - 4 ? 0x8a1a3a : y % 2 ? shade(moss, .7) : moss); }
    }
  });
}

// 무너진 회색시티 체육관의 암석 기둥: 돌 북을 쌓은 기둥 + 깨진 꼭대기 + 밑동 잔해
function pillarArt(scene, h, v) {
  const W = 32, H = h * 16, stone = 0x6a6470;
  return canvasTex(scene, `prop:pillar:${h}:${v}`, W, H + 6, (F, c) => {
    for (let y = 8; y < H; y++) { const seg = Math.floor((H - y) / 22); F(5, y + 6, 22, 1, (H - y) % 22 === 0 ? shade(stone, .5) : seg % 2 ? stone : shade(stone, .92)); F(5, y + 6, 3, 1, shade(stone, 1.3)); F(24, y + 6, 3, 1, shade(stone, .6)); }
    F(2, H + 2, 28, 4, shade(stone, .7)); F(2, H + 2, 28, 1, shade(stone, 1.2));
    for (let x = 0; x < 22; x++) c.clearRect(5 + x, 6, 1, Math.round(4 + Math.sin(x * 1.3 + v) * 4 + Math.random() * 6));   // 깨진 꼭대기
    for (let k = 0; k < 4; k++) { let x = 8 + Math.random() * 16, y = 20 + Math.random() * (H - 30); for (let s = 0; s < 14; s++) { F(x, y + 6, 1, 1, shade(stone, .4)); x += Math.random() < .5 ? -1 : 1; y += 1; } }
    F(0, H + 3, 5, 3, shade(stone, .8)); F(27, H + 1, 5, 5, shade(stone, .75));
  });
}

// 부서진 석상: 돌 받침 위 포켓몬 형상 (한쪽 귀가 부러짐) + 금 + 이끼
function statueArt(scene, p, si) {
  const W = 32, H = 46, stone = 0x6a6a78;
  return canvasTex(scene, `prop:statue:${si}`, W, H, F => {
    F(2, H - 12, 28, 12, shade(stone, .7)); F(2, H - 12, 28, 2, shade(stone, 1.3)); F(4, H - 8, 24, 1, shade(stone, .5));
    F(9, 14, 14, 20, stone); F(9, 14, 2, 20, shade(stone, 1.35)); F(7, 24, 18, 10, stone);
    F(10, 4, 12, 12, stone); F(11, 0, 3, 6, stone);                  // 머리 · 남은 귀
    F(19, 3, 3, 2, shade(stone, .6));                                  // 부러진 귀 자리
    F(24, 22, 6, 3, stone); F(28, 16, 3, 7, stone);                    // 꼬리
    F(13, 8, 2, 2, 0x1a1a22); F(18, 8, 2, 2, 0x1a1a22);
    F(14, 18, 1, 6, shade(stone, .45)); F(15, 23, 3, 1, shade(stone, .45)); F(20, 28, 1, 5, shade(stone, .45));
    F(5, H - 13, 8, 2, p.moss || 0x3a8a5a); F(22, H - 13, 6, 2, p.moss || 0x3a8a5a); F(9, 33, 4, 2, p.moss || 0x3a8a5a);
    F(0, H - 2, 4, 2, stone); F(28, H - 3, 3, 3, shade(stone, .8));   // 떨어진 돌조각
  });
}

function fenceArt(scene, w, metal) {
  const key = `prop:fence:${w}:${metal ? 'm' : 'w'}`, W = w * 16, col = metal ? 0x3a3a46 : 0x6a4a2e;
  return canvasTex(scene, key, W, 16, F => {
    F(0, 6, W, 2, col); F(0, 11, W, 2, col); F(0, 6, W, 1, shade(col, 1.4));
    for (let x = 1; x < W; x += 5) {
      if (!metal && Math.random() < .15) { F(x, 9, 3, 7, shade(col, .8)); continue; }   // 부러진 말뚝
      F(x, 2, 3, 14, col); F(x, 2, 1, 14, shade(col, 1.35)); F(x + 1, metal ? 0 : 1, 1, 2, col);
    }
  });
}

function signArt(scene) {
  const wood = 0x8a5a32;
  return canvasTex(scene, 'prop:sign', 32, 30, F => {
    F(14, 10, 4, 20, shade(wood, .6)); F(2, 2, 28, 14, shade(wood, .5)); F(3, 3, 26, 12, wood); F(3, 3, 26, 1, shade(wood, 1.4));
    F(6, 6, 6, 6, 0xd83a3a); F(6, 9, 6, 3, 0xf0ece4); F(6, 8, 6, 1, 0x1a1028); F(8, 8, 2, 2, 0xf0ece4);
    for (let k = 0; k < 3; k++) F(15, 6 + k * 3, 11 - k * 2, 1, shade(wood, .45));
  });
}

// 아머까오 정거장: 굵은 나무 횃대(가로대에 쇠 발톱 자국) + 남색 깃발에 은빛 날개 문장
function perchArt(scene) {
  const wood = 0x6a4a2e, iron = 0x8a90a8, flag = 0x2a3a6a;
  return canvasTex(scene, 'prop:perch', 30, 46, F => {
    F(5, 8, 4, 38, shade(wood, .55)); F(6, 8, 2, 38, wood);                   // 기둥
    F(0, 14, 30, 4, shade(wood, .5)); F(0, 14, 30, 1, shade(wood, 1.3));      // 가로대
    for (const x of [14, 18, 22]) F(x, 15, 1, 2, shade(iron, .6));           // 발톱 자국
    F(3, 0, 1, 14, shade(iron, .7));                                          // 깃대
    F(4, 1, 13, 9, shade(flag, .6)); F(4, 1, 13, 8, flag); F(4, 1, 13, 1, shade(flag, 1.5));
    F(7, 4, 7, 1, iron); F(8, 3, 2, 1, 0xd8e0f0); F(11, 3, 2, 1, 0xd8e0f0); F(9, 5, 3, 2, iron);   // 날개 문장
    F(3, 44, 9, 2, shade(wood, .4));                                          // 받침
  });
}

function crateArt(scene) {
  const wood = 0x8a5e34;
  return canvasTex(scene, 'prop:crate', 14, 14, F => {
    F(0, 0, 14, 14, shade(wood, .45)); F(1, 1, 12, 12, wood); F(1, 1, 12, 1, shade(wood, 1.4));
    for (let k = 0; k < 10; k++) { F(2 + k, 2 + k, 2, 1, shade(wood, .55)); F(11 - k, 2 + k, 2, 1, shade(wood, .55)); }
    F(1, 6, 12, 1, shade(wood, .7)); F(2, 2, 1, 1, 0xd8b060); F(11, 11, 1, 1, 0xd8b060);
  });
}

// 땅 위 작은 것들: 수풀 3종 · 돌멩이 2종 · 버섯(갓은 발광) · 꽃(마을)
function decorArt(scene, si, p) {
  const moss = p.moss || 0x3a8a5a;
  [[0, 2, 5, 1, 3, 6, 4, 2], [1, 4, 0, 6, 2, 3, 5, 1], [3, 1, 6, 2, 0, 5, 1, 4]].forEach((hs, v) => canvasTex(scene, `dec:grass:${si}:${v}`, 9, 8, F => {
    hs.forEach((h, x) => { F(x, 8 - (h + 2), 1, h + 2, x % 2 ? moss : shade(moss, 1.3)); if (h > 3) F(x, 8 - (h + 2), 1, 1, shade(moss, 1.6)); });
  }));
  canvasTex(scene, 'dec:pebble:0', 5, 3, F => { F(0, 1, 5, 2, 0x5a5866); F(1, 0, 3, 1, 0x7a7888); });
  canvasTex(scene, 'dec:pebble:1', 3, 2, F => { F(0, 0, 3, 2, 0x4a4856); F(0, 0, 1, 1, 0x8a8898); });
  canvasTex(scene, 'dec:mush', 5, 6, F => { F(2, 3, 1, 3, 0xd8d0c0); });
  canvasTex(scene, `dec:mush:${si}:e`, 5, 6, F => { F(0, 1, 5, 2, p.light); F(1, 0, 3, 1, shade(p.light, 1.4)); F(1, 1, 1, 1, 0xffffff); });
  [0xff7a9a, 0xffd86a, 0xffffff, 0x9ad0ff].forEach((col, v) => canvasTex(scene, `dec:flower:${v}`, 3, 6, F => { F(1, 2, 1, 4, moss); F(0, 0, 3, 2, col); F(1, 0, 1, 1, 0xffffff); }));
}

// ---------------- 배치 · 갱신 ----------------
export class Props {
  constructor(scene, level, stage, si) {
    this.s = scene; this.level = level; this.stage = stage; this.si = si;
    this.webgl = scene.renderer.type === Phaser.WEBGL;
    this.objs = []; this.lights = []; this.grass = []; this.mush = []; this.flies = []; this.crates = []; this.interacts = [];
    this.vines = []; this.motes = []; this.flickers = []; this.eyes = []; this.fogs = []; this.pulses = []; this.ash = [];
    decorArt(scene, si, stage.palette);
    this.build();
  }
  areaOf(room) { return room ? this.stage.areas[room.ai] : null; }

  lit(o) { if (this.webgl) o.setPipeline('Light2D'); this.objs.push(o); return o; }
  add(o) { this.objs.push(o); return o; }
  light(x, y, r, col, k) { if (!this.webgl) return null; const l = this.s.lights.addLight(x, y, r, col, k); this.lights.push(l); return l; }
  glow(x, y, sc, col, a, depth) { return this.add(this.s.add.image(x, y, 'glow').setBlendMode(ADD).setTint(col).setScale(sc).setAlpha(a).setDepth(depth)); }

  build() {
    const s = this.s, p = this.stage.palette, metal = this.stage.plat === 'metal';
    for (const pr of this.level.props) {
      const X = pr.x * TILE, Y = pr.g * TILE, room = roomAt(this.level, X + 8, Y - 4), village = room && room.type === 'village', area = this.areaOf(room);
      switch (pr.kind) {
        case 'house': {
          const roofs = village ? [0xa83a32, 0x3a5aa0, 0x3a7a4a, 0xa87a32] : this.stage.roofs;
          const o = { w: pr.w, floors: pr.floors, side: pr.side, roof: roofs[pr.variant % roofs.length], wall: village ? 0xc8bca0 : pr.burnt ? 0x6a5e50 : this.si === 0 ? 0x98907e : shade(p.wall, 1.9), glass: village ? 0xffc870 : p.light, broken: !village, burnt: pr.burnt, ruined: pr.ruined };
          const key = `prop:house:${this.si}:${village ? 'v' : 'c'}:${pr.burnt ? 'b' : ''}${pr.ruined ? 'r' : ''}:${pr.w}:${pr.floors}:${pr.side}:${pr.variant}`;
          const a = houseArt(s, key, o);
          const x = X - 48;
          this.lit(s.add.image(x, Y, a.body).setOrigin(0, 1).setDepth(5));
          this.add(s.add.image(x, Y, a.emis).setOrigin(0, 1).setDepth(5.1));
          a.winX.forEach((wx, i) => { for (let f = 0; f < a.floors; f++) if (a.lit[i][f] && Math.random() < .6) this.glow(x + wx + 5, Y - 48 * f - 30, .45, o.glass, .35, 5.2); });
          break;
        }
        case 'center': {
          const a = centerArt(s, pr.w), x = X - 16;
          this.lit(s.add.image(x, Y, a.body).setOrigin(0, 1).setDepth(5));
          const emis = this.add(s.add.image(x, Y, a.emis).setOrigin(0, 1).setDepth(5.1));
          const sy = Y - a.TH + a.signY;
          const sign = this.glow(x + a.mid, sy, 1.2, 0xff6a6a, .7, 5.2);
          const lightObj = this.light(x + a.mid, sy + 10, 170, 0xffd8c0, 1.6);
          this.light(x + a.mid, Y - 20, 120, 0x8ad0ff, 1.1);
          // 마지막 결계: 센터를 감싸는 주황빛 반구 (천천히 맥동) — 어둠 속에서 여기만 따뜻하다
          const dome = this.glow(x + a.mid, Y - 10, 5.2, 0xff9a3a, .16, 4.5).setScale(5.6, 3.4);
          const domeLine = this.add(this.s.add.graphics().setDepth(4.6).setBlendMode(ADD));
          domeLine.lineStyle(1, 0xffb060, .35); domeLine.beginPath(); domeLine.arc(x + a.mid, Y, 150, Math.PI, 0); domeLine.strokePath();
          domeLine.lineStyle(1, 0xffd8a0, .15); domeLine.beginPath(); domeLine.arc(x + a.mid, Y, 154, Math.PI, 0); domeLine.strokePath();
          this.pulses.push({ o: dome, base: .16, amp: .05, sp: 1.3 }, { o: domeLine, base: .8, amp: .2, sp: .9 });
          // 간판·전등은 간헐적으로 지지직 깜빡인다
          this.flickers.push({ objs: [sign, emis], base: [.75, 1], light: lightObj, lightK: 1.6, t: 0, off: 0 });
          this.interacts.push({ kind: 'center', x: x + a.mid, y: Y, range: 26, used: false, repeat: true, room, prompt: '[F 또는 ↑ : 포켓몬 치료 · 여기서 다시 일어나기]', sign, emis, lightObj, promptY: Y - 58 });
          break;
        }
        case 'vending': {
          const a = vendingArt(s), x = X + 2;
          this.lit(s.add.image(x, Y, a.body).setOrigin(0, 1).setDepth(6));
          const emis = this.add(s.add.image(x, Y, a.emis).setOrigin(0, 1).setDepth(6.1));
          const g = this.glow(x + 11, Y - 22, .6, 0x8ad0ff, .4, 6.2);
          const it = { kind: 'vending', pr, x: x + 14, y: Y, range: 18, used: false, prompt: '[F 또는 ↑ : 프렌들리숍 자판기]', emis, glowObj: g, promptY: Y - 54 };
          this.interacts.push(it);
          if (pr.used) this.markUsed(it);
          break;
        }
        case 'lamp': {
          const warm = pr.warm || village, a = lampArt(s, warm), x = X + 1;
          // 1번 도로의 가로등은 절반쯤 쓰러져 꺼져 있다
          if (area && area.bg === 'road' && Math.random() < .55) {
            this.lit(s.add.image(x + 4, Y + 1, a.body).setOrigin(.5, 1).setRotation(Math.random() < .5 ? 1.42 : -1.42).setDepth(7));
            break;
          }
          this.lit(s.add.image(x, Y, a.body).setOrigin(0, 1).setDepth(7));
          const em = this.add(s.add.image(x, Y, a.emis).setOrigin(0, 1).setDepth(7.1));
          const col = warm ? WARM : p.light;
          const g = this.glow(x + 7, Y - a.H + 8, .9, col, .55, 7.2);
          const l = this.light(x + 7, Y - a.H + 12, warm ? 150 : 120, col, warm ? 1.5 : 1.1);
          if (village) this.flickers.push({ objs: [g, em], base: [.55, 1], light: l, lightK: 1.5, t: 0, off: 0 });
          else this.s.tweens.add({ targets: g, alpha: { from: .4, to: .6 }, duration: 1200 + Math.random() * 800, yoyo: true, repeat: -1 });
          break;
        }
        case 'tree': {
          // 고밀도 픽셀 고목 + 늘어진 덩굴(흔들림) + 균열 맥동 + 떨어지는 포자·피어오르는 반딧불이
          const v = (pr.x * 7 + pr.g) % 4, a = treeArt(s, this.si, v, p), x = X + 24, top = Y + 2 - a.H, left = x - a.baseX;
          this.lit(s.add.image(x, Y + 2, a.key).setOrigin(a.baseX / a.W, 1).setDepth(4));
          if (a.emis) { const e = this.add(s.add.image(x, Y + 2, `${a.key}:e`).setOrigin(a.baseX / a.W, 1).setDepth(4.1)); this.pulses.push({ o: e, base: .5, amp: .3, sp: 1.2 + Math.random() * .8 }); }   // 균열이 숨 쉬듯 은은하게
          a.vines.forEach((vn, k) => { const vi = this.lit(s.add.image(left + vn.x, top + vn.y - 1, a.vineKeys[k]).setOrigin(.5, 0).setDepth(4.2)); vi.ph = Math.random() * 6; this.vines.push(vi); });
          for (let k = 0; k < 4; k++) {
            const cl = a.canopy[Math.floor(Math.random() * a.canopy.length)], spore = k < 2;
            const m = this.add(s.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(spore ? 0xa82a4a : 0xe8f8e0).setScale(spore ? .07 : .09).setDepth(24));
            Object.assign(m, { spore, hx: left + cl.x, hy: top + cl.y, gy: Y, life: Math.random(), sp: .06 + Math.random() * .06, ph: Math.random() * 6 });
            this.motes.push(m);
          }
          break;
        }
        case 'lab': {
          const a = labArt(s, pr.w);
          this.lit(s.add.image(X, Y, a.body).setOrigin(0, 1).setDepth(5));
          const e = this.add(s.add.image(X, Y, a.emis).setOrigin(0, 1).setDepth(5.1));
          this.flickers.push({ objs: [e], base: [1], t: 0, off: 0, rate: 2.5 });
          this.add(s.add.text(X + a.W / 2, Y - a.H - 6, '오박사 연구소', { fontFamily: 'Galmuri9', fontSize: '9px', color: '#8a8478', stroke: '#0a0806', strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(5.2).setAlpha(.7));
          break;
        }
        case 'lore': {
          this.lit(s.add.image(X + 8, Y + 1, loreArt(s)).setOrigin(.5, 1).setDepth(7));
          const mark = this.glow(X + 8, Y - 26, .25, 0xd8c8ff, .4, 7.3);
          this.pulses.push({ o: mark, base: .35, amp: .2, sp: 2 });
          this.interacts.push({ kind: 'lore', x: X + 8, y: Y, range: 16, used: false, repeat: true, text: pr.text, prompt: '[F 또는 ↑ : 읽기]', promptY: Y - 34 });
          break;
        }
        case 'signpost': this.lit(s.add.image(X + 8, Y + 1, signpostArt(s)).setOrigin(.5, 1).setDepth(7).setFlipX(Math.random() < .5)); break;
        case 'tm': {   // 샛길 끝 제단 위에 둥둥 뜬 기술머신 (다가가 F / ↑ → 카드 3장 뒤집기)
          const a = tmArt(s), x = X + 8;
          this.lit(s.add.image(x, Y, a.altar).setOrigin(.5, 1).setDepth(6));
          const beam = this.add(s.add.image(x, Y - 34, 'glow').setBlendMode(ADD).setTint(0x8ad8ff).setScale(.42, 2.4).setAlpha(.3).setDepth(6.1));
          const halo = this.glow(x, Y - 24, 1, 0x9ad8ff, .55, 6.2);
          const disc = this.add(s.add.image(x, Y - 24, a.disc).setDepth(6.4));
          const l = this.light(x, Y - 24, 150, 0x8ac8ff, 1.9);
          s.tweens.add({ targets: [disc, halo], y: '-=5', duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          s.tweens.add({ targets: disc, scaleX: { from: 1, to: .18 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });   // 동전처럼 천천히 돈다
          this.pulses.push({ o: beam, base: .28, amp: .12, sp: 2.2 }, { o: halo, base: .5, amp: .2, sp: 3 });
          const it = { kind: 'tm', pr, x, y: Y, range: 24, used: false, prompt: '[F 또는 ↑ : 기술머신 가동]', promptY: Y - 50, disc, halo, beam, lightObj: l };
          this.interacts.push(it);
          if (pr.used) this.markUsed(it);
          break;
        }
        case 'sidesign': {   // 마을 끝 샛길 갱도 옆 표지
          this.lit(s.add.image(X + 8, Y + 1, sideSignArt(s)).setOrigin(.5, 1).setDepth(7));
          const mark = this.glow(X + 8, Y - 22, .35, 0x9ad8ff, .5, 7.3);
          this.pulses.push({ o: mark, base: .35, amp: .25, sp: 2.5 });
          this.interacts.push({ kind: 'hint', x: X + 64, y: Y, range: 34, used: false, repeat: true, prompt: '↓ + Space : 샛길로 내려가기 (기술머신)', promptY: Y - 30 });
          break;
        }
        case 'dropsign': {
          // 지하로 내려가는 철창 옆 표지: 아래 화살표가 은은하게 깜빡이고, 다가가면 조작 안내
          this.lit(s.add.image(X + 8, Y + 1, dropSignArt(s)).setOrigin(.5, 1).setDepth(7));
          const arrow = this.glow(X - 16, Y - 6, .35, 0x8ad0ff, .5, 7.3);
          this.pulses.push({ o: arrow, base: .35, amp: .25, sp: 3 });
          this.interacts.push({ kind: 'hint', x: X - 16, y: Y, range: 34, used: false, repeat: true, prompt: '↓ + Space : 지하로 내려가기', promptY: Y - 30 });
          break;
        }
        case 'tallgrass': {
          const g = this.lit(s.add.image(X + 16, Y + 2, tallGrassArt(s, this.si, p)).setOrigin(.5, 1).setDepth(13.5).setFlipX(Math.random() < .5));
          g.ph = Math.random() * 6; this.grass.push(g);
          break;
        }
        case 'pillar': this.lit(s.add.image(X + 16, Y + 6, pillarArt(s, pr.h, pr.variant)).setOrigin(.5, 1).setDepth(6)); break;
        case 'statue': this.lit(s.add.image(X + 16, Y, statueArt(s, p, this.si)).setOrigin(.5, 1).setDepth(7)); break;
        case 'fence': this.lit(s.add.image(X, Y + 1, fenceArt(s, pr.w, metal)).setOrigin(0, 1).setDepth(7)); break;
        case 'sign': {   // 시내 입구 표지: 시내 이름
          this.lit(s.add.image(X + 16, Y, signArt(s)).setOrigin(.5, 1).setDepth(7));
          this.add(s.add.text(X + 16, Y - 40, (room && room.city) || (area && area.name) || '최후의 안전지대', { fontFamily: 'Galmuri9', fontSize: '9px', color: '#ffe0a0', stroke: '#1a1008', strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(7.2));
          break;
        }
        case 'corvi': {   // 아머까오 정거장: 횃대 옆에 아머까오가 앉아 쉰다 (다가가 F / ↑ → 들른 시내로 공중날기)
          const x = X + 8;
          this.lit(s.add.image(x, Y + 1, perchArt(s)).setOrigin(.5, 1).setDepth(6.5));
          const meta = s.registry.get('spriteMeta') || {}, cx = X + 52;
          if (meta.corviknight && meta.corviknight.hasSprite && s.anims.exists('corviknight:Idle:left')) {
            const bird = this.lit(s.add.sprite(cx, Y, 'corviknight').setDepth(6.6));
            bird.play('corviknight:Idle:left');
            bird.setOrigin(.5, meta.corviknight.anims.Idle ? meta.corviknight.anims.Idle.oy : .75);
          }
          const halo = this.glow(cx, Y - 20, .9, 0x9ab0ff, .18, 6.4);
          this.pulses.push({ o: halo, base: .16, amp: .08, sp: 1.6 });
          this.light(cx, Y - 24, 110, 0xb0c0ff, 1);
          this.interacts.push({ kind: 'taxi', x: cx - 6, y: Y, range: 30, used: false, repeat: true, prompt: '[F 또는 ↑ : 아머까오 공중날기]', promptY: Y - 60 });
          break;
        }
        case 'crate': {
          const x = X + 8, y = pr.stacked ? (pr.g + 1) * TILE - 14 : Y;
          const img = this.lit(s.add.image(x, y, crateArt(s)).setOrigin(.5, 1).setDepth(15));
          this.crates.push({ img, x, y: y - 7, alive: true });
          break;
        }
      }
    }
    this.buildSurfaceDecor();
    this.buildRails();
    this.buildFireflies();
    this.buildAtmosphere();
    this.groupByRoom();
  }

  // 소품을 들어 있는 방별로 묶는다 (방 밖 = 레일 그래픽 등은 늘 그린다)
  groupByRoom() {
    this.byRoom = new Map(); this.shown = new Set();
    for (const o of this.objs) {
      const r = roomAt(this.level, o.x + 1, o.y - 2);
      if (!r) continue;
      if (!this.byRoom.has(r)) this.byRoom.set(r, []);
      this.byRoom.get(r).push(o);
    }
    for (const r of this.byRoom.keys()) this.shown.add(r);
    this.cullT = 0;
  }
  // 카메라 둘레 한 화면 안에 걸친 방만 메인 카메라에 그린다
  cull(view) {
    const cam = this.s.cameras.main, id = cam.id, pad = 260;
    for (const [r, list] of this.byRoom) {
      const near = r.right > view.x - pad && r.left < view.right + pad && r.bottom > view.y - pad && r.top < view.bottom + pad;
      if (near === this.shown.has(r)) continue;
      if (near) this.shown.add(r); else this.shown.delete(r);
      for (const o of list) o.cameraFilter = near ? (o.cameraFilter & ~id) : (o.cameraFilter | id);
    }
  }

  // 지역 분위기: 낮게 깔린 안개(마을·숲·태초마을) · 숲의 붉은 안광
  buildAtmosphere() {
    const s = this.s;
    for (const room of this.level.rooms) {
      const area = this.areaOf(room), y = room.F * TILE;
      if (room.type === 'pocket' || room.type === 'tm' || room.type === 'treasure') continue;   // 좁은 샛길은 맑게
      if (room.type === 'village' || (area.forest && !room.under)) {
        const tint = room.type === 'village' ? 0xb8a090 : area.forest ? 0x7a98a0 : 0x9a9088;
        for (const [dy, a, sp, sc] of [[-26, .42, 6, 1], [-14, .3, -3.5, 1.4]]) {
          const f = this.add(s.add.tileSprite(room.left, y + dy, room.right - room.left, 34, 'fog').setOrigin(0, .5).setTint(tint).setAlpha(a).setDepth(14.5).setTileScale(sc, 1));
          f.sp = sp; f.tilePositionY = 14; this.fogs.push(f);
        }
      }
      if (area.forest && room.type === 'combat') for (let k = 0; k < 5; k++) {
        const ex = rand(room.left + 60, room.right - 60), ey = rand(room.ty0 + 2, room.F - 4) * TILE, gap = 4 + Math.random() * 3;
        const pair = [-gap / 2, gap / 2].map(dx => this.add(s.add.image(ex + dx, ey, 'glow').setBlendMode(ADD).setTint(0xff1a3a).setScale(.08, .05).setDepth(3.5).setAlpha(0)));
        this.eyes.push({ pair, t: Math.random() * 6, open: false });
      }
    }
  }

  // 위가 트인 벽 타일마다 수풀·돌멩이·버섯 (마을엔 꽃)
  buildSurfaceDecor() {
    const s = this.s, { grid, cols, rows } = this.level, cave = this.si === 1;
    for (let x = 1; x < cols - 1; x++) {
      for (let y = 3; y < rows; y++) {
        if (grid[y][x] !== 'S' || grid[y - 1][x] !== '.') continue;
        const room = roomAt(this.level, x * TILE + 8, y * TILE - 8), village = room && room.type === 'village';
        if (!room) continue;
        const gy = y * TILE + 2;
        if (Math.random() < .5) {
          const g = this.lit(s.add.image(x * TILE + rand(1, 14), gy, `dec:grass:${this.si}:${Math.floor(Math.random() * 3)}`).setOrigin(.5, 1).setDepth(13).setFlipX(Math.random() < .5));
          g.ph = x * .37 + Math.random(); this.grass.push(g);
        }
        if (village && Math.random() < .3) this.lit(s.add.image(x * TILE + rand(2, 13), gy - 1, `dec:flower:${Math.floor(Math.random() * 4)}`).setOrigin(.5, 1).setDepth(13));
        if (Math.random() < .14) this.lit(s.add.image(x * TILE + rand(2, 13), gy - 1, `dec:pebble:${Math.random() < .5 ? 0 : 1}`).setOrigin(.5, 1).setDepth(13));
        if (!village && Math.random() < (cave || room.under ? .1 : .05)) {   // 동굴·지하엔 빛나는 버섯이 더 많다
          const mx = x * TILE + rand(3, 12);
          this.lit(s.add.image(mx, gy - 1, 'dec:mush').setOrigin(.5, 1).setDepth(13));
          this.add(s.add.image(mx, gy - 1, `dec:mush:${this.si}:e`).setOrigin(.5, 1).setDepth(13.1));
          const gl = this.glow(mx, gy - 5, .18, this.stage.palette.light, .5, 13.2); gl.ph = Math.random() * 6; this.mush.push(gl);
        }
      }
    }
  }

  // 보이는 통과 발판(나무다리·철제)에 난간: 양 끝과 2칸마다 기둥, 위·중간 가로대
  buildRails() {
    const g = this.add(this.s.add.graphics().setDepth(11)), { grid, cols, rows } = this.level, metal = this.stage.plat === 'metal';
    const post = metal ? 0x34343c : 0x3a2618, rail = metal ? 0x50505a : 0x5a3a22;
    // 숨은 작은 샛길 안쪽 디딤 발판은 난간 없이 (흙 덮개 위로 난간이 비치지 않게)
    const hid = new Set();
    for (const sd of this.level.sides || []) if (sd.hidden) for (const [cx, cy] of sd.cells) hid.add(cy * cols + cx);
    const isP = (x, y) => grid[y][x] === 'P' && !hid.has(y * cols + x);
    for (let y = 2; y < rows; y++) {
      let x = 0;
      while (x < cols) {
        if (!isP(x, y)) { x++; continue; }
        const a = x; while (x < cols && isP(x, y)) x++;
        if (x - a < 3) continue;
        const L = a * TILE + 1, R = x * TILE - 1, top = y * TILE;
        g.fillStyle(rail, 1); g.fillRect(L, top - 8, R - L, 1); g.fillRect(L, top - 4, R - L, 1);
        g.fillStyle(post, 1);
        for (let px = L; px <= R; px += 32) g.fillRect(Math.min(px, R - 2), top - 9, 2, 9);
        g.fillRect(R - 2, top - 9, 2, 9);
      }
    }
  }

  // 마을: 반딧불이
  buildFireflies() {
    for (const room of this.level.rooms) {
      if (!room.village) continue;
      const [a, b] = room.village.fireflies;
      for (let k = 0; k < 24; k++) {
        const f = this.add(this.s.add.image(rand(a, b) * TILE, rand(room.F - 10, room.F - 1) * TILE, 'glow').setBlendMode(ADD).setTint(0xd8ff8a).setScale(.12).setDepth(24));
        f.home = { x: f.x, y: f.y }; f.ph = Math.random() * 10; f.sp = .4 + Math.random() * .6;
        this.flies.push(f);
      }
    }
  }

  update(time, dt = .016) {
    const t = time / 1000, view = this.s.cameras.main.worldView, L = view.x - 20, R = view.right + 20, U = view.y - 40, D = view.bottom + 40;
    if (this.byRoom && (this.cullT -= dt) <= 0) { this.cullT = .2; this.cull(view); }
    for (const g of this.grass) if (g.x > L && g.x < R && g.y > U && g.y < D) g.rotation = Math.sin(t * 2.2 + g.ph) * .13 + Math.sin(t * 5.3 + g.ph * 2) * .04;
    // 늘어진 덩굴: 위 끝을 축으로 느리게 살랑
    for (const v of this.vines) if (v.x > L - 60 && v.x < R + 60 && v.y > U - 160 && v.y < D) v.rotation = Math.sin(t * 1.1 + v.ph) * .07 + Math.sin(t * 2.7 + v.ph * 1.7) * .025;
    // 포자(검붉게 떨어짐) · 반딧불이(창백하게 피어오름)
    for (const m of this.motes) {
      if (m.hx < L - 120 || m.hx > R + 120 || m.gy < U || m.hy > D + 120) continue;
      m.life += dt * m.sp;
      if (m.life > 1) m.life -= 1;
      const k = m.life, span = m.gy - m.hy;
      m.x = m.hx + Math.sin(t * .8 + m.ph) * 14 + (m.spore ? k * 10 : -k * 6);
      m.y = m.spore ? m.hy + span * k : m.gy - span * k * .9;
      m.setAlpha(Math.sin(k * Math.PI) * (m.spore ? .8 : .55 + Math.sin(t * 6 + m.ph) * .35));
    }
    // 맥동 (나무 균열 · 결계 · 로어 표지)
    for (const p of this.pulses) p.o.setAlpha(Math.max(0, p.base + Math.sin(t * p.sp) * p.amp));
    for (const it of this.interacts) if (it.kind === 'tm' && !it.used && Math.random() < .14) this.s.fx.embers(it.x + (Math.random() - .5) * 18, it.y - 18 - Math.random() * 14, [0x9ad8ff, 0xffffff], 1, { speed: 12 });   // 기술머신 주변 빛 알갱이
    // 지지직 깜빡임: 가끔 잠깐 꺼졌다 켜진다
    for (const f of this.flickers) {
      if (f.off > 0) { f.off -= dt; if (f.off <= 0) f.objs.forEach((o, i) => o.setAlpha(f.base[i])); if (f.light && f.off <= 0) f.light.setIntensity(f.lightK); continue; }
      if (Math.random() < dt * (f.rate ?? 1.2)) {
        f.off = .04 + Math.random() * (Math.random() < .3 ? .35 : .1);
        f.objs.forEach((o, i) => o.setAlpha(f.base[i] * (Math.random() < .5 ? .1 : .35)));
        if (f.light) f.light.setIntensity(f.lightK * .25);
      }
    }
    // 숲의 붉은 안광: 잠깐 떴다가 감는다
    for (const e of this.eyes) {
      e.t -= dt;
      if (e.t <= 0) { e.open = !e.open; e.t = e.open ? 1.2 + Math.random() * 2.5 : 2 + Math.random() * 5; }
      const a = e.open ? Math.min(1, (e.pair[0].alpha || 0) + dt * 3) : Math.max(0, e.pair[0].alpha - dt * 4);
      e.pair.forEach(o => o.setAlpha(a * .95));
    }
    for (const f of this.fogs) f.tilePositionX += dt * f.sp;
    this.updateAsh(dt, view);
    for (const m of this.mush) if (m.x > L && m.x < R && m.y > U && m.y < D) m.setAlpha(.35 + Math.sin(t * 2 + m.ph) * .2);
    for (const f of this.flies) {
      if (f.home.x < L - 60 || f.home.x > R + 60 || f.home.y < U - 40 || f.home.y > D + 40) continue;
      f.x = f.home.x + Math.sin(t * f.sp + f.ph) * 26 + Math.sin(t * 1.7 * f.sp + f.ph * 2) * 8;
      f.y = f.home.y + Math.cos(t * f.sp * .8 + f.ph) * 14;
      f.setAlpha(.45 + Math.sin(t * 3 + f.ph * 3) * .4);
    }
  }

  // 잿빛 태초마을: 화면 안에 잿가루가 천천히 흩날린다 (화면 위에서 떨어져 아래로 사라지면 다시 위로)
  updateAsh(dt, view) {
    const room = roomAt(this.level, view.centerX, view.centerY), on = !!(room && this.areaOf(room).ash);
    if (on && this.ash.length < 46) {
      const f = this.add(this.s.add.rectangle(view.x + Math.random() * view.width, view.y + Math.random() * view.height, 1, 1, Math.random() < .2 ? 0xff8a4a : 0x9a948c).setDepth(25).setAlpha(0));
      f.vx = rand(-6, 10); f.vy = rand(8, 20); f.ph = Math.random() * 6; f.a = Math.random() < .2 ? .9 : .55;
      this.ash.push(f);
    }
    for (const f of this.ash) {
      f.x += (f.vx + Math.sin(this.s.time.now / 700 + f.ph) * 8) * dt; f.y += f.vy * dt;
      if (f.y > view.bottom + 4 || f.x < view.x - 10 || f.x > view.right + 10) { f.x = view.x + Math.random() * view.width; f.y = view.y - 4; }
      f.setAlpha(Phaser.Math.Linear(f.alpha, on ? f.a : 0, Math.min(1, dt * 2)));
    }
  }

  // ---------------- 부서지는 상자 ----------------
  hitRect(rect) {
    let n = 0;
    for (const c of this.crates) {
      if (!c.alive || c.x + 7 < rect.x || c.x - 7 > rect.x + rect.w || c.y + 7 < rect.y || c.y - 7 > rect.y + rect.h) continue;
      this.breakCrate(c); n++;
    }
    return n;
  }
  hitCircle(cx, cy, r) { return this.hitRect({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 }); }

  breakCrate(c) {
    c.alive = false;
    const s = this.s;
    s.fx.burst(c.x, c.y, [0x8a5e34, 0xb88a54, 0x4a2e1a], 14, 130, { up: 110 });
    s.fx.burst(c.x, c.y, [0xd8c8a0], 4, 60, { up: 60, size: 1 });
    Sfx.play('crate');
    s.tweens.add({ targets: c.img, scaleX: 1.3, scaleY: .5, alpha: 0, duration: 120, onComplete: () => c.img.setVisible(false) });
    if (Math.random() < .14) s.spawnPickup('oran', c.x, c.y - 4);
  }

  // ---------------- 상호작용 ----------------
  nearest(x, y) {
    for (const it of this.interacts) if (!it.used && Math.abs(x - it.x) < it.range && Math.abs(y - it.y) < 40) return it;
    return null;
  }

  markUsed(it) {
    if (it.repeat) return;   // 로어 표지판은 몇 번이고 읽는다
    it.used = true;
    if (it.pr) it.pr.used = true;   // 월드 데이터에 남긴다 (다시 와도 쓴 그대로)
    if (it.kind === 'center') {
      this.s.tweens.killTweensOf(it.sign);
      this.s.tweens.add({ targets: it.sign, alpha: .18, duration: 900 });
      it.emis.setAlpha(.6);
      if (it.lightObj) it.lightObj.setIntensity(.8);
    } else if (it.kind === 'tm') {   // 카드를 고르고 나면 디스크가 빛으로 흩어지고 제단이 식는다
      this.pulses = this.pulses.filter(q => q.o !== it.beam && q.o !== it.halo);
      this.s.tweens.killTweensOf([it.disc, it.halo]);
      this.s.tweens.add({ targets: it.disc, alpha: 0, scale: 1.8, duration: 500, onComplete: () => it.disc.setVisible(false) });
      this.s.tweens.add({ targets: [it.halo, it.beam], alpha: .06, duration: 700 });
      if (it.lightObj) it.lightObj.setIntensity(.4);
    } else {
      it.emis.setAlpha(.45); it.glowObj.setAlpha(.12);
    }
  }

  destroy() {
    for (const o of this.objs) o.destroy();   // 상자 그림도 objs 에 들어 있다
    if (this.webgl) for (const l of this.lights) this.s.lights.removeLight(l);
    this.objs = []; this.lights = []; this.grass = []; this.mush = []; this.flies = []; this.crates = []; this.interacts = [];
    this.vines = []; this.motes = []; this.flickers = []; this.eyes = []; this.fogs = []; this.pulses = []; this.ash = [];
    this.byRoom = null;
  }
}
