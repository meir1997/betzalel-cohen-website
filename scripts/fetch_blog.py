#!/usr/bin/env python3
"""
Fetch ALL posts from betochami.blogspot.com via Blogger's JSON feed
and write them into js/posts-data.js + js/posts-content.js.

Preserves manually-curated tags from the existing posts-data.js where possible
(by matching on blog post URL), and adds any new posts found in the feed.
"""

import json
import os
import re
import sys
import urllib.request

FEED_BASE = "https://betochami.blogspot.com/feeds/posts/default"
BATCH_SIZE = 150
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_JS = os.path.join(ROOT, "js", "posts-data.js")
CONTENT_JS = os.path.join(ROOT, "js", "posts-content.js")


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 BlogFetcher"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_all_entries():
    all_entries = []
    start_index = 1
    while True:
        url = f"{FEED_BASE}?alt=json&max-results={BATCH_SIZE}&start-index={start_index}"
        print(f"Fetching start-index={start_index}...", flush=True)
        data = fetch_json(url)
        entries = (data.get("feed") or {}).get("entry") or []
        if not entries:
            break
        all_entries.extend(entries)
        if len(entries) < BATCH_SIZE:
            break
        start_index += BATCH_SIZE
    print(f"Total entries fetched: {len(all_entries)}", flush=True)
    return all_entries


def plain_text(html):
    text = re.sub(r"<[^>]+>", " ", html)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"')
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_entry(entry):
    title = ((entry.get("title") or {}).get("$t") or "").strip()
    published = ((entry.get("published") or {}).get("$t") or "")
    date = published.split("T")[0]
    year = int(date.split("-")[0]) if date else 0

    url = ""
    for link in entry.get("link") or []:
        if link.get("rel") == "alternate" and link.get("href"):
            url = link["href"]
            break

    html = ((entry.get("content") or {}).get("$t") or
            (entry.get("summary") or {}).get("$t") or "")

    plain = plain_text(html)
    excerpt = plain[:220] + ("..." if len(plain) > 220 else "")

    image = ""
    m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if m:
        image = m.group(1)

    tags = []
    for cat in entry.get("category") or []:
        term = cat.get("term")
        if term:
            tags.append(term)

    return {
        "year": year,
        "date": date,
        "title": title,
        "excerpt": excerpt,
        "url": url,
        "tags": tags,
        "image": image,
    }, html


def load_existing_metadata():
    """Best-effort parse of the existing posts-data.js to preserve curated tags by URL."""
    try:
        with open(DATA_JS, "r", encoding="utf-8") as f:
            raw = f.read()
    except FileNotFoundError:
        return {}

    existing = {}
    pattern = re.compile(
        r'\{\s*year:\s*(\d+),\s*date:\s*"([^"]+)",\s*title:\s*"((?:[^"\\]|\\.)*)",'
        r'\s*excerpt:\s*"((?:[^"\\]|\\.)*)",\s*url:\s*"([^"]+)",\s*tags:\s*\[([^\]]*)\]'
    )
    for m in pattern.finditer(raw):
        url = m.group(5)
        tags_raw = m.group(6)
        tags = re.findall(r'"((?:[^"\\]|\\.)*)"', tags_raw)
        existing[url] = [t.replace('\\"', '"') for t in tags]
    return existing


def load_static_posts():
    """Load non-feed (static) posts from posts-data.js so they survive re-syncs.

    Static posts are identified by a URL that is NOT a blogspot feed URL
    (e.g. internal slugs like "calcalist-march-2026").
    """
    try:
        with open(DATA_JS, "r", encoding="utf-8") as f:
            raw = f.read()
    except FileNotFoundError:
        return [], {}

    static_posts = []
    image_re = r'(?:,\s*image:\s*"((?:[^"\\]|\\.)*)")?'
    pattern = re.compile(
        r'\{\s*year:\s*(\d+),\s*date:\s*"([^"]+)",\s*title:\s*"((?:[^"\\]|\\.)*)",'
        r'\s*excerpt:\s*"((?:[^"\\]|\\.)*)",\s*url:\s*"([^"]+)",\s*tags:\s*\[([^\]]*)\]'
        + image_re + r'\s*\}'
    )
    for m in pattern.finditer(raw):
        url = m.group(5)
        if url.startswith("http"):
            continue
        tags_raw = m.group(6)
        tags = re.findall(r'"((?:[^"\\]|\\.)*)"', tags_raw)
        static_posts.append({
            "year": int(m.group(1)),
            "date": m.group(2),
            "title": m.group(3).replace('\\"', '"').replace('\\\\', '\\'),
            "excerpt": m.group(4).replace('\\"', '"').replace('\\\\', '\\'),
            "url": url,
            "tags": [t.replace('\\"', '"') for t in tags],
            "image": (m.group(7) or "").replace('\\"', '"'),
        })

    # Also pull their HTML content from posts-content.js
    static_content = {}
    try:
        with open(CONTENT_JS, "r", encoding="utf-8") as f:
            craw = f.read()
        cm = re.search(r'const POST_CONTENT\s*=\s*(\{.*\})\s*;?\s*$', craw, re.DOTALL)
        if cm:
            all_content = json.loads(cm.group(1))
            for p in static_posts:
                if p["url"] in all_content:
                    static_content[p["url"]] = all_content[p["url"]]
    except FileNotFoundError:
        pass

    return static_posts, static_content


def js_string(s):
    """Encode a Python string as a JS double-quoted string literal."""
    return json.dumps(s, ensure_ascii=False)


def write_posts_data(posts):
    lines = [
        "// Blog Posts Data — Betzalel Cohen \"Betochami\"",
        "// Auto-extracted from betochami.blogspot.com",
        "",
        "const POSTS = [",
    ]
    current_year = None
    for p in posts:
        if p["year"] != current_year:
            if current_year is not None:
                lines.append("")
            lines.append(f"  // ===== {p['year']} =====")
            current_year = p["year"]
        tags_js = "[" + ",".join(js_string(t) for t in p["tags"]) + "]"
        entry_js = (
            "  { "
            f'year: {p["year"]}, '
            f'date: {js_string(p["date"])}, '
            f'title: {js_string(p["title"])}, '
            f'excerpt: {js_string(p["excerpt"])}, '
            f'url: {js_string(p["url"])}, '
            f'tags: {tags_js}, '
            f'image: {js_string(p["image"])}'
            " },"
        )
        lines.append(entry_js)
    lines.append("];")
    lines.append("")
    with open(DATA_JS, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Wrote {DATA_JS} with {len(posts)} posts", flush=True)


def write_posts_content(content_map):
    out = {}
    for url, html in content_map.items():
        out[url] = html
    serialized = json.dumps(out, ensure_ascii=False)
    with open(CONTENT_JS, "w", encoding="utf-8") as f:
        f.write("// Full blog post content — auto-generated from Blogspot feed\n")
        f.write("const POST_CONTENT = ")
        f.write(serialized)
        f.write(";\n")
    print(f"Wrote {CONTENT_JS} with {len(out)} entries", flush=True)


def main():
    existing_tags = load_existing_metadata()
    print(f"Existing posts with curated tags: {len(existing_tags)}", flush=True)

    static_posts, static_content = load_static_posts()
    print(f"Static (non-feed) posts preserved: {len(static_posts)}", flush=True)

    entries = fetch_all_entries()
    posts = []
    content_map = {}
    for entry in entries:
        parsed, html = parse_entry(entry)
        if not parsed["url"] or not parsed["title"]:
            continue
        # Prefer curated tags if they exist for this URL
        if parsed["url"] in existing_tags and existing_tags[parsed["url"]]:
            parsed["tags"] = existing_tags[parsed["url"]]
        posts.append(parsed)
        content_map[parsed["url"]] = html

    # Merge in static (non-feed) posts
    posts.extend(static_posts)
    content_map.update(static_content)

    # Sort by date descending
    posts.sort(key=lambda p: p.get("date", ""), reverse=True)

    if not posts:
        print("ERROR: no posts fetched!", flush=True)
        sys.exit(1)

    write_posts_data(posts)
    write_posts_content(content_map)
    print(f"Done. Total posts: {len(posts)}", flush=True)


if __name__ == "__main__":
    main()
