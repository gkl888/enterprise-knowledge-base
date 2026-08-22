-- Supabase 数据库初始化脚本

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '📚',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文章表
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  category TEXT,
  author TEXT,
  views INT DEFAULT 0,
  created_at DATE DEFAULT CURRENT_DATE
);

-- 收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  article_id INT REFERENCES articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

-- 留言表
CREATE TABLE IF NOT EXISTS discussions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  username TEXT,
  content TEXT,
  reply TEXT,
  replied_by TEXT,
  replied_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS（简化版直接禁用）
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE favorites DISABLE ROW LEVEL SECURITY;
ALTER TABLE discussions DISABLE ROW LEVEL SECURITY;

-- 初始化默认数据
INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO categories (name, icon, sort_order) VALUES
  ('产品知识', '📦', 1),
  ('销售技巧', '💰', 2),
  ('运营规范', '📋', 3),
  ('技术文档', '⚙️', 4),
  ('公司制度', '🏢', 5),
  ('业务流程', '🔄', 6)
ON CONFLICT (name) DO NOTHING;

INSERT INTO articles (title, summary, content, category, author, views) VALUES
  ('产品入门指南', '介绍公司核心产品线及主要功能', '## 产品概述

本文档介绍公司核心产品线...

## 主要功能
1. 功能一
2. 功能二
3. 功能三', '产品知识', 'admin', 156),
  ('销售话术手册', '常见客户问题及标准回答模板', '## 常见客户问题

### 问题1: 价格是否可以优惠？
**回答**: 您好，我们的价格已经非常合理...

### 问题2: 产品质量怎么样？
**回答**: 我们的产品经过 ISO 质量认证...', '销售技巧', 'admin', 89),
  ('日常运营流程', '每日工作流程及注意事项', '## 每日工作流程

1. **早上 9:00** 晨会
2. **9:30** 邮件处理
3. **10:00** 客户对接
5. **14:00** 数据分析
6. **17:00** 当日总结', '运营规范', 'admin', 234),
  ('系统架构文档', '技术架构说明', '## 技术栈
- 前端: Vue.js
- 后端: Node.js
- 数据库: PostgreSQL', '技术文档', 'admin', 67),
  ('员工手册', '公司制度与福利说明', '## 公司制度

### 考勤
- 上班时间: 9:00
- 下班时间: 18:00

### 福利
- 五险一金
- 年度体检
- 带薪年假', '公司制度', 'admin', 312),
  ('新员工入职指南', '入职流程与培训安排', '## 入职流程

### 第一天
1. 报到登记
2. 领取办公设备
3. 熟悉工作环境

### 第一周
- 参加入职培训
- 了解部门业务
- 跟随 mentor 学习', '业务流程', 'admin', 156)
ON CONFLICT DO NOTHING;