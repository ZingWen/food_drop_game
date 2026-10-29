import Phaser from 'phaser';
import { playMusic } from '../audio';
import { drawWindow, outlineStyle, textStyle } from '../ui';
import type { GameOverReason } from './GameScene';
import { formatTime } from './UIScene';

const BEST_KEY = 'crow-stock-best-time';

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(seconds: number) {
  try {
    localStorage.setItem(BEST_KEY, String(seconds));
  } catch {
    // 無痕模式等情況存不了，就算了
  }
}

const REASONS: Record<GameOverReason, string> = {
  stock: '存糧見底了…',
  hearts: '心都碎光了…',
};

export class GameOverScene extends Phaser.Scene {
  private reason: GameOverReason = 'stock';
  private survived = 0;

  constructor() {
    super('GameOver');
  }

  init(data: { reason: GameOverReason; time: number }) {
    this.reason = data.reason;
    this.survived = data.time;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a1a');
    playMusic('bgm_gameover');
    const best = loadBest();
    const isNewBest = this.survived > best;
    if (isNewBest) saveBest(this.survived);

    const title = this.add.text(0, -200, 'GAME OVER', { ...outlineStyle(72, '#ff5a5a'), strokeThickness: 10 }).setOrigin(0.5);
    const box = drawWindow(this.add.graphics(), -260, -120, 520, 220);
    const reason = this.add.text(0, -80, REASONS[this.reason], textStyle(24, '#ffb4a2')).setOrigin(0.5);
    const survived = this.add.text(0, -10, `撐過了 ${formatTime(this.survived)}`, textStyle(48, '#ffe066')).setOrigin(0.5);
    const bestText = this.add
      .text(0, 56, isNewBest ? '★ 新紀錄！ ★' : `最長紀錄 ${formatTime(best)}`, textStyle(24))
      .setOrigin(0.5);
    const again = this.add.text(0, 170, '按空白鍵或點擊畫面再玩一次', outlineStyle(24, '#9fd8ff')).setOrigin(0.5).setAlpha(0);

    const content = this.add.container(0, 0, [title, box, reason, survived, bestText, again]);
    const layout = () => content.setPosition(this.scale.width / 2, this.scale.height / 2);
    layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, layout));

    // 等一下才接受輸入，避免遊戲中還在按的鍵直接跳過結算
    this.time.delayedCall(700, () => {
      again.setAlpha(1);
      this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));
      this.input.once('pointerup', () => this.scene.start('Game'));
    });
  }
}
