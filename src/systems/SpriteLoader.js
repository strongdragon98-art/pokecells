// PMDCollab SpriteCollab 시트 로더
// 시트는 8방향(행) × 프레임(열) 구성이다. 행 순서: 0 아래, 1 오른아래, 2 오른쪽, 3 오른위, 4 위, 5 왼위, 6 왼쪽, 7 왼아래.
// 횡스크롤에서는 2행(오른쪽)과 6행(왼쪽)만 잘라 '{key}:{Anim}:{right|left}' 애니메이션으로 등록한다.
// 스마트 폴백: 로스터(data/roster.js)의 포켓몬 중 모션 시트를 아직 받지 않은 모습은
//  PokeAPI 기본 도트를 실행 중에 바로 불러와 한 장짜리 좌/우 시트로 만들고, Actor 가 절차 애니메이션을 입힌다
// 지연 로딩 (아이폰 첫 접속 크래시 방지): 예전엔 부팅 때 167종의 시트 759장(압축을 풀면 약 774MB)을 한꺼번에 올려 WebKit 이 튕겼다.
//  이제 부팅 때는 미리 계산한 메타(assets/spritemeta.json · scripts/make-sprite-meta.js) 하나만 받고,
//  시트는 그 포켓몬이 필요할 때 받는다 — 씬 preload 에서 Sprites.queue(이 씬에 나올 포켓몬) · 실행 중엔 Sprites.ensure / Actor 가 알아서 요청
//  배포본 시트는 오른쪽·왼쪽 2행만 남겨 잘라 둔다 (scripts/crop-dist-sprites.js) → 한 장의 메모리가 1/4
import { LINES } from '../data/roster.js';
import { WILD } from '../data/pokemon.js';

export const ANIMS = ['Idle', 'Walk', 'Attack', 'Strike', 'Shoot', 'Hurt'];
const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
// 로스터의 모든 모습·메가 → PokeAPI 번호
const ROSTER_ART = (() => {
  const out = {};
  for (const l of LINES) {
    for (const f of l.forms) out[f.key] = f.dex;
    for (const m of l.megas || []) out[m.key] = m.pokeapi;
  }
  return out;
})();
const FALLBACK = {
  Idle: ['Walk'], Walk: ['Idle'], Attack: ['Strike', 'Shoot', 'Walk'], Strike: ['Attack', 'Shoot', 'Walk'],
  Shoot: ['Attack', 'Strike', 'Walk'], Hurt: ['Idle', 'Walk']
};
const ROW = { right: 2, left: 6 };
const LOOP = new Set(['Idle', 'Walk']);
// 원본 시트(8행)는 2·6행, 단일 HTML 빌드에서 좌우만 잘라 낸 시트(2행)는 0·1행
const rowFor = (rows, dir) => rows >= 8 ? ROW[dir] : rows === 2 ? (dir === 'right' ? 0 : 1) : 0;

// AnimData.xml → { Walk: { fw, fh, durations[], hit, rush, source }, ... }  (CopyOf 는 원본으로 해석)
export function parseAnimData(xmlDoc) {
  const out = {};
  for (const a of Array.from(xmlDoc.getElementsByTagName('Anim'))) {
    const get = t => { const el = a.getElementsByTagName(t)[0]; return el ? el.textContent.trim() : null; };
    const name = get('Name');
    if (!name) continue;
    out[name] = {
      name,
      copyOf: get('CopyOf'),
      fw: parseInt(get('FrameWidth') || '0', 10),
      fh: parseInt(get('FrameHeight') || '0', 10),
      durations: Array.from(a.getElementsByTagName('Duration')).map(d => parseInt(d.textContent, 10) || 1),
      hit: get('HitFrame') !== null ? parseInt(get('HitFrame'), 10) : -1,
      rush: get('RushFrame') !== null ? parseInt(get('RushFrame'), 10) : -1
    };
  }
  for (const k of Object.keys(out)) {
    const a = out[k];
    if (a.copyOf && out[a.copyOf]) out[k] = { ...out[a.copyOf], name: k, source: out[a.copyOf].name };
    else a.source = k;
  }
  return out;
}

export class SpriteLoader {
  constructor(scene) {
    this.scene = scene;
    this.manifest = null;
    this.data = {};   // key → parsed AnimData
    this.meta = {};   // key → { anims: {Idle:{fw,fh,oy,ms,hitMs}}, bodyW, bodyH, height, hasSprite }
    this.game = scene.game;
    this.lazy = {};          // key → spritemeta.json 항목 { anims, files, measured } (시트를 아직 안 받았을 수 있다)
    this.ready = new Set();  // 시트를 받아 애니메이션까지 만든 포켓몬
    this.waits = new Map();  // key → 받는 중인 Promise
    this.busy = 0; this.queueImg = [];   // 동시에 받는 그림 수 제한 (휴대폰 네트워크·디코딩 몰림 방지)
    LOADER = this;
  }

  // 1단계: manifest → 2단계: AnimData.xml/초상화/아이콘 → 3단계: 실제 프레임 크기로 시트 로드
  preload() {
    const load = this.scene.load;
    load.json('manifest', `assets/manifest.json?v=${__BUILD_ID__}`);   // 배포할 때마다 새로 받는다 (vite.config.js 의 define)
    load.json('spritemeta', `assets/spritemeta.json?v=${__BUILD_ID__}`);   // 모든 포켓몬의 모션 정보·몸 크기 (시트는 나중에)
    load.once('filecomplete-json-manifest', (key, type, data) => this.queueManifest(data));
  }

  queueManifest(manifest) {
    this.manifest = manifest;
    const load = this.scene.load;
    for (const [id, file] of Object.entries(manifest.icons || {})) load.text(`svg:${id}`, `assets/${file}`);   // 스킬 아이콘
    for (const [id, file] of Object.entries(manifest.items || {})) load.image(`itm:${id}`, `assets/${file}`);   // 가방 아이템 그림 (본가 아이콘)
    for (const [key, e] of Object.entries(manifest.pokemon)) {
      if (e.portrait) load.image(`portrait:${key}`, `assets/${e.portrait}`);
      if (e.icon) load.image(`icon:${key}`, `assets/${e.icon}`);
    }
    // 아직 받지 않은 로스터 포켓몬: PokeAPI 도트를 바로 불러온다 (실패하면 건너뛰고, 고를 때 빈 칸 대신 실루엣)
    load.setCORS('anonymous');
    for (const [key, id] of Object.entries(ROSTER_ART)) {
      const e = manifest.pokemon[key];
      if (id && !(e && e.icon)) load.image(`icon:${key}`, `${POKEAPI}/${id}.png`);
    }
  }

  // 단일 HTML 빌드: 파일 안에 담긴 manifest·XML·이미지(data URI)를 네트워크 없이 텍스처로 등록
  async loadEmbedded(embed) {
    this.manifest = embed.manifest;
    const tex = this.scene.textures;
    const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
    const jobs = [];
    for (const [id, file] of Object.entries(this.manifest.items || {})) if (embed.img[file]) jobs.push(loadImg(embed.img[file]).then(im => tex.addImage(`itm:${id}`, im)));
    for (const [key, e] of Object.entries(this.manifest.pokemon)) {
      if (e.portrait && embed.img[e.portrait]) jobs.push(loadImg(embed.img[e.portrait]).then(im => tex.addImage(`portrait:${key}`, im)));
      if (e.icon && embed.img[e.icon]) jobs.push(loadImg(embed.img[e.icon]).then(im => tex.addImage(`icon:${key}`, im)));
      if (!e.animData || !embed.xml[key]) continue;
      const parsed = parseAnimData(new DOMParser().parseFromString(embed.xml[key], 'text/xml'));
      this.data[key] = parsed;
      const queued = new Set();
      for (const anim of ANIMS) {
        const d = parsed[anim];
        if (!d || !d.fw) continue;
        const file = e.anims[d.source] || e.anims[anim];
        if (!file || queued.has(d.source) || !embed.img[file]) continue;
        queued.add(d.source);
        jobs.push(loadImg(embed.img[file]).then(im => tex.addSpriteSheet(`sheet:${key}:${d.source}`, im, { frameWidth: d.fw, frameHeight: d.fh })));
      }
    }
    await Promise.all(jobs);
  }

  // 스킬 아이콘 SVG 글: 단일 HTML 은 파일 안에서, 개발 서버는 불러온 text 캐시에서
  skillSvgs(embed) {
    if (embed) return embed.svg || {};
    const out = {};
    for (const id of Object.keys(this.manifest?.icons || {})) { const t = this.scene.cache.text.get(`svg:${id}`); if (t) out[id] = t; }
    return out;
  }

  // 로드가 끝난 뒤 호출: 좌/우 행만 잘라 애니메이션 등록 + 발 위치/몸통 크기 측정
  registerAll() {
    const pre = this.scene.cache.json.get('spritemeta');
    if (pre) for (const [key, e] of Object.entries(pre)) { this.lazy[key] = e; this.data[key] = e.anims; this.meta[key] = this.metaOf(key, e.measured); }
    for (const key of Object.keys(this.manifest?.pokemon || {})) if (!this.lazy[key]) { this.register(key); this.ready.add(key); }   // 단일 HTML 빌드: 이미 다 불러왔다
    // 모션 시트가 없는 로스터 포켓몬은 아이콘 도트로 대신
    for (const key of Object.keys(ROSTER_ART)) {
      if (this.meta[key] && this.meta[key].hasSprite) continue;
      if (!this.buildFallback(key)) continue;
      this.register(key);
      this.meta[key].procedural = true;
    }
    return this.meta;
  }

  // 아이콘 도트 한 장 → 투명 여백을 잘라 낸 2행 시트 (0행 오른쪽 = 좌우 반전, 1행 왼쪽 = 원본: PokeAPI 정면 도트는 왼쪽을 본다)
  //  rowFor(rows=2) 가 그대로 읽으므로 register·measure 를 바꿀 필요가 없다
  buildFallback(key) {
    const tex = this.scene.textures, src = `icon:${key}`;
    if (!tex.exists(src)) return false;
    const img = tex.get(src).getSourceImage();
    if (!img || !img.width) return false;
    const W = img.width, H = img.height, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    let px;
    try { px = c.getImageData(0, 0, W, H).data; } catch (e) { return false; }   // CORS 로 막히면 쓰지 않는다
    let minX = W, maxX = -1, minY = H, maxY = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 40) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (maxX < 0) return false;
    const w = maxX - minX + 1, h = maxY - minY + 1, fw = w + 4 + (w % 2), fh = (h + 4) * 2;   // 몸 중심이 프레임 가운데, 발이 아래쪽 1/4
    const sheet = tex.createCanvas(`sheet:${key}:Idle`, fw, fh * 2), sc = sheet.getContext();
    sc.imageSmoothingEnabled = false;
    const ox = (fw - w) / 2, oy = fh / 2 - h + 2;   // 발바닥을 프레임 중앙 아래로
    sc.save(); sc.translate(fw, 0); sc.scale(-1, 1); sc.drawImage(img, minX, minY, w, h, ox, oy, w, h); sc.restore();
    sc.drawImage(img, minX, minY, w, h, ox, fh + oy, w, h);
    sheet.refresh();
    tex.get(`sheet:${key}:Idle`).add(0, 0, 0, 0, fw, fh); tex.get(`sheet:${key}:Idle`).add(1, 0, 0, fh, fw, fh);
    const d = { fw, fh, durations: [30], hit: -1, rush: -1, source: 'Idle' };
    this.data[key] = Object.fromEntries(ANIMS.map(a => [a, { ...d, name: a }]));
    return true;
  }

  // ---------------- 지연 로딩 ----------------
  // 미리 잰 값(measured)과 모션 정보만으로 메타를 만든다 — 시트 없이도 몸 크기·발 위치·모션 길이를 안다
  metaOf(key, measured) {
    const meta = { key, anims: {}, bodyW: 14, bodyH: 18, height: 22, hasSprite: false };
    for (const anim of ANIMS) {
      const d = this.data[key][anim];
      if (!d) continue;
      const durs = d.durations, total = durs.reduce((s, v) => s + v, 0) * 1000 / 60;
      const hitIdx = d.hit >= 0 ? d.hit : Math.floor(durs.length / 2);
      meta.anims[anim] = { fw: d.fw, fh: d.fh, oy: (d.fh / 2 + measured.foot) / d.fh, ms: total, hitMs: durs.slice(0, hitIdx).reduce((s, v) => s + v, 0) * 1000 / 60, src: d.source };
      meta.hasSprite = true;
    }
    meta.bodyW = Math.max(8, Math.min(44, Math.round(measured.w * .62)));
    meta.bodyH = Math.max(10, Math.min(64, Math.round(measured.h * .8)));
    meta.height = measured.h;
    meta.eye = measured.eye;
    return meta;
  }

  // 받은 시트로 좌/우 애니메이션 등록 (원본 8행 · 잘라 낸 2행 모두)
  createAnims(key) {
    const data = this.data[key], tm = this.game.textures, am = this.game.anims;
    if (!data) return;
    for (const anim of ANIMS) {
      const d = data[anim], tex = d && `sheet:${key}:${d.source}`;
      if (!d || !tm.exists(tex)) continue;
      const img = tm.get(tex).getSourceImage();
      const cols = Math.max(1, Math.floor(img.width / d.fw)), rows = Math.max(1, Math.floor(img.height / d.fh));
      const durs = d.durations.slice(0, cols);
      for (const dir of ['right', 'left']) {
        const row = rowFor(rows, dir), animKey = `${key}:${anim}:${dir}`;
        if (am.exists(animKey)) continue;
        am.create({ key: animKey, frames: durs.map((dur, i) => ({ key: tex, frame: row * cols + i, duration: Math.max(1, dur * 1000 / 60 - 1) })), frameRate: 1000, repeat: LOOP.has(anim) ? -1 : 0 });
      }
    }
    this.ready.add(key);
  }

  // 받을 시트 목록 [{ tk: 텍스처 키, url, fw, fh }] (이미 있는 시트는 뺀다)
  sheetsOf(key) {
    const e = this.lazy[key], tm = this.game.textures, out = [], seen = new Set();
    if (!e) return out;
    for (const d of Object.values(e.anims)) {
      const tk = `sheet:${key}:${d.source}`, file = e.files[d.source];
      if (!file || seen.has(tk) || tm.exists(tk)) continue;
      seen.add(tk);
      out.push({ tk, url: `assets/${file}`, fw: d.fw, fh: d.fh });
    }
    return out;
  }

  // 씬 preload 에서: 이 씬에 나올 포켓몬 시트를 Phaser 로더에 올린다 (씬은 다 받은 뒤 create)
  queue(load, keys) {
    for (const key of expandKeys(keys)) {
      if (this.ready.has(key) || !this.lazy[key] || this.waits.has(key)) continue;
      const files = this.sheetsOf(key);
      if (!files.length) { this.createAnims(key); continue; }
      let left = files.length;
      const done = () => { if (--left === 0) this.createAnims(key); };
      for (const s of files) {
        load.spritesheet(s.tk, s.url, { frameWidth: s.fw, frameHeight: s.fh });
        load.once(`filecomplete-spritesheet-${s.tk}`, done);
      }
      load.on('loaderror', f => { if (files.some(s => s.tk === f.key)) done(); });
    }
  }

  // 실행 중에: 시트를 받아 애니메이션까지 만든 뒤 끝나는 Promise (같은 포켓몬을 두 번 받지 않는다)
  ensure(keys) {
    return Promise.all(expandKeys(keys).map(key => {
      if (this.ready.has(key) || !this.lazy[key]) return null;
      if (this.waits.has(key)) return this.waits.get(key);
      const tm = this.game.textures;
      const p = Promise.all(this.sheetsOf(key).map(s => this.loadImage(s.url).then(img => {
        if (!tm.exists(s.tk)) tm.addSpriteSheet(s.tk, img, { frameWidth: s.fw, frameHeight: s.fh });
      }).catch(err => console.warn('[sprite] 불러오기 실패', s.url, err)))).then(() => { this.waits.delete(key); this.createAnims(key); });
      this.waits.set(key, p);
      return p;
    }));
  }

  // 지금 필요 없는 시트를 메모리에서 내린다 (챕터를 옮길 때 — 아이폰은 탭 메모리가 빠듯하다). 다시 필요하면 ensure 가 다시 받는다
  trim(keep) {
    const want = new Set(expandKeys(keep)), tm = this.game.textures, am = this.game.anims;
    let n = 0;
    for (const key of [...this.ready]) {
      if (want.has(key) || !this.lazy[key] || this.waits.has(key)) continue;
      for (const anim of ANIMS) for (const dir of ['right', 'left']) if (am.exists(`${key}:${anim}:${dir}`)) am.remove(`${key}:${anim}:${dir}`);
      for (const d of Object.values(this.data[key])) { const tk = `sheet:${key}:${d.source}`; if (tm.exists(tk)) tm.remove(tk); }
      this.ready.delete(key); n++;
    }
    return n;
  }

  loadImage(url) {
    return new Promise((res, rej) => {
      const run = () => {
        this.busy++;
        const im = new Image(), fin = () => { this.busy--; const nx = this.queueImg.shift(); if (nx) nx(); };
        im.onload = () => { fin(); res(im); };
        im.onerror = e => { fin(); rej(e); };
        im.src = url;
      };
      if (this.busy < 6) run(); else this.queueImg.push(run);
    });
  }

  resolve(key, anim) {
    const data = this.data[key] || {};
    for (const c of [anim, ...(FALLBACK[anim] || [])]) {
      const d = data[c];
      if (d && d.fw && this.scene.textures.exists(`sheet:${key}:${d.source}`)) return { d, tex: `sheet:${key}:${d.source}` };
    }
    return null;
  }

  register(key) {
    const scene = this.scene;
    const meta = { key, anims: {}, bodyW: 14, bodyH: 18, height: 22, hasSprite: false };
    const measured = this.measure(key);
    for (const anim of ANIMS) {
      const r = this.resolve(key, anim);
      if (!r) continue;
      const { d, tex } = r;
      const img = scene.textures.get(tex).getSourceImage();
      const cols = Math.max(1, Math.floor(img.width / d.fw));
      const rows = Math.max(1, Math.floor(img.height / d.fh));
      const durs = d.durations.slice(0, cols);
      for (const dir of ['right', 'left']) {
        const row = rowFor(rows, dir);
        const animKey = `${key}:${anim}:${dir}`;
        if (scene.anims.exists(animKey)) continue;
        // frameRate 1000 = 기본 1ms/프레임, 나머지는 프레임별 duration(추가 ms)으로 원본 타이밍을 그대로 재현
        scene.anims.create({
          key: animKey,
          frames: durs.map((dur, i) => ({ key: tex, frame: row * cols + i, duration: Math.max(1, dur * 1000 / 60 - 1) })),
          frameRate: 1000,
          repeat: LOOP.has(anim) ? -1 : 0
        });
      }
      const total = durs.reduce((s, v) => s + v, 0) * 1000 / 60;
      const hitIdx = d.hit >= 0 ? d.hit : Math.floor(durs.length / 2);
      const hitMs = durs.slice(0, hitIdx).reduce((s, v) => s + v, 0) * 1000 / 60;
      // 모든 프레임은 몸 중심이 프레임 중앙에 오도록 정렬되어 있다 → 발 위치 = 중앙 + foot
      meta.anims[anim] = { fw: d.fw, fh: d.fh, oy: (d.fh / 2 + measured.foot) / d.fh, ms: total, hitMs, src: d.source };
      meta.hasSprite = true;
    }
    meta.bodyW = Math.max(8, Math.min(44, Math.round(measured.w * .62)));
    meta.bodyH = Math.max(10, Math.min(64, Math.round(measured.h * .8)));
    meta.height = measured.h;
    meta.eye = measured.eye;   // 발 기준 눈(머리 앞쪽) 위치, 오른쪽을 볼 때 기준
    this.meta[key] = meta;
  }

  // Walk(없으면 Idle) 오른쪽 첫 프레임의 불투명 영역을 재서 발 위치와 몸통 크기를 구한다
  measure(key) {
    const r = this.resolve(key, 'Walk') || this.resolve(key, 'Idle');
    if (!r) return { foot: 8, w: 18, h: 20, eye: { dx: 4, dy: -16 } };
    const { d, tex } = r;
    const img = this.scene.textures.get(tex).getSourceImage();
    const cols = Math.max(1, Math.floor(img.width / d.fw));
    const rows = Math.max(1, Math.floor(img.height / d.fh));
    const row = rowFor(rows, 'right');
    const cv = document.createElement('canvas');
    cv.width = d.fw; cv.height = d.fh;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, row * d.fh, d.fw, d.fh, 0, 0, d.fw, d.fh);
    const px = ctx.getImageData(0, 0, d.fw, d.fh).data;
    let minX = d.fw, maxX = -1, minY = d.fh, maxY = -1;
    for (let y = 0; y < d.fh; y++) for (let x = 0; x < d.fw; x++) {
      if (px[(y * d.fw + x) * 4 + 3] > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (maxX < 0) return { foot: d.fh / 4, w: d.fw / 2, h: d.fh / 2, eye: { dx: 4, dy: -d.fh / 3 } };
    void cols;
    // 눈 위치 추정: 위쪽 40% 띠에서 가장 앞(오른쪽)으로 튀어나온 지점(머리 앞)에서 조금 뒤·위
    const band = minY + Math.max(2, Math.round((maxY - minY) * .4));
    let frontX = minX, frontY = minY;
    for (let y = minY; y <= band; y++) for (let x = maxX; x >= minX; x--) {
      if (px[(y * d.fw + x) * 4 + 3] > 40) { if (x > frontX) { frontX = x; frontY = y; } break; }
    }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const ex = frontX - Math.max(2, Math.round(w * .14)), ey = Math.min(frontY, minY + Math.round(h * .28));
    const footY = maxY + 1;
    return { foot: footY - d.fh / 2, w, h, eye: { dx: ex + .5 - d.fw / 2, dy: ey + .5 - footY } };
  }
}

// ---------------- 어디서나 쓰는 지연 로딩 창구 ----------------
let LOADER = null;
const LINE_KEYS = (() => {   // 계열 id → 그 계열 모든 모습·메가 (플레이어 진화·메가 · 야생 진화형에 대비)
  const out = {};
  for (const l of LINES) out[l.id] = [...l.forms.map(f => f.key), ...(l.megas || []).map(m => m.key)];
  for (const [id, w] of Object.entries(WILD)) out[id] = [...new Set([...(out[id] || []), ...w.forms.map(f => f[0])])];
  return out;
})();
const KEY_LINE = {};   // 모습 key → 계열 id
for (const [id, ks] of Object.entries(LINE_KEYS)) for (const k of ks) if (!KEY_LINE[k]) KEY_LINE[k] = id;
// 포켓몬 key 나 계열 id 목록 → 받아야 할 모습 key 목록 (중복 없이) · wholeLine 이면 key 의 계열 전체
export function expandKeys(keys, wholeLine = false) {
  const out = new Set();
  for (const k of keys || []) {
    if (!k) continue;
    if (LINE_KEYS[k]) LINE_KEYS[k].forEach(x => out.add(x));
    else { out.add(k); if (wholeLine && KEY_LINE[k]) LINE_KEYS[KEY_LINE[k]].forEach(x => out.add(x)); }
  }
  return [...out];
}
export const Sprites = {
  queue: (load, keys) => LOADER && LOADER.queue(load, keys),
  ensure: keys => (LOADER ? LOADER.ensure(keys) : Promise.resolve()),
  trim: keep => (LOADER ? LOADER.trim(keep) : 0),
  isReady: key => !LOADER || LOADER.ready.has(key) || !LOADER.lazy[key],
  isLoading: key => !!LOADER && LOADER.waits.has(key),
  get loadedCount() { return LOADER ? LOADER.ready.size : 0; }
};
