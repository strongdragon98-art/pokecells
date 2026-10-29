// 파티(최대 3마리) 컨트롤러: 이동·점프·대시·스킬·실시간 교대(Tag)·진화·영구 메가진화·Z기술·피격
// 성장은 포켓몬마다 따로: 경험치(정화할 때 출전 중이던 포켓몬이 받음) → 2단 → 3단 진화, 장착 아이템, 메가진화(3단 + 메가스톤, V)
// 파티 공용: Z크리스탈(Q Z기술) · 메가스톤 보유 · 가방(장착하지 않은 아이템) · 스테이지 체력 보너스
// p.tier · p.exp · p.items · p.mods · p.mega.active 는 '지금 출전 중인 포켓몬'의 값을 돌려준다 (스킬·전투 코드는 그대로 쓴다)
import Phaser from 'phaser';
import { Actor } from './Actor.js';
import { SPECIES, SKILLS, TAGS, TIERS, EVO_EXP, ZMOVES, Z_CD } from '../data/pokemon.js';
import { computeMods, ITEMS, MAX_EQUIP } from '../data/items.js';
import { typeMultiplier, effectiveness, typeColor } from '../data/types.js';
import { SKILL_IMPL, TAG_IMPL, ZMOVE_IMPL } from './skills.js';
import { Sfx } from '../systems/Audio.js';

const SWAP_CD = 3;

export class Player extends Actor {
  constructor(scene, partyKeys, x, y) {
    super(scene, null, x, y, 14, 18);
    this.members = partyKeys.map(k => ({
      key: k, sp: SPECIES[k], maxhp: SPECIES[k].hp, hp: SPECIES[k].hp, cd: { z: 0, x: 0, c: 0 }, alive: true,
      tier: 0, exp: 0, mega: false, items: {}, mods: computeMods({}),      // 포켓몬마다 따로 크는 것들
      skills: { ...SPECIES[k].skills }, ups: new Set(), atkBonus: 1, cdBonus: 1,   // 기술머신: 바꿔 단 기술 · 받은 강화 카드 · 숙련 보너스
      learned: Object.values(SPECIES[k].skills)   // 배운 기술 전부 (가방 → 기술에서 Z·X·C 자리에 골라 넣는다)
    }));
    this.idx = 0;
    this.bag = {};                                      // 가방: 아무도 장착하지 않은 아이템
    this.inv = 0; this.dash = null; this.dashCd = 0; this.airDash = true; this.swapCd = 0;
    this.jumpsUsed = 0; this.coyote = 0; this.jbuf = 0; this.dropT = 0; this.hurtT = 0; this.speedBuff = 0;
    this.action = null; this.combo = 0; this.comboT = 0; this.zBuf = 0;
    const self = this;                                 // mega.active = 출전 포켓몬이 메가진화했는가 (포켓몬마다, 그 판 끝까지 유지)
    this.mega = { stones: 0, get active() { return self.m.mega; }, set active(v) { self.m.mega = v; } };
    this.z = { has: false, cd: 0 };                    // Z크리스탈 · Z기술 재사용 대기
    this.stageBonus = 1;                               // 스테이지를 넘을 때마다 최대 체력 ×1.15
    this.intangible = false;
    this.wasGround = false; this.lastVy = 0;
    this.b.setMaxVelocity(700, 640);
    this.b.setCollideWorldBounds(true);
    this.sprite.setDepth(22);
    this.aura = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(21).setVisible(false);
    this.applyVisual();
  }

  get m() { return this.members[this.idx]; }
  get sp() { return this.m.sp; }
  get tier() { return this.m.tier; }                 // 0 = 1단, 1 = 2단, 2 = 3단 (출전 포켓몬)
  get exp() { return this.m.exp; }
  get items() { return this.m.items; }
  get mods() { return this.m.mods; }
  get types() { return (this.mega.active && this.sp.mega.types) || this.sp.types; }
  tierOf(m) { return m.mega ? 3 : m.tier; }
  get tierIdx() { return this.tierOf(this.m); }
  get T() { return TIERS[this.tierIdx]; }
  get fxMul() { return this.T.fx; }                    // 스킬 이펙트 크기 배율 (skills.js)
  get atk() { return this.sp.atk * this.T.atk * (this.m.atkBonus || 1); }
  // 기술 슬롯(z·x·c)에 지금 단 기술 id — 기술머신으로 포켓몬마다 바꿀 수 있다
  skillId(slot, m = this.m) { return m.skills[slot]; }
  hasUp(id, m = this.m) { return m.ups.has(id); }
  // 기술 쿨타임(초): 아이템 · 숙련 카드 · 메가진화 반영
  cdOf(id, m = this.m) { return SKILLS[id].cd * m.mods.cdMul * (m.cdBonus || 1) * (m.mega ? .8 : 1); }
  // 쿨타임 0 인 기본 공격만 3단 콤보 (Z 자리에 기술머신 기술을 달면 쿨타임 기술로 쓴다)
  isCombo(slot, m = this.m) { return slot === 'z' && !SKILLS[m.skills[slot]].cd; }
  // 배운 기술 id 를 slot(z·x·c)에 넣는다. 이미 다른 자리에 있으면 두 자리를 맞바꾼다.
  //  쿨타임은 자리에 남는다 (바꿔 끼워 쿨타임을 초기화할 수 없게). 연타 기술(쿨타임 없음)은 Z 자리 전용
  setSkill(m, id, slot) {
    if (!SKILLS[id] || !m.learned.includes(id) || m.skills[slot] === id) return false;
    if (!SKILLS[id].cd && slot !== 'z') return false;
    const other = Object.keys(m.skills).find(s => m.skills[s] === id);
    if (other) {
      if (!SKILLS[m.skills[slot]].cd && other !== 'z') return false;   // 맞바꾸면 연타 기술이 X·C 로 가게 되는 경우
      m.skills[other] = m.skills[slot];
    }
    m.skills[slot] = id;
    if (m === this.m && this.action && this.action.slot && (this.action.slot === slot || this.action.slot === other)) this.endAction(true);
    return true;
  }
  get name() { return this.mega.active ? this.sp.mega.name : this.form().name; }

  // 지금 단계의 모습 (2단계뿐인 포켓몬은 마지막 모습에 오라)
  form(m = this.m) { const e = m.sp.evo; return e[Math.min(m.tier, e.length - 1)]; }
  formName(m = this.m) { return m.mega ? m.sp.mega.name : this.form(m).name; }
  // 초상화: 메가진화했으면 메가 초상화, 아니면 지금 진화 단계의 모습
  portraitKey(m = this.m) {
    const mp = m.mega && m.sp.mega.portrait;
    return mp && this.scene.textures.exists(`portrait:${mp}`) ? mp : this.formKey(m);
  }
  formKey(m = this.m) {
    const meta = this.scene.registry.get('spriteMeta'), k = this.form(m).key;
    return meta[k] && meta[k].hasSprite ? k : m.key;
  }
  maxHpOf(m) { return Math.round(m.sp.hp * this.stageBonus * TIERS[this.tierOf(m)].hp); }

  visualKey() {
    const meta = this.scene.registry.get('spriteMeta');
    const mk = this.sp.mega.sprite;
    if (this.mega.active && mk && meta[mk] && meta[mk].hasSprite) return mk;
    return this.formKey();
  }

  // 진화할수록 몸집이 조금씩 커진다 (진화형 도트 자체도 크다) + 메가 모습이 없으면 오라와 함께 더 크게
  applyVisual() {
    const key = this.visualKey();
    const scale = this.T.size * (this.mega.active && !this.sp.mega.sprite ? (this.sp.mega.scale || 1.1) : 1) * (!this.mega.active && this.form().aura ? 1.06 : 1);
    this.setSpecies(key, scale);
    const meta = this.meta;
    const w = Math.max(10, Math.min(24, Math.round(meta.bodyW * scale))), h = Math.max(14, Math.min(38, Math.round(meta.bodyH * scale)));
    this.resizeBody(w, h);
  }

  // 최대 체력 다시 계산 (진화·메가·스테이지 이동). 늘어난 만큼 현재 체력도 늘리고, heal 비율만큼 더 회복
  //  only: 그 포켓몬만 (진화·메가는 당사자만 커진다)
  recalcHp(heal = 0, only = null) {
    for (const m of this.members) {
      if (only && m !== only) continue;
      const old = m.maxhp;
      m.maxhp = this.maxHpOf(m);
      if (m.alive) m.hp = Math.min(m.maxhp, m.hp + Math.max(0, m.maxhp - old) + m.maxhp * heal);
    }
  }

  // ---------------- 경험치 · 진화 (포켓몬마다) ----------------
  // 경험치는 정화할 때 출전 중이던 포켓몬이 받는다
  addExp(n, m = this.m) {
    if (m.tier >= EVO_EXP.length) return;
    m.exp += n;
    if (m.exp >= EVO_EXP[m.tier]) this.evolve(m);
  }
  // 다음 진화까지 진행도 0~1 (3단 이후 1)
  expProgress(m = this.m) {
    if (m.tier >= EVO_EXP.length) return 1;
    const lo = m.tier ? EVO_EXP[m.tier - 1] : 0;
    return Phaser.Math.Clamp((m.exp - lo) / (EVO_EXP[m.tier] - lo), 0, 1);
  }
  expToNext(m = this.m) { return m.tier >= EVO_EXP.length ? 0 : Math.max(0, EVO_EXP[m.tier] - m.exp); }

  evolve(m = this.m) {
    if (m.tier >= EVO_EXP.length) return;
    const sc = this.scene, before = this.form(m).name;
    m.tier++;
    m.exp = Math.max(m.exp, EVO_EXP[m.tier - 1]);
    this.recalcHp(.3, m);
    if (m !== this.m) {   // 대기 중인 포켓몬은 조용히 진화만 (보통은 출전 포켓몬만 경험치를 받는다)
      sc.events.emit('toast', `${before}은(는) ${this.form(m).name}(으)로 진화했다!`);
      return;
    }
    // 하얗게 빛나며 몸이 부풀었다가 새 모습으로
    this.inv = Math.max(this.inv, 1.2);
    sc.fx.hitStop(260);
    this.flash(450);
    this.applyVisual();
    this.squash(.55, 1.6);
    sc.cameras.main.flash(300, 255, 255, 255, true);
    for (let k = 0; k < 5; k++) sc.time.delayedCall(k * 110, () => sc.fx.ring(this.x, this.y, 22 + k * 16, k % 2 ? 0x9ad8ff : 0xffffff, 420));
    sc.fx.burst(this.x, this.y, [0xffffff, 0xbfe6ff, 0xfff6c0], 46, 200, { glow: true, up: 90 });
    sc.fx.shake(.01, 320);
    Sfx.play('evolve');
    const after = this.form().name;
    sc.events.emit('banner', before === after ? `${after}의 힘이 깨어났다!` : `${before}은(는) ${after}(으)로 진화했다!`,
      `${TIERS[this.tier].name} 진화 · 공격력 ×${TIERS[this.tier].atk} · 몸집·기술 이펙트 커짐 (이 포켓몬만)`);
    if (this.tier === 2 && this.mega.stones > 0 && !this.mega.active) sc.time.delayedCall(2600, () => sc.events.emit('toast', '메가스톤이 공명한다! V 로 메가진화'));
    sc.events.emit('swap', this);
  }

  // ---------------- 아이템 장착 (포켓몬마다) ----------------
  // 주운 아이템은 출전 중인 포켓몬이 바로 장착한다 (장착 칸 5개가 차 있으면 가방으로). 가방(I)에서 장착하거나 빼 둘 수 있다.
  //  반환: true 장착 · false 가방에 넣음
  addItem(id) {
    if (this.giveItem(id, this.idx)) return true;
    this.bag[id] = (this.bag[id] || 0) + 1;
    return false;
  }
  equipCount(m) { return Object.values(m.items).reduce((s, n) => s + n, 0); }
  giveItem(id, i) {
    const m = this.members[i];
    if (this.equipCount(m) >= MAX_EQUIP) return false;
    m.items[id] = (m.items[id] || 0) + 1;
    m.mods = computeMods(m.items);
    return true;
  }
  // 아이템 1개 옮기기: from·to 는 파티 번호(0~2) 또는 -1(가방)
  moveItem(id, from, to) {
    if (from === to) return false;
    const src = from < 0 ? this.bag : this.members[from].items;
    if (!src[id]) return false;
    if (to >= 0 && this.equipCount(this.members[to]) >= MAX_EQUIP) return false;   // 장착 칸이 가득
    if (--src[id] <= 0) delete src[id];
    if (from >= 0) this.members[from].mods = computeMods(src);
    if (to < 0) this.bag[id] = (this.bag[id] || 0) + 1;
    else this.giveItem(id, to);
    return true;
  }

  heal(n, silent = false) {
    const m = this.m;
    n = Math.round(Math.min(n, m.maxhp - m.hp));
    if (n <= 0) return;
    m.hp += n;
    if (!silent) { this.scene.fx.floatText(this.x, this.b.y - 4, `+${n}`, '#7dff9a', 10); this.scene.fx.burst(this.x, this.y, 0x7dff9a, 6, 40, { grav: -60, bounce: false, glow: true }); }
  }
  selfDamage(n) { this.m.hp = Math.max(1, this.m.hp - Math.round(n)); }

  // ---------------- 입력 처리 & 이동 ----------------
  update(dt, inp) {
    const sc = this.scene, b = this.b, sp = this.sp;
    this.lastInput = inp;
    this.inv -= dt; this.dashCd -= dt; this.swapCd -= dt; this.comboT -= dt; this.zBuf -= dt; this.dropT -= dt; this.hurtT -= dt; this.speedBuff -= dt;
    this.z.cd = Math.max(0, this.z.cd - dt);
    for (const m of this.members) for (const k in m.cd) m.cd[k] = Math.max(0, m.cd[k] - dt);
    // 재생: 출전 포켓몬(아이템), 대기 포켓몬(초당 1%)
    if (this.mods.regen && this.m.hp < this.m.maxhp) this.m.hp = Math.min(this.m.maxhp, this.m.hp + this.m.maxhp * this.mods.regen * dt);
    for (const m of this.members) if (m !== this.m && m.alive && m.hp < m.maxhp) m.hp = Math.min(m.maxhp, m.hp + m.maxhp * .005 * dt);
    // 메가 (영구): 발밑에서 무지갯빛 불씨
    if (this.mega.active && Math.random() < .35) sc.fx.embers(this.x + (Math.random() - .5) * 20, this.bottom - 4, [0xff8ad0, 0x9a7aff, 0xfff6c0], 1, { speed: 30 });

    // 교대
    if (!this.dash) {
      let target = -1;
      if (inp.s1) target = 0; else if (inp.s2) target = 1; else if (inp.s3) target = 2;
      else if (inp.swapNext) target = this.nextAlive(1); else if (inp.swapPrev) target = this.nextAlive(-1);
      if (target >= 0 && target !== this.idx) this.swapTo(target);
    }
    if (inp.mega) this.startMega();
    if (inp.zmoveP) this.useZMove();

    // 대시(회피)
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (inp.dashP && this.dashCd <= 0 && !this.dash && (this.onGround || this.airDash)) {
      if (!this.onGround) this.airDash = false;
      this.dash = { t: 0, dir: dir || this.face };
      this.face = this.dash.dir; this.refacing();
      this.action = null; this.dashCd = .55; this.inv = Math.max(this.inv, .26);
      Sfx.play('dash'); this.squash(1.3, .75);
    }

    // 스킬 (Z는 입력 버퍼로 콤보)
    if (inp.zP) this.zBuf = .25;
    if (!this.dash && (!this.action || this.action.cancel)) {
      if (inp.cP) this.useSkill('c');
      else if (inp.xP) this.useSkill('x');
      else if (this.zBuf > 0 && !this.action) { this.zBuf = 0; this.useSkill('z'); }
    }

    // 수평 이동
    const a = this.action;
    const slow = (this.slowT || 0) > 0 ? .6 : 1;
    this.slowT = (this.slowT || 0) - dt;
    this.windT = (this.windT || 0) - dt;
    if (this.flipT > 0 && (this.flipT -= dt) <= 0) { this.b.setGravityY(0); this.sprite.setFlipY(false); }
    const speed = sp.speed * (this.speedBuff > 0 ? 1.25 : 1) * slow * (this.mega.active ? 1.1 : 1);
    if (this.dash) {
      this.dash.t += dt;
      b.setAllowGravity(false); b.setVelocity(this.dash.dir * 330, 0);
      this.dash.gt = (this.dash.gt || 0) - dt;
      if (this.dash.gt <= 0) { this.dash.gt = .025; sc.fx.ghost(this.sprite, typeColor(this.types[0]), .55, 240); }
      if (this.dash.t >= .19) { this.dash = null; b.setAllowGravity(true); b.setVelocityX(b.velocity.x * .45); }
    } else if (a && a.ctrl) {
      b.setAllowGravity(!a.noGrav);
    } else {
      b.setAllowGravity(!(a && a.noGrav));
      const mm = a ? (a.mm ?? .3) : 1;
      const target = dir * speed * mm + (this.windT > 0 ? this.windV : 0), acc = (this.onGround ? 1500 : 1000) * dt, v = b.velocity.x;   // 칠색조 폭풍 날개짓 등 바람에 밀린다
      b.setVelocityX(v < target ? Math.min(v + acc, target) : Math.max(v - acc, target));
      if (dir && !(a && a.lockFace) && dir !== this.face) { this.face = dir; this.refacing(); }
    }

    // 점프 (코요테 타임 + 입력 버퍼 + 다단 점프 + 발판 내려가기)
    const ground = this.onGround;
    if (ground) { this.coyote = .1; this.jumpsUsed = 0; this.airDash = true; } else this.coyote -= dt;
    if (inp.jumpP) this.jbuf = .12; else this.jbuf -= dt;
    if (this.jbuf > 0 && !this.dash && !(a && a.mm === 0)) {
      if (inp.down && ground && sc.standingOnPlatform(this)) { this.dropT = .28; this.jbuf = 0; b.setVelocityY(40); }
      else if (ground || this.coyote > 0) { this.jump(sp.jump, false); }
      else if (this.jumpsUsed < sp.jumps) { this.jump(sp.jump * .92, true); }
    }
    if (!inp.jumpH && b.velocity.y < -60 && !(a && a.ctrl)) b.setVelocityY(b.velocity.y * .86);   // 짧게 누르면 낮은 점프
    if (sp.hover && inp.jumpH && b.velocity.y > 40 && !this.dash) b.setVelocityY(40);           // 고오스 부유

    // 행동 진행
    if (a) {
      a.t += dt;
      if (a.update) a.update(this, a, dt);
      while (a.ev && a.evi < a.ev.length && a.t >= a.ev[a.evi][0]) { a.ev[a.evi][1](); a.evi++; }
      if (this.action === a && a.t >= a.dur) this.endAction();
    }

    // 착지 스쿼시
    if (ground && !this.wasGround && this.lastVy > 160) { this.squash(1.32, .72); sc.fx.burst(this.x, this.bottom - 1, 0xc8c0e0, 6, 60, { up: 30, life: .3 }); Sfx.play('land'); }
    this.wasGround = ground; this.lastVy = b.velocity.y;

    // 낙사 방지
    if (this.b.y > sc.level.height + 40) { this.b.reset(this.safeX ?? this.x, (this.safeY ?? 100) - 20); this.takeHit(this.m.maxhp * .1, 'none', this.x, { force: true }); }
    if (ground && !sc.standingOnPlatform(this)) { this.safeX = this.x; this.safeY = this.bottom - this.b.height / 2; }

    this.updateAnim(dt);
  }

  jump(v, air) {
    this.b.setVelocityY(-v);
    this.jumpsUsed = air ? this.jumpsUsed + 1 : 1;
    this.coyote = 0; this.jbuf = 0;
    this.squash(.72, 1.32);
    if (air) { this.scene.fx.ring(this.x, this.bottom, 10, 0xffffff, 200); Sfx.play('djump'); }
    else { this.scene.fx.burst(this.x, this.bottom - 1, 0xd0c8e8, 5, 50, { up: 20, life: .3 }); Sfx.play('jump'); }
  }

  updateAnim(dt) {
    const a = this.action, vx = this.b.velocity.x;
    let name;
    if (a && a.anim) name = a.anim;
    else if (this.hurtT > 0) name = 'Hurt';
    else if (!this.onGround) name = 'Walk';
    else name = Math.abs(vx) > 12 ? 'Walk' : 'Idle';
    if (name !== this.animName) this.play(name);
    if (!a) this.sprite.anims.timeScale = !this.onGround ? .5 : name === 'Walk' ? Math.max(.6, Math.abs(vx) / 90) : 1;
    // 메가 오라
    const au = this.aura;
    if (this.mega.active) {
      const hue = (this.scene.time.now / 8) % 360, col = Phaser.Display.Color.HSVToRGB(hue / 360, .55, 1).color;
      au.setVisible(true).setPosition(this.x, this.y).setTint(col).setScale(this.b.height / 22 * (1 + Math.sin(this.scene.time.now / 120) * .08)).setAlpha(.55);
    } else au.setVisible(false);
    this.tintFill = a && a.tintFill ? a.tintFill : null;
    if (this.inv > 0 && this.hurtT <= 0 && !this.dash && !(a && a.inv) && Math.floor(this.scene.time.now / 60) % 2) this.sprite.setAlpha(.45);
    else if (!this.intangible) this.sprite.setAlpha(1);
    this.syncSprite(dt);
    if (this.flipT > 0) this.sprite.y = Math.round(this.b.y + this.sprite.displayHeight * this.sprite.originY);   // 뒤집힌 발이 천장에 닿게
  }

  // ---------------- 스킬 ----------------
  useSkill(slot) {
    const id = this.skillId(slot), m = this.m, combo = this.isCombo(slot);
    if (!combo && m.cd[slot] > 0) return;
    let action;
    if (combo) {
      if (this.comboT <= 0) this.combo = 0;
      action = SKILL_IMPL[id](this, this.combo % 3);
      action.comboStep = true;
    } else {
      action = SKILL_IMPL[id](this, 0);
      m.cd[slot] = this.cdOf(id);
      if (this.mods.orbCost && slot !== 'z') this.selfDamage(m.maxhp * .03);
    }
    this.startAction(action, slot);
  }

  startAction(a, slot) {
    if (this.action) this.endAction(true);
    a.t = 0; a.evi = 0; a.slot = slot;
    if (a.ev) a.ev.sort((p, q) => p[0] - q[0]);
    if (a.inv) this.inv = Math.max(this.inv, a.inv);
    this.action = a;
    if (a.anim) {
      this.play(a.anim, true);
      const am = this.meta.anims[a.anim];
      this.sprite.anims.timeScale = am ? Phaser.Math.Clamp(am.ms / (a.dur * 1000), .5, 3.5) : 1;
    }
    if (a.noGrav) { this.b.setAllowGravity(false); if (!a.ctrl) this.b.setVelocityY(0); }
  }

  endAction(interrupted = false) {
    const a = this.action; if (!a) return;
    this.action = null;
    this.b.setAllowGravity(true);
    this.sprite.anims.timeScale = 1;
    if (a.end) a.end(this, a);
    if (a.comboStep && !interrupted) { this.combo = (this.combo + 1) % 3; this.comboT = .45; }
  }

  // ---------------- 교대 (Tag) ----------------
  nextAlive(step) {
    for (let k = 1; k < this.members.length; k++) {
      const i = (this.idx + step * k + this.members.length * 3) % this.members.length;
      if (this.members[i].alive) return i;
    }
    return -1;
  }

  swapTo(i, forced = false) {
    const sc = this.scene, target = this.members[i];
    if (!target || !target.alive || i === this.idx) return false;
    if (!forced && this.swapCd > 0) { Sfx.play('deny'); return false; }
    sc.fx.ghost(this.sprite, typeColor(this.types[0]), .75, 420);
    if (this.action) this.endAction(true);
    this.idx = i; this.combo = 0;
    this.applyVisual();
    this.swapCd = SWAP_CD * this.mods.swapCdMul;
    this.inv = Math.max(this.inv, .5);
    this.squash(.6, 1.45);
    const col = typeColor(this.types[0]);
    for (let k = 1; k <= 3; k++) sc.time.delayedCall(k * 30, () => sc.fx.ghost(this.sprite, col, .5 - k * .1, 260));
    sc.fx.glow(this.x, this.y, 40, col, 260, 1);
    Sfx.play('swap');
    TAG_IMPL[this.sp.tag](this);
    sc.fx.floatText(this.x, this.b.y - 14, `${this.name}! ${TAGS[this.sp.tag].name}`, '#ffe36a', 10);
    sc.events.emit('swap', this);
    return true;
  }

  // ---------------- Z기술 (Q) ----------------
  useZMove() {
    const sc = this.scene;
    if (!this.z.has) { sc.events.emit('toast', 'Z크리스탈이 없다 (스테이지 2 보스가 지니고 있다)'); Sfx.play('deny'); return; }
    if (this.z.cd > 0) { sc.events.emit('toast', `Z기술 재사용까지 ${Math.ceil(this.z.cd)}초`); Sfx.play('deny'); return; }
    if (this.dash) return;
    this.z.cd = Z_CD;
    this.startAction(ZMOVE_IMPL[this.sp.zmove](this, ZMOVES[this.sp.zmove]), 'zmove');
  }

  // ---------------- 메가진화 (3단 + 메가스톤, 영구) ----------------
  startMega() {
    const mg = this.mega, sc = this.scene;
    if (mg.active) return;
    if (mg.stones <= 0) { sc.events.emit('toast', '메가스톤이 없다 (스테이지 3 보스가 지니고 있다)'); Sfx.play('deny'); return; }
    if (this.tier < 2) { sc.events.emit('toast', `${this.form().name}은(는) 3단 진화 후에 메가진화할 수 있다 (진화까지 ${this.expToNext()})`); Sfx.play('deny'); return; }
    mg.active = true;   // 출전 중인 포켓몬만 (메가스톤은 파티 공용이라 다른 3단 포켓몬도 각자 메가진화할 수 있다)
    this.recalcHp(.5, this.m);
    this.applyVisual();
    this.inv = Math.max(this.inv, 1);
    sc.fx.hitStop(320);
    sc.cameras.main.flash(260, 255, 255, 255, true);
    for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 90, () => sc.fx.ring(this.x, this.y, 30 + k * 18, [0xff8ad0, 0x9a7aff, 0x5ad0ff, 0xfff6c0][k], 360));
    sc.fx.burst(this.x, this.y, [0xff8ad0, 0x9a7aff, 0x5ad0ff, 0xfff6c0, 0xffffff], 40, 220, { glow: true });
    sc.fx.shake(.012, 300);
    Sfx.play('mega');
    sc.events.emit('banner', '메가진화!', `${this.form().name} → ${this.sp.mega.name} · 이 포켓몬은 이번 판 끝까지 유지`);
    sc.events.emit('swap', this);
  }

  // ---------------- 피격 ----------------
  blockProjectile(q) {
    const g = this.action && this.action.guard;
    if (g === 'reflect') return 'reflect';
    if (g === 'spin') return 'block';
    return null;
  }

  // 바람: t초 동안 v(px/s) 만큼 한쪽으로 밀린다 (대시 중엔 버틴다)
  wind(v, t) { this.windV = v; this.windT = t; }
  // 뒤틀린 중력 (기라티나): t초 동안 천장으로 떨어진다 — 몸도 뒤집혀 보인다
  gravFlip(t) { this.flipT = t; this.b.setGravityY(-1800); this.sprite.setFlipY(true); }

  takeHit(dmg, type, srcX, o = {}) {
    const sc = this.scene, a = this.action;
    if (!o.force && (this.inv > 0 || this.intangible || this.dash)) return false;
    if (a && a.guard === 'counter') {
      this.endAction(true);
      sc.combat.hitCircle(this.x, this.y, 42 * this.mods.sizeMul, 3, 'fighting', { kbx: 320, kby: -200, hs: 120 });
      sc.fx.ring(this.x, this.y, 42, 0x8ad8ff, 260); sc.fx.floatText(this.x, this.b.y - 10, '카운터!', '#8ad8ff', 12);
      this.inv = .5; Sfx.play('punch');
      return true;
    }
    const m = type === 'none' ? 1 : typeMultiplier(type, this.types);
    const eff = effectiveness(m);
    const d = Math.max(1, Math.round(dmg * m * (this.mega.active ? .8 : 1)));
    this.m.hp -= d;
    sc.fx.floatText(this.x, this.b.y - 2, `-${d}`, eff === 'super' ? '#ff6a4a' : '#ff9a8a', eff === 'super' ? 15 : 12);
    if (eff === 'super') sc.fx.floatText(this.x, this.b.y - 18, '효과가 굉장했다!', '#ffb050', 10);
    this.flash(100); this.hurtT = .25; this.inv = .85;
    sc.fx.hitStop(60); sc.fx.shake(eff === 'super' ? .012 : .007, 160);
    sc.fx.burst(this.x, this.y, [0xff5a5a, 0xffffff], 8, 100);
    Sfx.play('hurt');
    if (o.slow) this.slowT = o.slow;
    if (!this.mega.active || o.force) {
      const dir = Math.sign(this.x - srcX) || -this.face;
      this.b.setVelocity(dir * 170, -170);
      if (this.action && !this.action.inv) this.endAction(true);
    }
    if (this.m.hp <= 0) this.faint();
    return true;
  }

  faint() {
    const sc = this.scene, m = this.m;
    m.hp = 0; m.alive = false;
    sc.fx.burst(this.x, this.y, [typeColor(this.sp.types[0]), 0xffffff], 30, 160, { glow: true });
    sc.events.emit('toast', `${this.form(m).name}은(는) 쓰러졌다!`);
    const next = this.nextAlive(1);
    if (next >= 0) { this.swapTo(next, true); this.inv = 1.5; }
    else sc.gameOver(false);
  }

  destroy() { this.aura.destroy(); super.destroy(); }
}

export { ITEMS };
