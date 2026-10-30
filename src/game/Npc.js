// 마을 사람들 (NPC): 절차적 도트 사람(20×36, 1배) — 오박사 · 연구원 · 마을 주민 · 간호순 …
//  눈을 깜빡이고 숨 쉬듯 들썩이며, 플레이어가 다가오면 그쪽을 돌아보고 머리 위에 말풍선이 뜬다.
//  F / ↑ 로 말을 걸면 GameScene.talkTo → UIScene 대화창. 대사는 data/npcs.js (지방을 정화하면 pure 대사)
import { TILE } from '../config.js';
import { css, shade } from '../systems/Textures.js';
import { NPCS } from '../data/npcs.js';

const NW = 20, NH = 36;
const SKIN = 0xf0d0b0, SKIN_D = 0xd4ac8c, INK = 0x1a1622, COAT = 0xf2efe6, COAT_D = 0xc4c0b4;

// 몸 치수 (아래에서 위로): 신발 2 · 다리 · 몸통 · 목 1 · 머리
const BODY = { adult: { leg: 7, torso: 12, head: 11 }, kid: { leg: 5, torso: 8, head: 10 }, old: { leg: 6, torso: 11, head: 11 } };

// 사람 하나를 그린다 (왼쪽을 보는 3/4 모습). o: 색과 모양 · blink: 눈 감은 장면
function person(F, o, blink) {
  const b = BODY[o.body || 'adult'], feet = NH - 1;
  const shoeY = feet - 1, legY = shoeY - b.leg, torY = legY - b.torso, neckY = torY - 1, headY = neckY - b.head;
  const cx = 10;   // 몸 가운데
  // 등 뒤 (배낭 · 뒷머리)
  if (o.pack) { F(cx + 3, torY + 1, 5, b.torso - 2, o.pack); F(cx + 4, torY + 2, 3, 2, shade(o.pack, 1.25)); F(cx + 3, torY + b.torso - 3, 5, 1, shade(o.pack, .7)); }
  if (o.longHair) { F(cx - 3, headY + 4, 9, b.head + 3, shade(o.hair, .8)); }
  if (o.tail) { F(cx + 4, headY + 4, 3, 9, o.hair); F(cx + 5, headY + 12, 2, 3, shade(o.hair, .75)); }
  // 다리 · 신발
  if (o.skirt) {
    F(cx - 4, legY - 1, 9, Math.ceil(b.leg * .7), o.skirt); F(cx - 5, legY + Math.ceil(b.leg * .7) - 2, 11, 2, o.skirt); F(cx + 3, legY - 1, 2, Math.ceil(b.leg * .7) + 1, shade(o.skirt, .78));
    F(cx - 2, legY + Math.ceil(b.leg * .7), 2, b.leg - Math.ceil(b.leg * .7), o.legs || SKIN); F(cx + 1, legY + Math.ceil(b.leg * .7), 2, b.leg - Math.ceil(b.leg * .7), o.legs || SKIN_D);
  } else {
    F(cx - 4, legY, 3, b.leg, o.pants); F(cx, legY, 3, b.leg, shade(o.pants, .82));
    if (o.shorts) { F(cx - 4, legY + 3, 3, b.leg - 3, SKIN); F(cx, legY + 3, 3, b.leg - 3, SKIN_D); }
  }
  F(cx - 5, shoeY, 4, 2, o.shoes); F(cx, shoeY, 4, 2, shade(o.shoes, .8)); F(cx - 5, shoeY, 1, 1, shade(o.shoes, 1.3));
  // 몸통 (윗옷) · 가운
  F(cx - 4, torY, 9, b.torso, o.shirt); F(cx + 3, torY, 2, b.torso, shade(o.shirt, .8));
  if (o.coat) {
    F(cx - 5, torY, 3, b.torso + 4, o.coat); F(cx + 2, torY, 4, b.torso + 4, shade(o.coat, .9)); F(cx + 4, torY + 1, 2, b.torso + 3, o.coatD || COAT_D);
    F(cx - 2, torY + b.torso, 4, 4, o.coat);   // 가운 자락 (다리 앞)
    F(cx - 2, torY, 1, 4, o.coatD || COAT_D); F(cx + 1, torY, 1, 4, o.coatD || COAT_D);   // 깃
    F(cx - 4, torY + 7, 2, 2, o.coatD || COAT_D);   // 주머니
  }
  if (o.apron) { F(cx - 2, torY + 3, 5, b.torso + 2, o.apron); F(cx - 1, torY + 3, 3, 1, shade(o.apron, .85)); }
  if (o.obi) { F(cx - 4, torY + 5, 9, 3, o.obi); F(cx - 4, torY + 5, 9, 1, shade(o.obi, 1.2)); F(cx - 1, torY, 3, 3, 0xf4f0e8); }
  if (o.shawl) { F(cx - 5, torY, 11, 4, o.shawl); F(cx - 4, torY + 4, 3, 2, o.shawl); F(cx - 5, torY + 3, 11, 1, shade(o.shawl, .75)); }
  // 팔 (앞팔 = 왼쪽) · 손
  const sleeve = o.coat || o.sleeve || o.shirt, arm = Math.min(b.torso - 2, 9);
  F(cx - 6, torY + 1, 2, arm, sleeve); F(cx - 6, torY + 1 + arm, 2, 2, SKIN);
  F(cx + 5, torY + 1, 2, arm, shade(sleeve, .82)); F(cx + 5, torY + 1 + arm, 2, 2, SKIN_D);
  if (o.cane) { F(cx - 8, torY + arm, 1, feet - torY - arm + 1, 0x6a4a2a); F(cx - 8, torY + arm - 1, 2, 1, 0x8a6a3a); }
  if (o.board) { F(cx - 9, torY + arm - 4, 4, 6, 0x8a6038); F(cx - 8, torY + arm - 3, 2, 4, 0xf0ece0); }
  // 목 · 얼굴
  F(cx - 1, neckY, 3, 1, SKIN_D);
  F(cx - 4, headY + 2, 9, b.head - 3, SKIN); F(cx - 3, headY + b.head - 1, 7, 1, SKIN); F(cx + 3, headY + 3, 2, b.head - 5, SKIN_D);
  F(cx + 4, headY + 5, 1, 2, SKIN_D);   // 귀
  const eyeY = headY + Math.round(b.head * .5);
  if (blink) { F(cx - 3, eyeY + 1, 2, 1, INK); F(cx + 1, eyeY + 1, 2, 1, INK); }
  else { F(cx - 3, eyeY, 1, 2, INK); F(cx + 1, eyeY, 1, 2, INK); F(cx - 2, eyeY, 1, 1, 0xffffff, .6); }
  F(cx - 2, eyeY + 3, 2, 1, 0xc0786a);   // 입
  if (o.old) { F(cx - 4, eyeY + 2, 1, 1, SKIN_D); F(cx + 2, eyeY - 1, 2, 1, SKIN_D); }
  if (o.beard) { F(cx - 4, eyeY + 2, 9, b.head - (eyeY - headY) - 2, o.beard); F(cx - 3, eyeY + 3, 3, 1, 0xc0786a); }
  if (o.glasses) { F(cx - 4, eyeY - 1, 3, 3, o.glasses, .9); F(cx, eyeY - 1, 3, 3, o.glasses, .9); F(cx - 3, eyeY, 1, 1, 0xd8f0ff); F(cx + 1, eyeY, 1, 1, 0xd8f0ff); F(cx - 1, eyeY, 1, 1, o.glasses); }
  // 머리카락 · 모자
  const h = o.hair, hd = shade(h, .72), hl = shade(h, 1.25);
  switch (o.hairStyle) {
    case 'swept':   // 오박사: 뒤로 넘긴 은발 + 구레나룻
      F(cx - 4, headY, 9, 3, h); F(cx - 3, headY - 1, 7, 1, hl); F(cx + 3, headY + 2, 2, 5, hd); F(cx - 4, headY + 2, 1, 3, h); F(cx - 2, headY, 4, 1, hl); break;
    case 'short':
      F(cx - 4, headY, 9, 3, h); F(cx - 5, headY + 1, 2, 4, h); F(cx + 3, headY + 1, 2, 5, hd); F(cx - 3, headY - 1, 6, 1, hl); F(cx - 4, headY + 3, 3, 1, h); break;
    case 'messy':
      F(cx - 5, headY - 1, 10, 4, h); F(cx - 6, headY, 2, 2, h); F(cx + 4, headY, 2, 6, hd); F(cx - 4, headY + 3, 2, 1, h); F(cx - 1, headY - 2, 2, 1, hl); F(cx + 2, headY - 2, 2, 1, h); break;
    case 'long':
      F(cx - 5, headY, 10, 4, h); F(cx - 5, headY + 3, 2, b.head - 1, h); F(cx + 3, headY + 2, 3, b.head + 1, hd); F(cx - 3, headY - 1, 6, 1, hl); F(cx - 3, headY + 3, 3, 1, h); break;
    case 'bun':
      F(cx - 4, headY, 9, 3, h); F(cx - 1, headY - 3, 5, 3, h); F(cx, headY - 3, 2, 1, hl); F(cx + 3, headY + 2, 2, 3, hd); F(cx - 5, headY + 1, 2, 3, h);
      if (o.pin) { F(cx + 3, headY - 3, 1, 3, o.pin); F(cx + 2, headY - 4, 3, 1, o.pin); }
      break;
    case 'nurse':   // 간호순: 분홍 고리 머리 + 하얀 간호모
      F(cx - 4, headY, 9, 3, h); F(cx - 7, headY + 4, 3, 7, h); F(cx - 7, headY + 5, 1, 5, hl); F(cx + 5, headY + 4, 3, 7, hd);
      F(cx - 3, headY - 2, 7, 2, 0xf8f6f0); F(cx, headY - 2, 1, 2, 0xe0303a); F(cx - 1, headY - 1, 3, 1, 0xe0303a); break;
  }
  if (o.cap) { F(cx - 5, headY - 1, 10, 3, o.cap); F(cx - 8, headY + 2, 6, 1, shade(o.cap, .78)); F(cx - 2, headY - 1, 3, 1, 0xf4f0e8); }
  if (o.beanie) { F(cx - 5, headY - 2, 10, 4, o.beanie); F(cx - 5, headY + 1, 10, 1, shade(o.beanie, .75)); }
}

// 겉모습 (tint: 그 사람만의 옷 색)
const LOOKS = {
  oak: t => ({ hair: 0xc4c0b8, hairStyle: 'swept', old: true, coat: COAT, shirt: 0x8a2a2a, pants: 0x8a7a58, shoes: 0x4a3020 }),
  aide: t => ({ hair: 0x2a2630, hairStyle: 'short', glasses: 0x3a3a4a, coat: COAT, shirt: t || 0x3a5a8a, pants: 0x2a2a3a, shoes: 0x1a1a22, board: true }),
  aide2: t => ({ hair: 0x6a3a22, hairStyle: 'short', tail: true, coat: COAT, shirt: t || 0x2a8a8a, pants: 0x2a3050, shoes: 0x2a1a1a }),
  scientist: t => ({ hair: 0x7a4a2a, hairStyle: 'messy', glasses: 0x4a4a5a, coat: COAT, shirt: t || 0x4a7a3a, pants: 0x5a4a3a, shoes: 0x3a2a1a }),
  mom: t => ({ hair: 0x4a2a1a, hairStyle: 'long', longHair: true, shirt: t || 0x6a9a5a, skirt: 0x3a4a6a, apron: 0xf0ece0, shoes: 0x6a3a2a }),
  boy: t => ({ body: 'kid', hair: 0x2a1a14, hairStyle: 'short', cap: 0xd83a3a, shirt: t || 0x3a6ad8, pants: 0x3a4a7a, shorts: true, shoes: 0xd84a3a }),
  girl: t => ({ body: 'kid', hair: 0x5a2a1a, hairStyle: 'long', longHair: true, shirt: t || 0xd85a8a, skirt: shade(t || 0xd85a8a, .8), shoes: 0x8a2a3a }),
  granny: t => ({ body: 'old', hair: 0xd0ccc8, hairStyle: 'bun', old: true, shawl: t || 0x7a5a8a, shirt: 0x6a5a4a, skirt: 0x4a3a3a, shoes: 0x3a2a2a, cane: true }),
  man: t => ({ hair: 0x3a2a1a, hairStyle: 'short', shirt: t || 0x4a5a3a, pants: 0x3a3a48, shoes: 0x2a2020 }),
  hiker: t => ({ hair: 0x4a2a1a, hairStyle: 'short', beard: 0x5a3a24, beanie: t || 0xa83a2a, shirt: 0x8a5a2a, pants: 0x4a4a38, shoes: 0x3a2a1a, pack: 0x6a4a2a }),
  nurse: t => ({ hair: 0xf08aa8, hairStyle: 'nurse', shirt: 0xf8b8c8, skirt: 0xf8b8c8, apron: 0xfaf8f4, shoes: 0xf4f0ec, legs: 0xf8e8e0 }),
  kimono: t => ({ hair: 0x1a1418, hairStyle: 'bun', pin: 0xe8c060, shirt: t || 0xc83a5a, skirt: t || 0xc83a5a, obi: 0xe8c060, shoes: 0x8a2a2a, legs: 0xf4f0e8 })
};

// 1px 어두운 테두리 (어두운 배경에서도 또렷하게)
function outline(c) {
  const img = c.getImageData(0, 0, NW, NH), d = img.data, out = new Uint8ClampedArray(d);
  const A = (x, y) => x >= 0 && y >= 0 && x < NW && y < NH && d[(y * NW + x) * 4 + 3] > 0;
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
    if (A(x, y) || !(A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1))) continue;
    const k = (y * NW + x) * 4; out[k] = 0x14; out[k + 1] = 0x10; out[k + 2] = 0x1c; out[k + 3] = 235;
  }
  img.data.set(out); c.putImageData(img, 0, 0);
}

// 텍스처: npc:<모습>:<옷색>:open|blink
export function npcArt(scene, look, tint) {
  const base = `npc:${look}:${tint || 0}`;
  if (scene.textures.exists(base + ':open')) return base;
  const o = (LOOKS[look] || LOOKS.man)(tint);
  for (const blink of [false, true]) {
    const t = scene.textures.createCanvas(`${base}:${blink ? 'blink' : 'open'}`, NW, NH), c = t.getContext();
    const F = (x, y, w, h, col, a = 1) => { if (w <= 0 || h <= 0) return; c.globalAlpha = a; c.fillStyle = css(col); c.fillRect(x, y, w, h); c.globalAlpha = 1; };
    person(F, o, blink);
    outline(c);
    t.refresh();
  }
  return base;
}

// 말풍선 (점 세 개)
function bubbleArt(scene) {
  const key = 'npc:bubble';
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, 13, 11), c = t.getContext();
  const F = (x, y, w, h, col) => { c.fillStyle = css(col); c.fillRect(x, y, w, h); };
  F(1, 0, 11, 1, 0x1a1622); F(0, 1, 13, 7, 0x1a1622); F(1, 8, 11, 1, 0x1a1622); F(3, 9, 3, 1, 0x1a1622); F(3, 10, 1, 1, 0x1a1622);
  F(1, 1, 11, 7, 0xfaf6ea); F(4, 8, 1, 1, 0xfaf6ea);
  for (const x of [3, 6, 9]) F(x, 4, 1, 1, 0x4a4458);
  t.refresh();
  return key;
}

export class Npcs {
  constructor(scene, level, props) {
    this.s = scene; this.list = [];
    const bub = bubbleArt(scene);
    for (const n of level.npcs || []) {
      const def = NPCS[n.id];
      if (!def) continue;
      const key = npcArt(scene, def.look, def.tint), X = n.x * TILE + 8, Y = n.g * TILE;
      const shadow = scene.add.ellipse(X, Y, 14, 3, 0x000000, .35).setDepth(7.7);
      const spr = scene.add.image(X, Y + 1, key + ':open').setOrigin(.5, 1).setDepth(7.8).setFlipX(n.face > 0);
      const bubble = scene.add.image(X + 6, Y - NH - 4, bub).setOrigin(.5, 1).setDepth(7.85).setAlpha(0);
      const it = { kind: 'npc', npc: def, id: n.id, x: X, y: Y, range: 26, used: false, repeat: true, prompt: '[F 또는 ↑ : 대화]', promptY: Y - NH - 14 };
      const o = { def, key, X, Y, spr, shadow, bubble, it, face: n.face, blinkT: 1 + Math.random() * 3, blinkOn: 0, ph: Math.random() * 6, hop: 0 };
      it.ref = o;
      props.interacts.push(it);
      this.list.push(o);
    }
  }

  // 말을 걸면: 그쪽을 돌아보고 깡총
  greet(it, px) {
    const o = it.ref;
    if (!o) return;
    o.spr.setFlipX(px > o.X); o.hop = .25;
  }

  update(dt, p) {
    const t = this.s.time.now / 1000;
    for (const o of this.list) {
      const dx = p.x - o.X, near = Math.abs(dx) < 90 && Math.abs(p.bottom - o.Y) < 48;
      if (near && Math.abs(dx) > 4) o.spr.setFlipX(dx > 0);   // 다가오면 돌아본다
      else if (!near) o.spr.setFlipX(o.face > 0);
      // 눈 깜빡임
      if (o.blinkOn > 0) { o.blinkOn -= dt; if (o.blinkOn <= 0) o.spr.setTexture(o.key + ':open'); }
      else if ((o.blinkT -= dt) <= 0) { o.blinkT = 2 + Math.random() * 3.5; o.blinkOn = .12; o.spr.setTexture(o.key + ':blink'); }
      // 숨쉬기 (1px 들썩) · 말 걸면 깡총
      if (o.hop > 0) o.hop = Math.max(0, o.hop - dt);
      const breathe = Math.sin(t * 2.1 + o.ph) > .55 ? -1 : 0, hop = o.hop > 0 ? -Math.round(Math.sin((1 - o.hop / .25) * Math.PI) * 3) : 0;
      o.spr.y = o.Y + 1 + breathe + hop;
      const close = Math.abs(dx) < 46 && Math.abs(p.bottom - o.Y) < 40;
      o.bubble.setAlpha(Math.max(0, Math.min(1, o.bubble.alpha + (close ? dt * 4 : -dt * 4)))).setY(o.Y - NH - 3 + Math.sin(t * 3 + o.ph) * 1.2).setX(o.spr.flipX ? o.X - 6 : o.X + 6);
    }
  }

  destroy() {
    for (const o of this.list) { o.spr.destroy(); o.shadow.destroy(); o.bubble.destroy(); }
    this.list = [];
  }
}
