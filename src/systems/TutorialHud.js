// 🎓 강제 실습 튜토리얼 HUD (game/Tutorial.js 의 지금 훈련을 그린다) — UIScene 이 매 프레임 update 를 부른다
//  화면 가운데 위: 큼직한 안내 패널 [훈련 제목 · 설명 · 성공 n / m] + 누를 키를 그린 키캡 애니메이션 (눌렀다 떼는 박자 · 차징은 게이지가 찬다)
//  화면 오른쪽 위: [ ESC · 튜토리얼 건너뛰기 ] 버튼 (터치 · 클릭 바로 / ESC 는 두 번 — GameScene)
//  훈련 하나를 마치면 패널이 초록으로 바뀌며 「✔ 전술 훈련 n/3 완료 — 결계 해제!」
import { HK, hkText, glassPanel, glassButton } from './ui.js';
import { Settings, keyLabel } from './Settings.js';

const PX = 320, PY = 66, PW = 404;

export class TutorialHud {
  constructor(ui) {
    this.ui = ui;
    this.g = ui.add.graphics().setDepth(18);
    this.tTitle = hkText(ui, PX, PY + 8, '', 10, '#ffe08a', { origin: [.5, 0], bold: true }).setDepth(18.5);   // 글자 간격(ls)을 주면 Phaser 가 한 글자씩 그려 이모지(🛡️)가 깨진다
    this.tBody = hkText(ui, PX, PY + 23, '', 8, HK.ivory, { origin: [.5, 0], style: { align: 'center', wordWrap: { width: PW - 24, useAdvancedWrap: true }, lineSpacing: 2 } }).setDepth(18.5);
    this.tProg = hkText(ui, PX, 0, '', 8.5, '#9affd8', { origin: [.5, 0], bold: true }).setDepth(18.5);
    this.keys = [];   // 키캡 글자
    this.skip = glassButton(ui, 512, 0, 122, 15, '[ ESC · 튜토리얼 건너뛰기 ]', () => { const t = ui.gs && ui.gs.tutorial; if (t) t.skip(); }, { size: 7.5 });
    for (const o of this.skip.objs) o.setDepth(18.5);
    this.setVis(false);
  }
  setVis(on) {
    this.g.setVisible(on); this.tTitle.setVisible(on); this.tBody.setVisible(on); this.tProg.setVisible(on);
    for (const t of this.keys) t.setVisible(on);
    for (const o of this.skip.objs) o.setVisible(on);
    if (this.skip.objs[2] && this.skip.objs[2].input) this.skip.objs[2].input.enabled = on;
  }
  keyName(k) { return keyLabel(Settings.key(k)); }
  // 지금 훈련의 글: touch — 모바일 터치 조작이면 버튼 이름으로
  text(gt, touch) {
    const Z = touch ? '평타' : this.keyName('z'), J = touch ? '점프' : this.keyName('jump'), D = touch ? '대시' : this.keyName('dash');
    if (gt.key === 'parry') return {
      title: '🛡️ [필수 전술 훈련 1/3 : 패링(Parry)]',
      body: touch ? '적의 공격이 닿기 직전 [ 조이스틱 아래(↓) + 평타 버튼 ]을 눌러 공격을 튕겨내세요! — 노란 훈련 볼은 맞아도 아프지 않습니다' : `적의 공격이 닿기 직전 [ ↓ (아래 방향키) + ${Z} ]를 동시에 눌러 공격을 튕겨내세요! — 노란 훈련 볼은 맞아도 아프지 않습니다`,
      prog: `(성공: ${gt.state === 'done' ? 1 : 0} / 1)`, keys: [['↓'], '+', [Z]]
    };
    if (gt.key === 'air') return {
      title: '🦅 [필수 전술 훈련 2/3 : 공중 기동 & 내려찍기]',
      body: `점프([${J}]) 후 공중에서 공격([${Z}] 또는 [↓ + ${Z}])하여 공중 표적을 파쇄하세요! — 바닥의 훈련용 가시는 밟으면 위로 튕겨 줍니다`,
      prog: `(성공: ${gt.orbAlive === false ? 1 : 0} / 1)`, keys: [[J], '→', [Z], '/', ['↓'], '+', [Z]]
    };
    return {
      title: '💥 [필수 전술 훈련 3/3 : 대시 회피 & 차징 샷]',
      body: `🔴 붉은 안광 공격은 패링이 불가능합니다! [${D}] 대시로 피한 뒤, [${Z}]${touch ? ' 버튼' : '키'}를 꾹 모았다 떼는 '차징 샷'으로 앞의 균열 벽을 부수고 나아가세요!`,
      prog: `(대시 회피: ${gt.dodged ? 1 : 0} / 1 · 차징 샷: ${gt.charged ? 1 : 0} / 1)`, keys: [[D], '→', [Z, 'hold']]
    };
  }
  // 돌려주는 값: 오른쪽 위 정화 진행도를 내릴 높이 (건너뛰기 버튼이 보이면)
  update(time) {
    const ui = this.ui, gs = ui.gs, tut = gs && gs.tutorial, g = this.g;
    g.clear();
    const flash = tut && tut.flash, gt = tut && tut.gate, show = !!(tut && !ui.overlayMode && (tut.showing || flash));
    if (!show) { this.setVis(false); return 0; }
    this.setVis(true);
    const touch = !!(gs.touchInput && gs.touchInput.on);
    let title, body, prog, keys = [], col = 0x6ac8ff, done = false;
    if (flash && !(gt && gt.state === 'on' && gt.raise > .99)) { title = flash.text; body = tut.done ? '조작이 기억나지 않으면 설정(O) → 키 설정, 또는 연구소 사람들에게 다시 물어보자' : '다음 지점으로 걸어가면 다음 훈련이 시작됩니다'; prog = ''; col = 0x6aff9a; done = true; }
    else { const tx = this.text(gt, touch); title = tx.title; body = tx.body; prog = tx.prog; keys = tx.keys; }
    this.tTitle.setText(title).setColor(done ? '#9affb8' : '#ffe08a');
    this.tBody.setText(body);
    const bodyH = this.tBody.height, keyY = PY + 27 + bodyH, progY = keyY + (keys.length ? 22 : 2);
    this.tProg.setText(prog).setY(progY).setColor(done ? '#9affb8' : '#9affd8');
    const H = progY + (prog ? 14 : 2) - PY;
    // 패널: 유리판 + 상태 색 테두리 (훈련 중엔 천천히 맥동)
    const beat = .5 + .5 * Math.sin(time / 300);
    glassPanel(g, PX - PW / 2, PY, PW, H, { r: 7, alpha: .9, border: col, borderAlpha: done ? .9 : .45 + .4 * beat });
    g.lineStyle(1, col, .25); g.strokeRoundedRect(PX - PW / 2 - 3, PY - 3, PW + 6, H + 6, 9);
    g.fillStyle(col, .5); g.fillRect(PX - 60, PY + 21, 120, 1);
    this.drawKeys(keys, keyY, time);
    // 건너뛰기 버튼: 방 상태 배지 아래 · ESC 를 한 번 눌렀으면 확인 문구
    const by = 62;
    for (const o of this.skip.objs) { if (o.type === 'Zone') o.setY(by); }
    this.skip.objs[1].setY(by + 7.5);
    this.skip.setLabel(tut.escArmT > 0 ? 'ESC 한 번 더 → 건너뛰기' : touch ? '[ 튜토리얼 건너뛰기 ]' : '[ ESC · 튜토리얼 건너뛰기 ]');
    this.drawSkip(by);
    return done && tut.done ? 0 : 20;
  }
  drawSkip(by) {
    // glassButton 의 그림은 처음 자리(y 0)에 그려지므로 직접 다시 그린다
    const b = this.skip, g = b.objs[0];
    g.clear();
    glassPanel(g, 512, by, 122, 15, { r: 6, fill: b.hover ? 0x2a1e24 : 0x140c12, border: 0xff9a8a, borderAlpha: b.hover ? .8 : .45, alpha: .9 });
  }
  // 키캡: [↓] + [Z] 처럼 — 박자에 맞춰 차례로 눌리는 모습 · 'hold' 는 아래에 차징 게이지가 찼다 비운다
  drawKeys(keys, y, time) {
    const ui = this.ui, g = this.g;
    while (this.keys.length < keys.length) this.keys.push(hkText(ui, 0, 0, '', 8.5, HK.ivory, { origin: .5, bold: true }).setDepth(18.6));
    this.keys.forEach((t, i) => t.setVisible(i < keys.length));
    if (!keys.length) return;
    const ws = keys.map((k, i) => { const t = this.keys[i]; t.setText(Array.isArray(k) ? (k[1] === 'hold' ? `${k[0]} 꾹` : k[0]) : k); return Array.isArray(k) ? Math.max(18, t.width + 10) : t.width + 6; });
    const total = ws.reduce((a, b) => a + b + 4, -4);
    let x = PX - total / 2;
    const caps = keys.map((k, i) => Array.isArray(k) ? i : -1).filter(i => i >= 0), beat = Math.floor(time / 420) % (caps.length + 1);
    keys.forEach((k, i) => {
      const w = ws[i], t = this.keys[i], cx = x + w / 2;
      if (Array.isArray(k)) {
        const pressed = caps.indexOf(i) < beat, hold = k[1] === 'hold', dy = pressed ? 1.5 : 0;
        g.fillStyle(0x000000, .5); g.fillRoundedRect(x, y + 2.5, w, 15, 3);
        g.fillStyle(pressed ? 0x3a3a5a : 0x24223a, 1); g.fillRoundedRect(x, y + dy, w, 14, 3);
        g.lineStyle(1, pressed ? 0xffe08a : 0xc8c0d8, pressed ? 1 : .7); g.strokeRoundedRect(x, y + dy, w, 14, 3);
        if (pressed) { g.fillStyle(0xffe08a, .18); g.fillRoundedRect(x - 2, y - 2 + dy, w + 4, 18, 4); }
        t.setPosition(cx, y + 7 + dy).setColor(pressed ? '#ffe08a' : HK.ivory);
        if (hold) {   // 차징 게이지: 1.6초에 걸쳐 찼다가 떼는 순간 번쩍
          const k2 = (time % 1800) / 1600;
          g.fillStyle(0x140c06, .9); g.fillRect(x, y + 17, w, 3);
          g.fillStyle(k2 >= 1 ? 0xffffff : 0xffc24a, 1); g.fillRect(x, y + 17, w * Math.min(1, k2), 3);
        }
      } else t.setPosition(cx, y + 7).setColor(HK.dim);
      x += w + 4;
    });
  }
}
