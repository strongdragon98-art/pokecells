// 플레이어 설정 (이 기기 브라우저에 저장 · 판이 끝나도 유지)
//  volume: 효과음·컷신 영상 볼륨 0~1 · sound: 소리 켬/끔 (N 키와 같다)
//  shakeHit: 내 공격이 맞을 때 카메라 흔들림 배율 0~1.5 · shakeHurt: 내가 맞을 때 · 보스 공격 · 폭발 흔들림 배율 0~1.5
//  uiScale: 화면 버튼(터치 조이스틱·버튼·위쪽 버튼) 크기 0.8~1.4 · padAlpha: 터치 패드 불투명도 0~1 (위쪽 줄은 0.4 아래로는 안 내려간다)
//  hudStyle: PC 스킬 바 디자인 'A' 모던 택티컬 · 'B' 본가 기술창 · 'C' 미니멀 픽셀 카드
//  keys: PC 조작키 { 동작: Phaser 키 이름 } — 바꿀 때 다른 동작과 겹치면 서로 맞바꾼다 (bindKey)
import Phaser from 'phaser';

const KEY = 'pokecells.settings';
// 바꿀 수 있는 PC 조작 (설정 → 키 설정 에 이 순서로 나온다)
export const KEY_ACTIONS = [
  ['left', '왼쪽'], ['right', '오른쪽'], ['up', '위 (점프 · 조사)'], ['down', '아래 (발판 내려가기)'],
  ['jump', '점프'], ['dash', '대시 회피'], ['z', '스킬 Z칸 (연타)'], ['x', '스킬 X칸'], ['c', '스킬 C칸'],
  ['swap', '교대'], ['swap2', '교대 (보조)'], ['interact', '조사 (센터 · 표지판)'], ['zmove', 'Z기술'], ['mega', '메가진화'], ['ult', '메가 필살기 (메가 중)'],
  ['map', '지도'], ['bag', '가방'], ['settings', '설정']
];
export const DEFAULT_KEYS = {
  left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN', jump: 'SPACE', dash: 'SHIFT', z: 'Z', x: 'X', c: 'C',
  swap: 'TAB', swap2: 'E', interact: 'F', zmove: 'Q', mega: 'V', ult: 'R', map: 'M', bag: 'I', settings: 'O'
};
// 고정 키 (바꿀 수 없다): 1~3 포켓몬 · Esc/P 일시정지(창 닫기) · N 소리 · F1~F12 디버그·브라우저
export const FIXED_KEYS = new Set(['ESC', 'P', 'N', 'ONE', 'TWO', 'THREE', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']);
export const SETTING_DEFAULTS = { volume: .8, sound: true, shakeHit: 1, shakeHurt: 1, uiScale: 1, padAlpha: 1, hudStyle: 'A', perf: 'auto', keys: DEFAULT_KEYS };   // perf: 그래픽 최적화 auto/normal/saver (systems/Perf.js)

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return Object.assign({}, SETTING_DEFAULTS, saved, { keys: Object.assign({}, DEFAULT_KEYS, saved.keys || {}) });
  } catch (e) { return { ...SETTING_DEFAULTS, keys: { ...DEFAULT_KEYS } }; }
}

// 키 이름 → 화면에 보일 짧은 글자
const LABEL = { LEFT: '←', RIGHT: '→', UP: '↑', DOWN: '↓', SPACE: 'Space', SHIFT: 'Shift', CTRL: 'Ctrl', ALT: 'Alt', TAB: 'Tab', ENTER: 'Enter', BACKSPACE: 'Back',
  CAPS_LOCK: 'Caps', ZERO: '0', FOUR: '4', FIVE: '5', SIX: '6', SEVEN: '7', EIGHT: '8', NINE: '9', COMMA: ',', PERIOD: '.', FORWARD_SLASH: '/', BACK_SLASH: '\\',
  SEMICOLON: ';', QUOTES: "'", OPEN_BRACKET: '[', CLOSED_BRACKET: ']', MINUS: '-', PLUS: '=', BACKTICK: '`', INSERT: 'Ins', DELETE: 'Del', HOME: 'Home', END: 'End',
  PAGE_UP: 'PgUp', PAGE_DOWN: 'PgDn' };
export const keyLabel = name => LABEL[name] || (name && name.startsWith('NUMPAD_') ? 'Num' + (LABEL[name.slice(7)] || name.slice(7)) : name || '?');
// 키보드 이벤트 → Phaser 키 이름 (없으면 null)
let reverse = null;
export function keyNameFromEvent(e) {
  if (!e || !e.keyCode) return null;
  if (!reverse) { reverse = {}; for (const [n, c] of Object.entries(Phaser.Input.Keyboard.KeyCodes)) if (!(c in reverse) && !/FIREFOX/.test(n)) reverse[c] = n; }
  return reverse[e.keyCode] || null;
}

export const Settings = {
  data: load(),
  listeners: [],
  get(k) { return this.data[k]; },
  set(k, v) {
    if (this.data[k] === v) return;
    this.data[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* 저장소를 못 쓰면 이번 판만 */ }
    for (const fn of this.listeners) fn(k, v);
  },
  reset() { for (const [k, v] of Object.entries(SETTING_DEFAULTS)) this.set(k, k === 'keys' ? { ...v } : v); },
  // 동작 act 를 키 name 으로. 다른 동작이 그 키를 쓰고 있으면 그 동작은 act 의 원래 키를 받는다 (맞바꿈). 반환: 맞바꾼 동작 (없으면 null)
  bindKey(act, name) {
    const keys = { ...this.data.keys }, old = keys[act];
    if (old === name) return null;
    const other = Object.keys(keys).find(a => a !== act && keys[a] === name) || null;
    if (other) keys[other] = old;
    keys[act] = name;
    this.set('keys', keys);
    return other;
  },
  key(act) { return this.data.keys[act]; },
  // 바뀔 때마다 fn(key, value) — 돌려받은 함수를 부르면 해제
  on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(f => f !== fn); }; }
};
