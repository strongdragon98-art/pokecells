// 오브젝트 풀: 잠깐 쓰고 버리는 이미지·글자(타격 섬광·고리·잔상·파티클·투사체 그림·데미지 숫자)를
//  매번 만들고 destroy() 하지 않고, 다 쓰면 숨겨 두었다가(setActive(false).setVisible(false)) 다음에 다시 꺼내 쓴다.
//  → 가비지 컬렉션 끊김과 WebGL 오브젝트 생성 비용을 줄인다 (모바일 사파리)
//  get() 은 매번 처음 만든 것과 같은 기본 상태(투명도 1·크기 1·회전 0·틴트 없음·일반 블렌드·가운데 원점)로 돌려준다.
import Phaser from 'phaser';

const NORMAL = Phaser.BlendModes.NORMAL;

export class ImagePool {
  constructor(scene, max = 900) {
    this.s = scene; this.max = max;
    this.idle = [];        // 쉬는 이미지
    this.made = 0;         // 지금까지 만든 수 (디버그 표시용)
  }

  get(x, y, key, frame) {
    let im = this.idle.pop();
    while (im && !im.scene) im = this.idle.pop();   // 씬이 바뀌며 이미 사라진 것은 버린다
    if (!im) { im = this.s.add.image(x, y, key, frame); this.made++; }
    else im.setTexture(key, frame).setPosition(x, y).setActive(true).setVisible(true);
    im.pooled = true; im.released = false;
    return im;
  }

  // 다 쓴 이미지 돌려놓기 (트윈도 함께 멈춘다). destroy() 대신 부른다
  release(im) {
    if (!im || !im.scene || im.released) return;
    this.s.tweens.killTweensOf(im);
    im.released = true;
    im.setActive(false).setVisible(false)
      .setAlpha(1).setScale(1).setRotation(0).setFlip(false, false).setOrigin(.5).clearTint().setBlendMode(NORMAL).setDepth(0);
    if (this.idle.length < this.max) this.idle.push(im);
    else im.destroy();
  }

  // 챕터를 바꿀 때: 쉬는 것들은 그대로 두고, 아무도 안 돌려준 채 남은 것은 없는지 셀 때 쓴다
  get size() { return this.idle.length; }

  destroy() { for (const im of this.idle) if (im.scene) im.destroy(); this.idle = []; }
}

// 글자 풀: 데미지 숫자·떠오르는 알림 글자. 스타일은 꺼낼 때마다 다시 정한다
export class TextPool {
  constructor(scene, max = 80) { this.s = scene; this.max = max; this.idle = []; }

  get(x, y, str, style) {
    let t = this.idle.pop();
    while (t && !t.scene) t = this.idle.pop();
    if (!t) t = this.s.add.text(x, y, str, style);
    else t.setStyle(style).setText(str).setPosition(x, y).setActive(true).setVisible(true);
    t.released = false;
    return t;
  }

  release(t) {
    if (!t || !t.scene || t.released) return;
    this.s.tweens.killTweensOf(t);
    t.released = true;
    t.setActive(false).setVisible(false).setAlpha(1).setScale(1).setOrigin(0).setDepth(0);
    if (this.idle.length < this.max) this.idle.push(t);
    else t.destroy();
  }

  destroy() { for (const t of this.idle) if (t.scene) t.destroy(); this.idle = []; }
}
