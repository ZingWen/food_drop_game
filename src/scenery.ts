import Phaser from 'phaser';

/** 像素風的背景：分層天空、雲、雪山、丘陵、松樹、草地。開始畫面和遊戲共用 */

const P = 8; // 背景的像素格大小
const snap = (v: number) => Math.round(v / P) * P;

const SKY = [0x3d6fd6, 0x4f83e0, 0x629aea, 0x78b2f2, 0x92c8f8, 0xb0dcfc];

const CLOUD = ['..xxx.....', '.xxxxx.xx.', 'xxxxxxxxxx', '.bbbbbbbb.'];

/** 固定的偽隨機（同一個 i 永遠得到同一個值） */
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function drawLandscape(g: Phaser.GameObjects.Graphics, width: number, height: number, groundY: number) {
  g.clear();

  // 天空：一條一條的色帶
  const band = Math.ceil(groundY / SKY.length / P) * P;
  SKY.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * band, width, band));

  // 雲（位置用畫面比例，換螢幕比例也不會跑掉）
  for (const [rx, ry] of [[0.08, 0.12], [0.34, 0.07], [0.58, 0.18], [0.82, 0.1]]) {
    const ox = snap(rx * width);
    const oy = snap(ry * groundY);
    CLOUD.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        g.fillStyle(ch === 'b' ? 0xc8e4fa : 0xffffff, 1).fillRect(ox + x * P, oy + y * P, P, P);
      }),
    );
  }

  // 遠方雪山
  const peaks = [[0.12, 0.42], [0.36, 0.55], [0.62, 0.4], [0.86, 0.5]].map(([rx, rh]) => [rx * width, rh * groundY]);
  for (let x = 0; x < width; x += P) {
    let h = 0;
    let peakH = 0;
    for (const [px, ph] of peaks) {
      const v = ph - Math.abs(x + P / 2 - px) * 0.9;
      if (v > h) [h, peakH] = [v, ph];
    }
    h = snap(h);
    if (h <= 0) continue;
    g.fillStyle(0x7a8cc8, 1).fillRect(x, groundY - h, P, h);
    g.fillStyle(0x6274b0, 1).fillRect(x, groundY - h + P * 2, P, Math.max(0, h - P * 2) * 0.4);
    if (h > peakH - 40) g.fillStyle(0xeef4ff, 1).fillRect(x, groundY - h, P, Math.min(h, h - (peakH - 48)));
  }

  // 綠色丘陵
  for (let x = 0; x < width; x += P) {
    const h = snap(60 + Math.sin(x / 140) * 26 + Math.sin(x / 57 + 1) * 12);
    g.fillStyle(0x4f9a4a, 1).fillRect(x, groundY - h, P, h);
    g.fillStyle(0x66b05a, 1).fillRect(x, groundY - h, P, P);
  }

  // 松樹
  for (let i = 0, x = 20; x < width; i++, x += 70 + hash(i) * 90) {
    const tx = snap(x);
    const th = 5 + Math.floor(hash(i + 50) * 4); // 樹高（格）
    const base = groundY - P * 2;
    g.fillStyle(0x6b4420, 1).fillRect(tx - P / 2, base, P, P * 2);
    for (let r = 0; r < th; r++) {
      const half = Math.ceil((r + 1) / 2) * P;
      g.fillStyle(r % 2 ? 0x2f6b3a : 0x3a8048, 1).fillRect(tx - half, base - (th - r) * P, half * 2, P);
    }
  }

  // 地面：草皮 + 泥土 + 小石頭
  g.fillStyle(0x6cbf4a, 1).fillRect(0, groundY, width, 16);
  g.fillStyle(0x4f9a3a, 1).fillRect(0, groundY + 12, width, 4);
  g.fillStyle(0x8b5e3c, 1).fillRect(0, groundY + 16, width, height - groundY - 16);
  for (let i = 0, x = 0; x < width; i++, x += P * 2) {
    if (hash(i) > 0.6) g.fillStyle(0x8fd65e, 1).fillRect(x, groundY - 4, 4, 8);
    if (hash(i + 100) > 0.7) {
      const sy = groundY + 24 + snap(hash(i + 200) * Math.max(0, height - groundY - 40));
      g.fillStyle(hash(i + 300) > 0.5 ? 0x6e4a2e : 0xa87a52, 1).fillRect(x, sy, P, 4);
    }
  }
}
