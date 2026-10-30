// 기술 데이터 → 액션 변환 규칙 (Phaser 없이 도는 순수 데이터 모듈 — 게임(game/SkillGenerator.js)과 도구(scripts/gen-skill.js)가 함께 쓴다)
//  archetypeOf: 분류(물리/특수/변화) · 위력 · 대상 · 성질 플래그 · 이름으로 액션 형태를 고른다
//  cooldownOf: PP·위력 → 쿨타임 · totalMulOf: 위력·쿨타임 → 한 번 쓸 때 총 배율 · toSkillMeta: SKILLS 표시 정보
import { MOVE_DB } from './MoveDatabase.js';

const has = (m, f) => !!(m.flags && m.flags.includes(f));
const re = (id, rx) => rx.test(id);

// ---------------- 1) 액션 형태 고르기 ----------------
export function archetypeOf(m, id) {
  if (!m) return null;
  if (['ally', 'all-allies', 'specific-move', 'selected-pokemon-me-first'].includes(m.target)) return null;
  if (m.cls === 'status') {
    if (m.heal || re(id, /^(recover|roost|synthesis|moonlight|morning_sun|rest|slack_off|soft_boiled|milk_drink|shore_up|lunar_blessing|life_dew|jungle_healing|wish|heal_order)$/)) return 'heal';
    if (re(id, /protect|detect|endure|shield|bunker|obstruct|silk_trap|bulwark|reflect|light_screen|barrier|iron_defense|acid_armor|cotton_guard|defense_curl|withdraw|harden|shelter|aurora_veil|safeguard/)) return 'shield';
    if (re(id, /stealth_rock|spikes|sticky_web|toxic_spikes|magnet_rise|aqua_ring|ingrain/)) return 'orbit';
    if (['user', 'users-field', 'user-and-allies'].includes(m.target)) return m.stats && Object.values(m.stats).some(v => v > 0) ? 'buff' : null;
    if (m.ail && !['protect', 'no-type-immunity', 'perish-song', 'infatuation', 'torment', 'embargo', 'heal-block', 'silence', 'disable', 'nightmare', 'ingrain'].includes(m.ail)) return 'hex';
    if (m.stats && Object.values(m.stats).some(v => v < 0)) return 'hex';
    return null;
  }
  if (!m.power) return null;   // 위력이 정해지지 않은 특수 계산 기술(카운터·지구던지기 등)은 건너뛴다
  if (m.cls === 'physical') {
    if (m.pri > 0) return 'dash';
    if (has(m, 'punch')) return 'strike';
    if (has(m, 'bite')) return 'fang';
    if (m.hits && m.hits[1] >= 2) return has(m, 'contact') ? 'flurry' : 'volley';
    if (m.target === 'all-other-pokemon' || re(id, /quake|bulldoze|magnitude|stomping|precipice|fissure/)) return 'shockwave';
    if (re(id, /slam|crash|smash|hammer|body_press|stomp|drop|fall|dive_bomb|meteor_mash/)) return 'slam';
    if (re(id, /claw|slash|cut|blade|cross|scissor|sword|razor|edge_shell|night|aerial_ace|fury_cutter|false_swipe|x_scissor|leaf_blade|sacred_sword|kowtow|ceaseless/) && has(m, 'contact')) return 'slash';
    if (re(id, /rock_slide|stone_edge|rock_tomb|avalanche|icicle_crash|diamond_storm|meteor|sky_attack|thousand|dragon_darts|stone_axe/)) return 'sky_fall';
    if (has(m, 'contact')) return re(id, /rush|charge|tackle|take_down|double_edge|flare_blitz|brave_bird|wild_charge|head|horn|drill|wave_crash|u_turn|fly|bounce|outrage|thrash|spin|roll|volt|giga_impact|close_combat|superpower/) ? 'dash' : 'slash';
    return 'projectile';
  }
  // 특수
  if (has(m, 'sound')) return 'ring';
  if (has(m, 'pulse') || re(id, /beam|_ray|cannon|laser|hydro_pump|flamethrower|solar|hyper_voice|spectral|prismatic|dynamax|eternabeam|origin_pulse|fleur/)) return 'beam';
  if (m.drain || re(id, /drain|leech|absorb|draining/)) return 'homing';
  if (has(m, 'ballistics') || re(id, /sphere|ball|bomb|orb|missile|weather_ball/)) return 'homing';
  if (re(id, /thunder$|thunder_cage|lightning|bolt_strike|zap_cannon|fire_blast|blizzard|hurricane|storm|draco|meteor|judgment|thunderclap/)) return 'sky';
  if (re(id, /earth_power|eruption|lava|magma|fire_spin|whirlpool|sand_tomb|infestation|toxic|sludge_wave|poison_gas|spore|leaf_storm|grass_knot|seed/)) return 'zone';
  if (m.target === 'all-opponents' || m.target === 'all-other-pokemon' || m.target === 'entire-field') return 'burst';
  if (re(id, /blade|disc|wheel|razor|cutter|boomerang|leaf|wing|psycho_cut|air_slash|shuriken/)) return 'boomerang';
  return 'projectile';
}

// 쿨타임: PP 가 적을수록(=본가에서 귀한 기술) · 위력이 클수록 길다 (2~12초)
export function cooldownOf(m, arch) {
  if (arch === 'buff' || arch === 'shield' || arch === 'heal') return Math.min(14, Math.max(8, 8 + (20 - (m.pp || 20)) * .25));
  if (arch === 'orbit') return 10;
  const ppK = { 5: 9, 10: 6, 15: 4.5, 20: 3.5 }[m.pp] ?? ((m.pp || 15) >= 25 ? 2.5 : 5);
  return Math.round(Math.min(12, Math.max(2, ppK + ((m.power || 60) - 80) / 40)) * 10) / 10;
}
// 한 번 쓸 때 주는 총 배율 (공격력 × mul): 위력과 쿨타임에 맞춰 손으로 만든 기술과 비슷한 세기
export function totalMulOf(m, cd) { return Math.round((m.power || 60) * .022 * (.6 + cd / 10) * 100) / 100; }

const ICON = { fire: 'flame', water: 'drop', grass: 'leaf', electric: 'bolt', ghost: 'ghost', fighting: 'fist', dark: 'fang', dragon: 'claw', normal: 'orb', flying: 'wing', poison: 'bubble', psychic: 'orb', ice: 'orb', rock: 'boom', ground: 'boom', bug: 'leaf', steel: 'shield', fairy: 'orb' };
const ARCH_ICON = { slash: 'claw', fang: 'fang', strike: 'fist', dash: 'dash', flurry: 'claw', buff: 'shield', shield: 'shield', heal: 'seed', beam: 'wave', ring: 'wave', burst: 'boom', shockwave: 'boom', slam: 'boom', orbit: 'orb', boomerang: 'spin' };
export const ARCH_NAME = { slash: '베기', strike: '펀치', fang: '물어뜯기', flurry: '연속 베기', dash: '돌진', slam: '내려찍기', shockwave: '지면 충격파', volley: '연사', sky_fall: '낙석', projectile: '투사체', boomerang: '부메랑',
  homing: '유도탄', beam: '관통 빔', ring: '음파 고리', burst: '주변 폭발', sky: '하늘 강타', zone: '장판', buff: '강화 오라', heal: '회복', shield: '보호막', orbit: '위성 구체', hex: '약화 파동' };
const AIL_KO = { burn: '화상', paralysis: '마비', freeze: '빙결', poison: '독', sleep: '잠듦(기절)', confusion: '혼란', trap: '속박', 'leech-seed': '씨뿌리기(독)', yawn: '하품(기절)' };

// ---------------- 표시 정보 ----------------
export function toSkillMeta(id) {
  const m = MOVE_DB[id], arch = archetypeOf(m, id);
  if (!arch) return null;
  const cd = cooldownOf(m, arch), fx = [];
  if (m.ail && AIL_KO[m.ail]) fx.push(`${AIL_KO[m.ail]}${m.ailP ? ` ${m.ailP}%` : ''}`);
  if (m.drain) fx.push(`흡수 ${m.drain}%`);
  if (m.recoil) fx.push(`반동 ${m.recoil}%`);
  if (m.flinch) fx.push(`풀죽음 ${m.flinch}%`);
  if (m.hits) fx.push(`${m.hits[0]}~${m.hits[1]}연타`);
  return {
    name: m.ko || m.en, type: m.type, cd, icon: ARCH_ICON[arch] || ICON[m.type] || 'orb',
    desc: `${m.desc || m.en} [${ARCH_NAME[arch]}${m.power ? ` · 위력 ${m.power}` : ''}${fx.length ? ' · ' + fx.join(' · ') : ''}]`,
    mega: '메가진화하면 한 갈래 더 · 범위와 효과 확률이 커진다', gen: true, arch, power: m.power, cls: m.cls, src: 'PokeAPI'
  };
}

