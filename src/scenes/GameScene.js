// 던전 전투 씬: 스테이지 생성, 광원, 방 잠금·웨이브, 보스, 드랍, 도감 등록
import Phaser from 'phaser';
import { ZOOM, RES, TILE } from '../config.js';
import { STAGES, areaLabel } from '../data/stages.js';
import { FORM_ITEMS } from '../data/roster.js';
import { WILD, DEX_ORDER, SPECIES, SKILLS, TIERS, wildForm, pickWildStage, XP_UNITS, XP_RULE, DROPS, EVO_EXP, ZMOVES, BOSSES } from '../data/pokemon.js';
import { ITEMS, RANDOM_ITEM_KEYS, ITEM_DROP, CONSUMABLES, MAX_EQUIP } from '../data/items.js';
import { stoneName, crystalName, zTypeOf, usesStone } from '../data/gear.js';
import { coreOfBoss } from '../data/cores.js';
import { NUGGETS, eliteNuggets, bossNuggets, martKey, POTION_CD } from '../data/shop.js';
import { BOND_POWERS, BOND_SUN_ATK, BOND_SUN_HP, HEROES_KEY, potionMaxAt } from '../data/bond.js';
import { typeColor } from '../data/types.js';
import { PLAT_SET, groundYAt, T as TILE_ID } from '../game/Level.js';
import { buildChapter, roomAt, CW, CH, safeRoom, NPC_WARD, npcSpawnFree } from '../game/World.js';
import { buildTestRoom, bossHome, TEST_LANDMARKS, landmarkCi } from '../game/TestRoom.js';
import { solidRowAt } from '../game/Arenas.js';
import { bakeArenaTiles } from '../systems/ArenaArt.js';
import { buildArenaBackdrop, craneArt, chainArt } from '../systems/ArenaBackdrop.js';

const ARENA_ZOOM = 1;
// 🌀 지방 최종 보스를 정화한 뒤 (chapterGate): 보스방 오른쪽 끝에 빛과 함께 조력자 NPC(data/npcs.js guide_*) · 다음 지방 이동 포털 — 자동 이동은 없다 (포털 앞에서 F)
//  late: 시초의 방은 아르세우스의 텔레파시가 끝난 뒤 포털 (arceusTelepathy) · 하나 용나선탑(제크로무 → 레시라무)은 조력자만 (위로 이어진 천계로 걸어간다)
const CHAPTER_GATES = [
  [{ boss: 'mewtwo', guide: 'guide_oak', portal: true }],
  [{ boss: 'ho-oh', guide: 'guide_kimono', portal: true }],
  [{ boss: 'rayquaza', guide: 'guide_steven', portal: true }],
  [{ boss: 'giratina', guide: 'guide_cynthia', portal: true }],
  [{ boss: 'zekrom', guide: 'guide_alder', portal: false }, { boss: 'arceus', guide: null, portal: true, late: true }],
  []
];
const PORTAL_DEST = ['', '인주시티 방울탑 구역', '등화도시 · 하늘기둥 구역', '축복시티 · 천관산 창기둥 구역', '뇌문시티 · 용나선탑 구역', '너클시티 지하 에너지 플랜트 구역'];
// 🖐️ 필드 아이템: 반경 PICK_R 안의 가장 가까운 하나에 포커스 · 작은 설명 툴팁 · F / ↑ / 조사 버튼 / 터치로 줍는다 (금구슬만 닿으면 자동)
//  SAVE_DROPS: 줍지 않고 저장해도 이어하기에 그 자리에 다시 놓이는 것 (코어 · 열쇠 · 유대의 불꽃 · 진화 아이템 …)
const PICK_R = 60, AUTO_PICK = new Set(['nugget']), SAVE_DROPS = new Set(['item', 'orb', 'bondflame', 'megastone', 'zcrystal', 'formitem', 'tmcore', 'candy']);
// 유대의 불꽃 (보스가 있던 자리에 남는다 — 품으면 정화 단계 +1): 12×16 금빛 · 진홍빛 불꽃
function bondFlameArt(scene) {
  if (scene.textures.exists('bondflame')) return 'bondflame';
  const t = scene.textures.createCanvas('bondflame', 12, 16), c = t.getContext(), F = (x, y, w, h, col) => { c.fillStyle = '#' + col.toString(16).padStart(6, '0'); c.fillRect(x, y, w, h); };
  [[5, 0, 2], [4, 1, 3], [4, 2, 4], [3, 3, 5], [2, 4, 7], [2, 5, 8], [1, 6, 9], [1, 7, 10], [1, 8, 10], [0, 9, 12], [0, 10, 12], [1, 11, 10], [1, 12, 10], [2, 13, 8], [3, 14, 6], [4, 15, 4]].forEach(([x, y, w]) => F(x, y, w, 1, 0xff3a2a));
  [[5, 3, 2], [4, 5, 4], [3, 7, 6], [3, 9, 6], [3, 11, 6], [4, 13, 4]].forEach(([x, y, w]) => { F(x, y, w, 2, 0xffb040); });
  [[5, 8, 2], [4, 10, 4], [5, 12, 2]].forEach(([x, y, w]) => F(x, y, w, 2, 0xfff4c0));
  t.refresh();
  return 'bondflame';
}
// ✨ 샛길 정화: 정화 전 샛길 구역의 화면 침식 깊이 하한 (검붉은 비네팅 · 채도 · 주변광 · 포자) · 본길 전투 방은 다른 방에 이만큼(ms) 다녀오면 쓰러뜨린 자리에 다시 나타난다
const SIDE_GLOOM = .62, MAIN_RESPAWN_MS = 4000;
// 보스 결전장 주변광: [물들일 색, 밝기 하한(초입 밝기 대비)] (game/Arenas.js 의 결전장 종류)
const ARENA_AMB = { biolab: [0x8ad8e8, .8], bellroof: [0xffc890, .92], summit: [0xc8f0ff, .92], spear: [0xe0dcff, .9], distortion: [0xb898ff, .8], yinyang: [0xf0e8f4, .86], origin: [0xfff4d8, .96], reactor: [0xffb0b8, .8] };   // 보스전 월드 배율 (평소 ZOOM 1.25 → 화면에 아레나가 더 많이 들어온다)
import { Props } from '../game/Props.js';
import { SideRooms } from '../game/SideRooms.js';
import { NPCS } from '../data/npcs.js';
import { HoohAltar, BEAST_ORBS, ORB_KEYS, orbTexture, orbCount } from '../game/HoohAltar.js';
import { Player } from '../game/Player.js';
import { Enemy } from '../game/Enemy.js';
import { Boss } from '../game/Boss.js';
import { Trainer, makeTrainerArt } from '../game/Trainer.js';
import { Npcs } from '../game/Npc.js';
import { Wanderer } from '../game/Wanderer.js';
import { CLV_COLOR } from '../game/Enemy.js';

// 트레이너 대사 (난천 · 레드)
const TRAINER_LINES = {
  cynthia: { intro: '심연의 뜻대로… 너희를 지우겠어…', freed: '…! 나는… 무슨 짓을… 고마워. 창기둥으로 가는 길을 열어 줄게.', toast: '난천이 정신을 되찾았다 — 창기둥으로 가는 길이 열렸다' },
  red: { intro: '……', next: '……', freed: '……! ……고마워.', end: '……이제, 집에 가자.', toast: '레드를 묶고 있던 실이 끊어졌다' }
};
import { Combat, overlap } from '../game/Combat.js';
import { Fx } from '../systems/Fx.js';
import { shockwave, chromatic } from '../systems/PostFX.js';
import { Sprites } from '../systems/SpriteLoader.js';
import { Perf } from '../systems/Perf.js';
import { Sfx } from '../systems/Audio.js';
import { Music } from '../systems/Music.js';
import { Settings, keyLabel } from '../systems/Settings.js';
import { Save } from '../systems/Save.js';
import { RunSave, seeded, newSeed, snapshotWorld, applyWorld, snapshotPlayer, restorePlayer } from '../systems/RunSave.js';
import { ActionTutorial, TUT_DONE } from '../game/Tutorial.js';
import { itemArt, shade, TILE_MARGIN, TILE_SPACING } from '../systems/Textures.js';
import { rollCards, applyCard, TM_CARDS, heldLv, dressCard, CARD_MAX_LV, BONUS_CARDS, cardScore, ownedUpgrades, upgradeInfo, sideSteps, MASTERY_HEAL, MASTERY_CARDS } from '../data/tm.js';
import { PERKS, onKill as perkKill } from '../game/Perks.js';
import { bossSpec, specOf, gearCheck, applyGearPreset, recommendedCardScore, GEAR_WARN } from '../data/balance.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

// 엘리트가 25% 확률로 떨어뜨리는 장착형 전술 도구
const ELITE_TOOLS = ['leftovers', 'shell_bell', 'scope_lens', 'razor_claw', 'quick_claw'];

// 햇빛 줄기 텍스처: 위는 밝고 아래로 갈수록 투명 · 가로로는 가운데가 밝고 양옆이 부드럽게 빠진다
function sunbeamTexture(scene) {
  if (scene.textures.exists('fx:sunbeam')) return;
  const t = scene.textures.createCanvas('fx:sunbeam', 32, 128), c = t.getContext();
  for (let x = 0; x < 32; x++) {
    const k = Math.pow(Math.sin(Math.PI * (x + .5) / 32), 2);
    const g = c.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, `rgba(255,255,255,${.9 * k})`); g.addColorStop(.55, `rgba(255,255,255,${.35 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(x, 0, 1, 128);
  }
  t.refresh();
}
// 맑은 낮 하늘 (지방 첫 지역 · 정화한 지방): 위는 파랗고 지평선 쪽은 따뜻한 금빛
function daySkyTexture(scene) {
  if (scene.textures.exists('fx:daysky')) return;
  const t = scene.textures.createCanvas('fx:daysky', 4, 128), c = t.getContext(), g = c.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#3f86d0'); g.addColorStop(.45, '#8cc4ec'); g.addColorStop(.78, '#f4dcb0'); g.addColorStop(1, '#f0b880');
  c.fillStyle = g; c.fillRect(0, 0, 4, 128);
  t.refresh();
}
// 이 챕터에 나올 포켓몬: 야생 계열(pool) + 지역 구성에 적힌 보스·중간 보스·숨은 보스 이름 (계열 id 는 SpriteLoader 가 모든 모습으로 펼친다)
function chapterSprites(ci) {
  const st = STAGES[ci];
  if (!st) return [];
  return [...new Set([...(st.pool || []), ...(JSON.stringify(st).match(/[a-z][a-z0-9-]+/g) || [])])];
}
// 밝기(0~255) · 그 아래면 같은 색감으로 밝혀 하한을 맞춘다
const lumOf = c => .299 * ((c >> 16) & 255) + .587 * ((c >> 8) & 255) + .114 * (c & 255);
function lumFloor(c, min) {
  const l = lumOf(c);
  if (l >= min || l <= 0) return l <= 0 ? Phaser.Display.Color.GetColor(min, min, min) : c;
  const k = min / l, ch = v => Math.min(255, Math.round(v * k));
  return Phaser.Display.Color.GetColor(ch((c >> 16) & 255), ch((c >> 8) & 255), ch(c & 255));
}
// 뮤츠 배양 인큐베이터: 쇠 받침 · 유리관(검붉은 배양액 · 기포 · 안의 실루엣) · 위 뚜껑과 관 (broken: 깨진 뒤 받침과 유리 조각만)
function capsuleArt(scene, broken = false) {
  const key = broken ? 'prop:capsule:b' : 'prop:capsule';
  if (scene.textures.exists(key)) return key;
  const W = 40, H = 78, t = scene.textures.createCanvas(key, W, H), c = t.getContext();
  const F = (x, y, w, h, col, a = 1) => { c.globalAlpha = a; c.fillStyle = '#' + col.toString(16).padStart(6, '0'); c.fillRect(x, y, w, h); c.globalAlpha = 1; };
  F(2, H - 10, 36, 10, 0x3a3a46); F(4, H - 12, 32, 3, 0x5a5a6a); F(2, H - 10, 36, 1, 0x8a8a9a);   // 받침
  for (let x = 6; x < 34; x += 6) F(x, H - 6, 3, 2, 0xff2a4a, .8);   // 받침 경고등
  if (broken) {
    for (const [x, h] of [[6, 10], [10, 6], [27, 12], [32, 7]]) F(x, H - 12 - h, 3, h, 0xa8d0e0, .55);   // 남은 유리 조각
    F(5, H - 14, 30, 2, 0x5a0a1a, .8);   // 쏟아진 배양액
  } else {
    const g = c.createLinearGradient(0, 8, 0, H - 12); g.addColorStop(0, 'rgba(120,10,30,.55)'); g.addColorStop(1, 'rgba(40,2,10,.9)');
    c.fillStyle = g; c.fillRect(6, 10, 28, H - 22);
    F(13, 24, 14, 30, 0x14040a, .85); F(16, 18, 8, 8, 0x14040a, .85); F(10, 30, 4, 12, 0x14040a, .7); F(26, 30, 4, 12, 0x14040a, .7);   // 안의 실루엣
    for (const [x, y] of [[9, 50], [29, 40], [12, 30], [24, 58], [20, 14]]) F(x, y, 2, 2, 0xffb0c0, .7);   // 기포
    F(6, 10, 2, H - 22, 0xd8f0ff, .55); F(31, 10, 1, H - 22, 0xd8f0ff, .3);   // 유리 반사
    c.strokeStyle = 'rgba(180,220,240,.7)'; c.lineWidth = 1; c.strokeRect(5.5, 9.5, 29, H - 21);
  }
  F(3, 2, 34, 8, 0x3a3a46); F(5, 0, 30, 3, 0x5a5a6a); F(3, 2, 34, 1, 0x8a8a9a); F(18, 0, 4, 2, 0xff2a4a);   // 뚜껑 · 관
  t.refresh();
  return key;
}
// 기와 한 칸 (16×8): 둥근 기와 줄 + 황금 막새
function kawaraArt(scene) {
  const key = 'prop:kawara';
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, 16, 8), c = t.getContext();
  const F = (x, y, w, h, col) => { c.fillStyle = '#' + col.toString(16).padStart(6, '0'); c.fillRect(x, y, w, h); };
  F(0, 0, 16, 8, 0x2a3a40); F(0, 0, 16, 1, 0x5a7080);
  for (const x of [0, 8]) { F(x + 1, 1, 6, 5, 0x3a4c56); F(x + 2, 1, 4, 1, 0x7a92a0); F(x + 3, 5, 2, 2, 0xd8a840); }
  F(0, 7, 16, 1, 0x141c20);
  t.refresh();
  return key;
}
// 신오 랜드마크 하늘 (화면에 붙는 먼 하늘): 천관산 협곡은 시린 설산 하늘 · 창기둥은 연보랏빛 새벽하늘 · 깨어진 세계는 짙은 보랏빛 바탕 (성운은 따로)
const skyKindOf = r => !r ? null : r.snowPeak ? 'coronet' : r.spear ? 'spear' : r.distortion ? 'distortion' : r.icirrus ? 'icirrus' : r.spiral ? 'spiral' : r.azure ? 'azure' : r.origin ? 'origin' : r.plantHeart ? 'heart' : r.plant ? 'plant' : null;
const SKY_STOPS = {
  coronet: [[0, '#4a5a8e'], [.35, '#7a90c4'], [.7, '#c4d4ee'], [1, '#eef4ff']],
  spear: [[0, '#1e1a46'], [.4, '#4a3e86'], [.75, '#9a86c8'], [1, '#e8d0f0']],
  distortion: [[0, '#140828'], [.5, '#2a1450'], [1, '#3a2060']],
  icirrus: [[0, '#46567e'], [.4, '#8298c4'], [.75, '#cad8ee'], [1, '#f2f6ff']],   // 설화시티 겨울 습지: 은빛 설원 하늘
  spiral: [[0, '#14162a'], [.45, '#2e3050'], [.8, '#5a5070'], [1, '#8a7a88']],   // 용나선탑: 검은 번개 구름이 도는 황혼
  azure: [[0, '#1e1a40'], [.42, '#5a4e8e'], [.74, '#e0c08a'], [1, '#fff2dc']],   // 천계의 피리 공명로: 황금빛 · 은빛 성운의 우주
  origin: [[0, '#e8cf98'], [.4, '#f6dca8'], [.75, '#fbecd0'], [1, '#fff8ec']],   // 시초의 방: 끝없는 순백과 황금빛
  plant: [[0, '#0c0608'], [.45, '#2a0c14'], [.8, '#4a1420'], [1, '#6a2030']],   // 너클시티 지하 에너지 플랜트: 검붉게 달아오른 지하
  heart: [[0, '#08020a'], [.4, '#2a0614'], [.75, '#5a0a20'], [1, '#8a1a30']]    // 블랙나이트의 심장: 반응로의 핏빛
};
// ---------------- 유대의 불꽃 (하나 시초의 방 → 가라르 블랙나이트의 심장) ----------------
const BOND_GOLD = 0xffc040, BOND_CRIMSON = 0xff3a4a;
const ARCEUS_LINES = [
  "그대의 가슴속에서 타오르는 그 따뜻한 빛... 그래, 전설의 트레이너 '레드'가 붙잡히기 직전 너희 포켓몬들에게 나누어 주었던 『유대의 불꽃』이로구나! 그 불꽃이 있었기에 그대가 지금까지 심연에 물든 신들을 정화할 수 있었던 것이다.",
  '이제 너희가 키워낸 그 유대의 불꽃이 완전체에 가까워졌다. 내 창조의 힘으로 가라르 심연의 결계를 열어주마. 허나 조심하라... 무한다이노의 코어 뒤편에는 무한다이노마저 숙주로 삼은 차원 너머의 진짜 배후, 『심연의 지배자(아비스 네크로즈마)』가 도사리고 있다. 어서 가서 레드에게 그 불꽃을 돌려주고 세상을 구원하라!'
];
const BOND_CAPTION = '레드가 우리에게 나누어 주었던 유대의 불꽃이... 모든 정화의 여정을 거쳐 다시 레드에게로 돌아간다!';
const RED_LINE = '...내가 남겼던 작은 불씨를 이렇게 거대한 태양으로 키워서 돌려주었구나. 고맙다, 친구들아! 이제 우리 모두의 유대의 불꽃을 하나로 합쳐 저 흑막을 완전히 불태워버리자!!';
const RED_THANKS = [
  '...끝났다. 네가 키워 낸 불꽃이 차원 너머의 심연까지 남김없이 태워 버렸어.',
  '이 불꽃은 이제 너의 것이다. 어느 지방을 여행하든, 늘 네 곁에서 타오를 거야.',
  '자, 돌아가자. 모두가 기다리는 맑은 하늘 아래로!'
];
const MEWTWO_LINES = ['나를 조종하던 붉은 사슬은 가라르의 무한다이노에게서 뻗어 나온 것... 레드는 아직 살아있다. 너의 유대의 불꽃을 더 키워라.'];
const CYNTHIA_LINES = [
  '…정신이 드는 것 같아. 너희가 날 붙잡아 준 거구나. 고마워.',
  '무한다이노와 그 배후 세력이 레드의 에너지를 이용해 창기둥의 시공간마저 비틀어버렸어. 네 안의 『유대의 불꽃』이 처음보다 훨씬 거대하고 눈부시게 타오르고 있네... 기라티나마저 정화한다면, 마침내 레드가 갇힌 심장부로 갈 길이 열릴 거야!'
];
// 빛나는 TM 코어 줍기 그림 (12×16): 보랏빛 유리 캡슐 · 금빛 심 · 위아래 금속 마개
function tmCoreTexture(scene) {
  if (scene.textures.exists('tmcore')) return;
  const t = scene.textures.createCanvas('tmcore', 12, 16), c = t.getContext(), F = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  F(2, 0, 8, 3, '#8a8494'); F(3, 0, 6, 1, '#d8d4e0'); F(2, 13, 8, 3, '#8a8494'); F(3, 15, 6, 1, '#4a4652');
  F(1, 3, 10, 10, '#3a1a6a'); F(2, 3, 8, 10, '#6a3ad0'); F(3, 4, 2, 8, '#b08aff'); F(5, 6, 3, 4, '#ffd25a'); F(6, 7, 1, 2, '#ffffff'); F(9, 4, 1, 8, '#2a1050');
  t.refresh();
}
const BOND_ATK = .03;   // 유대의 불꽃 정화 단계마다 모든 공격 피해 +3% (Combat.damageEnemy)
const TEST_SEED = 4242;   // 테스트 모드의 실제 지방 맵 시드 (지방마다 + ci — 늘 같은 지형으로 검수)
const LEGEND_GHOSTS = ['mewtwo', 'ho-oh', 'rayquaza', 'dialga', 'palkia', 'giratina-origin', 'zekrom', 'reshiram', 'arceus'];   // 시네마틱에 나오는 정화한 전설들의 환영 (시트가 있는 것만)
// 긴 대사를 대화창 한 쪽(약 n 글자)씩 문장 단위로 나눈다
function pagesOf(text, n = 90) {
  const out = [];
  for (const s of text.match(/[.!?…]*[^.!?…]+(?:[.!?…]+|$)\s*/g) || [text]) {
    const t = s.trim(), last = out[out.length - 1];
    if (!t) continue;
    if (last && last.length + t.length + 1 <= n) out[out.length - 1] = `${last} ${t}`; else out.push(t);
  }
  return out.length ? out : [text];
}
function regionSkyTexture(scene, kind) {
  const key = 'fx:sky:' + kind;
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, 4, 128), c = t.getContext(), g = c.createLinearGradient(0, 0, 0, 128);
  for (const [k, col] of SKY_STOPS[kind]) g.addColorStop(k, col);
  c.fillStyle = g; c.fillRect(0, 0, 4, 128); t.refresh();
  return key;
}
// 성운 (256×128 반복): 깨어진 세계는 보랏빛 · 청록 · 분홍 · 천계는 황금빛 · 은빛 · 연보라 구름 덩어리 + 별 알갱이
function nebulaTexture(scene, key = 'fx:nebula', cols = ['70,220,210', '170,90,255', '255,80,170']) {
  if (scene.textures.exists(key)) return key;
  const W = 256, H = 128, t = scene.textures.createCanvas(key, W, H), c = t.getContext();
  let seed = 5; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 18; k++) {
    const x = r() * W, y = r() * H, rad = 20 + r() * 46, col = cols[k % 3];
    for (const dx of [-W, 0, W]) { const g = c.createRadialGradient(x + dx, y, 0, x + dx, y, rad); g.addColorStop(0, `rgba(${col},.32)`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(x + dx - rad, y - rad, rad * 2, rad * 2); }
  }
  for (let k = 0; k < 70; k++) { c.fillStyle = r() < .5 ? 'rgba(255,255,255,.8)' : 'rgba(200,170,255,.7)'; c.fillRect(Math.floor(r() * W), Math.floor(r() * H), 1, 1); }
  t.refresh();
  return key;
}
// 정화된 전설이 두르는 기운 (restBoss): 빛 알갱이 색 · 몸을 감싸는 빛 두 겹 [색, 크기, 투명도] · 떠오를 높이 (아레나 바닥에서)
const REST_AURA = {
  giratina: { cols: [0xffd860, 0xe8eef8, 0xffffff], glow: [[0xffd860, 2.4, .38], [0xe8eef8, 1.7, .32]], lift: 120 },
  arceus: { cols: [0xffffff, 0xfff0b0, 0xffd870], glow: [[0xffffff, 2.8, .42], [0xffd870, 2, .34]], lift: 130 }
};
const PLATE_COLS = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'].map(t => typeColor(t));   // 아르세우스의 18 플레이트
// 눈발 (64×64 반복): 크고 작은 눈송이
function snowTexture(scene) {
  if (scene.textures.exists('fx:snow')) return;
  const t = scene.textures.createCanvas('fx:snow', 64, 64), c = t.getContext();
  for (let k = 0; k < 26; k++) { const x = (k * 29) % 64, y = (k * 41 + (k % 3) * 7) % 64, big = k % 5 === 0; c.fillStyle = big ? 'rgba(255,255,255,.95)' : 'rgba(235,242,255,.75)'; c.fillRect(x, y, big ? 2 : 1, big ? 2 : 1); }
  t.refresh();
}
// 두 색을 k(0~1)만큼 섞는다
const lerpColor = (a, b, k) => {
  const A = Phaser.Display.Color.IntegerToRGB(a), B = Phaser.Display.Color.IntegerToRGB(b);
  return Phaser.Display.Color.GetColor(Math.round(A.r + (B.r - A.r) * k), Math.round(A.g + (B.g - A.g) * k), Math.round(A.b + (B.b - A.b) * k));
};

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.test = !!(data && data.test);              // 테스트룸 (테스터 모드 · 로비의 「테스트룸」): game/TestRoom.js 의 빈 아레나 · 저장·도감에 남지 않는다
    this.resume = (data && data.resume) || null;   // 로비의 '이어하기': systems/RunSave.js 의 저장 내용
    this.partyKeys = this.resume ? this.resume.player.members.map(m => m.key) : data && data.party && data.party.length ? data.party : Save.data.party;
  }

  // 지연 로딩: 파티 계열 전체(진화·메가) + 이 챕터에 나올 포켓몬 시트를 다 받은 뒤 시작한다 (나머지는 Actor 가 필요할 때 받는다)
  preload() {
    const ci = this.resume ? this.resume.stageIdx : 0;
    Sprites.queue(this.load, [...this.partyKeys, ...chapterSprites(ci), 'corviknight']);
  }

  create() {
    {   // 화면 번쩍임 세기: 기술은 진화 단계만큼만 (skills.js skillFlash 가 flashA 를 정해 둔다) · 그 밖의 번쩍임은 60% (눈부심 방지)
      const cam = this.cameras.main, of = cam.flash.bind(cam);
      cam.flash = (ms, r, g, b, force, cb, ctx) => { if (force || !cam.flashEffect.isRunning) cam.flashEffect.alpha = cam.flashA ?? .6; cam.flashA = null; return of(ms, r, g, b, force, cb, ctx); };
    }
    this.stageIdx = 0;                     // 지금 챕터(지방) 번호
    this.worlds = [];                      // 챕터마다 한 번 만든 월드 (아머까오로 돌아오면 그대로)
    this.unlockedHubs = [];                // 들른 시내 = 아머까오 공중날기 목적지 { ci, roomId, name }
    this.lastCenter = null;                // 쓰러지면 다시 일어날 포켓몬센터
    this.runStats = { kills: 0, unlocked: [], start: this.time.now, items: 0, stage: 1 };
    this.seeds = [];                       // 챕터마다 지형 시드 (저장·이어하기에서 같은 지형을 다시 만든다)
    this.purifiedSet = new Set();          // 최종 보스를 정화해 침식이 걷힌 지방 (밝고 맑게 · 야생 포켓몬은 평화롭게 · 마을 사람 대사가 바뀐다)
    this.bondStages = new Set();           // 유대의 불꽃 정화 단계: 침식의 핵(지방 최종 보스 · 가라르는 무한다이노)을 정화한 지방 — bondStage
    const rs = this.resume;
    this.savedWorlds = rs ? rs.worlds.slice() : null;   // 챕터마다 저장해 둔 바뀐 것 (worldOf 가 그 챕터를 만들 때 덮어쓴다)
    if (rs) {
      this.stageIdx = rs.stageIdx; this.seeds = rs.seeds.slice(); this.unlockedHubs = rs.hubs.slice(); this.lastCenter = rs.lastCenter;
      this.purifiedSet = new Set(rs.purified || []);
      this.bondStages = new Set(rs.bond || [...this.purifiedSet, ...(this.purifiedSet.has(4) ? [HEROES_KEY] : [])]);   // 이어하기: 정화한 만큼 유대의 불꽃도 자라 있다 (예전 저장: 정화한 지방 + 하나를 정화했으면 용나선탑 흑백 영웅)
      Object.assign(this.runStats, { kills: rs.stats.kills, unlocked: rs.stats.unlocked.slice(), items: rs.stats.items, start: this.time.now - rs.stats.time * 1000 });
    }
    if (this.test) { this.testOpt = { ci: 0, ai: 0, arena: null, tall: false }; this.testGod = false; this.testNoCd = false; this.testChain = false; this.dummy = null; this.testReal = false; this.testWorlds = []; this.testSkipTo = null; }   // testReal: 실제 지방 맵으로 워프해 있다 (testWorlds)
    this.webgl = this.renderer.type === Phaser.WEBGL;
    this.enemies = []; this.pickups = []; this.chests = []; this.worldObjs = []; this.wanderers = [];
    this.inp = {}; this.paused = false; this.transitioning = false; this.over = false; this.cleaned = false;
    this.dynLights = 0;
    this.keys = this.input.keyboard.addKeys('ONE,TWO,THREE,ESC,P,F2,F3,F4,N' + (this.test ? ',T,F1' : ''));   // 바꿀 수 없는 키 (나머지는 설정 → 키 설정, bindKeys) · 테스트룸은 T 패널 · F1 카드 샌드박스
    this.bindKeys();
    const offKeys = Settings.on(k => { if (k === 'keys') this.bindKeys(); });
    this.events.once('shutdown', offKeys);
    this.input.keyboard.addCapture('TAB,SPACE,UP,DOWN,LEFT,RIGHT,F2,F3,F4' + (this.test ? ',F1' : ''));   // F1: 브라우저 도움말 대신 카드 샌드박스
    this.input.keyboard.on('keydown', () => Sfx.unlock());
    this.input.on('pointerdown', () => Sfx.unlock());

    const cam = this.cameras.main;
    cam.setZoom(ZOOM * RES).setBackgroundColor('#07060f').setRoundPixels(true);
    if (this.webgl) {
      this.lights.enable();
      this.applyPerf();   // 블룸: 절전 모드면 끈다 (systems/Perf.js)
      const offPerf = Perf.on(() => this.applyPerf());
      this.events.once('shutdown', offPerf);
      this.vignetteFx = cam.postFX.addVignette(.5, .5, .98, .18);   // 화면 가장자리에만 은은하게 · 보스방에 가까울수록 조금 진해진다 (updateAtmosphere)
      this.gradeFx = cam.postFX.addColorMatrix();                   // 색 보정: 초입은 따뜻하고 선명하게 · 보스 앞은 채도가 빠지고 어둡게
    }
    this.fx = new Fx(this);
    this.corruptG = this.add.graphics().setDepth(18);                                          // 세뇌된 적 발밑 침식 오라
    this.eyeTrailG = this.add.graphics().setDepth(23).setBlendMode(Phaser.BlendModes.ADD);     // 붉은 안광 궤적
    this.combat = new Combat(this);
    this.buildWorld(rs ? rs.pos : null);
    if (rs) {
      restorePlayer(this.player, rs.player); this.resume = null;
      if (rs.player && rs.player.quests && rs.player.quests.tut == null) this.player.quests.tut = TUT_DONE;   // 예전 진행 저장: 강제 실습 튜토리얼은 이미 지난 것으로
      if (rs.drops && rs.drops.ci === this.stageIdx) for (const d of rs.drops.list || []) this.spawnPickup(d.kind, d.x, d.y - 4, d.id, true);   // 줍지 않고 저장했던 드랍을 그 자리에
    }
    else if (!this.test && Save.data.bondFlame) this.time.delayedCall(1500, () => {   // 진 엔딩을 본 뒤의 새 여정: 레드의 유대의 불꽃을 처음부터 지닌다
      if (!this.player || this.over) return;
      this.player.addItem('core_red_bond');
      this.events.emit('toast', '🔥 레드의 유대의 불꽃이 함께한다 — 진 엔딩의 유물 (장착 · 가방)', 'core_red_bond');
    });
    if (!rs && !this.test && this.stageIdx === 0) this.time.delayedCall(1100, () => this.openingTalk());   // 🎬 새 여정: 오박사가 먼저 말을 건다
    if (!rs && !this.test && this.stageIdx === 0 && this.player.quests.tut == null) this.player.quests.tut = 0;   // 🎓 새 여정: 연구소의 강제 실습 튜토리얼부터 (game/Tutorial.js)
    this.setupTutorial();
    this.scene.launch('UI');
    this.scene.bringToTop('UI');
    cam.fadeIn(350, 7, 6, 15);
    this.events.once('shutdown', () => this.cleanup());
    if (this.test) this.testBegin();
    Perf.arm(15000);   // 게임 시작 직후 15초 안에 튕기면 다음 접속은 안전 모드
  }

  // 그래픽 최적화 반영: 블룸(전체 화면을 여러 번 흐리는 후처리)은 절전 모드에서 끈다 · 나머지 연출은 그대로
  applyPerf() {
    const cam = this.cameras.main;
    if (!this.webgl || !cam.postFX) return;
    if (Perf.bloom && !this.bloomFx) { this.bloomFx = cam.postFX.addBloom(0xffffff, 1, 1, 1.1, .85, 2); }
    else if (!Perf.bloom && this.bloomFx) { cam.postFX.remove(this.bloomFx); this.bloomFx = null; }
  }

  // ---------------- 월드 구성 ----------------
  // 챕터(지방) 하나 = 메트로배니아식 2D 월드 (game/World.js). 한 번 만든 챕터는 기억해 두고, 아머까오로 돌아오면 그대로 다시 깐다
  //  (부순 벽 · 연 상자 · 정화한 보스 · 걷힌 흙 · 주운 상처약 · 탐험한 칸). 적은 들어올 때마다 다시 나온다.
  //  at: { x, y } 도착 자리 (없으면 챕터 입구)
  //  지형은 챕터 시드로 만든다 (같은 시드 = 같은 지형). 이어하기면 저장해 둔 바뀐 것(연 상자·정화한 보스 등)을 덮어쓴다
  worldOf(ci) {
    if (this.test && this.testReal) return this.testWorlds[ci] || (this.testWorlds[ci] = { seed: TEST_SEED + ci, level: seeded(TEST_SEED + ci, () => buildChapter(STAGES[ci], ci)), explored: null, areasSeen: new Set(), purified: false });   // 테스트 모드 워프: 실제 지방 맵 (저장 · 도감 · 보상 없음)
    if (this.worlds[ci]) return this.worlds[ci];
    if (this.test) return (this.worlds[ci] = { seed: 0, level: buildTestRoom({ ...this.testOpt, ci }), explored: null, areasSeen: new Set(STAGES[ci].areas.map((a, i) => i)), purified: true });   // 테스트룸: 밝고 맑은 빈 아레나
    const seed = this.seeds[ci] ?? (this.seeds[ci] = newSeed());
    const W = { seed, level: seeded(seed, () => buildChapter(STAGES[ci], ci)), explored: null, areasSeen: new Set(), purified: this.purifiedSet.has(ci) };
    const saved = this.savedWorlds && this.savedWorlds[ci];
    if (saved && !applyWorld(W, saved)) { this.savedWorlds[ci] = null; W.reset = true; this.remapHubs(ci, W.level); }   // 게임이 바뀌어 지형이 달라졌으면 그 챕터는 처음 상태로
    return (this.worlds[ci] = W);
  }
  // 업데이트로 지형이 바뀐 챕터: 들른 시내(공중날기 정거장)를 이름으로 다시 찾아 잇는다 (없어졌으면 지운다) · 회복기 부활 자리는 풀린다
  remapHubs(ci, level) {
    this.unlockedHubs = this.unlockedHubs.filter(h => {
      if (h.ci !== ci) return true;
      const hub = level.hubs.find(q => q.name === h.name);
      if (hub) h.roomId = hub.room.id;
      return !!hub;
    });
    const c = this.lastCenter;
    if (c && c.ci === ci) { const h = !c.terminal && this.unlockedHubs.find(q => q.ci === ci); this.lastCenter = h ? { ci, roomId: h.roomId } : null; }
  }
  buildWorld(at = null) {
    this.clearWorld();
    const si = this.stageIdx, st = STAGES[si], W = this.worldOf(si), level = W.level;
    level.purified = !!W.purified;
    if (W.reset) { W.reset = false; if (at) at = this.lastCenter && this.lastCenter.ci === si ? this.hubPos(this.lastCenter) : null; }   // 지형이 바뀐 챕터에서 이어하면 시내 · 입구에서
    this.stage = st; this.runStats.stage = si + 1;
    // 다른 지방으로 건너가면: 지난 지방에서만 쓰던 시트는 내리고(파티 계열은 남긴다) 이 지방 포켓몬을 미리 받아 둔다
    // 잔상(보스 대시 고스트 · 풀 이미지)이 내려갈 시트를 든 채 남지 않게 — 시트를 내리기 전에 모두 돌려놓는다 (워프 · 공중날기로 결전 도중 지방을 넘을 때)
    if (this.fx && this.fx.pool) for (const o of this.children.list.slice()) if (o.pooled && !o.released && o.texture && o.texture.key.startsWith('sheet:')) this.fx.pool.release(o);
    if (this.player && this.spriteChapter !== si) Sprites.trim([...this.player.members.map(m => m.key), ...chapterSprites(si), 'corviknight']);
    this.spriteChapter = si;
    if (this.player) {
      const p = this.player;
      p.rebornUsed = false;   // 지방마다 부활 1번 (칠색조 코어)
      if (p.uses && p.uses.potion > p.potionMax) p.uses.potion = p.potionMax;   // 예전 저장(최대 3 ~ 5개)은 지금 소지 한도로
    }
    Sprites.ensure(chapterSprites(si));
    this.level = level;
    this.explored = W.explored || (W.explored = new Uint8Array(level.cols * level.rows));   // 지도: 화면에 한 번이라도 들어온 칸
    this.exploredKey = '';
    // 방마다 작은 타일 지도 (빈 셀까지 큰 지도 하나로 만들면 타일 객체가 너무 많아진다)
    this.layers = [];
    //  결전장 부유섬 (game/Arenas.js r.isleCells): 아래에서 뚫고 오르는 통과 지형 — 'x,y' → true 윗면 · false 몸통
    level.pass = new Map();
    for (const r of level.rooms) for (const [x, y, top] of r.isleCells || []) level.pass.set(x + ',' + y, !!top);
    for (const r of level.rooms) {
      const tsKey = st.areas[r.ai] && st.areas[r.ai].palette ? `tiles:${si}:${r.ai}` : `tiles:${si}`;   // 그 지역만 다른 타일 색 (하나의 천계 — systems/Textures.js)
      const map = this.make.tilemap({ data: level.data.slice(r.Y0, r.Y1).map(row => row.slice(r.X0, r.X1)), tileWidth: TILE, tileHeight: TILE });
      const ts = map.addTilesetImage(tsKey, tsKey, TILE, TILE, TILE_MARGIN, TILE_SPACING);   // 테두리를 복제해 둔 타일셋 (하얀 실선 방지 — systems/Textures.js)
      const layer = map.createLayer(0, ts, r.X0 * TILE, r.Y0 * TILE).setDepth(10);
      layer.forEachTile(t => {
        if (PLAT_SET.has(t.index)) t.setCollision(false, false, true, false);   // 통과 발판: 위에서만 밟힌다
        else if (t.index >= 0) {
          const ps = level.pass.get((t.x + r.X0) + ',' + (t.y + r.Y0));
          if (ps === true) { t.setCollision(false, false, true, false); t.oneWay = true; }   // 부유섬 윗면: 통과 발판처럼 (↓ + Space 로 내려간다)
          else if (ps === false) t.setCollision(false, false, false, false);                // 부유섬 몸통: 머리 · 몸이 막히지 않고 지나간다
          else t.setCollision(true, true, true, true);
        }
      });
      if (this.webgl) layer.setPipeline('Light2D');
      r.map = map; r.ts = ts; r.layer = layer;
      this.layers.push(layer);
      // 보스 결전장: 방 한 장을 보스마다 다른 재질로 구운 그림 (systems/ArenaArt.js) — 타일 지도는 충돌만 맡고 숨긴다 (부서지는 벽 칸만 보인다)
      r.arenaImg = null;
      if (r.arenaStyle) {
        r.arenaKey = bakeArenaTiles(this, level, r);
        const img = this.add.image(r.X0 * TILE, r.Y0 * TILE, r.arenaKey).setOrigin(0).setDepth(10);
        if (this.webgl) img.setPipeline('Light2D');
        layer.forEachTile(t => { if (t.index >= 0 && level.grid[t.y + r.Y0][t.x + r.X0] !== 'B') t.setVisible(false); });
        r.arenaImg = img; this.worldObjs.push(img);
      }
    }
    this.tintRooms();
    if (this.webgl) this.lights.setAmbientColor(st.palette.ambient);
    this.ambient = Phaser.Display.Color.ValueToColor(st.palette.ambient).clone();
    // 방 사이 빈 셀은 단단한 암반 (오돌토돌한 점) · 지하 방 안쪽엔 동굴 벽 배경
    const rock = this.add.graphics().setDepth(1.5), rc = shade(st.palette.wall2, .55);
    const rockCell = (g, cx, cy) => {
      const x0 = cx * CW * TILE, y0 = cy * CH * TILE;
      g.fillStyle(rc, 1); g.fillRect(x0, y0, CW * TILE, CH * TILE);
      for (let k = 0; k < 40; k++) { g.fillStyle(k % 3 ? shade(rc, 1.25) : shade(rc, .7), 1); g.fillRect(x0 + ((k * 97 + cx * 31) % (CW * TILE)), y0 + ((k * 61 + cy * 17) % (CH * TILE)), 2, 2); }
    };
    for (let cy = 0; cy < level.ncy; cy++) for (let cx = 0; cx < level.ncx; cx++) if (!level.cellRoom.has(cx + ',' + cy)) rockCell(rock, cx, cy);
    // 오박사 연구소(+ 지하의 튜토리얼 기술머신 굴)는 닫힌 실내: 밖에 있을 땐 그 자리를 암반으로 덮어 벽 너머로 비치지 않게 (updateLabCover)
    this.labCover = null;
    const indoor = level.rooms.filter(r => r.lab || (r.tutorial && r.doors.some(d => d.U && d.U.lab)));
    if (indoor.length) {
      const g = this.add.graphics().setDepth(15);
      for (const r of indoor) for (let cy = r.gy; cy < r.gy + r.gh; cy++) for (let cx = r.gx; cx < r.gx + r.gw; cx++) rockCell(g, cx, cy);
      this.labCover = { g, rooms: indoor };
      this.worldObjs.push(g);
    }
    // 건물 출입문(포털)로 이어진 두 방 (방울탑 정문 마당 ↔ 탑 안 1층): 한쪽에 있을 땐 다른 쪽을 암반으로 덮는다 — 벽 너머로 비치지 않는 독립된 던전
    this.portalCovers = [];
    for (const r of level.rooms) if (r.portalTo) for (const [show, hide] of [[r, r.portalTo], [r.portalTo, r]]) {
      const g = this.add.graphics().setDepth(15).setVisible(false);
      for (let cy = hide.gy; cy < hide.gy + hide.gh; cy++) for (let cx = hide.gx; cx < hide.gx + hide.gw; cx++) rockCell(g, cx, cy);
      this.portalCovers.push({ g, when: show, hide });
      this.worldObjs.push(g);
    }
    // 출입문 · 균열로만 들어가는 독립된 세계 (창기둥 안 · 깨어진 세계): 안에 있을 땐 둘레의 바깥 방을, 밖에 있을 땐 그 안을 암반으로 덮는다 (둘레 2셀까지만 — 화면에 걸리는 곳)
    this.realmCovers = [];
    for (const key of ['spear', 'distortion', 'spiral', 'origin', 'plantHeart']) {
      const realm = new Set(level.rooms.filter(r => r[key]));
      if (!realm.size) continue;
      const cellsOf = r => { const out = []; for (let cy = r.gy; cy < r.gy + r.gh; cy++) for (let cx = r.gx; cx < r.gx + r.gw; cx++) out.push([cx, cy]); return out; };
      const inCells = [...realm].flatMap(cellsOf), near = (cx, cy) => inCells.some(([x, y]) => Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2);
      const inside = this.add.graphics().setDepth(15).setVisible(false), outside = this.add.graphics().setDepth(15).setVisible(false);
      for (const r of level.rooms) for (const [cx, cy] of cellsOf(r)) { if (realm.has(r)) rockCell(outside, cx, cy); else if (near(cx, cy)) rockCell(inside, cx, cy); }
      this.realmCovers.push({ realm, inside, outside });
      this.worldObjs.push(inside, outside);
    }
    // 위아래 철창 통로(방 바닥 밑 땅을 뚫은 갱도) 뒤엔 어두운 흙벽 — 먼 하늘이 비쳐 보이지 않게
    for (const d of level.doors) if (d.dir === 'v' && !d.sealed) { const xs = d.cells.map(c => c[0]), ys = d.cells.map(c => c[1]); rock.fillStyle(shade(st.palette.wall2, .4), 1); rock.fillRect(Math.min(...xs) * TILE, Math.min(...ys) * TILE, (Math.max(...xs) - Math.min(...xs) + 1) * TILE, (Math.max(...ys) - Math.min(...ys) + 1) * TILE); }
    this.worldObjs.push(rock);
    for (const r of level.rooms) if (r.under) this.worldObjs.push(this.add.tileSprite(r.left - 32, r.top - 32, r.right - r.left + 64, r.bottom - r.top + 64, `bgcave:${si}`).setOrigin(0).setDepth(2));
    // 상처약·페이크 굴: 안쪽엔 어두운 흙벽을 깔고, 들어서기 전까지는 흙 타일로 덮어 둔다 (환영 벽 너머 숨은 굴)
    this.covers = [];
    const back = this.add.graphics().setDepth(9.5);
    for (const sd of level.sides) {
      for (const [x, y] of sd.cells) {
        back.fillStyle(0x15111c, 1); back.fillRect(x * TILE, y * TILE, TILE, TILE);
        for (let k = 0; k < 3; k++) { back.fillStyle(k ? 0x1d1826 : 0x0c0a12, 1); back.fillRect(x * TILE + ((x * 7 + y * 3 + k * 5) % 14), y * TILE + ((x * 3 + y * 11 + k * 7) % 14), 2, 2); }
      }
      if (sd.revealed) continue;
      const layers = new Map();
      for (const [x, y] of sd.cells) {
        const r = level.cellRoom.get(Math.floor(x / CW) + ',' + Math.floor(y / CH));
        if (!r || !r.map) continue;
        if (x < r.X0 || y < r.Y0 || x - r.X0 >= r.map.width || y - r.Y0 >= r.map.height) continue;   // 방 지도 밖으로 삐져나온 굴 칸 (가끔 생긴다) — 덮지 않고 넘어간다
        let cl = layers.get(r);
        if (!cl) { cl = r.map.createBlankLayer(`cover${this.covers.length}_${r.id}`, r.ts, r.X0 * TILE, r.Y0 * TILE).setDepth(10.2); if (this.webgl) cl.setPipeline('Light2D'); layers.set(r, cl); }
        cl.putTileAt(TILE_ID.SOLID, x - r.X0, y - r.Y0);
      }
      this.covers.push({ sd, layers: [...layers.values()] });
    }
    this.worldObjs.push(back);
    // 부서지는 벽: 금 간 자국 (공격·투사체로 3번 치면 무너진다)
    this.breakG = this.add.graphics().setDepth(10.4);
    this.worldObjs.push(this.breakG);
    this.drawBreakables();
    this.props = new Props(this, level, st, si);
    this.npcs = new Npcs(this, level, this.props);   // 마을 사람들 · 오박사 (말을 걸면 대화창)
    this.side = level.purified || this.test ? null : new SideRooms(this, level, this.sideRoomsOf(level));   // ✨ 샛길 정화 구역: 침식 덩굴 · 안개 / 정화한 방은 성역
    const hooh = level.test ? null : level.rooms.find(r => r.boss === 'ho-oh' && r.type === 'boss');
    this.altar = hooh ? new HoohAltar(this, hooh) : null;   // 🌈 방울탑 최상층 삼색 방울의 제단: 성수의 구슬 셋을 바쳐야 칠색조가 강림한다
    //  🌀 이미 정화한 지방 관문(조력자 · 다음 지방 포털)은 이 함수 끝에서 — 보스 · 포털 상태 초기화 뒤에 (예전엔 만든 포털을 곧바로 지워 빛만 남은 '죽은 포털'이 됐다)
    this.physics.world.setBounds(0, 0, level.width, level.height + 200);

    // 패럴랙스 배경 (보스전에서 가장 멀리 당긴 줌 기준으로도 화면을 채우도록 배치)
    const cw = this.cameras.main.width, ch = this.cameras.main.height, z = ARENA_ZOOM * RES;
    const vw = cw / z + 24, vh = ch / z + 24, ox = cw / 2 - vw / 2, oy = ch / 2 - vh / 2;
    this.bgFar = this.add.tileSprite(ox, oy, vw, vh, `bgfar:${si}`).setOrigin(0).setScrollFactor(0).setDepth(0);
    this.worldObjs.push(this.bgFar);
    daySkyTexture(this);   // 맑은 하늘: 침식이 옅은 곳(첫 지역 · 정화한 지방)에서 먼 배경 위를 덮는다
    this.daySky = this.add.image(ox, oy, 'fx:daysky').setOrigin(0).setDisplaySize(vw, vh).setScrollFactor(0).setDepth(.5).setAlpha(0);
    this.worldObjs.push(this.daySky);
    // 중경은 지역 배경 종류마다 한 장씩 깔아 두고, 지역을 넘을 때 겹쳐 바꾼다
    this.bgMids = {};
    for (const kind of new Set(st.areas.map(a => a.bg || 'default'))) {
      const t = this.add.tileSprite(ox, oy, vw, vh, `bgmid:${si}:${kind}`).setOrigin(0).setScrollFactor(0).setDepth(1).setAlpha(0);
      this.bgMids[kind] = t; this.worldObjs.push(t);
    }
    this.buildRegionSkies(ox, oy, vw, vh);
    this.areaIdx = -1; this.areasSeen = W.areasSeen;

    // 관문: 아레나(중간 보스 · 최종 보스 · 히든 성소)의 문마다 하나. 보스전이 시작되면 닫히고, 정화하면 열린다
    this.gateGroup = this.physics.add.staticGroup();
    this.gateG = this.add.graphics().setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    this.worldObjs.push(this.gateG);
    this.gates = [];
    for (const r of level.rooms) if (!r.cleared && (r.type === 'mini' || r.type === 'boss' || r.type === 'sanctuary')) this.addArenaGates(r);

    // 횃불(네온 수정) + 광원
    this.torches = [];
    for (const r of level.rooms) for (const t of r.torches) {
      const glow = this.add.image(t.x, t.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(st.palette.light).setScale(.6).setAlpha(.7).setDepth(11);
      const crystal = this.add.rectangle(t.x, t.y, 3, 6, st.palette.accent).setDepth(11);
      const light = this.webgl ? this.lights.addLight(t.x, t.y + 10, 130, st.palette.light, 1.3) : null;
      this.torches.push({ glow, crystal, light, phase: Math.random() * 10, room: r });
      this.worldObjs.push(glow, crystal);
    }
    this.colorTorches();

    // 보물 상자 · 상처약 (연 상자·주운 약은 그대로 남아 있다)
    for (const c of level.chests) this.spawnChest(c);
    for (const pt of level.potions) {
      if (pt.taken) continue;
      const pk = this.spawnPickup('potion', pt.x, pt.y - 10, null, true), sd = level.sides.find(q => q.room === pt.room);
      pk.mark = pt; pk.hiddenBy = sd;
      if (sd && !sd.revealed) { pk.img.setVisible(false); pk.glow.setVisible(false); }   // 흙이 걷히기 전엔 안 보인다
    }

    // 플레이어 — 이어하기 자리가 바위 속이면(지형이 바뀐 예전 저장: 모험 보상 지형의 비밀 벽 · 둥지 천장 등) 같은 방의 가장 가까운 빈 땅으로
    const pos = at ? this.freeStand(level, at) : level.start;
    if (!this.player) {
      this.player = new Player(this, this.partyKeys, pos.x, pos.y);
      if (this.webgl) this.playerLight = this.lights.addLight(pos.x, pos.y, 150, 0xffffff, 1.5);
    } else {
      this.player.b.reset(pos.x, pos.y); this.player.b.setVelocity(0, 0);
    }
    this.playerColliders = [
      this.physics.add.collider(this.player.obj, this.layers, null, (o, tile) => !((PLAT_SET.has(tile.index) || tile.oneWay) && this.player.dropT > 0)),
      this.physics.add.collider(this.player.obj, this.gateGroup)
    ];
    this.ensureTrialGuardian();

    const cam = this.cameras.main;
    this.room = roomAt(level, pos.x, pos.y - 4) || level.start.room;
    cam.setBounds(...this.camBounds());
    this.updateLabCover();
    cam.startFollow(this.player.obj, true, .14, .16);
    cam.setFollowOffset(0, 10);
    cam.centerOn(pos.x, pos.y);
    for (const sp of level.spawns) sp.spawned = false;   // 챕터에 들어올 때마다 적이 다시 나온다
    this.boss = null; this.bosses = []; this.lowSeen = false;   // 포털은 앞 지방을 치울 때(clearWorld) 이미 지웠다
    if (!this.test) for (const r of level.rooms) if (r.cleared && this.gateOf(r, level)) this.chapterGate(r, false);   // 🌀 이미 정화한 지방 관문: 조력자 · 다음 지방 포털 그대로 (이어하기 · 공중날기로 돌아와도)
    this.events.emit('stage', si, st);
    Music.play(st.bgm);
    this.buildBossProps();
    this.time.delayedCall(450, () => { if (this.level === level) { this.enterArea(this.room, true); if (this.room.type === 'village') this.visitHub(this.room); } });
    if (this.tutorial !== undefined) this.setupTutorial();   // 지방을 옮겨 다시 지을 때 (처음 지을 땐 create 가 진행 저장을 되살린 뒤에 부른다)
  }
  // 🎓 실전 체험형 강제 조작 튜토리얼 (game/Tutorial.js): 관동 연구소 · 아직 다 마치지 않은 새 모험에서만
  setupTutorial() {
    if (this.tutorial) this.tutorial.destroy();
    this.tutorial = ActionTutorial.wanted(this) ? new ActionTutorial(this) : null;
  }

  // ---------------- 침식 (Room.depth 0 입구 ~ 1 보스방 앞) · 지방 정화 ----------------
  // 방의 침식 깊이 (정화한 지방은 어디든 0)
  depthOf(room) {
    if (!room || (this.level && this.level.purified) || room.trail || room.seaBridge || room.isPurified) return 0;   // 방울로드: 가을 햇살 · 131번 수로: 85% 밤바다 · ✨ 정화한 샛길 구역: 95 ~ 100% 따뜻한 빛
    const d = room.depth || 0;
    if (room.tower || room.pillar) return Math.min(.45, d);   // 방울탑 안: 횃불로 은은하게 · 하늘기둥 안: 벽 틈 채광
    if (room.stratosphere) return Math.min(.3, d);   // 성층권: 별빛
    if (room.snowPeak) return Math.min(.12, d);   // 천관산 만년설 협곡 · 창기둥 정문 앞: 85% 하얀 설산
    if (room.spear) return Math.min(.2, d);   // 창기둥 안: 80% 흰 대리석 · 결정빛
    if (room.distortion) return Math.min(.25, d);   // 깨어진 세계: 75% — 어둡지 않은 성운빛
    if (room.icirrus) return Math.min(.12, d);   // 설화시티 겨울 습지: 85% 은빛 설원
    if (room.spiral) return Math.min(.2, d);   // 용나선탑 안: 80% 백열 불꽃 · 푸른 뇌전
    if (room.azure) return 0;   // 천계의 피리 공명로: 95% 눈부신 성역
    if (room.origin) return Math.min(.1, d);   // 시초의 방
    if (room.plant) return Math.min(.25, d);   // 너클시티 지하 에너지 플랜트: 75% · 검붉은 파이프 · 홀로그램
    if (room.plantHeart) return Math.min(.3, d);   // 블랙나이트의 심장
    return d;
  }
  // 화면 분위기(비네팅 · 채도 · 주변광 · 포자)에 쓰는 침식 깊이: 아직 정화하지 않은 샛길 구역은 검붉은 침식이 짙게 깔려 있다 (몹 세기는 depthOf 그대로)
  atmoDepthOf(room) {
    const d = this.depthOf(room);
    return this.isSideRoom(room) && !room.isPurified && !(this.level && this.level.purified) ? Math.max(d, SIDE_GLOOM) : d;
  }
  // 몹의 침식 단계 Ⅰ~Ⅳ: 보스방에 가까울수록 높다
  corruptLevel(room) { const d = this.depthOf(room); return d < .25 ? 1 : d < .5 ? 2 : d < .75 ? 3 : 4; }
  // 타일 색: 초입은 햇살처럼 따뜻하게 → 중간은 본래 색 → 보스방 앞은 보랏빛 잿빛으로 가라앉는다 (정화한 지방은 맑게)
  tintRooms() {
    for (const r of this.level.rooms) {
      if (!r.layer) continue;
      const d = this.depthOf(r);
      let t = d < .4 ? lerpColor(0xfff0d8, 0xffffff, d / .4) : lerpColor(0xffffff, 0xa088a8, (d - .4) / .6);
      if (r.snowPeak || r.icirrus) t = 0xeef4ff; else if (r.spear) t = 0xf4f0ff; else if (r.distortion) t = 0xd8c4ff;   // 신오 · 하나: 눈빛 · 대리석 · 반물질의 보랏빛
      else if (r.spiral) t = 0xf0ecf4; else if (r.azure || r.origin) t = 0xfffaf0;   // 용나선탑 회랑 · 천계의 백금빛
      else if (r.plant) t = 0xffe8ec; else if (r.plantHeart) t = 0xffd8e0;   // 가라르 지하: 검붉은 반사광
      r.layer.forEachTile(tile => { tile.tint = t; });
      if (r.arenaImg) r.arenaImg.setTint(lerpColor(t, 0xffffff, .75));   // 결전장 그림은 제 색을 살린다
    }
  }
  // 횃불(네온 수정) 색: 초입은 따뜻한 등불 → 지방 고유의 빛 → 보스방 앞은 독기 어린 보라 · 핏빛 (정화하면 다시 따뜻하게)
  colorTorches() {
    const L = this.stage.palette.light;
    for (const tc of this.torches) {
      const d = this.depthOf(tc.room);
      const col = d < .35 ? lerpColor(0xffd08a, L, d / .35) : d < .7 ? lerpColor(L, 0xb05aff, (d - .35) / .35) : lerpColor(0xb05aff, 0xff2a4a, (d - .7) / .3);
      tc.glow.setTint(col); tc.crystal.setFillStyle(lerpColor(col, 0xffffff, .35));
      if (tc.light) tc.light.setColor(col);
    }
  }
  // 지방 정화: 최종 보스를 정화하면 그 지방 전체의 침식이 걷힌다 — 빛의 물결 · 하늘이 맑아지고 · 남은 세뇌 포켓몬도 풀려난다
  //  상태는 진행 저장(RunSave 의 purified)에 남아, 아머까오로 다시 와도 밝고 맑은 그대로다 (야생은 평화롭게 거닐고 마을 사람 대사가 바뀐다)
  purifyRegion() {
    const si = this.stageIdx, W = this.worlds[si];
    if (!W || W.purified || this.over) return;
    W.purified = true; this.level.purified = true; this.purifiedSet.add(si);
    const p = this.player, cam = this.cameras.main;
    Sfx.play('purify_world');
    cam.flash(1100, 255, 248, 225, true);
    for (let k = 0; k < 6; k++) this.time.delayedCall(k * 200, () => { if (this.player) { this.fx.ring(p.x, p.y - 10, 120 + k * 110, k % 2 ? 0xfff4c0 : 0xb8ffd8, 1000); this.fx.glow(p.x, p.y - 10, 90 + k * 40, 0xfff4d0, 600, .5); } });
    this.fx.burst(p.x, p.y - 20, [0xfff4c0, 0xffffff, 0xb8ffd8, 0xffd27a], 60, 220, { glow: true, up: 120, grav: -30, bounce: false, life: 1.6 });
    for (const e of this.enemies) if (e.alive && !e.boss) {   // 남은 세뇌 포켓몬도 풀려난다 (보상은 없다)
      e.alive = false; (e.colliders || []).forEach(c => c.destroy()); e.colliders = []; e.b.enable = false;
      this.purify(e);
    }
    for (const sp of this.level.spawns) sp.spawned = false;   // 이제 그 자리엔 평화로운 야생 포켓몬이
    this.time.delayedCall(900, () => this.events.emit('banner', `${this.stage.region} 정화!`, '침식이 걷히고 하늘이 맑아졌다 · 마을 사람들을 다시 찾아가 보자'));
    const lvP = this.level;
    this.time.delayedCall(500, () => { if (this.level === lvP) this.repaintWorld(); });
    this.time.delayedCall(2400, () => { if (this.level === lvP) this.saveRun(true, 'purify'); });
  }
  // 정화한 지방을 다시 칠한다: 타일 · 횃불 · 소품(나무가 푸르게 · 풀이 연둣빛 · 균열이 사라짐) · 마을 사람
  repaintWorld() {
    if (!this.level || this.overlay === 'tm') { this.time.delayedCall(600, () => this.repaintWorld()); return; }
    this.tintRooms(); this.colorTorches();
    if (this.side && this.level.purified) { this.side.destroy(); this.side = null; }   // 지방 정화: 샛길 구역의 침식도 함께 걷힌다
    if (this.npcs) { this.npcs.destroy(); this.npcs = null; }
    if (this.props) this.props.destroy();
    this.props = new Props(this, this.level, this.stage, this.stageIdx);
    this.npcs = new Npcs(this, this.level, this.props);
  }
  // 정화한 지방의 평화로운 야생 포켓몬 (공격하지 않는다 · 공격 대상도 아니다)
  spawnWanderer(s) {
    let pk = pickWildStage(this.stage.pool, this.player.tierIdx);
    const { key, def } = wildForm(pk.line, pk.stage), gy = s.y;
    const w = new Wanderer(this, key, s.x, def.flying ? gy - rand(26, 40) : gy - 14, def);
    if (!def.flying) w.b.reset(s.x, gy - w.b.height / 2 - 1);
    if (!def.noclip) w.coll = this.physics.add.collider(w.obj, this.layers);
    this.wanderers.push(w);
  }

  // 새 지역에 들어서면: 배경을 겹쳐 바꾸고, 처음이면 할로우 나이트식 지역 타이틀
  enterArea(room, instant = false) {
    if (!room || room.ai === this.areaIdx) return;
    this.areaIdx = room.ai;
    const st = this.stage, area = st.areas[room.ai], kind = area.bg || 'default';
    for (const [k, t] of Object.entries(this.bgMids)) {
      this.tweens.killTweensOf(t);
      if (instant) t.setAlpha(k === kind ? .95 : 0);
      else this.tweens.add({ targets: t, alpha: k === kind ? .95 : 0, duration: 1100, ease: 'Sine.easeInOut' });
    }
    if (!this.arenaRoom && !this.over && !this.cinema) Music.play(area.bgm || st.bgm);   // 지역마다 다른 곡 (하나의 천계) — 보스전 · 연출 중엔 그대로
    if (kind === 'heart') Sprites.ensure(LEGEND_GHOSTS);   // 블랙나이트의 심장: 유대의 불꽃 시네마틱에 나올 정화한 전설들의 환영을 미리 받아 둔다
    if (this.areasSeen.has(room.ai)) return;
    this.areasSeen.add(room.ai);
    this.events.emit('area', { region: st.name, name: area.name, en: area.en, label: areaLabel(this.stageIdx, room.ai, area) });
  }

  // 유대의 불꽃 정화 단계 0~6 (HUD 불꽃 Lv = 단계 + 1, 최대 6 — UIScene · 모든 공격 피해 +BOND_ATK × 단계 — Combat)
  get bondStage() { return this.bondStages ? Math.min(6, this.bondStages.size) : 0; }
  get bondMul() {   // Lv.6 완전체 유대의 태양: 출전 중인 포켓몬 체력이 80% 이상이면 +15% 더 (data/bond.js)
    const m = this.player && this.player.m, sun = this.bondStage >= 6 && m && m.hp >= m.maxhp * BOND_SUN_HP;
    return 1 + BOND_ATK * this.bondStage + (sun ? BOND_SUN_ATK : 0);
  }
  // ⚠️ 붉은 안광(패링 불가) 중인 보스가 있다 (Boss.dangerOn) — 근접 · 장판 피해를 패링으로 받지 못한다 (Player.takeHit)
  get bossDanger() { return !!(this.enemies && this.enemies.some(e => e.boss && e.alive && e.danger)); }
  // 지금 방 지역의 곡 (지역마다 bgm 이 있으면 그것 · 없으면 지방 곡)
  areaBgm() { const a = this.room && this.stage.areas[this.room.ai]; return (a && a.bgm) || this.stage.bgm; }

  clearWorld() {
    const dropCollider = c => { if (c && c.world) c.destroy(); };   // 이미 해제된 충돌체는 건너뜀
    if (this.trainer) { this.trainer.destroy(); this.trainer = null; }
    this.endOverdrive(); this.cinema = false; this.storyWait = false; this.abyssTear = this.abyssSil = null;
    this.arenaRoom = null; this.chain = null;
    if (this.combat) this.combat.clearAll();
    for (const e of this.enemies) { (e.colliders || []).forEach(dropCollider); e.colliders = []; e.destroy(); }
    this.enemies = [];
    for (const w of this.wanderers || []) { dropCollider(w.coll); w.destroy(); }
    this.wanderers = [];
    if (this.corruptG && this.corruptG.scene) { this.corruptG.clear(); this.eyeTrailG.clear(); }
    for (const p of this.pickups) { dropCollider(p.coll); p.img.destroy(); p.glow.destroy(); }
    this.pickups = [];
    for (const c of this.chests) { c.img.destroy(); c.glow.destroy(); }
    this.chests = [];
    for (const o of this.worldObjs) o.destroy();
    this.worldObjs = []; this.sunbeams = null; this.rainSheet = this.weatherVeil = null; this.cloudSeas = []; this.cracks = [];
    this.regionSkies = {}; this.nebulae = null; this.nebulae2 = null; this.snowSheets = null; this.realmCovers = [];   // 햇빛 줄기도 worldObjs 와 함께 사라졌으니 새 월드에서 다시 만든다 (updateAtmosphere)
    if (this.portal) { this.portal.g.destroy(); this.portal.glow.destroy(); if (this.portal.core) this.portal.core.destroy(); this.portal = null; }
    this.portalNear = false; this.pickFocus = null; this.tip = null; this.pickRing = null;   // 툴팁 · 포커스 고리는 worldObjs 와 함께 사라졌다
    if (this.npcs) { this.npcs.destroy(); this.npcs = null; }
    if (this.props) { this.props.destroy(); this.props = null; }
    if (this.side) { this.side.destroy(); this.side = null; }
    if (this.altar) { this.altar.destroy(); this.altar = null; }
    this.altarRite = null;
    if (this.promptText) { this.promptText.destroy(); this.promptText = null; }
    if (this.torches && this.webgl) for (const t of this.torches) if (t.light) this.lights.removeLight(t.light);
    for (const bd of this.arenaDrops || []) bd.destroy();   // 조명 · 배경 텍스처 (그림은 위 worldObjs 로 이미 내렸다)
    this.arenaDrops = [];
    for (const r of (this.level && this.level.rooms) || []) if (r.arenaKey && this.textures.exists(r.arenaKey)) { this.textures.remove(r.arenaKey); r.arenaKey = null; }
    for (const c of this.cranes || []) { dropCollider(c.coll); c.zone.destroy(); }
    this.cranes = [];
    this.torches = [];
    if (this.playerColliders) { this.playerColliders.forEach(dropCollider); this.playerColliders = null; }
    if (this.tutorial) { this.tutorial.destroy(); this.tutorial = null; }   // 훈련 결계 몸체는 아래 gateGroup 과 함께
    if (this.gateGroup) { this.gateGroup.destroy(true); this.gateGroup = null; }
    this.gates = [];
    if (this.level) for (const r of this.level.rooms) { if (r.map) r.map.destroy(); r.map = r.layer = r.ts = null; }
    this.layers = [];
    this.covers = [];
    if (this.fx) this.fx.clearAll();   // 남은 파티클·파편은 풀로 돌려놓는다
    this.tmOpening = false;
    this.dropStaleTweens();
  }

  // 대상이 이미 사라진(destroy 된) 트윈 정리: 챕터를 오가며 쌓이지 않게
  dropStaleTweens() {
    if (!this.tweens) return;
    for (const tw of this.tweens.getTweens()) {
      const ts = tw.targets || [];
      if (ts.length && ts.every(o => o && typeof o.destroy === 'function' && !o.scene)) tw.remove();
    }
  }

  // 로비로 나가기 전에 한 번, 씬 종료 이벤트에서 한 번 더 불려도 안전하다
  cleanup() {
    if (this.cleaned) return;
    this.cleaned = true;
    Music.stop();
    this.clearWorld();
    if (this.player) { this.player.destroy(); this.player = null; }
    if (this.fx) { this.fx.pool.destroy(); this.fx.tpool.destroy(); }
    if (this.time) { this.time.removeAllEvents(); this.time.paused = false; }   // 쇼케이스 창이 열린 채 끝나도 다음 판 타이머가 멈춰 있지 않게
    this.joinQueue = []; this.joinCur = null; this.joinBlur = null;
    if (this.webgl && this.lights && this.lights.lights) this.lights.lights.slice().forEach(l => this.lights.removeLight(l));
    this.dynLights = 0;
    if (this.physics && this.physics.world) this.physics.world.resume();
    this.anims.resumeAll();
    if (this.tweens) this.tweens.resumeAll();
  }

  // 아레나 문마다 관문 (처음엔 열려 있다)
  addArenaGates(r) {
    for (const d of r.doors) {
      const rect = d.dir === 'h' ? { x: d.R === r ? r.left : r.right - 6, y: d.rect.y, w: 6, h: d.rect.h } : (d.D === r ? d.rectD : d.rectU);
      const g = this.gateGroup.create(rect.x + rect.w / 2, rect.y + rect.h / 2, 'px').setVisible(false).setDisplaySize(rect.w, rect.h).refreshBody();
      g.open = true; g.body.enable = false; g.room = r; g.rect = rect; g.vertical = d.dir === 'h';
      this.gates.push(g);
    }
  }
  // 아레나 문 닫기·열기
  setGates(room, open) {
    let changed = false;
    for (const g of this.gates) {
      if (g.room !== room || g.open === open) continue;
      g.open = open; g.body.enable = !open; changed = true;
      if (!open) this.fx.burst(g.rect.x + g.rect.w / 2, g.rect.y + g.rect.h / 2, this.stage.palette.edge, 10, 80, { glow: true });
    }
    if (changed && !open) Sfx.play('gate');
  }

  // ---------------- 타일 조회 도우미 (월드 격자 문자) ----------------
  cellAt(x, y) {
    const lv = this.level; if (!lv) return '.';
    const ty = Math.floor(y / TILE), tx = Math.floor(x / TILE);
    if (ty < 0) return '.';
    if (tx < 0 || tx >= lv.cols || ty >= lv.rows) return 'S';
    return lv.grid[ty][tx];
  }
  isSolidAt(x, y) { const c = this.cellAt(x, y); return c === 'S' || c === 'B'; }
  // 부유섬 칸 (true 윗면 · false 몸통 · undefined 아님)
  passAt(x, y) { const lv = this.level; return lv && lv.pass ? lv.pass.get(Math.floor(x / TILE) + ',' + Math.floor(y / TILE)) : undefined; }
  // 몸을 옆 · 아래에서 막는 벽인가 (부유섬은 아래 · 옆에서 뚫고 지나간다) — 모서리 자동 오르기(Player.ledgeAssist)가 쓴다
  isWallAt(x, y) { return this.isSolidAt(x, y) && this.passAt(x, y) === undefined; }
  // 위에서만 밟히는 칸인가 (통과 발판 · 집 지붕 · 부유섬 윗면)
  oneWayTopAt(x, y) { const c = this.cellAt(x, y); return c === 'P' || c === 'H' || this.passAt(x, y) === true; }
  isGroundAt(x, y) { const c = this.cellAt(x, y); return c === 'S' || c === 'B' || c === 'P' || c === 'H'; }
  standingOnPlatform(a) {
    const y = a.bottom + 2; let plat = false;
    for (const x of [a.b.x + 2, a.b.right - 2]) { const c = this.cellAt(x, y), ps = this.passAt(x, y); if (ps === true) { plat = true; continue; } if (c === 'S' || c === 'B') return false; if (c === 'P' || c === 'H') plat = true; }
    return plat;
  }
  groundBelow(x, y) {
    const gy = groundYAt(this.level, x, Math.max(0, y));
    return gy ?? y + 40;
  }
  // 아레나 바닥: 공용 아레나는 맨 아래 바닥 (공중 발판은 건너뛴다) · 보스 결전장(game/Arenas.js)은 높낮이가 있어 x 기둥의 단단한 땅 윗면
  //  from(월드 y)을 주면 그 높이부터 아래로 (그 칸이 땅 속이면 그 땅의 윗면) — 보스 공격이 플레이어가 선 층의 땅에서 솟게
  floorAt(x, room, from = null) {
    if (!room || !room.arenaStyle) return this.groundBelow(x, (room ? room.bottom : from ?? 0) - 24);
    const tx = Phaser.Math.Clamp(Math.floor(x / TILE), room.tx0, room.tx1 - 1);
    return solidRowAt(this.level.grid, room, tx, from == null ? room.ty0 : Math.floor(from / TILE)) * TILE;
  }

  // ---------------- 보스 결전장 (game/Arenas.js · systems/ArenaArt.js · systems/ArenaBackdrop.js) ----------------
  updateArenaDrops(dt) { for (const bd of this.arenaDrops || []) bd.update(dt); }
  // 턱 오르기: 결전장에서 걷다가 낮은 턱(플레이어 1칸 · 걷는 보스 2칸)에 막히면 그 위로 살짝 들어 올린다 — 지붕 비탈 · 단상 계단 · 사선 트러스를 걸어 오른다
  //  plat: 통과 발판 토막도 계단처럼 (플레이어만 — 보스는 통과 발판을 딛지 않는다)
  arenaStep(a, maxTiles, plat = true, r = this.room) {
    if (!r || !r.arenaStyle || !a || !a.b || !a.onGround || a.dropT > 0) return;
    const b = a.b, blocked = b.blocked.left || b.blocked.right, vx = Math.abs(b.velocity.x) > 20 ? b.velocity.x : blocked ? (a.lastVx || 0) : 0;
    if (Math.abs(vx) < 20) return;
    const G = this.level.grid, dir = vx > 0 ? 1 : -1, tx = Math.floor((dir > 0 ? b.right + 1 : b.x - 1) / TILE), fy = Math.floor((b.bottom - 1) / TILE);
    const cell = (x, y) => (G[y] && G[y][x]) || 'S', hard = c => c === 'S' || c === 'B';
    let h = 0;
    while (h <= maxTiles) { const c = cell(tx, fy - h); if (hard(c) || (plat && h === 0 && c === 'P')) h++; else break; }
    if (h === 0 || h > maxTiles) return;
    const nb = (fy - h + 1) * TILE, dy = b.bottom - nb, hb = Math.ceil(b.height / TILE);
    if (dy <= 0 || dy > maxTiles * TILE + 2) return;
    for (let x = Math.floor(b.x / TILE); x <= Math.max(tx, Math.floor((b.right - 1) / TILE)); x++) for (let y = fy - h; y > fy - h - hb; y--) if (hard(cell(x, y))) return;
    b.y -= dy + .5;
    if (Math.abs(b.velocity.x) < 20) b.setVelocityX(vx);
    b.blocked.left = b.blocked.right = false;
  }
  // 뮤츠 결전장의 사슬 크레인 발판: 위에서만 밟히는 움직이는 철판 (좌우로 오가며 올라탄 몸을 싣고 간다) · 천장 레일에서 사슬 두 줄이 늘어진다
  buildCranes(r) {
    this.cranes = this.cranes || [];
    for (const c of r.arena.cranes) {
      const w = c.w * TILE, y = c.y * TILE, a = c.a * TILE + w / 2, z = c.b * TILE + w / 2, x = a + (z - a) * (.5 + .5 * Math.sin(c.ph * Math.PI * 2)), railY = r.ty0 * TILE + 7;
      const zone = this.add.zone(x, y + 4, w, 8);
      this.physics.add.existing(zone);
      zone.body.setAllowGravity(false).setImmovable(true);
      zone.body.checkCollision.down = zone.body.checkCollision.left = zone.body.checkCollision.right = false;
      zone.body.setVelocityX(c.ph < .5 ? c.sp : -c.sp);
      const img = this.add.image(x, y, craneArt(this, c.w)).setOrigin(.5, 0).setDepth(10.1);
      const chains = [-1, 1].map(d => this.add.tileSprite(x + d * (w / 2 - 6), railY, 4, y - railY, chainArt(this)).setOrigin(.5, 0).setDepth(9.9));
      const hook = this.add.rectangle(x, railY, w + 6, 5, 0x5a6672).setDepth(9.95);
      if (this.webgl) { img.setPipeline('Light2D'); for (const ch of chains) ch.setPipeline('Light2D'); }
      const coll = this.physics.add.collider(this.player.obj, zone, null, () => !(this.player.dropT > 0) && this.player.b.velocity.y >= -1);
      this.cranes.push({ zone, img, chains, hook, coll, a, z, sp: c.sp, w });
      this.worldObjs.push(zone, img, hook, ...chains);
    }
  }
  updateCranes() {
    for (const c of this.cranes || []) {
      const b = c.zone.body;
      if (c.zone.x <= c.a && b.velocity.x <= 0) b.setVelocityX(c.sp); else if (c.zone.x >= c.z && b.velocity.x >= 0) b.setVelocityX(-c.sp);
      c.img.x = c.zone.x; c.hook.x = c.zone.x;
      c.chains[0].x = c.zone.x - (c.w / 2 - 6); c.chains[1].x = c.zone.x + (c.w / 2 - 6);
    }
  }
  // 깨어진 세계 반물질 심연 · 하늘기둥 구름바다 (결전장 바닥 F): 디디면 마지막으로 디딘 섬 · 제단으로 튕겨 올라온다 (최대 체력 8% · 잠깐 무적)
  //  문 앞 디딤 땅 · 바닥 철창 둘레는 안전하다
  abyssSafe(r) {
    if (r.abyssSafe) return r.abyssSafe;
    const out = [];
    for (const d of r.doors) {
      if (d.dir === 'h' && !d.virtual && (d.row + 1) * CH - 6 === r.F) out.push(d.R === r ? [r.X0 * TILE, (r.tx0 + 6) * TILE] : [(r.tx1 - 6) * TILE, r.X1 * TILE]);
      if (d.dir === 'v' && d.U === r && d.cap != null) out.push([(d.cap - 3) * TILE, (d.cap + 7) * TILE]);
    }
    for (const dd of this.level.doors) if (dd.portalIn && (dd.a === r || dd.b === r)) out.push([(dd.portalIn.x - 4) * TILE, (dd.portalIn.x + 5) * TILE]);
    return (r.abyssSafe = out);
  }
  updateAbyss() {
    const p = this.player, r = this.room;
    if (!p || !r || !r.arena || !r.arena.abyss || this.cinema) return;
    const fy = r.F * TILE, safe = this.abyssSafe(r).some(([a, b]) => p.x >= a && p.x <= b);
    if (p.onGround && (p.bottom < fy - 2 || safe)) { this.abyssLast = { x: p.x, y: p.bottom - p.b.height / 2, room: r }; return; }
    if (!p.onGround || p.bottom < fy - 2) return;
    let at = this.abyssLast && this.abyssLast.room === r ? this.abyssLast : null;
    if (!at) {   // 아직 섬을 디딘 적이 없으면 가장 가까운 섬 윗면 (없으면 문 앞)
      const tops = (r.arena.islands || r.arena.stones || []).map(q => ({ x: (q.x + q.w / 2) * TILE, y: q.y * TILE - p.b.height / 2 - 2 }));
      at = tops.sort((u, v) => Math.abs(u.x - p.x) - Math.abs(v.x - p.x))[0] || { x: r.left + 40, y: fy - p.b.height };
    }
    const cloud = r.arena.abyss === 'cloud';
    this.fx.burst(p.x, fy - 4, cloud ? [0xffffff, 0xd8eef4] : [0xb070ff, 0x4ae8d8, 0x12001e], 18, 160, { up: 120, glow: !cloud, life: .5 });
    p.b.reset(at.x, at.y - 4); p.b.setVelocity(0, 0);
    p.takeHit(p.m.maxhp * .08, 'none', p.x, { force: true });
    this.fx.burst(at.x, at.y, cloud ? [0x8affc8, 0xffffff] : [0xd8a0ff, 0xffffff], 14, 120, { glow: true, life: .4 });
    Sfx.play('pad');
    if (!this.abyssTold) { this.abyssTold = true; this.events.emit('toast', cloud ? '구름바다로 떨어졌다 — 상승 기류가 제단으로 밀어 올렸다' : '반물질 심연에 빠졌다 — 차원의 힘에 튕겨 섬으로 돌아왔다'); }
  }

  // ---------------- 부서지는 벽 ----------------
  drawBreakables() {
    const g = this.breakG; if (!g) return;
    g.clear();
    for (const b of this.level.breakables) {
      if (b.broken) continue;
      for (const [x, y] of b.cells) {
        const px = x * TILE, py = y * TILE, k = (x * 13 + y * 7) % 5;
        g.lineStyle(1, 0x0a0812, .55); g.lineBetween(px + 3 + k, py + 2, px + 8 + k, py + 9); g.lineBetween(px + 8 + k, py + 9, px + 6, py + 14);
        g.lineStyle(1, this.stage.palette.edge, .14 + (3 - b.hp) * .12); g.lineBetween(px + 4 + k, py + 2, px + 9 + k, py + 9);
        if (b.secret) {   // 🟡 비밀 벽감: 금 간 틈으로 금빛이 샌다 (칠수록 틈이 벌어져 더 밝게)
          const a = .5 + (3 - b.hp) * .15;
          g.lineStyle(1, 0xffe08a, a); g.lineBetween(px + 3 + k, py + 2, px + 8 + k, py + 9); g.lineBetween(px + 8 + k, py + 9, px + 6, py + 14);
          g.fillStyle(0xfff6d0, a * .8); g.fillRect(px + 7 + k, py + 8, 2, 2);
          if (b.hp < 3) { g.lineStyle(1, 0xffe08a, a * .8); g.lineBetween(px + 2, py + 12 - k, px + 9, py + 5 + k); }
        }
      }
    }
  }
  // 플레이어 공격 범위가 부서지는 벽에 닿으면 금이 더 가고, 세 번째에 무너진다
  hitBreakables(rect) {
    if (!this.level) return;
    const r = { x: rect.x - 6, y: rect.y - 6, w: rect.w + 12, h: rect.h + 14 };   // 발밑 철창 자리(바닥 벽)도 땅을 긋는 공격에 닿게
    for (const b of this.level.breakables) {
      if (b.broken || !overlap(r, b.rect)) continue;
      if (this.time.now - (b.lastHit || 0) < 220) continue;
      b.lastHit = this.time.now; b.hp--;
      this.fx.burst(rect.x + rect.w / 2, rect.y + rect.h / 2, [0x8a7a62, 0x4a4036, 0xd8d0c0], 8, 120, { up: 60 });
      this.fx.shake(.004, 80); Sfx.play('crack');
      if (b.hp <= 0) this.breakWall(b); else this.drawBreakables();
    }
  }
  breakWall(b) {
    const lv = this.level, cells = [...b.cells, ...(b.cover || [])];   // cover: 🟡 비밀 벽감 안쪽 (무너지기 전엔 바위 타일)
    b.broken = true;
    for (const [x, y] of cells) { lv.grid[y][x] = '.'; lv.data[y][x] = -1; }
    // 무너진 칸과 이웃 칸의 타일 모양을 다시 맞춘다
    const touched = new Set();
    for (const [x, y] of cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) touched.add((x + dx) + ',' + (y + dy));
    for (const k of touched) {
      const [x, y] = k.split(',').map(Number);
      if (x < 0 || y < 0 || x >= lv.cols || y >= lv.rows) continue;
      const r = lv.cellRoom.get(Math.floor(x / CW) + ',' + Math.floor(y / CH)); if (!r || !r.layer) continue;
      const idx = lv.tileOf(x, y); lv.data[y][x] = idx;
      if (idx < 0) r.layer.removeTileAt(x - r.X0, y - r.Y0);
      else { const t = r.layer.putTileAt(idx, x - r.X0, y - r.Y0); if (t) { if (PLAT_SET.has(idx)) t.setCollision(false, false, true, false); else t.setCollision(true, true, true, true); } }
    }
    const cx = b.rect.x + b.rect.w / 2, cy = b.rect.y + b.rect.h / 2;
    this.fx.shatter(cx, cy, b.rect.w, b.rect.h, { n: 18, speed: 160 });
    this.fx.burst(cx, cy, [0x8a7a62, 0x4a4036, 0x2a2420], 24, 160, { up: 80 });
    this.fx.shake(.012, 260); Sfx.play('boom');
    if (b.secret) {   // 🟡 비밀 벽감: 금빛이 쏟아지며 받침대가 드러난다
      this.fx.burst(cx, cy, [0xffe08a, 0xfff6d0, 0x8ae8ff], 30, 170, { glow: true, up: 60 });
      this.fx.glow(cx, cy, 70, 0xffe08a, 600, 1);
      if (this.props) this.props.revealSecret(b);
      Sfx.play('unlock');
      this.events.emit('toast', '🟡 빛이 새던 벽이 무너졌다! — 숨겨진 벽감에 기술머신 캡슐이 잠들어 있다', 'tm');
    } else this.events.emit('toast', '벽이 무너졌다! 숨겨진 길이 열렸다');
    this.drawBreakables();
  }

  // ---------------- 입력 ----------------
  // 설정의 조작키(Settings.keys)로 키 객체를 다시 만든다 — 설정에서 키를 바꾸면 바로
  bindKeys() {
    const kb = this.input.keyboard;
    this.bind = {};
    for (const [act, name] of Object.entries(Settings.get('keys'))) this.bind[act] = kb.addKey(name);
  }

  readInput() {
    const k = this.keys, b = this.bind, JD = Phaser.Input.Keyboard.JustDown, i = this.inp;
    if (this.keyCapture) {   // 설정에서 새 키를 기다리는 중: 누른 키가 게임(지도 열기 등)으로 새지 않게 모두 삼킨다
      for (const key of [...Object.values(b), ...Object.values(k)]) JD(key);
      if (this.keyCapture === 'last') this.keyCapture = false;   // 방금 받은 키(Esc 취소 포함)까지 삼키고 끝
      return;
    }
    i.left = b.left.isDown; i.right = b.right.isDown; i.up = b.up.isDown; i.down = b.down.isDown;
    i.jumpH = b.jump.isDown || b.up.isDown;
    i.zH = b.z.isDown;   // Z 홀드: 차징 샷 (Player.updateCharge)
    const upP = JD(b.up);   // JustDown 은 한 번 읽으면 꺼지므로 점프·상호작용이 같이 쓴다
    if (JD(b.jump) || upP) i.jumpP = true;
    if (upP) i.upP = true;   // ↑ 는 점프지만 포켓몬센터·자판기 앞에서는 상호작용
    if (JD(b.dash)) i.dashP = true;
    if (JD(b.z)) i.zP = true;
    if (JD(b.x)) i.xP = true;
    if (JD(b.c)) i.cP = true;
    if (JD(b.swap) || JD(b.swap2)) i.swapNext = true;
    if (JD(b.zmove)) i.zmoveP = true;   // Z기술 (Z크리스탈 획득 후)
    if (b.ult && JD(b.ult)) i.ultP = true;   // 메가 전용 필살기 (메가진화 중 · R)
    if (JD(k.ONE)) i.s1 = true;
    if (JD(k.TWO)) i.s2 = true;
    if (JD(k.THREE)) i.s3 = true;
    if (JD(b.mega)) i.mega = true;
    if (JD(b.interact)) i.useP = true;
    if (b.potion && JD(b.potion)) i.potionP = true;   // 상처약 퀵슬롯 (기본 A)
    const t = this.touchInput;   // 모바일 터치 조작 (UIScene 의 TouchControls)
    if (t) {
      i.left = i.left || t.left; i.right = i.right || t.right; i.up = i.up || t.up; i.down = i.down || t.down; i.jumpH = i.jumpH || t.jumpH; i.zH = i.zH || !!t.zH;
      for (const f in t.pressed) if (t.pressed[f]) i[f] = true;
      t.pressed = {};
    }
    i.downAim = b.down.isDown || !!(t && t.on !== false && t.downAim);   // 하향 점프 판정용 '아래' (키보드 ↓ · 조이스틱 아래 ±45°)
    // 지상 패링(↓ + Z)용 '아래': 키보드 ↓ · 조이스틱 아래쪽 45° ~ 135° 부채꼴 — 조이스틱을 막 놓았거나 살짝 벗어났어도 0.15초까지는 쳐 준다 (TouchControls)
    i.parryAim = b.down.isDown || !!(t && t.on !== false && (t.parryAim || this.time.now - (t.parryAimAt ?? -1e9) < 150));
    // 공중 내려찍기 방향: 키보드 ↓ (+ ← · → 를 같이 누르면 45° 대각선) · 조이스틱이 수평보다 아래를 가리키면 그 방향 (Player.startDive)
    i.diveAim = b.down.isDown ? { x: (b.right.isDown ? 1 : 0) - (b.left.isDown ? 1 : 0), y: 1 } : t && t.on !== false && t.diveAim ? t.diveAim : null;
    if (i.potionP) { i.potionP = false; this.quickPotion(); }   // 키보드 · 모바일 🧪 퀵버튼 · HUD 퀵슬롯 클릭
    const esc = JD(k.ESC);
    if (esc && this.tutorial && this.tutorial.escape()) { /* 🎓 훈련 중 ESC: 한 번 = 건너뛰기 확인 · 두 번 = 건너뛰기 */ }
    else if (esc || JD(k.P)) this.togglePause();
    if (JD(b.map) || i.mapP) this.toggleOverlay('map');
    if (JD(b.bag) || i.invP) this.toggleOverlay('inv');
    if (JD(b.settings)) this.toggleOverlay('settings');
    i.mapP = false; i.invP = false;
    if (JD(k.N)) { Sfx.on = !Sfx.on; this.events.emit('toast', Sfx.on ? '소리 켬' : '소리 끔'); }
    if (JD(k.F2)) this.debugToBoss();
    if (JD(k.F3)) this.toggleOverlay(this.test ? 'test' : 'debug');   // 챕터·보스 셀렉트 디버그 패널 (테스트룸은 테스트 패널)
    if (this.test && JD(k.T) && !Object.values(Settings.get('keys')).includes('T')) this.toggleOverlay('test');   // 조작키로 T 를 쓰고 있으면 F3 만
    if (this.test && JD(k.F1)) this.openTestTab('cards');   // 🃏 카드 샌드박스 (테스트룸 허브 · 워프한 보스방 어디서든)
    if (JD(k.F4)) this.debugGrow();
  }

  // ---------------- 지도(M) · 가방(I): 게임을 멈추고 UI 가 그린다 ----------------
  toggleOverlay(kind) {
    if (this.over || this.transitioning) return;
    if ((this.overlay === 'tm' || this.overlay === 'upgrade' || this.overlay === 'taxi' || this.overlay === 'debug' || this.overlay === 'test' || this.overlay === 'shop') && kind !== this.overlay) return;   // 카드·공중날기·디버그·테스트 창이 열려 있으면 다른 창으로 넘어가지 않는다
    if (this.overlay === kind && kind === 'talk') this.talkClosedAt = this.time.now;
    if (this.overlay === kind) {
      this.overlay = null; this.setFrozen(false); this.consumeInput(); this.player.zBuf = 0; this.events.emit('overlay', null);
      if (kind === 'join') this.afterJoin();
      if (kind === 'tm' && this.tmActive && this.tmActive.bonus && !this.tmActive.used) {   // 현장 전송 카드를 고르지 않고 닫았다: 같은 카드로 잠시 뒤 다시
        (this.bonusQueue = this.bonusQueue || []).unshift(this.tmActive); this.tmActive = null; this.bonusT = 8;
        this.events.emit('toast', '✨ 받지 않은 기술머신 카드 — 8초 뒤 다시 전송된다', 'tm');
      }
      if (kind === 'upgrade' && this.upActive) {   // 🗺️ 숙련도 강화를 고르지 않고 닫았다: 같은 카드로 잠시 뒤 다시
        if (!this.upActive.used) { (this.bonusQueue = this.bonusQueue || []).unshift(this.upActive); this.bonusT = 8; this.events.emit('toast', '🗺️ 고르지 않은 숙련도 강화 — 8초 뒤 다시 열린다', 'tm'); }
        this.upActive = null;
      }
      if (kind === 'shop') { this.shopClosedAt = this.time.now; if (this.shopDirty) { this.shopDirty = false; this.saveRun(true, 'shop'); } }
      if (kind === 'talk' && this.talk && this.talk.onEnd) { const f = this.talk.onEnd; this.talk.onEnd = null; this.time.delayedCall(150, f); }   // 이야기 NPC 보상
      return;
    }   // 지도에서 누른 Z(확대)가 공격으로 새지 않게
    if (this.overlay) { this.overlay = kind; this.events.emit('overlay', kind); return; }   // 지도 ↔ 가방 바로 전환
    if (this.paused) return;
    this.overlay = kind; this.setFrozen(true); this.events.emit('overlay', kind);
    Sfx.play('select');
  }
  setFrozen(on) {
    this.paused = on;
    if (on) { this.physics.world.pause(); this.anims.pauseAll(); this.tweens.pauseAll(); }
    else { this.physics.world.resume(); this.anims.resumeAll(); this.tweens.resumeAll(); }
  }

  // 디버그(F4): 성장 한 단계씩 — 2단 진화 → Z크리스탈 → 3단 진화 → 메가스톤 + 메가진화
  debugGrow() {
    if (this.paused || this.over || this.transitioning) return;
    const p = this.player;
    if (p.tier === 0) p.addExp(EVO_EXP[0] - p.exp);
    else if (!p.z.has) this.collect({ kind: 'zcrystal' });
    else if (p.tier === 1) p.addExp(EVO_EXP[1] - p.exp);
    else if (!p.mega.active) { if (!p.mega.stones) this.collect({ kind: 'megastone' }); p.startMega(); }
    else p.z.cd = 0;
  }

  // 디버그(F2): 이 챕터 최종 보스방 앞으로 순간이동
  debugToBoss() {
    if (this.paused || this.over || this.transitioning || !this.level) return;
    const r = this.level.rooms.find(q => q.type === 'boss');
    if (r && !r.cleared) this.warpToRoom(this.stageIdx, r.id, '[디버그] 보스방 이동');
  }
  // 디버그 패널: 정화한 보스를 다시 싸울 수 있게 되돌린다 (관문도 다시 단다)
  debugRefight(ci, roomId) {
    const r = this.worldOf(ci).level.rooms.find(q => q.id === roomId);
    if (!r || !r.cleared || !(r.type === 'mini' || r.type === 'boss' || r.type === 'sanctuary')) return;
    r.cleared = false; r.entered = false;
    if (ci === this.stageIdx && this.gateGroup) this.addArenaGates(r);
  }
  // 디버그 패널: 다섯 지방의 시내를 전부 아머까오 목적지로
  debugUnlockHubs() {
    STAGES.forEach((st, ci) => {
      for (const h of this.worldOf(ci).level.hubs) if (!this.unlockedHubs.some(q => q.ci === ci && q.roomId === h.room.id)) this.unlockedHubs.push({ ci, roomId: h.room.id, name: h.name, region: st.region });
    });
    this.events.emit('toast', `[디버그] 공중날기 목적지 ${this.unlockedHubs.length}곳 해금`);
  }
  // 챕터 ci 의 방 roomId 왼쪽 안쪽 바닥으로 순간이동 (다른 챕터면 그 월드를 깐다). 아레나면 들어서는 순간 보스전
  warpToRoom(ci, roomId, msg = null) {
    if (this.over || this.transitioning) return;
    const lv = this.worldOf(ci).level, r = lv.rooms.find(q => q.id === roomId);
    if (!r) return;
    const x = r.left + 28, y = (groundYAt(lv, x, r.top + 4) ?? r.bottom) - 14;
    this.moveTo(ci, { x, y }, () => { if (msg) this.events.emit('toast', msg); });
  }
  // 같은 챕터면 순간이동, 다른 챕터면 월드를 바꿔 깐다 (어둡게 바뀌었다 밝아진다)
  moveTo(ci, pos, done) {
    if (this.overlay) { this.overlay = null; this.setFrozen(false); this.events.emit('overlay', null); }
    this.transitioning = true;
    const cam = this.cameras.main;
    cam.fadeOut(380, 7, 6, 15);
    cam.once('camerafadeoutcomplete', () => {
      this.resetArenaFight();
      for (const e of this.enemies) { (e.colliders || []).forEach(c => c.destroy()); e.destroy(); }
      this.enemies = [];
      if (ci !== this.stageIdx) { this.stageIdx = ci; this.buildWorld(pos); }
      else this.teleport(pos);
      cam.fadeIn(420, 7, 6, 15);
      this.transitioning = false;
      if (done) done();
    });
  }
  teleport(pos) {
    const p = this.player;
    p.b.reset(pos.x, pos.y); p.b.setVelocity(0, 0);
    this.room = roomAt(this.level, pos.x, pos.y - 4) || this.room;
    if (!this.arenaRoom) this.cameras.main.setBounds(...this.camBounds());   // 연구소 안 ↔ 밖
    this.updateLabCover();
    this.cameras.main.centerOn(pos.x, pos.y);
    this.enterArea(this.room, true);
    if (this.room.type === 'village') this.visitHub(this.room);   // 순간이동으로 바로 시내에 내려도 정거장 등록
  }
  // 하던 보스전은 처음부터 (문을 열고 보스를 치운다 — 다시 들어서면 새로 시작)
  resetArenaFight() {
    const r = this.arenaRoom;
    if (!r) return;
    this.arenaRun = (this.arenaRun || 0) + 1;
    const all = (this.bosses || []).slice();
    if (this.boss && !all.includes(this.boss)) all.push(this.boss);
    for (const q of all) { (q.colliders || []).forEach(c => c.destroy()); if (!q.gone) q.destroy(); }   // 먼저 정화돼 치워진 짝은 건너뛴다
    this.enemies = this.enemies.filter(e => !all.includes(e));
    if (this.trainer) { this.trainer.destroy(); this.trainer = null; }
    if (this.player && this.player.flipT > 0) this.player.flipT = .001;   // 뒤틀린 중력도 푼다
    this.boss = null; this.bosses = []; this.chain = null; this.arenaRoom = null; r.entered = false;
    if (this.altar && this.altar.room === r) { this.altar.reset(true); this.altarRite = null; this.cinema = false; }   // 칠색조: 박힌 구슬은 그대로 — 제단에서 다시 F 로 강림
    if (r.plantHeart) {   // 블랙나이트의 심장: 오버드라이브를 끄고 결정 속 레드부터 다시 (무한다이노부터 새로)
      this.endOverdrive(); this.cinema = false;
      if (this.player && this.player.inv > 100) this.player.inv = 1;   // 연출 중의 무적을 푼다
      for (const o of [this.abyssSil, this.abyssTear && this.abyssTear.g]) if (o && o.scene) { this.tweens.killTweensOf(o); o.destroy(); }
      this.abyssTear = this.abyssSil = null;
      const core = this.props && this.props.redCore;
      if (core && core.broken) this.props.buildRedCore(r);
      this.bondStages.delete(this.stageIdx);   // 무한다이노부터 다시 — 마지막 불꽃도 그때 다시 모인다
    }
    this.setGates(r, true);
    this.unlockArena();
    this.combat.clearAll();
    this.events.emit('boss', null);
  }
  // 시내(포켓몬센터)에 처음 들르면 아머까오 목적지로 등록 + 쓰러졌을 때 다시 일어날 자리
  visitHub(room) {
    const ci = this.stageIdx;
    if (!this.unlockedHubs.some(h => h.ci === ci && h.roomId === room.id)) {
      this.unlockedHubs.push({ ci, roomId: room.id, name: room.city || room.area, region: STAGES[ci].region });
      this.time.delayedCall(2600, () => this.events.emit('toast', `${room.city || room.area} 아머까오 정거장 — 이제 어느 지방에서든 공중날기로 올 수 있다`));
      Sfx.play('heal');
    }
    this.lastCenter = { ci, roomId: room.id };
    this.saveRun(true);   // 포켓몬센터(시내)에 오면 자동 저장
  }

  // ---------------- 진행 저장 (systems/RunSave.js) ----------------
  // auto: 포켓몬센터 자동 저장 (조용히 작은 알림만) · 아니면 일시정지 메뉴의 '저장하기' → 저장했으면 true
  //  자리: 자동 저장은 그 시내 포켓몬센터 앞, 직접 저장은 마지막으로 밟은 땅 (보스전 중에는 저장하지 않는다)
  saveRun(auto = false, where = 'center') {
    if (this.test) { if (!auto) this.events.emit('toast', '테스트룸에서는 저장하지 않는다'); return false; }
    if (this.over || !this.player || !this.level) return false;
    if (this.arenaRoom) { if (!auto) this.events.emit('toast', '보스전 중에는 저장할 수 없다'); return false; }
    const p = this.player, c = this.lastCenter;
    const pos = auto && c && c.ci === this.stageIdx ? this.hubPos(c) : { x: Math.round(p.safeX ?? p.x), y: Math.round(p.safeY ?? p.y) };
    const worlds = (this.savedWorlds || []).slice();
    this.worlds.forEach((W, ci) => { if (W) worlds[ci] = snapshotWorld(W); });
    const ok = RunSave.write({
      v: 1, at: Date.now(), stageIdx: this.stageIdx, stageName: this.stage.name, pos, seeds: this.seeds.slice(), worlds,
      hubs: this.unlockedHubs.slice(), lastCenter: c, purified: [...this.purifiedSet], bond: [...this.bondStages],
      stats: { kills: this.runStats.kills, unlocked: this.runStats.unlocked.slice(), items: this.runStats.items, time: (this.time.now - this.runStats.start) / 1000 },
      player: snapshotPlayer(p),
      drops: { ci: this.stageIdx, list: this.pickups.filter(q => SAVE_DROPS.has(q.kind) && q.img && q.img.scene).map(q => ({ kind: q.kind, id: q.id, x: Math.round(q.img.x), y: Math.round(q.img.y) })) }   // 줍지 않은 코어 · 열쇠 · 유대의 불꽃 …
    });
    this.events.emit('saved', { ok, auto, where });
    return ok;
  }
  // 간이 포켓몬 회복기 연결: 마지막 부활 자리로 정하고 자동 저장 (반경에 들어설 때 · 작동할 때)
  linkTerminal(it, quiet = false) {
    if (this.arenaRoom || this.over) return;
    const ci = this.stageIdx, c = this.lastCenter, fresh = !(c && c.terminal && c.ci === ci && c.idx === it.idx);
    this.lastCenter = { ci, roomId: it.data.room.id, terminal: true, idx: it.idx, x: it.x - 22, y: it.y - 14 };
    if (fresh && !quiet) { Sfx.play('select'); this.fx.ring(it.x, it.y - 20, 30, 0x4affd8, 360); }
    this.saveRun(true, 'terminal');
  }
  // 간이 회복기 작동: 띠리리- 띠리! · 초록 치유 파동 · 파티 전원 체력·상태이상 100% 회복
  healAtTerminal(it) {
    const p = this.player;
    for (const m of p.members) { m.hp = m.maxhp; m.alive = true; }
    p.slowT = 0; p.windT = 0; if (p.flipT > 0) p.flipT = .001; p.buffs = p.buffs.filter(bf => bf.atk >= 1 && bf.speed >= 1 && bf.guard <= 1);
    Sfx.play('fieldheal');
    const cx = it.x, cy = it.y - 20;
    [0, 160, 320].forEach((d, i) => this.time.delayedCall(d, () => { this.fx.ring(cx, cy, 34 + i * 24, i % 2 ? 0x4affd8 : 0x7dff9a, 600); this.fx.glow(cx, cy, 40 + i * 10, 0x7dffb0, 420, .6); }));
    this.fx.burst(p.x, p.y, [0x7dff9a, 0x4affd8, 0xffffff], 30, 90, { glow: true, up: 70, grav: -40, bounce: false, life: 1 });
    this.cameras.main.flash(260, 200, 255, 220, true);
    this.events.emit('banner', '파티 전원 회복!', '간이 포켓몬 회복기 · 체력·상태이상 회복 · 자동 저장 완료');
    this.saveRun(true, 'terminal');
  }
  hubPos(h) {
    if (h.terminal) return { x: h.x, y: h.y };   // 간이 회복기 앞
    const hub = this.worldOf(h.ci).level.hubs.find(q => q.room.id === h.roomId);
    return { x: hub.x - 24, y: hub.y - 14 };
  }
  // 아머까오 공중날기: 들른 시내 아무 곳이나 (다른 지방이어도)
  travelTo(ci, roomId) {
    if (this.transitioning) return;
    const h = this.unlockedHubs.find(q => q.ci === ci && q.roomId === roomId);
    if (!h) return;
    Sfx.play('dash');
    this.moveTo(ci, this.hubPos(h), () => this.time.delayedCall(ci === this.stageIdx ? 0 : 1600, () => this.events.emit('toast', `아머까오 공중날기 — ${h.region} · ${h.name} 도착`)));
  }
  // 파티가 모두 쓰러지면: 마지막으로 들른 포켓몬센터에서 다시 일어난다 (아직 없으면 챕터 입구)
  respawn() {
    if (this.transitioning) return;
    const p = this.player, c = this.lastCenter;
    if (this.test && this.testReal && this.testLast) {   // 테스트 모드 실제 맵: 마지막으로 워프한 보스방 · 랜드마크로 다시 (보스전은 처음부터)
      for (const m of p.members) { m.hp = m.maxhp; m.alive = true; }
      p.inv = 2.5;
      this.events.emit('banner', '눈앞이 캄캄해졌다…', '테스트 모드 · 마지막으로 워프한 자리에서 다시');
      this.testLast();
      return;
    }
    this.events.emit('banner', '눈앞이 캄캄해졌다…', this.test ? '테스트룸 입구에서 다시 일어난다' : c ? (c.terminal ? '마지막으로 연결한 간이 회복기 앞에서 다시 일어난다' : '마지막으로 들른 포켓몬센터로 돌아간다') : '챕터 입구로 돌아간다');
    for (const m of p.members) { m.hp = m.maxhp; m.alive = true; }
    p.inv = 2.5;
    const pos = c ? this.hubPos(c) : this.worldOf(this.stageIdx).level.start;
    this.moveTo(c ? c.ci : this.stageIdx, { x: pos.x, y: pos.y }, () => { this.player.inv = 2; Music.play(this.areaBgm()); });
  }
  consumeInput() { for (const f of ['ultP', 'jumpP', 'dashP', 'zP', 'xP', 'cP', 'swapNext', 'swapPrev', 's1', 's2', 's3', 'mega', 'zmoveP', 'useP', 'upP', 'potionP']) this.inp[f] = false; }

  // ---------------- 상처약 퀵슬롯: 단축키(기본 A) · 모바일 🧪 버튼 · HUD 칸 클릭 ----------------
  //  즉발: 누르는 순간 출전 중인 포켓몬 체력을 회복한다 — 동작이 없어 이동 · 점프 · 공중 기동 · 공격 흐름을 끊지 않는다 · 재사용 3초 (포켓샵에서 산다)
  //  처음엔 최대 2개 · 최대 체력의 35% — 유대의 불꽃 권능 (data/bond.js): Lv.1 회복 42% · Lv.2 최대 3개 · Lv.4 회복 50% · Lv.5 최대 4개
  //  광전사의 혈투 카드(양날의 검): 회복 효율 -50% (Player.mods.potionCut)
  quickPotion() {
    const p = this.player;
    if (!p || this.paused || this.over || this.transitioning) return;
    const m = p.m, n = p.uses.potion || 0, max = p.potionMax, cut = p.mods.potionCut || 0, heal = p.potionHeal * (1 - cut);
    if (!m.alive) return;
    if (p.potionCd > 0) { Sfx.play('deny'); return; }
    if (!n) { Sfx.play('deny'); this.events.emit('toast', `상처약이 없다 · 포켓샵에서 살 수 있다 (최대 ${max}개)`, 'potion'); return; }
    if (m.hp >= m.maxhp) { Sfx.play('deny'); this.events.emit('toast', `${p.formName()}의 체력은 이미 가득하다`, 'potion'); return; }
    if (n > 1) p.uses.potion = n - 1; else delete p.uses.potion;
    p.heal(m.maxhp * heal);
    p.potionCd = POTION_CD;
    Sfx.play('heal');
    this.fx.ring(p.x, p.y, 30, 0x5aff8a, 360); this.fx.glow(p.x, p.y, 34, 0x5aff8a, 420, .8);
    this.fx.burst(p.x, p.y, [0x7dff9a, 0xd8ffe0, 0xffffff], 18, 90, { glow: true, grav: -80, bounce: false, up: 60 });
    this.events.emit('toast', `🧪 상처약! ${p.formName()} 체력 ${Math.round(heal * 100)}% 회복${cut ? ` (광전사의 혈투 -${Math.round(cut * 100)}%)` : ''} (남은 ${n - 1}/${max})`, 'potion');
  }

  // ---------------- 마을: 포켓몬센터 · 자판기 ----------------
  updateInteract() {
    const pf = this.pickFocus, pn = !pf && this.portal && this.portalNear;
    if (pf || pn) {   // 🖐️ 아이템 · 🌀 포털: 툴팁이 안내를 맡는다 (머리 위 안내 글자는 감춘다)
      if (this.promptText) this.promptText.setVisible(false);
      const tapped = this.promptTap; this.promptTap = false;
      if (!this.inp.useP && !this.inp.upP && !tapped) return;
      this.inp.jumpP = false;
      if (pf) this.takePickup(pf); else this.enterPortal();
      return;
    }
    const p = this.player, it = this.props ? this.props.nearest(p.x, p.bottom) : null;
    if (!this.promptText) {
      this.promptText = this.add.text(0, 0, '', { fontFamily: 'Galmuri9', fontSize: '9px', color: '#fff2c0', stroke: '#1a1008', strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(60);
      this.promptText.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!this.paused) this.promptTap = true; });
    }
    this.promptText.setVisible(!!it && it.kind !== 'tm');   // 🟡 기술머신은 작은 툴팁(updatePickups)이 안내를 맡는다
    if (!it) return;
    const touch = this.touchInput && this.touchInput.on;   // 터치패드를 쓰면 키 대신 버튼 이름으로
    this.promptText.setText(touch ? it.prompt.replace('F 또는 ↑', '조사 버튼').replace('↓ + Space', '아래로 당기고 점프') : it.prompt).setPosition(Math.round(it.x), Math.round(it.promptY + Math.sin(this.time.now / 250) * 1.5));
    const tapped = this.promptTap; this.promptTap = false;   // 머리 위 안내 글자를 눌러도 조사 (터치)
    if (!this.inp.useP && !this.inp.upP && !tapped) return;
    if (it.kind === 'hint') return;   // 안내만 띄운다 (↓ + Space 는 평소대로 발판 내려가기)
    this.inp.jumpP = false;
    if (it.kind === 'lore') { if (this.time.now - (this.loreAt || 0) > 500) { this.loreAt = this.time.now; this.events.emit('lore', it.text); Sfx.play('select'); } return; }
    if (it.kind === 'npc') { this.talkTo(it); return; }   // 마을 사람 · 오박사와 대화
    if (it.kind === 'guide') { this.talkGuide(it); return; }   // 🌀 지방 최종 보스 뒤 조력자: 브리핑 · 처음엔 파티 전원 회복 + 자동 저장
    if (it.kind === 'journal') { this.readJournal(it); return; }   // 가라르 지하 플랜트의 기밀 연구 일지
    if (it.kind === 'door') { this.useDoor(it); return; }   // 오박사 연구소 문 (안 ↔ 밖)
    if (it.kind === 'tm') {   // 카드를 확정해야 다 쓴 제단이 된다
      if (it.sealed) { this.props.sealNudge(it); return; }   // 🔒 봉인된 받침대 (정화 봉인 · 수문장 결계): F 가 먹히지 않고 덩굴 · 결계가 번쩍인다
      this.openTM(it); return;
    }
    if (it.kind === 'altar') { it.altar.use(); return; }   // 🌈 삼색 방울의 제단: 구슬이 모자라면 비문 · 셋이면 봉헌 & 칠색조 강림
    if (it.kind === 'taxi') { this.toggleOverlay('taxi'); Sfx.play('select'); return; }   // 아머까오 공중날기 (몇 번이고)
    if (it.kind === 'mart') { this.openShop(it); return; }   // 포켓샵 (몇 번이고)
    if (it.kind === 'terminal') {   // 간이 포켓몬 회복기: 파티 전원 회복 + 연결(자동 저장 · 부활 자리)
      if (this.time.now - (this.healAt || 0) < 1500) return;
      this.healAt = this.time.now;
      this.linkTerminal(it, true);
      this.healAtTerminal(it);
      return;
    }
    if (it.kind === 'center') {   // 포켓몬센터는 몇 번이고 (HK 의자처럼) — 쉬면 여기가 다시 일어날 자리가 된다
      if (this.time.now - (this.healAt || 0) < 1500) return;
      this.healAt = this.time.now;
      if (it.room) this.visitHub(it.room);
      this.healAtCenter();
      return;
    }
    this.props.markUsed(it);
    {   // 자판기 (마을마다 한 번): 가끔 강화 아이템, 아니면 오렌열매
      const lucky = Math.random() < ITEM_DROP.vending;
      this.spawnPickup(lucky ? 'item' : 'oran', it.x, it.y - 30, lucky ? pick(RANDOM_ITEM_KEYS) : undefined);
      this.fx.burst(it.x, it.y - 30, lucky ? [0xffe08a, 0x8ad0ff, 0xffffff] : [0x8ad0ff, 0xffffff], lucky ? 20 : 12, 90, { glow: true, up: 60 });
      this.events.emit('toast', lucky ? '프렌들리숍 자판기에서 강화 아이템이 나왔다!' : '자판기에서 오렌열매가 나왔다  ·  강화 아이템은 가끔 나온다');
      Sfx.play(lucky ? 'unlock' : 'vend');
    }
  }

  // ---------------- 포켓샵 (data/shop.js · 창은 scenes/ShopMenu.js) ----------------
  //  정문 앞에서 F / ↑ / 터치 → 딩동 · 게임을 멈추고 상점 창. 재고는 시내마다 따로 (shopAt.key)
  //  거래를 한 번이라도 했으면 창을 닫을 때 자동 저장 (돈 · 금구슬 · 가방 · 구매 이력)
  openShop(it) {
    if (this.time.now - (this.shopClosedAt || 0) < 400) return;   // 닫은 F 키가 바로 다시 열지 않게
    const room = it.room || this.room;
    if (room && room.type === 'village') this.visitHub(room);   // 처음 온 시내면 정거장 해금 · 부활 자리 (포켓몬센터 바로 옆)
    this.shopAt = { key: martKey(this.stageIdx, room ? room.id : -1), city: (room && (room.city || room.area)) || '포켓샵' };
    this.shopDirty = false;
    Sfx.play('mart');
    this.toggleOverlay('shop');
  }

  // ---------------- 건물 출입문: 안 ↔ 밖 (오박사 연구소 · 방울탑 정문) ----------------
  //  문짝이 열리고 빛이 새어 나온다 → 어두워졌다가 → 반대편 문 앞에 서서 등 뒤로 문이 닫힌다 (적·보스전은 그대로)
  //  pair 로 짝을 찾는다 (없으면 연구소). 방울탑 정문은 늘 열려 있어 문짝 대신 안쪽 등불빛이 번쩍인다
  useDoor(it) {
    if (this.transitioning || this.time.now - (this.doorAt || 0) < 800) return;
    if (this.arenaRoom) { if (this.time.now - (this.doorDenyAt || 0) > 1200) { this.doorDenyAt = this.time.now; this.events.emit('toast', '결전 중에는 나갈 수 없다'); Sfx.play('deny'); } return; }   // 시초의 방처럼 결전장 안의 출입문
    const dst = this.props.interacts.find(q => q.kind === 'door' && q.side !== it.side && (q.pair || 'lab') === (it.pair || 'lab'));
    if (!dst) return;
    this.doorAt = this.time.now; this.transitioning = true;
    const p = this.player, cam = this.cameras.main, props = this.props;
    p.b.setVelocity(0, 0);
    props.openDoor(it); Sfx.play('door');
    if (it.glowAt) { this.fx.glow(it.glowAt.x, it.glowAt.y, 70, { rift: 0xff3a5a, spear: 0xc8b8ff, spiral: 0xd8e8ff, origin: 0xfff0c0, plant: 0xff3a5a }[it.pair] || 0xffd890, 420, .8); Sfx.play(it.pair === 'rift' ? 'rift' : 'resonate'); }
    if (it.pair === 'rift') chromatic(this, .014, 700);   // 균열을 지날 땐 공간이 어긋난다
    this.time.delayedCall(230, () => {
      cam.fadeOut(240, 7, 6, 15);
      cam.once('camerafadeoutcomplete', () => {
        if (this.props !== props) { this.transitioning = false; return; }
        props.shutDoor(it, true);
        props.openDoor(dst, true);
        this.teleport({ x: dst.x, y: dst.y - 14 });
        p.face = dst.face || (dst.side === 'out' ? 1 : -1); p.refacing();   // 마을로 나오면 오른쪽(마을 쪽), 연구소에 들어가면 왼쪽(박사님 쪽)을 본다
        cam.fadeIn(300, 7, 6, 15);
        this.transitioning = false;
        this.doorAt = this.time.now;
        this.time.delayedCall(260, () => { if (this.props === props) { props.shutDoor(dst); Sfx.play('doorshut'); } });
      });
    });
  }

  // 가라르 지하 플랜트의 기밀 연구 일지: 홀로그램 단말을 조사하면 대화창에 글 (제목은 일지 머리글 · 초상은 단말 그림)
  readJournal(it) {
    if (this.overlay || this.paused || this.time.now - (this.talkClosedAt || 0) < 300) return;
    const m = /^\[(.+?)\]\s*/.exec(it.text);
    this.talk = { name: m ? m[1] : `기밀 연구 일지 ${it.no}`, portrait: { key: 'prop:journal', max: 2.4, glow: 0x4af0ff }, lines: pagesOf(m ? it.text.slice(m[0].length) : it.text), page: 0, id: `journal${it.no}` };
    Sfx.play('select');
    this.toggleOverlay('talk');
  }
  // 이야기 대화 (아르세우스의 텔레파시 · 레드): 다른 창이 닫힐 때까지 기다렸다가 연다 · 긴 대사는 쪽으로 나눈다
  openStory(talk) {
    if (this.over) return;
    if (this.overlay || this.paused || this.transitioning) { this.time.delayedCall(400, () => this.openStory(talk)); return; }
    this.talk = Object.assign({ page: 0, id: 'story' }, talk, { lines: talk.lines.flatMap(l => pagesOf(l)) });
    this.toggleOverlay('talk');
  }

  // ---------------- 대화: 마을 사람 · 오박사 (data/npcs.js) ----------------
  //  그 지방을 정화했으면 정화 뒤 대사(pure). 대화창은 UIScene.showTalk (게임은 멈춘다)
  talkTo(it) {
    if (this.overlay || this.paused || this.time.now - (this.talkClosedAt || 0) < 300) return;
    const npc = it.npc, W = this.worlds[this.stageIdx], pure = !!(W && W.purified && npc.pure);
    const story = this.storyTalk(it.id);   // 이야기 NPC: 진행에 따라 대사가 바뀌고, 대화를 마치면 보상 (onEnd)
    const q = this.player.quests || (this.player.quests = {}); q['met:' + it.id] = 1;   // ❗ 들은 이야기 (머리 위 '!' 가 사라진다 — npcPending)
    this.talk = { name: npc.name, look: npc.look, tint: npc.tint, lines: story ? story.lines : pure ? npc.pure : npc.lines, page: 0, id: it.id, onEnd: story && story.onEnd };
    if (this.npcs) this.npcs.greet(it, this.player.x);
    this.toggleOverlay('talk');
  }

  // 🎬 새 여정의 첫 장면: 연구소에서 눈을 뜨자마자 오박사가 먼저 말을 건다 — 이야기를 잘 안 읽는 사람도 놓치지 않게 (강제 대화)
  //  오박사가 돌아보며 머리 위에 '!' → 대화창 (마지막 쪽까지 넘겨야 닫힌다). 다른 창 · 연출이 열려 있으면 기다렸다가.
  //  한 번만: p.quests.oakIntro (진행 저장 — 이어하기 · 공중날기로 돌아와도 다시 붙잡지 않는다)
  openingTalk(tries = 0) {
    const p = this.player, q = p && (p.quests || (p.quests = {}));
    if (!p || this.over || this.test || q.oakIntro || this.stageIdx !== 0) return;
    if (this.overlay || this.paused || this.transitioning || this.cinema) { if (tries < 40) this.time.delayedCall(400, () => this.openingTalk(tries + 1)); return; }
    const it = this.props && this.props.interacts.find(o => o.kind === 'npc' && o.id === 'oak');
    if (!it) return;
    q.oakIntro = 1;
    p.b.setVelocityX(0);
    if (this.npcs) this.npcs.greet(it, p.x);
    this.fx.floatText(it.x, it.y - 34, '!', '#ffe14a', 18);
    Sfx.play('select');
    this.time.delayedCall(450, () => {
      if (this.over || !this.player) return;
      if (this.overlay || this.paused) { q.oakIntro = 0; this.openingTalk(tries + 1); return; }
      this.talkClosedAt = 0;
      this.talkTo(it);
    });
  }

  // ❗ 이야기 NPC 머리 위 표식 (game/Npc.js storyMark): 0 없음 · 1 새로 들을 이야기(노랑 '!') · 2 받을 보상 · 회복(금빛 '!')
  //  힌트 말풍선이 있는 사람 · 오박사는 처음 말을 걸 때까지 1 · 지방 보스 뒤 조력자는 처음 대화(회복 · 저장) 전까지 2
  //  노승려: 성도를 정화하면 2(키스톤 · 메가스톤) · 시련 캡틴: 시련 전 1 · 수호자를 넘으면 2 · 고대석 수집가: 사탕 2개로 바꿀 수 있으면 2
  npcPending(it) {
    const p = this.player, id = it.id, def = it.npc;
    if (!p || this.test || !def) return 0;
    const q = p.quests || (p.quests = {}), met = !!q['met:' + id];
    if (def.guide) return q['guide' + this.stageIdx + ':' + id] ? 0 : 2;
    if (id === 'elder_monk') return q.monk ? 0 : (this.purifiedSet.has(1) || !!(this.worlds[1] && this.worlds[1].purified)) ? 2 : met ? 0 : 1;
    if (id === 'trial_captain') { const st = q.zTrial || 0; return st === 2 ? 2 : st === 0 ? 1 : 0; }
    if (id === 'stone_collector') { const r = this.storyTalk(id); return r && r.onEnd ? 2 : met ? 0 : 1; }
    return (def.hint || id === 'oak') && !met ? 1 : 0;
  }
  // 곁을 지나칠 때 먼저 부르는 말 (lv: npcPending)
  npcCall(it, lv) {
    const id = it.id, q = (this.player && this.player.quests) || {};
    if (it.npc.guide) return '기다리고 있었다! 이리 오너라 — 떠나기 전에 회복시켜 주마.';
    const C = {
      oak: '오오, 어디 가는 게냐! 잠깐 이리 오거라!',
      elder_monk: lv === 2 ? '종소리가 돌아왔구려! 이리 오시오, 줄 것이 있소!' : '여보시오, 젊은이! 방울탑 이야기를 들어 보시오.',
      trial_captain: lv === 2 ? '오오, 그 기운! 시련을 넘었구먼. 이리 오게!' : (q.zTrial ? '시련은 아직이라네!' : '이봐, 트레이너! Z파워에 관심 없나?'),
      stone_collector: lv === 2 ? '반짝이는 돌 있소! 사탕 2개면 바꿔 주지!' : '이보게, 고대석 구경하고 가게!'
    };
    const generic = ['어이, 거기! 잠깐 이야기 좀 하세!', '잠깐! 들려줄 이야기가 있어.', '이봐, 그냥 지나치지 말고 들어 보게!'];
    return C[id] || generic[[...id].reduce((h, ch) => h + ch.charCodeAt(0), 0) % generic.length];
  }

  // ---------------- 이야기 NPC (data/npcs.js) ----------------
  //  노승려(인주시티): 성도를 정화하면 키스톤 + 첫 메가스톤 · 시련 캡틴(루네시티): 시련(호연의 엘리트 수호자)을 넘으면 Z링 + Z크리스탈
  //  고대석 수집가(금빛시티 · 축복시티): 이상한사탕 2개 → 출전 포켓몬의 메가스톤. 반환 { lines, onEnd } (해당 없으면 null)
  storyTalk(id) {
    const p = this.player, q = p.quests || (p.quests = {});
    if (id === 'elder_monk') {
      const freed = this.purifiedSet.has(1) || !!(this.worlds[1] && this.worlds[1].purified);
      if (q.monk) return { lines: ['그 돌의 빛이 흐려지지 않도록, 포켓몬과의 유대를 소중히 하시오.', '다른 포켓몬의 돌은… 하늘을 다스리는 {b:호연의 용}, 그리고 {b:신오 챔피언로드 깊은 곳의 숨겨진 균열}이 품고 있다 하오. 마을을 떠도는 {b:고대석 수집가}도 찾아보시오.'] };
      if (!freed) return null;   // 처음 대사 (칠색조를 정화해 달라)
      //  첫 메가스톤: 출전 포켓몬부터 — 아직 돌이 없는 계열에만 (이미 가진 계열이면 다음 동료 · 모두 가졌으면 키스톤만)
      const hasStone = k => p.stones.has(k) || p.members.some(m => m.key === k && m.gear.stone === k) || !!(p.stored && p.stored[k] && p.stored[k].gear.stone === k);
      const line = [p.m, ...p.members].map(m => m.key).find(k => usesStone(k) && !hasStone(k)) || null;
      return {
        lines: ['종소리가… 다시 울리는구려! 탑 꼭대기에서 폭주하던 전설들을 구해 주었소.',
          line ? `그대와 포켓몬 사이의 깊은 유대가 이 고대의 돌을 공명시켰구려. {y:키스톤}과 {b:${stoneName(line)}}을 받으시오.` : '그대와 포켓몬 사이의 깊은 유대가 이 고대의 돌을 공명시켰구려. {y:키스톤}을 받으시오. 그대 동료들의 돌은 이미 제자리를 찾았구려.',
          '메가스톤은 그 포켓몬의 {y:메가스톤 칸}에 끼워야 하오. {y:3단 진화} 뒤 {y:<V 키|메가 버튼>}로 메가진화하면, 메가 중엔 {y:<R 키|MEGA SKILL 버튼>} 필살기도 쓸 수 있소.',
          '다른 포켓몬의 돌은… 하늘을 다스리는 {b:호연의 용}, 그리고 {b:신오 챔피언로드 깊은 곳의 숨겨진 균열}이 품고 있다 하오. 마을을 떠도는 {b:고대석 수집가}도 찾아보시오.'],
        onEnd: () => {
          if (q.monk) return;
          q.monk = 1; p.keyStone = true;
          const got = line ? p.gainStone(line) : null;
          this.rewardFx(0xff8ad0);
          this.events.emit('banner', `키스톤${got ? ' · ' + stoneName(got) : ''} 획득!`, got ? `${SPECIES[got].name} 계열 메가스톤 칸에 끼웠다 · 3단 진화 후 V 로 메가진화` : '메가스톤을 얻으면 그 포켓몬의 메가스톤 칸에 낀다');
          this.saveRun(true, 'story');
        }
      };
    }
    if (id === 'trial_captain') {
      const st = q.zTrial || 0;
      if (st >= 3) return { lines: ['Z파워는 마음과 마음이 이어질 때 빛나는 법이지. 계속 나아가게!', '새 동료가 생기면 그 속성의 {b:Z크리스탈}은 Z크리스탈을 떨어뜨리는 강적에게서 구하게나.'] };
      if (st === 2) return {
        lines: ['오오… 그 기운! 수호자의 시련을 넘었구먼.', '받게, 이것이 {y:Z링}이네. 그리고 자네 동료들의 속성에 맞는 {b:Z크리스탈}이지.', '{y:<Q 키|Z 버튼>}로 일격필살의 Z기술을! 크리스탈은 그 속성 포켓몬의 {y:Z크리스탈 칸}에 끼워야 빛난다네. (가방)'],
        onEnd: () => {
          if ((q.zTrial || 0) >= 3) return;
          q.zTrial = 3; p.gainZ(); p.z.cd = 0;
          this.rewardFx(0xfff6a0);
          this.events.emit('banner', 'Z링 · Z크리스탈 획득!', `Q 로 Z기술 — ${p.members.filter(m => p.canZ(m)).map(m => ZMOVES[m.sp.zmove].name).join(' · ') || '크리스탈을 가방에서 끼우자'}`);
          this.saveRun(true, 'story');
        }
      };
      if (st === 1) { this.ensureTrialGuardian(); return { lines: ['아직 시련이 끝나지 않았네. 이 돌다리 끝의 {y:시련의 수호자}(붉은 오라)를 쓰러뜨리고 오게.', '호연 어딘가의 {y:엘리트 수호자}를 쓰러뜨려도 자격으로 쳐 주지.'] }; }
      return {
        lines: ['알로라에서 파견 나온 시련 캡틴이라네. 카푸 수호신의 기척을 쫓다 이 호연까지 왔지.',
          '이 심연의 어둠을 꿰뚫으려면 알로라 지방에 전해 내려오는 태고의 빛, {y:Z파워}가 필요하네.',
          '내가 이 돌다리 끝에 하늘기둥을 지키는 주인 포켓몬 — {y:붉은 오라를 두른 시련의 수호자}를 불러내겠네. 쓰러뜨리고 자격을 증명해 보게!',
          '시련을 넘으면 다시 오게. {b:Z링}과 자네 동료들의 {b:Z크리스탈}을 정식으로 내어 주지.'],
        onEnd: () => { if (!q.zTrial) { q.zTrial = 1; this.events.emit('toast', '시련 시작 — 돌다리 끝에 시련의 수호자(붉은 오라)가 나타났다!'); Sfx.play('select'); this.ensureTrialGuardian(); } }
      };
    }
    if (id === 'stone_collector') {
      if (!p.keyStone) return { lines: ['나는 각지의 고대석을 모으는 수집가라네.', '…키스톤도 없는 손님에겐 돌을 내줄 수 없지. 성도지방 {b:인주시티}의 {b:방울탑 노승려}를 찾아가 보게.'] };
      const line = usesStone(p.m.key) && !p.stones.has(p.m.key) && p.m.gear.stone !== p.m.key ? p.m.key : null;
      if (!line) return { lines: ['나는 각지의 고대석을 모으는 수집가라네.', usesStone(p.m.key) ? '그 포켓몬은 이미 돌을 갖췄구먼! 다른 포켓몬을 앞세우고 다시 오게.' : '그 포켓몬에게 맞는 메가스톤은 내 수집품에 없다네. 다른 포켓몬을 앞세우고 다시 오게.'] };
      if ((p.candy || 0) < 2) return { lines: ['나는 각지의 고대석을 모으는 수집가라네.', `그 포켓몬에게 어울리는 {b:${stoneName(line)}}이 있지. {y:이상한사탕 2개}면 내주겠네 — 엘리트 수호자들이 사탕을 지니고 있다더군.`] };
      return {
        lines: ['나는 각지의 고대석을 모으는 수집가라네.', `오호, 그 포켓몬에게 어울리는 {b:${stoneName(line)}}이 있지. {y:이상한사탕 2개}와 바꾸겠나? (대화를 마치면 교환)`],
        onEnd: () => {
          if ((p.candy || 0) < 2 || p.stones.has(line) || p.members.some(m => m.gear.stone === line)) return;
          p.candy -= 2; p.gainStone(line);
          this.rewardFx(0xff8ad0);
          this.events.emit('banner', `${stoneName(line)} 획득!`, `이상한사탕 2개와 교환 · ${SPECIES[line].name} 계열 메가스톤 칸에 끼웠다`);
        }
      };
    }
    return null;
  }
  // 보상 받는 순간: 빛 고리 · 반짝임 · 효과음
  rewardFx(col) {
    const pl = this.player;
    Sfx.play('unlock'); this.cameras.main.flash(260, 255, 240, 220, true);
    this.fx.ring(pl.x, pl.y, 50, col, 420); this.fx.burst(pl.x, pl.y, [col, 0xffffff, 0x9ad8ff], 26, 170, { glow: true, up: 80 });
  }

  // ---------------- 기술머신: 카드 3장 뒤집기 → 1장 고르기 ----------------
  // 처음 가동할 때 지금 출전 중인 포켓몬에게 맞춘 카드 3장을 뽑아 제단에 묶어 둔다 (닫았다 다시 열어도 같은 카드·뒤집은 상태 그대로)
  //  처음 가동하면 캡슐이 증기와 빛을 뿜으며 열린 뒤(Props.openTM) 카드 화면으로
  openTM(it) {
    if (this.tmOpening) return;
    if (!it.cards) { it.member = this.player.m; it.cards = rollCards(this.player); it.flipped = Array(TM_CARDS).fill(false); it.sel = -1; }   // 파티 전체에게 맞춘 카드 (data/tm.js)
    this.tmOpening = true;
    this.player.b.setVelocityX(0);
    this.props.openTM(it, () => {
      this.tmOpening = false;
      if (this.over || this.overlay || !this.props) return;
      this.tmActive = it;
      this.toggleOverlay('tm');
      Sfx.play('mega');
    });
  }
  // 카드 i 확정 (기술 습득 카드는 바꿀 슬롯 z·x·c 와 함께) · target: 적용할 파티 포켓몬의 계열 키 (출전 여부 무관)
  finishTM(i, slot, target) {
    const it = this.tmActive, p = this.player;
    if (!it || it.used) return;
    const card = it.cards[i], m = p.members.find(q => q.key === target) || it.member || p.m;
    let msg = applyCard(p, m, card, slot);
    if (it.sandbox && card.sandboxLv > 0 && (card.kind === 'move' || card.kind === 'boost' || card.kind === 'perk')) {   // 🃏 카드 샌드박스: 고른 강화 단계(+1 · +2 · ★MAX)까지 바로 합성
      const cap = card.kind === 'perk' ? Math.min(CARD_MAX_LV, PERKS[card.id].max - 1) : CARD_MAX_LV;
      for (let k = 0; k < CARD_MAX_LV && heldLv(m, card) < Math.min(card.sandboxLv, cap); k++) msg = applyCard(p, m, card, slot);
    }
    if (it.legend || it.sandbox || it.bonus) it.used = true; else this.props.markUsed(it);   // 히든 전설 보상 · 샌드박스 · 현장 전송(전투 데이터 · 빛나는 TM 코어) 카드는 제단이 없다
    this.tmActive = null;
    this.toggleOverlay('tm');
    const who = p.formName(m);
    const merged = msg.includes('강화 합성');   // 중복 카드 합성 (data/tm.js applyCard)
    this.events.emit('banner', merged ? `🔨 ${card.baseName || card.name} 강화 합성!` : card.kind === 'move' ? `${card.name} 습득!` : card.name, `${who} · ${msg}`);
    this.fx.ring(p.x, p.y, 40, 0x9ad8ff, 420); this.fx.glow(p.x, p.y, 40, 0x9ad8ff, 500, 1);
    this.fx.burst(p.x, p.y, [0x9ad8ff, 0xffffff, 0xc8e4ff], 24, 140, { glow: true, up: 80 });
    Sfx.play('unlock');
  }

  // 띠리리- 띠리- : 황금빛·초록빛 치유 파동이 퍼지며 파티 전원(쓰러진 포켓몬 포함) 체력 100%
  healAtCenter() {
    const p = this.player;
    for (const m of p.members) { m.hp = m.maxhp; m.alive = true; }
    Sfx.play('center');
    const cx = p.x, cy = p.y;
    [0, 200, 400, 600].forEach((d, i) => this.time.delayedCall(d, () => {
      this.fx.ring(cx, cy, 50 + i * 28, i % 2 ? 0x8affb0 : 0xffe08a, 700);
      this.fx.glow(cx, cy, 60 + i * 10, i % 2 ? 0x8affb0 : 0xfff2b0, 500, .6);
    }));
    this.fx.burst(cx, cy, [0xffe08a, 0x8affb0, 0xffffff], 34, 120, { glow: true, up: 70, grav: -30, bounce: false, life: 1.1 });
    this.cameras.main.flash(380, 255, 244, 200);
    this.events.emit('banner', '모든 포켓몬이 건강해졌다!', '포켓몬센터 · 파티 전원 회복 · 쓰러지면 여기서 다시 일어난다');
    // 이어서 포켓몬 보관함 (엔트리 교체) — 파티 밖에 데려올 포켓몬이 있을 때만
    if (DEX_ORDER.some(k => Save.isUnlocked(k) && !p.members.some(m => m.key === k))) this.time.delayedCall(1100, () => { if (!this.over && !this.overlay) this.toggleOverlay('box'); });
  }

  togglePause() {
    if (this.over || this.transitioning) return;
    if (this.overlay) { this.toggleOverlay(this.overlay); return; }   // 지도·가방이 열려 있으면 Esc 는 닫기
    this.setFrozen(!this.paused);
    this.events.emit('pause', this.paused);
  }

  // ---------------- 메인 루프 ----------------
  update(time, delta) {
    if (!this.player || !this.layers || !this.layers.length) return;
    const dt = Math.min(delta, 50) / 1000;
    this.readInput();
    if (this.paused || this.over) return;
    if (this.fx.updateHitStop()) return;
    if (this.zFreezeT > 0) {   // Z파워 공명: 적 · 투사체 · 물리가 멈춘다 (연출 트윈 · 파티클은 그대로)
      this.zFreezeT -= dt;
      if (this.zFreezeT <= 0) this.physics.world.resume();
      this.fx.update(dt);
      return;
    }
    if (this.transitioning) { this.fx.update(dt); return; }
    if (this.cinema) {   // 이야기 연출 중 (유대의 불꽃): 주인공은 제자리에서 지켜본다 — 조작 · 적 · 투사체는 멈추고 연출 트윈 · 파티클 · 조명은 그대로
      this.player.update(dt, {});
      this.consumeInput();
      if (this.promptText) this.promptText.setVisible(false);
      this.props.update(time, dt);
      this.updateResting();
      this.updateLights(dt); this.updateAtmosphere(dt); this.updateWeather(dt);
      if (this.altar) this.altar.update(dt, this.cameras.main.worldView);
      if (this.altarRite) for (const e of this.enemies) if (e.alive && e.boss) e.update(dt, this.player);   // 칠색조 제단 봉헌: 조작은 멈추고 강하는 흘러간다
      this.updateArenaDrops(dt);
      this.fx.update(dt);
      return;
    }

    this.updateInteract();
    this.player.update(dt, this.inp);
    this.arenaStep(this.player, 1);
    this.consumeInput();
    if (this.test) this.testUpdate();
    this.props.update(time, dt);
    if (this.npcs) this.npcs.update(dt, this.player);
    this.cullEnemies();
    for (const e of this.enemies) if (e.alive && !e.asleep) e.update(dt, this.player);
    for (const w of this.wanderers) w.update(dt, this.player);
    this.guardSafeZones();
    this.updateResting();
    this.drawCorruption();
    this.combat.updateProjectiles(dt);
    this.combat.updateZones(dt);
    this.updatePickups(dt);
    this.updateCovers();
    this.updateHazards();
    this.updateRooms(dt);
    if (this.tutorial) { this.tutorial.update(dt); if (this.tutorial.done && !this.tutorial.flash) { this.tutorial.destroy(); this.tutorial = null; } }   // 🎓 강제 실습 튜토리얼
    if (this.trainer) {
      this.trainer.update(dt);
      if (!this.arenaRoom && this.room !== this.trainer.room) { this.trainer.destroy(); this.trainer = null; }   // 정화를 마치고 아레나를 떠나면
    }
    this.updatePortal(dt);
    this.updateOverdrive(dt);
    this.updateLights(dt);
    this.updateAtmosphere(dt);
    if (this.side) this.side.update(dt, this.cameras.main.worldView);
    if (this.altar) this.altar.update(dt, this.cameras.main.worldView);
    this.updateWeather(dt);
    this.updateCracks(dt);
    this.updateArenaDrops(dt);
    this.updateCranes(dt);
    if ((this.bonusT = (this.bonusT || 0) - dt) <= 0) { this.bonusT = .5; this.tryBonusCards(); }   // 현장 기술머신 전송 (전투 데이터 · 빛나는 TM 코어)
    this.updateAbyss(dt);
    this.fx.update(dt);
    const cam = this.cameras.main;
    cam.followOffset.x += (-this.player.face * 26 - cam.followOffset.x) * Math.min(1, dt * 3);
    cam.followOffset.y += ((this.room && this.room.gateFront ? 90 : 10) - cam.followOffset.y) * Math.min(1, dt * 3);   // 방울탑 · 창기둥 정문 앞: 주인공을 화면 아래로 — 거대한 정면을 올려다보게
    const ry = this.room ? cam.scrollY - this.room.Y0 * TILE : 0;   // 세로 흐름은 방 안에서만 살짝 (텍스처 여유 16px 안 — 2D 월드에서 땅 띠가 하늘에 비치지 않게)
    this.bgFar.tilePositionX = cam.scrollX * .15 + time * .002; this.bgFar.tilePositionY = Phaser.Math.Clamp(ry * .03, 0, 8);   // 하늘이 천천히 흐른다
    for (const t of Object.values(this.bgMids)) { t.tilePositionX = cam.scrollX * .4; t.tilePositionY = Phaser.Math.Clamp(ry * .06, 0, 16); }
  }

  // 진행도에 따른 분위기 (방의 depth 를 2초쯤에 걸쳐 따라간다)
  //  초입: 나뭇잎 사이로 비스듬히 내리쬐는 햇빛 줄기 + 떠다니는 금빛 먼지 · 따뜻하고 선명한 색
  //  보스방 쪽: 햇빛이 사라지고 채도가 빠지며 어두워진다 + 포스트 비네팅이 좁고 진해진다 (안개·검붉은 테두리는 UIScene)
  updateAtmosphere(dt) {
    const want = this.atmoDepthOf(this.room);
    this.atmoRush = Math.max(0, (this.atmoRush || 0) - dt);   // ✨ 샛길 정화 순간: 2초쯤에 걸쳐 환하게 (평소엔 천천히 따라간다)
    this.atmo = (this.atmo ?? want) + (want - (this.atmo ?? want)) * Math.min(1, dt * (this.atmoRush > 0 ? 2.2 : .6));
    const c = this.atmo, cam = this.cameras.main, v = cam.worldView, t = this.time.now / 1000;
    const cg = this.room && this.room.arenaStyle ? Math.min(c, .3) : c;   // 보스 결전장은 제 색 그대로 (침식 깊이로 칙칙해지지 않게)
    if (this.gradeFx) { const fx = this.gradeFx; fx.reset(); fx.saturate(.18 - cg * .62, true); fx.brightness(1.06 - cg * .2, true); }
    // 비네트: 가운데 맑은 시야를 넓게 (예전보다 2.5배 이상) · 가장자리 15~20% 에만 검붉은 긴장감
    if (this.vignetteFx) { this.vignetteFx.radius = .98 - c * .06; this.vignetteFx.strength = .18 + c * .17; }
    // 햇빛 줄기: 화면 위에서 비스듬히 (깊어질수록 옅어지다 사라진다)
    const R0 = this.room, sky = R0 && !R0.under ? skyKindOf(R0) : null;
    const sun = Phaser.Math.Clamp(1 - c / .45, 0, 1) * (R0 && (R0.under || R0.trailEnd) ? (R0.isPurified ? .7 : .25) : sky === 'coronet' || sky === 'icirrus' ? .4 : 1) * (R0 && (R0.seaBridge || R0.rain || R0.drought || R0.stratosphere || sky === 'spear' || sky === 'distortion' || sky === 'spiral' || sky === 'plant' || sky === 'heart') ? 0 : 1);   // 설산 · 습지엔 옅은 겨울 햇살 · 천계엔 금빛 햇살 · 가라르 지하엔 없다
    if (!this.sunbeams) {
      sunbeamTexture(this);
      this.sunbeams = [0, 1, 2, 3, 4].map(i => this.add.image(0, 0, 'fx:sunbeam').setOrigin(.5, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0c0).setDepth(23.5).setAngle(-22).setAlpha(0));
      this.worldObjs.push(...this.sunbeams);
    }
    this.sunbeams.forEach((b, i) => {
      const fx = ((i * .23 + .08 + v.x / (v.width * 6)) % 1.15) - .05, sway = Math.sin(t * .35 + i * 1.7);
      b.setVisible(sun > .01).setPosition(v.x + fx * v.width * 1.2 + v.height * .2, v.y - 6)
        .setDisplaySize(v.width * (.07 + (i % 3) * .035), v.height * 1.35).setAlpha(sun * (.16 + .07 * sway));
    });
    if (sun > .2 && Math.random() < sun * .5) {   // 햇빛 속을 떠다니는 금빛 먼지
      this.fx.burst(v.x + Math.random() * v.width, v.y + Math.random() * v.height * .8, [0xfff0c0, 0xffe08a], 1, 8, { grav: -6, bounce: false, glow: true, life: 1.6, size: 1, drag: .99 });
    }
    // 하늘: 침식이 옅으면 맑은 낮 하늘이 먼 배경을 덮고, 깊어질수록 먼·중간 배경이 검붉게 가라앉는다
    if (this.daySky) this.daySky.setAlpha(Phaser.Math.Clamp(1 - c / .42, 0, 1) * .9 * (R0 && (R0.seaBridge || R0.rain || R0.drought || R0.stratosphere || sky) ? 0 : R0 && R0.trailEnd ? .35 : 1));
    const bgT = R0 && R0.trailEnd ? 0x9a80a8 : sky ? 0xffffff : c < .45 ? 0xffffff : lerpColor(0xffffff, 0x6a3a4a, (c - .45) / .55);   // 방울탑 정문 앞: 잿빛 보라 하늘 · 신오 랜드마크는 제 하늘빛 그대로
    this.bgFar.setTint(bgT); for (const t of Object.values(this.bgMids)) t.setTint(R0 && (R0.trailEnd || sky) ? bgT : c < .45 ? lerpColor(0xd8e4f0, 0xffffff, c / .45) : bgT);
    this.updateRegionSkies(dt, sky);
    if (R0 && R0.spearGate && Math.random() < .35) {   // 창기둥 대정문 소용돌이에서 푸른 · 분홍 빛 알갱이가 흘러나온다
      const gx = R0.doorTx * TILE + 8, gy = R0.F * TILE;
      this.fx.burst(gx + (Math.random() - .5) * 150, gy - 40 - Math.random() * 130, [0x8ac8ff, 0xff9ad8, 0xffffff], 1, 10, { angle: -Math.PI / 2, spread: 1, up: 8, grav: -8, bounce: false, glow: true, life: 2, size: 1, drag: .99 });
    }
    if (R0 && R0.plantGate && Math.random() < .35) {   // 플랜트 최종 격리 게이트 틈에서 검붉은 다이맥스 불티가 새어 나온다
      const gx = R0.doorTx * TILE + 8, gy = R0.F * TILE;
      this.fx.burst(gx + (Math.random() - .5) * 20, gy - 50 - Math.random() * 110, [0xff2a4a, 0xff8aa0, 0xffffff], 1, 14, { angle: Math.random() < .5 ? 0 : Math.PI, spread: .5, up: 6, grav: -6, bounce: false, glow: true, life: 1.8, size: 1, drag: .99 });
    }
    if (R0 && R0.trailEnd && Math.random() < .45) {   // 방울탑 정문 틈 · 균열에서 보랏빛 침식 홀씨가 새어 나온다
      const gx = R0.doorTx * TILE + 8, gy = R0.F * TILE;
      this.fx.burst(gx + (Math.random() - .5) * 360, gy - Math.random() * 90, [0x9a3aff, 0x6a1a8a, 0xd080ff], 1, 10, { angle: -Math.PI / 2, spread: .9, up: 10, grav: -10, bounce: false, glow: true, life: 2.4, size: Math.random() < .3 ? 2 : 1, drag: .99 });
    }
    if (c > .45 && Math.random() < (c - .45) * .9) {   // 보스방에 가까울수록: 독기 어린 보라 · 핏빛 홀씨가 바닥에서 피어오른다
      this.fx.burst(v.x + Math.random() * v.width, v.y + v.height * (.55 + Math.random() * .45), [0x9a3aff, 0xff3a6a, 0x6a1a4a], 1, 10, { angle: -Math.PI / 2, spread: .8, up: 12, grav: -12, bounce: false, glow: true, life: 2.2, size: Math.random() < .3 ? 2 : 1, drag: .99 });
    }
  }

  updateLights(dt) {
    const t = this.time.now / 1000;
    // 마을에선 주변광이 따뜻하고 밝게 바뀐다 (천천히)
    if (this.webgl && this.ambient) {
      const amb = this.stage.palette.ambient, c = this.atmo || 0;
      // 침식 깊이: 초입은 햇살처럼 밝고 따뜻하게(×1.45 + 금빛) → 보스방 앞은 검붉고 어둡게(×0.62 + 핏빛)
      const deep = c < .5 ? lerpColor(lerpColor(amb, 0xffe2b0, .35), amb, c / .5) : lerpColor(amb, 0x5a1a24, (c - .5) / .5 * .55);
      const lit = c < .5 ? shade(deep, 1.45 - c * .9) : shade(deep, 1 - (c - .5) * .76);
      let base = this.room && this.room.type === 'village' ? 0x8a7258 : this.room && this.room.under ? shade(lit, .72) : lit;   // 시내는 따뜻하게 · 지하는 어둡게
      // 최소 밝기 보장: 보스방 바로 앞 · 가장 깊은 동굴이라도 초입 밝기의 60% 아래로는 떨어지지 않는다 (방울탑 안은 72%) — 지형·함정이 늘 보이게
      const lit0 = shade(lerpColor(amb, 0xffe2b0, .35), 1.45), floorK = this.room && this.room.pillar ? .78 : this.room && this.room.tower ? .72 : .6;
      base = lumFloor(base, lumOf(lit0) * floorK);
      if (this.room && this.room.trail) base = lerpColor(lit0, 0xffd8a0, .25);   // 방울로드: 가을 햇살처럼 환하고 따뜻하게
      const R = this.room;   // 호연: 가뭄은 붉은 주황 · 폭우는 푸르게 · 131번 수로는 에메랄드 밤바다(85%) · 하늘기둥 안 78% · 성층권은 별빛처럼 맑게
      if (R && R.drought) base = lumFloor(lerpColor(base, 0xff6a3a, .38), lumOf(lit0) * .62);
      if (R && R.rain) base = lumFloor(lerpColor(base, 0x3a5aa0, .32), lumOf(lit0) * .6);
      if (R && R.seaBridge) base = shade(lerpColor(lit0, 0xa0ffe0, .22), .85);
      if (R && R.trailEnd) base = shade(lerpColor(lit0, 0x6a4a8a, .45), .56);   // 방울탑 정문 앞: 탑 안의 침식이 스며 나와 햇살이 잦아든다
      if (R && R.stratosphere) base = lumFloor(lerpColor(base, 0xa8d8ff, .25), lumOf(lit0) * .8);
      if (R && R.snowPeak) base = shade(lerpColor(lit0, 0xdce8ff, .3), .85);   // 천관산 만년설 협곡: 하얀 눈빛 85%
      if (R && R.spear) base = shade(lerpColor(lit0, 0xd8ccff, .25), .8);   // 창기둥 안: 흰 대리석 · 결정빛 80%
      if (R && R.distortion) base = shade(lerpColor(lit0, 0xb898ff, .3), .75);   // 깨어진 세계: 보랏빛 성운 75%
      if (R && R.icirrus) base = shade(lerpColor(lit0, 0xdce8ff, .3), .85);   // 설화시티 겨울 습지: 은빛 85%
      if (R && R.spiral) base = shade(lerpColor(lit0, 0xf0e4e8, .2), .8);   // 용나선탑 안: 80%
      if (R && (R.azure || R.origin)) base = shade(lerpColor(lit0, 0xfff4d8, .35), .95);   // 천계: 95% 눈부신 성역
      const pure = this.level && this.level.purified;   // 진 엔딩 뒤엔 가라르 지하도 황금빛 새벽처럼 밝게
      if (R && R.plant && !pure) base = shade(lerpColor(lit0, 0xff9aaa, .3), .75);   // 너클시티 지하 에너지 플랜트: 75% · 검붉은 다이맥스 빛
      if (R && R.plantHeart && !pure) base = shade(lerpColor(lit0, 0xff6a80, .4), .72);   // 블랙나이트의 심장: 핏빛 반응로 (70% 남짓)
      if (R && R.isPurified && !pure) base = lumFloor(lerpColor(lit0, 0xfff0c8, .3), lumOf(lit0) * .97);   // ✨ 정화한 샛길 구역: 지하여도 95 ~ 100% 밝기 · 따뜻한 햇살빛
      const AMB = R && R.arenaStyle && ARENA_AMB[R.arenaStyle];   // 보스 결전장: 그 방 그림이 살도록 밝기 하한 · 방 색
      if (AMB) base = lumFloor(lerpColor(base, AMB[0], .35), lumOf(lit0) * AMB[1]);
      if (this.overdrive) base = lerpColor(base, 0xffd8a0, .3);   // 유대의 불꽃 오버드라이브: 황금빛이 아레나를 밝힌다
      const tgt = Phaser.Display.Color.IntegerToRGB(base), a = this.ambient, k = Math.min(1, dt * 1.5);
      a.setTo(Math.round(a.red + (tgt.r - a.red) * k), Math.round(a.green + (tgt.g - a.green) * k), Math.round(a.blue + (tgt.b - a.blue) * k));
      this.lights.setAmbientColor(a.color);
    }
    for (const tc of this.torches) {
      const f = .85 + Math.sin(t * 6 + tc.phase) * .08 + Math.sin(t * 17 + tc.phase * 3) * .05;
      tc.glow.setAlpha(.55 * f);
      if (tc.light) tc.light.setIntensity(1.3 * f);
    }
    if (this.playerLight) {
      const p = this.player;
      this.playerLight.setPosition(p.x, p.y - 4).setColor(typeColor(p.types[0])).setIntensity(p.mega.active ? 2.4 : 1.5).setRadius(p.mega.active ? 200 : 150);
    }
    // 관문 네온 막대 (좌우 문은 세로, 위아래 문은 가로)
    const g = this.gateG; g.clear();
    for (const gate of this.gates) {
      if (gate.open) continue;
      const r = gate.rect, col = this.stage.palette.edge;
      g.fillStyle(col, .25 + Math.sin(t * 8) * .08); g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      g.fillStyle(col, .9);
      if (gate.vertical) for (let yy = r.y; yy < r.y + r.h; yy += 6) g.fillRect(r.x + ((yy / 6) % 2 ? 0 : 3), yy + ((t * 40) % 6), 3, 3);
      else for (let xx = r.x; xx < r.x + r.w; xx += 6) g.fillRect(xx + ((t * 40) % 6), r.y + ((xx / 6) % 2 ? 0 : 3), 3, 3);
    }
  }

  // ---------------- 세뇌 비주얼 (모든 적을 그래픽 두 장에 한 번에) ----------------
  // 발밑: 검보라 그림자 타원 3겹 + 바닥에서 일렁이는 침식 불꽃 / 머리: 붉은 안광이 남기는 실선 궤적
  // 발밑 타원 그림자는 크기별로 한 번 구운 텍스처(흰색)를 적마다 두 장의 이미지로 띄워 색·투명도·위치만 바꾼다
  //  (예전엔 매 프레임 그래픽에 한 줄씩 fillRect). 일렁이는 침식 불꽃 몇 줄과 안광 궤적만 그래픽에 그린다
  // 엘리트: 몸을 감싸 일렁이는 붉은 오라 + 위로 피어오르는 불티 + 머리 위 [왕관 · 포켓몬 이름 · 작은 체력바]
  drawElite(e, t) {
    if (!e.eliteGlow) {
      e.eliteGlow = this.add.image(e.x, e.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2a1a).setDepth(e.sprite.depth - .3);
      e.eliteTag = this.add.text(e.x, e.top, e.name, { fontFamily: 'Galmuri9', fontSize: '8px', color: '#ffd8c8', stroke: '#1a0404', strokeThickness: 3, resolution: 1 }).setOrigin(0, 1).setDepth(56);
      if (!this.textures.exists('elite-crown')) {   // 9×7 금빛 왕관 (붉은 보석)
        const cg = this.make.graphics({ x: 0, y: 0, add: false }), rows = ['k...k...k', 'yk.kyk.ky', 'yykyyykyy', 'yyyyryyyy', 'yyyyyyyyy', 'ooooooooo', 'kkkkkkkkk'];
        const col = { y: 0xffd050, o: 0xc88a20, r: 0xff3a3a, k: 0x3a1a04 };
        rows.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) { cg.fillStyle(col[ch], 1); cg.fillRect(x, y, 1, 1); } }));
        cg.generateTexture('elite-crown', 9, 7); cg.destroy();
      }
      e.eliteCrown = this.add.image(e.x, e.top, 'elite-crown').setOrigin(0, 1).setDepth(56);
      e.eliteBar = this.add.graphics().setDepth(56);
    }
    const on = e.alive && e.sprite.alpha > .05;
    e.eliteGlow.setVisible(on); e.eliteTag.setVisible(on); e.eliteCrown.setVisible(on); e.eliteBar.setVisible(on);
    if (!on) return;
    const s = (e.b.height / 18) * (1 + Math.sin(t * 7 + e.auraT) * .1);
    e.eliteGlow.setPosition(e.x, e.y).setScale(s * .9, s * 1.1).setAlpha(.55 + Math.sin(t * 11) * .12);
    // 이름표 줄: [왕관 이름] 가운데 정렬 · 그 아래 작은 체력바
    const by = Math.round(e.top - 6), tw = e.eliteTag.width, x0 = Math.round(e.x - (tw + 11) / 2);
    e.eliteCrown.setPosition(x0, by - 6); e.eliteTag.setPosition(x0 + 11, by - 3);
    const bw = 26, bx = Math.round(e.x - bw / 2), k = Math.max(0, Math.min(1, e.hp / e.maxhp));
    e.eliteBar.clear().fillStyle(0x1a0404, .85).fillRect(bx - 1, by - 1, bw + 2, 4).fillStyle(0x4a1a1a, 1).fillRect(bx, by, bw, 2)
      .fillStyle(k > .5 ? 0x6ae06a : k > .25 ? 0xffc040 : 0xff4a3a, 1).fillRect(bx, by, Math.ceil(bw * k), 2);
    if (!e.asleep && Math.random() < .5) this.fx.embers(e.x + (Math.random() - .5) * e.b.width, e.bottom - 2, [0xff3a2a, 0xffa040, 0xffe08a], 1, { speed: 45 });
  }

  drawCorruption() {
    const g = this.corruptG, tg = this.eyeTrailG, t = this.time.now / 1000;
    g.clear(); tg.clear();
    for (const e of this.enemies) if (e.elite) this.drawElite(e, t);
    for (const e of this.enemies) {
      const a = e.corrupt && !e.asleep ? e.sprite.alpha * (e.fade ? .45 : 1) : 0;
      if (a <= .02) { if (e.shadowA) { e.shadowA.setVisible(false); e.shadowB.setVisible(false); } continue; }
      // 공중의 적은 아래 바닥에 그림자가 진다 (높을수록 작고 옅게)
      const gy = e.flying || e.def.noclip ? this.groundBelow(e.x, e.bottom) : e.bottom;
      const far = Math.max(.25, 1 - Math.max(0, gy - e.bottom) / 140);
      // 발밑 오라는 은은하게: 예전 크기의 약 55% · 투명도 0.15~0.2 (포켓몬 도트가 먼저 보이도록)
      const lv = e.cLv || 1, W = (e.b.width * .9 + 10) * (e.boss ? 1.3 : .85 + lv * .1) * .55 * (.94 + Math.sin(t * 4 + e.auraT) * .06) * far;
      if (!e.shadowA) { e.shadowA = this.add.image(0, 0, 'px').setOrigin(0).setDepth(17.99); e.shadowB = this.add.image(0, 0, 'px').setOrigin(0).setDepth(17.995); }
      const aura = e.boss ? 0x7a22c0 : lv >= 4 ? 0xb01a3a : lv >= 3 ? 0x9a1a7a : 0x7a22c0;
      this.placeEllipse(e.shadowA, e.x, gy - 1, W, W * .24, aura, (.12 + lv * .03) * a * far);
      this.placeEllipse(e.shadowB, e.x, gy - 1, W * .6, W * .16, 0x2a0a40, (.16 + lv * .04) * a * far);
      const n = e.boss ? 3 : Math.max(2, lv);
      if (!e.boss && lv >= 2) {   // 침식 단계 점 (머리 위 · Ⅱ 보라 · Ⅲ 자홍 · Ⅳ 핏빛)
        const col = CLV_COLOR[lv - 1], y0 = Math.round(e.top - (e.elite ? 16 : 6)), x0 = Math.round(e.x - (lv - 1) * 2);
        for (let i = 0; i < lv; i++) { g.fillStyle(0x14081c, .8 * a); g.fillRect(x0 + i * 4 - 2, y0 - 1, 4, 4); g.fillStyle(col, a); g.fillRect(x0 + i * 4 - 1, y0, 2, 2); }
      }
      for (let i = 0; i < n; i++) {
        const fx = Math.round(e.x + Math.sin(i * 12.9 + t * .7 + e.auraT) * W * .7);
        const fh = Math.round((2 + (Math.sin(t * 6 + i * 3.1 + e.auraT) * .5 + .5) * (e.boss ? 6 : 3)) * far);
        g.fillStyle(aura, (.18 + lv * .04) * a * far); g.fillRect(fx, gy - 1 - fh, 1, fh);
      }
      // 붉은 안광 궤적: 오래된 점일수록 가늘고 옅게
      const tr = e.eyeTrail;
      if (tr.length > 1) {
        const w = e.boss ? 2 : 1;   // 얇고 날카롭게: 가는 붉은 실선 + 아주 옅은 번짐
        for (let i = 1; i < tr.length; i++) {
          const k = i / (tr.length - 1), p0 = tr[i - 1], p1 = tr[i];
          tg.lineStyle(w + 1, 0xff0044, .16 * k * a); tg.lineBetween(p0.x, p0.y, p1.x, p1.y);
          tg.lineStyle(w, k > .6 ? 0xff7a8a : 0xff2a4a, Math.min(1, .5 + k * .6) * a); tg.lineBetween(p0.x, p0.y, p1.x, p1.y);
        }
      }
    }
  }

  // 도트 타원 텍스처: 가로 반지름(0.5 단위)·세로 반지름별로 처음 한 번만 굽는다 (textures.exists 로 재사용)
  ellipseTex(rx, ry) {
    rx = Math.round(rx * 2) / 2;
    const R = Math.max(1, Math.round(ry)), cx0 = Math.ceil(rx) + 1, key = `cel-${rx}-${R}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      for (let y = -R; y <= R; y++) {
        const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (R + .5)) ** 2)));
        if (w > 0) g.fillRect(cx0 - w, R + y, w * 2, 1);
      }
      g.generateTexture(key, cx0 * 2, R * 2 + 1);
      g.destroy();
    }
    return { key, cx0, R };
  }

  // pixelEllipse 와 같은 자리·같은 모양으로 구운 타원 이미지를 놓는다
  placeEllipse(im, cx, cy, rx, ry, color, alpha) {
    const t = this.ellipseTex(rx, ry);
    if (im.texture.key !== t.key) im.setTexture(t.key);
    im.setPosition(Math.round(cx) - t.cx0, Math.round(cy) - t.R).setTint(color).setAlpha(alpha).setVisible(true);
  }

  // Z기술 시네마틱용 시간 정지 (Player.zCinematic)
  zFreeze(sec) { this.zFreezeT = sec; this.physics.world.pause(); }

  // ---------------- 보스 무대 소품 ----------------
  //  뮤츠 아레나: 검붉은 침식 배양액이 찬 거대한 유리 인큐베이터 (가까이 오면 깨지며 뮤츠가 떠오른다 — bossIntro)
  //  칠색조 아레나(방울탑 옥상): 황금빛 노을 하늘 · 구름 · 해 · 바닥을 따라 기와지붕
  buildBossProps() {
    this.capsule = null;
    for (const r of this.level.rooms) {
      if (r.boss === 'mewtwo' && !r.cleared) {
        const x = r.cx, gy = this.floorAt(x, r);
        const img = this.add.image(x, gy + 1, capsuleArt(this)).setOrigin(.5, 1).setDepth(8);
        const glow = this.add.image(x, gy - 40, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2a4a).setScale(1.4, 2.2).setAlpha(.35).setDepth(7.9);
        this.tweens.add({ targets: glow, alpha: .18, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.worldObjs.push(img, glow);
        this.capsule = { img, glow, x, gy, room: r };
      }
      if (r.arenaStyle) continue;
      if (r.rooftop) this.rooftopSky(r);
      if (r.spiralTop) this.spiralTopSky(r);
      if (r.stratosphere) this.stratosphereSky(r);
    }
    // 보스 결전장 다층 배경 (systems/ArenaBackdrop.js) · 뮤츠 결전장의 사슬 크레인 발판
    this.arenaDrops = [];
    for (const r of this.level.rooms) if (r.arenaStyle) {
      const bd = buildArenaBackdrop(this, r);
      r.backdrop = bd; this.arenaDrops.push(bd); this.worldObjs.push(...bd.objs);
      if (r.arena.cranes) this.buildCranes(r);
    }
    this.buildCracks();
  }
  // 용나선탑 꼭대기 흑과 백의 제단: 검은 번개 구름의 황혼 · 오른쪽에 탑과 다리로 맞물려 솟은 거대한 고대 성채(N의 성) · 발치의 구름
  spiralTopSky(r) {
    const W = r.right - r.left, H = r.bottom - r.top, ADD = Phaser.BlendModes.ADD, gy = this.floorAt(r.cx, r);
    if (!this.textures.exists('fx:ncastle')) {   // N의 성 실루엣 (300×220): 성벽 · 첨탑 셋 · 창에 비친 빛 · 탑과 잇는 다리
      const t = this.textures.createCanvas('fx:ncastle', 300, 220), c = t.getContext(), F = (x, y, w, h, col, a = 1) => { c.globalAlpha = a; c.fillStyle = '#' + col.toString(16).padStart(6, '0'); c.fillRect(x, y, w, h); c.globalAlpha = 1; };
      F(60, 120, 240, 100, 0x1e1a2e); for (let x = 60; x < 300; x += 16) F(x, 112, 10, 8, 0x1e1a2e);
      for (const [x, w, h] of [[90, 34, 150], [170, 46, 200], [250, 30, 130]]) { F(x, 220 - h, w, h, 0x24203a); for (let j = 0; j < 30; j++) F(x + w / 2 - j * w / 60, 220 - h - 30 + j, j * w / 30, 1, 0x24203a); for (let y = 220 - h + 20; y < 210; y += 22) F(x + w / 2 - 3, y, 6, 8, 0xffd890, .6); }
      F(0, 150, 70, 8, 0x2a2638); for (let x = 4; x < 70; x += 12) F(x, 158, 3, 30, 0x2a2638);   // 탑과 잇는 다리
      t.refresh();
    }
    const sky = this.add.image(r.left, r.top, regionSkyTexture(this, 'spiral')).setOrigin(0).setDisplaySize(W, H).setDepth(1.65);
    const castle = this.add.image(r.right - 20, gy + 30, 'fx:ncastle').setOrigin(1, 1).setDepth(1.7).setScale(Math.max(1.2, H / 260)).setAlpha(.92);
    const glow = this.add.image(castle.x - castle.displayWidth * .45, castle.y - castle.displayHeight * .6, 'glow').setBlendMode(ADD).setTint(0xffd890).setScale(3).setAlpha(.18).setDepth(1.71);
    const clouds = [];
    for (let k = 0; k < 6; k++) {
      const cl = this.add.image(r.left + (k + .5) * W / 6, r.top + H * (.15 + (k % 3) * .1), 'glow').setTint(0x0a0a18).setScale(3.2, .8).setAlpha(.6).setDepth(1.72);
      this.tweens.add({ targets: cl, x: cl.x + 34, duration: 8000 + k * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      clouds.push(cl);
    }
    const sea = this.add.tileSprite(r.left, gy - 10, W, 28, 'fx:cloudsea').setOrigin(0, 0).setDepth(10.5).setAlpha(.55).setTint(0x8a8aa8);
    if (this.textures.exists('fx:cloudsea')) this.cloudSeas.push({ o: sea, sp: 10 }); else sea.setVisible(false);
    this.worldObjs.push(sky, castle, glow, ...clouds, sea);
  }
  // 천공의 제단(하늘기둥 꼭대기): 위는 성층권의 별과 에메랄드 오로라 · 아래는 끝없는 구름바다
  stratosphereSky(r) {
    const W = r.right - r.left, H = r.bottom - r.top, ADD = Phaser.BlendModes.ADD;
    if (!this.textures.exists('fx:strato')) {
      const t = this.textures.createCanvas('fx:strato', 4, 128), c = t.getContext(), g = c.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, '#02040e'); g.addColorStop(.45, '#0a1a3a'); g.addColorStop(.75, '#1a4a6a'); g.addColorStop(1, '#8ac8d8');
      c.fillStyle = g; c.fillRect(0, 0, 4, 128); t.refresh();
    }
    if (!this.textures.exists('fx:cloudsea')) {   // 구름바다 (128×28 반복)
      const t = this.textures.createCanvas('fx:cloudsea', 128, 28), c = t.getContext();
      for (let k = 0; k < 14; k++) { const x = (k * 37) % 128, y = 6 + (k * 11) % 10, rr = 7 + (k * 5) % 7; c.fillStyle = k % 3 ? '#e8f0f4' : '#c0d4e0'; for (const dx of [-128, 0, 128]) { c.beginPath(); c.arc(x + dx, y + rr * .6, rr, 0, Math.PI * 2); c.fill(); } }
      c.fillStyle = '#e8f0f4'; c.fillRect(0, 14, 128, 14); c.fillStyle = '#ffffff'; for (let x = 0; x < 128; x += 9) c.fillRect(x, 6 + (x % 5), 4, 1);
      t.refresh();
    }
    const objs = [this.add.image(r.left, r.top, 'fx:strato').setOrigin(0).setDisplaySize(W, H).setDepth(1.65)];
    for (let k = 0; k < 70; k++) {   // 별
      const st = this.add.image(r.left + ((k * 97) % 1000) / 1000 * W, r.top + ((k * 61) % 1000) / 1000 * H * .6, 'px').setTint(k % 5 ? 0xffffff : 0xa8ffe0).setScale(k % 7 ? .5 : 1).setAlpha(.8).setDepth(1.68);
      if (k % 3 === 0) this.tweens.add({ targets: st, alpha: .2, duration: 700 + (k % 9) * 160, yoyo: true, repeat: -1 });
      objs.push(st);
    }
    for (let k = 0; k < 5; k++) {   // 에메랄드 오로라 커튼
      const au = this.add.image(r.left + W * (.1 + k * .2), r.top + H * (.18 + (k % 2) * .08), 'glow').setOrigin(.5, 0).setBlendMode(ADD).setTint(k % 2 ? 0x4affb0 : 0x2ad8a0).setScale(2.6, 3.4).setAlpha(.3).setDepth(1.7);
      this.tweens.add({ targets: au, scaleX: 3.4, alpha: .14, x: au.x + 30, duration: 2600 + k * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      objs.push(au);
    }
    const gy = this.floorAt(r.cx, r);
    const far = this.add.tileSprite(r.left, gy - 22, W, 28, 'fx:cloudsea').setOrigin(0, 0).setDepth(1.75).setAlpha(.55).setTint(0xb8d0e8);   // 먼 구름바다
    const near = this.add.tileSprite(r.left, gy - 8, W, 28, 'fx:cloudsea').setOrigin(0, 0).setDepth(10.5).setAlpha(.9);   // 제단 발치를 감싸는 구름
    this.cloudSeas.push({ o: far, sp: 6 }, { o: near, sp: 14 });
    objs.push(far, near);
    this.worldObjs.push(...objs);
  }

  // ---------------- 하늘기둥: 삭아 버린 바닥 ----------------
  //  수천 년 바닷바람에 깎인 발판(통과 발판 'P' 줄) 몇 군데에 금이 가 있다. 그 위에 0.4초 서 있으면 와르르 무너지고(아래층으로 떨어질 뿐 — 다시 오를 수 있다),
  //  대시로 지나가면 무너지지 않는다. 무너진 발판은 4초 뒤 돌 조각이 다시 맞물리며 돌아온다 (월드 생성 · 저장과 무관한 런타임 기믹)
  buildCracks() {
    const lv = this.level, G = lv.grid; this.cracks = [];
    this.crackG = this.add.graphics().setDepth(10.55); this.worldObjs.push(this.crackG);
    for (const r of lv.rooms) {
      if (!r.pillar) continue;
      const ty0 = Math.floor(r.top / TILE) + 2, ty1 = Math.floor(r.bottom / TILE) - 1, tx0 = Math.floor(r.left / TILE), tx1 = Math.floor(r.right / TILE) - 1;
      for (let ty = ty0; ty <= ty1; ty++) {
        if (ty === r.F) continue;   // 방의 바닥줄은 늘 튼튼하다
        for (let tx = tx0; tx <= tx1; tx++) {
          if (G[ty][tx] !== 'P' || G[ty - 1][tx] !== '.') continue;
          let e = tx; while (e + 1 <= tx1 && G[ty][e + 1] === 'P' && G[ty - 1][e + 1] === '.') e++;
          if (e - tx + 1 >= 3 && (tx * 7 + ty * 13) % 5 < 3) {   // 3칸 이상 발판 중 대략 절반
            const a = tx + (e - tx >= 5 ? 1 : 0), b = Math.min(e, a + 3);
            this.cracks.push({ r, ty, tx0: a, tx1: b, idx: [], t: 0, down: false, seed: tx * 31 + ty });
          }
          tx = e;
        }
      }
    }
  }
  updateCracks(dt) {
    const g = this.crackG; if (!g || !this.cracks || !this.cracks.length) return;
    g.clear();
    const R = this.room; if (!R || !R.pillar) return;
    const p = this.player, lv = this.level, now = this.time.now / 1000;
    for (const c of this.cracks) {
      if (c.r !== R) continue;
      const x0 = c.tx0 * TILE, x1 = (c.tx1 + 1) * TILE, y = c.ty * TILE;
      if (c.down) {
        c.t -= dt;
        const inside = p.b.right > x0 && p.b.x < x1 && p.bottom > y - 2 && p.b.y < y + TILE;
        if (c.t <= 0 && !inside) this.restoreCrack(c);
        continue;
      }
      const on = p.onGround && !p.dash && Math.abs(p.bottom - y) < 4 && p.b.right > x0 + 2 && p.b.x < x1 - 2;
      if (on) {
        if (c.t === 0) Sfx.play('crack');
        c.t += dt;
        if (Math.random() < .5) this.fx.burst(x0 + Math.random() * (x1 - x0), y + 2, [0x8a9a96, 0x5a6a66], 1, 30, { angle: Math.PI / 2, spread: .6, up: -10, grav: 300, life: .5 });
        if (c.t >= .4) { this.collapseCrack(c); continue; }
      } else c.t = 0;
      // 금 간 자리: 흔들릴수록 붉게 번쩍인다
      const k = c.t / .4, jit = k > 0 ? Math.sin(now * 60) * k * 1.2 : 0;
      g.lineStyle(1, k > 0 ? 0xff8a5a : 0x1a1410, k > 0 ? .95 : .85);
      for (let x = x0 + 3; x < x1 - 3; x += 7 + (c.seed + x) % 5) {
        const s = (c.seed + x) % 3;
        g.beginPath(); g.moveTo(x + jit, y + 1); g.lineTo(x + 2 + jit, y + 3 + s); g.lineTo(x - 1 + jit, y + 6); g.lineTo(x + 3 + jit, y + 9 + s); g.strokePath();
        g.lineBetween(x + 2 + jit, y + 3 + s, x + 6 + jit, y + 4 + s);
      }
      g.fillStyle(0x4affb0, .18 + Math.sin(now * 3 + c.seed) * .08); g.fillRect(x0 + 1, y - 1, x1 - x0 - 2, 1);   // 발판 위 옅은 경고선
    }
  }
  setCrackTiles(c, on) {
    const lv = this.level;
    for (let tx = c.tx0, i = 0; tx <= c.tx1; tx++, i++) {
      const r = lv.cellRoom.get(Math.floor(tx / CW) + ',' + Math.floor(c.ty / CH)); if (!r || !r.layer) continue;
      if (!on) { c.idx[i] = lv.data[c.ty][tx]; lv.grid[c.ty][tx] = '.'; lv.data[c.ty][tx] = -1; r.layer.removeTileAt(tx - r.X0, c.ty - r.Y0); }
      else { lv.grid[c.ty][tx] = 'P'; lv.data[c.ty][tx] = c.idx[i]; const t = r.layer.putTileAt(c.idx[i], tx - r.X0, c.ty - r.Y0); if (t) t.setCollision(false, false, true, false); }
    }
  }
  collapseCrack(c) {
    this.setCrackTiles(c, false);
    c.down = true; c.t = 4;
    const x0 = c.tx0 * TILE, w = (c.tx1 - c.tx0 + 1) * TILE, y = c.ty * TILE;
    this.fx.shatter(x0 + w / 2, y + TILE / 2, w, TILE, { n: 22, speed: 140, up: 40 });
    this.fx.burst(x0 + w / 2, y + 4, [0x8a9a96, 0x5a6a66, 0xc8d8d0], 26, 120, { up: 30, life: .8 });
    this.fx.shake(.01, 220); Sfx.play('boom');
    this.events.emit('toast', '발밑이 무너졌다! 금 간 바닥은 대시로 지나가자');
  }
  restoreCrack(c) {
    this.setCrackTiles(c, true);
    c.down = false; c.t = 0;
    const x0 = c.tx0 * TILE, w = (c.tx1 - c.tx0 + 1) * TILE, y = c.ty * TILE;
    this.fx.burst(x0 + w / 2, y + 4, [0x4affb0, 0xc8d8d0], 14, 60, { up: 20, glow: true, life: .6 });
    this.fx.glow(x0 + w / 2, y + 4, 40, 0x4affb0, 400, .5);
  }

  // ---------------- 호연 날씨 ----------------
  //  가뭄 길: 붉은 화산재가 내리고 땅속에서 불티가 솟는다 · 폭우 해안: 세찬 빗줄기 + 푸른 번개 · 131번 수로: 초록 바람 입자
  //  성층권: 별바람 · 구름바다가 흐른다
  updateWeather(dt) {
    const R = this.room, v = this.cameras.main.worldView, t = this.time.now;
    for (const c of this.cloudSeas || []) c.o.tilePositionX += dt * c.sp;
    // 화면 전체 색 베일: 가뭄은 붉은 주황 · 폭우는 짙은 청색
    if (!this.weatherVeil) { this.weatherVeil = this.add.image(0, 0, 'px').setOrigin(0).setDepth(23.4).setAlpha(0); this.worldObjs.push(this.weatherVeil); }
    const veilA = R && R.drought ? .1 : R && R.rain ? .14 : 0, wv = this.weatherVeil;
    wv.setAlpha(wv.alpha + (veilA - wv.alpha) * Math.min(1, dt * 2)).setVisible(wv.alpha > .005);
    if (R && (R.drought || R.rain)) wv.setTint(R.drought ? 0xff5a1a : 0x0a2a6a).setBlendMode(R.drought ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    wv.setPosition(v.x - 4, v.y - 4).setDisplaySize(v.width + 8, v.height + 8);
    // 빗줄기
    const raining = !!(R && R.rain);
    if (raining && !this.rainSheet) {
      if (!this.textures.exists('fx:rain')) {
        const tx = this.textures.createCanvas('fx:rain', 64, 64), c = tx.getContext();
        for (let k = 0; k < 22; k++) { const x = (k * 29) % 64, y = (k * 41) % 64, len = 6 + (k % 4) * 2; c.strokeStyle = k % 3 ? 'rgba(170,200,255,.55)' : 'rgba(230,240,255,.8)'; c.lineWidth = 1; for (const dy of [0, -64]) for (const dx of [0, 64, -64]) { c.beginPath(); c.moveTo(x + dx, y + dy); c.lineTo(x + dx - len * .35, y + dy + len); c.stroke(); } }
        tx.refresh();
      }
      this.rainSheet = this.add.tileSprite(0, 0, 64, 64, 'fx:rain').setOrigin(0).setDepth(23.6).setAlpha(0);
      this.worldObjs.push(this.rainSheet);
    }
    if (this.rainSheet) {
      const rs = this.rainSheet, a = raining ? .85 : 0;
      rs.setAlpha(rs.alpha + (a - rs.alpha) * Math.min(1, dt * 2.5)).setVisible(rs.alpha > .01);
      if (rs.visible) { rs.setPosition(v.x, v.y).setSize(v.width, v.height); rs.tilePositionX = v.x - t * .12; rs.tilePositionY = v.y - t * .42; }
    }
    if (raining) {
      if (Math.random() < .5) this.fx.burst(v.x + Math.random() * v.width, this.groundBelow(v.x + Math.random() * v.width, v.y + v.height * .4) - 1, [0xa8c8ff, 0xffffff], 2, 40, { angle: -Math.PI / 2, spread: 1.6, up: 20, life: .25, size: 1 });   // 튀는 빗방울
      this.boltT = (this.boltT ?? 2) - dt;
      if (this.boltT <= 0) { this.boltT = 2.4 + Math.random() * 3.6; this.lightning(v); }
    }
    if (R && R.drought) {   // 화산재 · 불티
      if (Math.random() < .7) this.fx.burst(v.x + Math.random() * v.width * 1.2, v.y - 2, [0x6a5a5a, 0x8a7a7a, 0x4a3a3a, 0xff6a2a], 1, 18, { angle: Math.PI / 2 + .4, spread: .5, up: -6, grav: 10, bounce: false, life: 3.4, size: Math.random() < .3 ? 2 : 1, drag: .995 });
      if (Math.random() < .25) this.fx.embers(v.x + Math.random() * v.width, v.y + v.height, [0xff3a1a, 0xff8a2a, 0xffd060], 1, { speed: 30, up: 60, life: 1.6 });
    }
    if (R && R.seaBridge && Math.random() < .45) this.fx.burst(v.x - 4, v.y + Math.random() * v.height * .85, [0x8affc8, 0x4affb0, 0xd8fff0], 1, 150, { angle: -.05, spread: .2, up: 0, grav: -4, bounce: false, glow: true, life: 2.4, size: 1, drag: .998 });   // 초록 바람
    // 눈발 (천관산 만년설 협곡 · 창기둥 정문 앞): 굵은 눈 · 가는 눈 두 겹이 비스듬히 흩날리고 가끔 돌풍
    const snowing = !!(R && (R.snowPeak || R.icirrus));
    if (snowing && !this.snowSheets) {
      snowTexture(this);
      this.snowSheets = [0, 1].map(i => this.add.tileSprite(0, 0, 64, 64, 'fx:snow').setOrigin(0).setDepth(23.55 + i * .01).setAlpha(0).setTileScale(i ? 1.7 : 1));
      this.worldObjs.push(...this.snowSheets);
    }
    if (this.snowSheets) this.snowSheets.forEach((sh, i) => {
      const a = snowing ? (i ? .6 : .85) : 0;
      sh.setAlpha(sh.alpha + (a - sh.alpha) * Math.min(1, dt * 2)).setVisible(sh.alpha > .01);
      if (sh.visible) { sh.setPosition(v.x, v.y).setSize(v.width, v.height); sh.tilePositionX = v.x / (i ? 1.7 : 1) - t * (i ? .012 : .022) + Math.sin(t / 1300 + i * 2) * 10; sh.tilePositionY = v.y / (i ? 1.7 : 1) - t * (i ? .02 : .04); }
    });
    if (snowing && Math.random() < .1) this.fx.burst(v.x - 4, v.y + Math.random() * v.height * .8, [0xffffff, 0xe8f0ff], 3, 170, { angle: .12, spread: .3, up: 0, grav: 12, bounce: false, life: 1.8, size: 1, drag: .995 });   // 돌풍
    if (R && R.icirrus && Math.random() < .3) this.fx.burst(v.x + Math.random() * v.width, v.y + v.height * (.7 + Math.random() * .3), [0x8ac8ff, 0xd8f0ff, 0xffffff], 1, 10, { angle: -Math.PI / 2, spread: .6, up: 16, grav: -12, bounce: false, glow: true, life: 2.6, size: 1, drag: .995 });   // 물가에서 피어오르는 푸른 빛무리
    if (R && R.spiral) {   // 용나선탑: 가끔 창밖 하늘을 가르는 검은 번개 · 백열 불티
      this.darkBoltT = (this.darkBoltT ?? 3) - dt;
      if (this.darkBoltT <= 0) { this.darkBoltT = 3 + Math.random() * 4; this.darkBolt(v.x + v.width * (.15 + Math.random() * .7), v.y - 6, v.y + v.height * (.4 + Math.random() * .3), true); }
      if (Math.random() < .2) this.fx.embers(v.x + Math.random() * v.width * .3, v.y + v.height, [0xfff0d0, 0xffd090], 1, { speed: 26, up: 50, life: 1.6 });
    }
    if (R && (R.azure || R.origin) && Math.random() < .35) this.fx.burst(v.x + Math.random() * v.width, v.y - 2, [0xfff0b0, 0xffffff, 0xd8e8ff], 1, 14, { angle: Math.PI / 2, spread: .6, up: -4, grav: 6, bounce: false, glow: true, life: 3.4, size: Math.random() < .3 ? 2 : 1, drag: .995 });   // 천계: 금빛 · 은빛 빛 가루가 천천히 내린다
    if (R && R.distortion && Math.random() < .55) this.fx.burst(v.x + Math.random() * v.width, v.y + v.height + 4, [0xc08aff, 0x8affe8, 0xffffff], 1, 18, { angle: -Math.PI / 2, spread: .4, up: 34, grav: -22, bounce: false, glow: true, life: 3.2, size: Math.random() < .3 ? 2 : 1, drag: .995 });   // 깨어진 세계: 빛 알갱이가 거꾸로 떠오른다
    if (R && R.spear && Math.random() < .25) this.fx.burst(v.x + Math.random() * v.width, v.y + Math.random() * v.height, [0xe8dcff, 0x8ac8ff, 0xff9ad8], 1, 8, { angle: -Math.PI / 2, spread: 1.2, up: 4, grav: -3, bounce: false, glow: true, life: 2.6, size: 1, drag: .995 });   // 창기둥 안: 결정빛 티끌
    if (R && R.plant) {   // 지하 플랜트: 천장 배선에서 튀는 전기 불티 · 바닥에서 피어오르는 검붉은 티끌
      if (Math.random() < .2) this.fx.burst(v.x + Math.random() * v.width, v.y + 4, [0xffd0a0, 0xff5a3a, 0xffffff], 2, 60, { angle: Math.PI / 2, spread: .8, up: -10, grav: 300, bounce: true, glow: true, life: .7, size: 1 });
      if (Math.random() < .3) this.fx.burst(v.x + Math.random() * v.width, v.y + v.height * (.6 + Math.random() * .4), [0xff3a5a, 0xa01a3a], 1, 10, { angle: -Math.PI / 2, spread: .6, up: 14, grav: -10, bounce: false, glow: true, life: 2.4, size: 1, drag: .995 });
    }
    if (R && R.plantHeart && Math.random() < .5) this.fx.burst(v.x + Math.random() * v.width, v.y + v.height + 4, this.overdrive ? [BOND_GOLD, BOND_CRIMSON, 0xffffff] : [0xff2a4a, 0x6a0a1e, 0xff8aa0], 1, 16, { angle: -Math.PI / 2, spread: .4, up: 30, grav: -20, bounce: false, glow: true, life: 3, size: Math.random() < .3 ? 2 : 1, drag: .995 });   // 심장: 검붉은 빛 알갱이가 솟는다 (오버드라이브는 황금빛)
    if (R && R.stratosphere && Math.random() < .3) this.fx.burst(v.x + v.width + 4, v.y + Math.random() * v.height * .7, [0xa8ffe0, 0xffffff], 1, 120, { angle: Math.PI + .05, spread: .2, up: 0, grav: 0, bounce: false, glow: true, life: 2.6, size: 1, drag: 1 });   // 성층권 별바람
  }
  // 푸른 번개: 하늘에서 지그재그로 내리꽂히고 화면이 번쩍인다
  lightning(v) {
    const x = v.x + v.width * (.15 + Math.random() * .7), y1 = this.groundBelow(x, v.y + 10);
    const g = this.add.graphics().setDepth(23.7).setBlendMode(Phaser.BlendModes.ADD);
    const pts = [[x, v.y - 6]]; let cx = x;
    for (let y = v.y + 14; y < y1; y += 14 + Math.random() * 10) { cx += (Math.random() - .5) * 26; pts.push([cx, y]); }
    pts.push([cx, y1]);
    for (const [w, col, a] of [[5, 0x2a6aff, .45], [2, 0x8ad8ff, .95], [1, 0xffffff, 1]]) { g.lineStyle(w, col, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.strokePath(); }
    this.tweens.add({ targets: g, alpha: 0, duration: 320, delay: 60, onComplete: () => g.destroy() });
    this.cameras.main.flash(140, 120, 170, 255, true);
    this.fx.burst(cx, y1 - 2, [0x8ad8ff, 0xffffff], 10, 120, { up: 60, glow: true, life: .4 });
    Sfx.play('zap');
  }
  // 신오 랜드마크 하늘 (화면에 붙는 먼 하늘 · 먼 배경 위 · 중경 아래): 지역마다 한 겹씩 만들어 두고 그 지역 방에 들어서면 서서히 겹친다
  //  천관산 협곡: 시린 설산 하늘 + 오로라 커튼 + 먼 하늘에 세로로 찢어진 시공 균열 · 창기둥 안: 연보랏빛 새벽하늘 + 별 + 균열 · 깨어진 세계: 보랏빛 · 청록 성운 두 겹이 천천히 흐른다
  buildRegionSkies(ox, oy, vw, vh) {
    this.regionSkies = {}; this.nebulae = null; this.nebulae2 = null;
    const ADD = Phaser.BlendModes.ADD;
    for (const kind of new Set(this.level.rooms.map(skyKindOf).filter(Boolean))) {
      const objs = [this.add.image(ox, oy, regionSkyTexture(this, kind)).setOrigin(0).setDisplaySize(vw, vh)];
      if (kind === 'azure' || kind === 'origin') {   // 천계: 황금빛 · 은빛 성운 두 겹 · 별 · (시초의 방은 사방으로 뻗는 빛살)
        const key = nebulaTexture(this, 'fx:nebula:gold', ['255,214,140', '220,230,255', '190,170,255']);
        const n1 = this.add.tileSprite(ox, oy, vw, vh, key).setOrigin(0).setAlpha(kind === 'origin' ? .35 : .9).setBlendMode(ADD);
        objs.push(n1); (this.nebulae2 = this.nebulae2 || []).push(n1);
        for (let k = 0; k < (kind === 'origin' ? 16 : 50); k++) objs.push(this.add.image(ox + ((k * 97) % 1000) / 1000 * vw, oy + ((k * 61) % 1000) / 1000 * vh * .6, 'px').setTint(k % 3 ? 0xffffff : 0xffe8a8).setScale(k % 5 ? .5 : 1).setAlpha(.8));
        if (kind === 'origin') for (let k = 0; k < 12; k++) {
          const ray = this.add.image(ox + vw / 2, oy + vh * .3, 'glow').setOrigin(.5, 0).setBlendMode(ADD).setTint(0xffe8b0).setScale(.5, 7).setAlpha(.18).setAngle(k * 30);
          this.tweens.add({ targets: ray, angle: ray.angle + 30, duration: 16000, repeat: -1 });
          objs.push(ray);
        }
      } else if (kind === 'spiral') {   // 용나선탑: 검은 번개 구름이 천천히 돈다 (번개는 updateWeather)
        for (let k = 0; k < 6; k++) {
          const cl = this.add.image(ox + vw * (k + .5) / 6, oy + vh * (.12 + (k % 3) * .1), 'glow').setTint(0x0a0a18).setScale(3.6, 1.2).setAlpha(.55);
          this.tweens.add({ targets: cl, x: cl.x + 40, duration: 7000 + k * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          objs.push(cl);
        }
        for (let k = 0; k < 14; k++) objs.push(this.add.image(ox + ((k * 89) % 997) / 997 * vw, oy + ((k * 53) % 409) / 409 * vh * .5, 'px').setTint(0xb8c8ff).setScale(.5).setAlpha(.5));
      } else if (kind === 'plant' || kind === 'heart') {   // 가라르 지하: 천천히 맥동하는 검붉은 반응로 빛 기둥 · 떠도는 청록 홀로그램 티끌 (심장은 한가운데 거대한 붉은 핵이 맥동한다)
        const n = kind === 'heart' ? 3 : 5;
        for (let k = 0; k < n; k++) {
          const col = this.add.image(ox + vw * (k + .5) / n, oy + vh, 'glow').setOrigin(.5, 1).setBlendMode(ADD).setTint(0xff2a4a).setScale(1.4, 6).setAlpha(.16);
          this.tweens.add({ targets: col, alpha: .3, duration: 1400 + k * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          objs.push(col);
        }
        if (kind === 'heart') {
          const cx = ox + vw / 2, cy = oy + vh * .36, coreG = this.add.image(cx, cy, 'glow').setBlendMode(ADD).setTint(0xff1a3a).setScale(5).setAlpha(.35);
          this.tweens.add({ targets: coreG, scale: 5.8, alpha: .5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });   // 반응로의 심장 박동
          objs.push(coreG);
          for (let k = 0; k < 10; k++) {   // 핵 둘레를 도는 검붉은 육각 결정
            const st = this.add.image(cx + Math.cos(k / 10 * Math.PI * 2) * 120, cy + Math.sin(k / 10 * Math.PI * 2) * 50, 'px').setTint(k % 2 ? 0xff5a7a : 0xa01a3a).setScale(2, 3).setAlpha(.8);
            objs.push(st);
          }
        } else for (let k = 0; k < 30; k++) objs.push(this.add.image(ox + ((k * 97) % 1000) / 1000 * vw, oy + ((k * 61) % 1000) / 1000 * vh, 'px').setTint(k % 3 ? 0x4af0ff : 0xff5a7a).setScale(.5).setAlpha(.45));
      } else if (kind === 'distortion') {
        nebulaTexture(this);
        const n1 = this.add.tileSprite(ox, oy, vw, vh, 'fx:nebula').setOrigin(0).setAlpha(.95);
        const n2 = this.add.tileSprite(ox, oy, vw, vh, 'fx:nebula').setOrigin(0).setAlpha(.5).setTileScale(1.7).setBlendMode(ADD);
        objs.push(n1, n2); this.nebulae = [n1, n2];
        for (let k = 0; k < 40; k++) {
          const st = this.add.image(ox + ((k * 89) % 997) / 997 * vw, oy + ((k * 53) % 409) / 409 * vh, 'px').setTint(k % 3 ? 0xd8a0ff : 0x8affe8).setScale(k % 6 ? .5 : 1).setAlpha(.7);
          if (k % 3 === 0) this.tweens.add({ targets: st, alpha: .15, duration: 600 + (k % 7) * 200, yoyo: true, repeat: -1 });
          objs.push(st);
        }
      } else {
        for (let k = 0; k < (kind === 'spear' ? 50 : 22); k++) objs.push(this.add.image(ox + ((k * 97) % 1000) / 1000 * vw, oy + ((k * 61) % 1000) / 1000 * vh * .5, 'px').setTint(k % 4 ? 0xffffff : 0xd8c8ff).setScale(k % 5 ? .5 : 1).setAlpha(.75));   // 별
        for (let k = 0; k < 4; k++) {   // 오로라 커튼 (설화시티 습지는 은빛 · 연푸른 빛)
          const au = this.add.image(ox + vw * (.14 + k * .24), oy + vh * (.08 + (k % 2) * .06), 'glow').setOrigin(.5, 0).setBlendMode(ADD).setTint(kind === 'icirrus' ? [0xd8ecff, 0x8ac8ff, 0xe8f0ff, 0xa8d8ff][k] : [0x6affc8, 0x8ab8ff, 0xc08aff, 0x4affd8][k]).setScale(2.4, 2.2).setAlpha(kind === 'spear' ? .2 : kind === 'icirrus' ? .22 : .3);
          this.tweens.add({ targets: au, scaleX: 3.2, x: au.x + 22, duration: 3000 + k * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          objs.push(au);
        }
        // 먼 하늘의 시공 균열 (천관산 협곡): 세로로 찢어진 틈 (보랏빛 번짐 · 분홍 테 · 하얀 심) — 창기둥 안은 제단 뒤 균열이 따로 있어 하늘엔 없다
        if (kind === 'coronet') {
          const rx = ox + vw * .72, ry = oy + vh * .06, g = this.add.graphics().setBlendMode(ADD), pts = [];
          for (let y = 0, x = 0, k = 0; y <= vh * .4; y += 6, k++) { pts.push([x, y]); x += Math.sin(k * 1.7) * 3 + Math.cos(k * .9) * 2; }
          for (const [w, col, a] of [[10, 0x6a4aff, .25], [4, 0xff8ad8, .55], [2, 0xd8e8ff, .9], [1, 0xffffff, 1]]) { g.lineStyle(w, col, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.strokePath(); }
          g.setPosition(rx, ry);
          const halo = this.add.image(rx, ry + vh * .2, 'glow').setBlendMode(ADD).setTint(0xb090ff).setScale(1.6, 4).setAlpha(.35);
          this.tweens.add({ targets: [g, halo], alpha: { from: .6, to: 1 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          objs.push(g, halo);
        }
      }
      const box = this.add.container(0, 0, objs).setDepth(.6).setAlpha(0).setVisible(false);
      box.setScrollFactor(0, 0, true);
      this.regionSkies[kind] = box;
      this.worldObjs.push(box);
    }
  }
  updateRegionSkies(dt, want) {
    for (const [k, box] of Object.entries(this.regionSkies || {})) {
      const a = k === want ? 1 : 0;
      box.setAlpha(box.alpha + (a - box.alpha) * Math.min(1, dt * 1.6)).setVisible(box.alpha > .01);
    }
    for (const n of this.nebulae2 || []) if (n.parentContainer && n.parentContainer.visible) n.tilePositionX = this.cameras.main.scrollX * .04 + this.time.now * .002;
    if (this.nebulae && this.regionSkies.distortion && this.regionSkies.distortion.visible) { const cam = this.cameras.main; this.nebulae[0].tilePositionX = cam.scrollX * .05 + this.time.now * .003; this.nebulae[1].tilePositionX = cam.scrollX * .1 - this.time.now * .002; this.nebulae[1].tilePositionY = this.time.now * .001; }
  }
  // 창기둥 제단 뒤 차원 균열이 열린다 (디아루가 · 펄기아를 모두 정화한 뒤): 땅울림 · 검붉은 섬광 · 색수차 → 소용돌이가 자라난다
  //  방이 cleared 로 저장되니 다시 와도 열려 있다 (Props.buildRift)
  openRift(room) {
    const R = this.props && this.props.rift;
    if (!R || R.room !== room || R.open) return;
    Sfx.play('rift'); Sfx.play('thunder');
    this.fx.shake(.018, 1200); chromatic(this, .018, 1300); shockwave(this, R.x, R.y, .03, 900);
    this.cameras.main.flash(300, 160, 20, 60, true);
    this.props.openRift();
    for (let k = 0; k < 4; k++) this.time.delayedCall(k * 220, () => this.fx.ring(R.x, R.y, 50 + k * 40, k % 2 ? 0x8a2aff : 0xff2a4a, 600));
    this.fx.burst(R.x, R.y, [0xff2a4a, 0x8a2aff, 0x12000a], 40, 240, { glow: true, life: .9 });
    this.time.delayedCall(1200, () => this.events.emit('toast', '제단 뒤로 차원의 균열이 열렸다 — 소용돌이 너머는 세계의 뒷면 『깨어진 세계』'));
  }
  // 검은 번개: 짙은 남빛 굵은 줄기 + 푸른 심 (bg: 배경 하늘에서 — 피해 없음)
  darkBolt(x, y0, y1, bg = false) {
    const g = this.add.graphics().setDepth(bg ? 1.8 : 23.7), pts = [[x, y0]]; let cx = x;
    for (let y = y0 + 14; y < y1; y += 14 + Math.random() * 10) { cx += (Math.random() - .5) * 26; pts.push([cx, y]); }
    pts.push([cx, y1]);
    for (const [w, col, a] of [[7, 0x06060e, .9], [3, 0x2a3a8a, .9], [1, 0x8ab0ff, 1]]) { g.lineStyle(w, col, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.strokePath(); }
    this.tweens.add({ targets: g, alpha: 0, duration: 360, delay: 60, onComplete: () => g.destroy() });
    if (!bg) { this.cameras.main.flash(120, 30, 40, 110, true); this.fx.burst(cx, y1 - 2, [0x2a3a8a, 0x8ab0ff, 0xffffff], 12, 140, { up: 80, glow: true, life: .4 }); Sfx.play('thunder'); }
  }
  // 흑과 백의 제단: 하늘에서 거대한 다크스톤(검은 구체 · 푸른 금) / 라이트스톤(흰 구체 · 주황 금)이 내려와 금이 가며 갈라진다 → 그 자리에 영웅이 강림 (ms 뒤 done(x, y))
  stoneSplit(room, light, done) {
    const cam = this.cameras.main, cx = room.cx, gy = this.floorAt(cx, room), ey = Math.max(room.top + 60, gy - 120);
    const body = light ? 0xf4f0e8 : 0x14141e, crack = light ? 0xffa040 : 0x4a8aff, rim = light ? 0xffd8a0 : 0x6a9aff;
    const g = this.add.graphics().setDepth(31), o = { y: cam.worldView.y - 60, s: .3, k: 0 }, cracks = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + Math.random() * .3, pts = [[0, 0]]; let x = 0, y = 0; for (let j = 0; j < 4; j++) { x += Math.cos(a + (Math.random() - .5) * .8) * 9; y += Math.sin(a + (Math.random() - .5) * .8) * 9; pts.push([x, y]); } cracks.push(pts); }
    const draw = () => {
      g.clear(); const R = 36 * o.s;
      g.fillStyle(rim, .25); g.fillCircle(cx, o.y, R * 1.25);
      g.fillStyle(body, 1); g.fillCircle(cx, o.y, R);
      g.fillStyle(light ? 0xffffff : 0x2a2a3a, .8); g.fillCircle(cx - R * .35, o.y - R * .35, R * .25);
      g.lineStyle(2, rim, .9); g.strokeCircle(cx, o.y, R);
      if (o.k > 0) for (const pts of cracks) { g.lineStyle(2, crack, 1); g.beginPath(); g.moveTo(cx, o.y); for (const [x, y] of pts.slice(0, 1 + Math.ceil(o.k * 4))) g.lineTo(cx + x * o.s, o.y + y * o.s); g.strokePath(); }
    };
    if (!light) for (let k = 0; k < 3; k++) this.time.delayedCall(k * 230, () => { const x = cx + (k - 1) * 130; this.darkBolt(x, cam.worldView.y - 10, this.floorAt(x, room)); });
    else { cam.flash(300, 255, 240, 220, true); for (let k = 0; k < 20; k++) this.time.delayedCall(k * 30, () => this.fx.embers(cx + (Math.random() - .5) * 200, gy, [0xffffff, 0xffd090, 0xffa040], 1, { speed: 40, up: 120, life: 1 })); }
    Sfx.play('boss'); this.fx.shake(.008, 1000);
    this.tweens.add({ targets: o, y: ey, s: 1, duration: 900, delay: 300, ease: 'Cubic.easeOut', onUpdate: draw });
    this.time.delayedCall(1300, () => { this.tweens.add({ targets: o, k: 1, duration: 450, onUpdate: draw }); Sfx.play('crack'); this.fx.shake(.012, 450); });
    this.time.delayedCall(1850, () => {
      g.destroy();
      this.fx.shatter(cx, ey, 72, 72, { n: 40, speed: 280, up: 120, scale: 1.8, depth: 46 });
      this.fx.burst(cx, ey, [crack, rim, 0xffffff], 40, 260, { glow: true, life: .8 });
      for (let k = 0; k < 3; k++) this.time.delayedCall(k * 100, () => this.fx.ring(cx, ey, 50 + k * 50, k % 2 ? 0xffffff : crack, 500));
      cam.flash(220, ...(light ? [255, 220, 170] : [90, 140, 255]), true); this.fx.shake(.024, 600); shockwave(this, cx, ey, .045, 800); chromatic(this, .014, 700);
      Sfx.play(light ? 'fire' : 'thunder'); Sfx.play('boom'); Sfx.play('shatter');
      // 날개를 펼친다: 빛 날개 두 장이 양옆으로 활짝
      const wing = this.add.graphics().setDepth(30).setBlendMode(Phaser.BlendModes.ADD).setPosition(cx, ey).setScale(.1);
      for (const d of [-1, 1]) { wing.fillStyle(crack, .35); wing.fillTriangle(0, -10, d * 130, -70, d * 110, 30); wing.fillStyle(0xffffff, .25); wing.fillTriangle(0, -6, d * 100, -50, d * 80, 14); }
      this.tweens.add({ targets: wing, scale: 1, duration: 360, ease: 'Back.easeOut', onComplete: () => this.tweens.add({ targets: wing, alpha: 0, duration: 600, onComplete: () => wing.destroy() }) });
      if (done) done(cx, ey);
    });
  }
  // 최종장: 아르세우스를 정화하면 온 세상의 심연이 황금빛 파동으로 걷힌다
  originDawn(boss, title = '세상이 정화되었다', sub = '창조의 빛이 온 세상의 심연을 걷어 냈다 · 아르세우스가 본래의 순백색 빛을 되찾았다') {
    const cam = this.cameras.main, v = cam.worldView, x = boss.x, y = boss.y;
    Sfx.play('purify_world'); cam.flash(1200, 255, 246, 220, true); shockwave(this, x, y, .05, 1400);
    for (let k = 0; k < 8; k++) this.time.delayedCall(k * 180, () => { this.fx.ring(x, y, 120 + k * 120, k % 2 ? 0xffffff : 0xffd870, 1100); this.fx.glow(x, y, 80 + k * 30, 0xfff4d0, 600, .5); });
    for (let k = 0; k < 40; k++) this.time.delayedCall(k * 40, () => this.fx.burst(v.x + Math.random() * v.width, v.y + v.height, [0xffd870, 0xfff4d0, 0xffffff], 1, 40, { angle: -Math.PI / 2, spread: .4, up: 120, grav: -40, bounce: false, glow: true, life: 2, size: 2 }));
    this.level.purified = true;
    this.time.delayedCall(600, () => { this.tintRooms(); this.colorTorches(); });
    this.time.delayedCall(900, () => this.events.emit('banner', title, sub));
  }
  rooftopSky(r) {
    const W = r.right - r.left, H = r.bottom - r.top, ADD = Phaser.BlendModes.ADD;
    if (!this.textures.exists('fx:sunset')) {
      const t = this.textures.createCanvas('fx:sunset', 4, 128), c = t.getContext(), g = c.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, '#3a2a6a'); g.addColorStop(.35, '#d8605a'); g.addColorStop(.65, '#ffb060'); g.addColorStop(1, '#ffe0a0');
      c.fillStyle = g; c.fillRect(0, 0, 4, 128); t.refresh();
    }
    const sky = this.add.image(r.left, r.top, 'fx:sunset').setOrigin(0).setDisplaySize(W, H).setDepth(1.65);
    const sun = this.add.image(r.cx + W * .22, r.top + H * .42, 'glow').setBlendMode(ADD).setTint(0xfff0b0).setScale(3.2).setAlpha(.85).setDepth(1.7);
    const sunCore = this.add.image(sun.x, sun.y, 'glow').setBlendMode(ADD).setTint(0xffffff).setScale(1.2).setAlpha(.9).setDepth(1.71);
    const clouds = [];
    for (let k = 0; k < 6; k++) {
      const cl = this.add.image(r.left + (k + .5) * W / 6, r.top + H * (.25 + (k % 3) * .14), 'glow').setTint(k % 2 ? 0xffd0b0 : 0xffe8d0).setScale(2.6 + (k % 3), .5).setAlpha(.5).setDepth(1.72);
      this.tweens.add({ targets: cl, x: cl.x + 30, duration: 9000 + k * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      clouds.push(cl);
    }
    // 기와지붕: 바닥선을 따라 짙은 기와 줄과 처마 끝 황금 장식
    const gy = this.floorAt(r.cx, r);
    const roofs = this.add.tileSprite(r.left, gy - 3, W, 8, kawaraArt(this)).setOrigin(0, 0).setDepth(10.45);
    this.worldObjs.push(sky, sun, sunCore, ...clouds, roofs);
  }

  // 보스 고유 등장 연출: 처리했으면 true (그동안 아레나는 잠겨 있고, 끝나면 beginBoss)
  bossIntro(key, room) {
    const cx = room.cx, gy = this.floorAt(cx, room), ADD = Phaser.BlendModes.ADD, cam = this.cameras.main;
    const run = this.arenaRun, later = (ms, f) => this.time.delayedCall(ms, () => { if (this.arenaRoom === room && this.arenaRun === run && !this.over) f(); });   // 같은 아레나를 다시 시작해도 앞 판의 연출은 이어지지 않는다
    const spawn = (x, f) => later(0, () => { this.beginBoss(key, room, x); const b = this.boss; if (b && b.bossKey === key) f(b); });
    if (key === 'mewtwo') {   // 배양 캡슐 속 붉은 안광 → 사이코 파동 → 유리관이 산산조각 → 공중으로 떠오른다
      const cap = this.capsule && this.capsule.room === room ? this.capsule : null, x = cap ? cap.x : cx;
      const eyes = [-4, 4].map(d => this.add.image(x + d, gy - 44, 'glow').setBlendMode(ADD).setTint(0xff2a2a).setScale(.12).setAlpha(0).setDepth(8.2));
      Sfx.play('boss'); this.fx.shake(.006, 600);
      this.tweens.add({ targets: eyes, alpha: 1, scale: .2, duration: 160, yoyo: true, repeat: 2, hold: 90 });
      later(650, () => { for (let k = 0; k < 3; k++) this.time.delayedCall(k * 120, () => this.fx.ring(x, gy - 40, 30 + k * 26, 0xff6ad8, 420)); this.fx.glow(x, gy - 40, 60, 0xb05aff, 500, .9); Sfx.play('wave'); });
      later(1150, () => {
        eyes.forEach(o => o.destroy());
        if (cap) { cap.img.setTexture(capsuleArt(this, true)); cap.glow.destroy(); }
        this.fx.shatter(x, gy - 36, 34, 66, { n: 46, speed: 260, up: 140, scale: 1.6, depth: 46 });
        this.fx.burst(x, gy - 30, [0x8a0a1e, 0xff2a4a, 0x3a0612], 40, 220, { up: 120, life: .9 });
        cam.flash(260, 255, 200, 230, true); this.fx.shake(.02, 500); Sfx.play('shatter'); Sfx.play('boom');
      });
      later(1200, () => spawn(x, b => b.introPath(x, gy - 34, x, gy - 96, 1100, 'Cubic.easeOut')));
      return true;
    }
    if (key === 'ho-oh' && this.altarRite && this.altarRite.room === room) {   // 🌈 제단 봉헌: 갈라진 무지개빛 후광에서 일곱 빛깔 깃털 · 성스러운 불꽃을 흩뿌리며 제단 위로 묵직하게 (2.2 ~ 3.5초)
      const ax = this.altarRite.x, ly = this.altarRite.top - 64, v = cam.worldView;
      for (let k = 0; k < 30; k++) this.time.delayedCall(k * 35, () => this.fx.burst(v.x + Math.random() * v.width, v.y - 4, [0xff4a4a, 0xff9a2a, 0xffe04a, 0x6aff6a, 0x4ac8ff, 0x8a6aff, 0xff6ad8], 1, 30, { angle: Math.PI / 2, spread: .6, up: -20, grav: 40, bounce: false, glow: true, life: 1.6, size: 2 }));
      spawn(ax, b => {
        b.introPath(ax, room.top - 70, ax, ly, 1150, 'Cubic.easeOut', () => {
          this.fx.ring(ax, ly + 50, 130, 0xffb040, 650); this.fx.ring(ax, ly + 50, 80, 0xffffff, 450);
          for (let k = 0; k < 7; k++) this.time.delayedCall(k * 50, () => this.fx.ring(ax, ly + 20, 40 + k * 18, [0xff4a4a, 0xff9a2a, 0xffe04a, 0x6aff6a, 0x4ac8ff, 0x8a6aff, 0xff6ad8][k], 520));
          this.fx.burst(ax, ly + 50, [0xffd040, 0xff6a3a, 0xffffff], 44, 260, { up: 120, glow: true });
          this.fx.shake(.028, 600); Sfx.play('roar'); Sfx.play('boom');
        });
        for (let k = 0; k < 20; k++) this.time.delayedCall(k * 55, () => { if (b.alive) this.fx.burst(b.x + (Math.random() - .5) * 70, b.y, [0xff6a2a, 0xffd040, 0xff3a5a, 0x6ac8ff, 0x8aff8a], 3, 90, { angle: -Math.PI / 2, spread: 1.4, up: 40, glow: true, life: .55 }); });
      });
      return true;
    }
    if (key === 'ho-oh') {   // 황금빛 · 무지갯빛 깃털이 흩날리다가, 태양을 등지고 수직 강하해 옥상 한가운데 착지
      const v = cam.worldView;
      for (let k = 0; k < 36; k++) this.time.delayedCall(k * 30, () => this.fx.burst(v.x + Math.random() * v.width, v.y - 4, [0xffd040, 0xff6a3a, 0x8aff8a, 0x6ac8ff, 0xffffff], 1, 30, { angle: Math.PI / 2, spread: .6, up: -20, grav: 40, bounce: false, glow: true, life: 2.4, size: 2, drag: .99 }));
      cam.flash(400, 255, 230, 160, true); Sfx.play('boss');
      later(900, () => spawn(cx, b => {
        b.introPath(cx, room.top - 40, cx, gy - 74, 1000, 'Cubic.easeOut', () => {
          this.fx.ring(cx, gy - 8, 120, 0xffb040, 600); this.fx.ring(cx, gy - 8, 70, 0xffffff, 420);
          this.fx.burst(cx, gy - 6, [0xffd040, 0xff6a3a, 0xffffff], 40, 260, { up: 120, glow: true });
          this.fx.shake(.024, 500); Sfx.play('boom');
        });
        for (let k = 0; k < 16; k++) this.time.delayedCall(k * 60, () => { if (b.alive) this.fx.burst(b.x + (Math.random() - .5) * 60, b.y, [0xff6a2a, 0xffd040, 0xff3a5a], 3, 90, { angle: -Math.PI / 2, spread: 1.4, up: 40, glow: true, life: .5 }); });
      }));
      return true;
    }
    if (key === 'giratina') {   // 깨어진 세계의 왕좌: 음악이 끊기고 → 허공에 거대한 검붉은 눈이 뜨이고 → 세로로 반물질 균열이 찢어지며 → 검은 날개 가시 여섯 · 붉은 안광이 번뜩 → 색수차 · 진동 속에 오리진폼이 포효하며 튀어나온다
      Music.stop();
      const ex = cx, ey = Math.max(room.top + 80, gy - 150), objs = [];
      const dim = this.add.image(room.X0 * TILE - 40, room.Y0 * TILE - 40, 'px').setOrigin(0).setDisplaySize((room.X1 - room.X0) * TILE + 80, (room.Y1 - room.Y0) * TILE + 80).setTint(0x0a0008).setAlpha(0).setDepth(30);   // 아레나 전체 (카메라가 아레나 안에 갇힌다)
      objs.push(dim);
      this.tweens.add({ targets: dim, alpha: .58, duration: 700 });
      this.fx.shake(.006, 1200); Sfx.play('boss');
      // ① 거대한 검붉은 눈: 아몬드꼴 눈꺼풀이 천천히 열린다 (붉은 홍채 · 세로로 갈라진 검은 동공)
      const eye = this.add.graphics().setDepth(31), eo = { open: 0 };
      const eyeGlow = this.add.image(ex, ey, 'glow').setBlendMode(ADD).setTint(0xff1a3a).setScale(5, 1.6).setAlpha(0).setDepth(30.9);
      objs.push(eye, eyeGlow);
      const drawEye = () => {
        eye.clear(); const w = 150, h = 48 * eo.open;
        if (h < 1) return;
        const top = [], bot = [];
        for (let k = 0; k <= 24; k++) { const t = k / 24, x = ex - w + 2 * w * t, dy = Math.sin(Math.PI * t); top.push({ x, y: ey - h * dy }); bot.push({ x, y: ey + h * dy * .9 }); }
        const lid = [...top, ...bot.reverse()];
        eye.fillStyle(0x2a0008, .97); eye.fillPoints(lid, true);
        const ir = Math.min(40, h * .95);
        eye.fillStyle(0x8a0618, 1); eye.fillCircle(ex, ey, ir); eye.fillStyle(0xff2a3a, .9); eye.fillCircle(ex, ey, ir * .72);
        eye.fillStyle(0x000000, 1); eye.fillEllipse(ex, ey, 9, Math.min(ir * 1.9, 70));
        eye.fillStyle(0xffd8d8, .9); eye.fillRect(ex + ir * .35, ey - ir * .5, 4, 4);
        eye.lineStyle(3, 0x14000a, 1); eye.strokePoints(lid, true);
      };
      later(300, () => {
        Sfx.play('ghost');
        this.tweens.add({ targets: eo, open: 1, duration: 800, ease: 'Sine.easeOut', onUpdate: drawEye });
        this.tweens.add({ targets: eyeGlow, alpha: .55, duration: 800 });
      });
      later(1300, () => this.tweens.add({ targets: eo, open: .25, duration: 160, yoyo: true, onUpdate: drawEye }));   // 한 번 가늘게 좁혔다가
      // ② 세로로 찢어지는 반물질 균열 (검은 심 · 검붉은 테 · 보랏빛 번짐)
      const tear = this.add.graphics().setDepth(31.2), to = { h: 0, w: 1 }, jag = [];
      for (let k = 0; k <= 24; k++) jag.push(Math.sin(k * 2.3) * 6 + Math.cos(k * 1.1) * 4);
      objs.push(tear);
      const drawTear = () => {
        tear.clear(); const H2 = to.h / 2;
        if (H2 < 2) return;
        const L = [], Rr = [];
        for (let k = 0; k <= 24; k++) { const y = ey - H2 + k / 24 * to.h, wid = Math.sin(k / 24 * Math.PI) * 30 * to.w + 2; L.push({ x: ex + jag[k] - wid, y }); Rr.push({ x: ex + jag[k] + wid, y }); }
        const poly = [...L, ...Rr.slice().reverse()];
        tear.fillStyle(0x8a2aff, .25); tear.fillPoints(poly.map(q => ({ x: ex + (q.x - ex) * 1.5, y: q.y })), true);
        tear.fillStyle(0x000000, 1); tear.fillPoints(poly, true);
        tear.lineStyle(4, 0xff1a3a, .95); tear.strokePoints(poly, true);
        tear.lineStyle(1, 0xffb0c0, .9); tear.strokePoints(L, false); tear.strokePoints(Rr, false);
      };
      later(1650, () => {
        this.tweens.add({ targets: eye, alpha: 0, duration: 300 }); this.tweens.add({ targets: eyeGlow, alpha: 0, duration: 400 });
        this.tweens.add({ targets: to, h: Math.min(260, gy - room.top - 20), duration: 650, ease: 'Cubic.easeOut', onUpdate: drawTear });
        Sfx.play('rift'); Sfx.play('shatter');
        this.fx.shake(.02, 900); chromatic(this, .022, 1300);
        cam.flash(160, 70, 0, 20, true);
      });
      // ③ 검은 날개 가시 여섯 (붉은 끝) · 균열 속 붉은 안광이 번뜩
      const spikes = [];
      for (const [k, deg] of [-38, -14, 12, 218, 194, 168].entries()) {
        const sp = this.add.graphics().setDepth(31.1).setPosition(ex, ey + (k % 3 - 1) * 26).setAngle(deg).setScale(0, 1);
        sp.fillStyle(0x08000a, 1); sp.fillTriangle(0, -9, 0, 9, 128, 0);
        sp.fillStyle(0xff1a3a, 1); sp.fillTriangle(104, -3, 104, 3, 128, 0);
        sp.lineStyle(1, 0x5a1030, 1); sp.strokeTriangle(0, -9, 0, 9, 128, 0);
        spikes.push(sp); objs.push(sp);
        later(2350 + k * 80, () => { this.tweens.add({ targets: sp, scaleX: 1, duration: 260, ease: 'Back.easeOut' }); if (k % 2 === 0) Sfx.play('swing'); });
      }
      const reds = [-9, 9].map(d => this.add.image(ex + d, ey - 18, 'glow').setBlendMode(ADD).setTint(0xff0a2a).setScale(.16).setAlpha(0).setDepth(31.3));
      objs.push(...reds);
      later(2500, () => { this.tweens.add({ targets: reds, alpha: 1, scale: .24, duration: 120, yoyo: true, repeat: 2, hold: 80 }); this.fx.shake(.012, 400); });
      // ④ 포효하며 튀어나온다 — 오리진폼 (Boss 생성 때 이미 오리진폼: startMega)
      later(3200, () => spawn(ex, b => {
        const sp = b.sprite, d0 = sp.depth;
        sp.setDepth(32).setAlpha(1);
        b.introPath(ex, ey, cx + 30, ey - 8, 650, 'Cubic.easeOut');
        this.time.delayedCall(1400, () => { if (sp.scene) sp.setDepth(d0); });
        Sfx.play('roar'); Sfx.play('boom');
        shockwave(this, ex, ey, .055, 950); chromatic(this, .032, 1300);
        this.fx.shake(.032, 1000); cam.flash(220, 190, 30, 60, true);
        for (let k = 0; k < 4; k++) this.time.delayedCall(k * 110, () => this.fx.ring(ex, ey, 70 + k * 60, k % 2 ? 0xffd860 : 0xff2a4a, 560));
        this.fx.burst(ex, ey, [0xff2a4a, 0x8a2aff, 0x12000a, 0xffd860], 60, 340, { glow: true, life: 1 });
        this.events.emit('toast', `${b.name}이(가) 포효한다!`);
        this.tweens.add({ targets: dim, alpha: 0, duration: 900, delay: 300 });
        this.tweens.add({ targets: spikes, alpha: 0, scaleX: 1.3, duration: 500, delay: 150 });
        this.tweens.add({ targets: reds, alpha: 0, duration: 200 });
        this.tweens.add({ targets: to, h: 0, w: .2, duration: 700, delay: 400, ease: 'Cubic.easeIn', onUpdate: drawTear });
      }));
      this.time.delayedCall(5600, () => { for (const o of objs) if (o.scene) o.destroy(); });   // 중간에 쓰러져도 남지 않게
      return true;
    }
    if (key === 'zekrom') {   // 흑과 백의 제단: 검은 번개가 내리꽂히고 → 다크스톤이 내려와 갈라지며 → 푸른 뇌전을 두른 제크로무가 날개를 펼치며 강림
      this.stoneSplit(room, false, (x, y) => spawn(x, b => {
        b.introPath(x, y, x, this.floorAt(x, room) - b.b.height / 2 - 2, 500, 'Quad.easeIn', () => { const g2 = this.floorAt(x, room); this.fx.ring(x, g2 - 6, 90, 0x4a8aff, 500); this.fx.ring(x, g2 - 6, 50, 0xffffff, 380); this.fx.burst(x, g2 - 4, [0x4a8aff, 0xffffff], 30, 240, { up: 120, glow: true }); this.fx.shake(.02, 400); Sfx.play('boom'); this.events.emit('toast', '제크로무가 날개를 펼친다!'); });
        for (let k = 0; k < 10; k++) this.time.delayedCall(k * 60, () => { if (b.alive) this.fx.burst(b.x + (Math.random() - .5) * 60, b.y, [0x4a8aff, 0xffffff], 3, 90, { up: 0, grav: 0, bounce: false, glow: true, life: .3 }); });
      }));
      return true;
    }
    if (key === 'arceus') {   // 시초의 방: 18 플레이트가 원형 만다라로 돌며 빛기둥 → 빛의 한가운데서 심연에 일부 잠식된 창조신이 신성한 울음과 함께 강림
      Music.stop();
      const ex = cx, ey = Math.max(room.top + 90, gy - 150), objs = [], o = { R: 0, a: 0 };
      const plates = PLATE_COLS.map(col => this.add.rectangle(ex, ey, 8, 12, col).setStrokeStyle(1, 0xffffff, .9).setDepth(31));
      const halos = PLATE_COLS.map(col => this.add.image(ex, ey, 'glow').setBlendMode(ADD).setTint(col).setScale(.35).setAlpha(.7).setDepth(30.9));
      objs.push(...plates, ...halos);
      const place = () => plates.forEach((pl, k) => { const a = o.a + k / plates.length * Math.PI * 2, x = ex + Math.cos(a) * o.R, y = ey + Math.sin(a) * o.R; pl.setPosition(x, y).setAngle(a * 180 / Math.PI + 90); halos[k].setPosition(x, y); });
      this.tweens.add({ targets: o, R: 96, duration: 1200, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: o, a: Math.PI * 4, duration: 3600, ease: 'Sine.easeInOut', onUpdate: place });
      const pillar = this.add.image(ex, gy + 4, 'glow').setOrigin(.5, 1).setBlendMode(ADD).setTint(0xfff4d0).setScale(.4, 0).setAlpha(.9).setDepth(30.8);
      objs.push(pillar);
      Sfx.play('resonate'); this.fx.shake(.006, 1600);
      later(700, () => { this.tweens.add({ targets: pillar, scaleY: (gy - room.top + 40) / 32, scaleX: 1.2, duration: 600, ease: 'Cubic.easeOut' }); Sfx.play('beam'); cam.flash(300, 255, 250, 230, true); });
      later(1700, () => spawn(ex, b => {
        b.sprite.setAlpha(0); this.tweens.add({ targets: b.sprite, alpha: 1, duration: 600 });
        b.introPath(ex, room.top + 10, ex, ey, 1000, 'Cubic.easeOut', () => {
          Sfx.play('arceus'); Sfx.play('boom');
          shockwave(this, ex, ey, .05, 1000); chromatic(this, .016, 900); cam.flash(260, 255, 244, 210, true); this.fx.shake(.026, 800);
          for (let k = 0; k < 4; k++) this.time.delayedCall(k * 110, () => this.fx.ring(ex, ey, 70 + k * 60, k % 2 ? 0xffd870 : 0xffffff, 600));
          this.fx.burst(ex, ey, [0xfff0b0, 0xffffff, 0xffd870], 50, 300, { glow: true, life: .9 });
          this.events.emit('toast', '창조신 아르세우스가 강림했다!');
        });
      }));
      later(3300, () => this.tweens.add({ targets: objs, alpha: 0, duration: 600, onComplete: () => objs.forEach(q => q.destroy()) }));
      this.time.delayedCall(5000, () => { for (const q of objs) if (q.scene) q.destroy(); });
      return true;
    }
    if (key === 'eternatus') {   // 블랙나이트의 심장: 음악이 끊기고 → 레드를 가둔 결정 기둥 위 허공이 검붉게 찢어지며 → 무한다이노가 아공간 균열 속에서 천천히 내려온다
      Music.stop();
      Sprites.ensure(LEGEND_GHOSTS);   // 유대의 불꽃 시네마틱에 나올 정화한 전설들의 환영을 미리 받아 둔다
      const core = this.props && this.props.redCore, ex = core ? core.x : cx, ey = Math.max(room.ty0 * TILE + 40, (core ? core.top : gy - 170) - 50);   // 결정 기둥 위 · 천장 타일 아래
      const tear = this.abyssTearFx(ex, ey, 220, 0xff2a5a);
      this.fx.shake(.008, 1400); Sfx.play('boss'); Sfx.play('rift'); chromatic(this, .012, 900);
      this.events.emit('toast', '결정 속에 레드가 갇혀 있다 — 무한다이노를 정화하자!');
      later(1200, () => spawn(ex, b => {
        b.sprite.setAlpha(0); this.tweens.add({ targets: b.sprite, alpha: 1, duration: 700 });
        b.introPath(ex, ey - 20, ex, ey + 70, 1300, 'Sine.easeInOut', () => {
          Sfx.play('roar'); Sfx.play('boom');
          shockwave(this, ex, ey + 70, .045, 900); chromatic(this, .016, 800); cam.flash(240, 255, 60, 90, true); this.fx.shake(.024, 700);
          for (let k = 0; k < 4; k++) this.time.delayedCall(k * 110, () => this.fx.ring(ex, ey + 70, 60 + k * 50, k % 2 ? 0xffffff : 0xff2a5a, 560));
          this.fx.burst(ex, ey + 70, [0xff2a5a, 0x2a0612, 0xffa0b8], 50, 300, { glow: true, life: .9 });
          this.events.emit('toast', '무한다이노가 아공간에서 강림했다!');
          tear.close();
        });
      }));
      this.time.delayedCall(4000, () => { if (tear.g.scene && !tear.closing) tear.close(); });
      return true;
    }
    if (key === 'darkrai') {   // 바닥의 검은 그림자 늪에서 솟아오른다
      const pool = this.add.image(cx, gy - 1, 'glow').setTint(0x000000).setScale(0, .2).setAlpha(.9).setDepth(9.5);
      const rim = this.add.image(cx, gy - 1, 'glow').setBlendMode(ADD).setTint(0x8a4ac0).setScale(0, .15).setAlpha(.7).setDepth(9.6);
      this.tweens.add({ targets: [pool, rim], scaleX: 3.2, duration: 700, ease: 'Cubic.easeOut' });
      this.fx.shake(.01, 900); Sfx.play('ghost'); Sfx.play('boss');
      later(800, () => spawn(cx, b => { b.sprite.setAlpha(0); this.tweens.add({ targets: b.sprite, alpha: 1, duration: 800 }); b.introPath(cx, gy + 10, cx, gy - 64, 1100, 'Cubic.easeOut'); }));
      later(2200, () => this.tweens.add({ targets: [pool, rim], scaleX: 0, alpha: 0, duration: 600, onComplete: () => { pool.destroy(); rim.destroy(); } }));
      return true;
    }
    if (key === 'rayquaza') {   // 하늘이 에메랄드빛으로 번쩍 → 거센 돌풍 → 하늘이 갈라지고 → 유성처럼 회전하며 내리꽂혀 포효 · 충격파
      const v = cam.worldView;
      cam.flash(500, 120, 255, 190, true); Sfx.play('boss'); this.fx.shake(.008, 1400);
      for (let k = 0; k < 50; k++) this.time.delayedCall(k * 24, () => this.fx.burst(v.x - 4, v.y + Math.random() * v.height, [0xa8ffe0, 0x4affb0, 0xffffff], 1, 420, { angle: 0, spread: .1, up: 0, grav: 0, bounce: false, glow: true, life: .9, size: 2, drag: 1 }));
      const g = this.add.graphics().setDepth(23.8).setBlendMode(ADD), o = { s: 0 };   // 하늘이 찢어진다
      const pts = []; for (let x = v.x - 10; x <= v.x + v.width + 10; x += 18) pts.push([x, v.y + 26 + (Math.random() - .5) * 18]);
      const split = () => { g.clear(); for (const [w, col, a] of [[10 * o.s, 0x2aff9a, .35], [4 * o.s, 0x8affd0, .8], [1.5 * o.s, 0xffffff, 1]]) { g.lineStyle(Math.max(.5, w), col, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); g.strokePath(); } };
      later(500, () => { Sfx.play('shatter'); this.tweens.add({ targets: o, s: 1, duration: 500, ease: 'Cubic.easeOut', onUpdate: split }); });
      later(1100, () => spawn(cx, b => {
        const sp = b.sprite;
        this.tweens.add({ targets: sp, angle: 1080, duration: 1200, ease: 'Quad.easeIn', onComplete: () => sp.setAngle(0) });
        for (let k = 0; k < 20; k++) this.time.delayedCall(k * 55, () => { if (b.alive) { this.fx.burst(b.x, b.y, [0x4affb0, 0xffe060, 0xffffff], 4, 70, { glow: true, life: .5, grav: 0, bounce: false }); this.fx.ghost && this.fx.ghost(sp, 0x4affb0, .5, 260); } });
        b.introPath(cx, v.y - 60, cx, gy - 92, 1200, 'Quad.easeIn', () => {
          sp.setAngle(0);
          for (let k = 0; k < 4; k++) this.time.delayedCall(k * 90, () => this.fx.ring(cx, gy - 40, 60 + k * 50, k % 2 ? 0xffffff : 0x4affb0, 520));
          this.fx.burst(cx, gy - 30, [0x4affb0, 0xffe060, 0xffffff], 50, 300, { up: 80, glow: true, life: .8 });
          for (let k = 0; k < 30; k++) this.fx.burst(cx, gy - 4, [0xe8f0f4, 0xc0d4e0], 1, 320, { angle: k % 2 ? 0 : Math.PI, spread: .3, up: 10, grav: 0, bounce: false, life: .8, size: 2 });   // 구름이 갈라지는 충격파
          cam.flash(220, 200, 255, 230, true); this.fx.shake(.03, 700); Sfx.play('boom'); Sfx.play('boss');
          this.events.emit('toast', '레쿠쟈가 포효한다!');
          this.tweens.add({ targets: o, s: 0, duration: 700, onUpdate: split, onComplete: () => g.destroy() });
        });
      }));
      later(4000, () => { if (g.scene) g.destroy(); });
      return true;
    }
    const BEAST = { raikou: [0xffe040, 'zap'], entei: [0xff6a2a, 'fire'], suicune: [0x8ad8ff, 'water'] }[key];
    if (BEAST) {   // 하늘에서 번개 · 불기둥 · 물기둥과 함께 내리꽂힌다
      const [col, sfx] = BEAST, v = cam.worldView;
      const pillar = this.add.image(cx, gy + 4, 'glow').setOrigin(.5, 1).setBlendMode(ADD).setTint(col).setScale(.6, 0).setAlpha(.9).setDepth(45);
      this.tweens.add({ targets: pillar, scaleY: (gy - v.y + 20) / 32, duration: 260, ease: 'Cubic.easeOut' });
      Sfx.play(sfx); Sfx.play('boss');
      later(350, () => spawn(cx, b => b.introPath(cx, v.y - 40, cx, gy - b.b.height / 2 - 2, 420, 'Quad.easeIn', () => {
        this.fx.ring(cx, gy - 6, 90, col, 500); this.fx.ring(cx, gy - 6, 50, 0xffffff, 360);
        this.fx.burst(cx, gy - 4, [col, 0xffffff], 36, 240, { up: 160, glow: true });
        this.fx.shake(.022, 420); cam.flash(160, 255, 255, 255, true); Sfx.play('boom');
        this.tweens.add({ targets: pillar, alpha: 0, scaleX: 1.6, duration: 380, onComplete: () => pillar.destroy() });
      })));
      return true;
    }
    return false;
  }

  // ---------------- 정화된 보스: 그 자리에 머문다 ----------------
  //  침식 껍질이 깨진 뒤 금빛 · 청록빛 입자가 몸에서 천천히 씻겨 올라가고, 본래의 맑은 모습으로 숨 쉬며 머문다
  //  다가가면 고마워한다 · 그 방을 나가면 자연으로 돌아간다 (방은 cleared 라 다시 와도 없다)
  restBoss(e) {
    const s = e.sprite;
    if (!s || !s.scene) return;
    e.resting = true; e.restRoom = e.room;
    s.clearTint(); s.setAlpha(1);
    e.play('Idle', true);
    const aura = REST_AURA[e.bossKey], gira = !!aura, cols = aura ? aura.cols : [0xffe08a, 0x6af0d8, 0xffffff];   // 기라티나: 금빛 · 은빛 태고의 기운 · 아르세우스: 본래의 순백 · 황금빛
    for (const pl of e.plates || []) this.tweens.add({ targets: [pl.im, pl.gl], alpha: 0, scale: 0, duration: 900, ease: 'Cubic.easeIn' });   // 아르세우스: 전투의 플레이트가 빛으로 흩어진다
    for (const g of e.prisms || []) this.tweens.add({ targets: g, alpha: 0, scale: 0, duration: 900, ease: 'Cubic.easeIn' });   // 아비스 네크로즈마: 검붉은 프리즘 조각이 흩어진다
    this.time.addEvent({ delay: 60, repeat: 26, callback: () => {
      if (!s.scene) return;
      this.fx.burst(e.x + (Math.random() - .5) * e.b.width, e.y + (Math.random() - .5) * e.b.height, cols, 2, 40, { angle: -Math.PI / 2, spread: .9, up: 50, grav: -40, bounce: false, glow: true, life: .9 });
    } });
    if (gira) {
      e.auraImgs = aura.glow.map(([c, sc]) => this.add.image(s.x, s.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(c).setScale(sc).setAlpha(0).setDepth(17.5));
      e.auraImgs.forEach((o, i) => this.tweens.add({ targets: o, alpha: aura.glow[i][2], duration: 1200, onComplete: () => { if (o.scene) this.tweens.add({ targets: o, alpha: o.alpha * .45, scale: o.scale * 1.15, duration: 1400 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); } }));
      this.fx.ring(s.x, s.y, 90, aura.glow[0][0], 900); this.fx.ring(s.x, s.y, 60, aura.glow[1][0], 700);
    }
    this.fx.glow(e.x, e.y, 70, 0xfff2b0, 1600, .6);
    e.breathTw = this.tweens.add({ targets: s, scaleY: s.scaleY * 1.035, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });   // 평화롭게 숨 쉰다
    if (e.flying || (e.def && (e.def.fly || e.def.flying))) {   // 날짐승(레쿠쟈 · 칠색조 …): 공중에서 위엄 있게 유영한다
      if (e.b) { e.b.setAllowGravity(false); e.b.setVelocity(0, 0); e.b.enable = false; }
      const hover = () => {
        if (!s.scene || e.leaving) return;
        e.bobTw = this.tweens.add({ targets: s, y: s.y - 10, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        e.swayTw = this.tweens.add({ targets: s, x: s.x + 14, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      };
      if (gira && e.room) this.tweens.add({ targets: s, x: e.room.cx, y: this.floorAt(e.room.cx, e.room) - aura.lift, duration: 1600, ease: 'Sine.easeInOut', onComplete: hover });   // 왕좌 · 제단 위로 떠올라 평화롭게 머문다
      else hover();
    }
    (this.restingBosses = this.restingBosses || []).push(e);
  }
  updateResting() {
    const list = this.restingBosses;
    if (!list || !list.length) return;
    const p = this.player, now = this.time.now;
    for (const e of list) {
      const s = e.sprite;
      if (!s || !s.scene || e.leaving) continue;
      if (this.room !== e.restRoom) {   // 방을 나가면 자연으로 돌아간다
        e.leaving = true;
        for (const o of e.auraImgs || []) { this.tweens.killTweensOf(o); o.destroy(); }
        e.auraImgs = null;
        this.tweens.add({ targets: s, alpha: 0, duration: 500, onComplete: () => { e.destroy(); this.enemies = this.enemies.filter(x => x !== e); } });
        continue;
      }
      if (e.auraImgs) {   // 금빛 · 은빛 기운이 몸을 따라 일렁이고 빛 알갱이가 피어오른다
        for (const o of e.auraImgs) o.setPosition(s.x, s.y - 10);
        if (Math.random() < .3) this.fx.burst(s.x + (Math.random() - .5) * 90, s.y + (Math.random() - .5) * 60, [0xffd860, 0xe8eef8, 0xffffff], 1, 16, { angle: -Math.PI / 2, spread: .8, up: 20, grav: -16, bounce: false, glow: true, life: 1.4, size: 1, drag: .99 });
      }
      if (Math.abs(p.x - e.x) < 70 && Math.abs(p.y - e.y) < 70 && now - (e.thankAt || -9999) > 4000) {
        e.thankAt = now;
        this.fx.floatText(e.x, e.top - 10, `${e.name}: (고마워… 이제 괜찮아)`, '#ffe8b0', 9);
        this.heartPop(e.x, e.top - 4, false);
        Sfx.play('purify');
      }
    }
    this.restingBosses = list.filter(e => e.sprite && e.sprite.scene && !e.leaving);
  }

  // ---------------- 안전 구역 결계 ----------------
  //  마을(시내 · 오박사 연구소)과 간이 회복기 쉼터에는 침식된 포켓몬이 들어오지 못한다: 경계를 넘으면 결계가 번쩍이며 바깥으로 튕겨 낸다
  //  (마을 안에선 처음부터 적이 나오지 않는다 — updateSpawns). 보스는 아레나에 갇혀 있어 상관없다
  //  🛡️ 마을 밖에 선 사람(조작 힌트 · 시련 캡틴 · 신화 연구가 · 지방 보스 뒤 조력자 …) 둘레 ±NPC_WARD 도 결계 — 같은 방의 적이 사람 곁으로 오지 못한다
  //  shield: 마을 · 사람 결계 안의 플레이어에겐 적의 몸통 · 근접 · 탄 · 장판이 닿지 않는다 (inShield — 바깥 적이 결계 너머로 쏘거나 내리찍어도)
  safeZones() {
    const lv = this.level, nN = (lv.npcs || []).length;
    if (this.safeZoneOf === lv && this.safeZoneN === nN) return this.safeZoneList;   // 지방 보스 뒤 조력자가 나중에 서면 다시 만든다
    this.safeZoneOf = lv; this.safeZoneN = nN;
    const list = lv.rooms.filter(safeRoom).map(r => ({ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom, town: true, shield: true }));
    for (const t of lv.terminals || []) { const x = t.x * TILE + 16, y = t.g * TILE; list.push({ x0: x - 76, x1: x + 76, y0: y - 80, y1: y + 6 }); }
    for (const n of lv.npcs || []) if (!safeRoom(n.room)) { const x = n.x * TILE + 8, y = n.g * TILE; list.push({ x0: x - NPC_WARD, x1: x + NPC_WARD, y0: y - 128, y1: y + 6, town: true, shield: true, npc: n.id }); }   // 높이 8칸: 머리 위에 맴도는 날짐승(주뱃 · 고우스트)도 밀어낸다
    return (this.safeZoneList = list);
  }
  inShield(x, y) {
    if (!this.level || this.test) return false;
    for (const z of this.safeZones()) if (z.shield && x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return true;
    return false;
  }
  guardSafeZones() {
    if (this.level.purified || this.test) return;
    const zones = this.safeZones(), now = this.time.now;
    for (const e of this.enemies) {
      if (!e.alive || e.boss || e.asleep || e.dummy || e.state === 'spawn') continue;
      const hw = e.b ? e.b.width / 2 : 6, z = zones.find(q => e.x + hw > q.x0 && e.x - hw < q.x1 && e.y > q.y0 && e.y < q.y1);
      if (!z) { e.wardX = e.x; e.wardY = e.y; continue; }   // 결계 밖 마지막 자리 (들어오면 여기로 되돌린다)
      //  들어온 쪽으로 튕겨 낸다: 옆에서 왔으면 옆으로 · 위아래 문(철창 · 사다리 구멍)으로 왔으면 위아래로 — 벽 속으로 순간이동하지 않게
      const cx = (z.x0 + z.x1) / 2, had = e.wardX != null && Math.abs(e.wardX - e.x) < 80 && Math.abs(e.wardY - e.y) < 80;
      const vert = had && (e.wardY <= z.y0 || e.wardY >= z.y1);
      const dir = had ? (Math.sign(e.wardX - cx) || -1) : (e.x < cx ? -1 : 1);
      const x = had ? e.wardX : dir < 0 ? z.x0 - hw - 2 : z.x1 + hw + 2, y = had ? e.wardY : e.y;
      e.b.reset(x, y);
      if (vert) e.b.setVelocity(dir * 90, e.wardY <= z.y0 ? -200 : 140); else e.b.setVelocity(dir * 220, -120);
      if (now - (e.wardAt || 0) > 500) {   // 결계가 번쩍인다
        e.wardAt = now;
        const fx = vert ? x : dir < 0 ? z.x0 : z.x1, fy = vert ? (e.wardY <= z.y0 ? z.y0 : z.y1) : y;
        this.fx.ring(fx, fy, 22, z.town ? 0xffe0a0 : 0x4affd8, 320);
        this.fx.burst(fx, fy, [z.town ? 0xffe0a0 : 0x4affd8, 0xffffff], 8, 90, { glow: true, angle: vert ? (e.wardY <= z.y0 ? -Math.PI / 2 : Math.PI / 2) : dir > 0 ? 0 : Math.PI, spread: 1 });
        Sfx.play('crack');
      }
    }
  }

  // 화면 밖 컬링: 플레이어가 있는 방도 아니고 카메라 시야(+여유)에서도 먼 적은 잠재운다
  //  → AI·물리·세뇌 레이어 갱신을 멈추고 그림도 숨긴다. 시야 가까이 오면 그대로 깨어난다 (보스는 잠들지 않는다)
  //  잠들 때(220px)와 깰 때(150px) 거리를 달리해 경계에서 깜빡이지 않게
  cullEnemies() {
    const v = this.cameras.main.worldView;
    for (const e of this.enemies) {
      if (!e.alive || e.boss) { if (e.asleep && e.alive) this.wakeEnemy(e); continue; }
      const m = e.asleep ? 150 : 220;
      const near = e.room === this.room || (e.x > v.x - m && e.x < v.right + m && e.y > v.y - m && e.y < v.bottom + m);
      if (near && e.asleep) this.wakeEnemy(e);
      else if (!near && !e.asleep) this.sleepEnemy(e);
    }
  }

  enemyLayers(e) { return [e.sprite, e.aura, e.overlay, e.rgbR, e.rgbC, e.eyeGlow, e.eyeDot, e.alert]; }

  sleepEnemy(e) {
    e.asleep = true;
    e.b.enable = false;
    const ls = this.enemyLayers(e);
    e.sleepVis = ls.map(o => o.visible);
    for (const o of ls) o.setVisible(false);
    e.eyeTrail = [];
  }

  wakeEnemy(e) {
    e.asleep = false;
    if (e.b) e.b.enable = true;
    const ls = this.enemyLayers(e);
    if (e.sleepVis) ls.forEach((o, i) => o.setVisible(e.sleepVis[i]));
    e.sleepVis = null;
  }

  pixelEllipse(g, cx, cy, rx, ry, color, alpha) {
    const R = Math.max(1, Math.round(ry));
    g.fillStyle(color, alpha);
    for (let y = -R; y <= R; y++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (R + .5)) ** 2)));
      if (w > 0) g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
    }
  }

  // ---------------- 방 / 적 ----------------
  updateRooms(dt) {
    const p = this.player, room = roomAt(this.level, p.x, p.y - 4) || this.room;
    if (room !== this.room) {
      const wasLab = this.room && (this.room.lab || this.room.gateFront);
      if (this.room) this.room.leftAt = this.time.now;
      this.room = room;
      this.respawnMainRoom(room);   // 본길: 다른 방에 다녀왔으면 다시 나타난다
      this.sideHint(room);
      if ((wasLab || room.lab || room.gateFront) && !this.arenaRoom) this.cameras.main.setBounds(...this.camBounds());   // 연구소 지하(튜토리얼 기술머신)로 내려가거나 올라올 때
      this.updateLabCover();
      for (const m of p.members) m.sturdyUsed = false;   // 기합의띠(특성 카드)는 방마다 1번
      this.events.emit('room', room);
      this.enterArea(room);
      if (room.type === 'village') {
        this.visitHub(room);
        if (!room.entered) { room.entered = true; this.time.delayedCall(4200, () => this.events.emit('toast', '결계 안은 독기가 닿지 않는다 · 포켓몬센터에서 쉬어 가자')); }
      }
      if (room.type === 'treasure' && !room.entered) { room.entered = true; this.events.emit('toast', '보물방이다! 상자를 열어 보자'); }
      if (room.type === 'tm' && !room.entered) {
        room.entered = true;
        if (room.tutorial) this.events.emit('banner', '기술머신 발견!', '디딤돌을 밟고 높은 받침대에 올라 F 로 해독 — 막다른 샛길 · 금 간 벽 · 수문장 둥지에도 잠들어 있다');
        else this.events.emit('toast', '🧗 도전 금고 — 가시 함정을 피해 디딤돌을 건너 높은 받침대의 기술머신으로! (2단 점프 · 공중 대시 Shift)');
      }
      //  🟡 모험 보상: 수문장 둥지 · 침식 덩굴에 봉인된 받침대 (처음 들어설 때 한 번)
      const sealedHere = k => !this.test && (this.level.tmx || []).some(t => t.room === room && t.seal === k && !t.used && this.tmSealed(t));
      if (room.nest && !room.nestTold && sealedHere('guard')) { room.nestTold = true; this.time.delayedCall(900, () => this.events.emit('toast', '🔥 수문장의 둥지 — 붉은 오라의 수문장을 쓰러뜨려야 안쪽 기술머신 캡슐의 결계가 풀린다')); }
      if (!room.sealTold && sealedHere('purify')) { room.sealTold = true; this.time.delayedCall(2600, () => this.events.emit('toast', '🔒 침식 덩굴에 봉인된 기술머신 캡슐 — 이 구역을 정화하면 봉인이 풀린다')); }
      if (room.type === 'sanctuary' && !room.entered && !room.cleared) this.events.emit('toast', '공기가 무겁다… 전설의 기척');
    }
    // 아레나: 안쪽으로 조금 들어서면 문이 닫히고 보스전
    //  아래 방에서 사다리로 올라오는 통로(철창 아래 줄)도 이 방 칸에 걸쳐 있다 — 아레나 바닥 위로 올라선 뒤에만 시작한다
    //  (예전엔 통로 안에서 시작돼 철창 관문이 머리 위에서 닫혀 못 올라갔다 — 방울탑 옥상 칠색조 등)
    if (!room.cleared && !room.entered && !room.altarGated && (room.type === 'mini' || room.type === 'boss' || room.type === 'sanctuary') && p.x > (room.originHall || room.plantHeart ? room.cx - 70 : room.left + 20) && p.x < room.right - 20 && p.y > room.top && p.y <= room.F * TILE) {   // 시초의 방은 제단 한가운데로 걸어가야
      room.entered = true;
      this.setGates(room, false);
      this.startBoss(room);
    }
    if (room.under && room.type === 'combat' && !this.lowSeen) { this.lowSeen = true; this.events.emit('toast', '깊은 곳으로 내려왔다 — 위로 돌아가는 길을 기억해 두자'); }
    this.underground = !!room.under;
    this.updateSpawns();
    this.updateExplored();
  }

  // 샛길 구역에 처음 들어설 때 한 줄 안내 (지방마다 처음 세 곳만 — 그 뒤로는 HUD 의 남은 수로)
  sideHint(room) {
    if (!room || room.isPurified || room.sideTold || this.test || !this.level || this.level.purified || !this.isSideRoom(room)) return;
    room.sideTold = true;
    if ((this.level.sideTold = (this.level.sideTold || 0) + 1) > 3) return;
    this.time.delayedCall(500, () => this.events.emit('toast', '⚠️ 침식된 샛길 구역 — 이 구역의 침식된 포켓몬을 마지막 한 마리까지 쓰러뜨리면 영구히 정화된다'));
  }
  // 방마다 미리 정해 둔 적 자리: 화면 가장자리쯤 다가가면 나타난다
  updateSpawns() {
    const p = this.player, reach = this.cameras.main.worldView.width / 2 + 40, reachY = this.cameras.main.worldView.height / 2 + 40;
    for (const s of this.level.spawns) {
      if (s.spawned || Math.abs(s.x - p.x) > reach || Math.abs(s.y - p.y) > reachY) continue;
      if (s.minGap && Math.abs(s.x - p.x) < s.minGap && Math.abs(s.y - p.y) < 90) continue;   // 본길 다시 나타나기: 바로 곁이면 조금 떨어진 뒤에
      s.spawned = true; s.minGap = 0;
      if (s.room && s.room.isPurified) continue;   // ✨ 정화한 샛길 구역: 다시 와도 · 이어하기로 와도 몬스터가 절대 나오지 않는다
      if (s.room) this.time.delayedCall(0, () => this.checkRoomClear(s.room));   // 마지막 자리가 안전 구역이라 아무도 나오지 않은 채 끝난 샛길 구역
      if (safeRoom(s.room)) continue;   // 마을 · 연구소 · 성역엔 침식된 포켓몬이 하나도 나오지 않는다
      if (s.trial && !(this.player.quests && this.player.quests.zTrial === 1)) continue;   // 시련을 이미 넘었으면(다른 엘리트로) 시련의 수호자는 나오지 않는다
      if (this.level.purified && !s.trial) { if (!s.elite && Math.random() < .5) this.spawnWanderer(s); continue; }   // 정화한 지방: 세뇌된 적 대신 평화로운 야생 포켓몬 (시련의 수호자만은 나온다)
      if (s.elite && s.room && s.room.hidden && !(this.level.sides || []).some(sd => sd.room === s.room && sd.revealed)) { s.spawned = false; continue; }   // 숨은 굴의 수문장은 흙이 걷힌 뒤에
      if (this.safeSpawn(s)) continue;   // 간이 회복기 둘레 · 조작 힌트 NPC 와 연습용 과녁 자리는 안전 구역
      this.spawnAt(s);
    }
  }
  safeSpawn(s, lv = this.level) {
    if (s.elite) return false;
    return (lv.terminals || []).some(t => Math.abs(t.x * TILE - s.x) < 150 && Math.abs(t.g * TILE - s.y) < 90)   // 간이 회복기 둘레는 안전 구역
      || (lv.npcs || []).some(n => (n.guide || !safeRoom(n.room)) && npcSpawnFree(s, n));   // 마을 밖에 선 사람 둘레 · 조작 힌트 NPC 와 연습용 과녁 자리도 (World.js 와 같은 계산)
  }

  // 🔥 엘리트 수문장 (기술머신이 없는 막다른 길 끝): 출전 포켓몬보다 한 단계 위 · 체력 3.4배 · 피해 1.5배 · 몸집 1.25배 · 붉은 오라
  spawnElite(s) {
    const tier = this.player.tierIdx;
    let pk = pickWildStage(this.stage.pool, tier);
    for (let k = 0; k < 5 && WILD[pk.line].flying; k++) pk = pickWildStage(this.stage.pool, tier);   // 수문장은 되도록 땅에 버티고 선 쪽으로
    const top = WILD[pk.line].forms.length - 1, stage = Math.min(top, Math.max(pk.stage, Math.min(2, tier) + 1));
    const { key, def } = wildForm(pk.line, stage), gy = s.y, lv = Math.min(4, this.corruptLevel(s.room) + 1);   // 엘리트는 침식이 한 단계 더 짙다
    const S = specOf(this.stageIdx);   // 📊 챕터별 고정 스펙 (data/balance.js) — 플레이어 카드 수와 상관없이 그 지방 기대 빌드에 맞춘 체력 · 공격력
    const e = new Enemy(this, key, s.x, def.flying ? gy - 40 : gy - 14, { def, cLv: lv, scale: 1.25, hpMul: (1 + this.stageIdx * .4) * 3.4 * (1 + .25 * (lv - 1)) * S.hp, dmgMul: (1 + this.stageIdx * .25) * 1.5 * (1 + .15 * (lv - 1)) * S.atk });
    e.line = pk.line; e.stage = stage; e.elite = true;
    if (!def.flying) e.b.reset(s.x, gy - e.b.height / 2 - 1);
    this.addEnemy(e, s.room || this.room);
    s.enemy = e;
    this.fx.ring(s.x, e.y, 34, 0xff3a2a, 460); this.fx.glow(s.x, e.y, 40, 0xff3a2a, 520, 1);
    this.fx.burst(s.x, e.y, [0xff3a2a, 0xffa040, 0xffffff], 20, 130, { glow: true, up: 80 });
    this.events.emit('toast', s.trial ? `🔥 시련의 수호자 ${def.name}이(가) 나타났다! 쓰러뜨리고 시련 캡틴에게 돌아가자` : `🔥 엘리트 ${def.name}이(가) 길을 막아섰다! 쓰러뜨리면 이상한사탕 · 금구슬${s.room && s.room.nest ? ' · 둥지 안쪽 기술머신 결계 해제' : ''}`);
    if (s.trial) e.trialGuard = true;
    Sfx.play('boss');
  }

  // 🔥 호연 Z 시련의 수호자: 시련을 받은 동안(zTrial 1) 하늘기둥 돌다리 방 오른쪽에 엘리트 한 마리 자리를 둔다 (가까이 가면 나타난다)
  //  자리는 지방을 깔 때마다 새로 만들어지니(진행 저장엔 없다) 이어하기 · 공중날기로 돌아와도 여기서 다시 둔다 · 쓰러뜨리면 zTrial 2 (killEnemy)
  ensureTrialGuardian() {
    const lv = this.level, p = this.player, q = p && p.quests;
    if (!lv || lv.test || this.stageIdx !== 2 || !q || q.zTrial !== 1 || lv.spawns.some(s => s.trial)) return;
    const r = lv.rooms.find(o => o.seaBridge);
    if (!r) return;
    const G = lv.grid, cap = (lv.npcs || []).find(n => n.id === 'trial_captain'), x0 = cap ? cap.x + 6 : r.tx0 + 14;
    const okX = x => G[r.F] && (G[r.F][x] === 'S') && G[r.F - 1][x] === '.' && G[r.F - 2][x] === '.';
    let tx = null;
    for (let x = Math.min(r.tx1 - 4, Math.max(x0, r.tx1 - 8)); x > r.tx0 + 2 && tx === null; x--) if (okX(x) && (!cap || Math.abs(x - cap.x) >= 5)) tx = x;
    if (tx === null) for (let x = r.tx0 + 2; x < r.tx1 - 2 && tx === null; x++) if (okX(x)) tx = x;
    if (tx === null) return;
    lv.spawns.push({ x: tx * TILE + 8, y: r.F * TILE, room: r, spawned: false, elite: true, trial: true });
  }

  spawnAt(s) {
    if (s.elite) return this.spawnElite(s);
    // 계열은 지방 pool 에서, 진화 단계는 지금 출전 중인 포켓몬 단계 ±1 안에서 (두 단계 차이는 안 남)
    let pk = pickWildStage(this.stage.pool, this.player.tierIdx);
    if (WILD[pk.line].flying && Math.random() < .5) pk = pickWildStage(this.stage.pool, this.player.tierIdx);   // 날짐승·고스트는 잡기 번거로워 등장 빈도 절반쯤으로
    if (s.ranged) { const line = Math.random() < .65 ? 'pichu' : 'gastly'; pk = { line, stage: Math.min(WILD[line].forms.length - 1, pk.stage) }; }   // 🟡 도전 금고 디딤돌: 원거리 몹 (피츄 계열 앞질러 쏘기 · 고오스 계열 유도탄)
    const { line, stage } = pk, { key, def } = wildForm(line, stage), gy = s.y;
    let x = s.x, y = def.flying ? gy - rand(30, 52) : gy - 14;
    for (let k = 0; k < 6 && def.flying && (this.isSolidAt(x, y) || this.isSolidAt(x, y - 12)); k++) y = gy - rand(20, 44);   // 날짐승: 바위·종유석 속 피하기
    const room = s.room || this.room, lv = this.corruptLevel(room);   // 침식 단계: 체력 +25% · 공격력 +15% · 속도 +5% (단계마다)
    const e = new Enemy(this, key, x, y, { def, cLv: lv, hpMul: (1 + this.stageIdx * .4) * (1 + .25 * (lv - 1)), dmgMul: (1 + this.stageIdx * .25) * (1 + .15 * (lv - 1)) });
    e.line = line; e.stage = stage;
    if (!def.flying) e.b.reset(x, gy - e.b.height / 2 - 1);
    this.addEnemy(e, room);
    s.enemy = e;   // 본길 다시 나타나기 (respawnMainRoom): 이 자리의 몬스터가 아직 살아 있는가
    e.respawned = !!s.respawn;
    this.fx.ring(x, e.y, 22, typeColor(def.types[0]), 380);
    this.fx.glow(x, e.y, 26, typeColor(def.types[0]), 420, .9);
  }

  // 지도: 카메라에 들어온 칸을 탐험한 칸으로 (카메라가 칸을 넘을 때만 갱신)
  updateExplored() {
    const v = this.cameras.main.worldView, lv = this.level;
    const tx0 = Math.max(0, Math.floor(v.x / TILE)), ty0 = Math.max(0, Math.floor(v.y / TILE));
    const key = tx0 + ':' + ty0;
    if (key === this.exploredKey) return;
    this.exploredKey = key;
    const tx1 = Math.min(lv.cols - 1, Math.ceil(v.right / TILE)), ty1 = Math.min(lv.rows - 1, Math.ceil(v.bottom / TILE));
    const hid = this.coverTest();   // 암반으로 덮인 방(벽 너머 다른 세계)은 지도에 밝히지 않는다
    for (let y = ty0; y <= ty1; y++) {
      if (!hid) { this.explored.fill(1, y * lv.cols + tx0, y * lv.cols + tx1 + 1); continue; }
      for (let x = tx0; x <= tx1; x++) { const r = lv.cellRoom.get(Math.floor(x / CW) + ',' + Math.floor(y / CH)); if (!r || !hid(r)) this.explored[y * lv.cols + x] = 1; }
    }
  }

  addEnemy(e, room) {
    e.room = room;
    if (room && !e.boss) room.foes = (room.foes || 0) + 1;   // 이 방에 나타난 몬스터 수 (샛길 정화: 몬스터를 한 마리라도 마주친 방만 정화된다)
    e.colliders = [this.physics.add.collider(e.obj, this.gateGroup)];
    if (!e.def.noclip) e.colliders.push(this.physics.add.collider(e.obj, this.layers, null, e.boss ? (o, tile) => !PLAT_SET.has(tile.index) : null));   // 보스는 통과 발판에 올라서지 않는다
    this.enemies.push(e);
  }

  // 아레나 보스: 방의 보스 키 (중간 보스 · 지방 최종 보스 · 히든 전설). 날아다니는 보스는 공중에서
  // 아레나 보스전 시작. 이어 싸우는 순서(chain): prelude(레드의 포켓몬들) → 방 보스 → then(디아루가 → 펄기아)
  startBoss(room) {
    if (this.player) this.player.rebornUsed = false;   // 칠색조의 무지개 코어: 보스전마다 부활 1번
    const key = room.boss && BOSSES[room.boss] ? room.boss : 'mewtwo', def = BOSSES[key];
    const solo = this.test && !this.testReal && !this.testChain;   // 테스트룸 허브 아레나: 고른 보스 하나만 (실제 보스방 워프는 본편처럼 앞뒤 보스까지)
    const list = solo ? [key] : [...(def.prelude || []), key];
    if (!solo) for (let k = key; BOSSES[k].then; k = BOSSES[k].then) list.push(BOSSES[k].then);
    this.chain = { list, i: 0 };
    this.arenaRoom = room;
    const run = this.arenaRun = (this.arenaRun || 0) + 1;   // 보스전 회차: 그만두거나 다시 시작하면 앞 판의 지연 연출(등장 · 전환 · 유대의 불꽃)은 버린다
    this.lockArena(room);
    const first = BOSSES[list[0]], tk = first.trainer;
    if (tk) {   // 세뇌된 트레이너: 단상에 서서 한마디 → 몬스터볼을 던져 첫 포켓몬을 내보낸다
      this.trainer = new Trainer(this, tk, room, room.cx + 100);   // 아레나 가운데 조금 오른쪽 단상 (왼쪽 입구에서 들어서자마자 화면에 보이게)
      this.trainer.say(TRAINER_LINES[tk].intro);
      const sx = room.cx;
      this.time.delayedCall(1100, () => { if (this.arenaRoom === room && this.arenaRun === run && this.trainer) this.trainer.throwBall(sx, this.floorAt(sx, room) - 20, () => this.beginBoss(list[0], room, sx)); });
      Sfx.play('boss');
      return;
    }
    const ent = solo && first.entrance;   // 테스트룸에서 바로 고른 펄기아 · 무한다이노: 등장 연출부터
    if (ent === 'shatter') { this.spaceShatter(room); this.time.delayedCall(1200, () => this.beginBoss(list[0], room, room.cx + 80)); return; }
    if (ent === 'abyss') { this.abyssRise(room); this.time.delayedCall(1700, () => this.beginBoss(list[0], room, room.cx)); return; }
    if (ent === 'lightstone') { this.stoneSplit(room, true, x => this.beginBoss(list[0], room, x)); return; }
    if (!tk && this.bossIntro(list[0], room)) return;   // 보스 고유 등장 연출 (뮤츠 배양 캡슐 · 칠색조 강하 · 차원 균열 · 그림자 늪 · 3성수 낙하)
    this.beginBoss(list[0], room, room.right - 70);
  }
  beginBoss(key, room, x) {
    if (this.arenaRoom !== room || this.over) return;
    if ((this.chain && this.chain.list[this.chain.i] !== key) || (this.boss && this.boss.alive && this.boss.bossKey === key)) return;   // 앞 판에서 걸어 둔 등장이 새 판에 끼어들지 않게 (이 판의 지금 차례 보스만 · 같은 보스를 둘 내지 않는다)
    const def = BOSSES[key], boss = this.spawnBoss(key, room, x);
    this.boss = boss; this.bosses = [boss];
    if (key === 'necrozma' && room.backdrop && room.backdrop.phase2) room.backdrop.phase2();   // 천장이 뜯겨 나가며 울트라홀 우주로
    if (def.pair && BOSSES[def.pair]) {   // 짝 보스 (라티아스 & 라티오스): 반대편에서 함께 나온다
      const twin = this.spawnBoss(def.pair, room, room.left + 140);
      boss.partner = twin; twin.partner = boss; boss.lead = true;
      this.bosses.push(twin);
    }
    this.gearWarn = gearCheck(this.player, key);   // 🔴 전력 부족: 카드 점수가 이 보스 권장 점수의 75% 미만 (UI 가 보스 체력 바 아래에 붉게)
    if (!this.altarRite) this.events.emit('boss', boss);   // UI 가 할로우 나이트식 보스 이름 타이틀을 띄운다 (칠색조 제단 봉헌은 강림이 끝난 3.5초에)
    if (this.gearWarn) { const w = this.gearWarn; this.time.delayedCall(1800, () => { if (boss.alive && this.boss === boss) this.events.emit('toast', `⚠️ 전력 부족 — 카드 점수 ${w.score} / 이 보스 권장 ${w.rec} (보유 카드 수 + 강화 단계) · 탐색하며 기술머신 카드를 더 모으고 강화하자`); }); }
    this.fx.shake(.01, 500); Sfx.play('boss');
    Music.play(def.bgm || (def.tier === 'boss' ? this.stage.bossBgm : 'boss_ruin'));   // 보스 전용곡(아비스 네크로즈마) · 지방 최종 보스는 지방 전용곡, 중간·히든 보스는 공용 전투곡
  }
  // 이어 싸우기: 다음 보스가 나오는 연출
  nextInChain(prev) {
    const ch = this.chain, room = this.arenaRoom, key = ch.list[++ch.i], def = BOSSES[key], tr = this.trainer;
    this.boss = null; this.bosses = [];
    this.events.emit('boss', null);
    if (def.entrance === 'shatter') {   // 공간이 유리처럼 깨지며 강림
      this.events.emit('banner', `${prev.name} 정화!`, def.intro || '');
      this.time.delayedCall(700, () => { if (this.arenaRoom === room) this.spaceShatter(room); });
      this.time.delayedCall(1900, () => this.beginBoss(key, room, room.cx + 80));
    } else if (def.entrance === 'lightstone') {   // 라이트스톤이 내려와 갈라지며 백열의 불꽃을 두른 레시라무
      this.events.emit('banner', `${prev.name} 정화!`, def.intro || '');
      this.time.delayedCall(700, () => { if (this.arenaRoom === room) this.stoneSplit(room, true, x => this.beginBoss(key, room, x)); });
    } else if (def.entrance === 'bondflame') {   // 유대의 불꽃 시네마틱 → 레드 소생 → 아비스 네크로즈마가 찢어진 하늘에서 내려온다 + 오버드라이브
      this.events.emit('banner', `${prev.name} 정화!`, '레드를 가둔 결정에 금이 간다');
      this.bondStageGain(this.stageIdx);   // 정화 단계 6 / 6 — 모든 불꽃이 모였다 (이제 레드에게로 돌아간다)
      this.bondFlameCinematic(room, prev, () => {
        if (this.arenaRoom !== room || this.over) return;
        const t = this.abyssTear, sil = this.abyssSil, gy = this.floorAt(room.cx, room);
        this.startOverdrive(room);
        this.beginBoss(key, room, t ? t.x : room.cx);
        const b = this.boss;
        if (b && b.bossKey === key) {
          b.sprite.setAlpha(0); this.tweens.add({ targets: b.sprite, alpha: 1, duration: 500 });
          b.introPath(t ? t.x : room.cx, (t ? t.y : room.top + 60) + 10, room.cx + 60, gy - 110, 1000, 'Cubic.easeOut', () => {
            Sfx.play('roar'); Sfx.play('boom'); shockwave(this, b.x, b.y, .05, 900); chromatic(this, .02, 900); this.fx.shake(.026, 700);
            for (let k = 0; k < 4; k++) this.time.delayedCall(k * 110, () => this.fx.ring(b.x, b.y, 60 + k * 50, k % 2 ? 0xb04aff : 0xff2a6a, 560));
          });
        }
        if (sil) { this.tweens.killTweensOf(sil); this.tweens.add({ targets: sil, alpha: 0, scale: .2, duration: 400, onComplete: () => sil.destroy() }); }
        if (t) this.time.delayedCall(900, () => t.close());
        this.abyssTear = this.abyssSil = null;
      });
    } else if (def.entrance === 'abyss') {   // 트레이너가 풀려나고, 심연의 핵에서 솟아오른다
      this.events.emit('banner', `${prev.name} 정화!`, def.intro || '');
      if (tr) { tr.release(TRAINER_LINES[tr.kind].freed); this.time.delayedCall(800, () => this.events.emit('toast', TRAINER_LINES[tr.kind].toast)); }
      this.time.delayedCall(1600, () => { if (this.arenaRoom === room) this.abyssRise(room); });
      this.time.delayedCall(3300, () => this.beginBoss(key, room, room.cx));
    } else if (tr && !tr.freed) {   // 트레이너가 다음 몬스터볼을 던진다
      this.events.emit('banner', `${prev.name} 정화!`, `${tr.name}이(가) 다음 포켓몬을 꺼낸다`);
      const line = TRAINER_LINES[tr.kind].next;
      this.time.delayedCall(900, () => { if (this.arenaRoom !== room || !this.trainer) return; if (line) tr.say(line); const sx = room.cx; tr.throwBall(sx, this.floorAt(sx, room) - 20, () => this.beginBoss(key, room, sx)); });
    } else this.time.delayedCall(900, () => this.beginBoss(key, room, room.right - 70));
  }
  // 펄기아 강림: 화면 가운데에서 유리처럼 금이 사방으로 뻗고 조각이 쏟아진다 → 보랏빛 차원 균열
  spaceShatter(room) {
    const cam = this.cameras.main, v = cam.worldView, cx = v.centerX, cy = v.centerY, g = this.add.graphics().setDepth(45);
    for (let k = 0; k < 14; k++) {
      let x = cx, y = cy; const a0 = k / 14 * Math.PI * 2 + Math.random() * .3, pts = [{ x, y }];
      for (let s = 0; s < 6; s++) { const a = a0 + (Math.random() - .5) * .5, d = 20 + Math.random() * 40; x += Math.cos(a) * d; y += Math.sin(a) * d; pts.push({ x, y }); }
      g.lineStyle(3, 0xd88aff, .5); g.strokePoints(pts, false); g.lineStyle(1, 0xffffff, .95); g.strokePoints(pts, false);
    }
    this.tweens.add({ targets: g, alpha: 0, delay: 500, duration: 700, onComplete: () => g.destroy() });
    cam.flash(300, 255, 255, 255, true); this.fx.shake(.025, 700); Sfx.play('shatter'); Sfx.play('boom');
    this.fx.shatter(cx, cy, v.width * .7, v.height * .7, { n: 40, speed: 260, scale: 2.2, depth: 46 });
    const rx = room.cx + 80, ry = room.bottom - 70;
    this.fx.glow(rx, ry, 80, 0xd88aff, 1400, 1); this.fx.ring(rx, ry, 90, 0xd88aff, 700); this.fx.ring(rx, ry, 50, 0xffffff, 500);
  }
  // 무한다이노 등장: 아레나 바닥이 붉게 갈라지며 심연의 빛이 솟는다
  abyssRise(room) {
    const cx = room.cx, gy = this.floorAt(cx, room);
    this.fx.shake(.02, 1600); Sfx.play('boss'); Sfx.play('thunder');
    this.cameras.main.flash(400, 255, 60, 90, true);
    for (let k = 0; k < 5; k++) this.time.delayedCall(k * 260, () => {
      this.fx.ring(cx, gy - 40 - k * 20, 60 + k * 30, 0xff2a5a, 600);
      this.fx.burst(cx + (Math.random() - .5) * 120, gy - 4, [0xff2a5a, 0x2a0612, 0xffa0b8], 20, 220, { angle: -Math.PI / 2, spread: .9, up: 200, grav: 300, glow: true, life: .9 });
    });
    this.fx.glow(cx, gy - 80, 120, 0xff2a5a, 1800, 1);
  }

  spawnBoss(key, room, x) {
    const def = BOSSES[key], gy = this.floorAt(x, room);   // 아레나 바닥 (공중 발판 위가 아니라)
    const S = bossSpec(key);   // 📊 챕터별 고정 스펙 (data/balance.js): 그 보스가 사는 지방의 체력 · 공격력 · 탄속 배율 — 테스트룸 · 이어 싸우기 · 짝 보스도 같다
    const boss = new Boss(this, key, x, def.fly ? Math.max(room.top + 40, gy - 70) : gy - 40, { room, hpMul: S.hp, dmgMul: S.atk, shotMul: S.shot });
    if (!def.fly) boss.b.reset(x, gy - boss.b.height / 2 - 1);
    boss.state = 'intro'; boss.intangible = true;
    this.addEnemy(boss, room);
    return boss;
  }
  // 보스전 동안 카메라를 아레나 안에 가두고 조금 뒤로 물린다 (옆방이 비치지 않게 · 넓은 아레나에서 보스 예고 동작이 보이게)
  lockArena(room) {
    const cam = this.cameras.main;
    cam.setBounds(room.X0 * TILE, room.Y0 * TILE, (room.X1 - room.X0) * TILE, (room.Y1 - room.Y0) * TILE);
    cam.zoomTo(ARENA_ZOOM * RES, 700, 'Sine.easeInOut', true);
  }
  // 연구소 덮개: 연구소 · 지하 튜토리얼 굴 안에 있을 때만 걷는다
  updateLabCover() {
    const c = this.labCover;
    if (c) c.g.setVisible(!c.rooms.includes(this.room));
    for (const pc of this.portalCovers || []) pc.g.setVisible(this.room === pc.when);
    for (const rc of this.realmCovers || []) { const inn = rc.realm.has(this.room); rc.inside.setVisible(inn); rc.outside.setVisible(!inn); }
  }
  // 지금 암반으로 덮여 보이지 않는 방인지 (출입문 덮개 · 독립된 세계 덮개) — 없으면 null
  coverTest() {
    const R = this.room, tests = [];
    for (const rc of this.realmCovers || []) { const inn = rc.realm.has(R); tests.push(r => inn !== rc.realm.has(r)); }
    for (const pc of this.portalCovers || []) if (R === pc.when) tests.push(r => r === pc.hide);
    return tests.length ? r => tests.some(f => f(r)) : null;
  }
  // 카메라가 다닐 범위: 월드 전체 (테스트룸은 방 안 — 둘레에 두른 바위가 비치지 않게 · 오박사 연구소 안에선 연구소 안만 — 벽 너머 마을이 비치지 않게)
  camBounds() {
    const lv = this.level, r = lv.test ? lv.rooms[0] : this.room && this.room.lab ? this.room : null;
    if (!r && this.room && this.room.gateFront) { const top = (this.room.ty0 - 4) * TILE; return [0, top, lv.width, lv.height - top]; }   // 방울탑 · 창기둥 정문 앞: 천장 위(탑 위층 · 열주 위)는 보이지 않게
    return r ? [r.X0 * TILE, r.Y0 * TILE, (r.X1 - r.X0) * TILE, (r.Y1 - r.Y0) * TILE] : [0, 0, lv.width, lv.height];
  }
  unlockArena() {
    const cam = this.cameras.main;
    if (this.level) cam.setBounds(...this.camBounds());
    if (cam.zoom !== ZOOM * RES) cam.zoomTo(ZOOM * RES, 900, 'Sine.easeInOut', true);
  }

  // ---------------- 정화 / 드랍 / 도감 ----------------
  killEnemy(e) {
    if (!e.alive) return;
    e.alive = false; e.intangible = true; e.telegraph(false);
    if (this.player) perkKill(this.player);   // 특성 카드: 생명의구슬 유물 — 처치하면 체력 회복
    (e.colliders || []).forEach(c => c.destroy());
    e.colliders = [];
    e.b.enable = false;
    this.purify(e);
    if (this.test) { if (e.boss) this.bossDefeated(e); return; }   // 테스트룸: 경험치·도감·드랍 없이 정화 연출만
    // 진화 경험치 (📉 경험치 감쇠 — Player.gainXp · data/pokemon.js XP_RULE): 정화할 때 출전 중이던 포켓몬이 받는다 (보스는 정화 연출이 끝날 무렵)
    //  일반 1 · 엘리트 5 · 중간 보스 8 · 지방 보스 · 히든 전설 12 마리분 × 그 지방 base × 진화 단계 배율 · 이미 지나간 본길에서 다시 나타난 몬스터는 25%
    const who = this.player.m, units = e.boss ? (e.room && e.room.type === 'mini' ? XP_UNITS.mini : XP_UNITS.boss) : (e.elite ? XP_UNITS.elite : XP_UNITS.wild) * (e.respawned ? XP_UNITS.respawn : 1);
    if (e.boss) this.time.delayedCall(1600, () => { if (this.player && !this.over) { this.player.gainXp(units, who); this.xpHint(who); } });
    else { this.player.gainXp(units, who); this.xpHint(who, e.respawned); }
    this.runStats.kills++;
    this.announceJoin(Save.addPurify());   // 누적 정화로 합류하는 특수 포켓몬 (롱스톤·스라크)
    const joinedBy = e.boss && Save.unlockByBoss(e.bossKey);   // 전설 보스 정화 → 그 전설이 플레이어블로 합류 (한카리아스 → 딥상어동 계열)
    if (joinedBy) this.time.delayedCall(2800, () => this.announceJoin([joinedBy]));
    if (e.boss) { this.dropFormItem(e); this.bondPurify(e); }
    const lvK = this.level;
    if (e.boss && coreOfBoss(e.bossKey)) this.time.delayedCall(1300, () => { if (this.level === lvK) this.spawnPickup('item', e.x, e.y - 14, coreOfBoss(e.bossKey)); });   // 💎 지방 최종 보스만 그 지방의 코어 (data/cores.js FINAL_CORE)
    if (e.boss && BEAST_ORBS[e.bossKey]) this.time.delayedCall(1300, () => { if (this.level === lvK) this.spawnPickup('orb', e.x, e.y - 14, e.bossKey); });   // 성도 3성수: 코어 대신 성수의 구슬 (칠색조의 제단 열쇠)   // 보스의 코어 100% (짝 보스 · 이어 싸우기도 한 마리마다)
    //  🟡 기술머신 캡슐은 더 이상 보스 · 엘리트가 떨어뜨리지 않는다 — 모험 보상 지형(game/World.js: 도전 금고 · 정화 봉인 · 비밀 벽감 · 수문장 둥지)으로 옮겼다 (수는 그대로)
    if (e.boss) { this.bossDefeated(e); return; }
    if (e.elite && this.stageIdx === 2 && this.player.quests && this.player.quests.zTrial === 1) {   // 호연의 시련: 엘리트 수호자를 넘었다 → 루네시티 시련 캡틴에게
      this.player.quests.zTrial = 2;
      this.time.delayedCall(900, () => this.events.emit('banner', '시련 달성!', '수호자의 시련을 넘었다 · 하늘기둥 입구의 시련 캡틴에게 돌아가자'));
    }
    if (e.elite) {   // 엘리트 보상: 이상한사탕 100% · 금구슬(data/shop.js eliteNuggets) · 장착형 전술 도구 25%
      this.spawnPickup('candy', e.x, e.y - 4);
      eliteNuggets(this.stageIdx).forEach((id, k) => this.spawnPickup('nugget', e.x - 8 + k * 8, e.y - 6, id));
      if (Math.random() < .25) this.spawnPickup('item', e.x + 6, e.y - 4, pick(ELITE_TOOLS));
      if (e.room && e.room.nest && (this.level.tmx || []).some(t => t.room === e.room && t.seal === 'guard' && !t.used)) this.time.delayedCall(700, () => this.events.emit('toast', '🔓 수문장이 쓰러졌다! — 둥지 안쪽 기술머신 캡슐의 결계가 풀린다', 'tm'));   // 🟡 수문장 둥지 (World D)
      this.fx.ring(e.x, e.y, 40, 0xffd27a, 420);
    }
    else if (Math.random() < ITEM_DROP.wild * (e.respawned ? XP_UNITS.respawn : 1)) this.spawnPickup('item', e.x, e.y, pick(RANDOM_ITEM_KEYS));   // 야생은 아이템 대신 가끔 오렌열매 (다시 나타난 본길 몬스터는 전리품도 25%)
    else if (Math.random() < .16 * (e.respawned ? XP_UNITS.respawn : 1)) this.spawnPickup('oran', e.x, e.y);
    this.checkRoomClear(e.room);   // ✨ 샛길 정화: 이 샛길 구역의 침식된 포켓몬을 모두 정화했는가
    const r = Save.addKill(e.line || e.key);   // 정화 진행도는 진화 계열로 센다 (피카츄를 정화해도 피츄 계열 +1)
    if (r) {
      if (r.unlockedNow) { this.runStats.unlocked.push(e.line); this.queueJoin(e.line, 'dex'); }   // 10번 정화: 정화 완료 쇼케이스
      else this.events.emit('killcount', e.line, r.count);
    }
  }

  // 📉 경험치 감쇠 안내 (한 번씩): 이 지방에서 거의 자라지 않는 진화 단계 · 다시 나타난 본길 몬스터
  xpHint(m, respawned) {
    const p = this.player, told = this.xpTold || (this.xpTold = new Set()), ci = this.stageIdx, k = p && m ? p.xpMulOf(m) : 1;
    if (respawned && !told.has('respawn')) { told.add('respawn'); this.events.emit('toast', '다시 나타난 본길 몬스터 — 경험치 · 전리품은 25% 뿐이다 · 샛길과 다음 지방으로 나아가자'); return; }
    if (!m || m.tier >= EVO_EXP.length || k >= .2 || told.has(ci + ':' + m.tier)) return;
    told.add(ci + ':' + m.tier);
    const after3 = XP_RULE[Math.min(ci, XP_RULE.length - 1)].after3 === k;
    this.events.emit('toast', after3 ? `이 지방에선 이미 3단 진화를 이뤘다 — 남은 2단 포켓몬은 ${this.stage.region} 몬스터에게서 경험치 ${Math.round(k * 100)}% 뿐`
      : `${this.stage.region}의 약한 몬스터로는 ${p.formName(m)}이(가) 거의 자라지 않는다 (경험치 ${Math.round(k * 100)}%) — 다음 지방에서 강해지자`);
  }
  // 정화 피니시: HP 0 이 되어도 바로 사라지지 않는다 (일반 약 0.55초, 보스는 같은 순서를 길게)
  //  ① 검보라 세뇌 껍질에 금이 가고 유리처럼 사방으로 깨져 나감 → ② 하얀 섬광
  //  ③ 본래 밝은 색으로 돌아와 안도하듯 멈춤 (머리 위 하트·반짝임) → ④ 몬스터볼 빛줄기처럼 붉은 빛이 되어 귀환
  purify(e) {
    const big = e.boss, s = e.sprite, ADD = Phaser.BlendModes.ADD;
    const T = big ? { shatter: 480, color: 600, beam: 1850, end: 2350 } : { shatter: 70, color: 140, beam: 380, end: 560 };
    const cx = e.x, cy = e.y, bw = e.b.width, bh = e.b.height, top = e.top;
    e.clearCorruption();
    e.play('Idle', true);
    if (e.glowImg) this.tweens.add({ targets: e.glowImg, alpha: 0, duration: 300 });
    s.setAlpha(1).setTintFill(0x3a0e5a);   // 몸 전체가 검보라 껍질로 굳고, 가장자리가 유리처럼 빛난다
    if (e.aura) e.copyFrame(e.aura, s).setPosition(s.x, s.y + 1).setScale(s.scaleX * 1.12, s.scaleY * 1.12).setTintFill(0xb070ff).setAlpha(.85).setVisible(true);
    // ① 금: 몸 안쪽에서 바깥으로 뻗는 들쭉날쭉한 빛줄기
    const cracks = this.add.graphics().setDepth(s.depth + .5).setBlendMode(ADD);
    const crack = n => {
      for (let i = 0; i < n; i++) {
        let x = cx + (Math.random() - .5) * bw * .3, y = cy + (Math.random() - .5) * bh * .3;
        const a0 = Math.random() * Math.PI * 2, pts = [{ x: Math.round(x), y: Math.round(y) }], len = Math.min(bw, bh) * .17;
        for (let k = 0; k < 3; k++) {
          const a = a0 + (Math.random() - .5) * 1.3;
          x = Phaser.Math.Clamp(x + Math.cos(a) * len, cx - bw * .5, cx + bw * .5); y = Phaser.Math.Clamp(y + Math.sin(a) * len, cy - bh * .5, cy + bh * .5);
          pts.push({ x: Math.round(x), y: Math.round(y) });
        }
        cracks.lineStyle(1, 0xf0c8ff, .95); cracks.strokePoints(pts, false);
      }
    };
    crack(big ? 4 : 5);
    Sfx.play('crack');
    if (big) [160, 320].forEach(ms => this.time.delayedCall(ms, () => { crack(5); s.setTintFill(ms === 160 ? 0x3a0e5a : 0x4a1478); this.fx.shake(.008, 120); Sfx.play('crack'); }));
    // ② 산산조각 + 하얀 섬광
    this.time.delayedCall(T.shatter, () => {
      cracks.destroy();
      if (e.aura) e.aura.setVisible(false);
      s.setTintFill(0xffffff);
      this.fx.shatter(cx, cy, bw * 1.1, bh * 1.1, { n: big ? 48 : 16, speed: big ? 240 : 150, up: big ? 120 : 80, scale: big ? 2 : 1 });
      this.fx.burst(cx, cy, [0x14061e, 0x3a0e5a, 0x6a1aa8], big ? 40 : 12, big ? 220 : 130, { life: .6 });
      this.fx.glow(cx, cy, big ? 120 : 38, 0xffffff, big ? 420 : 200, 1);
      this.fx.ring(cx, cy, big ? 110 : 30, 0xe0b0ff, big ? 500 : 260);
      if (big) { this.cameras.main.flash(180, 255, 255, 255); this.fx.shake(.014, 260); }
      Sfx.play('shatter');
    });
    // ③ 본래 색 + 안도의 하트·반짝임
    this.time.delayedCall(T.color, () => {
      s.clearTint();
      this.tweens.add({ targets: s, y: s.y - (big ? 6 : 3), duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      this.fx.glow(cx, cy, big ? 80 : 26, 0xfff2b0, big ? 700 : 300, .8);
      this.heartPop(cx, top - (big ? 14 : 7), big);
      if (!big) this.fx.floatText(cx, top - 20, '정화!', '#ffe08a', 10);   // 보스는 화면 배너가 대신한다
      Sfx.play(big ? 'unlock' : 'purify');
    });
    // ④ 몬스터볼 빛줄기로 귀환
    this.time.delayedCall(T.beam, () => (big && (!this.test || this.testReal) ? this.restBoss(e) : this.recallBeam(e, T.end - T.beam)));   // 보스: 정화된 모습으로 그 자리에 머문다 (테스트 모드도 실제 보스방이면)
  }

  // 안도의 하트가 톡 튀어나와 떠오르고, 양옆에서 반짝임이 터진다
  heartPop(x, y, big) {
    const k = big ? 2 : 1;
    const h = this.add.image(Math.round(x), Math.round(y), 'heart').setDepth(58).setScale(0);
    this.tweens.add({ targets: h, scale: k, duration: 150, ease: 'Back.easeOut' });
    this.tweens.add({ targets: h, y: h.y - 12 * k, alpha: 0, delay: big ? 1000 : 300, duration: big ? 700 : 420, onComplete: () => h.destroy() });
    for (let i = 0; i < (big ? 6 : 2); i++) {
      const sp = this.add.image(Math.round(x + (i % 2 ? 1 : -1) * (6 + Math.random() * 6) * k), Math.round(y + (Math.random() - .3) * 8 * k), 'sparkle')
        .setDepth(58).setScale(0).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: sp, scale: k, angle: 90, yoyo: true, duration: 170, delay: 40 + i * (big ? 140 : 70), onComplete: () => sp.destroy() });
    }
  }

  // 몸이 붉은 빛으로 바뀌어 한 점으로 줄어들고, 하늘로 솟는 빛줄기를 타고 사라진다
  recallBeam(e, ms) {
    const s = e.sprite, big = e.boss, ADD = Phaser.BlendModes.ADD;
    const cx = s.x, cy = e.y, topY = this.cameras.main.worldView.y - 20;
    s.setTintFill(0xff5068);
    this.tweens.add({
      targets: s, scaleX: 0, scaleY: s.scaleY * .3, y: cy, alpha: .3, duration: ms, ease: 'Cubic.easeIn',
      onComplete: () => { e.destroy(); this.enemies = this.enemies.filter(x => x !== e); }
    });
    const beam = (w, color, d) => this.add.image(cx, cy, 'px').setOrigin(.5, 1).setTint(color).setBlendMode(ADD).setDepth(d).setScale(w / 2, 0);
    const outer = beam(big ? 12 : 6, 0xff2a4a, 57), core = beam(big ? 4 : 2, 0xffffff, 57.1);
    this.tweens.add({ targets: [outer, core], scaleY: Math.max(20, cy - topY) / 2, duration: ms * .5, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [outer, core], scaleX: 0, alpha: 0, delay: ms * .5, duration: ms * .9, onComplete: () => { outer.destroy(); core.destroy(); } });
    this.fx.glow(cx, cy, big ? 60 : 22, 0xff4a6a, ms, .9);
    this.fx.embers(cx, cy, [0xffffff, 0xff8a9a], big ? 12 : 4, { speed: 40 });
    Sfx.play('recall');
  }

  // 보스 정화: 문이 열리고 보상. 최종 보스는 다음 지방 포털 + (챕터에 따라) Z크리스탈·메가스톤, 히든 전설은 전설 기술 카드
  bossDefeated(boss) {
    if (boss.partner && boss.partner.alive) {   // 짝 보스: 한 마리가 쓰러지면 남은 한 마리가 각성 (전투는 계속)
      this.boss = boss.partner;
      boss.partner.awaken();
      this.events.emit('banner', `${boss.name} 정화!`, `${boss.partner.name}이(가) 유대의 힘으로 각성했다`);
      this.fx.hitStop(160);
      return;
    }
    if (this.chain && this.chain.i < this.chain.list.length - 1) { this.nextInChain(boss); return; }   // 이어 싸우기 (디아루가 → 펄기아 · 레드의 포켓몬 → 무한다이노)
    if (this.test) { this.testBossDone(boss); return; }
    const room = boss.room, final = room.type === 'boss', hidden = room.type === 'sanctuary', tr = this.trainer, last = this.stageIdx >= STAGES.length - 1;
    const lv = this.level, here = f => () => { if (this.level === lv && !this.over) f(); };   // 지방에 묶인 연출: 그새 다른 지방으로 갔으면 건너뛴다 (예전엔 포털을 먼저 타면 관동 정화가 성도에서 터졌다)
    this.boss = null; this.bosses = []; this.chain = null; this.arenaRoom = null;
    if (this.player.flipT > 0) this.player.flipT = .001;
    if (tr) {   // 세뇌된 트레이너가 정신을 차린다 (레드는 이미 풀려 있으면 마지막 한마디)
      const L = TRAINER_LINES[tr.kind];
      if (!tr.freed) {
        tr.release(L.freed); this.time.delayedCall(1200, () => this.events.emit('toast', L.toast));
        if (tr.kind === 'cynthia') {   // 정신을 차린 난천: 레드 · 무한다이노 · 유대의 불꽃 · 기라티나 — 그동안 합류 창은 기다린다
          this.storyWait = true;
          this.time.delayedCall(5600, () => this.openStory({ name: '난천', portrait: { key: 'trainer:cynthia:free', max: 1.6, glow: 0xd8c8ff }, lines: CYNTHIA_LINES, onEnd: () => { this.storyWait = false; } }));
        }
      }
      else if (L.end) this.time.delayedCall(1400, () => tr.say(L.end));
    }
    this.events.emit('boss', null);
    const drop = final ? (this.stageIdx === DROPS.megastone ? 'megastone' : null) : null;
    const hiddenStone = hidden && (room.main || boss.bossKey === DROPS.hiddenStone);   // 샛길 히든 전설 중 메가스톤은 신오 다크라이 하나 (본길 기라티나는 늘)
    const sub = drop === 'megastone' ? '정신을 되찾았다 · 메가스톤이 빛난다' : hidden ? (hiddenStone ? '전설이 깨어났다 · 전설의 기술 카드와 메가스톤을 남겼다' : '전설이 깨어났다 · 전설의 기술 카드를 남겼다') : '정신을 되찾았다';
    this.events.emit('banner', `${boss.name} 정화!`, sub);
    this.fx.hitStop(220);
    for (let k = 0; k < 3; k++) this.time.delayedCall(k * 160, () => { this.fx.ring(boss.x + rand(-20, 20), boss.y + rand(-20, 20), 40 + k * 10, 0xe0b0ff, 300); Sfx.play('boom'); });   // 껍질에 금이 가는 박자
    room.cleared = true;
    if (final && room.riftTo) this.time.delayedCall(1300, () => this.openRift(room));   // 창기둥 제단: 디아루가 · 펄기아를 모두 정화하면 제단 뒤 균열이 영구히 열린다
    this.time.delayedCall(700, here(() => {
      this.setGates(room, true);
      this.unlockArena();
      if (drop) this.spawnPickup(drop, boss.x, boss.y - 10);
      bossNuggets(room.type, !!coreOfBoss(boss.bossKey)).forEach((id, k) => this.spawnPickup('nugget', boss.x - 10 + k * 20, boss.y - 18, id));   // 중간 보스 금구슬 · 지방/히든 보스 큰 금구슬 확정
      if (hiddenStone) this.spawnPickup('megastone', boss.x, boss.y - 24);   // 숨겨진 심연의 균열(신오 다크라이 · 본길 기라티나): 다른 포켓몬용 메가스톤
      if (Math.random() < ITEM_DROP.boss) this.spawnPickup('item', boss.x + 14, boss.y - 10, pick(RANDOM_ITEM_KEYS));   // 보스는 강화 아이템 확정
      if (hidden) { this.spawnPickup('item', boss.x - 14, boss.y - 10, pick(RANDOM_ITEM_KEYS)); this.time.delayedCall(1500, () => this.openLegendCards()); }
    }));
    const gate = this.gateOf(room);
    if (gate && !gate.late) this.time.delayedCall(1500, here(() => this.chapterGate(room, true)));   // 🌀 조력자 · 다음 지방 포털 (100% · 자동 이동은 없다)
    Save.data.bestStage = Math.max(Save.data.bestStage, this.stageIdx + 1); Save.write();
    if (final) {   // 지방 최종 보스 정화 = 그 지방 클리어 → 클리어로 합류하는 특수 포켓몬 (가디안·마기라스·망나뇽)
      Save.data.cleared = Math.max(Save.data.cleared || 0, this.stageIdx + 1);
      if (!last) this.time.delayedCall(2600, here(() => this.purifyRegion()));   // 지방 전체의 침식이 걷힌다 · 방이 평화롭고 밝게
      else this.time.delayedCall(1600, here(() => this.trueEnding(boss, room)));   // 진 최종전: 황금빛 새벽 · 레드의 인사 · 유대의 불꽃 영구 획득 (포털로 들어가면 진 엔딩)
      if (room.originHall) this.time.delayedCall(7000, here(() => { this.storyWait = true; this.arceusTelepathy(room); }));   // 시초의 방: 엔딩 대신 아르세우스의 텔레파시 (합류 창은 그 뒤로)
      if (boss.bossKey === 'mewtwo') this.time.delayedCall(6400, here(() => { this.storyWait = true; this.telepathy('mewtwo', '뮤츠 · 텔레파시', MEWTWO_LINES, 0xd8a0ff, 'wave'); }));   // 관동: 정화된 뮤츠가 알려 주는 첫 단서 (storyWait 는 막 열 때만 — 예전엔 먼저 떠나면 합류 창이 영영 멈췄다)
      const joined = Save.newlyJoined();
      this.time.delayedCall(5600, () => this.announceJoin(joined));
    }
    Music.play(this.areaBgm());
  }

  // 시초의 방: 아르세우스를 정화하면 엔딩 대신 텔레파시 — 유대의 불꽃 · 가라르 심연의 결계 · 진짜 배후 → 제단 오른쪽에 가라르로 가는 포털
  // 정화된 전설의 텔레파시 (관동 뮤츠 · 하나 아르세우스): 그 자리에 머무는 전설의 도트를 초상으로 대화창 — 대화를 마칠 때까지 합류 창은 기다린다 (storyWait)
  telepathy(key, name, lines, col, sfx, onEnd = null) {
    if (this.over) { this.storyWait = false; return; }
    const e = (this.restingBosses || []).find(q => q.bossKey === key && q.sprite && q.sprite.scene);
    if (e) { this.fx.ring(e.x, e.y, 80, col, 900); this.fx.ring(e.x, e.y, 50, 0xffffff, 700); this.fx.glow(e.x, e.y, 90, col, 900, .7); }
    this.cameras.main.flash(300, 255, 244, 230, true); Sfx.play(sfx);
    const portrait = e ? { key: e.sprite.texture.key, frame: e.sprite.frame.name, glow: col, max: 1.4 } : { key: 'glow', tint: col, max: 1 };
    this.openStory({ name, portrait, lines, onEnd: () => { this.storyWait = false; if (onEnd && !this.over && this.level) onEnd(); } });
  }
  arceusTelepathy(room) {
    this.telepathy('arceus', '아르세우스 · 텔레파시', ARCEUS_LINES, 0xfff0b0, 'arceus', () => {
      const x = Math.min(room.right - 40, room.cx + 170), gy = this.groundBelow(x, room.top + 8);
      this.cameras.main.flash(400, 255, 244, 210, true); Sfx.play('resonate');
      for (let k = 0; k < 3; k++) this.time.delayedCall(k * 140, () => this.fx.ring(x, gy - 20, 30 + k * 30, 0xfff0b0, 500));
      this.fx.burst(x, gy - 20, [0xfff0b0, 0xffffff, 0xff8aa0], 30, 200, { glow: true, up: 80, life: .8 });
      this.spawnPortal(x, gy, `창조의 힘이 가라르 심연의 결계를 열었다 — 제단 오른쪽 포털로 ${STAGES[this.stageIdx + 1] ? STAGES[this.stageIdx + 1].region : '다음 지방'}에!`);
    });
  }

  // ---------------- 유대의 불꽃 정화 (보스를 쓰러뜨리는 순간 · 테스트룸 제외) ----------------
  //  ① 주인공의 가슴에서 황금빛 · 진홍빛 『유대의 불꽃』 파동이 뿜어져 나와, 보스를 감싼 무한다이노의 검붉은 침식 오라를 태운다
  //  ② 정화된 보스가 감사의 뜻으로 순수한 힘을 불꽃에 보탠다 — 빛 구슬이 주인공에게 흡수된다
  //  ③ 침식의 핵(지방 최종 보스 · 이어 싸우기의 마지막)이면 정화 단계 +1 → HUD 불꽃이 커지고 화면 위쪽에 알림 (bondStageGain)
  //  가라르의 무한다이노는 nextInChain 의 유대의 불꽃 시네마틱이 단계를 채운다 · 진 최종전(아비스 네크로즈마)은 오버드라이브가 대신
  bondPurify(e) {
    if (this.test || this.overdrive || e.bossKey === 'necrozma' || e.bossKey === 'eternatus') return;
    const p = this.player, room = e.room, ch = this.chain, si = this.stageIdx, ex = e.x, ey = e.y, name = e.name, lvB = this.level;
    const last = !ch || ch.i >= ch.list.length - 1, pair = e.partner && e.partner.alive;
    const core = !!(room && room.type === 'boss' && last && !pair && si < STAGES.length - 1);
    const heroes = !!(room && room.spiralTop && last && !pair);   // 용나선탑 꼭대기 제크로무 → 레시라무: 진실과 이상의 성화 (유대의 불꽃 Lv.5 — data/bond.js)
    for (let k = 0; k < 3; k++) this.time.delayedCall(k * 120, () => { if (this.player) this.fx.ring(p.x, p.y - 6, 20 + k * 18, k % 2 ? BOND_CRIMSON : BOND_GOLD, 420); });
    this.fx.glow(p.x, p.y - 6, 30, BOND_GOLD, 500, .9);
    for (let k = 0; k < 12; k++) this.time.delayedCall(k * 40, () => { if (this.player && this.level) this.bondOrb(p.x, p.y - 6, { x: ex + (Math.random() - .5) * 36, y: ey + (Math.random() - .5) * 30 }, k % 2 ? BOND_CRIMSON : BOND_GOLD, 420, .55); });
    Sfx.play('fire');
    this.time.delayedCall(420, () => {   // 침식 오라가 불꽃에 타오른다
      if (!this.level) return;
      Sfx.play('fire');
      this.time.addEvent({ delay: 60, repeat: 14, callback: () => { if (this.level) this.fx.burst(ex + (Math.random() - .5) * 50, ey + (Math.random() - .5) * 40, [BOND_GOLD, BOND_CRIMSON, 0x3a0a1a, 0xffe8a0], 3, 60, { angle: -Math.PI / 2, spread: .7, up: 90, grav: -60, bounce: false, glow: true, life: .6 }); } });
      this.fx.ring(ex, ey, 46, BOND_GOLD, 500); this.fx.ring(ex, ey, 30, BOND_CRIMSON, 420); this.fx.glow(ex, ey, 60, BOND_CRIMSON, 700, .8);
      this.fx.floatText(ex, ey - 40, '🔥 유대의 불꽃!', '#ffd890', 11);
    });
    this.time.delayedCall(1400, () => {   // 순수한 힘이 불꽃에 보태진다
      if (!this.player || !this.level) return;
      for (let k = 0; k < 14; k++) this.time.delayedCall(k * 45, () => { if (this.player && this.level) this.bondOrb(ex + (Math.random() - .5) * 30, ey + (Math.random() - .5) * 30, this.player, k % 3 ? BOND_GOLD : 0xffffff, 520, .45); });
      Sfx.play('heal');
    });
    this.time.delayedCall(2500, () => {
      if (!this.player || !this.level || this.over) return;
      const q = this.player;
      for (let k = 0; k < 3; k++) this.time.delayedCall(k * 110, () => { if (this.player) this.fx.ring(q.x, q.y - 6, 24 + k * 22, k % 2 ? BOND_CRIMSON : BOND_GOLD, 500); });
      this.fx.burst(q.x, q.y - 6, [BOND_GOLD, BOND_CRIMSON, 0xffffff], 24, 160, { glow: true, up: 80, grav: -40, bounce: false, life: .7 });
      if ((core || heroes) && this.level === lvB) {   // 🔥 침식의 핵: 보스가 있던 자리에 유대의 불꽃이 남는다 — 다가가 설명을 읽고 F 로 품으면 정화 단계 +1 (포털을 먼저 타도 · 저장해도 잃지 않는다)
        const fy = Math.min(ey, this.floorAt(ex, room) - 20);
        this.spawnPickup('bondflame', ex, fy, core ? si : HEROES_KEY, true);
        this.fx.ring(ex, fy, 40, BOND_GOLD, 500); this.fx.glow(ex, fy, 40, BOND_CRIMSON, 600, .9);
        this.events.emit('toast', '🔥 보스가 있던 자리에 유대의 불꽃이 남았다 — 다가가 F 로 품자');
      } else if (!core && !heroes) { this.events.emit('bond', `🔥 유대의 불꽃이 ${name}의 침식을 태워 냈다`, null); Sfx.play('purify'); }
    });
  }
  // 정화 단계 +1: HUD 불꽃이 커지고 화면 위쪽 알림 (같은 핵은 한 번만) → 단계가 올랐으면 그 단계의 영구 권능 해금 (data/bond.js)
  //  key: 침식의 핵을 정화한 지방 번호 · 용나선탑 흑백 영웅(HEROES_KEY)
  bondStageGain(key) {
    if (this.test || this.bondStages.has(key)) return;
    const before = this.bondStage;
    this.bondStages.add(key);
    const n = this.bondStage;
    this.events.emit('bond', `🔥 레드가 남긴 [유대의 불꽃]이 공명하여 더욱 강해집니다! (정화 단계: ${n} / 6)`, n);
    Sfx.play('mega');
    if (n > before) this.time.delayedCall(2300, () => this.bondPowerUnlock(n));
  }
  // 유대의 불꽃 Lv.n 권능 해금: 화면 한가운데 불꽃 문양 배너 (UIScene.showBondPower) · 소지 한도가 늘면 상처약 1개를 채워 준다
  bondPowerUnlock(n) {
    const pw = BOND_POWERS[n - 1], p = this.player;
    if (!pw || !p || this.over) return;
    if (potionMaxAt(n) > potionMaxAt(n - 1)) { p.uses = p.uses || {}; p.uses.potion = Math.min(p.potionMax, (p.uses.potion || 0) + 1); }
    this.events.emit('bondPower', n);
    for (let k = 0; k < 4; k++) this.time.delayedCall(k * 120, () => { if (this.player) this.fx.ring(p.x, p.y - 6, 24 + k * 20, k % 2 ? BOND_CRIMSON : BOND_GOLD, 520); });
    this.fx.burst(p.x, p.y - 6, [BOND_GOLD, BOND_CRIMSON, 0xffffff], 30, 180, { glow: true, up: 100, grav: -50, bounce: false, life: .8 });
    Sfx.play('unlock');
  }

  // ---------------- 유대의 불꽃 (가라르 · 블랙나이트의 심장) ----------------
  //  허공이 찢어진다: 가로로 들쭉날쭉한 검은 틈 · 검붉은 테 · 보랏빛 번짐 (close() 로 다시 닫힌다)
  abyssTearFx(x, y, w, col = 0xff2a5a) {
    const g = this.add.graphics().setDepth(7.8), o = { k: 0 }, jag = [];
    for (let i = 0; i <= 24; i++) jag.push(Math.sin(i * 2.1) * 5 + Math.cos(i * 1.3) * 4);
    const draw = () => {
      g.clear();
      if (o.k < .02) return;
      const top = [], bot = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24, xx = x - w / 2 + w * t, h = Math.sin(t * Math.PI) * 26 * o.k + 1; top.push({ x: xx, y: y + jag[i] - h }); bot.push({ x: xx, y: y + jag[i] + h * .8 }); }
      const poly = [...top, ...bot.reverse()];
      g.fillStyle(0x8a2aff, .2); g.fillPoints(poly.map(q => ({ x: x + (q.x - x) * 1.08, y: y + (q.y - y) * 1.6 })), true);
      g.fillStyle(0x000000, .95); g.fillPoints(poly, true);
      g.lineStyle(3, col, .95); g.strokePoints(poly, true);
      g.lineStyle(1, 0xffc0d0, .9); g.strokePoints(top, false);
    };
    this.tweens.add({ targets: o, k: 1, duration: 700, ease: 'Cubic.easeOut', onUpdate: draw });
    this.worldObjs.push(g);
    const tear = { x, y, g, closing: false, close: () => { if (tear.closing || !g.scene) return; tear.closing = true; this.tweens.add({ targets: o, k: 0, duration: 800, ease: 'Cubic.easeIn', onUpdate: draw, onComplete: () => g.destroy() }); } };
    return tear;
  }
  // 포켓몬 도트 하나 (연출용 · 시트가 없으면 null): 발끝 (x, y) 에 서서 face 쪽을 본다
  showMon(key, x, y, face = 1, depth = 8.4) {
    const anim = `${key}:Idle:${face > 0 ? 'right' : 'left'}`;
    if (!this.anims.exists(anim)) return null;
    const meta = (this.registry.get('spriteMeta') || {})[key], oy = meta && meta.anims && meta.anims.Idle ? meta.anims.Idle.oy : .75;
    const s = this.add.sprite(x, y, key).setOrigin(.5, oy).setDepth(depth);
    s.play(anim);
    this.worldObjs.push(s);
    return s;
  }
  // 불꽃 구슬 하나: (x, y) 에서 피어올라 곡선을 그리며 tgt(레드의 가슴)로 빨려 든다
  bondOrb(x, y, tgt, col, ms = 900, sc = .32) {
    const o = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(sc).setDepth(31), k = { t: 0 };
    const mx = (x + tgt.x) / 2 + (Math.random() - .5) * 160, my = Math.min(y, tgt.y) - 60 - Math.random() * 80;
    this.tweens.add({ targets: k, t: 1, duration: ms + Math.random() * ms * .55, ease: 'Sine.easeIn',
      onUpdate: () => {
        const t = k.t, u = 1 - t;
        o.setPosition(u * u * x + 2 * u * t * mx + t * t * tgt.x, u * u * y + 2 * u * t * my + t * t * tgt.y);
        if (Math.random() < .35) this.fx.burst(o.x, o.y, [col, 0xffffff], 1, 10, { grav: 0, bounce: false, glow: true, life: .3, size: 1 });
      },
      onComplete: () => { o.destroy(); this.fx.glow(tgt.x, tgt.y, 16, col, 180, .8); } });
  }
  //  무한다이노 정화 → ① 레드를 가둔 결정에 금이 가고 산산조각 · 레드가 쓰러진다 → ② 주인공 · 파티 · 정화한 전설들의 환영에서 황금빛 · 진홍빛 불꽃 구슬이 피어올라 레드의 가슴으로 (화면 가운데 자막)
  //  → ③ 진홍빛 오라가 터지며 레드가 눈을 뜨고 모자를 고쳐 쓴다 → ④ 무한다이노의 몸을 찢고 아비스 네크로즈마가 빠져나와 하늘을 가른다 → ⑤ 레드의 한마디 (대화창) → done (오버드라이브 + 진 최종전)
  bondFlameCinematic(room, prev, done) {
    const cam = this.cameras.main, p = this.player, ADD = Phaser.BlendModes.ADD, core = this.props && this.props.redCore;
    const gy = core ? core.Y : room.F * TILE, cx = core ? core.x : room.cx, top = core ? core.top : gy - 170;   // gy: 결정 기둥이 선 바닥
    const run = this.arenaRun, later = (ms, f) => this.time.delayedCall(ms, () => { if (this.arenaRoom === room && this.arenaRun === run && !this.over) f(); });   // 같은 아레나를 다시 시작해도 앞 판의 연출은 이어지지 않는다
    this.cinema = true; p.inv = 999; p.b.setVelocityX(0); Music.stop();
    this.combat.clearAll();   // 남은 탄 · 장판(무한다이맥스의 붉은 하늘 등)을 걷는다
    makeTrainerArt(this, 'red');
    const red = core ? core.red : this.add.image(cx, gy - 22, 'trainer:red:sleep').setOrigin(.5, 1).setScale(2).setDepth(3.52).setTint(0xb8b0c8);
    if (!core) this.worldObjs.push(red);
    this.redAlly = { img: red, aura: [] };
    const ghosts = [];
    // ① 금 → 산산조각 → 쓰러진 레드
    const cracks = this.add.graphics().setDepth(3.6).setBlendMode(ADD);
    this.worldObjs.push(cracks);
    const crack = n => { for (let i = 0; i < n; i++) { let x = cx + (Math.random() - .5) * 50, y = top + 40 + Math.random() * 110; const pts = [{ x, y }]; for (let k = 0; k < 4; k++) { x += (Math.random() - .5) * 26; y += (Math.random() - .5) * 26; pts.push({ x, y }); } cracks.lineStyle(2, 0xffd0d8, .95); cracks.strokePoints(pts, false); } };
    later(900, () => { crack(4); this.fx.shake(.008, 300); Sfx.play('crack'); });
    later(1500, () => { crack(6); this.fx.shake(.012, 300); Sfx.play('crack'); if (core && core.light) core.light.setIntensity(2.6); });
    later(2200, () => {
      cracks.destroy();
      if (core) { core.broken = true; for (const o of [core.back, core.front, core.chains, core.halo, core.core]) if (o && o.scene) o.setVisible(false); if (core.light) core.light.setIntensity(0); }
      const my = top + 90;
      this.fx.shatter(cx, my, 90, 170, { n: 60, speed: 260, up: 140, scale: 2, depth: 46 });
      this.fx.burst(cx, my, [0xff2a4a, 0xffa0b8, 0xffffff], 50, 260, { glow: true, life: .9 });
      cam.flash(300, 255, 120, 150, true); this.fx.shake(.024, 600); shockwave(this, cx, my, .04, 900); Sfx.play('shatter'); Sfx.play('boom');
      red.setOrigin(.5, .5).setPosition(red.x, red.y - 48);
      this.tweens.add({ targets: red, y: gy - 14, angle: -90, duration: 650, ease: 'Bounce.easeOut' });   // 쓰러져 미동도 없다 (누우면 몸통 옆선이 도트 가운데에서 10px — 몸통이 바닥에 닿게)
    });
    // ② 유대의 불꽃이 돌아간다
    later(3300, () => {
      this.events.emit('caption', BOND_CAPTION, 5000);
      Sfx.play('resonate');
      const srcs = [{ x: p.x, y: p.y - 6 }];
      p.members.forEach((m, i) => {   // 파티: 출전 중이 아닌 동료도 주인공 둘레에 황금빛 환영으로
        if (i === p.idx) return;
        const side = srcs.length % 2 ? -1 : 1, x = Phaser.Math.Clamp(p.x + side * (34 + 18 * Math.floor(srcs.length / 2)), room.left + 20, room.right - 20), s = this.showMon(m.key, x, this.groundBelow(x, p.y), p.face, 19);
        if (!s) return;
        s.setTint(0xffe8b0).setAlpha(0); this.tweens.add({ targets: s, alpha: .8, duration: 500 });
        ghosts.push(s); srcs.push({ x, y: s.y - 14 });
      });
      const legends = LEGEND_GHOSTS.filter(k => this.anims.exists(`${k}:Idle:left`));
      const v = cam.worldView, ly = Math.max(room.ty0 * TILE + 70, v.y + 80);   // 화면 위쪽 (아레나가 화면보다 높아도 보이게)
      legends.forEach((k, i) => {   // 지금까지 정화한 전설들의 환영: 화면 위쪽에 줄지어
        const x = v.x + 40 + (i + .5) * (v.width - 80) / legends.length, y = ly + (i % 2) * 30, s = this.showMon(k, x, y, x < cx ? 1 : -1, 7.9);
        if (!s) return;
        s.setTint(0xfff0c0).setBlendMode(ADD).setAlpha(0); this.tweens.add({ targets: s, alpha: .5, duration: 800, delay: i * 90 });
        ghosts.push(s); srcs.push({ x, y: y - 24 });
      });
      let n = 0;
      this.time.addEvent({ delay: 70, repeat: 52, callback: () => { if (this.arenaRoom === room && red.scene) { const s = srcs[n++ % srcs.length]; this.bondOrb(s.x, s.y, red, n % 2 ? BOND_GOLD : BOND_CRIMSON); } } });
      for (let k = 0; k < 4; k++) this.time.delayedCall(k * 900, () => { if (red.scene) { this.fx.glow(red.x, red.y, 30 + k * 8, k % 2 ? BOND_CRIMSON : BOND_GOLD, 600, .7); Sfx.play('heal'); } });
    });
    // ③ 레드가 깨어난다
    later(7800, () => {
      for (const s of ghosts) this.tweens.add({ targets: s, alpha: 0, duration: 900, onComplete: () => s.destroy() });
      cam.flash(400, 255, 90, 110, true); shockwave(this, red.x, red.y, .05, 1000); chromatic(this, .012, 700); this.fx.shake(.02, 600);
      for (let k = 0; k < 5; k++) this.time.delayedCall(k * 120, () => this.fx.ring(red.x, red.y, 40 + k * 40, k % 2 ? BOND_GOLD : BOND_CRIMSON, 600));
      this.fx.burst(red.x, red.y, [BOND_CRIMSON, BOND_GOLD, 0xffffff], 60, 300, { glow: true, up: 100, life: 1 });
      Sfx.play('mega'); Sfx.play('purify_world');
      red.clearTint();
      this.tweens.add({ targets: red, angle: 0, y: gy - 48, duration: 600, ease: 'Back.easeOut', onComplete: () => red.setOrigin(.5, 1).setPosition(red.x, gy) });
      this.redAlly.aura = [BOND_CRIMSON, BOND_GOLD].map((c, i) => { const a = this.add.image(red.x, gy - 48, 'glow').setBlendMode(ADD).setTint(c).setScale(i ? 1.6 : 2.4, i ? 2.4 : 3.2).setAlpha(0).setDepth(3.5); this.tweens.add({ targets: a, alpha: i ? .3 : .4, duration: 600 }); this.worldObjs.push(a); return a; });
    });
    later(8700, () => { red.setTexture('trainer:red:free'); this.fx.floatText(red.x, gy - 104, '……!', '#ffe8b0', 11); });   // 눈을 뜬다
    later(9500, () => { red.setTexture('trainer:red:cap'); Sfx.play('select'); });   // 모자를 고쳐 쓴다
    later(10200, () => red.setTexture('trainer:red:free'));
    // ④ 무한다이노의 몸을 찢고 아비스 네크로즈마가
    later(10600, () => this.abyssEmerge(room, prev));
    // ⑤ 레드의 한마디 → 진 최종전
    later(13600, () => this.openStory({ name: '레드', look: 'red', lines: [RED_LINE], onEnd: () => { this.cinema = false; done(); } }));
  }
  // 무한다이노의 몸을 찢고 아비스 네크로즈마가 빠져나와 하늘을 가른다 (아직 싸우지 않는다 — 검은 프리즘 실루엣이 찢어진 하늘 앞에 머문다)
  abyssEmerge(room, prev) {
    const cam = this.cameras.main, e = prev && prev.sprite && prev.sprite.scene ? prev : null;
    const v = cam.worldView, ex = e ? e.sprite.x : room.cx, ey = e ? e.sprite.y : v.y + 120, tx = room.cx, ty = Math.max(room.ty0 * TILE + 44, v.y + 44);   // ty: 천장 타일 아래 · 화면 위쪽 허공
    if (e) {
      e.leaving = true;   // updateResting 이 손대지 않게
      for (const tw of [e.breathTw, e.bobTw, e.swayTw]) if (tw) tw.stop();
      this.tweens.add({ targets: e.sprite, x: ex + 3, duration: 50, yoyo: true, repeat: 12 });
      e.sprite.setTint(0x6a1424);
    }
    Sfx.play('ghost'); Sfx.play('boss'); this.fx.shake(.01, 900);
    const sil = this.add.graphics().setDepth(17.9).setPosition(ex, ey).setScale(.2).setAlpha(0);
    sil.fillStyle(0xff2a6a, .3); sil.fillCircle(0, 0, 30);
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 - Math.PI / 2, P = d => [Math.cos(a) * 36, Math.sin(a) * 36, Math.cos(a + d) * 12, Math.sin(a + d) * 12];
      const [x1, y1, x2, y2] = P(.35), [, , x3, y3] = P(-.35);
      sil.fillStyle(0x12020a, 1); sil.fillTriangle(x1, y1, x2, y2, x3, y3);
      sil.lineStyle(1, k % 2 ? 0xb04aff : 0xff2a6a, 1); sil.strokeTriangle(x1, y1, x2, y2, x3, y3);
    }
    sil.fillStyle(0x000000, 1); sil.fillCircle(0, 0, 13); sil.fillStyle(0xff2a6a, 1); sil.fillCircle(0, 0, 4);
    this.worldObjs.push(sil); this.abyssSil = sil;
    this.time.delayedCall(900, () => {
      if (!sil.scene) return;
      if (e && e.sprite && e.sprite.scene) {
        this.fx.burst(ex, ey, [0xff2a6a, 0x000000, 0xb04aff], 50, 260, { glow: true, life: .9 });
        for (const o of e.auraImgs || []) o.destroy();
        e.auraImgs = null;
        this.tweens.add({ targets: e.sprite, alpha: 0, scaleX: e.sprite.scaleX * .6, scaleY: e.sprite.scaleY * .6, duration: 900, onComplete: () => { e.destroy(); this.enemies = this.enemies.filter(q => q !== e); this.restingBosses = (this.restingBosses || []).filter(q => q !== e); } });
      }
      cam.flash(260, 120, 0, 40, true); Sfx.play('shatter');
      sil.setAlpha(1);
      this.tweens.add({ targets: sil, scale: 1.4, duration: 500, ease: 'Back.easeOut' });
      this.tweens.add({ targets: sil, angle: 360, duration: 4000, repeat: -1 });
    });
    this.time.delayedCall(1600, () => {
      if (!sil.scene) return;
      this.abyssTear = this.abyssTearFx(tx, ty, 360, 0xff2a6a);
      chromatic(this, .026, 1400); shockwave(this, tx, ty, .05, 1000); this.fx.shake(.026, 1100); cam.flash(220, 160, 20, 60, true);
      Sfx.play('rift'); Sfx.play('roar');
      this.tweens.add({ targets: sil, x: tx, y: ty + 40, duration: 1200, ease: 'Cubic.easeInOut' });
      this.events.emit('banner', '아비스 네크로즈마', '무한다이노를 숙주로 삼았던 차원 너머의 진짜 배후 — 심연의 지배자가 하늘을 가른다');
    });
  }
  // 유대의 불꽃 오버드라이브 (진 최종전): 파티 전원 체력 100% · 황금빛 · 진홍빛 오라(Cores.bondAura) · 모든 공격 2배 + 맞힌 자리마다 화염 폭발 (Combat · Cores)
  //  아레나 뒤편에서 레드 · 리자몽 · 피카츄가 5초마다 블래스트번 + 볼트태클 합동 공격 (updateOverdrive)
  startOverdrive(room) {
    const p = this.player, cam = this.cameras.main, ra = this.redAlly, red = ra && ra.img, gy = this.floorAt(room.cx, room);
    for (const m of p.members) { m.alive = true; m.hp = m.maxhp; }
    p.inv = Math.max(p.inv > 100 ? 0 : p.inv, 2);
    const rx = Math.max(room.left + 90, room.cx - 170);
    if (red && red.scene) { red.setFlipX(true); this.tweens.add({ targets: red, x: rx, duration: 700, ease: 'Sine.easeInOut' }); }   // 레드는 보스 쪽(오른쪽)을 본다
    const zard = this.showMon('charizard', rx + 46, gy - 34, 1, 3.55), pika = this.showMon('pikachu', rx - 30, gy, 1, 3.55);
    for (const [s, x, y] of [[zard, rx + 46, gy - 50], [pika, rx - 30, gy - 10]]) { if (s) s.setAlpha(0); this.fx.ring(x, y, 30, 0xffffff, 300); this.fx.glow(x, y, 34, 0xffffff, 300, 1); if (s) this.tweens.add({ targets: s, alpha: 1, duration: 300 }); }   // 몬스터볼에서
    this.overdrive = { room, t: 2.5, red, zard, pika, rx, gy };
    this.events.emit('banner', '🔥 유대의 불꽃 오버드라이브!', '모든 공격 2배 · 맞힌 자리마다 화염 폭발 · 5초마다 레드 · 리자몽 · 피카츄의 합동 공격');
    cam.flash(500, 255, 210, 140, true); shockwave(this, p.x, p.y, .04, 900); this.fx.shake(.018, 500);
    for (let k = 0; k < 4; k++) this.time.delayedCall(k * 120, () => this.fx.ring(p.x, p.y, 30 + k * 30, k % 2 ? BOND_CRIMSON : BOND_GOLD, 500));
    this.fx.burst(p.x, p.y, [BOND_GOLD, BOND_CRIMSON, 0xffffff], 50, 260, { glow: true, up: 100, life: .9 });
    Sfx.play('mega'); Sfx.play('heal');
  }
  updateOverdrive(dt) {
    const od = this.overdrive;
    if (!od) return;
    const t = this.time.now / 1000, ra = this.redAlly;
    if (ra && od.red && od.red.scene) {
      ra.aura.forEach((a, i) => { if (a.scene) a.setPosition(od.red.x, od.gy - 48).setAlpha((i ? .26 : .34) + Math.sin(t * 4 + i) * .08); });
      if (Math.random() < .3) this.fx.burst(od.red.x + (Math.random() - .5) * 30, od.gy - Math.random() * 90, [BOND_GOLD, BOND_CRIMSON], 1, 20, { angle: -Math.PI / 2, spread: .6, up: 40, grav: -30, bounce: false, glow: true, life: .7 });
    }
    const boss = this.boss;
    if (!boss || !boss.alive || boss.state === 'intro' || boss.room !== od.room) return;
    if ((od.t -= dt) > 0) return;
    od.t = 5;
    this.jointAttack(od, boss);
  }
  // 레드 · 리자몽 · 피카츄 합동 공격: 블래스트번(리자몽에서 보스까지 굵은 화염 줄기 · 보스 자리 화염 폭발) → 볼트태클(피카츄가 번개를 두르고 보스에게 돌진했다 돌아온다)
  jointAttack(od, boss) {
    const p = this.player, ADD = Phaser.BlendModes.ADD, alive = () => boss.alive && this.boss === boss && this.combat;
    if (od.red && od.red.scene) this.fx.floatText(od.red.x, od.gy - 104, '리자몽, 블래스트번! 피카츄, 볼트태클!', '#ffe8b0', 9);
    Sfx.play('select');
    const zx = od.zard && od.zard.scene ? od.zard.x : od.rx + 46, zy = od.zard && od.zard.scene ? od.zard.y - 16 : od.gy - 70;
    this.time.delayedCall(250, () => {
      if (!alive()) return;
      const g = this.add.graphics().setDepth(31).setBlendMode(ADD);
      for (const [w, col, a] of [[26, 0xff3a1a, .3], [14, 0xff8a2a, .75], [5, 0xffe0a0, 1]]) { g.lineStyle(w, col, a); g.lineBetween(zx, zy, boss.x, boss.y); }
      this.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
      this.combat.damageEnemy(boss, p.atk * 2.5, 'fire', { proc: true, heavy: true, hs: 40, kb: 0, kby: 0, hx: boss.x, hy: boss.y });
      for (let k = 0; k < 3; k++) this.time.delayedCall(k * 90, () => this.fx.ring(boss.x, boss.y, 40 + k * 26, k % 2 ? 0xffd040 : 0xff5a1a, 420));
      this.fx.burst(boss.x, boss.y, [0xff3a1a, 0xff8a2a, 0xffe0a0, 0xffffff], 40, 260, { glow: true, up: 100, life: .7 });
      this.fx.floatText(boss.x, boss.top - 34, '블래스트번!', '#ff9a4a', 12);
      this.fx.shake(.012, 260); Sfx.play('fire'); Sfx.play('boom');
    });
    this.time.delayedCall(750, () => {
      if (!alive()) return;
      const pk = od.pika && od.pika.scene ? od.pika : null, hit = () => {
        if (!alive()) return;
        this.combat.damageEnemy(boss, p.atk * 2.5, 'electric', { proc: true, heavy: true, hs: 40, kb: 0, kby: 0, paralyze: .2, hx: boss.x, hy: boss.y });
        this.fx.floatText(boss.x, boss.top - 48, '볼트태클!', '#ffe040', 12);
        this.fx.ring(boss.x, boss.y, 50, 0xffe040, 360); this.fx.burst(boss.x, boss.y, [0xffe040, 0xffffff, 0x6ad8ff], 30, 240, { glow: true, up: 60, life: .5 });
      };
      Sfx.play('thunder');
      if (!pk) { hit(); return; }
      const x0 = pk.x, y0 = pk.y;
      this.tweens.add({ targets: pk, x: boss.x, y: boss.y, duration: 260, ease: 'Quad.easeIn',
        onUpdate: () => { this.fx.ghost(pk, 0xffe040, .5, 160); this.fx.burst(pk.x, pk.y - 8, [0xffe040, 0xffffff], 2, 80, { up: 0, grav: 0, bounce: false, glow: true, life: .2 }); },
        onComplete: () => { hit(); if (pk.scene) this.tweens.add({ targets: pk, x: x0, y: y0, duration: 380, ease: 'Quad.easeOut' }); } });
    });
  }
  // 오버드라이브를 끈다 (진 엔딩 · 보스전 초기화 · 월드를 떠날 때): 리자몽 · 피카츄는 사라지고, keepRed 면 레드는 남는다
  endOverdrive(keepRed = false) {
    const od = this.overdrive;
    this.overdrive = null;
    if (od) for (const s of [od.zard, od.pika]) if (s && s.scene) { this.tweens.killTweensOf(s); this.tweens.add({ targets: s, alpha: 0, duration: 600, onComplete: () => s.destroy() }); }
    if (!keepRed && this.redAlly) { for (const o of [this.redAlly.img, ...this.redAlly.aura]) if (o && o.scene) { this.tweens.killTweensOf(o); o.destroy(); } this.redAlly = null; }
  }
  // 진 엔딩: 아비스 네크로즈마 정화 → 오버드라이브가 잦아들고 황금빛 새벽 → 레드의 인사 → 유대의 불꽃 영구 획득 → 포털 (들어가면 진 엔딩 화면)
  trueEnding(boss, room) {
    if (this.over) return;
    this.endOverdrive(true);
    Music.play('celestial');
    this.originDawn(boss, '세상이 구원되었다', '모두의 유대의 불꽃이 심연의 지배자를 불태웠다 · 전 지방의 하늘이 맑게 갠다');
    Save.data.bondFlame = true; Save.write();
    const red = this.redAlly && this.redAlly.img;
    if (red && red.scene) { this.tweens.add({ targets: red, x: Math.min(room.right - 160, Math.max(room.left + 90, this.player.x + 70)), duration: 1400, ease: 'Sine.easeInOut' }); red.setFlipX(false); }
    this.time.delayedCall(3600, () => this.openStory({ name: '레드', look: 'red', lines: RED_THANKS, onEnd: () => {
      if (this.over || !this.level) return;
      this.events.emit('toast', '🔥 레드의 유대의 불꽃을 얻었다 — 다음 여정부터 처음부터 지니고 시작한다', 'core_red_bond');
      const x = Math.min(room.right - 40, room.cx + 170);
      this.spawnPortal(x, this.groundBelow(x, room.top + 8), '포털로 들어가 여정을 마치자 — 진 엔딩');
    } }));
  }

  // 폼체인지 아이템을 지닌 전설 보스(디아루가·펄기아·기라티나)는 정화하면 그 아이템을 떨어뜨린다
  dropFormItem(boss) {
    const id = Object.keys(FORM_ITEMS).find(k => FORM_ITEMS[k].boss === boss.bossKey);
    if (id && !this.player.formItems.has(id)) this.time.delayedCall(900, () => { if (this.level) this.spawnPickup('formitem', boss.x, boss.y - 12, id); });
  }

  // 보스를 정화해 새로 합류한 동료들: 정화 완료 쇼케이스 창을 하나씩
  announceJoin(keys) {
    for (const k of keys) { if (this.over) return; this.runStats.unlocked.push(k); this.queueJoin(k, 'join'); }
  }

  // ---------------- 정화 완료 쇼케이스 (UIScene.showJoin) ----------------
  //  창이 떠 있는 동안 게임은 완전히 멈춘다: 물리 · 적 AI · 애니메이션 · 트윈(setFrozen) + 게임 타이머(time.paused) · 배경은 흐리게
  //  확인(Enter · Space · Z · 터치 · Esc)을 눌러야 닫히고 그 자리에서 이어진다. 여러 마리면 차례로
  queueJoin(k, kind = 'join') {
    if (this.test || !SPECIES[k]) return;
    (this.joinQueue = this.joinQueue || []).push({ k, kind });
    this.nextJoin();
  }
  nextJoin() {
    if (!this.joinQueue || !this.joinQueue.length || this.overlay === 'join') return;
    if (this.overlay || this.over || this.transitioning || this.paused || this.cinema || this.storyWait) {   // 다른 창(기술머신 카드 등) · 이야기 연출 · 텔레파시가 끝나길 기다린다
      if (!this.joinWait) { this.joinWait = true; this.time.delayedCall(600, () => { this.joinWait = false; this.nextJoin(); }); }
      return;
    }
    this.joinCur = this.joinQueue.shift();
    this.toggleOverlay('join');
    if (this.overlay !== 'join') { this.joinQueue.unshift(this.joinCur); this.joinCur = null; return; }
    this.time.paused = true;
    const cam = this.cameras.main;
    if (this.webgl && cam.postFX && !this.joinBlur) this.joinBlur = cam.postFX.addBlur(1, 1.5, 1.5, 1.2);
    Sfx.play('unlock');
  }
  closeJoin() { if (this.overlay === 'join') this.toggleOverlay('join'); }
  afterJoin() {
    this.time.paused = false;
    this.joinCur = null;
    if (this.joinBlur) { this.cameras.main.postFX.remove(this.joinBlur); this.joinBlur = null; }
    if (this.joinQueue && this.joinQueue.length) this.time.delayedCall(350, () => this.nextJoin());
  }
  // ---------------- ✨ 샛길 정화 (오염 구역 정화 보상) ----------------
  //  방은 둘로 나뉜다 (room.zone):
  //   · main_path — 입구에서 보스방까지 곧장 가는 본길(World 의 room.main). 어둡고 긴장감 있는 분위기 그대로 ·
  //     몬스터를 다 잡아도 세지 않고, 다른 방에 다녀오면 다시 나타난다 (respawnMainRoom)
  //   · side_purifiable_room — 갈림길에서 빠지는 샛길 · 고리 길 · 막다른 굴(엘리트 수문장 굴 · 보물방)처럼 본길이 아닌 방 중 침식된 포켓몬이 나오는 곳
  //     처음엔 보랏빛 가시 덩굴 · 검붉은 침식 안개 · 오염된 포자가 뒤덮고 있다 (game/SideRooms.js)
  //  샛길 구역 안의 침식된 포켓몬을 마지막 한 마리까지 쓰러뜨리는 순간에만 그 방이 [✨ 정화 완료 (Purified)] 로 영구히 바뀐다 (방에 들어서기만 해서는 세지 않는다)
  //   → 유대의 불꽃 파동 · 침식이 걷히고 환하고 따뜻한 성역 · 지도에 에메랄드 · 금빛 · 다시 와도(이어하기도) 몬스터가 절대 나오지 않는다 (room.isPurified — RunSave)
  //  정화한 샛길 구역이 SIDE_STEPS(3곳 · 6곳)에 닿을 때마다 보유 카드 강화 (지방마다 2번 · lv.masteryGot)
  //  안 세는 곳: 본길 · 몬스터가 없는 방 · 마을 · 성역(peaceful) · 연구소 · 기술머신 비밀방 · 보스방 · 정화한 지방 · 테스트룸
  sideRoomsOf(lv = this.level) {
    if (!lv) return [];
    if (!lv.sideList) {   // 지형은 시드로 정해지므로 이어하기 · 다시 와도 같은 목록 — 지방(level)에 한 번 세어 둔다
      const live = new Set();
      for (const sp of lv.spawns) if (sp.room && !this.safeSpawn(sp, lv)) live.add(sp.room);
      lv.sideList = lv.test ? [] : lv.rooms.filter(r => !r.main && live.has(r) && !r.lab && !r.tutorial && !r.peaceful && (r.type === 'combat' || r.type === 'pocket' || r.type === 'treasure'));
      lv.sideSet = new Set(lv.sideList);
      for (const r of lv.rooms) r.zone = lv.sideSet.has(r) ? 'side_purifiable_room' : r.main ? 'main_path' : null;
    }
    return lv.sideList;
  }
  isSideRoom(room, lv = this.level) { if (!room || !lv) return false; this.sideRoomsOf(lv); return lv.sideSet.has(room); }
  sideCount(lv = this.level) { return this.sideRoomsOf(lv).reduce((n, r) => n + (r.isPurified ? 1 : 0), 0); }
  sideSteps(lv = this.level) { return sideSteps(this.sideRoomsOf(lv).length); }
  // 이 샛길 구역에 남은 침식된 포켓몬: 아직 나타나지 않은 자리(안전 구역은 빼고) + 살아 있는 몬스터
  sideRemain(room) {
    const lv = this.level;
    if (!room || !lv) return 0;
    let n = 0;
    for (const sp of lv.spawns) if (sp.room === room && !sp.spawned && !this.safeSpawn(sp)) n++;
    for (const e of this.enemies) if (e.alive && !e.boss && e.room === room) n++;
    return n;
  }
  // 몬스터가 쓰러질 때 · 마지막 자리가 안전 구역이라 아무도 나오지 않은 채 끝날 때: 샛길 구역의 침식된 포켓몬을 모두 정화했는가
  checkRoomClear(room) {
    const lv = this.level;
    if (!room || !lv || room.isPurified || lv.purified || lv.test || this.test || this.over || !this.isSideRoom(room)) return;
    if (!(room.foes > 0)) return;   // 아직 한 마리도 마주치지 않았다 (들어서기만 해서는 세지 않는다)
    if (lv.spawns.some(sp => sp.room === room && !sp.spawned)) return;   // 아직 나타나지 않은 자리가 남았다 (흙에 덮인 굴의 수문장 포함)
    if (this.enemies.some(e => e.alive && !e.boss && e.room === room)) return;
    this.purifySideRoom(room);
  }
  purifySideRoom(room) {
    const lv = this.level, p = this.player;
    room.isPurified = true;
    if (this.side) this.side.purify(room, p.x, p.y - 10);   // 유대의 불꽃 파동 · 덩굴이 타 사라지고 안개가 걷힌다 → 성역
    this.atmoRush = 2;   // 비네팅 · 채도 · 주변광이 2초쯤에 걸쳐 환하고 따뜻하게
    Sfx.play('purify_world');
    this.fx.floatText(p.x, p.y - 30, '✨ 정화 완료 (Purified)', '#fff0b0', 12);
    this.time.delayedCall(350, () => { if (this.level === lv) { this.tintRooms(); this.colorTorches(); } });   // 타일 · 횃불이 따뜻한 빛으로
    this.time.delayedCall(650, () => { if (this.level === lv && this.props) this.props.repaintRoom(room); });   // 시든 나무 · 풀이 푸르게 · 바닥 균열이 사라진다
    const n = this.sideCount(), S = this.sideSteps(), got = lv.masteryGot || 0;
    this.events.emit('mastery', n);
    if (got >= S.length) { this.events.emit('toast', '[✨ 정화 완료 (Purified)] 침식된 샛길 구역을 정화했다 — 이제 몬스터가 나오지 않는 성역이다', 'tm'); return; }
    const step = S[got];
    this.events.emit('toast', `[✨ 정화 완료 (Purified)] 침식된 샛길 구역을 정화했다! — 샛길 정화 ${Math.min(n, step)} / ${step} 구역`, 'tm');
    if (n < step) return;
    lv.masteryGot = got + 1;
    this.time.delayedCall(900, () => {
      if (this.level !== lv) return;
      this.events.emit('toast', `✨ 침식된 샛길 구역 ${step}곳 정화! 오염 구역 정화 보상 — 유대의 힘으로 보유 카드 강화`, 'tm');
      this.fx.ring(p.x, p.y, 40, 0xffd25a, 420); this.fx.burst(p.x, p.y, [0xffd25a, 0x8affb0, 0xffffff], 18, 140, { glow: true, up: 80 });
    });
    this.queueBonusCards({ up: step }, 1.8);   // 정화 연출이 끝난 뒤 (보스전 · 다른 창이 끝나면)
  }
  // 본길 전투 방(main_path): 다른 방에 MAIN_RESPAWN_MS 넘게 다녀오면 쓰러뜨린 자리에 침식된 포켓몬이 다시 나타난다 (엘리트는 빼고)
  //  바로 곁 자리는 플레이어가 조금 떨어진 뒤에 나타난다 (minGap — 눈앞에 갑자기 솟지 않게)
  respawnMainRoom(room) {
    const lv = this.level, p = this.player;
    if (!lv || !room || lv.purified || this.test || !room.main || room.type !== 'combat' || room.leftAt == null || this.time.now - room.leftAt < MAIN_RESPAWN_MS) return;
    for (const sp of lv.spawns) {
      if (sp.room !== room || !sp.spawned || sp.elite || (sp.enemy && sp.enemy.alive)) continue;
      sp.spawned = false; sp.enemy = null; sp.minGap = 130; sp.respawn = true;   // 다시 나타난 몬스터: 경험치 · 전리품 25% (killEnemy)
    }
  }
  // 강화 창 열기: 보유 카드 중 강화할 수 있는 것 가운데 무작위 3장 (1 ~ 2장뿐이면 그만큼) — 하나도 없으면 체력 30% 회복으로 대신
  openUpgrade(q) {
    const p = this.player;
    let cards = (q.cards || []).map(c => { const m = p.members.find(x => x.key === c.key); return m && heldLv(m, c.card) < CARD_MAX_LV && ownedUpgrades(p).some(o => o.m === m && o.card.kind === c.card.kind && o.card.id === c.card.id) ? Object.assign(c, { info: upgradeInfo(m, c.card) }) : null; }).filter(Boolean);   // 다시 열 때: 그 사이 강화된 카드는 새 수치로 · 더 못 올리면 뺀다
    if (!cards.length) {
      const pool = ownedUpgrades(p);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      cards = pool.slice(0, MASTERY_CARDS).map(o => ({ key: o.m.key, card: o.card, info: upgradeInfo(o.m, o.card) }));
    }
    if (!cards.length) {   // 강화할 카드가 없다 (아직 없거나 모두 +3강 ★초월): 체력 회복 보너스
      p.heal(p.m.maxhp * MASTERY_HEAL);
      this.fx.ring(p.x, p.y, 34, 0x7dff9a, 380); this.fx.glow(p.x, p.y, 34, 0x7dff9a, 420, .8); Sfx.play('heal');
      this.events.emit('toast', `✨ 오염 구역 정화 보상 — 강화할 보유 카드가 없어 ${p.formName()} 체력 ${Math.round(MASTERY_HEAL * 100)}% 회복`, 'tm');
      return;
    }
    this.upActive = { up: q.up, cards, sel: 0, used: false };
    this.toggleOverlay('upgrade');
    Sfx.play('mega');
  }
  // 강화 창에서 i 번째 카드를 골랐다: 포켓몬을 다시 고르지 않고 그 카드 주인에게 바로 +1 (기술머신 합성과 같은 applyCard)
  applyUpgrade(i) {
    const it = this.upActive, p = this.player, c = it && !it.used && it.cards[i], m = c && p.members.find(x => x.key === c.key);
    if (!m) return null;
    applyCard(p, m, c.card, c.card.slot || 'x');
    it.used = true;
    const lv = heldLv(m, c.card);
    return { name: (c.card.baseName || c.card.name).replace(/^\[★초월\] /, ''), lv, who: p.formName(m) };
  }
  finishUpgrade(r) {
    if (this.overlay === 'upgrade') this.toggleOverlay('upgrade');
    if (!r) return;
    const p = this.player;
    this.events.emit('toast', `🔨 ${r.name}이(가) ${r.lv >= CARD_MAX_LV ? '+3강 ★초월' : '+' + r.lv + '강'}으로 강화되었습니다! (${r.who})`, 'tm');
    this.fx.ring(p.x, p.y, 40, 0xffd25a, 420); this.fx.glow(p.x, p.y, 40, 0xffd25a, 500, 1);
    this.fx.burst(p.x, p.y, [0xffd25a, 0xffffff, 0xffb040], 24, 150, { glow: true, up: 90 });
    Sfx.play('unlock');
  }
  // ---------------- 빛나는 TM 코어 → 카드 3장 중 1장 (이제 보스 · 엘리트는 떨어뜨리지 않는다 — 예전 저장에 남은 코어 · 현장 전송만) ----------------
  //  보스전 · 연출 · 다른 창이 열려 있으면 기다렸다가 연다 (bonusQueue — 숙련도 강화 { up } 도 같은 줄) · 고르지 않고 닫으면 같은 카드로 잠시 뒤 다시
  queueBonusCards(kind, wait = 0) { (this.bonusQueue = this.bonusQueue || []).push(kind); this.bonusT = Math.max(this.bonusT || 0, wait); }
  tryBonusCards() {
    if (!this.bonusQueue || !this.bonusQueue.length || !this.player || this.over || this.paused || this.overlay || this.transitioning || this.cinema || this.storyWait || this.arenaRoom || this.tmOpening) return;
    const q = this.bonusQueue.shift(), p = this.player;
    if (q && q.up) { this.openUpgrade(q); return; }   // ✨ 오염 구역 정화 보상: 보유 카드 강화
    const it = typeof q === 'object' ? q : { kind: 'tm', bonus: q, used: false, member: p.m, cards: rollCards(p, { n: BONUS_CARDS }), flipped: Array(BONUS_CARDS).fill(false), sel: -1,
      title: '✨ 빛나는 TM 코어', note: '엘리트 · 보스를 정화하고 얻은 빛나는 TM 코어가 카드 3장을 전송한다' };
    this.tmActive = it;
    this.toggleOverlay('tm');
    Sfx.play('mega');
  }
  // 히든 전설 보상: 출전 중인 포켓몬에게 맞춘 '전설' 등급 기술 카드 3장
  openLegendCards() {
    if (this.over || this.transitioning || this.overlay) { this.time.delayedCall(800, () => this.openLegendCards()); return; }
    const m = this.player.m;   // 히든 전설 보상: 유니크 이상 · 한 장은 반드시 전설
    const it = { kind: 'tm', legend: true, used: false, member: m, cards: rollCards(this.player, { floor: '유니크', legend: true }), flipped: Array(TM_CARDS).fill(false), sel: -1 };
    this.tmActive = it;
    this.toggleOverlay('tm');
    Sfx.play('mega');
  }

  spawnPickup(kind, x, y, id, still = false) {
    // 아이템·상처약은 가방과 같은 본가 그림을 16칸 크기로 (월드 배율만큼 곱게 줄여 둔다). 그림이 없으면 도트 아이콘
    const artId = kind === 'item' || kind === 'nugget' ? id : kind === 'potion' ? 'potion' : kind === 'candy' ? 'rare_candy' : null, art = artId && itemArt(this, artId, 16 * ZOOM);
    if (kind === 'tmcore') tmCoreTexture(this);
    if (kind === 'bondflame') bondFlameArt(this);
    if (kind === 'orb') orbTexture(this, id);
    const img = this.physics.add.image(x, y, art || (kind === 'item' ? `it:${id}` : kind === 'orb' ? `orb:${id}` : kind === 'bondflame' ? 'bondflame' : kind === 'potion' ? 'oran' : kind === 'formitem' ? 'megastone' : kind)).setDepth(19);   // 폼체인지 아이템은 구슬 모양 (색으로 구분)
    if (kind === 'formitem') img.setTint(FORM_ITEMS[id].color);
    if (art) { img.setDisplaySize(16, 16); img.body.setSize(10 / img.scaleX, 16 / img.scaleY); }   // 몸통도 그림 크기에 맞춰 바닥에 딱 놓이게
    else img.body.setSize(10, 10);
    if (!still) img.setVelocity(rand(-70, 70), -190);
    img.body.setBounce(.35); img.body.setDragX(120);
    const col = kind === 'bondflame' ? BOND_GOLD : kind === 'orb' ? BEAST_ORBS[id].color : kind === 'tmcore' ? 0xffd25a : kind === 'formitem' ? FORM_ITEMS[id].color : kind === 'megastone' ? 0xff8ad0 : kind === 'zcrystal' ? 0xfff6a0 : kind === 'oran' ? 0x4a7aff : kind === 'potion' ? 0xd88aff : kind === 'candy' ? 0x9ad8ff : kind === 'nugget' ? NUGGETS[id].color : 0xffe08a;
    const glow = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(kind === 'nugget' ? .8 : .5).setDepth(18);
    if (kind === 'nugget') img.setVelocity(rand(-60, 60), -260);   // 금구슬은 더 높이 튀어 오른다
    const coll = this.physics.add.collider(img, this.layers);
    const pk = { kind, id, img, glow, coll, t: 0 };
    this.pickups.push(pk);
    if (!AUTO_PICK.has(kind)) img.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.tapPickup(pk));   // 📱 아이템을 직접 눌러도 줍는다 (가까이 있을 때)
    return pk;
  }

  // 작은 샛길에 들어서면 덮어 둔 흙이 걷히며 굴이 드러난다 (지도에도 그때부터 나온다)
  updateCovers() {
    if (!this.covers.length) return;
    const pb = this.player.bounds();
    for (let i = this.covers.length - 1; i >= 0; i--) {
      const c = this.covers[i];
      if (!overlap(pb, c.sd.area)) continue;
      c.sd.revealed = true;
      this.covers.splice(i, 1);
      for (const pk of this.pickups) if (pk.hiddenBy === c.sd) { pk.img.setVisible(true); pk.glow.setVisible(true); }
      this.tweens.add({ targets: c.layers, alpha: 0, duration: 380, onComplete: () => c.layers.forEach(l => l.destroy()) });
      for (let k = 0; k < 10; k++) { const [x, y] = c.sd.cells[(Math.random() * c.sd.cells.length) | 0]; this.fx.burst(x * TILE + 8, y * TILE + 8, [0x6a5a48, 0x4a4036], 1, 40, { up: 10, grav: 300, life: .5, size: 1 }); }
      Sfx.play('land');
      if (c.sd.reward === 'elite') this.events.emit('toast', '숨겨진 굴… 붉은 기운의 수문장이 지키고 있다!');
    }
  }

  // 🖐️ 필드 아이템: 금구슬만 닿으면 자동 · 나머지는 반경 PICK_R 안에서 가장 가까운 하나에 포커스(금빛 고리) + 작은 설명 툴팁 → F / ↑ / 조사 버튼 / 터치로 줍는다 (updateInteract)
  updatePickups(dt) {
    const pl = this.player, pb = pl.bounds(), t = this.time.now / 1000;
    let best = null, bd = PICK_R;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt;
      p.glow.setPosition(p.img.x, p.img.y).setAlpha(.5 + Math.sin(p.t * 6) * .2);
      if (p.kind === 'nugget' && Math.random() < .1) this.fx.burst(p.img.x + rand(-6, 6), p.img.y + rand(-6, 4), [0xfff6c0, 0xffd84a, 0xffffff], 1, 18, { grav: -50, bounce: false, glow: true, life: .45, size: 1 });   // 찬란한 반짝임
      if (p.kind === 'bondflame' && Math.random() < .3) this.fx.embers(p.img.x + rand(-4, 4), p.img.y - 4, [BOND_GOLD, BOND_CRIMSON], 1);
      if (p.img.y > this.level.height + 40) p.img.body.reset(p.img.x, 4 * TILE);
      if (AUTO_PICK.has(p.kind)) { if (p.t > .4 && overlap(pb, { x: p.img.x - 8, y: p.img.y - 8, w: 16, h: 16 })) this.takePickup(p); continue; }
      const d = Math.hypot(p.img.x - pl.x, p.img.y - (pl.y - 4));
      if (p.t > .3 && d < bd) { bd = d; best = p; }
    }
    this.pickFocus = this.overlay || this.cinema || this.transitioning ? null : best;
    // 포커스 고리: 가장 가까운 아이템 하나 (여러 개가 겹쳐 있어도 차례로)
    if (!this.pickRing) { this.pickRing = this.add.image(0, 0, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe08a).setDepth(18.6); this.worldObjs.push(this.pickRing); }
    const f = this.pickFocus;
    this.pickRing.setVisible(!!f);
    if (f) this.pickRing.setPosition(f.img.x, f.img.y).setScale(.38 + Math.sin(t * 7) * .04).setAlpha(.75 + Math.sin(t * 7) * .2);
    const pn = !f && this.portal && this.portalNear && !this.overlay && !this.cinema && !this.transitioning;
    const tm = !f && !pn && !this.overlay && !this.cinema && !this.transitioning && this.props ? this.props.nearest(pl.x, pl.bottom) : null;   // 🟡 기술머신 받침대
    if (f) this.showTip(f, this.pickupInfo(f), f.img.x, f.img.y - 10);
    else if (pn) this.showTip(this.portal, this.portalInfo(), this.portal.x, this.portal.y - 26);
    else if (tm && tm.kind === 'tm') this.showTip(tm, this.tmInfo(tm), tm.x, tm.tipY);
    else this.hideTip();
    for (const c of this.chests) {
      if (c.opened) continue;
      c.glow.setAlpha(.45 + Math.sin(this.time.now / 200) * .15);
      if (overlap(pb, { x: c.img.x - 9, y: c.img.y - 8, w: 18, h: 16 })) this.openChest(c);
    }
  }

  // 하나 줍기 (효과 · 소리는 collect) — 땅에서 치운다
  takePickup(p) {
    const i = this.pickups.indexOf(p);
    if (i < 0) return;
    this.pickups.splice(i, 1);
    if (p.img.scene) this.fx.ring(p.img.x, p.img.y, 22, 0xffe08a, 260);
    this.collect(p);
    if (p.coll) p.coll.destroy(); p.img.destroy(); p.glow.destroy();
    if (this.pickFocus === p) { this.pickFocus = null; this.hideTip(); }
  }
  // 📱 아이템을 직접 눌렀다: 가까이 있으면 줍는다
  tapPickup(p) {
    const pl = this.player;
    if (!pl || this.overlay || this.paused || this.cinema || this.transitioning || p.t < .3) return;
    if (Math.hypot(p.img.x - pl.x, p.img.y - pl.y) <= PICK_R + 30) this.takePickup(p);
    else this.events.emit('toast', '조금 더 가까이 가야 주울 수 있다');
  }
  // 툴팁 세 줄: [등급 · 종류] 이름 / 한 줄 설명 / 습득 안내 (깜빡이는 노란 글자)
  pickupInfo(p) {
    const cut = (sx, n = 40) => { const s0 = String(sx || '').replace(/\{[a-z]:([^}]*)\}/g, '$1').split(' · ')[0].split('. ')[0].trim(); return s0.length > n ? s0.slice(0, n - 1) + '…' : s0; };
    if (p.kind === 'item') {
      const it = ITEMS[p.id] || {}, core = it.core;
      return core ? { tag: '🟣 유니크', tagCol: '#d88aff', name: it.name, desc: cut(core.desc.replace(/^\S+\s/, ''), 44) } : { tag: '🔵 도구', tagCol: '#8ac8ff', name: it.name || p.id, desc: cut(it.desc) };
    }
    if (p.kind === 'tmcore') return { head: '🟡 [모험 보상: 기술머신 캡슐]', tagCol: '#ffd25a', desc: '— 고대의 기술 데이터를 해독하여 새로운 카드를 획득합니다.', act: '해독' };   // 예전 저장에 남은 빛나는 TM 코어
    if (p.kind === 'orb') { const o = BEAST_ORBS[p.id]; return { tag: `${o.icon} 열쇠`, tagCol: '#' + o.color.toString(16).padStart(6, '0'), name: o.name, desc: '방울탑 최상층 칠색조의 제단에 바치는 성수의 구슬' }; }
    if (p.kind === 'bondflame') return { tag: '🔥 유대', tagCol: '#ffc040', name: '유대의 불꽃', desc: '레드가 남긴 불꽃 — 정화 단계 +1 · 영구 권능 해금' };
    if (p.kind === 'candy') return { tag: '🟢 성장', tagCol: '#7dff9a', name: '이상한사탕', desc: '이 지방 몬스터 8마리분 경험치 (가방에서 먹인다)' };
    if (p.kind === 'potion') return { tag: '💊 회복', tagCol: '#ff9ad8', name: CONSUMABLES.potion.name, desc: '출전 중인 포켓몬 체력 40% 회복' };
    if (p.kind === 'oran') return { tag: '💊 회복', tagCol: '#8ab8ff', name: '오렌열매', desc: '출전 중인 포켓몬 체력 20% 회복' };
    if (p.kind === 'zcrystal') return { tag: '💎 Z파워', tagCol: '#fff6a0', name: 'Z크리스탈', desc: 'Q 로 Z기술을 쓸 수 있게 된다' };
    if (p.kind === 'formitem') return { tag: '💎 폼체인지', tagCol: '#d8b8ff', name: FORM_ITEMS[p.id].name, desc: '그 전설이 파티에 있으면 V 로 폼체인지' };
    return { tag: '💎 메가진화', tagCol: '#ff8ad0', name: '메가스톤', desc: '파티 포켓몬의 메가스톤 — 3단 진화 후 V 로 메가진화' };
  }
  portalInfo() {
    const n = this.stageIdx + 1, last = n >= STAGES.length;
    return last ? { tag: '🌀 여정의 끝', tagCol: '#ffd890', name: '진 엔딩 게이트', desc: '모두의 유대가 세상을 구했다 — 여정을 마친다', act: '입장' }
      : { tag: `🌀 ${STAGES[n].region}(Ch.${n + 1}) 이동 게이트`, tagCol: '#8ad8ff', name: '', desc: `${PORTAL_DEST[n] || STAGES[n].areas[0].name}으로 이동합니다.`, act: '입장' };
  }
  // 저장해 둔 자리(몸 가운데)가 바위 · 부서지는 벽 속이면 같은 방에서 가장 가까운 설 자리 (발밑 단단한 땅 · 위로 두 칸 빈칸)
  freeStand(level, at) {
    const G = level.grid, tx = Math.floor(at.x / TILE), cy = Math.floor(at.y / TILE);
    const solid = (x, y) => !G[y] || G[y][x] === undefined || G[y][x] === 'S' || G[y][x] === 'B';
    if (!solid(tx, cy) && !solid(tx, cy - 1)) return at;
    const r = roomAt(level, at.x, at.y), x0 = r ? r.tx0 : tx - 30, x1 = r ? r.tx1 : tx + 30, y0 = r ? r.ty0 : cy - 20, y1 = r ? r.F : cy + 20;
    let best = null, bd = Infinity;
    for (let x = x0; x < x1; x++) for (let g = y0 + 2; g <= y1; g++) {
      if (!G[g] || !'SBP'.includes(G[g][x]) || solid(x, g - 1) || solid(x, g - 2)) continue;
      const d = Math.abs(x - tx) + Math.abs(g - cy) * 1.5;
      if (d < bd) { bd = d; best = { x: x * TILE + 8, y: g * TILE - 12 }; }
    }
    return best || level.start;
  }
  // 🟡 모험 보상 기술머신 받침대 툴팁 (game/Props.js 'tm') — 봉인된 받침대는 무엇을 하면 풀리는지
  tmInfo(it) {
    if (it.sealed) return it.pr && it.pr.seal === 'guard'
      ? { head: '🔒 [수문장의 결계: 기술머신 캡슐]', tagCol: '#ff8a6a', desc: '붉은 오라의 수문장이 받침대를 지키고 있다 — 수문장을 쓰러뜨리면 결계가 풀린다.', foot: '[ 결계에 막혀 해독할 수 없다 ]' }
      : { head: '🔒 [정화 봉인: 기술머신 캡슐]', tagCol: '#ff7a9a', desc: '침식 덩굴이 받침대를 휘감았다 — 이 구역의 침식된 포켓몬을 모두 쓰러뜨려 정화하면 풀린다.', foot: '[ 봉인되어 해독할 수 없다 ]' };
    return { head: '🟡 [모험 보상: 기술머신 캡슐]', tagCol: '#ffd25a', desc: '— 고대의 기술 데이터를 해독하여 새로운 카드를 획득합니다.', act: '해독' };
  }
  // 🟡 모험 보상 기술머신의 봉인: B 정화 봉인(그 샛길 구역을 정화할 때까지) · D 수문장 결계(둥지의 붉은 오라 수문장이 살아 있는 동안)
  //  지방 전체를 정화했거나 테스트룸이면 풀려 있다
  tmSealed(pr) {
    const lv = this.level, r = pr && pr.room;
    if (!pr || !pr.seal || pr.used || this.test || !lv || lv.purified || !r || r.isPurified) return false;
    if (pr.seal === 'purify') return true;
    if (pr.seal === 'guard') return lv.spawns.some(sp => sp.room === r && sp.elite && (!sp.spawned || (sp.enemy && sp.enemy.alive)));
    return false;
  }
  // 🟡 도전 금고 가시 함정 (World hazards): 발이 가시에 닿으면 최대 체력 8% 피해 + 위로 튕겨 오른다 (무적 중에도 튕긴다 — 가시 위엔 서 있을 수 없다)
  updateHazards() {
    const lv = this.level, p = this.player;
    if (!lv || !lv.hazards || !lv.hazards.length || !p || !p.b || p.dead || this.over) return;
    const fx = p.x, fy = p.bottom;
    for (const h of lv.hazards) {
      if (fx < h.x0 * TILE - 3 || fx > (h.x1 + 1) * TILE + 3) continue;
      const floor = (h.y + 1) * TILE;
      if (fy < floor - 7 || fy > floor + 3) continue;
      const hit = p.takeHit(Math.max(3, Math.round(p.m.maxhp * .08)), 'none', fx + (p.face || 1) * 4, { noParry: true });
      p.b.setVelocityY(-330);
      if (hit) {
        this.fx.burst(fx, floor - 4, [0xc8324a, 0x7a1a32, 0xe8e0d8], 10, 120, { up: 90 });
        if (!this.thornTold) { this.thornTold = true; this.events.emit('toast', '🌵 가시 함정! — 디딤돌을 건너 높은 받침대로 (2단 점프 · 공중 대시 Shift)'); }
      }
      break;
    }
  }
  // 작은 반투명 다크 박스 (아이템 바로 위 · 부드럽게 튀어나온다)
  showTip(target, info, x, y) {
    if (!this.tip) {
      const bg = this.add.graphics(), mk = (sz, col) => this.add.text(0, 0, '', { fontFamily: 'Galmuri9', fontSize: sz + 'px', color: col, resolution: 2, wordWrap: { width: 156, useAdvancedWrap: true } }).setOrigin(.5, 0);
      const t1 = mk(8, '#ffffff'), t2 = mk(7, '#d8d4e8'), t3 = mk(7, '#ffe14a');
      this.tip = { box: this.add.container(0, 0, [bg, t1, t2, t3]).setDepth(62), bg, t1, t2, t3, target: null };
      this.worldObjs.push(this.tip.box);
    }
    const T = this.tip, touch = this.touchInput && this.touchInput.on, head = info.head || (info.name ? `[${info.tag}] ${info.name}` : `[${info.tag}]`);
    if (T.target !== target || T.head !== head) {   // head 가 바뀌면(봉인이 풀렸다) 다시 그린다
      T.target = target; T.head = head;
      T.t1.setText(head).setColor(info.tagCol);
      T.t2.setText(info.desc);
      T.t3.setText(info.foot || (touch ? `[ 🖐️ 조사 버튼 · 터치로 ${info.act || '습득'} ]` : `[ F 키를 눌러 ${info.act || '습득'} ]`));
      const w = Math.min(166, Math.max(T.t1.width, T.t2.width, T.t3.width) + 12), h = T.t1.height + T.t2.height + T.t3.height + 9;
      T.t1.setPosition(0, 3); T.t2.setPosition(0, 3 + T.t1.height + 1); T.t3.setPosition(0, 4 + T.t1.height + T.t2.height + 1);
      T.bg.clear(); T.bg.fillStyle(0x0c0a16, .86); T.bg.fillRoundedRect(-w / 2, 0, w, h, 4); T.bg.lineStyle(1, Phaser.Display.Color.HexStringToColor(info.tagCol).color, .7); T.bg.strokeRoundedRect(-w / 2, 0, w, h, 4);
      T.h = h; T.w = w;
      this.tweens.killTweensOf(T.box);
      T.box.setScale(.82).setAlpha(0);
      this.tweens.add({ targets: T.box, scale: 1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
    }
    const v = this.cameras.main.worldView;
    T.box.setVisible(true).setPosition(Math.round(Phaser.Math.Clamp(x, v.x + T.w / 2 + 4, v.right - T.w / 2 - 4)), Math.round(Math.max(v.y + 4, y - T.h - 6)));
    T.t3.setAlpha(.55 + Math.sin(this.time.now / 140) * .45);   // 깜빡이는 노란 안내
  }
  hideTip() { if (this.tip && this.tip.target) { this.tip.target = null; this.tip.box.setVisible(false); } }

  collect(p) {
    const pl = this.player;
    if (p.kind === 'bondflame') {   // 🔥 유대의 불꽃: 품으면 정화 단계 +1 (이미 같은 핵의 불꽃을 품었으면 따뜻하게 스며들기만)
      this.fx.ring(pl.x, pl.y - 6, 40, BOND_GOLD, 500); this.fx.burst(pl.x, pl.y - 6, [BOND_GOLD, BOND_CRIMSON, 0xffffff], 26, 150, { glow: true, up: 90, grav: -40, bounce: false, life: .7 });
      if (this.bondStages.has(p.id)) { this.events.emit('toast', '🔥 유대의 불꽃이 따뜻하게 스며든다'); Sfx.play('heal'); }
      else this.bondStageGain(p.id);
      return;
    }
    if (p.kind === 'item') {
      const worn = pl.addItem(p.id); this.runStats.items++;   // 출전 중인 포켓몬이 바로 장착 (5칸이 차 있으면 가방으로)
      this.events.emit('toast', worn ? `${ITEMS[p.id].name} → ${pl.formName()} 장착! ${ITEMS[p.id].desc}` : `${ITEMS[p.id].name} → 가방에 넣었다 (${pl.formName()} 장착 칸 ${MAX_EQUIP}개가 가득) · 가방에서 다른 포켓몬에게 장착`, p.id);
      Sfx.play('item'); this.fx.burst(pl.x, pl.y, [0xffe08a, 0xffffff], 14, 120, { glow: true });
    } else if (p.kind === 'candy') {   // 이상한사탕: 가방에 모아 두고, 가방에서 먹일 포켓몬을 골라 경험치를 크게 채운다
      pl.candy = (pl.candy || 0) + 1;
      this.events.emit('toast', `이상한사탕을 얻었다! (${pl.candy}개) · 가방(${keyLabel(Settings.key('bag'))} · 초상화 터치)에서 먹일 포켓몬을 고르자`, 'rare_candy');
      Sfx.play('item'); this.fx.burst(pl.x, pl.y, [0x9ad8ff, 0xff8ad0, 0xffffff], 16, 120, { glow: true, up: 70 });
    } else if (p.kind === 'nugget') {   // 금구슬: 환금 전용 — 포켓샵에서 판다
      const ng = NUGGETS[p.id];
      pl.nuggets[p.id] = (pl.nuggets[p.id] || 0) + 1;
      this.events.emit('toast', `[${ng.name}] 획득! (포켓샵에서 고가에 판매 가능 · ${ng.sell.toLocaleString('ko-KR')} ₽)`, p.id);
      Sfx.play('coin'); this.fx.burst(pl.x, pl.y - 6, [0xffd84a, 0xfff6c0, 0xffffff], 18, 130, { glow: true, up: 90 });
      this.fx.floatText(pl.x, pl.y - 22, `+${ng.sell.toLocaleString('ko-KR')} ₽`, '#ffd84a', 10);
    } else if (p.kind === 'orb') {   // 성수의 구슬: 방울탑 최상층 칠색조의 제단에 바친다 (game/HoohAltar.js)
      const o = BEAST_ORBS[p.id];
      pl.orbs = pl.orbs || {}; pl.orbs[p.id] = true;
      const n = orbCount(this);
      this.events.emit('banner', `${o.icon} ${o.name} (${o.en}) 획득!`, n >= 3 ? '성수의 구슬 3 / 3 — 방울탑 최상층, 칠색조의 제단에 바치자' : `성수의 구슬 ${n} / 3 — 세 개를 모아 방울탑 최상층의 제단에 바치면 칠색조가 강림한다`);
      Sfx.play('bell'); this.fx.ring(pl.x, pl.y, 40, o.color, 420); this.fx.burst(pl.x, pl.y, [o.color, o.light, 0xffffff], 22, 140, { glow: true, up: 90 });
    } else if (p.kind === 'tmcore') {   // 빛나는 TM 코어 (엘리트 · 보스 100%): 그 자리에서 기술머신 카드 3장 중 1장
      this.events.emit('toast', '✨ 빛나는 TM 코어! 기술머신 카드가 전송된다', 'tm');
      Sfx.play('unlock'); this.fx.ring(pl.x, pl.y, 44, 0xffd25a, 420); this.fx.burst(pl.x, pl.y, [0xffd25a, 0xb08aff, 0xffffff], 22, 150, { glow: true, up: 90 });
      this.queueBonusCards('elite', .6);
    } else if (p.kind === 'oran') {
      pl.heal(pl.m.maxhp * .2); Sfx.play('heal');
    } else if (p.kind === 'potion') {   // 상처약: 출전 중인 포켓몬 체력 40%
      const c = CONSUMABLES.potion;
      pl.heal(pl.m.maxhp * c.heal); if (p.mark) p.mark.taken = true;
      this.events.emit('toast', `${c.name}을 썼다! ${pl.formName()} 체력 회복`, 'potion');
      Sfx.play('heal'); this.fx.burst(pl.x, pl.y, [0xd88aff, 0xffffff, 0x8affb0], 16, 110, { glow: true, up: 70 });
    } else if (p.kind === 'zcrystal') {   // Z크리스탈: 처음이면 Z링과 파티 속성 크리스탈 · 그 뒤엔 출전 포켓몬 속성 크리스탈 하나 (data/gear.js)
      const first = !pl.zRing;
      if (first) pl.gainZ(); else pl.gainCrystal(zTypeOf(pl.m.key));
      pl.z.cd = 0;
      this.events.emit('banner', first ? 'Z링 · Z크리스탈 획득!' : `${crystalName(zTypeOf(pl.m.key))} 획득!`, first ? `Q 로 Z기술 — ${pl.members.filter(m => pl.canZ(m)).map(m => ZMOVES[m.sp.zmove].name).join(' · ')}` : '가방에서 그 속성 포켓몬의 Z크리스탈 칸에 끼우면 Q 로 Z기술');
      Sfx.play('unlock'); this.fx.ring(pl.x, pl.y, 50, 0xfff6a0, 400); this.fx.burst(pl.x, pl.y, [0xfff6a0, 0xffffff, 0x9ad8ff], 24, 160, { glow: true });
    } else if (p.kind === 'formitem') {   // 폼체인지 아이템: 그 전설이 파티에 있으면 V 로 오리진폼 (포켓몬센터 보관함에서 데려올 수 있다)
      const it = FORM_ITEMS[p.id], who = Object.values(SPECIES).find(sp => sp.megas.some(m => m.item === p.id));
      pl.formItems.add(p.id);
      this.events.emit('banner', `${it.name} 획득!`, `${who ? who.name : '그 전설'}을(를) 파티에 넣고 V 로 폼체인지 — 이번 판 끝까지 유지`);
      Sfx.play('unlock'); this.fx.ring(pl.x, pl.y, 50, it.color, 400); this.fx.burst(pl.x, pl.y, [it.color, 0xffffff], 24, 160, { glow: true });
    } else {   // 메가스톤: 출전 포켓몬(없으면 돌이 없는 파티 포켓몬) 계열의 돌 — 그 포켓몬 메가스톤 칸에 바로 (키스톤이 없으면 함께)
      const hadKey = pl.keyStone; pl.keyStone = true;
      const line = pl.gainStone();
      this.events.emit('banner', line ? `${stoneName(line)} 획득!${hadKey ? '' : ' · 키스톤'}` : '메가스톤의 기운만 남았다', line ? `${SPECIES[line].name} 계열 메가스톤 칸에 끼웠다 · 3단 진화 후 V 로 메가진화` : '파티 모두 이미 메가스톤이 있다 (보관함 포켓몬에게 줄 돌이 있으면 다음에)');
      Sfx.play('unlock'); this.fx.ring(pl.x, pl.y, 50, 0xff8ad0, 400);
    }
  }

  // 상자 data: 월드에 남는 기록 { x, y, treasure, opened }
  spawnChest(data) {
    const img = this.add.image(Math.round(data.x), Math.round(data.y - 6), data.opened ? 'chest-open' : 'chest').setDepth(15);
    const glow = this.add.image(data.x, data.y - 6, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd25a).setScale(.7).setAlpha(data.opened ? .2 : 1).setDepth(14);
    this.chests.push({ img, glow, data, opened: !!data.opened, treasure: data.treasure });
  }

  openChest(c) {
    c.opened = c.data.opened = true; c.img.setTexture('chest-open'); c.glow.setAlpha(.2);
    Sfx.play('item'); this.fx.burst(c.img.x, c.img.y, [0xffd25a, 0xffffff, 0xff7a6a], 20, 140, { glow: true });
    // 상자는 대개 오렌열매, 아주 가끔 강화 아이템 (보물 상자는 조금 더 자주 + 오렌열매 하나 더)
    if (Math.random() < (c.treasure ? ITEM_DROP.treasure : ITEM_DROP.chest)) this.spawnPickup('item', c.img.x, c.img.y - 6, pick(RANDOM_ITEM_KEYS));
    else this.spawnPickup('oran', c.img.x, c.img.y - 6);
    if (c.treasure) this.spawnPickup('oran', c.img.x - 4, c.img.y - 6);
  }

  // ---------------- 🌀 지방 최종 보스 정화 뒤: 조력자 · 다음 지방 포털 ----------------
  // 이 방이 지방 관문(CHAPTER_GATES)인가
  gateOf(room, lv = this.level) {
    if (!room || !lv || lv.test) return null;
    return (CHAPTER_GATES[lv.ci ?? this.stageIdx] || CHAPTER_GATES[this.stageIdx] || []).find(g => g.boss === room.boss) || null;
  }
  // 보스방 오른쪽 끝(다음 지방으로 가는 단상)에 빛과 함께 조력자 · 다음 지방 포털 — fresh: 방금 정화했다 (빛기둥 · 안내) / 아니면 이어하기 · 다시 들렀을 때 조용히
  chapterGate(room, fresh = false) {
    const g = this.gateOf(room), lv = this.level;
    if (!g || !lv) return;
    const px = room.right - 36, gx = room.right - 96;
    if (g.guide && !(lv.npcs || []).some(n => n.id === g.guide)) {
      const gy = this.floorAt(gx, room), n = { id: g.guide, x: Math.floor(gx / TILE), g: Math.round(gy / TILE), face: -1, room };
      (lv.npcs = lv.npcs || []).push(n);
      if (this.npcs) this.npcs.add(n);
      if (fresh) {
        const X = n.x * TILE + 8, Y = n.g * TILE, beam = this.add.image(X, Y, 'glow').setOrigin(.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0c0).setScale(.9, 5).setAlpha(.9).setDepth(30);
        this.tweens.add({ targets: beam, alpha: 0, scaleX: .2, duration: 900, onComplete: () => beam.destroy() });
        this.fx.burst(X, Y - 20, [0xfff0c0, 0xffffff, 0xb8ffd8], 26, 140, { glow: true, up: 80, life: .8 }); this.fx.ring(X, Y - 20, 40, 0xfff0c0, 500);
        Sfx.play('resonate');
      }
    }
    if (g.portal && !this.portal) this.spawnPortal(px, this.floorAt(px, room), fresh ? null : '');
    if (fresh) this.time.delayedCall(400, () => { if (this.level === lv) this.events.emit('toast', g.guide ? `💬 ${NPCS[g.guide].name}이(가) 나타났다 — 다가가 F 로 대화하기${g.portal ? ' · 옆의 포털로 다음 지방에' : ''}` : '🌀 다음 지방으로 가는 포털이 열렸다 — 포털 앞에서 F'); });
  }
  // 조력자와 대화: 이 지방 브리핑 · 처음이면 파티 전원 체력 100% 회복 + 자동 저장 (지방마다 한 번)
  talkGuide(it) {
    if (this.overlay || this.paused || this.time.now - (this.talkClosedAt || 0) < 300) return;
    const npc = it.npc, p = this.player, q = p.quests || (p.quests = {}), key = 'guide' + this.stageIdx + ':' + it.id, first = !q[key];
    this.talk = { name: npc.name, look: npc.look, tint: npc.tint, page: 0, id: it.id,
      lines: first ? [...npc.lines, '떠나기 전에 {y:포켓몬들을 모두 회복}시켜 주마. 여기까지의 여정도 {b:기록}해 두지.'] : npc.again || npc.lines,
      onEnd: first ? () => {
        q[key] = true;
        for (const m of p.members) { m.hp = m.maxhp; m.alive = true; }
        p.slowT = 0; if (p.flipT > 0) p.flipT = .001;
        Sfx.play('fieldheal'); this.cameras.main.flash(260, 200, 255, 220, true);
        this.fx.burst(p.x, p.y, [0x7dff9a, 0x4affd8, 0xffffff], 30, 90, { glow: true, up: 70, grav: -40, bounce: false, life: 1 });
        const saved = this.saveRun(true, 'guide');
        this.events.emit('banner', '파티 전원 체력 100% 회복!', saved ? `${npc.name}의 도움 · 자동 저장 완료` : `${npc.name}의 도움`);
      } : null };
    if (this.npcs) this.npcs.greet(it, p.x);
    this.toggleOverlay('talk');
  }

  // ---------------- 출구 포털 / 스테이지 전환 ----------------
  // 🌀 다음 지방 차원 포털 (Next Chapter Gate): 다가가면 작은 안내창 · F 를 눌러야만 들어간다 (자동 이동 없음)
  spawnPortal(x, gy, msg = null) {
    if (this.portal) { this.portal.g.destroy(); this.portal.glow.destroy(); if (this.portal.core) this.portal.core.destroy(); }
    const g = this.add.graphics().setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
    const glow = this.add.image(x, gy - 26, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7ab8ff).setScale(1.8, 2.4).setDepth(12);
    const core = this.add.image(x, gy - 26, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe8a0).setScale(.7, 1.3).setDepth(12.5);
    this.portal = { x, y: gy - 26, g, glow, core, t: 0 };
    if (msg !== '') this.events.emit('toast', msg || (this.stageIdx >= STAGES.length - 1 ? '포털 앞에서 F — 여정을 마치자' : `🌀 ${STAGES[this.stageIdx + 1].region}으로 가는 차원 포털이 열렸다! 포털 앞에서 F`));
  }
  spawnNextChapterPortal(x, gy) { this.spawnPortal(x, gy); }

  updatePortal(dt) {
    const pt = this.portal; if (!pt) { this.portalNear = false; return; }
    pt.t += dt;
    const g = pt.g; g.clear();
    for (let k = 0; k < 5; k++) {   // 푸른빛 · 금빛 소용돌이 고리 (크고 신비롭게)
      const r = 11 + k * 4.5 + Math.sin(pt.t * 4 + k) * 1.6;
      g.lineStyle(2, [0x5ab0ff, 0xffd870, 0x9a7aff, 0x8affe8, 0xffffff][k], .75 - k * .11);
      g.strokeEllipse(pt.x, pt.y, r * 1.15, r * 2.2);
    }
    pt.core.setAlpha(.6 + Math.sin(pt.t * 5) * .25); pt.glow.setAlpha(.55 + Math.sin(pt.t * 2) * .15);
    if (Math.random() < .55) this.fx.embers(pt.x + rand(-12, 12), pt.y + 22, [0x5ab0ff, 0xffd870, 0xffffff], 1);
    const pl = this.player;
    this.portalNear = !this.transitioning && Math.abs(pl.x - pt.x) < PICK_R * .8 && Math.abs(pl.y - pt.y) < 46;
  }
  // F: 포털 흡수 연출 → 다음 지방 (마지막 장이면 진 엔딩)
  enterPortal() {
    const pt = this.portal, pl = this.player;
    if (!pt || this.transitioning || this.overlay || this.portalGoing || this.over) return;
    this.portalGoing = true; this.cinema = true; this.hideTip();
    if (!this.level.purified && this.stageIdx < STAGES.length - 1 && this.level.rooms.some(r => r.type === 'boss' && r.cleared)) this.purifyRegion();   // 정화 연출을 기다리지 않고 들어가도 그 지방은 맑아져 있다
    Sfx.play('unlock'); Sfx.play('resonate');
    this.fx.ring(pt.x, pt.y, 60, 0x8ad8ff, 500); this.fx.ring(pt.x, pt.y, 36, 0xffd870, 420);
    for (let k = 0; k < 18; k++) this.time.delayedCall(k * 25, () => this.fx.burst(pt.x + Math.cos(k) * 40, pt.y + Math.sin(k) * 40, [0x8ad8ff, 0xffd870, 0xffffff], 1, 60, { angle: Math.atan2(-Math.sin(k), -Math.cos(k)), spread: .2, up: 0, grav: 0, bounce: false, glow: true, life: .35 }));
    this.tweens.add({ targets: pl.sprite, alpha: 0, duration: 520, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: pt.glow, scaleX: 3, scaleY: 3.6, duration: 600, ease: 'Quad.easeIn' });
    this.time.delayedCall(620, () => {
      this.cinema = false; this.portalGoing = false;
      this.cameras.main.flash(260, 200, 230, 255, true);
      this.nextStage();
    });
  }

  nextStage() {
    if (this.transitioning) return;
    this.storyWait = false; this.cinema = false; this.altarRite = null; this.hideTip();   // 앞 지방의 대화 대기 · 연출을 모두 풀고 간다
    // 포털에 먼저 들어가도 떨어진 메가스톤·아이템은 잃지 않게 자동으로 줍는다
    for (const p of this.pickups.slice()) if (p.kind !== 'oran' && p.kind !== 'potion') { this.collect(p); p.coll.destroy(); p.img.destroy(); p.glow.destroy(); }
    this.pickups = this.pickups.filter(p => p.kind === 'oran' || p.kind === 'potion');
    if (this.stageIdx >= STAGES.length - 1) { this.gameOver(true); return; }
    this.transitioning = true;
    Sfx.play('clear');
    const cam = this.cameras.main;
    cam.fadeOut(450, 7, 6, 15);
    cam.once('camerafadeoutcomplete', () => {
      this.stageIdx++;
      const p = this.player;
      p.stageBonus *= 1.15;
      for (const m of p.members) {
        const k = m.alive ? m.hp / m.maxhp : 0;
        m.maxhp = p.maxHpOf(m);   // 스테이지 보너스 × 진화 단계
        m.hp = m.alive ? Math.min(m.maxhp, Math.round(m.maxhp * Math.min(1, k + .3))) : Math.round(m.maxhp * .4);
        m.alive = true;
      }
      this.buildWorld();
      if (p.sprite) p.sprite.setAlpha(1);   // 포털에 빨려 들어가며 사라졌던 모습
      cam.fadeIn(450, 7, 6, 15);
      this.transitioning = false;
      this.events.emit('banner', `${this.stage.region} 도착!`, `${STAGES[this.stageIdx].areas[0].name} — 새로운 여정이 시작된다`);
    });
  }

  // ---------------- 테스트룸 (game/TestRoom.js · 패널은 UIScene.showTest) ----------------
  // 시작: Z크리스탈 · 메가스톤 · 폼체인지 아이템을 모두 쥐고 패널을 연다
  testBegin() {
    const p = this.player;
    p.grantAll();   // 테스트룸: 키스톤 · Z링 · 파티 모두의 메가스톤 · Z크리스탈
    for (const id of Object.keys(FORM_ITEMS)) p.formItems.add(id);
    this.time.delayedCall(450, () => { if (!this.overlay && !this.over) this.toggleOverlay('test'); });
  }
  // 매 프레임: 쿨타임 없음 · 샌드백 피해 기록 (최근 5초 · 2초 동안 안 맞으면 체력이 다시 찬다)
  //  이어 나오는 보스를 골라 워프했으면(펄기아 · 레시라무 · 아비스 네크로즈마): 앞 보스는 등장 연출이 끝나면 바로 정화 → 실제 전환 연출로 고른 보스
  testUpdate() {
    const p = this.player, now = this.time.now, d = this.dummy, sk = this.testSkipTo, b = this.boss;
    if (sk && b && b.alive && b.bossKey !== sk && b.state !== 'intro') { b.hp = 0; this.killEnemy(b); }
    else if (sk && b && b.bossKey === sk) this.testSkipTo = null;
    if (this.testNoCd) { for (const m of p.members) { m.cd.z = 0; m.cd.x = 0; m.cd.c = 0; } p.z.cd = 0; }
    if (!d) return;
    if (d.hp < d.lastHp) { d.log.push([now, d.lastHp - d.hp]); d.hitAt = now; }
    if (d.hp < d.maxhp && now - (d.hitAt || 0) > 2000) d.hp = d.maxhp;
    d.lastHp = d.hp;
    while (d.log.length && now - d.log[0][0] > 5000) d.log.shift();
  }
  // 오른쪽 위 HUD 한 줄: 샌드백 피해 · 켜 둔 옵션
  testInfo() {
    const d = this.dummy, opts = [this.testGod && '무적', this.testNoCd && '쿨타임 없음'].filter(Boolean).join(' · ');
    if (!d) return opts ? `${this.testReal ? '실제 맵 워프' : '테스트룸'} · ${opts}` : this.testReal ? '실제 맵 워프 · T 패널 · F1 카드' : '테스트룸 · T 패널 · F1 카드';
    const sum = d.log.reduce((s, l) => s + l[1], 0), span = d.log.length ? Math.max(1, (this.time.now - d.log[0][0]) / 1000) : 1;
    return `샌드백 5초 피해 ${sum} · 초당 ${Math.round(sum / span)}${opts ? ' · ' + opts : ''}`;
  }
  // 파티 i번 자리를 key 포켓몬의 그 모습으로 (이미 파티에 있으면 그 자리를) → 바로 출전
  testForm(i, key, tier, mega = -1) {
    const p = this.player;
    if (!SPECIES[key] || this.transitioning) return;
    let j = p.members.findIndex(m => m.key === key);
    if (j < 0) { p.replaceMember(Math.min(i, p.members.length), key); j = p.members.findIndex(m => m.key === key); }
    const m = p.members[j];
    p.setForm(m, tier, mega);
    p.grantAll();
    if (j !== p.idx) p.swapTo(j, true);
    p.flash(300); p.squash(.6, 1.5);   // 진화처럼 하얗게 빛나며 새 모습으로
    this.fx.ring(p.x, p.y, 34, 0xffffff, 380);
    this.fx.burst(p.x, p.y, [0xffffff, 0xbfe6ff, 0xfff6c0], 26, 160, { glow: true, up: 70 });
    Sfx.play(mega >= 0 ? 'mega' : 'evolve');
    this.events.emit('banner', p.formName(m), `${TIERS[p.tierOf(m)].name} · ${['z', 'x', 'c'].map(sl => `${sl.toUpperCase()} ${SKILLS[m.skills[sl]].name}`).join(' · ')}`);
  }
  // 테스트룸 허브 아레나에서 보스 소환 (실제 보스방이 없는 보스 — 레드의 피카츄 · 리자몽): 그 보스가 원래 싸우는 지방의 타일 · 배경 · 아레나 크기로 허브를 다시 깐다
  testBoss(key, chain = false) {
    if (this.transitioning || !BOSSES[key]) return;
    const home = bossHome(key), o = this.testOpt, wasReal = this.testReal;
    const rebuild = wasReal || o.ci !== home.ci || o.ai !== home.ai || o.arena !== home.arena || o.tall !== home.tall;
    this.testReal = false; this.testSkipTo = null;
    this.testOpt = home; this.testChain = chain;
    this.testReset(rebuild, () => {
      const room = this.level.rooms[0];
      room.boss = key;
      if (this.altar) { this.altar.destroy(); this.altar = null; }
      room.altarGated = false;
      if (key === 'ho-oh') { this.testAltar(room); return; }   // 🌈 칠색조: 구슬 셋을 들고 제단 앞에서 (F 로 봉헌 연출부터)
      this.time.delayedCall(350, () => { if (!this.over && !this.arenaRoom) this.startBoss(room); });
    });
  }
  // 테스트룸 칠색조: 성수의 구슬 3개(🔴 🟡 🔵)를 지급하고 제단 앞에 세운다 — F 만 누르면 봉헌 · 강림 연출을 바로 검수
  testAltar(room) {
    if (!this.altar || this.altar.room !== room) { if (this.altar) this.altar.destroy(); this.altar = new HoohAltar(this, room); }
    room.entered = false; room.cleared = false;
    this.altar.reset(false);
    this.player.orbs = Object.fromEntries(ORB_KEYS.map(k => [k, true]));
    const x = this.altar.x - 30;
    this.teleport({ x, y: (this.testFloor ? this.testFloor(x, room) : this.floorAt(x, room)) - 14 });
    this.events.emit('toast', '🧪 테스트룸: 성수의 구슬 3개(🔴 🟡 🔵) 지급 — 제단 앞에서 F / ↑ 로 봉헌하면 칠색조가 강림한다');
  }
  // ---------------- 테스트 모드: 실제 보스방 · 랜드마크로 워프 ----------------
  // 실제 보스방이 있는 보스면 { ci, arena: 그 방의 보스, skip: 이어 나오는 보스를 골랐으면 그 보스 } · 없으면 null
  testBossTarget(key) {
    const home = bossHome(key), a = home.arena;
    if (!a || !BOSSES[a]) return null;
    const line = [...(BOSSES[a].prelude || []), a];
    for (let q = a; BOSSES[q].then; q = BOSSES[q].then) line.push(BOSSES[q].then);
    if (BOSSES[a].pair) line.push(BOSSES[a].pair);
    if (!line.includes(key)) return null;
    return { ci: home.ci, arena: a, skip: key !== a && key !== BOSSES[a].pair ? key : null };
  }
  // 👑 보스를 골랐을 때: 그 보스가 실제로 나오는 지방 맵의 보스방으로 워프 (들어서면 실제처럼 등장 연출 → 전투 → 정화) · 실제 보스방이 없으면 허브 아레나
  testWarpBoss(key) {
    if (!BOSSES[key] || this.transitioning) return;
    const t = this.testBossTarget(key), def = BOSSES[key];
    if (!t) { this.testBoss(key); this.events.emit('toast', `${def.name}은(는) 실제 보스방이 없어 테스트룸 허브 아레나에서 싸운다`); return; }
    const arena = BOSSES[t.arena];
    this.testLast = () => this.testWarpBoss(key);
    this.testWarp(t.ci, lv => {
      const r = lv.rooms.find(q => q.boss === t.arena && (q.type === 'boss' || q.type === 'mini' || q.type === 'sanctuary'));
      if (r && this.altar && this.altar.room === r) return { room: r, x: this.altar.x - 30 };   // 칠색조: 제단 앞
      return r ? { room: r, x: r.portalFrom ? r.left + 56 : r.left + 40 } : null;   // 출입문으로 들어오는 결전장(시초의 방 · 블랙나이트의 심장)은 출입문 앞 — 한가운데로 걸어가야 강림
    }, `🗺️ ${STAGES[t.ci].short} · ${arena.name}의 보스방${t.skip ? ` — ${arena.name}은(는) 등장 연출 뒤 바로 정화되고 ${def.name}(으)로 이어진다` : ''}`, r => {
      this.testSkipTo = t.skip;
      if (r && this.altar && this.altar.room === r) this.testAltar(r);   // 🌈 칠색조: 구슬 셋 지급 · 제단 앞
    });
  }
  // 🗺️ 랜드마크 입구 & 길목: i 번째 랜드마크의 진입로(part 'path') 또는 정문 앞(part 'gate')
  testWarpLandmark(i, part = 'gate') {
    const L = TEST_LANDMARKS[i], ci = L ? landmarkCi(L) : -1;
    if (ci < 0) return;
    this.testLast = () => this.testWarpLandmark(i, part);
    this.testWarp(ci, lv => L[part](lv), `🗺️ ${STAGES[ci].short} · ${L.name} — ${part === 'path' ? '진입로 길목' : '정문 앞 (F / ↑ 로 들어가 포털 확인)'}`);
  }
  // 실제 지방 맵(시드 고정)을 깔고 pick(level) → { room, x } 자리로. 하던 보스전 · 샌드백은 치우고 파티 회복
  //  보스방이면 다시 싸울 수 있게 처음 상태로 (cleared · entered · 관문 · 결정 속 레드) — 들어서는 순간 실제처럼 등장 연출부터
  testWarp(ci, pick, msg, after) {
    if (this.transitioning || this.over) return;
    if (this.overlay) { this.overlay = null; this.setFrozen(false); this.events.emit('overlay', null); }
    this.transitioning = true;
    const cam = this.cameras.main;
    cam.fadeOut(260, 7, 6, 15);
    cam.once('camerafadeoutcomplete', () => {
      this.testClearFight();
      const same = this.testReal && this.stageIdx === ci;
      this.testReal = true; this.testSkipTo = null; this.stageIdx = ci;
      if (!same) this.buildWorld();
      const t = pick(this.level), r = t && t.room;
      if (r) {
        if (r.type === 'boss' || r.type === 'mini' || r.type === 'sanctuary') {
          r.cleared = false; r.entered = false; this.setGates(r, true);
          const core = this.props && this.props.redCore;
          if (r.plantHeart && core && core.broken) this.props.buildRedCore(r);
        }
        const x = Phaser.Math.Clamp(t.x, r.left + 16, r.right - 16);
        this.teleport({ x, y: this.testFloor(x, r) - 14 });
      } else this.teleport(this.level.start);
      Music.play(this.areaBgm());
      cam.fadeIn(320, 7, 6, 15);
      this.transitioning = false;
      if (msg) this.events.emit('toast', r ? msg : '그 자리를 찾지 못해 지방 입구로 왔다');
      if (after) after(r);
    });
  }
  // 워프 자리의 발 디딜 곳: 방 바닥에서 위로 — 가장 낮은 땅(언덕 위 포함 · 머리 위 두 칸이 빈 곳). 높은 발판 위가 아니라 길 위에 선다
  testFloor(x, r) {
    const lv = this.level, tx = Math.floor(x / TILE), free = ty => lv.grid[ty] && lv.grid[ty][tx] === '.';
    for (let ty = r.F; ty > r.ty0 + 1; ty--) if (lv.grid[ty] && lv.grid[ty][tx] !== '.' && free(ty - 1) && free(ty - 2)) return ty * TILE;
    return this.groundBelow(x, r.top + 8);
  }
  // 🏠 테스트룸 허브로 (실제 맵을 떠나 빈 아레나 허브 — 마지막에 깐 허브 아레나 그대로)
  testHub() {
    if (this.transitioning) return;
    this.testReal = false; this.testSkipTo = null;
    this.testReset(true, () => this.events.emit('toast', '🏠 테스트룸 허브'));
  }
  // 하던 보스전 · 샌드백 · 이야기 연출을 모두 치운다 (워프 · 허브 · 다시 깔기 공용)
  testClearFight() {
    this.resetArenaFight();
    this.arenaRun = (this.arenaRun || 0) + 1;
    if (this.trainer) { this.trainer.destroy(); this.trainer = null; }
    for (const e of this.enemies) { (e.colliders || []).forEach(c => c.destroy()); e.destroy(); }
    for (const e of this.restingBosses || []) for (const o of e.auraImgs || []) o.destroy();   // 정화돼 머물던 보스의 태고의 기운
    this.enemies = []; this.restingBosses = []; this.dummy = null; this.boss = null; this.bosses = []; this.chain = null;
    this.endOverdrive(); this.cinema = false; this.storyWait = false;
    if (this.player && this.player.inv > 100) this.player.inv = 0;
    this.combat.clearAll();
    this.events.emit('clearTitles');
    this.testHeal(true);
  }
  // ❤️ 체력 · 상처약 · 쿨타임 즉시 완충
  testFull() {
    const p = this.player;
    this.testHeal(true);
    p.uses = p.uses || {}; p.uses.potion = p.potionMax; p.potionCd = 0;
    for (const m of p.members) for (const k in m.cd) m.cd[k] = 0;
    p.z.cd = 0; p.dashCd = 0; p.swapCd = 0; p.parryCd = 0; p.diveCd = 0;
    this.fx.ring(p.x, p.y, 34, 0x5aff8a, 380); this.fx.glow(p.x, p.y, 34, 0x5aff8a, 400, .8);
    Sfx.play('heal');
  }
  // 🔄 적용된 카드 전체 초기화: 파티 모두 기술머신 카드(기술 · 개조 · 스킬 강화 · 특성 · 숙련) 효과를 지우고 지금 모습의 기본 기술로
  testResetCards() {
    const p = this.player;
    for (const m of p.members) {
      const tier = m.tier, mega = m.mega ? (m.megaPick || 0) : -1;
      m.cardGrade = {}; m.cardLv = {}; m.boostCards = []; m.boost = {}; m.ups = new Set(); m.perks = {}; m.atkBonus = 1; m.cdBonus = 1;
      p.setForm(m, tier, mega);
      p.refreshMods(m);
      m.hp = Math.min(m.hp, m.maxhp);
    }
    p.grantAll();
    this.fx.ring(p.x, p.y, 34, 0x9ad8ff, 380);
    Sfx.play('select');
  }
  // ⚡ 테스트룸: 지금 보스(싸우는 중이면 그 보스 · 아니면 워프해 온 보스방 · 고른 보스)의 지방 기대 카드 스펙을 자동 장착 (data/balance.js applyGearPreset)
  //  지금 카드는 모두 지운 뒤 · 유대의 불꽃도 그 시점 단계로 · 파티 회복
  testPresetTarget() {
    const live = (this.bosses || []).find(b => b.alive);
    const key = live ? live.bossKey : (this.testOpt && this.testOpt.arena) || (this.scene.get('UI') || {}).testBossKey || null;
    const ci = key ? bossSpec(key).ci : this.testReal ? this.stageIdx : (this.testOpt ? this.testOpt.ci : this.stageIdx);
    return { key, ci, rec: key ? recommendedCardScore(key) : specOf(ci).score };
  }
  testGearPreset() {
    const p = this.player;
    if (!p || !this.test) return null;
    const t = this.testPresetTarget();
    this.testResetCards();
    const r = applyGearPreset(p, t.ci, t.rec);
    const keys = [0, 1, 2, 3, HEROES_KEY, 4], bond = specOf(t.ci).bond;
    this.bondStages = new Set(keys.slice(0, bond));   // 그 시점 유대의 불꽃 (정화한 지방 + 용나선탑 흑백 영웅)
    for (const m of p.members) { p.refreshMods(m); m.alive = true; m.hp = m.maxhp; }
    this.testHeal(true);
    this.fx.ring(p.x, p.y, 44, 0xffd25a, 460); this.fx.burst(p.x, p.y, [0xffd25a, 0xffffff, 0x8ad8ff], 22, 150, { glow: true, up: 90 });
    Sfx.play('unlock');
    return Object.assign(r, { key: t.key, bossRec: t.rec, bond: this.bondStage });
  }
  // 🃏 카드 샌드박스: 고른 카드 한 장을 실전과 같은 적용 창(포켓몬 지정 → 기술 자리)으로 — lv: 0 명함 · 1~3 강화 단계 (적용하면 그 단계까지 바로 합성)
  //  쓸 수 있는 포켓몬 제한 없음 (파티 모두)
  testCardSandbox(card, lv = 0) {
    const p = this.player;
    if (!p || this.transitioning) return;
    const c = dressCard(p, Object.assign({}, card, { who: card.who || p.members.map(m => m.key), sandboxLv: lv }));   // 스킬 강화 카드만 그 기술을 단 포켓몬
    this.tmActive = { kind: 'tm', sandbox: true, used: false, member: p.m, cards: [c], flipped: [true], sel: 0 };
    if (this.overlay === 'test') this.toggleOverlay('test');
    this.toggleOverlay('tm');
  }
  // 테스트 패널을 그 탭으로 (열려 있으면 탭만 바꾼다) — F1 · 퀵 디버그 바
  openTestTab(tab) {
    const ui = this.scene.get('UI');
    if (!ui) return;
    if (this.overlay === 'test') { if (ui.testTab !== tab) ui.showTest(tab); return; }
    ui.testTab = tab;
    this.toggleOverlay('test');
  }
  // 하던 보스전 · 샌드백을 치우고 파티를 회복해 입구로 (rebuild 면 방을 다시 깐다)
  testReset(rebuild, done) {
    if (this.transitioning) return;
    if (this.overlay) { this.overlay = null; this.setFrozen(false); this.events.emit('overlay', null); }
    this.transitioning = true;
    const cam = this.cameras.main;
    cam.fadeOut(260, 7, 6, 15);
    cam.once('camerafadeoutcomplete', () => {
      this.testClearFight();
      if (rebuild) { this.worlds = []; this.stageIdx = this.testOpt.ci; this.buildWorld(); }
      else { this.unlockArena(); this.teleport(this.level.start); }
      Music.play(this.stage.bgm);
      cam.fadeIn(320, 7, 6, 15);
      this.transitioning = false;
      if (done) done();
    });
  }
  // 파티 전원 회복 (상태이상 · 뒤틀린 중력까지)
  testHeal(quiet = false) {
    const p = this.player;
    for (const m of p.members) { m.hp = m.maxhp; m.alive = true; }
    p.slowT = 0; p.windT = 0; if (p.flipT > 0) p.flipT = .001; p.buffs = p.buffs.filter(bf => bf.atk >= 1 && bf.speed >= 1 && bf.guard <= 1);
    if (!quiet) { Sfx.play('heal'); this.events.emit('toast', '파티 전원 회복'); }
  }
  // 샌드백: 공격하지도 밀리지도 않는 무속성 과녁 (기술 피해 숫자 · 이펙트 보기). 있으면 치운다 → 놓았으면 true
  testDummy() {
    const d0 = this.dummy;
    if (d0) { d0.alive = false; (d0.colliders || []).forEach(c => c.destroy()); d0.destroy(); this.enemies = this.enemies.filter(e => e !== d0); this.dummy = null; return false; }
    if (this.arenaRoom) { this.events.emit('toast', '보스전 중에는 샌드백을 놓을 수 없다'); return false; }
    const r = this.level.rooms[0], x = r.left + 230, gy = r.bottom;
    const def = { name: '샌드백', types: [], hp: 99999, dmg: 0, speed: 0, ai: 'dummy', atkType: 'normal', kbRes: 1 };
    const e = new Enemy(this, 'machamp', x, gy - 20, { def, cLv: 1 });
    e.clearCorruption(); e.dummy = true;
    e.ai = () => e.b.setVelocityX(0);
    e.log = []; e.lastHp = e.maxhp;
    e.cheatDeath = () => { e.log.push([this.time.now, e.lastHp - e.hp]); e.hitAt = this.time.now; e.hp = e.lastHp = e.maxhp; return true; };   // 쓰러지지 않고 다시 찬다
    e.b.reset(x, gy - e.b.height / 2 - 1);
    this.addEnemy(e, r);
    this.dummy = e;
    this.fx.ring(x, gy - 16, 26, 0xffe08a, 380);
    return true;
  }
  // 보스 체력을 절반 아래로 (2페이즈 · 메가 모습 · 폭주 확인)
  testBossHalf() {
    const bs = (this.bosses || []).filter(b => b.alive);
    if (!bs.length) { this.events.emit('toast', '싸우는 보스가 없다'); return false; }
    for (const b of bs) b.hp = Math.min(b.hp, Math.floor(b.maxhp * .49));
    return true;
  }
  // 보스 정화: 보상 · 포털 · 지방 정화 없이 → 카메라를 풀고 다시 고를 수 있게
  testBossDone(boss) {
    const tr = this.trainer, room = boss.room;
    this.boss = null; this.bosses = []; this.chain = null; this.arenaRoom = null;
    if (this.testReal && room) { room.cleared = true; this.time.delayedCall(700, () => { if (this.level && this.level.rooms.includes(room)) this.setGates(room, true); }); }   // 실제 보스방: 관문이 열린다 (같은 보스방 다시는 디버그 바 · 패널에서 다시 워프)
    if (this.player.flipT > 0) this.player.flipT = .001;
    if (tr && !tr.freed) tr.release(TRAINER_LINES[tr.kind].freed);
    this.events.emit('boss', null);
    this.endOverdrive();
    this.events.emit('banner', `${boss.name} 정화!`, this.testReal ? '테스트 모드 · 디버그 바: 🏠 허브 · 🗺️ 다른 보스방 · 같은 보스방 다시 · 🃏 카드' : `테스트룸 · ${this.touchInput && this.touchInput.on ? '테스트 버튼' : 'T'}로 다른 보스 · 포켓몬을 고른다`);
    this.fx.hitStop(220);
    this.time.delayedCall(700, () => this.unlockArena());
    Music.play(this.stage.bgm);
  }

  // quit: 일시정지 메뉴의 '포기하고 도감으로' (전멸과 달리 판을 끝낸다)
  gameOver(won, quit = false) {
    if (!won && !quit) { this.respawn(); return; }   // 전멸해도 끝이 아니다: 마지막 포켓몬센터에서 다시 일어난다
    if (this.over) return;
    if (this.test) { this.over = true; this.backToLobby('테스트룸에서 나왔어요'); return; }   // 테스트룸은 기록 없이 바로 도감으로
    this.over = true;
    Music.stop();
    Save.recordRun(this.stageIdx + 1, won);
    if (won) RunSave.clear();   // 끝까지 깼으면 이어하기 기록은 지운다
    this.physics.world.pause();
    this.events.emit('gameover', {
      won, stage: this.stageIdx + 1, stageName: this.stage.name, kills: this.runStats.kills, items: this.runStats.items,
      unlocked: this.runStats.unlocked, time: (this.time.now - this.runStats.start) / 1000
    });
  }

  backToLobby(message = '') {
    this.cleanup();
    this.scene.stop('UI');
    this.scene.start('Lobby', message ? { message } : undefined);
  }
}
