// 던전 입장 시네마틱 인트로 (약 20초, ESC/Space · 오른쪽 위 「건너뛰기」 버튼 · 화면 아무 데나 두 번 탭으로 스킵)
//  1) 0~10초   무한다이노 영상 (assets/video/eternatus.mp4, 목소리·자막 없이 효과음만)
//  2) 10~20초  레드가 포켓몬들에게 「유대의 불꽃」을 나눠 주고 어둠의 사슬에 끌려가는 영상 (bond.mp4, 끝에 「PokeCell.」)
//  2번 영상이 끝나면 바로 게임이 시작된다.
//  영상을 못 틀면(파일 없음·재생 실패) 도트 연출(무한다이노 그림자·번개 / 불꽃 흡수)로 대신한다.
//  이때 공식 아트워크(npm run fetch-assets)가 있으면 도트 대신 큰 무한다이노 그림을 검붉게 깔아 쓴다.
import Phaser from 'phaser';
import { GAME_W, GAME_H, uiCamera } from '../config.js';
import { Fx } from '../systems/Fx.js';
import { Sprites } from '../systems/SpriteLoader.js';
import { Sfx } from '../systems/Audio.js';
import { Settings } from '../systems/Settings.js';
import { HK, hkText, darkBand, fadeLine, glassButton } from '../systems/ui.js';

const GROUND = 272;
const LINES = [   // 도트 연출일 때만 쓰는 자막 (영상은 자막을 따로 띄우지 않는다 — 유대의 불꽃 영상엔 자막이 들어 있다)
  '심연의 지배자 무한다이노가 뿜어낸 악의가 대륙을 삼키고, 모든 생명체의 정신을 지배하기 시작했다...',
  '선택받은 트레이너 \'레드\'는 자신의 포켓몬들에게 「유대의 불꽃」을 나누어 주고, 자신은 어둠 속으로 끌려가게 된다...'
];
const CLIPS = ['eternatus', 'bond'];   // 영상 순서
const rand = (a, b) => a + Math.random() * (b - a);
const ADD = Phaser.BlendModes.ADD;

export default class CutsceneScene extends Phaser.Scene {
  constructor() { super('Cutscene'); }

  init(data) {
    this.party = (data && data.party && data.party.length ? data.party : ['charmander', 'squirtle', 'bulbasaur']).slice(0, 3);
    this.done = false;
    this.tendrils = []; this.miasmaOn = true; this.startedAt = 0;
    this.art = null; this.useArt = false;
  }

  preload() { Sprites.queue(this.load, ['eternatus', ...this.party]); }   // 컷신에 나오는 시트만 (지연 로딩)

  create() {
    uiCamera(this);
    this.meta = this.registry.get('spriteMeta');
    this.isSolidAt = (x, y) => y >= GROUND;   // Fx 파티클이 바닥에 튕기도록
    this.fx = new Fx(this);
    this.startedAt = this.time.now;
    this.cameras.main.setBackgroundColor('#05030a');
    this.drawBackdrop();
    this.buildEternatus();
    this.loadArtwork();
    this.buildCast();
    this.g = this.add.graphics().setDepth(8);                          // 세뇌 파동(촉수)
    this.buildSubtitle();
    this.buildSkip();
    this.tweens.add({ targets: this.eter, y: '+=6', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.playClip(0);
    this.cameras.main.fadeIn(450, 5, 3, 10);
  }

  // ---------------- 무대 ----------------
  drawBackdrop() {
    const g = this.add.graphics().setDepth(0);
    const bands = [0x07030c, 0x0a040f, 0x0e0512, 0x120614, 0x170816, 0x1c0a17];
    bands.forEach((c, i) => { g.fillStyle(c, 1); g.fillRect(0, i * (GROUND / bands.length), GAME_W, GROUND / bands.length + 1); });
    // 멀리 무너진 대지 실루엣
    g.fillStyle(0x0c0610, 1);
    for (let x = 0; x < GAME_W; x += 18) { const h = 18 + ((x * 37) % 41); g.fillRect(x, GROUND - h, 18, h); }
    g.fillStyle(0x140a14, 1); g.fillRect(0, GROUND, GAME_W, GAME_H - GROUND);
    g.fillStyle(0x4a1a2a, 1); g.fillRect(0, GROUND, GAME_W, 2);
    g.fillStyle(0x2a1020, 1); for (let x = 6; x < GAME_W; x += 23) g.fillRect(x, GROUND + 6 + (x % 7), 6, 2);
  }

  buildEternatus() {
    const cx = 320, cy = 92, m = this.meta.eternatus;
    this.eterGlow = this.add.image(cx, cy + 10, 'glow').setScale(7, 3.6).setTint(0x8a0a2a).setBlendMode(ADD).setAlpha(0).setDepth(1);
    if (m && m.hasSprite) {
      this.eter = this.add.sprite(cx, cy, `sheet:eternatus:${m.anims.Idle.src}`).setScale(2.6).setTintFill(0x2c0512).setAlpha(0).setDepth(2);
      this.eter.play('eternatus:Idle:right');
    } else {
      // 에셋이 없으면 절차적 거대 괴수 실루엣
      const g = this.add.graphics().setDepth(2).setAlpha(0);
      g.fillStyle(0x2c0512, 1);
      g.fillEllipse(cx, cy, 300, 150);
      for (let i = 0; i < 9; i++) { const a = Math.PI * (1.05 + i * .11); g.fillTriangle(cx + Math.cos(a) * 120, cy + Math.sin(a) * 60, cx + Math.cos(a) * 210, cy + Math.sin(a) * 150, cx + Math.cos(a + .08) * 120, cy + Math.sin(a + .08) * 60); }
      this.eter = g;
    }
    // 붉게 빛나는 다수의 눈동자
    this.eyes = [];
    for (let i = 0; i < 9; i++) {
      const x = cx + (i - 4) * 30 + rand(-6, 6), y = cy - 6 + Math.abs(i - 4) * 7 + rand(-6, 6);
      const glow = this.add.image(x, y, 'glow').setScale(.32, .18).setTint(0xff1a2a).setBlendMode(ADD).setAlpha(0).setDepth(3);
      const core = this.add.rectangle(x, y, 6, 2, 0xff4a4a).setAlpha(0).setDepth(3);
      this.eyes.push({ glow, core, phase: Math.random() * 6 });
    }
  }

  // 공식 아트워크(무한다이맥스 우선)를 뒤에서 받아 둔다. 도트 연출일 때만 도트 실루엣 대신 보인다
  loadArtwork() {
    const man = this.registry.get('manifest'), e = man && man.pokemon && man.pokemon.eternatus;
    const file = e && (e.artworkAlt || e.artwork);
    if (!file) return;
    const attach = () => {
      if (this.done || !this.textures.exists('art:eternatus')) return;
      this.art = this.add.image(320, 100, 'art:eternatus').setTint(0x6a1424).setAlpha(0).setDepth(2);
      this.art.setScale(400 / this.art.width);
      this.art.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    };
    if (this.textures.exists('art:eternatus')) { attach(); return; }
    this.load.image('art:eternatus', `assets/${file}`);
    this.load.once('complete', attach);
    this.load.start();
  }

  buildCast() {
    this.red = this.add.image(252, GROUND, 'red-stand').setOrigin(.5, 1).setScale(2).setAlpha(0).setDepth(10);
    this.redGlow = this.add.image(252, GROUND - 30, 'glow').setTint(0xffb040).setBlendMode(ADD).setAlpha(0).setScale(.9).setDepth(9);
    this.mons = this.party.map((k, i) => {
      const m = this.meta[k];
      const s = this.add.sprite(330 + i * 52, GROUND, `sheet:${k}:${m.anims.Idle.src}`).setScale(2).setAlpha(0).setDepth(10);
      s.key = k; s.h = (m.height || 22) * 2;
      this.playMon(s, 'Idle', 'left');
      return s;
    });
  }

  playMon(s, anim, dir) {
    const m = this.meta[s.key], k = `${s.key}:${anim}:${dir}`;
    if (!this.anims.exists(k)) return;
    s.play(k);
    s.setOrigin(.5, m.anims[anim] ? m.anims[anim].oy : .75);
  }

  buildSubtitle() {
    // 할로우 나이트식 대화창: 흐려지는 어둠 띠 위아래에 덩굴 장식
    const g = this.add.graphics().setDepth(40);
    darkBand(g, 0, 290, GAME_W, 70, .9);
    this.sub = hkText(this, 44, 310, '', 12, HK.ivory, { style: { wordWrap: { width: GAME_W - 80, useAdvancedWrap: true }, lineSpacing: 4 } }).setDepth(41);
    this.subBox = [g, fadeLine(this, GAME_W / 2, 294, 520).setDepth(41), fadeLine(this, GAME_W / 2, 352, 360, .45).setDepth(41), this.sub];
    this.showSubtitle(false);   // 영상에는 자막이 들어 있으므로 도트 장면에서만 켠다
  }

  showSubtitle(on) { for (const o of this.subBox) o.setVisible(on); }

  // ---------------- 영상 ----------------
  // 개발 서버는 파일 경로, 단일 HTML 은 파일 안에 담긴 영상을 Blob 으로 풀어 쓴다
  clipURL(key) {
    const emb = window.__POKECELLS_EMBED;
    if (!emb) return `assets/video/${key}.mp4`;
    const b64 = emb.video && emb.video[key];
    if (!b64) return null;
    const cache = window.__pokecellsClips || (window.__pokecellsClips = {});
    if (!cache[key]) {
      const bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      cache[key] = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
    }
    return cache[key];
  }

  playClip(i) {
    if (this.done) return;
    if (i >= CLIPS.length) { this.endClips(); return; }
    const url = this.clipURL(CLIPS[i]), token = this.clipToken = (this.clipToken || 0) + 1;
    if (!url) { this.fallback(i); return; }
    this.miasmaOn = false;
    const v = this.video || (this.video = this.add.video(GAME_W / 2, GAME_H / 2).setDepth(30));
    const live = () => token === this.clipToken && !this.done;
    const fail = () => { if (live()) this.fallback(i); };
    v.once('created', vid => {
      vid.setDisplaySize(GAME_W, GAME_H);
      if (vid.videoTexture) vid.videoTexture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    v.once('complete', () => { if (live()) { if (i + 1 < CLIPS.length) this.cameras.main.flash(220, 255, 230, 240); this.playClip(i + 1); } });
    v.once('error', fail); v.once('unsupported', fail);
    v.once('locked', () => { if (live()) { v.setMute(true); v.play(); } });   // 소리 자동재생이 막히면 음소거로라도 재생
    v.loadURL(url);
    v.setVolume(.85 * Settings.get('volume')).setMute(!Sfx.on);
    v.setVisible(true).setAlpha(1).play();
    this.time.delayedCall(4000, () => { if (!(v.getCurrentTime() > .05)) fail(); });   // 4초가 지나도 재생이 시작되지 않으면 도트 연출로
  }

  // 2번 영상(유대의 불꽃 → 끌려가는 레드 → 「PokeCell.」)이 끝나면 바로 게임으로 (마지막 화면에서 어두워진다)
  endClips() {
    this.clipToken++;
    this.finish(false);
  }

  // 영상을 못 틀 때: i 번째 영상 장면부터 도트 연출로
  fallback(i) {
    this.clipToken++;
    if (this.video) { this.video.stop(); this.video.setVisible(false); }
    this.miasmaOn = true;
    this.useArt = true;
    this.showSubtitle(true);
    if (i === 0) this.pixelAbyss(0);
    const t0 = i === 0 ? 4 : 0;
    this.pixelBond(t0);
    this.at(t0 + 5, () => this.finish(false));
  }

  at(s, fn) { this.time.delayedCall(s * 1000, () => { if (!this.done) fn(); }); }

  // 건너뛰기: 오른쪽 위 유리 버튼 (휴대폰은 큼직하게, 화면 맨 위 가장자리에서 조금 내려서 — 사파리 가로 화면은 맨 위를 탭하면
  //  주소창이 나오느라 게임까지 탭이 오지 않는다) · 화면 아무 데나 한 번 누르면 안내, 한 번 더 누르면 건너뛰기 · ESC/Space
  buildSkip() {
    const touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const W = touch ? 124 : 112, H = touch ? 32 : 22, x = GAME_W - (touch ? 18 : 12) - W, y = touch ? 42 : 10;
    const b = glassButton(this, x, y, W, H, touch ? '건너뛰기  ▶▶' : '건너뛰기  ESC', () => this.finish(true), { size: touch ? 12 : 10, bold: true, ls: 2 });
    b.objs.forEach(o => o.setDepth(50));
    this.skipBtn = b;
    // 두 번 탭: 첫 탭에 버튼 아래 안내가 떠오르고 2.5초 안에 한 번 더 누르면 건너뛴다
    this.skipHint = hkText(this, x + W / 2, y + H + 12, touch ? '한 번 더 누르면 건너뛰기' : '한 번 더 클릭하면 건너뛰기', 10, HK.gold, { origin: .5, bold: true }).setDepth(50).setAlpha(0);
    this.input.on('pointerdown', (p, over) => {
      if (over.length || this.done || this.time.now - this.startedAt < 400) return;   // 버튼 위 · 로비에서 누르던 손가락은 빼고
      if (this.time.now - (this.skipArmed ?? -1e9) < 2500) { this.finish(true); return; }
      this.skipArmed = this.time.now;
      this.tweens.killTweensOf(this.skipHint);
      this.skipHint.setAlpha(1);
      this.tweens.add({ targets: this.skipHint, alpha: 0, delay: 1900, duration: 600 });
      b.hover = true; b.draw(); this.time.delayedCall(2500, () => { b.hover = false; if (!this.done) b.draw(); });
      Sfx.play('select');
    });
    this.input.keyboard.on('keydown', e => {
      if (e.repeat || this.time.now - this.startedAt < 300) return;   // 로비에서 누르던 키가 바로 스킵되지 않게
      if (e.code === 'Escape' || e.code === 'Space') this.finish(true);
    });
  }

  // 타이핑 자막
  type(i) {
    const str = LINES[i];
    if (this.typer) this.typer.remove();
    let n = 0;
    this.sub.setText('');
    this.typer = this.time.addEvent({
      delay: 34, repeat: str.length - 1,
      callback: () => { n++; this.sub.setText(str.slice(0, n)); if (n % 2 === 0 && str[n - 1] !== ' ') Sfx.play('type'); }
    });
  }

  // ---------------- 도트 연출 (t0 초 뒤에 시작) ----------------
  // 심연의 습격: 붉은 번개, 무한다이노의 검붉은 그림자와 눈동자 (영상을 못 틀 때만)
  pixelAbyss(t0) {
    this.at(t0 + .2, () => this.type(0));
    this.at(t0 + .3, () => this.lightning(false));
    this.at(t0 + 1.4, () => this.lightning(false));
    this.at(t0 + 2.6, () => this.lightning(true));
    this.tweens.add({ targets: this.eter, alpha: .9, duration: 3200, delay: (t0 + .3) * 1000 });
    this.tweens.add({ targets: this.eterGlow, alpha: .55, duration: 3000, delay: (t0 + .4) * 1000 });
    this.eyes.forEach((e, i) => this.at(t0 + 1 + i * .22, () => { this.tweens.add({ targets: [e.glow, e.core], alpha: 1, duration: 300 }); }));
  }

  // 레드의 유대의 불꽃 (영상을 못 틀 때만)
  pixelBond(t0) {
    this.at(t0, () => {
      this.type(1);
      this.eter.setAlpha(Math.max(this.eter.alpha, .9)); this.eterGlow.setAlpha(Math.max(this.eterGlow.alpha, .55));
      this.tweens.add({ targets: [this.red, ...this.mons], alpha: 1, duration: 500 });
    });
    this.at(t0 + 1, () => this.sendTendrils());
    this.at(t0 + 1.5, () => this.bondFlames());
  }

  lightning(big) {
    const g = this.add.graphics().setDepth(5).setBlendMode(ADD);
    let x = rand(110, 530), y = 0;
    const pts = [{ x, y }];
    while (y < GROUND - 6) { y += rand(16, 30); x += rand(-26, 26); pts.push({ x: Math.round(x), y: Math.min(GROUND, Math.round(y)) }); }
    g.lineStyle(6, 0xff2a3a, .7); g.strokePoints(pts, false);
    g.lineStyle(2, 0xffe6e6, 1); g.strokePoints(pts, false);
    this.tweens.add({ targets: g, alpha: 0, duration: 280, onComplete: () => g.destroy() });
    this.cameras.main.flash(big ? 240 : 150, 210, 30, 50);
    this.cameras.main.shake(big ? 520 : 260, (big ? .016 : .008) * Settings.get('shakeHurt'));
    this.fx.burst(pts[pts.length - 1].x, GROUND - 2, [0xff4a4a, 0xffd0d0], big ? 20 : 10, 160, { up: 120 });
    Sfx.play(big ? 'thunder' : 'zap');
  }

  // 무한다이노에게서 뻗어 나오는 세뇌 파동(촉수)
  sendTendrils() {
    this.tendrils = this.mons.map((m, i) => ({ sx: 300 + i * 22, sy: 140, tx: m.x, ty: GROUND - m.h * .45, t: 0, wob: Math.random() * 6 }));
    for (const td of this.tendrils) this.tweens.add({ targets: td, t: 1, duration: 950, ease: 'Sine.easeIn' });
    Sfx.play('ghost');
  }

  bondFlames() {
    const from = { x: this.red.x + 4, y: GROUND - 38 };
    this.tweens.add({ targets: this.redGlow, alpha: .9, scale: 1.3, duration: 400, yoyo: true, hold: 600 });
    Sfx.play('heal');
    let arrived = 0;
    this.mons.forEach((mon, i) => {
      const col = i === 1 ? 0xff5a3a : 0xffc040;
      const glow = this.add.image(from.x, from.y, 'glow').setTint(col).setBlendMode(ADD).setScale(.55).setDepth(12);
      const core = this.add.circle(from.x, from.y, 4, 0xfff6c0).setDepth(13);
      const to = { x: mon.x, y: GROUND - mon.h * .45 }, ctrl = { x: (from.x + to.x) / 2, y: 110 - i * 14 };
      const o = { t: 0 };
      this.tweens.add({
        targets: o, t: 1, duration: 1100, delay: i * 160, ease: 'Sine.easeInOut',
        onUpdate: () => {
          const u = o.t, x = (1 - u) ** 2 * from.x + 2 * (1 - u) * u * ctrl.x + u * u * to.x, y = (1 - u) ** 2 * from.y + 2 * (1 - u) * u * ctrl.y + u * u * to.y;
          glow.setPosition(x, y); core.setPosition(x, y);
          if (Math.random() < .7) this.fx.embers(x, y, [col, 0xfff6c0], 1, { speed: 14, life: .5 });
        },
        onComplete: () => {
          glow.destroy(); core.destroy();
          this.absorb(mon, col);
          if (++arrived === this.mons.length) this.repelTendrils();
        }
      });
    });
  }

  absorb(mon, col) {
    mon.setTintFill(0xffffff);
    this.time.delayedCall(140, () => mon.clearTint());
    this.fx.ring(mon.x, GROUND - mon.h * .45, 26, 0xffd25a, 320);
    this.fx.glow(mon.x, GROUND - mon.h * .45, 30, col, 500, 1);
    // 따뜻한 보호막
    const shield = this.add.graphics().setDepth(11).setBlendMode(ADD);
    const o = { k: 0 };
    this.tweens.add({
      targets: o, k: 1, duration: 1100,
      onUpdate: () => {
        shield.clear();
        const r = mon.h * .62 + o.k * 6, a = 1 - o.k;
        shield.lineStyle(2, 0xffb050, .9 * a); shield.strokeEllipse(mon.x, GROUND - mon.h * .45, r * 1.6, r * 2);
        shield.fillStyle(0xff7a3a, .18 * a); shield.fillEllipse(mon.x, GROUND - mon.h * .45, r * 1.6, r * 2);
      },
      onComplete: () => shield.destroy()
    });
    Sfx.play('heal');
  }

  repelTendrils() {
    for (const td of this.tendrils) {
      this.fx.burst(td.tx, td.ty - 10, [0x9a3ad0, 0xffd25a, 0xffffff], 10, 140, { up: 80, glow: true });
      this.tweens.add({ targets: td, t: 0, duration: 450, ease: 'Back.easeIn' });
    }
    this.cameras.main.shake(220, .008 * Settings.get('shakeHurt'));
    Sfx.play('gate');
  }

  finish(skipped) {
    if (this.done) return;
    this.done = true;
    if (this.typer) this.typer.remove();
    if (this.video) {   // 영상 소리는 화면과 함께 줄어든다
      const v = this.video, o = { k: v.getVolume() };
      this.tweens.add({ targets: o, k: 0, duration: skipped ? 200 : 500, onUpdate: () => v.setVolume(o.k) });
    }
    const cam = this.cameras.main;
    cam.fadeOut(skipped ? 220 : 520, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => this.scene.start('Game', { party: this.party }));
  }

  // ---------------- 매 프레임 ----------------
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000, t = time / 1000;
    // 검보라 독기 파티클
    if (this.miasmaOn && Math.random() < dt * 34) this.fx.burst(rand(0, GAME_W), -4, [0x2a0a3a, 0x4a1a6a, 0x1a0a22, 0x6a2a8a], 1, 12, { angle: Math.PI / 2, spread: .7, up: 0, grav: 18, bounce: true, life: 3.2, drag: 1, size: 2 });
    // 아트워크가 있으면 도트 실루엣의 등장·흔들림을 그대로 따라간다
    if (this.art && this.useArt) {
      this.eter.setVisible(false);
      this.art.setAlpha(this.eter.alpha * .8).setY(this.eter.y + 8);
    }
    // 눈동자 깜빡임
    for (const e of this.eyes) { if (e.core.alpha > .5) { const k = .7 + Math.sin(t * 4 + e.phase) * .3; e.glow.setAlpha(k); e.core.setAlpha(Math.min(1, k + .2)); } }
    const g = this.g; g.clear();
    // 세뇌 파동(촉수)
    for (const td of this.tendrils) {
      if (td.t <= .01) continue;
      const ex = td.sx + (td.tx - td.sx) * td.t, ey = td.sy + (td.ty - td.sy) * td.t;
      const cx = (td.sx + ex) / 2 + Math.sin(t * 5 + td.wob) * 22, cy = (td.sy + ey) / 2 - 10;
      const pts = [];
      for (let k = 0; k <= 14; k++) { const u = k / 14; pts.push({ x: (1 - u) ** 2 * td.sx + 2 * (1 - u) * u * cx + u * u * ex, y: (1 - u) ** 2 * td.sy + 2 * (1 - u) * u * cy + u * u * ey }); }
      g.lineStyle(8, 0x1a0622, .85); g.strokePoints(pts, false);
      g.lineStyle(3, 0x8a3ad0, .8); g.strokePoints(pts, false);
      g.fillStyle(0xc070ff, .9); g.fillCircle(ex, ey, 3);
    }
    this.fx.update(dt);
  }
}
