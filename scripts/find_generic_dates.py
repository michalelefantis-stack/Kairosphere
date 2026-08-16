import re

with open('mockData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

events = []
blocks = re.split(r'({\s*id:)', content)

with open('scripts/generic_dates.txt', 'w', encoding='utf-8') as out:
    for i in range(1, len(blocks), 2):
        block = blocks[i] + blocks[i+1]
        title_m = re.search(r"title:\s*['\"]([^'\"]+)['\"]", block)
        start_m = re.search(r"startDate:\s*['\"]([^'\"]+)['\"]", block)
        end_m = re.search(r"endDate:\s*['\"]([^'\"]+)['\"]", block)
        
        if title_m and start_m and end_m:
            title = title_m.group(1)
            start = start_m.group(1)
            end = end_m.group(1)
            
            if ("-01-01" in start and "-12-31" in end) or ("-01-01" in start and "-12-30" in end):
                out.write(f"{title} | {start} to {end}\n")
                events.append(title)
                
    out.write(f"\nTotal full-year generic dates found: {len(events)}")
