// 칩튠 BGM 시퀀서: data/music.js 의 자작곡을 펄스·삼각파·노이즈 채널로 연주한다 (음원 파일 없음)
//  효과음(Audio.js)과 같은 AudioContext 를 쓰고, 소리 켬/끔(N 키)과 설정의 볼륨(systems/Settings.js)을 따른다
import { Sfx } from './Audio.js';
import { Settings } from './Settings.js';
import { TRACKS } from '../data/music.js';

const STEPS = 16;          // 한 마디 = 16분음표 16칸
const AHEAD = .15;         // 이만큼 앞까지 미리 예약 (초)
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7] };
const VOL = { lead: .085, arp: .03, bass: .14, k: .32, s: .11, h: .035 };

const midi = s => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error(`음 표기 오류: ${s}`);
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};
const hz = n => 440 * Math.pow(2, (n - 69) / 12);

function chord(s) {
  const m = /^([A-G][#b]?)(m|dim|aug|sus2|sus4)?(7|maj7)?$/.exec(s);
  if (!m) throw new Error(`코드 표기 오류: ${s}`);
  const iv = [...QUAL[m[2] || '']];
  if (m[3]) iv.push(m[3] === 'maj7' ? 11 : m[2] === 'dim' ? 9 : 10);
  return { root: midi(m[1] + '2'), iv };   // 근음은 2옥타브(36~47)
}

const BASS = {
  drone: r => [[0, 7.5, r], [8, 7.5, r + 7]],
  walk: r => [[0, 3.4, r], [4, 3.4, r + 7], [8, 3.4, r + 12], [12, 3.4, r + 7]],
  octave: r => [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, 1.6, i % 2 ? r + 12 : r]),
  gallop: r => [0, 3, 4, 6, 8, 11, 12, 14].map(s => [s, 1.2, s >= 12 ? r + 12 : r])
};
const ARP = {
  up16: t => Array.from({ length: 16 }, (_, i) => [i, .9, t[i % t.length]]),
  updown8: t => { const seq = [...t, ...t.slice(1, -1).reverse()]; return Array.from({ length: 8 }, (_, i) => [i * 2, 1.8, seq[i % seq.length]]); },
  stab: t => [2, 6, 10, 14].flatMap(s => t.slice(0, 3).map(n => [s, 1, n])),
  pad: t => t.slice(0, 3).map(n => [0, 15.5, n])
};

// 곡 데이터 → 칸(step)마다 울릴 음 목록
export function compile(tr) {
  const bars = tr.chords.length, steps = Array.from({ length: bars * STEPS }, () => []);
  const add = (s, ev) => steps[s % steps.length].push(ev);
  tr.chords.forEach((c, b) => {
    const { root, iv } = chord(c), tones = [...iv.map(i => root + 24 + i), root + 36];
    for (const [s, len, n] of BASS[tr.bass](root)) add(b * STEPS + s, { ch: 'bass', n, len });
    for (const [s, len, n] of ARP[tr.arp](tones)) add(b * STEPS + s, { ch: 'arp', n, len });
    for (const [d, pat] of Object.entries(tr.drums)) for (let s = 0; s < STEPS; s++) if (pat[s] === 'x') add(b * STEPS + s, { ch: d });
  });
  tr.lead.split('|').forEach((bar, b) => {
    const tok = bar.trim().split(/\s+/), res = STEPS / tok.length;
    let last = null;
    tok.forEach((t, i) => {
      if (t === '-') { if (last) last.len += res; return; }
      last = null;
      if (t === '.') return;
      last = { ch: 'lead', n: midi(t), len: res };
      add(b * STEPS + i * res, last);
    });
  });
  return { steps, stepDur: 60 / tr.bpm / 4, inst: tr.inst };
}

// 펄스파 (NES 식 듀티 12.5 / 25 / 50%)
export function makeWaves(ac) {
  const w = { tri: 'triangle' };
  for (const [k, d] of [['p12', .125], ['p25', .25], ['p50', .5]]) {
    const N = 40, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) re[n] = 2 / (n * Math.PI) * Math.sin(n * Math.PI * d);
    w[k] = ac.createPeriodicWave(re, im);
  }
  return w;
}

function osc(ac, wave, f, t) {
  const o = ac.createOscillator();
  if (typeof wave === 'string') o.type = wave; else o.setPeriodicWave(wave);
  o.frequency.setValueAtTime(f, t);
  return o;
}

// 한 칸에 들어 있는 음들을 시각 t 에 예약
export function playStep(ctx, song, i, t) {
  const { ac, bus, echo, waves, noise } = ctx;
  for (const ev of song.steps[i]) {
    const v = VOL[ev.ch];
    if (ev.ch === 'k') {
      const o = osc(ac, 'sine', 150, t), g = ac.createGain();
      o.frequency.exponentialRampToValueAtTime(42, t + .11);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .16);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + .18);
    } else if (ev.ch === 's' || ev.ch === 'h') {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), d = ev.ch === 's' ? .13 : .035;
      s.buffer = noise; f.type = 'highpass'; f.frequency.value = ev.ch === 's' ? 1600 : 7000;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * .5); s.stop(t + d + .02);
      if (ev.ch === 's') {
        const o = osc(ac, 'triangle', 190, t), g2 = ac.createGain();
        o.frequency.exponentialRampToValueAtTime(110, t + .06);
        g2.gain.setValueAtTime(v * 1.4, t); g2.gain.exponentialRampToValueAtTime(.001, t + .08);
        o.connect(g2); g2.connect(bus); o.start(t); o.stop(t + .1);
      }
    } else {
      const dur = ev.len * song.stepDur, wave = ev.ch === 'bass' ? 'triangle' : waves[song.inst[ev.ch]] || waves.p50;
      const o = osc(ac, wave, hz(ev.n), t), g = ac.createGain(), end = t + Math.max(.04, dur * .92);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + .006);
      if (ev.ch === 'arp') g.gain.exponentialRampToValueAtTime(v * .25, t + Math.min(dur, .12));
      else g.gain.setTargetAtTime(v * .62, t + .02, .12);
      g.gain.setTargetAtTime(0, end, .02);
      o.connect(g); g.connect(bus);
      if (ev.ch === 'lead') {
        g.connect(echo);
        if (dur > .35) {   // 긴 음에는 살짝 늦게 들어오는 비브라토
          const lfo = osc(ac, 'sine', 5.5, t), lg = ac.createGain();
          lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz(ev.n) * .007, t + .3);
          lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(end + .12);
        }
      }
      o.start(t); o.stop(end + .12);
    }
  }
}

// 곡 하나를 연주할 출력(볼륨 + 멜로디 메아리) 만들기
export function makeVoice(ac, dest, song, waves, noise) {
  const bus = ac.createGain(), echo = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();
  echo.delayTime.value = song.stepDur * 3; fb.gain.value = .3; wet.gain.value = .28;
  echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(bus);
  bus.connect(dest);
  return { ac, bus, echo, waves, noise };
}

class MusicSys {
  constructor() { this.want = null; this.cur = null; this.timer = null; this.vol = .55; this.songs = {}; }

  play(id) { if (!TRACKS[id]) id = null; this.want = id; this.run(); }
  stop() { this.want = null; this.run(); }

  run() {
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  tick() {
    const ac = Sfx.ac;
    if (!ac) return;   // 첫 키 입력·클릭으로 AudioContext 가 열리면 그때부터 연주
    if (!this.out) {
      this.out = ac.createGain(); this.out.gain.value = 0; this.out.connect(ac.destination);
      this.waves = makeWaves(ac);
    }
    this.out.gain.setTargetAtTime(Sfx.on ? this.vol * Settings.get('volume') : 0, ac.currentTime, .05);
    if ((this.cur ? this.cur.id : null) !== this.want) {
      if (this.cur) {   // 이전 곡은 짧게 페이드아웃
        const old = this.cur.ctx.bus;
        old.gain.setTargetAtTime(0, ac.currentTime, .25);
        setTimeout(() => old.disconnect(), 1800);
      }
      this.cur = null;
      if (this.want) {
        const song = this.songs[this.want] || (this.songs[this.want] = compile(TRACKS[this.want]));
        this.cur = { id: this.want, song, step: 0, next: ac.currentTime + .1, ctx: makeVoice(ac, this.out, song, this.waves, Sfx.noise) };
      }
    }
    const c = this.cur;
    if (!c) return;
    if (c.next < ac.currentTime - .05) c.next = ac.currentTime + .05;   // 탭이 가려져 타이머가 밀렸으면 건너뛴다
    while (c.next < ac.currentTime + AHEAD) {
      playStep(c.ctx, c.song, c.step, c.next);
      c.next += c.song.stepDur;
      c.step = (c.step + 1) % c.song.steps.length;
    }
  }
}

export const Music = new MusicSys();
