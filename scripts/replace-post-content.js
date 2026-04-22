const fs = require('fs');
const path = require('path');

const POSTS_CONTENT_FILE = path.join(__dirname, '../js/posts-content.js');
const NEW_HTML_FILE = path.join(__dirname, '../data/shinui-haaklim-full.html');
const POST_URL = 'https://betochami.blogspot.com/2024/02/blog-post.html';

const file = fs.readFileSync(POSTS_CONTENT_FILE, 'utf8');
const newHtml = fs.readFileSync(NEW_HTML_FILE, 'utf8');

// Escape the HTML for inclusion as a JSON string value
const escaped = JSON.stringify(newHtml); // produces "..." with escapes

// Find the entry "URL": "value",
// The value can contain escaped quotes. We'll use a state-aware finder.
const marker = `"${POST_URL}":`;
const idx = file.indexOf(marker);
if (idx === -1) {
  console.error('❌ Could not find URL entry');
  process.exit(1);
}

// Skip past the colon and any whitespace
let valueStart = idx + marker.length;
while (file[valueStart] === ' ' || file[valueStart] === '\t') valueStart++;
if (file[valueStart] !== '"') {
  console.error('❌ Expected quote at', valueStart, 'got', file.substring(valueStart, valueStart + 20));
  process.exit(1);
}

// Find end of string value (handle escaped quotes)
let end = valueStart + 1;
while (end < file.length) {
  if (file[end] === '\\') { end += 2; continue; }
  if (file[end] === '"') break;
  end++;
}
end++; // include closing quote

const before = file.substring(0, valueStart);
const after = file.substring(end);
const updated = before + escaped + after;

fs.writeFileSync(POSTS_CONTENT_FILE, updated, 'utf8');
console.log(`✅ Replaced content for ${POST_URL}`);
console.log(`   Old value range: ${valueStart}-${end}`);
console.log(`   New HTML length: ${newHtml.length} chars`);
