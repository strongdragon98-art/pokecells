// 🏆 진 엔딩: 유대의 전당등록 (Hall of Fame) → 🎬 엔딩 크레딧 → The End → 타이틀
//  GameScene.triggerEndingCinematic 이 레드의 마지막 대화가 닫히는 즉시(어떻게 끊어도 — DialogWatchdog) 하얗게 페이드한 뒤 이 씬으로 (data: GameScene.endingData)
//  ① 백색에서 별빛이 쏟아지는 은빛 전당이 떠오르고 팡파르(data/music.js halloffame)
//  ② 「🏆 명예의 전당 등록 (HALL OF FAME)」 · 「✨ CONGRATULATIONS! CLEAR!」가 금빛 입자 · 무지개 후광과 함께 도장 찍히듯
//  ③ 출전 포켓몬 3마리가 왼쪽부터 스포트라이트를 받으며 (이름 · 진화 단계 · 경험치 · 유대의 힘) → 기술 · 기술머신 카드가 펼쳐지고 → 도구 · 보스 코어
//  ④ [ 모험 시간 | 구한 포켓몬 | 샛길 정화율 ] · 감동 문구 — 아무 키나 누를 때까지 그대로
//  ⑤ 크레딧: 챕터별 추억의 장소(관동 숲 · 성도 방울탑 · 호연 하늘기둥 · 신오 창기둥 · 하나 용나선탑 · 가라르의 새벽)가 시차 스크롤로 지나가고
//     제작 · 출처 · 감사 글과 함께 동료 포켓몬 · 정화한 보스들의 도트가 행진하며 올라간다 (약 2분 30초 · Esc 길게 누르면 건너뛰기)
//  ⑥ The End → 타이틀 (전당등록 금장 테두리 · 2회차 보스 정수 선택이 해금되었다는 안내)
import Phaser from 'phaser';
import { GAME_W, GAME_H, RES, uiCamera, pxt, FONT_TITLE } from '../config.js';
import { SPECIES, SKILLS, BOSSES } from '../data/pokemon.js';
import { ITEMS } from '../data/items.js';
import { STAGES } from '../data/stages.js';
import { UPGRADES } from '../data/tm.js';
import { PERKS } from '../game/Perks.js';
import { ESSENCES } from '../data/essence.js';
import { typeColor } from '../data/types.js';
import { HK, hkText, glassPanel } from '../systems/ui.js';
import { skillIcon, itemArt } from '../systems/Textures.js';
import { Sprites } from '../systems/SpriteLoader.js';
import { Save } from '../systems/Save.js';
import { Music } from '../systems/Music.js';
import { Sfx } from '../systems/Audio.js';

const ADD = Phaser.BlendModes.ADD;
const GOLD = 0xffd25a, RAINBOW = [0xff5a6a, 0xffa03a, 0xffe04a, 0x7aff8a, 0x5ac8ff, 0xb07aff];
const CREDIT_SEC = 150;   // 크레딧 롤 길이 (초)
const BOND_STARS = n => '★'.repeat(n) + '☆'.repeat(Math.max(0, 6 - n));
const hms = s => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return `${h}시간 ${String(m).padStart(2, '0')}분`; };
// 크레딧 글 (제작 · 출처는 README 「에셋 출처와 라이선스」와 같게)
const CREDITS = [
  ['title', '포켓셀즈 (Pokécells)'], ['sub', '— 유대의 이야기 —'], ['gap'],
  ['role', '기획 · 개발 · 테스트'], ['name', '포켓셀즈 개발자'], ['gap'],
  ['role', 'AI 공동 개발'], ['name', 'Claude (Anthropic)'], ['gap'],
  ['role', '게임 엔진'], ['name', 'Phaser 3'], ['gap'],
  ['role', '포켓몬 도트 · 초상화'], ['name', 'PMD Sprite Collab 기여자 여러분 (CC BY-NC 4.0)'], ['gap'],
  ['role', '메가 · 특수 폼 원본 도트'], ['name', 'PokeAPI sprites'], ['gap'],
  ['role', '스킬 아이콘'], ['name', 'game-icons.net — Lorc · Delapouite (CC BY 3.0)'], ['gap'],
  ['role', '아이템 그림'], ['name', 'Serebii 아이템 도감'], ['gap'],
  ['role', '글꼴'], ['name', 'Galmuri · Pretendard · Cinzel (SIL OFL 1.1)'], ['gap'],
  ['role', '음악 · 효과음'], ['name', '자작 칩튠 — Web Audio 합성'], ['gap'],
  ['parade', 'allies', '함께 모험한 동료들'], ['gap'],
  ['parade', 'bosses', '정화한 전설과 보스들'], ['gap'],
  ['role', '원작'], ['name', '포켓몬스터 시리즈 © Nintendo · Creatures · GAME FREAK'], ['small', '이 게임은 비상업 팬 게임입니다'], ['gap'], ['gap'],
  ['sub', '그리고 —'], ['name', '끝까지 유대를 지켜 낸 당신에게'], ['gap'], ['title', '감사합니다!']
];
// 크레딧 배경: 챕터별 추억의 장소 (STAGES 팔레트 · 실루엣 종류)
const PLACES = [
  { ci: 0, name: '관동 · 심연이 걷힌 상록숲', kind: 'forest' },
  { ci: 1, name: '성도 · 구름 위의 방울탑', kind: 'pagoda' },
  { ci: 2, name: '호연 · 성층권의 하늘기둥', kind: 'pillar' },
  { ci: 3, name: '신오 · 눈 덮인 창기둥', kind: 'columns' },
  { ci: 4, name: '하나 · 용나선탑', kind: 'spiral' },
  { ci: 5, name: '가라르 · 블랙나이트 위의 새벽', kind: 'castle' }
];

export default class EndingScene extends Phaser.Scene {
  constructor() { super('Ending'); }

  init(data) {
    this.d = data || {};
    this.d.members = this.d.members || [];
    this.phase = 'hof'; this.ready = false; this.skipT = 0;
  }

  create() {
    uiCamera(this);
    const cam = this.cameras.main;
    cam.setBackgroundColor('#ffffff');
    this.meta = this.registry.get('spriteMeta') || {};
    // 나중에 쓸 도트를 미리 받는다 (전당등록 3마리 먼저, 행진할 동료 · 보스는 이어서)
    this.allies = (Save.data.joined || []).filter(k => SPECIES[k]).map(k => SPECIES[k].evo[SPECIES[k].evo.length - 1].key).slice(0, 36);
    this.bossKeys = [...new Set((this.d.bosses || []).concat(Object.keys(Save.data.beaten || {})).filter(k => BOSSES[k]).map(k => BOSSES[k].sprite || k))].slice(0, 24);
    const first = this.d.members.map(m => m.visual);
    Sprites.ensure(first).then(() => { this.firstReady = true; });
    Sprites.ensure([...this.allies, ...this.bossKeys]).then(() => { this.paradeReady = true; });
    this.input.keyboard.on('keydown', e => this.onKey(e));
    this.input.keyboard.on('keyup', e => { if (e.code === 'Escape') this.skipHeld = false; });
    this.input.on('pointerdown', p => this.onTap(p));
    this.input.on('pointerup', () => { this.skipHeld = false; });
    this.buildHall();
    cam.fadeIn(1600, 255, 255, 255);
    Music.play('halloffame');
  }

  // ---------------- ① ~ ④ 전당등록 ----------------
  buildHall() {
    const L = this.hall = this.add.container(0, 0), g = this.add.graphics(); L.add(g);
    // 은빛 전당: 짙은 남색 하늘 · 별빛 · 양옆 은기둥 · 반들거리는 바닥 · 위에서 쏟아지는 빛기둥
    g.fillGradientStyle(0x05060f, 0x05060f, 0x161a36, 0x161a36, 1); g.fillRect(0, 0, GAME_W, 230);
    g.fillGradientStyle(0x1a1e3a, 0x1a1e3a, 0x07080f, 0x07080f, 1); g.fillRect(0, 230, GAME_W, 130);
    g.lineStyle(1, 0x8a92c8, .35); g.lineBetween(0, 230, GAME_W, 230);
    for (let i = 0; i < 14; i++) { g.lineStyle(1, 0x8a92c8, .05 + (i % 3) * .02); g.lineBetween(320 + (i - 7) * 60, 230, 320 + (i - 7) * 160, 360); }   // 바닥 원근선
    for (const x of [34, 606]) {   // 은기둥
      g.fillStyle(0x2a2e4a, 1); g.fillRect(x - 14, 20, 28, 210); g.fillStyle(0x6a72a8, .5); g.fillRect(x - 12, 20, 5, 210); g.fillStyle(0x0c0e1e, .6); g.fillRect(x + 8, 20, 6, 210);
      g.fillStyle(0x8a92c8, 1); g.fillRect(x - 18, 14, 36, 8); g.fillRect(x - 18, 226, 36, 6);
    }
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      const s = this.add.image(Math.random() * GAME_W, Math.random() * 220, 'glow').setBlendMode(ADD).setTint(Math.random() < .2 ? 0xffe8a0 : 0xd0d8ff).setScale(.02 + Math.random() * .05).setAlpha(.3 + Math.random() * .6);
      L.add(s); this.tweens.add({ targets: s, alpha: .1, duration: 600 + Math.random() * 1600, yoyo: true, repeat: -1, delay: Math.random() * 1500 });
    }
    // 쏟아지는 별빛 (아래로 천천히)
    this.time.addEvent({ delay: 140, loop: true, callback: () => {
      if (this.phase !== 'hof') return;
      const s = this.add.image(Math.random() * GAME_W, -4, 'glow').setBlendMode(ADD).setTint(Math.random() < .5 ? 0xffe8a0 : 0xffffff).setScale(.04).setAlpha(.8); L.add(s);
      this.tweens.add({ targets: s, y: 200 + Math.random() * 40, x: s.x + (Math.random() - .5) * 60, alpha: 0, duration: 2600 + Math.random() * 1600, onComplete: () => s.destroy() });
    } });
    const rays = this.add.graphics().setBlendMode(ADD); L.add(rays);
    for (let i = 0; i < 5; i++) { rays.fillStyle(0xd8e0ff, .035); rays.fillTriangle(320 + (i - 2) * 30, 0, 320 + (i - 2) * 120 - 60, 232, 320 + (i - 2) * 120 + 60, 232); }
    // 타이틀은 하얀 페이드가 걷힐 즈음
    this.time.delayedCall(900, () => this.stampTitle());
    this.time.delayedCall(2300, () => this.showMembers());
  }
  stampTitle() {
    const L = this.hall;
    const halo = this.add.graphics().setBlendMode(ADD); L.add(halo);
    RAINBOW.forEach((c, k) => { halo.lineStyle(3, c, .22); halo.strokeEllipse(320, 40, 360 + k * 16, 46 + k * 6); });
    halo.setAlpha(0); this.tweens.add({ targets: halo, alpha: 1, duration: 500 });
    this.tweens.add({ targets: halo, scaleX: 1.03, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const stamp = (y, s, size, col, scale, delay) => {
      const t = this.add.text(320, y, s, pxt(size, col, { stroke: '#2a1a00', strokeThickness: 3 })).setOrigin(.5).setScale(scale * 2.6).setAlpha(0); L.add(t);
      this.time.delayedCall(delay, () => {
        t.setAlpha(1); this.tweens.add({ targets: t, scale, duration: 260, ease: 'Back.easeOut' });
        this.cameras.main.shake(140, .006);
        Sfx.play('card_legend');
        for (let k = 0; k < 26; k++) {   // 금빛 입자
          const p = this.add.image(320 + (Math.random() - .5) * 260, y, 'glow').setBlendMode(ADD).setTint(k % 3 ? GOLD : 0xffffff).setScale(.06).setAlpha(1); L.add(p);
          this.tweens.add({ targets: p, x: p.x + (Math.random() - .5) * 120, y: y + (Math.random() - .3) * 70, alpha: 0, scale: .01, duration: 700 + Math.random() * 500, onComplete: () => p.destroy() });
        }
      });
      return t;
    };
    stamp(34, '🏆 명예의 전당 등록  (HALL OF FAME)', 14, '#ffd25a', 1.5, 0);
    stamp(62, '✨ CONGRATULATIONS! CLEAR!', 14, '#fff6d0', 1, 650);
  }
  // 출전 포켓몬 3마리: 왼쪽부터 한 마리씩 스포트라이트
  showMembers() {
    const L = this.hall, ms = this.d.members, xs = ms.length === 1 ? [320] : ms.length === 2 ? [220, 420] : [150, 320, 490], foot = 196;
    ms.forEach((m, i) => this.time.delayedCall(i * 900, () => {
      const x = xs[i], col = typeColor((m.types || ['normal'])[0]);
      const cone = this.add.graphics().setBlendMode(ADD).setAlpha(0); L.add(cone);
      cone.fillStyle(0xfff2c8, .07); cone.fillTriangle(x - 10, 70, x - 78, foot + 4, x + 78, foot + 4);
      cone.fillStyle(0xfff2c8, .08); cone.fillTriangle(x - 5, 70, x - 46, foot + 4, x + 46, foot + 4);
      cone.fillStyle(0xfff2c8, .16); cone.fillEllipse(x, foot + 2, 120, 16);
      this.tweens.add({ targets: cone, alpha: 1, duration: 400 });
      const back = this.add.image(x, foot - 34, 'glow').setBlendMode(ADD).setTint(col).setScale(2.2, 2.6).setAlpha(0); L.add(back);
      this.tweens.add({ targets: back, alpha: .35, duration: 600 });
      const spr = this.monSprite(m.visual, x - 160, foot, 74, 'Walk'); L.add(spr);
      this.tweens.add({ targets: spr, x, duration: 700, ease: 'Cubic.easeOut', onComplete: () => { this.playAnim(spr, m.visual, 'Idle'); this.cameras.main.flash(120, 255, 240, 200); } });
      Sfx.play('mega');
      const tx = (y, s, size, color, bold) => { const t = hkText(this, x, y, s, size, color, { origin: [.5, 0], bold }); t.setAlpha(0); L.add(t); this.tweens.add({ targets: t, alpha: 1, duration: 400, delay: 500 }); return t; };
      tx(foot + 6, m.name, 11, HK.gold, true);
      tx(foot + 21, `${m.tierName}${m.mega ? ' · 메가진화' : ''}  ·  누적 경험치 ${m.exp.toLocaleString()}`, 7, '#e8dcc0');
      tx(foot + 31, `유대의 힘 Lv.${this.d.bond || 0}  ${BOND_STARS(this.d.bond || 0)}`, 7, '#ffd25a', true);
    }));
    this.time.delayedCall(ms.length * 900 + 600, () => this.showBuild());
  }
  // 기술 · 기술머신 카드가 펼쳐지고 → 도구 · 보스 코어
  showBuild() {
    const L = this.hall, cards = [], items = [];
    for (const m of this.d.members) {
      for (const id of m.skills || []) if (SKILLS[id]) cards.push({ icon: skillIcon(this, id), name: SKILLS[id].name, col: typeColor(SKILLS[id].type) });
      for (const id of m.ups || []) { const u = UPGRADES[id]; if (u) cards.push({ icon: u.skill && SKILLS[u.skill] ? skillIcon(this, u.skill) : null, name: u.name, col: u.grade === '전설' ? GOLD : 0xb07aff, glyph: '✦' }); }
      for (const id of m.perks || []) { const pk = PERKS[id]; if (pk) cards.push({ icon: null, name: pk.name, col: 0x8ad8ff, glyph: '✚' }); }
      for (const id of m.items || []) if (ITEMS[id]) items.push({ id, it: ITEMS[id] });
    }
    const show = cards.slice(0, 26), n = show.length, gap = Math.min(23, 560 / Math.max(1, n)), y = 262;
    if (n) L.add(hkText(this, 320, y - 18, '기술 · 기술머신 카드', 7, HK.dim, { origin: .5 }));
    show.forEach((c, i) => {
      const fx = 320 + (i - (n - 1) / 2) * gap, card = this.add.container(320, y + 30).setAlpha(0).setScale(.4); L.add(card);
      const g = this.add.graphics(); card.add(g);
      g.fillStyle(0x0c0a16, .95); g.fillRoundedRect(-10, -13, 20, 26, 3); g.lineStyle(1, c.col, .9); g.strokeRoundedRect(-10, -13, 20, 26, 3);
      if (c.icon) card.add(this.add.image(0, -1, c.icon).setDisplaySize(15, 15));
      else card.add(hkText(this, 0, -1, c.glyph || '✦', 10, '#ffffff', { origin: .5 }));
      this.tweens.add({ targets: card, x: fx, y, alpha: 1, scale: 1, angle: (i - (n - 1) / 2) * 1.2, duration: 420, delay: i * 45, ease: 'Back.easeOut' });
    });
    if (n) this.time.delayedCall(n * 45 + 200, () => Sfx.play('card_rare'));
    // 도구 · 보스 코어
    const iy = 296, uniq = [...new Map(items.map(o => [o.id, o])).values()].slice(0, 16);
    if (uniq.length) L.add(hkText(this, 320, iy - 13, '도구 · 보스 코어', 7, HK.dim, { origin: .5 }));
    uniq.forEach((o, i) => {
      const x = 320 + (i - (uniq.length - 1) / 2) * 26, core = !!o.it.core;
      if (core) { const gl = this.add.image(x, iy + 2, 'glow').setBlendMode(ADD).setTint(o.it.core.color || GOLD).setScale(.5).setAlpha(.6); L.add(gl); }
      let icon = null; try { icon = itemArt(this, o.id); } catch (e) { icon = null; }
      const im = icon ? this.add.image(x, iy + 2, icon).setDisplaySize(16, 16) : hkText(this, x, iy + 2, '◆', 10, '#ffd25a', { origin: .5 });
      im.setAlpha(0); L.add(im); this.tweens.add({ targets: im, alpha: 1, y: iy, duration: 300, delay: 600 + i * 60 });
    });
    if (this.d.essence && ESSENCES[this.d.essence.id]) { const E = ESSENCES[this.d.essence.id]; L.add(hkText(this, 620, iy, `${E.icon} ${E.name} +${this.d.essence.lv}`, 7, '#d8b0ff', { origin: [1, .5], bold: true })); }
    this.time.delayedCall(1500, () => this.showStats());
  }
  showStats() {
    const L = this.hall, d = this.d;
    const line = `[ 모험 시간: ${hms(d.time || 0)}  |  구한 포켓몬: ${d.joined || 0}마리  |  샛길 정화율: ${Math.round((d.sideRate || 0) * 100)}% (${d.sideN || 0}/${d.sideAll || 0}) ]`;
    const t = hkText(this, 320, 316, line, 8.5, '#fff0c8', { origin: .5, bold: true }); t.setAlpha(0); L.add(t);
    this.tweens.add({ targets: t, alpha: 1, duration: 600 });
    this.time.delayedCall(1300, () => {
      // 레드가 잠들어 있던 곳은 가라르 블랙나이트의 심장 (원래 문구의 '은빛산'을 이 이야기에 맞게)
      const poem = hkText(this, 320, 334, '당신의 유대가 블랙나이트의 어둠을 밝히고 전설을 구했습니다.', 9.5, '#ffe8a8', { origin: .5, glow: true, glowColor: 'rgba(255,210,90,0.7)' });
      poem.setAlpha(0); L.add(poem); this.tweens.add({ targets: poem, alpha: 1, duration: 1400 });
      this.time.delayedCall(2600, () => {
        this.ready = true;
        const press = hkText(this, 320, 351, '— 아무 키나 누르면 엔딩 크레딧 —', 7, HK.dim, { origin: .5 }); L.add(press);
        this.tweens.add({ targets: press, alpha: .25, duration: 700, yoyo: true, repeat: -1 });
      });
    });
  }

  // ---------------- 도트 (인게임 모션 시트) ----------------
  monSprite(key, x, y, h, anim = 'Idle') {
    const spr = this.add.sprite(x, y, 'px');
    const meta = this.meta[key];
    spr.setScale(Phaser.Math.Clamp(h / Math.max(10, (meta && meta.height) || 30), .5, 3.4));
    this.playAnim(spr, key, anim);
    return spr;
  }
  playAnim(spr, key, anim, dir = 'right') {
    const meta = this.meta[key];
    let k = `${key}:${anim}:${dir}`;
    if (!this.anims.exists(k)) k = `${key}:Idle:${dir}`;
    if (this.anims.exists(k)) { spr.play(k); const a = meta && meta.anims[anim] || (meta && meta.anims.Idle); spr.setOrigin(.5, a ? a.oy : .75); }
    else if (this.textures.exists(`icon:${key}`)) { spr.setTexture(`icon:${key}`).setOrigin(.5, 1); spr.setScale(1.2); }
  }

  // ---------------- ⑤ 엔딩 크레딧 ----------------
  startCredits() {
    if (this.phase !== 'hof') return;
    this.phase = 'credits';
    Sfx.play('select');
    const cam = this.cameras.main;
    cam.fadeOut(800, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.hall.destroy(); this.hall = null;
      cam.setBackgroundColor('#000000');
      Music.play('credits');
      this.buildPlaces();
      this.buildRoll();
      this.buildSkip();
      cam.fadeIn(1200, 0, 0, 0);
    });
  }
  // 추억의 장소: 챕터마다 하늘 · 먼 산 · 건물 실루엣 · 가까운 땅 — 서로 다른 빠르기로 흐른다 (시차 스크롤)
  buildPlaces() {
    this.places = PLACES.map((pl, i) => {
      const pal = (STAGES[pl.ci] && STAGES[pl.ci].palette) || {};
      const C = this.add.container(0, 0).setAlpha(i ? 0 : 1).setDepth(0);
      const sky = this.add.graphics(); C.add(sky);
      const top = pl.kind === 'castle' ? 0x1a1030 : shadeC(pal.sky ?? 0x0a0a18, 1.4), bot = pl.kind === 'castle' ? 0xff9a5a : shadeC(pal.far ?? 0x203040, 1.8);
      sky.fillGradientStyle(top, top, bot, bot, 1); sky.fillRect(0, 0, GAME_W, GAME_H);
      for (let k = 0; k < 40; k++) { sky.fillStyle(0xffffff, .2 + Math.random() * .5); sky.fillRect(Math.random() * GAME_W, Math.random() * 170, 1, 1); }
      const layers = [['far', .08, 230], ['mid', .2, 270], ['near', .45, 330]].map(([lay, sp, hz]) => {
        const key = placeTex(this, i, pl.kind, lay, pal, hz);
        const ts = this.add.tileSprite(0, 0, GAME_W, GAME_H, key).setOrigin(0); C.add(ts);
        return { ts, sp };
      });
      const label = hkText(this, 14, 342, `📍 ${pl.name}`, 8, '#fff0d0', { bold: true }); C.add(label);
      return { C, layers };
    });
    this.placeI = 0;
    this.placeEv = this.time.addEvent({ delay: CREDIT_SEC * 1000 / PLACES.length, loop: true, callback: () => {
      const a = this.places[this.placeI], b = this.places[(this.placeI + 1) % this.places.length];
      if (!a || !b || this.phase !== 'credits') return;
      this.placeI = (this.placeI + 1) % this.places.length;
      b.C.setAlpha(0); this.children.bringToTop(b.C); this.children.bringToTop(this.roll); this.children.bringToTop(this.skipUi);
      this.tweens.add({ targets: b.C, alpha: 1, duration: 2200 });
      this.tweens.add({ targets: a.C, alpha: 0, duration: 2200, delay: 600 });
    } });
  }
  buildRoll() {
    const R = this.roll = this.add.container(0, GAME_H + 10).setDepth(5);
    let y = 0;
    for (const it of CREDITS) {
      const [kind, a, b] = it;
      if (kind === 'gap') { y += 18; continue; }
      if (kind === 'title') { R.add(this.add.text(320, y, a, pxt(14, '#ffd25a', { stroke: '#2a1a00', strokeThickness: 3 })).setOrigin(.5, 0).setScale(1.5)); y += 30; continue; }
      if (kind === 'sub') { R.add(hkText(this, 320, y, a, 9, '#fff0d0', { origin: [.5, 0] })); y += 18; continue; }
      if (kind === 'role') { R.add(hkText(this, 320, y, a, 7.5, '#c8b890', { origin: [.5, 0] })); y += 13; continue; }
      if (kind === 'name') { R.add(hkText(this, 320, y, a, 10, '#ffffff', { origin: [.5, 0], bold: true })); y += 18; continue; }
      if (kind === 'small') { R.add(hkText(this, 320, y, a, 7, '#a8a0b8', { origin: [.5, 0] })); y += 13; continue; }
      if (kind === 'parade') {   // 도트 행진: 한 줄에 6마리씩 걸어가며 위로
        R.add(hkText(this, 320, y, b, 8.5, '#ffd25a', { origin: [.5, 0], bold: true })); y += 22;
        const keys = a === 'allies' ? this.allies : this.bossKeys;
        keys.forEach((k, i) => {
          const col = i % 6, row = Math.floor(i / 6), x = 320 + (col - 2.5) * 62 + (row % 2) * 14, fy = y + row * 52 + 40;
          const spr = this.monSprite(k, x, fy, 40, 'Walk'); R.add(spr);
          this.tweens.add({ targets: spr, x: x + 10, duration: 1400 + (i % 4) * 160, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });   // 제자리에서 앞으로 · 뒤로 행진
        });
        y += Math.ceil(keys.length / 6) * 52 + 14;
        if (!keys.length) y += 10;
      }
    }
    this.rollH = y;
    this.rollV = (y + GAME_H + 40) / CREDIT_SEC;   // 픽셀/초
  }
  buildSkip() {
    const U = this.skipUi = this.add.container(0, 0).setDepth(10);
    const t = hkText(this, 626, 348, '[ ESC 키를 길게 눌러 스킵 가능 ]', 7, '#c8c0d8', { origin: [1, .5] }); U.add(t);
    const g = this.skipG = this.add.graphics(); U.add(g);
    const z = this.add.zone(626 - t.width, 340, t.width, 16).setOrigin(0).setInteractive(); U.add(z);
    z.on('pointerdown', () => { this.skipHeld = true; });
  }

  // ---------------- ⑥ The End ----------------
  theEnd() {
    if (this.phase === 'end') return;
    this.phase = 'end';
    if (this.placeEv) this.placeEv.remove();
    const cam = this.cameras.main;
    cam.fadeOut(1000, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.children.removeAll(true);
      const g = this.add.graphics();
      g.fillGradientStyle(0x05060f, 0x05060f, 0x3a1a3a, 0x3a1a3a, 1); g.fillRect(0, 0, GAME_W, 250);
      g.fillGradientStyle(0x3a1a3a, 0x3a1a3a, 0xff9a5a, 0xff9a5a, 1); g.fillRect(0, 250, GAME_W, 60);
      for (let k = 0; k < 60; k++) { g.fillStyle(0xffffff, .2 + Math.random() * .6); g.fillRect(Math.random() * GAME_W, Math.random() * 200, 1, 1); }
      const sun = this.add.image(320, 300, 'glow').setBlendMode(ADD).setTint(0xffc06a).setScale(5, 2.2).setAlpha(.7);
      this.tweens.add({ targets: sun, alpha: .9, scaleX: 5.4, duration: 3000, yoyo: true, repeat: -1 });
      const hill = this.add.graphics(); hill.fillStyle(0x0a0812, 1); hill.fillEllipse(320, 340, 760, 90); hill.fillRect(0, 330, GAME_W, 30);   // 언덕 (해 빛무리 앞)
      const ms = this.d.members;
      ms.forEach((m, i) => { const s = this.monSprite(m.visual, 250 + i * 70, 312, 46, 'Idle'); s.setTint(0x2a1a2a); });   // 새벽 언덕 위 실루엣
      const title = this.add.text(320, 96, 'The End', { fontFamily: FONT_TITLE, fontSize: '40px', color: '#ffe8b0', resolution: RES, stroke: '#3a1a00', strokeThickness: 4 }).setOrigin(.5).setAlpha(0).setScale(.9);
      this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 2200, ease: 'Sine.easeOut' });
      const sub = hkText(this, 320, 132, '포켓셀즈 — 유대의 이야기', 11, '#fff0d0', { origin: .5 }); sub.setAlpha(0);
      this.tweens.add({ targets: sub, alpha: 1, duration: 1600, delay: 1200 });
      const unlock = hkText(this, 320, 178, '🏆 함께한 포켓몬이 전당에 등록되었습니다 — 도감 카드에 금장 테두리\n💠 이제 전당등록 포켓몬과 2회차(New Game+)를 시작하면 보스 정수 하나를 쥐고 출발할 수 있습니다', 8.5, '#ffd25a', { origin: .5, style: { align: 'center', lineSpacing: 4 } });
      unlock.setAlpha(0); this.tweens.add({ targets: unlock, alpha: 1, duration: 1200, delay: 2600 });
      const press = hkText(this, 320, 230, '아무 키나 누르면 타이틀로', 7.5, HK.dim, { origin: .5 }); press.setAlpha(0);
      this.tweens.add({ targets: press, alpha: .8, duration: 800, delay: 4200, yoyo: true, repeat: -1 });
      this.endAt = this.time.now;
      this.time.delayedCall(20000, () => this.toTitle());
      cam.fadeIn(1400, 0, 0, 0);
    });
  }
  toTitle() {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main;
    Music.stop();
    cam.fadeOut(900, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => this.scene.start('Title', { skipPress: false }));
  }

  // ---------------- 입력 ----------------
  onKey(e) {
    Sfx.unlock();
    if (this.phase === 'hof') { if (this.ready) this.startCredits(); return; }
    if (this.phase === 'credits') { if (e.code === 'Escape') this.skipHeld = true; return; }
    if (this.phase === 'end' && this.time.now - (this.endAt || 0) > 3000) this.toTitle();
  }
  onTap() {
    if (this.phase === 'hof' && this.ready) this.startCredits();
    else if (this.phase === 'end' && this.time.now - (this.endAt || 0) > 3000) this.toTitle();
  }

  update(t, delta) {
    const dt = delta / 1000;
    if (this.phase !== 'credits' || !this.roll) return;
    this.roll.y -= this.rollV * dt;
    const cur = this.places && this.places[this.placeI];
    for (const pl of this.places || []) if (pl.C.alpha > 0) for (const l of pl.layers) l.ts.tilePositionX += l.sp * 60 * dt;
    void cur;
    // Esc 길게 누르기 (1.2초) → 건너뛰기
    this.skipT = this.skipHeld ? this.skipT + dt : Math.max(0, this.skipT - dt * 2);
    const g = this.skipG;
    if (g) { g.clear(); if (this.skipT > 0) { g.fillStyle(0xffd25a, .9); g.fillRect(626 - 150, 356, 150 * Math.min(1, this.skipT / 1.2), 2); } }
    if (this.skipT >= 1.2 || this.roll.y < -this.rollH - 20) this.theEnd();
  }
}

function shadeC(c, k) { const C = Phaser.Display.Color.ValueToColor(c); return Phaser.Display.Color.GetColor(Math.min(255, C.red * k), Math.min(255, C.green * k), Math.min(255, C.blue * k)); }
// 추억의 장소 실루엣 텍스처 (320 × 360 · 가로로 이어 붙는다)
function placeTex(s, i, kind, lay, pal, hz) {
  const key = `end:${i}:${lay}`;
  if (s.textures.exists(key)) return key;
  const W = 320, H = 360, t = s.textures.createCanvas(key, W, H), c = t.getContext();
  const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
  const base = lay === 'far' ? shadeC(pal.far ?? 0x202838, 1.1) : lay === 'mid' ? shadeC(pal.wall2 ?? pal.wall ?? 0x182028, .8) : shadeC(pal.wall2 ?? 0x101418, .45);
  c.fillStyle = hex(base);
  const ridge = (amp, freq, y0) => { c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 4) c.lineTo(x, y0 - Math.abs(Math.sin(x / W * Math.PI * freq + i)) * amp - Math.sin(x / 23 + i) * 4); c.lineTo(W, H); c.closePath(); c.fill(); };
  if (lay === 'far') ridge(kind === 'columns' ? 70 : 50, 2, hz);
  else if (lay === 'near') {
    c.fillRect(0, hz, W, H - hz);
    if (kind === 'forest') for (let x = 0; x < W; x += 18) { const h = 30 + (x * 7 % 23); c.beginPath(); c.moveTo(x, hz); c.lineTo(x + 9, hz - h); c.lineTo(x + 18, hz); c.fill(); }
    else for (let x = 0; x < W; x += 6) c.fillRect(x, hz - 2 - ((x * 13) % 5), 6, 4);
  } else {   // mid: 그 장소의 상징 건물
    ridge(16, 3, hz);
    const cx = 160;
    if (kind === 'forest') for (let x = 8; x < W; x += 26) { const h = 50 + (x * 11 % 30); c.beginPath(); c.moveTo(x, hz); c.lineTo(x + 13, hz - h); c.lineTo(x + 26, hz); c.fill(); }
    else if (kind === 'pagoda') { for (let k = 0; k < 6; k++) { const w = 70 - k * 10, y = hz - 18 - k * 22; c.fillRect(cx - w / 2, y, w, 16); c.fillRect(cx - w / 2 - 8, y + 14, w + 16, 4); } c.fillRect(cx - 2, hz - 170, 4, 30); }
    else if (kind === 'pillar') { c.fillRect(cx - 22, hz - 230, 44, 230); for (let k = 0; k < 8; k++) c.fillRect(cx - 28, hz - 30 - k * 28, 56, 5); c.globalAlpha = .35; c.fillStyle = '#e8f0ff'; for (let k = 0; k < 5; k++) c.fillRect(k * 70 - 20, 120 + k * 9, 90, 8); c.globalAlpha = 1; }
    else if (kind === 'columns') { for (const [x, h] of [[60, 120], [110, 80], [210, 130], [260, 60]]) { c.fillRect(x - 9, hz - h, 18, h); c.fillRect(x - 13, hz - h - 6, 26, 6); } }
    else if (kind === 'spiral') { for (let k = 0; k < 10; k++) { const w = 60 - k * 3, y = hz - 20 - k * 18; c.fillRect(cx - w / 2 + Math.sin(k) * 6, y, w, 14); } }
    else { for (const [x, h, w] of [[100, 110, 30], [160, 160, 40], [220, 120, 30]]) { c.fillRect(x - w / 2, hz - h, w, h); for (let k = 0; k < w; k += 8) c.fillRect(x - w / 2 + k, hz - h - 6, 4, 6); } }
  }
  t.refresh();
  return key;
}
