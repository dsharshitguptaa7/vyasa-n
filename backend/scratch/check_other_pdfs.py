from pathlib import Path
from pypdf import PdfReader
import re

dl_dir = Path(r'C:\Users\harsh\Downloads')

for fname in ['SAMIKSHA_INCENTIVE_CERT_71_removed.pdf', 'SAMIKSHA_INCENTIVE_CERT_71-pages-deleted.pdf']:
    p = dl_dir / fname
    if p.exists():
        r = PdfReader(str(p))
        print(f'=== {fname} ({len(r.pages)} pages) ===')
        c_nums = []
        for idx, page in enumerate(r.pages):
            txt = page.extract_text() or ''
            m = re.search(r'CSJMU/SAMIKSHA/2026/(\d+)', txt)
            if m:
                c_nums.append(int(m.group(1)))
            else:
                c_nums.append(None)
        print(f'Cert numbers found: {len(c_nums)}')
        print(f'Numbers: {c_nums}')
