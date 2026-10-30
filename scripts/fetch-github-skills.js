// GitHub 공개 포켓몬 기술 데이터 → src/data/MoveDatabase.js  (npm run fetch-skills)
//  출처: PokeAPI/pokeapi 저장소의 공개 CSV (data/v2/csv/*.csv · BSD 3-Clause 계열 라이선스, 저작권 표시를 남긴다)
//  가져오는 것: 기술 영문·한글 이름 · 타입 · 분류(물리/특수/변화) · 위력 · 명중 · PP · 우선도 · 대상 · 부가 효과(상태이상·확률·흡수·반동·회복·
//   급소·풀죽음·연속 횟수·능력치 변화) · 성질 플래그(접촉·펀치·물기·소리·파동·탄·베기…) · 한글 설명
//   + 이 게임 플레이어블 라인(data/roster.js)의 모든 모습이 역대 게임에서 배울 수 있는 기술(레벨업 · 기술머신 · 가르침 · 알 기술)
//  음원·그림 같은 저작물은 받지 않는다 (사실 데이터만). 받은 데이터는 game/SkillGenerator.js 가 실시간 액션 기술로 바꾼다
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LINES } from '../src/data/roster.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'PokeAPI/pokeapi', BRANCH = 'master';
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/data/v2/csv/`;
const KO = 3, EN = 9;   // local_language_id

// 따옴표·쉼표·줄바꿈이 섞인 CSV 를 행 배열로
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.length > 1 || r[0]);
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
async function csv(name) {
  const res = await fetch(RAW + name + '.csv');
  if (!res.ok) throw new Error(`${name}.csv 를 받지 못함 (${res.status})`);
  const rows = parseCSV(await res.text());
  console.log(`  ✓ ${name}.csv  ${rows.length}행`);
  return rows;
}
const num = v => (v === '' || v == null ? null : +v);
const byId = rows => Object.fromEntries(rows.map(r => [r.id, r.identifier]));

async function main() {
  console.log(`GitHub ${REPO} 에서 기술 데이터를 받는 중…`);
  const [moves, names, meta, ailments, flagMap, flags, classes, targets, statChanges, flavor, types, methods, learn, versionGroups] = await Promise.all([
    csv('moves'), csv('move_names'), csv('move_meta'), csv('move_meta_ailments'), csv('move_flag_map'), csv('move_flags'), csv('move_damage_classes'),
    csv('move_targets'), csv('move_meta_stat_changes'), csv('move_flavor_text'), csv('types'), csv('pokemon_move_methods'), csv('pokemon_moves'), csv('version_groups')
  ]);
  const TYPE = byId(types), CLASS = byId(classes), TARGET = byId(targets), AIL = byId(ailments), FLAG = byId(flags), METHOD = byId(methods);
  const STAT = { 1: 'hp', 2: 'atk', 3: 'def', 4: 'spa', 5: 'spd', 6: 'speed', 7: 'acc', 8: 'eva' };
  const vgOrder = Object.fromEntries(versionGroups.map(v => [v.id, +v.order || +v.id]));

  // ---- 플레이어블 라인의 모습별 도감 번호 → 라인 ----
  const dexLine = new Map();
  for (const l of LINES) for (const f of l.forms || []) if (f.dex) dexLine.set(String(f.dex), l.id);

  // ---- 배울 수 있는 기술: 역대 본편 게임 전체를 합친다 ----
  //  (가장 최근 게임만 보면 레전드 아르세우스·Z-A 처럼 기술 수가 적은 작품이 잡혀 개굴닌자 물수리검 같은 전용기가 빠진다)
  const LEARN = {};
  for (const r of learn) {
    const line = dexLine.get(r.pokemon_id);
    if (!line) continue;
    const how = METHOD[r.pokemon_move_method_id], slot = how === 'level-up' ? 'level' : how === 'machine' ? 'tm' : how === 'tutor' ? 'tutor' : how === 'egg' ? 'egg' : null;
    if (!slot) continue;
    const L = LEARN[line] || (LEARN[line] = { level: new Set(), tm: new Set(), tutor: new Set(), egg: new Set() });
    L[slot].add(r.move_id);
  }

  // ---- 기술 본문 ----
  const want = new Set(); for (const L of Object.values(LEARN)) for (const s of Object.values(L)) for (const id of s) want.add(id);
  const nameOf = {}; for (const r of names) { if (!want.has(r.move_id)) continue; const o = nameOf[r.move_id] || (nameOf[r.move_id] = {}); if (+r.local_language_id === KO) o.ko = r.name; if (+r.local_language_id === EN) o.en = r.name; }
  const descOf = {};
  for (const r of flavor) {
    if (!want.has(r.move_id) || +r.language_id !== KO) continue;
    const ord = vgOrder[r.version_group_id] || 0;
    if (!descOf[r.move_id] || ord > descOf[r.move_id].ord) descOf[r.move_id] = { ord, text: r.flavor_text.replace(/[\s­]+/g, ' ').trim() };
  }
  const metaOf = Object.fromEntries(meta.map(r => [r.move_id, r]));
  const flagsOf = {}; for (const r of flagMap) if (want.has(r.move_id)) (flagsOf[r.move_id] = flagsOf[r.move_id] || []).push(FLAG[r.move_flag_id]);
  const statsOf = {}; for (const r of statChanges) if (want.has(r.move_id)) (statsOf[r.move_id] = statsOf[r.move_id] || {})[STAT[r.stat_id]] = +r.change;

  const DB = {};
  const idOf = {};
  for (const m of moves) {
    if (!want.has(m.id) || +m.generation_id > 9) continue;
    const mt = metaOf[m.id] || {}, id = m.identifier.replace(/-/g, '_');
    idOf[m.id] = id;
    const e = {
      en: (nameOf[m.id] || {}).en || m.identifier, ko: (nameOf[m.id] || {}).ko || null, gen: +m.generation_id,
      type: TYPE[m.type_id], cls: CLASS[m.damage_class_id], power: num(m.power), acc: num(m.accuracy), pp: num(m.pp), pri: +m.priority || 0, target: TARGET[m.target_id]
    };
    const ail = AIL[mt.meta_ailment_id];
    if (ail && ail !== 'none' && ail !== 'unknown') { e.ail = ail; e.ailP = +mt.ailment_chance || 0; }
    if (+mt.drain > 0) e.drain = +mt.drain; else if (+mt.drain < 0) e.recoil = -mt.drain;
    if (+mt.healing > 0) e.heal = +mt.healing;
    if (+mt.crit_rate) e.crit = +mt.crit_rate;
    if (+mt.flinch_chance) e.flinch = +mt.flinch_chance;
    if (mt.min_hits) e.hits = [+mt.min_hits, +mt.max_hits];
    if (statsOf[m.id]) { e.stats = statsOf[m.id]; if (+mt.stat_chance) e.statP = +mt.stat_chance; }
    if (flagsOf[m.id]) e.flags = flagsOf[m.id];
    if (descOf[m.id]) e.desc = descOf[m.id].text;
    DB[id] = e;
  }
  const learnOut = {};
  for (const [line, L] of Object.entries(LEARN)) learnOut[line] = Object.fromEntries(Object.entries(L).map(([k, s]) => [k, [...s].map(i => idOf[i]).filter(Boolean).sort()]));

  const info = { source: `https://github.com/${REPO} (data/v2/csv)`, fetched: new Date().toISOString().slice(0, 10), moves: Object.keys(DB).length, lines: Object.keys(learnOut).length,
    byClass: Object.values(DB).reduce((o, e) => (o[e.cls] = (o[e.cls] || 0) + 1, o), {}) };
  const out = `// 자동 생성 파일 — scripts/fetch-github-skills.js 가 만든다. 직접 고치지 말고 스크립트를 다시 돌린다 (npm run fetch-skills)
// 데이터 출처: PokéAPI (${info.source}) — Copyright (c) 2013–2023 Paul Hallett and PokéAPI contributors.
//  BSD 3-Clause 계열 라이선스: 재배포 시 이 저작권 표시를 남긴다. Pokémon 과 기술 이름은 Nintendo 등 권리자의 상표.
// 필드: en·ko 이름 · gen 세대 · type 타입 · cls physical|special|status · power 위력 · acc 명중 · pp · pri 우선도 · target 대상 ·
//  ail 상태이상(ailP %) · drain 흡수% · recoil 반동% · heal 회복% · crit 급소 단계 · flinch 풀죽음% · hits [최소,최대] · stats 능력치 변화(statP %) · flags 성질 · desc 한글 설명
export const DB_INFO = ${JSON.stringify(info)};
export const MOVE_DB = ${JSON.stringify(DB)};
// 플레이어블 라인(data/roster.js 의 id)이 배울 수 있는 기술 id — level 레벨업 · tm 기술머신 · tutor 가르침 · egg 알 기술 (역대 게임 전체 합)
export const LEARNSETS = ${JSON.stringify(learnOut)};
`;
  await writeFile(path.join(ROOT, 'src/data/MoveDatabase.js'), out);
  console.log(`\n완료: 기술 ${info.moves}개 · 라인 ${info.lines}개 → src/data/MoveDatabase.js (${Math.round(out.length / 1024)}KB)`, info.byClass);
  const missing = LINES.filter(l => !learnOut[l.id]).map(l => l.id);
  if (missing.length) console.log('배울 기술을 찾지 못한 라인:', missing.join(', '));
}

main().catch(e => { console.error('실패:', e.message); process.exit(1); });
