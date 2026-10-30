// 기술머신 특성 카드(perk): 카드로 받은 포켓몬에게만 남는 상시 효과 (Player.members[i].perks = { id: 겹친 수 })
//  수치형 효과는 mods 로 합쳐지고(data/items.js computeMods), 적중·피격·처치 때 터지는 효과는 아래 onHit / onHurt / onKill 갈고리가 맡는다
//  등급: 커먼 · 레어 · 유니크 · 전설 (data/tm.js GRADE) — max: 겹칠 수 있는 최대 수 (전설 유물은 1개)
import Phaser from 'phaser';
import { Sfx } from '../systems/Audio.js';

export const PERKS = {
  // ================= ⚪ 커먼 =================
  c_power: { grade: '커먼', cat: '능력치', name: '숙련의 기억: 힘', desc: '이 포켓몬의 공격력 +10%.', max: 5, mods: { atkMul: 1.1 } },
  c_focus: { grade: '커먼', cat: '능력치', name: '숙련의 기억: 집중', desc: '모든 기술 쿨타임 -10%.', max: 4, mods: { cdMul: .9 } },
  c_vigor: { grade: '커먼', cat: '능력치', name: '단련된 몸', desc: '최대 체력 +15%.', max: 4, mods: { hpMul: 1.15 } },
  c_swift: { grade: '커먼', cat: '기동', name: '신속의 깃털', desc: '이동 속도 +12%.', max: 3, mods: { speedMul: 1.12 } },
  c_dash: { grade: '커먼', cat: '기동', name: '질풍 대시', desc: '대시 쿨타임 -25%.', max: 2, mods: { dashCdMul: .75 } },
  c_regen: { grade: '커먼', cat: '유틸', name: '오렌 주머니', desc: '출전 중 매초 최대 체력의 0.4% 회복.', max: 3, mods: { regen: .004 } },
  c_crit: { grade: '커먼', cat: '능력치', name: '날카로운 눈', desc: '급소율 +8%.', max: 3, mods: { crit: .08 } },
  c_guard: { grade: '커먼', cat: '유틸', name: '단단한 비늘', desc: '받는 피해 -8%.', max: 3, mods: { guard: .92 } },
  c_swap: { grade: '커먼', cat: '유틸', name: '재빠른 교대', desc: '교대 쿨타임 -25%.', max: 2, mods: { swapCdMul: .75 } },
  c_leech: { grade: '커먼', cat: '유틸', name: '흡혈 이빨', desc: '준 피해의 3%만큼 회복.', max: 3, mods: { lifesteal: .03 } },
  c_reach: { grade: '커먼', cat: '능력치', name: '넓은 시야', desc: '공격 판정·이펙트 크기 +12%.', max: 3, mods: { sizeAdd: .12 } },
  c_iframe: { grade: '커먼', cat: '기동', name: '회피 본능', desc: '대시 무적 시간 +50%.', max: 2, mods: { dashInvAdd: .13 } },

  // ================= 🔵 레어 =================
  r_jump: { grade: '레어', cat: '기동', name: '비상의 깃털', desc: '공중 점프 횟수 +1.', max: 2, mods: { extraJumps: 1 } },
  r_dash: { grade: '레어', cat: '기동', name: '순풍의 가호', desc: '대시 쿨타임 -40%.', max: 1, mods: { dashCdMul: .6 } },
  r_speed: { grade: '레어', cat: '기동', name: '쾌속 스카프', desc: '이동 속도 +25%.', max: 2, mods: { speedMul: 1.25 } },
  r_burn: { grade: '레어', cat: '속성 부여', name: '불꽃 부여', desc: '적중 시 25% 확률로 화상 (4초 지속 피해).', max: 2, mods: { pBurn: .25 } },
  r_freeze: { grade: '레어', cat: '속성 부여', name: '냉기 부여', desc: '적중 시 15% 확률로 빙결 (1초 이동 불가).', max: 2, mods: { pFreeze: .15 } },
  r_para: { grade: '레어', cat: '속성 부여', name: '전기 부여', desc: '적중 시 25% 확률로 마비 (3초 속도 감소).', max: 2, mods: { pPara: .25 } },
  r_poison: { grade: '레어', cat: '속성 부여', name: '독 부여', desc: '적중 시 25% 확률로 맹독 (5초 지속 피해).', max: 2, mods: { pPoison: .25 } },
  r_proj: { grade: '레어', cat: '스킬 변이', name: '확산 렌즈', desc: '투사체 +1개.', max: 2, mods: { extraProj: 1 } },
  r_haste: { grade: '레어', cat: '능력치', name: '가속 회로', desc: '모든 기술 쿨타임 -18%.', max: 2, mods: { cdMul: .82 } },
  r_shell: { grade: '레어', cat: '유틸', name: '조개껍질 방울', desc: '준 피해의 6%만큼 회복.', max: 2, mods: { lifesteal: .06 } },
  r_bomb: { grade: '레어', cat: '대시 진화', name: '⚡ 대시 진화: 대시 폭탄', desc: '대시를 시작한 자리에 폭탄을 남긴다 (0.45초 뒤 폭발).', max: 1, mods: { dashBomb: 1 } },
  r_tough: { grade: '레어', cat: '유틸', name: '강철 몸', desc: '받는 피해 -15%.', max: 2, mods: { guard: .85 } },
  r_crit: { grade: '레어', cat: '능력치', name: '예리한 발톱', desc: '급소율 +15%.', max: 2, mods: { crit: .15 } },

  // ================= 🟣 유니크 =================
  u_curse: { grade: '유니크', cat: '속성 부여', name: '저주 부여', desc: '적중 시 30% 확률로 저주 (5초간 받는 피해 +30%).', max: 1, mods: { pCurse: .3 } },
  u_split: { grade: '유니크', cat: '스킬 변이', name: '분열 코어', desc: '투사체 +2갈래.', max: 1, mods: { extraProj: 2 } },
  u_giant: { grade: '유니크', cat: '스킬 변이', name: '거대화 코어', desc: '스킬 크기 1.5배.', max: 1, mods: { sizeMul: 1.5 } },
  u_chain: { grade: '유니크', cat: '스킬 변이', name: '연쇄 번개', desc: '적중 시 20% 확률로 가까운 적 3마리에게 번개가 연쇄로 튄다.', max: 1, mods: { chain: .2, chainN: 3 } },
  u_flame: { grade: '유니크', cat: '스킬 변이', name: '화염 장판', desc: '적중 시 20% 확률로 그 자리에 2초간 불타는 장판이 생긴다.', max: 1, mods: { flameZone: .2 } },
  u_toxic: { grade: '유니크', cat: '스킬 변이', name: '독 늪', desc: '적중 시 20% 확률로 그 자리에 2.5초간 독 늪이 생긴다.', max: 1, mods: { toxicZone: .2 } },
  u_homing: { grade: '유니크', cat: '스킬 변이', name: '유도 탄두', desc: '투사체가 가까운 적을 쫓아간다.', max: 1, mods: { homing: 1 } },
  u_clone: { grade: '유니크', cat: '대시 진화', name: '⚡ 대시 진화: 분신 베기', desc: '대시한 길에 분신이 남아 지나간 적을 벤다.', max: 1, mods: { dashClone: 1 } },
  u_berserk: { grade: '유니크', cat: '능력치', name: '역린의 비늘', desc: '체력 50% 이하일 때 공격력 +35%.', max: 1, mods: { berserk: .35 } },
  u_execute: { grade: '유니크', cat: '능력치', name: '마무리 일격', desc: '체력 25% 이하인 적에게 주는 피해 +50%.', max: 1, mods: { execute: .5 } },
  u_charge: { grade: '유니크', cat: '스킬 변이', name: '⚡ 초고압 차징 코어', desc: 'Z 홀드 차징이 3단까지 찬다 — 2단 중형 관통탄 · 3단 화면을 가르는 초대형 폭발 속성포 (피해 300%).', max: 1, mods: { chargeCore: true } },
  u_thorns: { grade: '유니크', cat: '유틸', name: '가시 갑옷', desc: '맞으면 주변 적에게 공격력 ×1.2 피해를 되돌려 준다.', max: 1, mods: { thorns: 1.2 } },

  // ================= ⚡ 대시 진화 (예전 단순 돌진 기술들의 기믹 → Shift 대시 자체가 공격기로) =================
  d_flame: { grade: '레어', cat: '대시 진화', name: '⚡ 대시 진화: 화염 대시', desc: '대시한 길에 2초간 불길 장판이 남는다 (화상).', max: 1, mods: { dashFlame: 1 } },
  d_aqua: { grade: '레어', cat: '대시 진화', name: '⚡ 대시 진화: 아쿠아 제트', desc: '대시 중 부딪히는 적을 물살로 밀쳐 내며 여러 번 친다.', max: 1, mods: { dashAqua: 1 } },
  d_frost: { grade: '레어', cat: '대시 진화', name: '⚡ 대시 진화: 서리 질주', desc: '대시로 스친 적을 얼려 둔화시키고, 지나간 길에 얼음 결정이 흩날린다.', max: 1, mods: { dashFrost: 1 } },
  d_thunder: { grade: '유니크', cat: '대시 진화', name: '⚡ 대시 진화: 썬더 스텝', desc: '대시를 시작한 자리와 끝난 자리에 낙뢰가 떨어져 폭발한다 (마비).', max: 1, mods: { dashThunder: 1 } },
  d_decoy: { grade: '유니크', cat: '대시 진화', name: '⚡ 대시 진화: 환영 분신', desc: '대시한 자리에 분신이 남아 1.2초 동안 주변 적을 끌어당긴 뒤 폭발한다.', max: 1, mods: { dashDecoy: 1 } },
  d_shadow: { grade: '유니크', cat: '대시 진화', name: '⚡ 대시 진화: 그림자 질주', desc: '대시 무적 시간 +0.2초. 스쳐 지나간 적에게 저주(받는 피해 +30%)를 건다.', max: 1, mods: { dashShadow: 1, dashInvAdd: .2 } },
  d_nova: { grade: '전설', cat: '대시 진화', name: '⚡ 대시 진화: 신속의 섬광', desc: '대시 쿨타임 -50%. 대시가 끝날 때마다 둘레에 빛의 충격파가 터진다.', max: 1, mods: { dashCdMul: .5, dashNova: 1 } },

  // ================= 🟡 전설 (태고의 유물) =================
  l_orb: { grade: '전설', cat: '유물', name: '태고의 유물: 생명의구슬', desc: '모든 최종 피해 +45%. 기술(X·C)을 쓸 때 체력 3% 소모, 적을 쓰러뜨리면 체력 3% 회복.', max: 1, mods: { allMul: 1.45, orbCost: true, killHeal: .03 } },
  l_band: { grade: '전설', cat: '유물', name: '태고의 유물: 구애머리띠', desc: 'Z칸 기술(기본 연타·근접) 피해 +60%.', max: 1, mods: { bandMul: 1.6 } },
  l_specs: { grade: '전설', cat: '유물', name: '태고의 유물: 구애안경', desc: 'X·C칸 기술 피해 +60%.', max: 1, mods: { specsMul: 1.6 } },
  l_sash: { grade: '전설', cat: '유물', name: '태고의 유물: 기합의띠', desc: '쓰러질 피해를 받으면 체력 1로 버티고 3초간 완전 무적 (방마다 1번).', max: 1, mods: { sturdy: 1 } },
  l_mega: { grade: '전설', cat: '유물', name: '태고의 유물: 메가스톤 코어', desc: '메가스톤 1개를 바로 얻고, 이 포켓몬의 진화 경험치 획득량 2배.', max: 1, mods: { expMul: 2 }, onGet: p => { p.mega.stones++; } },
  l_hole: { grade: '전설', cat: '스킬 변이', name: '태고의 유물: 사건의 지평선', desc: '적중 시 12% 확률로 블랙홀이 생겨 주변 적을 빨아들이며 계속 피해를 준다.', max: 1, mods: { blackhole: .12 } },
  l_storm: { grade: '전설', cat: '스킬 변이', name: '태고의 유물: 뇌신의 가호', desc: '적중 시 40% 확률로 연쇄 번개가 최대 5마리까지 튄다.', max: 1, mods: { chain: .4, chainN: 5 } }
};

const MUL = new Set(['atkMul', 'cdMul', 'hpMul', 'speedMul', 'dashCdMul', 'guard', 'swapCdMul', 'sizeMul', 'allMul', 'bandMul', 'specsMul', 'expMul']);
const MAXED = new Set(['chain', 'chainN']);   // 겹치지 않고 큰 쪽을 쓴다 (연쇄 번개 · 뇌신의 가호)

// 받은 특성 카드 → 수치 합계 (곱해지는 값은 곱하고, 나머지는 더한다)
export function perkMods(perks = {}) {
  const out = {};
  for (const [id, n] of Object.entries(perks)) {
    const pk = PERKS[id];
    if (!pk || !n) continue;
    for (const [k, v] of Object.entries(pk.mods)) {
      if (typeof v === 'boolean') out[k] = out[k] || v;
      else if (MAXED.has(k)) out[k] = Math.max(out[k] || 0, v);
      else if (MUL.has(k)) out[k] = (out[k] ?? 1) * Math.pow(v, n);
      else out[k] = (out[k] || 0) + v * n;
    }
  }
  return out;
}

// ---------------- 적중 갈고리 (Combat.damageEnemy 가 플레이어 공격이 맞을 때 부른다) ----------------
//  o.proc: 갈고리가 만든 2차 피해(연쇄 번개·장판·블랙홀)는 다시 갈고리를 부르지 않는다
export function onHit(combat, e, d, type, o) {
  const md = combat.p.mods, sc = combat.s, fx = combat.fx;
  if (o.proc || o.dot) return;
  const st = e.status, r = e.boss ? .3 : 1, atk = combat.p.atk;
  const roll = c => c > 0 && Math.random() < c;
  if (roll(md.pBurn)) { st.burn = Math.max(st.burn, 4); e.burnDps = atk * .28; fx.floatText(e.x, e.top - 10, '화상!', '#ffb070', 10); }
  if (roll(md.pPoison)) { st.poison = Math.max(st.poison, 5); e.poisonDps = atk * .3; fx.floatText(e.x, e.top - 10, '맹독!', '#c890ff', 10); }
  if (roll(md.pPara)) { st.slow = Math.max(st.slow, 3); fx.floatText(e.x, e.top - 10, '마비!', '#ffe36a', 10); fx.burst(e.x, e.y, [0xffe36a, 0xffffff], 6, 60, { glow: true, life: .3 }); }
  if (roll(md.pFreeze)) combat.applyStatus(e, { freeze: 1 });
  if (roll(md.pCurse)) { if (st.curse <= 0) fx.floatText(e.x, e.top - 10, '저주!', '#c890ff', 10); st.curse = Math.max(st.curse, 5); }
  if (roll(md.chain)) chainLightning(combat, e, md.chainN || 3);
  if (roll(md.flameZone)) groundZone(combat, e, 'fire', 0xff7a2a, 2, { burn: 3 });
  if (roll(md.toxicZone)) groundZone(combat, e, 'poison', 0xa04aff, 2.5, { poison: 4 });
  if (roll(md.blackhole) && !sc.blackholeOn) blackHole(combat, e.x, e.y);
  void r;
}

// 연쇄 번개: 맞은 적 → 가장 가까운 다른 적 → … (n마리)
function chainLightning(combat, from, n) {
  const sc = combat.s, hit = new Set([from]);
  let cur = from;
  for (let k = 0; k < n; k++) {
    const next = sc.enemies.filter(q => q.alive && !q.intangible && !hit.has(q) && Phaser.Math.Distance.Between(cur.x, cur.y, q.x, q.y) < 150)
      .sort((a, b) => Phaser.Math.Distance.Between(cur.x, cur.y, a.x, a.y) - Phaser.Math.Distance.Between(cur.x, cur.y, b.x, b.y))[0];
    if (!next) break;
    const a = cur, b = next;
    hit.add(b);
    sc.time.delayedCall(k * 70, () => {
      if (!b.alive) return;
      bolt(sc, a.x, a.y, b.x, b.y, 0xffe86a);
      combat.damageEnemy(b, combat.p.atk * .55, 'electric', { proc: true, hs: 20 });
    });
    cur = b;
  }
  if (hit.size > 1) Sfx.play('zap');
}

// 지그재그 번개 한 줄기 (흰 심 + 색 테두리)
export function bolt(sc, x1, y1, x2, y2, color, w = 2, ms = 220) {
  const g = sc.add.graphics().setDepth(42).setBlendMode(Phaser.BlendModes.ADD), pts = [{ x: x1, y: y1 }], seg = 7;
  for (let i = 1; i < seg; i++) { const k = i / seg; pts.push({ x: x1 + (x2 - x1) * k + (Math.random() - .5) * 12, y: y1 + (y2 - y1) * k + (Math.random() - .5) * 12 }); }
  pts.push({ x: x2, y: y2 });
  for (const [lw, c] of [[w + 3, color], [w, 0xffffff]]) { g.lineStyle(lw, c, lw > w ? .5 : 1); g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (const p of pts) g.lineTo(p.x, p.y); g.strokePath(); }
  sc.fx.glow(x2, y2, 14, color, ms, .9);
  sc.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
}

// 맞은 자리 바닥 장판 (화염 · 독)
function groundZone(combat, e, type, color, life, status) {
  const sc = combat.s, gy = sc.groundBelow(e.x, e.bottom - 4), w = 48;
  combat.spawnZone({
    owner: 'player', x: e.x - w / 2, y: gy - 14, w, h: 14, life, tick: .4, type, color, draw: 'seed',
    onTick: z => {
      combat.hitRect({ x: z.x, y: z.y, w: z.w, h: z.h }, .22, type, Object.assign({ proc: true, kbx: 0, kby: 0, hs: 0 }, status));
      sc.fx.burst(z.x + Math.random() * z.w, z.y + z.h - 2, [color, 0xffffff], 2, 30, { angle: -Math.PI / 2, spread: .5, up: 30, grav: -40, bounce: false, life: .5, glow: true });
    }
  });
}

// 블랙홀: 1.4초 동안 주변 적을 끌어당기며 0.2초마다 피해
function blackHole(combat, x, y) {
  const sc = combat.s, fx = combat.fx, R = 90;
  sc.blackholeOn = true;
  const core = sc.add.image(x, y, 'glow').setTint(0x1a0030).setScale(.2).setDepth(41);
  const rim = sc.add.image(x, y, 'glow').setTint(0x9a5aff).setBlendMode(Phaser.BlendModes.ADD).setScale(.3).setDepth(40).setAlpha(.8);
  sc.tweens.add({ targets: core, scale: 1, duration: 260, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: rim, scale: 1.8, duration: 260, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: rim, angle: 360, duration: 1400 });
  Sfx.play('ghost');
  let n = 0;
  const ev = sc.time.addEvent({
    delay: 100, repeat: 13, callback: () => {
      n++;
      for (const e of sc.enemies) {
        if (!e.alive || e.boss) continue;
        const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
        if (d < R && d > 6) e.b.setVelocity(dx / d * 160, dy / d * 160);
      }
      if (n % 2 === 0) combat.hitCircle(x, y, R * .55, .25, 'dark', { proc: true, kbx: 0, kby: 0, hs: 0 });
      for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2; fx.burst(x + Math.cos(a) * R * .8, y + Math.sin(a) * R * .8, [0x9a5aff, 0x2a0a3a], 1, 10, { grav: 0, bounce: false, life: .3, glow: true }); }
      if (n >= 14) {
        ev.remove(); sc.blackholeOn = false;
        combat.hitCircle(x, y, R * .7, 1.2, 'dark', { proc: true, kbx: 260, kby: -200, hs: 80 });
        fx.ring(x, y, R, 0xc08aff, 320); fx.shake(.01, 220, 'hit'); Sfx.play('boom');
        sc.tweens.add({ targets: [core, rim], scale: 0, alpha: 0, duration: 200, onComplete: () => { core.destroy(); rim.destroy(); } });
      }
    }
  });
}

// ---------------- 피격 갈고리 (Player.takeHit) ----------------
// 가시 갑옷: 맞으면 주변 적에게 되돌려 준다
export function onHurt(p) {
  const md = p.mods, sc = p.scene;
  if (md.thorns) {
    sc.combat.hitCircle(p.x, p.y, 50, md.thorns, p.types[0], { proc: true, kbx: 220, kby: -160, hs: 40 });
    sc.fx.ring(p.x, p.y, 46, 0xd8c8a0, 240);
  }
}

// ---------------- 대시 중 갈고리 (Player.update 대시 진행 중) ----------------
//  아쿠아 제트: 0.06초마다 몸 앞 판정으로 밀쳐 내며 다단히트 · 서리 질주: 스친 적 빙결·둔화 · 그림자 질주: 스친 적 저주
export function onDashTick(p, d, dt) {
  const md = p.mods, sc = p.scene;
  if (!md.dashAqua && !md.dashFrost && !md.dashShadow) return;
  const box = { x: p.b.x - 8, y: p.b.y - 6, w: p.b.width + 16, h: p.b.height + 12 };
  if (md.dashAqua) {
    d.tick -= dt;
    if (d.tick <= 0) { d.tick = .06; sc.combat.hitRect(box, .3, 'water', { proc: true, kbx: 260 * (d.dir || 1), kby: -60, hs: 0, fromX: p.x - d.dir * 30 }); }
    sc.fx.burst(p.x - d.dir * 8, p.y + (Math.random() - .5) * 10, [0x5ac8ff, 0xffffff], 2, 60, { angle: d.dir > 0 ? Math.PI : 0, spread: .6, grav: 200, life: .3, glow: true });
  }
  if (md.dashFrost || md.dashShadow) {
    for (const e of sc.combat.enemiesIn(box)) {
      if (d.hitSet.has(e)) continue;
      d.hitSet.add(e);
      sc.combat.damageEnemy(e, p.atk * .4, md.dashFrost ? 'ice' : 'ghost', Object.assign({ proc: true, kb: 0, kby: 0, hs: 0 }, md.dashFrost ? { freeze: .6, slow: 2.5 } : {}, md.dashShadow ? { curse: 5 } : {}));
    }
    if (md.dashFrost && Math.random() < .7) sc.fx.burst(p.x, p.y + (Math.random() - .5) * 12, [0xbff0ff, 0xffffff], 1, 30, { grav: 0, bounce: false, glow: true, life: .5, size: 2 });
    if (md.dashShadow && Math.random() < .7) sc.fx.burst(p.x, p.y, [0x6a2aff, 0x2a0a3a], 1, 20, { grav: -20, bounce: false, glow: true, life: .45 });
  }
}

// 썬더 스텝 낙뢰 한 줄기
function thunderAt(p, x) {
  const sc = p.scene, gy = sc.groundBelow(x, p.y - 20), top = sc.cameras.main.worldView.y - 10;
  sc.combat.hitRect({ x: x - 14, y: top, w: 28, h: gy - top }, .9, 'electric', { proc: true, paralyze: .6, kbx: 60, kby: -220, hs: 30, fromX: x });
  bolt(sc, x + (Math.random() - .5) * 24, top, x, gy, 0xffe86a, 3, 260);
  sc.fx.burst(x, gy - 2, [0xffe86a, 0xffffff], 14, 150, { up: 130, glow: true }); sc.fx.ring(x, gy - 4, 26, 0xffe86a, 260);
  sc.fx.shake(.006, 90, 'hit'); Sfx.play('zap');
}

// 환영 분신: 대시한 자리에 반투명 분신 → 1.2초 동안 주변 적을 끌어당기고 폭발
function decoyAt(p, x, y) {
  const sc = p.scene, sp = p.sprite;
  const img = sc.add.image(x, y + sp.displayHeight * (sp.originY - .5), sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setFlipX(sp.flipX).setScale(sp.scaleX, sp.scaleY)
    .setTintFill(0xc8a0ff).setAlpha(.6).setDepth(21);
  img.y = p.bottom;
  sc.tweens.add({ targets: img, alpha: { from: .35, to: .7 }, duration: 200, yoyo: true, repeat: 2 });
  let n = 0;
  const ev = sc.time.addEvent({ delay: 100, repeat: 11, callback: () => {
    n++;
    for (const e of sc.enemies) { if (!e.alive || e.boss) continue; const dx = x - e.x, d = Math.abs(dx); if (d < 150 && d > 10 && Math.abs(e.y - y) < 80) e.b.setVelocityX(Math.sign(dx) * 140); }
    if (n >= 12) {
      ev.remove();
      if (sc.combat) sc.combat.hitCircle(x, y, 54, 1.4, p.types[0], { proc: true, kbx: 260, kby: -220, hs: 50 });
      sc.fx.ring(x, y, 54, 0xc8a0ff, 320); sc.fx.burst(x, y, [0xc8a0ff, 0xffffff], 26, 220, { glow: true, up: 80 });
      sc.fx.shake(.01, 180, 'hit'); Sfx.play('boom');
      img.destroy();
    }
  } });
}

// ---------------- 처치 갈고리 (GameScene.killEnemy) ----------------
export function onKill(p) {
  const md = p.mods;
  if (md.killHeal && p.m.alive) p.heal(p.m.maxhp * md.killHeal, true);
}

// ---------------- 대시 갈고리 (Player.update 대시 시작) ----------------
export function onDash(p, d) {
  const md = p.mods, sc = p.scene, x0 = p.x, y0 = p.y;
  d.hitSet = new Set(); d.tick = 0;
  if (md.dashThunder) { thunderAt(p, x0); sc.time.delayedCall(210, () => { if (p.scene) thunderAt(p, p.x); }); }
  if (md.dashFlame || md.dashNova || md.dashDecoy) sc.time.delayedCall(200, () => {
    if (!p.scene || !sc.combat) return;
    const x1 = p.x, L = Math.min(x0, x1), W = Math.abs(x1 - x0) + 16, gy = sc.groundBelow((x0 + x1) / 2, y0);
    if (md.dashFlame) sc.combat.spawnZone({ owner: 'player', x: L - 8, y: gy - 16, w: W, h: 16, life: 2, tick: .3, type: 'fire', color: 0xff7a2a, draw: 'fire',
      onTick: z => sc.combat.hitRect({ x: z.x, y: z.y - 4, w: z.w, h: z.h + 4 }, .22, 'fire', { proc: true, burn: 3, kbx: 0, kby: 0, hs: 0 }) });
    if (md.dashNova) { sc.combat.hitCircle(x1, p.y, 46, 1, p.types[0], { proc: true, kbx: 200, kby: -160, hs: 30 }); sc.fx.ring(x1, p.y, 46, 0xffffff, 300); sc.fx.ring(x1, p.y, 30, 0xffe08a, 260); Sfx.play('boom'); }
    if (md.dashDecoy) decoyAt(p, x0, y0);
  });
  if (md.dashBomb) {
    const bomb = sc.add.image(x0, y0 + 4, 'glow').setTint(0xff7a2a).setBlendMode(Phaser.BlendModes.ADD).setScale(.35).setDepth(30);
    sc.tweens.add({ targets: bomb, scale: .55, duration: 110, yoyo: true, repeat: 1 });
    sc.time.delayedCall(450, () => {
      bomb.destroy();
      if (!sc.combat) return;
      sc.combat.hitCircle(x0, y0, 40, 1.1, 'fire', { proc: true, kbx: 220, kby: -200, hs: 40 });
      sc.fx.ring(x0, y0, 40, 0xff9a4a, 260); sc.fx.glow(x0, y0, 34, 0xff7a2a, 240, .9);
      sc.fx.burst(x0, y0, [0xff7a2a, 0xffd04a, 0xffffff], 18, 140, { up: 80, glow: true });
      Sfx.play('boom');
    });
  }
  if (md.dashClone) {
    const hit = new Set();
    sc.time.delayedCall(200, () => {
      const x1 = p.x, L = Math.min(x0, x1) - 8, W = Math.abs(x1 - x0) + 16;
      sc.combat.hitRect({ x: L, y: y0 - 16, w: W, h: 32 }, .9, p.types[0], { proc: true, set: hit, kbx: 120, kby: -80, hs: 30 });
      for (let k = 0; k < 3; k++) sc.fx.ghost(p.sprite, 0xc8a0ff, .7 - k * .2, 300 + k * 80);
      sc.fx.slash((x0 + x1) / 2, y0, Math.max(14, W / 2), d.dir, 0xc8a0ff, { thick: 3 });
    });
  }
}
