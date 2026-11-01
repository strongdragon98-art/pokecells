// 메가스톤 · Z크리스탈 — 포켓몬마다 전용 장착 칸이 하나씩 (일반 도구 2칸과 따로)
//  메가스톤: 그 계열 전용 (리자몽나이트는 파이리 계열만). 키스톤(파티 공용 · 방울탑 노승려)이 있어야 공명한다 → 3단에서 메가진화 · R 메가 필살기
//   폼체인지 아이템(큰금강옥 등 · data/roster.js FORM_ITEMS)을 쓰는 전설은 예전처럼 아이템만 있으면 된다
//  Z크리스탈: 속성마다 하나 (불꽃Z · 물Z …). Z링(파티 공용 · 호연 하늘기둥 입구의 시련 캡틴)이 있어야 하고,
//   그 포켓몬의 첫 속성(= Z기술 속성)과 같은 크리스탈을 끼운 포켓몬만 Z기술을 쓴다
import { SPECIES } from './pokemon.js';
import { TYPES } from './types.js';

// 계열이 메가스톤으로 메가진화(유대변화)하는가 (폼체인지 아이템 전설 · 각성만 있는 포켓몬은 아니다)
export const usesStone = line => !!SPECIES[line] && SPECIES[line].megas.some(m => !m.item);
// 메가스톤 이름: 최종 진화 이름 + 나이트 (리자몽나이트 · 개굴닌자나이트)
export const stoneName = line => { const sp = SPECIES[line]; return sp ? `${sp.evo[sp.evo.length - 1].name}나이트` : '메가스톤'; };
// Z크리스탈: 그 포켓몬의 Z기술 속성 = 첫 속성
export const zTypeOf = line => (SPECIES[line] ? SPECIES[line].types[0] : 'normal');
export const crystalName = type => `${(TYPES[type] || TYPES.normal).name}Z`;
