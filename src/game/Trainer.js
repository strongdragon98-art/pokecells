// 아레나 뒤편 단상의 세뇌된 트레이너 (신오 챔피언 난천 · 최종장 레드)
//  절차적 고밀도 도트(28×48, 2배로 그림) — 무한다이노의 검붉은 꼭두각시 실이 머리와 두 손에 감겨 있고 눈이 붉게 빛난다.
//  싸우지는 않는다: 보스 AI 가 gesture() 로 손짓을 시키면(지시·버프) 손끝이 빛나고 실이 팽팽해진다.
//  throwBall(): 몬스터볼을 던져 포켓몬을 내보낸다 · release(): 실이 끊어지며 정신을 차린다 (눈 색이 돌아온다)
import Phaser from 'phaser';
import { css, shade } from '../systems/Textures.js';

const ADD = Phaser.BlendModes.ADD;
//  w · h: 도트 캔버스 크기 · scale: 화면 배율 — 난천은 28×48 을 2배로, 레드는 40×76 고밀도 도트를 1배로 (슬림하고 정교한 5세대풍 · 예전 28×48 2배는 크고 거칠었다)
//  head · hand · hand2 · cast: 꼭두각시 실이 걸리는 도트 좌표 · throw: 레드가 몬스터볼을 놓는 손 · frames: 대기 모션 (어깨 들썩임 · 재킷 자락 펄럭임 · 모자챙 고쳐 쓰기)
export const TRAINERS = {
  cynthia: { name: '난천', w: 28, h: 48, scale: 2, head: [14, 2], hand: [6, 25], hand2: [21, 29], cast: [2, 16] },
  red: { name: '레드', w: 40, h: 76, scale: 1, head: [20, 2], hand: [9, 41], hand2: [30, 38], cast: [2, 28], throw: [27, 5], frames: true }
};

function tex(scene, key, draw, W = 28, H = 48) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, W, H), c = t.getContext();
  const F = (x, y, w, h, col, a = 1) => { c.globalAlpha = a; c.fillStyle = css(col); c.fillRect(x, y, w, h); c.globalAlpha = 1; };
  draw(F);
  t.refresh();
  return key;
}

// 난천: 허리까지 내려오는 금발(앞머리가 한쪽 눈을 가림) · 검은 머리 장식 · 털 칼라 검은 롱코트 · 검은 바지와 부츠 (왼쪽을 본다)
function cynthia(F, pose, eye) {
  const hairL = 0xf4e08a, hair = 0xd8b858, hairD = 0x9a7a34, skin = 0xf4dcc8, skinD = 0xd4b4a0;
  const coat = 0x1a1820, coatL = 0x2e2c38, fur = 0x34323e, furL = 0x4a4858, inner = 0x0c0b10, pants = 0x121118;
  // 뒷머리 (등 뒤로 허리까지)
  F(12, 6, 10, 26, hairD); F(13, 6, 8, 24, hair); F(19, 10, 4, 22, hairD); F(14, 28, 6, 4, hairD);
  // 다리 · 부츠
  F(10, 34, 4, 10, pants); F(15, 34, 4, 10, pants); F(9, 43, 6, 4, inner); F(15, 43, 6, 4, inner); F(9, 46, 6, 1, coatL); F(15, 46, 6, 1, coatL);
  // 롱코트 (아래로 퍼진다)
  F(8, 16, 13, 20, coat); F(7, 30, 15, 7, coat); F(6, 34, 3, 3, coat); F(20, 34, 3, 3, coat);
  F(13, 18, 2, 18, inner); F(9, 17, 1, 18, coatL); F(7, 36, 15, 1, coatL);
  // 털 칼라
  F(7, 14, 15, 4, fur); F(8, 13, 13, 2, furL); F(6, 16, 3, 2, fur); F(20, 16, 3, 2, fur);
  // 팔
  if (pose === 'cast') {   // 왼팔을 앞(왼쪽) 위로 뻗는다
    F(2, 15, 7, 3, coat); F(1, 14, 3, 3, coat); F(1, 13, 2, 2, skin);
  } else { F(6, 17, 3, 12, coat); F(6, 28, 3, 2, skin); }
  F(20, 17, 3, 12, coat); F(20, 28, 3, 2, skin);
  // 얼굴 · 앞머리
  F(9, 5, 9, 9, skin); F(9, 12, 9, 2, skinD); F(14, 13, 2, 2, skinD);
  F(8, 2, 12, 5, hair); F(8, 1, 10, 2, hairL); F(7, 4, 3, 10, hair); F(7, 6, 2, 12, hairD);   // 얼굴 왼쪽으로 늘어진 앞머리 (왼눈을 가린다)
  F(15, 4, 5, 2, hairL); F(18, 5, 3, 8, hair);
  F(13, 8, 2, 1, eye); F(13, 7, 2, 1, shade(eye, .6));   // 보이는 오른눈
  F(10, 11, 3, 1, 0xc88a8a);
  // 검은 머리 장식 (양쪽 위)
  F(8, 0, 3, 3, 0x0a0a10); F(9, 1, 1, 1, 0x4a4a5a); F(17, 0, 3, 3, 0x0a0a10); F(18, 1, 1, 1, 0x4a4a5a);
}

// 레드 (40×76 · 1배 · 왼쪽을 본다): 흰 앞판의 빨간 모자 — 챙 그림자 아래 날카로운 눈 · 검은 머리 · 흰 칼라의 빨간 반팔 재킷(자락이 바람에 날린다)
//  · 검은 속셔츠 · 어깨에 멘 노란 배낭과 끈 · 슬림한 청바지 · 빨간 운동화 · 앞손에 쥔 몬스터볼
//  pose: idle(f 0 · 1 · 2 — 숨쉬기 · 자락 펄럭임) · cap(챙 고쳐 쓰기) · cast(볼을 앞으로) · throw0(어깨 뒤로 젖힘) · throw1(내던진 손) · sleep(눈 감음)
function redHD(F, pose, eye, f = 0) {
  const P = (x, y, col, a) => F(x, y, 1, 1, col, a);
  const cap = 0xd42a2c, capL = 0xf0545a, capD = 0x8a1418, capDD = 0x5a0c10, white = 0xf4f2ec, whiteD = 0xc8c4c0;
  const hair = 0x16121a, hairL = 0x34303e, skin = 0xf2d2b4, skinS = 0xd8b094, skinD = 0xb08670;
  const jk = 0xc8282a, jkL = 0xe85050, jkD = 0x7a1416, sh = 0x141218, shL = 0x2e2c38;
  const jean = 0x2c4c8c, jeanL = 0x4a6eb0, jeanD = 0x1a2e5c, bag = 0xe8c040, bagD = 0xa87c18, strap = 0x3a3438;
  const up = pose === 'idle' && f === 1 ? -1 : 0;   // 숨 들이쉴 때 상체가 1px 올라간다 (어깨 들썩임)
  // ── 다리 · 신발
  F(14, 47, 5, 23, jean); F(21, 47, 5, 23, jean); F(14, 47, 1, 23, jeanL); F(21, 47, 1, 23, jeanL); F(18, 47, 1, 22, jeanD); F(25, 47, 1, 22, jeanD);
  F(14, 57, 5, 1, jeanD); F(21, 58, 5, 1, jeanD);   // 무릎 주름
  F(10, 69, 9, 4, jk); F(10, 72, 9, 2, white); F(10, 69, 3, 3, white); F(19, 70, 8, 3, jk); F(19, 72, 8, 2, white); F(25, 70, 2, 2, jkD);
  F(10, 74, 17, 1, 0x2a2026);
  // ── 배낭 (등 뒤 = 오른쪽) · 아래로 처진 덮개
  F(27, 24 + up, 7, 17, bagD); F(28, 25 + up, 5, 15, bag); F(28, 25 + up, 5, 3, 0xf8dc70); F(28, 33 + up, 5, 1, bagD); F(32, 26 + up, 1, 13, bagD);
  // ── 뒷팔 (오른팔 · 배낭 앞)
  if (pose !== 'throw0') { F(27, 23 + up, 4, 8, jkD); F(28, 31 + up, 3, 6, skinS); F(28, 37 + up, 3, 3, skinD); }
  // ── 재킷 몸통 · 속셔츠 · 칼라
  F(12, 23 + up, 16, 22, jk); F(12, 23 + up, 1, 22, jkL); F(13, 24 + up, 2, 18, jkL); F(26, 24 + up, 2, 20, jkD);
  F(18, 24 + up, 4, 20, sh); F(18, 24 + up, 1, 20, shL);
  F(12, 21 + up, 16, 3, white); F(12, 23 + up, 16, 1, whiteD); F(16, 22 + up, 8, 2, sh);   // 흰 칼라 · 목둘레
  // 배낭 끈: 오른 어깨 → 왼 허리
  for (let k = 0; k < 16; k++) P(26 - Math.round(k * .62), 23 + up + k, strap);
  // 재킷 자락 (펄럭임): f 0 가지런히 · 1 살짝 · 2 바람에 뒤로 날린다
  F(12, 45, 16, 2, jk); F(12, 46, 16, 1, jkD);
  if (pose === 'idle' && f === 2) { F(27, 42, 3, 3, jk); F(28, 45, 3, 2, jkD); P(30, 44, jk); }
  else if (pose === 'idle' && f === 1) { F(27, 44, 2, 2, jk); }
  else F(26, 44, 2, 2, jkD);
  // ── 앞팔 (왼팔)
  const ball = (x, y) => { F(x + 1, y, 3, 1, 0xe0282a); F(x, y + 1, 5, 1, 0xe0282a); F(x, y + 2, 5, 1, 0x1a1414); F(x, y + 3, 5, 1, white); F(x + 1, y + 4, 3, 1, white); P(x + 2, y + 2, white); P(x + 1, y + 1, 0xff8a8a); };
  if (pose === 'cast') { F(4, 25 + up, 9, 4, jk); F(4, 25 + up, 9, 1, jkL); F(1, 26 + up, 4, 3, skin); ball(0, 22 + up); }
  else if (pose === 'throw0') { F(25, 13, 4, 10, jk); F(26, 8, 3, 6, skin); ball(25, 3); F(27, 23, 4, 8, jkD); }   // 볼을 어깨 뒤로 젖힌다
  else if (pose === 'throw1') { F(4, 26 + up, 9, 4, jk); F(1, 27 + up, 4, 3, skin); P(0, 27 + up, skinS); }        // 내던진 손 (볼은 날아갔다)
  else if (pose === 'cap') { F(9, 14, 4, 10, jk); F(9, 14, 1, 10, jkL); F(6, 9, 4, 5, skin); P(6, 9, skinS); }    // 팔을 들어 챙을 잡는다
  else { F(9, 23 + up, 4, 9, jk); F(9, 23 + up, 1, 9, jkL); F(10, 32 + up, 3, 6, skin); F(12, 32 + up, 1, 6, skinS); if (pose !== 'sleep') ball(7, 38 + up); else F(10, 38 + up, 3, 2, skinS); }
  // ── 목 · 얼굴 · 머리
  F(17, 19 + up, 5, 3, skinS);
  F(13, 9 + up, 11, 11, skin); F(22, 10 + up, 2, 9, skinS); F(13, 18 + up, 9, 2, skinS); P(13, 17 + up, skinD);
  F(13, 9 + up, 11, 2, skinD, .55);   // 챙 그림자
  F(23, 7 + up, 6, 13, hair); F(24, 18 + up, 4, 3, hair); P(28, 20 + up, hair); P(24, 21 + up, hair); F(24, 9 + up, 1, 8, hairL);   // 뒷머리 · 뾰족한 끝
  F(12, 9 + up, 2, 8, hair); P(12, 17 + up, hair);   // 옆머리
  if (pose === 'sleep') { F(14, 14 + up, 3, 1, skinD); F(19, 14 + up, 3, 1, skinD); }
  else {   // 날카로운 눈 (위 눈꺼풀 그늘 · 눈빛)
    F(14, 13 + up, 3, 1, 0x2a1a14); F(19, 13 + up, 3, 1, 0x2a1a14);
    F(14, 14 + up, 2, 1, eye); F(19, 14 + up, 2, 1, eye); P(15, 14 + up, shade(eye, 1.5)); P(20, 14 + up, shade(eye, 1.5));
  }
  P(16, 17 + up, skinD);   // 입가
  // ── 모자: 둥근 정수리 · 흰 앞판 · 왼쪽으로 뻗은 챙 (챙 밑은 짙은 그늘)
  F(15, 1 + up, 11, 1, capD); F(13, 2 + up, 15, 1, cap); F(12, 3 + up, 17, 6, cap); F(12, 3 + up, 17, 1, capL); F(26, 4 + up, 3, 5, capD);
  F(13, 3 + up, 8, 5, white); F(13, 3 + up, 8, 1, 0xffffff); F(20, 4 + up, 1, 4, whiteD); F(14, 7 + up, 6, 1, whiteD);
  P(20, 0 + up, capDD); P(21, 0 + up, capD);   // 꼭지 단추
  F(4, 8 + up, 11, 2, cap); F(4, 8 + up, 11, 1, capL); F(3, 9 + up, 2, 1, cap); F(4, 10 + up, 11, 1, capDD);   // 챙
  if (pose === 'cap') { F(6, 7, 4, 3, skin); P(6, 7, skinS); }   // 챙을 쥔 손가락
}
// (예전 28×48 레드 — 도트를 다시 그리기 전의 모습 · 쓰지 않는다)
function red(F, pose, eye) {
  const cap = 0xd8282a, capD = 0x8a1418, white = 0xf0eee8, hair = 0x1a1414, skin = 0xf0d4b8, skinD = 0xd0b098;
  const jacket = 0xc8282a, jacketD = 0x7a1416, shirt = 0x16141a, jeans = 0x2a4a8a, jeansD = 0x1a2e5a, shoe = 0xc8282a;
  // 다리 · 신발
  F(10, 32, 4, 12, jeans); F(15, 32, 4, 12, jeans); F(13, 32, 2, 10, jeansD);
  F(9, 43, 6, 3, shoe); F(15, 43, 6, 3, shoe); F(9, 46, 6, 1, white); F(15, 46, 6, 1, white);
  // 재킷 · 속셔츠
  F(9, 16, 11, 17, jacket); F(13, 17, 3, 15, shirt); F(9, 30, 11, 3, jacketD); F(9, 16, 1, 16, jacketD);
  F(10, 15, 9, 2, white);   // 흰 칼라
  // 팔 (반팔 + 검은 소매)
  if (pose === 'cast') {   // 몬스터볼을 든 왼팔을 앞으로
    F(2, 16, 8, 3, jacket); F(1, 15, 3, 3, shirt); F(0, 14, 3, 3, white); F(0, 14, 3, 1, 0xd8282a); F(1, 15, 1, 1, 0x1a1414);
  } else if (pose === 'cap') { F(6, 13, 3, 5, jacket); F(5, 8, 3, 5, shirt); }   // 왼팔을 들어 모자 챙을 고쳐 쓴다
  else { F(6, 17, 3, 6, jacket); F(6, 23, 3, 5, shirt); F(6, 28, 3, 2, skin); }
  F(20, 17, 3, 6, jacket); F(20, 23, 3, 5, shirt); F(20, 28, 3, 2, skin);
  // 얼굴 · 머리
  F(9, 6, 9, 9, skin); F(9, 13, 9, 2, skinD);
  F(8, 7, 2, 7, hair); F(17, 7, 3, 7, hair); F(9, 6, 9, 2, hair); F(18, 12, 2, 3, hair);
  if (pose === 'sleep') { F(11, 10, 2, 1, 0x8a6a5a); F(15, 10, 2, 1, 0x8a6a5a); }   // 감은 눈
  else { F(11, 10, 2, 1, eye); F(15, 10, 2, 1, eye); F(11, 9, 2, 1, shade(eye, .6)); F(15, 9, 2, 1, shade(eye, .6)); }
  // 모자 (앞판은 흰색, 챙은 왼쪽으로)
  F(9, 1, 11, 5, cap); F(11, 1, 6, 4, white); F(13, 2, 2, 2, cap); F(3, 5, 9, 2, cap); F(3, 6, 9, 1, capD); F(9, 0, 11, 1, capD);
  if (pose === 'cap') { F(4, 4, 4, 3, skin); F(4, 6, 4, 1, skinD); }   // 챙을 잡은 손
}

const ART = { cynthia, red: redHD };
void red;
export function makeTrainerArt(scene, kind) {
  const draw = ART[kind], d = TRAINERS[kind], W = d.w, H = d.h;
  const evil = 0xff2a4a, calm = kind === 'red' ? 0x3a6aa8 : 0x4a3a5a;   // 세뇌된 붉은 눈빛 · 정신을 차린 눈 (레드는 챙 그림자 밑에서 푸르게 가볍게 빛난다)
  for (const [pose, eye, key] of [['idle', evil, 'idle'], ['cast', evil, 'cast'], ['idle', calm, 'free']])
    tex(scene, `trainer:${kind}:${key}`, F => draw(F, pose, eye), W, H);
  if (kind === 'red') {   // 대기 모션 프레임 · 몬스터볼 던지기 · 결정 속에 잠든 레드 · 모자를 고쳐 쓰는 레드 (GameScene 유대의 불꽃 시네마틱)
    for (const f of [1, 2]) { tex(scene, `trainer:red:idle${f}`, F => draw(F, 'idle', evil, f), W, H); tex(scene, `trainer:red:free${f}`, F => draw(F, 'idle', calm, f), W, H); }
    tex(scene, 'trainer:red:throw0', F => draw(F, 'throw0', evil), W, H);
    tex(scene, 'trainer:red:throw1', F => draw(F, 'throw1', evil), W, H);
    tex(scene, 'trainer:red:sleep', F => draw(F, 'sleep', calm), W, H);
    tex(scene, 'trainer:red:cap', F => draw(F, 'cap', calm), W, H);
    tex(scene, 'trainer:red:capb', F => draw(F, 'cap', evil), W, H);
  }
  // 단상: 금 간 석판 두 단
  if (!scene.textures.exists('trainer:dais')) {
    const t = scene.textures.createCanvas('trainer:dais', 52, 12), c = t.getContext();
    const F = (x, y, w, h, col) => { c.fillStyle = css(col); c.fillRect(x, y, w, h); };
    F(4, 0, 44, 5, 0x4a4652); F(4, 0, 44, 1, 0x6a6674); F(0, 5, 52, 7, 0x34303c); F(0, 5, 52, 1, 0x5a5664);
    F(14, 1, 1, 4, 0x2a2630); F(30, 6, 1, 5, 0x24202a); F(40, 2, 1, 3, 0x2a2630);
    t.refresh();
  }
  if (!scene.textures.exists('trainer:ball')) {
    const t = scene.textures.createCanvas('trainer:ball', 8, 8), c = t.getContext();
    const F = (x, y, w, h, col) => { c.fillStyle = css(col); c.fillRect(x, y, w, h); };
    F(2, 0, 4, 1, 0xd8282a); F(1, 1, 6, 3, 0xd8282a); F(0, 2, 8, 2, 0xd8282a); F(0, 4, 8, 1, 0x1a1414); F(0, 5, 8, 1, 0xf0eee8); F(1, 6, 6, 1, 0xf0eee8); F(2, 7, 4, 1, 0xf0eee8); F(3, 3, 2, 2, 0xf0eee8);
    t.refresh();
  }
}

export class Trainer {
  // x: 단상 가운데 · face: -1 왼쪽을 본다(기본) · 1 오른쪽
  constructor(scene, kind, room, x, face = -1) {
    makeTrainerArt(scene, kind);
    const def = TRAINERS[kind];
    this.s = scene; this.kind = kind; this.room = room; this.name = def.name; this.def = def;
    this.x = x; this.y = scene.floorAt(x, room); this.face = face;
    this.freed = false; this.t = 0; this.castT = 0; this.snapT = 0;
    this.dais = scene.add.image(x, this.y + 1, 'trainer:dais').setOrigin(.5, 1).setDepth(8.2);
    this.aura = scene.add.image(x, this.y - 46, 'glow').setBlendMode(ADD).setTint(0xff1a3a).setScale(1.6, 2.4).setAlpha(.35).setDepth(8.3);
    this.sprite = scene.add.image(x, this.y - 10, `trainer:${kind}:idle`).setOrigin(.5, 1).setScale(def.scale).setDepth(8.5).setFlipX(face > 0);
    this.frameT = 0; this.capT = 4 + Math.random() * 3;   // 대기 모션 (레드)
    this.strings = scene.add.graphics().setDepth(8.4).setBlendMode(ADD);
    this.handGlow = scene.add.image(x, this.y, 'glow').setBlendMode(ADD).setTint(0xff3a5a).setScale(.5).setAlpha(0).setDepth(8.6);
  }
  // 몸 위의 점 (텍스처 좌표 → 월드 좌표, 2배 · 좌우 반전 반영)
  pt(px, py) { const d = this.def, sx = this.face > 0 ? d.w - px : px; return { x: this.x + (sx - d.w / 2) * d.scale, y: this.y - 10 - (d.h - py) * d.scale }; }

  update(dt) {
    this.t += dt;
    const bob = this.def.frames ? 0 : Math.round(Math.sin(this.t * 1.6) * 1);
    this.sprite.y = this.y - 10 + bob;
    const base = this.freed ? 'free' : 'idle';
    if (this.castT > 0) { this.castT -= dt; if (this.castT <= 0) this.sprite.setTexture(`trainer:${this.kind}:${base}`); }
    else if (this.def.frames) {   // 레드 대기 모션: 숨쉬기(어깨 들썩) · 재킷 자락 펄럭임 0 → 1 → 2 → 1 · 가끔 모자챙을 고쳐 쓴다
      this.frameT += dt; this.capT -= dt;
      if (this.capT <= 0) { this.capT = 6 + Math.random() * 4; this.castT = .7; this.sprite.setTexture(`trainer:${this.kind}:${this.freed ? 'cap' : 'capb'}`); }
      else { const i = Math.floor(this.frameT / .32) % 4, fr = [0, 1, 2, 1][i]; this.sprite.setTexture(`trainer:${this.kind}:${base}${fr ? fr : ''}`); }
    }
    const g = this.strings; g.clear();
    if (!this.freed || this.snapT > 0) {
      // 꼭두각시 실: 아레나 천장에서 머리·두 손으로 (천천히 흔들린다 · 손짓할 때 팽팽하게 밝아진다)
      if (this.snapT > 0) this.snapT -= dt;
      const k = this.freed ? Math.max(0, this.snapT / .8) : 1, tight = this.castT > 0 ? 1 : 0, top = this.room.top;
      const ends = [this.pt(...this.def.head), this.pt(...(this.castT > 0 ? this.def.cast : this.def.hand)), this.pt(...this.def.hand2)];
      ends.forEach((e, i) => {
        const sway = Math.sin(this.t * (1.1 + i * .3) + i) * (tight ? 2 : 7), x0 = e.x + sway * 3 + (i - 1) * 18;
        const y1 = this.freed ? e.y - (1 - k) * 60 : e.y;   // 끊어지면 위로 말려 올라간다
        g.lineStyle(3, 0xff1a3a, (.12 + tight * .12) * k); g.lineBetween(x0, top, e.x + sway, y1);
        g.lineStyle(1, tight ? 0xffa0b0 : 0xff3a5a, (.7 + tight * .3) * k); g.lineBetween(x0, top, e.x + sway, y1);
      });
    }
    this.aura.setAlpha(this.freed ? Math.max(0, this.aura.alpha - dt * .6) : .3 + Math.sin(this.t * 3) * .08);
    if (this.handGlow.alpha > 0) this.handGlow.setAlpha(Math.max(0, this.handGlow.alpha - dt * 1.5));
  }

  // 손짓: 손끝이 빛나고 실이 팽팽해진다 (지시 · 강화)
  gesture(col = 0xff3a5a) {
    if (this.freed) return;
    this.castT = .8;
    this.sprite.setTexture(`trainer:${this.kind}:cast`);
    const h = this.pt(...this.def.cast);
    this.handGlow.setPosition(h.x, h.y).setTint(col).setAlpha(1).setScale(.8);
    this.s.fx.ring(h.x, h.y, 16, col, 300);
    this.s.fx.burst(h.x, h.y, [col, 0xffffff], 8, 60, { glow: true, up: 10, grav: -20, bounce: false, life: .4 });
  }
  say(line) { this.s.events.emit('say', this.name, line); }

  // 몬스터볼을 던진다: 손에서 포물선 → 떨어진 자리에서 번쩍 → done()
  throwBall(tx, ty, done) {
    const s = this.s;
    if (this.def.throw) {   // 레드: 볼을 어깨 뒤로 가볍게 젖혔다가(throw0) → 앞으로 내던진다(throw1) — 손끝 섬광 없이 담담하게
      this.castT = 1.1; this.sprite.setTexture(`trainer:${this.kind}:throw0`);
      s.time.delayedCall(280, () => { if (this.sprite.active) { this.sprite.setTexture(`trainer:${this.kind}:throw1`); this.launchBall(this.pt(...this.def.throw), tx, ty, done, 520, 90); } });
      return;
    }
    this.gesture(0xffffff);
    this.launchBall(this.pt(...this.def.cast), tx, ty, done, 650, 70);
  }
  launchBall(h, tx, ty, done, ms, arc) {
    const s = this.s;
    const ball = s.add.image(h.x, h.y, 'trainer:ball').setDepth(30).setScale(1.5), o = { k: 0 };
    s.tweens.add({ targets: o, k: 1, duration: ms, ease: 'Sine.easeIn',
      onUpdate: () => { ball.setPosition(h.x + (tx - h.x) * o.k, h.y + (ty - h.y) * o.k - Math.sin(o.k * Math.PI) * arc); ball.angle += 18; },
      onComplete: () => {
        ball.destroy();
        s.fx.ring(tx, ty, 40, 0xffffff, 300); s.fx.glow(tx, ty, 50, 0xffffff, 300, 1);
        s.fx.burst(tx, ty, [0xffffff, 0xff6a6a, 0xffe08a], 18, 140, { glow: true, up: 60, life: .5 });
        if (done) done();
      } });
  }

  // 실이 끊어지며 정신을 차린다
  release(line) {
    if (this.freed) return;
    const s = this.s;
    this.freed = true; this.snapT = .8; this.castT = 0;
    this.sprite.setTexture(`trainer:${this.kind}:free`);
    for (const e of [this.pt(...this.def.head), this.pt(...this.def.hand), this.pt(...this.def.hand2)]) { s.fx.burst(e.x, e.y, [0xff1a3a, 0xffa0b0, 0xffffff], 10, 90, { glow: true, up: 30, life: .5 }); }
    s.fx.ring(this.x, this.y - 46, 40, 0xffffff, 400);
    s.cameras.main.flash(200, 255, 230, 230, true);
    if (line) s.time.delayedCall(500, () => this.say(line));
  }

  destroy() {
    for (const o of [this.dais, this.aura, this.sprite, this.strings, this.handGlow]) o.destroy();
  }
}
