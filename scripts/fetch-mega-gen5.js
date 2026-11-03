// 모션 시트가 없는 메가 · 특수 폼의 본가 외형 도트 받기 (systems/MegaRig.js 가 파츠로 잘라 움직인다)
//  1순위 Pokémon Showdown Gen5 도트 (play.pokemonshowdown.com/sprites/gen5/{이름}.png) · 없으면 2순위 PokeAPI 메가 도트
//  public/assets/sprites/{key}/gen5.png 로 저장 · credits.txt 에 출처를 남긴다
//  사용: node scripts/fetch-mega-gen5.js [--force]
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RIG_SOURCES } from '../src/data/megaRig.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets', 'sprites');
const SD = 'https://play.pokemonshowdown.com/sprites/gen5';
const PA = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const FORCE = process.argv.includes('--force');

const get = async url => { const r = await fetch(url); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; };
const exists = async f => { try { await stat(f); return true; } catch (e) { return false; } };

for (const [key, src] of Object.entries(RIG_SOURCES)) {
  const dir = path.join(OUT, key), file = path.join(dir, 'gen5.png');
  if (!FORCE && await exists(file)) { console.log('있음', key); continue; }
  let buf = null, from = null;
  if (src.showdown) { buf = await get(`${SD}/${src.showdown}.png`); from = `Pokémon Showdown Gen5 sprite (${src.showdown})`; }
  if (!buf && src.pokeapi) { buf = await get(`${PA}/${src.pokeapi}.png`); from = `PokeAPI sprites (${src.pokeapi})`; }
  if (!buf) { console.warn('못 받음', key); continue; }
  await mkdir(dir, { recursive: true });
  await writeFile(file, buf);
  await writeFile(path.join(dir, 'gen5-credits.txt'), `${from}\nPokémon © Nintendo / Creatures / GAME FREAK — 비상업 팬 게임용\n`);
  console.log('받음', key, from, buf.length);
}
