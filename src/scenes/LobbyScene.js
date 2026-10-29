// 포켓몬 도감 로비 — 할로우 나이트 메뉴처럼 탭 3개로 나눈다 (Q / E 로 이동)
//  [파티 편성]  초상화를 한 줄로 늘어놓고, 고른 포켓몬은 받침대 위를 걷고 옆에 타입·짧은 설명만. 아래에 파티 3자리 + 던전 입장
//  [스킬]       같은 초상화 줄에서 고른 포켓몬의 Z·X·C·교체 스킬·메가진화를 자세히
//  [정화 진행도] 포켓몬별 정화 횟수와 도감 등록 상태
//  배경: 심연 속 무한다이노 실루엣 · 빛기둥 · 안개 · 떠다니는 빛가루
import Phaser from 'phaser';
import { DEX_ORDER, SPECIES, SKILLS, TAGS, ZMOVES, UNLOCK_KILLS, STARTERS } from '../data/pokemon.js';
import { Save } from '../systems/Save.js';
import { Sfx } from '../systems/Audio.js';
import { HK, hkText, hiImage, fadeLine, glassPanel, glassButton, bar3d, typePill } from '../systems/ui.js';
import { roundPortrait } from '../systems/Textures.js';
import { RES, uiCamera } from '../config.js';

const ADD = Phaser.BlendModes.ADD;
const TABS = [{ id: 'party', label: '파티 편성' }, { id: 'skills', label: '스킬' }, { id: 'purify', label: '정화 진행도' }];
const TAB_X = [222, 320, 418], TAB_Y = 74;
const ROW_Y = 126, ROW_DX = 62;                      // 초상화 줄
const rowX = i => 320 + (i - (DEX_ORDER.length - 1) / 2) * ROW_DX;

export default class LobbyScene extends Phaser.Scene {
  constructor() { super('Lobby'); }

  create(data) {
    uiCamera(this);
    this.meta = this.registry.get('spriteMeta');
    this.party = Save.data.party.filter(k => Save.isUnlocked(k)).slice(0, 3);
    this.focus = DEX_ORDER.indexOf(this.party[0] || 'charmander');
    this.tab = 'party';
    this.message = (data && data.message) || '';
    const cam = this.cameras.main;
    cam.setBackgroundColor('#06050b');
    if (this.renderer.type === Phaser.WEBGL) cam.postFX.addVignette(.5, .5, .95, .32);
    this.drawBackdrop();
    this.drawHeader();
    this.buildTabs();
    this.buildRow();
    this.page = this.add.container(0, 0).setDepth(5);
    this.refresh();

    // 키보드: Q/E·Tab 탭 이동, ←→ 포켓몬 선택, Enter 편성, Space 던전 입장, F1 디버그 전체 해금
    this.input.keyboard.on('keydown', e => {
      Sfx.unlock();
      const ti = TABS.findIndex(t => t.id === this.tab);
      if (e.code === 'F1') this.debugUnlockAll();
      else if (e.code === 'KeyQ') this.setTab(TABS[(ti + TABS.length - 1) % TABS.length].id);
      else if (e.code === 'KeyE' || e.code === 'Tab') this.setTab(TABS[(ti + 1) % TABS.length].id);
      else if (e.code === 'ArrowLeft' && this.tab !== 'purify') this.setFocus((this.focus + DEX_ORDER.length - 1) % DEX_ORDER.length);
      else if (e.code === 'ArrowRight' && this.tab !== 'purify') this.setFocus((this.focus + 1) % DEX_ORDER.length);
      else if (e.code === 'Enter' && this.tab === 'party') this.toggle(DEX_ORDER[this.focus]);
      else if (e.code === 'Space') this.enter();
    });
    this.input.keyboard.addCapture('TAB,F1');
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
    hkText(this, 14, 10, `도감 ${Save.data.unlocked.length} / ${DEX_ORDER.length}`, 9, HK.dim, { ls: 1 });
    hkText(this, 626, 10, `도전 ${Save.data.runs}  ·  클리어 ${Save.data.wins}`, 9, HK.dim, { ls: 1, origin: [1, 0] });
    // 저작권 고지 (모든 탭 맨 아래)
    hkText(this, 320, 353, '본 게임은 비영리 팬 게임이며, 포켓몬스터의 모든 저작권은 닌텐도와 크리쳐스, 게임프리크에 있습니다', 7.5, HK.dim, { ls: .5, origin: .5 }).setDepth(20).setAlpha(.85);
  }

  buildTabs() {
    this.tabLine = fadeLine(this, 0, TAB_Y + 12, 90, .9);
    this.tabGlow = this.add.image(0, TAB_Y, 'glow').setBlendMode(ADD).setTint(0xefeae0).setAlpha(.12);
    this.tabTexts = TABS.map((t, i) => {
      const label = hkText(this, TAB_X[i], TAB_Y, t.label, 11, HK.dim, { ls: 2, bold: true, origin: .5 });
      this.add.zone(TAB_X[i], TAB_Y, label.width + 24, 22).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setTab(t.id));
      return label;
    });
    hkText(this, TAB_X[0] - 62, TAB_Y, 'Q', 9, HK.faint, { origin: .5 });
    hkText(this, TAB_X[2] + 74, TAB_Y, 'E', 9, HK.faint, { origin: .5 });
  }

  drawTabs() {
    const i = TABS.findIndex(t => t.id === this.tab), t = this.tabTexts[i];
    this.tabTexts.forEach((x, k) => x.setColor(k === i ? HK.ivory : HK.dim));
    this.tabLine.setPosition(t.x, TAB_Y + 12).setDisplaySize(t.width + 40, 6);
    this.tabGlow.setPosition(t.x, TAB_Y).setDisplaySize(t.width + 60, 30);
  }

  // ---------------- 초상화 줄 (파티 편성·스킬 탭 공용) ----------------
  buildRow() {
    this.rowGlow = this.add.image(0, ROW_Y, 'glow').setBlendMode(ADD).setTint(0xefeae0).setScale(1.1).setAlpha(.2);
    this.tweens.add({ targets: this.rowGlow, alpha: { from: .12, to: .28 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.row = DEX_ORDER.map((key, i) => {
      const x = rowX(i);
      const img = this.add.image(x, ROW_Y, roundPortrait(this, key));
      const gloss = hiImage(this, x, ROW_Y, 'gloss');
      const ring = hiImage(this, x, ROW_Y, 'slot3d');
      const q = hkText(this, x, ROW_Y, '?', 16, '#55506e', { bold: true, origin: .5 });
      const badge = hkText(this, x + 17, ROW_Y - 19, '', 10, HK.gold, { bold: true, origin: .5 });
      const zone = this.add.zone(x, ROW_Y, 52, 52).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.tab === 'purify') return;
        if (i === this.focus && this.tab === 'party') this.toggle(key);   // 고른 포켓몬을 한 번 더 누르면 편성/해제
        else this.setFocus(i);
      });
      return { key, x, img, gloss, ring, q, badge, zone };
    });
  }

  drawRow() {
    const show = this.tab !== 'purify';
    this.rowGlow.setVisible(show);
    this.row.forEach((c, i) => {
      for (const o of [c.img, c.gloss, c.ring, c.q, c.badge]) o.setVisible(show);
      c.zone.input.enabled = show;
      if (!show) return;
      const unlocked = Save.isUnlocked(c.key), inParty = this.party.indexOf(c.key), focused = i === this.focus, s = focused ? 1.12 : 1;
      if (unlocked) c.img.clearTint().setAlpha(focused ? 1 : .8); else c.img.setTintFill(0x0c0a16).setAlpha(.95);
      c.img.setScale(s); c.gloss.setScale(s / RES); c.ring.setScale(s / RES);
      c.ring.setTexture(inParty >= 0 ? 'slot3d-gold' : 'slot3d').setAlpha(focused || inParty >= 0 ? 1 : .6);
      c.q.setVisible(!unlocked);
      c.badge.setText(inParty >= 0 ? String(inParty + 1) : '');
      if (focused) this.rowGlow.setPosition(c.x, ROW_Y);
    });
  }

  // ---------------- 탭별 내용 ----------------
  buildPage() {
    const L = this.page; L.removeAll(true);
    this.enterBtn = null;
    if (this.tab === 'party') this.buildParty(L);
    else if (this.tab === 'skills') this.buildSkills(L);
    else this.buildPurify(L);
  }

  // [파티 편성] 받침대 위의 포켓몬 + 타입·짧은 설명 + 파티 3자리 + 던전 입장
  buildParty(L) {
    const key = DEX_ORDER[this.focus], sp = SPECIES[key], unlocked = Save.isUnlocked(key), inParty = this.party.includes(key);
    const SX = 196, SY = 278;
    L.add(this.add.image(SX, SY, 'glow').setScale(2, .45).setTint(0x9a7aff).setAlpha(.5).setBlendMode(ADD));
    L.add(fadeLine(this, SX, SY + 3, 170, .6));
    const m = this.meta[key];
    if (m && m.hasSprite) {
      const s = this.add.sprite(SX, SY, `sheet:${key}:${m.anims.Walk.src}`).setScale(3).setOrigin(.5, m.anims.Walk.oy);
      s.play(`${key}:Walk:right`);
      if (!unlocked) s.setTintFill(0x0c0a16);
      L.add(s);
    }
    // 설명 칸 (유리 패널)
    const PX = 330, PY = 170, PW = 270, PH = 112, g = this.add.graphics(); L.add(g);
    glassPanel(g, PX, PY, PW, PH);
    L.add(hkText(this, PX + 14, PY + 10, sp.name, 17, unlocked ? HK.ivory : HK.dim, { bold: true, ls: 2 }));
    L.add(hkText(this, PX + PW - 14, PY + 15, `No.${String(sp.dex).padStart(3, '0')}`, 9, HK.dim, { title: true, origin: [1, 0] }));
    let x = PX + 14;
    for (const t of sp.types) x += typePill(this, L, x, PY + 38, t, 9) + 5;
    L.add(hkText(this, PX + 14, PY + 60, unlocked ? sp.desc : `아직 정화하지 못한 포켓몬이에요. (정화 ${Save.kills(key)} / ${UNLOCK_KILLS})`, 10, unlocked ? HK.ivory : HK.dim,
      { style: { wordWrap: { width: PW - 28, useAdvancedWrap: true }, lineSpacing: 3 } }));
    glassButton(this, PX + PW - 128, PY + PH - 30, 116, 22, !unlocked ? '미등록' : inParty ? '파티에서 빼기' : '파티에 넣기', () => this.toggle(key), { size: 10, layer: L })
      .setEnabled(unlocked);
    // 아래: 파티 3자리 + 안내 + 던전 입장
    L.add(fadeLine(this, 320, 300, 600, .35));
    L.add(hkText(this, 44, 322, '파티', 11, HK.dim, { bold: true, ls: 3, origin: [.5, .5] }));
    [0, 1, 2].forEach(i => {
      const k = this.party[i], sx = 92 + i * 42, sy = 324;
      if (k) L.add(this.add.image(sx, sy, roundPortrait(this, k)).setScale(.7));
      L.add(hiImage(this, sx, sy, 'gloss').setScale(.7 / RES));
      L.add(hiImage(this, sx, sy, k ? 'slot3d-gold' : 'slot3d').setScale(.7 / RES).setAlpha(k ? 1 : .4));
      L.add(hkText(this, sx - 12, sy - 14, String(i + 1), 8, k ? HK.gold : HK.faint, { bold: true, origin: .5 }));
      const z = this.add.zone(sx, sy, 34, 34).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { if (this.party[i]) { this.party.splice(i, 1); Sfx.play('select'); this.message = ''; this.refresh(); } });
      L.add(z);
    });
    L.add(hkText(this, 330, 322, this.message || '초상화를 눌러 고르고, 한 번 더 누르면 편성\n← → 선택 · Enter 편성 · Space 입장 · Q / E 탭',
      9, this.message ? HK.gold : HK.dim, { origin: .5, style: { align: 'center', lineSpacing: 3, wordWrap: { width: 230, useAdvancedWrap: true } } }));
    this.enterBtn = glassButton(this, 470, 306, 138, 32, '던전 입장', () => this.enter(), { size: 13, bold: true, ls: 4, primary: true, layer: L });
    this.enterBtn.setEnabled(this.party.length > 0);
  }

  // [스킬] Z·X·C 카드 3장 + 교체 스킬·메가진화 카드
  buildSkills(L) {
    const key = DEX_ORDER[this.focus], sp = SPECIES[key], unlocked = Save.isUnlocked(key);
    L.add(hkText(this, 320, 158, `${sp.name}${unlocked ? '' : '  (미등록)'}`, 11, unlocked ? HK.ivory : HK.dim, { bold: true, ls: 2, origin: .5 }));
    const g = this.add.graphics(); L.add(g);
    ['z', 'x', 'c'].forEach((slot, i) => {
      const id = sp.skills[slot], sk = SKILLS[id], x = 42 + i * 188, y = 172, w = 180, h = 120;
      glassPanel(g, x, y, w, h);
      L.add(hiImage(this, x + 20, y + 20, 'orb3d').setScale(.72 / RES));
      L.add(this.add.image(x + 20, y + 20, `sk:${id}`).setDisplaySize(20, 20));
      L.add(hiImage(this, x + 20, y + 20, 'gloss').setScale(.53 / RES));
      L.add(hkText(this, x + 38, y + 7, slot.toUpperCase(), 9, HK.gold, { bold: true, title: true }));
      L.add(hkText(this, x + 38, y + 18, sk.name, 11, HK.ivory, { bold: true }));
      L.add(hkText(this, x + w - 10, y + 8, sk.cd ? `재사용 ${sk.cd}초` : '기본 공격', 8, HK.dim, { origin: [1, 0] }));
      const d = hkText(this, x + 10, y + 42, sk.desc, 9.5, HK.ivory, { style: { wordWrap: { width: w - 20, useAdvancedWrap: true }, lineSpacing: 2 } });
      L.add(d);
      if (sk.mega) L.add(hkText(this, x + 10, Math.max(y + 82, d.y + d.height + 6), `메가  ${sk.mega}`, 9, '#f0b8ff', { style: { wordWrap: { width: w - 20, useAdvancedWrap: true } } }));
    });
    // 아래 카드 3장: 교체 스킬 · Z기술(Q) · 진화 단계
    const tg = TAGS[sp.tag], zm = ZMOVES[sp.zmove];
    const line = [...new Set(sp.evo.map(f => f.name))].join(' → ') + ` → ${sp.mega.name}`;
    [[42, '교체 스킬', tg.name, tg.desc, '#8ad8ff'],
     [230, 'Z기술 · Q', zm.name, `스테이지 2 보스의 Z크리스탈. ${zm.desc}`, '#ffe08a'],
     [418, '진화', line, '정화할수록 진화 · 몸집·공격력·기술 ↑\n3단 + 메가스톤 → V 로 영구 메가', '#f0b8ff']].forEach(([x, label, name, desc, col]) => {
      const y = 296, w = 180, h = 56;
      glassPanel(g, x, y, w, h);
      L.add(hkText(this, x + 10, y + 6, label, 8, col, { bold: true, ls: 2 }));
      // 이름은 한 줄로: 길면(피츄 → 피카츄 → 라이츄 → 메가 오라 라이츄) 카드 폭에 맞춰 줄인다
      const nm = hkText(this, x + 10, y + 17, name, name.length > 16 ? 8.5 : 10.5, HK.ivory, { bold: true });
      if (nm.width > w - 20) nm.setScale((w - 20) / nm.width * nm.scaleX);
      L.add(nm);
      L.add(hkText(this, x + 10, y + 32, desc, 8, HK.dim, { style: { wordWrap: { width: w - 20, useAdvancedWrap: true }, lineSpacing: 1 } }));
    });
  }

  // [정화 진행도] 포켓몬별 카드 (초상화 · 이름 · 정화 횟수 · 입체 막대)
  buildPurify(L) {
    L.add(hkText(this, 320, 100, `무한다이노에게 세뇌된 포켓몬을 같은 진화 계열로 ${UNLOCK_KILLS}번 정화하면 도감에 등록돼요 (피츄·피카츄·라이츄 모두 피츄 계열)`, 10, HK.dim, { origin: .5 }));
    const g = this.add.graphics(); L.add(g);
    DEX_ORDER.forEach((key, i) => {
      const x = 52 + (i % 2) * 274, y = 116 + Math.floor(i / 2) * 56, w = 262, h = 50;
      const unlocked = Save.isUnlocked(key), n = Save.kills(key), starter = STARTERS.includes(key);
      glassPanel(g, x, y, w, h, { border: unlocked ? HK.goldN : HK.ivoryN, borderAlpha: unlocked ? .35 : .2 });
      L.add(this.add.image(x + 28, y + 25, roundPortrait(this, key)).setScale(.8).setTint(unlocked ? 0xffffff : 0x8a86a0));
      L.add(hiImage(this, x + 28, y + 25, 'gloss').setScale(.8 / RES));
      L.add(hiImage(this, x + 28, y + 25, unlocked ? 'slot3d-gold' : 'slot3d').setScale(.8 / RES));
      L.add(hkText(this, x + 56, y + 8, SPECIES[key].name, 12, unlocked ? HK.ivory : HK.dim, { bold: true }));
      L.add(hkText(this, x + w - 12, y + 10, unlocked ? (starter ? '처음부터 함께' : '도감 등록 완료') : `정화 ${n} / ${UNLOCK_KILLS}`, 9, unlocked ? HK.gold : HK.ivory, { origin: [1, 0] }));
      bar3d(g, x + 56, y + 32, w - 70, 5, unlocked ? 1 : n / UNLOCK_KILLS, unlocked ? HK.goldN : 0xa070ff);
    });
  }

  // ---------------- 상태 바꾸기 ----------------
  setTab(id) {
    if (id === this.tab) return;
    this.tab = id; this.message = ''; Sfx.play('select');
    this.refresh();
  }

  setFocus(i) {
    if (i === this.focus) return;
    this.focus = i; Sfx.play('select'); this.message = '';
    this.refresh();
  }

  toggle(key) {
    if (!Save.isUnlocked(key)) { this.message = `${SPECIES[key].name}은(는) 아직 도감에 등록되지 않았어요`; Sfx.play('deny'); this.refresh(); return; }
    const idx = this.party.indexOf(key);
    if (idx >= 0) this.party.splice(idx, 1);
    else if (this.party.length >= 3) { this.message = '파티는 최대 3마리예요. 아래 파티 칸을 눌러 빼 주세요'; Sfx.play('deny'); this.refresh(); return; }
    else this.party.push(key);
    Sfx.play('select'); this.message = '';
    this.refresh();
  }

  // 디버그: 모든 포켓몬 정화 수 해금 → 머리글의 도감 수까지 새로 그리도록 씬을 다시 연다
  debugUnlockAll() {
    Save.debugUnlockAll();
    Sfx.play('unlock');
    this.scene.restart({ message: '[디버그] 모든 포켓몬을 도감에 등록했어요' });
  }

  refresh() {
    this.drawTabs();
    this.drawRow();
    this.buildPage();
  }

  enter() {
    if (!this.party.length) { Sfx.play('deny'); if (this.tab !== 'party') this.setTab('party'); return; }
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

export { STARTERS };
