// 야생 포켓몬 AI (계열마다 같은 행동, 진화한 모습은 더 단단함): 꼬렛 계열(돌진) · 피츄 계열(원거리) · 주뱃 계열(급강하) · 알통몬 계열(근접 콤보) · 고오스 계열(벽 통과 + 섀도볼)
//  2단부터는 근접형도 가끔 투사체를 쏜다 (fireShot: 2단 단발 · 3단 3연사)
import Phaser from 'phaser';
import { Actor } from './Actor.js';
import { typeColor } from '../data/types.js';
import { Sfx } from '../systems/Audio.js';
import { overlap } from './Combat.js';
import { pxt as txt } from '../config.js';   // 월드 안 글자는 도트 글꼴

// 세뇌된 적(무한다이노에게 조종당하는 상태)의 실시간 비주얼 — 포켓몬 본래 도트 색이 85% 이상 살아 있게 절제했다
//  1) 아주 옅은 보라 틴트 + 외곽선 둘레에만 어두운 기운   2) 또렷한 붉은 안광 + 움직일 때 얇고 날카롭게 끌리는 안광 실선
//  3) 은은한 발밑 오라 + 드문 검붉은 도트 연기            4) 3.5~6초마다 0.1초 글리치(좌우 어긋남 + 옅은 RGB 분리)
// 발밑 오라와 안광 궤적은 GameScene.drawCorruption 이 모든 적을 한 번에 그린다.
const CORRUPT_RANGE = [0x8833aa, 0x993388, 0xaa2255];
const EYE_COLOR = 0xff0044;
const SMOKE = [0x5a0a22, 0x2a0612, 0x8a1a3a, 0x3a0a2a];

export class Enemy extends Actor {
  constructor(scene, key, x, y, o = {}) {
    super(scene, key, x, y);
    const def = o.def;   // 야생은 wildForm() 결과, 보스는 BOSSES 항목
    this.def = def; this.types = def.types; this.name = def.name;
    this.boss = !!o.boss;
    const scale = o.scale || 1;
    this.scaleBase = scale;
    this.resizeBody(Math.max(10, Math.round(this.meta.bodyW * scale)), Math.max(12, Math.round(this.meta.bodyH * scale)));
    this.maxhp = this.hp = Math.round(def.hp * (o.hpMul || 1));
    this.dmg = def.dmg * (o.dmgMul || 1);
    this.speed = def.speed || 50;
    this.status = { burn: 0, poison: 0, slow: 0, root: 0, stun: 0, curse: 0 };
    this.tickT = .5;
    this.state = 'spawn'; this.timer = .45; this.cd = .6 + Math.random();
    this.alive = true; this.intangible = true;
    this.stagger = 0; this.t = Math.random() * 10;
    this.face = -1;
    this.sprite.setDepth(this.boss ? 19 : 20).setAlpha(0);
    // 세뇌 비주얼 레이어
    const d = this.sprite.depth;
    this.corrupt = true;
    this.corruptColor = CORRUPT_RANGE[(key.length + Math.floor(x)) % CORRUPT_RANGE.length];
    this.aura = scene.add.sprite(x, y, 'px').setDepth(d - .2).setAlpha(0);                         // 몸을 감싼 세뇌 껍질(윤곽)
    this.overlay = scene.add.sprite(x, y, 'px').setDepth(d + .1).setAlpha(0);                      // 보라·자홍 틴트 블렌딩
    // 색수차(RGB Split): 몸 뒤에서 좌우로 어긋난 빨강·청록 복사본 → 가장자리에만 색이 번진다
    this.rgbR = scene.add.sprite(x, y, 'px').setDepth(d - .1).setVisible(false);
    this.rgbC = scene.add.sprite(x, y, 'px').setDepth(d - .1).setVisible(false);
    this.eyeGlow = scene.add.image(x, y, 'glow').setTint(EYE_COLOR).setBlendMode(Phaser.BlendModes.ADD).setDepth(d + .3).setAlpha(0);
    this.eyeDot = scene.add.rectangle(x, y, 2, 2, EYE_COLOR).setDepth(d + .4).setAlpha(0);
    this.eyeTrail = [];
    this.auraT = Math.random() * 10;
    this.glitchT = 1.5 + Math.random() * 1.5; this.glitchDur = 0;
    this.flying = !!def.flying;
    if (this.flying) this.b.setAllowGravity(false);
    this.b.setCollideWorldBounds(true);
    this.b.setMaxVelocity(500, 640);
    this.alert = scene.add.text(0, 0, '!', txt(12, '#ffdf4a', { stroke: '#1a0e00', strokeThickness: 3 })).setOrigin(.5, 1).setDepth(55).setVisible(false);
    this.home = { x, y };
  }

  get top() { return this.b.y; }

  // 투사체를 쏠 수 있는 단계인가 (data/pokemon.js WILD 의 shot · shotFrom)
  get canShoot() { return !!(this.def.shot && (this.stage || 0) >= (this.def.shotFrom ?? 1)); }
  // 플레이어 쪽으로 계열 투사체 발사: 3단은 0.12초 간격 3연사(연속 투사체 → 맞대결), 그 밖엔 단발(부딪히면 둘 다 소멸)
  fireShot(p, fan = .08) {
    const s = this.def.shot, n = (this.stage || 0) >= 2 ? 3 : 1;
    for (let k = 0; k < n; k++) this.scene.time.delayedCall(k * 120, () => {
      if (!this.alive || !this.scene) return;
      const a = Math.atan2(p.y - this.y, p.x - this.x) + (n > 1 ? (k - 1) * fan : 0);
      this.scene.combat.spawnProjectile(Object.assign({}, s, { owner: 'enemy', x: this.x + this.face * 6, y: this.y - 2, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, dmg: this.dmg, tier: this.stage || 0, stream: n > 1 }));
      Sfx.play(s.type === 'ghost' ? 'ghost' : 'eshot');
    });
  }

  knock(vx, vy) {
    if (this.boss) return;
    const r = 1 - (this.def.kbRes || 0);
    this.b.setVelocityX(vx * r);
    this.b.setVelocityY(this.flying ? vy * r * .5 : Math.min(this.b.velocity.y, vy * r));
    this.stagger = .25;
    if (['dash', 'dive', 'wind', 'punch'].includes(this.state)) { this.state = 'recover'; this.timer = .35; }
  }

  facePlayer(p) { const f = Math.sign(p.x - this.x) || this.face; if (f !== this.face) { this.face = f; this.refacing(); } }
  ledgeAhead() {
    const ax = this.face > 0 ? this.b.right + 3 : this.b.x - 3;
    return !this.scene.isGroundAt(ax, this.bottom + 4) || this.scene.isSolidAt(ax, this.bottom - 6);
  }
  telegraph(on) { this.alert.setVisible(on); }

  update(dt, p) {
    const sc = this.scene;
    this.t += dt;
    if (this.state === 'spawn') {
      this.timer -= dt;
      this.sprite.setAlpha(Math.min(1, 1 - this.timer / .45));
      if (this.timer <= 0) { this.state = 'idle'; this.intangible = false; this.sprite.setAlpha(1); }
      this.syncSprite(dt); this.syncCorruption(dt); return;
    }
    const st = this.status;
    for (const k in st) st[k] -= dt;
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = .5;
      if (st.burn > 0) { sc.combat.damageEnemy(this, this.burnDps * .5, 'none', { dot: 'burn' }); sc.fx.embers(this.x, this.top, [0xff7a2a, 0xffd04a], 3); }
      if (this.alive && st.poison > 0) sc.combat.damageEnemy(this, this.poisonDps * .5, 'none', { dot: 'poison' });
      if (!this.alive) return;
    }
    const disabled = st.stun > 0 || st.root > 0;
    this.stagger -= dt; this.jumpCd = (this.jumpCd || 0) - dt;
    if (!disabled && this.stagger <= 0) this.ai(dt, p);
    else {
      this.telegraph(false);
      this.b.setVelocityX(this.b.velocity.x * Math.pow(.02, dt));
      if (this.flying) this.b.setVelocityY(this.b.velocity.y * Math.pow(.05, dt));
      if (st.root > 0) this.b.setVelocityX(0);
    }
    // 공격 중 몸통 접촉 피해
    if (this.striking && !disabled && !this.intangible && overlap(this.bounds(), p.bounds())) {
      if (p.takeHit(this.dmg, this.def.atkType, this.x, {}) && this.def.ai === 'flyer') { this.state = 'recover'; this.timer = .6; }
    }
    if (this.b.y > sc.level.height + 60) { this.hp = 0; sc.killEnemy(this); return; }
    this.alert.setPosition(Math.round(this.x), Math.round(this.top - 4));
    if (this.frozenT > 0) this.frozenT -= dt;
    this.tint = this.frozenT > 0 ? 0xbff0ff : st.stun > 0 ? 0xfff0a0 : st.root > 0 ? 0xa0ffa0 : st.curse > 0 ? 0xd0a0ff : st.slow > 0 ? 0xa0d0ff : null;
    if (this.animName !== 'Hurt' || !this.sprite.anims.isPlaying) {
      const moving = Math.abs(this.b.velocity.x) > 8 || this.flying;
      const want = this.state === 'wind' ? 'Attack' : this.state === 'shoot' ? 'Shoot' : moving ? 'Walk' : 'Idle';
      if (want !== this.animName && !(this.animName === 'Attack' && this.state === 'wind')) this.play(want);
    }
    this.syncSprite(dt);
    this.syncCorruption(dt);
  }

  // 같은 프레임을 복사한 레이어들로 세뇌 상태를 그린다
  copyFrame(layer, s) {
    return layer.setTexture(s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setScale(s.scaleX, s.scaleY);
  }

  // 머리(눈) 월드 좌표: 스프라이트 측정값(오른쪽 기준)을 바라보는 방향·배율에 맞춘다
  eyePos() {
    const s = this.sprite, e = (this.meta && this.meta.eye) || { dx: 4, dy: -16 };
    return { x: s.x + e.dx * this.face * s.scaleX, y: s.y + e.dy * s.scaleY };
  }

  syncCorruption(dt) {
    const s = this.sprite;
    if (!this.corrupt || !s.frame) return;
    const now = this.scene.time.now;
    this.auraT += dt;
    const pulse = Math.sin(this.auraT * 5) * .5 + .5, alpha = s.alpha * (this.fade ? .4 : 1);
    // 1) 아주 옅은 틴트 (원본 색 88% 유지 · 피격 섬광 중에는 감춰 흰 점멸이 보이게)
    this.copyFrame(this.overlay, s).setPosition(s.x, s.y).setTintFill(this.boss && this.phase === 2 ? 0xaa2255 : this.corruptColor)
      .setAlpha(this.flashT > 0 ? 0 : alpha * .12);
    // 세뇌 껍질: 몸보다 살짝 큰 검보라 실루엣을 뒤에 깔아 외곽선 둘레에만 어두운 기운이 감돈다
    const k = this.boss ? 1.04 : 1.07;
    this.copyFrame(this.aura, s).setPosition(s.x, s.y + 1).setScale(s.scaleX * k, s.scaleY * k)
      .setTintFill(this.boss && this.phase === 2 ? 0x5a0a2a : 0x2a0840).setAlpha(alpha * (.3 + pulse * .14));
    // 4) 글리치: 3.5~6초마다 0.1초간 좌우 어긋남 + 옅은 RGB 분리
    this.glitchT -= dt;
    if (this.glitchT <= 0) { this.glitchDur = .1; this.glitchT = 3.5 + Math.random() * 2.5; }
    if (this.glitchDur > 0) {
      this.glitchDur -= dt;
      const j = (Math.random() < .5 ? -1 : 1) * (1 + Math.round(Math.random())) * s.scaleX, sp = 2 * s.scaleX;
      s.x += j; this.overlay.x += j;
      this.copyFrame(this.rgbR, s).setPosition(s.x - sp, s.y).setTintFill(0xff1a4a).setAlpha(alpha * .45).setVisible(true);
      this.copyFrame(this.rgbC, s).setPosition(s.x + sp, s.y).setTintFill(0x1ae8ff).setAlpha(alpha * .4).setVisible(true);
    } else { this.rgbR.setVisible(false); this.rgbC.setVisible(false); }
    // 2) 붉은 안광 + 궤적 (세뇌 표현의 핵심 — 또렷하게)
    const ep = this.eyePos(), big = this.boss ? 1.8 : 1;
    this.eyeGlow.setPosition(ep.x, ep.y).setScale(.22 * big, .12 * big).setAlpha(alpha * (.85 + pulse * .15));
    this.eyeDot.setPosition(Math.round(ep.x), Math.round(ep.y)).setSize(2 * big, 2 * big).setAlpha(alpha);
    const active = Math.abs(this.b.velocity.x) + Math.abs(this.b.velocity.y) > 30 || this.state === 'wind' || this.striking || this.state === 'punch';
    this.eyeTrail.push({ x: ep.x, y: ep.y, t: now });
    const keep = active ? 260 : 90;
    while (this.eyeTrail.length && now - this.eyeTrail[0].t > keep) this.eyeTrail.shift();
    // 3) 몸 주변에서 피어오르는 검붉은 도트 연기 (예전의 1/3)
    if (Math.random() < dt * (this.boss ? 5.3 : 1.7)) {
      this.scene.fx.burst(this.x + (Math.random() - .5) * this.b.width * 1.2, this.bottom - Math.random() * this.b.height * .7, SMOKE, 1, 14,
        { angle: -Math.PI / 2, spread: .6, up: 14, grav: -26, bounce: false, life: .9 + Math.random() * .5, drag: .96, size: Math.random() < .35 ? 2 : 1 });
    }
  }

  // 정화되는 순간 세뇌 레이어를 모두 걷어 낸다
  clearCorruption() {
    this.corrupt = false;
    for (const o of [this.overlay, this.rgbR, this.rgbC, this.eyeGlow, this.eyeDot]) o.setVisible(false);
    this.eyeTrail = [];
  }

  get striking() { return this.state === 'dash' || this.state === 'dive'; }
  get spd() { return this.speed * (this.status.slow > 0 ? .5 : 1); }

  ai(dt, p) { (AI[this.def.ai] || AI.charger)(this, dt, p); }

  destroy() {
    this.alert.destroy();
    for (const o of [this.aura, this.overlay, this.rgbR, this.rgbC, this.eyeGlow, this.eyeDot]) if (o) o.destroy();
    super.destroy();
  }
}

// 플레이어가 아래층에 있으면 난간을 돌지 않고 걸어 내려간다
function wander(e, p, speedK) {
  const b = e.b, dx = p.x - e.x, dy = p.y - e.y;
  if (dy > 30 && Math.abs(dx) < 260) { e.facePlayer(p); b.setVelocityX(e.face * e.spd * .85); return; }
  // 플레이어가 바로 위 발판에 있으면 뛰어오른다 (발판 위에서 버티기 방지)
  if (dy < -30 && dy > -90 && Math.abs(dx) < 80 && b.onFloor() && e.jumpCd <= 0) { e.facePlayer(p); b.setVelocity(Math.sign(dx || 1) * e.spd * 1.4, -330); e.jumpCd = 1.6; return; }
  if (b.onFloor() && (e.ledgeAhead() || b.blocked.left || b.blocked.right)) { e.face *= -1; e.refacing(); }
  b.setVelocityX(e.face * e.spd * speedK);
}

const AI = {
  charger(e, dt, p) {
    const b = e.b, dx = p.x - e.x, dy = p.y - e.y;
    e.cd -= dt;
    switch (e.state) {
      case 'wind': e.timer -= dt; b.setVelocityX(0); e.telegraph(true);
        if (e.timer <= 0) { e.telegraph(false); if (e.mode === 'shot') { e.fireShot(p); e.state = 'recover'; e.timer = .45; } else { e.state = 'dash'; e.timer = .42; Sfx.play('swing'); } }
        return;
      case 'dash': e.timer -= dt; b.setVelocityX(e.face * 250); if (e.timer % .06 < dt) e.scene.fx.ghost(e.sprite, 0xffffff, .35, 160); if (e.timer <= 0 || (b.onFloor() && e.ledgeAhead())) { e.state = 'recover'; e.timer = .5; } return;
      case 'recover': e.timer -= dt; b.setVelocityX(b.velocity.x * .85); if (e.timer <= 0) { e.state = 'idle'; e.cd = .8 + Math.random() * .8; } return;
    }
    if (Math.abs(dx) < (e.canShoot ? 220 : 150) && Math.abs(dy) < 40) {
      e.facePlayer(p);
      if (e.cd <= 0) {   // 멀면 충격파, 가까우면 반반 (2단부터)
        e.mode = e.canShoot && (Math.abs(dx) >= 150 || Math.random() < .4) ? 'shot' : 'dash';
        e.state = 'wind'; e.timer = .45; return;
      }
      b.setVelocityX(Math.abs(dx) > 24 && !e.ledgeAhead() ? e.face * e.spd : 0);
    } else wander(e, p, .6);
  },

  shooter(e, dt, p) {
    const b = e.b, dx = p.x - e.x, adx = Math.abs(dx);
    e.cd -= dt;
    if (e.state === 'wind') {
      e.timer -= dt; b.setVelocityX(0); e.telegraph(true);
      if (e.timer <= 0) {
        e.telegraph(false);
        if (e.mode === 'dash') { e.state = 'dash'; e.timer = .3; }
        else {
          e.state = 'shoot'; e.timer = .3;
          e.fireShot(p);
        }
      }
      return;
    }
    if (e.state === 'dash') { e.timer -= dt; b.setVelocityX(e.face * 300); if (e.timer <= 0) { e.state = 'recover'; e.timer = .4; } return; }
    if (e.state === 'shoot' || e.state === 'recover') { e.timer -= dt; b.setVelocityX(b.velocity.x * .8); if (e.timer <= 0) { e.state = 'idle'; e.cd = 1.3 + Math.random() * .8; } return; }
    if (adx < 220 && Math.abs(p.y - e.y) < 90) {
      e.facePlayer(p);
      if (e.cd <= 0) { e.mode = adx < 70 && Math.random() < .5 ? 'dash' : 'shot'; e.state = 'wind'; e.timer = .4; return; }
      const want = adx < 90 ? -e.face : adx > 140 ? e.face : 0;   // 거리 유지
      const blocked = want && b.onFloor() && (want === e.face ? e.ledgeAhead() : false);
      b.setVelocityX(blocked ? 0 : want * e.spd);
    } else wander(e, p, .5);
  },

  flyer(e, dt, p) {
    const b = e.b, dx = p.x - e.x, dy = p.y - e.y;
    e.cd -= dt;
    switch (e.state) {
      case 'wind': e.timer -= dt; b.setVelocity(b.velocity.x * .9, -20); e.telegraph(true);
        if (e.timer <= 0 && e.mode === 'shot') { e.telegraph(false); e.fireShot(p); e.state = 'recover'; e.timer = .5; return; }
        if (e.timer <= 0) { e.telegraph(false); const a = Math.atan2(dy, dx); b.setVelocity(Math.cos(a) * 210, Math.sin(a) * 210); e.state = 'dive'; e.timer = .65; } return;
      case 'dive': e.timer -= dt; if (e.timer <= 0 || b.blocked.down || b.blocked.left || b.blocked.right) { e.state = 'recover'; e.timer = .7; } return;
      case 'recover': e.timer -= dt; b.setVelocity(b.velocity.x * .92, -60); if (e.timer <= 0) { e.state = 'idle'; e.cd = 1 + Math.random(); } return;
    }
    const near = Math.abs(dx) < 220 && Math.abs(dy) < 160;
    e.facePlayer(p);
    const tx = near ? p.x - Math.sign(dx || 1) * 60 : e.home.x + Math.sin(e.t) * 40;
    const ty = near ? p.y - 50 + Math.sin(e.t * 4) * 10 : e.home.y + Math.sin(e.t * 1.7) * 10;
    b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 2, -e.spd, e.spd), Phaser.Math.Clamp((ty - e.y) * 2, -e.spd, e.spd));
    if (near && e.cd <= 0) { e.mode = e.canShoot && Math.random() < .5 ? 'shot' : 'dive'; e.state = 'wind'; e.timer = .35; }
  },

  brawler(e, dt, p) {
    const b = e.b, dx = p.x - e.x, adx = Math.abs(dx), dy = p.y - e.y;
    e.cd -= dt;
    if (e.state === 'wind') {
      e.timer -= dt; b.setVelocityX(0); e.telegraph(true);
      if (e.timer <= 0 && e.mode === 'shot') { e.telegraph(false); e.mode = null; e.fireShot(p); Sfx.play('punch'); e.state = 'recover'; e.timer = .6; return; }
      if (e.timer <= 0) {
        e.telegraph(false); e.state = 'punch'; e.timer = .18; e.hits = (e.hits || 0) + 1;
        const box = { x: e.face > 0 ? e.b.right - 4 : e.b.x - 22, y: e.b.y, w: 26, h: e.b.height };
        e.scene.fx.slash(e.x + e.face * 12, e.y, 11, e.face, 0xff8a6a, { flipV: e.hits % 2 === 0 });
        if (overlap(box, p.bounds())) p.takeHit(e.dmg, 'fighting', e.x, {});
        Sfx.play('punch'); b.setVelocityX(e.face * 80);
      }
      return;
    }
    if (e.state === 'punch') { e.timer -= dt; if (e.timer <= 0) { if (e.hits < 2) { e.state = 'wind'; e.timer = .22; } else { e.hits = 0; e.state = 'recover'; e.timer = .6; } } return; }
    if (e.state === 'recover') { e.timer -= dt; b.setVelocityX(b.velocity.x * .85); if (e.timer <= 0) { e.state = 'idle'; e.cd = .7 + Math.random() * .6; } return; }
    if (adx < 200 && Math.abs(dy) < 70) {
      e.facePlayer(p);
      if (adx < 28 && Math.abs(dy) < 24 && e.cd <= 0) { e.state = 'wind'; e.timer = .4; return; }
      if (adx > 56 && e.cd <= 0 && e.canShoot) {   // 2단부터: 거리가 있으면 반쯤은 충격파를 날린다
        if (Math.random() < .5) { e.mode = 'shot'; e.state = 'wind'; e.timer = .45; return; }
        e.cd = .6;
      }
      if (dy < -30 && b.onFloor() && e.cd <= 0 && Math.random() < .02) { b.setVelocityY(-280); }
      b.setVelocityX(adx > 20 && !e.ledgeAhead() ? e.face * e.spd : 0);
    } else wander(e, p, .5);
  },

  ghost(e, dt, p) {
    const b = e.b, dx = p.x - e.x, dy = p.y - e.y;
    e.cd -= dt;
    e.fadeT = (e.fadeT ?? 2 + Math.random() * 2) - dt;
    if (e.fade) { if (e.fadeT <= 0) { e.fade = false; e.intangible = false; e.fadeT = 3 + Math.random() * 2; e.sprite.setAlpha(1); } }
    else if (e.fadeT <= 0 && e.state !== 'wind') { e.fade = true; e.intangible = true; e.fadeT = 1.1; e.sprite.setAlpha(.3); }
    e.facePlayer(p);
    if (e.state === 'wind') {
      e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9); e.telegraph(true);
      if (e.timer <= 0) {
        e.telegraph(false); e.state = 'idle'; e.cd = 2.4 + Math.random();
        e.fireShot(p, .3);
      }
      return;
    }
    const near = Math.abs(dx) < 260 && Math.abs(dy) < 200;
    if (near) {
      const tx = p.x - Math.sign(dx || 1) * 80, ty = p.y - 24 + Math.sin(e.t * 2) * 10;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.4, -e.spd, e.spd), Phaser.Math.Clamp((ty - e.y) * 1.4, -e.spd, e.spd));
      if (e.cd <= 0 && !e.fade) { e.state = 'wind'; e.timer = .5; }
    } else b.setVelocity(b.velocity.x * .95, Math.sin(e.t) * 12);
  }
};

export { AI, typeColor };
