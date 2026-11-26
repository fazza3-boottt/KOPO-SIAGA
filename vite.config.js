import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { weatherLocations } from './src/lib/weather.js'

function bmkgProxyPlugin() {
  const allowedLocations = new Set(weatherLocations.map(({ id }) => id))
  const middleware = (request, response, next) => {
    if (request.method !== 'GET' || !request.url) {
      next()
      return
    }

    const requestUrl = new URL(request.url, 'http://localhost')
    if (requestUrl.pathname !== '/api/bmkg/prakiraan-cuaca') {
      next()
      return
    }

    const locationId = requestUrl.searchParams.get('adm4')
    if (!allowedLocations.has(locationId)) {
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Kode wilayah BMKG tidak diizinkan.' }))
      return
    }

    fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(locationId)}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (upstream) => {
        const body = await upstream.text()
        response.writeHead(upstream.status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=900',
        })
        response.end(body)
      })
      .catch((error) => {
        console.error('BMKG forecast proxy failed:', error)
        if (!response.headersSent) {
          response.writeHead(502, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ error: 'Tidak dapat terhubung ke layanan BMKG.' }))
        }
      })
  }

  return {
    name: 'kopo-siaga-bmkg-proxy',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  plugins: [bmkgProxyPlugin(), react()],
})
