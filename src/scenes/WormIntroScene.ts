import Phaser from 'phaser';
import { playSfx } from '../audio';
import { WORM_MODE } from '../config';
import { askNameAndPlay, drawWindow, outlineStyle, textStyle } from '../ui';

const BOX_H = 160;
const BOX_BOTTOM = 40;

/** 上班一條蟲的開場：全螢幕 RPG 字幕，一字一字打出來，毛毛蟲一路爬向辦公桌 */
export class WormIntroScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private box!: Phaser.GameObjects.Graphics;
  private desk!: Phaser.GameObjects.Image;
  private worm!: Phaser.GameObjects.Sprite;
  private line!: Phaser.GameObjects.Text;
  private more!: Phaser.GameObjects.Triangle;
  private hint!: Phaser.GameObjects.Text;
  private typing?: Phaser.Time.TimerEvent;
  private index = 0;
  private leaving = false;

  constructor() {
    super('WormIntro');
  }

  create() {
    this.index = 0;
    this.leaving = false;
    this.cameras.main.setBackgroundColor('#0a0a1a');
    this.bg = this.add.graphics();
    this.desk = this.add.image(0, 0, 'desk').setOrigin(0.5, 1).setScale(2);
    this.worm = this.add.sprite(0, 0, 'worm').play('worm_wiggle').setScale(2);
    this.box = this.add.graphics();
    this.line = this.add.text(0, 0, '', textStyle(36));
    this.more = this.add.triangle(0, 0, 0, 0, 24, 0, 12, 16, 0xffffff).setVisible(false);
    this.tweens.add({ targets: this.more, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    this.hint = this.add.text(0, 0, '按空白鍵或點擊畫面繼續', outlineStyle(24, '#9fd8ff')).setOrigin(0.5);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));

    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.on('pointerup', () => this.advance());

    this.cameras.main.fadeIn(400);
    this.showLine();
  }

  private get floorY() {
    return Math.round(this.scale.height * 0.6);
  }

  /** 第幾句字幕時毛毛蟲該爬到哪裡 */
  private wormX(index: number) {
    const { width } = this.scale;
    return width * 0.18 + (width * 0.44 * index) / Math.max(1, WORM_MODE.intro.length - 1);
  }

  private layout() {
    const { width, height } = this.scale;
    const floorY = this.floorY;
    this.bg.clear().fillStyle(0x2a2f55, 1).fillRect(0, floorY, width, height - floorY);
    this.bg.fillStyle(0x4a5288, 1).fillRect(0, floorY, width, 8);

    this.desk.setPosition(Math.round(width * 0.8), floorY + 8);
    this.tweens.killTweensOf(this.worm);
    this.worm.setPosition(this.wormX(this.index), floorY - 48);

    const boxW = Math.min(1000, width - 64);
    const boxX = Math.round((width - boxW) / 2);
    const boxY = height - BOX_BOTTOM - BOX_H;
    drawWindow(this.box.clear(), boxX, boxY, boxW, BOX_H);
    this.line.setPosition(boxX + 48, boxY + 40).setWordWrapWidth(boxW - 96, true);
    this.more.setPosition(boxX + boxW - 48, boxY + BOX_H - 32);
    this.hint.setPosition(width / 2, height - 20);
  }

  /** 開始打出目前這一句 */
  private showLine() {
    const chars = [...WORM_MODE.intro[this.index]];
    let shown = 0;
    this.line.setText('');
    this.more.setVisible(false);
    this.tweens.add({ targets: this.worm, x: this.wormX(this.index), duration: WORM_MODE.crawlMs, ease: 'Sine.easeInOut' });
    this.typing = this.time.addEvent({
      delay: WORM_MODE.charMs,
      repeat: chars.length - 1,
      callback: () => {
        this.line.setText(chars.slice(0, ++shown).join(''));
        if (shown === chars.length) this.finishTyping();
      },
    });
  }

  private finishTyping() {
    this.typing?.remove();
    this.typing = undefined;
    this.line.setText(WORM_MODE.intro[this.index]);
    this.more.setVisible(true);
  }

  /** 還在打字就先整句顯示；打完了才換下一句 */
  private advance() {
    if (this.leaving) return;
    if (this.typing) return this.finishTyping();
    playSfx('sfx_select');
    if (++this.index < WORM_MODE.intro.length) return this.showLine();

    this.leaving = true;
    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => askNameAndPlay(this));
  }
}
