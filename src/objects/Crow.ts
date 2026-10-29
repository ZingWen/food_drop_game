import Phaser from 'phaser';
import { BASKET, CROW } from '../config';
import { CAPE_FRAME_W, CAPE_NECK, CROW_FRAME } from '../placeholders';
import { fitSize } from './Food';

export interface BasketItem {
  texture: string;
  stock: number;
}

export interface Rim {
  x: number;
  y: number;
  halfWidth: number;
}

export const ITEM_SIZE = 32; // 16px 像素圖放大 2 倍
/** 籃子裡食物的擺放位置（相對掛點），由下往上堆 */
const ITEM_SLOTS = [
  [-27, 36], [-9, 36], [9, 36], [27, 36],
  [-18, 26], [0, 26], [18, 26],
  [0, 16],
];

/**
 * 披風：飄動的部分放在烏鴉後面，領口疊在前面。
 * 以脖子為轉軸，飛越快尾端越往上揚。回傳 [披風, 領口]
 */
export function createCape(scene: Phaser.Scene): [Phaser.GameObjects.Sprite, Phaser.GameObjects.Image] {
  // 披風圖右邊 128px 和烏鴉的格子對齊，換算成相對烏鴉中心的位置
  const neckX = CAPE_NECK.x - (CAPE_FRAME_W - CROW_FRAME) - CROW_FRAME / 2 + CROW.cape.x;
  const neckY = CAPE_NECK.y - CROW_FRAME / 2 + CROW.cape.y;
  const cape = scene.add.sprite(neckX, neckY, 'crow_cape').play('cape_flutter');
  cape.setOrigin(CAPE_NECK.x / cape.width, CAPE_NECK.y / cape.height).setVisible(CROW.cape.show);
  const collar = scene.add.image(CROW.cape.x, CROW.cape.y, 'crow_cape_collar').setVisible(CROW.cape.show);
  return [cape, collar];
}

/**
 * 烏鴉 + 籃子。
 * 圖層由後到前：烏鴉 → 籃子後層 → 籃子裡的食物 → 籃子前層
 */
export class Crow {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly bird: Phaser.GameObjects.Sprite;
  private readonly cape: Phaser.GameObjects.Sprite;
  private readonly basket: Phaser.GameObjects.Container;
  private readonly basketParts: Phaser.GameObjects.Image[];
  private readonly itemLayer: Phaser.GameObjects.Container;
  private readonly stars: Phaser.GameObjects.Image;

  private items: BasketItem[] = [];
  private vx = 0;
  private vy = 0;
  private facing = 1;
  private stunLeft = 0;
  private dirtyLeft = 0;
  private lastRimY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.bird = scene.add.sprite(0, 0, 'crow').play('crow_fly');
    const [cape, collar] = createCape(scene);
    this.cape = cape;
    const back = scene.add.image(0, 0, 'basket_back').setOrigin(0.5, 0);
    const front = scene.add.image(0, 0, 'basket_front').setOrigin(0.5, 0);
    this.itemLayer = scene.add.container(0, 0);
    this.basketParts = [back, front];
    this.basket = scene.add.container(CROW.beak.x, CROW.beak.y, [back, this.itemLayer, front]);
    this.stars = scene.add.image(70, -40, 'fx_stun').setVisible(false);
    this.root = scene.add.container(x, y, [this.cape, this.bird, collar, this.basket, this.stars]).setDepth(4);
    this.lastRimY = this.rim().y;
  }

  get x() { return this.root.x; }
  get y() { return this.root.y; }
  get itemCount() { return this.items.length; }
  get isFull() { return this.items.length >= BASKET.capacity; }
  get isStunned() { return this.stunLeft > 0; }
  /** 上一幀的籃口高度（判斷食物是否「從上方」穿過籃口用） */
  get previousRimY() { return this.lastRimY; }

  setPosition(x: number, y: number) {
    this.root.setPosition(x, y);
    this.lastRimY = this.rim().y;
  }

  /** 籃口在世界座標的位置 */
  rim(): Rim {
    return {
      x: this.root.x + this.facing * CROW.beak.x,
      y: this.root.y + CROW.beak.y + BASKET.rimY,
      halfWidth: BASKET.rimHalfWidth,
    };
  }

  /**
   * @param dir   鍵盤方向（-1～1）
   * @param drag  觸控/滑鼠累積的拖曳距離，會被這裡消耗掉
   */
  update(dt: number, dir: { x: number; y: number }, drag: { x: number; y: number }, zone: Phaser.Geom.Rectangle) {
    this.lastRimY = this.rim().y;
    const load = this.items.length / BASKET.capacity;
    const maxSpeed = CROW.speed * (1 - BASKET.fullSpeedPenalty * load);

    if (this.stunLeft > 0) {
      // 暈眩：不能控制，慢慢往下飄
      this.stunLeft -= dt;
      this.vx *= 0.92;
      this.vy = 70;
      drag.x = drag.y = 0;
      this.root.x += this.vx * dt;
      this.root.y += this.vy * dt;
    } else if (drag.x !== 0 || drag.y !== 0) {
      const len = Math.hypot(drag.x, drag.y);
      const step = Math.min(len, maxSpeed * dt);
      const mx = (drag.x / len) * step;
      const my = (drag.y / len) * step;
      this.root.x += mx;
      this.root.y += my;
      drag.x -= mx;
      drag.y -= my;
      if (Math.abs(drag.x) < 0.5 && Math.abs(drag.y) < 0.5) drag.x = drag.y = 0;
      this.vx = mx / dt;
      this.vy = my / dt;
    } else {
      const len = Math.hypot(dir.x, dir.y) || 1;
      const maxDv = CROW.accel * dt;
      this.vx += Phaser.Math.Clamp((dir.x / len) * maxSpeed - this.vx, -maxDv, maxDv);
      this.vy += Phaser.Math.Clamp((dir.y / len) * maxSpeed - this.vy, -maxDv, maxDv);
      this.root.x += this.vx * dt;
      this.root.y += this.vy * dt;
    }
    this.clampTo(zone);

    if (this.vx > 30) this.facing = 1;
    else if (this.vx < -30) this.facing = -1;
    this.root.scaleX = this.facing;

    // 籃子像鐘擺一樣跟著慣性晃動；暈眩時亂晃
    const t = this.scene.time.now / 1000;
    const sway = this.isStunned
      ? Math.sin(t * 14) * 0.5
      : Phaser.Math.Clamp(((this.vx * this.facing) / CROW.speed) * 0.35, -0.4, 0.4);
    this.basket.rotation += (sway - this.basket.rotation) * Math.min(1, dt * 8);

    this.bird.anims.timeScale = this.isStunned ? 0.3 : 1 + Math.hypot(this.vx, this.vy) / CROW.speed;
    // 飛越快，披風飄越快、越往後揚
    const speed = Math.hypot(this.vx, this.vy) / CROW.speed;
    this.cape.anims.timeScale = this.isStunned ? 0.4 : 0.8 + speed * 1.5;
    this.cape.rotation += ((this.isStunned ? -0.3 : speed * 0.15) - this.cape.rotation) * Math.min(1, dt * 6);
    this.stars.setVisible(this.isStunned);
    this.stars.angle += dt * 360;

    if (this.dirtyLeft > 0) {
      this.dirtyLeft -= dt;
      if (this.dirtyLeft <= 0) this.basketParts.forEach((p) => p.clearTint());
    }
  }

  clampTo(zone: Phaser.Geom.Rectangle) {
    const x = Phaser.Math.Clamp(this.root.x, zone.left, zone.right);
    const y = Phaser.Math.Clamp(this.root.y, zone.top, zone.bottom);
    if (x !== this.root.x) this.vx = 0;
    if (y !== this.root.y) this.vy = 0;
    this.root.setPosition(x, y);
  }

  stun(seconds: number) {
    this.stunLeft = Math.max(this.stunLeft, seconds);
  }

  makeDirty(seconds: number) {
    this.dirtyLeft = seconds;
    this.basketParts.forEach((p) => p.setTint(0x7f9a3a));
  }

  addItem(texture: string, stock: number) {
    if (this.isFull) return;
    const [sx, sy] = ITEM_SLOTS[this.items.length];
    this.items.push({ texture, stock });
    const icon = this.scene.add.image(sx, sy, texture);
    fitSize(icon, ITEM_SIZE);
    this.itemLayer.add(icon);

    // 接到時籃子往下一沉
    this.scene.tweens.killTweensOf(this.basket);
    this.basket.y = CROW.beak.y + 8;
    this.scene.tweens.add({ targets: this.basket, y: CROW.beak.y, duration: 220, ease: 'Back.easeOut' });
  }

  /** 卸貨：取出籃子裡全部的食物 */
  takeAll(): BasketItem[] {
    const items = this.items;
    this.items = [];
    this.itemLayer.removeAll(true);
    return items;
  }

  /** 炸彈：籃子裡的食物全部噴出去 */
  spill() {
    const rim = this.rim();
    for (const item of this.takeAll()) {
      const img = this.scene.add.image(rim.x, rim.y, item.texture).setDepth(5);
      fitSize(img, ITEM_SIZE);
      this.scene.tweens.add({
        targets: img,
        x: rim.x + Phaser.Math.Between(-140, 140),
        y: rim.y + Phaser.Math.Between(60, 200),
        angle: Phaser.Math.Between(-360, 360),
        alpha: 0,
        duration: 800,
        ease: 'Quad.easeIn',
        onComplete: () => img.destroy(),
      });
    }
  }
}
