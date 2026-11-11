// ⚔️ 대보스전 패링 규칙 — 챕터 메인 대보스에게는 패링(↓ + Z)만으로 빠르게 무너뜨리지 못하게
//  메인 대보스: 지방 최종 보스 아레나(room.type 'boss' — 뮤츠 · 칠색조 · 레쿠쟈 · 디아루가/펄기아 · 아르세우스 · 무한다이노)
//   + 본길 끝 성소의 보스(room.type 'sanctuary' · main — 깨어진 세계의 기라티나)
//   + MAIN_KEYS: 하나 용나선탑의 제크로무 → 레시라무 (맵에선 중간 보스 방이지만 챕터를 대표하는 전설 2연전이라 대보스로 친다)
//   테스트룸에서는 e.mainBoss 로 직접 정한다
//  중간 보스(mini) · 엘리트 · 샛길 히든 전설은 그대로 — 경쾌한 패링 그로기 · 반사 피해
//  그로기: 패링 반사탄 · 근접 카운터 · 충격파 카운터 카드 · 레드의 합동 카운터가 쌓는 그로기 ×MAIN_PARRY_STAG (-45%)
//   (연속 패링 점감 · 찰나의 카운터 · 유대의 불꽃 천공의 반격 보너스를 모두 곱한 뒤에 곱한다 → 보너스도 같은 비율로 낮게)
//  피해: 패링 반사탄 · 근접 카운터 · 충격파 카운터 · 제크로무 낙뢰 · 합동 카운터 · 유대의 추가 타격 피해 ×MAIN_PARRY_DMG (-33%) — Combat.damageEnemy 가 o.parried · o.parryHit 로 가른다
//  → 패링으로 위기를 넘긴 뒤 교체(태그) · 속성 상성 · 기술 연계 · 3단 차징으로 몰아쳐야 대보스가 무너진다
export const MAIN_PARRY_STAG = .55, MAIN_PARRY_DMG = .67;
const MAIN_KEYS = new Set(['zekrom', 'reshiram']);
export const mainBoss = e => !!(e && e.boss && (e.mainBoss ?? (MAIN_KEYS.has(e.bossKey) || (e.room && (e.room.type === 'boss' || (e.room.type === 'sanctuary' && e.room.main))))));
export const parryStagK = e => mainBoss(e) ? MAIN_PARRY_STAG : 1;
export const parryDmgK = e => mainBoss(e) ? MAIN_PARRY_DMG : 1;
