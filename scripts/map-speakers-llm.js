const https = require('https');
const fs = require('fs');
const path = require('path');

// Manual .env loader (dotenv had issues with this specific key format)
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

if (!API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const EPISODES_FILE = path.join(__dirname, '../episodes.json');
const TRANSCRIPTS_DIR = path.join(__dirname, '../transcripts');
const OVERRIDES_FILE = path.join(__dirname, 'speaker-overrides.json');

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });
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
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${json.error?.message || body}`));
          } else {
            resolve(json.content[0].text);
          }
        } catch (e) {
          reject(new Error(`Invalid response: ${body.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function buildSpeakerSamples(utterances, maxCharsPerSpeaker = 2500) {
  const samples = {};
  for (const u of utterances) {
    const existing = samples[u.speaker] || '';
    if (existing.length < maxCharsPerSpeaker) {
      samples[u.speaker] = existing + (existing ? ' // ' : '') + u.text;
    }
  }
  // Trim
  for (const k of Object.keys(samples)) {
    samples[k] = samples[k].substring(0, maxCharsPerSpeaker);
  }
  return samples;
}

async function identifySpeakersViaLLM(utterances, guestName, episodeTitle) {
  const samples = buildSpeakerSamples(utterances);
  const speakers = Object.keys(samples);

  // Sanitize guest name — replace ASCII quotes with Hebrew gershayim to avoid JSON issues
  const safeGuestName = (guestName || 'אורח').replace(/"/g, '״').replace(/'/g, '׳');

  const samplesBlock = speakers.map(s => `--- דובר ${s} ---\n${samples[s]}`).join('\n\n');

  const prompt = `זהו תמלול של פודקאסט בעברית בשם "חרדים למדינה — סיפור משותף" מבית המכון החרדי לדמוקרטיה.

ידוע לנו:
- מיכל גלבוע אטר — המנחה הראשית (חילונית-אזרחית, שואלת שאלות, פותחת את הפרק ב"שלום לכם")
- הרב בצלאל כהן — שותף-מנחה (חרדי, רב, מייסד ישיבת חכמי לב והמכון החרדי לדמוקרטיה, ראש בית המדרש אנשי חיל, כותב בלוג בתוך עמי)
- אורח: ${safeGuestName}${episodeTitle ? ` (נושא הפרק: ${episodeTitle.replace(/"/g, '').replace(/'/g, '')})` : ''}

התמלול מחלק את הדוברים לתוויות טכניות (A/B/C וכו'). קרא את הקטעים הבאים וזהה איזו תווית שייכת לכל אחד:

${samplesBlock}

החזר JSON תקין בלבד (ללא טקסט נוסף, ללא markdown code fences, ללא מרכאות בתוך השמות — אם יש מרכאות בשם השתמש בגרשיים עברי ״). מבנה:
{"A": "שם הדובר", "B": "שם הדובר", ...}

השתמש בדיוק בשמות:
- "מיכל גלבוע אטר"
- "הרב בצלאל כהן"
- "${safeGuestName}"`;

  const response = await callClaude(prompt);

  // Strip markdown code fences if present
  let cleaned = response.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Find the outermost JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON in response: ${response.substring(0, 300)}`);
  }
  const jsonStr = cleaned.substring(start, end + 1);
  let result;
  try {
    result = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Parse failed: ${e.message}\nRaw: ${jsonStr.substring(0, 300)}`);
  }

  // Validate: all values must be unique (each speaker is a distinct person)
  const values = Object.values(result);
  const uniqueValues = new Set(values);
  if (uniqueValues.size !== values.length) {
    throw new Error(`Duplicate speakers in result: ${JSON.stringify(result)}`);
  }

  return result;
}

async function main() {
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
  const episodesData = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf8'));
  const force = process.argv.includes('--force');

  for (const episode of episodesData.episodes) {
    const transcriptPath = path.join(TRANSCRIPTS_DIR, `episode-${episode.id}.json`);
    if (!fs.existsSync(transcriptPath)) continue;

    const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

    // Skip if already mapped (unless --force flag passed). Saves API costs on daily runs.
    if (!force && transcript.speakerMap && transcript.utterances[0]?.speakerName) {
      console.log(`⏭️  Episode ${episode.id}: already mapped, skipping`);
      continue;
    }

    const guestName = (episode.guest || '').replace(/^עם\s+/, '').trim();

    let speakerMap;
    if (overrides[String(episode.id)]) {
      console.log(`📌 Episode ${episode.id}: using manual override`);
      speakerMap = overrides[String(episode.id)];
    } else {
      try {
        console.log(`🤖 Episode ${episode.id}: asking Claude...`);
        speakerMap = await identifySpeakersViaLLM(transcript.utterances, guestName, episode.title);
      } catch (err) {
        console.error(`  ❌ LLM failed: ${err.message}`);
        continue;
      }
    }

    transcript.speakerMap = speakerMap;
    transcript.utterances = transcript.utterances.map(u => ({
      speaker: u.speaker,
      text: u.text,
      start: u.start,
      end: u.end,
      speakerName: speakerMap[u.speaker] || `דובר ${u.speaker}`
    }));

    fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2), 'utf8');
    console.log(`✅ Episode ${episode.id}: ${JSON.stringify(speakerMap)}`);
  }
}

main().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
