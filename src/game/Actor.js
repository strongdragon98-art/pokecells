// 물리 몸통(보이지 않는 Arcade 이미지)과 도트 스프라이트를 분리한 공통 캐릭터
// 프레임 크기가 모션마다 달라도 몸통이 흔들리지 않고, 스프라이트만 발 위치에 맞춰 그린다.
import { Sprites } from '../systems/SpriteLoader.js';
export class Actor {
  constructor(scene, key, x, y, w = 14, h = 18) {
    this.scene = scene;
    this.obj = scene.physics.add.image(x, y, 'px').setVisible(false);
    this.b = this.obj.body;
    this.b.setSize(w, h, true);
    this.sprite = scene.add.sprite(x, y, 'px').setDepth(20);
    this.face = 1;
    this.animName = null; this.animKey = null;
    this.scaleBase = 1; this.sx = 1; this.sy = 1;
    this.flashT = 0; this.tint = null; this.tintFill = null;
    this.key = null;
    if (key) this.setSpecies(key, 1);
  }

  get x() { return this.b.center.x; }
  get y() { return this.b.center.y; }
  get bottom() { return this.b.bottom; }
  get onGround() { return this.b.blocked.down || this.b.touching.down; }
  bounds() { return { x: this.b.x, y: this.b.y, w: this.b.width, h: this.b.height }; }

  setSpecies(key, scale = 1) {
    this.key = key;
    this.meta = this.scene.registry.get('spriteMeta')[key];
    this.scaleBase = scale;
    this.animKey = null;
    this.sprite.setRotation(0);   // 폴백 도트의 절차 기울기가 남지 않게
    this.play('Idle', true);
  }

  // 몸통 크기를 바꿔도 발바닥 높이는 유지
  resizeBody(w, h) {
    const bottom = this.b.bottom, cxp = this.b.center.x;
    this.b.setSize(w, h, true);
    this.b.reset(cxp, bottom - h / 2);
  }

  play(name, force = false) {
    const dir = this.face > 0 ? 'right' : 'left';
    const k = `${this.key}:${name}:${dir}`;
    if (!force && this.animKey === k) return;
    if (!Sprites.isReady(this.key)) {   // 시트를 아직 안 받은 포켓몬 (지연 로딩): 받는 대로 이 모션으로 다시 그린다
      const key = this.key;
      this.animName = name; this.sprite.setAlpha(0);
      Sprites.ensure([key]).then(() => { if (this.key === key && this.sprite && this.sprite.active) { this.sprite.setAlpha(1); this.play(this.animName || 'Idle', true); } });
      return;
    }
    if (!this.scene.anims.exists(k)) {
      if (name === 'Shoot' || name === 'Strike') return this.play('Attack', force);   // 발사·강타 모션이 없는 도트(피츄 등)는 공격 모션으로
      if (name !== 'Idle') return this.play('Idle', force);
      return;
    }
    this.animKey = k; this.animName = name; this.animAt = this.procT || 0;
    this.sprite.play(k);
    const a = this.meta.anims[name];
    this.sprite.setOrigin(.5, a ? a.oy : .75);
  }

  // 같은 모션을 방향만 바꿔 다시 재생
  refacing() { if (this.animName) this.play(this.animName, true); }

  squash(sx, sy) { this.sx = sx; this.sy = sy; }

  flash(ms = 70) { this.flashT = Math.max(this.flashT, ms / 1000); }

  syncSprite(dt) {
    const k = Math.min(1, dt * 14);
    this.sx += (1 - this.sx) * k; this.sy += (1 - this.sy) * k;
    this.sprite.x = Math.round(this.b.center.x);
    this.sprite.y = Math.round(this.b.bottom);
    this.sprite.setScale(this.scaleBase * this.sx, this.scaleBase * this.sy);
    if (this.meta && this.meta.procedural) this.proceduralPose(dt);
    if (this.flashT > 0) { this.flashT -= dt; this.sprite.setTintFill(0xffffff); }
    else if (this.tintFill !== null) this.sprite.setTintFill(this.tintFill);
    else if (this.tint !== null) this.sprite.setTint(this.tint);
    else this.sprite.clearTint();
  }

  // 한 장짜리 폴백 도트(SpriteLoader.buildFallback)에 입히는 절차 애니메이션: 숨쉬기 · 걷기 출렁임 · 점프 기울기 · 공격 돌진 · 피격 젖힘
  proceduralPose(dt) {
    const t = this.procT = (this.procT || 0) + dt, n = this.animName, s = this.sprite, f = this.face;
    let ox = 0, oy = 0, rot = 0, kx = 1, ky = 1;
    if (!this.onGround) rot = Math.max(-.3, Math.min(.3, this.b.velocity.y / 900)) * f;
    else if (n === 'Walk') { oy = -Math.abs(Math.sin(t * 14)) * 1.6; rot = Math.sin(t * 14) * .07; }
    else if (n === 'Idle') { ky = 1 + Math.sin(t * 3.2) * .04; kx = 1 - Math.sin(t * 3.2) * .02; }
    if (n === 'Attack' || n === 'Strike' || n === 'Shoot') {
      const k = Math.sin(Math.min(1, (t - (this.animAt || 0)) / .2) * Math.PI);
      ox = f * k * 4; kx *= 1 + k * .14; ky *= 1 - k * .06; rot += f * k * .12;
    } else if (n === 'Hurt') { rot = -f * .22; ox = -f * 2; }
    s.x += ox; s.y += oy;
    s.setScale(s.scaleX * kx, s.scaleY * ky).setRotation(rot);
  }

  destroy() { this.obj.destroy(); this.sprite.destroy(); }
}
