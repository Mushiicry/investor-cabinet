import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { proxyInvestorApi } from './api/_investorProxy.js'

const ENV_KEYS_FOR_LOCAL_PROXY = [
  'APPS_SCRIPT_SHARED_SECRET',
  'INVESTOR_APPS_SCRIPT_SHARED_SECRET',
  'WIFE_APPS_SCRIPT_SHARED_SECRET',
  'INVESTOR_APPS_SCRIPT_URL',
  'WIFE_APPS_SCRIPT_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'FOUNDER_EMAIL',
  'WIFE_EMAIL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_FOUNDER_EMAIL',
  'VITE_WIFE_EMAIL',
] as const

const loadServerEnvForLocalProxy = (mode: string) => {
  const env = loadEnv(mode, process.cwd(), '')

  ENV_KEYS_FOR_LOCAL_PROXY.forEach((key) => {
    const value = env[key]

    if (!process.env[key] && value) {
      process.env[key] = value
    }
  })
}

const investorLocalProxy = (): PluginOption => ({
  name: 'investor-local-auth-proxy',
  configureServer(server) {
    server.middlewares.use('/api/investor-wife', (req, res) => {
      void proxyInvestorApi(req, res, 'wife')
    })

    server.middlewares.use('/api/investor', (req, res) => {
      void proxyInvestorApi(req, res, 'main')
    })
  },
})

export default defineConfig(({ mode }) => {
  loadServerEnvForLocalProxy(mode)

  return {
    plugins: [react(), tailwindcss(), investorLocalProxy()],
    server: {
      proxy: {
        '/api/fear-greed': {
          target: 'https://api.alternative.me',
          changeOrigin: true,
          secure: true,
          rewrite: () => '/fng/?limit=30',
        },
      },
    },
  }
})
