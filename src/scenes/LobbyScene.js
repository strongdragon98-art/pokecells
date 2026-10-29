// 포켓몬 도감 로비 — 탭형 보관함(systems/RosterPanel.js)에서 최대 3마리를 골라 던전에 들어간다
//  위: [🌱 1~9세대 스타팅 (세대 필터) | ⭐ 특수 포켓몬 | 👑 정화한 전설/보스]   왼쪽: 카드 격자   오른쪽: 진화 트리·배지·타입·스킬
//  아래: 파티 3자리 + 던전 입장.  F1 · F3 디버그: 모든 스타팅 & 보스 캐릭터 전체 즉시 해금
//  배경: 심연 속 무한다이노 실루엣 · 빛기둥 · 안개 · 떠다니는 빛가루
import Phaser from 'phaser';
import { DEX_ORDER, SPECIES } from '../data/pokemon.js';
import { Save } from '../systems/Save.js';
import { Sfx } from '../systems/Audio.js';
import { HK, hkText, hiImage, fadeLine, glassButton } from '../systems/ui.js';
import { roundPortrait } from '../systems/Textures.js';
import { RosterPanel } from '../systems/RosterPanel.js';
import { RES, uiCamera } from '../config.js';

const ADD = Phaser.BlendModes.ADD;

export default class LobbyScene extends Phaser.Scene {
  constructor() { super('Lobby'); }

  create(data) {
    uiCamera(this);
    this.meta = this.registry.get('spriteMeta');
    this.party = Save.data.party.filter(k => Save.isUnlocked(k)).slice(0, 3);
    this.message = (data && data.message) || '';
    const cam = this.cameras.main;
    cam.setBackgroundColor('#06050b');
    if (this.renderer.type === Phaser.WEBGL) cam.postFX.addVignette(.5, .5, .95, .32);
    this.drawBackdrop();
    this.drawHeader();
    this.panel = new RosterPanel(this, {
      x: 16, y: 66, h: 230, infoX: 392, infoW: 234, focus: (data && data.focus) || this.party[0] || 'charmander', tab: data && data.tab,
      picked: k => this.party.indexOf(k), onToggle: k => this.toggle(k), onFocus: () => { this.message = ''; this.buildBar(); }
    });
    this.panel.L.setDepth(5);
    this.bar = this.add.container(0, 0).setDepth(5);
    this.buildBar();

    // 키보드: 보관함(←→↑↓ · Q/E · 0~9 · Enter) · Space 던전 입장 · F1/F3 디버그 전체 해금
    this.input.keyboard.on('keydown', e => {
      Sfx.unlock();
      if (e.code === 'F1' || e.code === 'F3') this.debugUnlockAll();
      else if (e.code === 'Space') this.enter();
      else this.panel.key(e);
    });
    this.input.keyboard.addCapture('TAB,F1,F3');
    this.input.on('pointerdown', () => Sfx.unlock());
  }

  // ---------------- 배경 일러스트 ----------------
  // 심연 속 무한다이노 실루엣(붉은 핵이 희미하게 맥동) + 위에서 내려오는 빛기둥 + 바닥 안개 + 빛가루
  drawBackdrop() {
    const m = this.meta.eternatus;
    if (m && m.hasSprite) {
      const a = m.anims.Idle;
      const s = this.add.sprite(320, 380, `sheet:eternatus:${a.src}`).setOrigin(.5, a.oy).setScale(6).setTintFill(0x170c26).setAlpha(.6);
      if (this.anims.exists('eternatus:Idle:left')) s.play('eternatus:Idle:left');
      const core = this.add.image(320, 210, 'glow').setTint(0x9a1236).setBlendMode(ADD).setScale(2.6, 1.9).setAlpha(.12);
      this.tweens.add({ targets: core, alpha: { from: .07, to: .18 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    [[140, -.32, .09], [330, -.22, .06], [510, -.38, .08]].forEach(([x, rot, al], i) => {
      const r = this.add.image(x, -10, 'ray').setOrigin(.5, 0).setRotation(rot).setScale(2.6, 1.6).setTint(0xcfc4ff).setBlendMode(ADD).setAlpha(al);
      this.tweens.add({ targets: r, alpha: { from: al * .5, to: al * 1.3 }, duration: 3000 + i * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.fogs = [
      this.add.tileSprite(0, 276, 640, 64, 'fog').setOrigin(0).setScale(1, 1.4).setTint(0x7a6aaa).setAlpha(.5),
      this.add.tileSprite(0, -10, 640, 64, 'fog').setOrigin(0).setTint(0x4a3a7a).setAlpha(.28)
    ];
    this.motes = [];
    for (let i = 0; i < 46; i++) {
      const big = Math.random() < .2;
      this.motes.push(this.add.circle(Math.random() * 640, Math.random() * 360, big ? 1 : .6, Math.random() < .3 ? 0xcfb8ff : 0xefeae0, .25 + Math.random() * .6)
        .setData('v', 4 + Math.random() * 10).setData('ph', Math.random() * 6));
    }
  }

  // ---------------- 머리글 · 탭 ----------------
  // 붉은→금빛 「RED'S BOND」(로마자 제목체) + 「심연 정화 도감」 + 흐려지는 가는 선
  drawHeader() {
    const title = hkText(this, 320, 8, "RED'S BOND", 21, '#ffffff', { title: true, bold: true, ls: 5, origin: [.5, 0], glow: true, glowColor: 'rgba(255,160,110,0.45)' });
    const grad = title.context.createLinearGradient(0, 0, 0, title.height);
    grad.addColorStop(0, '#ffb39a'); grad.addColorStop(.55, '#ff6a5a'); grad.addColorStop(1, '#ffd25a');
    title.setFill(grad);
    hkText(this, 320, 38, '심연 정화 도감', 11, HK.abyss, { bold: true, ls: 6, origin: [.5, 0], glow: true, glowColor: 'rgba(160,112,255,0.6)' });
    fadeLine(this, 320, 58, 440);
    hkText(this, 14, 10, `도감 ${DEX_ORDER.filter(k => Save.isUnlocked(k)).length} / ${DEX_ORDER.length}`, 9, HK.dim, { ls: 1 });
    hkText(this, 626, 10, `도전 ${Save.data.runs}  ·  클리어 ${Save.data.wins}`, 9, HK.dim, { ls: 1, origin: [1, 0] });
  }

  // ---------------- 아래: 파티 3자리 + 안내 + 던전 입장 ----------------
  buildBar() {
    const L = this.bar; L.removeAll(true);
    L.add(fadeLine(this, 320, 304, 600, .35));
    L.add(hkText(this, 40, 326, '파티', 11, HK.dim, { bold: true, ls: 3, origin: [.5, .5] }));
    [0, 1, 2].forEach(i => {
      const k = this.party[i], sx = 86 + i * 42, sy = 326;
      if (k) L.add(this.add.image(sx, sy, roundPortrait(this, SPECIES[k].evo[0].key)).setScale(.7));
      L.add(hiImage(this, sx, sy, 'gloss').setScale(.7 / RES));
      L.add(hiImage(this, sx, sy, k ? 'slot3d-gold' : 'slot3d').setScale(.7 / RES).setAlpha(k ? 1 : .4));
      L.add(hkText(this, sx - 12, sy - 14, String(i + 1), 8, k ? HK.gold : HK.faint, { bold: true, origin: .5 }));
      const z = this.add.zone(sx, sy, 34, 34).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { if (this.party[i]) { this.party.splice(i, 1); Sfx.play('select'); this.message = ''; this.refreshAll(); } });
      L.add(z);
    });
    L.add(hkText(this, 330, 326, this.message || '카드를 눌러 보고, 한 번 더 누르면 편성 · 전투 중 Tab 으로 교대\n←→↑↓ 선택 · Enter 편성 · Q/E 탭 · 0~9 세대 · Space 입장',
      8.5, this.message ? HK.gold : HK.dim, { origin: .5, style: { align: 'center', lineSpacing: 3, wordWrap: { width: 250, useAdvancedWrap: true } } }));
    this.enterBtn = glassButton(this, 486, 310, 134, 32, '던전 입장', () => this.enter(), { size: 13, bold: true, ls: 4, primary: true, layer: L });
    this.enterBtn.setEnabled(this.party.length > 0);
  }

  refreshAll() { this.panel.build(); this.buildBar(); }

  toggle(key) {
    const sp = SPECIES[key];
    if (!Save.isUnlocked(key)) { this.message = sp.legend ? `${sp.evo[0].name}은(는) 아직 정화하지 못한 전설이에요` : `${sp.name}은(는) 아직 합류하지 않았어요`; Sfx.play('deny'); this.buildBar(); return; }
    const idx = this.party.indexOf(key);
    if (idx >= 0) this.party.splice(idx, 1);
    else if (this.party.length >= 3) { this.message = '파티는 최대 3마리예요. 아래 파티 칸을 눌러 빼 주세요'; Sfx.play('deny'); this.buildBar(); return; }
    else this.party.push(key);
    Sfx.play('select'); this.message = '';
    this.refreshAll();
  }

  // 디버그 (F1 · F3): 모든 스타팅 & 보스 캐릭터 전체 즉시 해금 → 머리글의 도감 수까지 새로 그리도록 씬을 다시 연다
  debugUnlockAll() {
    Save.debugUnlockAll();
    Sfx.play('unlock');
    this.scene.restart({ message: '[디버그] 🔓 모든 스타팅 & 보스 캐릭터를 해금했어요', focus: this.panel.focus, tab: this.panel.tab });
  }
  enter() {
    if (!this.party.length) { Sfx.play('deny'); this.message = '파티에 한 마리 이상 넣어 주세요'; this.buildBar(); return; }
    Sfx.unlock(); Sfx.play('swap');
    Save.setParty(this.party);
    this.cameras.main.fadeOut(250, 7, 6, 15);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Cutscene', { party: [...this.party] }));   // 인트로 컷신 → 전투
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
