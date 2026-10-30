// 정화된 지방의 야생 포켓몬 — 세뇌가 풀려 더는 덤벼들지 않는다 (공격 대상도 아니다)
//  집 둘레를 느긋하게 거닐다 가끔 깡총, 플레이어가 다가오면 돌아보며 하트. 날짐승은 제자리에서 둥실둥실
import { Actor } from './Actor.js';

export class Wanderer extends Actor {
  constructor(scene, key, x, y, def) {
    super(scene, key, x, y);
    const m = this.meta || {};
    this.resizeBody(Math.max(10, Math.round(m.bodyW || 14)), Math.max(12, Math.round(m.bodyH || 16)));
    this.def = def; this.flying = !!def.flying; this.home = x; this.homeY = y;
    if (this.flying) this.b.setAllowGravity(false);
    this.b.setCollideWorldBounds(true);
    this.state = 'idle'; this.timer = .4 + Math.random() * 2; this.face = Math.random() < .5 ? -1 : 1; this.t = Math.random() * 10; this.heartT = 0;
    this.sprite.setDepth(19.5).setAlpha(0);
    this.fadeIn = .6;
    this.refacing();
  }

  update(dt, p) {
    this.t += dt;
    if (this.fadeIn > 0) { this.fadeIn -= dt; this.sprite.setAlpha(1 - Math.max(0, this.fadeIn) / .6); }
    if ((this.timer -= dt) <= 0) {
      if (this.state === 'idle') {
        this.state = 'walk'; this.timer = .6 + Math.random() * 1.4;
        this.face = Math.abs(this.x - this.home) > 56 ? (this.x > this.home ? -1 : 1) : (Math.random() < .5 ? -1 : 1);
        this.refacing();
      } else { this.state = 'idle'; this.timer = 1 + Math.random() * 2.5; }
    }
    this.b.setVelocityX(this.state === 'walk' ? this.face * 34 : 0);
    if (this.flying) this.b.setVelocityY(Math.sin(this.t * 2) * 14 + (this.homeY - this.y) * .8);
    else if (this.onGround && this.state === 'walk') {
      if (this.b.blocked.left || this.b.blocked.right) { this.face *= -1; this.refacing(); }
      else if (Math.random() < dt * .5) this.b.setVelocityY(-170);   // 깡총
    }
    // 다가오면 돌아보며 하트
    this.heartT -= dt;
    if (this.heartT <= 0 && Math.abs(p.x - this.x) < 44 && Math.abs(p.y - this.y) < 34) {
      this.heartT = 3.5;
      this.face = p.x > this.x ? 1 : -1; this.refacing();
      this.scene.fx.floatText(this.x, this.b.y - 6, '♥', '#ff8ab0', 9);
    }
    const want = Math.abs(this.b.velocity.x) > 6 || this.flying ? 'Walk' : 'Idle';
    if (want !== this.animName) this.play(want);
    this.syncSprite(dt);
  }
}
