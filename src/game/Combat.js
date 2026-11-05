// 전투 공통: 상성 데미지 계산, 범위 판정, 상태이상, 투사체, 장판
import Phaser from 'phaser';
import { Cores } from './Cores.js';
import { typeMultiplier, effectiveness, typeColor } from '../data/types.js';
import { Sfx } from '../systems/Audio.js';
import { ProjectileRenderer } from '../systems/ProjectileRenderer.js';
import { shockwave } from '../systems/PostFX.js';
import { onHit as perkHit } from './Perks.js';
import { txt } from '../config.js';
const GROGGY_MUL = 1.35;   // game/Boss.js GROGGY_MUL 과 같은 값 (Boss → Combat 순환 import 를 피해 따로 둔다)
// 보스 · 엘리트 탄 (fast — Boss.shot · Enemy 엘리트): 탄속 ×ENEMY_FAST (같은 궤적 · 같은 사거리로 더 빨리) · 쏘기 직전 SHOT_HOLD 초 예비 동작(입·손 앞의 날카로운 섬광 · 충전음)
//  → 보고 피하기보다 예비 동작을 읽고 타이밍으로 쳐내야 한다 (패링 난이도 ↑)
export const ENEMY_FAST = 1.42, SHOT_HOLD = .2;
// 보스 탄 최소 속도 (직선으로 나는 탄 · 같은 궤적 · 같은 사거리로 빨라진다): 느릿느릿 날아와 제자리 연속 패링으로 녹이는 일이 없게 — 발사 섬광을 보고 칼같이 쳐내야 한다
export const BOSS_MIN_SPEED = 580;
// 보스 탄 전체 하향 (최소 속도 · 지방 고정 스펙 탄속 · 스스로 움직이는 탄까지 모두 같은 비율): 너무 빨라 읽기 어렵다는 피드백 → 5% 느리게
export const BOSS_SHOT_K = .95;
// 패링으로 되받아친 탄 (parried): 맞힌 상대 속성과 상관없이 '효과가 굉장했다'(약점) 판정 · 보스 그로기 게이지 PARRY_STAGGER 를 한 번에 (일반 약점 한 방의 최대치 약 4.5배)
//  연속 패링 점감 (Player.parryChainStep): 2초 안에 이어 쳐낸 탄은 반사 피해 · 그로기가 줄어든다 (o.parryDmg · o.parryStag) · 반사탄도 작아진다 (PARRY_SIZE)
const PARRY_STAGGER = 32, PARRY_SIZE = [1, .85, .72, .62, .55], PARRY_COL = [0xffe36a, 0xffd88a, 0xf0d0a0, 0xd8c8b0, 0xc0b8b0];
// 반사탄 조준: 쳐내는 순간 그 탄을 쏜 적(없으면 가장 가까운 적)의 중심으로 · 날아가는 동안 초당 최대 REFLECT_TURN 만큼만 꺾어 따라간다 (약한 유도)
const REFLECT_TURN = 40 * Math.PI / 180, REFLECT_RANGE = 640;
// ⚠️ 붉은 안광(패링 불가 — Boss.dangerOn) 공격을 패링하면 가드 브레이크 · 받는 피해 ×DANGER_MUL (Player.takeHit · guardBreak)
export const DANGER_MUL = 1.4;
// 영거리 사격술(양날의 검 카드): 적과 NEAR_R 안에서 맞히면 +75% · FAR_R 밖에서 맞히면 -30%
const NEAR_R = 140, FAR_R = 300;

// 다단히트 합계 글자 모양
const txtStack = () => txt(11, '#ffe08a', { stroke: '#3a1a00', strokeThickness: 3, fontStyle: 'bold' });
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const circRect = (cx, cy, r, b) => { const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h)); return (nx - cx) ** 2 + (ny - cy) ** 2 <= r * r; };
export { overlap, circRect };

export class Combat {
  constructor(scene) {
    this.s = scene;
    this.projs = [];
    this.zones = [];
    this.zg = scene.add.graphics().setDepth(18).setBlendMode(Phaser.BlendModes.ADD);   // 장판·경고 표시
    this.zgn = scene.add.graphics().setDepth(17);
    this.freeLights = [];
    this.pr = new ProjectileRenderer(scene);   // 투사체 도트·꼬리·발사 섬광·적중 연출
  }
  get p() { return this.s.player; }
  get fx() { return this.s.fx; }

  // ---------------- 플레이어 → 적 ----------------
  damageEnemy(e, base, type, o = {}) {
    if (!e.alive || e.intangible) return 0;
    const p = this.p, mods = p.mods;
    this.applyStatus(e, o);
    if (base <= 0) return 0;
    const m0 = typeMultiplier(type, e.types), m = o.parried || Cores.allPlate(p) ? Math.max(2, m0) : o.ignoreResist ? Math.max(1, m0) : m0;   // 깨물어부수기 · 레시라무의 푸른 불꽃: 반감 무시 · 패링 반사탄 · 아르세우스의 창조 코어: 무조건 약점
    const eff = effectiveness(m);
    let d = base * m * mods.all * (1 + (mods.typeBoost[type] || 0));
    if (e.status.curse > 0) d *= 1.3;
    d *= Cores.amp(this, e, d);   // 다크라이의 나이트메어 코어: 상태이상 걸린 적 +45% · 흡혈 · 무한다이노의 다이맥스 코어: 보스 +50%
    if (this.s.overdrive) d *= 2;   // 유대의 불꽃 오버드라이브 (가라르 진 최종전): 평타 · 차징 샷 · 기술 · 패링 반사탄 모두 2배
    d *= this.s.bondMul || 1;   // 유대의 불꽃 정화 단계마다 모든 공격 소폭 상승 (GameScene.bondMul)
    if (mods.execute && e.hp <= e.maxhp * .25) d *= 1 + mods.execute;   // 특성 카드: 마무리 일격
    if (!o.dot && p.counterBuffT > this.s.time.now) d *= 1 + .15 * (mods.parryCounter || 1);   // 반격의 일격 카드: 패링 뒤 2초 안에 쓴 기술 +15% (Player.useSkill)
    if (mods.overCharge && (o.chg || o.src === 'charge')) d *= 1 + mods.overCharge;   // 과부하 차징 캐논(양날의 검): 차징 샷 · 폭발 피해 +120%
    if (!o.dot && (mods.nearPow || mods.farCut)) {   // 영거리 사격술(양날의 검): 가까이서 +75% · 멀리서 -30%
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (dist <= NEAR_R) d *= 1 + (mods.nearPow || 0); else if (dist >= FAR_R) d *= 1 - (mods.farCut || 0);
    }
    if (e.groggyT > 0) d *= GROGGY_MUL;   // 보스 그로기(약점 누적으로 자세 무너짐): 받는 피해 ×1.35
    if (e.guardMul && !o.pierceGuard) d *= e.guardMul;   // 레시라무의 푸른 불꽃은 방어 자세도 꿰뚫는다
    const sure = !o.dot && p.critNext > this.s.time.now;   // 패링 카운터 뒤 다음 한 방은 확정 치명타
    if (sure) p.critNext = 0;
    const crit = sure || (!o.dot && Math.random() < .06 + (o.crit || 0) + mods.crit);
    if (crit) d *= 1.6 * (mods.critMul || 1) * (1 + (mods.critDmg || 0)) * Cores.critMul(this, e);   // critDmg: 날카로운 타격 · 정밀 타격술 카드   // 피트렌즈: 급소 피해 +20% · 큐레무의 절대영도 코어: 빙결 · 둔화된 적 +60%
    d += o.flat || 0;
    d = Math.max(1, Math.round(d * (.92 + Math.random() * .16)));
    e.hp -= d;
    if (o.dot) this.fx.floatText(e.x, e.top, String(d), o.dot === 'burn' ? '#ffb070' : '#c8a0ff', 10);
    else {
      this.fx.damage(e.x, e.top - 2, d, eff, crit);
      this.stackDamage(e, d);   // 다단히트: 0.45초 안에 이어 맞으면 머리 위에 합계를 쌓아 보여 준다
      e.flash(e.boss ? 50 : 90);   // 큰 보스는 짧게 번쩍여 화면을 덮지 않게
      const fin = p.action && p.action.finisher && p.action.comboStep;   // 평타 3타 피니시: 강한 넉백 · 묵직한 역경직
      this.fx.hitStop(Math.max(o.hs ?? (eff === 'super' ? 70 : crit ? 60 : 50), fin ? 85 : 0));
      if (eff === 'super') this.fx.shake(.009, 170, 'hit'); else if (eff === 'normal') this.fx.shake(.004, 90, 'hit'); else this.fx.shake(.002, 60, 'hit');
      const hx = o.hx ?? e.x, hy = o.hy ?? e.y;
      this.fx.burst(hx, hy, [typeColor(type), 0xffffff], eff === 'super' ? 18 : eff === 'weak' ? 4 : 10, eff === 'super' ? 170 : 110, { up: 60 });
      if (eff === 'super') { this.fx.glow(hx, hy, 26, typeColor(type), 220, .9); this.fx.ring(hx, hy, 30, 0xffb050, 240); }
      // 타격 파편: 굵은 속성색 조각이 튀어 바닥에 튕긴다 (반감은 적게 · 묵직한 타격은 많이)
      this.fx.burst(hx, hy, [typeColor(type), 0xffffff, 0x2a2438], eff === 'weak' ? 2 : o.heavy ? 9 : 5, o.heavy ? 200 : 140, { up: 90, size: 2, life: .45 });
      Sfx.play(o.heavy ? 'hit_heavy' : eff === 'super' ? 'hit_super' : eff === 'weak' ? 'hit_weak' : 'hit_normal');   // heavy: 차징 샷 · 내려찍기 (저음 폭발)
      if (crit) Sfx.play('crit');
      if (!e.boss && (o.kb || o.kby || fin)) e.knock((o.kb || 0) * (fin ? 2 : 1) || (fin ? Math.sign(e.x - p.x || 1) * 220 : 0), (o.kby || 0) * (fin ? 1.5 : 1) || (fin ? -160 : 0));
      if (mods.psyCore && type === 'psychic' && !o.proc) this.psyField(e);   // 뮤츠의 코어: 사이코 중력장
      Cores.hit(this, e, d, type, o);   // 보스의 코어 (game/Cores.js)
      const steal = (mods.lifesteal || 0) + (o.lifesteal || 0);
      if (steal > 0) p.heal(d * steal, true);
      if (o.parried) this.parryCounter(e, hx, hy, type, o.parryN || 1, o.parryDmg ?? 1);
      if (!o.proc && !o.parried && p.action && p.action.comboStep && !p.onGround) p.airHitHop();   // 공중 평타 적중: 반동으로 한 번 더 체공
    }
    const stagK = 1 + (mods.stagAdd || 0);   // 타격감 증폭 카드: 보스 그로기 누적 +7%
    if (e.boss && o.parried) { if (e.addStaggerRaw && (o.parryStag ?? 1) > 0) e.addStaggerRaw(PARRY_STAGGER * (o.parryStag ?? 1) * stagK); }   // 패링 반사탄: 그로기 게이지가 뭉텅이로 (연속 패링은 60 → 35 → 15 → 0%)
    else if (e.boss && e.addStagger && !o.dot) e.addStagger(m === 0 ? 'immune' : eff, d * (o.stagMul || 1) * stagK);   // 보스 그로기 게이지 (약점 속성 공격만 · 준 피해에 비례 — Boss.addStagger) · stagMul: 차징 임팩트 웨이브 2배
    const pa = p.action;
    if (mods.heavyStag && pa && pa.comboStep && !o.dot && !o.proc && !o.parried && e.hp > 0) {   // 초중량 일격(양날의 검): 평타 한 번에 적마다 한 번 — 보스 그로기 · 3타 피니시는 잡몹 경직
      const hs = pa.heavySet || (pa.heavySet = new Set());
      if (!hs.has(e)) { hs.add(e); if (e.boss && e.addStaggerRaw) e.addStaggerRaw((pa.finisher ? 7 : 2.5) * mods.heavyStag); else if (pa.finisher) e.status.stun = Math.max(e.status.stun, .35); }
    }
    if (e.hp > 0) perkHit(this, e, d, type, o);
    if (p.castGrade && !o.proc && !o.dot && e.alive) this.gradeBurst(e, type, p.castGrade === '전설');   // 유니크·전설 기술 카드: 맞힌 자리마다 연쇄 폭발   // 특성 카드: 화상·빙결·마비·독·저주 부여 · 연쇄 번개 · 장판 · 블랙홀
    if (e.hp <= 0 && !(e.cheatDeath && e.cheatDeath())) this.s.killEnemy(e);   // 칠색조 부활처럼 한 번 버티는 보스
    return d;
  }

  // 패링 반사탄이 꽂힌 자리: 첫 반격은 「💥 PARRY COUNTER! (약점 강타!)」 · 묵직한 황금빛 폭발 · 화면 왜곡 충격파
  //  연속 패링(n ≥ 2)은 「PARRY xn (위력%)」 · 폭발도 위력만큼 작게 — 제자리 연속 패링보다 쳐낸 뒤 파고드는 편이 낫다는 걸 보여 준다
  parryCounter(e, x, y, type, n = 1, k = 1) {
    const fx = this.fx, big = n <= 1, s = Math.max(.45, k);
    fx.floatText(e.x, e.top - 30, big ? '💥 PARRY COUNTER! (약점 강타!)' : `PARRY x${n} (${Math.round(k * 100)}%)`, big ? '#ffd040' : k >= .4 ? '#f0d090' : '#c8c0b0', big ? 13 : 10);
    fx.starburst(x, y, 0xffe36a, 1.8 * s, { debris: big });
    fx.ring(x, y, 34 * s, 0xffffff, 240); fx.ring(x, y, 58 * s, 0xffb040, 380); fx.glow(x, y, 54 * s, 0xffd040, 320, big ? 1 : .7);
    fx.burst(x, y, [0xffe36a, 0xffffff, typeColor(type), 0xff8a2a], Math.round(34 * s), 260 * s, { glow: true, up: 80, life: .6 });
    fx.shake(.016 * s, 300, 'hit'); fx.hitStop(big ? 110 : 60);
    if (big) shockwave(this.s, x, y, .035, 600);
    Sfx.play(big ? 'boom' : 'hit_heavy'); if (big) Sfx.play('hit_super');
  }

  // 유니크·전설 등급 기술이 맞힌 자리: 속성색 연쇄 폭발 (같은 적은 0.12초에 한 번)
  gradeBurst(e, type, legend) {
    const now = this.s.time.now;
    if (now - (e.gradeAt || 0) < 120) return;
    e.gradeAt = now;
    const col = typeColor(type), r = legend ? 34 : 24, x = e.x, y = e.y;
    this.s.time.delayedCall(60, () => {
      if (!this.s.player) return;
      this.hitCircle(x, y, r, legend ? .45 : .3, type, { kbx: 90, kby: -90, hs: 0, proc: true });
      this.fx.ring(x, y, r, col, 260); this.fx.glow(x, y, r, col, 220, .9);
      this.fx.burst(x, y, [col, 0xffffff, legend ? 0xffd25a : 0xc08aff], legend ? 16 : 10, 170, { glow: true, grav: 0, bounce: false, life: .4 });
      Sfx.play('boom');
    });
  }

  // 다단히트 데미지 합산: 같은 적이 0.45초 안에 2번 넘게 맞으면 「합계 (n히트)」 글자를 머리 위에 띄우고, 맞을 때마다 숫자를 키운다
  stackDamage(e, d) {
    const now = this.s.time.now, old = e.dmgStack, alive = old && now - old.t < 450 && (!old.text || (old.text.scene && !old.text.released));
    const st = alive ? old : (e.dmgStack = { total: 0, n: 0, text: null, t: now });
    st.total += d; st.n++; st.t = now;
    if (st.n < 2) return;
    const fx = this.fx, x = Math.round(e.x), y = Math.round(e.top - 18), str = `${st.total}  (${st.n}히트)`;
    if (!st.text) st.text = fx.tpool.get(x, y, str, txtStack()).setOrigin(.5, 1).setDepth(62);
    const t = st.text;
    this.s.tweens.killTweensOf(t);
    t.setText(str).setPosition(x, y).setAlpha(1).setScale(1.25);
    this.s.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.s.tweens.add({ targets: t, alpha: 0, y: y - 10, delay: 520, duration: 360, onComplete: () => { fx.tpool.release(t); if (e.dmgStack === st) e.dmgStack = null; } });
  }

  applyStatus(e, o) {
    const r = e.boss ? .3 : 1, st = e.status, atk = this.p.atk;
    if (o.burn) { st.burn = Math.max(st.burn, o.burn); e.burnDps = atk * .28; }
    if (o.poison) { st.poison = Math.max(st.poison, o.poison); e.poisonDps = atk * .3; }
    if (o.slow) st.slow = Math.max(st.slow, o.slow);
    if (o.root) { if (st.root <= 0) this.fx.floatText(e.x, e.top - 10, '속박!', '#8aff8a', 10); st.root = Math.max(st.root, o.root * r); }
    if (o.stun) { if (st.stun <= 0) this.fx.floatText(e.x, e.top - 10, '풀죽었다!', '#ffe36a', 10); st.stun = Math.max(st.stun, o.stun * r); }
    if (o.confuse) { if (st.stun <= 0) this.fx.floatText(e.x, e.top - 10, '혼란!', '#ff9ad0', 10); st.stun = Math.max(st.stun, o.confuse * r); }
    if (o.paralyze && Math.random() < o.paralyze) { if (st.stun <= 0) this.fx.floatText(e.x, e.top - 10, '마비!', '#ffe36a', 10); st.stun = Math.max(st.stun, .9 * r); }
    if (o.curse) { if (st.curse <= 0) this.fx.floatText(e.x, e.top - 10, '저주!', '#c890ff', 10); st.curse = Math.max(st.curse, o.curse); }
    if (o.freeze) {   // 빙결: 잠깐 꼼짝 못 하고 하늘색으로 얼어붙는다 (냉동빔·냉동펀치)
      if (st.stun <= 0) this.fx.floatText(e.x, e.top - 10, '얼어붙었다!', '#bff0ff', 10);
      st.stun = Math.max(st.stun, o.freeze * r); e.frozenT = o.freeze * r;
      this.fx.burst(e.x, e.y, [0xbff0ff, 0xffffff, 0x7ad8f0], 10, 60, { glow: true, life: .4 });
    }
  }

  // 사각형 범위 판정. mul = 공격력 배율
  // 뮤츠의 코어: 에스퍼 기술이 맞은 자리에 작은 사이코 중력장 — 둘레 적을 한가운데로 끌어당겨 잠깐 묶고, 0.25초 뒤 안쪽으로 터진다 (적마다 0.35초에 한 번)
  psyField(e) {
    const now = this.s.time.now;
    if (now - (e.psyAt || -999) < 350) return;
    e.psyAt = now;
    const x = e.x, y = e.y, R = 54;
    for (const o of this.s.enemies) {
      if (!o.alive || o.boss || Math.abs(o.x - x) > R || Math.abs(o.y - y) > R * .8) continue;
      o.b.setVelocity((x - o.x) * 5, (y - o.y) * 4);   // 끌어당김
      this.applyStatus(o, { stun: .25 });
    }
    this.fx.ring(x, y, R, 0xff6ad8, 260); this.fx.glow(x, y, 30, 0xb05aff, 260, .7);
    this.fx.burst(x, y, [0xff6ad8, 0xb05aff, 0xffffff], 10, 70, { angle: 0, spread: 7, up: 0, grav: 0, bounce: false, glow: true, life: .3 });
    this.s.time.delayedCall(250, () => {
      if (!this.s.player) return;
      this.hitCircle(x, y, 34, .55, 'psychic', { proc: true, kbx: 60, kby: -60, hs: 0 });
      this.fx.ring(x, y, 34, 0xffffff, 200);
    });
  }

  hitRect(rect, mul, type, o = {}) {
    let n = 0;
    for (const e of this.s.enemies) {
      if (!e.alive || (o.set && o.set.has(e)) || !overlap(rect, e.bounds())) continue;
      if (o.set) o.set.add(e);
      const dir = Math.sign(e.x - (o.fromX ?? this.p.x)) || this.p.face;
      this.damageEnemy(e, this.p.atk * mul, type, Object.assign({}, o, { kb: (o.kbx ?? 120) * dir, kby: o.kby ?? -90 }));
      if (o.onHit) o.onHit(e);   // 맞은 자리 연출 (톱니 타격 섬광 등)
      n++;
    }
    if (this.s.props) this.s.props.hitRect(rect, o.src);   // 나무 상자도 부서진다 (o.src: 차징 샷 · 내려찍기 — 연습용 과녁)
    if (this.s.hitBreakables) this.s.hitBreakables(rect);   // 금 간 벽도 (세 번 치면 무너진다)
    return n;
  }
  hitCircle(cx, cy, r, mul, type, o = {}) {
    let n = 0;
    for (const e of this.s.enemies) {
      if (!e.alive || (o.set && o.set.has(e)) || !circRect(cx, cy, r, e.bounds())) continue;
      if (o.set) o.set.add(e);
      const dir = Math.sign(e.x - cx) || 1;
      this.damageEnemy(e, this.p.atk * mul, type, Object.assign({}, o, { kb: (o.kbx ?? 160) * dir, kby: o.kby ?? -140, hx: e.x, hy: e.y }));
      if (o.onHit) o.onHit(e);
      n++;
    }
    if (this.s.props) this.s.props.hitCircle(cx, cy, r, o.src);
    if (this.s.hitBreakables) this.s.hitBreakables({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 });
    return n;
  }
  enemiesIn(rect) { return this.s.enemies.filter(e => e.alive && overlap(rect, e.bounds())); }
  // 반사탄이 노릴 적: 그 탄을 쏜 적(살아 있고 맞을 수 있으면) · 아니면 탄에서 가장 가까운 적
  reflectTarget(q) {
    const s = q.src;
    if (s && s.alive && !s.intangible && !s.gone && this.s.enemies.includes(s)) return s;
    return this.nearest(q.x, q.y, 1, REFLECT_RANGE)[0] || null;
  }
  nearest(x, y, n = 1, range = 400) {
    return this.s.enemies.filter(e => e.alive && !e.intangible && Math.abs(e.x - x) < range && Math.abs(e.y - y) < range * .7)
      .sort((a, b) => Phaser.Math.Distance.Between(x, y, a.x, a.y) - Phaser.Math.Distance.Between(x, y, b.x, b.y)).slice(0, n);
  }

  // ---------------- 광원 (Light2D) ----------------
  takeLight(x, y, radius, color, intensity = 1.6) {
    const lights = this.s.lights;
    if (!lights || !lights.active) return null;
    let l = this.freeLights.pop();
    if (l) { l.setPosition(x, y); l.setRadius(radius); l.setColor(color); l.setIntensity(intensity); l.setVisible(true); }
    else if (this.s.dynLights < 8) { this.s.dynLights++; l = lights.addLight(x, y, radius, color, intensity); }
    return l || null;
  }
  freeLight(l) { if (!l) return; l.setIntensity(0); l.setVisible(false); this.freeLights.push(l); }

  // ---------------- 투사체 ----------------
  // c: { owner:'player'|'enemy', x,y,vx,vy, r, mul(플레이어)|dmg(적), type, life, pierce, grav, kind, color,
  //      homing, boomerang, ghost(벽 통과), status:{...}, boom:{r,mul}, onHit(e), light,
  //      update(q, dt) — 매 프레임 움직임을 직접 정한다 (떠올라 대기하는 파편 · 돌아오는 숟가락 · 몸 둘레를 도는 구슬) }
  spawnProjectile(c) {
    const s = this.s, color = c.color ?? typeColor(c.type);
    // 진화 단계별 투사체 수 (한 번에 = 0.14초 안): 1단(유년기)은 단발 1발 · 2단은 2발 + 기술머신 카드로 얻은 추가 투사체 · 3단·메가는 제한 없음
    //  → 진화와 카드 파밍으로 화면을 뒤덮는 다중 투사체를 얻는다. 차징 샷 · Z기술은 예외. 걸러진 탄은 빈 껍데기를 돌려줘 부르는 쪽이 그대로 굴러가게 한다
    const pl = this.p;
    if ((c.owner ?? 'player') === 'player' && !this.chargeSpawn && !c.bonus && pl && pl.tierIdx <= 1 && !(pl.action && pl.action.slot === 'zmove')) {   // bonus: 스킬 강화 카드의 분열탄은 제한 밖
      const now = s.time.now, cap = pl.tierIdx === 0 ? 1 : 2 + (pl.mods.extraProj || 0);
      if (now - (this.volleyAt ?? -999) >= 140) { this.volleyAt = now; this.volleyN = 0; }
      if (++this.volleyN > cap) return { dead: true, x: c.x, y: c.y, vx: 0, vy: 0, r: c.r || 4, hit: new Set(), status: {}, life: 0 };
    }
    const q = Object.assign({ owner: 'player', vx: 0, vy: 0, r: 4, life: 1, pierce: 1, grav: 0, t: 0, hit: new Set(), status: {} }, c);
    q.color = color;
    if (q.owner === 'enemy' && q.fast) {
      const sp = Math.hypot(q.vx, q.vy), k = (q.update ? ENEMY_FAST : Math.max(ENEMY_FAST * (q.spdMul || 1), q.boss && sp >= 20 ? BOSS_MIN_SPEED / sp : 0)) * (q.boss ? BOSS_SHOT_K : 1);   // 보스 탄: 보스별 배율(다크라이 2배) · 최소 속도 · 전체 5% 하향
      q.vx *= k; q.vy *= k;
      if (!q.update) { q.grav *= k * k; q.life /= k; q.hold = SHOT_HOLD; if (q.grow) q.grow *= k; if (q.homing) q.homing /= k; }   // 같은 궤적 · 같은 사거리로 더 빨리 + 예비 동작
      // 스스로 움직이는 탄(떨어지는 바위 · 떠올라 기다리다 날아오는 파편 · 조여 오는 손톱 · 도는 구슬)은 제 예비 동작이 따로 있다 — 날아가는 속도만 (Boss 의 update 가 ENEMY_FAST 를 곱한다)
    }
    Cores.projectile(this, q);   // 보스의 코어: 무지갯빛 불꽃 · 백옥 사거리 · 델타스트림 (game/Cores.js)
    if (q.owner === 'player') {
      const pa = this.p.action;
      if (pa && pa.comboStep && !this.chargeSpawn && !q.bonus) {   // 평타가 쏜 탄: 원거리형 표시 · 3타 피니시는 1.5배 강화 관통탄
        this.p.comboPulse();
        if (pa.finisher) { q.r *= 1.5; q.pierce = Math.max(q.pierce, 3); q.pow = (q.pow || 1) * 1.3; }
      }
      if (this.chargeSpawn) {   // Player.fireCharge 가 쏜 차징 탄 (계열 고유 차징 포함)
        q.charge = true;
        const cx = this.chargeCtx;   // 퍼펙트 차징: 확정 치명타 · 임팩트 웨이브: 그로기 2배 + 맞힌 자리에 2차 폭발 장판 (기본 차징 탄은 직접 터뜨린다)
        if (cx) {
          q.status = Object.assign({}, q.status, { chg: 1 }, cx.crit ? { crit: 1 } : {}, cx.shock ? { stagMul: 2 } : {});   // chg: 과부하 차징 캐논 (damageEnemy)
          if (cx.shock && !q.ownShock) { const end = q.onExpire; q.onExpire = qq => { if (end) end(qq); if (qq.hit.size) cx.shock(qq.x, qq.y); }; }
        }
      }
      q.dmg = this.p.atk * (q.mul ?? 1);
      if (this.p.mods.homing && !q.homing && !q.update && !q.boomerang && Math.hypot(q.vx, q.vy) > 40) q.homing = 1.4;   // 특성 카드: 유도 탄두
    }
    q.seed = Math.random() * 3;
    this.pr.attach(q);                                   // 속성별 도트 투사체
    if (q.hold > 0) {   // 예비 동작: 탄은 숨겨 두고 그 자리에 섬광이 모인다 (updateProjectiles 에서 놓는다)
      for (const o of [q.spr, q.glow, q.aura]) if (o) o.setVisible(false);
      this.pr.charge(q, q.hold);
      const now = s.time.now;
      if (now - (this.chargeSfxAt || -999) > 180) { this.chargeSfxAt = now; Sfx.play('echarge'); }
    } else if (q.muzzle !== false) this.pr.muzzle(q);    // 발사 섬광
    if (q.light) q.lightObj = this.takeLight(q.x, q.y, 70 + q.r * 4, color, 1.4);
    this.projs.push(q);
    return q;
  }

  killProj(q, i) {
    this.pr.detach(q);
    this.freeLight(q.lightObj);
    this.projs.splice(i, 1);
  }

  updateProjectiles(dt) {
    const s = this.s, p = this.p;
    this.pr.tick(this.projs);
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const q = this.projs[i];
      if (q.hold > 0) {   // 보스 · 엘리트 탄 예비 동작 중: 움직이지도 맞지도 않는다 → 다 되면 발사 섬광과 함께 날아간다
        q.hold -= dt;
        if (q.hold <= 0) { for (const o of [q.spr, q.glow, q.aura]) if (o) o.setVisible(true); if (q.muzzle !== false) this.pr.muzzle(q); }
        continue;
      }
      q.t += dt; q.life -= dt;
      if (q.update) q.update(q, dt);
      if (q.homing && q.t < q.homing) {
        const tgt = q.owner === 'player' ? this.nearest(q.x, q.y, 1, 220)[0] : p;
        if (tgt) {
          const want = Math.atan2(tgt.y - q.y, tgt.x - q.x), cur = Math.atan2(q.vy, q.vx), sp = Math.hypot(q.vx, q.vy);
          const d = Phaser.Math.Angle.Wrap(want - cur), na = cur + Phaser.Math.Clamp(d, -3 * dt, 3 * dt);
          q.vx = Math.cos(na) * sp; q.vy = Math.sin(na) * sp;
        }
      }
      if (q.seek) {   // 패링 반사탄: 노린 적을 초당 최대 REFLECT_TURN 으로 부드럽게 쫓는다 (그 적이 쓰러지면 가장 가까운 적)
        const t = q.seek.alive && !q.seek.intangible && !q.seek.gone ? q.seek : (q.seek = this.reflectTarget(q));
        if (t) {
          const want = Math.atan2(t.y - q.y, t.x - q.x), cur = Math.atan2(q.vy, q.vx), sp = Math.hypot(q.vx, q.vy);
          const na = cur + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - cur), -REFLECT_TURN * dt, REFLECT_TURN * dt);
          q.vx = Math.cos(na) * sp; q.vy = Math.sin(na) * sp;
        }
      }
      if (q.boomerang && q.t > q.boomerang) {   // 돌아오는 잎날
        const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1, sp = 260;
        q.vx += (dx / d * sp - q.vx) * Math.min(1, dt * 6); q.vy += (dy / d * sp - q.vy) * Math.min(1, dt * 6);
        if (d < 12) q.life = 0;
        if (!q.returned) { q.returned = true; q.hit.clear(); }
      }
      q.vy += q.grav * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.grow) q.r += q.grow * dt;
      this.pr.update(q, dt);                             // 그림 위치·회전·애니메이션 + 꼬리 파티클
      if (q.lightObj) q.lightObj.setPosition(q.x, q.y);

      let dead = q.life <= 0 || !!q.kill, why = q.kill || (dead ? 'expire' : null);   // q.kill: update 갈고리가 정한 최후 ('wall' 이면 벽에 부딪힌 연출)
      if (!dead && !q.ghost && s.isSolidAt(q.x, q.y)) {
        dead = true; why = 'wall';
        if (q.owner === 'player' && s.hitBreakables) s.hitBreakables({ x: q.x - q.r - 2, y: q.y - q.r - 2, w: q.r * 2 + 4, h: q.r * 2 + 4 });   // 투사체로도 금 간 벽을 깬다
      }
      if (!dead && q.owner === 'player') {
        if (s.props) s.props.hitCircle(q.x, q.y, q.r, q.charge ? 'charge' : null);   // 차징 샷 탄은 연습용 나무 상자도 부순다
        for (const e of s.enemies) {
          if (!e.alive || q.hit.has(e) || !circRect(q.x, q.y, q.r, e.bounds())) continue;
          q.hit.add(e);
          if (q.boom) { dead = true; why = 'hit'; break; }
          if (q.onHit) q.onHit(e, q);
          else this.damageEnemy(e, q.dmg, q.type, Object.assign({ kb: Math.sign(q.vx || 1) * (q.kb ?? 90), kby: -60, hx: q.x, hy: q.y }, q.status));
          this.pr.impact(q, 'hit');                       // 관통하는 잎날도 맞힐 때마다 베기 연출
          if (--q.pierce <= 0) { dead = true; why = 'done'; break; }
        }
      } else if (!dead && q.owner === 'enemy' && p.parryZone() && p.inParry(p.parryZone(), q.x, q.y, q.r)) {
        // ⚠️ 붉은 안광(패링 불가) 탄: 받아치지 못하고 가드 브레이크 · 피해 ×DANGER_MUL (Boss.dangerOn)
        if (q.danger || (q.src && q.src.danger)) {
          p.guardBreak(q.x, q.y);
          if (p.takeHit(q.dmg * DANGER_MUL, q.type, q.x - q.vx * .1, Object.assign({}, q.status, { noParry: true }))) { dead = true; why = 'hit'; }
        } else {
        // 패링 자세(지상 ↓ + Z) → 반사: 아군 황금빛 탄이 되어 되돌아간다 (속도 2배 · 최대 900) · 250% 피해 × 연속 패링 점감
        //  쏜 적(없으면 가장 가까운 적)의 중심을 겨눠 날아가고, 그 적이 움직이면 초당 40° 까지 꺾어 따라간다 (q.seek)
        const amp = p.mods.reflectAmp || 0;   // 증폭 반사경 카드: 반사탄 크기 · 비행 속도 +30% · 반사 피해 +15% (합성하면 더)
        const ch = p.doParry(q.x, q.y, 'proj'), i = Math.min(ch.n, PARRY_SIZE.length) - 1, sp = Math.hypot(q.vx, q.vy) || 1, v = Math.min(900 * (1 + .3 * amp), sp * 2 * (1 + .3 * amp)) / sp;
        const tgt = this.reflectTarget(q);
        if (tgt) { const a = Math.atan2(tgt.y - q.y, tgt.x - q.x); q.vx = Math.cos(a) * sp * v; q.vy = Math.sin(a) * sp * v; } else { q.vx = -q.vx * v; q.vy = -q.vy * v; }
        q.seek = tgt; q.update = null;   // 스스로 움직이던 탄(떨어지는 바위 · 도는 구슬)도 이제 곧게 날아간다
        q.owner = 'player'; q.grav = 0; q.dmg = Math.max(q.dmg * 2.5, p.atk * 2.5) * ch.dmg * (1 + .15 * amp) * (ch.pow || 1); q.hit = new Set(); q.life = 1.5; q.homing = 0; q.tier = 3; q.ghost = false;   // ch.pow: 천공의 반격 · 찰나의 카운터
        q.r = Math.max(3, q.r * PARRY_SIZE[i] * (1 + .3 * amp));   // 연속으로 쳐낼수록 반사탄이 작아진다
        q.color = PARRY_COL[i]; q.status = { kb: 0, parried: true, parryN: ch.n, parryDmg: ch.dmg, parryStag: ch.stag }; q.parried = true;   // 맞히면 무조건 약점 · 그로기 (damageEnemy)
        continue;
        }
      } else if (!dead && q.owner === 'enemy' && circRect(q.x, q.y, q.r, p.bounds())) {
        const r = p.blockProjectile(q);
        if (r === 'reflect') { q.owner = 'player'; q.vx = -q.vx * 1.2; q.vy *= -.3; q.dmg = p.atk * 2; q.hit = new Set(); q.life = 1.2; q.homing = 0; q.type = p.sp.types[0]; q.tier = p.tierIdx; this.fx.ring(q.x, q.y, 14, 0xbfe6ff, 200); continue; }
        if (r === 'block') { dead = true; why = 'wall'; }
        else if (p.takeHit(q.dmg, q.type, q.x - q.vx * .1, Object.assign({ noParry: true }, q.status))) { dead = true; why = 'hit'; }
      }
      if (dead) {
        if (q.boom) { this.explode(q); this.pr.impact(q, 'hit'); }
        else if (why !== 'done') this.pr.impact(q, why || 'expire');   // 적·벽에 맞으면 속성별 적중 연출 (이미 터뜨린 마지막 적중은 빼고)
        if (q.onExpire) q.onExpire(q);
        this.killProj(q, i);
      }
    }
    // 투사체끼리 부딪혀 사라지던 규칙(clashProjectiles)은 껐다 — 적 탄은 패링 자세(지상 ↓ + Z)로 쳐낸다 (Player.parryZone)
  }

  // ---------------- 투사체끼리 부딪힘 (플레이어 쪽 ↔ 적 쪽) ----------------
  //  하나라도 단발이면 둘 다 부서져 사라진다.
  //  둘 다 연속 투사체(불꽃세례·연사·탄막)면 맞대결: 진화 단계(1단 0 ~ 메가 3) → 속성 상성 → 공격력 순으로 이긴 쪽만 계속 날아간다.
  clashProjectiles() {
    const mine = this.projs.filter(q => q.owner === 'player'), theirs = this.projs.filter(q => q.owner === 'enemy');
    if (!mine.length || !theirs.length) return;
    const gone = new Set();
    for (const a of mine) {
      for (const b of theirs) {
        if (gone.has(b)) continue;
        const dx = a.x - b.x, dy = a.y - b.y, rr = a.r + b.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        const duel = a.stream && b.stream, w = duel ? this.clashWinner(a, b) : { win: 0 };
        if (w.win >= 0) gone.add(b);
        if (w.win <= 0 && !a.charge) gone.add(a);   // 차징 탄은 적 탄을 부수고 그대로 날아간다
        this.clashFx((a.x + b.x) / 2, (a.y + b.y) / 2, a, b, duel, w);
        if (gone.has(a)) break;
      }
    }
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const q = this.projs[i];
      if (!gone.has(q)) continue;
      if (q.boom) this.explode(q);   // 섀도볼·물폭탄 같은 폭발탄은 부딪힌 자리에서 터진다
      this.pr.impact(q, 'hit');
      if (q.onExpire) q.onExpire(q);
      this.killProj(q, i);
    }
  }

  // 맞대결 승자 { win: 1 플레이어 쪽(a) · -1 적 쪽(b) · 0 무승부, why: 이유 }
  clashWinner(a, b) {
    const ta = a.tier || 0, tb = b.tier || 0;
    if (ta !== tb) return { win: ta > tb ? 1 : -1, why: '진화' };
    const ea = typeMultiplier(a.type, [b.type]), eb = typeMultiplier(b.type, [a.type]);
    if (ea !== eb) return { win: ea > eb ? 1 : -1, why: '상성' };
    const pa = this.clashPower(a), pb = this.clashPower(b);   // 속성이 같거나 서로 상성이 없으면 공격력
    if (Math.abs(pa - pb) > .05) return { win: pa > pb ? 1 : -1, why: '위력' };
    return { win: 0, why: '' };
  }
  // 투사체 공격력: 맞았을 때 피해 + 폭발 피해 (플레이어 폭발탄은 공격력 × 배율)
  clashPower(q) { return (q.dmg || 0) + (q.boom ? (q.owner === 'player' ? this.p.atk * (q.boom.mul || 0) : q.dmg || 0) : 0); }

  // 부딪힘 연출: 두 색이 튀는 불꽃 + 작은 충격 고리. 맞대결은 이긴 쪽 색으로 번쩍이고, 가끔 이유를 띄운다 (연사끼리 계속 부딪혀도 글자는 0.7초에 한 번)
  clashFx(x, y, a, b, duel, w) {
    const ca = a.color ?? 0xffffff, cb = b.color ?? 0xffffff, winCol = w.win > 0 ? ca : w.win < 0 ? cb : 0xffffff;
    this.fx.burst(x, y, [ca, cb, 0xffffff], duel ? 8 : 10, 120, { up: 30, glow: true, life: .35 });
    this.fx.ring(x, y, duel && w.win ? 12 : 9, winCol, 160);
    this.fx.glow(x, y, 12, winCol, 140, .9);
    Sfx.play('clash');
    if (duel && w.win && this.s.time.now - (this.clashTextAt || -9999) > 700) {
      this.clashTextAt = this.s.time.now;
      this.fx.floatText(x, y - 8, w.win > 0 ? `${w.why} 우위!` : `${w.why} 열세…`, w.win > 0 ? '#ffe08a' : '#b0a8c8', 9);
    }
  }

  explode(q) {
    const b = q.boom;
    if (q.owner === 'player') this.hitCircle(q.x, q.y, b.r, b.mul, q.type, Object.assign({ kbx: b.kb ?? 200, kby: -200, src: q.charge ? 'charge' : undefined }, q.status));
    else if (Phaser.Math.Distance.Between(q.x, q.y, this.p.x, this.p.y) < b.r) this.p.takeHit(q.dmg, q.type, q.x, { danger: !!q.danger });   // 붉은 안광 폭발탄은 패링 불가
    this.fx.ring(q.x, q.y, b.r, q.color, 280); this.fx.glow(q.x, q.y, b.r, q.color, 260, .9);
    this.fx.burst(q.x, q.y, [q.color, 0xffffff], 22, b.r * 3, { up: 80, glow: true });
    this.fx.shake(b.r > 50 ? .012 : .006, 200, q.owner === 'player' ? 'hit' : 'world'); Sfx.play('boom');
  }

  clearEnemyProjectiles(rect) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const q = this.projs[i];
      if (q.owner === 'enemy' && (!rect || overlap(rect, { x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 }))) { this.pr.impact(q, 'expire'); this.killProj(q, i); }
    }
  }

  // ---------------- 장판 / 경고 판정 ----------------
  // c: { owner, x,y,w,h, life, tick, onTick(z), delay(경고 시간), dmg, type, draw:'seed'|'warn'|..., color,
  //      round(둥근 경고 → draw:'burst' 둥근 폭발), onUpdate(z, dt), onEnd(z), dispose(z) — 끝나거나 전투가 정리될 때 그림 치우기 }
  spawnZone(c) { const z = Object.assign({ owner: 'player', t: 0, tt: 0, tick: .25, life: 1, delay: 0, done: false }, c); this.zones.push(z); return z; }

  updateZones(dt) {
    const p = this.p, g = this.zg, gn = this.zgn, now = this.s.time.now;
    g.clear(); gn.clear();
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt; z.tt -= dt;
      const live = z.t >= z.delay;
      if (live && z.tt <= 0 && z.onTick) { z.tt = z.tick; z.onTick(z); }
      if (live && z.owner === 'enemy' && z.dmg && !z.done && overlap(z, p.bounds())) { if (p.takeHit(z.dmg, z.type, z.x + z.w / 2, z.status || {})) z.done = !z.multi; }
      // 그리기
      const col = z.color ?? typeColor(z.type), k = Math.min(1, z.t * 6, (z.life - z.t) * 4);
      if (!live && z.round) {   // 둥근 경고: 테두리가 깜빡이고 안쪽이 차오른다 (미래예지)
        const blink = (Math.floor(now / 70) % 2) ? .7 : .3, cx = z.x + z.w / 2, cy = z.y + z.h / 2, r = z.w / 2;
        g.fillStyle(col, .1 + z.t / z.delay * .22); g.fillCircle(cx, cy, r * (.25 + .75 * z.t / z.delay));
        g.lineStyle(1.5, col, blink); g.strokeCircle(cx, cy, r);
      } else if (!live) {   // 경고: 깜빡이는 테두리
        const blink = (Math.floor(now / 70) % 2) ? .55 : .25;
        g.fillStyle(col, .12 + z.t / z.delay * .2); g.fillRect(z.x, z.y, z.w, z.h);
        g.fillStyle(col, blink); g.fillRect(z.x, z.y + z.h - 2, z.w, 2); g.fillRect(z.x, z.y, z.w, 1); g.fillRect(z.x, z.y, 1, z.h); g.fillRect(z.x + z.w - 1, z.y, 1, z.h);
      } else if (z.draw === 'seed') {
        g.fillStyle(col, .18 * k); g.fillRect(z.x, z.y, z.w, z.h);
        g.fillStyle(col, .8 * k); g.fillRect(z.x, z.y + z.h - 2, z.w, 2);
        for (let j = 0; j < z.w / 6; j++) { const yy = z.y + z.h - ((now / 30 + j * 13) % z.h); g.fillRect(z.x + j * 6 + 2, Math.round(yy), 1, 2); }
      } else if (z.draw === 'pillar' || z.draw === 'beam') {
        const fade = 1 - (z.t - z.delay) / Math.max(.01, z.life - z.delay);
        g.fillStyle(col, .7 * fade); g.fillRect(z.x, z.y, z.w, z.h);
        g.fillStyle(0xffffff, .8 * fade);
        if (z.draw === 'beam') g.fillRect(z.x, z.y + z.h / 2 - 1, z.w, 3); else g.fillRect(z.x + z.w / 2 - 1, z.y, 3, z.h);
      } else if (z.draw === 'cloud') {
        for (let j = 0; j < 8; j++) { const cx = z.x + ((j * 37 + now / 40) % z.w), cy = z.y + z.h / 2 + Math.sin(now / 300 + j) * z.h / 3; g.fillStyle(col, .22 * k); g.fillCircle(Math.round(cx), Math.round(cy), 6 + (j % 3) * 2); }
      } else if (z.draw === 'poison') {   // 오물폭탄 독 웅덩이: 보글보글 거품이 올라온다
        g.fillStyle(col, .32 * k); g.fillRect(z.x, z.y + z.h - 5, z.w, 5);
        g.fillStyle(0x3a0a4a, .5 * k); g.fillRect(z.x + 2, z.y + z.h - 2, z.w - 4, 2);
        for (let j = 0; j < z.w / 8; j++) { const ph = (now / 500 + j * .37) % 1, bx = z.x + 4 + j * 8 + Math.sin(j * 7) * 2; g.fillStyle(j % 2 ? 0xc8ff6a : col, .8 * k * (1 - ph)); g.fillRect(Math.round(bx), Math.round(z.y + z.h - 4 - ph * 10), 2, 2); }
      } else if (z.draw === 'burst') {   // 둥근 폭발: 꽉 찬 원 + 하얀 속 (빠르게 옅어진다)
        const fade = 1 - (z.t - z.delay) / Math.max(.01, z.life - z.delay), cx = z.x + z.w / 2, cy = z.y + z.h / 2;
        g.fillStyle(col, .55 * fade); g.fillCircle(cx, cy, z.w / 2);
        g.fillStyle(0xffffff, .7 * fade); g.fillCircle(cx, cy, z.w * .22);
      } else if (z.draw === 'fire') {
        g.fillStyle(col, .3 * k); g.fillRect(z.x, z.y, z.w, z.h);
        if (Math.random() < .6) this.fx.embers(z.x + Math.random() * z.w, z.y + z.h, [col, 0xffe08a], 1, { speed: 20 });
      }
      if (z.onUpdate) z.onUpdate(z, dt);
      if (z.t >= z.life) { if (z.onEnd) z.onEnd(z); if (z.dispose) z.dispose(z); this.zones.splice(i, 1); }
    }
  }

  clearAll() {
    for (let i = this.projs.length - 1; i >= 0; i--) this.killProj(this.projs[i], i);
    for (const z of this.zones) if (z.dispose) z.dispose(z);
    this.zones = [];
  }
}
