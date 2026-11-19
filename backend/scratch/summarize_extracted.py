import json
import re

with open('scratch/all_71_extracted.json') as f:
    data = json.load(f)

print(f'Total pages: {len(data)}')
successful = [d for d in data if d.get('qr_url')]
print(f'Successful QR decodes: {len(successful)} / {len(data)}')

tokens = []
for d in data:
    p = d['page']
    qr = d.get('qr_url')
    txt = d.get('text_preview', '')
    m = re.search(r'CSJMU/SAMIKSHA/2026/\d+', txt)
    cno = m.group(0) if m else 'UNKNOWN'
    token = qr.split('/')[-1] if qr else 'NONE'
    tokens.append((p, cno, token, qr))

print('\nFirst 10 certificates:')
for p, cno, tok, qr in tokens[:10]:
    print(f'  P{p:2d}: {cno} | Token: {tok} | URL: {qr}')

print('\nLast 10 certificates:')
for p, cno, tok, qr in tokens[-10:]:
    print(f'  P{p:2d}: {cno} | Token: {tok} | URL: {qr}')

# Check for duplicates or missing
all_cnos = [t[1] for t in tokens]
print(f'\nUnique cert numbers: {len(set(all_cnos))}')
all_toks = [t[2] for t in tokens]
print(f'Unique tokens: {len(set(all_toks))}')
