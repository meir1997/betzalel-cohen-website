const fs = require('fs');
const path = require('path');

const EPISODES_FILE = path.join(__dirname, '../episodes.json');
const TRANSCRIPTS_DIR = path.join(__dirname, '../transcripts');

function identifySpeakers(utterances, guestName) {
  // Count utterances per speaker
  const counts = {};
  utterances.forEach(u => {
    counts[u.speaker] = (counts[u.speaker] || 0) + 1;
  });

  // Heuristic: find Michal by self-introduction (only first match)
  const speakerMap = {};
  const takenNames = new Set();

  for (const u of utterances) {
    if (speakerMap[u.speaker]) continue;
    const t = u.text;
    if (!takenNames.has('מיכל גלבוע אטר') && /אני מיכל|אני גלבוע|אני מיכל גלבוע/.test(t)) {
      speakerMap[u.speaker] = 'מיכל גלבוע אטר';
      takenNames.add('מיכל גלבוע אטר');
    } else if (!takenNames.has('הרב בצלאל כהן') && /אני בצלאל|אני הרב בצלאל|אני הרב כהן/.test(t)) {
      speakerMap[u.speaker] = 'הרב בצלאל כהן';
      takenNames.add('הרב בצלאל כהן');
    }
  }

  // The speaker who says "כיף להתארח" or "תודה שהזמנתם" is the guest
  for (const u of utterances) {
    if (!speakerMap[u.speaker]) {
      if (/כיף להתארח|תודה ש(ה)?זמנתם|שמח להיות כאן|שמחה להיות כאן/.test(u.text)) {
        speakerMap[u.speaker] = guestName || 'אורח';
        takenNames.add(speakerMap[u.speaker]);
        break;
      }
    }
  }

  // Fill in remaining speakers - re-check assigned names on every iteration
  const allSpeakers = Object.keys(counts);
  const unmapped = allSpeakers.filter(s => !speakerMap[s]);
  const sortedUnmapped = unmapped.sort((a, b) => counts[b] - counts[a]);

  for (const s of sortedUnmapped) {
    const assigned = new Set(Object.values(speakerMap));
    if (!assigned.has('מיכל גלבוע אטר')) { speakerMap[s] = 'מיכל גלבוע אטר'; continue; }
    if (!assigned.has('הרב בצלאל כהן')) { speakerMap[s] = 'הרב בצלאל כהן'; continue; }
    if (guestName && !assigned.has(guestName)) { speakerMap[s] = guestName; continue; }
    speakerMap[s] = `דובר ${s}`;
  }

  return speakerMap;
}

const episodesData = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf8'));

for (const episode of episodesData.episodes) {
  const transcriptPath = path.join(TRANSCRIPTS_DIR, `episode-${episode.id}.json`);
  if (!fs.existsSync(transcriptPath)) continue;

  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  const guestName = (episode.guest || '').replace(/^עם\s+/, '').trim();
  const speakerMap = identifySpeakers(transcript.utterances, guestName);

  transcript.speakerMap = speakerMap;
  transcript.utterances = transcript.utterances.map(u => ({
    ...u,
    speakerName: speakerMap[u.speaker] || `דובר ${u.speaker}`
  }));

  fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2), 'utf8');
  console.log(`Ep ${episode.id}: ${JSON.stringify(speakerMap)}`);
}
