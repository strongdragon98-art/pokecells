// 테스터 배포용 ZIP 만들기 (npm run package)
//  포켓셀즈 테스트판/
//    ▶ 게임 시작하기.html   ← 더블클릭하면 브라우저에서 실행, 첫 화면의 게임 마크를 누르면 시작
//    포켓셀즈 게임마크.png
//    읽어주세요.txt
// (ZIP 쓰기는 scripts/lib/zip.js — 파일 이름 UTF-8 플래그로 한글이 안 깨진다)
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeZip } from './lib/zip.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = '포켓셀즈 테스트판/';
const OUT = path.join(ROOT, '포켓셀즈_테스트판.zip');
const WEB_OUT = path.join(ROOT, '포켓셀즈_웹업로드용.zip');

const README = `포켓 셀즈 테스트판
========================================

[실행 방법 · PC]
1. 이 폴더의 「▶ 게임 시작하기.html」을 더블클릭하세요.
   (Chrome 또는 Edge 권장 · 인터넷 연결 필요 없음 · 설치 없음)
2. 화면에 뜬 포켓 셀즈 게임 마크(몬스터볼 버튼)를 누르면 시작합니다.
3. 도감에서 포켓몬을 최대 3마리 고르고 [던전 입장]을 누르세요.

[실행 방법 · 휴대폰 (안드로이드)]
1. 파일 앱에서 압축을 풀고 「▶ 게임 시작하기.html」을 눌러 Chrome으로 여세요.
2. 휴대폰을 가로로 돌리고 게임 마크를 누르면 전체화면으로 시작합니다.
※ 아이폰은 파일 앱에서 html 게임이 실행되지 않아요. 웹 링크로 받아 주세요.

※ 「포켓셀즈 게임마크.png」는 로고 그림이에요. 실행은 html 파일로 합니다.
※ 압축을 푼 뒤 실행하세요. 압축 파일 안에서 바로 열면 기록이 저장되지 않을 수 있어요.

[조작 · 휴대폰]
  화면 왼쪽 아래를 손가락으로 끌기   이동 (아래로 끌고 점프 = 발판 내려가기)
  오른쪽 버튼     점프 · Z(기본 공격) · X · C(스킬) · 대시 · 교대 · Z기술 · 메가
  위쪽 버튼       가방 · 지도 · Ⅱ 일시정지

[조작 · 키보드]
  ← →            이동
  Space / ↑      점프 (공중에서 한 번 더 = 2단 점프)
  ↓ + Space      발판 아래로 내려가기
  Z · X · C      스킬 (Z 연타 = 콤보)
  Shift          대시 회피 (잠깐 무적)
  Tab · E · 1~3  포켓몬 교대 (등장 순간 교체 스킬 발동)
  Q              Z기술 (제2구역 보스의 Z크리스탈을 얻은 뒤)
  V              메가진화 (3단 진화 + 제3구역 보스의 메가스톤, 끝까지 유지)
  F / ↑          포켓몬센터 치료 · 자판기 · 표지판 읽기 · 기술머신
  ↓ + Space      철창(↓ 지하) 위에서 지하 길로 내려가기
  M · I          지도 · 가방(파티 능력치·아이템)
  Esc            일시정지 · N 소리 끄기/켜기

[알아두면 좋은 것]
- 타입 상성이 적용됩니다. 약한 상대를 만나면 교대하세요.
- 적을 정화하면 그때 싸우던 포켓몬이 경험치를 받아 진화해요 (1단 → 2단 → 3단 → 메가). 포켓몬마다 따로 커요.
- 주운 아이템은 싸우던 포켓몬이 장착하고, 가방(I)에서 다른 포켓몬에게 옮길 수 있어요.
- 각 구역 가운데의 포켓몬센터에서 파티 체력을 모두 회복할 수 있어요.
- 길은 두 갈래예요. 지상으로 가도 되고, 철창에서 지하로 내려가도 돼요 (지하엔 보물 상자). 어느 쪽이든 앞으로만 가면 됩니다.
- 던전의 적은 무한다이노에게 세뇌된 포켓몬이에요. 10번 정화하면 도감에 등록되어 다음 판부터 쓸 수 있어요.
- 던전에 들어가면 인트로 컷신이 나와요. ESC·Space 또는 오른쪽 위 버튼으로 건너뛸 수 있어요.
- 기록은 이 PC의 브라우저에만 저장됩니다.
- 휴대폰은 가로 화면에서 플레이하세요.

[테스트 후 알려 주세요]
- 어려웠던/쉬웠던 구간, 버그, 답답했던 조작

개인·비상업 팬게임 테스트판입니다. 외부 공유·게시는 하지 말아 주세요.
포켓몬 스프라이트: PMDCollab/SpriteCollab (CC BY-NC 4.0) · 글꼴: Galmuri · Pretendard · Cinzel (모두 SIL OFL 1.1)
아이템 그림: 본가 가방 아이콘 (Serebii 아이템 도감에서 받음)
포켓몬 이름·캐릭터·아이템 그림의 권리는 Nintendo/Creatures/GAME FREAK 에 있습니다.
`;

async function main() {
  const html = await readFile(path.join(ROOT, '포켓셀즈-테스트.html'));
  const mark = await readFile(path.join(ROOT, 'brand', 'pokecells-mark.png'));
  const readme = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(README.replace(/\r?\n/g, '\r\n'), 'utf8')]);   // 메모장 호환: BOM + CRLF
  const zip = makeZip([
    { name: FOLDER },
    { name: `${FOLDER}▶ 게임 시작하기.html`, data: html },
    { name: `${FOLDER}포켓셀즈 게임마크.png`, data: mark },
    { name: `${FOLDER}읽어주세요.txt`, data: readme }
  ]);
  await writeFile(OUT, zip);
  console.log(`완료: ${path.basename(OUT)} (${((await stat(OUT)).size / 1024).toFixed(0)}KB)`);
  // 웹 호스팅(itch.io·Netlify 등) 업로드용: 최상위에 index.html 하나 → 아이폰 등은 링크로 접속
  const webZip = makeZip([{ name: 'index.html', data: html }]);
  await writeFile(WEB_OUT, webZip);
  console.log(`완료: ${path.basename(WEB_OUT)} (${((await stat(WEB_OUT)).size / 1024).toFixed(0)}KB)`);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
