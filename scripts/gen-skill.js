// 기술 하나를 GitHub(PokeAPI) 데이터로 찾아 → 이 게임용 액션 변환 결과와 손으로 다듬을 뼈대 코드를 보여 준다
//  npm run gen-skill -- <기술 id 또는 한글·영문 이름> [--line <라인 id>]
//   예) npm run gen-skill -- 섀도볼   ·   npm run gen-skill -- dragon_pulse   ·   npm run gen-skill -- --line froakie  (그 계열이 배우는 기술 목록)
//  데이터: src/data/MoveDatabase.js (npm run fetch-skills 로 새로 받는다) · 변환 규칙: src/data/moveRules.js · 실제 동작: src/game/SkillGenerator.js
import { MOVE_DB, LEARNSETS, DB_INFO } from '../src/data/MoveDatabase.js';
import { archetypeOf, cooldownOf, totalMulOf, toSkillMeta, ARCH_NAME } from '../src/data/moveRules.js';

const args = process.argv.slice(2), li = args.indexOf('--line');
const norm = s => s.toLowerCase().replace(/[\s-]+/g, '_');

if (li >= 0) {
  const line = args[li + 1], L = LEARNSETS[line];
  if (!L) { console.log(`라인 "${line}" 의 습득표가 없다. 라인 id 는 src/data/roster.js 의 id (예: froakie, charmander)`); process.exit(1); }
  for (const [how, ids] of Object.entries(L)) {
    console.log(`\n[${how}] ${ids.length}개`);
    console.log(ids.map(id => { const m = MOVE_DB[id], a = archetypeOf(m, id); return `${m.ko || m.en}(${id}${a ? ' · ' + ARCH_NAME[a] : ' · 안 씀'})`; }).join(', '));
  }
  process.exit(0);
}

const q = args.join(' ').trim();
if (!q) { console.log('사용법: npm run gen-skill -- <기술 id | 한글 이름 | 영문 이름>   ·   npm run gen-skill -- --line <라인 id>'); console.log(DB_INFO); process.exit(0); }
const id = MOVE_DB[norm(q)] ? norm(q) : Object.keys(MOVE_DB).find(k => MOVE_DB[k].ko === q || norm(MOVE_DB[k].en) === norm(q));
if (!id) {
  const near = Object.keys(MOVE_DB).filter(k => k.includes(norm(q)) || (MOVE_DB[k].ko || '').includes(q)).slice(0, 12);
  console.log(`"${q}" 를 찾지 못했다 (플레이어블 라인이 배우는 기술 ${DB_INFO.moves}개 안에서 찾는다).${near.length ? ' 비슷한 것: ' + near.join(', ') : ''}`);
  process.exit(1);
}
const m = MOVE_DB[id], arch = archetypeOf(m, id), meta = toSkillMeta(id);
const who = Object.entries(LEARNSETS).filter(([, L]) => Object.values(L).some(a => a.includes(id))).map(([l]) => l);
console.log(`\n■ ${m.ko} (${m.en}) · ${id}\n  원본: ${JSON.stringify(m)}\n  배우는 라인: ${who.join(', ') || '없음'}`);
if (!arch) { console.log('\n  → 이 게임에서는 쓰지 않는 기술 (아군 대상 · 위력 계산식 기술 등). 손으로 만들려면 아래 뼈대를 직접 채운다.'); }
else {
  const cd = cooldownOf(m, arch);
  console.log(`\n  → 액션 형태: ${ARCH_NAME[arch]} (${arch}) · 쿨타임 ${cd}초 · 총 배율 ${totalMulOf(m, cd)}`);
  console.log(`  → 자동 생성 표시 정보: ${JSON.stringify(meta)}`);
  console.log('  (손으로 만든 기술이 없으면 이미 게임에서 이대로 쓰인다 — 기술머신 카드로 배울 수 있다)');
}
const helper = { homing: 'bezierMissiles', shockwave: 'groundShockwave', slam: 'groundShockwave', orbit: 'orbitSatellites', sky: 'skyStrike', sky_fall: 'skyStrike', ring: 'soundRing', burst: 'radialBurst', zone: 'groundZone' }[arch];
console.log(`
---------------- 손으로 다듬을 때 뼈대 ----------------
// src/data/skills/<세대>.js 의 SKILLS 에 (표시 정보)
  ${id}: { name: '${m.ko}', type: '${m.type}', cd: ${meta ? meta.cd : 5}, icon: '${meta ? meta.icon : 'orb'}', desc: '${(m.desc || '').replace(/'/g, '’')}', mega: '메가진화하면 …' },

// src/game/skills/<세대>.js 의 SKILL_IMPL 에 (실제 동작) — 쓸 수 있는 도우미: ../skillKit.js (slashHit · strikeHit · shoot · beamAction · dashAction · rockPillar …)
//  ${helper ? `../Mechanics.js 의 ${helper}() 가 이 형태의 기본 동작이다.` : '../Mechanics.js: bezierMissiles · groundShockwave · orbitSatellites · skyStrike · soundRing · radialBurst · groundZone'}
  ${id}(p) {
    const m = p.mega.active, sc = p.scene;
    return {
      dur: .34, mm: .3, anim: '${m.cls === 'physical' ? 'Strike' : 'Shoot'}', ev: [[.08, () => {
        // TODO: 여기에 이펙트·판정 (원본 위력 ${m.power ?? '-'} · ${m.cls})
      }]]
    };
  },
`);
