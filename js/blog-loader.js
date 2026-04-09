// Blogspot Feed Loader — fetches ALL posts from betochami.blogspot.com
// Merges them with existing POSTS/POST_CONTENT so the site shows the complete archive.

(function () {
  if (typeof POSTS === 'undefined') return;
  if (typeof POST_CONTENT === 'undefined') window.POST_CONTENT = {};

  var CACHE_KEY = 'betochami-feed-v2';
  var CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
  var BATCH_SIZE = 150;

  // Try cache first
  try {
    var cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp < CACHE_DURATION)) {
        mergeAndRender(parsed.posts || [], parsed.content || {});
        // Still refresh in background
        setTimeout(fetchFromFeed, 2000);
        return;
      }
    }
  } catch (e) {}

  fetchFromFeed();

  function fetchFromFeed() {
    loadAll([], 1).then(function (entries) {
      var parsed = parseEntries(entries);
      // Save to cache
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          posts: parsed.posts,
          content: parsed.content
        }));
      } catch (e) {
        // Quota exceeded - try to save just metadata
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            posts: parsed.posts,
            content: {}
          }));
        } catch (e2) {}
      }
      mergeAndRender(parsed.posts, parsed.content);
    }).catch(function (err) {
      console.log('[blog-loader] Fetch failed:', err);
    });
  }

  function loadAll(acc, startIndex) {
    var url = 'https://betochami.blogspot.com/feeds/posts/default?alt=json&max-results=' + BATCH_SIZE + '&start-index=' + startIndex;
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Feed HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      var entries = (data && data.feed && data.feed.entry) || [];
      var newAcc = acc.concat(entries);
      if (entries.length < BATCH_SIZE) return newAcc;
      return loadAll(newAcc, startIndex + BATCH_SIZE);
    });
  }

  function parseEntries(entries) {
    var posts = [];
    var content = {};
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var title = (e.title && e.title.$t) || '';
      var published = (e.published && e.published.$t) || '';
      var date = published.split('T')[0];
      var year = parseInt(date.split('-')[0], 10);

      // Find alternate link (the public post URL)
      var url = '';
      var links = e.link || [];
      for (var j = 0; j < links.length; j++) {
        if (links[j].rel === 'alternate' && links[j].href) {
          url = links[j].href;
          break;
        }
      }
      if (!url) continue;

      var html = (e.content && e.content.$t) || (e.summary && e.summary.$t) || '';

      // Build excerpt from plain text
      var plain = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      var excerpt = plain.substring(0, 220) + (plain.length > 220 ? '...' : '');

      // Extract first image URL for thumbnail
      var image = '';
      var imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) image = imgMatch[1];

      // Tags from categories
      var tags = [];
      var cats = e.category || [];
      for (var k = 0; k < cats.length; k++) {
        if (cats[k].term) tags.push(cats[k].term);
      }

      posts.push({
        year: year,
        date: date,
        title: title,
        excerpt: excerpt,
        url: url,
        tags: tags,
        image: image
      });
      content[url] = html;
    }
    return { posts: posts, content: content };
  }

  function mergeAndRender(newPosts, newContent) {
    // Merge content (add all feed content - overrides local if key matches)
    for (var url in newContent) {
      if (!POST_CONTENT[url]) {
        POST_CONTENT[url] = newContent[url];
      }
    }

    // Build maps of existing posts for dedup
    var existingByUrl = {};
    var existingByTitle = {};
    for (var i = 0; i < POSTS.length; i++) {
      existingByUrl[POSTS[i].url] = POSTS[i];
      if (POSTS[i].title) existingByTitle[normalize(POSTS[i].title)] = POSTS[i];
    }

    // For posts that exist in curated data, attach content from feed if the URL matches
    // For truly missing posts, add them from feed
    var added = 0;
    for (var n = 0; n < newPosts.length; n++) {
      var p = newPosts[n];
      if (existingByUrl[p.url]) {
        // Attach content to local POST_CONTENT under the local URL
        if (!POST_CONTENT[p.url] && newContent[p.url]) {
          POST_CONTENT[p.url] = newContent[p.url];
        }
        continue;
      }
      var tkey = normalize(p.title);
      if (existingByTitle[tkey]) {
        // Same title - attach content to existing post's URL
        var existing = existingByTitle[tkey];
        if (!POST_CONTENT[existing.url] && newContent[p.url]) {
          POST_CONTENT[existing.url] = newContent[p.url];
        }
        continue;
      }
      // New post - add it
      POSTS.push(p);
      added++;
    }

    // Sort POSTS by date descending
    POSTS.sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });

    // Rebuild filter buttons if on blog.html
    if (typeof rebuildFilters === 'function') {
      try { rebuildFilters(); } catch (e) {}
    }

    // Trigger re-render
    if (typeof render === 'function') {
      try { render(); } catch (e) {}
    }

    // On post.html, reload content for the initially-loaded post (stable reference)
    if (window.location.pathname.indexOf('post.html') !== -1) {
      if (window.__currentPost && typeof loadContent === 'function') {
        loadContent(window.__currentPost);
      }
    }

    // On homepage, re-run main.js featured-posts block if we added posts
    if (added > 0 && window.location.pathname.match(/\/(index\.html)?$/)) {
      var featuredEl = document.getElementById('featuredPosts');
      if (featuredEl && typeof renderHomePosts === 'function') {
        renderHomePosts();
      } else if (featuredEl) {
        // Trigger DOMContentLoaded-like refresh by calling main.js logic inline
        refreshHomeGrid();
      }
    }
  }

  function refreshHomeGrid() {
    var featuredEl = document.getElementById('featuredPosts');
    var recentEl = document.getElementById('recentPostsList');
    if (!featuredEl) return;

    var fmt = function (d) {
      var months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
      var dt = new Date(d);
      return dt.getDate() + ' ' + months[dt.getMonth()] + ' ' + dt.getFullYear();
    };

    var latest = POSTS.slice(0, 3);
    featuredEl.innerHTML = latest.map(function (p, i) {
      var idx = POSTS.indexOf(p);
      var imgHtml = p.image
        ? '<img src="' + p.image + '" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy">'
        : '<div class="post-card-image-placeholder">' + p.title.charAt(0) + '</div>';
      return '<div class="post-card" style="animation-delay:' + (i * 0.1) + 's">' +
        '<div class="post-card-image">' + imgHtml + '</div>' +
        '<div class="post-card-body">' +
        '<div class="post-meta"><span class="post-date">' + fmt(p.date) + '</span><span class="post-tag">' + p.year + '</span></div>' +
        '<h3 class="post-title"><a href="post.html?id=' + idx + '">' + p.title + '</a></h3>' +
        '<p class="post-excerpt">' + p.excerpt + '</p>' +
        '</div>' +
        '<div class="post-card-footer"><a href="post.html?id=' + idx + '" class="read-more">קרא עוד ←</a></div>' +
        '</div>';
    }).join('');

    if (recentEl) {
      var recent = POSTS.slice(3, 9);
      recentEl.innerHTML = recent.map(function (p, i) {
        var idx = POSTS.indexOf(p);
        return '<div class="post-list-card" style="animation-delay:' + (i * 0.08) + 's">' +
          '<span class="post-list-date">' + fmt(p.date) + '</span>' +
          '<h3 class="post-list-title"><a href="post.html?id=' + idx + '">' + p.title + '</a></h3>' +
          '<p class="post-list-excerpt">' + p.excerpt + '</p>' +
          '<a href="post.html?id=' + idx + '" class="post-list-read">קרא עוד ←</a>' +
          '</div>';
      }).join('');
    }
  }

  function normalize(s) {
    return (s || '').replace(/["'`\\]/g, '').replace(/\s+/g, ' ').trim();
  }
})();
