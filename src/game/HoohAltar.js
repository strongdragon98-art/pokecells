// 🌈 방울탑 최상층 『삼색 방울의 제단 (Sacred Bell Altar)』 · 성수의 구슬 — 성도 칠색조 강림 기믹
//  칠색조는 옥상에 들어서자마자 나오지 않는다: 황혼빛 바람과 단풍잎만 흩날리는 고요한 기와지붕 · 방 오른쪽 끝의 황금빛 제단(홈 셋) · 양쪽에 매달린 거대한 황금 방울
//  성수(엔테이 · 라이코 · 스이쿤 — 방울탑 층마다의 수호자)를 정화하면 그 성수의 구슬을 얻는다 (GameScene.killEnemy → 'orb' 줍기)
//  제단 앞에서 F / ↑:
//   · 구슬이 3개보다 적으면 가진 구슬의 홈만 희미하게 빛나고 고대의 비문 (보스전은 시작되지 않는다)
//   · 3개가 모두 있으면 봉헌 연출 (조작이 잠시 멈춘다 — GameScene.cinema)
//     ① 0 ~ 1.2초: 머리 위로 떠오른 붉은 · 황금 · 푸른 구슬이 삼각형으로 돌다가 제단 홈에 차례로 박힌다 (카랑-! 방울 소리 · 빛기둥)
//     ② 1.2 ~ 2.2초: 세 구슬에서 붉은 불길 · 황금 번개 · 푸른 물결 오라가 솟아 하늘에서 하나로 · 양쪽 거대한 황금 방울이 저절로 격렬하게 울린다
//     ③ 2.2 ~ 3.5초: 석양 구름이 무지개빛 후광으로 갈라지고 칠색조가 일곱 빛깔 깃털과 성스러운 불꽃을 흩뿌리며 제단 위로 내려앉는다 (GameScene.bossIntro · 흔들림 · 포효)
//     ④ 3.5초: 「🌈 방울탑의 수호신 [칠색조]가 강림했습니다!」 배너 · 보스 체력 바 · 전투 시작
//  예전 저장(구슬이 없던 때)은 그 성수의 방을 이미 정화했으면 구슬을 가진 것으로 친다 (hasOrb)
import Phaser from 'phaser';
import { TILE } from '../config.js';
import { Sfx } from '../systems/Audio.js';
import { bolt } from './Perks.js';
import { Music } from '../systems/Music.js';

const ADD = Phaser.BlendModes.ADD;
const K = 1.3;   // 제단 크기 (도트 64×46 을 키워 옥상에서 눈에 띄게)
export const ORB_KEYS = ['entei', 'raikou', 'suicune'];   // 제단 홈 왼쪽 → 오른쪽
export const BEAST_ORBS = {
  entei: { name: '염제의 붉은 구슬', en: 'Orb of Entei', icon: '🔴', color: 0xff4a2a, light: 0xffb08a, aura: [0xff4a2a, 0xff9a3a, 0xffd060] },
  raikou: { name: '뇌공의 황금 구슬', en: 'Orb of Raikou', icon: '🟡', color: 0xffd040, light: 0xfff4a0, aura: [0xffd040, 0xfff4a0, 0xffffff] },
  suicune: { name: '수군의 푸른 구슬', en: 'Orb of Suicune', icon: '🔵', color: 0x3aa8ff, light: 0xa8e8ff, aura: [0x3aa8ff, 0x8ad8ff, 0xe0f8ff] }
};
export const ALTAR_TEXT = n => `📜 [고대의 비문] 불꽃(엔테이), 번개(라이코), 북풍(스이쿤)의 구슬 세 개가 모두 모였을 때, 무지개빛 날개가 하늘에서 강림하리라. (현재 보유: ${n}/3)`;
const RAINBOW = [0xff4a4a, 0xff9a2a, 0xffe04a, 0x6aff6a, 0x4ac8ff, 0x8a6aff, 0xff6ad8];
const LEAVES = [0xff7a2a, 0xffb040, 0xd84a2a, 0xffd060, 0xc8402a];

// 구슬을 가졌나: 주운 구슬 · 또는 이 지방에서 그 성수의 방을 이미 정화했다 (구슬 이전 저장)
export function hasOrb(scene, k) {
  const p = scene.player;
  return !!((p && p.orbs && p.orbs[k]) || (scene.level && scene.stageIdx === 1 && scene.level.rooms.some(r => r.boss === k && r.cleared)));
}
export const orbCount = scene => ORB_KEYS.filter(k => hasOrb(scene, k)).length;

const css = c => '#' + c.toString(16).padStart(6, '0');
function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, w, h), c = t.getContext();
  const F = (x, y, ww, hh, col, a = 1) => { c.globalAlpha = a; c.fillStyle = css(col); c.fillRect(x, y, ww, hh); c.globalAlpha = 1; };
  draw(F, c); t.refresh();
  return key;
}
// 성수의 구슬: 12×12 빛나는 구슬 (검은 테두리 · 위는 밝고 아래는 짙은 몸 · 하얀 하이라이트)
export function orbTexture(scene, k) {
  const o = BEAST_ORBS[k], dark = Phaser.Display.Color.IntegerToColor(o.color).darken(35).color;
  return canvasTex(scene, `orb:${k}`, 12, 12, F => {
    const rows = [[4, 4], [2, 8], [1, 10], [0, 12], [0, 12], [0, 12], [0, 12], [0, 12], [0, 12], [1, 10], [2, 8], [4, 4]];
    rows.forEach(([x0, w], y) => {
      F(x0, y, w, 1, 0x1a0a14);
      if (y > 0 && y < 11 && w > 2) F(x0 + 1, y, w - 2, 1, y >= 7 ? dark : o.color);
    });
    F(3, 2, 3, 2, o.light); F(3, 2, 1, 1, 0xffffff); F(7, 8, 2, 1, o.light, .6);
  });
}
// 삼색 방울의 제단: 64×46 — 두 단 돌 받침 · 황금 테 · 홈 셋(위에 작은 방울 문양) · 꼭대기 황금 방울 장식
function altarArt(scene) {
  return canvasTex(scene, 'prop:hooh-altar', 64, 46, F => {
    const stone = 0x5a4a3e, stoneD = 0x3a2e26, stoneL = 0x7a6858, gold = 0xd8a63a, goldL = 0xffe08a, goldD = 0x8a5a1a, red = 0x9a2a1a;
    F(0, 38, 64, 8, stoneD); F(1, 38, 62, 7, stone); F(1, 38, 62, 1, stoneL);                 // 아랫단
    F(6, 30, 52, 8, stoneD); F(7, 30, 50, 7, stone); F(7, 30, 50, 1, stoneL);                 // 윗단
    F(10, 12, 44, 18, goldD); F(11, 12, 42, 17, red); F(11, 12, 42, 1, 0xc84a2a);             // 옻칠 몸체
    F(10, 12, 44, 2, gold); F(10, 28, 44, 2, gold); F(10, 12, 2, 18, gold); F(52, 12, 2, 18, gold);   // 금테
    F(10, 12, 44, 1, goldL);
    for (const sx of [14, 29, 44]) {   // 홈 셋 (비어 있으면 깊은 그늘)
      F(sx - 1, 17, 8, 9, goldD); F(sx, 18, 6, 7, 0x140806); F(sx + 1, 19, 4, 5, 0x0a0404);
      F(sx + 1, 14, 4, 2, goldL); F(sx + 2, 13, 2, 1, gold);                                   // 작은 방울 문양
    }
    F(28, 4, 8, 8, goldD); F(29, 4, 6, 7, gold); F(30, 5, 2, 3, goldL); F(31, 2, 2, 2, goldD); F(31, 11, 2, 1, goldD);   // 꼭대기 황금 방울
    F(20, 10, 24, 2, goldD); F(21, 10, 22, 1, gold);                                          // 처마 장식
    for (let x = 2; x < 62; x += 6) F(x, 44, 3, 1, stoneL, .5);
  });
}
// 거대한 황금 방울 (옥상 양쪽에 매달린다): 30×38
function bellArt(scene) {
  return canvasTex(scene, 'prop:hooh-bell', 30, 38, F => {
    const gold = 0xd8a63a, goldL = 0xffe08a, goldD = 0x8a5a1a;
    F(13, 0, 4, 5, 0x3a2418);                                                   // 고리
    const prof = [6, 7, 8, 8, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15];
    prof.forEach((hw, i) => { const y = 5 + i; F(15 - hw, y, hw * 2, 1, goldD); F(16 - hw, y, hw * 2 - 2, 1, gold); F(16 - hw, y, Math.max(1, hw * .5), 1, goldL); });
    F(0, 34, 30, 3, goldD); F(1, 34, 28, 2, gold); F(1, 34, 28, 1, goldL);      // 입술
    F(13, 36, 4, 2, 0x5a3a18);                                                  // 추
    for (const y of [12, 22]) F(4, y, 22, 1, goldD, .8);                        // 띠
  });
}

export class HoohAltar {
  constructor(scene, room) {
    this.s = scene; this.room = room; room.altarGated = true;   // updateRooms 가 들어서는 순간 보스전을 시작하지 않는다
    const s = scene, x = Math.round(room.right - 84), gy = s.floorAt ? s.floorAt(x, room) : room.F * TILE;
    this.x = x; this.y = gy; this.H = 46 * K; this.objs = [];
    this.img = this.add(s.add.image(x, gy + 3, altarArt(s)).setOrigin(.5, 1).setDepth(6).setScale(K));
    if (s.webgl) this.img.setPipeline('Light2D');
    this.sockets = [-15, 0, 15].map((dx, i) => {
      const sx = x + (dx + 1) * K, sy = gy + 3 - (46 - 21) * K;
      const orb = this.add(s.add.image(sx, sy, orbTexture(s, ORB_KEYS[i])).setDepth(6.2).setScale(K).setVisible(false));
      const glow = this.add(s.add.image(sx, sy, 'glow').setBlendMode(ADD).setTint(BEAST_ORBS[ORB_KEYS[i]].color).setScale(.5).setAlpha(0).setDepth(6.3));
      return { x: sx, y: sy, orb, glow, lit: false };
    });
    this.aura = this.add(s.add.image(x, gy - 36, 'glow').setBlendMode(ADD).setTint(0xffd27a).setScale(1.6, 1.1).setAlpha(.22).setDepth(5.9));
    // 양쪽 거대한 황금 방울 (제단 양옆 · 줄에 매달려 천천히 흔들린다 — 봉헌 때 저절로 격렬하게)
    this.bells = [Math.max(room.left + 30, x - 118), Math.min(room.right - 22, x + 64)].map((bx, i) => {
      const by = Math.max(room.top + 6, gy - 170), rope = this.add(s.add.rectangle(bx, room.top - 40, 2, by - room.top + 40, 0x3a2418).setOrigin(.5, 0).setDepth(5.8));
      const b = this.add(s.add.image(bx, by, bellArt(s)).setOrigin(.5, 0).setDepth(5.85).setScale(1.3));
      if (s.webgl) b.setPipeline('Light2D');
      const shine = this.add(s.add.image(bx, by + 30, 'glow').setBlendMode(ADD).setTint(0xffd27a).setScale(1.4).setAlpha(0).setDepth(5.86));
      return { b, rope, shine, ph: i * 1.7, swing: 0 };
    });
    this.it = { kind: 'altar', altar: this, x, y: gy, range: 38, used: false, repeat: true, prompt: '[F 또는 ↑ : 삼색 방울의 제단]', promptY: gy - 58 };
    if (s.props) s.props.interacts.push(this.it);
    if (room.cleared) this.showLit();   // 이미 정화했다: 세 구슬이 박힌 채 고요하게
  }
  add(o) { this.objs.push(o); return o; }
  showLit() { for (const so of this.sockets) { so.lit = true; so.orb.setVisible(true); so.glow.setAlpha(.45); } }
  // 보스전을 다시 하거나(실패 · 테스트 워프) 처음 상태로: lit = 박힌 구슬은 그대로 둘까
  reset(keepLit = false) {
    this.busy = false; this.it.used = false;
    if (!this.s.props.interacts.includes(this.it)) this.s.props.interacts.push(this.it);
    if (!keepLit) for (const so of this.sockets) { so.lit = false; so.orb.setVisible(false); so.glow.setAlpha(0); }
  }

  // 제단 앞에서 F / ↑
  use() {
    const s = this.s, room = this.room;
    if (this.busy || room.cleared || room.entered || s.arenaRoom || s.over) return;
    const n = orbCount(s);
    if (n < 3) {   // 가진 구슬의 홈만 희미하게 · 고대의 비문
      ORB_KEYS.forEach((k, i) => { if (!hasOrb(s, k)) return; const g = this.sockets[i].glow; s.tweens.killTweensOf(g); s.tweens.add({ targets: g, alpha: { from: 0, to: .5 }, duration: 380, yoyo: true, repeat: 1, onComplete: () => g.setAlpha(this.sockets[i].lit ? .45 : 0) }); });
      s.events.emit('lore', ALTAR_TEXT(n));
      Sfx.play('resonate');
      return;
    }
    this.rite();
  }

  // ---------------- 봉헌 & 칠색조 강림 (3.5초) ----------------
  rite() {
    const s = this.s, room = this.room, p = s.player, cam = s.cameras.main, fx = s.fx;
    this.busy = true; this.it.used = true;
    s.props.interacts = s.props.interacts.filter(q => q !== this.it);
    room.entered = true; s.setGates(room, false); s.lockArena(room);
    s.cinema = true; s.altarRite = { room, x: this.x, top: this.y - this.H };
    Music.stop();
    const later = (ms, f) => s.time.delayedCall(ms, () => { if (this.busy && !s.over && s.level && s.altarRite && s.altarRite.room === room) f(); });
    // ① 구슬 부유 → 삼각형으로 회전 → 제단 홈에 차례로 (카랑-!)
    const head = { x: p.x, y: p.y - 44 }, rot = { a: 0, r: 0 };
    const orbs = ORB_KEYS.map(k => {
      const o = s.add.image(p.x, p.y - 8, orbTexture(s, k)).setDepth(47).setScale(1.5);
      o.halo = s.add.image(p.x, p.y - 8, 'glow').setBlendMode(ADD).setTint(BEAST_ORBS[k].color).setScale(.45).setAlpha(.9).setDepth(46.9);
      return o;
    });
    const place = () => orbs.forEach((o, i) => { if (o.flying) return; const a = rot.a + i * Math.PI * 2 / 3 - Math.PI / 2; o.setPosition(head.x + Math.cos(a) * rot.r, head.y + Math.sin(a) * rot.r * .75); o.halo.setPosition(o.x, o.y); });
    Sfx.play('resonate');
    s.tweens.add({ targets: rot, a: Math.PI * 3, r: 16, duration: 720, ease: 'Sine.easeOut', onUpdate: place });
    orbs.forEach((o, i) => later(560 + i * 210, () => {
      const so = this.sockets[i];
      o.flying = true;
      s.tweens.add({ targets: [o, o.halo], x: so.x, y: so.y, duration: 170, ease: 'Quad.easeIn', onComplete: () => {
        o.destroy(); o.halo.destroy();
        so.lit = true; so.orb.setVisible(true); so.glow.setAlpha(.6);
        Sfx.play('bell');
        const col = BEAST_ORBS[ORB_KEYS[i]].color, pillar = s.add.image(so.x, so.y, 'glow').setOrigin(.5, 1).setBlendMode(ADD).setTint(col).setScale(.35, 4.5).setAlpha(.9).setDepth(46);
        s.tweens.add({ targets: pillar, alpha: 0, scaleX: .1, duration: 650, onComplete: () => pillar.destroy() });
        fx.burst(so.x, so.y, [col, 0xffffff], 14, 120, { glow: true, up: 60, life: .5 }); fx.ring(so.x, so.y, 18, col, 300);
      } });
    }));
    // ② 무지개빛 공명: 세 오라가 솟아 하늘에서 하나로 · 거대한 황금 방울이 저절로 격렬하게
    const top = { x: this.x, y: room.top + 46 };
    later(1200, () => {
      const merge = s.add.image(top.x, top.y, 'glow').setBlendMode(ADD).setTint(0xfff0c0).setScale(.4).setAlpha(.9).setDepth(45);
      s.tweens.add({ targets: merge, scale: 2.6, duration: 1000, ease: 'Sine.easeIn' });
      this.merge = merge;
      for (const bl of this.bells) { bl.swing = 1; s.tweens.add({ targets: bl.shine, alpha: .7, duration: 300 }); }
      fx.shake(.006, 1000);
      for (let k = 0; k < 4; k++) s.time.delayedCall(k * 250, () => { if (this.busy) Sfx.play('bigbell'); });
      const ev = s.time.addEvent({ delay: 50, repeat: 19, callback: () => {
        if (!this.busy) { ev.remove(); return; }
        this.sockets.forEach((so, i) => {
          const k = ORB_KEYS[i], A = BEAST_ORBS[k].aura;
          if (k === 'raikou') { if (Math.random() < .45) bolt(s, so.x, so.y, top.x, top.y, 0xffe040, 2, 200); fx.burst(so.x, so.y - 4, A, 2, 60, { angle: -Math.PI / 2, spread: .4, up: 120, grav: -60, bounce: false, glow: true, life: .5 }); }
          else fx.burst(so.x + (Math.random() - .5) * 6, so.y - 4, A, 3, 50, { angle: Math.atan2(top.y - so.y, top.x - so.x), spread: .25, up: 0, grav: -20, bounce: false, glow: true, life: .9, size: 2 });
        });
      } });
      for (let k = 0; k < 3; k++) {   // 오라 줄기가 하늘로 솟아 합쳐진다
        const so = this.sockets[k], col = BEAST_ORBS[ORB_KEYS[k]].color, beam = s.add.image(so.x, so.y, 'glow').setOrigin(.5, 1).setBlendMode(ADD).setTint(col).setScale(.3, .1).setAlpha(.8).setDepth(45.5);
        beam.setRotation(Math.atan2(top.x - so.x, -(top.y - so.y)) * -1);
        s.tweens.add({ targets: beam, scaleY: Math.hypot(top.x - so.x, top.y - so.y) / 64, duration: 700, ease: 'Cubic.easeOut' });
        s.tweens.add({ targets: beam, alpha: 0, delay: 900, duration: 500, onComplete: () => beam.destroy() });
      }
    });
    // ③ 석양 구름이 무지개빛 후광으로 갈라지고 칠색조가 내려앉는다 (GameScene.bossIntro 의 제단 강하)
    later(2200, () => {
      cam.flash(520, 255, 236, 196, true); fx.shake(.012, 600); Sfx.play('purify_world');
      const halo = s.add.graphics().setDepth(44.5).setBlendMode(ADD).setPosition(top.x, top.y);
      RAINBOW.forEach((c, i) => { halo.lineStyle(5, c, .55); halo.beginPath(); halo.arc(0, 0, 40 + i * 6, Math.PI, Math.PI * 2); halo.strokePath(); });
      halo.setScale(.3);
      s.tweens.add({ targets: halo, scale: 2.4, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => halo.destroy() });
      for (const d of [-1, 1]) {   // 갈라지는 석양 구름
        const cl = s.add.image(top.x, top.y - 10, 'glow').setTint(0x6a2a1a).setScale(4, 1.3).setAlpha(.75).setDepth(44.4);
        s.tweens.add({ targets: cl, x: top.x + d * 260, alpha: 0, duration: 1200, ease: 'Cubic.easeOut', onComplete: () => cl.destroy() });
      }
      if (this.merge) { s.tweens.add({ targets: this.merge, alpha: 0, scale: 4, duration: 700, onComplete: () => { if (this.merge) this.merge.destroy(); this.merge = null; } }); }
      s.startBoss(room);
    });
    // ④ 강림 완료: 배너 · 보스 체력 바 · 전투 시작
    later(3500, () => {
      s.cinema = false; s.altarRite = null; this.busy = false;
      for (const bl of this.bells) { bl.swing = .25; s.tweens.add({ targets: bl.shine, alpha: 0, duration: 800 }); }
      s.events.emit('banner', '🌈 방울탑의 수호신 [칠색조]가 강림했습니다!', '세 성수의 구슬이 무지개빛 날개를 불러냈다');
      if (s.boss && s.boss.alive) s.events.emit('boss', s.boss);
    });
  }

  // 매 프레임: 방울 흔들림 · 홈 맥동 · 보스전 전엔 황혼빛 바람과 단풍잎
  update(dt, view) {
    const s = this.s, room = this.room, t = s.time.now / 1000;
    for (const bl of this.bells) {
      const amp = bl.swing > .5 ? .5 : .05 + bl.swing * .1, sp = bl.swing > .5 ? 9 : 1.2;
      bl.b.setRotation(Math.sin(t * sp + bl.ph) * amp); bl.rope.setRotation(bl.b.rotation * .3);
    }
    this.aura.setAlpha(.18 + Math.sin(t * 1.4) * .06);
    for (const so of this.sockets) if (so.lit && !this.busy) so.glow.setAlpha(.35 + Math.sin(t * 2 + so.x) * .12);
    const inView = room.right > view.x && room.left < view.right && room.bottom > view.y && room.top < view.bottom;
    if (inView && !room.entered && !room.cleared && Math.random() < .35) {   // 단풍잎이 바람을 타고 흩날린다
      s.fx.burst(view.x - 6, view.y + Math.random() * view.height * .8, LEAVES, 1, 50, { angle: .15, spread: .5, up: 0, grav: 18, bounce: false, life: 3.2, size: 2, drag: .995 });
    }
  }

  destroy() {
    this.busy = false;
    if (this.merge) { this.merge.destroy(); this.merge = null; }
    for (const o of this.objs) if (o && o.scene) o.destroy();
    this.objs = [];
    if (this.s.props) this.s.props.interacts = this.s.props.interacts.filter(q => q !== this.it);
  }
}
