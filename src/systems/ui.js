// 할로우 나이트풍 UI 도우미 — 어둠 위의 상아색 명조 글자, 양끝이 흐려지는 가는 선, 유리·금속 질감의 패널과 막대
// 장식 문양은 쓰지 않고 그라데이션·반사광·그림자로 입체감을 준다. 포켓몬 색은 몬스터볼 빨강·심연 보라·타입색으로만 포인트.
import Phaser from 'phaser';
import { TYPES } from '../data/types.js';
import { txt, FONT_TITLE, RES } from '../config.js';

export const HK = {
  ivory: '#efeae0', ivoryN: 0xefeae0, dim: '#9a96ac', dimN: 0x9a96ac, faint: '#5e5a74', faintN: 0x5e5a74,
  red: '#ff7a72', redN: 0xe8484a, abyss: '#c4a4ff', abyssN: 0xa070ff, gold: '#ffd890', goldN: 0xffd890, ink: 0x07060c
};

// 글자: 기본은 살짝 떠 보이는 그림자, glow 면 은은하게 빛난다 (canvas 그림자는 확대되지 않으므로 RES 를 곱한다)
//  o: { ls 자간, bold, title(로마자 제목체), glow, glowColor, flat(그림자 없음), origin, style }
export function hkText(scene, x, y, s, size = 12, color = HK.ivory, o = {}) {
  const extra = Object.assign({}, o.bold ? { fontStyle: 'bold' } : {}, o.title ? { fontFamily: FONT_TITLE } : {}, o.style || {});
  const t = scene.add.text(x, y, s, txt(size, color, extra));
  if (o.ls) t.setLetterSpacing(o.ls);
  if (o.glow) t.setShadow(0, 0, o.glowColor || 'rgba(239,234,224,0.6)', (o.blur ?? 5) * RES, false, true);
  else if (!o.flat) t.setShadow(0, .8 * RES, 'rgba(0,0,0,0.9)', 1.6 * RES, false, true);
  if (o.origin !== undefined) t.setOrigin(...[].concat(o.origin));
  return t;
}

// 고해상도 텍스처를 1:1 로 찍는다
export const hiImage = (scene, x, y, key) => scene.add.image(x, y, key).setScale(1 / RES);

// 양끝이 어둠 속으로 사라지는 가는 선
export const fadeLine = (scene, x, y, w, alpha = .75) => scene.add.image(x, y, 'line-fade').setDisplaySize(w, 6).setAlpha(alpha);

// 좌우 끝이 어둠 속으로 흐려지는 가로 띠
export function darkBand(g, x, y, w, h, alpha = .7, color = 0x05040a) {
  const n = 8, a = 1 - Math.pow(1 - alpha, 1 / n);   // 겹칠수록 가운데가 alpha 에 가까워진다
  g.fillStyle(color, a);
  for (let i = 0; i < n; i++) {
    const ix = w * .055 * i, iy = h * .045 * i;
    g.fillRect(x + ix, y + iy, w - ix * 2, h - iy * 2);
  }
}

// 유리 패널: 둥근 모서리 + 위가 살짝 밝은 그라데이션 + 위쪽 반사선 + 옅은 테두리 + 아래 그림자
export function glassPanel(g, x, y, w, h, o = {}) {
  const r = o.r ?? 6, a = o.alpha ?? .82;
  g.fillStyle(0x000000, .45 * a); g.fillRoundedRect(x + 1, y + 2.5, w, h, r);                 // 떠 있는 그림자
  g.fillStyle(o.fill ?? 0x0d0c16, a); g.fillRoundedRect(x, y, w, h, r);
  g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, .07, .07, 0, 0);
  g.fillRect(x + r * .6, y + 1, w - r * 1.2, h * .45);                                         // 위가 밝은 유리 결
  g.lineStyle(1, o.border ?? HK.ivoryN, o.borderAlpha ?? .22); g.strokeRoundedRect(x + .5, y + .5, w - 1, h - 1, r);
  g.lineStyle(1, 0xffffff, .14); g.lineBetween(x + r, y + 1.5, x + w - r, y + 1.5);              // 위쪽 반사선
}

// 입체 막대 (체력·진행도): 움푹한 홈 + 위는 밝고 아래는 짙은 채움 + 반사선
export function bar3d(g, x, y, w, h, k, color, o = {}) {
  k = Phaser.Math.Clamp(k, 0, 1);
  const c = Phaser.Display.Color.ValueToColor(color), hi = c.clone().lighten(28).color, lo = c.clone().darken(30).color;
  g.fillStyle(0x000000, .7); g.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, Math.min(3, (h + 2) / 2));
  g.fillStyle(o.track ?? 0x1c1a28, 1); g.fillRect(x, y, w, h);
  g.fillStyle(0x000000, .45); g.fillRect(x, y, w, Math.max(1, h * .35));                          // 홈 안쪽 그림자
  if (k > 0) {
    const fw = Math.max(1, w * k);
    g.fillGradientStyle(hi, hi, lo, lo, 1); g.fillRect(x, y, fw, h);
    g.fillStyle(0xffffff, .45); g.fillRect(x, y, fw, Math.max(.6, h * .2));
  }
}

// 타입 알약: 타입색 그라데이션 + 반사선, 반환값 = 너비
export function typePill(scene, layer, x, y, type, size = 10) {
  const t = TYPES[type] || TYPES.normal;
  const label = hkText(scene, 0, 0, t.name, size, '#ffffff', { bold: true });
  const w = Math.round(label.width) + 14, h = Math.round(label.height) + 2;
  const g = scene.add.graphics();
  const dark = Phaser.Display.Color.ValueToColor(t.color).darken(30).color;
  g.fillStyle(0x000000, .5); g.fillRoundedRect(x + .5, y + 1.5, w, h, h / 2);
  g.fillStyle(dark, 1); g.fillRoundedRect(x, y, w, h, h / 2);                                   // 아래쪽 그늘
  g.fillStyle(t.color, 1); g.fillRoundedRect(x, y, w, h - 1.5, (h - 1.5) / 2);
  g.fillStyle(0xffffff, .25); g.fillRoundedRect(x + 2, y + 1, w - 4, h * .4, h / 4);           // 반사광
  label.setPosition(x + 7, y + 1);
  if (layer) layer.add([g, label]);
  return w;
}

// 유리 버튼 (주 버튼은 금빛 테두리). 반환값 { setEnabled, setLabel, objs }
export function glassButton(scene, x, y, w, h, label, onClick, o = {}) {
  const g = scene.add.graphics();
  const t = hkText(scene, x + w / 2, y + h / 2, label, o.size ?? 12, HK.ivory, { ls: o.ls ?? 1, bold: o.bold, origin: .5, glow: o.primary });
  const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  const b = { enabled: true, hover: false, objs: [g, t, zone] };
  b.draw = () => {
    g.clear();
    const on = b.enabled;
    glassPanel(g, x, y, w, h, { r: h / 2.4, fill: on && b.hover ? 0x221e34 : 0x0f0d18, border: o.primary && on ? HK.goldN : HK.ivoryN, borderAlpha: on ? (b.hover ? .8 : o.primary ? .6 : .3) : .1, alpha: .9 });
    t.setColor(on ? (o.primary ? HK.gold : HK.ivory) : HK.faint);
  };
  b.setEnabled = v => { b.enabled = v; b.draw(); };
  b.setLabel = s => t.setText(s);
  zone.on('pointerover', () => { b.hover = true; b.draw(); });
  zone.on('pointerout', () => { b.hover = false; b.draw(); });
  zone.on('pointerdown', () => { if (b.enabled) onClick(); });
  if (o.layer) o.layer.add(b.objs);
  b.draw();
  return b;
}

// 메뉴 목록: 고른 항목은 밝아지고 뒤에 은은한 빛, 양옆에 짧은 가는 선이 붙는다. 키보드(↑↓ Enter)·마우스·터치 지원.
export function hkMenu(scene, x, y, items, o = {}) {
  const gap = o.gap ?? 24, size = o.size ?? 12, objs = [];
  const halo = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xefeae0).setAlpha(.16);
  const ll = fadeLine(scene, 0, y, 34, .7), lr = fadeLine(scene, 0, y, 34, .7);
  objs.push(halo, ll, lr);
  const m = { index: 0, items, objs };
  items.forEach((it, i) => {
    const t = hkText(scene, x, y + i * gap, it.label, size, HK.ivory, { ls: o.ls ?? 2, origin: .5, bold: o.bold });
    const zone = scene.add.zone(x, y + i * gap, Math.max(140, t.width + 70), gap).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => m.select(i));
    zone.on('pointerdown', () => { m.select(i); m.pick(); });
    objs.push(t, zone); it.t = t;
  });
  m.select = i => {
    m.index = Phaser.Math.Wrap(i, 0, items.length);
    items.forEach((it, k) => it.t.setColor(it.enabled === false ? HK.faint : k === m.index ? HK.ivory : HK.dim));
    const t = items[m.index].t, on = items[m.index].enabled !== false;
    halo.setPosition(t.x, t.y).setDisplaySize(t.width + 80, t.height * 2.2).setVisible(on);
    ll.setPosition(t.x - t.width / 2 - 24, t.y).setVisible(on);
    lr.setPosition(t.x + t.width / 2 + 24, t.y).setVisible(on);
  };
  m.move = d => { m.select(m.index + d); if (o.onMove) o.onMove(); };
  m.pick = () => { const it = items[m.index]; if (it.enabled !== false && it.onPick) it.onPick(); };
  const pickKeys = o.pickKeys || ['Enter', 'Space', 'KeyZ'];
  m.key = e => {
    if (e.code === 'ArrowUp') m.move(-1);
    else if (e.code === 'ArrowDown') m.move(1);
    else if (pickKeys.includes(e.code)) m.pick();
  };
  if (o.layer) o.layer.add(objs);
  m.select(0);
  return m;
}
