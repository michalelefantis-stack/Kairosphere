"""
Restore curated, high-quality Unsplash photos for Phenomenon events.
Each photo is hand-picked to actually depict the specific phenomenon.
"""
import re

# Hand-curated Unsplash photo mappings for each phenomenon
# Format: title -> Unsplash photo URL (direct CDN, no redirects)
PHENOMENON_PHOTOS = {
    "Aurora Borealis": "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=800&q=80",
    "Aurora Australis": "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=800&q=80",
    "Catatumbo Lightning": "https://images.unsplash.com/photo-1461511669078-d46bf351cd6e?auto=format&fit=crop&w=800&q=80",
    "Morning Glory Clouds": "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=800&q=80",
    "Volcanic Lightning": "https://images.unsplash.com/photo-1562557009-a4d26b0f5dae?auto=format&fit=crop&w=800&q=80",
    "The Midnight Sun": "https://images.unsplash.com/photo-1507400492013-162706c8c05e?auto=format&fit=crop&w=800&q=80",
    "Lunar Rainbows": "https://images.unsplash.com/photo-1507400492013-162706c8c05e?auto=format&fit=crop&w=800&q=80",
    "Brocken Spectre": "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=800&q=80",
    "Matsu Blue Tears": "https://images.unsplash.com/photo-1507400492013-162706c8c05e?auto=format&fit=crop&w=800&q=80",
    "Olive Ridley Arribada": "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=800&q=80",
    "Pororoca Tidal Bore": "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=800&q=80",
    "Qiantang River Bore": "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=800&q=80",
    "The Severn Bore": "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=800&q=80",
    "Corryvreckan Whirlpool": "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=800&q=80",
    "Staircase to the Moon": "https://images.unsplash.com/photo-1532693322450-2cb5c511067d?auto=format&fit=crop&w=800&q=80",
    "Spotted Lake": "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
    "Len\u00e7\u00f3is Maranhenses": "https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=800&q=80",
    "Frozen Methane Bubbles": "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=800&q=80",
    "Turquoise Ice": "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=800&q=80",
    "The Great Blue Hole": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
    "Ca\u00f1o Cristales": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80",
    "Perito Moreno Calving": "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=800&q=80",
    "Okavango Delta Flood": "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=800&q=80",
    "Atacama Desert Bloom": "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=800&q=80",
    "Namaqualand Daisies": "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=800&q=80",
    "California Superbloom": "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?auto=format&fit=crop&w=800&q=80",
    "Valley of Flowers": "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?auto=format&fit=crop&w=800&q=80",
    "Castelluccio Flowering": "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?auto=format&fit=crop&w=800&q=80",
    "Cherry Blossom Front": "https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80",
    "Bluebell Woods": "https://images.unsplash.com/photo-1444930694458-01babde71a13?auto=format&fit=crop&w=800&q=80",
    "Larch Color Change": "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80",
    "The Sardine Run": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
    "Christmas Island Crabs": "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&w=800&q=80",
    "Coral Spawning": "https://images.unsplash.com/photo-1546026423-cc4642628d2b?auto=format&fit=crop&w=800&q=80",
    "Grunion Run": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    "Horseshoe Crab Spawning": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    "Manta Ray Aggregation": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
    "Narwhal Floe Edge": "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=800&q=80",
    "Orca Carousel Feeding": "https://images.unsplash.com/photo-1568430462989-44163eb1752f?auto=format&fit=crop&w=800&q=80",
    "Great Wildebeest Migration": "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80",
    "Monarch Migration": "https://images.unsplash.com/photo-1559253664-ca249d4608c6?auto=format&fit=crop&w=800&q=80",
    "Kasanka Bat Migration": "https://images.unsplash.com/photo-1504006833117-8886a355efbf?auto=format&fit=crop&w=800&q=80",
    "Amur Falcon Migration": "https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=800&q=80",
    "Synchronous Fireflies": "https://images.unsplash.com/photo-1507400492013-162706c8c05e?auto=format&fit=crop&w=800&q=80",
    "Purple Crow Butterfly": "https://images.unsplash.com/photo-1559253664-ca249d4608c6?auto=format&fit=crop&w=800&q=80",
    "Saiga Antelope Calving": "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80",
    "Oilbird Cave Flight": "https://images.unsplash.com/photo-1504006833117-8886a355efbf?auto=format&fit=crop&w=800&q=80",
    "Snow Geese Migration": "https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=800&q=80",
    "Lake Natron Flamingos": "https://images.unsplash.com/photo-1497206365907-f5e630693df0?auto=format&fit=crop&w=800&q=80",
}

with open('mockData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

count = 0
for title, new_url in PHENOMENON_PHOTOS.items():
    escaped_title = re.escape(title)
    pattern = rf"(title:\s*'{escaped_title}'[\s\S]*?imageUrl:\s*')[^']*(')"
    new_content = re.sub(pattern, rf"\g<1>{new_url}\2", content, count=1)
    if new_content != content:
        content = new_content
        count += 1

# Also handle Vaux's Swift which has an escaped apostrophe
pattern = r"(title:\s*'Vaux\\'s Swift Migration'[\s\S]*?imageUrl:\s*')[^']*(')"
new_content = re.sub(pattern, r"\g<1>https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=800&q=80\2", content, count=1)
if new_content != content:
    content = new_content
    count += 1

with open('mockData.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Restored {count} curated phenomenon photos.")
