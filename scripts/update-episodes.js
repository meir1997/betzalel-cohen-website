const https = require('https');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const PODCAST_ID = '1874924988';
const EPISODES_FILE = path.join(__dirname, '../episodes.json');

// Manual guest overrides by exact episode title match (case insensitive, partial)
// When the RSS title doesn't follow the "עם X" pattern, add an override here.
const GUEST_OVERRIDES = [
  { titleIncludes: 'מחומה לקריסה', guest: 'עם שלמה טייטלבאום' },
  { titleIncludes: 'איך נחיה פה יחד', guest: 'עם נורית קנטי' },
  { titleIncludes: 'כאילו לא חרב העולם', guest: 'עם אהרן מלאך' }
];

// Manual title fixes for known encoding issues
const TITLE_OVERRIDES = [
  { titleIncludes: 'נורית קנטי מראיינת', fixed: 'איך נחיה פה יחד? נורית קנטי מראיינת את מיכל ובצלאל' }
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('utf8'));
      });
    }).on('error', reject);
  });
}

async function getRSSFeedUrl() {
  const lookupUrl = `https://itunes.apple.com/lookup?id=${PODCAST_ID}&entity=podcast`;
  const response = await fetch(lookupUrl);
  const json = JSON.parse(response);
  if (!json.results || json.results.length === 0) {
    throw new Error('Podcast not found in iTunes Lookup');
  }
  return json.results[0].feedUrl;
}

function formatDuration(raw) {
  if (!raw) return '';
  if (typeof raw === 'string' && raw.includes(':')) {
    const parts = raw.split(':').map(p => p.padStart(2, '0'));
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return h === '00' ? `${parseInt(m, 10)}:${s}` : `${parseInt(h, 10)}:${m}:${s}`;
    }
    return raw;
  }
  const s = parseInt(raw, 10);
  if (isNaN(s)) return raw;
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function cleanTitle(title) {
  let t = title.trim();
  t = t.replace(/^חרדים למדינה\s*[|:\-–]\s*/, '');
  t = t.replace(/\s*[|:\-–]\s*חרדים למדינה.*$/, '');
  t = t.replace(/,?\s*עם [^,|]+$/, '');
  return t.trim();
}

function applyTitleOverride(title) {
  for (const override of TITLE_OVERRIDES) {
    if (title.includes(override.titleIncludes)) {
      return override.fixed;
    }
  }
  return title;
}

function extractGuest(rawTitle, cleanedTitle) {
  // Check manual overrides first
  for (const override of GUEST_OVERRIDES) {
    if (rawTitle.includes(override.titleIncludes) || cleanedTitle.includes(override.titleIncludes)) {
      return override.guest;
    }
  }

  // Pattern: "עם X" at end
  const withMatch = rawTitle.match(/עם ([^|,]+?)\s*$/);
  if (withMatch) return `עם ${withMatch[1].trim()}`;

  // Pattern: "X מראיינת/מראיין"
  const interviewerMatch = rawTitle.match(/([^|,?]+?)\s+מראיינ[הת]?/);
  if (interviewerMatch) return `עם ${interviewerMatch[1].trim()}`;

  return '';
}

async function updateEpisodes() {
  try {
    console.log('🔎 Looking up RSS feed URL...');
    const rssUrl = await getRSSFeedUrl();
    console.log(`📡 RSS feed: ${rssUrl}`);

    console.log('📥 Fetching RSS...');
    const rssData = await fetch(rssUrl);

    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(rssData);

    const items = result.rss.channel[0].item || [];
    const total = items.length;
    const episodes = [];

    items.forEach((item, index) => {
      const rawTitle = item.title?.[0] || '';
      const pubDate = item.pubDate?.[0] || '';
      const duration = formatDuration(item['itunes:duration']?.[0] || '');
      const episodeNum = total - index;
      let audioUrl = item.enclosure?.[0]?.$?.url || '';

      // anchor.fm wraps the real MP3 URL after /play/{id}/ (URL-encoded).
      // Extract the direct CDN URL to avoid redirect issues in browsers.
      const directMatch = audioUrl.match(/\/play\/\d+\/(https?.+)$/);
      if (directMatch) {
        try {
          audioUrl = decodeURIComponent(directMatch[1]);
        } catch (e) {
          // Keep wrapped URL if decoding fails
        }
      }

      const cleaned = applyTitleOverride(cleanTitle(rawTitle));
      const guest = extractGuest(rawTitle, cleaned);

      episodes.push({
        id: episodeNum,
        title: cleaned,
        guest: guest,
        duration: duration,
        audioUrl: audioUrl,
        url: 'https://www.youtube.com/playlist?list=PLFsmVOv76mMrIgph_mbxx_wFTRPDdecRY',
        publishedAt: new Date(pubDate).toISOString().split('T')[0]
      });
    });

    const episodesData = {
      episodes: episodes,
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodesData, null, 2), 'utf8');
    console.log(`✅ Updated ${episodes.length} episodes`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateEpisodes();
