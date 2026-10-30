// 파티(최대 3마리) 컨트롤러: 이동·점프·대시·스킬·실시간 교대(Tag)·진화·영구 메가진화·Z기술·피격
// 성장은 포켓몬마다 따로: 경험치(정화할 때 출전 중이던 포켓몬이 받음) → 2단 → 3단 진화, 장착 아이템, 메가진화(3단 + 메가스톤, V)
// 파티 공용: Z크리스탈(Q Z기술) · 메가스톤 보유 · 가방(장착하지 않은 아이템) · 스테이지 체력 보너스
// p.tier · p.exp · p.items · p.mods · p.mega.active 는 '지금 출전 중인 포켓몬'의 값을 돌려준다 (스킬·전투 코드는 그대로 쓴다)
import Phaser from 'phaser';
import { Actor } from './Actor.js';
import { SPECIES, SKILLS, TAGS, TIERS, EVO_EXP, ZMOVES, Z_CD } from '../data/pokemon.js';
import { FORM_ITEMS } from '../data/roster.js';
import { computeMods, ITEMS, MAX_EQUIP } from '../data/items.js';
import { onHurt, onDash } from './Perks.js';
import { typeMultiplier, effectiveness, typeColor } from '../data/types.js';
import * as base from './skills.js';
import * as gen23 from './skills/gen23.js';
import * as gen45 from './skills/gen45.js';
import * as gen67 from './skills/gen67.js';
import * as gen89 from './skills/gen89.js';
import * as special from './skills/special.js';
import * as legend1 from './skills/legend1.js';
import * as legend2 from './skills/legend2.js';
import * as typeMoves from './skills/typeMoves.js';
import { Sfx } from '../systems/Audio.js';
import { buildGenerated } from './SkillGenerator.js';
import { shockwave } from '../systems/PostFX.js';

const SWAP_CD = 3;
// 라인별 전용 기술을 먼저, 기본·기술머신 기술(game/skills.js)로 덮는다 (같은 이름이면 기술머신판)
const SKILL_IMPL = Object.assign({}, gen23.SKILL_IMPL, gen45.SKILL_IMPL, gen67.SKILL_IMPL, gen89.SKILL_IMPL, special.SKILL_IMPL, legend1.SKILL_IMPL, legend2.SKILL_IMPL, base.SKILL_IMPL);
// GitHub(PokeAPI) 기술 데이터로 만든 기술 (game/SkillGenerator.js): 손으로 만든 기술이 없는 것만 더한다 → 기술머신 카드로 배울 수 있다
const GENERATED = buildGenerated(Object.assign({}, SKILLS, SKILL_IMPL));
Object.assign(SKILLS, GENERATED.SKILLS);
Object.assign(SKILL_IMPL, GENERATED.SKILL_IMPL);
const TAG_IMPL = Object.assign({}, typeMoves.TAG_IMPL, base.TAG_IMPL);
const ZMOVE_IMPL = Object.assign({}, typeMoves.ZMOVE_IMPL, base.ZMOVE_IMPL);
const LEGEND_BODY = { w: 22, h: 32 };   // 전설 플레이어블 히트박스 = 일반 최종진화(약 18×26)의 1.25배
const TELEPORT = 78;                    // 순간이동 거리
// Z 홀드 차징 샷: CHG_SHOW 초부터 기운이 모이고, 단계별 시각(초)에 1·2·3단 (2·3단은 '초고압 차징 코어' 특성 카드가 있어야)
const CHG_SHOW = .22, CHG_AT = [.72, 1.45, 2.25];
export { CHG_SHOW, CHG_AT };   // UIScene 스킬 바: Z 칸의 차징 게이지
// 속성 → 차징 탄 그림 (systems/ProjectileRenderer.js 의 kind)
const CHARGE_KIND = { fire: 'fire', water: 'water', ice: 'bubble', grass: 'leaf', bug: 'leaf', electric: 'bolt', ghost: 'shadow', dark: 'shadow', poison: 'bubble', psychic: 'wave',
  rock: 'rock', ground: 'rock', steel: 'steel', fighting: 'wave', normal: 'wave', flying: 'wave', dragon: 'wave', fairy: 'wave' };
// 단계별 차징 탄: 1단 기본 탄 · 2단 중형 관통탄 · 3단 화면을 가르는 초대형 폭발 속성포 (피해 1단의 300%)
const CHARGE_SHOT = [null,
  { r: 7, mul: 3.2, speed: 330, pierce: 1, life: .9, boom: { r: 30, mul: 1.1 }, sfx: 'cshot1', shake: .006 },
  { r: 9, mul: 4.6, speed: 440, pierce: 6, life: 1, sfx: 'cshot2', shake: .01 },
  { r: 17, mul: 9.6, speed: 560, pierce: 99, life: 1.25, ghost: true, boom: { r: 92, mul: 4 }, sfx: 'cshot3', shake: .022 }];

export class Player extends Actor {
  constructor(scene, partyKeys, x, y) {
    super(scene, null, x, y, 14, 18);
    this.members = partyKeys.map(k => this.makeMember(k));
    this.idx = 0;
    this.buffs = [];                                   // 일시 강화 { atk, speed, guard, t } (출전 포켓몬)
    this.formItems = new Set();                        // 폼체인지 아이템 (큰금강옥·큰백옥·큰백금옥 — data/roster.js 의 FORM_ITEMS, 그 판 동안 파티 공용)
    this.sandT = 0; this.flopT = 0;
    this.bag = {};                                      // 가방: 아무도 장착하지 않은 아이템
    this.candy = 0;                                     // 이상한사탕 (엘리트 처치 보상 · 가방에서 먹인다)
    this.inv = 0; this.dash = null; this.dashCd = 0; this.airDash = true; this.swapCd = 0;
    this.jumpsUsed = 0; this.coyote = 0; this.jbuf = 0; this.dropT = 0; this.hurtT = 0; this.speedBuff = 0;
    this.action = null; this.combo = 0; this.comboT = 0; this.zBuf = 0;
    this.chg = { t: 0, lvl: 0, st: 0 }; this.diveCd = 0;   // Z 홀드 차징 · 공중 내려찍기
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
    this.chgAura = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(23).setVisible(false);   // 차징 기운
    for (const m of this.members) m.maxhp = m.hp = this.maxHpOf(m);   // 모습별 체력 배율(잉어킹 0.55)까지 반영
    this.applyVisual();
  }

  // 파티 한 자리 (포켓몬마다 따로 크는 것들)
  makeMember(k) {
    const sp = SPECIES[k];
    return {
      key: k, sp, maxhp: sp.hp, hp: sp.hp, cd: { z: 0, x: 0, c: 0 }, alive: true,
      tier: 0, exp: 0, mega: false, megaPick: 0, items: {}, perks: {}, mods: computeMods({}, {}),   // perks: 기술머신 특성 카드 (game/Perks.js)
      skills: { ...(sp.evo[0].skills || sp.skills) }, ups: new Set(), atkBonus: 1, cdBonus: 1,   // 기술머신: 바꿔 단 기술 · 받은 강화 카드 · 숙련 보너스
      learned: Object.values(sp.evo[0].skills || sp.skills),   // 배운 기술 전부 (가방 → 기술에서 Z·X·C 자리에 골라 넣는다)
      chargeType: null   // 차징 샷·내려찍기 속성 (듀얼 타입은 가방에서 두 속성 중 고른다 · null 이면 첫 속성)
    };
  }

  get m() { return this.members[this.idx]; }
  get sp() { return this.m.sp; }
  get pas() { return this.sp.passive || {}; }        // 특성 (data/roster.js 의 passive)
  get tier() { return this.m.tier; }                 // 0 = 1단, 1 = 2단, 2 = 3단 (출전 포켓몬)
  get exp() { return this.m.exp; }
  get items() { return this.m.items; }
  get mods() { return this.m.mods; }
  get types() { return this.typesOf(); }
  tierOf(m) { return m.mega ? 3 : m.tier; }
  get tierIdx() { return this.tierOf(this.m); }
  get T() { return TIERS[this.tierIdx]; }
  get fxMul() { return this.T.fx; }                    // 스킬 이펙트 크기 배율 (skills.js)
  // 공격력: 특성 카드(힘·역린)와 구애머리띠(Z칸)·구애안경(X·C칸)은 지금 쓰는 기술 칸을 보고 곱한다
  get atk() {
    const md = this.mods, sl = this.action && this.action.slot, m = this.m;
    const slotMul = sl === 'z' ? md.bandMul : sl === 'x' || sl === 'c' ? md.specsMul : 1, rage = md.berserk && m.hp <= m.maxhp * .5 ? 1 + md.berserk : 1;
    return this.sp.atk * this.T.atk * (m.atkBonus || 1) * this.statOf('atk') * this.buffMul('atk') * md.atkMul * slotMul * rage;
  }
  // 고른 메가(리자몽·뮤츠 X/Y) · 모습별 타입 · 모습별 능력치 배율(잉어킹 → 갸라도스 10배)
  megaOf(m = this.m) { return m.sp.megas[m.megaPick || 0] || m.sp.mega; }
  typesOf(m = this.m) { return (m.mega && this.megaOf(m).types) || this.form(m).types || m.sp.types; }
  // 차징 샷·내려찍기 속성: 듀얼 타입이면 가방에서 고른 쪽 (모습이 바뀌어 그 속성이 없어지면 첫 속성)
  chargeType(m = this.m) { const t = this.typesOf(m); return t.includes(m.chargeType) ? m.chargeType : t[0]; }
  setChargeType(m, type) { if (!this.typesOf(m).includes(type)) return false; m.chargeType = type; return true; }
  statOf(k, m = this.m) { const s = this.form(m).stat; return s && s[k] !== undefined ? s[k] : 1; }
  // 일시 강화: 똬리틀기·용의춤 등 (atk·speed 배율, guard = 받는 피해 배율)
  addBuff(o) {
    this.buffs.push({ atk: o.atk || 1, speed: o.speed || 1, guard: o.guard || 1, t: o.t || 4 });
    if (o.color !== undefined) this.scene.fx.ring(this.x, this.y, 26, o.color, 300);
  }
  buffMul(k) { let v = 1; for (const b of this.buffs) v *= b[k]; return v; }
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
  get name() { return this.mega.active ? this.megaOf().name : this.form().name; }

  // 지금 단계의 모습 (2단계뿐인 포켓몬은 마지막 모습에 오라)
  form(m = this.m) { const e = m.sp.evo; return e[Math.min(m.tier, e.length - 1)]; }
  formName(m = this.m) { return m.mega ? this.megaOf(m).name : this.form(m).name; }
  // 초상화: 메가진화했으면 메가 초상화, 아니면 지금 진화 단계의 모습 (받지 않은 모습은 PokeAPI 아이콘)
  portraitKey(m = this.m) {
    const mp = m.mega && this.megaOf(m).portrait, tx = this.scene.textures;
    return mp && (tx.exists(`portrait:${mp}`) || tx.exists(`icon:${mp}`)) ? mp : this.formKey(m);
  }
  formKey(m = this.m) {
    const meta = this.scene.registry.get('spriteMeta'), k = this.form(m).key;
    return meta[k] && meta[k].hasSprite ? k : m.key;
  }
  maxHpOf(m) { return Math.round(m.sp.hp * this.stageBonus * TIERS[this.tierOf(m)].hp * this.statOf('hp', m) * ((m.mods && m.mods.hpMul) || 1)); }

  visualKey() {
    const meta = this.scene.registry.get('spriteMeta');
    const mk = this.megaOf().sprite;
    if (this.mega.active && mk && meta[mk] && meta[mk].hasSprite) return mk;
    return this.formKey();
  }

  // 진화할수록 몸집이 조금씩 커진다 (진화형 도트 자체도 크다) + 메가 모습이 없으면 오라와 함께 더 크게
  //  거대 몸집(롱스톤 계열)은 판정도 크게, 전설은 도트 크기와 상관없이 히트박스를 고정한다 (좁은 길·발판을 지나가도록)
  applyVisual() {
    const key = this.visualKey(), mg = this.megaOf(), big = this.pas.big || 1;
    let scale = this.T.size * (this.mega.active && !mg.sprite ? (mg.scale || 1.1) : 1) * (!this.mega.active && this.form().aura ? 1.06 : 1);
    const meta0 = this.scene.registry.get('spriteMeta')[key];
    if (this.sp.legend && meta0) scale *= Phaser.Math.Clamp(40 / Math.max(10, meta0.height), .55, 1.4);
    this.setSpecies(key, scale * big);
    const meta = this.meta;
    if (this.sp.legend) { this.resizeBody(LEGEND_BODY.w, LEGEND_BODY.h); return; }
    const w = Math.max(10, Math.min(24 * big, Math.round(meta.bodyW * scale * big))), h = Math.max(14, Math.min(38 * big, Math.round(meta.bodyH * scale * big)));
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
    m.exp += n * ((m.mods && m.mods.expMul) || 1);   // 메가스톤 코어: 경험치 2배
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
    const sc = this.scene, before = this.form(m).name, prev = this.form(m), atk0 = this.statOf('atk', m);
    m.tier++;
    m.exp = Math.max(m.exp, EVO_EXP[m.tier - 1]);
    // 모습마다 기술이 다른 라인(잉어킹 → 갸라도스): 옛 기본 기술 자리를 새 기본 기술로 바꾸고 배운 기술에 더한다 (기술머신으로 바꿔 단 자리는 그대로)
    const oldSet = prev.skills || m.sp.skills, newSet = this.form(m).skills || m.sp.skills;
    if (oldSet !== newSet) for (const sl of ['z', 'x', 'c']) {
      if (!m.learned.includes(newSet[sl])) m.learned.push(newSet[sl]);
      if (m.skills[sl] === oldSet[sl]) m.skills[sl] = newSet[sl];
    }
    const burst = this.statOf('atk', m) / Math.max(.01, atk0);
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
      burst >= 5 ? `기다림 끝의 각성! 공격력 ×${Math.round(burst)} · 기술이 완전히 바뀌었다` : `${TIERS[this.tier].name} 진화 · 공격력 ×${TIERS[this.tier].atk} · 몸집·기술 이펙트 커짐 (이 포켓몬만)`);
    if (burst >= 5) { sc.fx.shake(.02, 600); sc.cameras.main.flash(500, 120, 200, 255, true); }
    if (this.tier === 2 && this.mega.stones > 0 && !this.mega.active) sc.time.delayedCall(2600, () => sc.events.emit('toast', '메가스톤이 공명한다! V 로 메가진화'));
    sc.events.emit('swap', this);
  }

  // ---------------- 이상한사탕 (파티 공용 · 가방에서 먹일 포켓몬을 고른다) ----------------
  //  다음 진화까지 필요한 경험치의 40%를 바로 채운다 (차면 그 자리에서 진화). 3단(최종)이면 체력을 모두 회복하고 공격력 +3%
  feedCandy(m) {
    if (!this.candy) return null;
    this.candy--;
    if (m.tier >= EVO_EXP.length) { m.atkBonus = (m.atkBonus || 1) * 1.03; m.alive = true; m.hp = m.maxhp; return { maxed: true }; }
    const lo = m.tier ? EVO_EXP[m.tier - 1] : 0, gain = Math.ceil((EVO_EXP[m.tier] - lo) * .4), t0 = m.tier;
    this.addExp(gain, m);
    return { gain, evolved: m.tier > t0 };
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
    this.refreshMods(m);
    return true;
  }
  // 아이템 1개 옮기기: from·to 는 파티 번호(0~2) 또는 -1(가방)
  moveItem(id, from, to) {
    if (from === to) return false;
    const src = from < 0 ? this.bag : this.members[from].items;
    if (!src[id]) return false;
    if (to >= 0 && this.equipCount(this.members[to]) >= MAX_EQUIP) return false;   // 장착 칸이 가득
    if (--src[id] <= 0) delete src[id];
    if (from >= 0) this.refreshMods(this.members[from]);
    if (to < 0) this.bag[id] = (this.bag[id] || 0) + 1;
    else this.giveItem(id, to);
    return true;
  }

  // 장착 아이템 + 특성 카드가 바뀌면 보정치를 다시 계산 (최대 체력 배율도 바로 반영)
  refreshMods(m) { m.mods = computeMods(m.items, m.perks); this.recalcHp(0, m); }

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
    this.inv -= dt; this.dashCd -= dt; this.swapCd -= dt; this.diveCd -= dt; this.comboT -= dt; this.zBuf -= dt; this.dropT -= dt; this.hurtT -= dt; this.speedBuff -= dt;
    this.z.cd = Math.max(0, this.z.cd - dt);
    for (const m of this.members) for (const k in m.cd) m.cd[k] = Math.max(0, m.cd[k] - dt);
    for (const bf of this.buffs) bf.t -= dt;
    if (this.buffs.length) this.buffs = this.buffs.filter(bf => bf.t > 0);
    this.updatePassive(dt);
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
    if (inp.mega) this.startMega(inp.up ? 1 : 0);   // ↑ + V : 두 번째 메가 (메가리자몽Y · 메가뮤츠Y)
    if (inp.zmoveP) this.useZMove();

    // 대시(회피) — 파괴광선 반동 등(action.noDash)은 끊을 수 없다. 랄토스 계열은 순간이동
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (inp.dashP && this.dashCd <= 0 && !this.dash && (this.onGround || this.airDash) && !(this.action && this.action.noDash)) {
      if (!this.onGround) this.airDash = false;
      if (this.action) this.endAction(true);   // 스킬의 end() 로 남은 이펙트·상태를 정리
      this.dash = { t: 0, dir: dir || this.face };
      this.face = this.dash.dir; this.refacing();
      this.dashCd = .55 * this.mods.dashCdMul; this.inv = Math.max(this.inv, .26 + this.mods.dashInvAdd);
      onDash(this, this.dash);   // 특성 카드: 대시 폭탄 · 분신 대시
      if (this.pas.teleport) this.teleport(this.dash);
      else { Sfx.play('dash'); this.squash(1.3, .75); }
    }

    // 공중 내려찍기: 공중에서 ↓ + Z (모든 포켓몬 공통) — 바닥을 강타하는 충격파 · 적 머리 밟기 · 위기 탈출
    //  ↓ + ← · → (조이스틱은 수평보다 아래 어느 쪽이든)이면 그 방향으로 대각선 강하
    const diveAim = inp.diveAim || ((inp.downAim ?? inp.down) ? { x: dir, y: 1 } : null);
    if (inp.zP && diveAim && !this.onGround && !this.dash && this.diveCd <= 0 && !(this.action && (this.action.dive || this.action.noDash || this.action.slot === 'zmove'))) {
      inp.zP = false; this.zBuf = 0;
      this.startDive(diveAim);
    }
    this.updateCharge(dt, inp);
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
    const speed = sp.speed * this.mods.speedMul * (this.speedBuff > 0 ? 1.25 : 1) * slow * (this.mega.active ? 1.1 : 1) * this.statOf('speed') * this.buffMul('speed');
    if (this.dash && this.dash.tele) {   // 순간이동: 이미 옮겨졌다. 잠깐 멈춰 잔상만 남긴다
      this.dash.t += dt;
      b.setAllowGravity(false); b.setVelocity(0, 0);
      if (this.dash.t >= .12) { this.dash = null; b.setAllowGravity(true); }
    } else if (this.dash) {
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
      // 방향 전환: 행동 중에도 좌우 입력으로 바로 돌아선다 (불꽃세례·화염방사·연사·시전 대기 중 조준 전환 — 뒤따르는 탄도 새 방향으로)
      //  lockFace: 'hard' 인 행동만 막는다 (돌진처럼 속도를 직접 다루는 ctrl 행동은 위에서 따로 처리)
      if (dir && !(a && a.lockFace === 'hard') && dir !== this.face) {
        this.face = dir; this.refacing();
        if (a && a.t > .02) this.scene.fx.ghost(this.sprite, typeColor(this.types[0]), .3, 120);   // 시전 중 돌아서는 잔상
      }
    }

    // 점프 (코요테 타임 + 입력 버퍼 + 다단 점프 + 발판 내려가기)
    const ground = this.onGround;
    if (ground) { this.coyote = .1; this.jumpsUsed = 0; this.airDash = true; } else this.coyote -= dt;
    if (inp.jumpP) { this.jbuf = .12; this.jbufDown = !!(inp.downAim ?? inp.down); } else this.jbuf -= dt;
    if (this.jbuf > 0 && !this.dash && !(a && a.mm === 0)) {
      // 하향 점프(↓ + 점프)는 일반 점프와 완전히 따로: 이 분기에 들어오면 위로 뛰는 점프는 절대 하지 않는다
      //  · 통과 발판 위: 0.25초 동안 발판 충돌을 끄고 부드럽게 아래로 (위로 튀지 않는다)
      //  · 단단한 바닥 위 · 이미 떨어지는 중: 아무 일도 없다 (위아래로 떨리지 않게)
      if (this.jbufDown || inp.downAim || this.dropT > 0) {
        this.jbuf = 0;
        if (ground && this.dropT <= 0 && sc.standingOnPlatform(this)) { this.dropT = .25; this.coyote = 0; b.setVelocityY(120); b.y += 2; }
      }
      else if (ground || this.coyote > 0) { this.jump(sp.jump, false); }
      else if (this.jumpsUsed < sp.jumps + this.mods.extraJumps) { this.jump(sp.jump * .92, true); }
    }
    if (!inp.jumpH && b.velocity.y < -60 && !(a && a.ctrl)) b.setVelocityY(b.velocity.y * .86);   // 짧게 누르면 낮은 점프
    const hover = sp.hover || (this.pas.hoverForm !== undefined && this.form().fi >= this.pas.hoverForm);
    if (hover && inp.jumpH && b.velocity.y > 40 && !this.dash) b.setVelocityY(40);              // 고오스·망나뇽·전설 부유

    // 행동 진행 (스라크 계열은 모든 행동이 빠르다)
    if (a) {
      a.t += dt * (this.pas.atkSpeed || 1);
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

  // 순간이동 (랄토스 계열 대시): 벽 앞까지 즉시 옮기고, 출발점에 잔상 · 완전 무적
  teleport(d) {
    const sc = this.scene, b = this.b, hw = b.width / 2;
    let dist = 0;
    while (dist < TELEPORT && !sc.isSolidAt(this.x + d.dir * (dist + 4 + hw), this.y) && !sc.isSolidAt(this.x + d.dir * (dist + 4 + hw), b.bottom - 3)) dist += 4;
    for (let k = 0; k < 3; k++) sc.fx.ghost(this.sprite, k % 2 ? 0xff9ad0 : 0xc8a0ff, .6 - k * .15, 380 + k * 120);
    sc.fx.ring(this.x, this.y, 16, 0xff9ad0, 240);
    b.reset(this.x + d.dir * dist, this.y);
    sc.fx.glow(this.x, this.y, 26, 0xc8a0ff, 260, .9); sc.fx.ring(this.x, this.y, 22, 0xc8a0ff, 260);
    d.tele = true; this.inv = Math.max(this.inv, .4);
    Sfx.play('recall'); this.squash(.7, 1.3);
  }

  // 상시 특성: 모래바람 오라(마기라스) · 파닥파닥 이동(잉어킹)
  updatePassive(dt) {
    const sc = this.scene, pas = this.pas, fi = this.form().fi;
    if (pas.sandstorm !== undefined && fi >= pas.sandstorm) {
      const r = 70 * (this.mega.active ? 1.4 : 1);
      if (Math.random() < .6) sc.fx.burst(this.x + (Math.random() - .5) * r * 2, this.y + (Math.random() - .5) * r, [0xd8b060, 0xc0a050, 0xf0d8a0], 1, 40, { grav: 0, bounce: false, life: .5, size: 1 });
      this.sandT -= dt;
      if (this.sandT <= 0) { this.sandT = .5; sc.combat.hitCircle(this.x, this.y, r, .22, 'rock', { kbx: 0, kby: 0, hs: 0 }); }
    }
    if (pas.flop !== undefined && fi === pas.flop && this.onGround && !this.action && Math.abs(this.b.velocity.x) > 20) {
      this.flopT -= dt;
      if (this.flopT <= 0) { this.flopT = .32; this.b.setVelocityY(-150); this.squash(1.25, .75); sc.fx.burst(this.x, this.bottom - 1, [0x8ad0ff, 0xffffff], 4, 50, { up: 40, life: .3 }); }
    }
  }

  // 포켓몬센터 보관함: i번째 자리를 다른 포켓몬으로 (새로 온 포켓몬은 1단부터 · 메가스톤·Z크리스탈·가방은 파티 공용이라 그대로)
  replaceMember(i, key) {
    if (!SPECIES[key] || this.members.some(m => m.key === key)) return false;
    const m = this.makeMember(key), old = this.members[i];
    if (old) for (const [id, n] of Object.entries(old.items)) this.bag[id] = (this.bag[id] || 0) + n;   // 떠나는 포켓몬의 장착 아이템은 가방으로
    if (i >= this.members.length) { i = this.members.length; this.members.push(m); } else this.members[i] = m;
    m.maxhp = m.hp = this.maxHpOf(m);
    if (i === this.idx) { if (this.action) this.endAction(true); this.combo = 0; this.buffs = []; this.applyVisual(); }
    this.scene.events.emit('swap', this);
    return true;
  }

  // 디버그 (F3 메뉴): 출전 포켓몬을 다음 진화 단계로, 3단이면 메가진화
  debugEvolve() {
    const m = this.m;
    if (m.tier < EVO_EXP.length) { m.exp = EVO_EXP[m.tier]; this.evolve(m); return; }
    if (!this.mega.active) { this.mega.stones = Math.max(1, this.mega.stones); for (const mg of this.sp.megas) if (mg.item) this.formItems.add(mg.item); this.startMega(); }
  }
  // 테스트룸: 이 포켓몬을 tier 단계(0 1단 · 1 2단 · 2 3단)로 · mega 가 0 이상이면 그 메가(폼체인지·유대변화·각성)로 — 연출 없이 바로
  //  처음 모습부터 다시 진화시켜 모습마다 기술이 다른 라인(잉어킹 → 갸라도스)도 진화할 때처럼 기본 기술 자리를 바꾼다
  setForm(m, tier, mega = -1) {
    if (mega >= 0) tier = EVO_EXP.length;   // 메가는 3단에서
    m.mega = false; m.megaPick = 0; m.tier = 0; m.exp = 0;
    m.skills = { ...(m.sp.evo[0].skills || m.sp.skills) }; m.learned = Object.values(m.skills);
    while (m.tier < Math.min(tier, EVO_EXP.length)) {
      const oldSet = this.form(m).skills || m.sp.skills;
      m.tier++; m.exp = EVO_EXP[m.tier - 1];
      const newSet = this.form(m).skills || m.sp.skills;
      if (oldSet !== newSet) for (const sl of ['z', 'x', 'c']) {
        if (!m.learned.includes(newSet[sl])) m.learned.push(newSet[sl]);
        if (m.skills[sl] === oldSet[sl]) m.skills[sl] = newSet[sl];
      }
    }
    if (mega >= 0) { m.megaPick = m.sp.megas[mega] ? mega : 0; m.mega = true; }
    m.cd = { z: 0, x: 0, c: 0 };
    m.maxhp = m.hp = this.maxHpOf(m); m.alive = true;
    if (m === this.m) { if (this.action) this.endAction(true); this.combo = 0; this.buffs = []; this.applyVisual(); }
    this.scene.events.emit('swap', this);
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
      // 시전 오라: 기술 속성 색 고리 + 발밑에서 피어오르는 불티 (X·C 기술 공통)
      const col = typeColor(SKILLS[id].type), sc = this.scene;
      sc.fx.ring(this.x, this.y, 22, col, 220); sc.fx.glow(this.x, this.y, 22, col, 180, .6);
      sc.fx.embers(this.x, this.bottom - 4, [col, 0xffffff], 6, { speed: 50 });
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
      this.sprite.anims.timeScale = am ? Phaser.Math.Clamp(am.ms * (this.pas.atkSpeed || 1) / (a.dur * 1000), .5, 3.5) : 1;
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

  // ---------------- 공중 내려찍기 (↓ + Z, 공중) ----------------
  //  고른 속성(차징 속성) 기운을 두르고 바닥으로 초고속 강하. aim: 아래쪽 방향 { x, y } — 바로 아래면 수직,
  //   ↓ + ← · → 는 45° 대각선, 조이스틱은 가리킨 각도 그대로 (너무 얕으면 수평에서 30°까지 세운다)
  //  떨어지는 길에 적 머리를 밟으면 피해를 주고 위로 튕겨 오른다 (공중 대시·점프 회복 → 위기 탈출)
  //  바닥에 닿는 순간 충격파: 둘레 광역 피해 + 경직 (높이 떨어질수록 세다) · 금 간 벽·바닥·상자도 부순다
  startDive(aim) {
    const sc = this.scene, type = this.chargeType(), col = typeColor(type), y0 = this.y;
    const side = Math.abs(aim.x) < .08 ? 0 : Math.sign(aim.x), th = Math.max(Math.PI / 6, Math.atan2(Math.max(aim.y, .01), Math.abs(aim.x)));
    const vx = side ? Math.cos(th) * 760 * side : 0, vy = side ? Math.sin(th) * 760 : 720, dir = side;   // 수직이면 예전처럼 초속 720 으로 곧장
    if (this.action) this.endAction(true);
    this.chg.t = 0; this.chg.lvl = 0;
    this.diveCd = .45;
    if (side) { this.face = side; this.refacing(); }
    Sfx.play('dive');
    this.squash(.7, 1.35);
    sc.fx.ring(this.x, this.y, 16, col, 200);
    const trail = Math.atan2(-vy, -vx);   // 잔상 · 속도선은 날아가는 반대쪽으로
    this.startAction({
      dur: 1.6, ctrl: true, dive: true, anim: 'Strike', inv: .25,
      update: (p, a, dt) => {
        if (a.landed) { p.b.setVelocityX(p.b.velocity.x * .6); return; }
        p.b.setVelocity((p.b.blocked.left && vx < 0) || (p.b.blocked.right && vx > 0) ? 0 : vx, vy);   // 벽에 막히면 그대로 미끄러져 내려간다
        a.gt = (a.gt || 0) - dt;
        if (a.gt <= 0) {   // 속성 잔상 + 속도선
          a.gt = .028;
          sc.fx.ghost(p.sprite, col, .5, 200);
          sc.fx.burst(p.x + (Math.random() - .5) * 10, p.y - 10, [col, 0xffffff], 2, 30, { angle: trail, spread: .4, grav: 0, bounce: false, glow: true, life: .22, size: 1 });
        }
        // 머리 밟기: 발밑에 닿은 적
        const foot = { x: p.x - p.b.width / 2 - 2, y: p.bottom - 6, w: p.b.width + 4, h: 12 };
        const hit = sc.combat.enemiesIn(foot).find(e => !e.intangible);
        if (hit && !a.stomped) {
          a.stomped = true;
          sc.combat.damageEnemy(hit, p.atk * 1.8, type, { heavy: true, stun: .5, kb: dir * 60, kby: 120, hx: p.x, hy: p.bottom, hs: 70 });
          sc.fx.ring(p.x, p.bottom, 26, col, 260); sc.fx.starburst(p.x, p.bottom, col, 1.1, { debris: true });
          p.b.setVelocity(dir * 90, -330); p.airDash = true; p.jumpsUsed = Math.min(p.jumpsUsed, 1);   // 튕겨 올라 다시 움직일 수 있다
          p.inv = Math.max(p.inv, .35); p.squash(1.35, .7);
          a.landed = true; a.dur = a.t + .12;
          return;
        }
        if (p.onGround && a.t > .02) this.diveSlam(a, type, col, Math.max(0, p.y - y0));
      }
    }, 'dive');
  }
  diveSlam(a, type, col, fall) {
    const sc = this.scene, s = this.mods.sizeMul * this.fxMul, R = (50 + Math.min(40, fall * .12)) * s, x = this.x, by = this.bottom;
    a.landed = true; a.dur = a.t + .26;
    this.b.setVelocity(0, 0); this.squash(1.55, .58); this.inv = Math.max(this.inv, .3);
    const mul = 2.2 + Math.min(1.4, fall / 220);   // 높이 떨어질수록 세다
    sc.combat.hitCircle(x, by - 8, R, mul, type, { heavy: true, stun: .7, kbx: 240, kby: -280, hs: 90 });
    // 충격파: 바닥을 따라 양쪽으로 퍼지는 흙먼지 · 속성 고리 2겹 · 섬광
    sc.fx.ring(x, by - 4, R, col, 340); sc.fx.ring(x, by - 4, R * .62, 0xffffff, 260);
    sc.fx.glow(x, by - 6, R * .8, col, 300, .9);
    for (const d of [-1, 1]) for (let k = 1; k <= 6; k++) {
      const gx = x + d * k * R / 6, gb = sc.groundBelow(gx, by - 24);
      sc.time.delayedCall(k * 22, () => sc.fx.burst(gx, gb - 1, [col, 0xd8c8a8, 0xffffff], 3, 90, { angle: -Math.PI / 2 + d * .5, spread: .7, up: 60, life: .45 }));
    }
    sc.fx.starburst(x, by - 4, col, 1.4, { debris: true });
    sc.fx.burst(x, by - 2, [col, 0xffffff], 18, 180, { up: 120, glow: true });
    sc.fx.hitStop(70); sc.fx.shake(.016, 260, 'hit');
    Sfx.play('slam');
  }

  // ---------------- Z 홀드 차징 샷 ----------------
  //  Z 를 짧게 누르면 평소 평타. 꾹 누르고 있으면 몸 둘레에 속성 기운이 모이고(소리도 단계마다 높아진다), 떼는 순간 앞으로 차징 탄을 쏜다
  //  1단 기본 탄 · 2단 중형 관통탄 · 3단 화면을 가르는 초대형 폭발 속성포 (2·3단은 '초고압 차징 코어' 특성 카드)
  updateCharge(dt, inp) {
    const c = this.chg, a = this.action, sc = this.scene;
    const blocked = this.dash || (a && (a.dive || a.slot === 'zmove' || a.slot === 'charge'));
    if (inp.zH && !blocked) {
      c.t += dt;
      const max = this.mods.chargeCore ? 3 : 1;
      let lvl = 0; for (let k = 0; k < max; k++) if (c.t >= CHG_AT[k]) lvl = k + 1;
      const col = typeColor(this.chargeType());
      if (lvl > c.lvl) {   // 한 단계 찼다: 칭! + 고리
        c.lvl = lvl;
        Sfx.play('charged');
        sc.fx.ring(this.x, this.y, 18 + lvl * 8, lvl >= 3 ? 0xffffff : col, 260);
        sc.fx.burst(this.x, this.y, [col, 0xffffff], 8 + lvl * 4, 70 + lvl * 20, { glow: true, grav: 0, bounce: false, life: .35 });
      }
      if (c.t >= CHG_SHOW) {
        // 기운이 몸 쪽으로 빨려 든다 (단계가 오를수록 많이 · 크게)
        const n = 1 + (c.lvl >= 2 ? 1 : 0) + (c.lvl >= 3 ? 1 : 0), R = 30 + c.lvl * 6;
        for (let k = 0; k < n; k++) {
          const ang = Math.random() * Math.PI * 2, px = this.x + Math.cos(ang) * R, py = this.y + Math.sin(ang) * R * .8;
          sc.fx.burst(px, py, [col, 0xffffff], 1, R * 3.4, { angle: ang + Math.PI, spread: .15, up: 0, grav: 0, bounce: false, glow: true, life: .26, size: c.lvl >= 2 ? 2 : 1 });
        }
        const pulse = 1 + Math.sin(sc.time.now / (c.lvl >= 3 ? 40 : 70)) * .12, full = c.lvl >= max;
        this.chgAura.setVisible(true).setPosition(this.x, this.y).setTint(c.lvl >= 3 ? 0xffffff : col)
          .setScale((.5 + Math.min(1, c.t / CHG_AT[max - 1]) * .55 + c.lvl * .18) * pulse).setAlpha(full ? .75 : .45);
        c.st -= dt;
        if (c.st <= 0 && c.lvl < max) { c.st = .3; Sfx.play('charge' + Math.min(3, c.lvl + 1)); }   // 모이는 소리 (단계마다 높아진다)
        if (full && Math.floor(sc.time.now / 70) % 3 === 0) this.flash(40);   // 다 찼으면 몸이 하얗게 깜빡인다
      }
      return;
    }
    if (!inp.zH && c.lvl > 0 && !blocked) this.fireCharge(c.lvl);
    c.t = 0; c.lvl = 0; c.st = 0;
    this.chgAura.setVisible(false);
  }

  fireCharge(lvl) {
    const sc = this.scene, type = this.chargeType(), col = typeColor(type), spec = CHARGE_SHOT[lvl], s = this.mods.sizeMul * this.T.proj;
    if (this.action) this.endAction(true);
    this.chgAura.setVisible(false);
    this.startAction({
      dur: lvl >= 3 ? .5 : .3, mm: lvl >= 3 ? 0 : .25, anim: 'Shoot', inv: lvl >= 3 ? .3 : 0, ev: [[.03, () => {
        const f = this.face, x = this.x + f * 12, y = this.y - 3;
        const q = sc.combat.spawnProjectile({
          owner: 'player', x, y, vx: f * spec.speed, vy: 0, r: spec.r * s, mul: spec.mul, type, kind: CHARGE_KIND[type] || 'wave', color: col,
          life: spec.life, pierce: spec.pierce, ghost: !!spec.ghost, light: true, tier: Math.max(this.tierIdx, lvl), pow: s * (1 + lvl * .25), stream: false,
          boom: spec.boom && { r: spec.boom.r * (1 + (s - 1) * .6), mul: spec.boom.mul }, kb: 200 + lvl * 80,
          status: Object.assign({ heavy: true, hs: 50 + lvl * 25 }, lvl >= 2 ? { stun: .4 } : {}),
          update: (q, dt) => {   // 꼬리: 속성 파편 · 3단은 굵은 빛줄기가 남는다
            q.tt = (q.tt || 0) - dt;
            if (q.tt <= 0) { q.tt = lvl >= 3 ? .012 : .03; sc.fx.burst(q.x - f * q.r, q.y + (Math.random() - .5) * q.r, [col, 0xffffff], lvl, 40, { grav: 0, bounce: false, glow: true, life: .3, size: lvl >= 2 ? 2 : 1 }); }
            if (q.beam) { const L = Math.min(q.x0, q.x), W = Math.abs(q.x - q.x0); q.beam.clear().fillStyle(col, .35).fillRect(L, q.y - q.r * .9, W, q.r * 1.8).fillStyle(0xffffff, .55).fillRect(L, q.y - q.r * .3, W, q.r * .6); }
          },
          onExpire: q => { if (q.beam) { const bm = q.beam; q.beam = null; sc.tweens.add({ targets: bm, alpha: 0, duration: 420, onComplete: () => bm.destroy() }); } }
        });
        if (lvl >= 3) { q.x0 = x; q.beam = sc.add.graphics().setDepth(28).setBlendMode(Phaser.BlendModes.ADD); sc.cameras.main.flash(180, 255, 255, 255, true); sc.fx.hitStop(60); }
        // 발사 반동 · 섬광
        sc.fx.glow(x, y, (14 + lvl * 10) * s, col, 220, 1); sc.fx.ring(x, y, (12 + lvl * 10) * s, 0xffffff, 220);
        sc.fx.burst(x, y, [col, 0xffffff], 8 + lvl * 6, 140, { angle: f > 0 ? 0 : Math.PI, spread: .9, up: 10, glow: true, life: .3 });
        this.b.setVelocityX(-f * (60 + lvl * 50));
        sc.fx.shake(spec.shake, 160 + lvl * 60, 'hit');
        Sfx.play(spec.sfx);
        this.squash(.8, 1.2);
      }]]
    }, 'charge');
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
    shockwave(sc, this.x, this.y, .045, 750);   // 화면이 물결치며 Z기술 시작
    this.startAction(ZMOVE_IMPL[this.sp.zmove](this, ZMOVES[this.sp.zmove]), 'zmove');
  }

  // ---------------- 메가진화 (3단 + 메가스톤, 영구) ----------------
  //  폼체인지(디아루가·펄기아·기라티나 오리진폼)는 메가스톤·진화 단계 대신 그 전설의 아이템만 있으면 된다
  startMega(variant = 0) {
    const mg = this.mega, sc = this.scene, want = this.sp.megas[variant] || this.sp.megas[0];
    if (mg.active) return;
    if (want && want.item) {
      if (!this.formItems.has(want.item)) { const it = FORM_ITEMS[want.item]; sc.events.emit('toast', `${it.name}이(가) 없다 (${this.form().name} 보스를 정화하면 떨어뜨린다)`); Sfx.play('deny'); return; }
    } else {
      if (mg.stones <= 0) { sc.events.emit('toast', '메가스톤이 없다 (스테이지 3 보스가 지니고 있다)'); Sfx.play('deny'); return; }
      if (this.tier < 2) { sc.events.emit('toast', `${this.form().name}은(는) 3단 진화 후에 메가진화할 수 있다 (진화까지 ${this.expToNext()})`); Sfx.play('deny'); return; }
    }
    if (this.sp.megas[variant]) this.m.megaPick = variant;
    mg.active = true;   // 출전 중인 포켓몬만 (메가스톤은 파티 공용이라 다른 3단 포켓몬도 각자 메가진화할 수 있다)
    this.recalcHp(.5, this.m);
    this.applyVisual();
    this.inv = Math.max(this.inv, 1);
    sc.fx.hitStop(320);
    sc.cameras.main.flash(260, 255, 255, 255, true);
    for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 90, () => sc.fx.ring(this.x, this.y, 30 + k * 18, [0xff8ad0, 0x9a7aff, 0x5ad0ff, 0xfff6c0][k], 360));
    sc.fx.burst(this.x, this.y, [0xff8ad0, 0x9a7aff, 0x5ad0ff, 0xfff6c0, 0xffffff], 40, 220, { glow: true });
    sc.fx.shake(.012, 300);
    shockwave(sc, this.x, this.y, .04, 700);
    Sfx.play('mega');
    const mgv = this.megaOf(), title = mgv.item ? '폼체인지!' : mgv.bond ? '유대변화!' : mgv.awaken ? '각성!' : '메가진화!';
    const alt = this.sp.megas.length > 1 && !variant ? ` · ↑+V 는 ${this.sp.megas[1].name}` : '';
    sc.events.emit('banner', title, `${this.form().name} → ${mgv.name} · 이 포켓몬은 이번 판 끝까지 유지${alt}`);
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
    if (sc.testGod) return false;   // 테스트룸: 무적 (보스 패턴 구경)
    if (a && a.guard === 'counter') {
      this.endAction(true);
      sc.combat.hitCircle(this.x, this.y, 42 * this.mods.sizeMul, 3, 'fighting', { kbx: 320, kby: -200, hs: 120 });
      sc.fx.ring(this.x, this.y, 42, 0x8ad8ff, 260); sc.fx.floatText(this.x, this.b.y - 10, '카운터!', '#8ad8ff', 12);
      this.inv = .5; Sfx.play('punch');
      return true;
    }
    const m = type === 'none' ? 1 : typeMultiplier(type, this.types);
    const eff = effectiveness(m);
    const d = Math.max(1, Math.round(dmg * m * (this.mega.active ? .8 : 1) * (this.pas.guard || 1) * this.buffMul('guard') * this.mods.guard));
    // 기합의띠(특성 카드): 쓰러질 피해를 체력 1로 버티고 3초 무적 — 방마다 1번 (GameScene.updateRooms 가 되돌린다)
    const sash = this.mods.sturdy && !this.m.sturdyUsed && this.m.hp > 1 && d >= this.m.hp;
    this.m.hp = sash ? 1 : this.m.hp - d;
    sc.fx.floatText(this.x, this.b.y - 2, `-${d}`, eff === 'super' ? '#ff6a4a' : '#ff9a8a', eff === 'super' ? 15 : 12);
    if (eff === 'super') sc.fx.floatText(this.x, this.b.y - 18, '효과가 굉장했다!', '#ffb050', 10);
    this.flash(100); this.hurtT = .25; this.inv = .85;
    sc.fx.hitStop(60); sc.fx.shake(eff === 'super' ? .012 : .007, 160);
    sc.fx.burst(this.x, this.y, [0xff5a5a, 0xffffff], 8, 100);
    const big = eff === 'super' || d >= this.m.maxhp * .22;   // 큰 피격: 더 깊은 충격음 + 더 진한 붉은 테두리
    Sfx.play(big ? 'hurt_big' : 'hurt');
    sc.events.emit('hurt', big ? .9 : .58);   // UIScene: 화면 가장자리 붉은 비네팅 점멸 (충격음과 같은 순간)
    if (o.slow) this.slowT = o.slow;
    if ((!this.mega.active && !this.pas.superArmor) || o.force) {   // 메가·슈퍼아머(애버라스 계열)는 경직·넉백 없음
      const dir = Math.sign(this.x - srcX) || -this.face;
      this.b.setVelocity(dir * 170, -170);
      if (this.action && !this.action.inv) this.endAction(true);
    }
    onHurt(this);   // 특성 카드: 가시 갑옷
    if (sash) {
      this.m.sturdyUsed = true; this.inv = 3;
      sc.fx.floatText(this.x, this.b.y - 20, '기합의띠로 버텼다!', '#ffd25a', 12);
      sc.fx.ring(this.x, this.y, 30, 0xffd25a, 400); sc.fx.glow(this.x, this.y, 36, 0xffd25a, 600, 1); Sfx.play('mega');
    }
    if (this.m.hp <= 0) this.faint();
    return true;
  }

  faint() {
    const sc = this.scene, m = this.m;
    m.hp = 0; m.alive = false;
    sc.fx.burst(this.x, this.y, [typeColor(this.typesOf(m)[0]), 0xffffff], 30, 160, { glow: true });
    sc.events.emit('toast', `${this.form(m).name}은(는) 쓰러졌다!`);
    const next = this.nextAlive(1);
    if (next >= 0) { this.swapTo(next, true); this.inv = 1.5; }
    else sc.gameOver(false);
  }

  destroy() { this.aura.destroy(); this.chgAura.destroy(); super.destroy(); }
}

export { ITEMS };
