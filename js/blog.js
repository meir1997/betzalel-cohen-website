// ===== Blog Page Logic =====
const POSTS_PER_PAGE = 12;
let currentPage = 1;
let currentYear = 'all';
let searchQuery = '';
let filteredPosts = [];

document.addEventListener('DOMContentLoaded', () => {
  if (typeof POSTS === 'undefined') return;

  // Mobile nav
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('siteNav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }

  // Build year filter buttons
  const yearsSet = [...new Set(POSTS.map(p => p.year))].sort((a, b) => b - a);
  const filtersEl = document.getElementById('yearFilters');
  if (filtersEl) {
    filtersEl.innerHTML = `<button class="year-btn active" data-year="all">הכל</button>` +
      yearsSet.map(y => `<button class="year-btn" data-year="${y}">${y}</button>`).join('');

    filtersEl.addEventListener('click', e => {
      if (!e.target.classList.contains('year-btn')) return;
      filtersEl.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentYear = e.target.dataset.year;
      currentPage = 1;
      render();
    });
  }

  // Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        searchQuery = searchInput.value.trim();
        currentPage = 1;
        render();
      }, 250);
    });
  }

  render();
});

function getFiltered() {
  let posts = POSTS;
  if (currentYear !== 'all') {
    posts = posts.filter(p => String(p.year) === String(currentYear));
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    posts = posts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q)
    );
  }
  return posts;
}

function render() {
  filteredPosts = getFiltered();
  const total = filteredPosts.length;
  const totalPages = Math.ceil(total / POSTS_PER_PAGE);
  const start = (currentPage - 1) * POSTS_PER_PAGE;
  const pageItems = filteredPosts.slice(start, start + POSTS_PER_PAGE);

  // Count
  const countEl = document.getElementById('countNum');
  if (countEl) countEl.textContent = total;

  // Posts list
  const listEl = document.getElementById('blogPostsList');
  if (listEl) {
    if (pageItems.length === 0) {
      listEl.innerHTML = `
        <div class="no-results">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <h3>לא נמצאו מאמרים</h3>
          <p>נסה חיפוש אחר או סינון שנה אחרת</p>
        </div>`;
    } else {
      listEl.innerHTML = pageItems.map((p, i) => {
        const idx = POSTS.indexOf(p);
        return `
        <div class="post-list-card" style="animation-delay:${i * 0.05}s">
          <span class="post-list-date">${formatDate(p.date)}</span>
          <h3 class="post-list-title"><a href="post.html?id=${idx}">${p.title}</a></h3>
          <p class="post-list-excerpt">${p.excerpt}</p>
          <a href="post.html?id=${idx}" class="post-list-read">קרא עוד ←</a>
        </div>`;
      }).join('');
    }
  }

  // Pagination
  const pagEl = document.getElementById('pagination');
  if (pagEl) {
    if (totalPages <= 1) {
      pagEl.innerHTML = '';
      return;
    }
    let html = '';
    if (currentPage > 1) {
      html += `<button class="page-btn" data-page="${currentPage - 1}">→</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7 && i !== 1 && i !== totalPages && Math.abs(i - currentPage) > 1) {
        if (i === currentPage - 2 || i === currentPage + 2) html += `<span style="padding:0 6px; color:var(--gray-400)">...</span>`;
        continue;
      }
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    if (currentPage < totalPages) {
      html += `<button class="page-btn" data-page="${currentPage + 1}">←</button>`;
    }
    pagEl.innerHTML = html;
    pagEl.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page);
        render();
        window.scrollTo({ top: 300, behavior: 'smooth' });
      });
    });
  }
}

function formatDate(dateStr) {
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
