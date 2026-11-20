// 💠 『보스 정수 선택 (Select Boss Essence)』 창 — 2회차(New Game+) 시작 (scenes/LobbyScene.js: [던전 입장] → 난이도 → 이 창)
//  전당등록(진 엔딩)을 본 포켓몬이 파티에 있으면 열린다 · 지금까지 정화한 지방 최종 보스의 정수 중 딱 하나를 쥐고 출발 (data/essence.js)
//  카드: 정수 문양 · 이름 · 강화 단계(+0 ~ +3 별) · 지금 단계의 효과 · 다음 강화 — 아직 정화하지 않은 보스의 정수는 🔒
//  입력: 카드 클릭(두 번 누르면 확정) · ← → ↑ ↓ · Enter/Space 확정 · Esc 뒤로(난이도 선택으로)
import Phaser from 'phaser';
import { ESSENCES, ESSENCE_ORDER, ESSENCE_K, essenceLines, essenceNext } from '../data/essence.js';
import { HK, hkText, glassPanel, glassButton } from './ui.js';
import { Save } from './Save.js';
import { Sfx } from './Audio.js';

const ADD = Phaser.BlendModes.ADD;
const CW = 142, CH = 122;
const POS = [[95, 64], [245, 64], [395, 64], [545, 64], [170, 196], [320, 196], [470, 196]];   // 카드 가운데 x · 위 y

export class EssencePicker {
  // o: { onPick(id), onCancel() }
  constructor(scene, o) {
    this.s = scene; this.o = o;
    const beaten = Save.beatenBosses();
    this.list = ESSENCE_ORDER.map(id => ({ id, E: ESSENCES[id], open: !!beaten[ESSENCES[id].boss], lv: Save.essenceLv(id) }));
    const firstOpen = this.list.findIndex(c => c.open);
    this.sel = Math.max(0, this.list.findIndex(c => c.open && c.lv === Math.max(...this.list.filter(q => q.open).map(q => q.lv))), firstOpen);
    this.L = scene.add.container(0, 0).setDepth(52);
    this.build();
    this.L.setAlpha(0); scene.tweens.add({ targets: this.L, alpha: 1, duration: 200 });
  }
  get any() { return this.list.some(c => c.open); }
  build() {
    const s = this.s, L = this.L;
    s.tweens.killTweensOf(L.list);
    L.removeAll(true);
    const g = s.add.graphics(); L.add(g);
    g.fillStyle(0x05040a, .97); g.fillRect(0, 0, 640, 360);
    L.add(s.add.zone(0, 0, 640, 360).setOrigin(0).setInteractive());
    L.add(s.add.image(320, 180, 'glow').setBlendMode(ADD).setTint(0x9a7aff).setScale(7, 4).setAlpha(.1));
    L.add(hkText(s, 320, 12, '💠 보스 정수 선택  (Select Boss Essence)', 15, HK.ivory, { bold: true, origin: [.5, 0], glow: true }));
    L.add(hkText(s, 320, 34, '🏆 전당등록 포켓몬과 떠나는 2회차 — 정화한 보스의 정수 하나를 쥐고 출발 · 처음엔 미완성 파편(+0 · 수치 30%)', 8, HK.dim, { origin: [.5, 0] }));
    L.add(hkText(s, 320, 46, '여정에서 지방 최종 보스를 정화할 때마다 혼을 흡수해 +1 (최대 +3 · 영구) — +1 수치 복구 · +2 보스 코어 효과 · +3 한계 돌파', 7.5, '#c8a8ff', { origin: [.5, 0] }));
    this.list.forEach((c, i) => this.card(g, L, c, i));
    const cur = this.list[this.sel], ok = cur && cur.open;
    const btn = glassButton(s, 320 - 120, 326, 240, 22, ok ? `${cur.E.icon} ${cur.E.name} — 쥐고 출발 (Enter)` : '정수를 고르세요', () => this.pick(), { size: 9.5, primary: true, ls: 0 });
    for (const b of btn.objs) L.add(b);
    if (!ok) btn.setEnabled(false);
    const back = glassButton(s, 566, 330, 64, 16, '뒤로 (Esc)', () => this.cancel(), { size: 7.5, ls: 0 });
    for (const b of back.objs) L.add(b);
    L.add(hkText(s, 14, 344, '← → ↑ ↓ 고르기 · Enter 출발 · Esc 뒤로', 7, HK.faint));
  }
  card(g, L, c, i) {
    const s = this.s, [cx, y] = POS[i], x = cx - CW / 2, on = i === this.sel, col = c.E.color, k = ESSENCE_K[c.lv];
    if (on && c.open) { const gl = s.add.image(cx, y + CH / 2, 'glow').setBlendMode(ADD).setTint(col).setScale(2.4, 2.2).setAlpha(.22); L.add(gl); s.tweens.add({ targets: gl, alpha: .36, duration: 700, yoyo: true, repeat: -1 }); }
    glassPanel(g, x, y, CW, CH, { r: 8, alpha: .95, fill: on ? 0x18122a : 0x0c0b16, border: c.open ? col : 0x4a4a5a, borderAlpha: on ? .95 : c.open ? .4 : .2 });
    if (on && c.open) { g.lineStyle(1, col, .45); g.strokeRoundedRect(x - 3, y - 3, CW + 6, CH + 6, 10); }
    // 문양: 정수 색 구슬 + 아이콘
    const orb = s.add.image(cx, y + 20, 'glow').setBlendMode(ADD).setTint(c.open ? col : 0x5a5a6a).setScale(.9).setAlpha(c.open ? .85 : .3); L.add(orb);
    if (c.open) s.tweens.add({ targets: orb, scale: 1.05, duration: 900 + i * 80, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    L.add(hkText(s, cx, y + 20, c.open ? c.E.icon : '🔒', 16, '#ffffff', { origin: .5 }));
    L.add(hkText(s, cx, y + 38, c.E.name, 9, c.open ? (on ? HK.gold : HK.ivory) : HK.faint, { bold: true, origin: [.5, 0] }));
    if (!c.open) {
      const who = c.E.boss === 'reshiram' ? '하나 · 용나선탑의 두 영웅' : c.E.name.split('의')[0], last = who.charCodeAt(who.length - 1), jo = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 ? '을' : '를';
      L.add(hkText(s, cx, y + 60, `${who}${jo} 정화하면 열린다`, 7, HK.faint, { origin: [.5, 0], style: { align: 'center', wordWrap: { width: CW - 16, useAdvancedWrap: true } } }));
    } else {
      const stars = '★'.repeat(c.lv) + '☆'.repeat(3 - c.lv);
      L.add(hkText(s, cx, y + 52, `+${c.lv}  ${stars}  · 수치 ${Math.round(k * 100)}%`, 7.5, c.lv ? '#ffd27a' : '#c8a8ff', { bold: true, origin: [.5, 0] }));
      essenceLines(c.id, c.lv).slice(0, 4).forEach(([t, kind], j) => L.add(hkText(s, x + 9, y + 66 + j * 10, `· ${t}`, 7, kind === 'core' ? '#8ad8ff' : kind === 'over' ? '#ffd27a' : HK.ivory)));
      const nx = essenceNext(c.id, c.lv);
      if (nx) L.add(hkText(s, cx, y + CH - 12, `다음 ${nx}`, 6.2, HK.dim, { origin: [.5, 0] }));
    }
    const z = s.add.zone(x, y, CW, CH).setOrigin(0).setInteractive({ useHandCursor: c.open });
    z.on('pointerdown', () => { if (!c.open) { Sfx.play('deny'); return; } if (this.sel === i) this.pick(); else { this.sel = i; Sfx.play('select'); this.build(); } });
    L.add(z);
  }
  move(dx, dy) {
    const [cx, y] = POS[this.sel];
    let best = -1, bd = 1e9;
    this.list.forEach((c, i) => {
      if (!c.open || i === this.sel) return;
      const [x2, y2] = POS[i], ddx = x2 - cx, ddy = y2 - y;
      if ((dx && Math.sign(ddx) !== dx) || (dy && Math.sign(ddy) !== dy) || (dx && Math.abs(ddy) > 80 && !dy)) return;
      const d = Math.abs(ddx) + Math.abs(ddy) * 1.5;
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) { this.sel = best; Sfx.play('select'); this.build(); }
  }
  pick() {
    const c = this.list[this.sel];
    if (!c || !c.open) { Sfx.play('deny'); return; }
    Sfx.play('mega'); this.destroy();
    if (this.o.onPick) this.o.onPick(c.id);
  }
  cancel() { Sfx.play('select'); this.destroy(); if (this.o.onCancel) this.o.onCancel(); }
  key(e) {
    const c = e.code;
    if (c === 'ArrowLeft') this.move(-1, 0);
    else if (c === 'ArrowRight') this.move(1, 0);
    else if (c === 'ArrowUp') this.move(0, -1);
    else if (c === 'ArrowDown') this.move(0, 1);
    else if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') this.pick();
    else if (c === 'Escape') this.cancel();
    else return false;
    return true;
  }
  destroy() { if (this.L) { this.s.tweens.killTweensOf(this.L.list); this.L.destroy(); this.L = null; } }
}
