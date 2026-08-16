import re
import ssl
import urllib.request
import concurrent.futures
import hashlib

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

with open('mockData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

def check_image(match):
    idx, id_str, url = match
    if url.strip() in ("", "''", '""', "null"):
        return (idx, id_str, url, False)
    try:
        req = urllib.request.Request(url, method="HEAD", headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, context=ctx, timeout=3)
        return (idx, id_str, url, response.status == 200)
    except:
        return (idx, id_str, url, False)

# Find all items and their ids and image urls
events = re.split(r'({\s*id:\s*[\'"]([^\'"]+)[\'"])', content)
# events[0] is preamble, events[1] is `{\nid:'xx'`, events[2] is `xx`, events[3] is the rest of the object
# So stride is 3. i.e. 1, 4, 7...
# Actually re.split with 1 group creates a list of (text, separator, text, separator)
# wait, my regex has 2 capture groups!
# It splits like: text, full_match_group1, id_group2, text_after

urls_to_check = []
# It returns [preamble, group1, group2, text, group1, group2, text...]
for i in range(1, len(events), 3):
    block_id_full = events[i]
    event_id = events[i+1]
    block = events[i+2]
    
    img_m = re.search(r"imageUrl:\s*([^,}\n]+)", block)
    if img_m:
        img_val = img_m.group(1).strip().strip("'").strip('"')
        urls_to_check.append((i+2, event_id, img_val))

print(f"Loaded {len(urls_to_check)} images to check.")

broken_count = 0
patches = {}

with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    results = executor.map(check_image, urls_to_check)
    for idx, id_str, url, is_valid in results:
        if not is_valid:
            broken_count += 1
            # Generate deterministic fallback
            seed = hashlib.md5(id_str.encode()).hexdigest()[:8]
            fallback_url = f"https://picsum.photos/seed/{seed}/800/600"
            patches[idx] = (url, fallback_url)

print(f"Found {broken_count} broken/missing images. Applying patches...")

for idx, (old_url, new_url) in patches.items():
    block = events[idx]
    # Be careful not to replace something else, but since we modify only this block:
    # the exact matched string could be empty, let's just replace the exact imageUrl line
    # Since old_url can be empty string, we regex replace the whole line in that block.
    events[idx] = re.sub(r"(imageUrl:\s*)[^,\n]+", r"\g<1>'" + new_url + "'", block, count=1)

final_content = "".join(events)

with open('mockData.ts', 'w', encoding='utf-8') as f:
    f.write(final_content)

print("mockData.ts successfully updated with working robust photo links.")
