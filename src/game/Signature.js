// 계열 고유 차징 기술 — Z 를 꾹 눌렀다 떼면 쓰는 차징 샷을, 개성이 뚜렷한 계열은 그 포켓몬다운 기술로 바꾼다
//  Player.fireCharge 가 출전 포켓몬의 Z(연타) 기술 id 로 찾는다. 없으면 속성 기본 차징 탄
//  { name: [1·2·3단 이름], type, fire(p, lvl, s, f) } — s: 크기 배율 · f: 바라보는 방향
//   개굴닌자 물수리검 → 거대 물수리검 (되돌아오며 다단히트)   · 나몰빼미 잎사귀 → 깃털 저격 화살 / 화살비
//   울머기 물탄 → 저격탄 (화면 끝까지 관통)                  · 염버니 연속킥 → 불꽃 축구공 슛 (바닥에 튕긴다)
//   누리공 거품 → 벌룬 거품 (적을 가두고 터진다)              · 푸호꼬 매지컬플레임 → 유도 마법 불꽃구슬 일제 발사
//   흥나숭 가지찌르기 → 드럼 비트 (지면 충격파)               · 피카츄 전기쇼크 → 낙뢰
//   고오스 핥기 → 벽을 뚫는 거대 섀도볼                     · 뮤츠 사이코커터 → 사이코 블레이드 폭풍
import { Sfx } from '../systems/Audio.js';
import { lineFx } from './skills.js';
import { bezierMissiles, groundShockwave, skyStrike } from './Mechanics.js';

// 투사체가 겹쳐 있는 동안 every 초마다 다시 맞힌다 (거대 수리검·벌룬 거품)
const rehit = (q, dt, every) => { q.rh = (q.rh ?? every) - dt; if (q.rh <= 0) { q.rh = every; q.hit.clear(); } };

export const CHARGE_SIG = {
  // ===== 개굴닌자: 등에 진 거대 물수리검 — 앞으로 날아갔다가 되돌아오며 닿는 적을 계속 벤다 =====
  water_shuriken: {
    name: ['큰 물수리검', '거대 물수리검', '초거대 물수리검'], type: 'water',
    fire(p, lvl, s, f) {
      const sc = p.scene, bond = p.mega.active ? 1.25 : 1;
      const spec = [null, { r: 9, mul: 1.1, sp: 340, ret: .42, life: 1.5 }, { r: 14, mul: 1.3, sp: 380, ret: .5, life: 1.8 }, { r: 24, mul: 1.6, sp: 420, ret: .6, life: 2.2 }][lvl];
      const big = (r, mul, oy, ang = 0) => sc.combat.spawnProjectile({
        owner: 'player', x: p.x + f * 12, y: p.y + oy, vx: Math.cos(ang) * spec.sp * f, vy: Math.sin(ang) * spec.sp, r: r * s * bond, mul, type: 'water', kind: 'shuriken', color: 0x4ac0ff,
        life: spec.life, pierce: 999, boomerang: spec.ret, ghost: lvl >= 3, light: true, tier: Math.max(p.tierIdx, lvl), pow: s, kb: 120, stream: false, status: { hs: 30 },
        update: (q, dt) => {
          rehit(q, dt, lvl >= 3 ? .09 : .12);
          q.tt = (q.tt || 0) - dt;
          if (q.tt <= 0) {   // 물보라 꼬리 · 날끝에서 튀는 물방울
            q.tt = .03;
            const a = q.t * 28;
            sc.fx.burst(q.x + Math.cos(a) * q.r, q.y + Math.sin(a) * q.r, [0x8ad8ff, 0xffffff], 1, 40, { grav: 120, bounce: false, glow: true, life: .35, size: lvl >= 2 ? 2 : 1 });
          }
        },
        onExpire: q => { if (lvl >= 2) { sc.fx.ring(q.x, q.y, q.r * 1.6, 0x8ad8ff, 260); sc.combat.hitCircle(q.x, q.y, q.r * 1.4, .8 * lvl, 'water', { proc: true, kbx: 160, kby: -160, hs: 40 }); } }
      });
      big(spec.r, spec.mul, -6);
      if (lvl >= 3) {   // 초거대: 작은 수리검 두 장이 위아래로 따라 붙는다
        big(8, .7, -6, -.18); big(8, .7, -6, .18);
        sc.cameras.main.flash(160, 140, 210, 255, true);
      }
      sc.fx.ring(p.x, p.y - 6, (16 + lvl * 8) * s, 0x8ad8ff, 260);
      Sfx.play('water'); Sfx.play('swing');
    }
  },

  // ===== 나몰빼미: 활시위를 끝까지 당긴 깃털 화살 · 3단은 하늘로 쏘아 올린 화살비 =====
  leafage: {
    name: ['깃털 저격', '그림자 꿰매기 화살', '화살비'], type: 'grass',
    fire(p, lvl, s, f) {
      const sc = p.scene;
      const arrow = (o = {}) => sc.combat.spawnProjectile(Object.assign({
        owner: 'player', x: p.x + f * 12, y: p.y - 4, vx: f * 760, vy: 0, r: 4 * s, mul: lvl >= 2 ? 4.4 : 3.4, type: 'grass', kind: 'bolt', color: 0x8ae06a,
        life: .8, pierce: lvl >= 2 ? 99 : 3, light: true, tier: Math.max(p.tierIdx, lvl), pow: s, kb: 220,
        status: Object.assign({ crit: .5, hs: 60 }, lvl >= 2 ? { root: 1.2 } : {})
      }, o));
      arrow(); lineFx(sc, p.x + f * 12, p.y - 4, p.x + f * 320, p.y - 4, 0xd8ffc0, { seg: 2, jag: 0, w: 1, ms: 160 }); Sfx.play('leaf');
      if (lvl < 3) return;
      // 화살비: 위로 한 발 더 쏘아 올리고, 잠시 뒤 가까운 적들 머리 위로 화살이 쏟아진다
      arrow({ vx: f * 120, vy: -620, life: .35, mul: 1, pierce: 1, ghost: true });
      const top = sc.cameras.main.worldView.y - 10, tg = sc.combat.nearest(p.x, p.y, 4, 320);
      for (let k = 0; k < 14; k++) sc.time.delayedCall(320 + k * 45, () => {
        if (!p.scene) return;
        const base = tg.length ? tg[k % tg.length].x : p.x + f * 120 * s;
        sc.combat.spawnProjectile({ owner: 'player', x: base + (Math.random() - .5) * 60 * s, y: top, vx: f * 60, vy: 760, r: 3.5 * s, mul: 1.4, type: 'grass', kind: 'bolt', color: 0x8ae06a,
          life: 1, pierce: 2, ghost: true, muzzle: false, tier: 3, pow: s, kb: 60, status: { root: .5, hs: 20 },
          update: q => { if (q.y > top + 30 && sc.isSolidAt(q.x, q.y)) q.kill = 'wall'; } });
      });
      Sfx.play('leaf'); Sfx.play('swing');
    }
  },

  // ===== 울머기: 엎드려 조준하는 저격탄 — 화면 끝까지 꿰뚫는다. 3단은 보스·먼 적을 노린 3연속 저격 =====
  pound_water: {
    name: ['저격탄', '관통 저격', '스나이프 3연사'], type: 'water',
    fire(p, lvl, s, f) {
      const sc = p.scene, v = sc.cameras.main.worldView;
      const shot = (ang, mul, crit) => {
        sc.combat.spawnProjectile({ owner: 'player', x: p.x + f * 12, y: p.y - 3, vx: Math.cos(ang) * 1300 * f, vy: Math.sin(ang) * 1300, r: (lvl >= 2 ? 4 : 3) * s, mul, type: 'water', kind: 'water', color: 0x8ad0ff,
          life: .55, pierce: lvl >= 2 ? 99 : 1, light: true, tier: Math.max(p.tierIdx, lvl), pow: s, kb: 260, status: { crit, hs: 90 } });
        lineFx(sc, p.x + f * 12, p.y - 3, p.x + f * Math.cos(ang) * 640, p.y - 3 + Math.sin(ang) * 640, 0xbfe6ff, { seg: 2, jag: 0, w: lvl >= 2 ? 2 : 1, ms: 200 });
        sc.fx.ring(p.x + f * 12, p.y - 3, 14, 0xffffff, 160); Sfx.play('crack');
      };
      if (lvl < 3) { shot(0, lvl >= 2 ? 5.2 : 3.8, .6); Sfx.play('water'); return; }
      const score = e => (e.boss ? 1e4 : 0) + Math.abs(e.x - p.x);
      const tg = sc.enemies.filter(e => e.alive && !e.intangible && e.x > v.x && e.x < v.right && Math.sign(e.x - p.x) === f).sort((a, b) => score(b) - score(a));
      for (let k = 0; k < 3; k++) sc.time.delayedCall(k * 140, () => {
        if (!p.scene) return;
        const t = tg[k % Math.max(1, tg.length)], ang = t && t.alive ? Math.atan2(t.y - (p.y - 3), Math.abs(t.x - p.x) || 1) : 0;
        shot(ang, 4.2, 1);
      });
      Sfx.play('water');
    }
  },

  // ===== 염버니: 불꽃 축구공을 걷어찬다 — 바닥에 통통 튀며 굴러가고, 3단은 커다란 화염볼 =====
  agile_kick: {
    name: ['불꽃 슛', '파워 슛', '화염볼 슈퍼 슛'], type: 'fire',
    fire(p, lvl, s, f) {
      const sc = p.scene, r = [0, 6, 8, 14][lvl] * s;
      sc.combat.spawnProjectile({
        owner: 'player', x: p.x + f * 12, y: p.y + 2, vx: f * (320 + lvl * 60), vy: -160, grav: 620, r, mul: [0, 2.6, 3.4, 4.4][lvl], type: 'fire', kind: 'ball', color: 0xff7a2a,
        life: 1.6 + lvl * .3, pierce: lvl >= 2 ? 99 : 4, light: true, tier: Math.max(p.tierIdx, lvl), pow: s, kb: 240, stream: false, status: { burn: 2 + lvl, kby: -200, hs: 50 },
        update: (q, dt) => {
          rehit(q, dt, .2);
          const below = sc.isSolidAt(q.x, q.y + q.r + 1);
          if (below && q.vy > 0) {   // 바닥에 튕긴다 (튈 때마다 불꽃)
            q.vy = -Math.max(220, Math.abs(q.vy) * .78); q.bounces = (q.bounces || 0) + 1;
            sc.fx.burst(q.x, q.y + q.r, [0xff7a2a, 0xffd04a], 6, 90, { up: 80, glow: true });
            if (lvl >= 2) sc.combat.hitCircle(q.x, q.y, q.r * 2, .5 * lvl, 'fire', { proc: true, burn: 2, kbx: 120, kby: -160, hs: 0 });
            Sfx.play('fire');
          }
          if (sc.isSolidAt(q.x + Math.sign(q.vx) * (q.r + 1), q.y)) q.vx = -q.vx * .8;   // 벽에 맞으면 되튄다
          q.tt = (q.tt || 0) - dt;
          if (q.tt <= 0) { q.tt = .02; sc.fx.embers(q.x - Math.sign(q.vx) * q.r, q.y, [0xff7a2a, 0xffd04a, 0xff3a1a], 1, { speed: 30 }); }
        },
        onExpire: q => {
          const R = lvl >= 3 ? 70 * s : 26 * s;
          sc.combat.hitCircle(q.x, q.y, R, lvl >= 3 ? 3 : 1, 'fire', { proc: true, burn: 3, kbx: 240, kby: -240, hs: 60 });
          sc.fx.ring(q.x, q.y, R, 0xff7a2a, 320); sc.fx.burst(q.x, q.y, [0xff3a1a, 0xff9a2a, 0xffe08a], 10 + lvl * 8, 180, { up: 90, glow: true });
          if (lvl >= 3) { sc.fx.shake(.016, 260, 'hit'); Sfx.play('boom'); }
        }
      });
      sc.fx.slash(p.x + f * 10 * s, p.y + 4, 14 * s, f, 0xffd0a0, { thick: 3 });
      Sfx.play('swing'); Sfx.play('fire');
    }
  },

  // ===== 누리공: 노래로 부풀린 벌룬 거품 — 천천히 떠가며 적을 가두고, 끝에서 터진다 =====
  bubble_note: {
    name: ['벌룬 거품', '더블 벌룬', '버블 콘서트'], type: 'water',
    fire(p, lvl, s, f) {
      const sc = p.scene;
      const bubble = (r, vx, vy, mul, delay = 0) => sc.time.delayedCall(delay, () => {
        if (!p.scene) return;
        sc.combat.spawnProjectile({
          owner: 'player', x: p.x + f * 14, y: p.y - 6, vx: vx * f, vy, r: r * s, mul, type: 'water', kind: 'bubble', color: 0x8ad8ff,
          life: 1.8, pierce: 999, ghost: true, light: true, tier: Math.max(p.tierIdx, lvl), pow: s, kb: 0, stream: false, status: { root: .6, kby: 0, hs: 0 },
          update: (q, dt) => { rehit(q, dt, .25); q.vx *= 1 - dt * .6; q.vy = Math.sin(q.t * 4) * 18 - 8; },
          onExpire: q => {
            sc.combat.hitCircle(q.x, q.y, q.r * 1.8, mul * 2.5, 'water', { proc: true, kbx: 200, kby: -220, hs: 50 });
            sc.fx.ring(q.x, q.y, q.r * 1.8, 0xbfe8ff, 280); sc.fx.burst(q.x, q.y, [0x8ad8ff, 0xffffff], 14, 150, { glow: true });
            Sfx.play('water');
          }
        });
      });
      if (lvl === 1) bubble(11, 150, -10, .5);
      else if (lvl === 2) { bubble(14, 160, -20, .6); bubble(10, 110, 10, .5, 160); }
      else { bubble(24, 120, -10, .8); for (let k = 0; k < 4; k++) bubble(8, 140 + k * 30, -40 + k * 25, .4, 120 + k * 90); sc.fx.ring(p.x, p.y, 40 * s, 0xffd0f0, 360); }
      Sfx.play('water');
    }
  },

  // ===== 푸호꼬: 지팡이를 휘둘러 유도 마법 불꽃구슬을 한꺼번에 날린다 =====
  mystical_fire: {
    name: ['매지컬 불꽃구슬', '마법진 일제사격', '대마법 · 불꽃 유성'], type: 'fire',
    fire(p, lvl, s, f) {
      bezierMissiles(p, { n: [0, 3, 5, 8][lvl], mul: [0, 1.2, 1.4, 1.6][lvl], type: 'fire', color: 0xff6ab0, r: 5 + lvl, speed: 300, arc: 60 + lvl * 20, status: { burn: 2, curse: 4 } });
      p.scene.fx.ring(p.x, p.y - 4, (18 + lvl * 10) * s, 0xff9ad0, 300);
      Sfx.play('fire');
    }
  },

  // ===== 흥나숭: 그루키 드럼 비트 — 땅을 두드릴 때마다 양옆으로 충격파 =====
  branch_poke: {
    name: ['드럼 비트', '더블 비트', '그래스 드럼 피날레'], type: 'grass',
    fire(p, lvl, s) {
      const sc = p.scene, beats = lvl;
      for (let k = 0; k < beats; k++) sc.time.delayedCall(k * 180, () => {
        if (!p.scene) return;
        const fin = k === beats - 1 && lvl >= 3;
        groundShockwave(p, { dirs: [-1, 1], mul: fin ? 3.2 : 1.8, type: 'grass', r: fin ? 11 : 7, speed: fin ? 360 : 300, status: { kby: -240 } });
        sc.fx.ring(p.x, p.bottom - 3, (22 + k * 8) * s, 0x8ae06a, 240); sc.fx.shake(fin ? .014 : .006, 120, 'hit');
        p.squash(1.25, .8); Sfx.play('slam');
      });
    }
  },

  // ===== 피카츄 계열: 하늘에서 낙뢰를 떨어뜨린다 (단계마다 줄기가 늘어난다) =====
  thundershock: {
    name: ['낙뢰', '이중 낙뢰', '뇌격 폭풍'], type: 'electric',
    fire(p, lvl) {
      skyStrike(p, { n: [0, 1, 3, 4][lvl], mul: [0, 3, 2.6, 2.6][lvl], type: 'electric', status: { paralyze: .5 + lvl * .1 } });
      if (lvl >= 3) {   // 뇌격 폭풍: 한 박자 뒤 같은 자리에 한 번 더 내리친다
        p.scene.cameras.main.flash(120, 255, 240, 160, true);
        p.scene.time.delayedCall(300, () => { if (p.scene) { skyStrike(p, { n: 4, mul: 2.6, type: 'electric', status: { paralyze: .8 } }); Sfx.play('zap'); } });
      }
      Sfx.play('zap');
    }
  },

  // ===== 고오스 계열: 벽을 뚫고 천천히 날아가는 거대 섀도볼 =====
  lick_shadow: {
    name: ['섀도볼', '큰 섀도볼', '악몽의 섀도볼'], type: 'ghost',
    fire(p, lvl, s, f) {
      p.scene.combat.spawnProjectile({ owner: 'player', x: p.x + f * 12, y: p.y - 4, vx: f * (170 + lvl * 20), vy: 0, r: [0, 8, 11, 18][lvl] * s, mul: 0, type: 'ghost', kind: 'shadow', color: 0x9a5aff,
        life: 1.6, ghost: true, homing: .8, light: true, tier: Math.max(p.tierIdx, lvl), pow: s, boom: { r: [0, 40, 56, 96][lvl] * s, mul: [0, 3.2, 4.4, 7][lvl], kb: 240 }, status: { curse: 5 } });
      Sfx.play('ghost');
    }
  },

  // ===== 뮤츠: 염동력 칼날이 몸 둘레를 돌다가 사방으로 흩어진다 =====
  psycho_cut: {
    name: ['사이코 블레이드', '사이코 블레이드 폭풍', '사이코 블레이드 · 무한'], type: 'psychic',
    fire(p, lvl, s, f) {
      const sc = p.scene, n = [0, 4, 6, 10][lvl];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        sc.combat.spawnProjectile({ owner: 'player', x: p.x + Math.cos(a) * 20 * s, y: p.y + Math.sin(a) * 20 * s, vx: 0, vy: 0, r: 5 * s, mul: 1.8, type: 'psychic', kind: 'leaf', color: 0xff6ad8,
          life: 1.3, pierce: 3, ghost: true, light: k % 3 === 0, tier: Math.max(p.tierIdx, lvl), pow: s, kb: 140, muzzle: false,
          update: (q, dt) => {   // 0.35초 동안 몸 둘레를 돌다가, 바라보는 쪽 좁은 부채꼴로 날아가며 가까운 적을 쫓는다
            if (q.t < .35) { const b = a + q.t * 14; q.x = p.x + Math.cos(b) * 22 * s; q.y = p.y - 4 + Math.sin(b) * 18 * s; }
            else if (!q.go) { q.go = true; q.homing = q.t + .5; const b = (k - (n - 1) / 2) * (.6 / n); q.vx = Math.cos(b) * 480 * f; q.vy = Math.sin(b) * 480; }
          } });
      }
      sc.fx.ring(p.x, p.y, 30 * s, 0xff9ad0, 300);
      Sfx.play('wave');
    }
  }
};

// 출전 포켓몬의 고유 차징 (없으면 null → 속성 기본 차징 탄)
export const chargeSigOf = p => CHARGE_SIG[p.m.skills.z] || null;
