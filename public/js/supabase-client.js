// 前端 Supabase 直连 + Token 管理
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SUPABASE_URL = 'https://esfuzcizqjamcegmddok.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZnV6Y2l6cWphbWNlZ21kZG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTU1NzQsImV4cCI6MjEwMjg3MTU3NH0.ccCTSySdvcBM6KTR1xo7GB8l4DgJFzGlJNVCp0xTf9Y'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// 当前用户
let currentUser = null

export function getCurrentUser() {
  if (currentUser) return currentUser
  const stored = localStorage.getItem('kb_user')
  if (stored) {
    try { currentUser = JSON.parse(stored); return currentUser } catch {}
  }
  return null
}

export function setCurrentUser(user, token) {
  currentUser = user
  localStorage.setItem('kb_user', JSON.stringify(user))
  if (token) localStorage.setItem('kb_token', token)
}

export function clearCurrentUser() {
  currentUser = null
  localStorage.removeItem('kb_user')
  localStorage.removeItem('kb_token')
}

// API 封装（直连 Supabase，绕过 Workers/Functions）
export const API = {
  async login(username, password) {
    const { data, error } = await sb.from('users').select('id, username, role').eq('username', username).eq('password', password).limit(1)
    if (error || !data || data.length === 0) throw new Error('用户名或密码错误')
    const user = data[0]
    const token = btoa(JSON.stringify({ userId: user.id, username: user.username, role: user.role }))
    setCurrentUser(user, token)
    return { token, user }
  },

  async getArticles(category, search) {
    let q = sb.from('articles').select('*').order('created_at', { ascending: false })
    if (category) q = q.eq('category', category)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    let result = data || []
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(a => (a.title || '').toLowerCase().includes(s) || (a.content || '').toLowerCase().includes(s))
    }
    return result
  },

  async getArticle(id) {
    const { data: article, error } = await sb.from('articles').select('*').eq('id', id).single()
    if (error || !article) throw new Error('文章不存在')
    await sb.from('articles').update({ views: (article.views || 0) + 1 }).eq('id', id)
    return { ...article, views: (article.views || 0) + 1 }
  },

  async createArticle(body) {
    const user = getCurrentUser()
    if (!user) throw new Error('未登录')
    if (user.role !== 'admin') throw new Error('无权限')
    const { data, error } = await sb.from('articles').insert({
      title: body.title, content: body.content, summary: body.summary || '',
      category: body.category, author: user.username, views: 0,
      created_at: new Date().toISOString().split('T')[0]
    }).select().single()
    if (error) throw new Error(error.message)
    return { id: data.id, message: '创建成功' }
  },

  async updateArticle(id, body) {
    const user = getCurrentUser()
    if (!user) throw new Error('未登录')
    if (user.role !== 'admin') throw new Error('无权限')
    const { error } = await sb.from('articles').update({
      title: body.title, content: body.content, summary: body.summary, category: body.category
    }).eq('id', id)
    if (error) throw new Error(error.message)
    return { message: '更新成功' }
  },

  async deleteArticle(id) {
    const user = getCurrentUser()
    if (!user) throw new Error('未登录')
    if (user.role !== 'admin') throw new Error('无权限')
    const { error } = await sb.from('articles').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await sb.from('favorites').delete().eq('article_id', id)
    return { message: '删除成功' }
  },

  async getCategories() {
    const { data, error } = await sb.from('categories').select('*').order('sort_order', { ascending: true })
    if (error) throw new Error(error.message)
    return data || []
  },

  async getFavorites() {
    const user = getCurrentUser()
    if (!user) throw new Error('未登录')
    const { data: favs, error } = await sb.from('favorites').select('article_id, created_at').eq('user_id', user.userId)
    if (error) throw new Error(error.message)
    if (!favs || favs.length === 0) return []
    const articleIds = favs.map(f => f.article_id)
    const { data: articles } = await sb.from('articles').select('*').in('id', articleIds)
    return (articles || []).map(a => {
      const fav = favs.find(f => f.article_id === a.id)
      return { ...a, favorite_at: fav?.created_at }
    })
  },

  async addFavorite(articleId) {
    const user = getCurrentUser()
    if (!user) throw new Error('未登录')
    const { data: exist } = await sb.from('favorites').select('id').eq('user_id', user.userId).eq('article_id', articleId).limit(1)
    if (exist && exist.length > 0) throw new Error('已收藏')
    const { error } = await sb.from('favorites').insert({ user_id: user.userId, article_id: parseInt(articleId) })
    if (error) throw new Error(error.message)
    return { message: '收藏成功' }
  },

  async removeFavorite(articleId) {
    const user = getCurrentUser()
    if (!user) throw new Error('未登录')
    const { error } = await sb.from('favorites').delete().eq('user_id', user.userId).eq('article_id', articleId)
    if (error) throw new Error(error.message)
    return { message: '取消收藏' }
  },

  async submitDiscussion(content) {
    const user = getCurrentUser()
    if (!user) throw new Error('未登录')
    const { error } = await sb.from('discussions').insert({
      user_id: user.userId, username: user.username, content,
      reply: null, replied_by: null, replied_at: null, status: 'pending'
    })
    if (error) throw new Error(error.message)
    return { message: '提交成功' }
  },

  async getDiscussions() {
    const user = getCurrentUser()
    if (!user) throw new Error('未登录')
    if (user.role !== 'admin') throw new Error('无权限')
    const { data, error } = await sb.from('discussions').select('*').order('id', { ascending: false })
    if (error) throw new Error(error.message)
    return data || []
  },

  async replyDiscussion(id, reply) {
    const user = getCurrentUser()
    if (!user) throw new Error('未登录')
    if (user.role !== 'admin') throw new Error('无权限')
    const { error } = await sb.from('discussions').update({
      reply, replied_by: user.username, replied_at: new Date().toISOString(), status: 'replied'
    }).eq('id', id)
    if (error) throw new Error(error.message)
    return { message: '回复成功' }
  },

  async deleteDiscussion(id) {
    const user = getCurrentUser()
    if (!user) throw new Error('未登录')
    if (user.role !== 'admin') throw new Error('无权限')
    const { error } = await sb.from('discussions').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { message: '删除成功' }
  }
}