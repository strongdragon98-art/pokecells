// 물리 몸통(보이지 않는 Arcade 이미지)과 도트 스프라이트를 분리한 공통 캐릭터
// 프레임 크기가 모션마다 달라도 몸통이 흔들리지 않고, 스프라이트만 발 위치에 맞춰 그린다.
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
    if (!this.scene.anims.exists(k)) {
      if (name === 'Shoot' || name === 'Strike') return this.play('Attack', force);   // 발사·강타 모션이 없는 도트(피츄 등)는 공격 모션으로
      if (name !== 'Idle') return this.play('Idle', force);
      return;
    }
    this.animKey = k; this.animName = name;
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
    if (this.flashT > 0) { this.flashT -= dt; this.sprite.setTintFill(0xffffff); }
    else if (this.tintFill !== null) this.sprite.setTintFill(this.tintFill);
    else if (this.tint !== null) this.sprite.setTint(this.tint);
    else this.sprite.clearTint();
  }

  destroy() { this.obj.destroy(); this.sprite.destroy(); }
}
