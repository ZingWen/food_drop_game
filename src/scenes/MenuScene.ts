import Phaser from 'phaser';
import { playMusic, playSfx } from '../audio';
import { GAME_TITLE, LEADERBOARD, LOGO, WORM_MODE } from '../config';
import { isWormUnlocked, lastPlayerName, loadBoard } from '../leaderboard';
import { isWormMode, setWormMode } from '../mode';
import { createCape } from '../objects/Crow';
import { drawLandscape } from '../scenery';
import {
  askNameAndPlay,
  BOARD_H,
  BOARD_W,
  createIconButton,
  createLeaderboard,
  createSoundButton,
  drawWindow,
  iconFit,
  outlineStyle,
  textStyle,
} from '../ui';

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
const CONTROLS = '操作：方向鍵 / WASD，或在畫面上拖曳　　M：靜音';
const DEPOSIT_RULE = 1; // RULES 裡「回巢」那一列，切換模式時要換內容
const TOGGLE_W = 320;

export class MenuScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private content!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Text;
  private crow!: Phaser.GameObjects.Container;
  private worm!: Phaser.GameObjects.Sprite;
  private depositIcon!: Phaser.GameObjects.Image;
  private depositText!: Phaser.GameObjects.Text;
  private controls!: Phaser.GameObjects.Text;
  private toggleText!: Phaser.GameObjects.Text;
  private toggleIcon!: Phaser.GameObjects.Image;
  private soundButton!: Phaser.GameObjects.Container;
  private logo?: Phaser.GameObjects.Image;
  private boardButton!: Phaser.GameObjects.Container;
  private boardLayer!: Phaser.GameObjects.Container;
  private boardDim!: Phaser.GameObjects.Rectangle;
  private started = false;

  constructor() {
    super('Menu');
  }

  create() {
    this.started = false;
    const wormUnlocked = isWormUnlocked();
    if (!wormUnlocked) setWormMode(false);
    this.bg = this.add.graphics();

    this.title = this.add.text(0, -290, GAME_TITLE, { ...outlineStyle(72, '#ffe066'), strokeThickness: 10 }).setOrigin(0.5);
    const [cape, collar] = createCape(this);
    this.crow = this.add.container(0, -200, [cape, this.add.sprite(0, 0, 'crow').play('crow_fly'), collar]);
    this.worm = this.add.sprite(0, -200, 'worm').play('worm_wiggle').setVisible(false);
    this.tweens.add({ targets: [this.crow, this.worm], y: -212, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const top = -140;
    const box = drawWindow(this.add.graphics(), -BOX_W / 2, top, BOX_W, BOX_H);
    const rows: Phaser.GameObjects.GameObject[] = [];
    RULES.forEach(([icons, text], i) => {
      const y = top + 20 + ROW_H * i + ROW_H / 2;
      const images = icons.map((key, k) => iconFit(this.add.image(-BOX_W / 2 + 44 + k * 38, y, key), 32));
      const label = this.add.text(-BOX_W / 2 + 156, y, text, textStyle(24)).setOrigin(0, 0.5);
      rows.push(...images, label);
      if (i === DEPOSIT_RULE) [this.depositIcon, this.depositText] = [images[0], label];
    });

    this.controls = this.add.text(0, top + BOX_H + 36, CONTROLS, outlineStyle(24)).setOrigin(0.5);
    const start = this.add.text(12, top + BOX_H + 84, '按空白鍵或點擊畫面開始冒險', outlineStyle(36)).setOrigin(0.5);
    const cursor = this.add
      .triangle(-start.width / 2 - 16, start.y, 0, 0, 0, 24, 16, 12, 0xffffff)
      .setStrokeStyle(4, 0x000000);
    this.tweens.add({ targets: cursor, x: cursor.x + 8, duration: 350, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: start, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });

    // 模式切換鈕：還沒解鎖時只顯示解鎖條件，按了沒有作用
    const onToggle = () => (wormUnlocked ? this.toggleWorm() : playSfx('sfx_bounce'));
    const toggle = createIconButton(this, 'icon_worm', onToggle, WORM_MODE.lockedLabel, TOGGLE_W);
    toggle.button.setPosition(-TOGGLE_W / 2, top + BOX_H + 112);
    this.toggleText = toggle.text!;
    this.toggleIcon = toggle.icon;
    if (wormUnlocked) {
      this.input.keyboard?.on('keydown-W', () => this.toggleWorm());
    } else {
      toggle.icon.setTint(0x666666);
      this.toggleText.setColor('#a0a0b8');
    }

    this.content = this.add.container(0, 0, [this.title, this.crow, this.worm, box, ...rows, this.controls, start, cursor, toggle.button]);
    if (wormUnlocked) this.applyMode();
    if (this.textures.exists('logo')) {
      this.logo = this.add.image(0, 0, 'logo').setOrigin(0).setDisplaySize(LOGO.size, LOGO.size);
    }
    this.soundButton = createSoundButton(this);
    this.boardButton = createIconButton(this, 'icon_trophy', () => this.showBoard(true), LEADERBOARD.title).button;
    this.boardDim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.6).setOrigin(0).setVisible(false);
    const hint = this.add.text(0, BOARD_H / 2 + 32, '點擊畫面關閉', outlineStyle(24)).setOrigin(0.5);
    this.boardLayer = this.add.container(0, 0, [hint]).setVisible(false);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));

    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());
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
    this.logo?.setPosition(12, 12);
    this.soundButton.setPosition(width - 12 - 52, 12);
    this.boardButton.setPosition(width - 12 - 52 - 12 - this.boardButton.getBounds().width, 12);
    this.boardDim.setSize(width, height);
    this.boardLayer.setPosition(width / 2, height / 2);
  }

  /** 鴉鴉榜每次打開都重畫，才會是最新的 */
  private showBoard(show: boolean) {
    this.boardLayer.getByName('board')?.destroy();
    if (show) {
      const panel = createLeaderboard(this, loadBoard(), lastPlayerName() || null);
      panel.setName('board').setPosition(-BOARD_W / 2, -BOARD_H / 2 - 20);
      this.boardLayer.add(panel);
    }
    this.boardDim.setVisible(show);
    this.boardLayer.setVisible(show);
  }

  private async startGame() {
    // 鴉鴉榜開著的時候，先關掉
    if (this.boardLayer.visible) return this.showBoard(false);
    if (this.started) return;
    this.started = true;
    playSfx('sfx_select');
    if (isWormMode()) return this.scene.start('WormIntro');
    await askNameAndPlay(this);
  }

  /** 切換烏鴉 / 上班一條蟲，只換封面，不會開始遊戲 */
  private toggleWorm() {
    if (this.boardLayer.visible) return this.showBoard(false);
    if (this.started) return;
    setWormMode(!isWormMode());
    playSfx('sfx_select');
    this.applyMode();
    this.tweens.add({ targets: this.title, scale: { from: 0.6, to: 1 }, duration: 300, ease: 'Back.easeOut' });
  }

  /** 依目前模式更新標題、主角和說明文字 */
  private applyMode() {
    const worm = isWormMode();
    this.title.setText(worm ? WORM_MODE.title : GAME_TITLE).setColor(worm ? '#b8ec86' : '#ffe066');
    this.crow.setVisible(!worm);
    this.worm.setVisible(worm);
    this.toggleText.setText(worm ? WORM_MODE.backLabel : WORM_MODE.buttonLabel);
    this.toggleIcon.setTexture(worm ? 'icon_crow' : 'icon_worm');
    this.controls.setText(worm ? WORM_MODE.controls : CONTROLS);
    this.depositText.setText(worm ? WORM_MODE.depositRule : RULES[DEPOSIT_RULE][1]);
    iconFit(this.depositIcon.setTexture(worm ? 'desk' : 'nest'), 32);
  }
}
