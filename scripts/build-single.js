// 서버 없이 더블클릭으로 실행되는 단일 HTML 빌드
//  1) 스프라이트 시트에서 쓰는 방향(오른쪽·왼쪽 2행)만 잘라 data URI 로 담는다
//  2) Galmuri 글꼴을 게임에 쓰인 글자만 남기도록 서브셋한다
//  3) Vite 로 번들한 JS·CSS 를 HTML 하나에 인라인한다 → 포켓셀즈-테스트.html
import { readFile, writeFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';
import subsetFont from 'subset-font';
import { build } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
const SINGLE = path.join(ROOT, 'src', 'single');
const OUT_DIR = path.join(ROOT, 'dist-single');
const OUT_FILE = path.join(ROOT, '포켓셀즈-테스트.html');
const NEEDED = ['Idle', 'Walk', 'Attack', 'Strike', 'Shoot', 'Hurt'];
const SKIP = new Set(['charizard-mega-y']);          // 게임에서 쓰지 않는 폼
const KEEP_ROWS = [2, 6];                              // 8방향 중 오른쪽, 왼쪽
const kb = n => `${(n / 1024).toFixed(0)}KB`;

// AnimData.xml 에서 필요한 모션(+CopyOf 원본)만 남긴다
function trimXml(xml) {
  const blocks = [...xml.matchAll(/<Anim>[\s\S]*?<\/Anim>/g)].map(m => m[0]);
  const info = blocks.map(b => ({ b, name: (b.match(/<Name>(.*?)<\/Name>/) || [])[1], copy: (b.match(/<CopyOf>(.*?)<\/CopyOf>/) || [])[1] }));
  const keep = new Set(NEEDED);
  for (const i of info) if (keep.has(i.name) && i.copy) keep.add(i.copy);
  const anims = {};
  for (const i of info) {
    if (!keep.has(i.name)) continue;
    anims[i.name] = { fh: +((i.b.match(/<FrameHeight>(\d+)/) || [])[1] || 0), copy: i.copy };
  }
  const out = info.filter(i => keep.has(i.name)).map(i => i.b.replace(/>\s+</g, '><').trim()).join('');
  return { xml: `<AnimData><Anims>${out}</Anims></AnimData>`, anims };
}

// 도트 스프라이트는 색 수가 적으므로 팔레트(인덱스) PNG 로 저장해 크기를 줄인다
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function encodeIndexed(img) {
  const { width: w, height: h, data } = img;
  const index = new Map(), pal = [];
  const px = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3];
    const key = a === 0 ? 0 : ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | a) >>> 0;   // 완전 투명은 한 색으로
    let idx = index.get(key);
    if (idx === undefined) { if (pal.length >= 256) return null; idx = pal.length; index.set(key, idx); pal.push(a === 0 ? [0, 0, 0, 0] : [data[i], data[i + 1], data[i + 2], a]); }
    px[p] = idx;
  }
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; raw.set(px.subarray(y * w, y * w + w), y * (w + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', Buffer.from(pal.flatMap(c => c.slice(0, 3)))),
    pngChunk('tRNS', Buffer.from(pal.map(c => c[3]))),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function cropRows(buf, fh) {
  const src = PNG.sync.read(buf);
  const rows = fh ? Math.floor(src.height / fh) : 1;
  let img = src;
  if (rows >= 8) {
    img = new PNG({ width: src.width, height: fh * KEEP_ROWS.length });
    KEEP_ROWS.forEach((r, i) => PNG.bitblt(src, img, 0, r * fh, src.width, fh, 0, i * fh));
  }
  const indexed = encodeIndexed(img);
  const rgba = indexed ? null : PNG.sync.write(img, { deflateLevel: 9 });
  const out = indexed || rgba;
  return out.length < buf.length || rows >= 8 ? out : buf;
}

const dataUri = buf => `data:image/png;base64,${buf.toString('base64')}`;

async function buildEmbed() {
  const manifest = JSON.parse(await readFile(path.join(ASSETS, 'manifest.json'), 'utf8'));
  const embed = { manifest: { pokemon: {} }, xml: {}, img: {} };
  const credits = [];
  let raw = 0, packed = 0;
  for (const [key, e] of Object.entries(manifest.pokemon)) {
    if (SKIP.has(key)) continue;
    const entry = { ...e, icon: null, artwork: null, artworkAlt: null };   // 아트워크는 용량이 커서 담지 않는다 (컷신은 도트 그림자로 대신)
    if (e.animData) {
      const { xml, anims } = trimXml(await readFile(path.join(ASSETS, e.animData), 'utf8'));
      embed.xml[key] = xml;
      for (const [name, file] of Object.entries(e.anims)) {
        if (embed.img[file]) continue;
        const a = anims[name] || {};
        const fh = a.fh || (a.copy && anims[a.copy] ? anims[a.copy].fh : 0);
        const buf = await readFile(path.join(ASSETS, file));
        const out = cropRows(buf, fh);
        raw += buf.length; packed += out.length;
        embed.img[file] = dataUri(out);
      }
      try { credits.push(`${key}: ${(await readFile(path.join(ASSETS, 'sprites', key, 'credits.txt'), 'utf8')).replace(/\s+/g, ' ').trim()}`); } catch { /* 출처 파일이 없는 폼 */ }
    }
    if (e.portrait) embed.img[e.portrait] = dataUri(await readFile(path.join(ASSETS, e.portrait)));
    embed.manifest.pokemon[key] = entry;
  }
  // 스킬 아이콘 SVG (텍스트 그대로)
  embed.manifest.icons = manifest.icons || {};
  embed.svg = {};
  for (const [id, file] of Object.entries(embed.manifest.icons)) embed.svg[id] = await readFile(path.join(ASSETS, file), 'utf8');
  // 가방 아이템 그림 (npm run fetch-items 로 받은 본가 아이콘 PNG)
  embed.manifest.items = {};
  for (const [id, file] of Object.entries(manifest.items || {})) {
    try { embed.img[file] = dataUri(await readFile(path.join(ASSETS, file))); embed.manifest.items[id] = file; }
    catch { console.warn(`  아이템 그림 없음: ${file} (도트 아이콘으로 대신)`); }
  }
  // 컷신 영상 (npm run make-videos 로 만든 public/assets/video/*.mp4) — 실행 시 Blob 으로 풀어 재생한다
  embed.video = {};
  let vid = 0;
  for (const key of ['eternatus', 'bond']) {
    try { const buf = await readFile(path.join(ASSETS, 'video', `${key}.mp4`)); embed.video[key] = buf.toString('base64'); vid += buf.length; }
    catch { console.warn(`  컷신 영상 없음: ${key}.mp4 (그 장면은 도트 연출로 대신함)`); }
  }
  console.log(`  컷신 영상 ${kb(vid)}`);
  await mkdir(SINGLE, { recursive: true });
  await writeFile(path.join(SINGLE, 'embed.js'), `// 자동 생성 파일 (npm run build:single)\nwindow.__POKECELLS_EMBED = ${JSON.stringify(embed)};\n`);
  console.log(`  스프라이트 시트 ${kb(raw)} → ${kb(packed)} (좌우 2방향만)`);
  return credits;
}

async function listSources(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (ent.name !== 'single') out.push(...await listSources(p)); }
    else if (/\.(js|html)$/.test(ent.name)) out.push(p);
  }
  return out;
}

async function buildFonts() {
  let text = '';
  for (let c = 32; c < 127; c++) text += String.fromCharCode(c);
  text += '…·→←↑↓▶★✓×';
  for (const f of [...await listSources(path.join(ROOT, 'src')), path.join(ROOT, 'single.html')]) text += await readFile(f, 'utf8');
  const chars = [...new Set([...text].filter(ch => ch.charCodeAt(0) >= 32))].join('');
  const galmuri = f => path.join(ROOT, 'node_modules', 'galmuri', 'dist', f), ui = f => path.join(ROOT, 'src', 'fonts', 'ui', f);
  const faces = [
    { family: 'Galmuri11', src: galmuri('Galmuri11.woff2'), out: 'Galmuri11' },
    { family: 'Galmuri9', src: galmuri('Galmuri9.woff2'), out: 'Galmuri9' },
    { family: 'Galmuri14', src: galmuri('Galmuri14.woff2'), out: 'Galmuri14' },
    { family: 'Pretendard', weight: 'normal', src: ui('Pretendard-Regular.woff2'), out: 'Pretendard-Regular' },
    { family: 'Pretendard', weight: 'bold', src: ui('Pretendard-SemiBold.woff2'), out: 'Pretendard-SemiBold' },
    { family: 'Cinzel', weight: '400 900', src: ui('Cinzel.woff2'), out: 'Cinzel' }
  ];
  let css = '/* 자동 생성 파일 (npm run build:single) — 게임에 쓰인 글자만 담은 Galmuri·프리텐다드·Cinzel (SIL OFL 1.1) */\n';
  let before = 0, after = 0;
  for (const f of faces) {
    const src = await readFile(f.src);
    const sub = await subsetFont(src, chars, { targetFormat: 'woff2' });
    await writeFile(path.join(SINGLE, `${f.out}.woff2`), sub);
    css += `@font-face { font-family: '${f.family}'; src: url('./${f.out}.woff2') format('woff2');${f.weight ? ` font-weight: ${f.weight};` : ''} font-display: block; }\n`;
    before += src.length; after += sub.length;
  }
  await writeFile(path.join(SINGLE, 'fonts.css'), css);
  console.log(`  글꼴 ${kb(before)} → ${kb(after)} (${chars.length}자)`);
}

async function bundle() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await build({
    configFile: false,
    root: ROOT,
    base: './',
    logLevel: 'warn',
    define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },   // vite.config.js 와 같은 값 (단일 HTML 은 파일 안의 manifest 를 써서 실제로는 안 쓰인다)
    resolve: { alias: { phaser: path.join(ROOT, 'node_modules', 'phaser', 'dist', 'phaser-arcade-physics.min.js') } },   // 쓰지 않는 Matter 물리엔진 제외
    build: {
      outDir: OUT_DIR, emptyOutDir: true, assetsInlineLimit: 1e9, cssCodeSplit: false, modulePreload: false,
      chunkSizeWarningLimit: 1e9, rollupOptions: { input: path.join(ROOT, 'single.html') }
    }
  });
}

async function inline(credits) {
  let html = await readFile(path.join(OUT_DIR, 'single.html'), 'utf8');
  const read = rel => readFile(path.join(OUT_DIR, rel.replace(/^\.\//, '')), 'utf8');
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)];
  for (const m of scripts) {
    const js = (await read(m[1])).replace(/<\/script/gi, '<\\/script');
    html = html.replace(m[0], () => `<script type="module">${js}</script>`);
  }
  const links = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
  for (const m of links) { const css = await read(m[1]); html = html.replace(m[0], () => `<style>${css}</style>`); }
  if (/src="\.\/assets\/|href="\.\/assets\//.test(html)) throw new Error('인라인되지 않은 외부 파일 참조가 남았습니다');
  const notice = `<!--\n포켓 셀즈 테스트판 — 개인·비상업 팬게임. 공개 배포·상업적 이용 금지.\n포켓몬 스프라이트: PMDCollab/SpriteCollab (CC BY-NC 4.0)\n${credits.join('\n').replace(/--/g, '-')}\n아이템 그림: 본가 가방 아이콘 (Serebii 아이템 도감)\n글꼴: Galmuri (SIL OFL 1.1) · 포켓몬 이름·캐릭터의 권리는 Nintendo/Creatures/GAME FREAK 에 있습니다.\n-->\n`;
  html = html.replace('<!doctype html>', `<!doctype html>\n${notice}`);
  await writeFile(OUT_FILE, html);
  return (await stat(OUT_FILE)).size;
}

async function main() {
  console.log('단일 HTML 빌드');
  const credits = await buildEmbed();
  await buildFonts();
  await bundle();
  const size = await inline(credits);
  console.log(`\n완료: ${path.relative(ROOT, OUT_FILE)} (${(size / 1024 / 1024).toFixed(2)}MB) — 더블클릭하면 브라우저에서 바로 실행됩니다.`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
