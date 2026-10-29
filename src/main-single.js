// 단일 HTML 빌드 진입점: 글꼴(필요한 글자만)과 스프라이트를 파일 안에 담아 서버 없이 실행된다.
// src/single/ 폴더는 npm run build:single 이 생성한다.
import './single/fonts.css';
import './single/embed.js';
import markUrl from '../brand/pokecells-mark.png';
import iconUrl from '../brand/pokecells-icon.png';
import { startGame } from './boot.js';
import { Sfx } from './systems/Audio.js';

// 탭 아이콘
const icon = document.createElement('link');
icon.rel = 'icon'; icon.type = 'image/png'; icon.href = iconUrl;
document.head.appendChild(icon);

// 시작 화면: 게임 마크가 곧 시작 버튼 (브라우저 정책상 소리도 이 클릭으로 켜진다)
const style = document.createElement('style');
style.textContent = `
  #splash { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    background: radial-gradient(circle at 50% 45%, #241a52 0%, #07060f 70%); z-index: 10; font-family: 'Galmuri11', sans-serif; color: #f4ecd8; }
  #splash button { border: 0; padding: 0; background: none; cursor: pointer; border-radius: 12%; animation: pc-pulse 1.6s ease-in-out infinite; }
  #splash button:hover { transform: scale(1.04); }
  #splash button:focus-visible { outline: 4px solid #ffd25a; outline-offset: 6px; }
  #splash img { display: block; width: min(58vmin, 420px); height: auto; image-rendering: pixelated; }
  #splash p { margin: 0; font-size: 18px; letter-spacing: 1px; }
  #splash small { font-size: 13px; color: #a9a5c4; }
  #splash .legal { position: absolute; left: 0; right: 0; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); padding: 0 16px; font-size: 11px; color: #8a86a4; text-align: center; letter-spacing: .3px; }
  @keyframes pc-pulse { 0%, 100% { filter: drop-shadow(0 0 0 rgba(176,138,255,0)); } 50% { filter: drop-shadow(0 0 22px rgba(176,138,255,.7)); } }
  @media (prefers-reduced-motion: reduce) { #splash button { animation: none; } }
`;
document.head.appendChild(style);

const boot = document.getElementById('boot');
if (boot) boot.hidden = true;
const splash = document.createElement('div');
splash.id = 'splash';
splash.innerHTML = `<button type="button" aria-label="게임 시작"><img src="${markUrl}" alt="포켓 셀즈"></button>
  <p>게임 마크를 누르면 시작합니다</p><small>${matchMedia('(pointer: coarse)').matches ? '화면 왼쪽을 끌어 이동 · 오른쪽 버튼으로 점프·스킬' : 'Enter 키로도 시작 · 키보드로 플레이 (Z·X·C 스킬, Space 점프)'}</small>
  <div class="legal">본 게임은 비영리 팬 게임이며, 포켓몬스터의 모든 저작권은 닌텐도와 크리쳐스, 게임프리크에 있습니다</div>`;
document.body.appendChild(splash);
const btn = splash.querySelector('button');
btn.focus();
btn.addEventListener('click', () => {
  Sfx.unlock();
  // 휴대폰: 전체화면 + 가로 고정 시도 (지원하지 않는 브라우저는 그냥 진행)
  const el = document.documentElement;
  if (matchMedia('(pointer: coarse)').matches && el.requestFullscreen) {
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  }
  splash.remove();
  if (boot) boot.hidden = false;
  startGame();
}, { once: true });
