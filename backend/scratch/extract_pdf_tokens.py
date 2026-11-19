import re
from pathlib import Path

cert_dir = Path('backend/storage/sama_veda/certificates')
for pdf_path in sorted(cert_dir.glob('*.pdf')):
    data = pdf_path.read_bytes()
    print('='*60)
    print(f'File: {pdf_path.name}')
    matches = re.findall(rb'https?://[^\s\)<>]+', data)
    print(f'Raw URL regex matches: {[m.decode("latin1", errors="ignore") for m in matches]}')
    tok_matches = re.findall(rb'tok-[a-zA-Z0-9_-]+', data)
    print(f'tok- matches: {[m.decode("latin1", errors="ignore") for m in tok_matches]}')
    verify_matches = re.findall(rb'[a-zA-Z0-9_\-\.\/]*verify[a-zA-Z0-9_\-\.\/]*', data, re.IGNORECASE)
    print(f'verify matches: {set([m.decode("latin1", errors="ignore") for m in verify_matches])}')
