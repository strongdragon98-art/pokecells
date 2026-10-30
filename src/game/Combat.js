// 전투 공통: 상성 데미지 계산, 범위 판정, 상태이상, 투사체, 장판
import Phaser from 'phaser';
import { typeMultiplier, effectiveness, typeColor } from '../data/types.js';
import { Sfx } from '../systems/Audio.js';
import { ProjectileRenderer } from '../systems/ProjectileRenderer.js';
import { onHit as perkHit } from './Perks.js';
const GROGGY_MUL = 1.35;   // game/Boss.js GROGGY_MUL 과 같은 값 (Boss → Combat 순환 import 를 피해 따로 둔다)

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
    const m0 = typeMultiplier(type, e.types), m = o.ignoreResist ? Math.max(1, m0) : m0;   // 깨물어부수기: 반감 무시
    const eff = effectiveness(m);
    let d = base * m * mods.all * (1 + (mods.typeBoost[type] || 0));
    if (e.status.curse > 0) d *= 1.3;
    if (mods.execute && e.hp <= e.maxhp * .25) d *= 1 + mods.execute;   // 특성 카드: 마무리 일격
    if (e.groggyT > 0) d *= GROGGY_MUL;   // 보스 그로기(약점 누적으로 자세 무너짐): 받는 피해 ×1.35
    if (e.guardMul) d *= e.guardMul;
    const crit = !o.dot && Math.random() < .06 + (o.crit || 0) + mods.crit;
    if (crit) d *= 1.6 * (mods.critMul || 1);   // 피트렌즈: 급소 피해 +20%
    d += o.flat || 0;
    d = Math.max(1, Math.round(d * (.92 + Math.random() * .16)));
    e.hp -= d;
    if (o.dot) this.fx.floatText(e.x, e.top, String(d), o.dot === 'burn' ? '#ffb070' : '#c8a0ff', 10);
    else {
      this.fx.damage(e.x, e.top - 2, d, eff, crit);
      e.flash(e.boss ? 50 : 90);   // 큰 보스는 짧게 번쩍여 화면을 덮지 않게
      this.fx.hitStop(o.hs ?? (eff === 'super' ? 70 : crit ? 60 : 50));
      if (eff === 'super') this.fx.shake(.009, 170, 'hit'); else if (eff === 'normal') this.fx.shake(.004, 90, 'hit'); else this.fx.shake(.002, 60, 'hit');
      const hx = o.hx ?? e.x, hy = o.hy ?? e.y;
      this.fx.burst(hx, hy, [typeColor(type), 0xffffff], eff === 'super' ? 18 : eff === 'weak' ? 4 : 10, eff === 'super' ? 170 : 110, { up: 60 });
      if (eff === 'super') { this.fx.glow(hx, hy, 26, typeColor(type), 220, .9); this.fx.ring(hx, hy, 30, 0xffb050, 240); }
      // 타격 파편: 굵은 속성색 조각이 튀어 바닥에 튕긴다 (반감은 적게 · 묵직한 타격은 많이)
      this.fx.burst(hx, hy, [typeColor(type), 0xffffff, 0x2a2438], eff === 'weak' ? 2 : o.heavy ? 9 : 5, o.heavy ? 200 : 140, { up: 90, size: 2, life: .45 });
      Sfx.play(o.heavy ? 'hit_heavy' : eff === 'super' ? 'hit_super' : eff === 'weak' ? 'hit_weak' : 'hit_normal');   // heavy: 차징 샷 · 내려찍기 (저음 폭발)
      if (crit) Sfx.play('crit');
      if (!e.boss && (o.kb || o.kby)) e.knock(o.kb || 0, o.kby || 0);
      const steal = (mods.lifesteal || 0) + (o.lifesteal || 0);
      if (steal > 0) p.heal(d * steal, true);
    }
    if (e.boss && e.addStagger && !o.dot) e.addStagger(m === 0 ? 'immune' : eff);   // 보스 그로기 게이지 (약점 속성은 3.5배)
    if (e.hp > 0) perkHit(this, e, d, type, o);   // 특성 카드: 화상·빙결·마비·독·저주 부여 · 연쇄 번개 · 장판 · 블랙홀
    if (e.hp <= 0 && !(e.cheatDeath && e.cheatDeath())) this.s.killEnemy(e);   // 칠색조 부활처럼 한 번 버티는 보스
    return d;
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
    if (this.s.props) this.s.props.hitRect(rect);   // 나무 상자도 부서진다
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
    if (this.s.props) this.s.props.hitCircle(cx, cy, r);
    if (this.s.hitBreakables) this.s.hitBreakables({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 });
    return n;
  }
  enemiesIn(rect) { return this.s.enemies.filter(e => e.alive && overlap(rect, e.bounds())); }
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
    const q = Object.assign({ owner: 'player', vx: 0, vy: 0, r: 4, life: 1, pierce: 1, grav: 0, t: 0, hit: new Set(), status: {} }, c);
    q.color = color;
    if (q.owner === 'player') {
      q.dmg = this.p.atk * (q.mul ?? 1);
      if (this.p.mods.homing && !q.homing && !q.update && !q.boomerang && Math.hypot(q.vx, q.vy) > 40) q.homing = 1.4;   // 특성 카드: 유도 탄두
    }
    q.seed = Math.random() * 3;
    this.pr.attach(q);                                   // 속성별 도트 투사체
    if (q.muzzle !== false) this.pr.muzzle(q);           // 발사 섬광
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
        if (s.props) s.props.hitCircle(q.x, q.y, q.r);
        for (const e of s.enemies) {
          if (!e.alive || q.hit.has(e) || !circRect(q.x, q.y, q.r, e.bounds())) continue;
          q.hit.add(e);
          if (q.boom) { dead = true; why = 'hit'; break; }
          if (q.onHit) q.onHit(e, q);
          else this.damageEnemy(e, q.dmg, q.type, Object.assign({ kb: Math.sign(q.vx || 1) * (q.kb ?? 90), kby: -60, hx: q.x, hy: q.y }, q.status));
          this.pr.impact(q, 'hit');                       // 관통하는 잎날도 맞힐 때마다 베기 연출
          if (--q.pierce <= 0) { dead = true; why = 'done'; break; }
        }
      } else if (!dead && q.owner === 'enemy' && circRect(q.x, q.y, q.r, p.bounds())) {
        const r = p.blockProjectile(q);
        if (r === 'reflect') { q.owner = 'player'; q.vx = -q.vx * 1.2; q.vy *= -.3; q.dmg = p.atk * 2; q.hit = new Set(); q.life = 1.2; q.homing = 0; q.type = p.sp.types[0]; q.tier = p.tierIdx; this.fx.ring(q.x, q.y, 14, 0xbfe6ff, 200); continue; }
        if (r === 'block') { dead = true; why = 'wall'; }
        else if (p.takeHit(q.dmg, q.type, q.x - q.vx * .1, q.status || {})) { dead = true; why = 'hit'; }
      }
      if (dead) {
        if (q.boom) { this.explode(q); this.pr.impact(q, 'hit'); }
        else if (why !== 'done') this.pr.impact(q, why || 'expire');   // 적·벽에 맞으면 속성별 적중 연출 (이미 터뜨린 마지막 적중은 빼고)
        if (q.onExpire) q.onExpire(q);
        this.killProj(q, i);
      }
    }
    this.clashProjectiles();
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
        if (w.win <= 0) gone.add(a);
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
    if (q.owner === 'player') this.hitCircle(q.x, q.y, b.r, b.mul, q.type, Object.assign({ kbx: b.kb ?? 200, kby: -200 }, q.status));
    else if (Phaser.Math.Distance.Between(q.x, q.y, this.p.x, this.p.y) < b.r) this.p.takeHit(q.dmg, q.type, q.x, {});
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
