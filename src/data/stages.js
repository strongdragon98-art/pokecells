// 5대 지방 = 5개 챕터: 침식된 관동 → 어둠에 잠긴 성도 → 폭풍의 호연 → 시공이 뒤틀린 신오 → 종언의 하나·무한다이노의 심연
// 챕터마다 메트로배니아식 2D 방 그래프를 만든다 (game/World.js). 지역(area)은 본길 순서대로 이어지고, 지역마다 샛길이 갈라진다.
//  plan: 그 지역 본길의 방 차례. 토큰 —
//   start 입구 · c 전투방(모양 무작위) · wide 넓은 방(2×1) · plaza 광장(2×2) · tower 위로 솟은 탑(1×3) · abyss 아래로 파고드는 갱도(1×3)
//   stairs 계단(1×2, 한 줄 위로) · bridge 낭떠러지 다리 방(2×1) · hub 시내(포켓몬센터 · 아머까오 정거장, 적 없음)
//   mini:보스 중간 보스 아레나 · boss:보스 지방 최종 보스 아레나
//   토큰 끝 ^ = 앞 방 바로 위에 쌓는다 (수직 탑: 포켓몬타워 · 방울탑 · 하늘기둥 · 창기둥 · 용나선탑)
//  branches: 본길에서 갈라지는 샛길 — tm 기술머신 비밀방(카드 고르기 · 막다른 굴 일부를 바꿔 지방마다 2~3곳) · treasure 보물 · potion 상처약 · fake 막다른 굴 · hidden:보스 히든 전설 성소
//   hidden 은 부서지는 벽 너머로 깊게(2~4방) 뻗고, hiddenDir 쪽(down 아래 · left 왼쪽 · up 위)을 좋아한다
//  color: 지도·방 뒤 배경 색 · bg: 중경 배경 종류(town · road · city · forest · gym · default + 지역 랜드마크: museum · tower · silph · crystal · shrine · radio · burnt · belltower · lighthouse · volcano · seacave · skypillar · snowcity · temple · rift · spear · ferris · dragonspiral · core — systems/Textures.js 의 LANDMARKS) · city: 시내 이름(아머까오 목적지)
//  boss(챕터): 지방 최종 보스 · pool: 야생 계열 · palette: 타일·조명 색
//  bgm · bossBgm: 필드 / 지방 최종 보스전 배경음 (data/music.js 의 곡 이름 — 중간·히든 보스는 공용 boss_ruin)
export const STAGES = [
  {
    name: '침식된 관동지방', region: '관동지방', short: '관동', boss: 'mewtwo', bgm: 'ashfield', bossBgm: 'boss_abyss', pool: ['rattata', 'zubat', 'pichu', 'gastly'],
    terrain: { house: 2, terrace: 3, pit: 2, island: 2, bridge: 2, ziggurat: 1, tiers: 2, flat: 1 }, props: { lamp: 3, tree: 2, fence: 2, statue: 1 }, stalactites: [0, 2],
    plat: 'wood', roofs: [0x7a2a2a, 0x2a3a6a, 0x2a5a3a, 0x5a3a1a],
    palette: { sky: 0x0a0608, far: 0x1c0d14, wall: 0x2e3a36, wall2: 0x1a2420, edge: 0x5ad8a0, plat: 0x2c5a4a, light: 0x6affc8, accent: 0xd88aff, ambient: 0x3a4248, moss: 0x2e7a52 },
    areas: [
      { name: '잿빛에 잠긴 태초마을', en: 'Ash-Covered Pallet Town', color: 0x3a4454, bg: 'town', ash: true, plan: ['start', 'c', 'c'], branches: ['fake'],
        terrain: { house: 6, terrace: 2, flat: 2, pit: 1 }, props: { fence: 3, lamp: 2, statue: 1, tree: 1 },
        lore: ['태초마을... 아무도 남아있지 않다...', '오박사 연구소 — 문이 안쪽에서 부서져 있다. 책상 위엔 빈 몬스터볼 세 개.'] },
      { name: '심연이 드리운 상록숲', en: 'Abyssal Viridian Forest', color: 0x2f4f42, bg: 'forest', forest: true, plan: ['wide', 'abyss', 'c', 'stairs'], branches: ['tm', 'potion'],
        terrain: { island: 4, terrace: 3, tiers: 3, pit: 2, bridge: 1 }, props: { tree: 9, tallgrass: 3, statue: 1 },
        lore: ['상록숲 — 들어가지 마시오. 나무가 움직인다.'] },
      { name: '회색시티 화석 박물관', en: 'Pewter Fossil Museum', color: 0x5c4e38, bg: 'museum', city: '회색시티', plan: ['hub', 'c', 'mini:onix'], branches: ['treasure', 'tm'],
        lore: ['회색시티 — 박물관의 화석 골격이 밤마다 움직인다는 소문.', '간호순의 메모: 「불빛이 꺼지기 전에, 누구든 와 줘요.」'] },
      { name: '보라타운 포켓몬타워', en: 'Lavender Pokémon Tower', color: 0x4a3556, bg: 'tower', plan: ['c', 'tower', 'tower^', 'mini:gengar^'], branches: ['tm'],
        terrain: { tiers: 5, island: 3, ziggurat: 2 }, lore: ['포켓몬타워 — 납골당의 촛불이 저절로 켜진다.', '종소리가 멈추지 않는다.'] },
      { name: '노랑시티 실프주식회사', en: 'Saffron Silph Co.', color: 0x2b3a67, bg: 'silph', city: '노랑시티', plan: ['hub', 'plaza', 'c', 'mini:alakazam'], branches: ['tm', 'potion'],
        terrain: { tiers: 3, ziggurat: 3, bridge: 2, island: 2 }, lore: ['실프주식회사 — 배양 캡슐 안의 무언가가 눈을 떴다.'] },
      { name: '블루시티 동굴 · 석영고원', en: 'Cerulean Cave · Indigo Plateau', color: 0x591c2b, bg: 'crystal', plan: ['abyss', 'c', 'boss:mewtwo'], branches: ['hidden:steelix'], hiddenDir: 'down',
        lore: ['블루시티 동굴 — 가장 깊은 곳에서 누군가 우리를 보고 있다.'] }
    ]
  },
  {
    name: '어둠에 잠긴 성도지방', region: '성도지방', short: '성도', boss: 'ho-oh', bgm: 'cinder', bossBgm: 'boss_blaze', pool: ['rattata', 'zubat', 'machop', 'pichu'],
    terrain: { terrace: 3, house: 3, bridge: 2, tiers: 2, island: 2, pit: 1, ziggurat: 1 }, props: { lamp: 2, tree: 3, fence: 2, statue: 1 }, stalactites: [0, 2],
    plat: 'wood', roofs: [0x8a3a2a, 0x3a2a24, 0x6a4a2a, 0x2a3a3a],
    palette: { sky: 0x0e0806, far: 0x241510, wall: 0x4a3324, wall2: 0x2e1f16, edge: 0xffb04a, plat: 0x6a4428, light: 0xffc06a, accent: 0xffd8a0, ambient: 0x564434, moss: 0x7a6a2a },
    areas: [
      { name: '고요한 연두마을', en: 'Silent New Bark Town', color: 0x3d5245, bg: 'shrine', plan: ['start', 'c', 'c'], branches: ['fake'],
        terrain: { house: 5, terrace: 2, flat: 2 }, lore: ['연두마을 — 바람만이 마을을 지나간다.'] },
      { name: '금빛시티 라디오타워', en: 'Goldenrod Radio Tower', color: 0x63532b, bg: 'radio', city: '금빛시티', plan: ['hub', 'tower', 'c'], branches: ['tm', 'potion'],
        terrain: { tiers: 4, ziggurat: 2, bridge: 2 }, lore: ['라디오타워 — 같은 방송이 끝없이 되풀이된다: 「심연의 뜻대로...」', '멈춰 버린 리니어 기차역.'] },
      { name: '인주시티 불탄탑', en: 'Ecruteak Burned Tower', color: 0x5e2d24, bg: 'burnt', city: '인주시티', plan: ['hub', 'abyss', 'c', 'wide'], branches: ['hidden:ampharos', 'tm'], hiddenDir: 'down',
        terrain: { pit: 3, ziggurat: 3, terrace: 2 }, lore: ['불탄탑 — 타다 만 기둥 사이로 단풍잎이 떨어진다.'] },
      { name: '구름 위의 방울탑', en: 'Bell Tower Above the Clouds', color: 0x7a4928, bg: 'belltower', plan: ['tower', 'mini:raikou^', 'tower^', 'mini:entei^', 'tower^', 'mini:suicune^', 'boss:ho-oh^'], branches: ['tm', 'treasure'],
        terrain: { tiers: 5, island: 2 }, lore: ['방울탑 — 층마다 수호자가 길을 막는다. 꼭대기 제단엔 검은 불꽃이 탄다.'] }
    ]
  },
  {
    name: '폭풍이 휘몰아치는 호연지방', region: '호연지방', short: '호연', boss: 'rayquaza', bgm: 'mistcave', bossBgm: 'boss_abyss', pool: ['zubat', 'machop', 'pichu', 'gastly'],
    terrain: { pit: 3, bridge: 3, island: 3, terrace: 2, tiers: 2 }, props: { lamp: 2, statue: 2, tree: 1 }, stalactites: [1, 3],
    plat: 'metal', roofs: [0x2a5a6a, 0x3a3a4a, 0x2a6a5a, 0x5a3a2a],
    palette: { sky: 0x04100e, far: 0x0a2420, wall: 0x24504a, wall2: 0x14322e, edge: 0x4affd0, plat: 0x2a6a5a, light: 0x6affe0, accent: 0xa0fff0, ambient: 0x345450, moss: 0x2a8a6a },
    areas: [
      { name: '등화도시 해안 절벽', en: 'Lilycove Sea Cliffs', color: 0x2e5248, bg: 'lighthouse', city: '등화도시', plan: ['start', 'hub', 'c', 'bridge'], branches: ['tm', 'potion'],
        lore: ['등화도시 — 등대 불빛이 바다 쪽이 아니라 하늘을 비춘다.'] },
      { name: '굴뚝산 화산지대', en: 'Mt. Chimney Volcano', color: 0x612922, bg: 'volcano', plan: ['stairs', 'tower', 'c', 'wide'], branches: ['tm', 'treasure', 'hidden:groudon'], hiddenDir: 'down',
        terrain: { terrace: 4, pit: 3, ziggurat: 2 }, lore: ['굴뚝산 — 멈춘 케이블카 아래로 용암이 흐른다.'] },
      { name: '해저동굴 · 루네시티', en: 'Seafloor Cavern · Sootopolis', color: 0x244761, bg: 'seacave', city: '루네시티', plan: ['abyss', 'c', 'abyss', 'hub', 'mini:latias'], branches: ['fake'],
        lore: ['남쪽의 외딴섬 — 붉은 유성과 푸른 유성이 짝을 지어 날았다.'] },
      { name: '성층권의 하늘기둥', en: 'Sky Pillar Stratosphere', color: 0x29594b, bg: 'skypillar', plan: ['tower', 'tower^', 'c^', 'boss:rayquaza^'], branches: ['tm'],
        terrain: { tiers: 4, island: 3, ziggurat: 2 }, lore: ['하늘기둥 — 부서진 석기둥 너머로 오로라가 흐른다.'] }
    ]
  },
  {
    name: '시공이 뒤틀린 신오지방', region: '신오지방', short: '신오', boss: 'dialga', bgm: 'spiretower', bossBgm: 'boss_final', pool: ['machop', 'gastly', 'zubat', 'pichu'],
    terrain: { island: 4, tiers: 3, ziggurat: 3, terrace: 2, bridge: 2, pit: 1 }, props: { statue: 3, lamp: 2, fence: 1 }, stalactites: [2, 4],
    plat: 'metal', roofs: [0x3a4a6a, 0x4a4a5a, 0x2a3a5a, 0x5a5a6a],
    palette: { sky: 0x080a14, far: 0x161a30, wall: 0x3a4466, wall2: 0x242a44, edge: 0xa0c8ff, plat: 0x4a5a86, light: 0xb0d0ff, accent: 0xe0e8ff, ambient: 0x464e6e, moss: 0x5a7a9a },
    areas: [
      { name: '눈 덮인 축복시티', en: 'Snowpoint City', color: 0x3b4254, bg: 'snowcity', city: '축복시티', plan: ['start', 'hub', 'c'], branches: ['fake', 'potion'],
        lore: ['축복시티 — 눈이 위로 떨어진다.'] },
      { name: '천관산 설산 신전', en: 'Mt. Coronet Snow Temple', color: 0x465866, bg: 'temple', plan: ['tower', 'c', 'wide', 'abyss'], branches: ['hidden:giratina', 'tm'], hiddenDir: 'down',
        terrain: { terrace: 3, island: 3, tiers: 3 }, lore: ['천관산 — 고대 신전 기둥에 금이 가 있다. 그 틈으로 다른 세계가 보인다.'] },
      { name: '신오 챔피언로드', en: 'Sinnoh Victory Road', color: 0x4a3b5c, bg: 'rift', plan: ['c', 'stairs', 'mini:garchomp'], branches: ['hidden:darkrai', 'treasure'], hiddenDir: 'left',
        lore: ['챔피언로드 — 정상에서 차가운 목소리가 들린다: 「심연의 뜻대로...」', '만월섬 쪽으로 가는 길은 악몽에 잠겼다.'] },
      { name: '시공의 창기둥', en: 'Spear Pillar', color: 0x3c3261, bg: 'spear', plan: ['tower', 'c^', 'boss:dialga^'], branches: ['tm', 'tm'],
        terrain: { island: 4, tiers: 3 }, lore: ['창기둥 — 시간과 공간이 서로를 삼키고 있다.'] }
    ]
  },
  {
    name: '종언의 하나지방 · 무한다이노의 심연', region: '하나지방', short: '하나', boss: 'eternatus', bgm: 'spiretower', bossBgm: 'boss_final', pool: ['gastly', 'machop', 'zubat', 'pichu', 'rattata'],
    terrain: { bridge: 3, ziggurat: 3, house: 2, pit: 2, island: 2, tiers: 2 }, props: { lamp: 3, statue: 2, fence: 1 }, stalactites: [1, 3],
    plat: 'metal', roofs: [0x5a2a3a, 0x3a2a3a, 0x6a3a4a, 0x2a2a3a],
    palette: { sky: 0x0e0408, far: 0x240a14, wall: 0x46202e, wall2: 0x2c121c, edge: 0xff4a6a, plat: 0x6a2a3a, light: 0xff6a8a, accent: 0xffa0b8, ambient: 0x52343e, moss: 0x8a2a4a },
    areas: [
      { name: '뇌문시티 폐허', en: 'Nimbasa Ruins', color: 0x2b4c59, bg: 'ferris', city: '뇌문시티', plan: ['start', 'hub', 'c', 'bridge'], branches: ['fake', 'potion', 'tm'],
        lore: ['뇌문시티 — 무너진 대관람차가 혼자 돌고 있다.'] },
      { name: '용나선탑', en: 'Dragonspiral Tower', color: 0x3d4452, bg: 'dragonspiral', plan: ['tower', 'c^', 'mini:zekrom^'], branches: ['hidden:kyurem-black', 'treasure'], hiddenDir: 'down',
        terrain: { tiers: 4, ziggurat: 3 }, lore: ['용나선탑 — 검은 번개가 탑을 감싸고 돈다.'] },
      { name: 'N의 성 · 심연의 왕좌', en: "N's Castle · Abyssal Throne", color: 0x3b1238, bg: 'core', plan: ['c', 'wide', 'abyss', 'boss:eternatus'], branches: ['tm'],
        lore: ['N의 성 — 고대 성벽을 뚫고 붉은 결정이 자라났다.', '왕좌 앞에 낯익은 빨간 모자가 떨어져 있다.'] }
    ]
  }
];

// 지도(M) 색: 지역 색을 채우기로, 같은 색을 밝힌 것을 외곽선으로 (할로우 나이트풍)
const lift = (c, k) => { const ch = s => Math.min(255, Math.round(((c >> s) & 255) + (255 - ((c >> s) & 255)) * k)); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
export const mapColor = area => ({ fill: area.color ?? 0x3a4454, line: lift(area.color ?? 0x3a4454, .62) });

// 지역 번호 표기: 1-1, 1-2 … 최종 보스 지역은 1-B
export const areaLabel = (si, ai, area) => `${si + 1}-${area.plan.some(t => t.startsWith('boss:')) ? 'B' : ai + 1}`;
