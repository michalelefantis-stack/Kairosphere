"""
Fetch real, event-specific photos from Wikimedia Commons for every event in mockData.ts.
Uses the free MediaWiki API (no key required) to search for actual photos of each event.
Falls back to searching by region/country if the event title yields no results.
"""

import re
import json
import hashlib
import urllib.request
import urllib.parse
import ssl
import time
import concurrent.futures

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {'User-Agent': 'KairosphereBot/1.0 (cultural event photo fetcher)'}

def wiki_image_search(query: str, limit: int = 3) -> list[str]:
    """Search Wikimedia Commons for images matching a query. Returns list of direct image URLs."""
    try:
        params = urllib.parse.urlencode({
            'action': 'query',
            'generator': 'search',
            'gsrsearch': f'File: {query}',
            'gsrnamespace': '6',  # File namespace
            'gsrlimit': str(limit),
            'prop': 'imageinfo',
            'iiprop': 'url|size|mediatype',
            'iiurlwidth': '800',
            'format': 'json',
        })
        url = f'https://commons.wikimedia.org/w/api.php?{params}'
        req = urllib.request.Request(url, headers=HEADERS)
        resp = urllib.request.urlopen(req, context=ctx, timeout=10)
        data = json.loads(resp.read().decode('utf-8'))

        pages = data.get('query', {}).get('pages', {})
        urls = []
        for page_id, page in pages.items():
            if int(page_id) < 0:
                continue
            for ii in page.get('imageinfo', []):
                # Prefer the thumbnail at 800px width if available
                thumb = ii.get('thumburl', ii.get('url', ''))
                media_type = ii.get('mediatype', '')
                if media_type in ('BITMAP', 'DRAWING') and thumb:
                    urls.append(thumb)
        return urls
    except Exception as e:
        return []


def find_best_image(title: str, region: str) -> str | None:
    """Try multiple search strategies to find a real photo for an event."""
    # Strategy 1: Search by exact event title
    urls = wiki_image_search(title)
    if urls:
        return urls[0]

    # Strategy 2: Title + country/region keywords
    region_parts = [p.strip() for p in region.split(',')]
    country = region_parts[-1] if region_parts else ''
    locality = region_parts[0] if region_parts else ''

    if country:
        urls = wiki_image_search(f'{title} {country}')
        if urls:
            return urls[0]

    # Strategy 3: Just the locality/region
    if locality and locality != country:
        urls = wiki_image_search(f'{locality} festival culture')
        if urls:
            return urls[0]

    # Strategy 4: Country + culture
    if country:
        urls = wiki_image_search(f'{country} cultural festival')
        if urls:
            return urls[0]

    return None


# =============================================================================
# Parse mockData.ts
# =============================================================================
with open('mockData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all events with their titles, regions, and current imageUrl positions
EVENT_PATTERN = re.compile(
    r"id:\s*'([^']+)'.*?"
    r"title:\s*'([^']*)'.*?"
    r"region:\s*'([^']*)'.*?"
    r"imageUrl:\s*'([^']*)'",
    re.DOTALL
)

events = []
for m in EVENT_PATTERN.finditer(content):
    events.append({
        'id': m.group(1),
        'title': m.group(2),
        'region': m.group(3),
        'old_url': m.group(4),
        'start': m.start(4),
        'end': m.end(4),
    })

print(f"Found {len(events)} events to process.")

# =============================================================================
# Fetch images (with rate limiting to be respectful to Wikimedia)
# =============================================================================
replacements = {}  # old_url -> new_url mapping by event id
success = 0
failed = 0

for i, ev in enumerate(events):
    title = ev['title']
    region = ev['region']
    eid = ev['id']

    new_url = find_best_image(title, region)
    if new_url:
        replacements[eid] = new_url
        success += 1
        print(f"  [{i+1}/{len(events)}] ✓ {title}")
    else:
        failed += 1
        print(f"  [{i+1}/{len(events)}] ✗ {title} (keeping current)")

    # Rate limit: ~2 requests per second to be respectful
    time.sleep(0.5)

    # Progress checkpoint every 50
    if (i + 1) % 50 == 0:
        print(f"  ... processed {i+1}/{len(events)} ({success} found, {failed} not found)")

print(f"\nResults: {success} real photos found, {failed} kept existing.")

# =============================================================================
# Apply replacements to mockData.ts
# =============================================================================
for ev in events:
    eid = ev['id']
    if eid in replacements:
        old_url = ev['old_url']
        new_url = replacements[eid]
        # Escape any special regex characters in the old URL
        content = content.replace(
            f"imageUrl: '{old_url}'",
            f"imageUrl: '{new_url}'",
            1  # Replace only first occurrence
        )

with open('mockData.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✅ mockData.ts updated with {success} real event photos!")
