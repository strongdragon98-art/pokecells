// 도감 해금·정화 수·파티 편성을 localStorage 에 자동 저장
import { STARTERS, UNLOCKABLE, UNLOCK_KILLS } from '../data/pokemon.js';

const KEY = 'pokecells.phaser.v1';

function fresh() {
  return { unlocked: [...STARTERS], kills: {}, party: [...STARTERS], runs: 0, wins: 0, bestStage: 0 };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return fresh();
    const d = Object.assign(fresh(), raw);
    // 옛 기록 고치기: 피카츄 → 피츄 계열로 이름이 바뀌었고, 꼬렛은 플레이어블에서 빠졌다
    const ren = k => k === 'pikachu' ? 'pichu' : k, keep = k => k !== 'rattata';
    d.unlocked = [...new Set(d.unlocked.map(ren).filter(keep))];
    d.party = (d.party || []).map(ren).filter(keep);
    if (d.kills.pikachu != null) { d.kills.pichu = Math.max(d.kills.pichu || 0, d.kills.pikachu); delete d.kills.pikachu; }
    delete d.kills.rattata;
    for (const s of STARTERS) if (!d.unlocked.includes(s)) d.unlocked.push(s);
    d.party = (d.party || []).filter(k => d.unlocked.includes(k)).slice(0, 3);
    if (!d.party.length) d.party = [...STARTERS];
    return d;
  } catch (e) {
    return fresh();
  }
}

export const Save = {
  data: load(),
  write() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* 저장소를 못 쓰면 이번 실행만 유지 */ } },
  isUnlocked(k) { return this.data.unlocked.includes(k); },
  kills(k) { return this.data.kills[k] || 0; },
  // 아직 등록 안 된 야생 포켓몬 정화 → { count, unlockedNow }
  addKill(k) {
    if (!UNLOCKABLE.includes(k) || this.isUnlocked(k)) return null;
    const count = Math.min(UNLOCK_KILLS, this.kills(k) + 1);
    this.data.kills[k] = count;
    let unlockedNow = false;
    if (count >= UNLOCK_KILLS) { this.data.unlocked.push(k); unlockedNow = true; }
    this.write();
    return { count, unlockedNow };
  },
  // 디버그(로비 F1): 모든 야생 포켓몬 정화 수를 채워 도감에 등록
  debugUnlockAll() {
    for (const k of UNLOCKABLE) {
      this.data.kills[k] = UNLOCK_KILLS;
      if (!this.isUnlocked(k)) this.data.unlocked.push(k);
    }
    this.write();
  },
  setParty(list) { this.data.party = list.slice(0, 3); this.write(); },
  recordRun(stageReached, won) {
    this.data.runs++;
    if (won) this.data.wins++;
    this.data.bestStage = Math.max(this.data.bestStage, stageReached);
    this.write();
  }
};
