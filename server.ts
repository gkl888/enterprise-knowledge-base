import { serveStatic } from 'hono/serve-static'
import { serve } from '@hono/node-server'
import app from './src/app'

// 静态文件（仅 Node 运行时需要；Cloudflare Pages 会自动托管 public/）
app.use('/*', serveStatic({ root: './public' }))

// 本地 / Render / Koyeb 启动
const port = Number(process.env.PORT) || 3000
console.log(`Server running on port ${port}`)
serve({ fetch: app.fetch, port })

export default app
