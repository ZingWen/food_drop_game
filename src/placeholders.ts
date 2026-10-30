import Phaser from 'phaser';

/**
 * 暫代圖：用程式畫的像素風（RPG）圖。
 * 如果 config.ts 的 IMAGE_FILES 已經載入同名的正式圖片，就不會產生。
 *
 * 做法：先在小格子上「點像素」，再放大畫到 canvas。
 * 食物是 16×16 原尺寸（顯示時整數倍放大）；烏鴉、籃子、鳥巢直接以 4 倍畫出。
 */

type Grid = (string | null)[][];
type Palette = Record<string, string>;
type Shades = [light: string, base: string, dark: string];

export const CROW_FRAME = 128;
const BIG_PX = 4; // 烏鴉、籃子、鳥巢：1 格像素 = 4px
const CROW_WING_ANGLES = [-55, -20, 25, -20]; // 拍翅 4 格的翅膀角度（負數往上）

function makeGrid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(null));
}

function set(g: Grid, x: number, y: number, color: string) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = color;
}

/** 用字串點像素：每個字元查 palette 的顏色，查不到的（例如 '.'）不畫 */
function stamp(g: Grid, rows: string[], pal: Palette, ox = 0, oy = 0) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => pal[ch] && set(g, ox + x, oy + y, pal[ch])));
}

/** 有明暗的橢圓，光從左上方來 */
function blob(g: Grid, cx: number, cy: number, rx: number, ry: number, [light, base, dark]: Shades) {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const s = nx * 0.6 + ny * 0.8;
      g[y][x] = s < -0.45 ? light : s > 0.35 ? dark : base;
    }
  }
}

function line(g: Grid, x0: number, y0: number, x1: number, y1: number, color: string) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= steps; i++) {
    set(g, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), color);
  }
}

/** 在所有已畫像素的外圍描一圈邊；skip 回傳 true 的位置不描 */
function outline(g: Grid, color: string, skip?: (x: number, y: number) => boolean) {
  const src = g.map((row) => [...row]);
  const filled = (x: number, y: number) => src[y]?.[x] != null;
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) {
      if (filled(x, y) || skip?.(x, y)) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) g[y][x] = color;
    }
  }
}

function paint(ctx: CanvasRenderingContext2D, g: Grid, px: number, ox = 0) {
  g.forEach((row, y) =>
    row.forEach((c, x) => {
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x * px, y * px, px, px);
    }),
  );
}

function render(scene: Phaser.Scene, key: string, g: Grid, px = 1) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, g[0].length * px, g.length * px);
  if (!tex) return;
  paint(tex.getContext(), g, px);
  tex.refresh();
}

// ───────────────────────── 食物（16×16） ─────────────────────────

function appleShape(g: Grid, body: Shades, shine: string) {
  blob(g, 8, 9.5, 6.2, 5.8, body);
  stamp(g, ['..s...', '.s.ll.', '.sLll.', '.s....'], { s: '#6b3e1f', l: '#6ccf5a', L: '#2e8b3a' }, 7, 0);
  set(g, 5, 6, shine);
  set(g, 5, 7, shine);
  set(g, 6, 6, shine);
}

function foodApple() {
  const g = makeGrid(16, 16);
  appleShape(g, ['#ff7a6b', '#e03a3a', '#a01f2a'], '#ffd0c8');
  outline(g, '#3a1218');
  return g;
}

function foodGolden() {
  const g = makeGrid(16, 16);
  appleShape(g, ['#fff3a0', '#f5c518', '#b8860b'], '#ffffff');
  outline(g, '#5a3d00');
  // 閃光不描邊
  stamp(g, ['.w.', 'www', '.w.'], { w: '#ffffff' }, 12, 2);
  set(g, 2, 13, '#fff3a0');
  return g;
}

/** 食物底下的白盤子 */
function plate(g: Grid) {
  blob(g, 8, 12, 7.9, 2.8, ['#ffffff', '#f4f4f8', '#cfd4e2']);
}

function foodSteak() {
  // 斜上方看的牛排：白盤子 + 薄薄一片有厚度的肉 + 交叉烤網紋
  const g = makeGrid(16, 16);
  plate(g);

  // 肉的上表面（橢圓），左邊缺一角讓輪廓不那麼規則
  const top = makeGrid(16, 16);
  blob(top, 8.3, 8, 6.9, 3.6, ['#c27040', '#a8582c', '#94491f']);
  for (const [x, y] of [[1, 8], [2, 7], [1, 9]]) top[y][x] = null;
  // 側面厚度：上表面每一欄的最下緣往下多 1 格
  for (let x = 0; x < 16; x++) {
    let last = -1;
    for (let y = 0; y < 16; y++) if (top[y][x]) last = y;
    if (last >= 0) set(g, x, last + 1, '#5e2a12');
  }
  top.forEach((row, y) =>
    row.forEach((c, x) => {
      if (!c) return;
      const mark = c !== '#c27040' && ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0);
      set(g, x, y, mark ? '#5a2a14' : c);
    }),
  );
  outline(g, '#2a160c');
  return g;
}

function foodPork() {
  // 松阪豬：盤子上左右並排的三片烤肉片，粉白色帶烤痕和油花
  const g = makeGrid(16, 16);
  plate(g);
  const slice = [
    '.oooo.',
    'opwpso',
    'okppko',
    'opwwso',
    'okppko',
    'opwpso',
    'ossss.',
    '.ooo..',
  ];
  const pal = { o: '#6a3a22', p: '#f2c4a4', s: '#dc9a74', w: '#fff0e6', k: '#9a5a34' };
  // 由左往右畫，右邊那片蓋住左邊那片的邊；高低稍微錯開
  for (const [ox, oy] of [[0, 4], [5, 3], [10, 4]]) stamp(g, slice, pal, ox, oy);
  outline(g, '#2a160c');
  return g;
}

function foodBread() {
  const g = makeGrid(16, 16);
  blob(g, 8, 10, 7.2, 4.4, ['#f2c27a', '#d08a3c', '#8f5420']);
  for (const k of [4, 7, 10]) line(g, k, 10, k + 2, 8, '#f8dca0');
  outline(g, '#4a2a0c');
  return g;
}

function foodCheese() {
  const g = makeGrid(16, 16);
  stamp(
    g,
    [
      '................',
      '................',
      '................',
      '...........yy...',
      '.......yyyyyYy..',
      '...yyyyyyyYYYYy.',
      '.yyYYYYYYYYYYYY.',
      '.dddddddddddddd.',
      '.dddhddddddhddd.',
      '.ddhhddddddddhd.',
      '.dddddddhhddddd.',
      '.dhdddddhddddhd.',
      '.ddddddddddddd..',
      '................',
    ],
    { y: '#fff4b0', Y: '#ffe066', d: '#f5c542', h: '#c98f1c' },
  );
  outline(g, '#5a4000');
  return g;
}

function foodFish() {
  // 烤魚
  const g = makeGrid(16, 16);
  blob(g, 6.5, 8.5, 5.8, 3.8, ['#f0c088', '#c8844a', '#8a5228']);
  for (let x = 12; x <= 15; x++) {
    const half = (x - 11) * 0.9;
    for (let y = Math.round(8.5 - half); y < Math.round(8.5 + half); y++) set(g, x, y, '#b07040');
  }
  for (const gx of [6, 9]) line(g, gx, 6, gx - 1, 10, '#5a3018');
  set(g, 3, 7, '#ffffff');
  set(g, 3, 8, '#1a1a1a');
  outline(g, '#3a2010');
  return g;
}

function foodTomato() {
  // 惡魔番茄：有生氣的眼睛
  const g = makeGrid(16, 16);
  blob(g, 8, 9.5, 6.8, 5.4, ['#ff8a65', '#e53935', '#9b1b1b']);
  stamp(g, ['..s..', '.ggg.', 'ggggg', '.g.g.'], { s: '#3d6b1e', g: '#4caf50' }, 6, 2);
  stamp(g, ['k...k', '.k.k.', '.k.k.'], { k: '#1a0505' }, 6, 8);
  set(g, 4, 7, '#ffc4b0');
  outline(g, '#3a1010');
  return g;
}

function foodBomb() {
  const g = makeGrid(16, 16);
  blob(g, 7.5, 10, 5.6, 5.6, ['#6b6b80', '#3a3a48', '#1a1a22']);
  stamp(g, ['.cc.', 'cccc'], { c: '#8a8a9a' }, 6, 3);
  stamp(g, ['..f', '.f.', 'f..'], { f: '#c8a060' }, 9, 1);
  set(g, 5, 8, '#a0a0b8');
  set(g, 4, 9, '#a0a0b8');
  outline(g, '#08080c');
  stamp(g, ['.o.', 'oyo', '.o.'], { o: '#ff9800', y: '#ffffff' }, 11, 0);
  return g;
}

function foodRotten() {
  // 發霉的雞腿 + 臭氣
  const g = makeGrid(16, 16);
  blob(g, 6.5, 8, 4.9, 4.4, ['#a8c060', '#7a9a3a', '#4d6420']);
  line(g, 9, 10, 12, 13, '#d8d0b0');
  line(g, 10, 10, 12, 12, '#d8d0b0');
  stamp(g, ['.b.', 'bbb', '.b.'], { b: '#efe8cc' }, 12, 12);
  for (const [x, y] of [[5, 6], [7, 9], [4, 9], [8, 6]]) set(g, x, y, '#6a3a7a');
  outline(g, '#1e2a0a');
  for (const x of [3, 7, 11]) stamp(g, ['k.', '.k', 'k.'], { k: '#9fd04a' }, x, 0);
  return g;
}

// ───────────────────────── 主角與場景物件（4 倍） ─────────────────────────

function crowFrame(wingDeg: number): Grid {
  const g = makeGrid(32, 32);
  const body: Shades = ['#44476e', '#2b2d4a', '#1a1b30'];

  // 尾巴（往左張開）
  for (let x = 1; x <= 8; x++) {
    const top = Math.round(15 - (8 - x) * 0.45);
    const bottom = Math.round(19 + (8 - x) * 0.35);
    for (let y = top; y <= bottom; y++) {
      if (x <= 2 && y % 2 === 0) continue; // 羽毛末端的缺口
      set(g, x, y, y < 17 ? body[0] : y % 2 ? body[1] : body[2]);
    }
  }
  blob(g, 15, 17, 9, 5.8, body);
  blob(g, 24, 13.5, 4.6, 4.4, body);

  // 嘴（尖端在 31,14 → 放大後約 124,57，就是籃子的掛點）
  stamp(g, ['uu..', 'uuu.', 'lll.', 'l...'], { u: '#a0a0b8', l: '#5a5a70' }, 28, 12);
  set(g, 31, 14, '#a0a0b8');

  // 眼睛
  stamp(g, ['ww', 'wk'], { w: '#ffffff', k: '#000000' }, 25, 11);

  // 翅膀：從肩膀到翼尖，越往外越細
  const a = (wingDeg * Math.PI) / 180;
  const tipX = 14.5 - 12.5 * Math.cos(a);
  const tipY = 14.5 + 12.5 * Math.sin(a);
  for (let t = 0; t <= 1; t += 0.02) {
    const cx = 18 + (tipX - 18) * t;
    const cy = 15 + (tipY - 15) * t;
    const r = 3.2 * (1 - t) + 0.6;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) set(g, x, y, '#4c5080');
      }
    }
  }
  outline(g, '#0b0b14');
  return g;
}

/** 披風往左多畫的格數（披風尾端會飄到烏鴉尾巴後面） */
const CAPE_EXTRA = 12;
export const CAPE_FRAME_W = (32 + CAPE_EXTRA) * BIG_PX;
/** 披風圖上「脖子」的位置（px），用來對齊烏鴉和當作飄動的轉軸 */
export const CAPE_NECK = { x: (21 + CAPE_EXTRA) * BIG_PX, y: 12 * BIG_PX };

/** 披風（掛在脖子，往後飄），放在烏鴉後面；格子比烏鴉寬，左邊多 CAPE_EXTRA 格 */
function capeFrame(phase: number): Grid {
  const g = makeGrid(32 + CAPE_EXTRA, 32);
  const neck = 21 + CAPE_EXTRA;
  const end = 3; // 尾端留邊，披風才不會被畫布切掉
  for (let x = end; x <= neck; x++) {
    const k = (neck - x) / (neck - end); // 0 = 脖子，1 = 披風尾端
    const wave = Math.sin(x * 0.45 + phase) * 2 * k;
    const rawTop = 10 - Math.sin(k * Math.PI * 0.8) * 3 + k * 2 + wave;
    const rawBottom = rawTop + 3 + k * 10 + Math.sin(x * 0.5 + phase + 1.2) * 1.5 * k;
    // 最後幾格斜斜地收成尖角（尖端偏下方，像被風吹起的布角）
    const taper = Math.min(1, (x - end) / 10) ** 1.3;
    const tip = rawTop + (rawBottom - rawTop) * 0.75;
    const top = Math.round(tip - (tip - rawTop) * taper);
    const bottom = Math.round(tip + (rawBottom - tip) * taper);
    for (let y = top; y <= bottom; y++) {
      const fold = (x + Math.round(Math.sin(y * 0.3) * 2)) % 6 === 0;
      const c = y <= top ? '#4a64d0' : y >= bottom - 1 ? '#121a4a' : fold ? '#16205a' : '#22308a';
      set(g, x, y, c);
    }
  }
  outline(g, '#060a22');
  return g;
}

/** 披風在脖子上的領口與金色扣環，疊在烏鴉前面 */
function capeCollar(): Grid {
  const g = makeGrid(32, 32);
  stamp(g, ['bb', 'bb', 'bb', 'bk', 'bb', '.b'], { b: '#1e2c78', k: '#ffd23f' }, 20, 10);
  outline(g, '#060a22');
  return g;
}

const BASKET_W = 24;
const BASKET_H = 20;

function basketBack(): Grid {
  // 籃口內側（深色），食物會畫在它前面
  const g = makeGrid(BASKET_W, BASKET_H);
  blob(g, 12, 8.5, 10.5, 2.4, ['#5a3818', '#4a2a10', '#3a200a']);
  return g;
}

function basketFront(): Grid {
  const g = makeGrid(BASKET_W, BASKET_H);
  // 籃身 + 編織格紋
  for (let y = 9; y < BASKET_H; y++) {
    const inset = Math.round((y - 9) * 0.25);
    for (let x = 2 + inset; x <= 21 - inset; x++) {
      const weave = ((x >> 1) + (y >> 1)) % 2 ? '#c68642' : '#a86c32';
      set(g, x, y, y === BASKET_H - 2 ? '#8b5a2b' : weave);
    }
  }
  // 籃口前緣
  for (let x = 2; x <= 21; x++) set(g, x, 8, '#e0a060');
  for (let x = 1; x <= 22; x++) set(g, x, 9, '#b87a3a');
  // 上緣不描邊，籃子裡的食物才不會被線切到
  outline(g, '#3b220d', (_x, y) => y < 8);
  // 提把（最高點在畫布上緣中央，就是被叼的地方）
  for (let t = 0; t <= 1; t += 0.01) {
    set(g, Math.round(2.5 + 19 * t), Math.round(8 - 8 * Math.sin(Math.PI * t)), '#6b4420');
  }
  return g;
}

function nest(): Grid {
  const g = makeGrid(50, 24);
  blob(g, 25, 15.5, 23.5, 7.5, ['#a87443', '#7a4f2a', '#4f3018']);
  // 樹枝（固定的偽隨機，每次看起來都一樣）
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 30; i++) {
    const x = 4 + rnd() * 42;
    const y = 12 + rnd() * 10;
    const len = 3 + rnd() * 6;
    const tilt = (rnd() - 0.5) * 0.8;
    const color = i % 3 ? '#c08850' : '#5a3a1e';
    for (let k = 0; k <= len; k++) {
      const px = Math.round(x - len / 2 + k);
      const py = Math.round(y + tilt * (k - len / 2));
      if (g[py]?.[px]) set(g, px, py, color);
    }
  }
  // 中間凹下去的巢穴
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 50; x++) {
      if (((x + 0.5 - 25) / 17) ** 2 + ((y + 0.5 - 11.5) / 3.4) ** 2 <= 1) set(g, x, y, '#3e2610');
    }
  }
  outline(g, '#2a1808');
  return g;
}

// ───────────────────────── UI 與特效 ─────────────────────────

function heart(fill: string, shine: string): Grid {
  const g = makeGrid(9, 8);
  stamp(g, ['.RR.RR.', 'RhRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], { R: fill, h: shine }, 1, 1);
  outline(g, '#120810');
  return g;
}

function stunStars(): Grid {
  const g = makeGrid(14, 8);
  const star = ['..y..', '.yYy.', 'yYYYy', '.yYy.', '.y.y.'];
  stamp(g, star, { y: '#ffd23f', Y: '#fff6c0' }, 1, 2);
  stamp(g, star, { y: '#ffd23f', Y: '#fff6c0' }, 8, 1);
  outline(g, '#5a3a00');
  return g;
}

function boom(): Grid {
  const g = makeGrid(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 8;
      const r = 6 + 1.6 * Math.sin(Math.atan2(dy, dx) * 8);
      const d = Math.hypot(dx, dy) / r;
      if (d <= 1) g[y][x] = d < 0.45 ? '#fff6c0' : d < 0.75 ? '#ffd23f' : '#ff7a1a';
    }
  }
  outline(g, '#7a1a0a');
  return g;
}

function pauseIcon(): Grid {
  const g = makeGrid(11, 11);
  stamp(g, ['kkk.kkk', 'kkk.kkk', 'kkk.kkk', 'kkk.kkk', 'kkk.kkk', 'kkk.kkk', 'kkk.kkk'], { k: '#ffffff' }, 2, 2);
  outline(g, '#000000');
  return g;
}

function trophyIcon(): Grid {
  const g = makeGrid(13, 12);
  stamp(
    g,
    ['kkkkkkkkk', 'kyyyyyyyk', 'kyyyyyyyk', '.kyyyyyk.', '..kyyyk..', '...kyk...', '...kyk...', '..kyyyk..', '.kkkkkkk.'],
    { k: '#b8860b', y: '#ffd84a' },
    2,
    1,
  );
  // 把手
  stamp(g, ['yy.........yy', 'y...........y', '.y.........y.'], { y: '#ffd84a' }, 0, 2);
  set(g, 4, 2, '#fff6c0');
  set(g, 4, 3, '#fff6c0');
  outline(g, '#000000');
  return g;
}

function speaker(on: boolean): Grid {
  const g = makeGrid(13, 10);
  stamp(g, ['...k', '..kk', 'kkkk', 'kkkk', 'kkkk', '..kk', '...k'], { k: '#ffffff' }, 1, 1);
  const extra = on
    ? ['.....k.', '..k...k', '...k..k', '...k..k', '...k..k', '..k...k', '.....k.']
    : ['.......', '..k...k', '...k.k.', '....k..', '...k.k.', '..k...k', '.......'];
  stamp(g, extra, { k: on ? '#ffffff' : '#ff8080' }, 5, 1);
  outline(g, '#000000');
  return g;
}

export function makePlaceholders(scene: Phaser.Scene) {
  const foods: Record<string, () => Grid> = {
    food_steak: foodSteak,
    food_apple: foodApple,
    food_bread: foodBread,
    food_cheese: foodCheese,
    food_fish: foodFish,
    food_golden: foodGolden,
    food_pork: foodPork,
    food_rotten: foodRotten,
    food_tomato: foodTomato,
    food_bomb: foodBomb,
  };
  for (const [key, draw] of Object.entries(foods)) render(scene, key, draw());

  if (!scene.textures.exists('crow')) {
    const tex = scene.textures.createCanvas('crow', CROW_FRAME * CROW_WING_ANGLES.length, CROW_FRAME);
    if (tex) {
      CROW_WING_ANGLES.forEach((deg, i) => {
        paint(tex.getContext(), crowFrame(deg), BIG_PX, i * CROW_FRAME);
        tex.add(i, 0, i * CROW_FRAME, 0, CROW_FRAME, CROW_FRAME);
      });
      tex.refresh();
    }
  }

  const capeFrames = [0, 1, 2, 3].map((i) => capeFrame((i * Math.PI) / 2));
  if (!scene.textures.exists('crow_cape')) {
    const tex = scene.textures.createCanvas('crow_cape', CAPE_FRAME_W * capeFrames.length, CROW_FRAME);
    if (tex) {
      capeFrames.forEach((grid, i) => {
        paint(tex.getContext(), grid, BIG_PX, i * CAPE_FRAME_W);
        tex.add(i, 0, i * CAPE_FRAME_W, 0, CAPE_FRAME_W, CROW_FRAME);
      });
      tex.refresh();
    }
  }
  render(scene, 'crow_cape_collar', capeCollar(), BIG_PX);

  render(scene, 'basket_back', basketBack(), BIG_PX);
  render(scene, 'basket_front', basketFront(), BIG_PX);
  render(scene, 'nest', nest(), BIG_PX);

  render(scene, 'heart_full', heart('#e83a4a', '#ffb0b8'), 4);
  render(scene, 'heart_empty', heart('#3a2a40', '#4a3a52'), 4);
  render(scene, 'fx_stun', stunStars(), 3);
  render(scene, 'fx_boom', boom(), 4);
  render(scene, 'icon_sound_on', speaker(true), 3);
  render(scene, 'icon_sound_off', speaker(false), 3);
  render(scene, 'icon_pause', pauseIcon(), 3);
  render(scene, 'icon_trophy', trophyIcon(), 3);
}
