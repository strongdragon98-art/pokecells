// WebAudio 로 합성하는 효과음 (외부 음원 파일 없음) · 볼륨과 켬/끔은 설정(systems/Settings.js)을 따른다
import { Settings } from './Settings.js';

const BASE_GAIN = .28;
class AudioSys {
  constructor() {
    this.ac = null; this.master = null; this.noise = null; this.last = {};
    Settings.on(k => { if (k === 'volume' && this.master) this.master.gain.value = BASE_GAIN * Settings.get('volume'); });
  }
  get on() { return Settings.get('sound') && Settings.get('volume') > 0; }
  set on(v) { Settings.set('sound', !!v); }

  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain(); this.master.gain.value = BASE_GAIN * Settings.get('volume');
      // 묵직한 타격음이 겹쳐도 찢어지지 않게 마지막에 리미터를 건다
      const lim = this.ac.createDynamicsCompressor();
      lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = .002; lim.release.value = .12;
      this.master.connect(lim); lim.connect(this.ac.destination);
      const n = this.ac.sampleRate; this.noise = this.ac.createBuffer(1, n, n);
      const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ac = null; }
  }

  tone(f, dur, type = 'square', vol = .08, slide = 0, delay = 0) {
    if (!this.ac || !this.on) return;
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .03);
    o.onended = () => { o.disconnect(); g.disconnect(); };   // 다 울린 노드는 바로 떼어 낸다 (사파리에서 쌓이지 않게)
  }

  hiss(dur, vol = .18, freq = 1200, delay = 0, q = .8) {
    if (!this.ac || !this.on) return;
    const t = this.ac.currentTime + delay, s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * .5); s.stop(t + dur + .03);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
  }

  // 피치 드롭: f0 → f1 로 뚝 떨어지는 몸통음 (타격의 '쿵' · 폭발의 '웅')
  drop(f0, f1, dur, type = 'sine', vol = .2, delay = 0) {
    if (!this.ac || !this.on) return;
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * .85);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .03);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  // 노이즈 버퍼 + 필터 (lowpass 둔탁한 퍽 · highpass 날카로운 파열 · bandpass 중역 부서짐). sweep: 필터가 그 주파수까지 내려간다
  nz(dur, vol, type = 'lowpass', freq = 900, q = .7, delay = 0, sweep = 0) {
    if (!this.ac || !this.on) return;
    const t = this.ac.currentTime + delay, s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * .5); s.stop(t + dur + .03);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
  }

  arp(notes, step = .07, type = 'square', vol = .06) { notes.forEach((n, i) => this.tone(n, step * 1.7, type, vol, 0, i * step)); }

  play(name) {
    if (!this.ac || !this.on) return;
    const now = performance.now();
    if (now - (this.last[name] || 0) < 30) return;
    this.last[name] = now;
    switch (name) {
      case 'jump': this.tone(380, .09, 'square', .04, 260); break;
      case 'djump': this.tone(560, .1, 'square', .04, 420); break;
      case 'land': this.hiss(.05, .08, 500); break;
      case 'dash': this.hiss(.12, .1, 2200); this.tone(900, .1, 'triangle', .03, -500); break;
      case 'swing': this.hiss(.07, .12, 2800); break;
      // ---- 타격음: 노이즈 + 피치 드롭으로 '퍽' 하고 묵직하게 ----
      //  일반: 둔탁한 몸통 쿵 + 저역 퍽 + 짧은 클릭(살에 박히는 순간)
      case 'hit_normal': this.drop(170, 48, .17, 'sine', .34); this.nz(.09, .42, 'lowpass', 1500, .8, 0, 260); this.drop(1900, 500, .02, 'square', .05); this.nz(.035, .14, 'bandpass', 3200, 1.2); break;
      //  약점(효과 굉장): 날카로운 파열 + 고음 스파크 + 깊은 쿵
      case 'hit_super': this.drop(150, 38, .26, 'sine', .4); this.nz(.13, .46, 'highpass', 2600, .9, 0, 900); this.nz(.12, .36, 'lowpass', 1100, .9, 0, 180);
        this.drop(3400, 1300, .07, 'square', .07, .005); this.tone(4200, .09, 'triangle', .05, -1800, .02); this.tone(2900, .12, 'triangle', .04, 900, .05); break;
      //  별로(반감): 가볍게 튕겨 나가는 둔한 소리
      case 'hit_weak': this.drop(240, 110, .08, 'triangle', .14); this.nz(.05, .14, 'lowpass', 700, .7); break;
      //  급소: 금속성 파열음
      case 'crit': this.nz(.08, .3, 'highpass', 4200, 1, 0, 1500); this.drop(2600, 900, .06, 'sawtooth', .06); this.tone(5200, .07, 'triangle', .04, -2200, .02); break;
      //  차징 샷 · 내려찍기: 저음 폭발 (땅이 울린다)
      case 'hit_heavy': this.drop(120, 26, .5, 'sine', .5); this.drop(260, 60, .22, 'triangle', .2); this.nz(.42, .5, 'lowpass', 1800, .7, 0, 120); this.nz(.12, .3, 'bandpass', 900, 1.4, .01); break;
      case 'slam': this.drop(95, 24, .55, 'sine', .55); this.nz(.5, .55, 'lowpass', 1300, .7, 0, 90); this.nz(.16, .32, 'bandpass', 2000, 1.2, 0, 500); this.drop(400, 80, .12, 'square', .06); break;
      case 'dive': this.nz(.26, .2, 'bandpass', 1800, 2, 0, 5000); this.drop(300, 900, .22, 'sawtooth', .04); break;   // 하강하며 바람을 가르는 소리
      // 차징: 모이는 소리(단계마다 높아진다) · 다 모였을 때 '칭' · 발사
      case 'charge1': this.drop(180, 360, .3, 'sawtooth', .05); this.nz(.3, .07, 'bandpass', 900, 3, 0, 2400); break;
      case 'charge2': this.drop(260, 620, .3, 'sawtooth', .06); this.nz(.3, .09, 'bandpass', 1400, 3, 0, 3600); break;
      case 'charge3': this.drop(360, 980, .32, 'sawtooth', .07); this.nz(.32, .11, 'bandpass', 2000, 3, 0, 5200); break;
      case 'charged': this.tone(1568, .16, 'triangle', .06); this.tone(2093, .22, 'triangle', .05, 0, .06); break;
      case 'cshot1': this.drop(320, 90, .26, 'sawtooth', .1); this.nz(.22, .34, 'lowpass', 2400, .8, 0, 300); this.drop(140, 40, .3, 'sine', .3); break;
      case 'cshot2': this.drop(420, 70, .32, 'sawtooth', .12); this.nz(.3, .4, 'lowpass', 3000, .8, 0, 260); this.drop(120, 32, .4, 'sine', .4); this.tone(2400, .1, 'square', .04, -1600); break;
      case 'cshot3': this.drop(90, 22, 1.1, 'sine', .6); this.drop(600, 50, .6, 'sawtooth', .14); this.nz(.9, .55, 'lowpass', 2600, .6, 0, 70); this.nz(.3, .3, 'highpass', 3000, .8, 0, 900); break;
      case 'fire': this.hiss(.22, .16, 600); break;
      case 'water': this.tone(780, .13, 'sine', .12, -420); break;
      case 'leaf': this.tone(1300, .07, 'triangle', .07, -600); break;
      case 'zap': this.hiss(.1, .15, 3500, 0, 4); this.tone(1600, .08, 'sawtooth', .03, -1000); break;
      case 'ghost': this.tone(300, .25, 'sine', .07, -150); break;
      case 'punch': this.hiss(.09, .22, 400); this.tone(110, .12, 'square', .08, -40); break;
      case 'boom': this.hiss(.5, .32, 260); this.tone(80, .45, 'sine', .22, -40); break;
      case 'beam': this.tone(220, .5, 'sawtooth', .05, 300); this.hiss(.45, .08, 1600); break;
      // 피격: 둔탁한 충격 + 낮게 신음하듯 꺾이는 톱니파 (위기감)
      case 'hurt': this.drop(210, 55, .26, 'sine', .42); this.nz(.16, .42, 'lowpass', 900, .8, 0, 160); this.drop(170, 80, .24, 'sawtooth', .07, .01); this.nz(.04, .16, 'bandpass', 2400, 1.5); break;
      case 'hurt_big': this.drop(190, 35, .42, 'sine', .5); this.nz(.3, .5, 'lowpass', 1100, .8, 0, 110); this.drop(150, 60, .38, 'sawtooth', .09, .01); this.nz(.08, .3, 'highpass', 2600, 1, 0, 900); break;
      case 'swap': this.arp([523, 784], .05, 'triangle', .07); this.hiss(.12, .08, 3000); break;
      case 'pickup': this.tone(880, .06, 'square', .04, 320); break;
      case 'item': this.arp([659, 784, 988, 1319], .06, 'square', .05); break;
      case 'heal': this.arp([523, 659, 784], .07, 'sine', .08); break;
      case 'wave': this.arp([392, 523], .08, 'triangle', .07); break;
      case 'clear': this.arp([523, 659, 784, 1047], .09, 'square', .06); break;
      case 'unlock': this.arp([784, 988, 1175, 1568, 1976], .08, 'square', .06); break;
      case 'mega': this.tone(160, 1.1, 'sawtooth', .07, 900); this.arp([523, 784, 1047, 1568], .12, 'square', .05); break;
      case 'boss': this.tone(70, 1.2, 'sawtooth', .12, -20); break;
      case 'eshot': this.tone(500, .09, 'square', .03, -200); break;
      case 'clash': this.hiss(.07, .14, 3600, 0, 2); this.tone(1250, .06, 'square', .03, -700); break;   // 투사체끼리 부딪힘
      case 'select': this.tone(660, .05, 'square', .04); break;
      case 'talk': this.tone(520 + Math.random() * 160, .03, 'square', .018); break;   // 대화창 글자 소리 (톡톡)
      case 'purify_world': this.tone(130, 2.2, 'sawtooth', .05, 260); this.arp([523, 659, 784, 1047, 1319, 1568, 2093, 2637], .11, 'triangle', .06);   // 지방 정화: 낮은 울림 위로 맑은 화음이 번진다
        this.arp([784, 1047, 1319, 1568], .32, 'sine', .05); this.tone(2093, 1.6, 'triangle', .035, 0, .9); this.hiss(1.4, .06, 2400, 0, .6); break;
      // 기술머신 카드 등급별 뒤집기 (커먼 → 전설) · 캡슐 증기 · 전설 팡파르
      case 'card_common': this.tone(880, .08, 'triangle', .05, 220); break;
      case 'card_rare': this.arp([988, 1319, 1760], .045, 'triangle', .05); this.hiss(.1, .06, 5200, 0, 3); break;
      case 'card_unique': this.tone(220, .3, 'sawtooth', .05, 440); this.arp([784, 1047, 1319, 1760], .06, 'square', .05); break;
      case 'card_legend': this.tone(110, .9, 'sawtooth', .09, 220); this.arp([523, 659, 784, 1047, 1319, 1568, 2093], .07, 'square', .06);
        this.arp([1047, 1568, 2093], .2, 'triangle', .05); this.tone(2093, .8, 'triangle', .04, 0, .55); this.hiss(.5, .14, 900, 0, 1); break;
      case 'fieldheal': [988, 1175, 1319, 1175, 1568].forEach((f, i) => this.tone(f, i === 4 ? .5 : .11, 'square', .05, 0, [0, .1, .2, .34, .46][i])); this.tone(784, .8, 'triangle', .04, 0, .02); break;   // 띠리리- 띠리!
      case 'steam': this.hiss(.7, .2, 1400, 0, .6); this.hiss(.4, .1, 4200, .1, 2); this.tone(90, .35, 'sine', .08, 60); break;
      case 'resonate': this.tone(196, .6, 'sine', .05, 98); this.tone(392, .5, 'triangle', .025, 196, .05); break;
      case 'type': this.tone(1500, .018, 'square', .012); break;
      case 'chain': this.hiss(.3, .12, 900, 0, 3); this.tone(120, .3, 'square', .05, -40); break;
      case 'thunder': this.hiss(.7, .3, 180); this.tone(60, .6, 'sawtooth', .12, -20); break;
      case 'deny': this.tone(180, .1, 'square', .05); break;
      case 'crack': this.hiss(.06, .14, 4200, 0, 3); this.tone(1900, .04, 'square', .025, -900); break;
      case 'shatter': this.hiss(.22, .2, 5200, 0, 1.5); this.tone(2600, .12, 'square', .03, 1400); this.tone(3300, .1, 'triangle', .03, -1200, .03); this.tone(2100, .08, 'triangle', .025, 900, .07); break;
      case 'purify': this.arp([1047, 1319, 1568], .045, 'triangle', .05); break;
      case 'recall': this.tone(440, .22, 'sine', .07, 1300); this.tone(880, .18, 'square', .02, 1600, .03); this.hiss(.18, .05, 3800, .02, 3); break;
      case 'gate': this.hiss(.25, .12, 300); this.tone(140, .25, 'square', .05, 60); break;
      // 포켓몬센터 회복음: 띠리리- 띠리- (밝은 사각파 아르페지오 두 소절)
      case 'center': this.arp([784, 988, 1175, 1568], .09, 'square', .05); this.arp([1175, 1568], .16, 'square', .05); this.tone(1568, .5, 'triangle', .04, 0, .72); this.tone(784, .9, 'sine', .05, 0, .1); break;
      // 진화: 오르내리는 떨림음 → 밝은 팡파르
      case 'evolve': for (let k = 0; k < 6; k++) this.tone(k % 2 ? 660 : 523, .1, 'square', .04, 0, k * .08); this.arp([784, 988, 1175, 1568, 2093], .09, 'square', .06); this.tone(1568, .7, 'triangle', .05, 0, .55); break;
      // Z기술: 낮게 모였다가 솟는 굉음
      case 'zmove': this.tone(90, .9, 'sawtooth', .1, 900); this.hiss(.9, .14, 600, 0, 1); this.arp([523, 659, 784, 1047, 1319, 1568], .07, 'square', .05); break;
      case 'vend': this.tone(220, .08, 'square', .05); this.hiss(.12, .1, 900, .08); this.arp([988, 1319], .07, 'square', .04); break;
      case 'crate': this.hiss(.16, .26, 700); this.tone(130, .1, 'square', .07, -50); this.hiss(.08, .12, 2400, .04, 2); break;
    }
  }
}

export const Sfx = new AudioSys();
