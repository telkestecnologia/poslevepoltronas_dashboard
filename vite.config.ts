import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Buffer } from 'node:buffer'
import { env } from 'node:process'

export default defineConfig(({ command }) => {
  const localLoginBypass = command === 'serve' && env.DASHBOARD_DEV_LOGIN_BYPASS === 'true'
  const adminEmail = env.DASHBOARD_DEV_ADMIN_EMAIL
  const adminPassword = env.DASHBOARD_DEV_ADMIN_PASSWORD

  if (localLoginBypass && (!adminEmail || !adminPassword)) {
    throw new Error('O acesso local ao dashboard exige as credenciais administrativas no servidor Vite.')
  }

  const authorization = localLoginBypass
    ? `Basic ${Buffer.from(`${adminEmail}:${adminPassword}`).toString('base64')}`
    : ''

  return {
    plugins: [react()],
    define: { __DASHBOARD_DEV_LOGIN_BYPASS__: JSON.stringify(localLoginBypass) },
    server: {
      host: 'localhost',
      port: 5174,
      strictPort: true,
      proxy: localLoginBypass ? {
        '/api/admin': {
          target: env.DASHBOARD_DEV_API_TARGET || 'http://127.0.0.1:8080',
          changeOrigin: true,
          configure: proxy => {
            proxy.on('proxyReq', proxyRequest => {
              proxyRequest.setHeader('Authorization', authorization)
            })
          },
        },
      } : undefined,
    },
  }
})
