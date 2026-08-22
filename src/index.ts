import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 配置
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// ==================== 认证相关 ====================

// 登录
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json()
  const db = c.env.DB
  
  const user = await db.prepare(
    'SELECT id, username, role FROM users WHERE username = ? AND password = ?'
  ).bind(username, password).first()
  
  if (!user) {
    return c.json({ error: '用户名或密码错误' }, 401)
  }
  
  // 简单 token（生产环境应使用 JWT）
  const token = btoa(JSON.stringify({ userId: user.id, username: user.username, role: user.role }))
  
  return c.json({ 
    token,
    user: { id: user.id, username: user.username, role: user.role }
  })
})

// 验证 token
app.get('/api/verify', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  try {
    const token = auth.replace('Bearer ', '')
    const payload = JSON.parse(atob(token))
    return c.json({ user: payload })
  } catch {
    return c.json({ error: '无效 token' }, 401)
  }
})

// ==================== 文章相关 ====================

// 获取文章列表
app.get('/api/articles', async (c) => {
  const db = c.env.DB
  const category = c.req.query('category')
  const search = c.req.query('search')
  
  let sql = 'SELECT * FROM articles WHERE 1=1'
  const params: string[] = []
  
  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }
  
  if (search) {
    sql += ' AND (title LIKE ? OR content LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }
  
  sql += ' ORDER BY created_at DESC'
  
  const stmt = db.prepare(sql)
  const result = await stmt.bind(...params).all()
  
  return c.json(result.results)
})

// 获取单篇文章
app.get('/api/articles/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  
  // 增加浏览量
  await db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').bind(id).run()
  
  const article = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first()
  
  if (!article) {
    return c.json({ error: '文章不存在' }, 404)
  }
  
  return c.json(article)
})

// 创建文章（管理员）
app.post('/api/articles', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  if (payload.role !== 'admin') {
    return c.json({ error: '无权限' }, 403)
  }
  
  const db = c.env.DB
  const { title, content, summary, category } = await c.req.json()
  
  const result = await db.prepare(
    'INSERT INTO articles (title, content, summary, category, author) VALUES (?, ?, ?, ?, ?)'
  ).bind(title, content, summary || '', category, payload.username).run()
  
  return c.json({ id: result.meta.last_row_id, message: '创建成功' }, 201)
})

// 更新文章（管理员）
app.put('/api/articles/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  if (payload.role !== 'admin') {
    return c.json({ error: '无权限' }, 403)
  }
  
  const db = c.env.DB
  const id = c.req.param('id')
  const { title, content, summary, category } = await c.req.json()
  
  await db.prepare(
    'UPDATE articles SET title = ?, content = ?, summary = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(title, content, summary || '', category, id).run()
  
  return c.json({ message: '更新成功' })
})

// 删除文章（管理员）
app.delete('/api/articles/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  if (payload.role !== 'admin') {
    return c.json({ error: '无权限' }, 403)
  }
  
  const db = c.env.DB
  const id = c.req.param('id')
  
  await db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run()
  await db.prepare('DELETE FROM favorites WHERE article_id = ?').bind(id).run()
  
  return c.json({ message: '删除成功' })
})

// ==================== 分类相关 ====================

app.get('/api/categories', async (c) => {
  const db = c.env.DB
  const result = await db.prepare('SELECT * FROM categories ORDER BY sort_order').all()
  return c.json(result.results)
})

// ==================== 收藏相关 ====================

// 获取用户收藏
app.get('/api/favorites', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  const db = c.env.DB
  const result = await db.prepare(`
    SELECT a.*, f.created_at as favorite_at 
    FROM favorites f 
    JOIN articles a ON f.article_id = a.id 
    WHERE f.user_id = ? 
    ORDER BY f.created_at DESC
  `).bind(payload.userId).all()
  
  return c.json(result.results)
})

// 添加收藏
app.post('/api/favorites/:articleId', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  const db = c.env.DB
  const articleId = c.req.param('articleId')
  
  try {
    await db.prepare('INSERT INTO favorites (user_id, article_id) VALUES (?, ?)')
      .bind(payload.userId, articleId).run()
    return c.json({ message: '收藏成功' })
  } catch {
    return c.json({ error: '已收藏' }, 400)
  }
})

// 取消收藏
app.delete('/api/favorites/:articleId', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  const db = c.env.DB
  const articleId = c.req.param('articleId')
  
  await db.prepare('DELETE FROM favorites WHERE user_id = ? AND article_id = ?')
    .bind(payload.userId, articleId).run()
  
  return c.json({ message: '取消收藏' })
})

// ==================== 知识交流池 ====================

// 提交留言
app.post('/api/discussions', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  const db = c.env.DB
  const { content } = await c.req.json()
  
  await db.prepare('INSERT INTO discussions (user_id, username, content) VALUES (?, ?, ?)')
    .bind(payload.userId, payload.username, content).run()
  
  return c.json({ message: '提交成功' })
})

// 获取留言列表（管理员）
app.get('/api/discussions', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  if (payload.role !== 'admin') {
    return c.json({ error: '无权限' }, 403)
  }
  
  const db = c.env.DB
  const result = await db.prepare('SELECT * FROM discussions ORDER BY created_at DESC').all()
  
  return c.json(result.results)
})

// 回复留言（管理员）
app.put('/api/discussions/:id/reply', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  if (payload.role !== 'admin') {
    return c.json({ error: '无权限' }, 403)
  }
  
  const db = c.env.DB
  const id = c.req.param('id')
  const { reply } = await c.req.json()
  
  await db.prepare(`
    UPDATE discussions 
    SET reply = ?, replied_by = ?, replied_at = CURRENT_TIMESTAMP, status = 'replied' 
    WHERE id = ?
  `).bind(reply, payload.username, id).run()
  
  return c.json({ message: '回复成功' })
})

// 删除留言（管理员）
app.delete('/api/discussions/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  if (payload.role !== 'admin') {
    return c.json({ error: '无权限' }, 403)
  }
  
  const db = c.env.DB
  const id = c.req.param('id')
  
  await db.prepare('DELETE FROM discussions WHERE id = ?').bind(id).run()
  
  return c.json({ message: '删除成功' })
})

// ==================== 用户管理（管理员） ====================

// 获取用户列表
app.get('/api/users', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  if (payload.role !== 'admin') {
    return c.json({ error: '无权限' }, 403)
  }
  
  const db = c.env.DB
  const result = await db.prepare('SELECT id, username, role, created_at FROM users').all()
  
  return c.json(result.results)
})

// 创建用户
app.post('/api/users', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  if (payload.role !== 'admin') {
    return c.json({ error: '无权限' }, 403)
  }
  
  const db = c.env.DB
  const { username, password, role } = await c.req.json()
  
  try {
    await db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
      .bind(username, password, role || 'user').run()
    return c.json({ message: '创建成功' }, 201)
  } catch {
    return c.json({ error: '用户名已存在' }, 400)
  }
})

// 删除用户
app.delete('/api/users/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: '未登录' }, 401)
  
  const token = auth.replace('Bearer ', '')
  const payload = JSON.parse(atob(token))
  
  if (payload.role !== 'admin') {
    return c.json({ error: '无权限' }, 403)
  }
  
  const db = c.env.DB
  const id = c.req.param('id')
  
  if (id === String(payload.userId)) {
    return c.json({ error: '不能删除自己' }, 400)
  }
  
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  
  return c.json({ message: '删除成功' })
})

export default app
