import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { telegramFeedbackPlugin } from './telegram-feedback-plugin.ts'

const base = process.env.GITHUB_PAGES === '1' ? '/Restaurant-Card/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    telegramFeedbackPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '餐卡',
        short_name: '餐卡',
        description: '餐卡餘額紀錄與計算機',
        theme_color: '#f5f5f7',
        background_color: '#f5f5f7',
        display: 'standalone',
        start_url: base,
        scope: base,
        lang: 'zh-Hant',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
