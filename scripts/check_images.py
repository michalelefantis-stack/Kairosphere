import re

with open('mockData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

events = re.split(r'({\s*id:)', content)
missing_or_empty = []

for i in range(1, len(events), 2):
    block = events[i] + events[i+1]
    title_m = re.search(r"title:\s*['\"]([^'\"]+)['\"]", block)
    img_m = re.search(r"imageUrl:\s*([^,}\n]+)", block)
    
    if title_m:
        title = title_m.group(1)
        if not img_m:
            missing_or_empty.append(title)
        else:
            img_val = img_m.group(1).strip()
            if img_val in ("''", '""') or img_val.lower() == 'null':
                missing_or_empty.append(title)

with open('scripts/missing_images.txt', 'w', encoding='utf-8') as out:
    out.write(f"Missing or Empty ({len(missing_or_empty)}):\n")
    for t in missing_or_empty:
        out.write("  - " + t + "\n")
