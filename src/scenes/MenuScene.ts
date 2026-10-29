import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio';
import { GAME_TITLE } from '../config';
import { createCape } from '../objects/Crow';
import { drawLandscape } from '../scenery';
import { createSoundButton, drawWindow, iconFit, outlineStyle, textStyle } from '../ui';

const RULES: [icons: string[], text: string][] = [
  [['food_steak'], '牛排最重要！沒接到會扣愛心'],
  [['nest'], '接到的食物要飛回左下角的鳥巢，才會變成存糧'],
  [['heart_full'], '囤貨度會一直減少，見底或愛心用完就結束'],
  [['food_tomato', 'food_bomb', 'food_rotten'], '不要接！會扣愛心還會暈眩'],
  [['food_golden'], '金色蘋果可以補愛心'],
  [['food_pork'], '松阪豬：接到後囤貨度暫停減少 5 秒'],
];

const BOX_W = 800;
const ROW_H = 48;
const BOX_H = RULES.length * ROW_H + 40;

export class MenuScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private content!: Phaser.GameObjects.Container;
  private soundButton!: Phaser.GameObjects.Container;
  private started = false;

  constructor() {
    super('Menu');
  }

  create() {
    this.started = false;
    this.bg = this.add.graphics();

    const title = this.add.text(0, -290, GAME_TITLE, { ...outlineStyle(72, '#ffe066'), strokeThickness: 10 }).setOrigin(0.5);
    const [cape, collar] = createCape(this);
    const crow = this.add.container(0, -200, [cape, this.add.sprite(0, 0, 'crow').play('crow_fly'), collar]);
    this.tweens.add({ targets: crow, y: -212, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const top = -140;
    const box = drawWindow(this.add.graphics(), -BOX_W / 2, top, BOX_W, BOX_H);
    const rows: Phaser.GameObjects.GameObject[] = [];
    RULES.forEach(([icons, text], i) => {
      const y = top + 20 + ROW_H * i + ROW_H / 2;
      icons.forEach((key, k) => rows.push(iconFit(this.add.image(-BOX_W / 2 + 44 + k * 38, y, key), 32)));
      rows.push(this.add.text(-BOX_W / 2 + 156, y, text, textStyle(24)).setOrigin(0, 0.5));
    });

    const controls = this.add
      .text(0, top + BOX_H + 36, '操作：方向鍵 / WASD，或在畫面上拖曳　　M：靜音', outlineStyle(24))
      .setOrigin(0.5);
    const start = this.add.text(12, top + BOX_H + 96, '按空白鍵或點擊畫面開始冒險', outlineStyle(36)).setOrigin(0.5);
    const cursor = this.add
      .triangle(-start.width / 2 - 16, start.y, 0, 0, 0, 24, 16, 12, 0xffffff)
      .setStrokeStyle(4, 0x000000);
    this.tweens.add({ targets: cursor, x: cursor.x + 8, duration: 350, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: start, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });

    this.content = this.add.container(0, 0, [title, crow, box, ...rows, controls, start, cursor]);
    this.soundButton = createSoundButton(this);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));

    this.input.keyboard?.once('keydown-SPACE', () => this.startGame());
    // 按下和放開都要在這個畫面才算開始（避免從暫停選單點「回到主選單」時，放開滑鼠又直接進遊戲）；
    // 點到靜音按鈕也不算
    let pressed = false;
    this.input.on('pointerdown', () => (pressed = true));
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (pressed && over.length === 0) this.startGame();
      pressed = false;
    });

    // 瀏覽器要等玩家第一次操作才會出聲，所以開始畫面的音樂可能要點一下才聽得到
    playMusic('bgm_menu');
  }

  private layout() {
    const { width, height } = this.scale;
    drawLandscape(this.bg, width, height, height - 70);
    this.bg.fillStyle(0x000000, 0.25).fillRect(0, 0, width, height);
    this.content.setPosition(width / 2, height / 2);
    this.soundButton.setPosition(width - 12 - 52, 12);
  }

  private startGame() {
    if (this.started) return;
    this.started = true;
    playSfx('sfx_select');
    // 手機：嘗試全螢幕並鎖定橫向（Android 有效；iOS 不支援，會顯示轉向提示）
    if (this.sys.game.device.input.touch && !this.scale.isFullscreen) {
      this.scale.startFullscreen();
      this.scale.lockOrientation('landscape');
    }
    this.scene.start('Game');
  }
}
