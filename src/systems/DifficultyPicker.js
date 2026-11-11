// 🎚️ 새 게임 난이도 선택 창 (로비에서 파티를 고르고 [던전 입장]을 누른 직후 — scenes/LobbyScene.js)
//  [ ⚔️ 보통 ] · [ 🔥 어려움 (권장) ] · [ 💀 매우 어려움 ] 카드 셋: 아이콘 · 이름 · 핵심 수치 요약(체력 · 피해 · 탄속 · 패턴 · 그로기) · 설명
//  카드를 누르면 고르고, 고른 카드를 한 번 더 누르거나 [이 난이도로 시작] · Enter/Space 로 확정 · ← → · 1 ~ 3 · Esc 뒤로
//  고른 값은 설정(Settings 'difficulty')에 남는다 — 일시정지 메뉴 · 테스트룸 위 바에서 언제든 바꿀 수 있다
import Phaser from 'phaser';
import { DIFFICULTY, DIFF_ORDER, diffId } from '../data/difficulty.js';
import { HK, hkText, glassPanel, glassButton } from './ui.js';
import { Sfx } from './Audio.js';

const ADD = Phaser.BlendModes.ADD;
const CW = 186, CH = 196, CY = 76;

export class DifficultyPicker {
  // o: { onPick(id), onCancel() }
  constructor(scene, o) {
    this.s = scene; this.o = o;
    this.sel = DIFF_ORDER.indexOf(diffId());
    this.L = scene.add.container(0, 0).setDepth(50);
    this.build();
    this.L.setAlpha(0); scene.tweens.add({ targets: this.L, alpha: 1, duration: 180 });
  }
  build() {
    const s = this.s, L = this.L;
    s.tweens.killTweensOf(L.list);
    L.removeAll(true);
    const g = s.add.graphics(); L.add(g);
    g.fillStyle(0x05040a, .97); g.fillRect(0, 0, 640, 360);   // 뒤 로비 글자가 비치지 않게 거의 불투명
    L.add(s.add.zone(0, 0, 640, 360).setOrigin(0).setInteractive());   // 뒤 로비를 누르지 못하게
    L.add(hkText(s, 320, 20, '난이도 선택', 16, HK.ivory, { bold: true, origin: [.5, 0], glow: true }));
    L.add(hkText(s, 320, 44, '현재 밸런스(하드코어)가 🔥 어려움의 기준점입니다 · 플레이 도중 일시정지(Esc) 메뉴에서 언제든 바꿀 수 있어요', 8.5, HK.dim, { origin: [.5, 0] }));
    DIFF_ORDER.forEach((id, i) => {
      const d = DIFFICULTY[id], on = i === this.sel, cx = 320 + (i - 1) * (CW + 16), x = cx - CW / 2, y = CY;
      if (on) { const glow = s.add.image(cx, y + CH / 2, 'glow').setBlendMode(ADD).setTint(d.color).setScale(3.2, 3.6).setAlpha(.22); L.add(glow); s.tweens.add({ targets: glow, alpha: .34, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); }
      glassPanel(g, x, y, CW, CH, { r: 8, alpha: .94, fill: on ? 0x18121e : 0x0d0c16, border: d.color, borderAlpha: on ? .95 : .3 });
      if (on) { g.lineStyle(1, d.color, .4); g.strokeRoundedRect(x - 3, y - 3, CW + 6, CH + 6, 10); }
      L.add(hkText(s, cx, y + 10, d.icon, 20, '#ffffff', { origin: [.5, 0] }));
      L.add(hkText(s, cx, y + 38, d.name, 13, on ? d.hex : HK.ivory, { bold: true, origin: [.5, 0] }));
      L.add(hkText(s, cx, y + 56, d.en + (d.recommend ? '  ·  권장' : ''), 7.5, d.recommend ? HK.gold : HK.dim, { origin: [.5, 0], bold: !!d.recommend }));
      g.fillStyle(d.color, on ? .6 : .25); g.fillRect(x + 16, y + 70, CW - 32, 1);
      d.lines.forEach((ln, k) => L.add(hkText(s, x + 14, y + 76 + k * 12, `· ${ln}`, 8, on ? HK.ivory : HK.dim)));
      L.add(hkText(s, cx, y + 82 + d.lines.length * 12, d.desc, 7, on ? '#d8d0c0' : HK.faint, { origin: [.5, 0], style: { align: 'center', wordWrap: { width: CW - 20, useAdvancedWrap: true }, lineSpacing: 1 } }));
      const z = s.add.zone(x, y, CW, CH).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { if (this.sel === i) this.pick(); else { this.sel = i; Sfx.play('select'); this.build(); } });
      L.add(z);
    });
    const d = DIFFICULTY[DIFF_ORDER[this.sel]];
    const ok = glassButton(s, 320 - 96, CY + CH + 14, 192, 22, `${d.icon} ${d.name}(으)로 시작  (Enter)`, () => this.pick(), { size: 9.5, primary: true, ls: 0 });
    const back = glassButton(s, 320 - 40, CY + CH + 40, 80, 16, '뒤로 (Esc)', () => this.cancel(), { size: 8, ls: 0 });
    for (const b of [ok, back]) for (const o of b.objs) L.add(o);
    L.add(hkText(s, 320, 346, '← → · 1 ~ 3 고르기  ·  Enter / Space 시작  ·  Esc 뒤로', 7.5, HK.faint, { origin: .5 }));
  }
  pick() { const id = DIFF_ORDER[this.sel]; Sfx.play('unlock'); this.destroy(); if (this.o.onPick) this.o.onPick(id); }
  cancel() { Sfx.play('select'); this.destroy(); if (this.o.onCancel) this.o.onCancel(); }
  // 키보드 (처리했으면 true)
  key(e) {
    const c = e.code, d = /^(Digit|Numpad)[1-3]$/.test(c) ? +c.slice(-1) - 1 : -1;
    if (c === 'ArrowLeft' || c === 'ArrowRight') { this.sel = (this.sel + (c === 'ArrowRight' ? 1 : -1) + 3) % 3; Sfx.play('select'); this.build(); }
    else if (d >= 0) { this.sel = d; Sfx.play('select'); this.build(); }
    else if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') this.pick();
    else if (c === 'Escape') this.cancel();
    else return false;
    return true;
  }
  destroy() { if (this.L) { this.s.tweens.killTweensOf(this.L.list); this.L.destroy(); this.L = null; } }
}
