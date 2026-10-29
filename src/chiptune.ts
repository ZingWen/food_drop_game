import type { MusicKey, SfxKey } from './config';

/**
 * 程式合成的 8-bit 音樂與音效（Web Audio）。
 * config.ts 的 AUDIO_FILES 沒有填檔案的聲音，就用這裡的版本。
 */

export interface Synth {
  ctx: AudioContext;
  out: AudioNode;
  noise: AudioBuffer;
}

export function createNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// ───────────────────────── 音高 ─────────────────────────

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midi(note: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(note);
  if (!m) throw new Error(`看不懂的音符：${note}`);
  return (Number(m[3]) + 1) * 12 + SEMITONE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

function noteName(n: number): string {
  return `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
}

function hz(note: string): number {
  return 440 * 2 ** ((midi(note) - 69) / 12);
}

// ───────────────────────── 發聲 ─────────────────────────

function tone(s: Synth, t: number, f0: number, f1: number, dur: number, type: OscillatorType, vol: number) {
  const osc = s.ctx.createOscillator();
  const gain = s.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.006);
  gain.gain.setValueAtTime(vol, t + dur * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(s.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(s: Synth, t: number, dur: number, vol: number, filter: BiquadFilterType, f0: number, f1 = f0) {
  const src = s.ctx.createBufferSource();
  const biquad = s.ctx.createBiquadFilter();
  const gain = s.ctx.createGain();
  src.buffer = s.noise;
  biquad.type = filter;
  biquad.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) biquad.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(biquad).connect(gain).connect(s.out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** 連續的幾個音（琶音） */
function arp(s: Synth, t: number, notes: string[], step: number, type: OscillatorType, vol: number, last = step) {
  notes.forEach((n, i) => {
    const f = hz(n);
    tone(s, t + i * step, f, f, i === notes.length - 1 ? last : step * 1.1, type, vol);
  });
}

// ───────────────────────── 音效 ─────────────────────────

export const SFX: Record<SfxKey, (s: Synth, t: number) => void> = {
  sfx_select: (s, t) => arp(s, t, ['E5', 'B5'], 0.07, 'square', 0.2, 0.15),
  sfx_catch: (s, t) => arp(s, t, ['A5', 'E6'], 0.05, 'square', 0.16, 0.08),
  sfx_steak: (s, t) => arp(s, t, ['B5', 'E6', 'G#6'], 0.06, 'square', 0.18, 0.2),
  sfx_golden: (s, t) => arp(s, t, ['C6', 'E6', 'G6', 'C7', 'E7'], 0.06, 'square', 0.16, 0.3),
  sfx_freeze: (s, t) => arp(s, t, ['E6', 'B6', 'E6', 'B6', 'E7'], 0.05, 'triangle', 0.3, 0.35),
  sfx_hurt: (s, t) => {
    tone(s, t, 520, 90, 0.3, 'square', 0.22);
    noise(s, t, 0.15, 0.2, 'lowpass', 2000, 400);
  },
  sfx_bomb: (s, t) => {
    noise(s, t, 0.7, 0.5, 'lowpass', 3000, 80);
    tone(s, t, 120, 30, 0.5, 'sine', 0.5);
  },
  sfx_bounce: (s, t) => tone(s, t, 260, 520, 0.08, 'square', 0.14),
  sfx_full: (s, t) => {
    tone(s, t, 180, 180, 0.09, 'square', 0.16);
    tone(s, t + 0.12, 140, 140, 0.14, 'square', 0.16);
  },
  sfx_land: (s, t) => noise(s, t, 0.12, 0.18, 'lowpass', 900, 200),
  sfx_deposit: (s, t) => arp(s, t, ['G5', 'C6', 'E6', 'G6'], 0.05, 'triangle', 0.3, 0.25),
  sfx_levelup: (s, t) => arp(s, t, ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'], 0.09, 'square', 0.16, 0.4),
};

// ───────────────────────── 音樂 ─────────────────────────

type Voice = OscillatorType | 'drums';

interface Track {
  voice: Voice;
  vol: number;
  /** 以八分音符為單位：「音名:長度」，休止符用 -。鼓：k 大鼓、s 小鼓、h 鈸 */
  notes: string;
}

interface Song {
  bpm: number;
  loop: boolean;
  tracks: Track[];
}

/** 依和弦根音產生伴奏：每個根音一小節，照 shape 的半音位移逐八分音符彈 */
function bassline(roots: string[], shape: number[]): string {
  return roots.map((r) => shape.map((off) => `${noteName(midi(r) + off)}:1`).join(' ')).join(' ');
}

const repeat = (s: string, n: number) => Array(n).fill(s).join(' ');

const SONGS: Record<MusicKey, Song> = {
  // 開始畫面：悠閒的村莊
  bgm_menu: {
    bpm: 100,
    loop: true,
    tracks: [
      {
        voice: 'triangle',
        vol: 0.3,
        notes:
          'A4:4 C5:2 F5:2 E5:4 D5:2 C5:2 D5:4 A#4:2 D5:2 C5:8 ' +
          'A4:4 C5:2 F5:2 G5:4 F5:2 E5:2 F5:2 E5:2 D5:2 E5:2 F5:8',
      },
      { voice: 'square', vol: 0.05, notes: bassline(['F3', 'C3', 'A#2', 'C3', 'F3', 'C3', 'A#2', 'F3'], [0, 7, 12, 7, 0, 7, 12, 7]) },
    ],
  },
  // 遊戲中：輕快的冒險曲
  bgm_game: {
    bpm: 150,
    loop: true,
    tracks: [
      {
        voice: 'square',
        vol: 0.09,
        notes:
          'E5:2 G5:2 A5:2 G5:1 E5:1 C5:2 D5:2 E5:4 F5:2 A5:2 G5:2 F5:1 E5:1 D5:6 -:2 ' +
          'E5:2 G5:2 A5:2 C6:2 B5:2 A5:2 G5:4 F5:2 E5:2 D5:2 B4:2 C5:6 -:2 ' +
          'A4:2 C5:2 E5:2 A5:2 G5:3 F5:1 E5:4 F4:2 A4:2 C5:2 F5:2 E5:3 D5:1 C5:4 ' +
          'D5:2 F5:2 A5:2 D6:2 C6:2 B5:2 A5:2 G5:2 G5:2 A5:2 B5:2 D6:2 C6:4 G5:2 -:2',
      },
      {
        voice: 'triangle',
        vol: 0.32,
        notes: bassline(
          ['C3', 'A2', 'F2', 'G2', 'C3', 'E2', 'F2', 'C3', 'A2', 'E2', 'F2', 'C3', 'D3', 'A2', 'G2', 'C3'],
          [0, 12, 0, 12, 0, 12, 0, 12],
        ),
      },
      { voice: 'drums', vol: 0.5, notes: repeat('k:1 h:1 s:1 h:1 k:1 k:1 s:1 h:1', 16) },
    ],
  },
  // 結束：短短的悲傷旋律，不重複
  bgm_gameover: {
    bpm: 90,
    loop: false,
    tracks: [
      { voice: 'square', vol: 0.1, notes: 'E5:2 D#5:2 D5:2 C#5:2 C5:4 B4:2 A4:6 -:2' },
      { voice: 'triangle', vol: 0.32, notes: 'A2:8 F2:4 E2:2 A2:6 -:2' },
    ],
  },
};

type StepEvent = (s: Synth, t: number, stepDur: number) => void;

function drum(kind: string, vol: number): StepEvent {
  return (s, t) => {
    if (kind === 'k') tone(s, t, 150, 45, 0.12, 'sine', 0.9 * vol);
    else if (kind === 's') noise(s, t, 0.12, 0.35 * vol, 'bandpass', 2500);
    else if (kind === 'h') noise(s, t, 0.03, 0.2 * vol, 'highpass', 7000);
  };
}

/** 把樂譜轉成「第幾個八分音符要發哪些聲音」 */
function compile(song: Song): StepEvent[][] {
  const steps: StepEvent[][] = [];
  for (const track of song.tracks) {
    let pos = 0;
    for (const token of track.notes.trim().split(/\s+/)) {
      const [name, len = '1'] = token.split(':');
      const length = Number(len);
      if (name !== '-') {
        let ev: StepEvent;
        if (track.voice === 'drums') {
          ev = drum(name, track.vol);
        } else {
          const f = hz(name);
          const voice = track.voice;
          ev = (s, t, stepDur) => tone(s, t, f, f, stepDur * length * 0.92, voice, track.vol);
        }
        (steps[pos] ??= []).push(ev);
      }
      pos += length;
    }
    steps.length = Math.max(steps.length, pos);
  }
  return steps;
}

const LOOKAHEAD = 0.15;

/** 用「提前排程」的方式播放樂譜，不受畫面卡頓影響 */
export class SongPlayer {
  private readonly steps: StepEvent[][];
  private readonly stepDur: number;
  private readonly loop: boolean;
  private readonly bus: GainNode;
  private readonly synth: Synth;
  private timer = 0;
  private step = 0;
  private nextTime = 0;

  constructor(base: Synth, key: MusicKey) {
    const song = SONGS[key];
    this.steps = compile(song);
    this.stepDur = 60 / song.bpm / 2;
    this.loop = song.loop;
    this.bus = base.ctx.createGain();
    this.bus.connect(base.out);
    this.synth = { ...base, out: this.bus };
  }

  start() {
    this.nextTime = this.synth.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.tick(), 25);
    this.tick();
  }

  stop() {
    window.clearInterval(this.timer);
    const t = this.synth.ctx.currentTime;
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + 0.08);
    window.setTimeout(() => this.bus.disconnect(), 200);
  }

  private tick() {
    const now = this.synth.ctx.currentTime;
    // 分頁在背景太久回來，直接跳到現在，不要一次補播一堆音
    if (this.nextTime < now - 0.2) this.nextTime = now;
    while (this.nextTime < now + LOOKAHEAD) {
      if (this.step >= this.steps.length) {
        if (!this.loop) return window.clearInterval(this.timer);
        this.step = 0;
      }
      for (const ev of this.steps[this.step] ?? []) ev(this.synth, this.nextTime, this.stepDur);
      this.step++;
      this.nextTime += this.stepDur;
    }
  }
}
