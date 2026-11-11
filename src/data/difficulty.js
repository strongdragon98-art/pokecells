// 🎚️ 난이도 3단계 — 지금까지 맞춘 하드코어 밸런스가 🔥 어려움(hard · 기준점 1.0x · 기본값)
//  설정(systems/Settings.js 'difficulty')에 남아 새 게임 · 이어하기 · 테스트룸 모두 같은 값을 쓴다 — 도중에 바꾸면 그 자리에서 바로 (setDifficulty)
//  배율이 곱해지는 자리:
//   hp    보스 · 엘리트 최대 체력 (GameScene.spawnBoss · 엘리트 스폰 · 바꾸는 순간 살아 있는 보스 · 엘리트도 비율대로)
//   dmg   적에게 받는 모든 피해 (Player.takeHit — 몸통 · 탄 · 폭발 · 장판)
//   shot  보스 탄 비행 속도 (Combat.spawnProjectile 의 보스 탄 · Boss 의 스스로 움직이는 탄 bossSpeed)
//   stag  보스 그로기 게이지 상승량 (Boss.addStagger · addStaggerRaw — 평타 · 기술 · 차징 · 패링 모두)
//   cd    패턴 사이 대기 시간 (보스 AI 의 idle · recover 상태 시계를 1/cd 배로 — 쿨타임 · 후딜레이가 cd 배 길어진다)
//   act   패턴 실행 속도 (그 밖의 상태 — 예비 동작 · 공격 모션 시계 act 배)
//   move  보스 몸놀림 (돌진 · 이동 속도 move 배 — 광폭화 RAGE 와 같은 방식으로 물리 단계 동안만 키운다)
import { Settings } from '../systems/Settings.js';

export const DIFFICULTY = {
  normal: {
    id: 'normal', name: '보통', en: 'NORMAL', icon: '⚔️', color: 0x6ad8a0, hex: '#7affc0',
    hp: .8, dmg: .8, shot: .82, stag: 1.3, cd: 1.15, act: 1, move: 1,
    desc: '보스의 탄막 속도와 공격력이 완화되고 그로기가 더 자주 발생합니다. 메트로배니아의 탐험과 빌드의 재미를 쾌적하게 즐기기에 적합합니다.',
    lines: ['보스 · 엘리트 체력 -20%', '받는 피해 -20%', '보스 탄속 -18%', '그로기 +30% (잘 쌓인다)', '패턴 사이 대기 +15%']
  },
  hard: {
    id: 'hard', name: '어려움', en: 'HARD', icon: '🔥', color: 0xff9a4a, hex: '#ffb070', recommend: true,
    hp: 1, dmg: 1, shot: 1, stag: 1, cd: 1, act: 1, move: 1,
    desc: '포켓셀의 표준 하드코어 난이도입니다. 정확한 패링과 패턴 숙지, 꼼꼼한 파밍이 요구됩니다.',
    lines: ['보스 · 엘리트 체력 기준 (1.0x)', '받는 피해 기준', '보스 탄속 기준', '그로기 기준', '패턴 템포 기준']
  },
  very_hard: {
    id: 'very_hard', name: '매우 어려움', en: 'VERY HARD', icon: '💀', color: 0xff3a5a, hex: '#ff6a80',
    hp: 1.3, dmg: 1.35, shot: 1.25, stag: .7, cd: .65, act: 1.2, move: 1.2,
    desc: '보스의 체력과 공격력이 대폭 상승하며, 초고속 탄막과 빈틈없는 연속 패턴이 몰아칩니다. 그로기가 잘 쌓이지 않으며 완벽한 컨트롤을 요구합니다.',
    lines: ['보스 · 엘리트 체력 +30%', '받는 피해 +35%', '보스 탄속 +25%', '패턴 실행 속도 +20%', '패턴 사이 대기 -35%', '그로기 -30% (강인함)']
  }
};
export const DIFF_ORDER = ['normal', 'hard', 'very_hard'];
export const diffId = () => (DIFFICULTY[Settings.get('difficulty')] ? Settings.get('difficulty') : 'hard');
export const diff = () => DIFFICULTY[diffId()];
export const diffBadge = (d = diff()) => `${d.icon} ${d.en}`;

// 난이도 바꾸기 — gs(GameScene)가 있으면 살아 있는 보스 · 엘리트 체력을 비율대로 바로 맞추고 알림 (탄속 · 피해 · 그로기 · 패턴 템포는 매 프레임 diff() 를 읽어 저절로)
export function setDifficulty(id, gs = null) {
  if (!DIFFICULTY[id]) return false;
  const prev = diff();
  Settings.set('difficulty', id);
  const next = diff();
  if (gs && gs.enemies && prev !== next) {
    const r = next.hp / prev.hp;
    for (const e of gs.enemies) {
      if (!e.alive || !(e.boss || e.elite) || e.dummy) continue;
      e.maxhp = Math.max(1, Math.round(e.maxhp * r));
      e.hp = Math.max(1, Math.min(e.maxhp, e.hp * r));
    }
  }
  if (gs && gs.events && prev !== next) gs.events.emit('difficulty', next);
  return prev !== next;
}
// ◀ ▶ 한 칸 옮기기
export const stepDifficulty = (dir, gs) => setDifficulty(DIFF_ORDER[(DIFF_ORDER.indexOf(diffId()) + dir + DIFF_ORDER.length) % DIFF_ORDER.length], gs);
