// ===== Navigation Toggle (Mobile) =====
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('siteNav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }

  // === Homepage: Featured Posts (latest 3) ===
  const featuredEl = document.getElementById('featuredPosts');
  if (featuredEl && typeof POSTS !== 'undefined') {
    const latest = POSTS.slice(0, 3);
    featuredEl.innerHTML = latest.map((p, i) => {
      const idx = POSTS.indexOf(p);
      return `
      <div class="post-card" style="animation-delay:${i * 0.1}s">
        <div class="post-card-image" data-post-url="${p.url}">
          <div class="post-card-image-placeholder">${p.title.charAt(0)}</div>
        </div>
        <div class="post-card-body">
          <div class="post-meta">
            <span class="post-date">${formatDate(p.date)}</span>
            <span class="post-tag">${p.year}</span>
          </div>
          <h3 class="post-title"><a href="post.html?id=${idx}">${p.title}</a></h3>
          <p class="post-excerpt">${p.excerpt}</p>
        </div>
        <div class="post-card-footer">
          <a href="post.html?id=${idx}" class="read-more">קרא עוד ←</a>
        </div>
      </div>`;
    }).join('');

    // Load images for featured posts
    loadPostImages();
  }

  // === Homepage: Recent Posts List (next 6) ===
  const recentEl = document.getElementById('recentPostsList');
  if (recentEl && typeof POSTS !== 'undefined') {
    const recent = POSTS.slice(3, 9);
    recentEl.innerHTML = recent.map((p, i) => {
      const idx = POSTS.indexOf(p);
      return `
      <div class="post-list-card" style="animation-delay:${i * 0.08}s">
        <span class="post-list-date">${formatDate(p.date)}</span>
        <h3 class="post-list-title"><a href="post.html?id=${idx}">${p.title}</a></h3>
        <p class="post-list-excerpt">${p.excerpt}</p>
        <a href="post.html?id=${idx}" class="post-list-read">קרא עוד ←</a>
      </div>`;
    }).join('');
  }
});

// ===== Date Formatter =====
function formatDate(dateStr) {
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ===== Lazy Load Post Images =====
function loadPostImages() {
  const cards = document.querySelectorAll('.post-card-image[data-post-url]');
  cards.forEach(card => {
    const url = card.getAttribute('data-post-url');
    if (!url) return;
    fetchPostImage(url).then(imgUrl => {
      if (imgUrl) {
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.loading = 'lazy';
        const placeholder = card.querySelector('.post-card-image-placeholder');
        if (placeholder) placeholder.style.display = 'none';
        card.appendChild(img);
      }
    });
  });
}

async function fetchPostImage(postUrl) {
  const proxies = [
    'https://corsproxy.io/?' + encodeURIComponent(postUrl),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(postUrl)
  ];
  for (const proxyUrl of proxies) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const html = await response.text();
      // Find first content image (not header/logo)
      const match = html.match(/class="separator"[^>]*>.*?<img[^>]+src="(https:\/\/blogger\.googleusercontent\.com\/img\/[^"]+)"/s);
      if (match) return match[1];
      // Fallback: any blogger image
      const match2 = html.match(/<img[^>]+src="(https:\/\/blogger\.googleusercontent\.com\/img\/[^"]+)"/);
      if (match2) return match2[1];
      return null;
    } catch (e) { continue; }
  }
  return null;
}
