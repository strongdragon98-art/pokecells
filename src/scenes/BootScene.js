import Phaser from 'phaser';
import { SpriteLoader } from '../systems/SpriteLoader.js';
import { generateBaseTextures, composeSkillIcons } from '../systems/Textures.js';
import { txt, GAME_W, GAME_H, uiCamera } from '../config.js';

const RETRY_KEY = 'pokecells.bootRetry';

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    uiCamera(this);
    const w = GAME_W, h = GAME_H;
    this.add.text(w / 2, h / 2 - 24, '포켓 셀즈', txt(18, '#efeae0', { fontStyle: 'bold' })).setOrigin(.5).setLetterSpacing(6);
    this.add.rectangle(w / 2, h / 2 + 4, 200, 1, 0xefeae0, .25);
    const bar = this.add.rectangle(w / 2 - 100, h / 2 + 4, 0, 1, 0xefeae0, .95).setOrigin(0, .5);
    this.status = this.add.text(w / 2, h / 2 + 22, '불러오는 중…', txt(10, '#9a96ac')).setOrigin(.5);
    this.load.on('progress', v => { bar.width = 200 * v; });
    this.errors = [];
    this.load.on('loaderror', f => { this.errors.push(String(f.src || f.key).replace(/^.*?assets\//, '')); console.warn('[asset] 불러오기 실패', f.key, f.src); });
    this.loader = new SpriteLoader(this);
    this.embed = window.__POKECELLS_EMBED || null;   // 단일 HTML 빌드면 파일 안의 에셋을 쓴다
    if (!this.embed) this.loader.preload();
  }

  async create() {
    if (this.embed) {
      try { await this.loader.loadEmbedded(this.embed); }
      catch (e) { this.status.setText('내장 에셋을 읽지 못했습니다.').setColor('#ff8a8a'); console.error(e); return; }
    }
    if (!this.loader.manifest) {
      this.status.setText('assets/manifest.json 이 없습니다.\n터미널에서 npm run fetch-assets 를 먼저 실행하세요.').setColor('#ff8a8a').setAlign('center');
      return;
    }
    const meta = this.loader.registerAll();
    const missing = ['charmander', 'squirtle', 'bulbasaur'].filter(k => !meta[k] || !meta[k].hasSprite);
    if (missing.length) {
      // 일시적인 로딩 실패일 수 있으니 한 번은 자동으로 새로고침해 다시 시도한다
      let retried = false;
      try { retried = sessionStorage.getItem(RETRY_KEY) === '1'; if (!retried) sessionStorage.setItem(RETRY_KEY, '1'); } catch (e) { retried = true; }
      if (!retried) { this.status.setText('스프라이트를 다시 불러오는 중…'); setTimeout(() => location.reload(), 400); return; }
      // 원인을 화면에 그대로 보여 준다 (어느 포켓몬의 어떤 파일이 빠졌는지)
      const detail = missing.map(k => {
        const xml = !!this.loader.data[k], sheets = Object.keys(this.textures.list).filter(t => t.startsWith(`sheet:${k}:`)).length;
        return `${k}: 모션정보 ${xml ? 'O' : 'X'} · 시트 ${sheets}장`;
      }).join('\n');
      const fails = this.errors.length ? `\n불러오기 실패 ${this.errors.length}개 (예: ${this.errors.slice(0, 2).join(', ')})` : '';
      const mode = this.embed ? '단일 HTML' : `개발 서버 ${location.host}`;
      this.status.setText(`스타팅 포켓몬 스프라이트를 불러오지 못했습니다 [${mode}]\n${detail}${fails}\nF5(새로고침)로 다시 시도하거나 npm run fetch-assets 를 실행하세요.`)
        .setColor('#ff8a8a').setAlign('center').setY(this.scale.height / 2 + 58);
      console.error('[boot] 스타팅 스프라이트 없음', { missing, errors: this.errors, data: Object.keys(this.loader.data), textures: Object.keys(this.textures.list).filter(t => t.startsWith('sheet:')).length });
      return;
    }
    try { sessionStorage.removeItem(RETRY_KEY); } catch (e) { /* 무시 */ }
    this.registry.set('spriteMeta', meta);
    this.registry.set('manifest', this.loader.manifest);
    await composeSkillIcons(this, this.loader.skillSvgs(this.embed));   // 못 받은 스킬은 아래에서 도트 아이콘으로 채운다
    generateBaseTextures(this);
    this.scene.start('Lobby');
  }
}
