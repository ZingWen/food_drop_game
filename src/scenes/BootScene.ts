import Phaser from 'phaser';
import { initAudio } from '../audio';
import { AUDIO_FILES, CAPE_SHEET_FILE, CROW_SHEET_FILE, IMAGE_FILES, LOGO } from '../config';
import { CAPE_FRAME_W, CROW_FRAME, makePlaceholders } from '../placeholders';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const [key, file] of Object.entries(IMAGE_FILES)) this.load.image(key, file);
    this.load.image('logo', LOGO.file);
    for (const [key, file] of Object.entries(AUDIO_FILES)) if (file) this.load.audio(key, file);
    if (CROW_SHEET_FILE) {
      this.load.spritesheet('crow', CROW_SHEET_FILE, { frameWidth: CROW_FRAME, frameHeight: CROW_FRAME });
    }
    if (CAPE_SHEET_FILE) {
      this.load.spritesheet('crow_cape', CAPE_SHEET_FILE, { frameWidth: CAPE_FRAME_W, frameHeight: CROW_FRAME });
    }
  }

  create() {
    // 沒有正式圖片的部分，用程式畫的暫代圖補上
    makePlaceholders(this);
    // LOGO 不是像素圖，縮小時用平滑縮放才不會鋸齒
    if (this.textures.exists('logo')) this.textures.get('logo').setFilter(Phaser.Textures.FilterMode.LINEAR);
    initAudio(this.game);

    // frameTotal 包含一個 __BASE 影格，所以要 -2
    const lastFrame = this.textures.get('crow').frameTotal - 2;
    this.anims.create({
      key: 'crow_fly',
      frames: this.anims.generateFrameNumbers('crow', { start: 0, end: lastFrame }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: 'cape_flutter',
      frames: this.anims.generateFrameNumbers('crow_cape', { start: 0, end: this.textures.get('crow_cape').frameTotal - 2 }),
      frameRate: 8,
      repeat: -1,
    });

    this.scene.start('Menu');
  }
}
