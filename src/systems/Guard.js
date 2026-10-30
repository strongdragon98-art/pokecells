// 게임 루프 보호: 한 프레임 안에서 오류가 나도 게임이 영영 멈추지 않게
//  Phaser 는 프레임(Game.step)을 다 돈 뒤에야 다음 프레임을 예약한다 → 기술 하나에서 오류가 나면 다음 프레임이 예약되지 않아
//  화면이 그대로 굳는다 (배경음악은 따로 도는 타이머라 계속 들린다)
//  → Game.step 을 감싸 오류를 잡고 다음 프레임은 그대로 돌게 한다. 오류는 콘솔과 화면 왼쪽 아래에 잠깐 띄운다 (같은 오류는 한 번만)
import Phaser from 'phaser';

const seen = new Map();
let box = null, hideT = null;

function show(msg) {
  if (!box) {
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;max-width:70vw;padding:6px 10px;border-radius:6px;'
      + 'background:rgba(40,8,16,.88);color:#ffb0b8;font:12px/1.4 monospace;pointer-events:none;white-space:pre-wrap';
    document.body.appendChild(box);
  }
  box.textContent = `오류가 나서 그 동작을 건너뛰었어요 (게임은 계속됩니다)\n${msg}`;
  box.style.display = 'block';
  clearTimeout(hideT);
  hideT = setTimeout(() => { box.style.display = 'none'; }, 6000);
}

export function installGuard() {
  if (Phaser.Game.prototype.__guarded) return;
  const step = Phaser.Game.prototype.step;
  Phaser.Game.prototype.step = function (time, delta) {
    try { step.call(this, time, delta); }
    catch (err) {
      const msg = `${err && err.message}`, where = ((err && err.stack) || '').split('\n').slice(1, 3).join('\n');
      const n = (seen.get(msg) || 0) + 1;
      seen.set(msg, n);
      if (n === 1) { console.error('[게임 루프 오류]', err); show(`${msg}\n${where}`); }
      (window.__pokecellsErrors = window.__pokecellsErrors || []).push(msg);
    }
  };
  Phaser.Game.prototype.__guarded = true;
}
