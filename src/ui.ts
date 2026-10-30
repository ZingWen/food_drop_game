import Phaser from 'phaser';
import { isMuted, toggleMute } from './audio';
import { FONT, LEADERBOARD } from './config';
import type { BoardEntry } from './leaderboard';
import { formatTime } from './scenes/UIScene';

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

export const BOARD_W = 440;
const BOARD_ROW_H = 30;
export const BOARD_H = 72 + (LEADERBOARD.rows + 1) * BOARD_ROW_H + 16;
const MEDALS = ['#ffd84a', '#d8e0ec', '#e09a5a'];

/**
 * 鴉鴉榜視窗（左上角為原點）。highlight 的名稱會標黃；
 * 如果他排在顯示的名次之外，最後一行會另外列出他的名次
 */
export function createLeaderboard(scene: Phaser.Scene, board: BoardEntry[], highlight: string | null) {
  const parts: Phaser.GameObjects.GameObject[] = [drawWindow(scene.add.graphics(), 0, 0, BOARD_W, BOARD_H)];
  parts.push(scene.add.text(BOARD_W / 2, 32, `♛ ${LEADERBOARD.title} ♛`, textStyle(36, '#ffe066')).setOrigin(0.5));

  const row = (index: number, slot: number, entry: BoardEntry) => {
    const y = 72 + slot * BOARD_ROW_H + BOARD_ROW_H / 2;
    const mine = entry.name === highlight;
    const color = mine ? '#8cf08c' : (MEDALS[index] ?? '#ffffff');
    parts.push(scene.add.text(28, y, `${index + 1}.`, textStyle(24, color)).setOrigin(0, 0.5));
    parts.push(scene.add.text(84, y, entry.name, textStyle(24, color)).setOrigin(0, 0.5));
    parts.push(scene.add.text(BOARD_W - 28, y, formatTime(entry.time), textStyle(24, color)).setOrigin(1, 0.5));
    if (mine) parts.push(scene.add.text(14, y, '▶', textStyle(12, color)).setOrigin(0, 0.5));
  };

  board.slice(0, LEADERBOARD.rows).forEach((e, i) => row(i, i, e));
  const myIndex = highlight ? board.findIndex((e) => e.name === highlight) : -1;
  if (myIndex >= LEADERBOARD.rows) row(myIndex, LEADERBOARD.rows, board[myIndex]);

  if (board.length === 0) {
    parts.push(
      scene.add.text(BOARD_W / 2, BOARD_H / 2 + 20, '還沒有烏鴉上榜\n快來搶第一！', { ...textStyle(24, '#9fd8ff'), align: 'center' }).setOrigin(0.5),
    );
  }
  return scene.add.container(0, 0, parts);
}
