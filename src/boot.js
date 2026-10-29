import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import LobbyScene from './scenes/LobbyScene.js';
import CutsceneScene from './scenes/CutsceneScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import { GAME_W, GAME_H, RES } from './config.js';
import { setupMobile } from './systems/Mobile.js';

// 개발 서버(main.js)와 단일 HTML 빌드(main-single.js)가 함께 쓰는 시작 함수
export async function startGame() {
  // 픽셀 폰트가 준비된 뒤 게임을 만들어야 텍스트가 대체 글꼴로 굳지 않는다
  try {
    await Promise.all([
      document.fonts.load('12px Galmuri11'),
      document.fonts.load('10px Galmuri9'),
      document.fonts.load('15px Galmuri14'),
      document.fonts.load("12px 'Pretendard'"),
      document.fonts.load("bold 12px 'Pretendard'"),
      document.fonts.load("15px 'Cinzel'")
    ]);
  } catch (e) { /* 글꼴을 못 불러와도 기본 글꼴로 진행 */ }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W * RES,     // 논리 640x360 × 렌더링 배율 (각 씬 카메라가 RES 만큼 확대)
    height: GAME_H * RES,
    backgroundColor: '#07060f',
    pixelArt: true,
    roundPixels: true,
    fps: { target: 60, smoothStep: true },
    render: { antialias: false, maxLights: 16 },
    physics: { default: 'arcade', arcade: { gravity: { y: 900 }, fps: 60, debug: false, tileBias: 20 } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },   // 16:9 를 화면(안전 영역)에 꽉 맞추고 가운데로 — 회전·주소창 변화는 setupMobile 이 즉시 재계산
    input: { keyboard: true, mouse: true, touch: true, activePointers: 4 },   // 멀티터치: 이동하면서 점프·스킬·대시 동시에
    scene: [BootScene, LobbyScene, CutsceneScene, GameScene, UIScene]
  });
  window.__game = game;   // 개발 중 콘솔 확인용
  setupMobile(game);
  document.getElementById('boot')?.remove();
}
