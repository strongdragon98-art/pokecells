// 파티(최대 3마리) 컨트롤러: 이동·점프·대시·스킬·실시간 교대(Tag)·진화·영구 메가진화·Z기술·피격
// 성장은 포켓몬마다 따로: 경험치(정화할 때 출전 중이던 포켓몬이 받음) → 2단 → 3단 진화, 장착 아이템, 메가진화(3단 + 메가스톤, V)
// 파티 공용: Z크리스탈(Q Z기술) · 메가스톤 보유 · 가방(장착하지 않은 아이템) · 스테이지 체력 보너스
// p.tier · p.exp · p.items · p.mods · p.mega.active 는 '지금 출전 중인 포켓몬'의 값을 돌려준다 (스킬·전투 코드는 그대로 쓴다)
import Phaser from 'phaser';
import { Actor } from './Actor.js';
import { SPECIES, SKILLS, TAGS, TIERS, EVO_EXP, ZMOVES, Z_CD, XP_RULE, XP_UNITS } from '../data/pokemon.js';
import { FORM_ITEMS } from '../data/roster.js';
import { computeMods, ITEMS, MAX_EQUIP, SIZE_CAP } from '../data/items.js';
import { START_MONEY, USES, VIT_MAX } from '../data/shop.js';
import { ashStarTexture } from '../systems/MegaRig.js';
const HP_SCALE = .85;
import { onHurt, onDash, onParry } from './Perks.js';
import { potionMaxAt, potionHealAt, bondParry, BOND_STRIKE_MUL, BOND_STRIKE_CD } from '../data/bond.js';
import { DANGER_MUL } from './Combat.js';
import { parryStagK } from './ParryRules.js';
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
import { megaUltAction, MEGA_ULT_CD, cinematic, magicCircle, legendFinisher, tierComboFx, magmaEruption, megaSymbol } from './Spectacle.js';
import { archetypeOf } from '../data/moveRules.js';
import { MOVE_DB } from '../data/MoveDatabase.js';
import { onDashTick } from './Perks.js';
import { chargeSigOf } from './Signature.js';
import { Cores } from './Cores.js';
import { usesStone, stoneName, zTypeOf, crystalName } from '../data/gear.js';
import { RES } from '../config.js';

const SWAP_CD = 3;
// 진화 단계별 보이는 크기 (1단 모습 기준): 2단 ×1.32 · 3단 ×1.72 · 메가는 3단의 ×1.1 (거다이맥스처럼 부풀지 않게)
//  모습마다 도트 크기가 제각각이라 1단 도트의 몸 높이(bodyH)에 맞춰 키운다 → 진화할 때마다 확실히 커지고, 거대 도트도 지나치게 커지지 않는다
export const TIER_SIZE = [1, 1.32, 1.72], MEGA_SIZE = 1.1;
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
// Z 홀드 차징 샷: CHG_SHOW 초부터 기운이 모이고, 단계별 시각(초)에 1·2·3단 (2단은 '초고압 차징 코어' 1장 · 3단은 2장 — 고속 축전 코일이면 더 빨리)
const CHG_SHOW = .22, CHG_AT = [.72, 1.45, 2.25];
const DASH_INV_CAP = .6;   // 대시 무적 상한 (도박사의 외줄타기 스텝 2배 · 합성)
export { CHG_SHOW, CHG_AT };   // UIScene 스킬 바: Z 칸의 차징 게이지
// 속성 → 차징 탄 그림 (systems/ProjectileRenderer.js 의 kind)
const CHARGE_KIND = { fire: 'fire', water: 'water', ice: 'bubble', grass: 'leaf', bug: 'leaf', electric: 'bolt', ghost: 'shadow', dark: 'shadow', poison: 'bubble', psychic: 'psyorb',
  rock: 'rock', ground: 'rock', steel: 'steel', fighting: 'wave', normal: 'wave', flying: 'wave', dragon: 'wave', fairy: 'wave' };
// 단계별 차징 탄 (평타 공격력 배율): mul 직격 + boom.mul 대폭발 = 총합 — 1단 350+150 = 500% · 2단 400+250 = 650% · 3단 650+450 = 1,100%
//  모두 잡몹은 무한 관통 · 보스/엘리트는 파고들어 hits 연타 뒤 대폭발 · 투사체 크기 2단 1.8배 · 3단 약 3배
const CHARGE_SHOT = [null,
  { r: 7, mul: 3.5, speed: 360, life: .9, hits: 3, boom: { r: 36, mul: 1.5 }, sfx: 'cshot1', shake: .008 },
  { r: 12.6, mul: 4, speed: 460, life: 1, hits: 4, boom: { r: 58, mul: 2.5 }, sfx: 'cshot2', shake: .013 },
  { r: 21, mul: 6.5, speed: 560, life: 1.25, hits: 5, ghost: true, boom: { r: 104, mul: 4.5 }, sfx: 'cshot3', shake: .024 }];
const PSY_CORE_SIZE = .12;          // 뮤츠의 코어: 차징 샷 크기 +12% (예전 +30% · data/cores.js)
const GRADE_SIZE = .15;             // 유니크 · 전설 기술 카드 시전: 투사체 · 판정 크기 +15% (예전 ×2)
const CHG_FAST = [1, .85, .75, .65];   // 고속 축전 코일(레어) 장 수 → 차징 시간 배율 (-15% · -25% · -35%)
// 평타(Z 연타) 3타 콤보 리듬: 템포를 늦추고(동작 시간 ×COMBO_TEMPO · 공격 속도 약 -33%) 한 방을 키운다 (기본 ×1.35 · 1타 1 → 2타 1.2 → 3타 1.6)
//  3타 피니시 뒤 COMBO_RECOVER 초 숨 고르기 (대시 · 점프 · X · C · 메가 · Z기술 입력으로 즉시 캔슬)
const COMBO_TEMPO = 1.5, COMBO_DMG = 1.35, COMBO_STEP = [1, 1.2, 1.6], COMBO_RECOVER = .42;
// 🏹 원거리 평타 (연타의 1 · 2타가 탄 · 광선을 쏘는 계열): 안전한 거리에서 견제하는 만큼 평타(Z 연타) 피해 ×RANGED_Z_DMG (-22%) — 차징 샷 · X · C 기술에 기대도록
//  🗡️ 그 밖의 근접 평타는 피해 그대로 · 사거리 +40% (game/skills.js 의 Z_REACH) — 1 · 2타 근접 + 3타 탄(파이리 · 꼬부기 · 물짱이 · 뮤츠 …)도 근접형
export const RANGED_Z = new Set(['thundershock', 'mystical_fire', 'water_shuriken', 'leafage', 'bubble_note', 'confusion_orb', 'flame_feather', 'incinerate', 'pound_water', 'mist_ball', 'luster_purge', 'aurora_beam']);
export const RANGED_Z_DMG = .78;
// 공중 평타 체공 (Air Stall): 공중에서 평타(Z 콤보)를 칠 때마다 떨어지던 속도를 끊고 살짝 떠오른 뒤(AIR_HOP) AIR_STALL_T 초 동안 중력이 AIR_STALL_G 배로 준다
//  적에게 맞히면 반동으로 한 번 더 떠오른다(AIR_HIT_HOP) · 한 번 뜬 동안 AIR_STALLS 번(3타 콤보 한 바퀴)까지 온전히, 그 뒤로는 번마다 약해져 자연스럽게 내려앉는다
//  (땅에 닿거나 대시 · 2단 점프를 하면 다시 채워진다 — 허공에서 Z 만 눌러 천장까지 떠오르지 못하게)
const AIR_HOP = 75, AIR_HIT_HOP = 110, AIR_STALL_T = .26, AIR_STALL_G = .18, AIR_STALLS = 3, AIR_FADE = .35;
// 점프 물리 (시원한 공중 기동 개편)
//  JUMP_K: 기본 점프 초기 속도 ×1.25 (포켓몬마다의 jump 값에 곱한다 — 피카츄 315 → 394 px/s)
//  RISE_G: 점프 키를 꾹 누른 채 오르는 동안 중력 ×0.8 (부드럽게 솟는다 — 꾹 누른 1단 점프 약 100px · 예전 51px)
//  FALL_G: 떨어질 땐 중력 ×1.12 (둥실 떠 있지 않고 탁 내려앉는다)
//  JUMP_CUT: 오르다 키를 떼면 위로 가는 속도를 그 점프 처음 속도의 50% 로 끊는다 — 톡 = 낮고 재빠른 소점프(약 26px) · 꾹 = 최대 높이
//  DJ_K: 공중 점프(2단 · 3단)는 1단 점프 높이의 85% (속도 √0.85)
//  FAST_FALL_*: 공중에서 ↓ (조이스틱 아래) — 중력 ×2.6 · 낙하 한도 900px/s · 누르는 순간 최소 220px/s 로 꺾어 내린다
//  LEDGE_SNAP: 발이 벽(타일 옆면) 윗면에서 18px 안쪽 아래에 걸리면 윗면으로 올려 준다 · HEAD_NUDGE: 머리가 천장 모서리에 6px 이내로 걸리면 옆으로 비켜 계속 오른다
//  AIR_ACC: 공중 좌우 가속 = 지상과 같다 (공중 조작 100%)
export const JUMP_K = 1.25, RISE_G = .8, FALL_G = 1.12, JUMP_CUT = .5, DJ_K = Math.sqrt(.85);
const FAST_FALL_G = 2.6, FAST_FALL_V = 900, FAST_FALL_KICK = 220, FALL_MAX = 640, LEDGE_SNAP = 18, HEAD_NUDGE = 6, GROUND_ACC = 1500, AIR_ACC = 1500, WORLD_G = 900;
const GLIDE_V = 75;   // 비행 타입 활공: 점프를 꾹 누르면 이 속도보다 빨리 떨어지지 않는다 (전설은 ×0.7)
// 패링 자세 (지상 ↓ + Z 전용 — 평타에는 패링 판정이 없다): PARRY_WIN 초 동안 몸 둘레 PARRY_R px 의 근접 공격 · 적 투사체를 받아친다
//  헛방이면 WHIFF_T 초 자세 무너짐 + 재사용 PARRY_CD 초 · 성공하면 둘 다 즉시 0 (연속 패링)
//  성공: 피해 무효 + 0.35초 무적 · 투사체 반사(2배 속도 · 250%) · 근접 카운터(충격파 · 보스 그로기 +30 · X·C·필살기 쿨 -2초 · 다음 한 방 확정 치명타)
export const PARRY_WIN = .22, PARRY_R = 70, PARRY_CD = 1.8, WHIFF_T = .45;
// 연속 패링 점감 (parryChainStep): 이 시간(초) 안에 다시 패링하면 연쇄 · n 번째 패링의 반사 피해 배율 · 그로기 누적 배율 (5번째부터 마지막 값)
export const PARRY_CHAIN_T = 2, PARRY_DMG = [1, .65, .4, .25, .15], PARRY_STAG = [1, .6, .35, .15, 0];
const PERFECT_WIN = .25, CHARGE_CRIT = 1.5, MULTI_T = .3;   // 퍼펙트 차징 창(초) · 그때 떼면 피해 ×1.5 (+ 확정 치명타) · 보스/엘리트 다단히트 시간

export class Player extends Actor {
  constructor(scene, partyKeys, x, y) {
    super(scene, null, x, y, 14, 18);
    this.members = partyKeys.map(k => this.makeMember(k));
    this.stored = {};   // 포켓몬센터 보관함에 맡긴 포켓몬 key → 그대로의 상태 (진화 · 경험치 · 장착 아이템 · 기술 · 기술머신 카드). 다시 데려오면 이어서
    this.idx = 0;
    this.buffs = [];                                   // 일시 강화 { atk, speed, guard, t } (출전 포켓몬)
    this.formItems = new Set();                        // 폼체인지 아이템 (큰금강옥·큰백옥·큰백금옥 — data/roster.js 의 FORM_ITEMS, 그 판 동안 파티 공용)
    this.sandT = 0; this.flopT = 0;
    this.bag = {};                                      // 가방: 아무도 장착하지 않은 아이템
    this.candy = 0;                                     // 이상한사탕 (엘리트 처치 보상 · 가방에서 먹인다)
    // 포켓샵 경제 (data/shop.js): 포켓달러 · 금구슬(환금 전용) · 가방 소모품(회복약 · 영양제) · 포켓샵마다의 구매 이력
    this.money = START_MONEY;
    this.orbs = {};                                     // 성수의 구슬 { entei · raikou · suicune: true } — 방울탑 최상층 칠색조의 제단 (game/HoohAltar.js)
    this.nuggets = {};                                  // { tiny_nugget · nugget · big_nugget: 개수 }
    this.uses = {};                                     // { potion · super_potion · … · hp_up …: 개수 }
    this.shopLog = {};                                  // { '지방:시내 방': { 품목 id: 산 개수 } } — 재고 제한
    this.shopStats = { bought: 0, sold: 0, spent: 0, earned: 0 };
    this.inv = 0; this.dash = null; this.dashCd = 0; this.airDash = true; this.swapCd = 0;
    this.launchT = 0;   // 차원 도약 수정으로 솟구치는 중 (launch)
    this.airStalls = 0; this.stallT = 0;   // 공중 평타 체공 횟수 · 남은 저중력 시간 (airStall)
    this.jumpMul = 1; this.liftT = 0;   // 용나선탑: 전자기장 안 점프 배율 · 열기 상승 기류에 실린 중 (Props.updateHeroes)
    this.jumpsUsed = 0; this.coyote = 0; this.jbuf = 0; this.dropT = 0; this.hurtT = 0; this.speedBuff = 0;
    this.action = null; this.combo = 0; this.comboT = 0; this.zBuf = 0;
    this.chg = { t: 0, lvl: 0, st: 0 }; this.diveCd = 0;   // Z 홀드 차징 · 공중 내려찍기
    const self = this;                                 // mega.active = 출전 포켓몬이 메가진화했는가 (포켓몬마다, 그 판 끝까지 유지)
    // 메가스톤 · Z크리스탈 (data/gear.js): 키스톤 · Z링은 파티 공용, 돌·크리스탈은 포켓몬마다 전용 칸 (m.gear)
    this.keyStone = false; this.zRing = false;
    this.stones = new Set();   // 가방의 메가스톤 (계열 id · 아직 아무도 안 낀 것)
    this.crystals = {};        // 가방의 Z크리스탈 { 속성: 개수 }
    this.quests = {};          // 이야기 진행: zTrial (0 없음 · 1 시련 받음 · 2 시련 통과 · 3 Z링 받음) · monk (방울탑 키스톤 받음) …
    //  stones: 지금 출전 포켓몬이 메가진화할 수 있으면 1 (예전 '파티 공용 메가스톤 개수' 자리 — 늘리면 메가스톤을 얻는다)
    this.mega = { get stones() { return self.megaReady() ? 1 : 0; }, set stones(v) { if (v > (self.megaReady() ? 1 : 0)) self.gainStone(); }, get active() { return self.m.mega; }, set active(v) { self.m.mega = v; } };
    //  has: 지금 출전 포켓몬이 Z기술을 쓸 수 있나 (Z링 + 맞는 Z크리스탈 장착) · 참으로 두면 Z링과 크리스탈을 얻는다
    this.z = { cd: 0, get has() { return self.canZ(); }, set has(v) { if (v) self.gainZ(); } };   // Z기술 재사용 대기
    this.stageBonus = 1;                               // 스테이지를 넘을 때마다 최대 체력 ×1.15
    this.intangible = false;
    this.wasGround = false; this.lastVy = 0;
    this.b.setMaxVelocity(700, 640);
    this.b.setCollideWorldBounds(true);
    this.sprite.setDepth(22);
    this.aura = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(21).setVisible(false);
    this.chgAura = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(23).setVisible(false);   // 차징 기운
    // 메가진화 장식: 등 뒤에서 도는 메가 심볼 홀로그램 · 무지갯빛 오라 · 눈빛 (몸을 키우는 대신 이것들로 멋을 낸다)
    this.megaSym = scene.add.image(x, y, megaSymbol(scene)).setBlendMode(Phaser.BlendModes.ADD).setDepth(21.4).setVisible(false);
    this.megaEye = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(22.6).setVisible(false);
    for (const m of this.members) m.maxhp = m.hp = this.maxHpOf(m);   // 모습별 체력 배율(잉어킹 0.55)까지 반영
    this.applyVisual();
  }

  // 파티 한 자리 (포켓몬마다 따로 크는 것들)
  makeMember(k) {
    const sp = SPECIES[k];
    return {
      key: k, sp, maxhp: sp.hp, hp: sp.hp, cd: { z: 0, x: 0, c: 0, r: 0 }, alive: true, cardGrade: {},   // r: 메가 필살기 쿨타임 · cardGrade: 기술 카드로 배운 기술의 등급
      tier: 0, exp: 0, mega: false, megaPick: 0, items: {}, perks: {}, mods: computeMods({}, {}), boostCards: [], boost: {},   // boostCards: 스킬 강화 카드 (data/tm.js BOOSTS)   // perks: 기술머신 특성 카드 (game/Perks.js)
      skills: { ...(sp.evo[0].skills || sp.skills) }, ups: new Set(), atkBonus: 1, cdBonus: 1,   // 기술머신: 바꿔 단 기술 · 받은 강화 카드 · 숙련 보너스
      learned: Object.values(sp.evo[0].skills || sp.skills),   // 배운 기술 전부 (가방 → 기술에서 Z·X·C 자리에 골라 넣는다)
      chargeType: null,   // 차징 샷·내려찍기 속성 (듀얼 타입은 가방에서 두 속성 중 고른다 · null 이면 첫 속성)
      gear: { stone: null, crystal: null },   // 전용 칸: 메가스톤(계열 id) · Z크리스탈(속성)
      vit: {}   // 영양제를 먹은 횟수 { hp · atk · def · cd · spd } (data/shop.js · 영구)
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
  get fxMul() { return this.T.fx * ((this.mega.active ? this.megaOf().fx : this.form().fx) || 1); }   // 스킬 이펙트 크기 배율 (skills.js) · 모습별 fx (갸라도스 등 · data/roster.js)
  // 공격력: 특성 카드(힘·역린)와 구애머리띠(Z칸)·구애안경(X·C칸)은 지금 쓰는 기술 칸을 보고 곱한다
  get atk() {
    const md = this.mods, sl = this.action && this.action.slot, m = this.m;
    const slotMul = sl === 'z' ? md.bandMul : sl === 'x' || sl === 'c' ? md.specsMul : 1, rage = md.berserk && m.hp <= m.maxhp * .5 ? 1 + md.berserk : 1;
    return this.sp.atk * (this.sp.dmgK || 1) * this.T.atk * (m.atkBonus || 1) * this.statOf('atk') * this.buffMul('atk') * md.atkMul * slotMul * rage * (1 + this.bloodK()) * ((this.action && this.action.boostDmg) || 1);   // 스킬 강화 카드: 위력 증폭 · 광전사의 혈투: 잃은 체력만큼
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
  // 상처약 최대 소지 · 회복량 (유대의 불꽃 권능 — data/bond.js) · 패링 판정 시간 (예리한 반사 신경 카드)
  get potionMax() { return potionMaxAt(this.scene.bondStage || 0); }
  get potionHeal() { return potionHealAt(this.scene.bondStage || 0); }
  parryWin() { return PARRY_WIN * (this.mods.parryWinMul || 1); }   // 찰나의 카운터(양날의 검): ×0.65
  // 양날의 검 카드 (game/Perks.js): 광전사의 혈투 — 잃은 체력 비율 × bloodRage 만큼 공격력 · 공격 속도 (최대 +80%, 합성하면 더) · 과부하 차징 캐논 — Z 를 누르고 모으는 중
  bloodK() { const m = this.m, r = this.mods.bloodRage; return r ? r * Phaser.Math.Clamp(1 - m.hp / m.maxhp, 0, 1) : 0; }
  get charging() { return !!(this.chg && this.chg.t >= CHG_SHOW); }
  cdOf(id, m = this.m) { const b = m.boost && m.boost[id]; return SKILLS[id].cd * m.mods.cdMul * (m.cdBonus || 1) * (m.mega ? .8 : 1) * (m === this.m ? Cores.cdMul(this) : 1) * (b ? 1 - Math.min(.6, b.haste) : 1); }   // 스킬 강화 카드: 가속 회로
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
  // HP_SCALE: 상처약 퀵슬롯이 생겨 플레이어블 포켓몬 전체의 기본 최대 체력을 15% 낮췄다 (기존 × 0.85)
  //  최대 체력은 늘 5 단위로 맞춘다 (가장 가까운 5의 배수 · 최소 5)
  maxHpOf(m) { return Math.max(5, Math.round(m.sp.hp * HP_SCALE * this.stageBonus * TIERS[this.tierOf(m)].hp * this.statOf('hp', m) * ((m.mods && m.mods.hpMul) || 1) / 5) * 5); }

  visualKey() {
    const meta = this.scene.registry.get('spriteMeta');
    const mk = this.megaOf().sprite;
    if (this.mega.active && mk && meta[mk] && meta[mk].hasSprite) return mk;
    return this.formKey();
  }

  // 진화할수록 몸집이 조금씩 커진다 (진화형 도트 자체도 크다) + 메가 모습이 없으면 오라와 함께 더 크게
  //  거대 몸집(롱스톤 계열)은 판정도 크게, 전설은 도트 크기와 상관없이 히트박스를 고정한다 (좁은 길·발판을 지나가도록)
  // 퇴화 방지 (안전장치): 포켓몬마다 올라간 최고 진화 단계를 기억해 두고, 어떤 경로로든 그보다 낮아지면 되돌린다
  //  테스트룸의 단계 고르기(setForm)만 일부러 낮출 수 있다
  guardForms() {
    for (const m of [...this.members, ...Object.values(this.stored)]) {
      m.peakTier = Math.max(m.peakTier || 0, m.tier);
      if (m.tier < m.peakTier) {
        console.warn('[보호] 퇴화 시도를 막았다', m.key, m.tier, '→', m.peakTier);
        m.tier = m.peakTier; m.exp = Math.max(m.exp, EVO_EXP[m.tier - 1] || 0); m.maxhp = this.maxHpOf(m); m.hp = Math.min(m.hp, m.maxhp);
      }
    }
  }

  applyVisual() {
    this.guardForms();
    const key = this.visualKey(), mg = this.megaOf(), big = this.pas.big || 1;
    const metas = this.scene.registry.get('spriteMeta'), meta0 = metas[key];
    let scale;
    if (this.sp.legend) {   // 전설은 모습이 하나라 예전 배율 (도트 높이를 맞춘 뒤 단계마다 조금씩) · 폼체인지·메가는 ×1.1
      scale = this.T.size * (this.mega.active ? MEGA_SIZE : 1);
      if (meta0) scale *= Phaser.Math.Clamp(40 / Math.max(10, meta0.height), .55, 1.4);
      scale *= this.sp.size || 1;   // 명성에 맞는 몸집 (칠색조 등 · data/roster.js size)
    } else {
      const k0 = this.sp.evo[0].key, base = metas[k0] && metas[k0].hasSprite ? metas[k0] : metas[this.m.key];
      // 메가 컷아웃 리깅(본가 외형 도트 · 그림이 훨씬 크다): 같은 포켓몬의 지금 진화 모습이 화면에 보이는 키 × MEGA_SIZE 가 되게 맞춘다
      const rig = meta0 && meta0.rigged, fm = rig ? metas[this.formKey()] : meta0;
      const ref = (base && base.bodyH) || 20, now = (fm && fm.bodyH) || ref;
      scale = TIER_SIZE[Math.min(2, this.m.tier)] * (this.mega.active && !rig ? MEGA_SIZE : 1) * ref / Math.max(4, now);
      if (!this.mega.active && this.form().aura) scale *= 1.06;
      scale = Phaser.Math.Clamp(scale, .45, 3.2);
      if (rig && fm) scale *= MEGA_SIZE * fm.height / Math.max(8, meta0.height);
    }
    void mg;
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
  // 📉 경험치 감쇠: 지금 지방에서 몬스터 한 마리가 이 포켓몬에게 주는 경험치 (data/pokemon.js XP_RULE · 3단이면 0)
  //  성도처럼 after3 가 있는 지방: 이 지방에서 이미 3단 진화를 이룬 포켓몬이 있으면 남은 2단 포켓몬은 그 배율로 (두 번째 3단 진화를 막는다)
  xpMulOf(m = this.m) {
    if (m.tier >= EVO_EXP.length) return 0;
    const ci = this.scene.stageIdx || 0, R = XP_RULE[Math.min(ci, XP_RULE.length - 1)];
    if (m.tier >= 1 && R.after3 != null && this.members.some(q => q !== m && q.tier >= 2 && q.evoCi === ci)) return R.after3;
    return R.mul[Math.min(m.tier, R.mul.length - 1)];
  }
  xpRate(m = this.m) { const ci = this.scene.stageIdx || 0; return XP_RULE[Math.min(ci, XP_RULE.length - 1)].base * this.xpMulOf(m); }
  // 몬스터 units 마리분 경험치를 받는다 (엘리트 5 · 중간 보스 8 · 보스 12 · 다시 나타난 본길 몬스터 ×0.25) → 실제로 받은 양
  gainXp(units, m = this.m) {
    const n = units * this.xpRate(m);
    if (n > 0) this.addExp(n, m);
    return n;
  }
  // 다음 진화까지 진행도 0~1 (3단 이후 1)
  expProgress(m = this.m) {
    if (m.tier >= EVO_EXP.length) return 1;
    const lo = m.tier ? EVO_EXP[m.tier - 1] : 0;
    return Phaser.Math.Clamp((m.exp - lo) / (EVO_EXP[m.tier] - lo), 0, 1);
  }
  expToNext(m = this.m) { return m.tier >= EVO_EXP.length ? 0 : Math.max(0, Math.ceil(EVO_EXP[m.tier] - m.exp - 1e-6)); }   // 경험치는 소수(감쇠)로 쌓인다 — 남은 양은 올림

  evolve(m = this.m) {
    if (m.tier >= EVO_EXP.length) return;
    const sc = this.scene, before = this.form(m).name, prev = this.form(m), atk0 = this.statOf('atk', m);
    m.tier++;
    m.peakTier = Math.max(m.peakTier || 0, m.tier);
    m.exp = Math.max(m.exp, EVO_EXP[m.tier - 1]);
    if (m.tier >= 2 && m.evoCi == null) m.evoCi = sc.stageIdx || 0;   // 3단 진화를 이룬 지방 (성도: 남은 2단 포켓몬 경험치 5% — xpMulOf)
    if (sc.saveRun) sc.time.delayedCall(1600, () => { if (sc.player === this) sc.saveRun(true, 'evolve'); });   // 진화는 바로 저장 (새로고침·튕김에도 1단으로 돌아가지 않게 · 보스전 중이면 끝난 뒤 정화 저장에 담긴다)
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
  //  지금 지방 몬스터 XP_UNITS.candy 마리분 경험치 (진화 단계 감쇠를 같이 받는다 — 관동에서 2단에게 먹여도 3단은 멀다). 3단(최종)이면 체력을 모두 회복하고 공격력 +3%
  feedCandy(m) {
    if (!this.candy) return null;
    this.candy--;
    if (m.tier >= EVO_EXP.length) { m.atkBonus = (m.atkBonus || 1) * 1.03; m.alive = true; m.hp = m.maxhp; return { maxed: true }; }
    const t0 = m.tier, gain = Math.round(this.gainXp(XP_UNITS.candy, m) * 10) / 10;
    return { gain, evolved: m.tier > t0, low: this.xpMulOf(m) < .2 };
  }

  // ---------------- 메가스톤 · Z크리스탈 (data/gear.js) ----------------
  // 이 포켓몬이 지금 메가진화(폼체인지)할 수 있게 갖췄나: 폼체인지 전설은 그 아이템 · 나머지는 키스톤 + 자기 메가스톤 장착
  megaReady(m = this.m) {
    const want = m.sp.megas[m.megaPick || 0] || m.sp.megas[0];
    if (want && want.item) return this.formItems.has(want.item);
    return this.keyStone && !!m.sp.megas.length && m.gear.stone === m.key;
  }
  canZ(m = this.m) { return this.zRing && m.gear.crystal === zTypeOf(m.key); }
  // 메가스톤 얻기: line 계열의 돌 (안 주면 출전 포켓몬 → 돌이 없는 다른 파티 포켓몬 순). 그 계열이 파티에 있으면 바로 낀다
  //  반환: 얻은 계열 id (줄 게 없으면 null)
  gainStone(line = null) {
    if (!line) line = [this.m, ...this.members].map(m => m.key).find(k => usesStone(k) && !this.stones.has(k) && !this.members.some(m => m.key === k && m.gear.stone === k) && !(this.stored[k] && this.stored[k].gear.stone === k));
    if (!line || !usesStone(line)) return null;
    const m = this.members.find(q => q.key === line) || this.stored[line];
    if (m && !m.gear.stone) m.gear.stone = line; else this.stones.add(line);
    return line;
  }
  // Z링 + 파티 포켓몬들의 Z크리스탈 (빈 칸이면 바로 낀다)
  gainZ() {
    this.zRing = true;
    for (const m of this.members) this.gainCrystal(zTypeOf(m.key));
  }
  gainCrystal(type) {
    const m = this.members.find(q => !q.gear.crystal && zTypeOf(q.key) === type);
    if (m) m.gear.crystal = type; else this.crystals[type] = (this.crystals[type] || 0) + 1;
    return type;
  }
  // 전용 칸 끼우기 · 빼기 (가방 ↔ 포켓몬)
  equipStone(m) {
    if (m.gear.stone || !this.stones.has(m.key)) return false;
    this.stones.delete(m.key); m.gear.stone = m.key; return true;
  }
  unequipStone(m) {
    if (!m.gear.stone) return false;
    if (m.mega && m === this.m) return false;   // 메가진화 중엔 뺄 수 없다
    this.stones.add(m.gear.stone); m.gear.stone = null; return true;
  }
  equipCrystal(m, type) {
    if (!this.crystals[type]) return false;
    if (m.gear.crystal) this.crystals[m.gear.crystal] = (this.crystals[m.gear.crystal] || 0) + 1;
    if (--this.crystals[type] <= 0) delete this.crystals[type];
    m.gear.crystal = type; return true;
  }
  unequipCrystal(m) {
    if (!m.gear.crystal) return false;
    this.crystals[m.gear.crystal] = (this.crystals[m.gear.crystal] || 0) + 1; m.gear.crystal = null; return true;
  }
  // 테스트룸: 키스톤 · Z링 · 파티 모두의 메가스톤과 Z크리스탈을 끼워 준다
  grantAll() {
    this.keyStone = true; this.zRing = true;
    for (const m of this.members) { if (usesStone(m.key)) m.gear.stone = m.key; m.gear.crystal = zTypeOf(m.key); }
  }
  stoneLabel(line) { return stoneName(line); }
  crystalLabel(type) { return crystalName(type); }

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
  refreshMods(m) { m.mods = computeMods(m.items, m.perks, m.vit); this.recalcHp(0, m); }

  // ---------------- 가방 소모품 (포켓샵에서 산 회복약 · 기력의조각 · 영양제) ----------------
  //  반환: { ok, msg } — 못 쓰면 ok 거짓과 까닭
  useItem(id, m) {
    const u = USES[id];
    if (!u || !(this.uses[id] > 0) || !m) return { ok: false, msg: '가방에 없다' };
    let msg;
    if (u.cat === 'revive') {
      if (m.alive) return { ok: false, msg: `${this.formName(m)}은(는) 쓰러지지 않았다` };
      m.alive = true; m.hp = Math.max(1, Math.round(m.maxhp * u.revive));
      msg = `${this.formName(m)}이(가) 기운을 되찾았다! (체력 ${Math.round(u.revive * 100)}%)`;
    } else if (u.cat === 'heal') {
      if (!m.alive) return { ok: false, msg: '쓰러진 포켓몬은 기력의조각으로 깨워야 한다' };
      if (m.hp >= m.maxhp) return { ok: false, msg: `${this.formName(m)}의 체력은 이미 가득하다` };
      const heal = id === 'potion' ? this.potionHeal * (1 - ((m.mods && m.mods.potionCut) || 0)) : u.heal;   // 상처약은 퀵슬롯과 같은 회복량 (유대의 불꽃 · 광전사의 혈투)
      const n = Math.round(Math.min(m.maxhp - m.hp, m.maxhp * heal));
      m.hp += n;
      msg = `${this.formName(m)}의 체력이 ${n} 회복됐다`;
    } else {
      const k = u.vit, have = (m.vit && m.vit[k]) || 0;
      if (have >= VIT_MAX) return { ok: false, msg: `${this.formName(m)}은(는) ${u.name}을(를) 더 먹을 수 없다 (${VIT_MAX}번 최대)` };
      m.vit = { ...(m.vit || {}), [k]: have + 1 };
      this.refreshMods(m);
      msg = `${this.formName(m)}이(가) ${u.name}을(를) 먹었다! ${u.desc.split(' (')[0]} (${have + 1}/${VIT_MAX})`;
    }
    if (--this.uses[id] <= 0) delete this.uses[id];
    return { ok: true, msg };
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
    Cores.tick(this, dt);
    const sc = this.scene, b = this.b, sp = this.sp;
    this.lastInput = inp;
    this.potionCd = Math.max(0, (this.potionCd || 0) - dt);   // 상처약 퀵슬롯 재사용 (GameScene.quickPotion)
    this.zLock = Math.max(0, (this.zLock || 0) - dt); this.parryCd = Math.max(0, (this.parryCd || 0) - dt);   // 3타 후딜레이 · 패링 재사용 대기
    this.galeT = Math.max(0, (this.galeT || 0) - dt); this.dashEvadeT = Math.max(0, (this.dashEvadeT || 0) - dt);   // 질풍의 추진력 · 대시 회피 판정
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
    this.updateMegaDeco();
    this.updateAshStar(dt);

    // 교대
    if (!this.dash) {
      let target = -1;
      if (inp.s1) target = 0; else if (inp.s2) target = 1; else if (inp.s3) target = 2;
      else if (inp.swapNext) target = this.nextAlive(1); else if (inp.swapPrev) target = this.nextAlive(-1);
      if (target >= 0 && target !== this.idx) this.swapTo(target);
    }
    if (inp.mega) this.startMega(inp.up ? 1 : 0);   // ↑ + V : 두 번째 메가 (메가리자몽Y · 메가뮤츠Y)
    if (inp.zmoveP) this.useZMove();
    if (inp.ultP) this.useMegaUlt();

    // 대시(회피) — 파괴광선 반동 등(action.noDash)은 끊을 수 없다. 랄토스 계열은 순간이동
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (inp.dashP && this.dashCd <= 0 && !this.dash && (this.onGround || this.airDash || this.airDashX > 0) && !(this.action && this.action.noDash)) {
      if (!this.onGround) { if (this.airDash) this.airDash = false; else this.airDashX--; this.airStalls = 0; }   // 공중 대시: 공중 평타 체공 횟수를 다시 채운다 · 공중 기동 부스터 카드는 한 번 더 (airDashX)
      if (this.action) this.endAction(true);   // 스킬의 end() 로 남은 이펙트·상태를 정리
      this.dash = { t: 0, dir: dir || this.face };
      this.face = this.dash.dir; this.refacing();
      const dinv = Math.min(DASH_INV_CAP, (.26 + this.mods.dashInvAdd) * (1 + (this.mods.dashInvX || 0)));   // 도박사의 외줄타기 스텝(양날의 검): 무적 2배 (최대 DASH_INV_CAP 초)
      this.dashCd = .55 * this.mods.dashCdMul; this.inv = Math.max(this.inv, dinv);
      this.dashEvadeT = dinv; this.evadeReady = !!this.mods.dashReload;   // 전술 재장전 스텝: 이 무적 동안 공격을 피하면 (takeHit)
      if (this.mods.dashCrit) { this.critNext = sc.time.now + this.mods.dashCrit * 1000; sc.fx.ring(this.x, this.y, 18, 0xff3a5a, 220); }   // 도박사의 외줄타기 스텝: 대시 뒤 dashCrit 초 안의 다음 한 방은 확정 치명타 (Combat.damageEnemy critNext)
      onDash(this, this.dash);   // 특성 카드: 대시 폭탄 · 분신 대시
      Cores.dash(this);         // 보스의 코어: 분화 용암 · 깨어진 세계로 잠복
      if (this.pas.teleport) this.teleport(this.dash);
      else { Sfx.play('dash'); this.squash(1.3, .75); }
    }

    // 공중 내려찍기: 공중에서 ↓ + Z (모든 포켓몬 공통) — 바닥을 강타하는 충격파 · 적 머리 밟기 · 위기 탈출
    //  ↓ + ← · → (조이스틱은 수평보다 아래 어느 쪽이든)이면 그 방향으로 대각선 강하
    const diveAim = inp.diveAim || ((inp.downAim ?? inp.down) ? { x: dir, y: 1 } : null);
    // 지상 ↓ + Z: 패링 자세 (평타 콤보 중에도 끊고 들어간다 · 자세 무너짐 · Z기술 중엔 안 된다)
    if (inp.zP && (inp.parryAim ?? inp.downAim ?? inp.down) && this.onGround && !this.dash && (!this.action || this.action.comboStep)) {   // parryAim: 조이스틱 아래 45°~135° (GameScene.readInput)
      inp.zP = false; this.zBuf = 0;
      this.startParry();
    }
    this.drawParryGauge(dt);
    if (inp.zP && diveAim && !this.onGround && !this.dash && this.diveCd <= 0 && !(this.action && (this.action.dive || this.action.noDash || this.action.slot === 'zmove'))) {
      inp.zP = false; this.zBuf = 0;
      this.startDive(diveAim);
    }
    this.updateCharge(dt, inp);
    // 스킬 (Z는 입력 버퍼로 콤보) · 3타 뒤 숨 고르기는 대시 · 점프 · X · C · 메가 · Z기술로 캔슬 (평캔)
    if (inp.zP) this.zBuf = .25;
    if (this.zLock > 0 && (this.dash || inp.dashP || inp.jumpP || inp.xP || inp.cP || inp.mega || inp.zmoveP || inp.ultP)) this.zLock = 0;
    if (!this.dash && (!this.action || this.action.cancel)) {
      if (inp.cP) this.useSkill('c');
      else if (inp.xP) this.useSkill('x');
      else if (this.zBuf > 0 && !this.action && !(this.zLock > 0 && this.isCombo('z'))) { this.zBuf = 0; this.useSkill('z'); }
    }

    // 수평 이동
    const a = this.action;
    const slow = (this.slowT || 0) > 0 ? .6 : 1;
    this.slowT = (this.slowT || 0) - dt;
    this.windT = (this.windT || 0) - dt;
    if (this.flipT > 0 && (this.flipT -= dt) <= 0) { this.b.setGravityY(0); this.sprite.setFlipY(false); }
    if (this.launchT > 0 && ((this.launchT -= dt) <= 0 || this.b.velocity.y >= 0)) { this.launchT = 0; this.b.setMaxVelocity(700, 640); }   // 꼭대기에 닿으면 원래 낙하 속도 한도로
    if (this.stallT > 0 && ((this.stallT -= dt) <= 0 || this.onGround || this.flipT > 0)) { this.stallT = 0; if (!(this.flipT > 0)) this.b.setGravityY(0); }   // 공중 평타 저중력이 끝났다
    const speed = sp.speed * this.mods.speedMul * (this.speedBuff > 0 ? 1.25 : 1) * (this.galeT > 0 ? 1 + .05 * (this.mods.dashGale || 1) : 1) * (this.mods.chargeSlow && this.charging ? 1 - this.mods.chargeSlow : 1) * slow * (this.mega.active ? 1.1 : 1) * this.statOf('speed') * this.buffMul('speed') * Cores.speedMul(this);
    if (this.dash && this.dash.tele) {   // 순간이동: 이미 옮겨졌다. 잠깐 멈춰 잔상만 남긴다
      this.dash.t += dt;
      b.setAllowGravity(false); b.setVelocity(0, 0);
      if (this.dash.t >= .12) { this.dash = null; b.setAllowGravity(true); }
    } else if (this.dash) {
      this.dash.t += dt;
      b.setAllowGravity(false); b.setVelocity(this.dash.dir * 330 * (1 + (this.mods.dashDist || 0)), 0);   // 잔상 회피 카드: 대시 거리 +12%
      this.dash.gt = (this.dash.gt || 0) - dt;
      if (this.dash.gt <= 0) { this.dash.gt = .025; sc.fx.ghost(this.sprite, typeColor(this.types[0]), .55, 240); }
      onDashTick(this, this.dash, dt);   // 대시 진화 카드 (game/Perks.js): 아쿠아 제트 다단히트 · 화염 길 …
      if (this.dash.t >= .19) { this.dash = null; b.setAllowGravity(true); b.setVelocityX(b.velocity.x * .45); }
    } else if (a && a.ctrl) {
      b.setAllowGravity(!a.noGrav);
    } else {
      b.setAllowGravity(!(a && a.noGrav));
      const mm = a ? (a.mm ?? .3) : 1;
      const target = dir * speed * mm + (this.windT > 0 ? this.windV : 0), acc = (this.onGround ? GROUND_ACC : AIR_ACC) * dt, v = b.velocity.x;   // 공중에서도 지상과 같은 속도 · 같은 가속 (공중 조작 100%)   // 칠색조 폭풍 날개짓 등 바람에 밀린다
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
    if (ground) { this.coyote = .1; this.jumpsUsed = 0; this.airDash = true; this.airDashX = Math.floor(this.mods.extraAirDash || 0); this.airStalls = 0; this.jumpRise = false; } else this.coyote -= dt;
    if (inp.jumpP) { this.jbuf = .12; this.jbufDown = !!(inp.downAim ?? inp.down); } else this.jbuf -= dt;
    if (this.jbuf > 0 && !this.dash && !(a && a.mm === 0)) {
      // 하향 점프(↓ + 점프)는 일반 점프와 완전히 따로: 이 분기에 들어오면 위로 뛰는 점프는 절대 하지 않는다
      //  · 통과 발판 위: 0.25초 동안 발판 충돌을 끄고 부드럽게 아래로 (위로 튀지 않는다)
      //  · 단단한 바닥 위 · 이미 떨어지는 중: 아무 일도 없다 (위아래로 떨리지 않게)
      if (this.jbufDown || inp.downAim || this.dropT > 0) {
        this.jbuf = 0;
        if (ground && this.dropT <= 0 && sc.standingOnPlatform(this)) { this.dropT = .25; this.coyote = 0; b.setVelocityY(120); b.y += 2; }
      }
      else if (ground || this.coyote > 0) { this.jump(sp.jump * JUMP_K, false); }
      else if (this.jumpsUsed < this.maxJumps()) { this.jump(sp.jump * JUMP_K * DJ_K, true); }   // 2단 점프 (모든 포켓몬 기본) · 3단 점프 (비상의 깃털 · 날개 달린 계열)
    }
    if (this.liftT > 0) this.liftT -= dt;
    // 가변 점프: 점프로 오르던 중 키를 떼면 한 번 끊는다 (톡 = 소점프) · 점프가 아닌 위로 튕김(스킬 · 반동)은 예전처럼 서서히 죽인다
    if (b.velocity.y >= 0) this.jumpRise = false;
    if (!inp.jumpH && b.velocity.y < -60 && !(a && a.ctrl) && !(this.launchT > 0) && !(this.liftT > 0)) {
      if (this.jumpRise) { b.setVelocityY(Math.max(b.velocity.y, -this.jumpV0 * JUMP_CUT)); this.jumpRise = false; }
      else b.setVelocityY(b.velocity.y * .86);
    }
    const hover = sp.hover || (this.pas.hoverForm !== undefined && this.form().fi >= this.pas.hoverForm);
    if (hover && inp.jumpH && b.velocity.y > 40 && !this.dash) b.setVelocityY(40);              // 고오스·망나뇽·전설 부유
    // 비행 타입 활공: 떨어지는 중에 점프를 꾹 누르면 날개를 펴고 천천히 내려온다 (전설은 더 느리게) · 공중 날갯짓도 한 번 더 (maxJumps)
    const glide = !hover && this.flyer && inp.jumpH && !ground && !this.dash && !(a && (a.ctrl || a.dive));
    if (glide && b.velocity.y > GLIDE_V * (sp.legend ? .7 : 1)) {
      b.setVelocityY(GLIDE_V * (sp.legend ? .7 : 1));
      if ((this.glideT = (this.glideT || 0) - dt) <= 0) { this.glideT = .09; sc.fx.burst(this.x - this.face * 8, this.y, [typeColor(this.types[0]), 0xffffff], 1, 30, { angle: -Math.PI / 2, spread: 1.4, up: 10, grav: 60, bounce: false, glow: true, life: .45, size: 1 }); }
    }
    this.airGravity(dt, inp, a, ground, hover || glide);
    if (!ground) this.ledgeAssist(dt, dir, a);

    // 행동 진행 (스라크 계열은 모든 행동이 빠르다)
    if (a) {
      a.t += dt * (this.pas.atkSpeed || 1) * (this.boltT > 0 ? 1.4 : 1) * (a.gale ? 1.5 : 1) * this.cardSpeed(a);   // 질풍의 추진력: 대시 뒤 첫 평타 1.5배 · 광전사의 혈투 · 초중량 일격 (cardSpeed)   // 제크로무의 뇌격 코어: 패링 뒤 5초간 공격 속도 +40%
      if (a.update) a.update(this, a, dt);
      while (a.ev && a.evi < a.ev.length && a.t >= a.ev[a.evi][0]) { a.ev[a.evi][1](); a.evi++; }
      if (this.action === a && a.t >= a.dur) this.endAction();
    }

    // 착지 스쿼시
    if (ground && !this.wasGround && this.lastVy > 160) { this.squash(1.32, .72); sc.fx.burst(this.x, this.bottom - 1, 0xc8c0e0, 6, 60, { up: 30, life: .3 }); Sfx.play('land'); }
    this.wasGround = ground; this.lastVy = b.velocity.y; if (Math.abs(b.velocity.x) > 20) this.moveVx = b.velocity.x;   // 벽에 막혀 0 이 된 뒤에도 어느 쪽으로 가던 중인지 (모서리 오르기)

    // 낙사 방지
    if (this.b.y > sc.level.height + 40) { this.b.reset(this.safeX ?? this.x, (this.safeY ?? 100) - 20); this.takeHit(this.m.maxhp * .1, 'none', this.x, { force: true }); }
    if (ground && !sc.standingOnPlatform(this)) { this.safeX = this.x; this.safeY = this.bottom - this.b.height / 2; }

    this.updateAnim(dt);
  }

  // 공중 점프 포함 최대 점프 횟수: 모든 포켓몬 2단 기본 · 날개 달린 계열(jumps 3) · 비상의 깃털 카드(extraJumps)마다 +1 (3단 점프)
  maxJumps() { return Math.max(2, this.sp.jumps || 2) + (this.mods.extraJumps || 0) + (this.flyer ? 1 : 0); }
  // 비행 타입 (지금 모습 · 메가 포함): 날갯짓 +1 · 활공
  get flyer() { return this.types.includes('flying'); }
  jump(v, air) {
    const v0 = v * (this.jumpMul || 1) * (1 + (this.mods.jumpAdd || 0));   // 용나선탑 전자기장 안: 1.5배 높이 · 순발력 강화 카드: 점프력 +4%
    this.b.setVelocityY(-v0);
    this.jumpV0 = v0; this.jumpRise = true;   // 가변 점프: 키를 떼면 이 속도의 JUMP_CUT 배로 끊는다
    this.jumpsUsed = air ? this.jumpsUsed + 1 : 1;
    if (air) this.airStalls = 0;   // 2단 점프: 공중 평타 체공 횟수를 다시 채운다
    this.coyote = 0; this.jbuf = 0; this.ffKick = false;
    this.squash(.72, 1.32);
    if (air) { this.airJumpFx(this.jumpsUsed); Sfx.play('djump'); }
    else { this.scene.fx.burst(this.x, this.bottom - 1, 0xd0c8e8, 5, 50, { up: 20, life: .3 }); Sfx.play('jump'); }
  }
  // 공중 도약 파동: 발밑에 뭉게구름이 좌우로 터지고, 그 포켓몬 속성 빛깔의 납작한 파동 고리가 퍼진다 (3단 점프부터는 금빛 고리를 한 겹 더)
  airJumpFx(n) {
    const sc = this.scene, x = this.x, y = this.bottom + 1, col = typeColor(this.types[0]);
    sc.fx.burst(x, y, [0xffffff, 0xeef2fa, 0xd4dcec], 9, 75, { angle: 0, spread: Math.PI, up: 6, grav: -20, bounce: false, life: .38, size: 3, drag: .9 });
    sc.fx.burst(x, y, [col, 0xffffff], 6, 55, { angle: Math.PI / 2, spread: .9, up: 0, grav: 40, bounce: false, glow: true, life: .3, size: 1 });
    for (let k = 0; k < 3; k++) {   // 뭉게구름 세 덩이 (가운데 큰 덩이 + 양옆 작은 덩이)
      const puff = sc.add.ellipse(x + (k - 1) * 7, y - 1, k === 1 ? 14 : 9, k === 1 ? 7 : 5, 0xffffff, .85).setDepth(21.5);
      sc.tweens.add({ targets: puff, x: x + (k - 1) * 13, scaleX: 1.7, scaleY: 1.3, alpha: 0, duration: 300 + k * 30, ease: 'Quad.easeOut', onComplete: () => puff.destroy() });
    }
    const wave = sc.add.ellipse(x, y, 12, 4, col, .75).setDepth(21.4).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: wave, scaleX: 3.4, scaleY: 2, alpha: 0, duration: 280, ease: 'Cubic.easeOut', onComplete: () => wave.destroy() });
    sc.fx.ring(x, y, 11, col, 220);
    if (n >= 3) sc.fx.ring(x, y, 16, 0xffe07a, 260);
  }
  // 공중 중력 조절 (월드 중력 900 위에 덧붙인다): 꾹 눌러 오르는 동안 ×RISE_G · 떨어질 땐 ×FALL_G · ↓ 급강하는 ×FAST_FALL_G (낙하 한도 900)
  //  대시 · 조작형 행동 · 무중력 행동 · 공중 평타 체공 · 중력 반전 · 도약 수정 · 상승 기류 · 부유 중엔 손대지 않는다
  airGravity(dt, inp, a, ground, hover) {
    const b = this.b, vy = b.velocity.y;
    const free = !ground && !this.dash && !(a && (a.ctrl || a.noGrav || a.dive)) && !(this.stallT > 0) && !(this.flipT > 0) && !(this.launchT > 0) && !(this.liftT > 0) && b.allowGravity;
    const down = !!(inp.downAim ?? inp.down);
    let ff = false;
    if (free && down && !(hover && inp.jumpH) && vy > -120) {   // 급강하: 꼭대기 근처 · 떨어지는 중에 ↓
      ff = true;
      if (!this.ffKick) { this.ffKick = true; if (vy < FAST_FALL_KICK) b.setVelocityY(FAST_FALL_KICK); this.scene.fx.ghost(this.sprite, typeColor(this.types[0]), .35, 160); }
      b.setVelocityY(b.velocity.y + WORLD_G * (FAST_FALL_G - 1) * dt);
      if ((this.ffT = (this.ffT || 0) - dt) <= 0) { this.ffT = .05; this.scene.fx.ghost(this.sprite, typeColor(this.types[0]), .22, 140); }
    } else if (free) {
      if (!down) this.ffKick = false;
      if (vy < 0 && this.jumpRise && inp.jumpH) b.setVelocityY(vy - WORLD_G * (1 - RISE_G) * dt);   // 부드럽게 솟는다 (중력 덜 받기)
      else if (vy > 0 && !(hover && inp.jumpH)) b.setVelocityY(vy + WORLD_G * (FALL_G - 1) * dt);
    } else if (ground) this.ffKick = false;
    if (!(this.launchT > 0)) b.maxVelocity.y = ff ? FAST_FALL_V : FALL_MAX;
    this.fastFalling = ff;
  }
  // 벽처럼 막는 칸인가 (부유섬처럼 아래에서 뚫고 오르는 통과 지형은 벽이 아니다 — GameScene.isWallAt)
  wallAt(x, y) { const sc = this.scene; return sc.isWallAt ? sc.isWallAt(x, y) : sc.isSolidAt(x, y); }
  // 몸통(발바닥 by)이 x 쪽에 들어갈 자리가 비었나
  roomFor(x0, x1, by) {
    const h = this.b.height;
    for (const yy of [by - 1, by - h * .5, by - h + 1]) for (const xx of [x0 + 1, (x0 + x1) / 2, x1 - 1]) if (this.wallAt(xx, yy)) return false;
    return true;
  }
  // 모서리 자동 오르기 (Ledge Mantle) · 천장 모서리 비켜 오르기 (Corner Correction) · 통과 발판 꼭대기 보정
  //  ① 공중에서 벽(타일 옆면)에 막혔는데 발이 그 벽 윗면에서 LEDGE_SNAP(18px) 안쪽 아래에 있으면 윗면으로 사뿐히 올려 세운다
  //  ② 오르다 머리가 천장 모서리에 HEAD_NUDGE(6px) 이내로만 걸렸으면 옆으로 비켜 주고 속도를 되살린다
  //  ③ 통과 발판(부유섬 윗면 포함)을 뚫고 오르다 꼭대기에서 발이 그 윗면 18px 안쪽 아래에 멈추면 위에 올려 세운다
  ledgeAssist(dt, dir, a) {
    const b = this.b, sc = this.scene;
    if (this.dash || (a && (a.ctrl || a.noGrav || a.dive)) || this.flipT > 0 || this.dropT > 0 || this.intangible) return;
    const T = 16, land = (ny, nx) => {
      b.y = ny - b.height - .05; if (nx != null) b.x = nx;
      b.setVelocityY(0); this.jumpRise = false; this.coyote = .1;
      b.blocked.left = b.blocked.right = false;
      this.squash(1.18, .86);
      sc.fx.burst(this.x, ny - 1, 0xd8d0e8, 4, 40, { up: 18, life: .25 });
    };
    // ① 벽 모서리
    const side = b.blocked.right ? 1 : b.blocked.left ? -1 : 0;
    if (side && (dir === side || (b.velocity.y < 0 && Math.sign(this.moveVx || 0) === side)) && b.velocity.y < 460) {
      const wx = side > 0 ? b.right + 2 : b.x - 2, foot = b.bottom - 1;
      if (this.wallAt(wx, foot)) {
        let ty = Math.floor(foot / T);
        while (ty > 0 && this.wallAt(wx, (ty - 1) * T + 2)) ty--;
        const top = ty * T, dy = b.bottom - top;
        if (dy > 0 && dy <= LEDGE_SNAP) {
          const nx = b.x + side * 5;
          if (this.roomFor(nx, nx + b.width, top)) { land(top, nx); return; }
        }
      }
    }
    // ② 천장 모서리
    if (b.blocked.up && (this.lastVy || 0) < -80) {
      const hy = b.y - 2, L = this.wallAt(b.x + 1, hy), R = this.wallAt(b.right - 1, hy);
      if (L !== R) {
        const nx = L ? (Math.floor((b.x + 1) / T) + 1) * T + .1 : Math.floor((b.right - 1) / T) * T - b.width - .1, d = nx - b.x;
        if (Math.abs(d) <= HEAD_NUDGE && this.roomFor(nx, nx + b.width, b.bottom) && !this.wallAt(nx + 1, hy) && !this.wallAt(nx + b.width - 1, hy)) {
          b.x = nx; b.setVelocityY(this.lastVy); b.blocked.up = false;
          return;
        }
      }
    }
    // ③ 통과 발판 꼭대기 (오르다 막 멈춘 순간)
    if (b.velocity.y > -40 && b.velocity.y < 60 && (this.lastVy || 0) < 0 && sc.oneWayTopAt) {
      const fr = Math.floor((b.bottom - 1) / T);
      for (const ty of [fr, fr - 1]) {
        const top = ty * T, dy = b.bottom - top;
        if (dy <= 0 || dy > LEDGE_SNAP) continue;
        for (const xx of [b.x + 3, b.x + b.width / 2, b.right - 3]) if (sc.oneWayTopAt(xx, top + 2) && this.roomFor(b.x, b.right, top)) { land(top); return; }
      }
    }
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

  // 포켓몬센터 보관함: i번째 자리를 다른 포켓몬으로 (메가스톤·Z크리스탈·가방은 파티 공용이라 그대로)
  //  떠나는 포켓몬은 보관함에 맡긴다 — 진화 단계 · 경험치 · 장착 아이템 · 기술 · 기술머신 카드를 그대로 기억하고, 다시 데려오면 그 상태로 돌아온다
  //  (예전엔 떠나는 포켓몬을 버리고 다시 데려오면 1단부터 새로 만들어, 라우드본이 뜨아거로 돌아가고 아이템이 풀렸다)
  //  처음 데려오는 포켓몬만 1단부터
  replaceMember(i, key) {
    if (!SPECIES[key] || this.members.some(m => m.key === key)) return false;
    const kept = this.stored[key], old = this.members[i];
    const m = kept || this.makeMember(key);
    delete this.stored[key];
    if (old) { if (this.mega.active && i === this.idx) old.mega = false; old.cd = { z: 0, x: 0, c: 0, r: 0 }; this.stored[old.key] = old; }
    if (i >= this.members.length) { i = this.members.length; this.members.push(m); } else this.members[i] = m;
    m.maxhp = this.maxHpOf(m);
    m.hp = kept ? Math.max(1, Math.min(m.maxhp, m.hp || m.maxhp)) : m.maxhp; m.alive = true;
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
    m.peakTier = m.tier;   // 테스트룸은 일부러 낮출 수 있다
    m.cd = { z: 0, x: 0, c: 0, r: 0 };
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
      const step = this.combo % 3;
      action = SKILL_IMPL[id](this, step);
      action.comboStep = true;
      if (this.galeHit) { action.gale = true; this.galeHit = false; }   // 질풍의 추진력 카드 (대시 직후 첫 평타)
      this.applyBoost(action, id, step === 2);
      // 묵직한 3타 리듬: 동작은 느리게 · 한 방은 세게 · 3타는 피니시 (강한 넉백 · 역경직 — Combat.damageEnemy)
      action.dur *= COMBO_TEMPO;
      for (const e of action.ev || []) e[0] *= COMBO_TEMPO;
      action.boostDmg = (action.boostDmg || 1) * COMBO_DMG * COMBO_STEP[step];
      if (RANGED_Z.has(id)) { action.zRanged = true; action.boostDmg *= RANGED_Z_DMG; }   // 원거리 평타 -22% · 근접 평타는 사거리 +40% (skills.js zReach)
      if (this.mods.heavyHit) action.boostDmg *= 1 + this.mods.heavyHit;   // 초중량 일격(양날의 검): 평타 1타당 +90% · 보스 경직 (Combat.damageEnemy)
      action.finisher = step === 2;
      if (action.finisher) {
        const t0 = action.ev && action.ev.length ? Math.min(...action.ev.map(e => e[0])) : .05;
        (action.ev = action.ev || []).push([t0 + .01, () => this.finisherFx(action)]);
      }
      // 진화 단계별 평타 강화 (2단 이중 검기 · 3단 거대 검기·균열·전방 웨이브) — 첫 타격 순간에 덧붙인다
      if (this.tierIdx >= 1 && !action.noTierFx) { const t0 = action.ev && action.ev.length ? Math.min(...action.ev.map(e => e[0])) : .05; (action.ev = action.ev || []).push([t0 + .005, () => tierComboFx(this, step)]); }
    } else {
      action = SKILL_IMPL[id](this, 0);
      m.cd[slot] = this.cdOf(id);
      if (this.counterT > this.scene.time.now) { this.counterT = 0; this.counterBuffT = this.scene.time.now + 1500; this.scene.fx.floatText(this.x, this.b.y - 22, '반격의 일격! 피해 +40%', '#ffe36a', 10); }   // 반격의 일격 카드: 패링 뒤 2초 안의 다음 기술 (Combat.damageEnemy)
      // 시전 오라: 기술 속성 색 고리 + 발밑에서 피어오르는 불티 (X·C 기술 공통)
      const col = typeColor(SKILLS[id].type), sc = this.scene;
      sc.fx.ring(this.x, this.y, 22, col, 220); sc.fx.glow(this.x, this.y, 22, col, 180, .6);
      sc.fx.embers(this.x, this.bottom - 4, [col, 0xffffff], 6, { speed: 50 });
      if (this.mods.orbCost && slot !== 'z') this.selfDamage(m.maxhp * .03);
      this.gradeCast(action, id, (m.cardGrade || {})[id]);
      this.applyBoost(action, id, true);
      if (this.mods.skillPow) this.manaDrive(action);   // 마력 폭주 기관(양날의 검)
      Cores.cast(this, id);   // 보스의 코어: 분화 용암 · 델타스트림 · 모래폭풍 검기
      const fk = (this.mega.active ? this.megaOf().fx : this.form().fx) || 1;
      if (fk > 1.2) {   // 거대 이펙트 모습(갸라도스): 기술을 쓸 때마다 포효 — 두 겹 충격파 · 물보라 기둥 · 묵직한 흔들림
        const sc = this.scene;
        sc.fx.ring(this.x, this.y, 30 * fk, col, 260); sc.time.delayedCall(70, () => sc.fx.ring(this.x, this.y, 48 * fk, 0xffffff, 340));
        sc.fx.burst(this.x, this.bottom - 2, [col, 0xbfe8ff, 0xffffff], 22, 220, { angle: -Math.PI / 2, spread: 1.1, up: 260, grav: 600, life: .7, size: 2 });
        sc.fx.shake(.012, 220, 'hit'); Sfx.play('boom');
      }
    }
    this.startAction(action, slot);
    if (combo && !this.onGround) this.airStall(action);
  }

  // 공중 평타 체공: 떨어지던 속도를 끊고 살짝 떠오른 뒤 잠깐 저중력 (AIR_STALLS 번 뒤로는 번마다 AIR_FADE 씩 약해진다)
  airStall(a) {
    if (a.ctrl || a.noGrav || this.flipT > 0 || this.launchT > 0) return;   // 속도를 직접 다루는 기술 · 뒤틀린 중력 · 도약 수정으로 솟구치는 중엔 그대로
    const n = ++this.airStalls, k = n <= AIR_STALLS ? 1 : Math.max(0, 1 - (n - AIR_STALLS) * AIR_FADE);
    if (k <= 0) return;
    a.airK = k;
    this.b.setVelocityY(Math.min(this.b.velocity.y, -AIR_HOP * k));
    this.stallT = AIR_STALL_T * k;
    this.b.setGravityY(-900 * (1 - AIR_STALL_G) * k);   // 월드 중력 900 의 AIR_STALL_G 배만 남긴다
  }
  // 공중 평타가 적에게 맞았다 (Combat.damageEnemy): 반동으로 한 번 더 떠오르고 저중력을 조금 늘린다 (그 평타에 한 번)
  airHitHop() {
    const a = this.action;
    if (!a || !a.comboStep || !a.airK || a.airHop || this.onGround || this.flipT > 0) return;
    a.airHop = true;
    this.b.setVelocityY(Math.min(this.b.velocity.y, -AIR_HIT_HOP * a.airK));
    this.stallT = Math.max(this.stallT, AIR_STALL_T * a.airK);
    this.b.setGravityY(-900 * (1 - AIR_STALL_G) * a.airK);
  }

  // 스킬 강화 카드(data/tm.js BOOSTS): 이 기술을 쓰는 동안 피해 ×(1+위력) · 판정 · 투사체 크기 ×(1+광역) · 분열탄 n갈래 (연타 기본기는 3타째에만)
  applyBoost(action, id, volley) {
    const m = this.m, b = m.boost && m.boost[id];
    if (!b) return;
    if (b.power) action.boostDmg = 1 + b.power;
    if (b.wide) {
      const s0 = m.mods.sizeMul, end0 = action.end;
      m.mods.sizeMul = Math.min(SIZE_CAP, s0 + b.wide);   // 합연산 · 최종 1.45배 상한 (data/items.js) — 기술이 끝나면(끊겨도) 되돌린다
      action.end = (p, a) => { m.mods.sizeMul = s0; if (end0) end0(p, a); };
    }
    if (b.split && volley) {
      const t0 = action.ev && action.ev.length ? Math.min(...action.ev.map(e => e[0])) : .05;
      (action.ev = action.ev || []).push([t0 + .03, () => {
        const sc = this.scene, sk = SKILLS[id], col = typeColor(sk.type), f = this.face, n = Math.round(b.split);
        for (let k = 0; k < n; k++) {
          const a = (k - (n - 1) / 2) * .34;
          sc.combat.spawnProjectile({ owner: 'player', bonus: true, x: this.x + f * 8, y: this.y - 4, vx: Math.cos(a) * f * 300, vy: Math.sin(a) * 300, r: 4 * (1 + (b.wide || 0) * .5), mul: .45 * (1 + (b.power || 0)), type: sk.type, color: col, life: .9, homing: 1.2, pierce: 1 });
        }
        sc.fx.burst(this.x + f * 8, this.y - 4, [col, 0xffffff], 8, 90, { glow: true, life: .3 });
      }]);
    }
  }

  // 기술 카드로 배운 유니크·전설 기술: 시전 연출을 덧씌운다
  //  유니크: 마법진 + 충격파 고리 · 이 기술 동안 투사체·판정 크기 +GRADE_SIZE (예전 ×2 · 다른 크기 증가와 더해 최대 1.45배) · 맞힐 때마다 연쇄 폭발(Combat) · 보랏빛 번짐 · 묵직한 흔들림
  //  전설: 시네마틱 컷인(0.15초 정지 · 화면 어둡게 · 스포트라이트) + 기술 형태·속성에 맞는 초대형 마무리(레이저 · 운석 · 번개 기둥 · 마그마 분출 …)
  gradeCast(action, id, grade) {
    if (grade !== '유니크' && grade !== '전설') return;
    const sk = SKILLS[id], col = typeColor(sk.type), m = this.m, legend = grade === '전설';
    const arch = sk.arch || (MOVE_DB[id] && archetypeOf(MOVE_DB[id], id)) || 'projectile';
    if (legend) cinematic(this, col, sk.name); else magicCircle(this, col);
    const s0 = m.mods.sizeMul;
    m.mods.sizeMul = Math.min(SIZE_CAP, s0 + GRADE_SIZE);   // 합연산 · 상한 — 기술이 끝나면(끊겨도) 되돌린다
    this.castGrade = grade;
    const end0 = action.end;
    action.end = (p, a) => { m.mods.sizeMul = s0; this.castGrade = null; if (end0) end0(p, a); };
    const t0 = action.ev && action.ev.length ? Math.min(...action.ev.map(e => e[0])) : .05;
    (action.ev = action.ev || []).push([t0 + .02, () => {
      this.scene.fx.shake(legend ? .022 : .012, legend ? 420 : 240, 'hit');
      if (legend) legendFinisher(this, sk.type, arch, 1.6);
    }]);
    if (legend) action.inv = Math.max(action.inv || 0, .35);
  }

  // ---------------- 메가 전용 필살기 (R · 모바일 MEGA SKILL) ----------------
  useMegaUlt() {
    const sc = this.scene, m = this.m;
    if (!this.mega.active) { sc.events.emit('toast', '메가 필살기는 메가진화(폼체인지·유대변화) 중에만 쓸 수 있다'); Sfx.play('deny'); return; }
    if ((m.cd.r || 0) > 0) { sc.events.emit('toast', `메가 필살기 재사용까지 ${Math.ceil(m.cd.r)}초`); Sfx.play('deny'); return; }
    if (this.dash) return;
    m.cd.r = MEGA_ULT_CD;
    this.startAction(megaUltAction(this), 'ult');
  }

  // 메가 장식: 등 뒤 메가 심볼 홀로그램(천천히 돈다) · 무지갯빛 오라 · 눈빛
  // 유대변화(지우) 개굴닌자: X · C 기술이나 차징 샷을 쓰면 등에 진 거대 물수리검(원본 도트에 그려져 있다)이 손으로 옮겨 가 날아가는 잔상 (systems/MegaRig.js 그림)
  updateAshStar(dt) {
    const sc = this.scene, a = this.action;
    if (this.visualKey() !== 'greninja-ash' || !this.sprite.visible) { if (this.ashStar) this.ashStar.setVisible(false); this.ashLastAct = a; return; }
    if (a && a !== this.ashLastAct && (a.slot === 'x' || a.slot === 'c' || a.slot === 'charge')) {
      const h = this.sprite.displayHeight, k = Math.max(.3, h / 110);
      if (!this.ashStar) this.ashStar = sc.add.image(this.x, this.y, ashStarTexture(sc)).setDepth(22.5);
      const st = this.ashStar;
      sc.tweens.killTweensOf(st);
      st.setVisible(true).setAlpha(1).setScale(k).setPosition(this.x - this.face * h * .18, this.bottom - h * .7);
      sc.tweens.add({ targets: st, x: this.x + this.face * h * .3, y: this.y - 4, scale: k * 1.6, angle: st.angle + 540 * this.face, duration: 160, ease: 'Quad.easeOut', onComplete: () => sc.tweens.add({ targets: st, alpha: 0, duration: 140, onComplete: () => st.setVisible(false) }) });
    }
    this.ashLastAct = a;
  }

  updateMegaDeco() {
    const on = this.mega.active && this.sprite.visible && this.sprite.alpha > .3, t = this.scene.time.now / 1000;
    this.megaSym.setVisible(on); this.megaEye.setVisible(on);
    if (!on) return;
    const col = Phaser.Display.Color.HSVToRGB((t * .15) % 1, .55, 1).color, h = this.sprite.displayHeight;
    this.megaSym.setPosition(this.x, this.bottom - h * .5).setScale(Math.max(.35, h / 96) * (1 + Math.sin(t * 3) * .04)).setRotation(t * .6).setTint(col).setAlpha(.15 + Math.sin(t * 4) * .05);
    const e = (this.meta && this.meta.eye) || { dx: 4, dy: -16 };
    this.megaEye.setPosition(this.sprite.x + e.dx * this.face * this.sprite.scaleX, this.sprite.y + e.dy * this.sprite.scaleY).setScale(.16, .09).setTint(0xfff0ff).setAlpha(.7 + Math.sin(t * 9) * .3);
    if (Math.random() < .25) this.scene.fx.burst(this.x + (Math.random() - .5) * this.b.width * 1.6, this.bottom - Math.random() * h, [col, 0xffffff], 1, 20, { angle: -Math.PI / 2, spread: .6, up: 30, grav: -30, bounce: false, glow: true, life: .6 });
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
      this.sprite.anims.timeScale = am ? Phaser.Math.Clamp(am.ms * (this.pas.atkSpeed || 1) * this.cardSpeed(a) / (a.dur * 1000), .5, 3.5) : 1;
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
    if (a.comboStep && a.finisher && !interrupted) this.zLock = COMBO_RECOVER + (this.mods.finishLag || 0);   // 3타 뒤 숨 고르기 (초중량 일격: 더 길게)
    if (a.parry) {   // 패링 자세가 끝났다: 실드를 걷고, 아무것도 받아치지 못했으면 헛방
      if (this.parryFx) { const g = this.parryFx; this.parryFx = null; this.scene.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() }); }
      if (!a.parried) this.parryWhiff();
    }
  }

  // 3타 피니시 연출: 근접형은 전방 내려찍기 충격 + 바닥 파편 · 원거리형은 발사 반동 (강화 관통탄은 Combat.spawnProjectile)
  finisherFx(a) {
    const sc = this.scene, f = this.face, col = typeColor(SKILLS[this.skillId('z')].type);
    if (a.pulseAt != null) { this.b.setVelocityX(-f * 120); sc.fx.shake(.006, 140, 'hit'); return; }
    const zr = base.zReach(this), x = this.x + f * 22 * this.mods.sizeMul * zr, by = this.bottom;   // 근접 평타 사거리 +40% 만큼 앞에서
    sc.fx.ring(x, this.y, 22 * this.mods.sizeMul * zr, col, 220);
    if (this.onGround) for (let k = 0; k < 2; k++) sc.fx.burst(x + f * k * 8, by - 2, [0x6a5a48, col, 0xffffff], 6, 120, { angle: -Math.PI / 2 + f * .35, spread: .8, up: 90, life: .45, size: 2 });
    sc.fx.shake(.008, 160, 'hit');
    Sfx.play('punch');
  }

  // 평타가 탄을 쏜 순간 (Combat.spawnProjectile): 원거리형 표시 — 3타 피니시 연출(finisherFx)이 근접 · 원거리를 가른다
  comboPulse() { const a = this.action; if (a && a.comboStep && a.pulseAt == null) a.pulseAt = a.t; }

  // ---------------- 패링 자세 (지상 ↓ + Z · 모바일: 조이스틱 아래 + 평타) ----------------
  //  제자리에 무게중심을 낮추고 전방에 반달 가드 실드를 펼친다 — PARRY_WIN 초 동안 몸 둘레 PARRY_R px 안으로 들어온 근접 공격 · 적 투사체를 받아친다
  //  헛방(아무것도 못 받아침): 실드가 깨지며 WHIFF_T 초 자세 무너짐(이동 · 점프 · 공격 · 대시 불가) + 패링 재사용 PARRY_CD 초
  //  성공: 후딜레이 · 쿨타임 즉시 초기화 (연속 공격도 리듬에 맞춰 챙! 챙! 챙!)
  startParry() {
    const sc = this.scene, f = this.face;
    if (this.parryCd > 0) { this.parryGaugeT = .9; Sfx.play('deny'); return; }   // 쿨타임: 옆에 회색 방패 게이지
    if (this.action) this.endAction(true);
    this.chg.t = 0; this.chg.lvl = 0; this.chg.fullAt = null; this.chgAura.setVisible(false);
    this.b.setVelocityX(0);
    this.startAction({ dur: this.parryWin(), mm: 0, noDash: true, lockFace: 'hard', anim: 'Idle', parry: true }, 'parry');
    this.squash(1.25, .78);
    // 반달 가드 실드 (푸른 · 은빛) + 육각 배리어 잔상
    const g = sc.add.graphics().setDepth(23).setBlendMode(Phaser.BlendModes.ADD), cx = this.x + f * 6, cy = this.y - 2;
    const draw = k => {
      g.clear();
      g.lineStyle(4, 0x6ac8ff, .55 * k); g.beginPath(); g.arc(cx, cy, 30, f > 0 ? -1.25 : Math.PI - 1.25, f > 0 ? 1.25 : Math.PI + 1.25); g.strokePath();
      g.lineStyle(1.5, 0xffffff, .9 * k); g.beginPath(); g.arc(cx, cy, 32, f > 0 ? -1.15 : Math.PI - 1.15, f > 0 ? 1.15 : Math.PI + 1.15); g.strokePath();
      const pts = []; for (let i = 0; i < 6; i++) { const an = Math.PI / 6 + i * Math.PI / 3; pts.push({ x: cx + f * 14 + Math.cos(an) * 16, y: cy + Math.sin(an) * 16 }); }
      g.lineStyle(1, 0xbfe6ff, .5 * k); g.strokePoints(pts, true);
    };
    draw(1);
    this.parryFx = g;
    sc.tweens.addCounter({ from: 1, to: .5, duration: this.parryWin() * 1000, onUpdate: tw => { if (g.scene) draw(tw.getValue()); } });
    sc.fx.burst(cx + f * 20, cy, [0x6ac8ff, 0xffffff], 6, 60, { grav: 0, bounce: false, glow: true, life: .2 });
    Sfx.play('stance');
  }
  // 지금 열린 패링 판정 (패링 자세 동안만): { x, y, r } — 몸 둘레 · 전방 실드
  parryZone() {
    const a = this.action;
    return a && a.parry && !a.parried && a.t <= this.parryWin() ? { x: this.x + this.face * 6, y: this.y - 2, r: PARRY_R } : null;
  }
  inParry(z, x, y, r = 0) { return Math.hypot(x - z.x, y - z.y) <= z.r + r; }
  // 헛방: 실드가 깨져 흩어지고 자세가 무너진다
  parryWhiff() {
    const sc = this.scene;
    const steady = this.mods.parryCdMul || 1;   // 굳건한 방어 태세 카드: 헛방 쿨타임 · 무방비 후딜레이 -25%
    this.parryCd = PARRY_CD * steady + (this.mods.whiffCdAdd || 0);   // 찰나의 카운터(양날의 검): 헛방 쿨타임 +1초
    sc.fx.burst(this.x + this.face * 20, this.y - 2, [0x8a9ab0, 0xbfe6ff], 12, 110, { glow: true, life: .35 });
    sc.fx.floatText(this.x, this.b.y - 18, 'MISS', '#9aa6b8', 10);
    Sfx.play('crack');
    this.startAction({ dur: WHIFF_T * steady, mm: 0, noDash: true, lockFace: 'hard', anim: 'Idle', whiff: true }, 'whiff');
    this.squash(.85, 1.1);
  }
  // 연속 패링 점감: 마지막 패링에서 PARRY_CHAIN_T 초 안에 다시 패링하면 연쇄 (parryN) — 반사 피해 100 → 65 → 40 → 25 → 15% · 그로기 누적 100 → 60 → 35 → 15 → 0%
  //  PARRY_CHAIN_T 초 동안 패링이 없으면 다시 첫 패링 위력. 반환 { n, dmg, stag } (Combat 반사탄 · 근접 카운터 · 코어가 쓴다)
  parryChainStep() {
    const now = this.scene.time.now;
    this.parryN = now - (this.parryAt ?? -99999) <= PARRY_CHAIN_T * 1000 ? (this.parryN || 0) + 1 : 1;
    this.parryAt = now;
    const i = Math.min(this.parryN, PARRY_DMG.length) - 1;
    // pow · stag: 유대의 불꽃 Lv.3 천공의 반격(그로기 +15% · 반사 · 카운터 피해 +20%) · 찰나의 카운터(양날의 검: 피해 +160% · 그로기 2배)
    const bp = bondParry(this.scene.bondStage || 0), md = this.mods;
    return (this.parryChain = { n: this.parryN, dmg: PARRY_DMG[i], stag: PARRY_STAG[i] * bp.stag * (1 + (md.razorStag || 0)), pow: bp.pow * (1 + (md.razorPow || 0)) });
  }
  // 패링 성공 (x, y: 부딪힌 자리 · kind: 'proj' 투사체 반사 · 'melee' 근접 공격 받아치기) → 연속 패링 단계 { n, dmg, stag }
  doParry(x, y, kind) {
    const sc = this.scene, m = this.m, f = this.face, a = this.action, ch = this.parryChainStep(), first = ch.n === 1, s = first ? 1 : Math.max(.55, ch.dmg + .2);
    if (a && a.parry) { a.parried = true; this.endAction(true); }   // 자세를 풀고 후딜레이 없이 바로 움직인다
    this.parryCd = 0; this.zLock = 0; this.inv = Math.max(this.inv, .35);
    sc.fx.starburst(x, y, 0xffe36a, 1.5 * s, { debris: false });
    sc.fx.ring(x, y, 28 * s, 0xffffff, 220); sc.fx.ring(x, y, 46 * s, 0xffe36a, 340);
    sc.fx.burst(x, y, [0xffe36a, 0xffffff, 0x6ac8ff], Math.round(20 * s), 220, { glow: true, grav: 0, bounce: false, life: .32 });
    sc.fx.floatText(this.x, this.b.y - 24, first ? '⚡ PERFECT PARRY!' : `PARRY x${ch.n} (${Math.round(ch.dmg * 100)}%)`, first ? '#ffe36a' : ch.dmg >= .4 ? '#f0d090' : '#c8c0b0', first ? 13 : 11);
    Cores.parry(this);   // 보스의 코어: 제크로무 — 화면 안 모든 적에게 낙뢰 · 공격 속도 +40% (연속 패링이면 그만큼 약하게)
    onParry(this, x, y, kind, ch);   // 패링 카드 (game/Perks.js): 철벽의 호흡 회복 · 충격파 카운터 · 반격의 일격
    this.bondStrike(x, y, true);   // 유대의 불꽃 Lv.6: 유대의 추가 타격 (패링에서 나온 타격 — 챕터 메인 대보스에겐 -33%)
    sc.fx.hitStop(100);
    const cam = sc.cameras.main;
    if (!cam.zoomEffect.isRunning) { const z0 = cam.zoom; cam.zoomTo(z0 * 1.05, 60, 'Quad.easeOut', true); sc.time.delayedCall(100, () => cam.zoomTo(z0, 220, 'Sine.easeOut', true)); }
    Sfx.play('parry');
    if (kind !== 'melee') return ch;
    // 근접 카운터: 전방 충격파 · 상대 큰 경직 (보스 그로기 +30) · X · C · 메가 필살기 쿨타임 -2초 · 다음 평타/차징 한 방 확정 치명타
    const type = this.types[0], cx = this.x + f * 26;
    sc.combat.hitCircle(cx, this.y, 40 * this.mods.sizeMul, 1.5 * ch.dmg * ch.pow, type, { kbx: 280, kby: -180, hs: 40, stun: 1.2 * Math.max(.4, ch.dmg), parryHit: true });   // parryHit: 챕터 메인 대보스 -33% (ParryRules)
    sc.fx.ring(cx, this.y, 40 * this.mods.sizeMul, 0xffe36a, 300);
    const e = sc.enemies.filter(q => q.alive && !q.intangible && Math.abs(q.x - x) < 120 && Math.abs(q.y - this.y) < 100).sort((p1, p2) => Math.abs(p1.x - x) - Math.abs(p2.x - x))[0];
    if (e && e.boss && e.addStaggerRaw && ch.stag > 0) e.addStaggerRaw(30 * ch.stag * parryStagK(e));   // 챕터 메인 대보스: 그로기 ×0.55
    for (const k of ['x', 'c', 'r']) if (m.cd[k] > 0) m.cd[k] = Math.max(0, m.cd[k] - 2 * ch.dmg);
    this.critNext = sc.time.now + 4000;   // 4초 안의 다음 한 방 (Combat.damageEnemy)
    return ch;
  }
  // 쿨타임 중 ↓ + Z: 캐릭터 옆에 작은 회색 방패 + 남은 쿨타임 고리
  drawParryGauge(dt) {
    this.parryGaugeT = Math.max(0, (this.parryGaugeT || 0) - dt);
    const show = this.parryGaugeT > 0 && this.parryCd > 0;
    if (!show) { if (this.parryGauge) this.parryGauge.clear(); return; }
    const g = this.parryGauge || (this.parryGauge = this.scene.add.graphics().setDepth(60));
    const x = this.x + 16, y = this.top - 6, k = Math.min(1, this.parryCd / (PARRY_CD * (this.mods.parryCdMul || 1) + (this.mods.whiffCdAdd || 0)));
    g.clear();
    g.fillStyle(0x1a1a24, .7); g.fillCircle(x, y, 7);
    g.fillStyle(0x9aa0b0, .9); g.fillPoints([{ x: x - 4, y: y - 4 }, { x: x + 4, y: y - 4 }, { x: x + 4, y: y }, { x, y: y + 5 }, { x: x - 4, y }], true);
    g.lineStyle(1.5, 0xd0d4e0, .9); g.beginPath(); g.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath();
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
    this.chg.t = 0; this.chg.lvl = 0; this.chg.fullAt = null;
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
    Cores.dive(this);
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
    if (this.tierIdx >= 1) { sc.fx.ring(x, by - 4, R * 1.3, col, 420); sc.fx.burst(x, by - 2, [col, 0xffffff], 14, 220, { up: 160, glow: true }); }
    if (this.tierIdx >= 2) { magmaEruption(this, { type, n: 3, both: true, mul: 1.2, proc: true }); shockwave(sc, x, by - 8, .03, 500); }   // 3단: 지면이 쪼개지며 양옆으로 분출
    Sfx.play('slam');
  }

  // ---------------- Z 홀드 차징 샷 ----------------
  //  Z 를 짧게 누르면 평소 평타. 꾹 누르고 있으면 몸 둘레로 속성 기운이 빨려 들고(소리도 단계마다 높아진다), 떼는 순간 앞으로 차징 탄을 쏜다
  //  기본은 1단까지 (총합 500%) · 기술머신 '초고압 차징 코어' 1장 → 2단 (650%) · 2장(+1강) → 3단 풀차징 (1,100%)
  //  해금된 마지막 단계가 차는 찰나(PERFECT_WIN 초)에 십자 섬광이 번쩍 — 그때 떼면 퍼펙트 차징 (확정 치명타 + 피해 ×1.5)
  chargeMax(m = this.m) { return 1 + Math.min(2, (m.perks || {}).u_charge || 0); }
  // k 단계(0부터)가 차는 시각 — 고속 축전 코일: -35% · -48% · -60%
  chargeAt(k, m = this.m) { return CHG_AT[k] * CHG_FAST[Math.min(3, (m.perks || {}).u_rapid || 0)] * (1 - Math.min(.5, (m.mods && m.mods.chargeFast) || 0)); }   // chargeFast: 차징 안정화 카드
  chargePerfect() { const c = this.chg; return c.fullAt != null && c.t - c.fullAt <= PERFECT_WIN; }
  updateCharge(dt, inp) {
    const c = this.chg, a = this.action, sc = this.scene;
    const blocked = this.dash || (a && (a.dive || a.slot === 'zmove' || a.slot === 'charge' || a.parry || a.whiff));
    if (inp.zH && !blocked) {
      c.t += dt;
      if (this.counterT > sc.time.now && c.t >= .12) {   // 반격의 일격 카드: 패링 뒤 2초 안의 차징은 즉시 완충 (평타 한 번 누르기와 가르려고 0.12초는 눌러야)
        this.counterT = 0; c.t = Math.max(c.t, this.chargeAt(this.chargeMax() - 1));
        sc.fx.floatText(this.x, this.b.y - 22, '반격의 일격! 즉발 차징', '#ffe36a', 10);
      }
      const max = this.chargeMax();
      let lvl = 0; for (let k = 0; k < max; k++) if (c.t >= this.chargeAt(k)) lvl = k + 1;
      const col = typeColor(this.chargeType());
      if (lvl > c.lvl) {   // 한 단계 찼다: 칭! + 응축 고리 (2단: 두 번째 고리 · 3단: 거대한 스파크와 바닥 균열)
        c.lvl = lvl;
        Sfx.play('charged');
        sc.fx.ring(this.x, this.y, 18 + lvl * 8, lvl >= 3 ? 0xffffff : col, 260);
        sc.fx.burst(this.x, this.y, [col, 0xffffff], 8 + lvl * 4, 70 + lvl * 20, { glow: true, grav: 0, bounce: false, life: .35 });
        if (lvl >= 2) sc.time.delayedCall(90, () => sc.fx.ring(this.x, this.y, 34 + lvl * 10, col, 380));
        if (lvl >= 3) { this.chargeCrack(col); sc.fx.shake(.006, 220, 'hit'); }
        if (lvl === max) {   // 퍼펙트 차징 창이 열린다: 하얀 · 황금 십자 섬광 (팅-!)
          c.fullAt = c.t;
          sc.fx.starburst(this.x, this.y - 4, 0xffe36a, 1 + lvl * .25, { debris: false });
          sc.fx.ring(this.x, this.y, 26 + lvl * 8, 0xffffff, 200);
          this.flash(90);
          Sfx.play('ting');
        }
      }
      if (c.t >= CHG_SHOW) {
        // 기운이 몸 쪽으로 강하게 빨려 든다 (단계가 오를수록 많이 · 크게 · 빠르게)
        const n = 1 + c.lvl, R = 34 + c.lvl * 8;
        for (let k = 0; k < n; k++) {
          const ang = Math.random() * Math.PI * 2, px = this.x + Math.cos(ang) * R, py = this.y + Math.sin(ang) * R * .8;
          sc.fx.burst(px, py, [col, 0xffffff], 1, R * (3.6 + c.lvl * .6), { angle: ang + Math.PI, spread: .12, up: 0, grav: 0, bounce: false, glow: true, life: .24, size: c.lvl >= 2 ? 2 : 1 });
        }
        const pulse = 1 + Math.sin(sc.time.now / (c.lvl >= 3 ? 40 : 70)) * .12, full = c.lvl >= max, perfect = this.chargePerfect();
        this.chgAura.setVisible(true).setPosition(this.x, this.y).setTint(perfect ? 0xffe36a : c.lvl >= 3 ? 0xffffff : col)
          .setScale((.5 + Math.min(1, c.t / this.chargeAt(max - 1)) * .55 + c.lvl * .22) * pulse * (perfect ? 1.25 : 1)).setAlpha(perfect ? .95 : full ? .75 : .45);
        c.st -= dt;
        if (c.st <= 0 && c.lvl < max) { c.st = .3 * CHG_FAST[Math.min(3, (this.m.perks || {}).u_rapid || 0)]; Sfx.play('charge' + Math.min(3, c.lvl + 1)); }   // 모이는 소리 (단계마다 높아진다)
        if (full && Math.floor(sc.time.now / 70) % 3 === 0) this.flash(40);   // 다 찼으면 몸이 하얗게 깜빡인다
        if (c.lvl >= 3 && Math.random() < dt * 14) {   // 3단: 몸 둘레로 튀는 스파크 · 발밑 균열 먼지
          const ang = Math.random() * Math.PI * 2;
          sc.fx.burst(this.x + Math.cos(ang) * 16, this.y + Math.sin(ang) * 16, [0xffffff, col], 2, 160, { angle: ang, spread: .3, grav: 0, bounce: false, glow: true, life: .18, size: 1 });
          if (this.onGround) sc.fx.burst(this.x + (Math.random() - .5) * 30, this.bottom - 1, [0x8a7a68, col], 1, 60, { up: 60, life: .4, size: 1 });
        }
      }
      return;
    }
    if (!inp.zH && c.lvl > 0 && !blocked) this.fireCharge(c.lvl, c.lvl === this.chargeMax() && this.chargePerfect());
    c.t = 0; c.lvl = 0; c.st = 0; c.fullAt = null;
    this.chgAura.setVisible(false);
  }
  // 3단 응축: 발밑에서 양옆으로 갈라지는 바닥 균열
  chargeCrack(col) {
    const sc = this.scene, by = this.bottom;
    if (!this.onGround) return;
    for (const d of [-1, 1]) for (let k = 1; k <= 5; k++) sc.time.delayedCall(k * 26, () => sc.fx.burst(this.x + d * k * 9, by - 1, [0x6a5a48, col, 0xffffff], 2, 70, { angle: -Math.PI / 2 + d * .4, spread: .6, up: 50, life: .4, size: k < 3 ? 2 : 1 }));
  }

  // 차징 임팩트 웨이브 (특성 카드): 맞힌 자리에 2차 연쇄 속성 폭발 장판 — 0.3초마다 5번 터진다 (합성하면 더 크고 세게)
  chargeShockField(x, y, lvl, type, n) {
    const sc = this.scene, col = typeColor(type), R = (46 + lvl * 16) * (1 + .3 * (n - 1)), mul = .28 * lvl * (1 + .5 * (n - 1));
    let k = 0;
    const tick = () => {
      if (!sc.combat || this.dead) return;
      if (!sc.paused) {
        sc.combat.hitCircle(x, y, R, mul, type, { kbx: 60, kby: -120, hs: 20, stagMul: 2, src: 'charge' });
        sc.fx.ring(x, y, R, col, 260); sc.fx.glow(x, y, R * .8, col, 240, .6);
        sc.fx.burst(x + (Math.random() - .5) * R, y + (Math.random() - .5) * R * .4, [col, 0xffffff], 8, 120, { up: 90, glow: true, life: .35 });
        Sfx.play('boom');
      }
      if (++k < 5) sc.time.delayedCall(300, tick);
    };
    sc.fx.ring(x, y, R * 1.2, 0xffffff, 300);
    sc.time.delayedCall(120, tick);
  }

  fireCharge(lvl, crit = false) {
    const sig = chargeSigOf(this);   // 계열 고유 차징 (game/Signature.js): 개굴닌자 거대 수리검 · 울머기 저격탄 …
    const sc = this.scene, type = sig ? sig.type : this.chargeType(), col = typeColor(type), spec = CHARGE_SHOT[lvl], evo = this.tierIdx, sizeK = Math.min(SIZE_CAP, this.mods.sizeMul + (this.mods.psyCore ? PSY_CORE_SIZE : 0)), s = sizeK * this.T.proj * (evo >= 2 ? 1.2 : 1);   // 3단·메가는 탄이 더 크다 · 뮤츠의 코어 +12% (합연산 · 상한)
    const perks = this.m.perks || {}, full = lvl === this.chargeMax(), shockN = full ? perks.u_shock || 0 : 0, rapid = (perks.u_rapid || 0) > 0;
    const critMul = crit ? CHARGE_CRIT : 1, overR = 1 + Math.min(SIZE_CAP - 1, this.mods.overBoom || 0), boomK = Math.min(SIZE_CAP, sizeK + overR - 1) / sizeK;   // 과부하 차징 캐논(양날의 검): 폭발 반경 +25% (예전 1.8배 · 장신구 크기와 더해 최대 1.45배) · 피해 +120% 는 Combat.damageEnemy
    if (this.action) this.endAction(true);
    this.chgAura.setVisible(false);
    if (full) this.bondStrike(this.x + this.face * 140, this.y);   // 유대의 불꽃 Lv.6: 풀차징 샷 → 유대의 추가 타격 (앞쪽 가까운 적)
    if (crit) {   // ⚡ 퍼펙트 차징: 확정 치명타 + 피해 ×1.5
      sc.fx.floatText(this.x, this.b.y - 26, '⚡ OVERCHARGE CRITICAL!', '#ffe36a', 13);
      sc.fx.starburst(this.x, this.y, 0xffffff, 1.6, { debris: false });
      sc.cameras.main.flash(120, 255, 240, 170, true);
      Sfx.play('ocrit');
    }
    this.startAction({
      dur: lvl >= 3 ? .5 : .3, mm: rapid ? 1 : lvl >= 3 ? 0 : .25, anim: 'Shoot', inv: lvl >= 3 ? .3 : 0, boostDmg: critMul, ev: [[.03, () => {
        const f = this.face, x = this.x + f * 12, y = this.y - 3;
        sc.combat.chargeSpawn = true;   // 이 순간 만든 탄은 차징 탄 (연습용 나무 상자 · Combat.spawnProjectile)
        sc.combat.chargeCtx = { crit, shock: shockN ? (hx, hy) => this.chargeShockField(hx, hy, lvl, type, shockN) : null };
        if (sig) {
          sig.fire(this, lvl, s * Math.min(SIZE_CAP, sizeK + (overR - 1) * .5) / sizeK, f);   // 계열 고유 차징: 과부하 폭발 확대의 절반만큼 크게 (상한)
          if (lvl >= 2) sc.fx.floatText(this.x, this.b.y - 16, (sig.nameOf ? sig.nameOf(this, lvl) : sig.name[lvl - 1]) + '!', lvl >= 3 ? '#ffe36a' : '#ffffff', lvl >= 3 ? 12 : 10);
          if (lvl >= 3) sc.fx.hitStop(60);
        } else {
          const boom = { r: spec.boom.r * (1 + (s - 1) * .6) * boomK, mul: spec.boom.mul * critMul };
          const status = Object.assign({ heavy: true, chg: 1, hs: 30 + lvl * 15 }, lvl >= 2 ? { stun: .4 } : {}, crit ? { crit: 1 } : {}, shockN ? { stagMul: 2 } : {});
          // 대폭발: 속성 충격파 고리 + 역경직 (보스 · 엘리트를 파고든 뒤 · 벽에 부딪히거나 사거리 끝)
          const blast = (q, heavy) => {
            if (q.boomed) return;
            q.boomed = true;
            sc.combat.hitCircle(q.x, q.y, boom.r, boom.mul, type, Object.assign({}, status, { kbx: 220 + lvl * 60, kby: -220, hs: heavy ? 90 : 40, src: 'charge' }));
            sc.fx.ring(q.x, q.y, boom.r, col, 320); sc.fx.ring(q.x, q.y, boom.r * 1.35, 0xffffff, 420);
            sc.fx.glow(q.x, q.y, boom.r, col, 300, 1);
            sc.fx.burst(q.x, q.y, [col, 0xffffff], 18 + lvl * 8, boom.r * 3, { up: 90, glow: true });
            sc.fx.starburst(q.x, q.y, col, .8 + lvl * .35);
            if (heavy) { sc.fx.hitStop(90 + lvl * 5); shockwave(sc, q.x, q.y, .02 + lvl * .008, 420); }
            sc.fx.shake(heavy ? .014 + lvl * .006 : .008 + lvl * .003, heavy ? 320 : 220, 'hit');
            Sfx.play('cboom'); if (lvl >= 2) Sfx.play('slam');
            if (shockN) this.chargeShockField(q.x, q.y, lvl, type, shockN);
          };
          const hits = spec.hits;
          const q = sc.combat.spawnProjectile({
            owner: 'player', x, y, vx: f * spec.speed, vy: 0, r: spec.r * s, mul: spec.mul, type, kind: CHARGE_KIND[type] || 'wave', color: col,
            life: spec.life, pierce: 999, ghost: !!spec.ghost, light: true, tier: Math.max(this.tierIdx, lvl), pow: s * (1 + lvl * .3), stream: false, ownShock: true,
            kb: 200 + lvl * 80, status,
            // 잡몹은 그대로 뚫고 지나가며 줄줄이 피해 · 넉백 / 보스 · 엘리트는 파고들어 0.3초간 다단히트(지지직!) 뒤 대폭발(콰앙!)
            onHit: (e, q) => {
              if (q.latch) return;
              if (e.boss || e.elite) { q.latch = e; q.lt = 0; q.n = 0; q.life = Math.max(q.life, 1); Sfx.play('crit'); return; }
              sc.combat.damageEnemy(e, q.dmg, type, Object.assign({}, status, { kb: f * (200 + lvl * 80), kby: -160, hx: q.x, hy: q.y, hs: 25 + lvl * 8 }));
              sc.fx.burst(e.x, e.y, [col, 0xffffff], 6 + lvl * 2, 120, { glow: true, life: .25 });
            },
            update: (q, dt) => {
              if (q.latch) {   // 적의 몸을 파고든 채로 지지직
                const e = q.latch;
                q.vx = 0; q.vy = 0;
                if (e.alive) { q.x = e.x; q.y = e.y; }
                q.lt += dt;
                while (q.n < hits && q.lt >= q.n * (MULTI_T / hits)) {
                  q.n++;
                  if (e.alive) sc.combat.damageEnemy(e, q.dmg / hits, type, Object.assign({}, status, { kb: 0, kby: 0, hx: q.x, hy: q.y, hs: 18 }));
                  sc.fx.burst(q.x + (Math.random() - .5) * 14, q.y + (Math.random() - .5) * 14, [col, 0xffffff], 5 + lvl * 2, 110, { glow: true, grav: 0, bounce: false, life: .2 });
                  sc.fx.ring(q.x, q.y, 10 + q.n * 4 * lvl, col, 140);
                  Sfx.play('zap');
                }
                if (q.lt >= MULTI_T) { blast(q, true); q.kill = 'done'; }
                if (q.beam) { const L = Math.min(q.x0, q.x), W = Math.abs(q.x - q.x0); q.beam.clear().fillStyle(col, .35).fillRect(L, q.y - q.r * .9, W, q.r * 1.8).fillStyle(0xffffff, .55).fillRect(L, q.y - q.r * .3, W, q.r * .6); }
                return;
              }
              // 꼬리: 속성 파편 · 3단은 굵은 빛줄기가 남는다
              q.tt = (q.tt || 0) - dt;
              if (q.tt <= 0) { q.tt = lvl >= 3 ? .012 : .03; sc.fx.burst(q.x - f * q.r, q.y + (Math.random() - .5) * q.r, [col, 0xffffff], lvl + 1, 40, { grav: 0, bounce: false, glow: true, life: .3, size: lvl >= 2 ? 2 : 1 }); }
              if (evo >= 1 || lvl >= 2) { q.sp = (q.sp || 0) + dt * 22; for (const ph of [0, Math.PI]) sc.fx.burst(q.x - f * q.r * .6, q.y + Math.sin(q.sp + ph) * q.r * 1.3, [col, 0xffffff], 1, 10, { grav: 0, bounce: false, glow: true, life: .32, size: 2 }); }   // 회전 소용돌이 꼬리
              if (q.beam) { const L = Math.min(q.x0, q.x), W = Math.abs(q.x - q.x0); q.beam.clear().fillStyle(col, .35).fillRect(L, q.y - q.r * .9, W, q.r * 1.8).fillStyle(0xffffff, .55).fillRect(L, q.y - q.r * .3, W, q.r * .6); }
            },
            onExpire: q => {
              blast(q, false);   // 벽 · 사거리 끝에서도 터진다 (보스에 꽂혀 이미 터졌으면 건너뛴다)
              if (q.beam) { const bm = q.beam; q.beam = null; sc.tweens.add({ targets: bm, alpha: 0, duration: 420, onComplete: () => bm.destroy() }); }
            }
          });
          if ((this.mods.coreProj || {})[type]) sc.combat.spawnProjectile({ owner: 'player', x, y: y - 8, vx: f * spec.speed * .92, vy: -spec.speed * .08, r: spec.r * s * .7, mul: spec.mul * .6, type, kind: CHARGE_KIND[type] || 'wave', color: col, life: spec.life, pierce: 99, light: true, tier: Math.max(this.tierIdx, lvl), pow: s, kb: 160, stream: false, status });   // 보스의 코어: 그 속성 차징 탄 +1
          if (lvl >= 3) { q.x0 = x; q.beam = sc.add.graphics().setDepth(28).setBlendMode(Phaser.BlendModes.ADD); sc.cameras.main.flash(180, 255, 255, 255, true); sc.fx.hitStop(60); }
        }
        sc.combat.chargeSpawn = false; sc.combat.chargeCtx = null;
        // 발사: 포구 화염 · 반동으로 뒤로 밀림 · 카메라 줌 펀치
        sc.fx.glow(x, y, (16 + lvl * 12) * s, col, 240, 1); sc.fx.ring(x, y, (14 + lvl * 12) * s, 0xffffff, 220);
        sc.fx.starburst(x + f * 6, y, col, .6 + lvl * .3, { debris: false });
        sc.fx.burst(x, y, [col, 0xffffff, 0xffe36a], 10 + lvl * 8, 160 + lvl * 30, { angle: f > 0 ? 0 : Math.PI, spread: .7, up: 10, glow: true, life: .3 });
        this.b.setVelocityX(-f * (90 + lvl * 70));
        const cam = sc.cameras.main;
        if (!cam.zoomEffect.isRunning) { const z0 = cam.zoom; cam.zoomTo(z0 * (1.03 + lvl * .012), 70, 'Quad.easeOut', true); sc.time.delayedCall(90, () => cam.zoomTo(z0, 220, 'Sine.easeOut', true)); }
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
    if (!this.z.has) {   // Z링 + 이 포켓몬 속성의 Z크리스탈을 전용 칸에 끼워야 한다
      const t = zTypeOf(this.m.key);
      sc.events.emit('toast', !this.zRing ? 'Z링이 없다 — 호연지방 하늘기둥 입구(131번 수로)의 시련 캡틴을 찾아가 보자' : `${this.form().name}의 Z크리스탈 칸에 ${crystalName(t)}를 끼워야 한다 (가방)`);
      Sfx.play('deny'); return;
    }
    if (this.z.cd > 0) { sc.events.emit('toast', `Z기술 재사용까지 ${Math.ceil(this.z.cd)}초`); Sfx.play('deny'); return; }
    if (this.dash) return;
    this.z.cd = Z_CD;
    this.zCinematic(() => {
      shockwave(sc, this.x, this.y, .045, 750);   // 화면이 물결치며 Z기술 시작
      this.zCine = true;
      this.startAction(ZMOVE_IMPL[this.sp.zmove](this, ZMOVES[this.sp.zmove]), 'zmove');
      this.zCine = false;
    });
  }

  // Z파워 공명 (약 0.6초): 적 · 투사체 · 물리가 멈춘 사이 Z크리스탈의 거대한 속성 문양과 무지갯빛 Z파워 기둥이 솟고,
  //  포켓몬이 기를 모아 솟구쳤다 내려앉는 포즈 · UI 가 화면을 가로지르는 컷인 띠(초상 · 속성 문양 · 『기술 이름!!』)를 띄운다 → done() 에서 본 기술
  zCinematic(done) {
    const sc = this.scene, zm = ZMOVES[this.sp.zmove], type = zTypeOf(this.m.key), col = typeColor(type), x = this.x, y = this.y;
    if (this.action) this.endAction(true);
    this.inv = Math.max(this.inv, 2);
    sc.zFreeze(.62);
    const objs = [];
    // 속성 문양: 크게 돌며 나타나는 Z크리스탈 + 이중 고리
    const emb = sc.add.image(x, y - 6, 'zcrystal-hi').setDepth(19.5).setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(0).setAlpha(.9);
    const ringA = sc.add.image(x, y - 6, 'ring').setDepth(19.4).setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(.2);
    const ringB = sc.add.image(x, y - 6, 'ring').setDepth(19.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff6a0).setScale(.2);
    objs.push(emb, ringA, ringB);
    sc.tweens.add({ targets: emb, scale: 4.2 / RES, angle: 360, duration: 520, ease: 'Back.easeOut' });
    sc.tweens.add({ targets: ringA, scale: 2.6, alpha: { from: 1, to: .3 }, duration: 560, ease: 'Cubic.easeOut' });
    sc.tweens.add({ targets: ringB, scale: 1.8, angle: -180, duration: 560, ease: 'Cubic.easeOut' });
    // 무지갯빛 Z파워 기둥 (빛줄기 여러 겹이 색을 바꾸며 솟는다)
    const RB = [0xff5a5a, 0xffb040, 0xfff06a, 0x6aff8a, 0x5ac8ff, 0xb06aff];
    RB.forEach((c, k) => {
      const pillar = sc.add.image(x + (k - 2.5) * 3, y + 10, 'glow').setOrigin(.5, 1).setDepth(19.3).setBlendMode(Phaser.BlendModes.ADD).setTint(c).setScale(.25, 0).setAlpha(.6);
      objs.push(pillar);
      sc.tweens.add({ targets: pillar, scaleY: 5.5, duration: 260 + k * 30, ease: 'Cubic.easeOut' });
    });
    for (let k = 0; k < 18; k++) sc.time.delayedCall(k * 30, () => sc.fx.burst(x + (Math.random() - .5) * 26, y + 8, [RB[k % 6], 0xffffff], 2, 160, { angle: -Math.PI / 2, spread: .3, up: 120, grav: -60, bounce: false, glow: true, life: .7 }));
    // 포즈: 기를 모아 살짝 솟았다가 내려앉는다
    const sp = this.sprite, y0 = sp.y;
    this.squash(.7, 1.4); this.flash(200);
    sc.tweens.add({ targets: sp, y: y0 - 12, duration: 240, yoyo: true, hold: 80, ease: 'Quad.easeOut' });
    sc.cameras.main.flash(160, 255, 250, 220, true);
    sc.events.emit('zcutin', { name: zm.name, type, portrait: this.portraitKey() });
    Sfx.play('zmove');
    sc.time.delayedCall(640, () => {
      for (const o of objs) sc.tweens.add({ targets: o, alpha: 0, duration: 260, onComplete: () => o.destroy() });
      if (sc.player === this && this.m.alive) done();
    });
  }

  // ---------------- 메가진화 (3단 + 메가스톤, 영구) ----------------
  //  폼체인지(디아루가·펄기아·기라티나 오리진폼)는 메가스톤·진화 단계 대신 그 전설의 아이템만 있으면 된다
  startMega(variant = 0) {
    const mg = this.mega, sc = this.scene, want = this.sp.megas[variant] || this.sp.megas[0];
    if (mg.active) return;
    if (want && want.item) {
      if (!this.formItems.has(want.item)) { const it = FORM_ITEMS[want.item]; sc.events.emit('toast', `${it.name}이(가) 없다 (${this.form().name} 보스를 정화하면 떨어뜨린다)`); Sfx.play('deny'); return; }
    } else {
      if (!this.megaReady()) {   // 키스톤 + 이 계열 메가스톤을 전용 칸에
        sc.events.emit('toast', !this.keyStone ? '키스톤이 없다 — 성도지방 방울탑의 노승려가 무언가 알고 있다' : !this.sp.megas.length ? `${this.form().name}은(는) 메가스톤으로 메가진화하지 않는다` : `${this.form().name}의 메가스톤 칸에 ${stoneName(this.m.key)}를 끼워야 한다 (가방)`);
        Sfx.play('deny'); return;
      }
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
  // 차원 도약 수정 (깨어진 세계 — Props.launchPad): 중력을 거슬러 높이 솟구친다 · 2단 점프 · 공중 대시는 다시 쓸 수 있다
  launch(v) {
    this.launchT = 1.2; this.b.setMaxVelocity(700, Math.max(640, v));
    this.b.setVelocityY(-v); this.jumpsUsed = 1; this.airDash = true; this.coyote = 0; this.jbuf = 0; this.dropT = 0;
    this.squash(.6, 1.5);
  }
  gravFlip(t) { this.flipT = t; this.b.setGravityY(-1800); this.sprite.setFlipY(true); }

  takeHit(dmg, type, srcX, o = {}) {
    const sc = this.scene, a = this.action;
    if (!o.force && (this.inv > 0 || this.intangible || this.dash)) { if (this.evadeReady && (this.dash || this.dashEvadeT > 0)) this.dashReload(); return false; }
    if (sc.testGod) return false;   // 테스트룸: 무적 (보스 패턴 구경)
    // 패링 자세(지상 ↓ + Z): 몸 둘레 70px 안에서 들어온 근접 공격을 받아친다 (투사체는 Combat 이 먼저 반사)
    const pz = !o.noParry && srcX != null && this.parryZone();
    if (pz && Math.abs(srcX - pz.x) <= pz.r + 24) {
      // ⚠️ 붉은 안광(패링 불가 — Boss.dangerOn): 받아치지 못하고 가드 브레이크 · 피해 ×DANGER_MUL
      if (o.danger || sc.bossDanger) { this.guardBreak((srcX + this.x) / 2, this.y - 4); dmg *= DANGER_MUL; }
      else { this.doParry((srcX + this.x) / 2, this.y - 4, 'melee'); return false; }
    }
    if (a && a.guard === 'counter') {
      this.endAction(true);
      sc.combat.hitCircle(this.x, this.y, 42 * this.mods.sizeMul, 3, 'fighting', { kbx: 320, kby: -200, hs: 120 });
      sc.fx.ring(this.x, this.y, 42, 0x8ad8ff, 260); sc.fx.floatText(this.x, this.b.y - 10, '카운터!', '#8ad8ff', 12);
      this.inv = .5; Sfx.play('punch');
      return true;
    }
    const m = type === 'none' ? 1 : typeMultiplier(type, this.types);
    const eff = effectiveness(m);
    const hurtK = this.mods.chargeHurt && this.charging ? 1 + this.mods.chargeHurt : 1;   // 과부하 차징 캐논(양날의 검): 모으는 중 받는 피해 +30%
    const d = Math.max(1, Math.round(dmg * m * hurtK * (this.mega.active ? .8 : 1) * (this.pas.guard || 1) * this.buffMul('guard') * this.mods.guard * Cores.hurtMul(this)));
    // 기합의띠(특성 카드): 쓰러질 피해를 체력 1로 버티고 3초 무적 — 방마다 1번 (GameScene.updateRooms 가 되돌린다)
    const sash = this.mods.sturdy && !this.m.sturdyUsed && this.m.hp > 1 && d >= this.m.hp;
    this.m.hp = sash ? 1 : this.m.hp - d;
    sc.fx.floatText(this.x, this.b.y - 2, `-${d}`, eff === 'super' ? '#ff6a4a' : '#ff9a8a', eff === 'super' ? 15 : 12);
    if (eff === 'super') sc.fx.floatText(this.x, this.b.y - 18, '효과가 굉장했다!', '#ffb050', 10);
    this.flash(100); this.hurtT = .25; this.inv = .85 * (this.mods.invMul || 1);   // 유리대포의 각오(양날의 검): 피격 무적 -25%
    sc.fx.hitStop(60); sc.fx.shake(eff === 'super' ? .012 : .007, 160);
    sc.fx.burst(this.x, this.y, [0xff5a5a, 0xffffff], 8, 100);
    const big = eff === 'super' || d >= this.m.maxhp * .22;   // 큰 피격: 더 깊은 충격음 + 더 진한 붉은 테두리
    Sfx.play(big ? 'hurt_big' : 'hurt');
    sc.events.emit('hurt', big ? .9 : .58);   // UIScene: 화면 가장자리 붉은 비네팅 점멸 (충격음과 같은 순간)
    if (o.slow) this.slowT = o.slow;
    if ((!this.mega.active && !this.pas.superArmor) || o.force) {   // 메가·슈퍼아머(애버라스 계열)는 경직·넉백 없음
      const dir = Math.sign(this.x - srcX) || -this.face, kb = 1 - Math.min(.8, this.mods.kbResist || 0);   // 단단한 외피 카드: 피격 넉백 -30%
      this.b.setVelocity(dir * 170 * kb, -170 * kb);
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

  // 전술 재장전 스텝 카드: 대시 무적으로 공격을 피했다 → 쿨타임 중인 기술(Z · X · C)의 남은 쿨타임 -0.8초 (대시 한 번에 한 번)
  dashReload() {
    const m = this.m, cut = .8 * (this.mods.dashReload || 1), sc = this.scene;
    this.evadeReady = false;
    for (const k of ['z', 'x', 'c']) if (m.cd[k] > 0) m.cd[k] = Math.max(0, m.cd[k] - cut);
    sc.fx.floatText(this.x, this.b.y - 20, `회피! 쿨타임 -${cut.toFixed(1)}초`, '#9affd8', 10);
    sc.fx.ring(this.x, this.y, 24, 0x9affd8, 260);
  }
  // ⚠️ 붉은 안광 공격을 패링하려 했다 (Boss.dangerOn): 가드 실드가 붉게 산산조각 · 패링 자세가 풀리고 재사용 대기 — 피해는 takeHit 이 ×DANGER_MUL 로
  guardBreak(x, y) {
    const sc = this.scene, a = this.action;
    if (a && a.parry) { a.parried = true; this.endAction(true); }
    if (this.parryFx) { this.parryFx.destroy(); this.parryFx = null; }
    this.parryCd = PARRY_CD * (this.mods.parryCdMul || 1) + (this.mods.whiffCdAdd || 0);
    sc.fx.floatText(this.x, this.b.y - 26, '💢 GUARD BREAK!', '#ff4a4a', 13);
    sc.fx.burst(x, y, [0xff2a3a, 0x6a0a14, 0xffffff, 0x8a9ab0], 22, 200, { glow: true, life: .45 });
    sc.fx.ring(x, y, 30, 0xff2a3a, 260); sc.fx.glow(x, y, 34, 0xff1a2a, 260, .9);
    sc.fx.shake(.014, 260, 'hit'); sc.cameras.main.flash(120, 255, 40, 40, true);
    Sfx.play('shatter'); Sfx.play('crack');
  }
  // 유대의 추가 타격 (유대의 불꽃 Lv.6 완전체 유대의 태양 — data/bond.js): 풀차징 샷 · 패링 성공 → (x, y) 둘레 가까운 적(보스 먼저)에게 황금빛 낙뢰 일격
  bondStrike(x, y, fromParry = false) {
    const sc = this.scene, now = sc.time.now;
    if ((sc.bondStage || 0) < 6 || now - (this.bondStrikeAt ?? -1e9) < BOND_STRIKE_CD * 1000) return;
    const near = sc.enemies.filter(e => e.alive && !e.intangible && Math.hypot(e.x - x, e.y - y) < 340).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    const e = near.find(q => q.boss) || near[0];
    if (!e) return;
    this.bondStrikeAt = now;
    sc.time.delayedCall(170, () => {
      if (!e.alive || !sc.combat || !this.scene) return;
      const ex = e.x, ey = e.y, col = 0xffd25a;
      const beam = sc.add.image(ex, ey - 70, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(.55, 4.2).setAlpha(.95).setDepth(47);   // 하늘에서 내리꽂는 황금 빛기둥
      sc.tweens.add({ targets: beam, scaleX: .08, alpha: 0, duration: 340, ease: 'Quad.easeIn', onComplete: () => beam.destroy() });
      sc.fx.starburst(ex, ey, col, 1.5, { debris: false });
      sc.fx.ring(ex, ey, 34, 0xffffff, 260); sc.fx.ring(ex, ey, 58, col, 400); sc.fx.glow(ex, ey, 48, col, 320, 1);
      sc.fx.burst(ex, ey, [col, 0xffffff, 0xff8a2a], 24, 210, { glow: true, up: 90, life: .5 });
      sc.fx.floatText(ex, e.top - 24, '🔥 유대의 추가 타격!', '#ffd25a', 11);
      sc.combat.damageEnemy(e, this.atk * BOND_STRIKE_MUL, this.types[0], { proc: true, ignoreResist: true, hx: ex, hy: ey, hs: 50, parryHit: fromParry });
      Sfx.play('thunder');
    });
  }
  // 마력 폭주 기관 (양날의 검): 액티브 기술 피해 +85% · 크기 1.5배 (최대 2배) — 쓸 때마다 지금 체력의 4% (체력 5% 이하면 소모 없음)
  manaDrive(action) {
    const m = this.m, md = this.mods, s1 = md.sizeMul, end0 = action.end;
    action.boostDmg = (action.boostDmg || 1) * (1 + md.skillPow);
    md.sizeMul = Math.min(SIZE_CAP, s1 + (md.skillSize || 0));   // 마력 폭주 기관: 기술 크기 +15% (합연산 · 최종 1.45배 상한)
    action.end = (p, a) => { md.sizeMul = s1; if (end0) end0(p, a); };   // 기술이 끝나면(끊겨도) 되돌린다
    if (md.castCost && m.hp > m.maxhp * .05) {
      const cost = Math.max(1, Math.round(m.hp * md.castCost));
      this.selfDamage(cost);
      this.scene.fx.floatText(this.x, this.b.y - 6, `-${cost} 마력 폭주`, '#d88aff', 9);
      this.scene.fx.burst(this.x, this.y, [0xb04aff, 0xff3a6a], 6, 60, { glow: true, life: .3 });
    }
  }
  // 카드가 바꾸는 행동 속도: 광전사의 혈투(잃은 체력만큼 최대 +100%) · 초중량 일격(평타 -25%)
  cardSpeed(a) { return (1 + Math.min(1, this.bloodK())) * (a && a.comboStep && this.mods.comboSlow ? 1 - this.mods.comboSlow : 1) * (a && a.comboStep && this.mods.comboHaste ? 1 + this.mods.comboHaste : 1); }   // comboHaste: 손목 스냅 훈련 카드 (평타 속도)

  faint() {
    if (Cores.revive(this)) return;   // 칠색조의 무지개 코어: 불사조 부활
    const sc = this.scene, m = this.m;
    m.hp = 0; m.alive = false;
    sc.fx.burst(this.x, this.y, [typeColor(this.typesOf(m)[0]), 0xffffff], 30, 160, { glow: true });
    sc.events.emit('toast', `${this.form(m).name}은(는) 쓰러졌다!`);
    const next = this.nextAlive(1);
    if (next >= 0) { this.swapTo(next, true); this.inv = 1.5; }
    else sc.gameOver(false);
  }

  destroy() { if (this.ashStar) this.ashStar.destroy(); this.aura.destroy(); this.chgAura.destroy(); this.megaSym.destroy(); this.megaEye.destroy(); for (const o of this.bondGlow || []) o.destroy(); super.destroy(); }   // bondGlow: 유대의 불꽃 오라 (Cores.bondAura)
}

export { ITEMS };
