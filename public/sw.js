// Service Worker - 拦截 /api/* 请求，转发到 Supabase 直连
const SUPABASE_URL = 'https://esfuzcizqjamcegmddok.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZnV6Y2l6cWphbWNlZ21kZG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTU1NzQsImV4cCI6MjEwMjg3MTU3NH0.ccCTSySdvcBM6KTR1xo7GB8l4DgJFzGlJNVCp0xTf9Y'

function authFromRequest(request) {
  const auth = request.headers.get('Authorization')
  if (!auth) return null
  try { return JSON.parse(atob(auth.replace('Bearer ', ''))) } catch { return null }
}

async function supabaseQuery(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation'
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  return res
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.startsWith('/api/')) return
  
  event.respondWith(handleApi(event.request, url))
})

async function handleApi(request, url) {
  const path = url.pathname.replace('/api', '')
  const user = authFromRequest(request)
  const method = request.method

  try {
    // 登录
    if (path === '/login' && method === 'POST') {
      const { username, password } = await request.json()
      const res = await supabaseQuery(`/users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=id,username,role,password`)
      const users = await res.json()
      if (!users || users.length === 0) return jsonResponse({ error: '用户名或密码错误' }, 401)
      const u = users[0]
      const token = btoa(JSON.stringify({ userId: u.id, username: u.username, role: u.role }))
      return jsonResponse({ token, user: { id: u.id, username: u.username, role: u.role } })
    }

    // 文章列表
    if (path === '/articles' && method === 'GET') {
      const category = url.searchParams.get('category')
      const search = url.searchParams.get('search')
      let q = '/articles?order=created_at.desc'
      if (category) q += `&category=eq.${encodeURIComponent(category)}`
      const res = await supabaseQuery(q)
      let data = await res.json()
      if (search) {
        const s = search.toLowerCase()
        data = data.filter(a => (a.title || '').toLowerCase().includes(s) || (a.content || '').toLowerCase().includes(s))
      }
      return jsonResponse(data)
    }

    // 单篇文章
    const articleMatch = path.match(/^\/articles\/(\d+)$/)
    if (articleMatch && method === 'GET') {
      const id = articleMatch[1]
      const res = await supabaseQuery(`/articles?id=eq.${id}&select=*`)
      const arr = await res.json()
      if (!arr || arr.length === 0) return jsonResponse({ error: '文章不存在' }, 404)
      const article = arr[0]
      await supabaseQuery(`/articles?id=eq.${id}`, {
        method: 'PATCH',
        body: { views: (article.views || 0) + 1 }
      })
      return jsonResponse({ ...article, views: (article.views || 0) + 1 })
    }

    // 创建文章
    if (path === '/articles' && method === 'POST') {
      if (!user) return jsonResponse({ error: '未登录' }, 401)
      if (user.role !== 'admin') return jsonResponse({ error: '无权限' }, 403)
      const body = await request.json()
      const insertData = {
        title: body.title, content: body.content, summary: body.summary || '',
        category: body.category, author: user.username, views: 0,
        created_at: new Date().toISOString().split('T')[0]
      }
      const res = await supabaseQuery('/articles', { method: 'POST', body: insertData, prefer: 'return=representation' })
      const arr = await res.json()
      return jsonResponse({ id: arr[0].id, message: '创建成功' }, 201)
    }

    // 更新文章
    const updateMatch = path.match(/^\/articles\/(\d+)$/)
    if (updateMatch && method === 'PUT') {
      if (!user) return jsonResponse({ error: '未登录' }, 401)
      if (user.role !== 'admin') return jsonResponse({ error: '无权限' }, 403)
      const id = updateMatch[1]
      const body = await request.json()
      await supabaseQuery(`/articles?id=eq.${id}`, {
        method: 'PATCH',
        body: { title: body.title, content: body.content, summary: body.summary, category: body.category }
      })
      return jsonResponse({ message: '更新成功' })
    }

    // 删除文章
    const delMatch = path.match(/^\/articles\/(\d+)$/)
    if (delMatch && method === 'DELETE') {
      if (!user) return jsonResponse({ error: '未登录' }, 401)
      if (user.role !== 'admin') return jsonResponse({ error: '无权限' }, 403)
      const id = delMatch[1]
      await supabaseQuery(`/articles?id=eq.${id}`, { method: 'DELETE' })
      await supabaseQuery(`/favorites?article_id=eq.${id}`, { method: 'DELETE' })
      return jsonResponse({ message: '删除成功' })
    }

    // 分类
    if (path === '/categories' && method === 'GET') {
      const res = await supabaseQuery('/categories?order=sort_order.asc')
      return jsonResponse(await res.json())
    }

    // 收藏
    if (path === '/favorites' && method === 'GET') {
      if (!user) return jsonResponse({ error: '未登录' }, 401)
      const favRes = await supabaseQuery(`/favorites?user_id=eq.${user.userId}&select=article_id,created_at`)
      const favs = await favRes.json()
      if (!favs || favs.length === 0) return jsonResponse([])
      const ids = favs.map(f => f.article_id).join(',')
      const articleRes = await supabaseQuery(`/articles?id=in.(${ids})`)
      const articles = await articleRes.json()
      const result = articles.map(a => {
        const fav = favs.find(f => f.article_id === a.id)
        return { ...a, favorite_at: fav?.created_at }
      })
      return jsonResponse(result)
    }

    const favMatch = path.match(/^\/favorites\/(\d+)$/)
    if (favMatch && method === 'POST') {
      if (!user) return jsonResponse({ error: '未登录' }, 401)
      const articleId = favMatch[1]
      const existRes = await supabaseQuery(`/favorites?user_id=eq.${user.userId}&article_id=eq.${articleId}&select=id`)
      const exist = await existRes.json()
      if (exist && exist.length > 0) return jsonResponse({ error: '已收藏' }, 400)
      await supabaseQuery('/favorites', { method: 'POST', body: { user_id: user.userId, article_id: parseInt(articleId) } })
      return jsonResponse({ message: '收藏成功' })
    }

    if (favMatch && method === 'DELETE') {
      if (!user) return jsonResponse({ error: '未登录' }, 401)
      const articleId = favMatch[1]
      await supabaseQuery(`/favorites?user_id=eq.${user.userId}&article_id=eq.${articleId}`, { method: 'DELETE' })
      return jsonResponse({ message: '取消收藏' })
    }

    // 留言
    if (path === '/discussions' && method === 'POST') {
      if (!user) return jsonResponse({ error: '未登录' }, 401)
      const { content } = await request.json()
      await supabaseQuery('/discussions', {
        method: 'POST',
        body: { user_id: user.userId, username: user.username, content, reply: null, replied_by: null, replied_at: null, status: 'pending' }
      })
      return jsonResponse({ message: '提交成功' })
    }

    if (path === '/discussions' && method === 'GET') {
      if (!user) return jsonResponse({ error: '未登录' }, 401)
      if (user.role !== 'admin') return jsonResponse({ error: '无权限' }, 403)
      const res = await supabaseQuery('/discussions?order=id.desc')
      return jsonResponse(await res.json())
    }

    const replyMatch = path.match(/^\/discussions\/(\d+)\/reply$/)
    if (replyMatch && method === 'PUT') {
      if (!user) return jsonResponse({ error: '未登录' }, 401)
      if (user.role !== 'admin') return jsonResponse({ error: '无权限' }, 403)
      const id = replyMatch[1]
      const { reply } = await request.json()
      await supabaseQuery(`/discussions?id=eq.${id}`, {
        method: 'PATCH',
        body: { reply, replied_by: user.username, replied_at: new Date().toISOString(), status: 'replied' }
      })
      return jsonResponse({ message: '回复成功' })
    }

    const delDiscMatch = path.match(/^\/discussions\/(\d+)$/)
    if (delDiscMatch && method === 'DELETE') {
      if (!user) return jsonResponse({ error: '未登录' }, 401)
      if (user.role !== 'admin') return jsonResponse({ error: '无权限' }, 403)
      const id = delDiscMatch[1]
      await supabaseQuery(`/discussions?id=eq.${id}`, { method: 'DELETE' })
      return jsonResponse({ message: '删除成功' })
    }

    return jsonResponse({ error: 'Not Found' }, 404)
  } catch (err) {
    return jsonResponse({ error: err.message }, 500)
  }
}