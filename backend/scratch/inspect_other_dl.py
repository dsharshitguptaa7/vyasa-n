from pathlib import Path
from pypdf import PdfReader
import re

dl_dir = Path(r'C:\Users\harsh\Downloads')

for fname in [
    'CERTIFICATES FINAL.pdf',
    'CSJMU_Certificate_Draft_Preview_1794726555610.pdf',
    'DR ADARSH SIR CERTIFICATES.pdf',
    'DR POOJA MAM CERTIFICATES.pdf',
    'DR PRIYANKA MAURYA MAM CERTIFICATES.pdf'
]:
    p = dl_dir / fname
    if p.exists():
        r = PdfReader(str(p))
        print('='*60)
        print(f'{fname}: {len(r.pages)} pages')
        c_nums = set()
        for page in r.pages:
            txt = page.extract_text() or ''
            for m in re.finditer(r'CSJMU/[A-Z0-9_\-\/]+', txt):
                c_nums.add(m.group(0))
        print(f'Sample cert numbers found ({len(c_nums)} total):')
        for c in sorted(list(c_nums))[:10]:
            print(' ', c)
        if 'CSJMU/SAMIKSHA/2026/000045' in c_nums:
            print('  >>> FOUND 000045 in', fname)
        if 'CSJMU/SAMIKSHA/2026/000073' in c_nums:
            print('  >>> FOUND 000073 in', fname)
