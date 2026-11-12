// 🧬 다중 메가 폼 (X · Y · 유대변화 · Z): 같은 포켓몬이 메가(특수) 폼을 둘 이상 가질 때, 폼마다 다른 전투 스타일 · 기술 세트 · 필살기
//  메가진화(V)를 처음 할 때 · 포켓몬센터 [🧬 메가 폼 변경] · 테스트룸 모습 고르기에서 『메가진화 폼 선택』 창(scenes/MegaPicker.js)으로 고른다
//  키: data/roster.js 의 megas[].key (리자몽 · 뮤츠 · 라이츄 · 개굴닌자 · 한카리아스 — megas 가 2개 이상인 계열 전부)
//   badge   카드 머리 이모지 · role 한 줄 정체성 · summary 핵심 특성 · 스탯 변화 요약 (style 수치와 같게)
//   aura    전용 메가 오라 색 (인게임 메가 심볼 · 미리보기) · pose 미리보기에 마우스를 올리면 한 번 취하는 공격 모션
//   skills  이 폼의 Z · X · C 기본 기술 — 메가진화하면 그 자리의 기본 기술을 이것으로 바꾼다 (기술머신으로 바꿔 단 자리는 그대로 · 메가가 풀리면 되돌린다)
//   tags    기술 초상화 상세 창의 공격 형태 (z · x · c · r)
//   pow     실측 위력: 테스트룸에서 이 폼 메가 상태(카드 · 아이템 없음)로 샌드백 옆에서 한 번 쓴 뒤 2.5초 동안의 총 피해 ÷ 공격력 (%)
//           Z 는 3타 콤보 합계 · 화상 같은 지속 피해 · 폼 스타일 보정 포함 · 2회 평균을 10 단위로
//           R 은 MEGA_ULT 설계값(범위 전체에 나눠 주는 합계 700%) + r1: 붙어 있는 대상 1마리에게 실제로 들어간 양 (낙뢰 · 칼날이 앞쪽 여러 칸에 흩어져 일부만 맞는다)
//   stag    그로기 유발 (약점 속성으로 맞힐 때만 쌓인다 — Boss.addStagger 는 한 대마다 준 피해에 비례 · 최소 0.8): 위 실측의 한 대씩 피해로
//           어려움 뮤츠(체력 2588)에 쌓이는 양을 더해 높음(14 이상) · 보통(7 이상) · 낮음
//   style   전투 스타일 보정 — dmg { z · x · c · chg(차징 샷) · dive(내려찍기) } 그 행동의 공격력 배율 · speed 이동 · jumps 공중 점프 + · guard 받는 피해 배율
//   ult     R 메가 필살기 (game/Spectacle.js MEGA_ULT 형식) — 없으면 계열 공통
const MELEE = { dmg: { z: 1.35, x: 1.15, c: 1.15, dive: 1.2 }, guard: .9 };
const RANGED = { dmg: { z: 1.15, x: 1.15, c: 1.15, chg: 1.35 }, speed: 1.06, jumps: 1 };

export const MEGA_FORMS = {
  // ---------------- 리자몽 ----------------
  'charizard-mega-x': {
    badge: '🔥🐉', role: '근접 · 푸른 화염 특화', summary: '근접 평타 +35% · 기술 +15% · 받는 피해 -10% · 푸른 화염 오라',
    aura: 0x4aa8ff, pose: 'Strike', style: MELEE,
    skills: { z: 'scratch_ember', x: 'dragon_claw', c: 'flare_blitz' },
    tags: { z: '근접 할퀴기 · 3타 청염탄', x: '근접 X자 베기', c: '화염 돌진', r: '참격 난무 + 분화' },
    pow: { z: 2160, x: 340, c: 410, r: 700, r1: 230 }, stag: { z: '높음', x: '낮음', c: '보통', r: '보통' },
    ult: { name: '블라스트번 : 청염 용격', type: 'fire', seq: [['blades', { n: 8 }], ['eruption', { n: 6 }]] }
  },
  'charizard-mega-y': {
    badge: '🔥🦅', role: '원거리 · 열풍 · 솔라빔 특화', summary: '차징 샷 +35% · 평타 · 기술 +15% · 공중 점프 +1 · 이동 +6%',
    aura: 0xffa040, pose: 'Shoot', style: RANGED,
    skills: { z: 'flame_feather', x: 'heat_wave', c: 'solar_beam' },
    tags: { z: '원거리 깃털 연사 · 3타 부채꼴', x: '원거리 부채꼴 5갈래', c: '관통 광선', r: '광선 + 유성' },
    pow: { z: 1540, x: 730, c: 820, r: 700, r1: 530 }, stag: { z: '높음', x: '보통', c: '보통', r: '보통' },
    ult: { name: '솔라빔 : 일광 폭격', type: 'fire', seq: [['beam', { hh: 30 }], ['meteor', { n: 5 }]] }
  },
  // ---------------- 뮤츠 ----------------
  'mewtwo-mega-x': {
    badge: '🔮🥊', role: '격투 · 사이코 인파이트 특화', summary: '근접 평타 +35% · 기술 +15% · 받는 피해 -10% · 격투 기운 오라',
    aura: 0x8a8aff, pose: 'Strike', style: MELEE,
    skills: { z: 'psycho_cut', x: 'close_combat', c: 'psystrike' },
    tags: { z: '근접 베기 · 격투 거대 베기', x: '제자리 12연타 난타', c: '화면 전체 염동 파동', r: '참격 난무 + 염동 폭발' },
    pow: { z: 780, x: 700, c: 490, r: 700, r1: 420 }, stag: { z: '높음', x: '높음', c: '보통', r: '보통' },
    ult: { name: '사이코 인파이트 : 염동 난무', type: 'fighting', seq: [['blades', { n: 10 }], ['nova', { R: 150 }]] }
  },
  'mewtwo-mega-y': {
    badge: '🔮✨', role: '초고속 원거리 · 사이코브레이크 특화', summary: '차징 샷 +35% · 평타 · 기술 +15% · 공중 점프 +1 · 이동 +6%',
    aura: 0xff5a9a, pose: 'Shoot', style: RANGED,
    skills: { z: 'psycho_cut', x: 'psystrike', c: 'future_sight' },
    tags: { z: '유도 칼날 5장', x: '화면 전체 파동 5회', c: '표식 → 빛의 기둥', r: '염동 폭발 + 광선' },
    pow: { z: 640, x: 490, c: 460, r: 700, r1: 700 }, stag: { z: '높음', x: '보통', c: '보통', r: '높음' },
    ult: { name: '사이코브레이크 : 염동 붕괴', type: 'psychic', seq: [['nova', { R: 160 }], ['beam', {}]] }
  },
  // ---------------- 라이츄 ----------------
  'raichu-mega-x': {
    badge: '⚡🥊', role: '근접 · 볼트 돌격 특화', summary: '근접 평타 +35% · 기술 +15% · 받는 피해 -10% · 전격 오라',
    aura: 0xffd23a, pose: 'Strike', style: MELEE,
    skills: { z: 'thunder_fang', x: 'volt_tackle', c: 'wild_charge' },
    tags: { z: '근접 물기 연타', x: '전격 돌진', c: '돌진 · 연쇄 번개', r: '참격 난무 + 낙뢰' },
    pow: { z: 1080, x: 280, c: 410, r: 700, r1: 150 }, stag: { z: '높음', x: '낮음', c: '낮음', r: '낮음' },
    ult: { name: '와일드볼트 : 뇌격 돌파', type: 'electric', seq: [['blades', { n: 8 }], ['pillars', { n: 6 }]] }
  },
  'raichu-mega-y': {
    badge: '⚡✨', role: '원거리 · 낙뢰 폭풍 특화', summary: '차징 샷 +35% · 평타 · 기술 +15% · 공중 점프 +1 · 이동 +6%',
    aura: 0x8ad8ff, pose: 'Shoot', style: RANGED,
    skills: { z: 'thundershock', x: 'thunderbolt', c: 'thunder' },
    tags: { z: '원거리 전기탄 연사', x: '자동 조준 낙뢰', c: '낙뢰 폭풍', r: '낙뢰 기둥 + 광선' },
    pow: { z: 1360, x: 310, c: 370, r: 700, r1: 380 }, stag: { z: '높음', x: '낮음', c: '보통', r: '보통' },
    ult: { name: '10만볼트 : 천뢰 폭풍', type: 'electric', seq: [['pillars', { n: 10 }], ['beam', { hh: 24 }]] }
  },
  // ---------------- 개굴닌자 ----------------
  'greninja-ash': {
    badge: '🐸💧', role: '유대변화(지우) · 거대 수리검 원거리', summary: '차징 샷 +35% · 평타 · 기술 +15% · 공중 점프 +1 · 이동 +6%',
    aura: 0x4ac8ff, pose: 'Shoot', style: RANGED,
    skills: { z: 'water_shuriken', x: 'dark_pulse', c: 'double_team' },
    tags: { z: '원거리 다연발 수리검', x: '관통 파동 3겹', c: '순간이동 · 분신 4개', r: '수리검 난무 + 물기둥' },
    pow: { z: 1370, x: 380, c: 330, r: 700, r1: 140 }, stag: { z: '높음', x: '보통', c: '보통', r: '낮음' },
    ult: { name: '물수리검 : 거대 수리검 난무', type: 'water', seq: [['blades', { n: 8 }], ['pillars', {}]] }
  },
  'greninja-mega': {
    badge: '🐸🥷', role: '근접 암살 · 그림자 닌자', summary: '근접 평타 +35% · 기술 +15% · 받는 피해 -10% · 그림자 오라',
    aura: 0x7a5aff, pose: 'Strike', style: MELEE,
    skills: { z: 'razor_shell', x: 'night_slash', c: 'sucker_punch' },
    tags: { z: '근접 물칼날 연베기', x: '관통 돌진 베기', c: '등 뒤 순간이동 기습', r: '참격 난무 + 일식' },
    pow: { z: 570, x: 460, c: 630, r: 700, r1: 420 }, stag: { z: '보통', x: '보통', c: '보통', r: '보통' },
    ult: { name: '깜짝베기 : 그림자 난도', type: 'dark', seq: [['blades', { n: 10 }], ['eclipse', {}]] }
  },
  // ---------------- 한카리아스 ----------------
  'garchomp-mega': {
    badge: '🦈⛰️', role: '중장갑 · 지상 파괴', summary: '근접 평타 +35% · 기술 +15% · 받는 피해 -18% · 이동 -8%',
    aura: 0x6a8aff, pose: 'Strike', style: { dmg: { z: 1.35, x: 1.15, c: 1.15, dive: 1.2 }, guard: .82, speed: .92 },
    skills: { z: 'dual_chop', x: 'dragon_rush', c: 'earthquake' },
    tags: { z: '근접 2연 베기 3연격', x: '도약 내려꽂기', c: '주변 지면 강타', r: '영역 폭발 + 유성' },
    pow: { z: 690, x: 480, c: 370, r: 700, r1: 480 }, stag: { z: '보통', x: '보통', c: '낮음', r: '보통' },
    ult: { name: '드래곤다이브 : 영역전개', type: 'dragon', seq: [['nova', { R: 150 }], ['meteor', { n: 5 }]] }
  },
  'garchomp-mega-z': {
    badge: '🦈⚡', role: '음속 · 공중 기동', summary: '이동 +15% · 공중 점프 +1 · 평타 · 기술 · 차징 샷 +15%',
    aura: 0x5ad0ff, pose: 'Attack', style: { dmg: { z: 1.15, x: 1.15, c: 1.15, chg: 1.15 }, speed: 1.15, jumps: 1 },
    skills: { z: 'dragon_tail', x: 'dragon_claw', c: 'outrage' },
    tags: { z: '근접 꼬리 휘두르기', x: '근접 X자 베기', c: '2초 난동 + 번개', r: '참격 난무 + 유성' },
    pow: { z: 830, x: 310, c: 570, r: 700, r1: 170 }, stag: { z: '높음', x: '낮음', c: '보통', r: '낮음' },
    ult: { name: '역린 : 음속 난무', type: 'dragon', seq: [['blades', { n: 10 }], ['meteor', { n: 5 }]] }
  }
};

export const megaForm = mg => (mg && MEGA_FORMS[mg.key]) || null;
export const megaStyle = mg => { const f = megaForm(mg); return f ? f.style : null; };
// 메가(특수) 폼이 둘 이상인 계열 — V 를 누르면 고르는 창이 열린다
export const multiMega = sp => !!(sp && sp.megas && sp.megas.length > 1);
// 스타일 보정 한 줄씩 (선택 창 스탯 칩 · 상세 창): [글, 좋은 쪽이면 true]
export function styleLines(st) {
  if (!st) return [];
  const out = [], d = st.dmg || {}, pct = v => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
  const NAME = { z: '평타(Z)', x: 'X 기술', c: 'C 기술', chg: '차징 샷', dive: '내려찍기' };
  for (const k of ['z', 'x', 'c', 'chg', 'dive']) if (d[k] && d[k] !== 1) out.push([`${NAME[k]} ${pct(d[k])}`, d[k] > 1]);
  if (st.speed && st.speed !== 1) out.push([`이동 ${pct(st.speed)}`, st.speed > 1]);
  if (st.jumps) out.push([`공중 점프 +${st.jumps}`, true]);
  if (st.guard && st.guard !== 1) out.push([`받는 피해 ${pct(st.guard)}`, st.guard < 1]);
  return out;
}
