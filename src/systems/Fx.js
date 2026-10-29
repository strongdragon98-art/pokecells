// 타격감 파이프라인: 히트스톱, 카메라 쉐이크, 백색 점멸, 튕기는 픽셀 파티클, 베기 궤적, 잔상, 데미지 텍스트, 발광
import Phaser from 'phaser';
import { Settings } from './Settings.js';
import { pxt as txt } from '../config.js';   // 월드 안 글자는 도트 글꼴

// 카메라 흔들림 배율 (더 줄이거나 늘리려면 여기만): 잔타격 · 큰 순간
const SHAKE_HIT = .5, SHAKE_BIG = .7;

// 베기 검기 3겹 색: [가장자리 오라, 중간, 중심 코어] — 타입마다 (파이리 할퀴기는 fire: 붉은 주황 → 밝은 노랑 → 순백)
export const SLASH_PAL = {
  fire: [0xe0381a, 0xffd84a, 0xffffff], normal: [0x8a8aa4, 0xe8e8f4, 0xffffff], fighting: [0xc8401a, 0xffb070, 0xffffff],
  grass: [0x2a9a3a, 0xb8ff8a, 0xffffff], poison: [0x8a2ac0, 0xe0a0ff, 0xffffff], ghost: [0x4a1a8a, 0xb88aff, 0xffffff],
  dark: [0x3a1050, 0x9a5ad0, 0xf0d8ff], dragon: [0x14807a, 0x6affe8, 0xffffff], steel: [0x5a6a8a, 0xd8e4f4, 0xffffff],
  electric: [0xe0a010, 0xfff27a, 0xffffff], ice: [0x3a9ad0, 0xbff0ff, 0xffffff], water: [0x1a6ad0, 0x9ad8ff, 0xffffff],
  fairy: [0xd04a9a, 0xffc0e8, 0xffffff], flying: [0x6a80d8, 0xd8e4ff, 0xffffff], psychic: [0xd02a7a, 0xffa8d0, 0xffffff],
  rock: [0x8a6a2a, 0xe8d090, 0xffffff], ground: [0x9a7030, 0xf0d898, 0xffffff]
};
const lerpC = (a, b, k) => (Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * k) << 16) | (Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k) << 8) | Math.round((a & 255) + ((b & 255) - (a & 255)) * k);
const palOf = (color, pal) => pal || [color, lerpC(color, 0xffffff, .6), 0xffffff];

// 이펙트용 도트 텍스처 (한 번만 만든다): 음속 충격파 고깔 · 톱니 타격 섬광
function fxTextures(scene) {
  const T = scene.textures;
  const make = (key, w, h, fn) => {
    if (T.exists(key)) return;
    const t = T.createCanvas(key, w, h), c = t.getContext(), img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = fn(x + .5, y + .5); if (!v) continue;
      const [col, a] = Array.isArray(v) ? v : [v, 1], i = (y * w + x) * 4;
      img.data[i] = (col >> 16) & 255; img.data[i + 1] = (col >> 8) & 255; img.data[i + 2] = col & 255; img.data[i + 3] = Math.round(a * 255);
    }
    c.putImageData(img, 0, 0); t.refresh(); t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  };
  // 오른쪽으로 열린 ")" 고깔 고리 (뒤에서 앞으로 밀려나는 음속 돌파 충격파)
  make('fx:cone', 20, 34, (x, y) => {
    const dx = x - 2, dy = y - 17, d = Math.hypot(dx * 1.25, dy), a = Math.abs(Math.atan2(dy, dx));
    if (a > 1.25 || d < 12.5 || d > 16.5) return null;
    return d > 15 ? [0xbfe6ff, .7] : 0xffffff;
  });
  // 12갈래 톱니 별 (긴 가시·짧은 가시 번갈아, 가시마다 길이가 조금씩 다르다)
  const spikes = [1, .55, .9, .5, 1, .6, .85, .5, .95, .55, .8, .5];
  make('fx:star', 33, 33, (x, y) => {
    const dx = x - 16.5, dy = y - 16.5, d = Math.hypot(dx, dy), a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2) * 12;
    const i = Math.floor(a) % 12, f = a - Math.floor(a), r = 16 * (spikes[i] * (1 - f) + spikes[(i + 1) % 12] * f) * (1 - Math.abs(f - .5) * .5);
    if (d > r) return null;
    return d < r * .45 ? 0xffffff : d < r * .75 ? [0xffffff, .85] : [0xffffff, .55];
  });
}

export class Fx {
  constructor(scene) {
    this.s = scene;
    this.parts = [];
    this.arcs = [];
    this.shards = [];
    this.hitStopUntil = 0;
    this.shakeUntil = 0; this.shakeI = 0;
    this.g = scene.add.graphics().setDepth(45);                                          // 일반 픽셀 파티클
    this.ga = scene.add.graphics().setDepth(46).setBlendMode(Phaser.BlendModes.ADD);     // 발광 파티클
    this.gs = scene.add.graphics().setDepth(47);                                         // 베기 검기 (3겹 도트 초승달)
    this.gsa = scene.add.graphics().setDepth(46.9).setBlendMode(Phaser.BlendModes.ADD);   // 검기 바깥 빛 (검기 밑에 깔린다)
    fxTextures(scene);
    this.maxParts = 420;
  }

  // ---- 히트스톱: 물리·애니메이션을 잠깐 멈춘다 ----
  hitStop(ms = 50) {
    const now = performance.now();
    this.hitStopUntil = Math.max(this.hitStopUntil, now + ms);
    const w = this.s.physics.world;
    if (!w.isPaused) { w.pause(); this.s.anims.pauseAll(); this.s.tweens.pauseAll(); }
  }
  // true 를 반환하는 동안 게임 로직을 건너뛴다
  updateHitStop() {
    if (!this.hitStopUntil) return false;
    if (performance.now() < this.hitStopUntil) return true;
    this.hitStopUntil = 0;
    this.s.physics.world.resume(); this.s.anims.resumeAll(); this.s.tweens.resumeAll();
    return false;
  }

  // ---- 카메라 흔들림 ----
  //  잔타격(0.01 미만)은 절반으로, 보스·Z기술 같은 큰 순간은 70%로 줄인다.
  //  이미 더 센 흔들림이 도는 중이면 약한 흔들림이 처음부터 다시 걸지 않는다 (연타·다단히트에 화면이 쉬지 않고 떨리던 문제)
  //  kind: 'hit' 내 공격이 맞을 때 (설정 「타격 흔들림」) · 그 밖(내가 맞을 때 · 보스 공격 · 폭발)은 설정 「피격 흔들림」
  shake(intensity = .006, ms = 120, kind = 'world') {
    const set = Settings.get(kind === 'hit' ? 'shakeHit' : 'shakeHurt');
    if (set <= 0) return;
    const k = intensity >= .01 ? SHAKE_BIG : SHAKE_HIT, i = intensity * k * set, now = performance.now();
    if (now < this.shakeUntil && i <= this.shakeI) return;
    this.shakeI = i; this.shakeUntil = now + ms;
    this.s.cameras.main.shake(ms, i, true);
  }

  // ---- 픽셀 파티클 (바닥에 튕김) ----
  burst(x, y, color, n = 10, speed = 90, o = {}) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.maxParts) this.parts.shift();
      const a = o.angle !== undefined ? o.angle + (Math.random() - .5) * (o.spread ?? 1.2) : Math.random() * Math.PI * 2;
      const sp = speed * (.35 + Math.random() * .75);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 40), life: (o.life ?? .55) * (.6 + Math.random() * .7),
        max: 0, color: Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color, size: o.size ?? (Math.random() < .3 ? 2 : 1),
        grav: o.grav ?? 420, bounce: o.bounce ?? true, glow: !!o.glow, drag: o.drag ?? .985
      });
      this.parts[this.parts.length - 1].max = this.parts[this.parts.length - 1].life;
    }
  }
  // 위로 떠오르는 불씨/포자
  embers(x, y, color, n = 3, o = {}) { this.burst(x, y, color, n, o.speed ?? 30, Object.assign({ up: 30, grav: -40, bounce: false, glow: true, life: .7 }, o)); }

  // ---- 유리 파편: 몸 영역에서 바깥으로 튀고, 90도씩 뒤집히며 반짝이다 바닥에 튕겨 사라진다 ----
  shatter(x, y, w, h, o = {}) {
    const n = o.n ?? 14, speed = o.speed ?? 150, scale = o.scale ?? 1;
    for (let i = 0; i < n; i++) {
      const px = x + (Math.random() - .5) * w, py = y + (Math.random() - .5) * h;
      const a = Math.atan2(py - y, px - x || (Math.random() - .5)) + (Math.random() - .5) * .5;
      const sp = speed * (.45 + Math.random() * .8);
      const img = this.s.add.image(Math.round(px), Math.round(py), `shard${i % 4}`).setDepth(o.depth ?? 43).setScale(scale).setTintFill(0xffffff);
      this.shards.push({ img, x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 80), rot: Math.random() * 360, spin: (Math.random() < .5 ? -1 : 1) * (500 + Math.random() * 900), life: (o.life ?? .75) * (.7 + Math.random() * .6), max: 0, white: .06 });
      this.shards[this.shards.length - 1].max = this.shards[this.shards.length - 1].life;
    }
  }

  // ---- 베기 검기: 가장자리 오라 → 중간 → 순백 코어, 3겹 두께의 도트 초승달 ----
  //  (x, y) 원 중심 · r 반지름 · flipV 면 아래→위 올려베기 · rot 은 검기 한가운데를 축으로 돌린다 (X자 교차 베기)
  //  pal: [가장자리, 중간, 코어] (SLASH_PAL) · 휘두른 자리에 불티 픽셀이 0.2초 남는다
  slash(x, y, r, face, color = 0xffffff, o = {}) {
    this.arcs.push({ x, y, r, face, pal: palOf(color, o.pal), t: -(o.delay ?? 0), max: o.ms ?? 170, thick: o.thick ?? Math.max(5, r * .55), a0: o.a0 ?? -1.15, a1: o.a1 ?? 1.15, flipV: !!o.flipV, rot: o.rot || 0, embers: o.embers ?? 8 });
  }

  // ---- 음속 돌파 충격파: 돌진하는 순간 등 뒤에서 하얀 고깔 고리가 겹쳐 터진다 ----
  sonicBoom(x, y, face, s = 1) {
    const sc = this.s;
    for (let k = 0; k < 3; k++) {
      const im = sc.add.image(x - face * (6 + k * 7) * s, y, 'fx:cone').setFlipX(face < 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(44).setScale(.45 * s, .55 * s).setAlpha(0);
      sc.tweens.add({ targets: im, delay: k * 35, alpha: { from: .95, to: 0 }, scaleX: (1.1 + k * .15) * s, scaleY: (1.25 + k * .2) * s, x: im.x - face * 10 * s, duration: 200, ease: 'Cubic.easeOut', onComplete: () => im.destroy() });
    }
    // 등 뒤로 흩어지는 속도선 + 발밑 흙먼지
    const g = sc.add.graphics().setDepth(44).setBlendMode(Phaser.BlendModes.ADD);
    for (let k = 0; k < 4; k++) { const yy = Math.round(y - 8 * s + k * 5 * s), len = (10 + Math.random() * 12) * s; g.fillStyle(0xffffff, .8); g.fillRect(Math.round(face > 0 ? x - 10 * s - len : x + 10 * s), yy, Math.round(len), 1); }
    sc.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
    const gy = sc.groundBelow ? sc.groundBelow(x, y) : y + 10;
    if (gy - y < 30) this.burst(x - face * 6, gy - 1, [0xd8d0c0, 0xa89c88], 6, 60, { angle: face > 0 ? Math.PI : 0, spread: .8, up: 20, grav: 120, bounce: false, life: .35, size: 1 });
  }

  // ---- 톱니 타격 섬광: 부딪힌 자리에 톱니 별이 번쩍 + 바닥 파편이 세게 튄다 ----
  starburst(x, y, color = 0xffffff, s = 1, o = {}) {
    const sc = this.s, ang = Math.random() * 30;
    const outer = sc.add.image(x, y, 'fx:star').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(49).setScale(.3 * s).setAngle(ang);
    const core = sc.add.image(x, y, 'fx:star').setDepth(49.1).setScale(.18 * s).setAngle(ang + 15);
    sc.tweens.add({ targets: outer, scale: 1.05 * s, duration: 70, ease: 'Quad.easeOut' });
    sc.tweens.add({ targets: core, scale: .6 * s, duration: 70, ease: 'Quad.easeOut' });
    sc.tweens.add({ targets: [outer, core], alpha: 0, delay: 70, duration: 130, onComplete: () => { outer.destroy(); core.destroy(); } });
    this.burst(x, y, [color, 0xffffff], Math.round(6 * s), 150 * s, { up: 20, grav: 260, glow: true, life: .3, size: 1 });
    if (o.debris === false) return;
    const gy = sc.groundBelow ? sc.groundBelow(x, y) : y + 12;
    if (gy - y < 36) this.burst(x, gy - 2, [0x6a5a48, 0x8a7a62, 0x4a4036, 0xb8a888], Math.round(8 * s), 150, { angle: -Math.PI / 2, spread: 1.6, up: 120, grav: 650, bounce: true, size: 2, life: .7 });
  }

  // ---- 덩굴채찍: S자로 휘며 뻗어 나가는 탄력 있는 덩굴, 끝이 음속으로 꺾이는 순간 스파크와 잎 조각이 터진다 ----
  vine(x, y, face, len, o = {}) {
    const sc = this.s, g = sc.add.graphics().setDepth(43), st = { k: 0, cracked: false };
    const amp = o.amp ?? 7, dir = o.ang ?? 0, flip = o.flip ? -1 : 1, N = 18;
    const pt = (t, ext, ph) => {
      const L = len * ext, off = amp * Math.sin(2 * Math.PI * t + ph) * Math.sin(Math.PI * t) * flip;
      const ux = Math.cos(dir) * face, uy = Math.sin(dir);
      return { x: Math.round(x + ux * L * t - uy * off * face), y: Math.round(y + uy * L * t + ux * off * face) };
    };
    const draw = (ext, alpha) => {
      g.clear();
      const ph = (1 - ext) * Math.PI * 2.4, pts = [];
      for (let i = 0; i <= N; i++) pts.push(pt(i / N, ext, ph));
      g.lineStyle(4, 0x123a14, alpha); g.strokePoints(pts, false);
      g.lineStyle(2.4, 0x3aa83a, alpha); g.strokePoints(pts, false);
      g.lineStyle(1, 0xa8ff86, .9 * alpha); g.strokePoints(pts.map(p => ({ x: p.x, y: p.y - 1 })), false);
      for (let i = 3; i < N; i += 3) {   // 잎 마디: 양쪽으로 번갈아 작은 잎
        const p = pts[i], sd = i % 2 ? -1 : 1, yy = p.y + sd * 2 - (sd < 0 ? 1 : 0);
        g.fillStyle(0x5ed04a, alpha); g.fillRect(p.x - 1, yy, 3, 2);
        g.fillStyle(0xc8ffa8, alpha); g.fillRect(p.x, yy, 1, 1);
      }
      return pts[N];
    };
    sc.tweens.add({
      targets: st, k: 1, duration: o.ms ?? 300,
      onUpdate: () => {
        const k = st.k, ext = Math.min(1, k / .45), fade = k < .62 ? 1 : 1 - (k - .62) / .38;
        const tip = draw(ext, fade);
        if (!st.cracked && ext >= 1) {   // 채찍 끝이 꺾이는 순간
          st.cracked = true;
          this.starburst(tip.x, tip.y, 0xb8ff7a, .7, { debris: false });
          this.burst(tip.x, tip.y, [0xd8ff9a, 0xffffff, 0x8aff6a], 12, 170, { up: 30, grav: 200, glow: true, life: .35, size: 1 });
          if (sc.combat && sc.combat.pr) sc.combat.pr.leafBits(tip.x, tip.y, o.leaves ?? 5);
          if (o.onTip) o.onTip(tip);
        }
      },
      onComplete: () => g.destroy()
    });
  }

  // ---- 잔상(고스트 트레일) ----
  ghost(sprite, color = 0xffffff, alpha = .55, ms = 260) {
    if (!sprite || !sprite.frame) return;
    const img = this.s.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY).setFlipX(sprite.flipX).setScale(sprite.scaleX, sprite.scaleY)
      .setDepth(sprite.depth - 1).setTintFill(color).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD);
    this.s.tweens.add({ targets: img, alpha: 0, duration: ms, onComplete: () => img.destroy() });
  }

  // ---- 발광 원 / 퍼지는 고리 ----
  glow(x, y, radius, color, ms = 200, alpha = .8) {
    const g = this.s.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setAlpha(alpha).setDepth(44);
    g.setScale(radius / 32);
    this.s.tweens.add({ targets: g, alpha: 0, scale: g.scale * 1.3, duration: ms, onComplete: () => g.destroy() });
    return g;
  }
  ring(x, y, radius, color, ms = 260) {
    const g = this.s.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setDepth(44).setScale(.2);
    this.s.tweens.add({ targets: g, scale: radius / 29, alpha: { from: 1, to: 0 }, duration: ms, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
  }

  // ---- 데미지 숫자: 효과 굉장(주황·크게) / 보통(흰색) / 별로(회색·작게) ----
  damage(x, y, amount, eff, crit) {
    const spec = eff === 'super' ? { size: 15, color: '#ff9a2a', stroke: '#3a1000', rise: 26 }
      : eff === 'weak' ? { size: 10, color: '#9a98aa', stroke: '#141220', rise: 12 }
        : { size: 12, color: crit ? '#ffe36a' : '#ffffff', stroke: '#141020', rise: 18 };
    const t = this.s.add.text(Math.round(x + (Math.random() - .5) * 8), Math.round(y), String(amount), txt(spec.size, spec.color, { stroke: spec.stroke, strokeThickness: 3 }))
      .setOrigin(.5, 1).setDepth(60);
    if (eff === 'super') t.setScale(1.6);
    this.s.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.s.tweens.add({ targets: t, y: t.y - spec.rise, alpha: { from: 1, to: 0 }, delay: 220, duration: 520, onComplete: () => t.destroy() });
    let label = null;
    if (eff === 'super') label = ['효과가 굉장했다!', '#ffb050'];
    else if (eff === 'weak') label = ['효과가 별로인 듯하다…', '#8a889a'];
    else if (crit) label = ['급소!', '#ffe36a'];
    if (label && (this.s.time.now - (this._lastLabel || 0) > (eff === 'weak' ? 900 : 350))) {
      this._lastLabel = this.s.time.now;
      const l = this.s.add.text(Math.round(x), Math.round(y - 14), label[0], txt(10, label[1], { stroke: '#120c1c', strokeThickness: 3 })).setOrigin(.5, 1).setDepth(61);
      this.s.tweens.add({ targets: l, y: l.y - 14, alpha: { from: 1, to: 0 }, delay: 350, duration: 500, onComplete: () => l.destroy() });
    }
  }

  floatText(x, y, s, color = '#ffffff', size = 10) {
    const t = this.s.add.text(Math.round(x), Math.round(y), s, txt(size, color, { stroke: '#120c1c', strokeThickness: 3 })).setOrigin(.5, 1).setDepth(61);
    this.s.tweens.add({ targets: t, y: t.y - 16, alpha: { from: 1, to: 0 }, delay: 300, duration: 600, onComplete: () => t.destroy() });
  }

  update(dt) {
    const s = this.s;
    // 파티클
    this.g.clear(); this.ga.clear();
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy += p.grav * dt; p.vx *= p.drag;
      let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (p.bounce && s.isSolidAt(nx, ny)) {
        if (!s.isSolidAt(p.x, ny)) { p.vx = -p.vx * .5; nx = p.x; }
        else { p.vy = -p.vy * .42; p.vx *= .7; ny = p.y; if (Math.abs(p.vy) < 20) p.vy = 0; }
      }
      p.x = nx; p.y = ny;
      const a = Math.min(1, p.life / p.max * 1.8);
      const g = p.glow ? this.ga : this.g;
      g.fillStyle(p.color, a);
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    // 유리 파편
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const p = this.shards[i];
      p.life -= dt;
      if (p.life <= 0 || !p.img.scene) { p.img.destroy(); this.shards.splice(i, 1); continue; }
      p.vy += 520 * dt; p.vx *= .985;
      let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (s.isSolidAt(nx, ny)) {
        if (!s.isSolidAt(p.x, ny)) { p.vx = -p.vx * .4; nx = p.x; }
        else { p.vy = -p.vy * .35; p.vx *= .6; p.spin *= .5; ny = p.y; if (Math.abs(p.vy) < 20) p.vy = 0; }
      }
      p.x = nx; p.y = ny; p.rot += p.spin * dt; p.white -= dt;
      const step = Math.round(p.rot / 90) & 3;
      p.img.setPosition(Math.round(p.x), Math.round(p.y)).setAngle(step * 90).setFlipX(step > 1)
        .setAlpha(Math.min(1, p.life / p.max * 2.2));
      if (p.white > 0 || step === 0 && Math.random() < .15) p.img.setTintFill(0xffffff); else p.img.clearTint();
    }
    // 베기 검기: 바깥 빛(ADD) → 가장자리 → 중간 → 순백 코어 (같은 띠를 점점 얇게 겹쳐 그린다)
    this.gs.clear(); this.gsa.clear();
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.t += dt * 1000;
      if (a.t < 0) continue;   // delay: 아직 시작 전
      if (a.t >= a.max) { this.arcs.splice(i, 1); continue; }
      const k = a.t / a.max, grow = Math.min(1, k * 3.2), fade = 1 - Math.max(0, (k - .38) / .62);
      const a0 = a.a0, a1 = a.a0 + (a.a1 - a.a0) * grow, steps = 14, vy = a.flipV ? -1 : 1;
      const mx = a.x + a.r * a.face, my = a.y, cr = Math.cos(a.rot * a.face), sr = Math.sin(a.rot * a.face);
      const P = (ang, R) => {
        const px = a.x + Math.cos(ang) * R * a.face - mx, py = a.y + Math.sin(ang) * R * vy - my;
        return { x: Math.round(mx + px * cr - py * sr), y: Math.round(my + px * sr + py * cr) };
      };
      const band = wk => {   // 띠 중심선 ± 반두께×wk
        const outer = [], inner = [];
        for (let j = 0; j <= steps; j++) {
          const t = j / steps, ang = a0 + (a1 - a0) * t, taper = Math.sin(t * Math.PI) * (.35 + .65 * t);   // 휘두르는 끝 쪽이 두껍다
          const hw = a.thick * taper * fade * .5, rc = a.r - hw;
          outer.push(P(ang, rc + hw * wk)); inner.push(P(ang, rc - hw * wk));
        }
        return outer.concat(inner.reverse());
      };
      const [edge, mid, core] = a.pal;
      this.gsa.fillStyle(edge, .38 * fade); this.gsa.fillPoints(band(1.45), true);
      this.gs.fillStyle(edge, .95 * fade); this.gs.fillPoints(band(1), true);
      this.gs.fillStyle(mid, fade); this.gs.fillPoints(band(.62), true);
      this.gs.fillStyle(core, fade); this.gs.fillPoints(band(.26), true);
      // 휘두르기가 끝나는 순간 검기 자리에 불티 픽셀을 흩뿌린다 (0.2초 남았다 사라짐)
      if (!a.sparked && grow >= 1) {
        a.sparked = true;
        for (let e = 0; e < a.embers; e++) { const t = .15 + Math.random() * .8, p = P(a0 + (a.a1 - a0) * t, a.r - a.thick * .3); this.burst(p.x, p.y, [edge, mid, core], 1, 22, { up: 6, grav: 40, bounce: false, glow: true, life: .2, size: 1, drag: .9 }); }
      }
    }
  }
}
