import re
import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

with open('mockData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

urls = re.findall(r"imageUrl:\s*['\"]([^'\"]+)['\"]", content)
print(f"Testing a sample of 10 out of {len(urls)} urls...")

broken = 0
for url in urls[:10]:
    if url.strip() in ("''", '""', ""):
        continue
    try:
        req = urllib.request.Request(url, method="HEAD", headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, context=ctx, timeout=5)
        if response.status != 200:
            print(f"[FAIL {response.status}] {url}")
            broken += 1
    except Exception as e:
        print(f"[{type(e).__name__}] {url}")
        broken += 1

print(f"Found {broken} broken images in sample.")
