// 🧬 『메가진화 폼 선택 (Select Mega Evolution)』 창 — UIScene 에 붙인다 (installMegaPicker)
//  메가(특수) 폼이 둘 이상인 포켓몬(리자몽 · 뮤츠 · 라이츄 X/Y · 개굴닌자 유대변화/메가 · 한카리아스 메가/Z — data/megaForms.js)
//  여는 곳 (GameScene.openMegaPick): 전투 중 V (Player.startMega — 시간 정지) · 포켓몬센터 [🧬 메가 폼 변경] · 테스트룸 모습 고르기
//  왼쪽 [폼 A] · 오른쪽 [폼 B] 대형 카드 (기술머신 포켓몬 지정 창처럼 모델링이 함께 나온다):
//   ① 위: 실시간 도트 모델링 미리보기 — 인게임 모션 시트(PMD · 메가 컷아웃 리깅)를 그대로 돌려 숨 쉬는 대기 모션 + 전용 메가 오라 · 회전 메가 심볼
//         카드에 마우스를 올리면(모바일: 카드 탭) 그 폼의 공격 · 포효 모션을 한 번 취한다
//   ② 가운데: 폼 이름 · 타입 배지 · 전투 스타일 한 줄 · 핵심 특성 / 스탯 변화 요약
//   ③ 아래: 기술 초상화 Z · X · C · R(메가 필살기) — 올리면(모바일: 탭) 바로 위에 상세 창
//         (이름 · 속성 / 공격 형태 · 위력 · 쿨타임 · 그로기 유발 · 작동 설명) · 눌러도 메가진화하지 않는다 (stopPropagation · 누르면 창 고정 / 다시 누르면 닫기)
//   ④ 맨 아래: [🧬 이 모습으로 메가진화! (Confirm)] — 이 버튼(또는 고른 카드에서 Enter)만 확정 → 컷신과 함께 그 폼으로
//  키보드: ← → 카드 · Z X C R / 1 ~ 4 기술 설명 · Enter · Space 확정 · Tab 다른 포켓몬(센터) · Esc 설명 닫기 → 취소
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { SPECIES, SKILLS } from '../data/pokemon.js';
import { typeName, typeColor } from '../data/types.js';
import { megaForm, multiMega } from '../data/megaForms.js';
import { HK, hkText, glassPanel, glassButton, typePill } from '../systems/ui.js';
import { skillIcon } from '../systems/Textures.js';
import { Sprites } from '../systems/SpriteLoader.js';
import { Settings, keyLabel } from '../systems/Settings.js';
import { megaSymbol, MEGA_ULT_CD, MEGA_ULT } from '../game/Spectacle.js';
import { Sfx } from '../systems/Audio.js';

const ADD = Phaser.BlendModes.ADD;
const CW = 292, CH = 292, CY = 44, PW = 150, PH = 100;   // 카드 · 미리보기 창 (게임 화면 640 × 360 기준)
const cardX = i => (i ? 330 : 18);
const SLOTS = ['z', 'x', 'c', 'r'];
const RAINBOW = [0xff5a6a, 0xffa03a, 0xffe04a, 0x7aff8a, 0x5ac8ff, 0xb07aff];
const lighten = (c, k = 40) => Phaser.Display.Color.ValueToColor(c).lighten(k).color;
const hexOf = c => '#' + c.toString(16).padStart(6, '0');
const kindLabel = mg => mg.bond ? '유대변화' : /X$/.test(mg.name) ? '메가 X' : /Y$/.test(mg.name) ? '메가 Y' : /Z$/.test(mg.name) ? '메가 Z' : '메가';

export const MegaPicker = {
  // 열린 창의 상태: { ctx, sel 고른 카드, tip { i 카드, sl 자리, pin }, cards [{ outline, tipL, st }] }
  showMegaPick() {
    const gs = this.gs, ctx = gs.megaPickCtx;
    if (!ctx || !SPECIES[ctx.key]) { gs.cancelMegaPick(); return; }
    if (!this.megaUI || this.megaUI.ctx !== ctx) this.megaUI = { ctx, sel: Phaser.Math.Clamp(ctx.sel || 0, 0, 1), tip: null, openedAt: this.time.now };
    const u = this.megaUI, p = gs.player, sp = SPECIES[ctx.key], m = p.members.find(q => q.key === ctx.key);
    this.clearOverlay();
    this.tmAnims = []; this.megaBusy = false;
    const g = this.gOver, L = this.overlay.setVisible(true), now = this.time.now;
    g.fillStyle(0x05040a, .93); g.fillRect(0, 0, GAME_W, GAME_H);
    // 화면 가운데 무지갯빛 메가 심볼 (열릴 때 크게 터졌다가 뒤에서 천천히 돈다)
    const sym = this.add.image(320, 190, megaSymbol(this)).setBlendMode(ADD).setAlpha(0); L.add(sym);
    const halo = this.add.image(320, 190, 'glow').setBlendMode(ADD).setScale(6, 5).setAlpha(.1); L.add(halo);
    const fresh = now - u.openedAt < 60;
    if (fresh) {   // 여는 순간: 창보다 위에서 무지개 메가 심볼 6겹이 터지며 퍼지고, 그 뒤로 카드가 떠오른다 (스스로 사라진다)
      const core = this.add.image(320, 180, 'glow').setBlendMode(ADD).setDepth(61).setScale(.5).setAlpha(1);
      this.tweens.add({ targets: core, scale: 7, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => core.destroy() });
      RAINBOW.forEach((c, k) => {
        const r = this.add.image(320, 180, megaSymbol(this)).setBlendMode(ADD).setDepth(61).setTint(c).setScale(.15).setAlpha(1);
        this.tweens.add({ targets: r, scale: 3.4 + k * .45, alpha: 0, rotation: (k % 2 ? -1 : 1) * 1.6, duration: 760 + k * 80, delay: k * 45, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
      });
      this.cameras.main.flash(240, 255, 240, 255);
      L.setAlpha(0); this.tweens.add({ targets: L, alpha: 1, duration: 260, delay: 140 });
    }
    this.tmAnims.push(t => {
      if (!sym.scene) return;
      const age = (this.time.now - u.openedAt) / 1000, grow = Math.min(1, age / .7);
      const col = Phaser.Display.Color.HSVToRGB((t * .12) % 1, .6, 1).color;
      sym.setTint(col).setRotation(t * .35).setScale(1.2 + 1.6 * Phaser.Math.Easing.Back.Out(grow)).setAlpha(.34 - .24 * grow + Math.sin(t * 3) * .015);
      halo.setTint(col).setAlpha(.08 + Math.sin(t * 2) * .03);
    });
    // 제목 · 안내
    const mk = m || { key: ctx.key, sp };
    const title = sp.megas.some(q => q.bond) ? '🧬 메가진화 · 유대변화 폼 선택  (Select Mega Evolution)' : '🧬 메가진화 폼 선택  (Select Mega Evolution)';
    L.add(hkText(this, 320, 6, title, 14, HK.ivory, { bold: true, origin: [.5, 0], glow: true }));
    const lineName = sp.evo[sp.evo.length - 1].name;
    const note = ctx.mode === 'center' ? `🏥 포켓몬센터 · 메가진화 중인 ${lineName}의 폼을 바꾼다 — 기술 세트 · 전투 스타일 · 필살기가 함께 바뀐다`
      : ctx.mode === 'test' ? `🧪 테스트룸 · 확정하면 ${lineName}${josa(lineName, '이', '가')} 그 폼으로 바로 출전한다`
      : `${lineName}의 메가스톤이 두 갈래로 공명한다! 시간이 멈춘 동안 비교하고, 아래 확정 버튼으로 고르세요 · 이번 판 끝까지 유지 (포켓몬센터에서 바꿀 수 있다)`;
    L.add(fit(hkText(this, 320, 27, note, 8, HK.dim, { origin: [.5, 0] }), 604));
    // 센터: 메가진화 중인 다중 메가 포켓몬이 여럿이면 고르는 단추 (Tab)
    if (ctx.mode === 'center') {
      const list = this.megaCenterList();
      if (list.length > 1) list.forEach((q, j) => {
        const on = q.key === ctx.key, b = glassButton(this, 640 - 8 - (list.length - j) * 84, 6, 80, 16, `${on ? '▶ ' : ''}${p.formName(q)}`, () => { if (!on) this.megaSwitchMember(q.key); }, { size: 7.5, ls: 0, primary: on });
        for (const o of b.objs) L.add(o);
      });
    }
    u.cards = sp.megas.slice(0, 2).map((mg, i) => this.megaCard(L, sp, mg, i, mk));
    this.megaFocus(u.sel, true);
    const touch = this.touchLayout;
    L.add(hkText(this, 320, 350, touch ? '카드를 누르면 공격 모션 · 기술 초상화를 누르면 설명 · 맨 아래 확정 버튼으로 메가진화 · 취소는 오른쪽 아래 ✕'
      : '← → 카드  ·  Z X C R (1 ~ 4) 기술 설명  ·  Enter 고른 카드로 확정  ·  Esc 설명 닫기 / 취소', 7.5, HK.faint, { origin: .5 }));
    const close = glassButton(this, 584, 340, 48, 16, '✕ 취소', () => this.megaCancel(), { size: 7.5, ls: 0 });
    for (const o of close.objs) L.add(o);
    if (u.tip) this.megaTipShow(u.tip.i, u.tip.sl, u.tip.pin);
    this.tmEvents.push(this.time.addEvent({ delay: 16, loop: true, callback: () => { const t = this.time.now / 1000; for (const f of this.tmAnims) f(t); } }));
    this.input.keyboard.on('keydown', this.onOverlayKey, this);
    this.overlayMode = 'mega';
    if (fresh) Sfx.play('card_rare');
  },

  // 카드 하나: 미리보기 · 이름 · 타입 · 스타일 · 기술 초상화 · 확정 버튼
  megaCard(L, sp, mg, i, m) {
    const u = this.megaUI, x = cardX(i), y = CY, cx = x + CW / 2, fm = megaForm(mg) || {}, aura = fm.aura ?? typeColor(mg.types[0]);
    const cur = u.ctx.mode === 'center' && m.mega && (m.megaPick || 0) === i;
    const C = { i, x, y, cx, mg, fm, aura, cur };
    // 판 · 고른 카드 테두리 (megaFocus 가 다시 그린다)
    const glow = this.add.image(cx, y + CH / 2, 'glow').setBlendMode(ADD).setTint(aura).setScale(3.6, 4.4).setAlpha(0); L.add(glow); C.glow = glow;
    const g = this.add.graphics(); L.add(g); C.g = g;
    C.outline = this.add.graphics(); L.add(C.outline);
    // 카드 전체 누르기 영역 (맨 아래 — 초상화 · 버튼이 위에서 먼저 받는다): 고르기 + 공격 모션 · 메가진화는 하지 않는다
    const zone = this.add.zone(x, y, CW, CH).setOrigin(0).setInteractive({ useHandCursor: true }); L.add(zone);
    zone.on('pointerover', () => { this.megaFocus(i); this.megaPose(C); });
    zone.on('pointerdown', () => { this.megaFocus(i); this.megaPose(C); if (u.tip && !u.tip.pin) this.megaTipShow(null); });
    // 머리 칩 (A · 메가 X) · 오른쪽 위 (현재 폼)
    const chip = `${'AB'[i]} · ${kindLabel(mg)}`;
    g.fillStyle(aura, .22); g.fillRoundedRect(x + 8, y + 7, Math.max(50, chip.length * 6.2 + 10), 14, 7);
    L.add(hkText(this, x + 14, y + 8, chip, 8, hexOf(lighten(aura, 30)), { bold: true }));
    if (cur) L.add(hkText(this, x + CW - 10, y + 8, '✔ 지금 이 폼', 8, '#8affb0', { bold: true, origin: [1, 0] }));
    // ① 실시간 도트 모델링 미리보기
    this.megaPreview(L, C, sp, mg, i);
    // ② 이름 · 타입 · 스타일 · 요약
    L.add(hkText(this, cx, y + 112, mg.name, 14, HK.ivory, { bold: true, origin: [.5, 0], glow: true, glowColor: hexOf(aura) + 'aa' }));
    const pills = this.add.container(0, y + 131); L.add(pills);
    let ox = 0; for (const t of mg.types) ox += typePill(this, pills, ox, 0, t, 7.5) + 4;
    pills.x = Math.round(cx - (ox - 4) / 2);
    if (fm.role) L.add(fit(hkText(this, cx, y + 148, `${fm.badge || ''} ${fm.role}`, 9.5, hexOf(lighten(aura, 45)), { bold: true, origin: [.5, 0] }), CW - 20));
    if (fm.summary) L.add(hkText(this, cx, y + 164, fm.summary, 7.5, '#d8d0c0', { origin: [.5, 0], style: { align: 'center', wordWrap: { width: CW - 26, useAdvancedWrap: true }, lineSpacing: 1, maxLines: 2 } }));
    // ③ 기술 초상화 Z · X · C · R
    C.icons = SLOTS.map((sl, k) => this.megaIcon(L, C, sl, k, m));
    // 상세 창 자리 (megaTipShow)
    C.tipL = this.add.container(0, 0); L.add(C.tipL);
    // ④ 확정 버튼
    const verb = mg.bond ? '유대변화' : '메가진화';
    C.btn = glassButton(this, x + 18, y + CH - 32, CW - 36, 22, cur ? '✔ 지금 이 모습이다' : `🧬 이 모습으로 ${verb}!  (Confirm)`, () => this.megaConfirm(i), { size: 9.5, ls: 0, primary: true, bold: true });
    for (const o of C.btn.objs) L.add(o);
    if (cur) C.btn.setEnabled(false);
    return C;
  },

  // 실시간 미리보기: 인게임 모션 시트 프레임을 직접 넘긴다 (전투가 멈춰 전역 애니메이션이 정지해 있어도 돈다)
  megaPreview(L, C, sp, mg, i) {
    const metas = this.registry.get('spriteMeta') || {}, last = sp.evo[sp.evo.length - 1].key;
    const key = metas[mg.sprite] && metas[mg.sprite].hasSprite ? mg.sprite : last;
    const px = C.cx - PW / 2, py = C.y + 8, foot = py + PH - 14, aura = C.aura;
    const g = this.add.graphics(); L.add(g);
    glassPanel(g, px, py, PW, PH, { r: 8, fill: 0x07060e, border: aura, borderAlpha: .55, alpha: .97 });
    const back = this.add.image(C.cx, py + PH / 2, 'glow').setBlendMode(ADD).setTint(aura).setScale(2.4, 1.7).setAlpha(.3); L.add(back);
    const sym = this.add.image(C.cx, foot - 30, megaSymbol(this)).setBlendMode(ADD).setTint(aura).setScale(.8).setAlpha(.3); L.add(sym);
    const ped = this.add.graphics(); L.add(ped);
    ped.fillStyle(0x0a0816, 1); ped.fillEllipse(C.cx, foot + 3, 96, 16); ped.fillStyle(lighten(aura, -40), .35); ped.fillEllipse(C.cx, foot + 1, 90, 12);
    const rings = this.add.graphics().setBlendMode(ADD); L.add(rings);
    const shadow = this.add.ellipse(C.cx, foot, 46, 8, 0x000000, .55); L.add(shadow);
    const rim = this.add.sprite(C.cx, foot, 'px').setBlendMode(ADD).setAlpha(0); L.add(rim);   // 오라 테두리광: 같은 프레임을 오라 색으로 조금 크게 — 도트 뒤에 깔아 윤곽만 빛난다
    const spr = this.add.sprite(C.cx, foot, 'px'); L.add(spr);
    const motes = this.add.graphics().setBlendMode(ADD); L.add(motes);
    const st = { key, name: 'Idle', face: i ? 'left' : 'right', t0: this.time.now, once: false, burst: 0, seed: i * 1.7 };
    C.st = st; C.spr = spr;
    const ready = () => Sprites.isReady(key) && this.anims.exists(`${key}:Idle:right`);
    if (!ready()) Sprites.ensure([key]).then(() => { if (spr.scene) st.t0 = this.time.now; });
    const pts = Array.from({ length: 14 }, (_, k) => ({ x: (Math.sin(k * 12.9) * .5 + .5) * (PW - 20) + px + 10, s: .5 + (k % 5) * .17, o: k / 14 }));
    this.tmAnims.push(t => {
      if (!spr.scene) return;
      const meta = metas[key];
      // 프레임 고르기 (Idle 반복 · 공격 모션은 한 번 뒤 Idle)
      let name = st.name, an = this.anims.get(`${key}:${name}:${st.face}`);
      if (!an && name !== 'Idle') { name = name === 'Strike' || name === 'Shoot' ? 'Attack' : 'Idle'; an = this.anims.get(`${key}:${name}:${st.face}`) || this.anims.get(`${key}:Idle:${st.face}`); if (!this.anims.get(`${key}:${name}:${st.face}`)) name = 'Idle'; }
      if (an && meta) {
        let total = 0; for (const f of an.frames) total += 1 + (f.duration || 0);
        let tt = this.time.now - st.t0;
        if (st.once && tt >= total) { st.once = false; st.name = 'Idle'; st.t0 = this.time.now; tt = 0; an = this.anims.get(`${key}:Idle:${st.face}`) || an; name = 'Idle'; total = 0; for (const f of an.frames) total += 1 + (f.duration || 0); }
        if (!st.once) tt %= Math.max(1, total);
        let fr = an.frames[0];
        for (const f of an.frames) { const d = 1 + (f.duration || 0); if (tt < d) { fr = f; break; } tt -= d; }
        spr.setTexture(fr.textureKey, fr.textureFrame); rim.setTexture(fr.textureKey, fr.textureFrame);
        const am = meta.anims[name] || meta.anims.Idle, oy = am ? am.oy : .75;
        const base = Phaser.Math.Clamp(66 / Math.max(10, meta.height || 30), .5, 3.2);
        const br = name === 'Idle' ? Math.sin(t * 2.6 + st.seed) : 0;
        spr.setOrigin(.5, oy).setScale(base * (1 - br * .012), base * (1 + br * .025)).setY(foot - 1 - Math.abs(br) * .8).setVisible(true);
        rim.setOrigin(.5, oy).setScale(spr.scaleX * 1.09, spr.scaleY * 1.06).setY(spr.y + 1).setTintFill(aura).setAlpha(.45 + Math.abs(Math.sin(t * 1.6 + st.seed)) * .3 + st.burst * .25);
      } else spr.setVisible(false);
      // 오라 · 심볼 · 고리 · 떠오르는 빛 알갱이
      st.burst = Math.max(0, st.burst - .025);
      back.setAlpha(.24 + Math.sin(t * 2.2 + st.seed) * .06 + st.burst * .4).setScale(2.4 + st.burst * .8, 1.7 + st.burst * .5);
      sym.setRotation(t * .7 * (C.i ? -1 : 1)).setAlpha(.22 + st.burst * .5).setScale(.8 + st.burst * .4);
      shadow.setScale(1 - Math.abs(Math.sin(t * 2.6 + st.seed)) * .06, 1);
      rings.clear();
      for (let k = 0; k < 3; k++) { const r = (t * .55 + k / 3) % 1; rings.lineStyle(1, aura, (1 - r) * .75); rings.strokeEllipse(C.cx, foot + 1, 30 + r * 70, 6 + r * 10); }
      if (st.burst > 0) { rings.lineStyle(2, 0xffffff, st.burst); rings.strokeCircle(C.cx, foot - 30, 22 + (1 - st.burst) * 46); }
      motes.clear();
      for (const q of pts) {
        const ph = (t * .35 * q.s + q.o) % 1, yy = foot - ph * (PH - 22), a = Math.sin(ph * Math.PI) * .8;
        motes.fillStyle(ph > .5 ? 0xffffff : aura, a); motes.fillRect(q.x + Math.sin(t * 2 + q.o * 9) * 3, yy, 1.6, 1.6);
      }
    });
  },
  // 공격 · 포효 모션을 한 번 (카드에 올리거나 탭) — 이미 하는 중이면 그대로
  megaPose(C) {
    const st = C.st;
    if (!st || st.once) return;
    st.name = (C.fm && C.fm.pose) || 'Attack'; st.once = true; st.t0 = this.time.now; st.burst = 1;
    Sfx.play('swing');
  },

  // 기술 초상화 한 칸 (44px 급 정사각 · 단축키 배지 · 아래 이름)
  megaIcon(L, C, sl, k, m) {
    const u = this.megaUI, keys = Settings.get('keys'), info = this.megaSkillInfo(C, sl, m);
    const ix = C.cx + (k - 1.5) * 66, iy = C.y + 206, S = 34;
    const box = this.add.container(ix, iy); L.add(box);
    const g = this.add.graphics(); box.add(g);
    const col = typeColor(info.type);
    g.fillStyle(0x05040a, .95); g.fillRoundedRect(-S / 2, -S / 2, S, S, 6);
    g.lineStyle(1.5, col, .9); g.strokeRoundedRect(-S / 2, -S / 2, S, S, 6);
    if (sl === 'r') {   // 메가 필살기: 메가 심볼 + 속성 빛
      box.add(this.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(col).setScale(.9).setAlpha(.6));
      box.add(this.add.image(0, 0, megaSymbol(this)).setBlendMode(ADD).setTint(lighten(col, 30)).setScale(.28));
      box.add(hkText(this, 0, 0, '★', 12, '#ffffff', { origin: .5, bold: true }));
    } else if (info.id && SKILLS[info.id]) box.add(this.add.image(0, 0, skillIcon(this, info.id)).setDisplaySize(S - 6, S - 6));
    // 단축키 배지 (왼쪽 위)
    g.fillStyle(0x0a0812, 1); g.fillRoundedRect(-S / 2 - 4, -S / 2 - 5, 14, 12, 3); g.lineStyle(1, HK.goldN, .9); g.strokeRoundedRect(-S / 2 - 4, -S / 2 - 5, 14, 12, 3);
    box.add(hkText(this, -S / 2 + 3, -S / 2 + 1, sl === 'r' ? keyLabel(keys.ult) : keyLabel(keys[sl]), 7, HK.gold, { bold: true, origin: .5 }));
    if (info.changed) box.add(hkText(this, S / 2 + 2, -S / 2 - 3, '✦', 8, hexOf(lighten(C.aura, 40)), { origin: [1, 0], bold: true }));   // 기본 기술에서 바뀐 자리
    L.add(fit(hkText(this, ix, iy + S / 2 + 3, info.name, 6.5, HK.dim, { origin: [.5, 0] }), 62));
    const hit = this.add.zone(ix, iy, S + 10, S + 10).setInteractive({ useHandCursor: true }); L.add(hit);
    hit.on('pointerover', p2 => { if (!p2.wasTouch && !(u.tip && u.tip.pin)) this.megaTipShow(C.i, sl, false); box.setScale(1.08); });
    hit.on('pointerout', p2 => { box.setScale(1); if (!p2.wasTouch && u.tip && !u.tip.pin && u.tip.i === C.i && u.tip.sl === sl) this.megaTipShow(null); });
    hit.on('pointerdown', (p2, lx, ly, ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();   // 카드(고르기 · 모션)로 번지지 않게 — 초상화는 설명만, 메가진화는 확정 버튼으로만
      const same = u.tip && u.tip.i === C.i && u.tip.sl === sl && u.tip.pin;
      this.megaFocus(C.i);
      this.megaTipShow(same ? null : C.i, sl, true);
      Sfx.play('select');
    });
    return { box, ix, iy };
  },
  // 한 자리의 기술 정보: { id, name, type, tag, pow, cd, stag, desc, changed }
  megaSkillInfo(C, sl, m) {
    const fm = C.fm || {}, sp = SPECIES[this.megaUI.ctx.key];
    if (sl === 'r') {
      const u = fm.ult || MEGA_ULT[sp.id] || { name: `${C.mg.name} 각성 필살기`, type: C.mg.types[0] };
      return { id: null, name: u.name, type: u.type, tag: (fm.tags && fm.tags.r) || '대연출', pow: (fm.pow && fm.pow.r) || 700, pow1: fm.pow && fm.pow.r1, cd: MEGA_ULT_CD, stag: (fm.stag && fm.stag.r) || '—',
        desc: '메가진화 중에만 쓰는 전용 필살기. 컷인과 함께 대연출이 차례로 터지고, 시전 중에는 무적이다.', changed: !!fm.ult, slotMul: 1 };
    }
    // 이 폼으로 메가진화했을 때 그 자리에 올 기술: 지금 단 기술이 기본 기술이면 폼 기술로 (기술머신으로 바꿔 단 자리는 그대로)
    const base = (sp.evo[sp.evo.length - 1].skills || sp.skills)[sl], have = m && m.skills ? m.skills[sl] : base;
    const mb = m && m.megaBack && m.megaBack.back[sl], orig = mb ? mb[0] : have;
    const formId = fm.skills && fm.skills[sl], id = orig === base && formId ? formId : orig, sk = SKILLS[id] || {};
    return { id, name: sk.name || id, type: sk.type || C.mg.types[0], tag: (formId === id && fm.tags && fm.tags[sl]) || (sk.cd ? '기술' : '연타 평타'), pow: formId === id && fm.pow ? fm.pow[sl] : 0,
      cd: sk.cd || 0, stag: formId === id && fm.stag ? fm.stag[sl] : '', desc: (sk.desc || '') + (sk.mega ? `  ▸ 메가: ${sk.mega}` : ''), changed: id !== base, slotMul: (fm.style && fm.style.dmg && fm.style.dmg[sl]) || 1 };
  },
  // 상세 창: 그 카드 초상화 줄 바로 위 (이름 · 속성 · 위력 · 쿨타임 · 그로기 · 설명) — i 가 null 이면 닫기
  megaTipShow(i, sl, pin = false) {
    const u = this.megaUI;
    if (!u || !u.cards) return;
    for (const c of u.cards) if (c.tipL && c.tipL.scene) c.tipL.removeAll(true);
    u.tip = i == null ? null : { i, sl, pin };
    if (i == null) return;
    const C = u.cards[i], m = this.gs.player.members.find(q => q.key === u.ctx.key), info = this.megaSkillInfo(C, sl, m), T = C.tipL;
    if (!C || !T.scene) return;
    const keys = Settings.get('keys'), kl = sl === 'r' ? keyLabel(keys.ult) : keyLabel(keys[sl]), col = typeColor(info.type);
    const bx = C.x + 8, by = C.y + 104, bw = CW - 16, bh = 82, ic = C.icons[SLOTS.indexOf(sl)];
    const g = this.add.graphics(); T.add(g);
    glassPanel(g, bx, by, bw, bh, { r: 8, fill: 0x0a0914, border: col, borderAlpha: .9, alpha: .985 });
    g.fillStyle(0x0a0914, .985); g.fillTriangle(ic.ix - 6, by + bh - 1, ic.ix + 6, by + bh - 1, ic.ix, by + bh + 6);   // 초상화를 가리키는 꼬리
    g.lineStyle(1, col, .9); g.lineBetween(ic.ix - 6, by + bh, ic.ix, by + bh + 6); g.lineBetween(ic.ix + 6, by + bh, ic.ix, by + bh + 6);
    g.fillStyle(col, .8); g.fillRect(bx + 8, by + 21, bw - 16, 1);
    T.add(fit(hkText(this, bx + 10, by + 6, `[${kl} ${sl === 'r' ? '필살기' : '스킬'}] ${info.name}`, 10.5, HK.gold, { bold: true }), bw - 70));
    T.add(hkText(this, bx + bw - 8, by + 8, u.tip.pin ? '📌 고정 · 다시 누르면 닫기' : '', 6.5, HK.faint, { origin: [1, 0] }));
    T.add(fit(hkText(this, bx + 10, by + 25, `(${typeName(info.type)} / ${info.tag})`, 8, hexOf(lighten(col, 35)), { bold: true }), bw - 20));
    const pow = info.pow1 ? `${info.pow}% (범위 합계 · 보스 1마리 실측 ${info.pow1}%)` : info.pow ? `${info.pow}%${sl === 'z' ? ' (3타 합계)' : ''}${info.slotMul !== 1 ? ` · 폼 보정 ${info.slotMul > 1 ? '+' : ''}${Math.round((info.slotMul - 1) * 100)}% 포함` : ''}` : '—';
    T.add(fit(hkText(this, bx + 10, by + 38, `위력: ${pow}  |  쿨타임: ${info.cd ? info.cd.toFixed(1) + '초' : '없음 (연타)'}  |  그로기 유발: ${info.stag || '—'}`, 7.5, HK.ivory, { bold: true }), bw - 20));
    T.add(hkText(this, bx + 10, by + 51, info.desc, 7, '#c8c0b0', { style: { wordWrap: { width: bw - 20, useAdvancedWrap: true }, lineSpacing: 1, maxLines: 3 } }));
    T.setAlpha(0); this.tweens.add({ targets: T, alpha: 1, duration: 110 });
  },
  // 카드 고르기 (키보드 · 마우스): 테두리 · 빛 · 버튼 라벨
  megaFocus(i, force = false) {
    const u = this.megaUI;
    if (!u || !u.cards || (!force && u.sel === i)) { if (u) u.sel = i; return; }
    u.sel = i;
    for (const C of u.cards) {
      const on = C.i === i, g = C.g;
      g.clear();
      glassPanel(g, C.x, C.y, CW, CH, { r: 11, fill: on ? 0x16112a : 0x0b0a15, border: C.aura, borderAlpha: on ? .95 : .4, alpha: .96 });
      C.outline.clear();
      if (on) { C.outline.lineStyle(1.5, lighten(C.aura, 30), .55); C.outline.strokeRoundedRect(C.x - 4, C.y - 4, CW + 8, CH + 8, 13); }
      C.glow.setAlpha(on ? .2 : 0);
      if (C.btn && !C.cur) C.btn.setLabel(`🧬 이 모습으로 ${C.mg.bond ? '유대변화' : '메가진화'}!  (Confirm${on && !this.touchLayout ? ' · Enter' : ''})`);
    }
    if (!force) Sfx.play('select');
  },
  // 확정: 카드에서 메가 빛이 터지고 → 창을 닫으며 그 폼으로 (GameScene.confirmMegaPick — 컷신 · 기술 세트 교체)
  megaConfirm(i) {
    const u = this.megaUI, gs = this.gs;
    if (!u || this.megaBusy || !u.cards || !u.cards[i]) return;
    const C = u.cards[i];
    if (C.cur) { Sfx.play('deny'); return; }
    if (this.time.now - u.openedAt < 250) return;   // 여는 V 키가 그대로 확정되지 않게
    this.megaBusy = true; this.megaTipShow(null);
    Sfx.play('card_legend');
    this.cameras.main.flash(200, 255, 255, 255);
    for (let k = 0; k < 6; k++) {
      const r = this.add.image(C.cx, C.y + 60, megaSymbol(this)).setBlendMode(ADD).setTint(k % 2 ? C.aura : RAINBOW[k]).setScale(.3).setAlpha(1); this.overlay.add(r);
      this.tweens.add({ targets: r, scale: 2.6 + k * .4, alpha: 0, rotation: 1.4, duration: 520, delay: k * 40, ease: 'Cubic.easeOut' });
    }
    if (C.st) { C.st.burst = 1; C.st.name = (C.fm && C.fm.pose) || 'Attack'; C.st.once = true; C.st.t0 = this.time.now; }
    this.time.delayedCall(380, () => { this.megaBusy = false; this.megaUI = null; gs.confirmMegaPick(i); });
  },
  megaCancel() {
    if (this.megaBusy) return;
    Sfx.play('select');
    this.megaUI = null;
    this.gs.cancelMegaPick();
  },
  // Esc (GameScene.togglePause → overlayBack): 고정된 설명 창 → 닫기, 아니면 취소
  megaBack() {
    const u = this.megaUI;
    if (u && u.tip) { this.megaTipShow(null); Sfx.play('select'); return true; }
    this.megaCancel();
    return true;
  },
  // 센터: 메가진화 중인 다중 메가 포켓몬 (파티)
  megaCenterList() { return this.gs.player.members.filter(q => q.mega && multiMega(q.sp)); },
  megaSwitchMember(key) {
    const gs = this.gs, ctx = gs.megaPickCtx, m = gs.player.members.find(q => q.key === key);
    if (!ctx || !m) return;
    Sfx.play('select');
    gs.megaPickCtx = Object.assign({}, ctx, { key, sel: m.megaPick || 0 });
    this.megaUI = null; this.showMegaPick();
  },
  megaKey(e) {
    const u = this.megaUI, c = e.code;
    if (!u || this.megaBusy) return;
    const n = /^(Digit|Numpad)[1-4]$/.test(c) ? +c.slice(-1) - 1 : ['KeyZ', 'KeyX', 'KeyC', 'KeyR'].indexOf(c);
    if (c === 'ArrowLeft' || c === 'ArrowRight') { const j = c === 'ArrowRight' ? 1 : 0; if (j !== u.sel) { this.megaFocus(j); this.megaPose(u.cards[j]); if (u.tip) this.megaTipShow(j, u.tip.sl, u.tip.pin); } }
    else if (n >= 0) { const sl = SLOTS[n], same = u.tip && u.tip.i === u.sel && u.tip.sl === sl; this.megaTipShow(same ? null : u.sel, sl, true); Sfx.play('select'); }
    else if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') this.megaConfirm(u.sel);
    else if (c === 'Tab' && u.ctx.mode === 'center') { const list = this.megaCenterList(); if (list.length > 1) { const j = list.findIndex(q => q.key === u.ctx.key); this.megaSwitchMember(list[(j + 1) % list.length].key); } }
  }
};

// 받침이 있으면 a(이 · 은 · 을), 없으면 b(가 · 는 · 를)
function josa(w, a, b) { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b; }
// 한 줄 글자가 넘치면 가로로 줄인다
function fit(t, w) { if (t.width > w) t.setScale(w / t.width, 1); return t; }

export function installMegaPicker(cls) { Object.assign(cls.prototype, MegaPicker); }
