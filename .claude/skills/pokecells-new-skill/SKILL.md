---
name: pokecells-new-skill
description: 포켓셀즈에 새 포켓몬 기술·보스 기술을 추가하거나 기존 기술을 원작 데이터에 맞게 바꿀 때 쓴다. "새로운 포켓몬이나 보스 스킬 추가해 줘", "○○에게 △△ 기술 넣어 줘", "이 기술 원작처럼 바꿔 줘" 같은 요청. GitHub(PokeAPI) 기술 데이터베이스와 SkillGenerator 로 바로 구현하고 시험한 뒤 배포까지 한다.
---

# 포켓셀즈 기술 추가 파이프라인

원작 기술 데이터(GitHub PokeAPI)를 이 게임의 실시간 액션 기술로 바꾸는 순서. 코드는 `pokecells/` 폴더 기준.

## 0. 데이터가 최신인지
- 기술 DB: `src/data/MoveDatabase.js` (자동 생성 · 직접 고치지 않는다). 다시 받기: `npm run fetch-skills`
  - 출처 PokeAPI/pokeapi `data/v2/csv` (BSD 계열 라이선스, 파일 머리의 저작권 표시를 지운다면 안 된다). 음원·그림은 받지 않는다.
  - 플레이어블 라인(`src/data/roster.js`)의 모든 모습이 역대 게임에서 배우는 기술만 담는다 → **새 라인을 로스터에 넣었으면 꼭 다시 받는다.**

## 1. 기술 찾기
```bash
npm run gen-skill -- <기술 id | 한글 이름 | 영문 이름>
npm run gen-skill -- --line <라인 id>      # 그 계열이 배우는 기술과 액션 형태 목록
```
원본 데이터(분류·위력·PP·부가 효과·플래그), 고른 액션 형태, 쿨타임·배율, 손으로 다듬을 뼈대 코드가 나온다.

## 2. 어느 쪽으로 넣을지
- **자동 생성으로 충분할 때** (대부분의 일반 기술): 할 일 없음. `src/game/SkillGenerator.js` 가 게임 시작 때 손으로 만든 기술이 없는 DB 기술을 전부 만들어 `SKILLS`·`SKILL_IMPL` 에 더한다. 그 계열 습득표에 있으면 기술머신 카드(`src/data/tm.js` `learnableMoves`)로 나온다.
  - 액션 형태가 어색하면 규칙을 고친다: `src/data/moveRules.js` `archetypeOf` (이름 정규식 · 플래그 · 대상). 한 기술만 바꾸려면 손으로 만든다.
- **시그니처·전설·보스 기술** (연출이 중요): 손으로 만든다.
  1. 표시 정보 → `src/data/skills/<세대>.js` 의 `SKILLS` (name·type·cd·icon·desc·mega). `cd: 0` 이면 Z 칸 3단 연타 기술 (`(p, i)` 의 i = 0·1·2).
  2. 동작 → `src/game/skills/<세대>.js` 의 `SKILL_IMPL`. 행동 객체 `{ dur, mm, anim, lockFace, inv, guard, ev:[[시각, fn]], update(p,a,dt), end(p,a) }`.
  3. 쓸 수 있는 도우미
     - `src/game/skillKit.js`: `slashHit` · `strikeHit` · `shoot`(boomerang·homing·boom·pierce 옵션) · `beamAction` · `dashAction` · `rockPillar` · `lineFx` · `sizeMul`
     - `src/game/Mechanics.js`: `bezierMissiles`(유도탄) · `groundShockwave`(지면 충격파) · `orbitSatellites`(위성 구체) · `skyStrike`(하늘 강타·낙석) · `soundRing`(음파 고리) · `radialBurst`(주변 폭발) · `groundZone`(장판)
     - 연출: `sc.fx` (`burst` · `ring` · `glow` · `slash` · `ghost` 잔상 · `shake` · `hitStop`) · 화면 왜곡 `shockwave(sc, x, y, 세기)` (`src/systems/PostFX.js`) · 소리 `Sfx.play(...)` (`src/systems/Audio.js` 에 새 소리를 더할 수 있다)
     - 판정 옵션(상태이상): `burn` · `poison` · `paralyze`(확률) · `freeze` · `stun` · `confuse` · `root` · `slow` · `curse` · `crit` · `lifesteal` · `hs`(역경직 ms)
  4. 라인에 달기: `src/data/roster.js` 그 라인의 `skills: { z, x, c }` 또는 모습별 `forms[i].skills`.
- **보스 기술**: `src/game/Boss.js` 의 `BOSS_AI.<보스>` 상태 기계에 패턴(mode)을 더한다. `e.choose([...])` 목록에 이름을 넣고 `wind` 끝에서 실행. 도우미: `e.shot` · `e.zone` · `marchPillars` · `thunderAt` · `rockfall` · `bolt`(game/Perks.js). 보스가 쓰는 탄은 `owner: 'enemy'`.

## 3. 주의 (예전에 게임을 멈추게 했던 것)
- 투사체 객체에 없는 필드를 부르지 않는다 (예: `q.core` — 지금은 `q.spr` · `q.glow` · `q.aura`). 한 프레임의 오류는 `src/systems/Guard.js` 가 잡아 게임이 멈추지 않게 하지만, 화면 왼쪽 아래 빨간 글자가 뜨면 버그다.
- 행동 객체 안의 한 줄 주석 `//` 뒤에 코드를 이어 쓰지 않는다 (같은 줄의 나머지가 주석이 된다).
- 새 기술이 `cd: 0` 이 아닌데 Z 칸 연타로 쓰이길 바라면 안 된다 (연타는 쿨타임 0 기술만).

## 4. 시험
개발 서버(`npm run dev`, http://127.0.0.1:5173/)에서 테스트룸(로비 · 테스터 모드 · T)으로 그 포켓몬을 고르거나, 브라우저 콘솔에서:
```js
const g = window.__game, gs = g.scene.getScene('Game'), p = gs.player;
p.replaceMember(0, '<라인 id>'); p.swapTo(0, true); p.m.tier = 2;
p.m.skills.x = '<기술 id>'; p.m.cd.x = 0; p.useSkill('x');
window.__pokecellsErrors   // 잡힌 오류 목록 (비어 있어야 한다)
```
연타 기술은 `p.combo = 0·1·2` 를 바꿔 가며 세 타 모두, 메가가 있으면 `p.m.mega = true` 로도 쏴 본다.

## 5. 마무리
`npm run build` 로 빌드 확인 → 커밋 → `git fetch` 로 원격 main 이 앞서 있지 않은지 확인 → main 푸시 → `npm.cmd run deploy` (앱 터미널에서, 경로는 cwd 로). 사용자에게 추가한 기술·액션 형태·시험 결과를 한국어로 알린다.
