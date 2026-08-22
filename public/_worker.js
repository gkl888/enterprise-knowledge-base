// Cloudflare Pages _worker.js - API 路由入口
import app from '../src/app'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    
    // API 路由走 Hono app
    if (url.pathname.startsWith('/api/')) {
      // Hono app 期望的路径已经是 /api/xxx，直接转发
      return app.fetch(request, env, ctx)
    }
    
    // 静态文件走默认 ASSETS
    return env.ASSETS.fetch(request)
  }
}
