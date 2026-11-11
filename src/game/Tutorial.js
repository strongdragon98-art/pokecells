// 🎓 실전 체험형 강제 조작 튜토리얼 (Interactive Action-Gate Tutorial) — 관동 첫 방 · 오박사 연구소
//  NPC 에게 말을 걸지 않아도, 연구소를 오른쪽으로 걸어가며 세 지점을 지나는 순간 앞길에 훈련 결계가 솟고, 그 조작을 직접 성공해야 결계가 깨진다
//   1/3 🛡️ 지상 패링(↓ + Z): 결계 앞 훈련용 코일이 느리고 선명한 노란 에너지 볼을 쏜다 (맞아도 피해 0) → 패링한 반사탄이 코일(결계 핵)에 꽂히면 해제
//   2/3 🦅 공중 기동 & 내려찍기: 바닥에 낮은 훈련용 가시(닿으면 위로 튕길 뿐 피해 0) · 공중에 뜬 훈련용 부유 표적 → 공중에서 평타 · ↓ + Z 내려찍기 · 공중에서 쏜 탄으로 파쇄
//   3/3 💥 대시 회피 & 차징 샷: 균열된 방어벽 앞 훈련 교관 드론이 🔴 붉은 안광(패링 불가) 충격파를 예고하고 쏜다 → Shift 대시 무적으로 1회 뚫고 지나가기 + Z 홀드 차징 샷으로 균열 벽 파괴
//  진행: player.quests.tut (0 · 1 · 2 = 다음 훈련 · 3 = 완료 · RunSave 에 함께 남는다). 새 모험만 0 에서 시작 — 예전 진행 저장(quests.tut 없음)은 이미 마친 것으로 본다
//  건너뛰기: 화면 오른쪽 위 버튼(터치) · ESC 두 번 (systems/TutorialHud.js · GameScene.update) — 2회차 · 테스터용
//  맵 생성 · 저장 서명(world 데이터)은 건드리지 않는다: 결계는 GameScene.gateGroup 의 정적 몸체 · 그림은 이 모듈의 그래픽 · 훈련 탄은 Combat 의 적 탄(q.training)
import Phaser from 'phaser';
import { Sfx } from '../systems/Audio.js';
import { TILE } from '../config.js';

export const TUT_DONE = 3;
const ADD = Phaser.BlendModes.ADD;
const BALL_SPEED = 150, BALL_EVERY = 2.1, WAVE_SPEED = 175, WAVE_EVERY = 2.9, WARN_T = .8;

export class ActionTutorial {
  // 새 모험 · 관동 · 테스트룸 아님 · 아직 다 마치지 않았을 때만
  static wanted(gs) {
    const q = gs.player && gs.player.quests;
    return !!(q && !gs.test && gs.stageIdx === 0 && gs.level && !gs.level.purified && typeof q.tut === 'number' && q.tut < TUT_DONE && gs.level.rooms.some(r => r.lab));
  }

  constructor(gs) {
    this.s = gs;
    const lv = gs.level, lab = lv.rooms.find(r => r.lab && r.main) || lv.rooms.find(r => r.lab);
    this.lab = lab; this.floor = lab.bottom; this.top = lab.top;
    const L = lab.left, W = lab.right - lab.left;
    const npcX = id => { const n = (lv.npcs || []).find(q => q.id === id && q.room === lab); return n ? n.x * TILE + TILE / 2 : null; };
    const oak = npcX('oak') ?? L + W * .2, a1 = npcX('aide1') ?? L + W * .44, a2 = npcX('aide2') ?? L + W * .67;
    const door = ((gs.props && gs.props.interacts) || []).filter(i => i.kind === 'door' && i.x > L && i.x < lab.right).reduce((m, i) => Math.max(m, i.x), 0) || lab.right - 72;
    // trig: 이 x 를 지나면 결계가 솟는다 · bx: 결계 자리 (결계 몸체는 처음부터 깔려 있어 건너뛸 수 없다 — 보이는 건 지날 때부터)
    this.gates = [
      { key: 'parry', trig: oak + 40, bx: a1 - 56, need: 1, got: 0 },
      { key: 'air', trig: a1 + 24, bx: a2 - 56, need: 1, got: 0 },
      { key: 'dash', trig: a2 + 24, bx: door - 40, need: 2, dodged: false, charged: false }
    ];
    this.i = Math.max(0, Math.min(TUT_DONE, gs.player.quests.tut | 0));
    // 결계 몸체(bodyX)는 플레이어 쪽 · 훈련 장치는 그 너머 — 코일 · 드론의 탄이 결계를 지나 플레이어에게 날아온다
    //  결계에 바짝 붙어 서도 탄이 결계까지 60 ~ 90px 를 날아오도록 장치는 그만큼 뒤에 둔다 (반응할 틈)
    const g1 = this.gates[0]; g1.bodyX = g1.bx; g1.lx = g1.bx + 88; g1.ly = this.floor - 17;
    const g2 = this.gates[1]; g2.bodyX = g2.bx; g2.ox = g2.bx - 74; g2.oy = this.floor - 58; g2.orbAlive = true;   // 표적: 점프 오르내리는 중간 높이 (꾹 점프 · 짧은 점프 모두 닿게)
    const g3 = this.gates[2]; g3.bodyX = g3.bx - 96; g3.wall = { x: g3.bx - 12, y: this.top, w: 22, h: this.floor - this.top }; g3.dx = g3.bx - 30; g3.dy = this.floor - 40;
    for (const [k, gt] of this.gates.entries()) {
      gt.idx = k; gt.state = k < this.i ? 'done' : 'wait'; gt.raise = 0; gt.shotT = 1.2; gt.warnT = 0;
      if (gt.state === 'done') continue;
      const h = this.floor - this.top;
      gt.body = gs.gateGroup.create(gt.bodyX, this.top + h / 2, 'px').setVisible(false).setDisplaySize(10, h).refreshBody();
    }
    this.g = gs.add.graphics().setDepth(14);           // 결계 · 코일 · 표적 · 가시 · 방어벽 · 드론
    this.ga = gs.add.graphics().setDepth(14.5).setBlendMode(ADD);   // 빛나는 결계 · 눈
    this.t = 0; this.flash = null; this.escArmT = 0;
  }

  get done() { return this.i >= TUT_DONE; }
  get gate() { return this.gates[this.i] || null; }
  // HUD 가 보여 줄 지금 훈련 (결계가 솟은 뒤부터)
  get showing() { const gt = this.gate; return !!(gt && gt.state === 'on'); }

  // ---------------- 매 프레임 (GameScene.update) ----------------
  update(dt) {
    const s = this.s, p = s.player;
    if (!p || !s.level || this.dead) return;
    this.t += dt; this.escArmT = Math.max(0, this.escArmT - dt);
    if (this.flash && (this.flash.t -= dt) <= 0) this.flash = null;
    const gt = this.gate;
    if (gt && gt.state === 'wait' && s.room === this.lab && p.x > gt.trig) this.raise(gt);
    if (gt && gt.state === 'on') {
      gt.raise = Math.min(1, gt.raise + dt * 4);
      if (p.x + 8 >= gt.bodyX - 6 && p.x < gt.bodyX && this.t - (this.bumpAt || -9) > 2.2) {   // 결계에 막혔다: 불꽃 · 안내 한 줄
        this.bumpAt = this.t;
        s.fx.burst(gt.bodyX - 5, p.y, [0x6ac8ff, 0xffffff], 6, 70, { glow: true, grav: 0, bounce: false, life: .3 });
        s.fx.floatText(p.x, p.b.y - 22, '🔒 훈련 결계 — 위 안내대로 성공하면 열린다', '#9ad8ff', 9);
        Sfx.play('deny');
      }
      if (gt.key === 'parry') this.tickParry(gt, dt);
      else if (gt.key === 'air') this.tickAir(gt, dt);
      else this.tickDash(gt, dt);
    }
    this.draw();
  }

  raise(gt) {
    const s = this.s;
    gt.state = 'on'; gt.raise = 0; gt.shotT = gt.key === 'dash' ? .9 : 1;
    Sfx.play('gate'); s.fx.shake(.004, 120);
    s.fx.burst(gt.bodyX, this.floor - 40, [0x6ac8ff, 0xffffff], 18, 120, { glow: true, grav: 0, bounce: false, life: .5 });
    s.events.emit('tutorial', gt.idx);
  }

  // 1/3 패링: 코일이 노란 에너지 볼을 쏜다 (살아 있는 볼이 없고 플레이어가 결계 앞 구간에 있을 때) · 반사탄은 코일로 끌려가 꽂힌다
  tickParry(gt, dt) {
    const s = this.s, p = s.player, c = s.combat, lx = gt.lx, ly = gt.ly;
    const mine = c.projs.filter(q => q.training && q.tut === gt.idx && !q.dead);
    for (const q of mine) {
      if (q.owner !== 'player') continue;
      const dx = lx - q.x, dy = ly - q.y, d = Math.hypot(dx, dy) || 1;   // 패링한 반사탄: 코일(결계 핵)로
      q.ghost = true; q.homing = 0; q.seek = null; q.life = Math.max(q.life, .6);
      q.vx = dx / d * 560; q.vy = dy / d * 560;
      if (d < 14) { q.kill = 'hit'; this.success(gt, '⚡ PERFECT PARRY! — 반사탄이 결계 핵에 명중!'); return; }
    }
    if (mine.length || p.x > gt.bodyX || p.x < gt.trig - 160) return;
    gt.shotT -= dt;
    if (gt.shotT <= .45 && !gt.tele) { gt.tele = true; s.fx.ring(lx, ly, 12, 0xffe14a, 380); s.fx.glow(lx, ly, 16, 0xffe14a, 420, .9); }
    if (gt.shotT > 0) return;
    gt.shotT = BALL_EVERY; gt.tele = false;
    const q = c.spawnProjectile({ owner: 'enemy', x: lx - 8, y: ly, vx: -BALL_SPEED, vy: 0, r: 5, dmg: 0, type: 'electric', kind: 'bubble', color: 0xffe14a, life: 4, ghost: true, light: true, training: true });
    q.tut = gt.idx;
    Sfx.play('eshot');
  }

  // 2/3 공중: 표적은 둥실 · 가시는 닿으면 위로 튕긴다 (피해 없음) · 내려찍기가 표적을 지나쳐도 파쇄
  tickAir(gt, dt) {
    const s = this.s, p = s.player, oy = gt.oy + Math.sin(this.t * 2.4) * 4;
    gt.oyNow = oy;
    if (p.onGround && Math.abs(p.x - gt.ox) < 36 && p.bottom > this.floor - 3 && !p.dash) {
      p.b.setVelocityY(-330);
      s.fx.burst(p.x, this.floor - 2, [0xff6a8a, 0xffffff], 8, 90, { up: 70, glow: true, life: .3 });
      if (this.t - (gt.spikeTip || -9) > 2.4) { gt.spikeTip = this.t; s.fx.floatText(p.x, p.b.y - 24, '훈련용 가시! 위로 튕긴다 — 그대로 공중 공격!', '#ffb0c0', 9); }
    }
    if (!gt.orbAlive) return;
    const a = p.action;
    if (a && a.dive && Math.abs(p.x - gt.ox) < 20 && Math.abs(p.y - oy) < 24) { this.breakOrb(gt, '내려찍기'); return; }
    for (const q of s.combat.projs) {   // 공중에서 쏜 탄 (원거리 평타 계열)
      if (q.owner !== 'player' || q.dead || !q.airShot) continue;
      if (Math.hypot(q.x - gt.ox, q.y - oy) < 14 + q.r) { q.kill = 'hit'; this.breakOrb(gt, '공중 사격'); return; }
    }
  }
  breakOrb(gt, how) {
    const s = this.s, x = gt.ox, y = gt.oyNow ?? gt.oy;
    gt.orbAlive = false;
    s.fx.burst(x, y, [0x8ad8ff, 0xffffff, 0x4a8aff], 26, 180, { glow: true, grav: 200, life: .6 });
    s.fx.ring(x, y, 22, 0xbfe6ff, 300); s.fx.starburst(x, y, 0xffffff, 1.2, { debris: false });
    Sfx.play('shatter');
    this.success(gt, `🦅 ${how} 성공! — 공중 표적 파쇄`);
  }

  // 3/3 대시 회피 & 차징 샷: 드론이 붉은 안광을 예고(0.8초)한 뒤 바닥을 기는 충격파 · 회피하면 쏘지 않는다
  tickDash(gt, dt) {
    const s = this.s, p = s.player;
    gt.warnT = Math.max(0, gt.warnT - dt);
    if (gt.dodged || p.x > gt.bodyX || p.x < gt.trig - 160) return;
    if (s.combat.projs.some(q => q.training && q.tut === gt.idx && !q.dead && q.owner === 'enemy')) return;
    gt.shotT -= dt;
    if (gt.shotT <= WARN_T && gt.warnT <= 0 && !gt.tele) {
      gt.tele = true; gt.warnT = WARN_T;
      s.fx.ring(gt.dx, gt.dy, 16, 0xff2a3a, 420); s.fx.glow(gt.dx, gt.dy, 22, 0xff2a3a, 700, 1);
      s.fx.floatText(gt.dx, gt.dy - 20, '⚠️ 붉은 안광 — 패링 불가!', '#ff5a6a', 9);
      Sfx.play('danger');
    }
    if (gt.shotT > 0) return;
    gt.shotT = WAVE_EVERY; gt.tele = false;
    const q = s.combat.spawnProjectile({ owner: 'enemy', x: gt.dx - 6, y: this.floor - 11, vx: -WAVE_SPEED, vy: 0, r: 9, dmg: 0, type: 'dark', kind: 'wave', color: 0xff2a3a, life: 4, ghost: true, light: true, danger: true, training: true });
    q.tut = gt.idx;
    s.fx.shake(.005, 120); Sfx.play('boom');
  }

  // ---------------- 훈련 탄이 플레이어에게 닿았다 (Combat.updateProjectiles) — 돌려준 값이 true 면 그 탄은 사라진다 ----------------
  //  kind: 'body' 몸에 닿음 · 'guard' 붉은 안광을 패링하려다 가드 브레이크
  touch(q, kind = 'body') {
    const s = this.s, p = s.player, gt = this.gates[q.tut];
    if (!gt || gt.state !== 'on') return true;
    if (q.danger) {
      if (kind === 'body' && (p.dash || p.dashEvadeT > 0)) {   // 대시 무적으로 뚫고 지나갔다
        if (!q.dodged) {
          q.dodged = true;
          if (!gt.dodged) { gt.dodged = true; s.fx.floatText(p.x, p.b.y - 26, '💨 회피 성공! 이제 Z 를 꾹 — 차징 샷으로 벽을!', '#9affd8', 10); Sfx.play('select'); this.checkDash(gt); }
        }
        return false;
      }
      if (kind === 'guard') { this.tip('🔴 붉은 안광은 패링할 수 없다! Shift 대시로 뚫고 지나가자', '#ff7a8a'); return true; }
      p.b.setVelocity(-170, -150); s.fx.burst(p.x, p.y, [0xff2a3a, 0xffffff], 10, 120, { glow: true, life: .35 });
      this.tip('충격파에 밀려났다 — 닿기 직전에 Shift 대시!', '#ff9aa8');
      return true;
    }
    s.fx.burst(q.x, q.y, [0xffe14a, 0xffffff], 8, 80, { glow: true, life: .3 });
    this.tip('타이밍! 볼이 닿기 직전에 ↓ + Z (훈련 볼은 아프지 않다)', '#ffe08a');
    return true;
  }
  tip(text, col) {
    const s = this.s, p = s.player;
    if (this.t - (this.tipAt || -9) < 1.6) return;
    this.tipAt = this.t; s.fx.floatText(p.x, p.b.y - 26, text, col, 9);
  }

  // ---------------- 플레이어의 타격 판정이 지나간 자리 (Props.hitRect 가 넘겨준다) ----------------
  //  src: 'dive' 내려찍기 · 'air' 공중에서 쏜 탄 · 'charge' 차징 샷 · null 이면 지금 동작으로 가늠
  hit(rect, src) {
    const s = this.s, p = s.player, gt = this.gate;
    if (!gt || gt.state !== 'on' || !p) return;
    const over = (x0, y0, x1, y1) => rect.x < x1 && rect.x + rect.w > x0 && rect.y < y1 && rect.y + rect.h > y0;
    if (gt.key === 'air' && gt.orbAlive) {
      const y = gt.oyNow ?? gt.oy;
      if (!over(gt.ox - 14, y - 14, gt.ox + 14, y + 14)) return;
      const air = src === 'dive' || src === 'air' || (!src && !p.onGround);
      if (air) this.breakOrb(gt, src === 'dive' ? '내려찍기' : '공중 공격');
      else if (this.t - (gt.nudge || -9) > 1.5) { gt.nudge = this.t; s.fx.floatText(gt.ox, y - 16, '닿지 않는다… 점프해서 공중에서!', '#bfe6ff', 9); }
      return;
    }
    if (gt.key === 'dash') {
      const w = gt.wall;
      if (!over(w.x, w.y, w.x + w.w, w.y + w.h)) return;
      if (src !== 'charge') { if (this.t - (gt.nudge || -9) > 1.5) { gt.nudge = this.t; s.fx.floatText(w.x, this.floor - 50, '꿈쩍도 않는다… Z 를 꾹 눌렀다 떼는 차징 샷!', '#ffd8a0', 9); } return; }
      if (!gt.charged) { gt.charged = true; s.fx.burst(w.x + w.w / 2, this.floor - 40, [0xb8a890, 0xffffff], 14, 140, { up: 90 }); s.fx.shake(.008, 140); Sfx.play('crack'); }
      if (!gt.dodged) this.tip('벽에 금이 더 갔다! 이제 붉은 충격파를 Shift 대시로 1번 피하면 무너진다', '#ffd8a0');
      this.checkDash(gt);
    }
  }
  checkDash(gt) {
    if (!gt.dodged || !gt.charged || gt.state !== 'on') return;
    const s = this.s, w = gt.wall, cx = w.x + w.w / 2;
    for (let k = 0; k < 4; k++) s.fx.burst(cx, this.floor - 20 - k * 30, [0x8a7a62, 0xb8a888, 0x5a4a38, 0xffffff], 12, 200, { up: 120, grav: 600, bounce: true, life: .8, size: 2 });
    Sfx.play('boom');
    this.success(gt, '💥 균열 벽 파괴! — 전술 훈련 완료');
  }

  // ---------------- 성공 · 결계 해제 ----------------
  success(gt, msg) {
    const s = this.s, p = s.player;
    if (gt.state !== 'on') return;
    gt.state = 'done';
    if (gt.body) { gt.body.destroy(); gt.body = null; }
    for (const q of s.combat.projs) if (q.training && q.tut === gt.idx && q.owner === 'enemy') q.kill = 'expire';
    // 결계가 산산조각: 유리 파편 · 고리 · 섬광 · 잠깐 멈칫(슬로우)
    const x = gt.bodyX, h = this.floor - this.top;
    for (let k = 0; k < 6; k++) s.fx.burst(x, this.top + h * (k + .5) / 6, [0x6ac8ff, 0xbfe6ff, 0xffffff], 8, 220, { glow: true, grav: 260, life: .7, size: 2 });
    s.fx.ring(x, this.floor - 40, 30, 0xffffff, 300); s.fx.ring(x, this.floor - 40, 56, 0x6ac8ff, 420);
    s.fx.hitStop(160); s.fx.shake(.01, 220, 'hit');
    s.cameras.main.flash(140, 200, 230, 255, true);
    Sfx.play('shatter'); Sfx.play('purify');
    s.fx.floatText(p.x, p.b.y - 34, msg, '#ffe36a', 11);
    this.i = gt.idx + 1;
    p.quests.tut = this.i;
    this.flash = { text: this.i >= TUT_DONE ? '✔ 전술 훈련 3/3 완료 — 관동지방 탐험 시작!' : `✔ 전술 훈련 ${this.i}/3 완료 — 결계 해제!`, t: 2.2 };
    s.events.emit('tutorial', this.i);
    if (this.i >= TUT_DONE) {
      s.time.delayedCall(700, () => { if (s.scene && s.scene.isActive()) s.events.emit('banner', '전술 훈련 완료!', '패링 · 공중 공격 · 대시 회피 · 차징 샷 — 이제 침식된 관동지방으로'); });
      if (s.saveRun) s.time.delayedCall(1200, () => s.saveRun && s.saveRun(true, 'tutorial'));   // 훈련 완료를 조용히 저장 (이어하기에서 다시 막히지 않게)
    }
  }

  // 건너뛰기 (오른쪽 위 버튼 · ESC 두 번): 남은 결계를 모두 걷는다
  skip() {
    const s = this.s, p = s.player;
    if (this.done) return;
    for (const gt of this.gates) {
      if (gt.state === 'done') continue;
      gt.state = 'done';
      if (gt.body) { gt.body.destroy(); gt.body = null; }
      if (gt.raise > 0) s.fx.burst(gt.bodyX, this.floor - 40, [0x6ac8ff, 0xffffff], 12, 140, { glow: true, life: .45 });
    }
    for (const q of s.combat.projs) if (q.training) q.kill = 'expire';
    this.i = TUT_DONE; p.quests.tut = TUT_DONE; this.flash = null;
    Sfx.play('select');
    s.events.emit('toast', '튜토리얼을 건너뛰었다 — 조작은 설정(O) → 키 설정 · 연구소 사람들에게 다시 물어볼 수 있다');
    s.events.emit('tutorial', TUT_DONE);
  }
  // ESC: 훈련 안내가 떠 있을 때만 — 한 번 누르면 확인, 2.5초 안에 한 번 더 누르면 건너뛴다 (true = 이 키를 썼다)
  escape() {
    if (!this.showing) return false;
    if (this.escArmT > 0) { this.skip(); return true; }
    this.escArmT = 2.5; Sfx.play('select');
    return true;
  }

  // ---------------- 그리기 ----------------
  draw() {
    const g = this.g, ga = this.ga, t = this.t, top = this.top, F = this.floor;
    g.clear(); ga.clear();
    for (const gt of this.gates) {
      if (gt.state !== 'on') continue;
      const k = gt.raise, h = (F - top) * k, y0 = F - h, x = gt.bodyX;
      // 푸른 에너지 결계 (몸체 자리): 육각 무늬가 흐르고 가운데 심이 일렁인다
      ga.fillStyle(0x4ac0ff, .16 * k); ga.fillRect(x - 6, y0, 12, h);
      ga.lineStyle(1, 0x8ad8ff, .45 * k);
      for (let yy = F - ((t * 30) % 14); yy > y0 + 4; yy -= 14) ga.strokePoints([{ x: x - 5, y: yy }, { x: x - 2, y: yy - 5 }, { x: x + 2, y: yy - 5 }, { x: x + 5, y: yy }, { x: x + 2, y: yy + 5 }, { x: x - 2, y: yy + 5 }], true);
      ga.lineStyle(2, 0xffffff, (.55 + .35 * Math.sin(t * 11)) * k); ga.lineBetween(x, y0, x, F);
      ga.fillStyle(0x6ac8ff, .08 * k); ga.fillRect(x - 14, y0, 28, h);
      if (gt.key === 'parry') {   // 훈련용 코일 (결계 너머 · 결계 핵): 노란 렌즈 — 예고 중엔 크게 빛난다
        const lx = gt.lx, ly = gt.ly;
        g.fillStyle(0x2a2e3a, 1); g.fillRect(lx - 4, F - 10, 16, 10); g.fillStyle(0x4a5060, 1); g.fillRect(lx - 6, F - 3, 20, 3);
        g.fillStyle(0x3a4050, 1); g.fillCircle(lx + 3, ly + 1, 7);
        g.lineStyle(1, 0xc8a040, .8); g.strokeCircle(lx + 3, ly + 1, 7);   // 코일 감은 구리선
        g.fillStyle(0xffe14a, 1); g.fillCircle(lx - 1, ly, 3);
        ga.fillStyle(0xffe14a, gt.tele ? .7 : .3); ga.fillCircle(lx - 1, ly, gt.tele ? 9 : 5);
      } else if (gt.key === 'air') {   // 훈련용 가시 · 부유 표적 구체
        g.fillStyle(0x5a2030, 1);
        for (let xx = gt.ox - 34; xx <= gt.ox + 30; xx += 8) g.fillTriangle(xx, F, xx + 8, F, xx + 4, F - 9);
        ga.fillStyle(0xff5a7a, .25 + .15 * Math.sin(t * 6)); ga.fillRect(gt.ox - 34, F - 3, 72, 3);
        if (gt.orbAlive) {
          const oy = gt.oyNow ?? gt.oy, ox = gt.ox;
          ga.fillStyle(0x4a8aff, .2); ga.fillCircle(ox, oy, 16);
          g.fillStyle(0x1a2a48, 1); g.fillCircle(ox, oy, 10);
          g.fillStyle(0x8ad8ff, 1); g.fillCircle(ox, oy, 7.5);
          g.fillStyle(0xffffff, 1); g.fillCircle(ox, oy, 3);
          g.lineStyle(1, 0xffffff, .9); g.strokeCircle(ox, oy, 10);
          ga.lineStyle(1, 0xbfe6ff, .6); ga.strokeCircle(ox, oy, 13 + Math.sin(t * 4) * 2);
          g.lineStyle(1, 0xffffff, .5); g.lineBetween(ox, oy + 11, ox, oy + 20 + Math.sin(t * 2.4) * 2);   // 아래로 늘어진 실 (공중에 매단 표적)
        }
      } else {   // 균열된 방어벽 (돌 · 결계 너머) + 붉게 빛나는 균열 · 결계와 벽 사이에 떠 있는 훈련 교관 드론
        const w = gt.wall;
        g.fillStyle(0x3a3440, 1); g.fillRect(w.x, y0, w.w, h);
        g.fillStyle(0x4e4756, 1); for (let yy = F - 12; yy > y0; yy -= 12) for (let xx = w.x + ((F - yy) / 12 % 2 ? 0 : -5); xx < w.x + w.w; xx += 11) g.fillRect(Math.max(w.x, xx + 1), Math.max(y0, yy - 11), Math.min(10, w.x + w.w - xx - 1), 10);
        g.lineStyle(1, 0x1a1620, 1); g.strokeRect(w.x, y0, w.w, h);
        const crack = gt.charged ? 1 : .5;
        ga.lineStyle(1.4, 0xff7a3a, .5 + .4 * Math.sin(t * 5) * crack);
        ga.strokePoints([{ x: w.x + 5, y: F - 8 }, { x: w.x + 11, y: F - 40 }, { x: w.x + 6, y: F - 70 }, { x: w.x + 15, y: F - 104 }, { x: w.x + 9, y: F - 140 }], false);
        if (gt.charged) ga.strokePoints([{ x: w.x + 16, y: F - 20 }, { x: w.x + 9, y: F - 58 }, { x: w.x + 18, y: F - 92 }], false);
        const dx = gt.dx, dy = gt.dy + Math.sin(t * 3) * 3, warn = gt.warnT > 0;
        g.fillStyle(0x2a2e3a, 1); g.fillRoundedRect(dx - 9, dy - 7, 18, 14, 4);
        g.fillStyle(0x5a6070, 1); g.fillRect(dx - 12, dy - 2, 3, 4); g.fillRect(dx + 9, dy - 2, 3, 4);
        g.fillStyle(warn ? 0xff2a3a : 0x8a1a2a, 1); g.fillCircle(dx - 3, dy, 3.2);
        ga.fillStyle(0xff2a3a, warn ? .6 + .4 * Math.sin(t * 30) : .25); ga.fillCircle(dx - 3, dy, warn ? 9 : 5);
        if (warn) { ga.lineStyle(1.5, 0xff2a3a, .8); ga.strokeCircle(dx - 3, dy, 14 - gt.warnT * 6); }
      }
    }
  }

  destroy() {
    this.dead = true;
    for (const gt of this.gates) if (gt.body) { gt.body.destroy(); gt.body = null; }
    if (this.g) this.g.destroy(); if (this.ga) this.ga.destroy();
  }
}
