// 🗺️ 방 상태 — 지도(systems/MapView.js) · 화면 위 현재 방 HUD(scenes/UIScene.js)가 같은 말 · 같은 색으로 보여 준다
//  세 가지 핵심 상태 (GameScene.sideRoomsOf 가 정한 room.zone 그대로):
//   🟣 corrupt — 샛길: 정화 가능 구역 (side_purifiable_room · 아직 정화 전) — 침식된 포켓몬을 마지막 한 마리까지 쓰러뜨리면 영구히 정화
//   ✨ pure    — 샛길: 정화 완료 구역 (room.isPurified) — 다시 와도 · 이어하기로 와도 몬스터가 나오지 않는다
//   🩸 abyss   — 메인 루트: 심연 침식로 (main_path 전투 구역) — 정화되지 않고 다른 방에 다녀오면 몬스터가 다시 나타난다 (GameScene.respawnMainRoom)
//  그 밖: 마을 · 연구소(결계 안전 구역) · 보스 아레나 · 기술머신 비밀방 · 성역 · 조용한 샛길(몬스터 없음) · 정화한 지방(평화)
export const ROOM_STATES = {
  corrupt: { icon: '⚠️', title: '침식 구역 : 정화 필요', sub: '남은 적 처치 시 영구 정화', col: '#ffb060', sub2: '#e0a0ff', fill: 0x3a0a26, line: 0xc04aff, glow: 0xff5ab0, short: '⚠️ 정화 필요' },
  pure: { icon: '✨', title: '정화 완료 : 안전 구역', sub: '몬스터 리젠 없음', col: '#7affd8', sub2: '#ffe08a', fill: 0x1f8f6c, line: 0xffd860, glow: 0x8affd0, short: '✨ 정화 완료' },
  abyss: { icon: '♾️', title: '심연 침식로 : 정화 불가', sub: '재진입 시 몬스터 재생성', col: '#ff5a6a', sub2: '#ff9aa8', fill: 0x2a0810, line: 0xff2a4a, glow: 0xff2a4a, short: '♾️ 리젠' },
  town: { icon: '🏘️', title: '마을 결계 : 안전 구역', sub: '포켓몬센터 · 포켓샵 · 적 없음', col: '#ffe8a8', sub2: '#c8c0a8', short: '🏘️ 마을' },
  lab: { icon: '🔬', title: '오박사 연구소 : 안전 구역', sub: '결계 안 · 적 없음', col: '#ffe8a8', sub2: '#c8c0a8', short: '🔬 연구소' },
  sanct: { icon: '🕊️', title: '성역 : 안전 구역', sub: '적 없음', col: '#ffe8a8', sub2: '#c8c0a8', short: '🕊️ 성역' },
  arena: { icon: '💀', title: '보스 아레나', sub: '침식의 핵 — 쓰러뜨리면 정화', col: '#ff9a8a', sub2: '#d8a8a0', short: '💀 보스' },
  arenaDone: { icon: '💀', title: '보스 아레나 : 정화 완료', sub: '다시 싸우지 않는다', col: '#c8c0b8', sub2: '#9a948a', short: '✔ 보스' },
  tm: { icon: '🟡', title: '기술머신 비밀방', sub: '받침대의 기술머신을 해독', col: '#9ad8ff', sub2: '#c8d8e8', short: '🟡 기술머신' },
  calm: { icon: '·', title: '조용한 샛길', sub: '침식된 포켓몬 없음', col: '#d8d0c0', sub2: '#a8a094', short: '· 조용함' },
  peace: { icon: '✨', title: '정화된 지방 : 평화', sub: '몬스터 리젠 없음', col: '#7affd8', sub2: '#ffe08a', short: '✨ 평화' }
};

// 방 하나의 상태 키 — gs: GameScene · lv: 그 방이 속한 지방 (지도는 다른 지방도 본다)
export function roomStateKey(gs, r, lv = gs.level) {
  if (!r || !lv) return null;
  if (r.type === 'mini' || r.type === 'boss' || r.type === 'sanctuary') return r.cleared ? 'arenaDone' : 'arena';
  if (r.type === 'village') return 'town';
  if (r.lab) return 'lab';
  if (r.type === 'tm') return 'tm';
  if (lv.purified) return 'peace';
  if (r.peaceful) return 'sanct';
  if (gs.isSideRoom && gs.isSideRoom(r, lv)) return r.isPurified ? 'pure' : 'corrupt';
  if (r.main && r.type === 'combat') return 'abyss';
  if (r.type === 'start') return 'lab';
  return 'calm';
}
export const roomState = (gs, r, lv) => { const k = roomStateKey(gs, r, lv); return k ? Object.assign({ key: k }, ROOM_STATES[k]) : null; };
