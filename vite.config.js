import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // 빌드마다 바뀌는 값: assets/manifest.json 을 이 값으로 불러 브라우저가 옛 포켓몬 목록을 캐시해 쓰지 않게 한다 (systems/SpriteLoader.js)
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  server: { host: '127.0.0.1', port: 5173 },
  build: { chunkSizeWarningLimit: 2000 }
});
