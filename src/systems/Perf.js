// 성능 모드 · 안전 모드
//  설정 「그래픽 최적화」: 자동 / 일반 / 절전
//   절전: 파티클 밀도 절반 · 동시 파티클 상한 절반 · 블룸(화면 번짐, 전체 화면을 여러 번 흐리는 후처리) 끔 — 기술·포켓몬 그림은 그대로
//   자동: 인앱 브라우저(카카오톡 등) · 메모리 4GB 이하 기기 · 안전 모드 · 게임 중 FPS 가 계속 45 아래면 절전으로
//  안전 모드: 지난 접속이 부팅 도중 끊겼거나(index.html 이 표시) WebGL 컨텍스트를 잃으면 켜진다 → 절전 + 고해상도 PC 렌더링 배율 3 → 2 (config.js)
import { Settings } from './Settings.js';

const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
export const ENV = {
  ios: /iPhone|iPad|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  inApp: /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|whale\/.*inapp|; wv\)/i.test(ua),
  lowMem: typeof navigator !== 'undefined' && navigator.deviceMemory > 0 && navigator.deviceMemory <= 4
};

const SAFE_KEY = 'pokecells.safe';
let safe = false;
try { safe = localStorage.getItem(SAFE_KEY) === '1'; } catch (e) { /* 저장소를 못 쓰면 끈 채로 */ }
let slow = false;          // 자동 모드에서 FPS 가 계속 낮아 켠 절전
const subs = new Set();
const emit = () => subs.forEach(f => { try { f(); } catch (e) { console.warn(e); } });
Settings.on(k => { if (k === 'perf') emit(); });

// 화면 위 짧은 안내 (게임 캔버스와 상관없이 보인다)
function notice(msg) {
  const d = document.createElement('div');
  d.textContent = msg;
  d.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:99999;padding:8px 14px;border-radius:8px;background:rgba(10,8,20,.9);color:#ffe0a0;font:13px sans-serif;pointer-events:none';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 5000);
}

export const Perf = {
  get mode() { return Settings.get('perf') || 'auto'; },
  get saver() { const m = this.mode; return m === 'saver' || (m === 'auto' && (safe || slow || ENV.inApp || ENV.lowMem)); },
  get safe() { return safe; },
  get reason() { return safe ? '안전 모드' : slow ? 'FPS 낮음' : ENV.inApp ? '인앱 브라우저' : ENV.lowMem ? '저사양 기기' : ''; },
  // 파티클 밀도 배율 (Fx.burst)
  get particleMul() { return this.saver ? .5 : 1; },
  get maxParticles() { return this.saver ? 220 : 420; },
  get bloom() { return !this.saver; },
  // 절전 여부가 바뀌면 (설정 · 자동 전환 · 안전 모드)
  on(fn) { subs.add(fn); return () => subs.delete(fn); },
  markSafe(why) {
    if (!safe) console.warn('[성능] 안전 모드로 전환:', why);
    safe = true;
    try { localStorage.setItem(SAFE_KEY, '1'); } catch (e) { /* 이번 접속만 */ }
    emit();
  },
  // 설정에서 「일반」을 직접 고르면 안전 모드도 풀린다 (다음 접속부터 렌더링 배율도 원래대로)
  clearSafe() {
    safe = false; slow = false;
    try { localStorage.removeItem(SAFE_KEY); } catch (e) { /* 무시 */ }
    emit();
  },

  // 자동 모드: 게임 화면에서 FPS 를 1초마다 재서 6초 연속 45 아래면 절전으로 (한 번 켜면 그 접속 동안 유지)
  watch(game) {
    let low = 0;
    setInterval(() => {
      if (slow || this.mode !== 'auto' || document.hidden) { low = 0; return; }
      const gs = game.scene.getScene('Game');
      if (!gs || !gs.sys.isActive() || gs.paused) { low = 0; return; }
      low = game.loop.actualFps < 45 ? low + 1 : 0;
      if (low >= 6) { slow = true; console.warn('[성능] FPS 가 낮아 절전 모드로 전환'); emit(); }
    }, 1000);
  },

  // 위험 구간 표시: ms 동안 '부팅 중' 표시를 남겨 두고(index.html 이 처음 남긴다), 무사히 지나면 지운다
  //  그 사이 탭이 튕겨 다시 열리면 index.html 이 안전 모드를 켠다 (오프닝 화면 · 게임 시작 직후)
  arm(ms) {
    try { localStorage.setItem('pokecells.bootAt', String(Date.now())); } catch (e) { return; }
    clearTimeout(this.armT);
    this.armT = setTimeout(() => { try { localStorage.removeItem('pokecells.bootAt'); } catch (e) { /* 무시 */ } }, ms);
  },

  // WebGL 컨텍스트 손실(그래픽 메모리 부족) · 메모리 부족 오류 → 안전 모드로 바꾸고 게임은 그대로 이어 간다
  install(game) {
    const cv = game.canvas;
    if (cv) {
      cv.addEventListener('webglcontextlost', () => { this.markSafe('WebGL 컨텍스트 손실'); notice('그래픽 메모리가 부족해 절전 모드로 바꿨어요. 잠시 후 화면이 돌아옵니다'); }, false);
      cv.addEventListener('webglcontextrestored', () => emit(), false);
    }
    window.addEventListener('error', e => { if (/out of memory|webgl|context lost/i.test(String(e && e.message))) this.markSafe(e.message); });
    this.watch(game);
  }
};
