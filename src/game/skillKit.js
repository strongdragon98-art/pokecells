// 스킬 구현 공용 도구 — game/skills.js 의 도우미를 라인별 전용 스킬 파일(game/skills/*.js)에 다시 내보낸다
// 각 스킬은 행동(action) 객체를 돌려준다:
//  { dur, mm(이동 배율), anim, ctrl(속도 직접 제어), noGrav, lockFace, guard, inv, ev:[[시각, fn]], update(p,a,dt), end(p,a) }
export { sizeMul, slashHit, strikeHit, shoot, lineFx, beamAction, rockPillar, iceShards, dashAction } from './skills.js';

// 카메라 시야 · 시야 안 x 좌표 아래의 땅 높이
export const view = p => p.scene.cameras.main.worldView;
export const groundAt = (p, x) => p.scene.groundBelow(x, p.y - 30);
