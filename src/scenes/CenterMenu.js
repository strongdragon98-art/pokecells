// 🏥 포켓몬센터 창 (UIScene 에 붙인다 — installCenterMenu)
//  ① 서비스 메뉴 (showCenter): 센터 앞에서 F(조사 버튼)를 눌렀을 때만 (GameScene.openCenter) — [💚 포켓몬 회복] · [🔄 포켓몬 교체] · [닫기]
//     회복은 창을 닫고 GameScene.healAtCenter (5음 회복 징글 · 몬스터볼 3개 깜빡임 · 체력 100% · 상처약 가득)
//  ② 포켓몬 교체 (showBox): 2단계
//     1단계 — 위 보관함 격자에서 데려갈 포켓몬 카드를 누르면 바로 바뀌지 않고 ✔ 체크 배지 · 하이라이트 테두리 (교체 대기)
//     2단계 — 체크된 순간 아래 출전 칸 1 ~ 3 위에 반짝이는 🔄 교체 버튼 (빈 칸은 ➕) → 누르면 맞바꾼다
//     떠나는 포켓몬이 경험치를 쌓았거나(xp > 0) 진화했으면 ③ 확인 창을 먼저
//  ③ ⚡ 경험치 전수 확인 창: [기존: 리자드 (누적 180 XP)] ➔ [신규: 물짱이] · ⚠️ 70% 만 전수(30% 소멸) 경고 · 전수 시 획득 경험치 · 진화 예고
//     [⚡ 예] 떠나는 포켓몬 경험치 0 · 1단 + 들어오는 포켓몬 +70% (진화 기준을 넘으면 창을 닫고 바로 진화 연출 — GameScene.inheritEvolve)
//     [❌ 아니오] 경험치 · 진화 그대로 자리만 맞바꾼다 (떠나는 포켓몬은 보관함에서 그대로 쉰다)
//  키보드: 메뉴 ↑↓ · 1 · 2 · Enter/F/Space · Esc 닫기 / 교체 ←→↑↓ · Enter 체크 · 1 ~ 3 자리 · Esc 한 단계 뒤로 (확인 창 → 체크 → 닫기)
import Phaser from 'phaser';
import { GAME_W, GAME_H, RES } from '../config.js';
import { SPECIES, EVO_EXP } from '../data/pokemon.js';
import { HK, hkText, glassPanel, glassButton, fadeLine, hiImage } from '../systems/ui.js';
import { roundPortrait } from '../systems/Textures.js';
import { RosterPanel } from '../systems/RosterPanel.js';
import { Save } from '../systems/Save.js';
import { Sfx } from '../systems/Audio.js';
import { inheritGain } from '../game/Player.js';

const ADD = Phaser.BlendModes.ADD;
const SLOT_X = i => 92 + i * 56, SLOT_Y = 322;
const xpOf = m => Math.floor((m && m.exp) || 0);
const stageName = (key, tier) => { const e = SPECIES[key].evo; return e[Math.min(tier, e.length - 1)].name; };

export const CenterMenu = {
  // ---------------- ① 서비스 메뉴 ----------------
  showCenter(focus = this.centerFocus || 0) {
    this.clearOverlay();
    const gs = this.gs, L = this.overlay.setVisible(true), g = this.gOver, it = gs.centerAt;
    this.centerFocus = focus;
    g.fillStyle(0x05040a, .55); g.fillRect(0, 0, GAME_W, GAME_H);
    const W = 268, H = 160, X = 320 - W / 2, Y = 92;
    glassPanel(g, X, Y, W, H, { r: 10, alpha: .95, border: 0xff8a8a, borderAlpha: .6 });
    g.fillStyle(0xe8484a, .9); g.fillRect(X + 10, Y + 27, W - 20, 1);
    const city = (it && it.room && (it.room.city || it.room.area)) || '';
    L.add(hkText(this, 320, Y + 8, '🏥 포켓몬 센터', 12, HK.ivory, { bold: true, origin: [.5, 0] }));
    if (city) L.add(hkText(this, X + W - 10, Y + 11, city, 7.5, HK.dim, { origin: [1, 0] }));
    const opts = [
      ['[ 💚 포켓몬 회복 (Heal Party) ]', '출전 포켓몬 체력 100% · 상처약 소지 한도까지 충전'],
      ['[ 🔄 포켓몬 교체 (Switch Party) ]', '보관함 포켓몬과 맞바꾸기 · 경험치 70% 전수 가능']
    ];
    opts.forEach(([label, desc], i) => {
      const by = Y + 38 + i * 44, on = i === focus;
      const b = glassButton(this, X + 18, by, W - 36, 24, label, () => this.centerPick(i), { size: 10, primary: on, ls: 0 });   // ls 0: 글자 간격을 주면 이모지가 깨진다
      for (const o of b.objs) L.add(o);
      b.objs[2].on('pointerover', () => { if (this.centerFocus !== i) this.showCenter(i); });
      if (on) L.add(this.add.image(320, by + 12, 'glow').setBlendMode(ADD).setTint(i ? 0x8ad8ff : 0x8affb0).setScale(2.6, .5).setAlpha(.18));
      L.add(hkText(this, 320, by + 27, desc, 7.5, on ? (i ? '#9ad8ff' : '#9affb8') : HK.dim, { origin: [.5, 0] }));
    });
    const close = glassButton(this, 320 - 40, Y + H - 26, 80, 18, '닫기 (Esc)', () => this.gs.toggleOverlay('center'), { size: 8.5, ls: 0 });
    for (const o of close.objs) L.add(o);
    L.add(hkText(this, 320, Y + H + 6, '↑↓ 고르기 · Enter / F / Space 결정 · 1 회복 · 2 교체 · Esc 닫기', 7.5, HK.faint, { origin: [.5, 0] }));
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'center';
  },
  centerPick(i) {
    const gs = this.gs;
    Sfx.play('select');
    if (i === 0) { gs.toggleOverlay('center'); gs.healAtCenter(gs.centerAt); return; }
    this.boxPick = null; this.boxModal = null;
    gs.overlay = 'box'; this.showBox();
  },
  centerKey(e) {
    const c = e.code;
    if (c === 'ArrowUp' || c === 'ArrowDown') { Sfx.play('select'); this.showCenter(this.centerFocus ? 0 : 1); }
    else if (c === 'Digit1' || c === 'Numpad1') this.centerPick(0);
    else if (c === 'Digit2' || c === 'Numpad2') this.centerPick(1);
    else if (['Enter', 'NumpadEnter', 'Space', 'KeyF', 'KeyZ'].includes(c)) this.centerPick(this.centerFocus || 0);
  },

  // ---------------- ② 포켓몬 교체 (✔ 체크 → 🔄 자리) ----------------
  showBox() {
    this.clearOverlay();
    const gs = this.gs, p = gs.player, g = this.gOver, L = this.overlay.setVisible(true);
    g.fillStyle(0x05040a, .95); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(hkText(this, 320, 10, '🔄 포켓몬 교체', 14, HK.ivory, { bold: true, origin: [.5, 0], glow: true }));
    L.add(hkText(this, 320, 31, '① 위 목록에서 데려갈 포켓몬을 눌러 ✔ 체크  →  ② 아래 출전 칸(1 ~ 3번)의 🔄 를 눌러 맞바꿀 자리를 고르세요', 8.5, HK.dim, { origin: [.5, 0] }));
    const pick = this.boxPick && Save.isUnlocked(this.boxPick) && !p.members.some(m => m.key === this.boxPick) ? this.boxPick : null;
    this.boxPick = pick;
    this.boxPanel = new RosterPanel(this, {
      layer: L, x: 16, y: 50, h: 236, infoX: 392, infoW: 234, focus: this.boxFocus || pick || p.m.key,
      picked: k => p.members.findIndex(m => m.key === k),
      checked: () => this.boxPick,
      onSelect: k => this.boxSelect(k),
      onFocus: k => { this.boxFocus = k; }
    });
    this.boxBar = this.add.container(0, 0); L.add(this.boxBar);
    this.drawBoxBar();
    const close = glassButton(this, 566, 8, 64, 20, '✕  닫기', () => gs.toggleOverlay('box'), { size: 9, ls: 0 });
    for (const o of close.objs) L.add(o);
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'box';
    if (this.boxModal) this.openInheritModal();
  },
  // 1단계: 카드를 누르면 ✔ 체크 (같은 카드를 다시 누르면 풀린다) — 아직 합류하지 않았거나 이미 출전 중이면 안 된다
  boxSelect(k) {
    const p = this.gs.player;
    this.boxFocus = k;
    if (!Save.isUnlocked(k)) { Sfx.play('deny'); this.toast('아직 합류하지 않은 포켓몬이다 — 정화해서 동료로 만들자'); return; }
    if (p.members.some(m => m.key === k)) { Sfx.play('deny'); this.toast('이미 출전 파티에 있다 — 보관함의 다른 포켓몬을 체크하자'); return; }
    this.boxPick = this.boxPick === k ? null : k;
    Sfx.play(this.boxPick ? 'unlock' : 'select');
    this.drawBoxBar();
  },
  // 아래 출전 칸 3개: 체크가 있으면 칸마다 반짝이는 🔄 버튼 (빈 칸은 ➕)
  drawBoxBar() {
    const p = this.gs.player, bar = this.boxBar, pick = this.boxPick;
    this.tweens.killTweensOf(bar.list);
    bar.removeAll(true);
    bar.add(fadeLine(this, 320, 296, 600, .35));
    bar.add(hkText(this, 40, SLOT_Y, '출전', 10, pick ? HK.gold : HK.dim, { bold: true, ls: 2, origin: .5 }));
    [0, 1, 2].forEach(i => {
      const m = p.members[i], sx = SLOT_X(i), sy = SLOT_Y;
      if (m) bar.add(this.add.image(sx, sy, roundPortrait(this, p.portraitKey(m))).setScale(.7).setAlpha(m.alive ? 1 : .45));
      bar.add(hiImage(this, sx, sy, 'gloss').setScale(.7 / RES));
      bar.add(hiImage(this, sx, sy, pick ? 'slot3d-gold' : 'slot3d').setScale(.7 / RES).setAlpha(m || pick ? 1 : .4));
      bar.add(hkText(this, sx - 13, sy - 15, String(i + 1), 8, pick ? HK.gold : HK.faint, { bold: true, origin: .5 }));
      bar.add(hkText(this, sx, sy + 17, m ? `${p.formName(m)} · ${xpOf(m)} XP` : '빈 자리', 6.5, m ? HK.dim : HK.faint, { origin: [.5, 0] }));
      if (pick) {   // 🔄 교체하기 오버레이 버튼: 금빛 고리 + 맥동 · 칸마다 조금씩 엇박으로
        const glow = this.add.image(sx, sy, 'glow').setBlendMode(ADD).setTint(0x8affb0).setScale(.7).setAlpha(.5);
        const ring = this.add.circle(sx, sy, 15, 0x0a1a12, .55).setStrokeStyle(2, 0xffd860, 1);
        const ico = hkText(this, sx, sy, m ? '🔄' : '➕', 14, '#ffffff', { origin: .5 });
        bar.add([glow, ring, ico]);
        ring.setScale(.4); ico.setScale(.4);
        this.tweens.add({ targets: [ring, ico], scale: 1, duration: 260, delay: i * 70, ease: 'Back.easeOut' });
        this.tweens.add({ targets: glow, alpha: { from: .25, to: .7 }, scale: { from: .6, to: .9 }, duration: 620, delay: i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      const z = this.add.zone(sx, sy, 40, 40).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        if (this.boxModal) return;
        if (this.boxPick) this.boxSlotTap(i);
        else if (m) { this.boxFocus = m.key; this.boxPanel.focus = m.key; this.boxPanel.build(); Sfx.play('select'); }
      });
      bar.add(z);
    });
    const pk = pick ? SPECIES[pick] : null, stored = pick ? p.stored[pick] : null;
    const pickName = pick ? (stored ? p.formName(stored) : stageName(pick, 0)) : '';
    bar.add(hkText(this, 268, SLOT_Y - 12, pick
      ? `✔ ${pickName} 선택됨${stored ? ` (${xpOf(stored)} XP)` : ' (처음 합류 · 1단)'}\n하단의 출전 포켓몬(1~3번) 중 누구와 맞바꿀지 [🔄] 버튼을 눌러 선택하세요.`
      : '위 목록에서 새로 데려갈 포켓몬 카드를 눌러 ✔ 체크하세요 (같은 카드를 다시 누르면 취소)\n떠나는 포켓몬은 보관함에서 쉰다 — 진화 · 아이템 · 기술 그대로, 다시 데려오면 이어서', 8, pick ? '#9affb8' : HK.dim, { style: { lineSpacing: 3 } }));
    bar.add(hkText(this, 268, SLOT_Y + 14, pick ? '1 ~ 3 자리 고르기 · Esc 체크 풀기' : '←→↑↓ 고르기 · Enter 체크 · Q/E 탭 · Esc 닫기', 7, HK.faint));
    if (pk && pick) {   // 체크한 포켓몬 작은 초상화 (안내 글 왼쪽)
      bar.add(this.add.image(250, SLOT_Y - 1, roundPortrait(this, stored ? p.portraitKey(stored) : SPECIES[pick].evo[0].key)).setScale(.45));
      bar.add(hkText(this, 258, SLOT_Y - 12, '✔', 8, '#7dff9a', { bold: true, origin: .5 }));
    }
  },
  // 2단계: 출전 칸 i 의 🔄 — 떠나는 포켓몬에게 쌓인 경험치(또는 진화)가 있으면 경험치 전수 확인 창부터
  boxSlotTap(i) {
    const p = this.gs.player, old = p.members[i];
    if (!this.boxPick) return;
    if (old && (xpOf(old) > 0 || old.tier > 0)) { this.boxModal = { slot: i }; Sfx.play('select'); this.openInheritModal(); return; }
    this.doBoxSwap(i, false);
  },
  doBoxSwap(i, inherit) {
    const gs = this.gs, p = gs.player, k = this.boxPick, old = p.members[i];
    if (!k) return;
    const oldName = old ? p.formName(old) : null, wasStored = !!p.stored[k];
    const res = p.inheritSwap(i, k, inherit);
    if (!res) { Sfx.play('deny'); return; }
    Save.setParty(p.members.map(m => m.key));
    this.boxPick = null; this.boxModal = null; this.boxFocus = k;
    const nm = p.formName(res.m);
    if (inherit && old) {
      Sfx.play('evolve');
      this.toast(`⚡ 경험치 전수 — ${oldName}의 ${res.total} XP 중 ${res.gain} XP(70%)를 ${nm}에게! ${oldName}은(는) 1단 · 0 XP 로 보관함에서 쉰다${res.evolve ? '  ·  진화한다!' : ''}`);
    } else {
      Sfx.play('swap');
      this.toast(`${nm}이(가) ${wasStored ? '보관함에서 돌아와 ' : ''}${i + 1}번 자리에 들어왔다!${old ? `  ·  ${oldName}은(는) 보관함에서 쉰다 (진화 · 경험치 · 아이템 그대로)` : ''}`);
    }
    if (res.evolve > 0) { gs.toggleOverlay('box'); gs.inheritEvolve(res.m, res.evolve); return; }   // 진화 기준을 넘었다: 창을 닫고 그 자리에서 진화 연출
    this.showBox();
  },

  // ---------------- ③ ⚡ 경험치 전수 확인 창 ----------------
  openInheritModal() {
    const gs = this.gs, p = gs.player, md = this.boxModal, k = this.boxPick, old = md && p.members[md.slot];
    if (!md || !k || !old) { this.boxModal = null; return; }
    if (this.inheritL) this.inheritL.destroy();
    const L = this.inheritL = this.add.container(0, 0); this.overlay.add(L);
    const g = this.add.graphics(); L.add(g);
    g.fillStyle(0x000000, .72); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(this.add.zone(0, 0, GAME_W, GAME_H).setOrigin(0).setInteractive());   // 뒤 창을 누르지 못하게
    const W = 452, H = 246, X = 320 - W / 2, Y = 52;
    glassPanel(g, X, Y, W, H, { r: 10, alpha: .97, border: 0xffd860, borderAlpha: .7 });
    const total = xpOf(old), gain = inheritGain(total), stored = p.stored[k];
    const oldName = p.formName(old), newName = stored ? p.formName(stored) : stageName(k, 0);
    const exp0 = stored ? (stored.exp || 0) : 0, tier0 = stored ? stored.tier : 0, exp1 = exp0 + gain;
    let tier1 = tier0; while (tier1 < EVO_EXP.length && exp1 >= EVO_EXP[tier1]) tier1++;
    L.add(hkText(this, 320, Y + 10, '⚡ [경험치 전수 확인] 기존 포켓몬의 경험치를 전수하시겠습니까?', 11, '#ffe08a', { bold: true, origin: [.5, 0] }));
    // 전수 대상 비교: [기존 (누적 XP)] ➔ [신규]
    const fy = Y + 52;
    L.add(this.add.image(X + 60, fy, roundPortrait(this, p.portraitKey(old))).setScale(.62));
    L.add(hiImage(this, X + 60, fy, 'slot3d').setScale(.62 / RES));
    L.add(this.add.image(X + W - 60, fy, roundPortrait(this, stored ? p.portraitKey(stored) : SPECIES[k].evo[0].key)).setScale(.62));
    L.add(hiImage(this, X + W - 60, fy, 'slot3d-gold').setScale(.62 / RES));
    L.add(hkText(this, 320, fy - 7, `[기존: ${oldName} (누적 ${total} XP)]  ➔  [신규: ${newName}${stored ? ` (${xpOf(stored)} XP)` : ''}]`, 9.5, HK.ivory, { bold: true, origin: [.5, 0] }));
    // ⚠️ 70% 전수 제한 경고 (주황 · 붉은 강조 상자)
    const wy = Y + 80, wh = 46;
    g.fillStyle(0x3a0a06, .92); g.fillRoundedRect(X + 16, wy, W - 32, wh, 6);
    g.lineStyle(1.5, 0xff6a3a, .95); g.strokeRoundedRect(X + 16, wy, W - 32, wh, 6);
    g.fillStyle(0xff6a3a, .9); g.fillRect(X + 16, wy + 4, 3, wh - 8);
    L.add(hkText(this, 320, wy + 6, '⚠️ 주의: 경험치 전수 시 유실이 발생하여 기존 누적 경험치의 【 70% 】만 전수됩니다! (나머지 30% 경험치는 영구 소멸하며, 전수받은 총 경험치에 맞춰 신규 포켓몬의 진화 단계가 재계산됩니다.)',
      8.5, '#ffb08a', { bold: true, origin: [.5, 0], style: { align: 'center', wordWrap: { width: W - 56, useAdvancedWrap: true }, lineSpacing: 2 } }));
    // 실시간 전수 수치 프리뷰 · 진화 예고
    const py = wy + wh + 10;
    L.add(hkText(this, 320, py, `전수 시 획득 경험치: ${total} XP  ➔  ${gain} XP (70% 반영)`, 10, '#9affd8', { bold: true, origin: [.5, 0] }));
    const evoTxt = tier1 > tier0 ? `✨ ${stageName(k, tier1)}(으)로 진화! (${tier1 + 1}단)` : tier1 >= EVO_EXP.length ? '최종 진화 유지' : `${tier1 + 1}단 유지 · 다음 진화까지 ${Math.ceil(EVO_EXP[tier1] - exp1)} XP`;
    L.add(hkText(this, 320, py + 15, `${newName}: ${Math.floor(exp0)} → ${Math.floor(exp1)} XP · ${evoTxt}`, 8.5, tier1 > tier0 ? '#ffe08a' : HK.ivory, { origin: [.5, 0] }));
    L.add(hkText(this, 320, py + 29, `전수하면 ${oldName}은(는) 경험치 0 · 1단(${stageName(old.key, 0)})으로 돌아가 보관함에서 쉰다`, 7.5, HK.dim, { origin: [.5, 0] }));
    // 버튼 2종 + 취소
    const by = Y + H - 44;
    const yes = glassButton(this, X + 16, by, 206, 24, '[ ⚡ 예 (70% 경험치 전수 후 교체) ]', () => this.doBoxSwap(md.slot, true), { size: 8.5, primary: true, ls: 0 });
    const no = glassButton(this, X + W - 222, by, 206, 24, '[ ❌ 아니오 (경험치 전수 없이 단순 교체) ]', () => this.doBoxSwap(md.slot, false), { size: 8.5, ls: 0 });
    const cancel = glassButton(this, 320 - 34, by + 28, 68, 14, '취소 (Esc)', () => this.overlayBack(), { size: 7.5, ls: 0 });
    for (const b of [yes, no, cancel]) for (const o of b.objs) L.add(o);
    L.add(hkText(this, X + W - 10, by + 30, 'Y / 1 예 · N / 2 아니오', 7, HK.faint, { origin: [1, 0] }));
    L.setAlpha(0); this.tweens.add({ targets: L, alpha: 1, duration: 160 });
  },

  // 키보드 (UIScene.onOverlayKey 가 넘긴다)
  boxKey(e) {
    const c = e.code;
    if (this.boxModal) {
      if (c === 'KeyY' || c === 'Digit1' || c === 'Numpad1') this.doBoxSwap(this.boxModal.slot, true);
      else if (c === 'KeyN' || c === 'Digit2' || c === 'Numpad2') this.doBoxSwap(this.boxModal.slot, false);
      return;
    }
    const d = /^(Digit|Numpad)[1-3]$/.test(c) ? +c.slice(-1) - 1 : -1;
    if (this.boxPick && d >= 0) { this.boxSlotTap(d); return; }
    if (this.boxPanel) this.boxPanel.key(e);
  },
  // Esc 한 단계 뒤로 (GameScene.togglePause 가 먼저 묻는다): 확인 창 → 체크 → (false 면 창 닫기)
  overlayBack() {
    if (this.overlayMode !== 'box') return false;
    if (this.boxModal) { this.boxModal = null; if (this.inheritL) { this.inheritL.destroy(); this.inheritL = null; } Sfx.play('select'); return true; }
    if (this.boxPick) { this.boxPick = null; Sfx.play('select'); this.drawBoxBar(); this.boxPanel.build(); return true; }
    return false;
  }
};

export function installCenterMenu(cls) { Object.assign(cls.prototype, CenterMenu); }
