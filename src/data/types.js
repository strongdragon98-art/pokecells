// 타입 이름·색상·상성표
export const TYPES = {
  normal: { name: '노말', color: 0xb8b890 },
  fire: { name: '불꽃', color: 0xff7a2a },
  water: { name: '물', color: 0x4a9cff },
  grass: { name: '풀', color: 0x5ed04a },
  electric: { name: '전기', color: 0xffd230 },
  fighting: { name: '격투', color: 0xd04a3a },
  ghost: { name: '고스트', color: 0x8a5ad8 },
  poison: { name: '독', color: 0xb84ad0 },
  flying: { name: '비행', color: 0x9ab0ff },
  dragon: { name: '드래곤', color: 0x6a4aff },
  psychic: { name: '에스퍼', color: 0xff5a9a },
  rock: { name: '바위', color: 0xc0a050 },
  ground: { name: '땅', color: 0xd8b060 },
  dark: { name: '악', color: 0x6a5446 },
  steel: { name: '강철', color: 0xa8b0c8 },
  bug: { name: '벌레', color: 0xa0c020 },
  ice: { name: '얼음', color: 0x7ad8f0 },
  fairy: { name: '페어리', color: 0xff9ad8 }
};

const CHART = {
  normal: { rock: .5, steel: .5, ghost: 0 },
  fire: { fire: .5, water: .5, grass: 2, bug: 2, rock: .5, steel: 2, dragon: .5, ice: 2 },
  water: { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
  grass: { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
  electric: { water: 2, flying: 2, electric: .5, grass: .5, dragon: .5, ground: 0 },
  fighting: { normal: 2, rock: 2, steel: 2, dark: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, fairy: .5, ghost: 0 },
  ghost: { ghost: 2, psychic: 2, normal: 0, dark: .5 },
  poison: { grass: 2, fairy: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0 },
  flying: { grass: 2, fighting: 2, bug: 2, electric: .5, rock: .5, steel: .5 },
  dragon: { dragon: 2, steel: .5, fairy: 0 },
  dark: { ghost: 2, psychic: 2, fighting: .5, dark: .5, fairy: .5 },
  psychic: { fighting: 2, poison: 2, psychic: .5, steel: .5 },
  // 기술머신으로 배우는 타 속성 기술용
  ice: { grass: 2, ground: 2, flying: 2, dragon: 2, fire: .5, water: .5, ice: .5, steel: .5 },
  fairy: { fighting: 2, dragon: 2, dark: 2, fire: .5, poison: .5, steel: .5 },
  steel: { rock: 2, ice: 2, fairy: 2, fire: .5, water: .5, electric: .5, steel: .5 },
  ground: { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: .5, bug: .5, flying: 0 },
  rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: .5, ground: .5, steel: .5 }
};

// 공격 타입 × 방어 타입들 → 배율. 0배(무효)는 게임 진행을 위해 0.25배로 완화하되 표시는 '별로'로 처리
export function typeMultiplier(atk, defTypes) {
  if (!atk || atk === 'none') return 1;
  const row = CHART[atk] || {};
  let m = 1;
  for (const d of defTypes) if (row[d] !== undefined) m *= row[d];
  return m === 0 ? 0.25 : m;
}

// 배율 → 표시 등급
export function effectiveness(m) {
  if (m >= 2) return 'super';
  if (m < 1) return 'weak';
  return 'normal';
}

export const typeColor = t => (TYPES[t] || TYPES.normal).color;
export const typeName = t => (TYPES[t] || TYPES.normal).name;
export const hex = c => '#' + c.toString(16).padStart(6, '0');
