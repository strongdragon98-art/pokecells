// 오프닝 화면 — 링크로 처음 들어오면 여기서 시작한다
//  ① 「포켓셀즈 · RED'S BOND」 로고가 떠오르고 "아무 키나 누르세요" (첫 입력에 소리를 켠다 — 모바일 브라우저는 손대기 전엔 소리를 못 낸다)
//  ② 메뉴: 새 게임(→ 도감 로비에서 파티 편성) · 불러오기(저장한 판 이어하기) · 설정(볼륨·소리·흔들림) · 종료
//  배경: 심연 그라데이션 · 레드의 포켓몬 실루엣(리자몽·피카츄) · 빛기둥 · 안개 · 떠다니는 빛가루
import Phaser from 'phaser';
import { Sfx } from '../systems/Audio.js';
import { Music } from '../systems/Music.js';
import { Settings, SETTING_DEFAULTS } from '../systems/Settings.js';
import { RunSave } from '../systems/RunSave.js';
import { HK, hkText, fadeLine, glassPanel, glassButton, hkMenu } from '../systems/ui.js';
import { uiCamera } from '../config.js';

const ADD = Phaser.BlendModes.ADD;
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create(data) {
    uiCamera(this);
    this.meta = this.registry.get('spriteMeta');
    this.ready = !!(data && data.skipPress);   // 로비에서 돌아오면 바로 메뉴
    this.panel = null; this.leaving = false; this.menu = null;   // 씬 인스턴스는 재사용된다
    const cam = this.cameras.main;
    cam.setBackgroundColor('#05040a');
    if (this.renderer.type === Phaser.WEBGL) cam.postFX.addVignette(.5, .5, .9, .38);
    this.drawBackdrop();
    this.drawLogo();
    this.menuL = this.add.container(0, 0).setDepth(10);
    this.panelL = this.add.container(0, 0).setDepth(20);
    hkText(this, 632, 352, `v.${BUILD}`, 7, HK.faint, { origin: [1, 1] }).setDepth(5);
    hkText(this, 8, 352, '팬메이드 비공식 게임 · 포켓몬스터의 권리는 각 권리자에게 있습니다', 7, HK.faint, { origin: [0, 1] }).setDepth(5);

    if (this.ready) this.showMenu(); else this.showPress();
    this.input.keyboard.on('keydown', e => this.onKey(e));
    this.input.keyboard.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    cam.fadeIn(600, 5, 4, 10);
  }

  // ---------------- 배경 ----------------
  drawBackdrop() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a0716, 0x0a0716, 0x1a0a1e, 0x1a0a1e, 1); g.fillRect(0, 0, 640, 360);
    // 레드의 포켓몬 실루엣 (붉은 테두리 빛)
    const sil = (k, x, y, sc, flip, rim) => {
      const m = this.meta[k]; if (!m || !m.hasSprite || !m.anims.Idle) return;
      const a = m.anims.Idle, key = `sheet:${k}:${a.src}`;
      const glow = this.add.sprite(x, y + 2, key).setOrigin(.5, a.oy).setScale(sc * 1.04).setFlipX(flip).setTintFill(rim).setBlendMode(ADD).setAlpha(.18);
      const s = this.add.sprite(x, y, key).setOrigin(.5, a.oy).setScale(sc).setFlipX(flip).setTintFill(0x0c0714).setAlpha(.92);
      const an = `${k}:Idle:left`;
      if (this.anims.exists(an)) { s.play(an); glow.play(an); }
      this.tweens.add({ targets: glow, alpha: { from: .1, to: .26 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    sil('charizard', 500, 352, 5, false, 0xff5a3a);
    sil('pikachu', 150, 352, 4, true, 0xffd25a);
    const core = this.add.image(320, 150, 'glow').setTint(0x9a1236).setBlendMode(ADD).setScale(3.2, 2).setAlpha(.12);
    this.tweens.add({ targets: core, alpha: { from: .07, to: .17 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    [[120, -.3, .08], [320, -.18, .06], [530, -.36, .07]].forEach(([x, rot, al], i) => {
      const r = this.add.image(x, -10, 'ray').setOrigin(.5, 0).setRotation(rot).setScale(2.6, 1.7).setTint(0xcfc4ff).setBlendMode(ADD).setAlpha(al);
      this.tweens.add({ targets: r, alpha: { from: al * .5, to: al * 1.3 }, duration: 3200 + i * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.fogs = [
      this.add.tileSprite(0, 280, 640, 64, 'fog').setOrigin(0).setScale(1, 1.4).setTint(0x7a5a9a).setAlpha(.5),
      this.add.tileSprite(0, -12, 640, 64, 'fog').setOrigin(0).setTint(0x3a2a6a).setAlpha(.25)
    ];
    this.motes = [];
    for (let i = 0; i < 50; i++) {
      this.motes.push(this.add.circle(Math.random() * 640, Math.random() * 360, Math.random() < .2 ? 1 : .6, Math.random() < .3 ? 0xffb39a : 0xefeae0, .2 + Math.random() * .6)
        .setData('v', 4 + Math.random() * 10).setData('ph', Math.random() * 6));
    }
  }

  // 「포켓셀즈」 큰 로고 + 붉은→금빛 「RED'S BOND」 + 부제
  drawLogo() {
    const L = this.add.container(0, 0).setDepth(6);
    const halo = this.add.image(320, 92, 'glow').setTint(0xff7a5a).setBlendMode(ADD).setScale(4.2, 1.3).setAlpha(.14);
    const title = hkText(this, 320, 92, '포켓셀즈', 38, '#ffffff', { bold: true, ls: 10, origin: .5, glow: true, glowColor: 'rgba(255,150,110,0.55)', blur: 8 });
    const grad = title.context.createLinearGradient(0, 0, 0, title.height);
    grad.addColorStop(0, '#fff0d8'); grad.addColorStop(.5, '#ffb07a'); grad.addColorStop(1, '#ff5a4a');
    title.setFill(grad);
    const en = hkText(this, 320, 132, "RED'S BOND", 15, '#ffd25a', { title: true, bold: true, ls: 8, origin: .5, glow: true, glowColor: 'rgba(255,200,90,0.5)' });
    const sub = hkText(this, 320, 152, '심연에 잠긴 다섯 지방을 정화하라', 9, HK.abyss, { ls: 4, origin: .5 });
    L.add([halo, title, en, sub, fadeLine(this, 320, 166, 360, .8)]);
    L.setAlpha(0); L.y = 8;
    this.tweens.add({ targets: L, alpha: 1, y: 0, duration: 1400, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: halo, alpha: { from: .1, to: .2 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ① 아무 키나 누르세요
  showPress() {
    const t = hkText(this, 320, 268, '화면을 누르거나 아무 키나 누르세요', 11, HK.ivory, { ls: 3, origin: .5, glow: true });
    this.menuL.add(t);
    this.tweens.add({ targets: t, alpha: { from: .25, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.input.once('pointerdown', () => this.wake());
  }
  wake() {
    if (this.ready) return;
    this.ready = true;
    Sfx.unlock(); Sfx.play('swap');
    this.showMenu();
  }

  // ② 메뉴
  showMenu() {
    Music.play('mistcave');
    const L = this.menuL; L.removeAll(true);
    const rs = RunSave.peek();
    const when = rs ? new Date(rs.at) : null, pad = n => String(n).padStart(2, '0');
    const items = [
      { label: '새 게임', onPick: () => this.go('Lobby') },
      { label: '불러오기', enabled: !!rs, onPick: () => this.go('Game', { resume: RunSave.peek() }) },
      { label: '설정', onPick: () => this.showSettings() },
      { label: '종료', onPick: () => this.quit() }
    ];
    this.menu = hkMenu(this, 320, 206, items, { layer: L, gap: 26, size: 13, ls: 4, bold: true, pickKeys: ['Enter', 'Space', 'KeyZ'], onMove: () => Sfx.play('select') });
    if (rs) this.menu.select(1);   // 저장한 판이 있으면 불러오기에 먼저
    const info = rs ? `저장: ${rs.stageIdx + 1}지방 ${rs.stageName || ''}  ·  ${when.getMonth() + 1}/${when.getDate()} ${pad(when.getHours())}:${pad(when.getMinutes())}` : '저장한 판이 없어요 · 포켓몬센터에 가면 자동 저장';
    L.add(hkText(this, 320, 318, info, 8.5, rs ? HK.gold : HK.faint, { origin: .5 }));
    L.add(hkText(this, 320, 334, '↑↓ 고르기 · Enter 결정', 8, HK.faint, { origin: .5 }));
    L.setAlpha(0);
    this.tweens.add({ targets: L, alpha: 1, duration: 500 });
  }

  go(scene, data) {
    if (this.leaving) return;
    if (scene === 'Game' && !(data && data.resume)) { Sfx.play('deny'); return; }
    this.leaving = true;
    Sfx.unlock(); Sfx.play('swap');
    Music.stop();
    this.cameras.main.fade(400, 5, 4, 10, true);   // force: 처음 밝아지는 중에 골라도 어두워지기가 무시되지 않게
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }

  // 종료 확인: 브라우저에 따라 탭이 바로 닫히므로 한 번 묻는다
  quit() {
    Sfx.play('select');
    const L = this.panelL; L.removeAll(true);
    this.panel = 'confirm';
    this.blocker(L);
    const g = this.add.graphics(); L.add(g);
    g.fillStyle(0x05040a, .8); g.fillRect(0, 0, 640, 360);
    glassPanel(g, 200, 128, 240, 104, { alpha: .95 });
    L.add(hkText(this, 320, 154, '게임을 종료할까요?', 12, HK.ivory, { bold: true, origin: .5 }));
    L.add(hkText(this, 320, 174, '진행은 마지막으로 저장한 곳까지 남아 있어요', 8.5, HK.dim, { origin: .5 }));
    glassButton(this, 222, 196, 92, 24, '종료', () => this.doQuit(), { size: 10, bold: true, primary: true, layer: L });
    glassButton(this, 326, 196, 92, 24, '취소', () => this.closePanel(), { size: 10, bold: true, layer: L });
  }

  // 종료: 브라우저는 사용자가 직접 연 탭은 스크립트로 못 닫기도 한다 → 닫아 보고, 안 닫히면 종료 화면
  doQuit() {
    Sfx.play('select');
    Music.stop();
    try { window.close(); } catch (e) { /* 무시 */ }
    this.time.delayedCall(250, () => {
      const L = this.panelL; L.removeAll(true);
      const block = this.blocker(L);
      const g = this.add.graphics(); g.fillStyle(0x020205, 1); g.fillRect(0, 0, 640, 360); L.add(g);
      L.add(hkText(this, 320, 160, '플레이해 주셔서 감사합니다', 16, HK.ivory, { bold: true, ls: 4, origin: .5, glow: true }));
      L.add(hkText(this, 320, 188, '이 탭(창)을 닫으면 게임이 끝납니다 · 진행은 저장한 곳까지 남아 있어요', 9, HK.dim, { origin: .5 }));
      L.add(hkText(this, 320, 222, '화면을 누르거나 아무 키나 누르면 처음 화면으로', 8.5, HK.faint, { origin: .5 }));
      this.panel = 'quit';
      this.time.delayedCall(400, () => block.once('pointerdown', () => this.closePanel()));
    });
  }

  // ---------------- 설정 (볼륨 · 소리 · 흔들림) — 키 설정·터치 패드는 게임 안 설정(O)에서 ----------------
  showSettings(focus = 0) {
    const L = this.panelL; L.removeAll(true);
    this.panel = 'settings';
    this.blocker(L);
    const g = this.add.graphics(); L.add(g);
    g.fillStyle(0x05040a, .8); g.fillRect(0, 0, 640, 360);
    const PX = 150, PY = 70, PW = 340, PH = 222;
    glassPanel(g, PX, PY, PW, PH, { alpha: .95 });
    L.add(hkText(this, 320, PY + 18, '설정', 13, HK.ivory, { bold: true, ls: 8, origin: .5, glow: true }));
    const pct = v => `${Math.round(v * 100)}%`;
    const rows = [
      { label: '볼륨', key: 'volume', min: 0, max: 1, step: .1, fmt: v => v <= 0 ? '음소거' : pct(v) },
      { label: '소리', key: 'sound', toggle: true },
      { label: '타격 흔들림', key: 'shakeHit', min: 0, max: 1.5, step: .1, fmt: v => v <= 0 ? '끔' : pct(v) },
      { label: '피격 흔들림', key: 'shakeHurt', min: 0, max: 1.5, step: .1, fmt: v => v <= 0 ? '끔' : pct(v) }
    ];
    this.setRows = rows; this.setFocus = Phaser.Math.Clamp(focus, 0, rows.length - 1);
    rows.forEach((r, i) => {
      const y = PY + 54 + i * 32, on = i === this.setFocus;
      if (on) { g.fillStyle(0xffd27a, .07); g.fillRoundedRect(PX + 10, y - 13, PW - 20, 26, 7); g.fillStyle(HK.goldN, .9); g.fillRect(PX + 12, y - 8, 2, 16); }
      L.add(hkText(this, PX + 24, y, r.label, 10.5, on ? HK.ivory : HK.dim, { bold: on, origin: [0, .5] }));
      if (r.toggle) {
        const v = Settings.get(r.key);
        glassButton(this, PX + 196, y - 11, 120, 22, v ? '켬' : '끔', () => this.adjust(i, 1), { size: 10, bold: true, primary: v, layer: L });
      } else {
        glassButton(this, PX + 196, y - 11, 24, 22, '−', () => this.adjust(i, -1), { size: 12, bold: true, layer: L });
        glassButton(this, PX + 292, y - 11, 24, 22, '+', () => this.adjust(i, 1), { size: 12, bold: true, layer: L });
        L.add(hkText(this, PX + 256, y, r.fmt(Settings.get(r.key)), 10, HK.gold, { bold: true, origin: .5 }));
      }
    });
    glassButton(this, PX + 24, PY + PH - 40, 120, 24, '기본값으로', () => {
      for (const r of rows) Settings.set(r.key, SETTING_DEFAULTS[r.key]);
      Sfx.play('select'); this.showSettings(this.setFocus);
    }, { size: 10, bold: true, layer: L });
    glassButton(this, PX + PW - 144, PY + PH - 40, 120, 24, '닫기', () => this.closePanel(), { size: 10, bold: true, primary: true, layer: L });
    L.add(hkText(this, 320, PY + PH + 14, '↑↓ 항목 · ← → 조절 · Esc 닫기  ·  키 설정과 터치 패드는 게임 안 설정(O)에서', 8, HK.faint, { origin: .5 }));
  }
  adjust(i, d) {
    const r = this.setRows[i];
    if (r.toggle) Settings.set(r.key, !Settings.get(r.key));
    else Settings.set(r.key, Math.round(Phaser.Math.Clamp(Settings.get(r.key) + d * r.step, r.min, r.max) * 100) / 100);
    Sfx.play(r.key === 'volume' ? 'hit_normal' : 'select');
    this.showSettings(i);
  }
  // 창 뒤의 메뉴가 눌리지 않게 화면 전체를 덮는 투명 판 (Phaser 는 맨 위 대상만 누른다)
  blocker(L) { const z = this.add.zone(0, 0, 640, 360).setOrigin(0).setInteractive(); L.add(z); return z; }

  closePanel() {
    const was = this.panel;
    this.panelL.removeAll(true); this.panel = null;
    Sfx.play('select');
    if (was === 'quit') { this.ready = true; this.showMenu(); }
  }

  onKey(e) {
    Sfx.unlock();
    if (!this.ready) { this.wake(); return; }
    if (this.panel === 'quit') { this.closePanel(); return; }
    if (this.panel === 'confirm') { if (e.code === 'Enter') this.doQuit(); else if (e.code === 'Escape') this.closePanel(); return; }
    if (this.panel === 'settings') {
      const n = this.setRows.length, f = this.setFocus;
      if (e.code === 'Escape' || e.code === 'KeyO') this.closePanel();
      else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { Sfx.play('select'); this.showSettings((f + (e.code === 'ArrowDown' ? 1 : -1) + n) % n); }
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') this.adjust(f, e.code === 'ArrowRight' ? 1 : -1);
      else if (e.code === 'Enter' && this.setRows[f].toggle) this.adjust(f, 1);
      return;
    }
    if (this.menu && !this.leaving) this.menu.key(e);
  }

  update(t, dt) {
    for (const m of this.motes) {
      m.y -= dt * m.getData('v') / 1000;
      m.x += Math.sin(t / 1400 + m.getData('ph')) * .05;
      if (m.y < -2) { m.y = 362; m.x = Math.random() * 640; }
    }
    this.fogs[0].tilePositionX += dt * .006;
    this.fogs[1].tilePositionX -= dt * .003;
  }
}
