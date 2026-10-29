import Phaser from 'phaser';
import { createNoise, SFX, SongPlayer, Synth } from './chiptune';
import { AUDIO, MusicKey, SfxKey } from './config';

/**
 * 音樂與音效的統一入口。
 * config.ts 的 AUDIO_FILES 有填檔案就播檔案，沒填就用 chiptune.ts 合成的聲音。
 * 音樂是全域的，切換場景不會中斷，同一首重複呼叫也不會重頭播。
 */

const LOOPING: Record<MusicKey, boolean> = { bgm_menu: true, bgm_game: true, bgm_gameover: false };

let game: Phaser.Game | null = null;
let musicSynth: Synth | null = null;
let sfxSynth: Synth | null = null;
let current: { key: MusicKey; stop: () => void } | null = null;

export function initAudio(g: Phaser.Game) {
  // 每次開啟都預設有聲音；靜音只在這次遊玩期間有效
  game = g;
  g.sound.mute = false;

  // 合成的聲音接在 Phaser 的主音量後面，靜音按鈕才管得到
  const sm = g.sound;
  if (!(sm instanceof Phaser.Sound.WebAudioSoundManager)) return;
  const ctx = sm.context;
  const noise = createNoise(ctx);
  const bus = (volume: number): Synth => {
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(sm.destination);
    return { ctx, out: gain, noise };
  };
  musicSynth = bus(AUDIO.musicVolume);
  sfxSynth = bus(AUDIO.sfxVolume);
}

const hasFile = (key: string) => !!game && game.cache.audio.exists(key);

export function playSfx(key: SfxKey, volume = 1) {
  if (!game) return;
  if (hasFile(key)) {
    game.sound.play(key, { volume: AUDIO.sfxVolume * volume });
  } else if (sfxSynth) {
    const out = sfxSynth.ctx.createGain();
    out.gain.value = volume;
    out.connect(sfxSynth.out);
    SFX[key]({ ...sfxSynth, out }, sfxSynth.ctx.currentTime);
  }
}

export function playMusic(key: MusicKey) {
  if (!game || current?.key === key) return;
  stopMusic();
  const loop = LOOPING[key];
  if (hasFile(key)) {
    const snd = game.sound.add(key, { loop, volume: AUDIO.musicVolume });
    snd.play();
    current = { key, stop: () => snd.destroy() };
  } else if (musicSynth) {
    const player = new SongPlayer(musicSynth, key);
    player.start();
    current = { key, stop: () => player.stop() };
  }
}

export function stopMusic() {
  current?.stop();
  current = null;
}

export function isMuted(): boolean {
  return !!game?.sound.mute;
}

export function toggleMute(): boolean {
  if (!game) return false;
  game.sound.mute = !game.sound.mute;
  return game.sound.mute;
}

/** 手機直拿暫停遊戲時，連聲音一起停 */
export function setAudioPaused(paused: boolean) {
  const sm = game?.sound;
  if (!(sm instanceof Phaser.Sound.WebAudioSoundManager)) return;
  if (paused) sm.context.suspend();
  else if (!sm.locked) sm.context.resume();
}
