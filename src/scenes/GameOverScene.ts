import Phaser from 'phaser';
import { playMusic } from '../audio';
import { LEADERBOARD } from '../config';
import { getPlayer, submitScore } from '../leaderboard';
import { askPlayerName } from '../nameDialog';
import { BOARD_H, BOARD_W, createLeaderboard, drawWindow, outlineStyle, textStyle } from '../ui';
import type { GameOverReason } from './GameScene';
import { formatTime } from './UIScene';

const REASONS: Record<GameOverReason, string> = {
  stock: '存糧見底了…',
  hearts: '心都碎光了…',
};

const RESULT_W = 500;
const RESULT_H = 280;
const GAP = 40;

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
    const player = getPlayer();
    const result = submitScore(player, this.survived);

    // 左邊結算、右邊鴉鴉榜
    const left = -(RESULT_W + GAP + BOARD_W) / 2;
    const top = -BOARD_H / 2 + 20;
    const cx = left + RESULT_W / 2;

    const title = this.add.text(0, top - 56, 'GAME OVER', { ...outlineStyle(72, '#ff5a5a'), strokeThickness: 10 }).setOrigin(0.5);
    const box = drawWindow(this.add.graphics(), left, top, RESULT_W, RESULT_H);
    const who = this.add.text(cx, top + 36, player ?? '訪客', textStyle(24, '#9fd8ff')).setOrigin(0.5);
    const reason = this.add.text(cx, top + 76, REASONS[this.reason], textStyle(24, '#ffb4a2')).setOrigin(0.5);
    const survived = this.add.text(cx, top + 140, `撐過了 ${formatTime(this.survived)}`, textStyle(48, '#ffe066')).setOrigin(0.5);
    const bestText = this.add
      .text(cx, top + 216, this.resultLines(player, result).join('\n'), { ...textStyle(24), align: 'center' })
      .setOrigin(0.5);

    const board = createLeaderboard(this, result.board, player).setPosition(left + RESULT_W + GAP, top);
    const again = this.add
      .text(cx, top + RESULT_H + 48, '按空白鍵或點擊畫面再玩一次', outlineStyle(24, '#9fd8ff'))
      .setOrigin(0.5)
      .setAlpha(0);

    const content = this.add.container(0, 0, [title, box, who, reason, survived, bestText, board, again]);
    const layout = () => content.setPosition(this.scale.width / 2, this.scale.height / 2);
    layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, layout));

    // 等一下才接受輸入，避免遊戲中還在按的鍵直接跳過結算
    let leaving = false;
    const playAgain = async () => {
      if (leaving) return;
      leaving = true;
      await askPlayerName();
      this.scene.start('Game');
    };
    this.time.delayedCall(700, () => {
      again.setAlpha(1);
      this.input.keyboard?.once('keydown-SPACE', playAgain);
      this.input.once('pointerup', playAgain);
    });
  }

  private resultLines(player: string | null, r: ReturnType<typeof submitScore>): string[] {
    const rank = `${LEADERBOARD.title}第 ${r.rank} 名`;
    if (!player) return ['訪客不上榜', `這個成績可排${rank}`];
    if (!r.isPersonalBest) return [`你的最佳 ${formatTime(r.previousBest)}`, `這次可排${rank}`];
    if (r.rank === 1) return [`★ 稱霸${LEADERBOARD.title}！ ★`, r.previousBest ? `舊紀錄 ${formatTime(r.previousBest)}` : '第一次就登頂'];
    return ['★ 個人新紀錄！ ★', `登上${rank}`];
  }
}
