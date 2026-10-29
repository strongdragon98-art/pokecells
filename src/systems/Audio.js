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
      this.master = this.ac.createGain(); this.master.gain.value = BASE_GAIN * Settings.get('volume'); this.master.connect(this.ac.destination);
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
      case 'hit_super': this.hiss(.14, .3, 700); this.tone(150, .16, 'square', .1, -90); this.tone(1100, .1, 'square', .05, -600, .02); break;
      case 'hit_normal': this.hiss(.08, .2, 1000); this.tone(190, .08, 'square', .06, -90); break;
      case 'hit_weak': this.hiss(.05, .1, 1800); this.tone(320, .05, 'triangle', .03, -60); break;
      case 'crit': this.tone(1300, .1, 'square', .05, -700); break;
      case 'fire': this.hiss(.22, .16, 600); break;
      case 'water': this.tone(780, .13, 'sine', .12, -420); break;
      case 'leaf': this.tone(1300, .07, 'triangle', .07, -600); break;
      case 'zap': this.hiss(.1, .15, 3500, 0, 4); this.tone(1600, .08, 'sawtooth', .03, -1000); break;
      case 'ghost': this.tone(300, .25, 'sine', .07, -150); break;
      case 'punch': this.hiss(.09, .22, 400); this.tone(110, .12, 'square', .08, -40); break;
      case 'boom': this.hiss(.5, .32, 260); this.tone(80, .45, 'sine', .22, -40); break;
      case 'beam': this.tone(220, .5, 'sawtooth', .05, 300); this.hiss(.45, .08, 1600); break;
      case 'hurt': this.tone(220, .2, 'sawtooth', .1, -140); break;
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
