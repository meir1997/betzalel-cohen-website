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
    featuredEl.innerHTML = latest.map((p, i) => `
      <div class="post-card" style="animation-delay:${i * 0.1}s">
        <div class="post-card-image">
          <div class="post-card-image-placeholder">${p.title.charAt(0)}</div>
        </div>
        <div class="post-card-body">
          <div class="post-meta">
            <span class="post-date">${formatDate(p.date)}</span>
            <span class="post-tag">${p.year}</span>
          </div>
          <h3 class="post-title"><a href="${p.url}" target="_blank">${p.title}</a></h3>
          <p class="post-excerpt">${p.excerpt}</p>
        </div>
        <div class="post-card-footer">
          <a href="${p.url}" target="_blank" class="read-more">קרא עוד ←</a>
        </div>
      </div>
    `).join('');
  }

  // === Homepage: Recent Posts List (next 6) ===
  const recentEl = document.getElementById('recentPostsList');
  if (recentEl && typeof POSTS !== 'undefined') {
    const recent = POSTS.slice(3, 9);
    recentEl.innerHTML = recent.map((p, i) => `
      <div class="post-list-card" style="animation-delay:${i * 0.08}s">
        <span class="post-list-date">${formatDate(p.date)}</span>
        <h3 class="post-list-title"><a href="${p.url}" target="_blank">${p.title}</a></h3>
        <p class="post-list-excerpt">${p.excerpt}</p>
        <a href="${p.url}" target="_blank" class="post-list-read">קרא עוד ←</a>
      </div>
    `).join('');
  }
});

// ===== Date Formatter =====
function formatDate(dateStr) {
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
