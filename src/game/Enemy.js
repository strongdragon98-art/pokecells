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
// 침식 단계 Ⅰ~Ⅳ (o.cLv — 보스방에 가까울수록 높다, GameScene.corruptLevel): 단계가 오를수록 틴트가 보라 → 자홍 → 핏빛으로 짙어지고,
//  검은 껍질 오라가 두꺼워지며, 연기·글리치가 잦아진다 (체력·공격력·속도 강화는 GameScene.spawnAt)
const CORRUPT_RANGE = [0x8833aa, 0x993388, 0xaa2255];
export const CLV_COLOR = [0x8a3ab0, 0xa02aa8, 0xc0226a, 0xd81a2a];       // 단계별 틴트
const CLV_SHELL = [0x2a0840, 0x320838, 0x3a0628, 0x460410];              // 단계별 검은 껍질
const CLV_TINT = [.1, .16, .24, .32], CLV_SHELL_A = [.26, .34, .44, .56];
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
    this.cLv = Math.max(1, Math.min(4, o.cLv || 1));   // 침식 단계
    this.speed = (def.speed || 50) * (1 + .05 * (this.cLv - 1));
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
    this.corruptColor = this.cLv > 1 ? CLV_COLOR[this.cLv - 1] : CORRUPT_RANGE[(key.length + Math.floor(x)) % CORRUPT_RANGE.length];
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
    if (this.boss || this.state === 'guard') return;   // 막는 중엔 밀리지 않는다 (알통몬 계열)
    const r = 1 - (this.def.kbRes || 0);
    this.b.setVelocityX(vx * r);
    this.b.setVelocityY(this.flying ? vy * r * .5 : Math.min(this.b.velocity.y, vy * r));
    this.stagger = .25;
    if (['dash', 'dive', 'wind', 'punch', 'lunge', 'leap', 'climb'].includes(this.state)) { this.state = 'recover'; this.timer = .35; this.mode = null; this.combo = false; this.mark = null; }
  }

  facePlayer(p) { const f = Math.sign(p.x - this.x) || this.face; if (f !== this.face) { this.face = f; this.refacing(); } }
  ledgeAhead() {
    const ax = this.face > 0 ? this.b.right + 3 : this.b.x - 3;
    return !this.scene.isGroundAt(ax, this.bottom + 4) || this.scene.isSolidAt(ax, this.bottom - 6);
  }
  ledgeBehind() {
    const ax = this.face > 0 ? this.b.x - 3 : this.b.right + 3;
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
      .setAlpha(this.flashT > 0 ? 0 : alpha * (this.boss ? .12 : CLV_TINT[this.cLv - 1]));
    // 세뇌 껍질: 몸보다 살짝 큰 검보라 실루엣을 뒤에 깔아 외곽선 둘레에만 어두운 기운이 감돈다 (침식 단계가 높을수록 두껍고 짙다)
    const lv = this.cLv - 1, k = this.boss ? 1.04 : 1.05 + lv * .025;
    this.copyFrame(this.aura, s).setPosition(s.x, s.y + 1).setScale(s.scaleX * k, s.scaleY * k)
      .setTintFill(this.boss && this.phase === 2 ? 0x5a0a2a : this.boss ? 0x2a0840 : CLV_SHELL[lv]).setAlpha(alpha * ((this.boss ? .3 : CLV_SHELL_A[lv]) + pulse * .14));
    // 4) 글리치: 3.5~6초마다 0.1초간 좌우 어긋남 + 옅은 RGB 분리 (침식 Ⅲ·Ⅳ는 더 자주)
    this.glitchT -= dt;
    if (this.glitchT <= 0) { this.glitchDur = .1; this.glitchT = (this.cLv >= 4 ? 1.4 : this.cLv >= 3 ? 2.4 : 3.5) + Math.random() * 2.5; }
    if (this.glitchDur > 0) {
      this.glitchDur -= dt;
      const j = (Math.random() < .5 ? -1 : 1) * (1 + Math.round(Math.random())) * s.scaleX, sp = 2 * s.scaleX;
      s.x += j; this.overlay.x += j;
      this.copyFrame(this.rgbR, s).setPosition(s.x - sp, s.y).setTintFill(0xff1a4a).setAlpha(alpha * .45).setVisible(true);
      this.copyFrame(this.rgbC, s).setPosition(s.x + sp, s.y).setTintFill(0x1ae8ff).setAlpha(alpha * .4).setVisible(true);
    } else { this.rgbR.setVisible(false); this.rgbC.setVisible(false); }
    // 2) 붉은 안광 + 궤적 (세뇌 표현의 핵심 — 또렷하게)
    const ep = this.eyePos(), big = this.boss ? 1.8 : this.cLv >= 4 ? 1.35 : 1;
    this.eyeGlow.setPosition(ep.x, ep.y).setScale(.22 * big, .12 * big).setAlpha(alpha * (.85 + pulse * .15));
    this.eyeDot.setPosition(Math.round(ep.x), Math.round(ep.y)).setSize(2 * big, 2 * big).setAlpha(alpha);
    const active = Math.abs(this.b.velocity.x) + Math.abs(this.b.velocity.y) > 30 || this.state === 'wind' || this.striking || this.state === 'punch';
    this.eyeTrail.push({ x: ep.x, y: ep.y, t: now });
    const keep = active ? 260 : 90;
    while (this.eyeTrail.length && now - this.eyeTrail[0].t > keep) this.eyeTrail.shift();
    // 3) 몸 주변에서 피어오르는 검붉은 도트 연기 (예전의 1/3)
    if (Math.random() < dt * (this.boss ? 5.3 : 1.7 * (.6 + .4 * this.cLv))) {
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

  get striking() { return this.state === 'dash' || this.state === 'dive' || this.state === 'lunge' || this.state === 'leap'; }   // 몸통 접촉 피해가 나는 동작
  get spd() { return this.speed * (this.status.slow > 0 ? .5 : 1); }

  ai(dt, p) { (AI[this.def.ai] || AI.charger)(this, dt, p); }

  destroy() {
    this.alert.destroy();
    for (const o of [this.aura, this.overlay, this.rgbR, this.rgbC, this.eyeGlow, this.eyeDot, this.shadowA, this.shadowB, this.eliteGlow, this.eliteTag, this.eliteCrown, this.eliteBar]) if (o) o.destroy();   // eliteGlow·Tag: 엘리트 오라·이름표   // shadowA·B: GameScene.drawCorruption 의 발밑 타원
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

// ---------------- 공격 패턴 도우미 ----------------
//  숙련도 lvl = 진화 단계(0~2) + 엘리트 1 — 높을수록 패턴이 늘고 이어진다 (1단 야생은 기본기 위주 · 진화형·엘리트는 연계기)
const lvlOf = e => (e.stage || 0) + (e.elite ? 1 : 0);
const chance = (k, dt) => Math.random() < k * dt;   // 초당 k 번꼴
// 계열 투사체 한 발 (각도 a · 덮어쓸 값 o)
function shootAt(e, a, o = {}) {
  const s = e.def.shot;
  if (!s || !e.alive) return;
  const sp = o.speed ?? s.speed;
  e.scene.combat.spawnProjectile(Object.assign({}, s, { owner: 'enemy', x: e.x + e.face * 6, y: e.y - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: e.dmg * (o.mul ?? 1), tier: e.stage || 0 }, o.extra || {}));
}
// 플레이어가 움직이는 쪽을 조금 앞질러 겨눈 각도 (k: 몇 초 뒤를 내다보나)
function leadAngle(e, p, k) {
  const v = (p.b && p.b.velocity) || { x: 0, y: 0 };
  return Math.atan2(p.y + v.y * k * .4 - e.y, p.x + v.x * k - e.x);
}
// 범위 판정 한 번 (맞으면 true)
function zoneHit(e, p, box, mul = 1, type = e.def.atkType) {
  return overlap(box, p.bounds()) && p.takeHit(e.dmg * mul, type, e.x, {});
}
// 예고 표식: 바닥에 붉은 고리가 맥동한다 (ms 뒤 사라짐)
function warnMark(e, x, y, r, ms, color = 0xff3a3a) {
  const fx = e.scene.fx;
  fx.ring(x, y, r, color, ms); fx.glow(x, y, r * .8, color, ms, .35);
}
// 착지 충격파: 양옆으로 퍼지는 고리 + 범위 판정 (2단부터는 땅을 기는 충격파 두 줄기도)
function slamWave(e, p, w, mul) {
  const fx = e.scene.fx, col = typeColor(e.def.atkType);
  fx.ring(e.x, e.bottom - 2, w * .6, col, 320); fx.ring(e.x, e.bottom - 2, w * .9, 0xffffff, 420);
  fx.burst(e.x, e.bottom - 2, [col, 0xffffff, 0x6a5a4a], 14, 160, { up: 120, size: 2, life: .5 });
  fx.shake(.006, 140, 'hit'); Sfx.play('slam');
  zoneHit(e, p, { x: e.x - w / 2, y: e.bottom - 26, w, h: 28 }, mul);
  if (e.canShoot) for (const d of [-1, 1]) shootAt(e, d > 0 ? 0 : Math.PI, { speed: 150, mul: .7, extra: { y: e.bottom - 6, life: .6 } });
}
// 번개 · 그림자 기둥: 표식 자리에 위에서 내리꽂는다
function pillar(e, p, x, groundY, mul) {
  const sc = e.scene, fx = sc.fx, col = e.def.shot && e.def.shot.color || typeColor(e.def.atkType);
  const g = sc.add.graphics().setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
  g.lineStyle(3, col, 1); g.beginPath();
  let px = x, py = groundY - 120; g.moveTo(px, py);
  while (py < groundY) { py += 14; px = x + (Math.random() - .5) * 12; g.lineTo(px, py); }
  g.strokePath(); g.lineStyle(1, 0xffffff, 1); g.strokePath();
  sc.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  fx.glow(x, groundY - 10, 30, col, 260, 1); fx.burst(x, groundY - 4, [col, 0xffffff], 12, 140, { up: 90 });
  Sfx.play(e.def.atkType === 'electric' ? 'zap' : 'eshot');
  zoneHit(e, p, { x: x - 12, y: groundY - 90, w: 24, h: 90 }, mul);
}
// 플레이어가 공격 동작 중인가 (회피 · 막기 판단)
const attacking = p => !!(p.action && p.action.slot);

const AI = {
  // ---- 꼬렛 계열: 돌진 · (진화) 되돌아 2연 돌진 · 도약 내려찍기 · 공격을 보고 뒤로 물러서기 ----
  charger(e, dt, p) {
    const b = e.b, dx = p.x - e.x, dy = p.y - e.y, adx = Math.abs(dx), lv = lvlOf(e);
    e.cd -= dt;
    switch (e.state) {
      case 'wind': e.timer -= dt; b.setVelocityX(0); e.telegraph(true);
        if (e.timer <= 0) {
          e.telegraph(false);
          if (e.mode === 'shot') { e.fireShot(p); e.state = 'recover'; e.timer = .45; }
          else if (e.mode === 'leap') { e.facePlayer(p); b.setVelocity(Phaser.Math.Clamp(dx * 1.7, -230, 230), -340); e.state = 'leap'; e.timer = .18; Sfx.play('jump'); }
          else { e.state = 'dash'; e.timer = .42; Sfx.play('swing'); }
        }
        return;
      case 'dash': e.timer -= dt; b.setVelocityX(e.face * (e.combo ? 290 : 250)); if (e.timer % .06 < dt) e.scene.fx.ghost(e.sprite, 0xffffff, .35, 160);
        if (e.timer <= 0 || (b.onFloor() && e.ledgeAhead())) {
          // 진화형: 지나쳐 버렸으면 곧장 돌아서 한 번 더 (짧은 예고)
          if (lv >= 1 && !e.combo && Math.sign(p.x - e.x) !== e.face && Math.random() < .55) { e.combo = true; e.facePlayer(p); e.mode = 'dash'; e.state = 'wind'; e.timer = .2; return; }
          e.combo = false; e.state = 'recover'; e.timer = .5;
        }
        return;
      case 'leap': e.timer -= dt; if (e.timer <= 0 && b.onFloor()) { slamWave(e, p, 64, 1.1); e.state = 'recover'; e.timer = .55; } return;
      case 'hop': e.timer -= dt; if (e.timer <= 0 && b.onFloor()) { e.state = 'idle'; e.cd = Math.min(e.cd, .25); } return;   // 뒤로 물러선 뒤 곧바로 반격
      case 'recover': e.timer -= dt; b.setVelocityX(b.velocity.x * .85); if (e.timer <= 0) { e.state = 'idle'; e.cd = .7 + Math.random() * .7; } return;
    }
    // 코앞에서 공격이 들어오면 뒤로 깡충 (진화형)
    if (lv >= 1 && adx < 46 && Math.abs(dy) < 30 && attacking(p) && b.onFloor() && chance(3, dt)) { e.facePlayer(p); b.setVelocity(-e.face * 190, -200); e.state = 'hop'; e.timer = .2; return; }
    if (adx < (e.canShoot ? 230 : 170) && Math.abs(dy) < 90) {
      e.facePlayer(p);
      if (e.cd <= 0) {
        if (lv >= 1 && b.onFloor() && (dy < -24 || (adx > 70 && Math.random() < .35))) { e.mode = 'leap'; e.state = 'wind'; e.timer = .4; warnMark(e, p.x, p.bottom, 26, 400); return; }
        if (Math.abs(dy) < 40) { e.mode = e.canShoot && (adx >= 150 || Math.random() < .35) ? 'shot' : 'dash'; e.state = 'wind'; e.timer = .45; return; }
      }
      b.setVelocityX(adx > 24 && !e.ledgeAhead() ? e.face * e.spd : 0);
    } else wander(e, p, .6);
  },

  // ---- 피츄 계열: 앞질러 쏘기 · (진화) 부채꼴 연사 · 발밑 표식 낙뢰 · 다가오면 뒤로 뛰며 거리 벌리기 ----
  shooter(e, dt, p) {
    const b = e.b, dx = p.x - e.x, adx = Math.abs(dx), lv = lvlOf(e);
    e.cd -= dt;
    if (e.state === 'wind') {
      e.timer -= dt; b.setVelocityX(0); e.telegraph(true);
      if (e.mode === 'pillar' && e.mark) e.mark.x += Phaser.Math.Clamp(p.x - e.mark.x, -60 * dt, 60 * dt);   // 표식이 천천히 따라온다 (피할 틈)
      if (e.timer <= 0) {
        e.telegraph(false);
        if (e.mode === 'dash') { e.state = 'dash'; e.timer = .3; }
        else if (e.mode === 'fan') { const a0 = leadAngle(e, p, .3), n = lv >= 2 ? 5 : 3; for (let k = 0; k < n; k++) shootAt(e, a0 + (k - (n - 1) / 2) * .2); Sfx.play('eshot'); e.state = 'shoot'; e.timer = .4; }
        else if (e.mode === 'pillar') { const m = e.mark; e.mark = null; pillar(e, p, m.x, m.y, 1.3); e.state = 'shoot'; e.timer = .5; }
        else { e.state = 'shoot'; e.timer = .3; e.fireShot({ x: p.x + ((p.b && p.b.velocity.x) || 0) * .3, y: p.y }); }   // 움직이는 쪽을 앞질러 겨눈다
      }
      if (e.mode === 'pillar' && e.mark && e.timer > 0 && Math.random() < dt * 12) warnMark(e, e.mark.x, e.mark.y, 14, 160, typeColor(e.def.atkType));
      return;
    }
    if (e.state === 'dash') { e.timer -= dt; b.setVelocityX(e.face * 300); if (e.timer <= 0) { e.state = 'recover'; e.timer = .4; } return; }
    if (e.state === 'hop') { e.timer -= dt; if (e.timer <= 0 && b.onFloor()) { e.state = 'idle'; e.cd = Math.min(e.cd, .2); } return; }
    if (e.state === 'shoot' || e.state === 'recover') { e.timer -= dt; b.setVelocityX(b.velocity.x * .8); if (e.timer <= 0) { e.state = 'idle'; e.cd = 1.1 + Math.random() * .7; } return; }
    if (adx < 240 && Math.abs(p.y - e.y) < 100) {
      e.facePlayer(p);
      // 너무 가까우면 뒤로 뛰어 거리를 벌리고 바로 쏜다 (진화형)
      if (lv >= 1 && adx < 50 && b.onFloor() && chance(2.5, dt) && !e.ledgeBehind()) { b.setVelocity(-e.face * 170, -260); e.state = 'hop'; e.timer = .2; return; }
      if (e.cd <= 0) {
        const r = Math.random();
        e.mode = adx < 70 && r < .4 ? 'dash' : lv >= 2 && r < .35 ? 'pillar' : lv >= 1 && r < .6 ? 'fan' : 'shot';
        e.state = 'wind'; e.timer = e.mode === 'pillar' ? .8 : .4;
        if (e.mode === 'pillar') e.mark = { x: p.x, y: p.bottom };
        return;
      }
      const want = adx < 90 ? -e.face : adx > 150 ? e.face : 0;   // 거리 유지
      const blocked = want && b.onFloor() && (want === e.face ? e.ledgeAhead() : e.ledgeBehind());
      b.setVelocityX(blocked ? 0 : want * e.spd);
    } else wander(e, p, .5);
  },

  // ---- 주뱃 계열: 급강하 · (진화) 되솟아 2연 급강하 · 머리 위로 올라가 수직 강하 · 사방 초음파 고리 ----
  flyer(e, dt, p) {
    const b = e.b, dx = p.x - e.x, dy = p.y - e.y, lv = lvlOf(e);
    e.cd -= dt;
    switch (e.state) {
      case 'wind': e.timer -= dt; b.setVelocity(b.velocity.x * .9, e.mode === 'stoop' ? b.velocity.y * .9 : -20); e.telegraph(true);
        if (e.timer > 0) return;
        e.telegraph(false);
        if (e.mode === 'shot') { e.fireShot(p); e.state = 'recover'; e.timer = .5; return; }
        if (e.mode === 'sonic') {   // 사방으로 퍼지는 음파 고리
          const n = lv >= 3 ? 10 : 8;
          for (let k = 0; k < n; k++) shootAt(e, k / n * Math.PI * 2, { speed: 130, mul: .7 });
          e.scene.fx.ring(e.x, e.y, 30, 0xc8e0ff, 300); Sfx.play('eshot'); e.state = 'recover'; e.timer = .6; return;
        }
        if (e.mode === 'stoop') { b.setVelocity(Phaser.Math.Clamp(dx * 1.2, -80, 80), 300); e.state = 'dive'; e.timer = .6; Sfx.play('swing'); return; }
        { const a = Math.atan2(dy, dx), sp = e.combo ? 250 : 210; b.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp); e.state = 'dive'; e.timer = .65; Sfx.play('swing'); }
        return;
      case 'dive': e.timer -= dt; if (e.timer % .07 < dt) e.scene.fx.ghost(e.sprite, 0xc8e0ff, .3, 140);
        if (e.timer <= 0 || b.blocked.down || b.blocked.left || b.blocked.right) {
          if (lv >= 1 && !e.combo && e.mode !== 'stoop' && Math.random() < .5) { e.combo = true; e.mode = 'dive'; e.state = 'wind'; e.timer = .25; b.setVelocity(-b.velocity.x * .4, -160); return; }   // 지나쳐 솟구쳤다가 한 번 더
          e.combo = false; e.state = 'recover'; e.timer = .7;
        }
        return;
      case 'climb':   // 플레이어 머리 위로 올라간다 → 수직 강하
        e.timer -= dt;
        b.setVelocity(Phaser.Math.Clamp((p.x - e.x) * 3, -e.spd * 1.5, e.spd * 1.5), Phaser.Math.Clamp((p.y - 90 - e.y) * 3, -e.spd * 1.5, e.spd * 1.5));
        if (e.timer <= 0 || (Math.abs(p.x - e.x) < 12 && Math.abs(p.y - 90 - e.y) < 14)) { e.mode = 'stoop'; e.state = 'wind'; e.timer = .3; warnMark(e, p.x, p.bottom, 22, 300, 0xc8e0ff); }
        return;
      case 'recover': e.timer -= dt; b.setVelocity(b.velocity.x * .92, -60); if (e.timer <= 0) { e.state = 'idle'; e.cd = .9 + Math.random() * .9; } return;
    }
    const near = Math.abs(dx) < 230 && Math.abs(dy) < 170;
    e.facePlayer(p);
    // 좌우로 흔들리며 맴돈다 (가만히 떠 있지 않게)
    const tx = near ? p.x - Math.sign(dx || 1) * (60 + Math.sin(e.t * 1.3) * 20) : e.home.x + Math.sin(e.t) * 40;
    const ty = near ? p.y - 30 + Math.sin(e.t * 4) * 10 : e.home.y + Math.sin(e.t * 1.7) * 10;   // 공격이 닿는 낮은 높이에서 맴돈다
    b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 2, -e.spd, e.spd), Phaser.Math.Clamp((ty - e.y) * 2, -e.spd, e.spd));
    if (near && e.cd <= 0) {
      const r = Math.random();
      if (lv >= 2 && r < .25) { e.mode = 'sonic'; e.state = 'wind'; e.timer = .5; return; }
      if (lv >= 1 && r < .5) { e.state = 'climb'; e.timer = 1.1; return; }
      e.mode = e.canShoot && r < .75 ? 'shot' : 'dive'; e.state = 'wind'; e.timer = .35;
    }
  },

  // ---- 알통몬 계열: 연타(진화할수록 길게) · 거리 좁히며 돌진 펀치 · 막고 받아치기 · 뛰어올라 내려찍기 ----
  brawler(e, dt, p) {
    const b = e.b, dx = p.x - e.x, adx = Math.abs(dx), dy = p.y - e.y, lv = lvlOf(e), maxHits = lv >= 2 ? 3 : 2;
    e.cd -= dt;
    const punch = (mul = 1, reach = 26) => {
      e.hits = (e.hits || 0) + 1;
      const box = { x: e.face > 0 ? e.b.right - 4 : e.b.x - reach + 4, y: e.b.y, w: reach, h: e.b.height };
      e.scene.fx.slash(e.x + e.face * 12, e.y, 11 + (mul > 1 ? 4 : 0), e.face, 0xff8a6a, { flipV: e.hits % 2 === 0 });
      zoneHit(e, p, box, mul, 'fighting');
      Sfx.play('punch'); b.setVelocityX(e.face * 80);
    };
    if (e.state === 'guard') {   // 막기: 받는 피해 ×0.3 · 끝나면 곧장 받아치기
      e.timer -= dt; b.setVelocityX(0);
      if (e.timer <= 0) { e.guardMul = null; e.facePlayer(p); e.mode = null; e.hits = maxHits - 1; e.state = 'wind'; e.timer = .12; }
      return;
    }
    if (e.state === 'wind') {
      e.timer -= dt; b.setVelocityX(0); e.telegraph(true);
      if (e.timer > 0) return;
      e.telegraph(false);
      if (e.mode === 'shot') { e.mode = null; e.fireShot(p); Sfx.play('punch'); e.state = 'recover'; e.timer = .6; return; }
      if (e.mode === 'lunge') { e.mode = null; e.state = 'lunge'; e.timer = .26; Sfx.play('dash'); return; }
      if (e.mode === 'slam') { e.mode = null; b.setVelocity(Phaser.Math.Clamp(dx * 1.6, -200, 200), -360); e.state = 'leap'; e.timer = .2; Sfx.play('jump'); return; }
      e.state = 'punch'; e.timer = .18; punch(e.hits + 1 >= maxHits && maxHits > 2 ? 1.4 : 1);   // 3연타 마지막은 묵직하게
      return;
    }
    if (e.state === 'lunge') {   // 바닥을 미끄러지듯 파고들어 한 방
      e.timer -= dt; b.setVelocityX(e.face * 260); if (e.timer % .05 < dt) e.scene.fx.ghost(e.sprite, 0xff8a6a, .3, 150);
      if (e.timer <= 0 || adx < 20 || e.ledgeAhead()) { e.hits = maxHits - 1; punch(1.3, 30); e.state = 'recover'; e.timer = .55; }
      return;
    }
    if (e.state === 'leap') { e.timer -= dt; if (e.timer <= 0 && b.onFloor()) { slamWave(e, p, 80, 1.3); e.state = 'recover'; e.timer = .7; } return; }
    if (e.state === 'punch') { e.timer -= dt; if (e.timer <= 0) { if (e.hits < maxHits) { e.state = 'wind'; e.timer = .2; } else { e.hits = 0; e.state = 'recover'; e.timer = .6; } } return; }
    if (e.state === 'recover') { e.timer -= dt; b.setVelocityX(b.velocity.x * .85); if (e.timer <= 0) { e.state = 'idle'; e.cd = .6 + Math.random() * .6; } return; }
    if (adx < 210 && Math.abs(dy) < 80) {
      e.facePlayer(p);
      // 앞에서 공격이 들어오면 막는다 (진화형)
      if (lv >= 1 && adx < 60 && Math.abs(dy) < 30 && attacking(p) && chance(4, dt)) {
        e.state = 'guard'; e.timer = .5; e.guardMul = .3;
        e.scene.fx.floatText(e.x, e.top - 6, '막기!', '#ffd27a', 9); e.scene.fx.ring(e.x + e.face * 8, e.y, 14, 0xffd27a, 220);
        return;
      }
      if (e.cd <= 0) {
        if (adx < 28 && Math.abs(dy) < 24) { e.hits = 0; e.state = 'wind'; e.timer = .35; return; }
        if (lv >= 1 && b.onFloor() && (dy < -30 || (adx > 60 && adx < 150 && Math.random() < .3))) { e.mode = 'slam'; e.state = 'wind'; e.timer = .45; warnMark(e, p.x, p.bottom, 30, 450); return; }
        if (adx > 40 && adx < 130 && Math.abs(dy) < 24 && Math.random() < .45) { e.hits = 0; e.mode = 'lunge'; e.state = 'wind'; e.timer = .35; return; }
        if (adx > 56 && e.canShoot && Math.random() < .5) { e.mode = 'shot'; e.state = 'wind'; e.timer = .45; return; }
        e.cd = .4;
      }
      b.setVelocityX(adx > 20 && !e.ledgeAhead() ? e.face * e.spd : 0);
    } else wander(e, p, .5);
  },

  // ---- 고오스 계열: 유도 섀도볼 · (진화) 등 뒤로 순간이동해 핥기 · 섀도볼 부채 연사 · 발밑 그림자 기둥 ----
  ghost(e, dt, p) {
    const b = e.b, dx = p.x - e.x, dy = p.y - e.y, lv = lvlOf(e);
    e.cd -= dt;
    e.fadeT = (e.fadeT ?? 2 + Math.random() * 2) - dt;
    if (e.state !== 'blink') {
      if (e.fade) { if (e.fadeT <= 0) { e.fade = false; e.intangible = false; e.fadeT = 3 + Math.random() * 2; e.sprite.setAlpha(1); } }
      else if (e.fadeT <= 0 && e.state !== 'wind') { e.fade = true; e.intangible = true; e.fadeT = 1.1; e.sprite.setAlpha(.3); }
    }
    e.facePlayer(p);
    if (e.state === 'blink') {   // 사라졌다가 등 뒤에 나타난다
      e.timer -= dt; b.setVelocity(0, 0);
      if (e.timer <= 0) {
        const side = -(Math.sign(p.b && p.b.velocity.x) || p.face || 1);
        e.b.reset(p.x + side * 34, p.y - 6); e.fade = false; e.intangible = false; e.sprite.setAlpha(1); e.fadeT = 3;
        e.scene.fx.burst(e.x, e.y, [0x9a5aff, 0x2a0a3a], 12, 90, { glow: true }); Sfx.play('ghost');
        e.facePlayer(p); e.mode = 'lick'; e.state = 'wind'; e.timer = .32;
      }
      return;
    }
    if (e.state === 'wind') {
      e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9); e.telegraph(true);
      if (e.mode === 'pillar' && e.mark && Math.random() < dt * 12) warnMark(e, e.mark.x, e.mark.y, 14, 160, 0x9a5aff);
      if (e.timer > 0) return;
      e.telegraph(false); e.state = 'idle'; e.cd = 2 + Math.random();
      if (e.mode === 'lick') { e.scene.fx.slash(e.x + e.face * 12, e.y, 13, e.face, 0x9a5aff); zoneHit(e, p, { x: e.face > 0 ? e.x : e.x - 30, y: e.y - 16, w: 30, h: 30 }, 1.2, 'ghost'); Sfx.play('swing'); e.cd = 1.4; }
      else if (e.mode === 'barrage') { const a0 = Math.atan2(dy, dx); for (let k = 0; k < 5; k++) e.scene.time.delayedCall(k * 110, () => shootAt(e, a0 + (k - 2) * .28, { mul: .8 })); Sfx.play('ghost'); }
      else if (e.mode === 'pillar') { const m = e.mark; e.mark = null; if (m) pillar(e, p, m.x, m.y, 1.2); }
      else e.fireShot(p, .3);
      e.mode = null;
      return;
    }
    const near = Math.abs(dx) < 260 && Math.abs(dy) < 200;
    if (near) {
      const tx = p.x - Math.sign(dx || 1) * 80, ty = p.y - 24 + Math.sin(e.t * 2) * 10;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.4, -e.spd, e.spd), Phaser.Math.Clamp((ty - e.y) * 1.4, -e.spd, e.spd));
      if (e.cd <= 0 && !e.fade) {
        const r = Math.random();
        if (lv >= 1 && r < .3) { e.state = 'blink'; e.timer = .45; e.fade = true; e.intangible = true; e.sprite.setAlpha(.12); e.scene.fx.burst(e.x, e.y, [0x9a5aff, 0x2a0a3a], 10, 70, { glow: true }); return; }
        if (lv >= 2 && r < .55) { e.mode = 'barrage'; e.state = 'wind'; e.timer = .55; return; }
        if (lv >= 1 && r < .75) { e.mode = 'pillar'; e.mark = { x: p.x, y: p.bottom }; e.state = 'wind'; e.timer = .75; return; }
        e.mode = null; e.state = 'wind'; e.timer = .5;
      }
    } else b.setVelocity(b.velocity.x * .95, Math.sin(e.t) * 12);
    keepOutOfWalls(e, p);
  }
};

// 벽을 통과하는 고스트가 건물·바위 속으로 숨어 버리지 않게: 벽 쪽 이동은 막고, 이미 속에 있으면 플레이어 쪽으로 빠르게 빠져나온다
function keepOutOfWalls(e, p) {
  const s = e.scene, b = e.b, la = 14;
  if (s.isSolidAt(e.x, e.y)) {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    b.setVelocity(Math.cos(a) * e.spd * 2.5, Math.sin(a) * e.spd * 2.5);
    return;
  }
  if (b.velocity.x && s.isSolidAt(e.x + Math.sign(b.velocity.x) * la, e.y)) b.setVelocityX(0);
  if (b.velocity.y && s.isSolidAt(e.x, e.y + Math.sign(b.velocity.y) * la)) b.setVelocityY(0);
}

export { AI, typeColor };
