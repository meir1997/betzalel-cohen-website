const https = require('https');
const fs = require('fs');
const path = require('path');

// Load API key from .env or environment
require('dotenv').config?.({ path: path.join(__dirname, '../.env') });
const API_KEY = process.env.ASSEMBLYAI_API_KEY;

if (!API_KEY) {
  console.error('❌ ASSEMBLYAI_API_KEY not set in environment or .env');
  process.exit(1);
}

const EPISODES_FILE = path.join(__dirname, '../episodes.json');
const TRANSCRIPTS_DIR = path.join(__dirname, '../transcripts');

if (!fs.existsSync(TRANSCRIPTS_DIR)) {
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
}

function apiRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: 'api.assemblyai.com',
      path: endpoint,
      headers: {
        'authorization': API_KEY,
        'content-type': 'application/json',
      }
    };
    if (data) opts.headers['content-length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const responseText = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(responseText);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${json.error || responseText}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Invalid JSON: ${responseText.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function submitTranscript(audioUrl) {
  console.log(`  📤 Submitting transcription job...`);
  const res = await apiRequest('POST', '/v2/transcript', {
    audio_url: audioUrl,
    language_code: 'he',
    speaker_labels: true,
    speakers_expected: 3,
    speech_models: ['universal-2']
  });
  return res.id;
}

async function waitForCompletion(transcriptId, episodeId) {
  let attempts = 0;
  const maxAttempts = 180; // ~30 min max
  while (attempts < maxAttempts) {
    const res = await apiRequest('GET', `/v2/transcript/${transcriptId}`);
    if (res.status === 'completed') {
      console.log(`  ✅ Transcription complete for episode ${episodeId}`);
      return res;
    }
    if (res.status === 'error') {
      throw new Error(`Transcription failed: ${res.error}`);
    }
    attempts++;
    if (attempts % 6 === 0) {
      console.log(`  ⏳ Still processing episode ${episodeId}... (${attempts * 10}s elapsed, status: ${res.status})`);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error('Timed out waiting for transcription');
}

function simplifyTranscript(assemblyResponse) {
  const utterances = (assemblyResponse.utterances || []).map(u => ({
    speaker: u.speaker,
    text: u.text,
    start: u.start / 1000, // convert ms to seconds
    end: u.end / 1000
  }));

  return {
    language: assemblyResponse.language_code || 'he',
    audioDuration: assemblyResponse.audio_duration,
    fullText: assemblyResponse.text,
    utterances: utterances,
    speakerCount: new Set(utterances.map(u => u.speaker)).size,
    transcribedAt: new Date().toISOString()
  };
}

async function transcribeEpisode(episode) {
  const transcriptPath = path.join(TRANSCRIPTS_DIR, `episode-${episode.id}.json`);
  if (fs.existsSync(transcriptPath)) {
    console.log(`⏭️  Episode ${episode.id} already transcribed, skipping`);
    return;
  }

  if (!episode.audioUrl) {
    console.log(`⚠️  Episode ${episode.id} has no audio URL, skipping`);
    return;
  }

  console.log(`\n🎙️  Episode ${episode.id}: ${episode.title}`);
  try {
    const transcriptId = await submitTranscript(episode.audioUrl);
    const result = await waitForCompletion(transcriptId, episode.id);
    const simplified = simplifyTranscript(result);
    fs.writeFileSync(transcriptPath, JSON.stringify(simplified, null, 2), 'utf8');
    console.log(`  💾 Saved ${simplified.utterances.length} utterances, ${simplified.speakerCount} speakers`);
  } catch (error) {
    console.error(`  ❌ Failed: ${error.message}`);
  }
}

async function main() {
  const episodesData = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf8'));
  console.log(`📚 Found ${episodesData.episodes.length} episodes\n`);

  for (const episode of episodesData.episodes) {
    await transcribeEpisode(episode);
  }

  console.log('\n🎉 All done!');
}

main().catch(e => {
  console.error('❌ Fatal error:', e.message);
  process.exit(1);
});
