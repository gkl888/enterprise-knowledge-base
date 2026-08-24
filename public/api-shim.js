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
      if (path === '/login' && method === 'POST') {
        var r = h('/users?username=eq.' + encodeURIComponent(body.username) + '&password=eq.' + encodeURIComponent(body.password) + '&select=id,username,role,password');
        var users = JSON.parse(r.responseText);
        if (!users || !users.length) return Promise.resolve(jr({ error: '用户名或密码错误' }, 401));
        var u = users[0];
        var token = btoa(JSON.stringify({ userId: u.id, username: u.username, role: u.role }));
        return Promise.resolve(jr({ token: token, user: { id: u.id, username: u.username, role: u.role } }));
      }

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
        return Promise.resolve(jr({ id: arr2[0].id, message: 'created' }, 201));
      }

      if ((m = path.match(/^\/articles\/(\d+)$/)) && method === 'PUT') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        h('/articles?id=eq.' + m[1], { method: 'PATCH', body: { title: body.title, content: body.content, summary: body.summary, category: body.category } });
        return Promise.resolve(jr({ message: 'updated' }));
      }

      if ((m = path.match(/^\/articles\/(\d+)$/)) && method === 'DELETE') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        h('/articles?id=eq.' + m[1], { method: 'DELETE' });
        h('/favorites?article_id=eq.' + m[1], { method: 'DELETE' });
        return Promise.resolve(jr({ message: 'deleted' }));
      }

      if (path === '/categories' && method === 'GET') {
        return Promise.resolve(jr(JSON.parse(h('/categories?order=sort_order.asc').responseText)));
      }

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
        return Promise.resolve(jr({ message: 'favorited' }));
      }

      if ((m = path.match(/^\/favorites\/(\d+)$/)) && method === 'DELETE') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        h('/favorites?user_id=eq.' + user.userId + '&article_id=eq.' + m[1], { method: 'DELETE' });
        return Promise.resolve(jr({ message: 'unfavorited' }));
      }

      if (path === '/discussions' && method === 'POST') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        h('/discussions', {
          method: 'POST',
          body: { user_id: user.userId, username: user.username, content: body.content, reply: null, replied_by: null, replied_at: null, status: 'pending' }
        });
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
        return Promise.resolve(jr({ message: 'replied' }));
      }

      if ((m = path.match(/^\/discussions\/(\d+)$/)) && method === 'DELETE') {
        if (!user) return Promise.resolve(jr({ error: 'unauthorized' }, 401));
        if (user.role !== 'admin') return Promise.resolve(jr({ error: 'forbidden' }, 403));
        h('/discussions?id=eq.' + m[1], { method: 'DELETE' });
        return Promise.resolve(jr({ message: 'deleted' }));
      }

      return Promise.resolve(jr({ error: 'Not Found' }, 404));
    } catch (err) {
      return Promise.resolve(jr({ error: String(err) }, 500));
    }
  };
})();