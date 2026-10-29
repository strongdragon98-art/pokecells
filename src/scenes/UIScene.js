// 할로우 나이트풍 HUD — 어둠 위에 상아색 명조 글자와 광택 있는 유리·금속 부품만 띄운다
//  왼쪽 위: 몬스터볼 테두리 유리 그릇(출전 포켓몬 + 차오르는 진화 경험치) · 몬스터볼 HP 가면 · 대기 포켓몬 · 강화 아이템
//  오른쪽 위: 스테이지·방 · 정화 진행도   오른쪽 아래: 스킬 구슬 (+ Z크리스탈을 얻으면 Q 구슬)   아래 가운데: 보스 체력
//  지역/보스 타이틀, 알림, 도감 등록 팝업, 일시정지·결과 화면은 흐려지는 가는 선과 어둠 띠로 꾸민다.
//  창: 지도(M, 다섯 지방 탭) · 가방(I) · 설정(O) · 기술머신 카드 · 아머까오 공중날기 · 디버그(F3, 챕터·보스 셀렉트)
import Phaser from 'phaser';
import { txt, GAME_W, GAME_H, RES, uiCamera } from '../config.js';
import { SKILLS, SPECIES, UNLOCKABLE, UNLOCK_KILLS, TIERS, ZMOVES, Z_CD, TAGS, EVO_EXP, BOSSES } from '../data/pokemon.js';
import { ITEMS, MAX_EQUIP } from '../data/items.js';
import { STAGES, areaLabel } from '../data/stages.js';
import { typeName, typeColor, hex } from '../data/types.js';
import { GRADE, UPGRADES } from '../data/tm.js';
import { HK, hkText, darkBand, hkMenu, hiImage, fadeLine, bar3d, glassPanel, glassButton, typePill } from '../systems/ui.js';
import { MapView, VP } from '../systems/MapView.js';
import { TouchControls } from '../systems/TouchControls.js';
import { tagIcon, roundPortrait, itemArt, hiTex } from '../systems/Textures.js';
import { Save } from '../systems/Save.js';
import { RosterPanel } from '../systems/RosterPanel.js';
import { Sfx } from '../systems/Audio.js';
import { Settings, SETTING_DEFAULTS, DEFAULT_KEYS, KEY_ACTIONS, FIXED_KEYS, keyLabel, keyNameFromEvent } from '../systems/Settings.js';

const ADD = Phaser.BlendModes.ADD;
const V = { x: 36, y: 36, r: 20 };                      // 메가 게이지 그릇 (중심·안쪽 반지름)
const MASK_X = 80, MASK_Y = 23, MASK_GAP = 19, MAX_MASKS = 9;
const BALL = { top: .8, h: 16.4 };                      // 가면 텍스처 안에서 공이 차지하는 세로 범위 (논리 px)
const ORB_X = [544, 580, 616], ORB_Y = 324;   // Z · X · C (대시는 구슬 없이 Shift 로만)
const ZORB_X = 500;                               // Q: Z기술 (Z크리스탈을 얻으면 나타남)
const TOAST_Y = 288;
const AREA_Y = 134;                               // 지역 타이틀 (왼쪽 위 HUD 아래 빈 띠)
const ROOM_NAME = { start: '입구', combat: '전투 구역', treasure: '보물방', village: '시내 · 포켓몬센터', mini: '중간 보스 아레나', boss: '지방 보스 아레나', sanctuary: '숨겨진 성소', tm: '기술머신 비밀방', pocket: '작은 굴' };
const ARENA_TAG = { mini: '중보', boss: '보스', sanctuary: '히든' };

export default class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    uiCamera(this);
    this.gs = this.scene.get('Game');
    this.leaving = false; this.overlayMode = null; this.showItemTip = false; this.menu = null;   // 씬 인스턴스는 재사용되므로 매 판 초기화
    this.g = this.add.graphics();                       // 꼬리 선·체력 고리·막대·알림 띠
    this.gMid = this.add.graphics().setDepth(2);        // 그릇 속 액체·교대 쿨타임
    this.gTop = this.add.graphics().setDepth(2.5);      // 스킬 쿨타임
    this.gOver = this.add.graphics().setDepth(40);
    this.recent = {}; this.maskFill = []; this.maskKey = '';
    // 실시간 FPS (왼쪽 아래 구석, 0.5초마다 갱신 — 글자 텍스처를 매 프레임 다시 굽지 않게)
    this.fpsText = hkText(this, 4, GAME_H - 2, '', 7, HK.faint, { origin: [0, 1] }).setDepth(60).setAlpha(.7);
    this.fpsT = 0;

    // ── 그릇: 출전 포켓몬 초상화 위로 메가 게이지가 차오르고, 유리 덮개와 몬스터볼 테두리가 덮는다
    this.vGlow = this.add.image(V.x, V.y, 'glow').setBlendMode(ADD).setTint(0xff8ad0).setScale(1.5).setAlpha(0);
    this.vPortrait = this.add.image(V.x, V.y, 'px').setDepth(1);
    hiImage(this, V.x, V.y, 'gloss').setDepth(2.6);
    hiImage(this, V.x, V.y, 'vessel3d').setDepth(3);
    // ── 몬스터볼 HP 가면
    this.masks = [];
    for (let i = 0; i < MAX_MASKS; i++) {
      const x = MASK_X + i * MASK_GAP;
      this.masks.push({
        x, empty: hiImage(this, x, MASK_Y, 'ball-empty').setDepth(3),
        full: hiImage(this, x, MASK_Y, 'ball-full').setDepth(4),
        flash: hiImage(this, x, MASK_Y, 'ball-white').setDepth(5).setAlpha(0).setBlendMode(ADD)
      });
    }
    this.tName = hkText(this, MASK_X - 8, 40, '', 11, HK.ivory, { ls: 1, bold: true }).setDepth(3);
    this.tType = hkText(this, 0, 41, '', 10, HK.dim).setDepth(3);
    this.vHint = hkText(this, MASK_X - 8, 55, '', 10, '#ffc4ec', { ls: 1, glow: true, glowColor: 'rgba(255,138,208,0.7)' }).setDepth(3);

    // ── 대기 포켓몬 2마리 (체력 고리 · 교대 쿨타임)
    this.bench = [0, 1].map(i => {
      const x = 20 + i * 32, y = 88;
      return {
        x, y, img: this.add.image(x, y, 'px').setScale(.5).setDepth(1),
        gloss: hiImage(this, x, y, 'gloss').setScale(.5 / RES).setDepth(2.6),
        ring: hiImage(this, x, y, 'mini3d').setDepth(3),
        key: hkText(this, x - 13, y - 16, '', 10, HK.gold, { bold: true, origin: .5 }).setDepth(4)
      };
    });
    this.tSwap = hkText(this, 40, 106, '', 9, HK.dim, { origin: [.5, 0] }).setDepth(3);

    // ── 강화 아이템 (마우스를 올리면 설명)
    this.itemImgs = []; this.itemCnt = [];
    for (let i = 0; i < 16; i++) {
      const x = MASK_X + (i % 10) * 15, y = 76 + Math.floor(i / 10) * 15;
      this.itemImgs.push(this.add.image(x, y, 'px').setVisible(false).setDepth(2));
      this.itemCnt.push(this.add.text(x + 7, y + 1, '', txt(8, '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(1, 0).setDepth(3));
    }
    this.itemZone = this.add.zone(MASK_X - 8, 68, 156, 34).setOrigin(0).setInteractive();
    this.itemZone.on('pointerover', () => { this.showItemTip = true; });
    this.itemZone.on('pointerout', () => { this.showItemTip = false; });
    this.itemZone.on('pointerdown', () => { this.showItemTip = false; this.gs.toggleOverlay('inv'); });   // 아이템 줄을 누르면 가방
    // 가방(I) · 지도(M) 바로가기
    this.hudLinks = [['가방', 14, 'inv', 'bag'], ['지도', 58, 'map', 'map'], ['설정', 102, 'settings', 'settings']].map(([s, x, kind, act]) => {
      const t = hkText(this, x, 118, s, 9, HK.dim, { ls: 1 }).setDepth(3).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor(HK.ivory)); t.on('pointerout', () => t.setColor(HK.dim));
      t.on('pointerdown', () => this.gs.toggleOverlay(kind));
      return { t, s, act };
    });
    this.tTip = this.add.text(MASK_X - 8, 104, '', txt(10, HK.ivory, { backgroundColor: '#0d0c16ee', padding: { x: 7, y: 5 }, lineSpacing: 3 })).setDepth(30);

    // ── 스킬 구슬 Z X C + 대시
    tagIcon(this, 'normal');
    this.orbs = ORB_X.map((x, i) => ({
      x, ring: hiImage(this, x, ORB_Y, 'orb3d').setDepth(1),
      icon: this.add.image(x, ORB_Y, 'px').setScale(2).setDepth(2),
      gloss: hiImage(this, x, ORB_Y, 'gloss').setScale(15 / 20.4 / RES).setDepth(2.7),
      cd: hkText(this, x, ORB_Y, '', 12, '#ffffff', { bold: true, origin: .5 }).setDepth(4),
      key: hkText(this, x, ORB_Y + 19, '', 9, HK.dim, { origin: [.5, 0] }).setDepth(3)
    }));
    this.tSkillName = hkText(this, 562, 302, '', 10, HK.ivory, { ls: 1, origin: [.5, 1] });
    // Q: Z기술 구슬 (금빛 테두리 · Z크리스탈)
    this.zOrb = {
      glow: this.add.image(ZORB_X, ORB_Y, 'glow').setBlendMode(ADD).setTint(0xffe86a).setScale(.9).setAlpha(0),
      ring: hiImage(this, ZORB_X, ORB_Y, 'orb3d').setDepth(1).setTint(0xffe8a0),
      icon: hiImage(this, ZORB_X, ORB_Y, 'zcrystal-hi').setDepth(2),
      gloss: hiImage(this, ZORB_X, ORB_Y, 'gloss').setScale(15 / 20.4 / RES).setDepth(2.7),
      cd: hkText(this, ZORB_X, ORB_Y, '', 12, '#ffffff', { bold: true, origin: .5 }).setDepth(4),
      key: hkText(this, ZORB_X, ORB_Y + 19, 'Q', 9, HK.gold, { origin: [.5, 0] }).setDepth(3)
    };

    // ── 오른쪽 위: 스테이지·방 · 정화 진행도
    this.tStage = hkText(this, 630, 6, '', 12, HK.ivory, { ls: 1, bold: true, origin: [1, 0] });
    this.tRoom = hkText(this, 630, 34, '', 9, HK.dim, { origin: [1, 0] });
    this.tDexTitle = hkText(this, 630, 54, '정화 진행도', 9, HK.dim, { ls: 2, origin: [1, 0] });
    this.tDex = UNLOCKABLE.map(() => hkText(this, 594, 0, '', 9, HK.ivory, { origin: [1, 0] }));

    // ── 보스 체력 (아래 가운데) + 보스 등장 타이틀 (오른쪽)
    this.tBoss = hkText(this, 320, 330, '', 10, HK.ivory, { ls: 3, bold: true, origin: [.5, 1] });
    this.tBossSub = hkText(this, 626, 236, '', 10, HK.dim, { ls: 2, origin: [1, 0] }).setDepth(21).setAlpha(0);
    this.tBossName = hkText(this, 626, 250, '', 26, HK.ivory, { ls: 3, bold: true, origin: [1, 0], glow: true }).setDepth(21).setAlpha(0);
    this.bossLine = fadeLine(this, 540, 288, 200, .8).setDepth(21).setAlpha(0);
    this.bossTitleT = 0;

    // ── 알림 띠 / 지역 타이틀
    this.tToast = hkText(this, 320, TOAST_Y, '', 12, HK.ivory, { origin: .5 }).setDepth(20);
    this.toastIcon = this.add.image(320, TOAST_Y, 'px').setDepth(20).setVisible(false);   // 아이템을 주웠을 때 그 그림
    this.toastLines = [fadeLine(this, 0, TOAST_Y, 40), fadeLine(this, 0, TOAST_Y, 40)].map(l => l.setDepth(20).setAlpha(0));
    this.toastT = 0;
    this.tBannerSub = hkText(this, 320, 90, '', 10, HK.dim, { ls: 4, origin: .5 }).setDepth(21);
    this.tBanner = hkText(this, 320, 118, '', 30, HK.ivory, { ls: 4, bold: true, origin: .5, glow: true }).setDepth(21);
    this.bannerLine = fadeLine(this, 320, 146, 280, .8).setDepth(21).setAlpha(0);
    this.bannerT = 0;
    // 지역 타이틀 (할로우 나이트풍): 위아래 가는 선 + 양끝 마름모 장식 + [ 구역 : 지역 ] + 로마자 지명 — 천천히 떠올랐다 사라진다
    this.areaBox = this.add.container(0, 0).setDepth(21).setAlpha(0);
    this.areaG = this.add.graphics();
    this.tAreaLabel = hkText(this, 320, AREA_Y - 20, '', 9, HK.dim, { ls: 4, origin: .5 });
    this.tArea = hkText(this, 320, AREA_Y, '', 15, HK.ivory, { ls: 2, bold: true, origin: .5, glow: true, glowColor: 'rgba(200,190,255,0.5)' });
    this.tAreaEn = hkText(this, 320, AREA_Y + 22, '', 9, HK.dim, { title: true, ls: 3, origin: .5 });
    this.areaBox.add([this.areaG, fadeLine(this, 320, AREA_Y - 12, 360, .7), fadeLine(this, 320, AREA_Y + 12, 420, .8), this.tAreaLabel, this.tArea, this.tAreaEn]);
    // 로어 표지판 글 (아래 가운데 어둠 띠)
    this.loreBox = this.add.container(0, 0).setDepth(22).setAlpha(0);
    this.loreG = this.add.graphics();
    darkBand(this.loreG, 70, 228, 500, 46, .85);
    this.tLore = hkText(this, 320, 251, '', 11, '#d8d0e8', { origin: .5, style: { align: 'center', wordWrap: { width: 440, useAdvancedWrap: true }, lineSpacing: 3 } });
    this.loreBox.add([this.loreG, fadeLine(this, 320, 230, 380, .5), fadeLine(this, 320, 272, 300, .35), this.tLore]);

    // ── 도감 등록 팝업 (같은 포켓몬을 10번 정화했을 때)
    this.unlockBox = this.add.container(0, 0).setDepth(22).setVisible(false);
    this.unlockG = this.add.graphics();
    this.unlockGlow = this.add.image(320, 146, 'glow').setTint(0xffd25a).setBlendMode(ADD).setScale(1.5).setAlpha(.55);
    this.unlockImg = this.add.image(320, 146, 'px');
    this.unlockText = hkText(this, 320, 188, '', 15, '#fff2c8', { bold: true, origin: .5, glow: true, glowColor: 'rgba(255,216,144,0.7)' });   // 자간을 주면 글자 단위로 끊어 그려 이모지(🎉)가 깨진다
    this.unlockSub = hkText(this, 320, 208, '', 10, HK.dim, { origin: .5 });
    this.unlockSparks = [0, 1, 2, 3].map(() => this.add.image(0, 0, 'sparkle').setBlendMode(ADD).setScale(0));
    this.unlockBox.add([this.unlockG, fadeLine(this, 320, 102, 380), this.unlockGlow, this.unlockImg, hiImage(this, 320, 146, 'gloss'),
      hiImage(this, 320, 146, 'slot3d-gold'), this.unlockText, this.unlockSub, fadeLine(this, 320, 226, 380), ...this.unlockSparks]);

    // ── 오버레이 (일시정지 / 결과)
    this.overlay = this.add.container(0, 0).setDepth(60).setVisible(false);

    // 게임 씬 이벤트 구독 (씬 종료 시 해제)
    const ge = this.gs.events;
    this.handlers = {
      toast: (s, id) => this.toast(s, id),
      banner: (a, b) => this.banner(a, b),
      area: a => this.areaTitle(a),
      overlay: kind => kind === 'map' ? this.showMap() : kind === 'inv' ? (this.invMember = null, this.showInv()) :   // 가방은 열 때마다 출전 중인 포켓몬부터
         kind === 'tm' ? (this.tmSlot = false, this.showTM())
        : kind === 'taxi' ? this.showTaxi() : kind === 'debug' ? this.showDebug() : kind === 'settings' ? this.showSettings(0) : kind === 'box' ? this.showBox() : this.clearOverlay(),
      lore: s => this.showLore(s),
      say: (who, s) => this.showLore(s, who),   // 트레이너 대사 (난천 · 레드)
      boss: b => { if (b) this.bossTitle(b); },
      unlock: (k, kind) => this.onUnlock(k, kind),
      killcount: (k, n) => { this.recent[k] = this.time.now; this.toast(`${SPECIES[k].name} 정화 진행도: ${n} / ${UNLOCK_KILLS}`); },
      pause: on => this.showPause(on),
      saved: r => this.onSaved(r),
      gameover: r => this.showResult(r)
    };
    for (const [k, fn] of Object.entries(this.handlers)) ge.on(k, fn, this);
    this.events.once('shutdown', () => { for (const [k, fn] of Object.entries(this.handlers)) ge.off(k, fn, this); });
    this.touch = new TouchControls(this, this.gs);
    this.applyTouchLayout();
    this.refreshKeyLabels();
    const offKeys = Settings.on(k => { if (k === 'keys') this.refreshKeyLabels(); });
    this.events.once('shutdown', offKeys);
    const kl = a => keyLabel(Settings.key(a));
    this.time.delayedCall(5200, () => this.toast(this.touch.visible
      ? '왼쪽 아래를 끌어 이동 · 오른쪽 버튼으로 점프·스킬·대시·교대 · 금빛으로 빛나는 조사 버튼으로 센터·표지판'
      : `${kl('left')}${kl('right')} 이동 · ${kl('jump')} 점프 · ${kl('z')}/${kl('x')}/${kl('c')} 스킬 · ${kl('dash')} 대시 · ${kl('swap')}/${kl('swap2')}/1~3 교대 · ${kl('settings')} 설정에서 키 변경`));
  }

  // HUD 의 키 글자(스킬 구슬 아래 · Z기술 · 가방/지도/설정 바로가기)를 지금 조작키로
  refreshKeyLabels() {
    const kl = a => keyLabel(Settings.key(a));
    this.orbs.forEach((o, i) => o.key.setText(kl(['z', 'x', 'c'][i])));
    this.zOrb.key.setText(kl('zmove'));
    for (const h of this.hudLinks) h.t.setText(this.touchLayout ? h.s : `${h.s}  ${kl(h.act)}`);   // 터치패드일 때는 PC 키 글자를 뺀다
  }

  // 터치 기기: 오른쪽 아래 스킬 구슬은 터치 버튼이 대신하므로 숨기고, 알림은 아래 가운데(조이스틱과 버튼 사이)에 두 줄까지 접어서 띄운다
  applyTouchLayout() {
    const on = this.touch.visible;
    this.touchLayout = on;
    for (const o of this.orbs) for (const v of [o.ring, o.icon, o.gloss, o.cd, o.key]) v.setVisible(!on);
    this.tSkillName.setVisible(!on);
    const y = on ? 302 : TOAST_Y;
    this.tToast.setWordWrapWidth(on ? 280 : null, true).setAlign('center');
    this.tToast.setY(y); this.toastLines.forEach(l => l.setY(y));
    this.refreshKeyLabels();
  }

  // id: 아이템을 주웠을 때 글 왼쪽에 그 아이템 그림을 띄운다
  toast(s, id = null) {
    this.tToast.setText(s); this.toastT = 2.6;
    const k = id && itemArt(this, id, 20);
    this.toastIcon.setVisible(!!k);
    if (k) this.toastIcon.setTexture(k).setScale(1 / RES);
  }
  // 지역 타이틀: 작은 머리글 + 커다란 이름 + 아래 가는 선이 천천히 떠올랐다 사라진다
  banner(a, b) { this.tBanner.setText(a); this.tBannerSub.setText(b || ''); this.bannerT = 2.8; }
  // 지역 타이틀: 0.9초 동안 떠오르고 2.8초 머문 뒤 1.3초에 걸쳐 사라진다
  areaTitle(a) {
    this.tAreaLabel.setText(a.label);
    this.tArea.setText(`[ ${a.region} : ${a.name} ]`);
    this.tAreaEn.setText(a.en || '');
    const g = this.areaG, w = Math.max(220, this.tArea.width + 60);
    g.clear();
    for (const sx of [-1, 1]) {   // 양끝 마름모 장식 + 짧은 갈고리선
      const x = 320 + sx * w / 2, y = AREA_Y;
      g.fillStyle(HK.ivoryN, .85); g.fillPoints([{ x, y: y - 4 }, { x: x + 4, y }, { x, y: y + 4 }, { x: x - 4, y }], true);
      g.fillStyle(HK.ivoryN, .5); g.fillPoints([{ x: x - sx * 10, y: y - 2 }, { x: x - sx * 8, y }, { x: x - sx * 10, y: y + 2 }, { x: x - sx * 12, y }], true);
      g.lineStyle(1, HK.ivoryN, .45); g.lineBetween(x + sx * 6, y, x + sx * 26, y);
    }
    this.tweens.killTweensOf(this.areaBox);
    this.areaBox.setAlpha(0).setY(6);
    this.tweens.add({ targets: this.areaBox, alpha: 1, y: 0, duration: 900, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this.areaBox, alpha: 0, duration: 1300, delay: 3700, ease: 'Sine.easeIn' });
  }

  showLore(s, who = null) {
    this.tLore.setText(who ? `${who}  —  “${s}”` : `“${s}”`);
    this.tweens.killTweensOf(this.loreBox);
    this.loreBox.setAlpha(0);
    this.tweens.add({ targets: this.loreBox, alpha: 1, duration: 350 });
    this.tweens.add({ targets: this.loreBox, alpha: 0, duration: 800, delay: 4600 });
  }

  // 보스 등장: 오른쪽에 이름이 크게 떠오른다 (할로우 나이트의 보스 이름 연출)
  bossTitle(boss) {
    const gs = this.gs, room = boss.room;
    this.tBossSub.setText(boss.def && boss.def.title ? `${boss.def.title} · 세뇌됨` : `${room ? room.area : gs.stage.name}의 주인 · 세뇌됨`);
    this.tBossName.setText(boss.def.duo || boss.name);
    this.bossTitleT = 3.6;
  }

  // 도감 등록 팝업: 금빛 테두리 초상화 + 「✨ [이름] 세뇌 완전 정화! 도감 등록 완료!」
  //  합류(kind 'join'): 보스·특수 포켓몬 → 「🎉 [이름]의 영혼이 동료로 합류했습니다!」
  onUnlock(k, kind) {
    const name = SPECIES[k].name;
    this.bannerT = 0;
    this.unlockText.setText(kind === 'join' ? `🎉 [${name}]의 영혼이 동료로 합류했습니다!` : `✨ [${name}] 세뇌 완전 정화! 도감 등록 완료!`);
    this.unlockSub.setText(kind === 'join' ? '이제 플레이어블 캐릭터로 선택할 수 있습니다! (포켓몬센터 보관함 · 도감)' : `${name}을(를) 다음 판부터 파티에 넣을 수 있어요`);
    this.unlockImg.setTexture(roundPortrait(this, SPECIES[k].evo[0].key));
    const g = this.unlockG;
    g.clear(); darkBand(g, 0, 86, GAME_W, 158, .9);
    this.unlockSparks.forEach((s, i) => {
      s.setPosition(320 + (i % 2 ? 1 : -1) * (36 + (i >> 1) * 14), 134 + (i >> 1) * 22).setScale(0).setAngle(0);
      this.tweens.add({ targets: s, scale: 2, angle: 90, yoyo: true, repeat: 3, duration: 260, delay: 120 + i * 110 });
    });
    this.tweens.killTweensOf(this.unlockBox);
    this.unlockBox.setVisible(true).setAlpha(0).setY(8);
    this.tweens.add({ targets: this.unlockBox, alpha: 1, y: 0, duration: 380, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: this.unlockBox, alpha: 0, delay: 3300, duration: 500, onComplete: () => this.unlockBox.setVisible(false) });
    this.recent[k] = this.time.now;
  }

  // 가면이 깨질 때 붉은·흰 조각이 튄다
  breakMask(x, y) {
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 12;
      const r = this.add.rectangle(x, y, 2.5, 2.5, i % 2 ? 0xefeae0 : 0xe8484a).setDepth(6).setAngle(Math.random() * 90);
      this.tweens.add({ targets: r, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + 6, angle: r.angle + 180, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
    }
  }

  update(time, delta) {
    const dt = delta / 1000, gs = this.gs, p = gs.player;
    const g = this.g, gm = this.gMid, gt = this.gTop;
    g.clear(); gm.clear(); gt.clear();
    this.fpsT -= delta;
    if (this.fpsT <= 0) { this.fpsT = 500; this.fpsText.setText(`${Math.round(this.game.loop.actualFps)} FPS`); }
    if (!p) return;
    const m = p.m, mg = p.mega;

    // ===== 그릇: 출전 포켓몬 + 진화 경험치 액체 (3단이면 가득, 메가면 분홍) =====
    const pk = p.portraitKey();
    this.vPortrait.setTexture(roundPortrait(this, pk));
    const level = p.expProgress(), ready = mg.stones > 0 && p.tier >= 2 && !mg.active;
    if (level > 0) {
      // 수면(물결선) 아래 원 안쪽을 다각형으로 채운다
      const R = V.r, top = V.y + R - 2 * R * level, col = mg.active ? 0xff6ac0 : ready ? 0xff8ad0 : [0x7ad0ff, 0xb07aff, 0xffd86a][p.tier];
      const yy = Phaser.Math.Clamp(top, V.y - R + .5, V.y + R - .5), half = Math.sqrt(Math.max(0, R * R - (yy - V.y) ** 2));
      const pts = [];
      for (let x = -half; x <= half; x += 2) pts.push({ x: V.x + x, y: Math.max(V.y - R, yy + Math.sin(time / 170 + x * .35) * 1.3) });
      const nWave = pts.length, a0 = Math.atan2(yy - V.y, half), a1 = Math.PI - a0;
      for (let k = 0; k <= 24; k++) { const a = a0 + (a1 - a0) * k / 24; pts.push({ x: V.x + Math.cos(a) * R, y: V.y + Math.sin(a) * R }); }
      gm.fillStyle(col, .5); gm.fillPoints(pts, true);
      gm.lineStyle(1, 0xffffff, .65); gm.strokePoints(pts.slice(0, nWave), false);
    }
    this.vGlow.setAlpha(ready ? .45 + Math.sin(time / 140) * .2 : mg.active ? .35 : 0);
    this.vHint.setText(ready ? (this.touch.visible ? '메가 버튼으로 메가진화!' : 'V  메가진화') : mg.active ? '메가진화 ★' : p.tier < 2 ? `${TIERS[p.tier].name} · 진화까지 ${p.expToNext()}` : '3단 진화 완료')
      .setAlpha(ready ? .7 + Math.sin(time / 120) * .3 : .85);

    // ===== 몬스터볼 HP 가면 =====
    const N = Phaser.Math.Clamp(Math.round(m.maxhp / 20), 4, MAX_MASKS), per = m.maxhp / N;
    const mkKey = `${m.key}:${N}:${p.tierIdx}`;
    if (mkKey !== this.maskKey) { this.maskKey = mkKey; this.maskFill = []; }   // 교대·메가 땐 깨짐 연출 없이 새로 채운다
    const low = m.hp / m.maxhp <= .25;
    for (let i = 0; i < MAX_MASKS; i++) {
      const mk = this.masks[i], on = i < N;
      mk.empty.setVisible(on);
      if (!on) { mk.full.setVisible(false); mk.flash.setAlpha(0); continue; }
      const f = Phaser.Math.Clamp((m.hp - i * per) / per, 0, 1), prev = this.maskFill[i] ?? f;
      const fw = mk.full.frame.realWidth, fh = mk.full.frame.realHeight;
      const cut = f >= 1 ? 0 : Math.round((BALL.top + (1 - f) * BALL.h) * RES);
      mk.full.setVisible(f > 0).setCrop(0, cut, fw, fh - cut);
      if (f < prev - .001) { mk.flash.setAlpha(.9); if (f <= 0 && prev > 0) this.breakMask(mk.x, MASK_Y); }
      mk.flash.setAlpha(Math.max(0, mk.flash.alpha - dt * 5));
      // 체력이 적으면 마지막 가면이 두근거린다
      const last = f > 0 && (i === N - 1 || (m.hp - (i + 1) * per) <= 0);
      const s = (low && last ? 1 + Math.max(0, Math.sin(time / 110)) * .14 : 1) / RES;
      mk.full.setScale(s); mk.empty.setScale(s);
      this.maskFill[i] = f;
    }
    // 그릇 단추에서 가면 아래로 뻗어 나가 흐려지는 선
    const tailX = V.x + 27, tailEnd = MASK_X + (N - 1) * MASK_GAP + 30;
    g.fillGradientStyle(HK.ivoryN, HK.ivoryN, HK.ivoryN, HK.ivoryN, .18, 0, .18, 0); g.fillRect(tailX, V.y - 1.5, tailEnd - tailX, 3);
    g.fillGradientStyle(HK.ivoryN, HK.ivoryN, HK.ivoryN, HK.ivoryN, .95, 0, .95, 0); g.fillRect(tailX, V.y - .4, tailEnd - tailX, .9);
    this.tName.setText(`${p.name}${mg.active ? ' ★' : ''}`);
    this.tType.setText(`${p.types.map(typeName).join(' · ')}${p.slowT > 0 ? ' · 둔화됨' : ''}`).setX(this.tName.x + this.tName.width + 7);

    // ===== 대기 포켓몬 =====
    const others = p.members.map((mm, i) => ({ mm, i })).filter(o => o.i !== p.idx);
    for (let k = 0; k < 2; k++) {
      const b = this.bench[k], o = others[k];
      for (const v of [b.img, b.ring, b.gloss]) v.setVisible(!!o);
      if (!o) { b.key.setText(''); continue; }
      const alive = o.mm.alive, hk = o.mm.hp / o.mm.maxhp;
      b.img.setTexture(roundPortrait(this, p.portraitKey(o.mm))).setAlpha(alive ? 1 : .35);
      if (alive) b.img.clearTint(); else b.img.setTintFill(0x401020);
      b.key.setText(String(o.i + 1));
      if (alive) {
        g.lineStyle(3.5, 0x000000, .55); g.beginPath(); g.arc(b.x, b.y, 15.5, 0, Math.PI * 2); g.strokePath();
        g.lineStyle(2, hk > .25 ? 0x8ae0a0 : HK.redN, .95); g.beginPath(); g.arc(b.x, b.y, 15.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hk, false); g.strokePath();
      }
      if (p.swapCd > 0 && alive) {
        const ck = Math.min(1, p.swapCd / (3 * p.mods.swapCdMul));
        gm.fillStyle(0x000000, .62); gm.slice(b.x, b.y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ck, false); gm.fillPath();
      }
    }
    this.tSwap.setText(others.length ? (p.swapCd > 0 ? `교대 ${p.swapCd.toFixed(1)}초` : this.touch.visible ? '교대 가능' : 'Tab·E 교대') : '')
      .setColor(p.swapCd > 0 ? HK.faint : HK.dim);

    // ===== 강화 아이템 =====
    const ids = Object.keys(p.items);
    for (let i = 0; i < this.itemImgs.length; i++) {
      const id = ids[i], img = this.itemImgs[i], t = this.itemCnt[i];
      if (!id) { img.setVisible(false); t.setText(''); continue; }
      const k = itemArt(this, id, 13);   // 본가 아이템 그림 (없으면 도트 아이콘)
      img.setVisible(true).setTexture(k || `it:${id}`).setScale(k ? 1 / RES : 1);
      t.setText(p.items[id] > 1 ? String(p.items[id]) : '');
    }
    this.tTip.setText(this.showItemTip && ids.length ? ids.map(id => `${ITEMS[id].name}${p.items[id] > 1 ? ' ×' + p.items[id] : ''}  —  ${ITEMS[id].desc}`).join('\n') : '')
      .setVisible(this.showItemTip && ids.length > 0);

    // ===== 스킬 구슬 =====
    if (this.touch.visible !== this.touchLayout) this.applyTouchLayout();   // 터치 노트북: 첫 터치 때 전환
    const slots = ['z', 'x', 'c'];
    for (let i = 0; i < 3 && !this.touchLayout; i++) {
      const o = this.orbs[i], id = p.skillId(slots[i]);
      const cd = p.m.cd[slots[i]], max = p.cdOf(id) || 1;
      o.icon.setTexture(`sk:${id}`).setDisplaySize(24, 24).setAlpha(cd > 0 ? .4 : 1);   // 아이콘 해상도(SVG 64px / 도트 12px)와 상관없이 같은 크기
      o.ring.setTint(mg.active ? 0xffc4ec : 0xffffff);
      if (cd > 0) { gt.fillStyle(0x000000, .58); gt.slice(o.x, ORB_Y, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cd / max), false); gt.fillPath(); }
      o.cd.setText(cd > 0 ? (cd >= 1 ? cd.toFixed(0) : cd.toFixed(1)) : '');
    }
    // Q: Z기술
    const zo = this.zOrb, zOn = p.z.has && !this.touchLayout;
    for (const v of [zo.ring, zo.icon, zo.gloss, zo.cd, zo.key]) v.setVisible(zOn);
    if (zOn) {
      const zcd = p.z.cd;
      zo.icon.setAlpha(zcd > 0 ? .4 : 1);
      zo.glow.setAlpha(zcd > 0 ? 0 : .35 + Math.sin(time / 160) * .15);
      if (zcd > 0) { gt.fillStyle(0x000000, .58); gt.slice(ZORB_X, ORB_Y, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, zcd / Z_CD), false); gt.fillPath(); }
      zo.cd.setText(zcd > 0 ? zcd.toFixed(0) : '');
    } else zo.glow.setAlpha(0);
    const act = p.action && p.action.slot && p.action.slot !== 'tag' ? SKILLS[p.skillId(p.action.slot)] : null;
    this.tSkillName.setText(act ? act.name : '');

    // ===== 오른쪽 위: 스테이지 · 방 · 정화 진행도 =====
    const st = gs.stage, arenas = gs.level ? gs.level.rooms.filter(r => r.type === 'mini' || r.type === 'boss' || (r.type === 'sanctuary' && (r.entered || r.cleared))) : [];
    const ar = gs.room ? st.areas[gs.room.ai] : st.areas[0];
    this.tStage.setText(`${areaLabel(gs.stageIdx, gs.room ? gs.room.ai : 0, ar)}   ${ar.name}`);
    arenas.forEach((r, i) => {   // 이 지방의 보스 아레나: 정화하면 회색 (지방 보스는 크게 · 찾은 히든은 보라)
      const cur = r === gs.room, big = r.type === 'boss', x = 627 - (arenas.length - 1 - i) * 11;
      const col = r.cleared ? 0x9a96ac : r.type === 'sanctuary' ? 0xd08aff : big ? 0xff6a6a : 0xffb07a, rad = big ? 3.4 : 2.6;
      g.fillStyle(0x000000, .6); g.fillCircle(x, 28.6, rad + .6 + (cur ? .6 : 0));
      g.fillStyle(col, 1); g.fillCircle(x, 28, rad + (cur ? .6 : 0));
      g.fillStyle(0xffffff, .5); g.fillCircle(x - .7, 27.2, rad * .33);
    });
    this.tRoom.setText(gs.room ? (gs.room.under && gs.room.type === 'combat' ? '지하 · 전투 구역' : ROOM_NAME[gs.room.type] || '') : '');
    let row = 0;
    UNLOCKABLE.forEach((k, i) => {
      const t = this.tDex[i];
      if (Save.isUnlocked(k)) { t.setText(''); return; }
      const n = Save.kills(k), hot = this.time.now - (this.recent[k] || -9999) < 1500, y = 70 + row * 13;
      t.setText(`${SPECIES[k].name}  ${n}/${UNLOCK_KILLS}`).setY(y).setColor(hot ? HK.gold : HK.ivory);
      bar3d(g, 600, y + 5, 29, 3, n / UNLOCK_KILLS, hot ? HK.goldN : 0xb490ff);
      row++;
    });
    this.tDexTitle.setText(row ? '정화 진행도' : '도감 완성!');

    // ===== 보스 체력 =====
    const boss = gs.boss, showBoss = !!(boss && boss.alive), duo = gs.bosses && gs.bosses.length > 1 ? gs.bosses : null;
    this.tBoss.setText(showBoss ? (duo ? duo.map(q => q.name).join('     ') : boss.name) : '');
    if (showBoss) {
      if (duo) duo.forEach((q, i) => bar3d(g, 214 + i * 110, 334, 102, 4, q.alive ? q.hp / q.maxhp : 0, q.def.color || 0xa070ff));   // 짝 보스: 두 줄
      else bar3d(g, 214, 334, 212, 4, boss.hp / boss.maxhp, boss.phase === 2 ? 0xff5a9a : 0xa070ff);
    }
    // 화면 밖 보스: 가장자리에 그쪽을 가리키는 표식 (아레나가 화면보다 넓을 때 · 땅속에 숨은 동안은 없음)
    if (showBoss) for (const bq of duo || [boss]) {
      if (!bq.alive || bq.sprite.alpha <= .2) continue;
      const v = gs.cameras.main.worldView, sx = (bq.x - v.x) / v.width * GAME_W, sy = (bq.y - v.y) / v.height * GAME_H;
      if (sx < -6 || sx > GAME_W + 6 || sy < -6 || sy > GAME_H + 6) {
        const cx = Phaser.Math.Clamp(sx, 20, GAME_W - 20), cy = Phaser.Math.Clamp(sy, 48, GAME_H - 60), a = Math.atan2(sy - cy, sx - cx), k = .65 + Math.sin(time / 140) * .3;
        const col = duo ? bq.def.color || 0xa070ff : bq.phase === 2 ? 0xff5a9a : 0xa070ff, tip = (r, da) => ({ x: cx + Math.cos(a + da) * r, y: cy + Math.sin(a + da) * r });
        g.fillStyle(0x000000, .45 * k); g.fillCircle(cx, cy, 11);
        g.lineStyle(1, 0xffffff, .7 * k); g.strokeCircle(cx, cy, 11);
        g.fillStyle(col, k); g.fillPoints([tip(9, 0), tip(7, 2.4), tip(3, Math.PI), tip(7, -2.4)], true);
      }
    }

    // ===== 알림 띠 / 지역·보스 타이틀 =====
    this.toastT -= dt;
    const ta = this.toastT > 0 && this.tToast.text ? Math.min(1, this.toastT * 4, (2.6 - this.toastT) * 6) : 0;
    if (ta > 0) {
      const ic = this.toastIcon.visible ? 24 : 0, cw = this.tToast.width + ic, w = cw + 110;   // 그림이 있으면 그림 + 글을 한 덩어리로 가운데 맞춤
      const th = Math.max(26, this.tToast.height + 10);   // 두 줄로 접히면 띠도 두껍게
      darkBand(g, 320 - w / 2, this.tToast.y - th / 2, w, th, .82 * ta);
      this.tToast.setX(320 + ic / 2); this.toastIcon.setPosition(320 - cw / 2 + 10, this.tToast.y);
      this.toastLines[0].setX(320 - cw / 2 - 26); this.toastLines[1].setX(320 + cw / 2 + 26);
    }
    this.tToast.setAlpha(ta); this.toastIcon.setAlpha(ta); this.toastLines.forEach(l => l.setAlpha(ta * .8));
    this.bannerT -= dt;
    const ba = Phaser.Math.Clamp(Math.min(this.bannerT * 1.4, (2.8 - this.bannerT) * 2.2), 0, 1);
    if (ba > 0) darkBand(g, 110, 74, 420, 86, .55 * ba);
    this.tBanner.setAlpha(ba); this.tBannerSub.setAlpha(ba); this.bannerLine.setAlpha(ba * .85);
    this.bossTitleT -= dt;
    const bt = Phaser.Math.Clamp(Math.min(this.bossTitleT * 1.2, (3.6 - this.bossTitleT) * 1.6), 0, 1);
    this.tBossSub.setAlpha(bt); this.tBossName.setAlpha(bt); this.bossLine.setAlpha(bt * .8);
    this.unlockGlow.setAlpha(.45 + Math.sin(time / 160) * .15);
    this.touch.update();
  }

  // ---------------- 오버레이 ----------------
  clearOverlay() {
    if (this.mapView) { this.mapView.destroy(); this.mapView = null; }
    if (this.offSettings) { this.offSettings(); this.offSettings = null; }
    if (this.keyWait) { this.keyWait = null; if (this.gs) this.gs.keyCapture = false; }
    this.tweens.killTweensOf(this.overlay.list);
    this.overlay.removeAll(true); this.gOver.clear(); this.overlay.setVisible(false); this.menu = null;
    this.overlayMode = null; this.tmBusy = false; this.boxPanel = null;
    this.input.keyboard.off('keydown', this.onOverlayKey, this);
  }

  // ================= 기술머신: 뒷면 카드 3장 → 하나씩 뒤집기 → 1장 확정 (기술 카드는 바꿀 슬롯까지) =================
  //  카드·뒤집힌 상태·고른 카드는 제단(gs.tmActive)에 남아 닫았다 다시 열어도 그대로다. flip: 막 뒤집은 카드 (뒤집기 애니메이션)
  showTM(flip = -1) {
    const gs = this.gs, it = gs.tmActive;
    if (!it) return;
    this.clearOverlay();
    this.toastT = 0;
    const g = this.gOver, L = this.overlay.setVisible(true), p = gs.player, m = it.member;
    const allOpen = it.flipped.every(Boolean), W = 150, H = 200, CY = 170;
    g.fillStyle(0x05040a, .9); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(this.add.image(320, CY, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x4a7aff).setScale(9, 5).setAlpha(.16));
    L.add(hkText(this, 320, 20, it.legend ? '전설의 기술 카드' : '기술머신', 18, it.legend ? HK.gold : HK.ivory, { bold: true, ls: it.legend ? 5 : 8, origin: .5, glow: true }));
    L.add(fadeLine(this, 320, 38, 320, .8));
    L.add(hkText(this, 320, 50, `${p.formName(m)}에게 맞춰진 고대 석판 · ${allOpen ? '마음에 드는 카드 1장을 고르세요' : `카드를 눌러 하나씩 뒤집으세요 (남은 ${it.flipped.filter(f => !f).length}장)`}`, 9.5, HK.dim, { origin: .5 }));
    this.tmTextures(W, H);
    it.cards.forEach((card, i) => {
      const x = 320 + (i - 1) * 172, chosen = it.sel === i, open = it.flipped[i] && i !== flip;
      if (chosen) {   // 고른 카드: 금빛 테두리 빛 + 살짝 떠오름
        L.add(this.add.image(x, CY - 6, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a).setScale(3.4, 4.2).setAlpha(.45));
      }
      const c = this.add.container(x, chosen ? CY - 6 : CY); L.add(c);
      const back = hiImage(this, 0, 0, 'tm-back'); c.add(back);
      const face = this.add.container(0, 0); c.add(face);
      this.tmFace(face, card, m, W, H, chosen);
      back.setVisible(!open); face.setVisible(open);
      if (i === flip) {   // 뒤집기: 가로 1 → 0 (뒷면) → 앞면으로 바꿔 0 → 1, 빛이 번쩍
        this.tmBusy = true;
        const col = GRADE[card.grade] || 0xffffff;
        this.tweens.add({ targets: c, scaleX: 0, duration: 110, ease: 'Quad.easeIn', onComplete: () => {
          back.setVisible(false); face.setVisible(true);
          const flash = this.add.rectangle(0, 0, W, H, 0xffffff, 1); c.add(flash);
          const halo = this.add.image(x, CY, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(1).setAlpha(.9); L.add(halo);
          this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
          this.tweens.add({ targets: halo, scaleX: 4, scaleY: 5, alpha: 0, duration: 420, onComplete: () => halo.destroy() });
          for (let k = 0; k < 10; k++) {   // 반짝이 조각
            const sp = this.add.image(x, CY, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(k % 2 ? col : 0xffffff).setScale(.12).setAlpha(1); L.add(sp);
            const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 50;
            this.tweens.add({ targets: sp, x: x + Math.cos(a) * d, y: CY + Math.sin(a) * d * 1.2, alpha: 0, duration: 500 + Math.random() * 200, ease: 'Cubic.easeOut', onComplete: () => sp.destroy() });
          }
          this.tweens.add({ targets: c, scaleX: 1, duration: 150, ease: 'Back.easeOut', onComplete: () => { this.tmBusy = false; if (it.flipped.every(Boolean)) this.showTM(); } });
          Sfx.play(card.grade === '전설' ? 'unlock' : 'item');
        } });
      }
      // 누르기 영역 (뒤집기 / 고르기)
      const z = this.add.zone(x, CY, W, H).setInteractive({ useHandCursor: true }); L.add(z);
      z.on('pointerdown', () => this.tmPress(i));
      L.add(hkText(this, x, CY + H / 2 + 6, String(i + 1), 9, chosen ? HK.gold : HK.faint, { origin: [.5, 0] }));
    });
    // 아래: 단계별 안내 · 결정 · 슬롯 고르기
    const BY = 300;
    if (this.tmSlot && it.sel >= 0) {
      L.add(hkText(this, 320, BY - 12, '어느 기술 자리에 배울까요?  (Z · X · C)', 10, HK.gold, { origin: .5, bold: true }));
      ['z', 'x', 'c'].forEach((sl, k) => {
        const id = m.skills[sl], name = SKILLS[id].name;
        glassButton(this, 320 + (k - 1) * 156 - 72, BY, 144, 26, `${sl.toUpperCase()}   ${name}`, () => this.tmChooseSlot(sl), { size: 9.5, layer: L, primary: true });
      });
      glassButton(this, 18, BY + 34, 92, 20, '←  다른 카드', () => { this.tmSlot = false; Sfx.play('select'); this.showTM(); }, { size: 8.5, layer: L });
    } else if (it.sel >= 0 && allOpen) {
      const card = it.cards[it.sel];
      glassButton(this, 320 - 90, BY, 180, 28, card.kind === 'move' ? '이 기술 배우기  (Enter)' : '이 카드로 결정  (Enter)', () => this.tmConfirm(), { size: 10.5, layer: L, primary: true });
    } else {
      L.add(hkText(this, 320, BY + 10, allOpen ? '카드를 눌러 고른 뒤 결정하세요  ·  ← → 고르기 · Enter 결정' : '카드를 누르거나 1 · 2 · 3 으로 뒤집기  ·  3장을 다 열어 본 뒤 1장을 고른다', 9, HK.dim, { origin: .5 }));
    }
    L.add(hkText(this, 320, 348, 'Esc 닫기 (고른 내용은 제단에 남는다)', 8, HK.faint, { origin: .5 }));
    glassButton(this, 566, 8, 64, 20, '✕  닫기', () => gs.toggleOverlay('tm'), { size: 9, layer: L });
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'tm';
  }

  // 카드 뒷면 · 등급별 앞면 바탕 (고해상도 캔버스, 한 번만)
  tmTextures(W, H) {
    const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    hiTex(this, 'tm-back', W, H, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1c2848'); gr.addColorStop(1, '#090c18');
      rr(c, .5, .5, w - 1, h - 1, 9); c.fillStyle = gr; c.fill();
      c.strokeStyle = 'rgba(232,212,160,.9)'; c.lineWidth = 1.2; c.stroke();
      rr(c, 6, 6, w - 12, h - 12, 6); c.strokeStyle = 'rgba(232,212,160,.3)'; c.lineWidth = .8; c.stroke();
      // 가운데 문양: 몬스터볼 윤곽 + 바깥 고리의 눈금 (깔끔한 선만)
      const cx = w / 2, cy = h / 2 - 6, R = 34;
      const glow = c.createRadialGradient(cx, cy, 4, cx, cy, R * 1.8); glow.addColorStop(0, 'rgba(110,160,255,.35)'); glow.addColorStop(1, 'rgba(110,160,255,0)');
      c.fillStyle = glow; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(232,212,160,.85)'; c.lineWidth = 1.4;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(cx, cy, R + 8, 0, Math.PI * 2); c.lineWidth = .6; c.stroke();
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, l = k % 2 ? 3 : 6; c.beginPath(); c.moveTo(cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8)); c.lineTo(cx + Math.cos(a) * (R + 8 + l), cy + Math.sin(a) * (R + 8 + l)); c.lineWidth = .8; c.stroke(); }
      c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx - 10, cy); c.moveTo(cx + 10, cy); c.lineTo(cx + R, cy); c.stroke();
      c.beginPath(); c.arc(cx, cy, 10, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(232,212,160,.9)'; c.beginPath(); c.arc(cx, cy, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(120,170,255,.16)'; c.beginPath(); c.arc(cx, cy, R - 1, Math.PI, 0); c.fill();
      c.fillStyle = 'rgba(232,212,160,.75)'; c.font = `600 8px ${"'Cinzel', serif"}`; c.textAlign = 'center';
      c.fillText('T E C H N I C A L', cx, h - 30); c.fillText('M A C H I N E', cx, h - 19);
    });
    for (const [grade, col] of Object.entries(GRADE)) hiTex(this, `tm-face-${grade}`, W, H, (c, w, h) => {
      const css = hex(col);
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#201c34'); gr.addColorStop(.5, '#14121f'); gr.addColorStop(1, '#0b0a12');
      rr(c, .5, .5, w - 1, h - 1, 9); c.fillStyle = gr; c.fill();
      c.save(); c.shadowColor = css; c.shadowBlur = 8; c.strokeStyle = css; c.lineWidth = 1.6; c.stroke(); c.restore();
      rr(c, 5, 5, w - 10, h - 10, 6); c.strokeStyle = css + '55'; c.lineWidth = .8; c.stroke();
      const top = c.createLinearGradient(0, 0, 0, 70); top.addColorStop(0, css + '40'); top.addColorStop(1, css + '00');
      c.fillStyle = top; c.fillRect(6, 6, w - 12, 64);
    });
  }

  // 카드 앞면 내용: 등급 · 종류 · 기술 아이콘 · 이름 · 타입 · 효과
  tmFace(face, card, m, W, H, chosen) {
    const col = GRADE[card.grade] || 0xffffff, gcss = hex(col), top = -H / 2;
    face.add(hiImage(this, 0, 0, `tm-face-${card.grade}`));
    face.add(hkText(this, -W / 2 + 10, top + 8, card.grade, 8.5, gcss, { bold: true, ls: 1 }));
    face.add(hkText(this, W / 2 - 10, top + 8, card.kind === 'move' ? '새 기술 · 타 속성' : card.kind === 'up' ? '기술 강화' : '숙련', 8, HK.dim, { origin: [1, 0] }));
    const iconId = card.kind === 'move' ? card.id : card.kind === 'up' ? card.skill : null, tcol = typeColor(card.type);
    face.add(this.add.image(0, top + 50, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tcol).setScale(.9).setAlpha(.5));
    if (iconId && this.textures.exists(`sk:${iconId}`)) face.add(this.add.image(0, top + 50, `sk:${iconId}`).setDisplaySize(42, 42));
    else face.add(hkText(this, 0, top + 50, '✦', 26, gcss, { origin: .5, glow: true }));
    // 이름: '불꽃세례 개조: 푸른 연옥' 은 두 줄 (작은 머리글 + 큰 이름)
    const [head, main] = card.name.includes(': ') ? card.name.split(': ') : [null, card.name];
    let y = top + 80;
    if (head) { face.add(hkText(this, 0, y, head, 8, HK.dim, { origin: [.5, 0] })); y += 12; }
    const nm = hkText(this, 0, y, main, main.length > 8 ? 11 : 12.5, chosen ? HK.gold : HK.ivory, { bold: true, origin: [.5, 0] });
    if (nm.width > W - 18) nm.setScale((W - 18) / nm.width);
    face.add(nm); y += 18;
    const probe = hkText(this, 0, 0, typeName(card.type), 7.5, '#ffffff', { bold: true }), pw = Math.round(probe.width) + 14;   // 타입 알약 폭 재기 (가운데 맞춤)
    probe.destroy();
    typePill(this, face, -pw / 2, y, card.type, 7.5); y += 16;
    face.add(hkText(this, -W / 2 + 11, y, card.desc, 8.5, HK.ivory, { style: { wordWrap: { width: W - 22, useAdvancedWrap: true }, lineSpacing: 2 } }));
    const foot = card.kind === 'move' ? `재사용 ${card.cd}초 · Z·X·C 중 하나와 교체` : card.kind === 'up' ? `대상: ${SKILLS[card.skill].name}` : `${this.gs.player.formName(m)}에게만`;
    face.add(hkText(this, 0, H / 2 - 16, foot, 7.5, HK.dim, { origin: [.5, 0] }));
  }

  // 카드 누르기: 뒷면이면 뒤집고, 3장을 다 열었으면 고른다
  tmPress(i) {
    const it = this.gs.tmActive;
    if (!it || this.tmBusy || this.tmSlot) return;
    if (!it.flipped[i]) { it.flipped[i] = true; this.showTM(i); return; }
    if (!it.flipped.every(Boolean)) { Sfx.play('deny'); return; }
    it.sel = i; Sfx.play('select'); this.showTM();
  }
  tmConfirm() {
    const it = this.gs.tmActive;
    if (!it || it.sel < 0 || !it.flipped.every(Boolean) || this.tmBusy) return;
    if (it.cards[it.sel].kind === 'move') { this.tmSlot = true; Sfx.play('select'); this.showTM(); return; }
    this.gs.finishTM(it.sel);
  }
  tmChooseSlot(slot) {
    const it = this.gs.tmActive;
    if (!it || it.sel < 0) return;
    this.tmSlot = false;
    this.gs.finishTM(it.sel, slot);
  }

  // 진행 저장 결과: 자동 저장은 작은 알림, 일시정지 메뉴에서 저장하면 메뉴 아래 글귀로
  onSaved({ ok, auto }) {
    const msg = ok ? (auto ? '포켓몬센터 · 자동 저장했다' : '저장했다 · 로비의 이어하기로 여기서부터') : '저장하지 못했다 (브라우저 저장 공간을 확인해 주세요)';
    if (this.overlayMode === 'pause' && this.pauseNote && this.pauseNote.scene) { this.pauseNote.setText(msg).setColor(ok ? HK.gold : '#ff8a8a'); Sfx.play(ok ? 'heal' : 'deny'); }
    else this.toast(msg);
  }

  showPause(on) {
    this.clearOverlay();
    if (!on) return;
    this.toastT = 0;
    const g = this.gOver, L = this.overlay.setVisible(true);
    g.fillStyle(0x05040a, .84); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(hkText(this, 320, 50, '일시정지', 20, HK.ivory, { ls: 6, bold: true, origin: .5, glow: true }));
    L.add(fadeLine(this, 320, 72, 300));
    // Space·Z 는 게임 입력과 겹치므로 일시정지 메뉴는 Enter·클릭으로 고른다
    this.menu = hkMenu(this, 320, 92, [
      { label: '계속하기', onPick: () => this.gs.togglePause() },
      { label: '저장하기', onPick: () => this.gs.saveRun(false) },
      { label: '저장하고 도감으로', onPick: () => { if (this.gs.saveRun(false)) { this.gs.paused = false; this.gs.backToLobby(); } } },
      { label: '설정', onPick: () => { this.gs.togglePause(); this.gs.toggleOverlay('settings'); } },
      { label: '포기하고 도감으로', onPick: () => { this.gs.paused = false; this.gs.gameOver(false, true); } }
    ], { layer: L, gap: 21, pickKeys: ['Enter'], onMove: () => Sfx.play('select') });
    L.add(fadeLine(this, 320, 190, 220, .5));
    L.add(hkText(this, 320, 202, '조 작 법', 9, HK.dim, { ls: 2, origin: .5 }));
    const kl = a => keyLabel(Settings.key(a));
    const lines = [
      [`${kl('left')} ${kl('right')}`, '이동'], [`${kl('jump')} / ${kl('up')}`, '점프 (공중 점프)'], [`${kl('down')} + ${kl('jump')}`, '발판 아래로'], [`${kl('z')} · ${kl('x')} · ${kl('c')}`, '스킬 (Z칸은 콤보)'],
      [kl('dash'), '대시 회피 (무적)'], [`${kl('swap')}·${kl('swap2')}·1~3`, '교대 + 교체 스킬'], [kl('zmove'), 'Z기술 (Z크리스탈)'], [kl('mega'), '메가진화 (3단 + 메가스톤)'],
      [`${kl('map')} · ${kl('bag')} · ${kl('settings')}`, '지도 · 가방 · 설정 (키 변경)'], [`${kl('interact')} / ${kl('up')}`, '센터 · 자판기 · 아머까오 · 기술머신'], ['N', '소리 켜기/끄기'], ['Esc · P', '일시정지']
    ];
    lines.forEach(([k, d], i) => {
      const cx = i % 2 ? 400 : 172, y = 214 + (i >> 1) * 15;
      L.add(hkText(this, cx - 6, y, k, 10, HK.gold, { origin: [1, 0] }));
      L.add(hkText(this, cx + 6, y, d, 10, HK.ivory));
    });
    this.pauseNote = hkText(this, 320, 314, 'Esc · P 로 돌아가기   ·   L 포기   ·   포켓몬센터에 가면 자동 저장', 9, HK.faint, { origin: .5 });
    L.add(this.pauseNote);
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'pause';
  }

  // ---------------- 지도 (M) ----------------
  // 할로우 나이트풍 도식 지도 (그리기·이동·확대는 systems/MapView.js). 위쪽 탭으로 다섯 지방을 오간다 — 들른 지방만 열린다
  mapOpen(ci) { const W = this.gs.worlds[ci]; return !!(W && W.explored); }
  showMap(ci = null) {
    this.clearOverlay();
    const gs = this.gs, L = this.overlay.setVisible(true), g = this.gOver;
    if (ci === null) ci = this.mapCi != null && this.mapOpen(this.mapCi) && this.mapLeft === gs.stageIdx ? this.mapCi : gs.stageIdx;
    if (!this.mapOpen(ci)) ci = gs.stageIdx;
    this.mapCi = ci; this.mapLeft = gs.stageIdx;
    const st = STAGES[ci];
    g.fillStyle(0x05040a, .97); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(hkText(this, 404, 22, `${st.region} 지도`, 14, HK.ivory, { ls: 5, bold: true, origin: .5, glow: true }));   // 왼쪽 위 지도·가방·설정 탭을 피해 오른쪽으로
    // 지방 탭: [ 1.관동지방 | 2.성도지방 | … ] — 안 가 본 지방은 흐리게 잠겨 있다
    const tabs = STAGES.map((s2, i) => hkText(this, 0, 42, `${i + 1}.${s2.region}`, 9.5, i === ci ? HK.ivory : this.mapOpen(i) ? HK.dim : HK.faint, { bold: i === ci, ls: 1, origin: [0, .5] }));
    const sepW = 18, total = tabs.reduce((s2, t) => s2 + t.width, 0) + sepW * (tabs.length - 1) + 24;
    let x = 320 - total / 2;
    L.add(hkText(this, x, 42, '[', 10, HK.faint, { origin: [0, .5] })); x += 12;
    tabs.forEach((t, i) => {
      t.setX(x); L.add(t);
      if (i === ci) L.add(fadeLine(this, x + t.width / 2, 52, t.width + 14, .9));
      else if (this.mapOpen(i)) {
        t.setInteractive({ useHandCursor: true });
        t.on('pointerover', () => t.setColor(HK.ivory)); t.on('pointerout', () => t.setColor(HK.dim));
        t.on('pointerdown', () => { Sfx.play('select'); this.showMap(i); });
      }
      x += t.width;
      if (i < tabs.length - 1) { L.add(hkText(this, x + sepW / 2, 42, '|', 9.5, HK.faint, { origin: .5 })); x += sepW; }
    });
    L.add(hkText(this, x + 2, 42, ']', 10, HK.faint, { origin: [0, .5] }));
    this.mapView = new MapView(this, L, ci);
    this.overlayChrome(L, 'map');
    // 휴대폰에는 휠·Z 키가 없으니 지도 창 오른쪽 위에 확대·축소 버튼 (지도는 끌어서 이동)
    glassButton(this, VP.x + VP.w - 54, VP.y + 6, 24, 18, '–', () => this.mapView && this.mapView.zoom(-1), { size: 10, layer: L });
    glassButton(this, VP.x + VP.w - 26, VP.y + 6, 24, 18, '+', () => this.mapView && this.mapView.zoom(1), { size: 10, layer: L });
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    // 범례 (핀 모양을 글로 풀어서) · 탐험률 · 조작
    L.add(hkText(this, 34, 316, '◉ 포켓몬센터  ◉ 아머까오  ☠ 보스·중간 보스  ? 숨겨진 전설  ◉ 기술머신  ◉ 보물  ◉ 상처약  ◉ 현재 위치  ┆ 안 가 본 길', 8.5, HK.dim));
    L.add(hkText(this, 320, 340, `${st.short} 탐험 ${Math.round(this.mapView.progress * 100)}%   ·   1~5 지방   ·   ${keyLabel(Settings.key('map'))} · Esc 닫기   ·   끌어서 이동 · 휠 · Z · +– 확대`, 9, HK.faint, { origin: .5 }));
    this.overlayMode = 'map';
  }

  // ---------------- 아머까오 공중날기 (시내 정거장에서 F / ↑) ----------------
  //  들른 포켓몬센터라면 어느 지방이든. 지방별 세로 줄 — ←→ 지방 · ↑↓ 시내 · Enter 출발 (클릭도)
  showTaxi(sel = null) {
    this.clearOverlay();
    this.toastT = 0;
    const gs = this.gs, g = this.gOver, L = this.overlay.setVisible(true);
    g.fillStyle(0x05040a, .9); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(this.add.image(320, 170, 'glow').setBlendMode(ADD).setTint(0x4a6aff).setScale(9, 5).setAlpha(.14));
    L.add(hkText(this, 320, 22, '아머까오 공중날기', 18, HK.ivory, { bold: true, ls: 6, origin: .5, glow: true }));
    L.add(fadeLine(this, 320, 40, 320, .8));
    L.add(hkText(this, 320, 52, '들른 포켓몬센터라면 어느 지방이든 날아간다', 9.5, HK.dim, { origin: .5 }));
    const items = [], COLW = 118, X0 = 320 - COLW * 2;
    STAGES.forEach((st, ci) => {
      const x = X0 + ci * COLW, hubs = gs.unlockedHubs.filter(h => h.ci === ci);
      L.add(hkText(this, x, 82, `${ci + 1}. ${st.region}`, 10, hubs.length ? HK.gold : HK.faint, { bold: true, origin: .5 }));
      L.add(fadeLine(this, x, 96, 96, hubs.length ? .6 : .25));
      if (!hubs.length) L.add(hkText(this, x, 114, '— 아직 못 가 봤다 —', 8.5, HK.faint, { origin: .5 }));
      hubs.forEach((h, k) => items.push({ h, ci, x, y: 114 + k * 24, cur: ci === gs.stageIdx && gs.room && gs.room.id === h.roomId }));
    });
    if (sel === null) sel = Math.max(0, items.findIndex(it => it.cur));
    this.taxiItems = items; this.taxiSel = Math.min(sel, items.length - 1);
    items.forEach((it, i) => {
      const on = i === this.taxiSel;
      if (on) L.add(this.add.image(it.x, it.y, 'glow').setBlendMode(ADD).setTint(0x9ab0ff).setDisplaySize(118, 26).setAlpha(.4));
      const t = hkText(this, it.x, it.y, it.cur ? `${it.h.name} (지금 여기)` : it.h.name, 10, it.cur ? HK.faint : on ? HK.ivory : HK.dim, { bold: on, origin: .5 });
      L.add(t);
      if (on) L.add([fadeLine(this, it.x - t.width / 2 - 14, it.y, 18, .7), fadeLine(this, it.x + t.width / 2 + 14, it.y, 18, .7)]);
      const z = this.add.zone(it.x, it.y, COLW - 6, 22).setInteractive({ useHandCursor: !it.cur }); L.add(z);
      z.on('pointerover', () => { if (this.taxiSel !== i) this.showTaxi(i); });
      z.on('pointerdown', () => this.taxiPick(i));
    });
    // 아머까오 초상화
    const meta = this.registry.get('spriteMeta') || {};
    if (meta.corviknight && meta.corviknight.hasSprite) L.add([this.add.image(320, 262, roundPortrait(this, 'corviknight')), hiImage(this, 320, 262, 'gloss'), hiImage(this, 320, 262, 'slot3d-gold')]);
    L.add(hkText(this, 320, 298, '아머까오가 강철 날개를 펼친다…', 9, HK.dim, { origin: .5 }));
    L.add(hkText(this, 320, 336, '←→ 지방 · ↑↓ 시내 · Enter 출발   ·   Esc 닫기', 9, HK.faint, { origin: .5 }));
    glassButton(this, 566, 8, 64, 20, '✕  닫기', () => gs.toggleOverlay('taxi'), { size: 9, layer: L });
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'taxi';
  }
  taxiPick(i) {
    const it = this.taxiItems && this.taxiItems[i];
    if (!it || it.cur) { Sfx.play('select'); return; }
    this.gs.travelTo(it.h.ci, it.h.roomId);
  }
  // 방향키: ↑↓ 같은 지방 안에서, ←→ 옆 지방의 같은 높이(없으면 가까운 것)로
  taxiMove(e) {
    const items = this.taxiItems || [], cur = items[this.taxiSel];
    if (!cur) return;
    let next = -1;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      const col = items.map((it, i) => ({ it, i })).filter(o => o.it.ci === cur.ci), k = col.findIndex(o => o.i === this.taxiSel);
      next = col[(k + (e.code === 'ArrowDown' ? 1 : -1) + col.length) % col.length].i;
    } else {
      const d = e.code === 'ArrowRight' ? 1 : -1;
      for (let ci = cur.ci + d; ci >= 0 && ci < STAGES.length && next < 0; ci += d) {
        const col = items.map((it, i) => ({ it, i })).filter(o => o.it.ci === ci);
        if (col.length) next = col.reduce((b, o) => Math.abs(o.it.y - cur.y) < Math.abs(b.it.y - cur.y) ? o : b).i;
      }
    }
    if (next >= 0 && next !== this.taxiSel) { Sfx.play('select'); this.showTaxi(next); }
  }

  // ---------------- 디버그 패널 (F3): 챕터 & 보스 셀렉트 ----------------
  //  1~5 챕터 탭 · 그 챕터의 입구·시내·중간 보스·지방 보스·히든 성소·기술머신·보물방 목록 → 고르면 그 방으로 순간이동
  //  정화한 보스는 R 로 '다시 싸우기' (관문을 다시 단다) · 아래 버튼: 성장 한 단계(F4) · 공중날기 전부 해금 · 파티 회복
  showDebug(ci = null, sel = 0) {
    this.clearOverlay();
    this.toastT = 0;
    const gs = this.gs, g = this.gOver, L = this.overlay.setVisible(true);
    if (ci === null) ci = this.dbgCi != null ? this.dbgCi : gs.stageIdx;
    this.dbgCi = ci;
    g.fillStyle(0x05040a, .93); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(hkText(this, 320, 18, '디버그 · 챕터 & 보스 셀렉트', 14, HK.gold, { bold: true, ls: 3, origin: .5, glow: true }));
    // 챕터 탭
    STAGES.forEach((st, i) => {
      const x = 320 + (i - 2) * 112, on = i === ci;
      const t = hkText(this, x, 42, `${i + 1}. ${st.short}`, 10, on ? HK.ivory : HK.dim, { bold: on, origin: .5 });
      L.add(t);
      if (on) L.add(fadeLine(this, x, 52, t.width + 24, .9));
      t.setInteractive({ useHandCursor: true }); t.on('pointerdown', () => { Sfx.play('select'); this.showDebug(i, 0); });
    });
    const lv = gs.worldOf(ci).level, TAG = { start: '입구', village: '시내', tm: '기술', treasure: '보물', ...ARENA_TAG };
    const ORDER = { start: 0, village: 1, mini: 2, boss: 3, sanctuary: 4, tm: 5, treasure: 6 };
    const rooms = lv.rooms.filter(r => r.type in ORDER).sort((a, b) => ORDER[a.type] - ORDER[b.type] || a.id - b.id);
    this.dbgRooms = rooms; this.dbgSel = Math.min(sel, rooms.length - 1);
    const COL = Math.ceil(rooms.length / 2);
    rooms.forEach((r, i) => {
      const x = i < COL ? 44 : 334, y = 68 + (i % COL) * 17, on = i === this.dbgSel, def = r.boss && BOSSES[r.boss];
      const arena = r.type in ARENA_TAG, done = arena && r.cleared;
      const name = def ? `${def.name}${def.title ? ' — ' + def.title : ''}` : r.type === 'village' ? (r.city || r.area) : r.area || '';
      if (on) L.add(this.add.image(x + 130, y + 7, 'glow').setBlendMode(ADD).setTint(0xffd27a).setDisplaySize(290, 18).setAlpha(.3));
      const tagCol = r.type === 'boss' ? '#ff8a8a' : r.type === 'mini' ? '#ffc08a' : r.type === 'sanctuary' ? '#d08aff' : r.type === 'village' ? '#8affb0' : '#9ad8ff';
      L.add(hkText(this, x, y, `[${TAG[r.type]}]`, 9, tagCol, { bold: true }));
      const t = hkText(this, x + 40, y, `${name}${done ? '  ✓정화' : ''}`, 9, on ? HK.ivory : done ? HK.faint : HK.dim, { bold: on });
      if (t.width > 236) t.setScale(236 / t.width, 1);
      L.add(t);
      const z = this.add.zone(x - 4, y - 2, 284, 17).setOrigin(0).setInteractive({ useHandCursor: true }); L.add(z);
      z.on('pointerover', () => { if (this.dbgSel !== i) this.showDebug(ci, i); });
      z.on('pointerdown', () => this.debugPick(i));
    });
    const by = 296, by2 = 318;
    glassButton(this, 50, by, 120, 20, '성장 한 단계  F4', () => { gs.toggleOverlay('debug'); gs.debugGrow(); }, { size: 9, layer: L });
    glassButton(this, 180, by, 120, 20, '공중날기 전부 해금', () => { gs.debugUnlockHubs(); Sfx.play('unlock'); }, { size: 9, layer: L });
    glassButton(this, 310, by, 120, 20, '파티 회복', () => { for (const m of gs.player.members) { m.hp = m.maxhp; m.alive = true; } Sfx.play('heal'); this.toast('[디버그] 파티 전원 회복'); }, { size: 9, layer: L });
    glassButton(this, 440, by, 150, 20, '📦 포켓몬 보관함 (교체)', () => { gs.overlay = 'box'; this.showBox(); }, { size: 9, ls: 0, layer: L });
    glassButton(this, 50, by2, 270, 20, '🔓 모든 스타팅 & 보스 캐릭터 전체 즉시 해금', () => { Save.debugUnlockAll(); Sfx.play('unlock'); this.toast('[디버그] 모든 포켓몬 해금 · 포켓몬센터 보관함·도감에서 고를 수 있다'); }, { size: 9, ls: 0, layer: L, primary: true });
    glassButton(this, 330, by2, 260, 20, '⚡ 현재 포켓몬 즉시 진화 / 메가진화 발동', () => { gs.toggleOverlay('debug'); gs.player.debugEvolve(); }, { size: 9, ls: 0, layer: L, primary: true });
    // 성능: FPS · 깨어 있는/잠든 적 · 풀에서 쉬는 이미지 수
    const awake = gs.enemies.filter(e => e.alive && !e.asleep).length, slept = gs.enemies.filter(e => e.asleep).length;
    const perf = hkText(this, 50, 274, '', 8.5, HK.faint); L.add(perf);
    const showPerf = () => perf.setText(`FPS ${Math.round(this.game.loop.actualFps)}  ·  적 ${awake} 활동 / ${slept} 잠듦(화면 밖)  ·  풀 이미지 ${gs.fx.pool.size}/${gs.fx.pool.made}`);
    showPerf();
    const perfT = this.time.addEvent({ delay: 500, loop: true, callback: () => { if (perf.scene) showPerf(); else perfT.remove(); } });
    L.add(hkText(this, 320, 348, '1~5 챕터 · ↑↓←→ 고르기 · Enter 순간이동 · R 정화한 보스 다시 싸우기 · F3 · Esc 닫기', 8.5, HK.faint, { origin: .5 }));
    glassButton(this, 566, 8, 64, 20, '✕  닫기', () => gs.toggleOverlay('debug'), { size: 9, layer: L });
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'debug';
  }
  debugPick(i) {
    const r = this.dbgRooms && this.dbgRooms[i];
    if (!r) return;
    const def = r.boss && BOSSES[r.boss];
    this.gs.warpToRoom(this.dbgCi, r.id, `[디버그] ${STAGES[this.dbgCi].short} · ${def ? def.name : ROOM_NAME[r.type]}`);
  }

  // ---------------- 가방 (I) ----------------
  //  위: 포켓몬 한 마리씩 (1~3 탭으로 바꿔 보기) — 진화 단계 · 체력 · 경험치 · 능력치 · 아이템 효과
  //      + 장착 칸 5개(같은 아이템 2개면 2칸) + 기술 Z · X · C
  //  아래 왼쪽: [도구] 내 가방(장착 안 한 아이템 전부 + 중요한 물건) / [기술] 이 포켓몬이 배운 기술 전부
  //  아래 오른쪽: 고른 것 설명 + 버튼 — 도구: 장착하기 / 가방에 넣기 · 기술: Z·X·C 자리에 넣기 (이미 있으면 맞바꿈)
  //  키보드: 1~3 · Q/E 포켓몬 · Tab 도구↔기술 · ← → 고르기 · Enter 장착/빼기 · Z·X·C 고른 기술을 그 자리에
  showInv(sel = this.invSel) {
    this.clearOverlay();
    const gs = this.gs, p = gs.player, g = this.gOver, L = this.overlay.setVisible(true);
    if (this.invMember == null || !p.members[this.invMember]) this.invMember = p.idx;
    if (!this.invTab) this.invTab = 'items';
    const mi = this.invMember, m = p.members[mi], sp = m.sp, Tm = TIERS[p.tierOf(m)], used = p.equipCount(m), tab = this.invTab;
    g.fillStyle(0x05040a, .97); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(hkText(this, 320, 21, '가방', 14, HK.ivory, { ls: 8, bold: true, origin: .5, glow: true }));
    this.overlayChrome(L, 'inv');
    // 고를 수 있는 것: 도구 탭 = 장착 칸(한 칸 = 아이템 1개) + 가방 · 기술 탭 = Z·X·C + 배운 기술
    const worn = [];
    for (const id of Object.keys(m.items)) for (let k = 0; k < m.items[id]; k++) worn.push(id);
    const bag = Object.keys(p.bag), slots = ['z', 'x', 'c'];
    const itemList = [...worn.map((id, k) => ({ id, from: mi, k })), ...bag.map(id => ({ id, from: -1 }))];
    const skillList = [...slots.map(s => ({ skill: m.skills[s], slot: s })), ...m.learned.filter(id => !slots.some(s => m.skills[s] === id)).map(id => ({ skill: id, slot: null }))];
    if (sel && sel.skill) { if (!m.learned.includes(sel.skill)) sel = null; else sel = { skill: sel.skill, slot: slots.find(s => m.skills[s] === sel.skill) || null }; }
    else if (sel) {
      if (!itemList.some(s => s.id === sel.id && s.from === sel.from)) sel = null;
      else if (sel.from >= 0 && sel.k == null) sel = itemList.find(s => s.id === sel.id && s.from === sel.from);
    }
    this.invSel = sel; this.invList = tab === 'skills' ? skillList : itemList;
    const isSel = s => sel && (s.skill ? sel.skill === s.skill : !sel.skill && sel.id === s.id && sel.from === s.from && (sel.from < 0 || sel.k === s.k));
    // 칸 하나 (누르면 고른다): 도구는 본가 그림, 기술은 기술 아이콘
    const cell = (x, y, S, s, n, key) => {
      const on = s && isSel(s);
      g.fillStyle(on ? 0x3a3060 : 0x15131f, on ? 1 : .92); g.fillRoundedRect(x - S / 2, y - S / 2, S, S, 5);
      g.lineStyle(on ? 1.8 : 1, on ? HK.goldN : HK.ivoryN, on ? .95 : s ? .32 : .14); g.strokeRoundedRect(x - S / 2, y - S / 2, S, S, 5);
      if (key) L.add(hkText(this, x - S / 2 + 4, y - S / 2 + 2, key, 8, HK.gold, { bold: true }));
      if (!s) { g.lineStyle(1, HK.ivoryN, .18); g.lineBetween(x - 5, y, x + 5, y); g.lineBetween(x, y - 5, x, y + 5); return; }   // 빈 칸: 흐린 +
      L.add(s.skill ? this.add.image(x + 2, y + 2, `sk:${s.skill}`).setDisplaySize(S - 12, S - 12) : this.itemImage(x, y, s.id, S - 8, 1.6));
      if (n > 1) L.add(this.add.text(x + S / 2 - 2, y + S / 2 - 1, `×${n}`, txt(8, '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(1, 1));
      const z = this.add.zone(x, y, S + 4, S + 4).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { Sfx.play('select'); if (s.skill) this.invTab = 'skills'; else this.invTab = 'items'; this.showInv(s); });
      L.add(z);
    };

    // ── 포켓몬 탭 (1~3): 작은 초상화 + 이름 + 장착 수, 출전 중이면 금빛 점
    p.members.forEach((pm, i) => {
      const x = 16 + i * 156, y = 44, w = 150, h = 30, on = i === mi;
      glassPanel(g, x, y, w, h, { r: 10, fill: on ? 0x221e34 : 0x0f0d18, border: on ? HK.goldN : HK.ivoryN, borderAlpha: on ? .75 : .25, alpha: .92 });
      L.add(this.add.image(x + 18, y + 15, roundPortrait(this, p.portraitKey(pm))).setScale(.55).setAlpha(pm.alive ? 1 : .4));
      L.add(hkText(this, x + 36, y + 15, `${i + 1}  ${p.formName(pm)}`, 10.5, on ? HK.gold : pm.alive ? HK.ivory : HK.faint, { bold: on, origin: [0, .5] }));
      if (i === p.idx) { g.fillStyle(HK.goldN, .9); g.fillCircle(x + w - 12, y + 15, 3); }
      L.add(hkText(this, x + w - 20, y + 15, `${p.equipCount(pm)}/${MAX_EQUIP}`, 8.5, HK.dim, { origin: [1, .5] }));
      if (!on) {
        const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => { Sfx.play('select'); this.invMember = i; this.showInv(null); });
        L.add(z);
      }
    });
    L.add(hkText(this, 624, 59, '● 출전 중', 8.5, HK.gold, { origin: [1, .5] }));

    // ── 고른 포켓몬: 초상화 · 이름 · 타입 · 체력 · 경험치 · 능력치 · 아이템 효과 · 장착 칸 5개 · 기술 Z X C
    const PY = 80, PH = 128;
    glassPanel(g, 16, PY, 608, PH, { border: mi === p.idx ? HK.goldN : HK.ivoryN, borderAlpha: mi === p.idx ? .5 : .2 });
    L.add(this.add.image(62, PY + 50, roundPortrait(this, p.portraitKey(m))).setScale(1.5).setAlpha(m.alive ? 1 : .4));
    L.add(hiImage(this, 62, PY + 50, 'gloss').setScale(1.5 / RES));
    L.add(hiImage(this, 62, PY + 50, mi === p.idx ? 'slot3d-gold' : 'slot3d').setScale(1.5 / RES));
    L.add(hkText(this, 62, PY + 88, `${Tm.name}${m.alive ? '' : ' · 기절'}`, 9, m.alive ? HK.gold : HK.faint, { bold: true, origin: [.5, 0] }));
    L.add(hkText(this, 62, PY + 102, mi === p.idx ? '출전 중' : '대기', 8.5, mi === p.idx ? HK.gold : HK.dim, { origin: [.5, 0] }));
    const nm = hkText(this, 112, PY + 6, p.formName(m), 13, m.alive ? HK.ivory : HK.faint, { bold: true });
    L.add(nm);
    let tx = nm.x + nm.width + 8;
    for (const ty of p.typesOf(m)) tx += typePill(this, L, tx, PY + 9, ty, 8.5) + 4;
    L.add(hkText(this, 336, PY + 9, '체력', 8.5, HK.dim));
    bar3d(g, 362, PY + 14, 92, 4, m.hp / m.maxhp, m.hp / m.maxhp > .25 ? 0x6ae08a : 0xff6a6a);
    L.add(hkText(this, 460, PY + 9, `${Math.ceil(m.hp)}/${m.maxhp}`, 8.5, HK.ivory));
    const done = m.tier >= EVO_EXP.length;
    L.add(hkText(this, 518, PY + 9, '경험치', 8.5, HK.dim));
    bar3d(g, 552, PY + 14, 60, 4, p.expProgress(m), m.mega ? 0xff8ad0 : 0xb07aff);
    L.add(hkText(this, 612, PY + 20, m.mega ? '메가 ★' : done ? '3단 완료' : `${m.exp}/${EVO_EXP[m.tier]}`, 8, HK.dim, { origin: [1, 0] }));
    const atk = Math.round(sp.atk * Tm.atk * 10) / 10, spd = Math.round(sp.speed * (m.mega ? 1.1 : 1));
    L.add(hkText(this, 112, PY + 30, `공격 ${atk}   속도 ${spd}   점프 ${sp.jumps}단${sp.hover ? ' · 부유' : ''}   기술 크기 ×${Tm.fx}   교체 · ${TAGS[sp.tag].name}`, 8.5, HK.dim));
    const mt = this.modsText(m.mods);
    L.add(hkText(this, 112, PY + 45, `아이템 효과  ${mt || '없음'}`, 8.5, mt ? HK.ivory : HK.faint, { style: { fixedWidth: 500 } }));
    L.add(hkText(this, 112, PY + 64, `장착 아이템  ${used} / ${MAX_EQUIP}`, 9.5, HK.gold, { bold: true }));
    for (let k = 0; k < MAX_EQUIP; k++) cell(130 + k * 42, PY + 100, 36, k < worn.length ? { id: worn[k], from: mi, k } : null, 1);
    L.add(hkText(this, 362, PY + 64, '기술  ·  눌러서 바꾸기', 9.5, HK.gold, { bold: true }));
    slots.forEach((s, k) => cell(380 + k * 46, PY + 100, 38, { skill: m.skills[s], slot: s }, 1, s.toUpperCase()));
    L.add(hkText(this, 518, PY + 84, `배운 기술 ${m.learned.length}개`, 8.5, HK.dim));
    L.add(hkText(this, 518, PY + 98, m.learned.length > 3 ? '아래 [기술]에서\n골라 넣을 수 있어요' : '기술머신 비밀방에서\n새 기술을 배워요', 8, HK.faint, { style: { lineSpacing: 2 } }));

    // ── 아래 왼쪽: [도구] 내 가방 / [기술] 배운 기술
    const BY = 214, BW = 396, BH = 132;
    glassPanel(g, 16, BY, BW, BH);
    const nBag = bag.reduce((s2, id) => s2 + p.bag[id], 0);
    [['items', `도구  ${nBag}`], ['skills', `기술  ${m.learned.length}`]].forEach(([id, label], i) => {
      glassButton(this, 24 + i * 92, BY + 6, 86, 24, label, () => { if (this.invTab !== id) { this.invTab = id; Sfx.play('select'); this.showInv(null); } }, { size: 10, bold: true, layer: L, primary: tab === id });
    });
    if (tab === 'items') {
      L.add(hkText(this, 214, BY + 18, '내 가방 · 장착하지 않은 아이템', 8.5, HK.dim, { origin: [0, .5] }));
      if (!bag.length) L.add(hkText(this, 16 + BW / 2, BY + 58, '비어 있어요 — 장착 칸에서 「가방에 넣기」를 하거나,\n장착 칸이 가득 찼을 때 주운 아이템이 여기로 와요', 8.5, HK.faint, { origin: .5, style: { align: 'center', lineSpacing: 3 } }));
      bag.slice(0, 20).forEach((id, k) => cell(42 + (k % 10) * 36, BY + 52 + Math.floor(k / 10) * 34, 30, { id, from: -1 }, p.bag[id]));
      // 중요한 물건 (파티 공용 · 장착하지 않는다)
      const KY = BY + 114;
      g.lineStyle(1, HK.ivoryN, .12); g.lineBetween(26, KY - 11, 16 + BW - 10, KY - 11);
      L.add(hkText(this, 26, KY, '중요한 물건', 9, HK.dim, { bold: true, origin: [0, .5] }));
      let kx = 104;
      if (p.z.has) { L.add(this.add.image(kx, KY, 'zcrystal').setScale(1.4)); L.add(hkText(this, kx + 12, KY, 'Z크리스탈 (Z기술)', 8.5, HK.ivory, { origin: [0, .5] })); kx += 124; }
      if (p.mega.stones) { L.add(this.add.image(kx, KY, 'megastone').setScale(1.4)); L.add(hkText(this, kx + 12, KY, `메가스톤 ×${p.mega.stones} (메가진화)`, 8.5, HK.ivory, { origin: [0, .5] })); kx += 140; }
      if (!p.z.has && !p.mega.stones) L.add(hkText(this, kx, KY, '아직 없음 — 지방 보스가 Z크리스탈 · 메가스톤을 떨어뜨린다', 8.5, HK.faint, { origin: [0, .5] }));
    } else {
      L.add(hkText(this, 214, BY + 18, `${p.formName(m)}이(가) 배운 기술 · 골라서 Z·X·C 에`, 8.5, HK.dim, { origin: [0, .5] }));
      // 배운 기술: 3열 목록 (아이콘 · 이름 · 장착 중이면 자리 글자)
      m.learned.slice(0, 12).forEach((id, k) => {
        const col = k % 3, row = Math.floor(k / 3), x = 24 + col * 128, y = BY + 38 + row * 23, w = 124, h = 21;
        const s = { skill: id, slot: slots.find(sl => m.skills[sl] === id) || null }, on = isSel(s), sk = SKILLS[id];
        g.fillStyle(on ? 0x3a3060 : 0x15131f, on ? 1 : .85); g.fillRoundedRect(x, y, w, h, 5);
        g.lineStyle(on ? 1.6 : 1, on ? HK.goldN : HK.ivoryN, on ? .9 : .2); g.strokeRoundedRect(x, y, w, h, 5);
        L.add(this.add.image(x + 12, y + h / 2, `sk:${id}`).setDisplaySize(15, 15));
        const name = hkText(this, x + 23, y + h / 2, sk.name, 8.5, on ? HK.ivory : HK.dim, { bold: on, origin: [0, .5] });
        if (name.width > w - 44) name.setScale((w - 44) / name.width, 1);
        L.add(name);
        if (s.slot) { g.fillStyle(HK.goldN, .9); g.fillRoundedRect(x + w - 18, y + 4, 14, 13, 3); L.add(hkText(this, x + w - 11, y + h / 2, s.slot.toUpperCase(), 8, '#1a1008', { bold: true, origin: .5 })); }
        const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => { Sfx.play('select'); this.showInv(s); });
        L.add(z);
      });
      if (m.learned.length > 12) L.add(hkText(this, 16 + BW - 12, BY + BH - 10, `+${m.learned.length - 12}`, 8.5, HK.dim, { origin: [1, .5] }));
    }

    // ── 아래 오른쪽: 고른 것 설명 + 버튼
    const DX = 418, DW = 206;
    glassPanel(g, DX, BY, DW, BH);
    if (sel && sel.skill) {
      const sk = SKILLS[sel.skill], combo = !sk.cd;
      L.add(this.add.image(DX + 24, BY + 24, `sk:${sel.skill}`).setDisplaySize(30, 30));
      const sn = hkText(this, DX + 46, BY + 8, sk.name, 11, HK.ivory, { bold: true });
      if (sn.width > DW - 54) sn.setScale((DW - 54) / sn.width, 1);
      L.add(sn);
      const tw = typePill(this, L, DX + 46, BY + 27, sk.type, 8);
      L.add(hkText(this, DX + 50 + tw, BY + 27, combo ? '연타 · Z 전용' : `재사용 ${Math.round(p.cdOf(sel.skill, m) * 10) / 10}초`, 8, HK.dim));
      const ups = [...m.ups].filter(u => UPGRADES[u] && UPGRADES[u].skill === sel.skill).map(u => UPGRADES[u].name.split(': ').pop());
      L.add(hkText(this, DX + 10, BY + 44, sk.desc + (ups.length ? `\n강화: ${ups.join(' · ')}` : ''), 8.5, HK.ivory, { style: { wordWrap: { width: DW - 20, useAdvancedWrap: true }, lineSpacing: 2 } }));
      L.add(hkText(this, DX + DW / 2, BY + BH - 44, sel.slot ? `${sel.slot.toUpperCase()} 자리에 장착 중 · 다른 자리를 누르면 맞바꿈` : '배운 기술 · 넣을 자리를 누르세요', 8, sel.slot ? HK.gold : HK.dim, { origin: .5 }));
      slots.forEach((s, k) => {
        const here = sel.slot === s, ok = !here && (!combo || s === 'z') && !(sel.slot && !SKILLS[m.skills[s]].cd && sel.slot !== 'z');
        glassButton(this, DX + 8 + k * 64, BY + BH - 34, 60, 28, here ? `${s.toUpperCase()} 장착` : `${s.toUpperCase()} 자리`, () => this.invSetSkill(s), { size: 10, bold: true, layer: L, primary: ok }).setEnabled(ok);
      });
    } else if (sel) {
      const it = ITEMS[sel.id];
      L.add(this.itemImage(DX + 26, BY + 26, sel.id, 34, 2.2));
      L.add(hkText(this, DX + 50, BY + 10, it.name, 11, HK.ivory, { bold: true, style: { wordWrap: { width: DW - 58, useAdvancedWrap: true } } }));
      L.add(hkText(this, DX + 50, BY + 30, sel.from < 0 ? '가방에 있음' : `${p.formName(m)} 장착 중`, 8.5, sel.from < 0 ? HK.dim : HK.gold));
      L.add(hkText(this, DX + 10, BY + 52, it.desc, 9, HK.ivory, { style: { wordWrap: { width: DW - 20, useAdvancedWrap: true }, lineSpacing: 2 } }));
      const full = used >= MAX_EQUIP;
      const label = sel.from >= 0 ? '가방에 넣기' : full ? `장착 칸이 가득 (${used}/${MAX_EQUIP})` : `${p.formName(m)}에게 장착`;
      glassButton(this, DX + 8, BY + BH - 34, DW - 16, 28, label, () => this.invAction(), { size: 10, bold: true, layer: L, primary: sel.from < 0 && !full }).setEnabled(sel.from >= 0 || !full);
    } else {
      L.add(hkText(this, DX + DW / 2, BY + BH / 2, tab === 'skills' ? '기술을 누르면 설명과\nZ · X · C 자리 버튼이 나와요' : itemList.length ? '장착 칸이나 가방의 아이템을\n누르면 설명과 버튼이 나와요' : '아직 아이템이 없어요\n보스를 쓰러뜨리면 얻고,\n시내 자판기에서도 가끔 나와요', 9, HK.faint, { origin: .5, style: { align: 'center', lineSpacing: 5 } }));
    }
    if (!this.touch.visible) { const kl = a => keyLabel(Settings.key(a)); L.add(hkText(this, 320, 353, `${kl('bag')} · Esc 닫기  ·  ${kl('map')} 지도  ·  1~3 · Q / E 포켓몬  ·  Tab 도구↔기술  ·  ← → 고르기  ·  Enter 장착/빼기  ·  ${kl('z')} · ${kl('x')} · ${kl('c')} 기술 자리`, 7.5, HK.faint, { origin: .5 })); }
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'inv';
  }

  // 고른 기술을 slot 에 (다른 자리에 있으면 맞바꿈)
  invSetSkill(slot) {
    const sel = this.invSel, p = this.gs.player, m = p.members[this.invMember];
    if (!sel || !sel.skill) return;
    if (!p.setSkill(m, sel.skill, slot)) { Sfx.play('deny'); if (!SKILLS[sel.skill].cd && slot !== 'z') this.toast('연타 기술은 Z 자리 전용이에요'); return; }
    Sfx.play('item');
    this.showInv({ skill: sel.skill });
  }

  // 아이템 그림: 본가 가방 아이콘을 size 크기로 (못 받았으면 도트 아이콘을 fb 배로)
  itemImage(x, y, id, size, fb = 1) {
    const k = itemArt(this, id, size);
    return this.add.image(x, y, k || `it:${id}`).setScale(k ? 1 / RES : fb);
  }

  // 고른 아이템: 가방에 있으면 지금 보는 포켓몬에게 장착, 장착 칸에 있으면 가방에 넣기
  invAction() {
    const sel = this.invSel, p = this.gs.player, mi = this.invMember;
    if (!sel || sel.skill) return;
    const to = sel.from < 0 ? mi : -1;
    if (!p.moveItem(sel.id, sel.from, to)) { Sfx.play('deny'); if (to >= 0) this.toast(`장착 칸은 ${MAX_EQUIP}개까지예요 — 먼저 하나를 가방에 넣으세요`); return; }
    Sfx.play('item');
    this.showInv(to < 0 ? { id: sel.id, from: -1 } : null);
  }

  // ---------------- 설정 (O) ----------------
  //  [일반] 볼륨 · 소리 켬/끔 · 타격 흔들림 · 피격 흔들림 · UI 크기(터치 버튼) · 패드 투명도 · 터치패드 켬/끔
  //  [키 설정 (PC)] 동작마다 키 바꾸기 — 누르고 새 키를 누르면 끝 (다른 동작과 겹치면 서로 맞바꿈 · Esc 취소)
  //  슬라이더는 끌거나 누르거나 양옆 −/+ 로. 흔들림·볼륨은 손을 떼면 미리 한 번 흔들고/울린다 (뒤로 게임 화면이 비친다)
  //  키보드: ↑ ↓ 항목 (키 설정은 ← → 로 옆 줄) · ← → 조절 · Enter 켬/끔·키 바꾸기
  showSettings(focus = this.setFocus ?? 0) {
    const wait = this.keyWait;   // 다시 그려도 새 키 기다리기는 이어진다
    this.clearOverlay();
    this.keyWait = wait; if (wait) this.gs.keyCapture = true;
    this.toastT = 0;
    const g = this.gOver, L = this.overlay.setVisible(true), page = this.setPage || 'general', keys = page === 'keys';
    g.fillStyle(0x05040a, .78); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(hkText(this, 320, 21, '설정', 14, HK.ivory, { ls: 8, bold: true, origin: .5, glow: true }));
    this.overlayChrome(L, 'settings');
    const PX = 84, PW = 472, PY = 44, PH = 284;
    glassPanel(g, PX, PY, PW, PH, { alpha: .92 });
    [['general', '일반'], ['keys', '키 설정 (PC)']].forEach(([id, label], i) => {
      glassButton(this, PX + 12 + i * 106, PY + 8, 100, 24, label, () => { if (page !== id) { this.setPage = id; this.keyWait = null; this.gs.keyCapture = false; Sfx.play('select'); this.showSettings(0); } }, { size: 10, bold: true, layer: L, primary: page === id });
    });
    const reset = () => {
      if (keys) Settings.set('keys', { ...DEFAULT_KEYS }); else for (const k of ['volume', 'sound', 'shakeHit', 'shakeHurt', 'uiScale', 'padAlpha']) Settings.set(k, SETTING_DEFAULTS[k]);
      Sfx.play('select'); this.settingsMsg(keys ? '조작키를 처음대로 되돌렸어요' : '설정을 기본값으로 되돌렸어요', focus);
    };
    glassButton(this, PX + PW - 112, PY + 8, 100, 24, keys ? '기본 키로' : '기본값으로', reset, { size: 10, bold: true, layer: L });
    const rows = [];
    this.setRows = rows;
    if (keys) this.settingsKeys(L, g, rows, focus, PX, PW, PY, PH);
    else this.settingsGeneral(L, g, rows, focus, PX, PW, PY);
    this.setFocus = Phaser.Math.Clamp(focus, 0, rows.length - 1);
    const kl = a => keyLabel(Settings.key(a));
    const foot = keys ? (this.keyWait ? '바꿀 키를 누르세요   ·   Esc 취소' : '키를 누른 뒤 새 키를 누르세요  ·  다른 동작과 겹치면 서로 맞바꿔요  ·  ↑↓←→ 고르기 · Enter 바꾸기')
      : this.touch.visible ? '막대를 끌거나 − + 를 눌러 조절 · 흔들림은 손을 떼면 미리 보여 줘요'
      : `↑ ↓ 항목 · ← → 조절 · Enter 켬/끔   ·   ${kl('settings')} · Esc 닫기   ·   ${kl('map')} 지도 · ${kl('bag')} 가방`;
    const ft = hkText(this, 320, 342, foot, 8.5, this.keyWait ? HK.gold : HK.faint, { origin: .5, bold: !!this.keyWait }); L.add(ft);
    // 방금 바뀐 내용 알림 (토스트는 창 뒤에 가려지므로 아래 안내 줄 자리에 잠깐 띄운다)
    const msg = this.setMsg && this.time.now < this.setMsg.until ? this.setMsg : null;
    if (msg) {
      const mt = hkText(this, 320, 342, msg.text, 9, msg.bad ? '#ff9a8a' : HK.gold, { origin: .5, bold: true }); L.add(mt); ft.setVisible(false);
      this.time.delayedCall(msg.until - this.time.now, () => { if (mt.active) { mt.destroy(); ft.setVisible(true); } });
    }
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'settings';
  }
  settingsMsg(text, focus = this.setFocus, bad = false) { this.setMsg = { text, bad, until: this.time.now + 3200 }; this.showSettings(focus); }

  // [일반] 슬라이더 · 켬/끔 줄
  settingsGeneral(L, g, rows, focus, PX, PW, PY) {
    const touch = this.touch;
    const label = (y, title, sub) => {
      L.add(hkText(this, PX + 22, sub ? y - 7 : y, title, 11, HK.ivory, { bold: true, origin: [0, .5] }));
      if (sub) L.add(hkText(this, PX + 22, y + 8, sub, 8, HK.dim, { origin: [0, .5] }));
    };
    const focusMark = y => { g.fillStyle(0xffd27a, .07); g.fillRoundedRect(PX + 8, y - 15, PW - 16, 30, 8); g.fillStyle(HK.goldN, .9); g.fillRect(PX + 10, y - 9, 2, 18); };
    const preview = key => {
      if (key === 'volume') Sfx.play('hit_normal');
      else if (key === 'shakeHit') this.gs.fx.shake(.012, 280, 'hit');
      else if (key === 'shakeHurt') this.gs.fx.shake(.012, 280, 'world');
    };
    // 슬라이더 한 줄: 라벨 · − · 막대(끌기) · + · 값
    const TX = 300, TW = 164;
    const slider = (y, key, title, sub, min, max, step, fmt) => {
      const row = rows.length;
      if (row === focus) focusMark(y);
      label(y, title, sub);
      const gs = this.add.graphics(); L.add(gs);
      const val = hkText(this, PX + PW - 14, y, '', 10.5, HK.gold, { bold: true, origin: [1, .5] }); L.add(val);
      const draw = () => {
        const v = Settings.get(key), k = (v - min) / (max - min), x1 = TX + TW * k;
        gs.clear();
        gs.fillStyle(0x000000, .5); gs.fillRoundedRect(TX, y - 3, TW, 6, 3);
        gs.fillStyle(HK.goldN, .85); gs.fillRoundedRect(TX, y - 3, Math.max(6, TW * k), 6, 3);
        gs.lineStyle(1, HK.ivoryN, .25); gs.strokeRoundedRect(TX, y - 3, TW, 6, 3);
        if (key === 'uiScale' || key.startsWith('shake')) { const one = TX + TW * ((1 - min) / (max - min)); gs.fillStyle(HK.ivoryN, .5); gs.fillRect(one - .5, y - 7, 1, 14); }   // 기본값(100%) 눈금
        gs.fillStyle(0x07060c, 1); gs.fillCircle(x1, y, 9); gs.lineStyle(2, HK.goldN, 1); gs.strokeCircle(x1, y, 9);
        gs.fillStyle(0xffffff, .6); gs.fillCircle(x1 - 2, y - 2, 2.5);
        val.setText(fmt(v));
      };
      const setV = v => { v = Math.round(Phaser.Math.Clamp(Math.round(v / step) * step, min, max) * 100) / 100; Settings.set(key, v); draw(); };
      glassButton(this, TX - 34, y - 13, 26, 26, '−', () => { setV(Settings.get(key) - step); preview(key); this.setFocus = row; }, { size: 13, bold: true, layer: L });
      glassButton(this, TX + TW + 10, y - 13, 26, 26, '+', () => { setV(Settings.get(key) + step); preview(key); this.setFocus = row; }, { size: 13, bold: true, layer: L });
      const z = this.add.zone(TX - 8, y - 15, TW + 16, 30).setOrigin(0).setInteractive({ useHandCursor: true }); L.add(z);
      const fromPointer = p => setV(min + Phaser.Math.Clamp((p.x / RES - TX) / TW, 0, 1) * (max - min));
      z.on('pointerdown', p => { this.setDrag = { fromPointer, key }; this.setFocus = row; fromPointer(p); });
      rows.push({ adjust: d => { setV(Settings.get(key) + d * step); preview(key); } });
      draw();
    };
    // 켬/끔 한 줄
    const toggle = (y, title, sub, get, flip) => {
      const row = rows.length, on = get();
      if (row === focus) focusMark(y);
      label(y, title, sub);
      const act = () => { flip(); Sfx.play('select'); this.showSettings(row); };
      glassButton(this, TX - 34, y - 13, 96, 26, on ? '켬' : '끔', act, { size: 11, bold: true, layer: L, primary: on });
      rows.push({ adjust: act, toggle: act });
    };
    const pct = v => `${Math.round(v * 100)}%`, Y0 = PY + 56, DY = 31;
    slider(Y0, 'volume', '볼륨', '효과음 · 컷신 영상', 0, 1, .1, v => v <= 0 ? '음소거' : pct(v));
    toggle(Y0 + DY, '소리', 'N 키로도 켜고 끈다', () => Settings.get('sound'), () => Settings.set('sound', !Settings.get('sound')));
    slider(Y0 + DY * 2, 'shakeHit', '타격 흔들림', '내 공격이 맞을 때 카메라 흔들림', 0, 1.5, .1, v => v <= 0 ? '끔' : pct(v));
    slider(Y0 + DY * 3, 'shakeHurt', '피격 흔들림', '내가 맞을 때 · 보스 공격 · 폭발', 0, 1.5, .1, v => v <= 0 ? '끔' : pct(v));
    slider(Y0 + DY * 4, 'uiScale', 'UI 크기', '터치 조이스틱 · 버튼 크기 (닫으면 적용)', .8, 1.4, .1, pct);
    slider(Y0 + DY * 5, 'padAlpha', '패드 투명도', '터치 패드가 화면을 덜 가리게 (닫으면 적용)', 0, 1, .1, v => v <= 0 ? '안 보임' : pct(v));
    toggle(Y0 + DY * 6, '터치패드', '화면 조이스틱 · 버튼 (위쪽 🎮 버튼)', () => touch.visible, () => { touch.setVisible(!touch.visible); try { localStorage.setItem('pokecells.touchpad', touch.visible ? 'on' : 'off'); } catch (e) { /* 이번 판만 */ } this.applyTouchLayout(); });
    // 끌기: 막대를 누른 채 움직이면 따라오고, 떼면 미리보기
    const move = p => { if (this.setDrag && p.isDown) this.setDrag.fromPointer(p); };
    const up = () => { if (this.setDrag) { preview(this.setDrag.key); this.setDrag = null; } };
    this.input.on('pointermove', move); this.input.on('pointerup', up);
    this.offSettings = () => { this.input.off('pointermove', move); this.input.off('pointerup', up); this.setDrag = null; };
  }

  // [키 설정 (PC)] 두 줄로 동작 · 지금 키 — 누르면 새 키를 기다린다
  settingsKeys(L, g, rows, focus, PX, PW, PY, PH) {
    const n = KEY_ACTIONS.length, half = Math.ceil(n / 2);
    KEY_ACTIONS.forEach(([act, label], i) => {
      const col = Math.floor(i / half), r = i % half, x = PX + 18 + col * 228, y = PY + 52 + r * 24, on = i === focus, wait = this.keyWait === act;
      if (on) { g.fillStyle(0xffd27a, .07); g.fillRoundedRect(x - 8, y - 11, 220, 22, 6); g.fillStyle(HK.goldN, .9); g.fillRect(x - 6, y - 7, 2, 14); }
      L.add(hkText(this, x, y, label, 9.5, on ? HK.ivory : HK.dim, { bold: on, origin: [0, .5] }));
      const start = () => { this.setFocus = i; this.keyWait = act; this.gs.keyCapture = true; Sfx.play('select'); this.showSettings(i); };
      glassButton(this, x + 136, y - 10, 72, 20, wait ? '…누르세요' : keyLabel(Settings.key(act)), start, { size: wait ? 8.5 : 10, bold: true, layer: L, primary: wait });
      rows.push({ toggle: start });
    });
    L.add(hkText(this, 320, PY + PH - 14, '바꿀 수 없는 키   1 · 2 · 3 포켓몬   ·   Esc · P 일시정지 (창 닫기)   ·   N 소리', 8.5, HK.faint, { origin: .5 }));
  }

  // 키 설정에서 새 키를 기다리는 중 누른 키
  captureKey(e) {
    const act = this.keyWait, name = keyNameFromEvent(e);
    if (e.code === 'Escape' || name === 'ESC') { this.keyWait = null; this.gs.keyCapture = 'last'; Sfx.play('select'); this.showSettings(this.setFocus); return; }
    if (!name || FIXED_KEYS.has(name)) { Sfx.play('deny'); this.settingsMsg('그 키는 쓸 수 없어요 (1~3 · Esc · P · N · F1~F12 는 고정)  ·  다른 키를 누르세요 · Esc 취소', this.setFocus, true); return; }
    const old = Settings.key(act), other = Settings.bindKey(act, name);
    const label = a => KEY_ACTIONS.find(k => k[0] === a)[1];
    this.keyWait = null; this.gs.keyCapture = 'last';   // UI 가 게임보다 먼저 키를 받으므로, 같은 프레임에 게임이 이 키를 한 번 더 삼키고 끝낸다
    Sfx.play('item');
    this.settingsMsg(other ? `${label(act)} → ${keyLabel(name)}   ·   겹치던 「${label(other)}」 키는 ${keyLabel(old)}(으)로 바꿨어요` : `${label(act)} → ${keyLabel(name)}`);
  }

  // 아이템 효과 한 줄 요약
  modsText(md) {
    const fx = [];
    if (md.all > 1) fx.push(`모든 피해 ×${md.all.toFixed(1)}`);
    for (const [ty, v] of Object.entries(md.typeBoost)) if (v > 0) fx.push(`${typeName(ty)} +${Math.round(v * 100)}%`);
    if (md.crit) fx.push(`급소 +${Math.round(md.crit * 100)}%`);
    if (md.cdMul < 1) fx.push(`쿨타임 ×${md.cdMul.toFixed(2)}`);
    if (md.extraProj) fx.push(`투사체 +${md.extraProj}`);
    if (md.sizeMul > 1) fx.push(`판정 ×${md.sizeMul.toFixed(1)}`);
    if (md.lifesteal) fx.push(`흡혈 ${Math.round(md.lifesteal * 100)}%`);
    if (md.regen) fx.push(`재생 ${(md.regen * 100).toFixed(1)}%/초`);
    if (md.swapCdMul < 1) fx.push(`교대 ×${md.swapCdMul.toFixed(2)}`);
    return fx.join(' · ');
  }

  // 지도·가방·설정 공통 머리: 왼쪽 위 큼직한 탭(누르면 바로 전환) + 오른쪽 위 닫기 — 손가락으로도 누르기 쉽게
  overlayChrome(L, kind) {
    const keys = !this.touch.visible;   // 키보드로 하면 단축키도 같이
    [['지도', keyLabel(Settings.key('map')), 'map'], ['가방', keyLabel(Settings.key('bag')), 'inv'], ['설정', keyLabel(Settings.key('settings')), 'settings']].forEach(([label, key, k], i) => {
      const on = k === kind;
      glassButton(this, 14 + i * 86, 6, 80, 30, keys ? `${label}  ${key}` : label, () => { if (!on) this.gs.toggleOverlay(k); }, { size: 11.5, bold: true, ls: 2, layer: L, primary: on });
    });
    glassButton(this, 548, 6, 80, 30, keys ? '✕  닫기  Esc' : '✕  닫기', () => this.gs.toggleOverlay(kind), { size: keys ? 9.5 : 11, bold: true, layer: L });
  }

  showResult(r) {
    this.clearOverlay();
    const g = this.gOver, L = this.overlay.setVisible(true);
    g.fillStyle(0x05040a, .9); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(hkText(this, 320, 44, r.won ? '심연 정화 완료' : '눈앞이 캄캄해졌다…', 26, r.won ? HK.gold : HK.ivory, { ls: 4, bold: true, origin: .5, glow: true }));
    L.add(fadeLine(this, 320, 70, 340));
    L.add(hkText(this, 320, 86, r.won ? '무한다이노를 쓰러뜨리고 다섯 지방을 모두 정화했다' : `${r.stage}장 · ${r.stageName}에서 여정을 멈췄다`, 10, HK.dim, { origin: .5 }));
    const mm = Math.floor(r.time / 60), ss = String(Math.floor(r.time % 60)).padStart(2, '0');
    const rows = [['도달 챕터', `${r.stage} / ${STAGES.length}`], ['정화한 포켓몬', `${r.kills}마리`], ['획득 아이템', `${r.items}개`], ['플레이 시간', `${mm}:${ss}`]];
    rows.forEach(([k, v], i) => {
      const y = 106 + i * 20, kt = hkText(this, 206, y, k, 11, HK.dim), vt = hkText(this, 434, y, v, 11, HK.ivory, { bold: true, origin: [1, 0] });
      L.add([kt, vt]);
      g.fillStyle(HK.faintN, .7);
      for (let x = kt.x + kt.width + 6; x < vt.x - vt.width - 6; x += 4) g.fillCircle(x, y + 9, .6);   // 점선 안내선
    });
    L.add(hkText(this, 320, 196, '새로 도감에 등록', 9, HK.dim, { ls: 2, origin: .5 }));
    if (r.unlocked.length) r.unlocked.forEach((k, i) => {
      const x = 320 + (i - (r.unlocked.length - 1) / 2) * 58;
      L.add([this.add.image(x, 228, roundPortrait(this, k)), hiImage(this, x, 228, 'gloss'), hiImage(this, x, 228, 'slot3d-gold'), hkText(this, x, 254, SPECIES[k].name, 10, HK.gold, { origin: [.5, 0] })]);
    });
    else L.add(hkText(this, 320, 224, '— 없음 —', 10, HK.faint, { origin: .5 }));
    L.add(fadeLine(this, 320, 280, 240, .5));
    this.menu = hkMenu(this, 320, 304, [{ label: '도감으로 돌아가기', onPick: () => this.leave() }], { layer: L, size: 12 });
    L.add(hkText(this, 320, 328, 'Enter · 클릭', 9, HK.faint, { origin: .5 }));
    this.overlayMode = 'result';
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.time.delayedCall(600, () => this.input.once('pointerdown', () => this.leave()));
    Sfx.play(r.won ? 'unlock' : 'hurt');
  }

  // ---------------- 포켓몬 보관함 (포켓몬센터 · 엔트리 교체) ----------------
  //  아래 엔트리 칸을 눌러 바꿀 자리를 고르고, 위 보관함에서 카드를 두 번 누르면 그 자리에 들어간다 (새로 온 포켓몬은 1단부터)
  showBox() {
    this.clearOverlay();
    const gs = this.gs, p = gs.player, g = this.gOver, L = this.overlay.setVisible(true);
    g.fillStyle(0x05040a, .95); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(hkText(this, 320, 12, '포켓몬 보관함', 14, HK.ivory, { ls: 4, bold: true, origin: [.5, 0], glow: true }));
    L.add(hkText(this, 320, 32, '새로 데려온 포켓몬은 1단부터 · 떠나는 포켓몬의 장착 아이템은 가방으로 · 메가스톤·Z크리스탈은 파티 공용', 8.5, HK.dim, { origin: [.5, 0] }));
    if (this.boxSlot === undefined || this.boxSlot > p.members.length) this.boxSlot = p.idx;
    const bar = this.add.container(0, 0); L.add(bar);
    const drawBar = () => {
      bar.removeAll(true);
      bar.add(fadeLine(this, 320, 304, 600, .35));
      bar.add(hkText(this, 40, 326, '엔트리', 10, HK.dim, { bold: true, ls: 2, origin: .5 }));
      [0, 1, 2].forEach(i => {
        const m = p.members[i], sx = 92 + i * 46, sy = 326, sel = i === this.boxSlot;
        if (sel) bar.add(this.add.image(sx, sy, 'glow').setBlendMode(ADD).setTint(0xffd890).setScale(.8).setAlpha(.45));
        if (m) bar.add(this.add.image(sx, sy, roundPortrait(this, p.portraitKey(m))).setScale(.7).setAlpha(m.alive ? 1 : .4));
        bar.add(hiImage(this, sx, sy, 'gloss').setScale(.7 / RES));
        bar.add(hiImage(this, sx, sy, sel ? 'slot3d-gold' : 'slot3d').setScale(.7 / RES).setAlpha(m || sel ? 1 : .4));
        bar.add(hkText(this, sx - 12, sy - 14, String(i + 1), 8, sel ? HK.gold : HK.faint, { bold: true, origin: .5 }));
        const z = this.add.zone(sx, sy, 36, 36).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => { this.boxSlot = Math.min(i, p.members.length); Sfx.play('select'); drawBar(); });
        bar.add(z);
      });
      const cur = p.members[this.boxSlot];
      bar.add(hkText(this, 400, 326, `${this.boxSlot + 1}번 자리${cur ? ` (${p.formName(cur)})` : ' (빈 자리)'}에 넣을 포켓몬을 고르세요\n카드 두 번 누르기 · Enter  ·  ←→↑↓ · Q/E 탭  ·  Esc 닫기`, 8.5, HK.dim, { origin: .5, style: { align: 'center', lineSpacing: 3 } }));
    };
    this.boxPanel = new RosterPanel(this, {
      layer: L, x: 16, y: 52, h: 244, infoX: 392, infoW: 234, focus: p.m.key,
      picked: k => p.members.findIndex(m => m.key === k),
      onToggle: k => {
        if (!Save.isUnlocked(k)) { Sfx.play('deny'); this.toast('아직 합류하지 않은 포켓몬이다'); return; }
        if (p.members.some(m => m.key === k)) { Sfx.play('deny'); this.toast('이미 파티에 있다'); return; }
        p.replaceMember(this.boxSlot, k); Save.setParty(p.members.map(m => m.key));
        Sfx.play('swap'); this.toast(`${SPECIES[k].name}이(가) ${this.boxSlot + 1}번 자리에 들어왔다!`);
        this.boxPanel.build(); drawBar();
      }
    });
    drawBar();
    glassButton(this, 566, 8, 64, 20, '✕  닫기', () => gs.toggleOverlay('box'), { size: 9, layer: L });
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'box';
  }

  onOverlayKey(e) {
    if (this.overlayMode === 'box' && this.boxPanel) { this.boxPanel.key(e); return; }
    const digit = /^(Digit|Numpad)[1-5]$/.test(e.code) ? +e.code.slice(-1) - 1 : -1;
    if (this.overlayMode === 'map' && this.mapView) {
      if (digit >= 0) { if (this.mapOpen(digit) && digit !== this.mapCi) { Sfx.play('select'); this.showMap(digit); } return; }
      this.mapView.key(e); return;
    }
    if (this.overlayMode === 'settings') {
      if (this.keyWait) { this.captureKey(e); return; }
      const rows = this.setRows || [], f = this.setFocus || 0;
      if (this.setPage === 'keys') {   // 키 설정: ↑↓ 같은 줄 · ←→ 옆 줄 · Enter 바꾸기
        const half = Math.ceil(rows.length / 2);
        if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { Sfx.play('select'); this.showSettings((f + (e.code === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length); }
        else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { const t = f + (e.code === 'ArrowRight' ? half : -half); if (t >= 0 && t < rows.length) { Sfx.play('select'); this.showSettings(t); } }
        else if ((e.code === 'Enter' || e.code === 'Space') && rows[f]) rows[f].toggle();
        return;
      }
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { Sfx.play('select'); this.showSettings((f + (e.code === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length); }
      else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && rows[f]) { rows[f].adjust(e.code === 'ArrowRight' ? 1 : -1); if (rows[f].toggle) return; this.showSettings(f); }
      else if ((e.code === 'Enter' || e.code === 'Space') && rows[f] && rows[f].toggle) rows[f].toggle();
      return;
    }
    if (this.overlayMode === 'taxi') {
      if (e.code.startsWith('Arrow')) this.taxiMove(e);
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyF') this.taxiPick(this.taxiSel);
      return;
    }
    if (this.overlayMode === 'debug') {
      const n = (this.dbgRooms || []).length, COL = Math.ceil(n / 2), i = this.dbgSel;
      if (digit >= 0) { Sfx.play('select'); this.showDebug(digit, 0); }
      else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { Sfx.play('select'); this.showDebug(this.dbgCi, (i + (e.code === 'ArrowDown' ? 1 : -1) + n) % n); }
      else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { const j = i < COL ? i + COL : i - COL; if (j >= 0 && j < n) { Sfx.play('select'); this.showDebug(this.dbgCi, j); } }
      else if (e.code === 'Enter' || e.code === 'Space') this.debugPick(i);
      else if (e.code === 'KeyR') { const r = this.dbgRooms[i]; if (r) { this.gs.debugRefight(this.dbgCi, r.id); Sfx.play('select'); this.showDebug(this.dbgCi, i); } }
      return;
    }
    if (this.overlayMode === 'inv') {
      const list = this.invList || [], sel = this.invSel, n = this.gs.player.members.length;
      const i = list.findIndex(s => sel && (s.skill ? s.skill === sel.skill : !sel.skill && s.id === sel.id && s.from === sel.from && (s.from < 0 || s.k === sel.k)));
      if (e.code === 'Tab') { Sfx.play('select'); this.invTab = this.invTab === 'skills' ? 'items' : 'skills'; this.showInv(null); return; }
      const slotKey = ['z', 'x', 'c'].find(sl => keyNameFromEvent(e) === Settings.key(sl));
      if (sel && sel.skill && slotKey) { this.invSetSkill(slotKey); return; }
      if ((e.code === 'ArrowRight' || e.code === 'ArrowLeft') && list.length) { Sfx.play('select'); this.showInv(list[(i + (e.code === 'ArrowRight' ? 1 : -1) + list.length) % list.length]); }
      else if (/^(Digit|Numpad)[1-3]$/.test(e.code)) { const k = +e.code.slice(-1) - 1; if (k < n) { Sfx.play('select'); this.invMember = k; this.showInv(null); } }
      else if (e.code === 'KeyQ' || e.code === 'KeyE') { Sfx.play('select'); this.invMember = (this.invMember + (e.code === 'KeyE' ? 1 : n - 1)) % n; this.showInv(null); }
      else if (e.code === 'Enter' || e.code === 'Space') this.invAction();
      return;
    }
    if (this.overlayMode === 'tm') {
      const it = this.gs.tmActive, n = /^(Digit|Numpad)[1-3]$/.test(e.code) ? +e.code.slice(-1) : 0;
      if (!it) return;
      if (this.tmSlot) {
        const sl = n ? ['z', 'x', 'c'][n - 1] : ['z', 'x', 'c'].find(s2 => keyNameFromEvent(e) === Settings.key(s2)) || null;
        if (sl) this.tmChooseSlot(sl);
        else if (e.code === 'Backspace') { this.tmSlot = false; this.showTM(); }
        return;
      }
      if (n) this.tmPress(n - 1);
      else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && it.flipped.every(Boolean)) { it.sel = ((it.sel < 0 ? 0 : it.sel + (e.code === 'ArrowRight' ? 1 : -1)) + 3) % 3; Sfx.play('select'); this.showTM(); }
      else if (e.code === 'Enter' || e.code === 'Space') this.tmConfirm();
      return;
    }
    if (this.overlayMode === 'pause' && e.code === 'KeyL') { this.gs.paused = false; this.gs.gameOver(false, true); return; }
    if (this.menu) this.menu.key(e);
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.clearOverlay();
    this.gs.backToLobby();
  }
}
