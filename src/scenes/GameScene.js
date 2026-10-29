// 던전 전투 씬: 스테이지 생성, 광원, 방 잠금·웨이브, 보스, 드랍, 도감 등록
import Phaser from 'phaser';
import { ZOOM, RES, TILE } from '../config.js';
import { STAGES, areaLabel } from '../data/stages.js';
import { FORM_ITEMS } from '../data/roster.js';
import { WILD, DEX_ORDER, SPECIES, wildForm, pickWildStage, EXP_PURIFY, EXP_BOSS, DROPS, EVO_EXP, ZMOVES, BOSSES } from '../data/pokemon.js';
import { ITEMS, ITEM_KEYS, ITEM_DROP, CONSUMABLES, MAX_EQUIP } from '../data/items.js';
import { typeColor } from '../data/types.js';
import { PLAT_SET, groundYAt, T as TILE_ID } from '../game/Level.js';
import { buildChapter, roomAt, CW, CH } from '../game/World.js';

const ARENA_ZOOM = 1;   // 보스전 월드 배율 (평소 ZOOM 1.25 → 화면에 아레나가 더 많이 들어온다)
import { Props } from '../game/Props.js';
import { Player } from '../game/Player.js';
import { Enemy } from '../game/Enemy.js';
import { Boss } from '../game/Boss.js';
import { Trainer } from '../game/Trainer.js';

// 트레이너 대사 (난천 · 레드)
const TRAINER_LINES = {
  cynthia: { intro: '심연의 뜻대로… 너희를 지우겠어…', freed: '…! 나는… 무슨 짓을… 고마워. 창기둥으로 가는 길을 열어 줄게.', toast: '난천이 정신을 되찾았다 — 창기둥으로 가는 길이 열렸다' },
  red: { intro: '……', next: '……', freed: '……! ……고마워.', end: '……이제, 집에 가자.', toast: '레드를 묶고 있던 실이 끊어졌다' }
};
import { Combat, overlap } from '../game/Combat.js';
import { Fx } from '../systems/Fx.js';
import { Sfx } from '../systems/Audio.js';
import { Music } from '../systems/Music.js';
import { Settings } from '../systems/Settings.js';
import { Save } from '../systems/Save.js';
import { RunSave, seeded, newSeed, snapshotWorld, applyWorld, snapshotPlayer, restorePlayer } from '../systems/RunSave.js';
import { itemArt, shade } from '../systems/Textures.js';
import { rollCards, applyCard } from '../data/tm.js';
import { onKill as perkKill } from '../game/Perks.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.resume = (data && data.resume) || null;   // 로비의 '이어하기': systems/RunSave.js 의 저장 내용
    this.partyKeys = this.resume ? this.resume.player.members.map(m => m.key) : data && data.party && data.party.length ? data.party : Save.data.party;
  }

  create() {
    this.stageIdx = 0;                     // 지금 챕터(지방) 번호
    this.worlds = [];                      // 챕터마다 한 번 만든 월드 (아머까오로 돌아오면 그대로)
    this.unlockedHubs = [];                // 들른 시내 = 아머까오 공중날기 목적지 { ci, roomId, name }
    this.lastCenter = null;                // 쓰러지면 다시 일어날 포켓몬센터
    this.runStats = { kills: 0, unlocked: [], start: this.time.now, items: 0, stage: 1 };
    this.seeds = [];                       // 챕터마다 지형 시드 (저장·이어하기에서 같은 지형을 다시 만든다)
    const rs = this.resume;
    this.savedWorlds = rs ? rs.worlds.slice() : null;   // 챕터마다 저장해 둔 바뀐 것 (worldOf 가 그 챕터를 만들 때 덮어쓴다)
    if (rs) {
      this.stageIdx = rs.stageIdx; this.seeds = rs.seeds.slice(); this.unlockedHubs = rs.hubs.slice(); this.lastCenter = rs.lastCenter;
      Object.assign(this.runStats, { kills: rs.stats.kills, unlocked: rs.stats.unlocked.slice(), items: rs.stats.items, start: this.time.now - rs.stats.time * 1000 });
    }
    this.webgl = this.renderer.type === Phaser.WEBGL;
    this.enemies = []; this.pickups = []; this.chests = []; this.worldObjs = [];
    this.inp = {}; this.paused = false; this.transitioning = false; this.over = false; this.cleaned = false;
    this.dynLights = 0;
    this.keys = this.input.keyboard.addKeys('ONE,TWO,THREE,ESC,P,F2,F3,F4,N');   // 바꿀 수 없는 키 (나머지는 설정 → 키 설정, bindKeys)
    this.bindKeys();
    const offKeys = Settings.on(k => { if (k === 'keys') this.bindKeys(); });
    this.events.once('shutdown', offKeys);
    this.input.keyboard.addCapture('TAB,SPACE,UP,DOWN,LEFT,RIGHT,F2,F3,F4');
    this.input.keyboard.on('keydown', () => Sfx.unlock());
    this.input.on('pointerdown', () => Sfx.unlock());

    const cam = this.cameras.main;
    cam.setZoom(ZOOM * RES).setBackgroundColor('#07060f').setRoundPixels(true);
    if (this.webgl) {
      this.lights.enable();
      cam.postFX.addBloom(0xffffff, 1, 1, 1.1, .85, 2);
      cam.postFX.addVignette(.5, .5, .92, .3);
    }
    this.fx = new Fx(this);
    this.corruptG = this.add.graphics().setDepth(18);                                          // 세뇌된 적 발밑 침식 오라
    this.eyeTrailG = this.add.graphics().setDepth(23).setBlendMode(Phaser.BlendModes.ADD);     // 붉은 안광 궤적
    this.combat = new Combat(this);
    this.buildWorld(rs ? rs.pos : null);
    if (rs) { restorePlayer(this.player, rs.player); this.resume = null; }
    this.scene.launch('UI');
    this.scene.bringToTop('UI');
    cam.fadeIn(350, 7, 6, 15);
    this.events.once('shutdown', () => this.cleanup());
  }

  // ---------------- 월드 구성 ----------------
  // 챕터(지방) 하나 = 메트로배니아식 2D 월드 (game/World.js). 한 번 만든 챕터는 기억해 두고, 아머까오로 돌아오면 그대로 다시 깐다
  //  (부순 벽 · 연 상자 · 정화한 보스 · 걷힌 흙 · 주운 상처약 · 탐험한 칸). 적은 들어올 때마다 다시 나온다.
  //  at: { x, y } 도착 자리 (없으면 챕터 입구)
  //  지형은 챕터 시드로 만든다 (같은 시드 = 같은 지형). 이어하기면 저장해 둔 바뀐 것(연 상자·정화한 보스 등)을 덮어쓴다
  worldOf(ci) {
    if (this.worlds[ci]) return this.worlds[ci];
    const seed = this.seeds[ci] ?? (this.seeds[ci] = newSeed());
    const W = { seed, level: seeded(seed, () => buildChapter(STAGES[ci], ci)), explored: null, areasSeen: new Set() };
    const saved = this.savedWorlds && this.savedWorlds[ci];
    if (saved && !applyWorld(W, saved)) this.savedWorlds[ci] = null;   // 게임이 바뀌어 지형이 달라졌으면 그 챕터는 처음 상태로
    return (this.worlds[ci] = W);
  }
  buildWorld(at = null) {
    this.clearWorld();
    const si = this.stageIdx, st = STAGES[si], W = this.worldOf(si), level = W.level;
    this.stage = st; this.runStats.stage = si + 1;
    this.level = level;
    this.explored = W.explored || (W.explored = new Uint8Array(level.cols * level.rows));   // 지도: 화면에 한 번이라도 들어온 칸
    this.exploredKey = '';
    // 방마다 작은 타일 지도 (빈 셀까지 큰 지도 하나로 만들면 타일 객체가 너무 많아진다)
    const tsKey = `tiles:${si}`;
    this.layers = [];
    for (const r of level.rooms) {
      const map = this.make.tilemap({ data: level.data.slice(r.Y0, r.Y1).map(row => row.slice(r.X0, r.X1)), tileWidth: TILE, tileHeight: TILE });
      const ts = map.addTilesetImage(tsKey, tsKey, TILE, TILE, 0, 0);
      const layer = map.createLayer(0, ts, r.X0 * TILE, r.Y0 * TILE).setDepth(10);
      layer.forEachTile(t => {
        if (PLAT_SET.has(t.index)) t.setCollision(false, false, true, false);   // 통과 발판: 위에서만 밟힌다
        else if (t.index >= 0) t.setCollision(true, true, true, true);
      });
      if (this.webgl) layer.setPipeline('Light2D');
      r.map = map; r.ts = ts; r.layer = layer;
      this.layers.push(layer);
    }
    if (this.webgl) this.lights.setAmbientColor(st.palette.ambient);
    this.ambient = Phaser.Display.Color.ValueToColor(st.palette.ambient).clone();
    // 방 사이 빈 셀은 단단한 암반 (오돌토돌한 점) · 지하 방 안쪽엔 동굴 벽 배경
    const rock = this.add.graphics().setDepth(1.5), rc = shade(st.palette.wall2, .55);
    for (let cy = 0; cy < level.ncy; cy++) for (let cx = 0; cx < level.ncx; cx++) {
      if (level.cellRoom.has(cx + ',' + cy)) continue;
      const x0 = cx * CW * TILE, y0 = cy * CH * TILE;
      rock.fillStyle(rc, 1); rock.fillRect(x0, y0, CW * TILE, CH * TILE);
      for (let k = 0; k < 40; k++) { rock.fillStyle(k % 3 ? shade(rc, 1.25) : shade(rc, .7), 1); rock.fillRect(x0 + ((k * 97 + cx * 31) % (CW * TILE)), y0 + ((k * 61 + cy * 17) % (CH * TILE)), 2, 2); }
    }
    this.worldObjs.push(rock);
    for (const r of level.rooms) if (r.under) this.worldObjs.push(this.add.tileSprite(r.left - 32, r.top - 32, r.right - r.left + 64, r.bottom - r.top + 64, `bgcave:${si}`).setOrigin(0).setDepth(2));
    // 상처약·페이크 굴: 안쪽엔 어두운 흙벽을 깔고, 들어서기 전까지는 흙 타일로 덮어 둔다 (환영 벽 너머 숨은 굴)
    this.covers = [];
    const back = this.add.graphics().setDepth(9.5);
    for (const sd of level.sides) {
      for (const [x, y] of sd.cells) {
        back.fillStyle(0x15111c, 1); back.fillRect(x * TILE, y * TILE, TILE, TILE);
        for (let k = 0; k < 3; k++) { back.fillStyle(k ? 0x1d1826 : 0x0c0a12, 1); back.fillRect(x * TILE + ((x * 7 + y * 3 + k * 5) % 14), y * TILE + ((x * 3 + y * 11 + k * 7) % 14), 2, 2); }
      }
      if (sd.revealed) continue;
      const layers = new Map();
      for (const [x, y] of sd.cells) {
        const r = level.cellRoom.get(Math.floor(x / CW) + ',' + Math.floor(y / CH));
        if (!r || !r.map) continue;
        if (x < r.X0 || y < r.Y0 || x - r.X0 >= r.map.width || y - r.Y0 >= r.map.height) continue;   // 방 지도 밖으로 삐져나온 굴 칸 (가끔 생긴다) — 덮지 않고 넘어간다
        let cl = layers.get(r);
        if (!cl) { cl = r.map.createBlankLayer(`cover${this.covers.length}_${r.id}`, r.ts, r.X0 * TILE, r.Y0 * TILE).setDepth(10.2); if (this.webgl) cl.setPipeline('Light2D'); layers.set(r, cl); }
        cl.putTileAt(TILE_ID.SOLID, x - r.X0, y - r.Y0);
      }
      this.covers.push({ sd, layers: [...layers.values()] });
    }
    this.worldObjs.push(back);
    // 부서지는 벽: 금 간 자국 (공격·투사체로 3번 치면 무너진다)
    this.breakG = this.add.graphics().setDepth(10.4);
    this.worldObjs.push(this.breakG);
    this.drawBreakables();
    this.props = new Props(this, level, st, si);
    this.physics.world.setBounds(0, 0, level.width, level.height + 200);

    // 패럴랙스 배경 (보스전에서 가장 멀리 당긴 줌 기준으로도 화면을 채우도록 배치)
    const cw = this.cameras.main.width, ch = this.cameras.main.height, z = ARENA_ZOOM * RES;
    const vw = cw / z + 24, vh = ch / z + 24, ox = cw / 2 - vw / 2, oy = ch / 2 - vh / 2;
    this.bgFar = this.add.tileSprite(ox, oy, vw, vh, `bgfar:${si}`).setOrigin(0).setScrollFactor(0).setDepth(0);
    this.worldObjs.push(this.bgFar);
    // 중경은 지역 배경 종류마다 한 장씩 깔아 두고, 지역을 넘을 때 겹쳐 바꾼다
    this.bgMids = {};
    for (const kind of new Set(st.areas.map(a => a.bg || 'default'))) {
      const t = this.add.tileSprite(ox, oy, vw, vh, `bgmid:${si}:${kind}`).setOrigin(0).setScrollFactor(0).setDepth(1).setAlpha(0);
      this.bgMids[kind] = t; this.worldObjs.push(t);
    }
    this.areaIdx = -1; this.areasSeen = W.areasSeen;

    // 관문: 아레나(중간 보스 · 최종 보스 · 히든 성소)의 문마다 하나. 보스전이 시작되면 닫히고, 정화하면 열린다
    this.gateGroup = this.physics.add.staticGroup();
    this.gateG = this.add.graphics().setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    this.worldObjs.push(this.gateG);
    this.gates = [];
    for (const r of level.rooms) if (!r.cleared && (r.type === 'mini' || r.type === 'boss' || r.type === 'sanctuary')) this.addArenaGates(r);

    // 횃불(네온 수정) + 광원
    this.torches = [];
    for (const r of level.rooms) for (const t of r.torches) {
      const glow = this.add.image(t.x, t.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(st.palette.light).setScale(.6).setAlpha(.7).setDepth(11);
      const crystal = this.add.rectangle(t.x, t.y, 3, 6, st.palette.accent).setDepth(11);
      const light = this.webgl ? this.lights.addLight(t.x, t.y + 10, 130, st.palette.light, 1.3) : null;
      this.torches.push({ glow, crystal, light, phase: Math.random() * 10 });
      this.worldObjs.push(glow, crystal);
    }

    // 보물 상자 · 상처약 (연 상자·주운 약은 그대로 남아 있다)
    for (const c of level.chests) this.spawnChest(c);
    for (const pt of level.potions) {
      if (pt.taken) continue;
      const pk = this.spawnPickup('potion', pt.x, pt.y - 10, null, true), sd = level.sides.find(q => q.room === pt.room);
      pk.mark = pt; pk.hiddenBy = sd;
      if (sd && !sd.revealed) { pk.img.setVisible(false); pk.glow.setVisible(false); }   // 흙이 걷히기 전엔 안 보인다
    }

    // 플레이어
    const pos = at || level.start;
    if (!this.player) {
      this.player = new Player(this, this.partyKeys, pos.x, pos.y);
      if (this.webgl) this.playerLight = this.lights.addLight(pos.x, pos.y, 150, 0xffffff, 1.5);
    } else {
      this.player.b.reset(pos.x, pos.y); this.player.b.setVelocity(0, 0);
    }
    this.playerColliders = [
      this.physics.add.collider(this.player.obj, this.layers, null, (o, tile) => !(PLAT_SET.has(tile.index) && this.player.dropT > 0)),
      this.physics.add.collider(this.player.obj, this.gateGroup)
    ];

    const cam = this.cameras.main;
    cam.setBounds(0, 0, level.width, level.height);
    cam.startFollow(this.player.obj, true, .14, .16);
    cam.setFollowOffset(0, 10);
    cam.centerOn(pos.x, pos.y);
    for (const sp of level.spawns) sp.spawned = false;   // 챕터에 들어올 때마다 적이 다시 나온다
    this.room = roomAt(level, pos.x, pos.y - 4) || level.start.room;
    this.boss = null; this.bosses = []; this.portal = null; this.lowSeen = false;
    this.events.emit('stage', si, st);
    Music.play(st.bgm);
    this.time.delayedCall(450, () => { if (this.level === level) { this.enterArea(this.room, true); if (this.room.type === 'village') this.visitHub(this.room); } });
  }

  // 새 지역에 들어서면: 배경을 겹쳐 바꾸고, 처음이면 할로우 나이트식 지역 타이틀
  enterArea(room, instant = false) {
    if (!room || room.ai === this.areaIdx) return;
    this.areaIdx = room.ai;
    const st = this.stage, area = st.areas[room.ai], kind = area.bg || 'default';
    for (const [k, t] of Object.entries(this.bgMids)) {
      this.tweens.killTweensOf(t);
      if (instant) t.setAlpha(k === kind ? .95 : 0);
      else this.tweens.add({ targets: t, alpha: k === kind ? .95 : 0, duration: 1100, ease: 'Sine.easeInOut' });
    }
    if (this.areasSeen.has(room.ai)) return;
    this.areasSeen.add(room.ai);
    this.events.emit('area', { region: st.name, name: area.name, en: area.en, label: areaLabel(this.stageIdx, room.ai, area) });
  }

  clearWorld() {
    const dropCollider = c => { if (c && c.world) c.destroy(); };   // 이미 해제된 충돌체는 건너뜀
    if (this.trainer) { this.trainer.destroy(); this.trainer = null; }
    this.arenaRoom = null; this.chain = null;
    if (this.combat) this.combat.clearAll();
    for (const e of this.enemies) { (e.colliders || []).forEach(dropCollider); e.colliders = []; e.destroy(); }
    this.enemies = [];
    if (this.corruptG && this.corruptG.scene) { this.corruptG.clear(); this.eyeTrailG.clear(); }
    for (const p of this.pickups) { dropCollider(p.coll); p.img.destroy(); p.glow.destroy(); }
    this.pickups = [];
    for (const c of this.chests) { c.img.destroy(); c.glow.destroy(); }
    this.chests = [];
    for (const o of this.worldObjs) o.destroy();
    this.worldObjs = [];
    if (this.portal) { this.portal.g.destroy(); this.portal.glow.destroy(); this.portal = null; }
    if (this.props) { this.props.destroy(); this.props = null; }
    if (this.promptText) { this.promptText.destroy(); this.promptText = null; }
    if (this.torches && this.webgl) for (const t of this.torches) if (t.light) this.lights.removeLight(t.light);
    this.torches = [];
    if (this.playerColliders) { this.playerColliders.forEach(dropCollider); this.playerColliders = null; }
    if (this.gateGroup) { this.gateGroup.destroy(true); this.gateGroup = null; }
    this.gates = [];
    if (this.level) for (const r of this.level.rooms) { if (r.map) r.map.destroy(); r.map = r.layer = r.ts = null; }
    this.layers = [];
    this.covers = [];
    if (this.fx) this.fx.clearAll();   // 남은 파티클·파편은 풀로 돌려놓는다
    this.tmOpening = false;
    this.dropStaleTweens();
  }

  // 대상이 이미 사라진(destroy 된) 트윈 정리: 챕터를 오가며 쌓이지 않게
  dropStaleTweens() {
    if (!this.tweens) return;
    for (const tw of this.tweens.getTweens()) {
      const ts = tw.targets || [];
      if (ts.length && ts.every(o => o && typeof o.destroy === 'function' && !o.scene)) tw.remove();
    }
  }

  // 로비로 나가기 전에 한 번, 씬 종료 이벤트에서 한 번 더 불려도 안전하다
  cleanup() {
    if (this.cleaned) return;
    this.cleaned = true;
    Music.stop();
    this.clearWorld();
    if (this.player) { this.player.destroy(); this.player = null; }
    if (this.fx) { this.fx.pool.destroy(); this.fx.tpool.destroy(); }
    if (this.time) this.time.removeAllEvents();
    if (this.webgl && this.lights && this.lights.lights) this.lights.lights.slice().forEach(l => this.lights.removeLight(l));
    this.dynLights = 0;
    if (this.physics && this.physics.world) this.physics.world.resume();
    this.anims.resumeAll();
    if (this.tweens) this.tweens.resumeAll();
  }

  // 아레나 문마다 관문 (처음엔 열려 있다)
  addArenaGates(r) {
    for (const d of r.doors) {
      const rect = d.dir === 'h' ? { x: d.R === r ? r.left : r.right - 6, y: d.rect.y, w: 6, h: d.rect.h } : (d.D === r ? d.rectD : d.rectU);
      const g = this.gateGroup.create(rect.x + rect.w / 2, rect.y + rect.h / 2, 'px').setVisible(false).setDisplaySize(rect.w, rect.h).refreshBody();
      g.open = true; g.body.enable = false; g.room = r; g.rect = rect; g.vertical = d.dir === 'h';
      this.gates.push(g);
    }
  }
  // 아레나 문 닫기·열기
  setGates(room, open) {
    let changed = false;
    for (const g of this.gates) {
      if (g.room !== room || g.open === open) continue;
      g.open = open; g.body.enable = !open; changed = true;
      if (!open) this.fx.burst(g.rect.x + g.rect.w / 2, g.rect.y + g.rect.h / 2, this.stage.palette.edge, 10, 80, { glow: true });
    }
    if (changed && !open) Sfx.play('gate');
  }

  // ---------------- 타일 조회 도우미 (월드 격자 문자) ----------------
  cellAt(x, y) {
    const lv = this.level; if (!lv) return '.';
    const ty = Math.floor(y / TILE), tx = Math.floor(x / TILE);
    if (ty < 0) return '.';
    if (tx < 0 || tx >= lv.cols || ty >= lv.rows) return 'S';
    return lv.grid[ty][tx];
  }
  isSolidAt(x, y) { const c = this.cellAt(x, y); return c === 'S' || c === 'B'; }
  isGroundAt(x, y) { const c = this.cellAt(x, y); return c === 'S' || c === 'B' || c === 'P' || c === 'H'; }
  standingOnPlatform(a) {
    const y = a.bottom + 2; let plat = false;
    for (const x of [a.b.x + 2, a.b.right - 2]) { const c = this.cellAt(x, y); if (c === 'S' || c === 'B') return false; if (c === 'P' || c === 'H') plat = true; }
    return plat;
  }
  groundBelow(x, y) {
    const gy = groundYAt(this.level, x, Math.max(0, y));
    return gy ?? y + 40;
  }

  // ---------------- 부서지는 벽 ----------------
  drawBreakables() {
    const g = this.breakG; if (!g) return;
    g.clear();
    for (const b of this.level.breakables) {
      if (b.broken) continue;
      for (const [x, y] of b.cells) {
        const px = x * TILE, py = y * TILE, k = (x * 13 + y * 7) % 5;
        g.lineStyle(1, 0x0a0812, .55); g.lineBetween(px + 3 + k, py + 2, px + 8 + k, py + 9); g.lineBetween(px + 8 + k, py + 9, px + 6, py + 14);
        g.lineStyle(1, this.stage.palette.edge, .14 + (3 - b.hp) * .12); g.lineBetween(px + 4 + k, py + 2, px + 9 + k, py + 9);
      }
    }
  }
  // 플레이어 공격 범위가 부서지는 벽에 닿으면 금이 더 가고, 세 번째에 무너진다
  hitBreakables(rect) {
    if (!this.level) return;
    const r = { x: rect.x - 6, y: rect.y - 6, w: rect.w + 12, h: rect.h + 14 };   // 발밑 철창 자리(바닥 벽)도 땅을 긋는 공격에 닿게
    for (const b of this.level.breakables) {
      if (b.broken || !overlap(r, b.rect)) continue;
      if (this.time.now - (b.lastHit || 0) < 220) continue;
      b.lastHit = this.time.now; b.hp--;
      this.fx.burst(rect.x + rect.w / 2, rect.y + rect.h / 2, [0x8a7a62, 0x4a4036, 0xd8d0c0], 8, 120, { up: 60 });
      this.fx.shake(.004, 80); Sfx.play('crack');
      if (b.hp <= 0) this.breakWall(b); else this.drawBreakables();
    }
  }
  breakWall(b) {
    const lv = this.level;
    b.broken = true;
    for (const [x, y] of b.cells) { lv.grid[y][x] = '.'; lv.data[y][x] = -1; }
    // 무너진 칸과 이웃 칸의 타일 모양을 다시 맞춘다
    const touched = new Set();
    for (const [x, y] of b.cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) touched.add((x + dx) + ',' + (y + dy));
    for (const k of touched) {
      const [x, y] = k.split(',').map(Number);
      if (x < 0 || y < 0 || x >= lv.cols || y >= lv.rows) continue;
      const r = lv.cellRoom.get(Math.floor(x / CW) + ',' + Math.floor(y / CH)); if (!r || !r.layer) continue;
      const idx = lv.tileOf(x, y); lv.data[y][x] = idx;
      if (idx < 0) r.layer.removeTileAt(x - r.X0, y - r.Y0);
      else { const t = r.layer.putTileAt(idx, x - r.X0, y - r.Y0); if (t) { if (PLAT_SET.has(idx)) t.setCollision(false, false, true, false); else t.setCollision(true, true, true, true); } }
    }
    const cx = b.rect.x + b.rect.w / 2, cy = b.rect.y + b.rect.h / 2;
    this.fx.shatter(cx, cy, b.rect.w, b.rect.h, { n: 18, speed: 160 });
    this.fx.burst(cx, cy, [0x8a7a62, 0x4a4036, 0x2a2420], 24, 160, { up: 80 });
    this.fx.shake(.012, 260); Sfx.play('boom');
    this.events.emit('toast', '벽이 무너졌다! 숨겨진 길이 열렸다');
    this.drawBreakables();
  }

  // ---------------- 입력 ----------------
  // 설정의 조작키(Settings.keys)로 키 객체를 다시 만든다 — 설정에서 키를 바꾸면 바로
  bindKeys() {
    const kb = this.input.keyboard;
    this.bind = {};
    for (const [act, name] of Object.entries(Settings.get('keys'))) this.bind[act] = kb.addKey(name);
  }

  readInput() {
    const k = this.keys, b = this.bind, JD = Phaser.Input.Keyboard.JustDown, i = this.inp;
    if (this.keyCapture) {   // 설정에서 새 키를 기다리는 중: 누른 키가 게임(지도 열기 등)으로 새지 않게 모두 삼킨다
      for (const key of [...Object.values(b), ...Object.values(k)]) JD(key);
      if (this.keyCapture === 'last') this.keyCapture = false;   // 방금 받은 키(Esc 취소 포함)까지 삼키고 끝
      return;
    }
    i.left = b.left.isDown; i.right = b.right.isDown; i.up = b.up.isDown; i.down = b.down.isDown;
    i.jumpH = b.jump.isDown || b.up.isDown;
    const upP = JD(b.up);   // JustDown 은 한 번 읽으면 꺼지므로 점프·상호작용이 같이 쓴다
    if (JD(b.jump) || upP) i.jumpP = true;
    if (upP) i.upP = true;   // ↑ 는 점프지만 포켓몬센터·자판기 앞에서는 상호작용
    if (JD(b.dash)) i.dashP = true;
    if (JD(b.z)) i.zP = true;
    if (JD(b.x)) i.xP = true;
    if (JD(b.c)) i.cP = true;
    if (JD(b.swap) || JD(b.swap2)) i.swapNext = true;
    if (JD(b.zmove)) i.zmoveP = true;   // Z기술 (Z크리스탈 획득 후)
    if (JD(k.ONE)) i.s1 = true;
    if (JD(k.TWO)) i.s2 = true;
    if (JD(k.THREE)) i.s3 = true;
    if (JD(b.mega)) i.mega = true;
    if (JD(b.interact)) i.useP = true;
    const t = this.touchInput;   // 모바일 터치 조작 (UIScene 의 TouchControls)
    if (t) {
      i.left = i.left || t.left; i.right = i.right || t.right; i.up = i.up || t.up; i.down = i.down || t.down; i.jumpH = i.jumpH || t.jumpH;
      for (const f in t.pressed) if (t.pressed[f]) i[f] = true;
      t.pressed = {};
    }
    i.downAim = b.down.isDown || !!(t && t.on !== false && t.downAim);   // 하향 점프 판정용 '아래' (키보드 ↓ · 조이스틱 아래 ±45°)
    if (JD(k.ESC) || JD(k.P)) this.togglePause();
    if (JD(b.map) || i.mapP) this.toggleOverlay('map');
    if (JD(b.bag) || i.invP) this.toggleOverlay('inv');
    if (JD(b.settings)) this.toggleOverlay('settings');
    i.mapP = false; i.invP = false;
    if (JD(k.N)) { Sfx.on = !Sfx.on; this.events.emit('toast', Sfx.on ? '소리 켬' : '소리 끔'); }
    if (JD(k.F2)) this.debugToBoss();
    if (JD(k.F3)) this.toggleOverlay('debug');   // 챕터·보스 셀렉트 디버그 패널
    if (JD(k.F4)) this.debugGrow();
  }

  // ---------------- 지도(M) · 가방(I): 게임을 멈추고 UI 가 그린다 ----------------
  toggleOverlay(kind) {
    if (this.over || this.transitioning) return;
    if ((this.overlay === 'tm' || this.overlay === 'taxi' || this.overlay === 'debug') && kind !== this.overlay) return;   // 카드·공중날기·디버그 창이 열려 있으면 다른 창으로 넘어가지 않는다
    if (this.overlay === kind) { this.overlay = null; this.setFrozen(false); this.consumeInput(); this.player.zBuf = 0; this.events.emit('overlay', null); return; }   // 지도에서 누른 Z(확대)가 공격으로 새지 않게
    if (this.overlay) { this.overlay = kind; this.events.emit('overlay', kind); return; }   // 지도 ↔ 가방 바로 전환
    if (this.paused) return;
    this.overlay = kind; this.setFrozen(true); this.events.emit('overlay', kind);
    Sfx.play('select');
  }
  setFrozen(on) {
    this.paused = on;
    if (on) { this.physics.world.pause(); this.anims.pauseAll(); this.tweens.pauseAll(); }
    else { this.physics.world.resume(); this.anims.resumeAll(); this.tweens.resumeAll(); }
  }

  // 디버그(F4): 성장 한 단계씩 — 2단 진화 → Z크리스탈 → 3단 진화 → 메가스톤 + 메가진화
  debugGrow() {
    if (this.paused || this.over || this.transitioning) return;
    const p = this.player;
    if (p.tier === 0) p.addExp(EVO_EXP[0] - p.exp);
    else if (!p.z.has) this.collect({ kind: 'zcrystal' });
    else if (p.tier === 1) p.addExp(EVO_EXP[1] - p.exp);
    else if (!p.mega.active) { if (!p.mega.stones) this.collect({ kind: 'megastone' }); p.startMega(); }
    else p.z.cd = 0;
  }

  // 디버그(F2): 이 챕터 최종 보스방 앞으로 순간이동
  debugToBoss() {
    if (this.paused || this.over || this.transitioning || !this.level) return;
    const r = this.level.rooms.find(q => q.type === 'boss');
    if (r && !r.cleared) this.warpToRoom(this.stageIdx, r.id, '[디버그] 보스방 이동');
  }
  // 디버그 패널: 정화한 보스를 다시 싸울 수 있게 되돌린다 (관문도 다시 단다)
  debugRefight(ci, roomId) {
    const r = this.worldOf(ci).level.rooms.find(q => q.id === roomId);
    if (!r || !r.cleared || !(r.type === 'mini' || r.type === 'boss' || r.type === 'sanctuary')) return;
    r.cleared = false; r.entered = false;
    if (ci === this.stageIdx && this.gateGroup) this.addArenaGates(r);
  }
  // 디버그 패널: 다섯 지방의 시내를 전부 아머까오 목적지로
  debugUnlockHubs() {
    STAGES.forEach((st, ci) => {
      for (const h of this.worldOf(ci).level.hubs) if (!this.unlockedHubs.some(q => q.ci === ci && q.roomId === h.room.id)) this.unlockedHubs.push({ ci, roomId: h.room.id, name: h.name, region: st.region });
    });
    this.events.emit('toast', `[디버그] 공중날기 목적지 ${this.unlockedHubs.length}곳 해금`);
  }
  // 챕터 ci 의 방 roomId 왼쪽 안쪽 바닥으로 순간이동 (다른 챕터면 그 월드를 깐다). 아레나면 들어서는 순간 보스전
  warpToRoom(ci, roomId, msg = null) {
    if (this.over || this.transitioning) return;
    const lv = this.worldOf(ci).level, r = lv.rooms.find(q => q.id === roomId);
    if (!r) return;
    const x = r.left + 28, y = (groundYAt(lv, x, r.top + 4) ?? r.bottom) - 14;
    this.moveTo(ci, { x, y }, () => { if (msg) this.events.emit('toast', msg); });
  }
  // 같은 챕터면 순간이동, 다른 챕터면 월드를 바꿔 깐다 (어둡게 바뀌었다 밝아진다)
  moveTo(ci, pos, done) {
    if (this.overlay) { this.overlay = null; this.setFrozen(false); this.events.emit('overlay', null); }
    this.transitioning = true;
    const cam = this.cameras.main;
    cam.fadeOut(380, 7, 6, 15);
    cam.once('camerafadeoutcomplete', () => {
      this.resetArenaFight();
      for (const e of this.enemies) { (e.colliders || []).forEach(c => c.destroy()); e.destroy(); }
      this.enemies = [];
      if (ci !== this.stageIdx) { this.stageIdx = ci; this.buildWorld(pos); }
      else this.teleport(pos);
      cam.fadeIn(420, 7, 6, 15);
      this.transitioning = false;
      if (done) done();
    });
  }
  teleport(pos) {
    const p = this.player;
    p.b.reset(pos.x, pos.y); p.b.setVelocity(0, 0);
    this.cameras.main.centerOn(pos.x, pos.y);
    this.room = roomAt(this.level, pos.x, pos.y - 4) || this.room;
    this.enterArea(this.room, true);
    if (this.room.type === 'village') this.visitHub(this.room);   // 순간이동으로 바로 시내에 내려도 정거장 등록
  }
  // 하던 보스전은 처음부터 (문을 열고 보스를 치운다 — 다시 들어서면 새로 시작)
  resetArenaFight() {
    const r = this.arenaRoom;
    if (!r) return;
    const all = (this.bosses || []).slice();
    if (this.boss && !all.includes(this.boss)) all.push(this.boss);
    for (const q of all) { (q.colliders || []).forEach(c => c.destroy()); if (!q.gone) q.destroy(); }   // 먼저 정화돼 치워진 짝은 건너뛴다
    this.enemies = this.enemies.filter(e => !all.includes(e));
    if (this.trainer) { this.trainer.destroy(); this.trainer = null; }
    if (this.player && this.player.flipT > 0) this.player.flipT = .001;   // 뒤틀린 중력도 푼다
    this.boss = null; this.bosses = []; this.chain = null; this.arenaRoom = null; r.entered = false;
    this.setGates(r, true);
    this.unlockArena();
    this.combat.clearAll();
    this.events.emit('boss', null);
  }
  // 시내(포켓몬센터)에 처음 들르면 아머까오 목적지로 등록 + 쓰러졌을 때 다시 일어날 자리
  visitHub(room) {
    const ci = this.stageIdx;
    if (!this.unlockedHubs.some(h => h.ci === ci && h.roomId === room.id)) {
      this.unlockedHubs.push({ ci, roomId: room.id, name: room.city || room.area, region: STAGES[ci].region });
      this.time.delayedCall(2600, () => this.events.emit('toast', `${room.city || room.area} 아머까오 정거장 — 이제 어느 지방에서든 공중날기로 올 수 있다`));
      Sfx.play('heal');
    }
    this.lastCenter = { ci, roomId: room.id };
    this.saveRun(true);   // 포켓몬센터(시내)에 오면 자동 저장
  }

  // ---------------- 진행 저장 (systems/RunSave.js) ----------------
  // auto: 포켓몬센터 자동 저장 (조용히 작은 알림만) · 아니면 일시정지 메뉴의 '저장하기' → 저장했으면 true
  //  자리: 자동 저장은 그 시내 포켓몬센터 앞, 직접 저장은 마지막으로 밟은 땅 (보스전 중에는 저장하지 않는다)
  saveRun(auto = false, where = 'center') {
    if (this.over || !this.player || !this.level) return false;
    if (this.arenaRoom) { if (!auto) this.events.emit('toast', '보스전 중에는 저장할 수 없다'); return false; }
    const p = this.player, c = this.lastCenter;
    const pos = auto && c && c.ci === this.stageIdx ? this.hubPos(c) : { x: Math.round(p.safeX ?? p.x), y: Math.round(p.safeY ?? p.y) };
    const worlds = (this.savedWorlds || []).slice();
    this.worlds.forEach((W, ci) => { if (W) worlds[ci] = snapshotWorld(W); });
    const ok = RunSave.write({
      v: 1, at: Date.now(), stageIdx: this.stageIdx, stageName: this.stage.name, pos, seeds: this.seeds.slice(), worlds,
      hubs: this.unlockedHubs.slice(), lastCenter: c,
      stats: { kills: this.runStats.kills, unlocked: this.runStats.unlocked.slice(), items: this.runStats.items, time: (this.time.now - this.runStats.start) / 1000 },
      player: snapshotPlayer(p)
    });
    this.events.emit('saved', { ok, auto, where });
    return ok;
  }
  // 간이 포켓몬 회복기 연결: 마지막 부활 자리로 정하고 자동 저장 (반경에 들어설 때 · 작동할 때)
  linkTerminal(it, quiet = false) {
    if (this.arenaRoom || this.over) return;
    const ci = this.stageIdx, c = this.lastCenter, fresh = !(c && c.terminal && c.ci === ci && c.idx === it.idx);
    this.lastCenter = { ci, roomId: it.data.room.id, terminal: true, idx: it.idx, x: it.x - 22, y: it.y - 14 };
    if (fresh && !quiet) { Sfx.play('select'); this.fx.ring(it.x, it.y - 20, 30, 0x4affd8, 360); }
    this.saveRun(true, 'terminal');
  }
  // 간이 회복기 작동: 띠리리- 띠리! · 초록 치유 파동 · 파티 전원 체력·상태이상 100% 회복
  healAtTerminal(it) {
    const p = this.player;
    for (const m of p.members) { m.hp = m.maxhp; m.alive = true; }
    p.slowT = 0; p.windT = 0; if (p.flipT > 0) p.flipT = .001; p.buffs = p.buffs.filter(bf => bf.atk >= 1 && bf.speed >= 1 && bf.guard <= 1);
    Sfx.play('fieldheal');
    const cx = it.x, cy = it.y - 20;
    [0, 160, 320].forEach((d, i) => this.time.delayedCall(d, () => { this.fx.ring(cx, cy, 34 + i * 24, i % 2 ? 0x4affd8 : 0x7dff9a, 600); this.fx.glow(cx, cy, 40 + i * 10, 0x7dffb0, 420, .6); }));
    this.fx.burst(p.x, p.y, [0x7dff9a, 0x4affd8, 0xffffff], 30, 90, { glow: true, up: 70, grav: -40, bounce: false, life: 1 });
    this.cameras.main.flash(260, 200, 255, 220, true);
    this.events.emit('banner', '파티 전원 회복!', '간이 포켓몬 회복기 · 체력·상태이상 회복 · 자동 저장 완료');
    this.saveRun(true, 'terminal');
  }
  hubPos(h) {
    if (h.terminal) return { x: h.x, y: h.y };   // 간이 회복기 앞
    const hub = this.worldOf(h.ci).level.hubs.find(q => q.room.id === h.roomId);
    return { x: hub.x - 24, y: hub.y - 14 };
  }
  // 아머까오 공중날기: 들른 시내 아무 곳이나 (다른 지방이어도)
  travelTo(ci, roomId) {
    if (this.transitioning) return;
    const h = this.unlockedHubs.find(q => q.ci === ci && q.roomId === roomId);
    if (!h) return;
    Sfx.play('dash');
    this.moveTo(ci, this.hubPos(h), () => this.time.delayedCall(ci === this.stageIdx ? 0 : 1600, () => this.events.emit('toast', `아머까오 공중날기 — ${h.region} · ${h.name} 도착`)));
  }
  // 파티가 모두 쓰러지면: 마지막으로 들른 포켓몬센터에서 다시 일어난다 (아직 없으면 챕터 입구)
  respawn() {
    if (this.transitioning) return;
    const p = this.player, c = this.lastCenter;
    this.events.emit('banner', '눈앞이 캄캄해졌다…', c ? (c.terminal ? '마지막으로 연결한 간이 회복기 앞에서 다시 일어난다' : '마지막으로 들른 포켓몬센터로 돌아간다') : '챕터 입구로 돌아간다');
    for (const m of p.members) { m.hp = m.maxhp; m.alive = true; }
    p.inv = 2.5;
    Music.play(this.stage.bgm);
    const pos = c ? this.hubPos(c) : this.worldOf(this.stageIdx).level.start;
    this.moveTo(c ? c.ci : this.stageIdx, { x: pos.x, y: pos.y }, () => { this.player.inv = 2; });
  }
  consumeInput() { for (const f of ['jumpP', 'dashP', 'zP', 'xP', 'cP', 'swapNext', 'swapPrev', 's1', 's2', 's3', 'mega', 'zmoveP', 'useP', 'upP']) this.inp[f] = false; }

  // ---------------- 마을: 포켓몬센터 · 자판기 ----------------
  updateInteract() {
    const p = this.player, it = this.props ? this.props.nearest(p.x, p.bottom) : null;
    if (!this.promptText) this.promptText = this.add.text(0, 0, '', { fontFamily: 'Galmuri9', fontSize: '9px', color: '#fff2c0', stroke: '#1a1008', strokeThickness: 3, resolution: 1 }).setOrigin(.5, 1).setDepth(60);
    this.promptText.setVisible(!!it);
    if (!it) return;
    const touch = this.touchInput && this.touchInput.on;   // 터치패드를 쓰면 키 대신 버튼 이름으로
    this.promptText.setText(touch ? it.prompt.replace('F 또는 ↑', '조사 버튼').replace('↓ + Space', '아래로 당기고 점프') : it.prompt).setPosition(Math.round(it.x), Math.round(it.promptY + Math.sin(this.time.now / 250) * 1.5));
    if (!this.inp.useP && !this.inp.upP) return;
    if (it.kind === 'hint') return;   // 안내만 띄운다 (↓ + Space 는 평소대로 발판 내려가기)
    this.inp.jumpP = false;
    if (it.kind === 'lore') { if (this.time.now - (this.loreAt || 0) > 500) { this.loreAt = this.time.now; this.events.emit('lore', it.text); Sfx.play('select'); } return; }
    if (it.kind === 'tm') { this.openTM(it); return; }   // 카드를 확정해야 다 쓴 제단이 된다
    if (it.kind === 'taxi') { this.toggleOverlay('taxi'); Sfx.play('select'); return; }   // 아머까오 공중날기 (몇 번이고)
    if (it.kind === 'terminal') {   // 간이 포켓몬 회복기: 파티 전원 회복 + 연결(자동 저장 · 부활 자리)
      if (this.time.now - (this.healAt || 0) < 1500) return;
      this.healAt = this.time.now;
      this.linkTerminal(it, true);
      this.healAtTerminal(it);
      return;
    }
    if (it.kind === 'center') {   // 포켓몬센터는 몇 번이고 (HK 의자처럼) — 쉬면 여기가 다시 일어날 자리가 된다
      if (this.time.now - (this.healAt || 0) < 1500) return;
      this.healAt = this.time.now;
      if (it.room) this.visitHub(it.room);
      this.healAtCenter();
      return;
    }
    this.props.markUsed(it);
    {   // 자판기 (마을마다 한 번): 가끔 강화 아이템, 아니면 오렌열매
      const lucky = Math.random() < ITEM_DROP.vending;
      this.spawnPickup(lucky ? 'item' : 'oran', it.x, it.y - 30, lucky ? pick(ITEM_KEYS) : undefined);
      this.fx.burst(it.x, it.y - 30, lucky ? [0xffe08a, 0x8ad0ff, 0xffffff] : [0x8ad0ff, 0xffffff], lucky ? 20 : 12, 90, { glow: true, up: 60 });
      this.events.emit('toast', lucky ? '프렌들리숍 자판기에서 강화 아이템이 나왔다!' : '자판기에서 오렌열매가 나왔다  ·  강화 아이템은 가끔 나온다');
      Sfx.play(lucky ? 'unlock' : 'vend');
    }
  }

  // ---------------- 기술머신: 카드 3장 뒤집기 → 1장 고르기 ----------------
  // 처음 가동할 때 지금 출전 중인 포켓몬에게 맞춘 카드 3장을 뽑아 제단에 묶어 둔다 (닫았다 다시 열어도 같은 카드·뒤집은 상태 그대로)
  //  처음 가동하면 캡슐이 증기와 빛을 뿜으며 열린 뒤(Props.openTM) 카드 화면으로
  openTM(it) {
    if (this.tmOpening) return;
    if (!it.cards) { it.member = this.player.m; it.cards = rollCards(it.member); it.flipped = [false, false, false]; it.sel = -1; }
    this.tmOpening = true;
    this.player.b.setVelocityX(0);
    this.props.openTM(it, () => {
      this.tmOpening = false;
      if (this.over || this.overlay || !this.props) return;
      this.tmActive = it;
      this.toggleOverlay('tm');
      Sfx.play('mega');
    });
  }
  // 카드 i 확정 (기술 습득 카드는 바꿀 슬롯 z·x·c 와 함께)
  finishTM(i, slot) {
    const it = this.tmActive, p = this.player;
    if (!it || it.used) return;
    const card = it.cards[i], m = it.member, msg = applyCard(p, m, card, slot);
    if (it.legend) it.used = true; else this.props.markUsed(it);   // 히든 전설 보상 카드는 제단이 없다
    this.tmActive = null;
    this.toggleOverlay('tm');
    const who = p.formName(m);
    this.events.emit('banner', card.kind === 'move' ? `${card.name} 습득!` : card.name, `${who} · ${msg}`);
    this.fx.ring(p.x, p.y, 40, 0x9ad8ff, 420); this.fx.glow(p.x, p.y, 40, 0x9ad8ff, 500, 1);
    this.fx.burst(p.x, p.y, [0x9ad8ff, 0xffffff, 0xc8e4ff], 24, 140, { glow: true, up: 80 });
    Sfx.play('unlock');
  }

  // 띠리리- 띠리- : 황금빛·초록빛 치유 파동이 퍼지며 파티 전원(쓰러진 포켓몬 포함) 체력 100%
  healAtCenter() {
    const p = this.player;
    for (const m of p.members) { m.hp = m.maxhp; m.alive = true; }
    Sfx.play('center');
    const cx = p.x, cy = p.y;
    [0, 200, 400, 600].forEach((d, i) => this.time.delayedCall(d, () => {
      this.fx.ring(cx, cy, 50 + i * 28, i % 2 ? 0x8affb0 : 0xffe08a, 700);
      this.fx.glow(cx, cy, 60 + i * 10, i % 2 ? 0x8affb0 : 0xfff2b0, 500, .6);
    }));
    this.fx.burst(cx, cy, [0xffe08a, 0x8affb0, 0xffffff], 34, 120, { glow: true, up: 70, grav: -30, bounce: false, life: 1.1 });
    this.cameras.main.flash(380, 255, 244, 200);
    this.events.emit('banner', '모든 포켓몬이 건강해졌다!', '포켓몬센터 · 파티 전원 회복 · 쓰러지면 여기서 다시 일어난다');
    // 이어서 포켓몬 보관함 (엔트리 교체) — 파티 밖에 데려올 포켓몬이 있을 때만
    if (DEX_ORDER.some(k => Save.isUnlocked(k) && !p.members.some(m => m.key === k))) this.time.delayedCall(1100, () => { if (!this.over && !this.overlay) this.toggleOverlay('box'); });
  }

  togglePause() {
    if (this.over || this.transitioning) return;
    if (this.overlay) { this.toggleOverlay(this.overlay); return; }   // 지도·가방이 열려 있으면 Esc 는 닫기
    this.setFrozen(!this.paused);
    this.events.emit('pause', this.paused);
  }

  // ---------------- 메인 루프 ----------------
  update(time, delta) {
    if (!this.player || !this.layers || !this.layers.length) return;
    const dt = Math.min(delta, 50) / 1000;
    this.readInput();
    if (this.paused || this.over) return;
    if (this.fx.updateHitStop()) return;
    if (this.transitioning) { this.fx.update(dt); return; }

    this.updateInteract();
    this.player.update(dt, this.inp);
    this.consumeInput();
    this.props.update(time, dt);
    this.cullEnemies();
    for (const e of this.enemies) if (e.alive && !e.asleep) e.update(dt, this.player);
    this.drawCorruption();
    this.combat.updateProjectiles(dt);
    this.combat.updateZones(dt);
    this.updatePickups(dt);
    this.updateCovers();
    this.updateRooms(dt);
    if (this.trainer) {
      this.trainer.update(dt);
      if (!this.arenaRoom && this.room !== this.trainer.room) { this.trainer.destroy(); this.trainer = null; }   // 정화를 마치고 아레나를 떠나면
    }
    this.updatePortal(dt);
    this.updateLights(dt);
    this.fx.update(dt);
    const cam = this.cameras.main;
    cam.followOffset.x += (-this.player.face * 26 - cam.followOffset.x) * Math.min(1, dt * 3);
    const ry = this.room ? cam.scrollY - this.room.Y0 * TILE : 0;   // 세로 흐름은 방 안에서만 살짝 (텍스처 여유 16px 안 — 2D 월드에서 땅 띠가 하늘에 비치지 않게)
    this.bgFar.tilePositionX = cam.scrollX * .15 + time * .002; this.bgFar.tilePositionY = Phaser.Math.Clamp(ry * .03, 0, 8);   // 하늘이 천천히 흐른다
    for (const t of Object.values(this.bgMids)) { t.tilePositionX = cam.scrollX * .4; t.tilePositionY = Phaser.Math.Clamp(ry * .06, 0, 16); }
  }

  updateLights(dt) {
    const t = this.time.now / 1000;
    // 마을에선 주변광이 따뜻하고 밝게 바뀐다 (천천히)
    if (this.webgl && this.ambient) {
      const base = this.room && this.room.type === 'village' ? 0x8a7258 : this.room && this.room.under ? shade(this.stage.palette.ambient, .72) : this.stage.palette.ambient;   // 시내는 따뜻하게 · 지하는 어둡게
      const tgt = Phaser.Display.Color.IntegerToRGB(base), a = this.ambient, k = Math.min(1, dt * 1.5);
      a.setTo(Math.round(a.red + (tgt.r - a.red) * k), Math.round(a.green + (tgt.g - a.green) * k), Math.round(a.blue + (tgt.b - a.blue) * k));
      this.lights.setAmbientColor(a.color);
    }
    for (const tc of this.torches) {
      const f = .85 + Math.sin(t * 6 + tc.phase) * .08 + Math.sin(t * 17 + tc.phase * 3) * .05;
      tc.glow.setAlpha(.55 * f);
      if (tc.light) tc.light.setIntensity(1.3 * f);
    }
    if (this.playerLight) {
      const p = this.player;
      this.playerLight.setPosition(p.x, p.y - 4).setColor(typeColor(p.types[0])).setIntensity(p.mega.active ? 2.4 : 1.5).setRadius(p.mega.active ? 200 : 150);
    }
    // 관문 네온 막대 (좌우 문은 세로, 위아래 문은 가로)
    const g = this.gateG; g.clear();
    for (const gate of this.gates) {
      if (gate.open) continue;
      const r = gate.rect, col = this.stage.palette.edge;
      g.fillStyle(col, .25 + Math.sin(t * 8) * .08); g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      g.fillStyle(col, .9);
      if (gate.vertical) for (let yy = r.y; yy < r.y + r.h; yy += 6) g.fillRect(r.x + ((yy / 6) % 2 ? 0 : 3), yy + ((t * 40) % 6), 3, 3);
      else for (let xx = r.x; xx < r.x + r.w; xx += 6) g.fillRect(xx + ((t * 40) % 6), r.y + ((xx / 6) % 2 ? 0 : 3), 3, 3);
    }
  }

  // ---------------- 세뇌 비주얼 (모든 적을 그래픽 두 장에 한 번에) ----------------
  // 발밑: 검보라 그림자 타원 3겹 + 바닥에서 일렁이는 침식 불꽃 / 머리: 붉은 안광이 남기는 실선 궤적
  // 발밑 타원 그림자는 크기별로 한 번 구운 텍스처(흰색)를 적마다 두 장의 이미지로 띄워 색·투명도·위치만 바꾼다
  //  (예전엔 매 프레임 그래픽에 한 줄씩 fillRect). 일렁이는 침식 불꽃 몇 줄과 안광 궤적만 그래픽에 그린다
  drawCorruption() {
    const g = this.corruptG, tg = this.eyeTrailG, t = this.time.now / 1000;
    g.clear(); tg.clear();
    for (const e of this.enemies) {
      const a = e.corrupt && !e.asleep ? e.sprite.alpha * (e.fade ? .45 : 1) : 0;
      if (a <= .02) { if (e.shadowA) { e.shadowA.setVisible(false); e.shadowB.setVisible(false); } continue; }
      // 공중의 적은 아래 바닥에 그림자가 진다 (높을수록 작고 옅게)
      const gy = e.flying || e.def.noclip ? this.groundBelow(e.x, e.bottom) : e.bottom;
      const far = Math.max(.25, 1 - Math.max(0, gy - e.bottom) / 140);
      // 발밑 오라는 은은하게: 예전 크기의 약 55% · 투명도 0.15~0.2 (포켓몬 도트가 먼저 보이도록)
      const W = (e.b.width * .9 + 10) * (e.boss ? 1.3 : 1) * .55 * (.94 + Math.sin(t * 4 + e.auraT) * .06) * far;
      if (!e.shadowA) { e.shadowA = this.add.image(0, 0, 'px').setOrigin(0).setDepth(17.99); e.shadowB = this.add.image(0, 0, 'px').setOrigin(0).setDepth(17.995); }
      this.placeEllipse(e.shadowA, e.x, gy - 1, W, W * .24, 0x7a22c0, .15 * a * far);
      this.placeEllipse(e.shadowB, e.x, gy - 1, W * .6, W * .16, 0x2a0a40, .2 * a * far);
      const n = e.boss ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const fx = Math.round(e.x + Math.sin(i * 12.9 + t * .7 + e.auraT) * W * .7);
        const fh = Math.round((2 + (Math.sin(t * 6 + i * 3.1 + e.auraT) * .5 + .5) * (e.boss ? 6 : 3)) * far);
        g.fillStyle(0x7a22c0, .22 * a * far); g.fillRect(fx, gy - 1 - fh, 1, fh);
      }
      // 붉은 안광 궤적: 오래된 점일수록 가늘고 옅게
      const tr = e.eyeTrail;
      if (tr.length > 1) {
        const w = e.boss ? 2 : 1;   // 얇고 날카롭게: 가는 붉은 실선 + 아주 옅은 번짐
        for (let i = 1; i < tr.length; i++) {
          const k = i / (tr.length - 1), p0 = tr[i - 1], p1 = tr[i];
          tg.lineStyle(w + 1, 0xff0044, .16 * k * a); tg.lineBetween(p0.x, p0.y, p1.x, p1.y);
          tg.lineStyle(w, k > .6 ? 0xff7a8a : 0xff2a4a, Math.min(1, .5 + k * .6) * a); tg.lineBetween(p0.x, p0.y, p1.x, p1.y);
        }
      }
    }
  }

  // 도트 타원 텍스처: 가로 반지름(0.5 단위)·세로 반지름별로 처음 한 번만 굽는다 (textures.exists 로 재사용)
  ellipseTex(rx, ry) {
    rx = Math.round(rx * 2) / 2;
    const R = Math.max(1, Math.round(ry)), cx0 = Math.ceil(rx) + 1, key = `cel-${rx}-${R}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      for (let y = -R; y <= R; y++) {
        const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (R + .5)) ** 2)));
        if (w > 0) g.fillRect(cx0 - w, R + y, w * 2, 1);
      }
      g.generateTexture(key, cx0 * 2, R * 2 + 1);
      g.destroy();
    }
    return { key, cx0, R };
  }

  // pixelEllipse 와 같은 자리·같은 모양으로 구운 타원 이미지를 놓는다
  placeEllipse(im, cx, cy, rx, ry, color, alpha) {
    const t = this.ellipseTex(rx, ry);
    if (im.texture.key !== t.key) im.setTexture(t.key);
    im.setPosition(Math.round(cx) - t.cx0, Math.round(cy) - t.R).setTint(color).setAlpha(alpha).setVisible(true);
  }

  // 화면 밖 컬링: 플레이어가 있는 방도 아니고 카메라 시야(+여유)에서도 먼 적은 잠재운다
  //  → AI·물리·세뇌 레이어 갱신을 멈추고 그림도 숨긴다. 시야 가까이 오면 그대로 깨어난다 (보스는 잠들지 않는다)
  //  잠들 때(220px)와 깰 때(150px) 거리를 달리해 경계에서 깜빡이지 않게
  cullEnemies() {
    const v = this.cameras.main.worldView;
    for (const e of this.enemies) {
      if (!e.alive || e.boss) { if (e.asleep && e.alive) this.wakeEnemy(e); continue; }
      const m = e.asleep ? 150 : 220;
      const near = e.room === this.room || (e.x > v.x - m && e.x < v.right + m && e.y > v.y - m && e.y < v.bottom + m);
      if (near && e.asleep) this.wakeEnemy(e);
      else if (!near && !e.asleep) this.sleepEnemy(e);
    }
  }

  enemyLayers(e) { return [e.sprite, e.aura, e.overlay, e.rgbR, e.rgbC, e.eyeGlow, e.eyeDot, e.alert]; }

  sleepEnemy(e) {
    e.asleep = true;
    e.b.enable = false;
    const ls = this.enemyLayers(e);
    e.sleepVis = ls.map(o => o.visible);
    for (const o of ls) o.setVisible(false);
    e.eyeTrail = [];
  }

  wakeEnemy(e) {
    e.asleep = false;
    if (e.b) e.b.enable = true;
    const ls = this.enemyLayers(e);
    if (e.sleepVis) ls.forEach((o, i) => o.setVisible(e.sleepVis[i]));
    e.sleepVis = null;
  }

  pixelEllipse(g, cx, cy, rx, ry, color, alpha) {
    const R = Math.max(1, Math.round(ry));
    g.fillStyle(color, alpha);
    for (let y = -R; y <= R; y++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (R + .5)) ** 2)));
      if (w > 0) g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
    }
  }

  // ---------------- 방 / 적 ----------------
  updateRooms(dt) {
    const p = this.player, room = roomAt(this.level, p.x, p.y - 4) || this.room;
    if (room !== this.room) {
      this.room = room;
      for (const m of p.members) m.sturdyUsed = false;   // 기합의띠(특성 카드)는 방마다 1번
      this.events.emit('room', room);
      this.enterArea(room);
      if (room.type === 'village') {
        this.visitHub(room);
        if (!room.entered) { room.entered = true; this.time.delayedCall(4200, () => this.events.emit('toast', '결계 안은 독기가 닿지 않는다 · 포켓몬센터에서 쉬어 가자')); }
      }
      if (room.type === 'treasure' && !room.entered) { room.entered = true; this.events.emit('toast', '보물방이다! 상자를 열어 보자'); }
      if (room.type === 'tm' && !room.entered) { room.entered = true; this.events.emit('toast', '고대 석판이 빛난다 — 기술머신 비밀방'); }
      if (room.type === 'sanctuary' && !room.entered && !room.cleared) this.events.emit('toast', '공기가 무겁다… 전설의 기척');
    }
    // 아레나: 안쪽으로 조금 들어서면 문이 닫히고 보스전
    if (!room.cleared && !room.entered && (room.type === 'mini' || room.type === 'boss' || room.type === 'sanctuary') && p.x > room.left + 20 && p.x < room.right - 20 && p.y > room.top) {
      room.entered = true;
      this.setGates(room, false);
      this.startBoss(room);
    }
    if (room.under && room.type === 'combat' && !this.lowSeen) { this.lowSeen = true; this.events.emit('toast', '깊은 곳으로 내려왔다 — 위로 돌아가는 길을 기억해 두자'); }
    this.underground = !!room.under;
    this.updateSpawns();
    this.updateExplored();
  }

  // 방마다 미리 정해 둔 적 자리: 화면 가장자리쯤 다가가면 나타난다
  updateSpawns() {
    const p = this.player, reach = this.cameras.main.worldView.width / 2 + 40, reachY = this.cameras.main.worldView.height / 2 + 40;
    for (const s of this.level.spawns) {
      if (s.spawned || Math.abs(s.x - p.x) > reach || Math.abs(s.y - p.y) > reachY) continue;
      s.spawned = true;
      if ((this.level.terminals || []).some(t => Math.abs(t.x * TILE - s.x) < 150 && Math.abs(t.g * TILE - s.y) < 90)) continue;   // 간이 회복기 둘레는 안전 구역
      this.spawnAt(s);
    }
  }

  spawnAt(s) {
    // 계열은 지방 pool 에서, 진화 단계는 지금 출전 중인 포켓몬 단계 ±1 안에서 (두 단계 차이는 안 남)
    let pk = pickWildStage(this.stage.pool, this.player.tierIdx);
    if (WILD[pk.line].flying && Math.random() < .5) pk = pickWildStage(this.stage.pool, this.player.tierIdx);   // 날짐승·고스트는 잡기 번거로워 등장 빈도 절반쯤으로
    const { line, stage } = pk, { key, def } = wildForm(line, stage), gy = s.y;
    let x = s.x, y = def.flying ? gy - rand(30, 52) : gy - 14;
    for (let k = 0; k < 6 && def.flying && (this.isSolidAt(x, y) || this.isSolidAt(x, y - 12)); k++) y = gy - rand(20, 44);   // 날짐승: 바위·종유석 속 피하기
    const room = s.room || this.room;
    const e = new Enemy(this, key, x, y, { def, hpMul: 1 + this.stageIdx * .4, dmgMul: 1 + this.stageIdx * .25 });
    e.line = line; e.stage = stage;
    if (!def.flying) e.b.reset(x, gy - e.b.height / 2 - 1);
    this.addEnemy(e, room);
    this.fx.ring(x, e.y, 22, typeColor(def.types[0]), 380);
    this.fx.glow(x, e.y, 26, typeColor(def.types[0]), 420, .9);
  }

  // 지도: 카메라에 들어온 칸을 탐험한 칸으로 (카메라가 칸을 넘을 때만 갱신)
  updateExplored() {
    const v = this.cameras.main.worldView, lv = this.level;
    const tx0 = Math.max(0, Math.floor(v.x / TILE)), ty0 = Math.max(0, Math.floor(v.y / TILE));
    const key = tx0 + ':' + ty0;
    if (key === this.exploredKey) return;
    this.exploredKey = key;
    const tx1 = Math.min(lv.cols - 1, Math.ceil(v.right / TILE)), ty1 = Math.min(lv.rows - 1, Math.ceil(v.bottom / TILE));
    for (let y = ty0; y <= ty1; y++) this.explored.fill(1, y * lv.cols + tx0, y * lv.cols + tx1 + 1);
  }

  addEnemy(e, room) {
    e.room = room;
    e.colliders = [this.physics.add.collider(e.obj, this.gateGroup)];
    if (!e.def.noclip) e.colliders.push(this.physics.add.collider(e.obj, this.layers, null, e.boss ? (o, tile) => !PLAT_SET.has(tile.index) : null));   // 보스는 통과 발판에 올라서지 않는다
    this.enemies.push(e);
  }

  // 아레나 보스: 방의 보스 키 (중간 보스 · 지방 최종 보스 · 히든 전설). 날아다니는 보스는 공중에서
  // 아레나 보스전 시작. 이어 싸우는 순서(chain): prelude(레드의 포켓몬들) → 방 보스 → then(디아루가 → 펄기아)
  startBoss(room) {
    const key = room.boss && BOSSES[room.boss] ? room.boss : 'mewtwo', def = BOSSES[key];
    const list = [...(def.prelude || []), key];
    for (let k = key; BOSSES[k].then; k = BOSSES[k].then) list.push(BOSSES[k].then);
    this.chain = { list, i: 0 };
    this.arenaRoom = room;
    this.lockArena(room);
    const first = BOSSES[list[0]], tk = first.trainer;
    if (tk) {   // 세뇌된 트레이너: 단상에 서서 한마디 → 몬스터볼을 던져 첫 포켓몬을 내보낸다
      this.trainer = new Trainer(this, tk, room, room.cx + 100);   // 아레나 가운데 조금 오른쪽 단상 (왼쪽 입구에서 들어서자마자 화면에 보이게)
      this.trainer.say(TRAINER_LINES[tk].intro);
      const sx = room.cx;
      this.time.delayedCall(1100, () => { if (this.arenaRoom === room && this.trainer) this.trainer.throwBall(sx, this.groundBelow(sx, room.bottom - 24) - 20, () => this.beginBoss(list[0], room, sx)); });
      Sfx.play('boss');
      return;
    }
    this.beginBoss(list[0], room, room.right - 70);
  }
  beginBoss(key, room, x) {
    if (this.arenaRoom !== room || this.over) return;
    const def = BOSSES[key], boss = this.spawnBoss(key, room, x);
    this.boss = boss; this.bosses = [boss];
    if (def.pair && BOSSES[def.pair]) {   // 짝 보스 (라티아스 & 라티오스): 반대편에서 함께 나온다
      const twin = this.spawnBoss(def.pair, room, room.left + 140);
      boss.partner = twin; twin.partner = boss; boss.lead = true;
      this.bosses.push(twin);
    }
    this.events.emit('boss', boss);   // UI 가 할로우 나이트식 보스 이름 타이틀을 띄운다
    this.fx.shake(.01, 500); Sfx.play('boss');
    Music.play(def.tier === 'boss' ? this.stage.bossBgm : 'boss_ruin');   // 지방 최종 보스는 지방 전용곡, 중간·히든 보스는 공용 전투곡
  }
  // 이어 싸우기: 다음 보스가 나오는 연출
  nextInChain(prev) {
    const ch = this.chain, room = this.arenaRoom, key = ch.list[++ch.i], def = BOSSES[key], tr = this.trainer;
    this.boss = null; this.bosses = [];
    this.events.emit('boss', null);
    if (def.entrance === 'shatter') {   // 공간이 유리처럼 깨지며 강림
      this.events.emit('banner', `${prev.name} 정화!`, def.intro || '');
      this.time.delayedCall(700, () => { if (this.arenaRoom === room) this.spaceShatter(room); });
      this.time.delayedCall(1900, () => this.beginBoss(key, room, room.cx + 80));
    } else if (def.entrance === 'abyss') {   // 트레이너가 풀려나고, 심연의 핵에서 솟아오른다
      this.events.emit('banner', `${prev.name} 정화!`, def.intro || '');
      if (tr) { tr.release(TRAINER_LINES[tr.kind].freed); this.time.delayedCall(800, () => this.events.emit('toast', TRAINER_LINES[tr.kind].toast)); }
      this.time.delayedCall(1600, () => { if (this.arenaRoom === room) this.abyssRise(room); });
      this.time.delayedCall(3300, () => this.beginBoss(key, room, room.cx));
    } else if (tr && !tr.freed) {   // 트레이너가 다음 몬스터볼을 던진다
      this.events.emit('banner', `${prev.name} 정화!`, `${tr.name}이(가) 다음 포켓몬을 꺼낸다`);
      const line = TRAINER_LINES[tr.kind].next;
      this.time.delayedCall(900, () => { if (this.arenaRoom !== room || !this.trainer) return; if (line) tr.say(line); const sx = room.cx; tr.throwBall(sx, this.groundBelow(sx, room.bottom - 24) - 20, () => this.beginBoss(key, room, sx)); });
    } else this.time.delayedCall(900, () => this.beginBoss(key, room, room.right - 70));
  }
  // 펄기아 강림: 화면 가운데에서 유리처럼 금이 사방으로 뻗고 조각이 쏟아진다 → 보랏빛 차원 균열
  spaceShatter(room) {
    const cam = this.cameras.main, v = cam.worldView, cx = v.centerX, cy = v.centerY, g = this.add.graphics().setDepth(45);
    for (let k = 0; k < 14; k++) {
      let x = cx, y = cy; const a0 = k / 14 * Math.PI * 2 + Math.random() * .3, pts = [{ x, y }];
      for (let s = 0; s < 6; s++) { const a = a0 + (Math.random() - .5) * .5, d = 20 + Math.random() * 40; x += Math.cos(a) * d; y += Math.sin(a) * d; pts.push({ x, y }); }
      g.lineStyle(3, 0xd88aff, .5); g.strokePoints(pts, false); g.lineStyle(1, 0xffffff, .95); g.strokePoints(pts, false);
    }
    this.tweens.add({ targets: g, alpha: 0, delay: 500, duration: 700, onComplete: () => g.destroy() });
    cam.flash(300, 255, 255, 255, true); this.fx.shake(.025, 700); Sfx.play('shatter'); Sfx.play('boom');
    this.fx.shatter(cx, cy, v.width * .7, v.height * .7, { n: 40, speed: 260, scale: 2.2, depth: 46 });
    const rx = room.cx + 80, ry = room.bottom - 70;
    this.fx.glow(rx, ry, 80, 0xd88aff, 1400, 1); this.fx.ring(rx, ry, 90, 0xd88aff, 700); this.fx.ring(rx, ry, 50, 0xffffff, 500);
  }
  // 무한다이노 등장: 아레나 바닥이 붉게 갈라지며 심연의 빛이 솟는다
  abyssRise(room) {
    const cx = room.cx, gy = this.groundBelow(cx, room.bottom - 24);
    this.fx.shake(.02, 1600); Sfx.play('boss'); Sfx.play('thunder');
    this.cameras.main.flash(400, 255, 60, 90, true);
    for (let k = 0; k < 5; k++) this.time.delayedCall(k * 260, () => {
      this.fx.ring(cx, gy - 40 - k * 20, 60 + k * 30, 0xff2a5a, 600);
      this.fx.burst(cx + (Math.random() - .5) * 120, gy - 4, [0xff2a5a, 0x2a0612, 0xffa0b8], 20, 220, { angle: -Math.PI / 2, spread: .9, up: 200, grav: 300, glow: true, life: .9 });
    });
    this.fx.glow(cx, gy - 80, 120, 0xff2a5a, 1800, 1);
  }

  spawnBoss(key, room, x) {
    const def = BOSSES[key], gy = this.groundBelow(x, room.bottom - 24);   // 아레나 바닥 (공중 발판 위가 아니라)
    const boss = new Boss(this, key, x, def.fly ? Math.max(room.top + 40, gy - 70) : gy - 40, { room, hpMul: 1, dmgMul: 1 });
    if (!def.fly) boss.b.reset(x, gy - boss.b.height / 2 - 1);
    boss.state = 'intro'; boss.intangible = true;
    this.addEnemy(boss, room);
    return boss;
  }
  // 보스전 동안 카메라를 아레나 안에 가두고 조금 뒤로 물린다 (옆방이 비치지 않게 · 넓은 아레나에서 보스 예고 동작이 보이게)
  lockArena(room) {
    const cam = this.cameras.main;
    cam.setBounds(room.X0 * TILE, room.Y0 * TILE, (room.X1 - room.X0) * TILE, (room.Y1 - room.Y0) * TILE);
    cam.zoomTo(ARENA_ZOOM * RES, 700, 'Sine.easeInOut', true);
  }
  unlockArena() {
    const cam = this.cameras.main;
    if (this.level) cam.setBounds(0, 0, this.level.width, this.level.height);
    if (cam.zoom !== ZOOM * RES) cam.zoomTo(ZOOM * RES, 900, 'Sine.easeInOut', true);
  }

  // ---------------- 정화 / 드랍 / 도감 ----------------
  killEnemy(e) {
    if (!e.alive) return;
    e.alive = false; e.intangible = true; e.telegraph(false);
    if (this.player) perkKill(this.player);   // 특성 카드: 생명의구슬 유물 — 처치하면 체력 회복
    (e.colliders || []).forEach(c => c.destroy());
    e.colliders = [];
    e.b.enable = false;
    this.purify(e);
    // 진화 경험치: 정화할 때 출전 중이던 포켓몬이 받는다 (보스는 정화 연출이 끝날 무렵)
    const who = this.player.m;
    if (e.boss) this.time.delayedCall(1600, () => { if (this.player && !this.over) this.player.addExp(EXP_BOSS, who); });
    else this.player.addExp(EXP_PURIFY, who);
    this.runStats.kills++;
    this.announceJoin(Save.addPurify());   // 누적 정화로 합류하는 특수 포켓몬 (롱스톤·스라크)
    const joinedBy = e.boss && Save.unlockByBoss(e.bossKey);   // 전설 보스 정화 → 그 전설이 플레이어블로 합류 (한카리아스 → 딥상어동 계열)
    if (joinedBy) this.time.delayedCall(2800, () => this.announceJoin([joinedBy]));
    if (e.boss) this.dropFormItem(e);
    if (e.boss) { this.bossDefeated(e); return; }
    if (Math.random() < ITEM_DROP.wild) this.spawnPickup('item', e.x, e.y, pick(ITEM_KEYS));   // 야생은 아이템 대신 가끔 오렌열매
    else if (Math.random() < .16) this.spawnPickup('oran', e.x, e.y);
    const r = Save.addKill(e.line || e.key);   // 정화 진행도는 진화 계열로 센다 (피카츄를 정화해도 피츄 계열 +1)
    if (r) {
      if (r.unlockedNow) { this.runStats.unlocked.push(e.line); this.events.emit('unlock', e.line); Sfx.play('unlock'); }
      else this.events.emit('killcount', e.line, r.count);
    }
  }

  // 정화 피니시: HP 0 이 되어도 바로 사라지지 않는다 (일반 약 0.55초, 보스는 같은 순서를 길게)
  //  ① 검보라 세뇌 껍질에 금이 가고 유리처럼 사방으로 깨져 나감 → ② 하얀 섬광
  //  ③ 본래 밝은 색으로 돌아와 안도하듯 멈춤 (머리 위 하트·반짝임) → ④ 몬스터볼 빛줄기처럼 붉은 빛이 되어 귀환
  purify(e) {
    const big = e.boss, s = e.sprite, ADD = Phaser.BlendModes.ADD;
    const T = big ? { shatter: 480, color: 600, beam: 1850, end: 2350 } : { shatter: 70, color: 140, beam: 380, end: 560 };
    const cx = e.x, cy = e.y, bw = e.b.width, bh = e.b.height, top = e.top;
    e.clearCorruption();
    e.play('Idle', true);
    if (e.glowImg) this.tweens.add({ targets: e.glowImg, alpha: 0, duration: 300 });
    s.setAlpha(1).setTintFill(0x3a0e5a);   // 몸 전체가 검보라 껍질로 굳고, 가장자리가 유리처럼 빛난다
    if (e.aura) e.copyFrame(e.aura, s).setPosition(s.x, s.y + 1).setScale(s.scaleX * 1.12, s.scaleY * 1.12).setTintFill(0xb070ff).setAlpha(.85).setVisible(true);
    // ① 금: 몸 안쪽에서 바깥으로 뻗는 들쭉날쭉한 빛줄기
    const cracks = this.add.graphics().setDepth(s.depth + .5).setBlendMode(ADD);
    const crack = n => {
      for (let i = 0; i < n; i++) {
        let x = cx + (Math.random() - .5) * bw * .3, y = cy + (Math.random() - .5) * bh * .3;
        const a0 = Math.random() * Math.PI * 2, pts = [{ x: Math.round(x), y: Math.round(y) }], len = Math.min(bw, bh) * .17;
        for (let k = 0; k < 3; k++) {
          const a = a0 + (Math.random() - .5) * 1.3;
          x = Phaser.Math.Clamp(x + Math.cos(a) * len, cx - bw * .5, cx + bw * .5); y = Phaser.Math.Clamp(y + Math.sin(a) * len, cy - bh * .5, cy + bh * .5);
          pts.push({ x: Math.round(x), y: Math.round(y) });
        }
        cracks.lineStyle(1, 0xf0c8ff, .95); cracks.strokePoints(pts, false);
      }
    };
    crack(big ? 4 : 5);
    Sfx.play('crack');
    if (big) [160, 320].forEach(ms => this.time.delayedCall(ms, () => { crack(5); s.setTintFill(ms === 160 ? 0x3a0e5a : 0x4a1478); this.fx.shake(.008, 120); Sfx.play('crack'); }));
    // ② 산산조각 + 하얀 섬광
    this.time.delayedCall(T.shatter, () => {
      cracks.destroy();
      if (e.aura) e.aura.setVisible(false);
      s.setTintFill(0xffffff);
      this.fx.shatter(cx, cy, bw * 1.1, bh * 1.1, { n: big ? 48 : 16, speed: big ? 240 : 150, up: big ? 120 : 80, scale: big ? 2 : 1 });
      this.fx.burst(cx, cy, [0x14061e, 0x3a0e5a, 0x6a1aa8], big ? 40 : 12, big ? 220 : 130, { life: .6 });
      this.fx.glow(cx, cy, big ? 120 : 38, 0xffffff, big ? 420 : 200, 1);
      this.fx.ring(cx, cy, big ? 110 : 30, 0xe0b0ff, big ? 500 : 260);
      if (big) { this.cameras.main.flash(180, 255, 255, 255); this.fx.shake(.014, 260); }
      Sfx.play('shatter');
    });
    // ③ 본래 색 + 안도의 하트·반짝임
    this.time.delayedCall(T.color, () => {
      s.clearTint();
      this.tweens.add({ targets: s, y: s.y - (big ? 6 : 3), duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      this.fx.glow(cx, cy, big ? 80 : 26, 0xfff2b0, big ? 700 : 300, .8);
      this.heartPop(cx, top - (big ? 14 : 7), big);
      if (!big) this.fx.floatText(cx, top - 20, '정화!', '#ffe08a', 10);   // 보스는 화면 배너가 대신한다
      Sfx.play(big ? 'unlock' : 'purify');
    });
    // ④ 몬스터볼 빛줄기로 귀환
    this.time.delayedCall(T.beam, () => this.recallBeam(e, T.end - T.beam));
  }

  // 안도의 하트가 톡 튀어나와 떠오르고, 양옆에서 반짝임이 터진다
  heartPop(x, y, big) {
    const k = big ? 2 : 1;
    const h = this.add.image(Math.round(x), Math.round(y), 'heart').setDepth(58).setScale(0);
    this.tweens.add({ targets: h, scale: k, duration: 150, ease: 'Back.easeOut' });
    this.tweens.add({ targets: h, y: h.y - 12 * k, alpha: 0, delay: big ? 1000 : 300, duration: big ? 700 : 420, onComplete: () => h.destroy() });
    for (let i = 0; i < (big ? 6 : 2); i++) {
      const sp = this.add.image(Math.round(x + (i % 2 ? 1 : -1) * (6 + Math.random() * 6) * k), Math.round(y + (Math.random() - .3) * 8 * k), 'sparkle')
        .setDepth(58).setScale(0).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: sp, scale: k, angle: 90, yoyo: true, duration: 170, delay: 40 + i * (big ? 140 : 70), onComplete: () => sp.destroy() });
    }
  }

  // 몸이 붉은 빛으로 바뀌어 한 점으로 줄어들고, 하늘로 솟는 빛줄기를 타고 사라진다
  recallBeam(e, ms) {
    const s = e.sprite, big = e.boss, ADD = Phaser.BlendModes.ADD;
    const cx = s.x, cy = e.y, topY = this.cameras.main.worldView.y - 20;
    s.setTintFill(0xff5068);
    this.tweens.add({
      targets: s, scaleX: 0, scaleY: s.scaleY * .3, y: cy, alpha: .3, duration: ms, ease: 'Cubic.easeIn',
      onComplete: () => { e.destroy(); this.enemies = this.enemies.filter(x => x !== e); }
    });
    const beam = (w, color, d) => this.add.image(cx, cy, 'px').setOrigin(.5, 1).setTint(color).setBlendMode(ADD).setDepth(d).setScale(w / 2, 0);
    const outer = beam(big ? 12 : 6, 0xff2a4a, 57), core = beam(big ? 4 : 2, 0xffffff, 57.1);
    this.tweens.add({ targets: [outer, core], scaleY: Math.max(20, cy - topY) / 2, duration: ms * .5, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [outer, core], scaleX: 0, alpha: 0, delay: ms * .5, duration: ms * .9, onComplete: () => { outer.destroy(); core.destroy(); } });
    this.fx.glow(cx, cy, big ? 60 : 22, 0xff4a6a, ms, .9);
    this.fx.embers(cx, cy, [0xffffff, 0xff8a9a], big ? 12 : 4, { speed: 40 });
    Sfx.play('recall');
  }

  // 보스 정화: 문이 열리고 보상. 최종 보스는 다음 지방 포털 + (챕터에 따라) Z크리스탈·메가스톤, 히든 전설은 전설 기술 카드
  bossDefeated(boss) {
    if (boss.partner && boss.partner.alive) {   // 짝 보스: 한 마리가 쓰러지면 남은 한 마리가 각성 (전투는 계속)
      this.boss = boss.partner;
      boss.partner.awaken();
      this.events.emit('banner', `${boss.name} 정화!`, `${boss.partner.name}이(가) 유대의 힘으로 각성했다`);
      this.fx.hitStop(160);
      return;
    }
    if (this.chain && this.chain.i < this.chain.list.length - 1) { this.nextInChain(boss); return; }   // 이어 싸우기 (디아루가 → 펄기아 · 레드의 포켓몬 → 무한다이노)
    const room = boss.room, final = room.type === 'boss', hidden = room.type === 'sanctuary', tr = this.trainer;
    this.boss = null; this.bosses = []; this.chain = null; this.arenaRoom = null;
    if (this.player.flipT > 0) this.player.flipT = .001;
    if (tr) {   // 세뇌된 트레이너가 정신을 차린다 (레드는 이미 풀려 있으면 마지막 한마디)
      const L = TRAINER_LINES[tr.kind];
      if (!tr.freed) { tr.release(L.freed); this.time.delayedCall(1200, () => this.events.emit('toast', L.toast)); }
      else if (L.end) this.time.delayedCall(1400, () => tr.say(L.end));
    }
    this.events.emit('boss', null);
    const drop = final ? (this.stageIdx === DROPS.zcrystal ? 'zcrystal' : this.stageIdx === DROPS.megastone ? 'megastone' : null) : null;
    const sub = drop === 'zcrystal' ? '정신을 되찾았다 · Z크리스탈이 빛난다' : drop === 'megastone' ? '정신을 되찾았다 · 메가스톤이 빛난다' : hidden ? '전설이 깨어났다 · 전설의 기술 카드를 남겼다' : '정신을 되찾았다';
    this.events.emit('banner', `${boss.name} 정화!`, sub);
    this.fx.hitStop(220);
    for (let k = 0; k < 3; k++) this.time.delayedCall(k * 160, () => { this.fx.ring(boss.x + rand(-20, 20), boss.y + rand(-20, 20), 40 + k * 10, 0xe0b0ff, 300); Sfx.play('boom'); });   // 껍질에 금이 가는 박자
    room.cleared = true;
    this.time.delayedCall(700, () => {
      this.setGates(room, true);
      this.unlockArena();
      if (drop) this.spawnPickup(drop, boss.x, boss.y - 10);
      if (Math.random() < ITEM_DROP.boss) this.spawnPickup('item', boss.x + 14, boss.y - 10, pick(ITEM_KEYS));   // 보스는 강화 아이템 확정
      if (hidden) { this.spawnPickup('item', boss.x - 14, boss.y - 10, pick(ITEM_KEYS)); this.time.delayedCall(1500, () => this.openLegendCards()); }
      if (final) this.spawnPortal(room.right - 40, this.groundBelow(room.right - 40, room.top + 8));
    });
    Save.data.bestStage = Math.max(Save.data.bestStage, this.stageIdx + 1); Save.write();
    if (final) {   // 지방 최종 보스 정화 = 그 지방 클리어 → 클리어로 합류하는 특수 포켓몬 (가디안·마기라스·망나뇽)
      Save.data.cleared = Math.max(Save.data.cleared || 0, this.stageIdx + 1);
      const joined = Save.newlyJoined();
      this.time.delayedCall(5600, () => this.announceJoin(joined));
    }
    Music.play(this.stage.bgm);
  }

  // 폼체인지 아이템을 지닌 전설 보스(디아루가·펄기아·기라티나)는 정화하면 그 아이템을 떨어뜨린다
  dropFormItem(boss) {
    const id = Object.keys(FORM_ITEMS).find(k => FORM_ITEMS[k].boss === boss.bossKey);
    if (id && !this.player.formItems.has(id)) this.time.delayedCall(900, () => { if (this.level) this.spawnPickup('formitem', boss.x, boss.y - 12, id); });
  }

  // 「🎉 [이름]의 영혼이 동료로 합류했습니다!」 알림을 하나씩
  announceJoin(keys) {
    keys.forEach((k, i) => this.time.delayedCall(i * 4200, () => {
      if (this.over) return;
      this.runStats.unlocked.push(k);
      this.events.emit('unlock', k, 'join');
      Sfx.play('unlock');
    }));
  }
  // 히든 전설 보상: 출전 중인 포켓몬에게 맞춘 '전설' 등급 기술 카드 3장
  openLegendCards() {
    if (this.over || this.transitioning || this.overlay) { this.time.delayedCall(800, () => this.openLegendCards()); return; }
    const m = this.player.m;   // 히든 전설 보상: 유니크 이상 · 한 장은 반드시 전설
    const it = { kind: 'tm', legend: true, used: false, member: m, cards: rollCards(m, { floor: '유니크', legend: true }), flipped: [false, false, false], sel: -1 };
    this.tmActive = it;
    this.toggleOverlay('tm');
    Sfx.play('mega');
  }

  spawnPickup(kind, x, y, id, still = false) {
    // 아이템·상처약은 가방과 같은 본가 그림을 16칸 크기로 (월드 배율만큼 곱게 줄여 둔다). 그림이 없으면 도트 아이콘
    const artId = kind === 'item' ? id : kind === 'potion' ? 'potion' : null, art = artId && itemArt(this, artId, 16 * ZOOM);
    const img = this.physics.add.image(x, y, art || (kind === 'item' ? `it:${id}` : kind === 'potion' ? 'oran' : kind === 'formitem' ? 'megastone' : kind)).setDepth(19);   // 폼체인지 아이템은 구슬 모양 (색으로 구분)
    if (kind === 'formitem') img.setTint(FORM_ITEMS[id].color);
    if (art) { img.setDisplaySize(16, 16); img.body.setSize(10 / img.scaleX, 16 / img.scaleY); }   // 몸통도 그림 크기에 맞춰 바닥에 딱 놓이게
    else img.body.setSize(10, 10);
    if (!still) img.setVelocity(rand(-70, 70), -190);
    img.body.setBounce(.35); img.body.setDragX(120);
    const col = kind === 'formitem' ? FORM_ITEMS[id].color : kind === 'megastone' ? 0xff8ad0 : kind === 'zcrystal' ? 0xfff6a0 : kind === 'oran' ? 0x4a7aff : kind === 'potion' ? 0xd88aff : 0xffe08a;
    const glow = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(.5).setDepth(18);
    const coll = this.physics.add.collider(img, this.layers);
    const pk = { kind, id, img, glow, coll, t: 0 };
    this.pickups.push(pk);
    return pk;
  }

  // 작은 샛길에 들어서면 덮어 둔 흙이 걷히며 굴이 드러난다 (지도에도 그때부터 나온다)
  updateCovers() {
    if (!this.covers.length) return;
    const pb = this.player.bounds();
    for (let i = this.covers.length - 1; i >= 0; i--) {
      const c = this.covers[i];
      if (!overlap(pb, c.sd.area)) continue;
      c.sd.revealed = true;
      this.covers.splice(i, 1);
      for (const pk of this.pickups) if (pk.hiddenBy === c.sd) { pk.img.setVisible(true); pk.glow.setVisible(true); }
      this.tweens.add({ targets: c.layers, alpha: 0, duration: 380, onComplete: () => c.layers.forEach(l => l.destroy()) });
      for (let k = 0; k < 10; k++) { const [x, y] = c.sd.cells[(Math.random() * c.sd.cells.length) | 0]; this.fx.burst(x * TILE + 8, y * TILE + 8, [0x6a5a48, 0x4a4036], 1, 40, { up: 10, grav: 300, life: .5, size: 1 }); }
      Sfx.play('land');
      if (!c.sd.reward) this.events.emit('toast', '숨겨진 굴… 하지만 막다른 길이다');
    }
  }

  updatePickups(dt) {
    const pb = this.player.bounds();
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt;
      p.glow.setPosition(p.img.x, p.img.y).setAlpha(.5 + Math.sin(p.t * 6) * .2);
      if (p.img.y > this.level.height + 40) p.img.body.reset(p.img.x, 4 * TILE);
      if (p.t > .4 && overlap(pb, { x: p.img.x - 8, y: p.img.y - 8, w: 16, h: 16 })) { this.collect(p); p.coll.destroy(); p.img.destroy(); p.glow.destroy(); this.pickups.splice(i, 1); }
    }
    for (const c of this.chests) {
      if (c.opened) continue;
      c.glow.setAlpha(.45 + Math.sin(this.time.now / 200) * .15);
      if (overlap(pb, { x: c.img.x - 9, y: c.img.y - 8, w: 18, h: 16 })) this.openChest(c);
    }
  }

  collect(p) {
    const pl = this.player;
    if (p.kind === 'item') {
      const worn = pl.addItem(p.id); this.runStats.items++;   // 출전 중인 포켓몬이 바로 장착 (5칸이 차 있으면 가방으로)
      this.events.emit('toast', worn ? `${ITEMS[p.id].name} → ${pl.formName()} 장착! ${ITEMS[p.id].desc}` : `${ITEMS[p.id].name} → 가방에 넣었다 (${pl.formName()} 장착 칸 ${MAX_EQUIP}개가 가득) · 가방에서 다른 포켓몬에게 장착`, p.id);
      Sfx.play('item'); this.fx.burst(pl.x, pl.y, [0xffe08a, 0xffffff], 14, 120, { glow: true });
    } else if (p.kind === 'oran') {
      pl.heal(pl.m.maxhp * .2); Sfx.play('heal');
    } else if (p.kind === 'potion') {   // 상처약: 출전 중인 포켓몬 체력 40%
      const c = CONSUMABLES.potion;
      pl.heal(pl.m.maxhp * c.heal); if (p.mark) p.mark.taken = true;
      this.events.emit('toast', `${c.name}을 썼다! ${pl.formName()} 체력 회복`, 'potion');
      Sfx.play('heal'); this.fx.burst(pl.x, pl.y, [0xd88aff, 0xffffff, 0x8affb0], 16, 110, { glow: true, up: 70 });
    } else if (p.kind === 'zcrystal') {
      if (pl.z.has) return;
      pl.z.has = true; pl.z.cd = 0;
      this.events.emit('banner', 'Z크리스탈 획득!', `Q 로 Z기술 — ${pl.members.map(m => ZMOVES[m.sp.zmove].name).join(' · ')}`);
      Sfx.play('unlock'); this.fx.ring(pl.x, pl.y, 50, 0xfff6a0, 400); this.fx.burst(pl.x, pl.y, [0xfff6a0, 0xffffff, 0x9ad8ff], 24, 160, { glow: true });
    } else if (p.kind === 'formitem') {   // 폼체인지 아이템: 그 전설이 파티에 있으면 V 로 오리진폼 (포켓몬센터 보관함에서 데려올 수 있다)
      const it = FORM_ITEMS[p.id], who = Object.values(SPECIES).find(sp => sp.megas.some(m => m.item === p.id));
      pl.formItems.add(p.id);
      this.events.emit('banner', `${it.name} 획득!`, `${who ? who.name : '그 전설'}을(를) 파티에 넣고 V 로 폼체인지 — 이번 판 끝까지 유지`);
      Sfx.play('unlock'); this.fx.ring(pl.x, pl.y, 50, it.color, 400); this.fx.burst(pl.x, pl.y, [it.color, 0xffffff], 24, 160, { glow: true });
    } else {
      pl.mega.stones++;
      this.events.emit('banner', '메가스톤 획득!', pl.tier >= 2 ? 'V 로 메가진화 — 이번 판 끝까지 유지' : `3단 진화 후 V 로 메가진화 (진화까지 ${pl.expToNext()})`);
      Sfx.play('unlock'); this.fx.ring(pl.x, pl.y, 50, 0xff8ad0, 400);
    }
  }

  // 상자 data: 월드에 남는 기록 { x, y, treasure, opened }
  spawnChest(data) {
    const img = this.add.image(Math.round(data.x), Math.round(data.y - 6), data.opened ? 'chest-open' : 'chest').setDepth(15);
    const glow = this.add.image(data.x, data.y - 6, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd25a).setScale(.7).setAlpha(data.opened ? .2 : 1).setDepth(14);
    this.chests.push({ img, glow, data, opened: !!data.opened, treasure: data.treasure });
  }

  openChest(c) {
    c.opened = c.data.opened = true; c.img.setTexture('chest-open'); c.glow.setAlpha(.2);
    Sfx.play('item'); this.fx.burst(c.img.x, c.img.y, [0xffd25a, 0xffffff, 0xff7a6a], 20, 140, { glow: true });
    // 상자는 대개 오렌열매, 아주 가끔 강화 아이템 (보물 상자는 조금 더 자주 + 오렌열매 하나 더)
    if (Math.random() < (c.treasure ? ITEM_DROP.treasure : ITEM_DROP.chest)) this.spawnPickup('item', c.img.x, c.img.y - 6, pick(ITEM_KEYS));
    else this.spawnPickup('oran', c.img.x, c.img.y - 6);
    if (c.treasure) this.spawnPickup('oran', c.img.x - 4, c.img.y - 6);
  }

  // ---------------- 출구 포털 / 스테이지 전환 ----------------
  spawnPortal(x, gy) {
    const g = this.add.graphics().setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
    const glow = this.add.image(x, gy - 20, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9a7aff).setScale(1.4).setDepth(12);
    this.portal = { x, y: gy - 20, g, glow, t: 0 };
    this.events.emit('toast', this.stageIdx >= STAGES.length - 1 ? '모든 것의 원흉을 정화했다! 포털로 들어가자' : `${STAGES[this.stageIdx + 1].region}로 가는 포털이 열렸다!`);
  }

  updatePortal(dt) {
    const pt = this.portal; if (!pt) return;
    pt.t += dt;
    const g = pt.g; g.clear();
    for (let k = 0; k < 4; k++) {
      const r = 9 + k * 4 + Math.sin(pt.t * 4 + k) * 1.5;
      g.lineStyle(2, [0x9a7aff, 0xff8ad0, 0x5ad0ff, 0xffffff][k], .7 - k * .12);
      g.strokeEllipse(pt.x, pt.y, r * 1.1, r * 2);
    }
    if (Math.random() < .5) this.fx.embers(pt.x + rand(-10, 10), pt.y + 18, [0x9a7aff, 0xff8ad0], 1);
    if (!this.transitioning && overlap(this.player.bounds(), { x: pt.x - 10, y: pt.y - 20, w: 20, h: 40 })) this.nextStage();
  }

  nextStage() {
    // 포털에 먼저 들어가도 떨어진 메가스톤·아이템은 잃지 않게 자동으로 줍는다
    for (const p of this.pickups.slice()) if (p.kind !== 'oran' && p.kind !== 'potion') { this.collect(p); p.coll.destroy(); p.img.destroy(); p.glow.destroy(); }
    this.pickups = this.pickups.filter(p => p.kind === 'oran' || p.kind === 'potion');
    if (this.stageIdx >= STAGES.length - 1) { this.gameOver(true); return; }
    this.transitioning = true;
    Sfx.play('clear');
    const cam = this.cameras.main;
    cam.fadeOut(450, 7, 6, 15);
    cam.once('camerafadeoutcomplete', () => {
      this.stageIdx++;
      const p = this.player;
      p.stageBonus *= 1.15;
      for (const m of p.members) {
        const k = m.alive ? m.hp / m.maxhp : 0;
        m.maxhp = p.maxHpOf(m);   // 스테이지 보너스 × 진화 단계
        m.hp = m.alive ? Math.min(m.maxhp, Math.round(m.maxhp * Math.min(1, k + .3))) : Math.round(m.maxhp * .4);
        m.alive = true;
      }
      this.buildWorld();
      cam.fadeIn(450, 7, 6, 15);
      this.transitioning = false;
    });
  }

  // quit: 일시정지 메뉴의 '포기하고 도감으로' (전멸과 달리 판을 끝낸다)
  gameOver(won, quit = false) {
    if (!won && !quit) { this.respawn(); return; }   // 전멸해도 끝이 아니다: 마지막 포켓몬센터에서 다시 일어난다
    if (this.over) return;
    this.over = true;
    Music.stop();
    Save.recordRun(this.stageIdx + 1, won);
    if (won) RunSave.clear();   // 끝까지 깼으면 이어하기 기록은 지운다
    this.physics.world.pause();
    this.events.emit('gameover', {
      won, stage: this.stageIdx + 1, stageName: this.stage.name, kills: this.runStats.kills, items: this.runStats.items,
      unlocked: this.runStats.unlocked, time: (this.time.now - this.runStats.start) / 1000
    });
  }

  backToLobby() {
    this.cleanup();
    this.scene.stop('UI');
    this.scene.start('Lobby');
  }
}
