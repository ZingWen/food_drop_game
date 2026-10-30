import Phaser from 'phaser';
import { BASKET, HEARTS, STOCK } from '../config';
import { setAudioPaused } from '../audio';
import { createIconButton, createSoundButton, drawWindow, outlineStyle, textStyle } from '../ui';
import type { GameScene } from './GameScene';

const MARGIN = 12;
const BAR_WIDTH = 384;
const BAR_HEIGHT = 20;
const STATUS_W = 236;
const STATUS_H = 100;
const STOCK_W = BAR_WIDTH + 132;
const TIME_W = 220;
const SMALL_H = 52;
const PAUSE_W = 360;
const PAUSE_OPTIONS = ['繼續遊戲', '重新開始', '回到主選單'];

export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 疊在遊戲畫面上層的 RPG 風 UI：狀態視窗（愛心、籃子）、囤貨度、等級時間、提示訊息 */
export class UIScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private frames!: Phaser.GameObjects.Graphics;
  private hearts: Phaser.GameObjects.Image[] = [];
  private basketText!: Phaser.GameObjects.Text;
  private stockLabel!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private timeText!: Phaser.GameObjects.Text;
  private soundButton!: Phaser.GameObjects.Container;
  private pauseButton!: Phaser.GameObjects.Container;
  private pauseLayer!: Phaser.GameObjects.Container;
  private pauseDim!: Phaser.GameObjects.Rectangle;
  private pauseCursor!: Phaser.GameObjects.Triangle;
  private pauseItems: Phaser.GameObjects.Text[] = [];
  private pauseIndex = 0;
  private paused = false;
  private banner!: Phaser.GameObjects.Container;
  private bannerBox!: Phaser.GameObjects.Graphics;
  private bannerText!: Phaser.GameObjects.Text;
  private levelBanner!: Phaser.GameObjects.Text;
  private frenzyText!: Phaser.GameObjects.Text;
  private splat!: Phaser.GameObjects.Graphics;

  constructor() {
    super('UI');
  }

  create() {
    this.gameScene = this.scene.get('Game') as GameScene;

    this.splat = this.add.graphics().setAlpha(0);
    this.frames = this.add.graphics();

    this.hearts = [];
    for (let i = 0; i < HEARTS.max; i++) {
      this.hearts.push(this.add.image(MARGIN + 18 + i * 42, MARGIN + 18, 'heart_full').setOrigin(0));
    }
    this.add.image(MARGIN + 18, MARGIN + 58, 'basket_front').setOrigin(0).setScale(0.375);
    this.basketText = this.add.text(MARGIN + 66, MARGIN + 60, '', textStyle(24));

    this.stockLabel = this.add.text(0, 0, '囤貨度', textStyle(24)).setOrigin(0, 0.5);
    this.bar = this.add.graphics();
    this.timeText = this.add.text(0, 0, '', textStyle(24)).setOrigin(0.5);
    this.soundButton = createSoundButton(this);
    this.pauseButton = createIconButton(this, 'icon_pause', () => this.setPaused(true), 'ESC 暫停').button;

    this.bannerBox = this.add.graphics();
    this.bannerText = this.add.text(0, 0, '', textStyle(48, '#ffb0a8')).setOrigin(0.5);
    this.banner = this.add.container(0, 0, [this.bannerBox, this.bannerText]).setAlpha(0);
    this.levelBanner = this.add.text(0, 0, '', outlineStyle(48, '#ffe066')).setOrigin(0.5).setAlpha(0);
    this.frenzyText = this.add.text(0, 0, '', outlineStyle(36)).setOrigin(0.5).setVisible(false);
    this.tweens.add({ targets: this.frenzyText, scale: 1.12, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.createPauseMenu();

    const events = this.gameScene.events;
    events.on('banner', this.showBanner, this);
    events.on('levelup', this.showLevel, this);
    events.on('splat', this.showSplat, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      events.off('banner', this.showBanner, this);
      events.off('levelup', this.showLevel, this);
      events.off('splat', this.showSplat, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      setAudioPaused(false);
    });
    this.layout();
  }

  private layout() {
    const { width, height } = this.scale;
    const stockX = Math.round(width / 2 - STOCK_W / 2);
    const timeX = width - MARGIN - TIME_W;

    this.frames.clear();
    drawWindow(this.frames, MARGIN, MARGIN, STATUS_W, STATUS_H);
    drawWindow(this.frames, stockX, MARGIN, STOCK_W, SMALL_H);
    drawWindow(this.frames, timeX, MARGIN, TIME_W, SMALL_H);

    this.stockLabel.setPosition(stockX + 20, MARGIN + SMALL_H / 2);
    this.timeText.setPosition(timeX + TIME_W / 2, MARGIN + SMALL_H / 2);
    this.soundButton.setPosition(timeX - 12 - 52, MARGIN);
    this.pauseButton.setPosition(MARGIN, MARGIN + STATUS_H + 12);
    this.pauseDim.setSize(width, height);
    this.pauseLayer.setPosition(Math.round(width / 2), Math.round(height / 2));
    this.banner.setPosition(width / 2, Math.round(height * 0.32));
    this.levelBanner.setPosition(width / 2, Math.round(height * 0.2));
    this.frenzyText.setPosition(width / 2, MARGIN + SMALL_H + 30);
  }

  update() {
    const s = this.gameScene.hud;
    this.hearts.forEach((h, i) => h.setTexture(i < s.hearts ? 'heart_full' : 'heart_empty'));
    this.basketText.setText(`${s.basket}/${BASKET.capacity}`);
    this.basketText.setColor(s.basket >= BASKET.capacity ? '#ff8a8a' : '#ffffff');
    this.timeText.setText(`Lv ${s.level}   ${formatTime(s.elapsed)}`);
    this.stockLabel.setText(s.freeze > 0 ? `暫停 ${Math.ceil(s.freeze)}` : '囤貨度');
    this.stockLabel.setColor(s.freeze > 0 ? '#9fe8ff' : '#ffffff');
    this.drawBar(s.stock / STOCK.max, s.freeze > 0);

    // 瘋狂掉落：預告是紫色倒數，進行中是紅色
    const f = s.frenzy;
    this.frenzyText.setVisible(!!f);
    if (f) {
      this.frenzyText.setText(`${f.name} ${Math.ceil(f.seconds)}`);
      this.frenzyText.setColor(f.phase === 'warn' ? '#d8b4ff' : '#ff7a5a');
    }
  }

  /** 像素風的血條：一格一格的 */
  private drawBar(ratio: number, frozen: boolean) {
    const x = Math.round(this.scale.width / 2 - STOCK_W / 2) + 112;
    const y = MARGIN + (SMALL_H - BAR_HEIGHT) / 2;
    let color = 0x5ad15a;
    let light = 0x9cf09c;
    if (ratio <= STOCK.lowWarning) [color, light] = [0xeb5757, 0xff9a9a];
    else if (ratio <= 0.5) [color, light] = [0xf2c94c, 0xfff0a0];
    // 松阪豬：暫停中變冰藍色
    if (frozen) [color, light] = [0x6ccff6, 0xd8f6ff];

    // 存糧快見底時閃爍
    const alpha = ratio <= STOCK.lowWarning && !frozen ? 0.55 + 0.45 * Math.sin(this.time.now / 90) : 1;
    const fill = Math.round((BAR_WIDTH * ratio) / 4) * 4;

    this.bar.clear();
    this.bar.fillStyle(0x000000, 1).fillRect(x - 4, y - 4, BAR_WIDTH + 8, BAR_HEIGHT + 8);
    this.bar.fillStyle(0x1a1a2e, 1).fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);
    if (fill > 0) {
      this.bar.fillStyle(color, alpha).fillRect(x, y, fill, BAR_HEIGHT);
      this.bar.fillStyle(light, alpha).fillRect(x, y, fill, 4);
    }
    // 刻度
    this.bar.fillStyle(0x000000, 0.35);
    for (let i = 1; i < 10; i++) this.bar.fillRect(x + (BAR_WIDTH / 10) * i - 1, y, 2, BAR_HEIGHT);
  }

  /** ESC 暫停畫面：繼續 / 重新開始 / 回主選單，可用方向鍵 + Enter 或滑鼠點選 */
  private createPauseMenu() {
    this.paused = false;
    this.pauseDim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55).setOrigin(0).setVisible(false);
    // 擋住底下的點擊（拖曳烏鴉、按鈕）
    this.pauseDim.setInteractive();

    const h = 96 + PAUSE_OPTIONS.length * 56;
    const box = drawWindow(this.add.graphics(), -PAUSE_W / 2, -h / 2, PAUSE_W, h, 0.96);
    const title = this.add.text(0, -h / 2 + 44, '暫停', textStyle(36, '#ffe066')).setOrigin(0.5);
    this.pauseItems = PAUSE_OPTIONS.map((label, i) => {
      const t = this.add.text(-PAUSE_W / 2 + 96, -h / 2 + 108 + i * 56, label, textStyle(36)).setOrigin(0, 0.5);
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.selectPause(i));
      t.on('pointerup', () => this.choosePause(i));
      return t;
    });
    this.pauseCursor = this.add.triangle(0, 0, 0, 0, 0, 24, 16, 12, 0xffffff).setOrigin(0, 0.5);
    this.tweens.add({ targets: this.pauseCursor, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    this.pauseLayer = this.add.container(0, 0, [box, title, ...this.pauseItems, this.pauseCursor]).setVisible(false);

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.setPaused(!this.paused));
    kb?.on('keydown-UP', () => this.paused && this.selectPause(this.pauseIndex - 1));
    kb?.on('keydown-W', () => this.paused && this.selectPause(this.pauseIndex - 1));
    kb?.on('keydown-DOWN', () => this.paused && this.selectPause(this.pauseIndex + 1));
    kb?.on('keydown-S', () => this.paused && this.selectPause(this.pauseIndex + 1));
    kb?.on('keydown-ENTER', () => this.paused && this.choosePause(this.pauseIndex));
    kb?.on('keydown-SPACE', () => this.paused && this.choosePause(this.pauseIndex));
  }

  private setPaused(paused: boolean) {
    if (paused === this.paused || (paused && this.gameScene.isOver)) return;
    this.paused = paused;
    if (paused) this.scene.pause('Game');
    else this.scene.resume('Game');
    setAudioPaused(paused);
    this.pauseDim.setVisible(paused);
    this.pauseLayer.setVisible(paused);
    this.selectPause(0);
  }

  private selectPause(index: number) {
    const n = PAUSE_OPTIONS.length;
    this.pauseIndex = (index + n) % n;
    const item = this.pauseItems[this.pauseIndex];
    this.pauseCursor.setPosition(item.x - 36, item.y);
    this.pauseItems.forEach((t, i) => t.setColor(i === this.pauseIndex ? '#ffe066' : '#ffffff'));
  }

  private choosePause(index: number) {
    if (index === 0) return this.setPaused(false);
    setAudioPaused(false);
    if (index === 1) {
      // 從 UI 呼叫 start('Game')：會關掉 UI、重新開始 Game（Game 會再把 UI 開起來）
      this.scene.start('Game');
    } else {
      this.scene.stop('Game');
      this.scene.start('Menu');
    }
  }

  private showBanner(text: string) {
    this.bannerText.setText(text);
    const w = Math.ceil(this.bannerText.width / 4) * 4 + 64;
    const h = 88;
    this.bannerBox.clear();
    drawWindow(this.bannerBox, -w / 2, -h / 2, w, h, 0.95);

    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1300, duration: 300 });
  }

  private showLevel(level: number) {
    this.tweens.killTweensOf(this.levelBanner);
    this.levelBanner.setText(`LEVEL UP!  第 ${level} 級`).setAlpha(1);
    this.tweens.add({ targets: this.levelBanner, alpha: 0, delay: 1200, duration: 400 });
  }

  /** 番茄汁噴到畫面上（一格一格的像素汁） */
  private showSplat() {
    const { width, height } = this.scale;
    const cell = 16;
    this.splat.clear().fillStyle(0xd62828, 0.8);
    const blob = (cx: number, cy: number, r: number) => {
      for (let y = -r; y <= r; y += cell) {
        for (let x = -r; x <= r; x += cell) {
          if (x * x + y * y <= r * r) this.splat.fillRect(Math.round((cx + x) / cell) * cell, Math.round((cy + y) / cell) * cell, cell, cell);
        }
      }
    };
    for (let i = 0; i < 7; i++) {
      const x = Phaser.Math.Between(width * 0.15, width * 0.85);
      const y = Phaser.Math.Between(height * 0.2, height * 0.8);
      const r = Phaser.Math.Between(40, 90);
      blob(x, y, r);
      for (let j = 0; j < 5; j++) {
        const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
        blob(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4, r * 0.25);
      }
    }
    this.tweens.killTweensOf(this.splat);
    this.splat.setAlpha(1);
    this.tweens.add({ targets: this.splat, alpha: 0, delay: 500, duration: 1000 });
  }
}
