import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import assistantHandler from './api/assistant.js'
import { proxyInvestorApi } from './api/_investorProxy.js'
import { handleBtcDailyApi } from './api/_btcDaily.js'
import { handleMarketSparklineApi } from './api/_marketSparkline.js'

const BINANCE_SYMBOL_LIST_URL =
  'https://www.binance.com/bapi/composite/v1/public/marketing/symbol/list'

function normalizeMonitoringRows(rows: unknown) {
  return (Array.isArray(rows) ? rows : [])
    .filter((item) => {
      if (!item || typeof item !== 'object') return false
      const row = item as { baseAsset?: unknown; tags?: unknown }
      return typeof row.baseAsset === 'string'
        && Array.isArray(row.tags)
        && row.tags.includes('Monitoring')
    })
    .map((item) => {
      const row = item as {
        baseAsset?: unknown
        fullName?: unknown
        name?: unknown
        marketCap?: unknown
        tags?: unknown
      }
      return {
        asset: String(row.baseAsset || '').trim().toUpperCase(),
        name: String(row.fullName || row.name || ''),
        marketCap: Number(row.marketCap || 0),
        tags: row.tags,
      }
    })
    .filter((item) => item.asset)
    .sort((a, b) => a.asset.localeCompare(b.asset))
}

function assetQualityDevApiPlugin(): Plugin {
  return {
    name: 'asset-quality-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/asset-quality', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method !== 'GET') {
          res.statusCode = 405
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
          return
        }

        try {
          const response = await fetch(BINANCE_SYMBOL_LIST_URL, {
            headers: {
              accept: 'application/json',
              clienttype: 'web',
              'user-agent': 'Mozilla/5.0',
            },
            redirect: 'follow',
          })
          const json = await response.json() as { data?: unknown }
          const records = normalizeMonitoringRows(json.data)

          res.statusCode = response.ok && records.length > 0 ? 200 : 502
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify({
            success: response.ok && records.length > 0,
            source: BINANCE_SYMBOL_LIST_URL,
            updatedAt: new Date().toISOString(),
            binanceMonitoring: records,
            count: records.length,
            upstreamStatus: response.status,
          }))
        } catch (error) {
          res.statusCode = 502
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Asset quality proxy failed',
          }))
        }
      })
    },
  }
}

function investorDevApiPlugin(): Plugin {
  return {
    name: 'investor-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/investor-wife', (req, res) => {
        void proxyInvestorApi(req, res, 'wife')
      })

      server.middlewares.use('/api/investor', (req, res) => {
        void proxyInvestorApi(req, res, 'main')
      })

      server.middlewares.use('/api/btc-daily', (req, res) => {
        void handleBtcDailyApi(req, res)
      })

      server.middlewares.use('/api/market-sparkline', (req, res) => {
        void handleMarketSparklineApi(req, res)
      })

      server.middlewares.use('/api/assistant', (req, res) => {
        void assistantHandler(req, res)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  Object.entries(env).forEach(([key, value]) => {
    process.env[key] ??= value
  })

  return {
    plugins: [investorDevApiPlugin(), assetQualityDevApiPlugin(), react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('/node_modules/')) return undefined;
            if (id.includes('/@supabase/')) return 'supabase';
            if (id.includes('/@vitejs/') || id.includes('/vite/')) return 'build-tools';
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
            return 'vendor';
          },
        },
      },
    },
    server: {
      proxy: {
        '/api/fear-greed': {
          target: 'https://api.alternative.me',
          changeOrigin: true,
          secure: true,
          rewrite: () => '/fng/?limit=30',
        },
      },
    }
  }
})
