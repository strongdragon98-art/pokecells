// 포켓몬 도트 에셋 자동 다운로드
//  - PMDCollab/SpriteCollab : 액션 스프라이트 시트 + AnimData.xml + 초상화 + credits.txt
//  - PokeAPI/sprites        : 기본 도트(백업 및 아이콘) + 공식 아트워크(컷신 도트 연출용 큰 그림)
//  - Serebii 아이템 도감    : 본가 가방 아이템 그림 (scripts/fetch-items.js)
// 존재하지 않는 파일(404)은 건너뛰고, 실제로 받은 파일만 public/assets/manifest.json 에 기록한다.
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchItemArt, ITEM_ART } from './fetch-items.js';
import { assetTargets } from '../src/data/roster.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
const OUT = path.join(ASSETS, 'sprites');
const SC = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const PA = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const ART = `${PA}/other/official-artwork`;
const ANIMS = ['Walk', 'Attack', 'Strike', 'Shoot', 'Hurt', 'Idle'];
const FORCE = process.argv.includes('--force');

// key: 게임 안에서 쓰는 이름 / dex: 도감번호 4자리 / form: SpriteCollab 폼 폴더 / pokeapi: PokeAPI 번호
const BASE_TARGETS = [
  { key: 'bulbasaur', dex: '0001', role: '스타팅' },
  { key: 'charmander', dex: '0004', role: '스타팅' },
  { key: 'squirtle', dex: '0007', role: '스타팅' },
  { key: 'pichu', dex: '0172', role: '플레이' },
  { key: 'rattata', dex: '0019', role: '야생' },
  { key: 'pikachu', dex: '0025', role: '진화' },
  { key: 'zubat', dex: '0041', role: '야생' },
  { key: 'machop', dex: '0066', role: '야생' },
  { key: 'gastly', dex: '0092', role: '야생' },
  { key: 'venusaur', dex: '0003', role: '보스' },
  { key: 'charizard', dex: '0006', role: '보스' },
  { key: 'blastoise', dex: '0009', role: '보스' },
  { key: 'gengar', dex: '0094', role: '보스' },
  { key: 'eternatus', dex: '0890', role: '컷신' },
  // 플레이어 진화형 (2·3단계). 이상해꽃·리자몽·거북왕·팬텀은 보스로 이미 받는다
  { key: 'ivysaur', dex: '0002', role: '진화' },
  { key: 'charmeleon', dex: '0005', role: '진화' },
  { key: 'wartortle', dex: '0008', role: '진화' },
  { key: 'raticate', dex: '0020', role: '진화' },
  { key: 'raichu', dex: '0026', role: '진화' },
  { key: 'golbat', dex: '0042', role: '진화' },
  { key: 'crobat', dex: '0169', role: '진화' },
  { key: 'machoke', dex: '0067', role: '진화' },
  { key: 'machamp', dex: '0068', role: '진화' },
  { key: 'haunter', dex: '0093', role: '진화' },
  // 5대 지방 보스·전설 (관동 → 성도 → 호연 → 신오 → 하나/최종장)
  { key: 'mewtwo', dex: '0150', role: '보스' },
  { key: 'alakazam', dex: '0065', role: '보스' },
  { key: 'alakazam-mega', dex: '0065', form: '0001', role: '메가', pokeapi: 10037 },
  { key: 'onix', dex: '0095', role: '보스' },
  { key: 'steelix', dex: '0208', role: '보스' },
  { key: 'ho-oh', dex: '0250', role: '보스' },
  { key: 'suicune', dex: '0245', role: '보스' },
  { key: 'entei', dex: '0244', role: '보스' },
  { key: 'raikou', dex: '0243', role: '보스' },
  { key: 'ampharos', dex: '0181', role: '보스' },
  { key: 'rayquaza', dex: '0384', role: '보스' },
  { key: 'latias', dex: '0380', role: '보스' },
  { key: 'latios', dex: '0381', role: '보스' },
  { key: 'garchomp', dex: '0445', role: '보스' },
  { key: 'garchomp-mega', dex: '0445', form: '0001', role: '메가', pokeapi: 10058 },   // 도트 없음 → 한카리아스 도트 + 메가 오라
  { key: 'dialga', dex: '0483', role: '보스' },
  { key: 'palkia', dex: '0484', role: '보스' },
  { key: 'giratina', dex: '0487', role: '보스' },
  { key: 'giratina-origin', dex: '0487', form: '0001', role: '폼', pokeapi: 10007 },
  { key: 'darkrai', dex: '0491', role: '보스' },
  { key: 'zekrom', dex: '0644', role: '보스' },
  { key: 'kyurem-black', dex: '0646', form: '0001', role: '폼', pokeapi: 10022 },
  { key: 'groudon', dex: '0383', role: '보스' },
  { key: 'corviknight', dex: '0823', role: '택시' },
  { key: 'venusaur-mega', dex: '0003', form: '0001', role: '메가', pokeapi: 10033 },
  { key: 'charizard-mega-x', dex: '0006', form: '0001', role: '메가', pokeapi: 10034 },
  { key: 'charizard-mega-y', dex: '0006', form: '0002', role: '메가', pokeapi: 10035 },
  { key: 'blastoise-mega', dex: '0009', form: '0001', role: '메가', pokeapi: 10036 },
  { key: 'gengar-mega', dex: '0094', form: '0001', role: '메가', pokeapi: 10038 }
];
// 플레이어블 로스터(data/roster.js)의 모든 진화 모습·메가 중 위 목록에 없는 것을 더한다
const TARGETS = [...BASE_TARGETS, ...assetTargets().filter(r => !BASE_TARGETS.some(b => b.key === r.key))];
// 도트 없이 아트워크만 받는 폼: 무한다이맥스 무한다이노 → eternatus 항목의 artworkAlt
const EXTRA_ART = [{ key: 'eternatus', field: 'artworkAlt', file: 'artwork-eternamax.png', pokeapi: 10190 }];

// 스킬 아이콘: game-icons.net (CC BY 3.0, 작가별 폴더) 의 단색 SVG → 게임이 타입 색으로 칠해 쓴다
const GI = 'https://raw.githubusercontent.com/game-icons/icons/master';
const SKILL_ICONS = {
  scratch_ember: 'lorc/claw-slashes', flamethrower: 'lorc/fire-ray', flame_charge: 'lorc/fire-dash',
  tackle_watergun: 'lorc/water-bolt', bubblebeam: 'lorc/bubbles', rapid_spin: 'lorc/whirlwind',
  vine_whip: 'lorc/vine-whip', razor_leaf: 'lorc/falling-leaf', seed_field: 'lorc/sprout',
  hyper_fang: 'lorc/sharp-smile', super_fang: 'lorc/gluttonous-smile', quick_attack: 'lorc/sprint',
  thundershock: 'lorc/lightning-branches', thunderbolt: 'lorc/lightning-storm', volt_tackle: 'lorc/lightning-arc',
  leech_life: 'lorc/bat-wing', supersonic: 'lorc/sonic-boom', wing_dash: 'lorc/feathered-wing',
  karate_chop: 'lorc/punch', dynamic_punch: 'lorc/punch-blast', counter: 'lorc/shield-reflect',
  lick_shadow: 'delapouite/tongue', shadow_ball: 'lorc/magic-swirl', phantom_dash: 'lorc/spectre',
  // 기술머신 기술
  crunch: 'lorc/shark-jaws', solar_beam: 'lorc/sunbeams', hurricane: 'lorc/tornado', thunder_punch: 'lorc/lightning-tear',
  dragon_claw: 'lorc/dragon-head', ice_beam: 'lorc/ice-bolt', flash_cannon: 'lorc/cannon-shot', dark_pulse: 'lorc/evil-moon',
  earthquake: 'lorc/earth-crack', sludge_bomb: 'lorc/acid-blob', earth_power: 'lorc/earth-spit', play_rough: 'lorc/fairy-wand',
  giga_drain: 'lorc/life-tap', iron_tail: 'lorc/spiked-tail', surf: 'lorc/big-wave', psychic: 'lorc/psychic-waves',
  heat_wave: 'lorc/heat-haze', steel_wing: 'lorc/feathered-wing', ice_punch: 'lorc/frozen-orb', stone_edge: 'lorc/stone-spear'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const stats = { ok: 0, skipped: 0, missing: 0, failed: 0, bytes: 0 };

async function exists(file) { try { return (await stat(file)).size > 0; } catch { return false; } }

// 404 → null, 그 외 오류는 재시도 후 null
async function download(url, dest, { text = false } = {}) {
  if (!FORCE && await exists(dest)) { stats.skipped++; return text ? readFile(dest, 'utf8') : readFile(dest); }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'pokecells-asset-fetcher' } });
      clearTimeout(timer);
      if (res.status === 404) { stats.missing++; return null; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('빈 응답');
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      stats.ok++; stats.bytes += buf.length;
      return text ? buf.toString('utf8') : buf;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === 3) { stats.failed++; console.warn(`  ! 실패 (${err.message}): ${url}`); return null; }
      await sleep(600 * attempt);
    }
  }
  return null;
}

// AnimData.xml 에서 <Anim> 목록을 읽는다 (CopyOf 포함)
function parseAnimData(xml) {
  const anims = {};
  for (const m of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const body = m[1];
    const name = (body.match(/<Name>(.*?)<\/Name>/) || [])[1];
    if (!name) continue;
    const copyOf = (body.match(/<CopyOf>(.*?)<\/CopyOf>/) || [])[1] || null;
    anims[name] = { copyOf };
  }
  return anims;
}

async function fetchTarget(t) {
  const dir = path.join(OUT, t.key);
  const scBase = `${SC}/sprite/${t.dex}${t.form ? '/' + t.form : ''}`;
  const portraitBase = `${SC}/portrait/${t.dex}${t.form ? '/' + t.form : ''}`;
  const entry = { key: t.key, dex: t.dex, form: t.form || null, role: t.role, animData: null, anims: {}, portrait: null, icon: null, artwork: null };

  const xml = await download(`${scBase}/AnimData.xml`, path.join(dir, 'AnimData.xml'), { text: true });
  if (xml) {
    entry.animData = `sprites/${t.key}/AnimData.xml`;
    const listed = parseAnimData(xml);
    // 필요한 모션 + CopyOf 로 참조되는 원본 모션
    const want = new Set();
    for (const a of ANIMS) if (listed[a]) want.add(listed[a].copyOf || a);
    for (const a of want) {
      const ok = await download(`${scBase}/${a}-Anim.png`, path.join(dir, `${a}-Anim.png`));
      if (ok) entry.anims[a] = `sprites/${t.key}/${a}-Anim.png`;
    }
    for (const a of ANIMS) if (listed[a] && listed[a].copyOf && entry.anims[listed[a].copyOf]) entry.anims[a] = entry.anims[listed[a].copyOf];
    await download(`${scBase}/credits.txt`, path.join(dir, 'credits.txt'));
  }
  if (await download(`${portraitBase}/Normal.png`, path.join(dir, 'portrait.png'))) entry.portrait = `sprites/${t.key}/portrait.png`;
  const paId = t.pokeapi || parseInt(t.dex, 10);
  if (await download(`${PA}/${paId}.png`, path.join(dir, 'pokeapi.png'))) entry.icon = `sprites/${t.key}/pokeapi.png`;
  if (await download(`${ART}/${paId}.png`, path.join(dir, 'artwork.png'))) entry.artwork = `sprites/${t.key}/artwork.png`;
  for (const x of EXTRA_ART.filter(x => x.key === t.key)) {
    if (await download(`${ART}/${x.pokeapi}.png`, path.join(dir, x.file))) entry[x.field] = `sprites/${t.key}/${x.file}`;
  }

  const have = Object.keys(entry.anims);
  console.log(`  ${t.role.padEnd(3)} ${t.key.padEnd(18)} 모션 ${have.length ? have.join(',') : '없음(백업 도트 사용)'}${entry.portrait ? ' · 초상화' : ''}${entry.icon ? ' · 아이콘' : ''}${entry.artwork ? ' · 아트워크' : ''}`);
  return entry;
}

async function main() {
  console.log(`에셋 다운로드 시작 → ${path.relative(ROOT, OUT)}${FORCE ? ' (강제 재다운로드)' : ''}`);
  await mkdir(OUT, { recursive: true });
  const manifest = { generated: new Date().toISOString(), sources: { spriteCollab: SC, pokeapi: PA, artwork: ART }, pokemon: {} };
  // 저장소에 부담을 주지 않도록 3개씩 나눠 받는다
  for (let i = 0; i < TARGETS.length; i += 3) {
    const batch = await Promise.all(TARGETS.slice(i, i + 3).map(fetchTarget));
    for (const e of batch) manifest.pokemon[e.key] = e;
  }
  manifest.icons = {};
  manifest.sources.gameIcons = GI;
  for (const [skill, name] of Object.entries(SKILL_ICONS)) {
    const file = `icons/${name.replace('/', '-')}.svg`;
    if (await download(`${GI}/${name}.svg`, path.join(ASSETS, file), { text: true })) manifest.icons[skill] = file;
  }
  console.log(`  스킬 아이콘 ${Object.keys(manifest.icons).length} / ${Object.keys(SKILL_ICONS).length}개 (game-icons.net)`);
  manifest.items = await fetchItemArt({ force: FORCE });   // 가방에 보일 본가 아이템 그림
  manifest.sources.itemArt = ITEM_ART;
  await writeFile(path.join(ASSETS, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const missingCore = BASE_TARGETS.filter(t => !t.form && !Object.keys(manifest.pokemon[t.key].anims).length).map(t => t.key);
  const noAnim = TARGETS.filter(t => !t.form && !BASE_TARGETS.includes(t) && !Object.keys(manifest.pokemon[t.key].anims).length).map(t => t.key);
  if (noAnim.length) console.log(`로스터 포켓몬 중 모션 시트 없음 → 게임에서 PokeAPI 도트 + 절차 애니메이션으로 대신: ${noAnim.join(', ')}`);
  console.log(`\n완료: 새로 받음 ${stats.ok}개 (${(stats.bytes / 1024).toFixed(0)}KB) · 이미 있음 ${stats.skipped}개 · 원본에 없음(404) ${stats.missing}개 · 실패 ${stats.failed}개`);
  console.log(`manifest: ${path.relative(ROOT, path.join(ASSETS, 'manifest.json'))}`);
  if (missingCore.length) { console.error(`필수 포켓몬 스프라이트를 받지 못했습니다: ${missingCore.join(', ')}`); process.exitCode = 1; }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
