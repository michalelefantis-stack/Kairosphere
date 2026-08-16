import re

print("Running phenomenom date replacement...")

# Mappings of exact seasonal date ranges for 2026 
replacements = {
    "Aurora Borealis": ("2026-09-01", "2026-03-31"),
    "Aurora Australis": ("2026-03-01", "2026-09-30"),
    "Catatumbo Lightning": ("2026-04-01", "2026-11-30"),
    "Morning Glory Clouds": ("2026-09-01", "2026-11-30"),
    "Volcanic Lightning": ("2026-01-01", "2026-12-31"), # Usually unpredictable, but we will leave a comment? Actually no, all phenom must be fixed. Let's do a nominal date.
    "The Midnight Sun": ("2026-06-12", "2026-07-01"),
    "Lunar Rainbows": ("2026-04-01", "2026-08-30"),
    "Brocken Spectre": ("2026-11-01", "2026-03-31"),
    "Matsu Blue Tears": ("2026-04-01", "2026-08-31"),
    "Olive Ridley Arribada": ("2026-08-01", "2026-12-15"),
    "Pororoca Tidal Bore": ("2026-02-01", "2026-04-30"),
    "Qiantang River Bore": ("2026-09-15", "2026-10-15"),
    "The Severn Bore": ("2026-03-01", "2026-04-30"),
    "Corryvreckan Whirlpool": ("2026-03-01", "2026-10-31"), # High tides
    "Staircase to the Moon": ("2026-03-01", "2026-11-30"),
    "Spotted Lake": ("2026-06-01", "2026-08-31"),
    "Lençóis Maranhenses": ("2026-06-01", "2026-09-30"),
    "Frozen Methane Bubbles": ("2026-12-01", "2026-02-28"),
    "Turquoise Ice": ("2026-02-01", "2026-03-15"),
    "The Great Blue Hole": ("2026-01-01", "2026-12-31"), # Perennial
    "Caño Cristales": ("2026-07-01", "2026-11-30"),
    "Perito Moreno Calving": ("2026-11-01", "2026-03-31"),
    "Okavango Delta Flood": ("2026-05-01", "2026-08-31"),
    "Atacama Desert Bloom": ("2026-09-01", "2026-11-30"),
    "Namaqualand Daisies": ("2026-08-01", "2026-09-30"),
    "California Superbloom": ("2026-03-01", "2026-05-31"),
    "Valley of Flowers": ("2026-07-01", "2026-09-30"),
    "Castelluccio Flowering": ("2026-05-20", "2026-07-10"),
    "Cherry Blossom Front": ("2026-03-20", "2026-05-10"),
    "Bluebell Woods": ("2026-04-15", "2026-05-20"),
    "Larch Color Change": ("2026-09-15", "2026-10-15"),
    "The Sardine Run": ("2026-05-15", "2026-07-31"),
    "Christmas Island Crabs": ("2026-10-01", "2026-12-31"),
    "Coral Spawning": ("2026-11-15", "2026-12-20"),
    "Grunion Run": ("2026-03-01", "2026-08-31"),
    "Horseshoe Crab Spawning": ("2026-05-01", "2026-06-30"),
    "Manta Ray Aggregation": ("2026-05-01", "2026-11-30"),
    "Narwhal Floe Edge": ("2026-05-15", "2026-06-30"),
    "Orca Carousel Feeding": ("2026-11-01", "2026-01-31"),
    "Great Wildebeest Migration": ("2026-07-01", "2026-10-31"),
    "Monarch Migration": ("2026-11-01", "2026-03-31"),
    "Kasanka Bat Migration": ("2026-10-15", "2026-12-15"),
    "Amur Falcon Migration": ("2026-10-01", "2026-11-30"),
    "Synchronous Fireflies": ("2026-05-20", "2026-06-20"),
    "Purple Crow Butterfly": ("2026-12-01", "2026-03-31"),
    "Saiga Antelope Calving": ("2026-05-01", "2026-05-31"),
    "Vaux\\\\'s Swift Migration": ("2026-08-15", "2026-10-15"), # Fixed vaux\'s -> vaux\\\\'s for regex
    "Oilbird Cave Flight": ("2026-01-01", "2026-12-31"),
    "Snow Geese Migration": ("2026-09-01", "2026-11-30"),
    "Lake Natron Flamingos": ("2026-08-01", "2026-10-31"),
    "Ganga Aarti": ("2026-01-01", "2026-12-31"), # Daily occurrence
}

with open('mockData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

count = 0
for title, (new_start, new_end) in replacements.items():
    # We find the block with this title and replace the startDate and endDate correctly
    # title string might have quotes or backslashes
    title_regex = re.escape(title)
    if "Vaux" in title:
        title_regex = re.escape("Vaux's Swift Migration") # Account for string literal
        
    pattern = rf"(title:\s*['\"]{title_regex}['\"][\s\S]*?)startDate:\s*['\"]2025-01-01['\"]"
    new_content = re.sub(pattern, r"\g<1>startDate: '" + new_start + r"'", content)
    if new_content != content:
        content = new_content
        # Do end date
        pattern2 = rf"(title:\s*['\"]{title_regex}['\"][\s\S]*?)endDate:\s*['\"]2025-12-31['\"]"
        content = re.sub(pattern2, r"\g<1>endDate: '" + new_end + r"'", content)
        count += 1
        
# A few of the items don't have hardcoded exact season limits, 
# for perennial things let's leave them as 2026-01-01 to 2026-12-31
content = content.replace("2025-01-01", "2026-01-01").replace("2025-12-31", "2026-12-31")

with open('mockData.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Updates completed. Modified exact season dates for {count} events.")
