// API Shim - rewrite fetch to call Supabase REST directly
(function() {
  var SUPABASE_URL = 'https://esfuzcizqjamcegmddok.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZnV6Y2l6cWphbWNlZ21kZG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyOTU1NzQsImV4cCI6MjEwMjg3MTU3NH0.ccCTSySdvcBM6KTR1xo7GB8l4DgJFzGlJNVCp0xTf9Y';

  function getAuth() {
    var token = localStorage.getItem('token');
    if (!token) return null;
    try { return JSON.parse(atob(token)); } catch (e) { return null; }
  }

  function supa(path, options) {
    options = options || {};
    var url = SUPABASE_URL + '/rest/v1' + path;
    var headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json'
    };
    if (options.prefer) headers['Prefer'] = options.prefer;
    return fetch(url, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  }

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  var originalFetch = window.fetch.bind(window);

  window.fetch = function(input, init) {
    var url;
    if (typeof input === 'string') {
      url = new URL(input, location.origin);
    } else if (input instanceof Request) {
      url = new URL(input.url, location.origin);
    } else if (input instanceof URL) {
      url = input;
    } else {
      return originalFetch(input, init);
    }

    if (url.origin !== location.origin || url.pathname.indexOf('/api/') !== 0) {
      return originalFetch(input, init);
    }

    var path = url.pathname.replace('/api', '');
    var method = (init && init.method) || (input.method) || 'GET';
    var body;
    if (init && init.body) {
      try { body = JSON.parse(init.body); } catch (e) { body = init.body; }
    } else if (input instanceof Request && input.body) {
      try { body = JSON.parse(input.body); } catch (e) {}
    }

    var user = getAuth();
    var self = this;

    return new Promise(function(resolve) {
      handleApi(path, method, body, url, user).then(resolve);
    });
  };

  function handleApi(path, method, body, url, user) {
    return new Promise(function(resolve) {
      try {
        if (path === '/login' && method === 'POST') {
          supa('/users?username=eq.' + encodeURIComponent(body.username) + '&password=eq.' + encodeURIComponent(body.password) + '&select=id,username,role,password')
            .then(function(r) { return r.json(); })
            .then(function(users) {
              if (!users || users.length === 0) {
                resolve(jsonResponse({ error: '用户名或密码错误' }, 401));
                return;
              }
              var u = users[0];
              var token = btoa(JSON.stringify({ userId: u.id, username: u.username, role: u.role }));
              resolve(jsonResponse({ token: token, user: { id: u.id, username: u.username, role: u.role } }));
            });
          return;
        }

        if (path === '/articles' && method === 'GET') {
          var q = '/articles?order=created_at.desc';
          var cat = url.searchParams.get('category');
          if (cat) q += '&category=eq.' + encodeURIComponent(cat);
          supa(q)
            .then(function(r) { return r.json(); })
            .then(function(data) {
              var search = url.searchParams.get('search');
              if (search) {
                var s = search.toLowerCase();
                data = data.filter(function(a) {
                  return (a.title || '').toLowerCase().indexOf(s) !== -1 ||
                    (a.content || '').toLowerCase().indexOf(s) !== -1;
                });
              }
              resolve(jsonResponse(data));
            });
          return;
        }

        var m;
        if ((m = path.match(/^\/articles\/(\d+)$/)) && method === 'GET') {
          supa('/articles?id=eq.' + m[1] + '&select=*')
            .then(function(r) { return r.json(); })
            .then(function(arr) {
              if (!arr || arr.length === 0) {
                resolve(jsonResponse({ error: 'not found' }, 404));
                return;
              }
              var a = arr[0];
              supa('/articles?id=eq.' + m[1], { method: 'PATCH', body: { views: (a.views || 0) + 1 } });
              resolve(jsonResponse(Object.assign({}, a, { views: (a.views || 0) + 1 })));
            });
          return;
        }

        if (path === '/articles' && method === 'POST') {
          if (!user) { resolve(jsonResponse({ error: 'unauthorized' }, 401)); return; }
          if (user.role !== 'admin') { resolve(jsonResponse({ error: 'forbidden' }, 403)); return; }
          supa('/articles', {
            method: 'POST',
            body: { title: body.title, content: body.content, summary: body.summary || '', category: body.category, author: user.username, views: 0, created_at: new Date().toISOString().split('T')[0] },
            prefer: 'return=representation'
          })
            .then(function(r) { return r.json(); })
            .then(function(arr) {
              resolve(jsonResponse({ id: arr[0].id, message: 'created' }, 201));
            });
          return;
        }

        if ((m = path.match(/^\/articles\/(\d+)$/)) && method === 'PUT') {
          if (!user) { resolve(jsonResponse({ error: 'unauthorized' }, 401)); return; }
          if (user.role !== 'admin') { resolve(jsonResponse({ error: 'forbidden' }, 403)); return; }
          supa('/articles?id=eq.' + m[1], { method: 'PATCH', body: { title: body.title, content: body.content, summary: body.summary, category: body.category } })
            .then(function() { resolve(jsonResponse({ message: 'updated' })); });
          return;
        }

        if ((m = path.match(/^\/articles\/(\d+)$/)) && method === 'DELETE') {
          if (!user) { resolve(jsonResponse({ error: 'unauthorized' }, 401)); return; }
          if (user.role !== 'admin') { resolve(jsonResponse({ error: 'forbidden' }, 403)); return; }
          supa('/articles?id=eq.' + m[1], { method: 'DELETE' })
            .then(function() {
              return supa('/favorites?article_id=eq.' + m[1], { method: 'DELETE' });
            })
            .then(function() { resolve(jsonResponse({ message: 'deleted' })); });
          return;
        }

        if (path === '/categories' && method === 'GET') {
          supa('/categories?order=sort_order.asc')
            .then(function(r) { return r.json(); })
            .then(function(data) { resolve(jsonResponse(data)); });
          return;
        }

        if (path === '/favorites' && method === 'GET') {
          if (!user) { resolve(jsonResponse({ error: 'unauthorized' }, 401)); return; }
          supa('/favorites?user_id=eq.' + user.userId + '&select=article_id,created_at')
            .then(function(r) { return r.json(); })
            .then(function(favs) {
              if (!favs || favs.length === 0) { resolve(jsonResponse([])); return; }
              var ids = favs.map(function(f) { return f.article_id; }).join(',');
              supa('/articles?id=in.(' + ids + ')')
                .then(function(r) { return r.json(); })
                .then(function(articles) {
                  var result = articles.map(function(a) {
                    var fav = favs.find(function(f) { return f.article_id === a.id; });
                    return Object.assign({}, a, { favorite_at: fav && fav.created_at });
                  });
                  resolve(jsonResponse(result));
                });
            });
          return;
        }

        if ((m = path.match(/^\/favorites\/(\d+)$/)) && method === 'POST') {
          if (!user) { resolve(jsonResponse({ error: 'unauthorized' }, 401)); return; }
          supa('/favorites?user_id=eq.' + user.userId + '&article_id=eq.' + m[1] + '&select=id')
            .then(function(r) { return r.json(); })
            .then(function(exist) {
              if (exist && exist.length > 0) { resolve(jsonResponse({ error: 'already favorited' }, 400)); return; }
              supa('/favorites', { method: 'POST', body: { user_id: user.userId, article_id: parseInt(m[1]) } })
                .then(function() { resolve(jsonResponse({ message: 'favorited' })); });
            });
          return;
        }

        if ((m = path.match(/^\/favorites\/(\d+)$/)) && method === 'DELETE') {
          if (!user) { resolve(jsonResponse({ error: 'unauthorized' }, 401)); return; }
          supa('/favorites?user_id=eq.' + user.userId + '&article_id=eq.' + m[1], { method: 'DELETE' })
            .then(function() { resolve(jsonResponse({ message: 'unfavorited' })); });
          return;
        }

        if (path === '/discussions' && method === 'POST') {
          if (!user) { resolve(jsonResponse({ error: 'unauthorized' }, 401)); return; }
          supa('/discussions', {
            method: 'POST',
            body: { user_id: user.userId, username: user.username, content: body.content, reply: null, replied_by: null, replied_at: null, status: 'pending' }
          }).then(function() { resolve(jsonResponse({ message: 'submitted' })); });
          return;
        }

        if (path === '/discussions' && method === 'GET') {
          if (!user) { resolve(jsonResponse({ error: 'unauthorized' }, 401)); return; }
          if (user.role !== 'admin') { resolve(jsonResponse({ error: 'forbidden' }, 403)); return; }
          supa('/discussions?order=id.desc')
            .then(function(r) { return r.json(); })
            .then(function(data) { resolve(jsonResponse(data)); });
          return;
        }

        if ((m = path.match(/^\/discussions\/(\d+)\/reply$/)) && method === 'PUT') {
          if (!user) { resolve(jsonResponse({ error: 'unauthorized' }, 401)); return; }
          if (user.role !== 'admin') { resolve(jsonResponse({ error: 'forbidden' }, 403)); return; }
          supa('/discussions?id=eq.' + m[1], {
            method: 'PATCH',
            body: { reply: body.reply, replied_by: user.username, replied_at: new Date().toISOString(), status: 'replied' }
          }).then(function() { resolve(jsonResponse({ message: 'replied' })); });
          return;
        }

        if ((m = path.match(/^\/discussions\/(\d+)$/)) && method === 'DELETE') {
          if (!user) { resolve(jsonResponse({ error: 'unauthorized' }, 401)); return; }
          if (user.role !== 'admin') { resolve(jsonResponse({ error: 'forbidden' }, 403)); return; }
          supa('/discussions?id=eq.' + m[1], { method: 'DELETE' })
            .then(function() { resolve(jsonResponse({ message: 'deleted' })); });
          return;
        }

        resolve(jsonResponse({ error: 'Not Found' }, 404));
      } catch (err) {
        resolve(jsonResponse({ error: String(err) }, 500));
      }
    });
  }
})();