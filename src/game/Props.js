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
import { roomAt, roomAtCell } from './World.js';
import { makeTrainerArt } from './Trainer.js';
import { windLiftArt } from '../systems/ArenaBackdrop.js';

const ADD = Phaser.BlendModes.ADD;
const WARM = 0xffc070;
// 땅 밀착 (Ground Snap): 땅에 서는 소품은 그림의 맨 아래 불투명 픽셀이 바닥 타일 윗면보다 GROUND_SINK px 아래 (살짝 묻히게)
const GROUND_SINK = 3;
const FOOT = new Map();   // 텍스처 키 → 맨 아래 불투명 줄 { pad: 아래 투명 여백, l, r: 그 줄의 왼쪽 · 오른쪽, w } (텍스처 픽셀 · 키마다 한 번)
const PAD_VY = 760;
// 하늘기둥 정상의 초록 바람 기류(wind)는 더 세다: 위로 가속 2600 · 최고 상승 속도 470 (기류 꼭대기에서 약 7칸 더 솟는다 — 점프 없이 가장 높은 부유석 위로)
const WIND_ACC = 2600, WIND_V = 470;
const WARD_R = 72;   // 기술머신 성역 반경(px) — 캡슐 좌우 4.5칸 안엔 일반 몹이 들어오지 못한다
const FIELD_JUMP = 1.225, LIFT_ACC = 1500, LIFT_V = 300;   // 용나선탑 전자기장: 점프 속도 ×√1.5 (높이 1.5배) · 열기 상승 기류: 위로 가속 · 최고 상승 속도   // 차원 도약 수정이 솟구치는 속도 (최대 약 20칸 — 길 보장 Reach.PAD_TILES 18칸보다 넉넉히)
const rand = (a, b) => a + Math.random() * (b - a);

// 캔버스 텍스처 하나를 그린다. F(x,y,w,h,색,투명도) 로 픽셀 사각형을 칠한다
const lerpTint = (a, b, k) => { const c = (s) => [(a >> s) & 255, (b >> s) & 255]; return [16, 8, 0].reduce((v, s) => { const [x, y] = c(s); return v | (Math.round(x + (y - x) * k) << s); }, 0); };
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

// 포켓샵(프렌들리숍): 본가 특유의 파란 지붕 · 하얀 벽 · 파란 띠 · 유리 자동문 · 상품이 보이는 진열창 · 지붕 위 빛나는 MART 간판
//  발광 그림(emis)에 유리 · 진열 상품 · 간판 글자를 따로 그려 어둠 속에서도 빛난다
const MART_FONT = { M: ['1...1', '11.11', '1.1.1', '1...1', '1...1'], A: ['.111.', '1...1', '11111', '1...1', '1...1'], R: ['1111.', '1...1', '1111.', '1..1.', '1...1'], T: ['11111', '..1..', '..1..', '..1..', '..1..'] };
function martArt(scene, w) {
  const TW = w * 16 + 32, TH = 7 * 16, WX = 16, WR = 16 + w * 16, GY = TH, WT = GY - 4 * 16, RT = WT - 24, mid = TW / 2;
  const blue = 0x2a64d0, white = 0xf0ece4, frame = 0x2a3448;
  const SW = 44, SH = 15, SX = mid - SW / 2, SY = RT - 8;   // 간판
  const body = canvasTex(scene, 'prop:mart:' + w, TW, TH, F => {
    F(WX, WT, w * 16, GY - WT, white);
    for (let y = WT; y < GY; y += 6) F(WX, y, w * 16, 1, shade(white, .93));
    F(WX, GY - 22, w * 16, 5, blue); F(WX, GY - 22, w * 16, 1, shade(blue, 1.5)); F(WX, GY - 6, w * 16, 6, shade(white, .55));
    F(WX, WT, 3, GY - WT, shade(white, .7)); F(WR - 3, WT, 3, GY - WT, shade(white, .7));
    // 지붕: 파란 박공 지붕 (기와 줄) + 처마
    for (let y = RT; y < WT; y++) {
      const t = (y - RT) / (WT - RT), inset = Math.round((1 - t) * 18);
      F(WX - 8 + inset, y, w * 16 + 16 - inset * 2, 1, (y - RT) % 5 === 0 ? shade(blue, .7) : blue);
    }
    F(WX - 10, WT - 2, w * 16 + 20, 4, shade(blue, .5)); F(WX - 10, WT - 2, w * 16 + 20, 1, shade(blue, 1.5));
    F(WX, WT + 2, w * 16, 3, 0x05030a, .45);
    // 간판 판 (테두리) · 자동문 틀 · 진열창 틀
    F(SX - 2, SY - 2, SW + 4, SH + 4, shade(blue, .45)); F(SX, SY, SW, SH, 0x0a1430);
    F(mid - 14, GY - 40, 28, 34, frame); F(mid - 1, GY - 38, 2, 32, frame);
    for (const x of [WX + 8, WR - 8 - 22]) { F(x - 2, WT + 12, 26, 22, frame); F(x - 3, WT + 33, 28, 3, shade(blue, .8)); }
    F(mid - 18, GY - 6, 36, 6, shade(white, .4));
  });
  const emis = canvasTex(scene, 'prop:mart:e:' + w, TW, TH, F => {
    F(mid - 12, GY - 38, 11, 32, 0x8ad0ff, .85); F(mid + 1, GY - 38, 11, 32, 0x8ad0ff, .85);
    F(mid - 10, GY - 36, 2, 16, 0xffffff, .5); F(mid + 3, GY - 36, 2, 16, 0xffffff, .5);
    const goods = [0xff6a6a, 0xffd86a, 0x6aff9a, 0x6ac0ff, 0xff9ad8, 0xffffff];
    for (const x of [WX + 8, WR - 8 - 22]) {   // 진열창: 따뜻한 실내 + 선반 두 줄의 상품
      F(x, WT + 14, 22, 18, 0xfff0c8, .85);
      for (let r = 0; r < 2; r++) { F(x, WT + 22 + r * 8, 22, 1, 0x8a6a4a, .9); for (let k = 0; k < 5; k++) F(x + 1 + k * 4, WT + 17 + r * 8, 3, 4, goods[(r * 5 + k + x) % goods.length]); }
    }
    // MART 간판 글자 (흰 글자 · 하늘빛 테두리)
    const word = 'MART', px = 2, gw = 5 * px + 2, x0 = mid - (word.length * gw - 2) / 2, y0 = SY + 2;
    F(SX, SY, SW, SH, 0x2a6aff, .55);
    [...word].forEach((ch, i) => MART_FONT[ch].forEach((row, ry) => [...row].forEach((on, rx) => { if (on === '1') { F(x0 + i * gw + rx * px - .5, y0 + ry * px - .5, px + 1, px + 1, 0x8ad8ff, .7); F(x0 + i * gw + rx * px, y0 + ry * px, px, px, 0xffffff); } })));
  });
  return { body, emis, TW, TH, mid, signY: SY + SH / 2 };
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
// 침식 깊이 단계별 나무 (Room.depth): 0 = 햇살 받은 푸릇푸릇한 숲(따뜻한 수피 · 연두 잎 · 금빛 림라이트 · 균열 없음)
//  1 = 지역 기본 나무 · 2 = 보스방 앞: 잎이 듬성하게 말라 검붉고 창백해진 고목 + 붉게 빛나는 균열
const LUSH_PAL = { base: 0x4a3424, hi: 0x7a5a3a, shadow: 0x24180f, rim: 0xffe8a8, leaf: [0x183a12, 0x2f6a22, 0x5aa83a, 0xc0f080], leafAlt: 0xfff0a0 };
const WITHER_PAL = { base: 0x2a1818, hi: 0x5a3434, shadow: 0x120808, rim: 0xa04040, leaf: [0x1a0606, 0x3a0c12, 0x6a1c1c, 0xd8b0b0], leafAlt: 0xe8dce4, glow: [0xff2a3a, 0xc81a5a] };
export const depthStage = d => d == null ? 1 : d < .3 ? 0 : d < .66 ? 1 : 2;
function treeArt(scene, si, v, p, stage = 1) {
  const key = `tree:${si}:${v}:${stage}`;
  if (treeCache.has(key) && scene.textures.exists(key)) return treeCache.get(key);
  const big = v % 2 === 0, pal = stage === 0 ? LUSH_PAL : stage === 2 ? Object.assign({}, treePalette(si, p), WITHER_PAL) : treePalette(si, p);
  const t = drawDetailedPixelTree({ seed: 101 + si * 31 + v * 7, pal, gw: big ? 92 : 78, gh: big ? 124 : 104, trunk: big ? 7.5 : 6, corrupt: stage === 0 ? false : stage === 2 ? true : v !== 1, leafMul: stage === 2 ? .38 : 1 });
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

// 오박사 연구소 안 (관동 입구 방의 뒤 벽): 크림색 줄무늬 벽지 · 나무 징두리 · 창문(맑은 하늘 · 붉은 커튼) · 책장 · 연구 장비(초록 화면)
//  · 몬스터볼 셋이 놓인 책상 · 관동 지도 · 화분 · 천장 등. 발광부(화면 · 계기 불빛 · 등 · 창빛)는 따로 그려 늘 밝다
function labRoomArt(scene, w, h) {
  const W = w * 16, H = h * 16, key = `prop:labroom:${w}:${h}`;
  const wall = 0xe6dcc2, wallD = 0xd6caa8, wood = 0x9a7048, woodD = 0x6a4a2e, woodL = 0xc0925e, RAIL = H - 66, FL = H - 8;
  const lerpC = (a, b, k) => { const ch = sh => Math.round(((a >> sh) & 255) + ((((b >> sh) & 255) - ((a >> sh) & 255)) * k)); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
  const X = { win: [24, Math.round(W * .47), W - 120], shelf: [128, Math.round(W * .62)], machine: 214, poster: Math.round(W * .36), desk: Math.round(W * .47) + 2, pc: Math.round(W * .74), plant: W - 30 };
  const body = canvasTex(scene, key, W, H, F => {
    F(0, 0, W, H, wall);
    for (let x = 0; x < W; x += 24) F(x, 9, 2, RAIL - 9, wallD);
    F(0, 0, W, 7, woodD); F(0, 7, W, 2, wood); F(0, 9, W, 1, shade(wall, .85));
    F(0, RAIL, W, H - RAIL, wood); F(0, RAIL - 2, W, 4, woodD); F(0, RAIL - 3, W, 1, woodL);
    for (let x = 6; x < W - 44; x += 50) { F(x, RAIL + 8, 42, FL - RAIL - 14, shade(wood, 1.08)); F(x, RAIL + 8, 42, 1, woodD); F(x, RAIL + 8, 1, FL - RAIL - 14, woodD); F(x + 41, RAIL + 8, 1, FL - RAIL - 14, woodL); }
    F(0, FL, W, 8, 0x4a3424); F(0, FL, W, 1, 0x6a4a30);
    // 창문 (맑은 하늘 · 구름 · 붉은 커튼)
    for (const x of X.win) {
      F(x - 3, 19, 82, 64, woodD);
      for (let y = 0; y < 56; y++) F(x + 2, 23 + y, 72, 1, lerpC(0x7ab8e8, 0xd8f0ff, y / 56));
      F(x + 10, 34, 18, 4, 0xffffff, .85); F(x + 14, 31, 10, 3, 0xffffff, .85); F(x + 44, 46, 22, 4, 0xffffff, .7); F(x + 48, 43, 12, 3, 0xffffff, .7);
      F(x + 2, 66, 72, 13, 0x6aa86a); F(x + 2, 63, 30, 4, 0x5a985a); F(x + 40, 62, 34, 5, 0x5a985a);   // 먼 언덕
      F(x + 37, 23, 2, 56, woodD); F(x + 2, 50, 72, 2, woodD);
      F(x - 6, 83, 88, 4, woodL); F(x - 6, 87, 88, 1, woodD);
      for (const cx of [x - 9, x + 75]) { F(cx, 16, 10, 70, 0xa8343a); F(cx + 3, 16, 2, 70, 0x7a2028); F(cx + 7, 16, 1, 70, 0xc84a4a); }
      F(x - 10, 14, 96, 3, woodD);
    }
    // 책장
    for (const x of X.shelf) {
      const y0 = FL - 120;
      F(x, y0, 66, 120, woodD); F(x + 4, y0 + 4, 58, 112, 0x3a2618); F(x, y0, 66, 2, woodL);
      for (let k = 0; k < 4; k++) {
        const sy = y0 + 6 + k * 28;
        F(x + 4, sy + 23, 58, 3, wood);
        let bx = x + 6;
        while (bx < x + 58) {
          const bw = 3 + Math.floor(Math.random() * 3), bh = 14 + Math.floor(Math.random() * 7), col = [0xa83a3a, 0x3a5aa8, 0x3a8a4a, 0xd8a03a, 0x6a3a8a, 0xe8e0c8, 0x2a6a7a][Math.floor(Math.random() * 7)];
          if (bx + bw > x + 60) break;
          F(bx, sy + 23 - bh, bw, bh, col); F(bx, sy + 23 - bh, 1, bh, shade(col, 1.25)); F(bx, sy + 20 - Math.floor(bh / 2), bw, 1, shade(col, .7));
          bx += bw + (Math.random() < .12 ? 3 : 0);
        }
      }
    }
    // 연구 장비 (큰 분석기)
    { const x = X.machine, y0 = FL - 100;
      F(x, y0, 112, 100, 0x5a6a78); F(x + 2, y0 + 2, 108, 96, 0x7a8a98); F(x, y0, 112, 2, 0xa8b8c4);
      F(x + 8, y0 + 10, 44, 32, 0x14181c); F(x + 60, y0 + 10, 44, 32, 0x14181c);
      F(x + 8, y0 + 52, 96, 18, 0x5a6a78); for (let k = 0; k < 8; k++) F(x + 12 + k * 12, y0 + 56, 8, 10, k % 3 ? 0x3a4450 : 0x2a323a);
      for (let k = 0; k < 6; k++) F(x + 10 + k * 16, y0 + 78, 10, 4, 0x4a5662);
      F(x - 6, y0 + 20, 6, 80, 0x3a3a44); F(x - 10, y0 + 60, 6, 40, 0x2a2a32);   // 굵은 전선
      F(x + 112, y0 + 30, 3, 70, 0x2a2a32); }
    // 관동 지도 액자
    { const x = X.poster, y = 26;
      F(x - 3, y - 3, 76, 52, woodD); F(x, y, 70, 46, 0x5a9ad8);
      F(x + 6, y + 6, 26, 16, 0x6ab86a); F(x + 30, y + 10, 30, 24, 0x7ac87a); F(x + 12, y + 24, 22, 14, 0x6ab86a); F(x + 40, y + 30, 18, 10, 0x5aa85a);
      F(x + 16, y + 14, 30, 1, 0xd8c890); F(x + 45, y + 14, 1, 18, 0xd8c890); F(x + 20, y + 30, 26, 1, 0xd8c890);
      for (const [px, py] of [[16, 14], [45, 14], [45, 31], [20, 30]]) F(x + px - 1, y + py - 1, 3, 3, 0xe84a4a); }
    // 몬스터볼 책상
    { const x = X.desk, top = FL - 34;
      F(x, top, 86, 6, woodL); F(x, top + 6, 86, 3, woodD); F(x + 4, top + 9, 6, 34 - 9, woodD); F(x + 76, top + 9, 6, 34 - 9, woodD); F(x + 28, top + 9, 30, 12, wood); F(x + 40, top + 14, 6, 2, woodL);
      for (let i = 0; i < 3; i++) {
        const bx = x + 16 + i * 22, by = top - 9;
        F(bx + 1, by, 7, 1, 0x1a1418); F(bx, by + 1, 9, 7, 0x1a1418); F(bx + 1, by + 8, 7, 1, 0x1a1418);
        F(bx + 1, by + 1, 7, 3, 0xe03a3a); F(bx + 2, by + 1, 2, 1, 0xff8a8a); F(bx + 1, by + 5, 7, 3, 0xf4f0ea); F(bx + 1, by + 4, 7, 1, 0x1a1418); F(bx + 3, by + 3, 3, 3, 0x1a1418); F(bx + 4, by + 4, 1, 1, 0xffffff);
      } }
    // 컴퓨터 책상 (PC)
    { const x = X.pc, top = FL - 30;
      F(x, top, 70, 5, woodL); F(x + 4, top + 5, 5, 25, woodD); F(x + 61, top + 5, 5, 25, woodD);
      F(x + 14, top - 30, 40, 28, 0xd8d4c8); F(x + 17, top - 27, 34, 20, 0x10181c); F(x + 30, top - 2, 8, 2, 0xb8b4a8); F(x + 10, top - 4, 48, 3, 0xc8c4b8); }
    // 화분
    { const x = X.plant;
      F(x, FL - 18, 18, 18, 0xb86a3a); F(x - 1, FL - 20, 20, 3, 0xd07a44); F(x + 2, FL - 14, 14, 1, 0x8a4a2a);
      for (const [dx, dy, ww, hh] of [[2, -36, 6, 18], [9, -44, 5, 26], [12, -32, 7, 14], [-2, -28, 6, 10], [6, -50, 4, 12]]) { F(x + dx, FL + dy, ww, hh, 0x3a8a4a); F(x + dx, FL + dy, 1, hh, 0x5aa86a); } }
    // 천장 등 (갓 · 줄)
    for (const lx of [W * .2, W * .5, W * .8]) { F(lx - 1, 9, 2, 14, 0x3a3030); F(lx - 9, 23, 18, 5, 0x4a5a4a); F(lx - 11, 27, 22, 2, 0x3a4a3a); }
  });
  const emis = canvasTex(scene, key + ':e', W, H, F => {
    for (const x of X.win) F(x + 2, 23, 72, 56, 0xffffff, .1);
    const x = X.machine, y0 = FL - 100;
    for (const sx of [x + 8, x + 60]) { F(sx, y0 + 10, 44, 32, 0x1a4a3a, .8); for (let k = 0; k < 44; k++) F(sx + k, y0 + 26 + Math.round(Math.sin(k * .5 + sx) * 6 * Math.sin(k * .13)), 1, 2, 0x6affb8); F(sx + 2, y0 + 12, 12, 2, 0x6affb8, .7); }
    for (let k = 0; k < 6; k++) F(x + 12 + k * 16, y0 + 79, 4, 2, [0xff4a4a, 0xffd04a, 0x4aff8a][k % 3]);
    const pc = X.pc, top = FL - 30;
    F(pc + 17, top - 27, 34, 20, 0x2a5a8a, .9); for (let k = 0; k < 5; k++) F(pc + 20, top - 24 + k * 3, 10 + (k * 7) % 18, 1, 0xa8e0ff);
    for (const lx of [W * .2, W * .5, W * .8]) { F(lx - 8, 28, 16, 2, 0xfff4d0); }
  });
  return { body, emis, W, H, lamps: [W * .2, W * .5, W * .8] };
}

// 여닫이 문 (오박사 연구소 안 · 마을의 연구소 건물): 문짝 + 문틀 안쪽(열리면 보이는 빛 — 안에선 바깥 햇살 · 밖에선 연구소 불빛)
//  문짝은 왼쪽 경첩을 축으로 좁아지며 열린다 (Props.openDoor). 큰 문(연구소 안)은 위에 유리창 · 아래에 판넬, 작은 문(집)은 가운데 줄
function doorArt(scene, w, h, wood) {
  return canvasTex(scene, `prop:doorpanel:${w}:${h}:${wood}`, w, h, F => {
    F(0, 0, w, h, shade(wood, .55)); F(1, 1, w - 2, h - 2, wood); F(1, 1, 1, h - 2, shade(wood, 1.3));
    if (h >= 36) {
      const gh = Math.round(h * .26);
      F(4, 4, w - 8, gh, shade(wood, .45)); F(5, 5, w - 10, gh - 2, 0xbfe0f0); F(5, 5, 3, gh - 2, 0xffffff, .5); F(w / 2 - .5, 5, 1, gh - 2, shade(wood, .45));   // 유리창
      const py = gh + 9, ph = h - py - 5;
      F(4, py, w - 8, ph, shade(wood, .7)); F(5, py + 1, w - 10, ph - 2, shade(wood, 1.12)); F(5, py + 1, w - 10, 1, shade(wood, 1.4));   // 판넬
    } else F(Math.floor(w / 2), 1, 1, h - 2, shade(wood, .6));
    F(w - 5, Math.round(h * .52), 2, 2, 0xd8b060); F(w - 5, Math.round(h * .52), 1, 1, 0xfff0a0);   // 손잡이
  });
}
function doorGapArt(scene, w, h, day) {
  const mix = (a, b, k) => { const ch = sh => Math.round(((a >> sh) & 255) + ((((b >> sh) & 255) - ((a >> sh) & 255)) * k)); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
  return canvasTex(scene, `prop:doorgap:${day ? 'day' : 'warm'}:${w}:${h}`, w, h, F => {
    const sky = Math.round(h * .62);
    for (let y = 0; y < h; y++) F(0, y, w, 1, day ? (y < sky ? mix(0x8ac8f0, 0xe8f6ff, y / sky) : 0x7ac070) : mix(0xfff2d0, 0xd88a40, y / h));   // 안: 파란 하늘 · 풀밭 / 밖: 따뜻한 실내 불빛
    F(0, 0, 2, h, 0x05030a, .35);
  });
}
// 연구소 안 문틀 (뒤 벽에 붙은 굵은 나무틀 · 위에 작은 채광창)
function labDoorFrameArt(scene, w, h) {
  return canvasTex(scene, `prop:labdoorframe:${w}:${h}`, w + 8, h + 12, F => {
    const dark = 0x4a3020, mid = 0x7a5232, hi = 0xa87a4a;
    F(0, 8, w + 8, h + 4, dark); F(1, 9, w + 6, h + 2, mid); F(1, 9, w + 6, 1, hi);
    F(4, 12, w, h, 0x1a120c);
    F(2, 0, w + 4, 8, dark); F(3, 1, w + 2, 6, 0xd8f0ff); F(3, 1, w + 2, 2, 0xffffff, .5); for (let x = 3; x < w + 5; x += 6) F(x, 1, 1, 6, dark);   // 채광창
  });
}
// 문 앞 발판 매트
function matArt(scene) { return canvasTex(scene, 'prop:doormat', 30, 3, F => { F(0, 0, 30, 3, 0x7a3a2a); F(1, 0, 28, 1, 0xa85a3a); for (let x = 3; x < 28; x += 4) F(x, 1, 2, 1, 0xd8a050); }); }

// 침식 균열 (바닥 윗면에 덮는 빛나는 금)
function veinArt(scene) {
  return canvasTex(scene, 'fx:vein', 16, 6, F => {
    F(0, 0, 4, 1, 0xffffff, .9); F(3, 1, 3, 1, 0xffffff, .9); F(6, 1, 1, 2, 0xffffff, .8); F(6, 2, 4, 1, 0xffffff, .9); F(9, 1, 3, 1, 0xffffff, .7); F(12, 0, 4, 1, 0xffffff, .8);
    F(5, 3, 1, 2, 0xffffff, .5); F(10, 3, 1, 1, 0xffffff, .4);
  });
}

// 연구소 마룻바닥 한 칸 (바닥 타일 위에 덮는다)
function labFloorArt(scene) {
  return canvasTex(scene, 'prop:labfloor', 16, 16, F => {
    F(0, 0, 16, 16, 0x7a5232); F(0, 0, 16, 2, 0xc8986a); F(0, 2, 16, 1, 0x9a6a40);
    F(0, 3, 16, 5, 0x9a6a42); F(0, 8, 16, 1, 0x5a3a22); F(0, 9, 16, 5, 0x8a5c38); F(0, 14, 16, 2, 0x4a3020);
    F(5, 3, 1, 5, 0x6a4428); F(12, 9, 1, 5, 0x5a3a22); F(9, 4, 2, 1, 0xb08050, .6);
  });
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

// 간이 포켓몬 회복기 (Field Recovery Terminal): 실프주식회사 휴대용 필드 캡슐 — 금속 받침 · 초록 유리 돔(회복 십자) · 청록 화면 · S 로고
function terminalArt(scene) {
  const steel = 0x3e4a5a, teal = 0x4affd8, green = 0x7dff9a;
  return canvasTex(scene, 'prop:terminal', 30, 40, (F, c) => {
    F(2, 32, 26, 8, shade(steel, .5)); F(3, 33, 24, 6, steel); F(3, 33, 24, 1, shade(steel, 1.7)); F(3, 37, 24, 1, 0xd8a63a, .8);   // 받침
    F(6, 14, 18, 19, shade(steel, .55)); F(7, 15, 16, 17, steel); F(7, 15, 1, 17, shade(steel, 1.6));                             // 몸통
    F(9, 18, 12, 7, 0x0a1a1c); F(10, 19, 10, 5, 0x0e3a36); F(10, 19, 10, 1, teal, .9);                                            // 화면
    F(11, 21, 2, 1, teal); F(14, 21, 4, 1, teal, .7); F(11, 23, 6, 1, teal, .5);                                                  // 화면 글자
    F(12, 27, 6, 4, 0x1a2230); F(13, 28, 1, 2, 0xff5a5a); F(15, 28, 1, 2, teal); F(17, 28, 0, 0, 0);                             // 버튼
    const gr = c.createRadialGradient(15, 9, 1, 15, 9, 10); gr.addColorStop(0, 'rgba(200,255,220,.95)'); gr.addColorStop(1, 'rgba(60,200,140,.55)');
    c.fillStyle = gr; c.beginPath(); c.arc(15, 12, 9, Math.PI, 0); c.lineTo(24, 14); c.lineTo(6, 14); c.closePath(); c.fill();          // 유리 돔
    F(13, 5, 4, 8, 0xffffff); F(11, 7, 8, 4, 0xffffff); F(14, 6, 2, 6, green); F(12, 8, 6, 2, green);                              // 회복 십자
    F(8, 6, 2, 1, 0xffffff, .7); F(7, 7, 1, 3, 0xffffff, .5);                                                                       // 돔 반사광
    F(5, 13, 20, 2, shade(steel, .4)); F(5, 13, 20, 1, 0xd8a63a);                                                                   // 돔 테
    F(21, 27, 2, 3, 0xd8e0f0); F(20, 27, 1, 1, 0xd8e0f0); F(22, 29, 1, 1, 0xd8e0f0);                                               // S 로고(실프)
  });
}
// 간이 회복기 표지판: 쇠기둥 + 청록 판(테두리 금색) + 하얀 회복 십자 + 아래 화살표
// ---------------- 성도 방울탑 · 방울로드 ----------------
// 단풍 가로수: 은행나무(노랑) · 홍단풍(빨강) — 침식 없는 맑은 가을 나무
const GINKGO_PAL = { base: 0x5a3a24, hi: 0x8a6040, shadow: 0x2a180e, rim: 0xfff0b0, leaf: [0x6a4a08, 0xb08a10, 0xf0c830, 0xfff4a0], leafAlt: 0xfff8d0 };
const MAPLE_PAL = { base: 0x4a2a1c, hi: 0x7a4a30, shadow: 0x22100a, rim: 0xffd0a0, leaf: [0x5a0a08, 0xa82010, 0xf05028, 0xffb070], leafAlt: 0xffd8a0 };
function autumnTree(scene, v) {
  const key = `tree:autumn:${v}`;
  if (treeCache.has(key) && scene.textures.exists(key)) return treeCache.get(key);
  const big = v % 2 === 0, t = drawDetailedPixelTree({ seed: 707 + v * 13, pal: v < 2 ? GINKGO_PAL : MAPLE_PAL, gw: big ? 92 : 80, gh: big ? 120 : 104, trunk: big ? 7 : 6, corrupt: false, leafMul: 1.15 });
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, t.canvas);
  t.key = key; t.vineKeys = [];
  treeCache.set(key, t);
  return t;
}
// 낙엽 한 장 (노랑 은행잎 · 붉은 단풍잎 · 주황 잎)
function leafArt(scene, k) {
  const cols = [[0xf0c830, 0xb08a10], [0xf05028, 0xa82010], [0xff9a3a, 0xb05a14]][k];
  return canvasTex(scene, `prop:leaf${k}`, 5, 4, F => { F(1, 0, 3, 1, cols[0]); F(0, 1, 5, 2, cols[0]); F(1, 3, 3, 1, cols[1]); F(2, 1, 1, 3, cols[1]); });
}
// 방울탑 정문 외관 (초거대 1층 정면만): 탑 위층은 볼 일이 없다 — 정문 앞에선 카메라가 방 천장 위로 올라가지 않는다(GameScene.camBounds)
//  화면 위쪽은 거대한 1층 처마 밑면(서까래 · 공포 · 단청 · 황금 풍경)이 가로로 꽉 막고, 아래는 굵은 붉은 기둥 · 격자 벽 · 청사초롱 ·
//  사람 다섯 키만 한 활짝 열린 양개 정문 · 넓은 돌 기단과 계단. 정문 안쪽은 깊숙이 금빛 등불이 비친다
//  탑 안은 이미 침식되었다: 정문 틈에서 보랏빛 침식 균열이 기둥 · 벽 · 기단을 타고 번지고, 단청은 군데군데 잿빛으로 바래고,
//  풍경 몇 개는 검게 녹슬고 청사초롱 하나는 꺼져 있다. 문 안쪽 금빛 등불 둘레엔 검보라 장기가 고여 있다
//  W 640 × H 300 · 정문 한가운데 = 가로 중앙 · 바닥 = 아래 끝 (오른쪽 끝은 방 벽 속으로 들어간다)
function bellGateArt(scene) {
  const W = 640, H = 300, cx = W / 2;
  const stone = 0x8a8278, stoneD = 0x5a544c, stoneHi = 0xc8c0b0, red = 0xb83a24, redD = 0x7a2010, redHi = 0xe86a4a, wood = 0x5a3018, woodD = 0x3a1c0c;
  const under = 0x1e2a30, underHi = 0x34464e, gold = 0xffd060, teal = 0x2a8a7a, tealD = 0x1a5a50, green = 0x3aa85a;
  return canvasTex(scene, 'prop:bellgate3', W, H, (F, c) => {
    // ---- 1층 처마 밑면 (0 → 58): 화면 위를 가로로 꽉 막는 거대한 지붕 ----
    F(0, 0, W, 58, under);
    for (let x = -40; x < W + 40; x += 9) { c.strokeStyle = css(underHi); c.lineWidth = 1; c.beginPath(); c.moveTo(cx + (x - cx) * .55, 0); c.lineTo(x, 40); c.stroke(); }   // 처마 밑 서까래 결 (안쪽으로 모인다)
    F(0, 38, W, 6, 0x14202a);
    for (let x = 3; x < W; x += 10) { F(x, 30, 7, 8, tealD); F(x + 1, 31, 5, 6, teal); F(x + 3, 33, 1, 2, gold); }   // 부연 끝 (네모)
    for (let x = 6; x < W; x += 12) { c.fillStyle = css(teal); c.beginPath(); c.arc(x, 50, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = css(gold); c.fillRect(x - 1, 49, 2, 2); }   // 서까래 끝 (둥근 · 단청)
    // 황금 풍경 (처마 끝에 줄지어 매달려 바람에 운다)
    for (let x = 22; x < W; x += 58) { F(x, 55, 1, 10, gold); F(x - 3, 65, 7, 8, gold); F(x - 2, 66, 2, 4, 0xfff4b0); F(x - 4, 72, 9, 2, shade(gold, .7)); F(x, 74, 1, 3, shade(gold, .7)); }
    // ---- 공포 (58 → 88): 처마를 받치는 겹겹의 짜맞춤 ----
    F(0, 58, W, 30, redD);
    for (let x = 2; x < W - 10; x += 20) {
      F(x, 60, 16, 6, teal); F(x + 2, 66, 12, 6, green); F(x + 4, 72, 8, 6, teal); F(x + 6, 78, 4, 8, red);
      F(x + 7, 62, 2, 2, gold); F(x + 7, 74, 2, 2, gold);
    }
    // ---- 단청 띠 (88 → 100) ----
    F(0, 88, W, 12, redD);
    for (let x = 2, k = 0; x < W - 8; x += 10, k++) { F(x, 90, 8, 8, [teal, green, red, teal, gold][k % 5]); F(x + 3, 93, 2, 2, k % 5 === 4 ? red : gold); }
    F(0, 88, W, 1, gold); F(0, 99, W, 1, 0x2a0a04);
    // ---- 1층 몸체 (100 → 270): 격자 벽 ----
    const y1t = 100, y1b = 270;
    F(0, y1t, W, y1b - y1t, wood);
    for (let x = 1; x < W; x += 6) F(x, y1t, 1, y1b - y1t, woodD);
    for (let y = y1t + 14; y < y1b; y += 16) F(0, y, W, 1, woodD);
    // 옆칸 큰 격자창 (안에서 등불빛)
    for (const px of [62, 160, W - 190, W - 92]) {
      const wy = y1t + 34, ww = 60, wh = 80;
      F(px - 4, wy - 4, ww + 8, wh + 8, redD); F(px - 4, wy - 4, ww + 8, 2, gold);
      F(px, wy, ww, wh, 0x2a1408);
      for (let y = wy + 3; y < wy + wh; y += 6) F(px + 1, y, ww - 2, 2, 0xd89850);
      for (let x = px + 6; x < px + ww; x += 9) F(x, wy, 2, wh, 0x2a1408);
      F(px - 6, wy + wh + 4, ww + 12, 4, redD); F(px - 6, wy + wh + 4, ww + 12, 1, redHi);
    }
    // ---- 정문 (156 → 270): 사람 다섯 키 · 깊숙이 열린 양개 목조문 ----
    const dx0 = cx - 66, dx1 = cx + 66, dt = 156, db = y1b;
    const g = c.createRadialGradient(cx, db - 40, 6, cx, db - 36, 110); g.addColorStop(0, '#ffe8a0'); g.addColorStop(.25, '#c87a4a'); g.addColorStop(.55, '#4a1a3a'); g.addColorStop(1, '#12041a');
    c.fillStyle = g; c.fillRect(dx0, dt, dx1 - dx0, db - dt);
    c.fillStyle = '#7a4a24'; c.beginPath(); c.moveTo(dx0, db); c.lineTo(cx - 30, db - 44); c.lineTo(cx + 30, db - 44); c.lineTo(dx1, db); c.closePath(); c.fill();   // 안쪽 마루 (원근)
    for (let k = 1; k < 7; k++) { const y = db - k * 7, w = 66 - k * 6; F(cx - w, y, w * 2, 1, 0x4a2a14); }
    F(cx - 28, db - 92, 56, 48, 0x2a1008); F(cx - 24, db - 88, 48, 44, 0xffd890);   // 저 안쪽 문 (등불)
    for (let k = 0; k < 7; k++) F(cx - 22 + k * 2, db - 50 - k * 6, 44 - k * 4, 3, shade(0xd8a060, 1 - k * .07));   // 안쪽 계단 (위층으로)
    F(cx - 3, db - 86, 6, 8, 0xffffff);
    for (const d of [-1, 1]) {   // 열린 문짝 (안쪽으로 젖혀진 원근) + 황금 문못
      const x0 = d < 0 ? dx0 : dx1, x1 = x0 - d * 24;
      c.fillStyle = css(redD); c.beginPath(); c.moveTo(x0, dt); c.lineTo(x1, dt + 12); c.lineTo(x1, db - 8); c.lineTo(x0, db); c.closePath(); c.fill();
      c.fillStyle = css(red); c.beginPath(); c.moveTo(x0, dt + 3); c.lineTo(x1 + d * 3, dt + 15); c.lineTo(x1 + d * 3, db - 11); c.lineTo(x0, db - 3); c.closePath(); c.fill();
      for (let y = dt + 18; y < db - 12; y += 14) for (let k = 0; k < 3; k++) F(x0 - d * (4 + k * 7) - 1, y + k * 2, 2, 2, gold);
    }
    // 인방 · 현판 (금테 · 글자는 Phaser 텍스트)
    F(dx0 - 30, dt - 14, dx1 - dx0 + 60, 14, red); F(dx0 - 30, dt - 14, dx1 - dx0 + 60, 2, redHi); F(dx0 - 30, dt - 2, dx1 - dx0 + 60, 2, redD);
    F(cx - 64, 108, 128, 30, 0x2a1408); F(cx - 61, 111, 122, 24, 0x5a2a12);
    F(cx - 64, 108, 128, 2, gold); F(cx - 64, 136, 128, 2, gold); F(cx - 64, 108, 2, 30, gold); F(cx + 62, 108, 2, 30, gold);
    for (const d of [-1, 1]) F(cx + d * 70 - (d < 0 ? 4 : 0), 116, 4, 14, gold);
    // ---- 굵은 붉은 기둥 (정문 양옆은 더 굵게) ----
    const post = (x, w) => { F(x, y1t, w, y1b - y1t, red); F(x, y1t, 3, y1b - y1t, redHi); F(x + w - 4, y1t, 4, y1b - y1t, redD); F(x - 3, y1t, w + 6, 4, gold); F(x - 4, y1b - 12, w + 8, 12, stone); F(x - 4, y1b - 12, w + 8, 1, stoneHi); };
    post(dx0 - 30, 26); post(dx1 + 4, 26);
    for (const x of [0, 128, 228, W - 256, W - 154, W - 26]) post(x, 22);
    // ---- 청사초롱 (처마 밑에 매달린 붉은 등) ----
    for (const lx of [cx - 140, cx + 140, 40, W - 40]) {
      F(lx, 100, 1, 18, 0x2a1408);
      F(lx - 8, 118, 17, 3, gold); F(lx - 10, 121, 21, 22, 0xd83a24); F(lx - 8, 121, 17, 22, 0xf05a34); F(lx - 4, 124, 5, 16, 0xffb070);
      for (let y = 126; y < 142; y += 5) F(lx - 10, y, 21, 1, 0xa82010);
      F(lx - 8, 143, 17, 3, gold); F(lx - 1, 146, 3, 6, gold);
    }
    // ---- 돌 기단 (270 → 300) · 정문 앞 넓은 돌계단 ----
    F(0, 280, W, 20, stoneD); F(0, 280, W, 2, stoneHi);
    F(0, 270, W, 10, stone); F(0, 270, W, 1, stoneHi);
    for (let x = 4; x < W; x += 26) { F(x, 282, 1, 18, 0x3a342c); F(x + 13, 272, 1, 8, stoneD); }   // 돌 이음매
    for (let k = 0; k < 6; k++) { const w = 104 - k * 5, y = H - 5 - k * 5; F(cx - w, y, w * 2, 5, k % 2 ? stone : shade(stone, 1.1)); F(cx - w, y, w * 2, 1, stoneHi); }   // 계단 (앞으로 넓어진다)
    // ---- 침식 흔적 ----
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let x = 2, k = 0; x < W - 8; x += 10, k++) if (rnd() < .3) { F(x, 90, 8, 8, 0x4a4250); F(x + 2, 92, 3, 2, 0x5a5262); }   // 잿빛으로 바랜 단청
    for (let x = 2; x < W - 10; x += 20) if (rnd() < .25) { F(x, 60, 16, 18, 0x3a3440); F(x + 4, 66, 6, 2, 0x4a4250); }   // 바랜 공포
    for (let x = 22; x < W; x += 58) if (rnd() < .4) { F(x - 3, 65, 7, 8, 0x4a3a2a); F(x - 2, 66, 2, 4, 0x6a5a3a); F(x - 4, 72, 9, 2, 0x2a2018); }   // 검게 녹슨 풍경
    { const lx = W - 40; F(lx - 10, 121, 21, 22, 0x3a1a24); F(lx - 8, 121, 17, 22, 0x4a2430); F(lx - 4, 124, 5, 16, 0x5a3040); F(lx + 4, 130, 6, 10, 0x1a0814); }   // 꺼진 청사초롱 (찢긴 자국)
    // 빛바랜 칠: 전체를 검보라로 한 겹 가라앉히고, 처마 쪽(위)은 더 어둡게
    c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(28,10,40,.32)'; c.fillRect(0, 0, W, H);
    const dk = c.createLinearGradient(0, 0, 0, 200); dk.addColorStop(0, 'rgba(14,4,22,.55)'); dk.addColorStop(1, 'rgba(14,4,22,0)'); c.fillStyle = dk; c.fillRect(0, 0, W, 200); c.restore();
    // 보랏빛 침식 균열: 정문 틈에서 시작해 갈라지며 번진다 (검은 골 + 보랏빛 심 + 끝의 빛 알갱이)
    const vein = (x, y, ang, len, depth) => {
      for (let i = 0; i < len; i++) {
        x += Math.cos(ang) * 2; y += Math.sin(ang) * 2; ang += (rnd() - .5) * .7;
        if (x < 0 || x >= W || y < 60 || y >= H) return;
        F(Math.round(x) - 1, Math.round(y), 2, 2, 0x1a0824); F(Math.round(x), Math.round(y), 1, 1, i % 4 ? 0x7a2ad8 : 0xc070ff);
        if (depth > 0 && rnd() < .035) vein(x, y, ang + (rnd() < .5 ? -.9 : .9), len * .5 - i * .3, depth - 1);
      }
      F(Math.round(x), Math.round(y), 2, 2, 0xd890ff);
    };
    for (const d of [-1, 1]) {
      const ex = d < 0 ? dx0 - 30 : dx1 + 30;
      vein(ex, db - 20, d < 0 ? Math.PI * 1.15 : -Math.PI * .15, 46, 2);    // 기단을 따라 옆으로
      vein(ex, db - 60, d < 0 ? Math.PI * 1.3 : -Math.PI * .3, 38, 2);     // 벽을 타고 비스듬히 위로
      vein(ex - d * 10, dt - 10, -Math.PI / 2 - d * .4, 22, 1);            // 인방 · 현판 쪽으로
    }
    vein(cx - 120, db + 8, Math.PI * 1.02, 40, 1); vein(cx + 120, db + 10, -.02, 40, 1);   // 돌 기단 균열
    // 정문 문턱에 고인 검보라 장기
    const mg = c.createRadialGradient(cx, db, 4, cx, db, 90); mg.addColorStop(0, 'rgba(90,20,120,.55)'); mg.addColorStop(1, 'rgba(30,6,40,0)');
    c.fillStyle = mg; c.fillRect(cx - 100, db - 60, 200, 90);
    // 왼쪽 끝: 처마가 하늘로 휘어 오르며 화면 밖으로 (오른쪽 끝은 방 벽 속)
    c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.moveTo(0, 0); c.lineTo(34, 0); c.quadraticCurveTo(8, 20, 0, 46); c.closePath(); c.fill(); c.restore();
    F(2, 40, 6, 8, gold); F(0, 36, 3, 5, gold);
    for (const d of [-1, 1]) { const x = cx + d * 110 - (d < 0 ? 14 : 0); F(x, 254, 14, 46, stoneD); F(x, 254, 14, 2, stoneHi); F(x + 3, 246, 8, 8, stone); F(x + 5, 242, 4, 4, gold); }   // 계단 옆 돌난간 기둥
  });
}
// 벽 횃불: 쇠 받침 + 타오르는 불꽃
function wallTorchArt(scene) {
  return canvasTex(scene, 'prop:walltorch', 10, 18, F => {
    F(3, 10, 4, 3, 0x3a2a1e); F(4, 13, 2, 5, 0x2a1e14); F(2, 9, 6, 2, 0x5a4a3a);
    F(3, 4, 4, 6, 0xff8a2a); F(4, 2, 2, 4, 0xffc040); F(4, 5, 2, 3, 0xfff0a0); F(2, 6, 1, 3, 0xff5a1a); F(7, 6, 1, 2, 0xff5a1a);
  });
}

// ---------------- 호연: 기상 이변 · 하늘기둥 ----------------
// 대지의 동굴 입구: 거대한 붉은 마그마 암벽 · 안쪽은 이글거리는 용암빛 · 흘러내리는 용암 줄기 · 갈라진 틈
function magmaCaveArt(scene) {
  const W = 170, H = 130;
  return canvasTex(scene, 'prop:magmacave', W, H, (F, c) => {
    const cx = W / 2;
    c.fillStyle = '#3a1410'; c.beginPath(); c.moveTo(0, H); c.lineTo(8, 50); c.lineTo(30, 18); c.lineTo(62, 4); c.lineTo(108, 6); c.lineTo(142, 22); c.lineTo(162, 54); c.lineTo(W, H); c.closePath(); c.fill();   // 암벽
    for (let k = 0; k < 40; k++) F((k * 37) % W, 20 + (k * 53) % (H - 30), 6, 3, k % 2 ? 0x5a2418 : 0x2a0e0a);   // 바위 결
    const g = c.createRadialGradient(cx, H - 20, 6, cx, H - 30, 70); g.addColorStop(0, '#fff0a0'); g.addColorStop(.25, '#ff8a2a'); g.addColorStop(.6, '#a8200e'); g.addColorStop(1, '#2a0806');
    c.fillStyle = g; c.beginPath(); c.moveTo(cx - 46, H); c.quadraticCurveTo(cx - 50, 40, cx, 34); c.quadraticCurveTo(cx + 50, 40, cx + 46, H); c.closePath(); c.fill();   // 동굴 입구 (이글거리는 용암빛)
    c.strokeStyle = '#1a0606'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx - 46, H); c.quadraticCurveTo(cx - 50, 40, cx, 34); c.quadraticCurveTo(cx + 50, 40, cx + 46, H); c.stroke();
    for (const [x, y, len] of [[24, 30, 50], [140, 40, 46], [60, 10, 22], [118, 12, 20]]) { F(x, y, 2, len, 0xff6a1a); F(x, y, 1, len, 0xffd060); F(x - 1, y + len, 4, 3, 0xff8a2a); }   // 흘러내리는 용암
    for (const [x, y] of [[14, 70], [150, 80], [40, 96], [130, 104]]) { F(x, y, 8, 1, 0xff5a1a); F(x + 3, y + 1, 1, 4, 0xff5a1a); }   // 갈라진 틈
  });
}
// 해저동굴 입구: 청록 바위 아치 · 고대 해저 유적 문양 · 안쪽은 깊은 물빛
function seaCaveArt(scene) {
  const W = 170, H = 130;
  return canvasTex(scene, 'prop:seacave', W, H, (F, c) => {
    const cx = W / 2;
    c.fillStyle = '#123a44'; c.beginPath(); c.moveTo(0, H); c.lineTo(10, 46); c.lineTo(38, 14); c.lineTo(84, 2); c.lineTo(132, 14); c.lineTo(160, 46); c.lineTo(W, H); c.closePath(); c.fill();
    for (let k = 0; k < 40; k++) F((k * 41) % W, 18 + (k * 29) % (H - 30), 5, 2, k % 2 ? 0x1e5260 : 0x0a2830);
    const g = c.createLinearGradient(0, 40, 0, H); g.addColorStop(0, '#0a3a5a'); g.addColorStop(.6, '#04182a'); g.addColorStop(1, '#020a14');
    c.fillStyle = g; c.beginPath(); c.moveTo(cx - 48, H); c.lineTo(cx - 48, 56); c.quadraticCurveTo(cx, 22, cx + 48, 56); c.lineTo(cx + 48, H); c.closePath(); c.fill();
    c.strokeStyle = '#4affd0'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 52, H); c.lineTo(cx - 52, 56); c.quadraticCurveTo(cx, 16, cx + 52, 56); c.lineTo(cx + 52, H); c.stroke();   // 문양 테두리
    c.strokeStyle = 'rgba(74,255,208,.7)'; c.lineWidth = 1;
    for (const [x, y] of [[cx - 62, 70], [cx + 62, 70], [cx - 62, 98], [cx + 62, 98], [cx, 30]]) { c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.moveTo(x - 7, y); c.lineTo(x + 7, y); c.moveTo(x, y - 7); c.lineTo(x, y + 7); c.stroke(); }   // 고대 문양
    for (let k = 0; k < 6; k++) F(cx - 30 + k * 12, 70 + (k % 2) * 16, 2, 2, 0x8affe0);   // 물속 빛
  });
}
// 하늘기둥 외관: 까마득히 솟은 회백 · 청록 석탑 · 허물어진 모서리 · 이끼와 덩굴 · 아치 석문 위 델타 룬 · 위는 구름에 잠긴다
function skyPillarArt(scene) {
  const W = 140, H = 280, stone = 0x8a9a96, dark = 0x4a5a58;
  return canvasTex(scene, 'prop:skypillar', W, H, (F, c) => {
    const cx = W / 2;
    for (let y = 0; y < H; y++) {   // 위로 갈수록 가늘어지고 흐려지는 탑 몸통
      const w = 96 - (1 - y / H) * 26, a = Math.min(1, .25 + y / H * 1.2);
      c.globalAlpha = a; F(cx - w / 2, y, w, 1, y % 24 < 2 ? dark : stone); F(cx - w / 2, y, 3, 1, 0xb8c8c0); F(cx + w / 2 - 4, y, 4, 1, dark); c.globalAlpha = 1;
    }
    for (let k = 0; k < 9; k++) { const y = 40 + k * 26, w = 96 - (1 - y / H) * 26; F(cx - w / 2 - 4, y, w + 8, 4, dark); F(cx - w / 2 - 4, y, w + 8, 1, 0xc8d8d0); }   // 층마다 돌띠
    for (const [x, y] of [[cx - 44, 120], [cx + 38, 170], [cx - 40, 220]]) { F(x, y, 8, 10, 0x14201e); F(x + 2, y + 10, 4, 3, 0x14201e); }   // 허물어진 자리
    for (let k = 0; k < 30; k++) F(cx - 46 + (k * 31) % 92, 100 + (k * 47) % 170, 3 + (k % 3), 2, k % 2 ? 0x3a8a5a : 0x2a6a4a);   // 이끼
    c.strokeStyle = '#2a7a4a'; c.lineWidth = 2;
    for (const x0 of [cx - 40, cx + 30]) { c.beginPath(); c.moveTo(x0, 110); for (let y = 110; y < H - 10; y += 14) c.quadraticCurveTo(x0 + (y % 28 ? 6 : -6), y + 7, x0, y + 14); c.stroke(); }   // 덩굴
    // 아치 석문
    F(cx - 22, H - 64, 44, 64, dark); c.fillStyle = '#081210'; c.beginPath(); c.moveTo(cx - 16, H); c.lineTo(cx - 16, H - 42); c.quadraticCurveTo(cx, H - 62, cx + 16, H - 42); c.lineTo(cx + 16, H); c.closePath(); c.fill();
    // 델타 룬 (레쿠쟈 문양): 황금 · 에메랄드 삼각 고리
    c.strokeStyle = '#ffd860'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, H - 86); c.lineTo(cx + 11, H - 68); c.lineTo(cx - 11, H - 68); c.closePath(); c.stroke();
    c.strokeStyle = '#4affb0'; c.lineWidth = 1; c.beginPath(); c.arc(cx, H - 74, 14, 0, Math.PI * 2); c.stroke();
    F(cx - 50, H - 6, 100, 6, 0x5a6a66); F(cx - 50, H - 6, 100, 1, 0xc8d8d0);   // 기단
  });
}
// 131번 수로 돌다리 난간 (16×10 반복): 이끼 낀 고대 석주와 난간
function bridgeRailArt(scene) {
  return canvasTex(scene, 'prop:bridgerail', 16, 10, F => {
    F(0, 2, 16, 2, 0x8a9a96); F(0, 2, 16, 1, 0xc8d8d0); F(1, 4, 3, 6, 0x6a7a76); F(1, 4, 1, 6, 0xa8b8b0); F(0, 0, 5, 2, 0x8a9a96);
    F(9, 3, 3, 1, 0x3a8a5a); F(2, 8, 2, 2, 0x3a8a5a);
  });
}
// 고대 발광 수정 (벽에 박힌 초록 결정)
function pillarCrystalArt(scene) {
  return canvasTex(scene, 'prop:pcrystal', 9, 14, F => {
    F(3, 0, 3, 14, 0x2ad89a); F(4, 1, 1, 11, 0xd8fff0); F(0, 5, 3, 8, 0x1aa87a); F(6, 4, 3, 9, 0x1aa87a); F(1, 6, 1, 5, 0x8affd0);
  });
}
// 물결 · 포말 (64×10 반복): 발밑 바닷물 · 다리 아래 파도
function waveArt(scene) {
  return canvasTex(scene, 'prop:wave', 64, 10, (F, c) => {
    for (let x = 0; x < 64; x++) { const y = 3 + Math.round(Math.sin(x / 64 * Math.PI * 4) * 2); F(x, y, 1, 10 - y, 0x1a5a7a); F(x, y, 1, 1, 0xd8f4ff); if (x % 9 < 2) F(x, y + 1, 1, 1, 0xffffff); }
  });
}

// 간이 회복기 쉼터 (할로우 나이트의 벤치 방처럼): 등 뒤를 감싸는 아치형 돌벽 · 나무 벤치 · 따뜻한 가로등
function shelterArchArt(scene) {
  const st = 0x2a2634;
  return canvasTex(scene, 'prop:shelter', 132, 76, (F, c) => {
    // 안쪽: 따뜻한 빛이 고인 벽감 (위가 둥근 아치)
    const g = c.createRadialGradient(66, 60, 6, 66, 52, 70);
    g.addColorStop(0, 'rgba(255,190,110,0.32)'); g.addColorStop(.55, 'rgba(120,80,60,0.22)'); g.addColorStop(1, 'rgba(20,16,28,0.0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(14, 76); c.lineTo(14, 34); c.quadraticCurveTo(66, -10, 118, 34); c.lineTo(118, 76); c.closePath(); c.fill();
    // 돌 아치 테두리 (벽돌 줄눈)
    c.lineWidth = 7; c.strokeStyle = css(st); c.beginPath(); c.moveTo(10, 76); c.lineTo(10, 34); c.quadraticCurveTo(66, -12, 122, 34); c.lineTo(122, 76); c.stroke();
    c.lineWidth = 1; c.strokeStyle = css(shade(st, 1.6)); c.beginPath(); c.moveTo(7, 76); c.lineTo(7, 34); c.quadraticCurveTo(66, -16, 125, 34); c.lineTo(125, 76); c.stroke();
    for (let k = 0; k < 9; k++) { const a = Math.PI * (k + .5) / 9, x = 66 - Math.cos(a) * 56, y = 34 - Math.sin(a) * 40; F(x - 1, y - 1, 2, 2, shade(st, .6)); }
    // 기둥 받침
    F(3, 66, 14, 10, shade(st, .8)); F(115, 66, 14, 10, shade(st, .8)); F(3, 66, 14, 1, shade(st, 1.5)); F(115, 66, 14, 1, shade(st, 1.5));
  });
}
function benchArt(scene) {
  const wood = 0x8a5a32, iron = 0x2a2a34;
  return canvasTex(scene, 'prop:bench', 30, 15, F => {
    F(2, 0, 26, 3, shade(wood, .8)); F(2, 0, 26, 1, shade(wood, 1.35));            // 등받이
    F(3, 3, 2, 6, iron); F(25, 3, 2, 6, iron);                                     // 등받이 기둥
    F(0, 7, 30, 3, wood); F(0, 7, 30, 1, shade(wood, 1.4)); F(0, 9, 30, 1, shade(wood, .6));   // 앉는 판
    F(2, 10, 2, 5, iron); F(26, 10, 2, 5, iron); F(1, 14, 4, 1, iron); F(25, 14, 4, 1, iron);   // 쇠 다리
    F(4, 4, 22, 1, shade(wood, .55));
  });
}
function streetlampArt(scene) {
  const iron = 0x22222c;
  return canvasTex(scene, 'prop:lamp', 12, 48, F => {
    F(5, 12, 2, 34, iron); F(6, 12, 1, 34, shade(iron, 1.6));                       // 기둥
    F(3, 45, 6, 3, iron); F(4, 44, 4, 1, shade(iron, 1.4));                         // 받침
    F(2, 3, 8, 9, iron); F(3, 4, 6, 7, 0xffc070); F(4, 5, 2, 5, 0xfff0c8); F(7, 5, 1, 5, 0xffa040);   // 등불 유리
    F(1, 2, 10, 2, iron); F(4, 0, 4, 2, iron); F(3, 12, 6, 1, iron);
  });
}

function termSignArt(scene) {
  const teal = 0x2ac0a8;
  return canvasTex(scene, 'prop:termsign', 18, 30, F => {
    F(8, 12, 2, 18, 0x3e4a5a); F(8, 12, 1, 18, 0x6a7890);                                 // 기둥
    F(0, 0, 18, 14, 0xd8a63a); F(1, 1, 16, 12, shade(teal, .7)); F(1, 1, 16, 1, 0x9affe8);   // 판 · 금테
    F(7, 3, 4, 9, 0xffffff); F(4, 6, 10, 3, 0xffffff); F(8, 4, 2, 7, 0x7dff9a); F(5, 7, 8, 1, 0x7dff9a);   // 회복 십자
    F(6, 22, 6, 1, 0x7dffd8); F(7, 23, 4, 1, 0x7dffd8); F(8, 24, 2, 1, 0x7dffd8);         // ↓
  });
}
// 기술머신 제단 (Grand TM Shrine): 고대 실프주식회사 하이테크 캡슐 — 예전 제단의 2배가 넘는 크기
//  바닥 홀로그램 마법진 · 금테 금속 받침 · 유리 배양관(안에서 황금·보랏빛 디스크와 에너지 코어가 떠서 맥동) · 위 뚜껑(작동하면 들린다)
function tmArt(scene) {
  const steel = 0x3a3c52, dark = 0x1a1a2a, gold = 0xd8a63a, cyan = 0x6ae8ff;
  const base = canvasTex(scene, 'prop:tm2-base', 72, 16, F => {
    F(0, 6, 72, 10, shade(steel, .5)); F(2, 7, 68, 8, steel); F(2, 7, 68, 1, shade(steel, 1.7));      // 넓은 받침판
    F(10, 0, 52, 7, shade(steel, .6)); F(11, 1, 50, 5, shade(steel, 1.15)); F(11, 1, 50, 1, shade(steel, 1.8));   // 윗단
    F(2, 11, 68, 1, gold, .9); F(11, 5, 50, 1, gold, .8);                                                 // 금테
    for (const x of [6, 14, 22, 30, 41, 49, 57, 65]) F(x, 12, 2, 2, cyan);                                // 빛나는 이음매
    F(33, 2, 6, 3, cyan); F(34, 3, 4, 1, 0xffffff);                                                       // 가운데 동력 표시등
  });
  const glass = canvasTex(scene, 'prop:tm2-glass', 34, 52, (F, c) => {   // 배양관 안쪽 (반투명 유리 + 아래서 차오르는 빛)
    const gr = c.createLinearGradient(0, 0, 0, 52); gr.addColorStop(0, 'rgba(40,30,80,.55)'); gr.addColorStop(.7, 'rgba(70,40,130,.5)'); gr.addColorStop(1, 'rgba(150,90,255,.7)');
    c.fillStyle = gr; c.fillRect(0, 0, 34, 52);
    for (let y = 4; y < 52; y += 6) F(4 + (y * 7) % 22, y, 2, 2, 0xc8b0ff, .5);                       // 떠오르는 기포
  });
  const frame = canvasTex(scene, 'prop:tm2-frame', 42, 60, F => {   // 유리 앞 틀: 양옆 기둥 · 아래 고리 · 유리 반사광 (가운데는 비어 있다)
    F(0, 0, 5, 60, shade(steel, .55)); F(1, 0, 3, 60, steel); F(1, 0, 1, 60, shade(steel, 1.7));
    F(37, 0, 5, 60, shade(steel, .55)); F(38, 0, 3, 60, steel); F(40, 0, 1, 60, shade(steel, .4));
    for (let y = 6; y < 54; y += 9) { F(2, y, 1, 4, cyan); F(39, y, 1, 4, cyan); }                       // 기둥의 표시등
    F(0, 52, 42, 8, shade(steel, .5)); F(1, 53, 40, 6, steel); F(1, 53, 40, 1, shade(steel, 1.8)); F(1, 57, 40, 1, gold);   // 아래 고리
    F(9, 4, 2, 40, 0xffffff, .28); F(12, 6, 1, 30, 0xffffff, .18); F(30, 10, 1, 36, 0xffffff, .12);      // 유리 반사광
  });
  const cap = canvasTex(scene, 'prop:tm2-cap', 46, 14, F => {   // 위 뚜껑 (작동하면 들려 열린다)
    F(0, 4, 46, 10, shade(steel, .5)); F(1, 5, 44, 8, steel); F(1, 5, 44, 1, shade(steel, 1.8)); F(1, 10, 44, 1, gold);
    F(10, 0, 26, 5, shade(steel, .6)); F(11, 1, 24, 3, shade(steel, 1.2)); F(20, 1, 6, 2, cyan); F(22, 0, 2, 1, 0xffffff);
    for (const x of [4, 40]) F(x, 7, 2, 3, 0xff5a8a);                                                    // 붉은 경고등
  });
  const disc = canvasTex(scene, 'prop:tm2-disc', 21, 21, (F, c) => {   // 황금·보랏빛 기술 디스크
    const ring = (r, col) => { c.fillStyle = css(col); c.beginPath(); c.arc(10.5, 10.5, r, 0, Math.PI * 2); c.fill(); };
    ring(10.5, 0x3a1a08); ring(9.5, 0xffc84a); ring(8, 0xfff0b0); ring(6.2, 0x9a5aff); ring(4.2, 0xd8b0ff); ring(2.2, 0x2a0a3a);
    F(4, 4, 4, 1, 0xffffff); F(4, 5, 1, 3, 0xffffff); F(13, 15, 4, 1, 0x7a3a10, .8);
  });
  const sigil = canvasTex(scene, 'prop:tm2-sigil', 96, 96, (F, c) => {   // 바닥 홀로그램 마법진 (눕혀서 쓴다)
    c.strokeStyle = '#8ae8ff'; c.lineWidth = 2; c.beginPath(); c.arc(48, 48, 44, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1; c.beginPath(); c.arc(48, 48, 36, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(48, 48, 22, 0, Math.PI * 2); c.stroke();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, b = a + Math.PI * 2 / 3; c.beginPath(); c.moveTo(48 + Math.cos(a) * 36, 48 + Math.sin(a) * 36); c.lineTo(48 + Math.cos(b) * 36, 48 + Math.sin(b) * 36); c.stroke(); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; F(48 + Math.cos(a) * 40 - 1, 48 + Math.sin(a) * 40 - 1, 3, 3, k % 2 ? 0xffd25a : 0x8ae8ff); }
  });
  return { base, glass, frame, cap, disc, sigil };
}// 샛길 갱도 옆 표지: TM 디스크 무늬 + 아래 화살표
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

// 금이 간 바위 (연습용 과녁 — 공중 내려찍기로만 부서진다)
function crackedRockArt(scene) {
  const r = 0x6a6878;
  return canvasTex(scene, 'prop:crackrock', 16, 13, F => {
    F(2, 3, 12, 10, shade(r, .5)); F(1, 5, 14, 8, shade(r, .5)); F(3, 2, 10, 1, shade(r, .5));
    F(3, 3, 10, 9, r); F(2, 5, 12, 7, r); F(3, 3, 9, 2, shade(r, 1.35)); F(2, 5, 3, 2, shade(r, 1.2));
    F(2, 11, 12, 1, shade(r, .7));
    for (const [x, y] of [[8, 3], [7, 4], [7, 5], [8, 6], [9, 7], [8, 8], [6, 7], [5, 8], [10, 9], [11, 10]]) F(x, y, 1, 1, 0x1a1622);   // 금
    F(9, 4, 1, 1, 0xffd166); F(6, 8, 1, 1, 0xffd166);   // 갈라진 틈의 빛
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
// ---------------- 신오: 천관산 만년설 협곡 · 창기둥 · 깨어진 세계 ----------------
// 창기둥 정문 외관 (640×300): 눈 덮인 대리석 대계단 · 화면 위 틀에 잘린 코린트식 열주 · 한가운데 아치형 대정문(금강 · 백옥빛 시공의 소용돌이)
function spearGateArt(scene) {
  const W = 640, H = 300, cx = W / 2;
  const mar = 0xc8c4da, marD = 0x9490b2, marDD = 0x5e5c80, marHi = 0xeceaf6, snow = 0xdfe6f6, snowD = 0xb0bcd8, gold = 0xe0c058, ice = 0x8ac0f0;   // 조명(Light2D)을 받으면 한 톤 밝아진다
  return canvasTex(scene, 'prop:speargate', W, H, (F, c) => {
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // ---- 뒤 벽: 열주 사이로 보이는 신전 안쪽의 깊은 대리석 벽 (석재 줄눈) ----
    F(0, 0, W, 254, 0x4e4c6e);
    for (let y = 30, k = 0; y < 254; y += 18, k++) { F(0, y, W, 1, 0x3c3a5a); for (let x = (k % 2) * 24; x < W; x += 48) F(x, y, 1, 18, 0x3c3a5a); }
    // ---- 프리즈 (맨 위 — 화면 틀에 잘린다): 고대 문자가 새겨진 띠 ----
    F(0, 0, W, 28, marD); F(0, 0, W, 2, mar); F(0, 26, W, 3, marDD);
    for (let x = 10, k = 0; x < W - 10; x += 24, k++) {   // 고대 문자 (안농 같은 둥근 고리 · 막대)
      const v = (k * 7) % 5;
      c.strokeStyle = css(marDD); c.lineWidth = 2; c.beginPath();
      if (v === 0) c.arc(x + 6, 14, 5, 0, Math.PI * 2); else if (v === 1) { c.moveTo(x + 1, 8); c.lineTo(x + 11, 20); c.moveTo(x + 11, 8); c.lineTo(x + 1, 20); }
      else if (v === 2) { c.arc(x + 6, 14, 5, Math.PI * .2, Math.PI * 1.8); c.moveTo(x + 6, 14); c.lineTo(x + 12, 14); } else if (v === 3) { c.moveTo(x + 6, 7); c.lineTo(x + 6, 21); c.moveTo(x + 1, 11); c.lineTo(x + 11, 11); } else { c.rect(x + 1, 9, 10, 10); }
      c.stroke(); F(x + 5, 13, 2, 2, k % 3 ? 0x8ac8ff : 0xffa8d8);
    }
    for (let x = 0; x < W; x += 3) F(x, 0, 3, 3 + Math.round(rnd() * 3), snow, .9);   // 프리즈 위 눈
    // ---- 아치형 대정문 (가운데): 백옥 · 금강 빛이 소용돌이치는 시공의 문 ----
    const ar = 78, spring = 132, gb = 254;   // 아치 반지름 · 아치 시작 높이 · 문턱
    const vg = c.createRadialGradient(cx, 168, 4, cx, 176, 120);
    vg.addColorStop(0, '#ffffff'); vg.addColorStop(.16, '#ffd8f4'); vg.addColorStop(.38, '#a890ff'); vg.addColorStop(.62, '#4a6ae0'); vg.addColorStop(.86, '#1a1850'); vg.addColorStop(1, '#0a0820');
    c.fillStyle = vg; c.beginPath(); c.moveTo(cx - ar, gb); c.lineTo(cx - ar, spring); c.arc(cx, spring, ar, Math.PI, 0); c.lineTo(cx + ar, gb); c.closePath(); c.fill();
    c.save(); c.beginPath(); c.moveTo(cx - ar, gb); c.lineTo(cx - ar, spring); c.arc(cx, spring, ar, Math.PI, 0); c.lineTo(cx + ar, gb); c.closePath(); c.clip();
    for (let arm = 0; arm < 4; arm++) {   // 소용돌이 팔 (금강의 푸른빛 · 백옥의 분홍빛이 번갈아)
      c.strokeStyle = arm % 2 ? 'rgba(255,150,220,.55)' : 'rgba(130,190,255,.55)'; c.lineWidth = 3; c.beginPath();
      for (let t = 0; t < 1; t += .02) { const a = arm * Math.PI / 2 + t * Math.PI * 3.2, rr = 6 + t * 96; const x = cx + Math.cos(a) * rr, y = 176 + Math.sin(a) * rr * .9; t === 0 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.stroke();
    }
    for (let k = 0; k < 40; k++) { const a = rnd() * Math.PI * 2, rr = 10 + rnd() * 90; F(cx + Math.cos(a) * rr, 176 + Math.sin(a) * rr * .9, 2, 2, rnd() < .5 ? 0xffffff : 0xd8c8ff, .8); }   // 빛 알갱이
    c.restore();
    // 아치 테 (홍예석 · 이맛돌의 창기둥 문장) · 양옆 벽기둥
    c.strokeStyle = css(mar); c.lineWidth = 16; c.beginPath(); c.arc(cx, spring, ar + 8, Math.PI, 0); c.stroke();
    c.strokeStyle = css(marHi); c.lineWidth = 1; c.beginPath(); c.arc(cx, spring, ar + 15, Math.PI, 0); c.stroke();
    c.strokeStyle = css(marD); c.lineWidth = 1; c.beginPath(); c.arc(cx, spring, ar + 1, Math.PI, 0); c.stroke();
    for (let k = 1; k < 12; k++) { const a = Math.PI + k / 12 * Math.PI; c.strokeStyle = css(marD); c.beginPath(); c.moveTo(cx + Math.cos(a) * (ar + 1), spring + Math.sin(a) * (ar + 1)); c.lineTo(cx + Math.cos(a) * (ar + 16), spring + Math.sin(a) * (ar + 16)); c.stroke(); }
    F(cx - 12, spring - ar - 20, 24, 26, mar); F(cx - 12, spring - ar - 20, 24, 2, marHi); F(cx - 10, spring - ar - 16, 20, 18, 0x3a3858);
    c.fillStyle = css(gold); c.beginPath(); c.moveTo(cx, spring - ar - 14); c.lineTo(cx + 6, spring - ar - 4); c.lineTo(cx, spring - ar + 2); c.lineTo(cx - 6, spring - ar - 4); c.closePath(); c.fill();   // 창 문장 (금빛 마름모)
    F(cx - 1, spring - ar - 12, 2, 12, 0xfff4c0);
    for (const d of [-1, 1]) {
      const px = d < 0 ? cx - ar - 18 : cx + ar + 4;
      F(px, spring - 6, 14, gb - spring + 6, mar); F(px, spring - 6, 2, gb - spring + 6, marHi); F(px + 11, spring - 6, 3, gb - spring + 6, marD);
      F(px - 3, spring - 10, 20, 6, mar); F(px - 3, spring - 10, 20, 1, marHi); F(px - 3, spring - 13, 20, 3, snow, .9);
    }
    // ---- 코린트식 열주 (6개): 세로 홈 · 아칸서스 잎 기둥머리 · 화면 위로 계속 뻗어 오른다 ----
    const col = (x, w) => {
      const top = 30, capB = 62, baseT = 234;
      F(x + 4, capB, w - 8, baseT - capB, mar);   // 기둥 몸통
      for (let fx = x + 7; fx < x + w - 6; fx += 5) { F(fx, capB, 2, baseT - capB, marD, .7); F(fx + 2, capB, 1, baseT - capB, marHi, .5); }   // 세로 홈
      F(x + 4, capB, 2, baseT - capB, marHi); F(x + w - 7, capB, 3, baseT - capB, marDD, .6);
      // 기둥머리: 아칸서스 잎 두 줄 + 모서리 소용돌이 + 사각 판
      for (let row = 0; row < 2; row++) for (let lx = x + 2 + row * 4; lx < x + w - 4; lx += 8) { const ly = capB - 10 - row * 10; c.fillStyle = css(row ? mar : marD); c.beginPath(); c.moveTo(lx, ly + 12); c.quadraticCurveTo(lx + 4, ly - 2, lx + 8, ly + 12); c.closePath(); c.fill(); F(lx + 3, ly + 3, 2, 8, marHi, .6); }
      for (const vx of [x - 2, x + w - 6]) { c.strokeStyle = css(marD); c.lineWidth = 2; c.beginPath(); c.arc(vx + 4, top + 10, 4, 0, Math.PI * 1.6); c.stroke(); }
      F(x - 4, top, w + 8, 8, mar); F(x - 4, top, w + 8, 1, marHi); F(x - 4, top - 4, w + 8, 4, snow);   // 사각 판 + 쌓인 눈
      for (let k = 0; k < 3; k++) F(x + 4 + k * 13 + rnd() * 6, top + 8, 2, 4 + rnd() * 8, ice, .8);   // 고드름
      // 받침 (둥근 테 · 사각 받침돌) + 쌓인 눈
      F(x, baseT, w, 6, mar); F(x, baseT, w, 1, marHi); F(x - 4, baseT + 6, w + 8, 14, marD); F(x - 4, baseT + 6, w + 8, 1, mar);
      F(x - 6, baseT - 3, w + 12, 4, snow); for (let k = 0; k < w + 12; k += 4) F(x - 6 + k, baseT - 5, 4, 2 + rnd() * 2, snow);
      // 금 · 깨진 홈
      let kx = x + 8 + rnd() * (w - 16), ky = capB + 30 + rnd() * 100; for (let s = 0; s < 18; s++) { F(kx, ky, 1, 2, marDD); kx += rnd() < .5 ? -1 : 1; ky += 2; }
    };
    for (const x of [6, 92, 178]) { col(x, 44); col(W - x - 44, 44); }
    // ---- 눈 덮인 대리석 대계단 (254 → 300): 앞으로 갈수록 넓어진다 ----
    F(0, 252, W, 4, marD); F(0, 252, W, 1, mar);
    for (let k = 0; k < 8; k++) {
      const y = 256 + k * 5.5, w = 120 + k * 34;
      F(cx - w, y, w * 2, 6, k % 2 ? mar : shade(mar, .94)); F(cx - w, y, w * 2, 1, marHi); F(cx - w, y + 5, w * 2, 1, marD);
      for (let x = cx - w; x < cx + w; x += 6) F(x, y - 1, 6, 1 + Math.round(rnd() * 2), snow, .95);   // 계단마다 쌓인 눈
    }
    for (const d of [-1, 1]) {   // 계단 양옆 눈더미 · 눈 덮인 돌사자 받침
      const x = d < 0 ? cx - 150 : cx + 126;
      F(x, 236, 24, 64, marD); F(x, 236, 24, 2, mar); F(x - 4, 228, 32, 10, mar); F(x - 4, 224, 32, 5, snow);
      c.fillStyle = css(snow); c.beginPath(); c.ellipse(x + 12, 300, 44, 14, 0, Math.PI, 0); c.fill();
      c.fillStyle = css(snowD); c.beginPath(); c.ellipse(x + 12 + d * 14, 300, 22, 6, 0, Math.PI, 0); c.fill();
    }
    // ---- 시공의 뒤틀림: 문틈에서 번지는 푸른 · 분홍 균열 · 떠오른 대리석 조각 ----
    const vein = (x, y, ang, len, colA, colB) => { for (let i = 0; i < len; i++) { x += Math.cos(ang) * 2; y += Math.sin(ang) * 2; ang += (rnd() - .5) * .6; if (x < 0 || x >= W || y < 30 || y >= 252) return; F(x - 1, y, 2, 2, 0x2a2850); F(x, y, 1, 1, i % 3 ? colA : colB); } };
    for (const d of [-1, 1]) { vein(cx + d * (ar + 20), 210, d < 0 ? Math.PI * 1.1 : -Math.PI * .1, 40, 0x8ac8ff, 0xffffff); vein(cx + d * (ar + 20), 150, d < 0 ? Math.PI * 1.25 : -Math.PI * .25, 30, 0xff8ad8, 0xffffff); }
    for (let k = 0; k < 6; k++) { const x = cx + (k < 3 ? -1 : 1) * (100 + (k % 3) * 18), y = 90 + (k % 3) * 34; F(x, y, 8, 5, mar); F(x, y, 8, 1, marHi); F(x + 1, y + 5, 6, 1, marDD); }
    // 위쪽은 차갑게 가라앉힌다 (천장 위 · 프리즈 쪽)
    c.save(); c.globalCompositeOperation = 'source-atop';
    const dk = c.createLinearGradient(0, 0, 0, 200); dk.addColorStop(0, 'rgba(20,24,60,.45)'); dk.addColorStop(1, 'rgba(20,24,60,0)'); c.fillStyle = dk; c.fillRect(0, 0, W, 200); c.restore();
  });
}
// 창기둥 안 1층 출입문: 대리석 아치 안에서 천관산의 눈빛이 비치는 작은 시공의 문 (나가면 정문 앞 성역)
function spearInnerGateArt(scene) {
  const W = 64, H = 80, cx = W / 2, mar = 0xbcb8d0, marD = 0x8884a6, marHi = 0xe0dcee;
  return canvasTex(scene, 'prop:spearinner', W, H, (F, c) => {
    const g = c.createRadialGradient(cx, 48, 2, cx, 50, 34); g.addColorStop(0, '#e8f0ff'); g.addColorStop(.3, '#a8c0f0'); g.addColorStop(.7, '#5a74c0'); g.addColorStop(1, '#1e1e48');
    c.fillStyle = g; c.beginPath(); c.moveTo(cx - 18, H); c.lineTo(cx - 18, 36); c.arc(cx, 36, 18, Math.PI, 0); c.lineTo(cx + 18, H); c.closePath(); c.fill();
    for (let k = 0; k < 14; k++) F(cx - 14 + (k * 7) % 28, 26 + (k * 11) % 50, 1, 1, 0xffffff, .9);   // 비쳐 드는 눈송이
    c.strokeStyle = css(mar); c.lineWidth = 7; c.beginPath(); c.moveTo(cx - 22, H); c.lineTo(cx - 22, 36); c.arc(cx, 36, 22, Math.PI, 0); c.lineTo(cx + 22, H); c.stroke();
    c.strokeStyle = css(marHi); c.lineWidth = 1; c.beginPath(); c.arc(cx, 36, 26, Math.PI, 0); c.stroke();
    F(cx - 5, 8, 10, 8, mar); F(cx - 2, 10, 4, 4, 0xe8c860);
    for (const x of [0, W - 8]) { F(x, 20, 8, H - 20, mar); F(x, 20, 2, H - 20, marHi); F(x + 6, 20, 2, H - 20, marD); F(x - 1, 16, 10, 5, marD); }
  });
}
// 만년설: 드러난 지형 윗면을 덮는 눈 (16×7 · 흘러내린 자국) · 처마 고드름 · 푸른 얼음 절벽 결
function snowCapArt(scene, v) {
  return canvasTex(scene, `prop:snowcap:${v}`, 16, 7, F => {
    F(0, 1, 16, 3, 0xf4f8ff); F(0, 1, 16, 1, 0xffffff);
    for (let x = 0; x < 16; x += 2) F(x, 0, 2, ((x * 7 + v * 5) % 3) ? 1 : 0, 0xffffff);
    for (let x = (v * 5) % 6; x < 16; x += 6) F(x, 4, 2, 1 + ((x + v) % 3), 0xe0eaff);
    F(0, 3, 16, 1, 0xc8d8f0, .7);
  });
}
function icicleArt(scene, v) {
  const h = 6 + v * 3;
  return canvasTex(scene, `prop:icicle:${v}`, 5, h, F => { for (let y = 0; y < h; y++) { const w = Math.max(1, Math.round(4 * (1 - y / h))); F(2 - Math.floor(w / 2), y, w, 1, y % 3 ? 0xa8d8ff : 0xe8f6ff); } F(1, 0, 1, h - 2, 0xffffff, .8); });
}
function iceFaceArt(scene) {
  return canvasTex(scene, 'prop:iceface', 5, 16, F => { F(0, 0, 5, 16, 0x8ac8ff, .4); F(1, 0, 1, 16, 0xd8f0ff, .7); F(3, 2, 1, 10, 0x5aa0e8, .5); F(0, 0, 5, 1, 0xffffff, .8); });
}
// 협곡 능선의 고대 돌기둥 (배경): 푸른 잿빛 돌 · 이끼 대신 서리 · 위에 쌓인 눈 · 몇은 부러졌다
function ancientPillarArt(scene, h, broken) {
  const W = 40, H = h * 16, st = 0x7a8298;
  return canvasTex(scene, `prop:apillar:${h}:${broken ? 1 : 0}`, W, H + 10, (F, c) => {
    const top = broken ? 30 : 10;
    for (let y = top; y < H; y++) { const seg = Math.floor((H - y) / 26); F(6, y + 6, 28, 1, (H - y) % 26 === 0 ? shade(st, .55) : seg % 2 ? st : shade(st, .92)); F(6, y + 6, 3, 1, shade(st, 1.35)); F(30, y + 6, 4, 1, shade(st, .6)); }
    if (broken) { for (let x = 0; x < 28; x++) c.clearRect(6 + x, top + 6, 1, Math.round(3 + Math.abs(Math.sin(x * .9)) * 10)); }
    else { F(2, top, 36, 7, shade(st, 1.1)); F(2, top, 36, 1, 0xd8e0f0); F(0, top - 4, 40, 5, 0xf4f8ff); for (let k = 0; k < 4; k++) F(6 + k * 9, top + 7, 2, 5 + (k % 2) * 4, 0xa8d8ff); }
    for (let k = 0; k < 4; k++) { const y = top + 20 + k * (H - top - 30) / 4; F(6, y, 28, 2, 0xe8f0ff, .55); }   // 홈에 낀 서리
    F(2, H + 4, 36, 6, shade(st, .7)); F(0, H + 2, 40, 3, 0xf4f8ff);
    F(14, top + 30, 12, 10, shade(st, .8)); c.strokeStyle = 'rgba(138,200,255,.6)'; c.lineWidth = 1; c.beginPath(); c.arc(20, top + 35, 4, 0, Math.PI * 2); c.stroke();   // 새겨진 고대 문양
  });
}
// 창기둥 안: 흰 대리석 기둥(배경 · 금 가고 부러짐) · 바닥에 쓰러진 기둥 토막 · 맥동하는 금강(푸른) · 백옥(분홍) 결정 · 제단
function marbleColumnArt(scene, h, v) {
  const W = 36, H = h * 16, mar = 0xbcb8d0, marD = 0x8884a6, marHi = 0xe0dcee;
  return canvasTex(scene, `prop:mcol:${h}:${v}`, W, H + 8, (F, c) => {
    const top = v % 2 ? 24 : 12;
    F(4, top, 28, H - top, mar);
    for (let x = 7; x < 30; x += 5) { F(x, top, 2, H - top, marD, .6); F(x + 2, top, 1, H - top, marHi, .5); }
    F(4, top, 2, H - top, marHi); F(29, top, 3, H - top, 0x8a88a8, .6);
    if (v % 2) for (let x = 0; x < 28; x++) c.clearRect(4 + x, top, 1, Math.round(2 + Math.abs(Math.sin(x * 1.1 + v)) * 12));   // 부러진 꼭대기
    else { F(0, 4, 36, 8, mar); F(0, 4, 36, 1, marHi); for (let k = 0; k < 4; k++) { c.fillStyle = css(marD); c.beginPath(); c.moveTo(4 + k * 8, 20); c.quadraticCurveTo(8 + k * 8, 10, 12 + k * 8, 20); c.fill(); } }
    F(0, H, 36, 8, marD); F(0, H, 36, 1, mar);
    let x = 10 + (v * 5) % 14, y = top + 20; for (let s = 0; s < 24; s++) { F(x, y, 1, 2, 0x6a688c); x += (s + v) % 2 ? -1 : 1; y += 2; }
  });
}
function fallenDrumArt(scene, v) {
  const W = 46, H = 22, mar = 0xbcb8d0, marD = 0x8884a6;
  return canvasTex(scene, `prop:mdrum:${v}`, W, H, (F, c) => {
    F(2, 6, 38, 16, mar); for (let y = 8; y < 22; y += 4) F(2, y, 38, 1, marD, .7); F(2, 6, 38, 1, 0xe0dcee);
    c.fillStyle = css(0xa8a4c0); c.beginPath(); c.ellipse(40, 14, 5, 8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = css(marD); c.beginPath(); c.ellipse(40, 14, 3, 6, 0, 0, Math.PI * 2); c.stroke();
    if (v % 2) { F(0, 14, 12, 8, mar); F(0, 14, 12, 1, 0xe0dcee); F(-2 + 14, 18, 6, 4, marD); }
    for (let k = 0; k < 4; k++) F(6 + k * 9, 21, 6, 1, 0x6a688c);
  });
}
function spearCrystalArt(scene, kind) {
  const [a, b, hi] = kind === 'pink' ? [0xc83a8a, 0xff7ac8, 0xffe0f4] : [0x2a5ad8, 0x6aa8ff, 0xe0f0ff];
  return canvasTex(scene, `prop:scrystal:${kind}`, 22, 30, (F, c) => {
    const shard = (x, w, h, col) => { c.fillStyle = css(col); c.beginPath(); c.moveTo(x, 30); c.lineTo(x + w / 2, 30 - h); c.lineTo(x + w, 30); c.closePath(); c.fill(); };
    shard(0, 9, 16, a); shard(13, 9, 19, a); shard(5, 12, 30, b); F(10, 6, 2, 20, hi, .9); F(3, 18, 1, 8, hi, .6); F(17, 15, 1, 10, hi, .6);
  });
}
function spearAltarArt(scene) {
  const W = 220, H = 74, cx = W / 2, mar = 0xbcb8d0, marD = 0x8884a6, marHi = 0xe0dcee;
  return canvasTex(scene, 'prop:spearaltar', W, H, (F, c) => {
    for (let k = 0; k < 4; k++) { const w = 110 - k * 18, y = H - 8 - k * 8; F(cx - w, y, w * 2, 8, k % 2 ? mar : shade(mar, .95)); F(cx - w, y, w * 2, 1, marHi); F(cx - w, y + 7, w * 2, 1, marD); }
    F(cx - 22, 10, 44, 34, mar); F(cx - 22, 10, 44, 2, marHi); F(cx + 18, 10, 4, 34, marD);   // 가운데 제대
    c.strokeStyle = '#e8c860'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, 16); c.lineTo(cx + 9, 27); c.lineTo(cx, 38); c.lineTo(cx - 9, 27); c.closePath(); c.stroke();
    for (const [d, col] of [[-1, 0x6aa8ff], [1, 0xff7ac8]]) {   // 양옆 받침 위 금강옥 · 백옥
      const x = cx + d * 70; F(x - 8, 24, 16, 26, mar); F(x - 8, 24, 16, 1, marHi); F(x - 10, 20, 20, 5, marD);
      c.fillStyle = css(col); c.beginPath(); c.arc(x, 13, 8, 0, Math.PI * 2); c.fill(); F(x - 3, 8, 3, 3, 0xffffff);
    }
  });
}
// 깨어진 세계: 떠 있는 바위섬(배경) · 거꾸로 자란 수정 나무 · 거슬러 오르는 폭포 물줄기 · 차원 도약 수정 · 반물질의 왕좌
function floatRockArt(scene, v) {
  const W = 70, H = 46;
  return canvasTex(scene, `prop:frock:${v}`, W, H, (F, c) => {
    c.fillStyle = '#2a1a3e'; c.beginPath(); c.moveTo(4, 10); c.lineTo(66, 8); c.lineTo(56, 22); c.lineTo(38, 44 - v * 3); c.lineTo(20, 26); c.closePath(); c.fill();
    F(4, 7, 62, 4, 0x4a3a6a); F(4, 7, 62, 1, 0x8a6ac8);
    for (let k = 0; k < 4; k++) F(12 + k * 13 + v * 2, 4 - (k % 2) * 3, 3, 4 + (k % 2) * 3, k % 2 ? 0x6affe8 : 0xc08aff);
    for (let k = 0; k < 8; k++) F(14 + (k * 7) % 40, 14 + (k * 5) % 18, 3, 2, 0x3a2a54);
  });
}
function invTreeArt(scene, v) {
  const W = 36, H = 52;
  return canvasTex(scene, `prop:invtree:${v}`, W, H, (F, c) => {
    F(17, 0, 3, 30, 0x2a1a3a); F(17, 0, 1, 30, 0x5a3a7a);
    c.strokeStyle = '#2a1a3a'; c.lineWidth = 2;
    for (const [x0, y0, x1, y1] of [[18, 10, 6, 22], [19, 14, 30, 24], [18, 22, 10, 32], [19, 20, 26, 34]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    const leaf = (x, y, col) => { c.fillStyle = css(col); c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x + 4, y); c.lineTo(x, y + 10); c.closePath(); c.fill(); };   // 아래로 뾰족한 수정 잎
    for (const [x, y] of [[6, 22], [30, 24], [10, 32], [26, 34], [18, 30], [14, 40], [22, 42]]) leaf(x, y, (x + v) % 3 ? 0x8a4aff : 0x4affd8);
    for (const [x, y] of [[6, 24], [26, 36], [18, 32]]) F(x - 1, y, 2, 5, 0xffffff, .7);
  });
}
function revFallArt(scene) {
  return canvasTex(scene, 'prop:revfall', 12, 48, F => {
    for (let y = 0; y < 48; y++) { F(1, y, 10, 1, 0x3ad8e8, .35); if ((y * 7) % 11 < 3) F(2 + (y * 3) % 7, y, 2, 1, 0xd8ffff, .9); }
    F(0, 0, 1, 48, 0x8affff, .5); F(11, 0, 1, 48, 0x8affff, .5);
  });
}
function padCrystalArt(scene) {
  return canvasTex(scene, 'prop:padcrystal', 34, 24, (F, c) => {
    F(2, 20, 30, 4, 0x2a1a44); F(2, 20, 30, 1, 0x8a6ac8);
    const shard = (x, w, h, col) => { c.fillStyle = css(col); c.beginPath(); c.moveTo(x, 21); c.lineTo(x + w / 2, 21 - h); c.lineTo(x + w, 21); c.closePath(); c.fill(); };
    shard(3, 8, 9, 0x6a2ad8); shard(23, 8, 10, 0x6a2ad8); shard(10, 14, 18, 0xb070ff); F(16, 6, 2, 12, 0xf0e0ff);
    c.strokeStyle = '#8affe8'; c.lineWidth = 1; c.beginPath(); c.moveTo(13, 14); c.lineTo(17, 9); c.lineTo(21, 14); c.stroke();   // 위로 솟는 화살 문양
  });
}
function throneArt(scene) {
  const W = 150, H = 170, cx = W / 2;
  return canvasTex(scene, 'prop:throne', W, H, (F, c) => {
    for (const [d, h] of [[-1, 120], [1, 120], [-1, 80], [1, 80]]) {   // 등받이 뒤로 솟은 검붉은 반물질 가시
      const x = cx + d * (h > 100 ? 52 : 70);
      c.fillStyle = '#14060e'; c.beginPath(); c.moveTo(x - 9, H - 30); c.lineTo(x + d * 10, H - 30 - h); c.lineTo(x + 9, H - 30); c.closePath(); c.fill();
      c.strokeStyle = '#ff2a4a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, H - 34); c.lineTo(x + d * 10, H - 30 - h); c.stroke();
    }
    F(cx - 40, 30, 80, H - 60, 0x1a0a1e); F(cx - 40, 30, 80, 3, 0x6a2a4a); F(cx - 34, 38, 68, H - 74, 0x2a0e2a);   // 높은 등받이
    c.fillStyle = '#c8a040'; for (let k = 0; k < 6; k++) { const a = Math.PI + k / 5 * Math.PI; c.fillRect(cx + Math.cos(a) * 30 - 2, 52 + Math.sin(a) * 18, 4, 4); }   // 등받이의 금빛 고리 (기라티나의 금 장식)
    F(cx - 6, 46, 12, 12, 0xff2a4a); F(cx - 3, 49, 6, 6, 0xffa0b0);
    F(cx - 54, H - 48, 108, 14, 0x2a0e2a); F(cx - 54, H - 48, 108, 2, 0x8a3a5a);   // 앉는 자리
    for (const d of [-1, 1]) { F(cx + d * 54 - (d < 0 ? 0 : 12), H - 70, 12, 40, 0x1a0a1e); F(cx + d * 54 - (d < 0 ? 0 : 12), H - 72, 12, 3, 0xc8a040); }   // 팔걸이
    for (let k = 0; k < 3; k++) { const w = 70 - k * 0 + k * 14; F(cx - w, H - 30 + k * 10, w * 2, 10, k % 2 ? 0x1a0a1e : 0x241024); F(cx - w, H - 30 + k * 10, w * 2, 1, 0x6a2a4a); }   // 단
  });
}

// ---------------- 하나: 용나선탑 · 최종장: 천계 ----------------
// 용나선탑 1층 정문 (640×300): 나선 무늬를 새긴 백색 대리석 기단 · 흑과 백의 용이 양각된 초대형 기둥 · 화면 위 틀 밖으로 끝없이 뻗는 뾰족 아치 정문
function spiralGateArt(scene) {
  const W = 640, H = 300, cx = W / 2;
  const st = 0x6a6e80, stD = 0x464a5c, stDD = 0x2e3040, stHi = 0x9a9eb0, mar = 0xc8c4d4, marD = 0x9490a8, marHi = 0xe8e4f0, snow = 0xdfe6f6;
  return canvasTex(scene, 'prop:spiralgate', W, H, (F, c) => {
    let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // 뒤 벽: 탑 몸체의 거친 회청색 돌 (나선으로 감아 오르는 띠)
    F(0, 0, W, 256, st);
    for (let y = 6, k = 0; y < 256; y += 14, k++) { F(0, y, W, 1, stD); for (let x = (k % 2) * 20; x < W; x += 40) F(x, y, 1, 14, stD); }
    for (let k = 0; k < 7; k++) { const y0 = 20 + k * 36; c.strokeStyle = css(stHi); c.globalAlpha = .35; c.lineWidth = 6; c.beginPath(); c.moveTo(0, y0 + 30); c.lineTo(W, y0 - 10); c.stroke(); c.globalAlpha = 1; }   // 나선 띠
    // 정문: 위로 끝없이 뻗는 뾰족 아치 (꼭대기는 화면 틀 밖) · 안쪽은 나선 회랑의 빛 (왼쪽 백열 · 오른쪽 뇌전)
    const gw = 76, gb = 256;
    const ig = c.createLinearGradient(cx - gw, 0, cx + gw, 0); ig.addColorStop(0, '#fff0d0'); ig.addColorStop(.3, '#4a3a3a'); ig.addColorStop(.5, '#141220'); ig.addColorStop(.7, '#1a2a4a'); ig.addColorStop(1, '#8ac0ff');
    c.fillStyle = ig; c.beginPath(); c.moveTo(cx - gw, gb); c.lineTo(cx - gw, 60); c.quadraticCurveTo(cx - gw, -40, cx, -80); c.quadraticCurveTo(cx + gw, -40, cx + gw, 60); c.lineTo(cx + gw, gb); c.closePath(); c.fill();
    for (let k = 0; k < 9; k++) { const y = gb - 16 - k * 24, w = gw - 10 - k * 3; F(cx - w, y, w * 2, 3, 0x5a5468, .7); F(cx - w, y, w * 2, 1, 0xa8a0c0, .7); }   // 안쪽 나선 계단
    c.strokeStyle = css(mar); c.lineWidth = 12; c.beginPath(); c.moveTo(cx - gw - 6, gb); c.lineTo(cx - gw - 6, 60); c.quadraticCurveTo(cx - gw - 6, -46, cx, -88); c.quadraticCurveTo(cx + gw + 6, -46, cx + gw + 6, 60); c.lineTo(cx + gw + 6, gb); c.stroke();
    c.strokeStyle = css(marHi); c.lineWidth = 1; c.beginPath(); c.moveTo(cx - gw - 12, gb); c.lineTo(cx - gw - 12, 60); c.quadraticCurveTo(cx - gw - 12, -52, cx, -96); c.quadraticCurveTo(cx + gw + 12, -52, cx + gw + 12, 60); c.lineTo(cx + gw + 12, gb); c.stroke();
    for (let y = 70; y < gb; y += 22) for (const d of [-1, 1]) F(cx + d * (gw + 6) - 6, y, 12, 2, marD);   // 아치 테 돌 이음매
    // 흑과 백의 용이 양각된 초대형 기둥 (왼쪽 셋 = 검은 용 제크로무 · 오른쪽 셋 = 하얀 용 레시라무)
    const dragon = (x, w, dark) => {
      const body = dark ? 0x2a2c3a : 0xf0ecf4, rim = dark ? 0x4a8aff : 0xff9a4a, eye = dark ? 0xff3a3a : 0x4ab0ff;
      c.strokeStyle = css(body); c.lineWidth = 7; c.beginPath();
      for (let t = 0; t <= 1.001; t += .02) { const y = 230 - t * 220, xx = x + w / 2 + Math.sin(t * Math.PI * 3) * (w * .32); if (t === 0) c.moveTo(xx, y); else c.lineTo(xx, y); }
      c.stroke();
      c.strokeStyle = css(rim); c.lineWidth = 1; c.stroke();
      const hx = x + w / 2 + Math.sin(Math.PI * 3) * (w * .32);
      F(hx - 7, 6, 14, 10, body); F(hx - 3, 9, 3, 2, eye); F(hx - 9, 2, 4, 6, body); F(hx + 5, 2, 4, 6, body);   // 머리 · 뿔
      for (let k = 0; k < 6; k++) { const t = .1 + k * .14, y = 230 - t * 220, xx = x + w / 2 + Math.sin(t * Math.PI * 3) * (w * .32); F(xx + (k % 2 ? 4 : -9), y, 5, 3, body); }   // 날개 · 비늘 돌기
    };
    const pillar = (x, w, dark) => {
      F(x, 0, w, 240, mar); F(x, 0, 3, 240, marHi); F(x + w - 5, 0, 5, 240, marD);
      for (let y = 0; y < 240; y += 30) F(x, y, w, 2, marD, .6);
      dragon(x, w, dark);
      F(x - 6, 228, w + 12, 12, marD); F(x - 6, 228, w + 12, 2, marHi); F(x - 8, 224, w + 16, 4, snow);
    };
    for (const [x, d] of [[10, 1], [104, 1], [190, 1]]) { pillar(x, 52, true); pillar(W - x - 52, 52, false); }
    // 나선 무늬를 새긴 백색 대리석 기단 (256 → 300) · 넓게 퍼지는 계단
    F(0, 252, W, 48, marD); F(0, 252, W, 3, marHi);
    for (let k = 0; k < 7; k++) { const y = 258 + k * 6, w = 110 + k * 30; F(cx - w, y, w * 2, 6, k % 2 ? mar : shade(mar, .94)); F(cx - w, y, w * 2, 1, marHi); for (let x = cx - w; x < cx + w; x += 5) F(x, y - 1, 5, 1 + Math.round(rnd()), snow, .9); }
    for (let k = 0; k < 40; k++) { const t = k / 40 * Math.PI * 4, x = 60 + k * 13, y = 276 + Math.sin(t) * 8; F(x, y, 6, 2, marHi, .6); }   // 기단의 나선 새김
    // 위쪽은 차갑게 가라앉힌다 · 검은 번개 자국
    c.save(); c.globalCompositeOperation = 'source-atop';
    const dk = c.createLinearGradient(0, 0, 0, 180); dk.addColorStop(0, 'rgba(14,16,40,.5)'); dk.addColorStop(1, 'rgba(14,16,40,0)'); c.fillStyle = dk; c.fillRect(0, 0, W, 180); c.restore();
    for (const x0 of [cx - 150, cx + 150]) { let x = x0, y = 40; for (let s = 0; s < 22; s++) { F(x - 1, y, 3, 4, 0x0a0a18); F(x, y, 1, 4, 0x6a8aff); x += (rnd() - .5) * 8; y += 4; } }
  });
}
// 용나선탑 안 1층 출입문: 돌 아치 안에 설원의 은빛 (나가면 고대 다리 끝 정문 앞)
function spiralInnerGateArt(scene) {
  const W = 64, H = 80, cx = W / 2, st = 0x8a8ea0, stD = 0x5a5e70;
  return canvasTex(scene, 'prop:spiralinner', W, H, (F, c) => {
    const g = c.createLinearGradient(0, 20, 0, H); g.addColorStop(0, '#d8e4f8'); g.addColorStop(1, '#6a80b0');
    c.fillStyle = g; c.beginPath(); c.moveTo(cx - 18, H); c.lineTo(cx - 18, 30); c.quadraticCurveTo(cx, 6, cx + 18, 30); c.lineTo(cx + 18, H); c.closePath(); c.fill();
    for (let k = 0; k < 14; k++) F(cx - 14 + (k * 7) % 28, 24 + (k * 11) % 52, 1, 1, 0xffffff, .9);
    c.strokeStyle = css(st); c.lineWidth = 7; c.beginPath(); c.moveTo(cx - 22, H); c.lineTo(cx - 22, 30); c.quadraticCurveTo(cx, 0, cx + 22, 30); c.lineTo(cx + 22, H); c.stroke();
    for (const x of [0, W - 8]) { F(x, 18, 8, H - 18, st); F(x + 6, 18, 2, H - 18, stD); }
  });
}
// 탑 안 벽: 왼쪽 = 진실의 백열 불꽃 화로 · 오른쪽 = 이상의 푸른 뇌전 코일
function whiteFireArt(scene) {
  return canvasTex(scene, 'prop:whitefire', 14, 26, F => {
    F(2, 16, 10, 4, 0x6a6470); F(1, 15, 12, 2, 0x9a94a8); F(5, 20, 4, 6, 0x4a4450);
    F(4, 6, 6, 10, 0xffe0b0); F(5, 2, 4, 8, 0xfff8e8); F(6, 0, 2, 4, 0xffffff); F(3, 9, 1, 5, 0xffd090); F(10, 8, 1, 5, 0xffd090);
  });
}
function voltCoilArt(scene) {
  return canvasTex(scene, 'prop:voltcoil', 12, 26, F => {
    F(5, 8, 2, 18, 0x4a5068); for (let y = 10; y < 22; y += 3) F(3, y, 6, 1, 0x8a90a8);
    F(3, 0, 6, 8, 0x3a6aff); F(4, 1, 4, 6, 0x8ac8ff); F(5, 2, 2, 3, 0xffffff); F(2, 24, 8, 2, 0x2a2e40);
  });
}
// 열기 상승 기류 (16×32 반복): 붉은 아지랑이 결 · 피어오르는 불티
function heatArt(scene) {
  return canvasTex(scene, 'prop:heat', 16, 32, F => {
    for (let y = 0; y < 32; y++) { F(0, y, 16, 1, 0xff5a2a, .1 + (y % 8 < 4 ? .04 : 0)); F(3 + Math.round(Math.sin(y * .4) * 2), y, 1, 1, 0xffb070, .5); F(11 + Math.round(Math.cos(y * .3) * 2), y, 1, 1, 0xff8a4a, .45); }
    for (let k = 0; k < 4; k++) F(2 + k * 4, (k * 9) % 32, 1, 2, 0xffe0a0, .8);
  });
}
// 흑과 백의 제단 (용나선탑 꼭대기): 반은 검고 반은 흰 단 · 가운데 다크스톤 · 라이트스톤 받침
function spiralAltarArt(scene) {
  const W = 220, H = 70, cx = W / 2;
  return canvasTex(scene, 'prop:spiralaltar', W, H, (F, c) => {
    for (let k = 0; k < 4; k++) { const w = 110 - k * 18, y = H - 8 - k * 8; F(cx - w, y, w, 8, 0x2a2c3a); F(cx, y, w, 8, 0xe8e4f0); F(cx - w, y, w * 2, 1, 0x9a9eb0); }
    for (const [d, body, gem] of [[-1, 0x2a2c3a, 0x4a8aff], [1, 0xe8e4f0, 0xff9a4a]]) {
      const x = cx + d * 60; F(x - 9, 20, 18, 28, body); F(x - 11, 16, 22, 5, shade(body, 1.2));
      c.fillStyle = css(gem); c.beginPath(); c.arc(x, 10, 8, 0, Math.PI * 2); c.fill(); F(x - 3, 5, 3, 3, 0xffffff);
    }
    F(cx - 2, 8, 4, 30, 0x8a8ea0);
  });
}
// 천계: 빛의 유리 계단 칸 (16×6 반복 — 통과 발판 위에 덮는다)
function glassStepArt(scene) {
  return canvasTex(scene, 'prop:glassstep', 16, 6, F => { F(0, 0, 16, 6, 0xc8ecff, .45); F(0, 0, 16, 1, 0xffffff, .95); F(0, 5, 16, 1, 0x8ac0e8, .6); F(3, 2, 4, 1, 0xffffff, .7); F(11, 3, 2, 1, 0xffffff, .5); });
}
// 천계: 하늘로 비스듬히 뻗은 커다란 유리 계단 (배경)
function glassStairsArt(scene, dir) {
  const W = 220, H = 170;
  return canvasTex(scene, `prop:glassstairs:${dir}`, W, H, F => {
    for (let k = 0; k < 15; k++) { const x = dir > 0 ? k * 13 : W - 30 - k * 13, y = H - 12 - k * 11; F(x, y, 30, 5, 0xc8ecff, .38); F(x, y, 30, 1, 0xffffff, .8); F(x + 3, y + 5, 24, 3, 0x9ac8f0, .18); }
  });
}
// 시초의 성문 (640×300): 하늘 끝까지 솟은 백금색 기둥 · 화면 가득한 황금빛 천륜(아르세우스의 고리) · 한가운데 눈부신 빛의 문
function originGateArt(scene) {
  const W = 640, H = 300, cx = W / 2;
  const pt = 0xd8d4e4, ptD = 0xa8a4c0, ptHi = 0xffffff, gold = 0xffd870, goldD = 0xc8a040;
  return canvasTex(scene, 'prop:origingate', W, H, (F, c) => {
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#5a4e8e'); bg.addColorStop(.6, '#c8b0d0'); bg.addColorStop(1, '#f0e4d0');
    c.fillStyle = bg; c.fillRect(0, 0, W, 256);
    // 황금빛 천륜: 화면을 가득 채우는 큰 고리 + 네 개의 보석 + 빛살
    const ry = 118;
    for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; c.strokeStyle = 'rgba(255,230,160,.18)'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + Math.cos(a) * 60, ry + Math.sin(a) * 60); c.lineTo(cx + Math.cos(a) * 300, ry + Math.sin(a) * 300); c.stroke(); }
    c.strokeStyle = css(goldD); c.lineWidth = 16; c.beginPath(); c.arc(cx, ry, 168, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = css(gold); c.lineWidth = 10; c.beginPath(); c.arc(cx, ry, 168, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,250,230,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, ry, 162, 0, Math.PI * 2); c.stroke();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, x = cx + Math.cos(a) * 168, y = ry + Math.sin(a) * 168; c.fillStyle = css(gold); c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill(); c.fillStyle = css(k % 2 ? 0x6ad8ff : 0xff8ad8); c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill(); F(x - 3, y - 4, 3, 3, 0xffffff); }
    for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; const x = cx + Math.cos(a) * 196, y = ry + Math.sin(a) * 196; F(x - 4, y - 6, 8, 12, TYPE18[k], .7); F(x - 4, y - 6, 8, 1, 0xffffff, .8); }   // 18 플레이트
    // 백금색 기둥 (화면 위 틀 밖까지)
    const pillar = (x, w) => { F(x, 0, w, 244, pt); F(x, 0, 3, 244, ptHi); F(x + w - 5, 0, 5, 244, ptD); for (let fx = x + 8; fx < x + w - 6; fx += 7) F(fx, 0, 2, 244, ptD, .5); F(x - 6, 232, w + 12, 12, ptD); F(x - 6, 232, w + 12, 2, gold); F(x - 6, 18, w + 12, 6, gold, .8); };
    for (const x of [8, 96, 176]) { pillar(x, 46); pillar(W - x - 46, 46); }
    // 한가운데 빛의 문: 둥근 아치 안이 눈부시게 하얗다
    const dw = 70, top = 96, gb = 256;
    const lg = c.createRadialGradient(cx, 190, 4, cx, 190, 110); lg.addColorStop(0, '#ffffff'); lg.addColorStop(.4, '#fff4d0'); lg.addColorStop(.8, '#ffd890'); lg.addColorStop(1, '#c8a050');
    c.fillStyle = lg; c.beginPath(); c.moveTo(cx - dw, gb); c.lineTo(cx - dw, top + dw); c.arc(cx, top + dw, dw, Math.PI, 0); c.lineTo(cx + dw, gb); c.closePath(); c.fill();
    c.strokeStyle = css(gold); c.lineWidth = 8; c.beginPath(); c.moveTo(cx - dw - 4, gb); c.lineTo(cx - dw - 4, top + dw); c.arc(cx, top + dw, dw + 4, Math.PI, 0); c.lineTo(cx + dw + 4, gb); c.stroke();
    c.strokeStyle = css(ptHi); c.lineWidth = 1; c.beginPath(); c.arc(cx, top + dw, dw + 10, Math.PI, 0); c.stroke();
    // 기단 · 빛나는 계단
    F(0, 252, W, 48, ptD); F(0, 252, W, 3, gold);
    for (let k = 0; k < 7; k++) { const y = 258 + k * 6, w = 100 + k * 32; F(cx - w, y, w * 2, 6, k % 2 ? pt : shade(pt, .95)); F(cx - w, y, w * 2, 1, ptHi); }
    for (let k = 0; k < 7; k++) { const y = 258 + k * 6; F(cx - 30, y, 60, 6, 0xfff4d0, .5); }   // 계단 한가운데로 흘러내리는 빛
  });
}
const TYPE18 = [0xa8a878, 0xf08030, 0x6890f0, 0xf8d030, 0x78c850, 0x98d8d8, 0xc03028, 0xa040a0, 0xe0c068, 0xa890f0, 0xf85888, 0xa8b820, 0xb8a038, 0x705898, 0x7038f8, 0x705848, 0xb8b8d0, 0xee99ac];   // 18 타입 색 (플레이트)
// 시초의 방 결전장 바닥의 고대 문양 (320×46): 금빛 동심원 · 18 플레이트 자리
function originSigilArt(scene) {
  const W = 320, H = 46, cx = W / 2, cy = H / 2;
  return canvasTex(scene, 'prop:originsigil', W, H, (F, c) => {
    for (const [rx, ry, col, lw] of [[150, 20, '#ffd870', 3], [120, 16, '#fff0c0', 1], [86, 11, '#ffd870', 2], [40, 5, '#ffffff', 1]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.stroke(); }
    for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; F(cx + Math.cos(a) * 135 - 2, cy + Math.sin(a) * 18 - 1, 5, 3, TYPE18[k]); }
    c.strokeStyle = 'rgba(255,230,150,.7)'; c.lineWidth = 1;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 5); c.lineTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 16); c.stroke(); }
  });
}
// 설화시티 습지: 잔잔한 물 (64×6 반복)
function stillWaterArt(scene) {
  return canvasTex(scene, 'prop:stillwater', 64, 6, F => { F(0, 1, 64, 5, 0x8ab8e0, .45); F(0, 1, 64, 1, 0xe8f4ff, .8); for (let x = 3; x < 64; x += 11) F(x, 3, 5, 1, 0xffffff, .6); });
}
// ---------------- 가라르: 너클시티 지하 에너지 플랜트 · 블랙나이트의 심장 ----------------
// 플랜트 최종 격리 게이트 (640×300): 리벳 박힌 강철 벽 · 화면 위 틀 밖으로 뻗는 검붉은 다이맥스 파이프 · 한가운데 거대한 방폭문(경고 줄무늬 · 비상등) · 문 위 원형 에너지 코어 창 · 홀로그램 경고판
function plantGateArt(scene) {
  const W = 640, H = 300, cx = W / 2;
  const steel = 0x4a4650, steelD = 0x2e2a34, steelHi = 0x7a7684, red = 0xd82a4a, redD = 0x7a1424, hazard = 0xe8b020;
  return canvasTex(scene, 'prop:plantgate', W, H, (F, c) => {
    // 강철 벽 (판 이음매 · 리벳)
    F(0, 0, W, 256, steelD);
    for (let y = 0; y < 256; y += 32) for (let x = (y / 32 % 2) * 40; x < W; x += 80) { F(x + 1, y + 1, 78, 30, steel); F(x + 1, y + 1, 78, 1, steelHi); F(x + 1, y + 30, 78, 1, 0x1e1a24); for (const [rx, ry] of [[4, 4], [74, 4], [4, 26], [74, 26]]) F(x + rx, y + ry, 2, 2, steelHi); }
    // 다이맥스 파이프: 위 틀 밖에서 내려와 게이트로 모인다 (양옆 셋씩) · 맥박처럼 빛나는 이음매
    for (const [x, w] of [[20, 26], [70, 18], [112, 22], [W - 46, 26], [W - 88, 18], [W - 134, 22]]) {
      F(x, 0, w, 252, redD); F(x + 2, 0, w - 6, 252, red); F(x + 3, 0, 2, 252, 0xff8aa0, .7);
      for (let y = 20; y < 250; y += 46) { F(x - 3, y, w + 6, 8, steel); F(x - 3, y, w + 6, 1, steelHi); F(x + w / 2 - 2, y + 2, 4, 4, 0xff3a5a); }
    }
    // 원형 에너지 코어 창 (문 위): 검붉은 다이맥스 에너지가 소용돌이친다
    const ey = 78, er = 46;
    const g = c.createRadialGradient(cx, ey, 4, cx, ey, er); g.addColorStop(0, '#ffffff'); g.addColorStop(.25, '#ff8aa0'); g.addColorStop(.6, '#d81a40'); g.addColorStop(1, '#2a0610');
    c.fillStyle = g; c.beginPath(); c.arc(cx, ey, er, 0, Math.PI * 2); c.fill();
    c.strokeStyle = css(steelHi); c.lineWidth = 8; c.beginPath(); c.arc(cx, ey, er + 5, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = css(hazard); c.lineWidth = 2; c.beginPath(); c.arc(cx, ey, er + 10, 0, Math.PI * 2); c.stroke();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; F(cx + Math.cos(a) * (er + 5) - 4, ey + Math.sin(a) * (er + 5) - 4, 8, 8, steel); }
    c.strokeStyle = 'rgba(255,240,240,.6)'; c.lineWidth = 1;
    for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(cx + Math.cos(k) * 6, ey + Math.sin(k) * 6); c.lineTo(cx + Math.cos(k * 1.7) * er * .85, ey + Math.sin(k * 1.7) * er * .85); c.stroke(); }   // 육각 결정 결
    // 거대한 방폭문 (두 쪽 · 가운데 틈으로 붉은 빛)
    const dx0 = cx - 110, dx1 = cx + 110, dt = 132, db = 254;
    F(dx0 - 14, dt - 14, dx1 - dx0 + 28, db - dt + 14, steelD); F(dx0 - 14, dt - 14, dx1 - dx0 + 28, 3, steelHi);
    for (const d of [-1, 1]) {
      const x0 = d < 0 ? dx0 : cx + 2, w = 108;
      F(x0, dt, w, db - dt, steel); F(x0, dt, w, 2, steelHi);
      for (let y = dt + 12; y < db; y += 26) F(x0 + 6, y, w - 12, 2, steelD);
      for (let k = 0; k < 9; k++) { const y = dt + 70 + k * 6; F(x0 + 4, y, w - 8, 3, k % 2 ? hazard : 0x1a1a20); }   // 경고 줄무늬
      F(x0 + (d < 0 ? w - 16 : 6), dt + 30, 10, 26, steelD); F(x0 + (d < 0 ? w - 14 : 8), dt + 32, 6, 22, 0x6a6474);   // 손잡이 · 잠금 장치
    }
    F(cx - 2, dt, 4, db - dt, 0xff2a4a); F(cx - 1, dt, 2, db - dt, 0xffd8e0);   // 틈으로 새는 붉은 빛
    for (const d of [-1, 1]) { const x = cx + d * 132; F(x - 7, dt - 6, 14, 14, 0x2a0610); F(x - 5, dt - 4, 10, 10, 0xff2a4a); F(x - 2, dt - 2, 4, 4, 0xffd0d8); }   // 비상등
    // 홀로그램 경고판
    for (const d of [-1, 1]) { const x = cx + d * 190 - 34; F(x, 150, 68, 40, 0x0a2a3a, .85); F(x, 150, 68, 1, 0x4af0ff); F(x, 189, 68, 1, 0x4af0ff); for (let k = 0; k < 5; k++) F(x + 6, 158 + k * 6, 30 + (k * 13) % 26, 2, k === 0 ? 0xff5a7a : 0x4af0ff, .8); }
    // 바닥 · 문턱 (강철 계단)
    F(0, 252, W, 48, 0x24202a); F(0, 252, W, 3, steelHi);
    for (let k = 0; k < 6; k++) { const y = 258 + k * 7, w = 130 + k * 34; F(cx - w, y, w * 2, 7, k % 2 ? steel : steelD); F(cx - w, y, w * 2, 1, steelHi); }
    for (let x = cx - 130; x < cx + 130; x += 14) F(x, 256, 7, 2, hazard);
    // 위쪽은 어둡게 가라앉힌다
    c.save(); c.globalCompositeOperation = 'source-atop';
    const dk = c.createLinearGradient(0, 0, 0, 160); dk.addColorStop(0, 'rgba(10,4,8,.55)'); dk.addColorStop(1, 'rgba(10,4,8,0)'); c.fillStyle = dk; c.fillRect(0, 0, W, 160); c.restore();
  });
}
// 블랙나이트의 심장 안 출입문 (나가면 격리 게이트 앞)
function plantInnerDoorArt(scene) {
  return canvasTex(scene, 'prop:plantinner', 56, 72, (F, c) => {
    F(0, 6, 56, 66, 0x2e2a34); F(4, 10, 48, 62, 0x4a4650); F(4, 10, 48, 1, 0x7a7684);
    F(8, 16, 40, 56, 0x1a0a10); F(26, 16, 4, 56, 0xff2a4a, .8); F(27, 16, 2, 56, 0xffd0d8, .8);
    for (let k = 0; k < 6; k++) F(8, 40 + k * 4, 40, 2, k % 2 ? 0xe8b020 : 0x1a1a20);
    F(22, 0, 12, 8, 0x2a0610); F(24, 2, 8, 4, 0xff2a4a);
  });
}
// 다이맥스 파이프 (32×12 반복 · 천장을 따라)
function pipeArt(scene) {
  return canvasTex(scene, 'prop:pipe', 32, 12, F => { F(0, 2, 32, 8, 0x7a1424); F(0, 3, 32, 5, 0xd82a4a); F(0, 4, 32, 1, 0xff8aa0, .7); F(0, 9, 32, 1, 0x3a0a14); F(26, 0, 6, 12, 0x4a4650); F(26, 0, 6, 1, 0x7a7684); F(28, 5, 2, 2, 0xff3a5a); });
}
// 홀로그램 패널 (26×18): 청록 글줄 · 붉은 경고 줄
function hologramArt(scene, v) {
  return canvasTex(scene, `prop:holo:${v}`, 26, 18, F => {
    F(0, 0, 26, 18, 0x0a3a4a, .55); F(0, 0, 26, 1, 0x6af8ff); F(0, 17, 26, 1, 0x6af8ff); F(0, 0, 1, 18, 0x6af8ff, .6); F(25, 0, 1, 18, 0x6af8ff, .6);
    for (let k = 0; k < 4; k++) F(3, 3 + k * 3.5, 8 + ((k * 7 + v * 5) % 14), 1, k === v % 4 ? 0xff5a7a : 0x8af8ff, .9);
    if (v % 2) { F(17, 4, 6, 6, 0xff3a5a, .7); F(19, 6, 2, 2, 0xffffff); } else { for (let x = 15; x < 24; x += 2) F(x, 12 - ((x * 3) % 7), 1, 2 + ((x * 3) % 7), 0x6af8ff, .8); }
  });
}
// 기밀 연구 일지 단말 (18×30): 받침대 위 떠 있는 홀로그램 판
function journalArt(scene) {
  return canvasTex(scene, 'prop:journal', 18, 30, F => {
    F(5, 20, 8, 10, 0x2e2a34); F(4, 19, 10, 2, 0x4a4650); F(7, 22, 4, 2, 0xff3a5a); F(3, 28, 12, 2, 0x24202a);
    F(1, 2, 16, 13, 0x0a3a4a, .7); F(1, 2, 16, 1, 0x6af8ff); F(1, 14, 16, 1, 0x6af8ff);
    for (let k = 0; k < 3; k++) F(3, 5 + k * 3, 10 - k * 2, 1, k ? 0x8af8ff : 0xff8aa0);
  });
}
// 레드를 가둔 검붉은 에너지 결정 기둥 (96×176): 뒷면(안쪽 빛) · 앞면(반투명 결정 면 — 레드 위에 덮는다)
function redCrystalArt(scene, front) {
  return canvasTex(scene, front ? 'prop:redcrystal:f' : 'prop:redcrystal:b', 96, 176, (F, c) => {
    const pts = [[48, 0], [84, 34], [90, 150], [70, 176], [26, 176], [6, 150], [12, 34]];
    c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
    if (!front) {
      const g = c.createLinearGradient(0, 0, 0, 176); g.addColorStop(0, '#5a0a20'); g.addColorStop(.5, '#a01a3a'); g.addColorStop(1, '#3a0614');
      c.fillStyle = g; c.fill();
      const rg = c.createRadialGradient(48, 96, 4, 48, 96, 60); rg.addColorStop(0, 'rgba(255,170,190,.55)'); rg.addColorStop(1, 'rgba(255,60,100,0)'); c.fillStyle = rg; c.fill();
    } else {
      c.fillStyle = 'rgba(255,60,100,.28)'; c.fill();
      c.strokeStyle = 'rgba(255,190,205,.9)'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = 'rgba(255,220,230,.55)'; c.lineWidth = 1;
      for (const [x0, y0, x1, y1] of [[48, 0, 40, 176], [84, 34, 58, 176], [12, 34, 34, 176], [20, 70, 76, 60]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }   // 결정 면의 모서리
      F(20, 20, 4, 60, 0xffffff, .35); F(70, 50, 3, 40, 0xffffff, .25);   // 반사광
    }
  });
}
// 세로 다이맥스 파이프 (12×32 반복 · 벽을 타고 내려온다)
function vpipeArt(scene) {
  return canvasTex(scene, 'prop:vpipe', 12, 32, F => { F(2, 0, 8, 32, 0x7a1424); F(3, 0, 5, 32, 0xd82a4a); F(4, 0, 1, 32, 0xff8aa0, .7); F(9, 0, 1, 32, 0x3a0a14); F(0, 26, 12, 6, 0x4a4650); F(0, 26, 12, 1, 0x7a7684); F(5, 28, 2, 2, 0xff3a5a); });
}
// 회전 경고등 (10×8 · 천장에 매달린다)
function warnLampArt(scene) {
  return canvasTex(scene, 'prop:warnlamp', 10, 8, F => { F(3, 0, 4, 2, 0x4a4650); F(1, 2, 8, 5, 0x7a1424); F(2, 2, 6, 4, 0xff3a5a); F(3, 3, 2, 2, 0xffd0d8); F(0, 7, 10, 1, 0x2e2a34); });
}
// 증기 배출구 (14×6 · 바닥)
function ventArt(scene) {
  return canvasTex(scene, 'prop:vent', 14, 6, F => { F(0, 2, 14, 4, 0x2e2a34); F(0, 2, 14, 1, 0x7a7684); for (let x = 2; x < 13; x += 3) F(x, 3, 1, 3, 0x0a0608); F(5, 0, 4, 2, 0x4a4650); });
}

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
  depthOf(room) { return !room ? null : this.level.purified || room.trail || room.seaBridge || room.isPurified ? 0 : room.tower || room.pillar ? Math.min(.45, room.depth || 0) : room.depth; }   // 정화한 지방 · 방울로드는 맑다 · 방울탑 안은 은은하게

  lit(o) { if (this.webgl) o.setPipeline('Light2D'); this.objs.push(o); return o; }
  add(o) { this.objs.push(o); return o; }
  light(x, y, r, col, k) { if (!this.webgl) return null; const l = this.s.lights.addLight(x, y, r, col, k); this.lights.push(l); return l; }
  glow(x, y, sc, col, a, depth) { return this.add(this.s.add.image(x, y, 'glow').setBlendMode(ADD).setTint(col).setScale(sc).setAlpha(a).setDepth(depth)); }

  // ---------------- 땅 밀착 (Ground Snap) ----------------
  //  나무 · 풀숲 · 가로등 · 바위 · 비석 · 기둥 · 석상 · 울타리 · 상자 같은 땅에 서는 소품은 지형을 다 만든 뒤의 최종 grid 에서 발밑을 다시 잰다
  //  (World 는 지형을 깔자마자 그 자리 바닥 높이로 소품 자리를 정하는데, 그 뒤에 문 · 철창 구멍 · 사다리 우물 · 보물방 제단 다지기 · 결전장이
  //   바닥을 깎거나 돋운다 — 예전엔 처음 잰 높이에 그대로 그려 허공에 뜨거나 땅에 파묻혔다. 비석은 방 기본 바닥 높이에 고정이라 구덩이 위에 떴다)
  //  · 발 폭: 그림의 맨 아래 불투명 줄(뿌리 · 받침 · 기둥 밑동)이 걸친 타일 열 전부 (footOf)
  //  · 열마다 처음 잰 줄 둘레에서 수직으로 '디딜 바닥 윗면'(단단한 땅 'S' · 바로 위 칸은 땅이 아니다)을 찾는다 (Tile Raycast Down — surfaceRow)
  //  · 발 폭의 모든 열이 같은 높이의 바닥을 디딜 때만 그 윗면 + GROUND_SINK 에 그림의 맨 아래 픽셀을 맞춘다 (standY)
  //  · 한 열이라도 구덩이 · 낭떠러지 · 단차 · 좁은 발판 끝이면 장식은 심지 않는다 (상호작용 소품은 처음 자리 그대로)
  footOf(key) {
    if (FOOT.has(key)) return FOOT.get(key);
    let f = null;
    try {
      const tex = this.s.textures.get(key), fr = tex.get(), src = tex.getSourceImage(), cv = document.createElement('canvas');
      cv.width = fr.cutWidth; cv.height = fr.cutHeight;
      const c = cv.getContext('2d'); c.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
      const d = c.getImageData(0, 0, cv.width, cv.height).data, W = cv.width;
      for (let y = cv.height - 1; y >= 0 && !f; y--) {
        let l = -1, r = -1;
        for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; }
        if (l >= 0) f = { pad: cv.height - 1 - y, l, r, w: W };
      }
      if (!f) f = { pad: 0, l: 0, r: W - 1, w: W };
    } catch (e) { const fr = this.s.textures.getFrame(key); f = { pad: 0, l: 0, r: (fr ? fr.width : 16) - 1, w: fr ? fr.width : 16 }; }
    FOOT.set(key, f);
    return f;
  }
  // c 열에서 row0 둘레(위 up 칸 · 아래 down 칸)의 가장 가까운 디딜 바닥 윗면 줄 · 없으면 null (구덩이 · 낭떠러지)
  surfaceRow(c, row0, up = 4, down = 4, plat = false) {
    const G = this.level.grid, ok = y => G[y] && (G[y][c] === 'S' || (plat && G[y][c] === 'P')) && G[y - 1] && G[y - 1][c] !== 'S' && G[y - 1][c] !== 'B';
    for (let k = 0; k <= Math.max(up, down); k++) {
      if (k <= down && ok(row0 + k)) return row0 + k;
      if (k && k <= up && ok(row0 - k)) return row0 - k;
    }
    return null;
  }
  // 픽셀 L ~ R 이 걸친 열이 모두 같은 높이의 바닥을 디디면 그 줄 · 아니면 null (단차 · 턱 끝 · 구덩이)
  //  o.plat: 통과 발판도 바닥으로 (출입문) · o.low: 열마다 높이가 조금(1칸) 달라도 가장 낮은 바닥에 맞춘다 — 지형보다 뒤에 그려지는 큰 장식만
  //   (높은 칸 쪽 밑동은 앞에 그려지는 바닥 타일이 가려 땅에 박힌 듯 보인다 — 결전장 단상의 제단)
  groundRow(L, R, row0, up = 4, down = 4, o = {}) {
    let row = null, lo = null;
    for (let c = Math.floor((L + 1) / TILE); c <= Math.floor((R - 1) / TILE); c++) {
      const y = this.surfaceRow(c, row0, up, down, o.plat);
      if (y === null) return null;
      if (row === null) row = lo = y;
      else if (y !== row && !o.low) return null;
      lo = Math.max(lo, y); row = Math.min(row, y);
    }
    if (o.low && lo - row > (o.spread ?? 1)) return null;
    return o.low ? lo : row;
  }
  // 아래 끝 기준(origin y 1) 그림을 세울 y: 발 폭을 재고 땅 줄을 찾아 '바닥 윗면 + sink' 에 그림의 맨 아래 불투명 픽셀이 오게 — 땅이 없으면 null
  //  this.groundY 에 찾은 바닥 윗면(px)을 남긴다 (곁들이는 빛 · 덩굴 자리를 맞출 때)
  standY(key, x, ox, row0, o = {}) {
    const f = this.footOf(key), sc = o.scale ?? 1;
    let l = f.l, r = f.r;
    if (o.flip) { l = f.w - 1 - f.r; r = f.w - 1 - f.l; }
    const left = x - ox * f.w * sc, row = this.groundRow(left + l * sc, left + (r + 1) * sc, row0, o.up ?? 4, o.down ?? 4, o);
    if (row === null) return null;
    this.groundY = row * TILE;
    return this.groundY + (o.sink ?? GROUND_SINK) + f.pad * sc;
  }

  // 가로로 조금씩 비켜 보며(xs 순서) 땅 밀착 자리를 찾는다 → { x, y } · 없으면 null (출입문 · 동굴 입구 외관처럼 꼭 세워야 하는 것)
  fitX(key, xs, ox, row0, o = {}) {
    for (const x of xs) { const y = this.standY(key, x, ox, row0, o); if (y !== null) return { x, y }; }
    return null;
  }
  // 기술머신 캡슐 받침이 놓인 자리보다 넓을 때: 허공에 걸친 받침 아래를 돌 기단으로 바닥까지 받친다 (발밑 칸마다 실제 바닥 윗면까지)
  plinth(key, x, Y, row) {
    const f = this.footOf(key), L = x - f.w / 2 + f.l, R = x - f.w / 2 + f.r + 1, g = this.add(this.s.add.graphics().setDepth(5.97));
    for (let c = Math.floor((L + 1) / TILE); c <= Math.floor((R - 1) / TILE); c++) {
      const y = this.surfaceRow(c, row, 0, 5);
      if (y === null || y === row) continue;
      const x0 = Math.max(L, c * TILE), x1 = Math.min(R, (c + 1) * TILE), bot = y * TILE + 2;
      g.fillStyle(0x1e1e2c, 1); g.fillRect(x0, Y - 1, x1 - x0, bot - Y + 1);
      g.fillStyle(0x34364a, 1); g.fillRect(x0 + 1, Y, x1 - x0 - 2, bot - Y - 1);
      g.fillStyle(0xd8a63a, .7); g.fillRect(x0 + 1, Y + 2, x1 - x0 - 2, 1);   // 금테
      for (let yy = Y + 7; yy < bot - 2; yy += 6) { g.fillStyle(0x1e1e2c, .9); g.fillRect(x0 + 1, yy, x1 - x0 - 2, 1); }   // 돌 마디
    }
  }

  // ✨ 샛길 구역 정화 (GameScene.purifySideRoom): 그 방의 시든 나무를 햇살 받은 푸른 나무로 · 풀을 연둣빛으로 · 붉은 포자를 반딧불이로 ·
  //  바닥 균열 · 숲의 붉은 안광을 걷어 낸다 — 방 하나만 다시 칠한다 (전체를 다시 지으면 부순 상자까지 되살아난다)
  repaintRoom(room) {
    const s = this.s, pal = this.stage.palette;
    for (const tr of this.trees || []) {
      if (tr.room !== room || !tr.img.scene) continue;
      const a = treeArt(s, this.si, tr.v, pal, 0), ox = a.baseX / a.W, y = tr.ground + GROUND_SINK + this.footOf(a.key).pad;
      tr.img.setTexture(a.key).setOrigin(ox, 1).setY(y);
      if (tr.emis) tr.emis.setVisible(false);
      this.pulses = this.pulses.filter(q => q.o !== tr.emis);
      for (const vi of tr.vines) vi.destroy();
      this.vines = this.vines.filter(v => !tr.vines.includes(v));
      const top = y - a.H, left = tr.img.x - a.baseX;
      tr.vines = a.vines.map((vn, k) => { const vi = this.lit(s.add.image(left + vn.x, top + vn.y - 1, a.vineKeys[k]).setOrigin(.5, 0).setDepth(4.2)); vi.ph = Math.random() * 6; this.vines.push(vi); return vi; });
      for (const m of tr.motes) if (m.spore) { m.spore = false; m.setTint(0xe8f8e0).setScale(.09); }
      s.tweens.add({ targets: tr.img, alpha: { from: .4, to: 1 }, duration: 500 });
    }
    for (const g of this.grass) if (g.tall && g.room === room) g.setTint(0xe8ffc8);
    for (const v of this.veinList || []) if (v.room === room && v.img.scene) { this.pulses = this.pulses.filter(q => q.o !== v.img); s.tweens.add({ targets: v.img, alpha: 0, duration: 700, onComplete: () => v.img.setVisible(false) }); }
    for (const e of this.eyes) if (e.room === room) { e.gone = true; e.pair.forEach(o => o.setVisible(false)); }
  }

  build() {
    const s = this.s, p = this.stage.palette, metal = this.stage.plat === 'metal';
    this.wards = [];   // 기술머신 성역: 둘레에 일반 몹이 들어오지 못한다 (updateWards)
    for (const pr of [...this.level.props, ...(this.level.tmx || [])]) {   // tmx: 길목 기술머신 캡슐 (game/World.js 끝 — 샛길 제단과 같은 캡슐)
      if (pr.hide) continue;   // 방울탑 정문 앞 성역 마당에서 치운 장식 (game/World.js)
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
        case 'oakhouse': {   // 태초마을의 오박사 연구소: 하얀 벽 · 갈색 지붕 · 현판 · 문이 정면 → 들어가면 연구소 안 (GameScene.useDoor)
          const o = { w: pr.w, floors: pr.floors, side: pr.side, roof: 0x8a4a2a, wall: 0xece6d8, glass: 0xffd890, broken: false, burnt: false, ruined: false };
          const a = houseArt(s, `prop:oakhouse:${pr.w}:${pr.floors}:${pr.side}`, o), x = X - 48;
          this.lit(s.add.image(x, Y, a.body).setOrigin(0, 1).setDepth(5));
          this.add(s.add.image(x, Y, a.emis).setOrigin(0, 1).setDepth(5.1));
          a.winX.forEach((wx, i) => { for (let f = 0; f < a.floors; f++) if (a.lit[i][f]) this.glow(x + wx + 5, Y - 48 * f - 30, .45, o.glass, .35, 5.2); });
          // 현판 (지붕 처마 바로 아래 가운데)
          const cx = x + 48 + pr.w * 8, sy = Y - 3 * pr.floors * 16 + 12, board = this.add(s.add.graphics().setDepth(5.15));
          board.fillStyle(0x3a2418, 1); board.fillRect(cx - 34, sy - 7, 68, 13); board.fillStyle(0x6a4428, 1); board.fillRect(cx - 33, sy - 6, 66, 11);
          this.add(s.add.text(cx, sy, '오박사 연구소', { fontFamily: 'Galmuri9', fontSize: '9px', color: '#ffe8b0', stroke: '#2a1810', strokeThickness: 2, resolution: 1 }).setOrigin(.5).setDepth(5.2));
          const dl = x + a.doorX, d = this.door(dl, Y, 14, 26, 0x6a4428, false, 5.05);
          this.interacts.push({ kind: 'door', side: 'out', x: dl + 7, y: Y, range: 14, used: false, repeat: true, prompt: '[F 또는 ↑ : 오박사 연구소에 들어가기]', promptY: Y - 40, door: d });
          break;
        }
        case 'labdoor': {   // 오박사 연구소 안 출입문 (뒤 벽) → 마을의 연구소 건물 앞
          const w = 24, h = 44, x = X - 4;
          this.lit(s.add.image(x - 4, Y, labDoorFrameArt(s, w, h)).setOrigin(0, 1).setDepth(2.75));
          const d = this.door(x, Y, w, h, 0x9a6a3e, true, 2.8);
          this.lit(s.add.image(x + w / 2, Y, matArt(s)).setOrigin(.5, 1).setDepth(10.4));
          this.interacts.push({ kind: 'door', side: 'in', x: x + w / 2, y: Y, range: 18, used: false, repeat: true, prompt: '[F 또는 ↑ : 밖으로 나가기]', promptY: Y - h - 18, door: d });
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
        case 'mart': {   // 포켓샵: 정문 앞에서 F / ↑ / 터치 → 상점 창 (GameScene.openShop)
          const a = martArt(s, pr.w), x = X - 16;
          this.lit(s.add.image(x, Y, a.body).setOrigin(0, 1).setDepth(5));
          const emis = this.add(s.add.image(x, Y, a.emis).setOrigin(0, 1).setDepth(5.1));
          const sy = Y - a.TH + a.signY;
          const sign = this.glow(x + a.mid, sy, 1.1, 0x6ab0ff, .75, 5.2).setScale(1.5, .7);
          const lightObj = this.light(x + a.mid, sy + 8, 150, 0xc0e0ff, 1.5);
          this.light(x + a.mid, Y - 18, 100, 0x8ad0ff, 1);
          this.pulses.push({ o: sign, base: .7, amp: .15, sp: 2.2 });
          this.interacts.push({ kind: 'mart', x: x + a.mid, y: Y, range: 22, used: false, repeat: true, room, prompt: '🛒 포켓샵 입장 (F / 터치)', emis, lightObj, promptY: Y - 50 });
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
          const warm = pr.warm || village, a = lampArt(s, warm), x = X + 1, ly = this.standY(a.body, x, 0, pr.g);
          if (ly === null) break;   // 땅 밀착: 발밑이 구덩이 · 단차면 세우지 않는다
          const Y = this.groundY;
          // 1번 도로의 가로등은 절반쯤 쓰러져 꺼져 있다
          if (area && area.bg === 'road' && Math.random() < .55) {
            this.lit(s.add.image(x + 4, Y + 1, a.body).setOrigin(.5, 1).setRotation(Math.random() < .5 ? 1.42 : -1.42).setDepth(7));
            break;
          }
          this.lit(s.add.image(x, ly, a.body).setOrigin(0, 1).setDepth(7));
          const em = this.add(s.add.image(x, ly, a.emis).setOrigin(0, 1).setDepth(7.1));
          const col = warm ? WARM : p.light;
          const g = this.glow(x + 7, Y - a.H + 8, .9, col, .55, 7.2);
          const l = this.light(x + 7, Y - a.H + 12, warm ? 150 : 120, col, warm ? 1.5 : 1.1);
          if (village) this.flickers.push({ objs: [g, em], base: [.55, 1], light: l, lightK: 1.5, t: 0, off: 0 });
          else this.s.tweens.add({ targets: g, alpha: { from: .4, to: .6 }, duration: 1200 + Math.random() * 800, yoyo: true, repeat: -1 });
          break;
        }
        case 'tree': {
          // 고밀도 픽셀 고목 + 늘어진 덩굴(흔들림) + 균열 맥동 + 떨어지는 포자·피어오르는 반딧불이
          const rm = roomAtCell(this.level, pr.x, pr.g - 1), stage = depthStage(this.depthOf(rm));   // 입구 쪽은 푸르고, 보스방 쪽은 시들어 검붉다
          const v = (pr.x * 7 + pr.g) % 4, a = treeArt(s, this.si, v, p, stage), x = X + 24, ty = this.standY(a.key, x, a.baseX / a.W, pr.g);
          if (ty === null) break;   // 발밑이 구덩이 · 단차 · 턱 끝이면 심지 않는다 (땅 밀착)
          const top = ty - a.H, left = x - a.baseX, gy = this.groundY;
          const tr = { room: rm, v, ground: gy, img: this.lit(s.add.image(x, ty, a.key).setOrigin(a.baseX / a.W, 1).setDepth(4)), emis: null, vines: [], motes: [] };
          (this.trees = this.trees || []).push(tr);
          if (a.emis) { const e = tr.emis = this.add(s.add.image(x, ty, `${a.key}:e`).setOrigin(a.baseX / a.W, 1).setDepth(4.1)); this.pulses.push({ o: e, base: .5, amp: .3, sp: 1.2 + Math.random() * .8 }); }   // 균열이 숨 쉬듯 은은하게
          a.vines.forEach((vn, k) => { const vi = this.lit(s.add.image(left + vn.x, top + vn.y - 1, a.vineKeys[k]).setOrigin(.5, 0).setDepth(4.2)); vi.ph = Math.random() * 6; this.vines.push(vi); tr.vines.push(vi); });
          for (let k = 0; k < 4; k++) {
            const cl = a.canopy[Math.floor(Math.random() * a.canopy.length)], spore = k < 2;
            const m = this.add(s.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(spore ? 0xa82a4a : 0xe8f8e0).setScale(spore ? .07 : .09).setDepth(24));
            Object.assign(m, { spore, hx: left + cl.x, hy: top + cl.y, gy, life: Math.random(), sp: .06 + Math.random() * .06, ph: Math.random() * 6 });
            this.motes.push(m); tr.motes.push(m);
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
        case 'labroom': {   // 오박사 연구소 안: 방 뒤 벽 전체 + 따뜻한 천장 등
          const a = labRoomArt(s, pr.w, pr.h);
          this.lit(s.add.image(X, Y, a.body).setOrigin(0, 1).setDepth(2.6));
          const e = this.add(s.add.image(X, Y, a.emis).setOrigin(0, 1).setDepth(2.7));
          this.flickers.push({ objs: [e], base: [1], t: 0, off: 0, rate: .25 });
          const fk = labFloorArt(s);
          for (let x = pr.x; x < pr.x + pr.w; x++) if (this.level.grid[pr.g][x] === 'S') this.lit(s.add.image(x * TILE, Y, fk).setOrigin(0).setDepth(10.3));   // 마룻바닥 (철창 자리는 비운다)
          for (const lx of a.lamps) { this.light(X + lx, Y - a.H + 40, 260, 0xfff0d0, 1.5); const gl = this.glow(X + lx, Y - a.H + 30, .9, 0xfff0c0, .35, 2.75); this.pulses.push({ o: gl, base: .32, amp: .04, sp: 1.3 }); }
          break;
        }
        case 'lore': {   // 비석: 땅 밀착 (땅을 못 찾으면 처음 자리 — 읽을 수 있어야 한다)
          const key = loreArt(s), sy = this.standY(key, X + 8, .5, pr.g, { up: 6, down: 6 }), Y = sy === null ? pr.g * TILE : this.groundY;
          this.lit(s.add.image(X + 8, sy ?? Y + 1, key).setOrigin(.5, 1).setDepth(7));
          const mark = this.glow(X + 8, Y - 26, .25, 0xd8c8ff, .4, 7.3);
          this.pulses.push({ o: mark, base: .35, amp: .2, sp: 2 });
          this.interacts.push({ kind: 'lore', x: X + 8, y: Y, range: 16, used: false, repeat: true, text: pr.text, prompt: '[F 또는 ↑ : 읽기]', promptY: Y - 34 });
          break;
        }
        case 'journal': {   // 가라르 지하 플랜트의 기밀 연구 일지: 받침대 위 홀로그램 단말 → F / ↑ 로 열람 (대화창 — GameScene.readJournal)
          const x = X + 8, key = journalArt(s), sy = this.standY(key, x, .5, pr.g, { up: 6, down: 6 }), Y = sy === null ? pr.g * TILE : this.groundY;
          this.lit(s.add.image(x, sy ?? Y + 1, key).setOrigin(.5, 1).setDepth(7));
          const h = this.glow(x, Y - 22, .5, 0x6af8ff, .45, 7.3);
          this.pulses.push({ o: h, base: .4, amp: .2, sp: 2.4 });
          this.light(x, Y - 22, 90, 0x6af8ff, 1.1);
          this.add(s.add.text(x, Y - 32, `기밀 연구 일지 ${pr.no}`, { fontFamily: 'Galmuri9', fontSize: '8px', color: '#8af8ff', stroke: '#0a1a24', strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(7.2));
          this.interacts.push({ kind: 'journal', no: pr.no, x, y: Y, range: 18, used: false, repeat: true, text: pr.text, prompt: '[F 또는 ↑ : 기밀 연구 일지 열람]', promptY: Y - 44 });
          break;
        }
        case 'signpost': { const fl = Math.random() < .5, key = signpostArt(s), sy = this.standY(key, X + 8, .5, pr.g, { flip: fl }); if (sy !== null) this.lit(s.add.image(X + 8, sy, key).setOrigin(.5, 1).setDepth(7).setFlipX(fl)); break; }
        case 'tm': {   // 샛길 끝의 거대 기술머신 캡슐 (다가가면 공명해 에너지 기둥이 솟고, F / ↑ 로 작동 → 캡슐이 열리며 카드 3장)
          const a = tmArt(s), x = X + 8, fit = this.standY(a.base, x, .5, pr.g, { sink: 0, up: 6, down: 6 }), mid = fit === null ? this.surfaceRow(Math.floor(x / TILE), pr.g, 6, 6) : null;
          const Y = fit !== null ? this.groundY : mid !== null ? mid * TILE : pr.g * TILE;   // 땅 밀착: 제단 윗면
          if (fit === null && mid !== null) this.plinth(a.base, x, Y, mid);   // 받침이 자리보다 넓다 → 허공에 걸친 쪽을 돌 기단으로
          const sigil = this.add(s.add.image(x, Y - 1, a.sigil).setBlendMode(ADD).setScale(1, .26).setAlpha(.55).setDepth(5.9));
          this.lit(s.add.image(x, Y, a.base).setOrigin(.5, 1).setDepth(6));
          const glass = this.add(s.add.image(x, Y - 16, a.glass).setOrigin(.5, 1).setDepth(6.05).setAlpha(.9));
          const beam = this.add(s.add.image(x, Y - 70, 'glow').setBlendMode(ADD).setTint(0xb08aff).setScale(.5, 3).setAlpha(.14).setDepth(6.1));
          const halo = this.glow(x, Y - 42, 1.1, 0x9a5aff, .55, 6.2);
          const coreG = this.glow(x, Y - 42, .55, 0xffd25a, .7, 6.25);
          const disc = this.add(s.add.image(x, Y - 42, a.disc).setDepth(6.3));
          this.lit(s.add.image(x, Y - 14, a.frame).setOrigin(.5, 1).setDepth(6.5));
          const cap = this.lit(s.add.image(x, Y - 73, a.cap).setOrigin(.5, 1).setDepth(6.6));
          const l = this.light(x, Y - 42, 190, 0xb08aff, 2.1);
          s.tweens.add({ targets: [disc, halo, coreG], y: '-=6', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });   // 둥둥
          s.tweens.add({ targets: disc, scaleX: { from: 1, to: .15 }, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });   // 천천히 돈다
          s.tweens.add({ targets: coreG, scale: { from: .45, to: .7 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });   // 맥동
          this.pulses.push({ o: halo, base: .5, amp: .2, sp: 3 }, { o: sigil, base: .45, amp: .2, sp: 1.6 });
          // 🛡️ 기술머신 성역: 바닥에 은은한 금빛 고리 · 일반 몹은 좌우 WARD_R 안으로 들어오지 못하고 밀려난다 (보스 · 엘리트 수문장은 그대로)
          const floor = this.add(s.add.image(x, Y - 1, 'glow').setBlendMode(ADD).setTint(0xffe8a0).setScale(WARD_R / 22, .32).setAlpha(.32).setDepth(5.85));
          this.pulses.push({ o: floor, base: .28, amp: .1, sp: 1.2 });
          this.wards.push({ x, y: Y, pr, floor, t: 0 });
          const it = { kind: 'tm', pr, x, y: Y, range: 30, used: false, prompt: '[F 또는 ↑ : 기술머신 가동]', promptY: Y - 92, disc, halo, beam, core: coreG, cap, glass, sigil, lightObj: l, near: false };
          this.interacts.push(it);
          if (pr.used) this.markUsed(it);
          break;
        }        case 'sidesign': {   // 마을 끝 샛길 갱도 옆 표지
          this.lit(s.add.image(X + 8, Y + 1, sideSignArt(s)).setOrigin(.5, 1).setDepth(7));
          const mark = this.glow(X + 8, Y - 22, pr.tutorial ? .6 : .35, pr.tutorial ? 0xffd27a : 0x9ad8ff, .5, 7.3);
          this.pulses.push({ o: mark, base: .35, amp: .25, sp: 2.5 });
          // 튜토리얼(첫 입구 바로 아래 기술머신): 아래에서 금빛이 새어 나오고, 샛길 탐험이 핵심이라는 안내
          if (pr.tutorial) { const up = this.add(s.add.image(X + 72, Y - 4, 'glow').setBlendMode(ADD).setTint(0xffd27a).setScale(1.4, .5).setAlpha(.5).setDepth(5.8)); this.pulses.push({ o: up, base: .45, amp: .25, sp: 2 }); }
          this.interacts.push({ kind: 'hint', x: X + 64, y: Y, range: pr.tutorial ? 46 : 34, used: false, repeat: true,
            prompt: pr.tutorial ? '↓ + Space : 아래 굴의 기술머신으로! (샛길·막다른 길 끝엔 늘 보상이 있다)' : '↓ + Space : 샛길로 내려가기 (기술머신)', promptY: Y - 30 });
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
          const fl = Math.random() < .5, key = tallGrassArt(s, this.si, p), gy = this.standY(key, X + 16, .5, pr.g, { flip: fl });
          if (gy === null) break;   // 땅 밀착: 턱 끝 · 구덩이 위엔 두지 않는다
          const g = this.lit(s.add.image(X + 16, gy, key).setOrigin(.5, 1).setDepth(13.5).setFlipX(fl));
          const gr = roomAtCell(this.level, pr.x, pr.g - 1), gst = depthStage(this.depthOf(gr));
          if (gst === 2) g.setTint(0xc07a7a); else if (gst === 0) g.setTint(0xe8ffc8);   // 시든 풀은 검붉게 · 초입은 햇살 받은 연두빛
          g.ph = Math.random() * 6; g.tall = true; g.room = gr; this.grass.push(g);
          break;
        }
        case 'pillar': { const key = pillarArt(s, pr.h, pr.variant), y = this.standY(key, X + 16, .5, pr.g, { sink: 6 }); if (y !== null) this.lit(s.add.image(X + 16, y, key).setOrigin(.5, 1).setDepth(6)); break; }
        case 'statue': { const key = statueArt(s, p, this.si), y = this.standY(key, X + 16, .5, pr.g); if (y !== null) this.lit(s.add.image(X + 16, y, key).setOrigin(.5, 1).setDepth(7)); break; }
        case 'fence': { const key = fenceArt(s, pr.w, metal), y = this.standY(key, X, 0, pr.g); if (y !== null) this.lit(s.add.image(X, y, key).setOrigin(0, 1).setDepth(7)); break; }
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
            const bird = this.lit(s.add.sprite(cx, Y, 'px').setDepth(6.6));   // 기본 텍스처 키는 없다 — 바로 Idle 애니메이션 프레임으로
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
          const key = crateArt(s), x = X + 8, by = this.standY(key, x, .5, pr.stacked ? pr.g + 1 : pr.g);   // 땅 밀착 (쌓인 상자는 아래 상자 위에)
          if (by === null) break;
          const y = pr.stacked ? by - 14 : by;
          const img = this.lit(s.add.image(x, y, key).setOrigin(.5, 1).setDepth(15));
          this.crates.push({ img, x, y: y - 7, alive: true });
          break;
        }
      }
    }
    // 간이 포켓몬 회복기 (World.terminals): 다가가면 자동 저장 + 부활 자리 · F / ↑ 로 파티 전원 회복
    (this.level.terminals || []).forEach((tm, i) => {
      const x = tm.x * TILE + 16, Y = tm.g * TILE;
      const pad = this.add(s.add.image(x, Y - 1, 'glow').setBlendMode(ADD).setTint(0x4affd8).setScale(1.6, .3).setAlpha(.5).setDepth(5.9));
      this.lit(s.add.image(x, Y + 1, terminalArt(s)).setOrigin(.5, 1).setDepth(6.4));
      const holo = this.glow(x, Y - 30, .8, 0x7dffb0, .45, 6.5);
      const beam = this.add(s.add.image(x, Y - 50, 'glow').setBlendMode(ADD).setTint(0x4affd8).setScale(.36, 2.2).setAlpha(.22).setDepth(6.3));   // 멀리서도 보이는 청록 빛기둥
      const l = this.light(x, Y - 26, 150, 0x6affc8, 1.6);
      // 표지판: 청록 판에 하얀 회복 십자 (옆 바닥이 있는 쪽) + 머리 위 '회복기' 글자
      const G = this.level.grid, ok = tx => G[tm.g] && (G[tm.g][tx] === 'S' || G[tm.g][tx] === 'B') && G[tm.g - 1][tx] === '.' && G[tm.g - 2][tx] === '.';
      const sx = ok(tm.x - 2) ? x - 30 : ok(tm.x + 3) ? x + 30 : null;
      if (sx !== null) { this.lit(s.add.image(sx, Y + 1, termSignArt(s)).setOrigin(.5, 1).setDepth(6.4)); this.pulses.push({ o: this.glow(sx, Y - 22, .35, 0x4affd8, .5, 6.5), base: .35, amp: .2, sp: 2 }); }
      this.add(s.add.text(x, Y - 62, '간이 회복기', { fontFamily: 'Galmuri9', fontSize: '9px', color: '#7dffd8', stroke: '#0a1a1c', strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(6.6));
      this.pulses.push({ o: holo, base: .4, amp: .18, sp: 2.2 }, { o: pad, base: .4, amp: .15, sp: 1.4 });
      this.shelter(tm, x, Y, sx);
      this.interacts.push({ kind: 'terminal', idx: i, data: tm, x, y: Y, range: 26, used: false, repeat: true, prompt: '[F 또는 ↑ : 간이 회복기]', promptY: Y - 50, holo, beam, lightObj: l, near: false });
    });
    this.buildSurfaceDecor();
    this.buildVeins();
    this.buildRails();
    this.buildFireflies();
    this.buildAtmosphere();
    this.buildBellTower();
    this.buildHoenn();
    this.buildSinnoh();
    this.buildHeroes();
    this.buildGalar();
    this.groupByRoom();
  }

  // 성도 방울탑: 방울로드(단풍 가로수 · 낙엽 깔개 · 흩날리는 낙엽 · 밝은 가을 햇살) · 탑 입구 외관 · 탑 안 벽 횃불 (방 표시는 game/World.js)
  buildBellTower() {
    const s = this.s, rooms = this.level.rooms, G = this.level.grid;
    const floorAt = (tx, ty) => G[ty] && (G[ty][tx] === 'S' || G[ty][tx] === 'P') && G[ty - 1] && G[ty - 1][tx] === '.';
    this.leafRooms = rooms.filter(r => r.trail);
    for (const r of this.leafRooms) {
      const Y = r.F * TILE;
      // 단풍 가로수: 길을 따라 촘촘히 (은행나무 · 홍단풍 번갈아)
      for (let x = r.left + 30, k = 0; x < r.right - 30; x += 64 + (k * 17) % 22, k++) {
        if (r.trailEnd && x > r.doorTx * TILE - 360) continue;   // 방울탑 정문 외관 앞은 비워 둔다
        const a = autumnTree(s, k % 4), sc = k % 2 ? .9 : 1, ty = this.standY(a.key, x, a.baseX / a.W, r.F, { scale: sc });
        if (ty === null) continue;   // 땅 밀착: 뿌리가 구덩이 · 턱 끝에 걸리면 심지 않는다
        this.lit(s.add.image(x, ty, a.key).setOrigin(a.baseX / a.W, 1).setDepth(3.6 + (k % 2) * .2).setScale(sc));
      }
      // 바닥에 수북한 낙엽
      for (let x = r.left + 4; x < r.right - 4; x += 3 + ((x * 7) % 4)) {
        const tx = Math.floor(x / TILE);
        if (!floorAt(tx, r.F)) continue;
        const leaf = this.add(s.add.image(x, Y - 1 + ((x * 13) % 3) * .5, leafArt(s, (x * 5) % 3)).setOrigin(.5, 1).setDepth(10.3).setRotation(((x * 31) % 7) * .2).setAlpha(.95));
        if (r.trailEnd && x > r.doorTx * TILE - 300) leaf.setTint(lerpTint(0xffffff, 0x6a4a7a, Math.min(1, (x - r.doorTx * TILE + 300) / 200)));   // 정문 가까이 시든 잎
      }
      // 따스한 가을 햇살 줄기
      for (let x = r.left + 60; x < r.right; x += 160) if (!(r.trailEnd && x > r.doorTx * TILE - 420)) this.add(s.add.image(x, r.top + 10, 'glow').setOrigin(.5, 0).setBlendMode(ADD).setTint(0xffd8a0).setScale(1.2, 5).setAlpha(.12).setDepth(3.2).setAngle(-18));
      // 방울탑 입구 (방울로드 끝): 외관 + 금빛 풍경 반짝임 + 현판 빛
      if (r.trailEnd) {
        // 화면을 압도하는 거대한 1층 정면 (위층은 보이지 않는다 — 카메라가 방 천장 위 4칸까지만) — 정문 한가운데 = r.doorTx
        const gx = r.doorTx * TILE + 8, AW = 640, AH = 300;
        const art = bellGateArt(s), cutH = r.top - (Y + 2 - AH);
        this.lit(s.add.image(gx, Y + 2, art).setOrigin(.5, 1).setDepth(3.4));
        // 방 천장 위로 솟은 처마는 천장 바위 타일 앞에 그려 화면 위로 끝없이 이어지게 (보이는 4칸 남짓만)
        if (cutH > 0) { const c0 = Math.max(0, cutH - 88); this.lit(s.add.image(gx, Y + 2, art).setOrigin(.5, 1).setCrop(0, c0, AW, cutH - c0).setDepth(10.45)); }
        // 탑을 감싸는 검보라 장기 (처마 밑에 고여 천천히 일렁인다)
        for (let k = 0; k < 5; k++) {
          const fog = this.add(s.add.image(gx - 260 + k * 130, Y - 250 + (k % 2) * 30, 'glow').setTint(0x1a0624).setScale(5, 2.2).setAlpha(.45).setDepth(10.46));
          this.pulses.push({ o: fog, base: .4, amp: .12, sp: .4 + k * .13 });
        }
        this.add(s.add.text(gx, Y - 175, '鈴 塔 · 방울탑', { fontFamily: 'Galmuri9', fontSize: '9px', color: '#d8b8a0', stroke: '#2a1408', strokeThickness: 3, resolution: 1 }).setOrigin(.5).setDepth(3.5));
        // 정문 안쪽 등불빛 (숨 쉬듯 일렁인다) · 정문 앞 빛
        const inner = this.add(s.add.image(gx, Y - 50, 'glow').setBlendMode(ADD).setTint(0xffc070).setScale(3.2, 3.6).setAlpha(.4).setDepth(3.45));
        this.pulses.push({ o: inner, base: .2, amp: .08, sp: 1.3 });
        const miasma = this.add(s.add.image(gx, Y - 6, 'glow').setBlendMode(ADD).setTint(0x9a3aff).setScale(5, 1.2).setAlpha(.3).setDepth(10.35));   // 문턱의 보랏빛 장기
        this.pulses.push({ o: miasma, base: .26, amp: .14, sp: .8 });
        this.light(gx, Y - 60, 180, 0xffb060, .7);
        this.light(gx, Y - 30, 260, 0x9a3aff, 1.1);
        this.light(gx, Y - 150, 300, 0xb898d8, .3);
        // 정문 출입 (오박사 연구소처럼 ↑/F → 암전 → 탑 안 1층 출입문 앞)
        if (r.portalTo) this.interacts.push({ kind: 'door', pair: 'belltower', side: 'out', face: -1, x: gx, y: Y, range: 60, used: false, repeat: true, prompt: '[F 또는 ↑ : 방울탑 안으로 들어가기]', promptY: Y - 128, door: null, glowAt: { x: gx, y: Y - 50 } });
      }
    }
    // 탑 안 1층 출입문 (방울로드 정문으로 나간다): 붉은 옻칠 양개문 + 문틀 + 깔개
    for (const r of rooms.filter(q => q.portalFrom && !q.spear && !q.spiral && !q.origin && !q.plantHeart)) {   // 창기둥 안 출입문은 buildSinnoh · 용나선탑 · 시초의 방은 buildHeroes · 블랙나이트의 심장은 buildGalar
      const Y = (r.portalY ?? r.F) * TILE, w = 28, h = 46, x = r.left + 8;
      this.lit(s.add.image(x - 4, Y, labDoorFrameArt(s, w, h)).setOrigin(0, 1).setDepth(2.75));
      const d = this.door(x, Y, w, h, 0x9a2a1a, true, 2.8);
      this.lit(s.add.image(x + w / 2, Y, matArt(s)).setOrigin(.5, 1).setDepth(10.4));
      this.add(s.add.text(x + w / 2, Y - h - 8, '출구 · 방울로드', { fontFamily: 'Galmuri9', fontSize: '8px', color: '#ffe0a0', stroke: '#2a1408', strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(3.5));
      this.interacts.push({ kind: 'door', pair: 'belltower', side: 'in', face: 1, x: x + w / 2, y: Y, range: 20, used: false, repeat: true, prompt: '[F 또는 ↑ : 방울탑 밖으로 나가기]', promptY: Y - h - 22, door: d });
    }
    // 탑 안: 벽 횃불 · 등불이 일정 간격으로 (일렁이는 주황빛 + 불티) — 칠색조 옥상은 노을 하늘(GameScene.rooftopSky)
    this.wallTorches = [];
    for (const r of rooms.filter(q => q.tower && !q.rooftop)) {
      const Y = r.F * TILE;
      for (let x = r.left + 40; x < r.right - 30; x += 96) {
        const ty = Y - 46;
        if (r.portalFrom && x < r.left + 60) continue;   // 1층 출입문 자리
        if (s.isSolidAt(x, ty)) continue;
        this.lit(s.add.image(x, ty, wallTorchArt(s)).setOrigin(.5, 1).setDepth(6.2));
        const halo = this.add(s.add.image(x, ty - 12, 'glow').setBlendMode(ADD).setTint(0xffa040).setScale(1.1).setAlpha(.5).setDepth(6.3));
        const L = this.light(x, ty - 12, 150, 0xffa040, 1.7);
        this.flickers.push({ objs: [halo], base: [.5], rate: .35, light: L, lightK: 1.7, off: 0 });
        this.wallTorches.push({ x, y: ty - 12 });
      }
    }
  }
  // 호연: 가뭄 길(일식 · 용암 균열 · 대지의 동굴 입구) · 폭우 해안(발밑 바닷물 · 해저동굴 입구) · 131번 수로(밤바다 · 달 · 오로라 · 돌다리 · 하늘기둥 외관)
  //  · 하늘기둥 안(갈라진 벽 틈 채광 · 발광 수정) — 빗줄기 · 번개 · 화산재는 GameScene.updateWeather
  buildHoenn() {
    const s = this.s, rooms = this.level.rooms, G = this.level.grid;
    const floorAt = (tx, ty) => G[ty] && (G[ty][tx] === 'S' || G[ty][tx] === 'P') && G[ty - 1] && G[ty - 1][tx] === '.';
    this.crystalLights = [];
    for (const r of rooms) {
      const Y = r.F * TILE, W = r.right - r.left;
      if (r.drought) {
        // 일식: 검은 해와 주황 코로나 (먼 하늘)
        const ex = r.cx + W * .2, ey = r.top + 50;
        this.add(s.add.image(ex, ey, 'glow').setBlendMode(ADD).setTint(0xff6a1a).setScale(2.4).setAlpha(.7).setDepth(1.75));
        this.add(s.add.image(ex, ey, 'glow').setTint(0x000000).setScale(.9).setAlpha(1).setDepth(1.76));
        // 바닥 용암 균열: 바닥선을 따라 빛나는 금
        for (let x = r.left + 20; x < r.right - 20; x += 46 + ((x * 7) % 30)) {
          const tx = Math.floor(x / TILE);
          if (!floorAt(tx, r.F)) continue;
          const crack = this.add(s.add.image(x, Y + 1, 'glow').setBlendMode(ADD).setTint(0xff5a1a).setScale(.8, .12).setAlpha(.85).setDepth(10.35));
          this.pulses.push({ o: crack, base: .6, amp: .3, sp: 1.5 + (x % 5) * .2 });
        }
        if (r.magmaGate) {
          const key = magmaCaveArt(s), at = this.fitX(key, [0, -16, -32, -48, -64, -96, -128, -160, -192, -224, -256, -288, -320, -352, -384].map(d => r.right - 100 + d), .5, r.F, { sink: 2, up: 3, down: 2, low: true, spread: 3 }), gx = at ? at.x : r.right - 100;
          this.lit(s.add.image(gx, at ? at.y : Y + 2, key).setOrigin(.5, 1).setDepth(3.4));
          const glow = this.add(s.add.image(gx, Y - 30, 'glow').setBlendMode(ADD).setTint(0xff6a1a).setScale(2.4, 2).setAlpha(.5).setDepth(3.45));
          this.pulses.push({ o: glow, base: .45, amp: .2, sp: 1.2 });
          this.add(s.add.text(gx, Y - 134, '대지의 동굴', { fontFamily: 'Galmuri9', fontSize: '9px', color: '#ffb080', stroke: '#2a0806', strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(3.5));
          this.light(gx, Y - 30, 200, 0xff6a2a, 1.8);
        }
      }
      if (r.rain) {
        // 발밑 바닷물: 바닥선을 따라 출렁이는 물결 (GameScene 이 tilePosition 을 흘린다)
        const w = this.add(s.add.tileSprite(r.left, Y - 3, W, 10, waveArt(s)).setOrigin(0, 0).setDepth(10.4).setAlpha(.75));
        (this.waves = this.waves || []).push(w);
        if (r.seaGate) {
          const key = seaCaveArt(s), at = this.fitX(key, [0, -16, -32, -48, -64, -96, -128, -160, -192, -224, -256, -288, -320, -352, -384].map(d => r.right - 100 + d), .5, r.F, { sink: 2, up: 3, down: 2, low: true, spread: 3 }), gx = at ? at.x : r.right - 100;
          this.lit(s.add.image(gx, at ? at.y : Y + 2, key).setOrigin(.5, 1).setDepth(3.4));
          const glow = this.add(s.add.image(gx, Y - 40, 'glow').setBlendMode(ADD).setTint(0x4affd0).setScale(2, 1.6).setAlpha(.35).setDepth(3.45));
          this.pulses.push({ o: glow, base: .3, amp: .15, sp: .9 });
          this.add(s.add.text(gx, Y - 134, '해저동굴', { fontFamily: 'Galmuri9', fontSize: '9px', color: '#8affe0', stroke: '#04121a', strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(3.5));
          this.light(gx, Y - 40, 180, 0x4affd0, 1.4);
        }
      }
      if (r.seaBridge) {
        // 에메랄드빛 밤바다 · 거대한 달 · 수평선 위 초록 오로라 (방 뒤 먼 하늘)
        //  방이 세로로 길어도 수평선은 다리 바로 위(바닥 70px 위)에 오도록 방 높이마다 그라데이션을 따로 굽는다
        const H = r.bottom - r.top, hz = Math.max(.3, (Y - 70 - r.top) / H), key = 'fx:emeraldsea:' + H + ':' + Math.round(hz * 100);
        if (!s.textures.exists(key)) {
          const t = s.textures.createCanvas(key, 4, 256), c = t.getContext(), g = c.createLinearGradient(0, 0, 0, 256);
          g.addColorStop(0, '#020812'); g.addColorStop(hz * .6, '#062030'); g.addColorStop(hz - .02, '#0e4a4a'); g.addColorStop(hz, '#3a9a7a');
          g.addColorStop(Math.min(1, hz + .01), '#0e5a56'); g.addColorStop(1, '#06302e');
          c.fillStyle = g; c.fillRect(0, 0, 4, 256); t.refresh();
        }
        this.add(s.add.image(r.left, r.top + 3, key).setOrigin(0).setDisplaySize(W, H).setDepth(1.65));
        for (let k = 0; k < 40; k++) this.add(s.add.image(r.left + ((k * 89) % 997) / 997 * W, Y - 90 - ((k * 53) % 409) / 409 * Math.min(420, Y - r.top - 100), 'px').setTint(k % 4 ? 0xffffff : 0xa8ffe0).setScale(k % 5 ? .5 : 1).setAlpha(.7).setDepth(1.66));   // 별
        // 거대한 달 (수평선 위) + 수면에 비친 달빛
        const mx = r.left + W * .28, my = Y - 170;
        this.add(s.add.image(mx, my, 'glow').setBlendMode(ADD).setTint(0xb8ffe8).setScale(4).setAlpha(.4).setDepth(1.7));
        this.add(s.add.image(mx, my, 'glow').setTint(0xf4fff8).setScale(1.6).setAlpha(1).setDepth(1.71));
        this.add(s.add.image(mx + 5, my - 4, 'glow').setTint(0xd0e8e0).setScale(.4).setAlpha(.5).setDepth(1.715));   // 달 표면 무늬
        const shine = this.add(s.add.image(mx, Y - 40, 'glow').setBlendMode(ADD).setTint(0xd8fff0).setScale(.5, 1.6).setAlpha(.35).setDepth(1.73));
        this.pulses.push({ o: shine, base: .3, amp: .12, sp: 1.4 });
        for (let k = 0; k < 5; k++) {   // 수평선 위 초록 오로라 (델타스트림 기운)
          const au = this.add(s.add.image(r.left + W * (.1 + k * .2), Y - 120 - (k % 2) * 22, 'glow').setBlendMode(ADD).setTint(k % 2 ? 0x4affb0 : 0x8affd8).setScale(3.4, .7).setAlpha(.32).setDepth(1.72));
          s.tweens.add({ targets: au, scaleY: 1.2, alpha: .16, x: au.x + 24, duration: 3000 + k * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        // 다리 난간 + 다리 아래 부서지는 파도 포말
        this.add(s.add.tileSprite(r.left, Y - 10, W, 10, bridgeRailArt(s)).setOrigin(0, 0).setDepth(10.35));
        const w = this.add(s.add.tileSprite(r.left, Y + 10, W, 10, waveArt(s)).setOrigin(0, 0).setDepth(10.6).setAlpha(.85));
        (this.waves = this.waves || []).push(w);
        // 하늘기둥 외관 (다리 끝)
        const gx = r.right - 70;
        this.lit(s.add.image(gx, Y + 2, skyPillarArt(s)).setOrigin(.5, 1).setDepth(3.4));
        const rune = this.add(s.add.image(gx, Y - 74, 'glow').setBlendMode(ADD).setTint(0xffe080).setScale(.6).setAlpha(.6).setDepth(3.45));
        this.pulses.push({ o: rune, base: .45, amp: .35, sp: 2 });   // 델타 룬 맥동 (황금 ↔ 에메랄드는 updateHoenn)
        this.runes = (this.runes || []).concat(rune);
        for (let k = 0; k < 4; k++) this.add(s.add.image(gx + (k - 1.5) * 26, Y - 270 + (k % 2) * 10, 'glow').setTint(0xe8f4f0).setScale(2.4, .6).setAlpha(.75).setDepth(3.5));   // 꼭대기를 가리는 구름
        this.add(s.add.text(gx, Y - 290, '하늘기둥', { fontFamily: 'Galmuri9', fontSize: '9px', color: '#a8ffe0', stroke: '#04121a', strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(3.55));
        this.light(gx, Y - 80, 160, 0x4affb0, .7);
      }
      if (r.pillar) {
        // 갈라진 외벽 틈으로 드는 창백한 빛줄기 · 벽에 박힌 초록 발광 수정
        for (let x = r.left + 50; x < r.right; x += 130) this.add(s.add.image(x, r.top + 6, 'glow').setOrigin(.5, 0).setBlendMode(ADD).setTint(0xe0fff4).setScale(1, 5.5).setAlpha(.16).setDepth(3.3).setAngle(-14));
        for (let x = r.left + 30, k = 0; x < r.right - 20; x += 84, k++) {
          const y = Y - 34 - (k % 3) * 22;
          if (s.isSolidAt(x, y)) continue;
          this.lit(s.add.image(x, y, pillarCrystalArt(s)).setOrigin(.5, 1).setDepth(6.2));
          const h = this.add(s.add.image(x, y - 6, 'glow').setBlendMode(ADD).setTint(0x4affb0).setScale(.7).setAlpha(.5).setDepth(6.3));
          this.pulses.push({ o: h, base: .45, amp: .2, sp: 1 + (k % 3) * .4 });
          if (k % 2 === 0) this.light(x, y - 6, 120, 0x4affb0, 1.2);
        }
      }
    }
  }

  // 신오: 천관산 만년설 협곡(지형마다 쌓인 눈 · 고드름 · 푸른 얼음 절벽 · 능선의 고대 돌기둥) · 창기둥 정문 외관(정문 앞 성역) · 창기둥 안(흰 대리석 기둥 · 쓰러진 기둥 토막 · 맥동하는 금강 · 백옥 결정 · 제단)
  //  · 제단 뒤 차원 균열(펄기아까지 정화하면 열린다 — openRift) · 깨어진 세계(떠 있는 바위 · 거꾸로 자란 수정 나무 · 거슬러 오르는 폭포 · 차원 도약 수정 · 유령 발판 · 반물질의 왕좌)
  //  방 표시는 game/World.js (snowPeak · spearGate · spear · spearAltar · distortion · throne) · 하늘 · 눈발 · 밝기는 GameScene
  buildSinnoh() {
    const s = this.s, G = this.level.grid;
    const solid = (x, y) => G[y] && (G[y][x] === 'S' || G[y][x] === 'B'), empty = (x, y) => G[y] && G[y][x] === '.';
    const floorRow = (r, tx) => { for (let y = r.F; y > r.ty0; y--) if (solid(tx, y) && empty(tx, y - 1) && empty(tx, y - 2)) return y; return null; };   // 방 바닥 쪽에서 가장 가까운 디딜 면
    const label = (x, y, text, color, stroke) => this.add(s.add.text(x, y, text, { fontFamily: 'Galmuri9', fontSize: '9px', color, stroke, strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(3.5));
    this.revFalls = []; this.pads = []; this.phase = []; this.rift = null;
    for (const r of this.level.rooms) {
      const Y = r.F * TILE;
      if (r.snowPeak || r.icirrus) {   // 천관산 만년설 협곡 · 설화시티 겨울 습지
        // 드러난 지형 윗면마다 만년설 (가로로 이어진 줄마다 한 장) · 턱 · 천장 아래 고드름 · 지형 옆면의 푸른 얼음
        for (let ty = r.ty0 - 1; ty <= r.F; ty++) {
          let run = null;
          for (let tx = r.tx0; tx <= r.tx1; tx++) {
            const top = tx < r.tx1 && solid(tx, ty) && empty(tx, ty - 1);
            if (top && !run) run = tx;
            if (!top && run !== null) { this.add(s.add.tileSprite(run * TILE, ty * TILE - 1, (tx - run) * TILE, 7, snowCapArt(s, (run + ty) % 3)).setOrigin(0, 0).setDepth(10.3)); run = null; }
            if (tx >= r.tx1 || !solid(tx, ty)) continue;
            if (empty(tx, ty + 1) && (tx * 5 + ty * 3) % 4 === 0) this.add(s.add.image(tx * TILE + 8, (ty + 1) * TILE, icicleArt(s, (tx + ty) % 3)).setOrigin(.5, 0).setDepth(10.3).setAlpha(.9));
            if (ty > r.ty0 && ty < r.F && tx > r.tx0 && tx < r.tx1 - 1) {
              if (empty(tx - 1, ty)) this.add(s.add.image(tx * TILE, ty * TILE, iceFaceArt(s)).setOrigin(0, 0).setDepth(10.25));
              if (empty(tx + 1, ty)) this.add(s.add.image(tx * TILE + TILE - 5, ty * TILE, iceFaceArt(s)).setOrigin(0, 0).setDepth(10.25).setFlipX(true));
            }
          }
        }
        // 능선의 고대 돌기둥 (배경 · 정문 앞 성역은 비운다) · 설산의 찬 빛 (천관산만)
        if (r.snowPeak) for (let x = r.left + 80, k = 0; x < r.right - 50; x += 190 + (k * 37) % 80, k++) {
          if (r.spearGate && x > r.doorTx * TILE - 360) continue;
          const tx = Math.floor(x / TILE), base = floorRow(r, tx);
          if (base === null) continue;
          const h = Math.min(8, base - r.ty0 - 2);
          const key = h >= 3 ? ancientPillarArt(s, h, k % 3 === 1) : null, py = key && this.standY(key, x, .5, base, { sink: 4, up: 0, down: 0 });
          if (py) this.lit(s.add.image(x, py, key).setOrigin(.5, 1).setDepth(3.6));   // 땅 밀착: 밑동 전체가 같은 높이를 디딜 때만
        }
        if (r.snowPeak) this.light(r.cx, r.top + 30, Math.max(300, (r.right - r.left) * .6), 0xd8e8ff, .5);
      }
      if (r.spearGate) {
        // 창기둥 정문 (협곡 끝 성역): 화면을 압도하는 열주 · 대정문 (정문 한가운데 = r.doorTx) — 방 천장 위로 솟은 열주는 천장 바위 앞에 그려 화면 위로 끝없이 이어지게
        const gx = r.doorTx * TILE + 8, AW = 640, AH = 300, art = spearGateArt(s), cutH = r.top - (Y + 2 - AH), vy = Y + 2 - AH + 182;
        this.lit(s.add.image(gx, Y + 2, art).setOrigin(.5, 1).setDepth(3.4));
        if (cutH > 0) { const c0 = Math.max(0, cutH - 88); this.lit(s.add.image(gx, Y + 2, art).setOrigin(.5, 1).setCrop(0, c0, AW, cutH - c0).setDepth(10.45)); }
        // 대정문 안 시공의 소용돌이: 금강(푸른) · 백옥(분홍) 빛이 천천히 돌며 숨 쉬듯 일렁인다
        const swirl = this.add(s.add.image(gx, vy, 'glow').setBlendMode(ADD).setTint(0xb8a0ff).setScale(3, 3.4).setAlpha(.45).setDepth(3.45));
        const core = this.add(s.add.image(gx, vy - 6, 'glow').setBlendMode(ADD).setTint(0xffffff).setScale(1.1).setAlpha(.6).setDepth(3.46));
        this.pulses.push({ o: swirl, base: .4, amp: .12, sp: 1.1 }, { o: core, base: .5, amp: .2, sp: 2.3 });
        const ring = this.add(s.add.graphics().setDepth(3.47).setBlendMode(ADD).setPosition(gx, vy));
        for (let k = 0; k < 4; k++) {
          ring.lineStyle(2, k % 2 ? 0xff9ad8 : 0x8ac8ff, .55); ring.beginPath();
          for (let t = 0; t <= 1.001; t += .04) { const a = k * Math.PI / 2 + t * 4.4, rr = 8 + t * 62, x = Math.cos(a) * rr, y = Math.sin(a) * rr * .92; if (t === 0) ring.moveTo(x, y); else ring.lineTo(x, y); }
          ring.strokePath();
        }
        s.tweens.add({ targets: ring, angle: 360, duration: 9000, repeat: -1 });
        label(gx, Y - 241, '槍 柱 · 창기둥', '#e0e8ff', '#1a1838');
        this.light(gx, vy, 240, 0xb8a0ff, .8);
        this.light(gx - 150, Y - 70, 180, 0x8ac8ff, .4); this.light(gx + 150, Y - 70, 180, 0xff9ad8, .4);
        // 정문 출입 (방울탑처럼 ↑/F → 암전 → 창기둥 안 1층 출입문 앞)
        if (r.portalTo) this.interacts.push({ kind: 'door', pair: 'spear', side: 'out', face: -1, x: gx, y: Y, range: 70, used: false, repeat: true, prompt: '[F 또는 ↑ : 창기둥 안으로 들어가기]', promptY: Y - 128, door: null, glowAt: { x: gx, y: vy } });
      }
      if (r.spear) {
        // 창기둥 안 1층 출입문 (협곡의 정문 앞 성역으로 나간다): 대리석 아치 안에 설산의 눈빛
        if (r.portalFrom) {
          const PY = (r.portalY ?? r.F) * TILE, x = r.left + 40;
          this.lit(s.add.image(x, PY, spearInnerGateArt(s)).setOrigin(.5, 1).setDepth(2.8));
          const gl = this.glow(x, PY - 30, 1, 0xb8d0ff, .22, 2.85);
          this.pulses.push({ o: gl, base: .2, amp: .08, sp: 1.4 });
          this.light(x, PY - 30, 120, 0xc8e0ff, .6);
          label(x, PY - 84, '출구 · 천관산', '#e0ecff', '#141a30');
          this.interacts.push({ kind: 'door', pair: 'spear', side: 'in', face: 1, x, y: PY, range: 22, used: false, repeat: true, prompt: '[F 또는 ↑ : 창기둥 밖으로 나가기]', promptY: PY - 98, door: null, glowAt: { x, y: PY - 30 } });
        }
        // 흰 대리석 기둥 (배경 · 몇은 부러졌다) · 바닥에 쓰러진 기둥 토막 · 금강 · 백옥 결정 (빛이 맥동한다) · 높은 틈으로 드는 연보랏빛
        if (!r.arenaStyle) for (let x = r.left + 60, k = 0; x < r.right - 40; x += 150 + (k * 29) % 50, k++) {   // 결전장(제단방)은 그 방 그림 · 배경이 기둥을 세운다
          if ((r.portalFrom && x < r.left + 110) || (r.spearAltar && Math.abs(x - r.cx) < 150)) continue;
          const tx = Math.floor(x / TILE), base = floorRow(r, tx);
          if (base === null) continue;
          const h = Math.min(9, base - r.ty0 - 1);
          const key = h >= 3 ? marbleColumnArt(s, h, k) : null, py = key && this.standY(key, x, .5, base, { sink: 6, up: 0, down: 0 });
          if (py) this.lit(s.add.image(x, py, key).setOrigin(.5, 1).setDepth(3.6));
        }
        if (!r.arenaStyle) for (let x = r.left + 130, k = 0; x < r.right - 60; x += 240 + (k * 41) % 60, k++) {
          const tx = Math.floor(x / TILE), base = floorRow(r, tx);
          if (base === null || !empty(tx + 2, base - 1) || !solid(tx + 2, base)) continue;
          const key = fallenDrumArt(s, k), py = this.standY(key, x, .5, base, { flip: k % 2 === 1, up: 0, down: 0 });
          if (py) this.lit(s.add.image(x, py, key).setOrigin(.5, 1).setDepth(6.1).setFlipX(k % 2 === 1));
        }
        for (let x = r.left + 90, k = 0; x < r.right - 40; x += 120 + (k * 23) % 40, k++) {
          const tx = Math.floor(x / TILE), base = floorRow(r, tx);
          if (base === null || (r.portalFrom && x < r.left + 90)) continue;
          const pink = k % 2 === 1, col = pink ? 0xff7ac8 : 0x6aa8ff, key = spearCrystalArt(s, pink ? 'pink' : 'blue'), sc = k % 3 ? 1 : 1.3;
          const cy = this.standY(key, x, .5, base, { scale: sc, up: 0, down: 0 });
          if (cy === null) continue;   // 땅 밀착: 결정 밑동이 턱 끝에 걸리면 두지 않는다
          const y = this.groundY + 1;
          this.add(s.add.image(x, cy, key).setOrigin(.5, 1).setDepth(6.2).setScale(sc));
          const h = this.add(s.add.image(x, y - 14, 'glow').setBlendMode(ADD).setTint(col).setScale(.9).setAlpha(.5).setDepth(6.3));
          this.pulses.push({ o: h, base: .45, amp: .25, sp: 1.2 + (k % 3) * .5 });
          if (k % 2 === 0) this.light(x, y - 14, 110, col, .8);
        }
        for (let x = r.left + 70; x < r.right; x += 170) this.add(s.add.image(x, r.top + 6, 'glow').setOrigin(.5, 0).setBlendMode(ADD).setTint(0xe8dcff).setScale(1.1, 5.5).setAlpha(.14).setDepth(3.3).setAngle(-12));
        // 디아루가 · 펄기아 제단 (아레나 가운데 뒤) + 그 뒤 차원 균열 (평소엔 닫혀 있다)
        if (r.spearAltar) {
          const row0 = r.arena && r.arena.altarY ? r.arena.altarY : r.F, key = spearAltarArt(s), ay = this.standY(key, r.cx, .5, row0, { sink: 2, up: 3, down: 3, low: true });
          const Y = ay === null ? row0 * TILE : this.groundY;   // 결전장: 4계단 단상 꼭대기 (땅 밀착 — 못 찾으면 처음 자리)
          this.lit(s.add.image(r.cx, ay ?? Y + 2, key).setOrigin(.5, 1).setDepth(3.5));
          for (const [d, col] of [[-1, 0x6aa8ff], [1, 0xff7ac8]]) {
            const o = this.add(s.add.image(r.cx + d * 70, Y - 61, 'glow').setBlendMode(ADD).setTint(col).setScale(.7).setAlpha(.6).setDepth(3.55));
            this.pulses.push({ o, base: .5, amp: .25, sp: 1.6 });
            this.light(r.cx + d * 70, Y - 61, 130, col, .7);
          }
          if (r.riftTo) this.buildRift(r, r.cx, Y - 118, !!r.cleared);
        }
      }
      if (r.distortion) {
        // 떠 있는 바위 (배경 · 천천히 오르내린다)
        const W = r.right - r.left, Hh = Y - r.top;
        for (let k = 0; k < Math.max(2, Math.round(W / 260)); k++) {
          const o = this.add(s.add.image(r.left + ((k * 211 + r.id * 53) % 997) / 997 * W, r.top + 20 + ((k * 89 + r.id * 31) % 401) / 401 * Hh * .5, floatRockArt(s, k % 3)).setDepth(1.9).setAlpha(.85).setScale(k % 2 ? .8 : 1.1));
          s.tweens.add({ targets: o, y: o.y - 8, duration: 2600 + k * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        // 부유섬 밑으로 거꾸로 자란 수정 나무
        for (const [k, isl] of (r.islands || []).entries()) {
          if (!solid(isl.x + (isl.w >> 1), isl.y + 2)) continue;
          this.lit(s.add.image((isl.x + isl.w / 2) * TILE, (isl.y + 3) * TILE - 1, invTreeArt(s, k % 3)).setOrigin(.5, 0).setDepth(9.7));
          const g = this.add(s.add.image((isl.x + isl.w / 2) * TILE, (isl.y + 3) * TILE + 40, 'glow').setBlendMode(ADD).setTint(k % 2 ? 0x4affd8 : 0xa070ff).setScale(.6).setAlpha(.4).setDepth(9.75));
          this.pulses.push({ o: g, base: .35, amp: .15, sp: 1.3 + k * .2 });
        }
        // 거슬러 오르는 폭포: 바닥 물웅덩이에서 천장까지 물줄기가 위로 흐른다
        for (let k = 0; k < Math.max(1, Math.round(W / 420)); k++) {
          const x = r.left + W * (.25 + k * .5) + ((r.id * 37) % 60) - 30;
          const w = this.add(s.add.tileSprite(x, r.top, 12, Y - r.top, revFallArt(s)).setOrigin(.5, 0).setDepth(3.3).setAlpha(.6));
          this.revFalls.push(w);
          this.add(s.add.image(x, Y - 2, 'glow').setBlendMode(ADD).setTint(0x3ad8e8).setScale(1.4, .3).setAlpha(.5).setDepth(3.31));
          const sp = this.add(s.add.image(x, r.top + 4, 'glow').setBlendMode(ADD).setTint(0x8affff).setScale(1, .5).setAlpha(.4).setDepth(3.31));
          this.pulses.push({ o: sp, base: .35, amp: .15, sp: 3 });
        }
        // 반물질의 왕좌 (기라티나 성소 한가운데)
        if (r.throne) {
          const Y = (r.arena && r.arena.throneY ? r.arena.throneY : r.F) * TILE;   // 결전장: 가운데 부유섬 위
          this.lit(s.add.image(r.cx, Y + 2, throneArt(s)).setOrigin(.5, 1).setDepth(3.5));
          const g = this.add(s.add.image(r.cx, Y - 110, 'glow').setBlendMode(ADD).setTint(0xff2a4a).setScale(2.4, 3).setAlpha(.3).setDepth(3.45));
          this.pulses.push({ o: g, base: .26, amp: .12, sp: .8 });
          this.light(r.cx, Y - 90, 240, 0xff3a5a, 1.2); this.light(r.cx, Y - 30, 200, 0xc06aff, .8);
        }
        // 깨어진 세계 첫 방: 창기둥 제단으로 돌아가는 작은 균열
        if (r.riftFrom) {
          const d = this.level.doors.find(q => q.rift), x = (d ? d.portalIn.x : r.tx0 + 4) * TILE + 8, PY = (d ? d.portalIn.y : r.F) * TILE;
          this.vortex(x, PY - 40, .55, 3.4);
          label(x, PY - 92, '균열 · 창기둥 제단', '#ffb8d0', '#1a0612');
          this.light(x, PY - 40, 150, 0xff3a6a, 1.2);
          this.interacts.push({ kind: 'door', pair: 'rift', side: 'in', face: 1, x, y: PY, range: 26, used: false, repeat: true, prompt: '[F 또는 ↑ : 균열을 지나 창기둥으로]', promptY: PY - 104, door: null, glowAt: { x, y: PY - 40 } });
        }
      }
    }
    // 차원 도약 수정: 밟거나 치면 높이 솟구친다 (updatePads · hitRect)
    for (const pd of this.level.pads || []) {
      const x = (pd.x + 1) * TILE, y = pd.g * TILE;
      const img = this.add(s.add.image(x, y + 2, padCrystalArt(s)).setOrigin(.5, 1).setDepth(6.4));
      const glow = this.add(s.add.image(x, y - 12, 'glow').setBlendMode(ADD).setTint(0xb070ff).setScale(1.1, .9).setAlpha(.5).setDepth(6.5));
      const beam = this.add(s.add.image(x, y - 8, 'glow').setOrigin(.5, 1).setBlendMode(ADD).setTint(0x8affe8).setScale(.3, 2.4).setAlpha(.18).setDepth(6.3));
      this.pulses.push({ o: glow, base: .45, amp: .2, sp: 2.4 }, { o: beam, base: .16, amp: .08, sp: 1.6 });
      this.light(x, y - 14, 110, 0xb070ff, 1.3);
      this.pads.push({ x, y, img, glow, cd: 0 });
    }
    this.buildPhase();
  }
  // 차원의 소용돌이 (검붉은 · 보랏빛 반물질 · 한가운데는 검게 꺼진 구멍 · 천천히 도는 나선): 창기둥 제단 뒤 균열 · 깨어진 세계 쪽 출구가 같이 쓴다
  vortex(x, y, sc, depth) {
    const s = this.s;
    const vio = this.add(s.add.image(x, y, 'glow').setBlendMode(ADD).setTint(0x5a10c0).setScale(3.4 * sc, 4.6 * sc).setAlpha(.24).setDepth(depth));
    const red = this.add(s.add.image(x, y, 'glow').setBlendMode(ADD).setTint(0xb0102a).setScale(2.4 * sc, 3.6 * sc).setAlpha(.34).setDepth(depth + .005));
    this.pulses.push({ o: red, base: .32, amp: .1, sp: 1.7 }, { o: vio, base: .22, amp: .08, sp: 1.1 });
    const sp = this.add(s.add.graphics().setDepth(depth + .01).setBlendMode(ADD).setPosition(x, y).setScale(sc, sc * 1.5));
    for (let k = 0; k < 3; k++) {
      sp.lineStyle(3, k === 1 ? 0x7a2ad8 : 0xc0102e, .75); sp.beginPath();
      for (let t = 0; t <= 1.001; t += .04) { const a = k * Math.PI * 2 / 3 + t * 5, rr = 4 + t * 46; if (t === 0) sp.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else sp.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      sp.strokePath();
    }
    sp.lineStyle(2, 0xff5a7a, .45); sp.strokeEllipse(0, 0, 70, 70);
    s.tweens.add({ targets: sp, angle: -360, duration: 5200, repeat: -1 });
    const core = this.add(s.add.image(x, y, 'glow').setTint(0x0a0006).setScale(1.1 * sc, 1.9 * sc).setAlpha(.92).setDepth(depth + .015));   // 빛을 삼키는 검은 심
    return [vio, red, sp, core];
  }
  // 창기둥 제단 뒤 차원 균열: 닫혀 있으면 안 보이고 조사도 안 된다 → 펄기아까지 정화하면 열린다 (GameScene.openRift · 방이 cleared 로 저장돼 다시 와도 열려 있다)
  buildRift(r, x, y, open) {
    const objs = this.vortex(x, y, 1.15, 3.3);
    const it = { kind: 'door', pair: 'rift', side: 'out', face: 1, x, y: (r.arena && r.arena.altarY ? r.arena.altarY : r.F) * TILE, range: 46, used: !open, repeat: true, prompt: '[F 또는 ↑ : 차원의 균열 속으로]', promptY: y - 76, door: null, glowAt: { x, y } };
    this.interacts.push(it);
    const light = this.light(x, y, 220, 0xd01a4a, open ? 1 : 0);
    this.rift = { objs, it, light, x, y, open, room: r, scales: objs.map(o => [o.scaleX, o.scaleY]) };
    if (!open) for (const o of objs) o.setVisible(false);
  }
  openRift() {
    const R = this.rift, s = this.s;
    if (!R || R.open) return;
    R.open = true; R.it.used = false;
    R.objs.forEach((o, i) => { o.setVisible(true).setScale(0, 0); s.tweens.add({ targets: o, scaleX: R.scales[i][0], scaleY: R.scales[i][1], duration: 1400, ease: 'Back.easeOut' }); });
    if (R.light) s.tweens.add({ targets: R.light, intensity: 1, duration: 1400 });
  }

  // 유령 발판: 깨어진 세계의 통과 발판 줄 (World.phase). 멀리선 희미한 윤곽만 — 다가가면 흩어진 보랏빛 조각이 모여들어 단단한 발판으로 조립된다 (밟히는 건 언제나 — 길 보장과 같다)
  buildPhase() {
    const s = this.s;
    for (const ph of this.level.phase || []) {
      const r = ph.room; if (!r || !r.layer) continue;
      const tiles = [];
      for (let x = ph.x0; x <= ph.x1; x++) { const t = r.layer.getTileAt(x - r.X0, ph.y - r.Y0); if (t) { t.alpha = .22; tiles.push(t); } }
      const shards = [];
      for (let x = ph.x0; x <= ph.x1; x++) for (let k = 0; k < 1; k++) {
        const tx = x * TILE + 8, ty = ph.y * TILE + 3, a = ((x * 7 + k * 13) % 17) / 17 * Math.PI * 2, d = 26 + ((x * 11 + k * 5) % 7) * 6;
        const o = this.add(s.add.image(tx, ty, 'px').setBlendMode(ADD).setTint(x % 2 ? 0x8affe8 : 0xc08aff).setScale(2, 1.5).setAlpha(.4).setDepth(10.35));
        shards.push({ o, tx, ty, hx: tx + Math.cos(a) * d, hy: ty + Math.sin(a) * d * .7, ph: a });
      }
      const line = this.add(s.add.image((ph.x0 + ph.x1 + 1) / 2 * TILE, ph.y * TILE + 2, 'glow').setBlendMode(ADD).setTint(0xb070ff).setScale((ph.x1 - ph.x0 + 1) * .6, .18).setAlpha(0).setDepth(10.36));
      this.phase.push({ tiles, shards, line, cx: (ph.x0 + ph.x1 + 1) / 2 * TILE, cy: ph.y * TILE, k: 0 });
    }
  }
  updatePhase(dt, view) {
    const p = this.s.player, t = this.s.time.now / 1000;
    for (const g of this.phase) {
      if (g.cx < view.x - 160 || g.cx > view.right + 160 || g.cy < view.y - 120 || g.cy > view.bottom + 120) continue;
      const d = p ? Math.hypot(p.x - g.cx, (p.y - g.cy) * 1.3) : 999, want = d < 110 ? 1 : d > 180 ? 0 : (180 - d) / 70;
      g.k += (want - g.k) * Math.min(1, dt * 4);
      const k = g.k, e = k * k * (3 - 2 * k);
      for (const tile of g.tiles) tile.alpha = .22 + .78 * e;
      for (const sh of g.shards) {
        const wob = (1 - e) * 4;
        sh.o.setPosition(sh.hx + (sh.tx - sh.hx) * e + Math.sin(t * 2 + sh.ph) * wob, sh.hy + (sh.ty - sh.hy) * e + Math.cos(t * 1.7 + sh.ph) * wob);
        sh.o.setAlpha(e > .96 ? .2 : .35 + .5 * e).setAngle((1 - e) * 120 + sh.ph * 30);
      }
      g.line.setAlpha(e * .5);
    }
  }
  // 차원 도약 수정: 위에 서면(또는 공격으로 치면) 중력을 거슬러 솟구친다
  updatePads(dt) {
    const p = this.s.player;
    for (const pd of this.pads) {
      if (pd.cd > 0) pd.cd -= dt;
      if (!p || pd.cd > 0 || p.launchT > 0 || !p.onGround) continue;
      if (Math.abs(p.x - pd.x) < 15 && Math.abs(p.bottom - pd.y) < 5) this.launchPad(pd);
    }
  }
  launchPad(pd) {
    const s = this.s, p = s.player;
    pd.cd = .6;
    p.launch(PAD_VY);
    s.tweens.killTweensOf(pd.img);
    s.tweens.add({ targets: pd.img, scaleY: { from: .6, to: 1 }, scaleX: { from: 1.3, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    s.fx.ring(pd.x, pd.y - 6, 30, 0xb070ff, 320); s.fx.ring(pd.x, pd.y - 6, 18, 0x8affe8, 260);
    s.fx.burst(pd.x, pd.y - 8, [0xb070ff, 0x8affe8, 0xffffff], 16, 160, { angle: -Math.PI / 2, spread: .5, up: 200, grav: -60, bounce: false, glow: true, life: .6 });
    s.fx.glow(pd.x, pd.y - 20, 40, 0xc08aff, 300, .9);
    Sfx.play('pad');
  }
  updateSinnoh(dt, view) {
    for (const w of this.revFalls) w.tilePositionY += dt * 70;   // 물줄기가 위로 거슬러 오른다 (텍스처를 아래에서 위로 흘린다)
    if (this.phase.length) this.updatePhase(dt, view);
    if (this.pads.length) this.updatePads(dt);
    const R = this.rift;
    if (R && R.open && R.x > view.x - 40 && R.x < view.right + 40 && R.y > view.y - 60 && R.y < view.bottom + 60 && Math.random() < .5) {   // 균열로 빨려 드는 검붉은 티끌
      const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 40;
      this.s.fx.burst(R.x + Math.cos(a) * d, R.y + Math.sin(a) * d * 1.3, [0xff2a4a, 0x8a2aff, 0x2a0612], 1, 60, { angle: a + Math.PI, spread: .2, up: 0, grav: 0, bounce: false, glow: true, life: .9, size: 1, drag: .98 });
    }
  }

  // 하나: 설화시티 고대 다리 · 겨울 습지(물가 · 빛무리 — 눈 · 고드름 · 얼음은 buildSinnoh 와 같이) · 용나선탑 정문 외관 · 탑 안(왼쪽 벽 백열 불꽃 · 오른쪽 벽 푸른 뇌전)
  //  · 기믹: 열기 상승 기류(붉은 아지랑이 기둥) · 푸른 전자기장 (효과는 updateHeroes) · 꼭대기 흑과 백의 제단
  //  최종장: 천계의 피리 공명로(빛의 유리 계단 · 걸음마다 맑은 공명) · 시초의 성문 외관 · 시초의 방 결전장(바닥의 고대 문양)
  // 정문 앞 글씨 (가운데 아래 기준)
  tag(x, y, text, color, stroke) { return this.add(this.s.add.text(x, y, text, { fontFamily: 'Galmuri9', fontSize: '9px', color, stroke, strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(3.5)); }
  // 정문 외관 (방울탑 · 창기둥과 같은 규칙: 정문 한가운데 = r.doorTx · 천장 위로 솟은 부분은 천장 바위 앞에 그려 화면 위로 끝없이)
  facade(r, art) {
    const s = this.s, Y = r.F * TILE, gx = r.doorTx * TILE + 8, AW = 640, AH = 300, cutH = r.top - (Y + 2 - AH);
    this.lit(s.add.image(gx, Y + 2, art).setOrigin(.5, 1).setDepth(3.4));
    if (cutH > 0) { const c0 = Math.max(0, cutH - 88); this.lit(s.add.image(gx, Y + 2, art).setOrigin(.5, 1).setCrop(0, c0, AW, cutH - c0).setDepth(10.45)); }
    return { gx, Y };
  }
  // 탑 · 성소 안 1층 출입문 (나가면 정문 앞)
  innerDoor(r, art, pair, text, prompt, col) {
    const row = r.portalY ?? r.F, x0 = r.left + 40, at = this.fitX(art, [0, 8, 16, 24, 32, -8, -16, 40, 48].map(d => x0 + d), .5, row, { sink: 0, up: 0, down: 0, plat: true });   // 땅 밀착: 문 전체가 바닥 · 발판을 딛는 자리로
    const PY = row * TILE, x = at ? at.x : x0;
    this.lit(this.s.add.image(x, at ? at.y : PY, art).setOrigin(.5, 1).setDepth(2.8));
    const gl = this.glow(x, PY - 30, 1, col, .22, 2.85);
    this.pulses.push({ o: gl, base: .2, amp: .08, sp: 1.4 });
    this.light(x, PY - 30, 120, col, .6);
    this.tag(x, PY - 84, text, '#e8eeff', '#141a30');
    this.interacts.push({ kind: 'door', pair, side: 'in', face: 1, x, y: PY, range: 22, used: false, repeat: true, prompt, promptY: PY - 98, door: null, glowAt: { x, y: PY - 30 } });
  }

  buildHeroes() {
    const s = this.s, G = this.level.grid;
    const label = (...a) => this.tag(...a), facade = (r, art) => this.facade(r, art), innerDoor = (...a) => this.innerDoor(...a);
    this.lifts = []; this.fields = []; this.stepT = 0;
    for (const r of this.level.rooms) {
      const Y = r.F * TILE, W = r.right - r.left;
      if (r.icirrus) {   // 잔잔한 물가: 바닥선을 따라 은빛 물결 · 푸른 빛무리
        const w = this.add(s.add.tileSprite(r.left, Y - 3, W, 6, stillWaterArt(s)).setOrigin(0, 0).setDepth(10.4).setAlpha(.8));
        (this.waves = this.waves || []).push(w);
        for (let x = r.left + 60, k = 0; x < r.right - 40; x += 150, k++) { const g = this.add(s.add.image(x, Y - 8, 'glow').setBlendMode(ADD).setTint(0x8ac8ff).setScale(1.6, .4).setAlpha(.3).setDepth(10.35)); this.pulses.push({ o: g, base: .25, amp: .12, sp: 1 + k * .3 }); }
        this.light(r.cx, r.top + 30, Math.max(300, W * .6), 0xd8e8ff, .5);
      }
      if (r.spiralGate) {
        const { gx, Y: GY } = facade(r, spiralGateArt(s)), vy = GY - 120;
        const warm = this.add(s.add.image(gx - 40, vy, 'glow').setBlendMode(ADD).setTint(0xfff0d0).setScale(1.6, 3.6).setAlpha(.35).setDepth(3.45));
        const cold = this.add(s.add.image(gx + 40, vy, 'glow').setBlendMode(ADD).setTint(0x6ab0ff).setScale(1.6, 3.6).setAlpha(.35).setDepth(3.45));
        this.pulses.push({ o: warm, base: .3, amp: .12, sp: 1.3 }, { o: cold, base: .3, amp: .12, sp: 1.7 });
        label(gx, GY - 241, '龍 螺 旋 塔 · 용나선탑', '#e0e8ff', '#141830');
        this.light(gx - 60, vy, 200, 0xfff0d0, .7); this.light(gx + 60, vy, 200, 0x6ab0ff, .7);
        if (r.portalTo) this.interacts.push({ kind: 'door', pair: 'spiral', side: 'out', face: -1, x: gx, y: GY, range: 70, used: false, repeat: true, prompt: '[F 또는 ↑ : 용나선탑 안으로 들어가기]', promptY: GY - 128, door: null, glowAt: { x: gx, y: vy } });
      }
      if (r.spiral) {
        if (r.portalFrom) innerDoor(r, spiralInnerGateArt(s), 'spiral', '출구 · 고대 다리', '[F 또는 ↑ : 용나선탑 밖으로 나가기]', 0xd8e8ff);
        // 나선 회랑: 왼쪽 벽엔 진실의 백열 불꽃 · 오른쪽 벽엔 이상의 푸른 뇌전 (위아래로 촘촘히 · 일렁이고 지지직)
        for (let y = Y - 40, k = 0; y > r.top + 20; y -= 88, k++) {
          for (const [side, x] of [[-1, r.left + 10], [1, r.right - 10]]) {
            if (s.isSolidAt(x + side * -6, y)) continue;
            if (side < 0) {
              this.lit(s.add.image(x, y, whiteFireArt(s)).setOrigin(.5, 1).setDepth(6.2));
              const h = this.add(s.add.image(x, y - 18, 'glow').setBlendMode(ADD).setTint(0xfff0d0).setScale(1.2).setAlpha(.55).setDepth(6.3));
              const L = this.light(x + 10, y - 18, 170, 0xfff0d0, 1.3);
              this.flickers.push({ objs: [h], base: [.55], rate: .3, light: L, lightK: 1.3, off: 0 });
            } else {
              this.lit(s.add.image(x, y, voltCoilArt(s)).setOrigin(.5, 1).setDepth(6.2));
              const h = this.add(s.add.image(x, y - 20, 'glow').setBlendMode(ADD).setTint(0x6ab0ff).setScale(1.1).setAlpha(.55).setDepth(6.3));
              const L = this.light(x - 10, y - 20, 170, 0x6ab0ff, 1.3);
              this.flickers.push({ objs: [h], base: [.55], rate: 1.6, light: L, lightK: 1.3, off: 0 });
              (this.coils = this.coils || []).push({ x, y: y - 22 });
            }
          }
        }
        if (r.spiralTop) {   // 흑과 백의 제단
          this.lit(s.add.image(r.cx, Y + 2, spiralAltarArt(s)).setOrigin(.5, 1).setDepth(3.5));
          for (const [d, col] of [[-1, 0x4a8aff], [1, 0xff9a4a]]) { const o = this.add(s.add.image(r.cx + d * 60, Y - 62, 'glow').setBlendMode(ADD).setTint(col).setScale(.8).setAlpha(.6).setDepth(3.55)); this.pulses.push({ o, base: .5, amp: .25, sp: 1.5 }); this.light(r.cx + d * 60, Y - 62, 140, col, .9); }
        }
      }
      if (r.azure) {
        // 빛의 유리 계단: 통과 발판 줄마다 반투명 유리 계단을 덮는다 · 배경에 하늘로 뻗은 커다란 유리 계단
        for (let ty = r.ty0; ty < r.F; ty++) {
          let run = null;
          for (let tx = r.tx0; tx <= r.tx1; tx++) {
            const on = tx < r.tx1 && G[ty][tx] === 'P';
            if (on && run === null) run = tx;
            if (!on && run !== null) {
              this.add(s.add.tileSprite(run * TILE, ty * TILE - 1, (tx - run) * TILE, 6, glassStepArt(s)).setOrigin(0, 0).setDepth(10.3));
              const g = this.add(s.add.image((run + tx) / 2 * TILE, ty * TILE + 2, 'glow').setBlendMode(ADD).setTint(0xc8ecff).setScale((tx - run) * .35, .25).setAlpha(.35).setDepth(10.32));
              this.pulses.push({ o: g, base: .3, amp: .1, sp: 1 + (tx % 5) * .2 });
              run = null;
            }
          }
        }
        for (let x = r.left + 80, k = 0; x < r.right - 60; x += 260, k++) { const key = glassStairsArt(s, k % 2 ? -1 : 1), gy = this.standY(key, x, .5, r.F, { low: true }); if (gy !== null) this.add(s.add.image(x, gy, key).setOrigin(.5, 1).setDepth(3.3).setAlpha(.6)); }
        for (let x = r.left + 50; x < r.right; x += 180) this.add(s.add.image(x, r.top + 4, 'glow').setOrigin(.5, 0).setBlendMode(ADD).setTint(0xfff0c8).setScale(1.2, 5.5).setAlpha(.16).setDepth(3.3).setAngle(-12));   // 내려오는 빛줄기
        this.light(r.cx, r.top + 40, Math.max(320, W * .7), 0xfff4d8, .7);
      }
      if (r.originGate) {
        const { gx, Y: GY } = facade(r, originGateArt(s)), vy = GY - 80;
        const core = this.add(s.add.image(gx, vy, 'glow').setBlendMode(ADD).setTint(0xfff4d8).setScale(2, 2.8).setAlpha(.3).setDepth(3.45));
        const ring = this.add(s.add.image(gx, GY - 182, 'glow').setBlendMode(ADD).setTint(0xffd870).setScale(5, 5).setAlpha(.18).setDepth(3.44));
        this.pulses.push({ o: core, base: .28, amp: .1, sp: 1.2 }, { o: ring, base: .16, amp: .06, sp: .7 });
        label(gx, GY - 241, '始 原 之 間 · 시초의 방', '#fff4d0', '#3a2a10');
        this.light(gx, vy, 240, 0xfff0c0, .55);
        if (r.portalTo) this.interacts.push({ kind: 'door', pair: 'origin', side: 'out', face: -1, x: gx, y: GY, range: 70, used: false, repeat: true, prompt: '[F 또는 ↑ : 시초의 방으로 들어가기]', promptY: GY - 128, door: null, glowAt: { x: gx, y: vy } });
      }
      if (r.originHall) {
        if (r.portalFrom) innerDoor(r, spiralInnerGateArt(s), 'origin', '출구 · 천계의 계단', '[F 또는 ↑ : 천계의 계단으로 돌아가기]', 0xfff0c0);
        const sig = this.add(s.add.image(r.cx, Y - 4, originSigilArt(s)).setDepth(10.36).setAlpha(.85));
        this.pulses.push({ o: sig, base: .75, amp: .15, sp: .9 });
        this.light(r.cx, Y - 40, 300, 0xfff0c0, .8);
      }
    }
    // 열기 상승 기류: 바닥에서 천장까지 붉은 아지랑이 기둥 · 발밑의 불씨 · 붉은 빛 (하늘기둥 정상의 바람 기류는 초록 바람 줄무늬)
    for (const l of this.level.lifts || []) {
      const x = l.x0 * TILE, y0 = l.y0 * TILE, y1 = (l.y1 + 1) * TILE, w = (l.x1 - l.x0 + 1) * TILE, tint = l.wind ? 0x4affb0 : 0xff6a2a;
      const col = this.add(s.add.tileSprite(x + w / 2, y0, w + 8, y1 - y0, l.wind ? windLiftArt(s) : heatArt(s)).setOrigin(.5, 0).setDepth(9.6).setBlendMode(ADD).setAlpha(.8));
      this.add(s.add.image(x + w / 2, y1 - 4, 'glow').setBlendMode(ADD).setTint(tint).setScale(1.4, .5).setAlpha(.6).setDepth(9.65));
      this.light(x + w / 2, y1 - 20, 130, tint, 1.1);
      this.lifts.push({ x0: x - 4, x1: x + w + 4, y0, y1, col, wind: !!l.wind });
    }
    // 푸른 전자기장: 테두리가 지지직 흐르는 푸른 장막 (안에서 뛰면 1.5배 높이)
    for (const f of this.level.fields || []) {
      const x0 = f.x0 * TILE, x1 = (f.x1 + 1) * TILE, y0 = f.y0 * TILE, y1 = (f.y1 + 1) * TILE;
      const g = this.add(s.add.graphics().setDepth(9.55).setBlendMode(ADD));
      g.fillStyle(0x3a7aff, .07); g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.lineStyle(1, 0x8ac8ff, .5); for (let x = x0; x < x1; x += 10) { g.lineBetween(x, y0, x + 5, y0); g.lineBetween(x, y1 - 1, x + 5, y1 - 1); } for (let y = y0; y < y1; y += 10) { g.lineBetween(x0, y, x0, y + 5); g.lineBetween(x1, y, x1, y + 5); }
      g.setPosition(0, 0);
      this.pulses.push({ o: g, base: .75, amp: .25, sp: 3 });
      this.light((x0 + x1) / 2, y1 - 30, Math.max(120, (x1 - x0) * .6), 0x4a8aff, .7);
      this.fields.push({ x0, x1, y0, y1 });
    }
  }
  // 가라르 · 너클시티 지하 에너지 플랜트(plant): 천장을 따라 뻗은 검붉은 다이맥스 파이프 · 벽을 타고 내려오는 세로 파이프(맥박처럼 빛나는 이음매)
  //  · 떠 있는 청록 홀로그램 패널(지지직 깜빡) · 천장의 회전 경고등 · 바닥 증기 배출구 (증기는 updateGalar)
  //  · 최종 격리 게이트 앞(plantGate): 거대한 플랜트 최종 격리 게이트 외관 → F / ↑ → 블랙나이트의 심장
  //  · 블랙나이트의 심장(plantHeart): 한가운데 뒤편 검붉은 에너지 결정 기둥 속에 사슬에 묶인 창백한 레드 (this.redCore — GameScene 의 유대의 불꽃 시네마틱이 깬다)
  buildGalar() {
    const s = this.s;
    this.vents = []; this.warnLamps = []; this.redCore = null;
    for (const r of this.level.rooms) {
      if (!r.plant && !r.plantHeart) continue;
      const Y = r.F * TILE, W = r.right - r.left;
      if (r.arenaStyle) { if (r.portalFrom) this.innerDoor(r, plantInnerDoorArt(s), 'plant', '출구 · 격리 게이트', '[F 또는 ↑ : 격리 게이트 밖으로 나가기]', 0xff5a7a); this.buildRedCore(r); continue; }   // 결전장: 배관 · 결정 기둥은 그 방 배경(systems/ArenaBackdrop.js)이 그린다
      // 천장 파이프 두 줄 (방 너비 전체 · 지형 뒤)
      for (const [dy, a] of [[10, 1], [26, .8]]) this.lit(s.add.tileSprite(r.left, r.top + dy, W, 12, pipeArt(s)).setOrigin(0, .5).setDepth(3.25).setAlpha(a).setTilePosition(dy * 3, 0));
      // 세로 파이프 (벽을 타고 바닥까지) · 이음매마다 맥동하는 검붉은 빛
      for (let x = r.left + 70, k = 0; x < r.right - 50; x += 230 + (k * 37) % 60, k++) {
        if (r.plantGate && Math.abs(x - (r.doorTx * TILE + 8)) < 340) continue;   // 격리 게이트 외관 앞은 비운다
        if (r.portalFrom && x < r.left + 90) continue;   // 심장 안 출입문 자리
        this.lit(s.add.tileSprite(x, r.top + 16, 12, Y - r.top - 16, vpipeArt(s)).setOrigin(.5, 0).setDepth(3.3));
        for (let y = r.top + 60, j = 0; y < Y - 20; y += 96, j++) { const g = this.glow(x, y, .35, 0xff2a4a, .5, 3.35); this.pulses.push({ o: g, base: .4, amp: .3, sp: 2.2 + ((k + j) % 3) * .4 }); }
        this.light(x, Y - 60, 110, 0xff3a5a, .7);
      }
      if (r.plant) {
        // 홀로그램 패널 (청록 · 가끔 지지직)
        for (let x = r.left + 150, k = 0; x < r.right - 120; x += 260 + (k * 53) % 80, k++) {
          if (r.plantGate && Math.abs(x - (r.doorTx * TILE + 8)) < 360) continue;
          const y = Y - 70 - (k % 3) * 26;
          if (s.isSolidAt(x, y) || s.isSolidAt(x, y + 20)) continue;
          const h = this.add(s.add.image(x, y, hologramArt(s, k % 4)).setDepth(3.6).setAlpha(.85));
          const hg = this.glow(x, y, .9, 0x4af0ff, .18, 3.58);
          this.flickers.push({ objs: [h, hg], base: [.85, .18], rate: 1.2, t: 0, off: 0 });
          this.light(x, y, 90, 0x4af0ff, .6);
        }
        // 회전 경고등 (천장)
        for (let x = r.left + 110, k = 0; x < r.right - 60; x += 300, k++) {
          if (s.isSolidAt(x, r.top + 40)) continue;
          this.lit(s.add.image(x, r.top + 34, warnLampArt(s)).setOrigin(.5, 0).setDepth(3.4));
          const beam = this.add(s.add.image(x, r.top + 44, 'glow').setOrigin(.5, 0).setBlendMode(ADD).setTint(0xff2a4a).setScale(1.6, 4).setAlpha(.12).setDepth(3.38));
          const L = this.light(x, r.top + 50, 160, 0xff2a4a, 1);
          this.warnLamps.push({ beam, L, ph: k * 1.3 });
        }
      }
      // 바닥 증기 배출구
      for (let x = r.left + 100, k = 0; x < r.right - 60; x += 190 + (k * 29) % 70, k++) {
        if (r.plantGate && Math.abs(x - (r.doorTx * TILE + 8)) < 150) continue;
        const vy = this.standY(ventArt(s), x, .5, r.F, { sink: 1, up: 0, down: 0 });
        if (vy === null) continue;   // 땅 밀착: 배출구 전체가 바닥 위에
        const Y = this.groundY;
        this.lit(s.add.image(x, vy, ventArt(s)).setOrigin(.5, 1).setDepth(10.36));
        this.vents.push({ x, y: Y - 4, t: (k * .7) % 2.4 });
      }
      this.light(r.cx, r.top + 40, Math.max(300, W * .6), 0xff5a7a, .45);
      if (r.plantGate) {   // 플랜트 최종 격리 게이트
        const { gx, Y: GY } = this.facade(r, plantGateArt(s)), core = GY - 220, vy = GY - 100;
        const cg = this.add(s.add.image(gx, core, 'glow').setBlendMode(ADD).setTint(0xff3a5a).setScale(2.4).setAlpha(.45).setDepth(3.45));
        const crack = this.add(s.add.image(gx, vy, 'glow').setBlendMode(ADD).setTint(0xff2a4a).setScale(.5, 3.6).setAlpha(.5).setDepth(3.45));
        this.pulses.push({ o: cg, base: .4, amp: .18, sp: 2.6 }, { o: crack, base: .45, amp: .2, sp: 2.6 });
        this.tag(gx, GY - 150, '플랜트 최종 격리 게이트', '#ffd0d8', '#2a0610');
        this.light(gx, core, 220, 0xff3a5a, 1.1); this.light(gx, vy, 200, 0xff2a4a, .9);
        if (r.portalTo) this.interacts.push({ kind: 'door', pair: 'plant', side: 'out', face: -1, x: gx, y: GY, range: 70, used: false, repeat: true, prompt: '[F 또는 ↑ : 최종 격리 게이트 안으로 들어가기]', promptY: GY - 118, door: null, glowAt: { x: gx, y: vy } });
      }
      if (r.plantHeart) {
        if (r.portalFrom) this.innerDoor(r, plantInnerDoorArt(s), 'plant', '출구 · 격리 게이트', '[F 또는 ↑ : 격리 게이트 밖으로 나가기]', 0xff5a7a);
        this.buildRedCore(r);
      }
    }
  }
  // 블랙나이트의 심장 한가운데 뒤편: 검붉은 결정 기둥 + 사슬에 묶여 창백해진 레드 (눈을 감고 있다)
  buildRedCore(r) {
    const s = this.s, x = r.cx, Y = (r.arena && r.arena.coreY ? r.arena.coreY : r.F) * TILE, feet = Y - 22;   // 결전장: 원자로 해치 돔 꼭대기
    makeTrainerArt(s, 'red');
    const halo = this.add(s.add.image(x, Y - 90, 'glow').setBlendMode(ADD).setTint(0xff1a3a).setScale(4, 6).setAlpha(.3).setDepth(3.48));
    const back = this.add(s.add.image(x, Y + 2, redCrystalArt(s, false)).setOrigin(.5, 1).setDepth(3.5));
    const red = this.add(s.add.image(x, feet, 'trainer:red:sleep').setOrigin(.5, 1).setScale(2).setDepth(3.52).setTint(0xb8b0c8).setAlpha(.92));
    const chains = this.add(s.add.graphics().setDepth(3.54));
    // 사슬: 결정 안쪽 모서리 → 두 손목 · 두 발목 (고리 무늬)
    const link = (x0, y0, x1, y1) => {
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 5));
      chains.lineStyle(2, 0x2a2026, 1); chains.lineBetween(x0, y0, x1, y1);
      for (let k = 0; k <= n; k++) { const t = k / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t; chains.fillStyle(k % 2 ? 0x6a5a64 : 0x4a3e46, 1); chains.fillRect(cx - 1.5, cy - 1.5, 3, 3); }
    };
    link(x - 40, feet - 110, x - 16, feet - 42); link(x + 40, feet - 110, x + 14, feet - 38);
    link(x - 38, feet + 10, x - 8, feet - 4); link(x + 38, feet + 10, x + 8, feet - 4);
    const front = this.add(s.add.image(x, Y + 2, redCrystalArt(s, true)).setOrigin(.5, 1).setDepth(3.56));
    const core = this.add(s.add.image(x, feet - 50, 'glow').setBlendMode(ADD).setTint(0xff5a7a).setScale(1.4, 2.2).setAlpha(.3).setDepth(3.57));
    this.pulses.push({ o: halo, base: .26, amp: .1, sp: 1.1 }, { o: core, base: .26, amp: .12, sp: 1.1 });
    const L = this.light(x, feet - 60, 260, 0xff2a4a, 1.3);
    this.redCore = { x, Y, feet, top: Y - 174, back, front, red, chains, halo, core, light: L };
  }
  // 증기 · 경고등 회전 (화면 안에서만)
  updateGalar(dt, view) {
    const s = this.s, t = s.time.now / 1000;
    for (const w of this.warnLamps || []) { const k = (Math.sin(t * 5 + w.ph) + 1) / 2; w.beam.setAlpha(.04 + k * .16).setScale(1.2 + k * .8, 4); if (w.L) w.L.setIntensity(.4 + k * .9); }
    for (const v of this.vents || []) {
      if (v.x < view.x - 30 || v.x > view.right + 30 || v.y < view.y - 30 || v.y > view.bottom + 60) continue;
      if ((v.t -= dt) > 0) continue;
      v.t = 2 + Math.random() * 1.6;
      s.fx.burst(v.x, v.y, [0xd8c8cc, 0xa89098, 0xffffff], 10, 50, { angle: -Math.PI / 2, spread: .35, up: 70, grav: -30, bounce: false, life: 1.1, size: 3, drag: .97 });
    }
  }

  // 상승 기류 · 전자기장 효과 · 유리 계단 공명 · 뇌전 코일 스파크
  updateHeroes(dt, view) {
    const s = this.s, p = s.player;
    for (const l of this.lifts) l.col.tilePositionY += dt * 90;
    if (!p) return;
    p.jumpMul = 1;
    for (const f of this.fields) if (p.x > f.x0 && p.x < f.x1 && p.bottom > f.y0 && p.bottom <= f.y1 + 2) {
      p.jumpMul = FIELD_JUMP;
      if (Math.random() < .25) s.fx.burst(p.x + (Math.random() - .5) * 16, p.bottom - Math.random() * 20, [0x8ac8ff, 0xffffff], 1, 40, { up: 0, grav: 0, bounce: false, glow: true, life: .15, size: 1 });
      break;
    }
    for (const l of this.lifts) if (p.x > l.x0 && p.x < l.x1 && p.bottom > l.y0 && p.bottom <= l.y1 + 4) {   // 붉은 열기에 실려 위로 활공
      p.b.setVelocityY(Math.max(p.b.velocity.y - (l.wind ? WIND_ACC : LIFT_ACC) * dt, -(l.wind ? WIND_V : LIFT_V)));
      p.liftT = .12; p.jumpsUsed = Math.min(p.jumpsUsed, 1); p.airDash = true;
      if (Math.random() < .4) s.fx.burst(p.x + (Math.random() - .5) * 20, p.bottom, l.wind ? [0x4affb0, 0xc8ffe8, 0xffffff] : [0xff6a2a, 0xffb060, 0xffe0a0], 1, 30, { angle: -Math.PI / 2, spread: .4, up: 60, grav: -40, bounce: false, glow: true, life: .5, size: 1 });
      break;
    }
    // 천계의 유리 계단: 걸음마다 발밑에서 맑은 공명 (피리 · 하프)
    const R = s.room;
    if (R && R.azure && p.onGround && Math.abs(p.b.velocity.x) > 30) {
      if ((this.stepT -= dt) <= 0) {
        this.stepT = .32;
        s.fx.ring(p.x, p.bottom - 1, 14, 0xc8ecff, 360); s.fx.ring(p.x, p.bottom - 1, 8, 0xfff0c0, 260);
        s.fx.burst(p.x, p.bottom - 2, [0xc8ecff, 0xfff0c0, 0xffffff], 3, 40, { angle: -Math.PI / 2, spread: 1, up: 30, grav: -20, bounce: false, glow: true, life: .5, size: 1 });
        Sfx.play('harp');
      }
    } else this.stepT = 0;
    for (const c of this.coils || []) if (c.x > view.x - 20 && c.x < view.right + 20 && c.y > view.y - 20 && c.y < view.bottom + 20 && Math.random() < .03) {   // 뇌전 코일 스파크
      s.fx.burst(c.x, c.y, [0x8ac8ff, 0xffffff], 3, 60, { up: 0, grav: 0, bounce: false, glow: true, life: .15, size: 1 }); s.fx.glow(c.x, c.y, 10, 0x6ab0ff, 120, .8);
    }
  }

  // 방울로드 낙엽 · 탑 횃불 불티 (화면 안에서만)
  updateBellTower(view) {
    const fx = this.s.fx, p = this.s.player;
    if (this.leafRooms && this.leafRooms.length && p && this.leafRooms.includes(this.s.room) && Math.random() < .6) {
      const x = view.x + Math.random() * view.width;
      fx.burst(x, view.y - 4, [0xf0c830, 0xf05028, 0xff9a3a, 0xffe080], 1, 30, { angle: Math.PI * .6, spread: .8, up: -10, grav: 30, bounce: false, life: 4, size: 2, drag: .995 });
    }
    for (const t of this.wallTorches || []) if (t.x > view.x - 20 && t.x < view.right + 20 && t.y > view.y - 20 && t.y < view.bottom + 20 && Math.random() < .12) fx.embers(t.x + (Math.random() - .5) * 4, t.y - 4, [0xffa040, 0xffe080], 1, { speed: 26 });
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
      if (area.forest && room.type === 'combat' && !room.isPurified) for (let k = 0; k < 5; k++) {
        const ex = rand(room.left + 60, room.right - 60), ey = rand(room.ty0 + 2, room.F - 4) * TILE, gap = 4 + Math.random() * 3;
        const pair = [-gap / 2, gap / 2].map(dx => this.add(s.add.image(ex + dx, ey, 'glow').setBlendMode(ADD).setTint(0xff1a3a).setScale(.08, .05).setDepth(3.5).setAlpha(0)));
        this.eyes.push({ pair, t: Math.random() * 6, open: false, room });
      }
    }
  }

  // 위가 트인 벽 타일마다 수풀·돌멩이·버섯 (마을엔 꽃)
  // 침식 균열: 보스방에 가까운 방(침식 깊이 0.5 이상)의 바닥에 보랏빛 · 핏빛으로 숨 쉬듯 빛나는 금 (깊을수록 촘촘하게 · 정화하면 사라진다)
  buildVeins() {
    if (this.level.purified) return;
    const s = this.s, { grid, cols, rows } = this.level, key = veinArt(s);
    for (const r of this.level.rooms) {
      const d = r.depth || 0;
      if (d < .5 || r.type === 'village' || r.arenaStyle || r.isPurified) continue;   // ✨ 정화한 샛길 구역엔 균열이 없다
      const p = (d - .45) * .32;
      for (let y = r.ty0 + 1; y <= r.F && y < rows; y++) for (let x = r.tx0; x < r.tx1 && x < cols; x++) {
        if (grid[y][x] !== 'S' || grid[y - 1][x] !== '.' || Math.random() > p) continue;
        const v = this.add(s.add.image(x * TILE + 8, y * TILE + 1, key).setOrigin(.5, 0).setBlendMode(ADD).setTint(d > .75 ? 0xff3a5a : 0xb05aff).setDepth(10.25).setFlipX(Math.random() < .5));
        this.pulses.push({ o: v, base: .45 + d * .2, amp: .3, sp: 1.5 + Math.random() * 1.5 });
        (this.veinList = this.veinList || []).push({ img: v, room: r });
      }
    }
  }

  buildSurfaceDecor() {
    const s = this.s, { grid, cols, rows } = this.level, cave = this.si === 1;
    for (let x = 1; x < cols - 1; x++) {
      for (let y = 3; y < rows; y++) {
        if (grid[y][x] !== 'S' || grid[y - 1][x] !== '.') continue;
        const room = roomAt(this.level, x * TILE + 8, y * TILE - 8), village = room && room.type === 'village';
        if (!room || room.lab || room.arenaStyle) continue;   // 연구소 안엔 풀·버섯이 없다 · 보스 결전장은 그 방 그림이 제 장식을 그린다 (systems/ArenaArt.js)
        const gy = y * TILE + 2, ledge = c => grid[y][c] !== 'S' || grid[y - 1][c] === 'S';   // 옆 칸이 같은 높이 바닥이 아니다 (턱 끝 · 벽)
        if (Math.random() < .5) {
          const key = `dec:grass:${this.si}:${Math.floor(Math.random() * 3)}`, f = this.footOf(key), hw = (f.r - f.l + 1) / 2;
          let gx = x * TILE + rand(1, 14);
          if (ledge(x - 1)) gx = Math.max(gx, x * TILE + hw); if (ledge(x + 1)) gx = Math.min(gx, x * TILE + TILE - hw);   // 땅 밀착: 턱 끝 밖으로 삐져나와 허공에 뜨지 않게
          const g = this.lit(s.add.image(gx, gy + 1 + f.pad, key).setOrigin(.5, 1).setDepth(13).setFlipX(Math.random() < .5));
          g.ph = x * .37 + Math.random(); this.grass.push(g);
        }
        if (village && Math.random() < .3) this.lit(s.add.image(x * TILE + rand(2, 13), gy - 1, `dec:flower:${Math.floor(Math.random() * 4)}`).setOrigin(.5, 1).setDepth(13));
        if (Math.random() < .14) this.lit(s.add.image(x * TILE + rand(2, 13), gy - 1, `dec:pebble:${Math.random() < .5 ? 0 : 1}`).setOrigin(.5, 1).setDepth(13));
        if (!village && Math.random() < (cave || room.under ? .1 : .05)) {   // 동굴·지하엔 빛나는 버섯이 더 많다
          const mx = x * TILE + rand(3, 12);
          this.lit(s.add.image(mx, gy + 1, 'dec:mush').setOrigin(.5, 1).setDepth(13));
          this.add(s.add.image(mx, gy + 1, `dec:mush:${this.si}:e`).setOrigin(.5, 1).setDepth(13.1));
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
    const arenaAt = (x, y) => { const r = roomAtCell(this.level, x, y); return !!(r && r.arenaStyle); };   // 보스 결전장 발판은 그 방 그림이 그린다 (systems/ArenaArt.js)
    const isP = (x, y) => grid[y][x] === 'P' && !hid.has(y * cols + x) && !arenaAt(x, y);
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

  // 기술머신 성역: 화면 안의 성역마다 일반 몹(보스 · 엘리트 · 샌드백 제외)이 고리 안에 들어오면 바깥으로 밀어낸다 (경계에 금빛 불티)
  updateWards(dt, view) {
    const s = this.s;
    for (const w of this.wards || []) {
      if (w.x < view.x - WARD_R || w.x > view.right + WARD_R || w.y < view.y - 80 || w.y > view.bottom + 80) continue;
      for (const e of s.enemies) {
        if (!e.alive || e.boss || e.elite || e.dummy || !e.b) continue;
        const dx = e.x - w.x, dy = e.bottom - w.y;
        if (Math.abs(dx) >= WARD_R || dy < -80 || dy > 20) continue;
        const sg = Math.sign(dx) || (e.face || 1);
        e.b.x += sg * Math.min(5, WARD_R - Math.abs(dx));
        e.b.setVelocityX(sg * Math.max(Math.abs(e.b.velocity.x), 90));
        if (Math.random() < .2) s.fx.burst(w.x + sg * WARD_R, e.y, [0xffe8a0, 0xffffff], 1, 40, { grav: -30, bounce: false, glow: true, life: .35, size: 1 });
      }
    }
  }
  update(time, dt = .016) {
    const t = time / 1000, view = this.s.cameras.main.worldView, L = view.x - 20, R = view.right + 20, U = view.y - 40, D = view.bottom + 40;
    this.updateWards(dt, view);
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
    for (const p of this.pulses) if (p.o.x > L - 200 && p.o.x < R + 200 && p.o.y > U - 200 && p.o.y < D + 200) p.o.setAlpha(Math.max(0, p.base + Math.sin(t * p.sp) * p.amp));
    for (const it of this.interacts) if (it.kind === 'tm' && !it.used) this.tmResonance(it, dt); else if (it.kind === 'terminal') this.terminalNear(it);
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
      if (e.gone) continue;
      e.t -= dt;
      if (e.t <= 0) { e.open = !e.open; e.t = e.open ? 1.2 + Math.random() * 2.5 : 2 + Math.random() * 5; }
      const a = e.open ? Math.min(1, (e.pair[0].alpha || 0) + dt * 3) : Math.max(0, e.pair[0].alpha - dt * 4);
      e.pair.forEach(o => o.setAlpha(a * .95));
    }
    for (const f of this.fogs) f.tilePositionX += dt * f.sp;
    this.updateAsh(dt, view);
    this.updateBellTower(view);
    this.updateSinnoh(dt, view);
    this.updateHeroes(dt, view);
    this.updateGalar(dt, view);
    for (const w of this.waves || []) w.tilePositionX += dt * 18;   // 출렁이는 바닷물 · 파도
    if (this.runes) {   // 하늘기둥 델타 룬: 황금 ↔ 에메랄드로 천천히 맥동
      const c = Phaser.Display.Color.Interpolate.RGBWithRGB(255, 224, 128, 74, 255, 176, 100, (Math.sin(time / 700) + 1) * 50);
      for (const o of this.runes) o.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    }
    for (const m of this.mush) if (m.x > L && m.x < R && m.y > U && m.y < D) m.setAlpha(.35 + Math.sin(t * 2 + m.ph) * .2);
    for (const f of this.flies) {
      if (f.home.x < L - 60 || f.home.x > R + 60 || f.home.y < U - 40 || f.home.y > D + 40) continue;
      f.x = f.home.x + Math.sin(t * f.sp + f.ph) * 26 + Math.sin(t * 1.7 * f.sp + f.ph * 2) * 8;
      f.y = f.home.y + Math.cos(t * f.sp * .8 + f.ph) * 14;
      f.setAlpha(.45 + Math.sin(t * 3 + f.ph * 3) * .4);
    }
  }

  // 기술머신 공명: 플레이어가 다가가면 에너지 기둥이 솟고 빛 알갱이가 늘어난다 (멀어지면 가라앉는다)
  tmResonance(it, dt) {
    const s = this.s, p = s.player, near = !!p && Math.abs(p.x - it.x) < 90 && Math.abs(p.bottom - it.y) < 70;
    if (near !== it.near) {
      it.near = near;
      s.tweens.killTweensOf(it.beam);
      s.tweens.add({ targets: it.beam, alpha: near ? .6 : .14, scaleX: near ? .8 : .5, scaleY: near ? 6 : 3, y: near ? it.y - 110 : it.y - 70, duration: near ? 500 : 700, ease: 'Cubic.easeOut' });
      if (near) { Sfx.play('resonate'); s.fx.ring(it.x, it.y - 4, 40, 0x8ae8ff, 420); }
      if (it.lightObj) it.lightObj.setIntensity(near ? 3 : 2.1);
    }
    const v = s.cameras.main.worldView, seen = it.x > v.x - 60 && it.x < v.right + 60 && it.y > v.y - 60 && it.y < v.bottom + 140;   // 화면 밖 기술머신은 불씨를 뿜지 않는다
    if (seen && Math.random() < (near ? .7 : .16)) s.fx.embers(it.x + (Math.random() - .5) * 30, it.y - 10 - Math.random() * (near ? 90 : 50), near ? [0xffd25a, 0xb08aff, 0xffffff] : [0x9ad8ff, 0xffffff], 1, { speed: near ? 40 : 12 });
  }

  // 간이 회복기 쉼터: 아치형 돌벽감(따뜻한 빛) · 표지판 반대편에 나무 벤치 · 그 너머 주황 가로등 · 떠다니는 평화로운 빛무리
  //  적은 들어오지 못한다 (GameScene.guardSafeZones) — 어두운 던전 속에서 숨을 돌리는 자리
  shelter(tm, x, Y, signX) {
    const s = this.s, G = this.level.grid;
    const floor = tx => G[tm.g] && (G[tm.g][tx] === 'S' || G[tm.g][tx] === 'B') && [1, 2, 3].every(h => G[tm.g - h] && G[tm.g - h][tx] === '.');
    const ak = shelterArchArt(s), ay = this.standY(ak, x, .5, tm.g, { sink: 1, up: 0, down: 0 });
    if (ay !== null) this.add(s.add.image(x, ay, ak).setOrigin(.5, 1).setDepth(5.6).setAlpha(.95));   // 땅 밀착: 아치 두 기둥이 다 바닥을 디딜 때만
    this.add(s.add.image(x, Y - 26, 'glow').setBlendMode(ADD).setTint(0xffb060).setScale(2.6, 1.4).setAlpha(.18).setDepth(5.65));
    const side = signX !== null && signX < x ? 1 : -1;   // 표지판 반대쪽에 벤치
    const tx = Math.floor(x / TILE);
    const bx = [2, 3].map(d => tx + side * d).find(t => floor(t) && floor(t + 1));
    if (bx !== undefined) this.lit(s.add.image(bx * TILE + 16, Y + 1, benchArt(s)).setOrigin(.5, 1).setDepth(6.35).setFlipX(side < 0));
    const lx = [4, 5, -4].map(d => tx + side * d).find(t => floor(t));
    if (lx !== undefined) {
      const lampX = lx * TILE + 8;
      this.lit(s.add.image(lampX, Y + 1, streetlampArt(s)).setOrigin(.5, 1).setDepth(6.36));
      const halo = this.glow(lampX, Y - 41, .9, 0xffb060, .55, 6.37);
      this.add(s.add.image(lampX, Y - 1, 'glow').setBlendMode(ADD).setTint(0xffa050).setScale(1.4, .25).setAlpha(.35).setDepth(5.95));   // 발밑에 고인 불빛
      const L = this.light(lampX, Y - 38, 120, 0xffb060, 1.4);
      this.flickers.push({ objs: [halo], base: [.55], rate: .25, light: L, lightK: 1.4, off: 0 });
    }
    // 빛무리: 쉼터 안을 천천히 떠오르다 사라지는 금빛·청록빛 알갱이
    for (let k = 0; k < 7; k++) {
      const m = this.add(s.add.image(x + (k - 3) * 11, Y - 6, 'glow').setBlendMode(ADD).setTint(k % 2 ? 0xffe0a0 : 0x8affd8).setScale(.08 + (k % 3) * .03).setAlpha(0).setDepth(6.6));
      s.tweens.add({ targets: m, y: Y - 44 - (k % 3) * 8, alpha: { from: .9, to: 0 }, x: m.x + (k % 2 ? 6 : -6), duration: 2600 + k * 230, delay: k * 380, repeat: -1 });
    }
  }

  // 간이 회복기: 반경 안에 들어서면 연결(자동 저장 + 부활 자리) — 들어설 때마다 한 번
  terminalNear(it) {
    const s = this.s, p = s.player, near = !!p && Math.abs(p.x - it.x) < 70 && Math.abs(p.bottom - it.y) < 50;
    if (near === it.near) return;
    it.near = near;
    s.tweens.killTweensOf(it.beam);
    s.tweens.add({ targets: it.beam, alpha: near ? .45 : .12, scaleY: near ? 3.2 : 1.6, y: near ? it.y - 70 : it.y - 50, duration: 500, ease: 'Cubic.easeOut' });
    if (near && s.linkTerminal) s.linkTerminal(it);
  }
  // 기술머신 작동: 캡슐 뚜껑이 들리고 증기·빛을 뿜는다 → done() (카드 화면). 이미 연 캡슐은 바로
  openTM(it, done) {
    const s = this.s;
    if (it.opened) { done(); return; }
    it.opened = true;
    Sfx.play('steam');
    s.tweens.add({ targets: it.cap, y: it.y - 96, angle: -8, duration: 420, ease: 'Back.easeOut' });
    s.tweens.add({ targets: it.glass, alpha: .35, duration: 300 });
    for (const side of [-1, 1]) s.fx.burst(it.x + side * 18, it.y - 70, [0xe8e8f0, 0xffffff, 0xc8c8d8], 14, 90, { angle: -Math.PI / 2 + side * .7, spread: .5, up: 70, grav: -30, bounce: false, life: .9, size: 2 });
    s.fx.burst(it.x, it.y - 74, [0xffd25a, 0xb08aff, 0xffffff], 26, 160, { up: 120, glow: true, life: .8 });
    s.fx.glow(it.x, it.y - 50, 60, 0xffe8b0, 500, 1); s.fx.ring(it.x, it.y - 50, 50, 0xffd25a, 420);
    s.cameras.main.flash(260, 255, 236, 200, true); s.fx.shake(.008, 260);
    s.tweens.add({ targets: it.disc, y: it.y - 64, scale: 1.6, duration: 500, ease: 'Cubic.easeOut' });
    s.time.delayedCall(650, done);
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
  //  src: 무엇으로 쳤나 ('charge' 차징 샷 · 'dive' 공중 내려찍기) — 안 주면 지금 출전 포켓몬의 동작으로 가늠한다
  hitRect(rect, src) {
    const a = this.s.player && this.s.player.action;
    src = src || (a && a.dive ? 'dive' : a && a.slot === 'charge' ? 'charge' : null);
    let n = 0;
    for (const c of this.crates) {
      if (!c.alive || c.x + 7 < rect.x || c.x - 7 > rect.x + rect.w || c.y + 7 < rect.y || c.y - 7 > rect.y + rect.h) continue;
      if (c.need && c.need !== src) { this.nudge(c); continue; }   // 연습용 과녁: 그 기술로만
      this.breakCrate(c); n++;
    }
    for (const pd of this.pads || []) {   // 차원 도약 수정을 치면: 곁에 있으면 솟구치고, 멀면 반짝이기만
      if (pd.cd > 0 || pd.x + 12 < rect.x || pd.x - 12 > rect.x + rect.w || pd.y < rect.y || pd.y - 22 > rect.y + rect.h) continue;
      const p = this.s.player;
      if (p && p.launchT <= 0 && Math.abs(p.x - pd.x) < 40 && p.bottom > pd.y - 90 && p.bottom < pd.y + 6) this.launchPad(pd);
      else { pd.cd = .3; this.s.fx.glow(pd.x, pd.y - 12, 26, 0xc08aff, 220, .8); }
    }
    return n;
  }
  hitCircle(cx, cy, r, src) { return this.hitRect({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, src); }

  // 연습용 과녁 (관동 초입 조작 힌트 NPC 옆 · game/Npc.js): need 'charge' 낡은 나무 상자 · 'dive' 금이 간 바위
  //  그 기술로만 부서지고(평타엔 꿈쩍도 않으며 힌트를 띄운다) 3.5초 뒤 다시 놓인다. 월드 데이터(level.props)가 아니라 저장 서명과 상관없다
  practice(x, y, need) {
    const s = this.s, img = this.lit(s.add.image(x, y, need === 'dive' ? crackedRockArt(s) : crateArt(s)).setOrigin(.5, 1).setDepth(15));
    if (need === 'charge') img.setTint(0xd8c0a0);   // 오래돼 바랜 나무
    this.crates.push({ img, x, y: y - 7, alive: true, need, practice: true });
  }
  // 맞았지만 그 기술이 아닐 때: 살짝 흔들리고 힌트 (자주 띄우지 않는다)
  nudge(c) {
    const s = this.s;
    if (s.time.now - (c.nudgeAt || 0) < 700) return;
    c.nudgeAt = s.time.now;
    s.tweens.add({ targets: c.img, x: { from: c.x - 1.5, to: c.x }, duration: 60, repeat: 2 });
    s.fx.burst(c.x, c.y, [0xd8d0c0, 0x8a8898], 3, 50, { up: 40, size: 1 });
    if (s.time.now - (this.nudgeTip || 0) > 2200) {
      this.nudgeTip = s.time.now;
      const touch = s.touchInput && s.touchInput.on;
      s.fx.floatText(c.x, c.y - 12, c.need === 'dive' ? (touch ? '꿈쩍도 않는다… 공중에서 ↓ + 평타!' : '꿈쩍도 않는다… 공중에서 ↓ + Z!') : (touch ? '꿈쩍도 않는다… 평타 버튼을 꾹 눌렀다 떼 보자!' : '꿈쩍도 않는다… Z 를 꾹 눌렀다 떼 보자!'), '#ffd166', 9);
    }
  }

  breakCrate(c) {
    c.alive = false;
    const s = this.s;
    if (c.practice) {   // 연습용 과녁: 시원하게 터지고 3.5초 뒤 다시 놓인다
      const rock = c.need === 'dive';
      s.fx.burst(c.x, c.y, rock ? [0x6a6878, 0x9a98a8, 0x3a3848] : [0x8a5e34, 0xb88a54, 0x4a2e1a], 26, 190, { up: 150 });
      s.fx.burst(c.x, c.y, [0xffd166, 0xffffff], 10, 120, { up: 90, glow: true });
      s.fx.ring(c.x, c.y, 22, 0xffd166, 260); s.fx.shake(.008, 140, 'hit');
      s.fx.floatText(c.x, c.y - 14, rock ? '내려찍기 성공!' : '차징 샷 명중!', '#ffd166', 10);
      Sfx.play(rock ? 'shatter' : 'crate');
      s.tweens.add({ targets: c.img, scaleX: 1.4, scaleY: .4, alpha: 0, duration: 140, onComplete: () => c.img.setVisible(false) });
      s.time.delayedCall(3500, () => {
        if (!c.img.scene) return;
        c.alive = true;
        c.img.setVisible(true).setScale(1).setAlpha(0);
        s.tweens.add({ targets: c.img, alpha: 1, duration: 300 });
      });
      return;
    }
    s.fx.burst(c.x, c.y, [0x8a5e34, 0xb88a54, 0x4a2e1a], 14, 130, { up: 110 });
    s.fx.burst(c.x, c.y, [0xd8c8a0], 4, 60, { up: 60, size: 1 });
    Sfx.play('crate');
    s.tweens.add({ targets: c.img, scaleX: 1.3, scaleY: .5, alpha: 0, duration: 120, onComplete: () => c.img.setVisible(false) });
    if (Math.random() < .14) s.spawnPickup('oran', c.x, c.y - 4);
  }

  // ---------------- 상호작용 ----------------
  // 여닫이 문 하나: 문틀 안쪽 빛(열렸을 때만) · 문짝(왼쪽 경첩) · 열리면 새어 나오는 빛. x·bottom 은 문 왼쪽 아래
  door(x, bottom, w, h, wood, day, depth) {
    const s = this.s;
    const gap = this.add(s.add.image(x, bottom, doorGapArt(s, w, h, day)).setOrigin(0, 1).setDepth(depth).setVisible(false));
    const panel = this.lit(s.add.image(x, bottom, doorArt(s, w, h, wood)).setOrigin(0, 1).setDepth(depth + .01));
    const spill = this.glow(x + w / 2, bottom - h * .45, Math.max(.5, h / 60), day ? 0xe8f6ff : 0xffd890, 0, depth + .02);
    return { gap, panel, spill };
  }
  // 문 열기 · 닫기 (instant: 연출 없이 바로)
  openDoor(it, instant = false) {
    const d = it.door, tw = this.s.tweens;
    if (!d) return;
    tw.killTweensOf([d.panel, d.spill]);
    d.gap.setVisible(true);
    if (instant) { d.panel.scaleX = .14; d.spill.setAlpha(.55); return; }
    tw.add({ targets: d.panel, scaleX: .14, duration: 200, ease: 'Quad.easeOut' });
    tw.add({ targets: d.spill, alpha: .55, duration: 200 });
  }
  shutDoor(it, instant = false) {
    const d = it.door, tw = this.s.tweens;
    if (!d) return;
    tw.killTweensOf([d.panel, d.spill]);
    if (instant) { d.panel.scaleX = 1; d.spill.setAlpha(0); d.gap.setVisible(false); return; }
    tw.add({ targets: d.panel, scaleX: 1, duration: 220, ease: 'Quad.easeIn', onComplete: () => d.gap.setVisible(false) });
    tw.add({ targets: d.spill, alpha: 0, duration: 260 });
  }

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
      this.s.tweens.killTweensOf([it.disc, it.halo, it.core, it.beam].filter(Boolean));
      if (it.core) this.s.tweens.add({ targets: it.core, alpha: 0, duration: 500 });
      if (it.cap) this.s.tweens.add({ targets: it.cap, y: it.y - 73, angle: 0, duration: 400 });
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
    this.revFalls = []; this.pads = []; this.phase = []; this.rift = null; this.lifts = []; this.fields = []; this.coils = [];
    this.byRoom = null;
  }
}
