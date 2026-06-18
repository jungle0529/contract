import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 프로젝트 사이트(/contract/) 기준으로 자산 경로를 설정한다.
// 로컬 dev 에서는 루트('/')를 쓴다.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/contract/' : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
}))
