const fs = require('fs');
const path = require('path');

const POSTS_FILE = path.join(__dirname, '../js/posts-data.js');
const IMAGES_DIR = path.join(__dirname, '../images/posts');

function slugify(text) {
  return text.substring(0, 60).replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function findImageFor(post) {
  const expected = `post-${post.date}-${slugify(post.title)}.png`;
  if (fs.existsSync(path.join(IMAGES_DIR, expected))) return expected;
  const files = fs.readdirSync(IMAGES_DIR);
  const byDate = files.find(f => f.startsWith(`post-${post.date}-`));
  return byDate || null;
}

const original = fs.readFileSync(POSTS_FILE, 'utf8');
const posts = eval(original.replace('const POSTS =', 'POSTS =').replace(/^\/\/.*$/gm, '') + '; POSTS');

let updated = original;
let count = 0;

for (const post of posts) {
  const imageFile = findImageFor(post);
  if (!imageFile) continue;
  const newImageUrl = `images/posts/${imageFile}`;

  // Find the entry by its unique "date: 'YYYY-MM-DD'" + same-object match
  // Each post entry is one line in the file.
  // Strategy: find all lines starting with "  { year:" and match by date
  const lines = updated.split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`date: "${post.date}"`) && lines[i].includes(`title:`)) {
      // Check title substring — escape quotes to match the file's escaped form
      const titleStart = post.title.substring(0, 15).replace(/"/g, '\\"');
      if (lines[i].includes(titleStart)) {
        // Replace image: "..." on this line
        const newLine = lines[i].replace(/image:\s*"[^"]*"/, `image: "${newImageUrl}"`);
        if (newLine !== lines[i]) {
          lines[i] = newLine;
          found = true;
          count++;
          console.log(`✅ ${post.title.substring(0, 50)}`);
          break;
        }
      }
    }
  }
  if (!found) {
    console.log(`⚠️  No match: ${post.title.substring(0, 50)}`);
  }
  updated = lines.join('\n');
}

fs.writeFileSync(POSTS_FILE, updated, 'utf8');
console.log(`\n📊 Updated ${count} post entries`);
