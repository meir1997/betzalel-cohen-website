// ===== Blog Page Logic =====
const POSTS_PER_PAGE = 12;
let currentPage = 1;
let currentYear = 'all';
let currentTag = 'all';
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

  // Build tag filter buttons
  const allTags = {};
  POSTS.forEach(p => {
    if (p.tags) p.tags.forEach(t => { allTags[t] = (allTags[t] || 0) + 1; });
  });
  const sortedTags = Object.entries(allTags).sort((a, b) => b[1] - a[1]);

  const tagFiltersEl = document.getElementById('tagFilters');
  if (tagFiltersEl) {
    tagFiltersEl.innerHTML =
      '<button class="year-btn active" data-tag="all" style="border-color:var(--gold);color:var(--navy);">הכל</button>' +
      sortedTags.map(([tag, count]) =>
        '<button class="year-btn" data-tag="' + tag + '" style="border-color:var(--gold);">' + tag + ' <span style="font-size:0.75rem;color:var(--gray-400);">(' + count + ')</span></button>'
      ).join('');

    tagFiltersEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-tag]');
      if (!btn) return;
      tagFiltersEl.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTag = btn.dataset.tag;
      currentPage = 1;
      render();
    });
  }

  // Build year filter buttons
  const yearsSet = [...new Set(POSTS.map(p => p.year))].sort((a, b) => b - a);
  const filtersEl = document.getElementById('yearFilters');
  if (filtersEl) {
    filtersEl.innerHTML = '<button class="year-btn active" data-year="all">כל השנים</button>' +
      yearsSet.map(y => '<button class="year-btn" data-year="' + y + '">' + y + '</button>').join('');

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

  // Handle ?tag= URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tagParam = urlParams.get('tag');
  if (tagParam && tagFiltersEl) {
    currentTag = tagParam;
    tagFiltersEl.querySelectorAll('.year-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tag === tagParam);
    });
  }

  render();
});

function getFiltered() {
  let posts = POSTS;
  if (currentYear !== 'all') {
    posts = posts.filter(p => String(p.year) === String(currentYear));
  }
  if (currentTag !== 'all') {
    posts = posts.filter(p => p.tags && p.tags.includes(currentTag));
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
          <p>נסה חיפוש אחר, תווית אחרת או שנה אחרת</p>
        </div>`;
    } else {
      listEl.innerHTML = pageItems.map((p, i) => {
        const idx = POSTS.indexOf(p);
        const thumbContent = p.image
          ? '<img src="' + p.image + '" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy">'
          : p.title.charAt(0);
        const thumbBg = p.image ? 'background:none;' : 'background:linear-gradient(135deg,#1a3557,#2c5282);';
        const tagsHtml = (p.tags || []).map(t =>
          '<span style="font-size:0.72rem;font-weight:600;color:var(--navy);background:rgba(26,53,87,0.08);padding:2px 8px;border-radius:100px;cursor:pointer;" onclick="filterByTag(\'' + t + '\')">' + t + '</span>'
        ).join(' ');
        return `
        <div class="post-list-card" style="animation-delay:${i * 0.05}s">
          <div style="height:140px;border-radius:8px;overflow:hidden;margin-bottom:12px;${thumbBg}display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.2);font-family:'Frank Ruhl Libre',serif;font-size:2.5rem;font-weight:900;">${thumbContent}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">${tagsHtml}</div>
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
      html += '<button class="page-btn" data-page="' + (currentPage - 1) + '">→</button>';
    }
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7 && i !== 1 && i !== totalPages && Math.abs(i - currentPage) > 1) {
        if (i === currentPage - 2 || i === currentPage + 2) html += '<span style="padding:0 6px; color:var(--gray-400)">...</span>';
        continue;
      }
      html += '<button class="page-btn ' + (i === currentPage ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    if (currentPage < totalPages) {
      html += '<button class="page-btn" data-page="' + (currentPage + 1) + '">←</button>';
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

// Global function for clicking tags on cards
function filterByTag(tag) {
  currentTag = tag;
  currentPage = 1;
  // Update tag buttons
  const tagFiltersEl = document.getElementById('tagFilters');
  if (tagFiltersEl) {
    tagFiltersEl.querySelectorAll('.year-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tag === tag);
    });
  }
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatDate(dateStr) {
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const d = new Date(dateStr);
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}
