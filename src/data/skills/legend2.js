// 전설 플레이어블 기술 표시 정보 2 (라티아스·라티오스·한카리아스·디아루가·펄기아·기라티나·다크라이). 실제 동작은 game/skills/legend2.js
// mega: 한카리아스는 메가진화, 나머지는 '각성' 상태일 때의 변화
export const SKILLS = {
  // ===== 라티아스 =====
  mist_ball: { name: '미스트볼', type: 'psychic', cd: 0, icon: 'orb', desc: '안개 구슬 2연사 후 3타째에 큰 미스트볼. 터지면 적을 저주(받는 피해 증가).', mega: '구슬 2갈래 + 폭발 범위 증가, 안개가 남아 둔화' },
  heal_pulse: { name: '치유파동', type: 'psychic', cd: 9, icon: 'wave', desc: '파티 전원의 HP를 20% 회복하고 주변 적과 탄환을 밀어낸다.', mega: '회복 28% + 받는 피해 감소' },
  glide_dash: { name: '활공', type: 'dragon', cd: 9, icon: 'wing', desc: '방향키로 8방향 조종하며 고속 활공. 무적, 경로상의 적을 연타하고 탄환을 막는다.', mega: '더 빠르고 길게, 탄환 반사' },
  // ===== 라티오스 =====
  luster_purge: { name: '라스트버지', type: 'psychic', cd: 0, icon: 'orb', desc: '빛의 구슬 2연사 후 3타째에 전방 빛 폭발. 저주.', mega: '구슬 2갈래 + 폭발 2연쇄' },
  dragon_pulse: { name: '용의파동', type: 'dragon', cd: 8, icon: 'wave', desc: '용의 형상을 한 파동이 벽을 뚫고 전방으로 날아가 모든 적을 관통한다.', mega: '쌍룡 파동' },
  aerial_dive: { name: '공중급강하', type: 'dragon', cd: 10, icon: 'dash', desc: '하늘로 솟구친 뒤 가까운 적을 향해 급강하. 착지 지점에 대충격. 무적.', mega: '충격 범위 증가 + 지면 충격파' },
  // ===== 한카리아스 =====
  dual_chop: { name: '더블촙', type: 'dragon', cd: 0, icon: 'claw', desc: '한 번에 두 번 베는 3연격. 마지막 타격은 급소율이 높다.', mega: '마지막 타격에 모래 충격파' },
  dragon_rush: { name: '드래곤다이브', type: 'dragon', cd: 8, icon: 'boom', desc: '가장 가까운 적에게 뛰어올라 내리꽂는 용의 대충격. 풀죽음. 무적.', mega: '충격 범위·위력 증가' },
  sand_tomb: { name: '모래지옥', type: 'ground', cd: 10, icon: 'spin', desc: '적 발밑에 4초간 모래 소용돌이. 빨려든 적을 속박하고 계속 피해.', mega: '소용돌이 확대 + 끝에 모래 분출' },
  // ===== 디아루가 =====
  metal_claw: { name: '메탈크로우', type: 'steel', cd: 0, icon: 'claw', desc: '강철 발톱 3연격. 마지막 타격은 급소율이 높다.', mega: '마지막 타격이 2연속' },
  roar_of_time: { name: '시간의포효', type: 'dragon', cd: 9, icon: 'thunder', desc: '시간을 뒤트는 거대한 포효 광선. 맞은 적은 오래 둔화. 쏜 뒤 잠시 반동으로 움직일 수 없다.', mega: '광선 폭 증가 + 둔화 9초' },
  chrono_stop: { name: '시간정지', type: 'steel', cd: 12, icon: 'shield', desc: '화면 안의 시간을 멈춘다. 적 2.5초 정지(보스 0.8초), 적 탄환 정지. 시간이 흐르면 반동 피해.', mega: '정지 시간 증가 + 반동 피해 증가' },
  // ===== 펄기아 =====
  aqua_blade: { name: '아쿠아블레이드', type: 'water', cd: 0, icon: 'drop', desc: '물의 칼날 3연격. 마지막 타격은 물결 참격을 날린다.', mega: '물결 참격 2갈래' },
  spacial_rend: { name: '공간절단', type: 'dragon', cd: 9, icon: 'claw', desc: '화면을 가로지르는 공간의 균열이 시간차로 두 번 베어낸다. 두 번째는 풀죽음.', mega: '균열 폭·위력 증가' },
  warp_rift: { name: '공간이동', type: 'dragon', cd: 9, icon: 'dash', desc: '균열을 열고 방향키 쪽으로 순간이동. 남은 균열이 적을 계속 벤다. 무적.', mega: '이동 거리 증가 + 도착 지점에도 균열' },
  // ===== 기라티나 =====
  shadow_claw: { name: '섀도다이브: 차원 붕괴', type: 'ghost', cd: 0, icon: 'claw', desc: '공간을 세 줄기로 찢어 할퀴고, 앞 바닥을 따라 그림자 가시와 암흑 번개가 5번 연달아 솟구친다. 맞은 적은 잠깐 경직.', mega: '가시가 더 크고 맞은 적을 저주' },
  shadow_force: { name: '섀도다이브', type: 'ghost', cd: 9, icon: 'ghost', desc: '0.9초간 모습을 감추고(무적) 움직이다 가장 가까운 적 뒤에서 나타나 일격. 방어 무시.', mega: '폭발 범위·위력 증가 + 저주' },
  distortion: { name: '반전세계', type: 'ghost', cd: 11, icon: 'orb', desc: '4초간 주변을 반전세계로 바꾼다. 안의 적은 저주·둔화되고 중력이 약해져 떠오른다.', mega: '범위·시간 증가' },
  // ===== 다크라이 =====
  dark_pulse: { name: '악의파동', type: 'dark', cd: 0, icon: 'wave', desc: '악의 파동 2연사 후 3타째에 주변을 휩쓰는 파동. 풀죽음.', mega: '마지막 파동 확대 + 저주' },
  dark_void: { name: '다크홀', type: 'dark', cd: 9, icon: 'orb', desc: '검은 구멍 3개가 전방의 적을 삼켜 잠재우고 띄운다(2.5초, 보스는 짧게).', mega: '구멍 5개 + 수면 연장' },
  nightmare: { name: '악몽', type: 'ghost', cd: 11, icon: 'ghost', desc: '화면 안의 잠들거나 기절한 적은 4초간 큰 지속 피해. 나머지는 저주.', mega: '지속 피해 증가' }
};
