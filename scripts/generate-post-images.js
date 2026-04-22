const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env manually
try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const k = line.substring(0, eq).trim();
      const v = line.substring(eq + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
} catch (e) {}

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY not set');
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, '../images/posts');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

// Style aligned with site palette (--parchment, --navy-dark, --gold)
const STYLE_DIRECTIVE = `A single continuous line drawing, minimalist editorial illustration style.

Palette (strict):
- Background: warm parchment cream color (#f7f3ec), flat and uniform
- Primary line: deep navy (#0f2238), thin delicate strokes (1-2 pixels wide)
- Subtle accent: optional tiny touches of muted gold (#b7862a) on ONE small detail only — no more than 5% of the image

Composition:
- Single continuous or minimal line drawing style
- Sparse with plenty of negative space — subject takes up ~50% of frame, centered
- No color fills, no gradients, no shading, no hatching
- No text, no Hebrew letters, no English letters
- Clean, elegant, scholarly
- Style reference: modernist single-line art, Fran Meneses sketches, New Yorker spot illustrations

Aspect ratio: wide landscape (16:9)`;

function slugify(text) {
  return text.substring(0, 60).replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function apiCall(apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      method: 'POST',
      hostname: 'generativelanguage.googleapis.com',
      path: apiPath,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(responseBody);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json).substring(0, 400)}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Invalid JSON: ${responseBody.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getMetaphor(post) {
  const prompt = `You are an art director for an editorial blog about Haredi (Ultra-Orthodox Jewish) society, education, military service, and Israeli society. Design a single-line drawing cover image for this post:

Title: ${post.title}
Excerpt: ${post.excerpt || ''}
Tags: ${(post.tags || []).join(', ')}

Return ONE SENTENCE describing a symbolic subject for a minimalist continuous-line drawing. Avoid Hebrew text in the image. Prefer human silhouettes, hands, objects (books, candles, doors, bridges, paths), or nature (trees, mountains, birds) over abstract shapes. The subject should feel elegant and editorial.

Examples:
- "Two hands reaching toward each other with a delicate bridge forming between their fingers"
- "A silhouette of a person standing at an open doorway with light streaming through"
- "An open book transforming into a flight of birds"

Return ONLY the subject sentence in English, under 25 words, nothing else.`;

  const response = await apiCall(
    `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }] }
  );
  return response.candidates[0].content.parts[0].text.trim().replace(/^["']|["']$/g, '');
}

async function generateImage(metaphor) {
  const fullPrompt = `${STYLE_DIRECTIVE}\n\nSubject: ${metaphor}`;
  const response = await apiCall(
    `/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_KEY}`,
    { contents: [{ parts: [{ text: fullPrompt }] }] }
  );
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  throw new Error('No image returned');
}

async function processPost(post, index) {
  const filename = `post-${post.date}-${slugify(post.title)}.png`;
  const outPath = path.join(IMAGES_DIR, filename);

  if (fs.existsSync(outPath)) {
    console.log(`[${index}] ⏭️  Exists: ${filename}`);
    return { post, filename, status: 'skipped' };
  }

  console.log(`[${index}] 🎨 ${post.title.substring(0, 60)}`);
  try {
    const metaphor = await getMetaphor(post);
    console.log(`    💡 ${metaphor}`);
    const imageBuffer = await generateImage(metaphor);
    fs.writeFileSync(outPath, imageBuffer);
    console.log(`    💾 ${filename} (${(imageBuffer.length / 1024).toFixed(0)} KB)`);
    return { post, filename, metaphor, status: 'generated' };
  } catch (err) {
    console.error(`    ❌ ${err.message}`);
    return { post, filename, status: 'error', error: err.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;
  const offsetArg = args.find(a => a.startsWith('--offset='));
  const offset = offsetArg ? parseInt(offsetArg.split('=')[1], 10) : 0;

  const postsJs = fs.readFileSync(path.join(__dirname, '../js/posts-data.js'), 'utf8');
  const posts = eval(postsJs.replace('const POSTS =', 'POSTS =').replace(/^\/\/.*$/gm, '') + '; POSTS');

  const toProcess = posts.slice(offset, offset + limit);
  console.log(`📚 Processing ${toProcess.length} posts (offset=${offset}, limit=${limit})\n`);

  const results = [];
  for (let i = 0; i < toProcess.length; i++) {
    const result = await processPost(toProcess[i], offset + i + 1);
    results.push(result);
    if (i < toProcess.length - 1) await new Promise(r => setTimeout(r, 1200));
  }

  console.log('\n📊 Summary:');
  console.log(`  Generated: ${results.filter(r => r.status === 'generated').length}`);
  console.log(`  Skipped:   ${results.filter(r => r.status === 'skipped').length}`);
  console.log(`  Errors:    ${results.filter(r => r.status === 'error').length}`);
}

main().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
