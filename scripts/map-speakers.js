const fs = require('fs');
const path = require('path');

const EPISODES_FILE = path.join(__dirname, '../episodes.json');
const TRANSCRIPTS_DIR = path.join(__dirname, '../transcripts');
const OVERRIDES_FILE = path.join(__dirname, 'speaker-overrides.json');

// Keywords that strongly indicate Betzalel speaking (institutions he founded, roles, self-references)
const BETZALEL_KEYWORDS = [
  'חכמי לב',
  'חכמי-לב',
  'המכון החרדי לדמוקרטיה',
  'מכון חרדי לדמוקרטיה',
  'אנשי חיל',
  'בתוך עמי',
  'ישיבת חכמי',
  'הישיבה שלי',
  'כשהייתי ראש ישיבה',
  'כשייסדתי',
  'ייסדתי את',
  'הקמתי את',
  'בספר שלי',
  'כשאני מסתכל כחרדי',
  'אני חרדי',
  'אני כחרדי',
  'בתור רב',
  'בתור איש תורה',
  'בית המדרש שלי'
];

// Patterns that indicate Michal speaking (host/interviewer)
const MICHAL_PATTERNS = [
  'אני מיכל',
  'מיכל גלבוע',
  'אני גלבוע',
  'שלום לכם',
  'ברוכים הבאים',
  'ברוכות הבאות'
];

// Patterns that indicate the guest speaking
const GUEST_PATTERNS = [
  'כיף להתארח',
  'תודה שהזמנתם',
  'תודה שהזמנת',
  'שמח להיות כאן',
  'שמחה להיות כאן',
  'תודה רבה על ההזמנה'
];

function countMatches(text, patterns) {
  let count = 0;
  for (const p of patterns) {
    const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = text.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

function identifySpeakers(utterances, guestName, episodeId, overrides) {
  // 1. Check manual overrides first
  if (overrides[String(episodeId)]) {
    console.log(`  📌 Using manual override for episode ${episodeId}`);
    return overrides[String(episodeId)];
  }

  // Build per-speaker text aggregates
  const speakerText = {};
  const speakerCount = {};
  for (const u of utterances) {
    speakerText[u.speaker] = (speakerText[u.speaker] || '') + ' ' + u.text;
    speakerCount[u.speaker] = (speakerCount[u.speaker] || 0) + 1;
  }

  const allSpeakers = Object.keys(speakerText);
  const speakerMap = {};

  // 2. Score each speaker for Michal, Betzalel, Guest affinity
  const scores = {};
  for (const s of allSpeakers) {
    scores[s] = {
      michal: countMatches(speakerText[s], MICHAL_PATTERNS),
      betzalel: countMatches(speakerText[s], BETZALEL_KEYWORDS),
      guest: countMatches(speakerText[s], GUEST_PATTERNS),
      count: speakerCount[s]
    };
  }

  // 3. Identify Michal FIRST - her self-intro "אני מיכל" is unambiguous
  const byMichalScore = [...allSpeakers].sort((a, b) => scores[b].michal - scores[a].michal);
  if (byMichalScore[0] && scores[byMichalScore[0]].michal >= 1) {
    speakerMap[byMichalScore[0]] = 'מיכל גלבוע אטר';
  }

  // 4. Identify Betzalel - highest Betzalel keyword score among remaining speakers (>= 2 keywords)
  const byBetzalelScore = [...allSpeakers]
    .filter(s => !speakerMap[s])
    .sort((a, b) => scores[b].betzalel - scores[a].betzalel);
  if (byBetzalelScore[0] && scores[byBetzalelScore[0]].betzalel >= 2) {
    speakerMap[byBetzalelScore[0]] = 'הרב בצלאל כהן';
  }

  // 5. Assign guest via self-intro phrase ("כיף להתארח" etc.)
  const byGuestScore = [...allSpeakers]
    .filter(s => !speakerMap[s])
    .sort((a, b) => scores[b].guest - scores[a].guest);
  if (byGuestScore[0] && scores[byGuestScore[0]].guest >= 1 && guestName) {
    speakerMap[byGuestScore[0]] = guestName;
  }

  // 6. Fill remaining slots: Michal > Guest > Betzalel (by talk volume)
  const unmapped = allSpeakers.filter(s => !speakerMap[s]);
  const sortedByVolume = unmapped.sort((a, b) => scores[b].count - scores[a].count);
  for (const s of sortedByVolume) {
    const assigned = new Set(Object.values(speakerMap));
    if (!assigned.has('מיכל גלבוע אטר')) { speakerMap[s] = 'מיכל גלבוע אטר'; continue; }
    if (guestName && !assigned.has(guestName)) { speakerMap[s] = guestName; continue; }
    if (!assigned.has('הרב בצלאל כהן')) { speakerMap[s] = 'הרב בצלאל כהן'; continue; }
    speakerMap[s] = `דובר ${s}`;
  }

  return speakerMap;
}

const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
const episodesData = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf8'));

for (const episode of episodesData.episodes) {
  const transcriptPath = path.join(TRANSCRIPTS_DIR, `episode-${episode.id}.json`);
  if (!fs.existsSync(transcriptPath)) continue;

  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  const guestName = (episode.guest || '').replace(/^עם\s+/, '').trim();
  const speakerMap = identifySpeakers(transcript.utterances, guestName, episode.id, overrides);

  transcript.speakerMap = speakerMap;
  transcript.utterances = transcript.utterances.map(u => ({
    speaker: u.speaker,
    text: u.text,
    start: u.start,
    end: u.end,
    speakerName: speakerMap[u.speaker] || `דובר ${u.speaker}`
  }));

  fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2), 'utf8');
  console.log(`Ep ${episode.id}: ${JSON.stringify(speakerMap)}`);
}
