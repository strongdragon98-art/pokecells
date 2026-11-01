// 포켓샵(프렌들리숍) 창: 포켓몬센터 옆 포켓샵 정문에서 F / ↑ / 터치 → 게임이 멈추고 이 창이 뜬다 (GameScene.openShop)
//  위: 황금빛 네온 보유 금액 · 왼쪽 [🛍️ 도구 구매] (소비·성장 / 전술 도구 / 특수 핵심 탭) · 오른쪽 [💰 아이템 판매] (금구슬 일괄 판매 버튼)
//  줄을 누르면 고르고, 아래 [−] 수량 [+] 로 여러 개를 한 번에 사고판다. 1만 ₽ 이 넘는 거래는 한 번 더 눌러 확정
//  잠근 것(🔒): 품절 · 키스톤/Z링 전 · 장착 중인 도구 · 전설 유물 · 메가스톤/Z크리스탈 — 실수로 팔지 않게
//  키보드: ← → 구매/판매 창 · ↑↓ 고르기 · 1~3 / Tab 구매 탭 · − + 수량 · Enter 사기/팔기 · G 금구슬 일괄 판매 · Esc 닫기
import Phaser from 'phaser';
import { GAME_W, GAME_H, RES } from '../config.js';
import { SHOP_CATS, shopGoods, sellables, goodsInfo, nuggetTotal, won, NUGGETS, NUGGET_KEYS, USES } from '../data/shop.js';
import { ITEMS } from '../data/items.js';
import { HK, hkText, glassPanel, glassButton, fadeLine } from '../systems/ui.js';
import { Sfx } from '../systems/Audio.js';
import { Settings, keyLabel } from '../systems/Settings.js';

const ADD = Phaser.BlendModes.ADD;
const GOLD = 0xffc84a, BLUE = 0x4a8aff;
const PY = 58, PH = 270, PW = 304, PX = { buy: 12, sell: 324 };   // 두 창
const LY = 104, ROW = 20, ROWS = 6;                                // 목록 줄
const CONFIRM_AT = 10000;                                          // 이 금액 이상은 두 번 눌러 확정

export const ShopMenu = {
  showShop() {
    this.clearOverlay();
    this.toastT = 0;
    const gs = this.gs, p = gs.player, g = this.gOver, L = this.overlay.setVisible(true), at = gs.shopAt || { key: '?', city: '포켓샵' };
    if (!this.shopTab) this.shopTab = 'grow';
    if (!this.shopPane) this.shopPane = 'buy';
    g.fillStyle(0x05040a, .96); g.fillRect(0, 0, GAME_W, GAME_H);
    L.add(this.add.image(170, 190, 'glow').setBlendMode(ADD).setTint(BLUE).setScale(6, 4).setAlpha(.1));
    L.add(this.add.image(480, 190, 'glow').setBlendMode(ADD).setTint(GOLD).setScale(6, 4).setAlpha(.08));

    // ── 머리: 간판 · 보유 금액 (황금빛 네온) · 닫기
    L.add(hkText(this, 16, 12, 'POKé MART', 13, '#8ad8ff', { bold: true, ls: 2, glow: true, glowColor: 'rgba(90,170,255,.9)' }));
    L.add(hkText(this, 16, 32, `${at.city} 포켓샵 · 프렌들리숍`, 8, HK.dim));
    const from = this.shopMoneyShown ?? p.money;
    const money = hkText(this, 320, 26, `💰 보유 금액: ${won(from)}`, 17, '#ffd84a', { bold: true, origin: .5, glow: true, glowColor: 'rgba(255,190,40,.95)', blur: 7, ls: 0 });
    L.add([this.add.image(320, 26, 'glow').setBlendMode(ADD).setTint(GOLD).setDisplaySize(money.width + 70, 34).setAlpha(.28), money]);
    if (from !== p.money) {   // 거래하면 숫자가 또르륵 굴러간다
      this.tweens.addCounter({ from, to: p.money, duration: 420, ease: 'Cubic.easeOut', onUpdate: tw => { if (money.scene) money.setText(`💰 보유 금액: ${won(tw.getValue())}`); } });
      this.tweens.add({ targets: money, scale: { from: 1.12, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    }
    this.shopMoneyShown = p.money;
    L.add(fadeLine(this, 320, 48, 600, .5));
    glassButton(this, 566, 8, 64, 20, '✕  닫기', () => gs.toggleOverlay('shop'), { size: 9, layer: L });

    this.shopBuyPane(L, g, p, at);
    this.shopSellPane(L, g, p);
    if (!this.touch.visible) L.add(hkText(this, 320, 344, '← → 구매/판매  ·  ↑↓ 고르기  ·  1~3 탭  ·  − + 수량  ·  Enter 사기/팔기  ·  G 금구슬 일괄 판매  ·  Esc 닫기', 7.5, HK.faint, { origin: .5 }));
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'shop';
  },

  // 목록 한 창 공통: 줄 그리기 · 스크롤 (휠 · ▲▼) · 고른 줄
  shopList(L, g, pane, list, sel, rowFn) {
    const x = PX[pane], key = pane === 'buy' ? 'shopScrollB' : 'shopScrollS';
    const max = Math.max(0, list.length - ROWS);
    let top = Math.min(this[key] || 0, max);
    if (sel >= 0 && sel < top) top = sel;
    if (sel >= top + ROWS) top = sel - ROWS + 1;
    this[key] = top;
    g.fillStyle(0x0a0914, .7); g.fillRoundedRect(x + 8, LY - 2, PW - 16, ROWS * ROW + 4, 6);
    const onWheel = (ptr, dx, dy) => { const nt = Phaser.Math.Clamp(top + Math.sign(dy), 0, max); if (nt !== top) { this[key] = nt; this.showShop(); } };
    if (!list.length) L.add(hkText(this, x + PW / 2, LY + ROWS * ROW / 2, pane === 'buy' ? (this.shopTab === 'core' ? '파티 모두 메가스톤 · Z크리스탈을 갖췄어요\n새 동료를 데려오면 그 포켓몬의 것이 진열돼요' : '진열된 물건이 없어요') : '팔 수 있는 물건이 없어요\n엘리트 · 보스가 떨어뜨리는 금구슬을 모아 오세요', 8, HK.faint, { origin: .5, style: { align: 'center', lineSpacing: 4 } }));
    list.slice(top, top + ROWS).forEach((e, k) => {
      const i = top + k, y = LY + k * ROW + ROW / 2, on = i === sel && this.shopPane === pane;
      if (i === sel) {
        g.fillStyle(on ? 0x2c2650 : 0x1c1a30, 1); g.fillRoundedRect(x + 10, y - ROW / 2 + 1, PW - 34, ROW - 2, 4);
        g.lineStyle(1.2, on ? HK.goldN : HK.ivoryN, on ? .9 : .3); g.strokeRoundedRect(x + 10, y - ROW / 2 + 1, PW - 34, ROW - 2, 4);
      }
      rowFn(e, x, y, i === sel);
      const z = this.add.zone(x + 10, y - ROW / 2, PW - 34, ROW).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { if (this.shopPane === pane && sel === i) return; this.shopPane = pane; this.shopSelect(pane, i); });
      z.on('wheel', onWheel);
      L.add(z);
    });
    if (list.length > ROWS) {   // 스크롤 막대 · ▲▼
      const sx = x + PW - 18, h = ROWS * ROW - 24, bh = Math.max(12, h * ROWS / list.length), by = LY + 12 + (h - bh) * (top / max);
      g.fillStyle(0xffffff, .08); g.fillRect(sx + 2, LY + 12, 4, h);
      g.fillStyle(HK.goldN, .7); g.fillRect(sx + 2, by, 4, bh);
      for (const [d, yy, s] of [[-1, LY + 4, '▲'], [1, LY + ROWS * ROW - 4, '▼']]) {
        const t = hkText(this, sx + 4, yy, s, 7, HK.dim, { origin: .5 }).setInteractive({ useHandCursor: true });
        t.on('pointerdown', () => { this[key] = Phaser.Math.Clamp(top + d * 3, 0, max); Sfx.play('select'); this.showShop(); });
        L.add(t);
      }
    }
    const wz = this.add.zone(x + 8, LY - 2, PW - 16, ROWS * ROW + 4).setOrigin(0).setInteractive();
    wz.on('wheel', onWheel);
    L.addAt(wz, 0);
  },
  // 그림: 도구 · 소모품 · 금구슬은 가방 그림, 메가스톤 · Z크리스탈은 속성 색 결정
  shopIcon(x, y, e, size) {
    const info = goodsInfo(e);
    if (info.tex) return this.add.image(x, y, info.tex).setScale(size / 12).setTint(info.tint);
    return this.itemImage(x, y, info.art, size, size / 12);
  },
  shopPanel(g, pane, title, col) {
    const x = PX[pane], on = this.shopPane === pane;
    glassPanel(g, x, PY, PW, PH, { alpha: .92, border: on ? col : HK.ivoryN, borderAlpha: on ? .55 : .15 });
    g.fillStyle(col, on ? .9 : .35); g.fillRect(x + 12, PY, PW - 24, 2);
    const t = hkText(this, x + PW / 2, PY + 10, title, 10, on ? HK.ivory : HK.dim, { bold: true, origin: .5, ls: 0 });   // ls 0: 자간을 벌리면 그림 글자가 쪼개진다
    t.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (this.shopPane !== pane) { this.shopPane = pane; Sfx.play('select'); this.showShop(); } });
    return t;
  },

  // ================= 왼쪽: 🛍️ 도구 구매 =================
  shopBuyList(p) {
    const all = shopGoods(p, (this.gs.shopAt || {}).key);
    return all.filter(e => e.cat === this.shopTab);
  },
  shopBuyPane(L, g, p) {
    const x = PX.buy;
    L.add(this.shopPanel(g, 'buy', '[ 🛍️ 도구 구매 (BUY) ]', BLUE));
    SHOP_CATS.forEach(([id, label], i) => glassButton(this, x + 10 + i * 96, PY + 22, 92, 18, label, () => { if (this.shopTab !== id) { this.shopTab = id; this.shopBuySel = 0; this.shopScrollB = 0; this.shopPane = 'buy'; this.shopQty = 1; Sfx.play('select'); this.showShop(); } }, { size: 8, bold: true, ls: 0, layer: L, primary: this.shopTab === id }));
    const list = this.shopBuyList(p), sel = list.length ? Math.min(this.shopBuySel || 0, list.length - 1) : -1;
    this.shopBuySel = Math.max(0, sel);
    this.shopList(L, g, 'buy', list, sel, (e, rx, y) => {
      const info = goodsInfo(e), lock = !!e.lock;
      const ic = this.shopIcon(rx + 22, y, e, 15); if (lock) ic.setAlpha(.4); L.add(ic);
      L.add(this.fit(hkText(this, rx + 34, y, info.name, 8.5, lock ? HK.faint : HK.ivory, { origin: [0, .5], bold: true }), 108));
      const tag = e.tag || '';
      if (tag) L.add(hkText(this, rx + 150, y, tag, 7, lock ? HK.red : '#8ad8ff', { origin: [0, .5] }));
      L.add(hkText(this, rx + PW - 28, y, won(e.price), 8.5, lock ? HK.faint : p.money >= e.price ? '#ffd84a' : HK.red, { origin: [1, .5], bold: true }));
    });
    const e = list[sel];
    this.shopDetail(L, g, 'buy', e, p);
  },

  // ================= 오른쪽: 💰 아이템 판매 =================
  shopSellList(p) {
    // 팔 수 있는 것 먼저, 잠근 것은 뒤로
    return sellables(p).sort((a, b) => (!!a.lock - !!b.lock));
  },
  shopSellPane(L, g, p) {
    const x = PX.sell, total = nuggetTotal(p);
    L.add(this.shopPanel(g, 'sell', '[ 💰 아이템 판매 (SELL) ]', GOLD));
    const bulk = glassButton(this, x + 10, PY + 22, PW - 20, 18, total ? `✨ 금구슬(환금 아이템) 일괄 판매   +${won(total)}` : '✨ 금구슬(환금 아이템) 일괄 판매   — 가방에 금구슬이 없어요', () => this.shopSellNuggets(), { size: 8, bold: true, ls: 0, layer: L, primary: total > 0 });
    bulk.setEnabled(total > 0);
    const list = this.shopSellList(p), sel = list.length ? Math.min(this.shopSellSel || 0, list.length - 1) : -1;
    this.shopSellSel = Math.max(0, sel);
    this.shopList(L, g, 'sell', list, sel, (e, rx, y) => {
      const info = goodsInfo(e), lock = !!e.lock;
      const ic = this.shopIcon(rx + 22, y, e, 15); if (lock) ic.setAlpha(.45); L.add(ic);
      if (e.kind === 'nugget') L.add(this.add.image(rx + 22, y, 'glow').setBlendMode(ADD).setTint(NUGGETS[e.id].color).setScale(.35).setAlpha(.5));
      L.add(this.fit(hkText(this, rx + 34, y, `${info.name}${e.from >= 0 ? ` (${e.from + 1}번 장착)` : ''}`, 8.5, lock ? HK.faint : e.kind === 'nugget' ? '#ffe08a' : HK.ivory, { origin: [0, .5], bold: true }), 118));
      L.add(hkText(this, rx + 158, y, `×${e.n}`, 8, lock ? HK.faint : HK.dim, { origin: [0, .5] }));
      L.add(hkText(this, rx + PW - 28, y, lock ? '🔒 판매 불가' : won(e.price), 8.5, lock ? HK.faint : '#ffd84a', { origin: [1, .5], bold: !lock }));
    });
    this.shopDetail(L, g, 'sell', list[sel], p);
  },
  fit(t, w) { if (t.width > w) t.setScale(w / t.width, 1); return t; },

  // 고른 물건의 설명 · 수량 · 사기/팔기 버튼 (창 아래쪽)
  shopDetail(L, g, pane, e, p) {
    const x = PX[pane], DY = LY + ROWS * ROW + 8, active = this.shopPane === pane;
    g.lineStyle(1, HK.ivoryN, .1); g.lineBetween(x + 12, DY - 3, x + PW - 12, DY - 3);
    if (!e) return;
    const info = goodsInfo(e);
    L.add(this.add.image(x + 26, DY + 22, 'glow').setBlendMode(ADD).setTint(pane === 'buy' ? BLUE : GOLD).setScale(.6).setAlpha(.35));
    L.add(this.shopIcon(x + 26, DY + 22, e, 26));
    L.add(this.fit(hkText(this, x + 48, DY + 4, info.name, 10, HK.ivory, { bold: true }), PW - 60));
    let note = '';
    if (pane === 'buy' && e.kind === 'use' && USES[e.id].cat === 'vit') note = ' · 가방에서 먹일 포켓몬을 고른다';
    if (pane === 'buy' && e.kind === 'tool') note = ' · 가방으로 · 가방에서 장착';
    if (pane === 'buy' && e.kind === 'use' && USES[e.id].cat !== 'vit') note = e.id === 'potion' ? ` · 퀵슬롯 ${keyLabel(Settings.key('potion'))} 키 / 모바일 🧪 버튼` : ' · 가방에서 쓴다 (던전 어디서나)';
    L.add(hkText(this, x + 48, DY + 19, e.lock ? e.lock : `${info.desc}${note}`, 7.5, e.lock ? HK.red : HK.dim, { style: { wordWrap: { width: PW - 60, useAdvancedWrap: true }, lineSpacing: 1, maxLines: 3 } }));
    const BY = PY + PH - 30;
    if (e.lock) return;
    const max = this.shopMaxQty(pane, e, p), q = Phaser.Math.Clamp(active ? this.shopQty || 1 : 1, 1, Math.max(1, max));
    if (active) this.shopQty = q;
    const total = e.price * q, okBuy = pane === 'buy' ? max > 0 : true;
    // 수량: [−] n [+] [최대]
    const step = d => { this.shopPane = pane; this.shopQty = Phaser.Math.Clamp(q + d, 1, Math.max(1, max)); this.shopConfirm = null; Sfx.play('select'); this.showShop(); };
    glassButton(this, x + 10, BY, 22, 22, '−', () => step(-1), { size: 11, bold: true, layer: L }).setEnabled(q > 1);
    L.add(hkText(this, x + 50, BY + 11, `${q}`, 11, HK.ivory, { bold: true, origin: .5 }));
    glassButton(this, x + 68, BY, 22, 22, '+', () => step(1), { size: 11, bold: true, layer: L }).setEnabled(q < max);
    glassButton(this, x + 94, BY, 36, 22, '최대', () => step(max - q), { size: 8, bold: true, ls: 0, layer: L }).setEnabled(q < max);
    const confirm = this.shopConfirm && this.shopConfirm.pane === pane && this.shopConfirm.id === e.id && this.shopConfirm.q === q;
    const label = pane === 'buy'
      ? (max <= 0 ? (p.money < e.price ? '돈이 모자라요' : '더 살 수 없어요') : confirm ? `정말 살까요?  −${won(total)}` : `🛒 구매  −${won(total)}`)
      : (confirm ? `정말 팔까요?  +${won(total)}` : `💰 판매  +${won(total)}`);
    const b = glassButton(this, x + 136, BY, PW - 146, 22, label, () => { this.shopPane = pane; this.shopEnter(); }, { size: 8.5, bold: true, ls: 0, layer: L, primary: okBuy });
    b.setEnabled(okBuy);
  },
  // 살 수 있는 / 팔 수 있는 최대 개수
  shopMaxQty(pane, e, p) {
    if (pane === 'sell') return e.lock ? 0 : e.n;
    if (e.lock) return 0;
    const afford = Math.floor(p.money / e.price);
    return Math.max(0, Math.min(afford, e.left === null ? 99 : e.left));
  },

  shopSelect(pane, i) {
    if (pane === 'buy') this.shopBuySel = i; else this.shopSellSel = i;
    this.shopQty = 1; this.shopConfirm = null;
    Sfx.play('select');
    this.showShop();
  },

  // Enter · 버튼: 고른 창의 고른 물건을 수량만큼 사거나 판다 (큰 거래는 한 번 더 눌러 확정)
  shopEnter() {
    const p = this.gs.player, pane = this.shopPane;
    const list = pane === 'buy' ? this.shopBuyList(p) : this.shopSellList(p), e = list[pane === 'buy' ? this.shopBuySel : this.shopSellSel];
    if (!e) return;
    if (e.lock) { Sfx.play('deny'); this.toast(e.lock.replace('🔒 ', '')); return; }
    const max = this.shopMaxQty(pane, e, p), q = Math.min(this.shopQty || 1, max);
    if (q <= 0) { Sfx.play('deny'); this.toast(pane === 'buy' && p.money < e.price ? `돈이 모자라요 (${won(e.price - p.money)} 부족)` : '더 살 수 없어요'); return; }
    const total = e.price * q, c = this.shopConfirm;
    if (total >= CONFIRM_AT && !(c && c.pane === pane && c.id === e.id && c.q === q)) { this.shopConfirm = { pane, id: e.id, q }; Sfx.play('select'); this.showShop(); return; }
    this.shopConfirm = null;
    if (pane === 'buy') this.shopBuy(e, q); else this.shopSell(e, q);
  },

  shopBuy(e, q) {
    const gs = this.gs, p = gs.player, key = (gs.shopAt || {}).key, info = goodsInfo(e), total = e.price * q;
    if (p.money < total) { Sfx.play('deny'); return; }
    let msg;
    if (e.kind === 'candy') { p.candy = (p.candy || 0) + q; msg = `이상한사탕 ×${q} — 가방에서 먹일 포켓몬을 고르자`; }
    else if (e.kind === 'use') { p.uses[e.id] = (p.uses[e.id] || 0) + q; msg = e.id === 'potion' ? `${info.name} ×${q} — 퀵슬롯 ${p.uses[e.id]}/${e.carry}` : `${info.name} ×${q} — 가방에 넣었다`; }
    else if (e.kind === 'tool') { p.bag[e.id] = (p.bag[e.id] || 0) + q; msg = `${info.name} ×${q} — 가방에 넣었다 · 가방에서 장착`; }
    else if (e.kind === 'stone') {
      if (!p.gainStone(e.line)) { Sfx.play('deny'); return; }
      const m = [...p.members, ...Object.values(p.stored || {})].find(pm => pm.key === e.line);
      msg = `${info.name} 구입! ${m && m.gear.stone === e.line ? `${p.formName(m)}의 메가스톤 칸에 끼웠다` : '가방에 넣었다'}`;
    } else { p.gainCrystal(e.type); msg = `${info.name} 구입! 그 속성 포켓몬의 Z크리스탈 칸에 끼웠다 (빈 칸이 없으면 가방)`; }
    p.money -= total;
    const log = p.shopLog[key] || (p.shopLog[key] = {});
    log[e.id] = (log[e.id] || 0) + q;
    p.shopStats.bought += q; p.shopStats.spent += total;
    gs.shopDirty = true;
    Sfx.play('buy');
    this.toast(`🛒 ${msg}  (−${won(total)})`, info.art || null);
    this.shopQty = 1;
    this.showShop();
    this.shopFlash('buy');
  },
  shopSell(e, q) {
    const gs = this.gs, p = gs.player, info = goodsInfo(e), total = e.price * q;
    if (e.kind === 'nugget') { p.nuggets[e.id] -= q; if (p.nuggets[e.id] <= 0) delete p.nuggets[e.id]; }
    else if (e.kind === 'candy') p.candy = Math.max(0, p.candy - q);
    else if (e.kind === 'use') { p.uses[e.id] -= q; if (p.uses[e.id] <= 0) delete p.uses[e.id]; }
    else if (e.kind === 'tool' && e.from === undefined && !ITEMS[e.id].relic) { p.bag[e.id] -= q; if (p.bag[e.id] <= 0) delete p.bag[e.id]; }
    else { Sfx.play('deny'); return; }
    p.money += total;
    p.shopStats.sold += q; p.shopStats.earned += total;
    gs.shopDirty = true;
    Sfx.play(e.kind === 'nugget' ? 'coin' : 'sell');
    this.toast(`💰 ${info.name} ×${q} 판매  (+${won(total)})`, info.art || null);
    this.shopQty = 1;
    this.showShop();
    this.shopFlash('sell');
  },
  // ✨ 금구슬 일괄 판매: 가방 속 금구슬을 한 번에 현금으로
  shopSellNuggets() {
    const gs = this.gs, p = gs.player, total = nuggetTotal(p);
    if (!total) { Sfx.play('deny'); return; }
    const n = NUGGET_KEYS.reduce((s, id) => s + (p.nuggets[id] || 0), 0);
    p.nuggets = {};
    p.money += total;
    p.shopStats.sold += n; p.shopStats.earned += total;
    gs.shopDirty = true;
    Sfx.play('coin');
    this.toast(`✨ 금구슬 ${n}개를 한 번에 팔았다!  (+${won(total)})`, 'big_nugget');
    this.shopPane = 'sell'; this.shopSellSel = 0; this.shopQty = 1;
    this.showShop();
    this.shopFlash('sell', true);
  },
  // 거래 연출: 금화가 금액 쪽으로 튀어 오른다
  shopFlash(pane, big = false) {
    const x0 = PX[pane] + PW / 2;
    for (let k = 0; k < (big ? 14 : 6); k++) {
      const c = this.add.image(x0 + Phaser.Math.Between(-60, 60), PY + PH - 30, 'glow').setBlendMode(ADD).setTint(k % 2 ? GOLD : 0xfff6c0).setScale(.18).setDepth(61);
      this.overlay.add(c);
      this.tweens.add({ targets: c, x: 320 + Phaser.Math.Between(-30, 30), y: 26, scale: .05, alpha: { from: 1, to: .2 }, duration: 380 + k * 30, ease: 'Cubic.easeIn', onComplete: () => c.destroy() });
    }
  },

  shopKey(e) {
    const p = this.gs.player, pane = this.shopPane, n = /^(Digit|Numpad)[1-3]$/.test(e.code) ? +e.code.slice(-1) : 0;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { const to = e.code === 'ArrowLeft' ? 'buy' : 'sell'; if (to !== pane) { this.shopPane = to; this.shopQty = 1; this.shopConfirm = null; Sfx.play('select'); this.showShop(); } return; }
    if (n || e.code === 'Tab') {
      if (e.preventDefault) e.preventDefault();
      const i = n ? n - 1 : (SHOP_CATS.findIndex(c => c[0] === this.shopTab) + 1) % SHOP_CATS.length;
      this.shopTab = SHOP_CATS[i][0]; this.shopPane = 'buy'; this.shopBuySel = 0; this.shopScrollB = 0; this.shopQty = 1; this.shopConfirm = null;
      Sfx.play('select'); this.showShop(); return;
    }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      const list = pane === 'buy' ? this.shopBuyList(p) : this.shopSellList(p);
      if (!list.length) return;
      const cur = pane === 'buy' ? this.shopBuySel : this.shopSellSel;
      this.shopSelect(pane, (cur + (e.code === 'ArrowDown' ? 1 : -1) + list.length) % list.length);
      return;
    }
    if (['Minus', 'NumpadSubtract', 'Equal', 'NumpadAdd'].includes(e.code)) {
      const list = pane === 'buy' ? this.shopBuyList(p) : this.shopSellList(p), it = list[pane === 'buy' ? this.shopBuySel : this.shopSellSel];
      if (!it) return;
      const max = this.shopMaxQty(pane, it, p), d = e.code === 'Minus' || e.code === 'NumpadSubtract' ? -1 : 1, q = Phaser.Math.Clamp((this.shopQty || 1) + d, 1, Math.max(1, max));
      if (q !== this.shopQty) { this.shopQty = q; this.shopConfirm = null; Sfx.play('select'); this.showShop(); }
      return;
    }
    if (e.code === 'KeyG') { this.shopSellNuggets(); return; }
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' || e.code === 'KeyF') this.shopEnter();
  }
};

// UIScene 에 포켓샵 창을 붙인다
export function installShopMenu(cls) { Object.assign(cls.prototype, ShopMenu); }
