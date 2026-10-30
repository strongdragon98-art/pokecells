// 화면 왜곡 충격파 (Shockwave Distortion) — WebGL 후처리 셰이더
//  큰 순간(Z기술 · 메가진화 · 보스 그로기 · 기라티나 차원 붕괴 3타 · 주변 폭발 기술)에 화면이 물결처럼 한 번 일그러진다
//  카메라에 붙인 PostFXPipeline: 퍼져 나가는 고리 둘레의 픽셀을 바깥쪽으로 밀어 굴절처럼 보이게 하고, 고리에 살짝 빛을 더한다
//  (블룸·비네트는 카메라 postFX 가 이미 맡고 있다 · 잔상은 systems/Fx.ghost)
import Phaser from 'phaser';

const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uCenter;
uniform float uProgress;
uniform float uAspect;
uniform float uStrength;
varying vec2 outTexCoord;
void main() {
  vec2 uv = outTexCoord;
  vec2 d = uv - uCenter;
  d.x *= uAspect;
  float dist = length(d);
  float radius = uProgress * 0.75;
  float width = 0.06 + uProgress * 0.05;
  float ring = 1.0 - smoothstep(0.0, width, abs(dist - radius));
  float fade = 1.0 - uProgress;
  vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0);
  vec2 off = dir * ring * uStrength * fade;
  off.x /= uAspect;
  vec4 c = texture2D(uMainSampler, uv - off);
  c.rgb += ring * fade * 0.06;
  gl_FragColor = c;
}`;

export class ShockwaveFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game) {
    super({ game, name: 'ShockwaveFX', fragShader: FRAG });
    this.center = { x: .5, y: .5 }; this.progress = 1; this.strength = .03;
  }
  onPreRender() {
    this.set2f('uCenter', this.center.x, this.center.y);
    this.set1f('uProgress', this.progress);
    this.set1f('uAspect', this.renderer.width / this.renderer.height);
    this.set1f('uStrength', this.strength);
  }
}

// 월드 좌표 (x, y) 에서 충격파 한 번 (strength 0.02 ~ 0.05). WebGL 이 아니면 아무것도 안 한다
//  카메라에 잠깐 붙였다가 끝나면 뗀다 (평소엔 셰이더 비용 없음 · 겹치면 새 충격파로 다시 시작)
export function shockwave(scene, x, y, strength = .035, ms = 650) {
  if (!scene || !scene.renderer || scene.renderer.type !== Phaser.WEBGL || !scene.cameras || !scene.cameras.main) return;
  const cam = scene.cameras.main, v = cam.worldView;
  clearShockwaves(cam);
  cam.setPostPipeline(ShockwaveFX);
  let fx = cam.getPostPipeline(ShockwaveFX);
  if (Array.isArray(fx)) fx = fx[fx.length - 1];
  if (!fx) return;
  fx.center.x = (x - v.x) / v.width;
  fx.center.y = 1 - (y - v.y) / v.height;   // GL 텍스처는 아래가 0
  fx.strength = strength; fx.progress = 0;
  scene.tweens.add({ targets: fx, progress: 1, duration: ms, ease: 'Sine.easeOut', onComplete: () => clearShockwaves(cam) });
}

// 카메라에 붙은 충격파 셰이더를 모두 뗀다 (removePostPipeline 은 클래스가 아니라 인스턴스를 줘야 지워진다)
function clearShockwaves(cam) {
  for (const p of (cam.postPipelines || []).filter(q => q instanceof ShockwaveFX)) cam.removePostPipeline(p);
}
