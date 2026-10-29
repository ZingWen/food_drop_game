import { defineConfig } from 'vite';

export default defineConfig({
  // 相對路徑，build 出來的資料夾放到任何網址底下都能跑（GitHub Pages、itch.io）
  base: './',
  server: { open: true },
  // Phaser 本身就約 1.7MB，提高警告門檻
  build: { chunkSizeWarningLimit: 2000 },
});
