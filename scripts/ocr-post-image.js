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

const GEMINI_KEY = process.env.GEMINI_API_KEY;

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
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (res.statusCode >= 400) reject(new Error(JSON.stringify(json).substring(0, 500)));
          else resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function ocrImage(imageBuffer) {
  const base64 = imageBuffer.toString('base64');
  const prompt = `This is a scan of a Hebrew newspaper article from "Makor Rishon" (מקור ראשון) dated February 2, 2024, featuring an interview with Rabbi Betzalel Cohen about ultra-Orthodox (Haredi) military service.

Extract the FULL Hebrew text of the article with PERFECT accuracy. Include:
- The article's headline
- The subheading/deck
- The byline (journalist name)
- All paragraphs in order
- Q&A sections (if present) formatted as clear question/answer pairs

Preserve the logical paragraph structure. Use proper Hebrew punctuation (quotation marks ״ ׳, etc.).

Return the article as a single well-formatted text (use HTML: <h2> for headline, <h3> for subheading, <p> for paragraphs, <strong> for questions in interview format). NO markdown code fences, no extra commentary — just clean HTML.`;

  const response = await apiCall(
    `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: prompt }
        ]
      }]
    }
  );
  return response.candidates[0].content.parts[0].text;
}

async function main() {
  const imageUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjoiXtOlQzpkSgATYTxZfbSrKPdy1FEc-f-BBFy3gqoJVcxkmHM1FMzB-gw9uExpFO5WTQW_uqz94xXM11OgENeauDVetIdZPQWgOTijXPyHpdTdxLkWid_gHR1LwPvnrp8cWa3st7FablmLHiil1Enac8Xt0_VkqJXp4F68M-lxseXk2yUI2FQAagM4mA/s16000/%D7%A9%D7%99%D7%A0%D7%95%D7%99%20%D7%94%D7%90%D7%A7%D7%9C%D7%99%D7%9D%20-%20%D7%9E%D7%A7%D7%95%D7%A8%20%D7%A8%D7%90%D7%A9%D7%95%D7%9F.jpeg';

  console.log('📥 Downloading image...');
  const imageBuffer = await downloadImage(imageUrl);
  console.log(`  Size: ${(imageBuffer.length / 1024).toFixed(0)} KB`);

  console.log('🔍 Running OCR via Gemini vision...');
  const ocrText = await ocrImage(imageBuffer);

  const outFile = path.join(__dirname, '../data/ocr-2024-02-05.html');
  if (!fs.existsSync(path.dirname(outFile))) fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, ocrText, 'utf8');

  console.log(`✅ OCR saved to ${outFile}`);
  console.log(`   Length: ${ocrText.length} characters`);
  console.log('\n--- Preview (first 800 chars) ---');
  console.log(ocrText.substring(0, 800));
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
