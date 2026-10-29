import Phaser from 'phaser';
import { setAudioPaused } from './audio';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { UIScene } from './scenes/UIScene';

function startGame() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#141f66',
    // 像素風：放大時保持銳利、座標取整數
    pixelArt: true,
    scale: {
      // EXPAND：保持 1280×720 的基準，螢幕比較方或比較寬時，多出來的部分顯示更多畫面而不是加黑邊
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    scene: [BootScene, MenuScene, GameScene, UIScene, GameOverScene],
  });

  // 手機直拿：顯示「請轉橫」並暫停遊戲
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  const overlay = document.getElementById('rotate-overlay');

  function syncOrientation() {
    overlay?.classList.toggle('show', portrait.matches);
    if (portrait.matches) game.pause();
    else game.resume();
    setAudioPaused(portrait.matches);
  }

  game.events.once(Phaser.Core.Events.READY, () => {
    portrait.addEventListener('change', syncOrientation);
    syncOrientation();
  });
}

// 先載入像素字型，Phaser 的文字才不會先用預設字型畫出來
const font = new FontFace('Cubic11', 'url(fonts/Cubic_11.woff2)');
font
  .load()
  .then((f) => document.fonts.add(f))
  .catch(() => console.warn('像素字型載入失敗，改用系統字型'))
  .finally(startGame);
