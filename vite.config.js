import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 사내에서 로컬 실행/공유하기 쉽도록 host 노출
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})
