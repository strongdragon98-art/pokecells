// 메가 · 특수 폼 컷아웃 리깅: SpriteCollab 모션 시트가 없는 폼은 본가 외형 도트 한 장(data/megaRig.js — Showdown Gen5 · PokeAPI)을
//  신체 부위별로 잘라(상체 · 앞팔/무기 · 등/날개/등딱지 · 왼다리 · 오른다리) 관절마다 따로 움직인 프레임을 만들어 모션 시트로 쓴다
//  모션: Idle 숨쉬기 · Walk 교차 보행 + 앞으로 숙임 · Attack 앞팔 크게 휘두르기(잔상) · Strike 몸 비틀며 등 부위로 올려치기
//   · Shoot 반동 → 앞으로 튕겨 나가기(등 무기 반동 · 찌그러짐) · Hurt 뒤로 젖혀짐 · Strike/Shoot 는 3타 · 차징 · 스킬이 쓴다
//  결과는 'sheet:{key}:{모션}' 2행 시트 (0행 오른쪽 · 1행 왼쪽 — SpriteLoader 의 잘라 낸 시트와 같은 꼴)
import { RIG_SOURCES } from '../data/megaRig.js';

export const RIG_KEYS = Object.keys(RIG_SOURCES);
export const rigImageKey = key => `rig:${key}`;
export const rigImagePath = key => `sprites/${key}/gen5.png`;

const D = Math.PI / 180, SEAM = .06;   // SEAM: 부위 경계를 겹쳐 그리는 폭 (그림 크기 비율)
// 모션별 프레임 길이(60분의 1초) · 맞는 프레임 · 프레임마다 자세 (각도는 도 · 원본 그림은 왼쪽을 본다 — 앞 = -x)
//  up 상체 · arm 앞팔 · back 등 부위 · legL/legR 다리 · all 전체 { rot, dx, dy, sx, sy } · smear: 앞팔/등 부위 잔상
const POSES = {
  Idle: { dur: [10, 10, 10, 10, 10, 10], hit: -1, pose: i => { const b = Math.sin(i / 6 * Math.PI * 2); return { up: { dy: -b, sy: 1 + b * .025 }, arm: { rot: b * 3 }, back: { rot: -b * 5 }, all: {} }; } },
  Walk: { dur: [6, 6, 6, 6, 6, 6], hit: -1, pose: i => { const s = Math.sin(i / 6 * Math.PI * 2); return { up: { rot: -10, dy: -Math.abs(s) }, arm: { rot: s * 12 }, back: { rot: s * 9 }, legL: { dy: -Math.max(0, s) * 2.5, dx: -s }, legR: { dy: -Math.max(0, -s) * 2.5, dx: s }, all: {} }; } },
  Attack: { dur: [3, 3, 2, 4, 5], hit: 2, pose: i => ({ up: { rot: [4, 7, -12, -10, -3][i] }, arm: { rot: [-26, -36, 52, 42, 10][i] }, back: { rot: [4, 6, -6, -4, 0][i] }, all: { dx: [1, 2, -3, -2, 0][i] }, smear: i === 2 || i === 3 ? 'arm' : null }) },
  Strike: { dur: [3, 3, 2, 4, 5], hit: 2, pose: i => ({ up: { rot: [8, 12, -14, -10, -4][i] }, arm: { rot: [-10, -20, 36, 26, 6][i] }, back: { rot: [10, 20, -34, -22, -5][i] }, all: { dy: [0, 1, -3, -2, 0][i] }, smear: i === 2 ? 'back' : null }) },
  Shoot: { dur: [4, 4, 2, 4, 5], hit: 2, pose: i => ({ up: { rot: [10, 15, -15, -10, -3][i] }, arm: { rot: [-20, -28, 52, 40, 10][i] }, back: { dx: [3, 5, -4, -2, 0][i], rot: [4, 6, -8, -4, 0][i] }, all: { dx: [3, 4, -5, -4, -1][i], sx: [1.04, 1.06, .92, .97, 1][i], sy: [.96, .94, 1.08, 1.03, 1][i] }, smear: i === 2 ? 'arm' : null }) },
  Hurt: { dur: [4, 6, 8], hit: -1, pose: i => ({ up: { rot: [14, 18, 10][i] }, arm: { rot: [-20, -26, -12][i] }, back: { rot: [10, 14, 6][i] }, all: { dx: [4, 5, 3][i], sx: [.96, .95, .98][i] } }) }
};
export const RIG_ANIMS = Object.keys(POSES);

// 그림 → 잘라 낸 부위 (한 번만)
const cache = new Map();
export function rigPrep(tm, key) {
  if (cache.has(key)) return cache.get(key);
  const tk = rigImageKey(key);
  if (!tm.exists(tk)) return null;
  const img = tm.get(tk).getSourceImage();
  const W = img.width, H = img.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0);
  let px; try { px = c.getImageData(0, 0, W, H).data; } catch (e) { return null; }
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, o = RIG_SOURCES[key].rig || {};
  const hip = o.hip ?? .66, arm = { x1: (o.arm && o.arm.x1) ?? .34, y0: (o.arm && o.arm.y0) ?? .22 }, back = { x0: (o.back && o.back.x0) ?? .6, y1: (o.back && o.back.y1) ?? .48 };
  // 부위 캔버스 (잘라 낸 그림 좌표 w × h)
  const parts = {}, mk = () => { const p = document.createElement('canvas'); p.width = w; p.height = h; return p; };
  for (const n of ['up', 'arm', 'back', 'legL', 'legR']) parts[n] = mk();
  const ctxs = Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, p.getContext('2d')]));
  const datas = Object.fromEntries(Object.entries(ctxs).map(([n, x]) => [n, x.createImageData(w, h)]));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((y0 + y) * W + x0 + x) * 4;
    if (px[si + 3] < 8) continue;
    const ry = y / h, rx = x / w, di = (y * w + x) * 4;
    const set = (part, k = 1) => { const d = datas[part].data; d[di] = px[si] * k; d[di + 1] = px[si + 1] * k; d[di + 2] = px[si + 2] * k; d[di + 3] = px[si + 3]; };
    // 다리: 엉덩이 경계 위로 조금 · 가운데 띠는 양쪽 다리에 겹쳐 넣는다 (움직여도 금이 가지 않게)
    if (ry >= hip - SEAM) { if (rx < .5 + SEAM) set('legL'); if (rx >= .5 - SEAM) set('legR'); if (ry >= hip) continue; }
    const part = rx >= back.x0 && ry <= back.y1 ? 'back' : rx <= arm.x1 && ry >= arm.y0 ? 'arm' : 'up';
    set(part);
    if (part === 'arm') set('up', .45);   // 받침: 앞팔이 움직여 비는 자리에 어두운 그림자 (제자리에선 팔이 덮는다 · 등 부위는 상체 뒤라 받침이 필요 없다)
  }
  for (const n of Object.keys(parts)) ctxs[n].putImageData(datas[n], 0, 0);
  const piv = { up: [w * .5, h * hip], arm: [w * arm.x1, h * (arm.y0 + (hip - arm.y0) * .15)], back: [w * back.x0, h * back.y1], legL: [w * .25, h], legR: [w * .75, h] };
  const fw = Math.ceil(w * 1.7) + 8, fh = Math.ceil(h * 1.45) + 8, footY = Math.round(fh * .8);
  // 눈 위치 (오른쪽을 볼 때 기준): 위쪽 35% 에서 가장 앞(원본은 왼쪽)
  let ex = w / 2, ey = h * .2;
  for (let y = 0; y < h * .35; y++) for (let x = 0; x < w; x++) if (px[((y0 + y) * W + x0 + x) * 4 + 3] > 40) { if (w - x > ex) { ex = w - x; ey = y; } break; }
  const prep = { w, h, parts, piv, fw, fh, footY, measured: { foot: footY - fh / 2, w, h, eye: { dx: ex - w / 2 - w * .1, dy: ey - h } } };
  cache.set(key, prep);
  return prep;
}

// SpriteLoader 가 쓰는 AnimData 꼴 { 모션: { fw, fh, durations, hit, source } }
export function rigData(prep) {
  return Object.fromEntries(RIG_ANIMS.map(a => [a, { name: a, fw: prep.fw, fh: prep.fh, durations: POSES[a].dur.slice(), hit: POSES[a].hit, rush: -1, source: a }]));
}

// 한 프레임 그리기 (ctx 는 프레임 왼쪽 위로 옮겨져 있다 · mirror: 오른쪽을 보는 줄)
function drawPose(ctx, prep, pose, mirror) {
  const { w, h, parts, piv, fw, footY } = prep, A = pose.all || {};
  ctx.save();
  ctx.translate(fw / 2, footY);
  if (mirror) ctx.scale(-1, 1);
  ctx.translate(A.dx || 0, A.dy || 0);
  ctx.scale(A.sx || 1, A.sy || 1);
  ctx.translate(-w / 2, -h);   // 잘라 낸 그림 좌표로 (발바닥 가운데가 원점)
  const put = (n, t = {}, alpha = 1) => {
    const [px, py] = piv[n];
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(px + (t.dx || 0), py + (t.dy || 0));
    if (t.rot) ctx.rotate(t.rot * D);
    if (t.sx || t.sy) ctx.scale(t.sx || 1, t.sy || 1);
    ctx.drawImage(parts[n], -px, -py);
    ctx.restore();
  };
  const up = pose.up || {}, follow = n => ({ ...pose[n], rot: (pose[n] && pose[n].rot || 0) + (up.rot || 0) * .8, dy: ((pose[n] && pose[n].dy) || 0) + (up.dy || 0) });   // 팔 · 등 부위는 상체를 따라 기운다
  // 상체에 붙은 부위는 엉덩이 축 기준 상체 회전을 함께 받는다
  const withUpper = fn => {
    ctx.save();
    const [hx, hy] = piv.up;
    ctx.translate(hx, hy + (up.dy || 0)); if (up.rot) ctx.rotate(up.rot * D * .2); ctx.translate(-hx, -hy);
    fn(); ctx.restore();
  };
  withUpper(() => {
    if (pose.smear === 'back') { put('back', { ...follow('back'), rot: follow('back').rot + 30 }, .3); put('back', { ...follow('back'), rot: follow('back').rot + 15 }, .45); }
    put('back', follow('back'));
  });
  put('legL', pose.legL); put('legR', pose.legR);
  put('up', up);
  withUpper(() => {
    if (pose.smear === 'arm') { put('arm', { ...follow('arm'), rot: follow('arm').rot - 40 }, .28); put('arm', { ...follow('arm'), rot: follow('arm').rot - 20 }, .45); }
    put('arm', follow('arm'));
  });
  ctx.restore();
}

// 모션 시트 만들기 → 텍스처 'sheet:{key}:{모션}' (2행: 0 오른쪽 · 1 왼쪽)
export function rigSheets(tm, key) {
  const prep = rigPrep(tm, key);
  if (!prep) return false;
  for (const a of RIG_ANIMS) {
    const tk = `sheet:${key}:${a}`;
    if (tm.exists(tk)) continue;
    const n = POSES[a].dur.length, cv = document.createElement('canvas'); cv.width = prep.fw * n; cv.height = prep.fh * 2;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    for (let i = 0; i < n; i++) for (const [row, mirror] of [[0, true], [1, false]]) {
      c.save(); c.translate(i * prep.fw, row * prep.fh);
      c.beginPath(); c.rect(0, 0, prep.fw, prep.fh); c.clip();
      drawPose(c, prep, POSES[a].pose(i), mirror);
      c.restore();
    }
    tm.addSpriteSheet(tk, cv, { frameWidth: prep.fw, frameHeight: prep.fh });
  }
  return true;
}

// 유대변화 개굴닌자: X · C · 차징 때 등에서 손으로 날아가는 거대 물수리검 그림 (Player.updateAshStar)
export function ashStarTexture(scene) {
  const key = 'ash-shuriken';
  if (scene.textures.exists(key)) return key;
  const S = 40, t = scene.textures.createCanvas(key, S, S), c = t.getContext();
  c.translate(S / 2, S / 2);
  for (let k = 0; k < 4; k++) {
    c.save(); c.rotate(k * Math.PI / 2);
    c.beginPath(); c.moveTo(-3, -3); c.quadraticCurveTo(4, -10, 2, -19); c.quadraticCurveTo(9, -9, 4, 2); c.closePath();
    c.fillStyle = '#0a2a6a'; c.fill();
    c.beginPath(); c.moveTo(-2, -3); c.quadraticCurveTo(4, -9, 2, -16); c.quadraticCurveTo(7, -8, 3, 1); c.closePath();
    const g = c.createLinearGradient(0, -16, 4, 0); g.addColorStop(0, '#bff4ff'); g.addColorStop(.5, '#3ec9ff'); g.addColorStop(1, '#1195f8');
    c.fillStyle = g; c.fill();
    c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(2, -13, 1, 6);
    c.restore();
  }
  c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fillStyle = '#0a2a6a'; c.fill();
  c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fillStyle = '#7ad8ff'; c.fill();
  c.fillStyle = '#ffffff'; c.fillRect(-2, -2, 2, 2);
  t.refresh();
  return key;
}
