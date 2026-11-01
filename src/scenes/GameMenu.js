// 메뉴 (I · 화면 왼쪽 위 초상화): 4탭 풀스크린 — 🐾 포켓몬 · ⚔️ 기술 & 카드 · 🎒 가방 · 📖 정화 도감
//  예전엔 가방 창 하나에 능력치·도구·기술이 엉켜 있었다 → 탭마다 한 가지 일만 (UIScene.showInv 가 이 모듈의 showInv)
//  꾸밈: 깊은 반투명 다크 글라스 · 금빛/청록 포인트 선 · 탭을 바꾸면 밑줄이 미끄러지고 내용이 옆에서 밀려 들어온다
//  키보드: Q / E 탭 · 1~3 포켓몬 · ← → 고르기 · Enter 실행 · (기술 탭) Z · X · C 고른 기술을 그 자리에 · Esc 닫기
import Phaser from 'phaser';
import { GAME_W, GAME_H, RES, txt } from '../config.js';
import { SKILLS, SPECIES, TIERS, EVO_EXP, TAGS, DEX_ORDER, UNLOCKABLE, UNLOCK_KILLS } from '../data/pokemon.js';
import { ITEMS, MAX_EQUIP } from '../data/items.js';
import { STAGES } from '../data/stages.js';
import { TYPES, typeName, typeColor, typeMultiplier, matchups } from '../data/types.js';
import { UPGRADES, GRADE_STYLE } from '../data/tm.js';
import { PERKS } from '../game/Perks.js';
import { MOVE_DB } from '../data/MoveDatabase.js';
import { usesStone, stoneName, zTypeOf, crystalName } from '../data/gear.js';
import { MEGA_ULT, MEGA_ULT_CD, megaSymbol } from '../game/Spectacle.js';
import { HK, hkText, glassPanel, glassButton, typePill, hiImage, bar3d } from '../systems/ui.js';
import { roundPortrait, skillIcon } from '../systems/Textures.js';
import { Sprites } from '../systems/SpriteLoader.js';
import { Save } from '../systems/Save.js';
import { Sfx } from '../systems/Audio.js';
import { Settings, keyLabel, keyNameFromEvent } from '../systems/Settings.js';

const ADD = Phaser.BlendModes.ADD;
const CYAN = 0x48e5ff, PINK = 0xff6ac0;
const TABS = [['mon', '🐾 포켓몬', 'STATUS & PARTY'], ['skill', '⚔️ 기술 & 카드', 'SKILLS & TM DECK'], ['bag', '🎒 가방', 'INVENTORY & RELICS'], ['dex', '📖 정화 도감', 'CODEX']];
const TAB_W = 150, TAB_X = i => 16 + i * (TAB_W + 4), CY = 80, CH = 262;   // 내용 영역: y 80 ~ 342
const BAG_FILTERS = [['all', '전체'], ['use', '소비'], ['tool', '도구'], ['stone', '메가스톤'], ['crystal', 'Z크리스탈']];

// 육각 소켓 (장착 칸)
function hex(g, cx, cy, r, fill, fa, line, la, lw = 1.2) {
  const pts = [];
  for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
  g.fillStyle(fill, fa); g.fillPoints(pts, true);
  g.lineStyle(lw, line, la); g.strokePoints(pts, true);
}
// 금빛 → 청록 포인트 선
function accent(g, x, y, w, a = .7) {
  g.fillGradientStyle(HK.goldN, CYAN, HK.goldN, CYAN, a, a, a, a); g.fillRect(x, y, w, 1);
}
// 한 줄 요약 글자 (넘치면 가로로 줄인다)
function fitText(t, w) { if (t.width > w) t.setScale(w / t.width, 1); return t; }

export const GameMenu = {
  showInv(sel) {
    this.clearOverlay();
    const gs = this.gs, p = gs.player, g = this.gOver, L = this.overlay.setVisible(true);
    if (this.invMember == null || !p.members[this.invMember]) this.invMember = p.idx;
    const tab = this.menuTab || (this.menuTab = 'mon'), prev = this.menuDrawn;
    this.menuDrawn = tab;
    if (sel !== undefined) this.menuSel = sel;
    this.menuChrome(L, g, tab, prev);
    const C = this.add.container(0, 0); L.add(C);
    ({ mon: this.menuMon, skill: this.menuSkill, bag: this.menuBag, dex: this.menuDex })[tab].call(this, C, g, p);
    if (prev && prev !== tab) {   // 탭 슬라이드: 내용이 옆에서 밀려 들어온다
      const dir = TABS.findIndex(t => t[0] === tab) > TABS.findIndex(t => t[0] === prev) ? 1 : -1;
      C.x = dir * 22; C.alpha = 0;
      this.tweens.add({ targets: C, x: 0, alpha: 1, duration: 240, ease: 'Cubic.easeOut' });
    }
    if (!this.touch.visible) L.add(hkText(this, 320, 353, `Q / E 탭  ·  1~3 포켓몬  ·  ← → 고르기  ·  Enter 실행${tab === 'skill' ? `  ·  ${keyLabel(Settings.key('z'))} · ${keyLabel(Settings.key('x'))} · ${keyLabel(Settings.key('c'))} 기술 자리` : ''}  ·  ${keyLabel(Settings.key('bag'))} · Esc 닫기`, 7.5, HK.faint, { origin: .5 }));
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'inv';
  },

  // ---------------- 바탕 · 탭 ----------------
  menuChrome(L, g, tab, prev) {
    g.fillStyle(0x04030a, .95); g.fillRect(0, 0, GAME_W, GAME_H);
    g.fillGradientStyle(0x1c1636, 0x0e1a2a, 0x04030a, 0x04030a, .7, .7, 0, 0); g.fillRect(0, 0, GAME_W, 96);   // 위에서 번지는 남보라 · 청록 빛
    g.fillGradientStyle(0x04030a, 0x04030a, 0x120e22, 0x0a1620, 0, 0, .6, .6); g.fillRect(0, GAME_H - 70, GAME_W, 70);
    this.overlayChrome(L, 'inv');
    TABS.forEach(([id, label, en], i) => {
      const x = TAB_X(i), on = id === tab;
      glassPanel(g, x, 40, TAB_W, 32, { r: 8, fill: on ? 0x1e1a34 : 0x0c0b16, border: on ? HK.goldN : HK.ivoryN, borderAlpha: on ? .7 : .18, alpha: .95 });
      L.add(hkText(this, x + TAB_W / 2, 50, label, 10.5, on ? HK.ivory : HK.dim, { bold: on, origin: .5, glow: on }));
      L.add(hkText(this, x + TAB_W / 2, 64, en, 6.5, on ? HK.gold : HK.faint, { origin: .5, ls: 1.5 }));
      const z = this.add.zone(x, 40, TAB_W, 32).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.menuGo(id));
      L.add(z);
    });
    // 밑줄: 지난 탭 자리에서 미끄러져 온다
    const ti = TABS.findIndex(t => t[0] === tab), pi = prev ? TABS.findIndex(t => t[0] === prev) : ti;
    const ul = this.add.rectangle(TAB_X(pi) + 14, 73, TAB_W - 28, 2, HK.goldN).setOrigin(0, .5);
    const ug = this.add.image(TAB_X(pi) + TAB_W / 2, 73, 'glow').setBlendMode(ADD).setTint(CYAN).setScale(1.6, .12).setAlpha(.8);
    L.add([ug, ul]);
    if (pi !== ti) { this.tweens.add({ targets: ul, x: TAB_X(ti) + 14, duration: 260, ease: 'Cubic.easeOut' }); this.tweens.add({ targets: ug, x: TAB_X(ti) + TAB_W / 2, duration: 260, ease: 'Cubic.easeOut' }); }
  },
  menuGo(tab) {
    if (tab === this.menuTab) return;
    Sfx.play('select');
    this.menuTab = tab;
    this.showInv(null);
  },
  // 포켓몬 고르기 (1~3): 작은 초상화 칩
  menuChips(C, g, p, x, y, w = 72) {
    p.members.forEach((pm, i) => {
      const cx = x + i * (w + 4), on = i === this.invMember;
      glassPanel(g, cx, y, w, 26, { r: 7, fill: on ? 0x24203a : 0x0e0c18, border: on ? HK.goldN : HK.ivoryN, borderAlpha: on ? .75 : .2, alpha: .95 });
      C.add(this.add.image(cx + 14, y + 13, roundPortrait(this, p.portraitKey(pm))).setScale(.48).setAlpha(pm.alive ? 1 : .4));
      C.add(fitText(hkText(this, cx + 27, y + 13, `${i + 1} ${p.formName(pm)}`, 8, on ? HK.gold : HK.dim, { bold: on, origin: [0, .5] }), w - 32));
      if (i === p.idx) { g.fillStyle(HK.goldN, .95); g.fillCircle(cx + w - 6, y + 6, 2.2); }
      const z = this.add.zone(cx, y, w, 26).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { if (this.invMember !== i) { Sfx.play('select'); this.invMember = i; this.showInv(null); } });
      C.add(z);
    });
  },

  // ================= 🐾 포켓몬: 큰 도트 · 진화 단계 · 상성 / 능력치 · 장착 소켓 =================
  menuMon(C, g, p) {
    const m = p.members[this.invMember], sp = m.sp, Tm = TIERS[p.tierOf(m)], sel = this.menuSel || {};
    // ── 왼쪽: 쇼케이스
    glassPanel(g, 16, CY, 226, CH, { alpha: .9, border: HK.goldN, borderAlpha: .25 });
    this.menuChips(C, g, p, 22, CY + 6);
    const cx = 129, foot = CY + 150;
    const halo = this.add.image(cx, foot - 36, 'glow').setBlendMode(ADD).setTint(typeColor(p.typesOf(m)[0])).setScale(2.1).setAlpha(.32);
    C.add([halo, this.add.image(cx, foot + 2, 'glow').setTint(0x000000).setScale(1.5, .22).setAlpha(.6)]);
    this.tweens.add({ targets: halo, alpha: .18, scale: 2.4, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    g.lineStyle(1, HK.goldN, .35); g.strokeEllipse(cx, foot + 2, 92, 14); g.lineStyle(1, CYAN, .2); g.strokeEllipse(cx, foot + 2, 70, 9);
    const fk = m.mega ? (p.megaOf(m).sprite || p.form(m).key) : p.form(m).key, metas = this.registry.get('spriteMeta') || {}, meta = metas[fk];
    const place = this.add.image(cx, foot - 34, roundPortrait(this, p.portraitKey(m))).setScale(1.4).setAlpha(m.alive ? 1 : .45);
    C.add(place);
    if (meta && meta.hasSprite && meta.anims.Idle) Sprites.ensure([fk]).then(() => {
      if (!place.scene || this.menuTab !== 'mon') return;
      const a = meta.anims.Idle, tex = `sheet:${fk}:${a.src}`;
      if (!this.textures.exists(tex)) return;
      const spr = this.add.sprite(cx, foot, tex).setOrigin(.5, a.oy).setScale(Phaser.Math.Clamp(78 / Math.max(10, meta.height || 30), 1.4, 4)).setAlpha(m.alive ? 1 : .45);
      if (this.anims.exists(`${fk}:Idle:right`)) spr.play(`${fk}:Idle:right`);
      C.addAt(spr, C.getIndex(place)); place.destroy();
    });
    C.add(fitText(hkText(this, cx, foot + 14, p.formName(m), 14, m.alive ? '#fff2c8' : HK.faint, { bold: true, origin: .5, glow: true, glowColor: 'rgba(255,216,144,0.5)' }), 200));
    C.add(hkText(this, cx, foot + 30, `${Tm.name}${m.mega ? ' ★' : ''}  ·  ${m.alive ? (this.invMember === p.idx ? '출전 중' : '대기') : '기절'}`, 8.5, m.mega ? '#ff9ad8' : HK.gold, { bold: true, origin: .5 }));
    {   // 속성 배지 (가운데)
      const ts = p.typesOf(m), ws = ts.map(ty => { const t = hkText(this, 0, 0, typeName(ty), 8, '#fff', { bold: true }); const w = Math.round(t.width) + 14; t.destroy(); return w; });
      let x = cx - (ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 4) / 2;
      ts.forEach((ty, i) => { typePill(this, C, x, foot + 40, ty, 8); x += ws[i] + 4; });
    }
    // 상성 요약: 약점(이 포켓몬이 크게 맞는 속성) · 강점(이 포켓몬의 속성이 크게 때리는 속성)
    const ts = p.typesOf(m), weak = Object.keys(TYPES).filter(t => typeMultiplier(t, ts) >= 2);
    const strong = [...new Set(ts.flatMap(t => matchups(t).strong))];
    const row = (y, label, list, col) => {
      C.add(hkText(this, 26, y, label, 8, col, { bold: true, origin: [0, .5] }));
      let x = 58;
      for (const t of list.slice(0, 6)) { g.fillStyle(typeColor(t), .95); g.fillRoundedRect(x, y - 6, 26, 12, 6); C.add(hkText(this, x + 13, y, typeName(t), 6.5, '#ffffff', { bold: true, origin: .5 })); x += 29; }
      if (list.length > 6) C.add(hkText(this, x + 2, y, `+${list.length - 6}`, 7, HK.dim, { origin: [0, .5] }));
      if (!list.length) C.add(hkText(this, x, y, '없음', 7.5, HK.faint, { origin: [0, .5] }));
    };
    row(CY + 230, '약점', weak, '#ff9a8a');
    row(CY + 248, '강점', strong, '#9ae8ff');

    // ── 오른쪽: 능력치 · 장착 소켓
    const RX = 250, RW = 374;
    glassPanel(g, RX, CY, RW, CH, { alpha: .9, border: CYAN, borderAlpha: .18 });
    C.add(hkText(this, RX + 14, CY + 12, '능력치', 9.5, HK.gold, { bold: true, ls: 2, origin: [0, .5] }));
    accent(g, RX + 14, CY + 22, 200);
    const atk = sp.atk * Tm.atk * (m.mods.atkMul || 1) * (m.atkBonus || 1), spd = sp.speed * (m.mega ? 1.1 : 1) * (m.mods.speedMul || 1);
    const stats = [['체력', m.hp, m.maxhp, 420, `${Math.ceil(m.hp)} / ${m.maxhp}`, m.hp / m.maxhp > .25 ? 0x6ae08a : 0xff6a6a],
      ['공격', atk, atk, 40, (Math.round(atk * 10) / 10).toFixed(1), 0xff9a5a], ['속도', spd, spd, 170, String(Math.round(spd)), 0x6ad8ff],
      ['점프', sp.jumps, sp.jumps, 4, `${sp.jumps}단${sp.hover ? ' · 부유' : ''}`, 0xb08aff], ['기술 크기', Tm.fx * (m.mods.sizeMul || 1), 1, 2.4, `×${(Tm.fx * (m.mods.sizeMul || 1)).toFixed(2)}`, 0xffd27a]];
    stats.forEach(([k, v, , max, label, col], i) => {
      const y = CY + 36 + i * 15;
      C.add(hkText(this, RX + 14, y, k, 8, HK.dim, { origin: [0, .5] }));
      bar3d(g, RX + 62, y - 2, 150, 4, (k === '체력' ? m.maxhp : v) / max, col);
      if (k === '체력') { g.fillStyle(0x000000, .45); g.fillRect(RX + 62 + 150 * Math.min(1, m.hp / max), y - 2, 150 * Math.max(0, (m.maxhp - m.hp) / max), 4); }
      C.add(hkText(this, RX + 220, y, label, 8, HK.ivory, { origin: [0, .5] }));
    });
    const done = m.tier >= EVO_EXP.length, ey = CY + 112;
    C.add(hkText(this, RX + 14, ey, '진화', 8, HK.dim, { origin: [0, .5] }));
    bar3d(g, RX + 62, ey - 2, 150, 4, p.expProgress(m), m.mega ? PINK : 0xb07aff);
    C.add(hkText(this, RX + 220, ey, m.mega ? '메가진화 ★' : done ? '3단 진화 완료' : `${m.exp} / ${EVO_EXP[m.tier]} · 다음 진화까지 ${p.expToNext(m)}`, 8, HK.ivory, { origin: [0, .5] }));
    // 장비 효과 요약 (오른쪽 위)
    const mt = this.modsText(m.mods);
    C.add(hkText(this, RX + RW - 12, CY + 12, `교대 · ${TAGS[sp.tag].name}`, 7.5, HK.faint, { origin: [1, .5] }));
    C.add(hkText(this, RX + 14, CY + 128, `장비 효과  ${mt || '없음'}`, 7.5, mt ? HK.ivory : HK.faint, { origin: [0, .5], style: { wordWrap: { width: RW - 28, useAdvancedWrap: true }, maxLines: 2 } }));

    // 장착 소켓: 일반 도구 2칸 · 메가스톤 전용 · Z크리스탈 전용
    C.add(hkText(this, RX + 14, CY + 150, '장착 슬롯', 9.5, HK.gold, { bold: true, ls: 2, origin: [0, .5] }));
    accent(g, RX + 14, CY + 160, 200);
    const worn = []; for (const id of Object.keys(m.items)) for (let k = 0; k < m.items[id]; k++) worn.push(id);
    const SY = CY + 188, sockets = [
      { id: 'g0', x: RX + 40, label: '도구 1', col: HK.ivoryN, item: worn[0] },
      { id: 'g1', x: RX + 98, label: '도구 2', col: HK.ivoryN, item: worn[1] },
      { id: 'stone', x: RX + 170, label: '💎 메가스톤', col: PINK, stone: m.gear.stone },
      { id: 'crystal', x: RX + 236, label: '✨ Z크리스탈', col: 0xffd84a, crystal: m.gear.crystal }];
    for (const s of sockets) {
      const on = sel.socket === s.id, filled = s.item || s.stone || s.crystal;
      if (on) C.add(this.add.image(s.x, SY, 'glow').setBlendMode(ADD).setTint(s.col).setScale(.9).setAlpha(.45));
      hex(g, s.x, SY, 22, filled ? 0x1a1630 : 0x0c0b14, .95, s.col, on ? 1 : filled ? .6 : .28, on ? 2 : 1.2);
      hex(g, s.x, SY, 17, 0x000000, .25, s.col, .15);
      if (s.item) C.add(this.itemImage(s.x, SY, s.item, 26, 1.4));
      else if (s.stone) C.add(this.add.image(s.x, SY, 'megastone').setScale(1.7).setTint(typeColor(SPECIES[s.stone].types[0])));
      else if (s.crystal) C.add(this.add.image(s.x, SY, 'zcrystal').setScale(1.7).setTint(typeColor(s.crystal)));
      else { g.lineStyle(1, s.col, .3); g.lineBetween(s.x - 5, SY, s.x + 5, SY); g.lineBetween(s.x, SY - 5, s.x, SY + 5); }
      C.add(hkText(this, s.x, SY + 30, s.label, 7.5, on ? HK.gold : HK.dim, { bold: on, origin: .5 }));
      const z = this.add.zone(s.x, SY, 48, 48).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { Sfx.play('select'); this.showInv({ socket: s.id }); });
      C.add(z);
    }
    // 고른 소켓 설명 + 버튼
    const DX = RX + 274, DW = RW - 286, s = sockets.find(q => q.id === sel.socket);
    g.fillStyle(0x000000, .28); g.fillRoundedRect(DX, CY + 142, DW, 112, 6);
    const info = (title, body, col = HK.ivory) => {
      C.add(fitText(hkText(this, DX + 8, CY + 152, title, 9, col, { bold: true }), DW - 16));
      C.add(hkText(this, DX + 8, CY + 168, body, 7.5, HK.dim, { style: { wordWrap: { width: DW - 16, useAdvancedWrap: true }, lineSpacing: 1, maxLines: 5 } }));
    };
    const btn = (label, fn, ok = true) => glassButton(this, DX + 6, CY + 226, DW - 12, 22, label, fn, { size: 8.5, bold: true, ls: 0, layer: C, primary: ok }).setEnabled(ok);
    if (!s) info('소켓을 눌러 보세요', '일반 도구 2칸 + 전용 칸 2개.\n메가스톤 칸: 키스톤과 그 계열의 돌이 있어야 메가진화 · R 필살기.\nZ크리스탈 칸: Z링과 첫 속성 크리스탈이 있어야 Z기술.');
    else if (s.item) { info(ITEMS[s.item].name, ITEMS[s.item].desc); btn('🎒 가방에 넣기', () => { if (p.moveItem(s.item, this.invMember, -1)) { Sfx.play('item'); this.showInv({ socket: s.id }); } }); }
    else if (s.id === 'stone') {
      if (s.stone) { info(stoneName(s.stone), `${p.keyStone ? '키스톤과 공명 중' : '키스톤이 없어 잠들어 있다'} · 3단 진화 후 V 로 메가진화 · 메가 중 R 필살기`, '#ff9ad8'); btn('🎒 빼서 가방에', () => { if (p.unequipStone(m)) { Sfx.play('item'); this.showInv({ socket: 'stone' }); } else { Sfx.play('deny'); this.toast('메가진화 중엔 뺄 수 없어요'); } }); }
      else if (m.sp.megas.some(q => q.item)) info('폼체인지 전설', '이 전설은 메가스톤 대신 그 전설의 폼체인지 아이템(보스가 떨어뜨림)이 있으면 V 로 모습을 바꾼다.');
      else if (!usesStone(m.key)) info('메가스톤 없음', '이 포켓몬은 메가스톤으로 메가진화하지 않는다 (3단에서 각성).');
      else { const has = p.stones.has(m.key); info(has ? `${stoneName(m.key)} 있음` : '빈 메가스톤 칸', has ? '가방에 이 계열 메가스톤이 있다 — 끼우면 메가진화 준비 완료' : `${stoneName(m.key)}가 필요하다 · ${p.keyStone ? '숨겨진 심연의 균열 · 고대석 수집가' : '성도 방울탑의 노승려를 찾아가자 (키스톤)'}`); if (has) btn('💎 끼우기', () => { if (p.equipStone(m)) { Sfx.play('item'); this.showInv({ socket: 'stone' }); } }); }
    } else if (s.id === 'crystal') {
      const t = zTypeOf(m.key);
      if (s.crystal) { info(crystalName(s.crystal), `${p.zRing ? 'Z링과 공명 중' : 'Z링이 없어 빛나지 않는다'}${s.crystal !== t ? ` · 이 포켓몬의 Z기술은 ${crystalName(t)}가 필요하다` : ' · Q 로 Z기술'}`, '#ffe68a'); btn('🎒 빼서 가방에', () => { if (p.unequipCrystal(m)) { Sfx.play('item'); this.showInv({ socket: 'crystal' }); } }); }
      else { const has = (p.crystals[t] || 0) > 0; info(`빈 Z크리스탈 칸 (${crystalName(t)})`, has ? `가방에 ${crystalName(t)}가 있다 — 끼우면 Q 로 Z기술` : p.zRing ? `${crystalName(t)}가 필요하다` : 'Z링이 없다 — 호연지방 하늘기둥 입구(131번 수로)의 시련 캡틴을 찾아가자'); if (has) btn('✨ 끼우기', () => { if (p.equipCrystal(m, t)) { Sfx.play('item'); this.showInv({ socket: 'crystal' }); } }); }
    } else { info(`빈 칸 (${s.label})`, `일반 도구 칸 ${p.equipCount(m)} / ${MAX_EQUIP} · 가방 탭에서 도구를 고르고 장착`); btn('🎒 가방 탭으로', () => this.menuGo('bag')); }
  },

  // ================= ⚔️ 기술 & 카드: Z X C V R · 듀얼 속성 전환 · 배운 기술 · 기술머신 카드 덱 =================
  menuSkill(C, g, p) {
    const m = p.members[this.invMember], sel = this.menuSel || {}, slots = ['z', 'x', 'c'];
    glassPanel(g, 16, CY, 300, CH, { alpha: .9, border: HK.goldN, borderAlpha: .25 });
    this.menuChips(C, g, p, 22, CY + 6, 94);
    const ult = MEGA_ULT[m.key], mg = p.megaOf(m), rows = [
      ...slots.map(s => ({ key: s.toUpperCase(), id: m.skills[s], slot: s })),
      { key: 'V', mega: true }, { key: 'R', ult: true }];
    rows.forEach((r, i) => {
      const y = CY + 38 + i * 38, on = r.id && sel.skill === r.id;
      g.fillStyle(on ? 0x2c2650 : 0x0e0c18, on ? 1 : .9); g.fillRoundedRect(24, y, 284, 34, 6);
      g.lineStyle(on ? 1.6 : 1, on ? HK.goldN : HK.ivoryN, on ? .9 : .16); g.strokeRoundedRect(24, y, 284, 34, 6);
      g.fillStyle(r.mega || r.ult ? PINK : HK.goldN, .92); g.fillRoundedRect(30, y + 4, 14, 14, 3);
      C.add(hkText(this, 37, y + 11, r.key, 8.5, '#1a1020', { bold: true, origin: .5, flat: true }));
      if (r.id) {
        const sk = SKILLS[r.id], power = MOVE_DB[r.id] && MOVE_DB[r.id].power;
        C.add(this.add.image(37, y + 25, skillIcon(this, r.id)).setDisplaySize(14, 14));
        const nm = fitText(hkText(this, 50, y + 9, sk.name, 9.5, HK.ivory, { bold: true, origin: [0, .5] }), 130); C.add(nm);
        typePill(this, C, 54 + nm.displayWidth, y + 3, sk.type, 7);
        C.add(hkText(this, 302, y + 9, sk.cd ? `재사용 ${Math.round(p.cdOf(r.id, m) * 10) / 10}초` : '연타 · 꾹=차징', 7.5, HK.dim, { origin: [1, .5] }));
        C.add(fitText(hkText(this, 50, y + 24, `${power ? `위력 ${power} · ` : ''}${sk.desc}`, 7, HK.dim, { origin: [0, .5] }), 252));
        const z = this.add.zone(24, y, 284, 34).setOrigin(0).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => { Sfx.play('select'); this.showInv({ skill: r.id }); });
        C.add(z);
      } else if (r.mega) {
        C.add(this.add.image(37, y + 25, 'megastone').setScale(1.1));
        const ready = p.megaReady(m);
        C.add(fitText(hkText(this, 50, y + 9, mg.name || '메가진화', 9.5, ready ? '#ff9ad8' : HK.dim, { bold: true, origin: [0, .5] }), 160));
        C.add(hkText(this, 302, y + 9, ready ? (m.tier >= 2 || m.sp.legend ? '준비됨' : '3단 진화 후') : '잠김', 7.5, ready ? '#ff9ad8' : HK.faint, { origin: [1, .5] }));
        C.add(fitText(hkText(this, 50, y + 24, ready ? 'V 로 메가진화 — 그 판 끝까지 더 강한 모습' : '키스톤 + 이 계열 메가스톤을 메가스톤 칸에 (포켓몬 탭)', 7, HK.dim, { origin: [0, .5] }), 252));
      } else {
        C.add(this.add.image(37, y + 25, megaSymbol(this)).setDisplaySize(14, 14).setTint(0xffb0e8));
        C.add(fitText(hkText(this, 50, y + 9, ult ? ult.name : '메가 필살기', 9.5, m.mega ? '#ff9ad8' : HK.dim, { bold: true, origin: [0, .5] }), 180));
        C.add(hkText(this, 302, y + 9, `재사용 ${MEGA_ULT_CD}초`, 7.5, HK.dim, { origin: [1, .5] }));
        C.add(fitText(hkText(this, 50, y + 24, '메가진화 중에만 · 컷인과 함께 화면을 뒤덮는 대연출', 7, HK.dim, { origin: [0, .5] }), 252));
      }
    });
    // 듀얼 속성 전환 (차징 샷 · 내려찍기)
    const types = p.typesOf(m), ct = p.chargeType(m), ty0 = CY + 236;
    C.add(hkText(this, 26, ty0 + 10, '차징 · 내려찍기 속성', 8, HK.dim, { origin: [0, .5] }));
    if (types.length > 1) types.forEach((ty, k) => {
      glassButton(this, 140 + k * 82, ty0 + 1, 78, 18, `${typeName(ty)}${ty === ct ? ' ✓' : ''}`, () => { if (p.setChargeType(m, ty)) { Sfx.play('select'); this.showInv(this.menuSel); } }, { size: 8, bold: true, ls: 0, layer: C, primary: ty === ct });
    });
    else typePill(this, C, 140, ty0 + 4, types[0], 8);

    // ── 오른쪽 위: 배운 기술 (골라서 Z · X · C 자리에)
    const RX = 324, RW = 300;
    glassPanel(g, RX, CY, RW, CH, { alpha: .9, border: CYAN, borderAlpha: .18 });
    C.add(hkText(this, RX + 12, CY + 12, `배운 기술 ${m.learned.length}`, 9.5, HK.gold, { bold: true, ls: 1, origin: [0, .5] }));
    accent(g, RX + 12, CY + 22, 160);
    m.learned.slice(0, 10).forEach((id, k) => {
      const col = k % 2, row = Math.floor(k / 2), x = RX + 10 + col * 142, y = CY + 28 + row * 20, sk = SKILLS[id], on = sel.skill === id, at = slots.find(s => m.skills[s] === id);
      g.fillStyle(on ? 0x2c2650 : 0x12101e, on ? 1 : .85); g.fillRoundedRect(x, y, 138, 18, 4);
      g.lineStyle(1, on ? HK.goldN : HK.ivoryN, on ? .9 : .14); g.strokeRoundedRect(x, y, 138, 18, 4);
      g.fillStyle(typeColor(sk.type), .95); g.fillRect(x + 2, y + 3, 2, 12);
      C.add(this.add.image(x + 13, y + 9, skillIcon(this, id)).setDisplaySize(12, 12));
      C.add(fitText(hkText(this, x + 22, y + 9, sk.name, 8, on ? HK.ivory : HK.dim, { bold: on, origin: [0, .5] }), at ? 92 : 110));
      if (at) { g.fillStyle(HK.goldN, .92); g.fillRoundedRect(x + 120, y + 3, 14, 12, 3); C.add(hkText(this, x + 127, y + 9, at.toUpperCase(), 7.5, '#1a1008', { bold: true, origin: .5, flat: true })); }
      const z = this.add.zone(x, y, 138, 18).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { Sfx.play('select'); this.showInv({ skill: id }); });
      C.add(z);
    });
    if (m.learned.length > 10) C.add(hkText(this, RX + RW - 10, CY + 12, `+${m.learned.length - 10}`, 8, HK.dim, { origin: [1, .5] }));
    // 고른 기술 → 자리 버튼
    const by = CY + 132;
    if (sel.skill && SKILLS[sel.skill]) {
      const sk = SKILLS[sel.skill], combo = !sk.cd, here = slots.find(s => m.skills[s] === sel.skill);
      C.add(fitText(hkText(this, RX + 12, by, `${sk.name} — ${here ? `${here.toUpperCase()} 자리에 장착 중` : '넣을 자리를 고르세요'}`, 8, HK.gold, { bold: true, origin: [0, .5] }), RW - 24));
      slots.forEach((s, k) => {
        const ok = m.skills[s] !== sel.skill && (!combo || s === 'z') && !(here && !SKILLS[m.skills[s]].cd && here !== 'z');
        glassButton(this, RX + 12 + k * 94, by + 9, 90, 20, `${s.toUpperCase()} 자리에`, () => this.menuSetSkill(s), { size: 8.5, bold: true, ls: 0, layer: C, primary: ok }).setEnabled(ok);
      });
    } else C.add(hkText(this, RX + 12, by + 12, '왼쪽 Z · X · C 나 배운 기술을 누르면 자리를 바꿀 수 있어요', 7.5, HK.faint, { origin: [0, .5] }));

    // ── 오른쪽 아래: 기술머신 카드 덱 (특성 카드 · 기술 강화 · 등급 카드로 배운 기술)
    const cards = [
      ...Object.keys(m.perks || {}).filter(k => PERKS[k]).map(k => ({ grade: PERKS[k].grade, name: PERKS[k].name, desc: PERKS[k].desc, n: m.perks[k] })),
      ...[...m.ups].filter(u => UPGRADES[u]).map(u => ({ grade: UPGRADES[u].grade || '레어', name: UPGRADES[u].name, desc: UPGRADES[u].desc || '' })),
      ...Object.entries(m.cardGrade || {}).filter(([id]) => SKILLS[id]).map(([id, gr]) => ({ grade: gr, name: `기술: ${SKILLS[id].name}`, desc: SKILLS[id].desc, skill: id }))];
    const dy = CY + 174;
    C.add(hkText(this, RX + 12, dy, `기술머신 카드 덱 ${cards.length}`, 9.5, HK.gold, { bold: true, ls: 1, origin: [0, .5] }));
    accent(g, RX + 12, dy + 10, 160);
    if (!cards.length) C.add(hkText(this, RX + RW / 2, dy + 46, '아직 카드가 없어요\n기술머신 캡슐에서 카드를 뽑아 보세요', 8, HK.faint, { origin: .5, style: { align: 'center', lineSpacing: 3 } }));
    cards.slice(0, 8).forEach((c, k) => {
      const x = RX + 10 + (k % 4) * 72, y = dy + 16 + Math.floor(k / 4) * 38, st = GRADE_STYLE[c.grade] || GRADE_STYLE['커먼'];
      const b0 = parseInt(st.border[0].slice(1), 16), bg = parseInt(st.bg[0].slice(1), 16);
      g.fillStyle(bg, 1); g.fillRoundedRect(x, y, 68, 34, 4);
      g.fillGradientStyle(b0, parseInt(st.border[1].slice(1), 16), bg, bg, .35, .35, 0, 0); g.fillRect(x + 1, y + 1, 66, 12);
      g.lineStyle(1.2, b0, .95); g.strokeRoundedRect(x, y, 68, 34, 4);
      C.add(hkText(this, x + 4, y + 6, st.en, 5.5, st.border[0], { bold: true, ls: 1, origin: [0, .5] }));
      C.add(hkText(this, x + 4, y + 21, c.name.split(': ').pop(), 7, HK.ivory, { bold: true, style: { wordWrap: { width: 60, useAdvancedWrap: true }, maxLines: 2 }, origin: [0, .5] }));
      if (c.n > 1) C.add(hkText(this, x + 64, y + 6, `×${c.n}`, 6.5, HK.gold, { origin: [1, .5] }));
      const z = this.add.zone(x, y, 68, 34).setOrigin(0).setInteractive({ useHandCursor: true });
      this.tipOn(z, c.skill ? SKILLS[c.skill].type : 'normal', `${c.name} — ${c.desc}`.slice(0, 60), x + 34, y);
      C.add(z);
    });
    if (cards.length > 8) C.add(hkText(this, RX + RW - 10, dy, `+${cards.length - 8}`, 8, HK.dim, { origin: [1, .5] }));
  },
  menuSetSkill(slot) {
    const sel = this.menuSel || {}, p = this.gs.player, m = p.members[this.invMember];
    if (!sel.skill) return;
    if (!p.setSkill(m, sel.skill, slot)) { Sfx.play('deny'); if (!SKILLS[sel.skill].cd && slot !== 'z') this.toast('연타 기술은 Z 자리 전용이에요'); return; }
    Sfx.play('item');
    this.showInv({ skill: sel.skill });
  },

  // ================= 🎒 가방: 필터 · 격자 · 상세 =================
  menuEntries(p) {
    const out = [];
    if (p.candy > 0) out.push({ kind: 'candy', cat: 'use', n: p.candy });
    for (const [id, n] of Object.entries(p.bag)) out.push({ kind: 'tool', cat: 'tool', id, n, from: -1 });
    p.members.forEach((m, i) => { for (const [id, n] of Object.entries(m.items)) out.push({ kind: 'tool', cat: 'tool', id, n, from: i }); });
    for (const line of p.stones) out.push({ kind: 'stone', cat: 'stone', line, from: -1 });
    p.members.forEach((m, i) => { if (m.gear.stone) out.push({ kind: 'stone', cat: 'stone', line: m.gear.stone, from: i }); });
    for (const [type, n] of Object.entries(p.crystals)) out.push({ kind: 'crystal', cat: 'crystal', type, n, from: -1 });
    p.members.forEach((m, i) => { if (m.gear.crystal) out.push({ kind: 'crystal', cat: 'crystal', type: m.gear.crystal, n: 1, from: i }); });
    return out;
  },
  sameEntry(a, b) { return !!a && !!b && a.kind === b.kind && a.id === b.id && a.line === b.line && a.type === b.type && a.from === b.from; },
  menuBag(C, g, p) {
    const filter = this.bagFilter || 'all', all = this.menuEntries(p), list = all.filter(e => filter === 'all' || e.cat === filter);
    let sel = this.menuSel && this.menuSel.kind ? list.find(e => this.sameEntry(e, this.menuSel)) : null;
    if (!sel && list.length) sel = null;
    this.menuList = list;
    glassPanel(g, 16, CY, 392, CH, { alpha: .9, border: HK.goldN, borderAlpha: .25 });
    BAG_FILTERS.forEach(([id, label], i) => {
      const n = id === 'all' ? all.length : all.filter(e => e.cat === id).length;
      glassButton(this, 24 + i * 76, CY + 8, 72, 20, `${label} ${n}`, () => { if (this.bagFilter !== id) { this.bagFilter = id; Sfx.play('select'); this.showInv(null); } }, { size: 8, bold: true, ls: 0, layer: C, primary: filter === id });
    });
    if (!list.length) C.add(hkText(this, 212, CY + 110, '비어 있어요\n보스·엘리트·상자·자판기에서 얻고, 메가스톤·Z크리스탈은 이야기 속에서 받는다', 8.5, HK.faint, { origin: .5, style: { align: 'center', lineSpacing: 4 } }));
    list.slice(0, 40).forEach((e, k) => {
      const x = 44 + (k % 9) * 40, y = CY + 54 + Math.floor(k / 9) * 40, on = this.sameEntry(e, sel), col = e.kind === 'stone' ? PINK : e.kind === 'crystal' ? 0xffd84a : e.kind === 'candy' ? CYAN : HK.ivoryN;
      g.fillStyle(on ? 0x2c2650 : 0x12101e, on ? 1 : .92); g.fillRoundedRect(x - 17, y - 17, 34, 34, 6);
      g.lineStyle(on ? 1.8 : 1, on ? HK.goldN : col, on ? .95 : .35); g.strokeRoundedRect(x - 17, y - 17, 34, 34, 6);
      if (e.kind === 'candy') C.add(this.itemImage(x, y, 'rare_candy', 26, 1.4));
      else if (e.kind === 'tool') C.add(this.itemImage(x, y, e.id, 26, 1.4));
      else if (e.kind === 'stone') C.add(this.add.image(x, y, 'megastone').setScale(1.6).setTint(typeColor(SPECIES[e.line].types[0])));
      else C.add(this.add.image(x, y, 'zcrystal').setScale(1.6).setTint(typeColor(e.type)));
      if (e.n > 1) C.add(this.add.text(x + 15, y + 16, `×${e.n}`, txt(7.5, '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(1, 1));
      if (e.from >= 0) { g.fillStyle(HK.goldN, .95); g.fillCircle(x - 12, y - 12, 5); C.add(hkText(this, x - 12, y - 12, String(e.from + 1), 7, '#1a1008', { bold: true, origin: .5, flat: true })); }   // 장착한 포켓몬 번호
      const z = this.add.zone(x, y, 36, 36).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { Sfx.play('select'); this.showInv(e); });
      C.add(z);
    });
    // 중요한 물건 (파티 공용)
    const ky = CY + CH - 16;
    g.lineStyle(1, HK.ivoryN, .12); g.lineBetween(26, ky - 12, 398, ky - 12);
    C.add(hkText(this, 26, ky, '중요한 물건', 8, HK.dim, { bold: true, origin: [0, .5] }));
    C.add(this.add.image(108, ky, 'megastone').setScale(1.1).setAlpha(p.keyStone ? 1 : .25));
    C.add(hkText(this, 118, ky, p.keyStone ? '키스톤' : '키스톤 (없음)', 8, p.keyStone ? '#ff9ad8' : HK.faint, { origin: [0, .5] }));
    C.add(this.add.image(196, ky, 'zcrystal').setScale(1.1).setAlpha(p.zRing ? 1 : .25));
    C.add(hkText(this, 206, ky, p.zRing ? 'Z링' : 'Z링 (없음)', 8, p.zRing ? '#ffe68a' : HK.faint, { origin: [0, .5] }));
    C.add(hkText(this, 398, ky, `일반 도구 칸 ${MAX_EQUIP}개 · 전용 칸 2개`, 7, HK.faint, { origin: [1, .5] }));

    // ── 오른쪽: 상세 패널
    const DX = 416, DW = 208;
    glassPanel(g, DX, CY, DW, CH, { alpha: .92, border: CYAN, borderAlpha: .2 });
    if (!sel) { C.add(hkText(this, DX + DW / 2, CY + CH / 2, '아이템을 누르면\n설명과 장착 버튼이 나와요', 9, HK.faint, { origin: .5, style: { align: 'center', lineSpacing: 5 } })); return; }
    this.menuSel = sel;
    const art = (o, glowCol) => { C.add(this.add.image(DX + DW / 2, CY + 44, 'glow').setBlendMode(ADD).setTint(glowCol).setScale(1.3).setAlpha(.4)); C.add(o); };
    let title, cat, desc, col = HK.ivory;
    if (sel.kind === 'candy') { art(this.itemImage(DX + DW / 2, CY + 44, 'rare_candy', 44, 2.6), CYAN); title = `이상한사탕 ×${p.candy}`; cat = '소비 · 파티 공용'; desc = '다음 진화 경험치의 40%를 바로 채운다 (차면 진화) · 최종 진화면 체력 회복 + 공격력 +3% · 고대석 수집가와 메가스톤을 바꿀 수도 있다'; }
    else if (sel.kind === 'tool') { const it = ITEMS[sel.id]; art(this.itemImage(DX + DW / 2, CY + 44, sel.id, 44, 2.6), it.relic ? 0xb05aff : HK.goldN); title = it.name; cat = it.relic ? '전설 유물 · 장착 도구' : '장착 도구'; desc = it.desc; col = it.relic ? '#e8b0ff' : HK.ivory; }
    else if (sel.kind === 'stone') { art(this.add.image(DX + DW / 2, CY + 44, 'megastone').setScale(3).setTint(typeColor(SPECIES[sel.line].types[0])), PINK); title = stoneName(sel.line); cat = '메가스톤 · 전용 칸'; desc = `${SPECIES[sel.line].name} 계열 전용. 키스톤과 함께 3단 진화 뒤 V 로 메가진화하고, 메가 중엔 R 필살기를 쓴다.`; col = '#ff9ad8'; }
    else { art(this.add.image(DX + DW / 2, CY + 44, 'zcrystal').setScale(3).setTint(typeColor(sel.type)), 0xffd84a); title = crystalName(sel.type); cat = 'Z크리스탈 · 전용 칸'; desc = `${typeName(sel.type)} 속성 포켓몬(첫 속성)의 Z크리스탈 칸에 끼우면, Z링과 함께 Q 로 일격필살 Z기술.`; col = '#ffe68a'; }
    C.add(fitText(hkText(this, DX + DW / 2, CY + 80, title, 11, col, { bold: true, origin: .5 }), DW - 16));
    C.add(hkText(this, DX + DW / 2, CY + 96, `${cat}${sel.from >= 0 ? `  ·  ${sel.from + 1}번 ${p.formName(p.members[sel.from])} 장착 중` : ''}`, 7.5, sel.from >= 0 ? HK.gold : HK.dim, { origin: .5 }));
    accent(g, DX + 16, CY + 106, DW - 32, .5);
    C.add(hkText(this, DX + 12, CY + 114, desc, 8, HK.ivory, { style: { wordWrap: { width: DW - 24, useAdvancedWrap: true }, lineSpacing: 2, maxLines: 6 } }));
    // 버튼
    const BY = CY + CH - 30, n = p.members.length, bw = Math.floor((DW - 16 - (n - 1) * 4) / n);
    const memberBtns = (label, ok, fn) => p.members.forEach((pm, i) => glassButton(this, DX + 8 + i * (bw + 4), BY, bw, 24, `${i + 1} ${label(pm)}`, () => fn(i), { size: n > 2 ? 7.5 : 8.5, bold: true, ls: 0, layer: C, primary: ok(pm, i) }).setEnabled(ok(pm, i)));
    const single = (label, fn, ok = true) => glassButton(this, DX + 8, BY, DW - 16, 24, label, fn, { size: 9, bold: true, ls: 0, layer: C, primary: ok }).setEnabled(ok);
    if (sel.kind === 'candy') { C.add(hkText(this, DX + DW / 2, BY - 10, '누구에게 먹일까?', 8, HK.gold, { bold: true, origin: .5 })); memberBtns(pm => p.formName(pm), () => true, i => this.menuFeed(i)); }
    else if (sel.from >= 0) single('🎒 빼서 가방에', () => this.menuUnequip(sel));
    else if (sel.kind === 'tool') { C.add(hkText(this, DX + DW / 2, BY - 10, '누구에게 장착할까?', 8, HK.gold, { bold: true, origin: .5 })); memberBtns(pm => `${p.formName(pm)} ${p.equipCount(pm)}/${MAX_EQUIP}`, pm => p.equipCount(pm) < MAX_EQUIP, i => this.menuEquip(sel, i)); }
    else if (sel.kind === 'stone') { const i = p.members.findIndex(pm => pm.key === sel.line); single(i >= 0 ? `💎 ${p.formName(p.members[i])}에게 끼우기` : `${SPECIES[sel.line].name} 계열이 파티에 없다`, () => this.menuEquip(sel, i), i >= 0 && !p.members[i].gear.stone); }
    else { C.add(hkText(this, DX + DW / 2, BY - 10, `${typeName(sel.type)} 속성 포켓몬에게`, 8, HK.gold, { bold: true, origin: .5 })); memberBtns(pm => p.formName(pm), pm => zTypeOf(pm.key) === sel.type, i => this.menuEquip(sel, i)); }
  },
  menuEquip(e, i) {
    const p = this.gs.player, m = p.members[i];
    const ok = e.kind === 'tool' ? p.moveItem(e.id, -1, i) : e.kind === 'stone' ? p.equipStone(m) : p.equipCrystal(m, e.type);
    if (!ok) { Sfx.play('deny'); if (e.kind === 'tool') this.toast(`일반 도구 칸은 ${MAX_EQUIP}개까지예요`); return; }
    Sfx.play('item'); this.toast(`${p.formName(m)}에게 장착했다`);
    this.showInv(Object.assign({}, e, { from: i, n: 1 }));
  },
  menuUnequip(e) {
    const p = this.gs.player, m = p.members[e.from];
    const ok = e.kind === 'tool' ? p.moveItem(e.id, e.from, -1) : e.kind === 'stone' ? p.unequipStone(m) : p.unequipCrystal(m);
    if (!ok) { Sfx.play('deny'); if (e.kind === 'stone') this.toast('메가진화 중엔 뺄 수 없어요'); return; }
    Sfx.play('item');
    this.showInv(Object.assign({}, e, { from: -1 }));
  },
  menuFeed(i) {
    const p = this.gs.player, m = p.members[i];
    if (!m || !p.candy) { Sfx.play('deny'); return; }
    const before = p.formName(m), r = p.feedCandy(m);
    if (!r) { Sfx.play('deny'); return; }
    Sfx.play(r.evolved ? 'evolve' : 'heal');
    this.toast(r.maxed ? `${before}이(가) 이상한사탕을 먹었다! 체력 회복 · 공격력 +3%` : r.evolved ? `${before}이(가) 이상한사탕을 먹고 ${p.formName(m)}(으)로 진화했다!` : `${before}이(가) 이상한사탕을 먹었다! 경험치 +${r.gain}`, 'rare_candy');
    this.invMember = i;
    this.showInv(p.candy > 0 ? { kind: 'candy', cat: 'use', n: p.candy } : null);
  },

  // ================= 📖 정화 도감: 합류한 동료 · 정화한 지방 보스 =================
  menuDex(C, g, p) {
    const sel = this.menuSel && this.menuSel.dex ? this.menuSel.dex : null, got = DEX_ORDER.filter(k => Save.isUnlocked(k)).length;
    this.menuList = DEX_ORDER.map(k => ({ dex: k }));
    glassPanel(g, 16, CY, 420, CH, { alpha: .9, border: HK.goldN, borderAlpha: .25 });
    C.add(hkText(this, 28, CY + 12, `합류한 동료 ${got} / ${DEX_ORDER.length}`, 9.5, HK.gold, { bold: true, ls: 1, origin: [0, .5] }));
    accent(g, 28, CY + 22, 180);
    DEX_ORDER.forEach((k, i) => {
      const x = 38 + (i % 12) * 33, y = CY + 44 + Math.floor(i / 12) * 34, on = sel === k, open = Save.isUnlocked(k);
      if (on) C.add(this.add.image(x, y, 'glow').setBlendMode(ADD).setTint(HK.goldN).setScale(.6).setAlpha(.5));
      const im = this.add.image(x, y, roundPortrait(this, SPECIES[k].evo[0].key)).setScale(.62);
      if (!open) im.setTintFill(0x1a1628);
      C.add([im, hiImage(this, x, y, on ? 'slot3d-gold' : 'slot3d').setScale(.62 / RES).setAlpha(open || on ? 1 : .45)]);
      if (!open) C.add(hkText(this, x, y, '?', 9, HK.faint, { bold: true, origin: .5 }));
      const z = this.add.zone(x, y, 30, 30).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { Sfx.play('select'); this.showInv({ dex: k }); });
      C.add(z);
    });
    // 정화한 지방 (최종 보스)
    const by = CY + CH - 34, cleared = Save.data.cleared || 0;
    g.lineStyle(1, HK.ivoryN, .12); g.lineBetween(26, by - 16, 426, by - 16);
    C.add(hkText(this, 28, by, '정화한 지방', 8.5, HK.dim, { bold: true, origin: [0, .5] }));
    STAGES.forEach((st, i) => {
      const x = 120 + i * 62, done = cleared > i, bk = st.boss && SPECIES[st.boss] ? SPECIES[st.boss].evo[0].key : st.boss;
      const im = this.add.image(x, by, roundPortrait(this, bk)).setScale(.5);
      if (!done) im.setTintFill(0x1a1628);
      C.add([im, hkText(this, x + 14, by, done ? `${st.short} ✓` : st.short, 7.5, done ? HK.gold : HK.faint, { origin: [0, .5], bold: done })]);
    });
    // ── 오른쪽: 상세
    const DX = 444, DW = 180;
    glassPanel(g, DX, CY, DW, CH, { alpha: .92, border: CYAN, borderAlpha: .2 });
    if (!sel) { C.add(hkText(this, DX + DW / 2, CY + CH / 2, '포켓몬을 누르면\n자세한 정보가 나와요', 9, HK.faint, { origin: .5, style: { align: 'center', lineSpacing: 5 } })); return; }
    const sp = SPECIES[sel], open = Save.isUnlocked(sel), u = sp.unlock || {};
    C.add(this.add.image(DX + DW / 2, CY + 46, 'glow').setBlendMode(ADD).setTint(typeColor(sp.types[0])).setScale(1.2).setAlpha(open ? .45 : .15));
    const pi = this.add.image(DX + DW / 2, CY + 46, roundPortrait(this, sp.evo[0].key)).setScale(1.3);
    if (!open) pi.setTintFill(0x1a1628);
    C.add(pi);
    C.add(hkText(this, DX + DW / 2, CY + 82, open ? sp.name : '???', 12, open ? '#fff2c8' : HK.faint, { bold: true, origin: .5 }));
    if (open) {
      let x = DX + DW / 2 - (sp.types.length * 34) / 2;
      sp.types.forEach(ty => { x += typePill(this, C, x, CY + 92, ty, 7.5) + 4; });
      C.add(hkText(this, DX + 10, CY + 112, sp.desc || '', 7.5, HK.ivory, { style: { wordWrap: { width: DW - 20, useAdvancedWrap: true }, lineSpacing: 2, maxLines: 4 } }));
      const chain = [...new Set(sp.evo.map(f => f.name))].join(' → ') + (sp.megas.length ? ` → ${sp.megas.map(q => q.name).join(' · ')}` : '');
      C.add(hkText(this, DX + 10, CY + 172, chain, 7, HK.dim, { style: { wordWrap: { width: DW - 20, useAdvancedWrap: true }, maxLines: 3 } }));
    }
    const how = u.start ? '처음부터 함께하는 동료' : UNLOCKABLE.includes(sel) ? `같은 계열 ${UNLOCK_KILLS}마리 정화 (${Math.min(UNLOCK_KILLS, Save.kills(sel))} / ${UNLOCK_KILLS})` : u.stage ? `${u.stage}개 지방을 정화하면 합류` : u.total ? `포켓몬 ${u.total}마리 정화 (${Math.min(u.total, Save.data.totalPurified || 0)} / ${u.total})` : '보스를 정화하면 합류';
    C.add(hkText(this, DX + DW / 2, CY + CH - 22, open ? `✓ 합류함 · ${how}` : `🔒 ${how}`, 7.5, open ? HK.gold : HK.dim, { origin: .5, style: { align: 'center', wordWrap: { width: DW - 16, useAdvancedWrap: true } } }));
  },

  // ---------------- 키보드 ----------------
  menuKey(e) {
    const p = this.gs.player, n = p.members.length, tab = this.menuTab || 'mon', ti = TABS.findIndex(t => t[0] === tab);
    if (e.code === 'KeyQ' || e.code === 'KeyE') { this.menuGo(TABS[(ti + (e.code === 'KeyE' ? 1 : TABS.length - 1)) % TABS.length][0]); return; }
    if (/^(Digit|Numpad)[1-3]$/.test(e.code) && tab !== 'dex') { const k = +e.code.slice(-1) - 1; if (k < n && k !== this.invMember) { Sfx.play('select'); this.invMember = k; this.showInv(null); } return; }
    const step = e.code === 'ArrowRight' || e.code === 'ArrowDown' ? 1 : e.code === 'ArrowLeft' || e.code === 'ArrowUp' ? -1 : 0;
    if (tab === 'mon') {
      const ids = ['g0', 'g1', 'stone', 'crystal'], i = ids.indexOf((this.menuSel || {}).socket);
      if (step) { Sfx.play('select'); this.showInv({ socket: ids[(i + step + ids.length) % ids.length] }); }
      return;
    }
    if (tab === 'skill') {
      const m = p.members[this.invMember], list = m.learned, sel = (this.menuSel || {}).skill;
      const slotKey = ['z', 'x', 'c'].find(sl => keyNameFromEvent(e) === Settings.key(sl));
      if (sel && slotKey) { this.menuSetSkill(slotKey); return; }
      if (step && list.length) { Sfx.play('select'); this.showInv({ skill: list[(list.indexOf(sel) + step + list.length) % list.length] }); }
      return;
    }
    const list = this.menuList || [];
    if (step && list.length) {
      const i = tab === 'dex' ? list.findIndex(q => this.menuSel && q.dex === this.menuSel.dex) : list.findIndex(q => this.sameEntry(q, this.menuSel));
      Sfx.play('select'); this.showInv(list[(i + step + list.length) % list.length]); return;
    }
    if (tab === 'bag' && (e.code === 'Enter' || e.code === 'Space') && this.menuSel && this.menuSel.kind) {
      const s = this.menuSel;
      if (s.kind === 'candy') this.menuFeed(this.invMember);
      else if (s.from >= 0) this.menuUnequip(s);
      else if (s.kind === 'stone') { const i = p.members.findIndex(pm => pm.key === s.line); if (i >= 0) this.menuEquip(s, i); else Sfx.play('deny'); }
      else if (s.kind === 'crystal') { const i = [this.invMember, ...p.members.keys()].find(k => p.members[k] && zTypeOf(p.members[k].key) === s.type); if (i !== undefined) this.menuEquip(s, i); else Sfx.play('deny'); }
      else this.menuEquip(s, this.invMember);
    }
  }
};

// UIScene 에 메뉴를 붙인다
export function installGameMenu(cls) { Object.assign(cls.prototype, GameMenu); }
