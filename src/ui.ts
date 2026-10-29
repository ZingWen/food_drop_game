import Phaser from 'phaser';
import { isMuted, toggleMute } from './audio';
import { FONT } from './config';

/** RPG 風格的共用 UI：藍底白框視窗、像素字樣式、靜音按鈕 */

export const WINDOW_BORDER = 4;

/** 經典 RPG 對話框：藍色漸層底、切角白框、外圈黑邊 */
export function drawWindow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, alpha = 0.92) {
  const b = WINDOW_BORDER;
  g.fillStyle(0x000000, alpha);
  g.fillRect(x + b, y - 2, w - b * 2, h + 4);
  g.fillRect(x - 2, y + b, w + 4, h - b * 2);
  g.fillRect(x, y + 2, w, h - 4);

  g.fillGradientStyle(0x3a58c8, 0x3a58c8, 0x141f66, 0x141f66, alpha);
  g.fillRect(x + b, y + b, w - b * 2, h - b * 2);

  g.fillStyle(0xf4f4f4, 1);
  g.fillRect(x + b, y, w - b * 2, b);
  g.fillRect(x + b, y + h - b, w - b * 2, b);
  g.fillRect(x, y + b, b, h - b * 2);
  g.fillRect(x + w - b, y + b, b, h - b * 2);
  // 切角
  g.fillRect(x + b - 2, y + b - 2, 2, 2);
  g.fillRect(x + w - b, y + b - 2, 2, 2);
  g.fillRect(x + b - 2, y + h - b, 2, 2);
  g.fillRect(x + w - b, y + h - b, 2, 2);
  return g;
}

/** 視窗裡的文字：像素字 + 硬陰影 */
export function textStyle(size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    shadow: { offsetX: 2, offsetY: 2, color: '#000000', fill: true, blur: 0 },
  };
}

/** 直接畫在遊戲畫面上的文字：粗黑邊，任何背景都看得清楚 */
export function outlineStyle(size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000000', strokeThickness: 6 };
}

/** 把圖片縮放到最長邊為 size（像素圖盡量用整數倍） */
export function iconFit(img: Phaser.GameObjects.Image, size: number) {
  return img.setScale(size / Math.max(img.width, img.height));
}

/** 圖示按鈕，可以在圖示右邊加文字。回傳的 container 要自己決定位置 */
export function createIconButton(scene: Phaser.Scene, texture: string, onClick: () => void, label?: string) {
  const size = 52;
  const text = label ? scene.add.text(size - 4, size / 2, label, textStyle(24)).setOrigin(0, 0.5) : null;
  const width = text ? Math.ceil(text.width / 4) * 4 + size + 12 : size;
  const bg = drawWindow(scene.add.graphics(), 0, 0, width, size);
  const icon = scene.add.image(size / 2, size / 2, texture);
  // 用一個左上角對齊的 zone 接點擊（container 的點擊範圍以中心為原點，容易對不準）
  const hit = scene.add.zone(0, 0, width, size).setOrigin(0).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
    e.stopPropagation();
    onClick();
  });
  const parts: Phaser.GameObjects.GameObject[] = [bg, icon, ...(text ? [text] : []), hit];
  return { button: scene.add.container(0, 0, parts), icon };
}

/** 靜音按鈕（也可以按 M 鍵） */
export function createSoundButton(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const texture = () => (isMuted() ? 'icon_sound_off' : 'icon_sound_on');
  const { button, icon } = createIconButton(scene, texture(), () => toggle());
  const toggle = () => {
    toggleMute();
    icon.setTexture(texture());
  };
  scene.input.keyboard?.on('keydown-M', toggle);
  return button;
}
