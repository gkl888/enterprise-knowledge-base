import app from '../../src/app'

// Cloudflare Pages Functions - API router
// Pages 把 /api/xxx 匹配到这里，但传给 app 的路径需要补回 /api 前缀
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url)
    // 重写路径：/categories -> /api/categories
    const newUrl = new URL(request.url)
    newUrl.pathname = '/api' + url.pathname
    
    const newRequest = new Request(newUrl, request)
    return app.fetch(newRequest, env, ctx)
  }
}
