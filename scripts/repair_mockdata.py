import re

with open('mockData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# =============================================================================
# FIX 1: Repair corrupted id lines
# The broken pattern looks like: id: 'some-id'some-id,
# It should be:                  id: 'some-id',
# =============================================================================
# Match:  id: 'VALUE'VALUE,  where VALUE is repeated
fix_count = 0
def fix_id_line(m):
    global fix_count
    fix_count += 1
    return f"id: '{m.group(1)}',"

content = re.sub(r"id:\s*'([^']+)'\1,", fix_id_line, content)
print(f"Fixed {fix_count} corrupted id lines.")

# =============================================================================
# FIX 2: Replace all picsum.photos URLs with reliable Unsplash direct URLs
# picsum.photos uses 302 redirects which can fail in strict <img> contexts
# =============================================================================

# Curated list of 30 reliable Unsplash photo IDs (nature, culture, festivals, landscapes)
UNSPLASH_PHOTOS = [
    "photo-1506905925346-21bda4d32df4",  # mountain landscape
    "photo-1469474968028-56623f02e42e",  # nature valley
    "photo-1470071459604-3b5ec3a7fe05",  # green hills
    "photo-1441974231531-c6227db76b6e",  # forest path
    "photo-1472214103451-9374bd1c798e",  # sunset field
    "photo-1465146344425-f00d5f5c8f07",  # wildflowers
    "photo-1507525428034-b723cf961d3e",  # beach
    "photo-1476514525535-07fb3b4ae5f1",  # waterfall
    "photo-1518837695005-2083093ee35b",  # ocean wave
    "photo-1504198453319-5ce911bafcde",  # northern lights
    "photo-1531366936337-7c912a4589a7",  # aurora
    "photo-1488866022916-f7f2a032a1e0",  # cultural dance
    "photo-1533669955142-6a73332af4db",  # temple
    "photo-1548013146-72479768bada",  # taj mahal
    "photo-1512100356356-de1b84283e18",  # desert dunes
    "photo-1501785888041-af3ef285b470",  # lake reflection
    "photo-1464822759023-fed622ff2c3b",  # mountain peak
    "photo-1542224566-6e85f2e6772f",  # rocky coast
    "photo-1519681393784-d120267933ba",  # starry mountain
    "photo-1494500764479-0c8f2919a3d8",  # forest
    "photo-1433086966358-54859d0ed716",  # waterfall bridge
    "photo-1505765050516-f72dcac9c60e",  # canyon
    "photo-1500534314263-0869cef74810",  # volcano
    "photo-1473448912268-2022ce9509d8",  # autumn forest
    "photo-1508739773434-c26b3d09e071",  # sunset clouds
    "photo-1540206395-68808572332f",  # mountain lake
    "photo-1475924156734-496f6cac6ec1",  # aerial coast
    "photo-1532274402911-5a369e4c4bb5",  # cherry blossom
    "photo-1493246507139-91e8fad9978e",  # mountain snow
    "photo-1502082553048-f009c37129b9",  # sunlit trees
]

import hashlib

def get_unsplash_url(seed: str) -> str:
    h = int(hashlib.md5(seed.encode()).hexdigest()[:8], 16)
    photo_id = UNSPLASH_PHOTOS[h % len(UNSPLASH_PHOTOS)]
    return f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w=800&q=80"

# Replace all picsum URLs
picsum_count = 0
def replace_picsum(m):
    global picsum_count
    picsum_count += 1
    # Use the picsum seed as our hash seed for determinism
    seed = m.group(1)
    return f"'{get_unsplash_url(seed)}'"

content = re.sub(r"'https://picsum\.photos/seed/([^/]+)/800/600'", replace_picsum, content)
print(f"Replaced {picsum_count} picsum URLs with direct Unsplash URLs.")

# =============================================================================
# FIX 3: Find any remaining empty or obviously broken imageUrl values
# =============================================================================
empty_count = 0
def fix_empty(m):
    global empty_count
    empty_count += 1
    seed = str(empty_count)
    return f"imageUrl: '{get_unsplash_url(seed)}'"

content = re.sub(r"imageUrl:\s*''", fix_empty, content)
content = re.sub(r'imageUrl:\s*""', fix_empty, content)
print(f"Fixed {empty_count} empty imageUrl values.")

with open('mockData.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! mockData.ts has been repaired.")
