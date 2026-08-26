(function() {
  var U = 'https://esfuzcizqjamcegmddok.supabase.co';
  var K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZnV6Y2l6cWphbWNlZ21kZG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTU1NzQsImV4cCI6MjEwMjg3MTU3NH0.ccCTSySdvcBM6KTR1xo7GB8l4DgJFzGlJNVCp0xTf9Y';

  function getAuth() {
    try { return JSON.parse(atob(localStorage.getItem('token') || '')); } catch (e) { return null; }
  }

  function h(p, o) {
    o = o || {};
    var x = new XMLHttpRequest();
    x.open(o.method || 'GET', U + '/rest/v1' + p, false);
    x.setRequestHeader('apikey', K);
    x.setRequestHeader('Authorization', 'Bearer ' + K);
    x.setRequestHeader('Content-Type', 'application/json');
    if (o.prefer) x.setRequestHeader('Prefer', o.prefer);
    x.send(o.body ? JSON.stringify(o.body) : null);
    return x;
  }

  function jr(d, s) {
    return new Response(JSON.stringify(d), { status: s || 200, headers: { 'Content-Type': 'application/json' } });
  }

  function parseBody(input, init) {
    if (init && init.body) {
      try { return JSON.parse(init.body); } catch (e) { return null; }
    }
    return null;
  }

  function recordLog(username, action, targetType, targetId, detail) {
    try {
      h('/activity_logs', {
        method: 'POST',
        body: {
          username: username || 'anonymous',
          action: action,
          target_type: targetType || null,
          target_id: targetId ? String(targetId) : null,
          detail: detail || null
        }
      });
    } catch (e) {
      console.error('log failed', e);
    }
  }

  var orig = window.fetch;
  window.fetch = function(input, init) {
    var url;
    if (typeof input === 'string') {
      url = new URL(input, location.origin);
    } else if (input && input.url) {
      url = new URL(input.url, location.origin);
    } else {
      return orig(input, init);
    }

    if (url.pathname.indexOf('/api/') !== 0) {
      return orig(input, init);
    }

    var path = url.pathname.replace('/api', '');
    var method = (init && init.method) || (input && input.method) || 'GET';
    method = method.toUpperCase();
    var body = parseBody(input, init);
    var user = getAuth();

    try {
      // ===== 登录 =====
      if (path === '/login' && method === 'POST') {
        var r = h('/users?username=eq.' + encodeURIComponent(body.username) + '&password=eq.' + encodeURIComponent(body.password) + '&select=id,username,role,password,status');
        var users = JSON.parse(r.responseText);
        if (!users || !users.length) {
          recordLog(body.username, 'login_failed', 'session', null, '用户名或密码错误');
          return Promise.resolve(jr({ error: '用户名或密码错误' }, 401));
        }
        var u = users[0];
        if (u.status === 'disabled') {
          recordLog(u.username, 'login_blocked', 'session', null, '账号已禁用');
          return Promise.resolve(jr({ error: '账号已禁用，请联系管理员' }, 403));
        }
        // 更新最后登录时间
        h('/users?id=eq.' + u.id, { method: 'PATCH', body: { last_login_at: new Date().toISOString() } });
        var token = btoa(JSON.stringify({ userId: u.id, username: u.username, role: u.role }));
        recordLog(u.username, 'login', 'session', null, '登录成功');
        return Promise.resolve(jr({ token: token, user: { id: u.id, username: u.username, role: u.role } }));
      }

      // ===== 文章 =====
      if (path === '/articles' && method === 'GET') {
        var q = '/articles?order=created_at.desc';
        if (url.searchParams.get('category')) q += '&category=eq.' + encodeURIComponent(url.searchParams.get('category'));
        var r2 = h(q);
        var data = JSON.parse(r2.responseText);
        var search = url.searchParams.get('search');
        if (search) {
          var s = search.toLowerCase();
          data = data.filter(function(a) { return (a.title || '').toLowerCase().indexOf(s) !== -1 || (a.content || '').toLowerCase().indexOf(s) !== -1; });
        }
        return Promise.resolve(jr(data));
      }

      var m;
      if ((m = path.match(/^\/articles\/(\d+)$/)) && method === 'GET') {
        var r3 = h('/articles?id=eq.' + m[1] + '&select=*');
        var arr = JSON.parse(r3.responseText);
        if (!arr || !arr.length) return Promise.resolve(jr({ error: 'not found' }, 404));
        var a = arr[0];
        h('/articles?id=eq.' + m[1], { method: 'PATCH', body: { views: (a.views || 0) + 1 } });
        var na = {}; for (var k in a) na[k] = a[k]; na.views = (a.views || 0) + 1;
        return Promise.resolve(jr(na));
      }

      if (path === '/articles' && method === 'POST') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        var r4 = h('/articles', {
          method: 'POST',
          body: { title: body.title, content: body.content, summary: body.summary || '', category: body.category, author: user.username, views: 0, created_at: new Date().toISOString().split('T')[0] },
          prefer: 'return=representation'
        });
        var arr2 = JSON.parse(r4.responseText);
        recordLog(user.username, 'create_article', 'article', arr2[0] && arr2[0].id, '新建文章：' + body.title);
        return Promise.resolve(jr({ id: arr2[0].id, message: 'created' }, 201));
      }

      if ((m = path.match(/^\/articles\/(\d+)$/)) && method === 'PUT') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        h('/articles?id=eq.' + m[1], { method: 'PATCH', body: { title: body.title, content: body.content, summary: body.summary, category: body.category } });
        recordLog(user.username, 'update_article', 'article', m[1], '更新文章：' + body.title);
        return Promise.resolve(jr({ message: 'updated' }));
      }

      if ((m = path.match(/^\/articles\/(\d+)$/)) && method === 'DELETE') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        // 先查标题用于日志
        var aInfo = JSON.parse(h('/articles?id=eq.' + m[1] + '&select=title').responseText);
        h('/articles?id=eq.' + m[1], { method: 'DELETE' });
        h('/favorites?article_id=eq.' + m[1], { method: 'DELETE' });
        recordLog(user.username, 'delete_article', 'article', m[1], '删除文章：' + ((aInfo && aInfo[0] && aInfo[0].title) || m[1]));
        return Promise.resolve(jr({ message: 'deleted' }));
      }

      // ===== 分类 =====
      if (path === '/categories' && method === 'GET') {
        return Promise.resolve(jr(JSON.parse(h('/categories?order=sort_order.asc').responseText)));
      }

      // ===== 收藏 =====
      if (path === '/favorites' && method === 'GET') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        var favs = JSON.parse(h('/favorites?user_id=eq.' + user.userId + '&select=article_id,created_at').responseText);
        if (!favs || !favs.length) return Promise.resolve(jr([]));
        var ids = favs.map(function(f) { return f.article_id; }).join(',');
        var articles = JSON.parse(h('/articles?id=in.(' + ids + ')').responseText);
        var result = articles.map(function(a) {
          var fav = favs.find(function(f) { return f.article_id === a.id; });
          var na2 = {}; for (var k2 in a) na2[k2] = a[k2];
          na2.favorite_at = fav && fav.created_at;
          return na2;
        });
        return Promise.resolve(jr(result));
      }

      if ((m = path.match(/^\/favorites\/(\d+)$/)) && method === 'POST') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        var exist = JSON.parse(h('/favorites?user_id=eq.' + user.userId + '&article_id=eq.' + m[1] + '&select=id').responseText);
        if (exist && exist.length) return Promise.resolve(jr({ error: '已收藏' }, 400));
        h('/favorites', { method: 'POST', body: { user_id: user.userId, article_id: parseInt(m[1]) } });
        recordLog(user.username, 'favorite', 'article', m[1], '收藏文章');
        return Promise.resolve(jr({ message: 'favorited' }));
      }

      if ((m = path.match(/^\/favorites\/(\d+)$/)) && method === 'DELETE') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        h('/favorites?user_id=eq.' + user.userId + '&article_id=eq.' + m[1], { method: 'DELETE' });
        recordLog(user.username, 'unfavorite', 'article', m[1], '取消收藏');
        return Promise.resolve(jr({ message: 'unfavorited' }));
      }

      // ===== 留言 =====
      if (path === '/discussions' && method === 'POST') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        h('/discussions', {
          method: 'POST',
          body: { user_id: user.userId, username: user.username, content: body.content, reply: null, replied_by: null, replied_at: null, status: 'pending' }
        });
        recordLog(user.username, 'create_discussion', 'discussion', null, '发表留言');
        return Promise.resolve(jr({ message: 'submitted' }));
      }

      if (path === '/discussions' && method === 'GET') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        return Promise.resolve(jr(JSON.parse(h('/discussions?order=id.desc').responseText)));
      }

      if ((m = path.match(/^\/discussions\/(\d+)\/reply$/)) && method === 'PUT') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        h('/discussions?id=eq.' + m[1], {
          method: 'PATCH',
          body: { reply: body.reply, replied_by: user.username, replied_at: new Date().toISOString(), status: 'replied' }
        });
        recordLog(user.username, 'reply_discussion', 'discussion', m[1], '回复留言');
        return Promise.resolve(jr({ message: 'replied' }));
      }

      if ((m = path.match(/^\/discussions\/(\d+)$/)) && method === 'DELETE') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        h('/discussions?id=eq.' + m[1], { method: 'DELETE' });
        recordLog(user.username, 'delete_discussion', 'discussion', m[1], '删除留言');
        return Promise.resolve(jr({ message: 'deleted' }));
      }

      // ===== 用户管理（仅 admin）=====
      if (path === '/users' && method === 'GET') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        var q = '/users?order=id.asc&select=id,username,role,status,created_at,last_login_at';
        return Promise.resolve(jr(JSON.parse(h(q).responseText)));
      }

      if (path === '/users' && method === 'POST') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        if (!body.username || !body.password) return Promise.resolve(jr({ error: '用户名和密码不能为空' }, 400));
        // 查重
        var dup = JSON.parse(h('/users?username=eq.' + encodeURIComponent(body.username) + '&select=id').responseText);
        if (dup && dup.length) return Promise.resolve(jr({ error: '用户名已存在' }, 400));
        var ins = h('/users', {
          method: 'POST',
          body: { username: body.username, password: body.password, role: body.role || 'user', status: 'active' },
          prefer: 'return=representation'
        });
        var newU = JSON.parse(ins.responseText);
        recordLog(user.username, 'create_user', 'user', newU[0] && newU[0].id, '新建用户：' + body.username + '（' + (body.role || 'user') + '）');
        return Promise.resolve(jr({ id: newU[0] && newU[0].id, message: '用户已创建' }, 201));
      }

      if ((m = path.match(/^\/users\/(\d+)$/)) && method === 'PATCH') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        var upd = {};
        var detail = '修改用户 #' + m[1];
        if (body.password) { upd.password = body.password; detail += ' 重置密码'; }
        if (body.role) { upd.role = body.role; detail += ' 角色改为 ' + body.role; }
        if (body.status) { upd.status = body.status; detail += ' 状态改为 ' + body.status; }
        if (body.username && body.username !== undefined) {
          // 校验用户名长度
          if (typeof body.username !== 'string' || body.username.length < 2 || body.username.length > 32) {
            return Promise.resolve(jr({ error: '用户名长度需 2-32 字符' }, 400));
          }
          // 校验是否重复
          var exist = JSON.parse(h('/users?username=eq.' + encodeURIComponent(body.username) + '&select=id').responseText);
          if (exist && exist.length > 0 && String(exist[0].id) !== String(m[1])) {
            return Promise.resolve(jr({ error: '用户名已存在' }, 400));
          }
          upd.username = body.username;
          detail += ' 用户名改为 ' + body.username;
        }
        h('/users?id=eq.' + m[1], { method: 'PATCH', body: upd });
        recordLog(user.username, 'update_user', 'user', m[1], detail);
        return Promise.resolve(jr({ message: '已更新' }));
      }

      if ((m = path.match(/^\/users\/(\d+)$/)) && method === 'DELETE') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        // 不允许删除自己
        if (parseInt(m[1]) === user.userId) {
          return Promise.resolve(jr({ error: '不能删除自己' }, 400));
        }
        // 查用户名用于日志
        var uInfo = JSON.parse(h('/users?id=eq.' + m[1] + '&select=username').responseText);
        h('/users?id=eq.' + m[1], { method: 'DELETE' });
        // 同步清理该用户的收藏
        h('/favorites?user_id=eq.' + m[1], { method: 'DELETE' });
        recordLog(user.username, 'delete_user', 'user', m[1], '删除用户：' + ((uInfo && uInfo[0] && uInfo[0].username) || m[1]));
        return Promise.resolve(jr({ message: '已删除' }));
      }

      // ===== 操作日志查询（仅 admin）=====
      if (path === '/logs' && method === 'GET') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        var q2 = '/activity_logs?order=id.desc&limit=200';
        var username = url.searchParams.get('username');
        var action = url.searchParams.get('action');
        if (username) q2 += '&username=eq.' + encodeURIComponent(username);
        if (action) q2 += '&action=eq.' + encodeURIComponent(action);
        return Promise.resolve(jr(JSON.parse(h(q2).responseText)));
      }

      return Promise.resolve(jr({ error: 'Not Found' }, 404));
    } catch (err) {
      return Promise.resolve(jr({ error: String(err) }, 500));
    }
  };
})();