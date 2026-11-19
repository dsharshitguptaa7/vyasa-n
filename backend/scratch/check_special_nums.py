import json
import re

with open('scratch/removed_extracted.json') as f:
    data = json.load(f)

print(f'Total pages in removed: {len(data)}')
for d in data:
    txt = d.get('text', '')
    m = re.search(r'CSJMU/SAMIKSHA/2026/(\d+)', txt)
    if m:
        num = int(m.group(1))
        if num in [19, 36, 45, 73, 74]:
            print(f"Page {d['page']:2d}: Cert {num} | QR: {d.get('qr_url')}")
            # print recipient and title
            lines = [l.strip() for l in txt.split('  ') if l.strip()]
            for l in lines[:5]:
                print(f"   {l}")
