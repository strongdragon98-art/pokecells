// 휴대폰(특히 아이폰 사파리) 화면 맞춤
//  · 실제 보이는 높이(--app-h): 주소창이 나타나고 사라질 때·회전할 때 visualViewport 로 다시 재고 Phaser 캔버스를 즉시 재계산
//  · 세로로 들면 index.html 의 안내(#rotate)가 덮고, 던전 안이면 일시정지 (가로로 돌리면 바로 보인다)
//  · 핀치·두 번 탭 확대 막기 · 안드로이드는 첫 터치에 전체화면 + 가로 고정
//  · 아이폰 사파리(홈 화면 앱이 아닐 때): 로비 위쪽에 「공유 → 홈 화면에 추가」 안내 — itch.io 처럼 남의 페이지 안(iframe)이면 게임만 새 창으로 여는 링크
//    (로비 왼쪽 아래 빈자리에 작게 띄우고 던전에 들어가면 치운다 — 탭·버튼·조이스틱을 가리지 않게)
//    (아이폰은 웹페이지 전체화면 API 가 없어서, 주소창 없는 진짜 전체화면은 홈 화면에 추가한 앱으로만 된다)

export const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
export const isCoarse = () => matchMedia('(pointer: coarse)').matches;
const inFrame = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
const HINT_KEY = 'pokecells.iosHint';

export function setupMobile(game) {
  const root = document.documentElement;
  let portrait = false, timers = [];

  // 세로 안내 문구: 아이폰이 아니면 '휴대폰'
  const who = document.querySelector('#rotate .who');
  if (who && !isIOS) who.textContent = '휴대폰';

  const fit = () => {
    const vv = window.visualViewport, h = vv ? vv.height : window.innerHeight;
    root.style.setProperty('--app-h', `${Math.round(h)}px`);
    if (window.scrollY) window.scrollTo(0, 0);   // 주소창이 줄며 생긴 스크롤을 되돌린다
    if (game.scale) game.scale.refresh();
    checkPortrait();
  };
  // 아이폰은 회전 직후 크기가 몇 번에 걸쳐 바뀐다 → 바로 한 번 + 조금씩 늦게 몇 번 더
  const refit = () => { fit(); timers.forEach(clearTimeout); timers = [60, 250, 600].map(ms => setTimeout(fit, ms)); };
  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', refit);
  if (window.visualViewport) { visualViewport.addEventListener('resize', refit); visualViewport.addEventListener('scroll', refit); }
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', refit);
  game.events.once('ready', refit);
  refit();

  function checkPortrait() {
    const now = isCoarse() && window.innerHeight > window.innerWidth;
    if (now && !portrait) {   // 세로로 들면 던전은 일시정지 (가로로 돌린 뒤 '계속하기')
      const gs = game.scene.getScene('Game');
      if (gs && gs.sys.isActive() && !gs.paused && !gs.over && !gs.transitioning) gs.togglePause();
    }
    portrait = now;
  }

  // 확대 막기: 두 손가락 핀치 · 사파리 제스처 · 두 번 탭
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault());
  let lastTap = 0;
  document.addEventListener('touchend', e => {
    if (e.target.closest && e.target.closest('a, button')) return;   // 안내창의 링크·버튼은 그대로 눌리게
    const t = performance.now();
    if (t - lastTap < 300 && e.touches.length === 0) e.preventDefault();
    lastTap = t;
  }, { passive: false });
  document.addEventListener('contextmenu', e => e.preventDefault());

  // 안드로이드: 첫 터치에 전체화면 + 가로 고정 (아이폰 사파리는 API 가 없어 건너뛴다)
  const el = document.documentElement;
  if (!isIOS && isCoarse() && el.requestFullscreen) {
    const go = () => {
      if (document.fullscreenElement) return;
      el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
    };
    window.addEventListener('pointerup', go, { once: true });
  }

  if (isIOS && !isStandalone()) showIOSHint(game);
}

// 아이폰 사파리 안내: 홈 화면에 추가하면 주소창 없는 가로 전체화면 앱처럼 열린다
function showIOSHint(game) {
  try { if (localStorage.getItem(HINT_KEY)) return; } catch (e) { /* 저장소를 못 쓰면 매번 보여 준다 */ }
  const style = document.createElement('style');
  style.textContent = `
    #ios-hint { position: fixed; z-index: 35; left: calc(10px + env(safe-area-inset-left, 0px)); top: 42%; width: min(240px, 30%);
      box-sizing: border-box; padding: 10px 10px 10px 12px; display: flex; gap: 8px; align-items: center; border-radius: 12px;
      background: rgba(10,8,20,.92); border: 1px solid rgba(239,234,224,.28); box-shadow: 0 8px 28px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08);
      color: #efeae0; font: 12px/1.5 'Pretendard', 'Apple SD Gothic Neo', sans-serif; -webkit-user-select: none; user-select: none; touch-action: manipulation; }
    #ios-hint b { color: #ffd27a; font-weight: 600; }
    #ios-hint .txt { flex: 1; }
    #ios-hint a { display: inline-block; margin-top: 6px; padding: 6px 12px; border-radius: 8px; color: #07060f; background: #efeae0; text-decoration: none; font-weight: 700; }
    #ios-hint button { flex: none; align-self: flex-start; width: 30px; height: 30px; border: 1px solid rgba(239,234,224,.35); border-radius: 50%; background: transparent; color: #efeae0; font-size: 15px; }
    @media (orientation: portrait) and (pointer: coarse) { #ios-hint { display: none; } }`;
  document.head.appendChild(style);
  const box = document.createElement('div');
  box.id = 'ios-hint';
  box.innerHTML = inFrame
    ? `<div class="txt"><b>아이폰 전체화면으로 하려면</b><br>이 화면(itch.io 등 다른 페이지 안)에서는 주소창을 없앨 수 없어요. 게임만 새 창으로 연 뒤 공유 <b>⬆︎ → 홈 화면에 추가</b>를 누르세요.<br><a href="${location.href}" target="_blank" rel="noopener">게임만 새 창으로 열기</a></div><button type="button" aria-label="닫기">✕</button>`
    : `<div class="txt"><b>주소창 없이 전체화면으로</b><br>사파리 아래 공유 버튼 <b>⬆︎ → 홈 화면에 추가</b> 후, 홈 화면의 <b>포켓셀</b> 아이콘으로 실행하세요.</div><button type="button" aria-label="닫기">✕</button>`;
  document.body.appendChild(box);
  const close = () => { box.remove(); try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* 무시 */ } };
  box.querySelector('button').addEventListener('click', close);
  for (const ev of ['pointerdown', 'touchstart']) box.addEventListener(ev, e => e.stopPropagation());   // 게임 터치로 새지 않게
  const fade = () => {   // 저절로 사라진다 (다음에 또 보여 준다 — 닫기를 누르면 그만)
    if (!box.isConnected) return;
    box.style.transition = 'opacity .6s'; box.style.opacity = '0';
    setTimeout(() => box.remove(), 700);
  };
  setTimeout(fade, 20000);
  const watch = setInterval(() => {   // 로비를 떠나면(컷신·던전) 바로 치운다
    if (!box.isConnected) { clearInterval(watch); return; }
    if (game.scene.isActive('Cutscene') || game.scene.isActive('Game')) { clearInterval(watch); fade(); }
  }, 300);
}
