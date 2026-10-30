// 아레나 보스 (중간 보스 · 지방 최종 보스 · 히든 전설). 행동은 data/pokemon.js BOSSES 의 ai —
//  전용 패턴(gengar 등)이 없으면 'legend' 공용 패턴(돌진·탄막·내려찍기·낙하탄·광선)을 보스마다 moves·kind·color 로 다르게 쓴다.
//  체력 50% 에서 2페이즈 (megaSprite 가 있으면 모습까지 바뀐다)
import Phaser from 'phaser';
import { Enemy } from './Enemy.js';
import { BOSSES } from '../data/pokemon.js';
import { Sfx } from '../systems/Audio.js';
import { overlap } from './Combat.js';
import { bolt } from './Perks.js';
import { shockwave } from '../systems/PostFX.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
const STRIKE = new Set(['dash', 'dive', 'spin', 'spark', 'glide', 'jet', 'serpent', 'skydive', 'lunge', 'volt', 'boltRun', 'fbDive']);
// 공중 보스 체공 고도 제한: 이 상태들에서는 아래 땅·발판 위로 HOVER_GAP 보다 높이 뜨지 않는다 (1단 점프·기본기로 닿게)
const HOVER_STATES = new Set(['idle', 'wind', 'fire', 'recover', 'barrage', 'blinkFire']);
const HOVER_GAP = 30;                                      // 보스 발끝 ~ 아래 땅 (px)
const FREE_FLYERS = new Set(['eternatus']);                // 아레나 한가운데 고정된 거대 보스는 제외
// 약점 그로기: 상성별 게이지 증가량 (약점은 등배의 3.5배) · 그로기 시간 · 그로기 중 받는 피해 배율
const STAGGER_GAIN = { super: 8.4, normal: 2.4, weak: .8, immune: 0 };
export const GROGGY_T = 4.5, GROGGY_MUL = 1.35;

export class Boss extends Enemy {
  constructor(scene, key, x, y, o = {}) {
    super(scene, BOSSES[key].sprite || key, x, y, { def: BOSSES[key], boss: true, scale: 2, hpMul: o.hpMul, dmgMul: o.dmgMul });   // sprite: 레드의 피카츄·리자몽처럼 도트만 빌려 쓰는 보스
    this.bossKey = key;
    this.room = o.room;
    this.state = 'intro'; this.timer = 1.6; this.cd = 1.4; this.last = null; this.phase = 1;
    this.sprite.setAlpha(1);
    this.flying = !!this.def.fly || key === 'gengar';
    this.b.setAllowGravity(!this.flying);
    this.b.setMaxVelocity(700, 900);
    this.glowImg = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(18).setAlpha(.35);
  }

  get striking() { return STRIKE.has(this.state) || (this.state === 'leap' && this.diving); }   // 몸으로 부딪혀도 피해를 주는 상태

  zone(c) { return this.scene.combat.spawnZone(Object.assign({ owner: 'enemy', dmg: this.dmg, type: this.types[0] }, c)); }
  // 보스 투사체: 최종 진화형(3단, 메가진화 후엔 메가)으로 맞대결한다. 연발 탄막은 연속 투사체, 폭발하는 큰 탄(boom)은 단발
  shot(c) { return this.scene.combat.spawnProjectile(Object.assign({ owner: 'enemy', dmg: this.dmg, type: this.types[0], tier: this.megaForm ? 3 : 2, stream: !c.boom }, c)); }
  groundY() { return this.scene.level ? this.scene.groundBelow(this.x, this.b.y) : this.bottom; }

  update(dt, p) {
    const sc = this.scene, st = this.status;
    this.t += dt;
    for (const k in st) st[k] -= dt;
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = .5;
      if (st.burn > 0) sc.combat.damageEnemy(this, this.burnDps * .5, 'none', { dot: 'burn' });
      if (this.alive && st.poison > 0) sc.combat.damageEnemy(this, this.poisonDps * .5, 'none', { dot: 'poison' });
      if (!this.alive) return;
    }
    if (this.state === 'intro') {
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'idle'; this.intangible = false; }
    } else if (this.groggyT > 0) {
      this.updateGroggy(dt);
    } else if (this.state === 'rest') {
      this.updateRest(dt, p);
    } else if (st.stun > 0 || st.root > 0) {
      this.b.setVelocityX(this.b.velocity.x * .8);
      this.telegraph(false);
    } else {
      if (this.phase === 1 && this.hp < this.maxhp * .5) this.enterPhase2();
      const prev = this.state;
      (BOSS_AI[this.def.ai] || BOSS_AI.legend)(this, dt, p);
      if (prev === 'wind' && this.state !== 'wind') this.bigN = (this.bigN || 0) + 1;   // 큰 기술 하나를 썼다
      this.maybeRest();
      this.hoverCap();
    }
    if (this.striking && !this.intangible && overlap(this.bounds(), p.bounds())) p.takeHit(this.dmg, this.def.atkType || this.types[0], this.x, {});
    // 아레나 밖으로 나가지 않게 (날아다니는 보스는 위아래도)
    if (this.room) {
      const minX = this.room.left + 20, maxX = this.room.right - 20;
      if (this.x < minX) { this.b.x += minX - this.x; this.b.setVelocityX(Math.abs(this.b.velocity.x)); }
      if (this.x > maxX) { this.b.x -= this.x - maxX; this.b.setVelocityX(-Math.abs(this.b.velocity.x)); }
      if (this.flying) {
        const minY = this.room.top + 16, maxY = this.room.bottom - 10;
        if (this.y < minY) { this.b.y += minY - this.y; this.b.setVelocityY(Math.abs(this.b.velocity.y)); }
        if (this.y > maxY) { this.b.y -= this.y - maxY; this.b.setVelocityY(-Math.abs(this.b.velocity.y)); }
      }
    }
    this.alert.setPosition(Math.round(this.x), Math.round(this.top - 6));
    this.glowImg.setPosition(this.x, this.y).setScale(this.b.height / 20).setTint(this.phase === 2 ? 0xff5a9a : 0x9a7aff);
    this.tint = st.stun > 0 ? 0xfff0a0 : st.curse > 0 ? 0xd0a0ff : null;
    const want = this.state === 'wind' || this.state === 'charge' ? 'Attack' : this.state === 'fire' || this.state === 'barrage' || this.state === 'blinkFire' ? 'Shoot' : Math.abs(this.b.velocity.x) > 10 || this.flying ? 'Walk' : 'Idle';
    if (want !== this.animName) this.play(want);
    this.syncSprite(dt);
    this.syncCorruption(dt);
  }

  enterPhase2() {
    const sc = this.scene;
    this.phase = 2;
    sc.fx.shake(.012, 400); Sfx.play('boss');
    sc.fx.ring(this.x, this.y, 80, 0xff5a9a, 500);
    const meta = sc.registry.get('spriteMeta');
    if (this.def.megaName) {   // 메가진화·폼 체인지: 도트가 있으면 모습까지, 없으면 오라만 짙어진다
      const was = this.name;
      if (this.def.megaSprite && meta[this.def.megaSprite]?.hasSprite) this.setSpecies(this.def.megaSprite, 2);
      else { this.glowImg.setAlpha(.7); this.scaleBase *= this.def.megaScale || 1.1; }   // 도트가 없으면 오라 + 몸집 (무한다이맥스는 1.35배)
      this.name = this.def.megaName; this.megaForm = true;
      if (this.def.megaLine && sc.trainer && !sc.trainer.freed) { sc.trainer.gesture(0xffd27a); sc.trainer.say(this.def.megaLine); }   // 트레이너가 키스톤을 든다
      sc.cameras.main.flash(300, 255, 255, 255, true);
      sc.events.emit('banner', `${was}이(가) ${this.def.megaName}(으)로!`, '공격이 거세진다');
    } else if (this.def.rage) {   // 모습은 그대로 폭주 (뮤츠)
      this.glowImg.setAlpha(.6);
      sc.cameras.main.flash(260, 230, 180, 255, true);
      sc.events.emit('banner', `${this.name} 폭주!`, this.def.rage);
    } else sc.events.emit('toast', `${this.name}이(가) 분노했다!`);
  }

  // ---------------- 공중 보스: 낮게 뜨기 · 패턴 2~3번 뒤 착지해 숨 고르기 ----------------
  get hoverer() { return this.flying && !FREE_FLYERS.has(this.bossKey); }
  hoverCap() {
    if (!this.hoverer || !HOVER_STATES.has(this.state) || this.intangible) return;
    const gy = this.scene.groundBelow(this.x, this.bottom - 2), maxUp = gy - this.b.height / 2 - HOVER_GAP;
    if (this.y < maxUp) this.b.setVelocityY(Math.max(this.b.velocity.y, Math.min(170, (maxUp - this.y) * 3)));
  }
  maybeRest() {
    if (!this.hoverer || this.state !== 'idle' || this.intangible) return;
    if (this.restAt === undefined) this.restAt = 2 + (Math.random() < .5 ? 1 : 0);
    if ((this.bigN || 0) < this.restAt) return;
    const sc = this.scene;
    this.state = 'rest'; this.restT = 2.5 + Math.random(); this.restFx = 0;
    this.b.setAllowGravity(true); this.b.setVelocity(0, 140);
    this.telegraph(false);
    if (!sc.restTold) { sc.restTold = true; sc.events.emit('toast', `${this.name}이(가) 지쳐 내려앉았다 — 지금이 기회!`); }
  }
  updateRest(dt, p) {
    const sc = this.scene;
    this.restT -= dt; this.restFx -= dt;
    this.b.setVelocityX(this.b.velocity.x * .85);
    this.facePlayer(p);
    if (this.restFx <= 0) {   // 헐떡임: 머리 위로 흰 김
      this.restFx = .45;
      sc.fx.burst(this.x + this.face * 8, this.top + 4, [0xe8e8f0, 0xffffff], 3, 30, { angle: -Math.PI / 2, spread: .6, up: 30, grav: -20, bounce: false, life: .6, size: 2 });
    }
    if (this.restT <= 0) {
      this.b.setAllowGravity(false); this.b.setVelocityY(-150);
      this.state = 'idle'; this.cd = .5; this.bigN = 0; this.restAt = 2 + (Math.random() < .5 ? 1 : 0);
      sc.fx.ring(this.x, this.bottom - 2, 26, this.def.color || 0x9a7aff, 260);
    }
  }

  // ---------------- 약점 그로기 ----------------
  //  맞을 때마다 상성에 따라 게이지가 찬다 (약점은 등배의 3.5배 + "WEAKNESS!") → 100% 면 즉시 추락 · 4.5초 무방비 · 받는 피해 ×1.35
  addStagger(eff) {
    if (this.groggyT > 0 || this.state === 'intro' || !this.alive || this.gone) return;
    const sc = this.scene, gain = STAGGER_GAIN[eff] ?? STAGGER_GAIN.normal;
    if (!gain) return;
    this.stagger = Math.min(100, (this.stagger || 0) + gain);
    if (eff === 'super') {
      this.staggerFlash = .35;
      if (sc.time.now - (this.weakAt || -9999) > 380) { this.weakAt = sc.time.now; sc.fx.floatText(this.x, this.top - 16, 'WEAKNESS!', '#ffb040', 12); }
    }
    if (this.stagger >= 100) this.startGroggy();
  }
  startGroggy() {
    const sc = this.scene;
    this.groggyT = GROGGY_T; this.stagger = 100;
    this.state = 'groggy'; this.telegraph(false); this.intangible = false; this.sprite.setAlpha(1);
    if (this.puddle) this.puddle.clear();
    this.b.setAllowGravity(true); this.b.setVelocity(0, 300);   // 공중에 있어도 그대로 추락
    sc.fx.floatText(this.x, this.top - 26, '💥 GROGGY! (자세 무너짐)', '#ffd040', 14);
    sc.events.emit('banner', 'GROGGY!', `${this.name}의 자세가 무너졌다 · ${GROGGY_T}초 동안 무방비 · 받는 피해 ×${GROGGY_MUL}`);
    sc.fx.shake(.02, 500); sc.fx.hitStop(160); shockwave(sc, this.x, this.y, .05, 800);
    sc.fx.ring(this.x, this.y, 60, 0xffb040, 420); sc.fx.glow(this.x, this.y, 70, 0xffd040, 420, 1);
    sc.fx.burst(this.x, this.y, [0xffd040, 0xffb040, 0xffffff], 34, 220, { glow: true, up: 80 });
    Sfx.play('shatter'); Sfx.play('boom');
    // 머리 위를 도는 별 3개
    this.stars = [0, 1, 2].map(() => sc.add.text(this.x, this.top, '★', { fontFamily: 'Galmuri11', fontSize: '12px', color: '#ffe060', stroke: '#5a3a00', strokeThickness: 3, resolution: 2 }).setOrigin(.5).setDepth(45));
    this.fxObjs = (this.fxObjs || []).concat(this.stars);
  }
  updateGroggy(dt) {
    this.groggyT -= dt;
    this.stagger = 100 * Math.max(0, this.groggyT) / GROGGY_T;   // 게이지가 줄어들며 남은 시간을 보여 준다
    this.b.setVelocityX(this.b.velocity.x * .8);
    const t = this.scene.time.now / 1000;
    (this.stars || []).forEach((s, k) => { const a = t * 5 + k * Math.PI * 2 / 3; s.setPosition(this.x + Math.cos(a) * 18, this.top - 8 + Math.sin(a) * 5).setAlpha(.75 + Math.sin(t * 10 + k) * .25).setScale(.85 + Math.sin(a) * .2); });
    if (this.groggyT > 0) return;
    this.groggyT = 0; this.stagger = 0;
    for (const s of this.stars || []) s.destroy();
    this.stars = null;
    this.b.setAllowGravity(!this.flying);
    if (this.flying) this.b.setVelocityY(-140);
    this.state = 'idle'; this.cd = .6; this.bigN = 0;
  }

  // 짝 보스(라티아스·라티오스)가 먼저 정화되면: 유대의 힘으로 각성 — 빨라지고 혼자서 합동 공격을 모두 쓴다
  awaken() {
    const sc = this.scene, col = this.def.color || 0xffffff;
    this.awake = true; this.glowImg.setAlpha(.75);
    sc.fx.ring(this.x, this.y, 70, col, 500); sc.fx.glow(this.x, this.y, 60, col, 600, .9);
    sc.cameras.main.flash(250, 255, 255, 255, true); Sfx.play('mega');
    if (this.state === 'idle') this.cd = .4;
  }

  // 칠색조: 한 번에 큰 피해로 30%를 건너뛰어 쓰러질 뻔해도 불사조 부활은 반드시 한 번
  cheatDeath() {
    if (this.def.ai !== 'hooh' || this.reborn) return false;
    this.hp = 1; this.reborn = true; startRebirth(this);
    return true;
  }

  choose(list) {
    let s; do s = pick(list); while (s === this.last && list.length > 1);
    this.last = s; return s;
  }

  destroy() {
    this.gone = true; this.glowImg.destroy();
    for (const o of [...(this.fxObjs || []), ...(this.decoys || [])]) if (o && o.active) o.destroy();   // 분신 · 그림자 웅덩이 · 결정
    super.destroy();
  }
}

// 공통 상태: idle → (패턴) → recover → idle
function recover(e, dt, next = 'idle') { e.timer -= dt; e.b.setVelocityX(e.b.velocity.x * .85); if (e.timer <= 0) { e.state = next; e.cd = (e.phase === 2 ? .7 : 1.2) + Math.random() * .5; } }
function approachPlayer(e, p, speed, keep = 70) {
  e.facePlayer(p);
  const dx = p.x - e.x;
  e.b.setVelocityX(Math.abs(dx) > keep ? Math.sign(dx) * speed : 0);
}

const BOSS_AI = {
  venusaur(e, dt, p) {
    const sc = e.scene, ph2 = e.phase === 2;
    switch (e.state) {
      case 'idle':
        approachPlayer(e, p, ph2 ? 40 : 28, 80);
        e.cd -= dt;
        if (e.cd <= 0) { e.mode = e.choose(ph2 ? ['petal', 'vines', 'solar', 'powder'] : ['petal', 'vines', 'solar']); e.state = 'wind'; e.timer = e.mode === 'solar' ? 1.1 : .5; e.b.setVelocityX(0); e.telegraph(true); if (e.mode === 'solar') solarWarn(e); }
        break;
      case 'wind':
        e.timer -= dt;
        if (e.mode === 'solar' && Math.random() < .8) sc.fx.burst(e.x + e.face * 26 + (Math.random() - .5) * 60, e.y - 10 + (Math.random() - .5) * 40, 0xfff6a0, 1, 10, { grav: 0, bounce: false, glow: true, life: .3 });
        if (e.timer > 0) break;
        e.telegraph(false);
        if (e.mode === 'petal') {
          const n = ph2 ? 14 : 9;
          for (let k = 0; k < n; k++) e.shot({ x: e.x, y: e.top + 10, vx: e.face * (50 + Math.random() * 170), vy: -(140 + Math.random() * 140), grav: 380, r: 3, dmg: e.dmg * .8, type: 'grass', kind: 'leaf', life: 2.5, color: 0xff8ab0 });
          Sfx.play('leaf');
        } else if (e.mode === 'vines') {
          const n = ph2 ? 5 : 3;
          for (let k = 0; k < n; k++) {
            const x = p.x + (k - (n - 1) / 2) * 42 + (Math.random() - .5) * 10, gy = sc.groundBelow(x, p.y - 20);
            e.zone({ x: x - 10, y: gy - 72, w: 20, h: 72, delay: .8, life: 1.15, type: 'grass', draw: 'pillar', color: 0x5ed04a });
          }
          Sfx.play('leaf');
        } else if (e.mode === 'powder') {
          e.zone({ x: e.x - 70, y: e.y - 44, w: 140, h: 64, delay: .4, life: 3, multi: true, dmg: e.dmg * .5, type: 'poison', draw: 'cloud', color: 0xd08aff, status: { slow: 2 } });
        } else { Sfx.play('beam'); sc.fx.shake(.01, 400); }
        e.state = 'recover'; e.timer = e.mode === 'solar' ? 1.3 : .9;
        break;
      case 'recover': recover(e, dt); break;
    }
  },

  blastoise(e, dt, p) {
    const sc = e.scene, ph2 = e.phase === 2, b = e.b;
    switch (e.state) {
      case 'idle':
        approachPlayer(e, p, ph2 ? 46 : 32, 90);
        e.cd -= dt;
        if (e.cd <= 0) {
          e.mode = e.choose(['hydro', 'spin', 'barrage', 'skull']);
          e.state = 'wind'; e.timer = e.mode === 'hydro' ? .75 : .55; b.setVelocityX(0); e.telegraph(true); e.facePlayer(p);
          if (e.mode === 'hydro') {
            const len = 320, x = e.face > 0 ? e.x + 10 : e.x - 10 - len;
            e.zone({ x, y: e.top + 8, w: len, h: 14, delay: .75, life: 1.3, type: 'water', draw: 'beam', color: 0x9ad8ff, multi: true });
            if (ph2) e.zone({ x, y: e.bottom - 16, w: len, h: 12, delay: 1.15, life: 1.6, type: 'water', draw: 'beam', color: 0x9ad8ff, multi: true });
          }
        }
        break;
      case 'wind':
        e.timer -= dt; if (e.timer > 0) break;
        e.telegraph(false);
        if (e.mode === 'hydro') { Sfx.play('beam'); sc.fx.shake(.008, 500); e.state = 'recover'; e.timer = 1.4; }
        else if (e.mode === 'spin') { e.state = 'spin'; e.timer = ph2 ? 2.8 : 2.2; e.ft = 0; }
        else if (e.mode === 'skull') { e.state = 'dash'; e.timer = .55; Sfx.play('swing'); }
        else {
          const n = ph2 ? 8 : 5, g = 520;
          for (let k = 0; k < n; k++) {
            const tx = p.x + (k - (n - 1) / 2) * 34, ty = sc.groundBelow(tx, p.y - 20) - 4, t = .85 + Math.random() * .2;
            e.shot({ x: e.x, y: e.top + 6, vx: (tx - e.x) / t, vy: (ty - e.top - 6 - .5 * g * t * t) / t, grav: g, r: 5, type: 'water', kind: 'water', life: 2.5, boom: { r: 20 } });
          }
          Sfx.play('water'); e.state = 'recover'; e.timer = 1;
        }
        break;
      case 'spin':
        e.timer -= dt; e.ft -= dt;
        if (b.blocked.left || b.blocked.right) { e.face *= -1; sc.fx.shake(.006, 120); }
        b.setVelocityX(e.face * (ph2 ? 280 : 230));
        if (e.ft <= 0) { e.ft = .08; e.sprite.setFlipX(!e.sprite.flipX); sc.fx.ghost(e.sprite, 0x9ad8ff, .4, 200); }
        if (e.timer <= 0) { e.sprite.setFlipX(false); e.refacing(); e.state = 'recover'; e.timer = .8; }
        break;
      case 'dash':
        e.timer -= dt; b.setVelocityX(e.face * 300);
        if (e.timer % .05 < dt) sc.fx.ghost(e.sprite, 0xffffff, .35, 180);
        if (e.timer <= 0 || b.blocked.left || b.blocked.right) { sc.fx.shake(.01, 160); e.state = 'recover'; e.timer = .9; }
        break;
      case 'recover': recover(e, dt); break;
    }
  },

  charizard(e, dt, p) {
    const sc = e.scene, ph2 = e.phase === 2, b = e.b;
    switch (e.state) {
      case 'idle':
        approachPlayer(e, p, ph2 ? 60 : 44, 80);
        b.setAllowGravity(true);
        e.cd -= dt;
        if (e.cd <= 0) {
          e.mode = e.choose(['flame', 'dive', 'fireblast', 'airslash']);
          e.state = 'wind'; e.timer = e.mode === 'dive' ? .3 : .5; b.setVelocityX(0); e.telegraph(true); e.facePlayer(p);
          if (e.mode === 'flame') {
            const len = ph2 ? 190 : 150, x = e.face > 0 ? e.x + 6 : e.x - 6 - len;
            e.zone({ x, y: e.y - 14, w: len, h: 28, delay: .5, life: 1.6, multi: true, dmg: e.dmg * .8, type: 'fire', draw: 'fire', color: 0xff7a2a, status: {} });
          }
        }
        break;
      case 'wind':
        e.timer -= dt; if (e.timer > 0) break;
        e.telegraph(false);
        if (e.mode === 'flame') { Sfx.play('fire'); e.state = 'recover'; e.timer = 1.6; }
        else if (e.mode === 'dive') { e.state = 'rise'; e.timer = .55; b.setAllowGravity(false); b.setVelocity(0, -320); Sfx.play('dash'); }
        else if (e.mode === 'fireblast') {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.shot({ x: e.x + e.face * 20, y: e.y - 6, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 9, dmg: e.dmg * 1.3, type: 'fire', kind: 'fire', life: 2.2, boom: { r: 50 }, light: true });
          Sfx.play('fire'); e.state = 'fire'; e.timer = 1;
        } else {
          const n = ph2 ? 5 : 3, base = Math.atan2(p.y - e.y, p.x - e.x);
          for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * .2; e.shot({ x: e.x, y: e.y - 8, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 4, type: 'flying', kind: 'bolt', life: 1.6, color: 0xe0e8ff }); }
          Sfx.play('swing'); e.state = 'fire'; e.timer = .8;
        }
        break;
      case 'rise':
        e.timer -= dt;
        if (e.timer <= 0) {
          e.state = 'aim'; e.timer = .75; b.setVelocity(0, 0);
          e.targetX = p.x;
          const gy = sc.groundBelow(p.x, p.y - 20);
          e.zone({ x: p.x - 24, y: gy - 120, w: 48, h: 120, delay: .75, life: .76, dmg: 0, type: 'fire', color: 0xff7a2a });
        }
        break;
      case 'aim':
        e.timer -= dt;
        b.reset(e.targetX, e.y);
        if (e.timer <= 0) { e.state = 'dive'; b.setVelocity(0, 560); }
        break;
      case 'dive':
        if (b.blocked.down || b.onFloor()) {
          b.setAllowGravity(true); sc.fx.shake(.016, 260); Sfx.play('boom');
          for (const s of [-1, 1]) e.shot({ x: e.x, y: e.bottom - 8, vx: s * 200, r: 7, dmg: e.dmg, type: 'fire', kind: 'fire', life: 1.4 });
          sc.fx.burst(e.x, e.bottom - 2, [0xff7a2a, 0xffd04a], 26, 200, { up: 100 });
          e.state = 'recover'; e.timer = 1;
        }
        break;
      case 'fire': case 'recover': recover(e, dt); break;
    }
  },

  gengar(e, dt, p) {
    const sc = e.scene, ph2 = e.phase === 2, b = e.b;
    e.facePlayer(p);
    switch (e.state) {
      case 'idle': {
        const tx = p.x - Math.sign(p.x - e.x || 1) * 70, ty = p.y - 14 + Math.sin(e.t * 2) * 8;   // 근접 포켓몬도 닿는 높이
        b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.5, -90, 90), Phaser.Math.Clamp((ty - e.y) * 1.5, -90, 90));
        e.cd -= dt;
        if (e.cd <= 0) {
          e.mode = e.choose(['balls', 'teleport', 'pillars', 'hypnosis']);
          e.state = 'wind'; e.timer = e.mode === 'teleport' ? .4 : .55; e.telegraph(e.mode !== 'teleport');
          if (e.mode === 'teleport') { e.intangible = true; e.sprite.setAlpha(.25); }
        }
        break;
      }
      case 'wind':
        e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9);
        if (e.timer > 0) break;
        e.telegraph(false);
        if (e.mode === 'balls') {
          const n = ph2 ? 7 : 5, base = Math.atan2(p.y - e.y, p.x - e.x);
          for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * .3; e.shot({ x: e.x, y: e.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 5, type: 'ghost', kind: 'shadow', life: 3, homing: .8, ghost: true, color: 0x9a5aff }); }
          Sfx.play('ghost'); e.state = 'fire'; e.timer = .9;
        } else if (e.mode === 'teleport') {
          b.reset(Phaser.Math.Clamp(p.x - p.face * 46, e.room.left + 30, e.room.right - 30), p.y - 6);
          e.facePlayer(p); e.sprite.setAlpha(1); e.intangible = false;
          sc.fx.ring(e.x, e.y, 30, 0x9a5aff, 260);
          e.state = 'punchwind'; e.timer = ph2 ? .3 : .4; e.telegraph(true);
        } else if (e.mode === 'pillars') {
          const n = ph2 ? 6 : 4;
          for (let k = 0; k < n; k++) {
            const x = p.x + (k - (n - 1) / 2) * 46, gy = sc.groundBelow(x, p.y - 20);
            e.zone({ x: x - 11, y: gy - 110, w: 22, h: 110, delay: .9, life: 1.2, type: 'ghost', draw: 'pillar', color: 0xb06aff });
          }
          Sfx.play('ghost'); e.state = 'fire'; e.timer = 1.1;
        } else {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.shot({ x: e.x, y: e.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, r: 6, grow: 10, type: 'psychic', kind: 'bubble', life: 2.4, ghost: true, color: 0xff7ad0, status: { slow: 2.5 } });
          Sfx.play('wave'); e.state = 'fire'; e.timer = .8;
        }
        break;
      case 'punchwind':
        e.timer -= dt; b.setVelocity(0, 0);
        if (e.timer <= 0) {
          e.telegraph(false);
          const box = { x: e.face > 0 ? e.x : e.x - 50, y: e.y - 22, w: 50, h: 44 };
          sc.fx.slash(e.x + e.face * 22, e.y, 26, e.face, 0xb06aff, { thick: 9 });
          if (overlap(box, p.bounds())) p.takeHit(e.dmg * 1.3, 'ghost', e.x, {});
          Sfx.play('punch'); e.state = 'fire'; e.timer = .8;
        }
        break;
      case 'fire': case 'recover':
        e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9);
        if (e.timer <= 0) { e.state = 'idle'; e.cd = (ph2 ? .6 : 1.1) + Math.random() * .5; }
        break;
    }
  }
};

// ---------------- 전설 공용 패턴 ----------------
//  idle(다가가기·공중이면 머리 위에서 맴돌기) → wind(예고) → 패턴 → recover. 2페이즈는 예고가 짧고 탄이 많다
BOSS_AI.legend = function (e, dt, p) {
  const sc = e.scene, d = e.def, ph2 = e.phase === 2, b = e.b, fly = e.flying, col = d.color || 0xffffff, type = e.types[0];
  switch (e.state) {
    case 'idle': {
      e.facePlayer(p);
      if (fly) {
        const tx = p.x - Math.sign(p.x - e.x || 1) * 90, ty = p.y - 56 + Math.sin(e.t * 2.2) * 14, far = Math.abs(p.x - e.x) > 240 ? 190 : 110;   // 멀면 빨리 따라붙는다
        b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.6, -far, far), Phaser.Math.Clamp((ty - e.y) * 1.6, -110, 110));
      } else approachPlayer(e, p, Math.abs(p.x - e.x) > 260 ? 110 : ph2 ? 60 : 44, 90);
      e.cd -= dt;
      if (e.cd <= 0) {
        e.mode = e.choose(d.moves || ['dash', 'volley', 'slam', 'rain', 'beam']);
        e.state = 'wind'; e.timer = ph2 ? .42 : .6; e.telegraph(true);
        b.setVelocityX(0); if (fly) b.setVelocityY(0);
        sc.fx.glow(e.x, e.y, 34, col, e.timer * 1000, .7);
      }
      break;
    }
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .85); if (fly) b.setVelocityY(b.velocity.y * .85);
      if (e.timer > 0) break;
      e.telegraph(false);
      legendMove(e, p);
      break;
    case 'dash':
      e.timer -= dt;
      if (e.timer % .05 < dt) sc.fx.ghost(e.sprite, col, .45, 200);
      if (e.timer <= 0 || b.blocked.left || b.blocked.right) {
        if (b.blocked.left || b.blocked.right) sc.fx.shake(.008, 140);
        e.state = 'recover'; e.timer = .6; b.setVelocityX(b.velocity.x * .2);
      }
      break;
    case 'dive':   // 공중에서 플레이어 쪽으로 내리꽂았다가 다시 떠오른다
      e.timer -= dt;
      if (e.timer % .05 < dt) sc.fx.ghost(e.sprite, col, .45, 200);
      if (e.timer <= 0 || b.blocked.down) { slamWave(e, col, type, .7); b.setVelocity(0, -160); e.state = 'recover'; e.timer = .7; }
      break;
    case 'leap':   // 높이 뛰었다가 내려찍기 (땅 보스)
      e.timer -= dt;
      if (e.timer < .55 && !e.diving) { e.diving = true; b.setVelocity((p.x - e.x) * 1.6, 520); }
      if (e.diving && (b.blocked.down || e.timer <= 0)) { e.diving = false; slamWave(e, col, type); e.state = 'recover'; e.timer = .7; }
      break;
    case 'fire': case 'recover':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .88); if (fly) b.setVelocityY(b.velocity.y * .88);
      if (e.timer <= 0) { e.state = 'idle'; e.cd = (ph2 ? .55 : 1.05) + Math.random() * .5; }
      break;
  }
};
function legendMove(e, p) {
  const sc = e.scene, d = e.def, ph2 = e.phase === 2, b = e.b, fly = e.flying, col = d.color || 0xffffff, kind = d.kind || 'other', type = e.types[0], room = e.room;
  switch (e.mode) {
    case 'dash': {   // 몸통 돌진 (공중이면 플레이어 쪽으로 대각선 급강하)
      const sp = ph2 ? 430 : 340;
      if (fly) { const a = Math.atan2(p.y - e.y, p.x - e.x); b.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp); e.state = 'dive'; e.timer = .7; }
      else { b.setVelocity(e.face * sp, -60); e.state = 'dash'; e.timer = .65; }
      sc.fx.sonicBoom(e.x, e.y, e.face, 1.6); Sfx.play('dash');
      break;
    }
    case 'volley': {   // 부채꼴 탄막 (2페이즈는 두 번)
      const fire = () => {
        if (!live(e)) return;
        const n = ph2 ? 7 : 5, base = Math.atan2(p.y - e.y, p.x - e.x);
        for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * .22; e.shot({ x: e.x + e.face * 14, y: e.y - 4, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 5, kind, type, color: col, life: 2.2, ghost: kind === 'shadow' }); }
        Sfx.play('eshot');
      };
      fire(); if (ph2) sc.time.delayedCall(320, fire);
      e.state = 'fire'; e.timer = ph2 ? .9 : .7;
      break;
    }
    case 'slam':
      if (fly) { e.mode = 'dash'; legendMove(e, p); return; }   // 공중 보스는 내려찍기 대신 급강하
      b.setVelocity((p.x - e.x) * .8, -420); e.state = 'leap'; e.timer = 1.1; e.diving = false; Sfx.play('dash');
      break;
    case 'rain': {   // 천장에서 떨어지는 빛기둥 (경고 뒤 차례로)
      const n = ph2 ? 7 : 5;
      for (let k = 0; k < n; k++) {
        const x = Phaser.Math.Clamp(p.x + (k - (n - 1) / 2) * 44 + (Math.random() - .5) * 16, room.left + 10, room.right - 10), top = room.top + 4, gy = sc.groundBelow(x, top);
        e.zone({ x: x - 9, y: top, w: 18, h: Math.max(20, gy - top), delay: .75 + k * .06, life: .9 + k * .06, dmg: e.dmg, type, draw: 'pillar', color: col });
      }
      Sfx.play('thunder'); e.state = 'fire'; e.timer = 1.1;
      break;
    }
    case 'beam': {   // 플레이어 높이로 아레나를 가로지르는 광선 (경고 뒤)
      const x = room.left, w = room.right - room.left;
      e.zone({ x, y: p.y - 12, w, h: 22, delay: ph2 ? .7 : .95, life: ph2 ? 1.3 : 1.5, dmg: e.dmg * 1.4, type, draw: 'beam', color: col, multi: true });
      Sfx.play('beam'); e.state = 'fire'; e.timer = 1.2;
      break;
    }
  }
}
// 내려찍기 충격: 화면 흔들림 + 양옆으로 기는 충격파 + 바닥 파편
function slamWave(e, col, type, k = 1) {
  const sc = e.scene, gy = sc.groundBelow(e.x, e.y);
  sc.fx.shake(.014 * k, 260); Sfx.play('boom');
  sc.fx.ring(e.x, gy - 4, 60 * k, col, 360);
  for (const s of [-1, 1]) e.shot({ x: e.x + s * 16, y: gy - 8, vx: s * 230, vy: 0, r: 7, kind: 'wave', type, color: col, life: .9 });
  sc.fx.burst(e.x, gy - 2, [0x8a7a62, 0x4a4036, col], 20, 180, { angle: -Math.PI / 2, spread: 1.6, up: 140, grav: 650, bounce: true, size: 2 });
}

// ================= 관동 전용 패턴 =================
const ROCK_COL = 0xa88c66;
const live = e => e.alive && !e.gone;
const floorY = (e, x) => e.scene.groundBelow(x, e.room.bottom - 24);   // 아레나 바닥 (공중 발판은 건너뛴다) — 땅에서 솟는 공격·바닥을 쓰는 광선 기준   // 미뤄 둔 공격이 쓰러지거나 치워진 보스에게서 나가지 않게

// 천장 낙석: 바닥에 깜빡이는 표시 → 천장에서 바위가 떨어져 깨진다 (표시는 바위가 닿는 순간까지)
function rockfall(e, xs, o = {}) {
  const sc = e.scene, room = e.room, top = room.top + 6, g = 900;
  xs.forEach((x0, k) => {
    const x = Phaser.Math.Clamp(x0, room.left + 12, room.right - 12), gy = sc.groundBelow(x, top), wait = (o.delay ?? .55) + k * (o.step ?? .09);
    const fall = Math.sqrt(2 * Math.max(16, gy - top) / g);
    e.zone({ x: x - 9, y: gy - 8, w: 18, h: 8, delay: wait + fall, life: wait + fall + .02, dmg: 0, color: o.warn ?? 0xd8b080 });
    sc.time.delayedCall(wait * 1000, () => {
      if (!live(e)) return;
      sc.fx.burst(x, top, [0x6a5a48, 0x8a7a62], 3, 30, { angle: Math.PI / 2, spread: .6, up: -20, grav: 500, bounce: false, life: .4 });
      e.shot({ x, y: top, vx: 0, vy: 0, grav: g, r: o.r ?? 7, kind: o.kind ?? 'rock', color: o.color ?? ROCK_COL, life: 3, muzzle: false, dmg: e.dmg * (o.mul ?? 1),
        update: q => { if (q.y >= gy - 3 && !q.kill) { q.kill = 'wall'; if (o.onLand && live(e)) o.onLand(x, gy); } } });   // 표시한 자리(발판 위여도)에서 깨진다
    });
  });
}
// 땅에서 솟구치며 부채꼴로 튀는 바위
function eruptRocks(e, x, gy, n, o = {}) {
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k - (n - 1) / 2) * (1.5 / n) + (Math.random() - .5) * .15, sp = 300 + Math.random() * 120;
    e.shot({ x: x + (k - (n - 1) / 2) * 4, y: gy - 12, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 760, r: o.r ?? 6, kind: o.kind ?? 'rock', color: o.color ?? ROCK_COL, life: 2.6, muzzle: false });
  }
}

// ---- 롱스톤 (회색시티 박물관 중간 보스) · 강철톤 (블루시티 동굴 밑바닥 히든, def.steel) — 바위뱀의 땅속 습격 ----
//  땅파기: 땅속으로 사라져 흙먼지 줄을 끌며 다가오다 → 발밑에 표시 → 솟구치며 바위 분수 (강철톤은 연달아 2~3번)
//  낙석: 꼬리로 땅을 내리쳐 천장에서 바위가 쏟아진다 · 몸통 휩쓸기: 바닥을 쓸며 돌진 (벽을 들이받으면 천장이 울린다)
//  바위 던지기: 포물선으로 큰 바위 (떨어진 자리에서 터진다) · 강철톤: 아이언헤드 내려찍기 + 쇠 파편 부채
//  2페이즈: 지진 — 아레나 바닥 전체가 흔들린다 (발판 위만 안전)
function startDig(e) {
  const sc = e.scene;
  e.state = 'burrow'; e.timer = .4; e.intangible = true; e.b.setVelocityX(0);
  sc.tweens.add({ targets: e.sprite, alpha: 0, duration: 320 });
  e.glowImg.setAlpha(0);
  sc.fx.burst(e.x, e.bottom - 1, [0x5a4a38, 0x8a7a62, 0x3a2e24], 18, 160, { angle: -Math.PI / 2, spread: 1.4, up: 120, grav: 700, bounce: true, size: 2 });
  sc.fx.shake(.008, 260); Sfx.play('crack');
}
BOSS_AI.onix = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, steel = !!e.def.steel, room = e.room;
  const col = e.def.color || ROCK_COL, kind = steel ? 'steel' : 'rock', type = e.types[0];
  switch (e.state) {
    case 'idle': {
      approachPlayer(e, p, Math.abs(p.x - e.x) > 260 ? 110 : ph2 ? 58 : 42, 80);
      e.cd -= dt;
      if (e.cd > 0) break;
      const list = ['dig', 'rockfall', 'sweep', 'throw'];
      if (steel) list.push('ironhead');
      if (ph2) list.push('quake');
      e.mode = e.choose(list);
      e.state = 'wind'; e.timer = { dig: .55, rockfall: .6, sweep: .5, throw: .45, ironhead: .5, quake: .9 }[e.mode] * (ph2 ? .8 : 1);
      e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      if (e.mode === 'quake') { sc.fx.shake(.006, e.timer * 1000); Sfx.play('boss'); }
      break;
    }
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .85);
      if (e.mode === 'dig' && Math.random() < .5) sc.fx.burst(e.x + (Math.random() - .5) * b.width, e.bottom - 1, [0x5a4a38, 0x8a7a62], 1, 50, { angle: -Math.PI / 2, spread: 1.4, up: 40, grav: 500, life: .4 });
      if (e.timer > 0) break;
      e.telegraph(false);
      onixMove(e, p);
      break;
    case 'burrow':   // 땅속으로 파고든다
      e.timer -= dt;
      if (e.timer <= 0) { e.state = 'under'; e.timer = ph2 ? 1.05 : 1.35; e.marked = false; }
      break;
    case 'under': {   // 흙먼지 줄을 끌며 다가온다 → 끝나기 0.55초 전 발밑에 표시
      e.timer -= dt; e.dustT = (e.dustT || 0) - dt;
      if (!e.marked) {   // 땅속 혹: 흙더미가 들썩이고 돌 부스러기가 튄다 · 낮게 우르릉
        b.setVelocityX(Phaser.Math.Clamp((p.x - e.x) * 3, -230, 230));
        if (e.dustT <= 0) {
          e.dustT = .045;
          sc.fx.burst(e.x, e.bottom - 1, [0x5a4a38, 0x8a7a62, 0x3a2e24, 0xa88c66], 4, 90, { angle: -Math.PI / 2, spread: 1, up: 80, grav: 650, life: .5, size: 2 });
          sc.fx.burst(e.x + (Math.random() - .5) * 16, e.bottom - 2, [0x6a6058, 0x8a8078], 1, 20, { angle: -Math.PI / 2, spread: 1.4, up: 16, grav: -20, bounce: false, life: .7, size: 2, drag: .95 });
          if (Math.random() < .25) sc.fx.shake(.003, 90);
        }
      }
      if (!e.marked && e.timer <= .55) {
        e.marked = true; b.setVelocityX(0);
        const tx = Phaser.Math.Clamp(p.x, room.left + 24, room.right - 24), gy = floorY(e, tx);
        b.reset(tx, gy - b.height / 2 - 1);
        e.zone({ x: tx - 22, y: gy - 90, w: 44, h: 90, delay: .55, life: .9, dmg: e.dmg * 1.25, type, draw: 'pillar', color: steel ? 0xd8e0f0 : 0xd8b080 });
        sc.fx.shake(.005, 500);
      }
      if (e.timer <= 0) {   // 솟구친다
        e.sprite.setAlpha(1); e.glowImg.setAlpha(.35); e.intangible = false;
        b.setVelocity(0, -360);
        const gy = floorY(e, e.x);
        eruptRocks(e, e.x, gy, ph2 ? 7 : 5, { kind, color: col });
        sc.fx.shake(.014, 300); Sfx.play('boom');
        sc.fx.burst(e.x, gy - 2, [0x5a4a38, 0x8a7a62, 0xa88c66], 24, 200, { angle: -Math.PI / 2, spread: 1.2, up: 160, grav: 700, bounce: true, size: 2 });
        e.digs = (e.digs || 1) - 1;
        if (e.digs > 0) { e.state = 'reburrow'; e.timer = .6; }   // 강철톤: 내려앉자마자 다시 파고든다
        else { e.state = 'recover'; e.timer = .9; }
      }
      break;
    }
    case 'reburrow':
      e.timer -= dt;
      if ((e.timer <= 0 && (b.blocked.down || b.onFloor())) || e.timer < -1) startDig(e);
      break;
    case 'dash': {   // 몸통 휩쓸기: 바닥을 쓸며 돌 부스러기를 뒤로 튀긴다
      e.timer -= dt; e.dustT = (e.dustT || 0) - dt;
      b.setVelocityX(e.face * (ph2 ? 370 : 310));
      if (e.timer % .05 < dt) sc.fx.ghost(e.sprite, col, .35, 180);
      if (e.dustT <= 0) { e.dustT = .12; e.shot({ x: e.x - e.face * 16, y: e.bottom - 8, vx: -e.face * (40 + Math.random() * 60), vy: -(180 + Math.random() * 120), grav: 800, r: 4, kind, color: col, life: 1.6, muzzle: false, dmg: e.dmg * .6 }); }
      const wall = b.blocked.left || b.blocked.right;
      if (e.timer <= 0 || wall) {
        if (wall) {   // 벽을 들이받으면 천장이 울려 바위 몇 개
          sc.fx.shake(.012, 240); Sfx.play('boom');
          rockfall(e, [p.x - 44, p.x + 44, p.x], { kind, color: col, delay: .2 });
        }
        e.state = 'recover'; e.timer = .8; b.setVelocityX(0);
      }
      break;
    }
    case 'leap':   // 강철톤 아이언헤드: 높이 뛰었다가 머리로 내려찍기
      e.timer -= dt;
      if (e.timer < .5 && !e.diving) { e.diving = true; b.setVelocity((p.x - e.x) * 1.8, 560); }
      if (e.diving && (b.blocked.down || e.timer <= 0)) {
        e.diving = false; slamWave(e, steel ? 0xd8e0f0 : col, type);
        const gy = sc.groundBelow(e.x, e.y), n = ph2 ? 10 : 8;
        for (let k = 0; k < n; k++) { const a = Math.PI + (k / (n - 1)) * Math.PI; e.shot({ x: e.x, y: gy - 14, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, r: 4, kind, color: col, life: 1.4, muzzle: false, dmg: e.dmg * .7 }); }
        e.state = 'recover'; e.timer = .8;
      }
      break;
    case 'fire': case 'recover': recover(e, dt); break;
  }
};
function onixMove(e, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, steel = !!e.def.steel, room = e.room, col = e.def.color || ROCK_COL, kind = steel ? 'steel' : 'rock';
  switch (e.mode) {
    case 'dig': e.digs = steel ? (ph2 ? 3 : 2) : (ph2 ? 2 : 1); startDig(e); break;
    case 'rockfall': {   // 꼬리로 땅을 내리쳐 천장을 울린다
      sc.fx.shake(.01, 400); Sfx.play('boom');
      const n = ph2 ? 7 : 5, xs = [];
      for (let k = 0; k < n; k++) xs.push(p.x + (k - (n - 1) / 2) * 46 + (Math.random() - .5) * 18);
      rockfall(e, Phaser.Utils.Array.Shuffle(xs), { kind, color: col, r: 8 });
      e.state = 'fire'; e.timer = 1.1;
      break;
    }
    case 'sweep': e.state = 'dash'; e.timer = .75; Sfx.play('dash'); sc.fx.sonicBoom(e.x, e.y, e.face, 1.8); break;
    case 'throw': {   // 포물선 바위 (떨어진 자리에서 터진다)
      const n = ph2 ? 4 : 3, g = 620;
      for (let k = 0; k < n; k++) {
        const tx = p.x + (k - (n - 1) / 2) * 50, ty = sc.groundBelow(tx, p.y - 20) - 6, t = .8 + k * .08;
        e.shot({ x: e.x, y: e.top + 6, vx: (tx - e.x) / t, vy: (ty - e.top - 6 - .5 * g * t * t) / t, grav: g, r: 8, kind, color: col, life: 2.4, boom: { r: 22 } });
      }
      Sfx.play('swing'); e.state = 'fire'; e.timer = .9;
      break;
    }
    case 'ironhead': b.setVelocity((p.x - e.x) * .8, -460); e.state = 'leap'; e.timer = 1.1; e.diving = false; Sfx.play('dash'); break;
    case 'quake': quakeZone(e); e.state = 'fire'; e.timer = 2; break;   // 지진: 아레나 바닥 전체 (발판 위만 안전)
  }
}

// ---- 후딘 → 메가후딘 (실프주식회사 중간 보스) — 숟가락과 염동력 ----
//  순간이동(잔상) 직후 사이코빔 3갈래 · 숟가락 부메랑(날아가 멈칫했다가 손으로 돌아온다)
//  염동력 격자: 세로 기둥이 짝·홀 번갈아 내려온다 · 미래예지: 서 있던 자리가 늦게 터진다
//  메가: 순간이동 3연속 · 숟가락 4개 · 격자에 가로 줄 · 미래예지 3번 · 몸 둘레를 돌던 구슬 8개가 소용돌이로 퍼지는 사이코웨이브
function startBlink(e, hide = .28) {
  const sc = e.scene, col = e.def.color || 0xff5a9a;
  sc.fx.ghost(e.sprite, col, .5, 260);
  sc.fx.ring(e.x, e.y, 22, col, 200);
  e.sprite.setAlpha(.12); e.intangible = true; e.b.setVelocity(0, 0);
  e.state = 'blinkOut'; e.timer = hide;
}
// 플레이어에게서 dmin~dmax 떨어진 아레나 안 공중 (above: 머리 위도 고른다)
//  75% 는 플레이어가 딛고 있는 땅·발판 바로 위 (허공 한가운데가 아니라 때릴 수 있는 높이)
function blinkSpot(e, p, dmin, dmax, above = false) {
  const room = e.room, sc = e.scene;
  if (Math.random() < .75) for (let k = 0; k < 12; k++) {
    const s = Math.random() < .5 ? -1 : 1, x = p.x + s * (dmin + Math.random() * (dmax - dmin));
    if (x < room.left + 30 || x > room.right - 30 || sc.isSolidAt(x, p.y - 8)) continue;
    const gy = sc.groundBelow(x, p.y - 30);
    if (gy - p.bottom > 80 || gy - p.bottom < -60) continue;   // 플레이어와 같은 층쯤
    return { x, y: gy - e.b.height / 2 - 4 };
  }
  for (let k = 0; k < 16; k++) {
    if (above && Math.random() < .3) {
      const x = Phaser.Math.Clamp(p.x + (Math.random() - .5) * 60, room.left + 30, room.right - 30), y = p.y - 110 - Math.random() * 30;
      if (y > room.top + 24) return { x, y };
      continue;
    }
    const s = Math.random() < .5 ? -1 : 1, x = p.x + s * (dmin + Math.random() * (dmax - dmin));
    if (x < room.left + 30 || x > room.right - 30) continue;
    return { x, y: Phaser.Math.Clamp(p.y - 30 - Math.random() * 60, room.top + 24, room.bottom - 30) };
  }
  return { x: Phaser.Math.Clamp(p.x + 150, room.left + 30, room.right - 30), y: Phaser.Math.Clamp(p.y - 50, room.top + 24, room.bottom - 30) };
}
function appear(e, p, at) {
  const sc = e.scene, col = e.def.color || 0xff5a9a;
  e.b.reset(at.x, at.y); e.b.setVelocity(0, 0);
  e.sprite.setAlpha(1); e.intangible = false; e.facePlayer(p);
  sc.fx.ring(e.x, e.y, 26, col, 240); sc.fx.glow(e.x, e.y, 30, col, 200, .8); Sfx.play('wave');
}
BOSS_AI.alakazam = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xff5a9a;
  switch (e.state) {
    case 'idle': {
      e.facePlayer(p);
      const tx = p.x - Math.sign(p.x - e.x || 1) * 130, ty = p.y - 22 + Math.sin(e.t * 2.4) * 8, far = Math.abs(p.x - e.x) > 260 ? 200 : 100;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.6, -far, far), Phaser.Math.Clamp((ty - e.y) * 1.6, -110, 110));
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(ph2 ? ['blink', 'spoons', 'grid', 'future', 'orbit'] : ['blink', 'spoons', 'grid', 'future']);
      e.state = 'wind'; e.timer = ph2 ? .4 : .55; e.telegraph(true); b.setVelocity(0, 0);
      sc.fx.glow(e.x, e.y - 6, 30, col, e.timer * 1000, .7);
      break;
    }
    case 'wind':
      e.timer -= dt; b.setVelocity(b.velocity.x * .85, b.velocity.y * .85);
      if (e.timer > 0) break;
      e.telegraph(false);
      alakazamMove(e, p);
      break;
    case 'blinkOut':
      e.timer -= dt;
      if (e.timer <= 0) { appear(e, p, blinkSpot(e, p, 140, 220)); e.state = 'blinkFire'; e.timer = ph2 ? .22 : .32; }
      break;
    case 'blinkFire': {   // 나타나자마자 사이코빔 3갈래
      e.timer -= dt; b.setVelocity(0, 0);
      if (e.timer > 0) break;
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      for (const da of [-.18, 0, .18]) e.shot({ x: e.x + e.face * 10, y: e.y - 4, vx: Math.cos(base + da) * 230, vy: Math.sin(base + da) * 230, r: 5, kind: 'bubble', color: col, life: 1.8 });
      Sfx.play('eshot');
      e.blinks = (e.blinks || 1) - 1;
      if (e.blinks > 0) startBlink(e, .2); else { e.state = 'fire'; e.timer = .6; }
      break;
    }
    case 'fire': case 'recover':
      e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9);
      if (e.timer <= 0) { e.state = 'idle'; e.cd = (ph2 ? .55 : 1) + Math.random() * .45; }
      break;
  }
};
function alakazamMove(e, p) {
  const sc = e.scene, ph2 = e.phase === 2, room = e.room, col = e.def.color || 0xff5a9a;
  switch (e.mode) {
    case 'blink': e.blinks = ph2 ? 3 : 1; startBlink(e); break;
    case 'spoons': {   // 숟가락 부메랑
      const n = ph2 ? 4 : 2, base = Math.atan2(p.y - e.y, p.x - e.x);
      for (let k = 0; k < n; k++) {
        const a = base + (k - (n - 1) / 2) * .38;
        e.shot({ x: e.x, y: e.y - 6, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, r: 6, kind: 'spoon', color: 0xd8dce8, life: 3, ghost: true, muzzle: false,
          update: (q, dt) => {
            if (q.t < .55) { q.vx *= 1 - dt * 2.2; q.vy *= 1 - dt * 2.2; return; }   // 날아가며 느려진다
            if (!live(e)) { q.life = 0; return; }
            const dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy) || 1, sp = 290;
            q.vx += (dx / d * sp - q.vx) * Math.min(1, dt * 5); q.vy += (dy / d * sp - q.vy) * Math.min(1, dt * 5);
            if (q.t > .8 && d < 14) q.life = 0;   // 손에 돌아왔다
          } });
      }
      Sfx.play('swing'); e.state = 'fire'; e.timer = 1.3;
      break;
    }
    case 'grid': {   // 염동력 격자: 세로 기둥이 짝·홀 번갈아 (메가는 플레이어 높이 가로 줄 하나 더)
      const W = room.right - room.left, n = Math.max(6, Math.floor(W / 64));
      for (let k = 0; k < n; k++) {
        const x = room.left + (k + .5) * (W / n), gy = floorY(e, x), d = k % 2 ? 1.45 : .8;
        e.zone({ x: x - 11, y: room.top + 2, w: 22, h: Math.max(20, gy - room.top - 2), delay: d, life: d + .5, dmg: e.dmg, type: 'psychic', draw: 'pillar', color: col });
      }
      if (ph2) e.zone({ x: room.left, y: p.y - 10, w: W, h: 18, delay: 2, life: 2.5, dmg: e.dmg, type: 'psychic', draw: 'beam', color: 0xffb0d8, multi: true });
      Sfx.play('beam'); e.state = 'fire'; e.timer = ph2 ? 2.2 : 1.7;
      break;
    }
    case 'future': {   // 미래예지: 지금 서 있는 자리에 표식 → 늦게 터진다 (메가는 3번, 따라다니며)
      const n = ph2 ? 3 : 1, r = 26;
      for (let k = 0; k < n; k++) sc.time.delayedCall(k * 450, () => {
        if (!live(e)) return;
        const cx = p.x, cy = p.y - 4;
        e.zone({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, delay: 1.2, life: 1.5, dmg: e.dmg * 1.3, type: 'psychic', draw: 'burst', round: true, color: col });
        sc.fx.glow(cx, cy, 20, col, 300, .6); Sfx.play('select');
        sc.time.delayedCall(1200, () => { if (!live(e)) return; sc.fx.ring(cx, cy, r + 8, col, 320); sc.fx.burst(cx, cy, [col, 0xffffff, 0xffb0d8], 16, 160, { glow: true, up: 40, life: .5 }); Sfx.play('boom'); });
      });
      e.state = 'fire'; e.timer = ph2 ? 1.4 : 1;
      break;
    }
    case 'orbit': {   // 사이코웨이브: 구슬 8개가 몸 둘레를 돌다가(점점 빨리) 소용돌이로 퍼진다
      const n = 8, hold = 1.1, R = 34;
      for (let k = 0; k < n; k++) {
        const a0 = k / n * Math.PI * 2;
        e.shot({ x: e.x + Math.cos(a0) * R, y: e.y + Math.sin(a0) * R, r: 5, kind: 'bubble', color: col, life: hold + 2.2, ghost: true, muzzle: false,
          update: q => {
            if (!live(e)) { q.life = 0; return; }
            if (q.t < hold) { const a = a0 + q.t * (2.5 + q.t * 2); q.x = e.x + Math.cos(a) * R; q.y = e.y + Math.sin(a) * R; q.vx = 0; q.vy = 0; return; }
            if (!q.launched) { q.launched = true; q.ghost = false; const a = a0 + hold * (2.5 + hold * 2) + .5; q.vx = Math.cos(a) * 190; q.vy = Math.sin(a) * 190; }
          } });
      }
      e.b.setVelocity(0, 0);
      Sfx.play('wave'); e.state = 'fire'; e.timer = hold + .5;
      break;
    }
  }
}

// ---- 뮤츠 (관동 최종 보스 · 심연에 폭주하는) ----
//  사이코브레이크: 아레나 한가운데 위로 날아올라 기를 모은 뒤 거대한 파동 고리가 퍼진다 — 닿는 순간 대시(무적)로 뚫어야 한다 (폭주하면 두 겹)
//  염동력 파편: 바닥을 뜯어 낸 바위가 보랏빛으로 떠올라 흔들리다 하나씩 날아온다
//  순간이동 + 섀도볼 난사: 사라졌다가 플레이어 옆·머리 위에 나타나 검보라 구슬을 쏟아붓는다 (폭주하면 두 번)
//  체력 50%(폭주)에 들어서는 순간 곧바로 사이코브레이크
function psyRing(e, x, y, o = {}) {
  const sc = e.scene, g = sc.add.graphics().setDepth(33).setBlendMode(Phaser.BlendModes.ADD), col = o.color ?? 0xd07aff, speed = o.speed ?? 240, max = o.max ?? 900, th = 9;
  let R = 14, hit = false;
  e.zone({ x: 0, y: 0, w: 0, h: 0, dmg: 0, life: max / speed, draw: 'none',
    onUpdate: (z, dt) => {
      R += speed * dt;
      const a = Math.max(0, 1 - R / max);
      g.clear();
      g.lineStyle(th * 2 + 8, col, .16 * a); g.strokeCircle(x, y, R);
      g.lineStyle(th * 2, col, .45 * a); g.strokeCircle(x, y, R);
      g.lineStyle(4, 0xffffff, .9 * a); g.strokeCircle(x, y, R);
      const p = sc.player;
      if (!hit && live(e) && Math.abs(Math.hypot(p.x - x, p.y - y) - R) < th + 6 && p.takeHit(e.dmg * 1.5, 'psychic', x, {})) hit = true;
    },
    dispose: () => g.destroy() });
}
function mewBlink(e) {
  const sc = e.scene, col = e.def.color || 0xb06aff;
  sc.fx.ghost(e.sprite, col, .55, 300); sc.fx.ring(e.x, e.y, 26, col, 220);
  sc.fx.burst(e.x, e.y, [0x12061c, 0x3a1a5a, col], 12, 70, { up: 10, grav: -30, bounce: false, life: .5, size: 2, drag: .94 });
  e.sprite.setAlpha(.1); e.intangible = true; e.b.setVelocity(0, 0);
  e.state = 'blinkOut'; e.timer = .35;
  Sfx.play('ghost');
}
BOSS_AI.mewtwo = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xb06aff, room = e.room;
  switch (e.state) {
    case 'idle': {
      e.facePlayer(p);
      const tx = p.x - Math.sign(p.x - e.x || 1) * 110, ty = p.y - 24 + Math.sin(e.t * 2) * 8, far = Math.abs(p.x - e.x) > 240 ? 200 : 110;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.6, -far, far), Phaser.Math.Clamp((ty - e.y) * 1.6, -110, 110));
      e.cd -= dt;
      if (ph2 && !e.raged) { e.raged = true; e.cd = 0; e.forced = 'psystrike'; }
      if (e.cd > 0) break;
      e.mode = e.forced || e.choose(ph2 ? ['psystrike', 'debris', 'blink', 'blink'] : ['psystrike', 'debris', 'blink']);
      e.forced = null;
      if (e.mode === 'psystrike') { e.state = 'rise'; e.timer = 1; break; }
      e.state = 'wind'; e.timer = ph2 ? .4 : .55; e.telegraph(true); b.setVelocity(0, 0);
      sc.fx.glow(e.x, e.y, 30, col, e.timer * 1000, .7);
      break;
    }
    case 'wind':
      e.timer -= dt; b.setVelocity(b.velocity.x * .85, b.velocity.y * .85);
      if (e.timer > 0) break;
      e.telegraph(false);
      mewtwoMove(e, p);
      break;
    case 'rise': {   // 사이코브레이크: 플레이어 머리 위 조금 아레나 가운데 쪽 (화면 안에서 기를 모은다)
      e.timer -= dt;
      const tx = Phaser.Math.Clamp(p.x + Math.sign(room.cx - p.x) * 60, room.left + 60, room.right - 60), ty = Math.max(room.top + 30, p.y - 120), d = Math.hypot(tx - e.x, ty - e.y);
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 3, -320, 320), Phaser.Math.Clamp((ty - e.y) * 3, -320, 320));
      if (d < 10 || e.timer <= 0) {
        b.setVelocity(0, 0); e.state = 'charge'; e.timer = e.chargeT = ph2 ? 1 : 1.3; e.telegraph(true);
        sc.fx.glow(e.x, e.y, 70, col, e.timer * 1000, .9); Sfx.play('mega');
        if (!e.psyTold) { e.psyTold = true; sc.events.emit('toast', '사이코브레이크 — 파동이 닿는 순간 대시(Shift)로 뚫고 지나가자!'); }
      }
      break;
    }
    case 'charge': {   // 사방에서 빛 알갱이가 빨려 든다 (이때가 때릴 틈)
      e.timer -= dt; b.setVelocity(0, 0);
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 40;
        sc.fx.burst(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, [col, 0xffffff, 0xffb0ff], 1, 200, { angle: a + Math.PI, spread: .05, up: 0, grav: 0, bounce: false, glow: true, life: .4, drag: 1 });
      }
      if (e.timer > 0) break;
      e.telegraph(false);
      sc.cameras.main.flash(160, 255, 220, 255, true); sc.fx.shake(.018, 450); Sfx.play('boom'); Sfx.play('beam');
      psyRing(e, e.x, e.y, { color: col });
      if (ph2) sc.time.delayedCall(520, () => { if (live(e)) { psyRing(e, e.x, e.y, { color: 0xff7ad0, speed: 270 }); Sfx.play('beam'); } });
      e.state = 'fire'; e.timer = ph2 ? 1.5 : 1.2;
      break;
    }
    case 'blinkOut':
      e.timer -= dt;
      if (e.timer <= 0) { appear(e, p, blinkSpot(e, p, 130, 170, true)); e.state = 'barrage'; e.timer = .25; e.left = ph2 ? 11 : 8; e.shotT = 0; }
      break;
    case 'barrage': {   // 섀도볼 난사
      e.timer -= dt; b.setVelocity(0, 0); e.facePlayer(p);
      if (e.timer > 0) break;
      e.shotT -= dt;
      if (e.shotT <= 0 && e.left > 0) {
        e.shotT = ph2 ? .055 : .07; e.left--;
        const a = Math.atan2(p.y - e.y, p.x - e.x) + (Math.random() - .5) * .24;
        e.shot({ x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 5, kind: 'shadow', type: 'ghost', color: 0x9a5aff, life: 2.4, homing: .3, ghost: true });
        Sfx.play('ghost');
      }
      if (e.left <= 0) {
        e.blinks = (e.blinks || 1) - 1;
        if (e.blinks > 0) mewBlink(e); else { e.state = 'fire'; e.timer = .7; }
      }
      break;
    }
    case 'fire': case 'recover':
      e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9);
      if (e.timer <= 0) { e.state = 'idle'; e.cd = (ph2 ? .5 : .95) + Math.random() * .45; }
      break;
  }
};
function mewtwoMove(e, p) {
  const sc = e.scene, ph2 = e.phase === 2, room = e.room, col = e.def.color || 0xb06aff;
  switch (e.mode) {
    case 'blink': e.blinks = ph2 ? 2 : 1; mewBlink(e); break;
    case 'debris': {   // 염동력으로 바닥을 뜯어 띄운 바위가 하나씩 날아온다
      const n = ph2 ? 6 : 4, step = ph2 ? .18 : .26;
      for (let k = 0; k < n; k++) {
        const x = Phaser.Math.Clamp(p.x + (k - (n - 1) / 2) * 70 + (Math.random() - .5) * 20, room.left + 16, room.right - 16), gy = floorY(e, x);
        const hoverY = Math.max(room.top + 20, gy - 70 - Math.random() * 40), launch = .75 + k * step;
        sc.fx.burst(x, gy - 2, [0x5a4a38, 0x8a7a62, col], 10, 120, { angle: -Math.PI / 2, spread: 1, up: 100, grav: 600, bounce: true });
        e.shot({ x, y: gy - 10, vx: 0, vy: 0, r: 8, kind: 'debris', color: col, life: launch + 2.5, ghost: true, muzzle: false, dmg: e.dmg * 1.1,
          update: q => {
            if (!live(e)) { q.life = 0; return; }
            if (q.t < launch) { q.vx = 0; q.vy = (hoverY - q.y) * 4 + Math.sin(q.t * 6 + k) * 6; return; }   // 떠올라 흔들리며 기다린다
            if (!q.launched) {
              q.launched = true; q.ghost = false;
              const pl = sc.player, a = Math.atan2(pl.y - q.y, pl.x - q.x), sp = ph2 ? 400 : 330;
              q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp; Sfx.play('swing');
            }
          } });
      }
      Sfx.play('crack'); sc.fx.shake(.008, 300);
      e.state = 'fire'; e.timer = .8 + n * step;
      break;
    }
  }
}

// ================= 성도 · 호연 전용 패턴 =================
const ADDB = Phaser.BlendModes.ADD;
const LATI_PINK = 0xff6a8a, LATI_BLUE = 0x6a9aff;
// 점과 선분 사이 거리
function segDist(px, py, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1, L = dx * dx + dy * dy || 1, t = Phaser.Math.Clamp(((px - s.x1) * dx + (py - s.y1) * dy) / L, 0, 1);
  return Math.hypot(px - (s.x1 + dx * t), py - (s.y1 + dy * t));
}
// 선 모양 위험 (광선 쓸기 · 등대 빛): seg(k, t) 가 매 프레임 선분 {x1,y1,x2,y2} 를 정한다 (k: 0→1 진행도)
//  delay 동안은 깜빡이는 가는 선(예고), 그 뒤 굵은 광선. 닿으면 피해 (맞은 직후 무적 시간은 플레이어가 지킨다)
function lineHazard(e, seg, o) {
  const sc = e.scene, g = sc.add.graphics().setDepth(33).setBlendMode(ADDB), col = o.color, w = o.width ?? 12, delay = o.delay ?? 0;
  e.zone({ x: 0, y: 0, w: 0, h: 0, dmg: 0, life: delay + o.life, draw: 'none',
    onUpdate: (z, dt) => {
      const on = z.t >= delay, k = on ? Math.min(1, (z.t - delay) / o.life) : 0, s = seg(k, z.t);
      g.clear();
      if (!on) { g.lineStyle(1.5, col, (Math.floor(z.t * 14) % 2) ? .75 : .3); g.lineBetween(s.x1, s.y1, s.x2, s.y2); return; }
      const fade = Math.min(1, (o.life - (z.t - delay)) * 6);
      g.lineStyle(w + 10, col, .18 * fade); g.lineBetween(s.x1, s.y1, s.x2, s.y2);
      g.lineStyle(w, col, .6 * fade); g.lineBetween(s.x1, s.y1, s.x2, s.y2);
      g.lineStyle(Math.max(2, w * .3), 0xffffff, .9 * fade); g.lineBetween(s.x1, s.y1, s.x2, s.y2);
      const p = sc.player;
      if (live(e) && segDist(p.x, p.y, s) < w / 2 + 8) p.takeHit(o.dmg ?? e.dmg, o.type ?? e.types[0], s.x1, o.status || {});
      if (o.onTick) o.onTick(s, k, dt);
    },
    dispose: () => g.destroy() });
}
// 깜빡이는 예고선 (교차 돌진 경로 등)
function warnLine(e, x1, y1, x2, y2, life, col) {
  const sc = e.scene, g = sc.add.graphics().setDepth(32).setBlendMode(ADDB);
  e.zone({ x: 0, y: 0, w: 0, h: 0, dmg: 0, life, draw: 'none',
    onUpdate: z => { g.clear(); g.lineStyle(2, col, (Math.floor(z.t * 16) % 2) ? .85 : .3); g.lineBetween(x1, y1, x2, y2); },
    dispose: () => g.destroy() });
}
// 번개 한 줄기: 지그재그 빛줄기가 번쩍였다 사라진다
function boltFx(sc, x, y0, y1, col = 0xffee66) {
  const g = sc.add.graphics().setDepth(34).setBlendMode(ADDB), pts = [];
  for (let y = y0, xx = x; y < y1; y += 10) { pts.push({ x: xx, y }); xx = x + (Math.random() - .5) * 14; }
  pts.push({ x, y: y1 });
  g.lineStyle(7, col, .35); g.strokePoints(pts, false);
  g.lineStyle(3, col, .9); g.strokePoints(pts, false);
  g.lineStyle(1, 0xffffff, 1); g.strokePoints(pts, false);
  sc.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  sc.fx.burst(x, y1 - 2, [0xffffff, col, 0x6ad8ff], 12, 160, { up: 60, grav: 400, bounce: true, glow: true, life: .4 });
}
// 바닥에서 차례로 솟는 기둥 (앤테이 화염 분출 · 스이쿤 얼음 파도 · 그란돈 단애의칼): x0 에서 dir 쪽으로 n 개
function marchPillars(e, x0, dir, n, o) {
  const sc = e.scene, room = e.room, gap = o.gap ?? 34, step = o.step ?? .14, h = o.h ?? 64, w = o.w ?? 22;
  for (let k = 0; k < n; k++) {
    const x = x0 + dir * k * gap;
    if (x < room.left + 8 || x > room.right - 8) break;
    const gy = floorY(e, x), d = (o.delay ?? .5) + k * step;
    e.zone({ x: x - w / 2, y: gy - h, w, h, delay: d, life: d + (o.life ?? .45), dmg: o.dmg ?? e.dmg, type: o.type ?? e.types[0], draw: 'pillar', color: o.color, status: o.status });
    if (o.burst) sc.time.delayedCall(d * 1000, () => { if (live(e)) o.burst(x, gy); });
  }
}
// 낙뢰: 표시 → 하늘에서 번개가 내리꽂힌다
function thunderAt(e, xs, o = {}) {
  const sc = e.scene, room = e.room, col = o.color ?? 0xffee66;
  xs.forEach((x0, k) => {
    const x = Phaser.Math.Clamp(x0, room.left + 12, room.right - 12), gy = sc.groundBelow(x, room.top + 8), d = (o.delay ?? .7) + k * (o.step ?? .12);
    e.zone({ x: x - 10, y: room.top, w: 20, h: gy - room.top, delay: d, life: d + .3, dmg: e.dmg * (o.mul ?? 1.2), type: 'electric', draw: 'pillar', color: col });
    sc.time.delayedCall(d * 1000, () => { if (live(e)) { boltFx(sc, x, room.top, gy, col); Sfx.play('thunder'); } });
  });
}
// 지진: 아레나 바닥 전체가 흔들린다 (발판 위만 안전) — 경고 줄이 깜빡인 뒤
function quakeZone(e) {
  const sc = e.scene, room = e.room, W = room.right - room.left;
  e.zone({ x: room.left, y: room.bottom - 18, w: W, h: 18, delay: .55, life: 2, multi: true, dmg: e.dmg * .7, type: 'ground', draw: 'seed', color: 0xd8b080,
    onUpdate: z => { if (z.t > z.delay && Math.random() < .6) sc.fx.burst(room.left + Math.random() * W, room.bottom - 1, [0x5a4a38, 0x8a7a62], 1, 70, { angle: -Math.PI / 2, spread: 1, up: 60, grav: 600, life: .4 }); } });
  sc.time.delayedCall(550, () => { if (live(e)) { sc.fx.shake(.016, 1400); Sfx.play('thunder'); } });
  if (!e.quakeTold) { e.quakeTold = true; sc.events.emit('toast', '지진이다 — 발판 위로 피하자!'); }
}

// ---- 라이코 (방울탑 하층 수호자): 번개 기둥 · 전광석화 돌진(지나간 바닥에 전기 자국) · 방전 고리 ----
BOSS_AI.raikou = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xffe040;
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, Math.abs(p.x - e.x) > 220 ? 140 : ph2 ? 80 : 60, 110);
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['thunder', 'spark', 'discharge']);
      e.state = 'wind'; e.timer = (e.mode === 'spark' ? .45 : .6) * (ph2 ? .8 : 1); e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      sc.fx.glow(e.x, e.y, 30, col, e.timer * 1000, .8); Sfx.play('zap');
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (Math.random() < .5) sc.fx.burst(e.x + (Math.random() - .5) * b.width, e.y + (Math.random() - .5) * b.height, [0xffffff, col], 1, 60, { up: 0, grav: 0, bounce: false, glow: true, life: .15 });
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'thunder') {   // 번개 기둥: 플레이어 자리부터 양옆으로 번갈아
        const n = ph2 ? 6 : 4, xs = [p.x];
        for (let k = 1; xs.length < n; k++) { xs.push(p.x + k * 58); if (xs.length < n) xs.push(p.x - k * 58); }
        thunderAt(e, xs, { color: col });
        sc.fx.shake(.005, 300); e.state = 'fire'; e.timer = 1.2 + n * .12;
      } else if (e.mode === 'spark') {   // 전광석화: 아레나 끝까지 내달린다
        e.state = 'spark'; e.timer = .55; e.sparkX = e.x; e.facePlayer(p); sc.fx.sonicBoom(e.x, e.y, e.face, 1.6); Sfx.play('dash');
      } else {   // 방전: 사방으로 번개 탄 + 몸 둘레 전기장
        const n = ph2 ? 14 : 10;
        for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; e.shot({ x: e.x, y: e.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: 5, kind: 'bolt', type: 'electric', color: col, life: 1.6 }); }
        e.zone({ x: e.x - 42, y: e.y - 42, w: 84, h: 84, delay: .1, life: .55, dmg: e.dmg, type: 'electric', draw: 'burst', round: true, color: col });
        sc.fx.ring(e.x, e.y, 50, col, 300); Sfx.play('thunder'); e.state = 'fire'; e.timer = .9;
      }
      break;
    case 'spark': {
      e.timer -= dt; b.setVelocityX(e.face * (ph2 ? 520 : 440));
      if (e.timer % .04 < dt) sc.fx.ghost(e.sprite, col, .5, 200);
      if (Math.random() < .6) sc.fx.burst(e.x, e.bottom - 2, [0xffffff, col], 1, 80, { up: 30, grav: 300, glow: true, life: .25 });
      if (e.timer <= 0 || b.blocked.left || b.blocked.right) {
        const x0 = Math.min(e.sparkX, e.x), x1 = Math.max(e.sparkX, e.x);
        e.zone({ x: x0, y: e.bottom - 10, w: Math.max(20, x1 - x0), h: 10, delay: .05, life: ph2 ? 1.6 : 1.2, multi: true, dmg: e.dmg * .6, type: 'electric', draw: 'seed', color: col });   // 지나간 바닥에 전기 자국
        b.setVelocityX(0);
        if (ph2 && !e.back) { e.back = true; e.face *= -1; e.refacing(); e.timer = .5; e.sparkX = e.x; Sfx.play('dash'); }   // 2페이즈: 되돌아 한 번 더
        else { e.back = false; e.state = 'recover'; e.timer = .7; }
      }
      break;
    }
    case 'fire': case 'recover': recover(e, dt); break;
  }
};

// ---- 앤테이 (방울탑 중층 수호자): 화염 분출(바닥에서 불기둥이 차례로) · 화염방사(고개를 틀며 1초) · 분화 내려찍기(양옆으로 번지는 불길) ----
BOSS_AI.entei = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xff7a2a, room = e.room;
  const puff = (x, gy) => {
    for (let k = 0; k < 4; k++) sc.combat.pr.flamePuff(x + (Math.random() - .5) * 10, gy - 6, (Math.random() - .5) * 40, -160 - Math.random() * 80, .5, .6, 1.6);
    sc.fx.burst(x, gy - 4, [0xff6600, 0xffee55, 0xffaa22], 8, 120, { angle: -Math.PI / 2, spread: .8, up: 120, grav: 300, glow: true, life: .6 });
    Sfx.play('fire');
  };
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, Math.abs(p.x - e.x) > 240 ? 120 : ph2 ? 66 : 50, 100);
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['eruption', 'flame', 'stomp']);
      e.state = 'wind'; e.timer = (e.mode === 'flame' ? .55 : .6) * (ph2 ? .8 : 1); e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      sc.fx.glow(e.x, e.y, 34, col, e.timer * 1000, .8);
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (Math.random() < .5) sc.fx.embers(e.x + (Math.random() - .5) * b.width, e.bottom - 4, [0xff6600, 0xffee55], 1, { speed: 30 });
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'eruption') {   // 화염 분출: 앤테이 앞에서 플레이어 쪽으로 (2페이즈는 반대편 끝에서도 마주 온다)
        const dir = Math.sign(p.x - e.x) || e.face;
        marchPillars(e, e.x + dir * 40, dir, ph2 ? 9 : 7, { gap: 40, step: .16, h: 72, w: 26, color: col, type: 'fire', burst: puff });
        if (ph2) marchPillars(e, dir > 0 ? room.right - 30 : room.left + 30, -dir, 5, { gap: 40, step: .16, h: 72, w: 26, color: 0xff4a2a, type: 'fire', delay: .8, burst: puff });
        sc.fx.shake(.008, 400); Sfx.play('boom'); e.state = 'fire'; e.timer = 1.6;
      } else if (e.mode === 'flame') {
        e.state = 'breath'; e.timer = ph2 ? 1.3 : 1; e.shotT = 0; e.aim = Math.atan2(p.y - e.y, p.x - e.x);
      } else {
        b.setVelocity((p.x - e.x) * .8, -440); e.state = 'leap'; e.timer = 1.05; e.diving = false; Sfx.play('dash');
      }
      break;
    case 'breath': {   // 화염방사: 플레이어 쪽으로 천천히 고개를 튼다
      e.timer -= dt; e.shotT -= dt; b.setVelocityX(0);
      e.aim += Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(Math.atan2(p.y - e.y, p.x - e.x) - e.aim), -1.2 * dt, 1.2 * dt);
      if (e.shotT <= 0) {
        e.shotT = .06;
        const a = e.aim + (Math.random() - .5) * .18, sp = 240 + Math.random() * 40;
        e.shot({ x: e.x + Math.cos(a) * 18, y: e.y - 4 + Math.sin(a) * 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, kind: 'fire', type: 'fire', color: col, life: .9, muzzle: false });
        if (Math.random() < .3) Sfx.play('fire');
      }
      if (e.timer <= 0) { e.state = 'recover'; e.timer = .7; }
      break;
    }
    case 'leap':   // 분화 내려찍기: 착지하면 양옆으로 낮은 불길이 번진다
      e.timer -= dt;
      if (e.timer < .5 && !e.diving) { e.diving = true; b.setVelocity((p.x - e.x) * 1.6, 540); }
      if (e.diving && (b.blocked.down || e.timer <= 0)) {
        e.diving = false; slamWave(e, col, 'fire');
        const lick = (x, gy) => sc.fx.burst(x, gy - 4, [0xff6600, 0xffee55], 6, 90, { angle: -Math.PI / 2, spread: 1, up: 90, grav: 300, glow: true, life: .5 });
        for (const dir of [-1, 1]) marchPillars(e, e.x + dir * 30, dir, ph2 ? 7 : 5, { gap: 30, step: .09, h: 34, w: 24, color: 0xff9a3a, type: 'fire', delay: .05, life: .5, burst: lick });
        e.state = 'recover'; e.timer = .9;
      }
      break;
    case 'fire': case 'recover': recover(e, dt); break;
  }
};

// ---- 스이쿤 (방울탑 상층 수호자): 절대영도(양옆으로 얼음 기둥 파도 → 바닥이 얼어 느려짐) · 오로라빔 바닥 쓸기 · 싸라기눈 · 물 위를 미끄러지는 돌진 ----
BOSS_AI.suicune = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0x8ad8ff, ice = 0xbff0ff, room = e.room;
  const shards = (x, gy) => { sc.fx.burst(x, gy - 6, [0xffffff, ice, 0x8ad8ff], 10, 130, { angle: -Math.PI / 2, spread: 1.2, up: 120, grav: 500, bounce: true, life: .7 }); Sfx.play('crack'); };
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, Math.abs(p.x - e.x) > 240 ? 130 : ph2 ? 72 : 56, 120);
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['zero', 'aurora', 'hail', 'glide']);
      e.state = 'wind'; e.timer = (e.mode === 'zero' ? 1 : .55) * (ph2 ? .85 : 1); e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      if (e.mode === 'zero') { sc.fx.glow(e.x, e.y, 60, ice, e.timer * 1000, .8); Sfx.play('mega'); }
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (e.mode === 'zero') for (let k = 0; k < 2; k++) {   // 냉기가 빨려 든다
        const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 30;
        sc.fx.burst(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, [0xffffff, ice], 1, 160, { angle: a + Math.PI, spread: .05, up: 0, grav: 0, bounce: false, glow: true, life: .35, drag: 1 });
      }
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'zero') {   // 절대영도: 양옆으로 얼음 기둥 파도 → 지나간 바닥이 얼어붙는다
        const reps = ph2 ? 2 : 1;
        for (let r = 0; r < reps; r++) for (const dir of [-1, 1]) marchPillars(e, e.x + dir * 30, dir, 16, { gap: 30, step: .07, h: 58, w: 24, color: ice, type: 'ice', delay: .25 + r * .9, life: .55, burst: shards, status: { slow: 2 } });
        e.zone({ x: room.left, y: room.bottom - 8, w: room.right - room.left, h: 8, delay: .9, life: 4, multi: true, dmg: e.dmg * .3, type: 'ice', draw: 'seed', color: ice, status: { slow: 1.5 } });   // 얼어붙은 바닥
        sc.cameras.main.flash(200, 200, 240, 255, true); sc.fx.shake(.012, 500); Sfx.play('boom');
        if (!e.zeroTold) { e.zeroTold = true; sc.events.emit('toast', '절대영도 — 얼음 파도는 뛰어넘고, 언 바닥은 발판으로 피하자'); }
        e.state = 'fire'; e.timer = ph2 ? 2.2 : 1.6;
      } else if (e.mode === 'aurora') {   // 오로라빔: 머리에서 뻗어 발밑 바닥부터 아레나 끝까지 쓸어 간다
        const dir = Math.sign(p.x - e.x) || e.face, ox = e.x + dir * 12, oy = e.y - 8, near = e.x + dir * 30, far = dir > 0 ? room.right - 10 : room.left + 10;
        lineHazard(e, k => { const tx = near + (far - near) * k; return { x1: ox, y1: oy, x2: tx, y2: floorY(e, tx) }; },
          { delay: .5, life: 1.2, width: 10, color: 0xb0f0ff, type: 'ice', dmg: e.dmg * 1.1, status: { slow: 1.5 },
            onTick: s => { if (Math.random() < .5) sc.fx.burst(s.x2, s.y2 - 2, [0xffffff, 0xb0f0ff, 0xffb0e0, 0xb0ffc0], 2, 90, { up: 60, grav: 300, glow: true, life: .4 }); } });
        Sfx.play('beam'); e.state = 'fire'; e.timer = 1.9;
      } else if (e.mode === 'hail') {   // 싸라기눈: 천장에서 얼음 조각
        const n = ph2 ? 9 : 6, xs = [];
        for (let k = 0; k < n; k++) xs.push(p.x + (k - (n - 1) / 2) * 38 + (Math.random() - .5) * 14);
        rockfall(e, Phaser.Utils.Array.Shuffle(xs), { kind: 'other', color: ice, r: 5, warn: 0x9ad8ff, step: .07 });
        e.state = 'fire'; e.timer = 1.2;
      } else {
        e.state = 'glide'; e.timer = .7; e.sparkX = e.x; e.facePlayer(p); Sfx.play('water');
      }
      break;
    case 'glide': {   // 물 위를 미끄러지는 돌진: 지나간 자리에 물보라 (밟으면 느려진다)
      e.timer -= dt; b.setVelocityX(e.face * (ph2 ? 420 : 360));
      if (e.timer % .05 < dt) sc.fx.ghost(e.sprite, col, .4, 220);
      if (Math.random() < .7) sc.fx.burst(e.x - e.face * 10, e.bottom - 2, [0xffffff, 0x8ad8ff, 0x3ab0ff], 1, 70, { angle: -Math.PI / 2 - e.face * .6, spread: .6, up: 50, grav: 500, life: .4 });
      if (e.timer <= 0 || b.blocked.left || b.blocked.right) {
        const x0 = Math.min(e.sparkX, e.x), x1 = Math.max(e.sparkX, e.x);
        e.zone({ x: x0, y: e.bottom - 8, w: Math.max(20, x1 - x0), h: 8, delay: .05, life: 2, multi: true, dmg: e.dmg * .3, type: 'water', draw: 'seed', color: 0x8ad8ff, status: { slow: 1.2 } });
        b.setVelocityX(0); e.state = 'recover'; e.timer = .7;
      }
      break;
    }
    case 'fire': case 'recover': recover(e, dt); break;
  }
};

// ---- 칠색조 (성도 최종 보스 · 검은 재로 물든) ----
//  성스러운불꽃 폭격: 아레나 위를 가로지르며 검붉은 불꽃탄을 떨어뜨려 바닥에 불길 장판 · 폭풍 날개짓: 세찬 바람으로 밀어내며 불꽃 깃털 부채
//  불꽃 깃털 연사 · 체력 30%에서 한 번: 불사조 부활(불꽃에 휩싸여 체력 60%로 되살아남) → 화면 전체 불꽃 탄막
const HOOH_DARK = 0xd02a3a;
function startRebirth(e) {
  const sc = e.scene;
  e.state = 'rebirth'; e.timer = 2.2; e.intangible = true; e.telegraph(false);
  sc.fx.glow(e.x, e.y, 90, 0xff8a3a, 2200, .9);
  sc.fx.ring(e.x, e.y, 70, 0xffd04a, 600); Sfx.play('mega');
  sc.events.emit('toast', '칠색조가 불꽃에 휩싸인다…');
}
// 부활 직후: 천장 전체에서 불꽃비(빈틈 두 곳) + 몸에서 사방으로 불꽃 고리 두 번
function inferno(e) {
  const sc = e.scene, room = e.room, W = room.right - room.left, n = Math.floor(W / 34), gaps = [Math.floor(Math.random() * n), Math.floor(Math.random() * n)];
  for (let k = 0; k < n; k++) {
    if (gaps.some(g => Math.abs(g - k) <= 1)) continue;   // 빈틈 (세 칸씩)
    rockfall(e, [room.left + (k + .5) * (W / n)], { kind: 'fire', color: HOOH_DARK, r: 7, warn: 0xff6a3a, delay: .6 + (k % 3) * .25 });
  }
  for (let r = 0; r < 2; r++) sc.time.delayedCall(400 + r * 700, () => {
    if (!live(e)) return;
    const m = 16;
    for (let k = 0; k < m; k++) { const a = k / m * Math.PI * 2 + r * .2; e.shot({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 6, kind: 'fire', type: 'fire', color: 0xff4a2a, life: 3 }); }
    sc.fx.ring(e.x, e.y, 60, 0xff8a3a, 400); Sfx.play('fire');
  });
}
BOSS_AI.hooh = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xff4a2a, room = e.room;
  if (!e.reborn && e.hp < e.maxhp * .3) { e.reborn = true; startRebirth(e); }
  switch (e.state) {
    case 'idle': {
      e.facePlayer(p);
      const tx = p.x - Math.sign(p.x - e.x || 1) * 120, ty = p.y - 70 + Math.sin(e.t * 1.8) * 14, far = Math.abs(p.x - e.x) > 240 ? 200 : 110;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.6, -far, far), Phaser.Math.Clamp((ty - e.y) * 1.6, -120, 120));
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['sacred', 'gust', 'feathers']);
      if (e.mode === 'sacred') { e.runDir = p.x > room.cx ? -1 : 1; e.state = 'toEdge'; e.timer = 1.4; e.telegraph(true); }   // 플레이어 반대편 끝에서 출발해 플레이어 위를 지나간다
      else { e.state = 'wind'; e.timer = ph2 ? .45 : .6; e.telegraph(true); b.setVelocity(0, 0); sc.fx.glow(e.x, e.y, 40, col, e.timer * 1000, .8); }
      break;
    }
    case 'toEdge': {
      e.timer -= dt;
      const tx = e.runDir > 0 ? room.left + 40 : room.right - 40, ty = room.top + 40, d = Math.hypot(tx - e.x, ty - e.y);
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 3, -380, 380), Phaser.Math.Clamp((ty - e.y) * 3, -380, 380));
      if (d < 16 || e.timer <= 0) { e.state = 'bombRun'; e.shotT = 0; e.face = e.runDir; e.refacing(); e.telegraph(false); Sfx.play('fire'); }
      break;
    }
    case 'bombRun': {   // 성스러운불꽃: 가로지르며 검붉은 불꽃탄 → 떨어진 자리에 불길
      b.setVelocity(e.runDir * (ph2 ? 300 : 250), 0);
      e.shotT -= dt;
      if (e.shotT <= 0) {
        e.shotT = ph2 ? .1 : .14;
        e.shot({ x: e.x, y: e.y + 10, vx: e.runDir * 40, vy: 60, grav: 520, r: 7, kind: 'fire', type: 'fire', color: HOOH_DARK, life: 3, muzzle: false,
          onExpire: q => { if (!live(e)) return; const gy = sc.groundBelow(q.x, q.y - 12); e.zone({ x: q.x - 18, y: gy - 14, w: 36, h: 14, delay: 0, life: ph2 ? 3 : 2.4, multi: true, dmg: e.dmg * .5, type: 'fire', draw: 'fire', color: HOOH_DARK }); } });
      }
      if (Math.random() < .5) sc.fx.embers(e.x, e.y, [col, 0xffd04a, HOOH_DARK], 1, { speed: 40 });
      if ((e.runDir > 0 && e.x >= room.right - 50) || (e.runDir < 0 && e.x <= room.left + 50)) { b.setVelocity(0, 0); e.state = 'recover'; e.timer = .8; }
      break;
    }
    case 'wind':
      e.timer -= dt; b.setVelocity(b.velocity.x * .85, b.velocity.y * .85);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'gust') {   // 폭풍 날개짓: 플레이어를 밀어내는 바람 + 불꽃 깃털 부채
        const dir = Math.sign(p.x - e.x) || e.face;
        sc.player.wind(dir * (ph2 ? 230 : 190), 1.4);
        e.zone({ x: 0, y: 0, w: 0, h: 0, dmg: 0, life: 1.4, draw: 'none', onUpdate: () => {   // 화면을 가로지르는 바람 줄기
          const v = sc.cameras.main.worldView;
          for (let k = 0; k < 2; k++) sc.fx.burst(dir > 0 ? v.x + Math.random() * 40 : v.right - Math.random() * 40, v.y + Math.random() * v.height, [0xffffff, 0xffd8b0], 1, 420, { angle: dir > 0 ? 0 : Math.PI, spread: .08, up: 0, grav: 0, bounce: false, life: .5, drag: 1 });
        } });
        const n = ph2 ? 7 : 5, base = Math.atan2(p.y - e.y, p.x - e.x);
        for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * .2; e.shot({ x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, r: 4, kind: 'leaf', type: 'flying', color: 0xffb04a, life: 1.8 }); }
        sc.fx.shake(.01, 500); Sfx.play('swing'); e.state = 'fire'; e.timer = 1.4;
        if (!e.gustTold) { e.gustTold = true; sc.events.emit('toast', '폭풍 날개짓 — 바람을 거슬러 버티자'); }
      } else {   // 불꽃 깃털 연사 (조금 따라온다)
        const n = ph2 ? 3 : 2;
        for (let r = 0; r < n; r++) sc.time.delayedCall(r * 260, () => {
          if (!live(e)) return;
          const base = Math.atan2(p.y - e.y, p.x - e.x);
          for (const da of [-.25, 0, .25]) e.shot({ x: e.x, y: e.y, vx: Math.cos(base + da) * 200, vy: Math.sin(base + da) * 200, r: 6, kind: 'fire', type: 'fire', color: col, life: 2.2, homing: .5 });
          Sfx.play('fire');
        });
        e.state = 'fire'; e.timer = .5 + n * .26;
      }
      break;
    case 'rebirth': {   // 불사조 부활: 불꽃에 휩싸여 떠올라 체력이 차오른다
      e.timer -= dt;
      b.setVelocity((room.cx - e.x) * 2, (room.top + 70 - e.y) * 2);
      e.sprite.setAlpha(.4 + Math.abs(Math.sin(e.t * 18)) * .6);
      for (let k = 0; k < 3; k++) sc.combat.pr.flamePuff(e.x + (Math.random() - .5) * 40, e.y + 20, (Math.random() - .5) * 30, -90 - Math.random() * 60, .6, .8, 2.2);
      e.hp = Math.min(e.maxhp * .6, e.hp + e.maxhp * .3 * dt / 2.2);
      if (e.timer <= 0) {
        e.hp = Math.max(e.hp, e.maxhp * .6); e.sprite.setAlpha(1); e.intangible = false;
        sc.cameras.main.flash(400, 255, 200, 140, true); sc.fx.shake(.02, 600); Sfx.play('boom');
        sc.events.emit('banner', '칠색조가 되살아났다!', '성스러운 불꽃이 하늘을 뒤덮는다');
        inferno(e);
        e.state = 'fire'; e.timer = 3;
      }
      break;
    }
    case 'fire': case 'recover':
      e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9);
      if (e.timer <= 0) { e.state = 'idle'; e.cd = (ph2 ? .55 : 1) + Math.random() * .4; }
      break;
  }
};

// ---- 전룡 (인주시티 불탄탑 아래 히든 · 빛을 잃은 등대지기) ----
//  등대 광선: 꼬리 구슬 빛이 플레이어 쪽 바닥에서 시작해 머리 위를 넘어 반대쪽 바닥까지 휩쓴다 (바닥을 스칠 때 뛰어넘는다 · 2페이즈는 반대쪽에서 하나 더)
//  전기자석파: 느린 전기 구슬 고리 (닿으면 느려짐) · 전자포: 커다란 구슬이 천천히 따라오다 터진다 · 낙뢰
BOSS_AI.ampharos = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xfff27a;
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, Math.abs(p.x - e.x) > 240 ? 100 : 44, 120);
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['lighthouse', 'wave', 'zap', 'thunder']);
      e.state = 'wind'; e.timer = (e.mode === 'lighthouse' ? .8 : .55) * (ph2 ? .85 : 1); e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      sc.fx.glow(e.x, e.top + 6, 40, col, e.timer * 1000, .9); Sfx.play('zap');
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'lighthouse') {
        const ox = e.x, oy = e.top + 8, L = 1100;
        const sweep = (from, to) => lineHazard(e, k => { const a = from + (to - from) * k; return { x1: ox, y1: oy, x2: ox + Math.cos(a) * L, y2: oy + Math.sin(a) * L }; },
          { delay: .6, life: 2.2, width: 14, color: col, type: 'electric', dmg: e.dmg * 1.2 });
        const fromL = [Math.PI - .15, Math.PI * 2 + .15], fromR = [.15, -Math.PI - .15], first = p.x < e.x ? fromL : fromR, second = first === fromL ? fromR : fromL;
        sweep(first[0], first[1]);
        if (ph2) sweep(second[0], second[1]);
        sc.fx.glow(ox, oy, 26, col, 2800, 1);
        Sfx.play('beam'); e.state = 'fire'; e.timer = 3;
        if (!e.lightTold) { e.lightTold = true; sc.events.emit('toast', '등대 광선 — 바닥을 스칠 때 뛰어넘자'); }
      } else if (e.mode === 'wave') {   // 전기자석파
        const n = ph2 ? 12 : 9;
        for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; e.shot({ x: e.x, y: e.y - 6, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, r: 5, kind: 'bubble', type: 'electric', color: col, life: 3, status: { slow: 2 } }); }
        Sfx.play('zap'); e.state = 'fire'; e.timer = .9;
      } else if (e.mode === 'zap') {   // 전자포
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.shot({ x: e.x + e.face * 16, y: e.top + 8, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, r: 11, kind: 'bolt', type: 'electric', color: col, life: 2.6, homing: 1.6, boom: { r: 46 }, light: true });
        Sfx.play('thunder'); e.state = 'fire'; e.timer = 1;
      } else {
        const xs = [p.x - 50, p.x, p.x + 50];
        if (ph2) xs.push(p.x - 100, p.x + 100);
        thunderAt(e, xs, { color: col, delay: .6, step: .1, mul: 1 });
        e.state = 'fire'; e.timer = 1.3;
      }
      break;
    case 'fire': case 'recover': recover(e, dt); break;
  }
};

// ---- 라티아스 & 라티오스 (루네시티 · 동시 보스) ----
//  둘이 플레이어 양옆 하늘을 맴돌며 협공. 라티아스(lead)가 합동 공격을 고른다:
//   X자 교차 돌진: 둘이 화면 위 양쪽 끝으로 → 플레이어를 지나는 예고선 → 대각선으로 엇갈려 돌진
//   미스트볼 & 러스트퍼지 교차 폭격: 라티아스는 느린 분홍 구슬 3개(터진 자리에 안개 — 느려짐), 라티오스는 빠른 푸른 광탄(크게 터짐)을 양쪽에서 동시에
//  쉬는 동안 라티오스는 용의숨결. 한 마리가 먼저 정화되면 남은 한 마리가 유대의 힘으로 각성 — 빨라지고 혼자 3연속 돌진·두 구슬을 다 쓴다
function latiBreath(e, p) {
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  for (const da of [-.15, 0, .15]) e.shot({ x: e.x, y: e.y, vx: Math.cos(a + da) * 220, vy: Math.sin(a + da) * 220, r: 5, kind: 'fire', type: 'dragon', color: e.def.color, life: 1.6 });
  Sfx.play('fire');
}
function latiOrb(e, p, which) {
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  if (which === 'mist') {   // 미스트볼
    for (const da of [-.3, 0, .3]) e.shot({ x: e.x, y: e.y, vx: Math.cos(a + da) * 130, vy: Math.sin(a + da) * 130, r: 8, kind: 'bubble', type: 'psychic', color: LATI_PINK, life: 2.4, homing: .6,
      onExpire: q => { if (live(e)) e.zone({ x: q.x - 26, y: q.y - 18, w: 52, h: 36, delay: 0, life: 2.2, multi: true, dmg: e.dmg * .3, type: 'psychic', draw: 'cloud', color: 0xffb0d0, status: { slow: 1.5 } }); } });
    Sfx.play('wave');
  } else {   // 러스트퍼지
    e.shot({ x: e.x, y: e.y, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, r: 10, kind: 'bubble', type: 'psychic', color: LATI_BLUE, life: 2.2, boom: { r: 40 }, light: true });
    Sfx.play('beam');
  }
}
// 돌진 예고: 지금 자리에서 플레이어를 지나 화면 너머까지
function latiAim(e, p, wait) {
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  e.ja = a; e.state = 'jetAim'; e.timer = wait;
  warnLine(e, e.x, e.y, e.x + Math.cos(a) * 900, e.y + Math.sin(a) * 900, wait, e.def.color);
  e.telegraph(true);
}
function latiStart(e, mode, p, side) {
  const sc = e.scene, room = e.room;
  e.mode = mode;
  if (mode === 'xjet') {   // 화면 위 양쪽 끝 (side: -1 왼쪽 · 1 오른쪽)
    const v = sc.cameras.main.worldView;
    e.jx = Phaser.Math.Clamp(p.x + side * Math.min(220, v.width * .42), room.left + 30, room.right - 30);
    e.jy = Math.max(room.top + 24, p.y - 130);
    e.jets = e.awake ? 3 : 1;
    e.state = 'jetSetup'; e.timer = 1.1;
  } else if (mode === 'cross') {
    e.state = 'orb'; e.timer = e.awake ? .45 : .7; e.telegraph(true);
    sc.fx.glow(e.x, e.y, 34, e.def.color, e.timer * 1000, .8); Sfx.play('mega');
  } else { latiBreath(e, p); e.state = 'fire'; e.timer = .6; }
}
BOSS_AI.lati = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, room = e.room, col = e.def.color, mate = e.partner && e.partner.alive ? e.partner : null, fast = e.awake ? 1.4 : 1;
  switch (e.state) {
    case 'idle': {
      e.facePlayer(p);
      const side = mate ? (e.lead ? -1 : 1) : -(Math.sign(p.x - e.x) || 1);   // 둘이면 라티아스 왼쪽 · 라티오스 오른쪽
      const tx = p.x + side * 120, ty = p.y - (e.lead ? 60 : 90) + Math.sin(e.t * 2.6 + (e.lead ? 0 : 2)) * 16;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.8, -200 * fast, 200 * fast), Phaser.Math.Clamp((ty - e.y) * 1.8, -150, 150));
      e.cd -= dt; e.cd2 = (e.cd2 ?? 1.5) - dt;
      if (mate && !e.lead) { if (e.cd2 <= 0) { e.cd2 = 2 + Math.random(); latiBreath(e, p); } break; }   // 합동 공격은 라티아스가 부른다
      if (e.cd > 0 || (mate && mate.state !== 'idle')) break;   // 짝이 바쁘면 기다린다
      const mode = e.choose(mate ? ['xjet', 'cross', 'xjet'] : ['xjet', 'cross', 'breath']);
      if (mate) { latiStart(e, mode, p, -1); latiStart(mate, mode, p, 1); }
      else latiStart(e, mode, p, Math.sign(e.x - p.x) || 1);
      break;
    }
    case 'jetSetup': {   // 화면 위 끝자리로
      e.timer -= dt;
      b.setVelocity(Phaser.Math.Clamp((e.jx - e.x) * 4, -420 * fast, 420 * fast), Phaser.Math.Clamp((e.jy - e.y) * 4, -420, 420));
      if (Math.hypot(e.jx - e.x, e.jy - e.y) < 14 || e.timer <= 0) { b.setVelocity(0, 0); latiAim(e, p, e.awake ? .35 : .55); }
      break;
    }
    case 'jetAim':
      e.timer -= dt; b.setVelocity(0, 0);
      if (e.timer <= 0) {
        e.telegraph(false); e.state = 'jet'; e.timer = .9;
        const sp = (ph2 ? 560 : 500) * (e.awake ? 1.15 : 1);
        b.setVelocity(Math.cos(e.ja) * sp, Math.sin(e.ja) * sp);
        sc.fx.sonicBoom(e.x, e.y, Math.sign(Math.cos(e.ja)) || 1, 1.6); Sfx.play('dash');
      }
      break;
    case 'jet': {   // 교차 돌진 (유성처럼 꼬리를 끈다) — 아레나 가장자리에 닿으면 멈춘다
      e.timer -= dt;
      if (e.timer % .03 < dt) sc.fx.ghost(e.sprite, col, .55, 260);
      sc.fx.burst(e.x, e.y, [col, 0xffffff], 1, 30, { up: 0, grav: 0, bounce: false, glow: true, life: .3 });
      const edge = e.x <= room.left + 24 || e.x >= room.right - 24 || e.y <= room.top + 18 || e.y >= room.bottom - 14;
      if (e.timer <= 0 || (edge && e.timer < .8)) {
        b.setVelocity(0, 0);
        e.jets = (e.jets || 1) - 1;
        if (e.jets > 0) latiAim(e, p, .3);   // 각성: 3연속
        else { e.state = 'recover'; e.timer = .7; }
      }
      break;
    }
    case 'orb':   // 교차 폭격 (빛을 모았다가)
      e.timer -= dt; b.setVelocity(0, 0);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (mate) latiOrb(e, p, e.lead ? 'mist' : 'luster');
      else { latiOrb(e, p, 'mist'); latiOrb(e, p, 'luster'); }   // 혼자면 둘 다
      e.state = 'fire'; e.timer = .9;
      break;
    case 'fire': case 'recover':
      e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9);
      if (e.timer <= 0) { e.state = 'idle'; e.cd = ((ph2 ? .6 : 1.1) + Math.random() * .4) / fast; }
      break;
  }
};

// ---- 레쿠쟈 (호연 최종 보스 · 심연의 천공룡) ----
//  용의 몸체 돌진: 플레이어 반대편 끝으로 물러났다가 예고 띠 → 아레나를 가로질러 돌진, 긴 몸이 물결치며 뒤따른다 (몸에 닿아도 피해 · 2페이즈는 되돌아 한 번 더)
//  화룡점정: 하늘 높이 사라졌다가 플레이어 자리에 예고 기둥 → 초고속 급강하 + 거대한 충격파
//  파괴광선 지면 쓸기: 기를 모았다가 발밑 바닥부터 아레나 끝까지 쓸어 간다 (2페이즈는 되돌아온다) · 용의파동
// 레쿠쟈의 긴 몸: 머리가 지나간 자리(0.55초)를 따라 비늘 마디가 이어지고, 몸에 닿아도 피해
function serpentBody(e) {
  const sc = e.scene, g = sc.add.graphics().setDepth(18), keep = .55;
  e.bodyOn = true;
  e.zone({ x: 0, y: 0, w: 0, h: 0, dmg: 0, life: 4, draw: 'none',
    onUpdate: () => {
      const path = e.path, now = e.t;
      while (path.length && now - path[0].t > keep) path.shift();
      g.clear();
      for (let i = 0; i < path.length; i += 2) {
        const q = path[i], k = (now - q.t) / keep, r = 13 * (1 - k * .55);
        g.fillStyle(0x0a2a18, .9); g.fillCircle(q.x, q.y, r + 1.5);
        g.fillStyle(i % 8 < 4 ? 0x2a8a4a : 0x1f6a3a, 1); g.fillCircle(q.x, q.y, r);
        if (i % 8 === 0) { g.fillStyle(0xffd84a, 1); g.fillCircle(q.x, q.y - r * .5, Math.max(1.5, r * .22)); }   // 노란 고리 무늬
      }
      const p = sc.player;
      if (live(e) && path.some(q => Math.hypot(p.x - q.x, p.y - q.y) < 14)) p.takeHit(e.dmg, 'dragon', p.x - (e.sdir || 1) * 10, {});
    },
    dispose: () => { g.destroy(); e.bodyOn = false; } });
}
BOSS_AI.rayquaza = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0x4aff8a, room = e.room;
  switch (e.state) {
    case 'idle': {
      e.facePlayer(p);
      const tx = p.x - Math.sign(p.x - e.x || 1) * 130, ty = p.y - 80 + Math.sin(e.t * 2) * 18, far = Math.abs(p.x - e.x) > 240 ? 220 : 120;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.6, -far, far), Phaser.Math.Clamp((ty - e.y) * 1.6, -130, 130));
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['serpent', 'ascent', 'hyper', 'pulse']);
      if (e.mode === 'serpent') { e.sdir = p.x > room.cx ? 1 : -1; e.state = 'toSide'; e.timer = 1.2; e.telegraph(true); }
      else if (e.mode === 'ascent') { e.state = 'ascend'; e.timer = .8; Sfx.play('dash'); }
      else if (e.mode === 'hyper') { e.sdir = p.x > room.cx ? 1 : -1; e.state = 'toPerch'; e.timer = 1.1; e.telegraph(true); }
      else { e.state = 'wind'; e.timer = .5; e.telegraph(true); b.setVelocity(0, 0); sc.fx.glow(e.x, e.y, 34, col, 500, .9); }   // 용의파동
      break;
    }
    case 'toPerch': {   // 파괴광선 준비: 플레이어 반대편 위 구석으로
      e.timer -= dt;
      const tx = e.sdir > 0 ? room.left + 60 : room.right - 60, ty = room.top + 50;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 4, -460, 460), Phaser.Math.Clamp((ty - e.y) * 4, -460, 460));
      if (Math.hypot(tx - e.x, ty - e.y) < 14 || e.timer <= 0) {
        b.setVelocity(0, 0); e.face = e.sdir; e.refacing();
        e.state = 'wind'; e.timer = ph2 ? .7 : .9;
        sc.fx.glow(e.x, e.y, 60, col, e.timer * 1000, .9); Sfx.play('mega');
      }
      break;
    }
    case 'toSide': {   // 몸체 돌진 준비: 플레이어 반대편 끝, 플레이어 높이로
      e.timer -= dt;
      const tx = e.sdir > 0 ? room.left + 30 : room.right - 30, ty = Phaser.Math.Clamp(p.y - 6, room.top + 24, room.bottom - 20);
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 4, -480, 480), Phaser.Math.Clamp((ty - e.y) * 4, -480, 480));
      if (Math.hypot(tx - e.x, ty - e.y) < 14 || e.timer <= 0) {
        b.setVelocity(0, 0); e.state = 'serpentAim'; e.timer = ph2 ? .5 : .65; e.face = e.sdir; e.refacing();
        e.zone({ x: room.left, y: e.y - 18, w: room.right - room.left, h: 36, delay: e.timer, life: e.timer + .01, dmg: 0, color: col });   // 예고 띠
        Sfx.play('boss');
      }
      break;
    }
    case 'serpentAim':
      e.timer -= dt; b.setVelocity(0, 0);
      if (e.timer <= 0) {
        e.telegraph(false); e.state = 'serpent';
        e.path = e.path || [];
        if (!e.bodyOn) serpentBody(e);
        sc.fx.sonicBoom(e.x, e.y, e.sdir, 2.2); Sfx.play('dash');
      }
      break;
    case 'serpent': {   // 머리는 곧게, 몸은 물결치며 뒤따른다
      b.setVelocity(e.sdir * (ph2 ? 700 : 620), Math.sin(e.t * 9) * 90);
      e.path.push({ x: e.x, y: e.y, t: e.t });
      if (Math.random() < .4) sc.fx.burst(e.x, e.y, [col, 0xffd84a, 0xffffff], 1, 40, { up: 0, grav: 0, bounce: false, glow: true, life: .3 });
      if ((e.sdir > 0 && e.x >= room.right - 30) || (e.sdir < 0 && e.x <= room.left + 30)) {
        if (ph2 && !e.back) {   // 2페이즈: 되돌아 한 번 더
          e.back = true; e.sdir *= -1; e.face = e.sdir; e.refacing(); e.state = 'serpentAim'; e.timer = .4;
          e.zone({ x: room.left, y: e.y - 18, w: room.right - room.left, h: 36, delay: .4, life: .41, dmg: 0, color: col });
        } else { e.back = false; b.setVelocity(0, 0); e.state = 'recover'; e.timer = .9; }
      }
      break;
    }
    case 'ascend':   // 화룡점정: 하늘 높이 날아올라 사라진다
      e.timer -= dt; b.setVelocity(0, -420);
      e.sprite.setAlpha(Math.max(0, e.timer / .8));
      if (e.timer <= 0) {
        e.intangible = true; e.sprite.setAlpha(0); e.glowImg.setAlpha(0);
        e.diveX = Phaser.Math.Clamp(p.x, room.left + 30, room.right - 30);
        const gy = floorY(e, e.diveX), w = ph2 ? .7 : .9;
        e.zone({ x: e.diveX - 26, y: room.top, w: 52, h: gy - room.top, delay: w, life: w + .25, dmg: e.dmg * 1.5, type: 'dragon', draw: 'pillar', color: col });
        e.state = 'diveWait'; e.timer = w; Sfx.play('boss');
      }
      break;
    case 'diveWait':
      e.timer -= dt;
      if (e.timer <= 0) {
        b.reset(e.diveX, room.top + 20); e.sprite.setAlpha(1); e.glowImg.setAlpha(.35); e.intangible = false;
        b.setVelocity(0, 950); e.state = 'skydive'; e.timer = .8;
      }
      break;
    case 'skydive':   // 초고속 급강하 → 거대한 충격파
      e.timer -= dt;
      if (e.timer % .03 < dt) sc.fx.ghost(e.sprite, col, .6, 240);
      if (e.y >= room.bottom - 30 || e.timer <= 0 || b.blocked.down) {
        b.setVelocity(0, -200);
        const gy = floorY(e, e.x);
        sc.fx.shake(.025, 600); Sfx.play('boom'); sc.cameras.main.flash(200, 200, 255, 220, true);
        sc.fx.ring(e.x, gy - 4, 120, col, 500); sc.fx.ring(e.x, gy - 4, 70, 0xffffff, 300);
        for (const s of [-1, 1]) for (let k = 0; k < 2; k++) e.shot({ x: e.x + s * 20, y: gy - 8, vx: s * (260 + k * 90), vy: 0, r: 8, kind: 'wave', type: 'dragon', color: col, life: 1.4 });
        sc.fx.burst(e.x, gy - 2, [0x8a7a62, 0x4a4036, col, 0xffffff], 40, 260, { angle: -Math.PI / 2, spread: 1.4, up: 200, grav: 700, bounce: true, size: 2 });
        e.state = 'recover'; e.timer = 1;
      }
      break;
    case 'wind':
      e.timer -= dt; b.setVelocity(b.velocity.x * .85, b.velocity.y * .85);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'hyper') {   // 파괴광선: 발밑 가까운 바닥에서 아레나 끝까지 쓸어 간다
        const dir = e.sdir || Math.sign(p.x - e.x) || e.face, far = dir > 0 ? room.right - 8 : room.left + 8, near = e.x + dir * 20;
        const sweep = (from, to, delay) => lineHazard(e, k => { const tx = from + (to - from) * k; return { x1: e.x + dir * 14, y1: e.y, x2: tx, y2: floorY(e, tx) }; },
          { delay, life: 1.3, width: 16, color: 0xc8ffd8, type: 'normal', dmg: e.dmg * 1.3,
            onTick: s => { if (Math.random() < .7) sc.fx.burst(s.x2, s.y2 - 2, [0xffffff, col, 0xffe08a], 3, 140, { angle: -Math.PI / 2, spread: 1.2, up: 120, grav: 500, glow: true, life: .5 }); if (Math.random() < .1) sc.fx.shake(.006, 80); } });
        sweep(near, far, .45);
        if (ph2) sweep(far, near, .45 + 1.3);
        b.setVelocity(0, 0); Sfx.play('beam'); e.state = 'beaming'; e.timer = ph2 ? 3.2 : 1.9;
      } else {   // 용의파동
        const n = ph2 ? 5 : 3, base = Math.atan2(p.y - e.y, p.x - e.x);
        for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * .22; e.shot({ x: e.x, y: e.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 7, kind: 'wave', type: 'dragon', color: col, life: 2 }); }
        Sfx.play('wave'); e.state = 'fire'; e.timer = .8;
      }
      break;
    case 'beaming': e.timer -= dt; b.setVelocity(0, 0); if (e.timer <= 0) { e.state = 'recover'; e.timer = .6; } break;
    case 'fire': case 'recover':
      e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9);
      if (e.timer <= 0) { e.state = 'idle'; e.cd = (ph2 ? .55 : 1) + Math.random() * .4; }
      break;
  }
};

// ---- 그란돈 (굴뚝산 마그마 심층 히든) ----
//  단애의칼: 그란돈 앞에서 플레이어 쪽으로 바위 칼날이 차례로 솟는다 (2페이즈는 뒤로도) · 분화: 천장에서 용암 바위가 쏟아져 떨어진 자리에 용암 웅덩이
//  지진: 바닥 전체 (발판 위만 안전) · 대문자: 커다란 불덩이가 터진다
BOSS_AI.groudon = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xff6a2a;
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, Math.abs(p.x - e.x) > 240 ? 100 : ph2 ? 52 : 40, 90);
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['precipice', 'eruption', 'quake', 'blast']);
      e.state = 'wind'; e.timer = (e.mode === 'quake' ? .9 : .6) * (ph2 ? .85 : 1); e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      sc.fx.glow(e.x, e.y, 40, col, e.timer * 1000, .8);
      if (e.mode === 'quake') { sc.fx.shake(.006, e.timer * 1000); Sfx.play('boss'); }
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (Math.random() < .4) sc.fx.embers(e.x + (Math.random() - .5) * b.width, e.y, [0xff6600, 0xffd04a], 1, { speed: 30 });
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'precipice') {   // 단애의칼
        const dir = Math.sign(p.x - e.x) || e.face;
        const blade = (x, gy) => { eruptRocks(e, x, gy, 2, { kind: 'rock', color: 0x8a4a2a, r: 4 }); sc.fx.burst(x, gy - 4, [0xff6a2a, 0xffd04a, 0x5a2a1a], 8, 120, { angle: -Math.PI / 2, spread: .8, up: 120, grav: 500, glow: true, life: .5 }); sc.fx.shake(.004, 60); };
        marchPillars(e, e.x + dir * 36, dir, ph2 ? 10 : 8, { gap: 36, step: .12, h: 86, w: 28, color: 0xff5a2a, type: 'ground', burst: blade });
        if (ph2) marchPillars(e, e.x - dir * 36, -dir, 6, { gap: 36, step: .12, h: 86, w: 28, color: 0xff5a2a, type: 'ground', delay: .7, burst: blade });
        Sfx.play('boom'); e.state = 'fire'; e.timer = 1.8;
      } else if (e.mode === 'eruption') {   // 분화: 등에서 용암이 솟구쳐 천장에서 쏟아진다
        sc.fx.burst(e.x, e.top, [0xff6a2a, 0xffd04a, 0xff3a1a], 30, 260, { angle: -Math.PI / 2, spread: .7, up: 200, grav: 400, glow: true, life: .8 }); Sfx.play('boom');
        const n = ph2 ? 8 : 6, xs = [];
        for (let k = 0; k < n; k++) xs.push(p.x + (k - (n - 1) / 2) * 52 + (Math.random() - .5) * 20);
        rockfall(e, Phaser.Utils.Array.Shuffle(xs), { kind: 'fire', color: 0xff5a1a, r: 9, warn: 0xff8a3a, delay: .7, step: .12,
          onLand: (x, gy) => e.zone({ x: x - 20, y: gy - 12, w: 40, h: 12, delay: 0, life: 2.6, multi: true, dmg: e.dmg * .45, type: 'fire', draw: 'fire', color: 0xff5a1a }) });
        e.state = 'fire'; e.timer = 1.6;
      } else if (e.mode === 'quake') {
        quakeZone(e); e.state = 'fire'; e.timer = 2;
      } else {   // 대문자
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.shot({ x: e.x + e.face * 20, y: e.y - 8, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 12, kind: 'fire', type: 'fire', color: col, life: 2.4, boom: { r: 56 }, light: true });
        Sfx.play('fire'); e.state = 'fire'; e.timer = 1;
      }
      break;
    case 'fire': case 'recover': recover(e, dt); break;
  }
};

// ================= 신오 · 하나 전용 패턴 =================
// 보스가 치워질 때 함께 치울 그림 (분신 · 그림자 웅덩이 · 결정 등)
const own = (e, o) => { (e.fxObjs || (e.fxObjs = [])).push(o); return o; };
// 바닥에서 바위 칼날 (스톤엣지): 플레이어 자리부터 양옆으로
function stoneEdge(e, p, n) {
  const sc = e.scene, xs = [p.x];
  for (let k = 1; xs.length < n; k++) { xs.push(p.x + k * 54); if (xs.length < n) xs.push(p.x - k * 54); }
  xs.forEach((x, k) => marchPillars(e, x, 1, 1, { delay: .55 + k * .12, h: 64, w: 24, color: 0xc0a070, type: 'rock', life: .4, burst: (bx, gy) => { eruptRocks(e, bx, gy, 2, { r: 4 }); sc.fx.shake(.004, 60); } }));
  Sfx.play('crack');
}

// ---- 한카리아스 (신오 챔피언로드 · 조종당하는 난천의) ----
//  드래곤다이브: 낮게 깔려 쇄도 (2페이즈는 되돌아 한 번 더) · 드래곤크루: 바짝 다가가 두 번 할퀴기 · 스톤엣지
//  뒤 단상의 난천이 5~7초마다 손짓 — 한카리아스 강화(빨라지고 붉은 잔상) · 드래곤크루 충격파(아레나 양끝에서 바닥을 타고 온다) · 지진 · 스톤엣지
//  체력 50%: 난천이 키스톤을 들어 메가진화
const CYNTHIA_ORDERS = { buff: '한카리아스, 더 빠르게.', wave: '드래곤크루.', quake: '지진.', edge: '스톤엣지.' };
function cynthiaOrder(e, p) {
  const sc = e.scene, tr = sc.trainer, room = e.room;
  if (!tr || tr.freed) return;
  const list = Object.keys(CYNTHIA_ORDERS).filter(o => o !== e.lastOrder), o = list[Math.floor(Math.random() * list.length)];
  e.lastOrder = o;
  tr.gesture(o === 'buff' ? 0xff3a5a : 0x6a8aff); tr.say(CYNTHIA_ORDERS[o]);
  if (o === 'buff') { e.buffT = 5; sc.fx.ring(e.x, e.y, 50, 0xff3a5a, 400); Sfx.play('mega'); }
  else if (o === 'wave') {
    for (const s of [-1, 1]) { const x = s < 0 ? room.left + 16 : room.right - 16; e.shot({ x, y: floorY(e, x) - 10, vx: -s * 260, vy: 0, r: 9, kind: 'wave', type: 'dragon', color: 0x6a8aff, life: 4, ghost: true }); }
    Sfx.play('wave');
  } else if (o === 'quake') quakeZone(e);
  else stoneEdge(e, p, 3);
}
BOSS_AI.garchomp = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0x6a8aff, buff = (e.buffT = (e.buffT || 0) - dt) > 0, sp = buff ? 1.35 : 1;
  e.orderT = (e.orderT ?? 3.5) - dt;
  if (e.orderT <= 0) { e.orderT = (ph2 ? 4.5 : 6) + Math.random() * 1.5; cynthiaOrder(e, p); }
  if (buff && Math.random() < .3) sc.fx.ghost(e.sprite, 0xff3a5a, .3, 160);
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, (Math.abs(p.x - e.x) > 240 ? 130 : ph2 ? 80 : 64) * sp, 70);
      e.cd -= dt * sp;
      if (e.cd > 0) break;
      e.mode = e.choose(['rush', 'claw', 'edge']);
      e.state = 'wind'; e.timer = .45 / sp; e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'rush') { e.state = 'dash'; e.timer = .6; e.facePlayer(p); sc.fx.sonicBoom(e.x, e.y, e.face, 1.8); Sfx.play('dash'); }
      else if (e.mode === 'claw') { e.state = 'clawIn'; e.timer = .5; e.swipes = 2; }
      else { stoneEdge(e, p, ph2 ? 5 : 3); e.state = 'fire'; e.timer = .9; }
      break;
    case 'dash':   // 드래곤다이브
      e.timer -= dt; b.setVelocityX(e.face * (ph2 ? 470 : 400) * sp);
      if (e.timer % .04 < dt) sc.fx.ghost(e.sprite, col, .45, 220);
      if (e.timer <= 0 || b.blocked.left || b.blocked.right) {
        if (b.blocked.left || b.blocked.right) { sc.fx.shake(.01, 200); Sfx.play('boom'); }
        b.setVelocityX(0);
        if (ph2 && !e.back) { e.back = true; e.face *= -1; e.refacing(); e.timer = .5; }
        else { e.back = false; e.state = 'recover'; e.timer = .6; }
      }
      break;
    case 'clawIn': {   // 드래곤크루: 바짝 다가가 할퀸다
      e.timer -= dt; e.facePlayer(p);
      const near = Math.abs(p.x - e.x) < 44;
      b.setVelocityX(near ? 0 : e.face * 300 * sp);
      if (e.timer > 0 && !near) break;
      b.setVelocityX(0);
      const box = { x: e.face > 0 ? e.x : e.x - 64, y: e.y - 30, w: 64, h: 52 };
      sc.fx.slash(e.x + e.face * 28, e.y - 4, 34, e.face, col, { thick: 10, flipV: e.swipes === 1 });
      if (overlap(box, p.bounds())) p.takeHit(e.dmg * 1.1, 'dragon', e.x, {});
      Sfx.play('swing');
      e.swipes--;
      if (e.swipes > 0) { e.state = 'clawGap'; e.timer = .2; } else { e.state = 'recover'; e.timer = .55; }
      break;
    }
    case 'clawGap': e.timer -= dt; b.setVelocityX(0); if (e.timer <= 0) { e.state = 'clawIn'; e.timer = .3; } break;
    case 'fire': case 'recover': recover(e, dt); break;
  }
};

// ---- 디아루가 (창기둥 1페이즈 · 시간의 신) ----
//  시간의포효: 포효와 함께 시곗바늘이 멈춘 듯한 장판이 플레이어 주변에 깔린다 (안에서는 몸이 무거워진다) · 러스터캐논: 가슴에서 강철 레이저 세 줄기 (조금씩 늦게, 그 순간의 플레이어를 노린다)
//  용성군: 천장에서 쇳빛 유성이 떨어져 터진다 · 아이언헤드 돌진. 정화되는 순간 공간이 유리처럼 깨지며 펄기아가 강림한다 (GameScene 이어 싸우기)
function timeField(e, x, y, r, life) {
  const sc = e.scene, g = sc.add.graphics().setDepth(9.5);
  e.zone({ x: x - r, y: y - r, w: r * 2, h: r * 2, delay: .4, life, multi: true, dmg: e.dmg * .25, type: 'steel', draw: 'none', status: { slow: 1.2 },
    onUpdate: z => {
      const on = z.t >= z.delay, a = on ? Math.min(1, (life - z.t) * 3) : z.t / z.delay;
      g.clear();
      g.fillStyle(0x6ab0ff, .14 * a); g.fillCircle(x, y, r);
      g.lineStyle(1.5, 0xb0d8ff, .7 * a); g.strokeCircle(x, y, r);
      for (let k = 0; k < 12; k++) { const t = k / 12 * Math.PI * 2; g.lineBetween(x + Math.cos(t) * r * .82, y + Math.sin(t) * r * .82, x + Math.cos(t) * r * .95, y + Math.sin(t) * r * .95); }
      const hand = on ? (z.t - z.delay) * .4 : 0;   // 바늘이 아주 느리게 돈다
      g.lineStyle(2, 0xe0f0ff, .8 * a); g.lineBetween(x, y, x + Math.cos(hand - Math.PI / 2) * r * .7, y + Math.sin(hand - Math.PI / 2) * r * .7);
      g.lineStyle(1, 0xe0f0ff, .6 * a); g.lineBetween(x, y, x + Math.cos(hand * 12 - Math.PI / 2) * r * .5, y + Math.sin(hand * 12 - Math.PI / 2) * r * .5);
    },
    dispose: () => g.destroy() });
}
BOSS_AI.dialga = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0x6ab0ff, room = e.room;
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, Math.abs(p.x - e.x) > 240 ? 100 : ph2 ? 52 : 40, 120);
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['roar', 'cannon', 'meteor', 'iron']);
      e.state = 'wind'; e.timer = (e.mode === 'roar' ? .8 : .55) * (ph2 ? .85 : 1); e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      sc.fx.glow(e.x, e.y - 10, 44, col, e.timer * 1000, .9);
      if (e.mode === 'roar') Sfx.play('boss');
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'roar') {   // 시간의포효
        sc.fx.shake(.016, 600); sc.fx.ring(e.x, e.y, 120, col, 600); sc.fx.ring(e.x, e.y, 70, 0xffffff, 400); sc.cameras.main.flash(200, 160, 200, 255, true);
        timeField(e, p.x, p.y, 46, 4);
        for (let k = 1; k < (ph2 ? 4 : 3); k++) timeField(e, Phaser.Math.Clamp(p.x + (k % 2 ? 1 : -1) * (90 + k * 30), room.left + 50, room.right - 50), p.y - 10 + (Math.random() - .5) * 40, 40, 4);
        if (!e.roarTold) { e.roarTold = true; sc.events.emit('toast', '시간의포효 — 시계 장판 안에서는 몸이 무거워진다'); }
        e.state = 'fire'; e.timer = 1.2;
      } else if (e.mode === 'cannon') {   // 러스터캐논
        const n = ph2 ? 4 : 3;
        for (let k = 0; k < n; k++) sc.time.delayedCall(k * 380, () => {
          if (!live(e)) return;
          const ox = e.x + e.face * 16, oy = e.y - 6, a = Math.atan2(p.y - oy, p.x - ox);
          lineHazard(e, () => ({ x1: ox, y1: oy, x2: ox + Math.cos(a) * 1100, y2: oy + Math.sin(a) * 1100 }), { delay: .45, life: .35, width: 12, color: 0xb0d8ff, type: 'steel', dmg: e.dmg * 1.2 });
          Sfx.play('beam');
        });
        e.state = 'fire'; e.timer = .9 + n * .38;
      } else if (e.mode === 'meteor') {   // 용성군
        const m = ph2 ? 7 : 5, xs = [];
        for (let k = 0; k < m; k++) xs.push(p.x + (k - (m - 1) / 2) * 60 + (Math.random() - .5) * 20);
        rockfall(e, Phaser.Utils.Array.Shuffle(xs), { kind: 'steel', color: 0x9ab8ff, r: 9, warn: 0x8ab0ff, step: .14,
          onLand: (x, gy) => { e.zone({ x: x - 26, y: gy - 30, w: 52, h: 30, delay: 0, life: .25, dmg: e.dmg, type: 'dragon', draw: 'burst', round: true, color: 0x8ab0ff }); sc.fx.ring(x, gy - 10, 30, 0x8ab0ff, 260); } });
        Sfx.play('boss'); e.state = 'fire'; e.timer = 1.6;
      } else { e.state = 'dash'; e.timer = .6; e.facePlayer(p); sc.fx.sonicBoom(e.x, e.y, e.face, 1.8); Sfx.play('dash'); }
      break;
    case 'dash':   // 아이언헤드
      e.timer -= dt; b.setVelocityX(e.face * (ph2 ? 380 : 320));
      if (e.timer % .05 < dt) sc.fx.ghost(e.sprite, col, .4, 200);
      if (e.timer <= 0 || b.blocked.left || b.blocked.right) { if (b.blocked.left || b.blocked.right) { sc.fx.shake(.012, 240); Sfx.play('boom'); } b.setVelocityX(0); e.state = 'recover'; e.timer = .8; }
      break;
    case 'fire': case 'recover': recover(e, dt); break;
  }
};

// ---- 펄기아 (창기둥 2페이즈 · 공간의 신) ----
//  공간절단: 아레나 곳곳에 보랏빛 공간 베기 금이 그어지고(예고) 잠시 뒤 금을 따라 터진다 · 워프 돌진: 사라졌다 아레나 끝에서 나타나 가로질러 돌진 (2페이즈는 두 번)
//  하이드로펌프: 플레이어 높이로 쏘는 물줄기
function spaceCut(e, x, y, a, len, delay) {
  const sc = e.scene, dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
  lineHazard(e, () => ({ x1: x - dx, y1: y - dy, x2: x + dx, y2: y + dy }), { delay, life: .3, width: 16, color: 0xd88aff, type: 'dragon', dmg: e.dmg * 1.2 });
  sc.time.delayedCall(delay * 1000, () => { if (!live(e)) return; sc.fx.burst(x, y, [0xd88aff, 0xffffff, 0x8a4aff], 14, 160, { glow: true, up: 20, life: .45 }); Sfx.play('shatter'); });
}
function palkiaWarp(e) {
  const sc = e.scene, col = e.def.color || 0xd88aff;
  sc.fx.ghost(e.sprite, col, .6, 300); sc.fx.ring(e.x, e.y, 34, col, 260);
  e.sprite.setAlpha(.08); e.intangible = true; e.b.setVelocityX(0);
  e.state = 'warpOut'; e.timer = .45; Sfx.play('ghost');
}
BOSS_AI.palkia = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xd88aff, room = e.room;
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, Math.abs(p.x - e.x) > 240 ? 110 : ph2 ? 60 : 46, 110);
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['rend', 'warp', 'hydro', 'rend']);
      e.state = 'wind'; e.timer = ph2 ? .45 : .6; e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      sc.fx.glow(e.x, e.y, 40, col, e.timer * 1000, .9);
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'rend') {   // 공간절단: 첫 금은 플레이어 자리에
        const n = ph2 ? 6 : 4;
        for (let k = 0; k < n; k++) {
          const x = k ? Phaser.Math.Clamp(p.x + (Math.random() - .5) * 360, room.left + 30, room.right - 30) : p.x;
          const y = k ? Phaser.Math.Clamp(p.y + (Math.random() - .5) * 140, room.top + 20, room.bottom - 10) : p.y;
          spaceCut(e, x, y, (Math.random() < .5 ? -1 : 1) * (.5 + Math.random() * .6), 150 + Math.random() * 80, .8 + k * .15);
        }
        Sfx.play('swing'); e.state = 'fire'; e.timer = 1.3 + n * .15;
      } else if (e.mode === 'warp') { e.warps = ph2 ? 2 : 1; palkiaWarp(e); }
      else {   // 하이드로펌프
        const ox = e.x + e.face * 16, oy = e.y - 6, ty = p.y, far = e.face > 0 ? room.right : room.left;
        lineHazard(e, () => ({ x1: ox, y1: oy, x2: far, y2: ty }), { delay: .55, life: 1.1, width: 16, color: 0x8ad8ff, type: 'water', dmg: e.dmg * 1.1,
          onTick: s => { if (Math.random() < .5) sc.fx.burst(s.x1 + (s.x2 - s.x1) * Math.random(), s.y1 + (s.y2 - s.y1) * Math.random(), [0xffffff, 0x8ad8ff, 0x3ab0ff], 1, 60, { up: 20, grav: 300, life: .4 }); } });
        Sfx.play('water'); e.state = 'fire'; e.timer = 1.6;
      }
      break;
    case 'warpOut':   // 아레나 끝에 나타나 예고 띠
      e.timer -= dt;
      if (e.timer <= 0) {
        const fromLeft = p.x > room.cx, x = fromLeft ? room.left + 40 : room.right - 40, gy = floorY(e, x);
        b.reset(x, gy - b.height / 2 - 1); e.sprite.setAlpha(1); e.intangible = false; e.face = fromLeft ? 1 : -1; e.refacing();
        sc.fx.ring(e.x, e.y, 40, col, 300); Sfx.play('wave');
        e.zone({ x: room.left, y: gy - b.height - 6, w: room.right - room.left, h: b.height + 6, delay: .45, life: .46, dmg: 0, color: col });
        e.state = 'warpAim'; e.timer = .45;
      }
      break;
    case 'warpAim': e.timer -= dt; b.setVelocityX(0); if (e.timer <= 0) { e.state = 'dash'; e.timer = 1.8; Sfx.play('dash'); sc.fx.sonicBoom(e.x, e.y, e.face, 2); } break;
    case 'dash':   // 워프 돌진: 아레나 반대편 끝까지
      b.setVelocityX(e.face * (ph2 ? 600 : 520)); e.timer -= dt;
      if (e.timer % .04 < dt) sc.fx.ghost(e.sprite, col, .5, 240);
      if ((e.face > 0 && e.x >= room.right - 40) || (e.face < 0 && e.x <= room.left + 40) || e.timer <= 0) {
        b.setVelocityX(0);
        e.warps = (e.warps || 1) - 1;
        if (e.warps > 0) palkiaWarp(e); else { e.state = 'recover'; e.timer = .8; }
      }
      break;
    case 'fire': case 'recover': recover(e, dt); break;
  }
};

// ---- 다크라이 (만월섬 히든 · 악몽의) ----
//  다크홀: 아레나에 어둠이 내려앉고 커다란 검은 구멍 셋이 천천히 따라온다 (닿으면 잠에 빠지듯 느려짐)
//  그림자 분신: 셋(2페이즈 넷)으로 갈라져 함께 섀도볼을 쏜다 — 진짜는 하나 (분신은 투명하게 깜빡인다)
//  악몽: 플레이어를 둘러싼 그림자 손톱이 잠시 뒤 한꺼번에 조여 온다 · 악의파동: 사방으로
function darkness(e, life) {   // 배경과 지형만 어둡게 (포켓몬·탄은 그 위로 보인다)
  const sc = e.scene, cam = sc.cameras.main, r = sc.add.rectangle(0, 0, 10, 10, 0x05020a, 0).setOrigin(0).setDepth(17);
  e.zone({ x: 0, y: 0, w: 0, h: 0, dmg: 0, life, draw: 'none',
    onUpdate: z => { const v = cam.worldView; r.setPosition(v.x - 20, v.y - 20).setSize(v.width + 40, v.height + 40).setFillStyle(0x05020a, .6 * Math.min(1, z.t * 2, (life - z.t) * 2)); },
    dispose: () => r.destroy() });
}
function clearDecoys(e) {
  for (const d of e.decoys || []) if (d.active) { e.scene.fx.burst(d.x, d.y - 20, [0x12061c, 0x6a2a9a], 12, 70, { up: 10, grav: -30, bounce: false, life: .5 }); d.destroy(); }
  e.decoys = [];
}
function darkClones(e, p) {
  const sc = e.scene, n = e.phase === 2 ? 3 : 2, spots = [];
  for (let k = 0; k <= n; k++) spots.push(blinkSpot(e, p, 120, 200, k === 0));
  const real = Math.floor(Math.random() * spots.length), s0 = e.sprite, dy = s0.y - e.y;
  clearDecoys(e);
  e.decoys = spots.filter((s, i) => i !== real).map(s => {
    const im = own(e, sc.add.sprite(s.x, s.y + dy, s0.texture.key, s0.frame.name).setOrigin(s0.originX, s0.originY).setScale(s0.scaleX, s0.scaleY).setDepth(18.9).setAlpha(.75).setFlipX(s0.flipX).setTint(0xb090d0));
    if (s0.anims.currentAnim) im.play(s0.anims.currentAnim.key);
    sc.tweens.add({ targets: im, alpha: { from: .75, to: .4 }, duration: 160, yoyo: true, repeat: -1 });
    sc.fx.ring(s.x, s.y, 26, 0x8a3aff, 240);
    return im;
  });
  appear(e, p, spots[real]);
  for (let r = 0; r < 3; r++) sc.time.delayedCall(350 + r * 420, () => {   // 모두 함께 섀도볼
    if (!live(e)) return;
    for (const src of [{ x: e.x, y: e.y }, ...(e.decoys || []).filter(d => d.active).map(d => ({ x: d.x, y: d.y - dy }))]) {
      const a = Math.atan2(p.y - src.y, p.x - src.x);
      e.shot({ x: src.x, y: src.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, r: 6, kind: 'shadow', type: 'dark', color: 0x6a2a9a, life: 2.6, ghost: true });
    }
    Sfx.play('ghost');
  });
  sc.time.delayedCall(2300, () => clearDecoys(e));
}
BOSS_AI.darkrai = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0x6a2a9a;
  switch (e.state) {
    case 'idle': {
      e.facePlayer(p);
      const tx = p.x - Math.sign(p.x - e.x || 1) * 120, ty = p.y - 50 + Math.sin(e.t * 2) * 14, far = Math.abs(p.x - e.x) > 240 ? 200 : 100;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.6, -far, far), Phaser.Math.Clamp((ty - e.y) * 1.6, -110, 110));
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['void', 'clones', 'nightmare', 'pulse']);
      e.state = 'wind'; e.timer = ph2 ? .45 : .6; e.telegraph(true); b.setVelocity(0, 0);
      sc.fx.glow(e.x, e.y, 36, col, e.timer * 1000, .9); Sfx.play('ghost');
      break;
    }
    case 'wind':
      e.timer -= dt; b.setVelocity(b.velocity.x * .85, b.velocity.y * .85);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'void') {   // 다크홀
        darkness(e, 4.5);
        const n = ph2 ? 4 : 3;
        for (let k = 0; k < n; k++) { const a = Math.atan2(p.y - e.y, p.x - e.x) + (k - (n - 1) / 2) * .6; e.shot({ x: e.x, y: e.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, r: 12, kind: 'shadow', type: 'dark', color: 0x1a0a2a, life: 4.2, homing: 3.6, ghost: true, status: { slow: 2.5 } }); }
        if (!e.voidTold) { e.voidTold = true; sc.events.emit('toast', '다크홀 — 검은 구멍에 닿으면 잠에 빠진 듯 몸이 무거워진다'); }
        e.state = 'fire'; e.timer = 1.2;
      } else if (e.mode === 'clones') { darkClones(e, p); e.state = 'fire'; e.timer = 1.9; }
      else if (e.mode === 'nightmare') {   // 악몽: 둘러싼 손톱이 조여 온다
        const n = ph2 ? 10 : 8, R = 110, cx = p.x, cy = p.y;
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2;
          e.shot({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, vx: 0, vy: 0, r: 6, kind: 'wave', type: 'dark', color: 0x8a3aff, life: 2.4, ghost: true, muzzle: false,
            update: q => { if (q.t < .8) { q.vx = 0; q.vy = 0; return; } if (!q.go) { q.go = true; const a2 = Math.atan2(cy - q.y, cx - q.x); q.vx = Math.cos(a2) * 230; q.vy = Math.sin(a2) * 230; } } });
        }
        Sfx.play('ghost'); e.state = 'fire'; e.timer = 1.1;
      } else {   // 악의파동
        const n = ph2 ? 16 : 12;
        for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; e.shot({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 6, kind: 'wave', type: 'dark', color: col, life: 2.2 }); }
        sc.fx.ring(e.x, e.y, 60, col, 360); Sfx.play('wave'); e.state = 'fire'; e.timer = .8;
      }
      break;
    case 'fire': case 'recover':
      e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9);
      if (e.timer <= 0) { e.state = 'idle'; e.cd = (ph2 ? .55 : 1) + Math.random() * .4; }
      break;
  }
};

// ---- 기라티나 → 오리진폼 (깨어진 세계 히든) ----
//  섀도다이브: 그림자 속으로 완전히 사라져 바닥의 검은 웅덩이로 따라오다가, 플레이어 등 뒤에서 솟아 덮친다 (오리진폼은 두 번)
//  뒤틀린 중력: 플레이어가 천장으로 떨어진다 — 그동안 바닥에서 그림자 손톱이 솟고, 중력이 돌아오는 순간 천장에서 파편이 쏟아진다
//  섀도크루: 붉은 초승달 탄 부채 · 용의숨결
BOSS_AI.giratina = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xff3a5a, room = e.room;
  switch (e.state) {
    case 'idle': {
      e.facePlayer(p);
      const tx = p.x - Math.sign(p.x - e.x || 1) * 120, ty = p.y - 60 + Math.sin(e.t * 1.7) * 14, far = Math.abs(p.x - e.x) > 240 ? 200 : 110;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.6, -far, far), Phaser.Math.Clamp((ty - e.y) * 1.6, -120, 120));
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['dive', 'gravity', 'claws', 'collapse', 'dive']);
      e.state = 'wind'; e.timer = ph2 ? .45 : .6; e.telegraph(true); b.setVelocity(0, 0);
      sc.fx.glow(e.x, e.y, 40, col, e.timer * 1000, .9);
      if (e.mode === 'dive') e.dives = ph2 ? 2 : 1;
      break;
    }
    case 'wind':
      e.timer -= dt; b.setVelocity(b.velocity.x * .85, b.velocity.y * .85);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'dive') giraSink(e);
      else if (e.mode === 'gravity') {   // 뒤틀린 중력
        const T = ph2 ? 4.5 : 3.8;
        sc.player.gravFlip(T);
        sc.cameras.main.flash(260, 200, 120, 220, true); sc.fx.shake(.012, 400); Sfx.play('ghost');
        if (!e.gravTold) { e.gravTold = true; sc.events.emit('toast', '중력이 뒤틀린다 — 천장에 붙어 바닥의 손톱을 피하고, 돌아올 때 떨어지는 파편을 조심!'); }
        marchPillars(e, room.left + 24, 1, 40, { gap: 32, step: .05, h: 70, w: 22, color: 0x8a1a3a, type: 'ghost', delay: 1.1, life: .7 });   // 바닥 전체 그림자 손톱
        sc.time.delayedCall(T * 1000 - 300, () => {   // 중력이 돌아올 때 천장 파편
          if (!live(e)) return;
          const xs = []; for (let k = 0; k < 7; k++) xs.push(p.x + (k - 3) * 56 + (Math.random() - .5) * 16);
          rockfall(e, xs, { kind: 'other', color: 0xff6a8a, r: 6, warn: 0xff3a5a, delay: .2, step: .06 });
        });
        e.state = 'fire'; e.timer = 1.6;
      } else if (e.mode === 'collapse') {   // 섀도다이브 · 차원 붕괴: 앞 공간을 균열 3줄기로 할퀴고, 바닥을 따라 그림자 가시 5(2페이즈 7)개가 플레이어 쪽으로 솟는다
        const dir = Math.sign(p.x - e.x) || 1, n = ph2 ? 7 : 5;
        for (let k = 0; k < 3; k++) sc.time.delayedCall(k * 60, () => { if (!live(e)) return; const cx = e.x + dir * 40, cy = e.y + (k - 1) * 16; bolt(sc, cx - dir * 30, cy - 34, cx + dir * 30, cy + 34, k % 2 ? 0x9a3aff : 0xff1a4a, 5, 380); });
        sc.fx.glow(e.x + dir * 40, e.y, 50, 0xff1a4a, 400, 1); sc.fx.shake(.01, 240); Sfx.play('ghost');
        marchPillars(e, e.x + dir * 40, dir, n, { gap: 40, step: .1, h: 78, w: 22, color: 0x8a1a3a, type: 'ghost', delay: .45, life: .5, status: { slow: 1 },
          burst: (x, gy) => { bolt(sc, x + (Math.random() - .5) * 20, gy - 130, x, gy - 50, 0x9a3aff, 2, 220); sc.fx.burst(x, gy - 4, [0x12020a, 0xff1a4a, 0x9a3aff], 10, 100, { angle: -Math.PI / 2, spread: .8, up: 110, life: .45, glow: true }); sc.fx.shake(.005, 100); Sfx.play('crack'); } });
        e.state = 'fire'; e.timer = 1.2;
      } else {   // 섀도크루
        const n = ph2 ? 7 : 5, base = Math.atan2(p.y - e.y, p.x - e.x);
        for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * .2; e.shot({ x: e.x, y: e.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 7, kind: 'wave', type: 'ghost', color: col, life: 2 }); }
        Sfx.play('swing'); e.state = 'fire'; e.timer = .8;
      }
      break;
    case 'sink': {   // 그림자 웅덩이로 따라온다
      e.timer -= dt;
      const gy = floorY(e, e.x);
      e.puddleX += Phaser.Math.Clamp(p.x - e.puddleX, -260 * dt, 260 * dt);
      b.reset(e.puddleX, gy - 30); b.setVelocity(0, 0);
      const g = e.puddle; g.clear();
      g.fillStyle(0x12020a, .85); g.fillEllipse(e.puddleX, gy - 1, 56, 10);
      g.fillStyle(0x6a0a2a, .6); g.fillEllipse(e.puddleX, gy - 1, 34, 6);
      if (Math.random() < .5) sc.fx.burst(e.puddleX + (Math.random() - .5) * 40, gy - 2, [0x12061c, 0x6a0a2a, col], 1, 30, { angle: -Math.PI / 2, spread: .6, up: 30, grav: -20, bounce: false, life: .5, size: 2 });
      if (e.timer <= 0) {   // 플레이어 등 뒤 자리에 붉은 금
        const bx = Phaser.Math.Clamp(p.x - (p.face || 1) * 70, room.left + 30, room.right - 30), by = Phaser.Math.Clamp(p.y - 10, room.top + 24, room.bottom - 20);
        e.riseAt = { x: bx, y: by };
        sc.fx.glow(bx, by, 30, col, 320, .9); sc.fx.ring(bx, by, 24, col, 320);
        g.clear(); e.state = 'rise'; e.timer = .32; Sfx.play('ghost');
      }
      break;
    }
    case 'rise':   // 등 뒤에서 솟아 덮친다
      e.timer -= dt;
      if (e.timer <= 0) {
        appear(e, p, e.riseAt);
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        b.setVelocity(Math.cos(a) * 460, Math.sin(a) * 460);
        e.state = 'lunge'; e.timer = .45; sc.fx.sonicBoom(e.x, e.y, Math.sign(Math.cos(a)) || 1, 1.8);
      }
      break;
    case 'lunge':
      e.timer -= dt;
      if (e.timer % .04 < dt) sc.fx.ghost(e.sprite, col, .5, 240);
      if (e.timer <= 0) {
        b.setVelocity(0, 0);
        e.dives = (e.dives || 1) - 1;
        if (e.dives > 0) giraSink(e); else { e.state = 'recover'; e.timer = .7; }
      }
      break;
    case 'fire': case 'recover':
      e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9);
      if (e.timer <= 0) { e.state = 'idle'; e.cd = (ph2 ? .55 : 1) + Math.random() * .4; }
      break;
  }
};
function giraSink(e) {
  const sc = e.scene;
  sc.fx.burst(e.x, e.y, [0x12061c, 0x6a0a2a, 0xff3a5a], 18, 90, { up: 10, grav: -30, bounce: false, life: .6, size: 2 });
  sc.tweens.add({ targets: e.sprite, alpha: 0, duration: 260 });
  e.glowImg.setAlpha(0); e.intangible = true;
  e.puddle = e.puddle && e.puddle.active ? e.puddle : own(e, sc.add.graphics().setDepth(11));
  e.puddleX = e.x;
  e.state = 'sink'; e.timer = e.phase === 2 ? 1 : 1.3;
  Sfx.play('ghost');
}

// ---- 제크로무 (용나선탑 수문장) & 레시라무 환영 ----
//  뇌격: 번개를 두르고 아레나 끝까지 돌진 — 지나간 자리에 낙뢰가 뒤따른다 · 크로스썬더: 솟아올라 번개 구체가 되어 플레이어 자리로 내리꽂힌다
//  레시라무 환영: 반대편에 하얀 환영이 나타나 푸른 불꽃을 가로로 내뿜는다 (2페이즈는 제크로무의 낙뢰와 동시에) · 번개
function reshiramPhantom(e, p) {
  const sc = e.scene, room = e.room, s0 = e.sprite, side = p.x > e.x ? 1 : -1, x = side > 0 ? room.right - 50 : room.left + 50, y = Phaser.Math.Clamp(p.y - 20, room.top + 30, room.bottom - 30);
  const ghost = own(e, sc.add.sprite(x, y + 20, s0.texture.key, s0.frame.name).setOrigin(s0.originX, s0.originY).setScale(s0.scaleX, s0.scaleY).setDepth(18.8).setFlipX(side < 0).setTintFill(0xf0f8ff).setAlpha(0));
  if (s0.anims.currentAnim) ghost.play(s0.anims.currentAnim.key);
  sc.tweens.add({ targets: ghost, alpha: .55, duration: 300 });
  sc.fx.glow(x, y, 50, 0x8ad8ff, 1200, .8);
  const ty = p.y, far = side > 0 ? room.left : room.right;
  lineHazard(e, () => ({ x1: x - side * 20, y1: y, x2: far, y2: ty }), { delay: .8, life: 1, width: 22, color: 0x7ad0ff, type: 'fire', dmg: e.dmg * 1.2,
    onTick: s => { if (Math.random() < .6) sc.combat.pr.flamePuff(s.x1 + (s.x2 - s.x1) * Math.random(), s.y1 + (s.y2 - s.y1) * Math.random(), -side * 80, (Math.random() - .5) * 30, .4, .6, 1.4, true); } });
  sc.time.delayedCall(2000, () => { if (ghost.active) sc.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => ghost.destroy() }); });
  Sfx.play('fire');
}
BOSS_AI.zekrom = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0x4a8aff, room = e.room;
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, Math.abs(p.x - e.x) > 240 ? 110 : ph2 ? 60 : 46, 100);
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['bolt', 'fusion', 'reshiram', 'thunder']);
      e.state = 'wind'; e.timer = (e.mode === 'bolt' ? .7 : .55) * (ph2 ? .85 : 1); e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      sc.fx.glow(e.x, e.y, 40, col, e.timer * 1000, .9); Sfx.play('zap');
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (Math.random() < .5) sc.fx.burst(e.x + (Math.random() - .5) * b.width, e.y + (Math.random() - .5) * b.height, [0xffffff, 0x8ab0ff], 1, 70, { up: 0, grav: 0, bounce: false, glow: true, life: .15 });
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'bolt') { e.state = 'boltRun'; e.timer = 1.6; e.lastStrike = e.x; e.facePlayer(p); sc.fx.sonicBoom(e.x, e.y, e.face, 2); Sfx.play('thunder'); }
      else if (e.mode === 'fusion') { b.setAllowGravity(false); b.setVelocity(0, -380); e.state = 'fbRise'; e.timer = .55; Sfx.play('dash'); }
      else if (e.mode === 'reshiram') {
        reshiramPhantom(e, p);
        if (ph2) thunderAt(e, [p.x - 60, p.x + 60], { color: 0x8ab0ff, delay: 1.1 });
        e.state = 'fire'; e.timer = 1.9;
      } else { thunderAt(e, [p.x, p.x - 70, p.x + 70, ...(ph2 ? [p.x - 140, p.x + 140] : [])], { color: 0x8ab0ff }); e.state = 'fire'; e.timer = 1.4; }
      break;
    case 'boltRun':   // 뇌격: 끝까지 내달리며 70px 마다 뒤에 낙뢰
      e.timer -= dt; b.setVelocityX(e.face * (ph2 ? 560 : 480));
      if (e.timer % .04 < dt) sc.fx.ghost(e.sprite, 0x8ab0ff, .5, 220);
      if (Math.abs(e.x - e.lastStrike) > 70) { e.lastStrike = e.x; thunderAt(e, [e.x], { color: 0x8ab0ff, delay: .35, mul: .9 }); }
      if (e.timer <= 0 || b.blocked.left || b.blocked.right || e.x <= room.left + 24 || e.x >= room.right - 24) { b.setVelocityX(0); sc.fx.shake(.01, 200); e.state = 'recover'; e.timer = .8; }
      break;
    case 'fbRise':   // 크로스썬더: 솟아올라 번개 구체가 된다
      e.timer -= dt;
      sc.fx.burst(e.x, e.y, [0xffffff, 0x8ab0ff], 2, 60, { up: 0, grav: 0, bounce: false, glow: true, life: .2 });
      if (e.timer <= 0) {
        b.setVelocity(0, 0); e.fbX = Phaser.Math.Clamp(p.x, room.left + 30, room.right - 30);
        const gy = floorY(e, e.fbX);
        e.zone({ x: e.fbX - 30, y: room.top, w: 60, h: gy - room.top, delay: .6, life: .85, dmg: e.dmg * 1.4, type: 'electric', draw: 'pillar', color: 0x8ab0ff });
        e.state = 'fbAim'; e.timer = .6; sc.fx.glow(e.x, e.y, 46, 0x8ab0ff, 600, 1);
      }
      break;
    case 'fbAim':
      e.timer -= dt; b.setVelocity((e.fbX - e.x) * 6, 0);
      if (e.timer <= 0) { b.setVelocity(0, 900); e.state = 'fbDive'; e.timer = .9; }
      break;
    case 'fbDive':
      e.timer -= dt;
      if (e.timer % .03 < dt) sc.fx.ghost(e.sprite, 0x8ab0ff, .6, 220);
      if (b.blocked.down || e.timer <= 0 || e.y >= room.bottom - 20) {
        b.setAllowGravity(true); b.setVelocity(0, 0);
        const gy = floorY(e, e.x);
        boltFx(sc, e.x, room.top, gy, 0x8ab0ff); slamWave(e, 0x8ab0ff, 'electric');
        e.state = 'recover'; e.timer = .9;
      }
      break;
    case 'fire': case 'recover': recover(e, dt); break;
  }
};

// ---- 블랙큐레무 (N의 성 지하 히든 · 얼어붙은 이상의) ----
//  프리즈볼트: 얼음 창 세 개를 차례로 던진다 — 꽂힌 자리 바닥에서 얼음 기둥 · 얼다세계: 천장에서 거대한 얼음 결정이 쏟아지고 바닥이 얼어붙는다
//  역린: 세 번 연달아 뛰어 내려찍는다 (점점 빨리) · 얼음 숨결
BOSS_AI.kyuremB = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xbff0ff, room = e.room;
  const spike = x => marchPillars(e, x, 1, 1, { delay: .05, h: 56, w: 22, color: col, type: 'ice', life: .5, burst: (bx, gy) => sc.fx.burst(bx, gy - 6, [0xffffff, col], 10, 130, { angle: -Math.PI / 2, spread: 1.2, up: 120, grav: 500, bounce: true, life: .6 }) });
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, Math.abs(p.x - e.x) > 240 ? 100 : ph2 ? 56 : 42, 110);
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['spears', 'glaciate', 'outrage', 'breath']);
      e.state = 'wind'; e.timer = (e.mode === 'glaciate' ? .9 : .55) * (ph2 ? .85 : 1); e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      sc.fx.glow(e.x, e.y, 44, col, e.timer * 1000, .9);
      if (e.mode === 'glaciate') Sfx.play('mega');
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'spears') {   // 프리즈볼트
        const n = ph2 ? 4 : 3;
        for (let k = 0; k < n; k++) sc.time.delayedCall(k * 320, () => {
          if (!live(e)) return;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.shot({ x: e.x + e.face * 16, y: e.y - 6, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 7, kind: 'bolt', type: 'ice', color: col, life: 2, onExpire: q => { if (live(e)) spike(q.x); } });
          Sfx.play('zap');
        });
        e.state = 'fire'; e.timer = .6 + n * .32;
      } else if (e.mode === 'glaciate') {   // 얼다세계
        const m = ph2 ? 8 : 6, xs = [];
        for (let k = 0; k < m; k++) xs.push(p.x + (k - (m - 1) / 2) * 56 + (Math.random() - .5) * 16);
        rockfall(e, Phaser.Utils.Array.Shuffle(xs), { kind: 'other', color: col, r: 10, warn: 0x9ad8ff, step: .1, onLand: x => spike(x) });
        e.zone({ x: room.left, y: room.bottom - 8, w: room.right - room.left, h: 8, delay: 1.2, life: 4.5, multi: true, dmg: e.dmg * .3, type: 'ice', draw: 'seed', color: col, status: { slow: 1.5 } });
        sc.cameras.main.flash(220, 200, 240, 255, true); sc.fx.shake(.012, 500); Sfx.play('boom');
        e.state = 'fire'; e.timer = 1.8;
      } else if (e.mode === 'outrage') { e.leaps = 3; b.setVelocity((p.x - e.x) * .9, -440); e.state = 'leap'; e.timer = 1; e.diving = false; Sfx.play('dash'); }
      else {   // 얼음 숨결
        const n = ph2 ? 7 : 5, base = Math.atan2(p.y - e.y, p.x - e.x);
        for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * .16; e.shot({ x: e.x + e.face * 14, y: e.y - 6, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 6, kind: 'other', type: 'ice', color: col, life: 1.8, status: { slow: 1 } }); }
        Sfx.play('wave'); e.state = 'fire'; e.timer = .8;
      }
      break;
    case 'leap':   // 역린: 세 번 연달아 (점점 빨리)
      e.timer -= dt;
      if (e.timer < .45 && !e.diving) { e.diving = true; b.setVelocity((p.x - e.x) * 1.8, 560); }
      if (e.diving && (b.blocked.down || e.timer <= 0)) {
        e.diving = false; slamWave(e, col, 'dragon');
        e.leaps--;
        if (e.leaps > 0) { b.setVelocity((p.x - e.x) * 1, -420); e.timer = .85 - (3 - e.leaps) * .12; Sfx.play('dash'); }
        else { e.state = 'recover'; e.timer = .9; }
      }
      break;
    case 'fire': case 'recover': recover(e, dt); break;
  }
};

// ---- 피카츄 (최종장 · 세뇌된 레드의 파트너) ----
//  볼트태클: 번개를 두르고 돌진, 벽에 부딪히면 튕겨 되돌아온다 (2페이즈는 세 번) · 10만볼트: 번개 탄 세 갈래 연사
//  번개: 플레이어 자리와 양옆 낙뢰 · 전광석화: 짧게 세 번 순간이동하며 들이받는다
BOSS_AI.pikachu = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xffe040, room = e.room;
  switch (e.state) {
    case 'idle':
      approachPlayer(e, p, Math.abs(p.x - e.x) > 220 ? 150 : ph2 ? 90 : 72, 90);
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(['volt', 'tbolt', 'thunder', 'quick']);
      e.state = 'wind'; e.timer = (e.mode === 'volt' ? .5 : .4) * (ph2 ? .85 : 1); e.telegraph(true); b.setVelocityX(0); e.facePlayer(p);
      sc.fx.glow(e.x, e.y, 26, col, e.timer * 1000, .9); Sfx.play('zap');
      break;
    case 'wind':
      e.timer -= dt; b.setVelocityX(b.velocity.x * .8);
      if (Math.random() < .6) sc.fx.burst(e.x + (Math.random() - .5) * 20, e.y + (Math.random() - .5) * 20, [0xffffff, col], 1, 70, { up: 0, grav: 0, bounce: false, glow: true, life: .15 });
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'volt') { e.bounces = ph2 ? 3 : 2; e.state = 'volt'; e.timer = 1; e.facePlayer(p); Sfx.play('thunder'); }
      else if (e.mode === 'tbolt') {
        for (let r = 0; r < 3; r++) sc.time.delayedCall(r * 220, () => {
          if (!live(e)) return;
          const base = Math.atan2(p.y - e.y, p.x - e.x);
          for (const da of [-.2, 0, .2]) e.shot({ x: e.x, y: e.y, vx: Math.cos(base + da) * 260, vy: Math.sin(base + da) * 260, r: 5, kind: 'bolt', type: 'electric', color: col, life: 1.6 });
          Sfx.play('zap');
        });
        e.state = 'fire'; e.timer = .9;
      } else if (e.mode === 'thunder') { thunderAt(e, [p.x, p.x - 60, p.x + 60, ...(ph2 ? [p.x - 120, p.x + 120] : [])], { color: col }); e.state = 'fire'; e.timer = 1.3; }
      else { e.hops = 3; pikaHop(e, p); }
      break;
    case 'volt':   // 볼트태클
      e.timer -= dt; b.setVelocityX(e.face * (ph2 ? 520 : 450));
      if (e.timer % .04 < dt) sc.fx.ghost(e.sprite, col, .55, 200);
      if (Math.random() < .6) sc.fx.burst(e.x, e.y, [0xffffff, col], 1, 90, { up: 20, grav: 200, glow: true, life: .2 });
      if (b.blocked.left || b.blocked.right || e.x <= room.left + 24 || e.x >= room.right - 24 || e.timer <= 0) {
        sc.fx.shake(.008, 160); sc.fx.ring(e.x, e.y, 30, col, 240);
        e.bounces--;
        if (e.bounces > 0) { e.face *= -1; e.refacing(); e.timer = 1; b.setVelocityX(e.face * 100); }
        else { b.setVelocityX(0); e.state = 'recover'; e.timer = .7; }
      }
      break;
    case 'blinkOut':   // 전광석화: 플레이어 옆에 번쩍
      e.timer -= dt;
      if (e.timer <= 0) {
        const s = Math.random() < .5 ? -1 : 1, x = Phaser.Math.Clamp(p.x + s * 70, room.left + 24, room.right - 24);
        b.reset(x, floorY(e, x) - b.height / 2 - 1); e.sprite.setAlpha(1); e.intangible = false; e.facePlayer(p);
        sc.fx.ring(e.x, e.y, 20, col, 200);
        e.state = 'hopAim'; e.timer = .2;
      }
      break;
    case 'hopAim': e.timer -= dt; b.setVelocityX(0); if (e.timer <= 0) { e.state = 'dash'; e.timer = .22; b.setVelocityX(e.face * 420); Sfx.play('dash'); } break;
    case 'dash':
      e.timer -= dt;
      if (e.timer % .03 < dt) sc.fx.ghost(e.sprite, col, .5, 180);
      if (e.timer <= 0) { b.setVelocityX(0); e.hops--; if (e.hops > 0) pikaHop(e, p); else { e.state = 'recover'; e.timer = .6; } }
      break;
    case 'fire': case 'recover': recover(e, dt); break;
  }
};
function pikaHop(e) {
  const sc = e.scene, col = e.def.color || 0xffe040;
  sc.fx.ghost(e.sprite, col, .6, 200);
  e.sprite.setAlpha(.1); e.intangible = true; e.b.setVelocityX(0);
  e.state = 'blinkOut'; e.timer = .18;
}

// ---- 무한다이노 (최종장 · 모든 것의 원흉) → 무한다이맥스 (체력 50%) ----
//  다이맥스포: 붉은 핵에 빛을 모아 플레이어를 노리는 굵은 광선 (예고 동안 천천히 따라온다) · 독침 비: 떨어진 자리에 독 웅덩이
//  크로스포이즌: 플레이어 자리에서 엇갈리는 X 베기 · 무한광선: 아레나 위로 올라가 기를 모았다가 아레나 전체를 가로지르는 굵은 광선 띠 (대시 무적 · 높이로 피한다)
//  무한다이맥스: 몸이 커지고 하늘이 붉게 물든다 — 아레나 네 구석에 붉은 결정이 솟아 차례로 광선 · 다이맥스포 세 갈래
function dynamaxCannon(e, p, offset = 0, delay = .8) {
  const sc = e.scene; let a = Math.atan2(p.y - e.y, p.x - e.x) + offset, last = 0;
  lineHazard(e, (k, t) => {
    const dt = t - last; last = t;
    if (t < delay * .75) a += Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(Math.atan2(p.y - e.y, p.x - e.x) + offset - a), -1.4 * dt, 1.4 * dt);   // 예고 동안 천천히 따라온다
    return { x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * 1200, y2: e.y + Math.sin(a) * 1200 };
  }, { delay, life: .9, width: 24, color: 0xff2a5a, type: 'dragon', dmg: e.dmg * 1.3 });
}
function eternaCrystals(e, p) {
  const sc = e.scene, room = e.room, spots = [[room.left + 40, room.top + 40], [room.right - 40, room.top + 40], [room.left + 40, room.bottom - 40], [room.right - 40, room.bottom - 40]];
  spots.forEach(([x, y], k) => {
    const g = own(e, sc.add.graphics().setDepth(18).setBlendMode(ADDB)), d = .5 + k * .45;
    e.zone({ x: 0, y: 0, w: 0, h: 0, dmg: 0, life: d + 1.4, draw: 'none',
      onUpdate: z => {   // 붉은 육각 결정이 솟아 빛을 모은다
        const s = Math.min(1, z.t * 3), glow = Math.min(1, z.t / d);
        g.clear(); g.fillStyle(0xff1a4a, .25 * glow); g.fillCircle(x, y, 22 * s);
        g.fillStyle(0xd0103a, .9); g.fillPoints([{ x, y: y - 18 * s }, { x: x + 9 * s, y: y - 6 * s }, { x: x + 9 * s, y: y + 10 * s }, { x, y: y + 18 * s }, { x: x - 9 * s, y: y + 10 * s }, { x: x - 9 * s, y: y - 6 * s }], true);
        g.fillStyle(0xffa0b8, .8); g.fillRect(x - 2, y - 10 * s, 3, 14 * s);
      },
      dispose: () => g.destroy() });
    sc.time.delayedCall(d * 1000, () => {
      if (!live(e)) return;
      const a = Math.atan2(p.y - y, p.x - x);
      lineHazard(e, () => ({ x1: x, y1: y, x2: x + Math.cos(a) * 1300, y2: y + Math.sin(a) * 1300 }), { delay: .45, life: .4, width: 14, color: 0xff3a6a, type: 'dragon', dmg: e.dmg });
      Sfx.play('beam');
    });
  });
}
function redSky(e) {   // 무한다이맥스: 배경이 붉게 물든다 (카메라를 따라간다)
  const sc = e.scene, cam = sc.cameras.main, r = own(e, sc.add.rectangle(0, 0, 10, 10, 0x8a0a2a, 0).setOrigin(0).setDepth(2.5).setBlendMode(ADDB));
  e.zone({ x: 0, y: 0, w: 0, h: 0, dmg: 0, life: 9999, draw: 'none',
    onUpdate: z => { const v = cam.worldView; r.setPosition(v.x - 20, v.y - 20).setSize(v.width + 40, v.height + 40).setFillStyle(0x8a0a2a, Math.min(.35, z.t * .3) * (.85 + Math.sin(z.t * 2) * .15)); },
    dispose: () => r.destroy() });
}
BOSS_AI.eternatus = function (e, dt, p) {
  const sc = e.scene, ph2 = e.phase === 2, b = e.b, col = e.def.color || 0xff2a5a, room = e.room;
  if (ph2 && !e.maxed) { e.maxed = true; redSky(e); e.cd = .3; }
  switch (e.state) {
    case 'idle': {
      e.facePlayer(p);
      const tx = p.x - Math.sign(p.x - e.x || 1) * 150, ty = p.y - 80 + Math.sin(e.t * 1.4) * 16, far = Math.abs(p.x - e.x) > 260 ? 200 : 100;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 1.4, -far, far), Phaser.Math.Clamp((ty - e.y) * 1.4, -110, 110));
      e.cd -= dt;
      if (e.cd > 0) break;
      e.mode = e.choose(ph2 ? ['cannon', 'toxic', 'cross', 'eterna', 'crystals'] : ['cannon', 'toxic', 'cross', 'eterna']);
      if (e.mode === 'eterna') { e.state = 'rise'; e.timer = 1.1; e.telegraph(true); break; }
      e.state = 'wind'; e.timer = ph2 ? .45 : .6; e.telegraph(true); b.setVelocity(0, 0);
      sc.fx.glow(e.x, e.y, 46, col, e.timer * 1000, .9);
      break;
    }
    case 'wind':
      e.timer -= dt; b.setVelocity(b.velocity.x * .85, b.velocity.y * .85);
      if (e.timer > 0) break;
      e.telegraph(false);
      if (e.mode === 'cannon') {   // 다이맥스포 (무한다이맥스는 세 갈래)
        dynamaxCannon(e, p);
        if (ph2) { dynamaxCannon(e, p, .35, 1); dynamaxCannon(e, p, -.35, 1); }
        Sfx.play('beam'); e.state = 'fire'; e.timer = 1.6;
      } else if (e.mode === 'toxic') {   // 독침 비
        const n = ph2 ? 10 : 7, xs = [];
        for (let k = 0; k < n; k++) xs.push(p.x + (k - (n - 1) / 2) * 44 + (Math.random() - .5) * 14);
        rockfall(e, Phaser.Utils.Array.Shuffle(xs), { kind: 'other', color: 0xc04aff, r: 5, warn: 0xb04aff, step: .07,
          onLand: (x, gy) => e.zone({ x: x - 22, y: gy - 10, w: 44, h: 10, delay: 0, life: 3, multi: true, dmg: e.dmg * .4, type: 'poison', draw: 'poison', color: 0xc04aff }) });
        Sfx.play('eshot'); e.state = 'fire'; e.timer = 1.4;
      } else if (e.mode === 'cross') {   // 크로스포이즌
        const cx = p.x, cy = p.y;
        for (const a of [.7, -.7]) lineHazard(e, () => ({ x1: cx - Math.cos(a) * 320, y1: cy - Math.sin(a) * 320, x2: cx + Math.cos(a) * 320, y2: cy + Math.sin(a) * 320 }), { delay: .6, life: .3, width: 18, color: 0xd04aff, type: 'poison', dmg: e.dmg * 1.2 });
        Sfx.play('swing'); e.state = 'fire'; e.timer = 1.1;
      } else { eternaCrystals(e, p); Sfx.play('boss'); e.state = 'fire'; e.timer = 2.6; }
      break;
    case 'rise': {   // 무한광선 준비: 아레나 위 가운데로
      e.timer -= dt;
      const tx = room.cx, ty = room.top + 50;
      b.setVelocity(Phaser.Math.Clamp((tx - e.x) * 3, -400, 400), Phaser.Math.Clamp((ty - e.y) * 3, -400, 400));
      if (Math.hypot(tx - e.x, ty - e.y) < 16 || e.timer <= 0) {
        b.setVelocity(0, 0); e.state = 'charge'; e.timer = ph2 ? 1.1 : 1.4;
        sc.fx.glow(e.x, e.y, 90, col, e.timer * 1000, 1); Sfx.play('mega');
        if (!e.eternaTold) { e.eternaTold = true; sc.events.emit('toast', '무한광선 — 대시 무적으로 뚫거나 높이를 바꿔 피하자!'); }
      }
      break;
    }
    case 'charge':
      e.timer -= dt; b.setVelocity(0, 0);
      for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 50; sc.fx.burst(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, [col, 0xffffff, 0xff8aa8], 1, 220, { angle: a + Math.PI, spread: .05, up: 0, grav: 0, bounce: false, glow: true, life: .4, drag: 1 }); }
      if (e.timer <= 0) {
        e.telegraph(false);
        const y = Phaser.Math.Clamp(p.y - 20, room.top + 10, room.bottom - 40);
        e.zone({ x: room.left, y, w: room.right - room.left, h: 40, delay: .55, life: 2.1, multi: true, dmg: e.dmg * 1.5, type: 'dragon', draw: 'beam', color: col });
        sc.time.delayedCall(550, () => { if (live(e)) { sc.fx.shake(.022, 1400); sc.cameras.main.flash(200, 255, 120, 150, true); Sfx.play('boom'); Sfx.play('beam'); } });
        e.state = 'fire'; e.timer = 2.4;
      }
      break;
    case 'fire': case 'recover':
      e.timer -= dt; b.setVelocity(b.velocity.x * .9, b.velocity.y * .9);
      if (e.timer <= 0) { e.state = 'idle'; e.cd = (ph2 ? .5 : .95) + Math.random() * .4; }
      break;
  }
};

// 솔라빔 경고선 (보스가 바라보는 쪽 끝까지)
function solarWarn(e) {
  const len = 360, x = e.face > 0 ? e.x + 10 : e.x - 10 - len;
  e.zone({ x, y: e.y - 14, w: len, h: 20, delay: 1.1, life: 1.6, dmg: e.dmg * 1.6, type: 'grass', draw: 'beam', color: 0xfff6a0, multi: true });
}
