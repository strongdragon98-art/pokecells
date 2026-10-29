// 한글 입력 모드(IME)에서도 키보드가 먹히게 + 눌린 채로 굳는 키 방지
//  한글 입력 상태에서 Z·X·C 같은 글자 키를 누르면 브라우저가 keyCode 229('Process', 조합 중)를 보내는데,
//  Phaser 는 keyCode 로 키를 찾으므로 이 입력을 통째로 버린다 → 공격 키가 갑자기 안 먹히고, 누른 채로 한/영이 바뀌면
//  keyup 도 버려져 키가 계속 눌린 상태로 남는다 (윈도우 한글 키보드는 Shift+Space 가 한/영 전환이라 대시+점프를 함께 누르면 바뀐다)
//  → Phaser 보다 먼저(capture) 이벤트를 받아, 물리 키 위치(event.code)로 원래 keyCode 를 되살려 넘긴다
//  창이 포커스를 잃거나 탭이 가려질 때도 눌린 키를 모두 놓는다 (keyup 을 못 받아 굳지 않게)

const CODE = {
  Space: 32, Enter: 13, NumpadEnter: 13, Tab: 9, Escape: 27, Backspace: 8, Delete: 46,
  ShiftLeft: 16, ShiftRight: 16, ControlLeft: 17, ControlRight: 17, AltLeft: 18, AltRight: 18,
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  Semicolon: 186, Equal: 187, Comma: 188, Minus: 189, Period: 190, Slash: 191, Backquote: 192, BracketLeft: 219, Backslash: 220, BracketRight: 221, Quote: 222
};
for (let i = 0; i < 26; i++) CODE['Key' + String.fromCharCode(65 + i)] = 65 + i;
for (let i = 0; i < 10; i++) { CODE['Digit' + i] = 48 + i; CODE['Numpad' + i] = 96 + i; }
for (let i = 1; i <= 12; i++) CODE['F' + i] = 111 + i;

// IME 조합 중(229 · 'Process')이거나 keyCode 가 비어 있으면 물리 키 위치로 keyCode 를 다시 붙인다
function fix(e) {
  if (e.keyCode && e.keyCode !== 229 && e.key !== 'Process') return;
  const kc = CODE[e.code];
  if (!kc) return;
  try {
    Object.defineProperty(e, 'keyCode', { get: () => kc, configurable: true });
    Object.defineProperty(e, 'which', { get: () => kc, configurable: true });
  } catch (err) { /* 고칠 수 없는 브라우저는 그대로 */ }
}

export function installKeyFix(game) {
  window.addEventListener('keydown', fix, true);
  window.addEventListener('keyup', fix, true);
  const release = () => {
    for (const s of game.scene.getScenes(true)) if (s.input && s.input.keyboard) s.input.keyboard.resetKeys();
  };
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
}
