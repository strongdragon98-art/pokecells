// 도감 해금·정화 수·파티 편성을 localStorage 에 자동 저장
//  해금 규칙은 data/roster.js 의 unlock: 처음부터 · 같은 종 정화 · n지방 최종 보스 정화 · 누적 정화 · 전설 보스 정화
import { STARTERS, UNLOCKABLE, UNLOCK_KILLS } from '../data/pokemon.js';
import { LINES, LINE } from '../data/roster.js';

const KEY = 'pokecells.phaser.v1';

function fresh() {
  return { unlocked: [...STARTERS], kills: {}, party: [...STARTERS], runs: 0, wins: 0, bestStage: 0, cleared: 0, totalPurified: 0, joined: [] };
}

// 조건을 만족했는지 (저장된 등록 목록 + 진행도로 판정). 테스터 모드면 전부 열린다 — 끄면 원래 진행도로 돌아간다
function met(d, k) {
  const l = LINE[k];
  if (!l) return false;
  if (d.tester || d.unlocked.includes(k)) return true;
  const u = l.unlock || {};
  return !!(u.start || (u.stage && (d.cleared || 0) >= u.stage) || (u.total && d.totalPurified >= u.total));   // cleared: 최종 보스까지 정화한 지방 수
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return fresh();
    const d = Object.assign(fresh(), raw);
    // 옛 기록 고치기: 피카츄 → 피츄 계열로 이름이 바뀌었고, 꼬렛은 플레이어블에서 빠졌다
    //  한카리아스는 전설에서 빠져 딥상어동 계열(gible)이 됐다
    const ren = k => k === 'pikachu' ? 'pichu' : k === 'garchomp' ? 'gible' : k, keep = k => k !== 'rattata';
    d.joined = (d.joined || []).map(ren);
    d.unlocked = [...new Set(d.unlocked.map(ren).filter(keep))];
    d.party = (d.party || []).map(ren).filter(keep);
    if (d.kills.pikachu != null) { d.kills.pichu = Math.max(d.kills.pichu || 0, d.kills.pikachu); delete d.kills.pikachu; }
    delete d.kills.rattata;
    for (const s of STARTERS) if (!d.unlocked.includes(s)) d.unlocked.push(s);
    d.party = (d.party || []).filter(k => met(d, k)).slice(0, 3);
    if (!d.party.length) d.party = [...STARTERS];
    // 이미 조건을 넘긴 포켓몬은 알림 없이 합류 처리 (테스터 모드로 열린 건 진짜 합류가 아니니 빼고)
    for (const l of LINES) if (met({ ...d, tester: false }, l.id) && !d.joined.includes(l.id)) d.joined.push(l.id);
    return d;
  } catch (e) {
    return fresh();
  }
}

export const Save = {
  data: load(),
  write() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* 저장소를 못 쓰면 이번 실행만 유지 */ } },
  isUnlocked(k) { return met(this.data, k); },
  kills(k) { return this.data.kills[k] || 0; },
  // 아직 등록 안 된 야생 포켓몬 정화 → { count, unlockedNow }
  addKill(k) {
    if (!UNLOCKABLE.includes(k) || this.data.unlocked.includes(k)) return null;   // 테스터 모드여도 진짜 정화 진행도는 쌓인다
    const count = Math.min(UNLOCK_KILLS, this.kills(k) + 1);
    this.data.kills[k] = count;
    let unlockedNow = false;
    if (count >= UNLOCK_KILLS) { this.data.unlocked.push(k); this.data.joined.push(k); unlockedNow = true; }
    this.write();
    return { count, unlockedNow };
  },
  // 누적 정화 +1 · 보스 정화 뒤 → 새로 조건을 넘긴 라인 목록 (합류 알림용)
  addPurify() { this.data.totalPurified++; return this.newlyJoined(); },
  newlyJoined() {
    const out = [], real = { ...this.data, tester: false };
    for (const l of LINES) if (met(real, l.id) && !this.data.joined.includes(l.id)) { this.data.joined.push(l.id); out.push(l.id); }
    this.write();
    return out;
  },
  // 보스를 정화하면 그 보스로 합류하는 라인이 영구 합류 (전설은 같은 이름 · 한카리아스 보스 → 딥상어동 계열) → 합류한 라인 id 또는 null
  unlockByBoss(bossKey) {
    const l = LINES.find(x => (x.cat === 'legend' && x.id === bossKey) || (x.unlock && x.unlock.boss === bossKey));
    if (!l || this.data.unlocked.includes(l.id)) return null;
    this.data.unlocked.push(l.id); if (!this.data.joined.includes(l.id)) this.data.joined.push(l.id);
    this.write();
    return l.id;
  },
  // 디버그 (로비 F1·F3 · 게임 F3 메뉴): 스타팅·특수·야생·전설 전부 해금
  debugUnlockAll() {
    for (const k of UNLOCKABLE) this.data.kills[k] = UNLOCK_KILLS;
    for (const l of LINES) { if (!this.data.unlocked.includes(l.id)) this.data.unlocked.push(l.id); if (!this.data.joined.includes(l.id)) this.data.joined.push(l.id); }
    this.write();
  },
  // 테스터 모드 (로비 오른쪽 위): 켜면 모든 포켓몬을 고를 수 있다. 끄면 진짜로 합류하지 않은 포켓몬은 파티에서 빠진다
  get tester() { return !!this.data.tester; },
  setTester(on) {
    this.data.tester = !!on;
    if (!on) { this.data.party = this.data.party.filter(k => met(this.data, k)); if (!this.data.party.length) this.data.party = [...STARTERS]; }
    this.write();
  },
  setParty(list) { this.data.party = list.slice(0, 3); this.write(); },
  // ---------------- 🏆 전당등록 (진 엔딩) · 💠 2회차 보스 정수 ----------------
  //  hof: { 계열 key: { n 전당등록 횟수, first · last 날짜, form 마지막 모습 이름 } } — 로비 포켓몬 카드에 금장 테두리 (systems/RosterPanel.js)
  //  essence: { 정수 id: 강화 단계 0 ~ 3 } (영구 · data/essence.js) · beaten: { 보스 key: 정화 횟수 } (정수를 고를 수 있는 보스)
  hofOf(k) { return (this.data.hof || {})[k] || null; },
  get hofAny() { return Object.keys(this.data.hof || {}).length > 0; },
  recordHof(members) {
    const hof = this.data.hof || (this.data.hof = {}), today = new Date().toISOString().slice(0, 10);
    for (const m of members) { const h = hof[m.key] || (hof[m.key] = { n: 0, first: today }); h.n++; h.last = today; h.form = m.name; }
    this.data.clears = (this.data.clears || 0) + 1;
    this.write();
  },
  markBoss(key) { const b = this.data.beaten || (this.data.beaten = {}); b[key] = (b[key] || 0) + 1; this.write(); },
  // 정수를 고를 수 있는 보스: 정화 기록 + 예전 저장(기록 전)은 클리어한 지방 수로 짐작
  beatenBosses() {
    const b = { ...(this.data.beaten || {}) }, order = ['mewtwo', 'ho-oh', 'rayquaza', 'giratina', 'reshiram', 'eternatus'];
    for (let i = 0; i < Math.min(order.length, this.data.cleared || 0); i++) b[order[i]] = Math.max(1, b[order[i]] || 0);
    if ((this.data.cleared || 0) >= 5) b.arceus = Math.max(1, b.arceus || 0);
    return b;
  },
  essenceLv(id) { return Math.max(0, Math.min(3, ((this.data.essence || {})[id]) || 0)); },
  setEssenceLv(id, lv) { (this.data.essence || (this.data.essence = {}))[id] = Math.max(0, Math.min(3, lv)); this.write(); },
  recordRun(stageReached, won) {
    this.data.runs++;
    if (won) this.data.wins++;
    this.data.bestStage = Math.max(this.data.bestStage, stageReached);
    this.write();
  }
};
