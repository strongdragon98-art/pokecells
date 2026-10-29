// 포켓몬 보관함 패널 — 로비(파티 편성)와 포켓몬센터(엔트리 교체)가 함께 쓴다
//  위: 탭 [🌱 세대별 포켓몬 | 👑 정화한 전설/보스] + 세대 필터 (전체 · 1~9세대 — 스타팅·특수 구분 없이 세대로만 묶는다)
//  왼쪽: 초상화 카드 격자 (아직 못 잡은 포켓몬은 검은 실루엣)   오른쪽: 진화 트리 · 메가 배지 · 타입 · 스킬 · 특성 · 해금 조건
//  카드를 누르면 정보창, 같은 카드를 한 번 더 누르면 onToggle (편성/교체). 키보드: ←→↑↓ 이동 · Q/E 탭 · 0~9 세대 · Enter
import Phaser from 'phaser';
import { SPECIES, SKILLS } from '../data/pokemon.js';
import { LINES, CATS, unlockHint } from '../data/roster.js';
import { HK, hkText, hiImage, fadeLine, glassPanel, typePill } from './ui.js';
import { roundPortrait } from './Textures.js';
import { RES } from '../config.js';
import { Save } from './Save.js';
import { Sfx } from './Audio.js';

const ADD = Phaser.BlendModes.ADD;
const COLS = 9, CELL = 40;
const PASSIVE_TEXT = {
  superArmor: '슈퍼아머 — 맞아도 경직·넉백 없음', teleport: '대시 = 잔상을 남기는 완전 무적 순간이동', sandstorm: '마기라스: 모래바람 오라가 주변에 지속 피해',
  flop: '잉어킹은 물가처럼 파닥파닥 뛰며 이동', big: '거대한 몸집 · 공격 범위 1.35배', guard: '받는 피해 감소', atkSpeed: '모든 기술 동작 1.35배 빠름', hoverForm: '망나뇽: 점프 키를 누르면 체공 비행'
};
// 초상화 원 하나: 합류한 포켓몬은 둥근 초상화, 아직이면 배경이 투명한 도트(icon:)를 검게 칠한 실루엣
//  (PMD 초상화는 배경까지 꽉 찬 그림이라 검게 칠하면 그냥 검은 원이 된다)
function face(s, L, key, x, y, scale, locked) {
  if (locked && s.textures.exists(`icon:${key}`)) {
    L.add(s.add.circle(x, y, 20 * scale, 0x4a4270, 1));
    L.add(s.add.image(x, y, `icon:${key}`).setDisplaySize(62 * scale, 62 * scale).setTintFill(0x07050e));
    return;
  }
  const img = s.add.image(x, y, roundPortrait(s, key)).setScale(scale);
  if (locked) img.setTintFill(0x0c0a16);
  if (img.texture.key === 'px') img.setDisplaySize(30 * scale / .8, 30 * scale / .8).setTintFill(0x1a1828);
  L.add(img);
}

const tabOf = cat => CATS.find(c => c.cats.includes(cat)).id;
const tabCats = tab => CATS.find(c => c.id === tab).cats;

export class RosterPanel {
  // o: { layer, x, y, w, h, infoX, infoW, picked(key) → 파티 순번|-1, onToggle(key), onFocus(key), tab, focus }
  constructor(scene, o) {
    this.s = scene; this.o = o;
    this.focus = o.focus && SPECIES[o.focus] ? o.focus : 'charmander';
    const fsp = SPECIES[this.focus];
    this.tab = o.tab && CATS.some(c => c.id === o.tab) ? o.tab : tabOf(fsp.cat);
    if (!tabCats(this.tab).includes(fsp.cat)) this.tab = tabOf(fsp.cat);
    this.gen = o.gen ?? (fsp.legend ? 0 : fsp.gen || 0);   // 처음엔 고른 포켓몬의 세대
    this.L = scene.add.container(0, 0);
    if (o.layer) o.layer.add(this.L);
    this.build();
  }

  // 지금 탭(·세대)의 라인 — 전체 보기는 세대 순 (같은 세대 안에선 스타팅이 먼저)
  list() {
    const cats = tabCats(this.tab), byGen = this.tab === 'pokemon';
    const ls = LINES.filter(l => cats.includes(l.cat) && (!byGen || !this.gen || l.gen === this.gen));
    if (byGen && !this.gen) ls.sort((a, b) => (a.gen || 0) - (b.gen || 0));
    return ls.map(l => l.id);
  }

  build() {
    const s = this.s, o = this.o, L = this.L;
    L.removeAll(true);
    const g = s.add.graphics(); L.add(g);
    // ── 카테고리 탭
    CATS.forEach((c, i) => {
      const x = o.x + 6 + i * 170, on = c.id === this.tab;
      const t = hkText(s, x, o.y, `${c.icon} ${c.label}`, 10, on ? HK.ivory : HK.dim, { bold: true });   // 자간을 주면 글자 단위로 끊어 그려 이모지가 깨진다
      L.add(t);
      if (on) L.add(fadeLine(s, x + t.width / 2, o.y + 16, t.width + 30, .9));
      const z = s.add.zone(x - 4, o.y - 4, t.width + 8, 22).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.setTab(c.id)); L.add(z);
    });
    // ── 세대 필터
    let gy = o.y + 24;
    if (this.tab === 'pokemon') {
      ['전체', '1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((label, i) => {
        const x = o.x + 6 + i * 30, on = this.gen === i;
        g.fillStyle(on ? 0x3a2e5a : 0x14121e, .9); g.fillRoundedRect(x, gy, 26, 14, 6);
        g.lineStyle(1, on ? HK.goldN : HK.ivoryN, on ? .7 : .2); g.strokeRoundedRect(x + .5, gy + .5, 25, 13, 6);
        L.add(hkText(s, x + 13, gy + 7, i ? `${label}세대` : label, i ? 7 : 8, on ? HK.gold : HK.dim, { origin: .5, bold: on }));
        const z = s.add.zone(x, gy, 26, 14).setOrigin(0).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => this.setGen(i)); L.add(z);
      });
      gy += 20;
    } else gy += 4;
    // ── 카드 격자 (전체 보기처럼 많으면 칸을 줄여 패널 안에 다 들어가게)
    const keys = this.list(), rows = Math.max(1, Math.ceil(keys.length / COLS));
    const cell = Math.min(CELL, Math.floor((o.y + o.h - gy - 4) / rows)), k = cell / CELL;
    this.cols = COLS;
    this.cells = keys.map((key, i) => {
      const cx = o.x + 22 + (i % COLS) * CELL, cy = gy + cell / 2 + Math.floor(i / COLS) * cell;
      const unlocked = Save.isUnlocked(key), pi = o.picked ? o.picked(key) : -1, focused = key === this.focus, sc = (focused ? .9 : .8) * k;
      if (focused) L.add(s.add.image(cx, cy, 'glow').setBlendMode(ADD).setTint(0xefeae0).setScale(.9 * k).setAlpha(.28));
      face(s, L, SPECIES[key].evo[0].key, cx, cy, sc, !unlocked);
      L.add(hiImage(s, cx, cy, 'gloss').setScale(sc / RES));
      L.add(hiImage(s, cx, cy, pi >= 0 ? 'slot3d-gold' : 'slot3d').setScale(sc / RES).setAlpha(focused || pi >= 0 ? 1 : .55));
      if (pi >= 0) L.add(hkText(s, cx + 13 * k, cy - 14 * k, String(pi + 1), 9, HK.gold, { bold: true, origin: .5 }));
      if (SPECIES[key].megas.length && unlocked) L.add(hkText(s, cx - 13 * k, cy + 12 * k, 'M', 7, '#ff9ad8', { bold: true, title: true, origin: .5 }));
      const z = s.add.zone(cx, cy, CELL - 2, cell - 2).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => { if (key === this.focus) { if (o.onToggle) o.onToggle(key); } else this.setFocus(key); });
      L.add(z);
      return key;
    });
    if (!keys.length) L.add(hkText(s, o.x + 180, gy + 60, '이 세대의 포켓몬이 없어요', 10, HK.faint, { origin: .5 }));
    this.buildInfo(g);
  }

  // 오른쪽 정보창: 이름 · 도감번호 · 타입 · 배지 · 진화 트리 · 설명 · Z/X/C · 특성 · 해금 조건
  buildInfo(g) {
    const s = this.s, o = this.o, L = this.L, key = this.focus, sp = SPECIES[key], unlocked = Save.isUnlocked(key);
    const X = o.infoX, Y = o.y - 4, W = o.infoW, H = o.h;
    glassPanel(g, X, Y, W, H, { border: unlocked ? HK.goldN : HK.ivoryN, borderAlpha: unlocked ? .3 : .15 });
    const legendLocked = !unlocked && sp.legend;
    L.add(hkText(s, X + 10, Y + 7, legendLocked ? '???' : sp.evo[sp.evo.length - 1].name, 14, unlocked ? HK.ivory : HK.dim, { bold: true, ls: 1 }));
    L.add(hkText(s, X + W - 10, Y + 11, `No.${String(sp.dex).padStart(4, '0')}`, 8, HK.dim, { title: true, origin: [1, 0] }));
    // 타입 + 배지
    let tx = X + 10;
    const lastTypes = sp.evo[sp.evo.length - 1].types;
    for (const t of legendLocked ? [] : lastTypes) tx += typePill(s, L, tx, Y + 28, t, 8) + 4;
    const badges = [];
    const megaN = sp.megas.filter(m => !m.bond && !m.item).length;
    if (sp.megas.some(m => m.item)) badges.push(['폼체인지', '#ffd860']);
    if (sp.megas.some(m => m.bond)) badges.push(['유대변화', '#8ad8ff']);
    if (megaN) badges.push([megaN > 1 ? `메가진화 ×${megaN}` : '메가진화', '#ff9ad8']);
    if (!sp.megas.length && !sp.legend) badges.push(['각성 (오라)', HK.dim]);
    if (sp.legend) badges.push(['전설', HK.gold]);
    for (const [b, c] of legendLocked ? [] : badges) {
      const t = hkText(s, tx + 6, Y + 29, b, 7.5, c, { bold: true }); L.add(t);
      g.lineStyle(1, Phaser.Display.Color.HexStringToColor(c).color, .6); g.strokeRoundedRect(tx + 1, Y + 27, t.width + 10, 13, 6);
      tx += t.width + 14;
    }
    // 진화 트리 미리보기 (모습들 → 메가)
    const chain = [];
    for (const f of sp.evo) if (!chain.length || chain[chain.length - 1].key !== f.key) chain.push({ key: f.key, name: f.name });
    for (const m of sp.megas) chain.push({ key: m.portrait, name: m.name, mega: true });
    const step = Math.min(46, (W - 20) / Math.max(1, chain.length));
    chain.forEach((c, i) => {
      const cx = X + 10 + step / 2 + i * step, cy = Y + 58;
      face(s, L, c.key, cx, cy, .55, !unlocked);
      L.add(hiImage(s, cx, cy, c.mega ? 'slot3d-gold' : 'slot3d').setScale(.55 / RES).setAlpha(.8));
      L.add(hkText(s, cx, cy + 13, unlocked ? c.name.replace(/^메가/, 'M ') : '?', 6.5, c.mega ? '#ff9ad8' : HK.dim, { origin: [.5, 0] }));
      if (i < chain.length - 1) L.add(hkText(s, cx + step / 2, cy, chain[i + 1].mega ? '★' : '›', 8, chain[i + 1].mega ? '#ff9ad8' : HK.faint, { origin: .5 }));
    });
    let y = Y + 86;
    if (!unlocked) {
      L.add(hkText(s, X + 10, y, `🔒 ${unlockHint(LINES.find(l => l.id === key))}`, 9, HK.gold, { style: { wordWrap: { width: W - 20, useAdvancedWrap: true } } }));
      if (sp.unlock.kills) L.add(hkText(s, X + 10, y + 16, `정화 ${Save.kills(key)} / 10`, 8.5, HK.dim));
      y += 34;
      if (legendLocked) return;
    }
    const d = hkText(s, X + 10, y, sp.desc, 8.5, HK.ivory, { style: { wordWrap: { width: W - 20, useAdvancedWrap: true }, lineSpacing: 2 } });
    L.add(d); y = d.y + d.height + 5;
    // 기본 스킬 (잉어킹처럼 모습마다 다르면 첫 모습 기준 + 진화 후 표시)
    const firstSkills = sp.evo[0].skills || sp.skills, later = sp.evo.find(f => f.skills === null && sp.evo[0].skills) ? sp.skills : null;
    for (const [label, set] of [['', firstSkills], ...(later ? [[`${sp.evo[sp.evo.length - 1].name} `, later]] : [])]) {
      for (const sl of ['z', 'x', 'c']) {
        const sk = SKILLS[set[sl]];
        if (!sk || y > Y + H - 14) continue;
        L.add(s.add.image(X + 16, y + 5, `sk:${set[sl]}`).setDisplaySize(11, 11));
        const nm = hkText(s, X + 25, y, `${label}${sl.toUpperCase()} ${sk.name}`, 8, HK.gold, { bold: true });
        L.add(nm);
        // 설명은 이름 뒤 남은 폭에 맞춰 자른다
        const room = X + W - 8 - (nm.x + nm.width + 8), dt = hkText(s, X + W - 8, y + 1, sk.desc, 7, HK.dim, { origin: [1, 0] });
        for (let n = sk.desc.length; dt.width > room && n > 1; n--) dt.setText(sk.desc.slice(0, n - 1) + '…');
        dt.setVisible(room > 20);
        L.add(dt);
        y += 13;
      }
    }
    const pas = Object.keys(sp.passive).map(k => PASSIVE_TEXT[k]).filter(Boolean);
    if (sp.legend) pas.push('히트박스는 일반 최종진화의 1.25배');
    if (pas.length && y < Y + H - 12) L.add(hkText(s, X + 10, y + 2, `특성 · ${pas.join(' / ')}`, 7.5, '#8ad8ff', { style: { wordWrap: { width: W - 20, useAdvancedWrap: true } } }));
  }

  setTab(id) {
    if (id === this.tab) return;
    this.tab = id; this.gen = id === 'pokemon' ? 1 : 0; Sfx.play('select');
    const first = this.list()[0];
    if (first) this.focus = first;
    this.changed();
  }
  setGen(i) { this.gen = i; Sfx.play('select'); const first = this.list()[0]; if (first) this.focus = first; this.changed(); }
  setFocus(key) { if (key === this.focus) return; this.focus = key; Sfx.play('select'); this.changed(); }
  changed() { this.build(); if (this.o.onFocus) this.o.onFocus(this.focus); }

  // 키보드 조작 (처리했으면 true)
  key(e) {
    const keys = this.list(), i = keys.indexOf(this.focus), ti = CATS.findIndex(c => c.id === this.tab);
    const mv = d => { if (keys.length) this.setFocus(keys[Phaser.Math.Clamp(i + d, 0, keys.length - 1)]); };
    if (e.code === 'ArrowLeft') mv(-1);
    else if (e.code === 'ArrowRight') mv(1);
    else if (e.code === 'ArrowUp') mv(-COLS);
    else if (e.code === 'ArrowDown') mv(COLS);
    else if (e.code === 'KeyQ') this.setTab(CATS[(ti + CATS.length - 1) % CATS.length].id);
    else if (e.code === 'KeyE' || e.code === 'Tab') this.setTab(CATS[(ti + 1) % CATS.length].id);
    else if (this.tab === 'pokemon' && /^Digit\d$/.test(e.code)) this.setGen(+e.code.slice(5));
    else if (e.code === 'Enter') { if (this.o.onToggle) this.o.onToggle(this.focus); }
    else return false;
    return true;
  }

  destroy() { this.L.destroy(); }
}
