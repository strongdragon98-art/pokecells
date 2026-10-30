// PlayableRosterRegistry — 플레이어로 쓸 수 있는 모든 진화 라인
//  이 파일은 Phaser 없이 순수 데이터만 담는다 (scripts/fetch-assets.js 도 그대로 읽는다)
//
//  line 필드
//   id      라인 이름 = 첫 모습의 key (SPECIES 의 key, 저장 데이터·파티 편성에 쓴다)
//   cat     'starter' 스타팅 · 'special' 특수 · 'wild' 야생 정화 · 'legend' 전설/보스
//   gen     세대 (스타팅 탭의 세대 필터)
//   forms   진화 모습 [{ key(에셋 이름), name, dex(전국도감), types?(모습별 타입), skills?(모습별 Z/X/C) }]
//   formAt  진화 단계(0 1단 · 1 2단 · 2 3단) → forms 순번. 없으면 [0,1,2] (2단계 라인은 마지막 모습에 오라)
//   formStat 모습별 능력치 배율 { atk, hp, speed } (잉어킹 → 갸라도스 10배)
//   megas   메가진화 [{ key, name, types?, pokeapi(PokeAPI 폼 번호), sc(SpriteCollab 폼 폴더), bond(유대변화) }]
//           비어 있으면 '각성'(오라): 같은 모습으로 몸이 커지고 오라를 두른다
//   skills  Z/X/C 기술 id (표시: data/skills/*.js · 동작: game/skills/*.js)
//   passive 특성: superArmor 경직 무시 · teleport 대시=순간이동 · sandstorm(모습 순번) 모래바람 오라 ·
//           flop 파닥파닥 이동 · big 거대 몸집 · guard 받는 피해 배율 · atkSpeed 행동 속도 · hoverForm 부유 시작 모습
//   unlock  해금 조건 { start } · { kills } 같은 종 정화 · { stage: n } n구역 보스 정화 · { total: n } 누적 정화 · { legend } 전설 보스 정화
//   legend  전설/보스 플레이어블: 히트박스를 일반 최종진화의 1.25배로 맞춘다
// 전설 플레이어블이 합류하는 보스전 (data/pokemon.js 의 BOSSES · data/stages.js 의 지역)
const LEGEND_WHERE = {
  mewtwo: '관동 · 블루시티 동굴의 뮤츠', 'ho-oh': '성도 · 방울탑 꼭대기의 칠색조', raikou: '성도 · 방울탑 하층의 라이코', entei: '성도 · 방울탑 중층의 앤테이',
  suicune: '성도 · 방울탑 상층의 스이쿤', latias: '호연 · 해저동굴의 라티아스 & 라티오스', latios: '호연 · 해저동굴의 라티아스 & 라티오스', rayquaza: '호연 · 하늘기둥의 레쿠쟈',
  garchomp: '신오 · 챔피언로드의 한카리아스', dialga: '신오 · 창기둥의 디아루가', palkia: '신오 · 창기둥의 펄기아', giratina: '신오 · 천관산 히든 성소의 기라티나', darkrai: '신오 · 챔피언로드 히든 성소의 다크라이'
};

const T = (...t) => t;

// 진화 3단계 스타팅 라인 공통 능력치
const STARTER = { hp: 112, atk: 11, speed: 116, jump: 304, jumps: 2 };

export const LINES = [
  // ======================= 1세대 · 관동 =======================
  { id: 'bulbasaur', cat: 'starter', gen: 1, ...STARTER, hp: 125, atk: 9, speed: 108, jump: 300, types: T('grass', 'poison'),
    forms: [{ key: 'bulbasaur', name: '이상해씨', dex: 1 }, { key: 'ivysaur', name: '이상해풀', dex: 2 }, { key: 'venusaur', name: '이상해꽃', dex: 3 }],
    megas: [{ key: 'venusaur-mega', name: '메가이상해꽃', pokeapi: 10033, sc: '0001', sprite: 'venusaur' }],
    skills: { z: 'vine_whip', x: 'razor_leaf', c: 'seed_field' }, desc: '중거리 견제와 회복 장판으로 버티는 운영형.', unlock: { start: true } },
  { id: 'charmander', cat: 'starter', gen: 1, ...STARTER, hp: 108, atk: 11, speed: 118, jump: 305, types: T('fire'),
    forms: [{ key: 'charmander', name: '파이리', dex: 4 }, { key: 'charmeleon', name: '리자드', dex: 5 }, { key: 'charizard', name: '리자몽', dex: 6, types: T('fire', 'flying') }],
    megas: [{ key: 'charizard-mega-x', name: '메가리자몽X', types: T('fire', 'dragon'), pokeapi: 10034, sc: '0001' },
            { key: 'charizard-mega-y', name: '메가리자몽Y', types: T('fire', 'flying'), pokeapi: 10035, sc: '0002' }],
    skills: { z: 'scratch_ember', x: 'flamethrower', c: 'fire_blast' }, desc: '화상을 거는 화염 딜러. 대문자로 하늘에서 불길을 떨어뜨린다.', unlock: { start: true } },
  { id: 'squirtle', cat: 'starter', gen: 1, ...STARTER, hp: 132, atk: 10, speed: 110, jump: 300, types: T('water'),
    forms: [{ key: 'squirtle', name: '꼬부기', dex: 7 }, { key: 'wartortle', name: '어니부기', dex: 8 }, { key: 'blastoise', name: '거북왕', dex: 9 }],
    megas: [{ key: 'blastoise-mega', name: '메가거북왕', pokeapi: 10036, sc: '0001', sprite: 'blastoise' }],
    skills: { z: 'tackle_watergun', x: 'bubblebeam', c: 'rapid_spin' }, desc: '둔화와 넉백, 투사체 방어가 특기인 탱커.', unlock: { start: true } },

  // ======================= 2세대 · 성도 =======================
  { id: 'chikorita', cat: 'starter', gen: 2, ...STARTER, hp: 128, atk: 10, speed: 108, types: T('grass'),
    forms: [{ key: 'chikorita', name: '치코리타', dex: 152 }, { key: 'bayleef', name: '베이리프', dex: 153 }, { key: 'meganium', name: '메가니움', dex: 154 }],
    megas: [{ key: 'meganium-mega', name: '메가메가니움', types: T('grass', 'fairy'), pokeapi: 10282, sc: '0001' }],
    skills: { z: 'magical_leaf', x: 'petal_blizzard', c: 'synthesis' }, desc: '꽃잎 폭풍과 광합성으로 파티를 지탱하는 힐러.', unlock: { start: true } },
  { id: 'cyndaquil', cat: 'starter', gen: 2, ...STARTER, hp: 104, atk: 12, speed: 120, types: T('fire'),
    forms: [{ key: 'cyndaquil', name: '브케인', dex: 155 }, { key: 'quilava', name: '마그케인', dex: 156 }, { key: 'typhlosion', name: '블레이범', dex: 157 }],
    skills: { z: 'flare_jab', x: 'eruption', c: 'flame_wheel' }, desc: '등의 불꽃을 터뜨리는 폭발형 딜러. 체력이 높을수록 분화가 강하다.', unlock: { start: true } },
  { id: 'totodile', cat: 'starter', gen: 2, ...STARTER, hp: 120, atk: 12, speed: 112, types: T('water'),
    forms: [{ key: 'totodile', name: '리아코', dex: 158 }, { key: 'croconaw', name: '엘리게이', dex: 159 }, { key: 'feraligatr', name: '장크로다일', dex: 160 }],
    megas: [{ key: 'feraligatr-mega', name: '메가장크로다일', types: T('water', 'dragon'), pokeapi: 10283, sc: '0001' }],
    skills: { z: 'chomp_combo', x: 'waterfall', c: 'aqua_jet' }, desc: '물어뜯고 솟구치는 근접 물 파이터.', unlock: { start: true } },

  // ======================= 3세대 · 호연 =======================
  { id: 'treecko', cat: 'starter', gen: 3, ...STARTER, hp: 100, atk: 11, speed: 128, jump: 318, types: T('grass'),
    forms: [{ key: 'treecko', name: '나무지기', dex: 252 }, { key: 'grovyle', name: '나무돌이', dex: 253 }, { key: 'sceptile', name: '나무킹', dex: 254 }],
    megas: [{ key: 'sceptile-mega', name: '메가나무킹', types: T('grass', 'dragon'), pokeapi: 10065, sc: '0001' }],
    skills: { z: 'leaf_blade', x: 'bullet_seed', c: 'detect' }, desc: '빠른 칼날 검객. 판별로 공격을 흘리고 되받아친다.', unlock: { start: true } },
  { id: 'torchic', cat: 'starter', gen: 3, ...STARTER, hp: 106, atk: 12, speed: 118, types: T('fire'),
    forms: [{ key: 'torchic', name: '아차모', dex: 255 }, { key: 'combusken', name: '영치코', dex: 256, types: T('fire', 'fighting') }, { key: 'blaziken', name: '번치코', dex: 257, types: T('fire', 'fighting') }],
    megas: [{ key: 'blaziken-mega', name: '메가번치코', types: T('fire', 'fighting'), pokeapi: 10050, sc: '0001' }],
    skills: { z: 'double_kick', x: 'blaze_kick', c: 'sky_uppercut' }, desc: '불꽃 발차기 연계로 띄우고 올려치는 공중 콤보형.', unlock: { start: true } },
  { id: 'mudkip', cat: 'starter', gen: 3, ...STARTER, hp: 134, atk: 11, speed: 104, types: T('water'),
    forms: [{ key: 'mudkip', name: '물짱이', dex: 258 }, { key: 'marshtomp', name: '늪짱이', dex: 259, types: T('water', 'ground') }, { key: 'swampert', name: '대짱이', dex: 260, types: T('water', 'ground') }],
    megas: [{ key: 'swampert-mega', name: '메가대짱이', types: T('water', 'ground'), pokeapi: 10064, sc: '0001' }],
    skills: { z: 'mud_slap', x: 'muddy_water', c: 'earthquake' }, desc: '진흙과 탁류로 시야를 가리고 지진으로 마무리하는 탱커.', unlock: { start: true } },

  // ======================= 4세대 · 신오 =======================
  { id: 'turtwig', cat: 'starter', gen: 4, ...STARTER, hp: 140, atk: 11, speed: 98, types: T('grass'),
    forms: [{ key: 'turtwig', name: '모부기', dex: 387 }, { key: 'grotle', name: '수풀부기', dex: 388 }, { key: 'torterra', name: '토대부기', dex: 389, types: T('grass', 'ground') }],
    skills: { z: 'seed_bomb', x: 'wood_hammer', c: 'earth_power' }, desc: '느리지만 묵직한 대지의 거북. 우드해머로 땅을 뒤흔든다.', unlock: { start: true } },
  { id: 'chimchar', cat: 'starter', gen: 4, ...STARTER, hp: 100, atk: 12, speed: 128, jump: 316, types: T('fire'),
    forms: [{ key: 'chimchar', name: '불꽃숭이', dex: 390 }, { key: 'monferno', name: '파이숭이', dex: 391, types: T('fire', 'fighting') }, { key: 'infernape', name: '초염몽', dex: 392, types: T('fire', 'fighting') }],
    skills: { z: 'fury_swipes', x: 'heat_wave', c: 'close_combat' }, desc: '날렵한 불꽃 무술가. 인파이트 난타가 일품.', unlock: { start: true } },
  { id: 'piplup', cat: 'starter', gen: 4, ...STARTER, hp: 118, atk: 11, speed: 110, types: T('water'),
    forms: [{ key: 'piplup', name: '팽도리', dex: 393 }, { key: 'prinplup', name: '팽태자', dex: 394 }, { key: 'empoleon', name: '엠페르트', dex: 395, types: T('water', 'steel') }],
    skills: { z: 'peck_combo', x: 'flash_cannon', c: 'belly_slide' }, desc: '배치기로 미끄러지며 러스터캐논을 쏘는 황제 펭귄.', unlock: { start: true } },

  // ======================= 5세대 · 하나 =======================
  { id: 'snivy', cat: 'starter', gen: 5, ...STARTER, hp: 108, atk: 11, speed: 124, types: T('grass'),
    forms: [{ key: 'snivy', name: '주리비얀', dex: 495 }, { key: 'servine', name: '샤비', dex: 496 }, { key: 'serperior', name: '샤로다', dex: 497 }],
    skills: { z: 'leaf_tornado', x: 'leaf_storm', c: 'coil' }, desc: '우아한 풀뱀. 똬리틀기로 힘을 쌓아 리프스톰을 쏟아낸다.', unlock: { start: true } },
  { id: 'tepig', cat: 'starter', gen: 5, ...STARTER, hp: 136, atk: 12, speed: 100, types: T('fire'),
    forms: [{ key: 'tepig', name: '뚜꾸리', dex: 498 }, { key: 'pignite', name: '차오꿀', dex: 499, types: T('fire', 'fighting') }, { key: 'emboar', name: '염무왕', dex: 500, types: T('fire', 'fighting') }],
    megas: [{ key: 'emboar-mega', name: '메가염무왕', types: T('fire', 'fighting'), pokeapi: 10286, sc: '0001' }],
    skills: { z: 'arm_thrust', x: 'heat_crash', c: 'rollout' }, desc: '몸무게로 짓누르는 불꽃 레슬러.', unlock: { start: true } },
  { id: 'oshawott', cat: 'starter', gen: 5, ...STARTER, hp: 114, atk: 12, speed: 114, types: T('water'),
    forms: [{ key: 'oshawott', name: '수댕이', dex: 501 }, { key: 'dewott', name: '쌍검자비', dex: 502 }, { key: 'samurott', name: '대검귀', dex: 503 }],
    skills: { z: 'razor_shell', x: 'surf', c: 'aqua_cutter' }, desc: '조개 칼을 휘두르는 물의 무사.', unlock: { start: true } },

  // ======================= 6세대 · 칼로스 =======================
  { id: 'chespin', cat: 'starter', gen: 6, ...STARTER, hp: 140, atk: 11, speed: 104, types: T('grass'),
    forms: [{ key: 'chespin', name: '도치마론', dex: 650 }, { key: 'quilladin', name: '도치보구', dex: 651 }, { key: 'chesnaught', name: '브리가론', dex: 652, types: T('grass', 'fighting') }],
    megas: [{ key: 'chesnaught-mega', name: '메가브리가론', types: T('grass', 'fighting'), pokeapi: 10292, sc: '0001' }],
    skills: { z: 'needle_arm', x: 'spiky_shield', c: 'body_press' }, desc: '가시 방패로 막고 바디프레스로 짓누르는 기사.', unlock: { start: true } },
  { id: 'fennekin', cat: 'starter', gen: 6, ...STARTER, hp: 98, atk: 12, speed: 118, types: T('fire'),
    forms: [{ key: 'fennekin', name: '푸호꼬', dex: 653 }, { key: 'braixen', name: '테르나', dex: 654 }, { key: 'delphox', name: '마폭시', dex: 655, types: T('fire', 'psychic') }],
    megas: [{ key: 'delphox-mega', name: '메가마폭시', types: T('fire', 'psychic'), pokeapi: 10293, sc: '0001' }],
    skills: { z: 'mystical_fire', x: 'fire_spin', c: 'psyshock' }, desc: '지팡이 끝 불꽃으로 마법을 부리는 원거리 마도사.', unlock: { start: true } },
  { id: 'froakie', cat: 'starter', gen: 6, ...STARTER, hp: 100, atk: 12, speed: 132, jump: 322, types: T('water'),
    forms: [{ key: 'froakie', name: '개구마르', dex: 656 }, { key: 'frogadier', name: '개굴반장', dex: 657 }, { key: 'greninja', name: '개굴닌자', dex: 658, types: T('water', 'dark') }],
    megas: [{ key: 'greninja-ash', name: '지우개굴닌자', types: T('water', 'dark'), pokeapi: 10117, sc: '0001', bond: true },
            { key: 'greninja-mega', name: '메가개굴닌자', types: T('water', 'dark'), pokeapi: 10294, sc: '0002' }],
    skills: { z: 'water_shuriken', x: 'dark_pulse', c: 'double_team' }, desc: '물수리검을 던지는 닌자. V 는 유대변화(거대 수리검), ↑+V 는 메가진화.', unlock: { start: true } },

  // ======================= 7세대 · 알로라 =======================
  { id: 'rowlet', cat: 'starter', gen: 7, ...STARTER, hp: 108, atk: 11, speed: 112, jumps: 3, types: T('grass', 'flying'),
    forms: [{ key: 'rowlet', name: '나몰빼미', dex: 722 }, { key: 'dartrix', name: '빼미스로우', dex: 723 }, { key: 'decidueye', name: '모크나이퍼', dex: 724, types: T('grass', 'ghost') }],
    skills: { z: 'leafage', x: 'spirit_shackle', c: 'brave_bird' }, desc: '깃털 화살을 쏘는 저격수. 3단 점프로 높은 곳을 차지한다.', unlock: { start: true } },
  { id: 'litten', cat: 'starter', gen: 7, ...STARTER, hp: 126, atk: 12, speed: 108, types: T('fire'),
    forms: [{ key: 'litten', name: '냐오불', dex: 725 }, { key: 'torracat', name: '냐오히트', dex: 726 }, { key: 'incineroar', name: '어흥염', dex: 727, types: T('fire', 'dark') }],
    skills: { z: 'fire_fang', x: 'darkest_lariat', c: 'flamethrower' }, desc: '화염방사로 몰아붙이고 DD래리어트로 휩쓰는 악역 레슬러.', unlock: { start: true } },
  { id: 'popplio', cat: 'starter', gen: 7, ...STARTER, hp: 112, atk: 11, speed: 110, types: T('water'),
    forms: [{ key: 'popplio', name: '누리공', dex: 728 }, { key: 'brionne', name: '키요공', dex: 729 }, { key: 'primarina', name: '누리레느', dex: 730, types: T('water', 'fairy') }],
    skills: { z: 'bubble_note', x: 'sparkling_aria', c: 'aqua_ring' }, desc: '노래하는 물방울로 싸우는 원거리 아이돌.', unlock: { start: true } },

  // ======================= 8세대 · 가라르 =======================
  { id: 'grookey', cat: 'starter', gen: 8, ...STARTER, hp: 122, atk: 12, speed: 110, types: T('grass'),
    forms: [{ key: 'grookey', name: '흥나숭', dex: 810 }, { key: 'thwackey', name: '채키몽', dex: 811 }, { key: 'rillaboom', name: '고릴타', dex: 812 }],
    skills: { z: 'branch_poke', x: 'drum_beating', c: 'wood_hammer' }, desc: '드럼 비트로 뿌리를 일으키는 리듬 파이터.', unlock: { start: true } },
  { id: 'scorbunny', cat: 'starter', gen: 8, ...STARTER, hp: 100, atk: 12, speed: 132, jump: 326, types: T('fire'),
    forms: [{ key: 'scorbunny', name: '염버니', dex: 813 }, { key: 'raboot', name: '래비풋', dex: 814 }, { key: 'cinderace', name: '에이스번', dex: 815 }],
    skills: { z: 'agile_kick', x: 'pyro_ball', c: 'court_change' }, desc: '불꽃 축구공을 차는 스트라이커. 가장 높이 뛴다.', unlock: { start: true } },
  { id: 'sobble', cat: 'starter', gen: 8, ...STARTER, hp: 96, atk: 12, speed: 120, types: T('water'),
    forms: [{ key: 'sobble', name: '울머기', dex: 816 }, { key: 'drizzile', name: '누겔레온', dex: 817 }, { key: 'inteleon', name: '인텔리레온', dex: 818 }],
    skills: { z: 'pound_water', x: 'snipe_shot', c: 'camouflage' }, desc: '모습을 감추고 저격하는 물의 스파이.', unlock: { start: true } },

  // ======================= 9세대 · 팔데아 =======================
  { id: 'sprigatito', cat: 'starter', gen: 9, ...STARTER, hp: 100, atk: 12, speed: 126, types: T('grass'),
    forms: [{ key: 'sprigatito', name: '나오하', dex: 906 }, { key: 'floragato', name: '나로테', dex: 907 }, { key: 'meowscarada', name: '마스카나', dex: 908, types: T('grass', 'dark') }],
    skills: { z: 'scratch_leaf', x: 'flower_trick', c: 'sucker_punch' }, desc: '꽃 마술로 속이고 기습하는 마술사 고양이.', unlock: { start: true } },
  { id: 'fuecoco', cat: 'starter', gen: 9, ...STARTER, hp: 128, atk: 11, speed: 104, types: T('fire'),
    forms: [{ key: 'fuecoco', name: '뜨아거', dex: 909 }, { key: 'crocalor', name: '악뜨거', dex: 910 }, { key: 'skeledirge', name: '라우드본', dex: 911, types: T('fire', 'ghost') }],
    skills: { z: 'incinerate', x: 'torch_song', c: 'will_o_wisp' }, desc: '노래할수록 뜨거워지는 불꽃 가수.', unlock: { start: true } },
  { id: 'quaxly', cat: 'starter', gen: 9, ...STARTER, hp: 108, atk: 12, speed: 120, types: T('water'),
    forms: [{ key: 'quaxly', name: '꾸왁스', dex: 912 }, { key: 'quaxwell', name: '아꾸왁', dex: 913 }, { key: 'quaquaval', name: '웨이니발', dex: 914, types: T('water', 'fighting') }],
    skills: { z: 'quick_peck', x: 'aqua_step', c: 'drain_punch' }, desc: '물의 스텝을 밟는 댄서. 춤출수록 빨라진다.', unlock: { start: true } },

  // ======================= 특수 포켓몬 =======================
  { id: 'gastly', cat: 'special', gen: 1, hp: 90, atk: 12, speed: 112, jump: 290, jumps: 2, hover: true, types: T('ghost', 'poison'),
    forms: [{ key: 'gastly', name: '고오스', dex: 92 }, { key: 'haunter', name: '고우스트', dex: 93 }, { key: 'gengar', name: '팬텀', dex: 94 }],
    megas: [{ key: 'gengar-mega', name: '메가팬텀', pokeapi: 10038, sc: '0001' }],
    skills: { z: 'lick_shadow', x: 'shadow_ball', c: 'phantom_dash' }, desc: '점프 키를 누르면 떠 있는다. 벽을 통과하는 섀도볼과 저주.', unlock: { kills: true } },
  { id: 'ralts', cat: 'special', gen: 3, hp: 92, atk: 12, speed: 112, jump: 300, jumps: 2, types: T('psychic', 'fairy'),
    forms: [{ key: 'ralts', name: '랄토스', dex: 280 }, { key: 'kirlia', name: '킬리아', dex: 281 }, { key: 'gardevoir', name: '가디안', dex: 282 }],
    megas: [{ key: 'gardevoir-mega', name: '메가가디안', pokeapi: 10051, sc: '0001' }],
    passive: { teleport: true },
    skills: { z: 'confusion_orb', x: 'psychic', c: 'moonblast' }, desc: '에스퍼·페어리 마법사. 대시가 잔상을 남기는 완전 무적 순간이동이다.', unlock: { stage: 1 } },
  { id: 'larvitar', cat: 'special', gen: 2, hp: 150, atk: 12, speed: 96, jump: 292, jumps: 2, types: T('rock', 'ground'),
    forms: [{ key: 'larvitar', name: '애버라스', dex: 246 }, { key: 'pupitar', name: '데기라스', dex: 247 }, { key: 'tyranitar', name: '마기라스', dex: 248, types: T('rock', 'dark') }],
    megas: [{ key: 'tyranitar-mega', name: '메가마기라스', types: T('rock', 'dark'), pokeapi: 10049, sc: '0001' }],
    passive: { superArmor: true, sandstorm: 2, guard: .85 },
    skills: { z: 'rock_smash', x: 'stone_edge', c: 'crunch' }, desc: '중장갑 브루저. 맞아도 경직되지 않고, 마기라스는 모래바람 오라를 두른다.', unlock: { stage: 2 } },
  { id: 'dratini', cat: 'special', gen: 1, hp: 104, atk: 12, speed: 120, jump: 300, jumps: 3, types: T('dragon'),
    forms: [{ key: 'dratini', name: '미뇽', dex: 147 }, { key: 'dragonair', name: '신뇽', dex: 148 }, { key: 'dragonite', name: '망나뇽', dex: 149, types: T('dragon', 'flying') }],
    passive: { hoverForm: 2 },
    megas: [{ key: 'dragonite-mega', name: '메가망나뇽', types: T('dragon', 'flying'), pokeapi: 10281, sc: '0001' }],
    skills: { z: 'dragon_tail', x: 'extreme_speed', c: 'outrage' }, desc: '드래곤 올라운더. 3단 점프, 망나뇽은 체공 비행. 신속과 역린.', unlock: { stage: 3 } },
  { id: 'magikarp', cat: 'special', gen: 1, hp: 120, atk: 13, speed: 112, jump: 300, jumps: 2, types: T('water'),
    forms: [{ key: 'magikarp', name: '잉어킹', dex: 129, skills: { z: 'splash', x: 'bounce', c: 'flail' } },
            { key: 'gyarados', name: '갸라도스', dex: 130, types: T('water', 'flying') }],
    formAt: [0, 0, 1], formStat: [{ atk: .1, hp: .55, speed: .72 }, { atk: 1, hp: 1, speed: 1 }],
    megas: [{ key: 'gyarados-mega', name: '메가갸라도스', types: T('water', 'dark'), pokeapi: 10041, sc: '0001' }],
    passive: { flop: 0 },
    skills: { z: 'aqua_tail', x: 'hydro_pump', c: 'hyper_beam' }, desc: '대기만성. 잉어킹은 튀어오르기·뛰어오르기로 버티다가, 3단 진화 순간 공격력 10배 갸라도스로 각성한다.', unlock: { start: true } },
  { id: 'onix', cat: 'special', gen: 1, hp: 170, atk: 11, speed: 92, jump: 286, jumps: 2, types: T('rock', 'ground'),
    forms: [{ key: 'onix', name: '롱스톤', dex: 95 }, { key: 'steelix', name: '강철톤', dex: 208, types: T('steel', 'ground') }],
    formAt: [0, 1, 1],
    megas: [{ key: 'steelix-mega', name: '메가강철톤', types: T('steel', 'ground'), pokeapi: 10072, sc: '0001' }],
    passive: { big: 1.35, guard: .7 },
    skills: { z: 'iron_tail', x: 'dig', c: 'rock_tomb' }, desc: '거대 탱커. 몸집과 공격 범위가 압도적이고 방어력이 최고. 구멍파기로 땅속을 이동한다.', unlock: { total: 150 } },
  { id: 'scyther', cat: 'special', gen: 1, hp: 100, atk: 12, speed: 140, jump: 312, jumps: 2, types: T('bug', 'flying'),
    forms: [{ key: 'scyther', name: '스라크', dex: 123 }, { key: 'scizor', name: '핫삼', dex: 212, types: T('bug', 'steel') }],
    formAt: [0, 1, 1],
    megas: [{ key: 'scizor-mega', name: '메가핫삼', types: T('bug', 'steel'), pokeapi: 10046, sc: '0001' }],
    passive: { atkSpeed: 1.35 },
    skills: { z: 'bullet_punch', x: 'x_scissor', c: 'air_slash' }, desc: '초고속 암살자. 가장 빠른 이동과 연타, 되돌아오는 에어슬래시.', unlock: { total: 300 } },
  // 한카리아스: 보스로 나오지만 전설은 아니다 → 딥상어동 계열로 4세대에. 신오 챔피언로드의 한카리아스(난천)를 정화하면 합류
  { id: 'gible', cat: 'special', gen: 4, hp: 122, atk: 12, speed: 124, jump: 306, jumps: 2, types: T('dragon', 'ground'),
    forms: [{ key: 'gible', name: '딥상어동', dex: 443 }, { key: 'gabite', name: '한바이트', dex: 444 }, { key: 'garchomp', name: '한카리아스', dex: 445 }],
    megas: [{ key: 'garchomp-mega', name: '메가한카리아스', types: T('dragon', 'ground'), pokeapi: 10058, sc: '0001' },
            { key: 'garchomp-mega-z', name: '메가한카리아스Z', types: T('dragon'), pokeapi: 10309, sc: '0002' }],
    skills: { z: 'dual_chop', x: 'dragon_rush', c: 'sand_tomb' }, desc: '음속의 육지 상어. 모래 속에서 덮쳐든다.', unlock: { boss: 'garchomp' } },

  // ======================= 야생 정화 =======================
  { id: 'pichu', cat: 'wild', gen: 1, hp: 96, atk: 11, speed: 126, jump: 315, jumps: 2, types: T('electric'),
    forms: [{ key: 'pichu', name: '피츄', dex: 172 }, { key: 'pikachu', name: '피카츄', dex: 25 }, { key: 'raichu', name: '라이츄', dex: 26 }],
    megas: [{ key: 'raichu-mega-x', name: '메가라이츄X', types: T('electric'), pokeapi: 10304, sc: '0002' },   // SpriteCollab 0001 은 알로라 라이츄
            { key: 'raichu-mega-y', name: '메가라이츄Y', types: T('electric'), pokeapi: 10305, sc: '0003' }],
    skills: { z: 'thundershock', x: 'thunderbolt', c: 'thunder' }, desc: '원거리 전기 딜러. 마비로 적을 묶는다.', unlock: { kills: true } },
  { id: 'zubat', cat: 'wild', gen: 1, hp: 92, atk: 10, speed: 124, jump: 280, jumps: 3, types: T('poison', 'flying'),
    forms: [{ key: 'zubat', name: '주뱃', dex: 41 }, { key: 'golbat', name: '골뱃', dex: 42 }, { key: 'crobat', name: '크로뱃', dex: 169 }],
    skills: { z: 'leech_life', x: 'supersonic', c: 'wing_dash' }, desc: '3단 점프와 8방향 날개치기로 공중을 지배한다. 흡혈로 회복.', unlock: { kills: true } },
  { id: 'machop', cat: 'wild', gen: 1, hp: 138, atk: 11, speed: 104, jump: 295, jumps: 2, types: T('fighting'),
    forms: [{ key: 'machop', name: '알통몬', dex: 66 }, { key: 'machoke', name: '근육몬', dex: 67 }, { key: 'machamp', name: '괴력몬', dex: 68 }],
    skills: { z: 'karate_chop', x: 'dynamic_punch', c: 'counter' }, desc: '묵직한 격투가. 카운터로 공격을 받아친다.', unlock: { kills: true } },

  // ======================= 정화한 전설 / 보스 =======================
  // 전설 보스(game/LegendBoss · 2단계 작업)를 쓰러뜨려 정화하면 합류한다. 진화는 없고 단계마다 능력치만 오른다
  { id: 'mewtwo', cat: 'legend', legend: true, hp: 150, atk: 15, speed: 124, jump: 312, jumps: 2, hover: true, types: T('psychic'),
    forms: [{ key: 'mewtwo', name: '뮤츠', dex: 150 }], formAt: [0, 0, 0],
    megas: [{ key: 'mewtwo-mega-x', name: '메가뮤츠X', types: T('psychic', 'fighting'), pokeapi: 10043, sc: '0001' },
            { key: 'mewtwo-mega-y', name: '메가뮤츠Y', types: T('psychic'), pokeapi: 10044, sc: '0002' }],
    skills: { z: 'psycho_cut', x: 'psystrike', c: 'future_sight' }, desc: '사이코브레이크로 모든 것을 짓누르는 최강의 유전자 포켓몬.', unlock: { legend: true } },
  { id: 'ho-oh', cat: 'legend', legend: true, hp: 150, atk: 14, speed: 118, jump: 306, jumps: 3, types: T('fire', 'flying'),
    forms: [{ key: 'ho-oh', name: '칠색조', dex: 250 }], formAt: [0, 0, 0],
    skills: { z: 'flame_feather', x: 'sacred_fire', c: 'phoenix_dive' }, desc: '무지개 날개의 불사조. 성스러운불꽃은 꺼지지 않는다.', unlock: { legend: true } },
  { id: 'suicune', cat: 'legend', legend: true, hp: 150, atk: 14, speed: 130, jump: 312, jumps: 2, types: T('water'),
    forms: [{ key: 'suicune', name: '스이쿤', dex: 245 }], formAt: [0, 0, 0],
    skills: { z: 'aurora_beam', x: 'tidal_surf', c: 'mirror_coat' }, desc: '북풍의 화신. 물을 정화하며 반사의 장막을 친다.', unlock: { legend: true } },
  { id: 'entei', cat: 'legend', legend: true, hp: 160, atk: 15, speed: 122, jump: 306, jumps: 2, types: T('fire'),
    forms: [{ key: 'entei', name: '엔테이', dex: 244 }], formAt: [0, 0, 0],
    skills: { z: 'lava_plume', x: 'fire_blast', c: 'flare_stomp' }, desc: '화산의 화신. 대문자와 발구름으로 땅을 불바다로 만든다.', unlock: { legend: true } },
  { id: 'raikou', cat: 'legend', legend: true, hp: 145, atk: 15, speed: 136, jump: 312, jumps: 2, types: T('electric'),
    forms: [{ key: 'raikou', name: '라이코', dex: 243 }], formAt: [0, 0, 0],
    skills: { z: 'thunder_fang', x: 'thunder', c: 'thunderbolt' }, desc: '번개의 화신. 하늘을 가르는 낙뢰를 부른다.', unlock: { legend: true } },
  { id: 'rayquaza', cat: 'legend', legend: true, hp: 155, atk: 16, speed: 128, jump: 312, jumps: 3, hover: true, types: T('dragon', 'flying'),
    forms: [{ key: 'rayquaza', name: '레쿠쟈', dex: 384 }], formAt: [0, 0, 0],
    megas: [{ key: 'rayquaza-mega', name: '메가레쿠쟈', types: T('dragon', 'flying'), pokeapi: 10079, sc: '0001' }],
    skills: { z: 'dragon_claw', x: 'dragon_ascent', c: 'draco_meteor' }, desc: '하늘의 지배자. 화룡점정으로 하늘에서 내리꽂힌다.', unlock: { legend: true } },
  { id: 'latias', cat: 'legend', legend: true, hp: 140, atk: 13, speed: 134, jump: 310, jumps: 3, hover: true, types: T('dragon', 'psychic'),
    forms: [{ key: 'latias', name: '라티아스', dex: 380 }], formAt: [0, 0, 0],
    megas: [{ key: 'latias-mega', name: '메가라티아스', types: T('dragon', 'psychic'), pokeapi: 10062, sc: '0001' }],
    skills: { z: 'mist_ball', x: 'heal_pulse', c: 'glide_dash' }, desc: '마음을 읽는 꿈의 포켓몬. 치유파동으로 파티를 돌본다.', unlock: { legend: true } },
  { id: 'latios', cat: 'legend', legend: true, hp: 145, atk: 15, speed: 134, jump: 310, jumps: 3, hover: true, types: T('dragon', 'psychic'),
    forms: [{ key: 'latios', name: '라티오스', dex: 381 }], formAt: [0, 0, 0],
    megas: [{ key: 'latios-mega', name: '메가라티오스', types: T('dragon', 'psychic'), pokeapi: 10063, sc: '0001' }],
    skills: { z: 'luster_purge', x: 'dragon_pulse', c: 'aerial_dive' }, desc: '빛을 굴절시키는 꿈의 포켓몬. 라스트버지와 용의파동.', unlock: { legend: true } },
  { id: 'dialga', cat: 'legend', legend: true, hp: 170, atk: 16, speed: 112, jump: 300, jumps: 2, types: T('steel', 'dragon'),
    forms: [{ key: 'dialga', name: '디아루가', dex: 483 }], formAt: [0, 0, 0],
    megas: [{ key: 'dialga-origin', name: '디아루가 오리진폼', types: T('steel', 'dragon'), pokeapi: 10245, sc: '0001', item: 'adamant' }],
    skills: { z: 'metal_claw', x: 'roar_of_time', c: 'chrono_stop' }, desc: '시간을 다스리는 신. 시간의포효로 세계를 뒤틀고 시간을 멈춘다.', unlock: { legend: true } },
  { id: 'palkia', cat: 'legend', legend: true, hp: 165, atk: 16, speed: 118, jump: 304, jumps: 2, types: T('water', 'dragon'),
    forms: [{ key: 'palkia', name: '펄기아', dex: 484 }], formAt: [0, 0, 0],
    megas: [{ key: 'palkia-origin', name: '펄기아 오리진폼', types: T('water', 'dragon'), pokeapi: 10246, sc: '0001', item: 'lustrous' }],
    skills: { z: 'aqua_blade', x: 'spacial_rend', c: 'warp_rift' }, desc: '공간을 다스리는 신. 공간절단으로 모든 것을 가른다.', unlock: { legend: true } },
  { id: 'giratina', cat: 'legend', legend: true, hp: 175, atk: 15, speed: 116, jump: 300, jumps: 2, hover: true, types: T('ghost', 'dragon'),
    forms: [{ key: 'giratina', name: '기라티나', dex: 487 }], formAt: [0, 0, 0],
    megas: [{ key: 'giratina-origin', name: '기라티나 오리진폼', types: T('ghost', 'dragon'), pokeapi: 10007, sc: '0001', item: 'griseous' }],
    skills: { z: 'shadow_claw', x: 'shadow_force', c: 'distortion' }, desc: '반전세계의 주인. 섀도다이브로 사라졌다 덮친다.', unlock: { legend: true } },
  { id: 'darkrai', cat: 'legend', legend: true, hp: 140, atk: 15, speed: 126, jump: 310, jumps: 2, hover: true, types: T('dark'),
    forms: [{ key: 'darkrai', name: '다크라이', dex: 491 }], formAt: [0, 0, 0],
    megas: [{ key: 'darkrai-mega', name: '메가다크라이', types: T('dark'), pokeapi: 10312, sc: '0002' }],   // SpriteCollab 0001 은 컷신용
    skills: { z: 'dark_pulse', x: 'dark_void', c: 'nightmare' }, desc: '악몽을 부르는 칠흑의 포켓몬. 다크홀로 적을 잠재운다.', unlock: { legend: true } }
];

export const LINE = Object.fromEntries(LINES.map(l => [l.id, l]));
// 보관함 탭: 스타팅·특수·야생 정화 포켓몬은 구분 없이 세대별로, 전설만 따로
export const CATS = [
  { id: 'pokemon', label: '세대별 포켓몬', icon: '🌱', cats: ['starter', 'special', 'wild'] },
  { id: 'legend', label: '정화한 전설/보스', icon: '👑', cats: ['legend'] }
];

// 폼체인지 아이템: 그 전설 보스(BOSSES 의 key)를 정화하면 떨어뜨린다 · 그 판 동안 파티 공용
export const FORM_ITEMS = {
  adamant: { name: '큰금강옥', boss: 'dialga', color: 0x6ab0ff },
  lustrous: { name: '큰백옥', boss: 'palkia', color: 0xd88aff },
  griseous: { name: '큰백금옥', boss: 'giratina', color: 0xffd860 }
};

// 대표 타입 → 교체 등장 스킬 · Z기술
export const TAG_BY_TYPE = {
  normal: 'tag_normal', fire: 'tag_fire', water: 'tag_water', grass: 'tag_grass', electric: 'tag_electric', flying: 'tag_flying', fighting: 'tag_fighting', ghost: 'tag_ghost',
  poison: 'tag_poison', psychic: 'tag_psychic', dark: 'tag_dark', dragon: 'tag_dragon', steel: 'tag_steel', rock: 'tag_rock', ground: 'tag_ground', ice: 'tag_ice', bug: 'tag_bug', fairy: 'tag_fairy'
};
export const ZMOVE_BY_TYPE = {
  grass: 'bloom_doom', fire: 'inferno_overdrive', water: 'hydro_vortex', normal: 'breakneck_blitz', electric: 'catastropika', poison: 'acid_downpour', fighting: 'all_out_pummeling', ghost: 'never_ending_nightmare',
  flying: 'supersonic_skystrike', psychic: 'shattered_psyche', dark: 'black_hole_eclipse', dragon: 'devastating_drake', steel: 'corkscrew_crash', rock: 'continental_crush', ground: 'tectonic_rage', ice: 'subzero_slammer', bug: 'savage_spin_out', fairy: 'twinkle_tackle'
};
// 기존 라인은 원래 쓰던 교체 스킬 유지 (주뱃 = 비행)
const TAG_OVERRIDE = { zubat: 'tag_flying' };

// 해금 조건 문구
export function unlockHint(l) {
  const u = l.unlock || {};
  if (u.start) return '처음부터 함께';
  if (u.kills) return '같은 종을 정화해 도감 등록';
  if (u.stage) return `${['관동', '성도', '호연', '신오', '하나'][u.stage - 1]}지방 최종 보스를 정화하면 합류`;
  if (u.total) return `야생 포켓몬을 누적 ${u.total}마리 정화하면 합류`;
  if (u.legend) return `전설 보스 · ${LEGEND_WHERE[l.id] || '어딘가의 전설'}을(를) 정화하면 합류`;
  if (u.boss) return `보스 · ${LEGEND_WHERE[u.boss] || u.boss}을(를) 정화하면 합류`;
  return '';
}

// 라인 → 게임이 쓰는 SPECIES 항목 (game/Player.js · LobbyScene)
export function toSpecies(l) {
  const first = l.forms[0], last = l.forms[l.forms.length - 1];
  const formAt = l.formAt || (l.forms.length >= 3 ? [0, 1, 2] : [0, 1, 1]);
  const evo = formAt.map((fi, ti) => {
    const f = l.forms[fi];
    return { key: f.key, name: f.name, dex: f.dex, fi, types: f.types || l.types, skills: f.skills || null, stat: (l.formStat || [])[fi] || null,
      aura: ti > 0 && fi === formAt[ti - 1] && fi === l.forms.length - 1 && !l.legend };   // 더 진화할 모습이 없으면 오라로 대신
  });
  // item: 폼체인지 (오리진폼) — 메가스톤 대신 그 전설의 아이템(FORM_ITEMS)으로 발동
  const megas = (l.megas || []).map(m => ({ name: m.name, key: m.key, sprite: m.sprite || m.key, portrait: m.key, types: m.types || last.types || l.types, bond: !!m.bond, item: m.item || null, scale: 1 }));
  const mega = megas[0] || { name: `각성 ${last.name}`, sprite: null, portrait: null, types: last.types || l.types, scale: 1.1, awaken: true };
  const ptype = l.types[0];
  return {
    id: l.id, cat: l.cat, gen: l.gen || 0, legend: !!l.legend,
    name: first.name, dex: first.dex, types: l.types, hp: l.hp, atk: l.atk, speed: l.speed, jump: l.jump ?? 304, jumps: l.jumps ?? 2, hover: !!l.hover,
    desc: l.desc, skills: l.skills, tag: TAG_OVERRIDE[l.id] || TAG_BY_TYPE[ptype], zmove: ZMOVE_BY_TYPE[ptype],
    evo, mega, megas, passive: l.passive || {}, reach: (l.passive && l.passive.big) || 1, unlock: l.unlock || {}
  };
}

// 에셋 받기 목록: 모든 모습 + 메가 (scripts/fetch-assets.js)
export function assetTargets() {
  const out = [];
  for (const l of LINES) {
    for (const f of l.forms) out.push({ key: f.key, dex: String(f.dex).padStart(4, '0'), role: l.cat });
    for (const m of l.megas || []) out.push({ key: m.key, dex: String(l.forms[l.forms.length - 1].dex).padStart(4, '0'), form: m.sc, pokeapi: m.pokeapi, role: '메가' });
  }
  return out;
}
