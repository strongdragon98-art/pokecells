// 타입별 교체 등장 스킬 · Z기술 메타데이터 (독·에스퍼·악·드래곤·강철·바위·땅·얼음·벌레·페어리 / 비행 Z)
// 실제 동작은 game/skills/typeMoves.js 의 TAG_IMPL · ZMOVE_IMPL

export const TAGS = {
  tag_poison: { name: '독가스 분출', type: 'poison', desc: '등장하며 독가스를 뿜어 주변 적을 맹독에 빠뜨린다' },
  tag_psychic: { name: '사이코 충격파', type: 'psychic', desc: '염동력 파동으로 주변 적을 띄우고 혼란시킨다' },
  tag_dark: { name: '기습 그림자', type: 'dark', desc: '그림자에서 튀어나와 주변 적을 베고 저주(받는 피해 +30%)' },
  tag_dragon: { name: '용의 포효', type: 'dragon', desc: '포효로 주변 적을 크게 밀어내고 잠시 기절시킨다' },
  tag_steel: { name: '강철 낙하', type: 'steel', desc: '강철 몸으로 내리꽂혀 주변 적에게 큰 피해' },
  tag_rock: { name: '암석 낙하', type: 'rock', desc: '주변 적 머리 위로 바위를 떨어뜨려 기절시킨다' },
  tag_ground: { name: '지면 융기', type: 'ground', desc: '땅을 솟구치게 해 주변 적을 띄우고 둔화' },
  tag_ice: { name: '냉기 폭발', type: 'ice', desc: '냉기를 터뜨려 주변 적을 둔화 + 잠깐 얼린다' },
  tag_bug: { name: '벌레 떼 습격', type: 'bug', desc: '벌레 떼를 풀어 주변 적을 물어뜯고 둔화' },
  tag_fairy: { name: '요정의 바람', type: 'fairy', desc: '반짝이는 바람으로 주변 적을 저주하고 파티 체력 8% 회복' }
};

export const ZMOVES = {
  supersonic_skystrike: { name: '파이널다이브클래시', type: 'flying', mul: 12, desc: '화면 끝 하늘로 솟구쳤다가 음속으로 내리꽂는다.' },
  shattered_psyche: { name: '맥시멈사이브레이커', type: 'psychic', mul: 12, desc: '염동력 만화경이 화면을 뒤덮어 적을 들어 올렸다 내던진다. 혼란.' },
  black_hole_eclipse: { name: '블랙홀이클립스', type: 'dark', mul: 12, desc: '하늘에 블랙홀을 열어 모든 것을 빨아들인다. 저주.' },
  devastating_drake: { name: '얼티메이트드래곤번', type: 'dragon', mul: 13, desc: '거대한 용의 기운이 화면을 휘감은 뒤 내리꽂힌다. 기절.' },
  corkscrew_crash: { name: '초월나선연격', type: 'steel', mul: 12, desc: '강철 드릴처럼 회전하며 화면을 꿰뚫고 돌진한다.' },
  continental_crush: { name: '월즈엔드폴', type: 'rock', mul: 13, desc: '하늘에서 산만 한 거대 바위를 떨어뜨린다. 기절.' },
  tectonic_rage: { name: '라이징랜드오버', type: 'ground', mul: 12, desc: '땅속으로 파고들어 화면 전체의 지면을 융기시킨다. 둔화.' },
  subzero_slammer: { name: '레이징지오프리즈', type: 'ice', mul: 11, desc: '화면을 얼려 얼음 기둥을 세운 뒤 산산이 부순다. 둔화 + 빙결.' },
  savage_spin_out: { name: '절대포식회전참', type: 'bug', mul: 11, desc: '실로 화면을 옭아매 거대한 고치로 감아 조인다. 속박.' },
  twinkle_tackle: { name: '러블리스타임팩트', type: 'fairy', mul: 11, desc: '별빛 공간으로 끌어들여 반짝이는 몸통박치기. 저주 + 혼란.' }
};
