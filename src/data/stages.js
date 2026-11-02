// 5대 지방 + 최종장 = 6개 챕터: 침식된 관동 → 어둠에 잠긴 성도 → 폭풍의 호연 → 시공이 뒤틀린 신오 → 종언의 하나·무한다이노의 심연 → 최종장 천계(시초의 방 · 아르세우스)
// 챕터마다 메트로배니아식 2D 방 그래프를 만든다 (game/World.js). 지역(area)은 본길 순서대로 이어지고, 지역마다 샛길이 갈라진다.
//  각 지방 첫 지역엔 결계에 지켜지는 안전한 시내(hub)가 있다 — 마을 사람들(data/npcs.js)이 이야기를 들려준다. 관동 입구는 오박사 연구소 안
//  plan: 그 지역 본길의 방 차례. 토큰 —
//   start 입구 · c 전투방(모양 무작위) · wide 넓은 방(2×1) · plaza 광장(2×2) · tower 위로 솟은 탑(1×3) · abyss 아래로 파고드는 갱도(1×3)
//   stairs 계단(1×2, 한 줄 위로) · bridge 낭떠러지 다리 방(2×1) · hub 시내(포켓몬센터 · 아머까오 정거장, 적 없음)
//   mini:보스 중간 보스 아레나 · boss:보스 지방 최종 보스 아레나 · sanct:보스 본길 끝 전설 성소(히든 전설 · 깨어진 세계의 기라티나)
//   토큰 끝 ^ = 앞 방 바로 위에 쌓는다 (수직 탑: 포켓몬타워 · 방울탑 · 하늘기둥 · 창기둥 · 용나선탑)
//   정문(포털)으로만 들어가는 독립 던전: 바로 앞 지역의 마지막 본 경로 전투방이 정문 앞 성역(몬스터 0 · 수문장 NPC 둘)이 된다 — 방울탑 · 창기둥 · 용나선탑 · 시초의 방 (game/World.js templeGate)
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
      { name: '태초마을 · 오박사 연구소', en: "Pallet Town · Oak's Lab", color: 0x3f5a48, bg: 'town', city: '태초마을', plan: ['start', 'hub', 'c', 'c'], branches: ['fake'],
        terrain: { house: 6, terrace: 2, flat: 2, pit: 1 }, props: { fence: 3, lamp: 2, statue: 1, tree: 2 },
        lore: ['태초마을 — 오박사의 결계가 마을을 지킨다. 결계 밖은 침식된 1번 도로.', '1번 도로 — 결계를 벗어나면 잿빛 안개가 짙어진다. 붉은 눈을 조심할 것.'] },
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
      { name: '바람의 연두마을', en: 'New Bark Town', color: 0x3d5245, bg: 'shrine', city: '연두마을', plan: ['start', 'hub', 'c', 'c'], branches: ['fake'],
        terrain: { house: 5, terrace: 2, flat: 2 }, lore: ['연두마을 — 새로운 바람이 부는 곳. 공박사 연구소의 결계가 마을을 지킨다.', '29번 도로 — 결계 밖. 바람에서 쇠 냄새가 난다.'] },
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
    // 신오 순서: 축복시티(신화 연구가의 복선) → 챔피언로드(조종당하는 난천의 한카리아스) → 천관산 만년설 협곡(밝은 설경 · 끝에 창기둥 정문 성역)
    //  → 창기둥(정문 포털로만 들어가는 독립 던전 · 디아루가 → 펄기아) → 깨어진 세계(제단 뒤 차원 균열로만 들어간다 · 부유섬 · 유령 발판 · 차원 도약 수정 · 기라티나)
    //  천관산 · 창기둥 · 깨어진 세계의 표시와 연출은 game/World.js(지형 · 포털) · game/Props.js(buildSinnoh) · GameScene(하늘 · 눈 · 기믹 · 기라티나 강림)
    areas: [
      { name: '눈 덮인 축복시티', en: 'Snowpoint City', color: 0x3b4254, bg: 'snowcity', city: '축복시티', plan: ['start', 'hub', 'c'], branches: ['fake', 'potion'],
        lore: ['축복시티 — 눈이 위로 떨어진다.'] },
      { name: '신오 챔피언로드', en: 'Sinnoh Victory Road', color: 0x4a3b5c, bg: 'rift', plan: ['c', 'stairs', 'mini:garchomp'], branches: ['hidden:darkrai', 'treasure'], hiddenDir: 'left',
        lore: ['챔피언로드 — 정상에서 차가운 목소리가 들린다: 「심연의 뜻대로...」', '만월섬 쪽으로 가는 길은 악몽에 잠겼다.'] },
      { name: '천관산 만년설 협곡', en: 'Mt. Coronet Snow Peak', color: 0x5a6a86, bg: 'coronet', plan: ['c', 'wide', 'stairs', 'wide'], branches: ['tm', 'treasure'],
        terrain: { terrace: 3, island: 2, tiers: 2, flat: 2, ziggurat: 1 }, props: { pillar: 3, statue: 2, fence: 1 }, stalactites: [0, 1],
        lore: ['천관산 — 만년설 아래 고대 신전의 기둥이 줄지어 서 있다. 하늘의 균열이 날마다 넓어진다.', '정상의 창기둥 — 신이라 불리던 포켓몬들이 태어난 태고의 신전.'] },
      { name: '시공의 창기둥', en: 'Spear Pillar', color: 0x6a6496, bg: 'spear', plan: ['tower', 'c^', 'boss:dialga^'], branches: ['tm'],
        terrain: { island: 4, tiers: 3 }, lore: ['창기둥 — 시간과 공간이 서로를 삼키고 있다.'] },
      { name: '깨어진 세계', en: 'Distortion World', color: 0x4a2a6a, bg: 'distortion', plan: ['c', 'stairs', 'c', 'sanct:giratina'], branches: [], sprites: ['giratina-origin'],
        lore: ['깨어진 세계 — 위와 아래가, 앞과 뒤가 뒤섞인 세계의 뒷면.'] }
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
      // 설화시티 고대 다리 · 겨울 습지: 밝기 85% 은빛 설원 · 잔잔한 물가 위 고대 석조 다리 · 피어오르는 눈꽃과 푸른 빛무리 — 마지막 방 = 용나선탑 정문 앞 성역(몬스터 0 · 노간주 · 고대 성채의 현자)
      { name: '설화시티 고대 다리 · 겨울 습지', en: 'Icirrus Bridge · Winter Marsh', color: 0x48607e, bg: 'icirrus', plan: ['c', 'bridge', 'wide'], branches: ['treasure'],
        terrain: { bridge: 2, flat: 3, island: 1, tiers: 1 }, props: { pillar: 2, statue: 1, fence: 2 }, stalactites: [0, 0],
        lore: ['설화시티 — 겨울이면 습지가 얼어붙어, 고대 석조 다리만이 용나선탑으로 이어진다.'] },
      // 용나선탑 안(밝기 80%): 왼쪽 벽엔 진실의 백열 불꽃 · 오른쪽 벽엔 이상의 푸른 뇌전 · 전자기장(점프 1.5배) · 열기 상승 기류(위층으로 활공) — 꼭대기 = 흑과 백의 제단 (N의 성이 다리로 맞물린 절경)
      { name: '용나선탑', en: 'Dragonspiral Tower', color: 0x3d4452, bg: 'dragonspiral', plan: ['tower', 'c^', 'mini:zekrom^'], branches: ['hidden:kyurem-black', 'treasure'], hiddenDir: 'down',
        terrain: { tiers: 4, ziggurat: 3 }, lore: ['용나선탑 — 검은 번개와 하얀 불꽃이 탑을 감싸고 돈다.'] },
      { name: 'N의 성 · 심연의 왕좌', en: "N's Castle · Abyssal Throne", color: 0x3b1238, bg: 'core', plan: ['c', 'wide', 'abyss', 'boss:eternatus'], branches: ['tm'],
        lore: ['N의 성 — 고대 성벽을 뚫고 붉은 결정이 자라났다.', '왕좌 앞에 낯익은 빨간 모자가 떨어져 있다.'] }
    ]
  },
  // 최종장: 무한다이노를 정화한 뒤 하늘로 열리는 성역 — 천계의 피리 공명로(빛의 유리 계단 · 밝기 95% · 완전 평화 구역) → 시초의 성문 앞(시공간의 수호자 · 고대 신오의 계승자) → 시초의 방(아르세우스)
  {
    name: '최종장 · 천계의 계단과 시초의 방', region: '천계', short: '천계', boss: 'arceus', bgm: 'celestial', bossBgm: 'boss_origin', pool: ['gastly', 'machop', 'zubat', 'pichu', 'rattata'],
    terrain: { tiers: 3, ziggurat: 2, flat: 3, island: 2 }, props: { pillar: 3, statue: 1 }, stalactites: [0, 0],
    roofs: [0xd8c890, 0xc8b8e8, 0xe8d8b0, 0xb8c8e8],
    palette: { sky: 0xfff6e0, far: 0xe8dcc0, wall: 0x9a92b8, wall2: 0x6e6890, edge: 0xffe08a, plat: 0xd8e8ff, light: 0xfff0c0, accent: 0xffe8a0, ambient: 0xb8b0d0, moss: 0xffd8f0 },
    areas: [
      { name: '천계의 피리 공명로', en: 'Azure Stairway', color: 0x8a9ac8, bg: 'azure', plan: ['start', 'stairs', 'stairs', 'c', 'wide'], branches: [],
        lore: ['천계의 피리 공명로 — 한 걸음마다 유리 계단이 맑은 소리로 운다.', '하늘 끝, 모든 것이 시작된 방이 있다고 한다.'] },
      { name: '시초의 방', en: 'Hall of Origin', color: 0xc8b070, bg: 'origin', plan: ['boss:arceus'], branches: [],
        lore: ['시초의 방 — 천 개의 팔로 우주를 빚었다는 신의 자리.'] }
    ]
  }
];

// 지도(M) 색: 지역 색을 채우기로, 같은 색을 밝힌 것을 외곽선으로 (할로우 나이트풍)
const lift = (c, k) => { const ch = s => Math.min(255, Math.round(((c >> s) & 255) + (255 - ((c >> s) & 255)) * k)); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
export const mapColor = area => ({ fill: area.color ?? 0x3a4454, line: lift(area.color ?? 0x3a4454, .62) });

// 지역 번호 표기: 1-1, 1-2 … 최종 보스 지역은 1-B
export const areaLabel = (si, ai, area) => `${si + 1}-${area.plan.some(t => t.startsWith('boss:')) ? 'B' : ai + 1}`;
