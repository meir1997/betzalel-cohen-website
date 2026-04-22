const https = require('https');
const fs = require('fs');
const path = require('path');

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

const API_KEY = process.env.ANTHROPIC_API_KEY;

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function callClaude(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      method: 'POST',
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': API_KEY,
        'content-length': Buffer.byteLength(data)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 400) reject(new Error(JSON.stringify(json).substring(0, 500)));
          else resolve(json);
        } catch (e) { reject(new Error(body.substring(0, 300))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function ocrWithClaude(imageBuffer) {
  const base64 = imageBuffer.toString('base64');
  const response = await callClaude({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
        },
        {
          type: 'text',
          text: `This is a Hebrew newspaper article scan from "Makor Rishon" (מקור ראשון), February 2, 2024 — an interview with Rabbi Betzalel Cohen about Haredi (ultra-Orthodox) military service.

Extract the COMPLETE Hebrew text of the article with high accuracy. The scan may be blurry in places — use context to reconstruct unclear words when possible, and use [...] for truly illegible parts.

Structure the output as clean HTML:
- <h2> for the main headline
- <h3> for subheadings or section titles
- <p> for each paragraph
- <p class="byline"> for journalist byline
- <p><strong>שאלה:</strong> ...</p> for interview questions
- Use proper Hebrew punctuation: ״ for double quotes around titles, ' for apostrophes in abbreviations

Return ONLY the clean HTML. No markdown code fences, no commentary. Just the article content.`
        }
      ]
    }]
  });
  return response.content[0].text;
}

async function main() {
  const imageUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjoiXtOlQzpkSgATYTxZfbSrKPdy1FEc-f-BBFy3gqoJVcxkmHM1FMzB-gw9uExpFO5WTQW_uqz94xXM11OgENeauDVetIdZPQWgOTijXPyHpdTdxLkWid_gHR1LwPvnrp8cWa3st7FablmLHiil1Enac8Xt0_VkqJXp4F68M-lxseXk2yUI2FQAagM4mA/s16000/%D7%A9%D7%99%D7%A0%D7%95%D7%99%20%D7%94%D7%90%D7%A7%D7%9C%D7%99%D7%9D%20-%20%D7%9E%D7%A7%D7%95%D7%A8%20%D7%A8%D7%90%D7%A9%D7%95%D7%9F.jpeg';

  console.log('📥 Downloading image...');
  const imageBuffer = await downloadImage(imageUrl);
  console.log(`  Size: ${(imageBuffer.length / 1024).toFixed(0)} KB`);

  console.log('🔍 OCR via Claude vision...');
  const ocrHtml = await ocrWithClaude(imageBuffer);

  const outFile = path.join(__dirname, '../data/ocr-2024-02-05-claude.html');
  fs.writeFileSync(outFile, ocrHtml, 'utf8');

  console.log(`✅ Saved: ${outFile}`);
  console.log(`   Length: ${ocrHtml.length} chars`);
  console.log('\n--- Preview ---');
  console.log(ocrHtml.substring(0, 1000));
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
