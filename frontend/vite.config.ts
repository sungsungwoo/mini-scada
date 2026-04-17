import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * `VITE_API_ORIGIN` 미설정 시에만 사용: 로컬에서 `npm run dev` → `/api`를 호스트의 백엔드로 전달.
 * Docker에서는 compose에 `VITE_API_ORIGIN=http://localhost:8080`을 두어 브라우저가 API를 직접 호출(CORS).
 */
const apiProxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      // MQTT WebSocket — 브라우저는 dev 서버 Origin 으로 `/mqtt` 접속, 여기서 Mosquitto :9001 로 전달
      '/mqtt': {
        target: 'http://127.0.0.1:9001',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/mqtt/, '') || '/',
      },
    },
  },
})
