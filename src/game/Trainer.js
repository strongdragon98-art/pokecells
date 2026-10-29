// 아레나 뒤편 단상의 세뇌된 트레이너 (신오 챔피언 난천 · 최종장 레드)
//  절차적 고밀도 도트(28×48, 2배로 그림) — 무한다이노의 검붉은 꼭두각시 실이 머리와 두 손에 감겨 있고 눈이 붉게 빛난다.
//  싸우지는 않는다: 보스 AI 가 gesture() 로 손짓을 시키면(지시·버프) 손끝이 빛나고 실이 팽팽해진다.
//  throwBall(): 몬스터볼을 던져 포켓몬을 내보낸다 · release(): 실이 끊어지며 정신을 차린다 (눈 색이 돌아온다)
import Phaser from 'phaser';
import { css, shade } from '../systems/Textures.js';

const ADD = Phaser.BlendModes.ADD;
export const TRAINERS = {
  cynthia: { name: '난천', hand: [6, 25], cast: [2, 16] },
  red: { name: '레드', hand: [6, 27], cast: [1, 17] }
};
const W = 28, H = 48;

function tex(scene, key, draw) {
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

// 레드: 흰 앞판의 빨간 모자 · 검은 머리 · 흰 칼라의 빨간 반팔 재킷 · 검은 속셔츠 · 청바지 · 빨간 신발
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
  } else { F(6, 17, 3, 6, jacket); F(6, 23, 3, 5, shirt); F(6, 28, 3, 2, skin); }
  F(20, 17, 3, 6, jacket); F(20, 23, 3, 5, shirt); F(20, 28, 3, 2, skin);
  // 얼굴 · 머리
  F(9, 6, 9, 9, skin); F(9, 13, 9, 2, skinD);
  F(8, 7, 2, 7, hair); F(17, 7, 3, 7, hair); F(9, 6, 9, 2, hair); F(18, 12, 2, 3, hair);
  F(11, 10, 2, 1, eye); F(15, 10, 2, 1, eye); F(11, 9, 2, 1, shade(eye, .6)); F(15, 9, 2, 1, shade(eye, .6));
  // 모자 (앞판은 흰색, 챙은 왼쪽으로)
  F(9, 1, 11, 5, cap); F(11, 1, 6, 4, white); F(13, 2, 2, 2, cap); F(3, 5, 9, 2, cap); F(3, 6, 9, 1, capD); F(9, 0, 11, 1, capD);
}

const ART = { cynthia, red };
export function makeTrainerArt(scene, kind) {
  const draw = ART[kind];
  for (const [pose, eye, key] of [['idle', 0xff2a4a, 'idle'], ['cast', 0xff2a4a, 'cast'], ['idle', kind === 'red' ? 0x2a2a3a : 0x4a3a5a, 'free']])
    tex(scene, `trainer:${kind}:${key}`, F => draw(F, pose, eye));
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
    this.x = x; this.y = scene.groundBelow(x, room.bottom - 24); this.face = face;
    this.freed = false; this.t = 0; this.castT = 0; this.snapT = 0;
    this.dais = scene.add.image(x, this.y + 1, 'trainer:dais').setOrigin(.5, 1).setDepth(8.2);
    this.aura = scene.add.image(x, this.y - 46, 'glow').setBlendMode(ADD).setTint(0xff1a3a).setScale(1.6, 2.4).setAlpha(.35).setDepth(8.3);
    this.sprite = scene.add.image(x, this.y - 10, `trainer:${kind}:idle`).setOrigin(.5, 1).setScale(2).setDepth(8.5).setFlipX(face > 0);
    this.strings = scene.add.graphics().setDepth(8.4).setBlendMode(ADD);
    this.handGlow = scene.add.image(x, this.y, 'glow').setBlendMode(ADD).setTint(0xff3a5a).setScale(.5).setAlpha(0).setDepth(8.6);
  }
  // 몸 위의 점 (텍스처 좌표 → 월드 좌표, 2배 · 좌우 반전 반영)
  pt(px, py) { const sx = this.face > 0 ? W - px : px; return { x: this.x + (sx - W / 2) * 2, y: this.y - 10 - (H - py) * 2 }; }

  update(dt) {
    this.t += dt;
    const bob = Math.round(Math.sin(this.t * 1.6) * 1);
    this.sprite.y = this.y - 10 + bob;
    if (this.castT > 0) { this.castT -= dt; if (this.castT <= 0) this.sprite.setTexture(`trainer:${this.kind}:${this.freed ? 'free' : 'idle'}`); }
    const g = this.strings; g.clear();
    if (!this.freed || this.snapT > 0) {
      // 꼭두각시 실: 아레나 천장에서 머리·두 손으로 (천천히 흔들린다 · 손짓할 때 팽팽하게 밝아진다)
      if (this.snapT > 0) this.snapT -= dt;
      const k = this.freed ? Math.max(0, this.snapT / .8) : 1, tight = this.castT > 0 ? 1 : 0, top = this.room.top;
      const ends = [this.pt(14, 2), this.pt(...(this.castT > 0 ? this.def.cast : this.def.hand)), this.pt(21, 29)];
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
    const s = this.s, h = this.pt(...this.def.cast);
    this.gesture(0xffffff);
    const ball = s.add.image(h.x, h.y, 'trainer:ball').setDepth(30).setScale(1.5), o = { k: 0 };
    s.tweens.add({ targets: o, k: 1, duration: 650, ease: 'Sine.easeIn',
      onUpdate: () => { ball.setPosition(h.x + (tx - h.x) * o.k, h.y + (ty - h.y) * o.k - Math.sin(o.k * Math.PI) * 70); ball.angle += 18; },
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
    for (const e of [this.pt(14, 2), this.pt(...this.def.hand), this.pt(21, 29)]) { s.fx.burst(e.x, e.y, [0xff1a3a, 0xffa0b0, 0xffffff], 10, 90, { glow: true, up: 30, life: .5 }); }
    s.fx.ring(this.x, this.y - 46, 40, 0xffffff, 400);
    s.cameras.main.flash(200, 255, 230, 230, true);
    if (line) s.time.delayedCall(500, () => this.say(line));
  }

  destroy() {
    for (const o of [this.dais, this.aura, this.sprite, this.strings, this.handGlow]) o.destroy();
  }
}
