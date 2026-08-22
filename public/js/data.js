// 数据管理模块
const DataManager = {
    // 初始化默认数据
    init() {
        if (!localStorage.getItem('kb_articles')) {
            const defaultArticles = [
                {
                    id: 1,
                    title: '产品A核心功能介绍',
                    summary: '产品A的核心功能、目标客户及竞争优势',
                    content: '产品A是我们公司推出的旗舰产品，具有以下核心功能：\n\n1. 智能数据分析\n2. 自动化流程处理\n3. 多平台集成\n4. 实时协作功能\n\n目标客户：中小企业及大型企业的IT部门\n\n竞争优势：\n- 价格优势：比竞品低30%\n- 功能全面：一站式解决方案\n- 技术支持：7x24小时在线支持',
                    category: '产品知识',
                    author: '张三',
                    views: 178,
                    date: '2026/6/26',
                    isFavorite: false,
                    attachments: []
                },
                {
                    id: 2,
                    title: '差旅报销制度',
                    summary: '差旅交通工具、住宿标准及报销时限规定',
                    content: '差旅报销制度详细说明：\n\n一、交通工具标准\n- 飞机：经济舱（职级8级以上可商务舱）\n- 高铁：二等座（职级6级以上可一等座）\n- 出租车：凭票报销\n\n二、住宿标准\n- 一线城市：500元/晚\n- 二线城市：350元/晚\n- 三线城市：250元/晚\n\n三、报销时限\n出差结束后7个工作日内提交报销申请',
                    category: '规章制度',
                    author: '系统管理员',
                    views: 312,
                    date: '2026/6/26',
                    isFavorite: false,
                    attachments: []
                },
                {
                    id: 3,
                    title: 'CRM系统操作手册',
                    summary: 'CRM系统的登录、客户录入、商机管理及报表查看操作说明',
                    content: 'CRM系统操作手册\n\n1. 登录系统\n- 访问 https://crm.company.com\n- 使用企业微信扫码或账号密码登录\n\n2. 客户录入\n- 点击"新建客户"\n- 填写客户基本信息\n- 保存并分配跟进人\n\n3. 商机管理\n- 创建商机并关联客户\n- 跟进商机阶段\n- 记录沟通日志\n\n4. 报表查看\n- 销售漏斗分析\n- 业绩统计报表\n- 客户分布分析',
                    category: '技术支持',
                    author: '张三',
                    views: 234,
                    date: '2026/6/26',
                    isFavorite: false,
                    attachments: []
                },
                {
                    id: 4,
                    title: '销售合同审批流程',
                    summary: '销售合同从提交到签署的完整审批流程及所需材料',
                    content: '销售合同审批流程：\n\n第一步：销售提交\n- 填写合同申请表\n- 上传客户资质文件\n- 提交法务审核\n\n第二步：法务审核\n- 审核合同条款\n- 风险评估\n- 提出修改意见\n\n第三步：财务审核\n- 审核付款条款\n- 确认账期\n- 计算利润率\n\n第四步：总经理审批\n- 超过50万需总经理签字\n- 确认最终条款\n\n第五步：合同签署\n- 双方盖章\n- 归档保存',
                    category: '业务流程',
                    author: '系统管理员',
                    views: 89,
                    date: '2026/6/26',
                    isFavorite: false,
                    attachments: []
                },
                {
                    id: 5,
                    title: '新员工入职指南',
                    summary: '新员工入职流程、所需材料及第一周安排',
                    content: '新员工入职指南\n\n入职前准备：\n- 身份证原件及复印件\n- 学历证明\n- 离职证明\n- 体检报告\n- 银行卡信息\n\n入职第一天：\n- 9:00 前台报到\n- 9:30 办理入职手续\n- 10:30 部门介绍\n- 14:00 系统账号开通\n- 15:00 导师分配\n\n第一周安排：\n- 熟悉公司制度和流程\n- 参加新员工培训\n- 了解岗位职责\n- 完成导师布置的学习任务',
                    category: '业务流程',
                    author: '系统管理员',
                    views: 156,
                    date: '2026/6/26',
                    isFavorite: false,
                    attachments: []
                }
            ];
            localStorage.setItem('kb_articles', JSON.stringify(defaultArticles));
        }

        if (!localStorage.getItem('kb_categories')) {
            const defaultCategories = [
                { id: 'all', name: '全部文章', icon: 'list' },
                { id: 'product', name: '产品知识', icon: 'work' },
                { id: 'process', name: '业务流程', icon: 'account_tree' },
                { id: 'rule', name: '规章制度', icon: 'description' },
                { id: 'support', name: '技术支持', icon: 'check_circle' }
            ];
            localStorage.setItem('kb_categories', JSON.stringify(defaultCategories));
        }

        if (!localStorage.getItem('kb_user')) {
            localStorage.setItem('kb_user', JSON.stringify({
                username: 'admin',
                avatar: '系',
                isAdmin: true
            }));
        }
    },

    // 获取所有文章
    getArticles() {
        return JSON.parse(localStorage.getItem('kb_articles') || '[]');
    },

    // 获取文章详情
    getArticle(id) {
        const articles = this.getArticles();
        return articles.find(a => a.id === parseInt(id));
    },

    // 添加文章
    addArticle(article) {
        const articles = this.getArticles();
        article.id = Date.now();
        article.views = 0;
        article.date = new Date().toLocaleDateString('zh-CN');
        articles.unshift(article);
        localStorage.setItem('kb_articles', JSON.stringify(articles));
        return article;
    },

    // 更新文章
    updateArticle(id, updates) {
        const articles = this.getArticles();
        const index = articles.findIndex(a => a.id === parseInt(id));
        if (index !== -1) {
            articles[index] = { ...articles[index], ...updates };
            localStorage.setItem('kb_articles', JSON.stringify(articles));
            return articles[index];
        }
        return null;
    },

    // 删除文章
    deleteArticle(id) {
        let articles = this.getArticles();
        articles = articles.filter(a => a.id !== parseInt(id));
        localStorage.setItem('kb_articles', JSON.stringify(articles));
    },

    // 增加浏览量
    incrementViews(id) {
        const articles = this.getArticles();
        const article = articles.find(a => a.id === parseInt(id));
        if (article) {
            article.views++;
            localStorage.setItem('kb_articles', JSON.stringify(articles));
        }
    },

    // 切换收藏状态
    toggleFavorite(id) {
        const articles = this.getArticles();
        const article = articles.find(a => a.id === parseInt(id));
        if (article) {
            article.isFavorite = !article.isFavorite;
            localStorage.setItem('kb_articles', JSON.stringify(articles));
            return article.isFavorite;
        }
        return false;
    },

    // 获取收藏的文章
    getFavorites() {
        const articles = this.getArticles();
        return articles.filter(a => a.isFavorite);
    },

    // 搜索文章
    searchArticles(keyword) {
        const articles = this.getArticles();
        if (!keyword) return articles;
        const lowerKeyword = keyword.toLowerCase();
        return articles.filter(a => 
            a.title.toLowerCase().includes(lowerKeyword) ||
            a.summary.toLowerCase().includes(lowerKeyword) ||
            a.content.toLowerCase().includes(lowerKeyword)
        );
    },

    // 按分类筛选
    getArticlesByCategory(category) {
        const articles = this.getArticles();
        if (category === 'all' || !category) return articles;
        return articles.filter(a => a.category === category);
    },

    // 获取分类列表
    getCategories() {
        return JSON.parse(localStorage.getItem('kb_categories') || '[]');
    },

    // 添加分类
    addCategory(category) {
        const categories = this.getCategories();
        category.id = 'cat_' + Date.now();
        categories.push(category);
        localStorage.setItem('kb_categories', JSON.stringify(categories));
        return category;
    },

    // 删除分类
    deleteCategory(id) {
        let categories = this.getCategories();
        categories = categories.filter(c => c.id !== id);
        localStorage.setItem('kb_categories', JSON.stringify(categories));
    },

    // 获取当前用户
    getCurrentUser() {
        return JSON.parse(localStorage.getItem('kb_user') || '{}');
    }
};

// 初始化数据
DataManager.init();
