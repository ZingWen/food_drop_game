import Phaser from 'phaser';
import { BUILDING } from '../config';
import { FOOD_SIZE } from './Food';

/** 右側的大樓。窗台編號 0 = 最上面那層 */
export class Building {
  private readonly gfx: Phaser.GameObjects.Graphics;
  left = 0;
  private groundY = 0;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(1);
  }

  /** 讓大樓右邊貼齊 right、底部站在地面上 */
  layout(right: number, groundY: number) {
    this.left = right - BUILDING.width;
    this.groundY = groundY;
    this.draw();
  }

  ledgeY(index: number): number {
    return this.groundY - (BUILDING.ledges - index) * BUILDING.floorHeight;
  }

  /** 食物站在窗台上的位置 */
  foodSpot(index: number) {
    return { x: this.left - BUILDING.ledgeDepth / 2, y: this.ledgeY(index) - FOOD_SIZE / 2 };
  }

  private draw() {
    const { width, floorHeight, ledges, ledgeDepth } = BUILDING;
    const g = this.gfx;
    const floors = ledges + 1;
    const top = this.groundY - floors * floorHeight;
    const left = this.left;
    g.clear();

    // 石牆 + 磚縫
    g.fillStyle(0x8d93a6, 1).fillRect(left, top, width, floors * floorHeight);
    g.fillStyle(0x6b7184, 1);
    for (let y = top, row = 0; y < this.groundY; y += 16, row++) {
      g.fillRect(left, y, width, 2);
      for (let x = left + (row % 2 ? 16 : 0); x < left + width; x += 32) g.fillRect(x, y, 2, 16);
    }
    g.fillStyle(0xa8aec0, 1).fillRect(left, top, 6, floors * floorHeight);
    g.fillStyle(0x5d6274, 1).fillRect(left + width - 8, top, 8, floors * floorHeight);

    // 城垛 + 旗子
    g.fillStyle(0x7a8094, 1).fillRect(left - 8, top - 12, width + 16, 12);
    for (let x = left - 8; x < left + width + 8; x += 40) {
      g.fillStyle(0x8d93a6, 1).fillRect(x, top - 32, 24, 20);
      g.fillStyle(0xa8aec0, 1).fillRect(x, top - 32, 24, 4);
    }
    const poleX = left + width / 2;
    g.fillStyle(0x5a3a1a, 1).fillRect(poleX, top - 96, 4, 64);
    for (let r = 0; r < 6; r++) {
      const w = (6 - Math.abs(r - 2.5) * 2) * 8;
      g.fillStyle(r === 0 ? 0xff6a5a : 0xd83a3a, 1).fillRect(poleX + 4, top - 96 + r * 6, w, 6);
    }

    // 拱形窗戶（暖光），一樓中間是木門
    for (let f = 0; f < floors; f++) {
      const fy = top + f * floorHeight;
      for (let w = 0; w < 3; w++) {
        const wx = left + 30 + w * 70;
        if (f === floors - 1 && w === 1) this.drawDoor(wx - 4, fy + 22, 48, floorHeight - 22);
        else this.drawWindow(wx, fy + 22, (f * 3 + w) % 4 !== 1);
      }
    }

    // 木頭陽台（食物站的地方）
    for (let i = 0; i < ledges; i++) {
      const y = this.ledgeY(i);
      const x = left - ledgeDepth;
      g.fillStyle(0x9a6332, 1).fillRect(x, y, ledgeDepth + 6, 10);
      g.fillStyle(0xc08a50, 1).fillRect(x, y, ledgeDepth + 6, 3);
      g.fillStyle(0x4a2e1c, 1).fillRect(x, y + 10, ledgeDepth + 6, 2);
      for (let k = 0; k < 3; k++) g.fillStyle(0x6b4420, 1).fillRect(left - 6 - k * 6, y + 12 + k * 4, 6 + k * 6, 4);
    }
  }

  private drawWindow(x: number, y: number, lit: boolean) {
    const g = this.gfx;
    // 外框（上緣一階一階的圓拱）
    g.fillStyle(0x4a2e1c, 1);
    g.fillRect(x + 8, y - 4, 24, 4);
    g.fillRect(x + 2, y, 36, 4);
    g.fillRect(x - 2, y + 4, 44, 50);
    g.fillStyle(lit ? 0xffd27a : 0x2a3050, 1);
    g.fillRect(x + 10, y, 20, 4);
    g.fillRect(x + 4, y + 4, 32, 4);
    g.fillRect(x + 2, y + 8, 36, 42);
    if (lit) g.fillStyle(0xfff0b8, 1).fillRect(x + 6, y + 10, 6, 10);
    // 窗格
    g.fillStyle(0x4a2e1c, 1);
    g.fillRect(x + 18, y, 4, 50);
    g.fillRect(x + 2, y + 26, 36, 4);
    // 窗台石
    g.fillStyle(0x6b7184, 1).fillRect(x - 4, y + 54, 48, 4);
  }

  private drawDoor(x: number, y: number, w: number, h: number) {
    const g = this.gfx;
    g.fillStyle(0x5d6274, 1);
    g.fillRect(x + 8, y - 4, w - 16, 4);
    g.fillRect(x - 4, y, w + 8, h);
    g.fillStyle(0x7a4a24, 1);
    g.fillRect(x + 8, y, w - 16, 4);
    g.fillRect(x, y + 4, w, h - 4);
    g.fillStyle(0x5a3418, 1);
    for (let px = x + 12; px < x + w; px += 12) g.fillRect(px, y + 4, 2, h - 4);
    g.fillRect(x, y + 16, w, 4);
    g.fillStyle(0xffd23f, 1).fillRect(x + w - 12, y + h / 2, 4, 4);
  }
}
