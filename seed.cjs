const { createClient } = require('@supabase/supabase-js')
const sb = createClient(
  'https://esfuzcizqjamcegmddok.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZnV6Y2l6cWphbWNlZ21kZG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTU1NzQsImV4cCI6MjEwMjg3MTU3NH0.ccCTSySdvcBM6KTR1xo7GB8l4DgJFzGlJNVCp0xTf9Y'
)

;(async () => {
  console.log('插入 admin 用户...')
  await sb.from('users').upsert({ id: 1, username: 'admin', password: 'admin123', role: 'admin' }, { onConflict: 'username' })

  console.log('插入分类...')
  const cats = [
    { id: 1, name: '产品知识', icon: '📦', sort_order: 1 },
    { id: 2, name: '销售技巧', icon: '💰', sort_order: 2 },
    { id: 3, name: '运营规范', icon: '📋', sort_order: 3 },
    { id: 4, name: '技术文档', icon: '⚙️', sort_order: 4 },
    { id: 5, name: '公司制度', icon: '🏢', sort_order: 5 },
    { id: 6, name: '业务流程', icon: '🔄', sort_order: 6 }
  ]
  for (const c of cats) {
    await sb.from('categories').upsert(c, { onConflict: 'name' })
  }

  console.log('插入文章...')
  const arts = [
    { id: 1, title: '产品入门指南', summary: '介绍公司核心产品线及主要功能', content: '## 产品概述\n\n本文档介绍公司核心产品线...\n\n## 主要功能\n1. 功能一\n2. 功能二\n3. 功能三', category: '产品知识', author: 'admin', views: 156, created_at: '2026-08-01' },
    { id: 2, title: '销售话术手册', summary: '常见客户问题及标准回答模板', content: '## 常见客户问题\n\n### 问题1: 价格是否可以优惠？\n**回答**: 您好，我们的价格已经非常合理...\n\n### 问题2: 产品质量怎么样？\n**回答**: 我们的产品经过 ISO 质量认证...', category: '销售技巧', author: 'admin', views: 89, created_at: '2026-08-02' },
    { id: 3, title: '日常运营流程', summary: '每日工作流程及注意事项', content: '## 每日工作流程\n\n1. **早上 9:00** 晨会\n2. **9:30** 邮件处理\n3. **10:00** 客户对接\n4. **14:00** 数据分析\n5. **17:00** 当日总结', category: '运营规范', author: 'admin', views: 234, created_at: '2026-08-03' },
    { id: 4, title: '系统架构文档', summary: '技术架构说明', content: '## 技术栈\n- 前端: Vue.js\n- 后端: Node.js\n- 数据库: PostgreSQL', category: '技术文档', author: 'admin', views: 67, created_at: '2026-08-04' },
    { id: 5, title: '员工手册', summary: '公司制度与福利说明', content: '## 公司制度\n\n### 考勤\n- 上班时间: 9:00\n- 下班时间: 18:00\n\n### 福利\n- 五险一金\n- 年度体检\n- 带薪年假', category: '公司制度', author: 'admin', views: 312, created_at: '2026-08-05' },
    { id: 6, title: '新员工入职指南', summary: '入职流程与培训安排', content: '## 入职流程\n\n### 第一天\n1. 报到登记\n2. 领取办公设备\n3. 熟悉工作环境\n\n### 第一周\n- 参加入职培训\n- 了解部门业务\n- 跟随 mentor 学习', category: '业务流程', author: 'admin', views: 156, created_at: '2026-08-06' }
  ]
  for (const a of arts) {
    await sb.from('articles').upsert(a, { onConflict: 'id' })
  }

  const { data: u } = await sb.from('users').select('*')
  const { data: c } = await sb.from('categories').select('*')
  const { data: a } = await sb.from('articles').select('id,title')
  console.log('验证 users:', u.length, 'categories:', c.length, 'articles:', a.length)
  console.log('完成 ✅')
})()
