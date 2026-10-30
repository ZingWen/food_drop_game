import Phaser from 'phaser';
import { FoodDef } from '../config';

export const FOOD_SIZE = 48; // 16px 像素圖放大 3 倍
export const FOOD_RADIUS = 21;

/** 把圖片等比例縮放到最長邊為 size（不管原圖多大都一致） */
export function fitSize(img: Phaser.GameObjects.Image, size: number) {
  img.setScale(size / Math.max(img.width, img.height));
}

export type FoodState = 'warning' | 'flying' | 'gone';

export class Food {
  readonly sprite: Phaser.GameObjects.Image;
  readonly def: FoodDef;
  readonly ledge: number;
  state: FoodState = 'warning';
  vx = 0;
  vy = 0;
  prevY = 0;
  /** 被籃子側面彈開後就接不到了 */
  catchable = true;
  /** 沒接到會不會扣愛心（瘋狂掉落時可以關掉） */
  missHurts = true;

  private warnLeft: number;
  private shake: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, def: FoodDef, ledge: number, x: number, y: number, warnSeconds: number) {
    this.def = def;
    this.ledge = ledge;
    this.warnLeft = warnSeconds;
    this.sprite = scene.add.image(x, y, Phaser.Math.RND.pick(def.textures)).setDepth(3);
    fitSize(this.sprite, FOOD_SIZE);
    this.prevY = y;
    this.shake = scene.tweens.add({
      targets: this.sprite,
      angle: { from: -12, to: 12 },
      duration: 70,
      yoyo: true,
      repeat: -1,
    });
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get texture() { return this.sprite.texture.key; }

  setPosition(x: number, y: number) {
    this.sprite.setPosition(x, y);
  }

  /** 倒數預警，時間到回傳 true */
  tickWarning(dt: number): boolean {
    this.warnLeft -= dt;
    return this.warnLeft <= 0;
  }

  jump(vx: number, vy: number) {
    this.shake.stop();
    this.sprite.angle = 0;
    this.vx = vx;
    this.vy = vy;
    this.state = 'flying';
  }

  step(dt: number, gravity: number) {
    this.prevY = this.sprite.y;
    this.vy += gravity * dt;
    this.sprite.x += this.vx * dt;
    this.sprite.y += this.vy * dt;
    this.sprite.angle += this.vx * dt * 0.8;
  }

  /** 撞到籃子側面：往外彈開，之後不能再被接住 */
  bounce(direction: number) {
    this.catchable = false;
    this.vx = direction * 160;
    this.vy = -140;
  }

  /** 被接住：直接消失 */
  remove() {
    this.state = 'gone';
    this.shake.stop();
    this.sprite.destroy();
  }

  /** 掉到地上：壓扁、淡出 */
  land(scene: Phaser.Scene) {
    this.state = 'gone';
    scene.tweens.add({
      targets: this.sprite,
      scaleY: this.sprite.scaleY * 0.4,
      alpha: 0,
      duration: 450,
      onComplete: () => this.sprite.destroy(),
    });
  }
}
