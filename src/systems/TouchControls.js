// 모바일 가상 패드 (할로우 나이트풍 반투명 유리 원)
//  왼쪽 아래: 손가락을 따라오는 플로팅 조이스틱 (아래로 당기고 점프 = 발판 아래로)
//  오른쪽 아래: 평타(Z) · 점프 · 대시가 6~7px 간격으로 맞붙은 정삼각형 (엄지를 살짝 굴리면 바로 다음 버튼 — 점프는 평타의 8시, 대시는 10시 · 점프 바로 위)
//   그 바깥 2열 부채꼴에 X · C · 메가(메가 필살기) · Z기술 · 🧪 · 조사(F), 왼쪽 끝에 교대 (Z기술은 Z크리스탈을, 메가는 메가스톤을 얻기 전엔 아예 보이지 않는다)
//   엄지 슬라이드: 누른 손가락을 떼지 않고 옆 버튼으로 미끄러뜨리면 그 버튼이 눌린다 (점프 → 대시 · 평타) · 터치 판정은 그림보다 HIT_PAD 넉넉하게
//   배치는 저장하지 않는다 (기본 좌표 = 아래 buttons) — 크기는 설정의 「UI 크기」 배율을 곱한다 (applyScale)
//  위쪽: 일시정지 + 터치패드 켜기/끄기 (지도 · 가방 · 설정은 통합 메뉴 — 왼쪽 위 초상화를 누르면 열린다) (항상 보인다 · 고른 값은 기억해 다음에도 그대로)
//  투명도: 설정의 「패드 투명도」 — 아래 버튼·조이스틱 전체에 곱한다 (위쪽 줄은 찾을 수 있게 40% 아래로는 안 내려간다)
//  크기: 설정의 「UI 크기」(0.8~1.4배) — 아래 버튼은 오른쪽 아래 구석, 조이스틱은 왼쪽 아래 구석을 기준으로 커진다 (위쪽 줄은 HUD 와 겹치지 않게 1.2배까지)
//   맨 위 가장자리에서 조금 내려 둔다 — 사파리 가로 화면은 맨 위를 탭하면 주소창이 나오느라 게임까지 탭이 오지 않는다
//  멀티터치: 손가락(포인터)마다 따로 잡는다 (Phaser input.activePointers 4) — 이동하면서 점프·스킬·대시
// UIScene(640x360 좌표)에 그리고, 입력 상태는 GameScene.touchInput 으로 넘긴다.
import { hkText, HK } from './ui.js';
import { RES } from '../config.js';
import { Settings } from './Settings.js';
import { skillIcon } from './Textures.js';

// 포인터 좌표(캔버스 픽셀)를 UI 논리 좌표(640x360)로
const lx = p => p.x / RES, ly = p => p.y / RES;

const STICK_R = 30, STICK_HOME = { x: 92, y: 282 };
const DIVE_TAN = Math.tan(Math.PI / 8);   // 내려찍기로 치는 조이스틱 각도: 수평에서 22.5° 넘게 아래
const HIT_PAD = 10, SLIDE_PAD = 4;   // 터치 판정 여유 (그림 반지름 + HIT_PAD) · 엄지 슬라이드로 옆 버튼에 넘어가는 판정 (+SLIDE_PAD — 경계에서 떨리지 않게)
// 지상 패링 (↓ + Z): 조이스틱이 아래쪽 45° ~ 135° 부채꼴이면 '아래' (PARRY_DEAD 넘게 당겼을 때) · 놓거나 벗어난 뒤 PARRY_GRACE 초까지는 그대로 쳐 준다
const PARRY_DEAD = 9, PARRY_GRACE = .15;
const PREF = 'pokecells.touchpad';   // 'on' · 'off' (없으면 기기에 맞춰: 터치 화면이면 켬)
const readPref = () => { try { return localStorage.getItem(PREF); } catch (e) { return null; } };
const writePref = v => { try { localStorage.setItem(PREF, v); } catch (e) { /* 저장소를 못 쓰면 이번 판만 */ } };

export class TouchControls {
  constructor(ui, gs) {
    this.ui = ui; this.gs = gs;
    this.state = { left: false, right: false, up: false, down: false, jumpH: false, pressed: {}, on: false, parryAim: false, parryAimAt: -1e9 };
    gs.touchInput = this.state;
    const pref = readPref();
    this.buttons = [
      // 안쪽 삼각형: 평타(Z) 가운데 · 점프는 8시 · 대시는 10시 (점프 바로 위) — 중심 사이 66 = 반지름 합 + 6~7px 간격 · 대시도 점프와 같은 큰 원
      { id: 'z', x: 600, y: 286, r: 29, slot: 'z', press: 'zP', hold: 'zH' },   // 꾹 누르면 차징 샷
      { id: 'jump', x: 543, y: 319, r: 30, label: '점프', press: 'jumpP', hold: 'jumpH' },
      { id: 'dash', x: 543, y: 253, r: 30, label: '대시', press: 'dashP' },
      // 바깥 2열 부채꼴 (삼각형 무게중심 (562, 286) 에서 약 94): X 9시 · C 10시 · 메가 11시 · Z기술 12시 · 조사는 오른쪽 위 · 🧪 · 교대는 왼쪽 바깥
      { id: 'x', x: 469, y: 299, r: 20, slot: 'x', press: 'xP' },
      { id: 'c', x: 482, y: 236, r: 20, slot: 'c', press: 'cP' },
      { id: 'mega', x: 533, y: 197, r: 16, label: '메가', press: 'mega' },
      { id: 'ult', x: 533, y: 197, r: 18, label: 'MEGA\nSKILL', press: 'ultP', ult: true },   // 메가진화하면 메가 버튼 자리에 나타나는 전용 필살기
      { id: 'zmove', x: 586, y: 195, r: 16, label: 'Z기술', press: 'zmoveP' },
      { id: 'potion', x: 430, y: 270, r: 15, label: '🧪 3', press: 'potionP' },   // 상처약 퀵버튼 (남은 개수)
      { id: 'use', x: 624, y: 172, r: 15, label: '조사', press: 'useP' },
      { id: 'swap', x: 414, y: 322, r: 17, label: '교대', press: 'swapNext' },
      // 지도 · 가방 · 설정은 통합 메뉴(왼쪽 위 초상화 · 그 아래 바로가기 글자)로 합쳐 위쪽 버튼에서 뺐다
      { id: 'pause', x: 354, y: 32, r: 18, label: 'Ⅱ', special: 'pause' },
      ...(gs.test ? [{ id: 'test', x: 186, y: 32, r: 18, label: '테스트', special: 'test' }] : [])   // 테스트룸 패널
    ];
    this.toggleBtn = { x: 412, y: 32, w: 52, h: 28 };   // 터치패드 켜기/끄기
    for (const b of this.buttons) { b.bx = b.x; b.by = b.y; b.br = b.r; b.top = b.y < 100; }   // 크기 조절의 기준 (원래 자리)
    this.stickR = STICK_R; this.stickHome = { ...STICK_HOME };
    this.active = new Map();      // 포인터 id → 버튼
    this.stick = null;
    // 그림은 두 묶음: 아래 버튼·조이스틱(layer) · 위쪽 줄(topLayer) — 묶음마다 투명도를 한 번에 건다
    this.layer = ui.add.container(0, 0).setDepth(30);
    this.topLayer = ui.add.container(0, 0).setDepth(30);
    this.g = ui.add.graphics(); this.gTop = ui.add.graphics();
    this.layer.add(this.g); this.topLayer.add(this.gTop);
    for (const b of this.buttons) {
      b.icon = b.slot ? ui.add.image(b.x, b.y, 'px') : null;
      b.text = b.slot
        ? hkText(ui, b.x, b.y + b.r - 7, b.slot.toUpperCase(), 8, '#ffffff', { bold: true, origin: .5 })
        : hkText(ui, b.x, b.y, b.label, b.r > 20 ? 11 : b.r > 16 ? 10.5 : b.r > 13 ? 9 : 8, HK.ivory, { bold: true, origin: .5 });
      if (b.icon) this.layer.add(b.icon);
      (b.top ? this.topLayer : this.layer).add(b.text);
    }
    this.toggleText = hkText(ui, this.toggleBtn.x + 10, this.toggleBtn.y, '', 9, HK.ivory, { bold: true, origin: .5 });
    this.topLayer.add(this.toggleText);
    const inp = ui.input;
    inp.on('pointerdown', this.onDown, this);
    inp.on('pointermove', this.onMove, this);
    inp.on('pointerup', this.onUp, this);
    inp.on('pointerupoutside', this.onUp, this);
    const off = Settings.on((k, v) => { if (k === 'uiScale') this.applyScale(v); if (k === 'padAlpha') this.applyAlpha(v); });
    ui.events.once('shutdown', () => { gs.touchInput = null; off(); });
    this.applyScale(Settings.get('uiScale'));
    this.applyAlpha(Settings.get('padAlpha'));
    this.setVisible(pref ? pref === 'on' : !!(window.matchMedia && matchMedia('(pointer: coarse)').matches));
  }

  // UI 크기: 아래 버튼은 오른쪽 아래 구석, 조이스틱은 왼쪽 아래 구석, 위쪽 줄은 가운데(320) 기준으로 키운다
  applyScale(s) {
    const st = Math.min(s, 1.2), topY = y => 14 + (y - 14) * st;
    this.s = s;
    for (const b of this.buttons) {
      if (b.top) { b.x = 320 + (b.bx - 320) * st; b.y = topY(b.by); b.r = b.br * st; }
      else { b.r = b.br * s; b.x = 640 - (640 - b.bx) * s; b.y = Math.max(360 - (360 - b.by) * s, (b.x + b.r > 536 ? 132 : 92) + b.r); }   // 커져도 오른쪽 위 정화 진행도 목록(x 536~) 아래 · 왼쪽 HUD 아래에 머문다
      const k = b.top ? st : s;
      b.text.setScale(k).setPosition(b.x, b.slot ? b.y + b.r - 7 * k : b.y);
      if (b.icon) b.icon.setPosition(b.x, b.y);
    }
    const t = this.toggleBtn;
    t.x = 320 + (412 - 320) * st; t.y = topY(32);
    this.toggleText.setPosition(t.x + 10, t.y);
    this.stickR = STICK_R * s;
    this.stickHome = { x: STICK_HOME.x * s, y: 360 - (360 - STICK_HOME.y) * s };
  }

  applyAlpha(a) { this.layer.setAlpha(a); this.topLayer.setAlpha(Math.max(a, .4)); }

  setVisible(v) {
    this.visible = v; this.state.on = v;
    for (const b of this.buttons) { b.text.setVisible(v); if (b.icon) b.icon.setVisible(v); }
    if (!v) this.gTop.clear();
    if (!v) {   // 끄는 순간 눌려 있던 것도 모두 놓는다
      this.active.clear(); this.stick = null; this.updateStick();
      this.state.jumpH = false; this.state.zH = false; this.buttons.forEach(b => { b.down = false; });
    }
  }

  // 누른 자리의 버튼: 그림 반지름 + pad 안에서 테두리가 가장 가까운 버튼 (크기가 다른 버튼끼리 맞붙어 있어도 공정하게)
  hit(p, pad = HIT_PAD) {
    let best = null, bd = 1e9;
    for (const b of this.buttons) {
      if (b.hidden) continue;   // 아직 못 얻은 Z기술 · 메가
      const e = Math.hypot(lx(p) - b.x, ly(p) - b.y) - b.r;
      if (e <= pad && e < bd) { best = b; bd = e; }
    }
    return best;
  }
  // 버튼을 누른다 · 놓는다 (손가락 하나에 버튼 하나 — 슬라이드로 넘어가면 놓고 새로 누른다)
  pressBtn(id, b) {
    this.active.set(id, b); b.down = true;
    if (b.press) this.state.pressed[b.press] = true;
    if (b.hold) this.state[b.hold] = true;
  }
  releaseBtn(id) {
    const b = this.active.get(id);
    if (!b) return;
    this.active.delete(id);
    if ([...this.active.values()].includes(b)) return;   // 다른 손가락이 아직 같은 버튼을 누르고 있다
    b.down = false; if (b.hold) this.state[b.hold] = false;
  }
  hitToggle(p) { const t = this.toggleBtn; return Math.abs(lx(p) - t.x) <= t.w / 2 + 4 && Math.abs(ly(p) - t.y) <= t.h / 2 + 6; }

  onDown(p) {
    if (this.ui.overlayMode || !this.gs.player) return;   // 지도·가방·일시정지·결과 화면은 그 화면의 버튼으로 조작
    if (this.hitToggle(p)) { this.setVisible(!this.visible); writePref(this.visible ? 'on' : 'off'); this.gs.events.emit('toast', this.visible ? '터치패드 켬' : '터치패드 끔 — 오른쪽 위 버튼으로 다시 켤 수 있어요'); return; }
    if (p.wasTouch && !this.visible && readPref() !== 'off') this.setVisible(true);   // 터치 노트북 등은 첫 터치 때 표시 (끈 적이 없으면)
    if (!this.visible) return;
    const b = this.hit(p);
    if (b) {
      if (b.special === 'pause') { this.gs.togglePause(); return; }
      if (b.special === 'settings') { this.gs.toggleOverlay('settings'); return; }
      if (b.special === 'test') { this.gs.toggleOverlay('test'); return; }
      if (this.gs.paused) return;
      this.pressBtn(p.id, b);
      return;
    }
    // 왼쪽 아래 절반 어디든 엄지를 대면 그 자리가 조이스틱 중심 (왼쪽 위 HUD 는 빼고)
    if (!this.gs.paused && lx(p) < 300 && ly(p) > 84) {
      this.stick = { id: p.id, bx: lx(p), by: ly(p), x: lx(p), y: ly(p) };
      this.updateStick();
    }
  }

  onMove(p) {
    // 엄지 슬라이드: 버튼을 누른 손가락이 떼지 않고 옆 버튼으로 미끄러지면 그 버튼을 누른다 (점프 → 대시 · 평타 → 대시). 버튼 밖으로 나가면 누르던 버튼을 그대로 쥔다 (점프 높이 · 차징)
    const cur = this.active.get(p.id);
    if (cur && this.visible && !this.gs.paused && p.isDown) {
      const nb = this.hit(p, SLIDE_PAD);
      if (nb && nb !== cur && !nb.special && !nb.top) { this.releaseBtn(p.id); this.pressBtn(p.id, nb); }
      return;
    }
    if (!this.stick || p.id !== this.stick.id) return;
    this.stick.x = lx(p); this.stick.y = ly(p);
    this.updateStick();
  }

  onUp(p) {
    this.releaseBtn(p.id);
    if (this.stick && this.stick.id === p.id) { this.stick = null; this.updateStick(); }
  }

  updateStick() {
    const s = this.state, st = this.stick;
    if (!st) { if (s.parryAim) s.parryAimAt = this.ui.time.now; s.left = s.right = s.up = s.down = s.downAim = s.parryAim = false; s.diveAim = null; return; }
    let dx = st.x - st.bx, dy = st.y - st.by;
    const d = Math.hypot(dx, dy), lim = this.stickR * 1.5;
    if (d > lim) { st.bx += dx * (1 - lim / d); st.by += dy * (1 - lim / d); dx = st.x - st.bx; dy = st.y - st.by; }   // 손가락을 따라 받침이 끌려온다
    s.left = dx < -8; s.right = dx > 8; s.up = dy < -16; s.down = dy > 14;
    s.downAim = dy > 14 && dy >= Math.abs(dx);   // 하향 점프: 조이스틱이 아래쪽 ±45° 안 (대각선 아래로 걸으며 점프할 땐 보통 점프)
    // 공중 내려찍기 방향: 조이스틱이 수평보다 22.5° 넘게 아래를 가리키면 (8방향의 왼쪽 아래 · 아래 · 오른쪽 아래) 그 방향 그대로
    s.diveAim = d > 14 && dy > Math.abs(dx) * DIVE_TAN ? { x: dx / d, y: dy / d } : null;
    // 지상 패링 '아래': 아래쪽 45° ~ 135° 부채꼴 (dy ≥ |dx|) · PARRY_DEAD 넘게 당겼을 때 — 벗어나는 순간을 기억해 PARRY_GRACE 초 동안 더 쳐 준다 (GameScene.readInput)
    const pa = d > PARRY_DEAD && dy >= Math.abs(dx);
    if (s.parryAim && !pa) s.parryAimAt = this.ui.time.now;
    s.parryAim = pa;
  }

  // 유리 원: 어두운 속 + 상아색 테두리 + 왼쪽 위 얇은 광택 (눌리면 밝아진다)
  orb(x, y, r, fillA, ring, ringA, down, g = this.g) {
    g.fillStyle(0x000000, .25 * fillA / .4); g.fillCircle(x + .8, y + 1.4, r);
    g.fillStyle(down ? 0x2a2440 : 0x07060c, fillA); g.fillCircle(x, y, r);
    g.lineStyle(down ? 2.2 : 1.6, ring, ringA); g.strokeCircle(x, y, r);
    g.lineStyle(1, 0xffffff, down ? .35 : .18); g.beginPath(); g.arc(x, y, r - 3, Math.PI * 1.08, Math.PI * 1.55); g.strokePath();
  }

  drawToggle() {
    const g = this.gTop, t = this.toggleBtn, on = this.visible, x0 = t.x - t.w / 2, y0 = t.y - t.h / 2;
    g.fillStyle(0x07060c, on ? .6 : .45); g.fillRoundedRect(x0, y0, t.w, t.h, t.h / 2);
    g.lineStyle(1.4, on ? 0xffd27a : 0xefeae0, on ? .8 : .45); g.strokeRoundedRect(x0, y0, t.w, t.h, t.h / 2);
    // 게임패드 그림
    const cx = x0 + 14, cy = t.y, col = on ? 0xffd27a : 0xbab4c8;
    g.fillStyle(col, .9); g.fillRoundedRect(cx - 9, cy - 5, 18, 10, 4);
    g.fillStyle(0x07060c, 1); g.fillRect(cx - 6.5, cy - 1, 5, 1.6); g.fillRect(cx - 4.8, cy - 2.8, 1.6, 5); g.fillCircle(cx + 3.6, cy - 1.4, 1.2); g.fillCircle(cx + 5.8, cy + 1.2, 1.2);
    this.toggleText.setText(on ? 'ON' : 'OFF').setColor(on ? HK.gold : HK.dim).setVisible(true);
  }

  update() {
    const g = this.g, p = this.gs.player;
    g.clear(); this.gTop.clear();
    if (!p || this.ui.overlayMode) {
      this.stick = null; this.updateStick();
      this.toggleText.setVisible(false);
      this.buttons.forEach(b => { b.text.setVisible(false); if (b.icon) b.icon.setVisible(false); });
      return;
    }
    this.drawToggle();
    if (!this.visible) return;
    // 조이스틱 (쉬는 동안은 왼쪽 아래 자리에 흐릿하게)
    const st = this.stick, R = this.stickR, bx = st ? st.bx : this.stickHome.x, by = st ? st.by : this.stickHome.y;
    this.orb(bx, by, R, st ? .3 : .16, 0xefeae0, st ? .55 : .25, false);
    for (let k = 0; k < 4; k++) {   // 네 방향 꺾쇠
      const a = k * Math.PI / 2, cx = bx + Math.cos(a) * (R - 8), cy = by + Math.sin(a) * (R - 8), on = st && ((k === 0 && this.state.right) || (k === 1 && this.state.down) || (k === 2 && this.state.left) || (k === 3 && this.state.up));
      g.lineStyle(1.4, on ? 0xffd27a : 0xefeae0, on ? .9 : .3);
      g.beginPath(); g.moveTo(cx + Math.cos(a + 2.4) * 4, cy + Math.sin(a + 2.4) * 4); g.lineTo(cx, cy); g.lineTo(cx + Math.cos(a - 2.4) * 4, cy + Math.sin(a - 2.4) * 4); g.strokePath();
    }
    let kx = bx, ky = by;
    if (st) { const dx = st.x - bx, dy = st.y - by, d = Math.hypot(dx, dy), k = d > R ? R / d : 1; kx = bx + dx * k; ky = by + dy * k; }
    g.fillStyle(0xefeae0, st ? .5 : .18); g.fillCircle(kx, ky, 12 * this.s);
    g.lineStyle(1, 0xffffff, st ? .6 : .2); g.strokeCircle(kx, ky, 12 * this.s);
    // 버튼
    const near = this.gs.props && this.gs.props.nearest(p.x, p.bottom), canUse = !!(near && near.kind !== 'hint'), pulse = .5 + Math.sin(this.ui.time.now / 160) * .3;
    for (const b of this.buttons) {
      // Z기술: Z크리스탈을 얻어야 보인다 · 메가: 메가스톤을 얻었고 아직 메가진화 전일 때만 (3단 진화 전이면 흐리게)
      b.hidden = (b.id === 'zmove' && !p.z.has) || (b.id === 'mega' && (!p.mega.stones || p.mega.active)) || (b.id === 'ult' && !p.mega.active);
      if (b.hidden) { b.text.setVisible(false); if (b.down) { b.down = false; this.active.forEach((v, k) => { if (v === b) this.active.delete(k); }); } continue; }
      b.text.setVisible(true).setAlpha(1);
      let fillA = b.down ? .55 : .32, ring = 0xefeae0, ringA = b.down ? .95 : .5;
      if (b.slot) {
        const id = p.skillId(b.slot), cd = p.isCombo(b.slot) ? p.zLock || 0 : p.m.cd[b.slot] || 0, max = p.isCombo(b.slot) ? .42 : p.cdOf(id) || 1, s = b.r * 1.15;
        b.icon.setVisible(true).setTexture(skillIcon(this.ui, id)).setDisplaySize(s, s).setAlpha(cd > 0 ? .4 : 1);
        this.orb(b.x, b.y, b.r, .45 + (b.down ? .2 : 0), p.mega.active ? 0xffb8e8 : ring, ringA, b.down);
        if (cd > 0) { g.fillStyle(0x000000, .55); g.slice(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cd / max), false); g.fillPath(); }
        continue;
      }
      if (b.id === 'mega') { const ready = p.mega.stones && p.tier >= 2 && !p.mega.active; fillA = ready ? fillA : .1; ring = ready ? 0xff8ad0 : 0x5a5070; b.text.setAlpha(ready ? 1 : .35); }
      if (b.id === 'zmove') { const ready = p.z.has && p.z.cd <= 0; fillA = ready ? fillA : .1; ring = ready ? 0xffe86a : 0x5a5070; b.text.setAlpha(p.z.has ? 1 : .3); }
      if (b.id === 'potion') {   // 🧪 회복 (남은 개수) — 없거나 재사용 대기면 흐리게 · 위급(체력 20% 미만)하면 초록빛으로 맥동
        const n = (p.uses && p.uses.potion) || 0, ready = n > 0 && !(p.potionCd > 0), low = p.m.alive && p.m.hp < p.m.maxhp * .2;
        b.text.setText(`🧪${n}`).setAlpha(ready ? 1 : .4);
        ring = ready ? 0x5aff8a : 0x5a5070; fillA = ready ? fillA : .1;
        if (ready && low) { ringA = .6 + pulse * .4; g.fillStyle(0x5aff8a, .14 * pulse); g.fillCircle(b.x, b.y, b.r + 6); }
        this.orb(b.x, b.y, b.r, fillA, ring, ringA, b.down);
        if (p.potionCd > 0) { g.fillStyle(0x000000, .5); g.slice(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.potionCd / 3), false); g.fillPath(); }
        continue;
      }
      if (b.id === 'swap' && p.swapCd > 0) { fillA = .12; b.text.setAlpha(.45); }
      if (b.id === 'dash' && p.dashCd > 0) fillA = .12;
      if (b.id === 'use') { ring = canUse ? 0xffd27a : 0xefeae0; ringA = canUse ? .6 + pulse * .4 : .3; b.text.setAlpha(canUse ? 1 : .45); if (canUse) { g.fillStyle(0xffd27a, .12 * pulse); g.fillCircle(b.x, b.y, b.r + 6); } }   // 가까이 센터·표지판·기술머신이 있으면 금빛으로 맥동
      this.orb(b.x, b.y, b.r, fillA, ring, ringA, b.down, b.top ? this.gTop : this.g);   // 위쪽 줄은 따로 (투명도가 다르다)
    }
  }
}
