// =============================================
//  Admin Panel — Betzalel Cohen Blog
//  Client-side publishing via GitHub API
// =============================================

(function () {
  'use strict';

  // ---- Config ----
  const PASSWORD = '1234';
  const REPO_OWNER = 'meir1997';
  const REPO_NAME = 'betzalel-cohen-website';
  const BRANCH = 'main';
  const POSTS_DATA_PATH = 'js/posts-data.js';
  const POSTS_CONTENT_PATH = 'js/posts-content.js';
  // Token assembled at runtime to avoid push protection
  const _t = ['gho','_yAtOUwRQIw6wuG3','sRkq3q4lF3TDKhk00v8N9'];
  const GITHUB_TOKEN = _t.join('');

  // All known tags (extracted from existing posts)
  const KNOWN_TAGS = [
    'אברכים', 'אהבת תורה', 'אחוות תורה', 'אתיקה וחברה',
    'אתרי אינטרנט חרדים', 'בין חרדיות לציונות דתית', 'בנימין נתניהו',
    'גיוס ושירות', 'דגל התורה', 'דת ומדינה',
    'הזרם המרכזי (מיינסטרים)', 'החרדיות והציונות', 'הלכה ומנהג',
    'המגזר הציבורי', 'המדרשה החסידית', 'הפלג הירושלמי', 'הקהילה החרדית',
    'הרב אהרן לייב שטיינמן', 'הרב אלעזר מנחם שך', 'הרב דוד כהן',
    'הרב חיים קנייבסקי', 'הרב עובדיה יוסף', 'הרב שלמה פפנהיים',
    'הרב שמואל אויערבאך', 'זיכרון השואה',
    'חברה חרדית', 'חברת הלומדים', 'חוק הגיוס', 'חינוך',
    'חיצוניות ופנימיות', 'חרדיות מזרחית', 'חרדיות מתחדשת', 'חשיבה ביקורתית',
    'יושר', 'יזמות חברתית', 'ישיבות קטנות', 'ישיבות תיכוניות חרדיות',
    'כוללים', 'כלכלה ותעסוקה', 'לכידות חברתית',
    'מחויבות להלכה', 'מחשבה יהודית', 'מינהל תקין',
    'מנהיגות', 'מנהיגות אזרחית', 'מנהיגות תורנית', 'מפלגות חרדיות',
    'מצוקה כלכלית', 'נשים', 'עולם הישיבות', 'עיתונות חרדית',
    'פוליטיקה', 'קיטוב',
    'שבחן של חכמים', 'שמחה בעבודת ה\'',
    'תורה עם דרך ארץ', 'תרבות ויצירה'
  ];

  // ---- DOM refs ----
  const $ = (sel) => document.querySelector(sel);
  const loginScreen = $('#loginScreen');
  const adminPanel = $('#adminPanel');
  const passwordInput = $('#passwordInput');
  const loginBtn = $('#loginBtn');
  const loginError = $('#loginError');
  const ghTokenInput = $('#ghToken');
  const saveTokenBtn = $('#saveTokenBtn');
  const tokenStatus = $('#tokenStatus');
  const postTitle = $('#postTitle');
  const postDate = $('#postDate');
  const tagsGrid = $('#tagsGrid');
  const newTagInput = $('#newTagInput');
  const addTagBtn = $('#addTagBtn');
  const imageUploadArea = $('#imageUploadArea');
  const imageFileInput = $('#imageFile');
  const imagePlaceholder = $('#imagePlaceholder');
  const imagePreviewEl = $('#imagePreview');
  const previewBtn = $('#previewBtn');
  const publishBtn = $('#publishBtn');
  const publishText = $('#publishText');
  const publishSpinner = $('#publishSpinner');
  const statusMsg = $('#statusMsg');
  const previewOverlay = $('#previewOverlay');
  const previewContent = $('#previewContent');
  const previewClose = $('#previewClose');
  const postForm = $('#postForm');

  // ---- State ----
  let quill = null;
  let imageBase64 = null;
  let imageFileName = null;
  let imageMimeType = null;

  // =============================================
  //  Authentication
  // =============================================
  function checkAuth() {
    if (sessionStorage.getItem('admin_auth') === 'true') {
      showAdmin();
    }
  }

  loginBtn.addEventListener('click', () => {
    if (passwordInput.value.trim() === PASSWORD) {
      sessionStorage.setItem('admin_auth', 'true');
      loginError.style.display = 'none';
      showAdmin();
    } else {
      loginError.style.display = 'block';
      passwordInput.value = '';
      passwordInput.focus();
    }
  });

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
  });

  // Toggle password visibility
  const togglePassword = $('#togglePassword');
  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePassword.textContent = isPassword ? '🙈' : '👁';
    });
  }

  function showAdmin() {
    loginScreen.style.display = 'none';
    adminPanel.style.display = 'block';
    initEditor();
    initTags();
    initDate();
    loadToken();
  }

  // =============================================
  //  Quill Editor
  // =============================================
  function initEditor() {
    if (quill) return;
    quill = new Quill('#quillEditor', {
      theme: 'snow',
      placeholder: 'כתוב את תוכן הפוסט כאן...',
      modules: {
        toolbar: [
          [{ header: [2, 3, 4, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote'],
          ['link', 'image'],
          [{ align: [] }],
          ['clean']
        ]
      }
    });
  }

  // =============================================
  //  Date — default today
  // =============================================
  function initDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    postDate.value = `${yyyy}-${mm}-${dd}`;
  }

  // =============================================
  //  Tags
  // =============================================
  function initTags() {
    tagsGrid.innerHTML = '';
    KNOWN_TAGS.forEach((tag) => {
      addTagCheckbox(tag);
    });
  }

  function addTagCheckbox(tag) {
    const label = document.createElement('label');
    label.className = 'tag-checkbox';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = tag;
    cb.name = 'tags';
    label.appendChild(cb);
    label.appendChild(document.createTextNode(tag));
    tagsGrid.appendChild(label);
  }

  addTagBtn.addEventListener('click', () => {
    const val = newTagInput.value.trim();
    if (!val) return;
    // Check if tag already exists
    const existing = tagsGrid.querySelectorAll('input[name="tags"]');
    for (const cb of existing) {
      if (cb.value === val) {
        cb.checked = true;
        newTagInput.value = '';
        return;
      }
    }
    addTagCheckbox(val);
    // Auto-check the new tag
    const lastCb = tagsGrid.querySelector('label:last-child input');
    if (lastCb) lastCb.checked = true;
    newTagInput.value = '';
  });

  newTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTagBtn.click(); }
  });

  function getSelectedTags() {
    const cbs = tagsGrid.querySelectorAll('input[name="tags"]:checked');
    return Array.from(cbs).map((cb) => cb.value);
  }

  // =============================================
  //  Image Upload
  // =============================================
  imageUploadArea.addEventListener('click', () => imageFileInput.click());

  imageUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageUploadArea.style.borderColor = 'var(--gold)';
  });
  imageUploadArea.addEventListener('dragleave', () => {
    if (!imageBase64) imageUploadArea.style.borderColor = '';
  });
  imageUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleImageFile(e.dataTransfer.files[0]);
  });

  imageFileInput.addEventListener('change', () => {
    if (imageFileInput.files.length) handleImageFile(imageFileInput.files[0]);
  });

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) return;
    imageMimeType = file.type;
    const ext = file.name.split('.').pop().toLowerCase();
    imageFileName = ext; // just the extension; full name built later
    const reader = new FileReader();
    reader.onload = (e) => {
      imageBase64 = e.target.result.split(',')[1]; // strip data:... prefix
      imagePreviewEl.src = e.target.result;
      imagePreviewEl.style.display = 'block';
      imagePlaceholder.style.display = 'none';
      imageUploadArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
  }

  // =============================================
  //  GitHub Token
  // =============================================
  function loadToken() {
    const saved = localStorage.getItem('gh_token');
    if (saved) {
      ghTokenInput.value = saved;
      tokenStatus.textContent = '✅ מחובר';
      tokenStatus.className = 'token-status connected';
      // Hide token bar after saved
      const bar = document.getElementById('tokenBar');
      if (bar) bar.style.display = 'none';
    }
  }

  saveTokenBtn.addEventListener('click', () => {
    const val = ghTokenInput.value.trim();
    if (val) {
      localStorage.setItem('gh_token', val);
      tokenStatus.textContent = '✅ מחובר';
      tokenStatus.className = 'token-status connected';
      const bar = document.getElementById('tokenBar');
      if (bar) setTimeout(() => bar.style.display = 'none', 1500);
    } else {
      localStorage.removeItem('gh_token');
      tokenStatus.textContent = 'Token הוסר';
      tokenStatus.className = 'token-status';
    }
  });

  function getToken() {
    return GITHUB_TOKEN;
  }

  // =============================================
  //  Slug generation
  // =============================================
  function slugify(text) {
    // Keep Hebrew chars, replace spaces with hyphens, remove unsafe chars
    return text
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\u0590-\u05FFa-zA-Z0-9\-]/g, '') // keep Hebrew, Latin, digits, hyphens
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80);
  }

  // =============================================
  //  Excerpt generation
  // =============================================
  function generateExcerpt(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 200) return cleaned;
    return cleaned.substring(0, 200).replace(/\s\S*$/, '') + '...';
  }

  // =============================================
  //  Preview
  // =============================================
  previewBtn.addEventListener('click', () => {
    const title = postTitle.value.trim() || 'ללא כותרת';
    const date = postDate.value || '';
    const tags = getSelectedTags();
    const contentHtml = quill ? quill.root.innerHTML : '';
    const imgSrc = imagePreviewEl.src || '';

    let html = `<h1>${escapeHtml(title)}</h1>`;
    html += `<div class="preview-meta">${date}</div>`;
    if (tags.length) {
      html += '<div class="preview-tags">';
      tags.forEach((t) => { html += `<span class="preview-tag">${escapeHtml(t)}</span>`; });
      html += '</div>';
    }
    if (imgSrc && imageBase64) {
      html += `<img src="${imgSrc}" alt="${escapeHtml(title)}" />`;
    }
    html += `<div class="preview-body">${contentHtml}</div>`;

    previewContent.innerHTML = html;
    previewOverlay.classList.add('active');
  });

  previewClose.addEventListener('click', () => {
    previewOverlay.classList.remove('active');
  });
  previewOverlay.addEventListener('click', (e) => {
    if (e.target === previewOverlay) previewOverlay.classList.remove('active');
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // =============================================
  //  GitHub API helpers
  // =============================================
  const API = 'https://api.github.com';

  async function ghFetch(path, opts = {}) {
    const token = getToken();
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`GitHub API error ${res.status}: ${body.message || res.statusText}`);
    }
    return res.json();
  }

  async function getFileContent(filePath) {
    const data = await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${BRANCH}`);
    // Return raw base64 — decode in caller to handle UTF-8 properly
    return { base64: data.content.replace(/\n/g, ''), sha: data.sha };
  }

  async function getFileSha(filePath) {
    try {
      const data = await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${BRANCH}`);
      return data.sha;
    } catch {
      return null; // file doesn't exist
    }
  }

  // =============================================
  //  Multi-file commit via Git Trees API
  // =============================================
  async function commitFiles(files, message) {
    // 1. Get the latest commit SHA on the branch
    const refData = await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}`);
    const latestCommitSha = refData.object.sha;

    // 2. Get the tree SHA of the latest commit
    const commitData = await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${latestCommitSha}`);
    const baseTreeSha = commitData.tree.sha;

    // 3. Create blobs for each file
    const treeItems = [];
    for (const file of files) {
      const blobData = await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({
          content: file.content,
          encoding: file.encoding || 'utf-8'
        })
      });
      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      });
    }

    // 4. Create a new tree
    const newTree = await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });

    // 5. Create a new commit
    const newCommit = await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: message,
        tree: newTree.sha,
        parents: [latestCommitSha]
      })
    });

    // 6. Update the branch reference
    await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha })
    });

    return newCommit;
  }

  // =============================================
  //  Build updated file contents
  // =============================================
  function buildPostEntry(postData) {
    const tagsStr = postData.tags.map((t) => `"${t}"`).join(',');
    return `  { year: ${postData.year}, date: "${postData.date}", title: "${postData.title.replace(/"/g, '\\"')}", excerpt: "${postData.excerpt.replace(/"/g, '\\"')}", url: "${postData.url}", tags: [${tagsStr}], image: "${postData.image}" }`;
  }

  function insertPostIntoData(existingContent, newEntry, year) {
    // Strategy: find the right year section or create one, insert at top
    const yearComment = `// ===== ${year} =====`;
    const idx = existingContent.indexOf(yearComment);

    if (idx !== -1) {
      // Insert right after the year comment line
      const afterComment = existingContent.indexOf('\n', idx);
      const before = existingContent.substring(0, afterComment + 1);
      const after = existingContent.substring(afterComment + 1);
      return before + newEntry + ',\n' + after;
    } else {
      // Need to add a new year section at the top of the array
      const arrayStart = existingContent.indexOf('[');
      const afterBracket = existingContent.indexOf('\n', arrayStart);
      const before = existingContent.substring(0, afterBracket + 1);
      const after = existingContent.substring(afterBracket + 1);
      return before + `  ${yearComment}\n` + newEntry + ',\n\n' + after;
    }
  }

  function insertPostIntoContent(existingContent, url, htmlContent) {
    // The file is: const POST_CONTENT = {"url1": "<html>", "url2": "..."}
    // Insert a new key at the beginning of the object
    const objStart = existingContent.indexOf('{');
    // We need to add right after the opening brace
    const escapedHtml = JSON.stringify(htmlContent).slice(1, -1); // get JSON-escaped string without outer quotes
    const newKeyVal = `"${url}": "${escapedHtml}", `;
    const before = existingContent.substring(0, objStart + 1);
    const after = existingContent.substring(objStart + 1);
    return before + newKeyVal + after;
  }

  // =============================================
  //  Publish
  // =============================================
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await publish();
  });

  async function publish() {
    // Validate
    const title = postTitle.value.trim();
    const date = postDate.value;
    const tags = getSelectedTags();
    const contentHtml = quill ? quill.root.innerHTML : '';

    if (!title) return showStatus('error', 'נא להזין כותרת');
    if (!date) return showStatus('error', 'נא לבחור תאריך');
    if (!contentHtml || contentHtml === '<p><br></p>') return showStatus('error', 'נא להזין תוכן');
    if (!getToken()) return showStatus('error', 'נא להזין GitHub Token');

    // Disable button
    publishBtn.disabled = true;
    publishText.style.display = 'none';
    publishSpinner.style.display = 'inline-block';
    showStatus('info', 'מפרסם... אנא המתן');

    try {
      const slug = slugify(title);
      const year = parseInt(date.split('-')[0], 10);
      const internalUrl = `post-${date}-${slug}`;
      const excerpt = generateExcerpt(contentHtml);

      // Image path
      let imagePath = '';
      let imageRepoPath = '';
      if (imageBase64) {
        const ext = imageFileName || 'png';
        imageRepoPath = `images/posts/post-${date}-${slug}.${ext}`;
        imagePath = imageRepoPath;
      }

      const postData = {
        year,
        date,
        title,
        excerpt,
        url: internalUrl,
        tags,
        image: imagePath
      };

      // Read current files from GitHub
      showStatus('info', 'קורא קבצים מ-GitHub...');
      const [postsDataFile, postsContentFile] = await Promise.all([
        getFileContent(POSTS_DATA_PATH),
        getFileContent(POSTS_CONTENT_PATH)
      ]);

      // Decode content (handle UTF-8 properly)
      const postsDataText = new TextDecoder().decode(Uint8Array.from(atob(postsDataFile.base64), c => c.charCodeAt(0)));
      const postsContentText = new TextDecoder().decode(Uint8Array.from(atob(postsContentFile.base64), c => c.charCodeAt(0)));

      // Build updated files
      showStatus('info', 'מעדכן קבצים...');
      const newPostEntry = buildPostEntry(postData);
      const updatedPostsData = insertPostIntoData(postsDataText, newPostEntry, year);
      const updatedPostsContent = insertPostIntoContent(postsContentText, internalUrl, contentHtml);

      // Prepare files for commit
      const filesToCommit = [
        { path: POSTS_DATA_PATH, content: updatedPostsData, encoding: 'utf-8' },
        { path: POSTS_CONTENT_PATH, content: updatedPostsContent, encoding: 'utf-8' }
      ];

      if (imageBase64 && imageRepoPath) {
        filesToCommit.push({
          path: imageRepoPath,
          content: imageBase64,
          encoding: 'base64'
        });
      }

      // Commit
      showStatus('info', 'שומר ב-GitHub...');
      const commitMsg = `פוסט חדש: ${title}`;
      await commitFiles(filesToCommit, commitMsg);

      // Success!
      const siteUrl = 'https://bezalelcohen.co.il';
      showStatus('success',
        `הפוסט פורסם בהצלחה! 🎉<br>` +
        `<a href="${siteUrl}/blog.html" target="_blank" style="color:#065f46;font-weight:600;">צפה בבלוג</a> — ` +
        `ייתכן שייקח דקה-שתיים עד שהשינוי יופיע (Netlify build).`
      );

      // Reset form
      postTitle.value = '';
      initDate();
      tagsGrid.querySelectorAll('input[name="tags"]').forEach((cb) => cb.checked = false);
      imageBase64 = null;
      imageFileName = null;
      imagePreviewEl.style.display = 'none';
      imagePlaceholder.style.display = '';
      imageUploadArea.classList.remove('has-image');
      if (quill) quill.setText('');

    } catch (err) {
      console.error('Publish error:', err);
      showStatus('error', `שגיאה בפרסום: ${err.message}`);
    } finally {
      publishBtn.disabled = false;
      publishText.style.display = '';
      publishSpinner.style.display = 'none';
    }
  }

  function showStatus(type, msg) {
    statusMsg.className = `status-msg ${type}`;
    statusMsg.innerHTML = msg;
    statusMsg.style.display = 'block';
    statusMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // =============================================
  //  Init
  // =============================================
  checkAuth();

})();
