// Cloudflare Pages _worker.ts - 完整 API 服务
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'

const app = new Hono()

const SUPABASE_URL = 'https://esfuzcizqjamcegmddok.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZnV6Y2l6cWphbWNlZ21kZG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTU1NzQsImV4cCI6MjEwMjg3MTU3NH0.ccCTSySdvcBM6KTR1xo7GB8l4DgJFzGlJNVCp0xTf9Y'
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'] }))

function getAuth(c: any): { userId: number; username: string; role: string } | null {
  const auth = c.req.header('Authorization')
  if (!auth) return null
  try {
    const token = auth.replace('Bearer ', '')
    return JSON.parse(atob(token))
  } catch { return null }
}

// 登录
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json()
  const { data: users, error } = await sb.from('users').select('id, username, role, password').eq('username', username).eq('password', password).limit(1)
  if (error || !users || users.length === 0) return c.json({ error: '用户名或密码错误' }, 401)
  const user = users[0]
  const token = btoa(JSON.stringify({ userId: user.id, username: user.username, role: user.role }))
  return c.json({ token, user: { id: user.id, username: user.username, role: user.role } })
})

// 获取文章列表
app.get('/api/articles', async (c) => {
  const category = c.req.query('category')
  const search = c.req.query('search')
  let query = sb.from('articles').select('*').order('created_at', { ascending: false })
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  let result = data || []
  if (search) {
    const s = search.toLowerCase()
    result = result.filter((a: any) => (a.title || '').toLowerCase().includes(s) || (a.content || '').toLowerCase().includes(s))
  }
  return c.json(result)
})

// 获取单篇文章
app.get('/api/articles/:id', async (c) => {
  const id = c.req.param('id')
  const { data: article, error } = await sb.from('articles').select('*').eq('id', id).single()
  if (error || !article) return c.json({ error: '文章不存在' }, 404)
  await sb.from('articles').update({ views: (article.views || 0) + 1 }).eq('id', id)
  return c.json({ ...article, views: (article.views || 0) + 1 })
})

// 创建文章（管理员）
app.post('/api/articles', async (c) => {
  const user = getAuth(c); if (!user) return c.json({ error: '未登录' }, 401)
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403)
  const body = await c.req.json()
  const { data, error } = await sb.from('articles').insert({
    title: body.title, content: body.content, summary: body.summary || '',
    category: body.category, author: user.username, views: 0,
    created_at: new Date().toISOString().split('T')[0]
  }).select().single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ id: data.id, message: '创建成功' }, 201)
})

// 更新文章
app.put('/api/articles/:id', async (c) => {
  const user = getAuth(c); if (!user) return c.json({ error: '未登录' }, 401)
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403)
  const id = c.req.param('id')
  const body = await c.req.json()
  const { error } = await sb.from('articles').update({
    title: body.title, content: body.content, summary: body.summary, category: body.category
  }).eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: '更新成功' })
})

// 删除文章
app.delete('/api/articles/:id', async (c) => {
  const user = getAuth(c); if (!user) return c.json({ error: '未登录' }, 401)
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403)
  const id = c.req.param('id')
  const { error } = await sb.from('articles').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  await sb.from('favorites').delete().eq('article_id', id)
  return c.json({ message: '删除成功' })
})

// 获取分类
app.get('/api/categories', async (c) => {
  const { data, error } = await sb.from('categories').select('*').order('sort_order', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data || [])
})

// 获取收藏
app.get('/api/favorites', async (c) => {
  const user = getAuth(c); if (!user) return c.json({ error: '未登录' }, 401)
  const { data: favs, error } = await sb.from('favorites').select('article_id, created_at').eq('user_id', user.userId)
  if (error) return c.json({ error: error.message }, 500)
  if (!favs || favs.length === 0) return c.json([])
  const articleIds = favs.map((f: any) => f.article_id)
  const { data: articles } = await sb.from('articles').select('*').in('id', articleIds)
  const result = (articles || []).map((a: any) => {
    const fav = favs.find((f: any) => f.article_id === a.id)
    return { ...a, favorite_at: fav?.created_at }
  })
  return c.json(result)
})

// 添加收藏
app.post('/api/favorites/:articleId', async (c) => {
  const user = getAuth(c); if (!user) return c.json({ error: '未登录' }, 401)
  const articleId = c.req.param('articleId')
  const { data: exist } = await sb.from('favorites').select('id').eq('user_id', user.userId).eq('article_id', articleId).limit(1)
  if (exist && exist.length > 0) return c.json({ error: '已收藏' }, 400)
  const { error } = await sb.from('favorites').insert({ user_id: user.userId, article_id: parseInt(articleId) })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: '收藏成功' })
})

// 取消收藏
app.delete('/api/favorites/:articleId', async (c) => {
  const user = getAuth(c); if (!user) return c.json({ error: '未登录' }, 401)
  const articleId = c.req.param('articleId')
  const { error } = await sb.from('favorites').delete().eq('user_id', user.userId).eq('article_id', articleId)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: '取消收藏' })
})

// 提交留言
app.post('/api/discussions', async (c) => {
  const user = getAuth(c); if (!user) return c.json({ error: '未登录' }, 401)
  const { content } = await c.req.json()
  const { error } = await sb.from('discussions').insert({
    user_id: user.userId, username: user.username, content,
    reply: null, replied_by: null, replied_at: null, status: 'pending'
  })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: '提交成功' })
})

// 获取留言列表（管理员）
app.get('/api/discussions', async (c) => {
  const user = getAuth(c); if (!user) return c.json({ error: '未登录' }, 401)
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403)
  const { data, error } = await sb.from('discussions').select('*').order('id', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data || [])
})

// 回复留言
app.put('/api/discussions/:id/reply', async (c) => {
  const user = getAuth(c); if (!user) return c.json({ error: '未登录' }, 401)
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403)
  const id = c.req.param('id')
  const { reply } = await c.req.json()
  const { error } = await sb.from('discussions').update({
    reply, replied_by: user.username, replied_at: new Date().toISOString(), status: 'replied'
  }).eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: '回复成功' })
})

// 删除留言
app.delete('/api/discussions/:id', async (c) => {
  const user = getAuth(c); if (!user) return c.json({ error: '未登录' }, 401)
  if (user.role !== 'admin') return c.json({ error: '无权限' }, 403)
  const id = c.req.param('id')
  const { error } = await sb.from('discussions').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: '删除成功' })
})

// Pages 入口
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url)
    
    // API 路由走 Hono
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx)
    }
    
    // 静态文件走 ASSETS
    return env.ASSETS.fetch(request)
  }
}
